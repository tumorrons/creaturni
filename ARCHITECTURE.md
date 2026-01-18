# 🏥 Gestione Turni Ospedale - Architettura v3.7

## 📁 Struttura del Progetto

```
/turnimed/
├── index.html              # Solo markup HTML (pulito)
├── css/
│   └── style.css          # Tutti gli stili
├── js/
│   ├── app.js             # Bootstrap e inizializzazione
│   ├── state.js           # Stato globale (UNICA fonte di verità)
│   ├── storage.js         # localStorage (UNICA fonte di persistenza)
│   ├── calendar.js        # Logica calendario e date
│   ├── turni.js           # Logica business turni e calcolo ore
│   ├── note.js            # Gestione note
│   ├── ui.js              # Eventi UI e interazioni
│   └── render/
│       ├── mese.js        # Rendering vista mensile
│       ├── anno.js        # Rendering vista annuale
│       ├── ambulatorio.js # Rendering vista ambulatorio
│       ├── stampa.js      # Rendering vista stampa
│       ├── config.js      # Rendering configurazione
│       └── note-editor.js # Editor inline note
```

## 🧩 Responsabilità dei Moduli

### `state.js` - Stato Globale
**Responsabilità:** Centralizza TUTTO lo stato mutabile dell'applicazione
- Anno/mese corrente
- Turno selezionato
- Modalità inserimento
- Dati di dominio (operatori, ambulatori, turni)
- **Regola:** Nessun altro modulo può contenere stato mutabile globale

### `storage.js` - Persistenza
**Responsabilità:** UNICA interfaccia per localStorage
- Carica/salva operatori, ambulatori, turni
- Carica/salva turni assegnati
- Carica/salva note
- **Regola:** Se domani si vuole un backend, si modifica SOLO questo file

### `calendar.js` - Calendario
**Responsabilità:** Logica pura per date e calendario
- Calcolo giorni nel mese
- Primo giorno settimana
- Nomi mesi/giorni
- **Regola:** ZERO accessi a DOM o storage

### `turni.js` - Business Logic Turni
**Responsabilità:** Calcoli ore, turni, validazioni
- Calcolo minuti/ore turno (singolo e segmentato)
- Calcolo ore operatore
- Calcolo ore ambulatorio
- Generazione stringhe orario
- **Regola:** Solo calcoli, nessun side-effect

### `note.js` - Logica Note
**Responsabilità:** Funzioni utility per note
- Raccolta note per mese
- Raccolta note per ambulatorio
- Verifica esistenza nota
- **Regola:** Solo lettura dati, nessuna modifica DOM

### `ui.js` - Interazioni
**Responsabilità:** Eventi e interazioni utente
- Click, doppio click, context menu
- Selezione turni
- Navigazione viste
- Keyboard shortcuts
- Aggiornamento titoli
- **Regola:** Coordina altri moduli, nessuna business logic

### `render/` - Rendering Viste
**Responsabilità:** Ogni file rende UNA vista specifica
- Riceve dati da state/storage
- Genera DOM della vista
- Registra event handlers
- **Regola:** Nessun accesso diretto a localStorage

### `app.js` - Bootstrap
**Responsabilità:** Punto di ingresso applicazione
- Inizializza stato
- Carica storage
- Rende prima vista
- Setup shortcuts
- Espone funzioni globali (compatibilità onclick)
- **Regola:** Deve rimanere < 100 righe

## 🔑 Principi Chiave

### 1. Separazione delle Responsabilità
Ogni modulo ha UNA sola responsabilità chiara. Se un modulo fa più cose, va spezzato.

### 2. Dipendenze Unidirezionali
```
app.js → ui.js → render/* → turni/calendar/note → storage/state
```
Nessun modulo di livello inferiore può importare moduli di livello superiore.

### 3. Nessun Stato Nascosto
Tutto lo stato sta in `state.js`. Nessun `let` globale negli altri moduli (solo `const` o funzioni pure).

### 4. localStorage Centralizzato
Solo `storage.js` può chiamare `localStorage.getItem/setItem`.

### 5. Business Logic Isolata
Tutti i calcoli ore/turni sono in `turni.js`. Nessun altro modulo duplica questa logica.

## ✅ Come Aggiungere Funzionalità

### Voglio aggiungere una nuova vista
1. Crea `js/render/nuova-vista.js`
2. Esporta `renderNuovaVista()`
3. Importa in `ui.js` e aggiungi a `showView()`
4. Aggiungi `<section id="nuova-vista">` in `index.html`

### Voglio aggiungere un nuovo calcolo ore
1. Aggiungi la funzione in `turni.js`
2. Importala dove serve nei render
3. NON duplicare la logica altrove

### Voglio cambiare da localStorage a backend
1. Modifica SOLO `storage.js`
2. Mantieni le stesse funzioni esportate
3. Cambia implementazione interna
4. Zero modifiche agli altri file

### Voglio aggiungere un nuovo tipo di dato
1. Aggiungi in `state.js` (con setter)
2. Aggiungi carica/salva in `storage.js`
3. Usa nei render tramite import

## 🚫 Anti-Pattern da Evitare

### ❌ NON fare:
- Accedere a `localStorage` fuori da `storage.js`
- Creare variabili `let` globali fuori da `state.js`
- Manipolare DOM di altre viste
- Duplicare logica di calcolo
- Mettere business logic nei render
- Creare dipendenze circolari

### ✅ Fare invece:
- Import funzioni da moduli dedicati
- Chiamare setters di `state.js`
- Usare funzioni pure dove possibile
- Testare mentalmente isolando il modulo
- Chiedere: "Se cambio questo, cosa si rompe?"

## 📊 Flusso Dati Tipico

### Esempio: Utente assegna un turno

1. **UI** (`ui.js`): Click su cella → `assegnaTurno()`
2. **Storage** (`storage.js`): `salvaTurno()` → localStorage
3. **State** (`state.js`): Nessun cambio (dato già in localStorage)
4. **Render** (`render/mese.js`): Aggiorna cella DOM
5. **Turni** (`turni.js`): Ricalcola ore se richiesto

### Esempio: Utente cambia mese

1. **UI** (`ui.js`): Click freccia → `meseSuccessivo()`
2. **State** (`state.js`): `meseCorrente++`
3. **Render** (`render/mese.js`): `renderMese()` con nuovo mese
4. **Calendar** (`calendar.js`): `giorniNelMese()` per nuovo mese
5. **Storage** (`storage.js`): `caricaTurno()` per ogni giorno

## 🧪 Testing Mentale

Per ogni modifica, chiediti:

1. **Quale modulo deve cambiare?**
   - Se più di uno, forse c'è un problema di design

2. **Quali moduli dipendono da questo?**
   - Verifica le import per capire l'impatto

3. **Posso testare questo in isolamento?**
   - Se no, il modulo ha troppe dipendenze

4. **Se rimuovo questo, cosa si rompe?**
   - Dovrebbero rompersi solo i moduli che lo importano

## 🎯 Obiettivi Raggiunti

✅ **Codice organizzato**: Ogni file < 500 righe (tranne config)
✅ **Responsabilità chiare**: Sai sempre dove modificare
✅ **Manutenibilità**: Modifiche locali, impatto limitato
✅ **Estendibilità**: Aggiungi funzioni senza paura
✅ **Testabilità**: Ogni modulo testabile in isolamento
✅ **Scalabilità**: Pronto per backend, multi-tenant, ecc.

## 📚 Prossimi Passi Possibili

Con questa architettura, ora puoi:
- Aggiungere un backend (FastAPI, Express, ecc.)
- Implementare autenticazione utenti
- Aggiungere vincoli avanzati (es: max ore/settimana)
- Export Excel/PDF reale
- Notifiche push
- Multi-ospedale
- Dashboard analytics
- Mobile app (React Native con stessa logica)

**La logica di business è già isolata e pronta da riutilizzare!**
