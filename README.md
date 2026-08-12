# Simulatore prova d'ammissione L-19 (uso personale/familiare)

App locale per esercitarsi con quiz a risposta multipla, in stile prova di ammissione L-19
Scienze dell'Educazione e della Formazione (Università di Padova).
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
domande presenti in `data/questions_final.json` (**2557 quiz** completi e verificati — vedi
"Note sui dati" per il dettaglio delle fonti).

Nella schermata iniziale è possibile scegliere quali fonti includere nella simulazione (una o
più tra manuale, Udine, Padova, materiale aggiuntivo): di default sono tutte selezionate. Questo
permette, ad esempio, di fare una prova usando solo le domande più vicine al bando ufficiale di
Padova (fonti "Padova" + "materiale aggiuntivo").

### Protezione con password (opzionale)

L'app supporta una protezione opzionale con username e password (HTTP Basic Auth), utile perché
l'URL pubblico su Render è raggiungibile da chiunque abbia il link. Per attivarla basta impostare
due variabili d'ambiente prima di avviare il server:

```bash
APP_USERNAME=tuoutente APP_PASSWORD=tuapassword npm start
```

Se queste variabili non sono impostate, l'app resta accessibile senza password (comportamento di
default, comodo per lo sviluppo in locale). Su Render, `render.yaml` dichiara già le due chiavi
`APP_USERNAME` e `APP_PASSWORD` (senza valore, `sync: false`): vanno impostate manualmente nella
dashboard Render, in **Environment**, così restano private e non finiscono su GitHub.

## Struttura del progetto

```
tolc-app/
  server.js          backend Express: API + file statici
  db/
    schema.sql        schema del database
    init.js            apertura/creazione del DB
    seed.js            popolamento iniziale da data/questions_final.json
  data/
    questions_final.json   quiz estratti (domanda, opzioni, risposta corretta, spiegazione)
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
  competenza linguistica, cultura umanistica, ragionamento logico, cultura scientifica). Nota: una
  parte delle domande più recenti (vedi sotto) ha già una `category` allineata esattamente a queste
  5 aree. Una volta etichettate tutte, si può modificare l'endpoint `POST /api/sessions` in
  `server.js` per pescare un numero prefissato di domande per ciascuna area invece che in modo
  puramente casuale.
- **Spiegazioni**: la tabella `questions` ha un campo `explanation`. Una parte delle domande (quelle
  provenienti da "test-nuovi", vedi sotto) lo ha già popolato; per le altre è vuoto. Per popolarlo si
  può scrivere uno script che, per ogni domanda, generi una spiegazione e la salvi con:
  `UPDATE questions SET explanation = ? WHERE id = ?`. Il frontend (report finale) è già pronto a
  mostrarla automaticamente non appena il campo non è più vuoto.
- **Domande con immagini/diagrammi**: l'app attuale mostra solo testo. Tutte le domande dipendenti da
  un diagramma, una figura o un'immagine non trascrivibile in testo sono state scartate in fase di
  importazione (non sono nel database). Per supportarle in futuro servirebbe: una colonna `image` in
  `questions`, i file immagine salvati in `public/images/`, e un tag `<img>` nella schermata della
  domanda (`public/js/app.js` + `public/index.html`) — è un'estensione separata, non ancora fatta.

## Note sui dati

Le 2557 domande provengono da più fonti, tutte verificate e scartando ciò che non era leggibile per
intero, dipendente da immagini/diagrammi, o senza una risposta corretta univoca accertabile:

- **Manuale di preparazione (foto, Alpha Test)**: 1311 quiz a 5 opzioni (categorie "Ragionamento
  logico e verbale", "Logica numerica", ecc.), letti dalle foto e incrociati con la chiave delle
  risposte ufficiale stampata nel libro.
- **Questionari ufficiali PDF (concorso Scienze della Formazione Primaria, Udine)**: 363 quiz a 4
  opzioni da 5 questionari d'esame reali (anni 2016/17, 2017/18, 2018/19, 2019/20, più una versione
  di correzione), incrociati con le griglie ufficiali delle risposte stampate nei PDF.
- **Prove ufficiali di ammissione, Università di Padova**: 223 quiz dalle prove reali A.A. 2016-2017,
  2017-2018, 2018-2019, 2019-2020. Per le prove 2018-2019 e 2019-2020 la risposta corretta viene
  dalla chiave ufficiale allegata (affidabilità massima). **Per le prove 2016-2017 e 2017-2018 non
  era disponibile una chiave ufficiale**: la risposta è stata determinata tramite ragionamento e
  verifica (ricerca su fonti attendibili per le domande nozionistiche, risoluzione passo passo per
  quelle logico-matematiche); ogni domanda per cui non è stato possibile escludere con sicurezza le
  alternative sbagliate è stata scartata anziché indovinata. Queste domande sono etichettate in
  `category` con la dicitura "risposte non ufficiali, derivate" per essere riconoscibili.
- **Materiale "test-nuovi"**: 660 quiz (60 + 600) già strutturati con spiegazione inclusa per ogni
  domanda, organizzati esattamente sulle 5 aree ufficiali del bando (Comprensione del testo,
  Competenza linguistica, Cultura umanistica, Ragionamento logico, Cultura scientifica).
