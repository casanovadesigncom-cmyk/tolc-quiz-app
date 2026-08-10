const path = require('path');
const express = require('express');
const { openDb } = require('./db/init');
const { seed } = require('./db/seed');

const PORT = process.env.PORT || 3000;
const NUM_QUESTIONS = Number(process.env.EXAM_NUM_QUESTIONS) || 60;
// EXAM_DURATION_SECONDS è pensato solo per test/debug locali (es. verificare la scadenza
// automatica senza aspettare un'ora): di norma la durata è sempre 60 minuti.
const DURATION_SECONDS = Number(process.env.EXAM_DURATION_SECONDS) || 60 * 60; // 60 minuti
const POINTS_CORRECT = 1;
const POINTS_WRONG = -0.25;
const POINTS_BLANK = 0;

const db = openDb();

// Seed automatico al primo avvio se il DB è vuoto
const questionCount = db.prepare('SELECT COUNT(*) AS n FROM questions').get().n;
if (questionCount === 0) {
  console.log('Database vuoto: eseguo il seed iniziale...');
  seed();
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nowIso() {
  return new Date().toISOString();
}

// Se una sessione è scaduta (server-side) ma risulta ancora "in_progress",
// la finalizza automaticamente calcolando il punteggio. Questo rende il
// timer robusto anche se il client viene chiuso, manomesso o va offline:
// la verità sul tempo è sempre e solo ends_at, calcolato alla creazione.
function finalizeIfExpired(sessionId) {
  const session = db.prepare('SELECT * FROM exam_sessions WHERE id = ?').get(sessionId);
  if (!session) return null;
  if (session.status === 'in_progress' && new Date(session.ends_at).getTime() <= Date.now()) {
    return closeSession(sessionId, session.ends_at);
  }
  return session;
}

function closeSession(sessionId, atIso) {
  const session = db.prepare('SELECT * FROM exam_sessions WHERE id = ?').get(sessionId);
  if (!session) return null;
  if (session.status === 'completed') return session;

  const sessionQuestions = db
    .prepare('SELECT question_id FROM session_questions WHERE session_id = ?')
    .all(sessionId);
  const answers = db
    .prepare('SELECT question_id, selected_option_id FROM answers WHERE session_id = ?')
    .all(sessionId);
  const answerByQuestion = new Map(answers.map((a) => [a.question_id, a.selected_option_id]));

  let correct = 0;
  let wrong = 0;
  let blank = 0;

  for (const sq of sessionQuestions) {
    const selectedOptionId = answerByQuestion.get(sq.question_id);
    if (selectedOptionId === undefined || selectedOptionId === null) {
      blank++;
      continue;
    }
    const opt = db.prepare('SELECT is_correct FROM options WHERE id = ?').get(selectedOptionId);
    if (opt && opt.is_correct) {
      correct++;
    } else {
      wrong++;
    }
  }

  const score = correct * POINTS_CORRECT + wrong * POINTS_WRONG + blank * POINTS_BLANK;

  db.prepare(
    `UPDATE exam_sessions
     SET status = 'completed', closed_at = @closed_at, score = @score,
         num_correct = @correct, num_wrong = @wrong, num_blank = @blank
     WHERE id = @id`
  ).run({
    id: sessionId,
    closed_at: atIso || nowIso(),
    score,
    correct,
    wrong,
    blank,
  });

  return db.prepare('SELECT * FROM exam_sessions WHERE id = ?').get(sessionId);
}

// --- POST /api/sessions: crea una nuova simulazione con 60 domande casuali ---
app.post('/api/sessions', (req, res) => {
  const allIds = db.prepare('SELECT id FROM questions').all().map((r) => r.id);
  if (allIds.length < NUM_QUESTIONS) {
    return res.status(500).json({
      error: `Il database contiene solo ${allIds.length} domande, ne servono almeno ${NUM_QUESTIONS}.`,
    });
  }

  const chosen = shuffle(allIds).slice(0, NUM_QUESTIONS);
  const createdAt = new Date();
  const endsAt = new Date(createdAt.getTime() + DURATION_SECONDS * 1000);

  const insertSession = db.prepare(
    `INSERT INTO exam_sessions (created_at, ends_at, duration_seconds, num_questions, status)
     VALUES (@created_at, @ends_at, @duration_seconds, @num_questions, 'in_progress')`
  );
  const insertSessionQuestion = db.prepare(
    `INSERT INTO session_questions (session_id, question_id, position, option_order)
     VALUES (@session_id, @question_id, @position, @option_order)`
  );

  let sessionId;
  db.exec('BEGIN');
  try {
    const info = insertSession.run({
      created_at: createdAt.toISOString(),
      ends_at: endsAt.toISOString(),
      duration_seconds: DURATION_SECONDS,
      num_questions: NUM_QUESTIONS,
    });
    sessionId = info.lastInsertRowid;

    chosen.forEach((questionId, idx) => {
      const optionIds = db
        .prepare('SELECT id FROM options WHERE question_id = ?')
        .all(questionId)
        .map((r) => r.id);
      const shuffledOptionIds = shuffle(optionIds);
      insertSessionQuestion.run({
        session_id: sessionId,
        question_id: questionId,
        position: idx + 1,
        option_order: JSON.stringify(shuffledOptionIds),
      });
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  res.json({
    id: sessionId,
    ends_at: endsAt.toISOString(),
    duration_seconds: DURATION_SECONDS,
    num_questions: NUM_QUESTIONS,
  });
});

// --- GET /api/sessions/:id: stato sessione + tutte le domande/opzioni (senza rivelare la risposta corretta) ---
app.get('/api/sessions/:id', (req, res) => {
  const sessionId = Number(req.params.id);
  const session = finalizeIfExpired(sessionId);
  if (!session) return res.status(404).json({ error: 'Sessione non trovata' });

  const sessionQuestions = db
    .prepare(
      `SELECT sq.position, sq.question_id, sq.option_order, q.category, q.text
       FROM session_questions sq
       JOIN questions q ON q.id = sq.question_id
       WHERE sq.session_id = ?
       ORDER BY sq.position ASC`
    )
    .all(sessionId);

  const answers = db
    .prepare('SELECT question_id, selected_option_id FROM answers WHERE session_id = ?')
    .all(sessionId);
  const answerByQuestion = new Map(answers.map((a) => [a.question_id, a.selected_option_id]));

  const optionStmt = db.prepare('SELECT id, letter, text FROM options WHERE id = ?');

  const questions = sessionQuestions.map((sq) => {
    const optionOrder = JSON.parse(sq.option_order);
    const options = optionOrder.map((optId) => optionStmt.get(optId));
    return {
      position: sq.position,
      question_id: sq.question_id,
      category: sq.category,
      text: sq.text,
      options,
      selected_option_id: answerByQuestion.get(sq.question_id) ?? null,
    };
  });

  res.json({
    id: session.id,
    status: session.status,
    created_at: session.created_at,
    ends_at: session.ends_at,
    duration_seconds: session.duration_seconds,
    num_questions: session.num_questions,
    server_now: nowIso(),
    questions,
  });
});

// --- PUT /api/sessions/:id/answer: salva/aggiorna la risposta a una domanda ---
app.put('/api/sessions/:id/answer', (req, res) => {
  const sessionId = Number(req.params.id);
  const session = finalizeIfExpired(sessionId);
  if (!session) return res.status(404).json({ error: 'Sessione non trovata' });
  if (session.status !== 'in_progress') {
    return res.status(409).json({ error: 'La sessione è terminata: tempo scaduto o prova già conclusa.' });
  }

  const { question_id, selected_option_id } = req.body || {};
  if (!question_id) return res.status(400).json({ error: 'question_id mancante' });

  const belongs = db
    .prepare('SELECT 1 FROM session_questions WHERE session_id = ? AND question_id = ?')
    .get(sessionId, question_id);
  if (!belongs) return res.status(400).json({ error: 'Questa domanda non appartiene a questa sessione.' });

  if (selected_option_id !== null && selected_option_id !== undefined) {
    const validOption = db
      .prepare('SELECT 1 FROM options WHERE id = ? AND question_id = ?')
      .get(selected_option_id, question_id);
    if (!validOption) return res.status(400).json({ error: 'Opzione non valida per questa domanda.' });
  }

  if (selected_option_id === null || selected_option_id === undefined) {
    // Risposta lasciata in bianco: rimuovi eventuale risposta precedente
    db.prepare('DELETE FROM answers WHERE session_id = ? AND question_id = ?').run(sessionId, question_id);
  } else {
    db.prepare(
      `INSERT INTO answers (session_id, question_id, selected_option_id, answered_at)
       VALUES (@session_id, @question_id, @selected_option_id, @answered_at)
       ON CONFLICT(session_id, question_id) DO UPDATE SET
         selected_option_id = excluded.selected_option_id,
         answered_at = excluded.answered_at`
    ).run({
      session_id: sessionId,
      question_id,
      selected_option_id,
      answered_at: nowIso(),
    });
  }

  res.json({ ok: true });
});

// --- POST /api/sessions/:id/close: chiude la prova e calcola il punteggio ---
app.post('/api/sessions/:id/close', (req, res) => {
  const sessionId = Number(req.params.id);
  let session = db.prepare('SELECT * FROM exam_sessions WHERE id = ?').get(sessionId);
  if (!session) return res.status(404).json({ error: 'Sessione non trovata' });

  session = finalizeIfExpired(sessionId) || session;
  if (session.status !== 'completed') {
    session = closeSession(sessionId, nowIso());
  }

  res.json({
    id: session.id,
    status: session.status,
    score: session.score,
    num_correct: session.num_correct,
    num_wrong: session.num_wrong,
    num_blank: session.num_blank,
    num_questions: session.num_questions,
  });
});

// --- GET /api/sessions/:id/report: report finale dettagliato ---
app.get('/api/sessions/:id/report', (req, res) => {
  const sessionId = Number(req.params.id);
  let session = finalizeIfExpired(sessionId);
  if (!session) return res.status(404).json({ error: 'Sessione non trovata' });
  if (session.status !== 'completed') {
    return res.status(409).json({ error: 'La sessione non è ancora conclusa.' });
  }

  const sessionQuestions = db
    .prepare(
      `SELECT sq.position, sq.question_id, sq.option_order, q.category, q.text, q.explanation
       FROM session_questions sq
       JOIN questions q ON q.id = sq.question_id
       WHERE sq.session_id = ?
       ORDER BY sq.position ASC`
    )
    .all(sessionId);

  const answers = db
    .prepare('SELECT question_id, selected_option_id FROM answers WHERE session_id = ?')
    .all(sessionId);
  const answerByQuestion = new Map(answers.map((a) => [a.question_id, a.selected_option_id]));
  const optionStmt = db.prepare('SELECT id, letter, text, is_correct FROM options WHERE id = ?');

  const questions = sessionQuestions.map((sq) => {
    const optionOrder = JSON.parse(sq.option_order);
    const options = optionOrder.map((optId) => optionStmt.get(optId));
    const selectedOptionId = answerByQuestion.get(sq.question_id) ?? null;
    const correctOption = options.find((o) => o.is_correct);
    const selectedOption = options.find((o) => o.id === selectedOptionId) || null;
    let outcome = 'blank';
    if (selectedOption) {
      outcome = selectedOption.is_correct ? 'correct' : 'wrong';
    }
    return {
      position: sq.position,
      category: sq.category,
      text: sq.text,
      explanation: sq.explanation,
      options,
      selected_option_id: selectedOptionId,
      correct_option_id: correctOption ? correctOption.id : null,
      outcome,
    };
  });

  res.json({
    id: session.id,
    score: session.score,
    num_correct: session.num_correct,
    num_wrong: session.num_wrong,
    num_blank: session.num_blank,
    num_questions: session.num_questions,
    created_at: session.created_at,
    closed_at: session.closed_at,
    questions,
  });
});

app.listen(PORT, () => {
  console.log(`Simulatore prova d'ammissione L-19 in ascolto su http://localhost:${PORT}`);
});
