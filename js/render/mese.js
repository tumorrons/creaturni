/**
 * render/mese.js - Rendering vista mensile
 */

import { annoCorrente, meseCorrente, operatori, turni, ambulatori, viewMode } from '../state.js';
import { giorniNelMese, primoGiornoMese, getNomeMese, getNomiGiorniSettimana } from '../calendar.js';
import { caricaTurno, caricaNota, caricaBozzaGenerazione } from '../storage.js';
import { calcolaOreOperatore, calcolaMinutiOperatore, calcolaMinutiTurno, getOrarioDettaglioTurno, calcolaOreTurno } from '../turni.js';
import { assegnaTurno, aggiornaTitolo, inizializzaCancellazioni } from '../ui.js';
import { renderBoxNoteMese, renderEditorNotaInline } from './note-editor.js';
import { renderCoveragePanel } from './coverage-panel.js';
import { getNomeOperatore, getIdOperatore } from '../profili.js';
import { valutaAssegnazione, generaTooltipRegole, filtraWarning } from '../regole.js';

/**
 * Carica turno con merge temporaneo della bozza se attiva
 * @param {Object} operatore - Profilo operatore
 * @param {number} giorno - Giorno del mese
 * @param {number} anno - Anno
 * @param {number} mese - Mese (0-11)
 * @returns {{turno: string|null, origine: string, motivazioni: string[]}}
 */
function caricaTurnoConBozza(operatore, giorno, anno, mese) {
    // Turno ufficiale da localStorage
    const turnoUfficiale = caricaTurno(operatore, giorno, anno, mese);

    // Se non stiamo mostrando la bozza, ritorna solo il turno ufficiale
    if (!viewMode.mostraBozza) {
        return {
            turno: turnoUfficiale,
            origine: 'manuale',
            motivazioni: []
        };
    }

    // Carica la bozza
    const bozza = caricaBozzaGenerazione();
    if (!bozza || bozza.stato !== 'draft') {
        return {
            turno: turnoUfficiale,
            origine: 'manuale',
            motivazioni: []
        };
    }

    // Verifica se la bozza è per questo periodo
    if (bozza.periodo.anno !== anno || bozza.periodo.mese !== mese) {
        return {
            turno: turnoUfficiale,
            origine: 'manuale',
            motivazioni: []
        };
    }

    // Cerca turno nella bozza per questo operatore e giorno
    const opId = getIdOperatore(operatore);
    const turnoBozza = bozza.turni.find(t =>
        t.giorno === giorno && t.operatore === opId
    );

    // Se esiste nella bozza, usa quello (con priorità su turno ufficiale)
    if (turnoBozza) {
        // Costruisce il codice turno nel formato "AMBULATORIO_TURNO" usato da localStorage
        const codiceTurno = `${turnoBozza.ambulatorio}_${turnoBozza.turno}`;
        return {
            turno: codiceTurno,
            origine: 'auto',
            motivazioni: turnoBozza.motivazioni || [],
            confidenza: turnoBozza.confidenza
        };
    }

    // Altrimenti usa il turno ufficiale
    return {
        turno: turnoUfficiale,
        origine: 'manuale',
        motivazioni: []
    };
}

/**
 * Calcola minuti totali operatore includendo la bozza se attiva
 */
function calcolaMinutiOperatoreConBozza(operatore, anno, mese) {
    let totale = 0;
    const giorni = giorniNelMese(anno, mese);

    for (let g = 1; g <= giorni; g++) {
        const turnoData = caricaTurnoConBozza(operatore, g, anno, mese);
        totale += calcolaMinutiTurno(turnoData.turno);
    }

    return totale;
}

/**
 * Calcola ore totali operatore in formato HH:MM includendo la bozza se attiva
 */
function calcolaOreOperatoreConBozza(operatore, anno, mese) {
    const minuti = calcolaMinutiOperatoreConBozza(operatore, anno, mese);
    const ore = Math.floor(minuti / 60);
    const minutiResto = minuti % 60;
    return `${ore}:${minutiResto.toString().padStart(2, "0")}`;
}

export function renderMese(anno = annoCorrente, mese = meseCorrente, compatto = false) {
    const container = document.getElementById("mese");

    if (!compatto) {
        container.innerHTML = `<h3>📅 Vista Mese</h3>`;

        let navMese = document.createElement("div");
        navMese.className = "nav-controls";
        navMese.innerHTML = `
            <button id="btn-mese-prev" onclick="window.mesePrecedente()">⬅️ Precedente</button>
            <span class="nav-title" id="mese-titolo">${getNomeMese(mese)} ${anno}</span>
            <button id="btn-mese-next" onclick="window.meseSuccessivo()">Successivo ➡️</button>
            <small class="nav-info" id="mese-info"></small>
        `;
        container.appendChild(navMese);

        let infoText = document.createElement("p");
        infoText.className = "info-text";
        infoText.textContent = "Clicca su una cella per assegnare un turno • Doppio click o click destro per cancellare";
        container.appendChild(infoText);
    }

    const giorni = giorniNelMese(anno, mese);

    let table = document.createElement("table");
    table.style.marginTop = compatto ? "5px" : "15px";
    table.style.fontSize = compatto ? "10px" : "12px";

    let weekDays = getNomiGiorniSettimana();
    let primoGiorno = primoGiornoMese(anno, mese);

    let thead = "<tr><th>Operatore</th>";
    for (let g = 1; g <= giorni; g++) {
        let dayOfWeek = (primoGiorno + g - 1) % 7;
        let dayLabel = weekDays[dayOfWeek];
        thead += `<th><span style="font-size:0.85em;color:#666">${dayLabel}</span><br>${g}</th>`;
    }
    thead += "</tr>";
    table.innerHTML = thead;

    operatori.forEach(op => {
        const oreOperatore = calcolaOreOperatoreConBozza(op, anno, mese);
        const minutiOperatore = calcolaMinutiOperatoreConBozza(op, anno, mese);

        let styleOre = "color:#666;font-weight:normal";
        let iconaWarning = "";
        if (minutiOperatore > 10800) { // >180h
            styleOre = "color:#d32f2f;font-weight:bold";
            iconaWarning = " ⚠️";
        }

        const opId = getIdOperatore(op);
        const opNome = getNomeOperatore(op);

        let row = `<tr data-operatore="${opId}">
            <td class="operator" style="${compatto ? 'font-size:10px;padding:2px' : ''}">
                ${opNome}
                ${!compatto ? `<br><small style="${styleOre}">⏱ ${oreOperatore}${iconaWarning}</small>` : ''}
            </td>`;

        for (let g = 1; g <= giorni; g++) {
            // Carica turno con merge bozza se attiva
            const turnoData = caricaTurnoConBozza(op, g, anno, mese);
            const turnoSalvato = turnoData.turno;
            const origine = turnoData.origine;
            const motivazioniAuto = turnoData.motivazioni;
            const confidenza = turnoData.confidenza;

            let nota = caricaNota(op, g, anno, mese);
            let cellStyle = "cursor:pointer;";
            let cellClass = ""; // Classe per turni auto-generati

            // Estrai codice turno da formato "AMBULATORIO_TURNO" se necessario
            let codiceTurno = turnoSalvato;
            if (turnoSalvato && turnoSalvato.includes('_')) {
                const parts = turnoSalvato.split('_');
                codiceTurno = parts[parts.length - 1]; // Prende ultima parte (es. "BM" da "BUD_BM")
            }

            if (turnoSalvato && turni[codiceTurno]) {
                cellStyle += `background:${turni[codiceTurno].colore};color:white;font-weight:bold`;

                // Classe per pattern a righe se auto-generato
                if (origine === 'auto') {
                    cellClass = "turno-auto-preview";
                }
            }

            // Valuta regole per turni già assegnati (solo se operatore è un profilo completo)
            let warningRegole = [];
            if (turnoSalvato && typeof op === 'object' && op !== null) {
                const context = {};
                const risultati = valutaAssegnazione(op, turnoSalvato, g, anno, mese, context, turni);
                warningRegole = filtraWarning(risultati);
            }

            // Bordo per note (giallo) o warning regole (rosso/arancione)
            if (nota && nota.testo && warningRegole.length === 0) {
                cellStyle += ";box-shadow:inset 0 0 0 2px #ff9800";
            } else if (warningRegole.length > 0) {
                const haErrori = warningRegole.some(w => w.gravita === 'error');
                if (haErrori) {
                    cellStyle += ";box-shadow:inset 0 0 0 3px #d32f2f"; // Rosso per errori
                } else {
                    cellStyle += ";box-shadow:inset 0 0 0 2px #ff9800"; // Arancione per warning
                }
                // Se c'è anche una nota, bordo doppio
                if (nota && nota.testo) {
                    cellStyle += ",inset 0 0 0 5px #fbc02d";
                }
            }

            let contenuto = codiceTurno || g;

            if (nota && nota.testo) {
                contenuto += `<span class="note-badge">N</span>`;
            }

            let tooltipText = "";
            if (turnoSalvato && turni[codiceTurno]) {
                const orarioDettaglio = getOrarioDettaglioTurno(turnoSalvato, ambulatori);
                const oreCalcolate = calcolaOreTurno(turnoSalvato);
                tooltipText = `${turni[codiceTurno].nome} • ${orarioDettaglio} • ${oreCalcolate}h`;

                // Info turno auto-generato
                if (origine === 'auto') {
                    const confPerc = Math.round((confidenza || 0) * 100);
                    tooltipText += `\n\n🤖 GENERATO AUTOMATICAMENTE`;
                    tooltipText += `\nConfidenza: ${confPerc}%`;
                    if (motivazioniAuto && motivazioniAuto.length > 0) {
                        tooltipText += `\nMotivazioni:\n• ${motivazioniAuto.join('\n• ')}`;
                    }
                }

                // Aggiungi warning regole al tooltip
                if (warningRegole.length > 0) {
                    const tooltipRegole = generaTooltipRegole(warningRegole);
                    tooltipText += `\n\n${tooltipRegole}`;
                }

                if (nota && nota.testo) {
                    tooltipText += `\n\n📝 ${nota.testo} (CTRL + doppio click per eliminare)`;
                }
            } else if (nota && nota.testo) {
                tooltipText = nota.testo + ' (CTRL + doppio click per eliminare)';
            }

            if (compatto) {
                cellStyle += ';padding:2px;font-size:10px';
            }

            // Costruisci attributo class se necessario
            const classAttr = cellClass ? `class="${cellClass}"` : '';

            row += `<td ${classAttr} style="${cellStyle}" data-operatore="${opId}" data-giorno="${g}" data-anno="${anno}" data-mese="${mese}" title="${tooltipText}" onclick="window.assegnaTurno(event, '${opId}', ${g}, ${anno}, ${mese})">${contenuto}</td>`;
        }

        row += "</tr>";
        table.innerHTML += row;
    });

    container.appendChild(table);

    if (!compatto) {
        aggiornaTitolo();
        inizializzaCancellazioni();
        renderCoveragePanel(container, anno, mese);
        renderBoxNoteMese(document.getElementById("mese"), anno, mese);
        renderEditorNotaInline(container);
    }
}
