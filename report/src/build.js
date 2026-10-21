// Builds report/RMS_Database_Design.{docx,pdf}.
//
//   cd report/src && npm install && npm run build
//
// Needs LibreOffice (soffice) and poppler (pdftotext). The document is built
// more than once: the first PDF tells us on which page every heading landed,
// so the table of contents can show real page numbers.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Document, Packer } from 'docx';
import { Doc, documentStyles, numberingConfig } from './lib.js';
import design, { TITLE } from './design.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..');
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'rms-soffice-'));
const NAME = 'RMS_Database_Design';

async function writeDocx(pages, tocHeadings, file) {
  const doc = new Doc(TITLE, pages);
  const sections = design(doc, tocHeadings);
  const document = new Document({
    creator: 'RMS project group',
    title: TITLE,
    styles: documentStyles,
    numbering: numberingConfig,
    sections,
  });
  fs.writeFileSync(file, await Packer.toBuffer(document));
  return doc.headings;
}

function toPdf(docx) {
  execFileSync('soffice', [
    `-env:UserInstallation=file://${PROFILE}`, '--headless', '--convert-to', 'pdf', '--outdir', OUT, docx,
  ], { stdio: 'ignore' });
  return docx.replace(/\.docx$/, '.pdf');
}

// heading text -> first page (after the contents pages) with a line starting with it
function headingPages(pdf, headings, afterPage) {
  const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const pages = text.split('\f').map((pg) => pg.split('\n').map((l) => l.trim().replace(/\s+/g, ' ')));
  const map = {};
  for (const { text: h } of headings) {
    const plain = h.replace(/\*\*|`|~|\[\[|\]\]|\{\{|\}\}/g, '').replace(/\s+/g, ' ');
    const probe = plain.slice(0, 45);
    const idx = pages.findIndex((lines, i) => i >= afterPage && lines.some((l) => l.startsWith(probe)));
    map[h] = idx >= 0 ? idx + 1 : '?';
  }
  return map;
}

const docx = path.join(OUT, `${NAME}.docx`);
const headings = await writeDocx({}, [], docx);
await writeDocx({}, headings, docx);
let pages = headingPages(toPdf(docx), headings, 2);
await writeDocx(pages, headings, docx);
const check = headingPages(toPdf(docx), headings, 2);
if (headings.some((h) => check[h.text] !== pages[h.text])) {
  pages = check;
  await writeDocx(pages, headings, docx);
  toPdf(docx);
}
const missing = headings.filter((h) => pages[h.text] === '?').map((h) => h.text);
console.log(`${NAME}: ${headings.length} headings${missing.length ? `, NOT FOUND: ${missing.join(' | ')}` : ''}`);
fs.rmSync(PROFILE, { recursive: true, force: true });
