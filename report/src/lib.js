// Small layer over the `docx` package so the content files read like a document.
import fs from 'node:fs';
import {
  AlignmentType, BorderStyle, Footer, HeadingLevel, ImageRun, LevelFormat, PageBreak, PageNumber,
  PageOrientation, Paragraph, ShadingType, Table, TableCell, TableRow, TabStopType, TextRun,
  UnderlineType, VerticalAlign, WidthType,
} from 'docx';

export const A4 = { width: 11906, height: 16838 };
export const MARGIN = 1134; // 2 cm
export const PORTRAIT_WIDTH = A4.width - 2 * MARGIN; // 9638 DXA
export const LANDSCAPE_WIDTH = A4.height - 2 * MARGIN; // 14570 DXA

const BLUE = '1F3A68';
const GRID = 'C9D1DC';
const HEAD_FILL = 'E6EDF7';

// Inline markup: **bold**, ~italic~, `code`, [[underlined]] (primary keys),
// {{dash-underlined}} (discriminators).
export function runs(text, base = {}) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|~[^~]+~|\[\[[^\]]+\]\]|\{\{[^}]+\}\})/);
  return parts.filter(Boolean).map((part) => {
    if (part.startsWith('**')) return new TextRun({ ...base, text: part.slice(2, -2), bold: true });
    if (part.startsWith('`')) return new TextRun({ ...base, text: part.slice(1, -1), font: 'Courier New', size: (base.size ?? 21) - 2 });
    if (part.startsWith('~')) return new TextRun({ ...base, text: part.slice(1, -1), italics: true });
    if (part.startsWith('[[')) return new TextRun({ ...base, text: part.slice(2, -2), underline: { type: UnderlineType.SINGLE } });
    if (part.startsWith('{{')) return new TextRun({ ...base, text: part.slice(2, -2), underline: { type: UnderlineType.DASH } });
    return new TextRun({ ...base, text: part });
  });
}

export function p(text, opts = {}) {
  const { size, bold, color, italic, align, after, before, keepNext } = opts;
  return new Paragraph({
    alignment: align,
    keepNext,
    spacing: { after: after ?? 120, before: before ?? 0 },
    children: runs(text, { size, bold, color, italics: italic }),
  });
}

export function caption(text) {
  return p(text, { size: 18, italic: true, color: '555555', align: AlignmentType.CENTER, after: 200 });
}

export function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

let listInstance = 0;

// items: strings, or [string, [sub-items]] for one level of nesting.
function list(reference, items) {
  const instance = ++listInstance;
  const out = [];
  for (const item of items) {
    const [text, children] = Array.isArray(item) ? item : [item, null];
    out.push(new Paragraph({ numbering: { reference, level: 0, instance }, spacing: { after: 60 }, children: runs(text) }));
    for (const child of children ?? []) {
      out.push(new Paragraph({ numbering: { reference, level: 1, instance }, spacing: { after: 40 }, children: runs(child) }));
    }
  }
  return [...out, new Paragraph({ spacing: { after: 60 }, children: [] })];
}

export const bullets = (items) => list('bullets', items);
export const numbered = (items) => list('numbers', items);

export function code(textBlock) {
  const lines = textBlock.replace(/^\n/, '').replace(/\n\s*$/, '').split('\n');
  return [
    ...lines.map((line, i) => new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
      spacing: { after: 0, before: i === 0 ? 60 : 0, line: 240, lineRule: 'auto' },
      indent: { left: 120, right: 120 },
      keepLines: true,
      children: [new TextRun({ text: line || ' ', font: 'Courier New', size: 16 })],
    })),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}

export function callout(text, { title, color = '2A78D6', fill = 'EEF4FC' } = {}) {
  const border = { left: { style: BorderStyle.SINGLE, size: 24, color, space: 8 } };
  const out = [];
  if (title) {
    out.push(new Paragraph({
      border, shading: { type: ShadingType.CLEAR, fill, color: 'auto' }, indent: { left: 160 },
      spacing: { after: 0, before: 80 }, keepNext: true,
      children: [new TextRun({ text: title, bold: true, color: BLUE })],
    }));
  }
  const paragraphs = Array.isArray(text) ? text : [text];
  paragraphs.forEach((t, i) => out.push(new Paragraph({
    border, shading: { type: ShadingType.CLEAR, fill, color: 'auto' }, indent: { left: 160 },
    spacing: { after: i === paragraphs.length - 1 ? 160 : 0, before: !title && i === 0 ? 80 : 0 },
    children: runs(t),
  })));
  return out;
}

// Zero-width spaces after underscores let long identifiers such as
// TRAVEL_REIMBURSEMENT wrap at the underscore instead of mid-word.
function cellContent(content, size, bold) {
  const items = Array.isArray(content) ? content : [content];
  return items.map((t) => new Paragraph({
    spacing: { after: 40 },
    children: runs(String(t).replace(/_/g, '_\u200B'), { size, bold }),
  }));
}

// Tables take the text width of the page they are on; landscape sections
// build their content inside withWidth(LANDSCAPE_WIDTH, ...).
let pageWidth = PORTRAIT_WIDTH;
export function withWidth(width, fn) {
  const previous = pageWidth;
  pageWidth = width;
  try {
    return fn();
  } finally {
    pageWidth = previous;
  }
}

// headers: string[]; rows: (string | string[])[][]; widths: relative numbers.
export function table(headers, rows, widths, { total = pageWidth, size = 18, headerFill = HEAD_FILL, firstColFill, align } = {}) {
  const sum = widths.reduce((a, b) => a + b, 0);
  const cols = widths.map((w) => Math.floor((w / sum) * total));
  cols[cols.length - 1] += total - cols.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: GRID };
  const borders = { top: border, bottom: border, left: border, right: border };
  const margins = { top: 60, bottom: 60, left: 100, right: 100 };

  const headerRow = headers && new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: cols[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: headerFill, color: 'auto' },
      borders, margins, verticalAlign: VerticalAlign.CENTER,
      children: cellContent(h, size, true),
    })),
  });
  const bodyRows = rows.map((row) => new TableRow({
    cantSplit: true,
    children: row.map((c, i) => new TableCell({
      width: { size: cols[i], type: WidthType.DXA },
      shading: i === 0 && firstColFill ? { type: ShadingType.CLEAR, fill: firstColFill, color: 'auto' } : undefined,
      borders, margins,
      children: cellContent(c, size, false),
    })),
  }));
  return [
    new Table({
      width: { size: total, type: WidthType.DXA },
      alignment: align,
      columnWidths: cols,
      rows: headerRow ? [headerRow, ...bodyRows] : bodyRows,
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}

// Two-column "label | text" table used for each design decision.
export function facts(pairs, opts = {}) {
  return table(null, pairs.map(([k, v]) => [`**${k}**`, v]), [22, 78], { firstColFill: 'F5F7FA', ...opts });
}

export function image(path, widthDxa, { maxHeightDxa } = {}) {
  const buf = fs.readFileSync(path);
  // PNG width/height live at bytes 16..24 of the IHDR chunk.
  const pxW = buf.readUInt32BE(16);
  const pxH = buf.readUInt32BE(20);
  let w = widthDxa / 15; // 1 px (96 dpi) = 15 DXA
  let h = (w * pxH) / pxW;
  if (maxHeightDxa && h * 15 > maxHeightDxa) {
    h = maxHeightDxa / 15;
    w = (h * pxW) / pxH;
  }
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60, before: 60, line: 240, lineRule: 'auto' },
    keepNext: true,
    children: [new ImageRun({ type: 'png', data: buf, transformation: { width: Math.round(w), height: Math.round(h) } })],
  });
}

// ---------------------------------------------------------------------------
// Headings and a table of contents with real page numbers (two-pass build)
// ---------------------------------------------------------------------------
export class Doc {
  constructor(title, pages = {}) {
    this.title = title;
    this.pages = pages; // heading text -> page number, from the previous pass
    this.headings = [];
  }

  h(level, text) {
    if (level <= 2) this.headings.push({ level, text });
    const heading = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][level - 1];
    return new Paragraph({ heading, keepNext: true, children: runs(text) });
  }

  // Entries for every level-1/2 heading; `headings` comes from a first run.
  toc(headings) {
    return headings.map(({ level, text }) => new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: PORTRAIT_WIDTH, leader: 'dot' }],
      indent: { left: level === 1 ? 0 : 360 },
      spacing: { after: level === 1 ? 60 : 30, before: level === 1 ? 100 : 0 },
      children: [
        ...runs(text, { bold: level === 1, size: level === 1 ? 21 : 20 }),
        new TextRun({ text: `\t${this.pages[text] ?? '00'}`, bold: level === 1, size: level === 1 ? 21 : 20 }),
      ],
    }));
  }
}

export function section(children, { landscape = false, title } = {}) {
  return {
    properties: {
      page: {
        size: { width: A4.width, height: A4.height, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
        margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: landscape ? LANDSCAPE_WIDTH : PORTRAIT_WIDTH }],
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: GRID, space: 4 } },
          children: [
            new TextRun({ text: title ?? '', size: 16, color: '777777' }),
            new TextRun({ children: ['\tPage ', PageNumber.CURRENT], size: 16, color: '777777' }),
          ],
        })],
      }),
    },
    children,
  };
}

export const documentStyles = {
  default: {
    document: { run: { font: 'Arial', size: 21 }, paragraph: { spacing: { line: 276, lineRule: 'auto' } } },
    heading1: {
      run: { font: 'Arial', size: 32, bold: true, color: BLUE },
      paragraph: { spacing: { before: 240, after: 160 }, keepNext: true },
    },
    heading2: {
      run: { font: 'Arial', size: 26, bold: true, color: BLUE },
      paragraph: { spacing: { before: 280, after: 120 }, keepNext: true },
    },
    heading3: {
      run: { font: 'Arial', size: 22, bold: true, color: '333333' },
      paragraph: { spacing: { before: 220, after: 100 }, keepNext: true },
    },
  },
};

export const numberingConfig = {
  config: [
    {
      reference: 'bullets',
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 260 } } } },
      ],
    },
    {
      reference: 'numbers',
      levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 300 } } } },
        { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2)', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 800, hanging: 300 } } } },
      ],
    },
  ],
};
