// Database layer. Uses libSQL: a local file in development, Turso in production.
// Set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) on Vercel. Nothing else is needed.
import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEED_CONTENT, SEED_SKILLS, SEED_PROJECTS, SEED_TIMELINE } from './seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveUrl() {
  if (process.env.TURSO_DATABASE_URL) {
    const url = process.env.TURSO_DATABASE_URL.trim();
    // Serverless functions should talk to Turso over plain HTTPS instead of a long-lived WebSocket.
    return process.env.VERCEL ? url.replace(/^libsql:\/\//, 'https://') : url;
  }
  if (process.env.VERCEL) {
    throw new Error('TURSO_DATABASE_URL is not set. Add it (and TURSO_AUTH_TOKEN) in the Vercel project settings.');
  }
  const dir = join(__dirname, 'data');
  mkdirSync(dir, { recursive: true });
  return 'file:' + join(dir, 'local.db');
}

let client;
export function db() {
  if (!client) client = createClient({ url: resolveUrl(), authToken: process.env.TURSO_AUTH_TOKEN });
  return client;
}

// libSQL rows are array-like objects; copy them into plain objects.
export async function all(sql, args = []) {
  const res = await db().execute({ sql, args });
  return res.rows.map((r) => ({ ...r }));
}
export async function one(sql, args = []) {
  return (await all(sql, args))[0] || null;
}
export async function run(sql, args = []) {
  return db().execute({ sql, args });
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS content (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS skills (
     id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
     level INTEGER NOT NULL DEFAULT 0, sort INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS projects (
     id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Completed',
     date TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
     gradient TEXT NOT NULL DEFAULT 'gold', repo TEXT NOT NULL DEFAULT '', demo TEXT NOT NULL DEFAULT '',
     image_id TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS certificates (
     id TEXT PRIMARY KEY, title TEXT NOT NULL, issuer TEXT NOT NULL DEFAULT '',
     date TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
     image_id TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS timeline (
     id TEXT PRIMARY KEY, date TEXT NOT NULL DEFAULT '', title TEXT NOT NULL,
     subtitle TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS media (
     id TEXT PRIMARY KEY, mime TEXT NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL,
     created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS messages (
     id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL,
     message TEXT NOT NULL, created INTEGER NOT NULL, is_read INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS rate (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset INTEGER NOT NULL)`,
];

let ready;
export function init() {
  if (!ready) {
    ready = (async () => {
      await db().batch(DDL, 'write');
      await seed();
    })().catch((err) => {
      ready = null; // retry on the next request
      throw err;
    });
  }
  return ready;
}

// Seeds run once. The "_seeded" flag stops deleted items from coming back.
// Seed ids are fixed and inserted with INSERT OR IGNORE, so a race between two
// cold starts cannot create duplicates.
async function seed() {
  if (await one(`SELECT 1 AS x FROM content WHERE key = '_seeded'`)) return;
  const stmts = [];
  for (const [k, v] of Object.entries(SEED_CONTENT)) {
    stmts.push({ sql: `INSERT OR IGNORE INTO content (key, value) VALUES (?, ?)`, args: [k, v] });
  }
  SEED_SKILLS.forEach((s, i) =>
    stmts.push({
      sql: `INSERT OR IGNORE INTO skills (id, name, category, level, sort) VALUES (?, ?, ?, ?, ?)`,
      args: [`seed-skill-${i + 1}`, s.name, s.category, s.level || 0, i],
    })
  );
  SEED_PROJECTS.forEach((p, i) =>
    stmts.push({
      sql: `INSERT OR IGNORE INTO projects (id, title, status, date, description, tags, gradient, repo, demo, sort)
            VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?)`,
      args: [`seed-project-${i + 1}`, p.title, p.status, p.date, p.description, JSON.stringify(p.tags), p.gradient, i],
    })
  );
  SEED_TIMELINE.forEach((t, i) =>
    stmts.push({
      sql: `INSERT OR IGNORE INTO timeline (id, date, title, subtitle, content, sort) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [`seed-timeline-${i + 1}`, t.date, t.title, t.subtitle, t.content, i],
    })
  );
  stmts.push({ sql: `INSERT OR IGNORE INTO content (key, value) VALUES ('_seeded', '1')`, args: [] });
  await db().batch(stmts, 'write');
}
