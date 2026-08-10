# Come mettere online l'app (gratis, con Render)

Render è il servizio più semplice per mettere online gratis una piccola app come questa, senza
carta di credito. L'unico limite del piano gratuito: se l'app resta inattiva per 15 minuti si
"addormenta" e il primo caricamento successivo richiede 30-60 secondi. Per una simulazione d'esame
usata occasionalmente in famiglia va benissimo.

Il database dei quiz viene ricreato automaticamente ad ogni riavvio (è già previsto dall'app), quindi
non c'è nulla da configurare per i dati.

## Passo 1 — Crea un account GitHub (gratis)

1. Vai su **https://github.com/signup** e crea un account (email, password, nome utente).
2. Conferma l'email quando richiesto.

## Passo 2 — Carica il codice dell'app su GitHub

1. Su github.com, clicca **New repository** (in alto a destra, icona "+").
2. Dai un nome al repository, ad esempio `tolc-quiz-app`. Lascialo **Public** (va bene, non contiene
   dati personali). Non aggiungere README/gitignore (li abbiamo già).
3. Clicca **Create repository**.
4. Nella pagina del nuovo repository vuoto, clicca **uploading an existing file**.
5. Trascina dentro TUTTI i file e le cartelle presenti in questa cartella `tolc-app`
   (`server.js`, `package.json`, `render.yaml`, `.gitignore`, `README.md`, e le cartelle `db/`,
   `data/`, `public/`) **tranne** `node_modules` e `quiz.sqlite` se presenti (non servono online).
6. In fondo alla pagina clicca **Commit changes**.

## Passo 3 — Crea un account Render e collega GitHub

1. Vai su **https://render.com** e clicca **Get Started**, poi scegli di registrarti **con GitHub**
   (così i due account restano collegati automaticamente).
2. Autorizza Render ad accedere ai tuoi repository GitHub quando richiesto.

## Passo 4 — Crea il servizio web

1. Nella dashboard di Render clicca **New +** → **Blueprint** (Render leggerà automaticamente il
   file `render.yaml` che abbiamo già preparato con tutte le impostazioni corrette).
2. Seleziona il repository `tolc-quiz-app` che hai appena caricato.
3. Render mostrerà il servizio `tolc-quiz-app` con piano **Free** già impostato: clicca **Apply** /
   **Create**.
4. Attendi qualche minuto mentre Render installa le dipendenze e avvia l'app (puoi seguire i log
   in tempo reale).

Se preferisci non usare il file `render.yaml` e configurare a mano: **New +** → **Web Service**,
seleziona il repository, e imposta:
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free

## Passo 5 — Usa l'app online

Quando il deploy è completo, Render mostra un link tipo `https://tolc-quiz-app.onrender.com`.
Quel link è l'app, raggiungibile da qualsiasi telefono, tablet o computer con connessione internet.
Puoi salvarlo tra i preferiti o aggiungerlo alla schermata Home del telefono come fosse un'app.

## Aggiornamenti futuri

Se in futuro vuoi aggiungere altri quiz o modificare l'app, basta caricare i file aggiornati sullo
stesso repository GitHub (pagina del repository → **Add file** → **Upload files**): Render rifà
automaticamente il deploy ad ogni modifica.
