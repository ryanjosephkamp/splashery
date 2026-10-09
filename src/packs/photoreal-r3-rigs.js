// Lane Photoreal r3: rigs for the Photoreal r2 captures (src/packs/photoreal-r2.js), spread into
// RIGS in src/rigs.js. Each one closes the toy's underside with hard-edged, kit-built pieces (never
// by smearing the capture): a floor under a captured mat or patch of ground, a foot under a pot or
// a vase, a slab under a steak, or a solid core just inside a thin shell, which only shows where
// the capture is thin. Where the capture's own underside is a smear or a fringe of needles, a flat
// region hides it and the kit-built floor takes its place. All in world coordinates, measured with
// tools/pr3-measure.mjs and tools/pr3-under.mjs (docs/audits/bases-2026-10.md, "Photoreal r2
// toys").

import { mix, shade, quatAxisAngle, quatRotate, quatMul } from "../kit.js";
import { evenEllipsoid } from "./even.js";
import { PR3_BASES as B } from "./photoreal-r3-bases.js";

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const band = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const since = (c, key, secs) => (c[key] > 0 ? (1 - c[key]) * secs : -1);
const pulse = (key, label, ease) => ({ key, label, type: "pulse", ease });
const ease = (x) => x * x * (3 - 2 * x);
const bump = (x, a, b) => Math.sin(Math.PI * band(x, a, b));
// A damped wobble that starts at 0 and rings down.
const ring = (e, k = 4, w = 14) => (e < 0 ? 0 : Math.exp(-e * k) * Math.sin(e * w));
const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
// Per-tap variety: a small hash of the tap count.
const vary = (tap, salt = 0) => {
  let h = ((tap?.n ?? 0) * 374761393 + salt * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h % 1000) / 1000;
};

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

// ---- Whole-object motions (the effects) ------------------------------------------------------
// Each returns a rigid transform { quat, offset }: for the whole toy (out.body, which turns about
// the world origin) or for a part (which turns about its pivot: pass the pivot as `about`). A
// capture moves only as a solid piece; nothing here bends it.

const qa = (axis, ang) => quatAxisAngle(unit(axis), ang);
// A turn q about point p, as a transform about `origin` (the world origin for the body, the
// part's pivot for a part).
function turnAbout(q, p, origin = [0, 0, 0]) {
  const r = sub(p, origin);
  return { quat: q, offset: sub(r, quatRotate(q, r)) };
}
const lift = (t, dy) => ({
  quat: t.quat,
  offset: add(t.offset, Array.isArray(dy) ? dy : [0, dy, 0]),
});
const still = { quat: [0, 0, 0, 1], offset: [0, 0, 0] };

const MOTIONS = {
  // Tossed up, it turns once round about an axis through its middle and lands, with a small
  // bounce (the heart donut twirls about the upright: its underside was never captured).
  toss:
    ({ center, axis, height = 0.55, secs = 1.0 }) =>
    (e) => {
      const f = band(e, 0, secs);
      const h = height * 4 * f * (1 - f) + 0.03 * Math.abs(ring(e - secs, 7, 18));
      return lift(turnAbout(qa(axis, TAU * ease(f)), center), h);
    },
  // Flipped over and back, like a steak turned with tongs: lifted, turned half over about its
  // long axis, laid down on its other side, then turned back.
  flip:
    ({ center, axis, height = 0.45 }) =>
    (e) => {
      const ang = Math.PI * (ease(band(e, 0.05, 0.85)) + ease(band(e, 1.95, 2.75)));
      const h =
        height * (bump(e, 0, 0.9) + bump(e, 1.9, 2.8)) + 0.02 * Math.abs(ring(e - 0.9, 8, 20));
      return lift(turnAbout(qa(axis, ang), center), h);
    },
  // Rocks about a level axis through a point on its underside, ringing down (a boat on water, a
  // loaf set down).
  rock:
    ({ pivot, axis, amp = 0.12, k = 1.6, w = 7, drop = 0 }) =>
    (e, info) => {
      const sign = vary(info?.tap, 3) < 0.5 ? 1 : -1;
      const ang = sign * amp * Math.exp(-e * k) * Math.sin(e * w) * band(e, 0, 0.08);
      const h = drop ? drop * bump(e, 0, 0.5) : 0;
      return lift(turnAbout(qa(axis, ang), pivot), h);
    },
  // Knocked, it tips onto the rim of its round base and rolls round on it, the lean dying away,
  // then drops back flat (as the real tin can does): a vase, a pot, a figure on its base.
  wobble:
    ({ base, r, lean = 0.16 }) =>
    (e, info, origin) => {
      const l = lean * ease(band(e, 0, 0.14)) * Math.exp(-e * 0.9) * (1 - ease(band(e, 1.9, 2.3)));
      const round = TAU * vary(info?.tap, 7) + e * 7 + e * e * 2.2;
      const d = [Math.cos(round), 0, Math.sin(round)];
      const rim = add(base, [r * d[0], 0, r * d[2]]);
      return turnAbout(qa(cross([0, 1, 0], d), l), rim, origin);
    },
  // Turns on an axis through a point (a globe, a crystal shown round, a shell).
  spin: ({ center, axis = [0, 1, 0], turns = 1, secs = 2.6 }) => (e, info, origin) =>
    turnAbout(qa(axis, (vary(info?.tap, 5) < 0.5 ? 1 : -1) * TAU * turns * ease(band(e, 0, secs))), center, origin), // prettier-ignore
  // Rolls along the table and back like a ball (the orange): it turns as far as it travels.
  roll:
    ({ center, R, dir = [1, 0, 0], dist = 0.7, secs = 2.6 }) =>
    (e, info) => {
      const sgn = vary(info?.tap, 11) < 0.5 ? 1 : -1;
      const s = sgn * dist * Math.sin(Math.PI * ease(band(e, 0, secs)));
      const d = unit(dir);
      return lift(turnAbout(qa(cross([0, 1, 0], d), -s / R), center), [d[0] * s, 0, d[2] * s]);
    },
  // Hops twice and turns to look at you, then back (a bird, an elephant).
  hopTurn:
    ({ center, turn = 0.6, height = 0.18 }) =>
    (e, info) => {
      const sgn = vary(info?.tap, 13) < 0.5 ? 1 : -1;
      const yaw = sgn * turn * (ease(band(e, 0.05, 0.5)) - ease(band(e, 1.4, 1.9)));
      const h = height * (bump(e, 0.05, 0.45) + 0.8 * bump(e, 1.45, 1.85));
      return lift(turnAbout(qa([0, 1, 0], yaw), center), h);
    },
  // Rocks back on the back edge of its base and forward again (the knight's horse rears).
  rear:
    ({ pivot, axis, amp = 0.28 }) =>
    (e) => {
      const ang =
        amp * ease(band(e, 0, 0.45)) * (1 - ease(band(e, 0.75, 1.15))) -
        0.03 * ring(e - 1.15, 6, 22);
      return turnAbout(qa(axis, ang), pivot);
    },
  // Looks one way, then the other, then back (the lioness's head).
  look:
    ({ pivot, amp = 0.35, nod = 0.08 }) =>
    (e, info) => {
      const sgn = vary(info?.tap, 17) < 0.5 ? 1 : -1;
      const yaw =
        sgn * amp * (ease(band(e, 0, 0.6)) - 2 * ease(band(e, 0.9, 1.6)) + ease(band(e, 1.9, 2.5)));
      const q = quatMul(qa([0, 1, 0], yaw), qa([0, 0, 1], -nod * bump(e, 0, 2.5)));
      return turnAbout(q, pivot);
    },
  // Lifted a little and let fall: it lands with a soft thud and rocks to rest (a loaf, a patch of
  // ground).
  drop:
    ({ pivot, axis, height = 0.22, amp = 0.05 }) =>
    (e, info) => {
      const up = 0.28;
      const fall = Math.sqrt((2 * height) / 4.9);
      const h =
        e < up ? height * ease(e / up) : Math.max(0, height - 0.5 * 9.8 * 0.5 * (e - up) ** 2);
      const land = up + fall;
      const sign = vary(info?.tap, 19) < 0.5 ? 1 : -1;
      return lift(turnAbout(qa(axis, sign * amp * ring(e - land, 3.5, 13)), pivot), h);
    },
  // Walks a few steps forward and back, swaying (the turtle).
  crawl:
    ({ heading, dist = 0.18, sway = 0.05 }) =>
    (e) => {
      const s = dist * Math.sin(Math.PI * ease(band(e, 0, 2.8)));
      const yaw = sway * Math.sin(e * 9) * bump(e, 0, 2.8);
      const d = unit(heading);
      return lift(turnAbout(qa([0, 1, 0], yaw), [0, 0, 0]), [d[0] * s, 0, d[2] * s]);
    },
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
// thick: three layers of slightly larger splats instead of two, for a floor nothing shows through
// (the owner's notes of October 9, 2026).
function floor(
  k,
  { center, y, radii, rect, scale = 1, smooth = 1, max, count, color, part, thick = false },
) {
  const [cx, cz] = center;
  const r = radii && outline(radii, smooth, max);
  const area = rect
    ? 4 * rect.half[0] * rect.half[1] * scale * scale
    : radii.reduce((s, v) => s + v * v, 0) * (Math.PI / radii.length) * scale * scale;
  const layers = thick
    ? [
        [0, 0],
        [0.008, 1.3],
        [0.016, 2.6],
      ]
    : [
        [0, 0],
        [0.01, 1.3],
      ];
  const half = Math.round(count / layers.length);
  const size = Math.sqrt(area / half) * (thick ? 1.3 : 1.05);
  // A rectangle (a board or a mat) on a grid of cells, one splat in each.
  const cols = rect ? Math.max(1, Math.round(Math.sqrt((half * rect.half[0]) / rect.half[1]))) : 0;
  const rows = rect ? Math.ceil(half / cols) : 0;
  const [ca, sa] = rect ? [Math.cos(rect.angle), Math.sin(rect.angle)] : [1, 0];
  for (const [dy, turn] of layers)
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

// The lower part of a ball (below y = cut), on an even spiral of opaque splats facing out, colored
// by color(x, z, f, noise) (f = how far down, 0 at the cut, 1 at the bottom).
function cap(k, { center, R, cut, count, color, part }) {
  const [cx, cy, cz] = center;
  const t0 = clamp((cut - cy) / R, -1, 1); // the cut's height on the unit ball
  const share = count / k.count;
  const area = TAU * R * R * (1 + t0);
  const size = Math.sqrt(area / count) * 1.1;
  k.cloud({ share, pattern: false, part }, (rand, i, n) => {
    const t = -1 + ((i + 0.5) / n) * (1 + t0); // even in height, so even in area
    const r = Math.sqrt(1 - t * t);
    const a = i * 2.399963229728653;
    const nrm = [r * Math.cos(a), t, r * Math.sin(a)];
    const x = cx + R * nrm[0];
    const z = cz + R * nrm[2];
    return {
      p: [x, cy + R * t, z],
      n: nrm,
      flat: 0.2,
      jitter: 0,
      opacity: 1,
      size: size / 0.01,
      color: color(x, z, (t0 - t) / (1 + t0), k.noise),
    };
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
  // The colors of the toy's own top at each point (a grid from tools/pr3-under.mjs --top), a
  // little darker: an underside that matches the top, as a steak seared on both sides.
  mirror:
    (top, dark = 0.8) =>
    (x, z) => {
      const a = clamp(Math.floor((x - top.x0) / top.G), 0, top.nx - 1);
      const c = clamp(Math.floor((z - top.z0) / top.G), 0, top.nz - 1);
      // The nearest cell that has a color, searching outward a few cells.
      for (let r = 0; r < 6; r++)
        for (let dc = -r; dc <= r; dc++)
          for (let da = -r; da <= r; da++) {
            if (Math.max(Math.abs(da), Math.abs(dc)) !== r) continue;
            const aa = a + da;
            const cc = c + dc;
            if (aa < 0 || cc < 0 || aa >= top.nx || cc >= top.nz) continue;
            const h = top.cols.substr((cc * top.nx + aa) * 3, 3);
            if (h !== "000") return shade("#" + h[0] + h[0] + h[1] + h[1] + h[2] + h[2], dark);
          }
      return shade("#4a2416", dark);
    },
  // The foot of a glazed pot: glaze, then an unglazed ring it stands on, and a drainage hole.
  potFoot:
    (cx, cz, R, glaze, clay = "#c9b8a2") =>
    (x, z, f, noise) => {
      const d = Math.hypot(x - cx, z - cz) / R;
      if (d < 0.13) return shade("#2a221c", 0.7 + 0.2 * d);
      if (d > 0.72 && d < 0.86) return shade(clay, 0.8 + 0.08 * fbm(noise, x, z, 40, 2));
      return shade(glaze, 0.86 + 0.04 * fbm(noise, x, z, 9) - 0.08 * band(d, 0.86, 1));
    },
  // The thick glass bottom of a vase: pale and cool, brighter in rings where the glass thickens,
  // with a darker rim.
  glassFoot:
    (cx, cz, R, col = "#b9d3d8") =>
    (x, z, f, noise) => {
      const d = Math.hypot(x - cx, z - cz) / R;
      const ring =
        Math.exp(-(((d - 0.82) / 0.05) ** 2)) + 0.5 * Math.exp(-(((d - 0.3) / 0.08) ** 2));
      return mix(shade(col, 0.8 - 0.25 * band(d, 0.9, 1) + 0.03 * fbm(noise, x, z, 12)), "#f2fbfc", 0.45 * ring); // prettier-ignore
    },
  // Dark stone with pale specks (the alum crystal's block).
  stone:
    (col, speck = "#9a9894") =>
    (x, z, f, noise) => {
      const n = fbm(noise, x, z, 55, 2);
      if (n > 0.38) return shade(speck, 0.85);
      return shade(col, 0.8 + 0.12 * fbm(noise, x, z, 8));
    },
  // Cast pewter: gray metal, mottled, a little darker in the hollows.
  pewter: (col = "#8d9396") => (x, z, f, noise) => shade(col, 0.78 + 0.14 * fbm(noise, x, z, 14) + 0.05 * fbm(noise, x, z, 60, 2)), // prettier-ignore
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
  // Orange peel: the orange's color, a little uneven, with its fine pores (small, darker pits
  // on a jittered grid) and a paler blossom end at the bottom.
  peel:
    (col = "#ee8f1c") =>
    (x, z, f, noise) => {
      const s = 60;
      let best = 9;
      const [gx, gz] = [Math.floor(x * s), Math.floor(z * s)];
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          const h = Math.sin((gx + i) * 127.1 + (gz + j) * 311.7) * 43758.5453;
          const h2 = Math.sin((gx + i) * 269.5 + (gz + j) * 183.3) * 43758.5453;
          best = Math.min(best, Math.hypot(x * s - (gx + i + h - Math.floor(h)), z * s - (gz + j + h2 - Math.floor(h2)))); // prettier-ignore
        }
      const pit = best < 0.22 ? 0.82 : 1;
      const end = f > 0.93 ? mix(col, "#c9a35a", 0.6 * band(f, 0.93, 1)) : col;
      return shade(end, pit * (0.86 + 0.08 * fbm(noise, x, z, 6) + 0.04 * fbm(noise, x, z, 25, 2)));
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
      const w = across * freq + 1.2 * noise.fbm(along * 0.7, across * 4, 0.5, 3);
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
function based({ count, build, hide, motion, secs = 3, label = "Hop" }) {
  if (hide && !hide.length) hide = null;
  return {
    addon: count ? { count, build } : undefined,
    parts: hide ? [{ name: "under", pivot: [0, -1, 0], regions: hide }] : [],
    controls: [pulse("hop", label, motion ? secs : HOP_SECS)],
    action: { key: "hop", label },
    drive(t, c, out, info) {
      if (hide) out.parts.under = { visible: 0 };
      if (!motion) return hopDrive(c, out);
      const e = since(c, "hop", secs);
      if (e >= 0) out.body = motion(e, info);
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

const STEAK_Y = -0.1;

// A pointed oval (a boat's footprint): half-length L along the unit direction u, half-width W at
// the middle, as radii at n angles round its center.
function vesica(u, L, W, n = 96) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const d = [Math.cos(a), Math.sin(a)];
    const du = d[0] * u[0] + d[1] * u[1];
    const dv = -d[0] * u[1] + d[1] * u[0];
    let lo = 0;
    let hi = L;
    for (let k = 0; k < 30; k++) {
      const r = (lo + hi) / 2;
      const inside = Math.abs(r * dv) <= W * (1 - ((r * du) / L) ** 2);
      if (inside) lo = r;
      else hi = r;
    }
    return lo;
  });
}
const BOAT_U = [0.589, 0.808];

// A toy whose part above its base moves on its own (a figure on a mat, a crystal on its block):
// the part's regions are hard-edged, so each splat moves wholly with it or not at all.
function partly({ count, build, hide = [], part, motion, secs = 3, label }) {
  return {
    addon: count ? { count, build } : undefined,
    hard: true,
    parts: [
      ...(hide.length ? [{ name: "under", pivot: [0, -1, 0], regions: hide }] : []),
      { name: "top", pivot: part.pivot, regions: part.regions },
    ],
    controls: [pulse("hop", label, secs)],
    action: { key: "hop", label },
    drive(t, c, out, info) {
      if (hide.length) out.parts.under = { visible: 0 };
      const e = since(c, "hop", secs);
      if (e >= 0) out.parts.top = motion(e, info, part.pivot);
    },
  };
}

// A toy on a captured mat or patch of ground: one or more floors, and the capture below them
// hidden (unless a floor says keep: it sits just under the capture's lowest splats instead).
function grounded(count, floors, opts = {}) {
  return based({
    ...opts,
    count,
    hide: floors.flatMap((f) => (f.keep ? [] : below(f.center[0], f.center[1], f.y + (f.lift ?? 0), f.reach ?? 3))), // prettier-ignore
    build(k) {
      const size = (f) => (f.rect ? (4 / Math.PI) * f.rect.half[0] * f.rect.half[1] : Math.max(...f.radii) ** 2) * (f.scale ?? 1) ** 2; // prettier-ignore
      const area = floors.reduce((s, f) => s + size(f), 0);
      for (const f of floors) floor(k, { ...f, count: (count * size(f)) / area });
    },
  });
}

const BASES = {
  // The toy T. rex stands on a lime plastic disc; from below, its fringe smeared green.
  "toy-trex": grounded(45000, [{ center: [-0.05, 0.01], y: -0.885, radii: [0.93], color: MATERIALS.plastic("#b9cf4a"), thick: true }]), // prettier-ignore
  // The BMX bicycle stands on a round gray rug.
  "bmx-bike": grounded(48000, [
    {
      ...measured("bmx-bike", -0.49, MATERIALS.cloth("#a9a6a2", 0.08), 1.06),
      thick: true,
      lift: 0.02,
    },
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
  // The cherry trees stand on five round patches of earth. Under the three small ones the capture's
  // underside lay just under the floor and showed through, so it is hidden a little above it.
  "cherry-blossom-photo": grounded(60000, [
    [0.164, 0.741, 0.29, -0.23],
    [-0.495, 0.047, 0.4, -0.335],
    [0.397, -0.098, 0.5, -0.27],
    [-0.71, -0.686, 0.17, -0.282],
    [0.004, -0.711, 0.31, -0.295],
  ].map(([x, z, r, y]) => ({ center: [x, z], y, radii: [r], color: MATERIALS.earth(), keep: r > 0.35, reach: r * 1.8, lift: 0.025, thick: true }))), // prettier-ignore
  // The desk globe stands on a slice of a log: its sawn end, with growth rings, underneath.
  "desk-globe": grounded(40000, [{ center: [-0.2, 0.06], y: -0.74, radii: [0.96], color: MATERIALS.rings(-0.18, 0.04, 0.96) }]), // prettier-ignore
  // The cowboy steak: the capture saw only its top; under it hang a few loose splats and a fringe
  // of long, thin needles. The needles fade, the loose splats lower down are hidden, and a
  // kit-built underside takes their place, seared like the top (its colors at each point, a
  // little darker, from tools/pr3-under.mjs --top).
  steak: {
    keys: [{ long: 0.3 }],
    fx: [{ name: "needles", select: "key0", origin: [0, 0, 0], mask: { half: [0, -1, 0], at: -0.02 }, color: { fade: true } }], // prettier-ignore
    addon: {
      count: 30000,
      build(k) {
        floor(k, { ...measured("steak", STEAK_Y, MATERIALS.mirror(B.steak.top, 0.78), 0.97), count: 30000 }); // prettier-ignore
      },
    },
    parts: [{ name: "under", pivot: [0, -1, 0], regions: below(0, 0, STEAK_Y) }],
    controls: [pulse("hop", "Hop", HOP_SECS)],
    action: { key: "hop", label: "Hop" },
    drive(t, c, out) {
      out.fx.needles = { color: 1 };
      out.parts.under = { visible: 0 };
      hopDrive(c, out);
    },
  },

  // The sushi boat: its underside was a flat, painted-looking fill. It is hidden, and a kit-built
  // hull bottom of carved wood, the grain along the boat, takes its place.
  "sushi-boat": based({
    count: 26000,
    hide: below(0.012, -0.03, -0.118),
    build(k) {
      const c = [0.012, -0.03];
      floor(k, {
        center: c,
        radii: vesica(BOAT_U, 1.1, 0.3),
        smooth: 0,
        // The boat lies rolled a little to one side: its bottom is lower on that side.
        y: (x, z) => -0.092 + 0.085 * (-(x - c[0]) * BOAT_U[1] + (z - c[1]) * BOAT_U[0]),
        count: 26000,
        color: MATERIALS.wood("#a8763f", "#7a5128", BOAT_U, 140),
      });
    },
  }),
  // The orange: the capture's underside is a blur (the camera never saw it). It is hidden, and a
  // kit-built lower peel takes its place, pores and all.
  "orange-photo": based({
    count: 40000,
    hide: [{ at: [-0.057, -0.75, -0.01], r: [1.3, 0.36, 1.3], soft: 0.03 }],
    build(k) {
      cap(k, { center: [-0.057, 0.01, -0.01], R: 0.865, cut: -0.36, count: 40000, color: MATERIALS.peel() }); // prettier-ignore
    },
  }),
  // The alum crystal's block of dark stone, closed underneath.
  "alum-crystal": based({
    count: 24000,
    hide: below(0.06, 0.03, -1.11),
    build(k) {
      const rect = { center: [0.058, 0.03], angle: 0.602, half: [0.5, 0.55] };
      floor(k, { center: rect.center, rect, scale: 0.97, y: -1.11, count: 24000, color: MATERIALS.stone("#2c2b2c") }); // prettier-ignore
    },
  }),
  // The knight's pewter base, closed underneath.
  "knight-horse": based({
    count: 24000,
    hide: below(-0.08, 0.05, -0.955),
    build(k) {
      floor(k, { ...measured("knight-horse", -0.955, MATERIALS.pewter(), 1.12), count: 24000, thick: true }); // prettier-ignore
    },
  }),
  // The money tree's glazed pot: its foot, an unglazed ring and a drainage hole.
  "money-tree": based({
    count: 16000,
    hide: below(-0.168, -0.161, -1.1, 0.6),
    build(k) {
      floor(k, { center: [-0.168, -0.161], radii: [0.34], y: -1.1, count: 16000, color: MATERIALS.potFoot(-0.168, -0.161, 0.34, "#c2cad6") }); // prettier-ignore
    },
  }),
  // The glass vases of the white roses and the peonies: a thick glass bottom.
  "white-roses": based({
    count: 12000,
    build(k) {
      floor(k, { center: [0.065, -0.035], radii: [0.21], y: -0.955, count: 12000, color: MATERIALS.glassFoot(0.065, -0.035, 0.21) }); // prettier-ignore
    },
  }),
  peony: based({
    count: 12000,
    build(k) {
      floor(k, { center: [-0.081, -0.112], radii: [0.215], y: -1.335, count: 12000, color: MATERIALS.glassFoot(-0.081, -0.112, 0.215, "#c3d2bf") }); // prettier-ignore
    },
  }),
  // The stollen: a crust-colored floor just inside its underside, which only shows where the
  // capture is thin.
  stollen: based({
    count: 30000,
    build(k) {
      floor(k, { ...measured("stollen", -0.38, (x, z, f, noise) => shade("#5b3520", 0.8 + 0.1 * fbm(noise, x, z, 10)), 0.7), count: 30000 }); // prettier-ignore
    },
  }),
  // Solid cores just inside thin captures, which only show where the capture is thin (lane
  // Sharpness B's fruit cores): the crochet Earth's navy yarn, the puffin's body (white at the
  // front, black behind), the elephant's body, and the berries in the physalis's lanterns.
  "crochet-earth": based({
    count: 30000,
    build(k) {
      core(k, [-0.003, -0.08, 0.008], [0.84, 0.81, 0.82], (c) => shade("#1f2748", 0.78 + 0.1 * c.fbm(c.lp[0] * 9, c.lp[1] * 9, c.lp[2] * 9))); // prettier-ignore
    },
  }),
  puffin: based({
    count: 16000,
    build(k) {
      const color = (c) =>
        c.n[2] > -0.15 ? lit("#e9e7e2", c.n, 0.8, 0.2) : lit("#141414", c.n, 0.8, 0.2);
      for (const [at, r] of [
        [[-0.05, -0.36, -0.2], 0.16],
        [[-0.02, -0.12, 0.04], 0.21],
        [[0.0, 0.1, 0.2], 0.17],
      ])
        core(k, at, [r, r, r], color, { grid: 40 });
    },
  }),
  "elephant-souvenir": based({
    count: 16000,
    build(k) {
      core(k, [0.0, 0.12, -0.05], [0.42, 0.18, 0.2], "#26324a");
    },
  }),
  physalis: based({}),
  // The sunflower: the back of its head, a green disc just behind the petals.
  "sunflower-photo": based({
    count: 12000,
    build(k) {
      core(k, [-0.01, -0.03, 0.2], [0.24, 0.24, 0.05], "#4a6a2a", { grid: 48 });
    },
  }),
  // Solid underneath already (the owner's verdicts of October 3, 2026): rigs only for their effects.
  "heart-donut": based({}),
  "seeded-loaf": based({}),
  "crystal-gem": based({}),
  "turtle-souvenir": based({}),
  "murex-shell": based({}),
  "cave-lioness": based({}),
  // Lane Photoreal r3's own captures (src/packs/photoreal-r3.js).
  // The skull's mounting rod, under the back of its jaw (hidden).
  "triceratops-skull": based({ hide: [{ at: [-0.15, -0.93, -0.02], r: [0.12, 0.14, 0.12], soft: 0.02 }, { at: [-0.15, -0.8, -0.02], r: [0.09, 0.06, 0.09], soft: 0.02, color: "#3a3631", tol: 0.3 }] }), // prettier-ignore
  "cone-shell": based({}),
};

// ---- Effects --------------------------------------------------------------------------------
// A tap's effect for each toy: a whole-object motion (out.body), or a part above its base that
// moves on its own (hard-edged, so each splat moves wholly with it or not at all). Toys not
// listed keep the hop every capture has.

// The view direction at the home camera (yaw 0.55), and the level axis across it: a turn about
// that axis is seen side on.
const ACROSS = [Math.cos(0.55), 0, -Math.sin(0.55)];

function moveBody(rig, { motion, secs = 3, label = "Hop" }) {
  const hidden = rig.parts.some((p) => p.name === "under");
  return {
    ...rig,
    controls: [pulse("hop", label, secs)],
    action: { key: "hop", label },
    drive(t, c, out, info) {
      if (hidden) out.parts.under = { visible: 0 };
      const e = since(c, "hop", secs);
      if (e >= 0) out.body = motion(e, info);
    },
  };
}
function movePart(rig, { pivot, regions, motion, secs = 3, label = "Hop" }) {
  const hidden = rig.parts.some((p) => p.name === "under");
  return {
    ...rig,
    hard: true,
    parts: [...rig.parts, { name: "top", pivot, regions }],
    controls: [pulse("hop", label, secs)],
    action: { key: "hop", label },
    drive(t, c, out, info) {
      if (hidden) out.parts.under = { visible: 0 };
      const e = since(c, "hop", secs);
      if (e >= 0) out.parts.top = motion(e, info, pivot);
    },
  };
}

const M = MOTIONS;
const EFFECTS = {
  "heart-donut": {
    label: "Toss",
    secs: 1.6,
    motion: M.toss({ center: [0, 0.05, 0], axis: [0, 1, 0] }),
  },
  "sushi-boat": { label: "Rock", secs: 3.5, motion: M.rock({ pivot: [0.012, -0.1, -0.03], axis: [BOAT_U[0], 0, BOAT_U[1]], amp: 0.13, k: 0.9, w: 5 }) }, // prettier-ignore
  "seeded-loaf": {
    label: "Drop",
    secs: 2.2,
    motion: M.drop({ pivot: [0, -0.24, 0], axis: [1, 0, 0] }),
  },
  steak: { label: "Flip", secs: 3.1, motion: M.flip({ center: [0, 0, 0], axis: [1, 0, 0] }) },
  stollen: {
    label: "Drop",
    secs: 2.2,
    motion: M.drop({ pivot: [0, -0.5, 0], axis: [1, 0, 0], amp: 0.04 }),
  },
  "orange-photo": { label: "Roll", secs: 2.8, motion: M.roll({ center: [-0.057, 0.01, -0.01], R: 0.865, dir: ACROSS, dist: 0.32 }) }, // prettier-ignore
  physalis: { label: "Sway", secs: 3, motion: M.rock({ pivot: [-0.02, -1.12, 0.12], axis: [0.52, 0, 0.85], amp: 0.16, k: 1, w: 4.5 }) }, // prettier-ignore
  "crystal-gem": {
    label: "Turn",
    secs: 3,
    motion: M.spin({ center: [-0.1, 0, -0.05], turns: 1, secs: 2.8 }),
  },
  puffin: {
    label: "Hop",
    secs: 2.2,
    motion: M.hopTurn({ center: [0, 0, 0], turn: 0.7, height: 0.16 }),
  },
  "elephant-souvenir": { label: "Turn", secs: 2.2, motion: M.hopTurn({ center: [0, 0, 0], turn: 0.8, height: 0.05 }) }, // prettier-ignore
  "turtle-souvenir": {
    label: "Crawl",
    secs: 3,
    motion: M.crawl({ heading: [1, 0, 0], dist: 0.38, sway: 0.08 }),
  },
  "cave-lioness": { label: "Look", secs: 2.7, motion: M.look({ pivot: [0.6, -0.9, -0.5] }) },
  "murex-shell": {
    label: "Turn",
    secs: 3,
    motion: M.spin({ center: [0, 0, 0], turns: 1, secs: 2.8 }),
  },
  "sunflower-photo": { label: "Nod", secs: 3, motion: M.rock({ pivot: [0, -1.15, 0.3], axis: [1, 0, 0], amp: 0.13, k: 1.1, w: 5 }) }, // prettier-ignore
  "white-roses": { label: "Knock", secs: 2.6, motion: M.wobble({ base: [0.065, -0.955, -0.035], r: 0.2, lean: 0.12 }) }, // prettier-ignore
  peony: { label: "Knock", secs: 2.6, motion: M.wobble({ base: [-0.081, -1.335, -0.112], r: 0.21, lean: 0.1 }) }, // prettier-ignore
  "money-tree": { label: "Knock", secs: 2.6, motion: M.wobble({ base: [-0.168, -1.1, -0.161], r: 0.33, lean: 0.1 }) }, // prettier-ignore
  "crochet-earth": {
    label: "Spin",
    secs: 3,
    motion: M.spin({ center: [0, -0.08, 0], turns: 2, secs: 2.8 }),
  },
  "knight-horse": { label: "Rear", secs: 1.8, motion: M.rear({ pivot: [-0.5, -0.97, 0.05], axis: [0, 0, 1], amp: 0.25 }) }, // prettier-ignore
  "mushroom-photo": { label: "Drop", secs: 2.2, motion: M.drop({ pivot: [0, -0.24, 0], axis: ACROSS, height: 0.15, amp: 0.03 }) }, // prettier-ignore
  "cactus-real": { label: "Drop", secs: 2.2, motion: M.drop({ pivot: [0, -0.87, 0], axis: ACROSS, height: 0.15, amp: 0.03 }) }, // prettier-ignore
  "maple-tree": { label: "Drop", secs: 2.2, motion: M.drop({ pivot: [0, -0.8, 0], axis: ACROSS, height: 0.12, amp: 0.02 }) }, // prettier-ignore
  "bonsai-photo": { label: "Drop", secs: 2.2, motion: M.drop({ pivot: [0, -0.9, 0], axis: ACROSS, height: 0.12, amp: 0.02 }) }, // prettier-ignore
  "cherry-blossom-photo": { label: "Drop", secs: 2.2, motion: M.drop({ pivot: [0, -0.28, 0], axis: ACROSS, height: 0.15, amp: 0.03 }) }, // prettier-ignore
};
// The desk globe's ball (fitted to its splats), and its axis toward the top pivot.
const GLOBE = [-0.138, 0.281, 0.051];
const GLOBE_AXIS = [0.198, 0.979, 0.039];
// New in Photoreal r3: the Triceratops skull turns its head to look at you; the cone shell turns
// one way and the other on its point (its far side was never captured well, so not all the way).
EFFECTS["triceratops-skull"] = { label: "Look", secs: 2.7, motion: M.look({ pivot: [0.2, -0.3, 0], amp: 0.45, nod: 0.05 }) }; // prettier-ignore
EFFECTS["cone-shell"] = { label: "Turn", secs: 2.7, motion: M.look({ pivot: [0, -0.8, 0], amp: 0.55, nod: 0 }) }; // prettier-ignore

const PART_EFFECTS = {
  // The desk globe spins in its stand: the ball's splats (not the dark meridian ring or stand)
  // turn about the globe's axis, fast at first and slowing.
  "desk-globe": { label: "Spin", secs: 3.4, pivot: GLOBE, regions: [{ at: GLOBE, r: [0.5, 0.5, 0.5], soft: 0.01, notColor: "#151515", tol: 0.22 }], motion: (e, info, origin) => turnAbout(qa(GLOBE_AXIS, (vary(info?.tap, 29) < 0.5 ? 1 : -1) * TAU * 1.6 * (1 - (1 - band(e, 0, 3.2)) ** 2)), GLOBE, origin) }, // prettier-ignore
  // The toy T. rex rocks on its feet on its disc (its raised head has a region of its own); the monkey
  // doll on its cloth (and its left ear); the alum crystal
  // is turned a quarter turn on its block, barely lifted (lifted higher, the gap shows the capture's
  // smeared contact under it, which no cut or cap closed cleanly).
  "toy-trex": { label: "Stomp", secs: 2.6, pivot: [0, -0.85, -0.1], regions: [{ at: [0.05, 0.05, -0.13], r: [0.95, 0.89, 0.62], soft: 0.01 }, { at: [-0.59, 0.78, -0.4], r: [0.24, 0.26, 0.26], soft: 0.01 }], motion: M.wobble({ base: [0, -0.85, -0.1], r: 0.18, lean: 0.12 }) }, // prettier-ignore
  "monkey-doll": { label: "Rock", secs: 2.6, pivot: [0, -0.86, -0.08], regions: [{ at: [0, 0.05, -0.08], r: [0.76, 0.91, 0.64], soft: 0.01 }, { at: [-0.65, 0.45, 0.06], r: [0.13, 0.15, 0.13], soft: 0.01 }], motion: M.wobble({ base: [0, -0.86, -0.08], r: 0.38, lean: 0.14 }) }, // prettier-ignore
  "alum-crystal": { label: "Turn", secs: 2.4, pivot: [0, -0.4, 0], regions: [{ at: [0, 0.3, -0.02], r: [0.78, 0.66, 0.82], soft: 0.01 }], motion: (e, info, origin) => lift(turnAbout(qa([0, 1, 0], (vary(info?.tap, 23) < 0.5 ? 1 : -1) * Math.PI * 0.5 * ease(band(e, 0.3, 1.7))), [0, 0, 0], [0, 0, 0]), 0.035 * bump(e, 0, 2.0)) }, // prettier-ignore
};

// The BMX bicycle, nudged, leans over on its kickstand and rocks back up: the whole bike (frame and
// both wheels, everything above its rug) turns as one solid piece about the line through its
// tires' contact points. (Rolling it on turning wheels was tried: the tires and spokes can only be
// picked by color, and the splats whose color only partly matches stayed behind as a faint ghost
// of each wheel.)
const BIKE_DIR = unit([-0.359, 0, 0.933]);
// Fitted to the tires' dark splats (tools/pr3-measure.mjs): a tire reaches about 0.35 from its hub.
const WHEELS = { wf: [-0.285, -0.144, 0.28], wr: [0.072, -0.129, -0.552] };
// The pads on its top tube and handlebar crossbar carried a brand name in red-to-yellow letters,
// printed on both sides (CLAUDE.md: no brand names; the Operator's call of October 9, 2026): a
// plain black foam sleeve, kit-built, covers each pad just over its letters. Each pad's axis is its
// letters' long direction and its center their centroid, as they wrap both sides
// (tools/pr3-measure.mjs). The same name in orange and dark red on the chrome down tube is hidden
// by its colors within a box round it (BIKE_DECAL).
const BIKE_PADS = [
  { at: [-0.101, 0.178, -0.058], axis: unit([0.301, -0.231, -0.925]), half: 0.115, r: 0.036 },
  { at: [-0.114, 0.482, 0.242], axis: unit([0.912, -0.125, 0.39]), half: 0.16, r: 0.034 },
];
const BIKE_DECAL = [{ at: [-0.159, 0.076, 0.067], r: [0.07, 0.1, 0.19], color: "#b37a35", tol: 0.4, soft: 0.01, over: true }, { at: [-0.159, 0.076, 0.067], r: [0.07, 0.1, 0.19], color: "#8a2a1a", tol: 0.3, soft: 0.01, over: true }]; // prettier-ignore
function bikePads(k, count) {
  const per = Math.round(count / BIKE_PADS.length);
  for (const pad of BIKE_PADS) {
    const a = pad.axis;
    const u = unit(cross(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const v = cross(a, u);
    const len = 2 * pad.half;
    const around = Math.max(12, Math.round(Math.sqrt((per * TAU * pad.r) / len)));
    const along = Math.ceil(per / around);
    const size = Math.sqrt((TAU * pad.r * len) / per) * 1.1;
    k.cloud({ share: per / k.count, pattern: false }, (_r, i) => {
      const row = Math.floor(i / around);
      const th = ((i % around) + 0.5 * (row % 2)) * (TAU / around);
      const t = -pad.half + ((row + 0.5) / along) * len;
      const n = [0, 1, 2].map((j) => Math.cos(th) * u[j] + Math.sin(th) * v[j]);
      return {
        p: [0, 1, 2].map((j) => pad.at[j] + a[j] * t + n[j] * pad.r),
        n,
        flat: 0.5,
        jitter: 0,
        opacity: 1,
        size: size / 0.01,
        color: shade("#161616", 0.92 + 0.08 * k.noise.fbm(t * 60, th * 3, 0.3, 2)),
      };
    });
  }
}
function bikeRig(rig) {
  const secs = 2.6;
  const frame = [-0.1, 0.13, -0.16];
  const contact = [(WHEELS.wf[0] + WHEELS.wr[0]) / 2, -0.47, (WHEELS.wf[2] + WHEELS.wr[2]) / 2];
  const padCount = 8000;
  return {
    ...rig,
    addon: {
      count: rig.addon.count + padCount,
      build(k) {
        rig.addon.build(k);
        bikePads(k, padCount);
      },
    },
    hard: true,
    parts: [
      ...rig.parts,
      { name: "decal", pivot: contact, regions: BIKE_DECAL },
      { name: "bike", pivot: contact, regions: [{ at: frame, r: [0.75, 0.57, 0.95], soft: 0.01 }, ...Object.values(WHEELS).map((at) => ({ at: [at[0], at[1] + 0.075, at[2]], r: [0.37, 0.37, 0.37], soft: 0.01 }))] }, // prettier-ignore
    ],
    controls: [pulse("hop", "Nudge", secs)],
    action: { key: "hop", label: "Nudge" },
    drive(t, c, out, info) {
      out.parts.under = { visible: 0 };
      out.parts.decal = { visible: 0 };
      const e = since(c, "hop", secs);
      if (e < 0) return;
      // Toward its kickstand side and back, a damped rock that settles on the stand.
      const sgn = vary(info?.tap, 31) < 0.5 ? 1 : -1;
      const ang = sgn * 0.16 * Math.exp(-e * 1.6) * Math.sin(e * 6.5) * band(e, 0, 0.06);
      out.parts.bike = { quat: qa(BIKE_DIR, ang), offset: [0, 0, 0] };
    },
  };
}

export const PR3_RIGS = Object.fromEntries(
  Object.entries(BASES).map(([id, rig]) => [
    id,
    id === "bmx-bike"
      ? bikeRig(rig)
      : PART_EFFECTS[id]
        ? movePart(rig, PART_EFFECTS[id])
        : EFFECTS[id]
          ? moveBody(rig, EFFECTS[id])
          : rig,
  ]),
);
