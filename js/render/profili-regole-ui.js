/**
 * profili-regole-ui.js - UI helpers per gestire regole custom nei profili
 *
 * REGOLA: Tutte le funzioni pubbliche usano SINGOLARE ("preferenza" | "vincolo")
 * Lo store interno usa PLURALE ("preferenze" | "vincoli") solo per chiavi
 */

console.log('[DEBUG] 🎨 profili-regole-ui.js caricato');

import { mostraRuleBuilder } from './rule-builder.js';

console.log('[DEBUG] 🎨 profili-regole-ui.js imports OK, mostraRuleBuilder:', typeof mostraRuleBuilder);

/**
 * Converte tipo singolare a chiave plurale per store
 */
function tipoToStoreKey(tipo) {
    return tipo === 'preferenza' ? 'preferenze' : 'vincoli';
}

/**
 * Converte tipo singolare a container ID
 */
function tipoToContainerId(tipo) {
    return tipo === 'preferenza' ? 'prof-preferenze-regole-list' : 'prof-vincoli-regole-list';
}

/**
 * Renderizza lista regole custom di un tipo (preferenza o vincolo)
 * @param {Array} regole - Array regole da mostrare
 * @param {String} tipo - "preferenza" | "vincolo" (SEMPRE SINGOLARE)
 * @param {String} containerId - ID elemento DOM dove renderizzare
 */
export function renderListaRegole(regole, tipo, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!regole || regole.length === 0) {
        container.innerHTML = `
            <p style="color:#999;font-size:12px;font-style:italic">
                Nessuna regola personalizzata. Clicca su "➕ Aggiungi regola" per crearne una.
            </p>
        `;
        return;
    }

    container.innerHTML = regole.map((regola, index) => {
        const iconaGravita = regola.gravita === 'error' ? '🔴' :
                              regola.gravita === 'warning' ? '⚠️' : 'ℹ️';
        const coloreRegola = regola.gravita === 'error' ? '#ffebee' :
                             regola.gravita === 'warning' ? '#fff3e0' : '#e3f2fd';
        const opacita = regola.attiva ? '1' : '0.5';

        return `
            <div style="background:${coloreRegola};padding:10px;border-radius:4px;margin-bottom:8px;opacity:${opacita}">
                <div style="display:flex;justify-content:space-between;align-items:start">
                    <div style="flex:1">
                        <strong style="font-size:13px">${iconaGravita} ${regola.descrizione}</strong>
                        ${!regola.attiva ? ' <span style="color:#999;font-size:11px">(disattivata)</span>' : ''}
                        <p style="margin:4px 0 0 0;font-size:11px;color:#666">
                            ${regola.messaggio}
                        </p>
                        <p style="margin:4px 0 0 0;font-size:10px;color:#999">
                            Quando: ${regola.condizione.campo} ${getOperatoreLabel(regola.condizione.operatore)} ${regola.condizione.valore}
                        </p>
                    </div>
                    <div style="display:flex;gap:4px;margin-left:10px">
                        <button
                            class="config-btn"
                            style="font-size:11px;padding:4px 8px"
                            onclick="window.modificaRegolaCustom('${tipo}', ${index})"
                            title="Modifica regola"
                        >
                            ✏️
                        </button>
                        <button
                            class="config-btn config-delete"
                            style="font-size:11px;padding:4px 8px"
                            onclick="window.eliminaRegolaCustom('${tipo}', ${index})"
                            title="Elimina regola"
                        >
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Ottiene label human-readable per operatore
 */
function getOperatoreLabel(op) {
    const map = {
        equals: "=",
        notEquals: "≠",
        gt: ">",
        lt: "<",
        gte: "≥",
        lte: "≤",
        contains: "contiene",
        notContains: "non contiene"
    };
    return map[op] || op;
}

/**
 * Store temporaneo per regole in editing (prima del salvataggio profilo)
 */
window.__regoleEditingTemp = {
    preferenze: [],
    vincoli: []
};

/**
 * Inizializza regole temporary da profilo esistente
 */
export function inizializzaRegoleTemp(profilo) {
    window.__regoleEditingTemp.preferenze = profilo.preferenze?.regole || [];
    window.__regoleEditingTemp.vincoli = profilo.vincoli?.regole || [];

    // Renderizza liste iniziali (SEMPRE SINGOLARE)
    renderListaRegole(window.__regoleEditingTemp.preferenze, 'preferenza', 'prof-preferenze-regole-list');
    renderListaRegole(window.__regoleEditingTemp.vincoli, 'vincolo', 'prof-vincoli-regole-list');
}

/**
 * Aggiunge nuova regola custom
 * @param {String} tipo - "preferenza" | "vincolo" (SINGOLARE)
 */
window.aggiungiRegolaCustom = function(tipo) {
    const storeKey = tipoToStoreKey(tipo);

    console.log(`[DEBUG] aggiungiRegolaCustom: tipo="${tipo}", storeKey="${storeKey}"`);
    console.log(`[DEBUG] mostraRuleBuilder disponibile:`, typeof mostraRuleBuilder);

    try {
        mostraRuleBuilder(tipo, (regola) => {
            console.log(`[DEBUG] Regola salvata:`, regola);

            // Aggiungi a temp store
            window.__regoleEditingTemp[storeKey].push(regola);

            console.log(`[DEBUG] Store aggiornato:`, window.__regoleEditingTemp);

            // Ri-renderizza lista (tipo SINGOLARE)
            renderListaRegole(
                window.__regoleEditingTemp[storeKey],
                tipo,
                tipoToContainerId(tipo)
            );
        });
    } catch (error) {
        console.error(`[ERROR] Errore chiamando mostraRuleBuilder:`, error);
        alert(`Errore: ${error.message}\n\nVedi console per dettagli.`);
    }
};

/**
 * Modifica regola custom esistente
 * @param {String} tipo - "preferenza" | "vincolo" (SINGOLARE)
 * @param {Number} index - Indice regola da modificare
 */
window.modificaRegolaCustom = function(tipo, index) {
    const storeKey = tipoToStoreKey(tipo);
    const regola = window.__regoleEditingTemp[storeKey][index];

    mostraRuleBuilder(tipo, (regolaModificata) => {
        // Aggiorna in temp store
        window.__regoleEditingTemp[storeKey][index] = regolaModificata;

        // Ri-renderizza lista (tipo SINGOLARE)
        renderListaRegole(
            window.__regoleEditingTemp[storeKey],
            tipo,
            tipoToContainerId(tipo)
        );
    }, regola);
};

/**
 * Elimina regola custom
 * @param {String} tipo - "preferenza" | "vincolo" (SINGOLARE)
 * @param {Number} index - Indice regola da eliminare
 */
window.eliminaRegolaCustom = function(tipo, index) {
    if (!confirm("Eliminare questa regola personalizzata?")) return;

    const storeKey = tipoToStoreKey(tipo);

    // Rimuovi da temp store
    window.__regoleEditingTemp[storeKey].splice(index, 1);

    // Ri-renderizza lista (tipo SINGOLARE)
    renderListaRegole(
        window.__regoleEditingTemp[storeKey],
        tipo,
        tipoToContainerId(tipo)
    );
};

/**
 * Ottiene regole custom da salvare
 */
export function getRegoleCustomDaSalvare() {
    return {
        preferenze: window.__regoleEditingTemp.preferenze || [],
        vincoli: window.__regoleEditingTemp.vincoli || []
    };
}
