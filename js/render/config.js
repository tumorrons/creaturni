/**
 * render/config.js - Rendering vista configurazione
 */

import { operatori, turni, ambulatori, annoCorrente, meseCorrente } from '../state.js';
import {
    caricaOperatori, salvaOperatori, // aggiungiOperatore, rimuoviOperatore (gestiti da profili-config),
    caricaAmbulatori, salvaAmbulatori, aggiungiAmbulatorio, rimuoviAmbulatorio,
    caricaTurni, salvaTurni, aggiungiTurno, rimuoviTurno, aggiornaTurno,
    pulisciTuttiTurni
} from '../storage.js';
import { calcolaMinutiTurno, calcolaOreTurno, validaOrario } from '../turni.js';
import { renderCoverageConfigSection } from './coverage-config.js';
import { renderProfiliConfigSection } from './profili-config.js';
import { getNomeOperatore } from '../profili.js';
import {
    esportaDatiJSON,
    importaDatiJSON,
    esportaTurniAnnoCompleto,
    esportaTurniXLSX,
    downloadFile,
    generaNomeFile
} from '../export.js';

export function renderConfig() {
    const container = document.getElementById("config");

    container.innerHTML = `<h3>⚙️ Configurazione</h3>`;

    let infoText = document.createElement("p");
    infoText.className = "info-text";
    infoText.textContent = "Gestisci operatori, ambulatori e turni. Le modifiche vengono salvate automaticamente.";
    container.appendChild(infoText);

    // Sezione Operatori
    renderProfiliConfigSection(container);

    // Sezione Ambulatori
    renderConfigAmbulatori(container);

    // Sezione Turni
    renderConfigTurni(container);

    // Sezione Export/Import
    renderExportImport(container);

    // Sezione Azioni Globali
    renderConfigAzioni(container);

    // Sezione Regole Copertura
    renderCoverageConfigSection(container);

    // Sezione Informazioni
    renderConfigInfo(container);
}

function renderConfigOperatori(container) {
    let box = document.createElement("div");
    box.className = "config-section config-info";
    box.innerHTML = `<h4>👤 Operatori (${operatori.length})</h4>`;

    // Lista operatori
    let lista = document.createElement("ul");
    lista.className = "operatori-list";

    operatori.forEach((op, index) => {
        let item = document.createElement("li");
        item.innerHTML = `
            ${op}
            <button class="config-btn config-remove"
                    onclick="window.eliminaOperatore(${index})"
                    style="float:right;padding:4px 8px;font-size:11px">
                🗑️
            </button>
        `;
        lista.appendChild(item);
    });

    box.appendChild(lista);

    // Form aggiungi operatore
    let form = document.createElement("div");
    form.style.marginTop = "15px";
    form.innerHTML = `
        <input type="text"
               id="nuovo-operatore"
               placeholder="Nome nuovo operatore..."
               style="padding:8px;border:1px solid #ccc;border-radius:4px;width:70%"
               onkeypress="if(event.key==='Enter')window.aggiungiOperatoreUI()">
        <button class="config-btn config-add"
                onclick="window.aggiungiOperatoreUI()"
                style="margin-left:5px">
            ➕ Aggiungi
        </button>
    `;
    box.appendChild(form);

    container.appendChild(box);
}

function renderConfigAmbulatori(container) {
    let box = document.createElement("div");
    box.className = "config-section config-info";
    box.innerHTML = `<h4>🏥 Ambulatori (${Object.keys(ambulatori).length})</h4>`;

    // Lista ambulatori
    let lista = document.createElement("ul");
    lista.className = "operatori-list";

    Object.entries(ambulatori).forEach(([codice, amb]) => {
        let item = document.createElement("li");
        item.innerHTML = `
            <strong>${codice}</strong> — ${amb.nome}
            <button class="config-btn config-remove"
                    onclick="window.eliminaAmbulatorio('${codice}')"
                    style="float:right;padding:4px 8px;font-size:11px">
                🗑️
            </button>
        `;
        lista.appendChild(item);
    });

    box.appendChild(lista);

    // Form aggiungi ambulatorio
    let form = document.createElement("div");
    form.style.marginTop = "15px";
    form.innerHTML = `
        <input type="text"
               id="nuovo-amb-codice"
               placeholder="Codice (es: BUD)"
               style="padding:8px;border:1px solid #ccc;border-radius:4px;width:30%;text-transform:uppercase"
               maxlength="5">
        <input type="text"
               id="nuovo-amb-nome"
               placeholder="Nome ambulatorio (es: Budrio)"
               style="padding:8px;border:1px solid #ccc;border-radius:4px;width:38%;margin-left:5px"
               onkeypress="if(event.key==='Enter')window.aggiungiAmbulatorioUI()">
        <button class="config-btn config-add"
                onclick="window.aggiungiAmbulatorioUI()"
                style="margin-left:5px">
            ➕ Aggiungi
        </button>
    `;
    box.appendChild(form);

    container.appendChild(box);
}

function renderConfigTurni(container) {
    let box = document.createElement("div");
    box.className = "config-section config-turni";
    box.innerHTML = `<h4>⏰ Turni (${Object.keys(turni).length})</h4>`;

    // Lista turni
    let lista = document.createElement("ul");
    lista.className = "turno-list";

    Object.entries(turni).forEach(([codice, turno]) => {
        let item = document.createElement("li");
        item.style.padding = "10px";
        item.style.background = "#f5f5f5";
        item.style.borderRadius = "4px";
        item.style.marginBottom = "8px";
        item.style.borderLeft = `5px solid ${turno.colore}`;

        const oreCalcolate = calcolaOreTurno(codice);
        const orarioDisplay = getOrarioDisplay(turno);
        const badgeSpeciale = turno.speciale ? `<span style="background:#FF9800;color:white;padding:2px 6px;border-radius:3px;font-size:10px;margin-left:8px">🏖️ SPECIALE</span>` : '';
        const badgeBlocca = turno.bloccaGenerazione ? `<span style="background:#F44336;color:white;padding:2px 6px;border-radius:3px;font-size:10px;margin-left:4px">🚫 BLOCCA AUTO</span>` : '';

        item.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:start">
                <div style="flex:1">
                    <strong style="font-size:14px">${codice}</strong> — ${turno.nome}${badgeSpeciale}${badgeBlocca}
                    <br>
                    <small style="color:#666">
                        ${turno.speciale ? '⚠️ Turno speciale (non conta ore lavorative)' : `🏥 ${ambulatori[turno.ambulatorio]?.nome || turno.ambulatorio || 'Non specificato'} • ⏰ ${orarioDisplay} • 📊 ${oreCalcolate} ore`}
                    </small>
                    ${turno.labelStampa ? `<br><small style="color:#999">Etichetta stampa: ${turno.labelStampa}</small>` : ''}
                </div>
                <div style="display:flex;gap:5px">
                    <button class="config-btn config-add"
                            onclick="window.modificaTurno('${codice}')"
                            style="padding:4px 8px;font-size:11px">
                        ✏️
                    </button>
                    <button class="config-btn config-remove"
                            onclick="window.eliminaTurno('${codice}')"
                            style="padding:4px 8px;font-size:11px">
                        🗑️
                    </button>
                </div>
            </div>
        `;
        lista.appendChild(item);
    });

    box.appendChild(lista);

    // Bottone aggiungi turno
    let btnAggiungi = document.createElement("button");
    btnAggiungi.className = "config-btn config-add";
    btnAggiungi.textContent = "➕ Aggiungi Nuovo Turno";
    btnAggiungi.style.marginTop = "10px";
    btnAggiungi.onclick = () => window.mostraFormTurno();
    box.appendChild(btnAggiungi);

    // Form turno (inizialmente nascosto)
    renderFormTurno(box);

    container.appendChild(box);
}

function renderFormTurno(container) {
    let form = document.createElement("div");
    form.id = "form-turno";
    form.style.display = "none";
    form.style.marginTop = "15px";
    form.style.padding = "15px";
    form.style.background = "#fff";
    form.style.border = "2px solid #9c27b0";
    form.style.borderRadius = "4px";

    form.innerHTML = `
        <h5 style="margin-top:0;color:#9c27b0">Nuovo/Modifica Turno</h5>
        <input type="hidden" id="turno-edit-code" value="">

        <div style="margin-bottom:10px">
            <label style="display:block;font-weight:bold;margin-bottom:5px">Codice Turno:</label>
            <input type="text" id="turno-codice" placeholder="es: BM"
                   style="padding:8px;border:1px solid #ccc;border-radius:4px;width:100%;text-transform:uppercase"
                   maxlength="5">
        </div>

        <div style="margin-bottom:10px">
            <label style="display:block;font-weight:bold;margin-bottom:5px">Nome Turno:</label>
            <input type="text" id="turno-nome" placeholder="es: Mattino"
                   style="padding:8px;border:1px solid #ccc;border-radius:4px;width:100%">
        </div>

        <div style="margin-bottom:10px">
            <label style="display:block;font-weight:bold;margin-bottom:5px">Ambulatorio:</label>
            <select id="turno-ambulatorio" style="padding:8px;border:1px solid #ccc;border-radius:4px;width:100%">
                <option value="">— Seleziona ambulatorio —</option>
            </select>
        </div>

        <div style="margin-bottom:10px">
            <label style="display:block;font-weight:bold;margin-bottom:5px">Colore:</label>
            <input type="color" id="turno-colore" value="#4caf50"
                   style="padding:4px;border:1px solid #ccc;border-radius:4px;width:100px;height:40px">
        </div>

        <div style="margin-bottom:10px">
            <label style="display:block;font-weight:bold;margin-bottom:5px">Etichetta Stampa (opzionale):</label>
            <input type="text" id="turno-label-stampa" placeholder="es: BM"
                   style="padding:8px;border:1px solid #ccc;border-radius:4px;width:100%;text-transform:uppercase"
                   maxlength="5">
            <small style="color:#666">Testo breve da mostrare nelle stampe (se vuoto, usa il codice)</small>
        </div>

        <div style="margin-bottom:10px;padding:10px;background:#fff3e0;border-radius:4px">
            <label style="display:inline-flex;align-items:center;cursor:pointer;margin-bottom:8px">
                <input type="checkbox" id="turno-speciale" style="margin-right:8px" onchange="window.toggleTurnoSpeciale()">
                <span style="font-weight:bold">🏖️ Turno speciale (ferie, permessi, etc.)</span>
            </label>
            <br>
            <small style="color:#666">I turni speciali non hanno orari e non contano nelle ore lavorative</small>
            <br><br>
            <label style="display:inline-flex;align-items:center;cursor:pointer">
                <input type="checkbox" id="turno-blocca-generazione" style="margin-right:8px">
                <span style="font-weight:bold">🚫 Blocca generazione automatica</span>
            </label>
            <br>
            <small style="color:#666">Operatori con questo turno non riceveranno assegnazioni automatiche</small>
        </div>

        <div id="turno-orario-section" style="margin-bottom:10px;padding:10px;background:#f0f0f0;border-radius:4px">
            <label style="display:block;font-weight:bold;margin-bottom:8px">⏰ Orario Turno:</label>

            <div style="margin-bottom:8px">
                <label style="display:block;margin-bottom:5px">Ingresso:</label>
                <input type="time" id="turno-ingresso"
                       style="padding:8px;border:1px solid #ccc;border-radius:4px">
            </div>

            <div style="margin-bottom:8px">
                <label style="display:block;margin-bottom:5px">Uscita:</label>
                <input type="time" id="turno-uscita"
                       style="padding:8px;border:1px solid #ccc;border-radius:4px">
            </div>

            <div style="margin-bottom:8px">
                <label style="display:block;margin-bottom:5px">Pausa (minuti):</label>
                <input type="number" id="turno-pausa" value="0" min="0" max="120"
                       style="padding:8px;border:1px solid #ccc;border-radius:4px;width:100px">
            </div>

            <div>
                <label style="display:inline-flex;align-items:center;cursor:pointer">
                    <input type="checkbox" id="turno-sottrai-pausa" checked style="margin-right:8px">
                    <span>Sottrai pausa dalle ore lavorative</span>
                </label>
            </div>
        </div>

        <div style="margin-top:15px;display:flex;gap:8px">
            <button class="config-btn config-add" onclick="window.salvaTurnoUI()">💾 Salva Turno</button>
            <button class="config-btn config-clear" onclick="window.chiudiFormTurno()">✖ Annulla</button>
        </div>
    `;

    container.appendChild(form);
}

function renderExportImport(container) {
    let box = document.createElement("div");
    box.className = "config-section config-azioni";
    box.innerHTML = `<h4>💾 Backup & Export</h4>`;

    let info = document.createElement("p");
    info.className = "info-text";
    info.textContent = "Esporta i tuoi dati per backup o importa dati salvati in precedenza.";
    box.appendChild(info);

    // Sottosezione Export
    let exportSection = document.createElement("div");
    exportSection.style.marginBottom = "20px";
    exportSection.style.padding = "15px";
    exportSection.style.background = "#e8f5e9";
    exportSection.style.borderRadius = "8px";

    let exportTitle = document.createElement("h5");
    exportTitle.style.marginTop = "0";
    exportTitle.style.marginBottom = "10px";
    exportTitle.textContent = "📤 Export Dati";
    exportSection.appendChild(exportTitle);

    // Pulsante Export JSON
    let btnExportJSON = document.createElement("button");
    btnExportJSON.className = "config-btn config-add";
    btnExportJSON.textContent = "💾 Esporta Backup Completo (JSON)";
    btnExportJSON.style.marginRight = "8px";
    btnExportJSON.style.marginBottom = "8px";
    btnExportJSON.onclick = () => window.esportaBackupJSON();
    exportSection.appendChild(btnExportJSON);

    // Pulsante Export CSV
    let btnExportCSV = document.createElement("button");
    btnExportCSV.className = "config-btn config-add";
    btnExportCSV.textContent = "📊 Esporta Anno (CSV)";
    btnExportCSV.style.marginRight = "8px";
    btnExportCSV.style.marginBottom = "8px";
    btnExportCSV.onclick = () => window.esportaTurniAnnoCompleto();
    exportSection.appendChild(btnExportCSV);

    // Pulsante Export XLSX formattato
    let btnExportXLSX = document.createElement("button");
    btnExportXLSX.className = "config-btn config-add";
    btnExportXLSX.textContent = "📊 Esporta Anno Formattato (Excel XLSX)";
    btnExportXLSX.style.marginBottom = "8px";
    btnExportXLSX.onclick = () => window.esportaTurniXLSXFormattato();
    exportSection.appendChild(btnExportXLSX);

    let exportInfo = document.createElement("p");
    exportInfo.className = "info-text";
    exportInfo.style.fontSize = "11px";
    exportInfo.style.marginTop = "10px";
    exportInfo.style.marginBottom = "0";
    exportInfo.innerHTML = `
        <strong>💾 JSON (Backup Completo):</strong> Include TUTTO per ripristinare l'app su altro PC:<br>
        • Profili operatori completi • Ambulatori e turni configurati<br>
        • Regole di copertura • Tutti i turni assegnati • Note • Bozze<br><br>
        <strong>📊 CSV:</strong> Solo turni dell'anno (testo semplice, per import/analisi)<br>
        <strong>📊 Excel XLSX:</strong> Anno completo con colori e formattazione (stampabile)
    `;
    exportSection.appendChild(exportInfo);

    box.appendChild(exportSection);

    // Sottosezione Import
    let importSection = document.createElement("div");
    importSection.style.padding = "15px";
    importSection.style.background = "#fff3e0";
    importSection.style.borderRadius = "8px";

    let importTitle = document.createElement("h5");
    importTitle.style.marginTop = "0";
    importTitle.style.marginBottom = "10px";
    importTitle.textContent = "📥 Import Dati";
    importSection.appendChild(importTitle);

    // Input file + pulsante import
    let fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "import-file-input";
    fileInput.accept = ".json";
    fileInput.style.marginBottom = "8px";
    importSection.appendChild(fileInput);

    let btnImportJSON = document.createElement("button");
    btnImportJSON.className = "config-btn";
    btnImportJSON.style.background = "#ff9800";
    btnImportJSON.textContent = "📥 Importa Backup (JSON)";
    btnImportJSON.onclick = () => window.importaBackupJSON();
    importSection.appendChild(btnImportJSON);

    let importWarning = document.createElement("p");
    importWarning.className = "info-text";
    importWarning.style.fontSize = "11px";
    importWarning.style.marginTop = "10px";
    importWarning.style.marginBottom = "0";
    importWarning.style.color = "#d32f2f";
    importWarning.style.fontWeight = "bold";
    importWarning.innerHTML = `
        ⚠️ <strong>ATTENZIONE:</strong> L'importazione sostituirà tutti i dati attuali!
    `;
    importSection.appendChild(importWarning);

    box.appendChild(importSection);

    container.appendChild(box);
}

function renderConfigAzioni(container) {
    let box = document.createElement("div");
    box.className = "config-section config-azioni";
    box.innerHTML = `<h4>🔧 Azioni Globali</h4>`;

    let warning = document.createElement("p");
    warning.className = "info-text";
    warning.style.color = "#d32f2f";
    warning.style.fontWeight = "bold";
    warning.textContent = "⚠️ Attenzione: queste azioni sono irreversibili!";
    box.appendChild(warning);

    let btnPulisci = document.createElement("button");
    btnPulisci.className = "config-btn config-remove";
    btnPulisci.textContent = "🗑️ Cancella Tutti i Turni Assegnati";
    btnPulisci.onclick = () => window.pulisciTuttiTurniUI();
    box.appendChild(btnPulisci);

    let info = document.createElement("p");
    info.className = "info-text";
    info.style.marginTop = "10px";
    info.textContent = "Questa azione cancellerà tutti i turni assegnati ma manterrà la configurazione di operatori, ambulatori e turni.";
    box.appendChild(info);

    container.appendChild(box);
}

function renderConfigInfo(container) {
    let box = document.createElement("div");
    box.className = "config-section config-note";
    box.innerHTML = `
        <h4>ℹ️ Informazioni</h4>
        <p style="margin:5px 0"><strong>Versione:</strong> 2.0 (Modular)</p>
        <p style="margin:5px 0"><strong>Storage:</strong> localStorage (browser)</p>
        <p style="margin:5px 0"><strong>Operatori configurati:</strong> ${operatori.length}</p>
        <p style="margin:5px 0"><strong>Ambulatori configurati:</strong> ${Object.keys(ambulatori).length}</p>
        <p style="margin:5px 0"><strong>Turni configurati:</strong> ${Object.keys(turni).length}</p>
        <p class="info-text" style="margin-top:10px">
            💡 I dati sono salvati nel browser. Usa l'esportazione/importazione per backup o trasferimento tra dispositivi.
        </p>
    `;

    container.appendChild(box);
}

function getOrarioDisplay(turno) {
    // TURNI A SEGMENTI
    if (Array.isArray(turno.segmenti) && turno.segmenti.length > 0) {
        return turno.segmenti.map(seg => `${seg.ingresso}-${seg.uscita}`).join(' + ');
    }
    // TURNO SINGOLO
    if (turno.ingresso && turno.uscita) {
        return `${turno.ingresso} - ${turno.uscita}`;
    }
    // LEGACY
    return turno.orario || 'Non specificato';
}

// ========== HANDLERS UI ==========

window.aggiungiOperatoreUI = function() {
    const input = document.getElementById("nuovo-operatore");
    const nome = input.value.trim();

    if (!nome) {
        alert("Inserisci un nome valido");
        return;
    }

    if (operatori.includes(nome)) {
        alert("Operatore già presente");
        return;
    }

    aggiungiOperatore(nome);
    renderConfig();
    input.value = "";
};

window.eliminaOperatore = function(index) {
    if (!confirm(`Vuoi eliminare l'operatore "${operatori[index]}"?`)) return;
    rimuoviOperatore(index);
    renderConfig();
};

window.aggiungiAmbulatorioUI = function() {
    const inputCodice = document.getElementById("nuovo-amb-codice");
    const inputNome = document.getElementById("nuovo-amb-nome");
    const codice = inputCodice.value.trim().toUpperCase();
    const nome = inputNome.value.trim();

    if (!codice || !nome) {
        alert("Inserisci sia il codice che il nome");
        return;
    }

    if (ambulatori[codice]) {
        alert("Codice ambulatorio già presente");
        return;
    }

    aggiungiAmbulatorio(codice, nome);
    renderConfig();
    inputCodice.value = "";
    inputNome.value = "";
};

window.eliminaAmbulatorio = function(codice) {
    if (!confirm(`Vuoi eliminare l'ambulatorio "${ambulatori[codice].nome}" (${codice})?`)) return;
    rimuoviAmbulatorio(codice);
    renderConfig();
};

window.mostraFormTurno = function(codice = null) {
    const form = document.getElementById("form-turno");
    form.style.display = "block";

    // Popola select ambulatori
    const selectAmb = document.getElementById("turno-ambulatorio");
    selectAmb.innerHTML = '<option value="">— Seleziona ambulatorio —</option>';
    Object.entries(ambulatori).forEach(([k, v]) => {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = `${v.nome} (${k})`;
        selectAmb.appendChild(opt);
    });

    if (codice && turni[codice]) {
        // Modalità modifica
        const turno = turni[codice];
        document.getElementById("turno-edit-code").value = codice;
        document.getElementById("turno-codice").value = codice;
        document.getElementById("turno-codice").disabled = true;
        document.getElementById("turno-nome").value = turno.nome || "";
        document.getElementById("turno-ambulatorio").value = turno.ambulatorio || "";
        document.getElementById("turno-colore").value = turno.colore || "#4caf50";
        document.getElementById("turno-label-stampa").value = turno.labelStampa || "";
        document.getElementById("turno-speciale").checked = turno.speciale || false;
        document.getElementById("turno-blocca-generazione").checked = turno.bloccaGenerazione || false;
        document.getElementById("turno-ingresso").value = turno.ingresso || "";
        document.getElementById("turno-uscita").value = turno.uscita || "";
        document.getElementById("turno-pausa").value = turno.pausa || 0;
        document.getElementById("turno-sottrai-pausa").checked = turno.sottraiPausa ?? true;
        // Attiva/disattiva sezioni in base al tipo di turno
        window.toggleTurnoSpeciale();
    } else {
        // Modalità nuovo
        document.getElementById("turno-edit-code").value = "";
        document.getElementById("turno-codice").disabled = false;
        document.getElementById("turno-codice").value = "";
        document.getElementById("turno-nome").value = "";
        document.getElementById("turno-ambulatorio").value = "";
        document.getElementById("turno-colore").value = "#4caf50";
        document.getElementById("turno-label-stampa").value = "";
        document.getElementById("turno-speciale").checked = false;
        document.getElementById("turno-blocca-generazione").checked = false;
        document.getElementById("turno-ingresso").value = "";
        document.getElementById("turno-uscita").value = "";
        document.getElementById("turno-pausa").value = 0;
        document.getElementById("turno-sottrai-pausa").checked = true;
        // Mostra sezione orari per turni normali
        window.toggleTurnoSpeciale();
    }

    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.modificaTurno = function(codice) {
    window.mostraFormTurno(codice);
};

window.salvaTurnoUI = function() {
    const editCode = document.getElementById("turno-edit-code").value;
    const codice = document.getElementById("turno-codice").value.trim().toUpperCase();
    const nome = document.getElementById("turno-nome").value.trim();
    const ambulatorio = document.getElementById("turno-ambulatorio").value;
    const colore = document.getElementById("turno-colore").value;
    const labelStampa = document.getElementById("turno-label-stampa").value.trim().toUpperCase();
    const speciale = document.getElementById("turno-speciale").checked;
    const bloccaGenerazione = document.getElementById("turno-blocca-generazione").checked;
    const ingresso = document.getElementById("turno-ingresso").value;
    const uscita = document.getElementById("turno-uscita").value;
    const pausa = parseInt(document.getElementById("turno-pausa").value) || 0;
    const sottraiPausa = document.getElementById("turno-sottrai-pausa").checked;

    if (!codice || !nome) {
        alert("Codice e nome sono obbligatori");
        return;
    }

    if (!editCode && turni[codice]) {
        alert("Codice turno già esistente");
        return;
    }

    // Per turni normali, valida orari
    if (!speciale) {
        if (ingresso && !validaOrario(ingresso)) {
            alert("Formato orario ingresso non valido (usa HH:MM)");
            return;
        }

        if (uscita && !validaOrario(uscita)) {
            alert("Formato orario uscita non valido (usa HH:MM)");
            return;
        }
    }

    const turno = {
        nome,
        colore,
        ambulatorio: ambulatorio || null,
        labelStampa: labelStampa || codice,
        speciale,
        bloccaGenerazione,
        ingresso: (speciale ? null : (ingresso || null)),
        uscita: (speciale ? null : (uscita || null)),
        pausa: (speciale ? 0 : pausa),
        sottraiPausa: (speciale ? false : sottraiPausa),
        ore: (speciale ? 0 : undefined)  // Turni speciali hanno ore = 0
    };

    if (editCode) {
        aggiornaTurno(codice, turno);
    } else {
        aggiungiTurno(codice, turno);
    }

    renderConfig();
    window.chiudiFormTurno();
};

window.chiudiFormTurno = function() {
    const form = document.getElementById("form-turno");
    if (form) {
        form.style.display = "none";
    }
};

window.toggleTurnoSpeciale = function() {
    const speciale = document.getElementById("turno-speciale").checked;
    const orarioSection = document.getElementById("turno-orario-section");
    const ambulatorioInput = document.getElementById("turno-ambulatorio");
    const bloccaGenerazioneCheckbox = document.getElementById("turno-blocca-generazione");

    if (speciale) {
        // Nascondi orario e ambulatorio per turni speciali
        orarioSection.style.display = "none";
        ambulatorioInput.disabled = true;
        ambulatorioInput.value = "";
        // Attiva automaticamente blocca generazione
        bloccaGenerazioneCheckbox.checked = true;
    } else {
        // Mostra orario e ambulatorio per turni normali
        orarioSection.style.display = "block";
        ambulatorioInput.disabled = false;
    }
};

window.eliminaTurno = function(codice) {
    if (!confirm(`Vuoi eliminare il turno "${turni[codice].nome}" (${codice})?`)) return;
    rimuoviTurno(codice);
    renderConfig();
};

window.pulisciTuttiTurniUI = function() {
    if (!confirm("⚠️ ATTENZIONE! Stai per cancellare TUTTI i turni assegnati.\n\nQuesta azione è IRREVERSIBILE.\n\nVuoi continuare?")) return;
    if (!confirm("Sei ASSOLUTAMENTE sicuro? Tutti i turni verranno eliminati!")) return;

    const count = pulisciTuttiTurni();
    alert(`✅ Cancellati ${count} turni`);
    renderConfig();
};

// ============= EXPORT/IMPORT =============

window.esportaBackupJSON = function() {
    try {
        const jsonData = esportaDatiJSON();
        const backup = JSON.parse(jsonData);
        const nomeFile = generaNomeFile('json');
        downloadFile(jsonData, nomeFile, 'application/json');

        // Messaggio dettagliato con statistiche
        let messaggio = `✅ Backup completo esportato!\n\nFile: ${nomeFile}\n\n`;

        if (backup.metadata && backup.metadata.statistiche) {
            const s = backup.metadata.statistiche;
            messaggio += `Contenuto backup:\n`;
            messaggio += `• ${s.numOperatori} operatori (${s.numProfili} profili completi)\n`;
            messaggio += `• ${s.numAmbulatori} ambulatori\n`;
            messaggio += `• ${s.numTipiTurno} tipi di turno configurati\n`;
            messaggio += `• ${s.numTurniAssegnati} turni assegnati\n`;
            messaggio += `• ${s.numNote} note\n`;
            messaggio += `• ${s.numRegole} regole di copertura\n`;
            messaggio += `\n📦 Questo file contiene TUTTO il necessario per ripristinare l'applicazione su un altro PC.`;
        }

        alert(messaggio);
    } catch (error) {
        alert(`❌ Errore durante l'export: ${error.message}`);
        console.error('[EXPORT] Errore export JSON:', error);
    }
};

window.esportaTurniAnnoCompleto = function() {
    try {
        const csvData = esportaTurniAnnoCompleto(annoCorrente);
        const nomeFile = generaNomeFile('excel', annoCorrente);
        downloadFile(csvData, nomeFile, 'text/csv;charset=utf-8;');
        alert(`✅ Anno completo esportato con successo!\n\nFile: ${nomeFile}\n\nContiene tutti i 12 mesi con turni, note e legenda.`);
    } catch (error) {
        alert(`❌ Errore durante l'export: ${error.message}`);
        console.error('[EXPORT] Errore export Excel:', error);
    }
};

window.esportaTurniXLSXFormattato = function() {
    try {
        esportaTurniXLSX(annoCorrente);
        alert(`✅ Excel formattato esportato con successo!\n\nContiene:\n• 12 fogli (uno per mese)\n• Celle colorate come nella Vista Mese\n• Note integrate (con *)\n• Foglio Legenda con tutti i turni`);
    } catch (error) {
        alert(`❌ Errore durante l'export XLSX: ${error.message}`);
        console.error('[EXPORT] Errore export XLSX:', error);
    }
};

window.importaBackupJSON = function() {
    const fileInput = document.getElementById('import-file-input');
    const file = fileInput.files[0];

    if (!file) {
        alert('⚠️ Seleziona un file JSON da importare');
        return;
    }

    if (!file.name.endsWith('.json')) {
        alert('⚠️ Il file deve essere in formato JSON');
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const jsonString = e.target.result;
            const risultato = importaDatiJSON(jsonString);

            if (risultato.successo) {
                alert(risultato.messaggio);
                // Ricarica la pagina per applicare i nuovi dati
                window.location.reload();
            } else {
                alert(`❌ ${risultato.messaggio}`);
            }
        } catch (error) {
            alert(`❌ Errore durante l'importazione: ${error.message}`);
            console.error('[IMPORT] Errore import JSON:', error);
        }
    };

    reader.onerror = function() {
        alert('❌ Errore durante la lettura del file');
    };

    reader.readAsText(file);
};
