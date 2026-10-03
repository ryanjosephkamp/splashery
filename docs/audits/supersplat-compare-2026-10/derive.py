"""Derive audit tables and validate the 5 x 2 x 2 observation matrix.
Run from the repository root: python3 docs/audits/supersplat-compare-2026-10/derive.py
This script reads observations and baseline assets; it does not run a browser benchmark.
"""
import csv
import hashlib
import json
import math
import statistics
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def read(name):
    return json.loads((HERE / name).read_text())


def write(name, data):
    (HERE / name).write_text(json.dumps(data, indent=2) + "\n")


# One repeated strawberry/Splashery/narrow run is retained in collection-attempts.
# Use the last completed run for every cell, rather than selecting the fastest run.
raw = read("collection-attempts.json")
canonical = {}
for row in raw:
    key = (row["id"], row["site"], row["size"]["width"])
    canonical[key] = row
rows = list(canonical.values())
write("measurements.json", rows)
source = {
    "strawberry": (1499098, "22.94 MB", "danylyon"),
    "bee": (978285, "10.95 MB", "yyouzhen"),
    "bmx-bike": (495006, "8.49 MB", "eecorn"),
    "cave-lioness": (1855777, "49.5 MB", "sdimaging"),
    "toy-trex": (684274, "11.73 MB", "alfred2010"),
}
assets = []
for name in source:
    for suffix in ["-lite", ""]:
        path = ROOT / f"assets/toys/{name}/{name}{suffix}.sog"
        content = path.read_bytes()
        assets.append({"id": name, "tier": "low" if suffix else "high", "path": str(path.relative_to(ROOT)), "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})
write("asset-sizes.json", assets)


def intervals(data, event):
    times = [t for t in data[event] if data["windowStartMs"] <= t <= data["windowEndMs"]]
    return [b - a for a, b in zip(times, times[1:])]


def stats(values):
    values = sorted(values)
    return {"n": len(values), "median": statistics.median(values), "p95": values[math.ceil(0.95 * len(values)) - 1]}


summary = []
for row in rows:
    data = row["data"]
    cadence = stats(intervals(data, "frameends"))
    rendered = stats(intervals(data, "renders"))
    wire = sum(e.get("encodedDataLength", 0) for e in row["network"] if e["method"] == "Network.loadingFinished")
    summary.append({"id": row["id"], "site": row["site"], "width": row["size"]["width"], "height": row["size"]["height"], "url": row["url"], "profile": data["profile"], "loaded_splats": data["splats"], "drawn_splats_at_end": data["drawnSplats"], "readiness_upper_bound_ms": data["firstFrameMs"], "loaded_at_hook": data["alreadyLoadedAtHook"], "frame_interval_n": cadence["n"], "frame_interval_median_ms": cadence["median"], "frame_interval_p95_ms": cadence["p95"], "render_interval_n": rendered["n"], "render_interval_median_ms": rendered["median"], "render_interval_p95_ms": rendered["p95"], "observed_wire_bytes_lower_bound": wire, "observed_requests_lower_bound": len({e["requestId"] for e in row["network"] if e["method"] == "Network.requestWillBeSent"}), "network_buffer_truncated": row["networkEventsTruncated"], "recorded_errors": len(data["errors"]), "sample_window_ms": data["windowEndMs"] - data["windowStartMs"]})
write("summary.json", summary)
with (HERE / "summary.csv").open("w", newline="") as f:
    out = csv.DictWriter(f, fieldnames=list(summary[0]), lineterminator="\n")
    out.writeheader()
    out.writerows(summary)

from PIL import Image, ImageDraw
images = []
for name in source:
    for site in ["splashery", "supersplat"]:
        for width, height in [(390, 844), (1440, 900)]:
            path = HERE / f"screenshots/{site}-{name}-{width}x{height}.jpg"
            with Image.open(path) as im:
                assert im.size == (width, height), (path, im.size)
            images.append({"path": str(path.relative_to(HERE)), "width": width, "height": height, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
write("image-validation.json", images)
# Inspection montage only; the individual screenshots remain unedited.
sheet = Image.new("RGB", (1000, 1800), "#eeeeee")
draw = ImageDraw.Draw(sheet)
for index, record in enumerate(images):
    x, y = (index % 4) * 250, (index // 4) * 360
    im = Image.open(HERE / record["path"])
    im.thumbnail((230, 305))
    draw.text((x + 5, y + 8), Path(record["path"]).stem, fill="black")
    sheet.paste(im, (x + (250 - im.width) // 2, y + 35))
sheet.save(HERE / "contact-sheet.jpg", quality=90)
assert len(rows) == 20
assert len(canonical) == 20
assert set(canonical) == {(name, site, width) for name in source for site in ["splashery", "supersplat"] for width in [390, 1440]}
for row in rows:
    data = row["data"]
    assert data["done"] and not data["errors"]
    assert data["canvas"] == row["size"]
    assert data["viewport"]["dpr"] == 1
    assert data["renderer"] == "webgpu"
    assert data["firstFrameMs"] >= data["hookMs"] > 0
    assert data["windowEndMs"] > data["windowStartMs"] > data["firstFrameMs"]
    assert data["splats"] > 0
write("validation.json", {"canonical_rows": len(rows), "collection_attempts": len(raw), "screenshots": len(images), "matrix_complete": True, "all_captures_exact_dimensions": True, "all_measurement_canvases_exact_dimensions": True, "all_webgpu": True, "all_dpr_1": True, "no_recorded_page_errors": True, "network_buffers_truncated": sum(r["network_buffer_truncated"] for r in summary), "startup_hooks_after_loaded": sum(r["loaded_at_hook"] for r in summary), "frame_interval_min_samples": min(r["frame_interval_n"] for r in summary), "frame_interval_max_samples": max(r["frame_interval_n"] for r in summary)})
print(json.dumps(read("validation.json"), indent=2))
