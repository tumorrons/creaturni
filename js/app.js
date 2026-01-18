/**
 * App.js - Bootstrap e inizializzazione applicazione
 *
 * Questo è il PUNTO DI INGRESSO dell'app.
 * Inizializza stato, storage, UI e rende la prima vista.
 */

import { initState } from './state.js';
import { initStorage } from './storage.js';
import {
    renderTurniBar,
    showView,
    meseSuccessivo,
    mesePrecedente,
    annoSuccessivo,
    annoPrecedente,
    initKeyboardShortcuts,
    assegnaTurno
} from './ui.js';
import { renderMese } from './render/mese.js';
import {
    salvaNotaInline,
    eliminaNotaInline,
    chiudiEditorInline,
    mostraEditorNotaInline
} from './render/note-editor.js';

/**
 * Inizializza l'applicazione
 */
function init() {
    console.log("🏥 Inizializzazione Gestione Turni Ospedale v3.3");

    // 1. Inizializza stato
    initState();

    // 2. Carica dati da localStorage
    initStorage();

    // 3. Renderizza UI
    renderTurniBar();
    renderMese();

    // 4. Setup shortcuts tastiera
    initKeyboardShortcuts();

    console.log("✅ Applicazione pronta");
}

/**
 * Esponi funzioni globali per compatibilità con onclick HTML
 */
window.showView = showView;
window.meseSuccessivo = meseSuccessivo;
window.mesePrecedente = mesePrecedente;
window.annoSuccessivo = annoSuccessivo;
window.annoPrecedente = annoPrecedente;
window.assegnaTurno = assegnaTurno;
window.salvaNotaInline = salvaNotaInline;
window.eliminaNotaInline = eliminaNotaInline;
window.chiudiEditorInline = chiudiEditorInline;
window.mostraEditorNotaInline = mostraEditorNotaInline;

/**
 * Avvia l'app quando il DOM è pronto
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
