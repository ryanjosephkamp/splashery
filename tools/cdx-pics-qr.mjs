// Task 54: deterministic original CC0 backgrounds, an exploratory sweep, and selection.
// node tools/cdx-pics-qr.mjs (writes candidates/evidence; only kept JPEGs ship).
import fs from "node:fs";
import jpeg from "jpeg-js";
import {
  makeWoven,
  checkWoven,
  rasterize,
  squareSample,
  gray,
  measure,
} from "../src/qr-craft/picture.js";

export const TEXT = "https://ryanjosephkamp.github.io/splashery/";
export const OPTIONS = {
  text: TEXT,
  level: "H",
  contrast: 0.5,
  center: "small",
  style: "color",
  size: "more",
};
const mod = { exports: {} };
new Function("module", "exports", fs.readFileSync("vendor/jsqr/jsQR.js", "utf8"))(mod, mod.exports);
export const read = (rgba, w, h) =>
  (mod.exports.default || mod.exports)(new Uint8ClampedArray(rgba), w, h, {
    inversionAttempts: "dontInvert",
  })?.data ?? null;
export function load(file, side = 640) {
  const j = jpeg.decode(fs.readFileSync(file), { useTArray: true });
  const n = Math.min(side, j.width);
  const data = new Float32Array(n * n * 3);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const p = (Math.floor((y * j.height) / n) * j.width + Math.floor((x * j.width) / n)) * 4;
      for (let c = 0; c < 3; c++) data[(y * n + x) * 3 + c] = j.data[p + c] / 255;
    }
  return { w: n, h: n, data };
}
const clamp = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
const palettes = [
  [0.85, 0.31, 0.15],
  [0.12, 0.65, 0.73],
  [0.52, 0.35, 0.81],
  [0.77, 0.57, 0.1],
  [0.2, 0.68, 0.37],
  [0.88, 0.34, 0.56],
  [0.28, 0.5, 0.84],
  [0.73, 0.43, 0.22],
];
export const FAMILIES = [
  "Petal garden",
  "Rolling hills",
  "Pebble pool",
  "Folded ribbons",
  "Leaf canopy",
  "Sunlit dunes",
  "Orbiting spheres",
  "Ceramic vase",
  "Tidal shells",
];
function field(f, x, y, v) {
  const a = v * 0.17;
  const dx = x - 0.52,
    dy = y - 0.55;
  const r = Math.hypot(dx, dy),
    theta = Math.atan2(dy, dx);
  switch (f) {
    case 0:
      return (
        smooth((0.31 + 0.08 * Math.cos(theta * (5 + (v % 3)) + a) - r) * 35) *
        (0.55 + 0.4 * Math.cos(r * 13 - a))
      );
    case 1:
      return (
        0.22 +
        0.26 * smooth((y - 0.42 - 0.09 * Math.sin(x * 7 + a)) * 28) +
        0.3 * smooth((y - 0.64 - 0.1 * Math.sin(x * 9 + a + 1)) * 28)
      );
    case 2: {
      let s = 0;
      for (let i = 0; i < 7; i++) {
        const cx = 0.25 + (i % 3) * 0.23 + 0.02 * Math.sin(a + i),
          cy = 0.3 + Math.floor(i / 3) * 0.22;
        const rr = Math.hypot((x - cx) * 1.1, y - cy);
        s = Math.max(s, smooth((0.105 - rr) * 70) * (0.8 - 2 * rr));
      }
      return s;
    }
    case 3:
      return (
        (0.5 + 0.5 * Math.sin(y * 19 + 2.2 * Math.sin(x * 5 + a))) *
        smooth((0.44 - Math.abs(dx)) * 20)
      );
    case 4: {
      let s = 0;
      for (let i = 0; i < 6; i++) {
        const cx = 0.3 + (i % 2) * 0.38,
          cy = 0.27 + Math.floor(i / 2) * 0.24;
        const u = x - cx + (y - cy) * (i % 2 ? 0.8 : -0.8),
          z = y - cy;
        s = Math.max(
          s,
          smooth((1 - (u / 0.14) ** 2 - (z / 0.09) ** 2) * 8) * (0.55 + 0.2 * Math.cos(u * 15 + a)),
        );
      }
      return s;
    }
    case 5:
      return 0.4 + 0.28 * Math.sin(y * 13 + Math.sin(x * 5 + a)) + 0.08 * Math.sin(y * 30 + x * 4);
    case 6: {
      let s = 0;
      for (let i = 0; i < 4; i++) {
        const cx = 0.3 + (i % 2) * 0.36,
          cy = 0.32 + Math.floor(i / 2) * 0.34;
        const rr = Math.hypot(x - cx, y - cy);
        s = Math.max(
          s,
          smooth((0.16 - rr) * 80) * (0.45 + 0.4 * clamp(0.5 - (x - cx) * 3 - (y - cy) * 3)),
        );
      }
      return s;
    }
    case 7: {
      const width = 0.14 + 0.06 * Math.sin((y - 0.3) * 8);
      return (
        smooth((width - Math.abs(dx)) * 70) *
        smooth((y - 0.26) * 60) *
        smooth((0.84 - y) * 60) *
        (0.6 + 0.2 * Math.cos(dx * 12 + a))
      );
    }
    default:
      return (
        smooth((0.35 - r) * 35) *
        (0.5 + 0.2 * Math.cos(theta * 12 + r * 18 + a) + 0.18 * Math.sin(r * 35))
      );
  }
}
export function generate(f, v, n = 640, probe = null, printProfile = false) {
  const data = new Float32Array(n * n * 3);
  const pal = palettes[v % palettes.length];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const X = (x + 0.5) / n,
        Y = (y + 0.5) / n;
      let t = field(f, X, Y, v);
      let saturation = 0.72,
        range = 0.68,
        mean = 0.53;
      if (probe) {
        const freq = probe.dense ? 24 : 4;
        const xx = X - (probe.corner ? 0.15 : 0.55),
          yy = Y - (probe.corner ? 0.15 : 0.55);
        t =
          (0.5 + 0.5 * Math.sin(X * freq) * Math.cos(Y * freq)) *
          Math.exp(-(xx * xx + yy * yy) / 0.12);
        range = probe.wide ? 0.95 : 0.36;
        saturation = probe.color ? 0.95 : 0;
      } else {
        range = 0.48 + (v % 4) * 0.1;
        mean = 0.49 + Math.floor(v / 4) * 0.08;
      }
      if (printProfile) {
        range = 0.5 + (v % 3) * 0.1;
        mean = 0.5 + (v % 4) * 0.045;
        saturation = 0.08 + Math.floor(v / 4) * 0.08;
      }
      const tone = mean + range * (t - 0.42);
      const pg = gray(pal);
      for (let c = 0; c < 3; c++)
        data[(y * n + x) * 3 + c] = clamp(tone + saturation * (pal[c] - pg) * (0.35 + 0.65 * t));
    }
  return { w: n, h: n, data };
}
export function save(pic, file) {
  const data = new Uint8Array(pic.w * pic.h * 4);
  for (let i = 0; i < pic.w * pic.h; i++) {
    for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.round(pic.data[i * 3 + c] * 255);
    data[i * 4 + 3] = 255;
  }
  fs.writeFileSync(file, jpeg.encode({ width: pic.w, height: pic.h, data }, 88).data);
}
export function properties(pic) {
  const src = squareSample(pic, 96),
    lum = [],
    edge = [],
    center = [],
    corner = [];
  let chroma = 0;
  for (let i = 0; i < 96 * 96; i++) {
    const c = Array.from(src.subarray(i * 3, i * 3 + 3));
    lum.push(gray(c));
    chroma += Math.max(...c) - Math.min(...c);
  }
  for (let y = 1; y < 95; y++)
    for (let x = 1; x < 95; x++) {
      const i = y * 96 + x,
        e = Math.abs(lum[i] - lum[i + 1]) + Math.abs(lum[i] - lum[i + 96]);
      edge.push(e);
      (x > 24 && x < 72 && y > 24 && y < 72 ? center : corner).push(e);
    }
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const sorted = [...lum].sort((a, b) => a - b);
  return {
    contrastRange: sorted[Math.floor(lum.length * 0.95)] - sorted[Math.floor(lum.length * 0.05)],
    edgeDensity: mean(edge),
    centerDetail: mean(center),
    outerDetail: mean(corner),
    color: chroma / lum.length,
    midtones: lum.filter((x) => x > 0.3 && x < 0.7).length / lum.length,
  };
}
export function detail(pic, woven) {
  const N = woven.code.size,
    src = squareSample(pic, N),
    out = new Float32Array(N * N * 3);
  for (let y = 0; y < woven.G; y++)
    for (let x = 0; x < woven.G; x++) {
      const p = (Math.floor(y / woven.k) * N + Math.floor(x / woven.k)) * 3;
      for (let c = 0; c < 3; c++)
        out[p + c] += woven.cells[(y * woven.G + x) * 3 + c] / woven.k ** 2;
    }
  let error = 0,
    dot = 0,
    a2 = 0,
    b2 = 0;
  for (let i = 0; i < out.length; i++) error += Math.abs(out[i] - src[i]);
  for (let y = 0; y < N - 1; y++)
    for (let x = 0; x < N - 1; x++)
      for (const d of [1, N])
        for (let c = 0; c < 3; c++) {
          const i = (y * N + x) * 3 + c,
            a = src[i + d * 3] - src[i],
            b = out[i + d * 3] - out[i];
          dot += a * b;
          a2 += a * a;
          b2 += b * b;
        }
  const fidelity = 1 - error / out.length,
    edges = Math.max(0, dot / Math.sqrt(Math.max(1e-12, a2 * b2)));
  return { score: 100 * (0.55 * fidelity + 0.45 * edges), fidelity, edges };
}
export function trials(pic, options = OPTIONS, texts = [TEXT, "Splashery picture QR"]) {
  const results = [];
  for (const text of texts) {
    const woven = makeWoven(pic, { ...options, text }); // no adaptive rescue: qualify the background itself
    const ck = checkWoven(woven, read);
    results.push(
      ...ck.sizes.map((s) => ({
        text,
        size: options.size,
        level: options.level,
        trial: s.id,
        ok: s.ok,
      })),
    );
    for (const [label, px, blur] of [
      ["phone-330", 330, 0.3],
      ["print-900", 900, 0.2],
    ]) {
      const img = rasterize(woven, px / (woven.code.size + 8), { blur });
      results.push({
        text,
        size: options.size,
        level: options.level,
        trial: label,
        pixels: img.width,
        ok: read(img.data, img.width, img.height) === text,
      });
    }
    results.push({
      text,
      size: options.size,
      level: options.level,
      trial: "module-contrast-over-3",
      ok: measure(woven).module > 3,
    });
  }
  return results;
}
if (process.argv[1]?.endsWith("cdx-pics-qr.mjs")) {
  fs.mkdirSync(".cache/cdx-pics/qr", { recursive: true });
  const probes = [];
  for (let i = 0; i < 16; i++) {
    const factors = { wide: !!(i & 1), corner: !!(i & 2), dense: !!(i & 4), color: !!(i & 8) };
    const pic = generate(0, 1, 640, factors),
      scans = [];
    for (const level of ["L", "M", "Q", "H"])
      for (const size of ["fit", "more", "most"]) {
        const woven = makeWoven(pic, { ...OPTIONS, level, size });
        scans.push({
          level,
          size,
          ...detail(pic, woven),
          scans: checkWoven(woven, read).sizes.map((s) => ({ trial: s.id, ok: s.ok })),
        });
      }
    save(pic, `.cache/cdx-pics/qr/probe-${i}.jpg`);
    probes.push({ id: `probe-${i}`, factors, properties: properties(pic), scans });
    console.log(`probe ${i + 1}/16`);
  }
  fs.writeFileSync(
    "docs/audits/sample-pictures-2026-10/qr-probes.json",
    JSON.stringify(probes, null, 2) + "\n",
  );
  const rows = [];
  for (let f = 0; f < FAMILIES.length; f++)
    for (let v = 0; v < 8; v++) {
      const id = `cdx-qr-${f + 1}-${v + 1}`,
        label = `${FAMILIES[f]} ${v + 1}`,
        file = `.cache/cdx-pics/qr/${id}.jpg`;
      save(generate(f, v, 960), file);
      const pic = load(file),
        woven = makeWoven(pic, OPTIONS),
        scans = [...trials(pic), ...trials(pic, { ...OPTIONS, size: "fit" }, [TEXT])];
      rows.push({
        id,
        label,
        family: FAMILIES[f],
        variant: v,
        file,
        ...detail(pic, woven),
        properties: properties(pic),
        scans,
        eligible: scans.filter((s) => s.text === TEXT).every((s) => s.ok),
      });
      console.log(
        `${id}: ${rows.at(-1).score.toFixed(2)}, ${scans.filter((s) => s.ok).length}/${scans.length}`,
      );
      fs.writeFileSync(".cache/cdx-pics/qr-scores.json", JSON.stringify(rows, null, 2));
    }
  const ranked = rows.filter((r) => r.eligible).sort((a, b) => b.score - a.score);
  if (ranked.length < 24)
    throw new Error(`Only ${ranked.length} scan-qualified backgrounds; generate more.`);
  const kept = new Set(ranked.slice(0, 24).map((r) => r.id));
  fs.mkdirSync("assets/toys/qr-picture/codex", { recursive: true });
  for (const r of rows) {
    r.kept = kept.has(r.id);
    if (r.kept) {
      const out = `assets/toys/qr-picture/codex/${r.id}.jpg`;
      fs.copyFileSync(r.file, out);
      r.file = out;
    } else delete r.file;
  }
  fs.writeFileSync(
    "docs/audits/sample-pictures-2026-10/qr-scores.json",
    JSON.stringify(rows, null, 2) + "\n",
  );
  console.log(`Kept ${kept.size} of ${rows.length}.`);
}
