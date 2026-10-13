"""Task 57: evidence contact sheets and the complete candidate score table."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/audits/hard-case-samples-2026-10"
CACHE = ROOT / ".cache/hard-case-samples"
rows = json.loads((OUT / "photo-scores.json").read_text())
candidates = {r["file"]: r for r in json.loads((ROOT / "tools/cdx-hard-case-candidates.json").read_text())}
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
except OSError:
    font = ImageFont.load_default(size=14)

def sheet(items, target, columns, cell_w, cell_h, get_path):
    canvas = Image.new("RGB", (columns * cell_w, ((len(items) + columns - 1) // columns) * cell_h), "#f0ede7")
    draw = ImageDraw.Draw(canvas)
    for i, r in enumerate(items):
        x, y = (i % columns) * cell_w, (i // columns) * cell_h
        with Image.open(get_path(r)) as image:
            image = image.convert("RGB")
            image.thumbnail((cell_w - 12, cell_h - 58))
            canvas.paste(image, (x + (cell_w - image.width) // 2, y))
        draw.text((x + 6, y + cell_h - 54), f'{r["prompt"]} {r["name"]}', font=font, fill="#222222")
        draw.text((x + 6, y + cell_h - 34), f'{r["score"]:.3f} / {"KEEP" if r["kept"] else "CUT"} / {r["category"]}', font=font, fill="#222222")
    canvas.save(target, quality=86, optimize=True)

rows.sort(key=lambda r: r["prompt"])
kept = [r for r in rows if r["kept"]]
sheet(rows, OUT / "candidates.jpg", 4, 320, 260, lambda r: CACHE / "candidates" / (r["file"] + ".jpg"))
sheet(kept, OUT / "kept-worst-poses.jpg", 4, 390, 570, lambda r: CACHE / "views" / (r["file"] + ".png"))
sheet(kept, OUT / "kept-pictures.jpg", 4, 320, 260, lambda r: CACHE / "candidates" / (r["file"] + ".jpg"))

parts = ["""# Hard-case samples: October 13, 2026

Codex (GPT-6) built this for Ryan on `codex/hard-case-samples`, from main commit `a2189958`.
40 original AI-made pictures were generated and visually screened; the best 20 measured pictures
are offered in Photo to 3D's **AI-made by the owner: Hard cases** group. All seven hard cases are
covered. Every option ends with **(AI-made)** and carries the existing **AI-made by the owner**
credit. Nothing is merged.

## Generation, assets, and scope

The [candidate manifest](../../tools/cdx-hard-case-candidates.json) contains all 40 scene prompts,
native source hashes, dimensions, and visual screening notes. Every picture was generated
individually through the OpenAI native image tool; its exact model identity was not returned.
The pictures are fictional, with no people, text, logos, or real landmarks seen during screening.
Animals appear in profile or back view. The prompts deliberately preserve glass, water, fine hair,
thin structures, reflections, dim lighting, macro detail, and clutter as difficult input features.
They do not replace those features with opaque toy materials.

Generation is nondeterministic. Native 1,536×1,024 PNGs were resized to 1,280×853 JPEGs at quality
82 with Pillow. The unchanged `tools/dsm-depth.mjs` ran the actual vendored Depth Anything V2 Small
model through the browser's on-device depth worker. An inference-only page preload skipped
rendering the unrelated opening toy for the later batches; the dsm-depth tool, decoder, model,
worker, and output were unchanged. Each resulting depth map is 518×350 and
362,612 bytes. [Asset records](hard-case-samples-2026-10/asset-records.json) include JPEG, depth,
and source SHA-256 hashes. Retained files live in `assets/toys/photo-3d/hard-cases/`. Full-size
discarded pictures and their maps stay in the ignored cache; only their contact-sheet previews
and scores enter the report. New images and maps load only when picked, without loading the model.

At the start, PRs #560, #562, #566, #581, and #582 were all open. Their implementation files,
`manual/`, and `tests/taps.spec.mjs` are untouched. Task 54's list is not edited: this round uses
`hard-case-pictures.js` and `hard-case-samples.js`. A small lazy hook in `src/player.js` registers
the choices after the existing Photo to 3D pack loads. Registration preserves every existing
choice and default and avoids duplicates on repeated builds. The task's explicit instruction to
record every retained sample in `CREDITS.md` and `tools/assets.json` is followed with additive
entries only; existing asset records and credits are not rewritten.

## Browser scores and selection

Task 53 remains open, so this uses task 54's documented simple proxies, implemented in
[the scoring tool](../../tools/cdx-hard-case-score.mjs). Each candidate is decoded with its real
depth map, installed as the toy's custom photo, and rendered by the existing Sharp view in
Chromium 151 with SwiftShader WebGL2, the mid profile, Depth 0.5, and fully raised relief.
The viewport is 390×844; the stage is fixed to 390×520, device scale factor 1. Eight poses are
measured: −30°, −20°, +20°, and +30°, separately in yaw and pitch.

- Holes: exact magenta backdrop pixels inside each rendered row's first/last surface pixels,
  inset eight pixels, excluding the top/bottom eight rows. The fraction omits border losses and
  does not measure every disocclusion.
- Edge halo proxy: identify up to 240 strong depth jumps, project both endpoints, and sample seven
  points between them. Average RGB excursions beyond the two source colors' per-channel range,
  with an eight-byte tolerance, normalized by 255. Texture, shadows, and occlusion can contribute;
  this does not measure blur or establish exact pixel correspondence.
- Score: `100 - max_pose(70 × hole_fraction + 30 × halo_excursion)`. The worst pose sets the score.
  The table reports separate maximum holes and maximum halo across poses; these maxima can occur
  at different poses. All counts and all eight poses are in
  [photo-scores.json](hard-case-samples-2026-10/photo-scores.json).
- Selection retains the highest two eligible scores in each of the seven categories, then the
  six highest remaining scores. This gives every hard case representation without letting an
  easy category fill the picker. All candidates passed visual content screening. Discarded
  candidates were cut for lower measured scores after coverage, rather than content violations.

These relative scores compare this finite set under these settings. They are not ground-truth
depth accuracy or a certification of perfect glass, fur, reflections, or wide-angle geometry.
Large-angle artifacts remain visible, particularly around occlusions and fine silhouettes.
The toy and its renderer were not changed to improve the scores.

![All 40 candidates with scores and decisions](hard-case-samples-2026-10/candidates.jpg)

![The kept 20 source pictures](hard-case-samples-2026-10/kept-pictures.jpg)

![The kept 20 at their worst measured poses](hard-case-samples-2026-10/kept-worst-poses.jpg)

## Phone-size motion review

The [320-pixel tap clip](hard-case-samples-2026-10/bicycle-tap-320.mp4) uses the kept bicycle-spokes
sample with the unchanged Photo to 3D tap effect. `tools/effect-clip.mjs` captured the actual
browser animation at eight frames per second, including 0.4 seconds before the tap and 4.5 seconds
after it. The eight-frame strip was inspected: the relief rises and sways, with near surfaces
moving across the background. Existing wide-angle relief losses are also visible in the scored
contact sheet. No new motion or physics was added.

![Eight frames of the existing tap effect on bicycle spokes](hard-case-samples-2026-10/bicycle-tap-strip.jpg)

## Every candidate

| Candidate | Name | Hard case | Score | Worst holes | Worst halo | Decision |
| --- | --- | --- | ---: | ---: | ---: | --- |
"""]
for r in rows:
    holes = max(p["holeFraction"] for p in r["poses"])
    halo = max(p["haloExcursion"] for p in r["poses"])
    parts.append(f'| {r["prompt"]} | {r["name"]} | {r["category"]} | {r["score"]:.3f} | {100 * holes:.4f}% | {halo:.4f} | {"Keep" if r["kept"] else "Cut"} |\n')
parts.append("\n## Kept 20 and coverage\n\n| Hard case | Kept pictures |\n| --- | --- |\n")
for category in dict.fromkeys(r["category"] for r in rows):
    names = ", ".join(f'{r["name"]} ({r["prompt"]})' for r in kept if r["category"] == category)
    parts.append(f"| {category} | {names} |\n")
parts.append("""
## Reproduction

Generate the 40 manifest prompts individually through the native image tool. Preserve local
receipts as `.cache/hard-case-samples/generation.json` with `file` and `nativePath`; the public
manifest records hashes and screening, without local absolute paths.

```sh
python3 -m http.server 4173 --bind 127.0.0.1
python3 tools/cdx-hard-case-prepare.py
# Pass all 40 manifest file IDs to the unchanged depth tool:
SPLASHERY_CHROMIUM=/usr/bin/chromium node --import ./tools/cdx-hard-case-depth-page.mjs tools/dsm-depth.mjs cdx-hard-glass-jug ...
SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/cdx-hard-case-score.mjs
node tools/cdx-hard-case-select.mjs
# On a fresh branch, before the entries have been registered:
node tools/cdx-hard-case-records.mjs
python3 tools/cdx-hard-case-report.py
```

The scoring tool resumes from complete candidate rows in `photo-scores.json`; remove that file
to remeasure. Selection moves full-size candidate copies out of the shipped AI directory and
retains only the chosen 20 in `hard-cases/`. Registry generation refuses duplicate entries.

## Verification and limits

The [verification record](hard-case-samples-2026-10/verification.md) lists exact browser checks,
results, and any failures. The task-specific spec verifies all 20 pictures decode at 1,280 px,
their source/depth hashes match, all seven categories are represented, labels and credits are
present, registration is idempotent, files load only when selected, and each selected picture
changes from flat to raised in the actual browser without downloading the depth runtime.

No physical phone, camera, or ground-truth depth capture was tested. No renderer pixels or model
outputs were mocked. No Effect review publishing tool is available in this environment; the
phone-size worst-pose contact sheet is included for review. Rule check: none.
""")
(ROOT / "docs/audits/hard-case-samples-2026-10.md").write_text("".join(parts))
size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
if size >= 8_000_000:
    raise RuntimeError(f"Report folder is too large: {size} bytes")
print(f"Report and three contact sheets written; folder {size:,} bytes.")
