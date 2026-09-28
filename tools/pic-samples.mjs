// Makes the Picture lab's sample article and the Pictures lane's test
// fixtures, all from our own text and drawings, printed and recorded with
// the test Chromium:
//
//   assets/toys/picture-lab/article.pdf   a two-page article (the sample)
//   tests/fixtures/pic/article.pdf        the same article, for the tests
//   tests/fixtures/pic/pages200.pdf       200 numbered pages
//   tests/fixtures/pic/photo.jpg          a drawn "photo" (a sunset scene)
//   tests/fixtures/pic/anim.gif           an eight-frame GIF (a ball moving)
//   tests/fixtures/pic/clip.webm          a two-second WebM (a clock face)
//   tests/fixtures/pic/locked.pdf         a password-protected PDF
//
// Usage: node tools/pic-samples.mjs  (no server needed)

import { chromium } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
import { GIFEncoder, quantize, applyPalette } from "../vendor/gifenc/gifenc.esm.js";

const ROOT = new URL("../", import.meta.url);
const out = (p) => new URL(p, ROOT);
fs.mkdirSync(out("tests/fixtures/pic/"), { recursive: true });
fs.mkdirSync(out("assets/toys/picture-lab/"), { recursive: true });

const ARTICLE = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: Letter; margin: 0.75in 0.7in; }
body { font-family: "DejaVu Serif", Georgia, serif; font-size: 10pt; line-height: 1.32; color: #111; }
h1 { font-size: 19pt; text-align: center; margin: 0 0 6pt; line-height: 1.15; }
.authors { text-align: center; font-size: 10.5pt; margin-bottom: 2pt; }
.affil { text-align: center; font-size: 9pt; color: #444; margin-bottom: 12pt; }
.abstract { margin: 0 0.4in 14pt; font-size: 9.5pt; }
.abstract b { display: block; text-align: center; margin-bottom: 3pt; }
.cols { column-count: 2; column-gap: 0.3in; text-align: justify; hyphens: auto; }
h2 { font-size: 11pt; margin: 10pt 0 4pt; }
p { margin: 0 0 6pt; }
figure { margin: 6pt 0 8pt; break-inside: avoid; }
figcaption { font-size: 8.5pt; color: #333; margin-top: 3pt; }
.eq { text-align: center; margin: 6pt 0; font-style: italic; }
table { border-collapse: collapse; font-size: 8.5pt; width: 100%; margin: 4pt 0 8pt; }
td, th { border-top: 0.5pt solid #333; padding: 2pt 4pt; text-align: left; }
.refs { font-size: 8.5pt; }
</style></head><body>
<h1>Pictures Made of Splats: Turning Pages<br>into Clouds of Gaussians</h1>
<div class="authors">The Splashery Lab</div>
<div class="affil">A sample article written for the Picture lab, September 2026</div>
<div class="abstract"><b>Abstract</b>
We show how a printed page, a photo or a frame of video can be rebuilt as thousands of small, flat
Gaussian splats, and viewed from any side like a sheet of paper. The paper becomes a smooth sheet of
large splats in its own color; every pixel of ink becomes one small splat of its own color, a hair
in front of the paper. Pages are built when they are reached and freed when they are left, so a
book of any length costs no more than its open pages. We measure how many splats a page needs to
stay readable on a phone, and how the detail should follow the view.</div>
<div class="cols">
<h2>1. Introduction</h2>
<p>Gaussian splatting draws a scene as a cloud of soft, colored ellipsoids. Each splat has a center,
a size along three axes, a turn, a color and an opacity, and the renderer sorts them by depth and
blends them from back to front. Scanned objects often use a million splats or more. A page of text
is a different kind of subject: it is flat, it has sharp edges, and most of it is plain paper.</p>
<p>A splat is not a pixel. Its edge is soft, and splats that overlap blend their colors. Laid out
on a grid with the right size, though, small flat splats close up into a surface with no gaps, and
the eye reads them as the picture they came from. This article describes one simple way to do that
for documents and photos, and what it costs.</p>
<h2>2. From pixels to splats</h2>
<p>For a photo, every pixel becomes a flat disc facing the viewer. Its standard deviation is 0.6
of the pixel's width, so neighboring discs close up to about ninety-six percent cover without
blurring the picture by more than a pixel. A smooth base of larger splats, a hair behind, fills
what is left and keeps the back of the sheet solid.</p>
<div class="eq">G(x) = &alpha; exp(&minus;&frac12; (x &minus; &mu;)<sup>T</sup> &Sigma;<sup>&minus;1</sup> (x &minus; &mu;))</div>
<p>For a document, most pixels are paper. We find the paper's color block by block, from the
lighter half of each block, so an off-white or unevenly lit scan works too. Only the pixels that
differ from the paper under them, the ink, get their own splats.</p>
<figure><svg viewBox="0 0 300 150" width="100%">
<rect x="0" y="0" width="300" height="150" fill="#f7f7f4"/>
<line x1="30" y1="125" x2="290" y2="125" stroke="#222" stroke-width="1"/>
<line x1="30" y1="10" x2="30" y2="125" stroke="#222" stroke-width="1"/>
<polyline fill="none" stroke="#1f5fa8" stroke-width="2.2" points="30,120 60,108 90,90 120,70 150,54 180,42 210,34 240,29 270,26 290,25"/>
<polyline fill="none" stroke="#c0392b" stroke-width="2.2" stroke-dasharray="5 3" points="30,122 60,117 90,110 120,100 150,88 180,74 210,60 240,47 270,36 290,31"/>
<text x="160" y="143" font-size="9" text-anchor="middle">splats per page (thousands)</text>
<text x="12" y="70" font-size="9" transform="rotate(-90 12 70)" text-anchor="middle">words read</text>
<text x="215" y="20" font-size="9" fill="#1f5fa8">ink only</text>
<text x="215" y="78" font-size="9" fill="#c0392b">every pixel</text>
</svg><figcaption>Figure 1. Words read on a phone against the splats a page uses. Keeping only
the ink reads well with far fewer splats.</figcaption></figure>
<h2>3. Near and far</h2>
<p>A renderer skips splats smaller than about a pixel on the screen. A whole page seen on a phone
is about eight hundred pixels wide, so a page built at print resolution would vanish there, while
a page built for the phone would look soft when zoomed in. We build each page at about one of its
pixels per screen pixel for the size it shows at now, and rebuild it when the view comes much
closer or goes much further.</p>
<table><tr><th>Tier</th><th>Page width</th><th>Ink splats</th><th>Photo splats</th></tr>
<tr><td>Low</td><td>1,100 px</td><td>220,000</td><td>160,000</td></tr>
<tr><td>Mid</td><td>1,600 px</td><td>420,000</td><td>320,000</td></tr>
<tr><td>High</td><td>2,400 px</td><td>750,000</td><td>640,000</td></tr>
<tr><td>Max</td><td>3,200 px</td><td>1,300,000</td><td>1,200,000</td></tr></table>
<h2>4. Pages that stream</h2>
<p>A book never builds all its pages. Only the open pages and the one turning exist as splats. A
page is drawn from the file when it is reached, turned into splats on a worker thread in a fraction
of a second, and freed when it leaves. The splat count stays the same whether the book has ten
pages or two hundred.</p>
<p>Video works the other way round. Its splats are built once, and each one takes its color from a
small picture of the current frame, which the graphics card receives thirty times a second.</p>
<h2>5. Results</h2>
<p>On a phone, the title and headings of a page read at a glance with the whole page in view, and
every word of the body text reads when zoomed in. Colors match the source to within the rounding
of half-precision numbers, and the paper shows no grid.</p>
<p>The sheets bend like paper. Each splat of a page knows how far it lies from the book's spine;
as a page turns, it curls along a circular arc and every splat turns with the curve, so the page
stays solid at every angle.</p>
<h2>6. Conclusion</h2>
<p>Pictures and pages make good splat toys. The same small set of rules covers a research article,
a family photo and a home video, and it runs in a browser on a phone. Fitting splats of free shape
to a picture, as recent work does on large graphics cards, could make pages lighter still.</p>
<div class="refs"><h2>References</h2>
<p>[1] A. Author and B. Author. A study of soft points for drawing pictures. <i>Journal of Made-Up
Results</i>, 12(3):45&ndash;67, 2025.</p>
<p>[2] C. Writer. Paper, ink and light: how pages are seen. <i>Proceedings of an Imaginary
Conference</i>, pages 1&ndash;9, 2024.</p>
<p>[3] D. Scholar. Sorting splats by depth, quickly. <i>Notes on Rendering</i>, 7:100&ndash;110, 2026.</p></div>
</div></body></html>`;

const pages200 = () => {
  let body = "";
  for (let i = 1; i <= 200; i++)
    body += `<section><h1>Page ${i}</h1><p>This is page ${i} of 200, a test of pages that stream. ${i % 2 ? "An odd page." : "An even page."}</p><div style="width:${40 + (i % 9) * 40}px"></div></section>`;
  return `<!doctype html><html><head><style>@page{size:A5;margin:0.6in}section{break-after:page}h1{font:bold 36pt serif;margin:0 0 12pt}p{font:12pt serif}div{height:18pt;background:#1f5fa8}</style></head><body>${body}</body></html>`;
};

// A password-protected PDF (the standard security handler, revision 2,
// 40-bit RC4), written by hand: one page, user password "splat".
function lockedPDF() {
  const PAD = Buffer.from("28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A", "hex"); // prettier-ignore
  const pad = (s) => Buffer.concat([Buffer.from(s, "latin1"), PAD]).subarray(0, 32);
  const rc4 = (key, data) => {
    const S = [...Array(256).keys()];
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + S[i] + key[i % key.length]) & 255;
      [S[i], S[j]] = [S[j], S[i]];
    }
    const outb = Buffer.alloc(data.length);
    let i = 0;
    j = 0;
    for (let k = 0; k < data.length; k++) {
      i = (i + 1) & 255;
      j = (j + S[i]) & 255;
      [S[i], S[j]] = [S[j], S[i]];
      outb[k] = data[k] ^ S[(S[i] + S[j]) & 255];
    }
    return outb;
  };
  const md5 = (...b) => crypto.createHash("md5").update(Buffer.concat(b)).digest();
  const id = Buffer.from("0123456789abcdef0123456789abcdef", "hex");
  const O = rc4(md5(pad("owner")).subarray(0, 5), pad("splat"));
  const P = -44;
  const pb = Buffer.alloc(4);
  pb.writeInt32LE(P);
  const key = md5(pad("splat"), O, pb, id).subarray(0, 5);
  const U = rc4(key, PAD);
  const objKey = (n) => md5(key, Buffer.from([n & 255, (n >> 8) & 255, 0, 0, 0])).subarray(0, 10);
  const stream = rc4(objKey(4), Buffer.from("BT /F1 24 Tf 72 700 Td (Locked) Tj ET"));
  const hex = (b) => `<${b.toString("hex")}>`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>",
    null,
    `<< /Filter /Standard /V 1 /R 2 /O ${hex(O)} /U ${hex(U)} /P ${P} >>`,
  ];
  const parts = [Buffer.from("%PDF-1.4\n")];
  const offsets = [];
  let pos = parts[0].length;
  objs.forEach((o, i) => {
    const n = i + 1;
    const head =
      o === null
        ? Buffer.concat([Buffer.from(`${n} 0 obj\n<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from("\nendstream\nendobj\n")]) // prettier-ignore
        : Buffer.from(`${n} 0 obj\n${o}\nendobj\n`);
    offsets.push(pos);
    parts.push(head);
    pos += head.length;
  });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Encrypt 5 0 R /ID [${hex(id)} ${hex(id)}] >>\nstartxref\n${pos}\n%%EOF\n`; // prettier-ignore
  parts.push(Buffer.from(xref));
  return Buffer.concat(parts);
}

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/opt/pw-browsers/chromium",
});
const page = await browser.newPage();

await page.setContent(ARTICLE);
const article = await page.pdf({ format: "Letter", printBackground: true, preferCSSPageSize: true }); // prettier-ignore
fs.writeFileSync(out("assets/toys/picture-lab/article.pdf"), article);
fs.writeFileSync(out("tests/fixtures/pic/article.pdf"), article);

await page.setContent(pages200());
fs.writeFileSync(out("tests/fixtures/pic/pages200.pdf"), await page.pdf({ preferCSSPageSize: true, printBackground: true })); // prettier-ignore

fs.writeFileSync(out("tests/fixtures/pic/locked.pdf"), lockedPDF());

// The drawn photo, the GIF frames and the video, on a canvas.
await page.setContent("<canvas id=c></canvas>");
const photo = await page.evaluate(() => {
  const c = document.getElementById("c");
  c.width = 480;
  c.height = 320;
  const g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 220);
  sky.addColorStop(0, "#1d3b73");
  sky.addColorStop(0.6, "#e0785a");
  sky.addColorStop(1, "#f6c65b");
  g.fillStyle = sky;
  g.fillRect(0, 0, 480, 220);
  g.fillStyle = "#fff3c4";
  g.beginPath();
  g.arc(300, 200, 34, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1c5c7a";
  g.fillRect(0, 210, 480, 110);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(255,220,160,${0.2 + (i % 5) * 0.1})`;
    g.fillRect(250 + ((i * 37) % 100), 220 + i * 2.5, 30 - (i % 7) * 3, 2);
  }
  g.fillStyle = "#12161c";
  g.beginPath();
  g.moveTo(0, 230);
  g.lineTo(90, 150);
  g.lineTo(160, 215);
  g.lineTo(210, 185);
  g.lineTo(260, 235);
  g.lineTo(0, 260);
  g.fill();
  return c.toDataURL("image/jpeg", 0.88);
});
fs.writeFileSync(out("tests/fixtures/pic/photo.jpg"), Buffer.from(photo.split(",")[1], "base64"));

const frames = await page.evaluate(() => {
  const c = document.getElementById("c");
  c.width = 160;
  c.height = 120;
  const g = c.getContext("2d");
  const outf = [];
  for (let f = 0; f < 8; f++) {
    g.fillStyle = "#f4f1e8";
    g.fillRect(0, 0, 160, 120);
    g.fillStyle = "#2a6fdb";
    g.fillRect(0, 100, 160, 20);
    g.fillStyle = "#e0452b";
    g.beginPath();
    g.arc(20 + f * 17, 60 - 30 * Math.sin((f / 7) * Math.PI), 14, 0, Math.PI * 2);
    g.fill();
    outf.push(Array.from(g.getImageData(0, 0, 160, 120).data));
  }
  return outf;
});
const gif = GIFEncoder();
for (const f of frames) {
  const rgba = new Uint8Array(f);
  const palette = quantize(rgba, 32);
  gif.writeFrame(applyPalette(rgba, palette), 160, 120, { palette, delay: 120 });
}
gif.finish();
fs.writeFileSync(out("tests/fixtures/pic/anim.gif"), Buffer.from(gif.bytes()));

const webm = await page.evaluate(async () => {
  const c = document.getElementById("c");
  c.width = 192;
  c.height = 144;
  const g = c.getContext("2d");
  const draw = (t) => {
    g.fillStyle = "#fbf7ee";
    g.fillRect(0, 0, 192, 144);
    g.strokeStyle = "#222";
    g.lineWidth = 4;
    g.beginPath();
    g.arc(96, 72, 56, 0, Math.PI * 2);
    g.stroke();
    const a = t * Math.PI * 2 - Math.PI / 2;
    g.strokeStyle = "#d33";
    g.beginPath();
    g.moveTo(96, 72);
    g.lineTo(96 + 48 * Math.cos(a), 72 + 48 * Math.sin(a));
    g.stroke();
    g.fillStyle = `hsl(${t * 360}, 70%, 50%)`;
    g.fillRect(8, 8, 28, 28);
  };
  draw(0);
  const stream = c.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8", videoBitsPerSecond: 300000 }); // prettier-ignore
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  rec.start();
  const t0 = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      const t = (performance.now() - t0) / 2000;
      draw(Math.min(1, t));
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    tick();
  });
  rec.stop();
  await done;
  const buf = await new Blob(chunks).arrayBuffer();
  return Array.from(new Uint8Array(buf));
});
fs.writeFileSync(out("tests/fixtures/pic/clip.webm"), Buffer.from(webm));
await browser.close();

for (const f of fs.readdirSync(out("tests/fixtures/pic/")))
  console.log(f, fs.statSync(out(`tests/fixtures/pic/${f}`)).size);
