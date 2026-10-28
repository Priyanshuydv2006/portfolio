// Visual effects: PCB background, oscilloscope, typing line, reveals, tilt cards, nav.
// Everything degrades to a static page when the visitor prefers reduced motion.
import { $, $$ } from './core.js';

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ------------------------------------------------------- PCB trace background */

export function initBackground() {
  const canvas = $('#bg');
  const ctx = canvas.getContext('2d');
  const layer = document.createElement('canvas'); // traces are drawn once, pulses animate on top
  const lctx = layer.getContext('2d');
  let w = 0, h = 0, dpr = 1, paths = [], pulses = [], running = true, last = 0;

  const rnd = (a, b) => a + Math.random() * (b - a);

  function build() {
    const accent = cssVar('--accent') || '#d8b45a';
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    w = innerWidth; h = innerHeight;
    for (const c of [canvas, layer]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.clearRect(0, 0, w, h);

    const g = 44, cols = Math.ceil(w / g), rows = Math.ceil(h / g);
    const count = clamp(Math.floor((w * h) / 48000), 12, 56);
    paths = [];
    for (let i = 0; i < count; i++) {
      let x = Math.floor(rnd(0, cols)), y = Math.floor(rnd(0, rows));
      const pts = [[x * g, y * g]];
      let dir = Math.random() < 0.5 ? 'h' : 'v';
      const segs = 3 + Math.floor(Math.random() * 4);
      for (let s = 0; s < segs; s++) {
        const len = 2 + Math.floor(Math.random() * 6);
        const sign = Math.random() < 0.5 ? -1 : 1;
        if (dir === 'h') x += sign * len; else y += sign * len;
        pts.push([x * g, y * g]);
        if (Math.random() < 0.55) { // 45 degree bend, like real routing
          const d = 1 + Math.floor(Math.random() * 3);
          const sx = Math.random() < 0.5 ? -1 : 1, sy = Math.random() < 0.5 ? -1 : 1;
          x += sx * d; y += sy * d;
          pts.push([x * g, y * g]);
        }
        dir = dir === 'h' ? 'v' : 'h';
      }
      paths.push(pts);
    }

    lctx.lineJoin = 'round'; lctx.lineCap = 'round';
    for (const pts of paths) {
      lctx.beginPath();
      pts.forEach(([px, py], i) => (i ? lctx.lineTo(px, py) : lctx.moveTo(px, py)));
      lctx.strokeStyle = hexA(accent, 0.11);
      lctx.lineWidth = 1.6;
      lctx.stroke();
      for (const [px, py] of [pts[0], pts[pts.length - 1]]) { // pads
        lctx.beginPath(); lctx.arc(px, py, 4.5, 0, 6.283);
        lctx.strokeStyle = hexA(accent, 0.2); lctx.lineWidth = 1.4; lctx.stroke();
        lctx.beginPath(); lctx.arc(px, py, 1.6, 0, 6.283);
        lctx.fillStyle = hexA(accent, 0.3); lctx.fill();
      }
    }
    pulses = Array.from({ length: clamp(Math.floor(count * 0.7), 8, 30) }, () => newPulse());
    draw(0);
  }

  function newPulse() {
    const pi = Math.floor(Math.random() * paths.length);
    const pts = paths[pi];
    let total = 0;
    const segs = [];
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      segs.push(l); total += l;
    }
    return { pi, segs, total, d: rnd(-total, 0), speed: rnd(60, 130), signal: Math.random() < 0.4 };
  }

  function pointAt(p, d) {
    const pts = paths[p.pi];
    let rem = d;
    for (let i = 0; i < p.segs.length; i++) {
      if (rem <= p.segs[i]) {
        const t = p.segs[i] ? rem / p.segs[i] : 0;
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
      }
      rem -= p.segs[i];
    }
    return pts[pts.length - 1];
  }

  function draw(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(layer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const accent = cssVar('--accent') || '#d8b45a';
    const signal = cssVar('--signal') || '#6fd3ff';
    for (let i = 0; i < pulses.length; i++) {
      const p = pulses[i];
      p.d += p.speed * dt;
      if (p.d > p.total + 40) { pulses[i] = newPulse(); pulses[i].d = -20; continue; }
      if (p.d < 0) continue;
      const col = p.signal ? signal : accent;
      for (let k = 0; k < 7; k++) { // fading tail
        const dd = p.d - k * 7;
        if (dd < 0 || dd > p.total) continue;
        const [x, y] = pointAt(p, dd);
        ctx.beginPath(); ctx.arc(x, y, 2.4 - k * 0.25, 0, 6.283);
        ctx.fillStyle = hexA(col, 0.9 - k * 0.12);
        ctx.shadowColor = col; ctx.shadowBlur = k === 0 ? 14 : 0;
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
  }

  function frame(ts) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (ts - last < 32) return; // about 30 fps is plenty for a background
    const dt = Math.min((ts - last) / 1000, 0.1);
    last = ts;
    draw(dt);
  }

  let resizeT;
  addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      // Mobile browsers fire resize when the URL bar hides; ignore small height changes.
      if (Math.abs(innerWidth - w) > 1 || Math.abs(innerHeight - h) > 150) build();
    }, 200);
  });
  addEventListener('pf-theme', () => { clearTimeout(resizeT); resizeT = setTimeout(build, 60); });
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden && !reduceMotion;
    if (running) requestAnimationFrame(frame);
  });

  build();
  if (reduceMotion) running = false; else requestAnimationFrame(frame);
}

function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(216,180,90,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ------------------------------------------------------------- oscilloscope */

export function initScope() {
  const screen = $('#scopeScreen');
  const canvas = $('#scopeCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const WAVES = [
    ['SINE', (p) => Math.sin(p * 6.2832)],
    ['SQUARE', (p) => Math.tanh(Math.sin(p * 6.2832) * 14)],
    ['TRIANGLE', (p) => (2 / Math.PI) * Math.asin(Math.sin(p * 6.2832))],
    ['SAWTOOTH', (p) => 2 * (p - Math.floor(p + 0.5))],
  ];
  let wave = 0, cycles = 2.4, amp = 0.55, tCycles = 2.4, tAmp = 0.55, phase = 0, W = 0, H = 0, visible = true, last = 0, touched = 0;

  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#03100c'; ctx.fillRect(0, 0, W, H);
  }
  new ResizeObserver(() => { size(); if (reduceMotion) render(0); }).observe(canvas);

  function grid(signal) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexA(signal, 0.1);
    ctx.beginPath();
    for (let i = 1; i < 10; i++) { const x = (W / 10) * i; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let i = 1; i < 8; i++) { const y = (H / 8) * i; ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    ctx.strokeStyle = hexA(signal, 0.26);
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.beginPath(); // minor ticks on the centre lines
    for (let i = 0; i < 50; i++) { const x = (W / 50) * i; ctx.moveTo(x, H / 2 - 3); ctx.lineTo(x, H / 2 + 3); }
    for (let i = 0; i < 40; i++) { const y = (H / 40) * i; ctx.moveTo(W / 2 - 3, y); ctx.lineTo(W / 2 + 3, y); }
    ctx.stroke();
  }

  function trace(fn, color, a, ph, width, glow) {
    ctx.beginPath();
    const steps = Math.min(420, W);
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * W;
      const v = fn((i / steps) * cycles + ph);
      const y = H / 2 - v * amp * (H / 2) * 0.86;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = hexA(color, a);
    ctx.lineWidth = width; ctx.lineJoin = 'round';
    ctx.shadowColor = color; ctx.shadowBlur = glow;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function render(dt) {
    const signal = cssVar('--signal') || '#6fd3ff';
    const accent = cssVar('--accent') || '#d8b45a';
    if (!touched || performance.now() - touched > 2500) { // drift on its own when nobody is touching it
      const s = performance.now() / 1000;
      tCycles = 2.4 + Math.sin(s * 0.35) * 1.3; tAmp = 0.55 + Math.sin(s * 0.5 + 1) * 0.18;
    }
    cycles += (tCycles - cycles) * Math.min(1, dt * 6);
    amp += (tAmp - amp) * Math.min(1, dt * 6);
    phase += dt * (0.35 + cycles * 0.12);

    ctx.fillStyle = reduceMotion ? '#03100c' : 'rgba(3,16,12,0.24)'; // phosphor persistence
    ctx.fillRect(0, 0, W, H);
    grid(signal);
    const fn = WAVES[wave][1];
    trace((p) => fn(p + 0.25), accent, 0.5, -phase * 0.8, 1.4, 6); // ghost channel
    trace(fn, signal, 1, -phase, 2.2, 14);

    $('#roFreq').textContent = `${(cycles * 0.5).toFixed(2)} kHz`;
    $('#roAmp').textContent = `${(amp * 6).toFixed(1)} Vpp`;
    $('#roWave').textContent = WAVES[wave][0];
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    const dt = Math.min((ts - last) / 1000, 0.1);
    last = ts;
    render(dt);
  }

  const point = (e) => {
    const r = screen.getBoundingClientRect();
    tCycles = 1 + clamp((e.clientX - r.left) / r.width, 0, 1) * 6.5;
    tAmp = 0.15 + (1 - clamp((e.clientY - r.top) / r.height, 0, 1)) * 0.7;
    touched = performance.now();
    if (reduceMotion) { cycles = tCycles; amp = tAmp; render(0); }
  };
  screen.addEventListener('pointermove', point);
  screen.addEventListener('pointerdown', point);
  screen.addEventListener('click', () => { wave = (wave + 1) % WAVES.length; if (reduceMotion) render(0); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(screen);

  size();
  if (reduceMotion) render(0); else requestAnimationFrame(loop);
}

/* ---------------------------------------------------------------- typing line */

let typing = { list: [], gen: 0 };
export function setRoles(list) {
  const el = $('#typed');
  if (!el) return;
  typing = { list, gen: typing.gen + 1 };
  const gen = typing.gen;
  if (!list.length) { el.textContent = ''; return; }
  if (reduceMotion || list.length === 1) { el.textContent = list[0]; return; }
  let i = 0, n = 0, del = false;
  const step = () => {
    if (gen !== typing.gen) return; // superseded by a newer list
    const word = list[i % list.length];
    if (!del) {
      n++; el.textContent = word.slice(0, n);
      if (n === word.length) { del = true; return setTimeout(step, 1700); }
      setTimeout(step, 55 + Math.random() * 40);
    } else {
      n--; el.textContent = word.slice(0, n);
      if (n === 0) { del = false; i++; return setTimeout(step, 350); }
      setTimeout(step, 26);
    }
  };
  step();
}

/* ------------------------------------------------------------------- reveals */

let io;
export function observeReveals(root = document) {
  io ??= new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  for (const el of $$('.reveal:not(.in)', root)) io.observe(el);
}

/* ------------------------------------------------------- nav, progress, glow */

export function initPage() {
  const nav = $('#nav');
  const bar = $('#progress');
  const tl = $('#timeline');
  let ticking = false;

  const onScroll = () => {
    ticking = false;
    const y = scrollY;
    nav.classList.toggle('scrolled', y > 10);
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
    if (tl) {
      const r = tl.getBoundingClientRect();
      tl.style.setProperty('--fill', clamp((innerHeight * 0.65 - r.top) / Math.max(r.height, 1), 0, 1).toFixed(3));
    }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  // Active menu link follows the section in view
  const links = new Map($$('[data-nav]').map((a) => [a.dataset.nav, a]));
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a, id) => a.classList.toggle('active', id === e.target.id));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  for (const id of links.keys()) { const s = document.getElementById(id); if (s) spy.observe(s); }

  // Mobile menu
  const burger = $('#burger');
  const setOpen = (o) => { nav.classList.toggle('open', o); burger.setAttribute('aria-expanded', String(o)); };
  burger.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  $('#navLinks').addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  if (!finePointer || reduceMotion) return;

  const glow = $('#cursorGlow');
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    glow.classList.add('on');
    glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  }, { passive: true });
  document.addEventListener('pointerleave', () => glow.classList.remove('on'));

  // Magnetic buttons
  document.addEventListener('pointermove', (e) => {
    const b = e.target.closest?.('[data-magnetic]');
    if (!b) return;
    const r = b.getBoundingClientRect();
    b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.28}px)`;
  });
  document.addEventListener('pointerout', (e) => {
    const b = e.target.closest?.('[data-magnetic]');
    if (b && !b.contains(e.relatedTarget)) b.style.transform = '';
  });

  // Spotlight + tilt on cards
  for (const grid of [$('#projectGrid'), $('#certGrid')]) {
    grid.addEventListener('pointermove', (e) => {
      const c = e.target.closest('.card');
      if (!c || e.pointerType !== 'mouse') return;
      const r = c.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      c.style.setProperty('--mx', `${px * 100}%`);
      c.style.setProperty('--my', `${py * 100}%`);
      c.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 7}deg) rotateY(${(px - 0.5) * 9}deg) translateY(-4px)`;
    });
    grid.addEventListener('pointerout', (e) => {
      const c = e.target.closest('.card');
      if (c && !c.contains(e.relatedTarget)) c.style.transform = '';
    });
  }
}
