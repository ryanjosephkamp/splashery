#!/usr/bin/env node
// Lane Sharpness: measures where a toy's grain comes from, one render lever
// at a time (src/sharpness.js, docs/lab/SHARPNESS.md).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/shp-measure.mjs <out-dir> \
//     [--configs=base,drop,cap3,dpr3,cull,sharp,high,all] [--renderer=webgl2] id[@zoom] ...
//
// Each config is a phone: a 390×844 CSS-pixel page at a device pixel ratio
// (2 or 3) with a tier and a set of labs switches:
//   base   a 2x phone today (mid tier, ratio 2)
//   drop   the same phone while the adaptive drop is on (ratio 2 / 1.5)
//   cap3   a 3x phone today (the tier caps the ratio at 2)
//   dpr3   a 3x phone with the cap lifted (?dpr=3)
//   cull   a 2x phone with the small-splat cull off (?cull=off)
//   sharp  a 2x phone with the sharp kernel (?kernel=sharp)
//   high   a 2x phone at the high tier (more splats in a kit toy)
//   all    a 3x phone with every lever on (?sharp=1&kernel=sharp)
// For each toy it renders the still home view (or zoom: 0.4 is 2.5 times
// closer) and measures, as tools/lab-kernels.mjs does (docs/lab/KERNELS.md):
//   edge   the median 10–90% rise across the strongest edges, in CSS pixels
//          (device pixels / ratio): lower is sharper.
//   speck  the mean difference from a 3×3 median over the flat half of the
//          toy, in the canvas's own pixels: lower is cleaner.
//   shim   the mean frame-to-frame change of the fine detail over 12 frames
//          turning 0.4° each: lower is steadier.
//   ms     the mean frame time in the software renderer (relative only).
//   splats the toy's splats; cullGL and cullGPU the share of them the
//          engine's default cull drops in this view (estimated on the CPU
//          from each splat's size and opacity, kit toys only): cullGL by
//          minPixelSize (WebGL2 and WebGPU), cullGPU also by minContribution
//          (WebGPU only).
// Writes <id>@<zoom>-<config>.png stills and results.json, and prints a row
// per render.

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
  throw new Error("Usage: node tools/shp-measure.mjs <out-dir> id[@zoom] ...");
const CONFIGS = {
  base: { dsf: 2, q: "" },
  drop: { dsf: 2, q: "dpr=1.3333" },
  cap3: { dsf: 3, q: "" },
  dpr3: { dsf: 3, q: "dpr=3" },
  cull: { dsf: 2, q: "cull=off" },
  sharp: { dsf: 2, q: "kernel=sharp" },
  high: { dsf: 2, q: "", profile: "high" },
  all: { dsf: 3, q: "sharp=1&kernel=sharp" },
  aa: { dsf: 2, q: "aa=1" },
};
const configs = opt("configs", Object.keys(CONFIGS).join(",")).split(",");
const renderer = opt("renderer", "webgl2");
const shimmer = opt("shimmer", "1") !== "0";
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

const decode = (url) => PNG.sync.read(Buffer.from(url.split(",")[1], "base64"));
const lum = (png) => {
  const { width: w, height: h, data } = png;
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    L[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
  return { L, w, h };
};

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

// Median 10–90% rise across the strongest 1% of edges, in the image's pixels.
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

// Runs in the page: renders one toy in one view and returns the still, the
// turning frames and the cull estimate.
async function renderToy({ id, zoom, shimmer }) {
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
  put(view);
  const stage = player.stage;
  const slow = /^(picture|your-book|world)/.test(id);
  const until = performance.now() + (slow ? 9000 : 2500);
  while (performance.now() < until) {
    put(view);
    await stage.captureFrame();
    await new Promise((r) => setTimeout(r, 100));
  }
  put(view);
  await stage.captureFrame();
  const still = (await stage.captureFrame()).toDataURL("image/png");
  const frames = [];
  let ms = 0;
  const turns = shimmer ? 13 : 4;
  for (let k = 0; k < turns; k++) {
    put({ ...view, yaw: view.yaw + (k * 0.4 * Math.PI) / 180 });
    const t0 = performance.now();
    const c = await stage.captureFrame();
    if (k > 0) ms += performance.now() - t0;
    if (shimmer) frames.push(c.toDataURL("image/png"));
  }
  put(view);
  await stage.captureFrame();

  // The engine's default cull, estimated per splat from its two largest
  // axes: a 2D covariance of σa², σb² plus the 0.3 px² blur every splat
  // gets. minPixelSize 2 compares 2·sqrt(2·λmax); minContribution 3
  // compares opacity · 2π · sqrt(det).
  let cullGL = null;
  let cullGPU = null;
  const buf = player.proc?.ctx?.buf;
  if (buf) {
    const e = stage.toy.entity;
    const m = e.getWorldTransform();
    const s = e.getLocalScale().x;
    const camE = stage.cameraEntity;
    const cp = camE.getPosition();
    const fwd = camE.forward;
    const c = stage.canvas;
    const portrait = c.width < c.height;
    const fovRad = (camE.camera.fov * Math.PI) / 180;
    const focal = (portrait ? c.width : c.height) / 2 / Math.tan(fovRad / 2);
    const p = new cp.constructor();
    const q = new cp.constructor();
    let gl = 0;
    let gpu = 0;
    let seen = 0;
    for (let i = 0; i < buf.count; i++) {
      const alpha = buf.color[i * 4 + 3];
      const sc = [buf.scale[i * 3], buf.scale[i * 3 + 1], buf.scale[i * 3 + 2]];
      if (alpha <= 0 || sc[0] + sc[1] + sc[2] <= 0) continue;
      p.set(buf.pos[i * 3], buf.pos[i * 3 + 1], buf.pos[i * 3 + 2]);
      m.transformPoint(p, q);
      const depth = (q.x - cp.x) * fwd.x + (q.y - cp.y) * fwd.y + (q.z - cp.z) * fwd.z;
      if (depth <= 0.02) continue;
      seen++;
      sc.sort((a, b) => b - a);
      const k = (s * focal) / depth;
      const va = (sc[0] * k) ** 2 + 0.3;
      const vb = (sc[1] * k) ** 2 + 0.3;
      if (2 * Math.sqrt(2 * va) < 2) {
        gl++;
        gpu++;
      } else if (alpha * 2 * Math.PI * Math.sqrt(va * vb) < 3) gpu++;
    }
    cullGL = seen ? gl / seen : 0;
    cullGPU = seen ? gpu / seen : 0;
  }
  return {
    still,
    frames,
    ms: ms / (turns - 1),
    splats: player.toyInfo.splats + (player.pictures?.stats?.lastCount || 0),
    ratio: stage.device.maxPixelRatio,
    canvas: [stage.canvas.width, stage.canvas.height],
    kernel: stage.kernel || "gaussian",
    sharp: stage.sharp || null,
    cullGL,
    cullGPU,
    dev: stage.deviceType,
  };
}

// A world (lane Worlds, /worlds/): its page has its own renderer, so the
// levers are set on it by hand (the ratio and the cull), to show what the
// world render should adopt. No shimmer (the camera follows the character).
async function measureWorld(name, cfg, world) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: cfg.dsf,
  });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  const prof = cfg.profile || "mid";
  await page.goto(`${base}worlds/?labs=1&renderer=${renderer}&profile=${prof}&clock=manual&world=${world}`); // prettier-ignore
  await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 200_000 });
  await page.click("#enter");
  const lever = { dpr: cfg.q.match(/dpr=([\d.]+)/)?.[1], cull: /cull=off|sharp=1/.test(cfg.q) };
  const r = await page.evaluate(
    async ({ lever }) => {
      const w = window.__world;
      const v = w.view;
      if (lever.dpr) {
        v.device.maxPixelRatio = Math.min(window.devicePixelRatio, Number(lever.dpr));
        v.resize();
      }
      if (lever.cull) {
        v.app.scene.gsplat.minPixelSize = lever.cull === true && lever.dpr ? 1 : 0;
        v.app.scene.gsplat.minContribution = 0;
      }
      w.catchUp();
      for (let i = 0; i < 6; i++) await w.tick(1 / 30);
      let ms = 0;
      for (let i = 0; i < 6; i++) {
        const t0 = performance.now();
        await w.tick(0);
        ms += performance.now() - t0;
      }
      // The canvas's own pixels, read while the frame is still in the buffer.
      const shot = new Promise((res) => (v.captureWaiters ||= []).push(() => res(v.canvas.toDataURL("image/png")))); // prettier-ignore
      await w.tick(0);
      const still = await shot;
      return { ms: ms / 6, splats: w.stats().total, ratio: v.device.maxPixelRatio, dev: v.deviceType, still }; // prettier-ignore
    },
    { lever },
  );
  await page.close();
  return { ...r, png: decode(r.still) };
}

const results = [];
for (const name of configs) {
  const worlds = specs.filter((s) => s.startsWith("world:"));
  for (const spec of worlds) {
    const cfg = CONFIGS[name];
    if (!["base", "drop", "cap3", "dpr3", "cull", "all"].includes(name)) continue;
    const r = await measureWorld(name, cfg, spec.slice(6));
    fs.writeFileSync(path.join(outDir, `${spec.replace(":", "-")}-${name}.png`), PNG.sync.write(r.png)); // prettier-ignore
    const img = lum(r.png);
    // The ground and everything on it: below the top third (the sky).
    const m = new Uint8Array(img.w * img.h).fill(1, Math.floor(img.h / 3) * img.w);
    const row = {
      toy: spec,
      zoom: 1,
      config: name,
      ratio: +r.ratio.toFixed(2),
      canvas: `${r.png.width}x${r.png.height}`,
      edge: +(edgeWidth(img) / r.ratio).toFixed(2),
      speck: +speckle(img, m).toFixed(2),
      shim: null,
      ms: +r.ms.toFixed(1),
      splats: r.splats,
      dev: r.dev,
    };
    results.push(row);
    console.log(JSON.stringify(row));
  }
}
for (const name of configs) {
  const cfg = CONFIGS[name];
  if (!cfg) throw new Error(`Unknown config ${name}`);
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: cfg.dsf,
  });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  const q = `renderer=${renderer}&profile=${cfg.profile || "mid"}&adapt=off&labs=1${cfg.q ? "&" + cfg.q : ""}`;
  await page.goto(`${base}?${q}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  for (const spec of specs.filter((x) => !x.startsWith("world:"))) {
    const [id, zoomText] = spec.split("@");
    const zoom = Number(zoomText || 1);
    let r;
    try {
      r = await page.evaluate(renderToy, { id, zoom, shimmer });
    } catch (err) {
      console.error(`${id}@${zoom} ${name}: ${err.message}`);
      continue;
    }
    const png = decode(r.still);
    fs.writeFileSync(path.join(outDir, `${id}@${zoom}-${name}.png`), PNG.sync.write(png));
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
      config: name,
      ratio: +r.ratio.toFixed(2),
      canvas: r.canvas.join("x"),
      edge: +(edgeWidth(img) / r.ratio).toFixed(2),
      speck: +speckle(img, m).toFixed(2),
      shim: shimmer ? +(shim / Math.max(1, count)).toFixed(2) : null,
      ms: +r.ms.toFixed(1),
      splats: r.splats,
      cullGL: r.cullGL == null ? null : +(r.cullGL * 100).toFixed(1),
      cullGPU: r.cullGPU == null ? null : +(r.cullGPU * 100).toFixed(1),
      kernel: r.kernel,
      sharp: r.sharp,
      dev: r.dev,
    };
    results.push(row);
    console.log(JSON.stringify(row));
  }
  await page.close();
}
fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
await browser.close();
