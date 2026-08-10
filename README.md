# Simulatore prova d'ammissione L-19 (uso personale/familiare)

App locale per esercitarsi con quiz a risposta multipla, estratti da un manuale di preparazione.
60 domande casuali per sessione, 60 minuti di tempo, punteggio +1 / -0,25 / 0.

## Avvio

Richiede [Node.js](https://nodejs.org) (versione 22.13 o superiore) installato sul computer.

```bash
cd tolc-app
npm install
npm start
```

Poi apri il browser su **http://localhost:3000**.

Al primo avvio il database SQLite (`quiz.sqlite`) viene creato e popolato automaticamente con le
domande presenti in `data/questions_final.json` (1311 quiz completi, estratti dalle foto del manuale
e verificati con la chiave delle risposte ufficiale stampata nel libro).

## Struttura del progetto

```
tolc-app/
  server.js          backend Express: API + file statici
  db/
    schema.sql        schema del database
    init.js            apertura/creazione del DB
    seed.js            popolamento iniziale da data/questions_final.json
  data/
    questions_final.json   quiz estratti (domanda, opzioni, risposta corretta)
  public/
    index.html         pagina unica (home, esame, report)
    css/style.css
    js/app.js           logica frontend (timer, navigazione, invio risposte)
  quiz.sqlite         database (creato al primo avvio)
```

## Come funziona il timer (robusto lato server)

Alla creazione di una sessione il server calcola `ends_at = ora_creazione + 60 minuti` e lo salva nel
database. Il countdown mostrato nel browser è solo visuale: ogni richiesta al server (salvataggio
risposta, chiusura prova, richiesta report) controlla `ends_at` sul server. Se il tempo è scaduto,
la sessione viene chiusa automaticamente e il punteggio calcolato, **anche se il browser viene chiuso,
il tempo di sistema del client viene alterato, o le richieste vengono manipolate**. Non è quindi
possibile "barare" allungando il tempo lato client.

## Estendibilità futura

- **Categorie per area del bando**: la tabella `questions` ha già un campo `topic_area` (oggi vuoto)
  pensato per essere popolato in futuro con una delle 5 aree del bando (comprensione del testo,
  competenza linguistica, cultura umanistica, ragionamento logico, cultura scientifica). Una volta
  etichettate le domande, si può modificare l'endpoint `POST /api/sessions` in `server.js` per pescare
  un numero prefissato di domande per ciascuna area invece che in modo puramente casuale.
- **Spiegazioni**: la tabella `questions` ha un campo `explanation`, oggi vuoto (il manuale originale
  non contiene spiegazioni, solo la lettera corretta). Per popolarlo in futuro basta scrivere uno
  script che, per ogni domanda, generi una spiegazione (ad esempio chiedendola a Claude) e la salvi con:
  `UPDATE questions SET explanation = ? WHERE id = ?`. Il frontend (report finale) è già pronto a
  mostrarla automaticamente non appena il campo non è più vuoto.

## Note sui dati

Le domande sono state estratte da foto del manuale tramite lettura automatica (OCR), includendo
**solo i quiz leggibili per intero** (numero, categoria, testo e tutte le opzioni) e verificati
incrociando il numero di domanda con la chiave delle risposte ufficiale stampata nel libro. Le
domande ambigue, tagliate, dipendenti da un diagramma non trascrivibile con certezza, o senza
riscontro nella chiave delle risposte sono state scartate.
