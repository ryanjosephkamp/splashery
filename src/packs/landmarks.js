// Landmarks: famous places as little dioramas. Historic landmarks are
// modelled procedurally; modern named buildings become generic ones (a
// "twisting supertall"). There is no scene lighting, so colours carry baked
// sunlight, stone courses and window grids.

import {
  mix,
  shade,
  smoothstep,
  clamp,
  spline,
  quatFromTo,
  quatAxisAngle,
  quatRotate,
  quatMul,
} from "../kit.js";

const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const keep = (c, size) => ({ c, keep: true, size });
const rotY = (p, a) => [
  p[0] * Math.cos(a) + p[2] * Math.sin(a),
  p[1],
  -p[0] * Math.sin(a) + p[2] * Math.cos(a),
];
const hash = (x, y = 0, z = 0) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

// Baked sunlight: the sun is high, towards the viewer and a little right.
const SUN = unit([0.3, 0.8, 0.55]);
const sunOf = (n) => n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2];
const lit = (col, c, amb = 0.7) => shade(col, amb + (1 - amb) * sunOf(c.n));

// A round rod (or cone when r1 is given) from a to b.
function rod(k, a, b, r, opts = {}, r1 = r) {
  const d = sub(b, a);
  const shape = k.cone(r, r1, len(d), { caps: opts.caps ?? false });
  return k.add(shape, { ...opts, pos: mul(add(a, b), 0.5), quat: quatFromTo([0, 1, 0], d) });
}

// A flat quad a-b-c-d (planar; c = d makes a triangle), sampled evenly.
function quad(k, a, b, c, d, n) {
  const nn = n || unit(cross(sub(b, a), sub(d, a)));
  return k.param((u, v) => lerp3(lerp3(a, b, u), lerp3(d, c, u), v), {
    grid: 8,
    normal: () => nn,
    thick: 0.02,
  });
}

// A box with rounded edges and corners, sampled evenly.
function roundBox(sx, sy, sz, r) {
  r = Math.max(1e-4, Math.min(r, sx / 2, sy / 2, sz / 2));
  const h = [sx / 2 - r, sy / 2 - r, sz / 2 - r];
  const faceA = [4 * h[1] * h[2], 4 * h[0] * h[2], 4 * h[0] * h[1]];
  const edgeA = [Math.PI * r * h[0], Math.PI * r * h[1], Math.PI * r * h[2]];
  const parts = [...faceA.map((a) => 2 * a), ...edgeA.map((a) => 4 * a), 4 * Math.PI * r * r];
  const area = parts.reduce((a, b) => a + b, 0);
  return {
    area,
    thick: Math.min(sx, sy, sz) / 2,
    sample(rand) {
      let x = rand() * area;
      let i = 0;
      while (i < parts.length - 1 && x >= parts[i]) x -= parts[i++];
      const sgn = () => (rand() < 0.5 ? -1 : 1);
      let n = [0, 0, 0];
      const base = [0, 0, 0];
      let face = -1;
      if (i < 3) {
        const s = sgn();
        n[i] = s;
        for (let k = 0; k < 3; k++) base[k] = k === i ? s * h[k] : (rand() * 2 - 1) * h[k];
        face = i * 2 + (s > 0 ? 0 : 1);
      } else if (i < 6) {
        const ax = i - 3;
        const a = rand() * Math.PI * 0.5;
        const j = (ax + 1) % 3;
        const k2 = (ax + 2) % 3;
        const sj = sgn();
        const sk = sgn();
        n[j] = sj * Math.cos(a);
        n[k2] = sk * Math.sin(a);
        base[ax] = (rand() * 2 - 1) * h[ax];
        base[j] = sj * h[j];
        base[k2] = sk * h[k2];
      } else {
        const z = rand();
        const a = rand() * Math.PI * 0.5;
        const q = Math.sqrt(1 - z * z);
        const s = [sgn(), sgn(), sgn()];
        n = [s[0] * q * Math.cos(a), s[1] * z, s[2] * q * Math.sin(a)];
        for (let k = 0; k < 3; k++) base[k] = s[k] * h[k];
      }
      const p = [base[0] + n[0] * r, base[1] + n[1] * r, base[2] + n[2] * r];
      return { p, n, u: p[0] / sx + 0.5, v: p[1] / sy + 0.5, face };
    },
  };
}

// A straight-sided prism or frustum with an n-gon section (radius to the
// corners), from y0 to y1. Adds one quad per side (and a top cap).
function prism(k, n, r0, r1, y0, y1, opts, { a0 = Math.PI / n, cap = true } = {}) {
  const pt = (i, r, y) => {
    const a = a0 + (i / n) * TAU;
    return [Math.sin(a) * r, y, Math.cos(a) * r];
  };
  for (let i = 0; i < n; i++) {
    const a = pt(i, r0, y0);
    const b = pt(i + 1, r0, y0);
    const c = pt(i + 1, r1, y1);
    const d = pt(i, r1, y1);
    const mid = (a0 + ((i + 0.5) / n) * TAU) % TAU;
    const nn = unit([
      Math.sin(mid) * (y1 - y0),
      (r0 - r1) * Math.cos(Math.PI / n),
      Math.cos(mid) * (y1 - y0),
    ]);
    k.add(quad(k, b, a, d, c, nn), opts);
  }
  if (cap && r1 > 0)
    k.add(k.disc(r1 * Math.cos(Math.PI / n)), {
      ...opts,
      pos: [0, y1, 0],
      color: opts.capColor || opts.color,
    });
}

// Free splats along straight members (lattice girders, rigging).
// segs: [a, b, thickness]; the budget is shared by length times thickness.
function lattice(k, segs, { share, size = 0.7, stretch = 2.4, color, part, pattern, more }) {
  const cum = new Float64Array(segs.length);
  let total = 0;
  segs.forEach((s, i) => {
    total += len(sub(s[1], s[0])) * (s[2] ?? 1);
    cum[i] = total;
  });
  k.cloud({ share, size, part, pattern }, (rand) => {
    const x = rand() * total;
    let lo = 0;
    let hi = segs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    const [a, b, w = 1] = segs[lo];
    const t = rand();
    const d = sub(b, a);
    const j = 0.006 * w;
    const p = add(lerp3(a, b, t), [(rand() - 0.5) * j, (rand() - 0.5) * j, (rand() - 0.5) * j]);
    const splat = { p, dir: d, stretch, size: 0.7 + 0.3 * Math.sqrt(w), color: color(p, d, rand) };
    return more ? { ...splat, ...more(p, rand) } : splat;
  });
}

// A patch of water that ripples (ellipse, or a custom mask).
function water(k, y, rx, rz, o = {}) {
  const {
    share = 0.12,
    deep = "#1d5f8a",
    light = "#5fb3d6",
    foam = null,
    amount = 0.01,
    x0 = 0,
    z0 = 0,
    rect = false,
  } = o;
  k.cloud({ share, size: 1.6, pattern: false }, (rand) => {
    let x;
    let z;
    let edge;
    if (rect) {
      x = (rand() * 2 - 1) * rx;
      z = (rand() * 2 - 1) * rz;
      edge = 0;
    } else {
      const a = rand() * TAU;
      const r = Math.sqrt(rand());
      x = Math.cos(a) * r * rx;
      z = Math.sin(a) * r * rz;
      edge = smoothstep(0.85, 1, r);
    }
    x += x0;
    z += z0;
    if (o.mask && !o.mask(x, z)) return null;
    const ripple = 0.5 + 0.5 * Math.sin(x * 11 + z * 7 + Math.sin(z * 4 + x * 2) * 2);
    let col = mix(deep, light, 0.25 + 0.5 * ripple * ripple + 0.15 * rand());
    const f = foam ? foam(x, z) : 0;
    if (f > 0) col = mix(col, "#f4fbff", clamp(f, 0, 1) * (0.6 + 0.4 * rand()));
    return {
      p: [x, y + (rand() - 0.5) * 0.003, z],
      n: [0, 1, 0],
      flat: 0.12,
      color: col,
      opacity: 0.95 * (1 - edge * 0.85),
      kind: "wave",
      params: [amount, rand() * 0.3],
    };
  });
}

// A flag on a pole, fluttering (wave). colorFn(u, v): u along the fly from
// the pole, v down from the top.
function flag(
  k,
  base,
  height,
  w,
  h,
  colorFn,
  { dir = [-1, 0, 0], pole = "#d9d9d9", poleR, part } = {},
) {
  const top = add(base, [0, height, 0]);
  rod(k, base, top, poleR ?? height * 0.012, { weight: 3, color: pole, part });
  k.add(k.sphere((poleR ?? height * 0.012) * 1.8), { pos: top, weight: 3, color: "#d4af37", part });
  const side = unit(cross([0, 1, 0], dir));
  const f = k.param(
    (u, v) => {
      const p = add(add(top, mul(dir, u * w)), [0, -v * h - 0.01 * height, 0]);
      return add(p, mul(side, Math.sin(u * 5 + v) * w * 0.06 * u));
    },
    { grid: 12, normal: () => side },
  );
  k.add(f, {
    part,
    weight: 2.5,
    flat: 0.2,
    pattern: false,
    kind: "wave",
    params: [0.004, 0],
    color: (c) => colorFn(c.u, c.v),
  });
}

// The flag of the United States, simplified.
const usFlag = (u, v) => {
  if (u < 0.4 && v < 0.54) {
    const star = (u * 14) % 1 < 0.4 && (v * 11) % 1 < 0.4;
    return star ? "#ffffff" : "#27326b";
  }
  return Math.floor(v * 13) % 2 ? "#f4f4f4" : "#b82235";
};

// A disc of lawn (or any ground) with a soft edge colour.
function ground(k, r, y, color, { edge = "#6b5a44", h = 0.06, share } = {}) {
  k.add(k.cylinder(r, h), {
    pos: [0, y - h / 2, 0],
    pattern: false,
    flat: 0.2,
    share,
    color: (c) => (c.s.side ? lit(edge, c) : c.s.cap === "bottom" ? shade(edge, 0.6) : color(c)),
  });
}
const grass = (c, base = "#5d9e45") =>
  lit(shade(base, 0.86 + 0.22 * c.noise(c.p[0] * 7, 0, c.p[2] * 7) + 0.06 * c.rand()), c);
const tree = (k, p, r, col = "#3f7f37") => {
  k.add(k.sphere(r), {
    pos: add(p, [0, r * 0.9, 0]),
    pattern: false,
    flat: 0.4,
    color: (c) =>
      lit(shade(col, 0.85 + 0.3 * c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30)), c, 0.6),
  });
};

// A pointed (Gothic or Mughal) arch: inside the opening at (s, y) for an
// arch of half-width w whose sides rise to `spring`.
function inArch(s, y, w, spring, pointed = 1.2) {
  if (Math.abs(s) > w || y < 0) return false;
  if (y < spring) return true;
  const R = w * pointed;
  const cx = R - w;
  const dy = y - spring;
  return Math.hypot(s + cx, dy) < R && Math.hypot(s - cx, dy) < R;
}

// A round arch opening.
function inRound(s, y, w, spring) {
  if (Math.abs(s) > w || y < 0) return false;
  return y < spring || Math.hypot(s, y - spring) < w;
}

// Stone courses on a surface: coordinate `along` the wall and height y.
function stone(c, base, along, y, { course = 0.06, block = 0.14, mortar = 0.08, vary = 0.1 } = {}) {
  const row = Math.floor(y / course);
  const fy = y / course - row;
  const off = (row % 2) * 0.5;
  const fx = along / block + off;
  const col = Math.floor(fx);
  const joint = fy < mortar || fx - col < mortar * (course / block);
  const v = 1 - vary / 2 + vary * hash(col, row);
  return shade(base, joint ? 0.8 : v);
}

// A smooth 1D curve through [x, y] points (x ascending).
function curve(points) {
  return (x) => {
    if (x <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i];
      if (x <= x1) {
        const [x0, y0] = points[i - 1];
        const t = (x - x0) / (x1 - x0);
        return y0 + (y1 - y0) * t * t * (3 - 2 * t);
      }
    }
    return points[points.length - 1][1];
  };
}

// ---- Eiffel tower ---------------------------------------------------------------------------
// Units of 100 m. Four curved lattice legs meet above the second floor and
// rise as one tapering shaft to the top and its antenna.

// Firework bursts round the tower: centre, radius and colours (blue, white,
// red and gold), each at its own moment after the tap (at, seconds). Placed
// either side of the tower as seen from the home view.
const EIF_VIEW_R = [0.85, 0, -0.52];
const EIF_BURSTS = [
  { c: add(mul(EIF_VIEW_R, -0.78), [0, 2.2, 0.1]), r: 0.44, a: "#2f6bff", b: "#cfe0ff", at: 0.35 },
  { c: add(mul(EIF_VIEW_R, 0.82), [0, 2.55, 0]), r: 0.46, a: "#f4f7ff", b: "#fff6c8", at: 0.9 },
  { c: add(mul(EIF_VIEW_R, -0.5), [0, 2.95, -0.25]), r: 0.4, a: "#ff3346", b: "#ffd0b0", at: 1.45 }, // prettier-ignore
  { c: add(mul(EIF_VIEW_R, 0.62), [0, 1.7, 0.05]), r: 0.4, a: "#ffb52e", b: "#fff2b0", at: 2.1 },
];
const EIF_SECS = 4.2;
const EIF_BUILT = 0.6;

// A firework burst: rays of sparks from the centre with bright tips, built
// at its fullest (drive() grows it with its part's scale and fades it).
function burst(k, part, C, r, a, b, share) {
  const rays = 72;
  const g = Math.PI * (3 - Math.sqrt(5));
  const dirs = [];
  for (let i = 0; i < rays; i++) {
    const y = 1 - ((i + 0.5) / rays) * 2;
    const rr = Math.sqrt(1 - y * y);
    dirs.push([Math.cos(g * i) * rr, y, Math.sin(g * i) * rr]);
  }
  k.cloud({ share, size: 0.8, pattern: false, part }, (rand, i) => {
    const d = dirs[i % rays];
    const t = Math.pow(rand(), 0.55);
    const tip = t > 0.9;
    return {
      p: add(C, add(mul(d, r * (0.18 + 0.82 * t)), [0, -0.06 * r * t * t, 0])),
      dir: d,
      stretch: tip ? 1.2 : 2.6,
      size: tip ? 1.6 : 0.95,
      color: mix(b, a, Math.min(1, t * 1.2)),
      opacity: tip ? 1 : 0.45 + 0.5 * t,
    };
  });
}

const eifW = (y) => 0.57 * Math.exp(-y / 0.8) + 0.05;
const eifLeg = (y) => 0.26 + (0.185 - 0.26) * (y / 1.15);
const eifIn = (y) => Math.max(0, eifW(y) - eifLeg(y));

function eiffelBuild(k) {
  const brown = "#7d5c3d";
  const g0 = 0.04;
  const F1 = 0.57;
  const F2 = 1.15;
  const TOP = 2.76;
  const segs = [];
  const S = (a, b, w = 1) => segs.push([a, b, w]);
  // The legs: square trusses whose four chords follow the curve.
  const legLevels = [];
  for (let i = 0; i <= 15; i++) legLevels.push(g0 + (F2 - g0) * Math.pow(i / 15, 0.92));
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const corner = (j, y) => {
        const w = eifW(y);
        const n = eifIn(y);
        const cs = [
          [w, w],
          [n, w],
          [n, n],
          [w, n],
        ][j];
        return [sx * cs[0], y, sz * cs[1]];
      };
      for (let i = 0; i < legLevels.length - 1; i++) {
        const y0 = legLevels[i];
        const y1 = legLevels[i + 1];
        for (let j = 0; j < 4; j++) {
          const jn = (j + 1) % 4;
          S(corner(j, y0), corner(j, y1), 2.6);
          S(corner(j, y0), corner(jn, y1), 0.7);
          S(corner(jn, y0), corner(j, y1), 0.7);
          S(corner(j, y0), corner(jn, y0), 0.9);
        }
      }
    }
  // The shaft above the second floor.
  const shaftLevels = [];
  for (let i = 0; i <= 22; i++) shaftLevels.push(F2 + (TOP - F2) * (i / 22));
  const sc = (j, y) => {
    const w = eifW(y);
    return [
      [w, y, w],
      [-w, y, w],
      [-w, y, -w],
      [w, y, -w],
    ][j];
  };
  for (let i = 0; i < shaftLevels.length - 1; i++) {
    const y0 = shaftLevels[i];
    const y1 = shaftLevels[i + 1];
    for (let j = 0; j < 4; j++) {
      const jn = (j + 1) % 4;
      S(sc(j, y0), sc(j, y1), 2.4);
      S(sc(j, y0), sc(jn, y1), 0.6);
      S(sc(jn, y0), sc(j, y1), 0.6);
      S(sc(j, y0), sc(jn, y0), 0.8);
    }
  }
  // Girders joining the legs under the first floor, and the arches.
  for (let j = 0; j < 4; j++) {
    const rot = (p) => rotY(p, (j * Math.PI) / 2);
    const y = F1 - 0.04;
    const w = eifW(y);
    const n = eifIn(y);
    S(rot([-n, y, w]), rot([n, y, w]), 1.6);
    S(rot([-n, y - 0.05, w + 0.004]), rot([n, y - 0.05, w + 0.004]), 1.2);
    for (let i = 0; i < 12; i++) {
      const x0 = -n + (2 * n * i) / 12;
      const x1 = -n + (2 * n * (i + 1)) / 12;
      S(rot([x0, y, w]), rot([x1, y - 0.05, w]), 0.5);
    }
    const arch = (s, off) => {
      const yy = 0.2 + off + (0.31 - off * 0.5) * Math.pow(Math.cos((s * Math.PI) / 2), 0.75);
      return rot([s * (eifIn(yy) + 0.004), yy, eifW(yy) + 0.003]);
    };
    const N = 28;
    for (let i = 0; i < N; i++) {
      const s0 = -1 + (2 * i) / N;
      const s1 = -1 + (2 * (i + 1)) / N;
      S(arch(s0, 0), arch(s1, 0), 1.3);
      S(arch(s0, 0.035), arch(s1, 0.035), 1.0);
      S(arch(s0, i % 2 ? 0 : 0.035), arch(s1, i % 2 ? 0.035 : 0), 0.45);
    }
  }
  const lat = (p, d, rand) => {
    const w = Math.max(0.06, eifW(p[1]));
    const side = (p[0] * SUN[0] + p[2] * SUN[2]) / w;
    const f = 0.78 + 0.16 * side + 0.08 * (rand() - 0.5) + 0.08 * smoothstep(0, 2.8, p[1]);
    return shade(brown, f);
  };
  // The ironwork glows gold at night as channel 1 rises towards 1 (its
  // floodlights: drive() holds the channel partway for a warm wash).
  lattice(k, segs, {
    share: 0.56,
    size: 0.75,
    stretch: 2.4,
    color: lat,
    more: () => ({ kind: "band", channel: 1, params: [1, 0.5] }),
  });
  // Sparkle lights on the ironwork, shown only while the tower is lit (so
  // they are coloured as the lit iron). Each flashes once as channel 0
  // passes it: drive() runs the channel up, and lower lights come a little
  // earlier, so the sparkle climbs.
  lattice(k, segs, {
    share: 0.06,
    size: 1.35,
    stretch: 1,
    color: (p, d, rand) => mix(lat(p, d, rand), "#f2b865", 0.6),
    part: k.part("sparkle", { pivot: [0, 1.4, 0] }),
    pattern: false,
    more: (p, rand) => ({
      kind: "band",
      channel: 0,
      params: [0.06 + 0.5 * (p[1] / TOP) + 0.38 * rand(), 0.06],
    }),
  });
  // Fireworks round the tower (drive() pops them one after another).
  // Each is built at EIF_BUILT of its size, inside the tower's reach, and
  // grown by its part.
  EIF_BURSTS.forEach((B, i) =>
    burst(k, k.part(`burst${i}`, { pivot: B.c }), B.c, B.r * EIF_BUILT, B.a, B.b, 0.03),
  );
  // The top: a deck, the lantern and the antenna.
  const iron = (c) => lit(brown, c, 0.62);
  k.add(roundBox(0.19, 0.04, 0.19, 0.006), { pos: [0, TOP, 0], flat: 0.2, weight: 2, color: iron });
  k.add(k.box(0.11, 0.12, 0.11), {
    pos: [0, TOP + 0.08, 0],
    flat: 0.2,
    weight: 2,
    color: (c) =>
      Math.abs(c.n[1]) < 0.5 && Math.abs(c.p[1] - TOP - 0.09) < 0.025 ? keep("#e7dcc2") : iron(c),
  });
  k.add(k.cylinder(0.035, 0.07), { pos: [0, TOP + 0.175, 0], weight: 2, color: iron });
  rod(
    k,
    [0, TOP + 0.2, 0],
    [0, 3.24, 0],
    0.012,
    { weight: 3, color: (c) => ((c.p[1] * 30) % 1 < 0.5 ? "#e8e4dc" : "#c8362b") },
    0.005,
  );
  // The floors: a gallery ring on the first, a solid deck on the second.
  const deck = (c) => {
    if (c.n[1] > 0.5) return lit("#9a7a55", c);
    const band = Math.abs(((c.p[0] + c.p[2]) * 40) % 1) < 0.35;
    return lit(band ? "#5f4630" : "#8e6d4a", c);
  };
  const r1 = eifW(F1) + 0.025;
  for (let j = 0; j < 4; j++) {
    const a = (j * Math.PI) / 2;
    k.add(k.box(2 * r1, 0.06, 0.07), {
      pos: rotY([0, F1, r1 - 0.035], a),
      rot: [0, a * DEG, 0],
      flat: 0.2,
      weight: 1.3,
      color: deck,
    });
  }
  const r2 = eifW(F2) + 0.02;
  k.add(k.box(2 * r2, 0.045, 2 * r2), { pos: [0, F2, 0], flat: 0.2, weight: 1.3, color: deck });
  // Stone piers and the park.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      k.add(k.box(0.3, 0.05, 0.3), {
        pos: [sx * 0.47, g0 + 0.005, sz * 0.47],
        flat: 0.2,
        color: (c) => lit("#b8ad98", c),
      });
  k.add(k.box(2.1, g0, 2.1), {
    pos: [0, g0 / 2, 0],
    pattern: false,
    flat: 0.2,
    color: (c) => {
      if (c.n[1] < 0.5) return lit("#7a6a52", c);
      const [x, , z] = c.p;
      const lawn =
        Math.abs(x) > 0.16 && Math.abs(z) > 0.16 && Math.max(Math.abs(x), Math.abs(z)) < 0.98;
      if (lawn && Math.hypot(x, z) > 0.78) return grass(c);
      return lit(shade("#d6c7a4", 0.92 + 0.12 * c.noise(x * 20, 0, z * 20)), c);
    },
  });
}

// ---- Washington monument ---------------------------------------------------------------------

// Bearings round the monument as 0..1, with the home view at 0.5, so the
// shadow's sweep past the front of the lawn never wraps.
const MON_VIEW = 0.55;
const monBearing = (p) => {
  const b = Math.atan2(p[0], p[2]) / TAU - MON_VIEW / TAU + 0.5;
  return b - Math.floor(b);
};
// The sun on its arc behind the monument, u from sunrise (0) to sunset (1).
const monSun = (u) => {
  const th = MON_VIEW + Math.PI + (u - 0.5) * Math.PI;
  const e = 0.12 + 0.95 * Math.sin(Math.PI * u);
  return [Math.sin(th) * Math.cos(e) * 1.02, 0.14 + Math.sin(e) * 0.98, Math.cos(th) * Math.cos(e) * 1.02]; // prettier-ignore
};
const MON_SECS = 4.6;

function monumentBuild(k) {
  const y0 = 0.1;
  const hb = 0.084;
  const ht = 0.0525;
  const H = 1.52;
  const tip = 1.693;
  const marble = "#ece6d8";
  const face = (c) => {
    const y = c.p[1] - y0;
    const along = Math.abs(c.n[0]) > Math.abs(c.n[2]) ? c.p[2] : c.p[0];
    if (y > 1.43 && y < 1.46 && Math.abs(Math.abs(along) - 0.018) < 0.006) return keep("#2c2c2c");
    let base = y < 0.46 ? "#f1ead9" : marble;
    if (Math.abs(y - 0.46) < 0.004) base = "#d8cfbd";
    const course = (y / 0.018) % 1 < 0.06;
    return lit(shade(base, course ? 0.95 : 1), c, 0.62);
  };
  for (let j = 0; j < 4; j++) {
    const r = (p) => rotY(p, (j * Math.PI) / 2);
    const a = r([-hb, y0, hb]);
    const b = r([hb, y0, hb]);
    const c = r([ht, y0 + H, ht]);
    const d = r([-ht, y0 + H, ht]);
    k.add(quad(k, a, b, c, d), { flat: 0.2, weight: 2.2, color: face });
    const apex = [0, y0 + tip, 0];
    k.add(quad(k, d, c, apex, apex), {
      flat: 0.2,
      weight: 2.2,
      color: (cc) => lit(marble, cc, 0.62),
    });
  }
  // The plaza, the ring of flags and the grassy knoll. The ground carries
  // the obelisk's shadow: a band on channel 0 darkens each splat as the
  // channel passes its bearing (drive() sweeps it round like a sundial's).
  const shadow = {
    kind: "band",
    channel: 0,
    params: (c) => {
      const r = Math.hypot(c.p[0], c.p[2]);
      if (r < 0.09 || r > 0.8 || c.n[1] < 0.3) return [5, 0.01];
      const hw = 1.5 * (0.012 + 0.074 * (1 - r / 1.35));
      return [monBearing(c.p), hw / (r * TAU)];
    },
  };
  k.add(k.box(0.26, 0.03, 0.26), {
    ...shadow,
    pos: [0, y0 - 0.015, 0],
    flat: 0.2,
    color: (c) => lit("#d9d2c2", c),
  });
  k.add(k.cylinder(0.46, 0.02), {
    ...shadow,
    pos: [0, y0 - 0.04, 0],
    flat: 0.2,
    color: (c) => {
      const r = Math.hypot(c.p[0], c.p[2]);
      return lit(Math.abs(r - 0.4) < 0.012 ? "#bdb4a2" : "#ddd6c6", c);
    },
  });
  k.add(
    k.lathe(
      [
        [0.78, 0.0],
        [0.6, y0 - 0.075],
        [0.35, y0 - 0.045],
        [0.0, y0 - 0.04],
      ],
      { grid: 64, thick: 0.05 },
    ),
    { ...shadow, flat: 0.2, pattern: false, color: (c) => grass(c, "#62a34a") },
  );
  // The sun that casts it, built at noon behind the monument (hidden at
  // rest; drive() carries it along its arc, and it fades in and out by
  // channel 1 at sunrise and sunset).
  const sun = k.part("sun", { pivot: monSun(0.5) });
  const sunFade = { kind: "fade", channel: 1, params: [0.02, -0.4] };
  k.add(k.sphere(0.065), {
    part: sun,
    pos: monSun(0.5),
    weight: 4,
    pattern: false,
    fit: false,
    ...sunFade,
    color: (c) => keep(mix("#fff6c2", "#ffd24a", 0.5 - 0.5 * c.n[1])),
  });
  k.cloud({ share: 0.006, size: 2.4, pattern: false, part: sun, fit: false }, (rand) => {
    const d = unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
    return {
      p: add(monSun(0.5), mul(d, 0.07 + 0.06 * Math.sqrt(rand()))),
      color: "#ffe27a",
      opacity: 0.22,
      ...sunFade,
    };
  });
  for (let i = 0; i < 50; i++) {
    const a = (i / 50) * TAU;
    const base = [Math.sin(a) * 0.4, y0 - 0.03, Math.cos(a) * 0.4];
    flag(k, base, 0.19, 0.1, 0.06, usFlag, { dir: [-0.9, 0, -0.44], poleR: 0.0025 });
  }
}

// ---- Pyramids of Giza --------------------------------------------------------------------------

function pyramid(k, cx, cy, cz, half, h, { cap = 0, weight = 1 } = {}) {
  const apex = [cx, cy + h, cz];
  const sand = "#d8b779";
  const casing = "#efe2c3";
  for (let j = 0; j < 4; j++) {
    const r = (p) => add(rotY(p, (j * Math.PI) / 2), [cx, cy, cz]);
    const a = r([-half, 0, half]);
    const b = r([half, 0, half]);
    k.add(quad(k, a, b, apex, apex), {
      flat: 0.2,
      weight,
      interior: 0.04,
      core: "#9c7d4c",
      color: (c) => {
        const y = c.p[1] - cy;
        if (cap && y > h * (1 - cap))
          return lit(
            shade(casing, 0.95 + 0.08 * c.noise(c.p[0] * 40, y * 40, c.p[2] * 40)),
            c,
            0.55,
          );
        const along = Math.abs(c.n[0]) > Math.abs(c.n[2]) ? c.p[2] : c.p[0];
        const col = stone(c, sand, along, y, {
          course: 0.028,
          block: 0.06,
          mortar: 0.14,
          vary: 0.16,
        });
        const wear = 0.9 + 0.14 * c.fbm(c.p[0] * 6, y * 6, c.p[2] * 6);
        return lit(shade(col, wear), c, 0.55);
      },
    });
  }
}

// Where the saucer hovers (over the sand in front of the Great Pyramid, so
// from the home view it floats by the Great Pyramid's top), and the patch
// of sand it lifts. The camel faces screen right (r), side on to the view.
const PYR = {
  r: [0.85, 0, -0.52],
  f: [0.52, 0, 0.85],
  ground: [1.6, 0, 0.5],
  hover: [1.6, 1.34, 0.5],
  secs: 5.4,
};

// A dromedary as a few simple solids in its own frame (x forward, y up, z
// to its left): [kind, centre or ends, radii], sampled by area.
const CAMEL = [
  ["ell", [0, 0.27, 0], [0.19, 0.09, 0.085]],
  ["ell", [-0.01, 0.35, 0], [0.09, 0.085, 0.06]],
  ["rod", [0.12, 0.22, 0.045], [0.13, 0.0, 0.05], 0.022],
  ["rod", [0.12, 0.22, -0.045], [0.1, 0.0, -0.05], 0.022],
  ["rod", [-0.12, 0.22, 0.045], [-0.1, 0.0, 0.05], 0.022],
  ["rod", [-0.12, 0.22, -0.045], [-0.14, 0.0, -0.05], 0.022],
  ["rod", [0.15, 0.28, 0], [0.25, 0.36, 0], 0.035],
  ["rod", [0.25, 0.36, 0], [0.29, 0.46, 0], 0.03],
  ["ell", [0.33, 0.47, 0], [0.065, 0.033, 0.03]],
  ["rod", [-0.18, 0.28, 0], [-0.22, 0.17, 0], 0.01],
];

// A point on the camel's surface and its normal, in its own frame.
function camelPoint(rand) {
  const area = (sh) =>
    sh[0] === "ell"
      ? 4 * Math.PI * Math.pow((sh[2][0] * sh[2][1] + sh[2][0] * sh[2][2] + sh[2][1] * sh[2][2]) / 3, 1) // prettier-ignore
      : TAU * sh[3] * len(sub(sh[2], sh[1]));
  const total = CAMEL.reduce((a, sh) => a + area(sh), 0);
  let x = rand() * total;
  let sh = CAMEL[0];
  for (const it of CAMEL) {
    sh = it;
    x -= area(it);
    if (x <= 0) break;
  }
  const d = unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
  if (sh[0] === "ell") {
    const [a, b, c] = sh[2];
    return { p: add(sh[1], [d[0] * a, d[1] * b, d[2] * c]), n: unit([d[0] / a, d[1] / b, d[2] / c]) }; // prettier-ignore
  }
  const t = rand();
  const ax = unit(sub(sh[2], sh[1]));
  const side = unit(sub(d, mul(ax, dot(d, ax))));
  return { p: add(lerp3(sh[1], sh[2], t), mul(side, sh[3])), n: side };
}

function pyramidsBuild(k) {
  const r = PYR.r;
  const f = PYR.f;
  const at = (s, d) => add(mul(r, s), mul(f, d));
  const khufu = at(1.25, -0.45);
  const khafre = at(-0.72, -0.85);
  const menk = at(-1.5, 0.95);
  pyramid(k, khufu[0], 0, khufu[2], 1.15, 1.44);
  pyramid(k, khafre[0], 0.08, khafre[2], 1.06, 1.4, { cap: 0.2 });
  pyramid(k, menk[0], 0, menk[2], 0.52, 0.66);
  // Three little queens' pyramids beside the smallest.
  for (let i = 0; i < 3; i++) {
    const p = add(menk, at(0.85 + i * 0.52, 0.45));
    pyramid(k, p[0], 0, p[2], 0.17, 0.2);
  }
  // A small sphinx keeps watch in front.
  const sp = add(khafre, at(1.25, 1.95));
  const lion = "#c9a468";
  const skin = (c) =>
    lit(shade(lion, 0.88 + 0.16 * c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30)), c, 0.55);
  const yaw = Math.atan2(f[0], f[2]);
  const S = (p) => add(sp, rotY(p, yaw));
  const R = [0, yaw * DEG, 0];
  const B = { rot: R, flat: 0.2, color: skin };
  k.add(roundBox(0.2, 0.14, 0.56, 0.06), { ...B, pos: S([0, 0.07, -0.05]), weight: 1.5 });
  for (const s of [-1, 1])
    k.add(roundBox(0.06, 0.05, 0.26, 0.02), { ...B, pos: S([s * 0.07, 0.025, 0.3]), weight: 2 });
  k.add(roundBox(0.12, 0.13, 0.12, 0.04), { ...B, pos: S([0, 0.19, 0.2]), weight: 2 });
  k.add(roundBox(0.18, 0.1, 0.05, 0.02), { ...B, pos: S([0, 0.18, 0.15]), weight: 2 });
  // The desert.
  const cx = -0.35;
  const cz = 0.05;
  k.add(k.cylinder(2.45, 0.08), {
    pos: [cx, -0.04, cz],
    pattern: false,
    flat: 0.2,
    color: (c) => {
      if (c.s.side) return lit("#b38f58", c);
      const n = c.fbm(c.p[0] * 1.3, 0, c.p[2] * 1.3);
      const ripple = Math.sin(c.p[0] * 30 + c.p[2] * 12 + n * 6) * 0.03;
      return lit(shade("#e2c48c", 0.92 + 0.12 * n + ripple), c);
    },
  });
  // The visitor: a tiny saucer (hidden at rest), its beam, and grains of
  // sand buried under the desert that rise into the shape of a camel
  // (channel 0) and float up into the saucer with their part.
  miniSaucer(k, k.part("ufo", { pivot: PYR.hover }), PYR.hover, 0.2);
  const top = add(PYR.hover, [0, -0.06, 0]);
  k.cloud({ share: 0.008, size: 1.6, pattern: false, fit: false }, (rand) => {
    const t = rand();
    const R = 0.08 + 0.34 * t;
    const a = rand() * TAU;
    const edge = rand() < 0.7;
    const rr = edge ? R * (0.9 + 0.1 * rand()) : R * Math.sqrt(rand());
    return {
      p: add(lerp3(top, PYR.ground, t), [Math.sin(a) * rr, 0.01, Math.cos(a) * rr]),
      color: mix("#b9fff0", "#f2fffc", rand()),
      opacity: edge ? 0.07 : 0.035,
      kind: "fade",
      channel: 1,
      params: [0.2 + 0.3 * t, -0.3],
    };
  });
  const camel = k.part("camel", { pivot: add(PYR.ground, [0, 0.4, 0]) });
  const side = cross(r, [0, 1, 0]);
  k.cloud({ share: 0.035, size: 1.1, pattern: false, part: camel }, (rand) => {
    const { p: cp, n: cn } = camelPoint(rand);
    const S = 1.45;
    const to = add(PYR.ground, add(add(mul(r, cp[0] * S), [0, cp[1] * S + 0.02, 0]), mul(side, cp[2] * S))); // prettier-ignore
    const n = unit(add(add(mul(r, cn[0]), [0, cn[1], 0]), mul(side, cn[2])));
    const g = add(PYR.ground, add(mul(r, cp[0]), mul(side, cp[2] * 1.5 + (rand() - 0.5) * 0.14))); // prettier-ignore
    const light = 0.62 + 0.38 * Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]);
    return {
      p: [g[0], -0.025, g[2]],
      color: shade(mix("#d6ad6c", "#ecd09a", rand() * 0.5), light),
      kind: "morph",
      channel: 0,
      to,
    };
  });
  for (let i = 0; i < 7; i++) {
    const a = k.rand() * TAU;
    const d = 1.75 + k.rand() * 0.45;
    const s = 0.3 + k.rand() * 0.35;
    k.add(k.ellipsoid(s * 1.8, s * 0.22, s), {
      pos: [cx + Math.sin(a) * d, 0, cz + Math.cos(a) * d],
      rot: [0, a * DEG + 40, 0],
      pattern: false,
      flat: 0.3,
      color: (c) => (c.n[1] < 0 ? null : lit("#e0c08a", c)),
    });
  }
}

// A tiny flying saucer (the Flying saucer toy's look), centred on C with a
// hull radius of 1.5 * s, on `part`. Left out of the fit: it flies in.
function miniSaucer(k, part, C, s) {
  const S = { part, flat: 0.2, fit: false, pattern: false };
  const hull = k.lathe(
    [
      [0.0, -0.3],
      [0.55, -0.27],
      [1.05, -0.16],
      [1.42, -0.03],
      [1.5, 0.03],
      [1.42, 0.09],
      [1.02, 0.2],
      [0.62, 0.29],
      [0.44, 0.31],
    ],
    { grid: 64 },
  );
  k.add(hull, {
    ...S,
    pos: C,
    scale: s,
    weight: 3,
    color: (c) => {
      const r = Math.hypot(c.lp[0], c.lp[2]);
      let base = mix("#8a9099", "#eef1f5", smoothstep(-0.6, 0.9, c.n[1]));
      if (Math.abs(c.lp[1] - 0.03) < 0.04 && r > 1.38) base = "#5d636c";
      return mix(base, "#ffffff", Math.pow(Math.max(0, sunOf(c.n)), 12) * 0.35);
    },
  });
  k.add(k.sphere(0.46), {
    ...S,
    pos: add(C, [0, 0.28 * s, 0]),
    scale: s,
    weight: 3,
    opacity: 0.55,
    color: (c) => (c.lp[1] < 0 ? null : mix("#2f7f9f", "#bfeaf5", smoothstep(0, 0.9, sunOf(c.n)))),
  });
  k.add(k.sphere(0.17), { ...S, pos: add(C, [0, 0.45 * s, 0]), scale: s, weight: 4, color: "#6fd35a" }); // prettier-ignore
  const bulbs = ["#ff4d6d", "#ffd23f", "#3ee6ff", "#7cff6b", "#c77dff"];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    k.add(k.sphere(0.07), {
      ...S,
      pos: add(C, mul([Math.sin(a) * 1.46, 0.035, Math.cos(a) * 1.46], s)),
      scale: s,
      weight: 6,
      color: bulbs[i % bulbs.length],
    });
  }
  k.add(k.torus(0.5, 0.07), { ...S, pos: add(C, [0, -0.28 * s, 0]), scale: s, weight: 4, color: "#8ff7ff" }); // prettier-ignore
}

// ---- Twisting supertall ------------------------------------------------------------------------

// A rounded square outline, evenly spaced by length: u -> [x, z, nx, nz].
function roundedSquare(round = 0.28, n = 480) {
  const pts = [];
  const e = 2 / (2 + 6 * (1 - round));
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pts.push([Math.sign(c) * Math.pow(Math.abs(c), e), Math.sign(s) * Math.pow(Math.abs(s), e)]);
  }
  const cum = [0];
  for (let i = 1; i <= n; i++)
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[n];
  return (u) => {
    const target = (((u % 1) + 1) % 1) * L;
    let lo = 0;
    let hi = n;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid;
      else hi = mid;
    }
    const t = (target - cum[lo]) / (cum[hi] - cum[lo] || 1);
    const x = lerp(pts[lo][0], pts[hi][0], t);
    const z = lerp(pts[lo][1], pts[hi][1], t);
    const tx = pts[hi][0] - pts[lo][0];
    const tz = pts[hi][1] - pts[lo][1];
    const tl = Math.hypot(tx, tz) || 1;
    return [x, z, tz / tl, -tx / tl];
  };
}

// The supertall's floors turn as ST.bands rigid bands (drive() twists them
// further, each by its height), and a ring of light runs up the glass.
const ST = { H: 3.2, y0: 0.14, bands: 12, twist: 0.95, secs: 4.0 };

function supertallBuild(k, o) {
  const H = ST.H;
  const y0 = ST.y0;
  const twist = 1.75;
  const floorsOf = [];
  for (let i = 0; i < ST.bands; i++)
    floorsOf.push(k.part(`floor${i}`, { pivot: [0, y0 + (H * (i + 0.5)) / ST.bands, 0] }));
  const bandOf = (y) => floorsOf[clamp(Math.floor(((y - y0) / H) * ST.bands), 0, ST.bands - 1)];
  const topPart = floorsOf[ST.bands - 1];
  const size = (v) => lerp(0.36, 0.15, Math.pow(v, 1.1));
  const sq = roundedSquare(0.35);
  const at = (u, v) => {
    const [x, z, nx, nz] = sq(u);
    const s = size(v);
    const th = v * twist;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    return {
      p: [s * (x * c - z * sn), y0 + H * v, s * (x * sn + z * c)],
      n: [nx * c - nz * sn, 0.06, nx * sn + nz * c],
    };
  };
  const tint = o.glass;
  const floors = 44;
  const skin = k.param((u, v) => at(u, v).p, { grid: 128, normal: (u, v) => at(u, v).n, thick: 0.2 }); // prettier-ignore
  const glassColor = (c) => {
    const v = (c.p[1] - y0) / H;
    const f = (v * floors) % 1;
    const mull = (c.u * 40) % 1 < 0.12;
    const face = sunOf(c.n);
    const glassC = mix(
      shade(tint, 0.62),
      "#cfe6f5",
      clamp(0.08 + 0.62 * Math.max(0, face) + 0.18 * v, 0, 0.85),
    );
    if (v > 0.965) return keep(shade("#e8eef2", 0.8 + 0.2 * face));
    if (f < 0.2) return keep(shade(mix(tint, "#1c2833", 0.6), 0.8 + 0.3 * Math.max(0, face)));
    if (mull) return keep(mix(glassC, "#d7dee3", 0.22));
    return glassC;
  };
  // The glass carries the running light (channel 0 passing its height); a
  // thin second layer keeps the glints.
  k.add(skin, {
    flat: 0.15,
    jitter: 0.015,
    interior: 0.05,
    core: "#39414a",
    part: (c) => bandOf(c.p[1]),
    kind: "band",
    channel: 0,
    params: (c) => (c.inside ? [5, 0.01] : [(c.p[1] - y0) / H, 0.07]),
    color: glassColor,
  });
  k.add(skin, {
    share: 0.008,
    flat: 0.15,
    jitter: 0.015,
    part: (c) => bandOf(c.p[1]),
    kind: "glint",
    params: [0.5, 0],
    color: glassColor,
  });
  // The crown and spire with a beacon.
  const topY = y0 + H;
  const ts = size(1);
  k.add(k.cone(ts * 0.9, ts * 0.35, 0.18), {
    part: topPart,
    pos: [0, topY + 0.09, 0],
    flat: 0.2,
    color: (c) => lit("#dfe6ea", c, 0.6),
  });
  rod(
    k,
    [0, topY + 0.18, 0],
    [0, topY + 0.72, 0],
    0.03,
    { part: topPart, weight: 2, color: (c) => lit("#cfd6db", c, 0.6) },
    0.006,
  );
  k.add(k.sphere(0.02), {
    part: topPart,
    pos: [0, topY + 0.73, 0],
    weight: 4,
    pattern: false,
    kind: "twinkle",
    params: [0.9, 0],
    color: "#ff3b30",
  });
  // A podium with a dark glass lobby.
  k.add(roundBox(1.05, 0.14, 1.05, 0.02), {
    pos: [0, 0.07, 0],
    flat: 0.2,
    color: (c) => {
      if (c.n[1] > 0.5) return lit("#b9bfc4", c);
      return keep(c.p[1] < 0.11 ? shade("#24313c", 0.8 + 0.3 * sunOf(c.n)) : lit("#cfd4d8", c));
    },
  });
  // Neighbours for scale, a plaza and trees.
  const block = (x, z, w, d, h, col) =>
    k.add(k.box(w, h, d), {
      pos: [x, h / 2, z],
      pattern: false,
      flat: 0.2,
      color: (c) => {
        if (c.n[1] > 0.5) return lit(shade(col, 0.8), c);
        const along = Math.abs(c.n[0]) > 0.5 ? c.p[2] : c.p[0];
        const win = (c.p[1] / 0.06) % 1 > 0.35 && (along / 0.05) % 1 > 0.3;
        return lit(win ? mix(col, "#2e3d4c", 0.6) : col, c);
      },
    });
  block(-0.95, -0.55, 0.42, 0.5, 0.62, "#c9c2b5");
  block(0.9, -0.75, 0.46, 0.4, 0.45, "#b9c3cc");
  block(-0.85, 0.65, 0.36, 0.36, 0.34, "#d8cfc0");
  ground(k, 1.45, 0, (c) => {
    const r = Math.hypot(c.p[0], c.p[2]);
    if (r > 1.15) return grass(c);
    const tile = (Math.floor(c.p[0] * 12) + Math.floor(c.p[2] * 12)) % 2 ? 0.95 : 1.02;
    return lit(shade("#cfcac0", tile), c);
  });
  for (let i = 0; i < 9; i++) {
    const a = 0.3 + (i / 9) * TAU;
    tree(k, [Math.sin(a) * 1.28, 0, Math.cos(a) * 1.28], 0.09);
  }
}

// ---- Lighthouse ------------------------------------------------------------------------------

const LIGHT = { lamp: [0, 2.5, 0] };

function lighthouseBuild(k, o) {
  const red = o.color;
  const white = "#f5f3ee";
  // Rocks and a grassy top.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + k.rand() * 0.3;
    const d = 0.55 + k.rand() * 0.55;
    const s = 0.2 + k.rand() * 0.22;
    const g = 0.4 + k.rand() * 0.2;
    k.add(k.ellipsoid(s * 1.3, s * 0.8, s), {
      pos: [Math.sin(a) * d, 0.05 + s * 0.25, Math.cos(a) * d],
      rot: [k.rand() * 20, a * DEG, k.rand() * 20],
      pattern: false,
      flat: 0.3,
      color: (c) => {
        const n = c.fbm(c.p[0] * 8, c.p[1] * 8, c.p[2] * 8);
        return lit(mix([g, g * 0.96, g * 0.9], "#3a3632", 0.3 + 0.35 * n), c, 0.6);
      },
    });
  }
  k.add(k.ellipsoid(0.95, 0.3, 0.85), {
    pos: [0, 0.12, 0],
    pattern: false,
    flat: 0.25,
    color: (c) =>
      c.n[1] > 0.55
        ? grass(c, "#6aa84f")
        : lit(shade("#77706a", 0.9 + 0.2 * c.noise(c.p[0] * 9, c.p[1] * 9, c.p[2] * 9)), c),
  });
  // The striped tower.
  const t0 = 0.34;
  const t1 = 2.3;
  const face = 0.55;
  k.add(k.cone(0.34, 0.21, t1 - t0, { caps: false }), {
    pos: [0, (t0 + t1) / 2, 0],
    flat: 0.2,
    interior: 0.05,
    core: "#8d8a85",
    color: (c) => {
      const y = c.p[1];
      let da = c.u * TAU - face;
      da = ((((da + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
      const r = Math.hypot(c.p[0], c.p[2]);
      if (Math.abs(da * r) < 0.07 && y < t0 + 0.25) return keep("#3a2a1e");
      for (const [wy, wa] of [
        [0.95, 0.4],
        [1.55, -0.35],
        [2.05, 0.3],
      ])
        if (Math.abs((da - wa) * r) < 0.03 && Math.abs(y - wy) < 0.05) return keep("#1f2a33");
      const band = Math.floor((y - t0) / 0.39) % 2 === 1;
      return lit(band ? red : white, c);
    },
  });
  // Gallery, railing, lantern and roof.
  k.add(k.cylinder(0.32, 0.05), {
    pos: [0, t1 + 0.02, 0],
    flat: 0.2,
    color: (c) => lit("#2d2f33", c),
  });
  k.add(k.torus(0.31, 0.007), { pos: [0, t1 + 0.14, 0], weight: 3, color: "#2d2f33" });
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU;
    const p = [Math.sin(a) * 0.31, t1 + 0.04, Math.cos(a) * 0.31];
    rod(k, p, add(p, [0, 0.1, 0]), 0.005, { weight: 3, color: "#2d2f33" });
  }
  k.add(k.cylinder(0.17, 0.3, { caps: false }), {
    pos: [0, t1 + 0.2, 0],
    flat: 0.2,
    pattern: false,
    color: (c) => {
      if ((c.u * 8) % 1 < 0.12) return "#2d2f33";
      return mix("#fff3b0", "#ffd24a", smoothstep(0.1, 0.17, Math.abs(c.p[1] - LIGHT.lamp[1])));
    },
  });
  k.add(k.sphere(0.1), {
    pos: LIGHT.lamp,
    weight: 3,
    pattern: false,
    kind: "twinkle",
    params: [0.25, 0],
    color: "#fffbe0",
  });
  k.add(k.cone(0.23, 0.02, 0.24), {
    pos: [0, t1 + 0.47, 0],
    flat: 0.2,
    color: (c) => lit(red, c, 0.6),
  });
  k.add(k.sphere(0.035), { pos: [0, t1 + 0.61, 0], weight: 3, color: (c) => lit("#2d2f33", c) });
  // The keeper's cottage.
  const hx = 0.62;
  const hz = 0.28;
  k.add(k.box(0.46, 0.28, 0.34), {
    pos: [hx, 0.52, hz],
    flat: 0.2,
    color: (c) => {
      if (c.n[2] > 0.5 && Math.abs(c.p[0] - hx) < 0.05 && c.p[1] < 0.6) return keep("#3a2a1e");
      if (Math.abs(c.n[0]) > 0.5 && Math.abs(c.p[2] - hz) < 0.05 && Math.abs(c.p[1] - 0.55) < 0.05)
        return keep("#1f2a33");
      return lit(white, c);
    },
  });
  for (const s of [-1, 1])
    k.add(
      quad(
        k,
        [hx - 0.26, 0.66, hz + s * 0.2],
        [hx + 0.26, 0.66, hz + s * 0.2],
        [hx + 0.26, 0.82, hz],
        [hx - 0.26, 0.82, hz],
      ),
      { flat: 0.2, color: (c) => lit(red, c, 0.62) },
    );
  for (const s of [-1, 1])
    k.add(
      quad(
        k,
        [hx + s * 0.23, 0.66, hz - 0.17],
        [hx + s * 0.23, 0.66, hz + 0.17],
        [hx + s * 0.23, 0.8, hz],
        [hx + s * 0.23, 0.8, hz],
      ),
      { flat: 0.2, color: (c) => lit(white, c) },
    );
  // The beam: two cones of faint light that sweep round.
  const beam = k.part("beam", { pivot: LIGHT.lamp, axis: [0, 1, 0] });
  k.cloud({ share: 0.06, size: 2.4, pattern: false, part: beam }, (rand) => {
    const s = rand() < 0.5 ? -1 : 1;
    const t = Math.pow(rand(), 0.8);
    const R = 0.07 + 0.32 * t;
    const a = rand() * TAU;
    const rr = R * Math.sqrt(rand());
    return {
      p: add(LIGHT.lamp, [s * (0.12 + 1.75 * t), Math.sin(a) * rr, Math.cos(a) * rr]),
      color: mix("#fff8d0", "#fff1a0", rand()),
      opacity: 0.16 * (1 - 0.75 * t),
    };
  });
  // The sea.
  water(k, 0.06, 2.0, 2.0, {
    share: 0.18,
    deep: "#1e5f86",
    light: "#5cb1d4",
    mask: (x, z) => Math.hypot(x / 0.95, z / 0.85) > 0.92,
    foam: (x, z) => smoothstep(1.35, 1.0, Math.hypot(x / 0.95, z / 0.85)),
  });
}

// ---- Statue of Liberty ------------------------------------------------------------------------

// A local frame: an origin, a turn about Y and a scale, for modelling a
// figure facing +Z and then turning it to face the viewer.
function frame(origin, yaw, s) {
  const q = quatAxisAngle([0, 1, 0], yaw);
  return {
    p: (l) => add(origin, rotY(mul(l, s), yaw)),
    q: (lq = [0, 0, 0, 1]) => quatMul(q, lq),
    s,
  };
}

function libertyBuild(k) {
  const green = "#72b39c";
  const deep = "#4f8f7b";
  const patina = (c, amb = 0.52) => {
    const n = c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40);
    return lit(mix(green, deep, 0.25 + 0.25 * n), c, amb);
  };
  const granite = "#d3c9b3";
  // The island, the water and the star-shaped fort.
  ground(k, 0.84, 0, (c) => grass(c, "#5f9e48"), { edge: "#7c705c" });
  water(k, -0.01, 1.12, 1.12, {
    share: 0.08,
    deep: "#2a6a8e",
    light: "#6db6d4",
    mask: (x, z) => Math.hypot(x, z) > 0.82,
    foam: (x, z) => smoothstep(0.94, 0.82, Math.hypot(x, z)),
  });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU + 0.2;
    tree(k, [Math.sin(a) * 0.73, 0, Math.cos(a) * 0.73], 0.06 + 0.015 * Math.sin(i * 2.3));
  }
  const pts = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    const r = i % 2 ? 0.44 : 0.64;
    pts.push([Math.sin(a) * r, Math.cos(a) * r]);
  }
  const fortH = 0.07;
  const fortCol = (c) =>
    lit(shade("#b9ae98", 0.92 + 0.1 * c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30)), c);
  for (let i = 0; i < 22; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % 22];
    const nn = unit([z1 - z0, 0, -(x1 - x0)]);
    const n = dot(nn, [x0, 0, z0]) < 0 ? mul(nn, -1) : nn;
    k.add(quad(k, [x0, 0, z0], [x1, 0, z1], [x1, fortH, z1], [x0, fortH, z0], n), {
      flat: 0.2,
      color: fortCol,
    });
    if (i % 2 === 0) {
      const [xa, za] = pts[(i + 21) % 22];
      k.add(
        quad(k, [xa, fortH, za], [x1, fortH, z1], [x0, fortH, z0], [x0, fortH, z0], [0, 1, 0]),
        {
          flat: 0.2,
          color: fortCol,
        },
      );
    }
  }
  k.add(k.disc(0.46), {
    pos: [0, fortH, 0],
    flat: 0.2,
    color: (c) => (c.n[1] < 0 ? null : grass(c, "#6aa851")),
  });
  // The pedestal.
  const plain = (c) =>
    lit(shade(granite, 0.94 + 0.08 * c.noise(c.p[0] * 25, c.p[1] * 25, c.p[2] * 25)), c, 0.62);
  k.add(k.box(0.52, 0.09, 0.52), { pos: [0, fortH + 0.045, 0], flat: 0.2, color: plain });
  const y0 = fortH + 0.09;
  const y1 = 0.53;
  prism(
    k,
    4,
    0.2 * Math.SQRT2,
    0.17 * Math.SQRT2,
    y0,
    y1,
    {
      flat: 0.2,
      color: (c) => {
        const y = c.p[1];
        const along = Math.abs(c.n[0]) > Math.abs(c.n[2]) ? c.p[2] : c.p[0];
        if (y > 0.4 && y < 0.465) {
          const f = ((along + 0.2) / 0.055) % 1;
          if (Math.abs(f - 0.5) < 0.26) return keep(shade("#3e3a34", 0.9));
        }
        if (Math.abs(y - 0.39) < 0.006 || Math.abs(y - 0.475) < 0.006)
          return lit(shade(granite, 0.8), c);
        return plain(c);
      },
    },
    { a0: Math.PI / 4 },
  );
  k.add(k.box(0.43, 0.035, 0.43), { pos: [0, y1 + 0.0175, 0], flat: 0.2, color: plain });
  k.add(k.box(0.3, 0.06, 0.3), { pos: [0, y1 + 0.065, 0], flat: 0.2, color: plain });
  // The statue, modelled facing +Z and turned towards the viewer. Its
  // copper carries a warm light from the torch (channel 2: brightest near
  // the torch, see drive()).
  const F = frame([0, y1 + 0.095, 0], 0.5, 0.9);
  const S = F.s;
  const torchY = F.p([0, 0.998, 0])[1];
  const warm = {
    kind: "band",
    channel: 2,
    params: (c) => [1 + 0.4 * clamp((torchY - c.p[1]) / (torchY - y1), 0, 1), 0.5],
  };
  const P = { flat: 0.2, ...warm };
  const robeR = curve([
    [0, 0.17],
    [0.06, 0.15],
    [0.18, 0.125],
    [0.32, 0.113],
    [0.44, 0.118],
    [0.5, 0.112],
    [0.545, 0.06],
  ]);
  const robe = k.param(
    (u, v) => {
      const y = v * 0.545;
      const a = u * TAU;
      const r = robeR(y);
      const fold =
        1 +
        0.07 * Math.sin(a * 13 + y * 9 + Math.sin(a * 3) * 2) * (1 - 0.85 * v) +
        0.02 * Math.sin(a * 29 + y * 20);
      const rx = r * (1 + 0.28 * smoothstep(0.34, 0.5, y)) * fold;
      const rz = r * 0.82 * fold;
      return F.p([Math.sin(a) * rx, y, Math.cos(a) * rz]);
    },
    { grid: 110, thick: 0.08 },
  );
  k.add(robe, { ...P, interior: 0.04, core: "#4b6e62", color: (c) => patina(c) });
  // A drape falling from the left shoulder across the body.
  const drape = k.tube(
    (t) => F.p([0.1 - 0.2 * t, 0.49 - 0.2 * t, 0.075 + 0.02 * Math.sin(t * Math.PI)]),
    (t) => 0.022 + 0.01 * Math.sin(t * Math.PI),
  );
  k.add(drape, { ...P, weight: 1.5, color: (c) => patina(c) });
  // Head, crown and rays.
  k.add(k.cylinder(0.032, 0.08), {
    ...P,
    pos: F.p([0, 0.575, 0]),
    quat: F.q(),
    scale: S,
    color: (c) => patina(c),
  });
  k.add(k.sphere(0.058), {
    ...P,
    pos: F.p([0, 0.625, 0.006]),
    scale: S,
    weight: 1.6,
    color: (c) => patina(c, 0.58),
  });
  k.add(k.sphere(0.034), {
    ...P,
    pos: F.p([0, 0.635, -0.04]),
    scale: S,
    weight: 1.6,
    color: (c) => patina(c),
  });
  k.add(k.torus(0.057, 0.012), {
    ...P,
    pos: F.p([0, 0.66, 0]),
    quat: F.q(quatAxisAngle([1, 0, 0], -0.2)),
    scale: S,
    weight: 2,
    color: (c) => patina(c, 0.6),
  });
  // Seven rays fanning up and out from the crown: steep in front, lower at
  // the sides, each a long taper to a sharp point that catches the light.
  for (let i = 0; i < 7; i++) {
    const ph = ((-75 + i * 25) * Math.PI) / 180;
    const e = 0.46 + 0.2 * (1 - Math.abs(ph) / ((75 * Math.PI) / 180));
    const d = [Math.sin(ph) * Math.cos(e), Math.sin(e), Math.cos(ph) * Math.cos(e)];
    const a = add([0, 0.668, -0.005], mul(d, 0.048));
    const pa = F.p(a);
    const pb = F.p(add(a, mul(d, 0.135)));
    const h = len(sub(pb, pa));
    rod(
      k,
      pa,
      pb,
      0.014 * S,
      {
        ...warm,
        weight: 4,
        color: (c) => shade(patina(c, 0.62), 0.92 + 0.3 * clamp(c.lp[1] / h + 0.5, 0, 1)),
      },
      0.0008,
    );
  }
  // The raised right arm and the torch.
  const armR = spline([
    [-0.11, 0.49, 0],
    [-0.15, 0.6, 0.0],
    [-0.155, 0.72, 0.02],
    [-0.135, 0.85, 0.03],
  ]);
  k.add(
    k.tube(
      (t) => F.p(armR(t)),
      (t) => (0.036 - 0.014 * t) * S,
    ),
    { ...P, weight: 1.6, color: (c) => patina(c) },
  );
  k.add(k.ellipsoid(0.055, 0.1, 0.05), {
    ...P,
    pos: F.p([-0.13, 0.54, 0]),
    quat: F.q(quatAxisAngle([0, 0, 1], -0.25)),
    scale: S,
    color: (c) => patina(c),
  });
  k.add(k.sphere(0.03), {
    ...P,
    pos: F.p([-0.135, 0.855, 0.03]),
    scale: S,
    weight: 2,
    color: (c) => patina(c),
  });
  const tb = [-0.135, 0.86, 0.03];
  k.add(k.cylinder(0.018, 0.09), {
    ...P,
    pos: F.p(add(tb, [0, 0.04, 0])),
    quat: F.q(),
    scale: S,
    weight: 2,
    color: (c) => patina(c),
  });
  k.add(k.cone(0.022, 0.052, 0.055), {
    ...P,
    pos: F.p(add(tb, [0, 0.11, 0])),
    quat: F.q(),
    scale: S,
    weight: 2,
    color: (c) => patina(c, 0.6),
  });
  k.add(k.torus(0.06, 0.007), {
    ...P,
    pos: F.p(add(tb, [0, 0.135, 0])),
    quat: F.q(),
    scale: S,
    weight: 3,
    color: (c) => patina(c, 0.6),
  });
  const flameShape = k.lathe(
    [
      [0.04, 0],
      [0.048, 0.03],
      [0.036, 0.07],
      [0.016, 0.1],
      [0.0, 0.125],
    ],
    { grid: 32, thick: 0.03 },
  );
  const fb = add(tb, [0, 0.138, 0]);
  // The flame flares with its part; a halo of light and a spray of sparks
  // are hidden at rest.
  const flame = k.part("flame", { pivot: F.p(fb) });
  k.add(flameShape, {
    part: flame,
    pos: F.p(fb),
    quat: F.q(),
    scale: S,
    weight: 3,
    flat: 0.25,
    pattern: false,
    color: (c) => keep(mix("#f7cf55", "#fff3b8", smoothstep(0.2, 1, sunOf(c.n)))),
  });
  const fp = F.p(add(fb, [0, 0.03, 0]));
  k.cloud({ share: 0.004, size: 0.9, pattern: false, part: flame }, (rand) => ({
    p: add(fp, [(rand() - 0.5) * 0.04, rand() * 0.03, (rand() - 0.5) * 0.04]),
    color: mix("#ffd35a", "#fff2c2", rand()),
    opacity: 0.8,
    kind: "flame",
    params: [0.06 + 0.04 * rand(), rand()],
  }));
  const hp = F.p(add(fb, [0, 0.06, 0]));
  // (Built small, within the torch's reach, and grown by its part.)
  const halo = k.part("halo", { pivot: hp });
  k.cloud({ share: 0.005, size: 2.6, pattern: false, part: halo }, (rand) => {
    const d = unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
    const r = 0.055 * Math.sqrt(rand());
    return {
      p: add(hp, mul(d, r)),
      color: mix("#ffe9a0", "#fff8e0", rand()),
      opacity: 0.16 * (1 - r / 0.066),
      kind: "fade",
      channel: 1,
      params: [0.3, -0.5],
    };
  });
  // Sparks drift up and away on the harbour breeze (to the right as seen
  // from the home view), by channel 0.
  k.fitMorphs = false;
  // Each spark's target lies in a plume that widens as it rises and bends
  // with the wind, so the spray streams out of the torch.
  const sparks = k.part("sparks", { pivot: fp });
  k.cloud({ share: 0.005, size: 1.3, pattern: false, part: sparks }, (rand) => {
    const t = Math.pow(rand(), 0.8);
    const centre = add([0, 0.08 + 0.42 * t, 0], mul([0.85, 0, -0.52], 0.55 * t * t));
    const d = unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
    const r = (0.02 + 0.17 * t) * Math.sqrt(rand());
    return {
      p: add(fp, [(rand() - 0.5) * 0.03, rand() * 0.04, (rand() - 0.5) * 0.03]),
      color: mix("#ffc23a", "#fff4c8", rand()),
      opacity: 0.95,
      size: 1.25 - 0.5 * t,
      kind: "morph",
      channel: 0,
      to: add(fp, add(centre, mul(d, r))),
    };
  });
  // The left arm cradling the tablet.
  const armL = spline([
    [0.11, 0.49, 0],
    [0.155, 0.4, 0.02],
    [0.14, 0.36, 0.07],
    [0.1, 0.4, 0.1],
  ]);
  k.add(
    k.tube(
      (t) => F.p(armL(t)),
      (t) => (0.034 - 0.01 * t) * S,
    ),
    { ...P, weight: 1.6, color: (c) => patina(c) },
  );
  k.add(k.box(0.075, 0.125, 0.022), {
    ...P,
    pos: F.p([0.12, 0.43, 0.08]),
    quat: F.q(quatMul(quatAxisAngle([0, 0, 1], -0.3), quatAxisAngle([1, 0, 0], -0.25))),
    scale: S,
    weight: 2,
    color: (c) =>
      c.s.face === 4 && Math.abs(c.lp[1]) < 0.01 ? keep(shade(deep, 0.8)) : patina(c, 0.6),
  });
  k.add(k.box(0.26, 0.03, 0.22), {
    ...P,
    pos: F.p([0, 0.0, 0]),
    quat: F.q(),
    scale: S,
    color: plain,
  });
}

// ---- White House --------------------------------------------------------------------------------

function whiteHouseBuild(k) {
  const white = "#f6f4ee";
  const g = 0.04;
  const glassC = "#3b4652";
  const X = 0.85;
  const Z = 0.36;
  const top = g + 0.52;
  // Windows in three rows, with the portico bays left clear on the south front.
  const facade = (c) => {
    const [x, y, z] = c.p;
    const n = c.n;
    if (n[1] > 0.5) return lit("#e8e5dc", c);
    const along = Math.abs(n[0]) > 0.5 ? z : x;
    const span = Math.abs(n[0]) > 0.5 ? Z : X;
    const bay = 0.142;
    const f = ((along + span) / bay) % 1;
    const inPortico = n[2] > 0.5 && Math.abs(x) < 0.3;
    const yy = y - g;
    if (!inPortico && Math.abs(f - 0.5) < 0.2 && Math.abs(along) < span - 0.05) {
      if ((yy > 0.04 && yy < 0.12) || (yy > 0.2 && yy < 0.33) || (yy > 0.38 && yy < 0.47)) {
        const cross = Math.abs(f - 0.5) < 0.02 || Math.abs(yy - 0.265) < 0.004;
        return keep(cross ? "#e9e6dd" : shade(glassC, 0.9 + 0.2 * smoothstep(0.2, 0.47, yy)));
      }
      if (Math.abs(yy - 0.345) < 0.008) return lit(shade(white, 0.82), c);
    }
    if (yy < 0.16 && Math.abs((yy / 0.03) % 1) < 0.1) return lit(shade(white, 0.9), c);
    return lit(white, c);
  };
  k.add(k.box(2 * X, 0.52, 2 * Z), {
    pos: [0, g + 0.26, 0],
    flat: 0.2,
    interior: 0.04,
    core: "#bbb",
    color: facade,
  });
  k.add(k.box(2 * X + 0.05, 0.03, 2 * Z + 0.05), {
    pos: [0, top + 0.015, 0],
    flat: 0.2,
    color: (c) => lit(white, c),
  });
  k.add(k.box(2 * X + 0.02, 0.05, 2 * Z + 0.02), {
    pos: [0, top + 0.055, 0],
    flat: 0.2,
    color: (c) => {
      if (c.n[1] > 0.5) return lit(white, c);
      const along = Math.abs(c.n[0]) > 0.5 ? c.p[2] : c.p[0];
      const bal = (along / 0.022) % 1 < 0.45 && c.p[1] < top + 0.07;
      return lit(bal ? shade(white, 0.78) : white, c);
    },
  });
  // A low hipped roof with chimneys.
  const ry = top + 0.08;
  const roof = (c) => lit("#9aa0a6", c, 0.6);
  const R0 = [X - 0.03, Z - 0.03];
  const R1 = [X - 0.25, Z - 0.22];
  const corners = (r, y) => [
    [r[0], y, r[1]],
    [-r[0], y, r[1]],
    [-r[0], y, -r[1]],
    [r[0], y, -r[1]],
  ];
  const c0 = corners(R0, ry);
  const c1 = corners(R1, ry + 0.11);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    k.add(quad(k, c0[i], c0[j], c1[j], c1[i]), { flat: 0.2, color: roof });
  }
  k.add(k.box(2 * R1[0], 0.01, 2 * R1[1]), { pos: [0, ry + 0.11, 0], flat: 0.2, color: roof });
  for (const x of [-0.45, -0.2, 0.2, 0.45])
    for (const z of [-0.1, 0.1])
      k.add(k.box(0.05, 0.1, 0.04), {
        pos: [x, ry + 0.1, z],
        flat: 0.2,
        color: (c) => lit(white, c),
      });
  // The south portico: a curved colonnade with a balcony.
  const pz = Z;
  const pr = 0.27;
  const colShape = k.lathe(
    [
      [0.024, 0],
      [0.023, 0.18],
      [0.02, 0.34],
    ],
    { grid: 24 },
  );
  for (let i = 0; i < 6; i++) {
    const a = ((-70 + i * 28) * Math.PI) / 180;
    const x = Math.sin(a) * pr;
    const z = pz + Math.cos(a) * pr;
    k.add(colShape, {
      pos: [x, g + 0.18, z],
      flat: 0.2,
      weight: 1.8,
      color: (c) => lit(shade(white, 0.92 + 0.08 * Math.abs(Math.cos(c.u * TAU * 8))), c),
    });
    k.add(k.box(0.06, 0.02, 0.06), {
      pos: [x, g + 0.53, z],
      flat: 0.2,
      weight: 2,
      color: (c) => lit(white, c),
    });
  }
  const halfRing = (r0, r1, y0, y1, color, grid = 48) =>
    k.add(
      k.param(
        (u, v) => {
          const a = (-0.5 + u) * Math.PI;
          const r = lerp(r0, r1, v);
          return [Math.sin(a) * r, lerp(y0, y1, v), pz + Math.cos(a) * r];
        },
        { grid },
      ),
      { flat: 0.2, color },
    );
  halfRing(pr + 0.04, pr + 0.04, g, g + 0.18, (c) => {
    const a = Math.atan2(c.p[0], c.p[2] - pz);
    const door = Math.abs((((a / Math.PI) * 6 + 6.5) % 1) - 0.5) < 0.18 && c.p[1] < g + 0.14;
    return door ? keep("#2f3a44") : lit(white, c);
  });
  halfRing(0, pr + 0.04, g + 0.18, g + 0.18, (c) => lit("#e8e5dc", c), 24);
  halfRing(pr + 0.035, pr + 0.035, g + 0.54, g + 0.6, (c) => lit(white, c));
  halfRing(0, pr + 0.035, g + 0.6, g + 0.6, (c) => lit("#e8e5dc", c), 24);
  halfRing(pr + 0.03, pr + 0.03, g + 0.6, g + 0.64, (c) => {
    const a = Math.atan2(c.p[0], c.p[2] - pz);
    return lit((((a * 20) % 1) + 1) % 1 < 0.5 ? shade(white, 0.8) : white, c);
  });
  halfRing(0, pr - 0.04, g + 0.34, g + 0.34, (c) => lit("#e8e5dc", c), 24);
  halfRing(pr - 0.04, pr - 0.04, g + 0.34, g + 0.38, (c) => lit(shade(white, 0.85), c));
  // The east and west wings.
  for (const s of [-1, 1]) {
    k.add(k.box(0.72, 0.22, 0.3), {
      pos: [s * (X + 0.36), g + 0.11, -0.12],
      flat: 0.2,
      color: (c) => {
        if (c.n[1] > 0.5) return lit("#e0ddd4", c);
        const f = ((c.p[0] + 3) / 0.09) % 1;
        if (c.n[2] > 0.5 && Math.abs(f - 0.5) < 0.2 && c.p[1] > g + 0.05 && c.p[1] < g + 0.17)
          return keep(glassC);
        return lit(white, c);
      },
    });
  }
  // The flag on the roof.
  flag(k, [0, ry + 0.11, 0], 0.2, 0.13, 0.075, usFlag, { dir: [-0.8, 0, -0.6], poleR: 0.004 });
  // The south lawn with a fountain, a drive and trees.
  k.add(k.box(3.3, g, 2.4), {
    pos: [0, g / 2, 0.45],
    pattern: false,
    flat: 0.2,
    color: (c) => {
      if (c.n[1] < 0.5) return lit("#6b5a44", c);
      const [x, , z] = c.p;
      const ring = Math.abs(Math.hypot(x / 1.25, (z - 0.9) / 0.55) - 1) < 0.035;
      if (ring && z > 0.45) return lit("#d9d0bd", c);
      return grass(c, "#63a34b");
    },
  });
  k.add(k.torus(0.13, 0.015), {
    pos: [0, g + 0.012, 1.05],
    weight: 2,
    color: (c) => lit("#e3ded2", c),
  });
  water(k, g + 0.012, 0.125, 0.125, {
    share: 0.01,
    x0: 0,
    z0: 1.05,
    deep: "#3d7fa6",
    light: "#8cc9e3",
  });
  k.cloud({ share: 0.006, size: 0.8, pattern: false }, (rand) => ({
    p: [(rand() - 0.5) * 0.03, g + 0.02 + rand() * 0.12, 1.05 + (rand() - 0.5) * 0.03],
    color: "#eef8ff",
    opacity: 0.6,
    kind: "rise",
    params: [0.1, rand()],
  }));
  // The fountain's tall jet: a column that rests as a low spout and shoots
  // up by channel 0, and the spray that falls from its top into the basin
  // (hidden at rest; it rises with the jet).
  const base = [0, g + 0.02, 1.05];
  const jetH = 0.56;
  k.cloud({ share: 0.008, size: 0.9, pattern: false }, (rand) => {
    const y = Math.pow(rand(), 0.8) * jetH;
    const a = rand() * TAU;
    const r = (0.012 + 0.012 * (y / jetH)) * Math.sqrt(rand());
    const to = add(base, [Math.cos(a) * r, y, Math.sin(a) * r]);
    return {
      p: add(base, [Math.cos(a) * r, y * 0.2, Math.sin(a) * r]),
      color: mix("#dff2ff", "#ffffff", rand()),
      opacity: 0.75,
      kind: "morph",
      channel: 0,
      to,
    };
  });
  const spray = k.part("spray", { pivot: base });
  k.cloud({ share: 0.008, size: 0.85, pattern: false, part: spray }, (rand) => {
    const a = rand() * TAU;
    const t = rand();
    const R = 0.12 * (0.7 + 0.3 * rand());
    const to = add(base, [Math.cos(a) * R * t, jetH * (1 - t * t) + 0.01, Math.sin(a) * R * t]);
    return {
      p: add(base, [Math.cos(a) * R * t * 0.5, (to[1] - base[1]) * 0.2, Math.sin(a) * R * t * 0.5]),
      color: mix("#cfeaff", "#ffffff", rand()),
      opacity: 0.55,
      kind: "morph",
      channel: 0,
      to,
    };
  });
  // Warm lights in the windows of the two faces in view: each window's
  // light fades in as channel 1 passes its own moment (and out again as
  // the channel runs back), so they come on one by one.
  const wins = [];
  const bay = 0.142;
  for (const [span, face] of [
    [X, "south"],
    [Z, "east"],
  ])
    for (let b = 0; b < 40; b++) {
      const a = -span + (b + 0.5) * bay;
      if (a > span - 0.05) break;
      if (Math.abs(a) > span - 0.05) continue;
      if (face === "south" && Math.abs(a) < 0.3) continue;
      for (const [y0w, y1w] of [
        [0.04, 0.12],
        [0.2, 0.33],
        [0.38, 0.47],
      ])
        wins.push({ face, a, y0w, y1w, at: 0.08 + 0.72 * hash(b, y0w * 10, face === "south" ? 1 : 2) }); // prettier-ignore
    }
  k.cloud({ share: 0.012, size: 0.9, pattern: false }, (rand, i) => {
    const w = wins[i % wins.length];
    const a = w.a + (rand() - 0.5) * bay * 0.36;
    const y = g + w.y0w + rand() * (w.y1w - w.y0w);
    const p = w.face === "south" ? [a, y, Z + 0.004] : [X + 0.004, y, a];
    return {
      p,
      n: w.face === "south" ? [0, 0, 1] : [1, 0, 0],
      color: mix("#ffcf6a", "#fff0c0", 0.4 * rand() + 0.3 * ((y - g - w.y0w) / (w.y1w - w.y0w))),
      opacity: 0.95,
      kind: "fade",
      channel: 1,
      params: [w.at, -0.05],
    };
  });
  for (const [x, z, r] of [
    [-1.3, 0.2, 0.13],
    [-1.4, 0.75, 0.15],
    [-1.05, 1.3, 0.12],
    [1.3, 0.25, 0.14],
    [1.45, 0.85, 0.13],
    [1.1, 1.35, 0.12],
    [-0.9, -0.55, 0.14],
    [0.95, -0.6, 0.15],
  ])
    tree(k, [x, g, z], r);
}

// ---- Leaning tower -----------------------------------------------------------------------------

const PISA = { base: [0, 0.08, 0], axis: unit([-0.52, 0, -0.85]), max: 0.19 };
// Galileo's drop: two balls on the top ledge on the leaning side (the tower
// leans to the right as seen from the home view), [side, depth, radius,
// colour, bounce]. The heavy one is iron, the light one bronze.
const PISA_R = [0.85, 0, -0.52];
const PISA_V = [0.52, 0, 0.85];
const PISA_BALLS = [
  [0.6, -0.1, 0.1, "#46464c", 0.07],
  [0.2, 0.6, 0.066, "#c8943e", 0.11],
];
const PISA_LEDGE = 3.39;
const PISA_SECS = 4.4;
// Where ball i sits on the ledge with the tower leaning by `angle`; `roll`
// (0..1) rolls it out from well on the ledge to its edge, where it drops.
const pisaLedge = (i, angle, roll = 1) => {
  const [side, depth, r] = PISA_BALLS[i];
  const out = 0.72 + 0.28 * roll;
  const local = add(add(mul(PISA_R, side * out), mul(PISA_V, depth * out)), [0, PISA_LEDGE + r, 0]); // prettier-ignore
  return add(PISA.base, quatRotate(quatAxisAngle(PISA.axis, angle), sub(local, PISA.base)));
};

function pisaBuild(k) {
  const marble = "#f1ece0";
  const shadowC = "#d2cab8";
  // The lawn, paths and a round step.
  k.add(k.box(2.7, 0.04, 2.7), {
    pos: [0, 0.0, 0],
    pattern: false,
    flat: 0.2,
    color: (c) => {
      if (c.n[1] < 0.5) return lit("#6b5a44", c);
      const [x, , z] = c.p;
      if (Math.abs(x - z * 0.3) < 0.09 && z > 0.5) return lit("#e7e0cf", c);
      return grass(c, "#5fa148");
    },
  });
  k.add(k.cylinder(0.64, 0.06), { pos: [0, 0.05, 0], flat: 0.2, color: (c) => lit("#e3ddd0", c) });
  const tower = k.part("tower", { pivot: PISA.base, axis: PISA.axis });
  const T = { part: tower, flat: 0.2 };
  const y0 = PISA.base[1];
  const face = 0.55;
  // The ground storey: a solid drum with blind arches and a door.
  k.add(k.cylinder(0.5, 0.74, { caps: false }), {
    ...T,
    pos: [0, y0 + 0.37, 0],
    interior: 0.04,
    core: "#bdb5a5",
    color: (c) => {
      const y = c.p[1] - y0;
      let da = c.u * TAU - face;
      da = ((((da + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
      if (inRound(da * 0.5, y - 0.02, 0.07, 0.3)) return keep("#3a332b");
      const f = (c.u * 15) % 1;
      const s = (f - 0.5) * ((TAU * 0.5) / 15);
      if (inRound(s, y - 0.06, 0.07, 0.48) && !inRound(s, y - 0.06, 0.058, 0.48))
        return lit(shade(marble, 0.86), c);
      if (inRound(s, y - 0.06, 0.07, 0.48)) return lit(shadowC, c);
      return lit(Math.floor(y / 0.05) % 2 ? marble : shade(marble, 0.95), c);
    },
  });
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * TAU;
    k.add(k.cylinder(0.022, 0.62), {
      ...T,
      pos: [Math.sin(a) * 0.505, y0 + 0.36, Math.cos(a) * 0.505],
      weight: 2,
      color: (c) => lit(marble, c),
    });
  }
  // Six open galleries.
  const colShape = k.cylinder(0.016, 0.3, { caps: false });
  for (let j = 0; j < 6; j++) {
    const yb = y0 + 0.74 + j * 0.42;
    k.add(k.cylinder(0.535, 0.035), {
      ...T,
      pos: [0, yb + 0.0175, 0],
      color: (c) => (c.s.side ? lit(shade(marble, 0.9), c) : lit(marble, c)),
    });
    k.add(k.cylinder(0.41, 0.385, { caps: false }), {
      ...T,
      pos: [0, yb + 0.2275, 0],
      color: (c) => {
        const y = c.p[1] - yb;
        const f = (c.u * 10) % 1;
        if (Math.abs(f - 0.5) < 0.12 && y > 0.06 && y < 0.27) return keep("#3a332b");
        return lit(shadowC, c);
      },
    });
    for (let i = 0; i < 30; i++) {
      const a = ((i + (j % 2) * 0.5) / 30) * TAU;
      k.add(colShape, {
        ...T,
        pos: [Math.sin(a) * 0.49, yb + 0.185, Math.cos(a) * 0.49],
        weight: 2.4,
        color: (c) => lit(marble, c),
      });
    }
    k.add(k.cylinder(0.505, 0.055, { caps: false }), {
      ...T,
      pos: [0, yb + 0.3625, 0],
      color: (c) => {
        const f = (c.u * 30 - (j % 2) * 0.5 + 30) % 1;
        const dy = c.p[1] - (yb + 0.335);
        const arch = 0.042 * Math.sqrt(Math.max(0, 1 - ((f - 0.5) / 0.4) ** 2));
        if (Math.abs(f - 0.5) < 0.4 && dy < arch) return null;
        return lit(marble, c);
      },
    });
  }
  // The belfry.
  const yb = y0 + 0.74 + 6 * 0.42;
  k.add(k.cylinder(0.535, 0.035), { ...T, pos: [0, yb + 0.0175, 0], color: (c) => lit(marble, c) });
  k.add(k.cylinder(0.33, 0.3), {
    ...T,
    pos: [0, yb + 0.185, 0],
    color: (c) => {
      if (c.s.cap) return lit("#c9c2b3", c);
      const y = c.p[1] - yb;
      const f = (c.u * 12) % 1;
      if (inRound((f - 0.5) * 0.17, y - 0.08, 0.045, 0.12)) return keep("#2f2a24");
      return lit(marble, c);
    },
  });
  k.add(k.torus(0.33, 0.015), {
    ...T,
    pos: [0, yb + 0.34, 0],
    weight: 2,
    color: (c) => lit(marble, c),
  });
  const tip = add(PISA.base, [0, 3.7, 0]);
  const lean = quatRotate(quatAxisAngle(PISA.axis, PISA.max * 1.05), sub(tip, PISA.base));
  k.reach(add(PISA.base, lean));
  // The two balls and their puffs of dust, built on the lawn where they
  // land with the tower at its default lean (drive() moves them and hides
  // them at rest).
  PISA_BALLS.forEach(([, , r, col], i) => {
    const land = pisaLedge(i, 0.35 * PISA.max + 0.07);
    const at = [land[0], 0.02 + r, land[2]];
    k.add(k.sphere(r), {
      part: k.part(`ball${i}`, { pivot: at }),
      pos: at,
      weight: 6,
      flat: 0.3,
      pattern: false,
      color: (c) => {
        const l = sunOf(c.n);
        return mix(shade(col, 0.55 + 0.55 * Math.max(0, l)), "#ffffff", Math.pow(Math.max(0, l), 18) * 0.6); // prettier-ignore
      },
    });
    const foot = [land[0], 0.03, land[2]];
    const dust = k.part(`dust${i}`, { pivot: foot });
    k.cloud({ share: 0.004, size: 1.6, pattern: false, part: dust }, (rand) => {
      const a = rand() * TAU;
      const d = r * (1.2 + 1.6 * rand());
      return {
        p: add(foot, [
          Math.cos(a) * d,
          0.01 + 0.06 * rand() * (1 - (d - r) / (3 * r)),
          Math.sin(a) * d,
        ]),
        color: mix("#c9b48c", "#e8dcc0", rand()),
        opacity: 0.45,
      };
    });
  });
}

// ---- Colosseum ---------------------------------------------------------------------------------

// The chariot race: four chariots (the red, white, blue and green teams) on
// an oval track round the arena floor, built side by side near the front of
// the track where they start (hidden at rest).
const COL = {
  a: 0.66,
  b: 0.37,
  floor: 0.036,
  start: 0.83,
  teams: ["#c8332b", "#f2efe6", "#2f5fb8", "#3c8f3e"],
  horses: ["#6b4424", "#e9e2d4", "#2e2622", "#8a5a30"],
  secs: 5.2,
};
// Two lanes: chariots 0 and 2 on the inside, 1 and 3 outside, in two rows.
const colLane = (i) => 0.075 * (i % 2 ? 1 : -1);
const colTrack = (phi, i) => [Math.sin(phi) * (COL.a + colLane(i)), COL.floor, Math.cos(phi) * (COL.b + colLane(i))]; // prettier-ignore
const colHeading = (phi, i) => Math.atan2(Math.cos(phi) * (COL.a + colLane(i)), -Math.sin(phi) * (COL.b + colLane(i))); // prettier-ignore
const colStart = (i) => COL.start + 0.45 - (i < 2 ? 0 : 0.85);

// One chariot: two horses, the car on two wheels and its driver, in the
// frame of a point on the track (x forward, y up, z to the left).
function chariot(k, part, i, team, horse, S) {
  const phi = colStart(i);
  const at = colTrack(phi, i);
  const h = colHeading(phi, i);
  const F = [Math.sin(h), 0, Math.cos(h)];
  const L = [F[2], 0, -F[0]];
  const W = (l) => add(at, add(add(mul(F, l[0] * S), [0, l[1] * S, 0]), mul(L, l[2] * S)));
  const q = quatAxisAngle([0, 1, 0], h - Math.PI / 2);
  const P = { part, weight: 8, flat: 0.3, pattern: false, channel: 0, kind: "fade", params: [0.02, -0.25] }; // prettier-ignore
  const skinC = (col) => (c) => shade(col, 0.7 + 0.35 * Math.max(0, sunOf(c.n)));
  for (const side of [-1, 1]) {
    const z = side * 0.022;
    k.add(k.ellipsoid(0.046, 0.021, 0.016), { ...P, pos: W([0.075, 0.058, z]), quat: q, scale: S, color: skinC(horse) }); // prettier-ignore
    k.add(k.ellipsoid(0.02, 0.012, 0.011), { ...P, pos: W([0.123, 0.083, z]), quat: quatMul(q, quatAxisAngle([0, 0, 1], 0.9)), scale: S, color: skinC(horse) }); // prettier-ignore
    for (const [lx, lz] of [
      [0.108, 0.006],
      [0.108, -0.006],
      [0.042, 0.006],
      [0.042, -0.006],
    ])
      rod(k, W([lx, 0.045, z + lz]), W([lx + 0.006, 0.0, z + lz]), 0.0045 * S, { ...P, color: shade(horse, 0.7) }); // prettier-ignore
  }
  rod(k, W([-0.005, 0.032, 0]), W([0.06, 0.05, 0]), 0.003 * S, { ...P, color: "#5a3a20" });
  k.add(k.box(0.034, 0.03, 0.05), { ...P, pos: W([-0.018, 0.037, 0]), quat: q, scale: S, color: skinC(team) }); // prettier-ignore
  for (const side of [-1, 1])
    k.add(k.cylinder(0.021, 0.006), {
      ...P,
      pos: W([-0.022, 0.021, side * 0.03]),
      quat: quatMul(q, quatAxisAngle([1, 0, 0], Math.PI / 2)),
      scale: S,
      color: (c) => (Math.hypot(c.lp[0], c.lp[2]) < 0.006 ? "#2a2018" : skinC("#6e4a2a")(c)),
    });
  k.add(k.ellipsoid(0.012, 0.022, 0.012), { ...P, pos: W([-0.02, 0.07, 0]), quat: q, scale: S, color: skinC(team) }); // prettier-ignore
  k.add(k.sphere(0.009), { ...P, pos: W([-0.017, 0.098, 0]), scale: S, color: skinC("#c68d62") });
}

function colosseumBuild(k) {
  const A = 1.88;
  const B = 1.56;
  const H = 0.62;
  const st = 0.16;
  const trav = "#dccfae";
  const bays = 80;
  const ruinC = 0.55 + Math.PI;
  const hmax = (u) => {
    const b = Math.floor(u * bays);
    const phi = ((b + 0.5) / bays) * TAU;
    const d = (Math.abs(((((phi - ruinC + Math.PI) % TAU) + TAU) % TAU) - Math.PI) / TAU) * bays;
    if (d > 17) return H;
    if (d > 14.5) return 3 * st;
    if (d > 12) return 2 * st;
    if (d > 9.5) return st;
    return 0.04 + 0.04 * hash(b);
  };
  const perim = Math.PI * (3 * (A + B) - Math.sqrt((3 * A + B) * (A + 3 * B)));
  const bayW = perim / bays;
  const grime = (c, col) => {
    const n = c.fbm(c.p[0] * 5, c.p[1] * 9, c.p[2] * 5);
    return mix(col, "#8e7d62", clamp(0.25 + 0.5 * n - c.p[1] * 0.5, 0, 0.6));
  };
  const wallColor = (outer, sc) => (c) => {
    const u = c.u;
    const y = c.p[1];
    if (y > hmax(u) + 0.002) return null;
    const b = Math.floor(u * bays);
    const f = u * bays - b;
    const dx = (f - 0.5) * bayW * sc;
    let col = trav;
    if (y < 3 * st) {
      const j = Math.floor(y / st);
      const dy = y - j * st;
      if (inRound(dx, dy - 0.014, 0.043 * sc, st * 0.5)) return null;
      if (dy > st - 0.024) col = shade(trav, dy > st - 0.008 ? 1.04 : 0.88);
      else if (Math.abs(dx) > bayW * sc * 0.5 - 0.016) col = shade(trav, 1.05);
    } else {
      const dy = y - 3 * st;
      if (Math.abs(dx) > bayW * sc * 0.5 - 0.012) col = shade(trav, 1.05);
      if (b % 2 === 0 && Math.abs(dx) < 0.022 && dy > 0.04 && dy < 0.075) return keep("#3d3326");
      if (dy > H - 3 * st - 0.02) col = shade(trav, 0.92);
    }
    const g = grime(c, col);
    return outer ? lit(g, c, 0.62) : lit(shade(g, 0.72), c, 0.62);
  };
  const ellipse = (s, y0, y1, outer, colorFn, grid = 200) =>
    k.add(
      k.param(
        (u, v) => {
          const a = u * TAU;
          return [Math.sin(a) * A * s, lerp(y0, y1, v), Math.cos(a) * B * s];
        },
        {
          grid,
          normal: (u) => {
            const a = u * TAU;
            const n = [Math.sin(a) / A, 0, Math.cos(a) / B];
            return outer ? n : mul(n, -1);
          },
        },
      ),
      { flat: 0.2, color: colorFn },
    );
  // The outer wall (two faces and a top) with its ruined side.
  ellipse(1.0, 0.0, H, true, wallColor(true, 1));
  ellipse(0.955, 0.0, H, false, wallColor(false, 0.955));
  k.add(
    k.param(
      (u, v) => {
        const a = u * TAU;
        const s = lerp(0.955, 1.0, v);
        return [Math.sin(a) * A * s, hmax(u), Math.cos(a) * B * s];
      },
      { grid: 160, normal: () => [0, 1, 0] },
    ),
    { flat: 0.2, color: (c) => lit(grime(c, shade(trav, 0.95)), c) },
  );
  // The inner ring, the vaults between, the seating and the arena.
  const inner = 0.86;
  const H2 = 0.46;
  const innerColor = (c) => {
    const u = c.u;
    const b = Math.floor(u * bays);
    const f = u * bays - b;
    const dx = (f - 0.5) * bayW * inner;
    const y = c.p[1];
    const j = Math.floor(y / 0.153);
    if (j < 3 && inRound(dx, y - j * 0.153 - 0.012, 0.036, 0.07)) return null;
    return lit(grime(c, "#c3ae8a"), c, 0.6);
  };
  ellipse(inner, 0, H2, true, innerColor, 160);
  for (const y of [st, 2 * st])
    k.add(
      k.param(
        (u, v) => {
          const a = u * TAU;
          const s = lerp(inner, 0.955, v);
          return [Math.sin(a) * A * s, y, Math.cos(a) * B * s];
        },
        { grid: 120, normal: () => [0, 1, 0] },
      ),
      { flat: 0.2, color: (c) => (c.p[1] > hmax(c.u) ? null : lit("#7e6a52", c)) },
    );
  const aIn = 0.86;
  const bIn = 0.54;
  k.add(
    k.param(
      (u, v) => {
        const a = u * TAU;
        return [
          Math.sin(a) * lerp(A * inner, aIn, v),
          lerp(H2, 0.1, v),
          Math.cos(a) * lerp(B * inner, bIn, v),
        ];
      },
      { grid: 160, normal: (u) => [-Math.sin(u * TAU) * 0.3, 1, -Math.cos(u * TAU) * 0.3] },
    ),
    {
      flat: 0.2,
      color: (c) => {
        const step = Math.floor(c.v * 18) % 2;
        const radial = (c.u * 40) % 1 < 0.06;
        const n = c.fbm(c.p[0] * 4, 0, c.p[2] * 4);
        let col = mix("#cbb998", "#a86a4c", smoothstep(-0.1, 0.4, n));
        if (n > 0.45) col = mix(col, "#7e9b56", 0.6);
        if (radial) col = shade(col, 0.7);
        return lit(shade(col, step ? 0.9 : 1.02), c);
      },
    },
  );
  k.add(
    k.param(
      (u, v) => {
        const a = u * TAU;
        return [Math.sin(a) * aIn, lerp(0.03, 0.1, v), Math.cos(a) * bIn];
      },
      { grid: 64, normal: (u) => [-Math.sin(u * TAU), 0, -Math.cos(u * TAU)] },
    ),
    { flat: 0.2, color: (c) => lit("#e3d9c3", c) },
  );
  k.add(k.disc(1), {
    pos: [0, 0.035, 0],
    scale: [aIn, 1, bIn],
    flat: 0.2,
    color: (c) => {
      if (c.n[1] < 0) return null;
      const [x, , z] = c.p;
      if (x > 0.42) return lit(shade("#9c7650", Math.sin(z * 120) > 0.6 ? 0.8 : 1), c);
      const wall = Math.abs(Math.sin(z * 40)) < 0.35 || Math.abs(Math.sin(x * 16)) < 0.18;
      return lit(wall ? "#bfb197" : "#5f4f3d", c);
    },
  });
  // The race and its crowd (both hidden at rest). The spectators fill the
  // seats as channel 1 passes each one's moment, in two halves that jump
  // up and down in turn as they cheer.
  COL.teams.forEach(
    (team, i) =>
    chariot(k, k.part(`chariot${i}`, { pivot: colTrack(colStart(i), i) }), i, team, COL.horses[i], 1.9), // prettier-ignore
  );
  const crowd = [
    k.part("crowd0", { pivot: [0, 0.3, 0] }),
    k.part("crowd1", { pivot: [0, 0.3, 0] }),
  ];
  const tunics = ["#e9e1cf", "#ddd0b2", "#e4ddcc", "#cdbb96", "#a9493a", "#4a67a0", "#b98b3a"];
  k.cloud({ share: 0.006, size: 1.45, pattern: false }, (rand) => {
    const a = rand() * TAU;
    const v = 0.25 + 0.6 * rand();
    const p = [
      Math.sin(a) * lerp(A * inner, aIn, v),
      lerp(H2, 0.1, v) + 0.014,
      Math.cos(a) * lerp(B * inner, bIn, v),
    ];
    const col = tunics[Math.floor(Math.pow(rand(), 2.2) * tunics.length)];
    return {
      p,
      color: shade(col, 0.85 + 0.2 * rand()),
      opacity: 1,
      part: crowd[rand() < 0.5 ? 0 : 1],
      kind: "fade",
      channel: 1,
      params: [0.05 + 0.6 * rand(), -0.12],
    };
  });
  // A paved plaza round it all.
  k.add(k.cylinder(1, 0.04), {
    pos: [0, -0.02, 0],
    scale: [A * 1.18, 1, B * 1.2],
    pattern: false,
    flat: 0.2,
    color: (c) =>
      c.s.side
        ? lit("#8a8274", c)
        : lit(shade("#b8b2a6", 0.92 + 0.1 * c.noise(c.p[0] * 14, 0, c.p[2] * 14)), c),
  });
}

// ---- Parthenon ---------------------------------------------------------------------------------

// The procession: robed figures walk on the rock along the side in view
// (+X), round the corner and across the front of the steps. A path by
// distance d: straight along +Z, a quarter turn, then along -X.
const PAR = { x: 1.87, z0: -1.2, z1: 3.6, r: 0.25, x1: -1.9, y: 0.0, n: 8, gap: 0.38, speed: 1.0, secs: 5.6 }; // prettier-ignore
const parLen = () => PAR.z1 - PAR.z0 + (Math.PI / 2) * PAR.r + (PAR.x - PAR.r - PAR.x1);
// Position and heading (turn about Y from facing +Z) at distance d.
function parPath(d) {
  const a = PAR.z1 - PAR.z0;
  const b = (Math.PI / 2) * PAR.r;
  if (d <= a) return { p: [PAR.x, PAR.y, PAR.z0 + d], h: 0 };
  if (d <= a + b) {
    const t = (d - a) / PAR.r;
    return { p: [PAR.x - PAR.r + PAR.r * Math.cos(t), PAR.y, PAR.z1 + PAR.r * Math.sin(t)], h: -t };
  }
  return { p: [PAR.x - PAR.r - (d - a - b), PAR.y, PAR.z1 + PAR.r], h: -Math.PI / 2 };
}
// Where figure i starts (in line along the side walk, the leader first).
const parStart = (i) => 3.3 - i * PAR.gap;
// Every figure is built at the corner, the point of the walk nearest the
// home view, so the rock never draws over one (splats sort where built).
const PAR_BUILT = [PAR.x, PAR.y, PAR.z1];

function parthenonBuild(k, o) {
  const ruin = o.style !== "ancient";
  const marble = ruin ? "#e4d4b2" : "#f4efe4";
  const X = 1.545;
  const Z = 3.475;
  const sty = 0.18;
  const weather = (c, col, amb = 0.62) => {
    if (!ruin) return lit(col, c, amb);
    const n = c.fbm(c.p[0] * 3, c.p[1] * 6, c.p[2] * 3);
    return lit(mix(col, "#9d8a6c", clamp(0.2 + 0.45 * n, 0, 0.55)), c, amb);
  };
  // The rock of the hill and three steps.
  k.add(roundBox(4.3, 0.4, 8.3, 0.12), {
    pos: [0, -0.2, 0],
    pattern: false,
    flat: 0.25,
    color: (c) => lit(shade("#a79a84", 0.85 + 0.25 * c.fbm(c.p[0] * 2, c.p[1] * 5, c.p[2] * 2)), c),
  });
  for (let i = 0; i < 3; i++) {
    const g = 0.14 - i * 0.07;
    k.add(k.box(2 * (X + g), 0.06, 2 * (Z + g)), {
      pos: [0, 0.03 + i * 0.06, 0],
      flat: 0.2,
      color: (c) => weather(c, marble),
    });
  }
  // The colonnade: 8 columns across each end, 17 along each side.
  const colH = 1.04;
  const column = k.lathe(
    [
      [0.097, 0],
      [0.095, 0.3],
      [0.09, 0.6],
      [0.083, 0.85],
      [0.076, colH],
    ],
    { grid: 40 },
  );
  const cols = [];
  const cx = X - 0.12;
  const cz = Z - 0.12;
  for (let i = 0; i < 8; i++) {
    const x = -cx + (2 * cx * i) / 7;
    cols.push([x, cz], [x, -cz]);
  }
  for (let j = 1; j < 16; j++) {
    const z = -cz + (2 * cz * j) / 16;
    cols.push([cx, z], [-cx, z]);
  }
  const broken = (x, z) => ruin && x > 0 && z > -0.8 && z < 0.4;
  const flute = (c) => {
    const f = 0.86 + 0.14 * Math.abs(Math.cos(c.u * TAU * 10));
    return weather(c, shade(marble, f));
  };
  const top = sty + colH + 0.09;
  for (const [x, z] of cols) {
    if (broken(x, z)) {
      k.add(column, {
        pos: [x, sty, z],
        scale: [1, 0.4 + 0.25 * hash(z), 1],
        flat: 0.2,
        color: flute,
      });
      continue;
    }
    k.add(column, { pos: [x, sty, z], flat: 0.2, color: flute });
    k.add(k.cone(0.078, 0.125, 0.05), {
      pos: [x, sty + colH + 0.025, z],
      flat: 0.2,
      color: (c) => weather(c, marble),
    });
    k.add(k.box(0.26, 0.04, 0.26), {
      pos: [x, sty + colH + 0.07, z],
      flat: 0.2,
      color: (c) => weather(c, marble),
    });
  }
  // The entablature: architrave, a frieze of triglyphs, and a cornice.
  const tri = ruin ? shade(marble, 0.78) : "#2d4b7c";
  const metope = ruin ? marble : "#a83a2f";
  const frieze = (c) => {
    const along = Math.abs(c.n[0]) > 0.5 ? c.p[2] : c.p[0];
    const f = (along / 0.209 + 0.5) % 1;
    if (Math.abs(c.n[1]) > 0.5) return weather(c, marble);
    if (f < 0.36) return weather(c, (f * 12) % 1 < 0.3 ? shade(tri, 0.7) : tri);
    const relief = Math.hypot(f - 0.68, (c.p[1] - top - 0.2) * 5) < 0.12;
    return weather(c, relief && !ruin ? "#e9dcc4" : metope);
  };
  const ring = (y, h, grow, color) => {
    const w = 0.28 + grow;
    const box = (sx, sz, px, pz) =>
      k.add(k.box(sx, h, sz), { pos: [px, y + h / 2, pz], flat: 0.2, color });
    for (const s of [-1, 1]) {
      box(2 * cx + w, w, 0, s * cz);
      if (ruin && s > 0) {
        const a0 = -cz - w / 2;
        const a1 = -0.95;
        const b0 = 0.55;
        const b1 = cz + w / 2;
        box(w, a1 - a0, cx, (a0 + a1) / 2);
        box(w, b1 - b0, cx, (b0 + b1) / 2);
      } else box(w, 2 * cz + w, s * cx, 0);
    }
  };
  ring(top, 0.13, 0, (c) => weather(c, marble));
  ring(top + 0.13, 0.13, 0, frieze);
  ring(top + 0.26, 0.07, 0.08, (c) => weather(c, marble));
  // Pediments at both ends.
  const py = top + 0.33;
  const ph = 0.42;
  const pw = cx + 0.18;
  for (const s of [-1, 1]) {
    const z = s * (cz + 0.02);
    k.add(quad(k, [-pw, py, z], [pw, py, z], [0, py + ph, z], [0, py + ph, z], [0, 0, s]), {
      flat: 0.2,
      color: (c) => weather(c, ruin ? shade(marble, 0.9) : "#6f8fb8"),
    });
    for (const sx of [-1, 1]) {
      const a = [sx * (pw + 0.05), py, z + s * 0.04];
      const b = [0, py + ph + 0.05, z + s * 0.04];
      const d = sub(b, a);
      k.add(k.box(len(d), 0.07, 0.2), {
        pos: mul(add(a, b), 0.5),
        quat: quatFromTo([1, 0, 0], d),
        flat: 0.2,
        color: (c) => weather(c, marble),
      });
    }
    const figures = ruin
      ? s > 0
        ? [-0.95, -0.7, 0.8]
        : [-0.9, 0.85]
      : [-1.2, -0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9, 1.2];
    for (const fx of figures) {
      const hgt = (ph - 0.06) * (1 - Math.abs(fx) / pw) * 0.85;
      if (hgt < 0.05) continue;
      k.add(k.ellipsoid(0.07, hgt / 2, 0.05), {
        pos: [fx, py + hgt / 2 + 0.02, z + s * 0.03],
        flat: 0.25,
        color: (c) => weather(c, shade(marble, 1.05)),
      });
    }
  }
  // The inner hall: low ruined walls today, a full roofed hall restored.
  const wh = ruin ? 0.32 : top + 0.26 - sty;
  const hx = 1.02;
  const hz = 2.75;
  for (const s of [-1, 1]) {
    k.add(k.box(0.1, wh, 2 * hz), {
      pos: [s * hx, sty + wh / 2, 0],
      flat: 0.2,
      color: (c) => weather(c, shade(marble, 0.92)),
    });
    k.add(k.box(2 * hx, wh, 0.1), {
      pos: [0, sty + wh / 2, s * hz],
      flat: 0.2,
      color: (c) =>
        !ruin && c.n[2] * s > 0.5 && Math.abs(c.p[0]) < 0.2 && c.p[1] < sty + 0.7
          ? keep("#3a2f24")
          : weather(c, shade(marble, 0.92)),
    });
  }
  // The figures (hidden at rest: they fade in by channel 0), facing along
  // the side walk.
  const robes = [
    "#f3eee2",
    "#d9a23a",
    "#f0e9da",
    "#a8452f",
    "#e8e0cc",
    "#4e6fa3",
    "#f2ece0",
    "#7f8f4a",
  ];
  const skins = ["#c68d62", "#b07a52", "#d9a47a", "#a86f4a"];
  for (let i = 0; i < PAR.n; i++) {
    const base = PAR_BUILT;
    const part = k.part(`walker${i}`, { pivot: base });
    const P = { part, weight: 8, flat: 0.3, pattern: false, kind: "fade", channel: 0, params: [0.25, -0.5] }; // prettier-ignore
    const W = (l) => add(base, l);
    const robe = robes[i % robes.length];
    const col = (c0) => (c) => shade(c0, 0.66 + 0.4 * Math.max(0, sunOf(c.n)));
    k.add(k.cone(0.05, 0.026, 0.2), { ...P, pos: W([0, 0.1, 0]), color: col(robe) });
    k.add(k.ellipsoid(0.03, 0.045, 0.024), { ...P, pos: W([0, 0.215, 0]), color: col(robe) });
    for (const sx of [-1, 1])
      rod(k, W([sx * 0.028, 0.23, 0]), W([sx * 0.034, 0.15, 0.012]), 0.009, { ...P, color: col(skins[i % 4]) }); // prettier-ignore
    k.add(k.sphere(0.024), { ...P, pos: W([0, 0.28, 0.002]), color: col(skins[i % 4]) });
    k.add(k.sphere(0.025), { ...P, pos: W([0, 0.288, -0.006]), scale: [1, 0.8, 1], color: col(i % 3 ? "#3a2a1e" : "#5a4632") }); // prettier-ignore
    // Some carry a basket or a jar on their heads.
    if (i % 3 === 1)
      k.add(k.cylinder(0.04, 0.025), { ...P, pos: W([0, 0.318, 0]), color: col("#c49a52") });
    if (i % 3 === 2) {
      k.add(k.ellipsoid(0.026, 0.036, 0.026), { ...P, pos: W([0, 0.338, 0]), color: col("#b8623a") }); // prettier-ignore
      k.add(k.cylinder(0.012, 0.02), { ...P, pos: W([0, 0.38, 0]), color: col("#9c5230") });
    }
  }
  if (!ruin) {
    const ry = py;
    const tile = (c) =>
      lit(shade("#d9d3c5", Math.abs(((c.p[2] * 8) % 1) - 0.5) < 0.06 ? 0.85 : 1), c);
    for (const sx of [-1, 1])
      k.add(
        quad(
          k,
          [sx * (pw + 0.05), ry + 0.02, -cz - 0.04],
          [sx * (pw + 0.05), ry + 0.02, cz + 0.04],
          [0, ry + ph + 0.04, cz + 0.04],
          [0, ry + ph + 0.04, -cz - 0.04],
        ),
        {
          flat: 0.2,
          color: tile,
        },
      );
  }
}

// ---- Stonehenge -------------------------------------------------------------------------------

// The solstice sun rises over the far bank, behind the great trilithon
// (the horseshoe opens towards the home view, bearing 0.55).
const HENGE = {
  dir: unit([Math.sin(0.55 + Math.PI), 0.32, Math.cos(0.55 + Math.PI)]),
  sun: [Math.sin(0.55 + Math.PI) * 2.3, 0.78, Math.cos(0.55 + Math.PI) * 2.3],
  secs: 5.2,
};

function stonehengeBuild(k) {
  const sarsen = "#9a968b";
  const face = 0.55;
  // Every stone catches the solstice sun on channel 1: faces towards the
  // sun (behind the horseshoe) most, the faces in view a little.
  const sunlit = {
    kind: "band",
    channel: 1,
    params: (c) => [1 + 0.3 * (1 - clamp(0.5 + 0.6 * dot(c.n, HENGE.dir), 0, 1)), 0.5],
  };
  const rock = (c, base = sarsen) => {
    const n = c.fbm(c.p[0] * 9, c.p[1] * 9, c.p[2] * 9);
    let col = mix(base, "#5f5b53", clamp(0.35 + 0.5 * n, 0, 1) * 0.6);
    const lichen = c.noise(c.p[0] * 22 + 5, c.p[1] * 22, c.p[2] * 22);
    if (lichen > 0.45) col = mix(col, "#c9c6a0", 0.55);
    else if (lichen < -0.55) col = mix(col, "#e2e0d8", 0.4);
    return lit(col, c, 0.58);
  };
  // Grass, a gravel path and the old circular bank.
  ground(k, 2.45, 0, (c) => {
    const r = Math.hypot(c.p[0], c.p[2]);
    if (Math.abs(r - 2.05) < 0.06) return lit("#cfc4a8", c);
    if (Math.abs(r - 2.28) < 0.08) return grass(c, "#4f8f3c");
    return grass(c, "#6aa24f");
  });
  const stoneAt = (
    r,
    a,
    w,
    d,
    h,
    { tilt = 0, sink = 0.03, base = sarsen, fallen = false } = {},
  ) => {
    const p = [Math.sin(a) * r, 0, Math.cos(a) * r];
    const yaw = (a - Math.PI / 2) * DEG;
    if (fallen) {
      k.add(roundBox(h, d, w, 0.03), {
        pos: add(p, [0, d / 2, 0]),
        rot: [0, yaw + tilt, 0],
        flat: 0.25,
        ...sunlit,
        color: (c) => rock(c, base),
      });
      return;
    }
    k.add(roundBox(d, h, w, Math.min(0.035, w * 0.25)), {
      pos: add(p, [0, h / 2 - sink, 0]),
      rot: [tilt, yaw, tilt * 0.5],
      flat: 0.25,
      ...sunlit,
      color: (c) => rock(c, base),
    });
  };
  // The sarsen circle with its lintels.
  const R = 1.65;
  const n = 30;
  const missing = new Set([3, 8, 9, 13, 17, 18, 21, 26]);
  const lintels = new Set([27, 28, 29, 0, 1, 2, 5, 11, 15]);
  const step = TAU / n;
  const h0 = 0.44;
  for (let i = 0; i < n; i++) {
    const a = face + i * step - step * 0.5;
    if (missing.has(i)) {
      if (i % 3 === 0) stoneAt(R + 0.25, a + 0.05, 0.21, 0.11, 0.4, { fallen: true, tilt: 30 });
      continue;
    }
    const lean = (hash(i, 3) - 0.5) * 6;
    stoneAt(R, a, 0.2 + 0.03 * hash(i), 0.12, h0 + 0.04 * hash(i, 1), { tilt: lean });
    if (lintels.has(i) && !missing.has((i + 1) % n)) {
      const am = a + step / 2;
      const p = [Math.sin(am) * R, h0 + 0.035, Math.cos(am) * R];
      k.add(roundBox(0.1, 0.075, 2 * R * Math.sin(step / 2) + 0.04, 0.02), {
        pos: p,
        rot: [0, (am - Math.PI / 2) * DEG, 0],
        flat: 0.25,
        ...sunlit,
        color: (c) => rock(c),
      });
    }
  }
  // The horseshoe of great trilithons, opening towards the viewer.
  const tri = [
    [-1.25, 0.58],
    [-0.62, 0.66],
    [0, 0.76],
    [0.62, 0.66],
    [1.25, 0.58],
  ];
  tri.forEach(([da, h], i) => {
    const a = face + Math.PI + da;
    const r = 0.95 + 0.08 * Math.abs(da);
    const t = [Math.cos(a), 0, -Math.sin(a)];
    const c0 = [Math.sin(a) * r, 0, Math.cos(a) * r];
    const great = i === 2;
    for (const s of [-1, 1]) {
      if (great && s > 0) continue;
      const p = add(c0, mul(t, s * 0.16));
      k.add(roundBox(0.14, h, 0.25, 0.035), {
        pos: add(p, [0, h / 2 - 0.03, 0]),
        rot: [0, (a - Math.PI / 2) * DEG, great ? 4 : 0],
        flat: 0.25,
        ...sunlit,
        color: (c) => rock(c),
      });
    }
    if (great) {
      k.add(roundBox(0.62, 0.1, 0.14, 0.03), {
        pos: add(c0, [0.05, 0.05, 0.25]),
        rot: [0, (a - Math.PI / 2) * DEG + 25, 0],
        flat: 0.25,
        ...sunlit,
        color: (c) => rock(c),
      });
    } else {
      k.add(roundBox(0.14, 0.1, 0.64, 0.03), {
        pos: add(c0, [0, h + 0.02, 0]),
        rot: [0, (a - Math.PI / 2) * DEG, 0],
        flat: 0.25,
        ...sunlit,
        color: (c) => rock(c),
      });
    }
  });
  // Bluestones in a circle and a horseshoe, the altar and the heel stone.
  const blue = "#7d838c";
  for (let i = 0; i < 34; i++) {
    if (hash(i, 7) < 0.3) continue;
    const a = face + (i / 34) * TAU;
    stoneAt(1.32, a, 0.08, 0.06, 0.16 + 0.06 * hash(i, 2), { base: blue });
  }
  for (let i = 0; i < 11; i++) {
    const a = face + Math.PI + (-1.3 + (2.6 * i) / 10);
    stoneAt(0.66, a, 0.07, 0.06, 0.2 + 0.05 * hash(i, 4), { base: blue });
  }
  k.add(roundBox(0.45, 0.06, 0.12, 0.02), {
    pos: [Math.sin(face + Math.PI) * 0.35, 0.03, Math.cos(face + Math.PI) * 0.35],
    rot: [0, face * DEG + 90, 0],
    flat: 0.25,
    ...sunlit,
    color: (c) => rock(c, "#8e7f6c"),
  });
  // The sun, built high over the far bank (it rises there, fading in by
  // channel 0), and its beam shining through the great trilithon along the
  // axis to the heel stone (channel 2).
  const sun = k.part("sun", { pivot: HENGE.sun });
  k.add(k.sphere(0.2), {
    part: sun,
    pos: HENGE.sun,
    weight: 3,
    pattern: false,
    fit: false,
    kind: "fade",
    channel: 0,
    params: [0.05, -0.5],
    color: (c) => keep(mix("#ffd35a", "#fff7cf", 0.5 + 0.5 * dot(c.n, mul(HENGE.dir, -1)))),
  });
  k.cloud({ share: 0.008, size: 3, pattern: false, part: sun, fit: false }, (rand) => {
    const d = unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
    const r = 0.2 + 0.2 * Math.sqrt(rand());
    return {
      p: add(HENGE.sun, mul(d, r)),
      color: mix("#ffc84a", "#ffe9a0", rand()),
      opacity: 0.18 * (1 - (r - 0.2) / 0.22),
      kind: "fade",
      channel: 0,
      params: [0.05, -0.5],
    };
  });
  k.cloud({ share: 0.02, size: 2.2, pattern: false }, (rand) => {
    const t = rand();
    const along = lerp(2.2, -2.3, t);
    const w = lerp(0.2, 0.55, t) * (rand() - 0.5);
    const across = [Math.cos(face), 0, -Math.sin(face)];
    const axis = [Math.sin(face), 0, Math.cos(face)];
    const p = add(add(mul(axis, along), mul(across, w)), [
      0,
      0.02 + rand() * lerp(0.45, 0.08, t),
      0,
    ]);
    return {
      p,
      color: mix("#ffcf5a", "#fff0b8", rand()),
      opacity: 0.1 * (1 - 0.6 * t),
      kind: "fade",
      channel: 2,
      params: [0.2, -0.6],
    };
  });
  const heel = [Math.sin(face + 0.15) * 2.25, 0, Math.cos(face + 0.15) * 2.25];
  k.add(k.ellipsoid(0.14, 0.26, 0.12), {
    pos: add(heel, [0, 0.2, 0]),
    rot: [0, 0, 12],
    flat: 0.25,
    ...sunlit,
    color: (c) => rock(c),
  });
}

// ---- Big Ben (the Elizabeth Tower) -----------------------------------------------------------------

const BEN = { dial: 4.95, half: 0.58, r: 0.42 };

function benBuild(k) {
  const stoneC = "#d9c79b";
  const gold = "#d6ab43";
  const slate = "#465062";
  const panel = (c, base = stoneC) => {
    const along = Math.abs(c.n[0]) > 0.5 ? c.p[2] : c.p[0];
    const rib = Math.abs((((along + 0.5) / 0.1) % 1) - 0.5) > 0.4;
    const band = (c.p[1] / 0.5) % 1 < 0.03;
    const slit =
      Math.abs(along) < 0.1 &&
      (c.p[1] / 0.5) % 1 > 0.35 &&
      (c.p[1] / 0.5) % 1 < 0.75 &&
      Math.abs(c.n[1]) < 0.5;
    if (slit && Math.abs(along) < 0.03) return keep("#2d2a26");
    return lit(shade(base, rib ? 1.06 : band ? 0.82 : 0.95), c, 0.62);
  };
  // Ground and plinth.
  k.add(k.box(2.2, 0.06, 2.2), {
    pos: [0, 0.03, 0],
    pattern: false,
    flat: 0.2,
    color: (c) =>
      c.n[1] > 0.5
        ? Math.max(Math.abs(c.p[0]), Math.abs(c.p[2])) > 0.8
          ? grass(c)
          : lit("#bdb6a8", c)
        : lit("#6b5a44", c),
  });
  k.add(k.box(1.14, 0.3, 1.14), {
    pos: [0, 0.21, 0],
    flat: 0.2,
    color: (c) => lit(shade(stoneC, 0.85), c),
  });
  // The shaft with corner buttresses.
  k.add(k.box(1.0, 4.0, 1.0), {
    pos: [0, 2.36, 0],
    flat: 0.2,
    interior: 0.04,
    core: "#9c8f70",
    color: (c) => panel(c),
  });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      k.add(k.box(0.1, 4.0, 0.1), {
        pos: [sx * 0.5, 2.36, sz * 0.5],
        flat: 0.2,
        weight: 1.3,
        color: (c) => lit(shade(stoneC, 1.02), c, 0.62),
      });
  // The clock stage: four dials in gilded frames.
  const cy = BEN.dial;
  k.add(k.box(2 * BEN.half, 1.2, 2 * BEN.half), {
    pos: [0, cy, 0],
    flat: 0.2,
    color: (c) => {
      if (Math.abs(c.n[1]) > 0.5) return lit(stoneC, c);
      const along = Math.abs(c.n[0]) > 0.5 ? c.p[2] : c.p[0];
      const dy = c.p[1] - cy;
      if (Math.abs(along) < 0.52 && Math.abs(dy) < 0.52) {
        const lattice = Math.abs(Math.sin(along * 60)) < 0.3 || Math.abs(Math.sin(dy * 60)) < 0.3;
        return lit(lattice ? shade(gold, 0.6) : gold, c, 0.6);
      }
      return panel(c);
    },
  });
  const glow = k.part("glow", { pivot: [0, cy, 0] });
  for (let j = 0; j < 4; j++) {
    const a = (j * Math.PI) / 2;
    const n = [Math.sin(a), 0, Math.cos(a)];
    k.add(k.disc(BEN.r), {
      pos: add(mul(n, BEN.half + 0.006), [0, cy, 0]),
      quat: quatFromTo([0, 1, 0], n),
      weight: 2,
      pattern: false,
      color: (c) => {
        if (dot(c.n, n) < 0) return null;
        const rr = c.v;
        const ang = c.u * 12;
        if (rr > 0.96) return "#1f1f1f";
        if (rr > 0.88) return (c.u * 60) % 1 < 0.3 ? "#1f1f1f" : "#f4ebd2";
        if (rr > 0.66 && rr < 0.84 && Math.abs((ang % 1) - 0.5) > 0.4) return "#1f1f1f";
        if (rr < 0.06) return "#1f1f1f";
        return mix("#f6eed8", "#e7dcc0", rr);
      },
    });
    // A warm glow over the dial, lit when the bell chimes (under the hands).
    k.add(k.disc(BEN.r * 0.97), {
      part: glow,
      pos: add(mul(n, BEN.half + 0.013), [0, cy, 0]),
      quat: quatFromTo([0, 1, 0], n),
      weight: 1.2,
      size: 1.4,
      opacity: 0.8,
      pattern: false,
      color: (c) => {
        if (dot(c.n, n) < 0) return null;
        return mix("#fff6c8", "#ffc75a", smoothstep(0.2, 1, c.v));
      },
    });
    // Hands, each a part turning about the dial's axis.
    const pv = add(mul(n, BEN.half + 0.02), [0, cy, 0]);
    for (const [name, L, W] of [
      ["hour", 0.24, 0.045],
      ["minute", 0.36, 0.03],
    ]) {
      const part = k.part(`${name}${j}`, { pivot: pv, axis: n });
      const off = name === "minute" ? 0.006 : 0;
      k.add(k.box(W, L, 0.012), {
        part,
        pos: add(add(pv, mul(n, off)), [0, L / 2 - 0.04, 0]),
        rot: [0, a * DEG, 0],
        weight: 3,
        pattern: false,
        color: "#151515",
      });
    }
  }
  // The belfry, corner pinnacles, the roof, the lantern and the spire.
  const by = cy + 0.6;
  k.add(k.box(1.04, 0.8, 1.04), {
    pos: [0, by + 0.4, 0],
    flat: 0.2,
    color: (c) => {
      if (Math.abs(c.n[1]) > 0.5) return lit(stoneC, c);
      const along = Math.abs(c.n[0]) > 0.5 ? c.p[2] : c.p[0];
      const f = ((along + 0.52) / (1.04 / 3)) % 1;
      const s = (f - 0.5) * (1.04 / 3);
      if (inArch(s, c.p[1] - by - 0.1, 0.1, 0.4, 1.3)) return null;
      return lit(Math.abs(c.p[1] - by - 0.75) < 0.03 ? gold : stoneC, c, 0.62);
    },
  });
  // The great bell hangs in the belfry, seen through the open arches.
  k.add(k.box(0.98, 0.02, 0.98), {
    pos: [0, by + 0.02, 0],
    color: (c) => lit(shade(stoneC, 0.55), c),
  });
  const bell = k.part("bell", { pivot: [0, by + 0.74, 0], axis: [0.52, 0, 0.85] });
  k.add(
    k.lathe(
      [
        [0.2, by + 0.3],
        [0.17, by + 0.36],
        [0.13, by + 0.5],
        [0.12, by + 0.62],
        [0.08, by + 0.7],
        [0.0, by + 0.72],
      ],
      { grid: 40 },
    ),
    {
      part: bell,
      weight: 2.5,
      flat: 0.2,
      pattern: false,
      color: (c) => lit(c.p[1] < by + 0.34 ? shade("#b98a3a", 0.8) : "#c99a45", c, 0.55),
    },
  );
  rod(k, [0, by + 0.7, 0], [0, by + 0.8, 0], 0.02, { part: bell, weight: 3, color: "#3a3530" });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      rod(
        k,
        [sx * 0.52, by + 0.75, sz * 0.52],
        [sx * 0.52, by + 1.35, sz * 0.52],
        0.06,
        { weight: 2, color: (c) => lit(gold, c, 0.6) },
        0.005,
      );
  const r0 = 0.52;
  const r1 = 0.2;
  const y0 = by + 0.8;
  const y1 = y0 + 0.7;
  const roofC = (c) => {
    const along = Math.abs(c.n[0]) > 0.5 ? c.p[2] : c.p[0];
    return lit((along * 9 + 10) % 1 < 0.12 ? gold : slate, c, 0.6);
  };
  prism(
    k,
    4,
    r0 * Math.SQRT2,
    r1 * Math.SQRT2,
    y0,
    y1,
    { flat: 0.2, color: roofC },
    { a0: Math.PI / 4 },
  );
  k.add(k.box(0.34, 0.26, 0.34), {
    pos: [0, y1 + 0.13, 0],
    flat: 0.2,
    color: (c) =>
      Math.abs(c.n[1]) < 0.5 &&
      c.p[1] - y1 > 0.06 &&
      c.p[1] - y1 < 0.2 &&
      ((c.p[0] + c.p[2]) * 20) % 1 > 0.35
        ? keep("#ffe28a")
        : lit(gold, c, 0.6),
    kind: "twinkle",
    params: [0.1, 0],
  });
  prism(
    k,
    4,
    0.17 * Math.SQRT2,
    0.01,
    y1 + 0.26,
    y1 + 0.95,
    { flat: 0.2, color: roofC },
    { a0: Math.PI / 4, cap: false },
  );
  rod(k, [0, y1 + 0.9, 0], [0, y1 + 1.15, 0], 0.012, { weight: 3, color: gold });
  k.add(k.sphere(0.03), { pos: [0, y1 + 1.0, 0], weight: 3, color: gold });
}

// ---- Taj Mahal ---------------------------------------------------------------------------------

// Moonlight at the Taj Mahal: the moon hangs behind it, left of the dome as
// seen from the home view.
const TAJ = { moon: [-0.98, 1.42, -0.95], secs: 5.2 };

function tajBuild(k) {
  // Night falls on channel 1 (a cool dusk, drive()'s negative glow) on
  // everything but the great dome, its drum and finial, which stay bright
  // in the moonlight.
  const night = { kind: "band", channel: 1, params: [1, 0.5] };
  const marble = "#f6f2ea";
  const shadowC = "#b9c0cc";
  const g = 0.04;
  const base = g + 0.12;
  // The garden, the reflecting pool and cypress trees.
  k.add(k.box(2.7, g, 4.4), {
    ...night,
    pos: [0, g / 2, 0.85],
    pattern: false,
    flat: 0.2,
    color: (c) => {
      if (c.n[1] < 0.5) return lit("#6b5a44", c);
      const [x, , z] = c.p;
      if (z > 1.05 && Math.abs(x) < 0.28) return lit("#e5dccb", c);
      if (Math.abs(x) < 0.06 || Math.abs(z - 2.2) < 0.05) return lit("#e5dccb", c);
      return grass(c, "#4f9a45");
    },
  });
  water(k, g + 0.004, 0.12, 0.78, {
    rect: true,
    x0: 0,
    z0: 1.9,
    share: 0.03,
    deep: "#5e8fb3",
    light: "#bfdcf0",
    amount: 0.004,
  });
  for (let i = 0; i < 7; i++)
    for (const s of [-1, 1]) {
      const z = 1.2 + i * 0.26;
      k.add(k.cone(0.055, 0.0, 0.3), {
        ...night,
        pos: [s * 0.4, g + 0.15, z],
        pattern: false,
        flat: 0.35,
        color: (c) =>
          lit(
            shade("#2f5d34", 0.85 + 0.3 * c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40)),
            c,
            0.6,
          ),
      });
    }
  // The plinth with its row of niches.
  k.add(k.box(2.0, 0.12, 2.0), {
    ...night,
    pos: [0, g + 0.06, 0],
    flat: 0.2,
    color: (c) => {
      if (Math.abs(c.n[1]) < 0.5) {
        const along = Math.abs(c.n[0]) > 0.5 ? c.p[2] : c.p[0];
        const f = ((along + 1) / 0.125) % 1;
        if (inArch((f - 0.5) * 0.125, c.p[1] - g - 0.02, 0.035, 0.04)) return lit(shadowC, c);
      }
      return lit(marble, c);
    },
  });
  // The main hall: a chamfered square with great arched portals.
  const hw = 0.56;
  const ch = 0.17;
  const top = base + 0.62;
  const poly = [
    [hw - ch, hw],
    [-hw + ch, hw],
    [-hw, hw - ch],
    [-hw, -hw + ch],
    [-hw + ch, -hw],
    [hw - ch, -hw],
    [hw, -hw + ch],
    [hw, hw - ch],
  ];
  const hallColor = (main, mid) => (c) => {
    const along = main
      ? Math.abs(c.n[0]) > 0.5
        ? c.p[2]
        : c.p[0]
      : dot(sub(c.p, mid), unit(cross([0, 1, 0], c.n)));
    const y = c.p[1] - base;
    if (main) {
      if (inArch(along, y - 0.03, 0.17, 0.34, 1.25))
        return lit(inArch(along, y - 0.03, 0.09, 0.2, 1.25) ? "#8e97a6" : shadowC, c);
      if (Math.abs(along) < 0.22 && Math.abs(Math.abs(along) - 0.205) < 0.012 && y < 0.62)
        return lit("#d6d0c2", c);
      for (const sy of [0.04, 0.33])
        for (const s of [-1, 1])
          if (inArch(along - s * 0.31, y - sy, 0.055, 0.15, 1.25)) return lit(shadowC, c);
    } else {
      for (const sy of [0.04, 0.33])
        if (inArch(along, y - sy, 0.06, 0.15, 1.25)) return lit(shadowC, c);
    }
    return lit(marble, c);
  };
  for (let i = 0; i < 8; i++) {
    const [x0, z0] = poly[i];
    const [x1, z1] = poly[(i + 1) % 8];
    const mid = [(x0 + x1) / 2, 0, (z0 + z1) / 2];
    const nn = unit([z1 - z0, 0, -(x1 - x0)]);
    const n = dot(nn, mid) < 0 ? mul(nn, -1) : nn;
    const main = i % 2 === 0;
    k.add(quad(k, [x0, base, z0], [x1, base, z1], [x1, top, z1], [x0, top, z0], n), {
      ...night,
      flat: 0.2,
      color: hallColor(main, mid),
    });
    if (main) {
      // The portal frame rises above the roof line.
      const p = add(mid, mul(n, 0.004));
      const t = unit(cross([0, 1, 0], n));
      const a = add(p, mul(t, -0.25));
      const b = add(p, mul(t, 0.25));
      k.add(
        quad(
          k,
          [a[0], top, a[2]],
          [b[0], top, b[2]],
          [b[0], top + 0.1, b[2]],
          [a[0], top + 0.1, a[2]],
          n,
        ),
        { ...night, flat: 0.2, color: (c) => lit(marble, c) },
      );
    }
  }
  k.add(k.box(2 * hw, 0.01, 2 * hw), {
    ...night,
    pos: [0, top, 0],
    flat: 0.2,
    color: (c) => lit(marble, c),
  });
  // The drum, the onion dome and its finial.
  k.add(k.cylinder(0.3, 0.16), {
    pos: [0, top + 0.08, 0],
    flat: 0.2,
    color: (c) => lit(Math.abs(c.p[1] - top - 0.12) < 0.01 ? "#d6d0c2" : marble, c),
  });
  const dome = k.lathe(
    [
      [0.3, 0],
      [0.345, 0.07],
      [0.375, 0.17],
      [0.365, 0.27],
      [0.31, 0.37],
      [0.22, 0.46],
      [0.11, 0.54],
      [0.035, 0.61],
      [0.0, 0.65],
    ],
    { grid: 64 },
  );
  k.add(dome, {
    pos: [0, top + 0.16, 0],
    flat: 0.2,
    interior: 0.04,
    core: "#cfc8b8",
    color: (c) => lit(marble, c, 0.6),
  });
  const fy = top + 0.16 + 0.65;
  rod(k, [0, fy - 0.02, 0], [0, fy + 0.2, 0], 0.012, { weight: 3, color: "#d4af37" });
  for (const [y, r] of [
    [0.04, 0.03],
    [0.1, 0.022],
  ])
    k.add(k.sphere(r), { pos: [0, fy + y, 0], weight: 3, color: "#d4af37" });
  // Four kiosks round the dome and the corner pinnacles.
  const kiosk = (x, z, s) => {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      rod(
        k,
        [x + Math.sin(a) * 0.075 * s, top, z + Math.cos(a) * 0.075 * s],
        [x + Math.sin(a) * 0.075 * s, top + 0.13 * s, z + Math.cos(a) * 0.075 * s],
        0.011 * s,
        { ...night, weight: 2.5, color: (c) => lit(marble, c) },
      );
    }
    k.add(k.cylinder(0.1 * s, 0.02 * s), {
      ...night,
      pos: [x, top + 0.14 * s, z],
      flat: 0.2,
      color: (c) => lit(marble, c),
    });
    k.add(k.sphere(0.085 * s), {
      ...night,
      pos: [x, top + 0.17 * s, z],
      scale: [1, 1.15, 1],
      flat: 0.2,
      color: (c) => (c.p[1] < top + 0.15 * s ? null : lit(marble, c)),
    });
    rod(k, [x, top + 0.26 * s, z], [x, top + 0.31 * s, z], 0.006, {
      ...night,
      weight: 3,
      color: "#d4af37",
    });
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kiosk(sx * 0.36, sz * 0.36, 1);
  for (const [x, z] of poly)
    rod(
      k,
      [x, top, z],
      [x, top + 0.14, z],
      0.014,
      { ...night, weight: 2.5, color: (c) => lit(marble, c) },
      0.004,
    );
  // Minarets at the corners of the plinth.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * 0.9;
      const z = sz * 0.9;
      k.add(k.cone(0.075, 0.055, 1.18, { caps: false }), {
        ...night,
        pos: [x, base + 0.59, z],
        flat: 0.2,
        weight: 1.3,
        color: (c) => lit(Math.abs(((c.p[1] - base) / 0.04) % 1) < 0.08 ? "#e3ddd0" : marble, c),
      });
      for (const y of [0.42, 0.8, 1.15])
        k.add(k.cylinder(0.1 - y * 0.02, 0.025), {
          ...night,
          pos: [x, base + y, z],
          flat: 0.2,
          weight: 1.5,
          color: (c) => lit("#ebe6db", c),
        });
      const mt = base + 1.18;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        rod(
          k,
          [x + Math.sin(a) * 0.055, mt, z + Math.cos(a) * 0.055],
          [x + Math.sin(a) * 0.055, mt + 0.08, z + Math.cos(a) * 0.055],
          0.008,
          { ...night, weight: 3, color: (c) => lit(marble, c) },
        );
      }
      k.add(k.sphere(0.07), {
        ...night,
        pos: [x, mt + 0.09, z],
        scale: [1, 1.1, 1],
        flat: 0.2,
        weight: 1.5,
        color: (c) => (c.p[1] < mt + 0.08 ? null : lit(marble, c)),
      });
      rod(k, [x, mt + 0.16, z], [x, mt + 0.21, z], 0.005, {
        ...night,
        weight: 3,
        color: "#d4af37",
      });
    }
  // Moonlight (hidden at rest): the moon, built where it hangs behind the
  // Taj and rising into place (fading in by channel 0), and a shimmer of
  // moonlight on the pool.
  const moon = k.part("moon", { pivot: TAJ.moon });
  k.add(k.sphere(0.15), {
    part: moon,
    pos: TAJ.moon,
    weight: 4,
    pattern: false,
    fit: false,
    kind: "fade",
    channel: 0,
    params: [0.05, -0.5],
    color: (c) => {
      const m = c.noise(c.p[0] * 14, c.p[1] * 14, c.p[2] * 14);
      return keep(mix("#f4f7ff", "#c9d0e0", smoothstep(0.1, 0.5, m)));
    },
  });
  k.cloud({ share: 0.006, size: 3, pattern: false, part: moon, fit: false }, (rand) => {
    const d = unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
    const r = 0.15 + 0.11 * Math.sqrt(rand());
    return {
      p: add(TAJ.moon, mul(d, r)),
      color: "#dfe8ff",
      opacity: 0.14 * (1 - (r - 0.15) / 0.13),
      kind: "fade",
      channel: 0,
      params: [0.05, -0.5],
    };
  });
  const shimmer = k.part("shimmer", { pivot: [0, g, 1.9] });
  k.cloud({ share: 0.006, size: 1.2, pattern: false, part: shimmer }, (rand) => ({
    p: [(rand() - 0.5) * 0.12 * (0.4 + rand()), g + 0.01, 1.16 + rand() * 1.48],
    dir: [1, 0, 0],
    stretch: 2.5,
    color: mix("#e8efff", "#ffffff", rand()),
    opacity: 0.85,
    kind: "wave",
    params: [0.006, rand() * TAU],
  }));
}

// ---- Castle ------------------------------------------------------------------------------------

const CASTLE = { gate: [0, 0.03, 1.06] };

function castleBuild(k, o) {
  const stoneC = "#aaa498";
  const roofC = o.roof;
  const wallH = 0.62;
  const blocks = (c, base = stoneC) => {
    const along = Math.abs(c.n[0]) > Math.abs(c.n[2]) ? c.p[2] : c.p[0];
    return lit(
      stone(c, base, along + 5, c.p[1] + 1, {
        course: 0.055,
        block: 0.12,
        mortar: 0.12,
        vary: 0.18,
      }),
      c,
      0.62,
    );
  };
  const roundBlocks = (c, base = stoneC) => {
    const a = Math.atan2(c.p[0], c.p[2]);
    return lit(
      stone(c, base, a * 0.3 + 5, c.p[1] + 1, {
        course: 0.055,
        block: 0.1,
        mortar: 0.12,
        vary: 0.18,
      }),
      c,
      0.62,
    );
  };
  // Grass, and a square moat.
  k.add(k.box(4.4, 0.06, 4.4), {
    pos: [0, -0.03, 0],
    pattern: false,
    flat: 0.2,
    color: (c) => {
      if (c.n[1] < 0.5) return lit("#6b5a44", c);
      const m = Math.max(Math.abs(c.p[0]), Math.abs(c.p[2]));
      if (m > 1.36 && m < 1.84) return null;
      return grass(c, "#63a24a");
    },
  });
  water(k, -0.03, 1.84, 1.84, {
    rect: true,
    share: 0.08,
    deep: "#2f6f8f",
    light: "#6cb2cf",
    mask: (x, z) => {
      const m = Math.max(Math.abs(x), Math.abs(z));
      return m > 1.36 && m < 1.84;
    },
  });
  // Curtain walls with battlements.
  const merlons = (a, b, y, depth) => {
    const d = sub(b, a);
    const L = len(d);
    const nM = Math.floor(L / 0.16);
    for (let i = 0; i <= nM; i++) {
      const p = lerp3(a, b, (i + 0.25) / (nM + 0.5));
      k.add(k.box(0.085, 0.1, depth), {
        pos: add(p, [0, y + 0.05, 0]),
        quat: quatFromTo([1, 0, 0], d),
        flat: 0.2,
        weight: 1.3,
        color: (c) => blocks(c),
      });
    }
  };
  for (let j = 0; j < 4; j++) {
    const r = (p) => rotY(p, (j * Math.PI) / 2);
    const front = j === 0;
    k.add(k.box(2.0, wallH, 0.18), {
      pos: r([0, wallH / 2, 1.0]),
      rot: [0, j * 90, 0],
      flat: 0.2,
      interior: 0.04,
      core: "#7d776c",
      color: (c) => {
        if (
          front &&
          Math.abs(c.p[0]) < 0.17 &&
          inRound(c.p[0], c.p[1] - 0.02, 0.15, 0.2) &&
          c.n[2] > 0.5
        ) {
          const bar =
            (Math.abs(c.p[0]) * 30) % 1 < 0.25 || ((c.p[1] * 30) % 1 < 0.2 && c.p[1] > 0.12);
          return keep(bar ? "#3d3a36" : "#161412");
        }
        return blocks(c);
      },
    });
    merlons(r([-0.85, wallH, 1.06]), r([0.85, wallH, 1.06]), 0, 0.06);
  }
  // Round towers with conical roofs and flags.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const p = [sx * 1.0, 0, sz * 1.0];
      k.add(k.cylinder(0.28, 1.0, { caps: false }), {
        pos: add(p, [0, 0.5, 0]),
        flat: 0.2,
        color: (c) => {
          const a = Math.atan2(c.p[0] - p[0], c.p[2] - p[2]);
          const out = Math.atan2(sx, sz);
          const d = Math.abs(((a - out + Math.PI * 3) % TAU) - Math.PI);
          if (d < 0.08 && ((c.p[1] > 0.45 && c.p[1] < 0.6) || (c.p[1] > 0.72 && c.p[1] < 0.84)))
            return keep("#1b1917");
          return roundBlocks(c);
        },
      });
      k.add(k.cylinder(0.32, 0.08), {
        pos: add(p, [0, 1.02, 0]),
        flat: 0.2,
        color: (c) => roundBlocks(c, shade(stoneC, 0.92)),
      });
      k.add(k.cone(0.35, 0.0, 0.62), {
        pos: add(p, [0, 1.37, 0]),
        flat: 0.2,
        color: (c) => lit(shade(roofC, (c.p[1] * 25) % 1 < 0.2 ? 0.85 : 1), c, 0.6),
      });
      flag(
        k,
        add(p, [0, 1.6, 0]),
        0.3,
        0.2,
        0.11,
        (u, v) => (v < 0.5 ? "#f2c230" : shade(roofC, 1.1)),
        {
          dir: [-0.8, 0, -0.6],
          poleR: 0.008,
          pole: "#5a4a3a",
        },
      );
    }
  // The keep.
  const kp = [-0.25, 0, -0.3];
  k.add(k.box(0.72, 1.35, 0.72), {
    pos: add(kp, [0, 0.675, 0]),
    flat: 0.2,
    color: (c) => {
      if (Math.abs(c.n[1]) < 0.5) {
        const along = Math.abs(c.n[0]) > 0.5 ? c.p[2] - kp[2] : c.p[0] - kp[0];
        for (const wy of [0.75, 1.05])
          if (inRound(along, c.p[1] - wy, 0.035, 0.08)) return keep("#1b1917");
      }
      return blocks(c);
    },
  });
  for (let j = 0; j < 4; j++) {
    const r = (q) => add(kp, rotY(q, (j * Math.PI) / 2));
    merlons(r([-0.33, 1.35, 0.33]), r([0.33, 1.35, 0.33]), 0, 0.06);
  }
  flag(
    k,
    add(kp, [0, 1.35, 0]),
    0.45,
    0.32,
    0.2,
    (u, v) => (Math.abs(v - 0.5) < 0.18 || Math.abs(u - 0.35) < 0.12 ? "#f2c230" : roofC),
    {
      dir: [-0.8, 0, -0.6],
      poleR: 0.01,
      pole: "#5a4a3a",
    },
  );
  // Gate towers and the drawbridge.
  for (const s of [-1, 1]) {
    const p = [s * 0.32, 0, 1.05];
    k.add(k.cylinder(0.17, 0.82, { caps: false }), {
      pos: add(p, [0, 0.41, 0]),
      flat: 0.2,
      color: (c) => roundBlocks(c),
    });
    k.add(k.cylinder(0.2, 0.06), {
      pos: add(p, [0, 0.84, 0]),
      flat: 0.2,
      color: (c) => roundBlocks(c, shade(stoneC, 0.92)),
    });
    k.add(k.cone(0.22, 0.0, 0.38), {
      pos: add(p, [0, 1.06, 0]),
      flat: 0.2,
      color: (c) => lit(roofC, c, 0.6),
    });
  }
  const bridge = k.part("bridge", { pivot: CASTLE.gate, axis: [1, 0, 0] });
  k.add(k.box(0.34, 0.035, 0.84), {
    part: bridge,
    pos: add(CASTLE.gate, [0, 0, 0.42]),
    flat: 0.2,
    weight: 1.3,
    color: (c) => lit(shade("#8a6238", (c.p[0] * 30) % 1 < 0.15 ? 0.7 : 1), c),
  });
  for (const s of [-1, 1])
    rod(
      k,
      add(CASTLE.gate, [s * 0.15, 0.02, 0.8]),
      add(CASTLE.gate, [s * 0.15, 0.36, 0.0]),
      0.006,
      { part: bridge, weight: 3, color: "#3a3a3a" },
    );
  // A little troop of knights (and a banner) who march out over the lowered
  // drawbridge. Built where they stand outside; drive() walks them in and out.
  const knights = k.part("knights", { pivot: CASTLE.gate });
  const tunic = (c) => lit(Math.abs(c.lp[0]) < 0.008 ? "#f2c230" : roofC, c, 0.6);
  const knight = (x, z) => {
    const K = { part: knights, weight: 3, flat: 0.3 };
    for (const s of [-1, 1])
      k.add(k.box(0.022, 0.07, 0.026), {
        ...K,
        pos: [x + s * 0.016, 0.083, z],
        color: (c) => lit("#3b3530", c),
      });
    k.add(k.ellipsoid(0.042, 0.055, 0.032), { ...K, pos: [x, 0.158, z], color: tunic });
    for (const s of [-1, 1])
      k.add(k.ellipsoid(0.013, 0.04, 0.014), {
        ...K,
        pos: [x + s * 0.048, 0.158, z],
        color: (c) => lit("#b9bcc2", c, 0.6),
      });
    k.add(k.sphere(0.03), {
      ...K,
      pos: [x, 0.238, z],
      color: (c) =>
        c.n[2] > 0.5 && Math.abs(c.p[1] - 0.241) < 0.005 ? "#1b1917" : lit("#c9ccd1", c, 0.55),
    });
    k.add(k.cone(0.012, 0.0, 0.035), {
      ...K,
      pos: [x, 0.283, z],
      color: (c) => lit(roofC, c, 0.6),
    });
  };
  knight(0, 1.84);
  for (const z of [1.63, 1.42]) for (const x of [-0.075, 0.075]) knight(x, z);
  flag(
    k,
    [0.05, 0.15, 1.84],
    0.2,
    0.1,
    0.07,
    (u, v) => (Math.abs(v - 0.5) < 0.2 ? roofC : "#f2c230"),
    {
      dir: [0, 0, -1],
      poleR: 0.006,
      pole: "#5a4a3a",
      part: knights,
    },
  );
}

// ---- Pagoda ------------------------------------------------------------------------------------

function pagodaBuild(k, o) {
  const wood = o.color;
  const plaster = "#f1ebdd";
  const tile = "#3e4447";
  // Moss, gravel and a stone platform.
  ground(k, 1.7, 0, (c) => {
    const r = Math.hypot(c.p[0], c.p[2]);
    if (r < 1.2) return lit(shade("#d8d2c4", 0.94 + 0.1 * Math.sin(r * 90)), c);
    return grass(c, "#5d8f45");
  });
  k.add(k.box(1.5, 0.16, 1.5), {
    pos: [0, 0.08, 0],
    flat: 0.2,
    color: (c) =>
      lit(
        stone(c, "#a9a397", Math.abs(c.n[0]) > 0.5 ? c.p[2] : c.p[0], c.p[1] + 1, {
          course: 0.08,
          block: 0.2,
        }),
        c,
      ),
  });
  let y = 0.16;
  const bells = [];
  // Lit when the chimes ring: every door glows and the stone lanterns light.
  const glow = k.part("glow", { pivot: [0, 0.5, 0] });
  const warm = { part: glow, weight: 1.5, size: 1.3, pattern: false };
  for (let i = 0; i < 5; i++) {
    const s = 0.46 - 0.068 * i;
    const h = i === 0 ? 0.4 : 0.3;
    const yb = y;
    // The storey: posts, plaster panels and a door.
    k.add(k.box(2 * s, h, 2 * s), {
      pos: [0, yb + h / 2, 0],
      flat: 0.2,
      color: (c) => {
        if (Math.abs(c.n[1]) > 0.5) return lit(shade(wood, 0.7), c);
        const along = Math.abs(c.n[0]) > 0.5 ? c.p[2] : c.p[0];
        const f = (along + s) / (2 * s);
        const dy = c.p[1] - yb;
        const post = [0, 1 / 3, 2 / 3, 1].some((q) => Math.abs(f - q) < 0.035);
        if (post || dy < 0.03 || dy > h - 0.05) return lit(wood, c);
        if (Math.abs(f - 0.5) < 0.14 && dy < h * 0.8) return keep(shade("#4a2a1e", 0.9));
        return lit(plaster, c);
      },
    });
    for (let q = 0; q < 4; q++) {
      const a = (q * Math.PI) / 2;
      const w = 0.28 * s;
      const face = (x, yy) => add(rotY([x, yy, 0], a), rotY([0, 0, s + 0.008], a));
      k.add(
        quad(
          k,
          face(-w, yb + 0.03),
          face(w, yb + 0.03),
          face(w, yb + h * 0.8),
          face(-w, yb + h * 0.8),
        ),
        {
          ...warm,
          color: (c) => mix("#ffe9a8", "#ffb347", smoothstep(0.03, 0.3, c.p[1] - yb)),
        },
      );
    }
    y += h;
    const yr = y;
    // The roof: wide eaves that dip at the middle and curl up at the corners.
    const inner = s - 0.04;
    const outer = s + 0.34 - 0.02 * i;
    const drop = 0.16;
    const lift = 0.1;
    const sqPt = (u, r) => {
      const side = Math.floor(u * 4) % 4;
      const t = u * 4 - Math.floor(u * 4);
      const along = (t * 2 - 1) * r;
      const pts = [
        [along, r],
        [r, -along],
        [-along, -r],
        [-r, along],
      ];
      return { xz: pts[side], t };
    };
    const roofY = (v, t) =>
      yr +
      drop * 0.35 -
      drop * Math.pow(v, 1.3) +
      lift * Math.pow(v, 2.5) * Math.pow(Math.abs(2 * t - 1), 5);
    const roof = k.param(
      (u, v) => {
        const r = lerp(inner, outer, v);
        const { xz, t } = sqPt(u, r);
        return [xz[0], roofY(v, t), xz[1]];
      },
      { grid: 96, flip: true },
    );
    k.add(roof, {
      flat: 0.2,
      color: (c) => {
        const t = (c.u * 4) % 1;
        const hip = Math.abs(t - 0) < 0.012 || Math.abs(t - 1) < 0.012;
        const ribs = (t * 34) % 1 < 0.25;
        if (c.v > 0.95) return lit("#d8c9a6", c);
        return lit(shade(tile, hip ? 1.35 : ribs ? 0.85 : 1), c, 0.62);
      },
    });
    const under = k.param(
      (u, v) => {
        const r = lerp(inner, outer, v);
        const { xz, t } = sqPt(u, r);
        return [xz[0], roofY(v, t) - 0.025, xz[1]];
      },
      { grid: 64 },
    );
    k.add(under, { flat: 0.2, color: (c) => shade(wood, (c.u * 4 * 30) % 1 < 0.4 ? 0.55 : 0.7) });
    for (let q = 0; q < 4; q++) {
      const { xz } = sqPt(q / 4, outer);
      bells.push({ tier: i, p: [xz[0], roofY(1, 0) - 0.02, xz[1]] });
    }
    y += drop * 0.35 + 0.02;
  }
  // The spire with its rings.
  const ty = y - 0.02;
  prism(
    k,
    4,
    0.2 * Math.SQRT2,
    0.03,
    ty,
    ty + 0.14,
    { flat: 0.2, color: (c) => lit(tile, c) },
    { a0: Math.PI / 4, cap: false },
  );
  const bronze = "#b88a3a";
  rod(k, [0, ty + 0.1, 0], [0, ty + 0.85, 0], 0.018, {
    weight: 3,
    color: (c) => lit(bronze, c, 0.6),
  });
  for (let i = 0; i < 9; i++)
    k.add(k.torus(0.07 - i * 0.004, 0.012), {
      pos: [0, ty + 0.22 + i * 0.055, 0],
      weight: 2.5,
      color: (c) => lit(bronze, c, 0.6),
    });
  k.add(k.sphere(0.04), {
    pos: [0, ty + 0.89, 0],
    weight: 3,
    color: (c) => lit("#e0b44a", c, 0.6),
  });
  // Wind chimes at every corner: a bronze bell on a cord with a tab to catch
  // the wind. Each roof's four chimes are one part, so they swing together.
  for (const { tier, p: b } of bells) {
    const part = k.part(`chime${tier}`, { pivot: [0, b[1], 0] });
    rod(k, b, add(b, [0, -0.06, 0]), 0.004, { part, weight: 4, color: "#3a3028" });
    k.add(k.cone(0.03, 0.012, 0.05), {
      part,
      pos: add(b, [0, -0.085, 0]),
      weight: 4,
      pattern: false,
      kind: "twinkle",
      params: [0.4, b[1] * 20],
      color: (c) => lit("#e0b44a", c, 0.6),
    });
    rod(k, add(b, [0, -0.11, 0]), add(b, [0, -0.14, 0]), 0.003, {
      part,
      weight: 4,
      color: "#3a3028",
    });
    const tab = add(b, [0, -0.17, 0]);
    const side = unit(rotY([1, 0, 0], Math.atan2(b[0], b[2])));
    k.add(
      quad(
        k,
        add(tab, add(mul(side, -0.018), [0, 0.03, 0])),
        add(tab, add(mul(side, 0.018), [0, 0.03, 0])),
        add(tab, add(mul(side, 0.018), [0, -0.03, 0])),
        add(tab, add(mul(side, -0.018), [0, -0.03, 0])),
      ),
      { part, weight: 4, pattern: false, color: "#d8342b" },
    );
  }
  // Two stone lanterns by the path to the door.
  const stoneL = (c) => lit("#b3ada1", c, 0.62);
  for (const sx of [-1, 1]) {
    const L = [sx * 0.46, 0, 1.12];
    k.add(k.cylinder(0.09, 0.04), { pos: add(L, [0, 0.02, 0]), flat: 0.2, color: stoneL });
    k.add(k.cylinder(0.035, 0.2), { pos: add(L, [0, 0.14, 0]), flat: 0.2, color: stoneL });
    k.add(k.box(0.13, 0.03, 0.13), { pos: add(L, [0, 0.25, 0]), flat: 0.2, color: stoneL });
    k.add(k.box(0.1, 0.1, 0.1), {
      pos: add(L, [0, 0.315, 0]),
      flat: 0.2,
      color: (c) =>
        Math.abs(c.n[1]) < 0.5 &&
        Math.abs(c.p[1] - 0.315) < 0.03 &&
        Math.abs(Math.abs(c.n[0]) > 0.5 ? c.p[2] - L[2] : c.p[0] - L[0]) < 0.03
          ? keep("#2e2620")
          : stoneL(c),
    });
    k.add(k.cone(0.1, 0.015, 0.075, { caps: true }), {
      pos: add(L, [0, 0.4, 0]),
      flat: 0.2,
      color: stoneL,
    });
    k.add(k.sphere(0.018), { pos: add(L, [0, 0.45, 0]), weight: 3, color: stoneL });
    // The flame box and a halo of light.
    k.add(k.box(0.105, 0.065, 0.105), {
      ...warm,
      pos: add(L, [0, 0.315, 0]),
      color: "#ffd98a",
    });
    k.add(k.sphere(0.13), {
      ...warm,
      pos: add(L, [0, 0.315, 0]),
      weight: 0.8,
      size: 1.8,
      opacity: 0.28,
      color: "#ffcf73",
    });
  }
}

// ---- Windmill ----------------------------------------------------------------------------------

const MILL = { hub: null, axis: unit([Math.sin(0.55), 0.12, Math.cos(0.55)]) };
MILL.hub = add([0, 2.12, 0], mul(MILL.axis, 0.52));

function windmillBuild(k) {
  const thatch = "#6f6556";
  const wood = "#5a3b24";
  // A grassy mound with rows of tulips.
  k.add(
    k.lathe(
      [
        [1.65, 0.0],
        [1.3, 0.06],
        [0.8, 0.12],
        [0.0, 0.14],
      ],
      { grid: 64, thick: 0.06 },
    ),
    { flat: 0.2, pattern: false, color: (c) => grass(c, "#62a048") },
  );
  const tulips = ["#e8332c", "#f5c02f", "#f06fa5", "#ff7a2a", "#e8332c"];
  k.cloud({ share: 0.05, size: 1.1, pattern: false }, (rand) => {
    const row = Math.floor(rand() * 5);
    const x = 0.55 + row * 0.16;
    const z = (rand() - 0.5) * 1.5;
    const p = rotY([x, 0, z], 0.9);
    const r = Math.hypot(p[0], p[2]);
    if (r > 1.55 || r < 0.75) return null;
    const hgt = 0.14 * Math.max(0, 1 - Math.pow(r / 1.65, 2)) + 0.02;
    return { p: [p[0], hgt + rand() * 0.03, p[2]], n: [0, 1, 0], color: tulips[row], flat: 0.5 };
  });
  // The brick base and the thatched, eight-sided body.
  prism(k, 8, 0.66, 0.64, 0.1, 0.42, {
    flat: 0.2,
    color: (c) => {
      const a = Math.atan2(c.p[0], c.p[2]);
      return lit(
        stone(c, "#a4543b", a * 0.6 + 5, c.p[1], {
          course: 0.035,
          block: 0.08,
          mortar: 0.16,
          vary: 0.2,
        }),
        c,
      );
    },
  });
  prism(k, 8, 0.6, 0.38, 0.42, 2.0, {
    flat: 0.2,
    color: (c) => {
      const a = Math.atan2(c.p[0], c.p[2]);
      const d = Math.abs(((a - 0.55 + Math.PI * 3) % TAU) - Math.PI);
      const r = Math.hypot(c.p[0], c.p[2]);
      const s = d * r;
      if (s < 0.1 && c.p[1] < 0.8)
        return keep(Math.abs(s) > 0.085 || c.p[1] > 0.78 ? "#f4f1ea" : "#2f5a3a");
      for (const wy of [1.3, 1.72])
        if (Math.abs(d * r) < 0.06 && Math.abs(c.p[1] - wy) < 0.06)
          return keep(
            Math.abs(d * r) > 0.045 || Math.abs(c.p[1] - wy) > 0.045 ? "#f4f1ea" : "#23313d",
          );
      const straw = 0.9 + 0.12 * c.noise(a * 30, c.p[1] * 4, 0) + 0.06 * Math.sin(a * 90);
      return lit(shade(thatch, straw), c, 0.6);
    },
  });
  // The stage round the body.
  const sy = 0.95;
  k.add(k.cylinder(0.9, 0.04), {
    pos: [0, sy, 0],
    flat: 0.2,
    color: (c) => lit(shade(wood, 1.3 + 0.2 * Math.sin((c.p[0] + c.p[2]) * 60)), c),
  });
  k.add(k.torus(0.88, 0.01), { pos: [0, sy + 0.2, 0], weight: 3, color: wood });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    rod(
      k,
      [Math.sin(a) * 0.88, sy, Math.cos(a) * 0.88],
      [Math.sin(a) * 0.88, sy + 0.2, Math.cos(a) * 0.88],
      0.008,
      { weight: 3, color: wood },
    );
    if (i % 2 === 0)
      rod(
        k,
        [Math.sin(a) * 0.86, sy - 0.02, Math.cos(a) * 0.86],
        [Math.sin(a) * 0.55, sy - 0.4, Math.cos(a) * 0.55],
        0.012,
        { weight: 2, color: wood },
      );
  }
  // The cap and windshaft.
  k.add(k.ellipsoid(0.46, 0.36, 0.5), {
    pos: [0, 2.0, 0],
    flat: 0.2,
    color: (c) =>
      c.p[1] < 1.99
        ? null
        : lit(shade(thatch, 0.85 + 0.1 * c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30)), c, 0.6),
  });
  rod(k, [0, 2.12, 0], MILL.hub, 0.06, { weight: 2, color: (c) => lit(wood, c) });
  // The sails: four lattice arms covered in cloth, turning as one part.
  const sails = k.part("sails", { pivot: MILL.hub, axis: MILL.axis });
  const e1 = unit(cross(MILL.axis, [0, 1, 0]));
  const e2 = cross(e1, MILL.axis);
  k.add(k.sphere(0.08), { part: sails, pos: MILL.hub, weight: 2, color: (c) => lit(wood, c) });
  for (let i = 0; i < 4; i++) {
    const th = (i * Math.PI) / 2 + Math.PI / 4;
    const d = add(mul(e1, Math.cos(th)), mul(e2, Math.sin(th)));
    const pp = add(mul(e1, Math.cos(th + Math.PI / 2)), mul(e2, Math.sin(th + Math.PI / 2)));
    const at = (r, w) => add(add(MILL.hub, mul(d, r)), add(mul(pp, w), mul(MILL.axis, 0.02)));
    rod(k, MILL.hub, add(MILL.hub, mul(d, 1.6)), 0.028, {
      part: sails,
      weight: 2,
      color: (c) => lit(wood, c),
    });
    for (const w of [0.02, 0.17, 0.31])
      rod(k, at(0.32, w), at(1.58, w), 0.009, { part: sails, weight: 3, color: "#f4f1ea" });
    for (let j = 0; j <= 12; j++) {
      const r = 0.32 + (1.26 * j) / 12;
      rod(k, at(r, 0.0), at(r, 0.31), 0.007, { part: sails, weight: 3, color: "#f4f1ea" });
    }
    k.add(quad(k, at(0.45, 0.03), at(1.55, 0.03), at(1.55, 0.3), at(0.45, 0.3)), {
      part: sails,
      flat: 0.2,
      opacity: 0.9,
      color: (c) => shade("#efe6d2", 0.85 + 0.15 * Math.abs(sunOf(c.n))),
    });
  }
  const R = 1.62;
  k.reach(add(MILL.hub, mul(e2, R)));
  k.reach(add(MILL.hub, mul(e1, R)));
  k.reach(add(MILL.hub, mul(e1, -R)));
}

// ---- Recipes ----------------------------------------------------------------------------------

const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const easeOut = (x) => 1 - (1 - x) ** 3;
// 0..1 as x runs from a to b.
const band = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
// Seconds since a pulse fired, as 0..1 (1 at rest).
const progress = (v) => (v > 0 ? 1 - v : 1);

export const RECIPES = {
  "eiffel-tower": {
    controls: [{ key: "show", label: "Light show", type: "pulse", ease: EIF_SECS }],
    action: { key: "show", label: "Sparkle and fireworks" },
    drive(t, c, out) {
      // The night show: the tower's gold lights come on, a sparkle of
      // white lights climbs the ironwork, and four fireworks burst round it
      // (blue, white, red and gold), each opening fast, drooping and
      // burning out. Then the lights go down.
      const on = c.show > 0;
      const s = progress(c.show) * EIF_SECS;
      const lights = on ? easeInOut(band(s, 0, 0.5)) * (1 - easeInOut(band(s, 3.5, 4.1))) : 0;
      out.morph = [on ? 1.1 * band(s, 0.3, 3.4) : 0, 0.46 * lights];
      out.glow = [1.25, 1.0, 0.62, on ? 1 : 0];
      out.parts.sparkle = { visible: lights > 0.02 ? Math.min(1, lights * 1.6) : 0 };
      EIF_BURSTS.forEach((B, i) => {
        const u = on ? (s - B.at) / 1.8 : -1;
        const live = u > 0 && u < 1;
        out.parts[`burst${i}`] = {
          scale: (0.06 + 0.94 * easeOut(clamp(u / 0.2, 0, 1))) / EIF_BUILT,
          offset: [0, -0.16 * Math.max(0, u) ** 2, 0],
          visible: live ? 1 - band(u, 0.5, 1) : 0,
        };
      });
    },
    build: eiffelBuild,
  },

  "washington-monument": {
    alive: true,
    controls: [{ key: "day", label: "A day", type: "pulse", ease: MON_SECS }],
    action: { key: "day", label: "Sun and shadow" },
    drive(t, c, out) {
      // A day in a few seconds: the sun rises behind the monument, arcs
      // over and sets, and the obelisk's shadow swings round the lawn in
      // front like a sundial's, while the flags ripple in the breeze.
      const on = c.day > 0;
      const s = progress(c.day) * MON_SECS;
      const u = on ? easeInOut(band(s, 0.2, MON_SECS - 0.2)) : 0;
      const up = on ? band(u, 0, 0.1) * (1 - band(u, 0.9, 1)) : 0;
      out.morph = [0.25 + 0.5 * u, up];
      out.glow = [-0.36, -0.34, -0.27, up];
      out.parts.sun = { offset: sub(monSun(u), monSun(0.5)), visible: up > 0.001 ? 1 : 0 };
      out.amount = 1 + 3 * (on ? band(s, 0, 0.6) * (1 - band(s, MON_SECS - 1.2, MON_SECS)) : 0);
    },
    build: monumentBuild,
  },

  pyramids: {
    controls: [{ key: "visit", label: "Visitor", type: "pulse", ease: PYR.secs }],
    action: { key: "visit", label: "A visitor from space" },
    drive(t, c, out) {
      // A joke: a tiny flying saucer glides in by the Great Pyramid and
      // switches on its beam; sand streams up out of the desert into the
      // shape of a camel, which floats up into the saucer. The saucer
      // wobbles happily and zips away. (The sand settles back unseen.)
      const on = c.visit > 0;
      const s = progress(c.visit) * PYR.secs;
      const arrive = easeOut(band(s, 0, 1.1));
      const leave = band(s, 4.3, 5.0) ** 2;
      const wob = Math.sin(s * 5) * 0.06 * band(s, 0.6, 1.2) + Math.sin(s * 14) * 0.12 * band(s, 3.9, 4.1) * (1 - band(s, 4.2, 4.4)); // prettier-ignore
      const from = [-1.6, 1.2, -0.9];
      const away = [1.2, 2.6, -0.6];
      out.parts.ufo = {
        offset: add(mul(from, 1 - arrive), add(mul(away, leave), [0, 0.03 * Math.sin(s * 3.1), 0])),
        quat: quatAxisAngle([0.52, 0, 0.85], wob + 0.25 * (1 - arrive) - 0.3 * leave),
        visible: on && s < 4.95 ? 1 : 0,
      };
      const beam = on ? band(s, 1.1, 1.5) * (1 - band(s, 3.9, 4.2)) : 0;
      // The camel forms, holds, then rises and shrinks into the saucer; it
      // is back under the sand (hidden) before it shows again at rest.
      const form = on ? easeInOut(band(s, 1.4, 2.7)) : 0;
      const lift = on ? easeInOut(band(s, 3.0, 3.9)) : 0;
      const back = !on || s > 4.4;
      out.morph = [back ? 0 : form, beam];
      out.parts.camel = {
        offset: back ? [0, 0, 0] : [0, (PYR.hover[1] - 0.42) * lift + 0.015 * Math.sin(s * 6) * form, 0], // prettier-ignore
        scale: back ? 1 : 1 - 0.85 * lift,
        visible: back ? (on ? band(s, 4.5, 4.7) : 1) : lift > 0.97 ? 0 : 1,
      };
    },
    build: pyramidsBuild,
  },

  supertall: {
    alive: true,
    options: [{ key: "glass", label: "Glass", type: "color", default: "#4f86ad" }],
    controls: [{ key: "twist", label: "Twist", type: "pulse", ease: ST.secs }],
    action: { key: "twist", label: "Twist and light up" },
    drive(t, c, out) {
      // The floors wring round further, each band by its height (the top
      // turns most), while a ring of light runs up the glass; then they
      // unwind with a little sway and a second light runs up.
      const on = c.twist > 0;
      const s = progress(c.twist) * ST.secs;
      const wind = on ? easeInOut(band(s, 0.1, 1.4)) * (1 - easeInOut(band(s, 2.2, 3.5))) : 0;
      const sway = on ? 0.12 * Math.sin((s - 3.5) * 9) * band(s, 3.5, 3.6) * (1 - band(s, 3.6, 4)) : 0; // prettier-ignore
      for (let i = 0; i < ST.bands; i++) {
        const v = (i + 0.5) / ST.bands;
        out.parts[`floor${i}`] = { quat: quatAxisAngle([0, 1, 0], -(ST.twist * wind + sway) * v) };
      }
      const first = s < 2;
      out.morph = [on ? 1.15 * (first ? band(s, 0.3, 1.6) : band(s, 2.3, 3.6)) : 0];
      const g = first ? band(s, 0.2, 0.4) * (1 - band(s, 1.5, 1.7)) : band(s, 2.2, 2.4) * (1 - band(s, 3.5, 3.7)); // prettier-ignore
      out.glow = [0.55, 0.85, 1.0, on ? 0.9 * g : 0];
    },
    build: supertallBuild,
  },

  lighthouse: {
    alive: true,
    options: [{ key: "color", label: "Stripes", type: "color", default: "#d6322b" }],
    controls: [{ key: "light", label: "Light", type: "toggle", default: 1, ease: 0.8 }],
    action: { key: "light", label: "Light on or off" },
    drive(t, c, out) {
      out.parts.beam = { angle: t * 0.9, visible: smoothstep(0, 0.6, c.light) };
    },
    build: lighthouseBuild,
  },

  "statue-of-liberty": {
    alive: true,
    controls: [{ key: "flare", label: "Flare", type: "pulse", ease: 4.2 }],
    action: { key: "flare", label: "Light the torch" },
    drive(t, c, out, info) {
      // The torch flares: its flame leaps to twice its size in a halo of
      // light, a warm glow spreads down the statue, and golden sparks drift
      // up and away on the breeze and burn out. Then it settles.
      const on = c.flare > 0;
      const s = progress(c.flare) * 4.2;
      const big = on ? easeOut(band(s, 0, 0.35)) * (1 - easeInOut(band(s, 2.8, 3.7))) : 0;
      const flick = 1 + 0.08 * Math.sin(info.time * 23) * big;
      out.parts.flame = { scale: (1 + 1.2 * big) * flick };
      out.parts.halo = { scale: 1.1 + 2 * big, visible: big > 0.01 ? 1 : 0 };
      const drift = on ? easeOut(band(s, 0.15, 3.3)) : 0;
      const live = on && s < 3.3;
      out.parts.sparks = { visible: live ? band(s, 0.1, 0.2) * (1 - band(s, 2.3, 3.2)) : 0 };
      out.morph = [live ? drift : 0, big, 0.52 * big];
      out.glow = [1.0, 0.7, 0.28, on ? 1 : 0];
    },
    build: libertyBuild,
  },

  "white-house": {
    alive: true,
    controls: [{ key: "evening", label: "Evening", type: "pulse", ease: 4.6 }],
    action: { key: "evening", label: "Fountain and lights" },
    drive(t, c, out) {
      // The fountain on the south lawn shoots up a tall jet that falls back
      // as spray, the lights come on in the windows one by one, and the
      // flag ripples in the breeze. Then the jet sinks and the lights go
      // out one by one.
      const on = c.evening > 0;
      const s = progress(c.evening) * 4.6;
      const jet = on ? easeOut(band(s, 0.05, 0.7)) * (1 - easeInOut(band(s, 3.3, 4.3))) : 0;
      const pump = 1 + 0.05 * Math.sin(s * 9) * jet;
      out.parts.spray = { visible: jet > 0.2 ? 1 : jet * 5 };
      const lights = on ? (s < 2.8 ? band(s, 0.3, 2.1) : 1 - band(s, 2.9, 4.4)) : 0;
      out.morph = [jet * pump, lights];
      out.amount = 1 + 2.5 * jet;
    },
    build: whiteHouseBuild,
  },

  "leaning-tower": {
    controls: [
      { key: "lean", label: "Lean", type: "slider", default: 0.35 },
      { key: "drop", label: "Drop", type: "pulse", ease: PISA_SECS },
    ],
    action: { key: "drop", label: "Drop two balls" },
    drive(t, c, out) {
      // Galileo's experiment: the tower leans a little further, two balls
      // (a big iron one and a small bronze one) roll off the top ledge and
      // fall side by side, landing at the same moment with a puff of dust.
      // They bounce, settle and fade, and the tower eases back.
      const on = c.drop > 0;
      const s = progress(c.drop) * PISA_SECS;
      const extra = on ? 0.07 * easeInOut(band(s, 0, 0.7)) * (1 - easeInOut(band(s, 2.8, 3.9))) : 0;
      const angle = c.lean * PISA.max + extra;
      out.parts.tower = { angle };
      const T0 = 0.8;
      const T1 = 1.9;
      PISA_BALLS.forEach(([, , r, , hop], i) => {
        const built = pisaLedge(i, 0.35 * PISA.max + 0.07);
        const home = [built[0], 0.02 + r, built[2]];
        // They roll out to the edge as the tower leans, and drop off it.
        const roll = easeInOut(band(s, 0.35, T0));
        const from = pisaLedge(i, s < T0 ? angle : c.lean * PISA.max + 0.07 * easeInOut(band(T0, 0, 0.7)), roll); // prettier-ignore
        const ground = 0.02 + r;
        let p = from;
        if (s >= T0) {
          const f = band(s, T0, T1);
          const y = from[1] - (from[1] - ground) * f * f;
          const b = s - T1;
          const bounce = b <= 0 ? 0 : hop * Math.abs(Math.sin(b * 7.5)) * Math.exp(-b * 4.5);
          p = [from[0], y + bounce, from[2]];
        }
        out.parts[`ball${i}`] = {
          offset: sub(p, home),
          visible: on ? easeOut(band(s, 0.15, 0.45)) * (1 - band(s, 3.4, 4.0)) : 0,
        };
        const puff = on ? band(s, T1, T1 + 0.9) : 0;
        out.parts[`dust${i}`] = {
          offset: sub([from[0], 0.03, from[2]], [built[0], 0.03, built[2]]),
          scale: 0.4 + 1.1 * easeOut(puff),
          visible: puff > 0 && puff < 1 ? 1 - puff : 0,
        };
      });
    },
    build: pisaBuild,
  },

  colosseum: {
    controls: [{ key: "race", label: "Race", type: "pulse", ease: COL.secs }],
    action: { key: "race", label: "A chariot race" },
    drive(t, c, out) {
      // A chariot race (no fighting): the crowd fills the seats, and four
      // chariots in the team colours race a lap and a quarter of the arena,
      // swapping the lead, while the crowd jumps and cheers. Then the
      // chariots and the crowd fade away.
      const on = c.race > 0;
      const s = progress(c.race) * COL.secs;
      const u = band(s, 0.35, 4.7);
      const go = (u + easeInOut(u)) / 2;
      const fans = on ? band(s, 0, 1.2) * (1 - band(s, 4.4, 5.1)) : 0;
      const cars = on ? band(s, 0.05, 0.35) * (1 - band(s, 4.6, 5.0)) : 0;
      // The two lanes take turns to lead (each lane's pair keeps its gap).
      COL.teams.forEach((_, i) => {
        const ph = i % 2 ? Math.PI + 0.4 : 0.4;
        const d = TAU * (1.25 * go + 0.07 * (Math.sin(TAU * go + ph) - Math.sin(ph)));
        const phi = colStart(i) + d;
        const bob = 0.004 * Math.abs(Math.sin(s * 22 + i));
        out.parts[`chariot${i}`] =
          cars > 0.001
            ? {
                offset: add(sub(colTrack(phi, i), colTrack(colStart(i), i)), [0, bob, 0]),
                quat: quatAxisAngle([0, 1, 0], colHeading(phi, i) - colHeading(colStart(i), i)),
              }
            : { visible: 0 };
      });
      const cheer = on ? band(s, 0.4, 1.0) * (1 - band(s, 4.3, 4.9)) : 0;
      for (let j = 0; j < 2; j++)
        out.parts[`crowd${j}`] =
          fans > 0.001
            ? { offset: [0, 0.012 * cheer * Math.max(0, Math.sin(s * 11 + j * Math.PI)), 0] }
            : { visible: 0 };
      out.morph = [cars, 0.7 * fans];
    },
    build: colosseumBuild,
  },

  parthenon: {
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "ruin",
        choices: [
          { id: "ruin", label: "Today" },
          { id: "ancient", label: "Ancient" },
        ],
      },
    ],
    controls: [{ key: "walk", label: "Procession", type: "pulse", ease: PAR.secs }],
    action: { key: "walk", label: "A procession" },
    drive(t, c, out) {
      // A procession: eight robed figures, some with baskets and jars on
      // their heads, walk in single file along the temple, round the corner
      // and across the front of its steps, then fade away.
      const on = c.walk > 0;
      const s = progress(c.walk) * PAR.secs;
      const walk = on ? PAR.speed * Math.max(0, s - 0.5) : 0;
      const seen = on ? band(s, 0, 0.6) * (1 - band(s, PAR.secs - 0.8, PAR.secs - 0.1)) : 0;
      for (let i = 0; i < PAR.n; i++) {
        const d = Math.min(parLen(), parStart(i) + walk);
        const { p, h } = parPath(d);
        const home = PAR_BUILT;
        const step = walk > 0 && d < parLen() ? 1 : 0;
        const ph = walk * 11 + i * 1.3;
        out.parts[`walker${i}`] =
          seen > 0.001
            ? {
                offset: add(sub(p, home), [0, 0.008 * Math.abs(Math.sin(ph)) * step, 0]),
                quat: quatMul(quatAxisAngle([0, 1, 0], h), quatAxisAngle([0, 0, 1], 0.05 * Math.sin(ph) * step)), // prettier-ignore
              }
            : { visible: 0 };
      }
      out.morph = [seen];
    },
    build: parthenonBuild,
  },

  stonehenge: {
    controls: [{ key: "dawn", label: "Solstice", type: "pulse", ease: HENGE.secs }],
    action: { key: "dawn", label: "Solstice sunrise" },
    drive(t, c, out) {
      // Solstice sunrise: the sun comes up over the far bank, framed by the
      // great trilithon, a golden beam shines through the stones along the
      // monument's axis, and the stones glow gold. Then it fades back.
      const on = c.dawn > 0;
      const s = progress(c.dawn) * HENGE.secs;
      const rise = on ? easeOut(band(s, 0, 2.4)) : 0;
      const set = on ? easeInOut(band(s, 3.8, HENGE.secs)) : 0;
      out.parts.sun = {
        offset: [0, -0.7 * (1 - rise) - 0.55 * set, 0],
        visible: rise * (1 - set) > 0.001 ? 1 : 0,
      };
      const lightUp = on ? band(s, 0.9, 2.2) * (1 - band(s, 3.6, 4.8)) : 0;
      out.morph = [on ? rise * (1 - set) : 0, 0.7 * easeInOut(lightUp), easeInOut(lightUp)];
      out.glow = [1.0, 0.62, 0.18, lightUp > 0 ? 0.8 : 0];
    },
    build: stonehengeBuild,
  },

  "big-ben": {
    alive: true,
    controls: [{ key: "chime", label: "Chime", type: "pulse", ease: 4 }],
    action: { key: "chime", label: "Chime the bell" },
    drive(t, c, out) {
      // The hands show the real time (a clock may read the date in drive).
      // A chime spins them round in whole turns (so they land back on the
      // time), lights the dials and swings the bell.
      const d = new Date();
      const m = d.getMinutes() + d.getSeconds() / 60;
      const h = (d.getHours() % 12) + m / 60;
      const p = c.chime > 0.001 ? 1 - c.chime : 1;
      const spin = smoothstep(0, 0.6, p);
      for (let j = 0; j < 4; j++) {
        out.parts[`hour${j}`] = { angle: (-TAU * h) / 12 - TAU * spin };
        out.parts[`minute${j}`] = { angle: (-TAU * m) / 60 - 3 * TAU * spin };
      }
      out.parts.glow = { visible: smoothstep(0, 0.06, p) * (1 - smoothstep(0.7, 1, p)) };
      const swing = smoothstep(0, 0.05, p) * (1 - smoothstep(0.45, 1, p));
      out.parts.bell = { angle: 0.6 * Math.sin(TAU * 3 * p) * swing };
      out.amount = 1 + 6 * c.chime;
    },
    build: benBuild,
  },

  "taj-mahal": {
    alive: true,
    controls: [{ key: "moon", label: "Moonlight", type: "pulse", ease: TAJ.secs }],
    action: { key: "moon", label: "Moonlight" },
    drive(t, c, out) {
      // Moonlight: night falls on the garden and the buildings, the moon
      // rises behind the Taj, the great dome stays bright white and glows
      // against the night, and moonlight shimmers on the rippling pool.
      // Then day comes back.
      const on = c.moon > 0;
      const s = progress(c.moon) * TAJ.secs;
      const dusk = on ? easeInOut(band(s, 0, 1.2)) * (1 - easeInOut(band(s, 3.9, 5.1))) : 0;
      const rise = on ? easeOut(band(s, 0.3, 2.2)) : 0;
      const moonUp = on ? rise * (1 - band(s, 3.9, 5.0)) : 0;
      out.parts.moon = { offset: [0, -0.5 * (1 - rise), 0], visible: moonUp > 0.001 ? 1 : 0 };
      out.parts.shimmer = { visible: dusk > 0.05 ? dusk : 0 };
      out.morph = [moonUp, dusk];
      out.glow = [-0.46, -0.4, -0.24, dusk > 0 ? 1 : 0];
      out.amount = 1 + 2.5 * dusk;
    },
    build: tajBuild,
  },

  castle: {
    alive: true,
    options: [{ key: "roof", label: "Roofs", type: "color", default: "#2f5d9e" }],
    controls: [{ key: "raise", label: "Drawbridge up", type: "toggle", default: 1, ease: 3.4 }],
    action: { key: "raise", label: "Raise or lower the drawbridge" },
    drive(t, c, out) {
      // Lowering: the bridge drops first, then the knights march out and
      // stand guard. Raising: they march back in before the bridge goes up.
      const r = c.raise;
      out.parts.bridge = { angle: -1.45 * easeInOut(clamp((r - 0.52) / 0.48, 0, 1)) };
      const m = clamp((0.6 - r) / 0.6, 0, 1);
      const D = 1.25;
      const walking = m > 0.001 && m < 0.999 ? 1 : 0;
      const bob = 0.012 * Math.abs(Math.sin((m * D * Math.PI) / 0.07)) * walking;
      out.parts.knights = { offset: [0, bob, -D * (1 - m)], visible: smoothstep(0, 0.06, m) };
    },
    build: castleBuild,
  },

  pagoda: {
    alive: true,
    options: [{ key: "color", label: "Timber", type: "color", default: "#c8372d" }],
    controls: [{ key: "chime", label: "Bells", type: "pulse", ease: 4 }],
    action: { key: "chime", label: "Ring the bells" },
    drive(t, c, out, info) {
      // A breeze: the chimes on every roof swing (each roof a beat behind
      // the one below), and the doors and lanterns light up.
      const p = c.chime > 0.001 ? 1 - c.chime : 1;
      const swing = smoothstep(0, 0.05, p) * (1 - smoothstep(0.45, 1, p));
      for (let i = 0; i < 5; i++) {
        const ph = info.time * 7 - i * 0.9;
        out.parts[`chime${i}`] = {
          quat: quatAxisAngle([0, 1, 0], 0.07 * Math.sin(ph) * swing),
          offset: [0.035 * Math.sin(ph + 0.6) * swing, 0, 0.03 * Math.cos(ph) * swing],
        };
      }
      out.parts.glow = { visible: smoothstep(0, 0.07, p) * (1 - smoothstep(0.75, 1, p)) };
      out.amount = 1 + 1.5 * c.chime;
    },
    build: pagodaBuild,
  },

  windmill: {
    alive: true,
    controls: [{ key: "gust", label: "Gust", type: "pulse", ease: 4 }],
    action: { key: "gust", label: "A gust of wind" },
    drive(t, c, out) {
      // The sails turn briskly; a gust hits them at once and spins them up
      // hard for three extra turns, easing off as it passes.
      const p = 1 - c.gust;
      const g = 1 - Math.pow(1 - p, 3);
      out.parts.sails = { angle: t * 1.5 + 3 * TAU * g };
    },
    build: windmillBuild,
  },
};
