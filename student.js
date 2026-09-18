// Student page logic

function showLoader() { document.getElementById('loader').classList.remove('hide'); }
function hideLoader() { document.getElementById('loader').classList.add('hide'); }

window.addEventListener('load', function () { setTimeout(hideLoader, 400); });

async function doLogin() {
  const code = document.getElementById('codeInput').value.trim();
  const err = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  err.textContent = '';
  if (!code) { err.textContent = 'Please enter your code.'; return; }

  Sound.click();
  showLoader();
  const res = await withLoading(btn, 'Connecting…', () => callApi('verifyStudent', { code }));
  hideLoader();

  if (!res.success) {
    err.textContent = res.message || 'Something went wrong.';
    Sound.error();
    return;
  }
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

  document.getElementById('studentName').textContent = res.name;
  document.getElementById('studentCode').textContent = res.code;
  const letter = (res.name || '?').charAt(0).toUpperCase();
  document.getElementById('avatarLetter').textContent = letter;

  // Avatar color by rank
  const myRank = (res.leaderboard.find(s => String(s.code) === String(res.code)) || {}).rank || 999;
  const av = document.getElementById('avatarLetter');
  av.classList.remove('rank-1', 'rank-2', 'rank-3', 'rank-other');
  av.classList.add(myRank === 1 ? 'rank-1' : myRank === 2 ? 'rank-2' : myRank === 3 ? 'rank-3' : 'rank-other');

  // Animate number
  animateNumber(document.getElementById('totalPoints'), res.totalPoints, 1400);

  // XP bar
  renderXpBar(res, myRank);

  // Tasks
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = '';
  if (!res.breakdown.length) {
    taskList.innerHTML = '<div class="empty">No tasks assigned to you yet.</div>';
  } else {
    res.breakdown.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'task-row' + (t.done ? ' done' : '');
      row.style.animationDelay = (i * 40) + 'ms';
      const check = t.done ? '<svg class="check" viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : '';
      row.innerHTML =
        '<div style="min-width:0;">' +
        '<div class="t-name">' + check + escapeHtml(t.taskName) + '</div>' +
        (t.videoLink ? '<a class="t-link" href="' + escapeHtml(t.videoLink) + '" target="_blank" rel="noopener">▶ Watch</a>' : '') +
        '</div>' +
        '<div class="t-pts">' + t.points + ' / ' + t.maxPoints + '</div>';
      taskList.appendChild(row);
    });
  }

  // Podium + leaderboard
  renderPodium(res.leaderboard);
  renderLeaderboard(res.leaderboard, res.code);

  // Rank-up detection
  detectRankUp(res.code, myRank);
}

function renderXpBar(res, myRank) {
  const wrap = document.getElementById('xpWrap');
  const fill = document.getElementById('xpFill');
  const target = document.getElementById('xpTarget');
  const caption = document.getElementById('xpCaption');
  if (myRank === 1 || res.leaderboard.length < 2) {
    target.textContent = '👑 #1';
    fill.style.width = '100%';
    caption.innerHTML = 'You are <b>#1</b> — keep it up!';
    return;
  }
  const above = res.leaderboard.find(s => s.rank === myRank - 1);
  if (!above) {
    wrap.classList.add('hidden');
    return;
  }
  const gap = above.totalPoints - res.totalPoints;
  const pct = Math.min(100, Math.max(0, (res.totalPoints / Math.max(above.totalPoints, 1)) * 100));
  target.textContent = '#' + (myRank - 1) + ' · ' + above.totalPoints + ' pts';
  fill.style.width = '0%';
  requestAnimationFrame(() => { fill.style.width = pct + '%'; });
  caption.innerHTML = 'Need <b>' + gap + '</b> more points to reach rank <b>#' + (myRank - 1) + '</b>';
}

function renderPodium(list) {
  const box = document.getElementById('podiumWrap');
  box.innerHTML = '';
  if (!list || list.length < 1) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const order = [2, 1, 3]; // 2nd, 1st, 3rd display
  order.forEach((rank, i) => {
    const s = list.find(x => x.rank === rank);
    if (!s) return;
    const pod = document.createElement('div');
    pod.className = 'pod p' + rank;
    pod.style.animationDelay = (i * 100) + 'ms';
    const badgeImg = rankBadgeImg(s.rank);
    pod.innerHTML =
      (rank === 1 ? '<div class="crown">👑</div>' : '') +
      badgeImg +
      '<div class="pod-name">' + escapeHtml(s.name) + '</div>' +
      '<div class="pod-pts">' + s.totalPoints + ' PTS</div>';
    box.appendChild(pod);
  });
}

function renderLeaderboard(list, myCode) {
  const box = document.getElementById('leaderboardList');
  box.innerHTML = '';
  if (!list || !list.length) {
    box.innerHTML = '<div class="empty">No ranking data yet.</div>';
    return;
  }
  // Show ranks 4+ (podium shows 1-3)
  const rest = list.filter(s => s.rank > 3);
  const prevRanks = JSON.parse(localStorage.getItem('prevRanks') || '{}');

  if (rest.length === 0) {
    box.innerHTML = '<div class="empty">Only the top 3 are on the podium.</div>';
  }

  rest.forEach(s => {
    const isMe = String(s.code) === String(myCode);
    const row = document.createElement('div');
    row.className = 'lb-row' + (isMe ? ' me' : '');
    // Rank change
    let deltaHtml = '';
    const prev = prevRanks[String(s.code)];
    if (prev && prev !== s.rank) {
      const diff = prev - s.rank;
      if (diff > 0) deltaHtml = '<span class="rank-delta up">↑' + diff + '</span>';
      else deltaHtml = '<span class="rank-delta down">↓' + Math.abs(diff) + '</span>';
    }
    row.innerHTML =
      rankBadgeImg(s.rank) +
      '<div class="lb-name">' + escapeHtml(s.name) + deltaHtml + '</div>' +
      '<div class="lb-pts">' + s.totalPoints + ' PTS</div>';
    box.appendChild(row);
  });

  // Save current ranks
  const currentRanks = {};
  list.forEach(s => { currentRanks[String(s.code)] = s.rank; });
  localStorage.setItem('prevRanks', JSON.stringify(currentRanks));
}

function detectRankUp(code, newRank) {
  const key = 'lastRank_' + code;
  const prev = Number(localStorage.getItem(key) || 0);
  localStorage.setItem(key, String(newRank));
  if (prev > 0 && newRank < prev) {
    setTimeout(() => {
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
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

window.addEventListener('load', async () => {
  const saved = sessionStorage.getItem('studentCode');
  if (saved) {
    showLoader();
    const res = await callApi('verifyStudent', { code: saved });
    hideLoader();
    if (res.success) renderDashboard(res);
    else sessionStorage.removeItem('studentCode');
  }
  document.getElementById('codeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});