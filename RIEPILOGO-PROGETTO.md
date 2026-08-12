# Riepilogo progetto — Simulatore prova d'ammissione L-19

## Obiettivo
App web per esercitarsi con quiz a risposta multipla in stile prova di ammissione L-19
(Scienze dell'educazione e della formazione, Padova), uso personale/familiare. Regole: 60
domande casuali per sessione, 60 minuti di tempo, punteggio +1 corretta / −0,25 errata / 0 in
bianco, in sessantesimi.

## Dati
Pool totale: **2557 quiz completi e verificati**, da 4 fonti, tutte incrociate con una chiave di
risposte affidabile e scartando ciò che non era leggibile per intero, dipendente da immagini/
diagrammi, o senza una risposta corretta univoca accertabile:

1. **Manuale di preparazione fotografato (Alpha Test)** — 1311 quiz a 5 opzioni, letti dalle 124
   foto e incrociati con la chiave delle risposte ufficiale stampata nel libro. Categorie:
   Ragionamento logico e verbale (643), Logica numerica (665), Ragionamento quantitativo (5).
2. **Questionari ufficiali PDF, concorso Scienze della Formazione Primaria (Udine)** — 363 quiz a
   4 opzioni, da 5 questionari d'esame reali (2016/17-2019/20 più una versione di correzione),
   incrociati con le griglie ufficiali stampate nei PDF.
3. **Prove ufficiali di ammissione, Università di Padova** — 223 quiz dalle prove reali A.A.
   2016-2017, 2017-2018, 2018-2019, 2019-2020. Per 2018-2019 e 2019-2020 la risposta viene dalla
   chiave ufficiale allegata. Per 2016-2017 e 2017-2018 (nessuna chiave ufficiale disponibile) la
   risposta è stata derivata tramite ricerca e ragionamento passo-passo, scartando ogni domanda
   con ambiguità residua; queste sono etichettate "risposte non ufficiali, derivate" nella
   categoria per essere riconoscibili.
4. **Materiale "test-nuovi" (Excel/zip)** — 660 quiz (60 + 600), con spiegazione inclusa per ogni
   domanda, organizzati esattamente sulle 5 aree ufficiali del bando (Comprensione del testo,
   Competenza linguistica, Cultura umanistica, Ragionamento logico, Cultura scientifica).

Il campo `explanation` nello schema è popolato solo per le domande della fonte 4; per le altre è
vuoto (il frontend lo mostra automaticamente quando presente, altrimenti lo omette).

**Quiz esclusi per policy**: tutte le domande a riempimento basate su un brano già coperto da
un'altra domanda irrisolvibile senza il brano stesso, e tutte le domande dipendenti da immagini,
figure o diagrammi non trascrivibili in testo, sono state scartate e non sono nel database
(confermato esplicitamente come scelta voluta, non solo un limite tecnico attuale).

## App
Stack: Node.js + Express + `node:sqlite` (modulo SQLite integrato in Node, **nessuna dipendenza
nativa da compilare** — solo Express da installare via npm). Frontend: pagina unica in vanilla
JS/HTML/CSS (nessun framework), con timer countdown, navigatore delle 60 domande, salvataggio
automatico delle risposte a ogni click, e report finale con dettaglio domanda/risposta
data/risposta corretta (+ spiegazione quando disponibile). Il timer è robusto lato server: ogni
sessione ha un `ends_at` calcolato alla creazione; qualunque chiamata dopo la scadenza chiude
automaticamente la prova e calcola il punteggio, anche se il client viene manomesso o chiuso.

Testato end-to-end in locale più volte man mano che i dati crescevano (1311 → 1674 → 1934 → 2557
domande): creazione sessione, risposte, chiusura, calcolo punteggio verificato matematicamente,
scadenza automatica del tempo, distribuzione realistica delle domande tra tutte le fonti — tutto
funzionante.

**Selezione fonte quiz**: ogni domanda ha un campo `source` (manuale / udine / padova / nuovi).
La schermata iniziale mostra un elenco di checkbox (una per fonte, con conteggio) — di default
tutte selezionate, comportamento identico a prima. L'endpoint `POST /api/sessions` accetta un
campo opzionale `sources` (array di chiavi) per pescare le 60 domande solo dalle fonti scelte;
`GET /api/sources` restituisce l'elenco delle fonti disponibili con relativo conteggio. Testato
con selezioni parziali (es. solo "padova"+"nuovi": 60 domande pescate correttamente solo da quelle
categorie) e con selezione non valida (errore gestito correttamente).

**Posizione file sul computer**: cartella `Tolc/tolc-app` (dentro la cartella `Tolc` connessa).
File chiave: `server.js`, `db/` (schema.sql, init.js, seed.js), `data/questions_final.json`
(i 2557 quiz), `public/` (index.html, css/, js/), `README.md` (istruzioni avvio locale),
`METTERE-ONLINE.md` (guida completa al deploy).

Avvio locale: `cd tolc-app && npm install && npm start`, poi `http://localhost:3000`. Richiede
Node.js ≥ 22.13.

## Messa online
Scelto **Render** (unico servizio con piano gratuito reale nel 2026, nessuna carta di credito;
limite: sospensione dopo 15 min di inattività, primo caricamento successivo lento 30-60s — non
un problema per uso occasionale).

Fatto finora:
1. Creato repository GitHub **`casanovadesigncom-cmyk/tolc-quiz-app`** (pubblico).
2. Caricato tutto il codice iniziale (1674 domande) e poi un aggiornamento (struttura verificata:
   `data/`, `db/`, `public/`, più i file di root).
3. File `render.yaml` già pronto nel repo con configurazione corretta (build/start command,
   `NODE_VERSION=22.14.0`) così Render può fare il deploy leggendo automaticamente quel file
   (opzione "New +" → "Blueprint" nella dashboard Render).

Nota tecnica: il caricamento automatico dei file su GitHub via browser ha un bug persistente
(strumento di upload file non funzionante) — ogni aggiornamento richiede che l'utente trascini
manualmente i file aggiornati nella pagina GitHub, seguendo istruzioni passo-passo fornite di
volta in volta.

## Prossimo passo (da fare)
1. Ricaricare su GitHub la versione aggiornata di `data/questions_final.json` (2557 domande) e
   di `README.md` (trascinamento manuale nella pagina del repository, sostituendo i file
   esistenti).
2. Se non ancora fatto, completare la messa online su **render.com**: "Get Started" → "Sign up
   with GitHub" → autorizzare Render (l'utente deve creare l'account, non l'assistente) → nella
   dashboard: "New +" → "Blueprint" → selezionare `tolc-quiz-app` → "Apply"/"Create" (piano Free
   già impostato dal `render.yaml`).
3. Attendere il deploy (qualche minuto), poi usare il link pubblico tipo
   `https://tolc-quiz-app.onrender.com`. Se il servizio è già online, Render effettua un
   redeploy automatico non appena rileva il nuovo codice su GitHub — basta attendere qualche
   minuto dopo il caricamento.

La guida completa passo-passo è nel file `METTERE-ONLINE.md` dentro la cartella `tolc-app`.

## Domanda aperta (in attesa di decisione dell'utente)
Il materiale `test-pd` contiene anche quiz a riempimento dipendenti da un brano condiviso e quiz
con immagini/diagrammi. Per policy esplicita dell'utente, questi sono esclusi dal database e non
compaiono nell'app. Se in futuro si vorranno includere, servirebbe un'estensione dedicata (colonna
`image` in `questions`, file immagine in `public/images/`, rendering `<img>` nel frontend) — non
ancora sviluppata, in attesa di eventuale richiesta.
