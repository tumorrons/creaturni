/**
 * render/note-editor.js - Editor inline per le note
 */

import { operatori, ambulatori, notaCorrente, setNotaCorrente } from '../state.js';
import { giorniNelMese, getNomeMese } from '../calendar.js';
import { caricaNota, salvaNota } from '../storage.js';
import { renderMese } from './mese.js';

export function renderBoxNoteMese(container, anno, mese) {
    let boxVecchio = container.querySelector(".config-note");
    if (boxVecchio) boxVecchio.remove();

    let box = document.createElement("div");
    box.className = "config-section config-note";
    box.style.marginTop = "20px";
    box.innerHTML = `<h4>📝 Note del mese</h4>`;

    let trovate = false;

    operatori.forEach(op => {
        for (let g = 1; g <= giorniNelMese(anno, mese); g++) {
            let nota = caricaNota(op, g, anno, mese);
            if (nota && nota.testo) {
                trovate = true;
                let item = document.createElement("div");
                item.style.padding = "8px";
                item.style.marginBottom = "8px";
                item.style.background = "#f5f5f5";
                item.style.borderLeft = "3px solid #1e88e5";
                item.style.cursor = "pointer";
                item.style.borderRadius = "2px";
                item.style.transition = "all 0.2s";
                item.title = "Doppio click per modificare la nota";
                item.onmouseover = () => item.style.background = "#e3f2fd";
                item.onmouseout = () => item.style.background = "#f5f5f5";

                item.innerHTML = `
                    <strong>${g}/${mese+1}</strong> — ${op}
                    ${nota.ambulatorio ? `<small style="color:#666">(${ambulatori[nota.ambulatorio]?.nome})</small>` : ""}
                    <br><small style="color:#333">${nota.testo}</small>
                `;

                item.ondblclick = () => {
                    window.mostraEditorNotaInline(op, g, anno, mese);
                };

                box.appendChild(item);
            }
        }
    });

    if (!trovate) {
        box.innerHTML += `<p class="info-text" style="text-align:center">Nessuna nota inserita</p>`;
    }

    container.appendChild(box);
}

export function renderEditorNotaInline(container) {
    let old = container.querySelector("#noteInline");
    if (old) old.remove();

    let box = document.createElement("div");
    box.id = "noteInline";
    box.className = "config-section config-info";
    box.style.marginTop = "20px";
    box.style.display = "none";
    box.innerHTML = `
        <h4>📝 Modifica Nota</h4>
        <div id="noteInlineInfo" class="info-text" style="margin-bottom:10px;font-weight:bold;color:#1e88e5"></div>

        <label style="display:block;margin-bottom:5px;font-weight:bold;font-size:13px">Ambulatorio:</label>
        <select id="noteInlineAmbulatorio" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;margin-bottom:10px">
            <option value="">— Seleziona ambulatorio —</option>
        </select>

        <label style="display:block;margin-bottom:5px;font-weight:bold;font-size:13px">Testo nota:</label>
        <textarea id="noteInlineText" placeholder="Scrivi la nota qui..." style="width:100%;min-height:100px;padding:8px;border:1px solid #ccc;border-radius:4px;font-family:Arial,sans-serif;font-size:13px;resize:vertical"></textarea>

        <div style="margin-top:10px;display:flex;gap:8px">
            <button class="config-btn config-add" onclick="window.salvaNotaInline(this)">💾 Salva</button>
            <button class="config-btn config-remove" onclick="window.eliminaNotaInline()">🗑️ Elimina</button>
            <button class="config-btn config-clear" onclick="window.chiudiEditorInline()">✖ Chiudi</button>
        </div>
    `;
    container.appendChild(box);
}

export function mostraEditorNotaInline(operatore, giorno, anno, mese) {
    setNotaCorrente({ operatore, giorno, anno, mese });

    const box = document.getElementById("noteInline");
    if (!box) return;

    box.style.display = "block";

    document.getElementById("noteInlineInfo").textContent =
        `${operatore} — Giorno ${giorno} (${getNomeMese(mese)} ${anno})`;

    const nota = caricaNota(operatore, giorno, anno, mese);
    document.getElementById("noteInlineText").value = nota?.testo || "";

    const ambSel = document.getElementById("noteInlineAmbulatorio");
    ambSel.innerHTML = `<option value="">— Seleziona ambulatorio —</option>`;
    Object.entries(ambulatori).forEach(([k, v]) => {
        let o = document.createElement("option");
        o.value = k;
        o.textContent = v.nome;
        o.selected = nota?.ambulatorio === k;
        ambSel.appendChild(o);
    });

    document.getElementById("noteInlineText").focus();
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function salvaNotaInline(btn) {
    const { operatore, giorno, anno, mese } = notaCorrente;
    if (!operatore) return;

    const testo = document.getElementById("noteInlineText").value.trim();
    const ambulatorio = document.getElementById("noteInlineAmbulatorio").value;

    if (testo) {
        salvaNota(operatore, giorno, {
            testo,
            operatore,
            ambulatorio: ambulatorio || null
        }, anno, mese);
    } else {
        salvaNota(operatore, giorno, null, anno, mese);
    }

    renderMese(anno, mese);

    const originalText = btn.textContent;
    btn.textContent = "✅ Salvato!";
    btn.style.background = "#388e3c";
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = "";
    }, 1500);
}

export function eliminaNotaInline() {
    const { operatore, giorno, anno, mese } = notaCorrente;
    if (!operatore) return;

    if (!confirm("Vuoi eliminare definitivamente questa nota?")) return;

    salvaNota(operatore, giorno, null, anno, mese);
    renderMese(anno, mese);
    chiudiEditorInline();
}

export function chiudiEditorInline() {
    const box = document.getElementById("noteInline");
    if (box) {
        box.style.display = "none";
    }

    document.getElementById("noteInlineText").value = "";
    document.getElementById("noteInlineAmbulatorio").value = "";
    setNotaCorrente({ operatore: null, giorno: null, anno: null, mese: null });
}
