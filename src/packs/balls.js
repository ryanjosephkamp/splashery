// Sports balls. Generic designs only: classic panels, seams and stitching,
// no logos or league marks. Seams and stitches are kept out of the pattern
// layer, so a ball in the colours of a flag keeps its seams. Tap a ball to
// make it hop; Move > Bounce keeps it bouncing.

import { mix, shade, smoothstep, fibonacciSphere, quatFromTo, clamp } from "../kit.js";

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

// A plain ball body with a darker core for Slice.
function body(k, color, opts = {}) {
  return k.add(k.sphere(1), {
    flat: 0.18,
    interior: 0.12,
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
    if (s.dist < 0.012) return keep(shade(leather, 0.8));
    if (s.dist < 0.07) {
      // Two rows of angled stitches, one each side of the seam.
      const across = (s.dist - 0.012) / 0.058;
      const f = (s.t * n + across * 0.55 * s.side + 10) % 1;
      if (across > 0.12 && across < 0.95 && f < 0.42) return keep(stitch, 0.8);
      return keep(pebble(c, shade(leather, 0.94), 0.05));
    }
    return pebble(c, leather, 0.05, 30);
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

export const RECIPES = {
  basketball: {
    options: [{ key: "color", label: "Colour", type: "color", default: "#d9632b" }],
    build(k, o) {
      const w = 0.026;
      body(k, (c) => {
        const [x, y] = c.ln;
        const seam = Math.abs(x) < w || Math.abs(y) < w || Math.abs(Math.abs(x) - 0.71) < w * 1.05;
        if (seam) return keep("#1d1511");
        const dots = c.noise(c.lp[0] * 70, c.lp[1] * 70, c.lp[2] * 70);
        return shade(o.color, 0.93 + 0.1 * dots);
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
        if (f.edge < 0.012) return keep("#8c8c8c", 0.8);
        return pebble(c, f.pent ? o.panels : o.base, 0.04, 30);
      });
    },
  },

  "american-football": {
    options: [{ key: "color", label: "Leather", type: "color", default: "#7a3b1a" }],
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
        core: "#3b1d0c",
        color: (c) => {
          const a = c.u * TAU;
          const y = c.lp[1];
          // Four panels meet along four meridians.
          const seamA = Math.abs(Math.sin(2 * a));
          // The laces sit on the seam at a = 90 degrees (turned to the top).
          const d90 = Math.abs(a - Math.PI / 2);
          if (Math.abs(y) < 0.55 && d90 < 0.05) return keep("#f3f0e6");
          if (Math.abs(y) < 0.48 && d90 < 0.2) {
            const bar = Math.abs((((y + 0.48) / 0.12) % 1) - 0.5) > 0.3;
            if (bar) return keep("#f3f0e6", 0.9);
          }
          if (seamA < 0.02) return keep(shade(o.color, 0.45));
          return pebble(c, o.color, 0.12, 45);
        },
      });
    },
  },

  "tennis-ball": {
    options: [{ key: "color", label: "Felt", type: "color", default: "#cfe23b" }],
    build(k, o) {
      const seam = seamCurve(0.72);
      body(
        k,
        (c) => {
          const s = seam(c.ln);
          if (s.dist < 0.035) return keep("#f1f4e4");
          return pebble(c, o.color, 0.16, 60);
        },
        { flat: 0.5, jitter: 0.08, core: "#4a4a3a" },
      );
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
        core: "#8a8270",
        color: (c) => {
          const a = c.u * TAU;
          const y = c.lp[1];
          if (Math.abs(Math.sin(2 * a)) < 0.02) return keep("#b9b4a6");
          const band = Math.abs(Math.abs(y) - 0.78) < 0.12;
          return pebble(c, band ? o.color : "#f2efe6", 0.1, 50);
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
        if (s.seam < 0.018) return keep("#9aa0aa", 0.8);
        const cols = [o.c1, "#fbfbf8", o.c2];
        return pebble(c, cols[(s.strip + s.face) % 3], 0.05, 40);
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
          // The raised seam: six rows of stitching.
          const row = Math.floor(((y + 0.075) / 0.15) * 6);
          if (row === 2 || row === 3) return keep(shade(leather, 0.7));
          const dash = ((a / TAU) * 180 + row * 0.5) % 1 < 0.6;
          return keep(dash ? "#efe6cf" : shade(leather, 0.8), 0.8);
        }
        if (Math.abs(x) < 0.008) return keep(shade(leather, 0.75));
        return shade(pebble(c, leather, 0.06, 30), 0.95 + 0.1 * Math.max(0, c.n[1]));
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
      body(
        k,
        (c) => {
          const [x, y, z] = c.ln;
          if (n > 0 && Math.abs(z) > 0.93) {
            // The number circle on the front and back.
            const px = z > 0 ? x : -x;
            const d = numberDist(text, px, y, 0.2);
            return keep(d < 0.024 ? "#141414" : "#f7f5ee");
          }
          if (n > 0 && Math.abs(z) > 0.9) return keep(n === 8 ? "#f7f5ee" : col);
          if (stripe) return Math.abs(y) < 0.46 ? col : "#f7f5ee";
          return col;
        },
        { core: "#eeeeee", interior: 0.05 },
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
          return keep("#8a8a8a");
        return pebble(c, "#2b2b2d", 0.25, 25);
      });
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
          return pebble(c, "#151515", 0.2, 40);
        },
        { core: "#202020" },
      );
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
    build(k) {
      k.add(k.cylinder(1, 0.34), {
        flat: 0.2,
        interior: 0.1,
        core: "#0c0c0c",
        color: (c) => {
          if (c.s.side) {
            const a = Math.atan2(c.lp[0], c.lp[2]);
            const knurl = ((a / TAU) * 120 + 10) % 1 < 0.5 && Math.abs(c.lp[1]) < 0.12;
            return keep(knurl ? "#262626" : "#141414");
          }
          const r = c.s.radial ?? 0;
          return Math.abs(r - 0.72) < 0.015
            ? keep("#2b2b2b")
            : shade("#161616", 0.95 + 0.1 * c.noise(c.lp[0] * 30, 0, c.lp[2] * 30));
        },
      });
    },
  },

  shuttlecock: {
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
        color: (c) => {
          const r = Math.hypot(c.lp[0], c.lp[2]);
          if (c.lp[1] > 0.06 && Math.abs(r - 0.55) < 0.02) return keep(shade(o.color, 0.7));
          return mix(o.color, "#ffffff", 0.12 * Math.max(0, c.n[1]));
        },
      });
    },
  },
};
