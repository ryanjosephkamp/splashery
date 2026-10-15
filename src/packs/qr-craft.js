// Lane QR craft (docs/handoff/QRcraft.md): codes you make, as splats.
//
//   qr-picture  Picture QR: a photo woven into a QR code as a halftone. Each
//               module's center keeps its bit; the rest of it carries the
//               picture as dark and light dots by error diffusion, with a
//               nudge only where a module would misread (src/qr-craft/
//               picture.js, lane QR r4). The toy measures the contrast
//               and reads the code with jsQR at phone size and smaller, and
//               offers the closest version that scans when one doesn't.
//               A tap sends a ripple out from the tap: each tile lifts and
//               falls with its own picture colors (lane QR r5).
//   qr-build    QR from real things: dominoes that topple into place, marbles
//               that roll into their modules, tiles that flip over
//               (src/qr-craft/pieces.js). A tap plays the build from the
//               start; every build ends on a code that scans, which the toy
//               reads back with jsQR.
//   barcodes    Other barcodes: Code 128, EAN-13 and UPC-A drawn by our own
//               code (src/qr-craft/barcodes.js, with their check digits and
//               quiet zones), and Data Matrix and Aztec from ZXing for
//               JavaScript (vendor/zxing-js/, loaded when the toy opens). A
//               tap sweeps a scanner's red line across; each bar lifts as it
//               passes. The toy reads its own picture back with zxing-js.
//
// Nothing leaves the device: the person's own picture is read here and kept
// in memory only; the texts live in the toys' options.
//
// The test hook: window.__splashery.qrCraft (at the end of this file).

import {
  FG,
  BG,
  QUIET,
  CENTERS,
  LEVELS,
  STYLES as PIC_STYLES,
  makeWoven,
  makeWovenAsync,
  checkWoven,
  checkStrict,
  weave,
  measure,
  closestScanning,
  closestScanningAsync,
  renderingKey,
  tidy,
  gray,
  SIZES_UP,
} from "../qr-craft/picture.js";
import { validateDetail, validateCapture, cancelDetailChecks } from "../qr-craft/scan-pool.js";
import { tileColors } from "../qr-craft/frame.js";
import { withScanPause, withScanTail } from "../qr-craft/scan-pause.js";
import { loadRasterKernel } from "../qr-craft/fast-raster.js";
import { loadBlurKernel } from "../qr-craft/fast-blur.js";
import { detailFraction, detailOptionsSupported } from "../qr-craft/detail-policy.js";
import { codePicture, cropSettings, decorationColor, fitMaskWoven } from "../qr-craft/fit.js";
import { cropPanel } from "../qr-craft/crop-panel.js";
import { wovenEyes, paintEyes } from "../qr/eyes.js";
import {
  FIT_OPTIONS,
  FIT_EXTRA,
  borderSettings,
  fitDecoration,
  fitControls,
  fittedOptions,
  pictureFitOptions,
} from "../qr/fit-options.js";
import { SAMPLES, sampleById } from "../qr-craft/samples.js";
import { pictureModifier, buildModifier, scanModifier } from "../qr-craft/field.js";
import { code128, ean13, upcA, barSpans, guardModules } from "../qr-craft/barcodes.js";
import { inkedLine } from "../qr-craft/glyphs.js";
import { encodeQR } from "../qr/encode.js";
import { TUNE, painter, moduleGrid } from "../qr/crisp.js";
import {
  circleLayout,
  circleSplats,
  shapeHalf,
  shapeChoices,
  appendSplats,
  CIRCLE_QUIET,
} from "../qr/circle.js";
import {
  MATERIALS,
  materialById,
  buildPieces,
  BUILD_SECS,
  FALL_SECS,
  ROLL_SECS,
  FLIP_SECS,
  COLORS,
  DOMINO_T,
  MARBLE_R,
  TILE_T,
  DROP_SECS,
} from "../qr-craft/pieces.js";

const DEFAULT_TEXT = "https://ryanjosephkamp.github.io/splashery/";
const app = () => globalThis.__splashery?.app;
const exportsJS = () => import("../exports.js");
const pausedScan = (check) => withScanPause(app()?.player, check);
const smooth = (x) => {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
};

// ---- jsQR (the vendored copy the QR code toy loads) ------------------------------------------

let jsqr = null;
export function loadJsQR() {
  if (jsqr) return Promise.resolve(jsqr);
  const pick = (m) => (typeof m === "function" ? m : m?.default);
  if (globalThis.jsQR) return Promise.resolve((jsqr = pick(globalThis.jsQR)));
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL("../../vendor/jsqr/jsQR.js", import.meta.url).href;
    s.onload = () => (pick(globalThis.jsQR) ? resolve((jsqr = pick(globalThis.jsQR))) : reject(new Error("The QR reader didn't load."))); // prettier-ignore
    s.onerror = () => reject(new Error("The QR reader didn't load."));
    document.head.appendChild(s);
  });
}
const readRGBA = (data, w, h) =>
  jsqr(data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;

// ---- Small panel helpers ----------------------------------------------------------------------

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "style") e.style.cssText = v;
    else if (k in e) e[k] = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids) if (c != null) e.append(c);
  return e;
}
function button(id, label, onClick, primary = false) {
  const b = el("button", { type: "button", id, className: primary ? "primary" : "", textContent: label }); // prettier-ignore
  b.addEventListener("click", onClick);
  return b;
}
const row = (...kids) => el("div", { className: "button-row" }, ...kids);
const note = (text, id) => el("p", { className: "note", textContent: text, ...(id ? { id } : {}) }); // prettier-ignore

async function switchTo(options, key) {
  const player = app()?.player;
  if (!player) return;
  await player.switchTo({ options, key, value: key ? 1 : 0 });
}

// The camera flat and square to the toy, the code's quiet zone in view with
// `margin` modules past it (the stage's field of view, 38 degrees, spans the
// narrower side).
function frontPose(half, margin = 1, fit) {
  const cam = app()?.player?.camera;
  if (!fit || !cam) return { yaw: 0, pitch: 0, roll: 0, distance: 3 };
  const d = ((half + margin) * fit.scale) / Math.tan((19 * Math.PI) / 180);
  return { yaw: 0, pitch: 0, roll: 0, distance: d / (cam.radius || 1) };
}

// Waits until the kit built last is on the stage (the player swaps the toy
// in after the build), then two frames.
async function onStage(kit) {
  const a = app();
  for (let i = 0; i < 200 && !(kit && a?.player?.proc?.ctx?.kit === kit); i++) await new Promise((r) => setTimeout(r, 50)); // prettier-ignore
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

// Renders the toy front on as a square canvas of `size` pixels, still.
async function renderFront(kit, half, size, margin = 1, label = "") {
  const a = app();
  await onStage(kit);
  return a.withCapture(
    [size, size],
    async () => {
      const pose = frontPose(half, margin, kit.transform);
      // A first frame starts the splat sort for this view; the second is the
      // picture (as the QR code toy does).
      await a.player.renderAt(a.player.time, pose);
      await new Promise((r) => setTimeout(r, 80));
      const shot = await a.player.renderAt(a.player.time, pose);
      const c = document.createElement("canvas");
      c.width = c.height = size;
      c.getContext("2d").drawImage(shot, 0, 0, size, size);
      return c;
    },
    { label },
  );
}
// A canvas shrunk to `w` pixels wide (smoothed, as a camera averages).
function shrink(canvas, w) {
  const c = document.createElement("canvas");
  c.width = c.height = Math.max(8, Math.round(w));
  const g = c.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingQuality = "high";
  g.drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}
const pixels = (c) => c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); // prettier-ignore

// A flat patch facing +Z: two staggered lattices of splats of spacing s over
// [x0, x1] × [y0, y1], so a patch is one even color with a hard edge.
function patch(out, x0, y0, x1, y1, z, s, color, params) {
  const nx = Math.max(1, Math.round((x1 - x0) / s));
  const ny = Math.max(1, Math.round((y1 - y0) / s));
  const sx = (x1 - x0) / nx;
  const sy = (y1 - y0) / ny;
  const sc = [0.55 * sx, 0.55 * sy, 0.01 * Math.min(sx, sy)];
  for (let layer = 0; layer < 2; layer++)
    for (let j = 0; j < ny - layer; j++)
      for (let i = 0; i < nx - layer; i++)
        out.push({ p: [x0 + (i + 0.5 + layer * 0.5) * sx, y0 + (j + 0.5 + layer * 0.5) * sy, z], scales: sc, quat: [0, 0, 0, 1], color, opacity: 1, params, pattern: false }); // prettier-ignore
}

// ======================================================================================
// Picture QR
// ======================================================================================

const PIC = {
  pictures: new Map(), // sample id (or "own") → { w, h, data }
  own: null,
  ownName: "",
  woven: null,
  options: null,
  kit: null,
  check: null,
  stage: null,
  fix: null,
  panel: null,
  tap: [0, 0],
};

// A picture's pixels, at most 640 pixels on its longer side.
async function decodePicture(blob) {
  const bmp = await createImageBitmap(blob);
  const f = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * f));
  const h = Math.max(1, Math.round(bmp.height * f));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const img = g.getImageData(0, 0, w, h).data;
  const data = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    data[i * 3] = img[i * 4] / 255;
    data[i * 3 + 1] = img[i * 4 + 1] / 255;
    data[i * 3 + 2] = img[i * 4 + 2] / 255;
  }
  return { w, h, data };
}

async function loadPicture(id) {
  if (id === "own") return PIC.own;
  if (PIC.pictures.has(id)) return PIC.pictures.get(id);
  const s = sampleById(id) || SAMPLES[0];
  const res = await fetch(new URL(`../../${s.file}`, import.meta.url));
  if (!res.ok) throw new Error(`The sample picture didn't load (${res.status}).`);
  const pic = await decodePicture(await res.blob());
  PIC.pictures.set(s.id, pic);
  return pic;
}
const pictureNow = (o) => (o.picture === "own" ? PIC.own : PIC.pictures.get(sampleById(o.picture)?.id || SAMPLES[0].id)); // prettier-ignore

// The woven code as splats. Lane QR r4: the cells are one seamless grid now
// (as the QR code toy's sheet is): a single even lattice over the whole code,
// each splat in the color of the cell it sits in, so no seam (a missing row
// of splats, where the white behind showed through) falls at a module's or a
// cell's edge. Dark splats stand a tiny constant step in front of light ones,
// so where they overlap at a cell's edge the two never tie (a tie flickered
// as the splats were sorted). The quiet zone is a plain sheet just behind,
// and a light underlay further back shows behind a tile while it turns.
// Each splat moves with its module's tile.
const LEAD = 0.004; // the dark splats' step forward (modules)
// The original picture covers the whole sticker. Its center is cropped for
// the unchanged square weave; decoration samples the same coordinates.
function circleCrop(pic, size) {
  const fraction = size / (2 * shapeHalf(size, "circle"));
  const side = Math.min(pic.w, pic.h);
  const n = Math.max(1, Math.floor(side * fraction));
  const x0 = Math.floor((pic.w - n) / 2);
  const y0 = Math.floor((pic.h - n) / 2);
  const data = new Float32Array(n * n * 3);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = ((y + y0) * pic.w + x + x0) * 3;
      data.set(pic.data.subarray(i, i + 3), (y * n + x) * 3);
    }
  return { w: n, h: n, data };
}

function circleColor(pic, half, x, y, dark, style, detail = false) {
  if (!pic || style === "bw") return dark ? FG : BG;
  const side = Math.min(pic.w, pic.h);
  const px = Math.max(
    0,
    Math.min(pic.w - 1, Math.floor((pic.w - side) / 2 + (0.5 + x / (2 * half)) * side)),
  );
  const py = Math.max(
    0,
    Math.min(pic.h - 1, Math.floor((pic.h - side) / 2 + (0.5 - y / (2 * half)) * side)),
  );
  const at = (py * pic.w + px) * 3;
  const col = Array.from(pic.data.subarray(at, at + 3));
  if (detail) return col;
  const g = gray(col);
  return dark
    ? col.map((c) => c * Math.min(1, 0.25 / Math.max(g, 0.001)))
    : col.map((c) => 1 - (1 - c) * Math.min(1, 0.2 / Math.max(1 - g, 0.001)));
}

function pictureSplats(w, budget, shape = "square", pic = null, options = {}) {
  const N = w.code.size;
  let { k, G, cells } = w;
  const border = borderSettings(options);
  const H = shapeHalf(N, shape, border.quiet);
  const simpleFallback = options.simpleFallback === true && w.style === "bw";
  const tiles = (w.fidelity === "detail" || simpleFallback) && detailSettings().texture === "tiles";
  if (simpleFallback && tiles) w.rendering ||= {};
  if (w.rendering) w.rendering.texture = tiles ? "tiles" : "splats";
  const make = (fine, layers = 2, plain = false) => {
    const out = [];
    const M = Math.round(G * fine);
    const coarse = fine < 1;
    const encodedCount = tiles ? N * N : coarse ? M * M : M * M + (layers - 1) * (M - 1) * (M - 1);
    // The underlay, well behind (a turning tile swings through z < 0).
    if (shape !== "circle")
      patch(out, -H, -H, H, H, -0.6, w.fidelity === "detail" || plain ? 1.2 : 0.34, BG, [0, 0]);
    // The quiet zone: a sheet just behind the code, around it.
    const qs = w.fidelity === "detail" ? 0.65 : plain || coarse ? 0.8 : 0.34;
    const n = Math.round((2 * H) / qs);
    const st = (2 * H) / n;
    const sc0 = [0.6 * st, 0.6 * st, 0.004];
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = -H + (i + 0.5) * st;
        const y = -H + (j + 0.5) * st;
        if (
          shape === "circle" &&
          (Math.hypot(x, y) > H - 0.7 || Math.max(Math.abs(x), Math.abs(y)) > N / 2 + border.quiet)
        )
          continue;
        if (Math.abs(x) < N / 2 - 0.3 && Math.abs(y) < N / 2 - 0.3) continue;
        out.push({ p: [x, y, -0.02], scales: sc0, quat: [0, 0, 0, 1], color: BG, opacity: 1, params: [0, 0], pattern: false }); // prettier-ignore
      }
    if (shape === "circle") {
      const scale = coarse ? 3.2 : Math.min(1.6, Math.max(0.8, 2 / fine));
      let decoration;
      for (let attempt = 0; attempt < 10; attempt++) {
        decoration = circleSplats(w.code, {
          quiet: border.quiet,
          fg: w.fidelity === "detail" ? BG : FG,
          bg: BG,
          dots: w.fidelity !== "detail" && !coarse,
          scale: plain ? 3 + attempt : scale,
          coarse: plain || attempt > 0,
          sheetSpacing: plain
            ? 3.4
            : attempt
              ? 0.7 + 0.3 * attempt
              : w.fidelity === "detail"
                ? 0.65
                : 0.45,
          colorAt: (x, y, dark) => {
            if (w.fidelity === "detail") return circleColor(pic, H, x, y, dark, w.style, true);
            const color = decorationColor(
              pic,
              { ...options, shape, quiet: border.quiet },
              N,
              x,
              y,
              dark,
              w.style,
            );
            return border.pale ? fitDecoration(color, N, x, y, border.quiet) : color;
          },
          lightColorAt: (x, y) => {
            if (w.fidelity === "detail") return circleColor(pic, H, x, y, false, w.style, true);
            const color = decorationColor(
              pic,
              { ...options, shape, quiet: border.quiet },
              N,
              x,
              y,
              false,
              w.style,
            );
            return border.pale ? fitDecoration(color, N, x, y, border.quiet) : color;
          },
        });
        if (out.length + decoration.splats.length + encodedCount <= budget) break;
      }
      appendSplats(out, decoration.splats);
    }
    if (tiles) {
      for (let row = 0; row < N; row++)
        for (let col = 0; col < N; col++) {
          const m = row * N + col;
          out.push({ p: [col - N / 2 + 0.5, N / 2 - row - 0.5, 0], scales: [0.26, 0.26, 0.004], quat: [0, 0, 0, 1], color: BG, opacity: 1, photo: true, params: [1 + m, w.code.dark[m] ? 2 : 1], pattern: false }); // prettier-ignore
        }
      return out;
    }
    // The code: one lattice of `fine` splats a cell each way, two staggered
    // layers (the second fills the low spots between the first's points).
    const s0 = N / M;
    const sc = [0.55 * s0, 0.55 * s0, 0.004];
    // Dark splats a little tighter: their soft edges lie in front of the
    // light cells next to them, and at the full size every dark dot grew.
    const scd = [0.48 * s0, 0.48 * s0, 0.004];
    const at = (px, py) => {
      const cx = Math.max(0, Math.min(G - 1, Math.floor((px + N / 2) * k)));
      const cy = Math.max(0, Math.min(G - 1, Math.floor((N / 2 - py) * k)));
      const q = (cy * G + cx) * 3;
      return { cx, cy, col: [cells[q], cells[q + 1], cells[q + 2]] };
    };
    for (let layer = 0; layer < (coarse ? 1 : layers); layer++)
      for (let j = 0; j < M - layer; j++)
        for (let i = 0; i < M - layer; i++) {
          const x = -N / 2 + (i + 0.5 + layer * 0.5) * s0;
          const y = N / 2 - (j + 0.5 + layer * 0.5) * s0;
          const point = at(x, y),
            { cx, cy } = point;
          const m = Math.floor(cy / k) * N + Math.floor(cx / k);
          let { col } = point;
          // A dark splat in front sits wholly inside dark cells (one on a
          // cell's edge would paint dark over the light cell next to it, and
          // every dark dot would grow): on an edge with a light cell, the
          // splat takes the light cell's color.
          if (!coarse && gray(col) < 0.5)
            for (const [dx, dy] of [
              [-1, -1],
              [1, -1],
              [-1, 1],
              [1, 1],
            ]) {
              // prettier-ignore
              const n = at(x + dx * 0.45 * s0, y + dy * 0.45 * s0).col;
              if (gray(n) >= 0.5) {
                col = n;
                break;
              }
            }
          const dk = gray(col) < 0.5;
          out.push({ p: [x, y, dk ? LEAD : 0], scales: dk ? scd : sc, quat: [0, 0, 0, 1], color: col, opacity: 1, params: [1 + m, w.code.dark[m] ? 2 : 1], pattern: false }); // prettier-ignore
        }
    return out;
  };
  let splats = null;
  if (simpleFallback) {
    // An explicitly saved long-code fallback keeps every encoded module.
    // Existing Standard scenes never enable this tier.
    cells = new Float32Array(N * N * 3);
    for (let m = 0; m < N * N; m++) cells.set(w.code.dark[m] ? FG : BG, m * 3);
    k = 1;
    G = N;
    splats = make(2, 1, true);
  }
  for (const fine of simpleFallback ? [] : tiles ? [1] : [3, 2, 1]) {
    const M = Math.round(G * fine);
    if (
      !tiles &&
      (shape === "circle" || fine > 1) &&
      (fine < 1 ? M * M : M * M + (M - 1) * (M - 1)) > budget
    )
      continue;
    splats = make(fine);
    if (splats.length <= budget) break;
  }
  if (
    shape === "circle" &&
    (!splats || splats.length > budget) &&
    !pic &&
    (!w.eyeShape || w.eyeShape === "square")
  ) {
    // Main's no-picture fallback coalesces identical cells without changing bits.
    cells = new Float32Array(N * N * 3);
    for (let m = 0; m < N * N; m++) cells.set(w.code.dark[m] ? FG : BG, m * 3);
    k = 1;
    G = N;
    splats = make(1, 2, true);
    if (splats.length > budget) splats = make(1, 1, true);
  }
  if ((shape === "circle" || simpleFallback) && (!splats || splats.length > budget)) {
    if (!simpleFallback) {
      const reduced = compactPicture(w, budget, H, shape, pic, options);
      if (reduced) return { splats: reduced, half: H, reduced: true };
    }
    throw new Error(
      "This code has too much detail for a circular picture on this device. Choose less detail, a smaller center dot, or a shorter text.",
    );
  }
  return { splats, half: H };
}

// The small-budget Circle tier keeps every encoded module. A module carries its
// forced center's tint instead of a full halftone; decoration stays complete.
function compactPicture(w, budget, H, shape, pic, options) {
  const N = w.code.size;
  const border = borderSettings(options);
  const layout = shape === "circle" ? circleLayout(w.code, border.quiet) : null;
  const dots = layout?.dots || [];
  const eyes = [];
  const eyeParams = (p) => [1 + (p.row + 3) * N + p.col + 3, 2];
  if (w.eyeShape === "rounded") {
    const { crisp } = painter(eyes, { scale: 4, sp: 0.5 });
    paintEyes(w.code, "rounded", crisp, () => FG, eyeParams, 0.06);
  } else {
    for (const p of w.code.pieces) {
      if (p.kind !== "finder") continue;
      const x = p.col - N / 2;
      const y = N / 2 - p.row;
      for (const [x0, y0, x1, y1] of [
        [x, y - 1, x + 7, y],
        [x, y - 7, x + 7, y - 6],
        [x, y - 6, x + 1, y - 1],
        [x + 6, y - 6, x + 7, y - 1],
        [x + 2, y - 5, x + 5, y - 2],
      ])
        patch(eyes, x0, y0, x1, y1, 0.06, 0.5, FG, eyeParams(p));
    }
  }
  const spare = Math.floor(budget - N * N - dots.length - eyes.length);
  if (spare < 128) return null;
  const out = [];
  const push = (x, y, z, scales, color, params = [0, 0], quat = [0, 0, 0, 1]) =>
    out.push({ p: [x, y, z], scales, quat, color, params, opacity: 1, pattern: false });
  const ring = layout ? Math.min(Math.ceil((2 * Math.PI * H) / 0.65), Math.floor(spare * 0.2)) : 0;
  const n = Math.max(1, Math.floor(Math.sqrt(spare - ring)));
  const step = (2 * H) / n;
  const decor = (x, y, dark) => {
    const color = decorationColor(
      pic,
      { ...options, shape, quiet: border.quiet },
      N,
      x,
      y,
      dark,
      w.style,
    );
    return border.pale ? fitDecoration(color, N, x, y, border.quiet) : color;
  };
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = -H + (i + 0.5) * step;
      const y = -H + (j + 0.5) * step;
      if (layout && Math.hypot(x, y) > H - 0.2) continue;
      const color =
        layout && Math.max(Math.abs(x), Math.abs(y)) >= N / 2 + border.quiet
          ? decor(x, y, false)
          : BG;
      push(x, y, -0.05, [0.62 * step, 0.62 * step, 0.004], color);
    }
  for (const d of dots) push(d.x, d.y, 0.14, [0.27, 0.27, 0.004], decor(d.x, d.y, true));
  for (let i = 0; i < ring; i++) {
    const a = (i * 2 * Math.PI) / ring;
    const angle = a + Math.PI / 2;
    push(
      (H - 0.325) * Math.cos(a),
      (H - 0.325) * Math.sin(a),
      0.14,
      [(0.6 * 2 * Math.PI * H) / ring, 0.18, 0.004],
      FG,
      [0, 0],
      [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)],
    );
  }
  const center = Math.floor(w.k / 2);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const q = ((r * w.k + center) * w.G + c * w.k + center) * 3;
      const piece = w.code.pieces[w.code.piece[r * N + c]];
      const color = piece?.kind === "finder" ? BG : Array.from(w.cells.subarray(q, q + 3));
      const dark = gray(color) < 0.5;
      push(
        c - N / 2 + 0.5,
        N / 2 - r - 0.5,
        dark ? LEAD : 0,
        [dark ? 0.48 : 0.55, dark ? 0.48 : 0.55, 0.004],
        color,
        [1 + r * N + c, w.code.dark[r * N + c] ? 2 : 1],
      );
    }
  appendSplats(out, eyes);
  return out.length <= budget ? out : null;
}

const optionsKey = (given) => {
  const o = pictureFitOptions(given || {});
  return (
    JSON.stringify(tidy(o)) +
    (o?.picture ?? "") +
    (o?.shape || "square") +
    JSON.stringify(cropSettings(o)) +
    JSON.stringify(borderSettings(o)) +
    (o?.eyeShape || "style") +
    (o?.simpleFallback ? "/simple" : "")
  );
};
const DETAIL_BUDGET_MS = 20000;
const DETAIL_MAX_VERSION = 13;
const DETAIL_TIMEOUT_NOTICE = "Most detail took too long. Using Standard.";

function cancelDetailAttempt(attempt) {
  if (!attempt || attempt.canceled || attempt.finished) return;
  attempt.canceled = true;
  clearTimeout(attempt.timer);
  if (PIC.detailAttempt === attempt) cancelDetailChecks();
  attempt.reject(new DOMException("The detail request was canceled.", "AbortError"));
}
function beginDetailAttempt(options, generation) {
  const key = optionsKey(options),
    previous = PIC.detailAttempt;
  if (previous?.key === key && !previous.canceled && !previous.finished) {
    previous.generation = generation;
    return previous;
  }
  cancelDetailAttempt(previous);
  PIC.notice = "";
  PIC.fallback = null;
  let reject;
  const canceled = new Promise((_resolve, fail) => {
    reject = fail;
  });
  canceled.catch(() => {});
  const override = Number(globalThis.__splashery?.qrCraft?.detailBudgetMs);
  const milliseconds =
    Number.isFinite(override) && override > 0
      ? Math.max(100, Math.min(DETAIL_BUDGET_MS, override))
      : DETAIL_BUDGET_MS;
  const attempt = {
    key,
    options: { ...options },
    generation,
    reject,
    canceled: false,
    finished: false,
    started: performance.now(),
    run: (work) => Promise.race([Promise.resolve().then(work), canceled]),
    finish() {
      this.finished = true;
      clearTimeout(this.timer);
    },
  };
  PIC.detailAttempt = attempt;
  attempt.timer = setTimeout(() => {
    fallbackToStandard(attempt, DETAIL_TIMEOUT_NOTICE).catch(() => {});
  }, milliseconds);
  return attempt;
}
async function fallbackToStandard(attempt, notice) {
  if (attempt?.fallback) return attempt.fallback;
  const player = app()?.player;
  if (!attempt) return;
  if (player && player.loadToken !== attempt.generation) {
    cancelDetailAttempt(attempt);
    return;
  }
  cancelDetailAttempt(attempt);
  PIC.notice = notice;
  PIC.fallback = {
    notice,
    text: attempt.options.text,
    shape: attempt.options.shape,
    elapsedMs: performance.now() - attempt.started,
  };
  PIC.panel?.refresh();
  const options = { ...attempt.options, fidelity: "standard" };
  attempt.fallback = (async () => {
    await switchTo(options);
    // Standard can itself exceed a device's circular-picture geometry budget.
    // Do not leave an old payload or an unfinished detail code labeled as this one.
    if (
      PIC.detailAttempt === attempt &&
      optionsKey(player?.scene?.toy?.options) === optionsKey(options) &&
      optionsKey(PIC.options) !== optionsKey(options)
    ) {
      PIC.error =
        "Standard could not build this code on this device. Try Square or a shorter text.";
      PIC.options = options;
      PIC.woven = null;
      PIC.check = null;
      PIC.checking = false;
      player.stage.clearToy();
      release();
      PIC.panel?.refresh();
    }
  })();
  return attempt.fallback;
}
function detailVersion(options) {
  const smallest = encodeQR(options.text, options.level, { boost: false }).version;
  return Math.min(40, smallest + SIZES_UP.find((size) => size.id === options.size).up);
}

// Study overrides stay on the test hook; saved scenes store only the owner's options.
function detailSettings(rejected = null, picture = null, shape = "square") {
  const study = globalThis.__splashery?.qrCraft || {};
  return {
    texture: study.photoTiles !== false ? "tiles" : "splats",
    detailUp: study.detailUp || 0,
    textureBlur: study.textureBlur || 0,
    textureGuard: study.textureGuard || 0,
    preferContinuous: study.preferContinuous !== false,
    preferCorrection: study.preferCorrection !== false,
    errorFraction: Number.isFinite(study.detailErrorFraction)
      ? Math.max(0, Math.min(0.6, study.detailErrorFraction))
      : detailFraction(picture, shape),
    // A failed stage view gets the full forecast before another expensive rebuild.
    captureValidation: study.captureValidation !== false && !rejected?.length,
    channel: study.detailChannel || "weighted",
    finderGuard: Number.isFinite(study.finderGuard)
      ? Math.max(0, Math.min(3, Math.round(study.finderGuard)))
      : 3,
    trace: study.trace === true,
  };
}

// Reads the woven layout at phone size and smaller (picture.js), then the
// stage's own picture.
// Lane QR r4 (the owner's note of October 9, 2026): the code is scanned
// before it is shown. From the build until its check is done, a still of the
// stage stays up with "Please wait. Scanning code…" on it (Stage.cover);
// Most detail has a bounded preparation/repair budget and falls back to Standard.
// Both modes retain a thirty-second scanning-cover watchdog.
const SCANNING = "Please wait. Scanning code…";
function guardDetail() {
  const player = app()?.player;
  if (player?.toyInfo?.id === "qr-picture" && PIC.woven?.fidelity === "detail") {
    fallbackToStandard(PIC.detailAttempt, DETAIL_TIMEOUT_NOTICE).catch(() => {});
    // Never uncover an unfinished Most detail render while Standard rebuilds.
    player.stage.clearToy();
    PIC.woven = null;
    PIC.checking = false;
  }
  if (player?.toyInfo?.id === "qr-picture" && PIC.woven?.fidelity !== "detail" && !PIC.noAuto)
    blockPicture("Still checking. Adjust the crop or try more contrast.");
  else release();
}
function blockPicture(message) {
  clearTimeout(PIC.holdTimer);
  if (PIC.holding) {
    PIC.holding.coverLabel = message;
    PIC.holding.labelCover();
  }
}
const coverPlayers = new WeakSet();
function hold() {
  const player = app()?.player,
    stage = player?.stage;
  if (typeof window === "undefined" || PIC.noAuto || !stage?.cover) return;
  const key = optionsKey({ ...PIC.options, fidelity: "standard" });
  if (PIC.holding && PIC.holdKey === key) return;
  if (!PIC.holding) {
    if (!coverPlayers.has(player) && player.on) {
      coverPlayers.add(player);
      player.on("toy", (info) => {
        if (PIC.holding === stage && info.id !== "qr-picture") release();
      });
    }
    PIC.holding = stage;
    stage.cover({ label: SCANNING });
  }
  PIC.holdKey = key;
  clearTimeout(PIC.holdTimer);
  PIC.holdTimer = setTimeout(guardDetail, 30000);
}
function release() {
  clearTimeout(PIC.holdTimer);
  const stage = PIC.holding;
  PIC.holding = null;
  stage?.uncover();
}

async function checkPicture() {
  clearTimeout(checkTimer);
  const player = app()?.player;
  // A previous build's timer can fire during the next async prepare, before
  // PIC.woven is replaced. It must not adopt the new build's load token.
  if (player && PIC.buildGeneration !== player.loadToken) return PIC.check;
  while (PIC.running) {
    const { promise, kit } = PIC.running;
    const checked = await promise;
    if (kit === PIC.kit) return checked;
  }
  const kit = PIC.kit;
  const promise = (async () => {
    const attempt = PIC.woven?.fidelity === "detail" ? PIC.detailAttempt : null;
    try {
      return await (attempt
        ? attempt.run(() => withScanTail(player, () => checkPictureNow()))
        : checkPictureNow());
    } catch (error) {
      if (error.name === "AbortError") return PIC.check;
      throw error;
    }
  })().finally(() => {
    if (PIC.running?.promise === promise) PIC.running = null;
  });
  PIC.running = { kit, promise };
  return promise;
}

async function checkPictureNow() {
  const w = PIC.woven,
    player = app()?.player,
    generation = player?.loadToken,
    attempt = w?.fidelity === "detail" ? PIC.detailAttempt : null,
    isCurrent = () => (!player || player.loadToken === generation) && !attempt?.canceled;
  if (!w) return null;
  const kit = PIC.kit;
  PIC.checking = true;
  let layout;
  try {
    await loadJsQR();
    if (!isCurrent()) return PIC.check;
    layout = checkWoven(w, readRGBA);
    PIC.check = {
      ...layout,
      ok: layout.ok && w.detailCheck?.ok !== false,
      detail: w.detailCheck,
      measure: measure(w),
      stage: null,
      text: w.code.text,
    };
    PIC.panel?.refresh();
  } catch (error) {
    if (!isCurrent()) return PIC.check;
    PIC.check = {
      ok: false,
      sizes: [],
      stage: null,
      text: w.code.text,
      measure: measure(w),
      error: "The scan check couldn't finish. Try making the code again.",
      stageError: error.message,
    };
    if (attempt) {
      await fallbackToStandard(
        attempt,
        "Most detail could not finish its scan check. Using Standard.",
      );
      return PIC.check;
    }
    PIC.checking = false;
    release();
    PIC.panel?.refresh();
    return PIC.check;
  }
  // The stage: the splats as drawn, front on, read at phone size and smaller.
  try {
    const half = shapeHalf(w.code, PIC.options?.shape, borderSettings(PIC.options).quiet);
    const big = await renderFront(kit, half, 720, 1, SCANNING);
    // A newer build's own check takes over (and lifts the still).
    if (!isCurrent() || kit !== PIC.kit) return PIC.check;
    const total = 2 * (half + 1); // the picture spans the margin too
    const at = (ppm) => {
      const img = pixels(shrink(big, total * ppm));
      return readRGBA(img.data, img.width, img.height);
    };
    PIC.lastShot = big;
    const want = w.code.text;
    PIC.check.stage = [8, 4].map((ppm) => {
      const text = at(ppm);
      return { ppm, text, ok: text === want };
    });
    if (w.fidelity === "detail") {
      const stress = await pausedScan(() =>
        validateCapture(pixels(big), total, want, readRGBA, w.rendering?.texture === "tiles"),
      );
      if (!isCurrent() || kit !== PIC.kit) return PIC.check;
      PIC.check.stress = stress;
      PIC.check.ok = PIC.check.ok && PIC.check.stage.every((s) => s.ok) && PIC.check.stress.ok;
    }
    // Lane QR r4: when the layout reads but the stage doesn't, the nudge
    // steps up (a rebuild) until it does, three steps at most.
    if (
      layout.ok &&
      w.detailCheck?.ok !== false &&
      (!PIC.check.stage.every((s) => s.ok) || PIC.check.stress?.ok === false) &&
      (PIC.extra || 0) < 0.12 &&
      !PIC.noAuto
    ) {
      const key = optionsKey(PIC.options);
      const rejectedCount = PIC.rejected?.key === key ? PIC.rejected.methods.length : 0;
      // Give all six finder tones a chance before increasing picture contrast.
      if (w.fidelity === "detail" && rejectedCount < 6) {
        if (PIC.rejected?.key !== key) PIC.rejected = { key, methods: [] };
        const rejected = renderingKey(w);
        if (!PIC.rejected.methods.includes(rejected)) PIC.rejected.methods.push(rejected);
      } else PIC.extra = (PIC.extra || 0) + 0.04;
      PIC.extraFor = key;
      // The still stays up through the rebuild; its check lifts it.
      app()?.player?.switchTo({ options: { ...PIC.options } });
      PIC.panel?.refresh();
      return PIC.check;
    }
  } catch (err) {
    if (!isCurrent()) return PIC.check;
    PIC.check.stageError = err.message;
    if (w.fidelity === "detail") PIC.check.ok = false;
  }
  if (w.fidelity === "detail" && !PIC.check?.ok) {
    await fallbackToStandard(
      attempt,
      "Most detail could not keep this code readable. Using Standard.",
    );
    return PIC.check;
  }
  attempt?.finish();
  PIC.checking = false;
  const passed =
    PIC.check?.ok && PIC.check.stage?.length === 2 && PIC.check.stage.every((s) => s.ok);
  if (!PIC.noAuto && !passed)
    blockPicture("This code did not scan. Adjust the crop or try more contrast.");
  else release();
  PIC.panel?.refresh();
  return PIC.check;
}
let checkTimer = 0;
function scheduleCheck(ms = 500) {
  clearTimeout(checkTimer);
  if (PIC.noAuto) return release();
  checkTimer = setTimeout(() => {
    const a = app();
    if (a?.player?.toyInfo?.id !== "qr-picture") return release();
    if (a.busy) return scheduleCheck(PIC.options?.fidelity === "detail" ? 16 : 300);
    checkPicture();
  }, ms);
}

// The closest version that scans (more contrast, a bigger center dot, a
// higher level), applied.
async function makeItScan() {
  const player = app()?.player,
    generation = player?.loadToken;
  if (player && PIC.buildGeneration !== generation) return null;
  const attempt =
    PIC.options?.fidelity === "detail" ? beginDetailAttempt(PIC.options, generation) : null;
  const isCurrent = () => (!player || player.loadToken === generation) && !attempt?.canceled;
  const pic = pictureNow(PIC.options || {});
  await loadJsQR();
  if (!isCurrent()) return null;
  const input =
    pic && PIC.woven && PIC.options?.fidelity !== "detail"
      ? codePicture(
          pic,
          { ...PIC.options, quiet: borderSettings(PIC.options).quiet },
          PIC.woven.code.size,
        )
      : pic;
  const options = { ...PIC.options },
    key = optionsKey(options),
    extra = PIC.extraFor === key ? PIC.extra || 0 : 0,
    rejected = PIC.rejected?.key === key ? [...PIC.rejected.methods] : [];
  let found;
  try {
    found =
      options.fidelity === "detail"
        ? await pausedScan(() =>
            attempt.run(() =>
              closestScanningAsync(
                input,
                { ...options, ...detailSettings(rejected, pic, options.shape), extra, rejected },
                readRGBA,
                (w, p, shape) => validateDetail(w, p, shape, readRGBA),
                { isCurrent },
              ),
            ),
          )
        : closestScanning(input, options, readRGBA);
  } catch (error) {
    if (error.name === "AbortError") return null;
    throw error;
  }
  if (!isCurrent()) return null;
  if (found && options.fidelity === "detail") {
    const nextKey = optionsKey({ ...options, ...found.options });
    PIC.extra = extra;
    PIC.extraFor = nextKey;
    PIC.rejected = { key: nextKey, methods: rejected };
    PIC.fix = null;
    PIC.panel?.refresh();
    // Rebuild even when the public options stayed the same: the selected
    // rendering method may have changed. Its real stage check gives the verdict.
    await switchTo(found.options);
    return { changed: found.changed, options: found.options };
  }
  attempt?.finish();
  PIC.fix = found ? { changed: found.changed, options: found.options } : { none: true };
  PIC.panel?.refresh();
  if (found && found.changed.length) {
    const { contrast, center, level } = found.options;
    await switchTo({ contrast, center, level });
  }
  const checked = found ? await checkPicture() : null;
  PIC.fix =
    checked?.ok && checked.stage?.every((s) => s.ok)
      ? { changed: found.changed, options: found.options }
      : { none: true };
  PIC.panel?.refresh();
  return PIC.fix;
}

function canSavePicture() {
  const w = PIC.woven;
  if (!w) return false;
  if (w.fidelity !== "detail")
    return (
      PIC.noAuto ||
      (PIC.check?.ok === true &&
        PIC.check.stage?.length === 2 &&
        PIC.check.stage.every((s) => s.ok))
    );
  const check = PIC.check;
  return (
    !PIC.checking &&
    PIC.buildGeneration === app()?.player?.loadToken &&
    check?.ok === true &&
    check.stress?.ok === true &&
    check.text === w.code.text
  );
}

async function savePNG(size = 1600) {
  const a = app();
  const w = PIC.woven;
  if (!a || !w || !canSavePicture()) return null;
  const generation = a.player.loadToken;
  if (!PIC.noAuto) {
    const checked =
      PIC.check?.ok && PIC.check.stage?.every((s) => s.ok) ? PIC.check : await checkPicture();
    if (!checked?.ok || !checked.stage?.every((s) => s.ok)) {
      a.ui?.toast?.("Adjust the crop or try more contrast before saving.");
      return null;
    }
  }

  return a.withBusy("Making the picture…", async () => {
    const { canvasToBlob, downloadBlob, timestampName } = await exportsJS();
    const canvas = await renderFront(
      PIC.kit,
      shapeHalf(w.code, PIC.options?.shape, borderSettings(PIC.options).quiet),
      size,
      0,
    );
    if (w.fidelity === "detail" && (PIC.woven !== w || a.player.loadToken !== generation))
      return null;
    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, timestampName("png", "splashery-picture-qr"));
    a.ui?.toast?.("Picture saved, with its quiet zone.");
    return blob;
  });
}

function picturePanel() {
  const box = el("div", { className: "qrc-picture" });
  const input = el("input", { type: "text", id: "qrc-text", maxLength: 300, style: "width:100%;box-sizing:border-box" }); // prettier-ignore
  input.setAttribute("aria-label", "What the code holds");
  const make = button("qrc-make", "Make the code", () => switchTo({ text: input.value }), true);
  const scan = button("qrc-scan", "Make it scan", () => makeItScan());
  const originalDetail = button(
    "qrc-original-detail",
    "Use Original settings for Most detail",
    () =>
      switchTo({
        pictureFit: "legacy",
        cropX: 0.5,
        cropY: 0.5,
        cropZoom: 1,
        circleBorder: "legacy",
        eyeShape: "style",
        fidelity: "detail",
        style: "color",
        simpleFallback: false,
      }),
  );
  const png = button("qrc-png", "Save a PNG", () => savePNG());
  const crop = cropPanel({
    picture: () => pictureNow(PIC.options || {}),
    options: () => ({ ...PIC.options, quiet: borderSettings(PIC.options).quiet }),
    size: () => PIC.woven?.code.size || 29,
    apply: (o) => switchTo(o),
  });
  const fit = fitControls({
    options: () => PIC.options || {},
    apply: (o) => switchTo(o),
    picture: true,
  });
  const out = el("div", { id: "qrc-check", role: "status", style: "margin:8px 0" });
  box.append(
    el("label", { htmlFor: input.id, textContent: "What the code holds" }),
    input,
    row(make, png),
    crop.element,
    fit.element,
    out,
    row(scan),
    originalDetail,
    note("Each module's middle keeps its bit, dark or light, because a camera reads every module at its center. The rest of the module carries the picture as a halftone: small dark and light dots that average out to the picture's tones. Where a module would read wrong, a few of its dots take its color; the contrast sets how clearly every module reads. The eyes, the timing lines, and the format information stay plain. Your picture is read on this device and never leaves it."), // prettier-ignore
  );
  PIC.panel = {
    refresh() {
      const o = PIC.options || {};
      originalDetail.hidden = detailOptionsSupported(o);
      crop.refresh();
      fit.refresh();
      if (document.activeElement !== input) input.value = o.text ?? DEFAULT_TEXT;
      out.replaceChildren();
      const ck = PIC.check;
      const w = PIC.woven;
      if (PIC.notice) out.append(note(PIC.notice, "qrc-fallback"));
      if (w) out.append(el("p", { style: "margin:2px 0", textContent: `Version ${w.code.version} (${w.code.size} × ${w.code.size} modules), error correction ${w.code.ecc}.` })); // prettier-ignore
      if (w?.fidelity === "detail") out.append(note("Most detail fits the code to your picture, keeping more of its color and shape. The code is checked before it appears.")); // prettier-ignore
      if (PIC.error) out.append(el("p", { style: "margin:2px 0;color:#b3261e", textContent: PIC.error })); // prettier-ignore
      if (!ck) {
        if (!PIC.error)
          out.append(el("p", { style: "margin:2px 0", textContent: "Checking that it scans…" }));
      } else {
        const m = ck.measure;
        out.append(el("p", { id: "qrc-contrast", style: "margin:2px 0", textContent: `Contrast: ${m.module.toFixed(1)} : 1 between whole dark and light modules (the center dots ${m.center.toFixed(1)} : 1).` })); // prettier-ignore
        for (const s of ck.sizes) out.append(el("p", { style: "margin:2px 0", textContent: `${s.ok ? "✓" : "✗"} Reads at ${s.label} (${s.ppm} pixels a module, a little out of focus).` })); // prettier-ignore
        if (ck.stage) for (const s of ck.stage) out.append(el("p", { style: "margin:2px 0", textContent: `${s.ok ? "✓" : "✗"} The splats on the stage read at ${s.ppm} pixels a module.` })); // prettier-ignore
        const all = ck.ok && (!ck.stage || ck.stage.every((s) => s.ok));
        out.append(el("p", { id: "qrc-verdict", style: "margin:4px 0;font-weight:600", textContent: ck.error || (all ? "It scans." : "This one may not scan: the picture is crowding out the code. Tap Make it scan for the closest version that does.") })); // prettier-ignore
      }
      const f = PIC.fix;
      if (f) out.append(el("p", { className: "note", id: "qrc-fix", textContent: f.none ? "No version close to this one scans. Try a plainer picture or a shorter text." : f.changed.length ? `Changed so it scans: ${f.changed.join(", ")}.` : "It already scans as it is." })); // prettier-ignore
      scan.disabled = !ck || (ck.ok && (!ck.stage || ck.stage.every((s) => s.ok)));
      png.disabled = !canSavePicture();
    },
  };
  PIC.panel.refresh();
  return box;
}

const PICTURE = {
  // Lane QR r4: redrawn only while the tiles turn (always, the splats were
  // sorted again every frame, and the white sheet's corners flickered).
  alive: (c) => c.turn > 0,
  turntable: false,
  kernel: "sharp",
  density: 2,
  options: [
    { key: "text", label: "Text", type: "text", default: DEFAULT_TEXT, hidden: true },
    { key: "shape", label: "Shape", type: "select", default: "square", choices: shapeChoices },
    ...FIT_OPTIONS,
    {
      key: "pictureFit",
      label: "Picture fit",
      type: "select",
      hidden: true,
      default: "legacy",
      choices: [
        { id: "legacy", label: "Original crop" },
        { id: "code", label: "Fit the square code" },
        { id: "circle", label: "Fill the whole circle" },
      ],
    },
    {
      key: "cropX",
      label: "Crop horizontal position",
      type: "slider",
      hidden: true,
      min: 0,
      max: 1,
      default: 0.5,
    },
    {
      key: "cropY",
      label: "Crop vertical position",
      type: "slider",
      hidden: true,
      min: 0,
      max: 1,
      default: 0.5,
    },
    {
      key: "cropZoom",
      label: "Crop zoom",
      type: "slider",
      hidden: true,
      min: 1,
      max: 4,
      default: 1,
    },
    { key: "picture", label: "Picture", type: "select", default: SAMPLES[0].id, choices: [...SAMPLES.map((s) => ({ id: s.id, label: s.label, group: s.group })), { id: "own", label: "Your own picture" }] }, // prettier-ignore
    { key: "fidelity", label: "Picture detail", type: "select", default: "standard", choices: [{ id: "standard", label: "Standard" }, { id: "detail", label: "Most detail (color)" }] }, // prettier-ignore
    { key: "simpleFallback", label: "Simple Standard code", type: "switch", default: false, hidden: true }, // prettier-ignore
    { key: "contrast", label: "Contrast", type: "slider", min: 0, max: 1, step: 0.05, default: 0.5 }, // prettier-ignore
    { key: "center", label: "Center dot", type: "select", default: "small", choices: CENTERS.map((c) => ({ id: c.id, label: c.label })) }, // prettier-ignore
    { key: "level", label: "Error correction", type: "select", default: "H", choices: LEVELS.map((l) => ({ id: l, label: { L: "L: 7% can be lost", M: "M: 15%", Q: "Q: 25%", H: "H: 30%" }[l] })) }, // prettier-ignore
    { key: "style", label: "Picture style", type: "select", default: "color", choices: PIC_STYLES.map((s) => ({ id: s.id, label: s.label })) }, // prettier-ignore
    { key: "size", label: "Code size", type: "select", default: "more", choices: SIZES_UP.map((s) => ({ id: s.id, label: s.label })) }, // prettier-ignore
  ],
  controls: [{ key: "turn", label: "Send a ripple", type: "pulse", ease: 3.6 }],
  action: {
    key: "turn",
    label: "Send a ripple",
    at(point) {
      const fit = PIC.kit?.transform;
      // The tap point in code units (the wave starts there).
      if (point && fit) PIC.tap = [point[0], point[1]];
      else PIC.tap = [0, 0];
      return "turn";
    },
  },
  sounds: () => [],
  input: {
    title: "Picture QR",
    accept: "image/png,image/jpeg,image/webp,image/avif,image/gif",
    binary: true,
    fileButton: "Open your own picture…",
    live: [{ render: picturePanel }],
    note: "Your picture is read on this device and never leaves it. A saved scene or link keeps only the crop settings; open the picture again to restore it.",
    async read(_text, fileName, file) {
      if (!file) throw new Error("Open a picture.");
      const savedCrop =
        PIC.options?.picture === "own" && !PIC.own
          ? cropSettings(PIC.options)
          : {
              pictureFit: PIC.options?.shape === "circle" ? "circle" : "code",
              cropX: 0.5,
              cropY: 0.5,
              cropZoom: 1,
            };
      PIC.own = await decodePicture(file);
      PIC.extra = 0;
      PIC.rejected = null;
      PIC.ownName = fileName || "your picture";
      return {
        picture: "own",
        ...savedCrop,
      };
    },
    shown: () => (PIC.options?.picture === "own" ? PIC.ownName : sampleById(PIC.options?.picture)?.label || ""), // prettier-ignore
  },
  splatLimit(o, budget) {
    const prepared = PIC.prepared,
      t = tidy(o);
    if (
      t.fidelity !== "detail" ||
      prepared?.woven.rendering?.texture !== "tiles" ||
      prepared.key !== optionsKey({ ...o, ...t }) ||
      prepared.pic !== pictureNow(o)
    )
      return budget;
    prepared.geometry = pictureSplats(prepared.woven, budget, o.shape, prepared.pic);
    return Math.min(budget, prepared.geometry.splats.length);
  },
  async prepare(o) {
    const requestedOptions = o;
    o = pictureFitOptions(o);
    const player = app()?.player,
      generation = player?.loadToken;
    let attempt = null;
    const isCurrent = () => (!player || player.loadToken === generation) && !attempt?.canceled;
    PIC.prepared = null;
    if (o.picture === "own" && !PIC.own) return;
    if (typeof document === "undefined") return;
    const requested = tidy({ ...o, text: o.text ?? DEFAULT_TEXT });
    if (requested.fidelity === "detail") {
      attempt = beginDetailAttempt({ ...requestedOptions, ...requested }, generation);
      if (!detailOptionsSupported(o)) {
        await fallbackToStandard(
          attempt,
          "Most detail needs the Original crop, Original border, and Original eyes. Using Standard.",
        );
        return;
      }
      if (detailVersion(requested) > DETAIL_MAX_VERSION) {
        attempt.options = {
          ...attempt.options,
          size: "fit",
          style: "bw",
          contrast: 1,
          simpleFallback: true,
        };
        await fallbackToStandard(
          attempt,
          "Most detail is not available for this code size. Using a black-and-white Standard code.",
        );
        return;
      }
    } else {
      const previous = PIC.detailAttempt;
      const fallbackKey = previous && optionsKey({ ...previous.options, fidelity: "standard" });
      if (fallbackKey !== optionsKey({ ...o, ...requested }) || !previous?.fallback) {
        cancelDetailAttempt(previous);
        PIC.notice = "";
        PIC.fallback = null;
      }
    }
    // Lane QR r4: the build steps the nudge up until the code reads (jsQR).
    await loadJsQR().catch(() => null);
    await loadPicture(o.picture === "own" ? "own" : sampleById(o.picture)?.id || SAMPLES[0].id);
    if (!isCurrent()) return;
    const t = tidy({ ...o, text: o.text ?? DEFAULT_TEXT }),
      pic = pictureNow(o);
    if (t.fidelity === "detail" && pic && jsqr) {
      await Promise.all([loadRasterKernel(), loadBlurKernel()]);
      if (!isCurrent()) return;
      const key = optionsKey({ ...o, ...t });
      const extra = PIC.extraFor === key ? PIC.extra || 0 : 0;
      const rejected = PIC.rejected?.key === key ? PIC.rejected.methods : [];
      try {
        const woven = await pausedScan(() =>
          attempt.run(() =>
            makeWovenAsync(
              pic,
              {
                ...t,
                extra,
                rejected,
                ...detailSettings(rejected, pic, t.shape),
              },
              (w, p, shape) => validateDetail(w, p, shape, readRGBA),
              { isCurrent },
            ),
          ),
        );
        if (isCurrent() && woven.detailCheck?.ok === false) {
          await fallbackToStandard(
            attempt,
            "Most detail could not keep this code readable. Using Standard.",
          );
          return;
        }
        if (isCurrent()) PIC.prepared = { key, pic, woven };
      } catch (error) {
        if (attempt?.fallback) await attempt.fallback;
        else if (error.name !== "AbortError") {
          await fallbackToStandard(
            attempt,
            "Most detail could not finish this picture. Using Standard.",
          );
        }
      }
    }
  },
  drive(t, c, out) {
    out.morph = [c.turn > 0 ? 1 - c.turn : 0, 0, PIC.tap[0], PIC.tap[1]];
  },
  photo: {
    skipIdenticalUniforms: true,
    on: (o) =>
      (tidy(o).fidelity === "detail" || (o.simpleFallback && o.style === "bw")) &&
      detailSettings().texture === "tiles",
    rect: () => {
      const half = PIC.woven.code.size / 2;
      return [-half, -half, half, half];
    },
    version: () => PIC.woven,
    source: () => PIC.texture,
    tiles: (u) => [
      PIC.woven.code.size,
      u.uSpMorph?.[0] || 0,
      u.uSpMorph?.[2] || 0,
      u.uSpMorph?.[3] || 0,
    ],
  },
  gpuField(o, fit) {
    if (!fit || !Number.isFinite(fit.scale) || !PIC.woven) return null;
    return pictureModifier(
      {
        size: PIC.woven.code.size,
        fg: FG,
        bg: BG,
        photo: PIC.woven.rendering?.texture === "tiles",
      },
      fit,
    );
  },
  build(k, o) {
    o = pictureFitOptions(o);
    const t = tidy({ ...o, text: o.text ?? DEFAULT_TEXT });
    let pic = pictureNow(o);
    PIC.error = "";
    if (o.picture === "own" && !PIC.own) PIC.error = "Your own picture isn't on this device any more (a link can't carry it). Open it again, or pick a sample."; // prettier-ignore
    if (!pic && typeof document === "undefined") pic = null;
    let w;
    // The stage's step up holds for these options only.
    if (PIC.extraFor !== optionsKey({ ...o, ...t })) PIC.extra = 0;
    const geometry =
      (o.shape === "circle" && borderSettings(o).pale) ||
      (o.eyeShape && !["style", "square"].includes(o.eyeShape));
    const extra = (PIC.extra || 0) + (geometry ? FIT_EXTRA : 0);
    // Most detail crops and checks the complete sticker in makeWoven; the
    // legacy path keeps its original two passes and saved-scene appearance.
    const make = (text) => {
      if (o.simpleFallback) {
        // One checked grid covers the longest ASCII link the input allows.
        // Try masks with all four original source checks before rendering.
        for (const mask of [0, 1, 2, 3, 4, 5, 6, 7]) {
          let code = encodeQR(text, t.level, { boost: false, min: 18, mask });
          if (code.version === 23) code = encodeQR(text, t.level, { boost: false, min: 24, mask });
          const candidate = weave(code, null, { ...t, margin: 0.5 });
          if (!jsqr || checkStrict(candidate, readRGBA)) return candidate;
        }
        throw new Error("This Standard code did not pass its scan checks.");
      }
      return makeWoven(pic, { ...t, text, extra, shape: o.shape }, jsqr ? readRGBA : null);
    };
    try {
      w =
        PIC.prepared?.key === optionsKey({ ...o, ...t }) && PIC.prepared.pic === pic
          ? PIC.prepared.woven
          : make(t.text);
    } catch (err) {
      PIC.error = err.message;
      if (o.simpleFallback) throw err;
      w = make(DEFAULT_TEXT);
    }
    const source =
      pic &&
      t.fidelity !== "detail" &&
      !o.simpleFallback &&
      (o.shape === "circle" || cropSettings(o).pictureFit !== "legacy")
        ? codePicture(pic, { ...o, quiet: borderSettings(o).quiet }, w.code.size)
        : pic;
    if (source !== pic)
      w = makeWoven(source, { ...t, text: w.code.text, extra }, jsqr ? readRGBA : null);
    if (borderSettings(o).pale) w = fitMaskWoven(w, source, t, jsqr ? readRGBA : null);
    w = wovenEyes(w, o.eyeShape);
    if (jsqr && fittedOptions(o) && !checkWoven(w, readRGBA).ok)
      PIC.error = [
        PIC.error,
        "This crop or eye shape did not scan. Try Square eyes, more contrast, or a shorter text.",
      ]
        .filter(Boolean)
        .join(" ");
    const { splats, half, reduced } =
      PIC.prepared?.woven === w && PIC.prepared.geometry
        ? PIC.prepared.geometry
        : pictureSplats(w, k.count, o.shape, pic, o);
    if (reduced)
      PIC.error = [PIC.error, "The picture uses less detail to fit this device."]
        .filter(Boolean)
        .join(" ");
    PIC.texture = null;
    if (w.rendering?.texture === "tiles" && typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = w.G;
      const context = canvas.getContext("2d"),
        image = context.createImageData(w.G, w.G),
        colors = tileColors(w);
      for (let i = 0; i < w.G * w.G; i++) {
        for (let channel = 0; channel < 3; channel++)
          image.data[i * 4 + channel] = colors[i * 3 + channel];
        image.data[i * 4 + 3] = 255;
      }
      context.putImageData(image, 0, 0);
      PIC.texture = canvas;
    }
    PIC.woven = w;
    PIC.options = { ...o, ...t };
    PIC.check = null;
    PIC.checking = true;
    PIC.fix = PIC.fixKeep ? PIC.fix : null;
    k.reach([half + 1, half + 1, 1]);
    k.reach([-half - 1, -half - 1, -0.8]);
    k.cloud({ share: Math.min(1, splats.length / k.count), jitter: 0, pattern: false }, (rand, i) => splats[i] || null); // prettier-ignore
    k.data = { size: w.code.size, version: w.code.version };
    PIC.kit = k;
    PIC.buildGeneration = app()?.player?.loadToken;
    hold();
    Promise.resolve().then(() => PIC.panel?.refresh());
    scheduleCheck(t.fidelity === "detail" ? 0 : PIC.holding ? 200 : 700);
  },
  credits: [
    {
      label: "Picture QR",
      title: "Most detail rendering and fidelity study",
      author: "Ryan with Codex (GPT-6)",
      license: "MIT",
    },
    ...SAMPLES.map((s) =>
      s.ai
        ? { label: "Picture QR", title: `${s.label}: an AI-made sample picture (${s.prompt})`, source: s.page, author: s.author, license: "AI-made by the owner" } // prettier-ignore
        : {
            label: "Picture QR",
            title: `${s.label} (a sample picture)`,
            source: s.page,
            author: s.author,
            license: "CC0 1.0",
            licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
          },
    ),
  ],
};

// ======================================================================================
// QR from real things
// ======================================================================================

const BLD = { code: null, options: null, kit: null, check: null, panel: null, tap: [0, 0], error: "" }; // prettier-ignore

// The last frame of the build (the code at rest), front on, read with jsQR at
// phone size and smaller.
async function checkBuild() {
  const code = BLD.code;
  if (!code) return null;
  await loadJsQR();
  const kit = BLD.kit;
  const half = shapeHalf(
    code,
    BLD.options?.shape === "circle" && BLD.options?.material !== "dominoes" ? "circle" : "square",
  );
  const big = await renderFront(kit, half, 720);
  if (kit !== BLD.kit) return BLD.check;
  const total = 2 * (half + 1);
  const at = (ppm) => {
    const img = pixels(shrink(big, total * ppm));
    return readRGBA(img.data, img.width, img.height);
  };
  BLD.lastShot = big;
  const sizes = [8, 4].map((ppm) => ({ ppm, text: at(ppm) }));
  BLD.check = { text: code.text, sizes, ok: sizes.every((s) => s.text === code.text) };
  BLD.panel?.refresh();
  return BLD.check;
}
let buildTimer = 0;
function scheduleBuildCheck(ms = 600) {
  clearTimeout(buildTimer);
  if (BLD.noAuto) return;
  buildTimer = setTimeout(() => {
    const a = app();
    if (a?.player?.toyInfo?.id !== "qr-build") return;
    const st = a.player.motion?.state || {};
    if (a.busy || st.build > 0) return scheduleBuildCheck(400);
    checkBuild();
  }, ms);
}

function buildPanel() {
  const box = el("div", { className: "qrc-build" });
  const input = el("input", { type: "text", id: "qrc-btext", maxLength: 120, style: "width:100%;box-sizing:border-box" }); // prettier-ignore
  input.setAttribute("aria-label", "What the code holds");
  const make = button("qrc-bmake", "Make the code", () => switchTo({ text: input.value }, "build"), true); // prettier-ignore
  const out = el("div", { id: "qrc-bcheck", role: "status", style: "margin:8px 0" });
  box.append(
    el("label", { htmlFor: input.id, textContent: "What the code holds" }),
    input,
    row(make),
    out,
    note("Every piece is solid and moves like the real thing: a domino topples about its edge and knocks the next, a marble rolls and turns as it goes, a tile turns over about its middle. Each build ends on a code that scans; the toy reads its own last frame to check. A longer text makes a bigger code with more pieces."), // prettier-ignore
  );
  BLD.panel = {
    refresh() {
      const o = BLD.options || {};
      if (document.activeElement !== input) input.value = o.text ?? DEFAULT_TEXT;
      out.replaceChildren();
      const c = BLD.code;
      if (c) out.append(el("p", { style: "margin:2px 0", textContent: `Version ${c.version} (${c.size} × ${c.size} modules), error correction ${c.ecc}: ${BLD.pieces} ${materialById(o.material).label.toLowerCase()}.` })); // prettier-ignore
      if (BLD.options?.shape === "circle" && BLD.options?.material === "dominoes")
        out.append(
          note(
            "Dominoes need a rectangular chain, so this build stays Square. Circle works with Marbles and Flip tiles.",
          ),
        );
      if (BLD.error) out.append(el("p", { style: "margin:2px 0;color:#b3261e", textContent: BLD.error })); // prettier-ignore
      const ck = BLD.check;
      if (!ck) out.append(el("p", { style: "margin:2px 0", textContent: "Checking that the finished code scans…" })); // prettier-ignore
      else
        for (const s of ck.sizes)
          out.append(el("p", { style: "margin:2px 0", textContent: `${s.text === ck.text ? "✓" : "✗"} The finished code reads at ${s.ppm} pixels a module.` })); // prettier-ignore
    },
  };
  BLD.panel.refresh();
  return box;
}

const BUILD = {
  alive: true,
  turntable: false,
  kernel: "sharp",
  density: 2,
  options: [
    { key: "text", label: "Text", type: "text", default: DEFAULT_TEXT, hidden: true },
    { key: "shape", label: "Shape", type: "select", default: "square", choices: shapeChoices },
    { key: "material", label: "Made of", type: "select", default: "dominoes", choices: MATERIALS.map((m) => ({ id: m.id, label: m.label })) }, // prettier-ignore
    { key: "level", label: "Error correction", type: "select", default: "M", choices: LEVELS.map((l) => ({ id: l, label: { L: "L: 7% can be lost", M: "M: 15%", Q: "Q: 25%", H: "H: 30%" }[l] })) }, // prettier-ignore
  ],
  controls: [{ key: "build", label: "Build it", type: "pulse", ease: BUILD_SECS + 0.6 }],
  action: {
    key: "build",
    label: "Build it",
    at(point) {
      BLD.tap = point ? [point[0], point[1]] : [0, 0];
      return "build";
    },
  },
  sounds: () => [],
  input: { title: "QR from real things", fileButton: false, live: [{ render: buildPanel }], note: "", read: async () => ({}), shown: () => "" }, // prettier-ignore
  drive(t, c, out) {
    // 0: the pieces at their start; 1: the finished code (at rest). The
    // pulse runs a little longer than the build, so it rests on the code.
    const p = c.build > 0 ? Math.min(1, ((1 - c.build) * (BUILD_SECS + 0.6)) / BUILD_SECS) : 1;
    out.morph = [BLD.hold ?? p, 0, BLD.tap[0], BLD.tap[1]];
    const done = !(c.build > 0);
    if (done && BLD.wasBuilding) scheduleBuildCheck(300);
    BLD.wasBuilding = !done;
  },
  gpuField(o, fit) {
    if (!fit || !Number.isFinite(fit.scale) || !BLD.code) return null;
    const N = BLD.code.size;
    // The wave of flipping tiles crosses the code in what's left after one flip.
    const span = BUILD_SECS - FLIP_SECS - 0.35;
    return buildModifier({ size: N, fg: COLORS.tileDark, bg: COLORS.tileLight, secs: BUILD_SECS, fall: FALL_SECS, roll: ROLL_SECS, flip: FLIP_SECS, dominoT: DOMINO_T, marbleR: MARBLE_R, tileT: TILE_T, startX: N / 2 + (o.shape === "circle" ? CIRCLE_QUIET - 0.7 : QUIET + 1.2), span, drop: DROP_SECS }, fit); // prettier-ignore
  },
  build(k, o) {
    const text = o.text ?? DEFAULT_TEXT;
    BLD.error = "";
    let code;
    try {
      code = encodeQR(text, LEVELS.includes(o.level) ? o.level : "M");
      if (code.size > 57) throw new Error("That text makes a code too big to build piece by piece here (more than 57 modules a side). Try a shorter one."); // prettier-ignore
    } catch (err) {
      BLD.error = err.message;
      code = encodeQR(DEFAULT_TEXT, "M");
    }
    const material = materialById(o.material).id;
    const { splats, half, layout } = buildPieces(code, material, k.count, { shape: o.shape });
    BLD.code = code;
    BLD.pieces = material === "tiles" ? layout.filter((t) => t.dark).length : layout.length;
    BLD.options = { ...o, text: code.text, material };
    BLD.check = null;
    // Room for standing dominoes and marbles waiting at the edge.
    k.reach([half + 2.4, half + 1, 2.4]);
    k.reach([-half - 1, -half - 1, -0.4]);
    k.cloud({ share: Math.min(1, splats.length / k.count), jitter: 0, pattern: false }, (rand, i) => splats[i] || null); // prettier-ignore
    k.data = { size: code.size, material };
    BLD.kit = k;
    Promise.resolve().then(() => BLD.panel?.refresh());
    scheduleBuildCheck(800);
  },
};

// ======================================================================================
// Other barcodes
// ======================================================================================

export const KINDS = [
  { id: "code128", label: "Code 128", zx: "CODE_128", text: "Splashery 2026", hint: "Any plain ASCII text, up to 80 characters." }, // prettier-ignore
  { id: "ean13", label: "EAN-13", zx: "EAN_13", text: "200123456789", hint: "12 digits; the toy adds the check digit (or type all 13 and it checks yours)." }, // prettier-ignore
  { id: "upca", label: "UPC-A", zx: "UPC_A", text: "40123456789", hint: "11 digits; the toy adds the check digit (or type all 12 and it checks yours)." }, // prettier-ignore
  { id: "datamatrix", label: "Data Matrix", zx: "DATA_MATRIX", text: "https://ryanjosephkamp.github.io/splashery/", hint: "Any text, up to 300 characters." }, // prettier-ignore
  { id: "aztec", label: "Aztec", zx: "AZTEC", text: "https://ryanjosephkamp.github.io/splashery/", hint: "Any text, up to 300 characters." }, // prettier-ignore
];
const kindOf = (id) => KINDS.find((k) => k.id === id) || KINDS[0];
const INK = [0.06, 0.06, 0.07];
const PAPER = [1, 1, 1];
const LASER = [0.95, 0.12, 0.1];

// ZXing for JavaScript (vendor/zxing-js/, Apache-2.0), loaded when the toy
// opens: a classic script that sets window.ZXing.
let zxingP = null;
export function loadZXing() {
  if (globalThis.ZXing?.DataMatrixWriter) return Promise.resolve(globalThis.ZXing);
  if (zxingP) return zxingP;
  zxingP = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL("../../vendor/zxing-js/zxing.min.js", import.meta.url).href;
    s.onload = () => (globalThis.ZXing ? resolve(globalThis.ZXing) : reject(new Error("The barcode library didn't load."))); // prettier-ignore
    s.onerror = () => {
      zxingP = null;
      reject(new Error("The barcode library didn't load."));
    };
    document.head.appendChild(s);
  });
  return zxingP;
}

// A 2D symbol from ZXing: { rows, cols, dark }.
function matrix2D(Z, kind, text) {
  const hints = new Map();
  let bm;
  if (kind === "datamatrix") {
    hints.set(Z.EncodeHintType.DATA_MATRIX_SHAPE, Z.DataMatrixSymbolShapeHint?.FORCE_SQUARE ?? 1);
    bm = new Z.DataMatrixWriter().encode(text, Z.BarcodeFormat.DATA_MATRIX, 0, 0, hints);
  } else {
    bm = new Z.AztecCodeWriter().encode(text, Z.BarcodeFormat.AZTEC, 0, 0, hints);
  }
  const rows = bm.getHeight();
  const cols = bm.getWidth();
  const dark = new Uint8Array(rows * cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) dark[r * cols + c] = bm.get(c, r) ? 1 : 0; // prettier-ignore
  return { rows, cols, dark };
}

// What the symbol for the options is: { kind, sym (linear) | mat (2D), text,
// human, check, error }.
export function symbolFor(o, Z = globalThis.ZXing) {
  const k = kindOf(o.kind);
  const text = String(o.text ?? "") || k.text;
  const make = (t) => {
    if (k.id === "code128") {
      if (t.length > 80) throw new Error("Code 128 here holds up to 80 characters.");
      return { sym: code128(t) };
    }
    if (k.id === "ean13") return { sym: ean13(t) };
    if (k.id === "upca") return { sym: upcA(t) };
    if (t.length > 300) throw new Error("Up to 300 characters here.");
    if (!Z) throw new Error("The barcode library isn't loaded.");
    return { mat: matrix2D(Z, k.id, t) };
  };
  try {
    const r = make(text);
    return { kind: k.id, text: r.sym ? r.sym.text : text, ...r, error: "" };
  } catch (err) {
    try {
      const r = make(k.text);
      return { kind: k.id, text: r.sym ? r.sym.text : k.text, ...r, error: err.message };
    } catch (err2) {
      return { kind: k.id, text: "", error: err2.message };
    }
  }
}

const BC = { sym: null, options: null, kit: null, check: null, panel: null, half: 10 };

// The symbol as splats, in modules, centered: { splats, half, height }.
export function barcodeSplats(S) {
  const out = [];
  // A rectangle of splats, its lattice sx across and sy along.
  const rect = (x0, y0, x1, y1, z, sx, sy, color, params, sig = 0.55) => {
    const nx = Math.max(1, Math.round((x1 - x0) / sx));
    const ny = Math.max(1, Math.round((y1 - y0) / sy));
    const ax = (x1 - x0) / nx;
    const ay = (y1 - y0) / ny;
    for (let layer = 0; layer < 2; layer++)
      for (let j = 0; j < ny - layer; j++)
        for (let i = 0; i < nx - layer; i++)
          out.push({ p: [x0 + (i + 0.5 + layer * 0.5) * ax, y0 + (j + 0.5 + layer * 0.5) * ay, z], scales: [sig * ax, sig * ay, 0.01], quat: [0, 0, 0, 1], color, opacity: 1, params, pattern: false }); // prettier-ignore
  };
  const piece = (cx) => [1, 1 + 16 * (100000 + Math.round(cx * 100))];
  // Letters, 7 rows of pixels each `h / 7` tall, centered at (cx, cy).
  const label = (text, cx, cy, h) => {
    const px = h / 7;
    const w = text.length * 6 - 1;
    for (let t = 0; t < 7; t++)
      for (let s = 0; s < w; s++)
        if (inkedLine(text, s + 0.5, t + 0.5))
          rect(cx + (s - w / 2) * px, cy + (3.5 - t - 1) * px, cx + (s + 1 - w / 2) * px, cy + (3.5 - t) * px, 0, px / 2, px / 2, INK, piece(cx + (s - w / 2) * px)); // prettier-ignore
  };
  let W;
  let H;
  if (S.sym) {
    const sym = S.sym;
    const n = sym.modules;
    const h = sym.kind === "code128" ? Math.max(30, Math.round(n * 0.22)) : 60;
    const guard = guardModules(sym);
    // Lane QR r4: Code 128's line of text gets room on the label too (it
    // hung off the bottom of the paper).
    const textH = 7;
    W = n + sym.quiet[0] + sym.quiet[1];
    H = h + textH + 6;
    const x0 = -n / 2 + (sym.quiet[0] - sym.quiet[1]) / 2;
    const top = H / 2 - 3;
    for (const [a, b] of barSpans(sym)) {
      const long = guard[a] ? 5 : 0;
      rect(x0 + a, top - h - long, x0 + b, top, 0, 0.25, 0.6, INK, piece(x0 + (a + b) / 2));
    }
    // The human-readable line under the bars. EAN-13: the first digit in
    // the left quiet zone, six under each half; UPC-A: the first and last
    // digits in the quiet zones, five under each half (as printed symbols).
    if (sym.kind === "code128") label(sym.human, 0, top - h - 5, 5);
    else {
      const d = sym.text;
      const y = top - h - 4.2;
      const groups =
        sym.kind === "ean13"
          ? [
              [d[0], -5],
              [d.slice(1, 7), 24],
              [d.slice(7), 71],
            ]
          : [
              [d[0], -5],
              [d.slice(1, 6), 27.5],
              [d.slice(6, 11), 67.5],
              [d[11], 100],
            ];
      for (const [g, at] of groups) label(g, x0 + at, y, 7);
    }
    // The quiet zones, marked on the paper with small corner ticks (light
    // gray, outside the symbol) so it's clear they belong to it.
  } else {
    const m = S.mat;
    const q = 2;
    W = m.cols + 2 * q;
    H = m.rows + 2 * q;
    const x0 = -m.cols / 2;
    const y1 = m.rows / 2;
    // Lane QR r4: drawn as the QR code toy draws its modules (src/qr/
    // crisp.js): each dark module a crisp cell reaching into its dark
    // neighbors, so a run of modules is one even, seamless area with hard
    // edges. Each module is still its own piece (it lifts with its column).
    const dark = (r, c) => r >= 0 && c >= 0 && r < m.rows && c < m.cols && m.dark[r * m.cols + c] === 1; // prettier-ignore
    const cx = (c) => x0 + c + 0.5;
    const cy = (r) => y1 - r - 0.5;
    const scale = TUNE.finest;
    const { crisp } = painter(out, { scale });
    const grid = moduleGrid({ dark, cx, cy, pad: TUNE.rings.reduce((a, b) => a + b, 0) * scale + 0.03 }); // prettier-ignore
    for (let r = 0; r < m.rows; r++)
      for (let c = 0; c < m.cols; c++) {
        if (!dark(r, c)) continue;
        const [xa, ya, xb, yb] = grid.cell(r, c);
        crisp({ x0: xa, y0: ya, x1: xb, y1: yb, open: grid.openOf(r, c), notches: grid.notchesOf(r, c), z: 0, color: INK, params: piece(cx(c)) }); // prettier-ignore
      }
  }
  // The paper behind, with the quiet zones.
  const PW = W / 2 + 1.5;
  const PH = H / 2 + 1.5;
  // Well behind the bars: seen at an angle, paper splats only 0.12 behind
  // sorted in front of some bars' splats and hatched them.
  rect(-PW, -PH, PW, PH, -0.9, 0.6, 0.6, PAPER, [0, 0]);
  // The scanner's line: a thin red bar across the whole height, in front.
  rect(-0.25, -PH + 0.5, 0.25, PH - 0.5, 0.45, 0.25, 0.8, LASER, [1, 2]);
  return { splats: out, half: Math.max(PW, PH), width: W, height: H };
}

// Reads the stage's own picture with zxing-js for the symbol's format.
async function checkBarcode() {
  const S = BC.sym;
  if (!S?.text) return null;
  const Z = await loadZXing();
  const kit = BC.kit;
  const big = await renderFront(kit, BC.half, 900, 0.5);
  if (kit !== BC.kit) return BC.check;
  BC.lastShot = big;
  const read = (canvas) => {
    const img = pixels(canvas);
    const lum = new Uint8ClampedArray(img.width * img.height);
    for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = (img.data[j] * 306 + img.data[j + 1] * 601 + img.data[j + 2] * 117) >> 10; // prettier-ignore
    const hints = new Map([
      [Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat[kindOf(S.kind).zx]]],
      [Z.DecodeHintType.TRY_HARDER, true],
    ]);
    try {
      const reader = new Z.MultiFormatReader();
      reader.setHints(hints);
      const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, img.width, img.height))); // prettier-ignore
      return reader.decode(bmp).getText();
    } catch {
      return null;
    }
  };
  // Full size and smaller: half size for the square codes, two thirds for
  // the long linear ones (about 3 pixels a module for Code 128).
  const small = S.sym ? 600 : 450;
  const sizes = [900, small].map((px) => ({ px, text: read(px === 900 ? big : shrink(big, px)) })); // prettier-ignore
  // UPC-A reads back as its 12 digits (zxing reads UPC-A as UPC-A when asked
  // for it).
  BC.check = { text: S.text, sizes, ok: sizes.every((s) => s.text === S.text) };
  BC.panel?.refresh();
  return BC.check;
}
let bcTimer = 0;
function scheduleBarcodeCheck(ms = 600) {
  clearTimeout(bcTimer);
  if (BC.noAuto) return;
  bcTimer = setTimeout(() => {
    const a = app();
    if (a?.player?.toyInfo?.id !== "barcodes") return;
    if (a.busy || a.player.motion?.state?.scan > 0) return scheduleBarcodeCheck(400);
    checkBarcode().catch(() => {});
  }, ms);
}

function barcodePanel() {
  const box = el("div", { className: "qrc-barcodes" });
  const input = el("input", { type: "text", id: "qrc-bctext", maxLength: 300, style: "width:100%;box-sizing:border-box" }); // prettier-ignore
  input.setAttribute("aria-label", "What the barcode holds");
  const hint = note("", "qrc-bchint");
  const make = button("qrc-bcmake", "Make the barcode", () => switchTo({ text: input.value }, "scan"), true); // prettier-ignore
  const out = el("div", { id: "qrc-bccheck", role: "status", style: "margin:8px 0" });
  box.append(
    el("label", { htmlFor: input.id, textContent: "What the barcode holds" }),
    input,
    hint,
    row(make),
    out,
    note("Code 128, EAN-13 and UPC-A are drawn by Splashery's own code, with their check digits and the quiet zones the standards ask for; Data Matrix and Aztec come from ZXing for JavaScript. The toy reads its own picture back with ZXing to check that it scans."), // prettier-ignore
  );
  BC.panel = {
    refresh() {
      const o = BC.options || {};
      const k = kindOf(o.kind);
      if (document.activeElement !== input) input.value = o.text || k.text;
      hint.textContent = k.hint;
      out.replaceChildren();
      const S = BC.sym;
      if (S?.error) out.append(el("p", { style: "margin:2px 0;color:#b3261e", textContent: S.error })); // prettier-ignore
      if (S?.sym) {
        const sym = S.sym;
        const what = sym.kind === "code128" ? `Check symbol ${sym.check} (the start value plus each value times its place, modulo 103). ${sym.values.length + 1} symbols, ${sym.modules} modules wide, with quiet zones of ${sym.quiet[0]} modules.` : `Check digit ${sym.check} (weights 3 and 1 from the right, up to a multiple of 10). ${sym.modules} modules wide, with quiet zones of ${sym.quiet[0]} and ${sym.quiet[1]} modules.`; // prettier-ignore
        out.append(el("p", { id: "qrc-bcmath", style: "margin:2px 0", textContent: what }));
      }
      if (S?.mat) out.append(el("p", { style: "margin:2px 0", textContent: `${S.mat.rows} × ${S.mat.cols} modules.` })); // prettier-ignore
      const ck = BC.check;
      if (!ck) out.append(el("p", { style: "margin:2px 0", textContent: "Checking that it scans…" })); // prettier-ignore
      else
        for (const s of ck.sizes)
          out.append(el("p", { style: "margin:2px 0", textContent: `${s.text === ck.text ? "✓" : "✗"} Reads at ${s.px} pixels wide${s.text && s.text !== ck.text ? ` (as “${s.text}”)` : ""}.` })); // prettier-ignore
    },
  };
  BC.panel.refresh();
  return box;
}

const BARCODES = {
  alive: true,
  turntable: false,
  kernel: "sharp",
  density: 2,
  options: [
    { key: "kind", label: "Kind", type: "select", default: "code128", choices: KINDS.map((k) => ({ id: k.id, label: k.label })) }, // prettier-ignore
    { key: "text", label: "Text", type: "text", default: "", hidden: true },
  ],
  controls: [{ key: "scan", label: "Scan it", type: "pulse", ease: 2.6 }],
  action: { key: "scan", label: "Scan it" },
  sounds: () => [],
  input: { title: "Other barcodes", fileButton: false, live: [{ render: barcodePanel }], note: "", read: async () => ({}), shown: () => "" }, // prettier-ignore
  async prepare() {
    if (typeof document === "undefined") return;
    await loadZXing();
  },
  drive(t, c, out) {
    out.morph = [c.scan > 0 ? 1 - c.scan : 0, 0, 0, 0];
  },
  gpuField(o, fit) {
    if (!fit || !Number.isFinite(fit.scale) || !BC.sym) return null;
    const lin = !!BC.sym.sym;
    // On a long linear symbol the wave of lifting bars is wider, so it reads.
    return scanModifier({ half: BC.width / 2, width: lin ? 9 : 2.2, lift: lin ? 6 : 1.6 }, fit);
  },
  build(k, o) {
    // In the Node tools there is no ZXing: a 2D kind shows Code 128.
    let S = symbolFor(o);
    if (!S.sym && !S.mat) S = symbolFor({ kind: "code128" });
    const { splats, half, width } = barcodeSplats(S);
    BC.sym = S;
    BC.half = half;
    BC.width = width;
    BC.options = { ...o };
    BC.check = null;
    k.reach([half, half, 2.8]);
    k.reach([-half, -half, -1]);
    k.cloud({ share: Math.min(1, splats.length / k.count), jitter: 0, pattern: false }, (rand, i) => splats[i] || null); // prettier-ignore
    k.data = { kind: S.kind };
    BC.kit = k;
    Promise.resolve().then(() => BC.panel?.refresh());
    scheduleBarcodeCheck(700);
  },
};

export const RECIPES = { "qr-picture": PICTURE, "qr-build": BUILD, barcodes: BARCODES };

// ---- The test hook ---------------------------------------------------------------------------
// window.__splashery.qrCraft:
//   picture()          { woven, options, check } of Picture QR
//   checkPicture()     reads Picture QR now (the layout and the stage)
//   makeItScan()       applies the closest version that scans
//   savePNG(size)      the PNG blob (downloaded too)
//   lastShot()         the stage picture the last check read (a data URL)
//   autoCheck = false  stops the automatic check
if (typeof window !== "undefined" && window.__splashery) {
  window.__splashery.qrCraft = {
    picture: () => ({
      woven: PIC.woven,
      options: PIC.options,
      check: PIC.check,
      checking: PIC.checking,
      error: PIC.error,
      notice: PIC.notice || "",
      fallback: PIC.fallback || null,
      rejected: PIC.rejected?.methods || [],
    }),
    checkPicture: () => checkPicture(),
    makeItScan: () => makeItScan(),
    savePNG: (size) => savePNG(size),
    lastShot: () => PIC.lastShot?.toDataURL("image/png") ?? null,
    build: () => ({ code: BLD.code, options: BLD.options, check: BLD.check, error: BLD.error }),
    checkBuild: () => checkBuild(),
    lastBuildShot: () => BLD.lastShot?.toDataURL("image/png") ?? null,
    // The build at progress p (0..1), held there (null lets it run again).
    barcode: () => ({ sym: BC.sym, options: BC.options, check: BC.check }),
    checkBarcode: () => checkBarcode(),
    hold(p) {
      BLD.hold = p;
      app()?.player?.stage?.requestRender?.();
    },
    smooth,
    set autoCheck(on) {
      PIC.noAuto = !on;
      BLD.noAuto = !on;
      if (!on) clearTimeout(checkTimer);
      if (!on) clearTimeout(buildTimer);
      BC.noAuto = !on;
      if (!on) clearTimeout(bcTimer);
    },
  };
}
