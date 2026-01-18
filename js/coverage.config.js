/**
 * coverage.config.js - Regole di copertura turni (DEFAULT)
 *
 * Queste sono le regole di default caricate al primo avvio.
 * L'utente può modificarle tramite l'interfaccia di configurazione.
 * Le regole personalizzate vengono salvate in localStorage.
 */

export const defaultCoverageRules = [
    {
        id: "capodanno_mattino",
        descrizione: "Il 1° gennaio devono essere coperti entrambi i mattini",
        quando: {
            tipo: "giorno_specifico",
            giorno: 1,
            mese: 0  // Gennaio
        },
        richiesti: [
            { ambulatorio: "BAR", turno: "BA", quantita: 1 },
            { ambulatorio: "BUD", turno: "BM", quantita: 1 }
        ],
        severita: "warning",
        attiva: true
    },

    {
        id: "ferragosto_copertura",
        descrizione: "Il 15 agosto deve esserci almeno un turno mattino attivo",
        quando: {
            tipo: "giorno_specifico",
            giorno: 15,
            mese: 7  // Agosto
        },
        richiesti: [
            { ambulatorio: "BUD", turno: "BM", quantita: 1 }
        ],
        severita: "info",
        attiva: true
    },

    {
        id: "lunedi_mattino_minimo",
        descrizione: "Ogni lunedì deve esserci almeno un mattino a Budrio",
        quando: {
            tipo: "giorno_settimana",
            giornoSettimana: 0  // 0 = Lunedì
        },
        richiesti: [
            { ambulatorio: "BUD", turno: "BM", quantita: 1 }
        ],
        severita: "info",
        attiva: true
    },

    {
        id: "venerdi_doppia_copertura",
        descrizione: "Ogni venerdì richiesta doppia copertura mattino Budrio",
        quando: {
            tipo: "giorno_settimana",
            giornoSettimana: 4  // 4 = Venerdì
        },
        richiesti: [
            { ambulatorio: "BUD", turno: "BM", quantita: 2 }
        ],
        severita: "warning",
        attiva: false  // Disattivata di default
    },

    {
        id: "natale_emergenza",
        descrizione: "Il 25 dicembre deve esserci copertura minima mattino",
        quando: {
            tipo: "giorno_specifico",
            giorno: 25,
            mese: 11  // Dicembre
        },
        richiesti: [
            { ambulatorio: "BUD", turno: "BM", quantita: 1 }
        ],
        severita: "warning",
        attiva: true
    }
];
