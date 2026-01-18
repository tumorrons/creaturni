/**
 * State.js - Stato globale dell'applicazione
 *
 * Questo modulo centralizza TUTTO lo stato mutabile dell'app.
 * Nessun altro modulo dovrebbe contenere variabili globali mutabili.
 */

// Costanti anno
export const ANNO_MIN = 2020;
export const ANNO_MAX = 2030;

// Stato navigazione temporale
export let annoCorrente = new Date().getFullYear();
export let meseCorrente = new Date().getMonth();
export let mesiVisibili = 12;
export let vistaAnnoMode = "column";

// Stato selezione turni
export let turnoSelezionato = null;
export let modalitaInserimento = "turno"; // "turno" | "nota" | null

// Stato nota corrente (editor inline)
export let notaCorrente = {
    operatore: null,
    giorno: null,
    anno: null,
    mese: null
};

// Stato visualizzazione bozza generazione automatica
export let viewMode = {
    mostraBozza: false
};

// Dati di dominio (caricati da storage)
export let operatori = [];
export let ambulatori = {
    BUD: { nome: "Budrio" },
    BAR: { nome: "Baricella" }
};
export let turni = {
    // Turni normali
    BM: { nome: "Mattino", colore: "#4caf50", ambulatorio: "BUD", orario: "07:00 – 14:00", labelStampa: "BM" },
    BP: { nome: "Pomeriggio", colore: "#ff9800", ambulatorio: "BUD", orario: "14:00 – 21:00", labelStampa: "BP" },
    BA: { nome: "Mattino", colore: "#9c27b0", ambulatorio: "BAR", orario: "07:00 – 14:00", labelStampa: "BA" },

    // Turni speciali (assenze/permessi)
    FERIE: { nome: "Ferie", colore: "#2196F3", labelStampa: "FER", speciale: true, bloccaGenerazione: true, ore: 0 },
    PERMESSO: { nome: "Permesso", colore: "#FF5722", labelStampa: "PER", speciale: true, bloccaGenerazione: true, ore: 0 },
    LEGGE_104: { nome: "Legge 104", colore: "#9C27B0", labelStampa: "104", speciale: true, bloccaGenerazione: true, ore: 0 },
    MALATTIA: { nome: "Malattia", colore: "#F44336", labelStampa: "MAL", speciale: true, bloccaGenerazione: true, ore: 0 },
    RECUPERO: { nome: "Recupero", colore: "#00BCD4", labelStampa: "REC", speciale: true, bloccaGenerazione: true, ore: 0 }
};

// Setters per aggiornare lo stato
export function setAnnoCorrente(anno) {
    if (anno >= ANNO_MIN && anno <= ANNO_MAX) {
        annoCorrente = anno;
    }
}

export function setMeseCorrente(mese) {
    if (mese >= 0 && mese <= 11) {
        meseCorrente = mese;
    }
}

export function setMesiVisibili(n) {
    mesiVisibili = n;
    localStorage.setItem("mesiVisibili", n);
}

export function setVistaAnnoMode(mode) {
    vistaAnnoMode = mode;
    localStorage.setItem("vistaAnnoMode", mode);
}

export function setTurnoSelezionato(turno) {
    turnoSelezionato = turno;
}

export function setModalitaInserimento(modalita) {
    modalitaInserimento = modalita;
}

export function setNotaCorrente(nota) {
    notaCorrente = nota;
}

export function setOperatori(ops) {
    operatori = ops;
}

export function setAmbulatori(ambs) {
    ambulatori = ambs;
}

export function setTurni(t) {
    turni = t;
}

// Navigazione mese
export function meseSuccessivo() {
    meseCorrente++;
    if (meseCorrente > 11) {
        meseCorrente = 0;
        annoCorrente++;
    }
    if (annoCorrente > ANNO_MAX) {
        annoCorrente--;
        meseCorrente = 11;
    }
}

export function mesePrecedente() {
    meseCorrente--;
    if (meseCorrente < 0) {
        meseCorrente = 11;
        annoCorrente--;
    }
    if (annoCorrente < ANNO_MIN) {
        annoCorrente++;
        meseCorrente = 0;
    }
}

// Navigazione anno
export function annoSuccessivo() {
    if (annoCorrente < ANNO_MAX) {
        annoCorrente++;
    }
}

export function annoPrecedente() {
    if (annoCorrente > ANNO_MIN) {
        annoCorrente--;
    }
}

// Selezione/deselezione turni
export function deselezionaTutto() {
    turnoSelezionato = null;
    modalitaInserimento = null;
    document.body.style.cursor = "default";
    document.querySelectorAll(".turno-btn")
        .forEach(b => b.classList.remove("turno-attivo"));
}

// Inizializza stato da localStorage
export function initState() {
    const savedMesiVisibili = localStorage.getItem("mesiVisibili");
    if (savedMesiVisibili) {
        mesiVisibili = parseInt(savedMesiVisibili);
    }

    const savedVistaAnnoMode = localStorage.getItem("vistaAnnoMode");
    if (savedVistaAnnoMode) {
        vistaAnnoMode = savedVistaAnnoMode;
    }
}

// Getter per stato completo (usato da moduli auto-*)
export function getState() {
    return {
        annoCorrente,
        meseCorrente,
        operatori,
        ambulatori,
        turni,
        turnoSelezionato,
        modalitaInserimento,
        mesiVisibili,
        vistaAnnoMode,
        viewMode
    };
}

// Setter per viewMode
export function setMostraBozza(valore) {
    viewMode.mostraBozza = valore;
}
