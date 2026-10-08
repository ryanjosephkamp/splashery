#!/usr/bin/env node
// Lane Photo fidelity (prefix phf): the shared test material for the two photo lanes (Photo
// fidelity and Sharp view). A phone-sized page of Splashery's own text (README.md and
// docs/ROADMAP.md, rendered as plain HTML: our own words, no third-party content), scrolled at a
// normal reading pace and written as an H.264 MP4 at 30 frames a second, plus a few still PNGs of
// the page. Like the owner's phone screen recording of a feed, but made here, so it can go in a
// test run. Everything goes under .cache/ (git-ignored), never in the repo. A VP9 WebM of the same
// frames comes too, for the headless tools (Playwright's Chromium can't decode H.264).
//
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/text-scroll-video.mjs
//     [--out=.cache/text-scroll] [--secs=20] [--fps=30] [--speed=60] [--w=360] [--h=780]
//     [--scale=3] [--stills=4] [--crf=18]
//
// The page is --w by --h CSS pixels at device scale --scale (1080 by 2340 by default, a phone's
// screen), body text 16 px. It scrolls --speed CSS pixels a second (60: about a line every
// 0.4 s, a calm read of a feed). Each frame is a screenshot after setting the scroll position for
// its time, so the motion is exact however slow the machine. Writes <out>/text-scroll.mp4 (and .webm) and
// <out>/still-<k>.png (the first frame, then evenly through the clip), and <out>/info.json.
// ffmpeg is a build tool (installed in the container; listed in LICENSES.md); not shipped.

import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const OUT = opt("out", ".cache/text-scroll");
const SECS = Number(opt("secs", 20));
const FPS = Number(opt("fps", 30));
const SPEED = Number(opt("speed", 60));
const W = Number(opt("w", 360));
const H = Number(opt("h", 780));
const SCALE = Number(opt("scale", 3));
const STILLS = Number(opt("stills", 4));
const CRF = opt("crf", "18");
fs.mkdirSync(OUT, { recursive: true });

// A small Markdown to HTML: headings, paragraphs, lists, code blocks, tables (as plain rows) and
// inline code, bold and links (as their text). Enough for our own two documents.
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
function markdown(md) {
  const out = [];
  let para = [];
  let list = null;
  let code = null;
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
    if (list) out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`);
    list = null;
  };
  for (const line of md.split("\n")) {
    if (code) {
      if (line.startsWith("```")) {
        out.push(`<pre>${esc(code.join("\n"))}</pre>`);
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
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      continue;
    }
    const li = line.match(/^\s*[-*]\s+(.*)/) || line.match(/^\s*\d+\.\s+(.*)/);
    if (li) {
      if (para.length) flush();
      (list ||= []).push(li[1]);
      continue;
    }
    if (/^\s*\|/.test(line)) {
      flush();
      if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) continue;
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => inline(c.trim()));
      out.push(`<p class="row">${cells.join(" · ")}</p>`);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (list && /^\s+/.test(line)) list[list.length - 1] += ` ${line.trim()}`;
    else para.push(line.trim());
  }
  flush();
  return out.join("\n");
}

const docs = ["README.md", "docs/ROADMAP.md"].map((f) => markdown(fs.readFileSync(f, "utf8")));
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#fff;color:#111}
body{font:16px/1.45 "DejaVu Sans","Liberation Sans",Arial,sans-serif;padding:12px 14px}
h1{font-size:26px;margin:18px 0 10px}h2{font-size:21px;margin:16px 0 8px}h3,h4{font-size:18px;margin:14px 0 6px}
p,li{margin:0 0 10px}ul{padding-left:20px;margin:0 0 10px}
code,pre{font:13px/1.4 "DejaVu Sans Mono",monospace;background:#f2f2f2}
pre{padding:8px;white-space:pre-wrap;word-break:break-all}
.row{font-size:14px;color:#333;border-bottom:1px solid #ddd;padding-bottom:6px}
hr{border:0;border-top:1px solid #ccc}
.doc{border-bottom:6px solid #e5e5e5;margin-bottom:16px}
</style></head><body>${docs.map((d) => `<div class="doc">${d}</div>`).join("")}</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.SPLASHERY_CHROMIUM || undefined }); // prettier-ignore
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
await page.setContent(html);
const total = await page.evaluate(() => document.documentElement.scrollHeight);
const n = Math.round(SECS * FPS);
const reach = Math.min(total - H, SPEED * SECS);
if (reach < SPEED * SECS)
  console.warn(`The page is only ${total} px tall; the scroll stops early.`);
const ff = spawn(
  "ffmpeg",
  ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
   "-c:v", "libx264", "-preset", "slow", "-crf", CRF, "-pix_fmt", "yuv420p",
   "-movflags", "+faststart", path.join(OUT, "text-scroll.mp4")], // prettier-ignore
  { stdio: ["pipe", "inherit", "inherit"] },
);
const done = new Promise((r, j) => ff.on("close", (c) => (c ? j(new Error(`ffmpeg ${c}`)) : r())));
const stillAt = new Set(Array.from({ length: STILLS }, (_, k) => Math.round((k * (n - 1)) / Math.max(1, STILLS - 1)))); // prettier-ignore
const stills = [];
for (let i = 0; i < n; i++) {
  const y = Math.min(reach, (i / FPS) * SPEED);
  await page.evaluate((y) => window.scrollTo(0, y), y);
  const png = await page.screenshot({ type: "png" });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
  if (stillAt.has(i)) {
    const file = path.join(OUT, `still-${stills.length}.png`);
    fs.writeFileSync(file, png);
    stills.push({ file, frame: i, t: i / FPS, scrollY: y });
  }
  if (i % 60 === 0) process.stdout.write(`frame ${i} of ${n}\r`);
}
ff.stdin.end();
await done;
await browser.close();
// The same frames as VP9 WebM: Playwright's Chromium has no H.264 decoder, so the headless tools
// open this one (a phone opens the MP4).
const vp9 = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(OUT, "text-scroll.mp4"), "-c:v", "libvpx-vp9", "-crf", "18", "-b:v", "0", "-row-mt", "1", "-cpu-used", "4", path.join(OUT, "text-scroll.webm")]); // prettier-ignore
if (vp9.status) throw new Error(String(vp9.stderr));
const info = { width: W * SCALE, height: H * SCALE, fps: FPS, secs: SECS, speed: SPEED, scale: SCALE, pageHeight: total, stills }; // prettier-ignore
fs.writeFileSync(path.join(OUT, "info.json"), JSON.stringify(info, null, 2));
console.log(`\n${path.join(OUT, "text-scroll.mp4")}: ${info.width} by ${info.height}, ${n} frames`);
