"""Draws the ER diagram and the relational schema diagram as SVG.

    python3 report/er/build_diagrams.py      # writes er_diagram.svg, schema_diagram.svg
    ./report/er/render.sh                    # converts both to PNG with headless Chrome

The ER diagram follows the notation of Silberschatz, Korth & Sudarshan,
Database System Concepts (7th ed.), Chapter 6; the schema diagram follows
Section 2.4. Coordinates are laid out by hand so no line crosses another.
"""
import math
from pathlib import Path

HERE = Path(__file__).parent
INK = '#1f2937'
MUTED = '#6b7280'
HEADER = '#e6edf7'
ACCENT = '#1d4ed8'
FONT = "font-family=\"'Liberation Sans', Arial, Helvetica, sans-serif\""


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


class Svg:
    def __init__(self, width, height):
        self.w, self.h = width, height
        self.parts = []

    def add(self, s):
        self.parts.append(s)

    def text(self, x, y, s, size=13, anchor='start', weight='normal', color=INK, italic=False, underline=None):
        style = ' font-style="italic"' if italic else ''
        if underline:
            style += f' style="text-decoration: underline {underline}; text-underline-offset: 3px"'
        self.add(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" '
                 f'font-weight="{weight}" fill="{color}"{style}>{esc(s)}</text>')

    def line(self, pts, width=1.4, dash=None, color=INK):
        d = 'M' + ' L'.join(f'{x},{y}' for x, y in pts)
        da = f' stroke-dasharray="{dash}"' if dash else ''
        self.add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}"{da} '
                 f'stroke-linejoin="miter"/>')

    def save(self, path):
        body = '\n'.join(self.parts)
        path.write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
            f'viewBox="0 0 {self.w} {self.h}" {FONT}>\n'
            f'<rect width="100%" height="100%" fill="white"/>\n{body}\n</svg>\n')


def unit(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy)
    return dx / n, dy / n


def shorten(pts, by):
    """Pulls the last point back along the final segment (room for an arrowhead)."""
    ux, uy = unit(pts[-2], pts[-1])
    x, y = pts[-1]
    return pts[:-1] + [(x - ux * by, y - uy * by)]


def arrowhead(svg, tip, frm, length=11, half=5):
    ux, uy = unit(frm, tip)
    bx, by = tip[0] - ux * length, tip[1] - uy * length
    px, py = -uy * half, ux * half
    svg.add(f'<polygon points="{tip[0]},{tip[1]} {bx + px},{by + py} {bx - px},{by - py}" fill="{INK}"/>')


def hollow_arrowhead(svg, tip, frm, length=17, half=10):
    ux, uy = unit(frm, tip)
    bx, by = tip[0] - ux * length, tip[1] - uy * length
    px, py = -uy * half, ux * half
    svg.add(f'<polygon points="{tip[0]},{tip[1]} {bx + px},{by + py} {bx - px},{by - py}" '
            f'fill="white" stroke="{INK}" stroke-width="1.6"/>')


def connector(svg, pts, double=False, arrow=False):
    """A relationship edge. arrow: a 'one' side (arrowhead at the last point).
    double: total participation (two parallel lines)."""
    body = shorten(pts, 10) if arrow else pts
    if double:
        svg.line(body, width=5.2)
        svg.line(body, width=2.0, color='white')
    else:
        svg.line(body, width=1.5)
    if arrow:
        arrowhead(svg, pts[-1], pts[-2])


def isa(svg, pts):
    body = shorten(pts, 16)
    svg.line(body, width=1.5)
    hollow_arrowhead(svg, pts[-1], pts[-2])


# ---------------------------------------------------------------------------
# ER diagram
# ---------------------------------------------------------------------------
ATTR_H = 20


def entity(svg, x, y, w, name, attrs, weak=False):
    """attrs: list of (text, kind) with kind in {'', 'pk', 'disc'}. Returns height."""
    h = 30 + 8 + ATTR_H * len(attrs) + (6 if attrs else 6)
    if weak:
        svg.add(f'<rect x="{x - 4}" y="{y - 4}" width="{w + 8}" height="{h + 8}" fill="white" '
                f'stroke="{INK}" stroke-width="1.5"/>')
    svg.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="white" stroke="{INK}" stroke-width="1.5"/>')
    svg.add(f'<rect x="{x}" y="{y}" width="{w}" height="30" fill="{HEADER}" stroke="{INK}" stroke-width="1.5"/>')
    svg.text(x + w / 2, y + 20, name, size=13.5, anchor='middle', weight='bold')
    for i, (text, kind) in enumerate(attrs):
        ty = y + 30 + 8 + ATTR_H * i + 14
        svg.text(x + 12, ty, text, size=14, underline={'pk': 'solid', 'disc': 'dashed'}.get(kind))
    return h


def diamond(svg, cx, cy, name, hw=64, hh=34, double=False):
    pts = f'{cx - hw},{cy} {cx},{cy - hh} {cx + hw},{cy} {cx},{cy + hh}'
    svg.add(f'<polygon points="{pts}" fill="white" stroke="{INK}" stroke-width="1.5"/>')
    if double:
        k = 7
        inner = f'{cx - hw + k * 1.9},{cy} {cx},{cy - hh + k} {cx + hw - k * 1.9},{cy} {cx},{cy + hh - k}'
        svg.add(f'<polygon points="{inner}" fill="none" stroke="{INK}" stroke-width="1.3"/>')
    svg.text(cx, cy + 4.5, name, size=12, anchor='middle', weight='bold')


def rel_attrs(svg, x, y, w, attrs):
    h = 8 + ATTR_H * len(attrs) + 4
    svg.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="white" stroke="{INK}" stroke-width="1.3"/>')
    for i, t in enumerate(attrs):
        svg.text(x + 10, y + 8 + ATTR_H * i + 13, t, size=14)
    return h


def card(svg, x, y, s, anchor='start'):
    svg.text(x, y, s, size=12, anchor=anchor, weight='bold', color=ACCENT)


def build_er(with_key=True):
    svg = Svg(1600, 1230 if with_key else 950)
    svg.text(40, 34, 'Reimbursement Management System — E-R diagram', size=19, weight='bold')
    svg.text(40, 56, 'Notation: Silberschatz, Korth & Sudarshan, Database System Concepts, 7th ed., Chapter 6'
             + (' (key at the bottom)' if with_key else ''), size=12.5, color=MUTED)
    svg.add('<g transform="translate(0,40)">')

    # --- Entity sets --------------------------------------------------------
    entity(svg, 60, 70, 200, 'DEPARTMENT', [('dept_id', 'pk'), ('dept_name', ''), ('location', '')])
    entity(svg, 600, 50, 220, 'EMPLOYEE', [
        ('employee_id', 'pk'), ('name', ''), ('email', ''), ('password_hash', ''),
        ('designation', ''), ('date_of_joining', ''), ('{ phone }', '')])
    entity(svg, 1000, 300, 200, 'MANAGER', [('approval_limit', '')])

    # Aggregation box around APPLICANT - SUBMITS - REIMBURSEMENT
    svg.add(f'<rect x="90" y="410" width="810" height="210" fill="none" stroke="{INK}" stroke-width="1.8"/>')
    svg.text(360, 434, 'CLAIM_PROCESS', size=13, weight='bold')
    svg.text(484, 434, '(aggregation of SUBMITS)', size=12, color=MUTED, italic=True)
    entity(svg, 120, 470, 210, 'APPLICANT', [('bank_account_no', '')])
    entity(svg, 620, 440, 220, 'REIMBURSEMENT', [
        ('reimbursement_id', 'pk'), ('claim_type', ''), ('claim_date', ''), ('status', ''),
        ('total_amount ( )', '')])

    entity(svg, 90, 730, 220, 'TRAVEL_REIMBURSEMENT', [('travel_from', ''), ('travel_to', ''), ('distance_km', '')])
    entity(svg, 330, 730, 220, 'MEDICAL_REIMBURSEMENT', [('hospital_name', ''), ('treatment_type', '')])
    entity(svg, 570, 730, 220, 'BUSINESS_REIMBURSEMENT', [('purpose', ''), ('client_name', '')])
    entity(svg, 1250, 718, 220, 'EXPENSE_ITEM', [
        ('item_no', 'disc'), ('category', ''), ('description', ''), ('amount', ''),
        ('expense_date', ''), ('receipt_path', '')], weak=True)

    # --- WORKS_IN: EMPLOYEE (N, total) -> DEPARTMENT (1) -------------------
    diamond(svg, 430, 122, 'WORKS_IN', hw=62)
    connector(svg, [(368, 122), (260, 122)], arrow=True)
    connector(svg, [(492, 122), (600, 122)], double=True)
    card(svg, 268, 114, '0..*')
    card(svg, 592, 114, '1..1', anchor='end')

    # --- SUPERVISES: recursive, role indicators ----------------------------
    diamond(svg, 1010, 142, 'SUPERVISES', hw=72)
    connector(svg, [(1010, 108), (1010, 80), (820, 80)], arrow=True)
    connector(svg, [(1010, 176), (1010, 205), (820, 205)])
    svg.text(915, 72, 'supervisor', size=12, anchor='middle', italic=True)
    svg.text(915, 222, 'subordinate', size=12, anchor='middle', italic=True)
    card(svg, 830, 98, '0..*')
    card(svg, 830, 198, '0..1')

    # --- ISA on EMPLOYEE: overlapping (separate arrows), partial -----------
    isa(svg, [(225, 470), (225, 280), (650, 280), (650, 234)])
    isa(svg, [(1100, 300), (1100, 266), (750, 266), (750, 234)])
    svg.text(640, 262, 'ISA: overlapping, partial', size=11.5, anchor='end', color=MUTED, italic=True)

    # --- SUBMITS: APPLICANT (1) -- REIMBURSEMENT (N, total) ----------------
    diamond(svg, 475, 512, 'SUBMITS', hw=58, hh=32)
    connector(svg, [(417, 512), (330, 512)], arrow=True)
    connector(svg, [(533, 512), (620, 512)], double=True)
    card(svg, 338, 504, '0..*')
    card(svg, 612, 504, '1..1', anchor='end')

    # --- APPROVES: MANAGER (1) -- CLAIM_PROCESS (N), both partial ----------
    diamond(svg, 1100, 470, 'APPROVES', hw=66)
    connector(svg, [(900, 470), (1034, 470)])
    connector(svg, [(1100, 436), (1100, 364)], arrow=True)
    card(svg, 908, 462, '0..1')
    card(svg, 1108, 384, '0..*')
    rel_attrs(svg, 1230, 444, 140, ['approval_date', 'remarks'])
    svg.line([(1166, 470), (1230, 470)], width=1.3, dash='5 4')

    # --- ISA on REIMBURSEMENT: disjoint (one shared arrow), total ----------
    svg.line([(200, 730), (200, 690), (680, 690)], width=1.5)
    svg.line([(440, 690), (440, 730)], width=1.5)
    svg.line([(680, 730), (680, 690)], width=1.5)
    isa(svg, [(680, 690), (680, 584)])
    svg.text(560, 657, 'total', size=13, weight='bold')
    svg.line([(596, 652), (668, 604)], width=1.2, dash='4 3')
    svg.text(100, 662, 'ISA: disjoint, total — defined on claim_type', size=11.5, color=MUTED, italic=True)

    # --- CONTAINS: identifying; REIMBURSEMENT (1, total) -- EXPENSE_ITEM (N, total)
    diamond(svg, 1100, 800, 'CONTAINS', hw=66, hh=36, double=True)
    connector(svg, [(1034, 800), (815, 800), (815, 584)], double=True, arrow=True)
    connector(svg, [(1166, 800), (1250, 800)], double=True)
    card(svg, 823, 606, '1..*')
    card(svg, 1242, 792, '1..1', anchor='end')

    svg.add('</g>')
    if not with_key:
        svg.save(HERE / 'er_diagram_nokey.svg')
        return
    # --- Key ------------------------------------------------------------------
    ky = 965
    svg.add(f'<rect x="40" y="{ky}" width="1520" height="245" fill="#f9fafb" stroke="#d1d5db"/>')
    svg.text(60, ky + 26, 'Key', size=14, weight='bold')

    def key_entity(x, y, weak=False):
        if weak:
            svg.add(f'<rect x="{x - 3}" y="{y - 3}" width="66" height="40" fill="white" stroke="{INK}"/>')
        svg.add(f'<rect x="{x}" y="{y}" width="60" height="34" fill="white" stroke="{INK}"/>')
        svg.add(f'<rect x="{x}" y="{y}" width="60" height="12" fill="{HEADER}" stroke="{INK}"/>')

    col1, col2, col3 = 60, 560, 1080
    r = [ky + 52, ky + 98, ky + 144, ky + 190]

    key_entity(col1, r[0] - 14)
    svg.text(col1 + 80, r[0] + 2, 'Entity set: name in the header, attributes below; primary key underlined')
    key_entity(col1, r[1] - 14, weak=True)
    svg.text(col1 + 80, r[1] + 2, 'Weak entity set (double rectangle); discriminator dashed-underlined')
    diamond(svg, col1 + 30, r[2], '', hw=28, hh=16)
    svg.text(col1 + 80, r[2] + 4, 'Relationship set')
    diamond(svg, col1 + 30, r[3], '', hw=28, hh=16, double=True)
    svg.text(col1 + 80, r[3] + 4, 'Identifying relationship of a weak entity (double diamond)')

    connector(svg, [(col2, r[0]), (col2 + 60, r[0])], arrow=True)
    svg.text(col2 + 80, r[0] + 4, 'Arrow: points to the "one" side of a relationship')
    svg.line([(col2, r[1]), (col2 + 60, r[1])], width=1.5)
    svg.text(col2 + 80, r[1] + 4, 'Plain line: the "many" side')
    connector(svg, [(col2, r[2]), (col2 + 60, r[2])], double=True)
    svg.text(col2 + 80, r[2] + 4, 'Double line: total participation (every entity takes part)')
    card(svg, col2 + 8, r[3] + 4, '0..*')
    svg.text(col2 + 80, r[3] + 4, 'l..h: min..max relationships each entity of that set takes part in')

    isa(svg, [(col3 + 30, r[0] + 14), (col3 + 30, r[0] - 14)])
    svg.text(col3 + 70, r[0] + 4, 'ISA (specialization): hollow arrowhead points to the superclass')
    svg.text(col3 + 70, r[1] + 4, 'Separate arrows = overlapping; one shared arrow = disjoint;')
    svg.text(col3 + 70, r[1] + 22, '"total" keyword = every superclass entity is in a subclass')
    svg.add(f'<rect x="{col3}" y="{r[2] + 8}" width="56" height="30" fill="white" stroke="{INK}" stroke-width="1.3"/>')
    svg.line([(col3 + 56, r[2] + 23), (col3 + 66, r[2] + 23)], width=1.2, dash='3 2')
    svg.text(col3 + 70, r[2] + 22, 'Descriptive attributes of a relationship (dashed link)')
    svg.text(col3 + 70, r[3] + 18, '{ phone } multivalued · total_amount ( ) derived · box = aggregation')

    svg.save(HERE / 'er_diagram.svg')




# ---------------------------------------------------------------------------
# Relational schema diagram (textbook Section 2.4)
# ---------------------------------------------------------------------------
ROW = 24


def table(svg, x, y, w, name, cols):
    """cols: list of (name, tags) with tags a string of flags: P=primary key, U=unique,
    F=foreign key, N=nullable. Returns dict of row centre y values."""
    h = 30 + ROW * len(cols)
    svg.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="white" stroke="{INK}" stroke-width="1.4"/>')
    svg.add(f'<rect x="{x}" y="{y}" width="{w}" height="30" fill="{HEADER}" stroke="{INK}" stroke-width="1.4"/>')
    svg.text(x + 10, y + 20, name, size=13.5, weight='bold')
    rows = {}
    for i, (col, tags) in enumerate(cols):
        cy = y + 30 + ROW * i + ROW / 2
        rows[col] = cy
        if i:
            svg.line([(x, cy - ROW / 2), (x + w, cy - ROW / 2)], width=0.6, color='#e5e7eb')
        svg.text(x + 10, cy + 4.5, col, underline='solid' if 'P' in tags else None)
        flags = [t for t, f in (('FK', 'F'), ('UQ', 'U'), ('null', 'N')) if f in tags]
        if flags:
            svg.text(x + w - 8, cy + 4, ' '.join(flags), size=10.5, anchor='end', color=MUTED)
    return rows


def fk(svg, pts):
    svg.line(shorten(pts, 9), width=1.4, color=ACCENT)
    ux, uy = unit(pts[-2], pts[-1])
    tip = pts[-1]
    bx, by = tip[0] - ux * 10, tip[1] - uy * 10
    px, py = -uy * 5, ux * 5
    svg.add(f'<polygon points="{tip[0]},{tip[1]} {bx + px},{by + py} {bx - px},{by - py}" fill="{ACCENT}"/>')


def build_schema():
    svg = Svg(1560, 760)
    svg.text(40, 34, 'Reimbursement Management System — relational schema diagram', size=19, weight='bold')
    svg.text(40, 56, 'Primary keys underlined. Arrows run from a foreign key to the primary key it references '
             '(textbook Section 2.4). FK = foreign key, UQ = unique (a candidate key), null = may be NULL.',
             size=12.5, color=MUTED)
    svg.add('<g transform="translate(0,40)">')

    ph = table(svg, 40, 70, 200, 'employee_phone', [('employee_id', 'PF'), ('phone', 'P')])
    dp = table(svg, 40, 214, 200, 'department', [('dept_id', 'P'), ('dept_name', 'U'), ('location', '')])
    em = table(svg, 310, 70, 220, 'employee', [
        ('employee_id', 'P'), ('name', ''), ('email', 'U'), ('password_hash', ''), ('designation', ''),
        ('date_of_joining', ''), ('dept_id', 'F'), ('supervisor_id', 'FN')])
    ap = table(svg, 620, 70, 210, 'applicant', [('employee_id', 'PF'), ('bank_account_no', 'U')])
    mg = table(svg, 620, 200, 210, 'manager', [('employee_id', 'PF'), ('approval_limit', '')])
    rb = table(svg, 930, 70, 230, 'reimbursement', [
        ('reimbursement_id', 'P'), ('applicant_id', 'F'), ('claim_type', ''), ('claim_date', ''),
        ('status', ''), ('approved_by', 'FN'), ('approval_date', 'N'), ('remarks', 'N')])
    ex = table(svg, 1260, 70, 250, 'expense_item', [
        ('reimbursement_id', 'PF'), ('item_no', 'P'), ('category', ''), ('description', ''),
        ('amount', ''), ('expense_date', ''), ('receipt_path', 'N')])
    tr = table(svg, 1260, 290, 250, 'travel_reimbursement', [
        ('reimbursement_id', 'PF'), ('travel_from', ''), ('travel_to', ''), ('distance_km', '')])
    md = table(svg, 1260, 450, 250, 'medical_reimbursement', [
        ('reimbursement_id', 'PF'), ('hospital_name', ''), ('treatment_type', '')])
    bz = table(svg, 1260, 586, 250, 'business_reimbursement', [
        ('reimbursement_id', 'PF'), ('purpose', ''), ('client_name', 'N')])

    fk(svg, [(240, ph['employee_id']), (310, em['employee_id'])])
    fk(svg, [(310, em['dept_id']), (240, dp['dept_id'])])
    fk(svg, [(530, em['supervisor_id']), (560, em['supervisor_id']), (560, em['employee_id']), (530, em['employee_id'])])
    fk(svg, [(620, ap['employee_id']), (530, ap['employee_id'])])
    fk(svg, [(620, mg['employee_id']), (585, mg['employee_id']), (585, em['employee_id']), (530, em['employee_id'])])
    fk(svg, [(930, rb['applicant_id']), (880, rb['applicant_id']), (880, ap['employee_id']), (830, ap['employee_id'])])
    fk(svg, [(930, rb['approved_by']), (880, rb['approved_by']), (880, mg['employee_id']), (830, mg['employee_id'])])
    fk(svg, [(1260, ex['reimbursement_id']), (1160, rb['reimbursement_id'])])
    for t in (tr, md, bz):
        fk(svg, [(1260, t['reimbursement_id']), (1215, t['reimbursement_id']), (1215, rb['reimbursement_id']), (1160, rb['reimbursement_id'])])

    svg.add('</g>')
    svg.text(40, 730, 'Lines that converge on one arrowhead reference the same primary key. Subclass tables (applicant, manager; '
             'travel/medical/business_reimbursement) use the superclass key as both their primary key and a foreign key.',
             size=12.5, color=MUTED)
    svg.save(HERE / 'schema_diagram.svg')


if __name__ == '__main__':
    build_er()
    build_er(with_key=False)
    build_schema()
    print('wrote er_diagram.svg, er_diagram_nokey.svg, schema_diagram.svg')
