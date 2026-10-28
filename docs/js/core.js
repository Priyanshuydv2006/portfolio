// Shared state, data loading and rendering. Everything user-provided is inserted with
// textContent / setAttribute, never innerHTML, so edited content cannot inject markup.

export const API = (document.querySelector('meta[name="api-base"]')?.content || '/api').replace(/\/$/, '');
const SVG_NS = 'http://www.w3.org/2000/svg';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') for (const [a, b] of Object.entries(v)) el.style.setProperty(a, b);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export function icon(name, cls = '') {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('class', `i ${cls}`.trim());
  const u = document.createElementNS(SVG_NS, 'use');
  u.setAttribute('href', `#i-${name}`);
  s.append(u);
  return s;
}

/* -------------------------------------------------------------------- state */

export const state = {
  defaults: {}, // text found in the HTML at load time; used when nothing is saved
  content: {}, // overrides saved from the admin panel
  skills: [], projects: [], certificates: [], timeline: [],
  filter: 'all', certTab: 'all', loaded: false,
};
export const merged = () => ({ ...state.defaults, ...state.content });
export const t = (key) => merged()[key] ?? '';
const on = (c, key) => (c[key] ?? 'true') !== 'false';

export function captureDefaults() {
  for (const el of $$('[data-c]')) state.defaults[el.dataset.c] = el.textContent.trim();
  for (const el of $$('[data-c-placeholder]')) state.defaults[el.dataset.cPlaceholder] = el.getAttribute('placeholder') || '';
  state.defaults['meta.title'] = document.title;
  state.defaults['meta.description'] = $('meta[name="description"]')?.content || '';
  state.defaults['theme.accent'] = '#D8B45A';
  state.defaults['theme.signal'] = '#6FD3FF';
}

/* --------------------------------------------------------------------- urls */

export function safeUrl(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '';
  if (/^@[\w.]+$/.test(s)) return `https://instagram.com/${s.slice(1)}`;
  return `https://${s}`;
}
export const mediaUrl = (id, download = false) => (id ? `${API}/media/${id}${download ? '?download=1' : ''}` : '');

function linkLabel(kind, url) {
  if (kind === 'email') return url.replace(/^mailto:/i, '');
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean).pop() || u.hostname.replace(/^www\./, '');
    return kind === 'linkedin' && !seg ? u.hostname : `@${seg}`;
  } catch {
    return url;
  }
}

/* ------------------------------------------------------------------ content */

export function applyContent() {
  const c = merged();

  for (const el of $$('[data-c]')) {
    if (el.dataset.dirty || (el.isContentEditable && el === document.activeElement)) continue; // never overwrite text being edited
    const v = c[el.dataset.c];
    if (v != null && el.textContent !== v) el.textContent = v;
  }
  for (const el of $$('[data-c-placeholder]')) el.setAttribute('placeholder', c[el.dataset.cPlaceholder] ?? '');
  for (const el of $$('[data-c-show]')) el.hidden = !on(c, el.dataset.cShow);

  // Section visibility toggles (hides the section and its menu links)
  for (const id of ['about', 'resume', 'projects', 'certificates', 'contact']) {
    const show = on(c, `section.${id}.visible`);
    $(`[data-section="${id}"]`)?.toggleAttribute('hidden', !show);
    $$(`[data-nav="${id}"], [data-section-link="${id}"]`).forEach((a) => a.toggleAttribute('hidden', !show));
  }

  // Theme + page meta
  const root = document.documentElement.style;
  const hex = /^#[0-9a-f]{6}$/i;
  if (hex.test(c['theme.accent'])) root.setProperty('--accent', c['theme.accent']);
  if (hex.test(c['theme.signal'])) root.setProperty('--signal', c['theme.signal']);
  document.title = c['meta.title'] || document.title;
  $('meta[name="description"]')?.setAttribute('content', c['meta.description'] || '');
  window.dispatchEvent(new CustomEvent('pf-theme'));

  // Contact links: shown only when a value is saved
  let hasEmail = false;
  for (const el of $$('[data-c-href]')) {
    const key = el.dataset.cHref;
    const raw = (c[key] || '').trim();
    const kind = el.dataset.kind || key.split('.').pop();
    const isEmail = key === 'contact.email';
    const href = isEmail ? (raw ? `mailto:${raw}` : '') : safeUrl(raw);
    if (isEmail && raw) hasEmail = true;
    el.toggleAttribute('hidden', !href);
    if (href) el.setAttribute('href', href);
    else el.removeAttribute('href');
    const label = el.querySelector('[data-label]') || (el.hasAttribute('data-label') ? el : null);
    if (label && href) label.textContent = linkLabel(isEmail ? 'email' : kind, isEmail ? raw : href);
  }
  $('#factEmail')?.toggleAttribute('hidden', !hasEmail);

  // Resume button
  const resumeId = c['resume.media'];
  $('#resumeCta')?.toggleAttribute('hidden', !resumeId);
  if (resumeId) $('#resumeLink')?.setAttribute('href', mediaUrl(resumeId, true));

  $('#footText').textContent = (c['footer.text'] || '').replace('{year}', new Date().getFullYear());

  renderHeroChips();
  window.dispatchEvent(new CustomEvent('pf-roles', { detail: roles() }));
}

export const roles = () => t('hero.roles').split('|').map((s) => s.trim()).filter(Boolean);

function renderHeroChips() {
  const box = $('#heroChips');
  const list = t('hero.skills').split(',').map((s) => s.trim()).filter(Boolean);
  box.replaceChildren(...list.map((s) => h('span', { class: 'chip' }, s)));
  box.hidden = !list.length;
}

/* -------------------------------------------------------------------- lists */

const ART_SVG = `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" fill="none" stroke-width="1.6" aria-hidden="true">
<path d="M0 40h90l20 20h60l20-20h130"/><path d="M0 100h60l30 30h80l30-30h120"/><path d="M0 160h130l20-20h40l20 20h110"/>
<path d="M110 60v40M170 60v40M190 130v30M90 130v-30"/><circle cx="90" cy="40" r="4"/><circle cx="170" cy="60" r="4"/><circle cx="190" cy="130" r="4"/><circle cx="110" cy="60" r="4"/></svg>`;

export function art(gradient, id) {
  const n = [...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 3;
  const el = h('div', { class: `art ${['gold', 'cyan', 'green', 'violet'].includes(gradient) ? gradient : 'gold'} v${n}` });
  el.insertAdjacentHTML('beforeend', ART_SVG); // constant markup, no user data
  return el;
}

export function renderMarquee() {
  const names = state.skills.map((s) => s.name);
  const list = names.length ? names : t('hero.skills').split(',').map((s) => s.trim()).filter(Boolean);
  const track = $('#marqueeTrack');
  if (!list.length) return track.replaceChildren();
  let half = [...list];
  while (half.length < 14) half = half.concat(list);
  const group = () => half.map((n) => h('span', { class: 'marquee-item' }, n));
  track.replaceChildren(...group(), ...group());
}

export function renderStack() {
  const box = $('#stackGroups');
  if (!state.skills.length) return box.replaceChildren();
  const groups = new Map();
  for (const s of state.skills) {
    const k = s.category || '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }
  box.replaceChildren(
    ...[...groups].map(([cat, items]) =>
      h('div', { class: 'stack-group' },
        cat ? h('h4', {}, cat) : null,
        h('div', { class: 'chips' },
          items.map((s) =>
            h('span', { class: 'chip skill', dataset: { list: 'skills', id: s.id }, style: s.level ? { '--lv': `${s.level}%`, 'padding-bottom': '9px' } : {} },
              s.name, s.level ? h('span', { class: 'bar' }, h('i')) : null)
          )))
    )
  );
}

export function renderTimeline() {
  const box = $('#timeline');
  if (!state.timeline.length) return box.replaceChildren();
  box.replaceChildren(
    ...state.timeline.map((x, i) =>
      h('article', { class: 't-item reveal', style: { '--i': Math.min(i, 4) }, dataset: { list: 'timeline', id: x.id } },
        x.date ? h('small', {}, x.date) : null,
        h('h3', {}, x.title),
        x.subtitle ? h('div', { class: 'sub' }, x.subtitle) : null,
        x.content ? h('p', {}, x.content) : null)
    )
  );
}

export function renderProjects() {
  const grid = $('#projectGrid');
  const filters = $('#projectFilters');
  filters.hidden = !state.projects.length;
  for (const b of $$('.tab', filters)) b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter));
  const list = state.projects.filter((p) => state.filter === 'all' || p.status === state.filter);
  $('#projectEmpty').hidden = list.length > 0;
  grid.replaceChildren(
    ...list.map((p, i) =>
      h('button', { class: 'card reveal', type: 'button', style: { '--i': Math.min(i, 6) }, dataset: { list: 'projects', id: p.id } },
        h('div', { class: 'thumb' },
          p.image_id ? h('img', { src: mediaUrl(p.image_id), alt: '', loading: 'lazy', decoding: 'async' }) : art(p.gradient, p.id),
          h('span', { class: `status ${p.status === 'Completed' ? 'done' : 'wip'}` }, p.status === 'Completed' ? t('projects.filter.completed') : t('projects.filter.progress'))),
        h('div', { class: 'card-body' },
          p.date ? h('time', {}, p.date) : null,
          h('h3', {}, p.title),
          p.description ? h('p', {}, p.description) : null,
          p.tags?.length ? h('div', { class: 'chips' }, p.tags.slice(0, 4).map((x) => h('span', { class: 'chip' }, x))) : null,
          h('span', { class: 'more' }, t('projects.card.cta'), icon('arrow'))))
    )
  );
}

export function renderCerts() {
  const grid = $('#certGrid');
  const tabs = $('#certTabs');
  const cats = [...new Set(state.certificates.map((c) => c.category).filter(Boolean))];
  if (state.certTab !== 'all' && !cats.includes(state.certTab)) state.certTab = 'all';
  tabs.hidden = cats.length < 2;
  tabs.replaceChildren(
    ...(cats.length < 2 ? [] : ['all', ...cats]).map((c) =>
      h('button', { class: 'tab', type: 'button', 'aria-pressed': String(c === state.certTab), dataset: { tab: c } }, c === 'all' ? t('certificates.all') : c))
  );
  const list = state.certificates.filter((c) => state.certTab === 'all' || c.category === state.certTab);
  $('#certEmpty').hidden = list.length > 0;
  grid.replaceChildren(
    ...list.map((c, i) =>
      h('button', { class: 'card cert reveal', type: 'button', style: { '--i': Math.min(i, 6) }, dataset: { list: 'certificates', id: c.id } },
        h('div', { class: 'thumb' },
          c.image_id ? h('img', { src: mediaUrl(c.image_id), alt: c.title, loading: 'lazy', decoding: 'async' }) : h('div', { class: 'noimg' }, icon('image'))),
        h('div', { class: 'card-body' },
          h('h3', {}, c.title),
          h('time', {}, [c.issuer, c.date].filter(Boolean).join(' · '))))
    )
  );
}

export function renderAll() {
  applyContent();
  renderMarquee();
  renderStack();
  renderTimeline();
  renderProjects();
  renderCerts();
  window.dispatchEvent(new CustomEvent('pf-rendered'));
}

/* --------------------------------------------------------------------- data */

const CACHE_KEY = 'pf-site-v2';

export function setSite(data, { cache = true } = {}) {
  state.content = data.content || {};
  state.skills = data.skills || [];
  state.projects = data.projects || [];
  state.certificates = data.certificates || [];
  state.timeline = data.timeline || [];
  state.loaded = true;
  renderAll();
  if (cache) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* storage may be unavailable */ }
  }
}

export function cachedSite() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}

export async function fetchSite({ fresh = false } = {}) {
  const res = await fetch(`${API}/site${fresh ? `?fresh=${Date.now()}` : ''}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function refreshSite() {
  setSite(await fetchSite({ fresh: true }));
}

/* ------------------------------------------------------------------- toasts */

let toastTimer;
export function toast(text, { spin = false, action, ms = 0 } = {}) {
  const el = $('#toast');
  clearTimeout(toastTimer);
  $('#toastText').textContent = text;
  $('#toastSpin').hidden = !spin;
  const btn = $('#toastBtn');
  btn.hidden = !action;
  if (action) { btn.textContent = action.label; btn.onclick = action.run; }
  el.classList.add('show');
  if (ms) toastTimer = setTimeout(hideToast, ms);
}
export function hideToast() { $('#toast').classList.remove('show'); }
