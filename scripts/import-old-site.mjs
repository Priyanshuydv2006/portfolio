// Copies your data from the OLD Render-hosted API into the new site, so nothing you uploaded is lost.
//
//   node scripts/import-old-site.mjs <new-site-url> <admin-password> [old-api-url] [--text]
//
// Example:
//   node scripts/import-old-site.mjs https://my-portfolio.vercel.app "my admin password"
//
// Imports: contact links, resume, certificates, skills, projects and journey items.
// Skipped: the demo projects/timeline items that shipped with the first version (DevFlow, FinTrack, ...).
// Hero/about text is only imported with --text, because the old defaults were generic placeholders.
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const withText = process.argv.includes('--text');
const [site, password, oldApi = 'https://portfolio-1-fhwz.onrender.com/api'] = args;
if (!site || !password) {
  console.error('Usage: node scripts/import-old-site.mjs <new-site-url> <admin-password> [old-api-url] [--text]');
  process.exit(1);
}
const NEW = site.replace(/\/$/, '') + '/api';
const OLD = oldApi.replace(/\/$/, '');
const DEMO_PROJECTS = new Set(['devflow', 'fintrack', 'auraspace', 'taskwave']);
const DEMO_TIMELINE = new Set(['t-1', 't-2']);

async function getOld(path) {
  const r = await fetch(`${OLD}${path}`, { signal: AbortSignal.timeout(90000) }); // Render may need a minute to wake up
  if (!r.ok) throw new Error(`Old API ${path}: HTTP ${r.status}`);
  return r.json();
}
let token = '';
async function put(path, method, body, headers = {}) {
  const r = await fetch(NEW + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path}: ${d.error || r.status}`);
  return d;
}
async function upload(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!m) return '';
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > 4 * 1024 * 1024) { console.warn('  skipped an image over 4 MB'); return ''; }
  return (await put('/media', 'POST', new Uint8Array(bytes), { 'Content-Type': m[1] })).id;
}
const normalizeLink = (v) => (v && !/^https?:/i.test(v) ? (v.startsWith('@') ? `https://instagram.com/${v.slice(1)}` : `https://${v}`) : v || '');

console.log('Logging in to the new site...');
const login = await fetch(NEW + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
if (!login.ok) { console.error('Login failed:', (await login.json().catch(() => ({}))).error); process.exit(1); }
token = (await login.json()).token;

console.log('Reading the old site (this can take a minute while Render wakes up)...');
const [profile, skills, projects, certs, timeline] = await Promise.all(
  ['/profile', '/skills', '/projects', '/certificates', '/timeline'].map(getOld)
);

const changes = {};
if (profile.email) changes['contact.email'] = profile.email;
if (profile.linkedin) changes['contact.linkedin'] = normalizeLink(profile.linkedin);
if (profile.instagram) changes['contact.instagram'] = normalizeLink(profile.instagram);
if (profile.github && !/priyanshu-codes/.test(profile.github)) changes['contact.github'] = normalizeLink(profile.github);
if (profile.location && !/San Francisco/.test(profile.location)) changes['about.location'] = profile.location.replace(/\s+,/g, ',').trim();
if (withText) {
  if (profile.aboutText1) changes['about.p1'] = profile.aboutText1;
  if (profile.aboutText2) changes['about.p2'] = profile.aboutText2;
}
if (profile.resumeBase64) {
  const id = await upload(profile.resumeBase64);
  if (id) { changes['resume.media'] = id; console.log('  resume imported'); }
}
await put('/content', 'PUT', { changes });

let n = 0;
for (const c of certs) {
  const image_id = await upload(c.image);
  await put('/certificates', 'POST', { title: c.title, issuer: c.issuer, date: c.date, category: c.type === 'unstop' ? 'Unstop' : 'College', image_id });
  n++;
}
console.log(`  ${n} certificates imported`);

n = 0;
for (const p of projects.filter((p) => !DEMO_PROJECTS.has(p.id))) {
  const gradient = { 'gradient-1': 'gold', 'gradient-2': 'cyan', 'gradient-3': 'green', 'gradient-4': 'violet' }[p.gradientClass] || 'gold';
  const image_id = await upload(p.imageBase64);
  await put('/projects', 'POST', {
    title: p.title, status: p.status === 'Completed' ? 'Completed' : 'In progress', date: p.date, description: p.desc,
    tags: p.tags, gradient, repo: p.repo === 'https://github.com' ? '' : p.repo, demo: p.demo === '#' ? '' : p.demo, image_id,
  });
  n++;
}
console.log(`  ${n} projects imported (the original demo projects were skipped)`);

n = 0;
for (const x of timeline.filter((x) => !DEMO_TIMELINE.has(x.id) && !/State Tech University/.test(x.subtitle || ''))) {
  await put('/timeline', 'POST', { date: x.date, title: x.title, subtitle: x.subtitle, content: x.content });
  n++;
}
console.log(`  ${n} journey items imported`);

const defaultSkills = new Set(['Frontend (HTML/CSS/JS/React)', 'Backend (NodeJS/Express/SQL)', 'UI/UX Design & CSS Animations', 'Data Structures & Algorithms']);
n = 0;
for (const s of skills.filter((s) => !defaultSkills.has(s.name))) {
  await put('/skills', 'POST', { name: s.name, category: '', level: s.percentage });
  n++;
}
console.log(`  ${n} skills imported`);
console.log('Done. Open your site and press the admin panel to review everything.');
