-- Schema del database per il simulatore di prova d'ammissione L-19

CREATE TABLE IF NOT EXISTS questions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_number INTEGER,              -- numero originale nel manuale (riferimento/debug)
  source        TEXT NOT NULL DEFAULT 'manuale', -- fonte del quiz: manuale | udine | padova | nuovi
  category      TEXT NOT NULL,        -- categoria estratta dal manuale (es. "Logica numerica")
  topic_area    TEXT,                 -- riservato per il futuro: una delle 5 aree del bando
  text          TEXT NOT NULL,
  explanation   TEXT                  -- spiegazione (non presente nel manuale, da popolare in futuro)
);

CREATE TABLE IF NOT EXISTS options (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id   INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  letter        TEXT NOT NULL,        -- lettera originale nel manuale (A-E), solo riferimento
  text          TEXT NOT NULL,
  is_correct    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exam_sessions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at        TEXT NOT NULL,
  ends_at           TEXT NOT NULL,     -- created_at + duration_seconds, verità lato server
  closed_at         TEXT,
  duration_seconds  INTEGER NOT NULL DEFAULT 3600,
  num_questions     INTEGER NOT NULL DEFAULT 60,
  status            TEXT NOT NULL DEFAULT 'in_progress', -- in_progress | completed
  score             REAL,
  num_correct       INTEGER,
  num_wrong         INTEGER,
  num_blank         INTEGER
);

CREATE TABLE IF NOT EXISTS session_questions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id   INTEGER NOT NULL REFERENCES questions(id),
  position      INTEGER NOT NULL,      -- 1..60, ordine di presentazione nella sessione
  option_order  TEXT NOT NULL,         -- JSON array di option_id nell'ordine mescolato mostrato
  UNIQUE(session_id, position),
  UNIQUE(session_id, question_id)
);

CREATE TABLE IF NOT EXISTS answers (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id          INTEGER NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id         INTEGER NOT NULL REFERENCES questions(id),
  selected_option_id  INTEGER REFERENCES options(id),
  answered_at         TEXT NOT NULL,
  UNIQUE(session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_options_question ON options(question_id);
CREATE INDEX IF NOT EXISTS idx_sessionq_session ON session_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
CREATE INDEX IF NOT EXISTS idx_questions_source ON questions(source);
