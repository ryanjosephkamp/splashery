#!/usr/bin/env python3
"""Build PDF motion experiments from capture.mjs output. No site files change."""
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile

from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color, HexColor
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject, BooleanObject, DecodedStreamObject, DictionaryObject,
    FloatObject, NameObject, NumberObject, TextStringObject,
)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/audits/pdf-motion-2026-10"
LIVE = "https://ryanjosephkamp.github.io/splashery/embed/?toy=grapes"
RECT = [96, 230, 516, 650]


def formatted(source, parser):
    return subprocess.check_output(["node", str(ROOT / "node_modules/prettier/bin/prettier.cjs"), "--parser", parser], input=source.encode()).decode()


def name(value):
    return NameObject("/" + value)


def obj(**values):
    return DictionaryObject({name(k): v for k, v in values.items()})


def nums(values):
    return ArrayObject([FloatObject(v) for v in values])


def stream(data, **values):
    result = DecodedStreamObject()
    result.set_data(data)
    result.update(obj(**values))
    return result


def page_pdf(title, lines, image=True):
    data = io.BytesIO()
    c = canvas.Canvas(data, pagesize=(612, 792), invariant=1)
    c.setTitle(title)
    c.setAuthor("Splashery / Codex")
    c.setFillColor(HexColor("#18392f"))
    c.setFont("Helvetica-Bold", 23)
    c.drawString(48, 736, title)
    c.setFillColor(HexColor("#333333"))
    c.setFont("Helvetica", 11)
    c.drawString(48, 710, "A real grapes toy, exported from Splashery. October 4, 2026.")
    if image:
        c.drawImage(str(OUT / "frames/frame-000.jpg"), 96, 230, 420, 420)
    c.setFont("Helvetica", 11)
    for i, line in enumerate(lines):
        c.drawString(48, 203 - 17 * i, line)
    c.setFillColor(HexColor("#126648"))
    c.drawString(48, 115, "Open the live toy in your browser")
    c.linkURL(LIVE, (48, 109, 275, 130), relative=0)
    c.setFillColor(HexColor("#666666"))
    c.setFont("Helvetica", 8)
    c.drawString(48, 40, "Prototype for viewer testing. A poster is not proof that the active content works.")
    c.showPage()
    c.save()
    return data.getvalue()


def writer_for(title, lines, image=True):
    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(page_pdf(title, lines, image))))
    writer.pdf_header = b"%PDF-1.7"
    return writer


def save(writer, filename):
    writer.write(OUT / filename)


def annotation(writer, value):
    page = writer.pages[0]
    page.setdefault(name("Annots"), ArrayObject()).append(writer._add_object(value))


def poster(writer):
    # Reuse the page's already embedded JPEG, so disabled annotations remain useful.
    xobjects = writer.pages[0]["/Resources"]["/XObject"]
    key = next(iter(xobjects))
    return writer._add_object(stream(
        f"q 420 0 0 420 0 0 cm {key} Do Q".encode(),
        Type=name("XObject"), Subtype=name("Form"), BBox=nums([0, 0, 420, 420]),
        Resources=obj(XObject=DictionaryObject({NameObject(key): xobjects.raw_get(key)})),
    ))


def animate_sources():
    for method in ("widget", "ocg"):
        filename = f"01-animate-{method}"
        tex = r"""\documentclass[11pt]{article}
\usepackage[letterpaper,margin=0.65in]{geometry}
\usepackage{graphicx,xcolor,animate,hyperref}
\pagestyle{empty}
\begin{document}
\noindent{\LARGE\bfseries Grapes: a PDF flip book}\par\medskip
\noindent A real Splashery effect. Forty frames at eight frames per second.\par
\noindent October 4, 2026. METHOD frames with PDF JavaScript.\par\bigskip
\begin{center}
\animategraphics[method=METHOD,controls,loop,poster=first,width=5.4in]{8}{frames/frame-}{000}{039}
\end{center}
\noindent Press the right-pointing play triangle under the picture.\par
\noindent VIEWERS\par
\noindent If only the poster shows, this viewer may not support these controls.\par\medskip
\noindent\href{LIVEURL}{Open the real interactive toy in your browser.}\par
\vfill\noindent\small A recording of the effect, not the WebGL engine running in a PDF.
\end{document}
""".replace("METHOD", method).replace("LIVEURL", LIVE).replace("VIEWERS", "Test in desktop Acrobat Reader or " + ("current Firefox." if method == "widget" else "Okular."))
        (OUT / f"{filename}.tex").write_text(tex)
        with tempfile.TemporaryDirectory(prefix="splashery-animate-") as tmp:
            for _ in range(2):
                subprocess.run(["pdflatex", "-halt-on-error", "-interaction=batchmode", f"-output-directory={tmp}", f"{filename}.tex"], cwd=OUT, check=True, stdout=subprocess.DEVNULL)
            (OUT / f"{filename}.pdf").write_bytes((Path(tmp) / f"{filename}.pdf").read_bytes())


def pdfium_fields():
    palette = " .:-=+*#%@"
    rows = []
    for filename in sorted((OUT / "frames").glob("*.jpg")):
        im = Image.open(filename).convert("L").resize((96, 64))
        rows.append(["".join(palette[min(9, int(im.getpixel((x, y))) * 10 // 256)] for x in range(96)) for y in range(64)])
    (OUT / "field-frames.json").write_text(json.dumps(rows) + "\n")
    w = writer_for("Grapes: PDF form animation", ["Type p in the control box to play or pause; n steps; r resets.", "A 96 x 64 monochrome recording, targeted at eight frames per second.", "The changing frame counter proves that the document script ran."], image=False)
    font = w._add_object(obj(Type=name("Font"), Subtype=name("Type1"), BaseFont=name("Courier")))
    fields = ArrayObject()
    for y in range(64):
        text = rows[0][y].replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        ap = w._add_object(stream(f"0.067 g 0 0 420 6.5625 re f BT /Cour 7 Tf 1 g 3 0.6 Td ({text}) Tj ET".encode(), Type=name("XObject"), Subtype=name("Form"), BBox=nums([0, 0, 420, 6.5625]), Resources=obj(Font=obj(Cour=font))))
        field = obj(Type=name("Annot"), Subtype=name("Widget"), FT=name("Tx"), T=TextStringObject(f"row{y}"), Rect=nums([96, 650 - (y + 1) * 6.5625, 516, 650 - y * 6.5625]), V=TextStringObject(rows[0][y]), DA=TextStringObject("/Cour 7 Tf 1 g"), F=NumberObject(4), Ff=NumberObject(1), MK=obj(BG=nums([0.067]*3)), Border=nums([0, 0, 0]), AP=obj(N=ap), P=w.pages[0].indirect_reference)
        ref = w._add_object(field)
        fields.append(ref)
        w.pages[0].setdefault(name("Annots"), ArrayObject()).append(ref)
    for key, rect, value, readonly in [("control", [48, 142, 160, 165], "", False), ("status", [180, 142, 420, 165], "Frame 0 / paused", True)]:
        field = obj(Type=name("Annot"), Subtype=name("Widget"), FT=name("Tx"), T=TextStringObject(key), Rect=nums(rect), V=TextStringObject(value), DA=TextStringObject("/Cour 11 Tf 0 g"), F=NumberObject(4), Ff=NumberObject(1 if readonly else 0), Border=nums([0, 0, 1]), P=w.pages[0].indirect_reference)
        if not readonly:
            field[name("AA")] = obj(K=obj(S=name("JavaScript"), JS=TextStringObject("if(event.change){pdfCommand(event.change);event.change='';}")))
        ref = w._add_object(field)
        fields.append(ref)
        w.pages[0]["/Annots"].append(ref)
    w._root_object[name("AcroForm")] = obj(Fields=fields, DR=obj(Font=obj(Cour=font)), DA=TextStringObject("/Cour 11 Tf 0 g"), NeedAppearances=BooleanObject(True))
    js = "var pdfDoc=this, pdfFrames=" + json.dumps(rows) + r""",pdfFrame=0,pdfTimer=null;
function pdfDraw(){for(var y=0;y<64;y++)pdfDoc.getField('row'+y).value=pdfFrames[pdfFrame][y];pdfDoc.getField('status').value='Frame '+pdfFrame+' / '+(pdfTimer?'playing':'paused');}
function pdfTick(){pdfFrame=(pdfFrame+1)%pdfFrames.length;pdfDraw();}
function pdfCommand(c){c=c.toLowerCase();if(c==='p'){if(pdfTimer){app.clearInterval(pdfTimer);pdfTimer=null;}else{pdfTimer=app.setInterval('pdfTick()',125);}pdfDraw();}if(c==='n')pdfTick();if(c==='r'){pdfFrame=0;pdfDraw();}}
pdfDraw();
"""
    js = formatted(js, "babel")
    (OUT / "field-animation.js").write_text(js)
    w.add_js(js)
    save(w, "02-pdfium-fields.pdf")


def point_cloud(*, reuse_prc=False):
    points = json.loads((OUT / "points.json").read_text())
    lines = ["import three;", "settings.prc=true;", "settings.render=0;", "size(420);", "currentprojection=orthographic(3,-5,2);", "// Sampled Splashery centers; axes mapped (x,y,z) to (x,z,y)."]
    for p in points:
        x, y, z = p["p"]
        # Source colors are linear; convert them to display sRGB.
        rgb = [12.92*v if v <= 0.0031308 else 1.055*max(0, v)**(1/2.4)-0.055 for v in p["rgb"]]
        lines.append(f"dot(({x:.6f},{z:.6f},{y:.6f}),rgb({','.join(f'{min(1,max(0,v)):.5f}' for v in rgb)})+2bp);")
    (OUT / "grapes.asy").write_text("\n".join(lines) + "\n")
    if not reuse_prc:
        with tempfile.TemporaryDirectory(prefix="splashery-prc-") as tmp:
            subprocess.run([os.environ.get("ASYMPTOTE", "asy"), "-f", "prc", "-noV", "-o", str(Path(tmp)/"grapes"), str(OUT / "grapes.asy")], check=True, stdout=subprocess.DEVNULL)
            (OUT / "grapes.prc").write_bytes((Path(tmp) / "grapes.prc").read_bytes())
    w = writer_for("Grapes: a 3D point cloud", [f"{len(points):,} sampled centers and colors from 200,012 real splats.", "In desktop Acrobat Reader: trust this file once, click, then drag to rotate.", "If the view is empty, use Fit Model in the 3D toolbar. See the report."])
    prc = w._add_object(stream((OUT / "grapes.prc").read_bytes(), Type=name("3D"), Subtype=name("PRC")))
    # Asymptote fits the model into a 420-unit scene. Leave a 500-unit view.
    view = w._add_object(obj(Type=name("3DView"), XN=TextStringObject("Grapes"), IN=TextStringObject("home"), MS=name("M"), C2W=nums([1,0,0, 0,1,0, 0,0,1, 0,0,1000]), CO=FloatObject(1000), P=obj(Subtype=name("O"), OS=FloatObject(1/500), OB=name("Max")), BG=obj(Type=name("3DBG"), CS=name("DeviceRGB"), C=nums([0.067]*3)), LS=obj(Type=name("3DLightingScheme"), Subtype=name("Headlamp"))))
    annotation(w, obj(Type=name("Annot"), Subtype=name("3D"), Rect=nums(RECT), Contents=TextStringObject("Rotate the sampled grapes point cloud"), F=NumberObject(4), **{"3DD":prc, "3DV":view, "3DA":obj(A=name("XA"), AIS=name("L"), D=name("PI"), DIS=name("I"), TB=BooleanObject(True)), "AP":obj(N=poster(w))}))
    save(w, "03-point-cloud.pdf")


def embedded_video():
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", "8", "-i", str(OUT / "frames/frame-%03d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", str(OUT / "grapes.mp4")], check=True)
    w = writer_for("Grapes: embedded video", ["Click the picture in desktop Acrobat Reader to try native H.264 playback.", "This Screen/Rendition annotation embeds the MP4; it uses no Flash player.", "If playback fails, extract grapes.mp4 from the attachments panel."])
    video = w._add_object(stream((OUT / "grapes.mp4").read_bytes(), Type=name("EmbeddedFile"), Subtype=name("video#2Fmp4")))
    fs = w._add_object(obj(Type=name("Filespec"), F=TextStringObject("grapes.mp4"), UF=TextStringObject("grapes.mp4"), EF=obj(F=video, UF=video)))
    clip = obj(Type=name("MediaClip"), S=name("MCD"), N=TextStringObject("Grapes drop effect"), CT=TextStringObject("video/mp4"), D=fs, P=obj(TF=TextStringObject("TEMPACCESS")))
    rendition = obj(Type=name("Rendition"), S=name("MR"), N=TextStringObject("Grapes video"), C=clip, P=obj(Type=name("MediaPlayParams"), BE=obj(C=BooleanObject(True), RC=FloatObject(1))))
    screen = obj(Type=name("Annot"), Subtype=name("Screen"), Rect=nums(RECT), F=NumberObject(4), T=TextStringObject("Play grapes video"), P=w.pages[0].indirect_reference, AP=obj(N=poster(w)))
    screen_ref = w._add_object(screen)
    screen[name("A")] = obj(S=name("Rendition"), R=rendition, OP=NumberObject(0), AN=screen_ref)
    w.pages[0]["/Annots"].append(screen_ref)
    w.add_attachment("grapes.mp4", (OUT / "grapes.mp4").read_bytes())
    save(w, "04-embedded-video.pdf")


def plain_and_attachment():
    w = writer_for("Grapes: open the real toy", ["The still lives in the PDF; the interactive toy opens in your browser.", "Tap the green link, or scan the QR code with another device.", "In the browser, tap the bunch to make the grapes drop and return."])
    # Add a vector QR code to the base PDF before writing it.
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(612, 792), invariant=1)
    modules = json.loads((OUT / "qr.json").read_text())["modules"]
    n = len(modules)
    unit = 105/(n+8)
    c.setFillColor(Color(1,1,1))
    c.rect(448, 68, 105, 105, fill=1, stroke=0)
    c.setFillColor(Color(0,0,0))
    for r, row in enumerate(modules):
        for col, dark in enumerate(row):
            if dark:
                c.rect(448+(col+4)*unit, 68+(n-r+3)*unit, unit, unit, fill=1, stroke=0)
    c.showPage()
    c.save()
    w.pages[0].merge_page(PdfReader(buf).pages[0])
    save(w, "05-still-link-qr.pdf")
    html = f"""<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Open the grapes toy</title>
<style>body{{font:20px system-ui;max-width:40em;margin:3em auto;padding:1em}}</style>
<h1>The attached HTML is a launcher</h1>
<p>The toy runs in the browser after you click this link. It needs a network connection.</p>
<p><a href="{LIVE}">Open the real Splashery grapes toy</a></p>
<p>This PDF attachment does not give the PDF viewer WebGL or run the toy inside the page.</p>
"""
    html = formatted(html, "html")
    (OUT / "open-grapes.html").write_text(html)
    w = writer_for("Grapes: an HTML attachment", ["Use your viewer's attachments panel to save open-grapes.html.", "Open the saved HTML in a browser, then click its link to the live toy.", "This launcher needs the Internet. It does not include an offline toy."])
    w.add_attachment("open-grapes.html", html.encode())
    save(w, "06-html-attachment.pdf")


def page_flip():
    w = PdfWriter()
    for i, frame in enumerate(sorted((OUT / "frames").glob("*.jpg"))[::4]):
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=(612, 792), invariant=1)
        c.setFont("Helvetica-Bold", 22)
        c.drawString(48, 736, f"Grapes: frame {i+1} of 10")
        c.drawImage(str(frame), 96, 230, 420, 420)
        c.setFont("Helvetica", 11)
        c.drawString(48, 195, "Next page advances the effect by half a second.")
        c.drawString(48, 175, "Timed page changes depend on the viewer's presentation mode.")
        c.showPage()
        c.save()
        w.add_page(PdfReader(buf).pages[0])
        w.pages[-1][name("Dur")] = FloatObject(0.5)
        w.pages[-1][name("Trans")] = obj(S=name("Dissolve"), D=FloatObject(0.1))
    save(w, "07-page-flip.pdf")


if __name__ == "__main__":
    if not (OUT / "capture.json").exists():
        raise SystemExit("Run tools/pdf-motion/capture.mjs first.")
    animate_sources()
    pdfium_fields()
    point_cloud()
    embedded_video()
    plain_and_attachment()
    page_flip()
    artifacts = []
    for file in sorted(OUT.glob("*.pdf")):
        assert file.stat().st_size <= 15_000_000, file
        reader = PdfReader(file, strict=True)
        artifacts.append({"file": file.name, "bytes": file.stat().st_size, "pages": len(reader.pages), "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})
    (OUT / "build.json").write_text(json.dumps({"artifacts": artifacts}, indent=2) + "\n")
    print(json.dumps(artifacts, indent=2))
