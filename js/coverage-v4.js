/**
 * coverage-v4.js - Sistema di regole v4.1
 *
 * FILOSOFIA v4.1 (FASE 1B):
 * - Ogni slot è una REGOLA SEPARATA con priorità
 * - Ogni slot specifica RUOLO RICHIESTO (INF, OSS, etc.)
 * - Slot atomici: 1 turno + 1 ruolo + 1 priorità
 * - Vincoli HARD (esclusioni) separati da priorità SOFT (scoring)
 *
 * Esempio PRIMA (v4.0):
 *   { turno: "BU-M", quantita: 2 } → 2 slot generici
 *
 * Esempio DOPO (v4.1):
 *   richiesteRuoli: [
 *     { ruolo: "infermiere", quantita: 1 },
 *     { ruolo: "oss", quantita: 1 }
 *   ]
 *   → slot atomici:
 *     [ { turno: "BU-M", ruoloRichiesto: "infermiere", priorita: 100 },
 *       { turno: "BU-M", ruoloRichiesto: "oss", priorita: 90 } ]
 */

import { regolaApplicaAGiorno } from './coverage.js';
import { giorniNelMese } from './calendar.js';
import { caricaTurno } from './storage.js';

/**
 * Schema regola v4.1 (slot singolo con ruolo)
 *
 * @typedef {Object} RegolaV4
 * @property {string} id - ID univoco regola
 * @property {string} descrizione - Descrizione testuale
 * @property {string} codiceTurno - Codice turno (es. "BU-M")
 * @property {string} ambulatorio - Sede (es. "BUD")
 * @property {string|null} ruoloRichiesto - Ruolo richiesto: "infermiere", "oss", "medico", "coordinatore", "altro", null (ANY)
 * @property {number} priorita - Priorità (100 = massima, 0 = normale, negativa = bassa)
 * @property {boolean} obbligatoria - Se false, genera solo warning
 * @property {Object} quando - Condizione temporale (stesso formato v3)
 * @property {boolean} attiva - Regola attiva/disattiva
 * @property {number|null} limiteAssegnazioniMensili - Max assegnazioni mensili per operatore (null = nessun limite)
 * @property {string} tipoRegola - Tipo: "normale", "filler" (usa per riempire ore), "last_resort" (copri per ultimo)
 */

/**
 * Schema richiesta ruolo in regola v3
 *
 * @typedef {Object} RichiestaRuolo
 * @property {string} ruolo - Ruolo richiesto ("infermiere", "oss", "medico", "coordinatore", "altro")
 * @property {number} quantita - Quanti operatori di questo ruolo servono
 */

/**
 * Espande regole v3 (con quantità/ruoli) in regole v4.1 (slot atomici con ruolo)
 *
 * LOGICA v4.1 (FASE 1B):
 * - Se richiesteRuoli presente → espandi per ruolo
 * - Se richiesteRuoli assente (legacy) → usa quantita con ruoloRichiesto: null
 *
 * Priorità:
 * - Prima richiesta ruolo, primo slot: prioritaBase
 * - Prima richiesta ruolo, secondo slot: prioritaBase - 10
 * - Seconda richiesta ruolo, primo slot: prioritaBase - 20
 * - etc.
 *
 * Esempio:
 *   richiesteRuoli: [ {ruolo: "infermiere", quantita: 2}, {ruolo: "oss", quantita: 1} ]
 *   → slot:
 *     INF #1: priorita 100
 *     INF #2: priorita 90
 *     OSS #1: priorita 80
 *
 * @param {Object[]} regoleV3 - Regole in formato v3
 * @param {number} prioritaBase - Priorità base per primo slot (default 100)
 * @returns {RegolaV4[]} - Array regole v4.1 espanse
 */
export function espandiRegoleV3inV4(regoleV3, prioritaBase = 100) {
    const regoleV4 = [];
    let contatore = 0;

    regoleV3.forEach(regolaV3 => {
        if (!regolaV3.attiva) return;

        // Per ogni requisito nella regola v3
        regolaV3.richiesti.forEach((requisito, reqIndex) => {
            const { ambulatorio, turno, quantita, richiesteRuoli } = requisito;

            // === CASO 1: Richieste per ruolo (v4.1) ===
            if (richiesteRuoli && Array.isArray(richiesteRuoli) && richiesteRuoli.length > 0) {
                let offsetPriorita = 0;

                richiesteRuoli.forEach((richiestaRuolo, ruoloIndex) => {
                    const { ruolo, quantita: quantitaRuolo } = richiestaRuolo;

                    // Valida ruolo
                    if (!ruolo || typeof ruolo !== 'string') {
                        console.warn(`[COVERAGE-V4] Ruolo non valido in regola ${regolaV3.id}, requisito ${reqIndex}, skip`);
                        return;
                    }

                    // Crea slot atomici per questo ruolo
                    for (let slot = 0; slot < quantitaRuolo; slot++) {
                        const priorita = prioritaBase - offsetPriorita;
                        offsetPriorita += 10;

                        regoleV4.push({
                            id: `${regolaV3.id}_${reqIndex}_${ruolo}_slot${slot}`,
                            descrizione: `${regolaV3.descrizione} [${ruolo.toUpperCase()} ${slot + 1}/${quantitaRuolo}]`,
                            codiceTurno: turno,
                            ambulatorio: ambulatorio,
                            ruoloRichiesto: ruolo,  // ⭐ NUOVO: ruolo specifico richiesto
                            priorita: priorita,
                            obbligatoria: regolaV3.severita === "warning",
                            quando: regolaV3.quando,
                            attiva: true,
                            limiteAssegnazioniMensili: requisito.limiteAssegnazioniMensili || null,
                            tipoRegola: requisito.tipoRegola || "normale",
                            // Metadata per debug
                            _metadata: {
                                regolaV3Id: regolaV3.id,
                                ruolo: ruolo,
                                slotIndex: slot,
                                totaleSlotRuolo: quantitaRuolo
                            }
                        });
                        contatore++;
                    }
                });
            }
            // === CASO 2: Legacy - quantita senza ruoli (v4.0) ===
            else {
                // Retrocompatibilità: crea slot generici senza ruolo specifico
                for (let slot = 0; slot < quantita; slot++) {
                    const priorita = prioritaBase - (slot * 10);

                    regoleV4.push({
                        id: `${regolaV3.id}_${reqIndex}_slot${slot}`,
                        descrizione: `${regolaV3.descrizione} [slot ${slot + 1}/${quantita}]`,
                        codiceTurno: turno,
                        ambulatorio: ambulatorio,
                        ruoloRichiesto: null,  // ⭐ NULL = ANY (qualsiasi ruolo)
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
                            totaleSlot: quantita,
                            legacy: true
                        }
                    });
                    contatore++;
                }
            }
        });
    });

    console.log(`[COVERAGE-V4.1] Espanse ${regoleV3.length} regole v3 → ${contatore} slot v4.1 atomici`);
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
 * Crea regola v4.1 manuale (senza espansione da v3)
 *
 * @param {string} codiceTurno
 * @param {string} ambulatorio
 * @param {Object} quando - Condizione temporale
 * @param {string|null} ruoloRichiesto - Ruolo richiesto (null = ANY)
 * @param {number} priorita
 * @param {boolean} obbligatoria
 * @param {number|null} limiteAssegnazioniMensili
 * @param {string} tipoRegola
 * @returns {RegolaV4}
 */
export function nuovaRegolaV4(codiceTurno, ambulatorio, quando, ruoloRichiesto = null, priorita = 100, obbligatoria = true, limiteAssegnazioniMensili = null, tipoRegola = "normale") {
    return {
        id: `regola_v4_${Date.now()}`,
        descrizione: ruoloRichiesto
            ? `${ambulatorio} ${codiceTurno} [${ruoloRichiesto.toUpperCase()}]`
            : `${ambulatorio} ${codiceTurno}`,
        codiceTurno,
        ambulatorio,
        ruoloRichiesto,
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
