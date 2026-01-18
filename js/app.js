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
    console.log("🏥 Inizializzazione Gestione Turni Ospedale v3.7");

    // 1. Inizializza stato
    initState();

    // 2. Carica dati da localStorage
    initStorage();

    // 3. Renderizza UI
    renderTurniBar();
    renderMese();

    // 4. Setup shortcuts tastiera
    initKeyboardShortcuts();

    // 5. Setup toggle footer
    initFooterToggle();

    console.log("✅ Applicazione pronta");
}

/**
 * Inizializza il sistema di toggle per nascondere/mostrare il footer
 */
function initFooterToggle() {
    const footer = document.getElementById('footerBar');
    const toggleBtn = document.getElementById('toggleFooter');
    const showBtn = document.getElementById('showFooter');

    if (!footer || !toggleBtn || !showBtn) {
        console.warn('Footer toggle buttons not found');
        return;
    }

    // Carica stato salvato
    const isHidden = localStorage.getItem('footerHidden') === 'true';
    if (isHidden) {
        footer.classList.add('hidden-footer');
        showBtn.classList.remove('hidden');
    }

    // Toggle dal pulsante nel footer
    toggleBtn.addEventListener('click', () => {
        footer.classList.add('hidden-footer');
        showBtn.classList.remove('hidden');
        localStorage.setItem('footerHidden', 'true');
    });

    // Mostra footer dal pulsante esterno
    showBtn.addEventListener('click', () => {
        footer.classList.remove('hidden-footer');
        showBtn.classList.add('hidden');
        localStorage.setItem('footerHidden', 'false');
    });
}

/**
 * Esponi funzione toggle footer globalmente (opzionale)
 */
window.toggleFooter = function() {
    const footer = document.getElementById('footerBar');
    const showBtn = document.getElementById('showFooter');

    if (footer.classList.contains('hidden-footer')) {
        footer.classList.remove('hidden-footer');
        showBtn.classList.add('hidden');
        localStorage.setItem('footerHidden', 'false');
    } else {
        footer.classList.add('hidden-footer');
        showBtn.classList.remove('hidden');
        localStorage.setItem('footerHidden', 'true');
    }
};

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
