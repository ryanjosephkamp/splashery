// Gaussian splatting (lane Screens): a toy made of splats that shows how
// splats work, on the AI and computing shelf. Four views:
//
// - Training (the default): a cloud of random splats slides, stretches and
//   recolors, step by step, until the picture appears. It is a real fit:
//   2D Gaussians fitted to the picture by gradient descent
//   (src/packs/splat-fit.js, run in src/packs/splat-fit-worker.js). The
//   fit's steps are keyframes; each keyframe is a copy of the splats (a
//   part), whose splats slide to the next keyframe's places on channel 0.
//   The fitted splats are drawn exactly as the fit drew them: flat, front
//   to back, over a card of the fit's background color.
// - One splat: one big soft splat drawn as an ellipsoid of many small
//   splats, with its three axes as rods.
// - Many splats: a small kit-built rubber duck, then every splat shrunk to
//   a dot, and back.
// - Sorting: the splats of a small ball appear one by one in the back-to-
//   front order a camera draws them in.

import { mix, shade, clamp, quatAxisAngle, quatRotate, rgb } from "../kit.js";
import { mulberry32, mixSeed } from "../noise.js";
import { fitSplats, FIT_KEYS } from "./splat-fit.js";

const TAU = Math.PI * 2;
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const win = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const bump = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));

// The sample picture (a CC0 photo) and the fit's size and splat count.
const SAMPLE = "assets/toys/gaussian-splatting/strawberry.jpg";
const FIT_W = 96;
const FIT_N = 2400;

// The toy's state (one toy is shown at a time): the view built last, the
// fits made so far (by picture), and the tap count seen.
const SPL = { view: "training", fit: null, fits: new Map(), tapN: 0, cue: 0 };

// The training picture's place (recipe units): its width, its center's
// height, and how deep the splats are stacked (front to back).
const PIC = { w: 2, y: 0.42, depth: 0.04 };

// ---- The fit -----------------------------------------------------------------------------

let worker = null;
let nextJob = 1;
const waiting = new Map();

// Runs the fit in the worker (or here, where there is no Worker).
function fitOffThread(job, onProgress) {
  if (typeof Worker === "undefined") return Promise.resolve(fitSplats(job));
  if (!worker) {
    worker = new Worker(new URL("./splat-fit-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      if (e.data.progress !== undefined) {
        w.onProgress?.(e.data.progress);
        return;
      }
      waiting.delete(e.data.id);
      if (e.data.error) w.reject(new Error(e.data.error));
      else w.resolve(e.data.out);
    };
    worker.onerror = (e) => {
      for (const w of waiting.values()) w.reject(new Error(e.message || "The fit stopped."));
      waiting.clear();
      worker = null;
    };
  }
  const id = nextJob++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, job }, [job.pixels.buffer]);
  });
}

// The picture's pixels at the fit's size: from the media the engine opened
// for this toy (the sample, or a photo of your own), else the sample file.
async function picturePixels(helper) {
  let draw = null;
  let aspect = 4 / 3;
  let key = SAMPLE;
  const media = helper?.media ? await helper.media().catch(() => null) : null;
  if (media?.draw) {
    aspect = media.aspect(0) || aspect;
    key = `${media.kind}:${media.name}:${media.count}`;
    draw = (w, h) => media.draw(0, w, h);
  } else {
    const img = new Image();
    img.src = new URL(`../../${SAMPLE}`, import.meta.url).href;
    await img.decode();
    aspect = img.naturalWidth / img.naturalHeight;
    draw = (w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      return c;
    };
  }
  const w = aspect >= 1 ? FIT_W : Math.max(24, Math.round(FIT_W * aspect));
  const h = aspect >= 1 ? Math.max(24, Math.round(FIT_W / aspect)) : FIT_W;
  const canvas = await draw(w, h);
  const data = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data; // prettier-ignore
  return { key, w, h, pixels: new Uint8ClampedArray(data) };
}

// The mean color round the picture's border: the card behind the splats.
function borderColor(px, w, h) {
  const s = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (x > 1 && x < w - 2 && y > 1 && y < h - 2) continue;
      const o = (y * w + x) * 4;
      s[0] += px[o];
      s[1] += px[o + 1];
      s[2] += px[o + 2];
      n++;
    }
  return s.map((v) => v / n / 255);
}

// A stand-in fit where pictures can't be read (the Node tools): the random
// start only, on a plain picture.
function standInFit() {
  const w = FIT_W;
  const h = 72;
  const pixels = new Uint8ClampedArray(w * h * 4).fill(235);
  const r = fitSplats({ pixels, w, h, n: FIT_N, keys: [0], steps: 0, background: [0.92, 0.92, 0.92] }); // prettier-ignore
  return { w, h, n: FIT_N, keys: r.keys, background: [0.92, 0.92, 0.92] };
}

// ---- Views -----------------------------------------------------------------------------------

const VIEWS = ["training", "one", "many", "sorting"];

// Each view's sound, played as cues (so each view has its own). Sound C (the
// owner's notes of October 2): training, a soft tone falling as the loss
// curve draws (from 0.35 s, most of its fall early as the curve's, fading by
// 4.9 s, inside the 5 s a sound may last), with no chord or notes; one splat, a soft
// airy swell as it turns; many splats, the twinkle quieter; sorting, a
// pebble's click as each splat is placed (driveSorting), and nothing on the tap.
const CUES = {
  training: { voice: "glide", at: 0.35, f: 740, to: 0.45, decay: 1.5, vol: 0.45 },
  one: { voice: "breath", f: 1100, to: 1.3, decay: 3, vol: 0.22 },
  many: [
    { voice: "sparkle", vol: 0.25 },
    { voice: "sparkle", at: 1.7, vol: 0.2 },
  ],
  sorting: null,
};

const SPLAT_OPTS = [
  { key: "sx", label: "Width", type: "slider", min: 0.1, max: 1, step: 0.05, default: 0.9 },
  { key: "sy", label: "Height", type: "slider", min: 0.1, max: 1, step: 0.05, default: 0.5 },
  { key: "sz", label: "Depth", type: "slider", min: 0.1, max: 1, step: 0.05, default: 0.3 },
  { key: "alpha", label: "Opacity", type: "slider", min: 0.1, max: 1, step: 0.05, default: 0.85 }, // prettier-ignore
  { key: "color", label: "Color", type: "color", default: "#e8553d" },
];

const INPUT = {
  title: "Your own photo",
  media: { accept: ["image"] },
  note: "Open a photo, or paste a web address, and watch splats learn it. Files stay on this device; nothing is uploaded.",
};

export const RECIPES = {
  "gaussian-splatting": {
    turntable: false,
    alive: true,
    get options() {
      return [
        {
          key: "view",
          label: "View",
          type: "select",
          default: "training",
          choices: [
            { id: "training", label: "Training" },
            { id: "one", label: "One splat" },
            { id: "many", label: "Many splats" },
            { id: "sorting", label: "Sorting" },
          ],
        },
        ...SPLAT_OPTS.map((o) => ({ ...o, hidden: SPL.view !== "one" })),
      ];
    },
    get controls() {
      const c = [{ key: "play", label: "Play", type: "pulse", ease: 7 }];
      if (SPL.view === "one") c.push({ key: "turn", label: "Turn", type: "slider", default: 0.15 });
      return c;
    },
    action: { key: "play", label: "Train, or play the view", quiet: ["play"] },
    // The training view shows the photo it learns on a small picture sheet.
    pictures: { sample: () => SAMPLE, accept: ["image"] },
    get input() {
      return SPL.view === "training" ? INPUT : undefined;
    },
    credits: [
      {
        label: "Gaussian splatting",
        title: "Strawberry on white background (the photo the splats learn)",
        source: "https://commons.wikimedia.org/wiki/File:Strawberry_on_white_background.jpg",
        author: "Joselodos",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      },
    ],
    // The training view's fit: made once per picture, in a worker.
    async prepare(o, helper) {
      if ((o.view ?? "training") !== "training") return;
      if (typeof document === "undefined") {
        SPL.fit = SPL.fits.get("stand-in") || standInFit();
        SPL.fits.set("stand-in", SPL.fit);
        return;
      }
      try {
        const pic = await picturePixels(helper);
        let fit = SPL.fits.get(pic.key);
        if (!fit) {
          const background = borderColor(pic.pixels, pic.w, pic.h);
          const out = await fitOffThread(
            { pixels: pic.pixels, w: pic.w, h: pic.h, n: FIT_N, keys: FIT_KEYS, background },
            helper?.progress,
          );
          fit = { ...out, background };
          SPL.fits.set(pic.key, fit);
        }
        SPL.fit = fit;
      } catch {
        SPL.fit = SPL.fits.get("stand-in") || standInFit();
        SPL.fits.set("stand-in", SPL.fit);
      }
    },
    drive(t, c, out, info) {
      const n = info.tap?.n ?? 0;
      if (n < SPL.tapN) SPL.tapN = 0;
      if (n > SPL.tapN) {
        SPL.tapN = n;
        if (CUES[SPL.view]) out.cues.push(CUES[SPL.view]);
      }
      // p: 0 at the tap, 1 at rest.
      const p = 1 - c.play;
      out.morph = [0, 0, 0, 0];
      if (SPL.view === "training") driveTraining(p, out, info.data);
      else if (SPL.view === "one") driveOne(p, c, out);
      else if (SPL.view === "many") driveMany(p, out);
      else driveSorting(p, out);
    },
    build(k, o) {
      const view = VIEWS.includes(o.view) ? o.view : "training";
      SPL.view = view;
      SPL.tapN = 0;
      SPL.sortP = undefined;
      if (view === "training") buildTraining(k);
      else if (view === "one") buildOne(k, o);
      else if (view === "many") buildMany(k);
      else buildSorting(k);
    },
  },
};

// ---- Training ----------------------------------------------------------------------------------

// The keyframes play on one clock: a short hold on the random start, then
// every step in turn at the same pace, the splats sliding all the way.
function driveTraining(p, out, data) {
  const K = data?.keys ?? 1;
  const u = win(p, 0.05, 0.93);
  const x = u * (K - 1);
  const seg = Math.min(K - 1, Math.floor(x));
  const f = seg >= K - 1 ? 0 : x - seg;
  for (let k = 0; k < K; k++) out.parts[`k${k}`] = { visible: k === seg ? 1 : 0 };
  out.morph[0] = f;
  // The loss curve draws behind its pen.
  out.morph[1] = u;
  const L = data?.loss;
  if (L) {
    const at = lossAt(L, u);
    out.parts.pen = { offset: [at[0] - L.x0, at[1] - L.y0, 0] };
  }
}

// The loss plot's point at u (0..1): log loss against the steps shown.
function lossAt(L, u) {
  const V = L.values;
  const x = u * (V.length - 1);
  const i = Math.max(0, Math.min(V.length - 2, Math.floor(x)));
  const v = V.length > 1 ? V[i] + (V[i + 1] - V[i]) * (x - i) : V[0];
  return [L.left + u * L.width, L.bottom + v * L.height];
}

function buildTraining(k) {
  const fit = SPL.fit || (SPL.fit = standInFit());
  const { w, h, n } = fit;
  const keys = fit.keys;
  const K = keys.length;
  const PW = PIC.w;
  const PH = (PW * h) / w;
  const s = PW / w; // recipe units per fit pixel
  const X = (x) => (x / w - 0.5) * PW;
  const Y = (y) => PIC.y + (0.5 - y / h) * PH;
  const dz = PIC.depth / n;
  // The kit gives every splat a random size between about 0.78 and 1.28
  // times the one asked for. These splats must keep their fitted sizes, so
  // the same random numbers are made here (the kit's sequence, from the
  // start: this cloud is the first thing built, one number per splat) and
  // divided out. tests/scr.spec.mjs checks the sizes the kit gives.
  const jr = mulberry32(mixSeed(k.seed, "kit-splats"));
  const total = K * n;
  const jitter = new Float32Array(total);
  for (let i = 0; i < total; i++) jitter[i] = Math.exp((jr() - 0.5) * 0.5);
  const parts = [];
  for (let kk = 0; kk < K; kk++) parts.push(k.part(`k${kk}`, { pivot: [0, PIC.y, 0] }));
  const base = 0.01; // the kit's splat size when nothing is weighted
  k.cloud({ count: (total * 160000) / k.count + 1, pattern: false }, (rand, i) => {
    if (i >= total) return null;
    const kk = Math.floor(i / n);
    const g = i % n;
    const key = keys[kk];
    const next = keys[kk + 1];
    let A = key.sx[g];
    let B = key.sy[g];
    let ang = key.angle[g];
    if (B > A) {
      [A, B] = [B, A];
      ang += Math.PI / 2;
    }
    // Pictures run down; the recipe runs up: the angle turns the other way.
    const z = -g * dz;
    return {
      p: [X(key.x[g]), Y(key.y[g]), z],
      dir: [Math.cos(ang), -Math.sin(ang), 0],
      stretch: (0.7 * A) / B, // the kit makes it [size * stretch, 0.7 size, 0.7 size]
      size: (B * s) / (0.7 * base * jitter[i]),
      color: [key.r[g], key.g[g], key.b[g]],
      opacity: key.a[g],
      part: parts[kk],
      to: next ? [X(next.x[g]), Y(next.y[g]), z] : undefined,
      channel: 0,
    };
  });
  // The card behind: the fit's background color, with a thin gray edge.
  const bg = fit.background || [1, 1, 1];
  const cardZ = -PIC.depth - 0.03;
  plate(k, { x: 0, y: PIC.y, z: cardZ, w: PW, h: PH, color: bg, count: 5000 });
  frame(k, { x: 0, y: PIC.y, z: cardZ + 0.002, w: PW + 0.03, h: PH + 0.03, t: 0.012, color: "#9aa1ab" }); // prettier-ignore

  // Below: the photo the splats learn (a picture sheet), and the loss.
  const rowY = PIC.y - PH / 2 - 0.42;
  const photoW = 0.86;
  k.sheet({
    id: "photo",
    center: [-PW / 2 + photoW / 2, rowY, 0],
    width: photoW,
    height: 0.62,
    method: "pixels",
    align: [-1, 0],
  });
  // The loss plot: axes, then the curve drawn behind a pen.
  const L = {
    left: -PW / 2 + photoW + 0.14,
    bottom: rowY - 0.28,
    width: PW / 2 - 0.02 - (-PW / 2 + photoW + 0.14),
    height: 0.56,
  };
  const losses = keys.map((kk) => Math.log(Math.max(1e-6, kk.loss)));
  const hi = Math.max(...losses);
  const lo = Math.min(...losses);
  L.values = losses.map((v) => (hi > lo ? (v - lo) / (hi - lo) : 0.5));
  const axisColor = "#8b929c";
  line(k, [L.left, L.bottom + L.height + 0.02, 0], [L.left, L.bottom - 0.02, 0], axisColor, 0.012, 120); // prettier-ignore
  line(k, [L.left - 0.02, L.bottom - 0.02, 0], [L.left + L.width + 0.03, L.bottom - 0.02, 0], axisColor, 0.012, 160); // prettier-ignore
  const dots = 90;
  k.cloud({ count: (dots * 160000) / k.count + 1, pattern: false }, (rand, i) => {
    if (i >= dots) return null;
    const u = i / (dots - 1);
    const [x, y] = lossAt(L, u);
    return {
      p: [x, y, 0.004],
      n: [0, 0, 1],
      size: 1.3,
      color: "#d9482b",
      opacity: 0.95,
      kind: "fade",
      channel: 1,
      params: [u * 0.999, -0.02],
    };
  });
  // The pen: a brighter dot where the curve is now.
  const [x0, y0] = lossAt(L, 1);
  L.x0 = x0;
  L.y0 = y0;
  const pen = k.part("pen", { pivot: [x0, y0, 0.01] });
  k.cloud({ count: (60 * 160000) / k.count + 1, pattern: false, part: pen }, (rand, i) => {
    if (i >= 60) return null;
    const a = rand() * TAU;
    const r = 0.03 * Math.sqrt(rand());
    return { p: [x0 + r * Math.cos(a), y0 + r * Math.sin(a), 0.01], n: [0, 0, 1], size: 1.2, color: "#ff7a3d", opacity: 1 }; // prettier-ignore
  });
  k.data ||= {};
  k.data.keys = K;
  k.data.loss = L;
}

// A smooth flat plate: two staggered lattices of flat discs (no speckle).
function plate(k, { x, y, z, w, h, color, count }) {
  const g = Math.max(8, Math.floor(Math.sqrt(count / 2)));
  const step = Math.max(w, h) / g;
  // Inset by half a step, so the edge splats stay inside the plate.
  w -= step;
  h -= step;
  const nx = Math.ceil(w / step);
  const ny = Math.ceil(h / step);
  const cells = [];
  for (let pass = 0; pass < 2; pass++)
    for (let j = 0; j <= ny - pass; j++)
      for (let i = 0; i <= nx - pass; i++) {
        const px = -w / 2 + (i + pass * 0.5) * (w / nx);
        const py = -h / 2 + (j + pass * 0.5) * (h / ny);
        cells.push([x + px, y + py]);
      }
  const size = (0.5 * step) / 0.01;
  k.cloud({ count: (cells.length * 160000) / k.count + 1, pattern: false }, (rand, i) => {
    if (i >= cells.length) return null;
    const c = cells[i];
    return { p: [c[0], c[1], z], n: [0, 0, 1], flat: 0.05, size, color, opacity: 1 };
  });
}

// A thin rectangular frame of flat discs.
function frame(k, { x, y, z, w, h, t, color }) {
  const segs = [
    [
      [x - w / 2, y + h / 2],
      [x + w / 2, y + h / 2],
    ],
    [
      [x - w / 2, y - h / 2],
      [x + w / 2, y - h / 2],
    ],
    [
      [x - w / 2, y - h / 2],
      [x - w / 2, y + h / 2],
    ],
    [
      [x + w / 2, y - h / 2],
      [x + w / 2, y + h / 2],
    ],
  ];
  for (const [a, b] of segs) line(k, [a[0], a[1], z], [b[0], b[1], z], color, t, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (t * 0.2))); // prettier-ignore
}

// A straight line of round splats from a to b, t thick.
function line(k, a, b, color, t, count) {
  k.cloud({ count: (count * 160000) / k.count + 1, pattern: false }, (rand, i) => {
    if (i >= count) return null;
    const u = count > 1 ? i / (count - 1) : 0;
    return {
      p: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u],
      n: [0, 0, 1],
      flat: 0.3,
      size: (t * 0.7) / 0.01,
      color,
      opacity: 1,
    };
  });
}

// ---- One splat ---------------------------------------------------------------------------------

// The tap: the splat swells and settles, turning a little.
function driveOne(p, c, out) {
  const b = bump(win(p, 0, 0.3));
  const turn = (c.turn ?? 0.15) * Math.PI + 0.5 * Math.sin(TAU * win(p, 0, 0.3)) * b;
  out.parts.splat = { quat: quatAxisAngle([0, 0, 1], turn), scale: 1 + 0.25 * b };
}

// Normally distributed numbers (Box-Muller) from rand.
function gauss(rand) {
  const u = Math.max(1e-9, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rand());
}

function buildOne(k, o) {
  const sx = o.sx ?? 0.9;
  const sy = o.sy ?? 0.5;
  const sz = o.sz ?? 0.3;
  const alpha = o.alpha ?? 0.85;
  const col = rgb(o.color || "#e8553d");
  const splat = k.part("splat", { pivot: [0, 0, 0], axis: [0, 0, 1] });
  // Its extent: the renderer cuts a splat off at 2.83 of its sizes.
  const cut = 2.83;
  k.reach([2.5, 2.5, 0]);
  k.reach([-2.5, -2.5, 0]);
  // The soft splat: small splats spread as the Gaussian says (dense in the
  // middle, thin at the edge), each a little see-through, so together they
  // glow like the one big splat.
  const N = 14000;
  k.cloud({ count: (N * 160000) / k.count + 1, part: splat, pattern: false }, (rand, i) => {
    if (i >= N) return null;
    let x;
    let y;
    let z;
    do {
      x = gauss(rand);
      y = gauss(rand);
      z = gauss(rand);
    } while (x * x + y * y + z * z > cut * cut);
    const r = Math.sqrt(x * x + y * y + z * z) / cut;
    return {
      p: [x * sx, y * sy, z * sz],
      size: 1.6 + 0.8 * rand(),
      color: mix(shade(col, 1.25), shade(col, 0.8), r),
      opacity: alpha * 0.22,
    };
  });
  // Its three axes: thin rods as long as its sizes (twice each way), red,
  // green and blue.
  const axes = [
    [[1, 0, 0], sx, "#e0463a"],
    [[0, 1, 0], sy, "#3fae4a"],
    [[0, 0, 1], sz, "#3b6fe0"],
  ];
  for (const [d, len, color] of axes) {
    const L = 2 * len;
    const count = Math.max(40, Math.round(L * 260));
    k.cloud(
      { count: (2 * count * 160000) / k.count + 1, part: splat, pattern: false },
      (rand, i) => {
        if (i >= 2 * count) return null;
        const u = (i / (2 * count - 1)) * 2 - 1;
        return {
          p: [d[0] * u * L, d[1] * u * L, d[2] * u * L],
          size: 1.1,
          color,
          opacity: 1,
        };
      },
    );
    // A ball at each end.
    for (const sgn of [-1, 1]) {
      k.cloud({ count: (50 * 160000) / k.count + 1, part: splat, pattern: false }, (rand, i) => {
        if (i >= 50) return null;
        const v = [gauss(rand), gauss(rand), gauss(rand)];
        const l = Math.hypot(...v) || 1;
        const r = 0.04;
        return {
          p: [d[0] * sgn * L + (v[0] / l) * r, d[1] * sgn * L + (v[1] / l) * r, d[2] * sgn * L + (v[2] / l) * r], // prettier-ignore
          size: 1.3,
          color: shade(color, 1.1),
          opacity: 1,
        };
      });
    }
  }
  // A faint square grid behind, so its size reads.
  const G = 11;
  for (let i = 0; i < G; i++) {
    const v = -2.4 + (4.8 * i) / (G - 1);
    line(k, [v, -2.4, -1.2], [v, 2.4, -1.2], "#c7ccd4", 0.01, 110);
    line(k, [-2.4, v, -1.2], [2.4, v, -1.2], "#c7ccd4", 0.01, 110);
  }
}

// ---- Many splats -------------------------------------------------------------------------------

// The tap: every splat shrinks to a dot, holds, and grows back.
function driveMany(p, out) {
  const t = p * 7;
  const shrink = ease(win(t, 0.1, 0.8)) * (1 - ease(win(t, 2.4, 3.2)));
  out.parts.duck = { visible: 1 - 0.82 * shrink };
}

function buildMany(k) {
  const duck = k.part("duck", { pivot: [0, 0, 0] });
  const yellow = "#f4c430";
  const litc = (c, col) => shade(col, 0.72 + 0.36 * Math.max(0, c.n[1] * 0.6 + c.n[2] * 0.5 + c.n[0] * 0.2)); // prettier-ignore
  // Few, big splats, so each one shows: a fixed count per piece, each splat
  // sized to its share of the surface (the kit's base size is 0.01 when
  // every piece has a count).
  const opts = { part: duck, even: true, flat: 0.35, jitter: 0.01, opacity: 1, pattern: false };
  const piece = (shape, o) =>
    k.add(shape, { ...opts, ...o, count: (o.count * 160000) / k.count, size: (1.25 * Math.sqrt(shape.area / o.count)) / 0.01 }); // prettier-ignore
  piece(k.ellipsoid(0.95, 0.62, 0.72), {
    pos: [0, -0.2, 0],
    count: 2600,
    color: (c) => litc(c, yellow),
  });
  // The tail, a little flick up at the back.
  piece(k.cone(0.34, 0.02, 0.5, { caps: false }), {
    pos: [-0.85, 0.05, 0],
    rot: [0, 0, 65],
    count: 300,
    color: (c) => litc(c, yellow),
  });
  piece(k.sphere(0.46), {
    pos: [0.5, 0.55, 0],
    count: 1400,
    color: (c) => litc(c, yellow),
  });
  piece(k.ellipsoid(0.26, 0.09, 0.2), {
    pos: [0.98, 0.48, 0],
    count: 380,
    color: (c) => litc(c, "#f07a1a"),
  });
  for (const z of [-0.26, 0.26]) {
    piece(k.sphere(0.07), {
      pos: [0.78, 0.68, z],
      count: 90,
      color: "#1c1c22",
    });
  }
}

// ---- Sorting -----------------------------------------------------------------------------------

// Bright, distinct colors, so each splat can be told from its neighbors.
const PALETTE = [
  "#e8453c",
  "#f29b30",
  "#f5d33b",
  "#5cc160",
  "#34a5d9",
  "#6b63d9",
  "#d95cb4",
  "#f4f1e8",
];
const SORT = { cam: [0.3, 1.1, 0.45], count: 300, bead: 220 };

// The tap: every splat hides, then they come back one by one, the one
// furthest from the camera first, as the renderer draws them.
function driveSorting(p, out) {
  out.morph[0] = p >= 1 ? 1 : win(p, 0.05, 0.75);
  sortClicks(p, out);
}

// Sound C: a pebble's click as each splat is placed (each a little
// different), in sync: the clicks come in batches about 0.2 s ahead, each
// scheduled for the moment its splat appears (`at`; the effect runs 7 s), so
// they keep time at any frame rate (one cue every 0.2 s or so, as the site
// spaces a toy's cues 60 ms apart).
function sortClicks(p, out) {
  const T = 7;
  const N = SORT.count;
  if (SPL.sortP === undefined || p < SPL.sortP - 0.3) SPL.sortP = p;
  if (p >= 1 || SPL.sortP - p > 0.05 / T) return;
  const reach = p + 0.25 / T;
  const clicks = [];
  for (let i = 0; i < N; i++) {
    const at = 0.05 + 0.7 * (0.02 + (0.96 * i) / (N - 1) + 0.006);
    if (at <= SPL.sortP || at > reach) continue;
    const h = (i * 0.618034) % 1;
    clicks.push({ voice: "pebble", f: 2300 * (0.8 + 0.5 * h), vol: 0.22 + 0.14 * ((i * 0.381966) % 1), at: (at - p) * T }); // prettier-ignore
  }
  SPL.sortP = reach;
  if (clicks.length) out.cues.push(clicks);
}

function buildSorting(k) {
  const rand = mulberry32(mixSeed(k.seed, "sorting-ball"));
  // A ball of splats, each drawn as what a splat is: a small colored
  // ellipsoid, turned its own way. Each is a bead of tiny opaque splats, so
  // it stays crisp at phone size (big soft splats read as a blur).
  const pts = [];
  for (let i = 0; i < SORT.count; i++) {
    let v;
    do v = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
    while (Math.hypot(...v) > 1);
    const p = v.map((x) => x * 0.62);
    const col = PALETTE[Math.floor(rand() * PALETTE.length)];
    // Its three axes: a random turn (a unit quaternion) and three sizes.
    const q = norm4([rand() - 0.5, rand() - 0.5, rand() - 0.5, rand() - 0.5]);
    const r = [0.095 + 0.03 * rand(), 0.06 + 0.02 * rand(), 0.028 + 0.01 * rand()];
    pts.push({ p, col, q, r, d: Math.hypot(p[0] - SORT.cam[0], p[1] - SORT.cam[1], p[2] - SORT.cam[2]) }); // prettier-ignore
  }
  // Back to front from the camera: furthest first.
  const order = pts.map((_, i) => i).sort((a, b) => pts[b].d - pts[a].d);
  const rank = new Float32Array(pts.length);
  order.forEach((i, r) => (rank[i] = r / (pts.length - 1)));
  const per = SORT.bead;
  const light = norm([0.4, 0.85, 0.55]);
  k.cloud({ count: (pts.length * per * 160000) / k.count + 1, pattern: false }, (rnd, i) => {
    if (i >= pts.length * per) return null;
    const b = pts[Math.floor(i / per)];
    // An even spread over the bead (a Fibonacci sphere), squashed to its sizes.
    const j = i % per;
    const z = 1 - (2 * (j + 0.5)) / per;
    const a = j * 2.399963;
    const rr = Math.sqrt(1 - z * z);
    const u = [rr * Math.cos(a), rr * Math.sin(a), z];
    const local = [u[0] * b.r[0], u[1] * b.r[1], u[2] * b.r[2]];
    const n = norm(quatRotate(b.q, [u[0] / b.r[0], u[1] / b.r[1], u[2] / b.r[2]]));
    const w = quatRotate(b.q, local);
    const lit = 0.62 + 0.45 * Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
    return {
      p: [b.p[0] + w[0], b.p[1] + w[1], b.p[2] + w[2]],
      n,
      flat: 0.4,
      size: 1.25,
      color: shade(b.col, lit),
      opacity: 1,
      kind: "fade",
      channel: 0,
      params: [0.02 + 0.96 * rank[Math.floor(i / per)], -0.012],
    };
  });
  // The camera that draws them, looking at the ball, and its lines of
  // sight to the ball's edge.
  const cam = SORT.cam;
  const look = norm([-cam[0], -cam[1], -cam[2]]);
  const side = norm([look[2], 0, -look[0]]);
  const up = cross(side, look);
  const at = (a, b, c) => [cam[0] + side[0] * a + up[0] * b + look[0] * c, cam[1] + side[1] * a + up[1] * b + look[1] * c, cam[2] + side[2] * a + up[2] * b + look[2] * c]; // prettier-ignore
  // Its body and lens are laid on even grids (random points read as grain
  // at phone size), the body with darker edges so the box reads crisp.
  const body = [];
  const half = [0.13, 0.09, 0.08];
  const step = 0.0058;
  for (let f = 0; f < 6; f++) {
    const ax = f >> 1;
    const a1 = (ax + 1) % 3;
    const a2 = (ax + 2) % 3;
    const nu = Math.round((2 * half[a1]) / step);
    const nv = Math.round((2 * half[a2]) / step);
    for (let iu = 0; iu < nu; iu++)
      for (let iv = 0; iv < nv; iv++) {
        const u = ((iu + 0.5) / nu) * 2 - 1;
        const v = ((iv + 0.5) / nv) * 2 - 1;
        const q = [0, 0, 0];
        q[ax] = (f & 1 ? -1 : 1) * half[ax];
        q[a1] = u * half[a1];
        q[a2] = v * half[a2];
        const rim = Math.max(Math.abs(u), Math.abs(v)) > 1 - 2 / Math.min(nu, nv);
        const lightF = 0.75 + (0.25 * ((f + 1) % 3)) / 2;
        body.push({ p: at(q[0], q[1], q[2] - 0.05), shade: rim ? lightF * 0.8 : lightF });
      }
  }
  k.cloud({ count: (body.length * 160000) / k.count + 1, pattern: false }, (r, i) => {
    if (i >= body.length) return null;
    return { p: body[i].p, size: 0.9, jitter: 0, color: shade("#3a3f48", body[i].shade), opacity: 1 }; // prettier-ignore
  });
  // The lens: a short barrel towards the ball, closed by its glass.
  const lens = [];
  const na = 64;
  const nz = 16;
  for (let ia = 0; ia < na; ia++)
    for (let iz = 0; iz < nz; iz++) {
      const a = ((ia + 0.5 * (iz % 2)) / na) * TAU;
      const z = ((iz + 0.5) / nz) * 0.16;
      lens.push({ p: at(0.055 * Math.cos(a), 0.055 * Math.sin(a), 0.07 + z * 0.6), c: "#1d2026" });
    }
  for (let i = 0; i < 220; i++) {
    const rr = 0.052 * Math.sqrt((i + 0.5) / 220);
    const a = i * 2.399963;
    const glint = Math.hypot(rr * Math.cos(a) + 0.02, rr * Math.sin(a) - 0.02) < 0.014;
    lens.push({ p: at(rr * Math.cos(a), rr * Math.sin(a), 0.07 + 0.096), c: glint ? "#7d8796" : "#2b3a4f" }); // prettier-ignore
  }
  k.cloud({ count: (lens.length * 160000) / k.count + 1, pattern: false }, (r, i) => {
    if (i >= lens.length) return null;
    return { p: lens[i].p, size: 0.9, jitter: 0, color: lens[i].c, opacity: 1 };
  });
  // Lines of sight: thin lines from the lens to the ball's rim.
  const eye = at(0, 0, 0.18);
  for (let j = 0; j < 4; j++) {
    const a = (j / 4) * TAU + 0.4;
    const rim = [0, 1, 2].map((j) => (side[j] * Math.cos(a) + up[j] * Math.sin(a)) * 0.62); // prettier-ignore
    line(k, eye, rim, "#9aa3b0", 0.008, 180); // a thin, continuous line
  }
}

function norm4(v) {
  const l = Math.hypot(v[0], v[1], v[2], v[3]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l, v[3] / l];
}
function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
