// Verifies that the default text written in docs/index.html matches backend/content-schema.js.
// The page renders the HTML text first, so a mismatch would make "Reset" and the admin panel disagree.
// Run with: npm run check
import { readFileSync } from 'node:fs';
import { CONTENT_SCHEMA } from '../backend/content-schema.js';

const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const found = new Map();
for (const m of html.matchAll(/<(\w+)([^>]*?)\sdata-c="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g)) {
  found.set(m[3], decode(m[5]).trim());
}
const placeholders = new Map();
for (const m of html.matchAll(/data-c-placeholder="([^"]+)"[^>]*?placeholder="([^"]*)"/g)) placeholders.set(m[1], decode(m[2]));
const title = decode(/<title>([\s\S]*?)<\/title>/.exec(html)[1]);
const desc = decode(/<meta name="description" content="([^"]*)"/.exec(html)[1]);

const meta = { 'meta.title': title, 'meta.description': desc };
const noHtml = (d) => d.type === 'toggle' || d.type === 'color' || d.type === 'url' || d.key.startsWith('contact.email');

let problems = 0;
const fail = (msg) => { problems++; console.error('✗', msg); };

for (const d of CONTENT_SCHEMA) {
  if (d.key in meta) { if (meta[d.key] !== d.default) fail(`${d.key}: HTML has "${meta[d.key]}", schema has "${d.default}"`); continue; }
  if (noHtml(d)) continue;
  const v = found.get(d.key) ?? placeholders.get(d.key);
  if (v === undefined) fail(`${d.key}: not in docs/index.html (add data-c="${d.key}")`);
  else if (v !== d.default) fail(`${d.key}: HTML has "${v}", schema has "${d.default}"`);
}
const keys = new Set(CONTENT_SCHEMA.map((d) => d.key));
for (const k of [...found.keys(), ...placeholders.keys()]) if (!keys.has(k)) fail(`${k}: used in HTML but missing from content-schema.js`);

if (problems) { console.error(`\n${problems} problem(s).`); process.exit(1); }
console.log(`OK: ${CONTENT_SCHEMA.length} schema fields match docs/index.html`);
