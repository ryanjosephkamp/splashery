// Things that open: toys with hinged parts you tap to open and close.
// Loaded on demand.

import {
  mix,
  shade,
  smoothstep,
  clamp,
  quatAxisAngle,
  quatMul,
  quatFromTo,
  quatRotate,
} from "../kit.js";
import { inked } from "../font.js";

const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

const TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const keep = (c, size) => ({ c, keep: true, size });
const ease3 = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutBack = (x) => {
  const k = 1.70158;
  return 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2);
};
const bump = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
const window01 = (x, a, b) => clamp((x - a) / (b - a), 0, 1);

// Baked light from above, front and right, with a sheen towards the viewer.
const LIGHT = unit([0.4, 0.85, 0.55]);
const VIEW = unit([0.5, 0.35, 0.8]);
const HALF = unit(add(LIGHT, VIEW));
function lit(col, n, { amb = 0.62, dif = 0.45, spec = 0.25, pow = 28 } = {}) {
  const d = Math.max(0, dot(n, LIGHT));
  let c = shade(col, amb + dif * d);
  if (spec > 0) c = mix(c, [1, 1, 1], spec * Math.pow(Math.max(0, dot(n, HALF)), pow));
  return c;
}
// Polished metal: the room reflected (bright above, dark horizon, warm floor).
function chrome(n, tint = null) {
  const r = sub(mul(n, 2 * dot(n, VIEW)), VIEW);
  const y = r[1];
  let c =
    y > 0
      ? mix("#9aa3ad", "#f7f9fc", Math.pow(y, 0.5))
      : mix("#6d5a48", "#2e2723", Math.pow(-y, 0.6));
  c = mix(c, "#262a31", 0.7 * smoothstep(0.22, 0, Math.abs(y + 0.04)));
  if (tint) c = mix(c, shade(tint, 0.6 + 0.6 * c[1]), 0.65);
  return mix(c, [1, 1, 1], Math.pow(Math.max(0, dot(n, HALF)), 60));
}

function hsv(h, s, v) {
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

// Per-toy memory for drive(), keyed by the control state (new per load).
const MEM = new WeakMap();
function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}
function integrate(m, key, t, rate) {
  const last = m["t_" + key];
  m["t_" + key] = t;
  const dt = last === undefined ? 0 : clamp(t - last, 0, 0.25);
  m[key] = (m[key] ?? 0) + dt * rate;
  return m[key];
}

// A box with rounded edges, sampled evenly. Flat faces carry `face` (0..5
// for +X, -X, +Y, -Y, +Z, -Z) and face u, v; rounded parts carry face -1.
// `top: false` / `bottom: false` leave out those flat faces (open boxes,
// things on the floor).
function roundBox(sx, sy, sz, r, { top = true, bottom = true } = {}) {
  const h = [sx / 2 - r, sy / 2 - r, sz / 2 - r];
  const L = [h[0] * 2, h[1] * 2, h[2] * 2];
  const parts = [];
  const faceN = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  faceN.forEach((n, f) => {
    if ((!bottom && f === 3) || (!top && f === 2)) return;
    const ax = f >> 1;
    parts.push({ area: L[(ax + 1) % 3] * L[(ax + 2) % 3], kind: 0, f, n, ax });
  });
  for (let ax = 0; ax < 3; ax++)
    for (const s1 of [-1, 1])
      for (const s2 of [-1, 1])
        parts.push({ area: (Math.PI / 2) * r * L[ax], kind: 1, ax, s1, s2 });
  for (const a of [-1, 1])
    for (const b of [-1, 1])
      for (const c of [-1, 1]) parts.push({ area: (Math.PI / 2) * r * r, kind: 2, sg: [a, b, c] });
  let total = 0;
  for (const q of parts) q.cum = total += q.area;
  return {
    area: total,
    thick: Math.min(sx, sy, sz) / 2,
    sample(rand) {
      const x = rand() * total;
      let q = parts[parts.length - 1];
      for (const it of parts)
        if (x < it.cum) {
          q = it;
          break;
        }
      const p = [0, 0, 0];
      if (q.kind === 0) {
        const a1 = (q.ax + 1) % 3;
        const a2 = (q.ax + 2) % 3;
        const u = rand();
        const v = rand();
        p[q.ax] = q.n[q.ax] * (h[q.ax] + r);
        p[a1] = (u - 0.5) * L[a1];
        p[a2] = (v - 0.5) * L[a2];
        return { p, n: q.n, u, v, face: q.f };
      }
      if (q.kind === 1) {
        const a1 = (q.ax + 1) % 3;
        const a2 = (q.ax + 2) % 3;
        const a = rand() * (Math.PI / 2);
        const n = [0, 0, 0];
        n[a1] = q.s1 * Math.cos(a);
        n[a2] = q.s2 * Math.sin(a);
        p[q.ax] = (rand() - 0.5) * L[q.ax];
        p[a1] = q.s1 * h[a1] + n[a1] * r;
        p[a2] = q.s2 * h[a2] + n[a2] * r;
        return { p, n, u: 0, v: 0, face: -1 };
      }
      let d;
      let dl;
      do {
        d = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
        dl = Math.hypot(d[0], d[1], d[2]);
      } while (dl < 1e-3 || dl > 1);
      const n = [0, 1, 2].map((i) => (Math.abs(d[i]) / dl) * q.sg[i]);
      for (let i = 0; i < 3; i++) p[i] = q.sg[i] * h[i] + n[i] * r;
      return { p, n, u: 0, v: 0, face: -1 };
    },
  };
}

// A flat rectangle in the XZ plane facing up (+1) or down (-1); samples
// carry face 2 or 3 like a box's top or bottom, and u, v across it.
function quad(sx, sz, up = 1) {
  const n = [0, up, 0];
  return {
    area: sx * sz,
    thick: 0.01,
    dims: 2,
    sample(rand) {
      const u = rand();
      const v = rand();
      return { p: [(u - 0.5) * sx, 0, (v - 0.5) * sz], n, u, v, face: up > 0 ? 2 : 3 };
    },
  };
}

// A flat triangle, sampled evenly.
function triShape(a, b, c) {
  const cr = cross(sub(b, a), sub(c, a));
  const n = unit(cr);
  return {
    area: 0.5 * len(cr),
    thick: 0.02,
    sample(rand) {
      const r1 = Math.sqrt(rand());
      const r2 = rand();
      const wa = 1 - r1;
      const wb = r1 * (1 - r2);
      const wc = r1 * r2;
      return {
        p: [
          a[0] * wa + b[0] * wb + c[0] * wc,
          a[1] * wa + b[1] * wb + c[1] * wc,
          a[2] * wa + b[2] * wb + c[2] * wc,
        ],
        n,
        u: wb,
        v: wc,
      };
    },
  };
}

// A blocky stroke font for numbers: segments in a 1 x 2 box.
const GLYPHS = {
  0: [
    [0, 0, 1, 0],
    [1, 0, 1, 2],
    [1, 2, 0, 2],
    [0, 2, 0, 0],
  ],
  1: [[0.5, 0, 0.5, 2]],
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
    [0.25, 1, 1, 1],
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
    [1, 2, 0.4, 0],
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
function segDist(x, y, s) {
  const dx = s[2] - s[0];
  const dy = s[3] - s[1];
  const t = clamp(((x - s[0]) * dx + (y - s[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x - s[0] - dx * t, y - s[1] - dy * t);
}
// Distance from (x, y) to a number drawn centred at the origin, 2 units tall.
function textDist(str, x, y) {
  const adv = 1.5;
  const w = (str.length - 1) * adv + 1;
  let best = Infinity;
  for (let i = 0; i < str.length; i++) {
    const gx = x + w / 2 - i * adv;
    const gy = y + 1;
    if (gx < -0.6 || gx > 1.6) continue;
    for (const s of GLYPHS[str[i]] || []) best = Math.min(best, segDist(gx, gy, s));
  }
  return best;
}

// A five-pointed star outline (for the gift's surprise).
function starPoints(R, r, n = 5) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU;
    const rr = i % 2 ? r : R;
    pts.push([Math.sin(a) * rr, Math.cos(a) * rr]);
  }
  return pts;
}

// ---- Book, music box, clock and friends: shared layouts ------------------------------

const BOOK = { W: 1, H: 1.36, ct: 0.045, leaves: 10, lt: 0.013 };

const STORY =
  "ONCE UPON A TIME, IN A TOY BOX AT THE END OF A LONG HALL, THERE LIVED A SMALL " +
  "SPLAT CALLED PIP. PIP WAS NOT A BALL AND NOT A BLOCK. PIP WAS A SOFT LITTLE " +
  "CLOUD OF COLOUR THAT COULD BE ANYTHING AT ALL. ON MONDAY PIP WAS A RED APPLE. " +
  "ON TUESDAY PIP WAS A BLUE WHALE. ON WEDNESDAY PIP TRIED TO BE THE MOON, AND " +
  "EVERY TOY IN THE BOX CAME TO LOOK. WHAT WILL YOU BE TOMORROW? ASKED THE OLD " +
  "TEDDY BEAR. PIP THOUGHT FOR A WHILE. I THINK, SAID PIP, I WILL BE A STORY. " +
  "AND SO PIP BECAME THIS BOOK, AND NOW YOU ARE READING IT. THE END. ";
// Word-wraps the story into lines of at most n characters, starting a few
// words in so that each page reads differently.
function storyLines(n, start, count) {
  const words = STORY.trim().split(/\s+/);
  const lines = [];
  let line = "";
  for (let i = 0; lines.length < count; i++) {
    const w = words[(start + i) % words.length];
    if (line && line.length + 1 + w.length > n) {
      lines.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  return lines;
}
BOOK.pb = 0.27;
BOOK.T = BOOK.pb + 2 * BOOK.ct;

const LAPTOP = { W: 1.5, D: 1.0, hb: 0.06, hl: 0.035, open: 1.85 };

const FAN = { yawAt: [0, 0.62, -0.12], hub: [0, 0.62, 0.2] };

const TELE = { dir: unit([0.72, 0.5, -0.3]), mount: [0, 0.2, 0] };

const NOTE_PATHS = [0, 1, 2].map((i) => ({ x: -0.25 + i * 0.25, z: 0.1 - i * 0.08, phase: i / 3 }));

export const RECIPES = {
  chest: {
    alive: true,
    options: [{ key: "wood", label: "Wood", type: "color", default: "#8a5a2b" }],
    controls: [{ key: "open", label: "Open", type: "toggle", default: 0, ease: 1.1 }],
    action: { key: "open", label: "Open or close" },
    drive(t, c, out) {
      const o = easeInOut(c.open);
      out.parts.lid = { angle: -1.95 * o };
      out.amount = o;
    },
    build(k, o) {
      const W = 1.2;
      const H = 0.6;
      const D = 0.74;
      const top = H / 2 - 0.2;
      const wood = o.wood;
      const gold = "#d4a63c";
      const planks = (c) => {
        const band = Math.abs((((c.p[1] + 1) * 7.5) % 1) - 0.5) > 0.46;
        const grain = c.fbm(c.p[0] * 3, c.p[1] * 30, c.p[2] * 3);
        return shade(mix(wood, shade(wood, 0.6), 0.5 + 0.5 * grain), band ? 0.55 : 1);
      };
      // The body: an open-topped box (the top face is left out).
      k.add(k.box(W, H, D), {
        pos: [0, -0.2, 0],
        flat: 0.2,
        color: (c) => (c.s.face === 2 ? null : planks(c)),
      });
      // Metal bands and corners.
      for (const x of [-0.36, 0.36]) {
        k.add(k.box(0.08, H + 0.02, D + 0.02), {
          pos: [x, -0.2, 0],
          flat: 0.2,
          weight: 1.5,
          color: (c) =>
            c.s.face === 2
              ? null
              : mix(gold, "#8a6a1f", 0.3 + 0.3 * c.fbm(c.p[0] * 20, c.p[1] * 20, 0)),
        });
      }
      // The lid: a half cylinder along X, hinged at the back edge.
      const lid = k.part("lid", { pivot: [0, top, -D / 2], axis: [1, 0, 0] });
      const R = D / 2;
      const arc = k.param(
        (u, v) => {
          const a = v * Math.PI;
          return [(u - 0.5) * W, top + Math.sin(a) * R * 0.75, Math.cos(a) * R];
        },
        { grid: 48, flip: true },
      );
      k.add(arc, { part: lid, flat: 0.2, color: planks });
      for (const x of [-0.36, 0.36]) {
        const strap = k.param(
          (u, v) => {
            const a = v * Math.PI;
            const rr = R + 0.012;
            return [x + (u - 0.5) * 0.08, top + Math.sin(a) * rr * 0.75, Math.cos(a) * rr];
          },
          { grid: 24, flip: true },
        );
        k.add(strap, { part: lid, flat: 0.2, weight: 1.5, color: gold });
      }
      for (const side of [-1, 1]) {
        const end = k.param(
          (u, v) => {
            const a = u * Math.PI;
            return [(side * W) / 2, top + Math.sin(a) * R * 0.75 * v, Math.cos(a) * R * v];
          },
          { grid: 24 },
        );
        k.add(end, { part: lid, flat: 0.2, color: planks });
      }
      // The lid's flat underside, so the open lid is not hollow.
      k.add(k.box(W, 0.01, D), {
        pos: [0, top + 0.005, 0],
        part: lid,
        flat: 0.2,
        color: shade(wood, 0.7),
      });
      // The lock plate on the front of the lid.
      k.add(k.box(0.16, 0.2, 0.03), {
        pos: [0, top - 0.02, D / 2 + 0.01],
        part: lid,
        flat: 0.2,
        weight: 2,
        color: gold,
      });
      k.add(k.box(0.12, 0.08, 0.03), {
        pos: [0, top - 0.16, D / 2 + 0.01],
        flat: 0.2,
        weight: 2,
        color: shade(gold, 0.85),
      });
      // Treasure heaped inside: coins that glint and gems that sparkle when open.
      k.cloud({ share: 0.1, size: 0.9, flat: 0.15 }, (rand) => {
        const x = (rand() - 0.5) * (W - 0.12);
        const z = (rand() - 0.5) * (D - 0.1);
        const heap = 0.08 * (1 - (x / (W / 2)) ** 2) * (1 - (z / (D / 2)) ** 2);
        const tilt = [(rand() - 0.5) * 0.8, 1, (rand() - 0.5) * 0.8];
        return {
          p: [x, top - 0.05 + heap * (0.3 + 0.7 * rand()), z],
          n: tilt,
          color: mix("#f2c94c", "#b8860b", rand() * 0.5),
          pattern: false,
          kind: "glint",
          params: [0.7, 0],
        };
      });
      const gems = ["#e0115f", "#2ecc71", "#3a7bd5", "#9b59b6", "#f1c40f"];
      for (let i = 0; i < 9; i++) {
        const x = (k.rand() - 0.5) * (W - 0.3);
        const z = (k.rand() - 0.5) * (D - 0.25);
        const s = 0.035 + k.rand() * 0.03;
        k.add(k.ellipsoid(s, s * 0.8, s), {
          pos: [x, top + 0.03, z],
          weight: 3,
          flat: 0.3,
          pattern: false,
          kind: "twinkle",
          params: [0.9, k.rand() * 6],
          color: (c) => mix(gems[i % gems.length], "#ffffff", 0.35 * smoothstep(0.3, 1, c.n[1])),
        });
      }
      // Room for the open lid.
      k.reach([0, top + D * 0.95, -D / 2 - 0.1]);
    },
  },

  book: {
    alive: true,
    options: [{ key: "color", label: "Cover", type: "color", default: "#7a2432" }],
    controls: [{ key: "open", label: "Open", type: "toggle", default: 1, ease: 2 }],
    action: { key: "open", label: "Open or close" },
    drive(t, c, out) {
      const o = c.open;
      const lift = [0, 0, 0, 0, 0, 0, 0, 0.012, 0.03, 0.06];
      const cover = Math.PI * ease3(window01(o, 0, 0.42));
      out.parts.cover = { angle: cover };
      out.parts.coverTop = { angle: cover, visible: 1 - smoothstep(0.3, 0.4, o) };
      out.parts.spine = {
        angle: (Math.PI / 2) * ease3(window01(o, 0, 0.42)),
        visible: 1 - smoothstep(0.3, 0.4, o),
      };
      // Splats keep the draw order of the closed book, where the front cover
      // and the first leaves lie above the last leaf. Once a leaf has landed
      // on the left, the one it covers (and the cover's inside, under them
      // all) hides, so the page on top reads cleanly.
      const turned = (i) => ease3(window01(o, 0.1 + i * 0.05, 0.5 + i * 0.05));
      const landed = (i) => (i < BOOK.leaves ? smoothstep(0.9, 1, turned(i)) : 0);
      out.parts.coverIn = { angle: cover, visible: 1 - landed(0) };
      // Stands in for the hidden leaves at the left pile's edges.
      out.parts.pile = { visible: landed(1) };
      for (let i = 0; i < BOOK.leaves; i++) {
        out.parts["leaf" + i] = {
          angle: (Math.PI - lift[i]) * turned(i),
          visible: 1 - landed(i + 1),
        };
      }
    },
    build(k, o) {
      const { W, H, ct, leaves, lt, T } = BOOK;
      const cover = o.color;
      const gold = "#d9b45a";
      const paper = "#f6efdf";
      const endpaper = mix(cover, "#f3e6cf", 0.72);
      const pivot = [0, T / 2, 0];
      const coverPart = k.part("cover", { pivot, axis: [0, 0, 1] });
      const spinePart = k.part("spine", { pivot, axis: [0, 0, 1] });
      // Book cloth: a fine, even weave (lit, no random speckle).
      const cloth = (c) => {
        const weave = 0.985 + 0.02 * Math.sin(c.p[0] * 260) * Math.sin(c.p[2] * 260);
        return lit(shade(cover, weave), c.n, { amb: 0.66, dif: 0.42, spec: 0.12 });
      };
      // The page block's edge: soft cream with faint, even page lines (at a
      // spacing splats can show, so they read as paper, not noise).
      const pageEdge = (y) => shade(paper, 0.86 + 0.05 * Math.sin(y * 260));
      // Words on a page. x is measured from the spine, z across the page
      // (the top of the page is at -z). A page that faces down while the
      // book is closed reads the right way once its leaf has turned over, so
      // its lines run from the outer edge towards the spine.
      const PX = 0.0082; // one font pixel
      const margin = 0.1;
      const perLine = Math.floor((W - 2 * margin) / (6 * PX));
      const pages = new Map();
      const pageText = (seed, picture) => {
        const key = `${seed}${picture}`;
        if (!pages.has(key)) {
          const rows = Math.floor((H - 2 * 0.12) / (10 * PX));
          const skip = picture ? Math.ceil((H / 2 - 0.12 + 0.03) / (10 * PX)) : 0;
          pages.set(key, { lines: storyLines(perLine, seed * 23, rows - skip), skip });
        }
        return pages.get(key);
      };
      const text = (x, z, seed, flipped, picture) => {
        const ax = Math.abs(x);
        const s = (flipped ? W - margin - ax : ax - margin) / PX;
        const page = pageText(seed, picture);
        const t = (z + H / 2 - 0.12) / PX - page.skip * 10;
        return inked(page.lines, s, t);
      };
      const ink = "#2f2a26";
      const pageCol = (c, x, z, seed, picture = false, flipped = false) => {
        if (
          picture &&
          Math.abs(x) > 0.18 &&
          Math.abs(x) < W - 0.14 &&
          z > -H / 2 + 0.16 &&
          z < -0.02
        ) {
          // A little picture: sun, sky and hills.
          const u = (Math.abs(x) - 0.18) / (W - 0.32);
          const v = (z + H / 2 - 0.16) / (H / 2 - 0.18);
          const hill = 0.62 + 0.12 * Math.sin(u * 7) + 0.06 * Math.sin(u * 15 + 1);
          let col = mix("#7fc8f8", "#fef3c7", v);
          if (Math.hypot(u - 0.72, v - 0.3) < 0.12) col = "#ffb627";
          if (v > hill) col = mix("#5aa469", "#2f7a4a", (v - hill) * 3);
          const edge = Math.min(u, 1 - u, v, 1 - v);
          return keep(edge < 0.02 ? "#5b4a3a" : col);
        }
        if (text(x, z, seed, flipped, picture)) return keep(ink, 0.8);
        // A turned page is lit as it lies once turned over.
        const n = flipped ? [-c.n[0], -c.n[1], c.n[2]] : c.n;
        return lit(shade(paper, 0.985 + 0.015 * c.noise(x * 12, z * 12, seed)), n, {
          amb: 0.8,
          dif: 0.25,
          spec: 0,
        });
      };
      // Back cover, spine and front cover.
      k.add(roundBox(W, ct, H, 0.012), {
        pos: [W / 2, ct / 2, 0],
        flat: 0.15,
        weight: 1.6,
        even: true,
        jitter: 0.01,
        size: 0.8,
        color: (c) => (c.s.face === 2 ? lit(endpaper, c.n, { spec: 0 }) : cloth(c)),
      });
      k.add(
        k.param(
          (u, v) => {
            const a = Math.PI / 2 + u * Math.PI;
            return [Math.cos(a) * 0.07, T / 2 + Math.sin(a) * (T / 2), (v - 0.5) * H];
          },
          { grid: 32 },
        ),
        {
          part: spinePart,
          flat: 0.15,
          weight: 2,
          even: true,
          jitter: 0.01,
          size: 0.8,
          color: (c) => {
            const z = Math.abs(c.p[2]);
            if (Math.abs(z - H * 0.38) < 0.015 || Math.abs(z - H * 0.3) < 0.01) return keep(gold);
            return cloth(c);
          },
        },
      );
      // The front cover: its cloth face is a part of its own that hides once
      // the cover lies open (splats keep the order of the closed book).
      k.add(roundBox(W, ct, H, 0.012, { top: false, bottom: false }), {
        pos: [W / 2, T - ct / 2, 0],
        part: coverPart,
        flat: 0.15,
        weight: 1.6,
        even: true,
        jitter: 0.01,
        size: 0.8,
        color: cloth,
      });
      // The cover's inside, its own part so it can hide under the turned pages.
      const coverIn = k.part("coverIn", { pivot, axis: [0, 0, 1] });
      k.add(quad(W - 0.024, H - 0.024, -1), {
        pos: [W / 2, T - ct, 0],
        part: coverIn,
        flat: 0.15,
        color: (c) => lit(endpaper, c.n, { spec: 0 }),
      });
      const coverTop = k.part("coverTop", { pivot, axis: [0, 0, 1] });
      k.add(quad(W - 0.024, H - 0.024), {
        pos: [W / 2, T, 0],
        part: coverTop,
        flat: 0.15,
        weight: 5,
        even: true,
        jitter: 0.01,
        size: 0.8,
        color: (c) => {
          // Gold border, title bands and an emblem on the front.
          const x = c.p[0] - W / 2;
          const z = c.p[2];
          const bx = W / 2 - 0.07 - Math.abs(x);
          const bz = H / 2 - 0.07 - Math.abs(z);
          if (Math.abs(Math.min(bx, bz)) < 0.008) return keep(lit(gold, c.n, { spec: 0.5 }));
          const r = Math.hypot(x, z - 0.12);
          if (Math.abs(r - 0.16) < 0.012 || r < 0.05) return keep(lit(gold, c.n, { spec: 0.5 }));
          if (
            Math.abs(x) < 0.26 &&
            (Math.abs(z + 0.25) < 0.02 || (Math.abs(z + 0.33) < 0.012 && Math.abs(x) < 0.17))
          )
            return keep(lit(gold, c.n, { spec: 0.5 }));
          return cloth(c);
        },
      });
      // The pages that stay on the right, with a picture on top. The two
      // pages seen when the book lies open (this one and the underside of the
      // last leaf) get most of the splats, so their words stay sharp; hidden
      // page faces get few.
      const PW = W - 0.035;
      const PH = H - 0.05;
      const block = BOOK.pb - leaves * lt;
      const sides = (face) => (face === 2 || face === 3 ? null : keep(shade(paper, 0.84)));
      k.add(k.box(PW, block, PH), {
        pos: [PW / 2 + 0.005, ct + block / 2, 0],
        flat: 0.15,
        weight: 1.8,
        even: true,
        jitter: 0,
        size: 0.7,
        color: (c) => {
          if (c.s.face === 2 || c.s.face === 3) return null;
          if (c.s.face === 1) return shade(paper, 0.8);
          return keep(pageEdge(c.p[1]));
        },
      });
      k.add(quad(PW, PH), {
        pos: [PW / 2 + 0.005, ct + block, 0],
        flat: 0.15,
        weight: 6,
        even: true,
        jitter: 0.01,
        color: (c) => pageCol(c, c.p[0], c.p[2], 3, true),
      });
      // Leaves that flip one after another.
      for (let i = 0; i < leaves; i++) {
        const part = k.part("leaf" + i, { pivot, axis: [0, 0, 1] });
        const y = T - ct - (i + 0.5) * lt;
        const pos = [PW / 2 + 0.005, y, 0];
        k.add(k.box(PW, lt * 0.8, PH), {
          pos,
          part,
          flat: 0.15,
          weight: 0.25,
          even: true,
          jitter: 0,
          size: 0.6,
          color: (c) => sides(c.s.face),
        });
        for (const up of [1, -1]) {
          const last = i === leaves - 1;
          // The last leaf's upper face would draw over its turned-up
          // underside, so it is left out (it only shows mid-turn).
          if (last && up > 0) continue;
          const shown = up < 0 && last;
          k.add(quad(PW, PH, up), {
            pos: [pos[0], y + up * lt * 0.4, 0],
            part,
            flat: 0.15,
            weight: shown ? 6 : 0.35,
            even: true,
            jitter: 0.01,
            color: (c) => pageCol(c, c.p[0], c.p[2], i * 2 + (up < 0 ? 1 : 0), false, up < 0),
          });
        }
      }
      // The left pile's edges, shown once the leaves under the top one hide.
      const pileH = (leaves - 1) * lt;
      k.add(k.box(PW, pileH, PH), {
        pos: [-PW / 2 - 0.005, ct + pileH / 2, 0],
        part: k.part("pile"),
        flat: 0.15,
        weight: 1,
        even: true,
        jitter: 0,
        size: 0.7,
        color: (c) => {
          if (c.s.face === 2 || c.s.face === 3) return null;
          return keep(pageEdge(c.p[1]));
        },
      });
      k.reach([-W, 0, H / 2]);
      k.reach([-W, 0, -H / 2]);
    },
  },

  laptop: {
    alive: true,
    options: [{ key: "color", label: "Case", type: "color", default: "#b9bec6" }],
    controls: [{ key: "open", label: "Open", type: "toggle", default: 1, ease: 1.3 }],
    action: { key: "open", label: "Open or close" },
    drive(t, c, out) {
      // Modelled open; closing turns the lid back down onto the keys.
      const a = LAPTOP.open * (1 - ease3(c.open));
      out.parts.lid = { angle: a };
      out.parts.bezel = { angle: a, visible: smoothstep(0.02, 0.3, c.open) };
      out.parts.screen = { angle: a, visible: smoothstep(0.72, 1, c.open) };
      out.parts.deck = { visible: smoothstep(0.02, 0.2, c.open) };
    },
    build(k, o) {
      const alu = o.color;
      const { W, D, hb, hl } = LAPTOP;
      const metal = (c) => {
        const brushed = 0.97 + 0.04 * c.noise(c.p[0] * 200, c.p[1] * 5, c.p[2] * 5);
        return lit(shade(alu, brushed), c.n, { amb: 0.66, dif: 0.4, spec: 0.35, pow: 20 });
      };
      // Base; the deck with the keys is its own part so it can hide under
      // the closed lid (splats are ordered by their modelled positions).
      k.add(roundBox(W, hb, D, 0.02, { bottom: false, top: false }), {
        pos: [0, hb / 2, 0],
        flat: 0.15,
        color: metal,
      });
      const deck = k.part("deck", { pivot: [0, hb, 0] });
      k.add(quad(W - 0.04, D - 0.04), {
        pos: [0, hb, 0],
        part: deck,
        flat: 0.15,
        color: (c) => {
          const [x, , z] = c.p;
          // Keys: 14 x 5 rows, a space bar in front.
          if (Math.abs(x) < 0.62 && z > -0.4 && z < 0.08) {
            const kx = (x + 0.62) / (1.24 / 14);
            const kz = (z + 0.4) / (0.48 / 5);
            const row = Math.floor(kz);
            const inKey = (kx % 1 > 0.12 && kx % 1 < 0.88) || (row === 4 && kx > 4 && kx < 10);
            if (inKey && kz % 1 > 0.14 && kz % 1 < 0.86)
              return keep(lit("#2b2e34", c.n, { amb: 0.9, dif: 0.3, spec: 0.1 }));
            return shade(metal(c), 0.9);
          }
          if (Math.abs(x) < 0.22 && z > 0.16 && z < 0.44) {
            const e = Math.min(0.22 - Math.abs(x), z - 0.16, 0.44 - z);
            return e < 0.008 ? shade(metal(c), 0.82) : shade(metal(c), 1.04);
          }
          return metal(c);
        },
      });
      // The lid, hinged along the back edge and modelled standing open.
      const pivot = [0, hb + hl / 2, -D / 2 + 0.01];
      const q = quatAxisAngle([1, 0, 0], -LAPTOP.open);
      const place = (p) => add(pivot, quatRotate(q, sub(p, pivot)));
      const lid = k.part("lid", { pivot, axis: [1, 0, 0] });
      const bezel = k.part("bezel", { pivot, axis: [1, 0, 0] });
      const screen = k.part("screen", { pivot, axis: [1, 0, 0] });
      const lidY = hb + hl / 2 + 0.002;
      k.add(roundBox(W, hl, D, 0.012, { bottom: false }), {
        pos: place([0, lidY, 0]),
        quat: q,
        part: lid,
        flat: 0.15,
        color: metal,
      });
      k.add(quad(W - 0.02, D - 0.02, -1), {
        pos: place([0, lidY - hl / 2 - 0.001, 0]),
        quat: q,
        part: bezel,
        flat: 0.12,
        pattern: false,
        color: (c) => {
          const [x, , z] = c.lp;
          if (Math.hypot(x, z - (D - 0.02) / 2 + 0.035) < 0.01) return keep("#3a4250");
          return keep(mix("#0b0e13", "#1a1f27", 0.5 + 0.4 * (z / D)));
        },
      });
      // The picture on the screen: a bright abstract wallpaper.
      k.add(quad(W - 0.14, D - 0.16, -1), {
        pos: place([0, lidY - hl / 2 - 0.008, 0.005]),
        quat: q,
        part: screen,
        flat: 0.1,
        size: 1.2,
        pattern: false,
        color: (c) => {
          const u = (c.lp[0] + (W - 0.14) / 2) / (W - 0.14);
          const v = (c.lp[2] + (D - 0.16) / 2) / (D - 0.16);
          let col = mix("#ff9a62", "#2b1b6b", 1 - v);
          col = mix(col, "#ff5e98", 0.5 * Math.exp(-(((v - 0.55) / 0.2) ** 2)));
          for (let w = 0; w < 3; w++) {
            const y = 0.22 + w * 0.13 + 0.06 * Math.sin(u * 6 + w * 1.7);
            if (v < y) col = mix(col, ["#6a3fc1", "#3a86ff", "#12c2b5"][w], 0.55);
          }
          if (Math.hypot(u - 0.7, v - 0.72) < 0.08) col = mix(col, "#fff3b0", 0.85);
          return keep(col);
        },
      });
    },
  },

  "music-box": {
    alive: true,
    options: [{ key: "wood", label: "Wood", type: "color", default: "#8a4526" }],
    controls: [{ key: "open", label: "Open", type: "toggle", default: 1, ease: 1.4 }],
    action: { key: "open", label: "Open or close" },
    drive(t, c, out) {
      const m = mem(c);
      const o = ease3(c.open);
      out.parts.lid = { angle: -1.95 * o };
      out.parts.lidTop = { angle: -1.95 * o, visible: 1 - smoothstep(0.55, 0.8, c.open) };
      out.parts.dancer = {
        angle: integrate(m, "spin", t, 2.4 * c.open),
        offset: [0, -0.34 * (1 - smoothstep(0.35, 1, c.open)), 0],
      };
      out.parts.crank = { angle: integrate(m, "crank", t, 3 * c.open) };
      NOTE_PATHS.forEach((n, i) => {
        const s = (t * 0.28 + n.phase) % 1;
        out.parts["note" + i] = {
          offset: [0.12 * Math.sin(s * 5 + i), s * 0.75, 0],
          visible:
            smoothstep(0.6, 1, c.open) * smoothstep(0, 0.12, s) * (1 - smoothstep(0.75, 1, s)),
        };
      });
    },
    build(k, o) {
      const wood = o.wood;
      const gold = "#d8b25a";
      const velvet = "#9e1b32";
      const W = 1.1;
      const H = 0.5;
      const D = 0.76;
      const top = H;
      const grain = (c) => {
        const g = c.fbm(c.p[0] * 3, c.p[1] * 26, c.p[2] * 3);
        return lit(mix(wood, shade(wood, 0.62), 0.5 + 0.45 * g), c.n, {
          amb: 0.66,
          dif: 0.42,
          spec: 0.35,
        });
      };
      k.add(roundBox(W, H, D, 0.03, { top: false, bottom: false }), {
        pos: [0, H / 2, 0],
        flat: 0.15,
        color: (c) => {
          if (Math.abs(c.p[1] - 0.12) < 0.012 || Math.abs(c.p[1] - (H - 0.05)) < 0.01)
            return keep(lit(gold, c.n, { spec: 0.5 }));
          return grain(c);
        },
      });
      // Velvet lining and the floor the dancer stands on.
      k.add(k.box(W - 0.07, H - 0.06, D - 0.07), {
        pos: [0, H / 2 + 0.03, 0],
        flat: 0.3,
        color: (c) => (c.s.face === 2 ? null : shade(velvet, 0.7 + 0.25 * c.rand())),
      });
      // The lid with a mirror inside, hinged at the back. Its top is a part
      // of its own that hides while the lid stands open, so the mirror shows
      // (splats keep the order of the closed box).
      const lid = k.part("lid", { pivot: [0, top, -D / 2], axis: [1, 0, 0] });
      const lidTop = k.part("lidTop", { pivot: [0, top, -D / 2], axis: [1, 0, 0] });
      k.add(roundBox(W, 0.1, D, 0.03, { top: false }), {
        pos: [0, top + 0.05, 0],
        part: lid,
        flat: 0.15,
        color: (c) => {
          const [x, , z] = c.p;
          if (c.s.face === 3) {
            const inM = Math.abs(x) < W / 2 - 0.1 && Math.abs(z) < D / 2 - 0.1;
            if (inM) return keep(mix("#c9d3de", "#f4f7fb", 0.5 + 0.5 * Math.sin((x - z) * 5)));
            return shade(velvet, 0.8);
          }
          return grain(c);
        },
      });
      k.add(quad(W - 0.06, D - 0.06), {
        pos: [0, top + 0.1, 0],
        part: lidTop,
        flat: 0.15,
        color: (c) => {
          const [x, , z] = c.p;
          const r = Math.hypot(x, z);
          if (
            Math.abs(r - 0.2) < 0.012 ||
            Math.abs(Math.max(Math.abs(x) / (W / 2 - 0.08), Math.abs(z) / (D / 2 - 0.08)) - 1) <
              0.02
          )
            return keep(lit(gold, c.n, { spec: 0.5 }));
          return grain(c);
        },
      });
      // The dancer on her turntable (she rises as the lid opens).
      const base = 0.06;
      const dancer = k.part("dancer", { pivot: [0, base, 0.02] });
      const skin = "#f3cfb3";
      const pink = "#ff8fb8";
      const d = (shape, opts) =>
        k.add(shape, { part: dancer, flat: 0.25, weight: 2.2, pattern: false, ...opts });
      d(k.cylinder(0.12, 0.02), {
        pos: [0, top - 0.05, 0.02],
        color: (c) => lit(gold, c.n, { spec: 0.5 }),
      });
      for (const s of [-1, 1])
        d(k.cylinder(0.011, 0.2, { caps: false }), {
          pos: [s * 0.015, top + 0.06, 0.02],
          rot: [0, 0, s * 4],
          color: (c) => lit(skin, c.n),
        });
      d(k.cone(0.13, 0.02, 0.06), {
        pos: [0, top + 0.17, 0.02],
        color: (c) =>
          lit(mix(pink, "#ffffff", 0.3 * ((c.u * 18) % 1 < 0.5)), c.n, { amb: 0.75, dif: 0.35 }),
      });
      d(k.ellipsoid(0.035, 0.06, 0.03), {
        pos: [0, top + 0.23, 0.02],
        color: (c) => lit(pink, c.n),
      });
      d(k.sphere(0.033), { pos: [0, top + 0.315, 0.02], color: (c) => lit(skin, c.n) });
      d(k.sphere(0.018), { pos: [0, top + 0.35, 0.005], color: (c) => lit("#4a2c1d", c.n) });
      d(
        k.tube(
          (tt) => {
            const a = Math.PI * (0.1 + 0.8 * tt);
            return [Math.cos(a) * 0.07, top + 0.26 + Math.sin(a) * 0.13, 0.02];
          },
          0.008,
          { samples: 48, grid: 24 },
        ),
        { color: (c) => lit(skin, c.n) },
      );
      // The crank on the side.
      const crank = k.part("crank", { pivot: [W / 2 + 0.03, H / 2, 0], axis: [1, 0, 0] });
      k.add(k.cylinder(0.02, 0.06), {
        pos: [W / 2 + 0.03, H / 2, 0],
        rot: [0, 0, 90],
        part: crank,
        weight: 2,
        color: (c) => lit(gold, c.n, { spec: 0.5 }),
      });
      k.add(k.cylinder(0.015, 0.14), {
        pos: [W / 2 + 0.06, H / 2 + 0.06, 0],
        part: crank,
        weight: 2,
        color: (c) => lit(gold, c.n, { spec: 0.5 }),
      });
      k.add(k.sphere(0.03), {
        pos: [W / 2 + 0.06, H / 2 + 0.13, 0],
        part: crank,
        weight: 2,
        color: (c) => lit("#f4efe6", c.n),
      });
      // Musical notes that float up while it plays.
      NOTE_PATHS.forEach((n, i) => {
        const part = k.part("note" + i, { pivot: [n.x, top + 0.2, n.z] });
        const col = ["#f2c14e", "#ff8fb8", "#8ecae6"][i];
        const at = [n.x, top + 0.25, n.z];
        k.add(k.ellipsoid(0.04, 0.03, 0.02), {
          pos: at,
          rot: [0, 0, 25],
          part,
          weight: 3,
          pattern: false,
          color: (c) => keep(lit(col, c.n, { spec: 0.5 })),
        });
        k.add(k.cylinder(0.008, 0.14, { caps: false }), {
          pos: [at[0] + 0.035, at[1] + 0.07, at[2]],
          part,
          weight: 3,
          pattern: false,
          color: col,
        });
        k.add(k.ellipsoid(0.035, 0.012, 0.01), {
          pos: [at[0] + 0.06, at[1] + 0.125, at[2]],
          rot: [0, 0, -30],
          part,
          weight: 3,
          pattern: false,
          color: col,
        });
      });
      k.reach([0, top + 1.0, 0]);
    },
  },

  clock: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#d6453d" }],
    controls: [{ key: "ring", label: "Ring", type: "pulse", ease: 2.2 }],
    action: { key: "ring", label: "Ring the bell" },
    drive(t, c, out, info) {
      // The hands show the real local time.
      const d = new Date();
      const s = d.getSeconds() + d.getMilliseconds() / 1000;
      const m = d.getMinutes() + s / 60;
      const h = (d.getHours() % 12) + m / 60;
      const tick = Math.floor(s) + ease3(clamp((s % 1) / 0.18, 0, 1));
      out.parts.hour = { angle: (-h / 12) * TAU };
      out.parts.minute = { angle: (-m / 60) * TAU };
      out.parts.second = { angle: (-tick / 60) * TAU };
      const r = c.ring;
      const time = info?.time ?? t;
      out.parts.hammer = { angle: r > 0 ? 0.5 * Math.sin(time * 70) * Math.min(1, r * 2) : 0 };
      out.body = {
        quat: [
          0,
          0,
          Math.sin(0.025 * Math.sin(time * 55) * r),
          Math.cos(0.025 * Math.sin(time * 55) * r),
        ],
        offset: [0, 0.015 * Math.abs(Math.sin(time * 40)) * r, 0],
      };
    },
    build(k, o) {
      const body = o.color;
      const R = 0.8;
      const Dp = 0.34;
      const zf = Dp / 2;
      const dial = "#fbf8f0";
      // Body: a drum facing the viewer.
      k.add(k.cylinder(R, Dp, { caps: "bottom" }), {
        rot: [90, 0, 0],
        flat: 0.15,
        interior: 0.06,
        core: "#6a6f78",
        color: (c) => lit(body, c.n, { amb: 0.64, dif: 0.45, spec: 0.45, pow: 26 }),
      });
      k.add(k.torus(R, 0.055), {
        pos: [0, 0, zf],
        rot: [90, 0, 0],
        flat: 0.2,
        weight: 1.3,
        color: (c) => chrome(c.n),
      });
      // The dial: ticks, numbers and a maker's line.
      k.add(k.disc(R - 0.03), {
        pos: [0, 0, zf - 0.01],
        rot: [90, 0, 0],
        flat: 0.12,
        pattern: false,
        color: (c) => {
          if (c.n[2] < 0) return null;
          const x = c.p[0];
          const y = c.p[1];
          const r = Math.hypot(x, y);
          const a = (Math.atan2(x, y) / TAU + 1) % 1;
          const mm = a * 60;
          const md = Math.abs(mm - Math.round(mm));
          const hour = Math.round(mm) % 5 === 0;
          if (
            r > 0.6 &&
            r < 0.72 &&
            md * ((r * TAU) / 60) < (hour ? 0.018 : 0.006) &&
            (hour || r > 0.66)
          )
            return keep("#1d1d22");
          const hn = Math.round(a * 12) || 12;
          const ha = (hn / 12) * TAU;
          const cx = Math.sin(ha) * 0.49;
          const cy = Math.cos(ha) * 0.49;
          const sz = 0.05;
          if (
            Math.hypot(x - cx, y - cy) < 0.12 &&
            textDist(String(hn), (x - cx) / sz, (y - cy) / sz) < 0.24
          )
            return keep("#1d1d22");
          return keep(shade(dial, 0.97 + 0.03 * (1 - r)));
        },
      });
      // Hands (parts turning about the centre).
      const hand = (name, len, w, col, back = 0) => {
        const part = k.part(name, { pivot: [0, 0, 0], axis: [0, 0, 1] });
        const z = zf + (name === "second" ? 0.03 : name === "minute" ? 0.02 : 0.01);
        k.add(roundBox(w, len + back, 0.008, w * 0.45), {
          pos: [0, (len - back) / 2, z],
          part,
          flat: 0.15,
          weight: 3,
          pattern: false,
          color: (c) => keep(lit(col, c.n, { spec: 0.4 })),
        });
        return part;
      };
      hand("hour", 0.36, 0.055, "#1d1d22", 0.05);
      hand("minute", 0.55, 0.04, "#1d1d22", 0.06);
      const sec = hand("second", 0.6, 0.012, "#d62828", 0.16);
      k.add(k.cylinder(0.035, 0.01), {
        pos: [0, -0.11, zf + 0.03],
        rot: [90, 0, 0],
        part: sec,
        weight: 3,
        pattern: false,
        color: "#d62828",
      });
      k.add(k.cylinder(0.04, 0.04), {
        pos: [0, 0, zf + 0.035],
        rot: [90, 0, 0],
        weight: 3,
        pattern: false,
        color: (c) => chrome(c.n),
      });
      // Bells, a handle and a hammer between them.
      for (const s of [-1, 1]) {
        k.add(
          k.lathe(
            [
              [0.3, 0],
              [0.29, 0.06],
              [0.24, 0.16],
              [0.14, 0.23],
              [0, 0.25],
            ],
            { grid: 64 },
          ),
          {
            pos: [s * 0.46, 0.66, 0],
            rot: [0, 0, s * -32],
            flat: 0.15,
            color: (c) => chrome(c.n, "#e8c06a"),
          },
        );
        k.add(k.cylinder(0.035, 0.18), {
          pos: [s * 0.42, -0.83, 0],
          rot: [0, 0, s * 22],
          weight: 2,
          color: (c) => chrome(c.n),
        });
      }
      k.add(
        k.tube(
          (tt) => {
            const a = Math.PI * (0.12 + 0.76 * tt);
            return [Math.cos(a) * 0.55, 0.66 + Math.sin(a) * 0.42, -0.02];
          },
          0.028,
          { samples: 64, grid: 32 },
        ),
        { flat: 0.2, weight: 1.5, color: (c) => chrome(c.n) },
      );
      const hammer = k.part("hammer", { pivot: [0, 0.8, 0], axis: [0, 0, 1] });
      k.add(k.cylinder(0.012, 0.22), {
        pos: [0, 0.9, 0.02],
        part: hammer,
        weight: 2,
        color: (c) => chrome(c.n),
      });
      k.add(k.sphere(0.04), {
        pos: [0, 1.01, 0.02],
        part: hammer,
        weight: 2,
        color: (c) => chrome(c.n),
      });
    },
  },

  "gift-box": {
    alive: true,
    options: [
      { key: "paper", label: "Paper", type: "color", default: "#e8435a" },
      { key: "ribbon", label: "Ribbon", type: "color", default: "#f6c343" },
    ],
    controls: [{ key: "open", label: "Open", type: "toggle", default: 0, ease: 1 }],
    action: { key: "open", label: "Open the present" },
    drive(t, c, out) {
      const o = c.open;
      const up = easeOutBack(clamp(o / 0.7, 0, 1));
      out.parts.lid = { offset: [0, 0.55 * up, -0.45 * ease3(o)], angle: -0.9 * ease3(o) };
      out.parts.star = {
        offset: [0, 0.82 * easeOutBack(window01(o, 0.25, 1)), 0],
        angle: 0.5 * Math.sin(t * 1.2) * o,
      };
      out.parts.confetti = { visible: smoothstep(0.25, 0.6, o) };
      out.amount = 0.6 + 0.6 * o;
    },
    build(k, o) {
      const paper = o.paper;
      const ribbon = o.ribbon;
      const S = 1;
      const H = 0.78;
      const band = 0.085;
      const wrap = (c, faceUp) => {
        const [x, y, z] = c.p;
        const f = c.s.face;
        const onX = Math.abs(x) < band && f !== 0 && f !== 1;
        const onZ = Math.abs(z) < band && f !== 4 && f !== 5;
        if (onX || onZ || (faceUp && (Math.abs(x) < band || Math.abs(z) < band)))
          return lit(ribbon, c.n, { amb: 0.7, dif: 0.35, spec: 0.5, pow: 20 });
        // Polka dots.
        const g = 0.16;
        const a = f < 2 ? z : x;
        const b = f === 2 || f === 3 ? z : y;
        const du = ((((a / g) % 1) + 1) % 1) - 0.5;
        const dv = ((((b / g + 0.5 * (Math.floor(a / g) % 2)) % 1) + 1) % 1) - 0.5;
        const dot2 = Math.hypot(du, dv) < 0.2;
        return lit(dot2 ? mix(paper, "#ffffff", 0.75) : paper, c.n, {
          amb: 0.66,
          dif: 0.42,
          spec: 0.18,
        });
      };
      k.add(roundBox(S, H, S, 0.025, { top: false, bottom: false }), {
        pos: [0, H / 2, 0],
        flat: 0.15,
        color: (c) => wrap(c, false),
      });
      k.add(k.box(S - 0.03, H - 0.02, S - 0.03), {
        pos: [0, H / 2 + 0.01, 0],
        flat: 0.2,
        color: (c) => (c.s.face === 2 ? null : shade(paper, 0.45)),
      });
      // The lid, with the bow on top.
      const lidY = H + 0.03;
      const lid = k.part("lid", { pivot: [0, lidY, -S / 2], axis: [1, 0, 0] });
      k.add(roundBox(S + 0.07, 0.16, S + 0.07, 0.03), {
        pos: [0, lidY, 0],
        part: lid,
        flat: 0.15,
        color: (c) => (c.s.face === 3 ? shade(paper, 0.55) : wrap(c, c.s.face === 2)),
      });
      const bowY = lidY + 0.08;
      for (const s of [-1, 1]) {
        k.add(k.torus(0.13, 0.04), {
          pos: [s * 0.13, bowY + 0.1, 0],
          rot: [90, 0, s * -30],
          scale: [1.15, 1, 0.7],
          part: lid,
          flat: 0.2,
          weight: 1.4,
          color: (c) => lit(ribbon, c.n, { amb: 0.66, dif: 0.42, spec: 0.5, pow: 20 }),
        });
        k.add(k.box(0.09, 0.012, 0.3), {
          pos: [s * 0.06, bowY + 0.005, 0.2],
          rot: [0, s * 25, 0],
          part: lid,
          flat: 0.15,
          weight: 1.4,
          color: (c) => lit(ribbon, c.n, { spec: 0.4 }),
        });
      }
      k.add(k.sphere(0.06), {
        pos: [0, bowY + 0.04, 0],
        part: lid,
        weight: 2,
        flat: 0.2,
        color: (c) => lit(ribbon, c.n, { spec: 0.5 }),
      });
      // The surprise: a golden star on a spring, and confetti.
      const star = k.part("star", { pivot: [0, H * 0.55, 0] });
      const pts = starPoints(0.3, 0.13);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        for (const z of [-0.04, 0.04])
          k.add(
            triShape(
              [0, H * 0.55, z * 1.6],
              [a[0], H * 0.55 + a[1], z],
              [b[0], H * 0.55 + b[1], z],
            ),
            {
              part: star,
              weight: 2,
              flat: 0.2,
              pattern: false,
              color: (c) =>
                keep(
                  lit("#ffd23f", c.n[2] * z > 0 ? c.n : mul(c.n, -1), {
                    amb: 0.75,
                    dif: 0.4,
                    spec: 0.6,
                  }),
                ),
            },
          );
      }
      k.add(
        k.tube(
          (tt) => [
            0.06 * Math.cos(tt * 30),
            0.05 + tt * (H * 0.55 - 0.3),
            0.06 * Math.sin(tt * 30),
          ],
          0.01,
          { samples: 200, grid: 32 },
        ),
        { part: star, weight: 2, flat: 0.3, color: (c) => chrome(c.n) },
      );
      const confetti = k.part("confetti", { pivot: [0, H, 0] });
      const cols = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93", "#ff8fab"];
      k.cloud({ share: 0.025, size: 1.8, part: confetti, pattern: false }, (rand) => ({
        p: [(rand() - 0.5) * 0.7, H - 0.1 + rand() * 0.2, (rand() - 0.5) * 0.7],
        n: [rand() - 0.5, rand() - 0.5, rand() - 0.5],
        flat: 0.1,
        color: cols[Math.floor(rand() * cols.length)],
        opacity: 1,
        kind: "rise",
        params: [0.9 + 0.8 * rand(), rand()],
      }));
      k.reach([0, H + 1.05, 0]);
    },
  },

  umbrella: {
    alive: true,
    density: 0.65,
    options: [
      {
        key: "style",
        label: "Canopy",
        type: "select",
        default: "rainbow",
        choices: [
          { id: "rainbow", label: "Rainbow" },
          { id: "stripes", label: "Stripes" },
          { id: "plain", label: "Plain" },
        ],
      },
      { key: "color", label: "Colour", type: "color", default: "#d7263d" },
    ],
    controls: [{ key: "open", label: "Open", type: "toggle", default: 1, ease: 1.1 }],
    action: { key: "open", label: "Open or close" },
    drive(t, c, out) {
      const close = 1 - ease3(c.open);
      for (let i = 0; i < 8; i++) out.parts["panel" + i] = { angle: 1.18 * close };
      out.body = { quat: quatAxisAngle([0, 1, 0], 0.15 * Math.sin(t * 0.5)) };
    },
    build(k, o) {
      const R = 1.05;
      const top = 0.72;
      const droop = 0.42;
      const handleCol = "#6b3f22";
      for (let i = 0; i < 8; i++) {
        const th = (i / 8) * TAU;
        const axis = [Math.cos(th), 0, -Math.sin(th)];
        const part = k.part("panel" + i, { pivot: [0, top, 0], axis });
        const col =
          o.style === "rainbow"
            ? hsv(i / 8, 0.7, 0.95)
            : o.style === "stripes"
              ? i % 2
                ? "#f7f4ee"
                : o.color
              : o.color;
        const w = Math.PI / 8;
        const panel = k.param(
          (u, v) => {
            const a = th + (u - 0.5) * 2 * w;
            const s = v;
            const scallop = 1 - 0.07 * Math.pow(Math.sin((u - 0.5) * Math.PI + Math.PI / 2), 2) * s;
            const r =
              s * R * (0.97 + 0.03 * Math.cos((u - 0.5) * 2 * w * 8)) * (2 - scallop) * 0.5 * 2;
            return [
              Math.sin(a) * r * scallop,
              top - droop * Math.pow(s, 1.7) + 0.06 * s * (1 - s),
              Math.cos(a) * r * scallop,
            ];
          },
          { grid: 40 },
        );
        k.add(panel, {
          part,
          flat: 0.12,
          color: (c) => {
            const e = Math.abs(c.u - 0.5) * 2;
            const n = c.n[1] < 0 ? mul(c.n, -1) : c.n;
            const base = lit(col, n, { amb: 0.66, dif: 0.42, spec: 0.25 });
            if (e > 0.965) return shade(base, 0.6);
            return c.v > 0.965 ? shade(base, 0.8) : base;
          },
        });
        // A rib under the seam.
        k.add(
          k.tube(
            (tt) => {
              const r = tt * R * 0.99;
              const a = th + w;
              return [
                Math.sin(a) * r * 0.93,
                top - droop * Math.pow(tt, 1.7) + 0.06 * tt * (1 - tt) - 0.012,
                Math.cos(a) * r * 0.93,
              ];
            },
            0.009,
            { samples: 32, grid: 16 },
          ),
          { part, weight: 1.5, flat: 0.3, color: "#3b3b40" },
        );
      }
      // Shaft, tip and a crook handle.
      k.add(k.cylinder(0.022, top + 0.95), {
        pos: [0, (top - 0.95) / 2, 0],
        weight: 1.5,
        color: (c) => chrome(c.n),
      });
      k.add(k.cone(0.03, 0.005, 0.12), {
        pos: [0, top + 0.06, 0],
        weight: 2,
        color: (c) => chrome(c.n),
      });
      k.add(
        k.tube(
          (tt) => {
            if (tt < 0.45) return [0, -0.95 - tt * 0.5, 0];
            const a = ((tt - 0.45) / 0.55) * Math.PI;
            return [0.14 - Math.cos(a) * 0.14, -1.175 - Math.sin(a) * 0.14, 0];
          },
          0.04,
          { samples: 96, grid: 32, caps: true },
        ),
        { flat: 0.2, weight: 1.3, color: (c) => lit(handleCol, c.n, { spec: 0.45 }) },
      );
    },
  },

  "desk-fan": {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#6cc2b3" }],
    controls: [
      { key: "power", label: "On", type: "toggle", default: 1, ease: 1.8 },
      { key: "swing", label: "Swing", type: "toggle", default: 1, ease: 1 },
    ],
    action: { key: "power", label: "Switch on or off" },
    drive(t, c, out) {
      const m = mem(c);
      const spin = integrate(m, "spin", t, 24 * c.power * c.power);
      const yaw = 0.55 * Math.sin(integrate(m, "osc", t, 0.55 * c.swing * c.power));
      const qy = quatAxisAngle([0, 1, 0], yaw);
      const qs = quatAxisAngle([0, 0, 1], -spin);
      out.parts.head = { quat: qy };
      const S = FAN.yawAt;
      const Hc = FAN.hub;
      const moved = add(S, quatRotate(qy, sub(Hc, S)));
      out.parts.blades = { quat: quatMul(qy, qs), offset: sub(moved, Hc) };
    },
    build(k, o) {
      const body = o.color;
      const paint = (c) => lit(body, c.n, { amb: 0.66, dif: 0.42, spec: 0.45, pow: 26 });
      const S = FAN.yawAt;
      const Hc = FAN.hub;
      // Base and stand.
      k.add(
        k.lathe(
          [
            [0.4, 0],
            [0.4, 0.05],
            [0.36, 0.09],
            [0.12, 0.11],
            [0.06, 0.13],
            [0, 0.13],
          ],
          { grid: 64 },
        ),
        {
          flat: 0.15,
          color: paint,
        },
      );
      for (const [x, col] of [
        [-0.12, "#f4f1ea"],
        [0, "#f4f1ea"],
        [0.12, "#e05a47"],
      ])
        k.add(k.cylinder(0.03, 0.03), {
          pos: [x, 0.09, 0.3],
          rot: [-15, 0, 0],
          weight: 2,
          color: (c) => lit(col, c.n),
        });
      k.add(k.cylinder(0.035, S[1] - 0.1), {
        pos: [0, (S[1] + 0.1) / 2, S[2]],
        color: (c) => chrome(c.n),
      });
      // The head: motor and cage turn together.
      const head = k.part("head", { pivot: S, axis: [0, 1, 0] });
      k.add(k.ellipsoid(0.16, 0.16, 0.2), {
        pos: [0, Hc[1], Hc[2] - 0.22],
        part: head,
        flat: 0.15,
        color: paint,
      });
      k.add(k.sphere(0.06), { pos: [0, S[1], S[2]], part: head, color: paint });
      const cz = Hc[2];
      const Rg = 0.5;
      const wire = { part: head, flat: 0.35, weight: 1.2, color: (c) => chrome(c.n) };
      k.add(k.torus(Rg, 0.016), {
        pos: [0, Hc[1], cz + 0.02],
        rot: [90, 0, 0],
        ...wire,
        weight: 2,
      });
      for (const r of [0.14, 0.26, 0.38])
        k.add(k.torus(r, 0.006), { pos: [0, Hc[1], cz + 0.09], rot: [90, 0, 0], ...wire });
      k.add(k.torus(Rg * 0.9, 0.008), { pos: [0, Hc[1], cz - 0.1], rot: [90, 0, 0], ...wire });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        const dx = Math.sin(a);
        const dy = Math.cos(a);
        k.add(
          k.tube(
            (tt) => {
              const r = 0.06 + tt * (Rg - 0.06);
              return [dx * r, Hc[1] + dy * r, cz + 0.1 - 0.08 * tt * tt];
            },
            0.005,
            { samples: 16, grid: 12 },
          ),
          wire,
        );
        k.add(
          k.tube(
            (tt) => {
              const r = Rg * (1 - 0.1 * tt);
              return [dx * r, Hc[1] + dy * r, cz + 0.02 - 0.12 * tt];
            },
            0.005,
            { samples: 8, grid: 8 },
          ),
          wire,
        );
      }
      k.add(k.cylinder(0.06, 0.02), {
        pos: [0, Hc[1], cz + 0.1],
        rot: [90, 0, 0],
        part: head,
        weight: 2,
        color: (c) => chrome(c.n),
      });
      // Blades (their own part: spin plus the head's swing).
      const blades = k.part("blades", { pivot: Hc, axis: [0, 0, 1] });
      for (let b = 0; b < 4; b++) {
        const th = (b / 4) * TAU + 0.3;
        k.add(
          k.param(
            (u, v) => {
              const r = 0.07 + v * 0.36;
              const wa = 0.55 * Math.sin(Math.PI * Math.min(1, v * 1.15 + 0.1)) + 0.12;
              const a = th + (u - 0.5) * wa;
              return [Math.sin(a) * r, Hc[1] + Math.cos(a) * r, cz + (u - 0.5) * 0.09];
            },
            { grid: 24 },
          ),
          {
            part: blades,
            flat: 0.12,
            opacity: 0.9,
            color: (c) => {
              const n = c.n[2] < 0 ? mul(c.n, -1) : c.n;
              return lit(mix(body, "#ffffff", 0.45), n, { amb: 0.7, dif: 0.35, spec: 0.4 });
            },
          },
        );
      }
      k.add(k.cylinder(0.07, 0.07), {
        pos: [0, Hc[1], cz - 0.02],
        rot: [90, 0, 0],
        part: blades,
        weight: 2,
        color: paint,
      });
    },
  },

  lamp: {
    alive: true,
    density: 0.45,
    options: [{ key: "color", label: "Colour", type: "color", default: "#3c7fc4" }],
    controls: [{ key: "light", label: "Light", type: "toggle", default: 1, ease: 0.35 }],
    action: { key: "light", label: "Switch the light" },
    drive(t, c, out) {
      out.parts.glow = { visible: c.light };
      out.parts.beam = { visible: c.light };
    },
    build(k, o) {
      const paint = (c) => lit(o.color, c.n, { amb: 0.64, dif: 0.45, spec: 0.5, pow: 26 });
      const base = [0, 0.06, -0.1];
      const elbow = [-0.05, 0.9, -0.35];
      const joint = [0.42, 1.22, -0.05];
      k.add(
        k.lathe(
          [
            [0.36, 0],
            [0.36, 0.05],
            [0.32, 0.09],
            [0.08, 0.11],
            [0, 0.11],
          ],
          { grid: 64 },
        ),
        {
          pos: [0, 0, -0.1],
          flat: 0.15,
          color: paint,
        },
      );
      k.add(k.cylinder(0.03, 0.03), {
        pos: [0.22, 0.1, 0.1],
        weight: 2,
        color: (c) => chrome(c.n),
      });
      const rod = (a, b, r) =>
        k.add(
          k.tube((tt) => add(a, mul(sub(b, a), tt)), r, { samples: 16, grid: 24 }),
          {
            flat: 0.2,
            weight: 1.3,
            color: paint,
          },
        );
      for (const dz of [-0.035, 0.035]) {
        rod(add(base, [0, 0, dz]), add(elbow, [0, 0, dz]), 0.018);
        rod(add(elbow, [0, 0, dz]), add(joint, [0, 0, dz]), 0.018);
      }
      for (const p of [base, elbow, joint])
        k.add(k.cylinder(0.045, 0.11), {
          pos: p,
          rot: [90, 0, 0],
          weight: 2,
          color: (c) => chrome(c.n),
        });
      // Springs beside the arms.
      const spring = (a, b) =>
        k.add(
          k.tube(
            (tt) => {
              const d = unit(sub(b, a));
              const side = unit(cross(d, [0, 0, 1]));
              const q = add(add(a, mul(sub(b, a), 0.2 + 0.5 * tt)), mul(side, 0.06));
              return add(
                q,
                add(mul(side, 0.015 * Math.cos(tt * 70)), [0, 0, 0.015 * Math.sin(tt * 70)]),
              );
            },
            0.004,
            { samples: 400, grid: 16 },
          ),
          { weight: 1.5, flat: 0.4, color: (c) => chrome(c.n) },
        );
      spring(base, elbow);
      spring(elbow, joint);
      // The shade points down at the desk in front.
      const dir = unit([0.35, -1, 0.35]);
      const head = add(joint, mul(dir, 0.14));
      const q = quatFromTo([0, -1, 0], dir);
      k.add(
        k.lathe(
          [
            [0.05, 0.16],
            [0.08, 0.1],
            [0.16, 0.0],
            [0.26, -0.12],
            [0.3, -0.2],
          ],
          { grid: 64 },
        ),
        {
          pos: head,
          quat: q,
          flat: 0.15,
          color: (c) =>
            dot(c.n, dir) > 0.2 ? lit("#f4efe2", mul(c.n, -1), { amb: 0.9, dif: 0.2 }) : paint(c),
        },
      );
      const bulbAt = add(head, mul(dir, 0.07));
      k.add(k.sphere(0.085), { pos: bulbAt, weight: 2, color: "#e9e4d8" });
      const glow = k.part("glow", { pivot: bulbAt });
      k.add(k.sphere(0.095), {
        pos: bulbAt,
        part: glow,
        weight: 2,
        pattern: false,
        color: (c) => keep(mix("#fff7d6", "#ffffff", 0.6)),
      });
      // A faint cone of light and a warm pool on the desk.
      const beam = k.part("beam", { pivot: bulbAt });
      const floorT = (0 - bulbAt[1]) / dir[1];
      const pool = add(bulbAt, mul(dir, floorT));
      k.cloud({ share: 0.08, size: 3.2, part: beam, pattern: false }, (rand) => {
        const s = Math.sqrt(rand());
        const rr = (0.08 + s * 0.5) * Math.sqrt(rand());
        const a = rand() * TAU;
        const ref = unit(cross(dir, [0, 0, 1]));
        const ref2 = cross(dir, ref);
        const p = add(
          add(bulbAt, mul(dir, s * floorT * 0.98)),
          add(mul(ref, Math.cos(a) * rr), mul(ref2, Math.sin(a) * rr)),
        );
        return { p, color: "#ffe9a8", opacity: 0.05 + 0.05 * (1 - s) };
      });
      k.cloud({ share: 0.06, size: 2.2, part: beam, pattern: false }, (rand) => {
        const a = rand() * TAU;
        const r = Math.sqrt(rand()) * 0.62;
        return {
          p: [pool[0] + Math.sin(a) * r, 0.003, pool[2] + Math.cos(a) * r],
          n: [0, 1, 0],
          color: "#ffe39a",
          opacity: 0.45 * (1 - (r / 0.62) ** 2),
        };
      });
    },
  },

  "potion-bottle": {
    alive: true,
    options: [{ key: "color", label: "Potion", type: "color", default: "#b44cff" }],
    controls: [{ key: "pop", label: "Pop the cork", type: "pulse", ease: 1.8 }],
    action: { key: "pop", label: "Pop the cork" },
    drive(t, c, out) {
      const p = 1 - c.pop;
      const on = c.pop > 0;
      const fly = on ? bump(clamp(p / 0.75, 0, 1)) : 0;
      out.parts.cork = { offset: [0.12 * fly, 0.55 * fly, 0], angle: on ? 2.4 * fly : 0 };
      out.parts.puff = { visible: on ? 1 - smoothstep(0.3, 0.8, p) : 0 };
      out.amount = 1 + 1.5 * c.pop;
    },
    build(k, o) {
      const potion = o.color;
      const glassTint = "#a9cbd6";
      const R = 0.5;
      const level = 0.08;
      const glass = (c) => {
        const rim = 1 - Math.abs(dot(c.n, VIEW));
        let col = mix(glassTint, "#ffffff", 0.6 * rim * rim);
        col = mix(col, [1, 1, 1], 0.9 * Math.pow(Math.max(0, dot(c.n, HALF)), 40));
        return col;
      };
      // The flask: a round body and a neck.
      k.add(
        k.lathe(
          [
            [0, -R],
            [0.28, -0.44],
            [0.46, -0.2],
            [0.5, 0.02],
            [0.42, 0.28],
            [0.2, 0.44],
            [0.13, 0.52],
            [0.12, 0.8],
            [0.15, 0.84],
          ],
          { grid: 96 },
        ),
        { flat: 0.15, opacity: 0.1, weight: 0.6, pattern: false, color: glass },
      );
      k.add(k.torus(0.14, 0.025), {
        pos: [0, 0.84, 0],
        flat: 0.2,
        weight: 1.5,
        opacity: 0.6,
        pattern: false,
        color: glass,
      });
      // The glowing potion inside.
      const liquid = [];
      for (let i = 0; i <= 12; i++) {
        const y = -0.47 + (i / 12) * (level + 0.47);
        const r =
          y < 0.02
            ? Math.sqrt(Math.max(0, 0.47 ** 2 - (y + 0.0) ** 2)) * (y < -0.2 ? 0.98 : 1)
            : 0.47;
        liquid.push([Math.min(r, 0.46), y]);
      }
      liquid.push([0, level]);
      k.add(k.lathe(liquid, { grid: 80 }), {
        flat: 0.25,
        kind: "twinkle",
        params: [0.05, 0],
        pattern: false,
        color: (c) => {
          const top = c.p[1] > level - 0.02;
          const glow = Math.pow(Math.max(0, dot(c.n, VIEW)), 1.5);
          const depth = clamp((level - c.p[1]) / 0.55, 0, 1);
          const col = mix(
            shade(potion, 0.72 + 0.2 * (1 - depth)),
            mix(potion, "#ffffff", 0.3),
            glow,
          );
          return keep(top ? mix(potion, "#ffffff", 0.4) : col);
        },
      });
      // Bubbles rising through it.
      k.cloud({ share: 0.006, size: 1.3, pattern: false }, (rand) => {
        const a = rand() * TAU;
        const r = 0.28 * Math.sqrt(rand());
        return {
          p: [Math.sin(a) * r, -0.42 + rand() * 0.2, Math.cos(a) * r],
          color: mix(potion, "#ffffff", 0.75),
          opacity: 0.9,
          kind: "rise",
          params: [0.16, rand()],
        };
      });
      // A cork that pops out, and a puff of sparkles.
      const cork = k.part("cork", { pivot: [0, 0.86, 0], axis: [0, 0, 1] });
      k.add(k.cone(0.105, 0.13, 0.2), {
        pos: [0, 0.88, 0],
        part: cork,
        flat: 0.2,
        weight: 1.5,
        color: (c) =>
          lit(
            mix("#c49a6c", "#8d6340", 0.5 + 0.4 * c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40)),
            c.n,
          ),
      });
      const puff = k.part("puff", { pivot: [0, 0.95, 0] });
      k.cloud({ share: 0.03, size: 1.3, part: puff, pattern: false }, (rand) => ({
        p: [(rand() - 0.5) * 0.2, 0.95 + rand() * 0.1, (rand() - 0.5) * 0.2],
        color: mix(potion, "#ffffff", 0.3 + 0.7 * rand()),
        opacity: 0.9,
        kind: "rise",
        params: [0.6 + 0.5 * rand(), rand()],
      }));
      k.reach([0, 1.45, 0]);
    },
  },

  telescope: {
    alive: true,
    density: 0.6,
    controls: [{ key: "open", label: "Extend", type: "toggle", default: 1, ease: 1.2 }],
    action: { key: "open", label: "Extend or collapse" },
    drive(t, c, out) {
      const e = ease3(c.open);
      const d = TELE.dir;
      out.parts.tube2 = { offset: mul(d, 0.3 * (1 - e)) };
      out.parts.tube3 = { offset: mul(d, 0.6 * (1 - e)) };
      out.body = { quat: quatAxisAngle([0, 1, 0], 0.1 * Math.sin(t * 0.4)) };
    },
    build(k) {
      const brass = "#d4a64a";
      const wood = "#6d4428";
      const { dir, mount } = TELE;
      const q = quatFromTo([0, 1, 0], dir);
      const seg = (from, to, r, part, col) =>
        k.add(k.cylinder(r, to - from, { caps: true }), {
          pos: add(mount, mul(dir, (from + to) / 2)),
          quat: q,
          part,
          flat: 0.15,
          color: (c) =>
            col ? lit(col, c.n, { amb: 0.6, dif: 0.5, spec: 0.4 }) : chrome(c.n, brass),
        });
      // The main tube, with the big lens at the far end.
      seg(-0.36, 0.56, 0.12, 0, "#2d3b55");
      seg(0.5, 0.64, 0.14, 0);
      seg(-0.4, -0.33, 0.13, 0);
      seg(0.02, 0.08, 0.125, 0);
      k.add(k.disc(0.12), {
        pos: add(mount, mul(dir, 0.645)),
        quat: q,
        weight: 2,
        pattern: false,
        color: (c) => keep(mix("#15305c", "#9ad1ff", 0.35 + 0.5 * Math.max(0, dot(c.n, HALF)))),
      });
      // Draw tubes that slide out towards the eye.
      const t2 = k.part("tube2", { pivot: mount });
      const t3 = k.part("tube3", { pivot: mount });
      seg(-0.68, -0.3, 0.095, t2);
      seg(-0.7, -0.65, 0.103, t2);
      seg(-0.98, -0.6, 0.068, t3);
      seg(-1.02, -0.95, 0.08, t3, "#2a2a2e");
      // Tripod.
      const top = add(mount, [0, -0.1, 0]);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.6;
        const foot = [Math.sin(a) * 0.6, -1.0, Math.cos(a) * 0.6];
        k.add(
          k.tube((tt) => add(top, mul(sub(foot, top), tt)), 0.026, { samples: 8, grid: 24 }),
          {
            flat: 0.2,
            weight: 1.3,
            color: (c) => lit(wood, c.n, { spec: 0.3 }),
          },
        );
      }
      k.add(k.sphere(0.075), { pos: top, weight: 2, color: (c) => chrome(c.n, brass) });
      k.add(k.cylinder(0.03, 0.12), {
        pos: add(top, [0, 0.07, 0]),
        weight: 2,
        color: (c) => chrome(c.n, brass),
      });
    },
  },
};
