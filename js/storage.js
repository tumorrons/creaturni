/**
 * Storage.js - UNICA fonte di verità per persistenza dati
 *
 * Tutti gli accessi a localStorage passano da qui.
 * Se domani si vuole cambiare backend → si modifica SOLO questo file.
 */

import { setOperatori, setAmbulatori, setTurni } from './state.js';
import { migraStringaAProfilo, isProfilo, normalizzaProfilo, getIdOperatore } from './profili.js';

// ============= OPERATORI (PROFILI) =============
/**
 * Carica operatori con migrazione automatica string → profilo
 */
export function caricaOperatori() {
    const ops = localStorage.getItem("operatori");
    if (ops) {
        let parsed = JSON.parse(ops);

        // Migrazione automatica: se troviamo stringhe, convertiamo a profili
        const migrati = parsed.map(op => {
            if (typeof op === 'string') {
                return migraStringaAProfilo(op);
            }
            return normalizzaProfilo(op);
        });

        // Se c'è stata migrazione, salva subito il nuovo formato
        if (migrati.some((op, i) => typeof parsed[i] === 'string')) {
            salvaOperatori(migrati);
        }

        return migrati;
    } else {
        // Default: profili base
        const defaults = [
            migraStringaAProfilo("Rossi"),
            migraStringaAProfilo("Bianchi"),
            migraStringaAProfilo("Verdi")
        ];
        salvaOperatori(defaults);
        return defaults;
    }
}

export function salvaOperatori(operatori) {
    localStorage.setItem("operatori", JSON.stringify(operatori));
    setOperatori(operatori);
}

/**
 * Aggiunge un nuovo operatore (profilo completo)
 */
export function aggiungiOperatore(profilo) {
    const operatori = caricaOperatori();
    operatori.push(normalizzaProfilo(profilo));
    salvaOperatori(operatori);
}

/**
 * Rimuove operatore per index
 */
export function rimuoviOperatore(index) {
    const operatori = caricaOperatori();
    operatori.splice(index, 1);
    salvaOperatori(operatori);
}

/**
 * Aggiorna profilo operatore esistente
 */
export function aggiornaProfilo(index, profilo) {
    const operatori = caricaOperatori();
    if (index >= 0 && index < operatori.length) {
        operatori[index] = normalizzaProfilo(profilo);
        salvaOperatori(operatori);
    }
}

/**
 * Trova profilo per ID
 */
export function trovaProfiloPerId(id) {
    const operatori = caricaOperatori();
    return operatori.find(op => op.id === id);
}

/**
 * Trova profilo per nome
 */
export function trovaProfiloPerNome(nome) {
    const operatori = caricaOperatori();
    return operatori.find(op => op.nome === nome);
}

// ============= AMBULATORI =============
export function caricaAmbulatori() {
    const ambs = localStorage.getItem("ambulatori");
    if (ambs) {
        return JSON.parse(ambs);
    } else {
        const defaults = {
            BUD: { nome: "Budrio" },
            BAR: { nome: "Baricella" }
        };
        salvaAmbulatori(defaults);
        return defaults;
    }
}

export function salvaAmbulatori(ambulatori) {
    localStorage.setItem("ambulatori", JSON.stringify(ambulatori));
    setAmbulatori(ambulatori);
}

export function aggiungiAmbulatorio(codice, nome) {
    const ambulatori = caricaAmbulatori();
    ambulatori[codice] = { nome };
    salvaAmbulatori(ambulatori);
}

export function rimuoviAmbulatorio(codice) {
    const ambulatori = caricaAmbulatori();
    delete ambulatori[codice];
    salvaAmbulatori(ambulatori);
}

// ============= TURNI =============
export function caricaTurni() {
    const tnr = localStorage.getItem("turni");
    if (tnr) {
        return JSON.parse(tnr);
    } else {
        const defaults = {
            // Turni normali
            BM: { nome: "Mattino", colore: "#4caf50", ambulatorio: "BUD", orario: "07:00 – 14:00", labelStampa: "BM" },
            BP: { nome: "Pomeriggio", colore: "#ff9800", ambulatorio: "BUD", orario: "14:00 – 21:00", labelStampa: "BP" },
            BA: { nome: "Mattino", colore: "#9c27b0", ambulatorio: "BAR", orario: "07:00 – 14:00", labelStampa: "BA" },

            // Turni speciali (assenze/permessi) - non contano ore, bloccano auto-generazione
            FERIE: {
                nome: "Ferie",
                colore: "#2196F3",
                labelStampa: "FER",
                speciale: true,
                bloccaGenerazione: true,
                ore: 0
            },
            PERMESSO: {
                nome: "Permesso",
                colore: "#FF5722",
                labelStampa: "PER",
                speciale: true,
                bloccaGenerazione: true,
                ore: 0
            },
            LEGGE_104: {
                nome: "Legge 104",
                colore: "#9C27B0",
                labelStampa: "104",
                speciale: true,
                bloccaGenerazione: true,
                ore: 0
            },
            MALATTIA: {
                nome: "Malattia",
                colore: "#F44336",
                labelStampa: "MAL",
                speciale: true,
                bloccaGenerazione: true,
                ore: 0
            },
            RECUPERO: {
                nome: "Recupero",
                colore: "#00BCD4",
                labelStampa: "REC",
                speciale: true,
                bloccaGenerazione: true,
                ore: 0
            }
        };
        salvaTurni(defaults);
        return defaults;
    }
}

export function salvaTurni(turni) {
    localStorage.setItem("turni", JSON.stringify(turni));
    setTurni(turni);
}

export function aggiungiTurno(codice, turno) {
    const turni = caricaTurni();
    turni[codice] = turno;
    salvaTurni(turni);
}

export function rimuoviTurno(codice) {
    const turni = caricaTurni();
    delete turni[codice];
    salvaTurni(turni);
}

export function aggiornaTurno(codice, turno) {
    const turni = caricaTurni();
    turni[codice] = turno;
    salvaTurni(turni);
}

// ============= TURNI ASSEGNATI (PER GIORNO) =============
export function caricaTurno(operatore, giorno, anno, mese) {
    const opId = getIdOperatore(operatore);
    const key = `${anno}_${mese}_${opId}_${giorno}`;
    return localStorage.getItem(key) || "";
}

export function salvaTurno(operatore, giorno, valore, anno, mese) {
    const opId = getIdOperatore(operatore);
    const key = `${anno}_${mese}_${opId}_${giorno}`;
    if (valore) {
        localStorage.setItem(key, valore);
    } else {
        localStorage.removeItem(key);
    }
}

// ============= NOTE =============
export function caricaNota(operatore, giorno, anno, mese) {
    const opId = getIdOperatore(operatore);
    const key = `${anno}_${mese}_${opId}_${giorno}_note`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        // Retro-compatibilità: se non è JSON, ritorna come oggetto
        return { testo: raw, operatore: opId, ambulatorio: null };
    }
}

export function salvaNota(operatore, giorno, notaObj, anno, mese) {
    const opId = getIdOperatore(operatore);
    const key = `${anno}_${mese}_${opId}_${giorno}_note`;
    if (notaObj && notaObj.testo) {
        localStorage.setItem(key, JSON.stringify(notaObj));
    } else {
        localStorage.removeItem(key);
    }
}

// ============= UTILITÀ =============
export function pulisciTuttiTurni() {
    const keysToRemove = [];
    for (let key in localStorage) {
        // Riconosce le chiavi formato: ANNO_MESE_OPERATORE_GIORNO
        if (key.match(/^\d+_\d+_.+_\d+$/)) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    return keysToRemove.length;
}

// ============= REGOLE COPERTURA =============
export function caricaRegoleCopertura() {
    const regole = localStorage.getItem("coverageRules");
    if (regole) {
        try {
            return JSON.parse(regole);
        } catch {
            return null; // Verrà usato il default da coverage.js
        }
    }
    return null;
}

export function salvaRegoleCopertura(regole) {
    localStorage.setItem("coverageRules", JSON.stringify(regole));
}

export function aggiungiRegolaCopertura(regola) {
    const regole = caricaRegoleCopertura() || [];
    regole.push(regola);
    salvaRegoleCopertura(regole);
}

export function rimuoviRegolaCopertura(id) {
    const regole = caricaRegoleCopertura() || [];
    const filtrate = regole.filter(r => r.id !== id);
    salvaRegoleCopertura(filtrate);
}

export function aggiornaRegolaCopertura(id, nuovaRegola) {
    const regole = caricaRegoleCopertura() || [];
    const index = regole.findIndex(r => r.id === id);
    if (index !== -1) {
        regole[index] = nuovaRegola;
        salvaRegoleCopertura(regole);
    }
}

// ============= BOZZA GENERAZIONE AUTOMATICA =============
/**
 * Carica la bozza di generazione corrente
 * @returns {Object|null} - Bozza o null se non esiste
 */
export function caricaBozzaGenerazione() {
    const bozza = localStorage.getItem("generatedDraft");
    if (bozza) {
        try {
            return JSON.parse(bozza);
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Salva la bozza di generazione
 * @param {Object} bozza - Oggetto GeneratedDraft da auto-schema.js
 */
export function salvaBozzaGenerazione(bozza) {
    localStorage.setItem("generatedDraft", JSON.stringify(bozza));
}

/**
 * Elimina la bozza (quando applicata o scartata)
 */
export function eliminaBozzaGenerazione() {
    localStorage.removeItem("generatedDraft");
}

/**
 * Check rapido se esiste una bozza in stato draft
 * @returns {boolean}
 */
export function hasBozzaAttiva() {
    const bozza = caricaBozzaGenerazione();
    return bozza && bozza.stato === "draft";
}

// ============= INIZIALIZZAZIONE =============
export function initStorage() {
    const operatori = caricaOperatori();
    const ambulatori = caricaAmbulatori();
    const turni = caricaTurni();

    setOperatori(operatori);
    setAmbulatori(ambulatori);
    setTurni(turni);

    return { operatori, ambulatori, turni };
}
