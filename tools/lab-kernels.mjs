#!/usr/bin/env node
// Lane Lab: measures the splat kernels (src/kernels.js) side by side.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/lab-kernels.mjs <out-dir> [--kernels=gaussian,sharp,disc] [--renderer=webgl2] id[@zoom] ...
//
// For each toy (and zoom: 1 is the toy's home view, 0.45 comes three times
// closer) and each kernel it renders a still at 390×844 CSS pixels at a
// device pixel ratio of 2 (the canvas the owner's phone draws), and measures:
//   edge   the median 10–90% rise, in pixels, across the strongest edges
//          (text strokes, seams, outlines): lower is sharper.
//   speck  the mean difference from a 3×3 median over the flat parts of the
//          toy (grain and speckle): lower is cleaner.
//   shim   shimmer while turning: the mean frame-to-frame change of the fine
//          detail over 12 frames turning 0.4° each: lower is steadier.
//   ms     the mean time to draw a frame in the software renderer, relative
//          only (a phone's GPU is the real test).
//   splats the toy's splat count (with its picture sheets).
// Writes <id>@<zoom>-<kernel>.png stills and prints a table (and results.json).

import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
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
  throw new Error("Usage: node tools/lab-kernels.mjs <out-dir> id[@zoom] ...");
const kernels = opt("kernels", "gaussian,sharp,disc").split(",");
const renderer = opt("renderer", "webgl2");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan,WebGPU",
    "--use-webgpu-adapter=swiftshader",
    "--use-vulkan=swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=${renderer}&profile=high&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });

const decode = (url) => PNG.sync.read(Buffer.from(url.split(",")[1], "base64"));
const lum = (png) => {
  const { width: w, height: h, data } = png;
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    L[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
  return { L, w, h };
};

// The toy's pixels: those that differ from the background color.
function mask({ L, w, h }, bgL) {
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = Math.abs(L[i] - bgL) > 3 ? 1 : 0;
  return m;
}

function sobel({ L, w, h }) {
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      gx[i] =
        L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1];
      gy[i] =
        L[i + w - 1] + 2 * L[i + w] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - w] - L[i - w + 1];
    }
  return { gx, gy };
}

const sample = ({ L, w, h }, x, y) => {
  const x0 = Math.max(0, Math.min(w - 2, Math.floor(x)));
  const y0 = Math.max(0, Math.min(h - 2, Math.floor(y)));
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * w + x0;
  return (
    (L[i] * (1 - fx) + L[i + 1] * fx) * (1 - fy) + (L[i + w] * (1 - fx) + L[i + w + 1] * fx) * fy
  );
};

// Median 10–90% rise across the strongest 1% of edges (at least 20 levels).
function edgeWidth(img) {
  const { w, h } = img;
  const { gx, gy } = sobel(img);
  const mags = [];
  for (let y = 8; y < h - 8; y++)
    for (let x = 8; x < w - 8; x++) {
      const i = y * w + x;
      const m = Math.hypot(gx[i], gy[i]);
      if (m > 80) mags.push([m, x, y]);
    }
  mags.sort((a, b) => b[0] - a[0]);
  const top = mags.slice(0, Math.max(50, Math.floor(mags.length * 0.01)));
  const widths = [];
  for (const [m, x, y] of top) {
    const i = y * w + x;
    const dx = gx[i] / m;
    const dy = gy[i] / m;
    const prof = [];
    for (let s = -6; s <= 6; s += 0.25) prof.push(sample(img, x + dx * s, y + dy * s));
    const lo = Math.min(...prof);
    const hi = Math.max(...prof);
    if (hi - lo < 60) continue;
    const c = Math.floor(prof.length / 2);
    const t10 = lo + 0.1 * (hi - lo);
    const t90 = lo + 0.9 * (hi - lo);
    // Rising along the gradient: the last sample under 10% before the center
    // and the first over 90% after it, each crossing interpolated.
    let a = c;
    while (a > 0 && prof[a] > t10) a--;
    let b = c;
    while (b < prof.length - 1 && prof[b] < t90) b++;
    const fa = a + (t10 - prof[a]) / Math.max(1e-6, prof[a + 1] - prof[a]);
    const fb = b - (prof[b] - t90) / Math.max(1e-6, prof[b] - prof[b - 1]);
    widths.push((fb - fa) * 0.25);
  }
  widths.sort((a, b) => a - b);
  return widths.length ? widths[Math.floor(widths.length / 2)] : NaN;
}

const median9 = (L, w, i) => {
  const v = [L[i - w - 1], L[i - w], L[i - w + 1], L[i - 1], L[i], L[i + 1], L[i + w - 1], L[i + w], L[i + w + 1]]; // prettier-ignore
  v.sort((a, b) => a - b);
  return v[4];
};

// Mean |L − median3×3| over the flatter half of the toy's pixels.
function speckle(img, m) {
  const { L, w, h } = img;
  const { gx, gy } = sobel(img);
  const cand = [];
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      if (!m[i] || !m[i - w - 1] || !m[i + w + 1]) continue;
      cand.push([Math.hypot(gx[i], gy[i]), i]);
    }
  cand.sort((a, b) => a[0] - b[0]);
  const flat = cand.slice(0, Math.floor(cand.length / 2));
  let s = 0;
  for (const [, i] of flat) s += Math.abs(L[i] - median9(L, w, i));
  return flat.length ? s / flat.length : NaN;
}

// Fine detail: L − a 3×3 box blur.
function highpass({ L, w, h }) {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const box = (L[i - w - 1] + L[i - w] + L[i - w + 1] + L[i - 1] + L[i] + L[i + 1] + L[i + w - 1] + L[i + w] + L[i + w + 1]) / 9; // prettier-ignore
      out[i] = L[i] - box;
    }
  return out;
}

const results = [];
for (const spec of specs) {
  const [id, zoomText] = spec.split("@");
  const zoom = Number(zoomText || 1);
  for (const kernel of kernels) {
    const r = await page.evaluate(
      async ({ id, zoom, kernel }) => {
        const { app, player } = window.__splashery;
        const url = new URL(location.href);
        url.searchParams.set("kernel", kernel);
        history.replaceState(null, "", url);
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
        put(view);
        const stage = player.stage;
        // Let picture pages build and the sort settle.
        const settle = id.startsWith("picture") || id.startsWith("your-book") ? 9000 : 2500;
        const until = performance.now() + settle;
        while (performance.now() < until) {
          put(view);
          await stage.captureFrame();
          await new Promise((r) => setTimeout(r, 100));
        }
        put(view);
        await stage.captureFrame();
        const still = (await stage.captureFrame()).toDataURL("image/png");
        // Turning: 12 frames, 0.4° apart, for shimmer and frame time.
        const frames = [];
        let ms = 0;
        for (let k = 0; k < 13; k++) {
          put({ ...view, yaw: view.yaw + (k * 0.4 * Math.PI) / 180 });
          const t0 = performance.now();
          const c = await stage.captureFrame();
          if (k > 0) ms += performance.now() - t0;
          frames.push(c.toDataURL("image/png"));
        }
        put(view);
        const sheets = player.pictures?.stats?.lastCount || 0;
        return {
          still,
          frames,
          ms: ms / 12,
          splats: player.toyInfo.splats,
          sheets,
          kernel: stage.kernel || "gaussian",
          dev: stage.deviceType,
        };
      },
      { id, zoom, kernel },
    );
    const png = decode(r.still);
    fs.writeFileSync(path.join(outDir, `${id}@${zoom}-${kernel}.png`), PNG.sync.write(png));
    const img = lum(png);
    const m = mask(img, 255);
    let shim = 0;
    let prev = null;
    let count = 0;
    for (const f of r.frames) {
      const hp = highpass(lum(decode(f)));
      if (prev) {
        let s = 0;
        for (let i = 0; i < hp.length; i++) if (m[i]) s += Math.abs(hp[i] - prev[i]);
        shim += s;
        count += m.reduce((a, b) => a + b, 0);
      }
      prev = hp;
    }
    const row = {
      toy: id,
      zoom,
      kernel: r.kernel,
      edge: +edgeWidth(img).toFixed(2),
      speck: +speckle(img, m).toFixed(2),
      shim: +(shim / Math.max(1, count)).toFixed(2),
      ms: +r.ms.toFixed(1),
      splats: r.splats,
      sheets: r.sheets,
      dev: r.dev,
    };
    results.push(row);
    console.log(JSON.stringify(row));
  }
}
fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
await browser.close();
