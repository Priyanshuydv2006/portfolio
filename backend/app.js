// The whole API as an Express app. Used by backend/server.js (local, Render)
// and by api/index.js (Vercel serverless function).
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { init, all, one, run, db } from './db.js';
import { CONTENT_SCHEMA, CONTENT_BY_KEY } from './content-schema.js';

const IS_PROD = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
// In production the admin is disabled until both secrets are set. There are no fallback passwords.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (IS_PROD ? '' : 'admin123');
const JWT_SECRET = process.env.JWT_SECRET || (IS_PROD ? '' : crypto.randomBytes(32).toString('hex'));
const ADMIN_ENABLED = Boolean(ADMIN_PASSWORD && JWT_SECRET);
if (!IS_PROD && !process.env.ADMIN_PASSWORD) {
  console.warn('[dev] ADMIN_PASSWORD not set, using "admin123". Set it in .env.');
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (msg) => new HttpError(400, msg);

/* ------------------------------------------------------------------ helpers */

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const newId = () => crypto.randomBytes(6).toString('hex');
const nowSec = () => Math.floor(Date.now() / 1000);

function sameString(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket?.remoteAddress || 'unknown';
}

// Only http(s), mailto, tel, relative and anchor links are allowed. A bare "linkedin.com/in/x" gets https://.
function cleanUrl(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (s.length > 500) throw bad('Link is too long.');
  if (/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) throw bad(`Link type not allowed: ${s.slice(0, 30)}`);
  if (/^@[\w.]+$/.test(s)) return `https://instagram.com/${s.slice(1)}`;
  if (/^[^\s/]+\.[^\s/]+/.test(s)) return `https://${s}`;
  throw bad(`That doesn't look like a link: ${s.slice(0, 40)}`);
}

function str(v, max, required = false, label = 'Field') {
  const s = String(v ?? '').trim();
  if (required && !s) throw bad(`${label} is required.`);
  if (s.length > max) throw bad(`${label} is too long (max ${max} characters).`);
  return s;
}
function int(v, min, max) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
function mediaId(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (!/^[a-f0-9]{12}$/.test(s)) throw bad('Invalid image.');
  return s;
}
function tagList(v) {
  const arr = Array.isArray(v) ? v : String(v ?? '').split(',');
  return arr.map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 14);
}

// Fixed-window rate limiting stored in the database so it also works across serverless instances.
async function rateBlocked(key, limit) {
  const r = await one('SELECT n, reset FROM rate WHERE k = ?', [key]);
  return Boolean(r && r.reset > nowSec() && r.n >= limit);
}
async function rateBump(key, windowSec) {
  const t = nowSec();
  const r = await one('SELECT n, reset FROM rate WHERE k = ?', [key]);
  if (!r || r.reset <= t) {
    await run('INSERT OR REPLACE INTO rate (k, n, reset) VALUES (?, 1, ?)', [key, t + windowSec]);
  } else {
    await run('UPDATE rate SET n = n + 1 WHERE k = ?', [key]);
  }
}

function requireAdmin(req, res, next) {
  if (!ADMIN_ENABLED) return res.status(503).json({ error: 'Admin is not configured on the server.' });
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Please log in.' });
  try {
    jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

/* --------------------------------------------------------------- list config */

const GRADIENTS = ['gold', 'cyan', 'green', 'violet'];
const STATUSES = ['Completed', 'In progress'];

const LISTS = {
  skills: {
    order: 'sort, rowid',
    cols: ['name', 'category', 'level'],
    clean: (b) => ({
      name: str(b.name, 80, true, 'Name'),
      category: str(b.category, 60),
      level: int(b.level, 0, 100),
    }),
  },
  projects: {
    order: 'sort, rowid',
    cols: ['title', 'status', 'date', 'description', 'tags', 'gradient', 'repo', 'demo', 'image_id'],
    image: 'image_id',
    clean: (b) => ({
      title: str(b.title, 120, true, 'Title'),
      status: STATUSES.includes(b.status) ? b.status : 'Completed',
      date: str(b.date, 60),
      description: str(b.description, 3000),
      tags: JSON.stringify(tagList(b.tags)),
      gradient: GRADIENTS.includes(b.gradient) ? b.gradient : 'gold',
      repo: cleanUrl(b.repo),
      demo: cleanUrl(b.demo),
      image_id: mediaId(b.image_id),
    }),
  },
  certificates: {
    order: 'sort, rowid',
    cols: ['title', 'issuer', 'date', 'category', 'image_id'],
    image: 'image_id',
    clean: (b) => ({
      title: str(b.title, 160, true, 'Title'),
      issuer: str(b.issuer, 120),
      date: str(b.date, 60),
      category: str(b.category, 60),
      image_id: mediaId(b.image_id),
    }),
  },
  timeline: {
    order: 'sort, rowid',
    cols: ['date', 'title', 'subtitle', 'content'],
    clean: (b) => ({
      date: str(b.date, 80),
      title: str(b.title, 160, true, 'Title'),
      subtitle: str(b.subtitle, 160),
      content: str(b.content, 2000),
    }),
  },
};

const shapeRow = (name, r) => (name === 'projects' ? { ...r, tags: safeJson(r.tags) } : r);
function safeJson(s) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
const listRows = (name) => all(`SELECT id, ${LISTS[name].cols.join(', ')} FROM ${name} ORDER BY ${LISTS[name].order}`);

async function deleteMediaIfUnused(id) {
  if (!id) return;
  const used =
    (await one('SELECT 1 AS x FROM projects WHERE image_id = ?', [id])) ||
    (await one('SELECT 1 AS x FROM certificates WHERE image_id = ?', [id])) ||
    (await one(`SELECT 1 AS x FROM content WHERE key = 'resume.media' AND value = ?`, [id]));
  if (!used) await run('DELETE FROM media WHERE id = ?', [id]);
}

async function mediaMustExist(id) {
  if (id && !(await one('SELECT 1 AS x FROM media WHERE id = ?', [id]))) throw bad('That image was not found. Upload it again.');
}

/* ----------------------------------------------------------------------- app */

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
if (process.env.CORS_ORIGIN) app.use(cors({ origin: process.env.CORS_ORIGIN.split(',') }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Uploads are sent as raw bytes, which avoids base64 overhead against Vercel's 4.5 MB request limit.
const MEDIA_LIMIT = 4 * 1024 * 1024;
app.post('/api/media', express.raw({ type: () => true, limit: MEDIA_LIMIT }));
app.use(express.json({ limit: '200kb' }));

app.use('/api', wrap(async (req, res, next) => {
  await init();
  next();
}));

app.get('/api/health', wrap(async (req, res) => {
  res.json({ ok: true, admin: ADMIN_ENABLED });
}));

// One request returns everything the public page needs.
app.get('/api/site', wrap(async (req, res) => {
  const [contentRows, skills, projects, certificates, timeline] = await Promise.all([
    all(`SELECT key, value FROM content WHERE key NOT LIKE '\\_%' ESCAPE '\\'`),
    listRows('skills'),
    listRows('projects'),
    listRows('certificates'),
    listRows('timeline'),
  ]);
  const content = Object.fromEntries(contentRows.map((r) => [r.key, r.value]));
  res.setHeader(
    'Cache-Control',
    req.query.fresh ? 'no-store' : 'public, max-age=0, s-maxage=30, stale-while-revalidate=300'
  );
  res.json({
    content,
    skills,
    projects: projects.map((p) => shapeRow('projects', p)),
    certificates,
    timeline,
  });
}));

app.get('/api/schema', wrap(async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(CONTENT_SCHEMA);
}));

/* -------------------------------------------------------------------- media */

const MAGIC = [
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/png', (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ['image/gif', (b) => b.slice(0, 4).toString('latin1') === 'GIF8'],
  ['image/webp', (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP'],
  ['application/pdf', (b) => b.slice(0, 5).toString('latin1') === '%PDF-'],
];

app.post('/api/media', requireAdmin, wrap(async (req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) throw bad('No file received.');
  const found = MAGIC.find(([, test]) => test(buf));
  if (!found) throw bad('Only JPG, PNG, WebP, GIF images and PDF files are allowed.');
  const id = newId();
  await run('INSERT INTO media (id, mime, size, data, created) VALUES (?, ?, ?, ?, ?)', [id, found[0], buf.length, buf, nowSec()]);
  res.status(201).json({ id, mime: found[0], size: buf.length });
}));

app.get('/api/media/:id', wrap(async (req, res) => {
  if (!/^[a-f0-9]{12}$/.test(req.params.id)) return res.sendStatus(404);
  const m = await one('SELECT mime, data FROM media WHERE id = ?', [req.params.id]);
  if (!m) return res.sendStatus(404);
  const data = Buffer.from(m.data);
  res.setHeader('Content-Type', m.mime);
  res.setHeader('Content-Length', data.length);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  if (req.query.download) {
    const row = await one(`SELECT value FROM content WHERE key = 'brand.name'`);
    const base = String(row?.value || 'Priyanshu Yadav').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'Resume';
    res.setHeader('Content-Disposition', `attachment; filename="${base}-Resume.pdf"`);
  }
  res.end(data);
}));

/* --------------------------------------------------------------------- auth */

app.post('/api/auth/login', wrap(async (req, res) => {
  if (!ADMIN_ENABLED) {
    return res.status(503).json({ error: 'Admin is not configured. Set ADMIN_PASSWORD and JWT_SECRET on the server.' });
  }
  const key = `login:${clientIp(req)}`;
  if (await rateBlocked(key, 8)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }
  if (!sameString(req.body?.password ?? '', ADMIN_PASSWORD)) {
    await rateBump(key, 15 * 60);
    return res.status(401).json({ error: 'Wrong password.' });
  }
  await run('DELETE FROM rate WHERE k = ?', [key]);
  res.json({ token: jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' }) });
}));

app.get('/api/auth/verify', requireAdmin, (req, res) => res.json({ ok: true }));

/* ------------------------------------------------------------------ content */

app.put('/api/content', requireAdmin, wrap(async (req, res) => {
  const changes = req.body?.changes;
  if (!changes || typeof changes !== 'object') throw bad('Nothing to save.');
  const stmts = [];
  let oldResume = null;
  for (const [key, raw] of Object.entries(changes)) {
    const def = CONTENT_BY_KEY[key];
    if (!def && key !== 'resume.media') throw bad(`Unknown field: ${key}`);
    if (key === 'resume.media') oldResume = (await one(`SELECT value FROM content WHERE key = 'resume.media'`))?.value;
    if (raw === null) {
      stmts.push({ sql: 'DELETE FROM content WHERE key = ?', args: [key] });
      continue;
    }
    let v = String(raw);
    if (v.length > 4000) throw bad(`${def?.label || key} is too long.`);
    if (key === 'resume.media') {
      v = mediaId(v);
      await mediaMustExist(v);
    } else if (def.type === 'toggle') v = v === 'false' || v === false ? 'false' : 'true';
    else if (def.type === 'color') {
      if (!/^#[0-9a-f]{6}$/i.test(v)) throw bad(`${def.label}: use a colour like #D8B45A.`);
    } else if (def.type === 'url') v = cleanUrl(v);
    else v = v.trim();
    stmts.push({ sql: 'INSERT INTO content (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', args: [key, v] });
  }
  if (stmts.length) await db().batch(stmts, 'write');
  if (oldResume) await deleteMediaIfUnused(oldResume);
  res.json({ ok: true });
}));

/* -------------------------------------------------------------------- lists */

for (const [name, cfg] of Object.entries(LISTS)) {
  const base = `/api/${name}`;

  app.post(base, requireAdmin, wrap(async (req, res) => {
    const d = cfg.clean(req.body || {});
    if (cfg.image) await mediaMustExist(d[cfg.image]);
    const id = newId();
    const max = await one(`SELECT COALESCE(MAX(sort), -1) AS m FROM ${name}`);
    const cols = ['id', ...cfg.cols, 'sort'];
    await run(
      `INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      [id, ...cfg.cols.map((c) => d[c]), max.m + 1]
    );
    res.status(201).json({ id });
  }));

  app.put(`${base}/:id`, requireAdmin, wrap(async (req, res) => {
    const old = await one(`SELECT * FROM ${name} WHERE id = ?`, [req.params.id]);
    if (!old) throw new HttpError(404, 'Not found.');
    const d = cfg.clean(req.body || {});
    if (cfg.image) await mediaMustExist(d[cfg.image]);
    await run(`UPDATE ${name} SET ${cfg.cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
      ...cfg.cols.map((c) => d[c]),
      req.params.id,
    ]);
    if (cfg.image && old[cfg.image] && old[cfg.image] !== d[cfg.image]) await deleteMediaIfUnused(old[cfg.image]);
    res.json({ ok: true });
  }));

  app.delete(`${base}/:id`, requireAdmin, wrap(async (req, res) => {
    const old = await one(`SELECT * FROM ${name} WHERE id = ?`, [req.params.id]);
    if (!old) throw new HttpError(404, 'Not found.');
    await run(`DELETE FROM ${name} WHERE id = ?`, [req.params.id]);
    if (cfg.image) await deleteMediaIfUnused(old[cfg.image]);
    res.json({ ok: true });
  }));

  app.put(`${base}-order`, requireAdmin, wrap(async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length > 500) throw bad('Invalid order.');
    await db().batch(
      ids.map((id, i) => ({ sql: `UPDATE ${name} SET sort = ? WHERE id = ?`, args: [i, String(id)] })),
      'write'
    );
    res.json({ ok: true });
  }));
}

/* ----------------------------------------------------------------- messages */

app.post('/api/contact', wrap(async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot: silently drop bots
  const name = str(b.name, 100, true, 'Name');
  const email = str(b.email, 160, true, 'Email');
  const message = str(b.message, 4000, true, 'Message');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Please enter a valid email address.');

  const key = `contact:${clientIp(req)}`;
  if (await rateBlocked(key, 5)) throw new HttpError(429, 'Too many messages. Please try again later.');
  await rateBump(key, 60 * 60);

  await run('INSERT INTO messages (name, email, message, created) VALUES (?, ?, ?, ?)', [name, email, message, nowSec()]);

  // Optional email notification through Resend. The message is already saved if this fails.
  if (process.env.RESEND_API_KEY && process.env.CONTACT_TO) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.CONTACT_FROM || 'Portfolio <onboarding@resend.dev>',
          to: [process.env.CONTACT_TO],
          reply_to: email,
          subject: `Portfolio message from ${name}`,
          text: `${message}\n\n${name} <${email}>`,
        }),
        signal: AbortSignal.timeout(4000),
      });
    } catch (e) {
      console.warn('Email notification failed:', e.message);
    }
  }
  res.status(201).json({ ok: true });
}));

app.get('/api/messages', requireAdmin, wrap(async (req, res) => {
  res.json(await all('SELECT id, name, email, message, created, is_read FROM messages ORDER BY id DESC LIMIT 300'));
}));
app.patch('/api/messages/:id', requireAdmin, wrap(async (req, res) => {
  await run('UPDATE messages SET is_read = ? WHERE id = ?', [req.body?.is_read ? 1 : 0, Number(req.params.id)]);
  res.json({ ok: true });
}));
app.delete('/api/messages/:id', requireAdmin, wrap(async (req, res) => {
  await run('DELETE FROM messages WHERE id = ?', [Number(req.params.id)]);
  res.json({ ok: true });
}));

/* ------------------------------------------------------------------- errors */

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That file is too large (max 4 MB).' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Server error. Please try again.' : err.message });
});

export default app;
