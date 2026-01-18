/**
 * Note.js - Gestione logica note
 *
 * Funzioni di utilità per le note (raccolta dati, filtraggio, ecc.)
 * NESSUN accesso diretto al DOM.
 */

import { giorniNelMese } from './calendar.js';
import { caricaNota } from './storage.js';

/**
 * Raccoglie tutte le note per un mese
 */
export function raccogliNoteMese(operatori, anno, mese) {
    const note = [];
    const giorni = giorniNelMese(anno, mese);

    operatori.forEach(op => {
        for (let g = 1; g <= giorni; g++) {
            const nota = caricaNota(op, g, anno, mese);
            if (nota && nota.testo) {
                note.push({
                    operatore: op,
                    giorno: g,
                    anno,
                    mese,
                    nota
                });
            }
        }
    });

    return note;
}

/**
 * Raccoglie note per un ambulatorio specifico
 */
export function raccogliNoteAmbulatorio(operatori, anno, mese, ambulatorio) {
    const tutteNote = raccogliNoteMese(operatori, anno, mese);
    return tutteNote.filter(item =>
        item.nota.ambulatorio === ambulatorio ||
        item.nota.ambulatorio == null // Include note generiche
    );
}

/**
 * Verifica se un giorno ha note
 */
export function hasNota(operatore, giorno, anno, mese) {
    const nota = caricaNota(operatore, giorno, anno, mese);
    return !!(nota && nota.testo);
}
