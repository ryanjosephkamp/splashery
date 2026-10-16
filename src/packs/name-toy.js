// Lane PT1: Your name in splats, rebuilt to match Ryan Kamp's Toy Box name
// toy (portfolio/concepts/toybox, `buildName()` and `toybox()`): any typed
// text, emoji included, as thick rounded letters of soft splats, and Toy
// Box's five tools on a row over the stage. Spin turns it (and a tap pokes);
// Poke rings out from the touch, letter by letter; Paint dabs one of eight
// colors where it touches (the site's paint, kept in links), and "Wash it
// off" clears it; Drop breaks the letters into pieces that fall, bounce and
// pile up, and puts them back together; Blow pushes the letters away from a
// held finger. Every letter (and every piece of one) moves as a solid piece:
// a small rigid-body simulation here, sent to the GPU as tokens.
import { textSplats, cleanText, visibleCount, TEXT_FONT } from "../text-splats.js";
import { quatFromTo } from "../kit.js";
import { TOY_SOUNDS } from "../toy-sounds.js";
import { parseNotes } from "../voices.js";

// The letters' face, in one place: Fredoka, as in Toy Box (SIL OFL; the
// owner's OK of October 16, 2026), a subset at weight 700 vendored in
// vendor/fredoka/ and loaded only when this toy opens, before its letters
// are drawn. Other scripts and emoji fall back to the device's fonts.
const FACE = "Splashery Fredoka";
const FONT = { font: `"${FACE}", ${TEXT_FONT}`, round: false };
let fontLoad = null;
export function loadFont() {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve(false); // prettier-ignore
  fontLoad ||=
    new FontFace(FACE, `url(${new URL("../../vendor/fredoka/fredoka-700.woff2", import.meta.url)})`, { weight: "700" }) // prettier-ignore
      .load()
      .then((face) => {
        document.fonts.add(face);
        return true;
      })
      .catch(() => false);
  return fontLoad;
}

const MAX_LETTERS = 48; // one token per piece; 48 tokens at most
const DETAIL = [12000, 24000, 48000, 96000, 192000];
export const PAINTS = [
  { id: "pink", label: "Pink", hex: "#ff3d8b" },
  { id: "yellow", label: "Yellow", hex: "#ffd60a" },
  { id: "white", label: "White", hex: "#fffdf5" },
  { id: "orange", label: "Orange", hex: "#ff6a1f" },
  { id: "violet", label: "Violet", hex: "#6a2cff" },
  { id: "ink", label: "Ink", hex: "#1b1036" },
  { id: "sky", label: "Sky", hex: "#96f0ff" },
  { id: "red", label: "Red", hex: "#e81c2e" },
];
// Toy Box's letters: yellow, pink, white, orange, white, orange, pink, yellow.
const DEFAULT_COLORS = [1, 0, 2, 3, 2, 3, 0, 1];
export const TOOLS = [
  { id: "spin", label: "Spin" },
  { id: "poke", label: "Poke" },
  { id: "paint", label: "Paint" },
  { id: "drop", label: "Drop" },
  { id: "blow", label: "Blow" },
];
const TOOL_IDS = ["spin", "poke", "paint", "blow"];
const DEPTH = 0.17; // half the letters' thickness, in ems (Toy Box: 0.13 of 0.78)
const PAINT_R = 0.13;
// Toy Box's springs (K 46, damping 5.5) and gravity (7), in ems.
const K = 46;
const DAMP = 5.5;
const KR = 60;
const DR = 6.5;
const GRAV = 7;
const DT = 1 / 120;

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const hash = (i) => {
  let h = Math.imul(i + 0x9e3779b9, 747796405) >>> 0;
  h = Math.imul((h >>> ((h >>> 28) + 4)) ^ h, 277803737) >>> 0;
  return (((h >>> 22) ^ h) >>> 0) / 4294967296;
};
// A rotation vector (axis times angle) as a quaternion.
function rotQuat(r) {
  const a = Math.hypot(r[0], r[1], r[2]);
  if (a < 1e-9) return [0, 0, 0, 1];
  const s = Math.sin(a / 2) / a;
  return [r[0] * s, r[1] * s, r[2] * s, Math.cos(a / 2)];
}
function rotate(q, v) {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
}
const conj = (q) => [-q[0], -q[1], -q[2], q[3]];

// ---- Names -----------------------------------------------------------------------

export function readName(text) {
  const name = cleanText(text, 400);
  const n = visibleCount(name);
  if (!n) throw new Error("Type a name first.");
  if (n > MAX_LETTERS)
    throw new Error(`Use up to ${MAX_LETTERS} letters, digits, symbols, or emoji.`);
  return name;
}

const safeName = (text) => {
  try {
    return readName(text);
  } catch {
    return "RYAN KAMP";
  }
};

// Toy Box sets RYAN over KAMP; longer names wrap at spaces into rows a bit
// wider than tall.
const colsFor = (name) => Math.max(8, Math.ceil(Math.sqrt(visibleCount(name) * 2.6)));

export function nameBudget(budget, detail = "auto") {
  const requested =
    detail === "auto"
      ? budget <= 60000
        ? 24000
        : budget <= 140000
          ? 48000
          : 96000
      : Number(detail);
  const ceiling = Math.min(budget, DETAIL.includes(requested) ? requested : 96000);
  return DETAIL.filter((n) => n <= ceiling).at(-1) ?? Math.max(1, Math.floor(ceiling));
}

// Old links painted whole letters: one digit (0..7, a paint) or "." each.
function paintString(text, n) {
  return Array.from({ length: n }, (_, i) => (/^[0-7]$/.test(text?.[i]) ? text[i] : ".")).join("");
}
const paintIndex = (id) =>
  Math.max(
    0,
    PAINTS.findIndex((p) => p.id === id),
  );
const toolOf = (verb) => (TOOL_IDS.includes(verb) ? verb : "spin");

// ---- Pieces ----------------------------------------------------------------------

// Splits a letter's splats into `k` solid pieces (for Drop): seeded cells
// around k points spread over the letter's ink, a few rounds of Lloyd's
// relaxation, so the pieces are of a similar size.
function splitLetter(s, start, end, k, seed) {
  const pick = new Uint8Array(end - start);
  if (k <= 1) return pick;
  const sites = [];
  const step = (end - start) / k;
  for (let c = 0; c < k; c++) {
    const i = start + Math.floor((c + 0.5) * step * 0.999);
    sites.push([s.pos[i * 3], s.pos[i * 3 + 1]]);
  }
  // Start from points spread across the letter's box instead (Lloyd fixes the rest).
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (let i = start; i < end; i++) {
    x0 = Math.min(x0, s.pos[i * 3]);
    x1 = Math.max(x1, s.pos[i * 3]);
    y0 = Math.min(y0, s.pos[i * 3 + 1]);
    y1 = Math.max(y1, s.pos[i * 3 + 1]);
  }
  for (let c = 0; c < k; c++) {
    const a = (c / k) * Math.PI * 2 + hash(seed + c) * 0.8;
    sites[c] = [(x0 + x1) / 2 + Math.cos(a) * (x1 - x0) * 0.3, (y0 + y1) / 2 + Math.sin(a) * (y1 - y0) * 0.3]; // prettier-ignore
  }
  for (let round = 0; round < 6; round++) {
    const sum = sites.map(() => [0, 0, 0]);
    for (let i = start; i < end; i++) {
      const x = s.pos[i * 3];
      const y = s.pos[i * 3 + 1];
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < k; c++) {
        const d = (x - sites[c][0]) ** 2 + (y - sites[c][1]) ** 2;
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      pick[i - start] = best;
      sum[best][0] += x;
      sum[best][1] += y;
      sum[best][2]++;
    }
    sum.forEach((v, c) => {
      if (v[2]) sites[c] = [v[0] / v[2], v[1] / v[2]];
    });
  }
  return pick;
}

// ---- The name's layout and pieces (shared by build, taps and links) --------------

const layoutCache = new Map();
export function nameLayout(text, count = 12000) {
  const name = safeName(text);
  const key = `${name}|${count}`;
  if (layoutCache.has(key)) return layoutCache.get(key);
  const s = textSplats(name, { count, seed: 1999, cols: colsFor(name), depth: DEPTH, back: 0.35, ...FONT }); // prettier-ignore
  const L = s.layout.glyphs.length;
  const per = clamp(Math.floor(MAX_LETTERS / Math.max(1, L)), 1, 4);
  const letters = s.layout.glyphs.map((gl, i) => {
    const [start, end] = s.ranges[i];
    const split = splitLetter(s, start, end, per, i * 17 + 3);
    const pieces = Array.from({ length: per }, () => ({ sum: [0, 0, 0], n: 0, pts: [] }));
    for (let j = start; j < end; j++) {
      const p = pieces[split[j - start]];
      p.sum[0] += s.pos[j * 3];
      p.sum[1] += s.pos[j * 3 + 1];
      p.sum[2] += s.pos[j * 3 + 2];
      p.n++;
    }
    const used = pieces.filter((p) => p.n);
    const centers = used.map((p) => p.sum.map((v) => v / p.n));
    // A few outline points per piece, for its contact with the floor.
    const hulls = centers.map(() => new Array(16).fill(null));
    for (let j = start; j < end; j++) {
      const c = used.indexOf(pieces[split[j - start]]);
      const dx = s.pos[j * 3] - centers[c][0];
      const dy = s.pos[j * 3 + 1] - centers[c][1];
      const a = Math.floor(((Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1) * 16);
      const r = Math.hypot(dx, dy);
      if (!hulls[c][a] || r > hulls[c][a][2]) hulls[c][a] = [dx, dy, r];
    }
    const remap = pieces.map((p) => used.indexOf(p));
    return {
      char: gl.g,
      center: gl.center.slice(),
      box: gl.box.slice(),
      color: gl.color,
      start,
      end,
      split,
      remap,
      pieces: centers.map((c, k) => {
        const hull = hulls[k].filter(Boolean).map(([x, y]) => [x, y]);
        const inertia = hull.reduce((m, [x, y]) => m + x * x + y * y, 0) / Math.max(1, hull.length) / 2; // prettier-ignore
        return { center: c, hull, inertia: Math.max(0.004, inertia) };
      }),
    };
  });
  let token = 0;
  for (const l of letters) for (const p of l.pieces) p.token = token++;
  const pieceList = [];
  for (const l of letters) for (const p of l.pieces) pieceList[p.token] = p;
  const out = {
    name,
    pieceList,
    splats: s,
    letters,
    tokens: token,
    width: s.layout.width,
    height: s.layout.height,
    floor: -s.layout.height / 2 - 0.3,
  };
  if (layoutCache.size > 8) layoutCache.delete(layoutCache.keys().next().value);
  layoutCache.set(key, out);
  return out;
}

// The letter nearest a point (recipe units), from where it shows now.
function nearestLetter(sim, layout, p) {
  let best = 0;
  let bd = Infinity;
  layout.letters.forEach((l, i) => {
    const c = sim ? letterNow(sim, layout, i) : l.center;
    const d = Math.hypot(p[0] - c[0], p[1] - c[1]);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return { index: best, distance: bd };
}

// ---- The simulation --------------------------------------------------------------

function newSim(layout) {
  return {
    layout,
    t: null,
    letters: layout.letters.map(() => ({ d: [0, 0, 0], v: [0, 0, 0], r: [0, 0, 0], w: [0, 0, 0] })),
    pieces: layout.letters.flatMap(
      (l) =>
      l.pieces.map((p) => ({ free: false, pos: p.center.slice(), v: [0, 0, 0], a: 0, w: 0, z: 0, landed: false, sleep: false, start: 0 })), // prettier-ignore
    ),
    pokes: [],
    events: [],
    cues: [],
    dropped: false,
    returning: false,
    blow: null, // { at, until }
    gusts: [],
    nextWind: 0,
    lastTouch: -10,
    lastN: 0,
    sort: -1,
    moving: false,
    settled: 0,
    knocks: 0,
  };
}

// Where letter i's center is now.
function letterNow(sim, layout, i) {
  const l = layout.letters[i];
  if (sim.dropped || sim.returning) {
    const p = sim.pieces[l.pieces[0].token];
    if (p.free) {
      // The average of its pieces.
      const c = [0, 0, 0];
      for (const q of l.pieces) {
        const b = sim.pieces[q.token];
        for (let a = 0; a < 3; a++) c[a] += b.pos[a] / l.pieces.length;
      }
      return c;
    }
  }
  const b = sim.letters[i];
  return [l.center[0] + b.d[0], l.center[1] + b.d[1], l.center[2] + b.d[2]];
}

// Toy Box's name is a xylophone: one bar for each letter, up a major scale.
const SCALE = parseNotes("C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6").flat();
export function notesFor(layout) {
  return layout.letters.map((_, i) => SCALE[i % SCALE.length]);
}
const barCue = (layout, i) => ({ ...TOY_SOUNDS["name-toy"], f: notesFor(layout)[i] });

function touch(sim, time) {
  sim.lastTouch = time;
}

// A poke at point p (recipe units): a ring runs out from it (Toy Box's 3.4
// units a second), kicking each letter as it passes; the touched letter rings.
export function poke(sim, p, time) {
  if (sim.pokes.length > 5) sim.pokes.shift();
  const { index } = nearestLetter(sim, sim.layout, p);
  sim.pokes.push({ at: p.slice(), t0: time, hit: new Set(), first: index });
  sim.cues.push(barCue(sim.layout, index));
  touch(sim, time);
}

function kickLetter(sim, i, p, a, first) {
  const layout = sim.layout;
  const b = sim.letters[i];
  const c = letterNow(sim, layout, i);
  const rx = clamp(p[0] - c[0], -0.45, 0.45);
  const ry = clamp(p[1] - c[1], -0.5, 0.5);
  if (first) {
    // The touched letter jumps toward you and rocks away from the finger,
    // as Toy Box's splats pop out along their normals.
    b.v[2] += 1.5 * a;
    b.v[1] += 0.45 * a;
    b.w[0] += -ry * 3.2 * a;
    b.w[1] += rx * 3.2 * a;
    b.w[2] += (rx > 0 ? -1 : 1) * 0.9 * a;
  } else {
    // The ring passing: a smaller pop and hop away from the touch, and a turn.
    const dx = c[0] - p[0];
    const dy = c[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    b.v[0] += (dx / len) * 0.35 * a;
    b.v[1] += 0.45 * a + (dy / len) * 0.2 * a;
    b.v[2] += 0.7 * a;
    b.w[2] += (dx > 0 ? -1 : 1) * 1.2 * a;
  }
}

function kickPiece(sim, k, p, a) {
  const b = sim.pieces[k];
  const dx = b.pos[0] - p[0];
  const dy = b.pos[1] - p[1];
  const len = Math.hypot(dx, dy) || 1;
  b.v[0] += (dx / len) * 1.2 * a;
  b.v[1] += 2.4 * a + Math.max(0, dy / len) * a;
  b.w += (hash(k * 7 + sim.pokes.length) - 0.5) * 9 * a;
  b.sleep = false;
}

function paintHop(sim, i, time) {
  if (sim.dropped || sim.returning) return;
  // A little splash: the painted letter gives a small jump.
  const b = sim.letters[i];
  b.v[1] += 0.35;
  b.v[2] += 0.25;
  b.w[2] += (hash(i + Math.floor(time * 10)) - 0.5) * 1.2;
  touch(sim, time);
}

export function setDrop(sim, on, time) {
  if (on === sim.dropped) return;
  const layout = sim.layout;
  sim.dropped = on;
  touch(sim, time);
  if (on) {
    sim.returning = false;
    // Hand each piece the pose of its letter, then let it fall.
    layout.letters.forEach((l, i) => {
      const b = sim.letters[i];
      const q = rotQuat(b.r);
      for (const p of l.pieces) {
        const s = sim.pieces[p.token];
        const off = rotate(q, [p.center[0] - l.center[0], p.center[1] - l.center[1], p.center[2] - l.center[2]]); // prettier-ignore
        const at = [l.center[0] + b.d[0] + off[0], l.center[1] + b.d[1] + off[1], l.center[2] + b.d[2] + off[2]]; // prettier-ignore
        if (!s.free) {
          s.pos = at;
          s.v = [b.v[0] - b.w[2] * off[1], b.v[1] + b.w[2] * off[0], b.v[2]];
          s.a = b.r[2];
          s.w = b.w[2];
        }
        s.free = true;
        s.landed = false;
        s.sleep = false;
        // Pieces let go one after another, and spread a little in depth.
        s.start = time + hash(p.token * 13 + 1) * 0.55;
        s.z = (hash(p.token * 31 + 5) - 0.5) * 0.7;
      }
    });
  } else {
    sim.returning = true;
    for (const s of sim.pieces) {
      s.sleep = false;
      s.start = time + hash(s.pos[0] * 1000 + 3) * 0.2;
    }
    sim.cues.push({ voice: "breath", decay: 0.5, vol: 0.35, bright: 0.3 });
  }
}

function stepSim(sim, dt, time) {
  const layout = sim.layout;
  const floor = layout.floor;
  const wall = layout.width / 2 + 0.55;
  // Pokes: rings that kick letters (or loose pieces) as they pass.
  for (const pk of sim.pokes) {
    const r = (time - pk.t0) * 3.4;
    if (sim.dropped || sim.returning) {
      sim.pieces.forEach((s, k) => {
        if (pk.hit.has(k)) return;
        const d = Math.hypot(s.pos[0] - pk.at[0], s.pos[1] - pk.at[1]);
        if (d > r) return;
        pk.hit.add(k);
        if (time >= s.start) kickPiece(sim, k, pk.at, 0.9 * Math.exp(-1.6 * d));
      });
      continue;
    }
    layout.letters.forEach((l, i) => {
      if (pk.hit.has(i)) return;
      const c = letterNow(sim, layout, i);
      const d = Math.max(0, Math.hypot(c[0] - pk.at[0], c[1] - pk.at[1]) - 0.25);
      if (i !== pk.first && d > r) return;
      pk.hit.add(i);
      kickLetter(sim, i, pk.at, 2.4 * Math.exp(-1.3 * d), i === pk.first);
    });
  }
  sim.pokes = sim.pokes.filter((pk) => time - pk.t0 < 1.6);
  // Wind: a held finger (or a short gust) pushes away from itself.
  const winds = sim.gusts.filter((g) => time < g.until);
  if (sim.blow) winds.push(sim.blow);
  sim.gusts = sim.gusts.filter((g) => time < g.until);
  const windAt = (c, k) => {
    const f = [0, 0, 0];
    for (const g of winds) {
      const dx = c[0] - g.at[0];
      const dy = c[1] - g.at[1];
      const e = Math.exp(-(dx * dx + dy * dy) / 0.9) * (g.strength ?? 1);
      const tw = Math.sin(time * 11 + k * 1.7) * 0.5;
      f[0] += (dx * 2.4 + tw) * 22 * e;
      f[1] += (dy * 2.4 + tw * 0.6) * 22 * e;
      f[2] -= 8 * e;
    }
    return f;
  };
  // Letters on springs (the name standing).
  if (!sim.dropped && !sim.returning) {
    layout.letters.forEach((l, i) => {
      const b = sim.letters[i];
      const f = winds.length ? windAt(letterNow(sim, layout, i), i) : [0, 0, 0];
      for (let a = 0; a < 3; a++) {
        b.v[a] += (-K * b.d[a] - DAMP * b.v[a] + f[a]) * dt;
        b.d[a] += b.v[a] * dt;
        b.w[a] += (-KR * b.r[a] - DR * b.w[a]) * dt;
        b.r[a] += b.w[a] * dt;
      }
      if (winds.length) {
        b.w[2] += -f[0] * 0.25 * dt;
        b.w[0] += f[2] * 0.4 * dt;
      }
    });
    // Once everything is all but still, it is exactly home.
    if (!winds.length && !sim.pokes.length) {
      const still = sim.letters.every((b) => [b.d, b.v, b.r, b.w].every((x) => Math.hypot(...x) < 1e-3)); // prettier-ignore
      if (still)
        for (const b of sim.letters) {
          b.d = [0, 0, 0];
          b.v = [0, 0, 0];
          b.r = [0, 0, 0];
          b.w = [0, 0, 0];
        }
    }
    return;
  }
  // Loose pieces: falling and lying, or springing home.
  let home = 0;
  sim.pieces.forEach((s, k) => {
    const piece = layout.pieceList[k];
    if (time < s.start) return;
    if (sim.returning) {
      for (let a = 0; a < 3; a++) {
        const target = piece.center[a];
        s.v[a] += (-K * 0.8 * (s.pos[a] - target) - DAMP * 1.1 * s.v[a]) * dt;
        s.pos[a] += s.v[a] * dt;
      }
      const turn = Math.atan2(Math.sin(s.a), Math.cos(s.a));
      s.a = turn;
      s.w += (-KR * 0.6 * s.a - DR * s.w) * dt;
      s.a += s.w * dt;
      const off = Math.hypot(s.pos[0] - piece.center[0], s.pos[1] - piece.center[1], s.pos[2] - piece.center[2]); // prettier-ignore
      if (off < 0.004 && Math.hypot(...s.v) < 0.02 && Math.abs(s.a) < 0.004 && Math.abs(s.w) < 0.03)
        home++;
      return;
    }
    if (s.sleep) {
      if (!winds.length) return;
      s.sleep = false;
    }
    const f = winds.length ? windAt(s.pos, k) : [0, 0, 0];
    s.v[0] += (f[0] * 0.5 - 0.4 * s.v[0] * (s.landed ? 3 : 1)) * dt;
    s.v[1] += (f[1] * 0.3 - GRAV) * dt;
    s.v[2] += ((s.z - s.pos[2]) * 6 - 2.5 * s.v[2]) * dt;
    s.pos[0] += s.v[0] * dt;
    s.pos[1] += s.v[1] * dt;
    s.pos[2] += s.v[2] * dt;
    s.a += s.w * dt;
    s.w *= Math.exp(-(s.landed ? 2.5 : 0.3) * dt);
    // The floor: the lowest outline point, with a contact impulse that
    // makes a piece rock and come to lie on a side.
    const ca = Math.cos(s.a);
    const sa = Math.sin(s.a);
    let low = null;
    for (const [x, y] of piece.hull) {
      const rx = x * ca - y * sa;
      const ry = x * sa + y * ca;
      if (!low || ry < low[1]) low = [rx, ry];
    }
    const bottom = s.pos[1] + (low ? low[1] : -0.1);
    const ground = floor + 0.03 * hash(k * 3 + 1);
    if (bottom < ground) {
      s.pos[1] += ground - bottom;
      const [rx, ry] = low;
      const I = piece.inertia;
      const vcy = s.v[1] + s.w * rx;
      if (vcy < 0) {
        if (!s.landed || vcy < -1.2) {
          if (sim.knocks < 40 && -vcy > 0.6)
            sim.cues.push({ voice: "wood", f: 380 + 260 * hash(k * 5 + sim.knocks), decay: 0.35, vol: clamp(-vcy * 0.12, 0.08, 0.4) }); // prettier-ignore
          sim.knocks++;
        }
        const e = s.landed ? 0.15 : 0.42 * (0.5 + 0.5 * hash(k * 11));
        const j = (-(1 + e) * vcy) / (1 + (rx * rx) / I);
        s.v[1] += j;
        s.w += (j * rx) / I;
        // Friction at the contact.
        const vcx = s.v[0] - s.w * ry;
        const jt = clamp(-vcx / (1 + (ry * ry) / I), -0.6 * j, 0.6 * j);
        s.v[0] += jt;
        s.w -= (jt * ry) / I;
        s.landed = true;
      }
      // Gravity's turn about the contact rolls it onto a flat side.
      s.w += -rx * GRAV * 0.6 * dt / Math.max(0.02, piece.inertia + rx * rx); // prettier-ignore
      if (Math.hypot(s.v[0], s.v[1]) < 0.03 && Math.abs(s.w) < 0.05 && !winds.length)
        s.sleep = true;
    }
    if (s.pos[0] < -wall || s.pos[0] > wall) {
      s.pos[0] = clamp(s.pos[0], -wall, wall);
      s.v[0] *= -0.4;
    }
  });
  if (sim.returning && home === sim.pieces.length) {
    sim.returning = false;
    for (const s of sim.pieces) {
      s.free = false;
      s.v = [0, 0, 0];
      s.w = 0;
      s.a = 0;
    }
    for (const b of sim.letters) {
      b.d = [0, 0, 0];
      b.v = [0, 0, 0];
      b.r = [0, 0, 0];
      b.w = [0, 0, 0];
    }
  }
}

// The tokens for the pieces as they stand.
function tokensOf(sim) {
  const layout = sim.layout;
  const out = new Array(layout.tokens);
  layout.letters.forEach((l, i) => {
    const b = sim.letters[i];
    const q = rotQuat(b.r);
    for (const p of l.pieces) {
      const s = sim.pieces[p.token];
      if (s.free) {
        out[p.token] = {
          base: p.center,
          offset: [s.pos[0] - p.center[0], s.pos[1] - p.center[1], s.pos[2] - p.center[2]],
          quat: rotQuat([0, 0, s.a]),
        };
        continue;
      }
      const off = rotate(q, [p.center[0] - l.center[0], p.center[1] - l.center[1], p.center[2] - l.center[2]]); // prettier-ignore
      out[p.token] = {
        base: p.center,
        offset: [l.center[0] + b.d[0] + off[0] - p.center[0], l.center[1] + b.d[1] + off[1] - p.center[1], l.center[2] + b.d[2] + off[2] - p.center[2]], // prettier-ignore
        quat: q,
      };
    }
  });
  return out;
}

function energy(sim) {
  let e = 0;
  for (const b of sim.letters)
    for (let a = 0; a < 3; a++) e += b.d[a] ** 2 + b.v[a] ** 2 + b.r[a] ** 2 + b.w[a] ** 2;
  if (sim.dropped || sim.returning)
    for (const s of sim.pieces) if (!s.sleep) e += Math.hypot(...s.v) + Math.abs(s.w);
  return e;
}

// ---- The toy's live state (the last one built in the browser) --------------------

const ui = { tool: "spin", paint: 0 };
let live = null; // { sim, layout }
const browser = () => typeof window !== "undefined";

function pointOn(sim, p) {
  // The point on the letter under p, where that letter was built (paint
  // goes where the splats were made, as Toy Box paints splats' homes).
  const { index, distance } = nearestLetter(sim, sim.layout, p);
  const l = sim.layout.letters[index];
  let home;
  if (sim.dropped || sim.returning) {
    let best = l.pieces[0];
    let bd = Infinity;
    for (const pc of l.pieces) {
      const s = sim.pieces[pc.token];
      const d = Math.hypot(p[0] - s.pos[0], p[1] - s.pos[1]);
      if (d < bd) {
        bd = d;
        best = pc;
      }
    }
    const s = sim.pieces[best.token];
    const local = rotate(conj(rotQuat([0, 0, s.a])), [p[0] - s.pos[0], p[1] - s.pos[1], p[2] - s.pos[2]]); // prettier-ignore
    home = [best.center[0] + local[0], best.center[1] + local[1], best.center[2] + local[2]];
  } else {
    const b = sim.letters[index];
    const c = letterNow(sim, sim.layout, index);
    const local = rotate(conj(rotQuat(b.r)), [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
    home = [l.center[0] + local[0], l.center[1] + local[1], l.center[2] + local[2]];
  }
  // The face the viewer sees (the drag's plane faces the camera, not the
  // letters, so its depth is not the letter's).
  home[2] = (sim.eye && sim.eye[2] < 0 ? -1 : 1) * DEPTH;
  return { index, distance, home };
}

function paintAt(sim, p, time) {
  const { index, distance, home } = pointOn(sim, p);
  if (distance > 0.9) return null;
  const last = sim.lastDab;
  if (
    last &&
    last.c === ui.paint &&
    Math.hypot(...home.map((v, a) => v - last.at[a])) < PAINT_R * 0.45 &&
    time - last.t < 0.5
  )
    // prettier-ignore
    return { control: "play", value: 0 };
  sim.lastDab = { at: home, c: ui.paint, t: time };
  touch(sim, time);
  if (!sim.lastSquish || time - sim.lastSquish > 0.09) {
    sim.cues.push({ voice: "squish", pitch: 0.8 + 0.4 * hash(Math.floor(time * 50)), decay: 0.35, vol: 0.4 }); // prettier-ignore
    sim.lastSquish = time;
  }
  return { paint: { at: home, radius: PAINT_R, color: PAINTS[ui.paint].hex } };
}

function gust(sim, p, time) {
  sim.gusts.push({ at: p.slice(), until: time + 0.55, strength: 1.2 });
  sim.cues.push({ voice: "wind", decay: 0.5, vol: 0.22, bright: 0.25 });
  touch(sim, time);
}

// The Play button (and a tap with no point): the tool on a seeded spot.
function playTool(sim, n, time) {
  const layout = sim.layout;
  const i = Math.floor(hash(n * 7919 + 11) * layout.letters.length);
  const c = letterNow(sim, layout, i);
  const p = [c[0] + (hash(n * 13) - 0.5) * 0.3, c[1] + (hash(n * 17) - 0.5) * 0.3, DEPTH];
  if (ui.tool === "blow") gust(sim, p, time);
  else poke(sim, p, time);
}

export const RECIPES = {
  "name-toy": {
    alive: true,
    turntable: false,
    tiltLock: true,
    seed: 1999,
    options: [
      { key: "name", label: "Your name", type: "text", default: "RYAN KAMP", hidden: true },
      // Kept for older links: the tool a link was made with, and its paint.
      {
        key: "verb",
        label: "Tool",
        type: "select",
        default: "spin",
        hidden: true,
        choices: ["spin", "poke", "paint", "drop", "blow"].map((id) => ({ id, label: id })),
      },
      { key: "color", label: "Paint color", type: "select", default: "pink", hidden: true, choices: PAINTS }, // prettier-ignore
      { key: "paints", label: "Painted letters", type: "text", default: "", hidden: true },
      {
        key: "detail",
        label: "Detail",
        type: "select",
        default: "auto",
        choices: [
          { id: "auto", label: "Auto (this device)" },
          ...DETAIL.map((n) => ({ id: String(n), label: `${n.toLocaleString("en-US")} splats` })),
        ],
      },
    ],
    controls: [{ key: "play", label: "Play", type: "pulse", ease: 3.4, pausable: false }],
    // Fredoka before the first build, so a link rebuilds the same letters.
    async prepare() {
      await loadFont();
    },
    action: {
      key: "play",
      label: "Use the tool",
      // Every sound comes from the drive, in time with what it shows.
      quiet: ["play"],
      at(point) {
        const layout = live?.sim.layout;
        if (!layout) return { key: "play" };
        return { key: "play", pick: nearestLetter(live.sim, layout, point).index };
      },
    },
    toolbar: {
      label: "Things to do to the name",
      items() {
        const dropped = !!live?.sim.dropped;
        return [
          ...TOOLS.map((t) => ({
            id: t.id,
            text: t.label,
            label: t.id === "drop" ? (dropped ? "Put it back together" : "Drop it") : `${t.label} tool`, // prettier-ignore
            pressed: t.id === "drop" ? dropped : ui.tool === t.id,
          })),
          ...PAINTS.map((p, i) => ({
            id: `paint-${p.id}`,
            text: p.label,
            label: `Paint ${p.label.toLowerCase()}`,
            color: p.hex,
            pressed: ui.paint === i,
            hidden: ui.tool !== "paint",
          })),
          {
            id: "wash",
            text: "Wash it off",
            label: "Wash the paint off",
            hidden: ui.tool !== "paint",
          },
        ];
      },
      activate(id, time) {
        if (TOOL_IDS.includes(id)) ui.tool = id;
        else if (id === "drop") {
          if (live) setDrop(live.sim, !live.sim.dropped, time);
        } else if (id.startsWith("paint-")) ui.paint = paintIndex(id.slice(6));
        else if (id === "wash") return { clearPaint: true };
        return null;
      },
    },
    drag: {
      plane: "view",
      at: () => !!live && ui.tool !== "spin",
      start(p, time) {
        if (!live) return null;
        const sim = live.sim;
        touch(sim, time);
        sim.drag = { last: time, at: p.slice(), t0: time, moved: 0 };
        // The press acts at once (Toy Box pokes and paints on touch); the
        // tap the app reports when it lets go is then not a second one.
        sim.press = { at: p.slice(), t: time };
        if (ui.tool === "paint") return paintAt(sim, p, time);
        if (ui.tool === "poke") poke(sim, p, time);
        if (ui.tool === "blow") {
          sim.blow = { at: p.slice(), strength: 1 };
          sim.nextWind = 0;
        }
        return null;
      },
      move(p, time) {
        if (!live?.sim.drag) return null;
        const sim = live.sim;
        touch(sim, time);
        const moved = Math.hypot(p[0] - sim.drag.at[0], p[1] - sim.drag.at[1]);
        sim.drag.moved = Math.max(sim.drag.moved, moved);
        if (ui.tool === "paint") return paintAt(sim, p, time);
        if (ui.tool === "blow") {
          sim.blow = { at: p.slice(), strength: 1 };
          return null;
        }
        // Poke: every touch along the way rings out (Toy Box: every 0.11 s).
        if (ui.tool === "poke" && moved > 0.02 && time - sim.drag.last > 0.11) {
          sim.drag.last = time;
          sim.drag.at = p.slice();
          poke(sim, p, time);
          return { control: "play", value: 0 };
        }
        return null;
      },
      end(time) {
        if (!live) return;
        const sim = live.sim;
        const drag = sim.drag;
        sim.drag = null;
        if (sim.blow) {
          // A short press is a gust, like Toy Box's tap.
          if (drag && time - drag.t0 < 0.3 && drag.moved < 0.05) gust(sim, sim.blow.at, time);
          sim.blow = null;
          touch(sim, time);
        }
      },
    },
    input: {
      title: "Your name",
      placeholder: "Type a name, emoji too…",
      button: "Make my toy",
      accept: ".txt,text/plain",
      fileButton: "Open a name from a text file…",
      note: "Type anything: any language, digits, symbols, and emoji (flags and skin tones too), up to 48 characters. Pick a tool on the stage. Spin turns it, and a tap pokes it. Poke rings out from where you touch. Paint dabs a color where you drag; Wash it off clears it. Drop breaks the letters into pieces, and Drop again puts them back. Blow pushes the letters away while you hold. The name and the paint stay in the scene link.",
      async read(text) {
        return { name: readName(text), paints: "" };
      },
      shown: () => {
        const layout = live?.sim.layout;
        if (!layout) return "";
        return `${layout.name.replace(/\n/g, " ")} · ${layout.letters.length} solid letters · ${live.count?.toLocaleString("en-US") ?? ""} splats`; // prettier-ignore
      },
    },
    credits: [
      {
        label: "Your name in splats",
        title: "Original procedural letters",
        author: "Made by Ryan with Claude (Opus 5.5)",
        license: "CC0 1.0",
        changes:
          "From Ryan Kamp's Toy Box name toy. Letters drawn with the device's own fonts. Code is MIT; procedural shapes are CC0.",
      },
    ],
    drive(t, c, out, info) {
      const data = info?.data;
      if (!data?.sim) return;
      const sim = data.sim;
      const time = info.time ?? t;
      if (browser() && data.live) live = data.live;
      if (info.eye) sim.eye = info.eye;
      if (sim.t === null || time < sim.t) sim.t = time;
      // Taps since the last frame: a point pokes (or paints, or blows) there;
      // the Play button uses the tool on a seeded spot.
      const taps = info.taps?.length ? info.taps : info.tap ? [info.tap] : [];
      for (const tap of taps) {
        if (!tap || tap.n <= sim.lastN || tap.key !== "play") continue;
        sim.lastN = tap.n;
        if (!tap.point) {
          playTool(sim, tap.n, time);
          continue;
        }
        // A press the toy's own drag already played (poke, paint, blow).
        const press = sim.press;
        sim.press = null;
        if (press && ui.tool !== "spin" && time - press.t < 1.5) continue;
        poke(sim, tap.point, time);
      }
      // Wind while a finger blows: a quiet, overlapping breath.
      if (sim.blow && time >= sim.nextWind) {
        sim.cues.push({ voice: "wind", decay: 0.7, vol: 0.18, bright: 0.25 });
        sim.nextWind = time + 0.45;
      }
      // Fixed steps, so the same taps always play the same way.
      const steps = Math.min(40, Math.floor((time - sim.t) / DT));
      for (let s = 0; s < steps; s++) {
        sim.t += DT;
        stepSim(sim, DT, sim.t);
      }
      if (time - sim.t > 0.5) sim.t = time;
      out.tokens = tokensOf(sim);
      if (sim.cues.length) {
        out.cues.push(...sim.cues);
        sim.cues = [];
      }
      // Toy Box sways the name gently once it is left alone.
      const idle = time - sim.lastTouch - 2.6;
      if (idle > 0 && !sim.dropped && !sim.returning) {
        const ease = 1 - Math.exp(-idle * 0.8);
        out.body = { quat: rotQuat([0, 0.42 * ease * Math.sin(idle * 0.7), 0]) };
      }
      // Sort again once loose pieces have settled where they lie (the
      // standing letters keep the order they were built in).
      const resting = (sim.dropped || sim.returning) && energy(sim) < 1e-4;
      const sort = sim.dropped || sim.returning ? (resting ? 1 : 0) : -1;
      out.resort = (sort === 1 && sim.sort !== 1) || (sort === -1 && !!sim.looseSorted);
      if (sort === 1) sim.looseSorted = true;
      else if (sort === -1) sim.looseSorted = false;
      sim.sort = sort;
    },
    build(k, o) {
      const name = safeName(o.name);
      const count = nameBudget(k.count, o.detail);
      k.count = count;
      const layout = nameLayout(name, count);
      const n = layout.letters.length;
      const paints = paintString(o.paints, n);
      const colors = layout.letters.map(
        (_, i) =>
        rgbOf(PAINTS[paints[i] === "." ? DEFAULT_COLORS[i % DEFAULT_COLORS.length] : Number(paints[i])].hex), // prettier-ignore
      );
      // A name built with other colors than the cached layout: same places, new colors.
      const s = textSplats(name, { count, seed: 1999, cols: colsFor(name), depth: DEPTH, back: 0.35, colorOf: (i) => colors[i], colorKey: paints, ...FONT }); // prettier-ignore
      // Keep the live simulation through a rebuild of the same name (detail,
      // paint), so nothing jumps.
      const same =
        live && live.sim.layout.name === name && live.sim.layout.tokens === layout.tokens;
      const sim = same && browser() ? live.sim : newSim(layout);
      sim.layout = layout;
      if (!same || !browser()) {
        ui.tool = toolOf(o.verb);
        ui.paint = paintIndex(o.color);
      }
      const holder = { sim, count };
      if (browser()) live = holder;
      k.data = { sim, live: holder, colors: colors.map((c) => c.slice()), layout };
      // Frame the floor the pieces drop to, and the gust's reach.
      const hw = layout.width / 2 + 0.3;
      k.reach([-hw, layout.floor - 0.25, 0]);
      k.reach([hw, layout.height / 2 + 0.25, 0]);
      k.reach([0, 0, 0.6]);
      k.reach([0, 0, -0.6]);
      k.cloud({ share: 1, jitter: 0, pattern: false }, (_, i) => {
        if (i >= s.n) return null;
        const j = i * 3;
        const g = s.glyph[i];
        const l = layout.letters[g];
        const piece = l.pieces[l.remap[l.split[i - l.start]]];
        const sg = s.sigma[i] * 0.9;
        const nrm = [s.nrm[j], s.nrm[j + 1], s.nrm[j + 2]];
        return {
          p: [s.pos[j], s.pos[j + 1], s.pos[j + 2]],
          scales: [sg, sg, sg * 0.3],
          quat: quatFromTo([0, 0, 1], nrm),
          color: [s.col[j], s.col[j + 1], s.col[j + 2]],
          opacity: 1,
          kind: "token",
          params: [piece.token, 0],
        };
      });
    },
  },
};
