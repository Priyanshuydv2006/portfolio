// Entry point. The page already contains readable default text, so the first paint is never empty.
// Saved content is applied on top: instantly from the local cache, then from the server.
import {
  $, $$, API, h, icon, state, t, mediaUrl, safeUrl, art,
  captureDefaults, applyContent, renderProjects, renderCerts, renderAll,
  setSite, cachedSite, fetchSite, toast, hideToast,
} from './core.js';
import { initBackground, initScope, initPage, observeReveals, setRoles } from './fx.js';

captureDefaults();
initPage();
initBackground();
initScope();

window.addEventListener('pf-roles', (e) => setRoles(e.detail));
window.addEventListener('pf-rendered', () => observeReveals());
applyContent();
observeReveals();

const cached = cachedSite();
if (cached) setSite(cached, { cache: false });

/* --------------------------------------------------------------- data load */

async function load() {
  const wake = setTimeout(() => toast(t('ui.waking'), { spin: true }), 2500);
  try {
    const data = await fetchSite();
    clearTimeout(wake);
    hideToast();
    setSite(data);
  } catch {
    clearTimeout(wake);
    if (state.loaded) return hideToast(); // cached copy is already on screen
    $$('.skel').forEach((s) => s.remove());
    renderAll();
    toast(t('ui.offline'), { action: { label: t('ui.retry'), run: () => { hideToast(); load(); } } });
  }
}
load();

/* ---------------------------------------------------------------- listeners */

$('#projectFilters').addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (!b) return;
  state.filter = b.dataset.filter;
  renderProjects();
  observeReveals();
});
$('#certTabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (!b) return;
  state.certTab = b.dataset.tab;
  renderCerts();
  observeReveals();
});

const pDlg = $('#projectDialog');
const cDlg = $('#certDialog');
for (const dlg of [pDlg, cDlg]) {
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
}

function openProject(p) {
  $('#pdTitle').textContent = p.title;
  $('#pdDate').textContent = p.date || '';
  const st = $('#pdStatus');
  st.textContent = p.status === 'Completed' ? t('projects.filter.completed') : t('projects.filter.progress');
  st.className = `status ${p.status === 'Completed' ? 'done' : 'wip'}`;
  $('#pdDesc').textContent = p.description || '';
  $('#pdDesc').hidden = !p.description;
  $('#pdImg').replaceChildren(p.image_id ? h('img', { src: mediaUrl(p.image_id), alt: p.title }) : art(p.gradient, p.id));
  $('#pdTechLabel').textContent = t('projects.modal.tech');
  $('#pdTagsWrap').hidden = !p.tags?.length;
  $('#pdTags').replaceChildren(...(p.tags || []).map((x) => h('span', { class: 'chip' }, x)));
  $('#pdRepoText').textContent = t('projects.modal.repo');
  $('#pdDemoText').textContent = t('projects.modal.demo');
  for (const [id, url] of [['#pdRepo', p.repo], ['#pdDemo', p.demo]]) {
    const a = $(id), href = safeUrl(url);
    a.hidden = !href;
    if (href) a.href = href; else a.removeAttribute('href');
  }
  pDlg.showModal();
}

function openCert(c) {
  const img = $('#cdImg');
  img.hidden = !c.image_id;
  img.src = c.image_id ? mediaUrl(c.image_id) : '';
  img.alt = c.title;
  $('#cdTitle').textContent = c.title;
  $('#cdMeta').replaceChildren(...[c.issuer, c.date, c.category].filter(Boolean).map((x) => h('span', {}, x)));
  cDlg.showModal();
}

$('#projectGrid').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  const p = card && state.projects.find((x) => x.id === card.dataset.id);
  if (p) openProject(p);
});
$('#certGrid').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  const c = card && state.certificates.find((x) => x.id === card.dataset.id);
  if (c) openCert(c);
});

/* ------------------------------------------------------------ contact form */

const form = $('#contactForm');
const statusEl = $('#formStatus');
const setStatus = (msg, kind = '') => { statusEl.textContent = msg; statusEl.className = `form-status ${kind}`; };

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#cSend');
  btn.disabled = true;
  setStatus(t('contact.form.sending'));
  try {
    const res = await fetch(`${API}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.error || ''), { fromServer: true });
    form.reset();
    setStatus(t('contact.form.success'), 'ok');
  } catch (err) {
    setStatus(err.fromServer && err.message ? err.message : t('contact.form.error'), 'err');
  } finally {
    btn.disabled = false;
  }
});

/* ------------------------------------------------------------------- admin */
// The admin code is only downloaded when it is needed: after login or on #admin.

let adminLoading;
function loadAdmin() {
  adminLoading ??= import('./admin.js').then((m) => m.start()).catch((err) => { adminLoading = null; console.error(err); });
  return adminLoading;
}
const hasSession = () => { try { return Boolean(sessionStorage.getItem('pf-token')); } catch { return false; } };

if (location.hash === '#admin' || hasSession()) loadAdmin();
addEventListener('hashchange', () => { if (location.hash === '#admin') loadAdmin(); });
