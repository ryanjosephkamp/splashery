#!/usr/bin/env node
// Lane G: renders a splat file from several sides in the real app, for judging
// image-to-3D results against the toys before anything is packed.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/splat-views.mjs <file.ply> <out.png>
//     [--rotate=180,0,0] [--splats=300000] [--views=4] [--size=360] [--pitch=0.25] [--bg=#f4f1ea]
//
// The file is first rotated, stripped of spherical harmonics, centred, scaled
// and decimated with splat-transform (as tools/prepare-assets.mjs does), then
// opened like a dropped file and shot at evenly spaced yaws. Writes one PNG
// strip, the views side by side.

import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [input, out] = args.filter((a) => !a.startsWith("--"));
if (!input || !out) throw new Error("Usage: node tools/splat-views.mjs <file.ply> <out.png>");
const rotate = opt("rotate", "180,0,0");
const splats = opt("splats", "300000");
const views = Number(opt("views", 4));
const size = Number(opt("size", 360));
const pitch = Number(opt("pitch", 0.25));
const bg = opt("bg", "#f4f1ea");

const work = path.join(root, ".cache/g/views");
fs.mkdirSync(work, { recursive: true });
const stem = path.basename(input).replace(/\.[^.]+$/, "");
const st = (a) =>
  execFileSync(
    path.join(root, "node_modules/.bin/splat-transform"),
    ["-g", "cpu", "-q", "-w", ...a],
    {
      cwd: root,
      stdio: "inherit",
    },
  );

// Bounds of the reasonably opaque splats, ignoring the outer 1.5 % per axis.
function bounds(file) {
  const buf = fs.readFileSync(file);
  const headEnd = buf.indexOf("end_header\n");
  const head = buf.subarray(0, headEnd).toString("latin1").split("\n");
  let count = 0;
  const props = [];
  for (const line of head) {
    const t = line.trim().split(/\s+/);
    if (t[0] === "element" && t[1] === "vertex") count = Number(t[2]);
    if (t[0] === "property") props.push(t[2]);
  }
  const data = new Float32Array(
    buf.buffer.slice(buf.byteOffset + headEnd + 11),
    0,
    count * props.length,
  );
  const n = props.length;
  const op = props.indexOf("opacity");
  const keep = [];
  for (let i = 0; i < count; i++) if (1 / (1 + Math.exp(-data[i * n + op])) > 0.3) keep.push(i);
  return ["x", "y", "z"].map((axis) => {
    const k = props.indexOf(axis);
    const v = keep.map((i) => data[i * n + k]).sort((a, b) => a - b);
    const lo = v[Math.floor(v.length * 0.015)];
    const hi = v[Math.floor(v.length * 0.985)];
    return { c: (lo + hi) / 2, h: (hi - lo) / 2 };
  });
}

const rotated = path.join(work, `${stem}-rot.ply`);
st([input, "-r", rotate, "-H", "0", rotated]);
const b = bounds(rotated);
const scale = 0.9 / Math.max(...b.map((a) => a.h));
const norm = path.join(work, `${stem}.ply`);
const t = [b[0].c, b[1].c, -b[2].c].map((v) => v.toFixed(5)).join(",");
st([rotated, `--translate=${t}`, `--scale=${scale.toFixed(5)}`, "-d", splats, norm]);
const sog = path.join(work, `${stem}.sog`);
st([norm, sog]);

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const page = await browser.newPage({
  viewport: { width: 1000, height: 700 },
  reducedMotion: "reduce",
});
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=high&adapt=off`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
const shots = await page.evaluate(
  async ({ url, name, size, bg, views, pitch }) => {
    const { app, player } = window.__splashery;
    const bytes = await (await fetch(url)).arrayBuffer();
    await app.loadUserFile(new File([bytes], name));
    app.setLook({ background: bg });
    player.idle.weight = 0;
    await new Promise((r) => setTimeout(r, 2000));
    player.stage.setFixedSize([size, size]);
    const out = [];
    for (let v = 0; v < views; v++) {
      const cam = { ...player.camera.home, yaw: (v / views) * Math.PI * 2, pitch, distance: 3.6 };
      player.camera.cur = { ...cam };
      player.camera.tgt = { ...cam };
      for (let i = 0; i < 4; i++) await player.stage.captureFrame();
      out.push((await player.stage.captureFrame()).toDataURL("image/png"));
    }
    player.stage.setFixedSize(null);
    return out;
  },
  { url: base + path.relative(root, sog), name: `${stem}.sog`, size, bg, views, pitch },
);
await browser.close();

const strip = new PNG({ width: size * views, height: size });
shots.forEach((d, i) => {
  const png = PNG.sync.read(Buffer.from(d.split(",")[1], "base64"));
  PNG.bitblt(png, strip, 0, 0, Math.min(size, png.width), Math.min(size, png.height), i * size, 0);
});
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, PNG.sync.write(strip));
console.log(`${out} (${views} views; scale ${scale.toFixed(3)})`);
