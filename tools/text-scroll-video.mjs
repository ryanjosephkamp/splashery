#!/usr/bin/env node
// Lanes Photo sharp view and Photo fidelity (October 8, 2026): the shared test material for
// reading text in Photo to 3D and Moving photo to 3D. It renders a phone-sized page (1080 by 2340,
// a 360 by 780 page at device scale 3) of Splashery's own text (docs/ROADMAP.md and README.md as
// plain HTML: our own words, no third-party content), scrolls it at a normal reading pace and
// writes an H.264 MP4 at 30 frames a second with ffmpeg (a build tool; and a VP9 WebM copy, which
// Playwright's Chromium can play), plus a few still PNGs and
// a JSON file that says where each block of text is on each still.
//
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/text-scroll-video.mjs
//     [--out=.cache/text-scroll] [--secs=20] [--fps=30] [--speed=55] [--stills=0,5,10,15]
//
// The page mixes three text sizes, 12, 14 and 16 CSS pixels (the sizes the legibility measure
// counts, tools/psv-legibility.mjs), and headings above them. --speed is in CSS pixels a second
// (55 is a steady reading pace on a phone). Everything goes under .cache/ (git-ignored): never in
// the repo. Frames are rendered at fixed scroll positions, one per frame, so the video is the same
// on every run and on any machine.

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const out = opt("out", ".cache/text-scroll");
const secs = Number(opt("secs", 20));
const fps = Number(opt("fps", 30));
const speed = Number(opt("speed", 55));
const stills = opt("stills", "0,5,10,15").split(",").map(Number);
const W = 360;
const H = 780;
const DPR = 3;
fs.mkdirSync(out, { recursive: true });

// A small Markdown reader: headings, paragraphs, lists, code blocks and inline code, links as their
// words. Enough for our own two documents; anything else shows as plain text.
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
function markdown(md) {
  const html = [];
  let para = [];
  let list = null;
  let code = null;
  const flush = () => {
    if (para.length) html.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
    if (list) html.push(`<ul>${list.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`);
    list = null;
  };
  for (const line of md.split("\n")) {
    if (code) {
      if (line.startsWith("```")) {
        html.push(`<pre>${esc(code.join("\n"))}</pre>`);
        code = null;
      } else code.push(line);
      continue;
    }
    if (line.startsWith("```")) {
      flush();
      code = [];
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      flush();
      html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      continue;
    }
    const li = line.match(/^\s*[-*]\s+(.*)/) || line.match(/^\s*\d+\.\s+(.*)/);
    if (li) {
      if (para.length) flush();
      (list ||= []).push(li[1]);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (list) list[list.length - 1] += ` ${line.trim()}`;
    else para.push(line.trim());
  }
  flush();
  return html.join("\n");
}

// The two documents, each cut into sections that take turns at 16, 14 and 12 pixels.
const docs = ["docs/ROADMAP.md", "README.md"].map((f) => fs.readFileSync(f, "utf8"));
const sizes = [16, 14, 12];
let n = 0;
const blocks = docs
  .flatMap((md) => md.split(/\n(?=## )/))
  .slice(0, 40)
  .map((sec) => `<section class="s${sizes[n++ % 3]}">${markdown(sec)}</section>`)
  .join("\n");
const page = `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; background: #fff; color: #1d1f23; }
  body { font: 16px/1.45 -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 18px 16px 2000px; }
  .s16 { font-size: 16px; } .s14 { font-size: 14px; } .s12 { font-size: 12px; }
  h1 { font-size: 26px; margin: 0.4em 0; } h2 { font-size: 21px; margin: 0.8em 0 0.3em; }
  h3 { font-size: 18px; margin: 0.8em 0 0.3em; } h4 { font-size: 1em; }
  p, li { margin: 0.45em 0; } ul { padding-left: 1.2em; }
  code, pre { font-family: Menlo, Consolas, monospace; font-size: 0.9em; background: #eef0f3; }
  pre { padding: 8px; white-space: pre-wrap; }
</style></head><body>${blocks}</body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const tab = await ctx.newPage();
await tab.setContent(page);
await tab.evaluate(() => document.fonts?.ready);

// Where each text line is (CSS pixels, page coordinates) and its size: the legibility measure reads
// the lines on a still from this.
const lines = await tab.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("p, li, h1, h2, h3, h4")) {
    const size = parseFloat(getComputedStyle(el).fontSize);
    const range = document.createRange();
    range.selectNodeContents(el);
    const rows = new Map();
    for (const r of range.getClientRects()) {
      if (r.width < 4 || r.height < 4) continue;
      const key = Math.round(r.top);
      const row = rows.get(key) || { x0: Infinity, x1: -Infinity, y0: r.top, y1: r.bottom };
      row.x0 = Math.min(row.x0, r.left);
      row.x1 = Math.max(row.x1, r.right);
      row.y1 = Math.max(row.y1, r.bottom);
      rows.set(key, row);
    }
    for (const r of rows.values())
      out.push({ size, x0: r.x0, x1: r.x1, y0: r.y0 + scrollY, y1: r.y1 + scrollY });
  }
  return out;
});

const frames = Math.round(secs * fps);
const mp4 = path.join(out, "text-scroll.mp4");
const ff = spawn(
  "ffmpeg",
  ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4], // prettier-ignore
  { stdio: ["pipe", "inherit", "inherit"] },
);
const done = new Promise((res, rej) =>
  ff.on("close", (c) => (c ? rej(new Error(`ffmpeg ${c}`)) : res())),
);
const meta = { w: W * DPR, h: H * DPR, dpr: DPR, fps, secs, speed, stills: [] };
for (let f = 0; f < frames; f++) {
  const t = f / fps;
  const y = Math.round(t * speed * DPR) / DPR; // whole device pixels, so a still matches its frame
  await tab.evaluate((y) => window.scrollTo(0, y), y);
  const png = await tab.screenshot({ type: "png" });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
  const at = stills.findIndex((s) => Math.round(s * fps) === f);
  if (at >= 0) {
    const file = `still-${String(stills[at]).padStart(2, "0")}s.png`;
    fs.writeFileSync(path.join(out, file), png);
    const shown = lines
      .filter((l) => l.y1 > y && l.y0 < y + H)
      .map((l) => ({ ...l, y0: l.y0 - y, y1: l.y1 - y }));
    meta.stills.push({ t: stills[at], frame: f, file, scroll: y, lines: shown });
  }
  if (f % 60 === 0) process.stdout.write(`frame ${f} of ${frames}\r`);
}
ff.stdin.end();
await done;
await browser.close();
// A VP9 WebM copy too: Playwright's Chromium plays no H.264, so the tools open this one.
const webm = path.join(out, "text-scroll.webm");
await new Promise((res, rej) =>
  spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", mp4, "-c:v", "libvpx-vp9", "-crf", "24", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", webm], { stdio: "inherit" }) // prettier-ignore
    .on("close", (c) => (c ? rej(new Error(`ffmpeg ${c}`)) : res())),
);
fs.writeFileSync(path.join(out, "text-scroll.json"), JSON.stringify(meta, null, 1));
console.log(
  `\nWrote ${mp4} (${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB), ${meta.stills.length} stills.`,
);
