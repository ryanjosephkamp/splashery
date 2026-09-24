// Food pack: sweets, fruit and dinners, many of them doing something. Ice
// cream melts as it warms, popcorn pops, jelly wobbles, candles blow out,
// pancakes flip. There is no lighting in a splat toy, so colour functions
// fake it: a soft light from the upper left front, a painted highlight on
// glossy things, and noise for crumb, peel and grain. Seeds, sprinkles,
// flames, steam, stems and leaves are kept out of the pattern layer.

import {
  mix,
  shade,
  smoothstep,
  clamp,
  spline,
  implicitRadius,
  quatAxisAngle,
  quatEuler,
  quatMul,
  quatRotate,
  rgb,
  vec,
} from "../kit.js";

const TAU = Math.PI * 2;
const { add, sub, mul, dot, len, cross, unit } = vec;

// ---- Light and colour helpers --------------------------------------------------

const LIGHT = unit([-0.45, 0.8, 0.55]);
const VIEW = unit([0.5, 0.32, 0.8]);
const HALF = unit(add(LIGHT, VIEW));

const keep = (c, size) => (size ? { c, keep: true, size } : { c, keep: true });

// Ambient plus a soft direct light.
function lit(c, col, amb = 0.74, dif = 0.36) {
  return shade(col, amb + dif * Math.max(0, dot(c.n, LIGHT)));
}
// A painted specular highlight (0..1).
function spec(c, pow = 40) {
  return Math.pow(Math.max(0, dot(c.n, HALF)), pow);
}
const WHITE = [1, 1, 1];
function glossy(c, col, g = 0.75, pow = 40, amb, dif) {
  return mix(lit(c, col, amb, dif), WHITE, clamp(g * spec(c, pow), 0, 1));
}
// Darker where the surface turns away from the viewer (rims of translucent things).
function rim(c) {
  return 1 - Math.abs(dot(c.n, VIEW));
}

// Integer hash to 0..1 for cell patterns (seeds, crumbs).
function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// A smooth profile through [r, y] points (bottom to top): v in 0..1 -> [r, y].
function profile(points) {
  const seg = points.length - 1;
  return (v) => {
    const x = clamp(v, 0, 1) * seg;
    const i = Math.min(seg - 1, Math.floor(x));
    const t = x - i;
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(seg, i + 2)];
    const cr = (a, b, c, d) =>
      0.5 *
      (2 * b +
        (-a + c) * t +
        (2 * a - 5 * b + 4 * c - d) * t * t +
        (-a + 3 * b - 3 * c + d) * t * t * t);
    return [Math.max(0, cr(p0[0], p1[0], p2[0], p3[0])), cr(p0[1], p1[1], p2[1], p3[1])];
  };
}

// A surface of revolution whose radius can also vary with the angle:
// rmod(angle, y, v) multiplies the profile radius (flutes, pleats, wobbly edges).
function revolve(k, points, rmod = null, opts = {}) {
  const at = profile(points);
  const [a0, a1] = opts.arc || [0, TAU];
  return k.param(
    (u, v) => {
      const [r0, y] = at(v);
      const a = a0 + u * (a1 - a0);
      const r = rmod ? r0 * rmod(a, y, v) : r0;
      return [r * Math.sin(a), y, r * Math.cos(a)];
    },
    { grid: 72, ...opts },
  );
}

// Radius of a revolved profile at height y (profiles must rise steadily).
function radiusAt(points, n = 256) {
  const at = profile(points);
  const table = [];
  for (let i = 0; i <= n; i++) table.push(at(i / n));
  return (y) => {
    if (y <= table[0][1]) return table[0][0];
    for (let i = 1; i <= n; i++) {
      if (table[i][1] >= y) {
        const a = table[i - 1];
        const b = table[i];
        const f = (y - a[1]) / (b[1] - a[1] || 1);
        return a[0] + (b[0] - a[0]) * f;
      }
    }
    return table[n][0];
  };
}

// Rotates a point about Y by `deg` degrees (for placing things in rings).
function turnY(p, deg) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}

// Tabulates a radial function (direction -> distance) on a longitude and
// latitude grid once, then interpolates, so implicit shapes stay fast.
function tabulate(radius, nu = 144, nv = 72) {
  const table = new Float32Array((nu + 1) * (nv + 1));
  for (let j = 0; j <= nv; j++) {
    const th = (j / nv) * Math.PI;
    for (let i = 0; i <= nu; i++) {
      const ph = (i / nu) * TAU - Math.PI;
      const d = [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
      table[j * (nu + 1) + i] = radius(d);
    }
  }
  return (d) => {
    const u = ((Math.atan2(d[0], d[2]) + Math.PI) / TAU) * nu;
    const v = (Math.acos(clamp(d[1], -1, 1)) / Math.PI) * nv;
    const i = Math.min(nu - 1, Math.floor(u));
    const j = Math.min(nv - 1, Math.floor(v));
    const fu = u - i;
    const fv = v - j;
    const a = table[j * (nu + 1) + i];
    const b = table[j * (nu + 1) + i + 1];
    const c = table[(j + 1) * (nu + 1) + i];
    const e = table[(j + 1) * (nu + 1) + i + 1];
    return (a + (b - a) * fu) * (1 - fv) + (c + (e - c) * fu) * fv;
  };
}

// Frames along a mostly level curve: level side n and b roughly up.
// Frames are tabulated once along the curve and interpolated.
function levelFrames(curve, steps = 256) {
  const e = 1e-3;
  const table = [];
  for (let i = 0; i <= steps; i++) {
    const v = i / steps;
    const p = curve(v);
    const t = unit(sub(curve(Math.min(1, v + e)), curve(Math.max(0, v - e))));
    const n = unit(cross([0, 1, 0], t));
    table.push({ p, n, b: cross(t, n) });
  }
  const lerp = (a, b, f) => [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ];
  return (v) => {
    const x = clamp(v, 0, 1) * steps;
    const i = Math.min(steps - 1, Math.floor(x));
    const f = x - i;
    const A = table[i];
    const B = table[i + 1];
    return { p: lerp(A.p, B.p, f), n: lerp(A.n, B.n, f), b: lerp(A.b, B.b, f) };
  };
}

// Random unit vector from a seeded rand.
function randDir(rand) {
  const z = rand() * 2 - 1;
  const a = rand() * TAU;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), z, r * Math.sin(a)];
}

// A random direction tangent to the normal n.
function tangentDir(rand, n) {
  const a = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t1 = unit(cross(n, a));
  const t2 = cross(n, t1);
  const ang = rand() * TAU;
  return add(mul(t1, Math.cos(ang)), mul(t2, Math.sin(ang)));
}

const SPRINKLES = ["#ff5c8a", "#ffd23f", "#4cc9f0", "#7bd88f", "#b28dff", "#fffaf0", "#ff9f43"];

// Sprinkles scattered over a surface given by place(rand) -> { p, n }.
function sprinkles(k, share, place, extra = {}) {
  k.cloud({ share, size: 0.62, pattern: false }, (rand) => {
    const s = place(rand);
    if (!s) return null;
    return {
      p: add(s.p, mul(s.n, 0.012)),
      dir: tangentDir(rand, s.n),
      stretch: 2.7,
      color: SPRINKLES[Math.floor(rand() * SPRINKLES.length)],
      opacity: 1,
      ...extra,
    };
  });
}

// Wobble for jelly-like things: a gentle idle jiggle while alive, and a
// bigger one after a poke that dies away. Returns { tilt, squash }.
function jiggle(t, time, poke, { idle = 1, big = 1 } = {}) {
  const env = poke * poke;
  const a = Math.sin(t * 5.2) * 0.012 * idle + Math.sin(time * 11) * 0.085 * env * big;
  const b = Math.sin(t * 4.1 + 1.3) * 0.01 * idle + Math.sin(time * 9.3 + 1.1) * 0.06 * env * big;
  const squash =
    Math.sin(t * 5.2 + 0.8) * 0.02 * idle + Math.sin(time * 11 + 0.9) * 0.12 * env * big;
  return { tilt: [b, 0, a], squash };
}

// A pointed leaf along +X from its stalk end, folded along the midrib and
// curling up towards the tip. c.u runs along it, c.v across (0.5 = midrib).
function leafShape(k, length, width, curl = 0.25) {
  return k.param(
    (u, v) => {
      const w = width * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.02)), 0.85);
      const s = v * 2 - 1;
      return [u * length, curl * length * u * u + 0.18 * width * Math.abs(s), s * w];
    },
    { grid: 32 },
  );
}
function leafColor(base = "#3f8f2f", light = "#8cc65a") {
  return (c) => {
    const s = Math.abs(c.v * 2 - 1);
    let col = mix(base, shade(base, 0.8), s);
    if (s < 0.05) col = light;
    else {
      const vein = (c.u * 7 - s * 1.6) % 1;
      if (vein < 0.07 && s < 0.85) col = mix(col, light, 0.5);
    }
    return keep(glossy(c, col, 0.5, 20, 0.74, 0.38));
  };
}

const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const hop = (s) => 4 * s * (1 - s);

// ---- Ice cream ---------------------------------------------------------------------

// How many rings the coffee's surface is cut into (each a part).
const COFFEE_RINGS = 12;
const ICE_RIM = 1.15; // height of the cone's rim above its tip
const ICE_MELT = 0.48; // how easily the scoops melt (the melt behaviour's a)

const FLAVOURS = {
  strawberry: { label: "Strawberry", base: "#f6a8ba", deep: "#e57d97", bits: "#c7304f", bit: 0.5 },
  vanilla: { label: "Vanilla", base: "#fbf0cf", deep: "#eedcaa", bits: "#3d2a1c", bit: 0.66 },
  chocolate: { label: "Chocolate", base: "#7b4a2d", deep: "#5b331d", bits: "#3a1f10", bit: 0.6 },
  mint: { label: "Mint choc chip", base: "#bff0dc", deep: "#93d9bf", bits: "#3a2317", bit: 0.44 },
  pistachio: { label: "Pistachio", base: "#d3e6a4", deep: "#b3cc7e", bits: "#7a9a36", bit: 0.5 },
  blueberry: { label: "Blueberry", base: "#baa6e4", deep: "#9681cb", bits: "#4a2b7c", bit: 0.5 },
  lemon: { label: "Lemon", base: "#fcec94", deep: "#f2d661", bits: "#fff9d9", bit: 0.62 },
  cookies: {
    label: "Cookies & cream",
    base: "#f3efe8",
    deep: "#ddd6cb",
    bits: "#2b2522",
    bit: 0.42,
  },
};
// Parsed once, so colour functions do not re-read hex strings per splat.
for (const f of Object.values(FLAVOURS))
  for (const key of ["base", "deep", "bits"]) f[key] = rgb(f[key]);
const flavourChoices = () => Object.entries(FLAVOURS).map(([id, f]) => ({ id, label: f.label }));

function scoopColor(f, seed) {
  return (c) => {
    const [x, y, z] = c.lp;
    const d = unit(c.lp);
    let col = mix(f.base, f.deep, 0.3 + 0.3 * c.fbm(x * 5 + seed, y * 5, z * 5, 2));
    if (c.noise(x * 20 + seed, y * 20, z * 20) > f.bit) col = f.bits;
    col = lit(c, col, 0.8, 0.3);
    // The ruffled lip where the scoop was pressed: its underside is in shade.
    col = shade(col, 1 - 0.3 * smoothstep(-0.22, -0.46, d[1]));
    return mix(col, WHITE, 0.16 * spec(c, 14));
  };
}

function scoopShape(k, R, seed) {
  const radius = tabulate(
    (d) => {
      const ang = Math.atan2(d[0], d[2]);
      const lipY = -0.3;
      const lip =
        Math.exp(-(((d[1] - lipY) / 0.1) ** 2)) *
        (0.11 + 0.04 * Math.sin(ang * 9 + seed) + 0.025 * Math.sin(ang * 4 + seed * 2));
      const lumps = 0.035 * k.noise(d[0] * 2.4 + seed, d[1] * 2.4, d[2] * 2.4);
      let r = 1 + lip + lumps;
      if (d[1] < lipY - 0.1) r *= 1 - 0.38 * smoothstep(lipY - 0.1, -1, d[1]);
      return R * r;
    },
    120,
    90,
  );
  return k.radial(radius, { grid: 72 });
}

// ---- Watermelon --------------------------------------------------------------------

const MELON = {
  dark: "#2d6a2b",
  light: "#93c45d",
  pith: "#eef4cf",
  flesh: "#f0404f",
  deep: "#d9283f",
  seed: "#1a1210",
};

function melonSkin(c, theta, along) {
  const n = c.fbm(c.p[0] * 2.2, c.p[1] * 2.2, c.p[2] * 2.2, 3);
  const s = Math.sin(theta * 8 + n * 2.2 + 0.4 * Math.sin(along * 7));
  const jag = 0.35 * c.noise(c.p[0] * 11, c.p[1] * 11, c.p[2] * 11);
  let col = s + jag > -0.1 ? MELON.dark : MELON.light;
  col = mix(col, shade(col, 0.8), 0.5 + 0.5 * c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30));
  return glossy(c, col, 0.35, 18, 0.72, 0.4);
}

// Flesh colour at relative radius rho (0 centre, 1 skin).
function melonFlesh(rho, c) {
  if (rho > 0.965) return MELON.dark;
  if (rho > 0.9) return mix(MELON.pith, "#b8dc86", smoothstep(0.92, 0.965, rho));
  if (rho > 0.84) return mix("#f8a2a6", MELON.pith, smoothstep(0.84, 0.9, rho));
  const grain = 0.08 * c.noise(c.p[0] * 25, c.p[1] * 25, c.p[2] * 25);
  return shade(mix(MELON.deep, MELON.flesh, smoothstep(0, 0.8, rho)), 1 + grain);
}

// ---- Recipes -------------------------------------------------------------------------

export const RECIPES = {
  "ice-cream": {
    alive: true,
    options: [
      { key: "scoops", label: "Scoops", type: "slider", min: 1, max: 3, step: 1, default: 2 },
      {
        key: "f1",
        label: "First scoop",
        type: "select",
        default: "mint",
        choices: flavourChoices(),
      },
      {
        key: "f2",
        label: "Second scoop",
        type: "select",
        default: "strawberry",
        choices: flavourChoices(),
      },
      {
        key: "f3",
        label: "Third scoop",
        type: "select",
        default: "chocolate",
        choices: flavourChoices(),
      },
      { key: "sprinkles", label: "Sprinkles", type: "switch", default: true },
      { key: "cherry", label: "Cherry", type: "switch", default: true },
    ],
    controls: [
      { key: "warmth", label: "Warmth", type: "slider", default: 0 },
      { key: "thaw", label: "Melt", type: "pulse", ease: 5 },
    ],
    action: { key: "thaw", label: "Melt and refreeze" },
    drive(t, c, out) {
      // A tap warms it up quickly, so the scoops slump and drips run down the
      // cone, holds for a moment, then it refreezes.
      const p = c.thaw > 0 ? 1 - c.thaw : 1;
      const warm = 1 - Math.pow(1 - clamp(p / 0.28, 0, 1), 2);
      const tap = c.thaw > 0 ? 0.85 * warm * (1 - smoothstep(0.55, 0.95, p)) : 0;
      const w = Math.max(c.warmth, tap);
      out.energy = w;
      out.grow = w;
      // Melt slumps everything towards the floor (the cone's tip), so the
      // scoops rise by what the rim would sink: they flatten onto the cone
      // and ooze over its edge instead of sinking through it.
      out.parts.scoops = { offset: [0, ICE_RIM * 0.895 * ICE_MELT * w, 0] };
    },
    build(k, o) {
      const H = ICE_RIM;
      const R = 0.47;
      const coneR = (y) => 0.025 + (R - 0.025) * (y / H);
      const flavours = [o.f1, o.f2, o.f3].map((f) => FLAVOURS[f] || FLAVOURS.vanilla);
      const n = clamp(Math.round(o.scoops), 1, 3);
      // The waffle cone: a diamond lattice of grooves on a toasted cone.
      k.add(k.cone(0.025, R, H, { caps: false }), {
        pos: [0, H / 2, 0],
        flat: 0.22,
        interior: 0.08,
        core: flavours[0].deep,
        color: (c) => {
          const y = c.lp[1] + H / 2;
          const f1 = c.u * 11 + y * 5.2;
          const f2 = c.u * 11 - y * 5.2;
          const g = Math.min(Math.abs(f1 - Math.round(f1)), Math.abs(f2 - Math.round(f2)));
          let col = mix("#e4ad66", "#c98a44", 0.5 + 0.6 * c.noise(c.p[0] * 9, y * 9, c.p[2] * 9));
          if (g < 0.075) col = mix("#9a5a26", col, (g / 0.075) * 0.5);
          else col = shade(col, 0.96 + 0.16 * smoothstep(0.1, 0.45, g));
          return lit(c, col, 0.74, 0.38);
        },
      });
      // Its rolled rim.
      k.add(k.torus(R + 0.005, 0.045), {
        pos: [0, H, 0],
        flat: 0.25,
        weight: 1.5,
        color: (c) =>
          lit(c, mix("#eab676", "#c78a45", 0.5 + 0.5 * c.noise(c.p[0] * 30, 0, c.p[2] * 30))),
      });
      // Scoops stacked on the cone, each with a ruffled lip.
      const radii = [0.5, 0.46, 0.42];
      const scoops = k.part("scoops", { pivot: [0, H, 0] });
      const melt = (c) => [ICE_MELT + 0.2 * c.noise(c.p[0] * 3, c.p[1] * 3, c.p[2] * 3), 0];
      let y = H + 0.2;
      let top = null;
      for (let i = 0; i < n; i++) {
        const r = radii[i];
        const seed = 3 + i * 7.3;
        const shape = scoopShape(k, r, seed);
        const pos = [0.015 * (i % 2 ? 1 : -1), y, 0];
        k.add(shape, {
          pos,
          rot: [0, i * 47, 0],
          flat: 0.3,
          interior: 0.1,
          core: flavours[i].base,
          part: scoops,
          kind: "melt",
          params: melt,
          color: scoopColor(flavours[i], seed),
        });
        top = { pos, r };
        y += r * 1.28;
      }
      const tipY = top.pos[1] + top.r * 1.02;
      if (o.sprinkles) {
        sprinkles(
          k,
          0.018,
          (rand) => {
            const d = randDir(rand);
            if (d[1] < 0.15) return null;
            return { p: add(top.pos, mul(d, top.r * 1.04)), n: d };
          },
          { kind: "melt", params: [ICE_MELT + 0.05, 0], part: scoops },
        );
      }
      if (o.cherry) {
        const cp = [top.pos[0], tipY + 0.09, top.pos[2]];
        k.add(k.sphere(0.12), {
          pos: cp,
          scale: [1, 0.92, 1],
          flat: 0.25,
          weight: 2.5,
          pattern: false,
          part: scoops,
          kind: "melt",
          params: [ICE_MELT + 0.05, 0],
          color: (c) =>
            glossy(c, mix("#d0102a", "#8e0718", smoothstep(0.3, -0.8, c.n[1])), 0.9, 36),
        });
        k.add(
          k.tube(
            spline([add(cp, [0, 0.09, 0]), add(cp, [0.03, 0.2, 0.01]), add(cp, [0.1, 0.29, 0.02])]),
            0.014,
          ),
          {
            flat: 0.3,
            weight: 3,
            pattern: false,
            part: scoops,
            kind: "melt",
            params: [ICE_MELT + 0.05, 0],
            color: (c) => lit(c, "#6b8a2a"),
          },
        );
      }
      // A melted collar round the rim and drips that run down the cone as it
      // warms (they grow in with Warmth).
      const drip = (c) => glossy(c, flavours[0].base, 0.5, 20, 0.78, 0.3);
      const ph = k.rand() * TAU;
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const depth = 0.13 + 0.05 * Math.sin(a * 5 + ph) + 0.03 * Math.sin(a * 11);
            const yy = H + 0.03 - v * depth;
            const rr = coneR(yy) + 0.018;
            return [rr * Math.sin(a), yy, rr * Math.cos(a)];
          },
          { grid: 48 },
        ),
        {
          flat: 0.3,
          weight: 1.5,
          kind: "grow",
          params: (c) => [0.04 + 0.3 * c.v, 0],
          color: drip,
        },
      );
      const drips = 11;
      for (let i = 0; i < drips; i++) {
        const a0 = (i / drips) * TAU + k.rand() * 0.4;
        const L = 0.25 + k.rand() * 0.55;
        const y0 = H - 0.06;
        const curve = (t) => {
          const yy = y0 - L * t;
          const a = a0 + 0.06 * Math.sin(t * 5 + i);
          const rr = coneR(yy) + 0.02;
          return [rr * Math.sin(a), yy, rr * Math.cos(a)];
        };
        k.add(
          k.tube(curve, (t) => 0.03 + 0.022 * smoothstep(0.7, 0.97, t) * (1 - t * 0.3), {
            caps: true,
            samples: 64,
            grid: 24,
          }),
          {
            flat: 0.3,
            weight: 2,
            kind: "grow",
            params: (c) => [0.15 + 0.8 * (c.t ?? 0) * (L / 0.8), 0],
            color: drip,
          },
        );
      }
    },
  },

  watermelon: {
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "slice",
        choices: [
          { id: "slice", label: "Melon and wedge" },
          { id: "whole", label: "Whole" },
          { id: "wedge", label: "Wedge" },
        ],
      },
    ],
    build(k, o) {
      // Seeds: one teardrop per cell of a grid, in a band of the flesh.
      const seedAt = (p, rho) => {
        if (rho < 0.35 || rho > 0.74) return false;
        const S = 0.16;
        const ix = Math.floor(p[0] / S);
        const iy = Math.floor(p[1] / S);
        const iz = Math.floor(p[2] / S);
        if (hash3(ix, iy, iz) > 0.55) return false;
        const sc = [
          (ix + 0.3 + 0.4 * hash3(iy, iz, ix)) * S,
          (iy + 0.3 + 0.4 * hash3(iz, ix, iy)) * S,
          (iz + 0.3 + 0.4 * hash3(ix + 7, iy, iz)) * S,
        ];
        const dp = sub(p, sc);
        const r = unit(sc);
        const along = dot(dp, r);
        const perp = len(sub(dp, mul(r, along)));
        return (along / 0.05) ** 2 + (perp / 0.028) ** 2 < 1;
      };
      const whole = (pos, yaw) => {
        const A = 1.2;
        const B = 0.92;
        const local = (p) => turnY(sub(p, pos), -yaw);
        k.add(k.ellipsoid(A, B, B), {
          pos,
          rot: [0, yaw, 0],
          flat: 0.2,
          interior: 0.22,
          color: (c) => {
            const [x, y, z] = c.lp;
            let col = melonSkin(c, Math.atan2(z, y), x);
            // A pale patch where it lay in the field, and the stem end.
            col = mix(col, "#d8d27c", 0.7 * smoothstep(-0.7, -0.95, c.ln[1]));
            if (x > A * 0.97) col = mix(col, "#6b5a2a", smoothstep(0.97, 0.995, x / A));
            return col;
          },
          core: (c) => {
            const q = local(c.p);
            const rho = Math.hypot(q[0] / A, q[1] / B, q[2] / B);
            if (seedAt(q, rho)) return keep(MELON.seed);
            return melonFlesh(rho, c);
          },
        });
      };
      // A wedge cut from a round slice: apex up, rind at the bottom.
      const wedge = (pos, yaw, R, T, span = 1.05) => {
        const a0 = -span / 2;
        const q = quatEuler(0, yaw, 0);
        const place = { pos, quat: q };
        const rows = [
          [0.5, 4, 0.1],
          [0.66, 5, 0.0],
        ];
        const seed = (rho, a) => {
          for (const [rr, cnt, off] of rows) {
            const dr = (rho - rr) * R;
            if (Math.abs(dr) > 0.06) continue;
            const step = span / cnt;
            const j = Math.round((a - a0) / step - 0.5 - off);
            const aj = a0 + (j + 0.5 + off) * step;
            const dt = (a - aj) * rho * R;
            const w = 0.022 * (1 - 0.45 * clamp(dr / 0.045, -1, 1));
            if ((dr / 0.045) ** 2 + (dt / w) ** 2 < 1) return true;
          }
          return false;
        };
        const face = (rho, a, c) => {
          if (seed(rho, a)) return keep(mix(MELON.seed, "#4a3326", 0.3 * c.rand()));
          const col = melonFlesh(rho, c);
          // Juicy glints on the cut face.
          return c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40) > 0.55
            ? mix(col, "#ffffff", 0.3)
            : col;
        };
        for (const side of [1, -1]) {
          k.add(
            k.param(
              (u, v) => {
                const a = a0 + u * span;
                return [v * R * Math.sin(a), -v * R * Math.cos(a), (side * T) / 2];
              },
              { grid: 48, normal: () => [0, 0, side], thick: T },
            ),
            {
              ...place,
              flat: 0.15,
              interior: side > 0 ? 0.12 : 0,
              core: (c) => melonFlesh(c.v, c),
              color: (c) => face(c.v, a0 + c.u * span, c),
            },
          );
        }
        // The rind along the arc, striped like the whole melon.
        k.add(
          k.param(
            (u, v) => {
              const a = a0 + u * span;
              return [R * Math.sin(a), -R * Math.cos(a), (v - 0.5) * T];
            },
            { grid: 48, normal: (u) => [Math.sin(a0 + u * span), -Math.cos(a0 + u * span), 0] },
          ),
          { ...place, flat: 0.2, color: (c) => melonSkin(c, (a0 + c.u * span) * 1.6, 0) },
        );
        // The two cut sides.
        for (const [a, s] of [
          [a0, -1],
          [-a0, 1],
        ]) {
          k.add(
            k.param((u, v) => [u * R * Math.sin(a), -u * R * Math.cos(a), (v - 0.5) * T], {
              grid: 32,
              normal: () => [s * Math.cos(a), s * Math.sin(a), 0],
            }),
            { ...place, flat: 0.15, color: (c) => melonFlesh(c.u, c) },
          );
        }
      };
      if (o.style === "whole") whole([0, 0, 0], 12);
      else if (o.style === "wedge") wedge([0, 0.3, 0], 28, 1.1, 0.34);
      else {
        whole([-0.35, 0, -0.55], 14);
        wedge([0.62, -0.92 + 0.78, 0.55], 30, 0.78, 0.26);
      }
    },
  },

  "birthday-cake": {
    alive: true,
    options: [
      { key: "frosting", label: "Frosting", type: "color", default: "#f7a9c4" },
      { key: "drip", label: "Drip", type: "color", default: "#5a2e1a" },
      {
        key: "sponge",
        label: "Sponge",
        type: "select",
        default: "vanilla",
        choices: [
          { id: "vanilla", label: "Vanilla" },
          { id: "chocolate", label: "Chocolate" },
          { id: "velvet", label: "Red velvet" },
          { id: "strawberry", label: "Strawberry" },
        ],
      },
      { key: "candles", label: "Candles", type: "slider", min: 1, max: 9, step: 1, default: 5 },
    ],
    controls: [{ key: "out", label: "Blown out", type: "toggle", default: 0, ease: 0.6 }],
    action: { key: "out", label: "Blow out" },
    drive(t, c, out) {
      out.parts.flames = { visible: 1 - smoothstep(0, 0.55, c.out) };
      out.parts.smoke = { visible: smoothstep(0.25, 1, c.out) };
    },
    build(k, o) {
      const R = 0.8;
      const H = 0.7;
      const sponge = {
        vanilla: "#f3d28c",
        chocolate: "#5e3522",
        velvet: "#a8232f",
        strawberry: "#f6b3b8",
      }[o.sponge];
      // Cake stand: a plate on a pedestal.
      k.add(
        revolve(k, [
          [0.42, -0.5],
          [0.4, -0.47],
          [0.16, -0.42],
          [0.1, -0.3],
          [0.1, -0.14],
          [0.2, -0.08],
          [0.9, -0.05],
          [1.02, -0.02],
          [1.04, 0],
          [0.9, 0.0],
          [0, 0.0],
        ]),
        {
          flat: 0.2,
          color: (c) => glossy(c, "#f3f1ee", 0.8, 50, 0.76, 0.3),
        },
      );
      // Drips of ganache from the top edge.
      const drips = [];
      for (let i = 0; i < 17; i++) {
        drips.push({
          a: (i / 17) * TAU + (k.rand() - 0.5) * 0.2,
          L: 0.1 + k.rand() * 0.28,
          w: 0.035 + k.rand() * 0.02,
        });
      }
      const dripAt = (a, y) => {
        const d = H - y;
        if (d < 0.07) return true;
        for (const dr of drips) {
          let da = Math.abs(a - dr.a);
          da = Math.min(da, TAU - da) * R;
          if (da > dr.w) continue;
          const end = dr.L - dr.w + Math.sqrt(Math.max(0, dr.w * dr.w - da * da));
          if (d < end) return true;
        }
        return false;
      };
      k.add(k.cylinder(R, H), {
        pos: [0, H / 2, 0],
        flat: 0.2,
        interior: 0.12,
        color: (c) => {
          const y = c.lp[1] + H / 2;
          if (c.s.cap === "top") return glossy(c, o.drip, 0.6, 30);
          if (c.s.cap) return o.frosting;
          const a = c.u * TAU;
          if (dripAt(a, y)) return glossy(c, o.drip, 0.8, 30, 0.8, 0.3);
          const swirl = 0.04 * Math.sin(y * 60 + 2 * c.noise(a * 3, y * 4, 0));
          return lit(c, shade(o.frosting, 1 + swirl), 0.76, 0.34);
        },
        core: (c) => {
          const y = c.p[1];
          const r = Math.hypot(c.p[0], c.p[2]);
          if (r > R * 0.94) return o.frosting;
          if (y > H - 0.04) return o.drip;
          for (const ly of [0.24, 0.47]) {
            if (Math.abs(y - ly) < 0.012) return "#d6344d";
            if (Math.abs(y - ly) < 0.035) return "#fff4e4";
          }
          return shade(sponge, 0.92 + 0.14 * c.noise(c.p[0] * 30, y * 30, c.p[2] * 30));
        },
      });
      // Whipped rosettes around the top edge.
      const rosette = revolve(
        k,
        [
          [0.1, 0],
          [0.105, 0.03],
          [0.075, 0.075],
          [0.035, 0.11],
          [0, 0.125],
        ],
        (a, y) => 1 + 0.2 * Math.cos(a * 8 + y * 30),
        { grid: 40 },
      );
      const ros = 14;
      for (let i = 0; i < ros; i++) {
        const a = (i / ros) * TAU;
        k.add(rosette, {
          pos: [Math.sin(a) * (R - 0.1), H - 0.005, Math.cos(a) * (R - 0.1)],
          rot: [0, i * 23, 0],
          flat: 0.3,
          weight: 1.6,
          color: (c) => lit(c, "#fff8f0", 0.8, 0.3),
        });
      }
      // A beaded border at the foot.
      k.add(
        k.tube(
          (t) => [Math.sin(t * TAU) * (R + 0.01), 0.04, Math.cos(t * TAU) * (R + 0.01)],
          (t) => 0.035 + 0.018 * Math.abs(Math.sin(t * Math.PI * 34)),
          { closed: true },
        ),
        { flat: 0.3, weight: 1.4, color: (c) => lit(c, "#fff8f0", 0.8, 0.3) },
      );
      // Sprinkles on the top.
      sprinkles(k, 0.02, (rand) => {
        const a = rand() * TAU;
        const r = (R - 0.2) * Math.sqrt(rand());
        return { p: [Math.sin(a) * r, H, Math.cos(a) * r], n: [0, 1, 0] };
      });
      // Candles, with flames on one part and smoke on another.
      const flames = k.part("flames");
      const smoke = k.part("smoke");
      const n = clamp(Math.round(o.candles), 1, 9);
      const colours = ["#6ec6ff", "#ffd23f", "#ff7eb6", "#8be38b", "#b28dff"];
      const ch = 0.3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + 0.4;
        const rr = n === 1 ? 0 : n <= 4 ? 0.3 : 0.4;
        const x = Math.sin(a) * rr;
        const z = Math.cos(a) * rr;
        const stripe = colours[i % colours.length];
        k.add(k.cylinder(0.032, ch), {
          pos: [x, H + ch / 2, z],
          flat: 0.3,
          weight: 2.5,
          color: (c) => {
            const f = (c.u * 2 + (c.lp[1] + ch / 2) * 9) % 1;
            return lit(c, f < 0.45 ? stripe : "#fffdf6", 0.8, 0.35);
          },
        });
        const wick = [x, H + ch + 0.02, z];
        k.add(k.cylinder(0.007, 0.04), {
          pos: wick,
          weight: 3,
          pattern: false,
          color: "#2a211c",
        });
        k.cloud({ share: 0.012, size: 0.75, pattern: false, part: flames }, (rand) => {
          const hot = rand();
          const r = 0.022 * Math.sqrt(rand()) * (1 - 0.5 * hot);
          const aa = rand() * TAU;
          return {
            p: [
              wick[0] + Math.sin(aa) * r,
              wick[1] + 0.01 + rand() * 0.02,
              wick[2] + Math.cos(aa) * r,
            ],
            color: mix("#ff9d2e", "#fff6c8", hot),
            opacity: 0.9,
            kind: "flame",
            params: [0.07 + 0.08 * hot, rand()],
          };
        });
        k.cloud({ share: 0.0025, size: 1.1, pattern: false, part: smoke }, (rand) => ({
          p: [wick[0] + (rand() - 0.5) * 0.02, wick[1] + 0.03, wick[2] + (rand() - 0.5) * 0.02],
          color: shade("#c9c4bf", 0.9 + rand() * 0.2),
          opacity: 0.1,
          kind: "rise",
          params: [0.55 + rand() * 0.2, rand()],
        }));
      }
      k.reach([0, H + ch + 0.3, 0]);
    },
  },

  popcorn: {
    alive: true,
    controls: [{ key: "pop", label: "Pop", type: "pulse", ease: 1.5 }],
    action: { key: "pop", label: "Pop!" },
    drive(t, c, out) {
      const p = 1 - c.pop;
      for (let j = 0; j < POPS.length; j++) {
        const k = POPS[j];
        // Idle: now and then a kernel hops.
        const q = (t / k.period + k.phase) % 1;
        let y = q < 0.12 ? 0.09 * hop(q / 0.12) : 0;
        let ang = 0;
        // Pop: every kernel jumps high and tumbles, one after another.
        const s = clamp((p - k.delay) / 0.5, 0, 1);
        if (s > 0 && s < 1) {
          y += k.height * hop(s);
          ang = k.spin * easeInOut(s) * TAU;
        }
        out.parts[`k${j}`] = { offset: [0, y, 0], quat: quatAxisAngle(k.axis, ang) };
      }
      out.body = { squash: p < 0.2 ? -0.05 * Math.sin((p / 0.2) * Math.PI) : 0 };
    },
    build(k) {
      const H = 1.1;
      const R0 = 0.5;
      const R1 = 0.7;
      // The striped paper bucket, with a star badge on the front.
      const badgeA = 0.09;
      const starDist = (x, y) => {
        const a = Math.atan2(x, y);
        const r = Math.hypot(x, y);
        const seg = TAU / 5;
        const f = Math.abs((((a % seg) + seg) % seg) - seg / 2) / (seg / 2);
        const edge = 0.1 + 0.11 * f * f;
        return r - edge;
      };
      k.add(k.cone(R0, R1, H, { caps: "bottom" }), {
        pos: [0, H / 2, 0],
        flat: 0.2,
        color: (c) => {
          const y = c.lp[1] + H / 2;
          if (c.s.cap) return "#c9c1b4";
          const u = (c.u + 1) % 1;
          const r = R0 + (R1 - R0) * (y / H);
          let du = u - badgeA;
          du -= Math.round(du);
          const sd = starDist(du * TAU * r, y - 0.55);
          if (sd < 0) return keep(lit(c, sd > -0.02 ? "#f08a1c" : "#ffd23f", 0.82, 0.3));
          const stripe = Math.floor(u * 16) % 2;
          const edge = Math.abs(((u * 16) % 1) - 0.5) > 0.47;
          let col = stripe ? "#d9252f" : "#fbf6ec";
          if (edge) col = shade(col, 0.9);
          if (y > H - 0.05) col = "#fbf6ec";
          return lit(
            c,
            shade(col, 0.95 + 0.05 * c.noise(c.p[0] * 12, y * 3, c.p[2] * 12)),
            0.72,
            0.4,
          );
        },
      });
      k.add(k.torus(R1, 0.02), {
        pos: [0, H, 0],
        flat: 0.3,
        weight: 2,
        color: (c) => lit(c, "#fbf6ec"),
      });
      // A buttery heap under the kernels, so gaps never show the inside.
      const heapTop = (r) => H + 0.05 + 0.42 * Math.max(0, 1 - (r / 0.82) ** 2);
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const r = v * 0.78;
            return [Math.sin(a) * r, heapTop(r) - 0.08, Math.cos(a) * r];
          },
          { grid: 40 },
        ),
        {
          flat: 0.4,
          size: 1.3,
          color: (c) =>
            shade("#f3dfa6", 0.75 + 0.2 * c.noise(c.p[0] * 12, c.p[1] * 12, c.p[2] * 12)),
        },
      );
      // Kernels: fluffy clusters of lobes, packed over the heap and spilled around.
      const kernels = [];
      const place = (p, r) => {
        for (const q of kernels) if (len(sub(p, q.p)) < (r + q.r) * 0.82) return false;
        const lobes = [];
        const m = 5 + Math.floor(k.rand() * 3);
        for (let j = 0; j < m; j++) {
          const d = randDir(k.rand);
          lobes.push({
            c: add(p, mul(d, r * (j ? 0.5 : 0.1))),
            r: r * (j ? 0.5 + k.rand() * 0.15 : 0.62),
          });
        }
        const hull = randDir(k.rand);
        kernels.push({ p, r, lobes, hull, tint: k.rand(), part: 0 });
        return true;
      };
      for (let i = 0; i < 4000 && kernels.length < 120; i++) {
        const a = k.rand() * TAU;
        const r = 0.84 * Math.sqrt(k.rand());
        const s = 0.085 + k.rand() * 0.03;
        const y = heapTop(r) - 0.02 - k.rand() * 0.09;
        place([Math.sin(a) * r, y, Math.cos(a) * r], s);
      }
      for (let i = 0; i < 400 && kernels.length < 128; i++) {
        const a = 0.2 + (k.rand() - 0.5) * 2.4;
        const r = 0.82 + k.rand() * 0.35;
        const s = 0.08 + k.rand() * 0.02;
        place([Math.sin(a) * r, s * 0.8, Math.cos(a) * r], s);
      }
      // The highest kernels are parts that pop.
      const order = kernels
        .map((q, i) => ({ i, y: q.p[1] + 0.05 * k.rand() }))
        .sort((a, b) => b.y - a.y);
      for (let j = 0; j < POPS.length; j++) {
        const q = kernels[order[j * 2].i];
        q.part = k.part(`k${j}`, { pivot: q.p });
      }
      // Kernels deeper in the heap are in shade.
      for (const q of kernels) {
        const top = heapTop(Math.hypot(q.p[0], q.p[2]));
        q.ao = q.p[1] < 0.5 ? 1 : 0.86 + 0.14 * smoothstep(top - 0.12, top - 0.02, q.p[1]);
      }
      const K = kernels.length;
      const areas = kernels.map((q) => {
        let s = 0;
        const acc = q.lobes.map((l) => (s += l.r * l.r));
        return { acc, s };
      });
      // A point on a kernel's outer skin (a few tries to miss the hidden
      // parts where lobes overlap).
      const onKernel = (rand, q, ar) => {
        for (let tries = 0; tries < 4; tries++) {
          const x = rand() * ar.s;
          let li = 0;
          while (li < q.lobes.length - 1 && ar.acc[li] < x) li++;
          const l = q.lobes[li];
          const d = randDir(rand);
          const p = add(l.c, mul(d, l.r));
          let hidden = false;
          for (let j = 0; j < q.lobes.length && !hidden; j++) {
            if (j !== li && len(sub(p, q.lobes[j].c)) < q.lobes[j].r * 0.92) hidden = true;
          }
          if (!hidden) return { li, d, p };
        }
        return null;
      };
      k.cloud({ share: 0.5, flat: 0.45 }, (rand, i, n) => {
        const ki = Math.min(K - 1, Math.floor((i / n) * K));
        const q = kernels[ki];
        const hit = onKernel(rand, q, areas[ki]);
        if (!hit) return null;
        const { li, d, p } = hit;
        // Light on each lobe, shade in the creases between lobes (closer to
        // the kernel's middle) and deeper in the heap, buttery yellow in the folds.
        const light = Math.max(0, dot(d, LIGHT));
        const crease = smoothstep(1.05, 0.62, len(sub(p, q.p)) / q.r);
        let col = mix("#fffdf5", "#fbeab8", 0.15 + 0.5 * q.tint);
        col = mix(col, "#f4cf6a", crease * (0.35 + 0.4 * q.tint));
        if (li === 0 && dot(d, q.hull) > 0.6) col = mix("#c98a3a", "#8a5a22", rand() * 0.5);
        col = shade(col, (0.8 + 0.28 * light) * (1 - 0.14 * crease) * q.ao);
        return { p, n: d, color: col, part: q.part, opacity: 0.97 };
      });
      k.reach([0, heapTop(0) + 0.4, 0]);
    },
  },

  jelly: {
    alive: true,
    options: [
      {
        key: "flavour",
        label: "Flavour",
        type: "select",
        default: "strawberry",
        choices: [
          { id: "strawberry", label: "Strawberry" },
          { id: "lime", label: "Lime" },
          { id: "orange", label: "Orange" },
          { id: "blueberry", label: "Blueberry" },
          { id: "grape", label: "Grape" },
          { id: "rainbow", label: "Rainbow" },
        ],
      },
      { key: "fruit", label: "Fruit inside", type: "switch", default: true },
    ],
    controls: [{ key: "poke", label: "Poke", type: "pulse", ease: 2.4 }],
    action: { key: "poke", label: "Poke" },
    drive(t, c, out, info) {
      const w = jiggle(t, info.time, c.poke);
      out.parts.jelly = {
        quat: quatEuler((w.tilt[0] * 180) / Math.PI, 0, (w.tilt[2] * 180) / Math.PI),
      };
      out.body = { squash: w.squash };
    },
    build(k, o) {
      const JELLY = {
        strawberry: "#e8233f",
        lime: "#52c832",
        orange: "#ff8a1a",
        blueberry: "#4863e6",
        grape: "#8e32c4",
      };
      const BANDS = ["#e8233f", "#ff8a1a", "#ffd21f", "#52c832", "#4863e6", "#8e32c4"];
      const H = 1.0;
      const colAt = (y) =>
        o.flavour === "rainbow"
          ? BANDS[clamp(Math.floor((y / (H + 0.02)) * BANDS.length), 0, BANDS.length - 1)]
          : JELLY[o.flavour] || JELLY.strawberry;
      // A plate.
      k.add(
        revolve(
          k,
          [
            [0, -0.02],
            [0.75, -0.02],
            [1.0, 0.01],
            [1.12, 0.07],
            [1.15, 0.08],
          ],
          null,
          { flip: true },
        ),
        {
          flat: 0.2,
          color: (c) => {
            const r = Math.hypot(c.p[0], c.p[2]);
            const band = Math.abs(r - 1.06) < 0.02;
            return glossy(c, band ? "#7fb3e6" : "#f1f4f7", 0.6, 40, 0.8, 0.25);
          },
        },
      );
      const jelly = k.part("jelly", { pivot: [0, 0, 0] });
      const pts = [
        [0.8, 0.0],
        [0.84, 0.1],
        [0.82, 0.26],
        [0.72, 0.42],
        [0.6, 0.52],
        [0.58, 0.6],
        [0.6, 0.72],
        [0.55, 0.86],
        [0.42, 0.96],
        [0.22, 1.01],
        [0, 1.02],
      ];
      const flute = (a, y) => 1 + 0.075 * Math.cos(a * 10) * (1 - smoothstep(0.86, 1.0, y));
      const shape = revolve(k, pts, flute, { grid: 96 });
      // A see-through skin: faint where it faces you, denser (bigger splats)
      // and deeper in colour where it turns away, like light through jelly.
      k.add(shape, {
        part: jelly,
        flat: 0.2,
        opacity: 0.3,
        color: (c) => {
          const base = colAt(c.p[1]);
          const r = rim(c);
          const col = mix(lit(c, base, 0.86, 0.3), shade(base, 0.55), 0.6 * r);
          return { c: mix(col, "#ffffff", 0.3 * spec(c, 10)), size: 1 + 0.7 * r * r };
        },
      });
      // Bright highlights on the glossy surface.
      k.add(shape, {
        part: jelly,
        share: 0.1,
        scale: [1.012, 1.006, 1.012],
        flat: 0.2,
        size: 1.25,
        opacity: 0.9,
        color: (c) => {
          const s = spec(c, 14);
          if (s > 0.55) return keep(mix("#ffffff", colAt(c.p[1]), 0.3 * (1 - s)));
          // A soft sheen along the lit side of each flute.
          const fl = Math.cos(Math.atan2(c.p[0], c.p[2]) * 10 - 0.5);
          if (fl > 0.86 && c.p[1] > 0.1 && c.p[1] < 0.85 && dot(c.n, VIEW) > 0.15)
            return keep(mix("#ffffff", colAt(c.p[1]), 0.4));
          return null;
        },
      });
      // The jelly's body: faint splats through the volume.
      const rAt = radiusAt(pts);
      const inside = (rand, shrink) => {
        const y = rand() * H;
        const a = rand() * TAU;
        const r = rAt(y) * flute(a, y) * shrink * Math.sqrt(rand());
        return [Math.sin(a) * r, y, Math.cos(a) * r];
      };
      k.cloud({ share: 0.14, size: 1.8, part: jelly }, (rand) => {
        const p = inside(rand, 0.95);
        return { p, color: shade(colAt(p[1]), 0.7), opacity: 0.08 };
      });
      if (o.fruit) {
        const FRUIT = [
          { c: "#b5102a", r: 0.075 }, // cherries
          { c: "#ffb020", r: 0.07, s: [1.4, 0.7, 0.8] }, // orange pieces
          { c: "#a7d84a", r: 0.065, s: [1, 1.2, 1] }, // grapes
          { c: "#2c2f7a", r: 0.05 }, // blueberries
          { c: "#fff0d8", r: 0.06, s: [1.3, 0.6, 1] }, // pear
        ];
        const pieces = [];
        for (let i = 0; i < 24; i++) {
          const y = 0.12 + k.rand() * 0.72;
          const a = k.rand() * TAU;
          const r = rAt(y) * (0.55 + 0.28 * k.rand());
          const f = FRUIT[i % FRUIT.length];
          pieces.push({ p: [Math.sin(a) * r, y, Math.cos(a) * r], f: { ...f, r: f.r * 1.25 } });
        }
        k.cloud({ share: 0.12, part: jelly, flat: 0.35, pattern: false }, (rand, i, n) => {
          const q = pieces[Math.floor((i / n) * pieces.length)];
          const d = randDir(rand);
          const s = q.f.s || [1, 1, 1];
          const off = [d[0] * s[0] * q.f.r, d[1] * s[1] * q.f.r, d[2] * s[2] * q.f.r];
          const light = Math.max(0, dot(d, LIGHT));
          return {
            p: add(q.p, off),
            n: d,
            color: shade(q.f.c, 0.7 + 0.45 * light),
            opacity: 0.95,
          };
        });
      }
    },
  },

  pancakes: {
    alive: true,
    options: [
      { key: "count", label: "Pancakes", type: "slider", min: 2, max: 7, step: 1, default: 5 },
    ],
    controls: [
      { key: "syrup", label: "Syrup", type: "slider", default: 0.8 },
      { key: "flip", label: "Flip", type: "pulse", ease: 1.3 },
    ],
    action: { key: "flip", label: "Flip the top one" },
    drive(t, c, out) {
      out.grow = c.syrup;
      const s = 1 - c.flip;
      const lift = s < 1 ? hop(s) : 0;
      out.parts.top = {
        offset: [0, 0.6 * lift, 0],
        quat: quatAxisAngle([1, 0, 0.25], TAU * easeInOut(s < 1 ? s : 0)),
      };
    },
    build(k, o) {
      const n = clamp(Math.round(o.count), 2, 7);
      const T = 0.15;
      const R = 0.8;
      // A plate.
      k.add(
        revolve(
          k,
          [
            [0, 0],
            [0.82, 0],
            [1.05, 0.04],
            [1.15, 0.09],
            [1.17, 0.1],
          ],
          null,
          { flip: true },
        ),
        {
          flat: 0.2,
          color: (c) => {
            const r = Math.hypot(c.p[0], c.p[2]);
            return glossy(c, Math.abs(r - 1.1) < 0.02 ? "#3d7cc9" : "#f5f3ee", 0.6, 40, 0.8, 0.25);
          },
        },
      );
      const cake = [
        [0, -T / 2],
        [0.55, -T / 2],
        [0.72, -T / 2 + 0.008],
        [0.785, -T / 4],
        [0.8, 0],
        [0.785, T / 4],
        [0.72, T / 2 - 0.008],
        [0.55, T / 2],
        [0, T / 2],
      ];
      const top = k.part("top", { pivot: [0, 0.02 + (n - 0.5) * T * 0.93, 0], axis: [1, 0, 0] });
      let topY = 0;
      for (let i = 0; i < n; i++) {
        const ph = k.rand() * TAU;
        const ph2 = k.rand() * TAU;
        const shape = revolve(
          k,
          cake,
          (a) => 1 + 0.02 * Math.sin(a * 3 + ph) + 0.012 * Math.sin(a * 7 + ph2),
          { grid: 64 },
        );
        const y = 0.02 + (i + 0.5) * T * 0.93;
        const last = i === n - 1;
        k.add(shape, {
          pos: [(k.rand() - 0.5) * 0.03, y, (k.rand() - 0.5) * 0.03],
          rot: [0, k.rand() * 360, 0],
          flat: 0.22,
          interior: 0.1,
          part: last ? top : 0,
          core: (c) =>
            Math.abs(c.lp[1]) > T * 0.38
              ? "#c98a45"
              : shade("#f4dfa6", 0.92 + 0.12 * c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40)),
          color: (c) => {
            const face = Math.abs(c.ln[1]) > 0.6;
            const r = Math.hypot(c.lp[0], c.lp[2]) / R;
            let col;
            if (face) {
              const m = smoothstep(-0.3, 0.5, c.fbm(c.p[0] * 4 + i, c.p[2] * 4, i * 3, 4));
              col = mix("#e2ad62", "#a9642a", m * (1 - 0.5 * smoothstep(0.7, 1, r)));
            } else {
              const pore = c.noise(c.p[0] * 60, c.p[1] * 60, c.p[2] * 60) > 0.45;
              col = pore ? "#d6ac66" : "#f2d69c";
              col = mix(col, "#c98a45", smoothstep(0.55, 0.9, Math.abs(c.lp[1]) / (T / 2)));
            }
            return lit(c, col, 0.74, 0.38);
          },
        });
        topY = y + T / 2;
      }
      // A pat of butter.
      k.add(k.roundedBox(0.3, 0.1, 0.26, 5), {
        pos: [0.04, topY + 0.045, -0.02],
        rot: [3, 28, -4],
        part: top,
        flat: 0.25,
        weight: 2,
        pattern: false,
        color: (c) => glossy(c, "#fbe28a", 0.7, 30, 0.82, 0.25),
      });
      // A pool of syrup on top that spills into drips down the sides.
      const drips = [];
      for (let i = 0; i < 7; i++) {
        drips.push({ a: (i / 7) * TAU + 0.3 + k.rand() * 0.4, L: 0.18 + k.rand() * 0.55 });
      }
      const poolR = (a) => {
        let r = 0.56 + 0.04 * Math.sin(a * 5 + 1) + 0.03 * Math.sin(a * 9);
        for (const d of drips) {
          let da = Math.abs(a - d.a);
          da = Math.min(da, TAU - da);
          r = Math.max(r, 0.8 - da * 1.8);
        }
        return r;
      };
      const syrup = (c) =>
        mix(
          glossy(c, "#a2541a", 0.9, 30, 0.8, 0.35),
          "#5e2a0a",
          0.3 * smoothstep(0.3, -0.5, c.n[1]),
        );
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const r = v * poolR(a);
            return [Math.sin(a) * r, topY + 0.012 + 0.018 * (1 - v * v), Math.cos(a) * r];
          },
          { grid: 64 },
        ),
        {
          part: top,
          flat: 0.2,
          opacity: 0.92,
          pattern: false,
          kind: "grow",
          params: [0.02, 0],
          color: syrup,
        },
      );
      const sideR = (y) => {
        const i = clamp(Math.floor((y - 0.02) / (T * 0.93)), 0, n - 1);
        const yl = y - (0.02 + (i + 0.5) * T * 0.93);
        return R * Math.pow(Math.max(0, 1 - (yl / (T * 0.55)) ** 2), 0.18) + 0.022;
      };
      for (const d of drips) {
        const curve = (t) => {
          if (t < 0.15) {
            const f = t / 0.15;
            const r = 0.74 + 0.08 * f;
            const y = topY + 0.01 - 0.04 * f * f;
            return [Math.sin(d.a) * r, y, Math.cos(d.a) * r];
          }
          const f = (t - 0.15) / 0.85;
          const y = topY - 0.03 - d.L * f;
          const r = sideR(y);
          return [Math.sin(d.a) * r, y, Math.cos(d.a) * r];
        };
        k.add(
          k.tube(curve, (t) => 0.03 + 0.022 * smoothstep(0.75, 0.97, t), { caps: true }),
          {
            flat: 0.25,
            weight: 2,
            pattern: false,
            kind: "grow",
            params: (c) => [0.05 + 0.9 * (c.t ?? 0) * (d.L / 0.73), 0],
            color: syrup,
          },
        );
      }
      k.reach([0, topY + 0.5, 0]);
    },
  },

  cupcake: {
    options: [
      { key: "frosting", label: "Frosting", type: "color", default: "#f7a6c6" },
      { key: "liner", label: "Liner", type: "color", default: "#6fc3e6" },
      {
        key: "cake",
        label: "Cake",
        type: "select",
        default: "vanilla",
        choices: [
          { id: "vanilla", label: "Vanilla" },
          { id: "chocolate", label: "Chocolate" },
          { id: "velvet", label: "Red velvet" },
        ],
      },
      {
        key: "topping",
        label: "Topping",
        type: "select",
        default: "both",
        choices: [
          { id: "both", label: "Sprinkles and cherry" },
          { id: "sprinkles", label: "Sprinkles" },
          { id: "cherry", label: "Cherry" },
          { id: "none", label: "Plain" },
        ],
      },
    ],
    build(k, o) {
      const cake = { vanilla: "#e7b466", chocolate: "#6a3b22", velvet: "#9c2530" }[o.cake];
      const LH = 0.62;
      // A pleated paper liner (the pleats catch the light on alternate faces).
      k.add(
        revolve(
          k,
          [
            [0, 0],
            [0.38, 0],
            [0.44, LH * 0.5],
            [0.55, LH],
          ],
          (a) => 1 + 0.035 * Math.abs((((a * 22) / TAU) % 1) - 0.5) * 2,
          { grid: 120, thick: 0.45 },
        ),
        {
          flat: 0.2,
          interior: 0.1,
          core: cake,
          color: (c) =>
            lit(c, mix(o.liner, "#ffffff", 0.12 * c.noise(0, c.p[1] * 30, 0)), 0.7, 0.45),
        },
      );
      // The muffin top peeking over the liner.
      k.add(
        revolve(k, [
          [0.55, LH - 0.03],
          [0.6, LH + 0.05],
          [0.53, LH + 0.13],
          [0.3, LH + 0.19],
          [0, LH + 0.2],
        ]),
        {
          flat: 0.3,
          color: (c) =>
            lit(c, shade(cake, 0.9 + 0.2 * c.noise(c.p[0] * 25, c.p[1] * 25, c.p[2] * 25))),
        },
      );
      // A piped swirl of frosting: a star-tipped rope winding up to a peak.
      const turns = 2.7;
      const curve = (t) => {
        const a = t * turns * TAU;
        const rr = 0.4 * Math.pow(1 - t, 0.85) + 0.015;
        return [Math.sin(a) * rr, LH + 0.2 + t * 0.52, Math.cos(a) * rr];
      };
      const rope = (t) => 0.145 * (1 - 0.72 * Math.pow(t, 1.3)) + 0.012;
      const swirl = k.tube(curve, rope, { caps: true, samples: 420, grid: 96 });
      k.add(swirl, {
        flat: 0.3,
        interior: 0.06,
        core: o.frosting,
        color: (c) => {
          const ridge = Math.cos(c.u * TAU * 8);
          const col = lit(c, shade(o.frosting, 1 + 0.07 * ridge), 0.8, 0.32);
          return mix(col, "#ffffff", 0.35 * spec(c, 20));
        },
      });
      if (o.topping === "both" || o.topping === "sprinkles") {
        sprinkles(k, 0.03, (rand) => {
          const t = rand() * 0.95;
          const f = swirl.frame(t);
          const a = rand() * TAU;
          const d = add(mul(f.n, Math.cos(a)), mul(f.b, Math.sin(a)));
          if (d[1] < -0.1) return null;
          return { p: add(f.p, mul(d, rope(t))), n: d };
        });
      }
      if (o.topping === "both" || o.topping === "cherry") {
        const cp = add(curve(1), [0, 0.1, 0]);
        k.add(k.sphere(0.12), {
          pos: cp,
          flat: 0.25,
          weight: 2.5,
          pattern: false,
          color: (c) =>
            glossy(c, mix("#d0102a", "#7e0616", smoothstep(0.3, -0.8, c.n[1])), 0.9, 36),
        });
        k.add(
          k.tube(
            spline([add(cp, [0, 0.1, 0]), add(cp, [0.04, 0.22, 0]), add(cp, [0.12, 0.3, 0])]),
            0.014,
          ),
          { flat: 0.3, weight: 3, pattern: false, color: (c) => lit(c, "#6b8a2a") },
        );
      }
    },
  },

  lollipop: {
    alive: true,
    options: [
      {
        key: "colors",
        label: "Colours",
        type: "select",
        default: "rainbow",
        choices: [
          { id: "rainbow", label: "Rainbow" },
          { id: "strawberry", label: "Strawberry" },
          { id: "blueberry", label: "Blueberry" },
          { id: "citrus", label: "Citrus" },
        ],
      },
    ],
    drive(t, c, out) {
      out.parts.swirl = { angle: -t * 0.5 };
    },
    build(k, o) {
      const cols = {
        rainbow: ["#ff3b5c", "#ff9f1c", "#ffe14d", "#4cd964", "#38b6ff", "#a66bff"],
        strawberry: ["#ff3b5c", "#fff4f4", "#ff8fab", "#fff4f4"],
        blueberry: ["#3b5bff", "#f3f6ff", "#8fb8ff", "#f3f6ff"],
        citrus: ["#ffd400", "#fff8e0", "#ff8a00", "#8ee000"],
      }[o.colors];
      const swirl = k.part("swirl", { pivot: [0, 0, 0], axis: [0, 0, 1] });
      const turns = 4.2;
      const pitch = 0.21;
      const curve = (t) => {
        const a = t * turns * TAU;
        const r = 0.05 + pitch * t * turns;
        return [Math.cos(a) * r, Math.sin(a) * r, 0];
      };
      const R = pitch * 0.58;
      k.add(
        k.tube(curve, (t) => R * (0.55 + 0.45 * smoothstep(0, 0.04, t)), {
          caps: true,
          samples: 700,
          grid: 110,
        }),
        {
          part: swirl,
          flat: 0.25,
          interior: 0.05,
          core: cols[0],
          color: (c) => {
            const f = (((c.u + c.t * 60) % 1) + 1) % 1;
            const col = cols[Math.floor(f * cols.length) % cols.length];
            return glossy(c, col, 0.85, 28, 0.8, 0.32);
          },
        },
      );
      // The stick (its end hidden inside the bottom coils) and a ribbon bow.
      const top = -0.82;
      const L = 1.1;
      k.add(k.cylinder(0.05, L), {
        pos: [0, top - L / 2, 0],
        flat: 0.25,
        weight: 1.6,
        color: (c) =>
          lit(c, shade("#f6f2ea", 0.95 + 0.08 * c.noise(0, c.p[1] * 20, c.p[0] * 20)), 0.78, 0.35),
      });
      const bowY = top - 0.42;
      const ribbon = (c) => glossy(c, "#e8336d", 0.6, 16, 0.75, 0.4);
      for (const s of [-1, 1]) {
        k.add(k.torus(0.13, 0.035), {
          pos: [s * 0.14, bowY + 0.02, 0.03],
          rot: [90, 0, s * 18],
          scale: [1, 1, 0.6],
          flat: 0.3,
          weight: 1.6,
          pattern: false,
          color: ribbon,
        });
        k.add(
          k.tube(
            spline([
              [0.02 * s, bowY - 0.02, 0.05],
              [0.1 * s, bowY - 0.15, 0.06],
              [0.16 * s, bowY - 0.3, 0.04],
            ]),
            (t) => 0.035 * (1 - 0.3 * t),
          ),
          { flat: 0.3, weight: 1.6, pattern: false, scale: [1, 1, 0.5], color: ribbon },
        );
      }
      k.add(k.sphere(0.06), { pos: [0, bowY, 0.05], weight: 2, pattern: false, color: ribbon });
    },
  },

  "candy-cane": {
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "pair",
        choices: [
          { id: "pair", label: "Pair with a bow" },
          { id: "single", label: "Single" },
        ],
      },
      { key: "stripe", label: "Stripes", type: "color", default: "#d7192a" },
    ],
    build(k, o) {
      const L1 = 1.8;
      const Rh = 0.32;
      const L2 = Math.PI * Rh;
      const L3 = 0.1;
      const total = L1 + L2 + L3;
      const path = (t) => {
        const s = t * total;
        if (s < L1) return [0, -1.3 + s, 0];
        if (s < L1 + L2) {
          const f = (s - L1) / Rh;
          return [-Rh + Rh * Math.cos(f), -1.3 + L1 + Rh * Math.sin(f), 0];
        }
        return [-2 * Rh, -1.3 + L1 - (s - L1 - L2), 0];
      };
      const shape = k.tube(path, 0.1, { caps: true, samples: 360, grid: 96 });
      const cane = (quat, pos) =>
        k.add(shape, {
          quat,
          pos,
          flat: 0.22,
          interior: 0.05,
          core: "#fbf8f2",
          color: (c) => {
            const f = (((c.u + (c.t * total) / 0.42) % 1) + 1) % 1;
            let col = "#fbf8f2";
            if (f < 0.3) col = o.stripe;
            else if (f > 0.42 && f < 0.47) col = o.stripe;
            else if (f > 0.53 && f < 0.56) col = "#2f9e44";
            return glossy(c, col, 0.9, 30, 0.8, 0.3);
          },
        });
      if (o.style === "single") {
        cane(quatEuler(0, 0, -8), [0.2, 0, 0]);
        return;
      }
      cane(quatEuler(0, 0, 16), [-0.12, 0, -0.07]);
      cane(quatEuler(0, 180, -16), [0.12, 0, 0.07]);
      // A satin bow where they cross.
      const bowY = -0.62;
      const satin = (c) => glossy(c, "#23823a", 0.55, 14, 0.72, 0.42);
      for (const s of [-1, 1]) {
        k.add(k.torus(0.16, 0.045), {
          pos: [s * 0.17, bowY + 0.05, 0.16],
          rot: [90, 0, s * 22],
          scale: [1, 1, 0.55],
          flat: 0.3,
          weight: 1.5,
          pattern: false,
          color: satin,
        });
        k.add(
          k.tube(
            spline([
              [0.02 * s, bowY - 0.02, 0.18],
              [0.12 * s, bowY - 0.2, 0.2],
              [0.2 * s, bowY - 0.4, 0.17],
            ]),
            (t) => 0.045 * (1 - 0.3 * t),
          ),
          { flat: 0.3, weight: 1.5, pattern: false, scale: [1, 1, 0.5], color: satin },
        );
      }
      k.add(k.sphere(0.07), { pos: [0, bowY, 0.18], weight: 2, pattern: false, color: satin });
    },
  },

  macarons: {
    options: [
      {
        key: "flavours",
        label: "Flavours",
        type: "select",
        default: "pastel",
        choices: [
          { id: "pastel", label: "Pastel mix" },
          { id: "raspberry", label: "Raspberry" },
          { id: "pistachio", label: "Pistachio" },
          { id: "chocolate", label: "Chocolate" },
          { id: "lemon", label: "Lemon" },
        ],
      },
    ],
    build(k, o) {
      const ONE = {
        raspberry: ["#f27ba2", "#fff1f5"],
        pistachio: ["#a8d47e", "#f3fae6"],
        chocolate: ["#7a4b35", "#4a2a1c"],
        lemon: ["#f6d95c", "#fff9df"],
        lavender: ["#b9a3e8", "#fbf7ff"],
        blue: ["#8ecbec", "#f1faff"],
      };
      const set =
        o.flavours === "pastel"
          ? [ONE.raspberry, ONE.pistachio, ONE.lavender, ONE.lemon]
          : [ONE[o.flavours], ONE[o.flavours], ONE[o.flavours], ONE[o.flavours]];
      // A shell: flat base, ruffled "foot", smooth domed top.
      const shell = revolve(
        k,
        [
          [0, 0],
          [0.44, 0],
          [0.5, 0.012],
          [0.52, 0.04],
          [0.5, 0.075],
          [0.46, 0.1],
          [0.37, 0.155],
          [0.2, 0.19],
          [0, 0.2],
        ],
        (a, y) => (y < 0.085 ? 1 + 0.045 * k.noise(Math.sin(a) * 6, Math.cos(a) * 6, y * 60) : 1),
        { grid: 80, thick: 0.1 },
      );
      const filling = revolve(k, [
        [0.4, -0.055],
        [0.445, -0.03],
        [0.455, 0],
        [0.445, 0.03],
        [0.4, 0.055],
      ]);
      const macaron = (q, pos, [col, fill]) => {
        const put = (off, flip) => ({
          quat: flip ? quatMul(q, quatEuler(180, 0, 0)) : q,
          pos: add(pos, quatRotate(q, [0, off, 0])),
        });
        const shellColor = (c) => {
          const y = c.lp[1];
          if (y < 0.085 && Math.abs(c.ln[1]) < 0.9) {
            const bump = c.noise(c.p[0] * 70, c.p[1] * 70, c.p[2] * 70);
            return lit(c, shade(mix(col, "#ffffff", 0.18), 0.85 + 0.25 * bump), 0.8, 0.3);
          }
          return mix(lit(c, col, 0.78, 0.34), "#ffffff", 0.18 * spec(c, 18));
        };
        k.add(shell, {
          ...put(0.055, false),
          flat: 0.2,
          interior: 0.08,
          core: fill,
          color: shellColor,
        });
        k.add(shell, {
          ...put(-0.055, true),
          flat: 0.2,
          interior: 0.08,
          core: fill,
          color: shellColor,
        });
        k.add(filling, {
          ...put(0, false),
          flat: 0.3,
          weight: 1.3,
          color: (c) => lit(c, shade(fill, 0.95 + 0.1 * c.noise(c.p[0] * 30, c.p[1] * 30, 0))),
        });
      };
      const h = 0.51;
      for (let i = 0; i < 3; i++) {
        const q = quatEuler(0, i * 40 + 10, (k.rand() - 0.5) * 4);
        macaron(q, [(k.rand() - 0.5) * 0.04, 0.255 + i * h, -0.35], set[i]);
      }
      // Two more lying in front, one tipped against the other.
      macaron(quatEuler(0, 20, 0), [-0.55, 0.255, 0.45], set[3]);
      macaron(quatEuler(-14, 60, 12), [0.5, 0.33, 0.5], set[o.flavours === "pastel" ? 0 : 3]);
    },
  },

  "gummy-bear": {
    alive: true,
    options: [
      {
        key: "color",
        label: "Flavour",
        type: "select",
        default: "red",
        choices: [
          { id: "red", label: "Cherry red" },
          { id: "orange", label: "Orange" },
          { id: "yellow", label: "Lemon" },
          { id: "green", label: "Apple green" },
          { id: "clear", label: "Pineapple (clear)" },
          { id: "pink", label: "Raspberry pink" },
        ],
      },
    ],
    controls: [{ key: "squish", label: "Squish", type: "pulse", ease: 2 }],
    action: { key: "squish", label: "Squish" },
    drive(t, c, out, info) {
      const w = jiggle(t, info.time, c.squish, { idle: 0.6 });
      out.body = {
        squash: w.squash,
        quat: quatEuler((w.tilt[0] * 180) / Math.PI, 0, (w.tilt[2] * 180) / Math.PI),
      };
    },
    build(k, o) {
      const base = {
        red: "#e3122d",
        orange: "#ff7a0a",
        yellow: "#ffcf1a",
        green: "#48c21f",
        clear: "#f2eee0",
        pink: "#ff4f9a",
      }[o.color];
      const parts = [
        [[0, -0.12, 0], [0.45, 0.55, 0.34], 0],
        [[0, -0.2, 0.12], [0.32, 0.36, 0.26], 0],
        [[0, 0.55, 0], [0.4, 0.34, 0.31], 0],
        [[0, 0.45, 0.25], [0.17, 0.12, 0.11], 0],
        [[-0.27, 0.84, -0.02], [0.13, 0.13, 0.1], 0],
        [[0.27, 0.84, -0.02], [0.13, 0.13, 0.1], 0],
        [[-0.42, 0.1, 0.08], [0.14, 0.24, 0.14], -0.55],
        [[0.42, 0.1, 0.08], [0.14, 0.24, 0.14], 0.55],
        [[-0.24, -0.62, 0.08], [0.18, 0.2, 0.18], 0],
        [[0.24, -0.62, 0.08], [0.18, 0.2, 0.18], 0],
      ];
      const ell = (p, [c, r, rz]) => {
        let x = p[0] - c[0];
        let y = p[1] - c[1];
        if (rz) {
          const cs = Math.cos(rz);
          const sn = Math.sin(rz);
          [x, y] = [x * cs + y * sn, -x * sn + y * cs];
        }
        const z = p[2] - c[2];
        return (Math.hypot(x / r[0], y / r[1], z / r[2]) - 1) * Math.min(r[0], r[1], r[2]);
      };
      const smin = (a, b, kk) => {
        const h = clamp(0.5 + (0.5 * (b - a)) / kk, 0, 1);
        return b + (a - b) * h - kk * h * (1 - h);
      };
      const f = (p) => {
        let d = ell(p, parts[0]);
        for (let i = 1; i < parts.length; i++) d = smin(d, ell(p, parts[i]), 0.09);
        return d;
      };
      const radius = tabulate(implicitRadius(f, 1.6, 22));
      const shape = k.radial(radius, { grid: 120 });
      const face = (c) => {
        const [x, y, z] = c.p;
        if (z < 0.1) return false;
        if (Math.hypot(Math.abs(x) - 0.13, y - 0.64) < 0.035) return true;
        return Math.hypot(x, y - 0.5) < 0.03 && z > 0.3;
      };
      k.add(shape, {
        flat: 0.2,
        opacity: 0.42,
        color: (c) => {
          if (face(c)) return keep(shade(base, 0.45));
          const r = rim(c);
          const col = mix(lit(c, base, 0.9, 0.3), shade(base, 0.55), 0.55 * r);
          return { c: mix(col, "#ffffff", 0.3 * spec(c, 12)), size: 1 + 0.9 * r * r };
        },
      });
      k.add(shape, {
        share: 0.03,
        flat: 0.2,
        size: 0.8,
        opacity: 0.9,
        color: (c) => (spec(c, 30) > 0.42 ? keep(mix("#ffffff", base, 0.1)) : null),
      });
      k.cloud({ share: 0.22, size: 1.8 }, (rand) => {
        const d = randDir(rand);
        const p = mul(d, radius(d) * 0.94 * Math.cbrt(rand()));
        return { p, color: shade(base, 0.8), opacity: 0.14 };
      });
    },
  },

  pretzel: {
    build(k) {
      const pts = [
        [-0.46, -0.42, 0.08],
        [-0.26, -0.2, 0.08],
        [-0.02, 0.06, 0.1],
        [0.26, 0.32, 0.04],
        [0.5, 0.52, 0],
        [0.78, 0.5, 0],
        [0.93, 0.2, 0],
        [0.86, -0.22, 0],
        [0.55, -0.55, 0],
        [0, -0.68, 0],
        [-0.55, -0.55, 0],
        [-0.86, -0.22, 0],
        [-0.93, 0.2, 0],
        [-0.78, 0.5, 0],
        [-0.5, 0.52, 0],
        [-0.26, 0.32, -0.04],
        [0.02, 0.06, -0.1],
        [0.26, -0.2, 0.08],
        [0.46, -0.42, 0.08],
      ];
      const rad = (t) => 0.085 + 0.06 * Math.exp(-(((t - 0.5) / 0.17) ** 2));
      const shape = k.tube(spline(pts), rad, { caps: true, samples: 480, grid: 110 });
      const q = quatEuler(-16, 0, 0);
      k.add(shape, {
        quat: q,
        flat: 0.25,
        interior: 0.1,
        core: "#f0d4a0",
        color: (c) => {
          // The scored belly splits open along its top, showing pale dough.
          const belly = Math.exp(-(((c.t - 0.5) / 0.1) ** 2));
          const up = dot(c.n, unit([0, 0.8, 0.6]));
          const jag = 0.08 * c.noise(c.t * 80, 0, 0);
          if (belly > 0.35 && up > 0.72 + jag)
            return lit(c, mix("#f3d59a", "#e2b36a", c.rand() * 0.6), 0.85, 0.25);
          const col = mix(
            "#96501c",
            "#5e2b0c",
            0.45 + 0.4 * c.fbm(c.p[0] * 6, c.p[1] * 6, c.p[2] * 6, 3),
          );
          return glossy(c, col, 0.55, 22, 0.72, 0.42);
        },
      });
      // Coarse salt on the top side.
      k.cloud({ share: 0.012, size: 0.9, flat: 0.7, pattern: false }, (rand) => {
        const t = rand();
        const f = shape.frame(t);
        const a = rand() * TAU;
        const d = add(mul(f.n, Math.cos(a)), mul(f.b, Math.sin(a)));
        const dw = quatRotate(q, d);
        if (dw[2] < 0.25 || rand() < 0.4) return null;
        return {
          p: quatRotate(q, add(f.p, mul(d, rad(t) * 1.02))),
          n: dw,
          color: mix("#ffffff", "#e8e4dc", rand()),
          opacity: 1,
        };
      });
    },
  },

  croissant: {
    build(k) {
      // A crescent of rolled dough: plump rolls in the middle, thin tips
      // curling in, each roll wrapping slightly on the slant.
      const curve = (t) => {
        const a = (t - 0.5) * 4.0;
        const dip = 0.12 * Math.pow(1 - Math.sin(Math.PI * t), 1.5);
        return [Math.sin(a) * 0.9, -dip, Math.cos(a) * 0.62 - 0.3];
      };
      const bulge = (t, u) =>
        Math.pow(0.5 + 0.5 * Math.cos(TAU * 5 * (t - 0.5 + 0.035 * Math.cos(u * TAU))), 0.6);
      const env = (t) => 0.3 * Math.pow(Math.sin(Math.PI * t), 1.1) + 0.02;
      const frame = levelFrames(curve);
      const shape = k.param(
        (u, v) => {
          const f = frame(v);
          const a = u * TAU;
          const r = env(v) * (0.62 + 0.38 * bulge(v, u));
          const off = add(mul(f.n, Math.cos(a) * r), mul(f.b, Math.sin(a) * r * 0.8));
          return add(f.p, off);
        },
        { grid: 100, thick: 0.25 },
      );
      k.add(shape, {
        flat: 0.25,
        interior: 0.1,
        core: (c) => {
          // Keep the crumb inside the thin tips.
          if (len(sub(c.p, c.lp)) > env(c.v) * 0.9) return null;
          return c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30) > 0.1 ? "#f6e2b0" : "#e2bd7c";
        },
        color: (c) => {
          const b = bulge(c.v, c.u);
          const under = smoothstep(-0.2, -0.7, c.n[1]);
          const tip = smoothstep(0.3, 0.05, Math.min(c.v, 1 - c.v));
          let col = mix("#f4d08e", "#c26a1f", smoothstep(0.2, 0.85, b));
          col = mix(col, "#9a5418", 0.5 * tip);
          col = mix(col, "#e9bb72", under * 0.7);
          col = shade(col, 0.93 + 0.12 * c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40));
          return glossy(c, col, 0.55 * (1 - under), 20, 0.72, 0.42);
        },
      });
    },
  },

  pizza: {
    options: [
      {
        key: "topping",
        label: "Topping",
        type: "select",
        default: "pepperoni",
        choices: [
          { id: "pepperoni", label: "Pepperoni" },
          { id: "margherita", label: "Margherita" },
          { id: "veggie", label: "Veggie" },
          { id: "cheese", label: "Cheese" },
        ],
      },
    ],
    controls: [{ key: "serve", label: "Take a slice", type: "toggle", default: 0, ease: 1.1 }],
    action: { key: "serve", label: "Take a slice" },
    drive(t, c, out) {
      // Linear in the eased value, so the cheese strings (which grow in with
      // it) always reach the slice.
      const s = c.serve;
      out.grow = s;
      out.parts.slice = { offset: [PIZZA_OUT[0] * s, PIZZA_OUT[1] * s, PIZZA_OUT[2] * s] };
    },
    build(k, o) {
      const R = 0.9;
      const Rc = 0.95;
      const top = 0.06;
      const slices = 8;
      const span = TAU / slices;
      const a0 = PIZZA_AZ - span / 2;
      const slice = k.part("slice");
      const marg = o.topping === "margherita";
      const inSlice = (a) => {
        let d = a - PIZZA_AZ;
        d -= Math.round(d / TAU) * TAU;
        return Math.abs(d) < span / 2;
      };
      // A wooden board underneath.
      k.add(k.cylinder(1.13, 0.06), {
        pos: [0, -0.035, 0],
        flat: 0.2,
        color: (c) => {
          if (c.s.cap === "bottom") return "#6b4a2a";
          const g = c.fbm(c.p[0] * 2, c.p[2] * 14, 0.5, 3);
          return lit(c, mix("#c89660", "#9c6a3a", 0.5 + 0.5 * g), 0.74, 0.34);
        },
      });
      const cheese = (c, r, a) => {
        const n = c.fbm(c.p[0] * 6, c.p[2] * 6, 1.7, 4);
        const sauceEdge = smoothstep(R - 0.1, R - 0.02, r) * 0.8;
        let col;
        if (marg) {
          col = mix("#c7331f", "#a8261a", 0.5 + 0.5 * n);
        } else {
          col = mix("#fbd872", "#f4b53e", smoothstep(-0.1, 0.5, n));
          // Blistered golden spots.
          const b = c.noise(c.p[0] * 14, c.p[2] * 14, 3.3);
          if (b > 0.42) col = mix(col, "#c97a2a", smoothstep(0.42, 0.62, b));
          col = mix(
            col,
            "#c7331f",
            sauceEdge + (c.noise(c.p[0] * 9, c.p[2] * 9, 7) > 0.5 ? 0.6 : 0),
          );
        }
        // The cuts between slices.
        let d = (a - PIZZA_AZ) / span + 0.5;
        d = Math.abs(d - Math.round(d)) * span * r;
        if (d < 0.009 && r > 0.03) return keep(shade(col, 0.55));
        return mix(lit(c, col, 0.8, 0.28), "#ffffff", 0.25 * spec(c, 20));
      };
      const crust = (c) => {
        const n = c.noise(c.p[0] * 10, c.p[1] * 10, c.p[2] * 10);
        let col = mix("#e7b56a", "#c78638", smoothstep(-0.2, 0.6, c.n[1] + 0.3 * n));
        if (c.noise(c.p[0] * 22, c.p[1] * 22, c.p[2] * 22) > 0.5) col = "#8a5424";
        return lit(c, col, 0.75, 0.38);
      };
      // Each piece: the cheesy top, the puffy crust, the base and the cut sides.
      const piece = (from, to, part) => {
        const w = to - from;
        k.add(
          k.param(
            (u, v) => {
              const a = from + u * w;
              const r = v * R;
              return [Math.sin(a) * r, top + 0.006 * Math.sin(a * 17 + r * 23), Math.cos(a) * r];
            },
            { grid: 64, normal: () => [0, 1, 0], thick: 0.05 },
          ),
          {
            part,
            flat: 0.15,
            interior: 0.08,
            core: (c) => (c.p[1] > 0.035 ? "#c7331f" : "#f1d9a6"),
            color: (c) => cheese(c, c.v * R, from + c.u * w),
          },
        );
        k.add(
          k.param(
            (u, v) => {
              const a = from + u * w;
              const ph = v * TAU;
              const rr = 0.075 * (1 + 0.14 * k.noise(Math.sin(a) * 5, Math.cos(a) * 5, ph));
              const r = Rc + rr * Math.cos(ph);
              return [Math.sin(a) * r, 0.045 + rr * Math.sin(ph) * 0.85, Math.cos(a) * r];
            },
            { grid: 64 },
          ),
          { part, flat: 0.2, color: crust },
        );
        k.add(
          k.param(
            (u, v) => {
              const a = from + u * w;
              const r = v * Rc;
              return [Math.sin(a) * r, 0.0, Math.cos(a) * r];
            },
            { grid: 32, normal: () => [0, -1, 0] },
          ),
          { part, flat: 0.15, color: "#d9a55c" },
        );
        for (const [a, s] of [
          [from, -1],
          [to, 1],
        ]) {
          k.add(
            k.param((u, v) => [Math.sin(a) * u * Rc, v * top, Math.cos(a) * u * Rc], {
              grid: 24,
              normal: () => [s * Math.cos(a), 0, -s * Math.sin(a)],
            }),
            {
              part,
              flat: 0.15,
              color: (c) =>
                c.p[1] > top * 0.7 ? "#f6c75a" : c.p[1] > top * 0.5 ? "#c7331f" : "#efd6a0",
            },
          );
        }
      };
      piece(a0, a0 + span, slice);
      piece(a0 + span, a0 + TAU, 0);
      // Toppings, each on the slice part when it sits on the slice.
      const spots = [];
      const rings = [
        [0, 1],
        [0.36, 6],
        [0.66, 11],
      ];
      for (const [r, n] of rings) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + k.rand() * 0.3 + r;
          const rr = r ? r + (k.rand() - 0.5) * 0.08 : 0.05;
          spots.push([Math.sin(a) * rr, Math.cos(a) * rr, a]);
        }
      }
      const partAt = (x, z) => (inSlice(Math.atan2(x, z)) ? slice : 0);
      const leaf = k.param(
        (u, v) => {
          const x = (u - 0.5) * 0.2;
          const w = 0.055 * Math.pow(Math.max(0, 1 - ((2 * x) / 0.2) ** 2), 0.6);
          const z = (v - 0.5) * 2 * w;
          return [x, 0.012 * (1 - (z / 0.06) ** 2), z];
        },
        { grid: 24, normal: () => [0, 1, 0] },
      );
      const basil = (x, z, rot) =>
        k.add(leaf, {
          pos: [x, top + 0.02, z],
          rot: [0, rot, 0],
          part: partAt(x, z),
          flat: 0.15,
          weight: 2,
          pattern: false,
          color: (c) =>
            Math.abs(c.lp[2]) < 0.004
              ? "#7fbf5a"
              : glossy(
                  c,
                  mix("#2f8a32", "#1e6b25", smoothstep(0, 0.05, Math.abs(c.lp[2]))),
                  0.6,
                  20,
                ),
        });
      if (o.topping === "pepperoni") {
        const pep = k.cylinder(0.1, 0.018);
        for (const [x, z] of spots) {
          k.add(pep, {
            pos: [x, top + 0.012, z],
            part: partAt(x, z),
            flat: 0.2,
            weight: 1.3,
            color: (c) => {
              if (c.s.side) return "#7d1510";
              const r = c.s.radial ?? 0;
              let col = mix("#c02a1c", "#7d1510", smoothstep(0.75, 1, r));
              if (c.noise(c.p[0] * 60, c.p[2] * 60, 2) > 0.45) col = mix(col, "#e8836a", 0.6);
              return glossy(c, col, 0.5, 20);
            },
          });
        }
        for (let i = 0; i < 5; i++) {
          const a = i * 1.3 + 0.4;
          basil(Math.sin(a) * (0.2 + i * 0.12), Math.cos(a) * (0.2 + i * 0.12), a * 57);
        }
      } else if (marg) {
        for (const [x, z] of spots) {
          if (k.rand() < 0.25) continue;
          const s = 0.09 + k.rand() * 0.05;
          k.add(k.ellipsoid(s, 0.025, s * (0.8 + k.rand() * 0.3)), {
            pos: [x, top + 0.01, z],
            rot: [0, k.rand() * 180, 0],
            part: partAt(x, z),
            flat: 0.3,
            color: (c) =>
              lit(
                c,
                mix(
                  "#fffaf0",
                  "#e9c27a",
                  0.35 * smoothstep(0.3, 0.9, c.fbm(c.p[0] * 12, c.p[2] * 12, 0, 2) + 0.5),
                ),
                0.84,
                0.2,
              ),
          });
        }
        for (let i = 0; i < 9; i++) {
          const a = i * 2.1 + 0.2;
          const r = 0.15 + ((i * 0.37) % 1) * 0.6;
          basil(Math.sin(a) * r, Math.cos(a) * r, a * 80);
        }
      } else if (o.topping === "veggie") {
        for (let i = 0; i < spots.length; i++) {
          const [x, z, a] = spots[i];
          const part = partAt(x, z);
          const kind = i % 4;
          if (kind === 0) {
            k.add(k.torus(0.06, 0.012), {
              pos: [x, top + 0.012, z],
              part,
              weight: 2,
              flat: 0.3,
              color: (c) => glossy(c, "#1e1a1a", 0.6, 20),
            });
          } else if (kind === 1) {
            k.add(k.torus(0.09, 0.014), {
              pos: [x, top + 0.012, z],
              scale: [1, 1, 0.7],
              rot: [0, a * 57, 0],
              part,
              weight: 2,
              flat: 0.3,
              color: (c) => glossy(c, "#3f9a2c", 0.5, 20),
            });
          } else if (kind === 2) {
            k.add(k.ellipsoid(0.08, 0.018, 0.06), {
              pos: [x, top + 0.014, z],
              rot: [0, a * 57, 0],
              part,
              weight: 2,
              color: (c) =>
                lit(
                  c,
                  mix(
                    "#d9c2a0",
                    "#8a6a48",
                    smoothstep(0.6, 1, Math.hypot(c.lp[0] / 0.08, c.lp[2] / 0.06)),
                  ),
                ),
            });
          } else {
            k.add(k.torus(0.075, 0.01), {
              pos: [x, top + 0.012, z],
              scale: [1, 1, 0.8],
              part,
              weight: 2,
              flat: 0.3,
              color: (c) => lit(c, "#8a3a7a"),
            });
          }
        }
      }
      // Strings of melted cheese that stretch as the slice comes away.
      for (let i = 0; i < 5; i++) {
        const side = i % 2 ? a0 : a0 + span;
        const r = 0.25 + i * 0.13;
        const start = [Math.sin(side) * r, top + 0.005, Math.cos(side) * r];
        const end = add(start, PIZZA_OUT);
        const curve = (t) => {
          const p = add(start, mul(sub(end, start), t));
          return [p[0], p[1] - 0.05 * Math.sin(Math.PI * t), p[2]];
        };
        k.add(
          k.tube(curve, (t) => 0.011 * (1 - 0.5 * Math.sin(Math.PI * t)), {
            samples: 64,
            grid: 32,
          }),
          {
            flat: 0.4,
            weight: 3,
            kind: "grow",
            params: (c) => [0.02 + 0.97 * (c.t ?? 0), 0],
            color: "#f9d77a",
          },
        );
      }
      k.reach(add([Math.sin(PIZZA_AZ) * 1.0, top, Math.cos(PIZZA_AZ) * 1.0], PIZZA_OUT));
    },
  },

  burger: {
    controls: [{ key: "explode", label: "Explode view", type: "toggle", default: 0, ease: 1.2 }],
    action: { key: "explode", label: "Explode view" },
    drive(t, c, out) {
      const e = easeInOut(c.explode);
      BURGER_LAYERS.forEach((name, i) => {
        out.parts[name] = { offset: [0, e * 0.24 * (i + 1), 0] };
      });
    },
    build(k) {
      const [patty, cheese, lettuce, tomato, topBun] = BURGER_LAYERS.map((n) =>
        k.part(n, { pivot: [0, 0.5, 0] }),
      );
      const crumb = (c) =>
        shade("#f3dcae", 0.9 + 0.15 * c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40));
      // Bottom bun: toasted sides, pale cut face on top.
      k.add(
        revolve(k, [
          [0, 0],
          [0.7, 0],
          [0.8, 0.04],
          [0.84, 0.13],
          [0.82, 0.21],
          [0.76, 0.25],
          [0.4, 0.255],
          [0, 0.255],
        ]),
        {
          flat: 0.22,
          interior: 0.1,
          core: crumb,
          color: (c) =>
            c.n[1] > 0.85 && c.p[1] > 0.2
              ? crumb(c)
              : lit(c, mix("#d59a4a", "#b8752e", smoothstep(0.1, -0.8, c.n[1]))),
        },
      );
      // The patty.
      k.add(
        revolve(
          k,
          [
            [0, 0.25],
            [0.8, 0.25],
            [0.88, 0.29],
            [0.9, 0.35],
            [0.88, 0.41],
            [0.8, 0.45],
            [0, 0.45],
          ],
          (a) => 1 + 0.025 * Math.sin(a * 5 + 1) + 0.015 * Math.sin(a * 11),
        ),
        {
          part: patty,
          flat: 0.3,
          interior: 0.1,
          core: "#7a4428",
          color: (c) => {
            const n = c.fbm(c.p[0] * 14, c.p[1] * 14, c.p[2] * 14, 3);
            let col = mix("#6e3f22", "#3d2012", smoothstep(-0.3, 0.5, n));
            if (c.noise(c.p[0] * 45, c.p[1] * 45, c.p[2] * 45) > 0.45) col = "#9a6238";
            return glossy(c, col, 0.3, 16, 0.72, 0.42);
          },
        },
      );
      // A slice of cheese melting over the edge.
      const S = 0.76;
      k.add(
        k.param(
          (u, v) => {
            const x = (u - 0.5) * 2 * S;
            const z = (v - 0.5) * 2 * S;
            const r = Math.hypot(x, z);
            const droop = 0.3 * Math.pow(smoothstep(0.84, 1.08, r), 1.2);
            const pull = 1 - 0.1 * smoothstep(0.84, 1.08, r);
            return [x * pull, 0.462 - droop, z * pull];
          },
          { grid: 64, flip: true },
        ),
        {
          rot: [0, 22, 0],
          part: cheese,
          flat: 0.2,
          weight: 1.2,
          color: (c) => glossy(c, "#f8b62a", 0.55, 22, 0.8, 0.3),
        },
      );
      // Frilly lettuce.
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const r = (0.3 + 0.66 * v) * (1 + 0.05 * v * Math.sin(a * 7));
            const y = 0.5 + v * v * (0.035 * Math.sin(a * 13 + v * 4) - 0.02);
            return [Math.sin(a) * r, y, Math.cos(a) * r];
          },
          { grid: 72, flip: true },
        ),
        {
          part: lettuce,
          flat: 0.2,
          color: (c) => {
            const r = Math.hypot(c.p[0], c.p[2]);
            const vein = Math.abs(Math.sin(Math.atan2(c.p[0], c.p[2]) * 18)) < 0.08;
            const col = mix("#4f9d2c", "#b7e06a", smoothstep(0.6, 0.97, r));
            return lit(c, vein ? mix(col, "#d8f0a0", 0.5) : col, 0.78, 0.35);
          },
        },
      );
      // Tomato slices.
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.5;
        k.add(k.cylinder(0.34, 0.07), {
          pos: [Math.sin(a) * 0.33, 0.57, Math.cos(a) * 0.33],
          rot: [0, i * 40, 0],
          part: tomato,
          flat: 0.2,
          color: (c) => {
            if (c.s.side) return glossy(c, "#d8291c", 0.6, 20);
            const r = c.s.radial ?? 0;
            const ang = c.u * TAU;
            if (r > 0.86) return "#cc2418";
            const chamber = r > 0.3 && r < 0.78 && Math.cos(ang * 4) > -0.2;
            if (chamber) {
              const seed = c.noise(c.p[0] * 50, c.p[2] * 50, 1) > 0.35;
              return seed ? "#f2c46a" : "#f26a4c";
            }
            return lit(c, "#e8402a", 0.85, 0.2);
          },
        });
      }
      // The top bun, glossy with sesame seeds.
      const dome = revolve(k, [
        [0, 0.63],
        [0.8, 0.63],
        [0.87, 0.68],
        [0.88, 0.76],
        [0.82, 0.9],
        [0.66, 1.03],
        [0.4, 1.11],
        [0, 1.14],
      ]);
      k.add(dome, {
        part: topBun,
        flat: 0.22,
        interior: 0.1,
        core: crumb,
        color: (c) => {
          if (c.n[1] < -0.85) return crumb(c);
          const col = mix("#e0a24e", "#b7671f", smoothstep(0.7, 1.12, c.p[1]));
          return glossy(c, col, 0.5, 18, 0.74, 0.4);
        },
      });
      const domeAt = radiusAt([
        [0.88, 0.76],
        [0.82, 0.9],
        [0.66, 1.03],
        [0.4, 1.11],
        [0, 1.14],
      ]);
      k.cloud({ share: 0.02, size: 0.8, part: topBun, pattern: false }, (rand) => {
        const y = 0.8 + rand() * 0.33;
        const r = domeAt(y);
        const a = rand() * TAU;
        const p = [Math.sin(a) * r, y + 0.006, Math.cos(a) * r];
        const n = unit([p[0], 0.9, p[2]]);
        return {
          p,
          dir: tangentDir(rand, n),
          stretch: 1.9,
          color: mix("#fbf0d2", "#e8d2a0", rand()),
          opacity: 1,
        };
      });
      k.reach([0, 1.14 + 0.6, 0]);
    },
  },

  sushi: {
    build(k) {
      // A wooden board.
      k.add(k.roundedBox(2.6, 0.12, 1.3, 7), {
        pos: [0, -0.06, 0],
        flat: 0.2,
        color: (c) => {
          const g = c.fbm(c.p[0] * 1.5, c.p[2] * 18, 0.3, 3);
          return lit(c, mix("#d7ae78", "#a97b48", 0.5 + 0.5 * g), 0.74, 0.34);
        },
      });
      const grain = (c) => {
        const n = c.noise(c.p[0] * 70, c.p[1] * 70, c.p[2] * 70);
        return lit(c, shade("#f8f5ee", 0.86 + 0.14 * Math.abs(n) * 2), 0.8, 0.3);
      };
      // Nigiri: a pillow of rice and a draped slice of fish.
      const nigiri = (x, z, yaw, fish) => {
        k.add(k.roundedBox(0.52, 0.2, 0.3, 3.2), {
          pos: [x, 0.1, z],
          rot: [0, yaw, 0],
          flat: 0.35,
          interior: 0.08,
          core: "#f4f0e6",
          color: grain,
        });
        const slab = bentSlab(k, 0.66, 0.06, 0.36, 3.5, 0.28);
        k.add(slab, {
          pos: [x, 0.225, z],
          rot: [0, yaw, 0],
          flat: 0.25,
          interior: 0.06,
          core: fish === "salmon" ? "#f48a5e" : "#b81c34",
          color: (c) => {
            if (fish === "salmon") {
              const f = (c.lp[0] * 1.2 + c.lp[2] * 0.7) * 14;
              const line = Math.abs(f - Math.round(f)) < 0.12;
              return glossy(c, line ? "#fde2d0" : "#f47a4d", 0.7, 30, 0.8, 0.3);
            }
            const s = c.noise(c.p[0] * 12, c.p[2] * 30, 0);
            return glossy(c, mix("#c21f3a", "#9c1428", 0.5 + 0.5 * s), 0.8, 30, 0.8, 0.3);
          },
        });
      };
      nigiri(-0.82, 0.02, 8, "salmon");
      nigiri(-0.24, 0.1, -6, "tuna");
      // Maki rolls: nori outside, rice, and a filling.
      const fills = [
        ["#f47a4d", "#f47a4d"],
        ["#7cc242", "#b8e07a"],
        ["#ffd23f", "#7cc242"],
      ];
      [
        [0.36, 0.12],
        [0.74, 0.02],
        [1.08, 0.16],
      ].forEach(([x, z], i) => {
        const [f1, f2] = fills[i];
        k.add(k.cylinder(0.18, 0.22), {
          pos: [x, 0.11, z],
          rot: [0, i * 50, 0],
          flat: 0.25,
          interior: 0.08,
          core: "#f4f0e6",
          color: (c) => {
            if (c.s.side) {
              const n = c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40);
              return glossy(c, shade("#23301f", 0.9 + 0.2 * n), 0.35, 16, 0.75, 0.4);
            }
            const r = c.s.radial ?? 0;
            if (r > 0.93) return "#1c2619";
            if (r > 0.42) return grain(c);
            const a = c.u * TAU;
            return keep(lit(c, Math.sin(a * 2) > 0 ? f1 : f2, 0.85, 0.25));
          },
        });
      });
      // Wasabi and pickled ginger.
      k.add(
        revolve(
          k,
          [
            [0.16, 0],
            [0.15, 0.05],
            [0.1, 0.11],
            [0.03, 0.15],
            [0, 0.16],
          ],
          (a, y) => 1 + 0.12 * Math.sin(a * 3 + y * 20),
        ),
        {
          pos: [1.0, 0, -0.38],
          flat: 0.3,
          weight: 1.5,
          color: (c) =>
            lit(c, shade("#9cc43c", 0.9 + 0.2 * c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30))),
        },
      );
      for (let i = 0; i < 5; i++) {
        const petal = k.param(
          (u, v) => {
            const a = (u - 0.5) * 2.2;
            const r = 0.12 * v;
            return [Math.sin(a) * r, 0.02 + v * v * 0.06 + 0.02 * Math.cos(a * 2), Math.cos(a) * r];
          },
          { grid: 20 },
        );
        k.add(petal, {
          pos: [0.55 + (i % 3) * 0.07, 0.01 + i * 0.012, -0.38 + (i % 2) * 0.06],
          rot: [0, i * 70, 0],
          flat: 0.2,
          weight: 1.5,
          opacity: 0.85,
          color: (c) => lit(c, mix("#f9c9c4", "#f3a6a6", c.v), 0.85, 0.25),
        });
      }
      // Chopsticks along the front.
      for (const dz of [0, 0.07]) {
        k.add(k.cone(0.024, 0.013, 2.0), {
          pos: [0.02, 0.025, 0.5 + dz],
          rot: [0, 0, -90],
          flat: 0.3,
          weight: 1.5,
          color: (c) =>
            c.lp[1] > 0.72 ? lit(c, "#1d1a18") : glossy(c, "#b5262e", 0.6, 24, 0.75, 0.4),
        });
      }
    },
  },

  taco: {
    build(k) {
      const R = 0.95;
      const rho = 0.46;
      const yaw = 0;
      const shellAt = (u, v, off = 0) => {
        const x = (u * 2 - 1) * R;
        const W = Math.sqrt(Math.max(0, R * R - x * x)) * 0.985;
        const w = (v * 2 - 1) * W;
        const ph = w / rho;
        const rr = rho - off;
        return [x, rho - rr * Math.cos(ph), rr * Math.sin(ph)];
      };
      const shellColor = (inner) => (c) => {
        const n = c.fbm(c.p[0] * 5, c.p[1] * 5, c.p[2] * 5, 3);
        let col = mix("#f0c255", "#d9982e", smoothstep(-0.2, 0.6, n));
        if (c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40) > 0.5) col = "#b97822";
        if (inner) col = shade(col, 0.85);
        return lit(c, col, 0.74, 0.38);
      };
      for (const inner of [false, true]) {
        k.add(
          k.param((u, v) => shellAt(u, v, inner ? 0.025 : 0), { grid: 72, flip: inner }),
          {
            rot: [0, yaw, 0],
            flat: 0.2,
            color: shellColor(inner),
          },
        );
      }
      // The filling, packed between the walls; heights are relative to the
      // rim at each point along the taco, so it peeks just over the edge.
      const q = quatEuler(0, yaw, 0);
      const inU = (rand, lo, hi, spread = 0.86, reach = 0.8) => {
        const x = (rand() * 2 - 1) * reach;
        const W = Math.sqrt(R * R - x * x);
        const top = rho * (1 - Math.cos(W / rho));
        const y = Math.max(0.06, top + lo + rand() * (hi - lo));
        const ph = Math.acos(clamp(1 - Math.min(y, top) / rho, -1, 1));
        const z = (rand() * 2 - 1) * rho * Math.sin(ph) * spread;
        return quatRotate(q, [x, y, z]);
      };
      k.cloud({ share: 0.16, size: 1.5, flat: 0.6 }, (rand) => {
        const p = inU(rand, -0.4, -0.02, 0.8);
        const n = randDir(rand);
        const l = Math.max(0, dot(n, LIGHT));
        return { p, n, color: shade(mix("#7a4322", "#4a2512", rand()), 0.7 + 0.5 * l) };
      });
      k.cloud({ share: 0.12, size: 0.95, pattern: false }, (rand) => {
        const p = inU(rand, -0.1, 0.07, 0.95, 0.84);
        const d = unit([rand() - 0.5, (rand() - 0.1) * 0.9, (rand() - 0.5) * 0.6]);
        return {
          p,
          dir: d,
          stretch: 3.5,
          color: shade(mix("#b5e35f", "#62b52f", rand()), 0.85 + 0.25 * rand()),
          opacity: 1,
        };
      });
      k.cloud({ share: 0.04, size: 0.8, pattern: false }, (rand) => {
        const p = inU(rand, 0.0, 0.09, 0.85, 0.75);
        return {
          p,
          dir: unit([rand() - 0.5, rand() * 0.3, rand() - 0.5]),
          stretch: 3.2,
          color: mix("#ffc23a", "#f58f1a", rand()),
          opacity: 1,
        };
      });
      for (let i = 0; i < 16; i++) {
        const p = inU(k.rand, 0.0, 0.06, 0.7, 0.7);
        k.add(k.box(0.075, 0.07, 0.075), {
          pos: p,
          rot: [k.rand() * 90, k.rand() * 90, 0],
          flat: 0.3,
          weight: 2,
          pattern: false,
          color: (c) => glossy(c, c.s.face % 2 ? "#e8321f" : "#f0654c", 0.4, 16),
        });
      }
    },
  },

  egg: {
    options: [
      {
        key: "shell",
        label: "Shell",
        type: "select",
        default: "brown",
        choices: [
          { id: "brown", label: "Brown" },
          { id: "white", label: "White" },
        ],
      },
      { key: "cup", label: "Egg cup", type: "color", default: "#8fd6c8" },
    ],
    controls: [{ key: "crack", label: "Cracked open", type: "toggle", default: 0, ease: 0.9 }],
    action: { key: "crack", label: "Crack" },
    drive(t, c, out) {
      const e = easeInOut(c.crack);
      out.parts.cap = { angle: -2.0 * e, offset: [0, 0.06 * Math.sin(Math.PI * e), 0] };
      out.grow = c.crack;
    },
    build(k, o) {
      const shellCol = o.shell === "white" ? "#f5efe3" : "#d9a06c";
      const eggPts = [
        [0, -0.6],
        [0.25, -0.56],
        [0.42, -0.4],
        [0.5, -0.16],
        [0.49, 0.1],
        [0.42, 0.34],
        [0.3, 0.53],
        [0.15, 0.65],
        [0, 0.69],
      ];
      const eggR = radiusAt(eggPts);
      const crackY = (a) => {
        const f = (a / TAU) * 13;
        return 0.29 + 0.035 * (Math.abs(f - Math.floor(f) - 0.5) * 4 - 1);
      };
      const shellColor = (c, below) => {
        const a = Math.atan2(c.p[0], c.p[2]);
        const cy = crackY(a);
        if (below ? c.p[1] > cy : c.p[1] < cy) return null;
        let col = shade(shellCol, 0.94 + 0.1 * c.noise(c.p[0] * 20, c.p[1] * 20, c.p[2] * 20));
        if (o.shell !== "white" && c.noise(c.p[0] * 70, c.p[1] * 70, c.p[2] * 70) > 0.5)
          col = shade(col, 0.75);
        return glossy(c, col, 0.3, 18, 0.74, 0.38);
      };
      const egg = revolve(k, eggPts, null, { grid: 96, thick: 0.45 });
      const cutY = 0.27;
      k.add(egg, {
        flat: 0.2,
        interior: 0.1,
        core: (c) =>
          c.p[1] > cutY - 0.01
            ? null
            : Math.hypot(c.p[0], c.p[1] - 0.1, c.p[2]) < 0.22
              ? "#ffb81c"
              : "#fbf8f0",
        color: (c) => shellColor(c, true),
      });
      const cap = k.part("cap", { pivot: [0, 0.3, -0.44], axis: [1, 0, 0] });
      k.add(egg, { part: cap, flat: 0.2, color: (c) => shellColor(c, false) });
      // Inside: the white and a runny golden yolk, and the cap's white underside.
      k.add(topDisc(k, eggR(cutY) - 0.012), {
        pos: [0, cutY, 0],
        flat: 0.2,
        color: (c) => lit(c, "#fbf8f0", 0.85, 0.2),
      });
      k.add(k.ellipsoid(0.21, 0.11, 0.21), {
        pos: [0, cutY, 0],
        flat: 0.25,
        weight: 1.5,
        pattern: false,
        color: (c) => (c.lp[1] < 0 ? null : glossy(c, "#ffb21a", 0.9, 30, 0.82, 0.3)),
      });
      k.add(topDisc(k, eggR(0.31) - 0.01), {
        pos: [0, 0.31, 0],
        rot: [180, 0, 0],
        part: cap,
        flat: 0.2,
        color: "#f6f2e8",
      });
      // A drip of yolk down the shell once it is open.
      const dripA = 0.5;
      k.add(
        k.tube(
          (t) => {
            const y = cutY + 0.02 - t * 0.3;
            const r = eggR(y) + 0.015;
            return [Math.sin(dripA) * r, y, Math.cos(dripA) * r];
          },
          (t) => 0.03 + 0.018 * smoothstep(0.7, 0.95, t),
          { caps: true, samples: 64, grid: 32 },
        ),
        {
          flat: 0.3,
          weight: 2,
          pattern: false,
          kind: "grow",
          params: (c) => [0.55 + 0.4 * (c.t ?? 0), 0],
          color: (c) => glossy(c, "#ffb21a", 0.8, 24),
        },
      );
      // The egg cup.
      k.add(
        revolve(k, [
          [0, -0.97],
          [0.42, -0.97],
          [0.46, -0.93],
          [0.42, -0.88],
          [0.2, -0.8],
          [0.16, -0.68],
          [0.2, -0.58],
          [0.38, -0.48],
          [0.5, -0.3],
          [0.54, -0.1],
          [0.54, -0.04],
        ]),
        {
          flat: 0.2,
          color: (c) => {
            // White polka dots on the glaze.
            const a = Math.atan2(c.p[0], c.p[2]);
            const row = Math.round((c.p[1] + 0.1) / 0.13);
            const n = 10;
            const f = (a / TAU) * n + (row % 2) * 0.5;
            const du = (f - Math.round(f)) * (TAU / n) * Math.hypot(c.p[0], c.p[2]);
            const dv = c.p[1] + 0.1 - row * 0.13;
            const spot = row >= -3 && row <= 0 && Math.hypot(du, dv) < 0.032;
            return glossy(c, spot ? "#fffdf8" : o.cup, 0.8, 40, 0.74, 0.34);
          },
        },
      );
      // Toast soldiers.
      for (let i = 0; i < 2; i++) {
        k.add(k.roundedBox(0.22, 0.86, 0.2, 6), {
          pos: [0.8 + i * 0.28, -0.56 + i * 0.02, 0.2 - i * 0.25],
          rot: [0, 20 + i * 15, -16 + i * 7],
          flat: 0.25,
          interior: 0.08,
          core: "#f3dfae",
          color: (c) => {
            const ax = Math.abs(c.ln[0]);
            const az = Math.abs(c.ln[2]);
            const crustSide = ax > az ? 1 : 0;
            const n = c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30);
            const col = crustSide
              ? mix("#a8642a", "#7d4418", 0.5 + 0.5 * n)
              : mix("#e8b667", "#c98a3e", 0.5 + 0.5 * n);
            return lit(c, col, 0.74, 0.38);
          },
        });
      }
      k.reach([0, 0.75, -1.0]);
    },
  },

  coffee: {
    alive: true,
    options: [
      {
        key: "art",
        label: "Latte art",
        type: "select",
        default: "heart",
        choices: [
          { id: "heart", label: "Heart" },
          { id: "rosetta", label: "Rosetta" },
          { id: "tulip", label: "Tulip" },
        ],
      },
      { key: "cup", label: "Cup", type: "color", default: "#f4f1ec" },
    ],
    controls: [
      { key: "hot", label: "Steam", type: "slider", default: 0.7 },
      { key: "stir", label: "Stir", type: "pulse", ease: 3.2 },
    ],
    action: { key: "stir", label: "Stir" },
    // A stir spins the coffee twice round and twists the latte art into a
    // swirl (the middle turns further than the edge) that relaxes back as it
    // stops, while a puff of steam curls up.
    drive(t, c, out) {
      const p = 1 - c.stir;
      const turn = TAU * 2 * easeInOut(p);
      const twist = c.stir > 0 ? 3.2 * Math.sin(Math.PI * smoothstep(0, 0.9, p)) : 0;
      for (let i = 0; i < COFFEE_RINGS; i++)
        out.parts[`coffee${i}`] = { angle: turn + twist * (1 - (i + 0.5) / COFFEE_RINGS) };
      out.parts.puff = {
        visible: c.stir > 0 ? smoothstep(0, 0.1, p) * (1 - smoothstep(0.7, 1, p)) : 0,
      };
      out.amount = 0.3 + c.hot + 0.8 * c.stir;
    },
    build(k, o) {
      const cup = o.cup;
      const ceramic = (c) => glossy(c, cup, 0.85, 45, 0.76, 0.3);
      // Saucer.
      k.add(
        revolve(
          k,
          [
            [0, 0.0],
            [0.33, 0.0],
            [0.36, 0.02],
            [0.4, 0.015],
            [0.75, 0.045],
            [0.93, 0.09],
            [0.98, 0.105],
          ],
          null,
          { flip: true },
        ),
        { flat: 0.2, color: ceramic },
      );
      // The cup: outside, inside wall above the coffee, rim and handle.
      k.add(
        revolve(k, [
          [0.24, 0.02],
          [0.33, 0.04],
          [0.42, 0.12],
          [0.51, 0.33],
          [0.57, 0.53],
          [0.6, 0.66],
        ]),
        {
          flat: 0.2,
          interior: 0.06,
          core: (c) => (c.p[1] > 0.54 ? null : Math.hypot(c.p[0], c.p[2]) > 0.5 ? cup : "#5a3418"),
          color: ceramic,
        },
      );
      k.add(
        revolve(
          k,
          [
            [0.53, 0.55],
            [0.56, 0.6],
            [0.585, 0.66],
          ],
          null,
          { flip: true },
        ),
        { flat: 0.2, color: (c) => shade(cup, 0.9) },
      );
      k.add(k.torus(0.592, 0.014), { pos: [0, 0.662, 0], flat: 0.3, weight: 1.5, color: ceramic });
      k.add(
        k.tube(
          spline([
            [0.54, 0.5, 0],
            [0.74, 0.55, 0],
            [0.84, 0.42, 0],
            [0.74, 0.24, 0],
            [0.48, 0.18, 0],
          ]),
          0.045,
        ),
        { scale: [1, 1, 0.8], flat: 0.25, weight: 1.3, color: ceramic },
      );
      // The coffee with latte art, on a part that turns when stirred.
      // It is made of rings, each a part, so a stir can twist the art.
      const art = LATTE[o.art] || LATTE.heart;
      for (let i = 0; i < COFFEE_RINGS; i++) {
        const r0 = (0.545 * i) / COFFEE_RINGS;
        const r1 = (0.545 * (i + 1)) / COFFEE_RINGS;
        const ring = k.param(
          (u, v) => {
            const a = u * TAU;
            const r = r0 + (r1 - r0) * v;
            return [Math.sin(a) * r, 0, Math.cos(a) * r];
          },
          { grid: i < 2 ? 24 : 48, normal: () => [0, 1, 0] },
        );
        k.add(ring, {
          pos: [0, 0.58, 0],
          part: k.part(`coffee${i}`, { pivot: [0, 0.58, 0], axis: [0, 1, 0] }),
          flat: 0.15,
          weight: 1.6,
          color: (c) => {
            const x = c.lp[0] / 0.545;
            const z = c.lp[2] / 0.545;
            const r = Math.hypot(x, z);
            let col = mix("#c98d52", "#7a4520", smoothstep(0.62, 1.0, r));
            col = mix(col, "#a86a36", 0.3 * c.noise(x * 8, z * 8, 1));
            const a = art(x, -z);
            if (a > 0) col = mix(col, "#fbf3e4", smoothstep(0, 0.06, a));
            return keep(mix(col, "#ffffff", 0.2 * spec(c, 30)));
          },
        });
      }
      // A thicker puff of steam that curls up while it is stirred.
      const puff = k.part("puff");
      k.cloud({ share: 0.012, size: 2.6, pattern: false }, (rand) => {
        const a = rand() * TAU;
        const r = 0.3 * Math.sqrt(rand());
        return {
          p: [Math.sin(a) * r, 0.64 + rand() * 0.05, Math.cos(a) * r],
          color: "#ffffff",
          opacity: 0.16,
          kind: "rise",
          params: [0.9 + rand() * 0.4, rand()],
          part: puff,
        };
      });
      // Steam curling up.
      k.cloud({ share: 0.02, size: 2.4, pattern: false }, (rand) => {
        const a = rand() * TAU;
        const r = 0.25 * Math.sqrt(rand());
        return {
          p: [Math.sin(a) * r, 0.64 + rand() * 0.05, Math.cos(a) * r],
          color: "#ffffff",
          opacity: 0.08,
          kind: "rise",
          params: [0.7 + rand() * 0.3, rand()],
        };
      });
      // A teaspoon on the saucer.
      const q = quatEuler(0, 58, 0);
      k.add(k.ellipsoid(0.12, 0.03, 0.08), {
        quat: q,
        pos: add([0, 0.07, 0], quatRotate(q, [0.3, 0, 0.62])),
        flat: 0.25,
        weight: 1.5,
        color: (c) => glossy(c, mix("#aeb4bd", "#e4e8ee", 0.5 + 0.5 * c.n[1]), 0.9, 30),
      });
      k.add(k.cone(0.022, 0.014, 0.62), {
        quat: quatMul(q, quatEuler(0, 0, 90)),
        pos: add([0, 0.08, 0], quatRotate(q, [0.3, 0, 0.62 - 0.4])),
        flat: 0.3,
        weight: 1.6,
        color: (c) => glossy(c, "#c3c8cf", 0.9, 30),
      });
      k.reach([0, 1.4, 0]);
    },
  },

  apple: {
    options: [
      {
        key: "variety",
        label: "Apple",
        type: "select",
        default: "red",
        choices: [
          { id: "red", label: "Red" },
          { id: "green", label: "Green" },
          { id: "golden", label: "Golden" },
        ],
      },
    ],
    build(k, o) {
      const [skin, blush, deep] = {
        red: ["#c81d2a", "#f2b13e", "#7a0d17"],
        green: ["#8cc63f", "#e2e66a", "#4c8a22"],
        golden: ["#f1cc48", "#f59a38", "#c29522"],
      }[o.variety];
      const pts = [
        [0, -0.37],
        [0.1, -0.43],
        [0.36, -0.45],
        [0.6, -0.3],
        [0.72, -0.02],
        [0.7, 0.24],
        [0.56, 0.43],
        [0.33, 0.49],
        [0.14, 0.41],
        [0.03, 0.34],
        [0, 0.33],
      ];
      k.add(
        revolve(k, pts, (a) => 1 + 0.012 * Math.sin(a * 5 + 0.5), { grid: 96, thick: 0.6 }),
        {
          flat: 0.2,
          interior: 0.12,
          core: (c) => {
            const [x, y, z] = c.p;
            const r = Math.hypot(x, z);
            const a = Math.atan2(x, z);
            if (Math.abs(y) < 0.2 && r < 0.17 * (0.55 + 0.45 * Math.abs(Math.cos(a * 2.5)))) {
              for (let i = 0; i < 5; i++) {
                const sa = (i / 5) * TAU;
                if (
                  Math.hypot(x - Math.sin(sa) * 0.1, (y + 0.02) * 0.7, z - Math.cos(sa) * 0.1) <
                  0.035
                )
                  return keep("#4a2a14");
              }
              return "#efe0b2";
            }
            return shade("#f8f0cf", 0.95 + 0.08 * c.noise(x * 20, y * 20, z * 20));
          },
          color: (c) => {
            const [x, y, z] = c.p;
            const a = Math.atan2(x, z);
            const streak = c.fbm(Math.sin(a) * 2.5, y * 10, Math.cos(a) * 2.5, 3);
            let col = mix(
              skin,
              blush,
              clamp(0.35 * smoothstep(-0.1, 0.5, streak) + 0.35 * smoothstep(0.1, -0.5, y), 0, 1),
            );
            col = mix(col, deep, 0.35 * smoothstep(0.2, 0.8, c.fbm(x * 3, y * 3, z * 3, 2) + 0.4));
            // Around the stalk the skin turns yellowish and shaded.
            const r = Math.hypot(x, z);
            if (y > 0.28 && r < 0.3) col = mix(col, shade(blush, 0.7), 0.5 * (1 - r / 0.3));
            if (c.noise(x * 80, y * 80, z * 80) > 0.62) col = mix(col, "#fff2c8", 0.3);
            return glossy(c, col, 0.8, 38, 0.72, 0.4);
          },
        },
      );
      k.add(
        k.tube(
          spline([
            [0, 0.32, 0],
            [0.015, 0.45, 0],
            [0.06, 0.6, 0.01],
          ]),
          (t) => 0.03 - 0.01 * t,
          { caps: true },
        ),
        { flat: 0.3, weight: 2.5, pattern: false, color: (c) => lit(c, "#6b4524") },
      );
      k.add(leafShape(k, 0.56, 0.17, 0.35), {
        pos: [0.03, 0.52, 0],
        rot: [8, -40, 20],
        flat: 0.2,
        weight: 1.6,
        pattern: false,
        color: leafColor("#3f8f2f", "#9fd06a"),
      });
    },
  },

  banana: {
    options: [
      {
        key: "ripe",
        label: "Ripeness",
        type: "select",
        default: "ripe",
        choices: [
          { id: "green", label: "Green" },
          { id: "ripe", label: "Just right" },
          { id: "spotty", label: "Spotty" },
        ],
      },
    ],
    build(k, o) {
      const yellow = o.ripe === "green" ? "#a9c93a" : "#f6d43a";
      const Rb = 1.0;
      // One banana: a smiling arc from its neck (t = 0) to its tip.
      const arc = (t) => {
        const a = -1.05 + t * 1.9;
        return [Math.sin(a) * Rb, Rb - Math.cos(a) * Rb, 0];
      };
      const rad = (t) =>
        t < 0.1
          ? 0.05 + 0.06 * smoothstep(0.02, 0.1, t)
          : 0.03 + 0.14 * Math.pow(Math.sin(Math.PI * clamp((t - 0.04) / 0.98, 0, 1)), 0.55);
      const shape = k.tube(arc, rad, { caps: true, samples: 200, grid: 80 });
      const color = (c) => {
        const t = c.t ?? 0.5;
        const edge = smoothstep(0.8, 1, Math.cos(c.u * TAU * 5));
        let col = mix(
          yellow,
          "#8fae2e",
          smoothstep(0.25, 0.04, t) * (o.ripe === "green" ? 0.3 : 1),
        );
        if (t > 0.97) col = "#3a2716";
        if (t < 0.035) col = "#6b5a2a";
        if (o.ripe === "spotty" && c.noise(c.p[0] * 22, c.p[1] * 22, c.p[2] * 22) > 0.35)
          col = mix(col, "#6b4520", 0.8);
        else if (c.noise(c.p[0] * 60, c.p[1] * 60, c.p[2] * 60) > 0.62)
          col = mix(col, "#8a6a2a", 0.5);
        col = shade(col, 1 - 0.12 * edge);
        return glossy(c, col, 0.35, 20, 0.74, 0.38);
      };
      const bananas = [
        { rot: [0, -24, -6], pos: [0, 0, -0.18] },
        { rot: [0, 4, 4], pos: [0, 0.02, 0] },
        { rot: [0, 30, 12], pos: [0, 0.05, 0.18] },
      ];
      for (const b of bananas) {
        k.add(shape, {
          ...b,
          flat: 0.22,
          interior: 0.1,
          core: "#f8ecc4",
          color,
        });
      }
      // The crown where the stalks meet.
      const top = arc(0);
      k.add(
        k.tube(
          spline([
            add(top, [0.02, 0.0, 0]),
            add(top, [-0.08, 0.06, 0]),
            add(top, [-0.18, 0.08, 0]),
          ]),
          0.065,
          { caps: true },
        ),
        { flat: 0.3, weight: 1.5, color: (c) => lit(c, mix("#7a6a2e", "#4a3a1a", c.t ?? 0)) },
      );
    },
  },

  orange: {
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "cut",
        choices: [
          { id: "cut", label: "Whole and half" },
          { id: "whole", label: "Whole" },
          { id: "half", label: "Half" },
        ],
      },
    ],
    build(k, o) {
      const R = 0.72;
      const peel = (c) => {
        const n = c.noise(c.lp[0] * 45, c.lp[1] * 45, c.lp[2] * 45);
        const col = shade(
          mix("#f7931e", "#ee7a12", 0.5 + 0.5 * c.fbm(c.lp[0] * 3, c.lp[1] * 3, c.lp[2] * 3, 2)),
          0.93 + 0.12 * n,
        );
        return glossy(c, col, 0.55, 30, 0.74, 0.38);
      };
      // Segments seen in a cut: angle a around the core, rho 0 centre .. 1 peel.
      const flesh = (a, rho, c) => {
        if (rho > 0.965) return "#ec7a14";
        if (rho > 0.88) return "#fbeed6";
        if (rho < 0.09) return "#fbeed6";
        const seg = (a / TAU) * 11;
        const e = Math.abs(seg - Math.floor(seg) - 0.5);
        if (e > 0.465) return "#fde3b8";
        const juice = c.noise(Math.cos(a) * 3 + a * 6, rho * 9, 0.5);
        const col = mix("#fb9c1f", "#f57e0f", 0.5 + 0.5 * juice + 0.4 * (e - 0.25));
        return c.noise(a * 30, rho * 30, 3) > 0.55 ? mix(col, "#ffd9a0", 0.5) : col;
      };
      const whole = (pos) => {
        k.add(k.sphere(R), {
          pos,
          scale: [1, 0.94, 1],
          flat: 0.2,
          interior: 0.14,
          core: (c) => {
            const q = sub(c.p, pos);
            const rho = len([q[0], q[1] / 0.94, q[2]]) / R;
            return flesh(
              Math.atan2(q[0], q[2]) + Math.PI,
              Math.hypot(q[0], q[2]) / R < 0.09 ? 0 : rho,
              c,
            );
          },
          color: (c) => {
            const top = c.ln[1];
            if (top > 0.985) return keep(lit(c, "#6b7a2a"));
            if (top > 0.965) return keep(lit(c, "#c8a03a"));
            return peel(c);
          },
        });
        const cap = add(pos, [0, R * 0.94, 0]);
        k.add(k.cylinder(0.018, 0.08), {
          pos: add(cap, [0, 0.03, 0]),
          weight: 3,
          pattern: false,
          color: "#5a4a22",
        });
        k.add(leafShape(k, 0.5, 0.15, 0.2), {
          pos: add(cap, [0.01, 0.02, 0]),
          rot: [0, -60, 16],
          flat: 0.2,
          weight: 1.5,
          pattern: false,
          color: leafColor("#2f7a2a", "#7fbf5a"),
        });
      };
      const half = (pos, yaw, tilt) => {
        const q = quatMul(quatEuler(0, yaw, 0), quatEuler(tilt, 0, 0));
        k.add(halfEllipsoid(k, R * 0.95, R * 0.95, R * 0.95), {
          quat: q,
          pos,
          flat: 0.2,
          color: peel,
        });
        k.add(
          k.param(
            (u, v) => {
              const a = u * TAU;
              const r = v * R * 0.95;
              return [Math.cos(a) * r, Math.sin(a) * r, 0];
            },
            { grid: 64, normal: () => [0, 0, 1], thick: R * 0.9 },
          ),
          {
            quat: q,
            pos,
            flat: 0.15,
            interior: 0.08,
            core: "#f98d1c",
            color: (c) => {
              const col = flesh(c.u * TAU, c.v, c);
              return keep(mix(col, "#ffffff", 0.35 * spec(c, 30)));
            },
          },
        );
      };
      if (o.style === "whole") whole([0, 0, 0]);
      else if (o.style === "half") half([0, 0, 0], 32, -35);
      else {
        whole([-0.42, 0, -0.35]);
        half([0.55, -0.1, 0.45], 32, -42);
      }
    },
  },

  kiwi: {
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "cut",
        choices: [
          { id: "cut", label: "Whole and half" },
          { id: "whole", label: "Whole" },
          { id: "half", label: "Half" },
        ],
      },
    ],
    build(k, o) {
      const A = 0.46;
      const B = 0.42;
      const C = 0.62;
      const skin = (c) => {
        const n = c.noise(c.lp[0] * 60, c.lp[1] * 60, c.lp[2] * 60);
        const col = mix(
          "#8b6a3e",
          "#6a4a26",
          0.5 + 0.5 * c.fbm(c.lp[0] * 4, c.lp[1] * 4, c.lp[2] * 4, 2),
        );
        return lit(c, shade(col, 0.9 + 0.2 * n), 0.74, 0.4);
      };
      // The cut face: x, y across the fruit scaled to the unit disc.
      const face = (x, y, c) => {
        const rho = Math.hypot(x, y);
        const a = Math.atan2(y, x);
        if (rho > 0.97) return "#6f5230";
        if (rho > 0.92) return "#b8d86a";
        const streak = 0.5 + 0.5 * Math.sin(a * 70 + 3 * c.noise(x * 6, y * 6, 0));
        if (rho < 0.2) return mix("#f5f3d2", "#e7ecb0", smoothstep(0.1, 0.2, rho));
        if (rho < 0.44) {
          // A ring of small black seeds pointing outwards.
          const n = 46;
          const s = (a / TAU) * n;
          const j = Math.round(s);
          const da = (s - j) * (TAU / n) * rho;
          const r0 = 0.33 + 0.05 * (hash3(j, 3, 7) - 0.5);
          const dr = rho - r0;
          if ((dr / 0.05) ** 2 + (da / 0.02) ** 2 < 1) return keep("#1d1a12");
          return mix("#d9e89a", "#9ccf2a", smoothstep(0.2, 0.44, rho) * (0.6 + 0.4 * streak));
        }
        return mix("#7fb80f", "#a6d83c", 0.35 * streak + 0.2 * smoothstep(0.6, 0.9, rho));
      };
      const whole = (pos, rot) => {
        k.add(k.ellipsoid(A, B, C), {
          pos,
          rot,
          flat: 0.55,
          jitter: 0.08,
          interior: 0.14,
          core: (c) => {
            const q = turnY(sub(c.p, pos), -rot[1]);
            return face(q[0] / A, q[1] / B, c);
          },
          color: (c) => (Math.abs(c.ln[2]) > 0.985 ? keep(lit(c, "#4a3218")) : skin(c)),
        });
      };
      const half = (pos, yaw, tilt) => {
        const q = quatMul(quatEuler(0, yaw, 0), quatEuler(tilt, 0, 0));
        k.add(halfEllipsoid(k, A, B, C * 0.9), {
          quat: q,
          pos,
          flat: 0.55,
          jitter: 0.08,
          color: skin,
        });
        k.add(
          k.param(
            (u, v) => {
              const a = u * TAU;
              return [Math.cos(a) * v * A, Math.sin(a) * v * B, 0];
            },
            { grid: 72, normal: () => [0, 0, 1], thick: 0.4 },
          ),
          {
            quat: q,
            pos,
            flat: 0.15,
            weight: 1.3,
            interior: 0.06,
            core: "#8cc41a",
            color: (c) => {
              const col = face(c.lp[0] / A, c.lp[1] / B, c);
              if (col.keep) return col;
              return keep(mix(col, "#ffffff", 0.4 * spec(c, 30)));
            },
          },
        );
      };
      if (o.style === "whole") whole([0, 0, 0], [0, 30, 0]);
      else if (o.style === "half") half([0, 0, 0], 30, -30);
      else {
        whole([-0.38, 0, -0.35], [0, 60, 0]);
        half([0.42, 0.02, 0.38], 32, -36);
      }
    },
  },

  pineapple: {
    build(k) {
      const pts = [
        [0, -0.86],
        [0.34, -0.83],
        [0.52, -0.64],
        [0.6, -0.3],
        [0.61, 0.02],
        [0.57, 0.32],
        [0.47, 0.56],
        [0.3, 0.71],
        [0.12, 0.77],
        [0, 0.78],
      ];
      const N = 12;
      const M = 3.6;
      const cell = (a, y) => {
        const fa = (a / TAU) * N + y * M;
        const fb = (a / TAU) * N - y * M;
        const da = fa - Math.round(fa);
        const db = fb - Math.round(fb);
        return { d: Math.max(Math.abs(da), Math.abs(db)), da, db };
      };
      k.add(
        revolve(
          k,
          pts,
          (a, y) => {
            const { d } = cell(a, y);
            return 1 + 0.045 * (0.5 - d) * 2;
          },
          { grid: 120, thick: 0.6 },
        ),
        {
          flat: 0.25,
          interior: 0.12,
          core: (c) =>
            Math.hypot(c.p[0], c.p[2]) < 0.14
              ? "#f5ebb4"
              : shade("#f8d85a", 0.94 + 0.1 * c.noise(c.p[0] * 20, c.p[1] * 20, c.p[2] * 20)),
          color: (c) => {
            const a = Math.atan2(c.p[0], c.p[2]);
            const { d, da, db } = cell(a, c.p[1]);
            let col;
            if (d > 0.43) col = "#4d3a14";
            else col = mix("#f0b534", "#a0601c", smoothstep(0.1, 0.43, d));
            // A little spike near the top of each eye.
            if (Math.hypot(da + db * 0 - 0.12, db - 0.12) < 0.07) col = "#3a2a0e";
            const ends = smoothstep(0.35, 0.75, Math.abs(c.p[1] + 0.05));
            col = mix(col, "#7a8a2a", 0.35 * ends);
            return lit(c, col, 0.72, 0.42);
          },
        },
      );
      // A crown of spiky leaves.
      const leaves = 30;
      for (let i = 0; i < leaves; i++) {
        const f = i / leaves;
        const az = i * 2.39996;
        const el = (80 - 55 * f) * (Math.PI / 180);
        const L = 0.45 + 0.4 * (1 - Math.abs(f - 0.45) * 1.4) + k.rand() * 0.08;
        const hor = [Math.sin(az), 0, Math.cos(az)];
        const side = [Math.cos(az), 0, -Math.sin(az)];
        const base = add([0, 0.74, 0], mul(hor, 0.05 + 0.1 * f));
        const p1 = add(base, add(mul(hor, 0.12 * L), [0, 0.45 * L, 0]));
        const p2 = add(base, add(mul(hor, Math.cos(el) * L), [0, Math.sin(el) * L, 0]));
        const bez = (t) =>
          add(add(mul(base, (1 - t) * (1 - t)), mul(p1, 2 * t * (1 - t))), mul(p2, t * t));
        const blade = k.param(
          (u, v) => {
            const s = v * 2 - 1;
            const w = (0.06 * Math.pow(1 - u, 0.9) + 0.004) * s;
            const fold = 0.02 * Math.abs(s) * (1 - u);
            return add(bez(u), add(mul(side, w), mul(hor, -fold)));
          },
          { grid: 20 },
        );
        k.add(blade, {
          flat: 0.2,
          weight: 1.4,
          pattern: false,
          color: (c) => {
            const s = Math.abs(c.v * 2 - 1);
            const col = mix("#2f6b3a", "#86bf5c", smoothstep(0.1, 1, c.u));
            return lit(c, s < 0.1 ? shade(col, 0.8) : col, 0.74, 0.38);
          },
        });
      }
    },
  },

  cherries: {
    build(k) {
      const shape = revolve(
        k,
        [
          [0, -0.36],
          [0.18, -0.34],
          [0.33, -0.2],
          [0.38, 0],
          [0.34, 0.19],
          [0.2, 0.29],
          [0.06, 0.25],
          [0, 0.22],
        ],
        null,
        { grid: 80, thick: 0.35 },
      );
      const cherries = [
        { pos: [-0.36, -0.42, 0.05], rot: [0, 0, 8] },
        { pos: [0.34, -0.5, -0.06], rot: [0, 40, -6] },
      ];
      const glow = (c) => {
        const col = mix(
          "#d0132e",
          "#6e0615",
          smoothstep(0.4, -0.7, c.n[1]) * 0.8 + 0.2 * smoothstep(0, 1, rim(c)),
        );
        return glossy(c, col, 1, 36, 0.72, 0.4);
      };
      for (const ch of cherries) {
        k.add(shape, {
          ...ch,
          flat: 0.2,
          interior: 0.1,
          core: (c) => (len(sub(c.p, ch.pos)) < 0.1 ? "#e8d0a0" : "#8a0f1e"),
          color: glow,
        });
        k.add(shape, {
          ...ch,
          share: 0.01,
          size: 0.7,
          pattern: false,
          kind: "glint",
          params: [0.8, 0],
          color: (c) => (spec(c, 36) > 0.5 ? keep("#ffffff") : null),
        });
      }
      const joint = [0.06, 1.0, 0];
      const stems = [
        [
          add(cherries[0].pos, [0.02, 0.24, 0]),
          add(cherries[0].pos, [0.06, 0.55, 0.02]),
          [-0.12, 0.78, 0.02],
          joint,
        ],
        [
          add(cherries[1].pos, [-0.02, 0.24, 0]),
          add(cherries[1].pos, [-0.04, 0.6, -0.02]),
          [0.14, 0.82, -0.02],
          joint,
        ],
      ];
      for (const s of stems) {
        k.add(
          k.tube(spline(s), (t) => 0.024 - 0.006 * t, { caps: true }),
          {
            flat: 0.3,
            weight: 2,
            pattern: false,
            color: (c) => lit(c, mix("#7a9a2a", "#6b4a22", smoothstep(0.6, 1, c.t ?? 0))),
          },
        );
      }
      k.add(leafShape(k, 0.62, 0.2, 0.25), {
        pos: add(joint, [0, -0.02, 0]),
        rot: [20, -20, -14],
        flat: 0.2,
        weight: 1.4,
        pattern: false,
        color: leafColor("#3f8f2f", "#9fd06a"),
      });
    },
  },

  grapes: {
    options: [
      {
        key: "color",
        label: "Grapes",
        type: "select",
        default: "purple",
        choices: [
          { id: "purple", label: "Purple" },
          { id: "green", label: "Green" },
          { id: "red", label: "Red" },
        ],
      },
    ],
    build(k, o) {
      const [base, bloom, dark] = {
        purple: ["#4e2464", "#9b86b8", "#2a0f38"],
        green: ["#a8cf52", "#e5f2a8", "#6c9a2a"],
        red: ["#9c2b4b", "#d28aa0", "#5a0f25"],
      }[o.color];
      const grape = k.ellipsoid(0.15, 0.175, 0.15);
      const grapeColor = (c) => {
        const haze = 0.5 + 0.5 * c.fbm(c.p[0] * 9, c.p[1] * 9, c.p[2] * 9, 2);
        let col = mix(base, bloom, 0.35 * haze);
        col = mix(col, dark, 0.45 * smoothstep(0.2, -0.8, c.n[1]));
        return glossy(c, col, 0.55, 30, 0.72, 0.42);
      };
      const rows = 7;
      for (let j = 0; j < rows; j++) {
        const y = 0.5 - j * 0.21;
        const rr = 0.46 * (1 - j / rows) + 0.06;
        const n = Math.max(1, Math.round((TAU * rr) / 0.27));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + j * 0.7 + k.rand() * 0.2;
          const p = [Math.sin(a) * rr, y + (k.rand() - 0.5) * 0.06, Math.cos(a) * rr];
          k.add(grape, {
            pos: p,
            rot: [k.rand() * 30, a * 57, 0],
            flat: 0.2,
            interior: 0.06,
            core: mix(bloom, "#dfe8a8", 0.5),
            color: grapeColor,
          });
        }
        if (rr > 0.2) {
          k.add(grape, {
            pos: [0, y - 0.03, 0],
            flat: 0.2,
            color: grapeColor,
          });
        }
      }
      // The stalk, a curly tendril and a leaf.
      k.add(
        k.tube(
          spline([
            [0, 0.45, 0],
            [0.02, 0.68, 0],
            [0.08, 0.86, 0],
          ]),
          (t) => 0.035 - 0.012 * t,
          { caps: true },
        ),
        { flat: 0.3, weight: 2, pattern: false, color: (c) => lit(c, "#6b5a2a") },
      );
      k.add(
        k.tube((t) => {
          const a = t * TAU * 2.2;
          const r = 0.07 * (1 - 0.5 * t);
          return [-0.08 - t * 0.25 + Math.cos(a) * r, 0.78 + Math.sin(a) * r, 0.02];
        }, 0.009),
        { flat: 0.3, weight: 3, pattern: false, color: (c) => lit(c, "#8a9a3a") },
      );
      k.add(
        k.param(
          (u, v) => {
            const th = u * TAU;
            const lobes = 0.72 + 0.28 * Math.pow(Math.abs(Math.cos(2.5 * th)), 0.6);
            const notch = 1 - 0.55 * Math.exp(-(((th - Math.PI * 1.5) / 0.3) ** 2));
            const r = 0.36 * lobes * notch * v;
            return [Math.cos(th) * r, Math.sin(th) * r, 0.05 * v * v];
          },
          { grid: 48 },
        ),
        {
          pos: [0.22, 0.85, -0.12],
          rot: [-35, 20, -20],
          flat: 0.2,
          weight: 1.3,
          pattern: false,
          color: (c) => {
            const th = c.u * TAU;
            const vein = Math.abs(Math.cos(2.5 * th)) > 0.985 || c.v < 0.06;
            const col = mix("#4f8f30", "#6fb043", c.v);
            return keep(lit(c, vein ? "#a6d67a" : col, 0.74, 0.36));
          },
        },
      );
    },
  },

  avocado: {
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "both",
        choices: [
          { id: "both", label: "Both halves" },
          { id: "pit", label: "Half with the stone" },
        ],
      },
    ],
    build(k, o) {
      const pts = [
        [0, -0.62],
        [0.3, -0.58],
        [0.46, -0.4],
        [0.5, -0.15],
        [0.45, 0.12],
        [0.33, 0.35],
        [0.21, 0.52],
        [0.1, 0.62],
        [0, 0.65],
      ];
      const rAt = radiusAt(pts);
      const pitY = -0.17;
      const skin = (c) => {
        const n = c.noise(c.lp[0] * 40, c.lp[1] * 40, c.lp[2] * 40);
        return glossy(c, mix("#2f3d1a", "#4f5f28", smoothstep(0.1, 0.6, n)), 0.35, 20, 0.72, 0.4);
      };
      const flesh = (x, y, hollow) => {
        const r = rAt(y);
        const q = Math.max(
          Math.abs(x) / Math.max(r, 1e-3),
          smoothstep(0.5, 0.65, y),
          smoothstep(-0.5, -0.62, y),
        );
        if (q > 0.965) return "#2f3d1a";
        let col = mix("#f0e89c", "#c8dc62", smoothstep(0.45, 0.8, q));
        col = mix(col, "#6fa832", smoothstep(0.8, 0.95, q));
        const dp = Math.hypot(x, y - pitY);
        if (hollow && dp < 0.25) {
          // The hollow left by the stone: shaded like a dip.
          const s = (y - pitY) / 0.25;
          col = shade(mix(col, "#d9d070", 0.5), 0.8 + 0.25 * s * (1 - dp / 0.25));
          if (dp > 0.225) col = shade(col, 0.85);
        }
        return col;
      };
      const half = (pos, yaw, stone) => {
        const q = quatMul(quatEuler(0, yaw, 0), quatEuler(-52, 0, 0));
        k.add(revolve(k, pts, null, { grid: 80, arc: [Math.PI / 2, (3 * Math.PI) / 2] }), {
          quat: q,
          pos,
          flat: 0.3,
          color: skin,
        });
        k.add(
          k.param(
            (u, v) => {
              const y = -0.62 + u * 1.27;
              const r = rAt(y);
              return [(v * 2 - 1) * r, y, 0];
            },
            { grid: 64, normal: () => [0, 0, 1], thick: 0.35 },
          ),
          {
            quat: q,
            pos,
            flat: 0.15,
            interior: 0.08,
            core: "#d6e07a",
            color: (c) => keep(lit(c, flesh(c.lp[0], c.lp[1], !stone), 0.82, 0.25)),
          },
        );
        if (stone) {
          k.add(k.sphere(0.235), {
            quat: q,
            pos: add(pos, quatRotate(q, [0, pitY, 0.02])),
            flat: 0.2,
            weight: 1.4,
            color: (c) =>
              glossy(
                c,
                mix("#8a5226", "#5e3316", 0.5 + 0.5 * c.fbm(c.p[0] * 8, c.p[1] * 8, c.p[2] * 8, 2)),
                0.8,
                30,
              ),
          });
        }
      };
      if (o.style === "pit") half([0, 0, 0], 30, true);
      else {
        half([-0.36, 0, -0.1], 18, true);
        half([0.42, -0.02, 0.26], 42, false);
      }
    },
  },
};

// The pizza slice slides out towards the viewer.
const PIZZA_AZ = 0.55;
const PIZZA_OUT = [Math.sin(PIZZA_AZ) * 0.5, 0.16, Math.cos(PIZZA_AZ) * 0.5];

const BURGER_LAYERS = ["patty", "cheese", "lettuce", "tomato", "top"];

// Latte art: signed amounts (> 0 inside the foam) on the unit disc, with
// y pointing away from the viewer.
const LATTE = {
  heart(x, y) {
    const X = x / 0.42;
    const Y = (y - 0.05) / 0.4;
    const a = X * X + Y * Y - 1;
    return -(a * a * a - X * X * Y * Y * Y) * 0.6;
  },
  rosetta(x, y) {
    const inLeaf = 1 - Math.hypot(x / 0.36, (y - 0.02) / 0.62);
    if (inLeaf < 0) return inLeaf;
    const stem = 0.03 - Math.abs(x);
    const band = Math.sin((y * 7 - Math.abs(x) * 5) * Math.PI);
    return Math.max(stem, band * 0.1 * Math.min(1, inLeaf * 4));
  },
  // Stacked cups: each a disc with a crescent bitten out of its top.
  tulip(x, y) {
    let best = -1;
    [
      [0.36, 0.22, false],
      [0.02, 0.3, true],
      [-0.36, 0.36, true],
    ].forEach(([cy, r, cup]) => {
      let d = r - Math.hypot(x, (y - cy) * 1.2);
      if (cup) d = Math.min(d, Math.hypot(x, (y - cy - r * 0.62) * 1.2) - r * 0.8);
      best = Math.max(best, d);
    });
    const stem = y > -0.6 && y < 0.4 ? 0.02 - Math.abs(x) : -1;
    return Math.max(best, stem);
  },
};

// A superellipsoid slab bent down at its ends (a slice of fish on rice).
function bentSlab(k, sx, sy, sz, power, bend) {
  const e = 2 / power;
  const sp = (x, kk) => Math.sign(x) * Math.pow(Math.abs(x), kk);
  return k.param(
    (u, v) => {
      const th = (v - 0.5) * Math.PI;
      const ph = u * TAU - Math.PI;
      const ct = sp(Math.cos(th), e);
      const x = (sx / 2) * ct * sp(Math.sin(ph), e);
      const y = (sy / 2) * sp(Math.sin(th), e);
      const z = (sz / 2) * ct * sp(Math.cos(ph), e);
      return [x, y - bend * x * x, z];
    },
    { grid: 64, thick: sy / 2 },
  );
}

// Half an ellipsoid: the dome towards -Z, the open rim on z = 0 (for cut fruit).
function halfEllipsoid(k, a, b, c) {
  return k.param(
    (u, v) => {
      const ph = u * TAU;
      const th = (v * Math.PI) / 2;
      return [a * Math.sin(th) * Math.cos(ph), b * Math.sin(th) * Math.sin(ph), -c * Math.cos(th)];
    },
    {
      grid: 64,
      thick: Math.min(a, b, c),
      normal: (u, v) => {
        const ph = u * TAU;
        const th = (v * Math.PI) / 2;
        return [
          (Math.sin(th) * Math.cos(ph)) / a,
          (Math.sin(th) * Math.sin(ph)) / b,
          -Math.cos(th) / c,
        ];
      },
    },
  );
}

// A one-sided disc facing up (k.disc has two sides at the same place).
function topDisc(k, r) {
  return k.param(
    (u, v) => {
      const a = u * TAU;
      return [Math.sin(a) * r * v, 0, Math.cos(a) * r * v];
    },
    { grid: 48, normal: () => [0, 1, 0] },
  );
}

// The kernels that pop (their parts are made in the popcorn recipe).
const POPS = [];
{
  let s = 12345;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let j = 0; j < 14; j++) {
    POPS.push({
      period: 2.6 + r() * 3.5,
      phase: r(),
      delay: (j / 14) * 0.45 + r() * 0.05,
      height: 0.28 + r() * 0.3,
      spin: 1 + Math.floor(r() * 2),
      axis: unit([r() - 0.5, r() * 0.3, r() - 0.5]),
    });
  }
}
