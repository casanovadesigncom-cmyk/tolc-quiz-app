// Popola il database con le domande estratte dal manuale (data/questions_final.json).
// Idempotente: se le domande sono già presenti (stesso source_number), non duplica.
const path = require('path');
const fs = require('fs');
const { openDb } = require('./init');

function seed() {
  const db = openDb();
  const dataPath = path.join(__dirname, '..', 'data', 'questions_final.json');
  const questions = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const existing = db.prepare('SELECT COUNT(*) AS n FROM questions').get().n;
  if (existing >= questions.length) {
    console.log(`Il database ha già ${existing} domande (>= ${questions.length} nel file dati). Seed saltato.`);
    db.close();
    return;
  }

  const insertQuestion = db.prepare(
    'INSERT INTO questions (source_number, source, category, text, explanation) VALUES (@source_number, @source, @category, @text, @explanation)'
  );
  const insertOption = db.prepare(
    'INSERT INTO options (question_id, letter, text, is_correct) VALUES (@question_id, @letter, @text, @is_correct)'
  );

  function insertAll(items) {
    let count = 0;
    db.exec('BEGIN');
    try {
      for (const q of items) {
        const info = insertQuestion.run({
          source_number: q.source_number ?? null,
          source: q.source || 'manuale',
          category: q.category,
          text: q.text,
          explanation: q.explanation ?? null,
        });
        const questionId = info.lastInsertRowid;
        for (const opt of q.options) {
          insertOption.run({
            question_id: questionId,
            letter: opt.letter,
            text: opt.text,
            is_correct: opt.is_correct ? 1 : 0,
          });
        }
        count++;
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    return count;
  }

  // Ripartiamo da zero per evitare duplicati parziali
  db.exec('DELETE FROM options; DELETE FROM answers; DELETE FROM session_questions; DELETE FROM exam_sessions; DELETE FROM questions;');
  const count = insertAll(questions);
  console.log(`Seed completato: ${count} domande inserite nel database.`);
  db.close();
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
