// Admin page logic — v3.0 (performance optimized)

var ADMIN_PW = '';
var CACHE = { students: [], tasks: [], lastLeaderboard: [] };

const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

function showLoader() { document.getElementById('loader').classList.remove('hide'); }
function hideLoader() { document.getElementById('loader').classList.add('hide'); }

function touchSession() {
  sessionStorage.setItem('adminLastActivity', String(Date.now()));
}

function checkSession() {
  var last = Number(sessionStorage.getItem('adminLastActivity') || 0);
  if (last && Date.now() - last > SESSION_TIMEOUT_MS) {
    doLogout();
    Toast.error('⏱ Session expired. Please sign in again.');
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

  Sound.click();
  showLoader();
  var res = await withLoading(btn, 'Authenticating…', function () {
    return callApi('adminLogin', { password: pw });
  });
  hideLoader();

  if (!res.success) {
    err.textContent = 'Incorrect password. Try again.';
    Sound.error();
    return;
  }
  ADMIN_PW = pw;
  sessionStorage.setItem('adminPw', pw);
  touchSession();
  Sound.success();
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
    document.getElementById('loginError').textContent = 'Session expired. Please sign in again.';
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

  renderStats();
  renderLeaderboard(CACHE.lastLeaderboard);
  renderStudents(CACHE.students);
  renderTasks(CACHE.tasks);
  renderStudentPicker();
  fillDropdowns();
}

function switchTab(name) {
  Sound.click();
  document.querySelectorAll('.tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  ['rank', 'points', 'students', 'tasks'].forEach(function (t) {
    document.getElementById('tab-' + t).classList.toggle('hidden', t !== name);
  });
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

  document.getElementById('statStudentsSub').textContent = students.length === 1 ? '1 enrolled' : students.length + ' enrolled';
  document.getElementById('statTasksSub').textContent = tasks.length === 1 ? '1 created' : tasks.length + ' created';
}

/* ========== LEADERBOARD ========== */
function renderLeaderboard(list) {
  var box = document.getElementById('lbList');
  box.innerHTML = '';
  if (!list || list.length === 0) {
    box.innerHTML = '<div class="empty"><span class="icon">🏆</span>No students yet.<br><span style="font-size:11.5px;opacity:0.7;">Add students in the Students tab.</span></div>';
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
    box.innerHTML = '<div class="empty"><span class="icon">👥</span>No students registered yet.<br><span style="font-size:11.5px;opacity:0.7;">Use the form above to add your first student.</span></div>';
    return;
  }
  var frag = document.createDocumentFragment();
  list.forEach(function (s) {
    var row = document.createElement('div');
    row.className = 'row no-click';
    var emailBit = s.Email ? '<span class="dot">·</span>' + escapeHtml(s.Email) : '';
    var codeChip = '<span class="copy-chip" data-code="' + escAttr(s.Code) + '" title="Click to copy">' + escapeHtml(s.Code) + '</span>';
    row.innerHTML =
      '<div style="min-width:0;flex:1;">' +
      '<div class="main">' + escapeHtml(s.Name) + '</div>' +
      '<div class="sub">' + codeChip + emailBit + '<span class="dot">·</span>' + (s.TotalPoints || 0) + ' pts</div>' +
      '</div>' +
      '<div class="right">' +
      '<button class="btn-danger" data-remove-student="' + escAttr(s.Code) + '">Remove</button>' +
      '</div>';
    frag.appendChild(row);
  });
  box.appendChild(frag);
  box.querySelectorAll('[data-remove-student]').forEach(function (b) {
    b.onclick = function (e) { e.stopPropagation(); removeStudent(b.getAttribute('data-remove-student')); };
  });
  box.querySelectorAll('.copy-chip').forEach(function (c) {
    c.onclick = function (e) { e.stopPropagation(); copyToClipboard(c.getAttribute('data-code')); };
  });
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

/* ========== TASKS ========== */
function renderTasks(list) {
  var box = document.getElementById('taskList');
  var count = document.getElementById('taskCount');
  box.innerHTML = '';
  count.textContent = (list || []).length;
  if (!list || list.length === 0) {
    box.innerHTML = '<div class="empty"><span class="icon">📋</span>No tasks created yet.<br><span style="font-size:11.5px;opacity:0.7;">Use the form above to create your first task.</span></div>';
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
    row.innerHTML =
      '<div style="min-width:0;flex:1;">' +
      '<div class="main">' + escapeHtml(t.TaskName) + '</div>' +
      '<div class="sub">Max ' + t.MaxPoints + ' pts</div>' +
      '<div style="margin-top:4px;">' + chipHtml + '</div>' +
      '</div>' +
      '<div class="right">' +
      '<button class="btn-danger" data-remove-task="' + escAttr(t.TaskID) + '">Remove</button>' +
      '</div>';
    frag.appendChild(row);
  });
  box.appendChild(frag);
  box.querySelectorAll('[data-remove-task]').forEach(function (b) {
    b.onclick = function () { removeTask(b.getAttribute('data-remove-task')); };
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

/* ========== DEBOUNCED WRAPPERS ========== */
const debouncedFilterStudents = debounce(filterStudents, 180);
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

/* ========== STUDENT PICKER ========== */
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

/* ========== AUTO-GENERATE CODE ========== */
function generateCode() {
  Sound.click();
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  document.getElementById('sCode').value = code;
  Toast.success('🎲 Generated: ' + code);
}

/* ========== COPY TO CLIPBOARD ========== */
function copyToClipboard(text) {
  Sound.click();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      Toast.success('📋 Copied: ' + text);
    }).catch(function () {
      Toast.error('Could not copy.');
    });
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

/* ========== STUDENT DETAIL MODAL ========== */
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
      bd.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted);font-size:12px;">Could not load breakdown.</div>';
      return;
    }
    if (!res.breakdown || !res.breakdown.length) {
      bd.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted);font-size:12px;">No tasks assigned.</div>';
      return;
    }
    bd.innerHTML = res.breakdown.map(function (t) {
      return '<div class="bd-row">' +
        '<div class="bd-name">' + (t.done ? '✓ ' : '○ ') + escapeHtml(t.taskName) + '</div>' +
        '<div class="bd-pts">' + t.points + '/' + t.maxPoints + '</div>' +
        '</div>';
    }).join('');
  });
}
function closeStudentModal() {
  Sound.click();
  document.getElementById('studentModal').classList.remove('show');
}

/* ========== ACTIONS ========== */
async function addStudent() {
  var code = document.getElementById('sCode').value.trim();
  var name = document.getElementById('sName').value.trim();
  var email = document.getElementById('sEmail').value.trim();
  var msg = document.getElementById('studentMsg');
  msg.textContent = '';
  if (!code || !name) {
    msg.className = 'error'; msg.textContent = 'Code and name are required.';
    Sound.error(); return;
  }

  Sound.click();
  showLoader();
  var res = await callApi('addStudent', { password: ADMIN_PW, code: code, name: name, email: email });
  hideLoader();
  touchSession();

  if (!res.success) {
    msg.className = 'error'; msg.textContent = res.message || 'Could not add student.';
    Toast.error('✗ ' + (res.message || 'Could not add student.'));
    return;
  }
  msg.className = '';
  if (email) {
    Toast.success(res.emailSent
      ? '✓ Student added — code emailed to ' + email
      : '✓ Student added (email could not be sent)');
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
    icon: '🗑️',
    title: 'Remove student?',
    message: 'This will remove "' + code + '" from the Students sheet. Their scores will remain in the Scores sheet.',
    confirmText: 'Remove'
  });
  if (!ok) return;
  Sound.click();
  showLoader();
  await callApi('deleteStudent', { password: ADMIN_PW, code: code });
  await loadDashboard();
  hideLoader();
  touchSession();
  Toast.success('✓ Student removed');
}

async function addTask() {
  var name = document.getElementById('tName').value.trim();
  var link = document.getElementById('tLink').value.trim();
  var max = document.getElementById('tMax').value.trim();
  var msg = document.getElementById('taskMsg');
  msg.textContent = '';
  if (!name) { msg.className = 'error'; msg.textContent = 'Task name is required.'; Sound.error(); return; }

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

  Sound.click();
  showLoader();
  var res = await callApi('addTask', {
    password: ADMIN_PW, taskName: name, videoLink: link,
    maxPoints: max, assignedTo: assignedTo
  });
  hideLoader();
  touchSession();

  if (!res.success) {
    msg.className = 'error'; msg.textContent = res.message || 'Could not create task.';
    Toast.error('✗ ' + (res.message || 'Could not create task.'));
    return;
  }
  msg.className = '';
  Toast.success('✓ Task created — ' + name);
  document.getElementById('tName').value = '';
  document.getElementById('tLink').value = '';
  document.getElementById('tMax').value = '';
  document.querySelectorAll('#studentPickList input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });
  loadDashboard();
}

async function removeTask(taskId) {
  var ok = await showConfirm({
    icon: '🗑️',
    title: 'Remove task?',
    message: 'This will remove the task from the Tasks sheet. Existing scores for it will remain in the Scores sheet.',
    confirmText: 'Remove'
  });
  if (!ok) return;
  Sound.click();
  showLoader();
  await callApi('deleteTask', { password: ADMIN_PW, taskId: taskId });
  await loadDashboard();
  hideLoader();
  touchSession();
  Toast.success('✓ Task removed');
}

async function assignPoints() {
  var student = document.getElementById('pStudent').value;
  var task = document.getElementById('pTask').value;
  var points = document.getElementById('pPoints').value.trim();
  var msg = document.getElementById('pointsMsg');
  msg.textContent = '';
  if (!student || !task || points === '') {
    msg.className = 'error'; msg.textContent = 'Fill in all fields.';
    Sound.error(); return;
  }

  Sound.click();
  showLoader();
  var res = await callApi('assignPoints', {
    password: ADMIN_PW, studentCode: student, taskId: task, points: points
  });
  hideLoader();
  touchSession();

  if (!res.success) {
    msg.className = 'error'; msg.textContent = res.message || 'Could not save.';
    Toast.error('✗ ' + (res.message || 'Could not save.'));
    return;
  }
  msg.className = '';
  Toast.success('✓ Points saved · Leaderboard updated');
  document.getElementById('pPoints').value = '';
  loadDashboard();
}

/* ========== EXPORT CSV ========== */
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
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  Sound.success();
}

function exportStudentsCsv() {
  if (!CACHE.students.length) { Toast.error('No students to export.'); return; }
  var rows = [['Code', 'Name', 'Email', 'TotalPoints']];
  CACHE.students.forEach(function (s) {
    rows.push([s.Code, s.Name, s.Email || '', s.TotalPoints || 0]);
  });
  var d = new Date().toISOString().slice(0, 10);
  downloadCsv('students-' + d + '.csv', rows);
  Toast.success('✓ Exported ' + CACHE.students.length + ' students');
}

function exportLeaderboardCsv() {
  if (!CACHE.lastLeaderboard.length) { Toast.error('No leaderboard data.'); return; }
  var rows = [['Rank', 'Name', 'Code', 'Points']];
  CACHE.lastLeaderboard.forEach(function (s) {
    rows.push([s.rank, s.name, s.code, s.totalPoints]);
  });
  var d = new Date().toISOString().slice(0, 10);
  downloadCsv('leaderboard-' + d + '.csv', rows);
  Toast.success('✓ Leaderboard exported');
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
  if (saved) {
    ADMIN_PW = saved;
    touchSession();
    loadDashboard();
  }
  document.getElementById('pwInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('confirmModal').addEventListener('click', function (e) {
    if (e.target === this) closeConfirm(false);
  });
  document.getElementById('studentModal').addEventListener('click', function (e) {
    if (e.target === this) closeStudentModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (document.getElementById('confirmModal').classList.contains('show')) closeConfirm(false);
      if (document.getElementById('studentModal').classList.contains('show')) closeStudentModal();
    }
  });
});