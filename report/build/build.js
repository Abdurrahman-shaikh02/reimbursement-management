// Builds report/RMS_Project_Report.{docx,pdf} and report/RMS_Design_Decisions.{docx,pdf}.
//
//   cd report/build && npm install && npm run build
//
// Needs LibreOffice (soffice) and poppler (pdftotext) for the PDF and the
// page numbers in the table of contents. Each document is built twice: the
// first PDF tells us on which page every heading landed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Document, Packer } from 'docx';
import { Doc, documentStyles, numberingConfig } from './lib.js';
import projectReport from './project-report.js';
import designDecisions from './design-decisions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..');
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'rms-soffice-'));

async function writeDocx(build, title, pages, tocHeadings, file) {
  const doc = new Doc(title, pages);
  const sections = build(doc, tocHeadings);
  const document = new Document({
    creator: 'RMS project group',
    title,
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

// heading text -> first page (after the contents pages) whose text contains it at a line start
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

async function buildOne(name, title, build) {
  const docx = path.join(OUT, `${name}.docx`);
  // Run 1: collect the headings for the contents list.
  const headings = await writeDocx(build, title, {}, [], docx);
  // Run 2: contents with placeholder page numbers -> find the real pages.
  await writeDocx(build, title, {}, headings, docx);
  let pages = headingPages(toPdf(docx), headings, 2);
  // Run 3: real page numbers (same length, so pagination does not move).
  await writeDocx(build, title, pages, headings, docx);
  const pdf = toPdf(docx);
  const check = headingPages(pdf, headings, 2);
  const moved = headings.filter((h) => check[h.text] !== pages[h.text]);
  if (moved.length) {
    pages = check;
    await writeDocx(build, title, pages, headings, docx);
    toPdf(docx);
  }
  const missing = headings.filter((h) => pages[h.text] === '?').map((h) => h.text);
  console.log(`${name}: ${headings.length} headings${missing.length ? `, NOT FOUND: ${missing.join(' | ')}` : ''}`);
}

await buildOne('RMS_Project_Report', 'Reimbursement Management System — Project Report', projectReport);
await buildOne('RMS_Design_Decisions', 'Reimbursement Management System — Design Decisions and Trade-offs', designDecisions);
fs.rmSync(PROFILE, { recursive: true, force: true });
