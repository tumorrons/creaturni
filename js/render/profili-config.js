/**
 * render/profili-config.js - UI configurazione profili operatori
 *
 * Form completo per creare/modificare profili con tutte le sezioni.
 */

import { caricaOperatori, aggiornaProfilo, aggiungiOperatore, rimuoviOperatore } from '../storage.js';
import { nuovoProfilo, validaProfilo, TIPI_CONTRATTO, GIORNI_SETTIMANA, getNomeOperatore, RUOLI_PREDEFINITI, getRuoloDisplay } from '../profili.js';
import { ambulatori, turni } from '../state.js';
import { renderConfig } from './config.js';
// import { mostraRuleBuilder } from './rule-builder.js';  // Non usato qui, usato in profili-regole-ui.js
import { inizializzaRegoleTemp, getRegoleCustomDaSalvare } from './profili-regole-ui.js';

/**
 * Renderizza sezione profili operatori in configurazione
 */
export function renderProfiliConfigSection(container) {
    let section = document.createElement("div");
    section.id = "profili-config";
    section.className = "config-section config-info";
    section.style.marginTop = "20px";

    section.innerHTML = `<h4>👤 Profili Operatori</h4>`;

    let info = document.createElement("p");
    info.className = "info-text";
    info.textContent = "Gestisci i profili completi degli operatori: identità, sedi, contratto, preferenze e vincoli.";
    section.appendChild(info);

    // Carica operatori
    const operatori = caricaOperatori();

    // Lista operatori
    const listaContainer = document.createElement("div");
    listaContainer.style.marginBottom = "15px";

    if (operatori.length === 0) {
        const noOps = document.createElement("p");
        noOps.className = "no-data";
        noOps.textContent = "Nessun operatore configurato";
        listaContainer.appendChild(noOps);
    } else {
        operatori.forEach((op, index) => {
            const item = renderProfiloItem(op, index);
            listaContainer.appendChild(item);
        });
    }

    section.appendChild(listaContainer);

    // Bottoni azione
    const actions = document.createElement("div");
    actions.style.marginTop = "15px";
    actions.style.display = "flex";
    actions.style.gap = "8px";

    const btnNuovo = document.createElement("button");
    btnNuovo.className = "config-btn config-add";
    btnNuovo.textContent = "➕ Nuovo Operatore";
    btnNuovo.onclick = () => window.mostraFormProfilo();
    actions.appendChild(btnNuovo);

    section.appendChild(actions);

    container.appendChild(section);
}

/**
 * Renderizza singolo profilo nella lista
 */
function renderProfiloItem(profilo, index) {
    const item = document.createElement("div");
    item.style.padding = "12px";
    item.style.marginBottom = "8px";
    item.style.background = "#f5f5f5";
    item.style.border = "1px solid #ddd";
    item.style.borderRadius = "4px";
    item.style.display = "flex";
    item.style.justifyContent = "space-between";
    item.style.alignItems = "center";
    item.style.gap = "10px";

    // Info operatore
    const infoDiv = document.createElement("div");
    infoDiv.style.flex = "1";

    const titleDiv = document.createElement("div");
    titleDiv.style.display = "flex";
    titleDiv.style.alignItems = "center";
    titleDiv.style.gap = "8px";
    titleDiv.style.marginBottom = "4px";

    const nameText = document.createElement("strong");
    nameText.textContent = getNomeOperatore(profilo);
    titleDiv.appendChild(nameText);

    // Badge contratto
    const contrattoBadge = document.createElement("span");
    contrattoBadge.style.padding = "2px 6px";
    contrattoBadge.style.fontSize = "10px";
    contrattoBadge.style.borderRadius = "3px";
    contrattoBadge.style.fontWeight = "bold";
    contrattoBadge.textContent = profilo.contratto?.tipo === "part-time" ? "Part-Time" : "Full-Time";
    contrattoBadge.style.background = profilo.contratto?.tipo === "part-time" ? "#fff3e0" : "#e3f2fd";
    contrattoBadge.style.color = profilo.contratto?.tipo === "part-time" ? "#e65100" : "#1565c0";
    titleDiv.appendChild(contrattoBadge);

    // Badge ore settimanali
    if (profilo.contratto?.oreSettimanali) {
        const oreBadge = document.createElement("span");
        oreBadge.style.padding = "2px 6px";
        oreBadge.style.fontSize = "10px";
        oreBadge.style.borderRadius = "3px";
        oreBadge.style.background = "#f5f5f5";
        oreBadge.style.color = "#666";
        oreBadge.textContent = `${profilo.contratto.oreSettimanali}h/sett`;
        titleDiv.appendChild(oreBadge);
    }

    infoDiv.appendChild(titleDiv);

    // Ruolo
    const ruoloDisplay = getRuoloDisplay(profilo);
    if (ruoloDisplay) {
        const ruoloDiv = document.createElement("div");
        ruoloDiv.style.fontSize = "12px";
        ruoloDiv.style.color = "#666";
        ruoloDiv.style.marginTop = "4px";
        const ruoloObj = RUOLI_PREDEFINITI.find(r => r.value === profilo.ruolo);
        const emoji = ruoloObj ? ruoloObj.emoji : "👤";
        ruoloDiv.textContent = `${emoji} ${ruoloDisplay}`;
        infoDiv.appendChild(ruoloDiv);
    }

    // Dettagli sedi
    if (profilo.sedePrincipale) {
        const sediDiv = document.createElement("div");
        sediDiv.style.fontSize = "12px";
        sediDiv.style.color = "#666";
        sediDiv.style.marginTop = "4px";
        const ambNome = ambulatori[profilo.sedePrincipale]?.nome || profilo.sedePrincipale;
        sediDiv.textContent = `📍 Sede: ${ambNome}`;
        if (profilo.sediSecondarie && profilo.sediSecondarie.length > 0) {
            sediDiv.textContent += ` (+${profilo.sediSecondarie.length} secondaria/e)`;
        }
        infoDiv.appendChild(sediDiv);
    }

    // Info vincoli
    const vincoliArray = [];
    if (profilo.vincoli?.maxOreSettimanali) {
        vincoliArray.push(`Max ${profilo.vincoli.maxOreSettimanali}h/sett`);
    }
    if (profilo.vincoli?.maxGiorniConsecutivi) {
        vincoliArray.push(`Max ${profilo.vincoli.maxGiorniConsecutivi}gg consecutivi`);
    }
    if (vincoliArray.length > 0) {
        const vincoliDiv = document.createElement("div");
        vincoliDiv.style.fontSize = "11px";
        vincoliDiv.style.color = "#d32f2f";
        vincoliDiv.style.marginTop = "4px";
        vincoliDiv.textContent = `⚠️ ${vincoliArray.join(" • ")}`;
        infoDiv.appendChild(vincoliDiv);
    }

    item.appendChild(infoDiv);

    // Azioni
    const actionsDiv = document.createElement("div");
    actionsDiv.style.display = "flex";
    actionsDiv.style.gap = "4px";

    const btnEdit = document.createElement("button");
    btnEdit.className = "config-btn config-add";
    btnEdit.style.fontSize = "11px";
    btnEdit.style.padding = "4px 8px";
    btnEdit.textContent = "✏️";
    btnEdit.title = "Modifica profilo";
    btnEdit.onclick = () => window.mostraFormProfilo(index);
    actionsDiv.appendChild(btnEdit);

    const btnDelete = document.createElement("button");
    btnDelete.className = "config-btn config-remove";
    btnDelete.style.fontSize = "11px";
    btnDelete.style.padding = "4px 8px";
    btnDelete.textContent = "🗑️";
    btnDelete.title = "Elimina";
    btnDelete.onclick = () => window.eliminaProfilo(index);
    actionsDiv.appendChild(btnDelete);

    item.appendChild(actionsDiv);

    return item;
}

/**
 * Mostra form creazione/modifica profilo
 */
window.mostraFormProfilo = function(index = null) {
    const operatori = caricaOperatori();
    const profilo = index !== null ? operatori[index] : nuovoProfilo();
    const isEdit = index !== null;

    // Overlay modale
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
    formContainer.style.maxWidth = "700px";
    formContainer.style.width = "90%";
    formContainer.style.maxHeight = "90vh";
    formContainer.style.overflowY = "auto";
    formContainer.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";

    const title = document.createElement("h3");
    title.textContent = isEdit ? "✏️ Modifica Profilo Operatore" : "➕ Nuovo Operatore";
    title.style.marginTop = "0";
    formContainer.appendChild(title);

    // Form
    const form = document.createElement("div");
    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.gap = "20px";

    // ===== SEZIONE 1: IDENTITÀ =====
    const identitaSection = createSection("👤 Identità", "#e3f2fd");
    identitaSection.innerHTML += `
        <label style="font-weight:bold;font-size:13px;margin-top:10px">Nome completo:</label>
        <input type="text" id="prof-nome" value="${profilo.nome || ''}"
               placeholder="Es: Mario Rossi"
               style="padding:8px;border:1px solid #ccc;border-radius:4px;font-size:13px">
        <small style="color:#666;font-size:11px">Questo nome verrà visualizzato nei calendari e report</small>

        <label style="font-weight:bold;font-size:13px;margin-top:15px">Ruolo:</label>
        <select id="prof-ruolo" style="padding:8px;border:1px solid #ccc;border-radius:4px" onchange="window.toggleRuoloCustom()">
            ${RUOLI_PREDEFINITI.map(r =>
                `<option value="${r.value}" ${(profilo.ruolo || 'infermiere') === r.value ? 'selected' : ''}>${r.emoji} ${r.label}</option>`
            ).join('')}
        </select>
        <small style="color:#666;font-size:11px">Ruolo professionale dell'operatore</small>

        <div id="ruolo-custom-container" style="display:${(profilo.ruolo === 'altro') ? 'block' : 'none'};margin-top:10px">
            <label style="font-weight:bold;font-size:13px">Specifica ruolo:</label>
            <input type="text" id="prof-ruolo-custom" value="${profilo.ruoloCustom || ''}"
                   placeholder="Es: Fisioterapista"
                   style="padding:8px;border:1px solid #ccc;border-radius:4px;font-size:13px;width:100%">
            <small style="color:#666;font-size:11px">Inserisci il ruolo personalizzato</small>
        </div>
    `;
    form.appendChild(identitaSection);

    // ===== SEZIONE 2: SEDI =====
    const sediSection = createSection("📍 Assegnazione Sedi", "#fff3e0");
    const sediHTML = `
        <label style="font-weight:bold;font-size:13px;margin-top:10px">Sede principale:</label>
        <select id="prof-sede-principale" style="padding:8px;border:1px solid #ccc;border-radius:4px">
            <option value="">-- Nessuna --</option>
            ${Object.entries(ambulatori).map(([k, v]) =>
                `<option value="${k}" ${profilo.sedePrincipale === k ? 'selected' : ''}>${v.nome}</option>`
            ).join('')}
        </select>
        <small style="color:#666;font-size:11px">Sede di riferimento principale dell'operatore</small>
    `;
    sediSection.innerHTML += sediHTML;
    form.appendChild(sediSection);

    // ===== SEZIONE 3: CONTRATTO =====
    const contrattoSection = createSection("📄 Contratto", "#f3e5f5");
    const contrattoHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
            <div>
                <label style="font-weight:bold;font-size:13px">Tipo contratto:</label>
                <select id="prof-contratto-tipo" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px">
                    <option value="full-time" ${profilo.contratto?.tipo === 'full-time' ? 'selected' : ''}>Full-Time</option>
                    <option value="part-time" ${profilo.contratto?.tipo === 'part-time' ? 'selected' : ''}>Part-Time</option>
                </select>
            </div>
            <div>
                <label style="font-weight:bold;font-size:13px">Ore settimanali:</label>
                <input type="number" id="prof-contratto-ore" value="${profilo.contratto?.oreSettimanali || 40}" min="1" max="60"
                       style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px">
            </div>
        </div>
        <small style="color:#666;font-size:11px;display:block;margin-top:5px">Ore settimanali contrattuali (usate per calcolo carichi di lavoro)</small>
    `;
    contrattoSection.innerHTML += contrattoHTML;
    form.appendChild(contrattoSection);

    // ===== SEZIONE 4: PREFERENZE =====
    const preferenzeSection = createSection("💡 Preferenze (soft - non bloccanti)", "#e8f5e9");
    // Carica preferenzeTurni esistenti (nuovo sistema) o migra da evitaTurni (legacy)
    const preferenzeTurni = profilo.preferenze?.preferenzeTurni || {};

    // Migrazione automatica da evitaTurni a preferenzeTurni
    if (!preferenzeTurni || Object.keys(preferenzeTurni).length === 0) {
        const evitaTurni = profilo.preferenze?.evitaTurni || [];
        evitaTurni.forEach(k => {
            preferenzeTurni[k] = -1; // Migra come "Evitato"
        });
    }

    const preferenzeHTML = `
        <small style="color:#666;font-size:11px;font-style:italic;display:block;margin-bottom:10px">
            Le preferenze guidano il sistema e influenzano la probabilità di assegnazione dei turni durante l'autogenerazione.
            <strong>Livelli:</strong> Molto preferito (+30 punti), Preferito (+15), Neutro (0), Evitato (-15), Molto evitato (-30)
        </small>
        <label style="font-weight:bold;font-size:13px;margin-top:10px">📊 Preferenze Turni:</label>
        <div id="prof-pref-turni" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-top:10px">
            ${Object.entries(turni)
                .filter(([k, t]) => !t.speciale) // Escludi turni speciali
                .map(([k, t]) => {
                    const livello = preferenzeTurni[k] || 0;
                    return `
                    <div style="display:flex;align-items:center;gap:8px;padding:8px;background:#f9f9f9;border-radius:4px">
                        <span style="display:inline-block;width:12px;height:12px;background:${t.colore};border-radius:2px;flex-shrink:0"></span>
                        <span style="font-size:11px;font-weight:bold;min-width:60px;flex-shrink:0">${k}</span>
                        <select class="turno-preferenza" data-turno="${k}" style="flex:1;padding:4px;border:1px solid #ccc;border-radius:4px;font-size:11px">
                            <option value="2" ${livello === 2 ? 'selected' : ''}>⭐⭐ Molto preferito</option>
                            <option value="1" ${livello === 1 ? 'selected' : ''}>⭐ Preferito</option>
                            <option value="0" ${livello === 0 ? 'selected' : ''}>➖ Neutro</option>
                            <option value="-1" ${livello === -1 ? 'selected' : ''}>❌ Evitato</option>
                            <option value="-2" ${livello === -2 ? 'selected' : ''}>❌❌ Molto evitato</option>
                        </select>
                    </div>
                `;
            }).join('')}
        </div>
        <small style="display:block;margin-top:8px;color:#666;font-size:10px">
            💡 Più alto è il livello, maggiore è la probabilità che il sistema assegni quel turno all'operatore durante l'autogenerazione.
        </small>
    `;
    preferenzeSection.innerHTML += preferenzeHTML;
    // Aggiungi sezione regole custom preferenze
    preferenzeSection.innerHTML += `
        <div style="margin-top:20px;padding-top:15px;border-top:1px dashed #ccc">
            <h4 style="font-size:13px;margin-bottom:10px">⚙️ Regole personalizzate</h4>
            <div id="prof-preferenze-regole-list" style="margin-bottom:10px"></div>
            <button type="button" class="config-btn config-add" style="font-size:12px;padding:6px 12px" onclick="window.aggiungiRegolaCustom('preferenza')">➕ Aggiungi regola</button>
        </div>
    `;
    form.appendChild(preferenzeSection);

    // ===== SEZIONE 5: VINCOLI =====
    const vincoliSection = createSection("⚠️ Vincoli Operativi (hard - forti)", "#ffebee");
    const vincoliHTML = `
        <small style="color:#d32f2f;font-size:11px;font-weight:bold;display:block;margin-bottom:10px">
            I vincoli rappresentano limiti operativi forti. Se violati, generano warning persistenti.
        </small>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
            <div>
                <label style="font-weight:bold;font-size:13px">Max ore settimanali:</label>
                <input type="number" id="prof-vincoli-maxore" value="${profilo.vincoli?.maxOreSettimanali || ''}"
                       placeholder="Es: 30" min="1" max="60"
                       style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px">
                <small style="color:#666;font-size:11px">Lascia vuoto per nessun limite</small>
            </div>
            <div>
                <label style="font-weight:bold;font-size:13px">Max giorni consecutivi:</label>
                <input type="number" id="prof-vincoli-maxgiorni" value="${profilo.vincoli?.maxGiorniConsecutivi || ''}"
                       placeholder="Es: 5" min="1" max="31"
                       style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px">
                <small style="color:#666;font-size:11px">Lascia vuoto per nessun limite</small>
            </div>
        </div>
        <div style="margin-top:10px">
            <label style="font-weight:bold;font-size:13px">Min ore di riposo:</label>
            <input type="number" id="prof-vincoli-minriposo" value="${profilo.vincoli?.minRiposoOre || 11}"
                   min="0" max="24"
                   style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px">
            <small style="color:#666;font-size:11px">Ore minime di riposo tra turni (default: 11h - normativa EU)</small>
        </div>
    `;
    vincoliSection.innerHTML += vincoliHTML;
    // Aggiungi sezione regole custom vincoli
    vincoliSection.innerHTML += `
        <div style="margin-top:20px;padding-top:15px;border-top:1px dashed #ccc">
            <h4 style="font-size:13px;margin-bottom:10px">⚙️ Regole personalizzate</h4>
            <div id="prof-vincoli-regole-list" style="margin-bottom:10px"></div>
            <button type="button" class="config-btn config-add" style="font-size:12px;padding:6px 12px" onclick="window.aggiungiRegolaCustom('vincolo')">➕ Aggiungi regola</button>
        </div>
    `;
    form.appendChild(vincoliSection);

    // Bottoni azione
    const actionsDiv = document.createElement("div");
    actionsDiv.style.display = "flex";
    actionsDiv.style.gap = "8px";
    actionsDiv.style.marginTop = "20px";
    actionsDiv.style.paddingTop = "20px";
    actionsDiv.style.borderTop = "1px solid #ddd";

    const btnSalva = document.createElement("button");
    btnSalva.className = "config-btn config-add";
    btnSalva.textContent = "💾 Salva Profilo";
    btnSalva.onclick = () => {
        if (window.salvaProfiloForm(index, profilo.id)) {
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

    // Inizializza regole custom temp DOPO che il DOM è pronto
    inizializzaRegoleTemp(profilo);
};
/**
 * Crea una sezione del form con titolo e colore
 */
function createSection(titolo, coloreBg) {
    const section = document.createElement("div");
    section.style.padding = "15px";
    section.style.background = coloreBg;
    section.style.borderRadius = "6px";
    section.innerHTML = `<h4 style="margin:0 0 10px 0;color:#424242">${titolo}</h4>`;
    return section;
}

/**
 * Salva profilo dal form
 */
window.salvaProfiloForm = function(index, oldId) {
    const nome = document.getElementById("prof-nome").value.trim();
    const ruolo = document.getElementById("prof-ruolo").value;
    const ruoloCustom = document.getElementById("prof-ruolo-custom").value.trim() || null;
    const sedePrincipale = document.getElementById("prof-sede-principale").value || null;
    const contrattoTipo = document.getElementById("prof-contratto-tipo").value;
    const contrattoOre = parseInt(document.getElementById("prof-contratto-ore").value) || 40;

    // Preferenze turni (nuovo sistema con livelli)
    const preferenzeTurni = {};
    document.querySelectorAll(".turno-preferenza").forEach(select => {
        const turno = select.dataset.turno;
        const livello = parseInt(select.value);
        if (livello !== 0) { // Salva solo se non è neutro
            preferenzeTurni[turno] = livello;
        }
    });

    // Vincoli
    const maxOre = parseInt(document.getElementById("prof-vincoli-maxore").value) || null;
    const maxGiorni = parseInt(document.getElementById("prof-vincoli-maxgiorni").value) || null;
    const minRiposo = parseInt(document.getElementById("prof-vincoli-minriposo").value) || 11;

    // Costruisci profilo
    const profilo = {
        id: oldId || `OP_${nome.replace(/\s+/g, '_')}_${Date.now()}`,
        nome,
        ruolo,
        ruoloCustom,
        sedePrincipale,
        sediSecondarie: [],
        contratto: {
            tipo: contrattoTipo,
            oreSettimanali: contrattoOre
        },
        preferenze: {
            sedePreferita: sedePrincipale,
            evitaSede: null,
            preferenzeTurni, // Nuovo sistema con livelli
            evitaTurni: [], // Mantieni vuoto per retrocompatibilità
            giorniPreferiti: [],
            giorniDaEvitare: [],
            regole: getRegoleCustomDaSalvare().preferenze
        },
        vincoli: {
            maxOreSettimanali: maxOre,
            maxGiorniConsecutivi: maxGiorni,
            minRiposoOre: minRiposo,
            regole: getRegoleCustomDaSalvare().vincoli
        }
    };

    // Valida
    const errori = validaProfilo(profilo);
    if (errori.length > 0) {
        alert("Errori:\n" + errori.join("\n"));
        return false;
    }

    // Salva
    if (index !== null) {
        aggiornaProfilo(index, profilo);
    } else {
        aggiungiOperatore(profilo);
    }

    renderConfig();
    return true;
};

/**
 * Mostra/nasconde campo ruolo custom
 */
window.toggleRuoloCustom = function() {
    const ruoloSelect = document.getElementById("prof-ruolo");
    const customContainer = document.getElementById("ruolo-custom-container");
    if (ruoloSelect && customContainer) {
        customContainer.style.display = ruoloSelect.value === "altro" ? "block" : "none";
    }
};

window.eliminaProfilo = function(index) {
    const operatori = caricaOperatori();
    const nome = getNomeOperatore(operatori[index]);

    if (!confirm(`Vuoi eliminare il profilo di "${nome}"?\n\nAttenzione: i turni assegnati NON verranno eliminati.`)) {
        return;
    }

    rimuoviOperatore(index);
    renderConfig();
};
