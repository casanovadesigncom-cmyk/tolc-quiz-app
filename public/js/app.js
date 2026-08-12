(function () {
  const screens = {
    home: document.getElementById('screen-home'),
    exam: document.getElementById('screen-exam'),
    report: document.getElementById('screen-report'),
  };
  const timerEl = document.getElementById('timer');

  let sessionId = localStorage.getItem('tolc_session_id') || null;
  let sessionData = null; // risposta di GET /api/sessions/:id
  let currentIndex = 0;
  let timerInterval = null;
  let serverClientOffsetMs = 0; // differenza tra now del server e now del client, per un countdown corretto
  let availableSources = []; // [{key, label, count}], caricate da GET /api/sources
  let selectedSources = new Set(); // chiavi selezionate dall'utente; vuoto = "tutte" solo prima del caricamento

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
    timerEl.classList.toggle('hidden', name !== 'exam');
  }

  function fmtTime(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  async function api(path, opts) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Errore ${res.status}`);
    }
    return data;
  }

  // ---------- Home: selezione fonte quiz ----------
  async function loadSources() {
    const listEl = document.getElementById('source-list');
    try {
      const data = await api('/api/sources');
      availableSources = data.sources || [];
      // Di default sono tutte selezionate (comportamento equivalente a "tutte le fonti").
      selectedSources = new Set(availableSources.map((s) => s.key));
      renderSources();
    } catch (e) {
      listEl.innerHTML = '';
      availableSources = [];
    }
  }

  function renderSources() {
    const listEl = document.getElementById('source-list');
    listEl.innerHTML = '';
    availableSources.forEach((s) => {
      const label = document.createElement('label');
      label.className = 'source-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedSources.has(s.key);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedSources.add(s.key);
        else selectedSources.delete(s.key);
      });
      const span = document.createElement('span');
      span.textContent = `${s.label} (${s.count})`;
      label.appendChild(checkbox);
      label.appendChild(span);
      listEl.appendChild(label);
    });
  }

  // ---------- Home ----------
  document.getElementById('btn-start').addEventListener('click', async () => {
    const errEl = document.getElementById('home-error');
    const srcErrEl = document.getElementById('source-error');
    errEl.classList.add('hidden');
    srcErrEl.classList.add('hidden');

    if (availableSources.length && selectedSources.size === 0) {
      srcErrEl.textContent = 'Seleziona almeno una fonte di quiz.';
      srcErrEl.classList.remove('hidden');
      return;
    }

    // Se sono selezionate tutte le fonti disponibili, non serve inviare il filtro.
    const allSelected = availableSources.length > 0 && selectedSources.size === availableSources.length;
    const body = allSelected || !availableSources.length
      ? {}
      : { sources: Array.from(selectedSources) };

    try {
      const data = await api('/api/sessions', { method: 'POST', body: JSON.stringify(body) });
      sessionId = String(data.id);
      localStorage.setItem('tolc_session_id', sessionId);
      await loadSession();
      showScreen('exam');
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    }
  });

  document.getElementById('btn-new-session').addEventListener('click', () => {
    localStorage.removeItem('tolc_session_id');
    sessionId = null;
    sessionData = null;
    showScreen('home');
  });

  // ---------- Esame ----------
  async function loadSession() {
    sessionData = await api(`/api/sessions/${sessionId}`);
    serverClientOffsetMs = new Date(sessionData.server_now).getTime() - Date.now();

    if (sessionData.status === 'completed') {
      await loadReport();
      showScreen('report');
      return;
    }

    renderNav();
    currentIndex = 0;
    renderQuestion();
    startTimer();
  }

  function renderNav() {
    const nav = document.getElementById('question-nav');
    nav.innerHTML = '';
    sessionData.questions.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.className = 'nav-btn' + (q.selected_option_id ? ' answered' : '') + (idx === currentIndex ? ' current' : '');
      btn.textContent = q.position;
      btn.addEventListener('click', () => {
        currentIndex = idx;
        renderQuestion();
      });
      nav.appendChild(btn);
    });
  }

  function updateNavHighlight() {
    const nav = document.getElementById('question-nav');
    [...nav.children].forEach((btn, idx) => {
      btn.classList.toggle('current', idx === currentIndex);
      const q = sessionData.questions[idx];
      btn.classList.toggle('answered', !!q.selected_option_id);
    });
  }

  function renderQuestion() {
    const q = sessionData.questions[currentIndex];
    document.getElementById('question-position').textContent = `Domanda ${q.position} di ${sessionData.num_questions}`;
    document.getElementById('question-category').textContent = q.category;
    document.getElementById('question-text').textContent = q.text;

    const optionsEl = document.getElementById('question-options');
    optionsEl.innerHTML = '';
    q.options.forEach((opt) => {
      const label = document.createElement('label');
      label.className = 'option' + (q.selected_option_id === opt.id ? ' selected' : '');
      label.innerHTML = `
        <input type="radio" name="option" ${q.selected_option_id === opt.id ? 'checked' : ''} />
        <span class="option-text"></span>
      `;
      label.querySelector('.option-text').textContent = opt.text;
      label.addEventListener('click', (e) => {
        e.preventDefault();
        selectOption(q, opt.id);
      });
      optionsEl.appendChild(label);
    });

    document.getElementById('btn-prev').disabled = currentIndex === 0;
    document.getElementById('btn-next').disabled = currentIndex === sessionData.questions.length - 1;
    updateNavHighlight();
  }

  async function selectOption(question, optionId) {
    question.selected_option_id = question.selected_option_id === optionId ? null : optionId;
    renderQuestion();
    try {
      await api(`/api/sessions/${sessionId}/answer`, {
        method: 'PUT',
        body: JSON.stringify({ question_id: question.question_id, selected_option_id: question.selected_option_id }),
      });
    } catch (e) {
      alert('Errore nel salvataggio della risposta: ' + e.message);
    }
  }

  document.getElementById('btn-clear').addEventListener('click', async () => {
    const q = sessionData.questions[currentIndex];
    q.selected_option_id = null;
    renderQuestion();
    try {
      await api(`/api/sessions/${sessionId}/answer`, {
        method: 'PUT',
        body: JSON.stringify({ question_id: q.question_id, selected_option_id: null }),
      });
    } catch (e) {
      alert('Errore: ' + e.message);
    }
  });

  document.getElementById('btn-prev').addEventListener('click', () => {
    if (currentIndex > 0) { currentIndex--; renderQuestion(); }
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    if (currentIndex < sessionData.questions.length - 1) { currentIndex++; renderQuestion(); }
  });

  document.getElementById('btn-finish').addEventListener('click', async () => {
    const answered = sessionData.questions.filter((q) => q.selected_option_id).length;
    const blank = sessionData.questions.length - answered;
    const msg = blank > 0
      ? `Hai lasciato ${blank} domande in bianco. Vuoi davvero terminare la prova?`
      : 'Vuoi davvero terminare la prova?';
    if (!confirm(msg)) return;
    await finishExam();
  });

  async function finishExam() {
    stopTimer();
    try {
      await api(`/api/sessions/${sessionId}/close`, { method: 'POST' });
      await loadReport();
      showScreen('report');
    } catch (e) {
      alert('Errore nella chiusura della prova: ' + e.message);
    }
  }

  function startTimer() {
    stopTimer();
    const endsAtMs = new Date(sessionData.ends_at).getTime();
    tick();
    timerInterval = setInterval(tick, 1000);

    function tick() {
      const nowServerAligned = Date.now() + serverClientOffsetMs;
      const remainingMs = endsAtMs - nowServerAligned;
      const remainingSec = remainingMs / 1000;
      timerEl.textContent = fmtTime(remainingSec);
      timerEl.classList.toggle('low', remainingSec <= 300);
      if (remainingSec <= 0) {
        stopTimer();
        finishExam();
      }
    }
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  // ---------- Report ----------
  async function loadReport() {
    const report = await api(`/api/sessions/${sessionId}/report`);
    document.getElementById('score-big').textContent = `${report.score} / ${report.num_questions}`;
    document.getElementById('report-correct').textContent = report.num_correct;
    document.getElementById('report-wrong').textContent = report.num_wrong;
    document.getElementById('report-blank').textContent = report.num_blank;

    const listEl = document.getElementById('report-list');
    listEl.innerHTML = '';
    report.questions.forEach((q) => {
      const details = document.createElement('details');
      details.className = `report-item outcome-${q.outcome}`;

      const badgeText = q.outcome === 'correct' ? 'Corretta' : q.outcome === 'wrong' ? 'Errata' : 'In bianco';

      const summary = document.createElement('summary');
      summary.innerHTML = `<span class="badge">${badgeText}</span> <span>Domanda ${q.position} &middot; ${q.category}</span>`;
      details.appendChild(summary);

      const body = document.createElement('div');
      body.className = 'report-detail';

      const textP = document.createElement('p');
      textP.textContent = q.text;
      body.appendChild(textP);

      q.options.forEach((opt) => {
        const optDiv = document.createElement('div');
        let cls = 'report-option';
        if (opt.id === q.correct_option_id) cls += ' is-correct';
        else if (opt.id === q.selected_option_id) cls += ' is-selected-wrong';
        optDiv.className = cls;
        let prefix = '';
        if (opt.id === q.correct_option_id) prefix = '✓ ';
        else if (opt.id === q.selected_option_id) prefix = '✗ (tua risposta) ';
        optDiv.textContent = prefix + opt.text;
        body.appendChild(optDiv);
      });

      if (q.explanation) {
        const expl = document.createElement('div');
        expl.className = 'report-explanation';
        expl.textContent = q.explanation;
        body.appendChild(expl);
      }

      details.appendChild(body);
      listEl.appendChild(details);
    });
  }

  // ---------- Avvio ----------
  async function init() {
    await loadSources();
    if (sessionId) {
      try {
        await loadSession();
        if (sessionData.status === 'in_progress') showScreen('exam');
        return;
      } catch (e) {
        localStorage.removeItem('tolc_session_id');
        sessionId = null;
      }
    }
    showScreen('home');
  }

  init();
})();
