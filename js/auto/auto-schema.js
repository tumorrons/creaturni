/**
 * auto-schema.js
 * Schema dati per la generazione automatica turni
 *
 * Filosofia:
 * - Bozze NON distruttive (mai sovrascrivere turni esistenti senza conferma)
 * - Trasparenza totale (ogni decisione ha motivazioni esplicite)
 * - Scoring deterministico (niente "magia", tutto spiegabile)
 */

/**
 * Schema per un singolo turno generato
 *
 * @typedef {Object} TurnoGenerato
 * @property {number} giorno - Giorno del mese (1-31)
 * @property {string} turno - Codice turno (es. "BM", "SP", "FN")
 * @property {string} ambulatorio - ID ambulatorio
 * @property {string} operatore - ID operatore assegnato
 * @property {string} origine - Sempre "auto" per turni generati automaticamente
 * @property {number} confidenza - Punteggio 0-1 (quanto siamo sicuri dell'assegnazione)
 * @property {string[]} motivazioni - Array di spiegazioni leggibili per l'utente
 * @property {Object} scoreBreakdown - Dettaglio punteggio per debugging
 * @property {number} scoreBreakdown.base - Punteggio base disponibilità
 * @property {number} scoreBreakdown.sedePrincipale - Bonus sede principale (+10)
 * @property {number} scoreBreakdown.sedePreferita - Bonus sede preferita (+5)
 * @property {number} scoreBreakdown.turnoEvitato - Penalità turno evitato (-10)
 * @property {number} scoreBreakdown.oreSettimanali - Penalità ore settimanali (-20 se supera)
 * @property {number} scoreBreakdown.preferenzeCustom - Bonus/penalità da regole custom
 * @property {number} scoreBreakdown.vincoliCustom - Penalità vincoli custom
 * @property {number} scoreBreakdown.totale - Somma finale
 */

/**
 * Schema completo bozza di generazione
 *
 * @typedef {Object} GeneratedDraft
 * @property {Object} periodo - Periodo di riferimento per la generazione
 * @property {number} periodo.mese - Mese (0-11, formato JavaScript Date)
 * @property {number} periodo.anno - Anno (es. 2026)
 * @property {TurnoGenerato[]} turni - Array di turni generati (può essere vuoto se nessuna assegnazione possibile)
 * @property {Object} metadata - Metadati sulla generazione
 * @property {number} metadata.timestamp - Quando è stata creata la bozza (Date.now())
 * @property {Object} metadata.parametri - Parametri usati per la generazione
 * @property {boolean} metadata.parametri.soloGiorniVuoti - Se true, genera solo dove non ci sono turni
 * @property {boolean} metadata.parametri.rigeneraTutto - Se true, sostituisce tutto (richiede conferma)
 * @property {string|null} metadata.parametri.ambulatorioFiltro - Se specificato, genera solo per questo ambulatorio
 * @property {boolean} metadata.parametri.usaCopertura - Rispetta regole di copertura
 * @property {boolean} metadata.parametri.usaVincoli - Rispetta vincoli operatore
 * @property {boolean} metadata.parametri.usaPreferenze - Rispetta preferenze operatore
 * @property {Object} metadata.statistiche - Statistiche sulla generazione
 * @property {number} metadata.statistiche.turniGenerati - Numero turni generati
 * @property {number} metadata.statistiche.slotVuoti - Slot rimasti vuoti (non trovato operatore)
 * @property {number} metadata.statistiche.conflittiRisolti - Conflitti risolti tramite scoring
 * @property {string} stato - Stato della bozza: "draft" | "applied" | "discarded"
 */

/**
 * Crea una nuova bozza vuota
 *
 * @param {number} mese - Mese (0-11)
 * @param {number} anno - Anno
 * @param {Object} parametri - Parametri di generazione
 * @returns {GeneratedDraft}
 */
export function nuovaBozza(mese, anno, parametri = {}) {
    return {
        periodo: { mese, anno },
        turni: [],
        metadata: {
            timestamp: Date.now(),
            parametri: {
                soloGiorniVuoti: parametri.soloGiorniVuoti ?? true,
                rigeneraTutto: parametri.rigeneraTutto ?? false,
                ambulatorioFiltro: parametri.ambulatorioFiltro ?? null,
                usaCopertura: parametri.usaCopertura ?? true,
                usaVincoli: parametri.usaVincoli ?? true,
                usaPreferenze: parametri.usaPreferenze ?? true
            },
            statistiche: {
                turniGenerati: 0,
                slotVuoti: 0,
                conflittiRisolti: 0
            }
        },
        stato: "draft"
    };
}

/**
 * Crea un nuovo turno generato
 *
 * @param {number} giorno - Giorno del mese
 * @param {string} turno - Codice turno
 * @param {string} ambulatorio - ID ambulatorio
 * @param {string} operatore - ID operatore
 * @param {number} confidenza - Score 0-1
 * @param {string[]} motivazioni - Spiegazioni
 * @param {Object} scoreBreakdown - Dettaglio punteggio
 * @returns {TurnoGenerato}
 */
export function nuovoTurnoGenerato(giorno, turno, ambulatorio, operatore, confidenza, motivazioni, scoreBreakdown) {
    return {
        giorno,
        turno,
        ambulatorio,
        operatore,
        origine: "auto",
        confidenza,
        motivazioni,
        scoreBreakdown
    };
}

/**
 * Valida che una bozza sia ben formata
 *
 * @param {GeneratedDraft} bozza
 * @returns {string[]} - Array di errori (vuoto se tutto ok)
 */
export function validaBozza(bozza) {
    const errori = [];

    if (!bozza.periodo || typeof bozza.periodo.mese !== "number" || typeof bozza.periodo.anno !== "number") {
        errori.push("Periodo non valido");
    }

    if (!Array.isArray(bozza.turni)) {
        errori.push("Turni deve essere un array");
    }

    if (!bozza.metadata || !bozza.metadata.timestamp) {
        errori.push("Metadata mancante");
    }

    if (!["draft", "applied", "discarded"].includes(bozza.stato)) {
        errori.push("Stato non valido: " + bozza.stato);
    }

    return errori;
}

/**
 * Converte confidenza numerica in label leggibile
 *
 * @param {number} confidenza - Score 0-1
 * @returns {string} - "Alta" | "Media" | "Bassa"
 */
export function confidenzaToLabel(confidenza) {
    if (confidenza >= 0.75) return "Alta";
    if (confidenza >= 0.5) return "Media";
    return "Bassa";
}

/**
 * Converte score numerico in confidenza 0-1
 * I punteggi possono essere negativi (vincoli violati),
 * li normalizziamo in range 0-1
 *
 * @param {number} score - Punteggio totale (può essere negativo)
 * @param {number} maxScore - Punteggio massimo teorico (default 50)
 * @returns {number} - Confidenza normalizzata 0-1
 */
export function scoreToConfidenza(score, maxScore = 50) {
    // Se score negativo = confidenza molto bassa
    if (score < 0) return Math.max(0, 0.3 + (score / 100));

    // Altrimenti normalizza in 0-1
    return Math.min(1, score / maxScore);
}
