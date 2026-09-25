// Space pack: the Sun and planets, moons and comets, stars, nebulae and
// galaxies. Loaded on demand. There is no lighting, so surfaces bake in a
// soft light and glows are clouds of faint splats; glows, rings and stars
// keep their colours under flags and patterns.

import {
  mix,
  shade,
  smoothstep,
  ramp,
  clamp,
  spline,
  quatAxisAngle,
  quatMul,
  quatRotate,
  quatEuler,
  quatFromTo,
  fibonacciSphere,
} from "../kit.js";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const keep = (c, size) => ({ c, keep: true, size });
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x) => 1 - (1 - x) * (1 - x) * (1 - x);
const ease = (x) => x * x * (3 - 2 * x);
// 0 before a, rising to 1 at b.
const band = (x, a, b) => clamp01((x - a) / (b - a));
// Rises from a to b, holds, falls from c to d.
const bump = (x, a, b, c, d) => band(x, a, b) * (1 - band(x, c, d));
// A pulse control's progress: 0 at the tap, 1 when done (and at rest).
const progress = (v) => (v > 0 ? 1 - v : 1);

// Per-toy memory for drive(), keyed by the control state object (new each
// time a toy loads).
const MEM = new WeakMap();
function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}
// True on the frame a pulse control fires.
function fired(m, key, v) {
  const was = m["p_" + key] ?? 0;
  m["p_" + key] = v;
  return v > was + 0.02;
}
// Roughly normal random numbers (mean 0, sd 1).
const gauss = (rand) => (rand() + rand() + rand() + rand() - 2) * 1.73;
const randDir = (rand) => {
  const z = rand() * 2 - 1;
  const a = rand() * TAU;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), z, r * Math.sin(a)];
};
// The i-th of n directions spread evenly (a golden spiral) over the cap of
// directions d with dot(d, axis) > lo, for shells that must cover without
// gaps.
const fibCap = (i, n, axis, lo) => {
  const y = 1 - ((1 - lo) * (i + 0.5)) / n;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const a = i * 2.399963;
  return quatRotate(quatFromTo([0, 1, 0], axis), [r * Math.cos(a), y, r * Math.sin(a)]);
};
// Two unit vectors at right angles to n.
function basis(n) {
  const a = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = unit(cross(a, n));
  return [e1, cross(n, e1)];
}

// Latitude and longitude (radians) of a direction, and back.
const latOf = (d) => Math.asin(clamp(d[1], -1, 1));
const lonOf = (d) => Math.atan2(d[0], d[2]);
const dirOf = (lat, lon) => [
  Math.cos(lat) * Math.sin(lon),
  Math.sin(lat),
  Math.cos(lat) * Math.cos(lon),
];
const angle = (a, b) => Math.acos(clamp(dot(a, b), -1, 1));

// Direction towards a camera at yaw/pitch (the default is 0.55, 0.28), its
// right and up vectors, and points on the limb it sees.
function camDir(yaw = 0.55, pitch = 0.28) {
  return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
}
function camFrame(yaw = 0.55, pitch = 0.28) {
  const c = camDir(yaw, pitch);
  const right = unit(cross([0, 1, 0], c));
  return { c, right, up: cross(c, right) };
}
function limbDir(a, cam = camDir(), lift = 0) {
  const e1 = unit(cross(cam, [0, 1, 0]));
  const e2 = cross(e1, cam);
  return unit(add(add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a))), mul(cam, lift)));
}
// A rotation that opens a disc's face `open` radians further towards the
// camera and turns it `slant` radians about the view direction.
function faceCamera(open, slant, yaw = 0.55, pitch = 0.28) {
  const f = camFrame(yaw, pitch);
  return quatMul(quatAxisAngle(f.c, slant), quatAxisAngle(f.right, open));
}

// Soft light baked into a surface: brighter towards the light, never black.
const LIGHT = unit([-0.35, 0.55, 0.75]);
function lit(col, n, amount = 0.35, light = LIGHT) {
  const l = dot(n, light);
  return shade(col, 1 - amount * 0.55 + amount * (0.5 + 0.5 * l));
}
// For bodies that spin: a light that only depends on latitude, so it does
// not turn with the globe.
const pole = (col, d, amount = 0.1) => shade(col, 1 + amount * d[1]);

// Splat sizes for cloud-only toys scale with the budget, so weak phones
// (fewer splats) still get a filled-in glow.
const budgetScale = (k, power = 0.5) => Math.pow(160000 / k.count, power);
// In toys made of clouds (no weighted surfaces) the base splat size is 0.01;
// this is the size multiplier that covers a surface of this area with this
// share of the budget, by the kit's own density rule.
const coverSize = (k, area, share) =>
  (Math.sqrt(area / (Math.max(1, share * k.count) * Math.PI)) * 1.35) / 0.01;

// ---- Turning all the way round ------------------------------------------------------
// Splats are depth-sorted in the pose they are built in, so a solid body
// turned more than a quarter turn draws its far side over its near side.
// A body that turns all the way round is built twice: copy B half a turn
// round, coloured just as copy A would be there (its baked light turns
// with it). spinParts() shows whichever copy is within a quarter turn of
// the pose it was built in. (A layer of splats above a turning body, such
// as clouds, still draws wrongly, so clouds are painted on instead.)
const halfTurn = (axis) => quatAxisAngle(axis, Math.PI);
function turnedColor(fn, q, center = [0, 0, 0]) {
  return (c) => {
    c.n = quatRotate(q, c.n);
    c.p = add(center, quatRotate(q, sub(c.p, center)));
    return fn(c);
  };
}
// Turns the pair of parts `name` and `name`B by `angle`; `more` is merged
// into both (visible multiplies).
function spinParts(out, name, angle, more = {}) {
  const a = ((angle % TAU) + TAU) % TAU;
  const b = a > Math.PI / 2 && a < 1.5 * Math.PI;
  const vis = more.visible ?? 1;
  out.parts[name] = { ...more, angle: a, visible: b ? 0 : vis };
  out.parts[name + "B"] = { ...more, angle: a - Math.PI, visible: b ? vis : 0 };
}
// Copy B's share of a body's splats, and the size that keeps it covered.
const TURNED = { weight: 0.45, size: 1.5 };
// A shell made of several turning parts (bands) also needs its far side
// hidden while it turns (the part's cull flag), or one band's back draws
// over the next band's front near the edge. With the back gone, splats
// this much bigger close the gaps it used to fill.
const CULLED_SIZE = 1.2;
// A fixed layer over part of a turning body (a night shade, a glow) sorts
// against the copy in its built pose too, and a copy built nearer the
// camera than where it is shown draws over the layer. Such a body is built
// four times, a quarter turn apart (name, nameB, nameC, nameD), and
// spinQuarters() shows the copy whose built pose lies on one side of where
// it is shown: side +1 shows copies turned 0..90° past their build (built
// behind: for a layer on the side the ground turns away from), side -1
// copies turned -90..0° (built ahead: for a layer on the side it turns
// towards).
const QUARTER = { weight: 0.55, size: 1.35 };
const QUARTER_NAMES = ["", "B", "C", "D"];
function spinQuarters(out, name, angle, side, more = {}) {
  const step = TAU / 4;
  const a = ((angle % TAU) + TAU) % TAU;
  const j = side > 0 ? Math.floor(a / step + 1e-9) : Math.ceil(a / step - 1e-9);
  const vis = more.visible ?? 1;
  QUARTER_NAMES.forEach((s, i) => {
    const shown = i === j % 4;
    out.parts[name + s] = { ...more, angle: shown ? a - j * step : 0, visible: shown ? vis : 0 };
  });
}
// Splats inside a turning body would draw over its turned surface, so a
// turning body is a hollow shell and its inside (for Slice) is this ball,
// its own part, which drive hides while the body turns.
function coreBall(k, { r = 0.97, oblate = 1, quat, share = 0.06, col }) {
  return k.cloud({ share, size: 1.6, pattern: false, part: k.part("core") }, (rand) => {
    const d = randDir(rand);
    const f = Math.cbrt(rand());
    const lp = [d[0] * r * f, d[1] * r * f * oblate, d[2] * r * f];
    return { p: quat ? quatRotate(quat, lp) : lp, color: col({ lp }), opacity: 0.9 };
  });
}

// ---- Glows ----------------------------------------------------------------------

// A halo of faint round splats around a sphere of radius r0, thinning out
// to r1. col(t) gives the colour at t = 0 (inner) .. 1 (outer).
function halo(
  k,
  {
    r0 = 1,
    r1 = 1.5,
    share = 0.08,
    size = 3,
    opacity = 0.2,
    col,
    falloff = 2.5,
    twinkle = 0,
    part,
    center = [0, 0, 0],
  },
) {
  return k.cloud({ share, size, pattern: false, part }, (rand) => {
    const t = Math.pow(rand(), falloff);
    const d = randDir(rand);
    const r = r0 + (r1 - r0) * t;
    return {
      p: add(center, mul(d, r)),
      color: col(t, d, rand),
      size: 0.6 + 0.8 * rand() + t * 0.8,
      opacity: opacity * (1 - 0.85 * t),
      kind: twinkle ? "twinkle" : undefined,
      params: twinkle ? [twinkle, rand() * TAU] : undefined,
      part,
    };
  });
}

// Glowing gas along a curve (prominences, loops): round translucent splats
// scattered about the path.
function glowPath(
  k,
  path,
  { share = 0.01, width = 0.03, size = 1.6, opacity = 0.4, col, twinkle = 0.4, part },
) {
  return k.cloud({ share, size, pattern: false, part }, (rand) => {
    const t = rand();
    const w = typeof width === "function" ? width(t) : width;
    const p = add(path(t), mul(randDir(rand), w * Math.sqrt(rand())));
    return {
      p,
      color: col(t, rand),
      size: 0.7 + 0.6 * rand(),
      opacity,
      kind: twinkle ? "twinkle" : undefined,
      params: twinkle ? [twinkle, rand() * TAU] : undefined,
      part,
    };
  });
}

// ---- Craters ----------------------------------------------------------------------

// A field of craters on the unit sphere, bucketed by latitude and
// longitude so a lookup only checks nearby craters. height(d) is the
// relief; look(d) gives the crater floor and bright ray amounts.
function craterField(
  rand,
  { count = 200, min = 0.02, max = 0.22, power = 2.2, depth = 0.22, rim = 0.07, rays = 0 },
) {
  const craters = [];
  for (let i = 0; i < count; i++) {
    const r = min + (max - min) * Math.pow(rand(), power);
    craters.push({
      d: randDir(rand),
      r,
      depth: depth * r * (0.7 + 0.6 * rand()),
      rim: rim * r * (0.7 + 0.6 * rand()),
      fresh: 0,
      seed: rand() * 100,
    });
  }
  // A few big young craters get bright ray systems.
  craters
    .slice()
    .sort((a, b) => b.r - a.r)
    .slice(3, 3 + rays)
    .forEach((c) => (c.fresh = 1));
  for (const c of craters) {
    // Cheap rejections before any acos: the relief reaches 1.8 radii,
    // floors 1 radius and rays 6.
    c.cosH = Math.cos(Math.min(Math.PI, c.r * 1.8));
    c.cosL = Math.cos(Math.min(Math.PI, c.r * (c.fresh ? 6 : 1)));
    if (c.fresh) [c.e1, c.e2] = basis(c.d);
  }
  const LAT = 24;
  const LON = 48;
  const relief = Array.from({ length: LAT * LON }, () => []);
  const marks = Array.from({ length: LAT * LON }, () => []);
  const cellOf = (d) => {
    const la = Math.min(LAT - 1, Math.floor((latOf(d) / Math.PI + 0.5) * LAT));
    const lo = Math.min(LON - 1, Math.floor((lonOf(d) / TAU + 0.5) * LON));
    return la * LON + lo;
  };
  for (let la = 0; la < LAT; la++) {
    for (let lo = 0; lo < LON; lo++) {
      const lat0 = (la / LAT - 0.5) * Math.PI;
      const lat1 = ((la + 1) / LAT - 0.5) * Math.PI;
      const centre = dirOf((lat0 + lat1) / 2, ((lo + 0.5) / LON - 0.5) * TAU);
      const cosLat = Math.cos(Math.min(Math.abs(lat0), Math.abs(lat1)));
      const half = Math.hypot(Math.PI / LAT, (TAU / LON) * cosLat) * 0.6;
      for (const c of craters) {
        const a = angle(centre, c.d);
        if (a < c.r * 1.8 + half) relief[la * LON + lo].push(c);
        if (a < c.r * (c.fresh ? 6 : 1) + half) marks[la * LON + lo].push(c);
      }
    }
  }
  const height = (d) => {
    let h = 0;
    for (const c of relief[cellOf(d)]) {
      const cd = dot(d, c.d);
      if (cd < c.cosH) continue;
      const x = Math.acos(Math.min(1, cd)) / c.r;
      if (x < 1) h += c.depth * (x * x - 1) + c.rim * smoothstep(0.55, 1, x);
      else h += c.rim * Math.exp(-(((x - 1) * 3.2) ** 2));
    }
    return h;
  };
  const look = (d, noise) => {
    let floor = 0;
    let ray = 0;
    for (const c of marks[cellOf(d)]) {
      const cd = dot(d, c.d);
      if (cd < c.cosL) continue;
      const x = Math.acos(Math.min(1, cd)) / c.r;
      if (x < 1) floor = Math.max(floor, 1 - x);
      if (c.fresh) {
        // Streaks radiating from the crater, fading with distance.
        const az = Math.atan2(dot(d, c.e2), dot(d, c.e1));
        const streak = noise(Math.cos(az) * 2.5 + c.seed, Math.sin(az) * 2.5, c.seed + x * 0.15);
        const fade = Math.exp(-Math.max(0, x - 1.3) * 0.55);
        ray = Math.max(ray, smoothstep(0.05, 0.3, streak) * fade, x < 1.35 ? 0.8 : 0);
      }
    }
    return { floor, ray };
  };
  return { height, look };
}

// A smooth function of direction, sampled once on a latitude-longitude grid
// and read back bilinearly: radial shapes evaluate their radius three times
// per splat, so low-frequency noise is much cheaper this way.
function tabulate(fn, W = 160, H = 80) {
  const t = new Float32Array((W + 1) * (H + 1));
  for (let j = 0; j <= H; j++)
    for (let i = 0; i <= W; i++)
      t[j * (W + 1) + i] = fn(dirOf((j / H - 0.5) * Math.PI, (i / W - 0.5) * TAU));
  return (d) => {
    const x = (lonOf(d) / TAU + 0.5) * W;
    const y = (latOf(d) / Math.PI + 0.5) * H;
    const i = Math.min(W - 1, Math.floor(x));
    const j = Math.min(H - 1, Math.floor(y));
    const fx = x - i;
    const fy = y - j;
    const a = t[j * (W + 1) + i];
    const b = t[j * (W + 1) + i + 1];
    const c = t[(j + 1) * (W + 1) + i];
    const e = t[(j + 1) * (W + 1) + i + 1];
    return (a + (b - a) * fx) * (1 - fy) + (c + (e - c) * fx) * fy;
  };
}

// Relief shading from the true normal against the smooth sphere's normal,
// so craters and hills read in a fixed light all around.
function relief(c, amount = 2, light = LIGHT) {
  const sn = unit(c.lp);
  return (dot(c.n, light) - dot(sn, light)) * amount;
}

// A rocky cratered body (the Moon, Mercury, asteroids).
function rockyBody(
  k,
  {
    craters,
    shapeR = () => 1,
    grid = 96,
    albedo,
    core = "#6b625a",
    interior = 0.1,
    reliefAmount = 1.6,
    litAmount = 0.3,
    part,
    pos,
    scale,
    weight,
    share,
    kind,
    params,
    turn,
    turnAngle = Math.PI,
    size,
  },
) {
  const radius = (d) => shapeR(d) * (1 + craters.height(d));
  const color = (c) => {
    const d = unit(c.lp);
    const base = albedo(c, d);
    const r = clamp(relief(c, reliefAmount), -0.55, 0.45);
    return lit(shade(base, 1 + r), c.n, litAmount);
  };
  const q = turn ? quatAxisAngle(turn, turnAngle) : null;
  return k.add(k.radial(radius, { grid }), {
    flat: 0.22,
    interior,
    core,
    part,
    kind,
    params,
    pos,
    scale,
    weight,
    share,
    size,
    quat: q || undefined,
    color: q ? turnedColor(color, quatAxisAngle(turn, -turnAngle), pos) : color,
  });
}

// ---- Globes -----------------------------------------------------------------------

// A planet body. col(c, d) gets the direction d in the planet's own frame
// (before the tilt), so bands and poles follow the planet's axis.
function globe(
  k,
  {
    r = 1,
    oblate = 1,
    quat,
    part,
    pos,
    col,
    core,
    interior = 0.12,
    flat = 0.3,
    kind,
    params,
    share,
    weight,
    size,
    turn,
    turnAngle = Math.PI,
  },
) {
  const shape = oblate === 1 ? k.sphere(r) : k.ellipsoid(r, r * oblate, r);
  const color = (c) => col(c, unit([c.lp[0], c.lp[1] / oblate, c.lp[2]]));
  const t = turn ? quatAxisAngle(turn, turnAngle) : null;
  const item = k.add(shape, {
    quat: t ? quatMul(t, quat || [0, 0, 0, 1]) : quat,
    pos,
    part,
    flat,
    interior,
    core,
    kind,
    params,
    share,
    weight,
    size,
    color: t ? turnedColor(color, quatAxisAngle(turn, -turnAngle), pos) : color,
  });
  // A fixed share (only used in toys with no weighted surfaces) gets a
  // splat size that covers it.
  if (share !== undefined) item.opts.size = coverSize(k, item.area, share);
  return item;
}

// A core in layers for Slice: stops from the centre out.
const layers =
  (stops, R = 1) =>
  (c) =>
    ramp(stops, clamp01(len(c.lp) / R));

// Colour bands by latitude: stops are [sinLat, colour] from south to north.
function bandAt(stops, y) {
  if (y <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (y <= stops[i][0]) {
      const t = (y - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return mix(stops[i - 1][1], stops[i][1], smoothstep(0, 1, t));
    }
  }
  return stops[stops.length - 1][1];
}

// Distance inside an oval spot at (lat, lon) with half sizes a (east-west)
// and b (north-south) in radians: 0 at the centre, 1 at the edge.
function ovalDist(d, lat0, lon0, a, b) {
  const lat = latOf(d);
  let lon = lonOf(d) - lon0;
  lon = ((((lon + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return Math.hypot((lon * Math.cos(lat0)) / a, (lat - lat0) / b);
}

// Flat rings in the XZ plane (turned by quat): each ring is [r0, r1,
// opacity, colour(r, c) -> colour or null for a gap, share]. Toys with no
// weighted surfaces get splats sized to cover each ring.
function rings(k, list, { quat, part, pos, flat = 0.12, size = 1, glint = 0 }) {
  for (const [r0, r1, opacity, col, share, own] of list) {
    const item = k.add(k.disc(r1, r0), {
      quat,
      pos,
      part: own ?? part,
      share,
      flat,
      opacity,
      kind: glint ? "glint" : undefined,
      params: glint ? [glint, 0] : undefined,
      pattern: false,
      color: (c) => col(Math.hypot(c.lp[0], c.lp[2]), c),
    });
    item.opts.size = coverSize(k, item.area / 2, share) * size;
  }
}

// Spin state for toys whose speed is a slider: the angle is integrated so
// moving the slider never makes the part jump.
const spins = new WeakMap();
function spinAngle(c, t, rate) {
  const s = spins.get(c) || { a: 0, t };
  s.a += (t - s.t) * rate;
  s.t = t;
  spins.set(c, s);
  return s.a;
}

// ---- Planet surfaces ---------------------------------------------------------------

// The Earth's sea level and land height (a continent turned to `facing`).
const EARTH_SEA = 0.07;
const earthHeight = (noise, d, facing = [0, 0, 0]) =>
  noise.fbm(d[0] * 1.3 + 3.1, d[1] * 1.3 - 1.7, d[2] * 1.3 + 0.5, 5) + 0.07 * dot(d, facing);

function earthSurface(noise, facing = [0, 0, 0]) {
  const SEA = EARTH_SEA;
  return (c, d) => {
    const h = earthHeight(noise, d, facing);
    const lat = Math.abs(d[1]);
    const ice = lat + 0.05 * noise(d[0] * 6, d[1] * 6, d[2] * 6);
    let col;
    if (h < SEA) {
      const depth = clamp01((SEA - h) / 0.3);
      col = mix("#2e9bd6", "#0c2f72", smoothstep(0, 0.5, depth));
      if (depth < 0.05) col = mix("#48c0e0", col, depth / 0.05);
      if (ice > 0.93) col = "#e9f2f8";
    } else {
      const up = h - SEA;
      const wet = noise.fbm(d[0] * 2.6 + 9, d[1] * 2.6, d[2] * 2.6, 3);
      const belt = smoothstep(0.18, 0.3, lat) * (1 - smoothstep(0.48, 0.6, lat));
      const dry = clamp01(belt * 1.6 - wet * 5 - 0.15) + clamp01(-wet * 4 - 0.6);
      col = mix("#2f7a31", "#7c9a44", smoothstep(-0.08, 0.1, -wet));
      col = mix(col, "#d9b877", clamp01(dry));
      col = mix(col, "#7d7a62", smoothstep(0.6, 0.72, lat));
      col = mix(col, "#8a6f52", smoothstep(0.08, 0.16, up) * 0.8);
      if (ice > 0.78 || up > 0.2) col = "#f4f7fa";
    }
    return pole(shade(col, 1 + 0.06 * noise(d[0] * 30, d[1] * 30, d[2] * 30)), d, 0.06);
  };
}

// The Earth's clouds at direction d: 0 where clear, else how thick (the
// raw value is at least 0.1 where there is cloud).
function earthCloudCover(noise, d) {
  const lat = Math.abs(d[1]);
  // Swirls: noise stretched east-west and folded by two warps.
  const w1 = noise.fbm(d[0] * 1.5 + 20, d[1] * 1.5, d[2] * 1.5, 3);
  const w2 = noise.fbm(d[0] * 1.5 + 40, d[1] * 1.5, d[2] * 1.5, 3);
  let v = noise.fbm(d[0] * 3 + w1 * 3, d[1] * 7 + w2 * 2, d[2] * 3 - w1 * 3, 5);
  // Cloudy along the equator and at high latitudes, clear in the subtropics.
  v += 0.06 * (1 - smoothstep(0.05, 0.18, lat));
  v -= 0.06 * smoothstep(0.18, 0.3, lat) * (1 - smoothstep(0.45, 0.6, lat));
  v += 0.04 * smoothstep(0.55, 0.75, lat);
  return v;
}

const JUPITER_BANDS = [
  [-1.0, "#8b8074"],
  [-0.8, "#a3917b"],
  [-0.64, "#c8b392"],
  [-0.55, "#ad8b6a"],
  [-0.47, "#e6d9c0"],
  [-0.4, "#b98c66"],
  [-0.3, "#f0e5cf"],
  [-0.22, "#a45e3a"],
  [-0.12, "#b9784f"],
  [-0.06, "#efdfc2"],
  [0.04, "#e6c9a0"],
  [0.1, "#f3e8d2"],
  [0.15, "#9a5634"],
  [0.25, "#a9694a"],
  [0.31, "#efe4cd"],
  [0.4, "#b48d68"],
  [0.48, "#e3d6bd"],
  [0.58, "#b09a7c"],
  [0.75, "#a39480"],
  [1.0, "#8a8075"],
];

function jupiterSurface(noise, { grs = true, lon0 = 0.3 } = {}) {
  return (c, d) => {
    const turb = noise.fbm(d[0] * 3, d[1] * 16, d[2] * 3, 4);
    const y = d[1] + 0.03 * turb + 0.008 * noise(d[0] * 24, d[1] * 40, d[2] * 24);
    let col = bandAt(JUPITER_BANDS, y);
    col = shade(col, 1 + 0.18 * noise(d[0] * 5, d[1] * 30, d[2] * 5));
    if (grs) {
      const g = ovalDist(d, -0.39, lon0, 0.17, 0.085);
      if (g < 1.45) {
        const swirl = noise(d[0] * 20, d[1] * 20, d[2] * 20);
        if (g < 1)
          col = mix(
            mix("#b8452c", "#d9754c", smoothstep(0.2, 1, g + swirl * 0.25)),
            col,
            smoothstep(0.85, 1, g),
          );
        else col = mix("#f6ead6", col, smoothstep(1.05, 1.45, g));
      }
      // A string of small white ovals in the south.
      for (let i = 0; i < 5; i++) {
        const o = ovalDist(d, -0.6, lon0 + 0.9 + i * 0.55, 0.05, 0.035);
        if (o < 1) col = mix("#faf3e6", col, smoothstep(0.5, 1, o));
      }
    }
    return col;
  };
}

const SATURN_BANDS = [
  [-1.0, "#8f8a74"],
  [-0.75, "#b3a27b"],
  [-0.5, "#cdb688"],
  [-0.3, "#e0c996"],
  [-0.12, "#d6bc88"],
  [0.0, "#efdfb2"],
  [0.1, "#e6d09e"],
  [0.25, "#d2b77f"],
  [0.4, "#e2cc98"],
  [0.6, "#c2ad80"],
  [0.8, "#9f9a7c"],
  [1.0, "#8c9186"],
];

function saturnSurface(noise) {
  return (c, d) => {
    const y = d[1] + 0.02 * noise.fbm(d[0] * 3, d[1] * 14, d[2] * 3, 3);
    return shade(bandAt(SATURN_BANDS, y), 1 + 0.08 * noise(d[0] * 4, d[1] * 26, d[2] * 4));
  };
}

// Saturn's rings in planet radii: C, B, Cassini division, A with the Encke
// gap, and the thin F ring. `parts` gives each ring its own part (C, B, A,
// F); `features` adds dark spokes to the B ring, clumps to the A ring and
// knots to the F ring, so the rings' turning shows. The features repeat
// every RING_PERIOD, so a ring can turn for ever by moving at most that far
// from where it was built (splats keep the draw order of their built pose).
function saturnRings(
  k,
  noise,
  { R = 1, quat, part, pos, shares = [0.05, 0.15, 0.09, 0.008], glint = 0, parts = [], features },
) {
  const fine = (r, f, a) => 1 + a * Math.sin(r * f) + a * 0.6 * noise(r * 60, 0.5, 0.5);
  const az = (c) => Math.atan2(c.lp[2], c.lp[0]);
  // Soft marks at a few angles in each period: w wide (radians).
  const P = RING_PERIOD;
  const marks = (a, list, w) => {
    let m = 0;
    for (const a0 of list) {
      const d = Math.abs(((((a - a0 + P / 2) % P) + P) % P) - P / 2);
      m = Math.max(m, Math.exp(-((d / w) ** 2)));
    }
    return m;
  };
  rings(
    k,
    [
      [
        1.24 * R,
        1.52 * R,
        0.4,
        (r) => shade("#8e7f69", fine(r / R, 90, 0.08)),
        shares[0],
        parts[0],
      ],
      [
        1.52 * R,
        1.95 * R,
        0.95,
        (r, c) => {
          const x = (r / R - 1.52) / 0.43;
          let col = shade(
            mix("#d8c396", "#efe0b8", smoothstep(0.1, 0.6, x)),
            fine(r / R, 140, 0.07),
          );
          if (features) {
            const spoke = marks(az(c) + 0.35 * x, [0.2], 0.06);
            col = shade(col, 1 - 0.3 * spoke * Math.sin(Math.PI * clamp01(x * 1.1)));
          }
          return col;
        },
        shares[1],
        parts[1],
      ],
      [
        2.03 * R,
        2.27 * R,
        0.85,
        (r, c) => {
          const x = r / R;
          if (Math.abs(x - 2.215) < 0.008) return null;
          let col = shade("#cdb994", fine(x, 120, 0.06));
          if (features) col = mix(col, "#fff4d8", 0.4 * marks(az(c), [0.55], 0.09));
          return col;
        },
        shares[2],
        parts[2],
      ],
      [
        2.315 * R,
        2.335 * R,
        0.6,
        (r, c) =>
          features ? shade("#e6d8b8", 0.7 + 0.6 * marks(az(c), [0.1, 0.5], 0.1)) : "#e6d8b8",
        shares[3],
        parts[3],
      ],
    ],
    { quat, part, pos, glint },
  );
}

// A band of a globe between y0 and y1 (sines of latitude), for planets
// whose bands move separately. col(c, d) as in globe().
function bandShell(
  k,
  { y0, y1, oblate = 1, quat, part, col, kind, params, grid = 48, turn, weight, size },
) {
  const la0 = Math.asin(clamp(y0, -1, 1));
  const la1 = Math.asin(clamp(y1, -1, 1));
  const shape = k.param(
    (u, v) => {
      const lat = la0 + (la1 - la0) * v;
      const lon = u * TAU;
      return [Math.cos(lat) * Math.sin(lon), Math.sin(lat) * oblate, Math.cos(lat) * Math.cos(lon)];
    },
    { grid, normal: (u, v, p) => [p[0], p[1] / (oblate * oblate), p[2]], thick: 0.9 },
  );
  const color = (c) => col(c, unit([c.lp[0], c.lp[1] / oblate, c.lp[2]]));
  const t = turn ? halfTurn(turn) : null;
  return k.add(shape, {
    quat: t ? quatMul(t, quat || [0, 0, 0, 1]) : quat,
    part,
    flat: 0.3,
    kind,
    params,
    weight,
    size,
    color: t ? turnedColor(color, t) : color,
  });
}

// ---- Palettes -------------------------------------------------------------------------

const NEBULA_PALETTES = {
  emission: { core: "#3fd6c6", mid: "#e8489c", edge: "#ff9a45", deep: "#7a2f8f", rim: "#ffc27a" },
  hubble: { core: "#3aa8b4", mid: "#f2b441", edge: "#c8702a", deep: "#2a5a9a", rim: "#ffe0a0" },
  crimson: { core: "#ff9ab8", mid: "#ff3b5a", edge: "#ff8a3a", deep: "#8a2a7a", rim: "#ffd0a0" },
  ice: { core: "#8ff0ff", mid: "#5a8cff", edge: "#b06aff", deep: "#2a3a8a", rim: "#e0f0ff" },
};

const STAR_TYPES = {
  red: {
    surface: ["#9a1e08", "#e8401a", "#ff7a3a", "#ffb070"],
    glow: ["#ff8a50", "#ff3a14"],
    halo: 1.6,
    inner: 1.25,
    freq: 7,
    spots: 5,
    flares: true,
    spikes: 0,
  },
  yellow: {
    surface: ["#f07a10", "#ffb42a", "#ffe066", "#fffbe0"],
    glow: ["#fff0a0", "#ffa628"],
    halo: 1.75,
    inner: 1.3,
    freq: 12,
    spots: 0,
    spikes: 2.3,
  },
  blue: {
    surface: ["#3a64e0", "#7aa6ff", "#c4dcff", "#ffffff"],
    glow: ["#d0e2ff", "#3a6aff"],
    halo: 1.8,
    inner: 1.35,
    freq: 5,
    spots: 0,
    spikes: 2.4,
  },
  white: {
    surface: ["#9ab8ff", "#d4e2ff", "#f4f8ff", "#ffffff"],
    glow: ["#c4d8ff", "#4a78ff"],
    halo: 3.2,
    inner: 1.5,
    faint: true,
    freq: 20,
    spots: 0,
    spikes: 3.8,
  },
};

// The solar system as an orrery: orbit radius, planet size, angular speed
// (radians per second) and starting angle.
const ORRERY = [
  { id: "mercury", r: 0.35, size: 0.04, w: 0.42, phase: 0.6, share: 0.012, swell: 0 },
  { id: "venus", r: 0.48, size: 0.06, w: 0.31, phase: 2.5, share: 0.02, swell: 0.08 },
  { id: "earth", r: 0.62, size: 0.064, w: 0.25, phase: 4.2, share: 0.024, swell: 0.08 },
  { id: "mars", r: 0.76, size: 0.05, w: 0.2, phase: 5.6, share: 0.016, swell: 0.08 },
  { id: "jupiter", r: 1.04, size: 0.12, w: 0.11, phase: 0.9, share: 0.06, swell: 0 },
  { id: "saturn", r: 1.31, size: 0.09, w: 0.08, phase: 3.3, share: 0.045, swell: 0 },
  { id: "uranus", r: 1.54, size: 0.07, w: 0.058, phase: 5.9, share: 0.028, swell: 0 },
  { id: "neptune", r: 1.72, size: 0.068, w: 0.046, phase: 2.2, share: 0.028, swell: 0 },
];

// The Sun's prominences (angle round the limb, half span, height, tilt
// towards the viewer) and its flare, on the upper right limb.
const SUN_LOOPS = [
  { a: 0.55, span: 0.2, h: 0.3 },
  { a: 2.35, span: 0.14, h: 0.24 },
  { a: 3.7, span: 0.24, h: 0.34 },
  { a: 5.35, span: 0.11, h: 0.2 },
  { a: 1.5, span: 0.16, h: 0.26, lift: -0.45 },
  { a: 4.5, span: 0.18, h: 0.26, lift: 0.4 },
];
const SUN_FLARE = (() => {
  const cam = camDir();
  const mid = limbDir(1.95, cam, 0.1);
  return { mid, along: unit(cross(mid, cam)), span: 0.2, h: 0.34 };
})();

// ---- The Moon landing ----------------------------------------------------------------

// The landing site: near the top of the face we see, tipped towards us, so
// the lander, the astronaut and the flag stand up against the sky. R runs
// to the viewer's right, U up from the ground and F towards the viewer.
// Everything in the scene is built lower down inside the Moon (by `sink`,
// straight down the screen, so every splat keeps its depth and draws in
// the right order) and shown moved up into place: built in place, the
// lander would stand out of the Moon and the Moon would be framed smaller.
const LANDING = (() => {
  const f = camFrame();
  const U = unit(add(mul(f.up, 0.93), mul(f.c, 0.36)));
  const R = f.right;
  return { U, R, F: unit(cross(R, U)), sink: mul(f.up, -0.43) };
})();
// Where things stand, as [along R, along F] from the site (toy units: the
// Moon's radius is 1), and how big they are.
const LANDER_AT = [-0.08, 0];
const LANDER_G = 1.25; // the lander's scale: it stands 0.31 tall
const PAD_OUT = 0.22; // the footpads, out from the lander's centre
const PAD_TOP = 0.014 * LANDER_G; // the top of a footpad
const TAKE_AT = [0.1, 0.13]; // where the astronaut takes the flag off the leg
const PLANT_AT = [0.245, 0.07]; // where the astronaut stands to plant it
const FLAG_AT = [0.2, 0.05];
const ASTRO_AT = [0.145, 0.12]; // where the astronaut stands at the end, left of the pole
const ASTRO_H = 0.11;
const POLE_H = 0.2;
const CLOTH_H = 0.075;
// The cloth is built in strips (parts), shown one by one as it unrolls.
const CLOTH_STRIPS = 6;
// The landing and the leaving each take this long (the control's ease).
const MOON_SECS = 10;
// The flag the astronaut plants (a toy option) and its picture.
const MOON_FLAG = { code: "us", img: null };
// Each flag's shape (width / height), so the flag is built at its real
// proportions before its picture loads. Read once, when the pack loads.
const FLAG_ASPECTS = await (async () => {
  try {
    const r = await fetch(new URL("../../assets/flags/flags.json", import.meta.url));
    const j = await r.json();
    return Object.fromEntries(j.flags.map((f) => [f.code, f.aspect || 1.5]));
  } catch {
    return {};
  }
})();

// A frame on the Moon's surface at [x along R, z along F] from the site:
// its ground point, up (n), right (r) and forward (f), and the rotation
// that takes the site's frame there. `ground(d)` is the Moon's radius.
function moonSpot(ground, [x, z]) {
  const { U, R, F } = LANDING;
  const n = unit(add(add(U, mul(R, x)), mul(F, z)));
  const q = quatFromTo(U, n);
  return { base: mul(n, ground(n)), n, r: quatRotate(q, R), f: quatRotate(q, F), q };
}
// A point in a spot's frame: x to the right, y up, z towards the viewer.
const spotAt = (s, [x, y, z]) => add(s.base, add(add(mul(s.r, x), mul(s.n, y)), mul(s.f, z)));
// The rotation that turns a shape's own axes (x, y, z) to a spot's (r, n, f).
function spotQuat(s) {
  const { U, R } = LANDING;
  const q1 = quatFromTo([0, 1, 0], U);
  const x1 = quatRotate(q1, [1, 0, 0]);
  const phi = Math.atan2(dot(cross(x1, R), U), dot(x1, R));
  return quatMul(s.q, quatMul(quatAxisAngle(U, phi), q1));
}
// Rigid moves of the scene as shown, p -> Q p + T.
const MOVE_ID = { Q: [0, 0, 0, 1], T: [0, 0, 0] };
const moveBy = (v) => ({ Q: [0, 0, 0, 1], T: v });
const turnAbout = (c, q) => ({ Q: q, T: sub(c, quatRotate(q, c)) });
const thenMove = (a, b) => ({ Q: quatMul(a.Q, b.Q), T: add(quatRotate(a.Q, b.T), a.T) });
const applyMove = (m, p) => add(quatRotate(m.Q, p), m.T);
// Sets a part to a move of the scene as shown. Its splats are built `sink`
// lower and `pivot` is the part's pivot as built.
function moonPart(out, name, pivot, m, visible = 1) {
  // A built splat p + sink must end up at Q p + T.
  const Tb = sub(m.T, quatRotate(m.Q, LANDING.sink));
  out.parts[name] = { quat: m.Q, offset: add(sub(Tb, pivot), quatRotate(m.Q, pivot)), visible };
}
// A hop: height at u (0..1) along a path of n low-gravity bounds.
const hops = (u, n, h) => h * Math.abs(Math.sin(Math.PI * n * clamp01(u)));
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const lerp3 = (a, b, t) => add(a, mul(sub(b, a), t));

// The picture on the flag: the chosen flag's image, drawn to fill the cloth
// (which is built at the flag's own shape). Until it loads the cloth is
// plain white.
const MOON_SCREEN = {
  width: 300,
  height: 200,
  reset() {},
  version() {
    const f = MOON_FLAG;
    if (typeof Image !== "undefined" && f.img?.code !== f.code) {
      const img = new Image();
      img.code = f.code;
      img.decoding = "async";
      img.src = new URL(`../../assets/flags/${f.code}.svg`, import.meta.url).href;
      f.img = img;
    }
    return `${f.code}:${f.img?.complete && f.img.naturalWidth ? 1 : 0}`;
  },
  draw(g) {
    const { width: w, height: h } = g.canvas;
    const img = MOON_FLAG.img;
    g.fillStyle = "#f2f2ee";
    g.fillRect(0, 0, w, h);
    if (img?.complete && img.naturalWidth) {
      g.fillStyle = "#1c1c1e";
      g.fillRect(0, 0, w, h);
      g.drawImage(img, 0, 0, w, h);
    }
  },
};

// The landing, s seconds in: the lander comes down slowing (from the left,
// leaning back against its motion), stirs up a sheet of dust that flies
// straight out (no air to hold it up) and sets down; an astronaut climbs
// down the ladder, takes the flag off the leg, bounds over in low-gravity
// hops, plants it, unrolls it along its crossbar (it swings a little and
// keeps swinging a while: no air to stop it), stands beside it and waves.
function landingPose(s) {
  const PAD = [LANDER_AT[0], LANDER_AT[1] + PAD_OUT];
  const d = (1 - band(s, 0, 3.4)) ** 2;
  const on = s > 0 ? 1 : 0;
  const walk = [
    [5.6, 6.0, PAD, TAKE_AT, 1],
    [6.15, 7.3, TAKE_AT, PLANT_AT, 3],
    [8.4, 8.85, PLANT_AT, ASTRO_AT, 1],
  ];
  const wave = ease(band(s, 8.95, 9.15)) * (1 - ease(band(s, 9.75, 9.98)));
  const swing = s > 8.6 ? 0.1 * Math.exp(-(s - 8.6) * 2.2) * Math.sin((s - 8.6) * 10) : 0;
  return {
    lander: {
      h: 1.25 * d - 0.006 * bump(s, 3.4, 3.48, 3.55, 3.9),
      x: -0.32 * d,
      tilt: 0.45 * d,
      visible: on,
    },
    plume: on && s < 3.45 ? 1 : 0,
    dust: { t: band(s, 3.1, 4.3), visible: bump(s, 3.1, 3.3, 3.8, 4.3) },
    climb: { t: ease(band(s, 4.2, 5.4)), visible: s < 5.5 ? smoothstep(4.05, 4.25, s) : 0 },
    astro: { ...walkAt(s, PAD, walk), visible: s >= 5.5 ? 1 : 0 },
    flag: flagAt(s, [
      [5.85, 6.1, "stowed", "hand"],
      [7.35, 7.7, "hand", "above"],
      [7.7, 7.9, "above", "planted"],
    ]),
    unroll: ease(band(s, 7.9, 8.6)),
    swing,
    arm: wave * (2.5 + 0.35 * Math.sin(s * 11)),
  };
}

// The leaving, s seconds in: the astronaut bounds back to the flag, folds
// it back up, pulls it up, carries it to the lander and stows it on the leg, climbs
// the ladder and goes in; the engine fires, the dust flies and the lander
// lifts off, faster and faster, and is gone.
function leavingPose(s) {
  const PAD = [LANDER_AT[0], LANDER_AT[1] + PAD_OUT];
  const u = band(s, 5.8, 10);
  const walk = [
    [0, 0.8, ASTRO_AT, PLANT_AT, 1],
    [1.95, 3.3, PLANT_AT, TAKE_AT, 3],
    [3.75, 4.05, TAKE_AT, PAD, 1],
  ];
  return {
    lander: { h: 1.9 * u * u, x: 0, tilt: 0, visible: 1 },
    plume: s > 5.6 ? 1 : 0,
    dust: { t: band(s, 5.5, 6.8), visible: bump(s, 5.5, 5.7, 6.2, 6.8) },
    climb: {
      t: 1 - ease(band(s, 4.1, 5.2)),
      visible: s >= 4.05 ? 1 - smoothstep(5.2, 5.4, s) : 0,
    },
    astro: { ...walkAt(s, ASTRO_AT, walk), visible: s < 4.05 ? 1 : 0 },
    flag: flagAt(s, [
      [1.4, 1.65, "planted", "above"],
      [1.65, 1.95, "above", "hand"],
      [3.3, 3.7, "hand", "stowed"],
    ]),
    unroll: 1 - ease(band(s, 0.9, 1.4)),
    swing: 0,
    arm: 0,
  };
}

// Where the astronaut is at s along a list of bounds [s0, s1, from, to,
// hops]: [x, z] on the ground and how high its feet are.
function walkAt(s, start, legs) {
  let xz = start;
  let y = 0;
  for (const [s0, s1, from, to, n] of legs) {
    if (s < s0) break;
    const e = band(s, s0, s1);
    xz = lerp2(from, to, ease(e));
    y = s < s1 ? hops(e, n, 0.022) : 0;
  }
  // On the lander's front footpad it stands on the pad.
  const PAD = [LANDER_AT[0], LANDER_AT[1] + PAD_OUT];
  const near = 1 - smoothstep(0.02, 0.06, Math.hypot(xz[0] - PAD[0], xz[1] - PAD[1]));
  return { xz, y: y + PAD_TOP * near };
}

// The flag's place at s: [s0, s1, from, to] moves between named places.
function flagAt(s, moves) {
  let place = { from: moves[0][2], to: moves[0][2], t: 0 };
  for (const [s0, s1, from, to] of moves) {
    if (s < s0) break;
    place = { from, to, t: ease(band(s, s0, s1)) };
  }
  return place;
}

// Sets every part of the landing scene for a pose. `ground(d)` is the
// Moon's radius; the pivots are the ones the build used.
function moonScene(out, ground, pose) {
  const G = LANDER_G;
  const H = ASTRO_H;
  const { U, R, sink } = LANDING;
  const B = (p) => add(p, sink);
  const L = moonSpot(ground, LANDER_AT);
  const on = pose.lander.visible;
  const lander = thenMove(
    moveBy(add(mul(U, pose.lander.h), mul(R, pose.lander.x))),
    turnAbout(L.base, quatAxisAngle(L.f, pose.lander.tilt)),
  );
  moonPart(out, "lander", B(L.base), lander, on);
  moonPart(out, "plume", B(L.base), lander, on * pose.plume);
  out.parts.dust = {
    scale: 0.5 + 1.8 * pose.dust.t,
    offset: mul(sink, -1),
    visible: on * pose.dust.visible,
  };
  // The astronaut, built where it stands at the end (facing us), and a
  // copy built on the ladder's foot (facing the ladder) for the climb.
  const A0 = moonSpot(ground, ASTRO_AT);
  const here = moonSpot(ground, pose.astro.xz);
  const feet = spotAt(here, [0, pose.astro.y, 0]);
  const tilt = quatFromTo(A0.n, here.n);
  const astro = { Q: tilt, T: sub(feet, quatRotate(tilt, A0.base)) };
  moonPart(out, "astro", B(A0.base), astro, on * pose.astro.visible);
  const shoulder = spotAt(A0, [-0.26 * H, 0.73 * H, 0]);
  const arm = thenMove(astro, turnAbout(shoulder, quatAxisAngle(A0.f, -pose.arm)));
  moonPart(out, "arm", B(shoulder), arm, on * pose.astro.visible);
  const [porch, rungTop, foot] = ladderPath(ground);
  const t = pose.climb.t;
  let at = t < 0.15 ? lerp3(porch, rungTop, t / 0.15) : lerp3(rungTop, foot, (t - 0.15) / 0.85);
  if (t > 0.15 && t < 0.97) at = add(at, mul(L.n, 0.004 * Math.abs(Math.sin(Math.PI * 7 * t))));
  moonPart(out, "climber", B(foot), moveBy(sub(at, foot)), on * pose.climb.visible);
  // The flag: stowed on the right leg, in the astronaut's hand, held above
  // its spot or planted.
  const F0 = moonSpot(ground, FLAG_AT);
  const pad = moonSpot(ground, [LANDER_AT[0] + PAD_OUT, LANDER_AT[1]]);
  const poleDir = (a) => quatRotate(quatAxisAngle(F0.f, a), F0.n);
  const hand = add(
    feet,
    add(mul(here.r, -0.3 * H), add(mul(here.n, 0.36 * H), mul(here.f, 0.14 * H))),
  );
  const places = {
    stowed: {
      base: applyMove(lander, spotAt(pad, [-0.022, PAD_TOP + 0.004, 0.03])),
      tilt: 0.42 + pose.lander.tilt,
    },
    hand: { base: sub(hand, mul(poleDir(-0.28), 0.05)), tilt: -0.28 },
    above: { base: add(F0.base, mul(F0.n, 0.035)), tilt: 0 },
    planted: { base: add(F0.base, mul(F0.n, -0.012)), tilt: 0 },
  };
  const a = places[pose.flag.from];
  const b = places[pose.flag.to];
  const base = lerp3(a.base, b.base, pose.flag.t);
  const lean = a.tilt + (b.tilt - a.tilt) * pose.flag.t;
  const pole = thenMove(moveBy(sub(base, F0.base)), turnAbout(F0.base, quatAxisAngle(F0.f, lean)));
  moonPart(out, "pole", B(F0.base), pole, on);
  // The cloth, in strips shown as it unrolls from the pole along the
  // crossbar, and the roll of cloth, which travels out along the crossbar
  // and thins as it unrolls.
  const cloth = thenMove(pole, turnAbout(F0.base, quatAxisAngle(F0.n, pose.swing)));
  const W = CLOTH_H * flagShape(MOON_FLAG.code);
  for (let i = 0; i < CLOTH_STRIPS; i++) {
    const shown = clamp01(pose.unroll * CLOTH_STRIPS - i);
    moonPart(out, `cloth${i}`, B(F0.base), cloth, on * shown);
  }
  const roll = thenMove(cloth, moveBy(mul(F0.r, W * pose.unroll)));
  moonPart(out, "roll", B(F0.base), roll, on * (pose.unroll < 0.98 ? 1 - 0.55 * pose.unroll : 0));
}
// A flag's width / height, kept within what the crossbar can carry.
const flagShape = (code) => Math.min(2.6, Math.max(0.8, FLAG_ASPECTS[code] || 1.5));

// The climb: from the porch by the hatch, to the top of the ladder on the
// front leg, down to the footpad (feet just in front of the rungs).
function ladderPath(ground) {
  const G = LANDER_G;
  const L = moonSpot(ground, LANDER_AT);
  const pad = moonSpot(ground, [LANDER_AT[0], LANDER_AT[1] + PAD_OUT]);
  return [
    spotAt(L, [0, 0.142 * G, 0.086 * G]),
    spotAt(L, [0, 0.128 * G, 0.106 * G]),
    spotAt(pad, [0, PAD_TOP, 0]),
  ];
}

// Builds the landing scene (all hidden until a tap): the lander, its engine
// glow and dust, the astronaut (twice: at the end and on the ladder) and
// the flag, all SINK lower than where they are shown.
function buildLanding(k, ground, code) {
  const G = LANDER_G;
  const H = ASTRO_H;
  const B = (p) => add(p, LANDING.sink);
  const L = moonSpot(ground, LANDER_AT);
  const QL = spotQuat(L);
  const Lw = (x, y, z) => spotAt(L, [x * G, y * G, z * G]);
  const lander = k.part("lander", { pivot: B(L.base) });
  // (Denser than the Moon, but not much smaller: the renderer drops splats
  // that come out under a couple of pixels, and on a small screen the whole
  // lander would vanish.)
  const fine = { weight: 3, size: 0.9, pattern: false, flat: 0.25 };
  const metal = (hex) => (c) => lit(hex, c.n, 0.6);
  // Gold foil, crinkled.
  const foil = (c) =>
    lit(
      mix(
        "#80571a",
        "#f3cf68",
        smoothstep(-0.3, 0.35, c.noise(c.p[0] * 90, c.p[1] * 90, c.p[2] * 90)),
      ),
      c.n,
      0.6,
    );
  const strut = (a, b, r, color, part = lander) =>
    k.add(k.cylinder(r, len(sub(b, a)), { caps: false }), {
      ...fine,
      pos: B(lerp3(a, b, 0.5)),
      quat: quatFromTo([0, 1, 0], unit(sub(b, a))),
      part,
      color: typeof color === "function" ? color : metal(color),
    });
  const box = (sx, sy, sz, at, color) =>
    k.add(k.box(sx * G, sy * G, sz * G), { ...fine, pos: B(Lw(...at)), quat: QL, part: lander, color }); // prettier-ignore

  // The descent stage (black underneath) and its engine bell.
  box(0.15, 0.065, 0.15, [0, 0.105, 0], (c) => (c.ln[1] < -0.5 ? "#2a2723" : foil(c)));
  k.add(k.cone(0.026 * G, 0.012 * G, 0.035 * G), {
    ...fine,
    pos: B(Lw(0, 0.055, 0)),
    quat: QL,
    part: lander,
    color: metal("#56585d"),
  });
  // The ascent stage: grey panels, two slanted windows and the hatch.
  box(0.105, 0.08, 0.095, [0, 0.1775, 0], (c) => {
    const x = c.lp[0] / (0.0525 * G);
    const y = c.lp[1] / (0.04 * G);
    const ax = Math.abs(x);
    if (c.ln[2] > 0.5) {
      if (ax > 0.14 && ax < 0.72 && y > 0.08 && y < 0.78 - 0.8 * (ax - 0.14))
        return lit(ax + y > 0.9 ? "#3b4a63" : "#121822", c.n, 0.4);
      if (ax < 0.3 && y < -0.2 && y > -0.9)
        return lit(ax > 0.24 || y > -0.27 || y < -0.83 ? "#6f7278" : "#aeb1b6", c.n, 0.6);
    }
    const seam = Math.abs(((x * 2 + 5) % 1) - 0.5) > 0.47 || Math.abs(((y * 1.5 + 5) % 1) - 0.5) > 0.47; // prettier-ignore
    return lit(seam ? "#a7aab0" : "#c9ccd1", c.n, 0.6);
  });
  // The docking tunnel on top, the antenna mast and its dish.
  k.add(k.cylinder(0.019 * G, 0.016 * G), {
    ...fine,
    pos: B(Lw(0, 0.2255, 0)),
    quat: QL,
    part: lander,
    color: metal("#b7bac0"),
  });
  strut(Lw(0.034, 0.215, -0.028), Lw(0.034, 0.25, -0.028), 0.0022 * G, "#d9d9d9");
  k.add(k.cone(0.023 * G, 0.004 * G, 0.007 * G), {
    ...fine,
    pos: B(Lw(0.034, 0.254, -0.028)),
    quat: quatMul(quatAxisAngle(L.r, 0.55), QL),
    part: lander,
    color: metal("#eeeeee"),
  });
  // The porch in front of the hatch.
  box(0.034, 0.004, 0.03, [0, 0.1395, 0.088], metal("#b9bcc1"));
  // Four legs, each a main and a side strut, standing on round footpads.
  for (const [dx, dz] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ]) {
    const pad = moonSpot(ground, [LANDER_AT[0] + dx * PAD_OUT, LANDER_AT[1] + dz * PAD_OUT]);
    const foot = spotAt(pad, [0, PAD_TOP, 0]);
    const top = Lw(0.075 * dx, 0.128, 0.075 * dz);
    strut(top, foot, 0.005 * G, foil);
    strut(Lw(0.075 * dx, 0.078, 0.075 * dz), lerp3(top, foot, 0.62), 0.0035 * G, "#b3b6bb");
    k.add(k.cylinder(0.027 * G, 0.008 * G), {
      ...fine,
      pos: B(spotAt(pad, [0, 0.006 * G, 0])),
      quat: spotQuat(pad),
      part: lander,
      color: foil,
    });
  }
  // The ladder on the front leg.
  const [, rungTop, foot] = ladderPath(ground);
  const ladderBottom = add(foot, mul(L.n, 0.02 * G));
  const side = mul(L.r, 0.012 * G);
  for (const s of [-1, 1])
    strut(add(rungTop, mul(side, s)), add(ladderBottom, mul(side, s)), 0.0017 * G, "#d4d6da");
  for (let i = 1; i <= 6; i++) {
    const p = lerp3(rungTop, ladderBottom, i / 7);
    strut(sub(p, side), add(p, side), 0.0014 * G, "#d4d6da");
  }

  // The engine's glow under the lander as it comes down or lifts off: a
  // pale, flickering cone (a real one is nearly invisible in vacuum).
  const exit = Lw(0, 0.036, 0);
  k.cloud(
    { share: 0.006, size: 1.4, pattern: false, part: k.part("plume", { pivot: B(L.base) }) },
    (rand) => {
      // prettier-ignore
      const t = Math.pow(rand(), 0.8);
      const a = rand() * TAU;
      const r = (0.012 + 0.05 * t) * Math.sqrt(rand());
      const p = add(add(exit, mul(L.n, -0.15 * t)), add(mul(L.r, r * Math.cos(a)), mul(L.f, r * Math.sin(a)))); // prettier-ignore
      return {
        p: B(p),
        color: mix("#fff5d8", "#ffa04a", t),
        opacity: 0.32 * (1 - t) + 0.03,
        kind: "twinkle",
        params: [0.6, rand() * TAU],
      };
    },
  );
  // The dust: a thin sheet low over the ground that flies straight out.
  k.cloud(
    { share: 0.01, size: 1.1, pattern: false, part: k.part("dust", { pivot: B(L.base) }) },
    (rand) => {
      // prettier-ignore
      const a = rand() * TAU;
      const r = 0.07 + 0.11 * Math.sqrt(rand());
      return {
        p: B(spotAt(L, [r * Math.cos(a), 0.004 + 0.012 * rand() * rand(), r * Math.sin(a)])),
        n: L.n,
        flat: 0.6,
        color: mix("#8c877e", "#b5afa4", rand()),
        opacity: 0.4,
      };
    },
  );

  // The astronaut: facing us where it stands at the end (its right arm,
  // on our left, is its own part to wave), and facing the ladder at its
  // foot for the climb.
  const astro = k.part("astro", { pivot: B(moonSpot(ground, ASTRO_AT).base) });
  const A0 = moonSpot(ground, ASTRO_AT);
  const arm = k.part("arm", { pivot: B(spotAt(A0, [-0.26 * H, 0.73 * H, 0])) });
  astronaut(k, A0, 1, astro, arm, B);
  const climber = k.part("climber", { pivot: B(foot) });
  const onPad = moonSpot(ground, [LANDER_AT[0], LANDER_AT[1] + PAD_OUT]);
  astronaut(k, { ...onPad, base: foot }, -1, climber, climber, B);

  // The flag: a pole, a crossbar along its top and the cloth hanging from
  // it (with the wrinkles it keeps from being folded), coloured from the
  // chosen flag's picture (behaviour "screen").
  MOON_FLAG.code = code;
  const W = CLOTH_H * flagShape(code);
  const F0 = moonSpot(ground, FLAG_AT);
  const pole = k.part("pole", { pivot: B(F0.base) });
  const top = spotAt(F0, [0, POLE_H, 0]);
  strut(F0.base, top, 0.0032, "#dcdee2", pole);
  k.add(k.sphere(0.005), { ...fine, pos: B(top), part: pole, color: metal("#e8e8e8") });
  strut(spotAt(F0, [0, POLE_H - 0.004, 0]), spotAt(F0, [W + 0.006, POLE_H - 0.004, 0]), 0.0024, "#dcdee2", pole); // prettier-ignore
  const sheet = { share: 0.02 / CLOTH_STRIPS, size: 0.6, flat: 0.1, even: true, pattern: false, kind: "screen", color: "#ffffff" }; // prettier-ignore
  for (let i = 0; i < CLOTH_STRIPS; i++) {
    const u0 = i / CLOTH_STRIPS;
    const strip = k.param(
      (u, v) => {
        const x = u0 + u / CLOTH_STRIPS;
        return B(
          spotAt(F0, [
            0.006 + x * W,
            POLE_H - 0.008 - v * CLOTH_H,
            0.003 + 0.0035 * Math.sin(x * 13 + v * 2) * (0.35 + 0.65 * x),
          ]),
        );
      },
      { grid: 24, thick: 0.02 },
    );
    const part = k.part(`cloth${i}`, { pivot: B(F0.base) });
    k.add(strip, { ...sheet, part, params: (c) => [u0 + c.u / CLOTH_STRIPS, c.v] });
  }
  // The rolled-up cloth: a fat sleeve at the hoist, showing the fly end's
  // colours.
  k.add(k.cylinder(0.0065, CLOTH_H, { caps: true }), {
    ...fine,
    pos: B(spotAt(F0, [0.006, POLE_H - 0.008 - CLOTH_H / 2, 0])),
    quat: spotQuat(F0),
    part: k.part("roll", { pivot: B(F0.base) }),
    kind: "screen",
    params: (c) => [0.9, clamp01(0.5 - c.lp[1] / CLOTH_H)],
  });
}

// An astronaut in a white suit, gold visor and backpack, standing at spot
// s facing us (facing 1) or away (-1). `arm` is the part for the arm on
// our left.
function astronaut(k, s, facing, part, arm, B) {
  const H = ASTRO_H;
  const q = facing > 0 ? spotQuat(s) : quatMul(quatAxisAngle(s.n, Math.PI), spotQuat(s));
  const P = (x, y, z) => spotAt(s, [facing * x * H, y * H, facing * z * H]);
  const suit = (c) => lit("#eeede8", c.n, 0.55);
  const put = (shape, at, color, p = part) =>
    k.add(shape, { weight: 4, size: 0.8, pattern: false, flat: 0.3, part: p, pos: B(P(...at)), quat: q, color }); // prettier-ignore
  for (const x of [-0.1, 0.1]) {
    put(k.box(0.14 * H, 0.08 * H, 0.2 * H), [x, 0.04, 0.02], (c) => lit("#8e9095", c.n, 0.5));
    put(k.cylinder(0.07 * H, 0.36 * H), [x, 0.26, 0], suit);
  }
  put(k.roundedBox(0.42 * H, 0.34 * H, 0.26 * H, 4), [0, 0.6, 0], suit);
  put(k.box(0.2 * H, 0.1 * H, 0.06 * H), [0, 0.63, 0.15], (c) => lit("#9ea2a8", c.n, 0.5));
  put(k.roundedBox(0.38 * H, 0.42 * H, 0.16 * H, 6), [0, 0.62, -0.2], suit);
  put(k.sphere(0.145 * H), [0, 0.88, 0.01], (c) =>
    c.ln[2] > 0.3 && c.ln[1] > -0.5 && c.ln[1] < 0.72
      ? lit(c.ln[1] > 0.35 && c.ln[0] < 0 ? "#fff0bc" : "#c3942f", c.n, 0.5)
      : suit(c),
  );
  for (const x of [-1, 1]) {
    const p = x * facing < 0 ? arm : part;
    put(k.cylinder(0.06 * H, 0.36 * H), [x * 0.26, 0.55, 0], suit, p);
    put(k.sphere(0.065 * H), [x * 0.26, 0.36, 0], (c) => lit("#cfd0cc", c.n, 0.5), p);
  }
}

// The Earth's tilt, the Sun's direction during its day (off to the left,
// so the right half is night) and how many wedges its city lights are in.
const EARTH_TILT = quatEuler(0, 0, -23.4);
const EARTH_SUN = unit([-0.9, 0.15, 0.55]);
const EARTH_WEDGES = 10;
// The middle longitude of each wedge of city lights, and the longitude (in
// the Earth's own frame) where the ground turns into the night side the
// viewer sees (just before dusk).
const EARTH_LIGHTS = (() => {
  const lon = (i) => ((i + 0.5) / EARTH_WEDGES) * TAU - Math.PI;
  const cam = camDir();
  const sunAt = (a) => dot(quatRotate(EARTH_TILT, dirOf(0, a)), EARTH_SUN);
  let enter = 0;
  for (let j = 0; j < 720; j++) {
    const a = (j / 720) * TAU - Math.PI;
    const b = a + TAU / 720;
    const facing = dot(quatRotate(EARTH_TILT, dirOf(0, a)), cam) > 0;
    if (facing && sunAt(a) >= 0.08 && sunAt(b) < 0.08) enter = a;
  }
  return { lon, enter };
})();

// Jupiter's bands (between sines of latitude) and how many turns each makes
// when the winds race: neighbours go opposite ways, the equator fastest.
// The Great Red Spot's band and the poles stay put.
const JUPITER_JETS = [
  { y0: -1, y1: -0.72, turns: 0 },
  { y0: -0.72, y1: -0.5, turns: 1 },
  { y0: -0.5, y1: -0.27, turns: 0 },
  { y0: -0.27, y1: -0.1, turns: -1 },
  { y0: -0.1, y1: 0.1, turns: 2 },
  { y0: 0.1, y1: 0.27, turns: -1 },
  { y0: 0.27, y1: 0.45, turns: 1 },
  { y0: 0.45, y1: 0.72, turns: -1 },
  { y0: 0.72, y1: 1, turns: 0 },
];

// Venus's cloud deck in latitude bands and how many turns each makes when
// its clouds swirl: the wide equatorial band twice, the polar caps once.
const VENUS_BANDS = [
  { y0: -1, y1: -0.55, turns: 1 },
  { y0: -0.55, y1: 0.55, turns: 2 },
  { y0: 0.55, y1: 1, turns: 1 },
];

// Neptune's bands and their turns when the winds race: the white cloud
// belts twice round, the dark storm's band (with its companion) once the
// other way; the rest stays put.
const NEPTUNE_BANDS = [
  { y0: -1, y1: -0.7, turns: 0 },
  { y0: -0.7, y1: -0.5, turns: 2 },
  { y0: -0.5, y1: -0.2, turns: -1 },
  { y0: -0.2, y1: 0.28, turns: 0 },
  { y0: 0.28, y1: 0.58, turns: 2 },
  { y0: 0.58, y1: 1, turns: 0 },
];

// How fast Saturn's C, B, A and F rings turn (radians per second): inner
// orbits are faster, about as the -1.5 power of the radius.
const SATURN_RING_SPEEDS = [0.24, 0.16, 0.11, 0.095];
// Ring features repeat every eighth of a turn (see saturnRings).
const RING_PERIOD = TAU / 8;
const ringAngle = (a) => ((a % RING_PERIOD) + RING_PERIOD) % RING_PERIOD;

// Cells for rocks that break into pieces (asteroid, meteor): centres inside
// an ellipsoid with half axes `ax`, the direction and distance each piece
// flies and how it tumbles. From a fixed seed, so every build agrees.
function rockCells(n, ax, seed) {
  let x = seed;
  const rnd = () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
  const cells = [];
  while (cells.length < n) {
    const p = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1];
    if (len(p) > 1) continue;
    const c = [p[0] * ax[0], p[1] * ax[1], p[2] * ax[2]];
    const out = len(p);
    const dir = out > 0.25 ? unit(c) : randDir(rnd);
    cells.push({
      c,
      dir,
      dist: 0.2 + 0.55 * out + 0.15 * rnd(),
      axis: randDir(rnd),
      spin: (0.5 + 1.2 * rnd()) * (rnd() < 0.5 ? -1 : 1),
    });
  }
  return cells;
}
const ASTEROID_CELLS = rockCells(18, [1.2, 0.68, 0.8], 7);
const METEOR_CELLS = rockCells(9, [0.2, 0.16, 0.18], 11);
// The meteor falls down and to the left; its trail points back up (T).
const METEOR_T = (() => {
  const f = camFrame();
  return unit(add([0, 1, 0], mul(f.right, 0.75)));
})();

// The pulsar's spin axis, its magnetic axis (40 degrees off) and the spin
// angle at which a beam comes closest to the default camera.
const PULSAR = (() => {
  const axis = unit([0.12, 1, 0.06]);
  const m = unit(quatRotate(quatAxisAngle(unit(cross(axis, [0, 0, 1])), 40 * DEG), axis));
  const cam = camDir();
  let face = 0;
  let best = -2;
  for (let i = 0; i < 720; i++) {
    const a = (i / 720) * TAU;
    const v = Math.abs(dot(quatRotate(quatAxisAngle(axis, a), m), cam));
    if (v > best) [best, face] = [v, a];
  }
  return { axis, m, face };
})();

// The path of the star that falls into the black hole: from high on the
// right, above the disk, it spirals down and in, round the front, to plunge
// in just left of centre. phi is the angle from the viewer's right towards
// the viewer.
const BH_PATH = (() => {
  const f = camFrame(0.55, 0.16);
  const R1 = unit([f.right[0], 0, f.right[2]]);
  const F1 = unit([f.c[0], 0, f.c[2]]);
  const phi = (s) => -0.2 * Math.PI + 0.78 * Math.PI * s;
  const at = (s) => {
    const r = 2.8 - 1.9 * Math.pow(s, 1.3);
    const a = phi(s);
    const h = 1.25 * Math.pow(1 - s, 1.4) + 0.04;
    return add(mul(R1, r * Math.cos(a)), add(mul(F1, r * Math.sin(a)), [0, h, 0]));
  };
  const tangent = (s) => unit(sub(at(Math.min(1, s + 0.01)), at(Math.max(0, s - 0.01))));
  return { phi, at, tangent, end: at(1) };
})();

// The solar system's line-up: the row's angle (to the viewer's left), how
// much further Mercury swings (to in front of the Sun), and the tip that
// brings the camera down into the plane of the orbits.
const SS = (() => {
  const yaw = 0.55;
  const f = camFrame(yaw, 0.72);
  const tipAxis = unit(cross([0, 1, 0], f.up));
  const tipAngle = 0.94 * Math.acos(clamp(dot([0, 1, 0], f.up), -1, 1));
  // The camera's direction in the toy's own frame while it is tipped.
  const eye = quatRotate(quatAxisAngle(tipAxis, -tipAngle), f.c);
  return { row: yaw - Math.PI / 2, transit: Math.PI / 2, tipAxis, tipAngle, eye };
})();
// Where each planet is built: Mercury in front of the Sun (so it draws over
// the Sun as it crosses), the rest where they start.
for (const P of ORRERY) P.build = P.id === "mercury" ? 0.55 : P.phase;

// The star cluster's shells (outer radius) and how late each breathes.
const CLUSTER_SHELLS = [
  { r: 0.14, lag: 0 },
  { r: 0.4, lag: 0.05 },
  { r: 9, lag: 0.1 },
];

// How many new stars light up in the nebula.
const NEBULA_BIRTHS = 7;

// Supernova debris flies apart in chunks (each one a part).
const CHUNKS = fibonacciSphere(13);

// Galaxy tilts (applied as a part, after the stars orbit in the disc).
const ANDROMEDA_TILT = faceCamera(-31 * DEG, -34 * DEG, 0.55, 0.9);

// ---- Recipes ------------------------------------------------------------------------

export const RECIPES = {
  sun: {
    alive: true,
    controls: [{ key: "flare", label: "Flare", type: "pulse", ease: 4.6 }],
    action: { key: "flare", label: "Solar flare" },
    // By itself the Sun churns: two layers of bright granules swell and
    // fade in turn, the prominences rise and sink and the corona breathes.
    // A tap sets off a flare: the footpoints flash white, a loop of hot gas
    // climbs off the limb, swells, and its top breaks away into space.
    drive(t, c, out) {
      const w = Math.sin(t * 2.3);
      out.parts.granA = { angle: 0.06 * Math.sin(t * 0.31), visible: 0.8 + 0.4 * w };
      out.parts.granB = { angle: -0.06 * Math.sin(t * 0.27 + 1), visible: 0.8 - 0.4 * w };
      out.parts.corona = {
        scale: 1 + 0.04 * Math.sin(t * 1.1) + 0.015 * Math.sin(t * 2.9),
        visible: 0.92 + 0.12 * Math.sin(t * 1.1),
      };
      for (let i = 0; i < SUN_LOOPS.length; i++)
        out.parts[`prom${i}`] = { scale: 1 + 0.16 * Math.sin(t * (0.7 + 0.13 * i) + i * 1.9) };
      const p = progress(c.flare);
      const on = c.flare > 0 ? 1 : 0;
      out.grow = on * 1.1 * ease(band(p, 0.02, 0.24));
      out.parts.flare = {
        scale: 1 + 0.45 * ease(band(p, 0.04, 0.3)) + 0.7 * ease(band(p, 0.3, 0.72)),
        visible: on * (1 + 0.6 * bump(p, 0.02, 0.08, 0.15, 0.35)) * (1 - band(p, 0.55, 0.8)),
      };
      out.parts.ribbon = { visible: on * 1.6 * bump(p, 0.01, 0.06, 0.2, 0.5) };
      const fly = ease(band(p, 0.3, 0.9));
      out.parts.cme = {
        offset: mul(SUN_FLARE.mid, 1.1 * fly),
        scale: 1 + 1.6 * fly,
        visible: on * bump(p, 0.3, 0.38, 0.62, 0.9),
      };
      out.amount = 1.4 + 1.6 * bump(p, 0.01, 0.06, 0.25, 0.6) * on;
    },
    build(k) {
      // The photosphere: bright granules with darker lanes between them,
      // a few sunspots with dark umbras and brown penumbras.
      const cam = camDir();
      const spots = [
        { d: unit(add(cam, [-0.3, 0.24, 0])), r: 0.075 },
        { d: unit(add(cam, [-0.19, 0.3, 0.05])), r: 0.035 },
        { d: unit(add(cam, [0.36, -0.22, -0.1])), r: 0.05 },
        { d: unit(add(cam, [0.45, -0.16, -0.14])), r: 0.028 },
      ];
      k.add(k.sphere(1), {
        flat: 0.4,
        interior: 0.1,
        core: layers(["#fffbe8", "#ffe07a", "#ffab2e", "#ff7a18"]),
        kind: "twinkle",
        params: (c) => [0.14, c.rand() * TAU],
        color: (c) => {
          const d = c.ln;
          const g = Math.abs(c.noise(d[0] * 24, d[1] * 24, d[2] * 24));
          const lane = smoothstep(0.0, 0.14, g);
          const big = c.fbm(d[0] * 3 + 5, d[1] * 3, d[2] * 3, 3);
          const hot = clamp01(0.55 + big * 2);
          let col = mix("#f0700f", mix("#ffb020", "#ffe066", hot), 0.35 + 0.65 * lane);
          for (const s of spots) {
            const x = angle(d, s.d) / s.r;
            if (x < 1) {
              col =
                x < 0.45
                  ? mix("#2a0f04", "#5a2208", x / 0.45)
                  : mix("#8a3a0e", col, smoothstep(0.8, 1, x));
            } else if (x < 2.4) {
              col = mix(col, "#fff3b0", 0.4 * (1 - (x - 1) / 1.4));
            }
          }
          return col;
        },
      });
      // Prominences: loops of glowing gas arching off the limb, each a part
      // that rises and sinks about its feet.
      SUN_LOOPS.forEach((L, i) => {
        const mid = limbDir(L.a, cam, L.lift || 0);
        const side = unit(cross(mid, cam));
        const tw = (k.rand() - 0.5) * 0.8;
        const along = unit(add(side, mul(cross(mid, side), tw)));
        const pts = [];
        for (let j = 0; j <= 8; j++) {
          const s = j / 8;
          const off = (s - 0.5) * 2 * L.span;
          const hgt = 0.97 + L.h * Math.sin(Math.PI * s) * (1 + 0.15 * Math.sin(s * 9 + L.a));
          pts.push(mul(unit(add(mid, mul(along, off))), hgt));
        }
        glowPath(k, spline(pts), {
          share: 0.008,
          width: (t) => 0.015 + 0.03 * Math.sin(Math.PI * t),
          size: 2.2,
          opacity: 0.35,
          col: (t, rand) => mix("#ff3d14", "#ffb04a", 0.25 + 0.5 * rand()),
          part: k.part(`prom${i}`, { pivot: mul(mid, 0.97) }),
        });
      });
      // The corona: a soft glow with faint streamers, breathing as one.
      const corona = k.part("corona");
      halo(k, {
        r0: 0.99,
        r1: 1.32,
        share: 0.08,
        size: 3.2,
        opacity: 0.25,
        falloff: 1.8,
        twinkle: 0.25,
        part: corona,
        col: (t) => mix("#ffc24a", "#ff6a1a", t),
      });
      k.cloud({ share: 0.01, size: 1.4, pattern: false, part: corona }, (rand) => {
        const i = Math.floor(rand() * 9);
        const base = limbDir(i * 0.7 + 0.3, cam, (((i * 37) % 7) / 7 - 0.5) * 0.8);
        const d = unit(add(base, mul(randDir(rand), 0.12)));
        const r = 1.0 + 0.36 * Math.pow(rand(), 1.6);
        return {
          p: mul(d, r),
          dir: d,
          stretch: 5,
          color: mix("#ffd98a", "#ff8a2a", (r - 1) / 0.36),
          opacity: 0.2 * (1 - (r - 1) / 0.4),
          kind: "twinkle",
          params: [0.3, rand() * TAU],
        };
      });
      // Churning granules: two layers of bright cells from different noise,
      // which swell and fade in turn (drive), so the pattern boils.
      const noise = k.noise;
      ["granA", "granB"].forEach((name, li) => {
        const part = k.part(name);
        k.cloud({ share: 0.07, size: 1.25, pattern: false, part }, (rand) => {
          for (let tries = 0; tries < 8; tries++) {
            const d = randDir(rand);
            const o = li * 17.3;
            const g = noise(d[0] * 13 + o, d[1] * 13, d[2] * 13 - o);
            if (g < 0.12 + 0.2 * rand()) continue;
            const hot = smoothstep(0.12, 0.4, g);
            return {
              p: mul(d, 1.004),
              n: d,
              flat: 0.3,
              color: mix("#ffb024", "#fff2b8", hot),
              opacity: 0.35 + 0.4 * hot,
              size: 0.9 + 0.8 * rand(),
            };
          }
          return null;
        });
      });
      // The flare (hidden until a tap): a loop of hot gas off the limb,
      // drawn from its two feet up to its top (grow), bright ribbons where it
      // meets the surface, and the top that breaks away (a coronal mass
      // ejection). It is built small and grows by its part's scale, so it
      // does not change how the Sun is framed.
      const F = SUN_FLARE;
      const flare = k.part("flare", { pivot: mul(F.mid, 0.97) });
      const foot = (sgn) => mul(unit(add(F.mid, mul(F.along, sgn * F.span))), 0.985);
      const loopAt = (s) => {
        const off = (s - 0.5) * 2 * F.span;
        const hgt = 0.975 + F.h * Math.pow(Math.sin(Math.PI * s), 0.85);
        return mul(unit(add(F.mid, mul(F.along, off))), hgt);
      };
      for (const [share, width, op, hot] of [
        [0.02, 0.05, 0.3, 0],
        [0.012, 0.016, 0.8, 1],
      ]) {
        k.cloud({ share, size: hot ? 1.3 : 2.4, pattern: false, part: flare }, (rand) => {
          const s = rand();
          const w = width * (0.6 + 0.6 * Math.sin(Math.PI * s));
          return {
            p: add(loopAt(s), mul(randDir(rand), w * Math.sqrt(rand()))),
            color: hot
              ? mix("#fff6d0", "#ffd060", rand())
              : mix("#ff3a10", "#ff9a30", 0.2 + 0.6 * rand()),
            opacity: op,
            size: 0.7 + 0.6 * rand(),
            kind: "grow",
            params: [Math.min(0.92, 1 - Math.abs(2 * s - 1)), 0],
          };
        });
      }
      const ribbon = k.part("ribbon");
      k.cloud({ share: 0.008, size: 2.2, pattern: false, part: ribbon }, (rand) => {
        const f = foot(rand() < 0.5 ? -1 : 1);
        return {
          p: add(f, mul(randDir(rand), 0.07 * Math.sqrt(rand()))),
          color: mix("#ffffff", "#fff0a0", rand()),
          opacity: 0.8,
        };
      });
      const cme = k.part("cme", { pivot: mul(F.mid, 1.25) });
      k.cloud({ share: 0.01, size: 2.2, pattern: false, part: cme }, (rand) => {
        // A bubble of gas: a loop's top, puffed out.
        const s = 0.2 + 0.6 * rand();
        const top = loopAt(s);
        return {
          p: add(mul(top, 1.0), mul(randDir(rand), 0.06 * Math.sqrt(rand()))),
          color: mix("#ffb050", "#ff5a20", rand()),
          opacity: 0.4,
          size: 0.8 + 0.6 * rand(),
        };
      });
    },
  },

  mercury: {
    controls: [{ key: "spin", label: "Spin", type: "pulse", ease: 3.4 }],
    action: { key: "spin", label: "Spin in the sunlight" },
    // A tap spins it round once, fast, and the side facing the Sun glows
    // red-hot and shimmers (the day side reaches about 430 °C).
    drive(t, c, out) {
      const p = progress(c.spin);
      const on = c.spin > 0 ? 1 : 0;
      const heat = on * bump(p, 0.04, 0.28, 0.6, 0.98);
      // The heat lies over the side the ground turns away from (see
      // spinQuarters).
      spinQuarters(out, "globe", TAU * ease(band(p, 0, 0.6)), 1);
      out.parts.core = { visible: on ? 0 : 1 };
      out.parts.heat = { visible: heat, scale: 1 + 0.02 * heat };
      out.amount = 1 + 0.8 * heat;
    },
    build(k) {
      const craters = craterField(k.rand, { count: 380, min: 0.016, max: 0.19, rays: 3 });
      const noise = k.noise;
      const inside = layers(["#8a5a3a", "#9a7a62", "#7d746b"]);
      coreBall(k, { col: inside });
      const body = {
        craters,
        interior: 0,
        albedo: (c, d) => {
          const plains = smoothstep(
            0.02,
            0.12,
            noise.fbm(d[0] * 1.5 + 4, d[1] * 1.5, d[2] * 1.5, 4),
          );
          let col = mix("#a89c8c", "#7e756b", plains * 0.8);
          col = shade(col, 1 + 0.08 * c.noise(d[0] * 36, d[1] * 36, d[2] * 36));
          const L = craters.look(d, c.noise);
          col = shade(col, 1 - 0.06 * L.floor);
          return mix(col, "#e8e2d6", clamp01(L.ray) * 0.55);
        },
      };
      QUARTER_NAMES.forEach((s, i) => {
        const turned = i ? { turn: [0, 1, 0], turnAngle: (i * TAU) / 4, ...QUARTER } : {};
        rockyBody(k, { ...body, part: k.part(`globe${s}`), ...turned });
      });
      // The heat (hidden until a tap): a shimmering red-hot glow over the
      // day side, hottest under the Sun. It stays put while the ground turns.
      const [e1, e2] = basis(LIGHT);
      k.cloud({ share: 0.07, size: 2.6, pattern: false, part: k.part("heat") }, (rand) => {
        const cosT = 1 - rand() * 1.05;
        const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
        const a = rand() * TAU;
        const d = add(
          mul(LIGHT, cosT),
          add(mul(e1, sinT * Math.cos(a)), mul(e2, sinT * Math.sin(a))),
        );
        const hot = smoothstep(-0.05, 0.9, cosT);
        return {
          p: mul(d, 1.012 + 0.03 * rand()),
          n: d,
          flat: 0.3,
          color: ramp(["#b0260c", "#f0521a", "#ff9038", "#ffd28a"], hot),
          opacity: 0.06 + 0.22 * hot,
          kind: "twinkle",
          params: [0.3, rand() * TAU],
        };
      });
    },
  },

  venus: {
    controls: [{ key: "swirl", label: "Swirl", type: "pulse", ease: 4 }],
    action: { key: "swirl", label: "Swirl the clouds" },
    // A tap whips the thick clouds round the planet (backwards, as Venus
    // turns): the wide band round the equator twice and the polar caps
    // once, so the cloud pattern shears where they meet, then locks
    // together again.
    drive(t, c, out) {
      const u = ease(band(progress(c.swirl), 0, 0.94));
      const cull = c.swirl > 0;
      const visible = cull ? CULLED_SIZE : 1;
      VENUS_BANDS.forEach((b, i) =>
        spinParts(out, `deck${i}`, -TAU * b.turns * u, { cull, visible }),
      );
      out.parts.core = { visible: c.swirl > 0 ? 0 : 1 };
    },
    build(k) {
      const noise = k.noise;
      coreBall(k, { col: layers(["#d9a24a", "#b8683a", "#9a5a3a", "#c9a06a"]) });
      const col = (c, d) => {
        // Sulphuric cloud tops: soft bands folded into Y-shaped chevrons.
        const w = noise.fbm(d[0] * 1.2 + 4, d[1] * 1.2, d[2] * 1.2, 2);
        const v = noise.fbm(
          d[0] * 1.4 + Math.abs(d[1]) * 2.2 + w,
          d[1] * 5 + w,
          d[2] * 1.4 - Math.abs(d[1]) * 1.5,
          4,
        );
        const cl = ramp(["#b88a4a", "#d8b273", "#ecd49e", "#f8eac2"], clamp01(0.5 + v * 2.2));
        return lit(cl, c.n, 0.3);
      };
      VENUS_BANDS.forEach((b, i) => {
        const shell = { y0: b.y0, y1: b.y1, col, grid: 64 };
        bandShell(k, { ...shell, part: k.part(`deck${i}`) });
        bandShell(k, { ...shell, part: k.part(`deck${i}B`), turn: [0, 1, 0], ...TURNED });
      });
      halo(k, {
        r0: 1,
        r1: 1.07,
        share: 0.035,
        size: 2,
        opacity: 0.16,
        falloff: 1.3,
        col: (t) => mix("#fff2cc", "#ffd890", t),
      });
    },
  },

  earth: {
    controls: [{ key: "day", label: "A day", type: "pulse", ease: 6.4 }],
    action: { key: "day", label: "Turn through a day" },
    // A tap turns it through one day with the Sun off to the left: night
    // falls over the right half, the Earth turns once, city lights come on
    // as the land turns into the dark and go out at dawn, then the night
    // lifts.
    drive(t, c, out) {
      const p = progress(c.day);
      const on = c.day > 0 ? 1 : 0;
      const dusk = on * ease(band(p, 0, 0.13)) * (1 - ease(band(p, 0.87, 1)));
      out.grow = 1.1 * dusk;
      const turn = TAU * ease(band(p, 0.08, 0.9));
      // The night lies over the side the ground turns towards.
      spinQuarters(out, "globe", turn, -1);
      out.parts.core = { visible: on ? 0 : 1 };
      // Each wedge of lights is built turned to where the ground enters the
      // night, so it is always shown at or past its built pose (drawn over
      // the night); it shines only while it is on the night side in view.
      const view = camDir();
      for (let i = 0; i < EARTH_WEDGES; i++) {
        const lon = EARTH_LIGHTS.lon(i) + turn;
        const dir = quatRotate(EARTH_TILT, dirOf(0, lon));
        const seen =
          smoothstep(-0.05, 0.25, -dot(dir, EARTH_SUN)) * smoothstep(-0.05, 0.25, dot(dir, view));
        let a = lon - EARTH_LIGHTS.enter;
        a = ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
        out.parts[`lights${i}`] = { angle: a, visible: seen * band(dusk, 0.6, 1) };
      }
    },
    build(k) {
      const noise = k.noise;
      const q = EARTH_TILT;
      const facing = quatRotate([-q[0], -q[1], -q[2], q[3]], camDir());
      const surface = earthSurface(noise, facing);
      const axis = quatRotate(q, [0, 1, 0]);
      // The clouds are painted on the globe (a separate layer of splats
      // above a turning globe would draw in the wrong order).
      coreBall(k, {
        r: 0.92,
        col: layers(["#fff1b0", "#ffc04a", "#ff7a2a", "#c2451e", "#5a2c1c"], 0.92),
      });
      const ground = {
        quat: q,
        interior: 0,
        // A continent faces the viewer.
        col: (c, d) => {
          const v = earthCloudCover(noise, d);
          const cloud = v < 0.1 ? 0 : 0.25 + 0.7 * smoothstep(0.1, 0.24, v);
          const white = mix("#d4dde6", "#ffffff", smoothstep(0.1, 0.24, v));
          return lit(mix(surface(c, d), white, cloud), c.n, 0.3);
        },
      };
      QUARTER_NAMES.forEach((s, i) => {
        const turned = i ? { turn: axis, turnAngle: (i * TAU) / 4, ...QUARTER } : { size: 1.15 };
        globe(k, { ...ground, part: k.part(`globe${s}`, { axis }), ...turned });
      });
      halo(k, {
        r0: 1.0,
        r1: 1.08,
        share: 0.04,
        size: 2,
        opacity: 0.16,
        falloff: 1.2,
        col: (t) => mix("#7cc6ff", "#3a7cff", t),
      });
      // Night (hidden until a tap): a dark shell over the half away from
      // the Sun. It spreads from the midnight side to the dusk line (grow)
      // and draws back the same way at dawn.
      const S = EARTH_SUN;
      k.cloud({ share: 0.08, size: 2.4, pattern: false }, (rand, i, n) => {
        const d = fibCap(i, n, mul(S, -1), -0.16);
        const s = dot(d, S);
        return {
          p: mul(d, 1.03),
          n: d,
          flat: 0.7,
          color: mix("#02040c", "#081026", rand() * 0.4),
          opacity: 0.96 * smoothstep(0.16, -0.14, s),
          kind: "grow",
          params: [0.9 * clamp01((s + 1) / 1.14), 0],
        };
      });
      // City lights on the land, in wedges of longitude (drive).
      const wedges = [];
      for (let i = 0; i < EARTH_WEDGES; i++) wedges.push(k.part(`lights${i}`, { axis }));
      k.cloud({ share: 0.03, size: 0.6, pattern: false }, (rand) => {
        for (let tries = 0; tries < 14; tries++) {
          const d = randDir(rand);
          const h = earthHeight(noise, d, facing);
          if (h < EARTH_SEA + 0.004 || Math.abs(d[1]) > 0.74) continue;
          const coast = 1 - smoothstep(0, 0.08, h - EARTH_SEA);
          const busy = smoothstep(
            0.02,
            0.2,
            noise.fbm(d[0] * 5 + 7, d[1] * 5, d[2] * 5, 3) + 0.15 * coast,
          );
          if (rand() > 0.05 + 0.6 * busy * (0.4 + 0.6 * coast)) continue;
          const lon = lonOf(d);
          const i = Math.min(EARTH_WEDGES - 1, Math.floor(((lon + Math.PI) / TAU) * EARTH_WEDGES));
          // Built turned so that the wedge's middle sits at EARTH_LIGHTS.enter.
          const w = quatRotate(
            q,
            quatRotate(quatAxisAngle([0, 1, 0], EARTH_LIGHTS.enter - EARTH_LIGHTS.lon(i)), d),
          );
          return {
            p: mul(w, 1.036),
            color: mix("#ffb43c", "#fff0b8", rand()),
            opacity: 0.95,
            size: 0.8 + 0.6 * rand(),
            kind: "twinkle",
            params: [0.35, rand() * TAU],
            part: wedges[i],
          };
        }
        return null;
      });
    },
  },

  moon: {
    controls: [{ key: "land", label: "Landing", type: "toggle", default: 0, ease: MOON_SECS }],
    action: { key: "land", label: "Land or leave" },
    options: [{ key: "flag", label: "Flag", type: "flag", default: "us" }],
    screen: MOON_SCREEN,
    // A tap lands a lunar module near the top of the Moon: an astronaut
    // climbs down, plants the chosen flag and waves (see landingPose). A
    // second tap packs up and lifts off (leavingPose). Tapping again part
    // way runs the same story back.
    drive(t, c, out, info) {
      const m = mem(c);
      if (c.land >= 1) m.leave = true;
      if (c.land <= 0) m.leave = false;
      const s = (m.leave ? 1 - c.land : c.land) * MOON_SECS;
      const was = m.leave === m.wasLeave ? (m.s ?? s) : s;
      m.s = s;
      m.wasLeave = m.leave;
      const crossed = (x) => was < x && s >= x;
      if (!m.leave && crossed(3.4)) out.cues.push({ voice: "thud", f: 55, decay: 2.4, vol: 1 });
      if (!m.leave && crossed(7.72)) out.cues.push({ voice: "pock", f: 520, decay: 1.6, vol: 0.6 });
      if (m.leave && crossed(5.6)) {
        out.cues.push({ voice: "rumble", f: 60, rate: 4, decay: 1.7, vol: 0.9 });
        out.cues.push({ voice: "whoosh", at: 0.3, f: 300, to: 2.5, decay: 2 });
      }
      const ground = info?.data?.ground || (() => 1);
      moonScene(out, ground, m.leave ? leavingPose(s) : landingPose(s));
    },
    build(k, o) {
      const craters = craterField(k.rand, { count: 260, min: 0.02, max: 0.2, rays: 2 });
      const noise = k.noise;
      const cam = camDir();
      const shapeR = tabulate((d) => 1 + 0.01 * noise.fbm(d[0] * 2 + 3, d[1] * 2, d[2] * 2, 3));
      rockyBody(k, {
        craters,
        core: layers(["#c9a06a", "#8a7a6a", "#6a6560"]),
        shapeR,
        albedo: (c, d) => {
          // Maria: broad dark plains, mostly on the side facing the viewer.
          const m =
            noise.fbm(d[0] * 1.5 + 7, d[1] * 1.5, d[2] * 1.5, 4) + 0.12 * dot(d, cam) - 0.02;
          const mare = smoothstep(0.03, 0.1, m);
          const fine = c.noise(d[0] * 40, d[1] * 40, d[2] * 40);
          let col = mix("#9e9b94", "#5c5a56", mare * 0.9);
          col = shade(col, 1 + 0.06 * fine);
          const L = craters.look(d, c.noise);
          col = shade(col, 1 - 0.05 * L.floor);
          return mix(col, "#e6e3dc", clamp01(L.ray) * 0.45);
        },
        reliefAmount: 0.85,
        litAmount: 0.25,
      });
      k.data = { ground: (d) => shapeR(d) * (1 + craters.height(d)) };
      buildLanding(k, k.data.ground, o.flag);
    },
  },

  mars: {
    controls: [{ key: "storm", label: "Dust storm", type: "pulse", ease: 5.4 }],
    action: { key: "storm", label: "Raise a dust storm" },
    // A tap raises a dust storm: billowing ochre dust sweeps across the
    // face from the left edge (grow, with a ragged front) until it hides
    // the dark markings, then settles, clearing from the east edge back the
    // way it came (shrinking the dust instead leaves speckle). The dust
    // does not drift: turned at all, it sorts behind the ground.
    drive(t, c, out) {
      const p = progress(c.storm);
      const on = c.storm > 0 ? 1 : 0;
      out.grow = on * 1.1 * ease(band(p, 0.02, 0.42)) * (1 - ease(band(p, 0.62, 0.97)));
      out.parts.dust = { visible: on };
    },
    build(k) {
      const noise = k.noise;
      const q = quatEuler(0, 0, -25);
      const canyonLon = 0.4;
      globe(k, {
        quat: q,
        core: layers(["#e8b060", "#b0552a", "#7a3a24", "#9a4a2a"]),
        col: (c, d) => {
          const lat = latOf(d);
          const dark = smoothstep(0.03, 0.13, noise.fbm(d[0] * 1.7 + 4, d[1] * 1.7, d[2] * 1.7, 5));
          const tone = noise.fbm(d[0] * 4 + 1, d[1] * 4, d[2] * 4, 3);
          let col = mix("#c9602d", "#e0925a", clamp01(0.5 + tone * 2.5));
          col = mix(col, "#6e2e1a", dark * 0.75);
          // A long canyon near the equator.
          let dl = lonOf(d) - canyonLon;
          dl = ((((dl + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
          const cy = lat + 0.14 + 0.03 * Math.sin(dl * 6);
          const cw = 0.018 * (1 - Math.abs(dl) / 0.7);
          if (dl > -0.7 && dl < 0.7 && Math.abs(cy) < cw)
            col = mix("#7a3320", col, smoothstep(0, cw, Math.abs(cy)) * 0.7 + 0.3 * Math.abs(dl));
          // Polar caps.
          const cap = Math.abs(lat) + 0.06 * noise(d[0] * 7, d[1] * 7, d[2] * 7);
          const edge = lat > 0 ? 1.2 : 1.33;
          if (cap > edge) col = "#f6f1ea";
          else if (cap > edge - 0.05) col = mix(col, "#f0dcca", (cap - edge + 0.05) / 0.05);
          return lit(shade(col, 1 + 0.06 * c.noise(d[0] * 34, d[1] * 34, d[2] * 34)), c.n, 0.3);
        },
      });
      halo(k, {
        r0: 1,
        r1: 1.05,
        share: 0.03,
        size: 2,
        opacity: 0.12,
        falloff: 1.3,
        col: (t) => mix("#ffc8a0", "#e08a60", t),
      });
      // The dust (hidden until a tap): lumpy clouds in a shell just above
      // the ground, appearing from the viewer's left as the front passes.
      const right = camFrame().right;
      k.cloud({ share: 0.16, size: 1.9, pattern: false, part: k.part("dust") }, (rand) => {
        const d = randDir(rand);
        const lump = noise.fbm(d[0] * 3 + 40, d[1] * 3, d[2] * 3, 4);
        const dens = clamp01(0.55 + lump * 2.2);
        const front =
          0.84 * band(dot(d, right), -1.05, 1.05) + 0.1 * noise(d[0] * 5, d[1] * 5 + 9, d[2] * 5);
        return {
          p: mul(d, 1.014 + 0.035 * rand() * dens),
          n: d,
          flat: 0.3,
          color: lit(mix("#d09a60", "#f6d7a4", dens * (0.6 + 0.4 * rand())), d, 0.35),
          opacity: 0.5 + 0.45 * dens,
          kind: "grow",
          params: [clamp01(front), 0],
        };
      });
    },
  },

  jupiter: {
    alive: true,
    controls: [{ key: "race", label: "Winds", type: "pulse", ease: 4.2 }],
    action: { key: "race", label: "Race the bands" },
    // A tap sets the cloud bands racing, neighbours in opposite directions
    // as Jupiter's jets do (each band turns a whole number of times, so the
    // picture comes back together), and the Great Red Spot spins up
    // anticlockwise inside its oval.
    drive(t, c, out) {
      const u = ease(band(progress(c.race), 0, 1));
      // While the bands turn, each hides its far side (cull), or one band's
      // back would draw over the next band's front near the edge; slightly
      // bigger splats close the gaps the back no longer fills.
      const cull = c.race > 0;
      const visible = cull ? CULLED_SIZE : 1;
      JUPITER_JETS.forEach((j, i) => {
        if (j.turns) spinParts(out, `band${i}`, TAU * j.turns * u, { cull, visible });
      });
      out.parts.still = { cull, visible };
      out.parts.spot = { angle: TAU * 3 * u };
      out.parts.core = { visible: c.race > 0 ? 0 : 1 };
    },
    build(k) {
      const noise = k.noise;
      const lon0 = 0.3;
      const surf = jupiterSurface(noise, { lon0 });
      const O = 0.935;
      coreBall(k, {
        oblate: O,
        col: layers(["#6a5646", "#5f6f82", "#8a8aa0", "#c7a987", "#d9c4a0"]),
      });
      // The Great Red Spot and the white ovals shimmer.
      const storms = (c) => {
        const d = unit([c.lp[0], c.lp[1] / O, c.lp[2]]);
        let storm = ovalDist(d, -0.39, lon0, 0.17, 0.085) < 1.2 ? 0.14 : 0;
        for (let i = 0; i < 5 && !storm; i++)
          if (ovalDist(d, -0.6, lon0 + 0.9 + i * 0.55, 0.05, 0.035) < 1) storm = 0.2;
        return [storm, c.rand() * TAU];
      };
      // The planet in latitude bands, each its own part where it moves (the
      // still ones share a part too, to be culled).
      const still = k.part("still");
      JUPITER_JETS.forEach((j, i) => {
        const shell = {
          y0: j.y0,
          y1: j.y1,
          oblate: O,
          kind: "twinkle",
          params: storms,
          col: (c, d) => lit(surf(c, d), c.n, 0.3),
        };
        bandShell(k, { ...shell, part: j.turns ? k.part(`band${i}`) : still });
        if (j.turns)
          bandShell(k, { ...shell, part: k.part(`band${i}B`), turn: [0, 1, 0], ...TURNED });
      });
      // The spot's swirl: spiral streaks in a round patch inside the oval.
      const dG = dirOf(-0.39, lon0);
      const [g1, g2] = basis(dG);
      k.cloud(
        { share: 0.012, size: 0.9, pattern: false, part: k.part("spot", { axis: dG }) },
        (rand) => {
          const rho = 0.078 * Math.sqrt(rand());
          const a = rand() * TAU;
          const d = unit(add(dG, add(mul(g1, rho * Math.cos(a)), mul(g2, rho * Math.sin(a)))));
          const arm = 0.5 + 0.5 * Math.sin(2 * a + rho * 90);
          const col = mix(mix("#a8381f", "#e08a5c", arm), "#f0c09a", 0.35 * arm * (rho / 0.078));
          return {
            p: [d[0] * 1.004, d[1] * O * 1.004, d[2] * 1.004],
            n: d,
            flat: 0.3,
            color: lit(col, d, 0.3),
            opacity: 0.55 + 0.35 * arm,
          };
        },
      );
    },
  },

  saturn: {
    alive: true,
    controls: [{ key: "ripple", label: "Ripple", type: "pulse", ease: 4 }],
    action: { key: "ripple", label: "Ripple the rings" },
    // The rings turn all the time, the inner ones faster (as orbits do);
    // dark spokes and bright clumps in them show the motion. A tap sends two
    // sparkling waves rippling out across the rings.
    drive(t, c, out) {
      SATURN_RING_SPEEDS.forEach((w, i) => (out.parts[`ring${i}`] = { angle: ringAngle(t * w) }));
      const p = progress(c.ripple);
      const on = c.ripple > 0 ? 1 : 0;
      [0, 0.2].forEach((lag, i) => {
        const s = band(p, 0.02 + lag, 0.62 + lag);
        out.parts[`wave${i}`] = {
          scale: 0.55 + 0.45 * easeOut(s),
          visible: on * 1.4 * bump(p, 0.02 + lag, 0.07 + lag, 0.5 + lag, 0.64 + lag),
        };
      });
      out.amount = 1 + 1.2 * on;
    },
    build(k) {
      const noise = k.noise;
      const q = faceCamera(20 * DEG, -14 * DEG);
      const surf = saturnSurface(noise);
      globe(k, {
        quat: q,
        oblate: 0.9,
        share: 0.55,
        core: layers(["#6a5a48", "#7a8090", "#b8a888", "#d8c49a"]),
        col: (c, d) => lit(surf(c, d), c.n, 0.3),
      });
      // Ice in the rings sparkles.
      const axis = quatRotate(q, [0, 1, 0]);
      const parts = [0, 1, 2, 3].map((i) => k.part(`ring${i}`, { axis }));
      saturnRings(k, noise, {
        quat: q,
        shares: [0.06, 0.2, 0.12, 0.01],
        glint: 0.3,
        parts,
        features: true,
      });
      // The waves (hidden until a tap): thin bright rings of sparkling ice,
      // built at the outer edge and grown out from the inner edge.
      for (let i = 0; i < 2; i++) {
        k.cloud({ share: 0.022, size: 1.3, pattern: false, part: k.part(`wave${i}`) }, (rand) => {
          const a = rand() * TAU;
          const r = 2.3 * (1 + 0.01 * gauss(rand));
          const lp = [r * Math.cos(a), 0.006 * gauss(rand), r * Math.sin(a)];
          return {
            p: quatRotate(q, lp),
            color: mix("#fff6dc", "#ffffff", rand()),
            opacity: 0.6,
            size: 0.7 + 0.6 * rand(),
            kind: "twinkle",
            params: [0.4, rand() * TAU],
          };
        });
      }
    },
  },

  uranus: {
    alive: true,
    controls: [{ key: "roll", label: "Roll", type: "pulse", ease: 3.8 }],
    action: { key: "roll", label: "Roll on its side" },
    // Its thin rings turn slowly all the time (bright clumps show it). Uranus
    // lies on its side, so a tap rolls it like a wheel: to the right, a
    // moment's pause, and back.
    drive(t, c, out) {
      out.parts.rings = { angle: ringAngle(t * 0.14) };
      const p = progress(c.roll);
      const x = 0.55 * (ease(band(p, 0, 0.44)) - ease(band(p, 0.54, 1)));
      const f = camFrame(0.55, 0.28);
      out.body = { offset: mul(f.right, x), quat: quatAxisAngle(f.c, -x / 0.57) };
    },
    build(k) {
      const noise = k.noise;
      // Tipped over: the pole points almost at the viewer.
      const q = faceCamera(44 * DEG, 28 * DEG);
      globe(k, {
        quat: q,
        share: 0.8,
        core: layers(["#5a5a70", "#4a8aa0", "#8fd0dc", "#b0e4ea"]),
        col: (c, d) => {
          const y = d[1] + 0.02 * noise.fbm(d[0] * 3, d[1] * 12, d[2] * 3, 3);
          let col = mix("#8fd3df", "#c3eff1", smoothstep(0.3, 0.85, y));
          col = mix(col, "#7cc2d4", smoothstep(-0.2, -0.7, y) * 0.6);
          return lit(
            shade(col, 1 + 0.04 * Math.sin(y * 40) + 0.03 * noise(d[0] * 8, d[1] * 30, d[2] * 8)),
            c.n,
            0.3,
          );
        },
      });
      // Narrow rings with brighter arcs, so their turning shows; the outer
      // (epsilon) ring swells and narrows. Like Saturn's, the pattern
      // repeats every RING_PERIOD.
      const arcs = (r, c, seed) => {
        const a = Math.atan2(c.lp[2], c.lp[0]);
        return shade("#c8d6dc", 0.8 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(a * 8 + seed), 6));
      };
      const ring = (r0, r1, op, share, seed) => [r0, r1, op, (r, c) => arcs(r, c, seed), share];
      rings(
        k,
        [
          ring(1.42, 1.43, 0.5, 0.012, 0.5),
          ring(1.47, 1.48, 0.5, 0.012, 2.1),
          ring(1.52, 1.535, 0.55, 0.014, 4),
          ring(1.58, 1.59, 0.5, 0.012, 1.2),
          [
            1.68,
            1.76,
            0.75,
            (r, c) => {
              const a = Math.atan2(c.lp[2], c.lp[0]);
              if (r > 1.725 + 0.03 * Math.cos(a * 8)) return null;
              return arcs(r, c, 0.3);
            },
            0.05,
          ],
        ],
        {
          quat: q,
          flat: 0.1,
          glint: 0.3,
          part: k.part("rings", { axis: quatRotate(q, [0, 1, 0]) }),
        },
      );
    },
  },

  neptune: {
    controls: [{ key: "winds", label: "Winds", type: "pulse", ease: 3.8 }],
    action: { key: "winds", label: "Race the clouds" },
    // Neptune has the fastest winds of any planet. A tap sends the bands of
    // high white clouds racing round it twice, while the band with the dark
    // storm and its white companion drifts the other way, once round.
    drive(t, c, out) {
      const u = ease(band(progress(c.winds), 0, 1));
      const cull = c.winds > 0;
      const visible = cull ? CULLED_SIZE : 1;
      NEPTUNE_BANDS.forEach((b, i) => {
        if (b.turns) spinParts(out, `band${i}`, TAU * b.turns * u, { cull, visible });
      });
      out.parts.still = { cull, visible };
      out.parts.core = { visible: c.winds > 0 ? 0 : 1 };
    },
    build(k) {
      const noise = k.noise;
      const q = quatEuler(0, 0, -28);
      const lon0 = 0.5;
      const axis = quatRotate(q, [0, 1, 0]);
      coreBall(k, { quat: q, col: layers(["#5a5a70", "#3a5aa0", "#3a64d0", "#4a70dc"]) });
      const col = (c, d) => {
        const y = d[1] + 0.025 * noise.fbm(d[0] * 3, d[1] * 12, d[2] * 3, 3);
        let cl = bandAt(
          [
            [-1, "#2240a8"],
            [-0.7, "#2f55c8"],
            [-0.45, "#4474e0"],
            [-0.2, "#3660d6"],
            [0.15, "#3d69dc"],
            [0.45, "#4a78e2"],
            [0.75, "#2e52c4"],
            [1, "#2444a8"],
          ],
          y,
        );
        // The dark spot and its white companion clouds.
        const s = ovalDist(d, -0.36, lon0, 0.2, 0.1);
        if (s < 1) cl = mix("#152470", cl, smoothstep(0.55, 1, s));
        const w = ovalDist(d, -0.44, lon0 + 0.05, 0.18, 0.03);
        if (w < 1) cl = mix("#f2f7ff", cl, smoothstep(0.3, 1, w));
        const s2 = ovalDist(d, -0.95, lon0 + 1.2, 0.08, 0.05);
        if (s2 < 1) cl = mix("#1a2c80", cl, smoothstep(0.4, 1, s2));
        // High white cirrus streaks.
        const streak = noise(d[0] * 2.5 + 7, d[1] * 22, d[2] * 2.5);
        const lat = latOf(d);
        const zone =
          Math.exp(-(((lat + 0.62) / 0.07) ** 2)) + Math.exp(-(((lat - 0.42) / 0.06) ** 2)) * 0.8;
        cl = mix(cl, "#eef4ff", clamp01(smoothstep(0.18, 0.4, streak) * zone));
        return lit(cl, c.n, 0.3);
      };
      const still = k.part("still", { axis });
      NEPTUNE_BANDS.forEach((b, i) => {
        const shell = { y0: b.y0, y1: b.y1, quat: q, col, grid: 64 };
        bandShell(k, { ...shell, part: b.turns ? k.part(`band${i}`, { axis }) : still });
        if (b.turns)
          bandShell(k, { ...shell, part: k.part(`band${i}B`, { axis }), turn: axis, ...TURNED });
      });
      halo(k, {
        r0: 1,
        r1: 1.06,
        share: 0.03,
        size: 2,
        opacity: 0.14,
        falloff: 1.3,
        col: (t) => mix("#9ab8ff", "#4a70ff", t),
      });
    },
  },
  asteroid: {
    controls: [{ key: "shatter", label: "Break up", type: "pulse", ease: 5.4 }],
    action: { key: "shatter", label: "Break it apart" },
    // A tap cracks it (glowing cracks flash over it), it falls apart into
    // its pieces, which drift off tumbling, each on its own path, with a
    // puff of dust; then gravity pulls the rubble back together and it
    // settles with a bump. The pieces are cells round points inside the
    // rock, each a token that moves on its own; their broken faces are
    // fresh, paler rock.
    drive(t, c, out) {
      const p = progress(c.shatter);
      const on = c.shatter > 0 ? 1 : 0;
      const apart = on * ease(band(p, 0.1, 0.42)) * (1 - ease(band(p, 0.54, 0.86)));
      const settle = on * 0.035 * Math.sin(band(p, 0.86, 1) * Math.PI) * (1 - band(p, 0.86, 1));
      out.tokens = ASTEROID_CELLS.map((cell) => ({
        base: cell.c,
        offset: mul(cell.dir, apart * cell.dist - settle),
        quat: quatAxisAngle(cell.axis, apart * cell.spin),
      }));
      out.parts.cracks = { visible: on * 1.4 * bump(p, 0, 0.03, 0.09, 0.16) };
      out.parts.dust = {
        scale: 0.7 + 0.9 * easeOut(band(p, 0.08, 0.5)),
        visible: on * 0.9 * bump(p, 0.08, 0.14, 0.3, 0.55),
      };
    },
    build(k) {
      const noise = k.noise;
      const craters = craterField(k.rand, {
        count: 70,
        min: 0.05,
        max: 0.32,
        power: 1.8,
        depth: 0.26,
        rim: 0.06,
      });
      const lumps = tabulate((d) => {
        const lump = noise.fbm(d[0] * 1.1 + 2, d[1] * 1.1, d[2] * 1.1, 3);
        return 1 + 0.2 * lump + 0.04 * noise.fbm(d[0] * 4, d[1] * 4, d[2] * 4, 2);
      });
      const shapeR = (d) => lumps(d) / Math.hypot(d[0] / 1.45, d[1] / 0.82, d[2] / 0.95);
      const cells = ASTEROID_CELLS;
      // The nearest two cell centres to p: [index, bisector distance].
      const nearest = (p) => {
        let i1 = 0;
        let i2 = 0;
        let d1 = Infinity;
        let d2 = Infinity;
        for (let i = 0; i < cells.length; i++) {
          const c = cells[i].c;
          const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
          if (d < d1) {
            d2 = d1;
            i2 = i1;
            d1 = d;
            i1 = i;
          } else if (d < d2) {
            d2 = d;
            i2 = i;
          }
        }
        return [i1, (d2 - d1) / (2 * len(sub(cells[i2].c, cells[i1].c))), i2];
      };
      rockyBody(k, {
        craters,
        shapeR,
        grid: 120,
        core: layers(["#5a5048", "#6e655c", "#7d746a"], 1.2),
        litAmount: 0.6,
        reliefAmount: 1.2,
        kind: "token",
        params: (c) => [nearest(c.p)[0], 0],
        albedo: (c, d) => {
          const tone = noise.fbm(d[0] * 2.5 + 9, d[1] * 2.5, d[2] * 2.5, 3);
          const col = mix("#7a7064", "#a09584", clamp01(0.5 + tone * 2.5));
          return shade(col, 1 + 0.1 * c.noise(d[0] * 30, d[1] * 30, d[2] * 30));
        },
      });
      // The broken faces between the pieces (inside until it breaks).
      k.cloud({ share: 0.07, size: 1.1, pattern: false, kind: "token" }, (rand) => {
        for (let tries = 0; tries < 40; tries++) {
          const d = randDir(rand);
          const p = mul(d, shapeR(d) * 0.97 * Math.cbrt(rand()));
          const [i1, gap, i2] = nearest(p);
          if (gap > 0.012) continue;
          const n = unit(sub(cells[i2].c, cells[i1].c));
          const tone = 0.5 + 0.5 * noise(p[0] * 9, p[1] * 9, p[2] * 9);
          const col = mix("#8a7f70", "#b8ad9a", tone);
          return {
            p,
            n,
            flat: 0.15,
            color: lit(rand() < 0.04 ? "#e4ddcc" : col, n, 0.5),
            opacity: 0.95,
            params: [i1, 0],
          };
        }
        return null;
      });
      // Cracks (hidden until a tap): hot lines where the pieces will part.
      k.cloud({ share: 0.012, size: 0.8, pattern: false, part: k.part("cracks") }, (rand) => {
        for (let tries = 0; tries < 40; tries++) {
          const d = randDir(rand);
          const p = mul(d, shapeR(d) * (1 + craters.height(d)) + 0.015);
          if (nearest(p)[1] > 0.018) continue;
          return {
            p,
            color: mix("#ffd27a", "#ff7a2a", rand()),
            opacity: 0.95,
          };
        }
        return null;
      });
      // A puff of dust (hidden until a tap).
      k.cloud({ share: 0.02, size: 3.2, pattern: false, part: k.part("dust") }, (rand) => {
        const d = randDir(rand);
        return {
          p: mul(d, shapeR(d) * (0.9 + 0.25 * rand())),
          color: mix("#6a625a", "#9a9084", rand()),
          opacity: 0.12,
        };
      });
    },
  },

  "spiral-galaxy": {
    alive: true,
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "milky-way",
        choices: [
          { id: "milky-way", label: "Milky Way-like" },
          { id: "andromeda", label: "Andromeda-like" },
        ],
      },
    ],
    controls: [{ key: "swirl", label: "Swirl", type: "pulse", ease: 4.6 }],
    action: { key: "swirl", label: "Swirl the arms" },
    // The spiral pattern turns slowly all the time, as one piece (the arms
    // are waves the stars pass through, so they keep their shape), while
    // the disc's stars orbit, faster inside. A tap swirls the arms round
    // once more, fast, and the core flares.
    drive(t, c, out) {
      const p = progress(c.swirl);
      const on = c.swirl > 0 ? 1 : 0;
      const spin = quatAxisAngle([0, 1, 0], 0.09 * t + on * TAU * ease(band(p, 0, 0.8)));
      const flare = on * bump(p, 0.04, 0.2, 0.45, 0.9);
      const bulge = { scale: 1 + 0.12 * flare };
      // The Andromeda-like style's parts end in A: its disc is tilted after
      // the stars orbit and the arms turn in it.
      out.parts.tilt = { quat: ANDROMEDA_TILT };
      out.parts.arms = { quat: spin };
      out.parts.armsA = { quat: quatMul(ANDROMEDA_TILT, spin) };
      out.parts.bulge = bulge;
      out.parts.bulgeA = { ...bulge, quat: ANDROMEDA_TILT };
      out.parts.flare = { visible: 1.6 * flare, scale: 0.8 + 0.4 * flare };
      out.parts.flareA = { visible: 1.6 * flare, scale: 0.8 + 0.4 * flare, quat: ANDROMEDA_TILT };
    },
    build(k, o) {
      const andro = o.style === "andromeda";
      const S = budgetScale(k);
      const s2 = Math.sqrt(S);
      const part = andro ? k.part("tilt") : 0;
      const armPart = k.part(andro ? "armsA" : "arms");
      const bulgePart = k.part(andro ? "bulgeA" : "bulge");
      const RATE = 0.035;
      const K = 1 / Math.tan((andro ? 9 : 13) * DEG);
      const r0 = andro ? 0.26 : 0.2;
      const phase0 = 0.5;
      const arms = andro ? [0, Math.PI] : [0, Math.PI, Math.PI / 2, 1.5 * Math.PI];
      const armW = andro ? [1, 1] : [1, 1, 0.4, 0.4];
      const armSum = armW.reduce((a, b) => a + b, 0);
      const pickArm = (rand) => {
        let x = rand() * armSum;
        for (let i = 0; i < armW.length; i++) {
          if (x < armW[i]) return i;
          x -= armW[i];
        }
        return 0;
      };
      const armAt = (i, r) => phase0 + arms[i] - K * Math.log(r / r0);
      const at = (r, th, y = 0) => [r * Math.cos(th), y, -r * Math.sin(th)];
      // A point on an arm: the spread across it grows outwards; `inward`
      // shifts it to the arm's inner edge (dust lanes).
      const onArm = (rand, spread, inward = 0) => {
        const i = pickArm(rand);
        const t = Math.pow(rand(), 0.8);
        const r = r0 + (1 - r0) * t;
        const w = spread * (0.6 + t);
        const rr = r - inward * (0.5 + t) + gauss(rand) * w;
        return at(rr, armAt(i, r) + (gauss(rand) * w) / r, gauss(rand) * 0.01);
      };
      const orbit = (fall) => [RATE, fall];
      const cloud = (share, fall, fn, where = part) =>
        k.cloud({ share, pattern: false, part: where, kind: "orbit", params: orbit(fall) }, fn);
      // The arms, their dust and knots turn together as one pattern.
      const armCloud = (share, fn) => k.cloud({ share, pattern: false, part: armPart }, fn);

      // Unresolved starlight: a soft glow over the disc and bulge.
      cloud(andro ? 0.1 : 0.07, 1, (rand) => {
        const r = Math.min(1.05, -(andro ? 0.3 : 0.26) * Math.log(1 - rand() * 0.97));
        return {
          p: at(r, rand() * TAU, gauss(rand) * 0.02),
          n: [0, 1, 0],
          flat: 0.4,
          color: mix("#ffe2b0", andro ? "#d8d4f0" : "#b8c8ff", smoothstep(0.1, 0.6, r)),
          opacity: 0.1,
          size: 7 * S,
        };
      });
      // The disc's older stars.
      cloud(0.16, 1, (rand) => {
        const r = Math.min(1.08, -0.3 * Math.log(1 - rand() * 0.97));
        return {
          p: at(r, rand() * TAU, gauss(rand) * 0.02),
          color: mix("#ffe9c4", "#d6dcff", smoothstep(0.1, 0.7, r) * rand()),
          opacity: 0.55,
          size: (0.6 + 0.6 * rand()) * s2,
        };
      });
      // The bulge: warm old stars, brightest in the middle.
      const bs = andro ? [0.11, 0.075] : [0.085, 0.055];
      cloud(
        andro ? 0.12 : 0.09,
        1,
        (rand) => {
          const p = [gauss(rand) * bs[0], gauss(rand) * bs[1], gauss(rand) * bs[0]];
          const r = len(p) / (bs[0] * 2.5);
          return {
            p,
            color: andro
              ? ramp(["#fffaf0", "#ffe8c0", "#f0c890"], clamp01(r))
              : ramp(["#fff8e8", "#ffdca0", "#f2b46a"], clamp01(r)),
            opacity: andro ? 0.22 : 0.45,
            size: (1 + rand()) * s2 * 1.2,
          };
        },
        bulgePart,
      );
      if (!andro) {
        // The bar, turning as one piece with the arms.
        armCloud(0.05, (rand) => {
          const u = (rand() * 2 - 1) * (r0 + 0.03);
          return {
            p: add(at(u, phase0), [gauss(rand) * 0.035, gauss(rand) * 0.02, gauss(rand) * 0.035]),
            color: mix("#ffdca0", "#ffc27a", rand()),
            opacity: 0.5,
            size: (1 + rand()) * s2 * 1.2,
          };
        });
      }
      // Blue-white stars along the arms.
      armCloud(andro ? 0.26 : 0.36, (rand) => {
        const x = rand();
        return {
          p: onArm(rand, andro ? 0.035 : 0.04),
          color: x < 0.55 ? mix("#7fa4ff", "#b0c8ff", rand()) : x < 0.85 ? "#e8eeff" : "#ffe0b0",
          opacity: 0.8,
          size: (0.7 + 0.8 * rand()) * s2,
        };
      });
      // Dark dust lanes along the inner edges of the arms.
      armCloud(andro ? 0.12 : 0.08, (rand) => ({
        p: add(onArm(rand, 0.014, 0.032), [0, 0.012, 0]),
        n: [0, 1, 0],
        flat: 0.25,
        color: mix("#3a2214", "#5a3a24", rand()),
        opacity: andro ? 0.4 : 0.32,
        size: (1 + 0.8 * rand()) * S,
      }));
      // Pink star-forming knots and young blue clusters on the arms.
      const knots = [];
      for (let j = 0; j < 70; j++) {
        const i = pickArm(k.rand);
        const r = r0 + 0.08 + (0.92 - r0) * k.rand();
        knots.push({ p: at(r, armAt(i, r) + (k.rand() - 0.5) * 0.12, 0), pink: k.rand() < 0.6 });
      }
      armCloud(0.05, (rand) => {
        const n = knots[Math.floor(rand() * knots.length)];
        const w = n.pink ? 0.014 : 0.01;
        return {
          p: add(n.p, [gauss(rand) * w, gauss(rand) * 0.005, gauss(rand) * w]),
          color: n.pink ? mix("#ff4f9a", "#ff8ac0", rand()) : mix("#8fb8ff", "#e0ecff", rand()),
          opacity: 0.85,
          size: (0.8 + 0.8 * rand()) * s2,
        };
      });
      if (andro) {
        // Two small companion galaxies.
        const blob = (c, s, share) =>
          k.cloud({ share, pattern: false, part }, (rand) => ({
            p: add(c, [gauss(rand) * s[0], gauss(rand) * s[1], gauss(rand) * s[2]]),
            color: mix("#fff4dc", "#ffd8a8", rand()),
            opacity: 0.18,
            size: (0.8 + rand()) * s2,
          }));
        blob([0.34, 0.06, 0.3], [0.02, 0.02, 0.02], 0.008);
        blob([-0.7, 0.12, -0.28], [0.05, 0.02, 0.025], 0.01);
      }
      // The core's flare (hidden until a tap): a hot white glow.
      k.cloud({ share: 0.02, pattern: false, part: k.part(andro ? "flareA" : "flare") }, (rand) => {
        const t = Math.pow(rand(), 1.5);
        return {
          p: mul(randDir(rand), 0.2 * t),
          color: mix("#ffffff", "#ffd890", t),
          opacity: 0.35 * (1 - t) + 0.05,
          size: (2.2 + 1.5 * t) * S,
        };
      });
    },
  },

  nebula: {
    alive: true,
    controls: [{ key: "ignite", label: "New stars", type: "pulse", ease: 6.5 }],
    action: { key: "ignite", label: "Light new stars" },
    // A tap lights new stars in the clouds, one after another: each flares
    // up with a burst of spikes, settles to a bright point in a small glow
    // of gas it has lit, and after a while they fade back.
    drive(t, c, out) {
      const p = progress(c.ignite);
      const on = c.ignite > 0 ? 1 : 0;
      for (let i = 0; i < NEBULA_BIRTHS; i++) {
        const t0 = 0.03 + i * 0.055;
        const lit = ease(band(p, t0, t0 + 0.05));
        const flash = bump(p, t0 + 0.02, t0 + 0.045, t0 + 0.06, t0 + 0.16);
        out.parts[`birth${i}`] = {
          scale: 0.1 + 0.9 * lit + 0.35 * flash,
          visible: on * (lit + 1.2 * flash) * (1 - band(p, 0.78, 1)),
        };
      }
    },
    options: [
      {
        key: "palette",
        label: "Colours",
        type: "select",
        default: "emission",
        choices: [
          { id: "emission", label: "Pink and teal" },
          { id: "hubble", label: "Gold and teal" },
          { id: "crimson", label: "Crimson" },
          { id: "ice", label: "Blue ice" },
        ],
      },
    ],
    build(k, o) {
      const P = NEBULA_PALETTES[o.palette] || NEBULA_PALETTES.emission;
      const noise = k.noise;
      const S = budgetScale(k);
      const W = 1.5;
      const H = 1.1;
      const D = 0.45;
      // The hot young stars that light the cloud sit in a hollow here.
      const C = [0.15, 0.3, -0.05];
      const field = (x, y, z) => {
        const w = noise.fbm(x * 0.7 + 11, y * 0.7, z * 0.7, 2);
        return noise.fbm(x * 1.3 + w * 1.5, y * 1.3 - w, z * 1.3 + w * 0.5, 4);
      };
      // Glowing gas.
      k.cloud({ share: 0.66, pattern: false }, (rand) => {
        for (let tries = 0; tries < 10; tries++) {
          const x = (rand() * 2 - 1) * W;
          const y = (rand() * 2 - 1) * H;
          const z = (rand() * 2 - 1) * D;
          const f = field(x, y, z);
          const e = Math.abs(x / W) ** 3 + Math.abs(y / H) ** 3 + (z / D) ** 2;
          const env = 1 - smoothstep(0.35, 1, e + 0.8 * f);
          if (env <= 0) continue;
          const dc = Math.hypot(x - C[0], (y - C[1]) * 1.2, z - C[2]);
          const hollow = smoothstep(0.1, 0.45, dc);
          const dens = (0.2 + 0.8 * smoothstep(-0.12, 0.2, f)) * env * (0.35 + 0.65 * hollow);
          if (rand() > dens) continue;
          const m = noise.fbm(x * 0.9 + 30, y * 0.9, z * 0.9, 3);
          let col = ramp([P.core, P.mid, P.edge], clamp01(dc * 0.55 + m * 2));
          col = mix(col, P.deep, clamp01(-f * 4) * 0.45);
          // Bright walls where the field folds.
          const ridge = 1 - smoothstep(0, 0.05, Math.abs(noise(x * 2 + 5, y * 2, z * 2)));
          col = mix(col, P.rim, ridge * 0.45);
          return {
            p: [x, y, z],
            color: shade(col, 0.85 + 0.3 * dens + 0.2 * ridge),
            opacity: 0.06 + 0.12 * dens,
            size: (2.2 + 2.8 * rand()) * S,
          };
        }
        return null;
      });
      // Dark pillars of dust rising from a ridge along the bottom, lit from
      // behind: dark cores, thin glowing rims on the side facing the stars,
      // and wisps boiling off their tips.
      const pillars = [
        { x: -0.62, z: 0.28, top: 0.42, r: 0.13, lean: 0.26, w: 0.4 },
        { x: -0.06, z: 0.34, top: 0.12, r: 0.1, lean: 0.1, w: 0.32 },
        { x: 0.55, z: 0.26, top: -0.18, r: 0.085, lean: -0.16, w: 0.2 },
        { x: 0, z: 0.3, top: -0.78, r: 0.9, lean: 0, w: 0.08, ridge: true },
      ];
      const pillarAt = (rand) => {
        let x = rand();
        for (const q of pillars) {
          if (x < q.w) return q;
          x -= q.w;
        }
        return pillars[0];
      };
      const axisOf = (pl, t) => pl.x + pl.lean * t * t + 0.035 * Math.sin(t * 7 + pl.x * 5);
      k.cloud({ share: 0.18, pattern: false }, (rand) => {
        const pl = pillarAt(rand);
        const t = Math.pow(rand(), 0.8);
        let y = -H - 0.05 + (pl.top + H + 0.05) * t;
        let rad;
        let cx;
        if (pl.ridge) {
          // A low, lumpy ridge joining the feet of the pillars, fading out
          // at the ends.
          cx = (rand() * 2 - 1) * 1.2;
          const hgt = (0.14 + 0.1 * noise(cx * 3, 4, 1)) * (1 - (cx / 1.25) ** 2);
          y = -H - 0.02 + hgt * Math.sqrt(rand());
          rad = 0.1;
        } else {
          cx = axisOf(pl, t);
          const head = 1 + 0.45 * Math.exp(-(((t - 0.9) / 0.06) ** 2));
          const cap = t > 0.93 ? Math.sqrt(Math.max(0, 1 - ((t - 0.93) / 0.07) ** 2)) : 1;
          rad = pl.r * (1.35 - 0.7 * t) * head * cap * (1 + 0.3 * noise(y * 7, pl.x * 4, 2));
        }
        const a = rand() * TAU;
        const u = Math.sqrt(rand());
        const p = [cx + Math.cos(a) * rad * u, y, pl.z + Math.sin(a) * rad * u * 0.7];
        // Rims facing the stars glow; the rest is dark dust.
        const toC = C[0] > p[0] ? 1 : -1;
        const facing = smoothstep(0.35, 0.9, Math.cos(a) * toC);
        const edge = smoothstep(0.9, 1, u);
        const tip = smoothstep(0.95, 1, t) * smoothstep(0.6, 1, u);
        const rim = pl.ridge ? 0 : clamp01(edge * facing + tip * 0.6);
        return {
          p,
          color: mix(mix("#0d0704", "#231208", rand()), P.rim, rim * 0.75),
          opacity: 0.75 - 0.35 * edge + 0.2 * rim,
          size: (0.9 + 0.8 * rand()) * S,
        };
      });
      // Glowing wisps boiling off the pillar tips.
      k.cloud({ share: 0.02, pattern: false, kind: "twinkle" }, (rand) => {
        const pl = pillars[Math.floor(rand() * 3)];
        const s = rand();
        return {
          p: [
            axisOf(pl, 1) + gauss(rand) * 0.06,
            pl.top + 0.02 + 0.12 * s,
            pl.z + gauss(rand) * 0.04,
          ],
          color: mix(P.rim, "#ffffff", 0.3 * rand()),
          opacity: 0.12 * (1 - s),
          size: (1 + rand()) * S,
          params: [0.3, rand() * TAU],
        };
      });
      // The young star cluster in the hollow.
      k.cloud({ share: 0.012, pattern: false, kind: "twinkle" }, (rand) => ({
        p: add(C, [gauss(rand) * 0.1, gauss(rand) * 0.08, gauss(rand) * 0.08]),
        color: mix("#ffffff", "#bcd4ff", rand()),
        opacity: 0.95,
        size: (0.9 + 1.4 * rand() * rand()) * Math.sqrt(S),
        params: [0.5, rand() * TAU],
      }));
      halo(k, {
        center: C,
        r0: 0,
        r1: 0.3,
        share: 0.01,
        size: 3 * S,
        opacity: 0.25,
        falloff: 1.5,
        col: (t) => mix("#ffffff", P.core, t),
      });
      // Scattered stars.
      k.cloud({ share: 0.006, pattern: false, kind: "twinkle" }, (rand) => ({
        p: [(rand() * 2 - 1) * W * 0.95, (rand() * 2 - 1) * H * 0.95, (rand() * 2 - 1) * D],
        color: ["#ffffff", "#cfe0ff", "#fff0c8", "#ffd6a0"][Math.floor(rand() * 4)],
        opacity: 0.9,
        size: (0.7 + 0.5 * rand()) * Math.sqrt(S),
        params: [0.6, rand() * TAU],
      }));
      // New stars (hidden until a tap): at the pillar tips and in the
      // thicker clouds. Each is a white point, four spikes and a small glow
      // of the gas round it, grown from its own middle.
      const sites = [
        ...pillars.slice(0, 3).map((pl) => [axisOf(pl, 1), pl.top + 0.03, pl.z + 0.06]),
        [-1.02, 0.55, 0.12],
        [0.9, 0.62, 0.08],
        [1.0, -0.38, 0.12],
        [-0.3, 0.78, 0.1],
      ];
      sites.slice(0, NEBULA_BIRTHS).forEach((at, i) => {
        const part = k.part(`birth${i}`, { pivot: at });
        k.cloud({ share: 0.004, pattern: false, part }, (rand) => ({
          p: add(at, mul(randDir(rand), 0.022 * Math.cbrt(rand()))),
          color: "#ffffff",
          opacity: 1,
          size: 0.9 * Math.sqrt(S),
        }));
        k.cloud({ share: 0.004, pattern: false, part }, (rand) => {
          const d = [
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
          ][Math.floor(rand() * 4)];
          const u = Math.pow(rand(), 1.3);
          return {
            p: add(at, add(mul(d, 0.02 + 0.2 * u), [0, 0, 0.04])),
            dir: d,
            stretch: 4,
            color: mix("#ffffff", "#cfe0ff", u),
            opacity: 0.9 * (1 - u) + 0.05,
            size: 0.8 * (1 - 0.6 * u) * Math.sqrt(S),
          };
        });
        halo(k, {
          part,
          center: at,
          r0: 0.02,
          r1: 0.16,
          share: 0.006,
          size: 2.2 * S,
          opacity: 0.22,
          falloff: 1.6,
          col: (t) => mix("#ffffff", P.core, 0.3 + 0.7 * t),
        });
      });
    },
  },

  "solar-system": {
    alive: true,
    controls: [{ key: "align", label: "Line up", type: "pulse", ease: 7 }],
    action: { key: "align", label: "Line up the planets" },
    // A tap swings every planet forward round its orbit into one straight
    // row beside the Sun. The system tips until we look along its plane;
    // Mercury, the fastest, swings on in front of the Sun as a dark dot
    // (a transit) and a pearly eclipse corona flares round the Sun. Then
    // it tips back and the planets swing on round their orbits to where
    // they would have been, spread out again. Mercury is lit from the Sun
    // and turns as it orbits, so its dark side faces us as it crosses.
    // The orbits are spaced so that even in the row no two planets touch
    // (the inner three swell a little there, and Mercury more as it
    // crosses the Sun, once it has left the row).
    drive(t, c, out) {
      const m = mem(c);
      if (!m.off) m.off = ORRERY.map(() => 0);
      const p = progress(c.align);
      const on = c.align > 0;
      const rest = (i) => ORRERY[i].phase + ORRERY[i].w * t + m.off[i];
      if (fired(m, "align", c.align)) {
        m.start = ORRERY.map((P, i) => (m.th ? m.th[i] : rest(i)));
        m.go = m.start.map((th) => (((SS.row - th) % TAU) + TAU) % TAU);
        m.resumed = false;
      }
      // From here the planets swing on from the row to where they would
      // have been without the tap (forward, less than a turn each).
      const RESUME = 0.64;
      if (on && m.start && p >= RESUME && !m.resumed) {
        m.resumed = true;
        m.from = m.th.slice();
        m.rest0 = ORRERY.map((P, i) => rest(i));
        m.back = m.from.map((th, i) => (((m.rest0[i] - th) % TAU) + TAU) % TAU);
      }
      m.th = ORRERY.map((P, i) => {
        if (!on || !m.start) return rest(i);
        if (p >= RESUME) {
          const e = ease(band(p, 0.68, 0.98));
          return m.from[i] + e * (m.back[i] + rest(i) - m.rest0[i]);
        }
        const th = m.start[i] + ease(band(p, 0, 0.3)) * m.go[i];
        return i === 0 ? th + SS.transit * ease(band(p, 0.38, 0.56)) : th;
      });
      const big = on ? ease(band(p, 0.04, 0.26)) * (1 - ease(band(p, 0.7, 0.86))) : 0;
      const crossing = on ? ease(band(p, 0.4, 0.5)) * (1 - ease(band(p, 0.62, 0.72))) : 0;
      ORRERY.forEach((P, i) => {
        const th = m.th[i];
        const b = P.build;
        const offset = [P.r * (Math.sin(th) - Math.sin(b)), 0, P.r * (Math.cos(th) - Math.cos(b))];
        // While lined up the small inner planets swell a little so they
        // read, and Mercury more while it crosses the Sun.
        const scale = 1 + (i === 0 ? 1.5 * crossing : P.swell * big);
        if (i === 0) spinParts(out, P.id, th - b, { offset, scale });
        else out.parts[P.id] = { offset, scale };
      });
      const tip = on ? ease(band(p, 0.28, 0.4)) * (1 - ease(band(p, 0.66, 0.8))) : 0;
      out.body = { quat: quatAxisAngle(SS.tipAxis, SS.tipAngle * tip) };
      const eclipse = on ? bump(p, 0.47, 0.53, 0.6, 0.68) : 0;
      out.parts.corona = { visible: 1.2 * eclipse, scale: 0.8 + 0.2 * eclipse };
      out.parts.sunGlow = { visible: 1 + 0.5 * eclipse };
    },
    build(k) {
      // Every shape here has a fixed share with its own splat size: the
      // planets are tiny next to their orbits, and density-based sizes
      // would make their splats too small to see.
      const noise = k.noise;
      const S = budgetScale(k);
      const sun = globe(k, {
        r: 0.18,
        share: 0.12,
        flat: 0.4,
        interior: 0.1,
        core: layers(["#fffbe8", "#ffd060", "#ff9020"], 0.18),
        kind: "twinkle",
        params: (c) => [0.15, c.rand() * TAU],
        col: (c, d) => {
          const g = smoothstep(0, 0.2, Math.abs(c.noise(d[0] * 12, d[1] * 12, d[2] * 12)));
          return mix("#ff8a14", "#ffe070", 0.35 + 0.65 * g);
        },
      });
      sun.opts.pattern = false;
      halo(k, {
        part: k.part("sunGlow"),
        r0: 0.175,
        r1: 0.29,
        share: 0.05,
        size: 2.2 * S,
        opacity: 0.3,
        falloff: 1.6,
        twinkle: 0.2,
        col: (t) => mix("#ffc24a", "#ff7a1a", t),
      });
      // Orbits.
      for (const P of ORRERY) {
        k.cloud({ share: 0.01 + 0.012 * P.r, size: 0.45 * S, pattern: false }, (rand) => {
          const a = rand() * TAU;
          return { p: [P.r * Math.sin(a), 0, P.r * Math.cos(a)], color: "#8ea6cc", opacity: 0.55 };
        });
      }
      // The asteroid belt.
      k.cloud(
        { share: 0.012, size: 0.35 * S, pattern: false, kind: "orbit", params: [0.05, 1.5] },
        (rand) => {
          const r = 0.86 + 0.05 * rand();
          const a = rand() * TAU;
          return {
            p: [r * Math.sin(a), gauss(rand) * 0.01, r * Math.cos(a)],
            color: mix("#8a8076", "#b8ac9c", rand()),
            opacity: 0.6,
          };
        },
      );
      // The planets, each a part that travels round its orbit.
      const looks = {
        mercury: (c, d) => shade("#a09789", 1 + 0.15 * c.noise(d[0] * 6, d[1] * 6, d[2] * 6)),
        venus: (c, d) => mix("#e2c68a", "#f5e6be", 0.5 + c.noise(d[0] * 3, d[1] * 8, d[2] * 3)),
        earth: earthSurface(noise),
        mars: (c, d) =>
          Math.abs(d[1]) > 0.86
            ? "#f4eee6"
            : mix("#d0602e", "#8a3a20", smoothstep(0, 0.2, c.noise(d[0] * 3, d[1] * 3, d[2] * 3))),
        jupiter: jupiterSurface(noise, { lon0: 0.4 }),
        saturn: saturnSurface(noise),
        uranus: (c, d) => mix("#8fd3df", "#c3eff1", smoothstep(0, 1, d[1])),
        neptune: (c, d) => mix("#2f55c8", "#4a78e2", 0.5 + c.noise(d[0] * 2, d[1] * 8, d[2] * 2)),
      };
      const saturnTilt = faceCamera(16 * DEG, -12 * DEG, 0.55, 0.62);
      for (const P of ORRERY) {
        // Each planet is built at P.build (for Mercury, in front of the Sun,
        // so it draws over it as it crosses) and moved from there.
        const pos = [P.r * Math.sin(P.build), 0, P.r * Math.cos(P.build)];
        const part = k.part(P.id, { pivot: pos });
        const planet = {
          r: P.size,
          pos,
          part,
          quat: P.id === "saturn" ? saturnTilt : undefined,
          oblate: P.id === "saturn" ? 0.9 : P.id === "jupiter" ? 0.94 : 1,
          share: P.share,
          flat: 0.35,
          interior: 0,
          col: (c, d) => lit(looks[P.id](c, d), c.n, 0.4),
        };
        if (P.id === "mercury") {
          // Lit from the Sun: bright on the day side, dark on the night side.
          const toSun = unit(mul(pos, -1));
          planet.col = (c, d) =>
            shade(looks.mercury(c, d), 0.18 + 0.95 * smoothstep(-0.2, 0.35, dot(c.n, toSun)));
          globe(k, planet);
          globe(k, { ...planet, part: k.part("mercuryB", { pivot: pos }), turn: [0, 1, 0] });
          continue;
        }
        globe(k, planet);
        if (P.id === "saturn")
          saturnRings(k, noise, {
            R: P.size * 0.72,
            quat: saturnTilt,
            part,
            pos,
            shares: [0.004, 0.014, 0.009, 0.001],
          });
      }
      // The eclipse corona (hidden until a tap): pearly streamers round the
      // Sun, facing the viewer as the system is tipped.
      const [ce1, ce2] = basis(SS.eye);
      k.cloud({ share: 0.03, size: 1.1 * S, pattern: false, part: k.part("corona") }, (rand) => {
        const a = rand() * TAU;
        const ray = 0.6 + 0.4 * Math.pow(Math.abs(Math.cos(a * 2 + 0.4)), 3);
        const s = Math.pow(rand(), 1.6);
        const r = 0.185 + 0.34 * ray * s;
        const d = add(mul(ce1, Math.cos(a)), mul(ce2, Math.sin(a)));
        return {
          p: add(mul(d, r), mul(SS.eye, 0.05)),
          dir: d,
          stretch: 3,
          color: mix("#ffffff", "#b8d0ff", s),
          opacity: 0.6 * (1 - s) + 0.04,
          size: 0.8 + 0.8 * (1 - s),
        };
      });
      for (const x of [-1, 1]) {
        k.reach([1.8 * x, 0, 0]);
        k.reach([0, 0, 1.8 * x]);
      }
    },
  },

  comet: {
    alive: true,
    controls: [{ key: "flare", label: "Flare", type: "pulse", ease: 4.8 }],
    action: { key: "flare", label: "Swing past the Sun" },
    // A tap swings it past the Sun: jets of gas burst from the nucleus on
    // its sunward side, the coma swells, and both tails flare longer and
    // brighter as they swing round (a tail always points away from the
    // Sun), then it fades back.
    drive(t, c, out) {
      const p = progress(c.flare);
      const on = c.flare > 0 ? 1 : 0;
      const f = on * bump(p, 0.04, 0.32, 0.55, 0.96);
      const swing = on * 0.3 * Math.sin(Math.PI * ease(band(p, 0, 1)));
      const view = camDir();
      out.parts.ion = {
        quat: quatAxisAngle(view, swing),
        scale: 1 + 0.45 * f,
        visible: 1 + 0.5 * f,
      };
      out.parts.dust = {
        quat: quatAxisAngle(view, 0.8 * swing),
        scale: 1 + 0.35 * f,
        visible: 1 + 0.45 * f,
      };
      out.parts.coma = { scale: 1 + 0.9 * f, visible: 1 + 0.5 * f };
      out.parts.jets = {
        quat: quatAxisAngle(view, swing),
        scale: 0.6 + 0.6 * ease(band(p, 0.02, 0.2)),
        visible: on * 1.3 * bump(p, 0.02, 0.1, 0.45, 0.8),
      };
      out.amount = 1 + 1.6 * f;
    },
    build(k) {
      const noise = k.noise;
      const S = budgetScale(k);
      const f = camFrame();
      // The tails point away from the Sun: up and to the right on screen.
      // B is across the tails, in the picture plane.
      const T = unit(add(f.up, mul(f.right, 0.55)));
      const B = unit(cross(T, f.c));
      const L = 2.7;
      const R = 0.085;
      // The nucleus: a lumpy block of dirty ice, bright where the ice shows,
      // big enough to see inside the coma.
      const craters = craterField(k.rand, { count: 22, min: 0.1, max: 0.32, power: 1.5 });
      const nuc = rockyBody(k, {
        craters,
        grid: 64,
        scale: R,
        share: 0.06,
        shapeR: tabulate(
          (d) =>
            (1 / Math.hypot(d[0] / 1.3, d[1] / 0.85, d[2])) *
            (1 + 0.15 * noise.fbm(d[0] + 3, d[1], d[2], 3)),
          64,
          32,
        ),
        albedo: (c, d) => {
          const ice = smoothstep(-0.05, 0.25, c.noise(d[0] * 3.5, d[1] * 3.5, d[2] * 3.5));
          // The side facing the Sun (away from the tails) is lit.
          const sun = 0.75 + 0.35 * clamp01(-dot(d, T) * 0.8 + 0.4);
          return shade(mix("#8c8f96", "#f4fbff", ice), sun);
        },
        litAmount: 0.5,
        core: "#b8c4cc",
      });
      nuc.opts.size = coverSize(k, nuc.area, 0.06);
      nuc.opts.pattern = false;
      const coma = k.part("coma");
      const ion = k.part("ion");
      const dustTail = k.part("dust");
      // A tight bright glow hugging the nucleus.
      halo(k, {
        part: coma,
        r0: R * 1.05,
        r1: R * 2.2,
        share: 0.012,
        size: 1.2 * S,
        opacity: 0.16,
        falloff: 2,
        twinkle: 0.15,
        col: (t) => mix("#ffffff", "#c8fff2", t),
      });
      // The coma: a soft green-blue hood, pressed flat on the sunward side
      // and drawn out towards the tails. Faint enough to see the nucleus.
      k.cloud({ share: 0.05, pattern: false, kind: "twinkle", part: coma }, (rand) => {
        const t = Math.pow(rand(), 1.2);
        const d = randDir(rand);
        const toward = dot(d, T);
        const r = (R * 2.4 + 0.5 * t) * (toward < 0 ? 1 + 0.45 * toward : 1 + 0.6 * toward);
        return {
          p: mul(d, r),
          color: ramp(["#f2fffb", "#b4f5e2", "#6fd9cf", "#3aa6c0"], t),
          opacity: 0.03 * Math.pow(1 - t, 2) + 0.004,
          size: (2.2 + 3.5 * t) * S,
          params: [0.1, rand() * TAU],
        };
      });
      // The ion tail: straight, narrow and blue, in fine streamers with knots
      // of brighter gas along them.
      const rays = [];
      for (let r = 0; r < 11; r++)
        rays.push({ a: (r - 5) * 0.02 + gauss(k.rand) * 0.006, ph: k.rand() * TAU, w: k.rand() });
      k.cloud({ share: 0.22, pattern: false, kind: "rise", part: ion }, (rand) => {
        const s = Math.pow(rand(), 1.3);
        const ray = rays[Math.floor(rand() * rays.length)];
        const along = R + s * L;
        const off = ray.a * along + gauss(rand) * (0.002 + 0.004 * s);
        const knot = 0.55 + 0.45 * Math.sin(along * 7 + ray.ph) * Math.sin(along * 2.3 + ray.ph);
        return {
          p: add(mul(T, along), add(mul(B, off), mul(f.c, gauss(rand) * 0.004))),
          dir: T,
          stretch: 9,
          color: ramp(["#f4f8ff", "#a9c9ff", "#5b8cff", "#3446e6"], s),
          opacity: (0.22 * Math.pow(1 - s, 1.6) + 0.02) * (0.4 + 0.6 * ray.w) * knot,
          size: (0.45 + 0.3 * rand()) * S,
          params: [0.3, rand()],
        };
      });
      // A faint blue sheath around the streamers.
      k.cloud({ share: 0.04, pattern: false, kind: "rise", part: ion }, (rand) => {
        const s = rand();
        const along = R + s * L;
        return {
          p: add(mul(T, along), mul(B, gauss(rand) * (0.01 + 0.04 * s) * along)),
          dir: T,
          stretch: 5,
          color: mix("#8fb6ff", "#3d52e8", s),
          opacity: 0.05 * (1 - s),
          size: 1.6 * S,
          params: [0.3, rand()],
        };
      });
      // The dust tail: broad, pale gold and curving away, brightest and
      // sharpest along its outer edge, with faint striations across it.
      k.cloud({ share: 0.3, pattern: false, kind: "rise", part: dustTail }, (rand) => {
        const s = Math.pow(rand(), 1.1);
        const q = rand() * 2 - 1; // across the fan: +1 is the outer, curved edge
        const w = 0.03 + 0.42 * s;
        const c0 = add(mul(T, R + s * L * 0.8), mul(B, 0.34 * s * s * L));
        const p = add(c0, add(mul(B, q * w), mul(f.c, gauss(rand) * w * 0.08)));
        const edge = q > 0 ? smoothstep(1, 0.65, q) * (0.7 + 0.5 * q) : smoothstep(-1, 0.2, q);
        const stria = 0.45 + 0.55 * Math.cos(q * 7 + s * 6) ** 2;
        return {
          p,
          dir: unit(add(T, mul(B, 0.7 * s))),
          stretch: 2.5,
          color: ramp(["#fffaf0", "#fff0c4", "#f5d794", "#dcb070"], s),
          opacity: (0.11 * Math.pow(1 - s, 1.4) + 0.012) * edge * stria,
          size: (0.8 + 1.6 * s) * S,
          params: [0.12, rand()],
        };
      });
      // Jets (hidden until a tap): bright fans of gas thrown off the
      // sunward side of the nucleus, bending back into the tails.
      const jets = [
        unit(add(mul(T, -1), mul(B, 0.7))),
        unit(add(mul(T, -1), mul(B, -0.5))),
        unit(add(mul(T, -0.4), mul(B, 1))),
      ];
      k.cloud({ share: 0.012, pattern: false, part: k.part("jets") }, (rand) => {
        const j = jets[Math.floor(rand() * jets.length)];
        const s = Math.pow(rand(), 1.4);
        const along = R + s * 0.42;
        const dir = unit(add(j, mul(T, 1.6 * s * s)));
        return {
          p: add(mul(dir, along), mul(randDir(rand), 0.012 + 0.03 * s)),
          dir,
          stretch: 3,
          color: mix("#ffffff", "#bff8ec", s),
          opacity: 0.55 * (1 - s) + 0.05,
          size: (0.7 + 0.5 * rand()) * S,
        };
      });
      k.reach(mul(T, L + 0.2));
    },
  },

  star: {
    alive: true,
    options: [
      {
        key: "type",
        label: "Type",
        type: "select",
        default: "yellow",
        choices: [
          { id: "red", label: "Red dwarf" },
          { id: "yellow", label: "Yellow, like the Sun" },
          { id: "blue", label: "Blue giant" },
          { id: "white", label: "White dwarf" },
        ],
      },
    ],
    controls: [{ key: "life", label: "Life", type: "pulse", ease: 8.5 }],
    action: { key: "life", label: "Live and die" },
    // A tap runs a star's life, sped up: it swells into a red giant that
    // throbs, puffs off its outer layers as a glowing shell and shrinks to a
    // tiny white dwarf; then, as the shell fades, a new star lights up and
    // grows back to what it was.
    drive(t, c, out) {
      const p = progress(c.life);
      const on = c.life > 0 ? 1 : 0;
      const swell = ease(band(p, 0, 0.28));
      const puff = ease(band(p, 0.42, 0.6));
      const reborn = ease(band(p, 0.76, 1));
      out.parts.star = on
        ? p < 0.5
          ? { scale: 1 + 0.7 * swell, visible: 1 - band(p, 0.08, 0.24) }
          : {
              scale: 0.1 + 0.9 * reborn,
              visible: reborn * (1 + 0.8 * bump(p, 0.76, 0.84, 0.88, 1)),
            }
        : {};
      const throb = 0.06 * Math.sin(t * 6) * bump(p, 0.24, 0.3, 0.38, 0.44);
      out.parts.giant = {
        scale: (1 + 0.7 * swell + throb) * (1 - 0.92 * puff),
        visible: on * band(p, 0.05, 0.18) * (1 - band(p, 0.52, 0.6)),
      };
      out.parts.shell = {
        scale: 1.5 + 1.9 * easeOut(band(p, 0.42, 0.9)),
        visible: on * bump(p, 0.42, 0.47, 0.66, 0.9),
      };
      out.parts.dwarf = { visible: on * bump(p, 0.5, 0.56, 0.8, 0.9) };
      // A bell as the new star lights (past the sound check's five seconds).
      const m = mem(c);
      if (on && p >= 0.78 && (m.p ?? 1) < 0.78)
        out.cues.push({ voice: "bell", f: "A5", decay: 0.7, bright: 0.6 });
      m.p = on ? p : 1;
      out.amount = 1 + on * bump(p, 0.2, 0.3, 0.4, 0.46);
    },
    build(k, o) {
      const T = STAR_TYPES[o.type] || STAR_TYPES.yellow;
      const star = k.part("star");
      const f = camFrame();
      const spots = [];
      for (let i = 0; i < T.spots; i++)
        spots.push({ d: unit(add(f.c, mul(randDir(k.rand), 0.7))), r: 0.04 + 0.07 * k.rand() });
      // The surface: hot and bright, with soft convection cells.
      k.add(k.sphere(1), {
        flat: 0.4,
        interior: 0.1,
        core: layers([T.surface[3], T.surface[2], T.surface[1]]),
        pattern: false,
        part: star,
        kind: "twinkle",
        params: (c) => [0.18, c.rand() * TAU],
        color: (c) => {
          const d = c.ln;
          const g = smoothstep(
            0,
            0.16,
            Math.abs(c.noise(d[0] * T.freq, d[1] * T.freq, d[2] * T.freq)),
          );
          const big = c.fbm(d[0] * 2.5 + 9, d[1] * 2.5, d[2] * 2.5, 3);
          // Hotter towards the middle of the face the viewer sees.
          const face = smoothstep(0.2, 1, dot(d, f.c));
          let col = ramp(T.surface, clamp01(0.25 + 0.35 * g + big * 1.2 + 0.35 * face));
          for (const s of spots) {
            const x = angle(d, s.d) / s.r;
            if (x < 1) col = mix(shade(T.surface[0], 0.45), col, smoothstep(0.45, 1, x));
          }
          return col;
        },
      });
      // A bright inner glow and a wide soft one.
      halo(k, {
        part: star,
        r0: 0.99,
        r1: T.inner,
        share: 0.08,
        size: 3,
        opacity: 0.32,
        falloff: 1.6,
        twinkle: 0.2,
        col: (t) => mix(T.glow[0], T.glow[1], t * 0.6),
      });
      halo(k, {
        part: star,
        r0: 1.05,
        r1: T.halo,
        share: T.faint ? 0.16 : 0.08,
        size: T.faint ? 6 : 4.5,
        opacity: T.faint ? 0.07 : 0.14,
        falloff: 1.4,
        twinkle: 0.25,
        col: (t) => mix(T.glow[0], T.glow[1], 0.4 + 0.6 * t),
      });
      if (T.flares) {
        for (const a of [0.7, 2.6, 4.4]) {
          const mid = limbDir(a, f.c);
          const along = unit(cross(mid, f.c));
          const pts = [];
          for (let i = 0; i <= 8; i++) {
            const s = i / 8;
            pts.push(
              mul(unit(add(mid, mul(along, (s - 0.5) * 0.4))), 0.97 + 0.42 * Math.sin(Math.PI * s)),
            );
          }
          glowPath(k, spline(pts), {
            part: star,
            share: 0.012,
            width: (t) => 0.02 + 0.035 * Math.sin(Math.PI * t),
            size: 2.4,
            opacity: 0.55,
            col: (t, rand) => mix("#ff3010", "#ffc060", rand()),
          });
        }
      }
      if (T.spikes) {
        // Soft rays, like a bright star seen through a telescope: four long
        // ones and four short diagonals.
        const diag = (a, b) => unit(add(a, b));
        const rays = [
          [f.up, 1],
          [mul(f.up, -1), 1],
          [f.right, 1],
          [mul(f.right, -1), 1],
          [diag(f.up, f.right), 0.45],
          [diag(f.up, mul(f.right, -1)), 0.45],
          [diag(mul(f.up, -1), f.right), 0.45],
          [diag(mul(f.up, -1), mul(f.right, -1)), 0.45],
        ];
        k.cloud({ share: 0.04, pattern: false, kind: "twinkle", part: star }, (rand) => {
          const [d, l] = rays[Math.floor(rand() * rays.length)];
          const s = Math.pow(rand(), 1.4);
          const r = 0.95 + (T.spikes - 0.95) * l * s;
          return {
            p: add(mul(d, r), mul(f.c, 0.3)),
            dir: d,
            stretch: 6,
            color: mix(T.glow[1], T.glow[0], 0.5 + 0.5 * (1 - s)),
            opacity: 0.7 * (1 - s) + 0.05,
            size: (T.faint ? 2.2 : 1.5) * (1 - 0.6 * s),
            params: [0.3, rand() * TAU],
          };
        });
      }
      // The red giant (hidden until a tap): a bloated, mottled red star,
      // built just outside the star so it draws over it, and grown.
      const giant = k.part("giant");
      halo(k, {
        part: giant,
        r0: 1.03,
        r1: 1.3,
        share: 0.02,
        size: 3,
        opacity: 0.2,
        falloff: 1.6,
        col: (t) => mix("#ff6a30", "#b02008", t),
      });
      k.add(k.sphere(1.03), {
        part: giant,
        flat: 0.4,
        share: 0.08,
        size: 2.7,
        pattern: false,
        kind: "twinkle",
        params: (c) => [0.25, c.rand() * TAU],
        color: (c) => {
          const d = c.ln;
          const cell = c.fbm(d[0] * 3.5 + 20, d[1] * 3.5, d[2] * 3.5, 3);
          const face = smoothstep(0, 1, dot(d, f.c));
          return ramp(
            ["#6a1004", "#c8300c", "#ff6a26", "#ffb070"],
            clamp01(0.35 + cell * 1.6 + 0.3 * face),
          );
        },
      });
      // The shell it puffs off: a ragged ring of glowing gas, teal inside
      // and red outside, like a planetary nebula.
      k.cloud({ share: 0.05, pattern: false, part: k.part("shell") }, (rand) => {
        const d = randDir(rand);
        const rim = Math.pow(1 - Math.abs(dot(d, f.c)), 0.6);
        const r = 0.9 + 0.2 * rand();
        return {
          p: mul(d, r),
          color: mix("#40d8e0", "#ff4060", clamp01((r - 0.9) / 0.2 + 0.3 * gauss(rand))),
          opacity: 0.05 + 0.2 * rim,
          size: 2.4,
          kind: "twinkle",
          params: [0.3, rand() * TAU],
        };
      });
      // The white dwarf left behind: a tiny, fierce white star.
      const dwarf = k.part("dwarf");
      k.cloud({ share: 0.01, pattern: false, part: dwarf }, (rand) => ({
        p: mul(randDir(rand), 0.07 * Math.cbrt(rand())),
        color: mix("#ffffff", "#dfe8ff", rand()),
        opacity: 1,
        size: 1.2,
      }));
      halo(k, {
        part: dwarf,
        r0: 0.07,
        r1: 0.32,
        share: 0.012,
        size: 2.2,
        opacity: 0.3,
        falloff: 2,
        twinkle: 0.3,
        col: (t) => mix("#ffffff", "#7aa0ff", t),
      });
    },
  },

  pulsar: {
    alive: true,
    controls: [
      { key: "spin", label: "Spin speed", type: "slider", default: 0.35 },
      { key: "spinup", label: "Spin up", type: "pulse", ease: 5.4 },
    ],
    action: { key: "spinup", label: "Spin up" },
    // Each time a beam sweeps past the viewer the star flashes, like a
    // lighthouse (that is why pulsars pulse). A tap spins it up to a blur,
    // so the flashes come faster and faster into a strobe, each with a
    // tick, then it winds back down.
    drive(t, c, out, info) {
      const m = mem(c);
      const p = progress(c.spinup);
      const on = c.spinup > 0 ? 1 : 0;
      const boost = on * 24 * ease(band(p, 0, 0.42)) * (1 - ease(band(p, 0.58, 1)));
      const a = spinAngle(c, t, 0.8 + 5 * c.spin + boost);
      out.parts.star = { angle: a };
      // Count half turns past the angle where a beam faces the viewer.
      const n = Math.floor((a - PULSAR.face) / Math.PI);
      if (m.n === undefined) m.n = n;
      if (n !== m.n) {
        m.n = n;
        m.flashAt = info.time;
        if (on && boost > 2) out.cues.push({ voice: "click", f: 2600 + 40 * boost, vol: 0.7 });
      }
      const flash = Math.exp(-Math.max(0, info.time - (m.flashAt ?? -9)) / 0.08);
      out.parts.flash = { visible: flash * (0.35 + 1.2 * band(boost, 0, 12)) };
      out.parts.sweep = { visible: 0.9 * band(boost, 6, 20) };
      out.amount = 1 + 1.5 * band(boost, 0, 24);
    },
    build(k) {
      const S = budgetScale(k);
      const axis = PULSAR.axis;
      const star = k.part("star", { axis });
      // The magnetic axis, tipped 40 degrees from the spin axis.
      const m = PULSAR.m;
      const [e1, e2] = basis(m);
      // A tiny, fierce star.
      const core = globe(k, {
        r: 0.1,
        share: 0.05,
        part: star,
        flat: 0.5,
        interior: 0,
        kind: "twinkle",
        params: (c) => [0.25, c.rand() * TAU],
        col: (c) => mix("#e4eeff", "#ffffff", c.rand()),
      });
      core.opts.pattern = false;
      halo(k, {
        r0: 0.1,
        r1: 0.4,
        share: 0.06,
        size: 2.4 * S,
        opacity: 0.22,
        falloff: 2.4,
        twinkle: 0.3,
        part: star,
        col: (t) => mix("#e8f0ff", "#6a7cff", t),
      });
      // Two beams from the magnetic poles: a bright core line in a wider glow.
      k.cloud({ share: 0.46, pattern: false, part: star, kind: "twinkle" }, (rand) => {
        const side = rand() < 0.5 ? 1 : -1;
        const s = Math.pow(rand(), 0.8);
        const tight = rand() < 0.4;
        const spread = (tight ? 0.004 + 0.02 * s : 0.01 + 0.11 * s) * Math.sqrt(rand());
        const a = rand() * TAU;
        const p = add(
          mul(m, side * (0.1 + 1.7 * s)),
          add(mul(e1, Math.cos(a) * spread), mul(e2, Math.sin(a) * spread)),
        );
        return {
          p,
          dir: m,
          stretch: 5,
          color: tight
            ? ramp(["#ffffff", "#e0f0ff", "#9ad0ff"], s)
            : ramp(["#dff0ff", "#8ac8ff", "#6a7cff", "#9a64ff"], s),
          opacity: (tight ? 0.7 : 0.3) * Math.pow(1 - s, 0.9) + 0.03,
          size: (tight ? 0.6 : 1.1 + 0.8 * rand()) * S,
          params: [0.3, rand() * TAU],
          part: star,
        };
      });
      // Magnetic field loops.
      for (let j = 0; j < 6; j++) {
        const az = (j / 6) * TAU + 0.3;
        const e = add(mul(e1, Math.cos(az)), mul(e2, Math.sin(az)));
        const path = (t) => {
          const th = 0.3 + t * (Math.PI - 0.6);
          const r = 0.6 * Math.sin(th) ** 2;
          return add(mul(m, Math.cos(th) * r), mul(e, Math.sin(th) * r));
        };
        glowPath(k, path, {
          share: 0.01,
          width: 0.006,
          size: 0.9 * S,
          opacity: 0.45,
          twinkle: 0,
          part: star,
          col: (t, rand) => mix("#5fd0ff", "#b0f0ff", rand()),
        });
      }
      // The blur of the beams at full spin (hidden until then): faint cones
      // swept out by the beams round the spin axis.
      const [a1, a2] = basis(axis);
      const tilt = Math.acos(clamp(dot(m, axis), -1, 1));
      k.cloud({ share: 0.05, pattern: false, part: k.part("sweep") }, (rand) => {
        const side = rand() < 0.5 ? 1 : -1;
        const s = Math.pow(rand(), 0.8);
        const a = rand() * TAU;
        const r = 0.1 + 1.6 * s;
        const d = add(
          mul(axis, side * Math.cos(tilt)),
          mul(add(mul(a1, Math.cos(a)), mul(a2, Math.sin(a))), Math.sin(tilt)),
        );
        return {
          p: mul(d, r),
          color: mix("#c8d8ff", "#8a64ff", s),
          opacity: 0.1 * (1 - s) + 0.02,
          size: (1.4 + 1.2 * s) * S,
        };
      });
      // The flash when a beam sweeps past: a burst of light round the star
      // with four spikes, facing the viewer (it does not turn).
      const flash = k.part("flash");
      halo(k, {
        part: flash,
        r0: 0.08,
        r1: 0.5,
        share: 0.02,
        size: 2.6 * S,
        opacity: 0.35,
        falloff: 2.2,
        col: (t) => mix("#ffffff", "#9ab8ff", t),
      });
      const f = camFrame();
      k.cloud({ share: 0.012, pattern: false, part: flash }, (rand) => {
        const d = [f.right, mul(f.right, -1), f.up, mul(f.up, -1)][Math.floor(rand() * 4)];
        const s = Math.pow(rand(), 1.5);
        return {
          p: add(mul(d, 0.08 + 0.7 * s), mul(f.c, 0.15)),
          dir: d,
          stretch: 5,
          color: mix("#ffffff", "#a8c4ff", s),
          opacity: 0.8 * (1 - s) + 0.05,
          size: 1.1 * (1 - 0.6 * s) * S,
        };
      });
    },
  },

  "black-hole": {
    alive: true,
    controls: [{ key: "feed", label: "Feed", type: "pulse", ease: 6.6 }],
    action: { key: "feed", label: "Feed it a star" },
    // A tap sends a small star falling in. It spirals closer, faster and
    // faster, is stretched into a streak by the tides, and leaves a stream
    // of its gas along its path; it plunges in, the disk and the photon
    // ring flare, and the stream swirls down after it.
    drive(t, c, out) {
      const p = progress(c.feed);
      const on = c.feed > 0 ? 1 : 0;
      const s = Math.pow(band(p, 0.02, 0.5), 1.5);
      const at = BH_PATH.at(s);
      const turn = -(BH_PATH.phi(s) - BH_PATH.phi(1));
      const plunge = band(p, 0.47, 0.52);
      out.parts.star = {
        offset: sub(at, BH_PATH.end),
        visible: on * (1 - band(s, 0.5, 0.78)),
      };
      out.parts.streak = {
        offset: sub(at, BH_PATH.end),
        quat: quatAxisAngle([0, 1, 0], turn),
        visible: on * band(s, 0.45, 0.75) * (1 - plunge),
        scale: 1 - 0.6 * plunge,
      };
      out.grow = on * 0.99 * s;
      const drain = ease(band(p, 0.5, 0.9));
      out.parts.stream = {
        angle: -1.5 * drain,
        scale: 1 - 0.6 * drain,
        visible: on * (1 - band(p, 0.62, 0.9)),
      };
      const flare = on * bump(p, 0.48, 0.54, 0.64, 0.96);
      out.glow = [1, 0.8, 0.55, 0.7 + 2.6 * flare];
      out.parts.ring = { visible: 1 + 0.8 * flare };
      out.parts.flare = { visible: 1.4 * flare, scale: 0.9 + 0.3 * flare };
      out.amount = 1 + 1.5 * flare;
    },
    build(k) {
      const noise = k.noise;
      const S = budgetScale(k);
      const f = camFrame(0.55, 0.16);
      // The event horizon: a black ball.
      const hole = k.add(k.sphere(1), {
        share: 0.08,
        flat: 0.6,
        pattern: false,
        interior: 0.05,
        core: "#000000",
        color: "#030303",
        opacity: 1,
      });
      hole.opts.size = coverSize(k, hole.area, 0.08);
      // The photon ring: a thin bright circle right around it.
      k.cloud({ share: 0.035, pattern: false, kind: "twinkle", part: k.part("ring") }, (rand) => {
        const a = rand() * TAU;
        const r = 1.07 + gauss(rand) * 0.012;
        return {
          p: add(mul(f.right, Math.cos(a) * r), mul(f.up, Math.sin(a) * r)),
          color: mix("#fff4dc", "#ffd27a", rand() * 0.5),
          opacity: 0.85,
          size: 1.3 * S,
          params: [0.2, rand() * TAU],
        };
      });
      // The accretion disk, hot and white inside, red outside. Bright
      // clumps of gas swirl round it in a trailing spiral, the inside
      // ahead: a glow runs round the disk, because moving the splats
      // themselves would upset their depth order against the black ball.
      const R0 = 1.45;
      const R1 = 2.9;
      k.cloud({ share: 0.52, pattern: false }, (rand) => {
        const u = Math.pow(rand(), 1.3);
        const r = R0 + (R1 - R0) * u;
        const a = rand() * TAU;
        const streak = noise(r * 7, Math.cos(a) * 1.4, Math.sin(a) * 1.4);
        const t = clamp01(u + streak * 0.35);
        const swirl = rand() < 0.75;
        const along = ((((3 * a) / TAU - 1.6 / r) % 1) + 1) % 1;
        return {
          p: [r * Math.cos(a), gauss(rand) * 0.012 * r, r * Math.sin(a)],
          n: [0, 1, 0],
          flat: 0.2,
          color: ramp(["#fffbea", "#ffd97a", "#ff9a30", "#d24a12", "#6a1606"], t),
          opacity: (0.35 + 0.55 * (1 - u)) * (0.7 + 0.3 * smoothstep(-0.2, 0.3, streak)),
          size: (1.4 + 1.6 * u) * S,
          kind: swirl ? "pulse" : "twinkle",
          params: swirl ? [along, 0] : [0.35, rand() * TAU],
        };
      });
      // The far side of the disk, bent by gravity into arcs over the top
      // and under the bottom.
      k.cloud({ share: 0.2, pattern: false, kind: "twinkle" }, (rand) => {
        const top = rand() < 0.68;
        const phi = rand() * Math.PI;
        const lift = Math.pow(Math.sin(phi), 0.6);
        const t = Math.pow(rand(), 1.8);
        const r = top ? 1.13 + 0.55 * t * lift : 1.1 + 0.22 * t * lift;
        const a = top ? phi : -phi;
        return {
          p: add(mul(f.right, Math.cos(a) * r), add(mul(f.up, Math.sin(a) * r), mul(f.c, -0.05))),
          n: f.c,
          flat: 0.3,
          color: ramp(["#fff6dc", "#ffcf6a", "#ff9030", "#c2400f"], t),
          opacity: (0.6 * (1 - t) + 0.08) * (0.4 + 0.6 * lift),
          size: (1.3 + 1.2 * t) * S,
          params: [0.15, rand() * TAU],
        };
      });
      // The star that falls in (hidden until a tap), built where it plunges
      // (in front of the hole, so it draws over it) and moved along its
      // path: first round, then drawn out into a streak.
      const star = k.part("star", { pivot: BH_PATH.end });
      k.cloud({ share: 0.012, pattern: false, part: star }, (rand) => ({
        p: add(BH_PATH.end, mul(randDir(rand), 0.16 * Math.cbrt(rand()))),
        color: mix("#ffffff", "#dfe8ff", rand()),
        opacity: 1,
        size: 1.4 * S,
      }));
      halo(k, {
        part: star,
        center: BH_PATH.end,
        r0: 0.16,
        r1: 0.5,
        share: 0.012,
        size: 2.4 * S,
        opacity: 0.35,
        col: (t) => mix("#e8f0ff", "#6a8cff", t),
      });
      const tan = BH_PATH.tangent(1);
      k.cloud(
        { share: 0.014, pattern: false, part: k.part("streak", { pivot: BH_PATH.end }) },
        (rand) => {
          const u = gauss(rand) * 0.4;
          return {
            p: add(
              BH_PATH.end,
              add(mul(tan, u), mul(randDir(rand), 0.035 * (1 - Math.min(1, Math.abs(u))) * rand())),
            ),
            dir: tan,
            stretch: 4,
            color: mix("#ffffff", "#9ab4ff", Math.min(1, Math.abs(u) * 1.5)),
            opacity: 0.9 - 0.5 * Math.min(1, Math.abs(u)),
            size: 1.4 * S,
          };
        },
      );
      // The stream of its gas along the path, drawn out behind it (grow).
      k.cloud({ share: 0.035, pattern: false, part: k.part("stream") }, (rand) => {
        const s = rand();
        const w = 0.04 + 0.07 * s;
        return {
          p: add(BH_PATH.at(s), mul(randDir(rand), w * Math.sqrt(rand()))),
          color: mix(mix("#c8d8ff", "#ffffff", rand()), "#ffb060", s * s),
          opacity: 0.45 + 0.4 * s,
          size: (1 + 0.8 * rand()) * S,
          kind: "grow",
          params: [0.97 * s, 0],
        };
      });
      // The flare: a hot glow round the hole, in the disk.
      k.cloud({ share: 0.03, pattern: false, part: k.part("flare") }, (rand) => {
        const a = rand() * TAU;
        const r = 1.1 + 1.1 * Math.pow(rand(), 1.5);
        return {
          p: [r * Math.cos(a), gauss(rand) * 0.05, r * Math.sin(a)],
          color: mix("#fff4d0", "#ff9a40", (r - 1.1) / 1.1),
          opacity: 0.14,
          size: 3 * S,
        };
      });
    },
  },

  "planetary-nebula": {
    alive: true,
    controls: [{ key: "pulse", label: "Pulse", type: "pulse", ease: 4.8 }],
    action: { key: "pulse", label: "Blow a new shell" },
    // A tap makes the dying star at the middle flare and blow out a fresh
    // shock of gas: a thin bright ring races out, and as it hits the main
    // ring the ring glows brighter and is pushed outwards, then settles.
    drive(t, c, out) {
      const p = progress(c.pulse);
      const on = c.pulse > 0 ? 1 : 0;
      const hit = on * bump(p, 0.32, 0.44, 0.52, 0.94);
      out.parts.ring = { scale: 1 + 0.15 * ease(hit), visible: 1 + 0.45 * hit };
      out.parts.haze = { scale: 1 + 0.18 * ease(hit), visible: 1 + 0.4 * hit };
      out.parts.outer = { scale: 1 + 0.1 * ease(on * bump(p, 0.4, 0.6, 0.65, 1)) };
      out.parts.shock = {
        scale: 0.06 + 1.7 * band(p, 0.03, 0.62),
        visible: on * 1.4 * bump(p, 0.03, 0.08, 0.45, 0.66),
      };
      out.parts.center = { visible: 1 + on * 2.2 * bump(p, 0, 0.03, 0.08, 0.35) };
    },
    build(k) {
      const noise = k.noise;
      const S = budgetScale(k);
      const f = camFrame(0.35, 0.3);
      // A barrel of glowing gas seen almost end-on: a ring.
      const ax = unit(add(f.c, add(mul(f.right, 0.22), mul(f.up, 0.15))));
      const [e1, e2] = basis(ax);
      const P = (r, a, h) =>
        add(add(mul(e1, Math.cos(a) * r), mul(e2, Math.sin(a) * r * 0.84)), mul(ax, h));
      const ring = k.part("ring");
      k.cloud({ share: 0.56, pattern: false, kind: "breathe", part: ring }, (rand) => {
        for (let tries = 0; tries < 8; tries++) {
          const a = rand() * TAU;
          const h = gauss(rand) * 0.28;
          const clump = noise.fbm(Math.cos(a) * 3.2, Math.sin(a) * 3.2, h * 4, 3);
          if (rand() > 0.45 + clump * 2.4) continue;
          const r = 0.9 + 0.1 * Math.abs(h) + gauss(rand) * 0.12;
          const hue = noise(Math.cos(a) * 5 + 3, Math.sin(a) * 5, h * 6 + r * 3);
          const t = clamp01((r - 0.7) / 0.5 + hue * 0.9);
          return {
            p: P(r, a, h),
            color: ramp(["#3aa8e0", "#4cc8d0", "#e8c850", "#ff8038", "#ee3a4a", "#b02060"], t),
            opacity: 0.2 + 0.2 * clamp01(clump * 3 + 0.3),
            size: (1.4 + 1.4 * rand()) * S,
            params: [0.012, 0],
          };
        }
        return null;
      });
      // Bright knots in the ring.
      k.cloud({ share: 0.03, pattern: false, kind: "twinkle", part: ring }, (rand) => {
        const a = rand() * TAU;
        const r = 0.84 + gauss(rand) * 0.07;
        return {
          p: P(r, a, gauss(rand) * 0.15),
          color: mix("#fff2b0", "#ffb070", rand()),
          opacity: 0.6,
          size: 0.9 * S,
          params: [0.5, rand() * TAU],
        };
      });
      // A faint blue haze filling the middle.
      k.cloud({ share: 0.1, pattern: false, kind: "breathe", part: k.part("haze") }, (rand) => {
        const a = rand() * TAU;
        const r = 0.78 * Math.sqrt(rand());
        return {
          p: P(r, a, gauss(rand) * 0.18),
          color: mix("#4a8cff", "#7ad8ff", rand()),
          opacity: 0.05,
          size: 3.5 * S,
          params: [0.012, 0],
        };
      });
      // An outer halo: a soft red glow.
      k.cloud({ share: 0.08, pattern: false, part: k.part("outer") }, (rand) => {
        const a = rand() * TAU;
        const r = 1.2 + 0.55 * Math.pow(rand(), 1.4);
        return {
          p: P(r, a, gauss(rand) * 0.35),
          color: mix("#ff3a5a", "#ff7a5a", rand()),
          opacity: 0.05 * (1 - (r - 1.2) / 0.6),
          size: 3.2 * S,
        };
      });
      // The tiny white star in the middle.
      const center = k.part("center");
      const star = globe(k, {
        part: center,
        r: 0.03,
        share: 0.01,
        interior: 0,
        kind: "twinkle",
        params: [0.4, 0],
        col: () => "#ffffff",
      });
      star.opts.pattern = false;
      halo(k, {
        part: center,
        r0: 0.03,
        r1: 0.14,
        share: 0.01,
        size: 1.4 * S,
        opacity: 0.4,
        col: (t) => mix("#ffffff", "#9ac8ff", t),
      });
      // The shock (hidden until a tap): a thin ring of hot, bright gas,
      // built just outside the main ring and grown out from the star.
      k.cloud({ share: 0.02, pattern: false, part: k.part("shock") }, (rand) => {
        const a = rand() * TAU;
        return {
          // (Just in front of the gas, so it draws over it.)
          p: P(1.02 + gauss(rand) * 0.02, a, 0.32 + gauss(rand) * 0.02),
          color: mix("#f4fdff", "#8ae0ff", rand()),
          opacity: 0.7,
          size: 1.5 * S,
        };
      });
    },
  },

  supernova: {
    alive: true,
    controls: [{ key: "boom", label: "Explode", type: "pulse", ease: 5 }],
    action: { key: "boom", label: "Explode" },
    drive(t, c, out) {
      // y runs from 0 (the blast) to 1 (settled again): the debris flies
      // out and fades, then glows back in place.
      const y = 1 - c.boom;
      let D = 0;
      let vis = 1;
      if (y < 0.5) {
        D = easeOut(y / 0.5);
        vis = 1 - 0.5 * (y / 0.5);
      } else if (y < 0.66) {
        D = 1;
        vis = 0.5 * (1 - (y - 0.5) / 0.16);
      } else if (y < 0.7) vis = 0;
      else vis = smoothstep(0.7, 1, y);
      CHUNKS.forEach((d, i) => {
        out.parts[`debris${i}`] = { offset: mul(d, D * 0.5), angle: D * 0.35, visible: vis };
      });
      const flash = Math.exp(-y * 8);
      out.parts.flash = { visible: 1 + 3 * flash };
      out.amount = 1 + 2 * flash;
    },
    build(k) {
      const noise = k.noise;
      const S = budgetScale(k);
      const parts = CHUNKS.map((d, i) =>
        k.part(`debris${i}`, { pivot: [0, 0, 0], axis: unit(cross(d, [0.3, 1, 0.5])) }),
      );
      const flashPart = k.part("flash");
      const chunkOf = (d) => {
        let best = 0;
        let bv = -2;
        for (let i = 0; i < CHUNKS.length; i++) {
          const v = dot(d, CHUNKS[i]);
          if (v > bv) {
            bv = v;
            best = i;
          }
        }
        return parts[best];
      };
      // A ragged shell of glowing gas: brightest at its rim, where the eye
      // looks through the most of it, and laced with filaments. Hydrogen
      // glows red, oxygen teal, sulphur gold.
      const shell = (d) => 0.72 + 0.2 * (0.5 + 1.4 * noise(d[0] * 1.1 + 4, d[1] * 1.1, d[2] * 1.1));
      const hue = (d) => noise.fbm(d[0] * 1.5 + 50, d[1] * 1.5, d[2] * 1.5, 3);
      const tint = (h, rand) =>
        h > 0.05
          ? mix("#ff3040", "#ff6a48", rand())
          : h < -0.12
            ? mix("#2cc8c0", "#7aeede", rand())
            : mix("#ff9a30", "#ffd860", rand());
      k.cloud({ share: 0.24, pattern: false, kind: "twinkle" }, (rand) => {
        for (let tries = 0; tries < 8; tries++) {
          const d = randDir(rand);
          const w = noise.fbm(d[0] * 2 + 9, d[1] * 2, d[2] * 2, 2);
          const ridge = 1 - Math.abs(noise(d[0] * 4 + w * 2, d[1] * 4 - w, d[2] * 4 + w));
          const fil = Math.pow(ridge, 8);
          if (rand() > 0.3 + 0.7 * fil) continue;
          return {
            p: mul(d, shell(d) * (0.96 + 0.08 * rand())),
            color: shade(tint(hue(d), rand), 0.85 + 0.3 * fil),
            opacity: 0.04 + 0.18 * fil,
            size: (0.6 + 0.7 * rand()) * S,
            params: [0.2, rand() * TAU],
            part: chunkOf(d),
          };
        }
        return null;
      });
      // A few fine bright filaments across the face.
      const fils = [];
      for (let i = 0; i < 26; i++) {
        const d0 = randDir(k.rand);
        const [e1, e2] = basis(d0);
        const a0 = k.rand() * TAU;
        fils.push({
          d0,
          axis: add(mul(e1, Math.cos(a0)), mul(e2, Math.sin(a0))),
          length: 0.5 + 0.8 * k.rand(),
          seed: k.rand() * 50,
        });
      }
      k.cloud({ share: 0.1, pattern: false, kind: "twinkle" }, (rand) => {
        const F = fils[Math.floor(rand() * fils.length)];
        const s = rand();
        let d = quatRotate(quatAxisAngle(F.axis, (s - 0.5) * F.length), F.d0);
        d = unit(add(d, mul(F.axis, noise(s * F.length * 3 + F.seed, F.seed, 0.5) * 0.2)));
        return {
          p: add(mul(d, shell(d)), mul(randDir(rand), 0.006)),
          color: shade(tint(hue(d), rand), 1.15),
          opacity: 0.4 * Math.sin(Math.PI * s),
          size: (0.45 + 0.35 * rand()) * S,
          params: [0.3, rand() * TAU],
          part: chunkOf(d),
        };
      });
      // Bright knots of shrapnel, some thrown past the shell.
      k.cloud({ share: 0.03, pattern: false, kind: "twinkle" }, (rand) => {
        const d = randDir(rand);
        const r = shell(d) * (0.8 + 0.35 * rand());
        return {
          p: mul(d, r),
          color: tint(hue(d), rand),
          opacity: 0.7,
          size: (0.5 + 0.4 * rand()) * S,
          params: [0.5, rand() * TAU],
          part: chunkOf(d),
        };
      });
      // Inside: a blue-violet glow round the bright core, which flares.
      halo(k, {
        r0: 0.03,
        r1: 0.55,
        share: 0.12,
        size: 2.4 * S,
        opacity: 0.08,
        falloff: 2.2,
        twinkle: 0.3,
        part: flashPart,
        col: (t) => ramp(["#ffffff", "#a8bcff", "#8a70ff"], t),
      });
      halo(k, {
        r0: 0.03,
        r1: 0.3,
        share: 0.06,
        size: 1.8 * S,
        opacity: 0.55,
        falloff: 1.8,
        twinkle: 0.4,
        part: flashPart,
        col: (t) => ramp(["#ffffff", "#fff4c0", "#ffb060"], t),
      });
      // Rays from the blast, like a bright star through a telescope.
      const f = camFrame();
      const rays = [0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * TAU + 0.26;
        return add(mul(f.right, Math.cos(a)), mul(f.up, Math.sin(a)));
      });
      k.cloud({ share: 0.02, pattern: false, part: flashPart, kind: "twinkle" }, (rand) => {
        const d = rays[Math.floor(rand() * rays.length)];
        const s = Math.pow(rand(), 1.5);
        return {
          p: add(mul(d, 0.05 + 0.6 * s), mul(f.c, 0.45)),
          dir: d,
          stretch: 6,
          color: mix("#ffffff", "#ffc870", s),
          opacity: 0.75 * (1 - s) + 0.05,
          size: 1.3 * (1 - 0.6 * s) * S,
          params: [0.3, rand() * TAU],
        };
      });
      const core = globe(k, {
        r: 0.04,
        share: 0.01,
        part: flashPart,
        interior: 0,
        kind: "twinkle",
        params: [0.5, 0],
        col: () => "#ffffff",
      });
      core.opts.pattern = false;
      for (const d of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ])
        k.reach(mul(d, 1.12));
    },
  },

  "star-cluster": {
    alive: true,
    controls: [{ key: "breathe", label: "Breathe", type: "pulse", ease: 4.8 }],
    action: { key: "breathe", label: "Breathe in and out" },
    // A tap makes the cluster breathe: it draws in, swells out and settles,
    // the core first and the outskirts a moment later, while a wave of
    // sparkle runs out from the middle through the stars.
    drive(t, c, out) {
      const p = progress(c.breathe);
      const on = c.breathe > 0 ? 1 : 0;
      const osc = (u) => (u <= 0 || u >= 1 ? 0 : -Math.sin(u * Math.PI * 3) * Math.pow(1 - u, 1.4));
      CLUSTER_SHELLS.forEach((sh, i) => {
        out.parts[`shell${i}`] = { scale: 1 + on * 0.2 * osc(band(p, sh.lag, 0.8 + sh.lag)) };
      });
      out.grow = on * 1.12 * easeOut(band(p, 0.08, 0.5));
      out.parts.sparkle = {
        scale: 1 + on * 0.2 * osc(band(p, 0.06, 0.86)),
        visible: on * 1.3 * (1 - band(p, 0.45, 0.85)),
      };
      out.amount = 1 + 1.4 * on * bump(p, 0.05, 0.2, 0.5, 0.9);
    },
    build(k) {
      const S = budgetScale(k, 0.35);
      // Stars and glow are in three shells by distance from the middle, so
      // the cluster can breathe from the inside out.
      const shells = CLUSTER_SHELLS.map((sh, i) => k.part(`shell${i}`));
      const shellOf = (r) => shells[CLUSTER_SHELLS.findIndex((sh) => r < sh.r)];
      const plummer = (rand, a, max) => {
        const u = 0.002 + 0.998 * rand();
        return Math.min(max, a / Math.sqrt(Math.pow(u, -2 / 3) - 1));
      };
      // Resolved stars: mostly gold, a few red giants and blue stragglers.
      k.cloud({ share: 0.2, pattern: false, kind: "twinkle" }, (rand) => {
        let r = plummer(rand, 0.11, 2);
        if (r > 1) r = 0.3 + 0.7 * rand();
        const x = rand();
        const inner = 1 - Math.min(1, r / 0.25);
        let col;
        let size;
        if (x < 0.01) [col, size] = [mix("#ff5a1a", "#ff8a3a", rand()), 2.4];
        else if (x < 0.045) [col, size] = [mix("#ff9a30", "#ffba50", rand()), 1.7];
        else if (x < 0.065) [col, size] = [mix("#4a80ff", "#80a8ff", rand()), 1.4];
        else
          [col, size] = [
            mix("#ffbf40", "#fff0c0", rand() * rand() + 0.5 * inner),
            0.5 + 0.4 * rand(),
          ];
        return {
          p: mul(randDir(rand), r),
          color: col,
          opacity: 0.92,
          size: size * S,
          params: [0.35 + 0.3 * rand(), rand() * TAU],
          part: shellOf(r),
        };
      });
      // The light of the countless unresolved stars: a glow that follows the
      // same crowding, bright gold in the core.
      k.cloud({ share: 0.46, pattern: false }, (rand) => {
        const r = plummer(rand, 0.09, 0.55);
        return {
          p: mul(randDir(rand), r),
          color: mix("#fff2c8", "#ffb030", clamp01(r / 0.3)),
          opacity: 0.09 * (1 - r / 0.58),
          size: (1.3 + 1.2 * rand()) * S,
          part: shellOf(r),
        };
      });
      // The sparkle (hidden until a tap): four-pointed glints on bright
      // stars, lit in order from the middle out (grow) as the wave passes.
      const f = camFrame();
      const glints = [];
      for (let i = 0; i < 70; i++) {
        const r = Math.min(0.95, 0.04 + 0.9 * Math.pow(k.rand(), 1.3));
        glints.push({ p: mul(randDir(k.rand), r), r, size: 0.45 + 0.6 * k.rand() });
      }
      k.cloud({ share: 0.03, pattern: false, part: k.part("sparkle") }, (rand) => {
        const g = glints[Math.floor(rand() * glints.length)];
        const dir = rand() < 0.5 ? f.right : f.up;
        const u = rand() * 2 - 1;
        return {
          p: add(g.p, mul(dir, u * 0.04 * g.size)),
          dir,
          stretch: 3,
          color: mix("#ffffff", "#fff0c0", Math.abs(u)),
          opacity: 0.95,
          size: g.size * (1 - 0.75 * Math.abs(u)) * S,
          kind: "grow",
          params: [g.r * 0.95, 0],
        };
      });
    },
  },

  "aurora-planet": {
    alive: true,
    controls: [{ key: "surge", label: "Surge", type: "pulse", ease: 4.2 }],
    action: { key: "surge", label: "Auroral surge" },
    // The curtains move all the time: bright folds race round the oval
    // (a glow running along it, three at a time), the rays flicker and the
    // oval sways. A tap sets off a substorm: the oval flares, a second,
    // wider curtain with violet tops bursts out towards the equator, and
    // the folds race brighter, then it all calms.
    drive(t, c, out) {
      const p = progress(c.surge);
      const on = c.surge > 0 ? 1 : 0;
      const surge = on * bump(p, 0.02, 0.14, 0.5, 0.95);
      out.parts.oval = {
        angle: 0.06 * Math.sin(t * 0.45) + 0.03 * Math.sin(t * 1.3),
        visible: 1 + 0.4 * surge,
      };
      out.parts.burst = {
        angle: 0.05 * Math.sin(t * 0.5 + 1),
        visible: 1.3 * on * bump(p, 0.05, 0.2, 0.45, 0.9),
        scale: 0.97 + 0.03 * ease(band(p, 0.05, 0.4)),
      };
      out.glow = [0.55, 1, 0.75, 0.9 + 2.2 * surge];
      out.amount = 1 + 1.5 * surge;
    },
    build(k) {
      const noise = k.noise;
      // The night side of an Earth-like world, its pole tipped towards the
      // viewer so the auroral oval shows.
      const q = faceCamera(30 * DEG, -10 * DEG);
      const SEA = 0.07;
      globe(k, {
        quat: q,
        core: layers(["#fff1b0", "#ffc04a", "#ff7a2a", "#c2451e", "#3a2a3a"]),
        col: (c, d) => {
          const h = noise.fbm(d[0] * 1.3 + 3.1, d[1] * 1.3 - 1.7, d[2] * 1.3 + 0.5, 5);
          if (h < SEA) {
            const deep = smoothstep(0, 0.2, SEA - h);
            return lit(mix("#16305e", "#0a1a3a", deep), c.n, 0.3);
          }
          // Towns: warm lights scattered over the land, thickest near the coasts.
          const coast = 1 - smoothstep(0, 0.08, h - SEA);
          const busy = smoothstep(
            0.02,
            0.2,
            noise.fbm(d[0] * 5 + 7, d[1] * 5, d[2] * 5, 3) + 0.15 * coast,
          );
          if (c.rand() < 0.02 + 0.3 * busy * (0.4 + 0.6 * coast))
            return keep(mix("#ffc45a", "#fff0c0", c.rand()), 0.8);
          return lit(mix("#1d2a26", "#2a2a24", smoothstep(0, 0.1, h - SEA)), c.n, 0.3);
        },
      });
      halo(k, {
        r0: 1,
        r1: 1.06,
        share: 0.04,
        size: 2,
        opacity: 0.12,
        falloff: 1.2,
        col: (t) => mix("#3a78ff", "#1a3a9a", t),
      });
      // Auroral curtains round both poles: green below, pink at the top.
      // Most splats carry a running glow (three bright folds round the
      // oval); the rest flicker like rays.
      const north = quatRotate(q, [0, 1, 0]);
      const [e1, e2] = basis(north);
      const curtain = (part, share, colat0, violet) =>
        k.cloud({ share, pattern: false, part }, (rand) => {
          const southern = !violet && rand() < 0.25;
          const a = rand() * TAU;
          const colat =
            colat0 +
            0.05 * Math.sin(3 * a + 1) +
            0.04 * noise(Math.cos(a) * 2, Math.sin(a) * 2, 3) +
            gauss(rand) * 0.02;
          const fold = 0.025 * Math.sin(a * 22 + 3 * noise(Math.cos(a) * 4, Math.sin(a) * 4, 7));
          const th = colat + fold;
          const pole = southern ? mul(north, -1) : north;
          const d = unit(
            add(
              mul(pole, Math.cos(th)),
              add(mul(e1, Math.sin(th) * Math.cos(a)), mul(e2, Math.sin(th) * Math.sin(a))),
            ),
          );
          const hgt = Math.pow(rand(), violet ? 1.1 : 1.6);
          const soft = rand() < 0.3;
          const bright = 0.6 + 0.4 * noise(Math.cos(a) * 6, Math.sin(a) * 6, 1.5);
          const top = violet ? 0.55 : 0.8;
          const ray = rand() < 0.3;
          return {
            p: mul(d, 1.015 + (violet ? 0.11 : 0.085) * hgt * (southern ? 0.7 : 1)),
            dir: d,
            stretch: 3,
            color:
              hgt < top
                ? ramp(["#e0fff0", "#6effa8", "#2ee88a", "#26d080"], hgt / top)
                : mix(
                    violet ? "#40d890" : "#26d080",
                    violet ? "#c050e0" : "#e05ac0",
                    (hgt - top) / (1 - top),
                  ),
            opacity: (soft ? 0.1 : 0.45 * (1 - hgt) + 0.05) * bright * (southern ? 0.6 : 1),
            size: soft ? 2.6 : 0.9 + 0.5 * rand(),
            kind: ray ? "twinkle" : "pulse",
            params: ray ? [0.6, rand() * TAU] : [(((3 * a) / TAU) % 1) * 0.999, 0],
          };
        });
      curtain(k.part("oval", { axis: north }), 0.2, 0.42, false);
      // The substorm's curtain (hidden until a tap): further from the pole,
      // taller and violet at the top.
      curtain(k.part("burst", { axis: north }), 0.08, 0.56, true);
    },
  },

  meteor: {
    alive: true,
    controls: [{ key: "fall", label: "Fall", type: "pulse", ease: 5.4 }],
    action: { key: "fall", label: "Streak in and burst" },
    // A tap sends it streaking in from the upper right; it bursts in a
    // fireball, its rock flying apart in glowing fragments that burn out
    // and its trail snuffed out. Then the next one streaks in to take its
    // place.
    drive(t, c, out) {
      const p = progress(c.fall);
      const on = c.fall > 0 ? 1 : 0;
      const BURST = 0.07;
      const NEXT = 0.62;
      const away = on ? (p < NEXT ? 1 - ease(band(p, 0, BURST)) : 1 - ease(band(p, NEXT, 0.8))) : 0;
      out.body = { offset: mul(METEOR_T, 1.9 * away * away) };
      const blown = on && p >= BURST && p < NEXT;
      const b = easeOut(band(p, BURST, 0.5));
      out.tokens = METEOR_CELLS.map((cell) =>
        blown
          ? {
              base: cell.c,
              offset: mul(cell.dir, 0.55 * b * cell.dist),
              quat: quatAxisAngle(cell.axis, b * cell.spin),
              visible: 1 - band(p, 0.18, 0.46),
            }
          : { base: cell.c },
      );
      out.parts.trail = { visible: blown ? 1 - band(p, BURST, 0.14) : 1 };
      out.parts.fire = {
        scale: 0.35 + 1.9 * easeOut(band(p, BURST, 0.4)),
        visible: blown ? 1.8 * bump(p, BURST, BURST + 0.02, 0.12, 0.45) : 0,
      };
      out.parts.sparks = {
        scale: 0.25 + 2.2 * easeOut(band(p, BURST, 0.45)),
        visible: blown ? 1 - band(p, 0.16, 0.34) : 0,
      };
      out.parts.smoke = {
        scale: 0.6 + 1.6 * easeOut(band(p, 0.1, 0.6)),
        visible: blown ? bump(p, 0.1, 0.2, 0.35, 0.6) : 0,
      };
      out.amount = 1 + (blown ? 1.5 * (1 - band(p, BURST, 0.3)) : 0);
    },
    build(k) {
      const noise = k.noise;
      const S = budgetScale(k);
      const f = camFrame();
      // It falls down and to the left; its trail of fire streams up and back.
      const T = unit(add([0, 1, 0], mul(f.right, 0.75)));
      const L = 2.3;
      const R = 0.22;
      // The rock, glowing white-hot on its leading face.
      const craters = craterField(k.rand, { count: 30, min: 0.1, max: 0.3, power: 1.5 });
      const nearest = (p) => {
        let best = 0;
        let bd = Infinity;
        METEOR_CELLS.forEach((cell, i) => {
          const d = len(sub(p, cell.c));
          if (d < bd) [bd, best] = [d, i];
        });
        return best;
      };
      const rock = rockyBody(k, {
        craters,
        grid: 72,
        scale: R,
        share: 0.08,
        kind: "token",
        params: (c) => [nearest(c.p), 0],
        shapeR: tabulate(
          (d) =>
            (1 / Math.hypot(d[0] / 1.15, d[1] / 0.9, d[2])) *
            (1 + 0.15 * noise.fbm(d[0] + 5, d[1], d[2], 3)),
          64,
          32,
        ),
        litAmount: 0.4,
        core: "#ff9a40",
        albedo: (c, d) => {
          const hot = smoothstep(0.15, 0.9, -dot(unit(c.n), T));
          const rockCol = shade("#4a403a", 1 + 0.2 * c.noise(d[0] * 8, d[1] * 8, d[2] * 8));
          return mix(rockCol, mix("#ff6a1a", "#fff0b0", hot), clamp01(hot * 1.3));
        },
      });
      rock.opts.size = coverSize(k, rock.area, 0.08);
      rock.opts.pattern = false;
      // The trail and the glow round the rock (a part, snuffed out by the
      // burst).
      const trail = k.part("trail");
      // A glowing sheath of hot air around the front.
      halo(k, {
        part: trail,
        center: mul(T, -0.05),
        r0: R * 0.95,
        r1: R * 1.45,
        share: 0.03,
        size: 2 * S,
        opacity: 0.16,
        falloff: 1.6,
        twinkle: 0.3,
        col: (t) => mix("#fff2b0", "#ff7a2a", t),
      });
      // The fire trail: splats that rise, shrink and redden.
      k.cloud({ share: 0.36, pattern: false, kind: "flame", part: trail }, (rand) => {
        const s = Math.pow(rand(), 1.15);
        const w = R * (0.35 + 1.1 * s);
        const [e1, e2] = basis(T);
        const p = add(
          mul(T, R * 0.4 + s * L),
          add(mul(e1, gauss(rand) * w * 0.45), mul(e2, gauss(rand) * w * 0.45)),
        );
        return {
          p,
          color: ramp(["#fffbe8", "#ffe680", "#ffa838", "#ff5a1a"], s),
          opacity: 0.7 * (1 - s) + 0.08,
          size: (1.9 - 0.8 * s) * S,
          params: [0.05 + 0.12 * rand() * (1 - s), rand()],
        };
      });
      // Smoke left behind, and sparks.
      k.cloud({ share: 0.05, pattern: false, kind: "rise", part: trail }, (rand) => {
        const s = 0.5 + 0.5 * rand();
        const [e1, e2] = basis(T);
        const w = R * (0.8 + 1.6 * s);
        return {
          p: add(
            mul(T, s * L * 1.1),
            add(mul(e1, gauss(rand) * w * 0.5), mul(e2, gauss(rand) * w * 0.5)),
          ),
          color: mix("#8a7e76", "#5a524e", rand()),
          opacity: 0.05,
          size: 3 * S,
          params: [0.15, rand()],
        };
      });
      k.cloud({ share: 0.03, pattern: false, kind: "rise", part: trail }, (rand) => {
        const s = rand();
        return {
          p: add(mul(T, R + s * L * 0.8), mul(randDir(rand), R * (0.5 + 1.5 * s))),
          color: mix("#fff0a0", "#ff8a2a", rand()),
          opacity: 0.9,
          size: 0.6 * S,
          params: [0.6 + rand() * 0.4, rand()],
        };
      });
      // The burst (hidden until a tap): a fireball and a spray of sparks,
      // built small round the rock and grown by their parts' scale.
      k.cloud({ share: 0.05, pattern: false, part: k.part("fire") }, (rand) => {
        const t = Math.pow(rand(), 0.6);
        const d = randDir(rand);
        // Billows: the edge is lumpy, not a clean ball.
        const lump = 1 + 0.25 * noise(d[0] * 3, d[1] * 3 + 5, d[2] * 3);
        return {
          p: mul(d, R * 1.3 * t * lump),
          color: ramp(["#ffffff", "#fff0a0", "#ffb040", "#ff6a1a", "#b02a0a"], t),
          opacity: 0.32 * (1 - t) + 0.05,
          size: (2.6 + 1.8 * t) * S,
        };
      });
      k.cloud({ share: 0.01, pattern: false, part: k.part("sparks") }, (rand) => {
        const d = randDir(rand);
        const r = R * (0.6 + 1.6 * Math.pow(rand(), 0.5));
        return {
          p: mul(d, r),
          dir: d,
          stretch: 4,
          color: mix("#fff4c0", "#ffb050", rand()),
          opacity: 0.8,
          size: 0.45 * S,
        };
      });
      // The smoke left by the burst: a grey puff that spreads and fades.
      k.cloud({ share: 0.02, pattern: false, part: k.part("smoke") }, (rand) => ({
        p: mul(randDir(rand), R * 1.2 * Math.cbrt(rand())),
        color: mix("#5a524c", "#8a7e76", rand()),
        opacity: 0.12,
        size: 3.2 * S,
      }));
      k.reach(mul(T, L + 0.45));
    },
  },
};
