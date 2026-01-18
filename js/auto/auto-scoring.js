/**
 * auto-scoring.js
 * Motore di scoring per la generazione automatica - v4.0
 *
 * FILOSOFIA v4:
 * - Deterministico: stessi input = stesso output
 * - Trasparente: ogni punto ha una motivazione
 * - Gerarchia chiara: SEDE > PREFERENZE > BILANCIAMENTO
 * - Pesi significativi: sede domina (100/40), preferenze influenzano (±20), bilanciamento pareggia (max 20)
 *
 * Formula:
 *   score = sede (100/40) + preferenze (±20) + bilanciamento (max 20) + random (0-2)
 */

import { valutaRegolaCustom } from '../regole-custom.js';
import { getState } from '../state.js';
import { caricaTurno } from '../storage.js';
import { calcolaMinutiTurno } from '../turni.js';

console.log('📊 [AUTO-SCORING] Modulo caricato correttamente (v4.0 - formula sede>preferenze>bilanciamento)');

/**
 * Calcola lo score di un operatore per un'assegnazione specifica
 *
 * FORMULA v4:
 *   score = sede (100/40) + preferenze (±20) + bilanciamento (max 20) + random (0-2)
 *
 * GERARCHIA:
 *   1. SEDE (100/40) - domina sempre
 *   2. PREFERENZE (±20) - influenzano ma non sovrastano sede
 *   3. BILANCIAMENTO (max 20) - pareggia tra operatori con stesso livello
 *   4. RANDOM (0-2) - evita pattern fissi
 *
 * @param {Object} profilo - Profilo operatore completo
 * @param {number} giorno - Giorno del mese
 * @param {string} codiceTurno - Codice turno (es. "BM")
 * @param {string} ambulatorio - ID ambulatorio
 * @param {Object} context - Contesto completo (oreSettimana, giorniConsecutivi, etc.)
 * @returns {Object} - { totale, breakdown, motivazioni, confidenza }
 */
export function calcolaScoreOperatore(profilo, giorno, codiceTurno, ambulatorio, context) {
    const breakdown = {
        sede: 0,              // +100 (primaria) o +40 (secondaria)
        preferenzeTurno: 0,   // ±20 (preferiti/evitati)
        bilanciamento: 0,     // max +20 (inversamente proporzionale ore)
        variazione: 0,        // +0-2 (random)
        vincoliViolati: 0,    // penalità vincoli hard
        totale: 0
    };

    const motivazioni = [];

    // ========================================
    // 1️⃣ SEDE (più importante di tutto)
    // ========================================
    // Per turni MULTI-SEDE, calcoliamo score massimo tra tutti gli ambulatori dei segmenti
    const { turni } = getState();
    const turnoObj = turni[codiceTurno];

    if (turnoObj && turnoObj.segmenti && Array.isArray(turnoObj.segmenti) && turnoObj.segmenti.length > 0) {
        // Turno con segmenti: valuta ogni ambulatorio presente
        let maxScore = 0;
        const ambulatoriPresenti = new Set();

        turnoObj.segmenti.forEach(seg => {
            if (seg.ambulatorio) {
                ambulatoriPresenti.add(seg.ambulatorio);

                if (profilo.sedePrincipale === seg.ambulatorio) {
                    maxScore = Math.max(maxScore, 100);
                } else if (profilo.sediSecondarie && profilo.sediSecondarie.includes(seg.ambulatorio)) {
                    maxScore = Math.max(maxScore, 40);
                }
            }
        });

        breakdown.sede = maxScore;
        if (maxScore === 100) {
            motivazioni.push(`💯 Sede primaria in segmento`);
        } else if (maxScore === 40) {
            motivazioni.push(`👍 Sede secondaria in segmento`);
        }
    } else {
        // Turno singolo: usa ambulatorio parametro
        if (profilo.sedePrincipale === ambulatorio) {
            breakdown.sede = 100;
            motivazioni.push(`💯 Sede primaria (${ambulatorio})`);
        } else if (profilo.sediSecondarie && profilo.sediSecondarie.includes(ambulatorio)) {
            breakdown.sede = 40;
            motivazioni.push(`👍 Sede secondaria (${ambulatorio})`);
        }
    }
    // Altrimenti sede = 0 (sede non compatibile)

    // ========================================
    // 2️⃣ PREFERENZE TURNO
    // ========================================
    const turniEvitati = profilo.preferenze?.evitaTurni || [];
    if (turniEvitati.includes(codiceTurno)) {
        breakdown.preferenzeTurno = -20;
        motivazioni.push(`❌ Evita turno ${codiceTurno}`);
    }

    // TODO futuro: aggiungere turniPreferiti: +20
    // const turniPreferiti = profilo.preferenze?.turniPreferiti || [];
    // if (turniPreferiti.includes(codiceTurno)) {
    //     breakdown.preferenzeTurno = +20;
    //     motivazioni.push(`⭐ Preferisce turno ${codiceTurno}`);
    // }

    // ========================================
    // 3️⃣ BILANCIAMENTO ORE (moderato)
    // ========================================
    // Più ore hai fatto, meno punteggio ottieni
    // Formula: Math.max(0, 20 - oreSettimana)
    // 0h → +20, 10h → +10, 20h → +0, 30h → +0
    if (context.oreSettimana !== undefined) {
        breakdown.bilanciamento = Math.max(0, 20 - context.oreSettimana);
        if (context.oreSettimana > 0) {
            motivazioni.push(`⚖️ Ore settimana: ${context.oreSettimana}h`);
        }
    }

    // ========================================
    // 4️⃣ VINCOLI HARD (penalità se violati)
    // ========================================
    // Controlla vincolo maxOreSettimanali
    const maxOre = profilo.vincoli?.maxOreSettimanali;
    if (maxOre && context.oreSettimana !== undefined) {
        const minutiTurno = calcolaMinutiTurno(codiceTurno);
        const oreTurno = minutiTurno / 60;
        const nuovoTotale = context.oreSettimana + oreTurno;

        if (nuovoTotale > maxOre) {
            const eccesso = nuovoTotale - maxOre;
            breakdown.vincoliViolati = -50; // Penalità forte
            motivazioni.push(`⚠️ Supererebbe ore max (${nuovoTotale.toFixed(1)}/${maxOre}, +${eccesso.toFixed(1)}h)`);
        }
    }

    // Regole custom vincoli
    const regoleVincoli = profilo.vincoli?.regole || [];
    if (regoleVincoli.length > 0) {
        regoleVincoli.filter(r => r.attiva).forEach(regola => {
            const risultato = valutaRegolaCustom(regola, context);
            if (risultato) {
                if (risultato.gravita === 'warning') {
                    breakdown.vincoliViolati -= 30;
                    motivazioni.push("⚠️ " + risultato.messaggio);
                } else if (risultato.gravita === 'error') {
                    breakdown.vincoliViolati -= 60;
                    motivazioni.push("❌ " + risultato.messaggio);
                }
            }
        });
    }

    // ========================================
    // 5️⃣ VARIAZIONE RANDOM (evita pattern fissi)
    // ========================================
    breakdown.variazione = Math.random() * 2;

    // ========================================
    // 6️⃣ CALCOLA TOTALE
    // ========================================
    breakdown.totale =
        breakdown.sede +
        breakdown.preferenzeTurno +
        breakdown.bilanciamento +
        breakdown.variazione +
        breakdown.vincoliViolati;

    // ========================================
    // 7️⃣ CALCOLA CONFIDENZA (normalizza score in 0-1)
    // ========================================
    const confidenza = scoreToConfidenza(breakdown.totale);

    return {
        totale: breakdown.totale,
        breakdown,
        motivazioni,
        confidenza
    };
}

/**
 * Converte score in confidenza 0-1
 * Score positivi alti = confidenza alta
 * Score negativi = confidenza bassa
 *
 * SCALE v4:
 *   Max teorico: 100 + 20 + 20 + 2 = 142
 *   Min teorico: 0 - 20 - 60 (vincoli) = -80
 *
 * @param {number} score
 * @returns {number} - Confidenza 0-1
 */
function scoreToConfidenza(score) {
    // Punteggio massimo realistico: 142
    // Normalizziamo con range -100 → +150
    const maxScore = 150;

    // Se score negativo, confidenza proporzionalmente bassa
    if (score < 0) {
        // -100 → 0.0, -50 → 0.25, 0 → 0.5
        return Math.max(0, 0.5 + (score / 200));
    }

    // Se score positivo, scala verso 1.0
    // 0 → 0.5, 75 → 0.75, 150+ → 1.0
    return Math.min(1.0, 0.5 + (score / (maxScore * 2)));
}

/**
 * Filtra operatori che NON possono fare un turno
 * (vincoli hard che rendono impossibile l'assegnazione)
 *
 * @param {Object[]} profili - Array profili operatori
 * @param {number} giorno
 * @param {string} codiceTurno
 * @param {string} ambulatorio
 * @param {Object} context - Deve contenere { anno, mese }
 * @returns {Object[]} - Profili validi
 */
export function filtraOperatoriValidi(profili, giorno, codiceTurno, ambulatorio, context) {
    const { turni } = getState();

    return profili.filter(profilo => {
        // 1. Controlla se operatore ha un turno speciale (ferie, permesso, etc.)
        if (context.anno !== undefined && context.mese !== undefined) {
            const turnoAssegnato = caricaTurno(profilo.id, giorno, context.anno, context.mese);

            if (turnoAssegnato) {
                // Estrai codice turno (può essere "AMB_TURNO" o solo "TURNO")
                const codiceTurnoPuro = turnoAssegnato.includes('_')
                    ? turnoAssegnato.split('_').pop()
                    : turnoAssegnato;

                const defTurno = turni[codiceTurnoPuro];

                // Se il turno ha bloccaGenerazione: true, esclude l'operatore
                if (defTurno && defTurno.bloccaGenerazione) {
                    console.log(`[AUTO-SCORING] ❌ ${profilo.nome} ha ${defTurno.nome} il giorno ${giorno}`);
                    return false;
                }
            }
        }

        // 2. Altri vincoli hard futuri:
        // - blacklist turni assoluta
        // - vincoli di ruolo/competenze

        return true;
    });
}

/**
 * Ordina operatori per score decrescente
 *
 * @param {Object[]} profili
 * @param {Object[]} scores - Array di risultati da calcolaScoreOperatore
 * @returns {Object[]} - Array di { profilo, score, breakdown, motivazioni }
 */
export function ordinaPerScore(profili, scores) {
    const combined = profili.map((profilo, i) => ({
        profilo,
        ...scores[i]
    }));

    return combined.sort((a, b) => b.totale - a.totale);
}
