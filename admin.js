// Admin page logic — uses callApi() from script.js

var ADMIN_PW = '';
var CACHE = { students: [], tasks: [] };

const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

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

window.addEventListener('load', function () {
  setTimeout(hideLoader, 400);
});

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
  renderLeaderboard(res.leaderboard);
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

/* -------- Leaderboard -------- */
function renderLeaderboard(list) {
  var box = document.getElementById('lbList');
  box.innerHTML = '';
  if (!list || list.length === 0) { box.innerHTML = '<div class="empty">No students yet.</div>'; return; }
  list.forEach(function (s) {
    var row = document.createElement('div');
    row.className = 'row' + (s.rank <= 4 ? ' top-tier' : '');
    row.innerHTML =
      '<div style="display:flex;align-items:center;gap:14px;min-width:0;">' +
      rankBadgeHtml(s.rank) +
      '<div style="min-width:0;">' +
      '<div class="main">' + escapeHtml(s.name) + '</div>' +
      '<div class="sub">' + escapeHtml(s.code) + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="pts">' + s.totalPoints + ' PTS</div>';
    box.appendChild(row);
  });
}

/* -------- Students -------- */
function renderStudents(list) {
  var box = document.getElementById('studentList');
  var count = document.getElementById('studentCount');
  box.innerHTML = '';
  count.textContent = (list || []).length;
  if (!list || list.length === 0) { box.innerHTML = '<div class="empty">No students yet.</div>'; return; }
  list.forEach(function (s) {
    var row = document.createElement('div');
    row.className = 'row';
    var meta = escapeHtml(s.Code) +
      (s.Email ? '<span class="dot">·</span>' + escapeHtml(s.Email) : '') +
      '<span class="dot">·</span>' + (s.TotalPoints || 0) + ' pts';
    row.innerHTML =
      '<div style="min-width:0;">' +
      '<div class="main">' + escapeHtml(s.Name) + '</div>' +
      '<div class="sub">' + meta + '</div>' +
      '</div>' +
      '<button class="btn-danger" onclick="removeStudent(\'' + escAttr(s.Code) + '\')">Remove</button>';
    box.appendChild(row);
  });
}

/* -------- Tasks -------- */
function renderTasks(list) {
  var box = document.getElementById('taskList');
  var count = document.getElementById('taskCount');
  box.innerHTML = '';
  count.textContent = (list || []).length;
  if (!list || list.length === 0) { box.innerHTML = '<div class="empty">No tasks yet.</div>'; return; }

  list.forEach(function (t) {
    var row = document.createElement('div');
    row.className = 'row';
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
      '<button class="btn-danger" onclick="removeTask(\'' + escAttr(t.TaskID) + '\')">Remove</button>';
    box.appendChild(row);
  });
}

/* -------- Dropdowns -------- */
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

/* -------- Student picker -------- */
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

/* -------- Actions -------- */
async function addStudent() {
  var code = document.getElementById('sCode').value.trim();
  var name = document.getElementById('sName').value.trim();
  var email = document.getElementById('sEmail').value.trim();
  var msg = document.getElementById('studentMsg');
  msg.textContent = '';
  if (!code || !name) { msg.className = 'error'; msg.textContent = 'Code and name are required.'; Sound.error(); return; }

  Sound.click();
  showLoader();
  var res = await callApi('addStudent', { password: ADMIN_PW, code: code, name: name, email: email });
  hideLoader();
  touchSession();

  if (!res.success) {
    msg.className = 'error';
    msg.textContent = res.message || 'Could not add student.';
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
  if (!confirm('Remove this student? Their scores will remain in the Scores sheet.')) return;
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
      msg.className = 'error';
      msg.textContent = 'Select at least one student.';
      Sound.error();
      return;
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
    msg.className = 'error';
    msg.textContent = res.message || 'Could not create task.';
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
  if (!confirm('Remove this task? Existing scores for it will remain in the Scores sheet.')) return;
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
    msg.className = 'error';
    msg.textContent = 'Fill in all fields.';
    Sound.error();
    return;
  }

  Sound.click();
  showLoader();
  var res = await callApi('assignPoints', {
    password: ADMIN_PW, studentCode: student, taskId: task, points: points
  });
  hideLoader();
  touchSession();

  if (!res.success) {
    msg.className = 'error';
    msg.textContent = res.message || 'Could not save.';
    Toast.error('✗ ' + (res.message || 'Could not save.'));
    return;
  }

  msg.className = '';
  Toast.success('✓ Points saved · Leaderboard updated');
  document.getElementById('pPoints').value = '';
  renderLeaderboard(res.leaderboard);
  loadDashboard();
}

/* -------- Rank badge helper -------- */
function rankBadgeHtml(rank) {
  if (rank >= 1 && rank <= 4) {
    return '<div class="rank-badge img">' +
      '<img src="rank-' + rank + '.png" alt="Rank ' + rank + '" loading="lazy" ' +
      'onerror="this.parentNode.classList.remove(\'img\');this.parentNode.textContent=\'' + rank + '\';">' +
      '</div>';
  }
  return '<div class="rank-badge">' + rank + '</div>';
}

/* -------- Utilities -------- */
function escapeHtml(str) {
  var d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}
function escAttr(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/* -------- Boot -------- */
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
});