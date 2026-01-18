/**
 * render/anno.js - Rendering vista annuale
 */

import { annoCorrente, operatori, turni, ambulatori, vistaAnnoMode, setVistaAnnoMode } from '../state.js';
import { giorniNelMese, primoGiornoMese, getNomeMese, getNomiGiorniSettimana } from '../calendar.js';
import { caricaTurno, caricaNota } from '../storage.js';
import { calcolaOreOperatore, calcolaMinutiOperatore, getOrarioDettaglioTurno, calcolaOreTurno } from '../turni.js';
import { getNomeOperatore, getIdOperatore } from '../profili.js';

export function renderAnno(anno = annoCorrente) {
    const container = document.getElementById("anno");

    container.innerHTML = `
        <h3>📅 Vista Anno ${anno}</h3>
    `;

    // Controlli navigazione
    let navAnno = document.createElement("div");
    navAnno.className = "nav-controls";
    navAnno.innerHTML = `
        <button id="btn-anno-prev" onclick="window.annoPrecedente()">⬅️ Precedente</button>
        <span class="nav-title">${anno}</span>
        <button id="btn-anno-next" onclick="window.annoSuccessivo()">Successivo ➡️</button>
        <small class="nav-info" id="anno-info"></small>
    `;
    container.appendChild(navAnno);

    // Toggle visualizzazione
    let toggleMode = document.createElement("div");
    toggleMode.style.marginBottom = "15px";
    toggleMode.style.textAlign = "center";
    toggleMode.innerHTML = `
        <label style="margin-right:10px;font-weight:bold;color:#666">Visualizzazione:</label>
        <button class="config-btn ${vistaAnnoMode === 'grid' ? 'config-add' : 'config-clear'}"
                onclick="window.toggleVistaAnnoMode('grid')"
                style="font-size:13px;padding:6px 10px">
            📊 Griglia
        </button>
        <button class="config-btn ${vistaAnnoMode === 'column' ? 'config-add' : 'config-clear'}"
                onclick="window.toggleVistaAnnoMode('column')"
                style="font-size:13px;padding:6px 10px">
            📋 Colonna
        </button>
    `;
    container.appendChild(toggleMode);

    // Info testo
    let infoText = document.createElement("p");
    infoText.className = "info-text";
    infoText.textContent = "Clicca su una cella per assegnare un turno • Doppio click o click destro per cancellare";
    container.appendChild(infoText);

    // Contenitore mesi
    let gridContainer = document.createElement("div");

    if (vistaAnnoMode === 'grid') {
        gridContainer.style.display = "grid";
        gridContainer.style.gridTemplateColumns = "repeat(auto-fit, minmax(300px, 1fr))";
        gridContainer.style.gap = "20px";
        gridContainer.style.marginTop = "20px";
    } else {
        gridContainer.style.display = "flex";
        gridContainer.style.flexDirection = "column";
        gridContainer.style.gap = "30px";
        gridContainer.style.marginTop = "20px";
    }

    // Render tutti i 12 mesi
    for (let m = 0; m < 12; m++) {
        let meseBox = document.createElement("div");
        meseBox.style.background = "white";
        meseBox.style.padding = "15px";
        meseBox.style.borderRadius = "8px";
        meseBox.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";

        let meseTitle = document.createElement("h4");
        meseTitle.textContent = `${getNomeMese(m)} ${anno}`;
        meseTitle.style.marginTop = "0";
        meseTitle.style.marginBottom = "10px";
        meseTitle.style.textAlign = "center";
        meseTitle.style.color = "#1e88e5";
        meseBox.appendChild(meseTitle);

        // Render tabella mese compatta
        renderMiniMese(meseBox, anno, m, vistaAnnoMode === 'grid');

        gridContainer.appendChild(meseBox);
    }

    container.appendChild(gridContainer);

    // Riepilogo annuale
    renderRiepilogoAnnuale(container, anno);
}

function renderMiniMese(container, anno, mese, compatto = true) {
    const giorni = giorniNelMese(anno, mese);
    let table = document.createElement("table");
    table.style.fontSize = compatto ? "9px" : "10px";
    table.style.width = "100%";

    let weekDays = getNomiGiorniSettimana();
    let primoGiorno = primoGiornoMese(anno, mese);

    let thead = "<tr><th style='font-size:" + (compatto ? "9px" : "10px") + ";padding:2px'>Op.</th>";
    for (let g = 1; g <= giorni; g++) {
        let dayOfWeek = (primoGiorno + g - 1) % 7;
        let dayLabel = weekDays[dayOfWeek];
        let isWeekend = dayOfWeek >= 5; // Sab=5, Dom=6

        thead += `<th style="font-size:${compatto ? '8px' : '9px'};padding:2px;${isWeekend ? 'background:#ffe0e0' : ''}">
            <span style="font-size:0.8em;color:#999">${dayLabel}</span><br>${g}
        </th>`;
    }
    thead += compatto ? "" : "<th style='font-size:9px;padding:2px'>Tot</th>";
    thead += "</tr>";
    table.innerHTML = thead;

    operatori.forEach(op => {
        const oreOperatore = calcolaOreOperatore(op, anno, mese);
        const minutiOperatore = calcolaMinutiOperatore(op, anno, mese);

        let styleOre = "color:#666;font-weight:normal";
        let iconaWarning = "";
        if (minutiOperatore > 10800) { // >180h
            styleOre = "color:#d32f2f;font-weight:bold";
            iconaWarning = " ⚠️";
        }

        const opId = getIdOperatore(op);
        const opNome = getNomeOperatore(op);

        let row = `<tr data-operatore="${opId}">
            <td class="operator" style="font-size:${compatto ? '9px' : '10px'};padding:2px;text-align:left;min-width:${compatto ? '40px' : '60px'}">${compatto ? opNome.substring(0, 3) : opNome}</td>`;

        for (let g = 1; g <= giorni; g++) {
            let turnoSalvato = caricaTurno(op, g, anno, mese);
            let nota = caricaNota(op, g, anno, mese);
            let cellStyle = "cursor:pointer;padding:2px;";

            if (turnoSalvato && turni[turnoSalvato]) {
                cellStyle += `background:${turni[turnoSalvato].colore};color:white;font-weight:bold`;
            }

            if (nota && nota.testo) {
                cellStyle += ";box-shadow:inset 0 0 0 2px #ff9800";
            }

            let contenuto = turnoSalvato || "";
            if (nota && nota.testo && !compatto) {
                contenuto += `<span class="note-badge" style="font-size:7px">N</span>`;
            }

            let tooltipText = "";
            if (turnoSalvato && turni[turnoSalvato]) {
                const orarioDettaglio = getOrarioDettaglioTurno(turnoSalvato, ambulatori);
                const oreCalcolate = calcolaOreTurno(turnoSalvato);
                tooltipText = `${turni[turnoSalvato].nome} • ${orarioDettaglio} • ${oreCalcolate}h`;
                if (nota && nota.testo) {
                    tooltipText += `\n📝 ${nota.testo}`;
                }
            } else if (nota && nota.testo) {
                tooltipText = nota.testo;
            }

            row += `<td style="${cellStyle}" data-operatore="${opId}" data-giorno="${g}" data-anno="${anno}" data-mese="${mese}" title="${tooltipText}" onclick="window.assegnaTurno(event, '${opId}', ${g}, ${anno}, ${mese})">${contenuto}</td>`;
        }

        if (!compatto) {
            row += `<td style="font-size:9px;padding:2px;${styleOre}">${oreOperatore}${iconaWarning}</td>`;
        }

        row += "</tr>";
        table.innerHTML += row;
    });

    container.appendChild(table);
}

function renderRiepilogoAnnuale(container, anno) {
    let riepilogo = document.createElement("div");
    riepilogo.className = "config-section config-info";
    riepilogo.style.marginTop = "30px";
    riepilogo.innerHTML = `<h4>📊 Riepilogo Annuale ${anno}</h4>`;

    // Calcola totali per operatore
    let totaliOp = {};
    operatori.forEach(op => {
        let minutiTotali = 0;
        for (let m = 0; m < 12; m++) {
            minutiTotali += calcolaMinutiOperatore(op, anno, m);
        }
        totaliOp[getIdOperatore(op)] = minutiTotali;
    });

    // Tabella riepilogo operatori
    let tableOp = document.createElement("table");
    tableOp.style.width = "100%";
    tableOp.style.marginTop = "10px";
    tableOp.innerHTML = `
        <tr>
            <th>Operatore</th>
            <th>Ore Totali Anno</th>
            <th>Media Mensile</th>
        </tr>
    `;

    Object.entries(totaliOp).forEach(([opId, minuti]) => {
        const ore = Math.floor(minuti / 60);
        const min = minuti % 60;
        const oreTotali = `${ore}:${min.toString().padStart(2, '0')}`;
        const mediaMensile = `${Math.floor(minuti / 12 / 60)}:${Math.floor((minuti / 12) % 60).toString().padStart(2, '0')}`;

        let styleOre = "";
        if (minuti > 129600) { // >2160h annue (180h/mese)
            styleOre = "color:#d32f2f;font-weight:bold";
        }

        // Trova l'operatore dall'ID per mostrare il nome
        const op = operatori.find(o => getIdOperatore(o) === opId) || opId;
        const opNome = getNomeOperatore(op);

        tableOp.innerHTML += `
            <tr>
                <td style="font-weight:bold">${opNome}</td>
                <td style="${styleOre}">${oreTotali}</td>
                <td>${mediaMensile}</td>
            </tr>
        `;
    });

    riepilogo.appendChild(tableOp);
    container.appendChild(riepilogo);
}

// Toggle visualizzazione
window.toggleVistaAnnoMode = function(mode) {
    setVistaAnnoMode(mode);
    renderAnno();
};
