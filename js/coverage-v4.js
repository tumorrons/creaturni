/**
 * coverage-v4.js - Sistema di regole v4.0
 *
 * FILOSOFIA v4:
 * - NON esistono più x2, x3, etc.
 * - Ogni slot è una REGOLA SEPARATA con priorità
 * - Vincoli HARD (esclusioni) separati da priorità SOFT (scoring)
 *
 * Esempio:
 *   Invece di: { turno: "BU-M", quantita: 2 }
 *   Abbiamo:   [ { turno: "BU-M", priorita: 100 },
 *                { turno: "BU-M", priorita: 90 } ]
 */

import { regolaApplicaAGiorno } from './coverage.js';
import { giorniNelMese } from './calendar.js';
import { caricaTurno } from './storage.js';

/**
 * Schema regola v4 (slot singolo)
 *
 * @typedef {Object} RegolaV4
 * @property {string} id - ID univoco regola
 * @property {string} descrizione - Descrizione testuale
 * @property {string} codiceTurno - Codice turno (es. "BU-M")
 * @property {string} ambulatorio - Sede (es. "BUD")
 * @property {number} priorita - Priorità (100 = massima, 0 = normale, negativa = bassa)
 * @property {boolean} obbligatoria - Se false, genera solo warning
 * @property {Object} quando - Condizione temporale (stesso formato v3)
 * @property {boolean} attiva - Regola attiva/disattiva
 * @property {number|null} limiteAssegnazioniMensili - Max assegnazioni mensili per operatore (null = nessun limite)
 * @property {string} tipoRegola - Tipo: "normale", "filler" (usa per riempire ore), "last_resort" (copri per ultimo)
 */

/**
 * Espande regole v3 (con quantità) in regole v4 (slot multipli con priorità)
 *
 * Logica priorità:
 * - Primo slot: priorita base (default 100)
 * - Secondo slot: priorita base - 10
 * - Terzo slot: priorita base - 20
 * - etc.
 *
 * @param {Object[]} regoleV3 - Regole in formato v3
 * @param {number} prioritaBase - Priorità base per primo slot (default 100)
 * @returns {RegolaV4[]} - Array regole v4 espanse
 */
export function espandiRegoleV3inV4(regoleV3, prioritaBase = 100) {
    const regoleV4 = [];
    let contatore = 0;

    regoleV3.forEach(regolaV3 => {
        if (!regolaV3.attiva) return;

        // Per ogni requisito nella regola v3
        regolaV3.richiesti.forEach((requisito, reqIndex) => {
            const { ambulatorio, turno, quantita } = requisito;

            // Crea N regole v4 separate (una per ogni slot richiesto)
            for (let slot = 0; slot < quantita; slot++) {
                const priorita = prioritaBase - (slot * 10);

                regoleV4.push({
                    id: `${regolaV3.id}_${reqIndex}_slot${slot}`,
                    descrizione: `${regolaV3.descrizione} [slot ${slot + 1}/${quantita}]`,
                    codiceTurno: turno,
                    ambulatorio: ambulatorio,
                    priorita: priorita,
                    obbligatoria: regolaV3.severita === "warning",
                    quando: regolaV3.quando,
                    attiva: true,
                    limiteAssegnazioniMensili: requisito.limiteAssegnazioniMensili || null,
                    tipoRegola: requisito.tipoRegola || "normale",
                    // Metadata per debug
                    _metadata: {
                        regolaV3Id: regolaV3.id,
                        slotIndex: slot,
                        totaleSlot: quantita
                    }
                });
                contatore++;
            }
        });
    });

    console.log(`[COVERAGE-V4] Espanse ${regoleV3.length} regole v3 → ${contatore} slot v4`);
    return regoleV4;
}

/**
 * Filtra regole v4 applicabili a un giorno specifico
 * Ordina per priorità decrescente
 *
 * @param {RegolaV4[]} regoleV4
 * @param {number} giorno
 * @param {number} mese
 * @param {number} anno
 * @returns {RegolaV4[]} - Regole applicabili ordinate per priorità
 */
export function getRegoleGiorno(regoleV4, giorno, mese, anno) {
    return regoleV4
        .filter(regola => {
            if (!regola.attiva) return false;
            return regolaApplicaAGiorno(regola, giorno, mese, anno);
        })
        .sort((a, b) => b.priorita - a.priorita);  // Priorità decrescente
}

/**
 * Crea regola v4 manuale (senza espansione da v3)
 *
 * @param {string} codiceTurno
 * @param {string} ambulatorio
 * @param {Object} quando - Condizione temporale
 * @param {number} priorita
 * @param {boolean} obbligatoria
 * @param {number|null} limiteAssegnazioniMensili
 * @param {string} tipoRegola
 * @returns {RegolaV4}
 */
export function nuovaRegolaV4(codiceTurno, ambulatorio, quando, priorita = 100, obbligatoria = true, limiteAssegnazioniMensili = null, tipoRegola = "normale") {
    return {
        id: `regola_v4_${Date.now()}`,
        descrizione: `${ambulatorio} ${codiceTurno}`,
        codiceTurno,
        ambulatorio,
        priorita,
        obbligatoria,
        quando,
        attiva: true,
        limiteAssegnazioniMensili,
        tipoRegola
    };
}

/**
 * Valida regola v4
 *
 * @param {RegolaV4} regola
 * @returns {string[]} - Array errori (vuoto se valida)
 */
export function validaRegolaV4(regola) {
    const errori = [];

    if (!regola.id || regola.id.trim() === "") {
        errori.push("ID regola mancante");
    }

    if (!regola.codiceTurno || regola.codiceTurno.trim() === "") {
        errori.push("Codice turno mancante");
    }

    if (!regola.ambulatorio || regola.ambulatorio.trim() === "") {
        errori.push("Ambulatorio mancante");
    }

    if (typeof regola.priorita !== "number" || regola.priorita < 0) {
        errori.push("Priorità non valida");
    }

    if (!regola.quando || !regola.quando.tipo) {
        errori.push("Condizione temporale mancante");
    }

    return errori;
}

/**
 * Raggruppa regole v4 per giorno/turno/ambulatorio
 * Utile per UI che vuole mostrare "x2" come gruppo
 *
 * @param {RegolaV4[]} regoleV4
 * @returns {Map<string, RegolaV4[]>} - Chiave: "GIORNO|AMBULATORIO|TURNO"
 */
export function raggruppaRegoleV4(regoleV4) {
    const gruppi = new Map();

    regoleV4.forEach(regola => {
        // La chiave non include priorità (così raggruppa slot dello stesso turno)
        const key = `${regola.ambulatorio}|${regola.codiceTurno}`;
        if (!gruppi.has(key)) {
            gruppi.set(key, []);
        }
        gruppi.get(key).push(regola);
    });

    // Ordina ogni gruppo per priorità
    gruppi.forEach((gruppo, key) => {
        gruppo.sort((a, b) => b.priorita - a.priorita);
    });

    return gruppi;
}

/**
 * Conta quante volte un turno è stato assegnato a un operatore nel mese
 * Utile per verificare limiti mensili
 *
 * @param {Object} operatore - Profilo operatore
 * @param {string} codiceTurno - Codice turno da contare (es. "BM")
 * @param {number} anno - Anno
 * @param {number} mese - Mese (0-11)
 * @param {Object[]} bozzaTurni - Array turni dalla bozza (opzionale, per preview)
 * @returns {number} - Numero di assegnazioni
 */
export function contaAssegnazioniMensili(operatore, codiceTurno, anno, mese, bozzaTurni = []) {
    let count = 0;
    const giorni = giorniNelMese(anno, mese);
    const opId = typeof operatore === 'string' ? operatore : operatore.id;

    for (let g = 1; g <= giorni; g++) {
        // Check turni già salvati
        const turnoSalvato = caricaTurno(operatore, g, anno, mese);
        if (turnoSalvato) {
            // Estrai codice turno da formato "AMBULATORIO_TURNO"
            let codice = turnoSalvato;
            if (turnoSalvato.includes('_')) {
                const parts = turnoSalvato.split('_');
                codice = parts[parts.length - 1];
            }
            if (codice === codiceTurno) {
                count++;
            }
        }

        // Check bozza (se fornita)
        if (bozzaTurni && bozzaTurni.length > 0) {
            const turnoBozza = bozzaTurni.find(t =>
                t.giorno === g && t.operatore === opId && t.turno === codiceTurno
            );
            if (turnoBozza) {
                count++;
            }
        }
    }

    return count;
}
