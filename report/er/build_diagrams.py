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


