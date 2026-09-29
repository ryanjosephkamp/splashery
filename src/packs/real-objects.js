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
      opacity: 0.97,
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
  drops: 40,
  flight: 0.32, // seconds from the mouth to the water
  pour: 1.15, // seconds of pouring
  level: 0.52, // the glass fills to this share of its height
};
WB.glassTop = WB.floor + WB.glass.h;
// Where the mouth goes while it pours: just over the glass's rim, a little in from its middle.
WB.pourMouth = [WB.glass.x - 0.06, WB.glassTop + 0.22, 0];
{
  const rel = rotZ([0, WB.mouth[1] - WB.pivot[1], 0], -WB.tip);
  WB.pourOffset = [WB.pourMouth[0] - rel[0] - WB.pivot[0], WB.pourMouth[1] - rel[1] - WB.pivot[1], 0]; // prettier-ignore
}
// The cap rests on the table to the left of the bottle while it pours.
WB.capRest = [-0.62, WB.floor - 0.376 + 0.004, 0.1];
// A drop's time of emission (seconds into the pour): five glugs of eight drops.
WB.emit = (i) => {
  const glug = Math.floor(i / 8);
  return glug * 0.17 + (i % 8) * 0.022 + 0.03 * Math.sin(i * 2.3);
};

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
  const D = WB.pour + WB.flight;
  const R0 = 2.85;
  if (s < R0) return clamp(s - P0, 0, D);
  return D * (1 - ease(seg(s, R0, 3.3)));
}

const WATER_BOTTLE = {
  alive: false,
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
      quat: quatAxisAngle([0, 1, 0], 4 * Math.PI * unscrew + 1.2 * Math.PI * hop),
      offset: capOff,
    };
    const pose = wbPose(s);
    out.parts.bottle = { angle: pose.angle, offset: pose.offset };
    // The drops, from the mouth to the water, on the pour's clock.
    const u = wbClock(s);
    const mouthRel = rotZ([0, WB.mouth[1] - WB.pivot[1], 0], pose.angle);
    const mouth = [WB.pivot[0] + pose.offset[0] + mouthRel[0], WB.pivot[1] + pose.offset[1] + mouthRel[1], 0]; // prettier-ignore
    let landed = 0;
    const surf = WB.floor + 0.035 + WB.glass.h * WB.level;
    const tokens = [];
    for (let i = 0; i < WB.drops; i++) {
      const e = WB.emit(i);
      const tau = u - e;
      const g = (2 * (mouth[1] - surf)) / (WB.flight * WB.flight);
      const x = mouth[0] + 0.12 * tau + 0.015 * Math.sin(i * 1.7);
      const y = mouth[1] - 0.02 - 0.5 * g * tau * tau;
      const z = 0.02 * Math.sin(i * 2.9);
      const inAir = tau > 0 && tau < WB.flight;
      if (tau >= WB.flight) landed++;
      const b = info.data?.dropBase || [0, 0, 0];
      tokens.push({ base: b, offset: [x - b[0], y - b[1], z - b[2]], visible: inAir ? 1 : 0 });
    }
    out.tokens = tokens;
    // The water in the glass rises with the drops that have landed.
    const level = landed / WB.drops;
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
          return { ...b, p: gx(b.p), color: [w, w + 0.02, w + 0.04], opacity: 0.1 + 0.08 * (1 - edge) + 0.45 * streak, flat: 0.2 }; // prettier-ignore
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
    // The drops: each a token, a small round bead built at the middle of its fall.
    const base = [WB.pourMouth[0] + 0.05, (WB.pourMouth[1] + WB.floor) / 2, 0];
    const per = Math.max(8, Math.round((k.count * 0.012) / WB.drops));
    addCloud(k, WB.drops * per, (i) => {
      const d = Math.floor(i / per);
      const j = i % per;
      const a = j * 2.39996;
      const r = 0.022 * Math.sqrt((j + 0.5) / per);
      const y = (j / per - 0.5) * 0.05;
      return {
        p: [base[0] + r * Math.cos(a), base[1] + y, base[2] + r * Math.sin(a)],
        size: 0.014,
        color: j % 5 === 0 ? [0.9, 0.96, 1] : [0.55, 0.76, 0.92],
        opacity: 0.85,
        kind: "token",
        params: [d, 0],
      };
    });
    k.data.dropBase = base;
    // What the tap reaches: the cap's hop and the tipped bottle's base.
    k.reach([WB.capRest[0] - 0.18, WB.floor, 0]);
    k.reach([-0.75, 0.62, 0]);
    k.reach([0, 1.0, 0]);
  },
};

// ---- Sunglasses ------------------------------------------------------------------------------
// The baked spectacles face +Z: the front (rims, bridge, nose pads) at z 0.6 to 0.67, the arms
// running back to z -0.67 from hinges at x ±0.505, z 0.623. The lenses are kit-built discs in
// the rims (centers x ±0.2996, radius 0.195): a faint clear layer, and a dark gray layer that
// fades in on channel 0, from the rim inward, like light-changing lenses.

const SG = {
  T: 3.5,
  center: [0, 0, 0.3],
  hingeL: [-0.505, 0, 0.623],
  hingeR: [0.505, 0, 0.623],
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
      quatAxisAngle([1, 0, 0], -2 * Math.PI * flip),
    );
    const o = [0, lift, 0];
    out.parts.front = childOf(qF, o, SG.center);
    // Folded, the right arm lies just behind the front and the left arm just behind it.
    out.parts.armR = childOf(qF, o, SG.hingeR, quatAxisAngle([0, 1, 0], 1.5 * foldR));
    out.parts.armL = childOf(qF, o, SG.hingeL, quatAxisAngle([0, 1, 0], -1.46 * foldL));
    out.morph = [ease(seg(s, 1.35, 2.05)) * (1 - ease(seg(s, 2.6, 3.3))), 0, 0, 0];
    sortWhileMoving(out, info, s, on && s < SG.T, 0.06);
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
          return { p: [x, y, z], n: [0, 0, 1], size, color: [0.9, 0.93, 0.95], opacity: 0.035 + 0.3 * sheen, part: front }; // prettier-ignore
        }
        const edge = r / L.r;
        const g = 0.1 + 0.05 * (1 - edge) + 0.05 * Math.exp(-(((x - side * L.x + 0.07) ** 2 + (y - 0.08) ** 2) / 0.004)); // prettier-ignore
        return { p: [x, y, z], n: [0, 0, 1], size, color: [g, g * 1.02, g * 1.06], opacity: 0.93, part: front, kind: "fade", params: [0.45 * (1 - edge), -0.55], channel: 0 }; // prettier-ignore
      };
      addCloud(k, nLens, (i, n) => lens(i, n, false));
      addCloud(k, nLens, (i, n) => lens(i, n, true));
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
      quatAxisAngle([0, 1, 0], yaw),
      quatMul(quatAxisAngle([1, 0, 0], -flip + tilt), quatAxisAngle([0, 0, 1], wob)),
    );
    out.parts.cap = { quat: q, offset: off };
    sortWhileMoving(out, info, s, on && s < BC.T, 0.04);
  },
  build(k) {
    const scan = SCANS.get("baseball-cap");
    const cap = k.part("cap", { pivot: BC.pivot });
    addScan(k, scan, { share: 0.78, parts: [cap] });
    // The stand: a turned walnut dome that fills the crown, on a post and a round foot.
    const wood = (c, f = 1) => {
      const g = 0.5 + 0.5 * Math.sin(c.lp[1] * 90 + 6 * c.noise(c.lp[0] * 3, c.lp[1] * 3, c.lp[2] * 3)); // prettier-ignore
      const base = [0.36 * f, 0.23 * f, 0.14 * f].map((v) => v * (0.88 + 0.12 * g));
      return lit(base, c.n, { sheen: 0.25, tight: 24 });
    };
    const domeA = 2 * Math.PI * 0.48 * 0.5; // about the dome's area (a half ellipsoid)
    addSolid(k, k.ellipsoid(0.47, 0.6, 0.5), domeA * 1.4, Math.round(k.count * 0.05), {
      pos: [0, BC.rim, -0.2],
      color: (c) => (c.lp[1] < 0 ? null : wood(c)),
    });
    addSolid(k, k.disc(0.47), Math.PI * 0.47 * 0.5, Math.round(k.count * 0.012), {
      pos: [0, BC.rim, -0.2],
      scale: [1, 1, 1.06],
      color: (c) => wood(c, 0.8),
    });
    const postH = BC.rim - BC.base;
    addSolid(
      k,
      k.cylinder(0.055, postH, { caps: false }),
      2 * Math.PI * 0.055 * postH,
      Math.round(k.count * 0.02),
      {
        // prettier-ignore
        pos: [0, (BC.rim + BC.base) / 2, -0.2],
        color: (c) => wood(c),
      },
    );
    addSolid(
      k,
      k.cylinder(0.36, 0.06, { caps: true }),
      2 * Math.PI * 0.36 * 0.42,
      Math.round(k.count * 0.04),
      {
        // prettier-ignore
        pos: [0, BC.base, -0.2],
        color: (c) => wood(c),
      },
    );
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
    addScan(k, scan, { share: 0.72, parts: [pen, cap] });
    // The notepad: a cream sheet with faint blue rules and a red margin, on a thin block.
    const W = 2.3;
    const D = 1.45;
    const pz = 0.28;
    const nPaper = Math.round(k.count * 0.16);
    addCloud(k, nPaper, (i, n) => {
      const x = -W / 2 + W * ((i * 0.7548776662466927) % 1);
      const z = pz - D / 2 + D * ((i * 0.5698402909980532) % 1);
      const rule = Math.abs(((z - pz + 10) % 0.13) - 0.065) < 0.0045 && z > pz - D / 2 + 0.2;
      const margin = Math.abs(x + W / 2 - 0.3) < 0.005;
      let col = [0.96, 0.94, 0.88];
      if (rule) col = [0.72, 0.8, 0.92];
      if (margin) col = [0.9, 0.62, 0.62];
      const size = Math.sqrt((W * D) / (n * Math.PI)) * 1.3;
      return { p: [x, FP.paper, z], n: [0, 1, 0], size, color: lit(col, [0, 1, 0]), flat: 0.15 };
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
  clumps: 48,
  coaster: 0.95,
};
// Each foam clump's launch: time (s into the tap), speed up, spread direction and speed.
function scLaunch(i) {
  const h = (k) => {
    const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    t0: 1.02 + 0.95 * (i / SC.clumps) ** 1.3 + 0.03 * h(1),
    up: 3.1 - 1.4 * (i / SC.clumps) + 0.5 * h(2),
    dir: 2 * Math.PI * h(3),
    out: 0.35 + 0.55 * h(4),
    size: 0.7 + 0.6 * h(5),
  };
}
const SC_G = 7.5;

const SODA_CAN = {
  alive: false,
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
    // The foam: clumps shoot up from the opening, fall round the can and fizz away.
    const tokens = [];
    const base = info.data?.clumpBase || [0, 0, 0];
    for (let i = 0; i < SC.clumps; i++) {
      const L = scLaunch(i);
      const tau = s - L.t0;
      let p = SC.mouth;
      let vis = 0;
      if (on && tau > 0) {
        // Up, out and down to the coaster (or the can's lid), then it lies there.
        const vx = Math.cos(L.dir) * L.out;
        const vz = Math.sin(L.dir) * L.out;
        let y = SC.mouth[1] + L.up * tau - 0.5 * SC_G * tau * tau;
        let x = SC.mouth[0] + vx * tau;
        let z = SC.mouth[2] + vz * tau;
        const r = Math.hypot(x, z);
        const ground = r < 0.43 ? SC.lid : SC.floor;
        if (y < ground && L.up * tau - 0.5 * SC_G * tau * tau < 0) {
          // Landed: find when, and stay there.
          const disc = L.up * L.up + 2 * SC_G * (SC.mouth[1] - SC.floor);
          const tl = (L.up + Math.sqrt(disc)) / SC_G;
          x = SC.mouth[0] + vx * tl;
          z = SC.mouth[2] + vz * tl;
          y = Math.hypot(x, z) < 0.43 ? SC.lid : SC.floor;
        }
        p = [x, y, z];
        vis = L.size * (1 - smoothstep(2.75, 3.4, s)) * smoothstep(0, 0.06, tau);
      }
      tokens.push({ base, offset: [p[0] - base[0], p[1] - base[1], p[2] - base[2]], visible: vis });
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
    // The foam clumps: tokens, each a small heap of bubbles, built beside the can's top.
    const base = [0, SC.lid + 0.3, 0.2];
    const per = Math.max(10, Math.round((k.count * 0.03) / SC.clumps));
    addCloud(k, SC.clumps * per, (i) => {
      const d = Math.floor(i / per);
      const j = i % per;
      const a = j * 2.39996;
      const r = 0.032 * Math.sqrt((j + 0.5) / per);
      const y = 0.03 * Math.cos((j / per) * Math.PI);
      const w = 0.93 + 0.07 * Math.sin(j * 3.1 + d);
      return {
        p: [base[0] + r * Math.cos(a), base[1] + y, base[2] + r * Math.sin(a)],
        size: 0.016 + 0.01 * ((j * 0.618) % 1),
        color: [w, w * 0.97, w * 0.9],
        opacity: 0.92,
        kind: "token",
        params: [d, 0],
      };
    });
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
  cord: 0.0115,
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
    const per = Math.max(20, Math.round((k.count * 0.035) / (2 * (n - 1))));
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
        const r = RS.cord * 0.55;
        const p = [0, 1, 2].map((k2) => a[k2] + (b[k2] - a[k2]) * f);
        p[0] += r * Math.cos(g);
        p[1] += r * Math.sin(g) * 0.7;
        p[2] += r * Math.sin(g) * 0.7;
        const shade = 0.85 + 0.3 * Math.max(0, Math.sin(g));
        return { p, size: RS.cord * 0.9, color: RS.color.map((v) => v * shade), skin: [w * n + j, w * n + j + 1, f] }; // prettier-ignore
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
  neck: [0, 0.3, -0.13], // the hood's hinge, at the back of the neck
  shoulderL: [-0.36, 0.17, -0.06],
  shoulderR: [0.36, 0.17, -0.06],
  // Where each sleeve points when crossed (the left one over the right).
  crossL: [0.56, -0.5, 0.66],
  crossR: [-0.57, -0.6, 0.56],
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
    // The hood flips back off the head and down, then up again with a little overshoot.
    const down = ease(seg(s, 0, 0.55));
    const up = seg(s, 0.6, 1.25);
    const over = 0.14 * Math.sin(Math.PI * seg(s, 1.05, 1.55));
    out.parts.hood = { angle: -1.95 * down * (1 - ease(up)) + over * (s > 1.05 ? 1 : 0) };
    // The sleeves swing in and cross, hold, and swing back out with a little sway.
    const inL = ease(seg(s, 1.2, 2.05)) * (1 - ease(seg(s, 2.95, 3.75)));
    const inR = ease(seg(s, 1.35, 2.2)) * (1 - ease(seg(s, 2.85, 3.65)));
    const sway = swing(s, 3.7, 0.12, 9, 3);
    const toward = (dir, f) =>
      quatFromTo([0, -1, 0], [dir[0] * f, -1 + (dir[1] + 1) * f, dir[2] * f]);
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
