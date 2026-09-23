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
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const keep = (c, size) => ({ c, keep: true, size });
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x) => 1 - (1 - x) * (1 - x) * (1 - x);
// Roughly normal random numbers (mean 0, sd 1).
const gauss = (rand) => (rand() + rand() + rand() + rand() - 2) * 1.73;
const randDir = (rand) => {
  const z = rand() * 2 - 1;
  const a = rand() * TAU;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), z, r * Math.sin(a)];
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
function glowPath(k, path, { share = 0.01, width = 0.03, size = 1.6, opacity = 0.4, col, twinkle = 0.4, part }) {
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
  },
) {
  const radius = (d) => shapeR(d) * (1 + craters.height(d));
  return k.add(k.radial(radius, { grid }), {
    flat: 0.22,
    interior,
    core,
    part,
    pos,
    scale,
    weight,
    share,
    color: (c) => {
      const d = unit(c.lp);
      const base = albedo(c, d);
      const r = clamp(relief(c, reliefAmount), -0.55, 0.45);
      return lit(shade(base, 1 + r), c.n, litAmount);
    },
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
  },
) {
  const shape = oblate === 1 ? k.sphere(r) : k.ellipsoid(r, r * oblate, r);
  const item = k.add(shape, {
    quat,
    pos,
    part,
    flat,
    interior,
    core,
    kind,
    params,
    share,
    weight,
    color: (c) => col(c, unit([c.lp[0], c.lp[1] / oblate, c.lp[2]])),
  });
  // A fixed share (only used in toys with no weighted surfaces) gets a
  // splat size that covers it.
  if (share !== undefined) item.opts.size = coverSize(k, item.area, share);
  return item;
}

// A core in layers for Slice: stops from the centre out.
const layers = (stops, R = 1) => (c) => ramp(stops, clamp01(len(c.lp) / R));

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
  for (const [r0, r1, opacity, col, share] of list) {
    const item = k.add(k.disc(r1, r0), {
      quat,
      pos,
      part,
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

function earthSurface(noise, facing = [0, 0, 0]) {
  const SEA = 0.07;
  return (c, d) => {
    const h = noise.fbm(d[0] * 1.3 + 3.1, d[1] * 1.3 - 1.7, d[2] * 1.3 + 0.5, 5) + 0.07 * dot(d, facing);
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

function earthClouds(k, noise, { r = 1.022, share = 0.15, part, q, pos = [0, 0, 0], scale = 1 }) {
  k.cloud({ share, size: 1.15, part, pattern: false }, (rand) => {
    for (let tries = 0; tries < 6; tries++) {
      const d = randDir(rand);
      const lat = Math.abs(d[1]);
      // Swirls: noise stretched east-west and folded by two warps.
      const w1 = noise.fbm(d[0] * 1.5 + 20, d[1] * 1.5, d[2] * 1.5, 3);
      const w2 = noise.fbm(d[0] * 1.5 + 40, d[1] * 1.5, d[2] * 1.5, 3);
      let v = noise.fbm(d[0] * 3 + w1 * 3, d[1] * 7 + w2 * 2, d[2] * 3 - w1 * 3, 5);
      // Cloudy along the equator and at high latitudes, clear in the subtropics.
      v += 0.06 * (1 - smoothstep(0.05, 0.18, lat));
      v -= 0.06 * smoothstep(0.18, 0.3, lat) * (1 - smoothstep(0.45, 0.6, lat));
      v += 0.04 * smoothstep(0.55, 0.75, lat);
      if (v < 0.1) continue;
      const dense = smoothstep(0.1, 0.24, v);
      const n = q ? quatRotate(q, d) : d;
      return {
        p: add(pos, mul(n, r * scale)),
        n,
        flat: 0.2,
        color: mix("#d4dde6", "#ffffff", dense),
        opacity: 0.2 + 0.72 * dense,
        size: 0.9 + 0.5 * rand(),
        part,
      };
    }
    return null;
  });
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
        if (g < 1) col = mix(mix("#b8452c", "#d9754c", smoothstep(0.2, 1, g + swirl * 0.25)), col, smoothstep(0.85, 1, g));
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
// gap, and the thin F ring.
function saturnRings(k, noise, { R = 1, quat, part, pos, shares = [0.05, 0.15, 0.09, 0.008], glint = 0 }) {
  const fine = (r, f, a) => 1 + a * Math.sin(r * f) + a * 0.6 * noise(r * 60, 0.5, 0.5);
  rings(
    k,
    [
      [1.24 * R, 1.52 * R, 0.4, (r) => shade("#8e7f69", fine(r / R, 90, 0.08)), shares[0]],
      [
        1.52 * R,
        1.95 * R,
        0.95,
        (r) => {
          const x = (r / R - 1.52) / 0.43;
          return shade(mix("#d8c396", "#efe0b8", smoothstep(0.1, 0.6, x)), fine(r / R, 140, 0.07));
        },
        shares[1],
      ],
      [
        2.03 * R,
        2.27 * R,
        0.85,
        (r) => {
          const x = r / R;
          if (Math.abs(x - 2.215) < 0.008) return null;
          return shade("#cdb994", fine(x, 120, 0.06));
        },
        shares[2],
      ],
      [2.315 * R, 2.335 * R, 0.6, () => "#e6d8b8", shares[3]],
    ],
    { quat, part, pos, glint },
  );
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
  { id: "mercury", r: 0.36, size: 0.04, w: 0.42, phase: 0.6, share: 0.012 },
  { id: "venus", r: 0.48, size: 0.062, w: 0.31, phase: 2.5, share: 0.02 },
  { id: "earth", r: 0.61, size: 0.065, w: 0.25, phase: 4.2, share: 0.024 },
  { id: "mars", r: 0.73, size: 0.05, w: 0.2, phase: 5.6, share: 0.016 },
  { id: "jupiter", r: 1.0, size: 0.145, w: 0.11, phase: 0.9, share: 0.06 },
  { id: "saturn", r: 1.25, size: 0.12, w: 0.08, phase: 3.3, share: 0.045 },
  { id: "uranus", r: 1.45, size: 0.085, w: 0.058, phase: 5.9, share: 0.028 },
  { id: "neptune", r: 1.61, size: 0.082, w: 0.046, phase: 2.2, share: 0.028 },
];

// Supernova debris flies apart in chunks (each one a part).
const CHUNKS = fibonacciSphere(13);

// Galaxy tilts (applied as a part, after the stars orbit in the disc).
const ANDROMEDA_TILT = faceCamera(-31 * DEG, -34 * DEG, 0.55, 0.9);

// ---- Recipes ------------------------------------------------------------------------

export const RECIPES = {
  sun: {
    alive: true,
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
              col = x < 0.45 ? mix("#2a0f04", "#5a2208", x / 0.45) : mix("#8a3a0e", col, smoothstep(0.8, 1, x));
            } else if (x < 2.4) {
              col = mix(col, "#fff3b0", 0.4 * (1 - (x - 1) / 1.4));
            }
          }
          return col;
        },
      });
      // Prominences: loops of glowing gas arching off the limb.
      const loops = [
        { a: 0.55, span: 0.2, h: 0.3 },
        { a: 2.35, span: 0.14, h: 0.24 },
        { a: 3.7, span: 0.24, h: 0.34 },
        { a: 5.35, span: 0.11, h: 0.2 },
        { a: 1.5, span: 0.16, h: 0.26, lift: -0.45 },
        { a: 4.5, span: 0.18, h: 0.26, lift: 0.4 },
      ];
      for (const L of loops) {
        const mid = limbDir(L.a, cam, L.lift || 0);
        const side = unit(cross(mid, cam));
        const tw = (k.rand() - 0.5) * 0.8;
        const along = unit(add(side, mul(cross(mid, side), tw)));
        const pts = [];
        for (let i = 0; i <= 8; i++) {
          const s = i / 8;
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
        });
      }
      // The corona: a soft glow with faint streamers.
      halo(k, {
        r0: 0.99,
        r1: 1.32,
        share: 0.08,
        size: 3.2,
        opacity: 0.25,
        falloff: 1.8,
        twinkle: 0.25,
        col: (t) => mix("#ffc24a", "#ff6a1a", t),
      });
      k.cloud({ share: 0.01, size: 1.4, pattern: false }, (rand) => {
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
    },
  },

  mercury: {
    build(k) {
      const craters = craterField(k.rand, { count: 380, min: 0.016, max: 0.19, rays: 3 });
      const noise = k.noise;
      rockyBody(k, {
        craters,
        core: layers(["#8a5a3a", "#9a7a62", "#7d746b"]),
        albedo: (c, d) => {
          const plains = smoothstep(0.02, 0.12, noise.fbm(d[0] * 1.5 + 4, d[1] * 1.5, d[2] * 1.5, 4));
          let col = mix("#a89c8c", "#7e756b", plains * 0.8);
          col = shade(col, 1 + 0.08 * c.noise(d[0] * 36, d[1] * 36, d[2] * 36));
          const L = craters.look(d, c.noise);
          col = shade(col, 1 - 0.06 * L.floor);
          return mix(col, "#e8e2d6", clamp01(L.ray) * 0.55);
        },
      });
    },
  },

  venus: {
    build(k) {
      const noise = k.noise;
      globe(k, {
        core: layers(["#d9a24a", "#b8683a", "#9a5a3a", "#c9a06a"]),
        col: (c, d) => {
          // Sulphuric cloud tops: soft bands folded into Y-shaped chevrons.
          const w = noise.fbm(d[0] * 1.2 + 4, d[1] * 1.2, d[2] * 1.2, 2);
          const v = noise.fbm(
            d[0] * 1.4 + Math.abs(d[1]) * 2.2 + w,
            d[1] * 5 + w,
            d[2] * 1.4 - Math.abs(d[1]) * 1.5,
            4,
          );
          const col = ramp(["#b88a4a", "#d8b273", "#ecd49e", "#f8eac2"], clamp01(0.5 + v * 2.2));
          return lit(col, c.n, 0.3);
        },
      });
      halo(k, { r0: 1, r1: 1.07, share: 0.035, size: 2, opacity: 0.16, falloff: 1.3, col: (t) => mix("#fff2cc", "#ffd890", t) });
    },
  },

  earth: {
    build(k) {
      const noise = k.noise;
      const q = quatEuler(0, 0, -23.4);
      const surface = earthSurface(noise, quatRotate([-q[0], -q[1], -q[2], q[3]], camDir()));
      globe(k, {
        quat: q,
        core: layers(["#fff1b0", "#ffc04a", "#ff7a2a", "#c2451e", "#7a3a22"]),
        // A continent faces the viewer.
        col: (c, d) => lit(surface(c, d), c.n, 0.3),
      });
      earthClouds(k, noise, { q, share: 0.12 });
      halo(k, { r0: 1.0, r1: 1.08, share: 0.04, size: 2, opacity: 0.16, falloff: 1.2, col: (t) => mix("#7cc6ff", "#3a7cff", t) });
    },
  },

  moon: {
    build(k) {
      const craters = craterField(k.rand, { count: 260, min: 0.02, max: 0.2, rays: 2 });
      const noise = k.noise;
      const cam = camDir();
      rockyBody(k, {
        craters,
        core: layers(["#c9a06a", "#8a7a6a", "#6a6560"]),
        shapeR: tabulate((d) => 1 + 0.01 * noise.fbm(d[0] * 2 + 3, d[1] * 2, d[2] * 2, 3)),
        albedo: (c, d) => {
          // Maria: broad dark plains, mostly on the side facing the viewer.
          const m = noise.fbm(d[0] * 1.5 + 7, d[1] * 1.5, d[2] * 1.5, 4) + 0.12 * dot(d, cam) - 0.02;
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
    },
  },

  mars: {
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
      halo(k, { r0: 1, r1: 1.05, share: 0.03, size: 2, opacity: 0.12, falloff: 1.3, col: (t) => mix("#ffc8a0", "#e08a60", t) });
    },
  },

  jupiter: {
    alive: true,
    build(k) {
      const noise = k.noise;
      const surf = jupiterSurface(noise, { lon0: 0.3 });
      globe(k, {
        oblate: 0.935,
        flat: 0.3,
        core: layers(["#6a5646", "#5f6f82", "#8a8aa0", "#c7a987", "#d9c4a0"]),
        // The Great Red Spot and the white ovals shimmer.
        kind: "twinkle",
        params: (c) => {
          const d = unit([c.lp[0], c.lp[1] / 0.935, c.lp[2]]);
          let storm = ovalDist(d, -0.39, 0.3, 0.17, 0.085) < 1.2 ? 0.14 : 0;
          for (let i = 0; i < 5 && !storm; i++)
            if (ovalDist(d, -0.6, 1.2 + i * 0.55, 0.05, 0.035) < 1) storm = 0.2;
          return [storm, c.rand() * TAU];
        },
        col: (c, d) => lit(surf(c, d), c.n, 0.3),
      });
    },
  },

  saturn: {
    alive: true,
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
      saturnRings(k, noise, { quat: q, shares: [0.06, 0.2, 0.12, 0.01], glint: 0.3 });
    },
  },

  uranus: {
    alive: true,
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
          return lit(shade(col, 1 + 0.04 * Math.sin(y * 40) + 0.03 * noise(d[0] * 8, d[1] * 30, d[2] * 8)), c.n, 0.3);
        },
      });
      const ring = (r0, r1, op, share) => [r0, r1, op, () => "#c8d6dc", share];
      rings(
        k,
        [
          ring(1.42, 1.43, 0.5, 0.012),
          ring(1.47, 1.48, 0.5, 0.012),
          ring(1.52, 1.535, 0.55, 0.014),
          ring(1.58, 1.59, 0.5, 0.012),
          ring(1.7, 1.75, 0.75, 0.05),
        ],
        { quat: q, flat: 0.1, glint: 0.3 },
      );
    },
  },

  neptune: {
    build(k) {
      const noise = k.noise;
      const q = quatEuler(0, 0, -28);
      const lon0 = 0.5;
      globe(k, {
        quat: q,
        core: layers(["#5a5a70", "#3a5aa0", "#3a64d0", "#4a70dc"]),
        col: (c, d) => {
          const y = d[1] + 0.025 * noise.fbm(d[0] * 3, d[1] * 12, d[2] * 3, 3);
          let col = bandAt(
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
          if (s < 1) col = mix("#152470", col, smoothstep(0.55, 1, s));
          const w = ovalDist(d, -0.5, lon0 + 0.05, 0.18, 0.03);
          if (w < 1) col = mix("#f2f7ff", col, smoothstep(0.3, 1, w));
          const s2 = ovalDist(d, -0.95, lon0 + 1.2, 0.08, 0.05);
          if (s2 < 1) col = mix("#1a2c80", col, smoothstep(0.4, 1, s2));
          // High white cirrus streaks.
          const streak = noise(d[0] * 2.5 + 7, d[1] * 22, d[2] * 2.5);
          const lat = latOf(d);
          const zone = Math.exp(-(((lat + 0.55) / 0.07) ** 2)) + Math.exp(-(((lat - 0.42) / 0.06) ** 2)) * 0.8;
          col = mix(col, "#eef4ff", clamp01(smoothstep(0.18, 0.4, streak) * zone));
          return lit(col, c.n, 0.3);
        },
      });
      halo(k, { r0: 1, r1: 1.06, share: 0.03, size: 2, opacity: 0.14, falloff: 1.3, col: (t) => mix("#9ab8ff", "#4a70ff", t) });
    },
  },
  asteroid: {
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
      rockyBody(k, {
        craters,
        shapeR,
        grid: 120,
        core: layers(["#5a5048", "#6e655c", "#7d746a"], 1.2),
        litAmount: 0.6,
        reliefAmount: 1.2,
        albedo: (c, d) => {
          const tone = noise.fbm(d[0] * 2.5 + 9, d[1] * 2.5, d[2] * 2.5, 3);
          const col = mix("#7a7064", "#a09584", clamp01(0.5 + tone * 2.5));
          return shade(col, 1 + 0.1 * c.noise(d[0] * 30, d[1] * 30, d[2] * 30));
        },
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
    drive(t, c, out) {
      // Only the Andromeda-like style has this part: its disc is tilted
      // after the stars orbit in it.
      out.parts.tilt = { quat: ANDROMEDA_TILT };
    },
    build(k, o) {
      const andro = o.style === "andromeda";
      const S = budgetScale(k);
      const s2 = Math.sqrt(S);
      const part = andro ? k.part("tilt") : 0;
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
      const cloud = (share, fall, fn) =>
        k.cloud({ share, pattern: false, part, kind: "orbit", params: orbit(fall) }, fn);

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
      cloud(andro ? 0.12 : 0.09, 1, (rand) => {
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
      });
      if (!andro) {
        // The bar, turning as one piece with the arms.
        k.cloud({ share: 0.05, pattern: false, kind: "orbit", params: orbit(0) }, (rand) => {
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
      cloud(andro ? 0.26 : 0.36, 0.35, (rand) => {
        const x = rand();
        return {
          p: onArm(rand, andro ? 0.035 : 0.04),
          color: x < 0.55 ? mix("#7fa4ff", "#b0c8ff", rand()) : x < 0.85 ? "#e8eeff" : "#ffe0b0",
          opacity: 0.8,
          size: (0.7 + 0.8 * rand()) * s2,
        };
      });
      // Dark dust lanes along the inner edges of the arms.
      cloud(andro ? 0.12 : 0.08, 0.35, (rand) => ({
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
      cloud(0.05, 0.35, (rand) => {
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
    },
  },

  nebula: {
    alive: true,
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
          p: [axisOf(pl, 1) + gauss(rand) * 0.06, pl.top + 0.02 + 0.12 * s, pl.z + gauss(rand) * 0.04],
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
    },
  },

  "solar-system": {
    alive: true,
    drive(t, c, out) {
      for (const P of ORRERY) {
        const th = P.phase + P.w * t;
        out.parts[P.id] = {
          offset: [P.r * (Math.sin(th) - Math.sin(P.phase)), 0, P.r * (Math.cos(th) - Math.cos(P.phase))],
        };
      }
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
          const r = 0.8 + 0.05 * rand();
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
        const pos = [P.r * Math.sin(P.phase), 0, P.r * Math.cos(P.phase)];
        const part = k.part(P.id, { pivot: pos });
        globe(k, {
          r: P.size,
          pos,
          part,
          quat: P.id === "saturn" ? saturnTilt : undefined,
          oblate: P.id === "saturn" ? 0.9 : P.id === "jupiter" ? 0.94 : 1,
          share: P.share,
          flat: 0.35,
          interior: 0,
          col: (c, d) => lit(looks[P.id](c, d), c.n, 0.4),
        });
        if (P.id === "saturn")
          saturnRings(k, noise, {
            R: P.size * 0.82,
            quat: saturnTilt,
            part,
            pos,
            shares: [0.004, 0.014, 0.009, 0.001],
          });
      }
      for (const x of [-1, 1]) {
        k.reach([1.7 * x, 0, 0]);
        k.reach([0, 0, 1.7 * x]);
      }
    },
  },

  comet: {
    alive: true,
    build(k) {
      const noise = k.noise;
      const S = budgetScale(k);
      const f = camFrame();
      // The tails point away from the Sun: up and to the right on screen.
      const T = unit(add(f.up, mul(f.right, 0.55)));
      const B = unit(cross(T, f.c));
      const L = 2.7;
      // The nucleus: a small dark lumpy rock.
      const craters = craterField(k.rand, { count: 24, min: 0.1, max: 0.35, power: 1.5 });
      const nuc = rockyBody(k, {
        craters,
        grid: 64,
        scale: 0.06,
        share: 0.04,
        shapeR: tabulate(
          (d) => (1 / Math.hypot(d[0] / 1.3, d[1] / 0.85, d[2])) * (1 + 0.15 * noise.fbm(d[0] + 3, d[1], d[2], 3)),
          64,
          32,
        ),
        albedo: (c, d) => shade("#5e5650", 1 + 0.15 * c.noise(d[0] * 9, d[1] * 9, d[2] * 9)),
        litAmount: 0.8,
        core: "#9a9a9a",
      });
      nuc.opts.size = coverSize(k, nuc.area, 0.04);
      // Jets of gas from the sunlit side.
      const jets = [0.5, -0.5, 1.6].map((a) =>
        unit(add(mul(T, -1), add(mul(B, Math.sin(a) * 0.9), mul(f.c, Math.cos(a) * 0.4)))),
      );
      k.cloud({ share: 0.015, pattern: false, kind: "twinkle" }, (rand) => {
        const j = jets[Math.floor(rand() * jets.length)];
        const s = rand();
        return {
          p: add(mul(j, 0.06 + s * 0.22), mul(randDir(rand), 0.006 + 0.03 * s)),
          color: "#f0fffb",
          opacity: 0.45 * (1 - s),
          size: 1.1 * S,
          params: [0.3, rand() * TAU],
        };
      });
      // The coma: a bright heart in a soft green-blue glow.
      k.cloud({ share: 0.12, pattern: false, kind: "twinkle" }, (rand) => {
        const t = Math.pow(rand(), 1.3);
        const r = 0.03 + 0.36 * t;
        const p = add(mul(randDir(rand), r * (0.4 + 0.6 * rand())), mul(T, r * 0.5));
        return {
          p,
          color: ramp(["#ffffff", "#e8fff8", "#9af2de", "#52c8d0"], t),
          opacity: 0.16 * Math.pow(1 - t, 2) + 0.012,
          size: (1 + 3.2 * t) * S,
          params: [0.12, rand() * TAU],
        };
      });
      // The straight blue ion tail, in fine streamers.
      k.cloud({ share: 0.26, pattern: false, kind: "rise" }, (rand) => {
        const s = Math.pow(rand(), 0.85);
        const ray = Math.floor(rand() * 7) - 3;
        const along = s * L;
        const off = ray * 0.018 * along + gauss(rand) * (0.008 + 0.01 * along);
        const p = add(
          mul(T, 0.04 + along),
          add(mul(B, off - 0.025 * along), mul(f.c, gauss(rand) * 0.02 * along)),
        );
        return {
          p,
          dir: T,
          stretch: 6,
          color: ramp(["#eef6ff", "#8ec2ff", "#4f82ff", "#3c4ce0"], s),
          opacity: 0.36 * Math.pow(1 - s, 0.9) + 0.03,
          size: (0.7 + 0.5 * rand()) * S,
          params: [0.3, rand()],
        };
      });
      // The broad yellow-white dust tail, curving away.
      k.cloud({ share: 0.3, pattern: false, kind: "rise" }, (rand) => {
        const s = Math.pow(rand(), 0.75);
        const c0 = add(mul(T, s * L * 0.82), mul(B, 0.36 * s * s * L));
        const w = 0.03 + 0.34 * s;
        const p = add(c0, add(mul(B, gauss(rand) * w * 0.5), mul(f.c, gauss(rand) * w * 0.2)));
        return {
          p,
          color: ramp(["#fffdf0", "#ffeeb8", "#f8d27e", "#e8b060"], s),
          opacity: 0.26 * Math.pow(1 - s, 1.2) + 0.02,
          size: (1.3 + 2.6 * s) * S,
          params: [0.12, rand()],
        };
      });
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
    build(k, o) {
      const T = STAR_TYPES[o.type] || STAR_TYPES.yellow;
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
        kind: "twinkle",
        params: (c) => [0.18, c.rand() * TAU],
        color: (c) => {
          const d = c.ln;
          const g = smoothstep(0, 0.16, Math.abs(c.noise(d[0] * T.freq, d[1] * T.freq, d[2] * T.freq)));
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
            pts.push(mul(unit(add(mid, mul(along, (s - 0.5) * 0.4))), 0.97 + 0.42 * Math.sin(Math.PI * s)));
          }
          glowPath(k, spline(pts), {
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
        k.cloud({ share: 0.04, pattern: false, kind: "twinkle" }, (rand) => {
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
    },
  },

  pulsar: {
    alive: true,
    controls: [{ key: "spin", label: "Spin speed", type: "slider", default: 0.35 }],
    drive(t, c, out) {
      out.parts.star = { angle: spinAngle(c, t, 0.8 + 5 * c.spin) };
    },
    build(k) {
      const S = budgetScale(k);
      const axis = unit([0.12, 1, 0.06]);
      const star = k.part("star", { axis });
      // The magnetic axis, tipped 40 degrees from the spin axis.
      const m = unit(quatRotate(quatAxisAngle(unit(cross(axis, [0, 0, 1])), 40 * DEG), axis));
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
    },
  },

  "black-hole": {
    alive: true,
    drive(t, c, out) {
      out.glow = [1, 0.8, 0.55, 0.7];
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
      k.cloud({ share: 0.035, pattern: false, kind: "twinkle" }, (rand) => {
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
    },
  },

  "planetary-nebula": {
    alive: true,
    build(k) {
      const noise = k.noise;
      const S = budgetScale(k);
      const f = camFrame(0.35, 0.3);
      // A barrel of glowing gas seen almost end-on: a ring.
      const ax = unit(add(f.c, add(mul(f.right, 0.22), mul(f.up, 0.15))));
      const [e1, e2] = basis(ax);
      const P = (r, a, h) =>
        add(add(mul(e1, Math.cos(a) * r), mul(e2, Math.sin(a) * r * 0.84)), mul(ax, h));
      k.cloud({ share: 0.56, pattern: false, kind: "breathe" }, (rand) => {
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
      k.cloud({ share: 0.03, pattern: false, kind: "twinkle" }, (rand) => {
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
      k.cloud({ share: 0.1, pattern: false, kind: "breathe" }, (rand) => {
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
      k.cloud({ share: 0.08, pattern: false }, (rand) => {
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
      const star = globe(k, {
        r: 0.03,
        share: 0.01,
        interior: 0,
        kind: "twinkle",
        params: [0.4, 0],
        col: () => "#ffffff",
      });
      star.opts.pattern = false;
      halo(k, {
        r0: 0.03,
        r1: 0.14,
        share: 0.01,
        size: 1.4 * S,
        opacity: 0.4,
        col: (t) => mix("#ffffff", "#9ac8ff", t),
      });
    },
  },

  supernova: {
    alive: true,
    controls: [{ key: "boom", label: "Explode", type: "pulse", ease: 5 }],
    action: { key: "boom", label: "Explode", sound: "whoosh" },
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
    build(k) {
      const S = budgetScale(k, 0.35);
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
        else [col, size] = [mix("#ffbf40", "#fff0c0", rand() * rand() + 0.5 * inner), 0.5 + 0.4 * rand()];
        return {
          p: mul(randDir(rand), r),
          color: col,
          opacity: 0.92,
          size: size * S,
          params: [0.35 + 0.3 * rand(), rand() * TAU],
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
        };
      });
    },
  },

  "aurora-planet": {
    alive: true,
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
          const busy = smoothstep(0.02, 0.2, noise.fbm(d[0] * 5 + 7, d[1] * 5, d[2] * 5, 3) + 0.15 * coast);
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
      // Auroral curtains round both poles: green below, pink at the top,
      // rippling.
      const north = quatRotate(q, [0, 1, 0]);
      const [e1, e2] = basis(north);
      k.cloud({ share: 0.2, pattern: false, kind: "wave" }, (rand) => {
        const southern = rand() < 0.25;
        const a = rand() * TAU;
        const colat =
          0.42 + 0.05 * Math.sin(3 * a + 1) + 0.04 * noise(Math.cos(a) * 2, Math.sin(a) * 2, 3) + gauss(rand) * 0.02;
        const fold = 0.025 * Math.sin(a * 22 + 3 * noise(Math.cos(a) * 4, Math.sin(a) * 4, 7));
        const th = colat + fold;
        const pole = southern ? mul(north, -1) : north;
        const d = unit(add(mul(pole, Math.cos(th)), add(mul(e1, Math.sin(th) * Math.cos(a)), mul(e2, Math.sin(th) * Math.sin(a)))));
        const hgt = Math.pow(rand(), 1.6);
        const soft = rand() < 0.3;
        const bright = 0.6 + 0.4 * noise(Math.cos(a) * 6, Math.sin(a) * 6, 1.5);
        return {
          p: mul(d, 1.015 + 0.085 * hgt * (southern ? 0.7 : 1)),
          dir: d,
          stretch: 3,
          color:
            hgt < 0.8
              ? ramp(["#e0fff0", "#6effa8", "#2ee88a", "#26d080"], hgt / 0.8)
              : mix("#26d080", "#e05ac0", (hgt - 0.8) / 0.2),
          opacity: (soft ? 0.1 : 0.45 * (1 - hgt) + 0.05) * bright * (southern ? 0.6 : 1),
          size: soft ? 2.6 : 0.9 + 0.5 * rand(),
          params: [0.015, a * 2],
        };
      });
    },
  },

  meteor: {
    alive: true,
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
      const rock = rockyBody(k, {
        craters,
        grid: 72,
        scale: R,
        share: 0.08,
        shapeR: tabulate(
          (d) => (1 / Math.hypot(d[0] / 1.15, d[1] / 0.9, d[2])) * (1 + 0.15 * noise.fbm(d[0] + 5, d[1], d[2], 3)),
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
      // A glowing sheath of hot air around the front.
      halo(k, {
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
      k.cloud({ share: 0.36, pattern: false, kind: "flame" }, (rand) => {
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
      k.cloud({ share: 0.05, pattern: false, kind: "rise" }, (rand) => {
        const s = 0.5 + 0.5 * rand();
        const [e1, e2] = basis(T);
        const w = R * (0.8 + 1.6 * s);
        return {
          p: add(mul(T, s * L * 1.1), add(mul(e1, gauss(rand) * w * 0.5), mul(e2, gauss(rand) * w * 0.5))),
          color: mix("#8a7e76", "#5a524e", rand()),
          opacity: 0.05,
          size: 3 * S,
          params: [0.15, rand()],
        };
      });
      k.cloud({ share: 0.03, pattern: false, kind: "rise" }, (rand) => {
        const s = rand();
        return {
          p: add(mul(T, R + s * L * 0.8), mul(randDir(rand), R * (0.5 + 1.5 * s))),
          color: mix("#fff0a0", "#ff8a2a", rand()),
          opacity: 0.9,
          size: 0.6 * S,
          params: [0.6 + rand() * 0.4, rand()],
        };
      });
      k.reach(mul(T, L + 0.45));
    },
  },

};
