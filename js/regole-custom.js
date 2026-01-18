/**
 * regole-custom.js - Motore interpretazione regole personalizzate
 *
 * Interpreta regole data-driven (non hardcoded) create dall'utente.
 */

import { OPERATORI_REGOLA } from './profili.js';

/**
 * Valuta una singola regola personalizzata
 *
 * @param {Object} regola - Regola da valutare
 * @param {Object} context - Contesto completo assegnazione
 * @returns {Object|null} Risultato valutazione o null se non applicabile
 */
export function valutaRegolaCustom(regola, context) {
    // Regola disattivata
    if (!regola.attiva) return null;

    // Estrai valore dal context usando il campo della condizione
    const valoreReale = estraiValoreDaContext(regola.condizione.campo, context);

    // Valuta condizione
    const condizioneVerificata = valutaCondizione(
        valoreReale,
        regola.condizione.operatore,
        regola.condizione.valore
    );

    // Se condizione NON verificata, regola non scatta
    if (!condizioneVerificata) return null;

    // Regola scatta → ritorna risultato
    return {
        tipo: regola.tipo,
        gravita: regola.gravita,
        messaggio: regola.messaggio,
        regola: regola.id,
        campo: regola.condizione.campo,
        custom: true
    };
}

/**
 * Estrae valore dal context usando dot notation
 */
function estraiValoreDaContext(campo, context) {
    // Supporto dot notation: "turno.codice" → context.turno.codice
    const parti = campo.split('.');
    let valore = context;

    for (const parte of parti) {
        if (valore && typeof valore === 'object' && parte in valore) {
            valore = valore[parte];
        } else {
            return undefined;
        }
    }

    return valore;
}

/**
 * Valuta una condizione usando operatore
 */
function valutaCondizione(valoreReale, operatore, valoreAtteso) {
    // Valore reale non disponibile → condizione non verificabile
    if (valoreReale === undefined || valoreReale === null) {
        return false;
    }

    switch (operatore) {
        case 'equals':
            return valoreReale === valoreAtteso;

        case 'notEquals':
            return valoreReale !== valoreAtteso;

        case 'gt':
            return Number(valoreReale) > Number(valoreAtteso);

        case 'lt':
            return Number(valoreReale) < Number(valoreAtteso);

        case 'gte':
            return Number(valoreReale) >= Number(valoreAtteso);

        case 'lte':
            return Number(valoreReale) <= Number(valoreAtteso);

        case 'contains':
            if (Array.isArray(valoreReale)) {
                return valoreReale.includes(valoreAtteso);
            }
            if (typeof valoreReale === 'string') {
                return valoreReale.includes(valoreAtteso);
            }
            return false;

        case 'notContains':
            if (Array.isArray(valoreReale)) {
                return !valoreReale.includes(valoreAtteso);
            }
            if (typeof valoreReale === 'string') {
                return !valoreReale.includes(valoreAtteso);
            }
            return true;

        default:
            console.warn(`Operatore sconosciuto: ${operatore}`);
            return false;
    }
}

/**
 * Valuta tutte le regole custom di un operatore
 */
export function valutaRegoleCustom(operatore, context) {
    const risultati = [];

    // Valuta regole preferenze
    if (operatore.preferenze?.regole) {
        operatore.preferenze.regole.forEach(regola => {
            const risultato = valutaRegolaCustom(regola, context);
            if (risultato) risultati.push(risultato);
        });
    }

    // Valuta regole vincoli
    if (operatore.vincoli?.regole) {
        operatore.vincoli.regole.forEach(regola => {
            const risultato = valutaRegolaCustom(regola, context);
            if (risultato) risultati.push(risultato);
        });
    }

    return risultati;
}

/**
 * Costruisce context completo per valutazione regole
 */
export function costruisciContext(operatore, codiceTurno, giorno, anno, mese, turni, contextBase = {}) {
    // Recupera info turno
    const turno = turni[codiceTurno] || null;

    return {
        ...contextBase,
        turno: {
            codice: codiceTurno,
            tipo: turno?.tipo || null,
            nome: turno?.nome || null,
            orario: turno?.orario || null
        },
        operatore: {
            id: operatore.id,
            nome: operatore.nome,
            contratto: operatore.contratto
        },
        data: {
            giorno,
            mese,
            anno
        }
    };
}
