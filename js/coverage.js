/**
 * coverage.js - Logica verifica regole di copertura
 *
 * Questo modulo contiene SOLO la logica di verifica delle regole.
 * NON modifica turni, NON mostra popup, NON blocca l'utente.
 */

import { giorniNelMese } from './calendar.js';
import { caricaTurno, caricaBozzaGenerazione } from './storage.js';
import { operatori, turni, viewMode } from './state.js';
import { defaultCoverageRules } from './coverage.config.js';
import { getIdOperatore } from './profili.js';

/**
 * Restituisce il turno visibile per un operatore in un giorno specifico.
 * Se viewMode.mostraBozza è attivo, controlla prima la bozza, altrimenti usa i turni ufficiali.
 *
 * @param {Object|string} operatore - Operatore (profilo o stringa)
 * @param {number} giorno - Giorno del mese (1-31)
 * @param {number} anno - Anno
 * @param {number} mese - Mese (0-11)
 * @returns {string|null} - Codice turno o null
 */
function getTurnoVisibile(operatore, giorno, anno, mese) {
    // Turno ufficiale da localStorage
    const turnoUfficiale = caricaTurno(operatore, giorno, anno, mese);

    // Se non stiamo mostrando la bozza, ritorna solo il turno ufficiale
    if (!viewMode.mostraBozza) {
        return turnoUfficiale;
    }

    // Carica la bozza
    const bozza = caricaBozzaGenerazione();
    if (!bozza || bozza.stato !== 'draft') {
        return turnoUfficiale;
    }

    // Verifica se la bozza è per questo periodo
    if (bozza.periodo.anno !== anno || bozza.periodo.mese !== mese) {
        return turnoUfficiale;
    }

    // Cerca turno nella bozza per questo operatore e giorno
    const opId = getIdOperatore(operatore);
    const turnoBozza = bozza.turni.find(t =>
        t.giorno === giorno && t.operatore === opId
    );

    // Se esiste nella bozza, usa quello (con priorità su turno ufficiale)
    if (turnoBozza) {
        // Costruisce il codice turno nel formato "AMBULATORIO_TURNO" usato da localStorage
        return `${turnoBozza.ambulatorio}_${turnoBozza.turno}`;
    }

    // Altrimenti usa il turno ufficiale
    return turnoUfficiale;
}

/**
 * Verifica se una regola si applica a un giorno specifico
 */
export function regolaApplicaAGiorno(regola, giorno, mese, anno) {
    if (!regola.attiva) return false;

    const quando = regola.quando;

    switch (quando.tipo) {
        case "giorno_specifico":
            return giorno === quando.giorno && mese === quando.mese;

        case "giorno_settimana": {
            const data = new Date(anno, mese, giorno);
            let dayOfWeek = data.getDay();
            // Converti: Dom=0 → 6, Lun=1 → 0, ecc.
            dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            return dayOfWeek === quando.giornoSettimana;
        }

        case "intervallo_date": {
            const dataCorrente = new Date(anno, mese, giorno);
            const dataInizio = new Date(quando.da);
            const dataFine = new Date(quando.a);
            return dataCorrente >= dataInizio && dataCorrente <= dataFine;
        }

        default:
            return false;
    }
}

/**
 * Verifica se i turni richiesti da una regola sono soddisfatti per un giorno
 */
export function verificaTurniRichiesti(regola, giorno, anno, mese) {
    const mancanti = [];

    regola.richiesti.forEach(requisito => {
        let count = 0;

        // Conta quanti operatori hanno quel turno in quel giorno
        // Usa getTurnoVisibile invece di caricaTurno per considerare anche la bozza
        operatori.forEach(op => {
            const turnoAssegnato = getTurnoVisibile(op, giorno, anno, mese);
            if (!turnoAssegnato) return;

            // Estrai il codice turno puro (rimuovi prefisso ambulatorio se presente)
            // Formato può essere "BUD_BM" o solo "BM"
            const codiceTurnoPuro = turnoAssegnato.includes('_')
                ? turnoAssegnato.split('_')[1]  // "BUD_BM" → "BM"
                : turnoAssegnato;                // "BM" → "BM"

            if (codiceTurnoPuro === requisito.turno) {
                // Verifica anche che sia dell'ambulatorio giusto
                const turnoObj = turni[codiceTurnoPuro] || turni[turnoAssegnato];
                if (turnoObj && turnoObj.ambulatorio === requisito.ambulatorio) {
                    count++;
                }
            }
        });

        if (count < requisito.quantita) {
            mancanti.push({
                ambulatorio: requisito.ambulatorio,
                turno: requisito.turno,
                richiesti: requisito.quantita,
                presenti: count
            });
        }
    });

    return mancanti;
}

/**
 * Verifica tutte le regole per un giorno specifico
 */
export function verificaGiorno(giorno, mese, anno, regole) {
    const avvisi = [];

    regole.forEach(regola => {
        if (regolaApplicaAGiorno(regola, giorno, mese, anno)) {
            const mancanti = verificaTurniRichiesti(regola, giorno, anno, mese);

            if (mancanti.length > 0) {
                avvisi.push({
                    regolaId: regola.id,
                    descrizione: regola.descrizione,
                    severita: regola.severita,
                    giorno,
                    mese,
                    anno,
                    mancanti
                });
            }
        }
    });

    return avvisi;
}

/**
 * Verifica tutte le regole per un intero mese
 */
export function verificaMese(anno, mese, regole) {
    const tuttiAvvisi = [];
    const giorni = giorniNelMese(anno, mese);

    for (let g = 1; g <= giorni; g++) {
        const avvisiGiorno = verificaGiorno(g, mese, anno, regole);
        tuttiAvvisi.push(...avvisiGiorno);
    }

    return tuttiAvvisi;
}

/**
 * Conta avvisi per severità
 */
export function contaAvvisi(avvisi) {
    return {
        info: avvisi.filter(a => a.severita === "info").length,
        warning: avvisi.filter(a => a.severita === "warning").length,
        totale: avvisi.length
    };
}

/**
 * Carica regole da localStorage (o default se non esistono)
 */
export function caricaRegole() {
    const salvate = localStorage.getItem("coverageRules");
    if (salvate) {
        try {
            return JSON.parse(salvate);
        } catch (e) {
            console.warn("Errore parsing regole, uso default:", e);
            return [...defaultCoverageRules];
        }
    }
    return [...defaultCoverageRules];
}

/**
 * Salva regole in localStorage
 */
export function salvaRegole(regole) {
    localStorage.setItem("coverageRules", JSON.stringify(regole));
}

/**
 * Crea una nuova regola vuota
 */
export function nuovaRegolaVuota() {
    return {
        id: `regola_${Date.now()}`,
        descrizione: "",
        quando: {
            tipo: "giorno_specifico",
            giorno: 1,
            mese: 0
        },
        richiesti: [],
        severita: "info",
        attiva: true
    };
}

/**
 * Valida una regola
 */
export function validaRegola(regola) {
    const errori = [];

    if (!regola.id || regola.id.trim() === "") {
        errori.push("ID regola mancante");
    }

    if (!regola.descrizione || regola.descrizione.trim() === "") {
        errori.push("Descrizione mancante");
    }

    if (!regola.quando || !regola.quando.tipo) {
        errori.push("Tipo condizione mancante");
    }

    if (!regola.richiesti || regola.richiesti.length === 0) {
        errori.push("Nessun turno richiesto specificato");
    }

    if (!["info", "warning"].includes(regola.severita)) {
        errori.push("Severità non valida");
    }

    return errori;
}

/**
 * Resetta alle regole di default
 */
export function resetRegolaDefault() {
    salvaRegole([...defaultCoverageRules]);
    return [...defaultCoverageRules];
}
