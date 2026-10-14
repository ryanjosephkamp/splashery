"""Task 54: format conversion and contact sheets (Pillow, already licensed)."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
cache = ROOT / ".cache/cdx-pics"
candidates = json.loads((ROOT / "tools/cdx-pics-candidates.json").read_text())
generated = json.loads((cache / "generation-base.json").read_text())
generated += [json.loads(p.read_text()) for p in sorted((cache / "photo").glob("*.json"))]
paths = {r["id"]: r["path"] for r in generated}
out = ROOT / "assets/toys/photo-3d/ai"
out.mkdir(parents=True, exist_ok=True)
rows = []
for i, (ident, name, group, scene) in enumerate(candidates):
    if ident not in paths:
        continue
    dest = out / f"cdx-{ident}.jpg"
    with Image.open(paths[ident]) as im:
        im = im.convert("RGB")
        native = list(im.size)
        im.resize((1280, round(im.height * 1280 / im.width)), Image.Resampling.LANCZOS).save(dest, quality=80, optimize=True)
    rows.append([f"C54-P{i+1:02}", f"cdx-{ident}", name, f"More {group}"])
module = "// Task 54: selected AI-made Studio pictures; see the scored audit.\nexport const PICTURES = " + json.dumps(rows, indent=2) + ";\n"
(ROOT / "src/packs/codex-picture-samples.js").write_text(module)
(cache / "generated.json").write_text(json.dumps([{"id": k, "path": v} for k, v in paths.items()], indent=2))
print(f"Prepared {len(rows)} pictures (1,280 px wide, JPEG q80).")

def sheet(items, file, columns=5):
    cell_w, cell_h = 240, 190
    im = Image.new("RGB", (columns * cell_w, ((len(items) + columns - 1) // columns) * cell_h), "#f0ede7")
    draw = ImageDraw.Draw(im)
    for i, (name, pic) in enumerate(items):
        with Image.open(pic) as p:
            p = p.convert("RGB")
            p.thumbnail((cell_w-8, cell_h-32))
            x, y = (i % columns) * cell_w, (i // columns) * cell_h
            im.paste(p, (x + (cell_w-p.width)//2, y))
            draw.text((x+6, y+cell_h-28), name, fill="#222222")
    im.save(file, quality=85, optimize=True)

sheet([(r[0]+" "+r[2], out / f"{r[1]}.jpg") for r in rows], cache / "photo-contact.jpg")
