import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { authRouter, requireAuth, requireRole } from './auth.js';
import { toHttpError } from './errors.js';
import { UPLOAD_DIR } from './uploads.js';
import { claimsRouter } from './routes/claims.js';
import { reviewsRouter } from './routes/reviews.js';
import { paymentsRouter } from './routes/payments.js';
import { adminRouter } from './routes/admin.js';
import { reportsRouter } from './routes/reports.js';
import { metaRouter } from './routes/meta.js';

const app = express();
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/meta', requireAuth, metaRouter);
app.use('/api/claims', requireAuth, claimsRouter);
app.use('/api/reviews', requireAuth, requireRole('manager'), reviewsRouter);
app.use('/api/payments', requireAuth, requireRole('admin'), paymentsRouter);
app.use('/api/admin', requireAuth, requireRole('admin'), adminRouter);
app.use('/api/reports', requireAuth, requireRole('manager', 'admin'), reportsRouter);
app.use('/uploads', express.static(UPLOAD_DIR));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// After `npm run build` in client/, the API also serves the built UI.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('/{*path}', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Express 5 forwards errors thrown in async handlers to this handler.
app.use((err, req, res, next) => {
  const httpError = toHttpError(err);
  if (httpError.status >= 500) console.error(err);
  res.status(httpError.status).json({ error: httpError.message });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`RMS API listening on http://localhost:${port}`));
