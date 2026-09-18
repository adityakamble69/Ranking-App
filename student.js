// Student page logic — v4.0

function showLoader() { document.getElementById('loader').classList.remove('hide'); }
function hideLoader() { document.getElementById('loader').classList.add('hide'); }

window.addEventListener('load', function () { setTimeout(hideLoader, 400); });

async function doLogin() {
  var code = document.getElementById('codeInput').value.trim();
  var err = document.getElementById('loginError');
  var btn = document.getElementById('loginBtn');
  err.textContent = '';
  if (!code) { err.textContent = 'Please enter your code.'; return; }

  Sound.click();
  showLoader();
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

  // Announcement
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
        '<div style="min-width:0;">' +
        '<div class="t-name">' + check + escapeHtml(t.taskName) + dueBit + '</div>' +
        (t.videoLink ? '<a class="t-link" href="' + escapeHtml(t.videoLink) + '" target="_blank" rel="noopener">▶ Watch</a>' : '') +
        '</div>' +
        '<div class="t-pts">' + t.points + ' / ' + t.maxPoints + '</div>';
      taskList.appendChild(row);
    });
  }

  renderPodium(res.leaderboard);
  renderLeaderboard(res.leaderboard, res.code);
  detectRankUp(res.code, myRank);
}

function renderXpBar(res, myRank) {
  var wrap = document.getElementById('xpWrap');
  var fill = document.getElementById('xpFill');
  var target = document.getElementById('xpTarget');
  var caption = document.getElementById('xpCaption');
  if (myRank === 1 || res.leaderboard.length < 2) {
    target.textContent = '👑 #1';
    fill.style.width = '100%';
    caption.innerHTML = 'You are <b>#1</b> — keep it up!';
    return;
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
    pod.innerHTML =
      (rank === 1 ? '<div class="crown">👑</div>' : '') +
      rankBadgeImg(s.rank) +
      '<div class="pod-name">' + escapeHtml(s.name) + '</div>' +
      '<div class="pod-pts">' + s.totalPoints + ' PTS</div>';
    box.appendChild(pod);
  });
}

function renderLeaderboard(list, myCode) {
  var box = document.getElementById('leaderboardList');
  box.innerHTML = '';
  if (!list || !list.length) {
    box.innerHTML = '<div class="empty">No ranking data yet.</div>';
    return;
  }
  var rest = list.filter(function (s) { return s.rank > 3; });
  var prevRanks = JSON.parse(localStorage.getItem('prevRanks') || '{}');

  if (rest.length === 0) {
    box.innerHTML = '<div class="empty">Only the top 3 are on the podium.</div>';
  }

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
    row.innerHTML =
      rankBadgeImg(s.rank) +
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
    setTimeout(function () {
      Toast.rankUp('🎉 <b>Rank up!</b> You moved from #' + prev + ' → #' + newRank);
    }, 700);
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
});