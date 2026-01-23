/**
 * profili.js - Schema e utilità profili operatori
 *
 * Definisce la struttura del profilo operatore e fornisce funzioni di validazione.
 */

/**
 * Schema completo profilo operatore
 */
export const SCHEMA_PROFILO_DEFAULT = {
    id: "",
    nome: "",
    ruolo: "infermiere",  // Ruolo operatore (infermiere, oss, medico, coordinatore, altro, custom)
    ruoloCustom: null,    // Se ruolo="altro", qui va il ruolo personalizzato
    sedePrincipale: null,
    sediSecondarie: [],
    contratto: {
        tipo: "full-time",
        oreSettimanali: 40
    },
    preferenze: {
        // Campi base (retrocompatibilità)
        sedePreferita: null,
        evitaSede: null,
        evitaTurni: [], // Legacy - usare preferenzeTurni
        giorniPreferiti: [],
        giorniDaEvitare: [],
        // Nuovo: preferenze turni con livelli (-2, -1, 0, +1, +2)
        preferenzeTurni: {}, // Es: { "BU-M": 2, "BU-P": -1 }
        // Regole personalizzate (nuovo)
        regole: []
    },
    vincoli: {
        // Campi base (retrocompatibilità)
        maxOreSettimanali: null,
        maxGiorniConsecutivi: null,
        minRiposoOre: 11,
        // Regole personalizzate (nuovo)
        regole: []
    }
};

/**
 * Schema regola personalizzata
 */
export const SCHEMA_REGOLA = {
    id: "",                    // ID univoco regola (es. "RULE_001")
    tipo: "preferenza",        // "preferenza" | "vincolo"
    descrizione: "",           // Descrizione human-readable
    condizione: {
        campo: "",             // Campo da valutare (es. "turno.codice", "giorniConsecutivi")
        operatore: "equals",   // "equals" | "notEquals" | "gt" | "lt" | "gte" | "lte" | "contains" | "notContains"
        valore: null           // Valore da confrontare (string, number, array)
    },
    gravita: "warning",        // "info" | "warning" | "error"
    messaggio: "",             // Messaggio da mostrare quando scatta
    attiva: true               // Se false, regola ignorata
};

/**
 * Tipi contratto ammessi
 */
export const TIPI_CONTRATTO = {
    FULL_TIME: "full-time",
    PART_TIME: "part-time"
};

/**
 * Ruoli predefiniti per operatori
 */
export const RUOLI_PREDEFINITI = [
    { value: "infermiere", label: "Infermiere", emoji: "👨‍⚕️" },
    { value: "oss", label: "OSS (Operatore Socio-Sanitario)", emoji: "👩‍⚕️" },
    { value: "medico", label: "Medico", emoji: "🩺" },
    { value: "coordinatore", label: "Coordinatore", emoji: "📋" },
    { value: "altro", label: "Altro", emoji: "👤" }
];

/**
 * Giorni della settimana (per preferenze)
 */
export const GIORNI_SETTIMANA = [
    { value: "lun", label: "Lunedì" },
    { value: "mar", label: "Martedì" },
    { value: "mer", label: "Mercoledì" },
    { value: "gio", label: "Giovedì" },
    { value: "ven", label: "Venerdì" },
    { value: "sab", label: "Sabato" },
    { value: "dom", label: "Domenica" }
];

/**
 * Operatori disponibili per regole personalizzate
 */
export const OPERATORI_REGOLA = {
    EQUALS: { value: "equals", label: "è uguale a", simbolo: "=" },
    NOT_EQUALS: { value: "notEquals", label: "è diverso da", simbolo: "≠" },
    GT: { value: "gt", label: "è maggiore di", simbolo: ">" },
    LT: { value: "lt", label: "è minore di", simbolo: "<" },
    GTE: { value: "gte", label: "è maggiore o uguale a", simbolo: "≥" },
    LTE: { value: "lte", label: "è minore o uguale a", simbolo: "≤" },
    CONTAINS: { value: "contains", label: "contiene", simbolo: "∋" },
    NOT_CONTAINS: { value: "notContains", label: "non contiene", simbolo: "∌" }
};

/**
 * Campi disponibili per regole personalizzate
 */
export const CAMPI_REGOLA = {
    TURNO_CODICE: { value: "turno.codice", label: "Codice turno", tipo: "string" },
    TURNO_TIPO: { value: "turno.tipo", label: "Tipo turno", tipo: "string" },
    SEDE: { value: "sede", label: "Sede turno", tipo: "string" },
    GIORNO_SETTIMANA: { value: "giornoSettimana", label: "Giorno settimana", tipo: "string" },
    GIORNI_CONSECUTIVI: { value: "giorniConsecutivi", label: "Giorni consecutivi", tipo: "number" },
    ORE_SETTIMANA: { value: "oreSettimana", label: "Ore settimana corrente", tipo: "number" },
    ORE_MESE: { value: "oreMese", label: "Ore mese", tipo: "number" },
    ORE_TURNO: { value: "oreTurno", label: "Ore turno", tipo: "number" },
    RIPOSO_ORE: { value: "riposoOre", label: "Ore riposo da ultimo turno", tipo: "number" }
};

/**
 * Crea un nuovo profilo vuoto con valori di default
 */
export function nuovoProfilo(nome = "") {
    return {
        ...JSON.parse(JSON.stringify(SCHEMA_PROFILO_DEFAULT)),
        id: `OP_${Date.now()}`,
        nome
    };
}

/**
 * Migra una stringa (vecchio formato) a oggetto profilo
 */
export function migraStringaAProfilo(nomeOperatore) {
    return {
        id: `OP_${nomeOperatore.replace(/\s+/g, '_')}`,
        nome: nomeOperatore,
        sedePrincipale: null,
        sediSecondarie: [],
        contratto: {
            tipo: "full-time",
            oreSettimanali: 40
        },
        preferenze: {
            sedePreferita: null,
            evitaSede: null,
            evitaTurni: [],
            preferenzeTurni: {},
            giorniPreferiti: [],
            giorniDaEvitare: []
        },
        vincoli: {
            maxOreSettimanali: null,
            maxGiorniConsecutivi: null,
            minRiposoOre: 11
        }
    };
}

/**
 * Verifica se un valore è un profilo completo o solo una stringa
 */
export function isProfilo(operatore) {
    return typeof operatore === 'object' && operatore !== null && 'id' in operatore;
}

/**
 * Ottiene il nome visualizzabile da un operatore (stringa o profilo)
 */
export function getNomeOperatore(operatore) {
    if (typeof operatore === 'string') {
        return operatore;
    }
    return operatore?.nome || operatore?.id || "Sconosciuto";
}

/**
 * Ottiene l'ID da un operatore (stringa o profilo)
 */
export function getIdOperatore(operatore) {
    if (typeof operatore === 'string') {
        return operatore;
    }
    return operatore?.id || operatore?.nome || "unknown";
}

/**
 * Valida un profilo operatore
 */
export function validaProfilo(profilo) {
    const errori = [];

    // Validazione identità
    if (!profilo.id || profilo.id.trim() === "") {
        errori.push("ID operatore mancante");
    }

    if (!profilo.nome || profilo.nome.trim() === "") {
        errori.push("Nome operatore mancante");
    }

    // Validazione contratto
    if (profilo.contratto) {
        if (!Object.values(TIPI_CONTRATTO).includes(profilo.contratto.tipo)) {
            errori.push("Tipo contratto non valido");
        }

        if (profilo.contratto.oreSettimanali &&
            (profilo.contratto.oreSettimanali < 1 || profilo.contratto.oreSettimanali > 60)) {
            errori.push("Ore settimanali devono essere tra 1 e 60");
        }
    }

    // Validazione vincoli
    if (profilo.vincoli) {
        if (profilo.vincoli.maxOreSettimanali && profilo.vincoli.maxOreSettimanali < 1) {
            errori.push("Max ore settimanali deve essere positivo");
        }

        if (profilo.vincoli.maxGiorniConsecutivi &&
            (profilo.vincoli.maxGiorniConsecutivi < 1 || profilo.vincoli.maxGiorniConsecutivi > 31)) {
            errori.push("Max giorni consecutivi deve essere tra 1 e 31");
        }

        if (profilo.vincoli.minRiposoOre &&
            (profilo.vincoli.minRiposoOre < 0 || profilo.vincoli.minRiposoOre > 24)) {
            errori.push("Min riposo ore deve essere tra 0 e 24");
        }
    }

    return errori;
}

/**
 * Normalizza un profilo assicurando che abbia tutti i campi
 */
export function normalizzaProfilo(profilo) {
    return {
        id: profilo.id || `OP_${Date.now()}`,
        nome: profilo.nome || "",
        ruolo: profilo.ruolo || "infermiere",
        ruoloCustom: profilo.ruoloCustom || null,
        sedePrincipale: profilo.sedePrincipale || null,
        sediSecondarie: profilo.sediSecondarie || [],
        contratto: {
            tipo: profilo.contratto?.tipo || "full-time",
            oreSettimanali: profilo.contratto?.oreSettimanali || 40
        },
        preferenze: {
            sedePreferita: profilo.preferenze?.sedePreferita || null,
            evitaSede: profilo.preferenze?.evitaSede || null,
            evitaTurni: profilo.preferenze?.evitaTurni || [],
            preferenzeTurni: profilo.preferenze?.preferenzeTurni || {},
            giorniPreferiti: profilo.preferenze?.giorniPreferiti || [],
            giorniDaEvitare: profilo.preferenze?.giorniDaEvitare || [],
            regole: profilo.preferenze?.regole || []
        },
        vincoli: {
            maxOreSettimanali: profilo.vincoli?.maxOreSettimanali || null,
            maxGiorniConsecutivi: profilo.vincoli?.maxGiorniConsecutivi || null,
            minRiposoOre: profilo.vincoli?.minRiposoOre || 11,
            regole: profilo.vincoli?.regole || []
        }
    };
}

/**
 * Ottiene il ruolo display dell'operatore
 * Se ruolo="altro", ritorna il ruoloCustom, altrimenti la label dal ruolo predefinito
 */
export function getRuoloDisplay(profilo) {
    if (!profilo) return "";

    if (profilo.ruolo === "altro" && profilo.ruoloCustom) {
        return profilo.ruoloCustom;
    }

    const ruoloPredefinito = RUOLI_PREDEFINITI.find(r => r.value === profilo.ruolo);
    return ruoloPredefinito ? ruoloPredefinito.label : profilo.ruolo || "Infermiere";
}

/**
 * Crea una nuova regola vuota
 */
export function nuovaRegola(tipo = "preferenza") {
    return {
        id: `RULE_${Date.now()}`,
        tipo,
        descrizione: "",
        condizione: {
            campo: "",
            operatore: "equals",
            valore: null
        },
        gravita: tipo === "preferenza" ? "info" : "warning",
        messaggio: "",
        attiva: true
    };
}

/**
 * Valida una regola personalizzata
 */
export function validaRegola(regola) {
    const errori = [];

    if (!regola.id) errori.push("ID regola mancante");
    if (!["preferenza", "vincolo"].includes(regola.tipo)) errori.push("Tipo regola non valido");
    if (!regola.descrizione || regola.descrizione.trim() === "") errori.push("Descrizione regola mancante");
    if (!regola.condizione?.campo) errori.push("Campo condizione mancante");
    if (!regola.condizione?.operatore) errori.push("Operatore condizione mancante");
    if (regola.condizione?.valore === null || regola.condizione?.valore === "") errori.push("Valore condizione mancante");
    if (!regola.messaggio || regola.messaggio.trim() === "") errori.push("Messaggio regola mancante");

    return errori;
}
