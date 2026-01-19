/**
 * render/stampa.js - Rendering vista stampa
 */

import { annoCorrente, meseCorrente, mesiVisibili, operatori, turni, ambulatori } from '../state.js';
import { giorniNelMese, primoGiornoMese, getNomeMese, getNomiGiorniSettimana } from '../calendar.js';
import { caricaTurno, caricaNota } from '../storage.js';
import { calcolaOreOperatore, calcolaMinutiOperatore, calcolaOreAmbulatorio, getOrarioDettaglioTurno, calcolaOreTurno } from '../turni.js';
import { raccogliNoteMese } from '../note.js';
import { getNomeOperatore, getIdOperatore } from '../profili.js';

export function renderStampa(anno = annoCorrente, mese = meseCorrente) {
    const container = document.getElementById("stampa");

    container.innerHTML = `<h3>🖨️ Vista Stampa</h3>`;

    // Controlli navigazione
    let navStampa = document.createElement("div");
    navStampa.className = "nav-controls";
    navStampa.innerHTML = `
        <button id="btn-stampa-prev" onclick="window.mesePrecedente()">⬅️ Precedente</button>
        <span class="nav-title">${getNomeMese(mese)} ${anno}</span>
        <button id="btn-stampa-next" onclick="window.meseSuccessivo()">Successivo ➡️</button>
    `;
    container.appendChild(navStampa);

    // Opzioni stampa
    let opzioniStampa = document.createElement("div");
    opzioniStampa.className = "config-section config-azioni print-options";

    // Costruisci opzioni ambulatori
    let opzioniAmbulatori = '<option value="">Tutti gli ambulatori</option>';
    Object.entries(ambulatori).forEach(([codice, amb]) => {
        opzioniAmbulatori += `<option value="${codice}">${amb.nome} (${codice})</option>`;
    });

    opzioniStampa.innerHTML = `
        <h4>⚙️ Opzioni Stampa</h4>
        <div style="margin-bottom:10px">
            <label style="font-weight:bold;display:block;margin-bottom:5px">Filtra per ambulatorio:</label>
            <select id="stampa-ambulatorio-select" onchange="window.aggiornaStampa()" style="padding:8px;border:1px solid #ccc;border-radius:4px;width:100%">
                ${opzioniAmbulatori}
            </select>
        </div>
        <div style="margin-bottom:10px">
            <label style="font-weight:bold;display:block;margin-bottom:5px">Numero di mesi da stampare:</label>
            <select id="stampa-mesi-select" onchange="window.aggiornaStampa()" style="padding:8px;border:1px solid #ccc;border-radius:4px">
                <option value="1">Solo questo mese</option>
                <option value="3">3 mesi</option>
                <option value="6">6 mesi</option>
                <option value="12">Anno intero (12 mesi)</option>
            </select>
        </div>
        <div style="margin-bottom:10px">
            <label style="display:inline-flex;align-items:center;cursor:pointer">
                <input type="checkbox" id="stampa-legenda" checked onchange="window.aggiornaStampa()" style="margin-right:8px">
                <span>Mostra legenda turni</span>
            </label>
        </div>
        <div style="margin-bottom:10px">
            <label style="display:inline-flex;align-items:center;cursor:pointer">
                <input type="checkbox" id="stampa-note" checked onchange="window.aggiornaStampa()" style="margin-right:8px">
                <span>Mostra note del mese</span>
            </label>
        </div>
        <div style="margin-bottom:10px">
            <label style="display:inline-flex;align-items:center;cursor:pointer">
                <input type="checkbox" id="stampa-riepilogo" checked onchange="window.aggiornaStampa()" style="margin-right:8px">
                <span>Mostra riepilogo ore</span>
            </label>
        </div>
        <button class="config-btn config-add" onclick="window.print()" style="margin-top:10px;font-size:14px">
            🖨️ Stampa
        </button>
        <p class="info-text" style="margin-top:10px">
            💡 Usa Ctrl+P (o Cmd+P su Mac) per stampare. La pagina si adatterà automaticamente al formato di stampa.
        </p>
    `;
    container.appendChild(opzioniStampa);

    // Contenitore stampa
    let printContainer = document.createElement("div");
    printContainer.id = "print-content";
    printContainer.style.marginTop = "20px";

    renderContenutiStampa(printContainer, anno, mese);

    container.appendChild(printContainer);
}

function renderContenutiStampa(container, anno, mese) {
    const numMesi = parseInt(document.getElementById("stampa-mesi-select")?.value || 1);
    const mostraLegenda = document.getElementById("stampa-legenda")?.checked ?? true;
    const mostraNote = document.getElementById("stampa-note")?.checked ?? true;
    const mostraRiepilogo = document.getElementById("stampa-riepilogo")?.checked ?? true;
    const ambulatorioFiltro = document.getElementById("stampa-ambulatorio-select")?.value || "";

    container.innerHTML = "";

    // Render ogni mese
    for (let i = 0; i < numMesi; i++) {
        let m = mese + i;
        let a = anno;

        // Gestisci overflow mesi
        while (m > 11) {
            m -= 12;
            a++;
        }

        let printBlock = document.createElement("div");
        printBlock.className = "print-block";
        printBlock.style.background = "white";
        printBlock.style.padding = "20px";
        printBlock.style.marginBottom = "20px";
        printBlock.style.borderRadius = "8px";
        printBlock.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";

        // Titolo
        let title = document.createElement("h2");
        title.textContent = `Turni ${getNomeMese(m)} ${a}`;
        title.style.textAlign = "center";
        title.style.marginBottom = "20px";
        title.style.color = "#1e88e5";
        printBlock.appendChild(title);

        // Tabella turni
        renderTabellaMeseStampa(printBlock, a, m, ambulatorioFiltro);

        // Legenda
        if (mostraLegenda) {
            renderLegendaStampa(printBlock, ambulatorioFiltro);
        }

        // Riepilogo ore
        if (mostraRiepilogo) {
            renderRiepilogoStampa(printBlock, a, m, ambulatorioFiltro);
        }

        // Note
        if (mostraNote) {
            renderNoteStampa(printBlock, a, m, ambulatorioFiltro);
        }

        container.appendChild(printBlock);
    }
}

function renderTabellaMeseStampa(container, anno, mese, ambulatorioFiltro = "") {
    const giorni = giorniNelMese(anno, mese);
    let table = document.createElement("table");
    table.style.width = "100%";
    table.style.fontSize = "10px";

    let weekDays = getNomiGiorniSettimana();
    let primoGiorno = primoGiornoMese(anno, mese);

    // Header con giorni settimana
    let thead = "<tr><th>Operatore</th>";
    for (let g = 1; g <= giorni; g++) {
        let dayOfWeek = (primoGiorno + g - 1) % 7;
        let dayLabel = weekDays[dayOfWeek];
        let isWeekend = dayOfWeek >= 5;

        thead += `<th style="${isWeekend ? 'background:#ffe0e0!important' : ''}">
            <span style="font-size:0.8em;color:#666">${dayLabel}</span><br>${g}
        </th>`;
    }
    thead += "<th>Ore Totali</th></tr>";
    table.innerHTML = thead;

    // Se c'è un filtro ambulatorio, filtra operatori che hanno almeno un turno in quell'ambulatorio
    let operatoriFiltrati = operatori;
    if (ambulatorioFiltro) {
        operatoriFiltrati = operatori.filter(op => {
            // Verifica se l'operatore ha almeno un turno nell'ambulatorio selezionato
            for (let g = 1; g <= giorni; g++) {
                let turnoSalvato = caricaTurno(op, g, anno, mese);
                if (turnoSalvato) {
                    // Estrai codice turno se nel formato "AMBULATORIO_TURNO"
                    let codiceTurno = turnoSalvato;
                    let ambulatorioTurno = null;

                    if (turnoSalvato.includes('_')) {
                        const parts = turnoSalvato.split('_');
                        ambulatorioTurno = parts[0];
                        codiceTurno = parts[parts.length - 1];
                    }

                    // Se il turno esiste, controlla l'ambulatorio
                    if (turni[codiceTurno]) {
                        const ambTurno = ambulatorioTurno || turni[codiceTurno].ambulatorio;
                        if (ambTurno === ambulatorioFiltro) {
                            return true;
                        }
                    }
                }
            }
            return false;
        });
    }

    // Righe operatori
    operatoriFiltrati.forEach(op => {
        const oreOperatore = calcolaOreOperatore(op, anno, mese);
        const minutiOperatore = calcolaMinutiOperatore(op, anno, mese);

        let styleOre = "";
        let iconaWarning = "";
        if (minutiOperatore > 10800) { // >180h
            styleOre = "color:#d32f2f!important;font-weight:bold";
            iconaWarning = " ⚠️";
        }

        const opNome = getNomeOperatore(op);

        let row = `<tr>
            <td class="operator" style="text-align:left;padding-left:8px;font-weight:bold">${opNome}</td>`;

        for (let g = 1; g <= giorni; g++) {
            let turnoSalvato = caricaTurno(op, g, anno, mese);
            let nota = caricaNota(op, g, anno, mese);
            let cellStyle = "";

            // Estrai codice turno da formato "AMBULATORIO_TURNO" se necessario
            let codiceTurno = turnoSalvato;
            let ambulatorioTurno = null;

            if (turnoSalvato && turnoSalvato.includes('_')) {
                const parts = turnoSalvato.split('_');
                ambulatorioTurno = parts[0];
                codiceTurno = parts[parts.length - 1];
            }

            // Usa labelStampa invece del codice turno
            let contenuto = "";
            if (turnoSalvato && turni[codiceTurno]) {
                const turno = turni[codiceTurno];
                const ambTurno = ambulatorioTurno || turno.ambulatorio;

                // Se c'è un filtro ambulatorio, mostra solo turni di quell'ambulatorio
                if (!ambulatorioFiltro || ambTurno === ambulatorioFiltro) {
                    cellStyle = `background:${turno.colore}!important;color:white!important;font-weight:bold`;
                    contenuto = turno.labelStampa || codiceTurno;
                } else {
                    contenuto = "";
                }
            } else {
                contenuto = "";
            }

            if (nota && nota.testo) {
                cellStyle += ";box-shadow:inset 0 0 0 2px #ff9800!important";
                if (!contenuto) {
                    contenuto = "N";
                } else {
                    contenuto += "*";
                }
            }

            row += `<td style="${cellStyle}">${contenuto}</td>`;
        }

        row += `<td style="font-weight:bold;${styleOre}">${oreOperatore}${iconaWarning}</td>`;
        row += "</tr>";
        table.innerHTML += row;
    });

    container.appendChild(table);
}

function renderLegendaStampa(container, ambulatorioFiltro = "") {
    let legenda = document.createElement("div");
    legenda.className = "print-legenda";
    legenda.innerHTML = `<strong style="font-size:11px;margin-bottom:8px;display:block">Legenda Turni:</strong>`;

    Object.entries(turni).forEach(([code, turno]) => {
        // Se c'è un filtro, mostra solo i turni dell'ambulatorio selezionato
        if (ambulatorioFiltro && turno.ambulatorio !== ambulatorioFiltro) {
            return;
        }

        let item = document.createElement("div");
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.gap = "8px";
        item.innerHTML = `
            <span style="display:inline-block;width:30px;height:16px;background:${turno.colore};border:1px solid #000;border-radius:2px"></span>
            <strong>${turno.labelStampa || code}</strong> = ${turno.nome} (${getOrarioDettaglioTurno(code, ambulatori)}) • ${calcolaOreTurno(code)}h
        `;
        legenda.appendChild(item);
    });

    container.appendChild(legenda);
}

function renderRiepilogoStampa(container, anno, mese, ambulatorioFiltro = "") {
    let riepilogo = document.createElement("div");
    riepilogo.style.marginTop = "20px";
    riepilogo.style.fontSize = "10px";
    riepilogo.style.borderTop = "1px solid #ccc";
    riepilogo.style.paddingTop = "10px";
    riepilogo.innerHTML = `<strong style="font-size:11px">📊 Riepilogo Ore per Ambulatorio:</strong>`;

    let list = document.createElement("div");
    list.style.marginTop = "8px";
    list.style.display = "grid";
    list.style.gridTemplateColumns = "repeat(2, 1fr)";
    list.style.gap = "8px";

    Object.entries(ambulatori).forEach(([codiceAmb, amb]) => {
        // Se c'è un filtro, mostra solo l'ambulatorio selezionato
        if (ambulatorioFiltro && codiceAmb !== ambulatorioFiltro) {
            return;
        }

        const oreAmb = calcolaOreAmbulatorio(codiceAmb, anno, mese, operatori);
        let item = document.createElement("div");
        item.innerHTML = `<strong>${amb.nome} (${codiceAmb}):</strong> ${oreAmb}`;
        list.appendChild(item);
    });

    riepilogo.appendChild(list);
    container.appendChild(riepilogo);
}

function renderNoteStampa(container, anno, mese, ambulatorioFiltro = "") {
    const note = raccogliNoteMese(operatori, anno, mese);

    // Filtra note per ambulatorio se specificato
    const noteFiltrate = ambulatorioFiltro
        ? note.filter(item => item.nota.ambulatorio === ambulatorioFiltro)
        : note;

    if (noteFiltrate.length === 0) return;

    let noteBox = document.createElement("div");
    noteBox.className = "print-note";
    noteBox.innerHTML = `<strong style="font-size:11px;margin-bottom:8px;display:block">📝 Note del Mese:</strong>`;

    noteFiltrate.forEach(item => {
        let noteItem = document.createElement("div");
        noteItem.style.marginBottom = "4px";
        noteItem.style.fontSize = "9px";
        noteItem.innerHTML = `
            <strong>${item.giorno}/${mese+1}</strong> — ${getNomeOperatore(item.operatore)}
            ${item.nota.ambulatorio ? `(${ambulatori[item.nota.ambulatorio]?.nome})` : ""}:
            ${item.nota.testo}
        `;
        noteBox.appendChild(noteItem);
    });

    container.appendChild(noteBox);
}

// Aggiorna stampa quando cambiano le opzioni
window.aggiornaStampa = function() {
    const printContainer = document.getElementById("print-content");
    if (printContainer) {
        renderContenutiStampa(printContainer, annoCorrente, meseCorrente);
    }
};
