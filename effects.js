/*******************************************************
 * EFFECTS.JS v2 — PERFORMANCE OPTIMIZED
 * - Particles: 30 max, no shadowBlur, 30fps throttle,
 *   pauses on tab hidden
 * - Confetti: reused canvas, auto cleanup
 * - Toast: capped at 3, transform-only animation
 *******************************************************/

/* ============ THEME ============ */
const ThemeManager = {
    current: localStorage.getItem('theme') || 'dark',
    init() {
        this.apply(this.current);
        document.querySelectorAll('[data-theme-toggle]').forEach(b =>
            b.addEventListener('click', () => this.toggle()));
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

/* ============ SOUND ============ */
const Sound = {
    enabled: localStorage.getItem('sound') !== 'off',
    ctx: null,
    _getCtx() {
        if (!this.ctx) {
            try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
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
    click() { this._play(880, 0.05, 'sine', 0.03); },
    success() { this._play(660, 0.1, 'sine', 0.05); setTimeout(() => this._play(880, 0.15, 'sine', 0.05), 80); },
    rankUp() {
        this._play(523, 0.12, 'sine', 0.06);
        setTimeout(() => this._play(659, 0.12, 'sine', 0.06), 100);
        setTimeout(() => this._play(784, 0.18, 'sine', 0.07), 200);
        setTimeout(() => this._play(1047, 0.28, 'sine', 0.07), 320);
    },
    error() { this._play(200, 0.15, 'sawtooth', 0.04); },
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
        document.querySelectorAll('[data-sound-toggle]').forEach(b =>
            b.addEventListener('click', () => this.toggle()));
    }
};

/* ============ PARTICLES (optimized) ============ */
const Particles = {
    canvas: null, ctx: null, particles: [],
    rafId: 0, lastFrame: 0, targetFps: 30, frameInterval: 1000 / 30,
    visible: true,
    init() {
        if (window.innerWidth < 480 || navigator.hardwareConcurrency <= 2) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        this.canvas = document.getElementById('particles-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d', { alpha: true });
        this.resize();

        const count = Math.min(28, Math.round(window.innerWidth / 55));
        for (let i = 0; i < count; i++) this.particles.push(this._make());

        window.addEventListener('resize', this._onResize.bind(this));
        document.addEventListener('visibilitychange', this._onVisibility.bind(this));

        this._loop(performance.now());
    },
    _onResize() { this.resize(); },
    _onVisibility() {
        this.visible = !document.hidden;
        if (this.visible) this._loop(performance.now());
    },
    resize() {
        if (!this.canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    _make() {
        return {
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.2,
            r: Math.random() * 1.4 + 0.4,
            a: Math.random() * 0.4 + 0.15,
            hue: Math.random() > 0.5 ? 185 : 260
        };
    },
    _loop(now) {
        if (!this.visible || !this.ctx) return;
        this.rafId = requestAnimationFrame(this._loop.bind(this));
        if (now - this.lastFrame < this.frameInterval) return;
        this.lastFrame = now;

        const ctx = this.ctx;
        const w = window.innerWidth, h = window.innerHeight;
        ctx.clearRect(0, 0, w, h);

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy;
            if (p.x < -5) p.x = w + 5; else if (p.x > w + 5) p.x = -5;
            if (p.y < -5) p.y = h + 5; else if (p.y > h + 5) p.y = -5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, 6.28318);
            ctx.fillStyle = 'hsla(' + p.hue + ', 90%, 72%, ' + p.a + ')';
            ctx.fill();
        }
    }
};

/* ============ CONFETTI (reused canvas) ============ */
const Confetti = {
    canvas: null, ctx: null, pieces: [], rafId: 0, endAt: 0,
    fire(duration) {
        duration = duration || 2600;
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'confetti-canvas';
            this.canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9998;';
            document.body.appendChild(this.canvas);
        }
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx = this.canvas.getContext('2d');

        const colors = ['#4ad9e4', '#7c5cff', '#ffd166', '#ff6b9d', '#6ee7a0', '#ffffff'];
        this.pieces = [];
        const pieceCount = window.innerWidth < 480 ? 70 : 110;
        for (let i = 0; i < pieceCount; i++) {
            this.pieces.push({
                x: Math.random() * this.canvas.width,
                y: -20 - Math.random() * 200,
                vx: (Math.random() - 0.5) * 3,
                vy: Math.random() * 3 + 2,
                w: Math.random() * 8 + 4,
                h: Math.random() * 6 + 3,
                rot: Math.random() * 6.283,
                vr: (Math.random() - 0.5) * 0.2,
                color: colors[(Math.random() * colors.length) | 0]
            });
        }
        this.endAt = performance.now() + duration;
        cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame(this._loop.bind(this));
    },
    _loop(now) {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const pieces = this.pieces;
        for (let i = 0; i < pieces.length; i++) {
            const p = pieces[i];
            p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vy += 0.05;
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rot);
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            this.ctx.restore();
        }
        this.pieces = pieces.filter(p => p.y < this.canvas.height + 30);
        if (now < this.endAt && this.pieces.length) {
            this.rafId = requestAnimationFrame(this._loop.bind(this));
        } else {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.rafId = 0;
        }
    }
};

/* ============ TOAST (capped) ============ */
const Toast = {
    _active: [],
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
        while (this._active.length >= 3) {
            const old = this._active.shift();
            if (old && old.parentNode) old.remove();
        }
        const t = document.createElement('div');
        t.className = 'toast toast-' + (type || 'info');
        t.innerHTML = msg;
        this._container().appendChild(t);
        this._active.push(t);
        requestAnimationFrame(() => t.classList.add('in'));
        setTimeout(() => {
            t.classList.remove('in');
            const i = this._active.indexOf(t);
            if (i > -1) this._active.splice(i, 1);
            setTimeout(() => t.remove(), 400);
        }, dur || 3500);
    },
    success(m) { this.show(m, 'success'); Sound.success(); },
    error(m) { this.show(m, 'error'); Sound.error(); },
    rankUp(m) { this.show(m, 'rankup', 5000); Sound.rankUp(); Confetti.fire(); }
};

/* ============ NUMBER COUNTER ============ */
function animateNumber(el, target, duration) {
    if (!el) return;
    duration = duration || 1100;
    const start = Number(el.textContent) || 0;
    const diff = target - start;
    if (diff === 0) { el.textContent = target; return; }
    const t0 = performance.now();
    const ease = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const step = (t) => {
        const p = Math.min((t - t0) / duration, 1);
        el.textContent = Math.round(start + diff * ease(p));
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = target;
    };
    requestAnimationFrame(step);
}

/* ============ RIPPLE (delegated) ============ */
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
        setTimeout(() => r.remove(), 550);
    }, { passive: true });
}

/* ============ DEBOUNCE HELPER ============ */
function debounce(fn, wait) {
    let t;
    return function () {
        const args = arguments, ctx = this;
        clearTimeout(t);
        t = setTimeout(() => fn.apply(ctx, args), wait || 180);
    };
}

/* ============ BOOT ============ */
window.addEventListener('load', () => {
    ThemeManager.init();
    Sound.initBtns();
    Particles.init();
    attachRipple();
}, { once: true });