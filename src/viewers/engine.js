// Lane Viewers: the work behind both toys (the Splat toolkit and Point clouds): it holds the files
// people open, runs the crop, filters, shrinking and thinning on every splat or point, and hands
// back a preview the toy can draw within the device's budget. In the page it runs in a worker
// (src/viewers/worker.js); in Node (the tests) the client calls it directly.
//
// Coordinates: what goes to the toy is in "view" axes (+Y up, +Z toward the viewer). A splat
// file's PLY axes are right-down-forward, so an upright splat is turned half a turn about X; a
// point cloud's Z is up (lidar), or its Y.

import { readSplatFile, writeSplatFile, pick, SAVE_FORMATS, boundsOf, emptyTable, FIELDS } from "./splat-io.js"; // prettier-ignore
import { splatStats, runPipeline, previewArrays, decimateIndex, robustBounds } from "./splat-ops.js"; // prettier-ignore
import { readCloudFile, writeCloudFile, pickCloud, CLOUD_SAVE } from "./cloud-io.js";
import { cloudStats, cloudColors, runCloudPipeline, nearestPoint, measure, typicalSpacing, evenShare, reliefShade, thinCloud } from "./cloud-ops.js"; // prettier-ignore

const slots = new Map(); // "splat:a" -> { table, name, fileBytes, stats, last }

let webpPromise = null;
export function getWebp() {
  webpPromise ||= (async () => {
    const url = new URL("../../vendor/webp/webp.mjs", import.meta.url);
    const { default: Module } = await import(url.href);
    const M = await Module({
      locateFile: (p) => new URL(`../../vendor/webp/${p}`, import.meta.url).href,
    });
    const free = (...p) => p.forEach((x) => M._free(x));
    return {
      encodeLosslessRGBA(rgba, w, h) {
        const ip = M._malloc(rgba.length);
        const op = M._malloc(4);
        const sp = M._malloc(4);
        M.HEAPU8.set(rgba, ip);
        // Effort 4 keeps the hidden color of see-through pixels (libwebp may drop it otherwise).
        const ok = M._webp_encode_lossless_rgba_level(ip, w, h, w * 4, 4, op, sp);
        if (!ok) {
          free(ip, op, sp);
          throw new Error("Could not make the SOG's pictures.");
        }
        const p = M.HEAPU32[op >> 2];
        const s = M.HEAPU32[sp >> 2];
        const out = M.HEAPU8.slice(p, p + s);
        M._webp_free(p);
        free(ip, op, sp);
        return out;
      },
      decodeRGBA(bytes) {
        const ip = M._malloc(bytes.length);
        const op = M._malloc(4);
        const wp = M._malloc(4);
        const hp = M._malloc(4);
        M.HEAPU8.set(bytes, ip);
        if (!M._webp_decode_rgba(ip, bytes.length, op, wp, hp)) {
          free(ip, op, wp, hp);
          throw new Error("One of this SOG's pictures could not be read.");
        }
        const p = M.HEAPU32[op >> 2];
        const width = M.HEAPU32[wp >> 2];
        const height = M.HEAPU32[hp >> 2];
        const rgba = M.HEAPU8.slice(p, p + width * height * 4);
        M._webp_free(p);
        free(ip, op, wp, hp);
        return { rgba, width, height };
      },
    };
  })();
  return webpPromise;
}

let lazPromise = null;
export function getLazPerf() {
  lazPromise ||= (async () => {
    if (typeof WorkerGlobalScope === "undefined")
      throw new Error("LAZ files are read in a worker, which this browser didn't start.");
    const url = new URL("../../vendor/laz-perf/laz-perf.js", import.meta.url);
    const { default: create } = await import(url.href);
    return create({
      locateFile: (p) => new URL(`../../vendor/laz-perf/${p}`, import.meta.url).href,
    });
  })();
  return lazPromise;
}

const key = (kind, slot) => `${kind}:${slot || "a"}`;

// ---- Opening ----------------------------------------------------------------------------------

export async function open(
  { kind, slot, name, bytes, files = null, stray = false },
  progress = () => {},
) {
  progress(0, `Reading ${name}…`);
  const onProgress = (p) => progress(p * 0.9, `Reading ${name}…`);
  const fileBytes = bytes.byteLength + (files ? [...files.values()].reduce((s, b) => s + b.byteLength, 0) : 0); // prettier-ignore
  let rec;
  if (kind === "splat") {
    let table = await readSplatFile(bytes, name, { files, getWebp, onProgress });
    if (stray) table = withStrays(table);
    rec = { kind, table, name, fileBytes, stats: splatStats(table, fileBytes) };
  } else {
    const cloud = await readCloudFile(bytes, name, { getLazPerf, onProgress });
    rec = { kind, cloud, name, fileBytes, stats: cloudStats(cloud, fileBytes), spacing: typicalSpacing(cloud) }; // prettier-ignore
  }
  slots.set(key(kind, slot), rec);
  progress(1, "");
  return { name, stats: rec.stats, spacing: rec.spacing };
}

// A sample made for trying the floater filter: the splats plus 0.6% stray ones, scattered in the
// space around them (seeded, so it is the same every time), like the floaters a capture leaves.
export function withStrays(t, share = 0.006, seed = 11) {
  const extra = Math.round(t.count * share);
  const b = robustBounds(t, 0.01);
  const out = emptyTable(t.count + extra, t.shDegree);
  for (const f of FIELDS) out[f].set(t[f]);
  t.rest.forEach((a, k) => out.rest[k].set(a));
  let s = seed;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const size = Math.max(...b.size);
  const c = b.min.map((v, k) => (v + b.max[k]) / 2);
  for (let j = 0; j < extra; j++) {
    const i = t.count + j;
    // Somewhere in a box twice the core's size, but not inside the core itself.
    let p;
    do p = [0, 1, 2].map((k) => c[k] + (rnd() - 0.5) * 2 * Math.max(b.size[k], size * 0.6));
    while (p.every((v, k) => v > b.min[k] && v < b.max[k]));
    out.x[i] = p[0];
    out.y[i] = p[1];
    out.z[i] = p[2];
    const g = (rnd() - 0.5) * 1.2;
    out.r[i] = g + (rnd() - 0.5) * 0.4;
    out.g[i] = g + (rnd() - 0.5) * 0.4;
    out.b[i] = g + (rnd() - 0.5) * 0.4;
    out.opacity[i] = -1 + rnd() * 3;
    const ls = Math.log(size * (0.002 + 0.006 * rnd()));
    out.s0[i] = ls + (rnd() - 0.5);
    out.s1[i] = ls + (rnd() - 0.5);
    out.s2[i] = ls + (rnd() - 0.5);
    out.qw[i] = 1;
  }
  out.format = t.format;
  return out;
}

export function has(kind, slot) {
  return slots.has(key(kind, slot));
}

export function forget(kind, slot) {
  slots.delete(key(kind, slot));
}

// ---- Splats ------------------------------------------------------------------------------------

// View axes from the file's: upright turns half a turn about X.
function splatToView(arr, upright) {
  if (!upright) return arr;
  const { pos, quat } = arr;
  for (let j = 0; j < arr.count; j++) {
    pos[j * 3 + 1] = -pos[j * 3 + 1];
    pos[j * 3 + 2] = -pos[j * 3 + 2];
    // (1, 0, 0, 0) about X times q, quaternions as x, y, z, w.
    const x = quat[j * 4], y = quat[j * 4 + 1], z = quat[j * 4 + 2], w = quat[j * 4 + 3]; // prettier-ignore
    quat[j * 4] = w;
    quat[j * 4 + 1] = -z;
    quat[j * 4 + 2] = y;
    quat[j * 4 + 3] = -x;
  }
  return arr;
}

// The crop box in the file's axes, from fractions of the view's frame on each view axis
// ({ x: [lo, hi], y: [lo, hi], z: [lo, hi] }, 0..1; an end at 0 or 1 doesn't cut).
export function cropBox(frame, crop, upright, flipAxes = splatAxes) {
  const min = [-Infinity, -Infinity, -Infinity];
  const max = [Infinity, Infinity, Infinity];
  const v = ["x", "y", "z"];
  for (let a = 0; a < 3; a++) {
    const [lo, hi] = crop[v[a]] || [0, 1];
    const at = (f) => frame.min[a] + f * (frame.max[a] - frame.min[a]);
    const vlo = lo <= 0 ? -Infinity : at(lo);
    const vhi = hi >= 1 ? Infinity : at(hi);
    // View axis a -> file axis and sign.
    const [fa, sign] = flipAxes(a, upright);
    if (sign > 0) {
      min[fa] = Math.max(min[fa], vlo);
      max[fa] = Math.min(max[fa], vhi);
    } else {
      min[fa] = Math.max(min[fa], -vhi);
      max[fa] = Math.min(max[fa], -vlo);
    }
  }
  return { min, max, invert: !!crop.invert };
}
const splatAxes = (a, upright) => [a, upright && a > 0 ? -1 : 1];

// The frame the view uses for a splat file: the middle 98% of its splats with a margin, in view
// axes. It stays the same while the file is cropped and cleaned, so the toy doesn't jump.
function splatFrame(rec, upright) {
  const fk = upright ? "frameU" : "frameS";
  if (!rec[fk]) {
    const b = robustBounds(rec.table, 0.02);
    const lo = b.min.slice();
    const hi = b.max.slice();
    if (upright) {
      [lo[1], hi[1]] = [-hi[1], -lo[1]];
      [lo[2], hi[2]] = [-hi[2], -lo[2]];
    }
    const pad = Math.max(...b.size) * 0.08;
    rec[fk] = { min: lo.map((v) => v - pad), max: hi.map((v) => v + pad) };
  }
  return rec[fk];
}

// settings: { upright, crop: { x, y, z, invert } | null, floaters: { k, strength } | null,
// faint, shrink (0..1 of the splats, 1 keeps all), show: "result" | "removed" | "original" },
// budget: the most splats the toy draws. Returns the preview and the numbers.
export function applySplats({ slot, settings: s, budget }, progress = () => {}) {
  const rec = slots.get(key("splat", slot));
  if (!rec) throw new Error("No splat file is open.");
  const t = rec.table;
  const upright = s.upright !== false;
  const frame = splatFrame(rec, upright);
  const crop = s.crop ? cropBox(frame, s.crop, upright) : null;
  progress(0, "Working on the splats…");
  const target = s.shrink && s.shrink < 1 ? Math.max(1, Math.round(t.count * s.shrink)) : 0;
  const res = runPipeline(
    t,
    { crop, floaters: s.floaters || null, faint: s.faint || 0, target },
    (p) => progress(p * 0.8, "Looking for floaters…"),
  );
  rec.last = res;
  progress(0.85, "Making the preview…");
  const showAll = s.show === "original";
  const base = showAll ? Uint32Array.from({ length: t.count }, (_, i) => i) : res.keep;
  const redShare = s.show === "removed" ? Math.min(res.removed.length, Math.floor(budget * 0.3)) : 0; // prettier-ignore
  const room = Math.max(1, budget - redShare);
  // A device that draws fewer splats than the file has gets the ones that show most, a little
  // bigger to close the gaps.
  const shown = base.length > room ? decimateIndex(t, base, room) : base;
  const grow = base.length > room ? Math.min(1.6, Math.pow(base.length / room, 0.25)) : 1;
  const main = splatToView(previewArrays(t, shown), upright);
  if (grow !== 1) for (let j = 0; j < main.scl.length; j++) main.scl[j] *= grow;
  let red = null;
  if (redShare) red = splatToView(previewArrays(t, evenShare(res.removed, redShare, 3), [0.95, 0.12, 0.1]), upright); // prettier-ignore
  progress(1, "");
  return {
    main,
    red,
    frame,
    crop: s.crop ? cropFrameBox(frame, s.crop) : null,
    counts: {
      total: t.count,
      kept: res.keep.length,
      removed: res.removed.length,
      cropped: res.cropped,
      drawn: shown.length,
      grow,
    },
    floater: res.floater,
    stats: rec.stats,
    name: rec.name,
  };
}

// The crop box in view axes (for drawing its outline).
function cropFrameBox(frame, crop) {
  const v = ["x", "y", "z"];
  return {
    min: [0, 1, 2].map((a) => frame.min[a] + (crop[v[a]]?.[0] ?? 0) * (frame.max[a] - frame.min[a])), // prettier-ignore
    max: [0, 1, 2].map((a) => frame.min[a] + (crop[v[a]]?.[1] ?? 1) * (frame.max[a] - frame.min[a])), // prettier-ignore
  };
}

// Saves what the last apply kept, in a format. Returns { bytes, name, count }.
export async function saveSplats({ slot, format }, progress = () => {}) {
  const rec = slots.get(key("splat", slot));
  if (!rec) throw new Error("No splat file is open.");
  const fmt = SAVE_FORMATS[format];
  if (!fmt) throw new Error(`Unknown format ${format}.`);
  progress(0.1, `Saving as ${format.toUpperCase()}…`);
  const keep = rec.last?.keep || Uint32Array.from({ length: rec.table.count }, (_, i) => i);
  const t = keep.length === rec.table.count ? rec.table : pick(rec.table, keep);
  const bytes = await writeSplatFile(t, format, { getWebp });
  progress(1, "");
  const base = rec.name.replace(/(\.compressed)?\.[^.]+$/, "").replace(/[^\w-]+/g, "-").slice(0, 60); // prettier-ignore
  return { bytes, name: `${base}-splashery.${fmt.ext}`, count: t.count };
}

// ---- Point clouds ------------------------------------------------------------------------------

// View axes from a cloud's: Z up -> (x, z, -y); Y up -> as is.
const cloudAxes = (a, up) =>
  up === "y"
    ? [a, 1]
    : [
        [0, 1],
        [2, 1],
        [1, -1],
      ][a];

function cloudFrame(rec, up) {
  const fk = `frame${up}`;
  if (!rec[fk]) {
    const b = rec.stats.bounds;
    const lo = [0, 0, 0];
    const hi = [0, 0, 0];
    for (let a = 0; a < 3; a++) {
      const [fa, sign] = cloudAxes(a, up);
      lo[a] = sign > 0 ? b.min[fa] : -b.max[fa];
      hi[a] = sign > 0 ? b.max[fa] : -b.min[fa];
    }
    rec[fk] = { min: lo, max: hi };
  }
  return rec[fk];
}

function cloudToView(c, idx, up) {
  const n = idx.length;
  const pos = new Float32Array(n * 3);
  for (let j = 0; j < n; j++) {
    const i = idx[j];
    if (up === "y") {
      pos[j * 3] = c.x[i];
      pos[j * 3 + 1] = c.y[i];
      pos[j * 3 + 2] = c.z[i];
    } else {
      pos[j * 3] = c.x[i];
      pos[j * 3 + 1] = c.z[i];
      pos[j * 3 + 2] = -c.y[i];
    }
  }
  return pos;
}

function viewToCloud(p, up) {
  return up === "y" ? p.slice() : [p[0], -p[2], p[1]];
}

// settings: { up: "z" | "y", color: "height" | "intensity" | "class" | "rgb", crop, thin (a
// spacing in the file's units, 0 for none) }, budget.
export function applyCloud({ slot, settings: s, budget }, progress = () => {}) {
  const rec = slots.get(key("cloud", slot));
  if (!rec) throw new Error("No point cloud is open.");
  const c = rec.cloud;
  const up = s.up === "y" ? "y" : "z";
  const frame = cloudFrame(rec, up);
  const crop = s.crop ? cropBox(frame, s.crop, up, cloudAxes) : null;
  progress(0.1, "Working on the points…");
  const res = runCloudPipeline(c, { crop, spacing: s.thin || 0 });
  rec.last = res;
  rec.up = up;
  const shown = evenPreview(c, res.keep, budget, rec.spacing);
  rec.shown = shown;
  const pos = cloudToView(c, shown, up);
  // Height colors stretch over the whole file, so a crop keeps its colors.
  const h = up === "y" ? 1 : 2;
  const range = [rec.stats.bounds.min[h], rec.stats.bounds.max[h]];
  const { col, mode } = cloudColors(c, shown, s.color || "height", { up, range });
  // Shaded relief (on by default): each point lit by the slope under it.
  if (s.shade !== false) {
    const f = reliefShade(c, shown, { up, cell: rec.spacing * 3 });
    for (let j = 0; j < shown.length; j++)
      for (let k = 0; k < 3; k++) col[j * 3 + k] = Math.min(1, col[j * 3 + k] * f[j]);
  }
  // Each point drawn about as wide as the gap to its neighbors at this budget.
  const spacing = Math.max(rec.spacing, s.thin || 0) * Math.sqrt(Math.max(1, res.keep.length / Math.max(1, shown.length))); // prettier-ignore
  progress(1, "");
  return {
    main: { count: shown.length, pos, col },
    frame,
    spacing,
    colorMode: mode,
    crop: s.crop ? cropFrameBox(frame, s.crop) : null,
    counts: { total: c.count, kept: res.keep.length, cropped: res.cropped, thinned: res.thinned, drawn: shown.length }, // prettier-ignore
    stats: rec.stats,
    name: rec.name,
  };
}

// The points the toy draws when there are more than its budget: one per small cube (sized so the
// count fits), so the surface is covered evenly; a random share leaves holes and clumps.
function evenPreview(c, keep, budget, spacing) {
  if (keep.length <= budget) return keep;
  let size = spacing * Math.sqrt(keep.length / budget);
  let picked = keep;
  for (let round = 0; round < 5; round++) {
    picked = thinCloud(c, keep, size);
    if (picked.length <= budget) break;
    size *= Math.sqrt(picked.length / budget) * 1.03;
  }
  return picked.length > budget ? evenShare(picked, budget, 5) : picked;
}

// The nearest shown point to a tapped place (view axes); its place in view axes and in the
// file's own coordinates.
export function nearestCloud({ slot, point }) {
  const rec = slots.get(key("cloud", slot));
  if (!rec?.shown) return null;
  const c = rec.cloud;
  const p = viewToCloud(point, rec.up);
  const hit = nearestPoint(c, rec.shown, p);
  if (!hit) return null;
  const view = cloudToView(c, [hit.index], rec.up);
  return {
    view: [view[0], view[1], view[2]],
    rel: hit.p,
    abs: hit.p.map((v, k) => v + c.origin[k]),
    cls: c.cls ? c.cls[hit.index] : null,
    intensity: c.intensity ? c.intensity[hit.index] : null,
  };
}

export function measureCloud({ a, b, up }) {
  return measure(a, b, up);
}

export function saveCloud({ slot, format }, progress = () => {}) {
  const rec = slots.get(key("cloud", slot));
  if (!rec) throw new Error("No point cloud is open.");
  const fmt = CLOUD_SAVE[format];
  if (!fmt) throw new Error(`Unknown format ${format}.`);
  progress(0.1, `Saving as ${format.toUpperCase()}…`);
  const keep = rec.last?.keep || Uint32Array.from({ length: rec.cloud.count }, (_, i) => i);
  const c = keep.length === rec.cloud.count ? rec.cloud : pickCloud(rec.cloud, keep);
  const bytes = writeCloudFile(c, format);
  progress(1, "");
  const base = rec.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w-]+/g, "-")
    .slice(0, 60);
  return { bytes, name: `${base}-splashery.${fmt.ext}`, count: c.count };
}

export const HANDLERS = {
  open,
  applySplats,
  saveSplats,
  applyCloud,
  nearestCloud,
  measureCloud,
  saveCloud,
  has: ({ kind, slot }) => has(kind, slot),
  forget: ({ kind, slot }) => forget(kind, slot),
};

export { boundsOf };
