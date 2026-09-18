/*******************************************************
 * EFFECTS.JS — Particles, Confetti, Toast, Sound,
 * Number counter, Theme toggle, Ripple, Rank-up
 *******************************************************/

/* ============ THEME MANAGER ============ */
const ThemeManager = {
  current: localStorage.getItem('theme') || 'dark',
  init() {
    this.apply(this.current);
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.addEventListener('click', () => this.toggle());
    });
  },
  apply(theme) {
    this.current = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.textContent = theme === 'dark' ? '☀' : '☾';
      b.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    });
  },
  toggle() { this.apply(this.current === 'dark' ? 'light' : 'dark'); }
};

/* ============ SOUND (WebAudio — no external files) ============ */
const Sound = {
  enabled: localStorage.getItem('sound') !== 'off',
  ctx: null,
  _getCtx() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  _play(freq, dur, type, gain) {
    if (!this.enabled) return;
    const ctx = this._getCtx(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain || 0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  },
  click()   { this._play(880, 0.05, 'sine', 0.03); },
  success() { this._play(660, 0.1, 'sine', 0.05); setTimeout(()=>this._play(880,0.15,'sine',0.05), 80); },
  rankUp()  {
    this._play(523, 0.12, 'sine', 0.06);
    setTimeout(()=>this._play(659,0.12,'sine',0.06), 100);
    setTimeout(()=>this._play(784,0.18,'sine',0.07), 200);
    setTimeout(()=>this._play(1047,0.28,'sine',0.07), 320);
  },
  error()   { this._play(200, 0.15, 'sawtooth', 0.04); },
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('sound', this.enabled ? 'on' : 'off');
    this._updateBtns();
    if (this.enabled) this.success();
  },
  _updateBtns() {
    document.querySelectorAll('[data-sound-toggle]').forEach(b => {
      b.textContent = this.enabled ? '🔊' : '🔇';
      b.title = this.enabled ? 'Sound on' : 'Sound off';
    });
  },
  initBtns() {
    this._updateBtns();
    document.querySelectorAll('[data-sound-toggle]').forEach(b => {
      b.addEventListener('click', () => this.toggle());
    });
  }
};

/* ============ PARTICLES ============ */
const Particles = {
  canvas: null, ctx: null, particles: [], running: false,
  init() {
    this.canvas = document.getElementById('particles-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    for (let i = 0; i < 55; i++) this.particles.push(this._make());
    this.running = true;
    this._loop();
  },
  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },
  _make() {
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.6 + 0.4,
      a: Math.random() * 0.5 + 0.15,
      hue: Math.random() > 0.5 ? 185 : 260
    };
  },
  _loop() {
    if (!this.ctx || !this.running) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = this.canvas.width;
      if (p.x > this.canvas.width) p.x = 0;
      if (p.y < 0) p.y = this.canvas.height;
      if (p.y > this.canvas.height) p.y = 0;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this.ctx.fillStyle = 'hsla(' + p.hue + ', 90%, 70%, ' + p.a + ')';
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = 'hsla(' + p.hue + ', 90%, 70%, 0.8)';
      this.ctx.fill();
    });
    this.ctx.shadowBlur = 0;
    requestAnimationFrame(() => this._loop());
  }
};

/* ============ CONFETTI ============ */
const Confetti = {
  canvas: null, ctx: null, pieces: [], running: false,
  fire(duration) {
    duration = duration || 3200;
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'confetti-canvas';
      this.canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9998;';
      document.body.appendChild(this.canvas);
    }
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx = this.canvas.getContext('2d');
    this.pieces = [];
    const colors = ['#4ad9e4','#7c5cff','#ffd166','#ff6b9d','#6ee7a0','#ffffff'];
    for (let i = 0; i < 140; i++) {
      this.pieces.push({
        x: Math.random() * this.canvas.width,
        y: -20 - Math.random() * 260,
        vx: (Math.random() - 0.5) * 3.5,
        vy: Math.random() * 3 + 1.8,
        w: Math.random() * 9 + 4,
        h: Math.random() * 7 + 3,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.22,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    const start = Date.now();
    this.running = true;
    const loop = () => {
      if (!this.ctx || !this.running) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vy += 0.02;
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rot);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        this.ctx.restore();
      });
      this.pieces = this.pieces.filter(p => p.y < this.canvas.height + 30);
      if (Date.now() - start < duration && this.pieces.length > 0) {
        requestAnimationFrame(loop);
      } else {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.running = false;
      }
    };
    loop();
  }
};

/* ============ TOAST ============ */
const Toast = {
  _container() {
    let c = document.getElementById('toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      document.body.appendChild(c);
    }
    return c;
  },
  show(msg, type, dur) {
    const t = document.createElement('div');
    t.className = 'toast toast-' + (type || 'info');
    t.innerHTML = msg;
    this._container().appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => {
      t.classList.remove('in');
      setTimeout(() => t.remove(), 400);
    }, dur || 3500);
  },
  success(m){ this.show(m, 'success'); Sound.success(); },
  error(m){ this.show(m, 'error'); Sound.error(); },
  rankUp(m){ this.show(m, 'rankup', 5000); Sound.rankUp(); Confetti.fire(); }
};

/* ============ NUMBER COUNTER ============ */
function animateNumber(el, target, duration) {
  if (!el) return;
  duration = duration || 1300;
  const start = Number(el.textContent) || 0;
  const diff = target - start;
  if (diff === 0) { el.textContent = target; return; }
  const t0 = performance.now();
  const ease = t => t < 0.5 ? 2*t*t : -1 + (4 - 2*t) * t;
  const step = (t) => {
    const p = Math.min((t - t0) / duration, 1);
    el.textContent = Math.round(start + diff * ease(p));
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target;
  };
  requestAnimationFrame(step);
}

/* ============ RIPPLE ============ */
function attachRipple() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, .tab, .radio-opt');
    if (!btn || btn.classList.contains('no-ripple')) return;
    const rect = btn.getBoundingClientRect();
    const r = document.createElement('span');
    r.className = 'ripple';
    r.style.left = (e.clientX - rect.left) + 'px';
    r.style.top = (e.clientY - rect.top) + 'px';
    btn.style.overflow = 'hidden';
    btn.appendChild(r);
    setTimeout(() => r.remove(), 650);
  });
}

/* ============ BOOT ============ */
window.addEventListener('load', () => {
  ThemeManager.init();
  Sound.initBtns();
  Particles.init();
  attachRipple();
});