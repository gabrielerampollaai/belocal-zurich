# beLocal in Zurich

Guida per turisti e nuovi residenti che vogliono vivere Zurigo come un local. Il cuore del sito è il **Concierge**, un agente AI basato su Claude (Anthropic) che consiglia cosa fare in base alle domande.

## Struttura

```
public/            sito statico (index.html, styles.css, app.js)
lib/concierge.mjs  logica dell'agente: prompt, modello, ricerca web, streaming
api/chat.mjs       funzione serverless Vercel: POST /api/chat
api/status.mjs     funzione serverless Vercel: GET /api/status
dev-server.mjs     server locale per lo sviluppo (stesse route di Vercel)
```

- **Modello**: `claude-opus-5-5`, effort `low`. Si cambia in `lib/concierge.mjs`.
- **Conoscenza locale**: per ora è nel prompt di sistema in `lib/concierge.mjs`. Il prossimo passo è un database curato.
- **Ricerca web**: massimo 2 ricerche per domanda, solo per orari, eventi e meteo.
- **Senza chiave API**, o in caso di errore, la chat passa alle risposte già scritte in `public/app.js`.

## Sviluppo in locale

1. Installa [Node.js](https://nodejs.org) 22 o superiore.
2. `npm install`
3. Copia `.env.example` come `.env` e inserisci la tua `ANTHROPIC_API_KEY`. Il file `.env` non va mai committato.
4. `npm run dev` (su Windows basta un doppio clic su `start.bat`), poi apri http://localhost:8000

## Deploy

Il sito è su Vercel, collegato a questo repository. Ogni push su `main` aggiorna il sito in automatico. La chiave API è salvata in Vercel → Project → Settings → Environment Variables (`ANTHROPIC_API_KEY`).
