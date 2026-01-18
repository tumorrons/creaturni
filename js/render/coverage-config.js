/**
 * render/coverage-config.js - UI configurazione regole copertura
 *
 * Form completo per creare/modificare/eliminare regole di copertura.
 */

import { caricaRegole, salvaRegole, nuovaRegolaVuota, validaRegola, resetRegolaDefault } from '../coverage.js';
import { ambulatori, turni, getState } from '../state.js';
import { renderConfig } from './config.js';

/**
 * Renderizza la sezione configurazione regole
 */
export function renderCoverageConfigSection(container) {
    let section = document.createElement("div");
    section.id = "coverage-config";
    section.className = "config-section config-turni";
    section.style.marginTop = "20px";

    section.innerHTML = `<h4>📋 Regole di Copertura Turni</h4>`;

    let info = document.createElement("p");
    info.className = "info-text";
    info.textContent = "Le regole di copertura verificano che i turni richiesti siano assegnati. Gli avvisi sono SOLO informativi e non bloccano l'inserimento.";
    section.appendChild(info);

    // Carica regole
    const regole = caricaRegole();

    // Lista regole esistenti
    const listaContainer = document.createElement("div");
    listaContainer.style.marginBottom = "15px";

    if (regole.length === 0) {
        const noRegole = document.createElement("p");
        noRegole.className = "no-data";
        noRegole.textContent = "Nessuna regola configurata";
        listaContainer.appendChild(noRegole);
    } else {
        regole.forEach((regola, index) => {
            const item = renderRegolaItem(regola, index);
            listaContainer.appendChild(item);
        });
    }

    section.appendChild(listaContainer);

    // Bottoni azione
    const actions = document.createElement("div");
    actions.style.marginTop = "15px";
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.flexWrap = "wrap";

    const btnNuova = document.createElement("button");
    btnNuova.className = "config-btn config-add";
    btnNuova.textContent = "➕ Nuova Regola";
    btnNuova.onclick = () => window.mostraFormRegola();
    actions.appendChild(btnNuova);

    const btnReset = document.createElement("button");
    btnReset.className = "config-btn config-clear";
    btnReset.textContent = "🔄 Ripristina Default";
    btnReset.onclick = () => window.resetRegoleDefault();
    actions.appendChild(btnReset);

    section.appendChild(actions);

    container.appendChild(section);
}

/**
 * Renderizza singola regola
 */
function renderRegolaItem(regola, index) {
    const item = document.createElement("div");
    item.style.padding = "12px";
    item.style.marginBottom = "8px";
    item.style.background = regola.attiva ? "#f5f5f5" : "#fafafa";
    item.style.border = `1px solid ${regola.attiva ? '#ddd' : '#eee'}`;
    item.style.borderRadius = "4px";
    item.style.opacity = regola.attiva ? "1" : "0.6";
    item.style.display = "flex";
    item.style.justifyContent = "space-between";
    item.style.alignItems = "center";
    item.style.gap = "10px";

    // Info regola
    const infoDiv = document.createElement("div");
    infoDiv.style.flex = "1";

    const titleDiv = document.createElement("div");
    titleDiv.style.display = "flex";
    titleDiv.style.alignItems = "center";
    titleDiv.style.gap = "8px";
    titleDiv.style.marginBottom = "4px";

    const statusBadge = document.createElement("span");
    statusBadge.style.padding = "2px 6px";
    statusBadge.style.fontSize = "10px";
    statusBadge.style.borderRadius = "3px";
    statusBadge.style.fontWeight = "bold";
    if (regola.attiva) {
        statusBadge.textContent = "✓ Attiva";
        statusBadge.style.background = "#c8e6c9";
        statusBadge.style.color = "#2e7d32";
    } else {
        statusBadge.textContent = "○ Disattivata";
        statusBadge.style.background = "#e0e0e0";
        statusBadge.style.color = "#757575";
    }
    titleDiv.appendChild(statusBadge);

    const severityBadge = document.createElement("span");
    severityBadge.style.padding = "2px 6px";
    severityBadge.style.fontSize = "10px";
    severityBadge.style.borderRadius = "3px";
    severityBadge.style.fontWeight = "bold";
    if (regola.severita === "warning") {
        severityBadge.textContent = "⚠️ Warning";
        severityBadge.style.background = "#ffe0b2";
        severityBadge.style.color = "#e65100";
    } else {
        severityBadge.textContent = "ℹ️ Info";
        severityBadge.style.background = "#e3f2fd";
        severityBadge.style.color = "#1565c0";
    }
    titleDiv.appendChild(severityBadge);

    const titleText = document.createElement("strong");
    titleText.textContent = regola.descrizione;
    titleDiv.appendChild(titleText);

    infoDiv.appendChild(titleDiv);

    // Dettagli quando
    const dettagli = document.createElement("div");
    dettagli.style.fontSize = "12px";
    dettagli.style.color = "#666";
    dettagli.style.marginTop = "4px";
    dettagli.textContent = getDescrizioneQuando(regola.quando);
    infoDiv.appendChild(dettagli);

    // Richiesti
    const richiestiDiv = document.createElement("div");
    richiestiDiv.style.fontSize = "11px";
    richiestiDiv.style.color = "#888";
    richiestiDiv.style.marginTop = "4px";
    richiestiDiv.textContent = `Richiesti: ${regola.richiesti.map(r =>
        `${r.turno} × ${r.quantita}`
    ).join(', ')}`;
    infoDiv.appendChild(richiestiDiv);

    item.appendChild(infoDiv);

    // Azioni
    const actionsDiv = document.createElement("div");
    actionsDiv.style.display = "flex";
    actionsDiv.style.gap = "4px";

    const btnToggle = document.createElement("button");
    btnToggle.className = "config-btn";
    btnToggle.style.fontSize = "11px";
    btnToggle.style.padding = "4px 8px";
    btnToggle.textContent = regola.attiva ? "Disattiva" : "Attiva";
    btnToggle.style.background = regola.attiva ? "#9e9e9e" : "#4caf50";
    btnToggle.onclick = () => window.toggleRegolaAttiva(index);
    actionsDiv.appendChild(btnToggle);

    const btnEdit = document.createElement("button");
    btnEdit.className = "config-btn config-add";
    btnEdit.style.fontSize = "11px";
    btnEdit.style.padding = "4px 8px";
    btnEdit.textContent = "✏️";
    btnEdit.title = "Modifica";
    btnEdit.onclick = () => window.mostraFormRegola(index);
    actionsDiv.appendChild(btnEdit);

    const btnDelete = document.createElement("button");
    btnDelete.className = "config-btn config-remove";
    btnDelete.style.fontSize = "11px";
    btnDelete.style.padding = "4px 8px";
    btnDelete.textContent = "🗑️";
    btnDelete.title = "Elimina";
    btnDelete.onclick = () => window.eliminaRegola(index);
    actionsDiv.appendChild(btnDelete);

    item.appendChild(actionsDiv);

    return item;
}

/**
 * Genera descrizione leggibile della condizione "quando"
 */
function getDescrizioneQuando(quando) {
    const mesi = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    const giorni = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

    switch (quando.tipo) {
        case "giorno_specifico":
            return `📅 ${quando.giorno} ${mesi[quando.mese]}`;
        case "giorno_settimana":
            return `📅 Ogni ${giorni[quando.giornoSettimana]}`;
        case "intervallo_date":
            return `📅 Dal ${quando.da} al ${quando.a}`;
        default:
            return "Condizione non specificata";
    }
}

/**
 * Mostra form creazione/modifica regola
 */
window.mostraFormRegola = function(index = null) {
    const regole = caricaRegole();
    const regola = index !== null ? regole[index] : nuovaRegolaVuota();
    const isEdit = index !== null;

    // Crea overlay modale
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.background = "rgba(0,0,0,0.5)";
    overlay.style.zIndex = "1000";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.overflowY = "auto";
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    // Form container
    const formContainer = document.createElement("div");
    formContainer.style.background = "white";
    formContainer.style.padding = "25px";
    formContainer.style.borderRadius = "8px";
    formContainer.style.maxWidth = "600px";
    formContainer.style.width = "90%";
    formContainer.style.maxHeight = "90vh";
    formContainer.style.overflowY = "auto";
    formContainer.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";

    const title = document.createElement("h3");
    title.textContent = isEdit ? "✏️ Modifica Regola" : "➕ Nuova Regola";
    title.style.marginTop = "0";
    formContainer.appendChild(title);

    // Form
    const form = document.createElement("div");
    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.gap = "15px";

    // Campo Descrizione
    form.innerHTML += `
        <label style="font-weight:bold;font-size:13px">Descrizione:</label>
        <input type="text" id="regola-desc" value="${regola.descrizione || ''}"
               placeholder="Es: Il 1° gennaio devono essere coperti entrambi i mattini"
               style="padding:8px;border:1px solid #ccc;border-radius:4px;font-size:13px">
    `;

    // Severità
    form.innerHTML += `
        <label style="font-weight:bold;font-size:13px">Severità:</label>
        <select id="regola-severita" style="padding:8px;border:1px solid #ccc;border-radius:4px">
            <option value="info" ${regola.severita === 'info' ? 'selected' : ''}>ℹ️ Info</option>
            <option value="warning" ${regola.severita === 'warning' ? 'selected' : ''}>⚠️ Warning</option>
        </select>
    `;

    // Tipo condizione
    form.innerHTML += `
        <label style="font-weight:bold;font-size:13px">Quando si applica:</label>
        <select id="regola-tipo" style="padding:8px;border:1px solid #ccc;border-radius:4px" onchange="window.cambiaTimestamp()">
            <option value="giorno_specifico" ${regola.quando.tipo === 'giorno_specifico' ? 'selected' : ''}>Giorno specifico</option>
            <option value="giorno_settimana" ${regola.quando.tipo === 'giorno_settimana' ? 'selected' : ''}>Giorno della settimana</option>
            <option value="intervallo_date" ${regola.quando.tipo === 'intervallo_date' ? 'selected' : ''}>Intervallo di date</option>
        </select>
    `;

    // Container parametri condizione
    const condizioneDiv = document.createElement("div");
    condizioneDiv.id = "condizione-params";
    form.appendChild(condizioneDiv);

    // Turni richiesti
    const richiestiLabel = document.createElement("label");
    richiestiLabel.style.fontWeight = "bold";
    richiestiLabel.style.fontSize = "13px";
    richiestiLabel.style.marginTop = "10px";
    richiestiLabel.textContent = "Turni richiesti:";
    form.appendChild(richiestiLabel);

    const richiestiContainer = document.createElement("div");
    richiestiContainer.id = "richiesti-container";
    richiestiContainer.style.display = "flex";
    richiestiContainer.style.flexDirection = "column";
    richiestiContainer.style.gap = "8px";
    form.appendChild(richiestiContainer);

    const btnAggiungiRichiesto = document.createElement("button");
    btnAggiungiRichiesto.type = "button";
    btnAggiungiRichiesto.className = "config-btn config-add";
    btnAggiungiRichiesto.textContent = "➕ Aggiungi Turno Richiesto";
    btnAggiungiRichiesto.style.fontSize = "12px";
    btnAggiungiRichiesto.onclick = () => window.aggiungiRichiestoUI();
    form.appendChild(btnAggiungiRichiesto);

    // Attiva
    const attivaLabel = document.createElement("label");
    attivaLabel.style.display = "flex";
    attivaLabel.style.alignItems = "center";
    attivaLabel.style.gap = "8px";
    attivaLabel.style.cursor = "pointer";
    attivaLabel.innerHTML = `
        <input type="checkbox" id="regola-attiva" ${regola.attiva ? 'checked' : ''}>
        <span style="font-weight:bold;font-size:13px">Regola attiva</span>
    `;
    form.appendChild(attivaLabel);

    // Bottoni azione
    const actionsDiv = document.createElement("div");
    actionsDiv.style.display = "flex";
    actionsDiv.style.gap = "8px";
    actionsDiv.style.marginTop = "20px";

    const btnSalva = document.createElement("button");
    btnSalva.className = "config-btn config-add";
    btnSalva.textContent = "💾 Salva";
    btnSalva.onclick = () => {
        if (window.salvaRegolaForm(index)) {
            overlay.remove();
        }
    };
    actionsDiv.appendChild(btnSalva);

    const btnAnnulla = document.createElement("button");
    btnAnnulla.className = "config-btn config-clear";
    btnAnnulla.textContent = "✖ Annulla";
    btnAnnulla.onclick = () => overlay.remove();
    actionsDiv.appendChild(btnAnnulla);

    form.appendChild(actionsDiv);

    formContainer.appendChild(form);
    overlay.appendChild(formContainer);
    document.body.appendChild(overlay);

    // Inizializza dati regola
    window.regolaCorrente = { ...regola };

    // Renderizza condizione e richiesti
    window.renderCondizioneParams(regola.quando);
    regola.richiesti.forEach((r, i) => window.aggiungiRichiestoUI(r));
};

window.cambiaTimestamp = function() {
    const tipo = document.getElementById("regola-tipo").value;
    window.renderCondizioneParams({ tipo });
};

window.renderCondizioneParams = function(quando) {
    const container = document.getElementById("condizione-params");
    container.innerHTML = "";

    switch (quando.tipo) {
        case "giorno_specifico":
            container.innerHTML = `
                <div style="display:flex;gap:10px">
                    <div style="flex:1">
                        <label style="font-size:12px;color:#666">Giorno:</label>
                        <input type="number" id="quando-giorno" value="${quando.giorno || 1}" min="1" max="31"
                               style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px">
                    </div>
                    <div style="flex:1">
                        <label style="font-size:12px;color:#666">Mese:</label>
                        <select id="quando-mese" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px">
                            <option value="0" ${quando.mese === 0 ? 'selected' : ''}>Gennaio</option>
                            <option value="1" ${quando.mese === 1 ? 'selected' : ''}>Febbraio</option>
                            <option value="2" ${quando.mese === 2 ? 'selected' : ''}>Marzo</option>
                            <option value="3" ${quando.mese === 3 ? 'selected' : ''}>Aprile</option>
                            <option value="4" ${quando.mese === 4 ? 'selected' : ''}>Maggio</option>
                            <option value="5" ${quando.mese === 5 ? 'selected' : ''}>Giugno</option>
                            <option value="6" ${quando.mese === 6 ? 'selected' : ''}>Luglio</option>
                            <option value="7" ${quando.mese === 7 ? 'selected' : ''}>Agosto</option>
                            <option value="8" ${quando.mese === 8 ? 'selected' : ''}>Settembre</option>
                            <option value="9" ${quando.mese === 9 ? 'selected' : ''}>Ottobre</option>
                            <option value="10" ${quando.mese === 10 ? 'selected' : ''}>Novembre</option>
                            <option value="11" ${quando.mese === 11 ? 'selected' : ''}>Dicembre</option>
                        </select>
                    </div>
                </div>
            `;
            break;

        case "giorno_settimana":
            container.innerHTML = `
                <label style="font-size:12px;color:#666">Giorno della settimana:</label>
                <select id="quando-giornosettimana" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px">
                    <option value="0" ${quando.giornoSettimana === 0 ? 'selected' : ''}>Lunedì</option>
                    <option value="1" ${quando.giornoSettimana === 1 ? 'selected' : ''}>Martedì</option>
                    <option value="2" ${quando.giornoSettimana === 2 ? 'selected' : ''}>Mercoledì</option>
                    <option value="3" ${quando.giornoSettimana === 3 ? 'selected' : ''}>Giovedì</option>
                    <option value="4" ${quando.giornoSettimana === 4 ? 'selected' : ''}>Venerdì</option>
                    <option value="5" ${quando.giornoSettimana === 5 ? 'selected' : ''}>Sabato</option>
                    <option value="6" ${quando.giornoSettimana === 6 ? 'selected' : ''}>Domenica</option>
                </select>
            `;
            break;

        case "intervallo_date":
            container.innerHTML = `
                <div style="display:flex;gap:10px">
                    <div style="flex:1">
                        <label style="font-size:12px;color:#666">Data inizio:</label>
                        <input type="date" id="quando-da" value="${quando.da || ''}"
                               style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px">
                    </div>
                    <div style="flex:1">
                        <label style="font-size:12px;color:#666">Data fine:</label>
                        <input type="date" id="quando-a" value="${quando.a || ''}"
                               style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px">
                    </div>
                </div>
            `;
            break;
    }
};

window.aggiungiRichiestoUI = function(richiesto = null) {
    const container = document.getElementById("richiesti-container");
    if (!container) {
        console.error('[COVERAGE-CONFIG] Container richiesti-container non trovato');
        return;
    }

    // Ottieni stato corrente
    const { ambulatori, turni } = getState();

    const item = document.createElement("div");
    item.style.display = "flex";
    item.style.gap = "8px";
    item.style.alignItems = "center";
    item.style.padding = "8px";
    item.style.background = "#f9f9f9";
    item.style.borderRadius = "4px";

    const ambSelect = document.createElement("select");
    ambSelect.className = "richiesto-amb";
    ambSelect.style.flex = "1";
    ambSelect.style.padding = "6px";
    ambSelect.style.border = "1px solid #ccc";
    ambSelect.style.borderRadius = "4px";
    ambSelect.innerHTML = "<option value=''>Ambulatorio...</option>";
    Object.entries(ambulatori).forEach(([k, v]) => {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = `${k} - ${v.nome}`;
        opt.selected = richiesto && richiesto.ambulatorio === k;
        ambSelect.appendChild(opt);
    });
    item.appendChild(ambSelect);

    const turnoSelect = document.createElement("select");
    turnoSelect.className = "richiesto-turno";
    turnoSelect.style.flex = "1";
    turnoSelect.style.padding = "6px";
    turnoSelect.style.border = "1px solid #ccc";
    turnoSelect.style.borderRadius = "4px";
    turnoSelect.innerHTML = "<option value=''>Turno...</option>";
    Object.entries(turni).forEach(([k, v]) => {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = `${k} - ${v.nome}`;
        opt.selected = richiesto && richiesto.turno === k;
        turnoSelect.appendChild(opt);
    });
    item.appendChild(turnoSelect);

    const quantitaInput = document.createElement("input");
    quantitaInput.type = "number";
    quantitaInput.className = "richiesto-quantita";
    quantitaInput.min = "1";
    quantitaInput.value = richiesto?.quantita || "1";
    quantitaInput.style.width = "60px";
    quantitaInput.style.padding = "6px";
    quantitaInput.style.border = "1px solid #ccc";
    quantitaInput.style.borderRadius = "4px";
    item.appendChild(quantitaInput);

    const btnRemove = document.createElement("button");
    btnRemove.type = "button";
    btnRemove.className = "config-btn config-remove";
    btnRemove.textContent = "❌";
    btnRemove.style.fontSize = "11px";
    btnRemove.style.padding = "4px 8px";
    btnRemove.onclick = () => item.remove();
    item.appendChild(btnRemove);

    container.appendChild(item);
};

window.salvaRegolaForm = function(index) {
    const regole = caricaRegole();

    const descrizione = document.getElementById("regola-desc").value.trim();
    const severita = document.getElementById("regola-severita").value;
    const tipo = document.getElementById("regola-tipo").value;
    const attiva = document.getElementById("regola-attiva").checked;

    // Raccogli condizione
    let quando = { tipo };
    switch (tipo) {
        case "giorno_specifico":
            quando.giorno = parseInt(document.getElementById("quando-giorno").value);
            quando.mese = parseInt(document.getElementById("quando-mese").value);
            break;
        case "giorno_settimana":
            quando.giornoSettimana = parseInt(document.getElementById("quando-giornosettimana").value);
            break;
        case "intervallo_date":
            quando.da = document.getElementById("quando-da").value;
            quando.a = document.getElementById("quando-a").value;
            break;
    }

    // Raccogli richiesti
    const richiestiItems = document.querySelectorAll("#richiesti-container > div");
    const richiesti = [];
    richiestiItems.forEach(item => {
        const amb = item.querySelector(".richiesto-amb").value;
        const turno = item.querySelector(".richiesto-turno").value;
        const quantita = parseInt(item.querySelector(".richiesto-quantita").value);
        if (amb && turno && quantita > 0) {
            richiesti.push({ ambulatorio: amb, turno, quantita });
        }
    });

    // Crea regola
    const regola = {
        id: index !== null ? regole[index].id : `regola_${Date.now()}`,
        descrizione,
        quando,
        richiesti,
        severita,
        attiva
    };

    // Valida
    const errori = validaRegola(regola);
    if (errori.length > 0) {
        alert("Errori:\n" + errori.join("\n"));
        return false;
    }

    // Salva
    if (index !== null) {
        regole[index] = regola;
    } else {
        regole.push(regola);
    }

    salvaRegole(regole);
    renderConfig();
    return true;
};

window.toggleRegolaAttiva = function(index) {
    const regole = caricaRegole();
    regole[index].attiva = !regole[index].attiva;
    salvaRegole(regole);
    renderConfig();
};

window.eliminaRegola = function(index) {
    if (!confirm("Vuoi eliminare questa regola?")) return;
    const regole = caricaRegole();
    regole.splice(index, 1);
    salvaRegole(regole);
    renderConfig();
};

window.resetRegoleDefault = function() {
    if (!confirm("Vuoi ripristinare le regole di default? Le regole personalizzate andranno perse.")) return;
    resetRegolaDefault();
    renderConfig();
};

window.scrollToSection = function(sectionId) {
    setTimeout(() => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
};
