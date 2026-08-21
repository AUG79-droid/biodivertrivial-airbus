(() => {
  'use strict';

  const { DOMAINS, QUESTIONS } = window.KNOWLEDGE_CHECK;
  const app = document.getElementById('app');
  const helpDialog = document.getElementById('helpDialog');
  const exitButton = document.getElementById('exitButton');
  const STORAGE_KEY = 'tas-sustainability-knowledge-check-es-v3';
  const SESSION_VERSION = 3;
  const QUESTION_TIME = 20;
  let timerId = null;
  let state = null;

  const MODE_LABELS = {
    sprint: 'Sprint de 10 preguntas',
    full: 'Evaluación completa',
    practice: 'Práctica por área',
  };

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function domainById(id) {
    return DOMAINS.find((domain) => domain.id === id) || DOMAINS[0];
  }

  function questionById(id) {
    return QUESTIONS.find((question) => question.id === id);
  }

  function buildPool(mode, domainId) {
    if (mode === 'practice') {
      return shuffle(QUESTIONS.filter((question) => question.domain === domainId)).map((question) => question.id);
    }

    const domainPools = Object.fromEntries(
      DOMAINS.map((domain) => [domain.id, shuffle(QUESTIONS.filter((question) => question.domain === domain.id))]),
    );

    if (mode === 'sprint') {
      return shuffle(DOMAINS.flatMap((domain) => domainPools[domain.id].slice(0, 2))).map((question) => question.id);
    }

    const fullPool = [];
    for (let block = 0; block < 5; block += 1) {
      const balancedBlock = DOMAINS.flatMap((domain) => domainPools[domain.id].slice(block * 2, block * 2 + 2));
      fullPool.push(...shuffle(balancedBlock));
    }
    return fullPool.map((question) => question.id);
  }

  function createSession(mode, domainId = null) {
    return {
      version: SESSION_VERSION,
      mode,
      domainId,
      poolIds: buildPool(mode, domainId),
      index: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      answers: [],
      remaining: QUESTION_TIME,
      phase: 'question',
      startedAt: new Date().toISOString(),
    };
  }

  function saveSession() {
    if (!state) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function readSession() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || parsed.version !== SESSION_VERSION || !Array.isArray(parsed.poolIds)) return null;
      if (!['sprint', 'full', 'practice'].includes(parsed.mode)) return null;
      if (!['question', 'feedback', 'checkpoint', 'results'].includes(parsed.phase)) return null;
      if (parsed.index < 0 || parsed.index > parsed.poolIds.length) return null;
      if (parsed.poolIds.some((id) => !questionById(id))) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function clearTimer() {
    if (timerId !== null) window.clearInterval(timerId);
    timerId = null;
  }

  function setActiveSession(active) {
    exitButton.classList.toggle('hidden', !active);
  }

  function focusApp() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => app.focus({ preventScroll: true }), 50);
  }

  function startSession(mode, domainId = null) {
    clearTimer();
    state = createSession(mode, domainId);
    saveSession();
    renderQuestion();
  }

  function resumeSession() {
    const saved = readSession();
    if (!saved || saved.phase === 'results') return renderHome();
    state = saved;
    if (state.phase === 'feedback') renderFeedback();
    else if (state.phase === 'checkpoint') renderCheckpoint();
    else renderQuestion();
  }

  function renderHome() {
    clearTimer();
    setActiveSession(false);
    const saved = readSession();
    const resumable = saved && saved.phase !== 'results' && saved.index < saved.poolIds.length;
    const resumeQuestion = resumable ? Math.min(saved.index + 1, saved.poolIds.length) : 0;
    const resumeMarkup = resumable ? `
      <div class="resume-card">
        <div><strong>Continúa tu sesión guardada</strong><small>${MODE_LABELS[saved.mode]} · Pregunta ${resumeQuestion} de ${saved.poolIds.length}</small></div>
        <button type="button" class="secondary-button" data-action="resume">Continuar</button>
      </div>` : '';

    app.innerHTML = `
      <section class="home-grid">
        <article class="hero-panel panel">
          <p class="eyebrow">APRENDIZAJE APLICADO · EVIDENCIA INMEDIATA</p>
          <h1>Evaluación de conocimientos de <span>sostenibilidad</span></h1>
          <p class="lead">Cincuenta preguntas que avanzan desde los conceptos esenciales hasta el criterio operativo. Cada respuesta explica el razonamiento, por lo que la evaluación también funciona como un recorrido de aprendizaje.</p>
          <div class="hero-metrics">
            <div><strong>50</strong><span>preguntas</span></div>
            <div><strong>5</strong><span>áreas de conocimiento</span></div>
            <div><strong>20 s</strong><span>por pregunta</span></div>
            <div><strong>10</strong><span>preguntas por bloque</span></div>
          </div>
          ${resumeMarkup}
        </article>

        <article class="mode-panel panel">
          <p class="eyebrow">ELIGE UN FORMATO</p>
          <h2>Empieza con el nivel de profundidad que necesitas</h2>
          <p>Todos los modos muestran la respuesta correcta, la teoría y una aplicación práctica.</p>
          <div class="mode-list">
            <button type="button" class="mode-card" data-mode="sprint" style="--accent: var(--cyan)">
              <span class="mode-icon">10</span><span><strong>Sprint de conocimientos</strong><small>Dos preguntas equilibradas de cada área de conocimiento.</small></span><span>→</span>
            </button>
            <button type="button" class="mode-card" data-mode="full" style="--accent: var(--mint)">
              <span class="mode-icon">50</span><span><strong>Evaluación completa</strong><small>Cinco bloques equilibrados con puntos de control y progreso guardado.</small></span><span>→</span>
            </button>
          </div>
          <div class="domains">
            <h3>O practica un área de conocimiento</h3>
            <div class="domain-list">
              ${DOMAINS.map((domain) => `<button type="button" class="domain-chip" data-practice="${domain.id}" style="--domain:${domain.color}"><i></i>${domain.short}</button>`).join('')}
            </div>
          </div>
        </article>
      </section>`;
    focusApp();
  }

  function currentQuestion() {
    return state ? questionById(state.poolIds[state.index]) : null;
  }

  function answeredForDomain(domainId) {
    return state.answers.filter((answer) => questionById(answer.questionId).domain === domainId);
  }

  function domainProgressMarkup() {
    return DOMAINS.map((domain) => {
      const poolCount = state.poolIds.filter((id) => questionById(id).domain === domain.id).length;
      const answered = answeredForDomain(domain.id).length;
      const fill = poolCount ? Math.round((answered / poolCount) * 100) : 0;
      return `<div class="block-row" style="--domain:${domain.color};--fill:${fill}%"><span>${domain.short.slice(0, 3)}</span><i></i><strong>${answered}/${poolCount}</strong></div>`;
    }).join('');
  }

  function sidebarMarkup() {
    const answered = state.answers.length;
    const correct = state.answers.filter((answer) => answer.correct).length;
    const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
    const block = state.mode === 'full' ? `Bloque ${Math.floor(state.index / 10) + 1} de 5` : MODE_LABELS[state.mode];
    return `
      <aside class="quiz-sidebar panel">
        <div class="sidebar-title"><strong>${MODE_LABELS[state.mode]}</strong><span>${block}</span></div>
        <div class="score-card"><strong>${state.score}</strong><span>puntos</span></div>
        <div class="mini-metrics"><div><strong>${accuracy}%</strong><span>aciertos</span></div><div><strong>${state.streak}</strong><span>racha</span></div></div>
        <div class="block-map">${domainProgressMarkup()}</div>
        <div class="keyboard-tip">Teclado: pulsa 1–4 para responder. Si tienes dudas, elige «Muéstrame la respuesta»; contará como no respondida, pero podrás consultar la explicación.</div>
      </aside>`;
  }

  function renderQuestion() {
    clearTimer();
    const question = currentQuestion();
    if (!question) return finishAssessment();
    state.phase = 'question';
    if (!Number.isFinite(state.remaining) || state.remaining <= 0 || state.remaining > QUESTION_TIME) state.remaining = QUESTION_TIME;
    saveSession();
    setActiveSession(true);
    const domain = domainById(question.domain);
    const progress = Math.round((state.index / state.poolIds.length) * 100);

    app.innerHTML = `
      <section class="quiz-shell">
        <article class="question-panel panel" style="--domain:${domain.color}">
          <div class="question-top">
            <div><p class="eyebrow">PREGUNTA ${state.index + 1} DE ${state.poolIds.length}</p><h1>${question.question}</h1></div>
            <div class="timer" id="timer" aria-live="polite"><strong id="timerValue">${state.remaining}</strong><span>segundos</span></div>
          </div>
          <div class="progress-track"><i style="width:${progress}%"></i></div>
          <div class="question-context"><span class="tag domain" style="--domain:${domain.color}">${domain.name}</span><span class="tag">${question.difficulty}</span><span class="tag">+ bonificación por rapidez</span></div>
          <div class="answer-grid">
            ${question.options.map((option, index) => `<button type="button" class="answer-button" data-answer="${index}"><span class="answer-key">${index + 1}</span><span>${option}</span></button>`).join('')}
          </div>
          <div class="question-actions"><button type="button" class="ghost-button" data-action="home">Guardar y volver al inicio</button><button type="button" class="ghost-button" data-action="skip">Muéstrame la respuesta</button></div>
        </article>
        ${sidebarMarkup()}
      </section>`;
    focusApp();
    startTimer();
  }

  function startTimer() {
    clearTimer();
    updateTimerDisplay();
    timerId = window.setInterval(() => {
      state.remaining -= 1;
      updateTimerDisplay();
      saveSession();
      if (state.remaining <= 0) submitAnswer(null, 'timeout');
    }, 1000);
  }

  function updateTimerDisplay() {
    const value = document.getElementById('timerValue');
    const timer = document.getElementById('timer');
    if (value) value.textContent = Math.max(0, state.remaining);
    if (timer) timer.classList.toggle('warning', state.remaining <= 5);
  }

  function submitAnswer(selected, reason = 'answered') {
    if (!state || state.phase !== 'question') return;
    clearTimer();
    const question = currentQuestion();
    const correct = selected === question.correct;
    let points = 0;
    if (correct) {
      state.streak += 1;
      const speedBonus = Math.max(0, state.remaining) * 2;
      const streakBonus = Math.min((state.streak - 1) * 20, 80);
      points = 100 + speedBonus + streakBonus;
      state.score += points;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
    } else {
      state.streak = 0;
    }

    state.answers.push({
      questionId: question.id,
      selected,
      correct,
      reason,
      points,
      secondsLeft: Math.max(0, state.remaining),
    });
    state.phase = 'feedback';
    saveSession();
    renderFeedback();
  }

  function renderFeedback() {
    clearTimer();
    setActiveSession(true);
    const question = currentQuestion();
    const answer = state.answers[state.answers.length - 1];
    if (!question || !answer || answer.questionId !== question.id) return renderQuestion();
    const domain = domainById(question.domain);
    const status = answer.correct ? 'Correcto' : answer.reason === 'timeout' ? 'Tiempo agotado' : answer.reason === 'skip' ? 'Respuesta mostrada' : 'No exactamente';
    const statusText = answer.correct
      ? 'Has identificado la respuesta más sólida. Revisa el razonamiento antes de continuar.'
      : 'Utiliza la explicación para comprender el criterio de decisión, no solo para memorizar la opción.';
    const selectedText = answer.selected === null
      ? (answer.reason === 'timeout' ? 'Sin respuesta — tiempo agotado' : 'No se ha seleccionado ninguna respuesta')
      : question.options[answer.selected];
    const nextLabel = state.index + 1 >= state.poolIds.length
      ? 'Ver resultados finales'
      : state.mode === 'full' && (state.index + 1) % 10 === 0
        ? 'Abrir punto de control'
        : 'Siguiente pregunta';

    app.innerHTML = `
      <section class="feedback-grid" style="--domain:${domain.color};--status:${answer.correct ? 'var(--mint)' : answer.reason === 'skip' ? 'var(--amber)' : 'var(--coral)'}">
        <article class="feedback-status panel">
          <div><div class="feedback-symbol">${answer.correct ? '✓' : answer.reason === 'skip' ? '→' : '×'}</div><p class="eyebrow">${domain.name}</p><h1>${status}</h1><p>${statusText}</p></div>
          <div class="feedback-points"><div><strong>+${answer.points}</strong><span>puntos</span></div><div><strong>${answer.secondsLeft}s</strong><span>tiempo restante</span></div><div><strong>${state.bestStreak}</strong><span>mejor racha</span></div></div>
        </article>
        <article class="feedback-theory panel">
          <p class="eyebrow">REVISIÓN DE LA PREGUNTA</p>
          <h2>${question.question}</h2>
          <div class="answer-review">
            <div class="review-row"><span>Tu respuesta</span><strong>${selectedText}</strong></div>
            <div class="review-row correct"><span>Respuesta correcta</span><strong>${question.options[question.correct]}</strong></div>
          </div>
          <div class="theory-note" style="--domain:${domain.color}"><span>Por qué importa</span><p>${question.explanation}</p></div>
          <div class="takeaway"><strong>Aplicación:</strong><span>${question.takeaway}</span></div>
          <button type="button" class="primary-button" data-action="next">${nextLabel}</button>
        </article>
      </section>`;
    focusApp();
  }

  function advance() {
    if (!state || state.phase !== 'feedback') return;
    state.index += 1;
    state.remaining = QUESTION_TIME;
    if (state.index >= state.poolIds.length) return finishAssessment();
    if (state.mode === 'full' && state.index % 10 === 0) {
      state.phase = 'checkpoint';
      saveSession();
      return renderCheckpoint();
    }
    renderQuestion();
  }

  function answerStats(answers) {
    const correct = answers.filter((answer) => answer.correct).length;
    return { total: answers.length, correct, accuracy: answers.length ? Math.round((correct / answers.length) * 100) : 0 };
  }

  function domainStats(answers = state.answers) {
    return DOMAINS.map((domain) => {
      const domainAnswers = answers.filter((answer) => questionById(answer.questionId).domain === domain.id);
      return { ...domain, ...answerStats(domainAnswers) };
    }).filter((domain) => domain.total > 0);
  }

  function domainResultsMarkup(answers = state.answers) {
    return domainStats(answers).map((domain) => `
      <div class="domain-result" style="--domain:${domain.color}"><i></i><strong>${domain.name}<br><small class="muted">${domain.correct} de ${domain.total} correctas</small></strong><span>${domain.accuracy}%</span></div>`).join('');
  }

  function renderCheckpoint() {
    clearTimer();
    setActiveSession(true);
    const completedBlock = Math.max(1, Math.floor(state.index / 10));
    const blockAnswers = state.answers.slice((completedBlock - 1) * 10, completedBlock * 10);
    const stats = answerStats(blockAnswers);
    const nextQuestionNumber = state.index + 1;
    app.innerHTML = `
      <section class="checkpoint-grid">
        <article class="checkpoint-card panel">
          <p class="eyebrow">PUNTO DE CONTROL ${completedBlock} DE 5</p>
          <div class="checkpoint-number">${stats.accuracy}%</div>
          <h1>Bloque completado</h1>
          <p>Has respondido correctamente ${stats.correct} de 10 preguntas. Revisa el resultado por área de conocimiento y continúa cuando quieras. Tu progreso ya está guardado.</p>
          <div class="checkpoint-actions"><button type="button" class="primary-button" data-action="continue-block">Continuar con la pregunta ${nextQuestionNumber}</button><button type="button" class="ghost-button" data-action="home">Continuar más tarde</button></div>
        </article>
        <article class="checkpoint-card panel">
          <p class="eyebrow">EVIDENCIAS DEL BLOQUE</p>
          <h2>Resultados por área de conocimiento</h2>
          <div class="domain-results">${domainResultsMarkup(blockAnswers)}</div>
          <div class="summary-metrics"><div><strong>${state.score}</strong><span>Puntos totales</span></div><div><strong>${state.bestStreak}</strong><span>Mejor racha</span></div><div><strong>${state.answers.filter((answer) => answer.reason === 'timeout').length}</strong><span>Fuera de tiempo</span></div></div>
        </article>
      </section>`;
    focusApp();
  }

  function continueBlock() {
    if (!state || state.phase !== 'checkpoint') return;
    state.phase = 'question';
    state.remaining = QUESTION_TIME;
    saveSession();
    renderQuestion();
  }

  function getLevel(accuracy) {
    if (accuracy >= 85) return 'Liderazgo de decisiones basadas en evidencias';
    if (accuracy >= 70) return 'Profesional de sostenibilidad aplicada';
    if (accuracy >= 50) return 'Analista de sostenibilidad en desarrollo';
    return 'Construyendo fundamentos';
  }

  function getResultMessage(accuracy) {
    if (accuracy >= 85) return 'Conectas de forma consistente los principios ecológicos con la evidencia y las decisiones operativas. Utiliza el desglose por áreas para identificar los pocos contenidos que conviene repasar.';
    if (accuracy >= 70) return 'Tienes una base aplicada sólida. Revisa el área con menor puntuación y repite una práctica específica para reforzar tu seguridad al decidir.';
    if (accuracy >= 50) return 'Reconoces varios principios esenciales, pero necesitas consolidar algunos criterios de decisión. Practica por áreas y lee cada explicación antes de repetir el sprint.';
    return 'Este resultado es un punto de partida, no un fracaso. Trabaja un área de conocimiento cada vez y utiliza las explicaciones para construir los conceptos fundamentales.';
  }

  function finishAssessment() {
    clearTimer();
    state.phase = 'results';
    saveSession();
    renderResults();
  }

  function renderResults() {
    clearTimer();
    setActiveSession(false);
    const stats = answerStats(state.answers);
    const timedOut = state.answers.filter((answer) => answer.reason === 'timeout').length;
    const skipped = state.answers.filter((answer) => answer.reason === 'skip').length;
    app.innerHTML = `
      <section class="results-grid">
        <article class="results-summary panel">
          <p class="eyebrow">EVALUACIÓN COMPLETADA</p>
          <div class="result-score">${stats.accuracy}<small>%</small></div>
          <span class="result-level">${getLevel(stats.accuracy)}</span>
          <h1>Tu perfil de conocimientos</h1>
          <p>${getResultMessage(stats.accuracy)}</p>
          <div class="summary-metrics"><div><strong>${state.score}</strong><span>Puntos</span></div><div><strong>${state.bestStreak}</strong><span>Mejor racha</span></div><div><strong>${timedOut + skipped}</strong><span>Sin responder</span></div></div>
          <div class="result-actions"><button type="button" class="primary-button" data-action="retry">Repetir este modo</button><button type="button" class="ghost-button" data-action="new-mode">Elegir otro modo</button></div>
        </article>
        <article class="results-detail panel">
          <p class="eyebrow">RESULTADOS POR ÁREA</p>
          <h2>Dónde son más sólidas tus decisiones</h2>
          <div class="domain-results">${domainResultsMarkup()}</div>
          <h3>Historial de preguntas</h3>
          <div class="review-list">
            ${state.answers.map((answer, index) => {
              const question = questionById(answer.questionId);
              const domain = domainById(question.domain);
              const statusColor = answer.correct ? 'var(--mint)' : answer.reason === 'skip' ? 'var(--amber)' : 'var(--coral)';
              return `<div class="review-item" style="--status:${statusColor}"><span>${answer.correct ? '✓' : '×'}</span><strong>${index + 1}. ${question.question}</strong><small style="color:${domain.color}">${domain.short}</small></div>`;
            }).join('')}
          </div>
        </article>
      </section>`;
    focusApp();
  }

  function retryMode() {
    if (!state) return renderHome();
    startSession(state.mode, state.domainId);
  }

  function chooseNewMode() {
    localStorage.removeItem(STORAGE_KEY);
    state = null;
    renderHome();
  }

  function exitSession() {
    if (!state) return renderHome();
    if (!window.confirm('¿Quieres eliminar esta sesión y volver a la pantalla inicial?')) return;
    clearTimer();
    localStorage.removeItem(STORAGE_KEY);
    state = null;
    renderHome();
  }

  function goHome() {
    clearTimer();
    if (state && state.phase !== 'results') saveSession();
    renderHome();
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    const answer = target.dataset.answer;
    if (answer !== undefined) return submitAnswer(Number(answer));
    if (target.dataset.mode) return startSession(target.dataset.mode);
    if (target.dataset.practice) return startSession('practice', target.dataset.practice);

    switch (target.dataset.action) {
      case 'home': goHome(); break;
      case 'help': helpDialog.showModal(); break;
      case 'resume': resumeSession(); break;
      case 'exit': exitSession(); break;
      case 'skip': submitAnswer(null, 'skip'); break;
      case 'next': advance(); break;
      case 'continue-block': continueBlock(); break;
      case 'retry': retryMode(); break;
      case 'new-mode': chooseNewMode(); break;
      default: break;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!state || state.phase !== 'question' || event.altKey || event.ctrlKey || event.metaKey) return;
    if (/^[1-4]$/.test(event.key)) {
      event.preventDefault();
      submitAnswer(Number(event.key) - 1);
    }
  });

  window.addEventListener('beforeunload', () => {
    if (state && state.phase !== 'results') saveSession();
  });

  window.__KNOWLEDGE_CHECK_TEST__ = { shuffle, buildPool, answerStats, DOMAINS, QUESTIONS };
  renderHome();
})();
