// Lane Photoreal r3: rigs for the Photoreal r2 captures (src/packs/photoreal-r2.js), spread into
// RIGS in src/rigs.js. Each one closes the toy's underside with hard-edged, kit-built pieces (never
// by smearing the capture): a floor under a captured mat or patch of ground, a foot under a pot or
// a vase, a slab under a steak, or a solid core just inside a thin shell, which only shows where
// the capture is thin. Where the capture's own underside is a smear or a fringe of needles, a flat
// region hides it and the kit-built floor takes its place. All in world coordinates, measured with
// tools/pr3-measure.mjs and tools/pr3-under.mjs (docs/audits/bases-2026-10.md, "Photoreal r2
// toys").

import { mix, shade } from "../kit.js";
import { evenEllipsoid } from "./even.js";
import { PR3_BASES as B } from "./photoreal-r3-bases.js";

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const band = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const since = (c, key, secs) => (c[key] > 0 ? (1 - c[key]) * secs : -1);
const pulse = (key, label, ease) => ({ key, label, type: "pulse", ease });

// The light from the upper left, as the kit toys fake it.
const LIGHT = [-0.45, 0.8, 0.55];
const lit = (col, n, amb = 0.72, dif = 0.3) =>
  shade(col, amb + dif * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]));

// ---- The hop a capture without a rig has (src/motion.js, hopAt) -----------------------------
// A rig replaces it, so until a toy has its own effect, its rig hops it the same way: a bounce
// with a peak of 1 that falls by e^2 each landing, with a squash as it lands.
const HOP_SECS = 1.45;
function hopAt(t, e = 0.55, period = 0.62) {
  let start = 0;
  let dur = period;
  let amp = 1;
  for (let k = 0; k < 8; k++) {
    if (t < start + dur) {
      const f = (t - start) / dur;
      const edge = Math.min(f, 1 - f) * dur;
      const squash = amp * (0.22 * Math.exp(-((edge / 0.05) ** 2)) - 0.06 * Math.sin(Math.PI * f));
      return { h: amp * 4 * f * (1 - f), squash };
    }
    start += dur;
    dur *= e;
    amp *= e * e;
    if (amp < 0.01) break;
  }
  return null;
}
const hopDrive = (c, out) => {
  const e = since(c, "hop", HOP_SECS);
  const hop = e < 0 ? null : hopAt(e);
  if (hop) out.body = { offset: [0, hop.h * 0.5, 0], squash: hop.squash };
};

// ---- Kit-built undersides --------------------------------------------------------------------

// An outline as radii at even angles round a center (from +x toward +z), smoothed a little and
// with empty sectors filled from their neighbors; r(a) interpolates it.
function outline(radii, smooth = 1, max = Infinity) {
  const n = radii.length;
  let r = radii.map((v) => (v > max ? 0 : v));
  for (let i = 0; i < n; i++) {
    if (r[i] > 0) continue;
    let a = 1;
    while (r[(i - a + n) % n] <= 0 && a < n) a++;
    let b = 1;
    while (r[(i + b) % n] <= 0 && b < n) b++;
    r[i] = (r[(i - a + n) % n] * b + r[(i + b) % n] * a) / (a + b);
  }
  for (let s = 0; s < smooth; s++)
    r = r.map((v, i) => (r[(i - 1 + n) % n] + 2 * v + r[(i + 1) % n]) / 4);
  return (a) => {
    const f = ((((a / TAU) * n) % n) + n) % n;
    const i = Math.floor(f);
    const t = f - i;
    return r[i] * (1 - t) + r[(i + 1) % n] * t;
  };
}

// A flat, closed floor under a captured mat or patch of ground: the outline filled on a sunflower
// spiral (an even grid of rings shows a ripple), in two layers a hair apart, the upper one turned
// so its splats fall in the lower one's gaps (one layer lets the toy above show through). The
// color is a function of the point (x, z) and the kit's noise.
function floor(k, { center, y, radii, rect, scale = 1, smooth = 1, max, count, color, part }) {
  const [cx, cz] = center;
  const r = radii && outline(radii, smooth, max);
  const area = rect
    ? 4 * rect.half[0] * rect.half[1] * scale * scale
    : radii.reduce((s, v) => s + v * v, 0) * (Math.PI / radii.length) * scale * scale;
  const half = Math.round(count / 2);
  const size = Math.sqrt(area / half) * 1.05;
  // A rectangle (a board or a mat) on a grid of cells, one splat in each.
  const cols = rect ? Math.max(1, Math.round(Math.sqrt((half * rect.half[0]) / rect.half[1]))) : 0;
  const rows = rect ? Math.ceil(half / cols) : 0;
  const [ca, sa] = rect ? [Math.cos(rect.angle), Math.sin(rect.angle)] : [1, 0];
  for (const [dy, turn] of [
    [0, 0],
    [0.01, 1.3],
  ])
    k.cloud({ share: half / k.count, pattern: false, part }, (rand, i, n) => {
      let x;
      let z;
      let f;
      if (rect) {
        const u = (((i % cols) + 0.5 + turn * 0.38) / cols) * 2 - 1;
        const v = ((Math.floor(i / cols) + 0.5 + turn * 0.38) / rows) * 2 - 1;
        const [hu, hv] = [
          rect.half[0] * scale * Math.min(1, u),
          rect.half[1] * scale * Math.min(1, v),
        ];
        x = rect.center[0] + hu * ca - hv * sa;
        z = rect.center[1] + hu * sa + hv * ca;
        f = Math.max(Math.abs(u), Math.abs(v));
      } else {
        f = Math.sqrt((i + 0.5) / n);
        const a = i * 2.399963229728653 + turn;
        const rad = f * r(a) * scale;
        x = cx + rad * Math.cos(a);
        z = cz + rad * Math.sin(a);
      }
      return {
        p: [x, (typeof y === "function" ? y(x, z) : y) + dy, z],
        n: [0, -1, 0],
        flat: 0.2,
        jitter: 0,
        opacity: 1,
        size: size / 0.01,
        color: color(x, z, f, k.noise),
      };
    });
}

// A solid core: an even ellipsoid of opaque splats, colored by c (its normal and point).
function core(k, at, r, color, { grid = 64, part, size = 1.2, rot } = {}) {
  k.add(evenEllipsoid(k, r[0], r[1], r[2], grid), {
    even: true,
    opacity: 1,
    jitter: 0.02,
    pos: at,
    rot,
    part,
    flat: 0.5,
    size,
    pattern: false,
    color: typeof color === "function" ? color : (c) => lit(color, c.n, 0.8, 0.2),
  });
}

// Materials for floors, as color(x, z, f, noise): f is how far out the point is (0 at the center,
// 1 at the edge).
const fbm = (noise, x, z, s, o = 3) => noise.fbm(x * s, 0.37, z * s, o);
const MATERIALS = {
  // Felt, cloth or a rug: the color with a soft, fine mottle.
  cloth:
    (col, amount = 0.06) =>
    (x, z, f, noise) =>
      shade(col, 0.86 + amount * fbm(noise, x, z, 9) + 0.04 * fbm(noise, x, z, 40, 2)),
  // Molded plastic: an even color, a little darker toward the rim.
  plastic: (col) => (x, z, f, noise) =>
    shade(col, 0.92 - 0.06 * f * f + 0.03 * fbm(noise, x, z, 6)),
  // Woven straw, cane or linen: fine crossing threads along x and z.
  weave:
    (col, pitch = 0.035, amount = 0.12) =>
    (x, z, f, noise) => {
      const u = Math.sin((x / pitch) * Math.PI);
      const v = Math.sin((z / pitch) * Math.PI);
      const over = Math.sin(((x + z) / pitch) * Math.PI) > 0 ? u : v;
      return shade(col, 0.84 + amount * over + 0.05 * fbm(noise, x, z, 8));
    },
  // The underside of a patch of earth: soil in blotches at a few scales, small stones, and fine
  // root threads.
  earth: (a = "#5b4430", b = "#7a6047") => {
    const stones = MATERIALS.gravel(["#8a8178", "#6f675f", "#9b8f80", "#5e5650"], 34);
    return (x, z, f, noise) => {
      const m = band(fbm(noise, x, z, 5) + 0.5 * fbm(noise, x, z, 17, 2), -0.4, 0.5);
      const col = shade(mix(a, b, m), 0.7 + 0.22 * band(fbm(noise, x, z, 60, 1), -0.5, 0.5));
      const pebble = fbm(noise, x + 3.1, z, 11, 2);
      if (pebble > 0.33) return stones(x, z, f, noise);
      const root = Math.abs(Math.sin(x * 23 + 6 * noise.fbm(x * 2, z * 2, 1.7, 2)));
      if (root < 0.035 && fbm(noise, x, z, 4) > 0.05) return shade("#a08665", 0.78);
      return col;
    };
  },
  // A board of sawn planks along dir: dark gaps between them, each plank its own tint, and grain
  // that wanders.
  planks:
    (a, b, dir = [1, 0], width = 0.16) =>
    (x, z, f, noise) => {
      const along = x * dir[0] + z * dir[1];
      const across = -x * dir[1] + z * dir[0];
      const i = Math.floor(across / width);
      const t = across / width - i;
      if (t < 0.04 || t > 0.97) return shade(b, 0.35);
      const h = Math.sin(i * 91.7) * 4375.85;
      const tint = 0.86 + 0.14 * (h - Math.floor(h));
      const grain =
        0.5 + 0.5 * Math.sin(across * 90 + 3 * noise.fbm(along * 1.5, i * 3.3, 0.4, 3) + along * 2);
      return shade(
        mix(a, b, 0.25 + 0.5 * grain ** 3),
        tint * (0.85 + 0.08 * fbm(noise, x, z, 40, 2)),
      );
    },
  // The end of a sawn log: growth rings round (cx, cz), with a ring of bark at the rim.
  rings:
    (cx, cz, R, a = "#d8c3a5", b = "#a07e5c", bark = "#4b3626") =>
    (x, z, f, noise) => {
      const d = Math.hypot(x - cx, z - cz) / R;
      const ang = Math.atan2(z - cz, x - cx);
      if (d > 0.94 + 0.02 * Math.sin(ang * 7))
        return shade(bark, 0.7 + 0.12 * fbm(noise, x, z, 30));
      // Rings a little off center and uneven in width, as a real trunk grows.
      const w =
        Math.pow(d, 0.85) * 26 +
        1.8 * noise.fbm(x * 2.2, z * 2.2, 0.2, 3) +
        0.6 * Math.sin(ang * 3 + 1);
      const g = Math.pow(0.5 + 0.5 * Math.sin(w * Math.PI), 6);
      // A few drying cracks running out from the heart.
      const crack =
        Math.abs(Math.sin(ang * 5 + 0.7 * noise.fbm(d * 3, 0.3, 0.9, 2))) < 0.02 &&
        d > 0.15 &&
        d < 0.8;
      const col = mix(a, b, 0.75 * g + 0.25 * band(fbm(noise, x, z, 5), -0.4, 0.5));
      return shade(col, crack ? 0.45 : 0.86 + 0.06 * fbm(noise, x, z, 40, 2));
    },
  // Soil and leaf litter: two browns in blotches a few splats across, with darker specks.
  soil: (a, b) => (x, z, f, noise) => {
    const m = band(fbm(noise, x, z, 7), -0.25, 0.35);
    const speck = fbm(noise, x, z, 38, 2) > 0.32 ? 0.7 : 1;
    return shade(mix(a, b, m), 0.75 * speck);
  },
  // Gravel: rounded stones (cells of a jittered grid) of a few grays, darker between them.
  gravel:
    (cols, s = 26) =>
    (x, z, f, noise) => {
      const gx = Math.floor(x * s);
      const gz = Math.floor(z * s);
      let best = 9;
      let id = 0;
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          const h = Math.sin((gx + i) * 127.1 + (gz + j) * 311.7) * 43758.5453;
          const jx = h - Math.floor(h);
          const h2 = Math.sin((gx + i) * 269.5 + (gz + j) * 183.3) * 43758.5453;
          const jz = h2 - Math.floor(h2);
          const d = Math.hypot(x * s - (gx + i + jx), z * s - (gz + j + jz));
          if (d < best) {
            best = d;
            id = Math.floor(jx * 997 + jz * 131);
          }
        }
      const col = cols[id % cols.length];
      return shade(col, best > 0.55 ? 0.55 : 0.8 - 0.25 * best);
    },
  // Sawn wood: grain along the direction (dx, dz), the rings wavy with the noise.
  wood:
    (a, b, dir = [1, 0], freq = 60) =>
    (x, z, f, noise) => {
      const along = x * dir[0] + z * dir[1];
      const across = -x * dir[1] + z * dir[0];
      const w = across * freq + 2.2 * noise.fbm(along * 2, across * 6, 0.5, 3);
      const g = 0.5 + 0.5 * Math.sin(w);
      return shade(mix(a, b, g ** 3), 0.8 + 0.06 * fbm(noise, x, z, 30, 2));
    },
};

// A floor from a measured outline (src/packs/photoreal-r3-bases.js), a little inside it so the
// floor's edge doesn't show past the capture's rim.
const measured = (name, y, color, scale = 0.96, max) => ({ center: B[name].center, radii: B[name].radii, y, color, scale, max }); // prettier-ignore

// The capture below a kit-built floor at y, hidden: a wide, flat slab whose top stays within a
// hair of y across the floor (an ellipsoid's top drops by about H d^2 / 2 R^2 at d from its
// center), and a deep one under it for anything hanging lower. R limits how far out it reaches.
const below = (cx, cz, y, R = 3) => [
  { at: [cx, y - 0.12, cz], r: [R, 0.12, R], soft: 0.02 },
  { at: [cx, y - 0.9, cz], r: [R * 0.9, 0.66, R * 0.9], soft: 0.02 },
];

// A rig for a toy that only needs its base closed: the add-on, the hidden regions, and the hop
// every capture without a rig has.
function based({ count, build, hide }) {
  if (hide && !hide.length) hide = null;
  return {
    addon: { count, build },
    parts: hide ? [{ name: "under", pivot: [0, -1, 0], regions: hide }] : [],
    controls: [pulse("hop", "Hop", HOP_SECS)],
    action: { key: "hop", label: "Hop" },
    drive(t, c, out) {
      if (hide) out.parts.under = { visible: 0 };
      hopDrive(c, out);
    },
  };
}

// The dog plush's woven mat, closed underneath (its rig is lane Fix9's, in src/rigs.js).
export const DOG_MAT_Y = -0.315;
export const dogMatHide = () =>
  below(B["dog-plush"].center[0], B["dog-plush"].center[1], DOG_MAT_Y);
export function dogMat(k, count) {
  floor(k, {
    ...measured("dog-plush", DOG_MAT_Y, MATERIALS.weave("#a58460", 0.03, 0.1), 0.95),
    count,
  });
}

// A toy on a captured mat or patch of ground: one or more floors, and the capture below them
// hidden (unless a floor says keep: it sits just under the capture's lowest splats instead).
function grounded(count, floors) {
  return based({
    count,
    hide: floors.flatMap((f) => (f.keep ? [] : below(f.center[0], f.center[1], f.y, f.reach ?? 3))),
    build(k) {
      const size = (f) => (f.rect ? (4 / Math.PI) * f.rect.half[0] * f.rect.half[1] : Math.max(...f.radii) ** 2) * (f.scale ?? 1) ** 2; // prettier-ignore
      const area = floors.reduce((s, f) => s + size(f), 0);
      for (const f of floors) floor(k, { ...f, count: (count * size(f)) / area });
    },
  });
}

export const PR3_RIGS = {
  // The toy T. rex stands on a lime plastic disc; from below, its fringe smeared green.
  "toy-trex": grounded(30000, [{ center: [-0.05, 0.01], y: -0.885, radii: [0.93], color: MATERIALS.plastic("#b9cf4a") }]), // prettier-ignore
  // The BMX bicycle stands on a round gray rug.
  "bmx-bike": grounded(40000, [
    measured("bmx-bike", -0.49, MATERIALS.cloth("#a9a6a2", 0.08), 0.95),
  ]),
  // The monkey doll sits on a cream linen cloth.
  "monkey-doll": grounded(40000, [measured("monkey-doll", -0.915, MATERIALS.weave("#ddd4c6", 0.014, 0.05))]), // prettier-ignore
  // The mushroom grows in a patch of forest floor; underneath, the earth it was cut from.
  "mushroom-photo": grounded(40000, [
    measured("mushroom-photo", -0.24, MATERIALS.earth("#5e4632", "#806249"), 1),
  ]),
  // The cactus stands in a ring of gravel on earth.
  "cactus-real": grounded(36000, [measured("cactus-real", -0.87, MATERIALS.earth("#4f4a44", "#6d665e"), 0.95)]), // prettier-ignore
  // The golden maple's raised bed: earth under its wooden frame.
  "maple-tree": grounded(44000, [measured("maple-tree", -0.8, MATERIALS.earth(), 0.96)]),
  // The bonsai stands on a board of planks.
  "bonsai-photo": grounded(44000, [{ center: [0.23, -0.24], rect: { center: [0.23, -0.24], angle: 0.849, half: [1, 0.66] }, scale: 0.97, y: -0.9, color: MATERIALS.planks("#bcae9b", "#8c7c69", [0.66, 0.75]) }]), // prettier-ignore
  // The cherry trees stand on five round patches of earth.
  "cherry-blossom-photo": grounded(44000, [
    [0.164, 0.741, 0.29, -0.23],
    [-0.495, 0.047, 0.4, -0.335],
    [0.397, -0.098, 0.5, -0.27],
    [-0.71, -0.686, 0.17, -0.282],
    [0.004, -0.711, 0.31, -0.295],
  ].map(([x, z, r, y]) => ({ center: [x, z], y, radii: [r], color: MATERIALS.earth(), keep: true }))), // prettier-ignore
  // The desk globe stands on a slice of a log: its sawn end, with growth rings, underneath.
  "desk-globe": grounded(40000, [{ center: [-0.2, 0.06], y: -0.74, radii: [0.96], color: MATERIALS.rings(-0.18, 0.04, 0.96) }]), // prettier-ignore
};
