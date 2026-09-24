// Games: a chess set that plays a real game. Loaded on demand.
//
// Every piece is its own token (behaviour "token"), so all 32 can slide,
// hop, leave the board when captured and tip over at the end. The game is
// Paul Morphy against the Duke of Brunswick and Count Isouard, Paris 1858
// (the "Opera Game"), a public-domain classic, move by move.

import { mix, shade, clamp, quatAxisAngle } from "../kit.js";

const TAU = Math.PI * 2;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const keep = (c, size) => ({ c, keep: true, size });
const band = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// Baked light: a key light from above, front and right, plus a sheen.
const LIGHT = unit([0.4, 0.85, 0.55]);
const VIEW = unit([0.5, 0.35, 0.8]);
const HALF = unit([LIGHT[0] + VIEW[0], LIGHT[1] + VIEW[1], LIGHT[2] + VIEW[2]]);
function lit(col, n, { amb = 0.6, dif = 0.48, spec = 0.3, pow = 30 } = {}) {
  let c = shade(col, amb + dif * Math.max(0, dot(n, LIGHT)));
  if (spec > 0) c = mix(c, [1, 1, 1], spec * Math.pow(Math.max(0, dot(n, HALF)), pow));
  return c;
}

// ---- The board and the game ---------------------------------------------------------

const S = 0.2; // one square
const FILES = "abcdefgh";
// Square name -> board point (white at +z, nearest the home camera).
export function squareAt(sq) {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]) - 1;
  return [(f - 3.5) * S, 0, (3.5 - r) * S];
}

// The start position: square -> piece ("wP" = white pawn).
const BACK = "RNBQKBNR";
export function startPosition() {
  const pos = {};
  for (let f = 0; f < 8; f++) {
    const file = FILES[f];
    pos[`${file}1`] = `w${BACK[f]}`;
    pos[`${file}2`] = "wP";
    pos[`${file}7`] = "bP";
    pos[`${file}8`] = `b${BACK[f]}`;
  }
  return pos;
}

// Morphy v Duke Karl of Brunswick and Count Isouard, Paris 1858:
// 1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7
// 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7
// 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8# (1-0).
// Each ply as from-to squares; castling also moves the rook.
export const OPERA_GAME = [
  ["e2", "e4"], ["e7", "e5"],
  ["g1", "f3"], ["d7", "d6"],
  ["d2", "d4"], ["c8", "g4"],
  ["d4", "e5"], ["g4", "f3"],
  ["d1", "f3"], ["d6", "e5"],
  ["f1", "c4"], ["g8", "f6"],
  ["f3", "b3"], ["d8", "e7"],
  ["b1", "c3"], ["c7", "c6"],
  ["c1", "g5"], ["b7", "b5"],
  ["c3", "b5"], ["c6", "b5"],
  ["c4", "b5"], ["b8", "d7"],
  ["e1", "c1", "a1", "d1"], ["a8", "d8"],
  ["d1", "d7"], ["d8", "d7"],
  ["h1", "d1"], ["e7", "e6"],
  ["b5", "d7"], ["f6", "d7"],
  ["b3", "b8"], ["d7", "b8"],
  ["d1", "d8"],
]; // prettier-ignore

// Plays the plies on a position; returns the position after each ply and
// what each ply captured.
export function replay(plies) {
  let pos = startPosition();
  const after = [];
  const captured = [];
  for (const [from, to, rf, rt] of plies) {
    const next = { ...pos };
    if (!next[from]) throw new Error(`No piece on ${from}`);
    captured.push(next[to] || null);
    if (next[to] && next[to][0] === next[from][0]) throw new Error(`${from}-${to} takes its own piece`); // prettier-ignore
    next[to] = next[from];
    delete next[from];
    if (rf) {
      next[rt] = next[rf];
      delete next[rf];
    }
    after.push(next);
    pos = next;
  }
  return { after, captured };
}

// A position as the piece-placement field of a FEN string.
export function toFen(pos) {
  const rows = [];
  for (let r = 8; r >= 1; r--) {
    let row = "";
    let gap = 0;
    for (const f of FILES) {
      const p = pos[`${f}${r}`];
      if (!p) gap++;
      else {
        if (gap) row += gap;
        gap = 0;
        row += p[0] === "w" ? p[1] : p[1].toLowerCase();
      }
    }
    if (gap) row += gap;
    rows.push(row);
  }
  return rows.join("/");
}

// Token numbers: each piece of the start position gets one (white 0-15,
// black 16-31), and keeps it as it moves.
const START = startPosition();
const TOKENS = Object.keys(START)
  .sort((a, b) => (START[a][0] === START[b][0] ? (a < b ? -1 : 1) : START[a][0] === "w" ? -1 : 1))
  .map((sq, i) => ({ id: i, home: sq, piece: START[sq] }));

// Where each token stands after every ply: a square, or a place beside the
// board once captured (white's captures on the right, black's on the left).
function timeline(plies) {
  const at = TOKENS.map((t) => t.home);
  const out = [TOKENS.map((t) => ({ sq: t.home, off: null }))];
  const trays = { w: 0, b: 0 };
  let state = out[0].map((x) => ({ ...x }));
  for (const [from, to, rf, rt] of plies) {
    state = state.map((x) => ({ ...x }));
    const mover = at.indexOf(from);
    const victim = at.indexOf(to);
    let taken = -1;
    if (victim >= 0) {
      // The capturing side keeps the piece: a row beside the board.
      const side = TOKENS[mover].piece[0];
      const n = trays[side]++;
      const x = (side === "w" ? 5.1 : -5.1) * S;
      const z = (side === "w" ? 3.5 - n * 0.9 : -3.5 + n * 0.9) * S;
      state[victim] = { sq: null, off: [x, 0, z] };
      at[victim] = null;
      taken = victim;
    }
    state[mover] = { sq: to, off: null };
    at[mover] = to;
    let rook = -1;
    if (rf) {
      rook = at.indexOf(rf);
      state[rook] = { sq: rt, off: null };
      at[rook] = rt;
    }
    state.moved = mover;
    state.rook = rook;
    state.taken = taken;
    out.push(state);
  }
  return out;
}

const PLY = 1.35; // seconds per move
const MOVE = 0.8; // seconds a piece takes to move
const point = (s) => (s.sq ? squareAt(s.sq) : s.off);

// ---- Piece shapes ---------------------------------------------------------------
// Profiles are [radius, height] pairs in squares, from the base up.

const BASE = [
  [0, 0],
  [0.36, 0],
  [0.37, 0.05],
  [0.34, 0.09],
  [0.3, 0.11],
  [0.28, 0.14],
];
const PROFILE = {
  P: [...BASE, [0.2, 0.2], [0.13, 0.36], [0.11, 0.44], [0.2, 0.47], [0.2, 0.5], [0.11, 0.53], [0.16, 0.6], [0.17, 0.68], [0.14, 0.76], [0.07, 0.81], [0, 0.82]], // prettier-ignore
  R: [...BASE, [0.24, 0.22], [0.21, 0.3], [0.2, 0.62], [0.23, 0.68], [0.27, 0.72], [0.27, 0.86], [0.2, 0.86], [0.19, 0.8], [0, 0.8]], // prettier-ignore
  N: [...BASE, [0.26, 0.2], [0.22, 0.26], [0.26, 0.3], [0.2, 0.33], [0, 0.34]],
  B: [...BASE, [0.22, 0.22], [0.15, 0.4], [0.11, 0.6], [0.21, 0.64], [0.21, 0.67], [0.12, 0.7], [0.17, 0.8], [0.18, 0.92], [0.13, 1.04], [0.05, 1.1], [0.07, 1.14], [0.06, 1.18], [0, 1.19]], // prettier-ignore
  Q: [...BASE, [0.24, 0.22], [0.16, 0.42], [0.12, 0.72], [0.24, 0.77], [0.24, 0.8], [0.14, 0.84], [0.15, 0.94], [0.24, 1.14], [0.2, 1.17], [0.11, 1.18], [0.07, 1.22], [0.08, 1.27], [0.05, 1.3], [0, 1.31]], // prettier-ignore
  K: [...BASE, [0.24, 0.22], [0.16, 0.42], [0.13, 0.76], [0.25, 0.81], [0.25, 0.84], [0.15, 0.88], [0.17, 1.0], [0.23, 1.16], [0.2, 1.2], [0, 1.21]], // prettier-ignore
};

// ---- Recipe ---------------------------------------------------------------------

const GAME = timeline(OPERA_GAME);
// Per-toy playing state (one chess set is shown at a time).
const play = { on: false, start: 0, stopAt: -99, snap: null, landed: -1 };

// Positions (offsets from home) of every token g seconds into the game.
function positionsAt(g) {
  const n = OPERA_GAME.length;
  const i = Math.min(n - 1, Math.max(0, Math.floor(g / PLY)));
  const f = band(g - i * PLY, 0, MOVE);
  const before = GAME[i];
  const after = GAME[i + 1];
  return TOKENS.map((t, k) => {
    const a = point(g < 0 ? GAME[0][k] : before[k]);
    const b = point(g < 0 ? GAME[0][k] : after[k]);
    const home = squareAt(t.home);
    let u = f;
    let lift = 0;
    if (k === after.taken) {
      // The captured piece is lifted off first and set down beside the board.
      u = band(f, 0, 0.55);
      lift = 0.9 * S * Math.sin(Math.PI * u);
    } else if (k === after.moved || k === after.rook) {
      // The mover arrives as the captured piece leaves; knights jump.
      u = after.taken >= 0 ? band(f, 0.35, 1) : f;
      const knight = t.piece[1] === "N";
      lift = (knight ? 0.7 : 0.12) * S * Math.sin(Math.PI * u);
    }
    const e = easeInOut(u);
    const p = [a[0] + (b[0] - a[0]) * e, lift, a[2] + (b[2] - a[2]) * e];
    return [p[0] - home[0], p[1], p[2] - home[2]];
  });
}

const CLACK = (f, vol = 1) => ({ voice: "wood", f, decay: 0.8, vol });

export const RECIPES = {
  "chess-set": {
    // Frames keep coming while the game plays or the pieces go home.
    alive: (c) => c.play > 0 || play.snap !== null,
    controls: [{ key: "play", label: "Play", type: "toggle", default: 0, ease: 0.2 }],
    action: { key: "play", label: "Play the Opera Game" },
    drive(t, c, out, info) {
      const now = info.time;
      const want = c.play > 0.5;
      if (want && !play.on) {
        Object.assign(play, { on: true, start: now, snap: null, landed: -1 });
      } else if (!want && play.on) {
        play.on = false;
        play.snap = positionsAt(now - play.start);
        play.stopAt = now;
      }
      let offs;
      let quats = null;
      if (play.on) {
        const g = now - play.start;
        offs = positionsAt(g);
        // A clack as each piece lands; a second, lower one for a capture.
        const n = OPERA_GAME.length;
        const i = Math.floor(g / PLY);
        if (i < n && g - i * PLY >= MOVE && play.landed < i) {
          play.landed = i;
          out.cues.push(CLACK(620 + 90 * (i % 3), 1));
          if (GAME[i + 1].taken >= 0) out.cues.push({ ...CLACK(430, 0.8), at: 0.07 });
        }
        // Checkmate: the black king tips over.
        const done = g - (n - 1) * PLY - MOVE;
        if (done > 0.3) {
          const k = TOKENS.findIndex((x) => x.piece === "bK");
          const tip = (Math.PI / 2.2) * easeInOut(band(done, 0.3, 1.3));
          const home = squareAt(TOKENS[k].home);
          quats = { [k]: { quat: quatAxisAngle([1, 0, 0], -tip), base: [home[0], 0, home[2] - 0.3 * S] } }; // prettier-ignore
          if (play.landed < n) {
            play.landed = n;
            out.cues.push({ voice: "wood", f: 300, decay: 1.4, at: 0.6 });
          }
        }
      } else if (play.snap) {
        // Stopped: every piece glides home.
        const u = easeInOut(band(now - play.stopAt, 0, 1.2));
        offs = play.snap.map((d) => [d[0] * (1 - u), d[1] * (1 - u) + 0.3 * S * Math.sin(Math.PI * u), d[2] * (1 - u)]); // prettier-ignore
        if (u >= 1) play.snap = null;
      }
      if (!offs) return;
      out.tokens = offs.map((d, k) => ({ offset: d, ...(quats?.[k] || {}) }));
    },
    build(k) {
      const light = "#e9d3a4";
      const dark = "#7a4a2b";
      const frame = "#4a2a17";
      // The board: inlaid squares with fine grain, a walnut frame round them.
      const plane = (w) => k.param((u, v) => [(u - 0.5) * w, 0, (v - 0.5) * w], { grid: 64, normal: () => [0, 1, 0] }); // prettier-ignore
      k.add(plane(8 * S), {
        pos: [0, 0, 0],
        flat: 0.1,
        even: true,
        weight: 2.4,
        size: 1.5,
        opacity: 1,
        jitter: 0.008,
        color: (c) => {
          if (c.n[1] < 0.5) return null;
          const fx = Math.floor(c.p[0] / S + 4);
          const fz = Math.floor(c.p[2] / S + 4);
          const isLight = (fx + fz) % 2 === 0;
          // Grain runs along each square, alternating direction like inlay.
          const along = (fx + fz) % 2 === 0 ? c.p[0] : c.p[2];
          const across = (fx + fz) % 2 === 0 ? c.p[2] : c.p[0];
          const grain = 0.95 + 0.06 * c.noise(along * 3, across * 28, fx * 7 + fz);
          const col = shade(isLight ? light : dark, grain);
          // Splats shrink towards a square's edge, so the edges stay straight.
          const ex = 0.5 - Math.abs(((c.p[0] / S + 4) % 1) - 0.5);
          const ez = 0.5 - Math.abs(((c.p[2] / S + 4) % 1) - 0.5);
          const edge = Math.min(ex, ez);
          // A thin dark inlay line between squares, in small splats.
          if (edge < 0.022) return keep(lit("#3a2413", c.n, { spec: 0.1 }), 0.35);
          const size = 0.35 + 0.65 * Math.min(1, (edge - 0.022) / 0.12);
          return { c: lit(col, c.n, { spec: 0.35, pow: 40 }), keep: true, size };
        },
      });
      const B = 8 * S + 0.24;
      for (const [sx, sz, w, d] of [
        [0, 4 * S + 0.06, B, 0.12],
        [0, -4 * S - 0.06, B, 0.12],
        [4 * S + 0.06, 0, 0.12, 8 * S],
        [-4 * S - 0.06, 0, 0.12, 8 * S],
      ]) {
        k.add(k.box(w, 0.1, d), {
          pos: [sx, -0.04, sz],
          weight: 0.8,
          flat: 0.12,
          even: true,
          size: 1.3,
          jitter: 0.01,
          color: (c) => lit(shade(frame, 0.95 + 0.06 * c.noise(c.p[0] * 4, c.p[1] * 30, c.p[2] * 4)), c.n, { spec: 0.35 }), // prettier-ignore
        });
      }
      // The pieces: turned ivory and ebony, each one a token.
      const tone = { w: "#efe3c8", b: "#2a1d17" };
      for (const t of TOKENS) {
        const [side, kind] = t.piece;
        const home = squareAt(t.home);
        const col = tone[side];
        const face = side === "w" ? 180 : 0; // knights face the other side
        const opts = {
          kind: "token",
          params: [t.id, 0],
          flat: 0.2,
          even: true,
          weight: 4,
          size: 0.7,
          jitter: 0.008,
          pattern: false,
          interior: 0.05,
          core: col,
        };
        const surface = (c) => {
          // Rook battlements: four notches cut from the crown.
          if (kind === "R" && c.lp[1] > 0.74 * S && ((Math.atan2(c.lp[0], c.lp[2]) / TAU) * 8 + 8) % 2 < 0.55) return null; // prettier-ignore
          // Bishop's mitre slit.
          if (
            kind === "B" &&
            c.lp[1] > 0.88 * S &&
            c.lp[1] < 1.02 * S &&
            Math.abs(Math.atan2(c.lp[0], c.lp[2]) - 0.8) < 0.12
          )
            // prettier-ignore
            return keep(shade(col, side === "w" ? 0.55 : 0.4), 0.7);
          // Queen's crown points.
          if (kind === "Q" && c.lp[1] > 1.1 * S && c.lp[1] < 1.17 * S) {
            const a = ((Math.atan2(c.lp[0], c.lp[2]) / TAU) * 10 + 10) % 1;
            if (Math.abs(a - 0.5) > 0.3) return null;
          }
          return lit(col, c.n, side === "w" ? { spec: 0.35 } : { spec: 0.5, pow: 40, amb: 0.8 });
        };
        const prof = PROFILE[kind].map(([r, y]) => [r * S, y * S]);
        k.add(k.lathe(prof, { grid: 40 }), { ...opts, pos: home, color: surface });
        if (kind === "K") {
          // The cross on top.
          for (const [w, h] of [
            [0.06, 0.3],
            [0.22, 0.06],
          ])
            k.add(k.box(w * S, h * S, 0.06 * S), {
              ...opts,
              weight: 3,
              pos: [home[0], home[1] + (h > 0.2 ? 1.33 : 1.36) * S, home[2]],
              color: (c) => lit(col, c.n, { spec: 0.4 }),
            });
        }
        if (kind === "N") {
          // The horse's head: a neck, a head with a muzzle, ears and a mane.
          const pieceOf = (shape, pos, rot, color) =>
            k.add(shape, {
              ...opts,
              weight: 3,
              pos: [home[0] + pos[0], home[1] + pos[1], home[2] + pos[2]],
              rot: [rot[0], face + rot[1], rot[2]],
              color,
            });
          const body = (c) =>
            lit(col, c.n, side === "w" ? { spec: 0.35 } : { spec: 0.5, amb: 0.8 });
          const turn = (x, z) => (face ? [-x, z === undefined ? 0 : -z] : [x, z]);
          const at = (x, y, z) => {
            const [tx, tz] = turn(x, z);
            return [tx * S, y * S, tz * S];
          };
          pieceOf(k.ellipsoid(0.17 * S, 0.34 * S, 0.21 * S), at(0, 0.56, -0.04), [-18, 0, 0], body);
          pieceOf(k.ellipsoid(0.13 * S, 0.12 * S, 0.27 * S), at(0, 0.8, 0.16), [22, 0, 0], body);
          for (const ex of [-0.07, 0.07])
            pieceOf(k.cone(0.045 * S, 0.0, 0.14 * S), at(ex, 1.0, -0.06), [-10, 0, 0], body);
          // Mane: a darker ridge down the back of the neck.
          pieceOf(k.ellipsoid(0.05 * S, 0.3 * S, 0.06 * S), at(0, 0.66, -0.2), [-20, 0, 0], (c) =>
            lit(shade(col, side === "w" ? 0.8 : 1.4), c.n, { spec: 0.2 }),
          );
          // Eyes.
          for (const ex of [-0.1, 0.1])
            pieceOf(k.sphere(0.025 * S), at(ex, 0.86, 0.12), [0, 0, 0], () => keep(side === "w" ? "#3a2a1c" : "#8a7a6a", 0.6)); // prettier-ignore
        }
      }
      // Wooden trays beside the board for the captured pieces.
      for (const side of [1, -1]) {
        k.add(k.box(1.0 * S, 0.05, 8 * S), {
          pos: [side * 5.1 * S, -0.025, 0],
          weight: 0.9,
          flat: 0.12,
          even: true,
          size: 1.3,
          jitter: 0.01,
          color: (c) => {
            if (c.n[1] < -0.5) return null;
            const col = c.n[1] > 0.5 ? mix(frame, "#6b4428", 0.5) : frame;
            return lit(shade(col, 0.95 + 0.06 * c.noise(c.p[0] * 4, c.p[1] * 30, c.p[2] * 4)), c.n, { spec: 0.3 }); // prettier-ignore
          },
        });
      }
      k.reach([5.7 * S, 0.2, 0]);
      k.reach([-5.7 * S, 0.2, 0]);
    },
  },
};
