/**
 * rule-builder.js - UI per creare/modificare regole personalizzate
 *
 * Modal form per costruire regole data-driven senza codice.
 */

console.log('[DEBUG] 🔧 rule-builder.js caricato');

import { turni } from '../state.js';
import { OPERATORI_REGOLA, CAMPI_REGOLA, nuovaRegola, validaRegola } from '../profili.js';

console.log('[DEBUG] 🔧 rule-builder.js imports OK');

/**
 * Mostra modal Rule Builder
 *
 * @param {String} tipo - "preferenza" | "vincolo"
 * @param {Function} onSave - Callback(regola) quando salva
 * @param {Object} regolaEsistente - Regola da modificare (null se nuova)
 */
export function mostraRuleBuilder(tipo, onSave, regolaEsistente = null) {
    console.log(`[DEBUG] mostraRuleBuilder: tipo="${tipo}", isEdit=${!!regolaEsistente}`);

    const regola = regolaEsistente || nuovaRegola(tipo);
    const isEdit = !!regolaEsistente;

    console.log(`[DEBUG] Regola da editare:`, regola);

    // Crea modal
    let modal = document.getElementById("rule-builder-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "rule-builder-modal";
        modal.className = "modal";
        document.body.appendChild(modal);
    }

    // Assicura visibilità con inline styles (fallback se CSS mancante)
    modal.style.cssText = `
        display: block;
        position: fixed;
        z-index: 10000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        overflow: auto;
        padding: 20px;
    `;

    // Colore sezione
    const coloreSezione = tipo === "preferenza" ? "#e8f5e9" : "#ffebee";
    const titoloIcon = tipo === "preferenza" ? "🟢" : "🔴";

    modal.innerHTML = `
        <div class="modal-content" style="
            background: white;
            margin: 40px auto;
            padding: 30px;
            border-radius: 8px;
            max-width: 700px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            position: relative;
        ">
            <span class="close" onclick="document.getElementById('rule-builder-modal').style.display='none'" style="
                position: absolute;
                right: 20px;
                top: 15px;
                font-size: 28px;
                font-weight: bold;
                color: #999;
                cursor: pointer;
                line-height: 1;
            " onmouseover="this.style.color='#000'" onmouseout="this.style.color='#999'">&times;</span>

            <h3 style="margin-top:0">${titoloIcon} ${isEdit ? 'Modifica' : 'Nuova'} Regola ${tipo === 'preferenza' ? 'Preferenza' : 'Vincolo'}</h3>

            <p class="info-text" style="margin-bottom:20px">
                ${tipo === 'preferenza'
                    ? 'Le preferenze guidano le scelte ma non bloccano mai le assegnazioni.'
                    : 'I vincoli segnalano limiti operativi forti ma non bloccano mai le assegnazioni.'}
            </p>

            <!-- Sezione: Descrizione -->
            <div style="background:${coloreSezione};padding:15px;border-radius:4px;margin-bottom:15px">
                <h4 style="margin-top:0;font-size:14px">📝 Descrizione</h4>
                <input
                    type="text"
                    id="rb-descrizione"
                    placeholder="es: Evita turno pomeriggio"
                    value="${regola.descrizione}"
                    style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px"
                >
                <small style="color:#666;display:block;margin-top:5px">
                    Nome breve e descrittivo per identificare la regola
                </small>
            </div>

            <!-- Sezione: Condizione -->
            <div style="background:${coloreSezione};padding:15px;border-radius:4px;margin-bottom:15px">
                <h4 style="margin-top:0;font-size:14px">⚙️ Condizione</h4>

                <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center">
                    <!-- Campo -->
                    <div>
                        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px">Campo</label>
                        <select id="rb-campo" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px" onchange="window.aggiornaValoreInput()">
                            <option value="">Seleziona...</option>
                            ${Object.values(CAMPI_REGOLA).map(campo => `
                                <option value="${campo.value}" data-tipo="${campo.tipo}" ${regola.condizione.campo === campo.value ? 'selected' : ''}>
                                    ${campo.label}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Operatore -->
                    <div>
                        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px">è</label>
                        <select id="rb-operatore" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px">
                            ${Object.values(OPERATORI_REGOLA).map(op => `
                                <option value="${op.value}" ${regola.condizione.operatore === op.value ? 'selected' : ''}>
                                    ${op.label}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Valore -->
                    <div>
                        <label style="display:block;font-size:12px;color:#666;margin-bottom:4px">Valore</label>
                        <div id="rb-valore-container">
                            ${renderInputValore(regola.condizione.campo, regola.condizione.valore)}
                        </div>
                    </div>
                </div>

                <small style="color:#666;display:block;margin-top:10px">
                    💡 La regola scatterà quando questa condizione è verificata
                </small>
            </div>

            <!-- Sezione: Effetto -->
            <div style="background:${coloreSezione};padding:15px;border-radius:4px;margin-bottom:15px">
                <h4 style="margin-top:0;font-size:14px">⚡ Effetto</h4>

                <div style="margin-bottom:10px">
                    <label style="display:block;font-size:12px;color:#666;margin-bottom:4px">Gravità</label>
                    <select id="rb-gravita" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px">
                        <option value="info" ${regola.gravita === 'info' ? 'selected' : ''}>ℹ️ Info (suggerimento)</option>
                        <option value="warning" ${regola.gravita === 'warning' ? 'selected' : ''}>⚠️ Warning (attenzione)</option>
                        <option value="error" ${regola.gravita === 'error' ? 'selected' : ''}>🔴 Error (sconsigliato fortemente)</option>
                    </select>
                </div>

                <div>
                    <label style="display:block;font-size:12px;color:#666;margin-bottom:4px">Messaggio</label>
                    <textarea
                        id="rb-messaggio"
                        placeholder="es: Preferisce evitare il turno pomeriggio"
                        style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;min-height:60px"
                    >${regola.messaggio}</textarea>
                    <small style="color:#666;display:block;margin-top:5px">
                        Questo messaggio sarà mostrato all'utente quando la regola scatta
                    </small>
                </div>
            </div>

            <!-- Attiva/Disattiva -->
            <div style="margin-bottom:20px">
                <label style="display:inline-flex;align-items:center;cursor:pointer">
                    <input type="checkbox" id="rb-attiva" ${regola.attiva ? 'checked' : ''} style="margin-right:8px">
                    <span>Regola attiva</span>
                </label>
                <small style="color:#666;display:block;margin-top:5px;margin-left:24px">
                    Le regole disattivate vengono ignorate
                </small>
            </div>

            <!-- Azioni -->
            <div style="display:flex;gap:10px;justify-content:flex-end">
                <button
                    class="config-btn"
                    onclick="document.getElementById('rule-builder-modal').style.display='none'"
                    style="background:#999"
                >
                    Annulla
                </button>
                <button
                    class="config-btn config-add"
                    onclick="window.salvaRegolaBuilder('${regola.id}', '${tipo}')"
                >
                    ${isEdit ? 'Salva Modifiche' : 'Crea Regola'}
                </button>
            </div>
        </div>
    `;

    // Store callback per uso globale
    window.__ruleBuilderCallback = onSave;
    console.log(`[DEBUG] Callback salvata:`, typeof onSave);
}

/**
 * Renderizza input valore basato sul tipo di campo
 */
function renderInputValore(campo, valoreCorrente) {
    const campoDef = Object.values(CAMPI_REGOLA).find(c => c.value === campo);
    const tipo = campoDef?.tipo || 'string';

    if (campo === 'turno.codice') {
        // Dropdown turni disponibili
        return `
            <select id="rb-valore" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px">
                <option value="">Seleziona turno...</option>
                ${Object.entries(turni).map(([codice, turno]) => `
                    <option value="${codice}" ${valoreCorrente === codice ? 'selected' : ''}>
                        ${codice} - ${turno.nome}
                    </option>
                `).join('')}
            </select>
        `;
    } else if (campo === 'giornoSettimana') {
        // Dropdown giorni settimana
        const giorni = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
        const labels = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
        return `
            <select id="rb-valore" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px">
                <option value="">Seleziona giorno...</option>
                ${giorni.map((g, i) => `
                    <option value="${g}" ${valoreCorrente === g ? 'selected' : ''}>
                        ${labels[i]}
                    </option>
                `).join('')}
            </select>
        `;
    } else if (tipo === 'number') {
        // Input numerico
        return `
            <input
                type="number"
                id="rb-valore"
                value="${valoreCorrente || ''}"
                placeholder="es: 5"
                style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px"
            >
        `;
    } else {
        // Input testuale generico
        return `
            <input
                type="text"
                id="rb-valore"
                value="${valoreCorrente || ''}"
                placeholder="Inserisci valore..."
                style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px"
            >
        `;
    }
}

/**
 * Aggiorna dinamicamente input valore quando cambia il campo
 */
window.aggiornaValoreInput = function() {
    const campo = document.getElementById("rb-campo").value;
    const container = document.getElementById("rb-valore-container");
    container.innerHTML = renderInputValore(campo, null);
};

/**
 * Salva regola da Rule Builder
 */
window.salvaRegolaBuilder = function(idOriginale, tipoOriginale) {
    console.log(`[DEBUG] salvaRegolaBuilder chiamata: id="${idOriginale}", tipo="${tipoOriginale}"`);

    const descrizione = document.getElementById("rb-descrizione").value.trim();
    const campo = document.getElementById("rb-campo").value;
    const operatore = document.getElementById("rb-operatore").value;
    const valoreRaw = document.getElementById("rb-valore").value;
    const gravita = document.getElementById("rb-gravita").value;
    const messaggio = document.getElementById("rb-messaggio").value.trim();
    const attiva = document.getElementById("rb-attiva").checked;

    console.log(`[DEBUG] Form values:`, { descrizione, campo, operatore, valoreRaw, gravita, messaggio, attiva });

    // Converti valore al tipo corretto
    const campoDef = Object.values(CAMPI_REGOLA).find(c => c.value === campo);
    let valore = valoreRaw;
    if (campoDef?.tipo === 'number' && valoreRaw) {
        valore = parseFloat(valoreRaw);
    }

    // Costruisci regola - USA tipoOriginale NON gravità!
    const regola = {
        id: idOriginale,
        tipo: tipoOriginale,  // FIX: usa tipo passato, non derivato da gravità
        descrizione,
        condizione: {
            campo,
            operatore,
            valore
        },
        gravita,
        messaggio,
        attiva
    };

    console.log(`[DEBUG] Regola costruita:`, regola);

    // Valida
    const errori = validaRegola(regola);
    console.log(`[DEBUG] Errori validazione:`, errori);

    if (errori.length > 0) {
        console.error(`[ERROR] Validazione fallita:`, errori);
        alert("Errori nella regola:\n" + errori.join("\n"));
        return;
    }

    // Chiama callback
    console.log(`[DEBUG] Callback esistente:`, !!window.__ruleBuilderCallback);
    if (window.__ruleBuilderCallback) {
        console.log(`[DEBUG] Chiamata callback...`);
        window.__ruleBuilderCallback(regola);
    } else {
        console.error(`[ERROR] Callback non trovata!`);
    }

    // Chiudi modal
    document.getElementById("rule-builder-modal").style.display = "none";
};
