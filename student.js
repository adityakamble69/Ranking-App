// Student page logic — v6.0 (Exam + Comments)

function showLoader() { document.getElementById('loader').classList.remove('hide'); }
function hideLoader() { document.getElementById('loader').classList.add('hide'); }

window.addEventListener('load', function () { setTimeout(hideLoader, 400); });

async function doLogin() {
  var code = document.getElementById('codeInput').value.trim();
  var err = document.getElementById('loginError');
  var btn = document.getElementById('loginBtn');
  err.textContent = '';
  if (!code) { err.textContent = 'Please enter your code.'; return; }
  Sound.click(); showLoader();
  var res = await withLoading(btn, 'Connecting…', function () {
    return callApi('verifyStudent', { code: code });
  });
  hideLoader();
  if (!res.success) { err.textContent = res.message || 'Something went wrong.'; Sound.error(); return; }
  sessionStorage.setItem('studentCode', code);
  renderDashboard(res);
}

function doLogout() {
  Sound.click();
  sessionStorage.removeItem('studentCode');
  document.getElementById('dashView').classList.add('hidden');
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('codeInput').value = '';
  document.getElementById('loginError').textContent = '';
}

function renderDashboard(res) {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('dashView').classList.remove('hidden');

  var ann = res.announcement || {};
  var ab = document.getElementById('announceBar');
  if (ab) {
    if (ann.active && ann.text) {
      ab.classList.remove('hidden');
      document.getElementById('announceText').textContent = ann.text;
    } else {
      ab.classList.add('hidden');
    }
  }

  document.getElementById('studentName').textContent = res.name;
  document.getElementById('studentCode').textContent = res.code;
  var letter = (res.name || '?').charAt(0).toUpperCase();
  document.getElementById('avatarLetter').textContent = letter;

  var myRank = (res.leaderboard.find(function (s) { return String(s.code) === String(res.code); }) || {}).rank || 999;
  var av = document.getElementById('avatarLetter');
  av.classList.remove('rank-1', 'rank-2', 'rank-3');
  if (myRank === 1) av.classList.add('rank-1');
  else if (myRank === 2) av.classList.add('rank-2');
  else if (myRank === 3) av.classList.add('rank-3');

  animateNumber(document.getElementById('totalPoints'), res.totalPoints, 1400);
  renderXpBar(res, myRank);

  // Tasks
  var taskList = document.getElementById('taskList');
  taskList.innerHTML = '';
  if (!res.breakdown.length) {
    taskList.innerHTML = '<div class="empty">No tasks assigned to you yet.</div>';
  } else {
    res.breakdown.forEach(function (t) {
      var row = document.createElement('div');
      row.className = 'task-row' + (t.done ? ' done' : '');
      var check = t.done ? '<svg class="check" viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : '';
      var dueBit = '';
      if (t.dueDate) {
        dueBit = '<span class="due-badge ' + (t.overdue ? 'overdue' : 'soon') + '">' +
          (t.overdue ? '⚠ Overdue: ' : '📅 Due: ') + escapeHtml(t.dueDate) + '</span>';
      }
      row.innerHTML =
        '<div style="min-width:0;flex:1;">' +
        '<div class="t-name">' + check + escapeHtml(t.taskName) + dueBit + '</div>' +
        '<div style="margin-top:6px;">' +
        '<button class="comment-btn" onclick="openCommentModal(\'task\',\'' + escAttr(t.taskId) + '\',\'' + escAttr(t.taskName) + '\')">💬 Ask</button>' +
        '</div>' +
        (t.videoLink ? '<a class="t-link" href="' + escapeHtml(t.videoLink) + '" target="_blank" rel="noopener">▶ Watch</a>' : '') +
        '</div>' +
        '<div class="t-pts">' + t.points + ' / ' + t.maxPoints + '</div>';
      taskList.appendChild(row);
    });
  }

  // Exams
  renderStudentExams(res.exams || []);

  renderPodium(res.leaderboard);
  renderLeaderboard(res.leaderboard, res.code);
  detectRankUp(res.code, myRank);

  window._myStudentCode = res.code;

  // Mark comments as seen
  callApi('markCommentsSeen', { code: res.code });
}

/* ==================== EXAM SECTION ==================== */
function renderStudentExams(exams) {
  var box = document.getElementById('examListStudent');
  if (!box) return;
  box.innerHTML = '';
  var visible = exams.filter(function (e) { return e.status !== 'DRAFT'; });
  if (!visible.length) {
    box.innerHTML = '<div class="empty"><span style="font-size:32px;display:block;margin-bottom:8px;opacity:.6;">📝</span>No exams assigned to you yet.</div>';
    return;
  }
  visible.forEach(function (e) {
    var card = document.createElement('div');
    card.className = 'exam-section-card';
    var statusTag = '';
    var actionRow = '';
    if (e.status === 'ACTIVE') {
      if (e.attempted && e.attemptStatus === 'IN_PROGRESS') {
        statusTag = '<span class="exam-status-tag active">In Progress</span>';
        actionRow = '<div class="exam-action-row"><button class="btn-exam-resume" onclick="requestStartExam(\'' + escAttr(e.examId) + '\')">▶ Resume</button></div>';
      } else if (e.attempted && (e.attemptStatus === 'SUBMITTED' || e.attemptStatus === 'AUTO_SUBMITTED')) {
        statusTag = '<span class="exam-status-tag done">Submitted</span>';
        actionRow = '<div class="exam-action-row"><button class="btn-exam-view" onclick="viewExamResult(\'' + escAttr(e.examId) + '\')">📊 View Result</button></div>';
      } else {
        statusTag = '<span class="exam-status-tag active">● Active Now</span>';
        actionRow = '<div class="exam-action-row"><button class="btn-exam-start" onclick="requestStartExam(\'' + escAttr(e.examId) + '\')">▶ Start Exam</button></div>';
      }
    } else if (e.status === 'CLOSED') {
      if (e.attempted) {
        statusTag = '<span class="exam-status-tag done">Attempted</span>';
        actionRow = '<div class="exam-action-row"><button class="btn-exam-view" onclick="viewExamResult(\'' + escAttr(e.examId) + '\')">📊 View Result</button></div>';
      } else {
        statusTag = '<span class="exam-status-tag missed">Missed</span>';
        card.classList.add('locked');
      }
    }
    var metaBits = [];
    if (e.examDate) metaBits.push('📅 ' + escapeHtml(e.examDate));
    if (e.duration) metaBits.push('⏱ <b>' + e.duration + '</b> min');
    metaBits.push('🎯 <b>' + e.maxMarks + '</b> marks');
    metaBits.push('⚖ <b>' + e.weight + '×</b>');
    metaBits.push('📋 <b>' + e.questionCount + '</b> Q');
    if (e.negativeMark > 0) metaBits.push('⚠ −' + e.negativeMark);
    var scoreBit = '';
    if (e.attempted && (e.attemptStatus === 'SUBMITTED' || e.attemptStatus === 'AUTO_SUBMITTED')) {
      scoreBit = '<div style="font-family:Orbitron,sans-serif;font-size:11px;color:var(--gold);margin-top:6px;letter-spacing:1px;">🏆 ' + e.score + ' / ' + e.totalMarks + ' (' + e.percentage + '%)</div>';
    }
    card.innerHTML =
      '<div class="exam-section-head">' +
      '<div class="exam-section-name">' + escapeHtml(e.examName) + '</div>' +
      statusTag +
      '</div>' +
      '<div class="exam-section-meta">' + metaBits.join('') + '</div>' +
      (e.description ? '<div style="font-size:11.5px;color:var(--muted);font-style:italic;margin-top:8px;">' + escapeHtml(e.description) + '</div>' : '') +
      scoreBit +
      actionRow +
      '<div style="margin-top:8px;"><button class="comment-btn" onclick="openCommentModal(\'exam\',\'' + escAttr(e.examId) + '\',\'' + escAttr(e.examName) + '\')">💬 Ask</button></div>';
    box.appendChild(card);
  });
}

var _pendingExamId = null;
function requestStartExam(examId) {
  Sound.click();
  _pendingExamId = examId;
  document.getElementById('examWarnTitle').textContent = 'Start Exam?';
  document.getElementById('examWarnSub').textContent = 'Loading exam details…';
  document.getElementById('examWarnModal').classList.add('show');
  callApi('startExam', { code: window._myStudentCode, examId: examId }).then(function (res) {
    if (!res.success) { closeExamWarn(); Toast.error(res.message || 'Could not start exam.'); return; }
    window._pendingExamData = res;
    document.getElementById('examWarnTitle').textContent = res.resumed ? 'Resume Exam?' : 'Start Exam?';
    var ex = res.exam || {};
    document.getElementById('examWarnSub').innerHTML =
      '<b style="color:var(--neon);">' + escapeHtml(ex.examName || '') + '</b><br>' +
      '⏱ ' + (ex.duration || '—') + ' min · 🎯 ' + (ex.maxMarks || '—') + ' marks · 📋 ' + (ex.totalQuestions || '—') + ' questions' +
      (ex.negativeMark > 0 ? '<br>⚠ Negative marking: −' + ex.negativeMark + ' per wrong answer' : '');
  });
}
function closeExamWarn() {
  Sound.click();
  document.getElementById('examWarnModal').classList.remove('show');
  _pendingExamId = null; window._pendingExamData = null;
}
function confirmStartExam() {
  if (!window._pendingExamData) return;
  Sound.click();
  document.getElementById('examWarnModal').classList.remove('show');
  var data = window._pendingExamData;
  window._pendingExamData = null; _pendingExamId = null;
  beginExamSession(data);
}

var EXAM = {
  attemptId: null, exam: null, questions: [], answers: {}, currentIndex: 0,
  timerInterval: null, timeRemaining: 0, startedAt: 0, submitted: false,
  cheatWarnings: 0, visibilityHandler: null, beforeUnloadHandler: null
};

function beginExamSession(data) {
  EXAM.attemptId = data.attemptId;
  EXAM.exam = data.exam || {};
  EXAM.questions = data.questions || [];
  EXAM.answers = data.savedAnswers || {};
  EXAM.currentIndex = 0;
  EXAM.timeRemaining = Number(data.timeRemaining) || (Number(EXAM.exam.duration) * 60);
  EXAM.startedAt = Date.now(); EXAM.submitted = false; EXAM.cheatWarnings = 0;
  if (!EXAM.questions.length) { Toast.error('No questions in this exam.'); return; }
  document.getElementById('examOverlayName').textContent = EXAM.exam.examName || 'Exam';
  document.getElementById('examQTotal').textContent = EXAM.questions.length;
  try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () { }); } catch (e) { }
  document.getElementById('examOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  renderExamQuestion(); renderExamPalette(); startExamTimer();

  EXAM.visibilityHandler = function () {
    if (document.hidden && !EXAM.submitted) {
      EXAM.cheatWarnings++;
      var warn = document.getElementById('examCheatWarn');
      warn.textContent = '⚠️ Warning ' + EXAM.cheatWarnings + ': Tab switch detected! Stay on this page.';
      warn.classList.add('show'); Sound.error();
      setTimeout(function () { warn.classList.remove('show'); }, 3500);
    }
  };
  document.addEventListener('visibilitychange', EXAM.visibilityHandler);

  EXAM.beforeUnloadHandler = function (e) {
    if (!EXAM.submitted) { e.preventDefault(); e.returnValue = ''; return ''; }
  };
  window.addEventListener('beforeunload', EXAM.beforeUnloadHandler);
  Sound.success(); Toast.success('✓ Exam started — Good luck!');
}

function renderExamQuestion() {
  var q = EXAM.questions[EXAM.currentIndex];
  if (!q) return;
  document.getElementById('examQCurrent').textContent = EXAM.currentIndex + 1;
  var box = document.getElementById('examQBox');
  var selected = EXAM.answers[q.questionId] || '';
  var optHtml = '';
  ['A', 'B', 'C', 'D'].forEach(function (letter) {
    var optText = q['option' + letter] || '';
    var sel = selected === letter ? ' selected' : '';
    optHtml += '<div class="exam-opt' + sel + '" onclick="selectExamOption(\'' + letter + '\')">' +
      '<div class="exam-opt-letter">' + letter + '</div>' +
      '<div class="exam-opt-text">' + escapeHtml(optText) + '</div></div>';
  });
  box.innerHTML =
    '<div class="exam-q-number">QUESTION ' + (EXAM.currentIndex + 1) + '</div>' +
    '<div class="exam-q-text">' + escapeHtml(q.qText) + '</div>' +
    '<div class="exam-q-marks">' + (q.marks || 1) + ' mark' + (q.marks === 1 ? '' : 's') + '</div>' +
    '<div class="exam-options">' + optHtml + '</div>';
  document.getElementById('examPrevBtn').disabled = EXAM.currentIndex === 0;
  document.getElementById('examNextBtn').disabled = EXAM.currentIndex === EXAM.questions.length - 1;
  box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
}

function selectExamOption(letter) {
  var q = EXAM.questions[EXAM.currentIndex];
  if (!q) return;
  Sound.click();
  if (EXAM.answers[q.questionId] === letter) delete EXAM.answers[q.questionId];
  else EXAM.answers[q.questionId] = letter;
  callApi('saveAnswer', { code: window._myStudentCode, attemptId: EXAM.attemptId, questionId: q.questionId, selected: EXAM.answers[q.questionId] || '' });
  renderExamQuestion(); renderExamPalette();
}
function examNavPrev() { if (EXAM.currentIndex > 0) { Sound.click(); EXAM.currentIndex--; renderExamQuestion(); renderExamPalette(); } }
function examNavNext() { if (EXAM.currentIndex < EXAM.questions.length - 1) { Sound.click(); EXAM.currentIndex++; renderExamQuestion(); renderExamPalette(); } }
function jumpToQuestion(idx) { if (idx < 0 || idx >= EXAM.questions.length) return; Sound.click(); EXAM.currentIndex = idx; renderExamQuestion(); renderExamPalette(); }

function renderExamPalette() {
  var grid = document.getElementById('examPalette');
  if (!grid) return;
  var html = '';
  EXAM.questions.forEach(function (q, i) {
    var answered = !!EXAM.answers[q.questionId];
    var current = i === EXAM.currentIndex;
    var cls = 'palette-btn' + (answered ? ' answered' : '') + (current ? ' current' : '');
    html += '<button class="' + cls + '" onclick="jumpToQuestion(' + i + ')">' + (i + 1) + '</button>';
  });
  grid.innerHTML = html;
}

function startExamTimer() {
  updateExamTimerDisplay();
  EXAM.timerInterval = setInterval(function () {
    if (EXAM.submitted) return;
    EXAM.timeRemaining--;
    if (EXAM.timeRemaining <= 0) { EXAM.timeRemaining = 0; updateExamTimerDisplay(); clearInterval(EXAM.timerInterval); autoSubmitExam(); return; }
    updateExamTimerDisplay();
  }, 1000);
}
function updateExamTimerDisplay() {
  var t = EXAM.timeRemaining;
  var m = Math.floor(t / 60), s = t % 60;
  document.getElementById('examTimerText').textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  var wrap = document.getElementById('examTimer');
  wrap.classList.remove('warning', 'danger');
  if (t <= 30) wrap.classList.add('danger');
  else if (t <= 120) wrap.classList.add('warning');
}

async function confirmSubmitExam() {
  var unanswered = EXAM.questions.filter(function (q) { return !EXAM.answers[q.questionId]; }).length;
  var answered = EXAM.questions.length - unanswered;
  var msg = 'You have answered ' + answered + ' of ' + EXAM.questions.length + ' questions.';
  if (unanswered > 0) msg += '\n\n⚠ You have ' + unanswered + ' unanswered question' + (unanswered === 1 ? '' : 's') + '.';
  msg += '\n\nSubmit exam now? You cannot change answers after.';
  if (!confirm(msg)) return;
  await doSubmitExam(false);
}
async function autoSubmitExam() { Toast.error('⏱ Time is up! Auto-submitting…'); await doSubmitExam(true); }

async function doSubmitExam(auto) {
  if (EXAM.submitted) return;
  EXAM.submitted = true;
  clearInterval(EXAM.timerInterval);
  document.removeEventListener('visibilitychange', EXAM.visibilityHandler);
  window.removeEventListener('beforeunload', EXAM.beforeUnloadHandler);
  showLoader();
  var res = await callApi('submitExam', { code: window._myStudentCode, attemptId: EXAM.attemptId });
  hideLoader();
  try { if (document.fullscreenElement) document.exitFullscreen().catch(function () { }); } catch (e) { }
  document.getElementById('examOverlay').classList.remove('show');
  document.body.style.overflow = '';
  if (!res.success) { Toast.error(res.message || 'Could not submit.'); return; }
  showExamResultModal(res, auto);
  refreshStudentDashboard();
}

function showExamResultModal(res, auto) {
  var pct = res.percentage || 0;
  var icon = pct >= 90 ? '🏆' : pct >= 75 ? '🎉' : pct >= 50 ? '👍' : '📚';
  var title = pct >= 90 ? 'Excellent!' : pct >= 75 ? 'Great Job!' : pct >= 50 ? 'Good Effort!' : 'Keep Practicing!';
  if (auto) title = 'Time Up — ' + title;
  document.getElementById('erIcon').textContent = icon;
  document.getElementById('erTitle').textContent = title;
  document.getElementById('erScore').textContent = res.score + ' / ' + res.total;
  document.getElementById('erPct').textContent = pct + '%' + (EXAM.exam && EXAM.exam.weight ? ' · Weighted: ' + Math.round(pct / 100 * (EXAM.exam.maxMarks || 0) * (EXAM.exam.weight || 1) * 100) / 100 : '');
  document.getElementById('erCorrect').textContent = res.correct || 0;
  document.getElementById('erWrong').textContent = res.wrong || 0;
  document.getElementById('erSkipped').textContent = res.unanswered || 0;
  document.getElementById('erReviewWrap').classList.add('hidden');
  document.getElementById('erReviewList').innerHTML = '';
  document.getElementById('examResultModal').classList.add('show');
  if (pct >= 75) Confetti.fire(2800);
  if (pct >= 90) Sound.rankUp(); else Sound.success();
}
function closeExamResult() { Sound.click(); document.getElementById('examResultModal').classList.remove('show'); }

async function viewExamResult(examId) {
  Sound.click(); showLoader();
  var res = await callApi('getExamResult', { code: window._myStudentCode, examId: examId });
  hideLoader();
  if (!res.success) { Toast.error(res.message || 'Could not load result.'); return; }
  var pct = res.percentage || 0;
  var icon = pct >= 90 ? '🏆' : pct >= 75 ? '🎉' : pct >= 50 ? '👍' : '📚';
  var title = pct >= 90 ? 'Excellent!' : pct >= 75 ? 'Great Job!' : pct >= 50 ? 'Good Effort!' : 'Keep Practicing!';
  if (res.status === 'AUTO_SUBMITTED') title += ' (Auto-submitted)';
  document.getElementById('erIcon').textContent = icon;
  document.getElementById('erTitle').textContent = title;
  document.getElementById('erScore').textContent = res.score + ' / ' + res.total;
  document.getElementById('erPct').textContent = pct + '%';
  document.getElementById('erCorrect').textContent = res.review ? res.review.filter(function (r) { return r.isCorrect; }).length : '—';
  document.getElementById('erWrong').textContent = res.review ? res.review.filter(function (r) { return r.selected && !r.isCorrect; }).length : '—';
  document.getElementById('erSkipped').textContent = res.review ? res.review.filter(function (r) { return !r.selected; }).length : '—';
  var reviewWrap = document.getElementById('erReviewWrap');
  var reviewList = document.getElementById('erReviewList');
  if (res.review && res.review.length) {
    reviewWrap.classList.remove('hidden');
    reviewList.innerHTML = res.review.map(function (r) {
      var cls = r.isCorrect ? 'correct' : (r.selected ? 'wrong' : 'unanswered');
      var optsHtml = ['A', 'B', 'C', 'D'].map(function (L) {
        var isMine = r.selected === L, isRight = r.correct === L;
        var cls2 = 'exam-review-opt';
        if (isRight) cls2 += ' right';
        if (isMine && !isRight) cls2 += ' mine';
        return '<div class="' + cls2 + '">' + L + ') ' + escapeHtml(r['option' + L] || '') + (isMine && !isRight ? ' ← your answer' : '') + '</div>';
      }).join('');
      return '<div class="exam-review-item ' + cls + '">' +
        '<div class="exam-review-q">' + escapeHtml(r.qText) + '</div>' + optsHtml +
        (r.explanation ? '<div class="exam-review-expl">💡 ' + escapeHtml(r.explanation) + '</div>' : '') +
        '</div>';
    }).join('');
  } else reviewWrap.classList.add('hidden');
  document.getElementById('examResultModal').classList.add('show');
}

async function refreshStudentDashboard() {
  var code = window._myStudentCode;
  if (!code) return;
  var res = await callApi('verifyStudent', { code: code });
  if (res.success) {
    renderStudentExams(res.exams || []);
    document.getElementById('totalPoints').textContent = res.totalPoints;
    var myRank = (res.leaderboard.find(function (s) { return String(s.code) === String(code); }) || {}).rank || 999;
    var av = document.getElementById('avatarLetter');
    av.classList.remove('rank-1', 'rank-2', 'rank-3');
    if (myRank === 1) av.classList.add('rank-1');
    else if (myRank === 2) av.classList.add('rank-2');
    else if (myRank === 3) av.classList.add('rank-3');
  }
}

/* ==================== COMMENTS (student) ==================== */
var _commentTarget = { type: null, id: null, name: null };

function openCommentModal(type, targetId, targetName) {
  Sound.click();
  _commentTarget = { type: type, id: targetId, name: targetName };
  document.getElementById('commentModalTitle').textContent = 'Ask about ' + (type === 'task' ? 'Task' : 'Exam');
  document.getElementById('commentModalSub').textContent = targetName;
  document.getElementById('commentInput').value = '';
  document.getElementById('commentThread').classList.add('hidden');
  document.getElementById('commentThread').innerHTML = '';
  document.getElementById('commentModal').classList.add('show');

  // Load existing thread
  callApi('getStudentComments', { code: window._myStudentCode, type: type, targetId: targetId }).then(function (res) {
    if (!res.success || !res.comments || !res.comments.length) return;
    var thread = document.getElementById('commentThread');
    thread.classList.remove('hidden');
    thread.innerHTML = res.comments.map(function (c) {
      var createdStr = '';
      try { createdStr = new Date(c.createdAt).toLocaleString(); } catch (e) { }
      var html = '<div class="thread-msg student"><div class="who">You · ' + escapeHtml(createdStr) + '</div>' + escapeHtml(c.message) + '</div>';
      if (c.reply) {
        var repliedStr = '';
        try { repliedStr = new Date(c.repliedAt).toLocaleString(); } catch (e) { }
        html += '<div class="thread-msg teacher"><div class="who">👨‍🏫 Teacher · ' + escapeHtml(repliedStr) + '</div>' + escapeHtml(c.reply) + '</div>';
      } else {
        html += '<div class="thread-msg teacher" style="opacity:.7;"><div class="who">⏳ Teacher</div><em>Waiting for reply…</em></div>';
      }
      return html;
    }).join('');
    thread.scrollTop = thread.scrollHeight;
  });
}

function closeCommentModal() {
  Sound.click();
  document.getElementById('commentModal').classList.remove('show');
  _commentTarget = { type: null, id: null, name: null };
}

async function submitComment() {
  var msg = document.getElementById('commentInput').value.trim();
  if (!msg) { Toast.error('Type your question first'); return; }
  if (!_commentTarget.type || !_commentTarget.id) { Toast.error('Invalid target'); return; }
  Sound.click(); showLoader();
  var res = await callApi('addComment', {
    code: window._myStudentCode, type: _commentTarget.type,
    targetId: _commentTarget.id, message: msg
  });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  Toast.success('✓ Question sent! Wait for teacher reply.');
  document.getElementById('commentInput').value = '';
  openCommentModal(_commentTarget.type, _commentTarget.id, _commentTarget.name);
}

/* ==================== HELPERS ==================== */
function renderXpBar(res, myRank) {
  var wrap = document.getElementById('xpWrap');
  var fill = document.getElementById('xpFill');
  var target = document.getElementById('xpTarget');
  var caption = document.getElementById('xpCaption');
  if (myRank === 1 || res.leaderboard.length < 2) {
    target.textContent = '👑 #1'; fill.style.width = '100%';
    caption.innerHTML = 'You are <b>#1</b> — keep it up!'; return;
  }
  var above = res.leaderboard.find(function (s) { return s.rank === myRank - 1; });
  if (!above) { wrap.classList.add('hidden'); return; }
  var gap = above.totalPoints - res.totalPoints;
  var pct = Math.min(100, Math.max(0, (res.totalPoints / Math.max(above.totalPoints, 1)) * 100));
  target.textContent = '#' + (myRank - 1) + ' · ' + above.totalPoints + ' pts';
  fill.style.width = '0%';
  requestAnimationFrame(function () { fill.style.width = pct + '%'; });
  caption.innerHTML = 'Need <b>' + gap + '</b> more points to reach rank <b>#' + (myRank - 1) + '</b>';
}

function renderPodium(list) {
  var box = document.getElementById('podiumWrap');
  box.innerHTML = '';
  if (!list || list.length < 1) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  var order = [2, 1, 3];
  order.forEach(function (rank, i) {
    var s = list.find(function (x) { return x.rank === rank; });
    if (!s) return;
    var pod = document.createElement('div');
    pod.className = 'pod p' + rank;
    pod.style.animationDelay = (i * 100) + 'ms';
    pod.innerHTML = (rank === 1 ? '<div class="crown">👑</div>' : '') +
      rankBadgeImg(s.rank) +
      '<div class="pod-name">' + escapeHtml(s.name) + '</div>' +
      '<div class="pod-pts">' + s.totalPoints + ' PTS</div>';
    box.appendChild(pod);
  });
}

function renderLeaderboard(list, myCode) {
  var box = document.getElementById('leaderboardList');
  box.innerHTML = '';
  if (!list || !list.length) { box.innerHTML = '<div class="empty">No ranking data yet.</div>'; return; }
  var rest = list.filter(function (s) { return s.rank > 3; });
  var prevRanks = JSON.parse(localStorage.getItem('prevRanks') || '{}');
  if (rest.length === 0) box.innerHTML = '<div class="empty">Only the top 3 are on the podium.</div>';
  rest.forEach(function (s) {
    var isMe = String(s.code) === String(myCode);
    var row = document.createElement('div');
    row.className = 'lb-row' + (isMe ? ' me' : '');
    var deltaHtml = '';
    var prev = prevRanks[String(s.code)];
    if (prev && prev !== s.rank) {
      var diff = prev - s.rank;
      if (diff > 0) deltaHtml = '<span class="rank-delta up">↑' + diff + '</span>';
      else deltaHtml = '<span class="rank-delta down">↓' + Math.abs(diff) + '</span>';
    }
    row.innerHTML = rankBadgeImg(s.rank) +
      '<div class="lb-name">' + escapeHtml(s.name) + deltaHtml + '</div>' +
      '<div class="lb-pts">' + s.totalPoints + ' PTS</div>';
    box.appendChild(row);
  });
  var currentRanks = {};
  list.forEach(function (s) { currentRanks[String(s.code)] = s.rank; });
  localStorage.setItem('prevRanks', JSON.stringify(currentRanks));
}

function detectRankUp(code, newRank) {
  var key = 'lastRank_' + code;
  var prev = Number(localStorage.getItem(key) || 0);
  localStorage.setItem(key, String(newRank));
  if (prev > 0 && newRank < prev) {
    setTimeout(function () { Toast.rankUp('🎉 <b>Rank up!</b> You moved from #' + prev + ' → #' + newRank); }, 700);
  }
}

function rankBadgeImg(rank) {
  if (rank >= 1 && rank <= 4) {
    return '<div class="rank-badge img">' +
      '<img src="rank-' + rank + '.png" alt="Rank ' + rank + '" loading="lazy" ' +
      'onerror="this.parentNode.classList.remove(\'img\');this.parentNode.textContent=\'' + rank + '\';">' +
      '</div>';
  }
  return '<div class="rank-badge">' + rank + '</div>';
}

function escapeHtml(str) {
  var d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}
function escAttr(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

window.addEventListener('load', async function () {
  var saved = sessionStorage.getItem('studentCode');
  if (saved) {
    showLoader();
    var res = await callApi('verifyStudent', { code: saved });
    hideLoader();
    if (res.success) renderDashboard(res);
    else sessionStorage.removeItem('studentCode');
  }
  document.getElementById('codeInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLogin();
  });

  var warnModal = document.getElementById('examWarnModal');
  if (warnModal) warnModal.addEventListener('click', function (e) { if (e.target === this) closeExamWarn(); });
  var commentModal = document.getElementById('commentModal');
  if (commentModal) commentModal.addEventListener('click', function (e) { if (e.target === this) closeCommentModal(); });
});