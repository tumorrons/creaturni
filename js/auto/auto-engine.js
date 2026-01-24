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
import { caricaRegole } from '../coverage.js';
import { espandiRegoleV3inV4, getRegoleGiorno, contaAssegnazioniMensili } from '../coverage-v4.js';
import { calcolaMinutiTurno, minutiToOreMinuti } from '../turni.js';

console.log('⚙️ [AUTO-ENGINE] Modulo caricato correttamente (v4.0 - sistema regole con priorità)');

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

    // 🔄 ESPANDI REGOLE v3 → v4 (una sola volta per tutto il mese)
    const regoleV3 = caricaRegole();
    const regoleV4 = espandiRegoleV3inV4(regoleV3);
    console.log(`[AUTO-ENGINE] Caricate ${regoleV4.length} regole v4 per il mese`);

    // Itera su ogni giorno del mese
    for (let giorno = 1; giorno <= giorniMese; giorno++) {
        console.log(`[AUTO-ENGINE] Analisi giorno ${giorno}/${giorniMese}`);

        // 1. Identifica quali turni servono questo giorno (da regole v4)
        const turniNecessari = identificaTurniNecessari(giorno, mese, anno, parametri, regoleV4);

        // 📊 SLOT GIÀ ORDINATI PER PRIORITÀ da getRegoleGiorno()

        // 2. Per ogni regola (slot), trova il miglior operatore
        for (const slot of turniNecessari) {
            const { ambulatorio, codiceTurno, ruoloRichiesto, motivazione, priorita, obbligatoria } = slot;

            const ruoloLabel = ruoloRichiesto ? `[${ruoloRichiesto.toUpperCase()}]` : '[ANY]';
            console.log(`[AUTO-ENGINE]   📌 Slot: ${ambulatorio} ${codiceTurno} ${ruoloLabel} (priorità: ${priorita})`);

            // 2a. Controlla se già assegnato (se soloGiorniVuoti = true)
            if (parametri.soloGiorniVuoti && !parametri.rigeneraTutto) {
                const giaAssegnato = operatori.some(op => {
                    const turnoCaricato = caricaTurno(op, giorno, anno, mese);
                    // Controlla ENTRAMBI i formati:
                    // - Nuovo formato autogeneration: "AMBULATORIO_TURNO" (es. "BUD_BU-S")
                    // - Vecchio formato manuale: solo "TURNO" (es. "BU-S")
                    return turnoCaricato === `${ambulatorio}_${codiceTurno}` ||
                           turnoCaricato === codiceTurno;
                });

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
                ruoloRichiesto,  // ⭐ NUOVO: passa ruolo richiesto
                parametri,
                bozza,
                priorita,
                slot.limiteAssegnazioniMensili || null
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

                const livello = obbligatoria ? '❌ CRITICO' : '⚠️  Warning';
                console.log(`[AUTO-ENGINE]   ${livello} Nessun operatore disponibile per slot priorità ${priorita}`);
            }
        }
    }

    console.log(`[AUTO-ENGINE] Generazione completata:`, bozza.metadata.statistiche);
    return bozza;
}

/**
 * Identifica quali turni servono per un dato giorno
 * Basato su regole v4 (con priorità)
 *
 * FILOSOFIA v4:
 * - Ogni slot è una regola separata
 * - NON più tracking di "richiesti" vs "presenti"
 * - Regole già ordinate per priorità
 *
 * @param {number} giorno
 * @param {number} mese
 * @param {number} anno
 * @param {Object} parametri
 * @param {Array} regoleV4 - Regole già espanse
 * @returns {Array} - Array di slot { ambulatorio, codiceTurno, motivazione, priorita, obbligatoria }
 */
function identificaTurniNecessari(giorno, mese, anno, parametri, regoleV4) {
    const slots = [];

    // Se parametri.usaCopertura è false, ritorna array vuoto
    if (!parametri.usaCopertura) {
        return slots;
    }

    if (!regoleV4 || regoleV4.length === 0) {
        return slots;
    }

    // Ottieni regole applicabili a questo giorno (già ordinate per priorità)
    const regoleApplicabili = getRegoleGiorno(regoleV4, giorno, mese, anno);

    // Converti ogni regola in uno slot
    regoleApplicabili.forEach(regola => {
        // Filtro per ambulatorio se specificato
        if (parametri.ambulatorioFiltro && parametri.ambulatorioFiltro !== regola.ambulatorio) {
            return;
        }

        slots.push({
            ambulatorio: regola.ambulatorio,
            codiceTurno: regola.codiceTurno,
            ruoloRichiesto: regola.ruoloRichiesto || null,  // ⭐ NUOVO: ruolo richiesto (null = ANY)
            motivazione: regola.descrizione,
            priorita: regola.priorita,
            obbligatoria: regola.obbligatoria,
            limiteAssegnazioniMensili: regola.limiteAssegnazioniMensili
        });
    });

    return slots;
}

/**
 * Trova il miglior operatore per uno slot specifico
 *
 * FILOSOFIA v4.1 (FASE 1B):
 * - Ogni slot richiede un RUOLO specifico (INF, OSS, etc.) o ANY
 * - Priorità slot influenza solo l'ordine di assegnazione, NON lo score
 * - Score puramente basato su: sede, preferenze, bilanciamento
 *
 * @param {Object[]} operatori - Array profili operatori
 * @param {number} giorno
 * @param {number} mese
 * @param {number} anno
 * @param {string} codiceTurno
 * @param {string} ambulatorio
 * @param {string|null} ruoloRichiesto - Ruolo richiesto (null = ANY)
 * @param {Object} parametri
 * @param {Object} bozza - Bozza corrente con turni già generati
 * @param {number} priorita - Priorità dello slot (informativa, non influenza score)
 * @param {number|null} limiteAssegnazioniMensili - Max assegnazioni mensili per operatore (null = nessun limite)
 * @returns {Object|null} - { profilo, totale, breakdown, motivazioni, confidenza } o null
 */
function trovaMiglioreOperatore(operatori, giorno, mese, anno, codiceTurno, ambulatorio, ruoloRichiesto, parametri, bozza, priorita, limiteAssegnazioniMensili = null) {
    // 1. LIVELLO 2: Filtra operatori ammissibili (vincoli HARD)
    const operatoriValidi = filtraOperatoriValidi(operatori, giorno, codiceTurno, ambulatorio, { anno, mese, bozza, ruoloRichiesto });

    console.log(`[DEBUG] Giorno ${giorno} - Candidati validi: ${operatoriValidi.map(p => p.nome).join(', ')}`);

    if (operatoriValidi.length === 0) {
        return null;
    }

    // 🔒 2. VINCOLO HARD: Esclude operatori che hanno già questo turno nello stesso giorno
    // (Previene stesso operatore per 2+ slot dello stesso turno)
    const operatoriSenzaDoppi = operatoriValidi.filter(profilo => {
        const haGiaQuesto = haGiaQuestoTurnoNelloStessoGiorno(profilo.id, giorno, mese, anno, codiceTurno, bozza);
        if (haGiaQuesto) {
            console.log(`[AUTO-ENGINE]   🚫 ${profilo.nome} escluso: ha già ${codiceTurno} il giorno ${giorno}`);
        }
        return !haGiaQuesto;
    });

    console.log(`[DEBUG] Dopo filtro doppi: ${operatoriSenzaDoppi.map(p => p.nome).join(', ')}`);

    if (operatoriSenzaDoppi.length === 0) {
        console.log(`[AUTO-ENGINE]   ⚠️ Nessun operatore disponibile dopo filtro doppi`);
        return null;
    }

    // 🔒 2b. VINCOLO HARD: Rispetta limite assegnazioni mensili (se specificato dalla regola)
    let operatoriFinali = operatoriSenzaDoppi;
    if (limiteAssegnazioniMensili !== null && limiteAssegnazioniMensili > 0) {
        operatoriFinali = operatoriSenzaDoppi.filter(profilo => {
            const count = contaAssegnazioniMensili(profilo, codiceTurno, anno, mese, bozza.turni);
            const raggiunto = count >= limiteAssegnazioniMensili;
            if (raggiunto) {
                console.log(`[AUTO-ENGINE]   🚫 ${profilo.nome} escluso: raggiunto limite mensile ${codiceTurno} (${count}/${limiteAssegnazioniMensili})`);
            }
            return !raggiunto;
        });

        console.log(`[DEBUG] Dopo filtro limiti mensili: ${operatoriFinali.map(p => p.nome).join(', ')}`);

        if (operatoriFinali.length === 0) {
            console.log(`[AUTO-ENGINE]   ⚠️ Nessun operatore disponibile: tutti hanno raggiunto il limite mensile`);
            return null;
        }
    }

    // 3. Calcola score per ogni operatore
    const scored = operatoriFinali.map(profilo => {
        // Costruisci context includendo turni già generati nella bozza
        const context = costruisciContext(profilo, giorno, mese, anno, codiceTurno, ambulatorio, bozza);

        console.log(`[DEBUG]   ${profilo.nome}: oreSettimana=${context.oreSettimana}, turniNelMese=${context.turniNelMese}`);

        // Calcola score (v4: sede > preferenze > bilanciamento)
        const result = calcolaScoreOperatore(profilo, giorno, codiceTurno, ambulatorio, context);

        console.log(`[DEBUG]   ${profilo.nome}: score=${result.totale}, breakdown=`, result.breakdown);

        return {
            profilo,
            totale: result.totale,
            breakdown: result.breakdown,
            motivazioni: result.motivazioni,
            confidenza: result.confidenza
        };
    });

    // 4. Ordina per score decrescente
    scored.sort((a, b) => b.totale - a.totale);

    console.log(`[DEBUG]   Dopo sort: ${scored.map(s => `${s.profilo.nome}(${s.totale})`).join(', ')}`);

    // 5. Prendi il migliore
    const migliore = scored[0];

    console.log(`[DEBUG]   ✅ Scelto: ${migliore.profilo.nome} con score ${migliore.totale}`);

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

/**
 * Verifica se un operatore ha già lo stesso turno nello stesso giorno
 * (sia in localStorage che nella bozza corrente)
 *
 * @param {string} operatoreId
 * @param {number} giorno
 * @param {number} mese
 * @param {number} anno
 * @param {string} codiceTurno
 * @param {Object} bozza - Bozza corrente
 * @returns {boolean} - true se ha già questo turno
 */
function haGiaQuestoTurnoNelloStessoGiorno(operatoreId, giorno, mese, anno, codiceTurno, bozza) {
    // 1. Controlla localStorage
    const turnoSalvato = caricaTurno(operatoreId, giorno, anno, mese);
    if (turnoSalvato) {
        // Estrai codice turno (può essere "AMB_TURNO" o solo "TURNO")
        let codice = turnoSalvato;
        if (turnoSalvato.includes('_')) {
            const parts = turnoSalvato.split('_');
            codice = parts[parts.length - 1];
        }
        if (codice === codiceTurno) {
            return true;
        }
    }

    // 2. Controlla bozza (turni già generati in questa sessione)
    if (bozza && bozza.turni) {
        const haInBozza = bozza.turni.some(t =>
            t.operatore === operatoreId &&
            t.giorno === giorno &&
            t.turno === codiceTurno
        );
        if (haInBozza) {
            return true;
        }
    }

    return false;
}
