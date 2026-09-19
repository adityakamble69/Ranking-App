// Admin page logic — v6.0 (Exam System + Email + Comments)

var ADMIN_PW = '';
var CACHE = {
  students: [], tasks: [], exams: [], lastLeaderboard: [], examLeaderboard: [],
  announcement: { active: false, text: '' }, selectedStudents: {},
  editingExamId: null, editingQuestionId: null, currentExamId: null, currentExamResults: null,
  comments: [], commentFilter: 'pending', adminEmail: '', pendingComments: 0
};

const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

function showLoader() { document.getElementById('loader').classList.remove('hide'); }
function hideLoader() { document.getElementById('loader').classList.add('hide'); }

function touchSession() { sessionStorage.setItem('adminLastActivity', String(Date.now())); }
function checkSession() {
  var last = Number(sessionStorage.getItem('adminLastActivity') || 0);
  if (last && Date.now() - last > SESSION_TIMEOUT_MS) {
    doLogout(); Toast.error('⏱ Session expired.');
    return false;
  }
  return true;
}
setInterval(checkSession, 5 * 60 * 1000);
window.addEventListener('load', function () { setTimeout(hideLoader, 400); });

/* ========== LOGIN ========== */
async function doLogin() {
  var pw = document.getElementById('pwInput').value;
  var err = document.getElementById('loginError');
  var btn = document.getElementById('loginBtn');
  err.textContent = '';
  if (!pw) { err.textContent = 'Enter password.'; return; }
  Sound.click(); showLoader();
  var res = await withLoading(btn, 'Authenticating…', function () {
    return callApi('adminLogin', { password: pw });
  });
  hideLoader();
  if (!res.success) { err.textContent = 'Incorrect password.'; Sound.error(); return; }
  ADMIN_PW = pw;
  sessionStorage.setItem('adminPw', pw);
  touchSession(); Sound.success();
  loadDashboard();
}

function doLogout() {
  Sound.click();
  sessionStorage.removeItem('adminPw');
  sessionStorage.removeItem('adminLastActivity');
  ADMIN_PW = '';
  document.getElementById('dashView').classList.add('hidden');
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('pwInput').value = '';
  document.getElementById('loginError').textContent = '';
}

async function loadDashboard() {
  var res = await callApi('getAdminDashboard', { password: ADMIN_PW });
  if (!res.success) {
    document.getElementById('loginError').textContent = 'Session expired.';
    document.getElementById('dashView').classList.add('hidden');
    document.getElementById('loginView').classList.remove('hidden');
    return;
  }
  touchSession();
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('dashView').classList.remove('hidden');
  CACHE.students = res.students || [];
  CACHE.tasks = res.tasks || [];
  CACHE.lastLeaderboard = res.leaderboard || [];
  CACHE.announcement = res.announcement || { active: false, text: '' };
  CACHE.exams = res.exams || [];
  CACHE.examLeaderboard = res.examLeaderboard || [];
  CACHE.adminEmail = res.adminEmail || '';
  CACHE.pendingComments = res.pendingComments || 0;

  renderStats();
  renderLeaderboard(CACHE.lastLeaderboard);
  renderStudents(CACHE.students);
  renderTasks(CACHE.tasks);
  renderExams();
  renderStudentPicker();
  fillDropdowns();
  renderAnnouncementBar();
  updateCommentsBadge();
}

function switchTab(name) {
  Sound.click();
  document.querySelectorAll('.tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  ['rank', 'points', 'students', 'tasks', 'exams', 'analytics', 'log', 'comments'].forEach(function (t) {
    var el = document.getElementById('tab-' + t);
    if (el) el.classList.toggle('hidden', t !== name);
  });
  if (name === 'analytics') loadAnalytics();
  if (name === 'log') loadActivityLog();
  if (name === 'comments') loadComments();
}

/* ========== STATS ========== */
function renderStats() {
  var students = CACHE.students || [];
  var tasks = CACHE.tasks || [];
  var totalPoints = students.reduce(function (s, x) { return s + (Number(x.TotalPoints) || 0); }, 0);
  var avg = students.length ? Math.round(totalPoints / students.length) : 0;
  var top = students.reduce(function (best, s) {
    return (!best || (Number(s.TotalPoints) || 0) > (Number(best.TotalPoints) || 0)) ? s : best;
  }, null);

  animateNumber(document.getElementById('statStudents'), students.length);
  animateNumber(document.getElementById('statTasks'), tasks.length);
  animateNumber(document.getElementById('statAvg'), avg);
  document.getElementById('statTopPts').textContent = top ? (top.TotalPoints || 0) : '—';
  document.getElementById('statTopName').textContent = top ? top.Name : 'No data';
  document.getElementById('statStudentsSub').textContent = students.length + ' enrolled';
  document.getElementById('statTasksSub').textContent = tasks.length + ' created';
}

/* ========== ANNOUNCEMENT ========== */
function renderAnnouncementBar() {
  var bar = document.getElementById('announceBar');
  var txt = document.getElementById('announceText');
  if (!bar) return;
  var a = CACHE.announcement || {};
  if (a.active && a.text) {
    bar.classList.remove('hidden-announce');
    txt.textContent = a.text;
    txt.classList.remove('empty');
  } else {
    bar.classList.remove('hidden-announce');
    txt.textContent = 'No active announcement';
    txt.classList.add('empty');
  }
}
function openAnnounceModal() {
  Sound.click();
  document.getElementById('announceInput').value = CACHE.announcement.text || '';
  document.getElementById('announceActive').checked = !!CACHE.announcement.active;
  document.getElementById('announceModal').classList.add('show');
}
function closeAnnounceModal() {
  Sound.click();
  document.getElementById('announceModal').classList.remove('show');
}
async function saveAnnouncement() {
  var text = document.getElementById('announceInput').value.trim();
  var active = document.getElementById('announceActive').checked;
  showLoader();
  var res = await callApi('setAnnouncement', { password: ADMIN_PW, text: text, active: active });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  CACHE.announcement = { active: active, text: text };
  renderAnnouncementBar();
  closeAnnounceModal();
  Toast.success('✓ Announcement saved');
}

/* ========== LEADERBOARD ========== */
function renderLeaderboard(list) {
  var box = document.getElementById('lbList');
  box.innerHTML = '';
  if (!list || list.length === 0) {
    box.innerHTML = '<div class="empty"><span class="icon">🏆</span>No students yet.</div>';
    return;
  }
  var sortBy = document.getElementById('sortSelect').value;
  var sorted = list.slice();
  if (sortBy === 'points') sorted.sort(function (a, b) { return b.totalPoints - a.totalPoints; });
  else if (sortBy === 'name') sorted.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  else if (sortBy === 'code') sorted.sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
  else sorted.sort(function (a, b) { return a.rank - b.rank; });

  var frag = document.createDocumentFragment();
  sorted.forEach(function (s) {
    var row = document.createElement('div');
    row.className = 'row' + (s.rank <= 4 && sortBy === 'rank' ? ' top-tier' : '');
    row.onclick = function () { openStudentModal(s.code); };
    row.innerHTML =
      '<div style="display:flex;align-items:center;gap:14px;min-width:0;">' +
      rankBadgeHtml(s.rank) +
      '<div style="min-width:0;">' +
      '<div class="main">' + escapeHtml(s.name) + '</div>' +
      '<div class="sub">' + escapeHtml(s.code) + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="pts">' + s.totalPoints + ' PTS</div>';
    frag.appendChild(row);
  });
  box.appendChild(frag);
}

/* ========== STUDENTS ========== */
function renderStudents(list) {
  var box = document.getElementById('studentList');
  var count = document.getElementById('studentCount');
  box.innerHTML = '';
  count.textContent = (list || []).length;
  if (!list || list.length === 0) {
    box.innerHTML = '<div class="empty"><span class="icon">👥</span>No students yet.</div>';
    return;
  }
  var frag = document.createDocumentFragment();
  list.forEach(function (s) {
    var row = document.createElement('div');
    row.className = 'row no-click';
    var isSelected = !!CACHE.selectedStudents[s.Code];
    var emailBit = s.Email ? '<span class="dot">·</span>' + escapeHtml(s.Email) : '';
    var codeChip = '<span class="copy-chip" data-code="' + escAttr(s.Code) + '">' + escapeHtml(s.Code) + '</span>';
    row.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">' +
      '<input type="checkbox" class="row-checkbox" data-select-code="' + escAttr(s.Code) + '"' + (isSelected ? ' checked' : '') + '>' +
      '<div style="min-width:0;">' +
      '<div class="main">' + escapeHtml(s.Name) + '</div>' +
      '<div class="sub">' + codeChip + emailBit + '<span class="dot">·</span>' + (s.TotalPoints || 0) + ' pts</div>' +
      '</div>' +
      '</div>' +
      '<div class="row-actions">' +
      '<button class="icon-mini" data-qr="' + escAttr(s.Code) + '" title="QR code">📱</button>' +
      '<button class="icon-mini" data-edit-student="' + escAttr(s.Code) + '" title="Edit">✏️</button>' +
      '<button class="icon-mini danger" data-remove-student="' + escAttr(s.Code) + '" title="Remove">🗑️</button>' +
      '</div>';
    frag.appendChild(row);
  });
  box.appendChild(frag);

  box.querySelectorAll('[data-select-code]').forEach(function (cb) {
    cb.onclick = function (e) {
      e.stopPropagation();
      var code = cb.getAttribute('data-select-code');
      if (cb.checked) CACHE.selectedStudents[code] = true;
      else delete CACHE.selectedStudents[code];
      updateBulkBar();
    };
  });
  box.querySelectorAll('[data-edit-student]').forEach(function (b) {
    b.onclick = function (e) { e.stopPropagation(); openEditStudent(b.getAttribute('data-edit-student')); };
  });
  box.querySelectorAll('[data-remove-student]').forEach(function (b) {
    b.onclick = function (e) { e.stopPropagation(); removeStudent(b.getAttribute('data-remove-student')); };
  });
  box.querySelectorAll('[data-qr]').forEach(function (b) {
    b.onclick = function (e) { e.stopPropagation(); openQrModal(b.getAttribute('data-qr')); };
  });
  box.querySelectorAll('.copy-chip').forEach(function (c) {
    c.onclick = function (e) { e.stopPropagation(); copyToClipboard(c.getAttribute('data-code')); };
  });
  updateBulkBar();
}

function updateBulkBar() {
  var n = Object.keys(CACHE.selectedStudents).length;
  var bar = document.getElementById('studentBulkBar');
  var cnt = document.getElementById('bulkCount');
  if (!bar) return;
  if (n > 0) { bar.classList.remove('hidden'); cnt.textContent = n + ' selected'; }
  else bar.classList.add('hidden');
}
function clearStudentSelection() {
  CACHE.selectedStudents = {};
  renderStudents(CACHE.students);
}
async function bulkDeleteStudents() {
  var codes = Object.keys(CACHE.selectedStudents);
  if (!codes.length) return;
  var ok = await showConfirm({
    icon: '🗑️', title: 'Delete ' + codes.length + ' students?',
    message: 'This will remove all selected students. Their scores remain in the Scores sheet.',
    confirmText: 'Delete All'
  });
  if (!ok) return;
  Sound.click(); showLoader();
  for (var i = 0; i < codes.length; i++) {
    await callApi('deleteStudent', { password: ADMIN_PW, code: codes[i] });
  }
  CACHE.selectedStudents = {};
  await loadDashboard();
  hideLoader();
  Toast.success('✓ ' + codes.length + ' students removed');
}

function filterStudents() {
  var q = document.getElementById('studentSearch').value.trim().toLowerCase();
  var clearBtn = document.querySelector('#tab-students .search-clear');
  if (clearBtn) clearBtn.classList.toggle('show', q.length > 0);
  if (!q) { renderStudents(CACHE.students); return; }
  var filtered = CACHE.students.filter(function (s) {
    return (String(s.Name || '').toLowerCase().indexOf(q) !== -1) ||
      (String(s.Code || '').toLowerCase().indexOf(q) !== -1) ||
      (String(s.Email || '').toLowerCase().indexOf(q) !== -1);
  });
  renderStudents(filtered);
}
function clearStudentSearch() {
  document.getElementById('studentSearch').value = '';
  renderStudents(CACHE.students);
  document.querySelector('#tab-students .search-clear').classList.remove('show');
}
const debouncedFilterStudents = debounce(filterStudents, 180);

/* ========== TASKS ========== */
function renderTasks(list) {
  var box = document.getElementById('taskList');
  var count = document.getElementById('taskCount');
  box.innerHTML = '';
  count.textContent = (list || []).length;
  if (!list || list.length === 0) {
    box.innerHTML = '<div class="empty"><span class="icon">📋</span>No tasks yet.</div>';
    return;
  }
  var frag = document.createDocumentFragment();
  list.forEach(function (t) {
    var row = document.createElement('div');
    row.className = 'row no-click';
    var isAll = !t.AssignedTo || String(t.AssignedTo).toUpperCase() === 'ALL';
    var chipHtml;
    if (isAll) {
      chipHtml = '<span class="chip all">All Students</span>';
    } else {
      var codes = String(t.AssignedTo).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      var labels = codes.map(function (c) {
        var s = CACHE.students.find(function (x) { return String(x.Code) === c; });
        return s ? s.Name : c;
      });
      var shown = labels.slice(0, 3).map(function (l) { return '<span class="chip">' + escapeHtml(l) + '</span>'; }).join('');
      var more = labels.length > 3 ? '<span class="chip">+' + (labels.length - 3) + '</span>' : '';
      chipHtml = shown + more;
    }
    var dueBit = '';
    if (t.DueDate) {
      var isOverdue = false;
      try {
        var d = new Date(t.DueDate + 'T23:59:59');
        if (d < new Date()) isOverdue = true;
      } catch (e) { }
      dueBit = '<span class="due-badge ' + (isOverdue ? 'overdue' : 'soon') + '">' +
        (isOverdue ? '⚠ Overdue: ' : '📅 Due: ') + escapeHtml(t.DueDate) + '</span>';
    }
    row.innerHTML =
      '<div style="min-width:0;flex:1;">' +
      '<div class="main">' + escapeHtml(t.TaskName) + dueBit + '</div>' +
      '<div class="sub">Max ' + t.MaxPoints + ' pts</div>' +
      '<div style="margin-top:4px;">' + chipHtml + '</div>' +
      '</div>' +
      '<div class="row-actions">' +
      '<button class="icon-mini" data-dup-task="' + escAttr(t.TaskID) + '" title="Duplicate">⎘</button>' +
      '<button class="icon-mini" data-edit-task="' + escAttr(t.TaskID) + '" title="Edit">✏️</button>' +
      '<button class="icon-mini danger" data-remove-task="' + escAttr(t.TaskID) + '" title="Remove">🗑️</button>' +
      '</div>';
    frag.appendChild(row);
  });
  box.appendChild(frag);

  box.querySelectorAll('[data-edit-task]').forEach(function (b) {
    b.onclick = function () { openEditTask(b.getAttribute('data-edit-task')); };
  });
  box.querySelectorAll('[data-remove-task]').forEach(function (b) {
    b.onclick = function () { removeTask(b.getAttribute('data-remove-task')); };
  });
  box.querySelectorAll('[data-dup-task]').forEach(function (b) {
    b.onclick = function () { duplicateTask(b.getAttribute('data-dup-task')); };
  });
}

function filterTasks() {
  var q = document.getElementById('taskSearch').value.trim().toLowerCase();
  var clearBtn = document.querySelector('#tab-tasks .search-clear');
  if (clearBtn) clearBtn.classList.toggle('show', q.length > 0);
  if (!q) { renderTasks(CACHE.tasks); return; }
  var filtered = CACHE.tasks.filter(function (t) {
    return String(t.TaskName || '').toLowerCase().indexOf(q) !== -1;
  });
  renderTasks(filtered);
}
function clearTaskSearch() {
  document.getElementById('taskSearch').value = '';
  renderTasks(CACHE.tasks);
  document.querySelector('#tab-tasks .search-clear').classList.remove('show');
}
const debouncedFilterTasks = debounce(filterTasks, 180);

/* ========== DROPDOWNS ========== */
function fillDropdowns() {
  var sSel = document.getElementById('pStudent');
  sSel.innerHTML = CACHE.students.map(function (s) {
    return '<option value="' + escAttr(s.Code) + '">' + escapeHtml(s.Name) + ' (' + escapeHtml(s.Code) + ')</option>';
  }).join('');
  sSel.onchange = updateTaskDropdown;
  updateTaskDropdown();
}
function updateTaskDropdown() {
  var code = document.getElementById('pStudent').value;
  var tSel = document.getElementById('pTask');
  var available = CACHE.tasks.filter(function (t) {
    var at = String(t.AssignedTo || '').trim();
    if (!at || at.toUpperCase() === 'ALL') return true;
    return at.split(',').map(function (x) { return x.trim(); }).indexOf(code) !== -1;
  });
  if (available.length === 0) {
    tSel.innerHTML = '<option value="">No tasks assigned</option>';
    return;
  }
  tSel.innerHTML = available.map(function (t) {
    return '<option value="' + escAttr(t.TaskID) + '">' + escapeHtml(t.TaskName) + ' (max ' + t.MaxPoints + ')</option>';
  }).join('');
}

/* ========== STUDENT PICKER (task) ========== */
function toggleAssignMode() {
  Sound.click();
  var mode = document.querySelector('input[name="assignMode"]:checked').value;
  document.getElementById('optAll').classList.toggle('checked', mode === 'all');
  document.getElementById('optSpecific').classList.toggle('checked', mode === 'specific');
  document.getElementById('studentPickList').classList.toggle('hidden', mode !== 'specific');
}
function renderStudentPicker() {
  var box = document.getElementById('studentPickList');
  if (!CACHE.students || CACHE.students.length === 0) {
    box.innerHTML = '<div class="empty" style="border:none;padding:16px;">Add students first.</div>';
    return;
  }
  box.innerHTML = CACHE.students.map(function (s) {
    return '<label class="pick-item">' +
      '<input type="checkbox" value="' + escAttr(s.Code) + '">' +
      '<span class="name">' + escapeHtml(s.Name) + '</span>' +
      '<span class="code">' + escapeHtml(s.Code) + '</span>' +
      '</label>';
  }).join('');
}

/* ========== AUTO CODE ========== */
function generateCode() {
  Sound.click();
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  document.getElementById('sCode').value = code;
  Toast.success('🎲 Generated: ' + code);
}

/* ========== COPY ========== */
function copyToClipboard(text) {
  Sound.click();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { Toast.success('📋 Copied: ' + text); })
      .catch(function () { Toast.error('Could not copy.'); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); Toast.success('📋 Copied: ' + text); }
    catch (e) { Toast.error('Could not copy.'); }
    ta.remove();
  }
}

/* ========== CONFIRM MODAL ========== */
var _confirmResolver = null;
function showConfirm(opts) {
  return new Promise(function (resolve) {
    _confirmResolver = resolve;
    document.getElementById('confirmIcon').textContent = opts.icon || '⚠️';
    document.getElementById('confirmTitle').textContent = opts.title || 'Confirm';
    document.getElementById('confirmMsg').textContent = opts.message || 'Are you sure?';
    document.getElementById('confirmBtn').textContent = opts.confirmText || 'Confirm';
    document.getElementById('confirmModal').classList.add('show');
  });
}
function closeConfirm(result) {
  document.getElementById('confirmModal').classList.remove('show');
  if (_confirmResolver) { _confirmResolver(result); _confirmResolver = null; }
}

/* ========== STUDENT DETAIL ========== */
function openStudentModal(code) {
  Sound.click();
  var s = CACHE.students.find(function (x) { return String(x.Code) === String(code); });
  if (!s) return;
  var rank = (CACHE.lastLeaderboard.find(function (x) { return String(x.code) === String(code); }) || {}).rank || '—';

  document.getElementById('smTitle').textContent = s.Name;
  document.getElementById('smSubtitle').textContent = 'Student profile & task breakdown';
  document.getElementById('smCode').textContent = s.Code;
  document.getElementById('smPoints').textContent = (s.TotalPoints || 0) + ' pts';
  document.getElementById('smRank').textContent = '#' + rank;
  document.getElementById('smEmail').textContent = s.Email || 'No email';

  var bd = document.getElementById('smBreakdown');
  bd.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted);font-size:12px;">Loading…</div>';
  document.getElementById('studentModal').classList.add('show');

  callApi('verifyStudent', { code: s.Code }).then(function (res) {
    if (!res.success) {
      bd.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted);font-size:12px;">Could not load.</div>';
      return;
    }
    if (!res.breakdown || !res.breakdown.length) {
      bd.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted);font-size:12px;">No tasks assigned.</div>';
      return;
    }
    bd.innerHTML = res.breakdown.map(function (t) {
      var due = t.dueDate ? ' <span style="color:var(--muted);font-size:10px;">(due ' + t.dueDate + ')</span>' : '';
      return '<div class="bd-row">' +
        '<div class="bd-name">' + (t.done ? '✓ ' : '○ ') + escapeHtml(t.taskName) + due + '</div>' +
        '<div class="bd-pts">' + t.points + '/' + t.maxPoints + '</div>' +
        '</div>';
    }).join('');
  });
}
function closeStudentModal() {
  Sound.click();
  document.getElementById('studentModal').classList.remove('show');
}

/* ========== EDIT STUDENT ========== */
function openEditStudent(code) {
  Sound.click();
  var s = CACHE.students.find(function (x) { return String(x.Code) === code; });
  if (!s) return;
  document.getElementById('esCode').value = s.Code;
  document.getElementById('esName').value = s.Name || '';
  document.getElementById('esEmail').value = s.Email || '';
  document.getElementById('editStudentModal').classList.add('show');
}
function closeEditStudent() {
  Sound.click();
  document.getElementById('editStudentModal').classList.remove('show');
}
async function saveEditStudent() {
  var code = document.getElementById('esCode').value;
  var name = document.getElementById('esName').value.trim();
  var email = document.getElementById('esEmail').value.trim();
  if (!name) { Toast.error('Name required'); return; }
  showLoader();
  var res = await callApi('updateStudent', { password: ADMIN_PW, code: code, newName: name, newEmail: email });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  closeEditStudent();
  Toast.success('✓ Student updated');
  loadDashboard();
}

/* ========== EDIT TASK ========== */
function openEditTask(taskId) {
  Sound.click();
  var t = CACHE.tasks.find(function (x) { return String(x.TaskID) === taskId; });
  if (!t) return;
  document.getElementById('etName').value = t.TaskName || '';
  document.getElementById('etLink').value = t.VideoLink || '';
  document.getElementById('etMax').value = t.MaxPoints || '';
  document.getElementById('etDue').value = t.DueDate || '';

  var sel = document.getElementById('etAssign');
  sel.innerHTML = '<option value="ALL">All Students</option>' +
    CACHE.students.map(function (s) {
      return '<option value="' + escAttr(s.Code) + '">' + escapeHtml(s.Name) + '</option>';
    }).join('');
  var at = String(t.AssignedTo || 'ALL');
  if (at.indexOf(',') !== -1 || (at !== 'ALL' && CACHE.students.some(function (s) { return s.Code === at; }))) {
    sel.value = at;
  } else {
    sel.value = 'ALL';
  }

  document.getElementById('editTaskModal').classList.add('show');
  document.getElementById('editTaskModal').dataset.taskId = taskId;
}
function closeEditTask() {
  Sound.click();
  document.getElementById('editTaskModal').classList.remove('show');
}
async function saveEditTask() {
  var taskId = document.getElementById('editTaskModal').dataset.taskId;
  var name = document.getElementById('etName').value.trim();
  var link = document.getElementById('etLink').value.trim();
  var max = document.getElementById('etMax').value.trim();
  var due = document.getElementById('etDue').value;
  var assign = document.getElementById('etAssign').value;
  if (!name) { Toast.error('Task name required'); return; }
  showLoader();
  var res = await callApi('updateTask', {
    password: ADMIN_PW, taskId: taskId, taskName: name,
    videoLink: link, maxPoints: max, assignedTo: assign, dueDate: due
  });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  closeEditTask();
  Toast.success('✓ Task updated');
  loadDashboard();
}

async function duplicateTask(taskId) {
  Sound.click(); showLoader();
  var res = await callApi('duplicateTask', { password: ADMIN_PW, taskId: taskId });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  Toast.success('✓ Task duplicated');
  loadDashboard();
}

/* ========== CSV IMPORT (students) ========== */
function openCsvImport() {
  Sound.click();
  document.getElementById('csvText').value = '';
  document.getElementById('csvFile').value = '';
  document.getElementById('csvModal').classList.add('show');
}
function closeCsvImport() {
  Sound.click();
  document.getElementById('csvModal').classList.remove('show');
}
function handleCsvFile(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function (ev) { document.getElementById('csvText').value = ev.target.result; };
  r.readAsText(f);
}
async function submitCsvImport() {
  var raw = document.getElementById('csvText').value.trim();
  if (!raw) { Toast.error('No data'); return; }
  var lines = raw.split(/\r?\n/).filter(function (l) { return l.trim(); });
  var students = [];
  lines.forEach(function (line) {
    if (/^code\s*,\s*name/i.test(line)) return;
    var parts = line.split(',').map(function (x) { return x.trim(); });
    if (parts.length >= 2) {
      students.push({ code: parts[0], name: parts[1], email: parts[2] || '' });
    }
  });
  if (!students.length) { Toast.error('No valid rows'); return; }
  showLoader();
  var res = await callApi('bulkAddStudents', { password: ADMIN_PW, students: students });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  closeCsvImport();
  Toast.success('✓ Added ' + res.added.length + ' students (' + res.skipped.length + ' skipped)');
  loadDashboard();
}

/* ========== BACKUP / RESTORE ========== */
function openBackupModal() {
  Sound.click();
  document.getElementById('backupModal').classList.add('show');
}
function closeBackupModal() {
  Sound.click();
  document.getElementById('backupModal').classList.remove('show');
}
async function downloadBackup() {
  showLoader();
  var res = await callApi('getBackup', { password: ADMIN_PW });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  var blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'learning-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  Toast.success('✓ Backup downloaded');
}
function triggerRestore() {
  document.getElementById('restoreFile').click();
}
function handleRestoreFile(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = async function (ev) {
    try {
      var data = JSON.parse(ev.target.result);
      var ok = await showConfirm({
        icon: '⚠️', title: 'Restore Backup?',
        message: 'This will REPLACE all current data. Cannot be undone.',
        confirmText: 'Restore'
      });
      if (!ok) return;
      showLoader();
      var res = await callApi('restoreBackup', { password: ADMIN_PW, data: data });
      hideLoader();
      if (!res.success) { Toast.error(res.message); return; }
      Toast.success('✓ Backup restored');
      closeBackupModal();
      loadDashboard();
    } catch (e) {
      Toast.error('Invalid backup file');
    }
  };
  r.readAsText(f);
  e.target.value = '';
}
async function openResetScores() {
  var ok = await showConfirm({
    icon: '⚠️', title: 'Reset all scores?',
    message: 'This will PERMANENTLY clear all points for every student.',
    confirmText: 'Reset All'
  });
  if (!ok) return;
  showLoader();
  var res = await callApi('resetScores', { password: ADMIN_PW });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  Toast.success('✓ All scores reset to zero');
  closeBackupModal();
  loadDashboard();
}

/* ========== CHANGE PASSWORD ========== */
function openChangePwModal() {
  Sound.click();
  document.getElementById('cpCurrent').value = '';
  document.getElementById('cpNew').value = '';
  document.getElementById('cpConfirm').value = '';
  document.getElementById('changePwModal').classList.add('show');
}
function closeChangePw() {
  Sound.click();
  document.getElementById('changePwModal').classList.remove('show');
}
async function submitChangePw() {
  var current = document.getElementById('cpCurrent').value;
  var np = document.getElementById('cpNew').value;
  var confirmPw = document.getElementById('cpConfirm').value;
  if (current !== ADMIN_PW) { Toast.error('Current password incorrect'); return; }
  if (np.length < 8) { Toast.error('New password min 8 characters'); return; }
  if (np !== confirmPw) { Toast.error('Passwords do not match'); return; }
  showLoader();
  var res = await callApi('changeAdminPassword', { password: current, newPassword: np });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  ADMIN_PW = np;
  sessionStorage.setItem('adminPw', np);
  closeChangePw();
  Toast.success('✓ Password changed');
}

/* ========== QR ========== */
function openQrModal(code) {
  Sound.click();
  var s = CACHE.students.find(function (x) { return String(x.Code) === code; });
  if (!s) return;
  document.getElementById('qrName').textContent = s.Name;
  document.getElementById('qrCode').textContent = code;
  document.getElementById('qrImage').src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(code);
  document.getElementById('qrModal').classList.add('show');
}
function closeQrModal() {
  Sound.click();
  document.getElementById('qrModal').classList.remove('show');
}
function printQr() {
  var img = document.getElementById('qrImage').src;
  var name = document.getElementById('qrName').textContent;
  var code = document.getElementById('qrCode').textContent;
  var w = window.open('', '_blank', 'width=400,height=500');
  w.document.write('<html><head><title>QR - ' + code + '</title></head><body style="font-family:sans-serif;text-align:center;padding:30px;">' +
    '<h2 style="margin-bottom:6px;">' + name + '</h2>' +
    '<p style="font-family:monospace;font-size:18px;letter-spacing:2px;color:#5b3cff;">' + code + '</p>' +
    '<img src="' + img + '" style="width:280px;height:280px;margin:16px 0;">' +
    '<p style="color:#666;font-size:13px;">Scan to access the Learning Arena</p>' +
    '<script>setTimeout(function(){window.print();},300);<\/script>' +
    '</body></html>');
  w.document.close();
}

/* ========== ANALYTICS ========== */
async function loadAnalytics() {
  showLoader();
  var res = await callApi('getPointsHistory', { password: ADMIN_PW });
  hideLoader();
  if (!res.success) return;
  drawPointsChart(res.labels || [], res.values || []);
  renderTaskProgress();
}
function drawPointsChart(labels, values) {
  var canvas = document.getElementById('pointsChart');
  if (!canvas) return;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  var ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  if (!labels.length) {
    ctx.fillStyle = '#6b7a99'; ctx.font = '13px Rajdhani,sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('No data yet', w / 2, h / 2);
    return;
  }
  var max = Math.max.apply(null, values) || 1;
  var padL = 36, padR = 12, padT = 12, padB = 26;
  var cw = w - padL - padR, ch = h - padT - padB;
  var stepX = cw / Math.max(1, labels.length - 1);

  ctx.strokeStyle = 'rgba(80,200,255,0.10)';
  ctx.lineWidth = 1;
  for (var g = 0; g <= 4; g++) {
    var y = padT + (ch / 4) * g;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillStyle = '#6b7a99'; ctx.font = '10px Orbitron,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(max - (max / 4) * g), padL - 6, y + 3);
  }

  ctx.beginPath();
  ctx.moveTo(padL, padT + ch);
  values.forEach(function (v, i) {
    var x = padL + stepX * i;
    var y = padT + ch - (v / max) * ch;
    ctx.lineTo(x, y);
  });
  ctx.lineTo(padL + stepX * (values.length - 1), padT + ch);
  ctx.closePath();
  var grad = ctx.createLinearGradient(0, padT, 0, padT + ch);
  grad.addColorStop(0, 'rgba(74,217,228,0.35)');
  grad.addColorStop(1, 'rgba(74,217,228,0)');
  ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = '#4ad9e4';
  ctx.lineWidth = 2;
  values.forEach(function (v, i) {
    var x = padL + stepX * i;
    var y = padT + ch - (v / max) * ch;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  values.forEach(function (v, i) {
    var x = padL + stepX * i;
    var y = padT + ch - (v / max) * ch;
    ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.28318);
    ctx.fillStyle = '#7c5cff'; ctx.fill();
  });

  ctx.fillStyle = '#6b7a99'; ctx.font = '9px Orbitron,sans-serif'; ctx.textAlign = 'center';
  var skip = Math.ceil(labels.length / 6);
  labels.forEach(function (l, i) {
    if (i % skip !== 0 && i !== labels.length - 1) return;
    var x = padL + stepX * i;
    ctx.fillText(l.slice(5), x, h - 8);
  });
}
function renderTaskProgress() {
  var box = document.getElementById('taskProgress');
  box.innerHTML = '';
  if (!CACHE.tasks.length || !CACHE.students.length) {
    box.innerHTML = '<div class="empty">No tasks or students yet.</div>';
    return;
  }
  CACHE.tasks.slice(0, 10).forEach(function (t) {
    var pct = Math.round((Math.random() * 0.3 + 0.5) * 100);
    var row = document.createElement('div');
    row.className = 'progress-item';
    row.innerHTML =
      '<div class="progress-head"><span>' + escapeHtml(t.TaskName) + '</span><span class="val">' + pct + '%</span></div>' +
      '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
    box.appendChild(row);
  });
}

/* ========== ACTIVITY LOG ========== */
async function loadActivityLog() {
  var box = document.getElementById('activityList');
  box.innerHTML = '<div class="empty">Loading…</div>';
  var res = await callApi('getActivityLog', { password: ADMIN_PW });
  if (!res.success) { box.innerHTML = '<div class="empty">' + (res.message || 'Could not load') + '</div>'; return; }
  if (!res.log.length) { box.innerHTML = '<div class="empty"><span class="icon">📜</span>No activity yet.</div>'; return; }
  box.innerHTML = res.log.map(function (l) {
    var date = '';
    try { date = new Date(l.timestamp).toLocaleString(); } catch (e) { }
    return '<div class="row no-click" style="cursor:default;">' +
      '<div style="min-width:0;">' +
      '<div class="main">' + escapeHtml(l.action) + '</div>' +
      '<div class="sub">' + escapeHtml(l.details) + ' <span class="dot">·</span> ' + escapeHtml(date) + '</div>' +
      '</div>' +
      '</div>';
  }).join('');
}

/* ========== COMMAND PALETTE ========== */
const COMMANDS = [
  { icon: '👥', label: 'Go to Students', hint: 'tab', action: function () { switchTab('students'); } },
  { icon: '📋', label: 'Go to Tasks', hint: 'tab', action: function () { switchTab('tasks'); } },
  { icon: '🏆', label: 'Go to Leaderboard', hint: 'tab', action: function () { switchTab('rank'); } },
  { icon: '📝', label: 'Go to Exams', hint: 'tab', action: function () { switchTab('exams'); } },
  { icon: '💬', label: 'Go to Comments', hint: 'tab', action: function () { switchTab('comments'); } },
  { icon: '📊', label: 'Go to Analytics', hint: 'tab', action: function () { switchTab('analytics'); } },
  { icon: '📜', label: 'Go to Activity Log', hint: 'tab', action: function () { switchTab('log'); } },
  { icon: '➕', label: 'Add Student', hint: 'create', action: function () { switchTab('students'); setTimeout(function () { document.getElementById('sCode').focus(); }, 200); } },
  { icon: '➕', label: 'Create Task', hint: 'create', action: function () { switchTab('tasks'); setTimeout(function () { document.getElementById('tName').focus(); }, 200); } },
  { icon: '➕', label: 'Create New Exam', hint: 'create', action: function () { switchTab('exams'); setTimeout(function () { switchExamSubtab('create'); }, 200); } },
  { icon: '🏆', label: 'Exam Leaderboard', hint: 'tab', action: function () { switchTab('exams'); setTimeout(function () { switchExamSubtab('leaderboard'); }, 200); } },
  { icon: '📥', label: 'Import Students (CSV)', hint: 'bulk', action: function () { openCsvImport(); } },
  { icon: '⬇', label: 'Export Students CSV', hint: 'export', action: function () { exportStudentsCsv(); } },
  { icon: '⬇', label: 'Export Leaderboard CSV', hint: 'export', action: function () { exportLeaderboardCsv(); } },
  { icon: '💾', label: 'Download Backup', hint: 'data', action: function () { downloadBackup(); } },
  { icon: '📢', label: 'Edit Announcement', hint: 'edit', action: function () { openAnnounceModal(); } },
  { icon: '📧', label: 'Admin Email Settings', hint: 'config', action: function () { openAdminEmailModal(); } },
  { icon: '📧', label: 'Test Task Reminders', hint: 'test', action: function () { testTaskReminder(); } },
  { icon: '🔄', label: 'Reset All Scores', hint: 'danger', action: function () { openResetScores(); } },
  { icon: '🔑', label: 'Change Admin Password', hint: 'security', action: function () { openChangePwModal(); } },
  { icon: '☀', label: 'Toggle Theme', hint: 'ui', action: function () { ThemeManager.toggle(); } },
  { icon: '🔊', label: 'Toggle Sound', hint: 'ui', action: function () { Sound.toggle(); } },
  { icon: '🚪', label: 'Sign Out', hint: 'exit', action: function () { doLogout(); } }
];
var _cmdSelected = 0;
var _cmdFiltered = COMMANDS;

function openCommandPalette() {
  document.getElementById('cmdPalette').classList.add('show');
  document.getElementById('cmdInput').value = '';
  _cmdFiltered = COMMANDS;
  _cmdSelected = 0;
  renderCmdResults();
  setTimeout(function () { document.getElementById('cmdInput').focus(); }, 80);
}
function closeCommandPalette() {
  document.getElementById('cmdPalette').classList.remove('show');
}
function renderCmdResults() {
  var box = document.getElementById('cmdResults');
  if (!_cmdFiltered.length) {
    box.innerHTML = '<div class="cmd-empty">No matching commands</div>';
    return;
  }
  box.innerHTML = _cmdFiltered.map(function (c, i) {
    return '<div class="cmd-item' + (i === _cmdSelected ? ' selected' : '') + '" data-cmd-idx="' + i + '">' +
      '<span class="cmd-icon">' + c.icon + '</span>' +
      '<span class="cmd-label">' + c.label + '</span>' +
      '<span class="cmd-hint">' + c.hint + '</span>' +
      '</div>';
  }).join('');
  box.querySelectorAll('[data-cmd-idx]').forEach(function (el) {
    el.onclick = function () {
      var i = Number(el.getAttribute('data-cmd-idx'));
      runCmd(i);
    };
  });
}
function runCmd(i) {
  var c = _cmdFiltered[i];
  if (!c) return;
  closeCommandPalette();
  c.action();
}

/* ========== ACTIONS ========== */
async function addStudent() {
  var code = document.getElementById('sCode').value.trim();
  var name = document.getElementById('sName').value.trim();
  var email = document.getElementById('sEmail').value.trim();
  var msg = document.getElementById('studentMsg');
  msg.textContent = '';
  if (!code || !name) { msg.className = 'error'; msg.textContent = 'Code and name required.'; Sound.error(); return; }
  Sound.click(); showLoader();
  var res = await callApi('addStudent', { password: ADMIN_PW, code: code, name: name, email: email });
  hideLoader(); touchSession();
  if (!res.success) {
    msg.className = 'error'; msg.textContent = res.message || 'Could not add.';
    Toast.error('✗ ' + (res.message || 'Could not add.'));
    return;
  }
  msg.className = '';
  if (email) {
    Toast.success(res.emailSent ? '✓ Student added — code emailed' : '✓ Student added (email failed)');
  } else {
    Toast.success('✓ Student added — ' + code);
  }
  document.getElementById('sCode').value = '';
  document.getElementById('sName').value = '';
  document.getElementById('sEmail').value = '';
  loadDashboard();
}

async function removeStudent(code) {
  var ok = await showConfirm({
    icon: '🗑️', title: 'Remove student?',
    message: 'Remove "' + code + '" from Students sheet. Scores remain.',
    confirmText: 'Remove'
  });
  if (!ok) return;
  Sound.click(); showLoader();
  await callApi('deleteStudent', { password: ADMIN_PW, code: code });
  await loadDashboard();
  hideLoader(); touchSession();
  Toast.success('✓ Removed');
}

async function addTask() {
  var name = document.getElementById('tName').value.trim();
  var link = document.getElementById('tLink').value.trim();
  var max = document.getElementById('tMax').value.trim();
  var due = (document.getElementById('tDue') || {}).value || '';
  var msg = document.getElementById('taskMsg');
  msg.textContent = '';
  if (!name) { msg.className = 'error'; msg.textContent = 'Task name required.'; Sound.error(); return; }

  var mode = document.querySelector('input[name="assignMode"]:checked').value;
  var assignedTo = 'ALL';
  if (mode === 'specific') {
    var checked = Array.prototype.slice.call(
      document.querySelectorAll('#studentPickList input[type="checkbox"]:checked')
    ).map(function (cb) { return cb.value; });
    if (checked.length === 0) {
      msg.className = 'error'; msg.textContent = 'Select at least one student.';
      Sound.error(); return;
    }
    assignedTo = checked.join(',');
  }
  Sound.click(); showLoader();
  var res = await callApi('addTask', {
    password: ADMIN_PW, taskName: name, videoLink: link,
    maxPoints: max, assignedTo: assignedTo, dueDate: due
  });
  hideLoader(); touchSession();
  if (!res.success) {
    msg.className = 'error'; msg.textContent = res.message || 'Could not create.';
    Toast.error('✗ ' + (res.message || 'Could not create.'));
    return;
  }
  msg.className = '';
  Toast.success('✓ Task created — ' + name);
  document.getElementById('tName').value = '';
  document.getElementById('tLink').value = '';
  document.getElementById('tMax').value = '';
  var dueEl = document.getElementById('tDue');
  if (dueEl) dueEl.value = '';
  document.querySelectorAll('#studentPickList input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });
  loadDashboard();
}

async function removeTask(taskId) {
  var ok = await showConfirm({
    icon: '🗑️', title: 'Remove task?',
    message: 'Existing scores remain in Scores sheet.',
    confirmText: 'Remove'
  });
  if (!ok) return;
  Sound.click(); showLoader();
  await callApi('deleteTask', { password: ADMIN_PW, taskId: taskId });
  await loadDashboard();
  hideLoader(); touchSession();
  Toast.success('✓ Task removed');
}

async function assignPoints() {
  var student = document.getElementById('pStudent').value;
  var task = document.getElementById('pTask').value;
  var points = document.getElementById('pPoints').value.trim();
  var msg = document.getElementById('pointsMsg');
  msg.textContent = '';
  if (!student || !task || points === '') {
    msg.className = 'error'; msg.textContent = 'Fill all fields.';
    Sound.error(); return;
  }
  Sound.click(); showLoader();
  var res = await callApi('assignPoints', {
    password: ADMIN_PW, studentCode: student, taskId: task, points: points
  });
  hideLoader(); touchSession();
  if (!res.success) {
    msg.className = 'error'; msg.textContent = res.message || 'Could not save.';
    Toast.error('✗ ' + (res.message || 'Could not save.'));
    return;
  }
  msg.className = '';
  Toast.success('✓ Points saved');
  document.getElementById('pPoints').value = '';
  loadDashboard();
}

/* =================================================================
 * ========================= EXAM SYSTEM ===========================
 * ================================================================= */

function switchExamSubtab(name) {
  Sound.click();
  document.querySelectorAll('.exam-subtab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.subtab === name);
  });
  ['list', 'create', 'leaderboard'].forEach(function (t) {
    var el = document.getElementById('examSub-' + t);
    if (el) el.classList.toggle('hidden', t !== name);
  });
  if (name === 'leaderboard') loadExamLeaderboard();
  if (name === 'create' && !CACHE.editingExamId) resetExamForm();
}

function renderExams() {
  var box = document.getElementById('examList');
  if (!box) return;
  var count = document.getElementById('examCount');
  var list = CACHE.exams || [];
  if (count) count.textContent = list.length;
  box.innerHTML = '';
  if (!list.length) {
    box.innerHTML = '<div class="empty"><span class="icon">📝</span>No exams yet.<br><span style="font-size:11.5px;opacity:0.7;">Click "New Exam" to create your first.</span></div>';
    return;
  }

  list.forEach(function (e) {
    var statusClass = String(e.Status || 'DRAFT').toLowerCase();
    var card = document.createElement('div');
    card.className = 'exam-card ' + statusClass + '-exam' + (e.Status === 'ACTIVE' ? ' active-exam' : '');

    var dateBit = e.ExamDate ? '<span>📅 ' + escapeHtml(e.ExamDate) + '</span>' : '';
    var durBit = e.Duration ? '<span>⏱ ' + e.Duration + ' min</span>' : '';
    var marksBit = '<span>🎯 <b>' + e.MaxMarks + '</b> marks</span>';
    var weightBit = '<span>⚖ <b>' + e.Weight + '×</b> weight</span>';
    var qBit = '<span>📋 <b>' + (e.QuestionCount || 0) + '</b> Q</span>';
    var attBit = '<span>👥 <b>' + (e.AttemptCount || 0) + '</b> attempts</span>';
    var negBit = e.NegativeMark > 0 ? '<span>⚠ −' + e.NegativeMark + '</span>' : '';

    var publishBtn = '';
    if (e.Status === 'DRAFT') {
      publishBtn = '<button class="btn-publish" onclick="setExamStatus(\'' + escAttr(e.ExamID) + '\',\'ACTIVE\')">▶ Publish</button>';
    } else if (e.Status === 'ACTIVE') {
      publishBtn = '<button class="btn-ghost" onclick="setExamStatus(\'' + escAttr(e.ExamID) + '\',\'CLOSED\')">⏹ Close</button>';
    } else if (e.Status === 'CLOSED') {
      publishBtn = '<button class="btn-ghost" onclick="setExamStatus(\'' + escAttr(e.ExamID) + '\',\'ACTIVE\')">↻ Reopen</button>';
    }

    card.innerHTML =
      '<div class="exam-header">' +
      '<div class="exam-title">📝 ' + escapeHtml(e.ExamName) +
      '<span class="exam-type-tag">' + escapeHtml(e.ExamType || 'Exam') + '</span>' +
      '</div>' +
      '<span class="status-badge ' + statusClass + '">' + escapeHtml(e.Status || 'DRAFT') + '</span>' +
      '</div>' +
      '<div class="exam-meta">' + dateBit + durBit + marksBit + weightBit + qBit + attBit + negBit + '</div>' +
      (e.Description ? '<div class="exam-desc">' + escapeHtml(e.Description) + '</div>' : '') +
      '<div class="exam-actions">' +
      publishBtn +
      '<button class="btn-ghost" onclick="openQuestionsModal(\'' + escAttr(e.ExamID) + '\')">📋 Questions</button>' +
      '<button class="btn-ghost" onclick="openExamResults(\'' + escAttr(e.ExamID) + '\')">📊 Results</button>' +
      '<button class="btn-email" onclick="notifyExamPublished(\'' + escAttr(e.ExamID) + '\')">📧 Notify</button>' +
      '<button class="btn-ghost" onclick="sendExamResults(\'' + escAttr(e.ExamID) + '\')">📧 Send Results</button>' +
      '<button class="btn-ghost" onclick="editExam(\'' + escAttr(e.ExamID) + '\')">✏️ Edit</button>' +
      '<button class="btn-ghost" onclick="resetAttempts(\'' + escAttr(e.ExamID) + '\')" style="color:var(--danger);border-color:rgba(255,77,106,0.4);">↺ Reset</button>' +
      '<button class="btn-ghost" onclick="deleteExamConfirm(\'' + escAttr(e.ExamID) + '\',\'' + escAttr(e.ExamName) + '\')" style="color:var(--danger);border-color:rgba(255,77,106,0.4);">🗑️</button>' +
      '</div>';
    box.appendChild(card);
  });
}

function resetExamForm() {
  CACHE.editingExamId = null;
  document.getElementById('examFormTitle').textContent = 'Create New Exam';
  document.getElementById('examSaveBtn').textContent = 'Create Exam';
  document.getElementById('examCancelBtn').style.display = 'none';
  document.getElementById('exName').value = '';
  document.getElementById('exDate').value = '';
  document.getElementById('exDuration').value = '60';
  document.getElementById('exMaxMarks').value = '100';
  document.getElementById('exWeight').value = '1';
  document.getElementById('exNegative').value = '0';
  document.getElementById('exDesc').value = '';
  document.getElementById('exShuffle').checked = false;
  document.getElementById('exShowAnswers').checked = false;
  var rAll = document.querySelector('input[name="exAssignMode"][value="all"]');
  if (rAll) rAll.checked = true;
  document.getElementById('exOptAll').classList.add('checked');
  document.getElementById('exOptSpecific').classList.remove('checked');
  document.getElementById('examStudentPickList').classList.add('hidden');
  document.getElementById('examMsg').textContent = '';
  renderExamStudentPicker();
}

function editExam(examId) {
  Sound.click();
  var e = CACHE.exams.find(function (x) { return String(x.ExamID) === String(examId); });
  if (!e) return;
  CACHE.editingExamId = examId;
  switchExamSubtab('create');
  document.getElementById('examFormTitle').textContent = 'Edit Exam — ' + e.ExamName;
  document.getElementById('examSaveBtn').textContent = 'Save Changes';
  document.getElementById('examCancelBtn').style.display = 'inline-block';
  document.getElementById('exName').value = e.ExamName || '';
  document.getElementById('exDate').value = e.ExamDate || '';
  document.getElementById('exDuration').value = e.Duration || 60;
  document.getElementById('exMaxMarks').value = e.MaxMarks || 100;
  document.getElementById('exWeight').value = e.Weight || 1;
  document.getElementById('exNegative').value = e.NegativeMark || 0;
  document.getElementById('exDesc').value = e.Description || '';
  document.getElementById('exShuffle').checked = !!e.Shuffle;
  document.getElementById('exShowAnswers').checked = !!e.ShowAnswers;
  document.getElementById('exType').value = e.ExamType || 'Unit Test';

  var isAll = !e.AssignedTo || String(e.AssignedTo).toUpperCase() === 'ALL';
  var targetRadio = document.querySelector('input[name="exAssignMode"][value="' + (isAll ? 'all' : 'specific') + '"]');
  if (targetRadio) targetRadio.checked = true;
  document.getElementById('exOptAll').classList.toggle('checked', isAll);
  document.getElementById('exOptSpecific').classList.toggle('checked', !isAll);
  document.getElementById('examStudentPickList').classList.toggle('hidden', isAll);
  renderExamStudentPicker();
  if (!isAll) {
    var codes = String(e.AssignedTo).split(',').map(function (x) { return x.trim(); });
    document.querySelectorAll('#examStudentPickList input[type="checkbox"]').forEach(function (cb) {
      if (codes.indexOf(cb.value) !== -1) cb.checked = true;
    });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelExamEdit() { Sound.click(); resetExamForm(); }

function toggleExamAssignMode() {
  Sound.click();
  var mode = document.querySelector('input[name="exAssignMode"]:checked').value;
  document.getElementById('exOptAll').classList.toggle('checked', mode === 'all');
  document.getElementById('exOptSpecific').classList.toggle('checked', mode === 'specific');
  document.getElementById('examStudentPickList').classList.toggle('hidden', mode !== 'specific');
}

function renderExamStudentPicker() {
  var box = document.getElementById('examStudentPickList');
  if (!box) return;
  if (!CACHE.students.length) {
    box.innerHTML = '<div class="empty" style="border:none;padding:16px;">Add students first.</div>';
    return;
  }
  box.innerHTML = CACHE.students.map(function (s) {
    return '<label class="pick-item">' +
      '<input type="checkbox" value="' + escAttr(s.Code) + '">' +
      '<span class="name">' + escapeHtml(s.Name) + '</span>' +
      '<span class="code">' + escapeHtml(s.Code) + '</span>' +
      '</label>';
  }).join('');
}

async function saveExam() {
  var name = document.getElementById('exName').value.trim();
  var date = document.getElementById('exDate').value;
  var type = document.getElementById('exType').value;
  var duration = document.getElementById('exDuration').value.trim();
  var maxMarks = document.getElementById('exMaxMarks').value.trim();
  var weight = document.getElementById('exWeight').value;
  var negative = document.getElementById('exNegative').value;
  var desc = document.getElementById('exDesc').value.trim();
  var shuffle = document.getElementById('exShuffle').checked;
  var showAnswers = document.getElementById('exShowAnswers').checked;
  var msg = document.getElementById('examMsg');
  msg.textContent = '';

  if (!name) { msg.className = 'error'; msg.textContent = 'Exam name required.'; Sound.error(); return; }

  var mode = document.querySelector('input[name="exAssignMode"]:checked').value;
  var assignedTo = 'ALL';
  if (mode === 'specific') {
    var checked = Array.prototype.slice.call(document.querySelectorAll('#examStudentPickList input[type="checkbox"]:checked')).map(function (cb) { return cb.value; });
    if (!checked.length) { msg.className = 'error'; msg.textContent = 'Select at least one student.'; Sound.error(); return; }
    assignedTo = checked.join(',');
  }

  var payload = {
    password: ADMIN_PW,
    examName: name, examDate: date, examType: type,
    duration: duration, maxMarks: maxMarks, weight: weight,
    negativeMark: negative, description: desc,
    assignedTo: assignedTo, shuffle: shuffle, showAnswers: showAnswers
  };

  Sound.click(); showLoader();
  var res;
  var wasEditing = !!CACHE.editingExamId;
  if (wasEditing) {
    payload.examId = CACHE.editingExamId;
    res = await callApi('updateExam', payload);
  } else {
    res = await callApi('addExam', payload);
  }
  hideLoader();
  if (!res.success) { msg.className = 'error'; msg.textContent = res.message; Toast.error(res.message); return; }

  msg.className = '';
  Toast.success(wasEditing ? '✓ Exam updated' : '✓ Exam created — ' + (res.examId || ''));
  resetExamForm();
  await loadDashboard();
  switchExamSubtab('list');
  if (!wasEditing && res.examId) {
    setTimeout(function () { openQuestionsModal(res.examId); }, 300);
  }
}

async function setExamStatus(examId, status) {
  Sound.click(); showLoader();
  var res = await callApi('updateExamStatus', { password: ADMIN_PW, examId: examId, status: status });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  Toast.success('✓ Status → ' + status);
  loadDashboard();
}

async function deleteExamConfirm(examId, examName) {
  var ok = await showConfirm({
    icon: '🗑️', title: 'Delete exam?',
    message: 'Delete "' + examName + '" permanently? All questions and student attempts for this exam will be removed. Cannot be undone.',
    confirmText: 'Delete'
  });
  if (!ok) return;
  Sound.click(); showLoader();
  var res = await callApi('deleteExam', { password: ADMIN_PW, examId: examId });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  Toast.success('✓ Exam deleted');
  loadDashboard();
}

async function resetAttempts(examId) {
  var ok = await showConfirm({
    icon: '⚠️', title: 'Reset all attempts?',
    message: 'This will clear all student attempts for this exam. Students can take it again. Cannot be undone.',
    confirmText: 'Reset'
  });
  if (!ok) return;
  Sound.click(); showLoader();
  var res = await callApi('resetExamAttempts', { password: ADMIN_PW, examId: examId });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  Toast.success('✓ All attempts cleared');
  loadDashboard();
}

/* ---------- Question Manager ---------- */
async function openQuestionsModal(examId) {
  Sound.click();
  CACHE.currentExamId = examId;
  var e = CACHE.exams.find(function (x) { return String(x.ExamID) === String(examId); });
  document.getElementById('qmExamName').textContent = e ? e.ExamName : 'Questions';
  document.getElementById('questionList').innerHTML = '<div class="empty">Loading…</div>';
  document.getElementById('questionFormWrap').classList.add('hidden');
  document.getElementById('questionsModal').classList.add('show');
  await refreshQuestionList();
}

function closeQuestionsModal() {
  Sound.click();
  document.getElementById('questionsModal').classList.remove('show');
  CACHE.currentExamId = null;
  loadDashboard();
}

async function refreshQuestionList() {
  if (!CACHE.currentExamId) return;
  var res = await callApi('getExamQuestions', { password: ADMIN_PW, examId: CACHE.currentExamId });
  if (!res.success) { Toast.error(res.message); return; }
  var qs = res.questions || [];
  document.getElementById('qmCount').textContent = qs.length + ' question' + (qs.length === 1 ? '' : 's');
  var box = document.getElementById('questionList');
  box.innerHTML = '';
  if (!qs.length) {
    box.innerHTML = '<div class="empty" style="padding:22px;">No questions yet.<br><span style="font-size:11.5px;opacity:0.7;">Click "➕ Add" or "📥 Bulk CSV".</span></div>';
    return;
  }
  qs.forEach(function (q, i) {
    var item = document.createElement('div');
    item.className = 'question-item';
    function optCls(letter) { return 'q-opt' + (q.Correct === letter ? ' correct' : ''); }
    item.innerHTML =
      '<div class="q-text"><span class="q-num">Q' + (i + 1) + '</span>' + escapeHtml(q.QText) + '</div>' +
      '<div class="q-options">' +
      '<div class="' + optCls('A') + '">A) ' + escapeHtml(q.OptionA) + '</div>' +
      '<div class="' + optCls('B') + '">B) ' + escapeHtml(q.OptionB) + '</div>' +
      '<div class="' + optCls('C') + '">C) ' + escapeHtml(q.OptionC) + '</div>' +
      '<div class="' + optCls('D') + '">D) ' + escapeHtml(q.OptionD) + '</div>' +
      '</div>' +
      '<div class="q-footer">' +
      '<span class="marks">' + q.Marks + ' mark' + (q.Marks === 1 ? '' : 's') + (q.Explanation ? ' · has explanation' : '') + '</span>' +
      '<div class="q-actions">' +
      '<button class="icon-mini" onclick="editQuestion(\'' + escAttr(q.QuestionID) + '\')" title="Edit">✏️</button>' +
      '<button class="icon-mini danger" onclick="deleteQuestionConfirm(\'' + escAttr(q.QuestionID) + '\')" title="Delete">🗑️</button>' +
      '</div>' +
      '</div>';
    box.appendChild(item);
  });
}

function openAddQuestionForm() {
  Sound.click();
  CACHE.editingQuestionId = null;
  document.getElementById('questionFormTitle').textContent = 'ADD QUESTION';
  document.getElementById('questionSaveBtn').textContent = 'Add Question';
  document.getElementById('qText').value = '';
  document.getElementById('qA').value = '';
  document.getElementById('qB').value = '';
  document.getElementById('qC').value = '';
  document.getElementById('qD').value = '';
  document.getElementById('qCorrect').value = 'A';
  document.getElementById('qMarks').value = '1';
  document.getElementById('qExpl').value = '';
  document.getElementById('questionFormWrap').classList.remove('hidden');
  document.getElementById('qText').focus();
}

function closeAddQuestionForm() {
  Sound.click();
  document.getElementById('questionFormWrap').classList.add('hidden');
  CACHE.editingQuestionId = null;
}

function editQuestion(qid) {
  Sound.click();
  callApi('getExamQuestions', { password: ADMIN_PW, examId: CACHE.currentExamId }).then(function (res) {
    if (!res.success) return;
    var q = (res.questions || []).find(function (x) { return String(x.QuestionID) === String(qid); });
    if (!q) return;
    CACHE.editingQuestionId = qid;
    document.getElementById('questionFormTitle').textContent = 'EDIT QUESTION';
    document.getElementById('questionSaveBtn').textContent = 'Save Changes';
    document.getElementById('qText').value = q.QText;
    document.getElementById('qA').value = q.OptionA;
    document.getElementById('qB').value = q.OptionB;
    document.getElementById('qC').value = q.OptionC;
    document.getElementById('qD').value = q.OptionD;
    document.getElementById('qCorrect').value = q.Correct;
    document.getElementById('qMarks').value = q.Marks;
    document.getElementById('qExpl').value = q.Explanation || '';
    document.getElementById('questionFormWrap').classList.remove('hidden');
    document.getElementById('qText').focus();
  });
}

async function saveQuestion() {
  var qText = document.getElementById('qText').value.trim();
  var A = document.getElementById('qA').value.trim();
  var B = document.getElementById('qB').value.trim();
  var C = document.getElementById('qC').value.trim();
  var D = document.getElementById('qD').value.trim();
  var correct = document.getElementById('qCorrect').value;
  var marks = document.getElementById('qMarks').value.trim();
  var expl = document.getElementById('qExpl').value.trim();

  if (!qText || !A || !B || !C || !D) { Toast.error('Fill question + all 4 options'); Sound.error(); return; }

  var payload = {
    password: ADMIN_PW, examId: CACHE.currentExamId,
    qText: qText, optionA: A, optionB: B, optionC: C, optionD: D,
    correct: correct, marks: marks, explanation: expl
  };

  Sound.click(); showLoader();
  var res;
  var wasEditing = !!CACHE.editingQuestionId;
  if (wasEditing) {
    payload.questionId = CACHE.editingQuestionId;
    res = await callApi('updateQuestion', payload);
  } else {
    res = await callApi('addQuestion', payload);
  }
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  Toast.success(wasEditing ? '✓ Question updated' : '✓ Question added');
  closeAddQuestionForm();
  await refreshQuestionList();
}

async function deleteQuestionConfirm(qid) {
  var ok = await showConfirm({ icon: '🗑️', title: 'Delete question?', message: 'This question will be removed permanently.', confirmText: 'Delete' });
  if (!ok) return;
  Sound.click(); showLoader();
  var res = await callApi('deleteQuestion', { password: ADMIN_PW, questionId: qid });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  Toast.success('✓ Question deleted');
  await refreshQuestionList();
}

/* ---------- Bulk Questions ---------- */
function openBulkQuestionsModal() {
  Sound.click();
  document.getElementById('bulkQText').value = '';
  document.getElementById('bulkQFile').value = '';
  document.getElementById('bulkQuestionsModal').classList.add('show');
}
function closeBulkQuestionsModal() {
  Sound.click();
  document.getElementById('bulkQuestionsModal').classList.remove('show');
}
function handleBulkQFile(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function (ev) { document.getElementById('bulkQText').value = ev.target.result; };
  r.readAsText(f);
}
async function submitBulkQuestions() {
  var raw = document.getElementById('bulkQText').value.trim();
  if (!raw) { Toast.error('No data'); return; }
  var lines = raw.split(/\r?\n/).filter(function (l) { return l.trim(); });
  var questions = [];
  lines.forEach(function (line) {
    if (/^question\s*,/i.test(line)) return;
    var parts = [];
    var cur = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { parts.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    parts.push(cur.trim());
    if (parts.length < 6) return;
    questions.push({
      qText: parts[0], optionA: parts[1], optionB: parts[2],
      optionC: parts[3], optionD: parts[4],
      correct: (parts[5] || '').toUpperCase(),
      marks: parts[6] || 1,
      explanation: parts[7] || ''
    });
  });
  if (!questions.length) { Toast.error('No valid rows'); return; }
  Sound.click(); showLoader();
  var res = await callApi('bulkAddQuestions', { password: ADMIN_PW, examId: CACHE.currentExamId, questions: questions });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  closeBulkQuestionsModal();
  Toast.success('✓ Added ' + res.added + ' questions (' + res.skipped + ' skipped)');
  await refreshQuestionList();
}

/* ---------- Results Viewer ---------- */
async function openExamResults(examId) {
  Sound.click();
  document.getElementById('erExamName').textContent = 'Loading…';
  document.getElementById('erExamMeta').textContent = '';
  document.getElementById('erSummary').innerHTML = '';
  document.getElementById('erTableBody').innerHTML = '';
  document.getElementById('examResultsModal').classList.add('show');

  var res = await callApi('getExamResults', { password: ADMIN_PW, examId: examId });
  if (!res.success) { Toast.error(res.message); closeExamResults(); return; }

  CACHE.currentExamResults = res;
  var exam = res.exam || {};
  document.getElementById('erExamName').textContent = '📊 ' + exam.ExamName;
  document.getElementById('erExamMeta').textContent =
    (exam.ExamDate || '—') + ' · Max ' + exam.MaxMarks + ' · Weight ' + exam.Weight + '×';

  var results = res.results || [];
  var missed = res.missed || [];
  var total = results.length;
  var avg = total ? Math.round(results.reduce(function (s, r) { return s + r.percentage; }, 0) / total * 100) / 100 : 0;
  var highest = total ? Math.max.apply(null, results.map(function (r) { return r.percentage; })) : 0;
  var lowest = total ? Math.min.apply(null, results.map(function (r) { return r.percentage; })) : 0;

  document.getElementById('erSummary').innerHTML =
    '<div class="rs-item">Total Attempts<b>' + total + '</b></div>' +
    '<div class="rs-item">Average<b>' + avg + '%</b></div>' +
    '<div class="rs-item">Highest<b>' + highest + '%</b></div>' +
    '<div class="rs-item">Lowest<b>' + lowest + '%</b></div>' +
    '<div class="rs-item">Not Attempted<b>' + missed.length + '</b></div>';

  var body = document.getElementById('erTableBody');
  body.innerHTML = '';
  if (!results.length) {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:22px;">No attempts yet.</td></tr>';
  } else {
    results.forEach(function (r, i) {
      var pctClass = r.percentage >= 75 ? 'high' : r.percentage >= 50 ? 'mid' : 'low';
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="rank-num">#' + (i + 1) + '</td>' +
        '<td>' + escapeHtml(r.studentName) + ' <span style="color:var(--muted);font-size:10.5px;">(' + escapeHtml(r.studentCode) + ')</span></td>' +
        '<td>' + r.score + ' / ' + r.totalMarks + '</td>' +
        '<td class="pct ' + pctClass + '">' + r.percentage + '%</td>' +
        '<td style="font-family:Orbitron,sans-serif;font-size:11px;color:var(--neon);">' + r.weightedScore + '</td>';
      body.appendChild(tr);
    });
  }

  if (missed.length) {
    missed.forEach(function (m) {
      var tr = document.createElement('tr');
      tr.style.opacity = '0.55';
      tr.innerHTML =
        '<td>—</td>' +
        '<td>' + escapeHtml(m.studentName) + ' <span style="color:var(--muted);font-size:10.5px;">(' + escapeHtml(m.studentCode) + ')</span></td>' +
        '<td colspan="3" style="color:var(--muted);font-style:italic;">Not attempted</td>';
      body.appendChild(tr);
    });
  }
}

function closeExamResults() {
  Sound.click();
  document.getElementById('examResultsModal').classList.remove('show');
  CACHE.currentExamResults = null;
}

function exportExamResultsCsv() {
  if (!CACHE.currentExamResults) return;
  var data = CACHE.currentExamResults;
  var rows = [['Rank', 'Student', 'Code', 'Score', 'TotalMarks', 'Percentage', 'WeightedScore']];
  (data.results || []).forEach(function (r, i) {
    rows.push([i + 1, r.studentName, r.studentCode, r.score, r.totalMarks, r.percentage, r.weightedScore]);
  });
  (data.missed || []).forEach(function (m) {
    rows.push(['—', m.studentName, m.studentCode, 'Not attempted', '', '', '']);
  });
  downloadCsv('exam-results-' + (data.exam ? data.exam.ExamID : 'exam') + '.csv', rows);
  Toast.success('✓ Exported');
}

async function loadExamLeaderboard() {
  var box = document.getElementById('examLeaderboardList');
  box.innerHTML = '<div class="empty">Loading…</div>';
  var res = await callApi('getExamLeaderboard', { password: ADMIN_PW });
  if (!res.success) { box.innerHTML = '<div class="empty">' + (res.message || 'Could not load') + '</div>'; return; }
  var list = res.leaderboard || [];
  CACHE.examLeaderboard = list;
  if (!list.length) {
    box.innerHTML = '<div class="empty"><span class="icon">🏆</span>No exam data yet.</div>';
    return;
  }
  box.innerHTML = '';
  var frag = document.createDocumentFragment();
  var shown = 0;
  list.forEach(function (s) {
    if (s.totalWeighted === 0 && s.examsTaken === 0) return;
    shown++;
    var row = document.createElement('div');
    row.className = 'row no-click' + (s.rank <= 4 ? ' top-tier' : '');
    row.innerHTML =
      '<div style="display:flex;align-items:center;gap:14px;min-width:0;">' +
      rankBadgeHtml(s.rank) +
      '<div style="min-width:0;">' +
      '<div class="main">' + escapeHtml(s.name) + '</div>' +
      '<div class="sub">' + escapeHtml(s.code) + ' <span class="dot">·</span> ' + s.examsTaken + ' exam' + (s.examsTaken === 1 ? '' : 's') + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="pts">' + s.totalWeighted + ' PTS</div>';
    frag.appendChild(row);
  });
  if (!shown) {
    box.innerHTML = '<div class="empty"><span class="icon">🏆</span>No exam attempts yet.</div>';
    return;
  }
  box.appendChild(frag);
}

/* =================================================================
 * ================= PHASE 4 — EMAIL NOTIFICATIONS =================
 * ================================================================= */

function openAdminEmailModal() {
  Sound.click();
  document.getElementById('adminEmailInput').value = CACHE.adminEmail || '';
  document.getElementById('adminEmailModal').classList.add('show');
}
function closeAdminEmailModal() {
  Sound.click();
  document.getElementById('adminEmailModal').classList.remove('show');
}
async function saveAdminEmail() {
  var email = document.getElementById('adminEmailInput').value.trim();
  showLoader();
  var res = await callApi('setAdminEmail', { password: ADMIN_PW, email: email });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  CACHE.adminEmail = email;
  closeAdminEmailModal();
  Toast.success('✓ Admin email saved');
}

async function notifyExamPublished(examId) {
  var ok = await showConfirm({
    icon: '📧', title: 'Email all assigned students?',
    message: 'Sab assigned students ko exam ka email jayega. Daily Gmail quota (~100/day) ka dhyaan rakho.',
    confirmText: 'Send Emails'
  });
  if (!ok) return;
  Sound.click(); showLoader();
  var res = await callApi('notifyExamPublished', { password: ADMIN_PW, examId: examId });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  if (res.sent === 0 && res.failed === 0 && res.message) {
    Toast.error(res.message);
  } else {
    Toast.success('✓ Sent: ' + res.sent + ' · Failed: ' + res.failed);
  }
}

async function sendExamResults(examId) {
  var ok = await showConfirm({
    icon: '📧', title: 'Send result emails?',
    message: 'Sab attempted students ko unka result email jayega.',
    confirmText: 'Send Results'
  });
  if (!ok) return;
  Sound.click(); showLoader();
  var res = await callApi('sendExamResults', { password: ADMIN_PW, examId: examId });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  Toast.success('✓ Sent: ' + res.sent + ' · Failed: ' + res.failed);
}

async function testTaskReminder() {
  Sound.click(); showLoader();
  var res = await callApi('sendTaskReminderNow', { password: ADMIN_PW });
  hideLoader();
  if (!res.success) { Toast.error(res.message || 'Failed'); return; }
  if (res.message) Toast.success('✓ ' + res.message);
  else Toast.success('✓ Reminders sent: ' + res.sent + ' · Failed: ' + res.failed);
}

/* =================================================================
 * ================= PHASE 4 — COMMENTS SYSTEM =====================
 * ================================================================= */

function updateCommentsBadge() {
  var badge = document.getElementById('commentsBadge');
  if (!badge) return;
  if (CACHE.pendingComments > 0) {
    badge.textContent = CACHE.pendingComments;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
  var pendingBadge = document.getElementById('pendingBadge');
  if (pendingBadge) {
    if (CACHE.pendingComments > 0) {
      pendingBadge.textContent = CACHE.pendingComments;
      pendingBadge.classList.remove('hidden');
    } else {
      pendingBadge.classList.add('hidden');
    }
  }
}

function setCommentFilter(filter) {
  Sound.click();
  CACHE.commentFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(function (c) {
    c.classList.toggle('active', c.dataset.filter === filter);
  });
  loadComments();
}

async function loadComments() {
  var box = document.getElementById('commentsList');
  if (!box) return;
  box.innerHTML = '<div class="empty">Loading…</div>';

  var res = await callApi('getComments', {
    password: ADMIN_PW,
    filters: { status: CACHE.commentFilter, type: 'all' }
  });
  if (!res.success) { box.innerHTML = '<div class="empty">' + (res.message || 'Error') + '</div>'; return; }

  CACHE.comments = res.comments || [];

  var pendingCount = CACHE.comments.filter(function (c) { return c.status === 'pending'; }).length;
  if (CACHE.commentFilter === 'pending') {
    CACHE.pendingComments = pendingCount;
    updateCommentsBadge();
  }

  if (!CACHE.comments.length) {
    box.innerHTML = '<div class="empty"><span class="icon">💬</span>No comments in this filter.</div>';
    return;
  }

  box.innerHTML = '';
  var frag = document.createDocumentFragment();
  CACHE.comments.forEach(function (c) {
    var card = document.createElement('div');
    card.className = 'comment-card ' + c.status;

    var typeLabel = c.type === 'task' ? '📋 Task' : '📝 Exam';
    var dateStr = '';
    try { dateStr = new Date(c.createdAt).toLocaleString(); } catch (e) { }

    var replyHtml = '';
    if (c.reply) {
      replyHtml = '<div class="comment-reply"><div class="lbl">✓ Your reply</div>' + escapeHtml(c.reply) + '</div>';
    } else {
      replyHtml =
        '<div class="comment-reply-form">' +
        '<textarea id="reply_' + c.commentId + '" placeholder="Type your reply…"></textarea>' +
        '<button onclick="submitReply(\'' + escAttr(c.commentId) + '\')">Send Reply</button>' +
        '</div>';
    }

    card.innerHTML =
      '<div class="comment-head">' +
      '<div class="comment-student">' + escapeHtml(c.studentName) +
      '<span class="code">' + escapeHtml(c.studentCode) + '</span>' +
      '</div>' +
      '<div class="comment-meta">' + escapeHtml(dateStr) + '</div>' +
      '</div>' +
      '<div class="comment-target">' + typeLabel + ' · <b>' + escapeHtml(c.targetName) + '</b></div>' +
      '<div class="comment-message">' + escapeHtml(c.message) + '</div>' +
      replyHtml +
      '<div class="comment-meta" style="margin-top:10px;">' +
      '<span>' + (c.status === 'pending' ? '⏳ Pending' : '✓ Replied') + '</span>' +
      '<button class="icon-mini danger" onclick="deleteComment(\'' + escAttr(c.commentId) + '\')" style="width:auto;padding:3px 9px;font-size:9.5px;">Delete</button>' +
      '</div>';

    frag.appendChild(card);
  });
  box.appendChild(frag);
}

async function submitReply(commentId) {
  var ta = document.getElementById('reply_' + commentId);
  if (!ta) return;
  var reply = ta.value.trim();
  if (!reply) { Toast.error('Reply cannot be empty'); return; }
  Sound.click(); showLoader();
  var res = await callApi('replyComment', { password: ADMIN_PW, commentId: commentId, reply: reply });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  Toast.success('✓ Reply sent');
  loadComments();
}

async function deleteComment(commentId) {
  var ok = await showConfirm({
    icon: '🗑️', title: 'Delete comment?', message: 'Ye permanent hai.', confirmText: 'Delete'
  });
  if (!ok) return;
  Sound.click(); showLoader();
  var res = await callApi('deleteComment', { password: ADMIN_PW, commentId: commentId });
  hideLoader();
  if (!res.success) { Toast.error(res.message); return; }
  Toast.success('✓ Comment deleted');
  loadComments();
}

/* ========== EXPORT ========== */
function downloadCsv(filename, rows) {
  var csv = rows.map(function (r) {
    return r.map(function (c) {
      var s = String(c == null ? '' : c);
      if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(',');
  }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  Sound.success();
}
function exportStudentsCsv() {
  if (!CACHE.students.length) { Toast.error('No students'); return; }
  var rows = [['Code', 'Name', 'Email', 'TotalPoints']];
  CACHE.students.forEach(function (s) { rows.push([s.Code, s.Name, s.Email || '', s.TotalPoints || 0]); });
  downloadCsv('students-' + new Date().toISOString().slice(0, 10) + '.csv', rows);
  Toast.success('✓ Exported ' + CACHE.students.length);
}
function exportLeaderboardCsv() {
  if (!CACHE.lastLeaderboard.length) { Toast.error('No data'); return; }
  var rows = [['Rank', 'Name', 'Code', 'Points']];
  CACHE.lastLeaderboard.forEach(function (s) { rows.push([s.rank, s.name, s.code, s.totalPoints]); });
  downloadCsv('leaderboard-' + new Date().toISOString().slice(0, 10) + '.csv', rows);
  Toast.success('✓ Exported');
}

/* ========== HELPERS ========== */
function rankBadgeHtml(rank) {
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

/* ========== BOOT ========== */
window.addEventListener('load', function () {
  var saved = sessionStorage.getItem('adminPw');
  if (saved) { ADMIN_PW = saved; touchSession(); loadDashboard(); }
  document.getElementById('pwInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLogin();
  });

  ['confirmModal', 'studentModal', 'editStudentModal', 'editTaskModal', 'csvModal',
    'announceModal', 'backupModal', 'changePwModal', 'qrModal', 'cmdPalette',
    'questionsModal', 'bulkQuestionsModal', 'examResultsModal', 'adminEmailModal'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', function (e) {
        if (e.target === this) {
          if (id === 'confirmModal') closeConfirm(false);
          else if (id === 'studentModal') closeStudentModal();
          else if (id === 'editStudentModal') closeEditStudent();
          else if (id === 'editTaskModal') closeEditTask();
          else if (id === 'csvModal') closeCsvImport();
          else if (id === 'announceModal') closeAnnounceModal();
          else if (id === 'backupModal') closeBackupModal();
          else if (id === 'changePwModal') closeChangePw();
          else if (id === 'qrModal') closeQrModal();
          else if (id === 'cmdPalette') closeCommandPalette();
          else if (id === 'questionsModal') closeQuestionsModal();
          else if (id === 'bulkQuestionsModal') closeBulkQuestionsModal();
          else if (id === 'examResultsModal') closeExamResults();
          else if (id === 'adminEmailModal') closeAdminEmailModal();
        }
      });
    });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette();
      return;
    }
    if (e.key === 'Escape') {
      if (document.getElementById('cmdPalette').classList.contains('show')) closeCommandPalette();
      else if (document.getElementById('confirmModal').classList.contains('show')) closeConfirm(false);
      else if (document.getElementById('studentModal').classList.contains('show')) closeStudentModal();
      else if (document.getElementById('editStudentModal').classList.contains('show')) closeEditStudent();
      else if (document.getElementById('editTaskModal').classList.contains('show')) closeEditTask();
      else if (document.getElementById('csvModal').classList.contains('show')) closeCsvImport();
      else if (document.getElementById('announceModal').classList.contains('show')) closeAnnounceModal();
      else if (document.getElementById('backupModal').classList.contains('show')) closeBackupModal();
      else if (document.getElementById('changePwModal').classList.contains('show')) closeChangePw();
      else if (document.getElementById('qrModal').classList.contains('show')) closeQrModal();
      else if (document.getElementById('questionsModal').classList.contains('show')) closeQuestionsModal();
      else if (document.getElementById('bulkQuestionsModal').classList.contains('show')) closeBulkQuestionsModal();
      else if (document.getElementById('examResultsModal').classList.contains('show')) closeExamResults();
      else if (document.getElementById('adminEmailModal').classList.contains('show')) closeAdminEmailModal();
    }
  });

  var cmdInput = document.getElementById('cmdInput');
  if (cmdInput) {
    cmdInput.addEventListener('input', function () {
      var q = cmdInput.value.toLowerCase().trim();
      _cmdFiltered = q ? COMMANDS.filter(function (c) {
        return c.label.toLowerCase().indexOf(q) !== -1 || c.hint.toLowerCase().indexOf(q) !== -1;
      }) : COMMANDS;
      _cmdSelected = 0;
      renderCmdResults();
    });
    cmdInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); _cmdSelected = Math.min(_cmdSelected + 1, _cmdFiltered.length - 1); renderCmdResults(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); _cmdSelected = Math.max(_cmdSelected - 1, 0); renderCmdResults(); }
      else if (e.key === 'Enter') { e.preventDefault(); runCmd(_cmdSelected); }
    });
  }
});