#!/usr/bin/env node
// Real elements (lane Elements, prefix rel): turns each element's sample photo into the toy's 3D
// sample. For each photo in src/elements-real/samples.js it
//
//   1. downloads the photo (once, into .cache/rel/raw/),
//   2. works out its depth in the browser with the Photo to 3D tool's depth model (Depth Anything
//      V2 Small, ONNX Runtime Web, as tools/p3d-depth.mjs does),
//   3. cuts the sample out of its background with a hard edge: the background's color and depth
//      are fitted from the photo's border (a smooth surface each), and a pixel belongs to the
//      sample where it differs from both (soft shadows on the paper, darker but the same color and
//      at the paper's depth, stay background); holes inside are filled and specks dropped,
//   4. writes assets/toys/real-elements/: tiles.jpg and tiles.png (every sample at 64 x 64, ten to
//      a row, for the table), and <z>.jpg and <z>.png (384 x 384, loaded only when a sample is
//      lifted). The JPEG holds the colors; the PNG is gray, 0 outside the sample and 1 to 255 its
//      depth (255 nearest).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/rel-samples.mjs [z ...]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { PICTURED, pictureOf } from "../src/elements-real/samples.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const rawDir = path.join(root, ".cache/rel/raw");
const workDir = path.join(root, ".cache/rel/work");
const outDir = path.join(root, "assets/toys/real-elements");
for (const d of [rawDir, workDir, outDir]) fs.mkdirSync(d, { recursive: true });

const args = process.argv.slice(2);
const only = args.filter((a) => /^\d+$/.test(a)).map(Number);
const TILE = 64;
const DETAIL = 384; // polish: up from 256, for the lifted sample's finer splats
const COLS = 10;
const WORK = 512; // the photo's long side while cutting out
const UA = { "User-Agent": "SplasheryBuild/1.0 (https://github.com/ryanjosephkamp/splashery; build tool)" }; // prettier-ignore

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function fetchRetry(url) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.ok) return r;
    if (i >= 5 || (r.status !== 429 && r.status < 500)) throw new Error(`${r.status} ${url}`);
    await sleep(5000 * (i + 1));
  }
}
// (A stand-in picture, for an element with no photo of a real sample, is "<z>-stand".)
const rawName = (z) => {
  const s = pictureOf(z);
  if (s.kind) return `${z}-stand`;
  return s.src === "commons" ? `${z}-commons.jpg` : `${z}-${path.basename(s.file)}`;
};
async function download(z) {
  const at = path.join(rawDir, rawName(z));
  if (fs.existsSync(at)) return at;
  const s = pictureOf(z);
  let url = s.file;
  if (s.src === "commons") {
    const q = new URLSearchParams({ action: "query", prop: "imageinfo", iiprop: "url|size", iiurlwidth: "1200", titles: `File:${s.file}`, format: "json" }); // prettier-ignore
    const j = await (await fetchRetry(`https://commons.wikimedia.org/w/api.php?${q}`)).json();
    const ii = Object.values(j.query.pages)[0].imageinfo[0];
    url = ii.width > 1200 ? ii.thumburl : ii.url;
    await sleep(3000);
  }
  fs.writeFileSync(at, Buffer.from(await (await fetchRetry(url)).arrayBuffer()));
  return at;
}

// A stand-in picture's treatment by its kind: a portrait is shown flat and in black and white, a
// flag as a whole waving cloth, a coat of arms cut out by its own transparency; a photo of an
// object or mineral is cut out like the samples.
const KIND_TUNE = {
  portrait: { rect: true, gray: true },
  flag: { rect: true, wave: true },
  arms: { alpha: true },
};
const tuneOf = (z) => ({ ...(KIND_TUNE[pictureOf(z).kind] || {}), ...(TUNE[z] || {}) });

// ---- The cutout ---------------------------------------------------------------------------

// Least-squares fit of v ≈ a + b x + c y + d x² + e xy + f y² over the given points.
function fitQuad(xs, ys, vs) {
  const n = xs.length;
  const A = Array.from({ length: 6 }, () => new Float64Array(7));
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    const f = [1, x, y, x * x, x * y, y * y];
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) A[r][c] += f[r] * f[c];
      A[r][6] += f[r] * vs[i];
    }
  }
  for (let r = 0; r < 6; r++) A[r][r] += 1e-6;
  for (let c = 0; c < 6; c++) {
    let p = c;
    for (let r = c + 1; r < 6; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 6; r++) {
      if (r === c) continue;
      const k = A[r][c] / A[c][c];
      for (let q = c; q < 7; q++) A[r][q] -= k * A[c][q];
    }
  }
  const co = A.map((row, i) => row[6] / row[i]);
  return (x, y) => co[0] + co[1] * x + co[2] * y + co[3] * x * x + co[4] * x * y + co[5] * y * y;
}

const median = (a) => {
  const s = Float64Array.from(a).sort();
  return s.length ? s[s.length >> 1] : 0;
};

function morph(mask, w, h, r, grow) {
  // A square dilation (grow) or erosion, radius r, separable.
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  const want = grow ? 1 : 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 1 - want;
      for (let k = -r; k <= r && v !== want; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        if (mask[y * w + xx] === want) v = want;
      }
      tmp[y * w + x] = v;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 1 - want;
      for (let k = -r; k <= r && v !== want; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        if (tmp[yy * w + x] === want) v = want;
      }
      out[y * w + x] = v;
    }
  return out;
}

// Connected components (4-neighbors) of the set pixels: a label per pixel and the sizes.
function components(mask, w, h) {
  const lab = new Int32Array(w * h).fill(-1);
  const sizes = [];
  const touches = [];
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || lab[i] >= 0) continue;
    const id = sizes.length;
    let n = 0;
    let edge = false;
    stack.push(i);
    lab[i] = id;
    while (stack.length) {
      const j = stack.pop();
      n++;
      const x = j % w;
      const y = (j / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) // prettier-ignore
        if (k >= 0 && mask[k] && lab[k] < 0) {
          lab[k] = id;
          stack.push(k);
        }
    }
    sizes.push(n);
    touches.push(edge);
  }
  return { lab, sizes, touches };
}

// The mask's convex hull, filled (a sample in a glass tube keeps its whole tube, not ragged glints).
function hullFill(mask, w, h) {
  const pts = [];
  for (let y = 0; y < h; y++) {
    let a = -1;
    let b = -1;
    for (let x = 0; x < w; x++)
      if (mask[y * w + x]) {
        if (a < 0) a = x;
        b = x;
      }
    if (a >= 0) pts.push([a, y], [b + 1, y], [a, y + 1], [b + 1, y + 1]);
  }
  if (pts.length < 3) return mask;
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const p of pts) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  const up = [];
  for (const p of pts.slice().reverse()) {
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  const hull = lo.slice(0, -1).concat(up.slice(0, -1));
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const yc = y + 0.5;
    const xs = [];
    for (let i = 0; i < hull.length; i++) {
      const [x0, y0] = hull[i];
      const [x1, y1] = hull[(i + 1) % hull.length];
      if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0)); // prettier-ignore
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x < Math.min(w, xs[k + 1] - 0.5); x++) out[y * w + x] = 1; // prettier-ignore
  }
  return out;
}

export function cutout(photo, depth, tune = {}) {
  const { w, h, data } = photo;
  const N = w * h;
  // A sample that can't be cut from its background cleanly is shown as its cropped photo, whole
  // (rect) or in an ellipse (a sphere).
  if (tune.rect) return new Uint8Array(N).fill(1);
  if (tune.alpha) return data.filter((_, i) => i % 4 === 3).map((a) => (a > 127 ? 1 : 0));
  if (tune.ellipse) {
    const m = new Uint8Array(N);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        m[y * w + x] = ((x + 0.5) / w - 0.5) ** 2 + ((y + 0.5) / h - 0.5) ** 2 <= 0.25 ? 1 : 0;
    return m;
  }
  // Normalized coordinates for the fits.
  const X = (x) => x / w - 0.5;
  const Y = (y) => y / h - 0.5;
  // The border ring.
  const ring = Math.max(3, Math.round(0.035 * Math.max(w, h)));
  let idx = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (x < ring || y < ring || x >= w - ring || y >= h - ring) idx.push(y * w + x);
  // Fit the background's color (each channel) and depth, twice: the second time without the
  // border pixels that are far off the first fit (where the sample reaches the edge).
  let fits;
  for (let pass = 0; pass < 3; pass++) {
    const xs = idx.map((i) => X(i % w));
    const ys = idx.map((i) => Y((i / w) | 0));
    fits = [0, 1, 2].map((c) =>
      fitQuad(
        xs,
        ys,
        idx.map((i) => data[i * 4 + c]),
      ),
    );
    fits.push(
      fitQuad(
        xs,
        ys,
        idx.map((i) => depth[i]),
      ),
    );
    const res = idx.map((i) => {
      const x = X(i % w);
      const y = Y((i / w) | 0);
      return Math.hypot(...[0, 1, 2].map((c) => data[i * 4 + c] - fits[c](x, y)));
    });
    const m = median(res);
    idx = idx.filter((_, k) => res[k] <= Math.max(6, 2.5 * m));
  }
  // How far each pixel is from the background, in color and in depth.
  let dmin = Infinity;
  let dmax = -Infinity;
  for (let i = 0; i < N; i++) {
    dmin = Math.min(dmin, depth[i]);
    dmax = Math.max(dmax, depth[i]);
  }
  const span = dmax - dmin || 1;
  const bgRes = idx.map((i) =>
    Math.hypot(...[0, 1, 2].map((c) => data[i * 4 + c] - fits[c](X(i % w), Y((i / w) | 0)))),
  );
  const T = Math.max(tune.minT ?? 24, 3.2 * median(bgRes)) * (tune.t ?? 1);
  let mask = new Uint8Array(N);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const bg = [0, 1, 2].map((c) => Math.min(255, Math.max(0, fits[c](X(x), Y(y)))));
      const px = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
      const dist = Math.hypot(px[0] - bg[0], px[1] - bg[1], px[2] - bg[2]);
      const dz = (depth[i] - fits[3](X(x), Y(y))) / span;
      let fg = dist > T || (dz > (tune.dz ?? 0.1) && dist > 0.45 * T);
      if (fg && dz < (tune.shadowDz ?? 0.1) && !tune.keepShadows) {
        // A shadow: the paper, darker by the same factor in every channel, at its depth.
        const r = px.map((v, c) => (v + 4) / (bg[c] + 4));
        const mean = (r[0] + r[1] + r[2]) / 3;
        if (mean > 0.25 && mean < 0.97 && Math.max(...r) - Math.min(...r) < (tune.shadowSpread ?? 0.12)) fg = false; // prettier-ignore
      }
      mask[i] = fg ? 1 : 0;
    }
  // Close small gaps, then open away thin specks.
  const r0 = Math.max(1, Math.round(w / 256));
  mask = morph(morph(mask, w, h, 2 * r0, true), w, h, 2 * r0, false);
  mask = morph(morph(mask, w, h, r0, false), w, h, r0, true);
  // Fill the holes: background not reachable from the border.
  const inv = mask.map((v) => 1 - v);
  const holes = components(inv, w, h);
  for (let i = 0; i < N; i++) if (inv[i] && !holes.touches[holes.lab[i]]) mask[i] = 1;
  // Keep the big pieces.
  const comp = components(mask, w, h);
  const big = Math.max(0, ...comp.sizes);
  const keep = comp.sizes.map((s) => s >= (tune.keep ?? 0.08) * big && s > N * 0.0015);
  for (let i = 0; i < N; i++) if (mask[i] && !keep[comp.lab[i]]) mask[i] = 0;
  return tune.hull ? hullFill(mask, w, h) : mask;
}

// Shrinks the masked sample (its bounding box, plus a margin) into a size x size square, keeping its
// shape: colors and depth averaged over the sample's own pixels only (so no background bleeds in),
// and a cell is in the sample when at least half of it is. Depth goes to 1..255 over the sample.
function pack(photo, depth, mask, size) {
  const { w, h, data } = photo;
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (mask[y * w + x]) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  const side = Math.max(x1 - x0 + 1, y1 - y0 + 1) * 1.04;
  const cx = (x0 + x1 + 1) / 2;
  const cy = (y0 + y1 + 1) / 2;
  const s = side / size;
  // Depth range over the sample (2nd to 98th percentile).
  const ds = [];
  for (let i = 0; i < w * h; i++) if (mask[i]) ds.push(depth[i]);
  ds.sort((a, b) => a - b);
  const lo = ds[Math.floor(ds.length * 0.02)];
  const hi = ds[Math.floor(ds.length * 0.98)];
  const rgb = new Uint8Array(size * size * 4);
  const gray = new Uint8Array(size * size);
  for (let ty = 0; ty < size; ty++)
    for (let tx = 0; tx < size; tx++) {
      const sx0 = cx - side / 2 + tx * s;
      const sy0 = cy - side / 2 + ty * s;
      let n = 0;
      let m = 0;
      const acc = [0, 0, 0, 0];
      const steps = Math.max(1, Math.ceil(s));
      for (let a = 0; a < steps; a++)
        for (let b = 0; b < steps; b++) {
          const x = Math.floor(sx0 + ((a + 0.5) * s) / steps);
          const y = Math.floor(sy0 + ((b + 0.5) * s) / steps);
          n++;
          if (x < 0 || y < 0 || x >= w || y >= h || !mask[y * w + x]) continue;
          const i = y * w + x;
          m++;
          acc[0] += data[i * 4];
          acc[1] += data[i * 4 + 1];
          acc[2] += data[i * 4 + 2];
          acc[3] += depth[i];
        }
      const o = ty * size + tx;
      rgb[o * 4 + 3] = 255;
      // (Polish: three fifths, up from half, so the sample's rim keeps no background fringe.)
      if (m * 5 < n * 3 || !m) {
        rgb.fill(0, o * 4, o * 4 + 3);
        continue;
      }
      for (let c = 0; c < 3; c++) rgb[o * 4 + c] = Math.round(acc[c] / m);
      const d = (acc[3] / m - lo) / (hi - lo || 1);
      gray[o] = 1 + Math.round(254 * Math.min(1, Math.max(0, d)));
    }
  // Outside the sample the colors are the sample's mean, so the JPEG's blocks don't smear a dark
  // or light rim into the sample's edge.
  const mean = [0, 0, 0];
  let cnt = 0;
  for (let o = 0; o < size * size; o++)
    if (gray[o]) {
      for (let c = 0; c < 3; c++) mean[c] += rgb[o * 4 + c];
      cnt++;
    }
  for (let o = 0; o < size * size; o++)
    if (!gray[o]) for (let c = 0; c < 3; c++) rgb[o * 4 + c] = Math.round(mean[c] / (cnt || 1));
  for (let o = 0; o < size * size; o++) rgb[o * 4 + 3] = 255;
  return { rgb, gray };
}

const writeJpeg = (file, w, h, rgba, q) =>
  fs.writeFileSync(file, jpeg.encode({ width: w, height: h, data: Buffer.from(rgba) }, q).data);
function writeGray(file, w, h, gray) {
  const png = new PNG({ width: w, height: h, colorType: 0, inputColorType: 0, bitDepth: 8 });
  png.data = Buffer.from(gray);
  fs.writeFileSync(file, PNG.sync.write(png, { colorType: 0, inputColorType: 0 }));
}

// ---- Main ---------------------------------------------------------------------------------

// Hand settings for photos the plain cutout misreads: samples in glass tubes keep their whole tube
// (hull), and a stricter threshold (t) for busy backgrounds.
const hull = { hull: true };
const TUNE = {
  3: hull,
  9: { rect: true },
  11: { rect: true },
  17: { t: 2.2 },
  21: hull,
  23: hull,
  33: hull,
  37: hull,
  38: hull,
  40: hull,
  43: hull,
  56: hull,
  57: hull,
  58: hull,
  59: hull,
  60: hull,
  62: hull,
  63: hull,
  80: hull,
  81: hull,
  83: { t: 1.4 },
  88: { t: 1.7 },
  92: { rect: true },
  93: { ellipse: true },
  99: { t: 1.5 },
};

const ids = only.length ? only.filter((z) => PICTURED.includes(z)) : PICTURED;
for (const z of ids) await download(z);

// The browser (for the depth model) only when a photo's depth isn't cached yet.
const fresh = ids.some((z) => !fs.existsSync(path.join(workDir, `${z}.json`)));
const b = fresh
  ? await chromium.launch({
      executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
      args: ["--no-sandbox"],
    })
  : null;
const page = b && (await b.newPage());
page?.on("pageerror", (e) => console.log("pageerror:", e.message));
// A plain page on the site (not the app, which would draw a toy while the model runs).
await page?.goto("http://127.0.0.1:4173/LICENSES.md");
for (const z of ids) {
  const cache = path.join(workDir, `${z}.json`);
  let got;
  if (fs.existsSync(cache)) got = JSON.parse(fs.readFileSync(cache, "utf8"));
  else {
    got = await page.evaluate(
      async ({ url, crop, WORK }) => {
        const dep = await import("/src/packs/photo-3d-depth.js");
        const blob = await (await fetch(url)).blob();
        const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
        const [c0, c1, c2, c3] = crop || [0, 0, 1, 1];
        const sx = c0 * bmp.width;
        const sy = c1 * bmp.height;
        const sw = (c2 - c0) * bmp.width;
        const sh = (c3 - c1) * bmp.height;
        const f = WORK / Math.max(sw, sh);
        const w = Math.round(sw * f);
        const h = Math.round(sh * f);
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const g = cv.getContext("2d", { willReadFrequently: true });
        g.imageSmoothingQuality = "high";
        g.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
        const data = new Uint8Array(g.getImageData(0, 0, w, h).data.buffer);
        const d = await dep.estimateDepth({ w, h, data });
        // The depth at the photo's size (bilinear).
        const depth = new Float32Array(w * h);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const u = ((x + 0.5) / w) * d.w - 0.5;
            const v = ((y + 0.5) / h) * d.h - 0.5;
            const i = Math.max(0, Math.min(d.w - 2, Math.floor(u)));
            const j = Math.max(0, Math.min(d.h - 2, Math.floor(v)));
            const a = Math.min(1, Math.max(0, u - i));
            const c = Math.min(1, Math.max(0, v - j));
            const at = (p, q) => d.d[q * d.w + p];
            depth[y * w + x] =
              (1 - c) * ((1 - a) * at(i, j) + a * at(i + 1, j)) +
              c * ((1 - a) * at(i, j + 1) + a * at(i + 1, j + 1));
          }
        return { w, h, data: Array.from(data), depth: Array.from(depth), ms: d.ms };
      },
      { url: `/.cache/rel/raw/${rawName(z)}`, crop: pictureOf(z).crop, WORK },
    );
    fs.writeFileSync(cache, JSON.stringify(got));
  }
  const photo = { w: got.w, h: got.h, data: Uint8Array.from(got.data) };
  let depth = Float32Array.from(got.depth);
  const tune = tuneOf(z);
  if (tune.gray)
    for (let i = 0; i < photo.w * photo.h; i++) {
      const [r, g2, b2] = photo.data.subarray(i * 4, i * 4 + 3);
      photo.data.fill(Math.round(0.2126 * r + 0.7152 * g2 + 0.0722 * b2), i * 4, i * 4 + 3);
    }
  if (tune.wave) {
    // A flag's cloth: a gentle wave that grows from the hoist (left) to the fly.
    depth = new Float32Array(photo.w * photo.h);
    for (let y = 0; y < photo.h; y++)
      for (let x = 0; x < photo.w; x++) {
        const u = x / photo.w;
        depth[y * photo.w + x] =
          0.5 + 0.5 * u * Math.sin(Math.PI * 2 * (1.4 * u + 0.25 * (y / photo.h)));
      }
  }
  if (tune.alpha)
    // The coat of arms on a white ground for the depth model's sake was never drawn: transparent
    // pixels are black, so take them as the background color.
    for (let i = 0; i < photo.w * photo.h; i++)
      if (photo.data[i * 4 + 3] < 128) photo.data.fill(255, i * 4, i * 4 + 3);
  // Polish: one pixel off the cut-out's rim, where the photo's pixels still mix in the background
  // (the fringe); the cropped cards keep their edges.
  const raw = cutout(photo, depth, tune);
  const mask = tune.rect || tune.ellipse ? raw : morph(raw, photo.w, photo.h, 1, false);
  const det = pack(photo, depth, mask, DETAIL);
  writeJpeg(path.join(outDir, `${z}.jpg`), DETAIL, DETAIL, det.rgb, 86);
  writeGray(path.join(outDir, `${z}.png`), DETAIL, DETAIL, det.gray);
  const tile = pack(photo, depth, mask, TILE);
  fs.writeFileSync(path.join(workDir, `${z}.tile.json`), JSON.stringify({ rgb: Array.from(tile.rgb), gray: Array.from(tile.gray) })); // prettier-ignore
  // A preview of the cutout for checking by eye (the photo, gray where it was cut away).
  const prev = new Uint8Array(photo.data);
  for (let i = 0; i < photo.w * photo.h; i++)
    if (!mask[i]) for (let c = 0; c < 3; c++) prev[i * 4 + c] = 70 + (prev[i * 4 + c] >> 3);
  writeJpeg(path.join(workDir, `${z}.cut.jpg`), photo.w, photo.h, prev, 80);
  console.log(`${z}: ${photo.w}x${photo.h}${got.ms ? `, depth ${Math.round(got.ms)} ms` : ""}`);
}
await b?.close();

// The atlas of every sample's tile, in PICTURED order.
const rows = Math.ceil(PICTURED.length / COLS);
const AW = COLS * TILE;
const AH = rows * TILE;
const argb = new Uint8Array(AW * AH * 4).fill(255);
const agray = new Uint8Array(AW * AH);
PICTURED.forEach((z, k) => {
  const f = path.join(workDir, `${z}.tile.json`);
  if (!fs.existsSync(f)) return;
  const t = JSON.parse(fs.readFileSync(f, "utf8"));
  const ox = (k % COLS) * TILE;
  const oy = Math.floor(k / COLS) * TILE;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const s = y * TILE + x;
      const o = (oy + y) * AW + ox + x;
      for (let c = 0; c < 4; c++) argb[o * 4 + c] = t.rgb[s * 4 + c];
      agray[o] = t.gray[s];
    }
});
writeJpeg(path.join(outDir, "tiles.jpg"), AW, AH, argb, 88);
writeGray(path.join(outDir, "tiles.png"), AW, AH, agray);
let total = 0;
for (const f of fs.readdirSync(outDir)) total += fs.statSync(path.join(outDir, f)).size;
console.log(`atlas ${AW}x${AH}; assets/toys/real-elements: ${(total / 1e6).toFixed(2)} MB`);
