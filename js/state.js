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
    // ========================================
    // TURNI NORMALI (singoli)
    // ========================================
    "BU-M": {
        nome: "Mattino Budrio",
        colore: "#4caf50",
        ambulatorio: "BUD",
        labelStampa: "BU-M",
        ingresso: "07:00",
        uscita: "13:36",
        pausa: 0,
        sottraiPausa: false
    },
    "BU-P": {
        nome: "Pomeriggio Budrio",
        colore: "#ff9800",
        ambulatorio: "BUD",
        labelStampa: "BU-P",
        ingresso: "14:00",
        uscita: "21:00",
        pausa: 0,
        sottraiPausa: false
    },
    "BU-S": {
        nome: "Sabato Budrio",
        colore: "#2196F3",
        ambulatorio: "BUD",
        labelStampa: "BU-S",
        ingresso: "08:00",
        uscita: "14:00",
        pausa: 0,
        sottraiPausa: false
    },
    "BU-DF": {
        nome: "Domenica/Festivo Budrio",
        colore: "#E91E63",
        ambulatorio: "BUD",
        labelStampa: "BU-DF",
        ingresso: "08:00",
        uscita: "11:00",
        pausa: 0,
        sottraiPausa: false
    },
    "BAR-M": {
        nome: "Mattino Baricella",
        colore: "#9c27b0",
        ambulatorio: "BAR",
        labelStampa: "BAR-M",
        ingresso: "07:00",
        uscita: "14:12",
        pausa: 0,
        sottraiPausa: false
    },
    "BAR-P": {
        nome: "Pomeriggio Baricella",
        colore: "#FF5722",
        ambulatorio: "BAR",
        labelStampa: "BAR-P",
        ingresso: "14:00",
        uscita: "21:00",
        pausa: 0,
        sottraiPausa: false
    },

    // ========================================
    // TURNI SEGMENTATI - SPEZZATI (con pausa)
    // ========================================
    "BU-LUNGA": {
        nome: "Turno Lungo Budrio",
        colore: "#8BC34A",
        ambulatorio: "BUD",
        labelStampa: "LUNGA",
        sottraiPausa: true,
        segmenti: [
            {
                ambulatorio: "BUD",
                ingresso: "07:00",
                uscita: "13:30",
                pausa: 0
            },
            {
                ambulatorio: "BUD",
                ingresso: "14:00",
                uscita: "16:00",
                pausa: 0
            }
        ]
    },

    // ========================================
    // TURNI SEGMENTATI - MULTI-SEDE
    // ========================================
    "BUD-BAR-M": {
        nome: "Mattino Budrio+Baricella",
        colore: "#00BCD4",
        ambulatorio: "MULTI",  // Categoria speciale
        labelStampa: "BB-M",
        sottraiPausa: false,
        segmenti: [
            {
                ambulatorio: "BUD",
                ingresso: "08:00",
                uscita: "10:00",
                pausa: 0
            },
            {
                ambulatorio: "BAR",
                ingresso: "10:30",
                uscita: "12:30",
                pausa: 0
            }
        ]
    },
    "BUD-BAR-P": {
        nome: "Pomeriggio Budrio+Baricella",
        colore: "#FF9800",
        ambulatorio: "MULTI",
        labelStampa: "BB-P",
        sottraiPausa: false,
        segmenti: [
            {
                ambulatorio: "BUD",
                ingresso: "14:00",
                uscita: "16:00",
                pausa: 0
            },
            {
                ambulatorio: "BAR",
                ingresso: "16:30",
                uscita: "18:30",
                pausa: 0
            }
        ]
    },
    "BAR-BUD-M": {
        nome: "Mattino Baricella+Budrio",
        colore: "#9C27B0",
        ambulatorio: "MULTI",
        labelStampa: "RB-M",
        sottraiPausa: false,
        segmenti: [
            {
                ambulatorio: "BAR",
                ingresso: "08:00",
                uscita: "10:00",
                pausa: 0
            },
            {
                ambulatorio: "BUD",
                ingresso: "10:30",
                uscita: "12:30",
                pausa: 0
            }
        ]
    },

    // ========================================
    // TURNI SPECIALI (assenze/permessi)
    // ========================================
    FERIE: { nome: "Ferie", colore: "#2196F3", labelStampa: "FER", speciale: true, bloccaGenerazione: true, ore: 0 },
    PERMESSO: { nome: "Permesso", colore: "#FF5722", labelStampa: "PER", speciale: true, bloccaGenerazione: true, ore: 0 },
    LEGGE_104: { nome: "Legge 104", colore: "#9C27B0", labelStampa: "104", speciale: true, bloccaGenerazione: true, ore: 0 },
    MALATTIA: { nome: "Malattia", colore: "#F44336", labelStampa: "MAL", speciale: true, bloccaGenerazione: true, ore: 0 },
    RECUPERO: { nome: "Recupero", colore: "#00BCD4", labelStampa: "REC", speciale: true, bloccaGenerazione: true, ore: 0 },

    // ========================================
    // RETROCOMPATIBILITÀ (vecchi codici)
    // ========================================
    BM: { nome: "Mattino (old)", colore: "#4caf50", ambulatorio: "BUD", orario: "07:00 – 14:00", labelStampa: "BM", ore: 6.6 },
    BP: { nome: "Pomeriggio (old)", colore: "#ff9800", ambulatorio: "BUD", orario: "14:00 – 21:00", labelStampa: "BP", ore: 7 },
    BA: { nome: "Mattino BAR (old)", colore: "#9c27b0", ambulatorio: "BAR", orario: "07:00 – 14:00", labelStampa: "BA", ore: 7.2 }
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
