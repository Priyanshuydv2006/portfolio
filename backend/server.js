// Local / Render entry point: serves the API and the static site from one process.
// On Vercel the static site is served by the CDN and api/index.js wraps the same app.
import 'dotenv/config';
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname, '..', 'docs')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Portfolio running on http://localhost:${PORT}`));
