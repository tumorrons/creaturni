/**
 * Calendar.js - Logica calendario e date
 *
 * Tutte le funzioni per calcolo giorni, mesi, navigazione temporale.
 * NESSUN accesso a DOM o localStorage.
 */

/**
 * Restituisce il numero di giorni nel mese specificato
 */
export function giorniNelMese(anno, mese) {
    return new Date(anno, mese + 1, 0).getDate();
}

/**
 * Restituisce il primo giorno del mese (0=Lun, 6=Dom)
 */
export function primoGiornoMese(anno, mese) {
    let day = new Date(anno, mese, 1).getDay();
    return day === 0 ? 6 : day - 1; // Converte: Dom=0 → 6, Lun=1 → 0
}

/**
 * Restituisce il nome del mese in italiano
 */
export function getNomeMese(mese) {
    const mesi = [
        "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
        "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
    ];
    return mesi[mese];
}

/**
 * Restituisce i nomi brevi dei giorni della settimana
 */
export function getNomiGiorniSettimana() {
    return ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
}

/**
 * Restituisce i nomi completi dei giorni della settimana
 */
export function getNomiGiorniSettimanaPieni() {
    return ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
}

/**
 * Data la data, restituisce il nome del giorno
 */
export function getNomeGiorno(anno, mese, giorno) {
    const giorni = getNomiGiorniSettimanaPieni();
    const data = new Date(anno, mese, giorno);
    return giorni[data.getDay()];
}
