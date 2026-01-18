/**
 * auto-scoring.js
 * Motore di scoring per la generazione automatica
 *
 * Filosofia:
 * - Deterministico: stessi input = stesso output
 * - Trasparente: ogni punto ha una motivazione
 * - Componibile: score = somma di componenti indipendenti
 */

import { valutaRegolaCustom } from '../regole-custom.js';
import { getState } from '../state.js';
import { caricaTurno } from '../storage.js';

console.log('📊 [AUTO-SCORING] Modulo caricato correttamente');

/**
 * Calcola lo score di un operatore per un'assegnazione specifica
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
        base: 0,
        sedePrincipale: 0,
        sedePreferita: 0,
        turnoEvitato: 0,
        oreSettimanali: 0,
        bilanciamentoOre: 0,  // Favorisce distribuzione equa
        preferenzeCustom: 0,
        vincoliCustom: 0,
        totale: 0
    };

    const motivazioni = [];

    // 1. BASE: Disponibilità (tutti partono da 0, ma essere disponibile = +0)
    breakdown.base = 0;

    // 2. SEDE PRINCIPALE (forte bonus)
    if (profilo.sedePrincipale === ambulatorio) {
        breakdown.sedePrincipale = 10;
        motivazioni.push(`Sede principale (${ambulatorio})`);
    }

    // 3. SEDE PREFERITA (bonus medio)
    if (profilo.preferenze?.sedePreferita === ambulatorio) {
        breakdown.sedePreferita = 5;
        motivazioni.push("Sede preferita");
    }

    // 4. TURNO EVITATO (penalità media)
    const turniEvitati = profilo.preferenze?.evitaTurni || [];
    if (turniEvitati.includes(codiceTurno)) {
        breakdown.turnoEvitato = -10;
        motivazioni.push(`Evita turno ${codiceTurno}`);
    }

    // 5. ORE SETTIMANALI (penalità forte se supera)
    const maxOre = profilo.vincoli?.maxOreSettimanali;
    if (maxOre && context.oreSettimana !== undefined) {
        const { turni } = getState();
        const oreTurno = calcolaOreTurno(codiceTurno, turni);
        const nuovoTotale = context.oreSettimana + oreTurno;

        if (nuovoTotale > maxOre) {
            const eccesso = nuovoTotale - maxOre;
            breakdown.oreSettimanali = -20;
            motivazioni.push(`Supererebbe ore settimanali (${nuovoTotale}/${maxOre}, +${eccesso}h)`);
        }
    }

    // 5b. BILANCIAMENTO ORE (favorisce distribuzione equa)
    // Penalità progressiva proporzionale alle ore già accumulate
    // Chi ha meno ore ha punteggio migliore → distribuzione equa
    if (context.oreSettimana !== undefined && context.oreSettimana > 0) {
        // Penalità: -1 punto ogni 3.5 ore accumulate
        // Es: 7h → -2, 14h → -4, 21h → -6, 28h → -8, 35h → -10
        breakdown.bilanciamentoOre = -Math.floor(context.oreSettimana / 3.5);
        motivazioni.push(`Ore settimana: ${context.oreSettimana}h`);
    }

    // 6. REGOLE CUSTOM PREFERENZE (bonus variabile)
    const regolePreferenze = profilo.preferenze?.regole || [];
    if (regolePreferenze.length > 0) {
        regolePreferenze.filter(r => r.attiva).forEach(regola => {
            const risultato = valutaRegolaCustom(regola, context);
            if (risultato && risultato.gravita === 'info') {
                breakdown.preferenzeCustom += 3; // Bonus piccolo per preferenze rispettate
                motivazioni.push(risultato.messaggio);
            }
        });
    }

    // 7. REGOLE CUSTOM VINCOLI (penalità variabile)
    const regoleVincoli = profilo.vincoli?.regole || [];
    if (regoleVincoli.length > 0) {
        regoleVincoli.filter(r => r.attiva).forEach(regola => {
            const risultato = valutaRegolaCustom(regola, context);
            if (risultato) {
                if (risultato.gravita === 'warning') {
                    breakdown.vincoliCustom -= 15; // Penalità media per vincoli violati
                    motivazioni.push("⚠️ " + risultato.messaggio);
                } else if (risultato.gravita === 'error') {
                    breakdown.vincoliCustom -= 30; // Penalità forte per vincoli critici
                    motivazioni.push("❌ " + risultato.messaggio);
                }
            }
        });
    }

    // 8. CALCOLA TOTALE
    breakdown.totale =
        breakdown.base +
        breakdown.sedePrincipale +
        breakdown.sedePreferita +
        breakdown.turnoEvitato +
        breakdown.oreSettimanali +
        breakdown.bilanciamentoOre +
        breakdown.preferenzeCustom +
        breakdown.vincoliCustom;

    // 9. CALCOLA CONFIDENZA (normalizza score in 0-1)
    const confidenza = scoreToConfidenza(breakdown.totale);

    return {
        totale: breakdown.totale,
        breakdown,
        motivazioni,
        confidenza
    };
}

/**
 * Calcola ore di un turno dalle definizioni
 *
 * @param {string} codiceTurno
 * @param {Object} turni - Dizionario turni da state
 * @returns {number} - Ore (default 8 se orario non parsabile)
 */
function calcolaOreTurno(codiceTurno, turni) {
    const turno = turni[codiceTurno];
    if (!turno || !turno.orario) return 8; // Default 8 ore

    // Parsing orario tipo "07:00 – 14:00"
    const match = turno.orario.match(/(\d{2}):(\d{2})\s*[–-]\s*(\d{2}):(\d{2})/);
    if (!match) return 8;

    const [, h1, m1, h2, m2] = match;
    const inizio = parseInt(h1) + parseInt(m1) / 60;
    const fine = parseInt(h2) + parseInt(m2) / 60;

    return fine - inizio;
}

/**
 * Converte score in confidenza 0-1
 * Score positivi alti = confidenza alta
 * Score negativi = confidenza bassa
 *
 * @param {number} score
 * @returns {number} - Confidenza 0-1
 */
function scoreToConfidenza(score) {
    // Punteggio massimo teorico: +10 (sede principale) +5 (sede pref) +10 (custom pref) = ~25
    // Normalizziamo con un max di 30 per dare margine
    const maxScore = 30;

    // Se score negativo, confidenza proporzionalmente bassa
    if (score < 0) {
        // -50 → 0.0, -25 → 0.25, 0 → 0.5
        return Math.max(0, 0.5 + (score / 100));
    }

    // Se score positivo, scala verso 1.0
    // 0 → 0.5, 15 → 0.75, 30+ → 1.0
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
