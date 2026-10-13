"""Task 57: resize native AI images; leave generation and the depth tool unchanged."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache/hard-case-samples"
candidates = json.loads((ROOT / "tools/cdx-hard-case-candidates.json").read_text())
receipts = json.loads((CACHE / "generation.json").read_text())
paths = {r["file"]: r["nativePath"] for r in receipts}
out = ROOT / "assets/toys/photo-3d/ai"
records = []
for r in candidates:
    if r["file"] not in paths or not r.get("screening", {}).get("accepted", False):
        continue
    native = Path(paths[r["file"]])
    if hashlib.sha256(native.read_bytes()).hexdigest() != r["nativeSha256"]:
        raise RuntimeError(f'Native source hash changed: {r["file"]}')
    target = out / (r["file"] + ".jpg")
    if not target.exists():
        with Image.open(native) as image:
            image = image.convert("RGB")
            image.resize((1280, round(image.height * 1280 / image.width)), Image.Resampling.LANCZOS).save(target, quality=82, optimize=True)
    records.append({"file": r["file"], "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "nativeSha256": hashlib.sha256(native.read_bytes()).hexdigest(), "bytes": target.stat().st_size})
(CACHE / "prepared.json").write_text(json.dumps(records, indent=2) + "\n")
print(f"Prepared {len(records)} screened pictures, 1,280 px wide JPEGs (quality 82).")
