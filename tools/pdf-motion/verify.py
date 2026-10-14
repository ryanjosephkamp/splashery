#!/usr/bin/env python3
"""Inspect exported payloads and render posters; this does not test native playback."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

from PIL import Image, ImageDraw
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/audits/pdf-motion-2026-10"
LIVE = "https://ryanjosephkamp.github.io/splashery/embed/?toy=grapes"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def annot(reader, subtype):
    return next(a.get_object() for a in reader.pages[0]["/Annots"] if a.get_object()["/Subtype"] == subtype)


artifacts = []
posters = []
renderer = os.environ.get("PDFTOPPM", "pdftoppm")
with tempfile.TemporaryDirectory(prefix="splashery-pdf-check-") as tmp:
    for file in sorted(OUT.glob("*.pdf")):
        assert file.stat().st_size <= 15_000_000, file
        reader = PdfReader(file, strict=True)
        assert reader.pages and all(p.extract_text().strip() for p in reader.pages), file
        artifacts.append({"file": file.name, "bytes": file.stat().st_size, "pages": len(reader.pages), "sha256": digest(file.read_bytes())})
        dest = str(Path(tmp) / file.stem)
        subprocess.run([renderer, "-f", "1", "-singlefile", "-scale-to", "800", "-png", str(file), dest], check=True)
        poster = Image.open(dest + ".png").convert("RGB")
        posters.append((file.name, poster.copy()))
        if file.name == "05-still-link-qr.pdf":
            poster.save(OUT / "qr-poster.png")
    contact = Image.new("RGB", (1200, 840), "#e8edea")
    draw = ImageDraw.Draw(contact)
    for i, (label, poster) in enumerate(posters):
        poster.thumbnail((280, 790))
        x, y = (i % 4) * 300 + 10, (i // 4) * 420 + 40
        draw.text((x, y - 24), label, fill="#18392f")
        contact.paste(poster, (x, y))
    # Contact sheet contains static renderings, never a playback receipt.
    contact.crop((0, 0, 1200, 420 * ((len(posters)+3)//4))).save(OUT / "posters.png")

fields = PdfReader(OUT / "02-pdfium-fields.pdf", strict=True)
assert len(fields.get_fields()) == 66
script = fields.trailer["/Root"]["/Names"]["/JavaScript"]["/Names"][1].get_object()["/JS"]
assert str(script) == (OUT / "field-animation.js").read_text()
frames = json.loads((OUT / "field-frames.json").read_text())
assert len(frames) == 40 and all(len(f) == 64 and all(len(row) == 96 for row in f) for f in frames)
assert len({json.dumps(f) for f in frames}) > 20

three = annot(PdfReader(OUT / "03-point-cloud.pdf", strict=True), "/3D")
prc = three["/3DD"].get_data()
assert prc[:3] == b"PRC" and prc == (OUT / "grapes.prc").read_bytes()
assert three["/3DD"]["/Subtype"] == "/PRC"

video = PdfReader(OUT / "04-embedded-video.pdf", strict=True)
screen = annot(video, "/Screen")
embedded = screen["/A"]["/R"]["/C"]["/D"]["/EF"]["/F"].get_data()
assert embedded == (OUT / "grapes.mp4").read_bytes()
assert video.attachments["grapes.mp4"][0] == embedded
probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height,r_frame_rate,nb_frames,duration", "-of", "json", str(OUT / "grapes.mp4")]))["streams"][0]
assert probe["codec_name"] == "h264" and probe["nb_frames"] == "40"
assert probe["width"] == probe["height"] == 420 and probe["r_frame_rate"] == "8/1"
assert float(probe["duration"]) == 5

plain = PdfReader(OUT / "05-still-link-qr.pdf", strict=True)
assert annot(plain, "/Link")["/A"]["/URI"] == LIVE
html = PdfReader(OUT / "06-html-attachment.pdf", strict=True)
assert html.attachments["open-grapes.html"][0] == (OUT / "open-grapes.html").read_bytes()
pages = PdfReader(OUT / "07-page-flip.pdf", strict=True)
assert len(pages.pages) == 10 and all(float(p["/Dur"]) == .5 for p in pages.pages)

film = Image.new("RGB", (1260, 454), "white")
draw = ImageDraw.Draw(film)
for i, frame in enumerate((0, 12, 24)):
    film.paste(Image.open(OUT / f"frames/frame-{frame:03d}.jpg"), (i*420, 0))
    draw.text((i*420+12, 432), f"Source frame {frame} / {frame/8:.1f} seconds", fill="black")
film.save(OUT / "source-filmstrip.jpg", quality=90)

(OUT / "build.json").write_text(json.dumps({"artifacts": artifacts}, indent=2) + "\n")
(OUT / "validation.json").write_text(json.dumps({
    "scope": "Structural payload checks and Poppler static rendering; native playback is separate.",
    "strictParsedPdfs": len(artifacts), "allUnder15MB": True,
    "textPresentOnEveryPage": True, "formFields": 66, "distinctFieldFrames": len({json.dumps(f) for f in frames}),
    "prcPayloadMatchesSource": True, "prcBytes": len(prc),
    "videoPayloadAndAttachmentMatchSource": True, "video": probe,
    "htmlAttachmentMatchesSource": True, "linkTarget": LIVE,
    "pageFlipPages": 10, "qrRasterDecode": "Run verify-qr.mjs separately.",
}, indent=2) + "\n")
print(f"Checked and rendered {len(artifacts)} PDFs. Native playback is not implied.")
