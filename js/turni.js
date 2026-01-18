/**
 * Turni.js - Logica di business per turni e calcolo ore
 *
 * FONTE DI VERITÀ per tutto ciò che riguarda:
 * - Calcolo durata turni
 * - Calcolo ore operatori
 * - Calcolo ore ambulatori
 * - Validazione orari
 *
 * NESSUN accesso diretto a DOM o localStorage (solo tramite parametri).
 */

import { giorniNelMese } from './calendar.js';
import { caricaTurno } from './storage.js';
import { turni } from './state.js';

/**
 * Calcola i minuti tra due orari (HH:MM)
 * Supporta turni notturni (es: 22:00 - 06:00)
 */
export function minutiTra(oraInizio, oraFine) {
    const [h1, m1] = oraInizio.split(":").map(Number);
    const [h2, m2] = oraFine.split(":").map(Number);
    let minuti = (h2 * 60 + m2) - (h1 * 60 + m1);

    // Se negativo, il turno attraversa la mezzanotte
    if (minuti < 0) {
        minuti += 1440; // Aggiungi 24 ore in minuti
    }

    return minuti;
}

/**
 * Converte minuti in formato HH:MM (base 60)
 */
export function minutiToOreMinuti(minutiTotali) {
    const ore = Math.floor(minutiTotali / 60);
    const minuti = minutiTotali % 60;
    return `${ore}:${minuti.toString().padStart(2, "0")}`;
}

/**
 * 🔑 FONTE DI VERITÀ: Calcola minuti lavorativi di un turno
 */
export function calcolaMinutiTurno(turnoCode) {
    if (!turnoCode) return 0;
    const turno = turni[turnoCode];
    if (!turno) return 0;

    let totale = 0;

    // TURNI A SEGMENTI (spezzati / multi-sede)
    if (Array.isArray(turno.segmenti) && turno.segmenti.length > 0) {
        turno.segmenti.forEach(seg => {
            if (seg.ingresso && seg.uscita) {
                let m = minutiTra(seg.ingresso, seg.uscita);
                const pausa = seg.pausa || 0;
                if (turno.sottraiPausa && pausa) {
                    m -= pausa;
                }
                totale += Math.max(0, m);
            }
        });
        return totale;
    }

    // TURNO SINGOLO (retrocompatibilità)
    if (turno.ingresso && turno.uscita) {
        let minuti = minutiTra(turno.ingresso, turno.uscita);

        if (turno.sottraiPausa && turno.pausa) {
            minuti -= turno.pausa;
        }

        return Math.max(0, minuti);
    }

    // RETRO-COMPATIBILITÀ: Vecchio campo "ore" → converti in minuti
    if (turno.ore) {
        return Math.round(Number(turno.ore) * 60);
    }

    return 0;
}

/**
 * Calcola ore turno in formato HH:MM (per visualizzazione)
 */
export function calcolaOreTurno(turnoCode) {
    const minuti = calcolaMinutiTurno(turnoCode);
    return minutiToOreMinuti(minuti);
}

/**
 * Calcola minuti totali per operatore nel mese
 */
export function calcolaMinutiOperatore(operatore, anno, mese) {
    let totale = 0;
    const giorni = giorniNelMese(anno, mese);

    for (let g = 1; g <= giorni; g++) {
        const t = caricaTurno(operatore, g, anno, mese);
        totale += calcolaMinutiTurno(t);
    }

    return totale;
}

/**
 * Calcola ore totali operatore in formato HH:MM
 */
export function calcolaOreOperatore(operatore, anno, mese) {
    const minuti = calcolaMinutiOperatore(operatore, anno, mese);
    return minutiToOreMinuti(minuti);
}

/**
 * Calcola minuti totali per ambulatorio nel mese
 */
export function calcolaMinutiAmbulatorio(amb, anno, mese, operatori) {
    let totale = 0;
    const giorni = giorniNelMese(anno, mese);

    operatori.forEach(op => {
        for (let g = 1; g <= giorni; g++) {
            const t = caricaTurno(op, g, anno, mese);
            if (t && turni[t]) {
                const turno = turni[t];

                // TURNI A SEGMENTI: conta solo segmenti di questo ambulatorio
                if (Array.isArray(turno.segmenti) && turno.segmenti.length > 0) {
                    turno.segmenti.forEach(seg => {
                        if (seg.ambulatorio === amb && seg.ingresso && seg.uscita) {
                            let m = minutiTra(seg.ingresso, seg.uscita);
                            const pausa = seg.pausa || 0;
                            if (turno.sottraiPausa && pausa) {
                                m -= pausa;
                            }
                            totale += Math.max(0, m);
                        }
                    });
                }
                // TURNO SINGOLO: conta se è dell'ambulatorio
                else if (turno.ambulatorio === amb) {
                    totale += calcolaMinutiTurno(t);
                }
            }
        }
    });

    return totale;
}

/**
 * Calcola ore totali ambulatorio in formato HH:MM
 */
export function calcolaOreAmbulatorio(amb, anno, mese, operatori) {
    const minuti = calcolaMinutiAmbulatorio(amb, anno, mese, operatori);
    return minutiToOreMinuti(minuti);
}

/**
 * Genera stringa orario leggibile per tooltip
 */
export function getOrarioDettaglioTurno(turnoCode, ambulatori) {
    if (!turnoCode) return "";
    const turno = turni[turnoCode];
    if (!turno) return "";

    // TURNI A SEGMENTI (spezzati / multi-sede)
    if (Array.isArray(turno.segmenti) && turno.segmenti.length > 0) {
        return turno.segmenti.map(seg => {
            const sede = seg.ambulatorio ? `📍 ${ambulatori[seg.ambulatorio]?.nome || seg.ambulatorio}` : "";
            const pausa = seg.pausa > 0 ? ` (pausa ${seg.pausa}')` : "";
            return `${seg.ingresso}-${seg.uscita}${pausa} ${sede}`;
        }).join(" • ");
    }

    // Turno singolo con ingresso/uscita
    if (turno.ingresso && turno.uscita) {
        let dettaglio = `${turno.ingresso} - ${turno.uscita}`;
        if (turno.pausa > 0) {
            dettaglio += turno.sottraiPausa
                ? ` (pausa ${turno.pausa}' sottratta)`
                : ` (pausa ${turno.pausa}' non sottratta)`;
        }
        return dettaglio;
    }

    // Vecchio formato testuale (legacy)
    return turno.orario || "";
}

/**
 * Valida orario nel formato HH:MM
 */
export function validaOrario(orario) {
    const pattern = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    return pattern.test(orario);
}

/**
 * Verifica se un turno è notturno (uscita < ingresso)
 */
export function isTurnoNotturno(ingresso, uscita) {
    return uscita < ingresso;
}
