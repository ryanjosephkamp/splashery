// Real objects (lane Real objects, "Everyday things, for real"): everyday things made from real
// 3D models (CC0 and CC BY photo scans and photoreal models), not drawn with the kit. Each
// model is baked by tools/ro-bake.mjs into assets/toys/<id>/<id>.splats: flat splats lying on
// the model's surface, colored from its texture, each tagged with the piece it moves with (a
// cap, a hood, a sleeve), cut from the model with hard edges. Every piece moves as a solid part;
// the things a model does not have (ink, water, foam, laces, a ring pull) are kit-built.
//
// The sources, their licenses and authors are in `credits` on each toy, CREDITS.md and
// tools/models.json.

import { clamp, smoothstep, mix, quatAxisAngle, quatFromTo, quatMul, quatRotate } from "../kit.js";

// ---- The baked models ------------------------------------------------------------------------

const SCANS = new Map();

async function readBytes(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return new Uint8Array(await fs.readFile(url));
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load the model.");
  return new Uint8Array(await r.arrayBuffer());
}

// Decodes a .splats file (the format is at the top of tools/ro-bake.mjs).
export function decodeSplats(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== "ROS1") throw new Error("Not a Real objects splat file.");
  const n = dv.getUint32(4, true);
  const parts = dv.getUint32(8, true);
  const f = (k) => dv.getFloat32(12 + k * 4, true);
  const lo = [f(0), f(1), f(2)];
  const hi = [f(3), f(4), f(5)];
  const sLo = f(6);
  const sHi = f(7);
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const sig = new Float32Array(n);
  const rgb = new Float32Array(n * 3);
  const part = new Uint8Array(n);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      pos[i * 3 + k] = lo[k] + (dv.getUint16(o + k * 2, true) / 65535) * (hi[k] - lo[k]);
      nrm[i * 3 + k] = dv.getInt8(o + 6 + k) / 127;
      rgb[i * 3 + k] = bytes[o + 10 + k] / 255;
    }
    sig[i] = Math.exp(sLo + (bytes[o + 9] / 255) * (sHi - sLo));
    part[i] = bytes[o + 13];
    o += 14;
  }
  return { n, parts, pos, nrm, sig, rgb, part };
}

async function loadScan(id) {
  if (!SCANS.has(id)) SCANS.set(id, decodeSplats(await readBytes(`../../assets/toys/${id}/${id}.splats`))); // prettier-ignore
  return SCANS.get(id);
}

// The kit's base splat size when a toy has no weighted surfaces (every piece here is a cloud or
// has a fixed share): sizes below are given in model units and divided by it.
const BASE = 0.01;

// Adds the scan's splats as a cloud: `share` of the toy's budget (the file's first splats, an
// even sample, grown to close the surface when fewer are used). `parts[i]` is the kit part for
// the file's part i; `color(c, i, filePart)` may recolor a splat.
export function addScan(k, scan, { share = 0.86, parts = [], color, keep } = {}) {
  k.data = k.data || {}; // sortWhileMoving keeps its state here
  const m = Math.min(scan.n, Math.max(1000, Math.floor(k.count * share)));
  const grow = Math.sqrt(scan.n / m);
  const list = [];
  for (let i = 0; i < m; i++) if (!keep || keep(scan.part[i], i)) list.push(i);
  const item = k.cloud({ count: (list.length * 160000) / k.count, pattern: false }, (_r, j) => {
    const i = list[j];
    if (i === undefined) return null;
    const fp = scan.part[i];
    let c = [scan.rgb[i * 3], scan.rgb[i * 3 + 1], scan.rgb[i * 3 + 2]];
    if (color) c = color(c, i, fp) || c;
    return {
      p: [scan.pos[i * 3], scan.pos[i * 3 + 1], scan.pos[i * 3 + 2]],
      n: [scan.nrm[i * 3], scan.nrm[i * 3 + 1], scan.nrm[i * 3 + 2]],
      size: (scan.sig[i] * grow) / BASE,
      flat: 0.14,
      color: c,
      opacity: 1,
      part: parts[fp] ?? 0,
    };
  });
  // The tests find the model's splats in the buffer through this (item.start, item.end).
  k.data.scanItem = item;
  return list.length;
}

// A kit shape added with a fixed number of splats, sized so its surface closes (the size the kit
// would give it on a weighted toy).
export function addSolid(k, shape, area, n, opts = {}) {
  const size = (Math.sqrt(area / (n * Math.PI)) * 1.25) / BASE;
  k.add(shape, { count: (n * 160000) / k.count, even: true, opacity: 1, flat: 0.25, jitter: 0.01, ...opts, size: size * (opts.size ?? 1) }); // prettier-ignore
}

// Free-form kit pieces: `n` splats from sample(i, n) -> { p, n?, size (model units), color,
// opacity?, part?, ... }, sized in model units like the scan's.
export function addCloud(k, n, sample, opts = {}) {
  k.cloud({ count: (n * 160000) / k.count, pattern: false, ...opts }, (_r, i) => {
    const s = sample(i, n);
    if (!s) return null;
    return { flat: 0.25, opacity: 1, ...s, size: s.size / BASE };
  });
}

// An even spread of points on a surface of revolution about +Y through `profile(v)` -> [r, y]
// (v 0..1): the sample index i gives [angle, v] by the golden ratio, weighted by circumference.
const PHI = 0.6180339887498949;
export function latheCloud(k, n, profile, opts = {}) {
  // Arc length along the profile times the radius, tabulated, so points spread by area.
  const M = 64;
  const acc = [0];
  let prev = profile(0);
  for (let j = 1; j <= M; j++) {
    const q = profile(j / M);
    const d = Math.hypot(q[0] - prev[0], q[1] - prev[1]);
    acc.push(acc[j - 1] + d * (q[0] + prev[0]) * Math.PI + 1e-9);
    prev = q;
  }
  const total = acc[M];
  const vAt = (f) => {
    const x = f * total;
    let j = 1;
    while (j < M && acc[j] < x) j++;
    return (j - 1 + (x - acc[j - 1]) / (acc[j] - acc[j - 1])) / M;
  };
  const size = Math.sqrt(total / (n * Math.PI)) * 1.3;
  addCloud(
    k,
    n,
    (i) => {
      const v = vAt((i + 0.5) / n);
      const a = ((i * PHI) % 1) * Math.PI * 2;
      const [r, y] = profile(v);
      const [r2, y2] = profile(Math.min(1, v + 0.002));
      const [r1, y1] = profile(Math.max(0, v - 0.002));
      // Normal: the profile's tangent turned outward.
      const tr = r2 - r1;
      const ty = y2 - y1;
      const l = Math.hypot(tr, ty) || 1;
      const nr = ty / l;
      const ny = -tr / l;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const base = { p: [r * ca, y, r * sa], n: [nr * ca, ny, nr * sa], size, v, a };
      return opts.at ? opts.at(base, i) : base;
    },
    opts.cloud,
  );
  return size;
}

// Sound-free easing helpers for the taps.
export const ease = (t) => t * t * (3 - 2 * t);
export const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export const bump = (t, a, b, c, d) => smoothstep(a, b, t) * (1 - smoothstep(c, d, t));

// An angle wrapped into -π..π: a full turn ends exactly where it started (the same quaternion,
// not its negative).
const wrap = (a) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

// Rotates v about the z axis by a (radians).
const rotZ = (v, a) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]];
};

// Sorts the parts' splats where they stand every `step` seconds while something turns (a part
// turned past a quarter turn otherwise draws its far side over its near side).
function sortWhileMoving(out, info, s, moving, step = 0.08) {
  const d = info.data;
  if (!d) return;
  const slot = moving ? Math.floor(s / step) : -1;
  if (slot !== d.sortSlot) {
    if (moving || d.sortSlot !== undefined) out.resortPose = true;
    d.sortSlot = slot;
  }
}

// ---- Liquids ---------------------------------------------------------------------------------
// A stream or a spray is a row of tokens, each a short piece of liquid: splats stretched along the
// piece, built along +Y about a shared base and turned by drive() to follow the flow. Pieces
// overlap, so a stream reads as one continuous rope, and a droplet is a short streak along its
// motion, never a round bead.

// Adds `count` pieces (tokens first..first+count-1) of length `len` and radius `r` at `base`.
export function addLiquidPieces(
  k,
  first,
  count,
  { base, len, r, color, shine, streak, opacity = 0.95, per, fine = 0.9 },
) {
  // prettier-ignore
  const n = per ?? Math.max(24, Math.round((k.count * 0.0006 * len) / r / (fine / 0.9) ** 2));
  addCloud(k, count * n, (i) => {
    const d = Math.floor(i / n);
    const j = i % n;
    const f = (j + 0.5) / n;
    const a = ((j * 0.6180339887498949) % 1) * 2 * Math.PI;
    // A capsule: full width in the middle, rounded at the ends.
    const along = (f - 0.5) * len;
    const w = r * Math.sqrt(Math.max(0.15, 1 - (2 * f - 1) ** 6));
    const x = w * Math.cos(a);
    const z = w * Math.sin(a);
    // Light from the upper left: a bright streak down one side, a darker far side.
    const lit = Math.cos(a - 2.4);
    let c = lit > 0.82 ? shine : color.map((v) => Math.min(1, v * (0.86 + 0.18 * lit)));
    // Optional streaks of a second color along the piece (amber in foam).
    if (streak && lit <= 0.82 && Math.sin(a * 5 + d * 1.7) > 0.72) c = streak;
    return {
      p: [base[0] + x, base[1] + along, base[2] + z],
      dir: [0, 1, 0],
      stretch: 2.2,
      size: r * fine,
      color: c,
      opacity,
      kind: "token",
      params: [first + d, 0],
    };
  });
}

// A token that puts a piece built along +Y about `base` at `p`, pointing along `v`.
export function pieceToken(base, p, v, visible = 1) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  const q = quatFromTo([0, 1, 0], [v[0] / l, v[1] / l, v[2] / l]);
  return { base, quat: q, offset: [p[0] - base[0], p[1] - base[1], p[2] - base[2]], visible };
}

// ---- Water bottle ----------------------------------------------------------------------------
// The baked bottle stands on y = -0.944 with radius 0.233; its neck (r 0.15) runs up to its
// lip at y 0.6, and the cap (part 1 of the file) covers the neck from y 0.376.

const WB = {
  T: 4.5,
  floor: -0.944,
  mouth: [0, 0.6, 0],
  pivot: [0, -0.2, 0],
  glass: { x: 0.74, r0: 0.165, r1: 0.2, h: 0.6 },
  tip: (115 * Math.PI) / 180,
  pieces: 18, // the stream: tokens 0..17
  splash: 26, // splash droplets: tokens 18..43
  gravity: 6,
  speed: 0.3, // how fast the water leaves the mouth
  pour: 1.15, // seconds of pouring
  fallTime: 0.4, // about how long the water takes from the mouth to the glass
  level: 0.52, // the glass fills to this share of its height
};
WB.glassTop = WB.floor + WB.glass.h;
// Where the mouth goes while it pours: just over the glass's rim, a little in from its middle.
WB.pourMouth = [WB.glass.x - 0.1, WB.glassTop + 0.22, 0];
{
  const rel = rotZ([0, WB.mouth[1] - WB.pivot[1], 0], -WB.tip);
  WB.pourOffset = [WB.pourMouth[0] - rel[0] - WB.pivot[0], WB.pourMouth[1] - rel[1] - WB.pivot[1], 0]; // prettier-ignore
}
// The cap rests on the table to the left of the bottle while it pours.
WB.capRest = [-0.62, WB.floor - 0.376 + 0.004, 0.1];
// The water leaves the mouth along the tipped bottle's axis.
WB.dir = rotZ([0, 1, 0], -WB.tip);

// Seconds for water leaving `mouth` at `v0` to fall to height y.
function wbFall(mouth, v0, y) {
  const h = mouth[1] - y;
  const G = WB.gravity;
  return (v0[1] + Math.sqrt(Math.max(0, v0[1] * v0[1] + 2 * G * h))) / G;
}

// The bottle's pose (offset from its pivot, angle about z) at tap time s.
function wbPose(s) {
  const tipIn = ease(seg(s, 0.95, 1.6));
  const tipOut = ease(seg(s, 3.2, 3.75));
  const lift = ease(seg(s, 0.9, 1.35)) * (1 - ease(seg(s, 3.35, 3.8)));
  const a = -WB.tip * tipIn * (1 - tipOut);
  const f = Math.max(tipIn * (1 - tipOut), 0.35 * lift);
  return { offset: [WB.pourOffset[0] * f, WB.pourOffset[1] * f, 0], angle: a };
}

// The pour's own clock: forward while pouring, then backward (everything runs back).
function wbClock(s) {
  const P0 = 1.6;
  const D = WB.pour + WB.fallTime;
  const R0 = 2.85;
  if (s < R0) return clamp(s - P0, 0, D);
  return D * (1 - ease(seg(s, R0, 3.3)));
}

const WATER_BOTTLE = {
  alive: false,
  density: 1.5, // as the Model to splats toy: 300,000 splats on the high tier
  turntable: true,
  controls: [{ key: "pour", label: "Pour", type: "pulse", ease: WB.T }],
  action: { key: "pour", label: "Unscrew and pour" },
  credits: [
    {
      label: "Water bottle",
      title: "Water bottle (cap moved onto the neck)",
      source: "https://sketchfab.com/3d-models/water-bottle-42827e2ce39145eda296e6d6524f4c3d",
      author: "danny_p3d",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  ],
  async prepare() {
    await loadScan("water-bottle");
  },
  drive(t, c, out, info) {
    const on = c.pour > 0;
    const s = on ? (1 - c.pour) * WB.T : 0;
    // The cap: two turns off along the thread, a hop to the table, and back the same way.
    const unscrew = ease(seg(s, 0, 0.6)) * (1 - ease(seg(s, 4.05, 4.5)));
    const away = seg(s, 0.6, 1.0) * (1 - seg(s, 3.7, 4.05));
    const hop = ease(away);
    const arc = 0.32 * Math.sin(Math.PI * away);
    const capOff = [
      WB.capRest[0] * hop,
      0.07 * unscrew * (1 - hop) + WB.capRest[1] * hop + arc,
      WB.capRest[2] * hop,
    ];
    out.parts.cap = {
      quat: quatAxisAngle([0, 1, 0], wrap(4 * Math.PI * unscrew + 1.2 * Math.PI * hop)),
      offset: capOff,
    };
    const pose = wbPose(s);
    out.parts.bottle = { angle: pose.angle, offset: pose.offset };
    // The water, on the pour's clock u: every bit leaves the mouth at its own time e (0 to the
    // pour's length) and falls; the stream is the bits in the air, drawn as overlapping pieces.
    const u = wbClock(s);
    const mouthRel = rotZ([0, WB.mouth[1] - WB.pivot[1], 0], pose.angle);
    const mouth = [WB.pivot[0] + pose.offset[0] + mouthRel[0] + 0.02 * WB.dir[0], WB.pivot[1] + pose.offset[1] + mouthRel[1] - 0.03, 0]; // prettier-ignore
    const v0 = [WB.dir[0] * WB.speed, WB.dir[1] * WB.speed, 0];
    const G = WB.gravity;
    const full = WB.glass.h * WB.level;
    const fillAt = (uu) => clamp((uu - wbFall(mouth, v0, WB.floor + 0.035 + full * 0.5)) / WB.pour, 0, 1); // prettier-ignore
    const level = u > 0 ? fillAt(u) : 0;
    const surf = WB.floor + 0.035 + full * level;
    const T = wbFall(mouth, v0, surf); // seconds from the mouth to the water now
    const at = (tau) => [mouth[0] + v0[0] * tau, mouth[1] + v0[1] * tau - 0.5 * G * tau * tau, 0];
    const vel = (tau) => [v0[0], v0[1] - G * tau, 0];
    const base = info.data?.pieceBase || [0, 0, 0];
    const tokens = [];
    const eLo = Math.max(0, u - T);
    const eHi = Math.min(WB.pour, u);
    for (let i = 0; i < WB.pieces; i++) {
      if (!(u > 0 && eHi > eLo)) {
        tokens.push({ base, offset: [0, 0, 0], visible: 0 });
        continue;
      }
      const e = eLo + ((eHi - eLo) * (i + 0.5)) / WB.pieces;
      const tau = u - e;
      // A gentle glug: the stream thickens and thins a little as air bubbles back in.
      const glug = 1 + 0.12 * Math.sin(2 * Math.PI * (e * 5.5));
      tokens.push(pieceToken(base, at(tau), vel(tau), glug));
    }
    // The splash where the stream meets the water: droplets that hop up and fall back, over and
    // over while it pours.
    const hitting = u > T && u - T < WB.pour + 0.05;
    const hit = at(T);
    for (let j = 0; j < WB.splash; j++) {
      const ph = (j * 0.618034) % 1;
      const w = (u - T + ph * 0.34) % 0.34;
      const a = (j * 2.39996) % (2 * Math.PI);
      const vy = 0.55 + 0.35 * ((j * 0.7548) % 1);
      const vh = 0.18 + 0.2 * ((j * 0.5698) % 1);
      const vj = [Math.cos(a) * vh, vy - G * w, Math.sin(a) * vh];
      const pj = [
        hit[0] + Math.cos(a) * vh * w,
        surf + vy * w - 0.5 * G * w * w,
        Math.sin(a) * vh * w,
      ];
      const up = pj[1] > surf - 0.005;
      tokens.push(pieceToken(base, pj, vj, hitting && up && w > 0.01 ? 0.55 : 0));
    }
    out.tokens = tokens;
    out.morph = [level, 0, 0, 0];
    out.parts.water = { visible: level > 0.002 ? 1 : 0 };
    sortWhileMoving(out, info, s, on && s < 4.5);
  },
  build(k) {
    const scan = SCANS.get("water-bottle");
    const bottle = k.part("bottle", { pivot: WB.pivot, axis: [0, 0, 1] });
    const cap = k.part("cap", { pivot: [0, 0.6, 0], axis: [0, 1, 0] });
    const water = k.part("water", { pivot: [WB.glass.x, WB.floor, 0] });
    addScan(k, scan, { share: 0.8, parts: [bottle, cap] });
    const G = WB.glass;
    const gx = (p) => [p[0] + G.x, p[1], p[2]];
    const rOf = (y) => G.r0 + ((G.r1 - G.r0) * (y - WB.floor)) / G.h;
    // The glass: a thin clear wall (faint splats, brighter toward the silhouette and in two
    // upright streaks of reflected light), a thick base and a bright rim.
    latheCloud(
      k,
      Math.round(k.count * 0.05),
      (v) => [rOf(WB.floor + v * G.h), WB.floor + v * G.h],
      {
        at: (b) => {
          const streak = Math.exp(-(((b.a - 2.2) / 0.1) ** 2)) + 0.6 * Math.exp(-(((b.a - 2.75) / 0.06) ** 2)); // prettier-ignore
          const edge = Math.abs(Math.sin(b.a));
          const w = 0.82 + 0.16 * streak;
          return { ...b, p: gx(b.p), color: [w, w + 0.02, w + 0.04].map((v) => Math.min(1, v)), opacity: 0.1 + 0.08 * (1 - edge) + 0.45 * streak, flat: 0.2 }; // prettier-ignore
        },
      },
    );
    latheCloud(
      k,
      Math.round(k.count * 0.012),
      (v) => (v < 0.5 ? [G.r0 * 0.98 * (v * 2), WB.floor + 0.035] : [G.r0 * (0.98 + 0.02 * (v - 0.5) * 2), WB.floor + 0.035 - 0.035 * (v - 0.5) * 2]), // prettier-ignore
      { at: (b) => ({ ...b, p: gx(b.p), color: [0.7, 0.74, 0.77], opacity: 0.22 }) },
    );
    latheCloud(
      k,
      Math.round(k.count * 0.006),
      (v) => {
        const a = v * Math.PI;
        return [G.r1 - 0.006 + 0.006 * Math.sin(a), WB.glassTop + 0.006 * Math.cos(a)];
      },
      { at: (b) => ({ ...b, p: gx(b.p), color: [0.95, 0.97, 1], opacity: 0.75 }) },
    );
    // The water: built flat on the glass's base and morphed up to the full level on channel 0,
    // which drive() sets to the share of the drops that have landed.
    const top = WB.floor + 0.035 + G.h * WB.level;
    const inner = (y) => rOf(y) - 0.012;
    latheCloud(
      k,
      Math.round(k.count * 0.035),
      (v) => {
        if (v < 0.75) {
          const y = WB.floor + 0.035 + (v / 0.75) * (top - WB.floor - 0.035);
          return [inner(y), y];
        }
        return [inner(top) * (1 - (v - 0.75) / 0.25), top];
      },
      {
        at: (b) => {
          const full = gx(b.p);
          const empty = [full[0], WB.floor + 0.036, full[2]];
          const onTop = b.v >= 0.75;
          const col = onTop ? [0.72, 0.86, 0.95] : [0.5, 0.72, 0.88];
          return { ...b, p: empty, to: full, channel: 0, color: col, opacity: onTop ? 0.8 : 0.5, part: water }; // prettier-ignore
        },
      },
    );
    // The stream's pieces and the splash's droplets: tokens built beside the glass.
    const base = [WB.glass.x, WB.floor + 0.3, 0];
    const liquid = { color: [0.66, 0.82, 0.94], shine: [0.97, 0.99, 1] };
    addLiquidPieces(k, 0, WB.pieces, { base, len: 0.075, r: 0.024, ...liquid });
    addLiquidPieces(k, WB.pieces, WB.splash, { base, len: 0.03, r: 0.009, per: 14, ...liquid });
    k.data.pieceBase = base;
    // The cap's underside, closed with a dark disc (its plug is left out), and the dark opening
    // of the bottle's mouth.
    for (const [y, r, part] of [
      [0.6, 0.162, cap],
      [0.585, 0.128, bottle],
    ]) {
      addCloud(k, Math.round(k.count * 0.004), (i, n) => {
        const rr = r * Math.sqrt((i + 0.5) / n);
        const a = i * 2.39996323;
        return { p: [rr * Math.cos(a), y, rr * Math.sin(a)], n: [0, 1, 0], size: Math.sqrt((r * r) / n) * 1.3, color: [0.07, 0.065, 0.06], part }; // prettier-ignore
      });
    }
    // What the tap reaches: the cap's hop and the tipped bottle's base.
    k.reach([WB.capRest[0] - 0.18, WB.floor, 0]);
    k.reach([-0.75, 0.62, 0]);
    k.reach([0, 1.0, 0]);
  },
};

// ---- Sunglasses ------------------------------------------------------------------------------
// The baked spectacles face +Z: the front (rims, bridge, nose pads) at z 0.6 to 0.67, the arms
// running back to z -0.67; the hinges turn at x ±0.505, z 0.575 (behind the rims). The lenses are kit-built discs in
// the rims (centers x ±0.2996, radius 0.195): a faint clear layer, and a dark gray layer that
// fades in on channel 0, from the rim inward, like light-changing lenses.

const SG = {
  T: 3.5,
  center: [0, 0, 0.3],
  hingeL: [-0.505, 0, 0.575],
  hingeR: [0.505, 0, 0.575],
  lens: { x: 0.2996, z: 0.652, r: 0.197 },
  rest: -0.5, // the glasses rest turned this far about Y (radians)
};

// A part turned by the frame's rotation qF about SG.center (then moved by o), and before that by
// its own rotation qH about its hinge h: the pivot is h, so the offset carries the hinge along.
function childOf(qF, o, h, qH) {
  const c = SG.center;
  const hc = quatRotate(qF, [h[0] - c[0], h[1] - c[1], h[2] - c[2]]);
  return {
    quat: qH ? quatMul(qF, qH) : qF,
    offset: [c[0] + hc[0] + o[0] - h[0], c[1] + hc[1] + o[1] - h[1], c[2] + hc[2] + o[2] - h[2]],
  };
}

const SUNGLASSES = {
  alive: false,
  density: 1.5, // as the Model to splats toy: 300,000 splats on the high tier
  // The clear lenses are faint (0.1 to 0.4): a tap finds them at a lower
  // alpha than the pick pass's usual, so a tap on a lens starts it (lane Fix7).
  pickAlpha: 0.06,
  controls: [{ key: "flip", label: "Fold and flip", type: "pulse", ease: SG.T }],
  action: { key: "flip", label: "Fold, flip and darken" },
  credits: [
    {
      label: "Sunglasses",
      title: "Round Spectacles (lenses left out)",
      source: "https://polyhaven.com/a/round_spectacles",
      author: "Sean Buckley",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
  ],
  async prepare() {
    await loadScan("sunglasses");
  },
  drive(t, c, out, info) {
    const on = c.flip > 0;
    const s = on ? (1 - c.flip) * SG.T : 0;
    // The arms fold one after the other, and unfold at the end in the other order.
    const foldR = ease(seg(s, 0.0, 0.42)) * (1 - ease(seg(s, 2.85, 3.3)));
    const foldL = ease(seg(s, 0.3, 0.72)) * (1 - ease(seg(s, 2.6, 3.05)));
    // The flip: a full turn head over heels while it turns to face you, then back.
    const flip = ease(seg(s, 0.75, 1.55));
    const face = ease(seg(s, 0.75, 1.55)) * (1 - ease(seg(s, 2.55, 3.2)));
    const lift = 0.12 * Math.sin(Math.PI * seg(s, 0.75, 1.55));
    const qF = quatMul(
      quatAxisAngle([0, 1, 0], SG.rest * (1 - face)),
      quatAxisAngle([1, 0, 0], wrap(-2 * Math.PI * flip)),
    );
    const o = [0, lift, 0];
    out.parts.front = childOf(qF, o, SG.center);
    // Folded, the right arm lies just behind the front and the left arm just behind it.
    out.parts.armR = childOf(qF, o, SG.hingeR, quatAxisAngle([0, 1, 0], 1.53 * foldR));
    out.parts.armL = childOf(qF, o, SG.hingeL, quatAxisAngle([0, 1, 0], -1.36 * foldL));
    out.morph = [ease(seg(s, 1.35, 2.05)) * (1 - ease(seg(s, 2.6, 3.3))), 0, 0, 0];
    // No re-sort here: the arms are built reaching back, so in their built order they already
    // draw behind the lenses once folded (re-sorted where they stand, they drew over the lenses).
  },
  build(k) {
    const scan = SCANS.get("sunglasses");
    const front = k.part("front", { pivot: SG.center });
    const armL = k.part("armL", { pivot: SG.hingeL });
    const armR = k.part("armR", { pivot: SG.hingeR });
    addScan(k, scan, { share: 0.78, parts: [front, armL, armR] });
    const L = SG.lens;
    const nLens = Math.round(k.count * 0.05);
    for (const side of [-1, 1]) {
      // A disc of splats (sunflower spiral), bowed a little like a real lens.
      const lens = (i, n, dark) => {
        const r = L.r * Math.sqrt((i + 0.5) / n);
        const a = i * 2.39996323;
        const x = side * L.x + r * Math.cos(a);
        const y = r * Math.sin(a);
        const z = L.z + 0.03 * (1 - (r / L.r) ** 2) + (dark ? 0.004 : 0);
        const size = Math.sqrt((L.r * L.r) / n) * 1.25;
        if (!dark) {
          // Clear: faint, with a soft sheen from the upper left.
          const sheen = Math.exp(-(((x - side * L.x + 0.075) ** 2 + (y - 0.085) ** 2) / 0.0012));
          return { p: [x, y, z], n: [0, 0, 1], size, color: [0.78, 0.82, 0.86], opacity: 0.1 + 0.3 * sheen, part: front }; // prettier-ignore
        }
        const edge = r / L.r;
        const g = 0.1 + 0.05 * (1 - edge) + 0.05 * Math.exp(-(((x - side * L.x + 0.07) ** 2 + (y - 0.08) ** 2) / 0.004)); // prettier-ignore
        return { p: [x, y, z], n: [0, 0, 1], size, color: [g, g * 1.02, g * 1.06], opacity: 0.93, part: front, kind: "fade", params: [0.45 * (1 - edge), -0.55], channel: 0 }; // prettier-ignore
      };
      addCloud(k, nLens, (i, n) => lens(i, n, false));
      addCloud(k, nLens, (i, n) => lens(i, n, true));
      // A few bigger, faint splats over the lens, so a tap on the glass finds
      // it (the lens's own splats are too small and faint for the pick pass).
      addCloud(k, 37, (i, n) => {
        const r = L.r * 0.9 * Math.sqrt((i + 0.5) / n);
        const a = i * 2.39996323;
        const z = L.z + 0.03 * (1 - (r / L.r) ** 2) - 0.002;
        return { p: [side * L.x + r * Math.cos(a), r * Math.sin(a), z], n: [0, 0, 1], size: L.r * 0.3, color: [0.78, 0.82, 0.86], opacity: 0.08, part: front }; // prettier-ignore
      });
    }
    k.reach([0, 0.55, 0.7]);
    k.reach([0, -0.45, -0.2]);
  },
};

// Soft studio light baked into kit colors (as lit() in src/packs/balls.js and the baked models).
const LIGHT = (() => {
  const v = [-0.35, 0.8, 0.5];
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
})();
const VIEW = [0.5, 0.28, 0.82].map((x) => x / Math.hypot(0.5, 0.28, 0.82));
const HALF = (() => {
  const h = [LIGHT[0] + VIEW[0], LIGHT[1] + VIEW[1], LIGHT[2] + VIEW[2]];
  const l = Math.hypot(...h);
  return h.map((x) => x / l);
})();
export function lit(col, n, { soft = 0.22, sheen = 0, tight = 30 } = {}) {
  const d = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
  const f = 1 - soft + soft * (0.5 + 0.5 * d) + soft * 0.1;
  const c = typeof col === "string" ? hexRgb(col) : col;
  const h = sheen * Math.max(0, n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]) ** tight;
  return [0, 1, 2].map((k) => Math.min(1, c[k] * f * (1 - h) + h));
}
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

// ---- Baseball cap ----------------------------------------------------------------------------
// The baked cap: brim toward +Z, crown x ±0.54, z -0.74 to 0.34 (its middle at z -0.2), its
// rim at y -0.37 and its button at y 0.377. It sits on a kit-built wooden stand.

const BC = { T: 3, pivot: [0, -0.05, -0.2], rim: -0.37, base: -1.3 };

const BASEBALL_CAP = {
  alive: false,
  density: 1.5, // as the Model to splats toy: 300,000 splats on the high tier
  controls: [{ key: "toss", label: "Toss", type: "pulse", ease: BC.T }],
  action: { key: "toss", label: "Flip and spin" },
  credits: [
    {
      label: "Baseball cap",
      title: "Baseball Cap",
      source: "https://sketchfab.com/3d-models/baseball-cap-1c1d34d73fd94e6b9e8f82b1eb7194a0",
      author: "Scott VanArsdale",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  ],
  async prepare() {
    await loadScan("baseball-cap");
  },
  drive(t, c, out, info) {
    const on = c.toss > 0;
    const s = on ? (1 - c.toss) * BC.T : 0;
    // 1. Flips up off the stand: rises and turns head over heels once.
    const up = seg(s, 0, 0.42);
    // 2. Spins flat like a flying disc, gliding round a small loop, sinking a little.
    const glide = seg(s, 0.42, 1.4);
    // 3. Lands on the stand brim-backwards (half a turn more than the spin's whole turns).
    const land = seg(s, 1.4, 1.72);
    // 4. A second flip: a hop and a half turn round the right way.
    const hop2 = seg(s, 1.95, 2.6);
    const flip = 2 * Math.PI * ease(up);
    const spinTurns = 3.5;
    const yaw =
      2 * Math.PI * spinTurns * (1 - (1 - glide) ** 1.6) * (glide > 0 ? 1 : 0) +
      Math.PI * ease(hop2);
    const loop = 2 * Math.PI * glide;
    const hLoop = 0.85 - 0.25 * glide;
    let off;
    if (s < 0.42) off = [0, 0.95 * Math.sin((Math.PI / 2) * up), 0];
    else if (s < 1.4) off = [0.32 * Math.sin(loop), hLoop, 0.3 * (1 - Math.cos(loop))];
    else if (s < 1.95) {
      const f = ease(land);
      const bounce = 0.04 * Math.sin(Math.PI * seg(s, 1.72, 1.9));
      off = [0, 0.6 * (1 - f) * (1 - f) + bounce, 0];
    } else off = [0, 0.62 * Math.sin(Math.PI * hop2) + 0.03 * Math.sin(Math.PI * seg(s, 2.6, 2.8)), 0]; // prettier-ignore
    // A slight wobble while it flies, and a tilt as it hops round.
    const wob = 0.12 * Math.sin(Math.PI * glide) * Math.sin(9 * glide);
    const tilt = -0.3 * Math.sin(Math.PI * hop2) ** 2;
    const q = quatMul(
      quatAxisAngle([0, 1, 0], wrap(yaw)),
      quatMul(quatAxisAngle([1, 0, 0], wrap(-flip + tilt)), quatAxisAngle([0, 0, 1], wob)),
    );
    out.parts.cap = { quat: q, offset: off };
    sortWhileMoving(out, info, s, on && s < BC.T, 0.04);
  },
  build(k) {
    const scan = SCANS.get("baseball-cap");
    const cap = k.part("cap", { pivot: BC.pivot });
    addScan(k, scan, { share: 0.78, parts: [cap] });
    // The stand: one turned walnut profile (a round foot, a slim post and a dome that fills the
    // crown), placed evenly (a golden-angle spiral) so its edges stay crisp.
    const zc = -0.2;
    const foot = 0.36;
    const postR = 0.055;
    const H = BC.rim - BC.base;
    // [radius, height] from the foot's middle underneath, round its rim, up the post and over the dome.
    const prof = [
      [0, BC.base - 0.03], [foot - 0.02, BC.base - 0.03], [foot, BC.base - 0.01], [foot, BC.base + 0.015],
      [foot - 0.02, BC.base + 0.03], [postR + 0.05, BC.base + 0.035], [postR + 0.01, BC.base + 0.06],
      [postR, BC.base + 0.1], [postR, BC.rim - 0.02], [postR + 0.03, BC.rim - 0.005], [0.44, BC.rim],
      [0.43, BC.rim + 0.14], [0.38, BC.rim + 0.3], [0.27, BC.rim + 0.46], [0.14, BC.rim + 0.55], [0, BC.rim + 0.58],
    ]; // prettier-ignore
    const lens = [0];
    for (let q = 1; q < prof.length; q++) lens.push(lens[q - 1] + Math.hypot(prof[q][0] - prof[q - 1][0], prof[q][1] - prof[q - 1][1])); // prettier-ignore
    const at = (v) => {
      const L = v * lens[lens.length - 1];
      let q = 1;
      while (q < prof.length - 1 && lens[q] < L) q++;
      const f = (L - lens[q - 1]) / (lens[q] - lens[q - 1] || 1);
      return [prof[q - 1][0] + (prof[q][0] - prof[q - 1][0]) * f, prof[q - 1][1] + (prof[q][1] - prof[q - 1][1]) * f]; // prettier-ignore
    };
    void H;
    latheCloud(k, Math.round(k.count * 0.16), at, {
      at: (b) => {
        // Walnut: fine growth rings round the turned piece, lit from the upper left, a soft sheen.
        const y = b.p[1];
        const ring = 0.5 + 0.5 * Math.sin(y * 140 + 3 * Math.sin(b.a * 3 + y * 9));
        const base = [0.37, 0.235, 0.14].map((v) => v * (0.9 + 0.1 * ring));
        return { ...b, p: [b.p[0], y, b.p[2] + zc], color: lit(base, b.n, { sheen: 0.3, tight: 30 }), flat: 0.15 }; // prettier-ignore
      },
    });
    k.reach([0.5, 1.35, 0.9]);
    k.reach([-0.9, 1.1, -0.9]);
  },
};

// ---- Fountain pen ----------------------------------------------------------------------------
// The baked pen lies along X: nib tip at x -0.972, piston knob at x 0.972, its axis at y -0.031,
// z 0.115, about 0.09 across. The cap (part 1 of the file) covers x -1.018 to -0.073. It lies
// on a kit-built notepad; the tap writes a swirl on it.

const FP = {
  T: 4,
  axis: [0, -0.031, 0.115],
  nib: [-0.972, -0.031, 0.115],
  capC: [-0.545, -0.031, 0.115], // the cap's middle
  post: 0.2835, // posted, the cap is turned half round about x = post on the pen's axis
  paper: -0.132,
  tilt: (34 * Math.PI) / 180,
  yaw: 1.0,
  swirl: { x: -0.3, z: 0.52, turns: 2.1 },
};
// The swirl on the paper, u 0..1: a widening loop that drifts to the right.
function fpSwirl(u) {
  const S = FP.swirl;
  const a = 2 * Math.PI * S.turns * u - 0.6;
  const r = 0.06 + 0.26 * Math.sqrt(u);
  return [S.x + 0.34 * u + r * Math.cos(a), FP.paper + 0.004, S.z + 0.72 * r * Math.sin(a)];
}

function fpPen(s) {
  // The pen's move into the writing pose and out of it, and the nib's point on the swirl.
  const into = ease(seg(s, 1.05, 1.6));
  const outOf = ease(seg(s, 2.85, 3.35));
  const w = into * (1 - outOf);
  const u = seg(s, 1.6, 2.8);
  const P = fpSwirl(ease(u) * 0.08 + u * 0.92);
  const q = quatMul(quatAxisAngle([0, 1, 0], FP.yaw * w), quatAxisAngle([0, 0, 1], FP.tilt * w));
  // Where the nib goes: from rest to the swirl, lifted a little on the way.
  const hover = 0.18 * Math.sin(Math.PI * seg(s, 1.05, 1.6)) + 0.18 * Math.sin(Math.PI * seg(s, 2.85, 3.35)); // prettier-ignore
  const tip = [FP.nib[0] + (P[0] - FP.nib[0]) * w, FP.nib[1] + (P[1] - FP.nib[1]) * w + hover, FP.nib[2] + (P[2] - FP.nib[2]) * w]; // prettier-ignore
  return { q, tip, u };
}

const FOUNTAIN_PEN = {
  alive: false,
  density: 1.5, // as the Model to splats toy: 300,000 splats on the high tier
  controls: [{ key: "write", label: "Write", type: "pulse", ease: FP.T }],
  action: { key: "write", label: "Uncap and write" },
  credits: [
    {
      label: "Fountain pen",
      title: "Fountain pen in translucent green (maker's marks painted out, cap moved)",
      source: "https://sketchfab.com/3d-models/af3606f31c4343859d887049a1908fb0",
      author: "chemicalX",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  ],
  async prepare() {
    await loadScan("fountain-pen");
  },
  drive(t, c, out, info) {
    const on = c.write > 0;
    const s = on ? (1 - c.write) * FP.T : 0;
    const pen = fpPen(s);
    out.parts.pen = { quat: pen.q, offset: [pen.tip[0] - FP.nib[0], pen.tip[1] - FP.nib[1], pen.tip[2] - FP.nib[2]] }; // prettier-ignore
    // The cap in the pen's own frame: off the nib, over to the back end turning half round,
    // and on (posted); then the same way back.
    const off = ease(seg(s, 0, 0.42)) * (1 - ease(seg(s, 3.72, 4)));
    const over = ease(seg(s, 0.42, 0.95)) * (1 - ease(seg(s, 3.3, 3.72)));
    const on2 = ease(seg(s, 0.95, 1.12)) * (1 - ease(seg(s, 3.2, 3.32)));
    const C = FP.capC;
    const postC = 2 * FP.post - C[0]; // the cap's middle when posted
    let cx = C[0] - 0.32 * off;
    cx = cx + (postC + 0.3 - cx) * over - 0.3 * on2;
    const lift = 0.3 * Math.sin(Math.PI * over);
    const local = [cx, C[1] + lift, C[2] + 0.12 * Math.sin(Math.PI * over)];
    const qCap = quatAxisAngle([0, 1, 0], Math.PI * over);
    // Into the pen's frame (it turns about the nib's tip).
    const rel = quatRotate(pen.q, [local[0] - FP.nib[0], local[1] - FP.nib[1], local[2] - FP.nib[2]]); // prettier-ignore
    const world = [pen.tip[0] + rel[0], pen.tip[1] + rel[1], pen.tip[2] + rel[2]];
    out.parts.cap = { quat: quatMul(pen.q, qCap), offset: [world[0] - C[0], world[1] - C[1], world[2] - C[2]] }; // prettier-ignore
    // The ink: wet behind the nib (channel 0), drying darker from the start (channel 1), and
    // running back into the pen at the end.
    const back = ease(seg(s, 3.6, 3.98));
    const wet = pen.u * (1 - back);
    const dry = seg(s, 2.25, 3.3) * (1 - back);
    out.morph = [wet * 1.02, dry * 1.02, 0, 0];
    sortWhileMoving(out, info, s, on && s < FP.T, 0.06);
  },
  build(k) {
    const scan = SCANS.get("fountain-pen");
    const pen = k.part("pen", { pivot: FP.nib });
    const cap = k.part("cap", { pivot: FP.capC });
    addScan(k, scan, { share: 0.75, parts: [pen, cap] });
    // The notepad: a cream sheet with faint blue rules and a red margin, on a thin block.
    const W = 2.3;
    const D = 1.45;
    const pz = 0.28;
    const nPaper = Math.round(k.count * 0.1);
    addCloud(k, nPaper, (i, n) => {
      const x = -W / 2 + W * ((i * 0.7548776662466927) % 1);
      const z = pz - D / 2 + D * ((i * 0.5698402909980532) % 1);
      const size = Math.sqrt((W * D) / (n * Math.PI)) * 1.3;
      return { p: [x, FP.paper, z], n: [0, 1, 0], size, color: lit([0.96, 0.94, 0.88], [0, 1, 0]), flat: 0.15 }; // prettier-ignore
    });
    // The rules and the margin: fine unbroken lines of small splats just above the sheet.
    const rules = [];
    for (let z = pz - D / 2 + 0.2 + 0.065; z < pz + D / 2 - 0.01; z += 0.13) rules.push(z);
    const step = 0.0028 * Math.max(1, Math.sqrt(300000 / k.count)); // about 2.6% of the splats
    const perRule = Math.floor(W / step);
    const perMargin = Math.floor(D / step);
    const nLines = rules.length * perRule + perMargin;
    addCloud(k, nLines, (i) => {
      const r = Math.floor(i / perRule);
      if (r < rules.length) {
        const x = -W / 2 + ((i % perRule) + 0.5) * step;
        return { p: [x, FP.paper + 0.0015, rules[r]], n: [0, 1, 0], size: 1.5 * step, color: lit([0.72, 0.8, 0.92], [0, 1, 0]), flat: 0.15 }; // prettier-ignore
      }
      const z = pz - D / 2 + (i - rules.length * perRule + 0.5) * step;
      return { p: [-W / 2 + 0.3, FP.paper + 0.0015, z], n: [0, 1, 0], size: 1.6 * step, color: lit([0.9, 0.62, 0.62], [0, 1, 0]), flat: 0.15 }; // prettier-ignore
    });
    // The sheets' edges below it.
    addCloud(k, Math.round(k.count * 0.03), (i, n) => {
      const per = 2 * (W + D);
      const f = ((i * 0.7548776662466927) % 1) * per;
      const y = FP.paper - 0.05 * ((i * 0.5698402909980532) % 1);
      let x;
      let z;
      let nn;
      if (f < W) [x, z, nn] = [-W / 2 + f, pz + D / 2, [0, 0, 1]];
      else if (f < W + D) [x, z, nn] = [W / 2, pz + D / 2 - (f - W), [1, 0, 0]];
      else if (f < 2 * W + D) [x, z, nn] = [W / 2 - (f - W - D), pz - D / 2, [0, 0, -1]];
      else [x, z, nn] = [-W / 2, pz - D / 2 + (f - 2 * W - D), [-1, 0, 0]];
      const line = ((y - FP.paper) * 200) % 1 < 0.3 ? 0.86 : 0.93;
      const size = Math.sqrt((per * 0.05) / (n * Math.PI)) * 1.3;
      return {
        p: [x, y, z],
        n: nn,
        size,
        color: lit([line, line * 0.98, line * 0.93], nn),
        flat: 0.2,
      };
    });
    // The ink: a ribbon along the swirl, a wet layer and a dry one just above it.
    const N = 700;
    const pts = [];
    for (let j = 0; j <= N; j++) pts.push(fpSwirl(j / N));
    const width = 0.016;
    const nInk = Math.round(k.count * 0.035);
    for (const layer of [0, 1]) {
      addCloud(k, nInk, (i, n) => {
        const u = (i + 0.5) / n;
        const j = Math.min(N - 1, Math.floor(u * N));
        const a = pts[j];
        const b = pts[j + 1];
        const f = u * N - j;
        const tx = b[0] - a[0];
        const tz = b[2] - a[2];
        const tl = Math.hypot(tx, tz) || 1;
        const side = (((i * 0.618034) % 1) - 0.5) * width * (0.8 + 0.4 * Math.sin(u * 40));
        const p = [a[0] + tx * f - (tz / tl) * side, FP.paper + 0.003 + layer * 0.0025, a[2] + tz * f + (tx / tl) * side]; // prettier-ignore
        const size = 0.009;
        if (layer === 0) {
          const glint = (i * 0.381966) % 1 < 0.08;
          return { p, n: [0, 1, 0], size, color: glint ? [0.62, 0.72, 1] : [0.14, 0.3, 0.86], opacity: 0.95, kind: "fade", params: [u * 0.99, -0.012], channel: 0 }; // prettier-ignore
        }
        return { p, n: [0, 1, 0], size, color: [0.06, 0.1, 0.34], opacity: 0.97, kind: "fade", params: [u * 0.99, -0.012], channel: 1 }; // prettier-ignore
      });
    }
    // The writing pose: the posted pen's end, up and away.
    k.reach([0.9, 1.3, -1.25]);
  },
};

// ---- Soda can --------------------------------------------------------------------------------
// The baked can stands on y -0.794 with radius 0.43; its lid is at y 0.785 with the ring pull's
// rivet at its middle and the tab's nose toward +Z, over the (kit-built) opening. It stands on a
// kit-built cork coaster, where the foam lands.

const SC = {
  T: 3.5,
  floor: -0.794,
  lid: 0.787,
  rivet: [0, 0.787, 0],
  mouth: [0, 0.79, 0.17],
  jet: 22, // the jet: tokens 0..21
  drops: 26, // the spatter: tokens 22..47
  coaster: 0.95,
  spray: [1.0, 1.95], // the jet runs between these tap times
};
const hash = (i, k) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
// The jet's speed and its lean for a bit of foam that leaves the opening at time e: fast at
// first, weakening as the pressure goes, and swaying a little as the foam surges.
function scJet(e) {
  const f = clamp((e - SC.spray[0]) / (SC.spray[1] - SC.spray[0]), 0, 1);
  const up = 3.3 * Math.sqrt(1 - 0.85 * f);
  return [0.25 * Math.sin(e * 9.1) + 0.12, up, 0.2 * Math.sin(e * 7.3 + 1) + 0.18];
}
const SC_G = 7.5;

const SODA_CAN = {
  alive: false,
  density: 1.5, // as the Model to splats toy: 300,000 splats on the high tier
  controls: [{ key: "open", label: "Shake and open", type: "pulse", ease: SC.T }],
  action: { key: "open", label: "Shake and open" },
  credits: [
    {
      label: "Soda can",
      title: "Soda Can (label painted for Splashery)",
      source: "https://sketchfab.com/3d-models/soda-can-f3560f1b73a1498d9313a0f10fd11ef6",
      author: "RoutineStudio",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  ],
  async prepare() {
    await loadScan("soda-can");
  },
  drive(t, c, out, info) {
    const on = c.open > 0;
    const s = on ? (1 - c.open) * SC.T : 0;
    // The shake: quick side-to-side jiggles that grow, then stop.
    const sh = bump(s, 0.02, 0.2, 0.7, 0.88);
    const jig = sh * Math.sin(s * 2 * Math.PI * 9);
    const jig2 = sh * Math.sin(s * 2 * Math.PI * 7 + 1);
    const qCan = quatMul(
      quatAxisAngle([0, 0, 1], 0.07 * jig),
      quatAxisAngle([1, 0, 0], 0.05 * jig2),
    );
    const canOff = [0.03 * jig2, 0.02 * Math.abs(jig), 0];
    out.parts.can = { quat: qCan, offset: canOff };
    // The ring pull levers up with a crack, and folds back later.
    const lever = ease(seg(s, 0.92, 1.05)) * (1 - ease(seg(s, 2.35, 2.75)));
    const qTab = quatMul(qCan, quatAxisAngle([1, 0, 0], 1.25 * lever));
    const rv = SC.rivet;
    const rr = quatRotate(qCan, [rv[0], rv[1] + 0.8, rv[2]]); // the can turns about y -0.8 + ...
    void rr;
    out.parts.tab = { quat: qTab, offset: canOff };
    // The opening shows as the tab's nose pushes the panel in, and closes up again at the end.
    out.morph = [ease(seg(s, 0.95, 1.08)) * (1 - ease(seg(s, 3.0, 3.4))), 0, 0, 0];
    // The jet: foam leaves the opening from spray[0] to spray[1]; every bit flies on its own arc,
    // and the bits in the air are drawn as overlapping pieces along the flow.
    const tokens = [];
    const base = info.data?.clumpBase || [0, 0, 0];
    const M = SC.mouth;
    const arc = (e, tau) => {
      const v = scJet(e);
      return {
        p: [M[0] + v[0] * tau, M[1] + v[1] * tau - 0.5 * SC_G * tau * tau, M[2] + v[2] * tau],
        v: [v[0], v[1] - SC_G * tau, v[2]],
      };
    };
    // A bit is in the air until it falls back to the lid's height.
    const air = (e) => (2 * scJet(e)[1]) / SC_G;
    const eHi = Math.min(SC.spray[1], s);
    let eLo = SC.spray[0];
    while (eLo < eHi && s - eLo > air(eLo)) eLo += 0.005;
    for (let i = 0; i < SC.jet; i++) {
      if (!(on && eHi > eLo)) {
        tokens.push({ base, offset: [0, 0, 0], visible: 0 });
        continue;
      }
      const e = eHi - ((eHi - eLo) * (i + 0.5)) / SC.jet;
      const { p, v } = arc(e, s - e);
      tokens.push(pieceToken(base, p, v, 1));
    }
    // The spatter: drops thrown out wider, landing on the coaster (or the lid) as small flat
    // splashes that fade away at the end.
    for (let j = 0; j < SC.drops; j++) {
      const e = SC.spray[0] + 0.05 + 0.85 * hash(j, 1);
      const tau = s - e;
      const a = 2 * Math.PI * hash(j, 2);
      const vh = 0.35 + 0.5 * hash(j, 3);
      const vy = 1.6 + 1.4 * hash(j, 4);
      const v = [Math.cos(a) * vh, vy, Math.sin(a) * vh];
      if (!on || tau <= 0) {
        tokens.push({ base, offset: [0, 0, 0], visible: 0 });
        continue;
      }
      // When it lands: on the lid inside the can's rim, else on the coaster.
      const land = (y) => (v[1] + Math.sqrt(v[1] * v[1] + 2 * SC_G * (M[1] - y))) / SC_G;
      let tl = land(SC.floor);
      const xz = (t) => [M[0] + v[0] * t, M[2] + v[2] * t];
      let ground = SC.floor;
      if (Math.hypot(...xz(land(SC.lid))) < 0.4) {
        tl = land(SC.lid);
        ground = SC.lid;
      }
      const fade = 1 - smoothstep(2.7, 3.35, s);
      if (tau < tl) {
        const p = [
          M[0] + v[0] * tau,
          M[1] + v[1] * tau - 0.5 * SC_G * tau * tau,
          M[2] + v[2] * tau,
        ];
        tokens.push(pieceToken(base, p, [v[0], v[1] - SC_G * tau, v[2]], 1));
      } else {
        // Landed: it splats flat where it hit and soaks away in a moment.
        const [x, z] = xz(tl);
        const gone = 1 - smoothstep(0, 0.22, tau - tl);
        tokens.push(
          pieceToken(base, [x, ground + 0.006, z], [v[0], 0.02, v[2]], fade * gone * 1.2),
        );
      }
    }
    out.tokens = tokens;
    sortWhileMoving(out, info, s, on && s < SC.T, 0.1);
  },
  build(k) {
    const scan = SCANS.get("soda-can");
    const can = k.part("can", { pivot: [0, SC.floor, 0] });
    const tab = k.part("tab", { pivot: SC.rivet, axis: [1, 0, 0] });
    addScan(k, scan, { share: 0.74, parts: [can, tab] });
    // The opening: a dark rounded slot in front of the rivet, fading in on channel 0 (the panel
    // pushed in), just above the lid.
    addCloud(k, Math.round(k.count * 0.008), (i, n) => {
      const r = Math.sqrt((i + 0.5) / n);
      const a = i * 2.39996323;
      const x = 0.085 * r * Math.cos(a);
      const z = SC.mouth[2] + 0.06 * r * Math.sin(a) * (1 + 0.25 * Math.cos(a));
      const g = 0.05 + 0.06 * r;
      return { p: [x, SC.lid + 0.003, z], n: [0, 1, 0], size: 0.012, color: [g, g * 0.9, g * 0.8], part: can, kind: "fade", params: [0, -0.4], channel: 0 }; // prettier-ignore
    });
    // The coaster: pressed cork, round, just under the can.
    const R = SC.coaster;
    addCloud(k, Math.round(k.count * 0.1), (i, n) => {
      const top = i % 7 !== 0;
      const f = (i + 0.5) / n;
      const a = i * 2.39996323;
      let p;
      let nn;
      if (top) {
        const r = R * Math.sqrt(f);
        p = [r * Math.cos(a), SC.floor - 0.004, r * Math.sin(a)];
        nn = [0, 1, 0];
      } else {
        p = [R * Math.cos(a), SC.floor - 0.004 - 0.05 * ((i * 0.618034) % 1), R * Math.sin(a)];
        nn = [Math.cos(a), 0, Math.sin(a)];
      }
      const h = Math.sin(i * 12.9898) * 43758.5453;
      const g = 0.85 + 0.3 * (h - Math.floor(h));
      const col = lit([0.74 * g, 0.55 * g, 0.36 * g], nn);
      return { p, n: nn, size: Math.sqrt((Math.PI * R * R * 1.2) / (n * Math.PI)) * 1.3, color: col, flat: 0.2 }; // prettier-ignore
    });
    // The jet's pieces (foam: cream with a faint amber) and the spatter's drops (the soda itself).
    const base = [0, SC.lid + 0.3, 0.2];
    addLiquidPieces(k, 0, SC.jet, { base, len: 0.12, r: 0.032, color: [0.97, 0.92, 0.8], shine: [1, 0.99, 0.95], streak: [0.95, 0.72, 0.38], fine: 0.55, opacity: 1 }); // prettier-ignore
    addLiquidPieces(k, SC.jet, SC.drops, { base, len: 0.03, r: 0.009, per: 24, color: [0.97, 0.86, 0.66], shine: [1, 0.97, 0.9], fine: 0.7, opacity: 1 }); // prettier-ignore
    k.data.clumpBase = base;
    k.reach([0, 1.72, 0]);
  },
};

// ---- Running shoe ----------------------------------------------------------------------------
// The baked shoe points its toe to -X (heel at x 0.8, sole at y -0.48); its top eyelets are at
// x 0.12, y 0.1, z -0.29 and 0.19, the lacing's middle at z -0.05. The scan's bow (part 1) is
// left out; two kit-built laces, each a chain of joints (tokens) with the cord between them,
// make the bow, untie, cross and tie again.

const RS = {
  T: 4,
  joints: 22,
  heel: [0.8, -0.48, 0],
  mid: -0.05,
  cord: 0.0085,
  color: [0.17, 0.16, 0.13],
};
// The lace from eyelet A (z -0.29) in each pose; lace B is its mirror across the middle, and
// crosses the other way.
const RS_KEYS = {
  bow: [
    [0.12, 0.1, -0.29],
    [0.11, 0.17, -0.19],
    [0.085, 0.21, -0.07],
    [0.06, 0.27, -0.13],
    [0.08, 0.38, -0.22],
    [0.12, 0.43, -0.28],
    [0.15, 0.37, -0.25],
    [0.12, 0.26, -0.13],
    [0.09, 0.22, -0.02],
    [0.05, 0.19, 0.08],
    [0.03, 0.13, 0.17],
    [0.01, 0.06, 0.22],
  ],
  loose: [
    [0.12, 0.1, -0.29],
    [0.13, 0.13, -0.36],
    [0.13, 0.08, -0.42],
    [0.12, 0.0, -0.45],
    [0.1, -0.08, -0.47],
    [0.08, -0.15, -0.48],
    [0.05, -0.2, -0.49],
    [0.02, -0.24, -0.5],
  ],
  cross: [
    [0.12, 0.1, -0.29],
    [0.12, 0.2, -0.26],
    [0.11, 0.33, -0.17],
    [0.1, 0.42, -0.03],
    [0.09, 0.47, 0.1],
    [0.08, 0.49, 0.2],
    [0.07, 0.49, 0.28],
  ],
};
const mirrorZ = (p) => [p[0], p[1], 2 * RS.mid - p[2]];

// A polyline resampled at n points evenly by length (through a Catmull-Rom curve).
function resample(ctrl, n) {
  const dense = [];
  const P = (i) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  for (let i = 0; i < ctrl.length - 1; i++)
    for (let j = 0; j < 12; j++) {
      const t = j / 12;
      const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
      dense.push([0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t))); // prettier-ignore
    }
  dense.push(ctrl[ctrl.length - 1]);
  const acc = [0];
  for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + Math.hypot(...[0, 1, 2].map((k) => dense[i][k] - dense[i - 1][k]))); // prettier-ignore
  const out = [];
  for (let j = 0; j < n; j++) {
    const L = (acc[acc.length - 1] * j) / (n - 1);
    let i = 1;
    while (i < acc.length - 1 && acc[i] < L) i++;
    const f = (L - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
    out.push([0, 1, 2].map((k) => dense[i - 1][k] + (dense[i][k] - dense[i - 1][k]) * f));
  }
  return out;
}
const RS_SHAPES = (() => {
  const n = RS.joints;
  const A = {};
  const B = {};
  for (const [key, ctrl] of Object.entries(RS_KEYS)) {
    A[key] = resample(ctrl, n);
    // Lace B mirrors A; while crossed it sits a little higher so the two never meet.
    B[key] = resample(ctrl.map(mirrorZ), n).map((p) => (key === "cross" ? [p[0] + 0.035, p[1] + 0.03, p[2]] : p)); // prettier-ignore
  }
  return { A, B };
})();

// The laces' shape at tap time s: bow -> loose -> crossed -> bow, each move lifted a little in
// its middle so the cords clear the shoe.
function rsLace(which, s) {
  const K = RS_SHAPES[which];
  const steps = [
    [0.05, 0.85, "bow", "loose"],
    [0.95, 1.6, "loose", "cross"],
    [1.7, 2.75, "cross", "bow"],
  ];
  let from = K.bow;
  let to = K.bow;
  let f = 0;
  for (const [a, b, k0, k1] of steps) {
    if (s >= a && s < b) {
      from = K[k0];
      to = K[k1];
      f = seg(s, a, b);
    } else if (s >= b && s < 2.75) {
      from = K[k1];
      to = K[k1];
      f = 0;
    }
  }
  const e = ease(f);
  const lift = 0.07 * Math.sin(Math.PI * f);
  return from.map((p, i) => {
    const q = to[i];
    const w = i / (from.length - 1); // the free end swings more
    return [
      p[0] + (q[0] - p[0]) * e,
      p[1] + (q[1] - p[1]) * e + lift * w,
      p[2] + (q[2] - p[2]) * e,
    ];
  });
}

const RUNNING_SHOE = {
  alive: false,
  density: 1.5, // as the Model to splats toy: 300,000 splats on the high tier
  controls: [{ key: "tie", label: "Tie the laces", type: "pulse", ease: RS.T }],
  action: { key: "tie", label: "Untie and tie again" },
  credits: [
    {
      label: "Running shoe",
      title: "PB158 Sneaker Low (photogrammetry scan; its bow left out)",
      source: "https://sketchfab.com/3d-models/pb158-sneaker-low-d1bb68aebb1b4532b026d8eb824d4c15",
      author: "SCANIMAT",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  ],
  async prepare() {
    await loadScan("running-shoe");
  },
  drive(t, c, out, info) {
    const on = c.tie > 0;
    const s = on ? (1 - c.tie) * RS.T : 0;
    // Two toe taps: the toe lifts about the heel and comes down, twice.
    const tap = (a) => Math.sin(Math.PI * seg(s, a, a + 0.42)) ** 2;
    const ang = -0.26 * (tap(2.95) + tap(3.45));
    const q = quatAxisAngle([0, 0, 1], ang);
    out.parts.shoe = { quat: q };
    const H = RS.heel;
    const onShoe = (p) => {
      const r = quatRotate(q, [p[0] - H[0], p[1] - H[1], p[2] - H[2]]);
      return [H[0] + r[0], H[1] + r[1], H[2] + r[2]];
    };
    const tokens = [];
    for (const [w, key] of [
      [0, "A"],
      [1, "B"],
    ]) {
      const now = on ? rsLace(key, s) : RS_SHAPES[key].bow;
      const rest = RS_SHAPES[key].bow;
      for (let i = 0; i < RS.joints; i++) {
        const p = onShoe(now[i]);
        tokens[w * RS.joints + i] = { base: rest[i], offset: [p[0] - rest[i][0], p[1] - rest[i][1], p[2] - rest[i][2]] }; // prettier-ignore
      }
    }
    out.tokens = tokens;
    const d = info.data;
    if (d) {
      const slot = on ? Math.floor(s / 0.1) : -1;
      if (slot !== d.slot) {
        out.resort = true;
        d.slot = slot;
      }
    }
    sortWhileMoving(out, info, s, on && s > 2.9 && s < RS.T, 0.1);
  },
  build(k) {
    const scan = SCANS.get("running-shoe");
    const shoe = k.part("shoe", { pivot: RS.heel, axis: [0, 0, 1] });
    addScan(k, scan, { share: 0.82, parts: [shoe, shoe], keep: (fp) => fp === 0 });
    // The laces: round splats along each chain, each following the two joints it lies between.
    const n = RS.joints;
    const per = Math.max(30, Math.round((k.count * 0.05) / (2 * (n - 1))));
    for (const [w, key] of [
      [0, "A"],
      [1, "B"],
    ]) {
      const P = RS_SHAPES[key].bow;
      addCloud(k, (n - 1) * per, (i) => {
        const j = Math.floor(i / per);
        const f = ((i % per) + 0.5) / per;
        const a = P[j];
        const b = P[j + 1];
        const g = ((i * 0.618034) % 1) * 2 * Math.PI;
        // Round the cord: a frame across the segment, so the splats ring it evenly.
        const t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const tl = Math.hypot(...t) || 1;
        const tn = t.map((v) => v / tl);
        let u = [tn[1] * 0 - tn[2] * 1, tn[2] * 0 - tn[0] * 0, tn[0] * 1 - tn[1] * 0]; // t x y
        const ul = Math.hypot(...u) || 1;
        u = u.map((v) => v / ul);
        const v = [
          tn[1] * u[2] - tn[2] * u[1],
          tn[2] * u[0] - tn[0] * u[2],
          tn[0] * u[1] - tn[1] * u[0],
        ];
        const r = RS.cord * 0.6;
        const p = [0, 1, 2].map((k2) => a[k2] + (b[k2] - a[k2]) * f + r * (Math.cos(g) * u[k2] + Math.sin(g) * v[k2])); // prettier-ignore
        // A braided cord: fine twisted strands, lit from above.
        const along = (j + f) * tl;
        const braid = Math.sin(2 * g + along * 260) > 0.2 ? 1.18 : 0.92;
        const shade = (0.82 + 0.3 * Math.max(0, Math.sin(g))) * braid;
        return { p, size: RS.cord * 0.7, color: RS.color.map((c) => Math.min(1, c * shade)), skin: [w * n + j, w * n + j + 1, f] }; // prettier-ignore
      });
    }
    k.reach([0.1, 0.6, 0]);
    k.reach([0.1, -0.3, -0.55]);
  },
};

// ---- Hoodie ----------------------------------------------------------------------------------
// The baked hoodie faces +Z with its hood up (part 1, from y 0.26 to 0.83) and its sleeves
// (parts 2 and 3, cut off at the shoulders by a hard plane) hanging at its sides down to y
// -0.83. Its thin drawstrings (parts 4 and 5 of the file) are swapped for kit-built cords that
// swing.

const HD = {
  T: 4.5,
  // The hood's hinge runs across the neck's sides: nodding forward tucks its low front edge into
  // the chest and opens only a small gap at the back of the neck.
  neck: [0, 0.33, 0],
  hoodNod: 0.4, // how far the hood flops forward (radians)
  armpit: -0.1, // the lowest point of an armhole
  shoulderL: [-0.36, 0.17, -0.06],
  shoulderR: [0.36, 0.17, -0.06],
  // Where each sleeve points when crossed (the left one over the right).
  crossL: [0.47, 0.28, 0.84],
  crossR: [-0.45, 0.05, 0.89],
  strings: [
    { top: [-0.024, 0.342, 0.172], len: 0.26 },
    { top: [0.022, 0.337, 0.158], len: 0.24 },
  ],
};

// A damped swing that starts at `a` and dies away by the end.
const swing = (s, a, amp, w = 11, k = 2.2) =>
  s < a ? 0 : amp * Math.sin(w * (s - a)) * Math.exp(-k * (s - a)) * (1 - smoothstep(3.9, 4.45, s));

const HOODIE = {
  alive: false,
  density: 1.5, // as the Model to splats toy: 300,000 splats on the high tier
  controls: [{ key: "flip", label: "Flip the hood", type: "pulse", ease: HD.T }],
  action: { key: "flip", label: "Hood flip and cross the sleeves" },
  credits: [
    {
      label: "Hoodie",
      title: "Hoodie (drawstrings and inside label left out)",
      source: "https://sketchfab.com/3d-models/hoodie-97611a53e3b846f69e0655b210f72b2f",
      author: "Virtual Pandora",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  ],
  async prepare() {
    await loadScan("hoodie");
  },
  drive(t, c, out, info) {
    const on = c.flip > 0;
    const s = on ? (1 - c.flip) * HD.T : 0;
    // The hood flops forward, then flips back up with a little overshoot.
    const down = ease(seg(s, 0, 0.55));
    const up = seg(s, 0.6, 1.25);
    const over = 0.14 * Math.sin(Math.PI * seg(s, 1.05, 1.55));
    out.parts.hood = { angle: HD.hoodNod * down * (1 - ease(up)) - over * (s > 1.05 ? 1 : 0) };
    // The sleeves swing in and cross, hold, and swing back out with a little sway.
    const inL = ease(seg(s, 1.2, 2.05)) * (1 - ease(seg(s, 2.95, 3.75)));
    const inR = ease(seg(s, 1.35, 2.2)) * (1 - ease(seg(s, 2.85, 3.65)));
    const sway = swing(s, 3.7, 0.12, 9, 3);
    // Up and forward first, and inward only once raised, so a sleeve never cuts across the body.
    const toward = (dir, f) => {
      const up = smoothstep(0, 0.65, f);
      const inward = smoothstep(0.45, 1, f);
      return quatFromTo([0, -1, 0], [dir[0] * inward, -1 + (dir[1] + 1) * up, dir[2] * up]);
    };
    out.parts.sleeveL = { quat: quatMul(quatAxisAngle([0, 0, 1], sway), toward(HD.crossL, inL)) };
    out.parts.sleeveR = { quat: quatMul(quatAxisAngle([0, 0, 1], -sway), toward(HD.crossR, inR)) };
    // The drawstrings swing, kicked by the hood and again by the sleeves.
    const kick = (ph) => swing(s, 0.05, 0.55, 10, 2.4) + swing(s, 1.2, 0.3 * ph, 9, 2) + swing(s, 2.95, 0.3, 9, 2); // prettier-ignore
    out.parts.stringL = { quat: quatMul(quatAxisAngle([0, 0, 1], kick(1)), quatAxisAngle([1, 0, 0], -0.6 * kick(0.6))) }; // prettier-ignore
    out.parts.stringR = { quat: quatMul(quatAxisAngle([0, 0, 1], 0.8 * kick(-1)), quatAxisAngle([1, 0, 0], -0.5 * kick(0.8))) }; // prettier-ignore
    sortWhileMoving(out, info, s, on && s < HD.T, 0.08);
  },
  build(k) {
    const scan = SCANS.get("hoodie");
    const hood = k.part("hood", { pivot: HD.neck, axis: [1, 0, 0] });
    const sleeveL = k.part("sleeveL", { pivot: HD.shoulderL });
    const sleeveR = k.part("sleeveR", { pivot: HD.shoulderR });
    const stringL = k.part("stringL", { pivot: HD.strings[0].top });
    const stringR = k.part("stringR", { pivot: HD.strings[1].top });
    addScan(k, scan, { share: 0.86, parts: [0, hood, sleeveL, sleeveR], keep: (fp) => fp < 4 });
    // The armholes: each is closed with fabric that follows the opening's own outline (the
    // sleeve's splats that touch the body, above the armpit, laid flat on the plane that fits
    // them best), one patch on the body and one on the sleeve's top, so a raised sleeve shows
    // cloth at the shoulder and under the arm, not the inside of the garment.
    const cell = 0.015;
    const grid = new Map();
    const key = (x, y, z) =>
      `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    const P = (i) => [scan.pos[i * 3], scan.pos[i * 3 + 1], scan.pos[i * 3 + 2]];
    for (let i = 0; i < scan.n; i++) {
      const [x, y, z] = P(i);
      if (scan.part[i] !== 0 || y < HD.armpit - 0.05 || Math.abs(x) < 0.15) continue;
      const g = key(x, y, z);
      if (!grid.has(g)) grid.set(g, []);
      grid.get(g).push(i);
    }
    const touches = ([x, y, z]) => {
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++)
            for (const j of grid.get(key(x + dx * cell, y + dy * cell, z + dz * cell)) || []) {
              const q = P(j);
              if ((q[0] - x) ** 2 + (q[1] - y) ** 2 + (q[2] - z) ** 2 < 0.012 ** 2) return true;
            }
      return false;
    };
    for (const [side, sleeve, fp] of [
      [-1, sleeveL, 2],
      [1, sleeveR, 3],
    ]) {
      const rim = [];
      for (let i = 0; i < scan.n; i++) {
        if (scan.part[i] !== fp || scan.pos[i * 3 + 1] < HD.armpit) continue;
        const p = P(i);
        if (touches(p)) rim.push([p, i]);
      }
      if (rim.length < 20) continue;
      // The best plane x = a y + b z + d (least squares), its normal toward the sleeve.
      const c = [0, 1, 2].map((q) => rim.reduce((t, [p]) => t + p[q], 0) / rim.length);
      let syy = 0;
      let syz = 0;
      let szz = 0;
      let sxy = 0;
      let sxz = 0;
      for (const [p] of rim) {
        const [x, y, z] = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
        [syy, syz, szz, sxy, sxz] = [syy + y * y, syz + y * z, szz + z * z, sxy + x * y, sxz + x * z]; // prettier-ignore
      }
      const det = syy * szz - syz * syz || 1;
      const ca = (sxy * szz - sxz * syz) / det;
      const cb = (sxz * syy - sxy * syz) / det;
      const nl = Math.hypot(1, ca, cb);
      const nrm = [side / nl, (-ca * side) / nl, (-cb * side) / nl];
      const z = [-nrm[2] * nrm[0], -nrm[2] * nrm[1], 1 - nrm[2] * nrm[2]]; // +Z, in the plane
      const e2 = z.map((q) => q / Math.hypot(...z));
      const e1 = [nrm[1] * e2[2] - nrm[2] * e2[1], nrm[2] * e2[0] - nrm[0] * e2[2], nrm[0] * e2[1] - nrm[1] * e2[0]]; // prettier-ignore
      const bins = 48;
      const rad = new Float32Array(bins);
      const dot = (p, e) => (p[0] - c[0]) * e[0] + (p[1] - c[1]) * e[1] + (p[2] - c[2]) * e[2];
      for (const [p] of rim) {
        const u = dot(p, e1);
        const v = dot(p, e2);
        const k2 = Math.floor(((Math.atan2(v, u) / (2 * Math.PI) + 1) % 1) * bins);
        rad[k2] = Math.max(rad[k2], Math.hypot(u, v));
      }
      for (let pass = 0; pass < bins; pass++)
        for (let j = 0; j < bins; j++) if (!rad[j]) rad[j] = Math.max(rad[(j + bins - 1) % bins], rad[(j + 1) % bins]); // prettier-ignore
      const col = [0, 1, 2].map((q) => rim.reduce((t, [, i]) => t + scan.rgb[i * 3 + q], 0) / rim.length); // prettier-ignore
      const area = rad.reduce((t, r) => t + (Math.PI * r * r) / bins, 0);
      const n = Math.round(k.count * 0.008);
      const size = Math.sqrt(area / (n * Math.PI)) * 1.3;
      for (const [part, off, face] of [
        [0, -0.004, 1],
        [sleeve, 0.004, -1],
      ]) {
        addCloud(k, n, (i) => {
          const f = Math.sqrt((i + 0.5) / n);
          const t = i * 2.39996323;
          const r = f * rad[Math.floor(((t / (2 * Math.PI)) % 1) * bins)] * 0.97;
          const [u, v] = [r * Math.cos(t), r * Math.sin(t)];
          const p = [0, 1, 2].map((q) => c[q] + u * e1[q] + v * e2[q] + off * nrm[q]);
          return { p, n: nrm.map((q) => q * face), size, color: col.map((q) => q * (0.86 + 0.1 * f)), part }; // prettier-ignore
        });
      }
    }
    // The drawstrings: flat cotton cords hanging from the neck, with plastic tips.
    for (const [j, part] of [
      [0, stringL],
      [1, stringR],
    ]) {
      const S = HD.strings[j];
      const n = Math.round(k.count * 0.006);
      addCloud(k, n, (i) => {
        const f = (i + 0.5) / n;
        const g = ((i * 0.618034) % 1) * 2 * Math.PI;
        const tip = f > 0.9;
        const r = tip ? 0.0075 : 0.0062;
        const y = S.top[1] - S.len * f;
        const p = [S.top[0] + r * Math.cos(g) + 0.004 * Math.sin(f * 7), y, S.top[2] + r * Math.sin(g) * 0.6 + 0.01 * f]; // prettier-ignore
        const sh = 0.8 + 0.35 * Math.max(0, Math.cos(g - 0.8));
        const col = tip ? [0.12, 0.12, 0.13] : [0.8, 0.76, 0.64];
        return { p, size: 0.006, color: col.map((v) => Math.min(1, v * sh)), part };
      });
    }
    k.reach([0, 0.62, -0.6]);
    k.reach([0.4, -0.3, 0.75]);
    k.reach([-0.4, -0.3, 0.75]);
  },
};

export const RECIPES = {
  "water-bottle": WATER_BOTTLE,
  sunglasses: SUNGLASSES,
  "baseball-cap": BASEBALL_CAP,
  "fountain-pen": FOUNTAIN_PEN,
  "soda-can": SODA_CAN,
  "running-shoe": RUNNING_SHOE,
  hoodie: HOODIE,
};

void mix;
