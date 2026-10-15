"""Task 58 evidence only: source candidates and actual phone-size render sheets.

Uses the repository's licensed Pillow 12.3.0. It does not alter shipping artwork.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache/qr-themes"
EVIDENCE = ROOT / "docs/audits/qr-theme-packs-2026-10"
font = ImageFont.truetype("DejaVuSans.ttf", 14)

for theme in ["seasons", "ocean", "forest", "space-art", "patterns", "celebrations"]:
    rows = json.loads((EVIDENCE / f"layout-{theme}.json").read_text())
    rows.sort(key=lambda r: (r["motif"], r["variant"]))
    sheet = Image.new("RGB", (1200, ((len(rows) + 4) // 5) * 280), "#f5f3ee")
    draw = ImageDraw.Draw(sheet)
    for i, row in enumerate(rows):
        x, y = (i % 5) * 240, (i // 5) * 280
        image = Image.open(CACHE / f'{row["id"]}.jpg').convert("RGB")
        image.thumbnail((232, 232))
        sheet.paste(image, (x + 4, y + 4))
        label = row["name"].replace(" (imaginary art)", "")
        draw.text((x + 4, y + 239), label, font=font, fill="#27313c")
        draw.text((x + 4, y + 257), f'Detail {row["score"]:.2f} · code-made', font=font, fill="#27313c")
    sheet.save(EVIDENCE / f"{theme}-candidates.jpg", quality=87)

selection = EVIDENCE / "selection.json"
if selection.exists():
    rows = json.loads(selection.read_text())
    for theme in ["seasons", "ocean", "forest", "space-art", "patterns", "celebrations"]:
        kept = [r for r in rows if r["theme"] == theme and r["kept"]]
        sheet = Image.new("RGB", (1384, 806), "#f5f3ee")
        draw = ImageDraw.Draw(sheet)
        for i, row in enumerate(kept):
            x, y = (i % 4) * 346, (i // 4) * 403
            image = Image.open(CACHE / f'{row["id"]}-phone.png').convert("RGB")
            assert image.size == (330, 330), image.size
            sheet.paste(image, (x + 8, y + 8))
            label = row["name"].replace(" (imaginary art)", "")
            draw.text((x + 8, y + 345), label, font=font, fill="#27313c")
            draw.text((x + 8, y + 365), f'Detail {row["score"]:.2f} · 10/10 links', font=font, fill="#27313c")
            draw.text((x + 8, y + 385), "Code-made · CC0" + (" · imaginary art" if theme == "space-art" else ""), font=font, fill="#27313c")
        sheet.save(EVIDENCE / f"{theme}-phone.jpg", quality=90)
