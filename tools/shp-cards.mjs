#!/usr/bin/env node
// Lane Sharpness: before-and-after cards for the Effect review page.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/shp-cards.mjs <out-dir> \
//     [--before=dsf:3] [--after=dsf:3,q:sharp=1&kernel=sharp] [--turn=0] id[@zoom] ...
//
// Renders each toy on two phones (390×844 CSS pixels at a device pixel ratio,
// with a tier and labs switches: --before and --after, "dsf:<ratio>",
// "q:<query>", "profile:<tier>", "label:<words>", comma-separated) and writes:
//   <id>.png       the still pair side by side at the after phone's pixels
//                  (the before one scaled up as its screen would), each
//                  cropped to the toy, with a label over each.
//   <id>-turn.gif  with --turn=N: N frames turning 1° each at 10 frames a
//                  second, a close crop (the middle of the toy at full
//                  pixels), for judging shimmer as motion.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir, ...specs] = args.filter((a) => !a.startsWith("--"));
if (!outDir || !specs.length)
  throw new Error("Usage: node tools/shp-cards.mjs <out-dir> id[@zoom] ...");
const parseCfg = (s) =>
  Object.fromEntries(
    s.split(/,(?=\w+:)/).map((kv) => {
      const i = kv.indexOf(":");
      return [kv.slice(0, i), kv.slice(i + 1)];
    }),
  );
const before = {
  dsf: 3,
  q: "",
  profile: "mid",
  label: "Today",
  ...parseCfg(opt("before", "dsf:3")),
};
const after = {
  dsf: 3,
  q: "sharp=1&kernel=sharp",
  profile: "mid",
  label: "Levers on",
  ...parseCfg(opt("after", "")),
};
const turn = Number(opt("turn", 0));
const renderer = opt("renderer", "webgl2");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});

async function phone(cfg) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: Number(cfg.dsf),
  });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  const q = `renderer=${renderer}&profile=${cfg.profile}&adapt=off&labs=1${cfg.q ? "&" + cfg.q : ""}`;
  await page.goto(`${base}?${q}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return page;
}

// In the page: the toy's still and its turning frames, as PNG data URLs of
// the whole canvas, and the toy's box in CSS pixels.
async function frames({ id, zoom, turn }) {
  const { app, player } = window.__splashery;
  await app.chooseToy(id);
  app.setLook({ background: "#ffffff" });
  player.opts.idleDelay = 1e9;
  player.idle.weight = 0;
  player.camera.setTurntable?.(false);
  const cam = player.camera;
  const view = { ...cam.home, distance: cam.home.distance * zoom };
  const put = (v) => {
    cam.cur = { ...v };
    cam.tgt = { ...v };
  };
  const stage = player.stage;
  const slow = /^(picture|your-book)/.test(id);
  const until = performance.now() + (slow ? 9000 : 2500);
  while (performance.now() < until) {
    put(view);
    await stage.captureFrame();
    await new Promise((r) => setTimeout(r, 100));
  }
  put(view);
  await stage.captureFrame();
  const c = await stage.captureFrame();
  const ratio = c.width / stage.canvas.clientWidth;
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0; // prettier-ignore
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (d[i] + d[i + 1] + d[i + 2] < 750) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  const out = { still: c.toDataURL("image/png"), turns: [], ratio };
  out.box = [x0 / ratio, y0 / ratio, x1 / ratio, y1 / ratio];
  for (let k = 1; k <= turn; k++) {
    put({ ...view, yaw: view.yaw + (k * Math.PI) / 180 });
    await stage.captureFrame();
    out.turns.push((await stage.captureFrame()).toDataURL("image/png"));
  }
  put(view);
  return out;
}

// In a blank page: the pair side by side (and the GIF), labeled.
async function compose({ a, b, box, turnBox, labels, scale }) {
  const { GIFEncoder, quantize, applyPalette } = await import("/vendor/gifenc/gifenc.esm.js");
  const load = (src) =>
    new Promise((r) => {
      const im = new Image();
      im.onload = () => r(im);
      im.src = src;
    });
  const pair = async (srcA, srcB, bx, withLabels) => {
    const [ia, ib] = [await load(srcA), await load(srcB)];
    const w = Math.round((bx[2] - bx[0]) * scale);
    const h = Math.round((bx[3] - bx[1]) * scale);
    const bar = withLabels ? Math.round(18 * scale) : 0;
    const gapPx = Math.round(4 * scale);
    const c = document.createElement("canvas");
    c.width = w * 2 + gapPx;
    c.height = h + bar;
    const g = c.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, c.width, c.height);
    g.imageSmoothingQuality = "high";
    [ia, ib].forEach((im, k) => {
      const r = im.width / 390;
      g.drawImage(im, bx[0] * r, bx[1] * r, (bx[2] - bx[0]) * r, (bx[3] - bx[1]) * r, k * (w + gapPx), bar, w, h); // prettier-ignore
    });
    g.fillStyle = "#dddddd";
    g.fillRect(w, 0, gapPx, c.height);
    if (withLabels) {
      g.fillStyle = "#222222";
      g.font = `${Math.round(12 * scale)}px sans-serif`;
      g.textBaseline = "middle";
      g.fillText(labels[0], 6 * scale, bar / 2);
      g.fillText(labels[1], w + gapPx + 6 * scale, bar / 2);
    }
    return c;
  };
  const still = (await pair(a.still, b.still, box, true)).toDataURL("image/png");
  let gif = null;
  if (a.turns.length) {
    const enc = GIFEncoder();
    for (let k = 0; k < a.turns.length; k++) {
      const c = await pair(a.turns[k], b.turns[k], turnBox, false);
      const px = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      const palette = quantize(px, 256, { format: "rgb565" });
      enc.writeFrame(applyPalette(px, palette, "rgb565"), c.width, c.height, {
        palette,
        delay: 100,
        repeat: 0,
      });
    }
    enc.finish();
    gif = Array.from(enc.bytes());
  }
  return { still, gif };
}

const pa = await phone(before);
const pb = await phone(after);
const pc = await browser.newPage();
await pc.goto(base + "vendor/gifenc/LICENSE.md");
for (const spec of specs) {
  const [id, zoomText] = spec.split("@");
  const zoom = Number(zoomText || 1);
  const a = await pa.evaluate(frames, { id, zoom, turn });
  const b = await pb.evaluate(frames, { id, zoom, turn });
  const m = 8;
  const box = [
    Math.max(0, Math.min(a.box[0], b.box[0]) - m),
    Math.max(0, Math.min(a.box[1], b.box[1]) - m),
    Math.min(390, Math.max(a.box[2], b.box[2]) + m),
    Math.max(a.box[3], b.box[3]) + m,
  ];
  // The close crop: the middle 60% of the toy's width, as tall as wide.
  const cx = (box[0] + box[2]) / 2;
  const cy = (box[1] + box[3]) / 2;
  const half = ((box[2] - box[0]) * 0.3) | 0;
  const turnBox = [cx - half, cy - half, cx + half, cy + half];
  const scale = Math.max(Number(before.dsf), Number(after.dsf));
  const r = await pc.evaluate(compose, {
    a,
    b,
    box,
    turnBox,
    labels: [before.label, after.label],
    scale,
  });
  fs.writeFileSync(path.join(outDir, `${id}.png`), Buffer.from(r.still.split(",")[1], "base64"));
  if (r.gif) fs.writeFileSync(path.join(outDir, `${id}-turn.gif`), Buffer.from(r.gif));
  console.log(`${id}: ${path.join(outDir, id)}.png${r.gif ? " and -turn.gif" : ""}`);
}
await browser.close();
