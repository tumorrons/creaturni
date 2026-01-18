/**
 * regole.js - Sistema regole personalizzabili operatori
 *
 * Motore che valuta preferenze (soft) e vincoli (hard) per ogni operatore.
 * NON blocca mai l'assegnazione - produce solo warning/info.
 */

import { getIdOperatore, getNomeOperatore } from './profili.js';
import { valutaRegoleCustom, costruisciContext } from './regole-custom.js';

/**
 * Gravità delle regole
 */
export const GRAVITA = {
    INFO: 'info',           // Suggerimento (blu)
    WARNING: 'warning',     // Attenzione (arancione)
    ERROR: 'error'          // Sconsigliato fortemente (rosso)
};

/**
 * Tipi di regole
 */
export const TIPO_REGOLA = {
    PREFERENZA: 'preferenza',  // Soft rule - migliora esperienza
    VINCOLO: 'vincolo'         // Hard rule - limite operativo forte
};

/**
 * Valuta se un operatore può/dovrebbe avere un turno in un giorno
 *
 * @param {Object} operatore - Profilo operatore (o stringa legacy)
 * @param {String} codiceTurno - Codice turno (es. "BM", "NOTTE")
 * @param {Number} giorno - Giorno del mese
 * @param {Number} anno - Anno
 * @param {Number} mese - Mese (0-11)
 * @param {Object} context - Contesto aggiuntivo (turni precedenti, ore settimana, etc.)
 * @param {Object} turni - Dizionario turni disponibili (per regole custom)
 * @returns {Array} Array di warning/info { tipo, gravita, messaggio, regola }
 */
export function valutaAssegnazione(operatore, codiceTurno, giorno, anno, mese, context = {}, turni = {}) {
    const risultati = [];

    // Se è una stringa legacy, nessuna regola da applicare
    if (typeof operatore === 'string') {
        return risultati;
    }

    // 1. VINCOLI (hard rules)
    if (operatore.vincoli) {
        // Vincolo: evita turni specifici
        if (operatore.vincoli.evitaTurni?.includes(codiceTurno)) {
            risultati.push({
                tipo: TIPO_REGOLA.VINCOLO,
                gravita: GRAVITA.ERROR,
                messaggio: `${getNomeOperatore(operatore)} ha un vincolo: evita turno ${codiceTurno}`,
                regola: 'evitaTurni',
                campo: 'vincoli.evitaTurni'
            });
        }

        // Vincolo: max ore settimanali
        if (operatore.vincoli.maxOreSettimanali && context.oreSettimanaCorrente) {
            const oreTurno = context.oreTurno || 0;
            const totale = context.oreSettimanaCorrente + oreTurno;
            if (totale > operatore.vincoli.maxOreSettimanali) {
                risultati.push({
                    tipo: TIPO_REGOLA.VINCOLO,
                    gravita: GRAVITA.ERROR,
                    messaggio: `${getNomeOperatore(operatore)} supererebbe max ore settimanali (${totale}h > ${operatore.vincoli.maxOreSettimanali}h)`,
                    regola: 'maxOreSettimanali',
                    campo: 'vincoli.maxOreSettimanali'
                });
            }
        }

        // Vincolo: max giorni consecutivi
        if (operatore.vincoli.maxGiorniConsecutivi && context.giorniConsecutivi) {
            if (context.giorniConsecutivi >= operatore.vincoli.maxGiorniConsecutivi) {
                risultati.push({
                    tipo: TIPO_REGOLA.VINCOLO,
                    gravita: GRAVITA.WARNING,
                    messaggio: `${getNomeOperatore(operatore)} ha già ${context.giorniConsecutivi} giorni consecutivi (max: ${operatore.vincoli.maxGiorniConsecutivi})`,
                    regola: 'maxGiorniConsecutivi',
                    campo: 'vincoli.maxGiorniConsecutivi'
                });
            }
        }

        // Vincolo: min riposo ore (tra turni)
        if (operatore.vincoli.minRiposoOre && context.oreUltimoTurno) {
            const oraFineUltimoTurno = context.oraFineUltimoTurno || 0;
            const oraInizioNuovoTurno = context.oraInizioNuovoTurno || 0;
            const oreRiposo = oraInizioNuovoTurno - oraFineUltimoTurno;

            if (oreRiposo < operatore.vincoli.minRiposoOre) {
                risultati.push({
                    tipo: TIPO_REGOLA.VINCOLO,
                    gravita: GRAVITA.ERROR,
                    messaggio: `${getNomeOperatore(operatore)} ha solo ${oreRiposo}h di riposo (min: ${operatore.vincoli.minRiposoOre}h)`,
                    regola: 'minRiposoOre',
                    campo: 'vincoli.minRiposoOre'
                });
            }
        }
    }

    // 2. PREFERENZE (soft rules)
    if (operatore.preferenze) {
        // Preferenza: evita turni specifici
        if (operatore.preferenze.evitaTurni?.includes(codiceTurno)) {
            risultati.push({
                tipo: TIPO_REGOLA.PREFERENZA,
                gravita: GRAVITA.WARNING,
                messaggio: `${getNomeOperatore(operatore)} preferisce evitare turno ${codiceTurno}`,
                regola: 'evitaTurni',
                campo: 'preferenze.evitaTurni'
            });
        }

        // Preferenza: giorni da evitare
        if (operatore.preferenze.giorniDaEvitare?.length > 0 && context.giornoSettimana) {
            if (operatore.preferenze.giorniDaEvitare.includes(context.giornoSettimana)) {
                risultati.push({
                    tipo: TIPO_REGOLA.PREFERENZA,
                    gravita: GRAVITA.INFO,
                    messaggio: `${getNomeOperatore(operatore)} preferisce evitare turni il ${context.giornoSettimana}`,
                    regola: 'giorniDaEvitare',
                    campo: 'preferenze.giorniDaEvitare'
                });
            }
        }

        // Preferenza: giorni preferiti (info positivo se rispettato)
        if (operatore.preferenze.giorniPreferiti?.length > 0 && context.giornoSettimana) {
            if (operatore.preferenze.giorniPreferiti.includes(context.giornoSettimana)) {
                risultati.push({
                    tipo: TIPO_REGOLA.PREFERENZA,
                    gravita: GRAVITA.INFO,
                    messaggio: `✓ ${getNomeOperatore(operatore)} preferisce lavorare il ${context.giornoSettimana}`,
                    regola: 'giorniPreferiti',
                    campo: 'preferenze.giorniPreferiti',
                    positivo: true
                });
            }
        }

        // Preferenza: evita sede
        if (operatore.preferenze.evitaSede && context.sedeTurno) {
            if (context.sedeTurno === operatore.preferenze.evitaSede) {
                risultati.push({
                    tipo: TIPO_REGOLA.PREFERENZA,
                    gravita: GRAVITA.INFO,
                    messaggio: `${getNomeOperatore(operatore)} preferisce evitare sede ${operatore.preferenze.evitaSede}`,
                    regola: 'evitaSede',
                    campo: 'preferenze.evitaSede'
                });
            }
        }

        // Preferenza: sede preferita (info positivo se rispettato)
        if (operatore.preferenze.sedePreferita && context.sedeTurno) {
            if (context.sedeTurno === operatore.preferenze.sedePreferita) {
                risultati.push({
                    tipo: TIPO_REGOLA.PREFERENZA,
                    gravita: GRAVITA.INFO,
                    messaggio: `✓ ${getNomeOperatore(operatore)} lavora nella sua sede preferita (${operatore.preferenze.sedePreferita})`,
                    regola: 'sedePreferita',
                    campo: 'preferenze.sedePreferita',
                    positivo: true
                });
            }
        }
    }

    // 3. CONTRATTO (limiti strutturali)
    if (operatore.contratto) {
        // Contratto part-time: warning se supera ore contrattuali
        if (operatore.contratto.tipo === 'part-time' && context.oreSettimanaCorrente) {
            const oreTurno = context.oreTurno || 0;
            const totale = context.oreSettimanaCorrente + oreTurno;
            const oreContratto = operatore.contratto.oreSettimanali || 20;

            if (totale > oreContratto) {
                risultati.push({
                    tipo: TIPO_REGOLA.VINCOLO,
                    gravita: GRAVITA.WARNING,
                    messaggio: `${getNomeOperatore(operatore)} (part-time ${oreContratto}h/sett) supererebbe ore contrattuali (${totale}h)`,
                    regola: 'oreContrattuali',
                    campo: 'contratto.oreSettimanali'
                });
            }
        }
    }

    // 4. SEDI (vincoli geografici)
    if (operatore.sedePrincipale && context.sedeTurno) {
        // Info se lavora nella sede principale
        if (context.sedeTurno === operatore.sedePrincipale) {
            risultati.push({
                tipo: TIPO_REGOLA.PREFERENZA,
                gravita: GRAVITA.INFO,
                messaggio: `✓ ${getNomeOperatore(operatore)} lavora nella sua sede principale (${operatore.sedePrincipale})`,
                regola: 'sedePrincipale',
                campo: 'sedePrincipale',
                positivo: true
            });
        }
    }

    // 5. REGOLE PERSONALIZZATE (data-driven)
    const contextCompleto = costruisciContext(operatore, codiceTurno, giorno, anno, mese, turni, context);
    const risultatiCustom = valutaRegoleCustom(operatore, contextCompleto);
    risultati.push(...risultatiCustom);

    return risultati;
}

/**
 * Filtra solo i warning (esclude info positivi)
 */
export function filtraWarning(risultati) {
    return risultati.filter(r => !r.positivo);
}

/**
 * Filtra solo errori critici (vincoli hard)
 */
export function filtraErrori(risultati) {
    return risultati.filter(r => r.gravita === GRAVITA.ERROR);
}

/**
 * Raggruppa risultati per gravità
 */
export function raggruppaPerGravita(risultati) {
    return {
        errori: risultati.filter(r => r.gravita === GRAVITA.ERROR),
        warning: risultati.filter(r => r.gravita === GRAVITA.WARNING),
        info: risultati.filter(r => r.gravita === GRAVITA.INFO && !r.positivo),
        positivi: risultati.filter(r => r.positivo)
    };
}

/**
 * Genera tooltip HTML per mostrare i warning
 */
export function generaTooltipRegole(risultati) {
    if (risultati.length === 0) return "";

    const lines = risultati.map(r => {
        const icon = r.gravita === GRAVITA.ERROR ? '🔴' :
                     r.gravita === GRAVITA.WARNING ? '⚠️' : 'ℹ️';
        return `${icon} ${r.messaggio}`;
    });

    return lines.join('\n');
}

/**
 * Calcola punteggio assegnazione (per suggerimenti AI futuri)
 * Più alto = meglio
 */
export function calcolaPunteggioAssegnazione(risultati) {
    let punteggio = 100;

    risultati.forEach(r => {
        if (r.gravita === GRAVITA.ERROR) punteggio -= 50;
        if (r.gravita === GRAVITA.WARNING) punteggio -= 20;
        if (r.gravita === GRAVITA.INFO && !r.positivo) punteggio -= 5;
        if (r.positivo) punteggio += 10;
    });

    return Math.max(0, punteggio);
}
