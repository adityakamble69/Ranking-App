// Student page logic — uses callApi() from script.js

function showLoader(){ document.getElementById('loader').classList.remove('hide'); }
function hideLoader(){ document.getElementById('loader').classList.add('hide'); }

window.addEventListener('load', function(){
  setTimeout(hideLoader, 400);
});

async function doLogin(){
  var code = document.getElementById('codeInput').value.trim();
  var err = document.getElementById('loginError');
  var btn = document.getElementById('loginBtn');
  err.textContent = '';
  if(!code){ err.textContent = 'Please enter your code.'; return; }

  showLoader();
  var res = await withLoading(btn, 'Connecting…', function(){
    return callApi('verifyStudent', { code: code });
  });
  hideLoader();

  if(!res.success){ err.textContent = res.message || 'Something went wrong.'; return; }
  sessionStorage.setItem('studentCode', code);
  renderDashboard(res);
}

function doLogout(){
  sessionStorage.removeItem('studentCode');
  document.getElementById('dashView').classList.add('hidden');
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('codeInput').value = '';
  document.getElementById('loginError').textContent = '';
}

function renderDashboard(res){
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('dashView').classList.remove('hidden');

  document.getElementById('studentName').textContent = res.name;
  document.getElementById('studentCode').textContent = res.code;
  document.getElementById('avatarLetter').textContent = (res.name || '?').charAt(0).toUpperCase();
  document.getElementById('totalPoints').textContent = res.totalPoints;

  var taskList = document.getElementById('taskList');
  taskList.innerHTML = '';
  if(res.breakdown.length === 0){
    taskList.innerHTML = '<div class="empty">No tasks assigned to you yet.</div>';
  }
  res.breakdown.forEach(function(t){
    var row = document.createElement('div');
    row.className = 'task-row' + (t.done ? ' done' : '');
    row.innerHTML =
      '<div style="min-width:0;">' +
        '<div class="t-name">' + escapeHtml(t.taskName) + '</div>' +
        (t.videoLink ? '<a class="t-link" href="' + escapeHtml(t.videoLink) + '" target="_blank" rel="noopener">▶ Watch</a>' : '') +
      '</div>' +
      '<div class="t-pts">' + t.points + ' / ' + t.maxPoints + '</div>';
    taskList.appendChild(row);
  });

  renderLeaderboard(res.leaderboard, res.code);
}

function renderLeaderboard(list, myCode){
  var box = document.getElementById('leaderboardList');
  box.innerHTML = '';
  if(!list || list.length === 0){
    box.innerHTML = '<div class="empty">No ranking data yet.</div>';
    return;
  }
  list.forEach(function(s){
    var isMe = String(s.code) === String(myCode);
    var row = document.createElement('div');
    row.className = 'lb-row'
      + (isMe ? ' me' : '')
      + (s.rank <= 4 ? ' top-tier' : '');
    row.innerHTML =
      rankBadgeHtml(s.rank) +
      '<div class="lb-name">' + escapeHtml(s.name) + '</div>' +
      '<div class="lb-pts">' + s.totalPoints + ' PTS</div>';
    box.appendChild(row);
  });
}

function rankBadgeHtml(rank){
  if (rank >= 1 && rank <= 4) {
    return '<div class="rank-badge img">' +
             '<img src="rank-' + rank + '.png" alt="Rank ' + rank + '" loading="lazy" ' +
                  'onerror="this.parentNode.classList.remove(\'img\');this.parentNode.textContent=\'' + rank + '\';">' +
           '</div>';
  }
  return '<div class="rank-badge">' + rank + '</div>';
}

function escapeHtml(str){
  var d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

window.addEventListener('load', async function(){
  var saved = sessionStorage.getItem('studentCode');
  if(saved){
    showLoader();
    var res = await callApi('verifyStudent', { code: saved });
    hideLoader();
    if(res.success) renderDashboard(res);
  }
  document.getElementById('codeInput').addEventListener('keydown', function(e){
    if(e.key === 'Enter') doLogin();
  });
});