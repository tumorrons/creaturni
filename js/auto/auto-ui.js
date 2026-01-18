/**
 * auto-ui.js
 * Interfaccia utente per la generazione automatica turni
 *
 * Filosofia:
 * - Trasparenza: utente vede cosa succederà PRIMA di generare
 * - Controllo: parametri espliciti, bozze modificabili
 * - Feedback: mostra risultati con motivazioni chiare
 */

import { generaBozza } from './auto-engine.js';
import { validaBozza, confidenzaToLabel } from './auto-schema.js';
import { salvaBozzaGenerazione, caricaBozzaGenerazione, eliminaBozzaGenerazione, salvaTurno } from '../storage.js';
import { getState, setMostraBozza, setMeseCorrente, setAnnoCorrente } from '../state.js';
import { renderMese } from '../render/mese.js';

console.log('🤖 [AUTO-UI] Modulo caricato correttamente');

/**
 * Renderizza la vista principale di generazione
 */
export function renderAutoView() {
    console.log('🤖 [AUTO-UI] renderAutoView() chiamata');

    // Quando si torna alla vista Generazione, disattiva visualizzazione bozza
    // (a meno che non sia stata scartata/applicata prima)
    setMostraBozza(false);

    const container = document.getElementById('auto');
    if (!container) return;

    const { operatori, ambulatori, turni } = getState();
    const bozzaEsistente = caricaBozzaGenerazione();

    // Se esiste già una bozza attiva, mostra quella
    if (bozzaEsistente && bozzaEsistente.stato === 'draft') {
        renderBozzaAttiva(container, bozzaEsistente);
        return;
    }

    // Altrimenti mostra il pannello parametri
    renderPannelloParametri(container);
}

/**
 * Renderizza il pannello per configurare i parametri di generazione
 */
function renderPannelloParametri(container) {
    const { ambulatori } = getState();
    const oggi = new Date();
    const meseCorrente = oggi.getMonth();
    const annoCorrente = oggi.getFullYear();

    container.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
            <h2 style="margin-bottom: 10px;">🤖 Generazione Automatica Turni</h2>
            <p style="color: #666; margin-bottom: 30px;">
                Genera una bozza di turni basata su profili operatori, preferenze, vincoli e regole di copertura.
                La bozza è sempre modificabile e non sovrascrive i turni esistenti senza tua conferma.
            </p>

            <!-- Periodo -->
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin-top: 0; font-size: 16px;">📅 Periodo</h3>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <label style="flex: 1;">
                        Mese:
                        <select id="auto-mese" style="width: 100%; padding: 8px; margin-top: 5px;">
                            ${generaOpzioniMese(meseCorrente)}
                        </select>
                    </label>
                    <label style="flex: 1;">
                        Anno:
                        <select id="auto-anno" style="width: 100%; padding: 8px; margin-top: 5px;">
                            ${generaOpzioniAnno(annoCorrente)}
                        </select>
                    </label>
                </div>
            </div>

            <!-- Ambito -->
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin-top: 0; font-size: 16px;">🎯 Ambito</h3>
                <label style="display: block; margin-bottom: 10px;">
                    <input type="radio" name="auto-ambito" value="solo-vuoti" checked>
                    Solo giorni senza turni (raccomandato)
                </label>
                <label style="display: block; margin-bottom: 10px;">
                    <input type="radio" name="auto-ambito" value="rigenera-tutto">
                    Rigenera tutto il mese (sostituisce turni esistenti)
                </label>
                <label style="display: block;">
                    Filtra per ambulatorio:
                    <select id="auto-ambulatorio" style="padding: 8px; margin-left: 10px;">
                        <option value="">Tutti gli ambulatori</option>
                        ${Object.entries(ambulatori).map(([cod, amb]) =>
                            `<option value="${cod}">${amb.nome} (${cod})</option>`
                        ).join('')}
                    </select>
                </label>
            </div>

            <!-- Regole -->
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin-top: 0; font-size: 16px;">⚙️ Regole da usare</h3>
                <label style="display: block; margin-bottom: 10px;">
                    <input type="checkbox" id="auto-usa-copertura" checked>
                    Regole di copertura (identifica quali turni servono)
                </label>
                <label style="display: block; margin-bottom: 10px;">
                    <input type="checkbox" id="auto-usa-vincoli" checked>
                    Vincoli operatore (es. max ore settimanali, riposo minimo)
                </label>
                <label style="display: block;">
                    <input type="checkbox" id="auto-usa-preferenze" checked>
                    Preferenze operatore (es. sede preferita, turni evitati)
                </label>
            </div>

            <!-- Info Box -->
            <div style="background: #e3f2fd; padding: 15px; border-left: 4px solid #2196f3; margin-bottom: 20px;">
                <strong>💡 Come funziona:</strong>
                <ul style="margin: 10px 0 0 20px; padding: 0;">
                    <li>Analizza ogni giorno del mese selezionato</li>
                    <li>Identifica quali turni servono (da regole copertura)</li>
                    <li>Valuta ogni operatore con un punteggio deterministico</li>
                    <li>Assegna il turno all'operatore con il punteggio più alto</li>
                    <li>Genera una <strong>bozza modificabile</strong>, mai definitiva</li>
                </ul>
            </div>

            <!-- Azioni -->
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button
                    onclick="window.avviaGenerazioneBozza()"
                    class="config-btn"
                    style="background: #4caf50; font-size: 16px; padding: 12px 24px;"
                >
                    ▶️ Genera Bozza
                </button>
            </div>
        </div>
    `;
}

/**
 * Renderizza una bozza attiva con risultati e azioni
 */
function renderBozzaAttiva(container, bozza) {
    const { operatori, ambulatori, turni } = getState();
    const { periodo, metadata } = bozza;
    const nomeMese = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][periodo.mese];

    // Raggruppa turni per operatore per statistiche
    const turniPerOperatore = {};
    bozza.turni.forEach(t => {
        if (!turniPerOperatore[t.operatore]) {
            turniPerOperatore[t.operatore] = [];
        }
        turniPerOperatore[t.operatore].push(t);
    });

    container.innerHTML = `
        <div style="max-width: 1000px; margin: 0 auto; padding: 20px;">
            <h2 style="margin-bottom: 10px;">✅ Bozza Generata</h2>
            <p style="color: #666; margin-bottom: 20px;">
                Periodo: <strong>${nomeMese} ${periodo.anno}</strong> •
                Generata il ${new Date(metadata.timestamp).toLocaleString('it-IT')}
            </p>

            <!-- Statistiche -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px;">
                <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 32px; font-weight: bold; color: #4caf50;">${metadata.statistiche.turniGenerati}</div>
                    <div style="color: #666; margin-top: 5px;">Turni Generati</div>
                </div>
                <div style="background: #fff3e0; padding: 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 32px; font-weight: bold; color: #ff9800;">${metadata.statistiche.slotVuoti}</div>
                    <div style="color: #666; margin-top: 5px;">Slot Rimasti Vuoti</div>
                </div>
                <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 32px; font-weight: bold; color: #2196f3;">${Object.keys(turniPerOperatore).length}</div>
                    <div style="color: #666; margin-top: 5px;">Operatori Coinvolti</div>
                </div>
            </div>

            <!-- Istruzioni -->
            <div style="background: #fff9c4; padding: 15px; border-left: 4px solid #fbc02d; margin-bottom: 20px;">
                <strong>👉 Prossimi passi:</strong>
                <ol style="margin: 10px 0 0 20px; padding: 0;">
                    <li>Vai alla <strong>Vista Mese</strong> per visualizzare i turni generati (bordo tratteggiato 🤖)</li>
                    <li>Controlla le assegnazioni e le motivazioni passando sopra i turni</li>
                    <li>Modifica manualmente se necessario</li>
                    <li>Quando sei soddisfatto, clicca <strong>"✅ Applica Bozza"</strong> qui sotto</li>
                </ol>
            </div>

            <!-- Dettagli turni generati -->
            <details style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <summary style="cursor: pointer; font-weight: bold; margin-bottom: 10px;">
                    📋 Dettaglio turni generati (${bozza.turni.length})
                </summary>
                <div style="max-height: 400px; overflow-y: auto; margin-top: 10px;">
                    ${renderDettaglioTurni(bozza.turni, operatori, ambulatori, turni)}
                </div>
            </details>

            <!-- Azioni -->
            <div style="display: flex; gap: 10px; justify-content: space-between; align-items: center;">
                <button
                    onclick="window.scartaBozza()"
                    class="config-btn"
                    style="background: #999;"
                >
                    ✖️ Scarta Bozza
                </button>
                <div style="display: flex; gap: 10px;">
                    <button
                        onclick="window.vaiVistaMese()"
                        class="config-btn"
                        style="background: #2196f3;"
                    >
                        👁️ Visualizza in Vista Mese
                    </button>
                    <button
                        onclick="window.applicaBozza()"
                        class="config-btn"
                        style="background: #4caf50; font-size: 16px; padding: 12px 24px;"
                    >
                        ✅ Applica Bozza
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Renderizza tabella dettaglio turni
 */
function renderDettaglioTurni(turniGenerati, operatori, ambulatori, turni) {
    if (turniGenerati.length === 0) {
        return '<p style="color: #999; text-align: center;">Nessun turno generato</p>';
    }

    return `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #e0e0e0;">
                    <th style="padding: 10px; text-align: left;">Giorno</th>
                    <th style="padding: 10px; text-align: left;">Turno</th>
                    <th style="padding: 10px; text-align: left;">Ambulatorio</th>
                    <th style="padding: 10px; text-align: left;">Operatore</th>
                    <th style="padding: 10px; text-align: center;">Confidenza</th>
                    <th style="padding: 10px; text-align: left;">Motivazioni</th>
                </tr>
            </thead>
            <tbody>
                ${turniGenerati.map(t => {
                    const op = operatori.find(o => o.id === t.operatore);
                    const amb = ambulatori[t.ambulatorio];
                    const turno = turni[t.turno];
                    const confLabel = confidenzaToLabel(t.confidenza);
                    const confColor = t.confidenza >= 0.75 ? '#4caf50' : t.confidenza >= 0.5 ? '#ff9800' : '#f44336';

                    return `
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 10px;">${t.giorno}</td>
                            <td style="padding: 10px;">${t.turno} (${turno?.nome || '-'})</td>
                            <td style="padding: 10px;">${amb?.nome || t.ambulatorio}</td>
                            <td style="padding: 10px;">${op?.nome || t.operatore}</td>
                            <td style="padding: 10px; text-align: center;">
                                <span style="background: ${confColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                    ${confLabel} (${(t.confidenza * 100).toFixed(0)}%)
                                </span>
                            </td>
                            <td style="padding: 10px; font-size: 13px;">
                                ${t.motivazioni.length > 0 ? t.motivazioni.join(', ') : '-'}
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Genera opzioni mesi per select
 */
function generaOpzioniMese(meseCorrente) {
    const mesi = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    return mesi.map((nome, i) =>
        `<option value="${i}" ${i === meseCorrente ? 'selected' : ''}>${nome}</option>`
    ).join('');
}

/**
 * Genera opzioni anni per select (anno corrente ± 2)
 */
function generaOpzioniAnno(annoCorrente) {
    const anni = [annoCorrente - 1, annoCorrente, annoCorrente + 1, annoCorrente + 2];
    return anni.map(anno =>
        `<option value="${anno}" ${anno === annoCorrente ? 'selected' : ''}>${anno}</option>`
    ).join('');
}

// ============= AZIONI GLOBALI =============

/**
 * Avvia la generazione della bozza
 */
window.avviaGenerazioneBozza = function() {
    console.log('[AUTO-UI] Avvio generazione bozza...');

    // Leggi parametri dal form
    const mese = parseInt(document.getElementById('auto-mese').value);
    const anno = parseInt(document.getElementById('auto-anno').value);
    const ambito = document.querySelector('input[name="auto-ambito"]:checked').value;
    const ambulatorioFiltro = document.getElementById('auto-ambulatorio').value || null;
    const usaCopertura = document.getElementById('auto-usa-copertura').checked;
    const usaVincoli = document.getElementById('auto-usa-vincoli').checked;
    const usaPreferenze = document.getElementById('auto-usa-preferenze').checked;

    const parametri = {
        soloGiorniVuoti: ambito === 'solo-vuoti',
        rigeneraTutto: ambito === 'rigenera-tutto',
        ambulatorioFiltro,
        usaCopertura,
        usaVincoli,
        usaPreferenze
    };

    // Conferma se rigenera tutto
    if (parametri.rigeneraTutto) {
        const conferma = confirm(
            '⚠️ ATTENZIONE\n\n' +
            'Stai per rigenerare TUTTO il mese, sostituendo eventuali turni esistenti.\n\n' +
            'Sei sicuro di voler procedere?'
        );
        if (!conferma) {
            console.log('[AUTO-UI] Generazione annullata dall\'utente');
            return;
        }
    }

    // Mostra loading
    const container = document.getElementById('auto');
    container.innerHTML = `
        <div style="text-align: center; padding: 100px 20px;">
            <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
            <h2>Generazione in corso...</h2>
            <p style="color: #666;">Analisi profili, calcolo score, assegnazione turni...</p>
        </div>
    `;

    // Genera bozza (asincrono per non bloccare UI)
    setTimeout(() => {
        try {
            const bozza = generaBozza(mese, anno, parametri);

            // Valida bozza
            const errori = validaBozza(bozza);
            if (errori.length > 0) {
                alert('Errori nella bozza generata:\n' + errori.join('\n'));
                renderAutoView();
                return;
            }

            // Salva bozza
            salvaBozzaGenerazione(bozza);
            console.log('[AUTO-UI] Bozza generata e salvata:', bozza);

            // Mostra risultati
            renderAutoView();

        } catch (error) {
            console.error('[AUTO-UI] Errore durante generazione:', error);
            alert('Errore durante la generazione:\n' + error.message);
            renderAutoView();
        }
    }, 100);
};

/**
 * Scarta la bozza corrente
 */
window.scartaBozza = function() {
    const conferma = confirm('Sei sicuro di voler scartare questa bozza?\n\nI turni non verranno salvati.');
    if (!conferma) return;

    // Controlla se la vista mese è attiva
    const meseContainer = document.getElementById('mese');
    const vistaMeseAttiva = meseContainer && !meseContainer.classList.contains('hidden');

    // Disattiva visualizzazione bozza
    setMostraBozza(false);

    // Elimina bozza
    eliminaBozzaGenerazione();
    console.log('[AUTO-UI] Bozza scartata e modalità visualizzazione disattivata');

    // Se la vista mese era attiva, ricalcola avvisi con turni ufficiali
    if (vistaMeseAttiva) {
        Promise.all([
            import('../render/mese.js'),
            import('../render/coverage-panel.js')
        ]).then(([meseModule, coverageModule]) => {
            const { annoCorrente, meseCorrente } = getState();

            // Re-renderizza vista mese senza bozza
            meseModule.renderMese();
            console.log('[AUTO-UI] Vista Mese re-renderizzata dopo scarto bozza');

            // Ricalcola avvisi con turni ufficiali
            if (meseContainer) {
                coverageModule.renderCoveragePanel(meseContainer, annoCorrente, meseCorrente);
                console.log('[AUTO-UI] Avvisi copertura ricalcolati con turni ufficiali');
            }
        });
    } else {
        // Torna al pannello parametri
        renderAutoView();
    }
};

/**
 * Applica la bozza ai turni reali
 */
window.applicaBozza = function() {
    const bozza = caricaBozzaGenerazione();
    if (!bozza) {
        alert('Nessuna bozza da applicare');
        return;
    }

    if (bozza.stato !== 'draft') {
        alert('Questa bozza è già stata applicata o scartata');
        return;
    }

    const conferma = confirm(
        `Applicare ${bozza.turni.length} turni generati?\n\n` +
        'I turni verranno salvati definitivamente.\n' +
        'Potrai comunque modificarli manualmente in seguito.'
    );
    if (!conferma) return;

    console.log('[AUTO-UI] Inizio applicazione bozza:', bozza.turni.length, 'turni');

    // Salva tutti i turni dalla bozza in localStorage
    const anno = bozza.periodo.anno;
    const mese = bozza.periodo.mese;
    let salvati = 0;

    bozza.turni.forEach(t => {
        // Formato: "AMBULATORIO_TURNO" (es. "BUD_BM")
        const valoreTurno = `${t.ambulatorio}_${t.turno}`;
        salvaTurno(t.operatore, t.giorno, valoreTurno, anno, mese);
        salvati++;
    });

    console.log(`[AUTO-UI] Salvati ${salvati} turni in localStorage`);

    // Aggiorna stato bozza a "applied"
    bozza.stato = 'applied';
    bozza.metadata.timestampApplicazione = Date.now();
    salvaBozzaGenerazione(bozza);

    console.log('[AUTO-UI] Bozza marcata come applicata');

    // Nascondi visualizzazione bozza (ora i turni sono reali)
    setMostraBozza(false);

    // Naviga alla vista mese per mostrare i turni applicati
    setMeseCorrente(mese);
    setAnnoCorrente(anno);

    // Cambia vista
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById('mese').classList.remove('hidden');

    // Renderizza la vista mese aggiornata
    Promise.all([
        import('../render/mese.js'),
        import('../render/coverage-panel.js')
    ]).then(([meseModule, coverageModule]) => {
        meseModule.renderMese(anno, mese);
        console.log('[AUTO-UI] Vista Mese renderizzata con turni applicati');

        // Ricalcola avvisi copertura con turni ufficiali (mostraBozza è false ora)
        const meseContainer = document.getElementById('mese');
        if (meseContainer) {
            coverageModule.renderCoveragePanel(meseContainer, anno, mese);
            console.log('[AUTO-UI] Avvisi copertura ricalcolati dopo applicazione');
        }

        alert(
            `✅ Bozza applicata con successo!\n\n` +
            `${salvati} turni sono stati salvati definitivamente.\n\n` +
            `Puoi continuare a modificarli manualmente se necessario.`
        );

        console.log('[AUTO-UI] Applicazione bozza completata');
    });
};

/**
 * Naviga alla vista Mese mostrando la bozza
 */
window.vaiVistaMese = function() {
    console.log('[AUTO-UI] vaiVistaMese chiamata');

    const bozza = caricaBozzaGenerazione();
    if (bozza && bozza.periodo) {
        // Sincronizza mese/anno corrente con la bozza
        setMeseCorrente(bozza.periodo.mese);
        setAnnoCorrente(bozza.periodo.anno);
        console.log(`[AUTO-UI] Sincronizzato periodo: ${bozza.periodo.anno}-${bozza.periodo.mese + 1}`);
    }

    // Cambia vista (showView disattiva mostraBozza, lo riattiveremo dopo)
    window.showView('mese');

    // Attiva modalità visualizzazione bozza DOPO il cambio vista
    setMostraBozza(true);
    console.log('[AUTO-UI] Modalità mostraBozza attivata');

    // Re-renderizza la vista mese con la bozza attiva
    Promise.all([
        import('../render/mese.js'),
        import('../render/coverage-panel.js')
    ]).then(([meseModule, coverageModule]) => {
        const { annoCorrente, meseCorrente } = getState();

        // Renderizza vista mese con bozza
        meseModule.renderMese();
        console.log('[AUTO-UI] Vista Mese re-renderizzata con bozza');

        // Ricalcola avvisi copertura con la bozza attiva
        const meseContainer = document.getElementById('mese');
        if (meseContainer) {
            coverageModule.renderCoveragePanel(meseContainer, annoCorrente, meseCorrente);
            console.log('[AUTO-UI] Avvisi copertura ricalcolati con bozza');
        }
    });
};
