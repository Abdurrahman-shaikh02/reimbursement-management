# Crops the screenshots used as figures in the submission report (report/src/submission.js)
# to the part that matters, leaving out the navigation sidebar. Output: report/screenshots/report/.
#   python3 report/screenshots/crop_for_report.py
from pathlib import Path
from PIL import Image

HERE = Path(__file__).parent
OUT = HERE / 'report'
SIDEBAR = 244  # px; the main content starts here

# name -> list of (top, bottom) bands, stacked vertically
CROPS = {
    '03_new_claim': [(76, 1000)],
    '06_approvals': [(76, 1130)],
    '07_approve_over_limit_blocked': [(76, 400), (965, 1295)],  # claim amount, then the decision panel
    '14_reports': [(76, 1050)],
}

OUT.mkdir(exist_ok=True)
for name, bands in CROPS.items():
    src = Image.open(HERE / f'{name}.png').convert('RGB')
    parts = [src.crop((SIDEBAR, top, src.width, bottom)) for top, bottom in bands]
    gap = 12
    out = Image.new('RGB', (parts[0].width, sum(p.height for p in parts) + gap * (len(parts) - 1)), (244, 245, 246))
    y = 0
    for part in parts:
        out.paste(part, (0, y))
        y += part.height + gap
    out.save(OUT / f'{name}.png', optimize=True)
    print('wrote', name, out.size)
