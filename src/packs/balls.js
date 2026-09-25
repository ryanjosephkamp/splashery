// Sports balls. Generic designs only: classic panels, seams and stitching,
// no logos or league marks. Seams and stitches are kept out of the pattern
// layer, so a ball in the colours of a flag keeps its seams. Tap a ball to
// make it hop; Move > Bounce keeps it bouncing.

import {
  mix,
  shade,
  smoothstep,
  fibonacciSphere,
  quatFromTo,
  quatAxisAngle,
  quatMul,
  clamp,
} from "../kit.js";

const TAU = Math.PI * 2;
const PHI = (1 + Math.sqrt(5)) / 2;
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
const keep = (c, size) => ({ c, keep: true, size });

// Fine pebbling: a little light and shade at high frequency.
const pebble = (c, col, amount = 0.08, f = 38) =>
  shade(col, 1 - amount * 0.5 + amount * c.noise(c.lp[0] * f, c.lp[1] * f, c.lp[2] * f));

// Soft studio light baked into the colours (splats are unlit): a key light
// from the upper left and a highlight where it glints towards the home view.
// Materials read from this, not from random speckle.
const LIGHT = unit([-0.35, 0.8, 0.5]);
const VIEW = unit([0.5, 0.28, 0.82]);
const HALF = unit([LIGHT[0] + VIEW[0], LIGHT[1] + VIEW[1], LIGHT[2] + VIEW[2]]);
function lit(col, n, { sheen = 0, tight = 30, soft = 0.22 } = {}) {
  const out = shade(col, 1 - soft + soft * (0.5 + 0.5 * dot(n, LIGHT)) + soft * 0.1);
  if (!sheen) return out;
  return mix(out, "#ffffff", sheen * Math.max(0, dot(n, HALF)) ** tight);
}

// Pebbled grain as real bumps: a cellular pattern of small domes (about
// `f` across the ball's radius). Returns the bumped normal and how deep in a
// crevice between pebbles the point is (0..1).
function hash3(x, y, z, k) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683) ^ k;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function pebbled(c, f, depth = 0.5) {
  const x = c.lp[0] * f;
  const y = c.lp[1] * f;
  const z = c.lp[2] * f;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  let best = 9;
  let off = [0, 0, 0];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) {
        const cx = ix + dx;
        const cy = iy + dy;
        const cz = iz + dz;
        const ox = x - (cx + hash3(cx, cy, cz, 1));
        const oy = y - (cy + hash3(cx, cy, cz, 2));
        const oz = z - (cz + hash3(cx, cy, cz, 3));
        const d = ox * ox + oy * oy + oz * oz;
        if (d < best) {
          best = d;
          off = [ox, oy, oz];
        }
      }
  const d = Math.sqrt(best);
  const n = c.n;
  const along = dot(off, n);
  const t = [off[0] - n[0] * along, off[1] - n[1] * along, off[2] - n[2] * along];
  return {
    n: unit([n[0] + t[0] * depth, n[1] + t[1] * depth, n[2] + t[2] * depth]),
    crevice: smoothstep(0.45, 0.75, d),
  };
}

// A pebbled, lit surface colour.
function grip(c, col, { f = 60, depth = 0.6, crevice = 0.18, sheen = 0, tight = 30 } = {}) {
  const b = pebbled(c, f, depth);
  return lit(shade(col, 1 - crevice * b.crevice), b.n, { sheen, tight });
}

// A faint shell of round, see-through splats just outside a dark toy. Seen
// face on it is almost invisible; at the silhouette the eye looks through a
// long stretch of it, so it adds up to a soft rim of light that lifts a black
// ball off a dark page (and barely shows on a light one).
function rim(k, shape, opts = {}) {
  k.add(shape, {
    flat: 1,
    size: 1.6,
    weight: 0.35,
    opacity: 0.009,
    jitter: 0,
    color: "#aeb8c4",
    pattern: false,
    ...opts,
  });
}

// The seam of a tennis ball or baseball: a curve on the unit sphere made of
// two interlocking lobes (a + b = 1 keeps it on the sphere).
function seamCurve(a = 0.72, n = 360) {
  const b = 1 - a;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    pts.push([
      a * Math.cos(t) + b * Math.cos(3 * t),
      a * Math.sin(t) - b * Math.sin(3 * t),
      2 * Math.sqrt(a * b) * Math.sin(2 * t),
    ]);
  }
  const tangents = pts.map((p, i) => unit(sub(pts[(i + 1) % n], pts[(i - 1 + n) % n])));
  // Nearest point: angular distance, curve position (0..1) and which side.
  return (d) => {
    let best = -2;
    let bi = 0;
    for (let i = 0; i < n; i++) {
      const v = dot(d, pts[i]);
      if (v > best) {
        best = v;
        bi = i;
      }
    }
    const side = Math.sign(dot(cross(tangents[bi], pts[bi]), d)) || 1;
    return { dist: Math.acos(clamp(best, -1, 1)), t: bi / n, side };
  };
}
function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

// A plain ball body with a darker core for Slice. Colour noise is low: the
// material comes from the colour function.
function body(k, color, opts = {}) {
  return k.add(k.sphere(1), {
    flat: 0.18,
    interior: 0.12,
    jitter: 0.012,
    even: true,
    core: opts.core || "#3b2a22",
    color,
    ...opts,
  });
}

// Leather ball with stitched seam (baseball, softball).
function stitchedBall(k, leather, stitch, { a = 0.72, n = 108 } = {}) {
  const seam = seamCurve(a);
  body(k, (c) => {
    const s = seam(c.ln);
    // Smooth leather with a soft sheen; the seam is a fine groove.
    if (s.dist < 0.012) return keep(lit(shade(leather, 0.72), c.n));
    if (s.dist < 0.075) {
      // Two rows of angled stitches, one each side of the seam, standing
      // proud of the leather: crisp, small splats and a touch of shine.
      const across = (s.dist - 0.012) / 0.063;
      const f = (s.t * n + across * 0.6 * s.side + 10) % 1;
      if (across > 0.14 && across < 0.92 && f < 0.4)
        return keep(lit(stitch, c.n, { sheen: 0.25, tight: 12 }), 0.6);
      return keep(lit(shade(leather, 0.93), c.n, { sheen: 0.1 }));
    }
    return lit(leather, c.n, { sheen: 0.14, tight: 16 });
  });
}

// Truncated icosahedron faces (soccer ball): 12 pentagon and 20 hexagon
// centres; a point belongs to the face its ray meets first.
function soccerFaces() {
  const pent = [];
  for (const s1 of [-1, 1])
    for (const s2 of [-1, 1]) {
      pent.push(unit([0, s1, s2 * PHI]), unit([s1, s2 * PHI, 0]), unit([s2 * PHI, 0, s1]));
    }
  const hex = [];
  for (const x of [-1, 1])
    for (const y of [-1, 1]) for (const z of [-1, 1]) hex.push(unit([x, y, z]));
  const ip = 1 / PHI;
  for (const s1 of [-1, 1])
    for (const s2 of [-1, 1]) {
      // Face centres of the icosahedron above (its dual dodecahedron).
      hex.push(
        unit([0, s1 * PHI, s2 * ip]),
        unit([s2 * ip, 0, s1 * PHI]),
        unit([s1 * PHI, s2 * ip, 0]),
      );
    }
  // Face distances from the centre for edge length 1.
  const faces = [
    ...pent.map((n) => ({ n, h: 2.3274, pent: true })),
    ...hex.map((n) => ({ n, h: 2.2673, pent: false })),
  ];
  return (d) => {
    let t1 = Infinity;
    let t2 = Infinity;
    let f1 = null;
    for (const f of faces) {
      const c = dot(d, f.n);
      if (c <= 0) continue;
      const t = f.h / c;
      if (t < t1) {
        t2 = t1;
        t1 = t;
        f1 = f;
      } else if (t < t2) t2 = t;
    }
    return { pent: f1.pent, edge: (t2 - t1) / t1 };
  };
}

// Volleyball-style strips: three strips on each face of a cube, turning a
// quarter each face so the panels interlock.
function strips(d) {
  const a = [Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2])];
  const i = a[0] > a[1] ? (a[0] > a[2] ? 0 : 2) : a[1] > a[2] ? 1 : 2;
  const j = (i + 1) % 3;
  const w = d[j] / a[i];
  const strip = Math.min(2, Math.floor((w + 1) * 1.5));
  const edgeStrip = Math.min(Math.abs(w + 1 / 3), Math.abs(w - 1 / 3)) * a[i];
  const sorted = a.slice().sort((x, y) => y - x);
  const edgeFace = sorted[0] - sorted[1];
  return { face: i * 2 + (d[i] > 0 ? 1 : 0), strip, seam: Math.min(edgeStrip, edgeFace) };
}

// A blocky stroke font for pool-ball numbers: segments in a 1 x 2 box.
const DIGITS = {
  0: [
    [0, 0, 1, 0],
    [1, 0, 1, 2],
    [1, 2, 0, 2],
    [0, 2, 0, 0],
  ],
  1: [
    [0.5, 0, 0.5, 2],
    [0.15, 1.6, 0.5, 2],
    [0.15, 0, 0.85, 0],
  ],
  2: [
    [0, 2, 1, 2],
    [1, 2, 1, 1],
    [1, 1, 0, 1],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ],
  3: [
    [0, 2, 1, 2],
    [1, 2, 1, 0],
    [1, 0, 0, 0],
    [0.2, 1, 1, 1],
  ],
  4: [
    [0, 2, 0, 1],
    [0, 1, 1, 1],
    [1, 2, 1, 0],
  ],
  5: [
    [1, 2, 0, 2],
    [0, 2, 0, 1],
    [0, 1, 1, 1],
    [1, 1, 1, 0],
    [1, 0, 0, 0],
  ],
  6: [
    [1, 2, 0, 2],
    [0, 2, 0, 0],
    [0, 0, 1, 0],
    [1, 0, 1, 1],
    [1, 1, 0, 1],
  ],
  7: [
    [0, 2, 1, 2],
    [1, 2, 0.35, 0],
  ],
  8: [
    [0, 0, 1, 0],
    [1, 0, 1, 2],
    [1, 2, 0, 2],
    [0, 2, 0, 0],
    [0, 1, 1, 1],
  ],
  9: [
    [1, 1, 0, 1],
    [0, 1, 0, 2],
    [0, 2, 1, 2],
    [1, 2, 1, 0],
    [1, 0, 0, 0],
  ],
};
function segDist(px, py, [x0, y0, x1, y1]) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const t = clamp(((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - x0 - dx * t, py - y0 - dy * t);
}
// Distance from (x, y) to the strokes of a number centred at the origin,
// in units where a digit is `h` tall.
function numberDist(text, x, y, h) {
  const s = h / 2;
  const gap = 0.45;
  const width = text.length + (text.length - 1) * gap;
  let best = Infinity;
  for (let i = 0; i < text.length; i++) {
    const ox = -width / 2 + i * (1 + gap);
    for (const seg of DIGITS[text[i]])
      best = Math.min(best, segDist(x / s - ox, y / s + 1, seg) * s);
  }
  return best;
}

const POOL = [
  "#f5f3ec",
  "#f4c20d",
  "#1d4fb4",
  "#d62828",
  "#5b2a86",
  "#f77f00",
  "#0b7a3b",
  "#7f1d1d",
  "#111111",
];

function numberChoices() {
  const out = [{ id: "cue", label: "Cue ball" }];
  for (let i = 1; i <= 15; i++) out.push({ id: `n${i}`, label: `${i}` });
  return out;
}

// A marbled swirl (bowling balls, bouncy balls).
function swirl(c, colors, f = 1.6) {
  const n = c.fbm(c.lp[0] * f, c.lp[1] * f, c.lp[2] * f, 4);
  const v = 0.5 + 0.5 * Math.sin((c.lp[1] * 2 + n * 5) * Math.PI);
  const w = 0.5 + 0.5 * Math.sin((c.lp[0] * 1.5 - n * 4) * Math.PI);
  const a = mix(colors[0], colors[1], smoothstep(0.2, 0.8, v));
  return colors[2] ? mix(a, colors[2], smoothstep(0.7, 0.95, w) * 0.8) : a;
}

// ---- Throws ------------------------------------------------------------------------
// A tap throws the ball the way the real one flies. e is seconds since the
// tap (-1 at rest); the ball goes up and comes back down into place.
const band01 = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const easeIO = (x) => x * x * (3 - 2 * x);
const sinceTap = (c, key, secs) => (c[key] > 0 ? (1 - c[key]) * secs : -1);
const throwPulse = (key, label, secs) => ({
  controls: [{ key, label, type: "pulse", ease: secs }],
  action: { key, label },
});
// The puck's size in its recipe (the fit maps it to one toy radius).
const PUCK_R = Math.hypot(1.035, 0.185);
// v turned by quaternion q.
const rotate = (q, v) => {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
};
// Height of a throw (in toy radii) that peaks at `peak` half way through.
const arc = (f, peak) => peak * 4 * f * (1 - f);

export const RECIPES = {
  basketball: {
    options: [{ key: "color", label: "Colour", type: "color", default: "#d9632b" }],
    build(k, o) {
      const w = 0.026;
      body(k, (c) => {
        const [x, y] = c.ln;
        const seam = Math.abs(x) < w || Math.abs(y) < w || Math.abs(Math.abs(x) - 0.71) < w * 1.05;
        // Clean black channels in small, crisp splats.
        if (seam) return keep("#16100d", 0.7);
        return grip(c, o.color, { f: 55, depth: 0.7, crevice: 0.22, sheen: 0.08 });
      });
    },
  },

  "soccer-ball": {
    options: [
      { key: "panels", label: "Panels", type: "color", default: "#151515" },
      { key: "base", label: "Base", type: "color", default: "#f4f4f2" },
    ],
    build(k, o) {
      const face = soccerFaces();
      body(k, (c) => {
        const f = face(c.ln);
        // Smooth, slightly glossy panels; the seams are clean grooves.
        if (f.edge < 0.011) return keep(lit("#6f6f6f", c.n), 0.6);
        return lit(f.pent ? o.panels : o.base, c.n, { sheen: 0.22, tight: 24 });
      });
    },
  },

  "american-football": {
    options: [{ key: "color", label: "Leather", type: "color", default: "#7a3b1a" }],
    // A spiral pass: it flies up nose first, spinning fast about its long
    // axis, the nose tipping over at the top, and lands with a wobble.
    ...throwPulse("pass", "Throw a spiral", 2.4),
    drive(t, c, out) {
      const e = sinceTap(c, "pass", 2.4);
      if (e < 0) return;
      const f = band01(e, 0.05, 1.65);
      const flying = f > 0 && f < 1;
      const spin = 2 * Math.PI * 5.5 * easeIO(f);
      const pitch = flying ? 0.6 * Math.cos(Math.PI * f) : 0;
      const land = Math.exp(-(e - 1.65) * 5) * Math.sin((e - 1.65) * 18) * band01(e, 1.65, 1.7);
      out.body = {
        offset: [0, arc(f, 0.65), 0],
        quat: quatMul(
          quatAxisAngle([0, 0, 1], pitch + 0.12 * land),
          quatAxisAngle([1, 0, 0], spin),
        ),
      };
    },
    build(k, o) {
      const L = 1.45;
      const prof = [];
      for (let i = 0; i <= 24; i++) {
        const y = -L + (2 * L * i) / 24;
        prof.push([0.86 * Math.pow(Math.max(0, 1 - (y / L) ** 2), 0.78), y]);
      }
      k.add(k.lathe(prof, { grid: 80 }), {
        rot: [0, 0, 90],
        flat: 0.18,
        interior: 0.12,
        jitter: 0.012,
        even: true,
        core: "#3b1d0c",
        color: (c) => {
          const a = c.u * TAU;
          const y = c.lp[1];
          // Four panels meet along four meridians.
          const seamA = Math.abs(Math.sin(2 * a));
          // The laces sit on the seam at a = 90 degrees (turned to the top).
          const d90 = Math.abs(a - Math.PI / 2);
          // Crisp white laces: a spine along the seam and eight cross bars.
          const lace = "#f5f2e8";
          if (Math.abs(y) < 0.55 && d90 < 0.045) return keep(lit(lace, c.n, { sheen: 0.2 }), 0.6);
          if (Math.abs(y) < 0.48 && d90 < 0.19) {
            const bar = Math.abs((((y + 0.48) / 0.12) % 1) - 0.5) > 0.3;
            if (bar) return keep(lit(lace, c.n, { sheen: 0.2 }), 0.6);
          }
          // Darker, stitched seams between the four panels.
          if (seamA < 0.022) return keep(lit(shade(o.color, 0.38), c.n), 0.7);
          // Pebbled pigskin with a soft sheen.
          return grip(c, o.color, { f: 70, depth: 0.65, crevice: 0.25, sheen: 0.1, tight: 14 });
        },
      });
    },
  },

  "tennis-ball": {
    options: [{ key: "color", label: "Felt", type: "color", default: "#cfe23b" }],
    build(k, o) {
      const seam = seamCurve(0.72);
      // Felt: soft, round splats with gentle mottling and no shine.
      const felt = (c) =>
        lit(shade(o.color, 0.97 + 0.06 * c.fbm(c.lp[0] * 7, c.lp[1] * 7, c.lp[2] * 7)), c.n, {
          soft: 0.26,
        });
      body(
        k,
        (c) => {
          const s = seam(c.ln);
          // The clean white rubber seam, slightly sunk into the felt.
          if (s.dist < 0.03) return keep(lit("#f4f6ea", c.n), 0.65);
          return felt(c);
        },
        { flat: 0.55, size: 1.15, jitter: 0.01, core: "#4a4a3a" },
      );
      // A fuzz of fine hairs standing off the felt, which also softens the
      // silhouette. None grow on the seam.
      k.cloud({ share: 0.2, size: 0.55, opacity: 0.5 }, (rand) => {
        const z = rand() * 2 - 1;
        const a = rand() * TAU;
        const r = Math.sqrt(1 - z * z);
        const d = [r * Math.cos(a), z, r * Math.sin(a)];
        if (seam(d).dist < 0.05) return null;
        const h = 1 + rand() * 0.035;
        // Hairs lean at random, mostly along the surface.
        const t = unit(cross(d, [rand() - 0.5, rand() - 0.5, rand() - 0.5]));
        const dir = unit([t[0] + d[0] * 0.6, t[1] + d[1] * 0.6, t[2] + d[2] * 0.6]);
        const tone = 0.9 + rand() * 0.2;
        return {
          p: [d[0] * h, d[1] * h, d[2] * h],
          dir,
          stretch: 2.6,
          color: lit(shade(o.color, tone * (0.96 + (h - 1) * 2)), d, { soft: 0.26 }),
        };
      });
    },
  },

  baseball: {
    build(k) {
      stitchedBall(k, "#f3eee2", "#c8102e");
    },
  },

  softball: {
    build(k) {
      stitchedBall(k, "#e6e44a", "#c8102e", { n: 88 });
    },
  },

  "beach-ball": {
    options: [
      { key: "c1", label: "Colour 1", type: "color", default: "#e63946" },
      { key: "c2", label: "Colour 2", type: "color", default: "#f4d35e" },
      { key: "c3", label: "Colour 3", type: "color", default: "#1d70b8" },
    ],
    build(k, o) {
      const gores = [o.c1, "#fafafa", o.c2, "#2a9d8f", o.c3, "#f77f00"];
      body(
        k,
        (c) => {
          const [x, y, z] = c.ln;
          if (Math.abs(y) > 0.94) return keep(Math.abs(y) > 0.975 ? "#fafafa" : shade(o.c1, 0.9));
          const a = (Math.atan2(x, z) / TAU + 1) % 1;
          const g = a * 6;
          const edge = Math.abs(g - Math.round(g));
          if (edge < 0.015) return keep("#d8d8d8", 0.8);
          return gores[Math.floor(g) % 6];
        },
        { core: "#f0e6d0", interior: 0.04 },
      );
    },
  },

  "golf-ball": {
    build(k) {
      const dimples = fibonacciSphere(336);
      const R = 0.088;
      const cosR = Math.cos(R);
      // Fibonacci neighbours within a dimple's radius sit within ~R*n/2
      // indices of the point's own latitude, so only those are checked.
      const n = dimples.length;
      const span = Math.ceil((R * n) / 2) + 6;
      const nearest = (d) => {
        const i0 = Math.round(((1 - d[1]) / 2) * n - 0.5);
        let best = -2;
        for (let i = Math.max(0, i0 - span); i <= Math.min(n - 1, i0 + span); i++) {
          const p = dimples[i];
          const v = d[0] * p[0] + d[1] * p[1] + d[2] * p[2];
          if (v > best) best = v;
        }
        return best;
      };
      const depth = (d) => {
        const v = nearest(d);
        if (v < cosR) return 0;
        const t = Math.acos(clamp(v, -1, 1)) / R;
        return 1 - t * t;
      };
      k.add(
        k.radial((d) => 1 - 0.035 * depth(d), { grid: 160 }),
        {
          flat: 0.2,
          interior: 0.1,
          core: "#c9c9c9",
          color: (c) => {
            const dd = depth(unit(c.lp));
            return shade("#f6f6f3", 1 - 0.2 * dd + 0.04 * c.n[1]);
          },
        },
      );
    },
  },

  "rugby-ball": {
    options: [{ key: "color", label: "Bands", type: "color", default: "#1d4e89" }],
    // A punt: it tumbles end over end up and down, then lands on a point and
    // takes an awkward, lopsided bounce before settling.
    ...throwPulse("kick", "Punt", 2.6),
    drive(t, c, out) {
      const e = sinceTap(c, "kick", 2.6);
      if (e < 0) return;
      const f = band01(e, 0.05, 1.45);
      const g = band01(e, 1.45, 2.05);
      const tumble = 2 * Math.PI * 2.25 * easeIO(f) + 0.75 * Math.PI * easeIO(g);
      const hop = arc(g, 0.18);
      const yaw = 0.6 * Math.sin(Math.PI * g);
      out.body = {
        offset: [0.06 * Math.sin(Math.PI * g), arc(f, 0.6) + hop, 0],
        quat: quatMul(quatAxisAngle([0, 1, 0], yaw), quatAxisAngle([0, 0, 1], tumble)),
      };
    },
    build(k, o) {
      const L = 1.3;
      const prof = [];
      for (let i = 0; i <= 24; i++) {
        const y = -L + (2 * L * i) / 24;
        prof.push([0.8 * Math.pow(Math.max(0, 1 - (y / L) ** 2), 0.6), y]);
      }
      k.add(k.lathe(prof, { grid: 80 }), {
        rot: [0, 0, 90],
        flat: 0.18,
        interior: 0.12,
        jitter: 0.012,
        even: true,
        core: "#8a8270",
        color: (c) => {
          const a = c.u * TAU;
          const y = c.lp[1];
          if (Math.abs(Math.sin(2 * a)) < 0.02) return keep(lit("#9e998b", c.n), 0.7);
          const band = Math.abs(Math.abs(y) - 0.78) < 0.12;
          // A pebbled grip in fine, even bumps.
          return grip(c, band ? o.color : "#f2efe6", { f: 60, depth: 0.55, crevice: 0.14 });
        },
      });
    },
  },

  volleyball: {
    options: [
      { key: "c1", label: "Colour 1", type: "color", default: "#f7c948" },
      { key: "c2", label: "Colour 2", type: "color", default: "#1f4e9c" },
    ],
    build(k, o) {
      body(k, (c) => {
        const s = strips(c.ln);
        // Smooth leather panels; clean, fine seams.
        if (s.seam < 0.016) return keep(lit("#7d838d", c.n), 0.6);
        const cols = [o.c1, "#fbfbf8", o.c2];
        return lit(cols[(s.strip + s.face) % 3], c.n, { sheen: 0.14, tight: 18 });
      });
    },
  },

  "water-polo-ball": {
    build(k) {
      body(k, (c) => {
        const s = strips(c.ln);
        if (s.seam < 0.02) return keep("#23304f", 0.8);
        const grip = c.noise(c.lp[0] * 90, c.lp[1] * 90, c.lp[2] * 90);
        return shade((s.strip + s.face) % 2 ? "#1c4fa1" : "#f2cf1d", 0.92 + 0.12 * grip);
      });
    },
  },

  "ping-pong-ball": {
    options: [
      {
        key: "color",
        label: "Colour",
        type: "select",
        default: "white",
        choices: [
          { id: "white", label: "White" },
          { id: "orange", label: "Orange" },
        ],
      },
    ],
    build(k, o) {
      const col = o.color === "orange" ? "#f7892b" : "#f7f7f4";
      body(k, (c) => (Math.abs(c.ln[1]) < 0.01 ? keep(shade(col, 0.9)) : col), {
        core: "#e8e8e8",
        interior: 0.03,
      });
    },
  },

  "cricket-ball": {
    build(k) {
      const leather = "#8f1d1d";
      body(k, (c) => {
        const [x, y] = c.ln;
        const a = Math.atan2(c.ln[0], c.ln[2]);
        if (Math.abs(y) < 0.075) {
          // The raised seam: six rows of stitching, lit as a ridge.
          const row = Math.floor(((y + 0.075) / 0.15) * 6);
          const ridge = unit([c.n[0], c.n[1] + (y / 0.075) * 0.5, c.n[2]]);
          if (row === 2 || row === 3) return keep(lit(shade(leather, 0.62), ridge), 0.7);
          const dash = ((a / TAU) * 180 + row * 0.5) % 1 < 0.6;
          return keep(lit(dash ? "#f2ead4" : shade(leather, 0.8), ridge, { sheen: 0.3 }), 0.6);
        }
        if (Math.abs(x) < 0.008) return keep(lit(shade(leather, 0.7), c.n));
        // Polished red leather: deep colour and a bright, tight shine.
        return lit(leather, c.n, { sheen: 0.6, tight: 40, soft: 0.3 });
      });
    },
  },

  "bowling-ball": {
    options: [
      { key: "c1", label: "Colour 1", type: "color", default: "#3a1f78" },
      { key: "c2", label: "Colour 2", type: "color", default: "#d946ef" },
    ],
    build(k, o) {
      const holes = [
        { d: unit([-0.2, 0.95, 0.22]), r: 0.1 },
        { d: unit([0.2, 0.95, 0.22]), r: 0.1 },
        { d: unit([0, 0.8, -0.6]), r: 0.12 },
      ];
      body(
        k,
        (c) => {
          for (const h of holes) if (Math.acos(clamp(dot(c.ln, h.d), -1, 1)) < h.r) return null;
          return swirl(c, [o.c1, o.c2, "#f5f0ff"]);
        },
        { core: "#1e1633", interior: 0.08 },
      );
      for (const h of holes) {
        const depth = 0.4;
        const q = quatFromTo([0, 1, 0], h.d);
        const mid = h.d.map((v) => v * (1 - depth / 2));
        k.add(k.cylinder(Math.sin(h.r), depth, { caps: "bottom" }), {
          quat: q,
          pos: mid,
          flat: 0.3,
          weight: 1.4,
          color: "#141018",
          pattern: false,
        });
      }
    },
  },

  "pool-ball": {
    options: [
      { key: "number", label: "Number", type: "select", default: "n8", choices: numberChoices() },
    ],
    build(k, o) {
      const n = o.number === "cue" ? 0 : Number(String(o.number).slice(1)) || 8;
      const col = POOL[n > 8 ? n - 8 : n];
      const stripe = n > 8;
      const text = String(n);
      // Polished phenolic resin: fully opaque, lit, with a sharp window
      // highlight and a soft reflection of the room along the top, so even the
      // black 8 reads as a solid shiny ball on a dark page.
      const gloss = (base, c) => {
        const n0 = c.n;
        let out = lit(base, n0, { sheen: 0.95, tight: 90, soft: 0.3 });
        // The room: a pale band above the horizon, darker below.
        const up = n0[1];
        out = mix(out, "#9aa6b4", 0.16 * smoothstep(0.1, 0.8, up) * (1 - 0.6 * Math.abs(n0[2])));
        // A broad soft highlight beside the sharp one.
        out = mix(out, "#ffffff", 0.18 * Math.max(0, dot(n0, HALF)) ** 8);
        // A thin rim of reflected light at the silhouette (seen from home).
        const facing = Math.max(0, dot(n0, VIEW));
        return mix(out, "#8d97a3", 0.22 * (1 - facing) ** 3);
      };
      body(
        k,
        (c) => {
          const [x, y, z] = c.ln;
          if (n > 0 && Math.abs(z) > 0.93) {
            // The number circle on the front and back.
            const px = z > 0 ? x : -x;
            const d = numberDist(text, px, y, 0.2);
            return keep(gloss(d < 0.024 ? "#141414" : "#f7f5ee", c), d < 0.024 ? 0.7 : 1);
          }
          if (n > 0 && Math.abs(z) > 0.9) return keep(gloss(n === 8 ? "#f7f5ee" : col, c));
          if (stripe) return gloss(Math.abs(y) < 0.46 ? col : "#f7f5ee", c);
          return gloss(col, c);
        },
        { core: n === 8 ? "#111111" : col, interior: 0.2, opacity: 1, flat: 0.25, weight: 1.4 },
      );
    },
  },

  pickleball: {
    options: [{ key: "color", label: "Colour", type: "color", default: "#dce83a" }],
    build(k, o) {
      const holes = fibonacciSphere(40);
      const R = 0.12;
      const inHole = (d) => holes.some((h) => dot(d, h) > Math.cos(R));
      body(
        k,
        (c) =>
          inHole(c.ln) ? null : Math.abs(c.ln[1]) < 0.01 ? keep(shade(o.color, 0.85)) : o.color,
        {
          interior: 0,
        },
      );
      // The hollow inside, seen through the holes.
      k.add(k.sphere(0.9), { flat: 0.3, weight: 0.5, color: shade(o.color, 0.45), pattern: false });
    },
  },

  dodgeball: {
    options: [{ key: "color", label: "Colour", type: "color", default: "#d7263d" }],
    build(k, o) {
      body(k, (c) => pebble(c, o.color, 0.14, 55), { flat: 0.3, core: shade(o.color, 0.5) });
    },
  },

  "medicine-ball": {
    build(k) {
      const w = 0.035;
      body(k, (c) => {
        const [x, y] = c.ln;
        if (Math.abs(x) < w || Math.abs(y) < w || Math.abs(Math.abs(x) - 0.71) < w)
          return keep(lit("#8a8a8a", c.n), 0.7);
        // Matte rubber grip: low, even bumps and no shine.
        return grip(c, "#34343a", { f: 45, depth: 0.5, crevice: 0.2 });
      });
      rim(k, k.sphere(1.035));
    },
  },

  "lacrosse-ball": {
    options: [{ key: "color", label: "Colour", type: "color", default: "#f4f3ef" }],
    build(k, o) {
      body(k, (c) => pebble(c, o.color, 0.05, 20), { core: shade(o.color, 0.8) });
    },
  },

  "squash-ball": {
    build(k) {
      const dots = [unit([0.35, 0.3, 0.88]), unit([-0.35, 0.3, 0.88])];
      body(
        k,
        (c) => {
          for (const d of dots) if (dot(c.ln, d) > Math.cos(0.09)) return keep("#f5d312");
          // Matte black rubber, with a little sheen so the shape reads.
          return grip(c, "#1c1c1e", { f: 50, depth: 0.4, crevice: 0.15, sheen: 0.12, tight: 10 });
        },
        { core: "#202020" },
      );
      rim(k, k.sphere(1.035));
    },
  },

  "bouncy-ball": {
    options: [
      { key: "c1", label: "Colour 1", type: "color", default: "#ff2e88" },
      { key: "c2", label: "Colour 2", type: "color", default: "#27e1c1" },
      { key: "c3", label: "Colour 3", type: "color", default: "#ffe14d" },
    ],
    build(k, o) {
      body(k, (c) => swirl(c, [o.c1, o.c2, o.c3], 2.4), { core: o.c2, interior: 0.2 });
    },
  },

  marble: {
    options: [{ key: "color", label: "Swirl", type: "color", default: "#1e88e5" }],
    build(k, o) {
      // Clear glass that glints, with twisted vanes of colour inside.
      k.add(k.sphere(1), {
        flat: 0.15,
        opacity: 0.16,
        kind: "glint",
        params: [0.9, 0],
        pattern: false,
        color: (c) => mix("#e8f4ff", "#ffffff", Math.max(0, c.n[1])),
      });
      for (let v = 0; v < 3; v++) {
        const base = (v / 3) * TAU;
        const vane = k.param(
          (u, w) => {
            const y = (w - 0.5) * 1.7;
            const r = (u - 0.5) * 1.6 * Math.sqrt(Math.max(0, 1 - (y / 0.95) ** 2));
            const a = base + y * 2.4;
            return [r * Math.cos(a), y, r * Math.sin(a)];
          },
          { grid: 48 },
        );
        k.add(vane, {
          weight: 1.6,
          flat: 0.3,
          color: (c) => mix(o.color, v === 1 ? "#ffffff" : shade(o.color, 0.6), 0.25 + 0.25 * c.u),
        });
      }
    },
  },

  "hockey-puck": {
    // A slap shot: ice chips spray from the stick, and the puck glides flat
    // across the ice, spinning fast, runs round a wide loop as it slows and
    // slides back to its spot.
    ...throwPulse("shoot", "Slap shot", 3),
    drive(t, c, out) {
      const e = sinceTap(c, "shoot", 3);
      out.parts.spray = { visible: 0 };
      if (e < 0) return;
      // Friction: fast at first, easing to a stop.
      const f = 1 - (1 - band01(e, 0.04, 2.8)) ** 2;
      const loop = 2 * Math.PI * f;
      const spin = 2 * Math.PI * 6 * f;
      // The slap tips it on edge for a moment, then it lies flat.
      const tip = 0.22 * Math.sin(Math.PI * band01(e, 0, 0.18)) * (1 - band01(e, 0.12, 0.3));
      const off = [0.75 * Math.sin(loop), 0.04 * Math.sin(Math.PI * band01(e, 0, 0.2)), -0.45 * (1 - Math.cos(loop))]; // prettier-ignore
      const q = quatMul(quatAxisAngle([0, 0, 1], tip), quatAxisAngle([0, 1, 0], -spin));
      out.body = { offset: off, quat: q };
      // The ice spray stays where the stick hit: undo the puck's motion.
      const inv = [-q[0], -q[1], -q[2], q[3]];
      // (Body offsets are in toy radii; part offsets in recipe units.)
      const back = rotate(
        inv,
        off.map((v) => -v * PUCK_R),
      );
      const burst = band01(e, 0, 0.45);
      out.parts.spray = {
        quat: inv,
        offset: back,
        scale: 0.35 + 1.1 * Math.sqrt(burst),
        visible: 1 - band01(e, 0.25, 0.75),
      };
    },
    build(k) {
      // The spray of ice chips (hidden until the shot).
      const spray = k.part("spray", { pivot: [0, 0, 0] });
      k.cloud({ count: 900, part: spray, pattern: false }, (rand) => {
        const a = Math.PI + (rand() - 0.5) * 1.6;
        const r = 1.05 + rand() * 0.55;
        return {
          p: [Math.cos(a) * r, -0.15 + rand() * 0.35 * rand(), Math.sin(a) * r * 0.8],
          color: mix("#dff3ff", "#ffffff", rand()),
          size: 0.35 + 0.4 * rand(),
          opacity: 0.95,
          kind: "twinkle",
          params: [0.7, rand()],
        };
      });
      k.add(k.cylinder(1, 0.34), {
        flat: 0.2,
        jitter: 0.012,
        even: true,
        interior: 0.1,
        core: "#0c0c0c",
        color: (c) => {
          if (c.s.side) {
            const a = Math.atan2(c.lp[0], c.lp[2]);
            const knurl = ((a / TAU) * 120 + 10) % 1 < 0.5 && Math.abs(c.lp[1]) < 0.12;
            return keep(lit(knurl ? "#303032" : "#18181a", c.n, { sheen: 0.12, tight: 8 }));
          }
          const r = c.s.radial ?? 0;
          return Math.abs(r - 0.72) < 0.015
            ? keep(lit("#343436", c.n))
            : lit(shade("#1b1b1d", 0.95 + 0.1 * c.noise(c.lp[0] * 30, 0, c.lp[2] * 30)), c.n, {
                sheen: 0.12,
                tight: 10,
              });
        },
      });
      rim(k, k.cylinder(1.035, 0.37));
    },
  },

  shuttlecock: {
    // Hit up: it flips over cork first and flies up spinning, turns over at
    // the top and floats back down cork first, spinning slower as it falls.
    ...throwPulse("hit", "Hit it", 3),
    drive(t, c, out) {
      const e = sinceTap(c, "hit", 3);
      if (e < 0) return;
      const up = band01(e, 0.05, 0.6);
      const down = band01(e, 0.95, 2.7);
      const h = e < 0.6 ? 0.7 * (1 - (1 - up) ** 2) : e < 0.95 ? 0.7 : 0.7 * (1 - easeIO(down));
      const flip = Math.PI * (easeIO(band01(e, 0.05, 0.3)) - easeIO(band01(e, 0.65, 1.05)));
      const spin = 2 * Math.PI * (3 * easeIO(band01(e, 0.05, 1.0)) + 2.2 * down);
      out.body = {
        offset: [0.05 * Math.sin(e * 3), h, 0],
        quat: quatMul(quatAxisAngle([1, 0, 0], flip), quatAxisAngle([0, 1, 0], spin)),
      };
    },
    build(k) {
      // The cork: a rounded base under a short band.
      k.add(k.sphere(0.3), {
        pos: [0, -0.62, 0],
        scale: [1, 0.85, 1],
        flat: 0.25,
        interior: 0.1,
        color: (c) => (c.lp[1] > 0 ? null : pebble(c, "#e9dcc2", 0.1, 30)),
      });
      k.add(k.cylinder(0.3, 0.14, { caps: "top" }), {
        pos: [0, -0.55, 0],
        flat: 0.25,
        color: (c) => (c.s.cap ? "#f1ece3" : keep("#233a8f")),
      });
      // The skirt of sixteen feathers, scalloped at the top.
      const H = 1.25;
      k.add(k.cone(0.27, 0.66, H, { caps: false }), {
        pos: [0, -0.48 + H / 2, 0],
        flat: 0.25,
        color: (c) => {
          const a = Math.atan2(c.lp[0], c.lp[2]);
          const f = ((a / TAU) * 16 + 16) % 1;
          const t = (c.lp[1] + H / 2) / H;
          const scallop = 1 - 0.1 * Math.pow(Math.abs(f - 0.5) * 2, 2);
          if (t > scallop) return null;
          if (f < 0.05 || f > 0.95) return keep("#d9d6cf", 0.8);
          if (Math.abs(t - 0.28) < 0.02 || Math.abs(t - 0.5) < 0.02) return keep("#1b1b1b", 0.8);
          return "#fbfbf8";
        },
      });
    },
  },

  "flying-disc": {
    options: [{ key: "color", label: "Colour", type: "color", default: "#ff5a36" }],
    // A throw: it spins fast and flat, banks into a curve, glides round a
    // loop like a returning throw and settles back, still spinning down.
    ...throwPulse("throw", "Throw", 3),
    drive(t, c, out) {
      const e = sinceTap(c, "throw", 3);
      if (e < 0) return;
      const f = band01(e, 0.05, 2.4);
      const loop = 2 * Math.PI * easeIO(f);
      const spin = 2 * Math.PI * 7 * (1 - (1 - band01(e, 0, 2.9)) ** 2);
      const bank = 0.35 * Math.sin(Math.PI * f);
      out.body = {
        offset: [0.42 * Math.sin(loop), arc(f, 0.35), 0.28 * (1 - Math.cos(loop)) * -0.5],
        quat: quatMul(
          quatAxisAngle([Math.cos(loop), 0, -Math.sin(loop)], -bank),
          quatAxisAngle([0, 1, 0], -spin),
        ),
      };
    },
    build(k, o) {
      const prof = [
        [0.0, 0.02],
        [0.7, 0.0],
        [0.88, -0.06],
        [0.9, -0.13],
        [0.97, -0.12],
        [1.0, -0.05],
        [0.96, 0.02],
        [0.85, 0.06],
        [0.5, 0.09],
        [0.0, 0.1],
      ];
      k.add(k.lathe(prof, { grid: 96 }), {
        flat: 0.2,
        jitter: 0.01,
        even: true,
        color: (c) => {
          const r = Math.hypot(c.lp[0], c.lp[2]);
          const top = c.lp[1] > 0.06;
          // Moulded flight rings: two low ridges, lit on one side and shaded
          // on the other, and a groove.
          if (top && Math.abs(r - 0.55) < 0.02) return keep(lit(shade(o.color, 0.72), c.n), 0.7);
          let n = c.n;
          if (top) {
            for (const rr of [0.62, 0.68]) {
              const d = (r - rr) / 0.018;
              if (Math.abs(d) < 1) {
                const out = [c.lp[0] / (r || 1), 0, c.lp[2] / (r || 1)];
                const tilt = -d * 1.2;
                n = unit([n[0] + out[0] * tilt, n[1], n[2] + out[2] * tilt]);
              }
            }
          }
          // Glossy plastic: a clear highlight and a faint milky lift on top.
          const base = mix(o.color, "#ffffff", 0.06 * Math.max(0, c.n[1]));
          const out = lit(base, n, { sheen: 0.55, tight: 28, soft: 0.28 });
          return mix(out, "#ffffff", 0.22 * Math.max(0, dot(n, HALF)) ** 4);
        },
      });
    },
  },
};
