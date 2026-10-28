// Admin tools. Loaded only after login or on #admin, so visitors never download this file.
//  1. "Edit text": click any phrase on the page and type.
//  2. Admin panel: every field (text, links, colours, show/hide), plus skills, projects,
//     certificates, journey, inbox and resume.
import { $, $$, API, h, icon, state, merged, mediaUrl, refreshSite, toast, hideToast } from './core.js';

const TOKEN_KEY = 'pf-token';
const getToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
const setToken = (v) => { try { v ? sessionStorage.setItem(TOKEN_KEY, v) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } };

let schema = null;
let bar = null;
let panel = null;
let activeTab = 'content';
let unread = 0;
const pending = new Map(); // inline edits waiting for Save: key -> text

/* ---------------------------------------------------------------------- api */

async function api(path, { method = 'GET', body, raw, headers = {} } = {}) {
  const opts = { method, headers: { Authorization: `Bearer ${getToken()}`, ...headers } };
  if (raw) opts.body = raw;
  else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { setToken(''); throw new Error(data.error || 'Please log in again.'); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function loadSchema() {
  schema ??= await (await fetch(`${API}/schema`)).json();
  return schema;
}

/* -------------------------------------------------------------------- start */

export async function start() {
  if (!$('link[data-admin-css]')) {
    document.head.append(h('link', { rel: 'stylesheet', href: new URL('../css/admin.css', import.meta.url).href, 'data-admin-css': '' }));
  }
  if (bar) return;
  if (getToken()) {
    try {
      await api('/auth/verify');
      return mountBar();
    } catch { /* token expired: fall through to the login box */ }
  }
  if (location.hash === '#admin') showLogin();
}

function showLogin() {
  const err = h('p', { class: 'a-error', role: 'alert' });
  const input = h('input', { class: 'a-input', type: 'password', autocomplete: 'current-password', placeholder: 'Admin password', required: true, 'aria-label': 'Admin password' });
  const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Log in');
  const dlg = h('dialog', { class: 'admin-login' },
    h('form', { class: 'a-sheet a-login', onsubmit: async (e) => {
      e.preventDefault();
      btn.disabled = true; err.textContent = '';
      try {
        const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: input.value }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Login failed.');
        setToken(d.token);
        history.replaceState(null, '', location.pathname + location.search);
        dlg.close(); dlg.remove();
        mountBar();
      } catch (ex) {
        err.textContent = ex.message; input.select();
      } finally { btn.disabled = false; }
    } },
      h('h3', {}, 'Admin login'),
      h('p', { class: 'a-muted' }, 'Edit every word, project and certificate on this site.'),
      input, err,
      h('div', { class: 'a-row' }, h('button', { class: 'btn', type: 'button', onclick: () => { dlg.close(); dlg.remove(); history.replaceState(null, '', location.pathname + location.search); } }, 'Cancel'), btn)));
  document.body.append(dlg);
  dlg.showModal();
  input.focus();
}

function logout() {
  setToken('');
  location.hash = '';
  location.reload();
}

/* ------------------------------------------------------------------ toolbar */

function mountBar() {
  const saveBtn = h('button', { class: 'a-btn primary', type: 'button', id: 'aSave', disabled: true, onclick: saveInline }, 'Save changes');
  const editBtn = h('button', { class: 'a-btn', type: 'button', 'aria-pressed': 'false', id: 'aEdit', onclick: () => setEditing(!document.body.classList.contains('editing')) }, icon('pencil'), 'Edit text');
  const panelBtn = h('button', { class: 'a-btn', type: 'button', id: 'aPanel', onclick: () => openPanel() }, icon('sliders'), 'Admin panel', h('span', { class: 'a-dot', id: 'aDot', hidden: true }));
  bar = h('div', { class: 'a-bar', id: 'adminBar', role: 'toolbar', 'aria-label': 'Admin tools' },
    editBtn, saveBtn, panelBtn, h('button', { class: 'a-btn ghost', type: 'button', onclick: logout }, 'Log out'));
  document.body.append(bar);

  document.addEventListener('click', onEditClick, true);
  document.addEventListener('keydown', (e) => {
    if (document.body.classList.contains('editing') && e.key === 'Enter' && e.target.closest?.('[data-c]')) { e.preventDefault(); e.target.blur(); }
  });
  document.addEventListener('paste', (e) => {
    if (!document.body.classList.contains('editing') || !e.target.closest?.('[data-c]')) return;
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\s*\n\s*/g, ' '));
  });
  addEventListener('beforeunload', (e) => { if (pending.size) { e.preventDefault(); e.returnValue = ''; } });
  refreshUnread();
}

async function refreshUnread() {
  try {
    const msgs = await api('/messages');
    unread = msgs.filter((m) => !m.is_read).length;
    const dot = $('#aDot');
    if (dot) { dot.hidden = !unread; dot.textContent = unread; }
  } catch { /* not critical */ }
}

/* -------------------------------------------------------------- inline edit */

function editable() {
  return $$('[data-c]').filter((el) => !el.closest('#strings') && !el.closest('dialog'));
}

function setEditing(on) {
  document.body.classList.toggle('editing', on);
  $('#aEdit').setAttribute('aria-pressed', String(on));
  for (const el of editable()) {
    if (!on) { el.removeAttribute('contenteditable'); el.removeEventListener('input', onInline); continue; }
    el.setAttribute('contenteditable', 'plaintext-only');
    if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true'); // Firefox before v136
    el.spellcheck = true;
    el.addEventListener('input', onInline);
  }
  if (on) toast('Click any text to edit it. Click a project, certificate or timeline card to edit it. Then press Save changes.', { ms: 6000 });
  else hideToast();
}

function onInline(e) {
  const el = e.currentTarget;
  el.dataset.dirty = '1';
  pending.set(el.dataset.c, el.textContent.replace(/\s+/g, ' ').trim());
  updateSave();
}

function updateSave() {
  const b = $('#aSave');
  if (!b) return;
  b.disabled = pending.size === 0;
  b.textContent = pending.size ? `Save changes (${pending.size})` : 'Save changes';
}

async function saveInline() {
  const changes = {};
  for (const [k, v] of pending) changes[k] = v === state.defaults[k] ? null : v;
  try {
    await api('/content', { method: 'PUT', body: { changes } });
    for (const el of $$('[data-dirty]')) delete el.dataset.dirty;
    pending.clear();
    updateSave();
    await refreshSite();
    if (document.body.classList.contains('editing')) setEditing(true);
    toast('Saved. Visitors see the change within about 30 seconds.', { ms: 3500 });
  } catch (err) { toast(err.message, { ms: 5000 }); }
}

function onEditClick(e) {
  if (!document.body.classList.contains('editing')) return;
  if (e.target.closest('#adminBar, dialog, #toast')) return;
  if (e.target.closest('[data-c]')) { e.preventDefault(); e.stopImmediatePropagation(); return; }
  const card = e.target.closest('[data-list]');
  if (card) { e.preventDefault(); e.stopImmediatePropagation(); openEditor(card.dataset.list, card.dataset.id); }
}

/* -------------------------------------------------------------------- panel */

const TABS = [
  ['content', 'Text & links'], ['skills', 'Skills'], ['projects', 'Projects'],
  ['certificates', 'Certificates'], ['timeline', 'Journey'], ['inbox', 'Inbox'], ['files', 'Resume'],
];

function openPanel(tab) {
  if (tab) activeTab = tab;
  if (!panel) {
    panel = h('dialog', { class: 'admin-panel' },
      h('div', { class: 'a-sheet a-wide' },
        h('div', { class: 'a-head' }, h('h3', {}, 'Admin panel'),
          h('button', { class: 'a-x', type: 'button', 'aria-label': 'Close', onclick: () => panel.close() }, icon('x'))),
        h('div', { class: 'a-tabs', role: 'tablist' }),
        h('div', { class: 'a-body', id: 'aBody' })));
    panel.addEventListener('click', (e) => { if (e.target === panel) panel.close(); });
    document.body.append(panel);
  }
  if (!panel.open) panel.showModal();
  renderTab();
}

async function renderTab() {
  if (!panel?.open) return;
  const tabs = $('.a-tabs', panel);
  tabs.replaceChildren(...TABS.map(([id, label]) =>
    h('button', { class: 'a-tab', type: 'button', role: 'tab', 'aria-selected': String(id === activeTab), onclick: () => { activeTab = id; renderTab(); } },
      label, id === 'inbox' && unread ? h('span', { class: 'a-count' }, unread) : null)));
  const body = $('#aBody', panel);
  body.replaceChildren(h('p', { class: 'a-muted' }, 'Loading…'));
  try {
    const view = activeTab === 'content' ? await contentView()
      : activeTab === 'inbox' ? await inboxView()
      : activeTab === 'files' ? filesView()
      : listView(activeTab);
    body.replaceChildren(view);
  } catch (err) { body.replaceChildren(h('p', { class: 'a-error' }, err.message)); }
}

/* ------------------------------------------------- tab: text, links, colours */

async function contentView() {
  await loadSchema();
  const edits = new Map(); // key -> new value, or null to reset to default
  const saveBtn = h('button', { class: 'a-btn primary', type: 'button', disabled: true }, 'Save changes');
  const current = (def) => state.content[def.key] ?? state.defaults[def.key] ?? def.default;
  const mark = () => { saveBtn.disabled = !edits.size; saveBtn.textContent = edits.size ? `Save ${edits.size} change${edits.size > 1 ? 's' : ''}` : 'Save changes'; };

  const groups = new Map();
  for (const def of schema) {
    if (!groups.has(def.group)) groups.set(def.group, []);
    groups.get(def.group).push(def);
  }
  const rows = [];

  const makeField = (def) => {
    let input;
    const set = (v) => {
      const base = state.defaults[def.key] ?? def.default;
      if (String(v) === String(state.content[def.key] ?? base)) edits.delete(def.key); else edits.set(def.key, v);
      row.classList.toggle('changed', edits.has(def.key));
      mark();
    };
    if (def.type === 'toggle') {
      input = h('input', { type: 'checkbox', checked: current(def) !== 'false', onchange: (e) => set(e.target.checked ? 'true' : 'false') });
    } else if (def.type === 'color') {
      const hex = h('input', { class: 'a-input mono', value: current(def), maxlength: 7, 'aria-label': `${def.label} hex` });
      const pick = h('input', { type: 'color', value: current(def), 'aria-label': def.label });
      pick.addEventListener('input', () => { hex.value = pick.value.toUpperCase(); set(hex.value); });
      hex.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) { pick.value = hex.value; set(hex.value); } });
      input = h('div', { class: 'a-color' }, pick, hex);
    } else if (def.type === 'textarea') {
      input = h('textarea', { class: 'a-input', rows: 3, maxlength: 4000, oninput: (e) => set(e.target.value) });
      input.value = current(def);
    } else {
      input = h('input', { class: 'a-input', type: 'text', maxlength: 4000, oninput: (e) => set(e.target.value) });
      input.value = current(def);
    }
    const reset = h('button', { class: 'a-link', type: 'button', title: 'Go back to the original text', onclick: () => {
      edits.set(def.key, null);
      if (def.type === 'toggle') input.checked = def.default !== 'false';
      else if (def.type === 'color') { const [p, x] = input.children; p.value = x.value = def.default; }
      else input.value = state.defaults[def.key] ?? def.default;
      row.classList.add('changed'); mark();
    } }, 'Reset');
    const row = h('div', { class: `a-field ${def.type === 'toggle' ? 'toggle' : ''}`, dataset: { search: `${def.label} ${def.key} ${def.group}`.toLowerCase() } },
      h('label', {}, h('span', {}, def.label), def.type === 'toggle' ? input : null, reset),
      def.type === 'toggle' ? null : input,
      def.hint ? h('small', { class: 'a-muted' }, def.hint) : null);
    rows.push(row);
    return row;
  };

  const details = [...groups].map(([name, defs], i) =>
    h('details', { class: 'a-group', open: i < 2 }, h('summary', {}, name, h('span', { class: 'a-count' }, defs.length)), ...defs.map(makeField)));

  const search = h('input', { class: 'a-input', type: 'search', placeholder: 'Search any text, e.g. "button" or "email"', 'aria-label': 'Search fields',
    oninput: (e) => {
      const q = e.target.value.trim().toLowerCase();
      for (const r of rows) r.hidden = q && !r.dataset.search.includes(q);
      for (const d of details) { const any = [...d.querySelectorAll('.a-field')].some((r) => !r.hidden); d.hidden = !any; if (q) d.open = any; }
    } });

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
      await api('/content', { method: 'PUT', body: { changes: Object.fromEntries(edits) } });
      await refreshSite();
      toast('Saved.', { ms: 2500 });
      renderTab();
    } catch (err) { toast(err.message, { ms: 5000 }); mark(); }
  });

  return h('div', {},
    h('p', { class: 'a-muted' }, 'Every phrase on the site is listed here. You can also click text directly on the page with "Edit text".'),
    search, ...details, h('div', { class: 'a-foot' }, saveBtn));
}

/* ------------------------------------------------------------------- lists */

const LISTS = {
  skills: {
    label: 'Skills', one: 'skill',
    hint: 'Shown in the scrolling strip and the "What I work with" box. The level is optional: leave it at 0 for no bar.',
    fields: [
      { k: 'name', label: 'Name', type: 'text', req: true },
      { k: 'category', label: 'Group (e.g. Embedded, Web)', type: 'text', suggest: () => [...new Set(state.skills.map((s) => s.category).filter(Boolean))] },
      { k: 'level', label: 'Level, 0 to 100 (optional)', type: 'number' },
    ],
    row: (s) => [s.name, [s.category, s.level ? `${s.level}%` : ''].filter(Boolean).join(' · ')],
  },
  projects: {
    label: 'Projects', one: 'project',
    hint: 'Add a photo for the card, or leave it empty to get a generated circuit-board cover in the colour you choose.',
    fields: [
      { k: 'title', label: 'Title', type: 'text', req: true },
      { k: 'status', label: 'Status', type: 'select', options: ['Completed', 'In progress'] },
      { k: 'date', label: 'Date (any text, e.g. "Mar 2026" or "Ongoing")', type: 'text' },
      { k: 'description', label: 'Description', type: 'textarea', rows: 6 },
      { k: 'tags', label: 'Technologies (comma separated)', type: 'tags' },
      { k: 'gradient', label: 'Cover colour (used when there is no photo)', type: 'select', options: ['gold', 'cyan', 'green', 'violet'] },
      { k: 'repo', label: 'Source code link (optional)', type: 'text' },
      { k: 'demo', label: 'Live demo link (optional)', type: 'text' },
      { k: 'image_id', label: 'Photo', type: 'image' },
    ],
    row: (p) => [p.title, [p.status, p.date].filter(Boolean).join(' · ')],
    thumb: (p) => p.image_id,
  },
  certificates: {
    label: 'Certificates', one: 'certificate',
    hint: 'Upload a picture of each certificate. Items with the same category get their own tab on the site.',
    fields: [
      { k: 'title', label: 'Title', type: 'text', req: true },
      { k: 'issuer', label: 'Issued by', type: 'text' },
      { k: 'date', label: 'Date (any text)', type: 'text' },
      { k: 'category', label: 'Category (e.g. College, Unstop)', type: 'text', suggest: () => [...new Set(state.certificates.map((c) => c.category).filter(Boolean))] },
      { k: 'image_id', label: 'Certificate image', type: 'image' },
    ],
    row: (c) => [c.title, [c.issuer, c.category, c.date].filter(Boolean).join(' · ')],
    thumb: (c) => c.image_id,
  },
  timeline: {
    label: 'Journey', one: 'journey item',
    hint: 'Education, internships, hackathons and anything else for the timeline, in the order shown here.',
    fields: [
      { k: 'title', label: 'Title (degree, role, event)', type: 'text', req: true },
      { k: 'subtitle', label: 'Organisation', type: 'text' },
      { k: 'date', label: 'Dates (any text)', type: 'text' },
      { k: 'content', label: 'Details', type: 'textarea', rows: 4 },
    ],
    row: (x) => [x.title, [x.subtitle, x.date].filter(Boolean).join(' · ')],
  },
};

function listView(name) {
  const cfg = LISTS[name];
  const items = state[name];
  const move = async (i, d) => {
    const ids = items.map((x) => x.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    try { await api(`/${name}-order`, { method: 'PUT', body: { ids } }); await refreshSite(); renderTab(); } catch (e) { toast(e.message, { ms: 4000 }); }
  };
  const del = async (it) => {
    if (!confirm(`Delete "${cfg.row(it)[0]}"? This can't be undone.`)) return;
    try { await api(`/${name}/${it.id}`, { method: 'DELETE' }); await refreshSite(); renderTab(); toast('Deleted.', { ms: 2000 }); } catch (e) { toast(e.message, { ms: 4000 }); }
  };
  return h('div', {},
    h('div', { class: 'a-row between' }, h('p', { class: 'a-muted' }, cfg.hint),
      h('button', { class: 'a-btn primary', type: 'button', onclick: () => openEditor(name, null) }, icon('plus'), `Add ${cfg.one}`)),
    items.length ? h('ul', { class: 'a-list' }, items.map((it, i) => {
      const [title, sub] = cfg.row(it);
      const tid = cfg.thumb?.(it);
      return h('li', { class: 'a-item' },
        tid ? h('img', { src: mediaUrl(tid), alt: '', loading: 'lazy' }) : null,
        h('div', { class: 'a-grow' }, h('strong', {}, title), h('small', { class: 'a-muted' }, sub)),
        h('div', { class: 'a-actions' },
          h('button', { class: 'a-icon', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, icon('up')),
          h('button', { class: 'a-icon', type: 'button', 'aria-label': 'Move down', disabled: i === items.length - 1, onclick: () => move(i, 1) }, icon('down')),
          h('button', { class: 'a-icon', type: 'button', 'aria-label': 'Edit', onclick: () => openEditor(name, it.id) }, icon('pencil')),
          h('button', { class: 'a-icon danger', type: 'button', 'aria-label': 'Delete', onclick: () => del(it) }, icon('trash'))));
    })) : h('p', { class: 'a-empty' }, `No ${cfg.label.toLowerCase()} yet. Use the button above to add the first one.`));
}

/* ---------------------------------------------------------- item edit dialog */

// Downscales big photos in the browser so uploads stay small and the site stays fast.
async function prepareImage(file) {
  const MAX = 4 * 1024 * 1024 - 64 * 1024;
  if (!/^image\//.test(file.type)) throw new Error('Please choose an image file (JPG, PNG, WebP or GIF).');
  if (file.type === 'image/gif') {
    if (file.size > MAX) throw new Error('That GIF is over 4 MB. Please use a smaller one.');
    return file;
  }
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bmp) throw new Error("This browser couldn't read that image.");
  for (const [dim, q] of [[1800, 0.86], [1500, 0.8], [1200, 0.72], [900, 0.65]]) {
    const scale = Math.min(1, dim / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * scale)); c.height = Math.max(1, Math.round(bmp.height * scale));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    let blob = await new Promise((r) => c.toBlob(r, 'image/webp', q));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size <= MAX) return blob;
  }
  throw new Error('That image is too large even after shrinking. Please use a smaller one.');
}

function openEditor(name, id) {
  const cfg = LISTS[name];
  const item = id ? state[name].find((x) => x.id === id) : null;
  const vals = Object.fromEntries(cfg.fields.map((f) => [f.k, item ? item[f.k] ?? '' : f.k === 'status' ? 'Completed' : f.k === 'gradient' ? 'gold' : f.k === 'level' ? 0 : '']));
  if (Array.isArray(vals.tags)) vals.tags = vals.tags.join(', ');
  let blob = null, removed = false;
  const err = h('p', { class: 'a-error', role: 'alert' });
  const controls = {};
  const dlId = `dl-${name}-${Date.now()}`;

  const fieldEls = cfg.fields.map((f) => {
    let c;
    if (f.type === 'textarea') { c = h('textarea', { class: 'a-input', rows: f.rows || 3, maxlength: 3000 }); c.value = vals[f.k]; }
    else if (f.type === 'select') { c = h('select', { class: 'a-input' }, f.options.map((o) => h('option', { value: o }, o))); c.value = vals[f.k]; }
    else if (f.type === 'image') {
      const preview = h('img', { alt: '', hidden: true });
      const pick = h('input', { type: 'file', accept: 'image/*', hidden: true });
      const label = h('span', { class: 'a-muted' }, '');
      const show = () => {
        const src = blob ? URL.createObjectURL(blob) : (!removed && vals[f.k] ? mediaUrl(vals[f.k]) : '');
        preview.hidden = !src; if (src) preview.src = src; else preview.removeAttribute('src');
        label.textContent = blob ? 'New image ready (saved when you press Save).' : src ? 'Current image' : 'No image';
      };
      pick.addEventListener('change', async () => {
        err.textContent = '';
        if (!pick.files[0]) return;
        try { blob = await prepareImage(pick.files[0]); removed = false; show(); } catch (e) { err.textContent = e.message; }
        pick.value = '';
      });
      c = h('div', { class: 'a-image' }, preview,
        h('div', { class: 'a-stack' }, label,
          h('div', { class: 'a-row' },
            h('button', { class: 'a-btn', type: 'button', onclick: () => pick.click() }, icon('image'), 'Choose image'),
            h('button', { class: 'a-btn ghost', type: 'button', onclick: () => { blob = null; removed = true; show(); } }, 'Remove')),
          pick));
      show();
      controls[f.k] = { image: true };
      return h('div', { class: 'a-field' }, h('label', {}, f.label), c);
    } else {
      c = h('input', { class: 'a-input', type: f.type === 'number' ? 'number' : 'text', maxlength: 400, min: f.type === 'number' ? 0 : null, max: f.type === 'number' ? 100 : null, list: f.suggest ? dlId : null });
      c.value = vals[f.k];
    }
    controls[f.k] = c;
    return h('div', { class: 'a-field' }, h('label', {}, f.label), c);
  });
  const datalist = h('datalist', { id: dlId }, ...(cfg.fields.find((f) => f.suggest)?.suggest() || []).map((v) => h('option', { value: v })));

  const submit = h('button', { class: 'a-btn primary', type: 'submit' }, item ? 'Save changes' : `Add ${cfg.one}`);
  const dlg = h('dialog', { class: 'admin-panel' },
    h('form', { class: 'a-sheet', onsubmit: async (e) => {
      e.preventDefault(); err.textContent = ''; submit.disabled = true;
      try {
        const payload = {};
        for (const f of cfg.fields) if (f.type !== 'image') payload[f.k] = controls[f.k].value;
        if (controls.image_id) {
          payload.image_id = removed ? '' : vals.image_id || '';
          if (blob) {
            const up = await api('/media', { method: 'POST', raw: blob, headers: { 'Content-Type': blob.type } });
            payload.image_id = up.id;
          }
        }
        await api(item ? `/${name}/${item.id}` : `/${name}`, { method: item ? 'PUT' : 'POST', body: payload });
        await refreshSite();
        dlg.close(); dlg.remove();
        renderTab();
        toast('Saved.', { ms: 2500 });
      } catch (ex) { err.textContent = ex.message; } finally { submit.disabled = false; }
    } },
      h('div', { class: 'a-head' }, h('h3', {}, item ? `Edit ${cfg.one}` : `Add ${cfg.one}`),
        h('button', { class: 'a-x', type: 'button', 'aria-label': 'Close', onclick: () => { dlg.close(); dlg.remove(); } }, icon('x'))),
      h('div', { class: 'a-body' }, ...fieldEls, datalist, err),
      h('div', { class: 'a-foot' }, h('button', { class: 'a-btn ghost', type: 'button', onclick: () => { dlg.close(); dlg.remove(); } }, 'Cancel'), submit)));
  dlg.addEventListener('cancel', () => setTimeout(() => dlg.remove(), 0));
  document.body.append(dlg);
  dlg.showModal();
  controls[cfg.fields[0].k].focus?.();
}

/* -------------------------------------------------------------------- inbox */

async function inboxView() {
  const msgs = await api('/messages');
  unread = msgs.filter((m) => !m.is_read).length;
  const dot = $('#aDot'); if (dot) { dot.hidden = !unread; dot.textContent = unread; }
  const act = async (fn) => { try { await fn(); renderTab(); } catch (e) { toast(e.message, { ms: 4000 }); } };
  if (!msgs.length) return h('p', { class: 'a-empty' }, 'No messages yet. Messages sent from the contact form on your site appear here.');
  return h('ul', { class: 'a-list' }, msgs.map((m) =>
    h('li', { class: `a-msg ${m.is_read ? '' : 'unread'}` },
      h('div', { class: 'a-row between' },
        h('div', {}, h('strong', {}, m.name), ' ', h('a', { href: `mailto:${m.email}?subject=${encodeURIComponent('Re: your message on my portfolio')}` }, m.email)),
        h('small', { class: 'a-muted' }, new Date(m.created * 1000).toLocaleString())),
      h('p', { class: 'a-pre' }, m.message),
      h('div', { class: 'a-row' },
        h('button', { class: 'a-btn small', type: 'button', onclick: () => act(() => api(`/messages/${m.id}`, { method: 'PATCH', body: { is_read: !m.is_read } })) }, m.is_read ? 'Mark unread' : 'Mark read'),
        h('button', { class: 'a-btn small ghost', type: 'button', onclick: () => confirm('Delete this message?') && act(() => api(`/messages/${m.id}`, { method: 'DELETE' })) }, 'Delete')))));
}

/* ------------------------------------------------------------------- resume */

function filesView() {
  const id = merged()['resume.media'];
  const status = h('p', { class: 'a-error', role: 'alert' });
  const pick = h('input', { type: 'file', accept: 'application/pdf', hidden: true });
  pick.addEventListener('change', async () => {
    const f = pick.files[0]; pick.value = '';
    if (!f) return;
    status.textContent = '';
    if (f.type !== 'application/pdf') return (status.textContent = 'Please choose a PDF file.');
    if (f.size > 4 * 1024 * 1024) return (status.textContent = 'That PDF is over 4 MB. Please compress it first.');
    try {
      const up = await api('/media', { method: 'POST', raw: f, headers: { 'Content-Type': 'application/pdf' } });
      await api('/content', { method: 'PUT', body: { changes: { 'resume.media': up.id } } });
      await refreshSite(); renderTab(); toast('Resume uploaded.', { ms: 2500 });
    } catch (e) { status.textContent = e.message; }
  });
  return h('div', {},
    h('p', { class: 'a-muted' }, 'The "Download resume" button appears on the site as soon as a PDF is uploaded. Maximum 4 MB.'),
    h('div', { class: 'a-card' },
      h('strong', {}, id ? 'A resume is live on your site.' : 'No resume uploaded yet.'),
      h('div', { class: 'a-row' },
        h('button', { class: 'a-btn primary', type: 'button', onclick: () => pick.click() }, icon('upload'), id ? 'Replace PDF' : 'Upload PDF'),
        id ? h('a', { class: 'a-btn', href: mediaUrl(id), target: '_blank', rel: 'noopener' }, 'View current') : null,
        id ? h('button', { class: 'a-btn ghost', type: 'button', onclick: async () => {
          if (!confirm('Remove the resume from your site?')) return;
          try { await api('/content', { method: 'PUT', body: { changes: { 'resume.media': null } } }); await refreshSite(); renderTab(); } catch (e) { status.textContent = e.message; }
        } }, 'Remove') : null),
      pick, status));
}
