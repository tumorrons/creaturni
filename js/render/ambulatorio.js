/**
 * render/ambulatorio.js - Rendering vista ambulatori
 */

import { annoCorrente, meseCorrente, operatori, turni, ambulatori } from '../state.js';
import { giorniNelMese, primoGiornoMese, getNomeMese, getNomiGiorniSettimana, getNomeGiorno } from '../calendar.js';
import { caricaTurno, caricaNota } from '../storage.js';
import { calcolaOreAmbulatorio, calcolaMinutiAmbulatorio, getOrarioDettaglioTurno, calcolaOreTurno, calcolaMinutiTurno } from '../turni.js';
import { raccogliNoteAmbulatorio } from '../note.js';
import { getNomeOperatore, getIdOperatore } from '../profili.js';

export function renderAmbulatorio(anno = annoCorrente, mese = meseCorrente) {
    const container = document.getElementById("ambulatorio");

    container.innerHTML = `<h3>🏥 Vista Ambulatori</h3>`;

    // Controlli navigazione
    let navAmb = document.createElement("div");
    navAmb.className = "nav-controls";
    navAmb.innerHTML = `
        <button id="btn-amb-prev" onclick="window.mesePrecedente()">⬅️ Precedente</button>
        <span class="nav-title">${getNomeMese(mese)} ${anno}</span>
        <button id="btn-amb-next" onclick="window.meseSuccessivo()">Successivo ➡️</button>
    `;
    container.appendChild(navAmb);

    let infoText = document.createElement("p");
    infoText.className = "info-text";
    infoText.textContent = "Visualizza i turni raggruppati per ambulatorio/sede";
    container.appendChild(infoText);

    // Render ogni ambulatorio
    Object.entries(ambulatori).forEach(([codiceAmb, amb]) => {
        renderAmbulatorioDett(container, codiceAmb, amb, anno, mese);
    });

    // Riepilogo generale
    renderRiepilogoAmbulatori(container, anno, mese);
}

function renderAmbulatorioDett(container, codiceAmb, ambulatorio, anno, mese) {
    let box = document.createElement("div");
    box.className = "config-section config-info";
    box.style.marginBottom = "20px";

    const oreAmb = calcolaOreAmbulatorio(codiceAmb, anno, mese, operatori);
    const minutiAmb = calcolaMinutiAmbulatorio(codiceAmb, anno, mese, operatori);

    box.innerHTML = `
        <h4>🏥 ${ambulatorio.nome} (${codiceAmb}) — ${oreAmb} ore totali</h4>
    `;

    const giorni = giorniNelMese(anno, mese);

    // Tabella turni ambulatorio
    let table = document.createElement("table");
    table.style.marginTop = "10px";
    table.style.fontSize = "11px";

    let weekDays = getNomiGiorniSettimana();
    let primoGiorno = primoGiornoMese(anno, mese);

    // Header
    let thead = "<tr><th>Operatore</th>";
    for (let g = 1; g <= giorni; g++) {
        let dayOfWeek = (primoGiorno + g - 1) % 7;
        let dayLabel = weekDays[dayOfWeek];
        let isWeekend = dayOfWeek >= 5;

        thead += `<th style="${isWeekend ? 'background:#ffe0e0' : ''}">
            <span style="font-size:0.85em;color:#666">${dayLabel}</span><br>${g}
        </th>`;
    }
    thead += "<th>Ore</th></tr>";
    table.innerHTML = thead;

    // Righe operatori
    operatori.forEach(op => {
        let oreOpAmb = 0;
        let hasLavoratoQui = false;

        // Pre-calcolo per vedere se l'operatore ha lavorato in questo ambulatorio
        for (let g = 1; g <= giorni; g++) {
            const turnoCode = caricaTurno(op, g, anno, mese);
            if (turnoCode && turni[turnoCode]) {
                const turno = turni[turnoCode];

                // TURNI A SEGMENTI: conta solo segmenti di questo ambulatorio
                if (Array.isArray(turno.segmenti) && turno.segmenti.length > 0) {
                    turno.segmenti.forEach(seg => {
                        if (seg.ambulatorio === codiceAmb) {
                            hasLavoratoQui = true;
                        }
                    });
                }
                // TURNO SINGOLO: conta se è dell'ambulatorio
                else if (turno.ambulatorio === codiceAmb) {
                    hasLavoratoQui = true;
                }
            }
        }

        if (!hasLavoratoQui) return; // Skip operatori che non hanno lavorato qui

        const opId = getIdOperatore(op);
        const opNome = getNomeOperatore(op);

        let row = `<tr data-operatore="${opId}">
            <td class="operator" style="padding:4px;text-align:left">${opNome}</td>`;

        for (let g = 1; g <= giorni; g++) {
            const turnoCode = caricaTurno(op, g, anno, mese);
            const nota = caricaNota(op, g, anno, mese);
            let cellStyle = "cursor:pointer;padding:4px;";
            let contenuto = "";
            let tooltipText = "";

            if (turnoCode && turni[turnoCode]) {
                const turno = turni[turnoCode];
                let appartieneQui = false;
                let minutiQui = 0;

                // TURNI A SEGMENTI
                if (Array.isArray(turno.segmenti) && turno.segmenti.length > 0) {
                    turno.segmenti.forEach(seg => {
                        if (seg.ambulatorio === codiceAmb && seg.ingresso && seg.uscita) {
                            appartieneQui = true;
                            let m = parseInt(seg.uscita.split(':')[0]) * 60 + parseInt(seg.uscita.split(':')[1])
                                  - (parseInt(seg.ingresso.split(':')[0]) * 60 + parseInt(seg.ingresso.split(':')[1]));
                            if (m < 0) m += 1440;
                            const pausa = seg.pausa || 0;
                            if (turno.sottraiPausa && pausa) {
                                m -= pausa;
                            }
                            minutiQui += Math.max(0, m);
                        }
                    });
                }
                // TURNO SINGOLO
                else if (turno.ambulatorio === codiceAmb) {
                    appartieneQui = true;
                    minutiQui = calcolaMinutiTurno(turnoCode);
                }

                if (appartieneQui) {
                    oreOpAmb += minutiQui;
                    cellStyle += `background:${turno.colore};color:white;font-weight:bold`;
                    contenuto = turnoCode;

                    const orarioDettaglio = getOrarioDettaglioTurno(turnoCode, ambulatori);
                    const oreCalcolate = calcolaOreTurno(turnoCode);
                    tooltipText = `${turno.nome} • ${orarioDettaglio} • ${oreCalcolate}h`;
                }
            }

            if (nota && nota.testo && (nota.ambulatorio === codiceAmb || !nota.ambulatorio)) {
                if (contenuto) {
                    cellStyle += ";box-shadow:inset 0 0 0 2px #ff9800";
                    tooltipText += `\n📝 ${nota.testo}`;
                } else {
                    cellStyle += "box-shadow:inset 0 0 0 2px #ff9800";
                    tooltipText = `📝 ${nota.testo}`;
                }
                if (!contenuto) {
                    contenuto = `<span class="note-badge">N</span>`;
                }
            }

            if (!contenuto) contenuto = g;

            row += `<td style="${cellStyle}" data-operatore="${opId}" data-giorno="${g}" data-anno="${anno}" data-mese="${mese}" title="${tooltipText}" onclick="window.assegnaTurno(event, '${opId}', ${g}, ${anno}, ${mese})">${contenuto}</td>`;
        }

        const oreOp = Math.floor(oreOpAmb / 60);
        const minOp = oreOpAmb % 60;
        row += `<td style="font-weight:bold;padding:4px">${oreOp}:${minOp.toString().padStart(2, '0')}</td>`;
        row += "</tr>";
        table.innerHTML += row;
    });

    box.appendChild(table);

    // Note ambulatorio
    renderNoteAmbulatorio(box, codiceAmb, anno, mese);

    container.appendChild(box);
}

function renderNoteAmbulatorio(container, codiceAmb, anno, mese) {
    const note = raccogliNoteAmbulatorio(operatori, anno, mese, codiceAmb);

    if (note.length === 0) return;

    let noteBox = document.createElement("div");
    noteBox.style.marginTop = "15px";
    noteBox.style.padding = "10px";
    noteBox.style.background = "#fff9c4";
    noteBox.style.borderRadius = "4px";
    noteBox.style.borderLeft = "4px solid #fbc02d";
    noteBox.innerHTML = `<strong style="color:#666">📝 Note:</strong>`;

    note.forEach(item => {
        let noteItem = document.createElement("div");
        noteItem.style.marginTop = "5px";
        noteItem.style.fontSize = "12px";
        noteItem.innerHTML = `
            <strong>${item.giorno}/${mese+1}</strong> — ${getNomeOperatore(item.operatore)}:
            <span style="color:#333">${item.nota.testo}</span>
        `;
        noteBox.appendChild(noteItem);
    });

    container.appendChild(noteBox);
}

function renderRiepilogoAmbulatori(container, anno, mese) {
    let riepilogo = document.createElement("div");
    riepilogo.className = "config-section config-turni";
    riepilogo.style.marginTop = "30px";
    riepilogo.innerHTML = `<h4>📊 Riepilogo Ore per Ambulatorio</h4>`;

    let table = document.createElement("table");
    table.style.width = "100%";
    table.style.marginTop = "10px";
    table.innerHTML = `
        <tr>
            <th>Ambulatorio</th>
            <th>Codice</th>
            <th>Ore Totali</th>
            <th>Giorni Coperti</th>
        </tr>
    `;

    const giorni = giorniNelMese(anno, mese);

    Object.entries(ambulatori).forEach(([codiceAmb, amb]) => {
        const minutiAmb = calcolaMinutiAmbulatorio(codiceAmb, anno, mese, operatori);
        const ore = Math.floor(minutiAmb / 60);
        const min = minutiAmb % 60;
        const oreAmb = `${ore}:${min.toString().padStart(2, '0')}`;

        // Conta giorni coperti
        let giorniCoperti = 0;
        for (let g = 1; g <= giorni; g++) {
            let coperto = false;
            operatori.forEach(op => {
                const turnoCode = caricaTurno(op, g, anno, mese);
                if (turnoCode && turni[turnoCode]) {
                    const turno = turni[turnoCode];
                    if (Array.isArray(turno.segmenti) && turno.segmenti.length > 0) {
                        turno.segmenti.forEach(seg => {
                            if (seg.ambulatorio === codiceAmb) coperto = true;
                        });
                    } else if (turno.ambulatorio === codiceAmb) {
                        coperto = true;
                    }
                }
            });
            if (coperto) giorniCoperti++;
        }

        table.innerHTML += `
            <tr>
                <td style="font-weight:bold">${amb.nome}</td>
                <td>${codiceAmb}</td>
                <td>${oreAmb}</td>
                <td>${giorniCoperti}/${giorni}</td>
            </tr>
        `;
    });

    riepilogo.appendChild(table);
    container.appendChild(riepilogo);
}
