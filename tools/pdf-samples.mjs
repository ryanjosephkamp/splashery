#!/usr/bin/env node
// Lane PDF lab: makes the explainer's sample PDFs with the app's own Save as
// PDF (src/pdf-export/), from the real toy, and a PNG of each page to look at.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/pdf-samples.mjs [out-dir] [toy] [--fps=8] [--size=420] [--max=6] [--png]
//
// Writes <out-dir>/<toy>-still.pdf and <toy>-moving.pdf (default out-dir:
// pdf-lab/samples, toy: grapes), and with --png <name>-p<n>.png beside them.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir = "pdf-lab/samples", toy = "grapes"] = args.filter((a) => !a.startsWith("--"));
const pngs = args.includes("--png");
const rec = { size: Number(opt("size", 420)), fps: Number(opt("fps", 8)), maxSeconds: Number(opt("max", 6)) }; // prettier-ignore

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
// The live site's address in the links, not this test server's.
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
const made = await page.evaluate(
  async ({ toy, rec }) => {
    const { app } = window.__splashery;
    const m = await import("/src/pdf-export/index.js");
    await app.chooseToy(toy);
    await new Promise((r) => setTimeout(r, 2500));
    const b64 = (u8) => {
      let s = "";
      for (let i = 0; i < u8.length; i += 0x8000)
        s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
      return btoa(s);
    };
    const out = {};
    for (const mode of ["still", "moving"]) {
      const r = await m.makeToyPDF(app, { mode, ...rec, base: "https://ryanjosephkamp.github.io/splashery/" }); // prettier-ignore
      out[mode] = { bytes: b64(r.bytes), frames: r.recording?.frames.length, est: r.estimate }; // prettier-ignore
    }
    return out;
  },
  { toy, rec },
);
for (const [mode, r] of Object.entries(made)) {
  const file = path.join(outDir, `${toy}-${mode}.pdf`);
  const bytes = Buffer.from(r.bytes, "base64");
  fs.writeFileSync(file, bytes);
  const extra = r.frames ? `, ${r.frames} pictures (estimate at most ${r.est.frames} pictures, ${(r.est.bytes / 1e3).toFixed(0)} KB)` : ""; // prettier-ignore
  console.log(`${file}: ${(bytes.length / 1e3).toFixed(0)} KB${extra}`);
  if (!pngs) continue;
  const shots = await page.evaluate(async (b64) => {
    const pdfjs = await import("/vendor/pdfjs/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
    const doc = await pdfjs.getDocument({ data: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) }).promise; // prettier-ignore
    const out = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i);
      const vp = p.getViewport({ scale: 1.25 });
      const c = document.createElement("canvas");
      c.width = vp.width;
      c.height = vp.height;
      await p.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      out.push(c.toDataURL("image/png"));
    }
    return out;
  }, r.bytes);
  shots.forEach((d, i) => fs.writeFileSync(file.replace(/\.pdf$/, `-p${i + 1}.png`), Buffer.from(d.split(",")[1], "base64"))); // prettier-ignore
}
await browser.close();
