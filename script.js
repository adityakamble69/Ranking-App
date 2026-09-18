/*******************************************************
 * SHARED CONFIG + API HELPER
 * Used by both index.html (student) and admin.html (admin)
 *
 * >>> PASTE YOUR DEPLOYED GAS WEB APP URL BELOW <<<
 *******************************************************/
const API_URL = "https://script.google.com/macros/s/AKfycbwK1CBHWNDO0MXyoapwtzR0X-Mlb6vuaWPwcajI8SAZWpU9mI7-qy8P0-noa34Ljn79EQ/exec";

const API_TIMEOUT_MS = 45000;
const API_RETRY_ONCE = true;

async function callApi(action, payload) {
  if (!API_URL || API_URL.indexOf('PASTE_YOUR') !== -1) {
    console.error('[callApi] API_URL not configured');
    return { success: false, message: "API_URL not set yet — paste your deployed Web App URL into script.js" };
  }

  const body = JSON.stringify({ action: action, payload: payload || {} });
  const startedAt = Date.now();

  try {
    const res = await fetchWithTimeout(API_URL, {
      method: "POST",
      body: body,
      redirect: "follow"
    }, API_TIMEOUT_MS);

    if (!res.ok) {
      console.error('[callApi] HTTP', res.status, action);
      return {
        success: false,
        message: "Server returned " + res.status + ". Please try again in a moment."
      };
    }

    const text = await res.text();

    if (!text || !text.trim()) {
      console.error('[callApi] Empty response for', action);
      return { success: false, message: "Server returned an empty response. Please try again." };
    }

    if (text.trim().charAt(0) !== '{') {
      console.error('[callApi] Non-JSON response for', action, text.slice(0, 200));
      return {
        success: false,
        message: "Server is busy or misconfigured. Please try again, or contact your teacher."
      };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.error('[callApi] JSON parse failed for', action, parseErr);
      return { success: false, message: "Could not read server response. Please try again." };
    }

    if (typeof data !== 'object' || data === null) {
      return { success: false, message: "Unexpected response from server." };
    }

    console.log('[callApi]', action, '→', data.success ? 'OK' : 'FAIL', (Date.now() - startedAt) + 'ms');
    return data;

  } catch (err) {
    var writeActions = ['assignPoints', 'addStudent', 'addTask', 'deleteStudent', 'deleteTask'];
    if (API_RETRY_ONCE && isNetworkError(err) && writeActions.indexOf(action) === -1) {
      console.warn('[callApi] Retrying', action, 'after network error');
      await sleep(800);
      return callApiOnce(action, body, startedAt);
    }

    console.error('[callApi] Error for', action, err);

    if (err && err.name === 'AbortError') {
      return { success: false, message: "Request timed out. Please check your connection and try again." };
    }
    return { success: false, message: "Network error. Check your internet connection and try again." };
  }
}

async function callApiOnce(action, body, startedAt) {
  try {
    const res = await fetchWithTimeout(API_URL, {
      method: "POST", body: body, redirect: "follow"
    }, API_TIMEOUT_MS);
    if (!res.ok) return { success: false, message: "Server returned " + res.status + "." };
    const text = await res.text();
    if (!text || text.trim().charAt(0) !== '{') return { success: false, message: "Bad response from server." };
    return JSON.parse(text);
  } catch (err) {
    console.error('[callApi retry] failed', err);
    return { success: false, message: "Network error after retry. Please try again." };
  }
}

function fetchWithTimeout(url, options, timeoutMs) {
  return new Promise(function(resolve, reject) {
    const controller = new AbortController();
    const timer = setTimeout(function() { controller.abort(); }, timeoutMs);

    fetch(url, Object.assign({}, options, { signal: controller.signal }))
      .then(function(res) { clearTimeout(timer); resolve(res); })
      .catch(function(err) { clearTimeout(timer); reject(err); });
  });
}

function isNetworkError(err) {
  if (!err) return false;
  if (err.name === 'AbortError') return false;
  if (err.name === 'TypeError') return true;
  if (err.message && /network|failed to fetch|load failed/i.test(err.message)) return true;
  return false;
}

function sleep(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}

async function withLoading(btn, loadingText, fn) {
  if (!btn) return fn();
  const original = btn.textContent;
  btn.disabled = true;
  if (loadingText) btn.textContent = loadingText;
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}