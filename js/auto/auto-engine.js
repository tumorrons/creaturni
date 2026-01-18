/**
 * auto-engine.js
 * Engine principale per la generazione automatica turni
 *
 * Filosofia:
 * - Iterativo: analizza giorno per giorno
 * - Greedy intelligente: sceglie sempre il migliore disponibile
 * - Non distruttivo: rispetta turni esistenti se richiesto
 */

import { nuovaBozza, nuovoTurnoGenerato } from './auto-schema.js';
import { calcolaScoreOperatore, filtraOperatoriValidi } from './auto-scoring.js';
import { getState } from '../state.js';
import { caricaTurno } from '../storage.js';
import { verificaGiorno, caricaRegole } from '../coverage.js';

console.log('⚙️ [AUTO-ENGINE] Modulo caricato correttamente');

/**
 * Genera una bozza completa di turni per un mese
 *
 * @param {number} mese - Mese (0-11)
 * @param {number} anno - Anno
 * @param {Object} parametri - Parametri generazione
 * @param {boolean} parametri.soloGiorniVuoti - Genera solo dove non ci sono turni
 * @param {boolean} parametri.rigeneraTutto - Sovrascrivi tutto (richiede conferma UI)
 * @param {string|null} parametri.ambulatorioFiltro - Genera solo per questo ambulatorio
 * @param {boolean} parametri.usaCopertura - Rispetta regole copertura
 * @param {boolean} parametri.usaVincoli - Rispetta vincoli operatore
 * @param {boolean} parametri.usaPreferenze - Rispetta preferenze operatore
 * @returns {Object} - GeneratedDraft completo
 */
export function generaBozza(mese, anno, parametri = {}) {
    console.log(`[AUTO-ENGINE] Inizio generazione bozza: ${anno}-${mese + 1}`, parametri);

    const bozza = nuovaBozza(mese, anno, parametri);
    const { operatori, turni, ambulatori } = getState();

    // Calcola quanti giorni ha il mese
    const giorniMese = new Date(anno, mese + 1, 0).getDate();

    // Itera su ogni giorno del mese
    for (let giorno = 1; giorno <= giorniMese; giorno++) {
        console.log(`[AUTO-ENGINE] Analisi giorno ${giorno}/${giorniMese}`);

        // 1. Identifica quali turni servono questo giorno (da regole copertura)
        const turniNecessari = identificaTurniNecessari(giorno, mese, anno, parametri, ambulatori, turni);

        // 2. Per ogni turno necessario, trova il miglior operatore
        for (const slot of turniNecessari) {
            const { ambulatorio, codiceTurno, motivazione } = slot;

            console.log(`[AUTO-ENGINE]   Slot: ${ambulatorio} ${codiceTurno} (${motivazione})`);

            // 2a. Controlla se già assegnato (se soloGiorniVuoti = true)
            if (parametri.soloGiorniVuoti && !parametri.rigeneraTutto) {
                const giaAssegnato = operatori.some(op =>
                    caricaTurno(op, giorno, anno, mese) === `${ambulatorio}_${codiceTurno}`
                );

                if (giaAssegnato) {
                    console.log(`[AUTO-ENGINE]   ⏭️  Già assegnato, skip`);
                    continue;
                }
            }

            // 2b. Trova miglior operatore per questo slot
            const risultato = trovaMiglioreOperatore(
                operatori,
                giorno,
                mese,
                anno,
                codiceTurno,
                ambulatorio,
                parametri,
                bozza  // Passa bozza corrente per calcolare ore simulate
            );

            if (risultato) {
                const { profilo, totale, breakdown, motivazioni, confidenza } = risultato;

                // 2c. Aggiungi turno alla bozza
                const turnoGenerato = nuovoTurnoGenerato(
                    giorno,
                    codiceTurno,
                    ambulatorio,
                    profilo.id,
                    confidenza,
                    motivazioni,
                    breakdown
                );

                bozza.turni.push(turnoGenerato);
                bozza.metadata.statistiche.turniGenerati++;

                console.log(`[AUTO-ENGINE]   ✅ Assegnato a ${profilo.nome} (score: ${totale}, confidenza: ${(confidenza * 100).toFixed(0)}%)`);
            } else {
                // Nessun operatore disponibile
                bozza.metadata.statistiche.slotVuoti++;
                console.log(`[AUTO-ENGINE]   ❌ Nessun operatore disponibile`);
            }
        }
    }

    console.log(`[AUTO-ENGINE] Generazione completata:`, bozza.metadata.statistiche);
    return bozza;
}

/**
 * Identifica quali turni servono per un dato giorno
 * Basato su regole di copertura
 *
 * @param {number} giorno
 * @param {number} mese
 * @param {number} anno
 * @param {Object} parametri
 * @param {Object} ambulatori
 * @param {Object} turni
 * @returns {Array} - Array di { ambulatorio, codiceTurno, motivazione }
 */
function identificaTurniNecessari(giorno, mese, anno, parametri, ambulatori, turni) {
    const slots = [];

    // Se parametri.usaCopertura è false, ritorna array vuoto
    // (in futuro potremmo avere altre logiche per determinare i turni necessari)
    if (!parametri.usaCopertura) {
        return slots;
    }

    // Carica regole di copertura
    const regole = caricaRegole();
    if (!regole || regole.length === 0) {
        return slots;
    }

    // Verifica copertura per questo giorno
    const avvisi = verificaGiorno(giorno, mese, anno, regole);

    // Estrai turni mancanti da ogni avviso
    avvisi.forEach(avviso => {
        avviso.mancanti.forEach(mancante => {
            // Filtro per ambulatorio se specificato
            if (parametri.ambulatorioFiltro && parametri.ambulatorioFiltro !== mancante.ambulatorio) {
                return;
            }

            // Aggiungi uno slot per ogni operatore mancante
            const mancanza = mancante.richiesti - mancante.presenti;
            for (let i = 0; i < mancanza; i++) {
                slots.push({
                    ambulatorio: mancante.ambulatorio,
                    codiceTurno: mancante.turno,
                    motivazione: `${avviso.descrizione} (${mancante.presenti}/${mancante.richiesti})`
                });
            }
        });
    });

    return slots;
}

/**
 * Trova il miglior operatore per uno slot specifico
 *
 * @param {Object[]} operatori - Array profili operatori
 * @param {number} giorno
 * @param {number} mese
 * @param {number} anno
 * @param {string} codiceTurno
 * @param {string} ambulatorio
 * @param {Object} parametri
 * @param {Object} bozza - Bozza corrente con turni già generati
 * @returns {Object|null} - { profilo, totale, breakdown, motivazioni, confidenza } o null
 */
function trovaMiglioreOperatore(operatori, giorno, mese, anno, codiceTurno, ambulatorio, parametri, bozza) {
    // 1. Filtra operatori validi (non inattivi, non assenti, etc.)
    const operatoriValidi = filtraOperatoriValidi(operatori, giorno, codiceTurno, ambulatorio, {});

    console.log(`[DEBUG] Giorno ${giorno} - Candidati validi: ${operatoriValidi.map(p => p.nome).join(', ')}`);

    if (operatoriValidi.length === 0) {
        return null;
    }

    // 2. Calcola score per ogni operatore
    const scored = operatoriValidi.map(profilo => {
        // Costruisci context includendo turni già generati nella bozza
        const context = costruisciContext(profilo, giorno, mese, anno, codiceTurno, ambulatorio, bozza);

        console.log(`[DEBUG]   ${profilo.nome}: oreSettimana=${context.oreSettimana}, turniNelMese=${context.turniNelMese}`);

        // Calcola score
        const result = calcolaScoreOperatore(profilo, giorno, codiceTurno, ambulatorio, context);

        console.log(`[DEBUG]   ${profilo.nome}: score=${result.totale}, breakdown=`, result.breakdown);

        return {
            profilo,
            ...result
        };
    });

    // 3. Ordina per score decrescente
    scored.sort((a, b) => b.totale - a.totale);

    console.log(`[DEBUG]   Dopo sort: ${scored.map(s => `${s.profilo.nome}(${s.totale})`).join(', ')}`);

    // 4. Prendi il migliore
    const migliore = scored[0];

    console.log(`[DEBUG]   ✅ Scelto: ${migliore.profilo.nome} con score ${migliore.totale}`);

    // Se tutti hanno score negativo molto basso, potremmo decidere di non assegnare nessuno
    // (questo dipende dalla politica: meglio un turno con warning o lasciarlo vuoto?)
    // Per ora: assegna sempre il migliore disponibile
    return migliore;
}

/**
 * Costruisce il context completo per un operatore in un giorno specifico
 * Include calcoli di ore settimanali, giorni consecutivi, riposo, etc.
 *
 * @param {Object} profilo
 * @param {number} giorno
 * @param {number} mese
 * @param {number} anno
 * @param {string} codiceTurno
 * @param {string} ambulatorio
 * @param {Object} bozza - Bozza corrente con turni già generati
 * @returns {Object} - Context completo per valutazione regole
 */
function costruisciContext(profilo, giorno, mese, anno, codiceTurno, ambulatorio, bozza) {
    const { turni } = getState();
    const data = new Date(anno, mese, giorno);

    // Context base
    const context = {
        giorno,
        mese,
        anno,
        giornoSettimana: data.getDay(),
        turno: {
            codice: codiceTurno,
            ambulatorio: ambulatorio,
            ...(turni[codiceTurno] || {})
        }
    };

    // Calcola campi avanzati considerando:
    // 1. Turni in localStorage (già salvati)
    // 2. Turni nella bozza (già generati in questa sessione)

    // Raccogli tutti i turni dell'operatore (localStorage + bozza)
    const turniOperatore = raccogliTurniOperatore(profilo.id, mese, anno, bozza);

    // Calcola ore settimana (ultimi 7 giorni)
    context.oreSettimana = calcolaOreSettimana(turniOperatore, giorno, turni);

    // Calcola giorni consecutivi
    context.giorniConsecutivi = calcolaGiorniConsecutivi(turniOperatore, giorno);

    // Calcola turni nel mese
    context.turniNelMese = turniOperatore.length;

    // Calcola turni nella settimana corrente
    context.turniSettimana = calcolaTurniSettimana(turniOperatore, giorno);

    // Riposo ore (per ora fisso, implementabile in futuro)
    context.riposoOre = 24;

    return context;
}

/**
 * Raccoglie tutti i turni di un operatore per il mese specificato
 * Include sia turni in localStorage che turni già generati nella bozza
 *
 * @param {string} operatoreId
 * @param {number} mese
 * @param {number} anno
 * @param {Object} bozza - Bozza corrente
 * @returns {Array} - Array di { giorno, codiceTurno }
 */
function raccogliTurniOperatore(operatoreId, mese, anno, bozza) {
    const turniArray = [];
    const giorni = new Date(anno, mese + 1, 0).getDate();

    // 1. Turni da localStorage
    for (let g = 1; g <= giorni; g++) {
        const turnoSalvato = caricaTurno(operatoreId, g, anno, mese);
        if (turnoSalvato) {
            // Estrai codice turno (può essere "AMB_TURNO" o solo "TURNO")
            let codiceTurno = turnoSalvato;
            if (turnoSalvato.includes('_')) {
                const parts = turnoSalvato.split('_');
                codiceTurno = parts[parts.length - 1];
            }
            turniArray.push({ giorno: g, codiceTurno });
        }
    }

    // 2. Turni dalla bozza (già generati in questa sessione)
    if (bozza && bozza.turni) {
        bozza.turni.forEach(t => {
            if (t.operatore === operatoreId) {
                turniArray.push({ giorno: t.giorno, codiceTurno: t.turno });
            }
        });
    }

    return turniArray;
}

/**
 * Calcola ore settimanali (ultimi 7 giorni dal giorno specificato)
 *
 * @param {Array} turniOperatore - Array di { giorno, codiceTurno }
 * @param {number} giornoCorrente
 * @param {Object} turni - Definizioni turni da state
 * @returns {number} - Ore totali
 */
function calcolaOreSettimana(turniOperatore, giornoCorrente, turni) {
    let ore = 0;

    console.log(`[DEBUG-ORE] calcolaOreSettimana chiamata: giornoCorrente=${giornoCorrente}, turniOperatore.length=${turniOperatore.length}`);
    console.log(`[DEBUG-ORE]   turniOperatore=`, turniOperatore);
    console.log(`[DEBUG-ORE]   turni keys disponibili:`, Object.keys(turni));
    console.log(`[DEBUG-ORE]   turni completo:`, turni);

    turniOperatore.forEach(t => {
        console.log(`[DEBUG-ORE]   Analisi turno: giorno=${t.giorno}, codiceTurno=${t.codiceTurno}`);

        // Conta solo turni negli ultimi 7 giorni
        const passaCondizione = t.giorno < giornoCorrente && t.giorno >= (giornoCorrente - 7);
        console.log(`[DEBUG-ORE]     Condizione data: ${t.giorno} < ${giornoCorrente} && ${t.giorno} >= ${giornoCorrente - 7} = ${passaCondizione}`);

        if (passaCondizione) {
            const defTurno = turni[t.codiceTurno];
            console.log(`[DEBUG-ORE]     Lookup: turni["${t.codiceTurno}"] =`, defTurno);

            if (!defTurno) {
                console.log(`[DEBUG-ORE]     ❌ Turno "${t.codiceTurno}" non trovato in mappa turni!`);
            } else {
                // Supporta sia formato vecchio (orario) che nuovo (ingresso/uscita)
                let oreT = 0;

                if (defTurno.orario) {
                    // Formato vecchio: "07:00 – 14:00"
                    const match = defTurno.orario.match(/(\d+):00\s*[–-]\s*(\d+):00/);
                    if (match) {
                        oreT = parseInt(match[2]) - parseInt(match[1]);
                        console.log(`[DEBUG-ORE]     ✅ orario="${defTurno.orario}" → ${oreT}h`);
                    }
                } else if (defTurno.ingresso && defTurno.uscita) {
                    // Formato nuovo: ingresso: "07:00", uscita: "14:00"
                    const ingressoMatch = defTurno.ingresso.match(/(\d+):(\d+)/);
                    const uscitaMatch = defTurno.uscita.match(/(\d+):(\d+)/);

                    if (ingressoMatch && uscitaMatch) {
                        const ingressoOra = parseInt(ingressoMatch[1]);
                        const uscitaOra = parseInt(uscitaMatch[1]);
                        oreT = uscitaOra - ingressoOra;
                        console.log(`[DEBUG-ORE]     ✅ ingresso="${defTurno.ingresso}", uscita="${defTurno.uscita}" → ${oreT}h`);
                    }
                } else {
                    console.log(`[DEBUG-ORE]     ❌ Turno senza orario/ingresso-uscita:`, Object.keys(defTurno));
                }

                if (oreT > 0) {
                    ore += oreT;
                }
            }
        }
    });

    console.log(`[DEBUG-ORE]   Totale ore settimana: ${ore}`);
    return ore;
}

/**
 * Calcola giorni consecutivi con turni fino al giorno specificato
 *
 * @param {Array} turniOperatore
 * @param {number} giornoCorrente
 * @returns {number}
 */
function calcolaGiorniConsecutivi(turniOperatore, giornoCorrente) {
    let consecutivi = 0;

    // Controlla a ritroso dal giorno precedente
    for (let g = giornoCorrente - 1; g >= 1; g--) {
        const haTurno = turniOperatore.some(t => t.giorno === g);
        if (haTurno) {
            consecutivi++;
        } else {
            break; // Interrompi alla prima assenza
        }
    }

    return consecutivi;
}

/**
 * Calcola numero turni nella settimana corrente
 *
 * @param {Array} turniOperatore
 * @param {number} giornoCorrente
 * @returns {number}
 */
function calcolaTurniSettimana(turniOperatore, giornoCorrente) {
    return turniOperatore.filter(t =>
        t.giorno < giornoCorrente && t.giorno >= (giornoCorrente - 7)
    ).length;
}
