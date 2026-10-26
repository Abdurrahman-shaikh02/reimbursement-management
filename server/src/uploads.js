import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { HttpError } from './errors.js';

export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads');

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

// [E15] Receipts live on disk; the database stores only the file name in
// expense_item.receipt_path. Random names stop one file overwriting another
// and make the URLs hard to guess.
export const receiptUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 6);
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 50 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new HttpError(422, 'Receipts must be JPG, PNG, WebP or PDF files.'));
  },
});

export async function removeFiles(names) {
  await Promise.all(
    names.filter(Boolean).map((name) => fs.rm(path.join(UPLOAD_DIR, path.basename(name)), { force: true })),
  );
}
