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
import { calcolaMinutiTurno, minutiToOreMinuti } from '../turni.js';

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

    // 🗺️ MAPPA COPERTURA GLOBALE (tracking stato x2, x3, etc.)
    const coperturaCorrente = new Map();

    // Itera su ogni giorno del mese
    for (let giorno = 1; giorno <= giorniMese; giorno++) {
        console.log(`[AUTO-ENGINE] Analisi giorno ${giorno}/${giorniMese}`);

        // 1. Identifica quali turni servono questo giorno (da regole copertura)
        const turniNecessari = identificaTurniNecessari(giorno, mese, anno, parametri, ambulatori, turni);

        // 📊 ORDINA SLOT PER PRIORITÀ (x2, x3 prima)
        turniNecessari.sort((a, b) => {
            if (b.richiesti !== a.richiesti) {
                return b.richiesti - a.richiesti;
            }
            return 0; // a parità, ordine naturale
        });

        // 2. Per ogni turno necessario, trova il miglior operatore
        for (const slot of turniNecessari) {
            const { ambulatorio, codiceTurno, motivazione, richiesti } = slot;

            console.log(`[AUTO-ENGINE]   Slot: ${ambulatorio} ${codiceTurno} (${motivazione})`);

            // Inizializza copertura per questo slot se non esiste
            const slotKey = `${anno}-${mese}-${giorno}|${ambulatorio}|${codiceTurno}`;
            if (!coperturaCorrente.has(slotKey)) {
                coperturaCorrente.set(slotKey, {
                    coperti: 0,
                    richiesti: richiesti || 1
                });
            }

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
                bozza,
                coperturaCorrente,
                slotKey
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

                // 🔥 AGGIORNA COPERTURA (questo è il cuore della soluzione)
                const stato = coperturaCorrente.get(slotKey);
                if (stato) {
                    stato.coperti += 1;
                    console.log(`[AUTO-ENGINE]   📊 Copertura aggiornata: ${stato.coperti}/${stato.richiesti}`);
                }

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
                    motivazione: `${avviso.descrizione} (${mancante.presenti}/${mancante.richiesti})`,
                    richiesti: mancante.richiesti  // 🔥 Campo critico per tracking x2, x3, etc.
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
 * @param {Map} coperturaCorrente - Mappa copertura in tempo reale
 * @param {string} slotKey - Chiave dello slot corrente
 * @returns {Object|null} - { profilo, totale, breakdown, motivazioni, confidenza } o null
 */
function trovaMiglioreOperatore(operatori, giorno, mese, anno, codiceTurno, ambulatorio, parametri, bozza, coperturaCorrente, slotKey) {
    // 1. Filtra operatori validi (non inattivi, non assenti, etc.)
    const operatoriValidi = filtraOperatoriValidi(operatori, giorno, codiceTurno, ambulatorio, { anno, mese });

    console.log(`[DEBUG] Giorno ${giorno} - Candidati validi: ${operatoriValidi.map(p => p.nome).join(', ')}`);

    if (operatoriValidi.length === 0) {
        return null;
    }

    // Ottieni stato copertura corrente per questo slot
    const statoCopertura = coperturaCorrente.get(slotKey);

    // 2. Calcola score per ogni operatore
    const scored = operatoriValidi.map(profilo => {
        // Costruisci context includendo turni già generati nella bozza
        const context = costruisciContext(profilo, giorno, mese, anno, codiceTurno, ambulatorio, bozza);

        console.log(`[DEBUG]   ${profilo.nome}: oreSettimana=${context.oreSettimana}, turniNelMese=${context.turniNelMese}`);

        // Calcola score BASE
        const result = calcolaScoreOperatore(profilo, giorno, codiceTurno, ambulatorio, context);

        // 🎯 BONUS COMPLETAMENTO COPERTURA (x2, x3, etc.)
        let bonusCompletamento = 0;
        if (statoCopertura && statoCopertura.richiesti > 1) {
            const { coperti, richiesti } = statoCopertura;
            const mancanti = richiesti - coperti;

            if (mancanti > 0) {
                // Bonus proporzionale a quanto manca
                bonusCompletamento = mancanti * 15;

                // Bonus EXTRA se questo slot CHIUDE la copertura (es. da 1/2 → 2/2)
                if (coperti + 1 === richiesti) {
                    bonusCompletamento += 25;
                }

                result.breakdown.bonusCompletamento = bonusCompletamento;
                result.motivazioni.push(`🎯 Completa copertura (${coperti + 1}/${richiesti})`);
            }
        }

        // Score totale con bonus
        const scoreFinale = result.totale + bonusCompletamento;

        console.log(`[DEBUG]   ${profilo.nome}: score=${scoreFinale} (base=${result.totale}, bonus=${bonusCompletamento}), breakdown=`, result.breakdown);

        return {
            profilo,
            totale: scoreFinale,
            breakdown: result.breakdown,
            motivazioni: result.motivazioni,
            confidenza: result.confidenza
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
 * Usa la funzione centralizzata calcolaMinutiTurno per coerenza
 *
 * @param {Array} turniOperatore - Array di { giorno, codiceTurno }
 * @param {number} giornoCorrente
 * @param {Object} turni - Definizioni turni da state (non usato, usa state interno)
 * @returns {number} - Ore totali
 */
function calcolaOreSettimana(turniOperatore, giornoCorrente, turni) {
    let minutiTotali = 0;

    console.log(`[DEBUG-ORE] calcolaOreSettimana chiamata: giornoCorrente=${giornoCorrente}, turniOperatore.length=${turniOperatore.length}`);

    turniOperatore.forEach(t => {
        // Conta solo turni negli ultimi 7 giorni
        if (t.giorno < giornoCorrente && t.giorno >= (giornoCorrente - 7)) {
            // Usa la funzione CENTRALE che gestisce:
            // - Turni speciali (0 ore)
            // - Turni segmentati
            // - Pause
            // - Orari precisi
            const minuti = calcolaMinutiTurno(t.codiceTurno);
            minutiTotali += minuti;

            console.log(`[DEBUG-ORE]   Giorno ${t.giorno}: ${t.codiceTurno} = ${minutiToOreMinuti(minuti)} (${minuti} minuti)`);
        }
    });

    // Converti in ore decimali per compatibilità con il resto del sistema
    const ore = Math.round((minutiTotali / 60) * 10) / 10;

    console.log(`[DEBUG-ORE]   Totale settimana: ${ore}h (${minutiTotali} minuti)`);
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
