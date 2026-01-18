/**
 * render/coverage-panel.js - Pannello avvisi copertura
 *
 * Mostra avvisi di copertura sotto il calendario mensile.
 */

import { verificaMese, contaAvvisi, caricaRegole } from '../coverage.js';
import { ambulatori, turni, viewMode } from '../state.js';
import { getNomeMese } from '../calendar.js';

/**
 * Renderizza il pannello avvisi copertura per un mese
 */
export function renderCoveragePanel(container, anno, mese) {
    // Rimuovi pannello precedente se esiste
    let oldPanel = container.querySelector("#coverage-panel");
    if (oldPanel) oldPanel.remove();

    // Carica regole
    const regole = caricaRegole();

    // Verifica mese
    const avvisi = verificaMese(anno, mese, regole);

    // Se non ci sono avvisi, non mostrare il pannello
    if (avvisi.length === 0) {
        return;
    }

    // Conta per severità
    const conteggio = contaAvvisi(avvisi);

    // Crea pannello
    const panel = document.createElement("div");
    panel.id = "coverage-panel";
    panel.className = "config-section";
    panel.style.marginTop = "20px";
    panel.style.background = "#fff3e0";
    panel.style.borderLeft = "4px solid #ff9800";

    // Header
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.marginBottom = "15px";

    const title = document.createElement("h4");
    title.textContent = viewMode.mostraBozza
        ? "⚠️ Avvisi Copertura Turni (bozza)"
        : "⚠️ Avvisi Copertura Turni";
    title.style.margin = "0";
    title.style.color = "#e65100";

    const badge = document.createElement("span");
    badge.style.padding = "4px 10px";
    badge.style.background = "#ff9800";
    badge.style.color = "white";
    badge.style.borderRadius = "12px";
    badge.style.fontSize = "12px";
    badge.style.fontWeight = "bold";
    badge.textContent = `${conteggio.totale} avviso${conteggio.totale > 1 ? 'i' : ''}`;

    header.appendChild(title);
    header.appendChild(badge);
    panel.appendChild(header);

    // Info testo
    const info = document.createElement("p");
    info.className = "info-text";
    info.style.marginTop = "0";
    info.style.marginBottom = "15px";
    info.style.fontSize = "12px";
    info.textContent = `${getNomeMese(mese)} ${anno} — ${conteggio.warning} critici, ${conteggio.info} informativi`;
    panel.appendChild(info);

    // Lista avvisi
    const lista = document.createElement("div");
    lista.style.maxHeight = "300px";
    lista.style.overflowY = "auto";
    lista.style.display = "flex";
    lista.style.flexDirection = "column";
    lista.style.gap = "8px";

    avvisi.forEach(avviso => {
        const item = document.createElement("div");
        item.style.padding = "10px";
        item.style.background = avviso.severita === "warning" ? "#ffebee" : "#e3f2fd";
        item.style.borderLeft = `3px solid ${avviso.severita === "warning" ? "#d32f2f" : "#1e88e5"}`;
        item.style.borderRadius = "3px";
        item.style.fontSize = "13px";

        // Giorno
        const giornoSpan = document.createElement("strong");
        giornoSpan.textContent = `${avviso.giorno} ${getNomeMese(mese)}`;
        giornoSpan.style.color = avviso.severita === "warning" ? "#d32f2f" : "#1565c0";
        item.appendChild(giornoSpan);

        // Descrizione
        const desc = document.createElement("div");
        desc.style.marginTop = "4px";
        desc.style.color = "#555";
        desc.textContent = avviso.descrizione;
        item.appendChild(desc);

        // Dettagli mancanti
        if (avviso.mancanti && avviso.mancanti.length > 0) {
            const dettagli = document.createElement("div");
            dettagli.style.marginTop = "8px";
            dettagli.style.fontSize = "12px";
            dettagli.style.color = "#666";
            dettagli.innerHTML = "<strong>Mancanti:</strong>";

            const ul = document.createElement("ul");
            ul.style.margin = "4px 0 0 0";
            ul.style.paddingLeft = "20px";

            avviso.mancanti.forEach(m => {
                const li = document.createElement("li");
                const ambNome = ambulatori[m.ambulatorio]?.nome || m.ambulatorio;
                const turnoNome = turni[m.turno]?.nome || m.turno;
                li.innerHTML = `<strong>${m.turno}</strong> (${ambNome}, ${turnoNome}) — Richiesti: ${m.richiesti}, Presenti: ${m.presenti}`;
                ul.appendChild(li);
            });

            dettagli.appendChild(ul);
            item.appendChild(dettagli);
        }

        lista.appendChild(item);
    });

    panel.appendChild(lista);

    // Footer con link configurazione
    const footer = document.createElement("div");
    footer.style.marginTop = "15px";
    footer.style.paddingTop = "10px";
    footer.style.borderTop = "1px solid #ffcc80";
    footer.style.fontSize = "12px";
    footer.style.color = "#666";
    footer.innerHTML = `💡 <a href="#" onclick="window.showView('config'); window.scrollToSection('coverage-config'); return false;" style="color:#1e88e5;text-decoration:none">Gestisci regole di copertura</a> nella configurazione`;
    panel.appendChild(footer);

    // Aggiungi al container
    container.appendChild(panel);
}
