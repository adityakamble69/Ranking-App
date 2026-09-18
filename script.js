/*******************************************************
 * SHARED CONFIG + API HELPER
 *******************************************************/
const API_URL = "https://script.google.com/macros/s/AKfycbwK1CBHWNDO0MXyoapwtzR0X-Mlb6vuaWPwcajI8SAZWpU9mI7-qy8P0-noa34Ljn79EQ/exec";

const API_TIMEOUT_MS = 45000;
const API_RETRY_ONCE = true;

async function callApi(action, payload) {
  if (!API_URL || API_URL.indexOf('PASTE_YOUR') !== -1) {
    return { success: false, message: "API_URL not set yet — paste your deployed Web App URL into script.js" };
  }

  const body = JSON.stringify({ action: action, payload: payload || {} });

  try {
    const res = await fetchWithTimeout(API_URL, { method: "POST", body: body, redirect: "follow" }, API_TIMEOUT_MS);
    if (!res.ok) return { success: false, message: "Server returned " + res.status + ". Please try again." };
    const text = await res.text();
    if (!text || !text.trim()) return { success: false, message: "Empty response. Try again." };
    if (text.trim().charAt(0) !== '{') return { success: false, message: "Server busy. Try again." };
    let data;
    try { data = JSON.parse(text); } catch(e) { return { success: false, message: "Bad response. Try again." }; }
    if (typeof data !== 'object' || data === null) return { success: false, message: "Unexpected response." };
    return data;
  } catch (err) {
    const writeActions = ['assignPoints','addStudent','addTask','deleteStudent','deleteTask'];
    if (API_RETRY_ONCE && isNetworkError(err) && writeActions.indexOf(action) === -1) {
      await sleep(800);
      return callApiOnce(body);
    }
    if (err && err.name === 'AbortError') return { success: false, message: "Request timed out. Try again." };
    return { success: false, message: "Network error. Check your connection." };
  }
}

async function callApiOnce(body) {
  try {
    const res = await fetchWithTimeout(API_URL, { method: "POST", body: body, redirect: "follow" }, API_TIMEOUT_MS);
    if (!res.ok) return { success: false, message: "Server error." };
    const text = await res.text();
    if (!text || text.trim().charAt(0) !== '{') return { success: false, message: "Bad response." };
    return JSON.parse(text);
  } catch (err) {
    return { success: false, message: "Network error after retry." };
  }
}

function fetchWithTimeout(url, options, timeoutMs) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    fetch(url, Object.assign({}, options, { signal: controller.signal }))
      .then(res => { clearTimeout(timer); resolve(res); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
}

function isNetworkError(err) {
  if (!err) return false;
  if (err.name === 'AbortError') return false;
  if (err.name === 'TypeError') return true;
  if (err.message && /network|failed to fetch|load failed/i.test(err.message)) return true;
  return false;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function withLoading(btn, loadingText, fn) {
  if (!btn) return fn();
  const original = btn.textContent;
  btn.disabled = true;
  if (loadingText) btn.textContent = loadingText;
  try { return await fn(); }
  finally { btn.disabled = false; btn.textContent = original; }
}