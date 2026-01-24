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
 * LIVELLO 3 - VALUTAZIONE (SCORE)
 * Calcola lo score di un operatore per un'assegnazione specifica
 *
 * FILOSOFIA:
 * - Valuta SOLO operatori ammissibili (già filtrati da L2)
 * - Score MAI usato per escludere
 * - Componenti: sede, preferenze, bilanciamento, random
 *
 * FORMULA v4:
 *   score = sede (100/40) + preferenze (±30) + bilanciamento (max 20) + random (0-2)
 *
 * GERARCHIA:
 *   1. SEDE (100/40) - domina sempre
 *   2. PREFERENZE (±30) - influenzano ma non sovrastano sede
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
        preferenzeTurno: 0,   // ±30 (preferiti/evitati)
        bilanciamento: 0,     // max +20 (inversamente proporzionale ore)
        variazione: 0,        // +0-2 (random)
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
    // 2️⃣ PREFERENZE TURNO (con livelli di probabilità)
    // ========================================
    // Livelli preferenza:
    // +2 = Molto preferito (+30 punti) → Alta probabilità di assegnazione
    // +1 = Preferito (+15 punti) → Probabilità aumentata
    //  0 = Neutro (0 punti) → Probabilità normale
    // -1 = Evitato (-15 punti) → Probabilità ridotta
    // -2 = Molto evitato (-30 punti) → Bassa probabilità di assegnazione

    const preferenzeTurni = profilo.preferenze?.preferenzeTurni || {};
    const livelloPreferenza = preferenzeTurni[codiceTurno] || 0;

    if (livelloPreferenza !== 0) {
        const peso = livelloPreferenza * 15; // -30, -15, +15, +30
        breakdown.preferenzeTurno = peso;

        if (livelloPreferenza === 2) {
            motivazioni.push(`⭐⭐ Molto preferito (+30)`);
        } else if (livelloPreferenza === 1) {
            motivazioni.push(`⭐ Preferito (+15)`);
        } else if (livelloPreferenza === -1) {
            motivazioni.push(`❌ Evitato (-15)`);
        } else if (livelloPreferenza === -2) {
            motivazioni.push(`❌❌ Molto evitato (-30)`);
        }
    }

    // Retrocompatibilità: se non esiste preferenzeTurni ma esiste evitaTurni legacy
    if (!preferenzeTurni[codiceTurno]) {
        const turniEvitati = profilo.preferenze?.evitaTurni || [];
        if (turniEvitati.includes(codiceTurno)) {
            breakdown.preferenzeTurno = -20;
            motivazioni.push(`❌ Evita turno (legacy)`);
        }
    }

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
    // 4️⃣ SOFT CONSTRAINTS (warning, non error)
    // ========================================
    // Regole custom con gravità 'warning' possono dare penalità SOFT
    // (le regole con 'error' sono già state filtrate in L2)
    const regoleVincoli = profilo.vincoli?.regole || [];
    if (regoleVincoli.length > 0) {
        regoleVincoli.filter(r => r.attiva).forEach(regola => {
            const risultato = valutaRegolaCustom(regola, context);
            if (risultato && risultato.gravita === 'warning') {
                // Warning riduce score ma non esclude
                breakdown.bilanciamento -= 10; // penalità leggera
                motivazioni.push("⚠️ " + risultato.messaggio);
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
        breakdown.variazione;

    // ========================================
    // 7️⃣ CLAMP SCORE [-100, +100]
    // ========================================
    // IGIENE MATEMATICA: mantiene score in range prevedibile
    // - Previene dominanza assoluta
    // - Rende confronti significativi
    // - Stabilizza sistema
    breakdown.totale = Math.max(-100, Math.min(100, breakdown.totale));

    // ========================================
    // 8️⃣ CALCOLA CONFIDENZA (normalizza score in 0-1)
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
 * SCALE v4.5 (post clamp):
 *   Range garantito: [-100, +100] (clamped)
 *   Mapping lineare: -100 → 0.0, 0 → 0.5, +100 → 1.0
 *
 * @param {number} score - Score già clamped in [-100, +100]
 * @returns {number} - Confidenza 0-1
 */
function scoreToConfidenza(score) {
    // Mapping lineare semplice:
    // -100 → 0.0
    //    0 → 0.5
    // +100 → 1.0
    // Formula: (score + 100) / 200
    return (score + 100) / 200;
}

/**
 * LIVELLO 2 - AMMISSIBILITÀ
 * Filtra operatori che NON possono fare un turno (vincoli HARD non negoziabili)
 *
 * FILOSOFIA v4.1 (FASE 1B):
 * - Se non passa qui, NON viene mai valutato
 * - ZERO compromessi: vincolo violato = esclusione
 * - MAI usare penalità invece di esclusione
 * - RUOLO è vincolo HARD: se richiesto INF, solo INF competono
 *
 * @param {Object[]} profili - Array profili operatori
 * @param {number} giorno
 * @param {string} codiceTurno
 * @param {string} ambulatorio
 * @param {Object} context - Deve contenere { anno, mese, bozza, ruoloRichiesto }
 * @returns {Object[]} - Profili ammissibili
 */
export function filtraOperatoriValidi(profili, giorno, codiceTurno, ambulatorio, context) {
    const { turni } = getState();
    const { anno, mese, bozza, ruoloRichiesto } = context;

    return profili.filter(profilo => {
        // ========================================
        // 1️⃣ VINCOLO: Ruolo richiesto
        // ========================================
        if (ruoloRichiesto !== null && ruoloRichiesto !== undefined) {
            // Normalizza ruolo profilo
            const ruoloProfilo = profilo.ruolo || "infermiere";  // default

            // Match esatto (case-insensitive per sicurezza)
            if (ruoloProfilo.toLowerCase() !== ruoloRichiesto.toLowerCase()) {
                console.log(`[L2-RUOLO] ❌ ${profilo.nome} escluso: ruolo ${ruoloProfilo.toUpperCase()}, richiesto ${ruoloRichiesto.toUpperCase()}`);
                return false;
            }
        }
        // Se ruoloRichiesto è null/undefined → ANY, tutti passano

        // ========================================
        // 2️⃣ VINCOLO: Turni bloccanti (ferie, permessi)
        // ========================================
        if (anno !== undefined && mese !== undefined) {
            const turnoAssegnato = caricaTurno(profilo.id, giorno, anno, mese);

            if (turnoAssegnato) {
                // Estrai codice turno (può essere "AMB_TURNO" o solo "TURNO")
                const codiceTurnoPuro = turnoAssegnato.includes('_')
                    ? turnoAssegnato.split('_').pop()
                    : turnoAssegnato;

                const defTurno = turni[codiceTurnoPuro];

                // Se il turno ha bloccaGenerazione: true, ESCLUDE l'operatore
                if (defTurno && defTurno.bloccaGenerazione) {
                    console.log(`[L2-VINCOLI] ❌ ${profilo.nome} escluso: ha ${defTurno.nome} il giorno ${giorno}`);
                    return false;
                }
            }
        }

        // ========================================
        // 3️⃣ VINCOLO: Max ore settimanali
        // ========================================
        const maxOre = profilo.vincoli?.maxOreSettimanali;
        if (maxOre && bozza) {
            // Calcola ore settimana includendo bozza
            const oreSettimana = calcolaOreSettimanaProfilo(profilo.id, giorno, mese, anno, bozza);
            const minutiTurno = calcolaMinutiTurno(codiceTurno);
            const oreTurno = minutiTurno / 60;
            const nuovoTotale = oreSettimana + oreTurno;

            if (nuovoTotale > maxOre) {
                const eccesso = (nuovoTotale - maxOre).toFixed(1);
                console.log(`[L2-VINCOLI] ❌ ${profilo.nome} escluso: supererebbe ore max (${nuovoTotale.toFixed(1)}/${maxOre}, +${eccesso}h)`);
                return false;
            }
        }

        // ========================================
        // 4️⃣ VINCOLO: Regole custom con gravità ERROR
        // ========================================
        const regoleVincoli = profilo.vincoli?.regole || [];
        if (regoleVincoli.length > 0 && bozza) {
            // Costruisci context minimale per valutazione regole
            const contextRegole = costruisciContextMinimale(profilo.id, giorno, mese, anno, codiceTurno, ambulatorio, bozza);

            for (const regola of regoleVincoli) {
                if (!regola.attiva) continue;

                const risultato = valutaRegolaCustom(regola, contextRegole);
                if (risultato && risultato.gravita === 'error') {
                    console.log(`[L2-VINCOLI] ❌ ${profilo.nome} escluso: ${risultato.messaggio}`);
                    return false;
                }
            }
        }

        // ========================================
        // ✅ AMMISSIBILE
        // ========================================
        return true;
    });
}

/**
 * Calcola ore settimana per un profilo (ultimi 7 giorni)
 * Include turni da localStorage + bozza
 *
 * @param {string} profiloId
 * @param {number} giorno
 * @param {number} mese
 * @param {number} anno
 * @param {Object} bozza
 * @returns {number} - Ore settimana
 */
function calcolaOreSettimanaProfilo(profiloId, giorno, mese, anno, bozza) {
    const turniOperatore = raccogliTurniOperatoreProfilo(profiloId, mese, anno, bozza);

    let minutiTotali = 0;
    const inizioSettimana = Math.max(1, giorno - 6);

    turniOperatore.forEach(t => {
        if (t.giorno >= inizioSettimana && t.giorno < giorno) {
            minutiTotali += calcolaMinutiTurno(t.codiceTurno);
        }
    });

    return minutiTotali / 60;
}

/**
 * Raccoglie turni operatore (localStorage + bozza)
 *
 * @param {string} operatoreId
 * @param {number} mese
 * @param {number} anno
 * @param {Object} bozza
 * @returns {Array} - Array di { giorno, codiceTurno }
 */
function raccogliTurniOperatoreProfilo(operatoreId, mese, anno, bozza) {
    const turniArray = [];
    const giorni = new Date(anno, mese + 1, 0).getDate();

    // 1. Turni da localStorage
    for (let g = 1; g <= giorni; g++) {
        const turnoSalvato = caricaTurno(operatoreId, g, anno, mese);
        if (turnoSalvato) {
            let codiceTurno = turnoSalvato;
            if (turnoSalvato.includes('_')) {
                const parts = turnoSalvato.split('_');
                codiceTurno = parts[parts.length - 1];
            }
            turniArray.push({ giorno: g, codiceTurno });
        }
    }

    // 2. Turni dalla bozza
    if (bozza && bozza.turni) {
        bozza.turni.forEach(t => {
            if (t.operatore === operatoreId) {
                turniArray.push({ giorno: t.giorno, codiceTurno: t.turno });
            }
        });
    }

    return turniArray;
}

/**
 * Costruisce context minimale per valutazione regole custom
 *
 * @param {string} profiloId
 * @param {number} giorno
 * @param {number} mese
 * @param {number} anno
 * @param {string} codiceTurno
 * @param {string} ambulatorio
 * @param {Object} bozza
 * @returns {Object} - Context minimale
 */
function costruisciContextMinimale(profiloId, giorno, mese, anno, codiceTurno, ambulatorio, bozza) {
    const { turni } = getState();
    const data = new Date(anno, mese, giorno);
    const turniOperatore = raccogliTurniOperatoreProfilo(profiloId, mese, anno, bozza);

    return {
        giorno,
        mese,
        anno,
        giornoSettimana: data.getDay(),
        turno: {
            codice: codiceTurno,
            ambulatorio: ambulatorio,
            ...(turni[codiceTurno] || {})
        },
        oreSettimana: calcolaOreSettimanaProfilo(profiloId, giorno, mese, anno, bozza),
        turniNelMese: turniOperatore.length
    };
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
