#!/usr/bin/env python3
"""Score fixed-scene recordings against their live canvas PNGs (task 89).
Build-time only: Python 3, NumPy, Pillow, and FFmpeg. Pass the evidence directory.
SSIM: equally weighted non-overlapping 8x8 luma windows, C1=(.01*255)^2,
C2=(.03*255)^2; sharpness: variance of the 4-neighbor luma Laplacian.
"""
import json
import pathlib
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

root = pathlib.Path(sys.argv[1])
rows = json.loads((root / "measurements.json").read_text())


def luma(file):
    rgb = np.asarray(Image.open(file).convert("RGB"), dtype=np.float64)
    return rgb @ np.array([0.2126, 0.7152, 0.0722])


def sharp(image):
    lap = image[:-2, 1:-1] + image[2:, 1:-1] + image[1:-1, :-2] + image[1:-1, 2:] - 4 * image[1:-1, 1:-1]
    return float(lap.var())


def ssim(a, b):
    if a.shape != b.shape:
        raise ValueError(f"Dimensions differ: {a.shape} vs {b.shape}")
    h, w = a.shape
    h, w = h // 8 * 8, w // 8 * 8
    x = a[:h, :w].reshape(h // 8, 8, w // 8, 8).transpose(0, 2, 1, 3).reshape(-1, 64)
    y = b[:h, :w].reshape(h // 8, 8, w // 8, 8).transpose(0, 2, 1, 3).reshape(-1, 64)
    mx, my = x.mean(1), y.mean(1)
    vx, vy = x.var(1), y.var(1)
    cov = ((x - mx[:, None]) * (y - my[:, None])).mean(1)
    return float((((2 * mx * my + 6.5025) * (2 * cov + 58.5225)) / ((mx * mx + my * my + 6.5025) * (vx + vy + 58.5225))).mean())


scores = []
for row in rows:
    ref_file = root / (row["key"] + "-reference.png")
    if not ref_file.exists():
        continue
    reference = luma(ref_file)
    frames = []
    pattern = root / (row["key"] + "-decoded-%02d.png")
    for old_frame in root.glob(row["key"] + "-decoded-[0-9][0-9].png"):
        old_frame.unlink()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(root / row["file"]), "-fps_mode", "passthrough", "-frames:v", "3", str(pattern)], check=True)
    decoded_files = sorted(root.glob(row["key"] + "-decoded-[0-9][0-9].png"))
    if not decoded_files:
        raise ValueError(f"No decoded video frames: {row['file']}")
    for file in decoded_files:
        decoded = luma(file)
        # The former Standard path could use odd dimensions. H.264 cropped
        # its final row/column; align those edges only, with no resampling.
        h, w = decoded.shape
        if reference.shape != decoded.shape and 0 <= reference.shape[0] - h <= 1 and 0 <= reference.shape[1] - w <= 1:
            aligned = reference[:h, :w]
        else:
            aligned = reference
        # Report raw SSIM first. A separate +/-1-pixel horizontal check makes
        # tiny capture offsets visible instead of silently registering them.
        h, w = decoded.shape
        candidates = [(ssim(aligned[:, 1:-1], decoded[:, 1 + dx:w - 1 + dx]), dx) for dx in [-1, 0, 1]]
        registered, dx = max(candidates)
        frames.append({"file": file.name, "ssim": ssim(aligned, decoded), "sharpness": sharp(decoded), "horizontalAlignmentSSIM": registered, "horizontalShiftPixels": dx})
    scores.append({"key": row["key"], "referenceSharpness": sharp(reference), "ssim": float(np.mean([f["ssim"] for f in frames])), "decodedSharpness": float(np.mean([f["sharpness"] for f in frames])), "horizontalAlignmentSSIM": float(np.mean([f["horizontalAlignmentSSIM"] for f in frames])), "frames": frames})
(root / "quality-scores.json").write_text(json.dumps(scores, indent=2) + "\n")
if "--compare-phone" in sys.argv:
    # Compare both levels at the same display size. Their separate saved/live
    # scores above measure compression, not the detail lost by Standard's
    # smaller render buffer. Keep the raw, unregistered results in both views.
    reference_image = Image.open(root / "after-phone-record-high-reference.png").convert("RGB")
    rgb = np.asarray(reference_image)
    ys, xs = np.nonzero((rgb < 240).any(axis=2))
    box = (int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1))
    luminance = lambda im: np.asarray(im, dtype=np.float64) @ np.array([0.2126, 0.7152, 0.0722])
    reference = luminance(reference_image)
    picture = luminance(reference_image.crop(box))
    comparison = []
    examples = []
    for quality in ["standard", "high"]:
        frames = []
        for file in sorted(root.glob(f"after-phone-record-{quality}-decoded-[0-9][0-9].png")):
            decoded = Image.open(file).convert("RGB").resize(reference_image.size, Image.Resampling.LANCZOS)
            if not frames:
                examples.append(decoded)
            crop = luminance(decoded.crop(box))
            frames.append({"file": file.name, "fullSSIM": ssim(reference, luminance(decoded)), "pictureSSIM": ssim(picture, crop), "pictureSharpness": sharp(crop)})
        if not frames:
            raise ValueError(f"No phone {quality} frames")
        comparison.append({"quality": quality, "pictureSSIM": float(np.mean([f["pictureSSIM"] for f in frames])), "pictureSharpness": float(np.mean([f["pictureSharpness"] for f in frames])), "frames": frames})
    result = {"displaySize": reference_image.size, "pictureCrop": box, "referencePictureSharpness": sharp(picture), "method": "First three decoded frames; Lanczos resize to the High live display size; picture crop is the live non-white bounding box; no registration.", "levels": comparison}
    (root / "phone-comparison.json").write_text(json.dumps(result, indent=2) + "\n")
    # A centered, unscaled detail crop lets the owner inspect the difference.
    x, y = (box[0] + box[2]) // 2 - 160, (box[1] + box[3]) // 2 - 160
    sheet = Image.new("RGB", (960, 355), "white")
    draw = ImageDraw.Draw(sheet)
    for i, (label, im) in enumerate(zip(["Standard at display size", "High at display size", "Live display reference"], examples + [reference_image])):
        draw.text((i * 320 + 5, 5), label, fill="black")
        sheet.paste(im.crop((x, y, x + 320, y + 320)), (i * 320, 35))
    sheet.save(root / "phone-detail-comparison.png")
print(json.dumps(scores, indent=2))
