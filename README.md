# 🏥 Gestione Turni Ospedale v3.6

Sistema modulare per la gestione dei turni ospedalieri.

## 🎯 Caratteristiche

- **Vista Mensile**: Calendario completo con assegnazione turni
- **Vista Annuale**: Panoramica dell'anno con statistiche
- **Vista Ambulatorio**: Filtraggio per sede
- **Vista Stampa**: Esportazione ottimizzata
- **Configurazione**: Gestione operatori, ambulatori e turni
- **Turni Segmentati**: Support per turni multi-sede
- **Sistema Note**: Annotazioni per giorno/operatore
- **Calcolo Ore**: Automatico con supporto pause e turni notturni

## 🚀 Utilizzo

### Apertura Applicazione

Apri `index.html` nel browser (consigliato: Chrome, Firefox, Edge moderni).

**Nota**: L'app usa ES6 modules. Se apri direttamente il file (file://), alcuni browser potrebbero bloccare i moduli per CORS.

Soluzioni:
1. Usa un server HTTP locale (consigliato):
   ```bash
   python3 -m http.server 8000
   # Poi apri: http://localhost:8000
   ```

2. Oppure usa Live Server in VS Code

3. Oppure configura il browser per permettere file:// (non consigliato per sicurezza)

### Prima Configurazione

1. **Configurazione** → Aggiungi i tuoi operatori
2. **Configurazione** → Configura ambulatori e turni
3. **Vista Mese** → Seleziona turno dalla barra e clicca sulle celle
4. **Vista Stampa** → Esporta per ambulatorio

## 📁 Struttura Progetto

```
/prova/
├── index.html              # HTML pulito (solo markup)
├── css/style.css          # Tutti gli stili
├── js/
│   ├── app.js             # Bootstrap applicazione
│   ├── state.js           # Stato globale
│   ├── storage.js         # Persistenza dati (localStorage)
│   ├── calendar.js        # Logica calendario
│   ├── turni.js           # Calcoli ore/turni
│   ├── note.js            # Gestione note
│   ├── ui.js              # Eventi UI
│   └── render/            # Moduli rendering viste
│       ├── mese.js
│       ├── anno.js
│       ├── ambulatorio.js
│       ├── stampa.js
│       ├── config.js
│       └── note-editor.js
└── ARCHITECTURE.md        # Documentazione architettura
```

## 🏗️ Architettura

L'applicazione segue una **architettura modulare a responsabilità separate**:

- **Nessun codice monolitico**: ~2500 righe organizzate in 15 file
- **Separazione logica/presentazione**: Business logic isolata dal rendering
- **Storage centralizzato**: UNICO punto di accesso a localStorage
- **Stato immutabile**: Gestito tramite setters controllati
- **Moduli puri**: Nessun side-effect nascosto

Vedi [ARCHITECTURE.md](ARCHITECTURE.md) per dettagli completi.

## 🛠️ Tecnologie

- **Vanilla JavaScript (ES6+)**: Nessuna dipendenza esterna
- **CSS3**: Responsive design + print styles
- **localStorage**: Persistenza locale dei dati
- **ES6 Modules**: Importazione modulare

## 📝 Note Tecniche

### Calcolo Ore

Il sistema calcola le ore lavorative in **minuti** per precisione, supportando:
- Turni singoli con ingresso/uscita
- Turni segmentati (multi-sede)
- Pause (sottratte o meno)
- Turni notturni (es: 22:00 - 06:00)

Formato visualizzazione: `HH:MM` (base 60).

### Persistenza Dati

Tutti i dati sono salvati in `localStorage`:
- Configurazione (operatori, ambulatori, turni)
- Turni assegnati (chiave: `ANNO_MESE_OPERATORE_GIORNO`)
- Note (chiave: `ANNO_MESE_OPERATORE_GIORNO_note`)

Per esportare i dati: `console.log(localStorage)` nella console browser.

Per importare in altro browser: copia il localStorage.

### Compatibilità Browser

- ✅ Chrome 61+
- ✅ Firefox 60+
- ✅ Edge 79+
- ✅ Safari 11+
- ❌ Internet Explorer (non supportato)

## 🔄 Changelog

### v3.5 (2025-01-18) - Turni Speciali e Miglioramenti UI
- ✅ Migliorato calcolo ore per turni speciali (ferie, permessi, etc.)
- ✅ Separazione visiva turni normali/speciali in configurazione
- ✅ Pulsanti rapidi per creare turni speciali comuni
- ✅ Visualizzazione migliorata dei turni speciali nella barra
- ✅ Fix gestione turni con ore=0

### v3.2 (2025-01-17) - Refactoring Modulare
- ✅ Separazione codice in 15 moduli
- ✅ Architettura a responsabilità separate
- ✅ Storage centralizzato
- ✅ Business logic isolata
- ✅ Preparato per backend futuro
- ✅ Documentazione architettura completa

### v3.1 (Precedente)
- Versione monolitica funzionante (~4000 righe)
- Tutte le funzionalità base implementate

## 🚧 Roadmap Possibile

Con l'architettura modulare, ora è possibile:

- [ ] Backend API (FastAPI/Express)
- [ ] Autenticazione utenti
- [ ] Database (PostgreSQL/MongoDB)
- [ ] Export Excel/PDF reale
- [ ] Notifiche push
- [ ] Multi-ospedale
- [ ] Dashboard analytics
- [ ] App mobile (React Native)

## 📄 Licenza

Uso interno - Gestione Turni Ospedale

## 👨‍💻 Sviluppo

Per contribuire:

1. Leggi [ARCHITECTURE.md](ARCHITECTURE.md)
2. Rispetta i principi di separazione
3. Testa le modifiche
4. Documenta i cambiamenti

---

**Ultima modifica:** 2025-01-18 | **Versione:** 3.5
