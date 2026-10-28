// Reimbursement Management System — API server.
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { login, requireAuth, requireManager } from './auth.js';
import { errorHandler } from './errors.js';
import { query } from './db.js';
import { performanceHeaders } from './timing.js';
import { UPLOAD_DIR } from './uploads.js';
import claims, { CATEGORIES, CLAIM_TYPES } from './routes/claims.js';
import manager from './routes/manager.js';
import admin from './routes/admin.js';

const app = express();
app.use('/api', performanceHeaders);
app.use(express.json());

app.post('/api/auth/login', async (req, res) => {
  res.json(await login(req.body.email ?? '', req.body.password ?? ''));
});
app.get('/api/auth/me', requireAuth, (req, res) => res.json(req.user));

// Lists the frontend needs for its drop-downs (same values as the CHECK constraints)
app.get('/api/meta', requireAuth, async (req, res) => {
  const [{ claimDate }] = await query('SELECT CURRENT_DATE AS claimDate');
  res.json({ claimTypes: CLAIM_TYPES, categories: CATEGORIES, claimDate });
});

app.use('/api/claims', requireAuth, claims);
app.use('/api/manager', requireAuth, requireManager, manager);
app.use('/api/admin', requireAuth, requireManager, admin);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Uploaded receipts
app.use('/uploads', express.static(UPLOAD_DIR));

// In production the built frontend (client/dist) is served from here too
const dist = path.resolve(import.meta.dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*any}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
