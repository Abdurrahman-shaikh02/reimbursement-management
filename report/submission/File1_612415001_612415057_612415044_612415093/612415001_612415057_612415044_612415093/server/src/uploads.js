// Receipt uploads: the file goes to server/uploads, the database stores its path.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { HttpError } from './errors.js';

export const UPLOAD_DIR = path.resolve(import.meta.dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  // random name, so users cannot overwrite or guess each other's files
  filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    cb(ok ? null : new HttpError(400, 'Receipts must be images or PDF files.'), ok);
  },
});

// Removes files uploaded with a request that then failed
export function removeFiles(files = []) {
  for (const f of files) fs.rm(f.path, { force: true }, () => {});
}
