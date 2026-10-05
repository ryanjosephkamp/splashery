// Lane Arcade, G9: Cast a Shadow, a shadow puzzle. A carved block hangs
// between a lamp and a wall. Turn it until its shadow on the wall matches
// the outline drawn there. Each block is carved so that from one way its
// shadow is a picture (a heart, a fish, a key...) and from the side another
// one, so most turns show a jumble.
//
// The shadow is made of splats too: every piece of the block casts its own
// dark splat on the wall, straight along the lamp's light, every frame.
//
// 2D: only the wall, as if you stood at the lamp (the block itself hidden):
// you turn it by its shadow alone. 3D: from the side, the lamp, the block
// and the wall all show.

import { crispModel } from "./arcade-crisp.js";

const N = 12; // the carving grid
const VOX = 0.075; // a piece's size
const WALL_Z = -0.75;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Pictures, 12 by 12 ("#" filled), top row first.
const PICS = {
  heart: ["............", "..##....##..", ".####..####.", "############", "############", "############", ".##########.", "..########..", "...######...", "....####....", ".....##.....", "............"], // prettier-ignore
  fish: ["............", "............", "....#####...", "..#########.", ".####.######", "############", "############", ".##########.", "..#########.", "....#####...", "............", "............"], // prettier-ignore
  key: ["............", ".####.......", "#....#......", "#....########", "#....#..#.#.", ".####...#.#.", "............", "............", "............", "............", "............", "............"], // prettier-ignore
  house: [".....##.....", "....####....", "...######...", "..########..", ".##########.", "############", ".##########.", ".###....###.", ".###....###.", ".###....###.", ".###....###.", "............"], // prettier-ignore
  star: [".....##.....", ".....##.....", "....####....", "############", ".##########.", "..########..", "...######...", "..########..", "..###..###..", ".###....###.", ".##......##.", "............"], // prettier-ignore
  tree: [".....##.....", "....####....", "...######...", "..########..", "...######...", "..########..", ".##########.", "############", ".....##.....", ".....##.....", "....####....", "............"], // prettier-ignore
  bird: ["............", "..##........", ".####.......", "#####....###", "..##########", "..#########.", "...#######..", "....####....", ".....#.#....", ".....#.#....", "............", "............"], // prettier-ignore
};
const PUZZLES = [
  ["heart", "star", "#c96f4a"],
  ["fish", "house", "#4f8cc9"],
  ["key", "tree", "#c9a74a"],
  ["house", "heart", "#8a6fc9"],
  ["star", "fish", "#4ac98a"],
  ["tree", "bird", "#c94a6f"],
  ["bird", "key", "#6fb0c9"],
];

const at = (pic, x, y) => (PICS[pic][y]?.[x] ?? ".") === "#";

export function createShadows(api) {
  return new Shadows(api);
}

class Shadows {
  constructor(api) {
    this.api = api;
    this.q = api.q;
    this.rand = api.rand;
  }

  // The carving: a piece wherever the front picture and the side picture
  // both say so (so the block casts one from the front, one from the side).
  carve(front, side) {
    const v = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        for (let z = 0; z < N; z++) {
          // the side picture is read across z
          if (at(front, x, y) && at(side, z, y)) v.push([x, y, z]);
        }
    // Pieces that a picture needs but the other leaves out still have to
    // cast: fill in so every front pixel has a piece somewhere behind it.
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (!at(front, x, y) || v.some((p) => p[0] === x && p[1] === y)) continue;
        v.push([x, y, Math.floor(N / 2)]);
      }
    return v.map(([x, y, z]) => [
      (x - (N - 1) / 2) * VOX,
      ((N - 1) / 2 - y) * VOX,
      (z - (N - 1) / 2) * VOX,
    ]);
  }

  reset() {
    this.level = 0;
    this.score = 0;
    this.over = false;
    this.startPuzzle();
  }

  startPuzzle() {
    const S = this.api.sprites;
    S.clear();
    const [front, side, color] = PUZZLES[this.level % PUZZLES.length];
    this.front = front;
    this.cells = this.carve(front, side);
    const low = this.api.profile === "low";
    const c0 = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
    // The block: a small wooden cube for each piece, crisp
    // (src/packs/arcade-crisp.js), and only the faces that show (a face
    // against a neighbor is left out).
    const key = (p) => p.map((v) => Math.round(v / VOX)).join(",");
    const has = new Set(this.cells.map(key));
    const fine = VOX / (low ? 6 : 9);
    this.blockModel = crispModel(
      (k) => {
        for (const p of this.cells) {
          let faces = "";
          for (const [
            f,
            d,
          ] of [["X", [1, 0, 0]], ["x", [-1, 0, 0]], ["Y", [0, 1, 0]], ["y", [0, -1, 0]], ["Z", [0, 0, 1]], ["z", [0, 0, -1]]]) // prettier-ignore
            if (!has.has(key([p[0] + d[0] * VOX, p[1] + d[1] * VOX, p[2] + d[2] * VOX])))
              faces += f;
          if (!faces) continue;
          k.box(VOX * 0.96, VOX * 0.96, VOX * 0.96, {
            pos: p,
            faces,
            color: (q, n) => {
              const f = 0.7 + 0.25 * n[1] + 0.1 * n[2] + 0.05 * n[0];
              const g = 0.95 + 0.05 * Math.sin(q[0] * 60 + q[1] * 23);
              return c0.map((v) => v * f * g);
            },
          });
        }
      },
      { fine, coarse: VOX / 3 },
    );
    // The wall sorts below the shadow and the outline on it.
    this.wall = S.add(this.wallModel());
    this.wall.sortBias = [0, 0, -0.15];
    this.lamp = S.add(this.lampModel(), { pos: [0, 0, 1.25] });
    this.block = S.add(this.blockModel);
    // The shadow: each piece's eight corners (pulled in a quarter of the
    // way) as small dark splats on the wall, so it takes the turned cube's
    // own outline, crisp.
    this.shadow = this.api.points(this.cells.length * 8, { size: VOX * 0.34, flat: 0.08 });
    for (let i = 0; i < this.cells.length * 8; i++) this.shadow.color(i, 0.12, 0.11, 0.13, 0.95);
    // The outline to match: the front picture's edge, drawn on the wall.
    const edge = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (!at(front, x, y)) continue;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          if (at(front, x + dx, y + dy)) continue;
          // the edge's middle, and its way along (across the step to the empty side)
          edge.push([
            (x - (N - 1) / 2 + dx * 0.5) * VOX,
            ((N - 1) / 2 - y - dy * 0.5) * VOX,
            dy,
            dx,
          ]);
        }
      }
    // The outline: a crisp line along each edge, just off the wall.
    this.outline = S.add(
      crispModel(
        (k) => {
          for (const [x, y, ex, ey] of edge)
            k.line([x - (ex * VOX) / 2, y - (ey * VOX) / 2, WALL_Z + 0.008], [x + (ex * VOX) / 2, y + (ey * VOX) / 2, WALL_Z + 0.008], 0.007, { color: [1, 0.92, 0.55] }); // prettier-ignore
        },
        { fine: 0.0035, coarse: 0.02 },
      ),
    );
    this.target = this.mask(this.q.qaxis([0, 1, 0], 0));
    // Start turned away: a random turn far from the answer.
    let q;
    do {
      q = this.q.qnorm([
        this.rand() - 0.5,
        this.rand() - 0.5,
        this.rand() - 0.5,
        this.rand() - 0.5,
      ]);
    } while (this.match(this.mask(q)) > 0.5);
    this.turn = q;
    this.spin = [0, 0];
    this.best = 0;
    this.solved = 0;
    this.t = 0;
    this.banner = {
      title: `Puzzle ${this.level + 1}`,
      lines: ["Turn the block until its shadow fills the outline."],
      until: 2.2,
    };
  }

  wallModel() {
    // a warm plaster wall, lit brightest where the lamp points
    return crispModel(
      (k) =>
        k.rect(1.6, 1.6, {
          pos: [0, 0, WALL_Z - 0.002],
          color: (p) => {
            const r = Math.hypot(p[0], p[1]);
            const f = 0.62 + 0.38 * Math.exp(-r * r * 1.6);
            return [0.93 * f, 0.88 * f, 0.8 * f];
          },
        }),
      { fine: 0.005, coarse: 0.03 },
    );
  }

  lampModel() {
    return this.api.kitModel(
      (k) => {
        k.add(k.sphere(0.06), { color: [1, 0.96, 0.8], even: true });
        k.add(k.cone(0.12, 0.05, 0.12, { caps: false }), { pos: [0, 0, 0.07], rot: [-90, 0, 0], color: [0.3, 0.3, 0.33], even: true }); // prettier-ignore
      },
      { count: 400 },
    );
  }

  // Where the shadow falls (the lamp's light is straight on, along -z),
  // as a 24 x 24 grid of the wall.
  mask(q) {
    const G = 24;
    const m = new Uint8Array(G * G);
    for (const p of this.cells) {
      const w = this.q.qrot(q, p);
      // A piece's center falls on a line between two cells, and it covers
      // one each side (rounded, so a hair's turn doesn't flip it across).
      const gx = Math.round((w[0] / (N * VOX) + 0.5) * G);
      const gy = Math.round((w[1] / (N * VOX) + 0.5) * G);
      for (let dy = -1; dy <= 0; dy++)
        for (let dx = -1; dx <= 0; dx++) {
          const x = gx + dx;
          const y = gy + dy;
          if (x >= 0 && y >= 0 && x < G && y < G) m[y * G + x] = 1;
        }
    }
    return m;
  }

  // How well a shadow fills the outline: shared over joined (0 to 1).
  match(m) {
    let both = 0;
    let any = 0;
    for (let i = 0; i < m.length; i++) {
      if (m[i] && this.target[i]) both++;
      if (m[i] || this.target[i]) any++;
    }
    return any ? both / any : 0;
  }

  step(dt, ctl) {
    this.t += dt;
    this.view = ctl.view;
    if (this.banner && (this.banner.until -= dt) <= 0) this.banner = null;
    if (this.solved) {
      // The block eases into the answer, then the next puzzle comes.
      this.turn = this.q.qslerp(this.turn, [0, 0, 0, 1], Math.min(1, dt * 4));
      if (this.t > this.solved + 2.2) {
        this.level++;
        this.startPuzzle();
      }
      return;
    }
    // Turning: keys and the pad spin it, a drag turns it under the finger.
    const inp = ctl.input;
    let yaw = inp.axis[0] * 1.6;
    let pitch = -inp.axis[1] * 1.6;
    let roll = (inp.isHeld("turnR") ? 1 : 0) - (inp.isHeld("turnL") ? 1 : 0);
    const ptr = inp.pointer;
    if (ptr?.down) {
      if (this.drag) {
        yaw += ((ptr.x - this.drag[0]) / dt) * 3.2;
        pitch += ((ptr.y - this.drag[1]) / dt) * 3.2;
      }
      this.drag = [ptr.x, ptr.y];
    } else this.drag = null;
    if (ctl.demo) {
      // The attract mode turns it slowly toward the answer.
      const d = this.q.qmul(
        [0, 0, 0, 1],
        [-this.turn[0], -this.turn[1], -this.turn[2], this.turn[3]],
      );
      const s = d[3] < 0 ? -1 : 1;
      yaw = clamp(d[1] * s * 4, -0.6, 0.6);
      pitch = clamp(d[0] * s * 4, -0.6, 0.6);
      roll = clamp((d[2] * s * 4) / 1.4, -0.6, 0.6);
    }
    const q = this.q;
    let t = this.turn;
    if (yaw) t = q.qmul(q.qaxis([0, 1, 0], yaw * dt), t);
    if (pitch) t = q.qmul(q.qaxis([1, 0, 0], pitch * dt), t);
    if (roll) t = q.qmul(q.qaxis([0, 0, 1], roll * 1.4 * dt), t);
    this.turn = q.qnorm(t);
    // Check the match a few times a second.
    if ((this.t * 10) % 1 < dt * 10) {
      const m = this.match(this.mask(this.turn));
      this.matchNow = m;
      if (m > this.best + 0.05)
        this.api.sound({ voice: "tine", f: 600 + 900 * m, vol: 0.15, decay: 0.3 });
      this.best = Math.max(this.best, m);
      if (m > 0.86) {
        this.solved = this.t;
        this.score += Math.max(10, Math.round(300 - this.t * 4));
        this.api.sound({ voice: "bell", notes: "C5 E5 G5 C6", step: 0.12, vol: 0.5 });
        this.banner = { title: "That's it!", lines: [`It casts a ${this.front}.`], until: 2.2 };
      }
    }
  }

  onView() {}

  render(view) {
    this.view = view;
    this.block.quat = this.turn;
    this.block.pos = [0, 0, 0];
    // In 2D you see only the wall: the block hides (you stand at the lamp).
    this.block.fade = clamp(view * 1.6 - 0.3, 0, 1);
    this.lamp.fade = clamp(view * 1.6 - 0.3, 0, 1);
    const h = VOX * 0.25;
    this.cells.forEach((p, i) => {
      for (let c = 0; c < 8; c++) {
        const w = this.q.qrot(this.turn, [p[0] + (c & 1 ? h : -h), p[1] + (c & 2 ? h : -h), p[2] + (c & 4 ? h : -h)]); // prettier-ignore
        // a little nearer the wall for pieces nearer it, so overlapping
        // shadow splats sort steadily
        this.shadow.set(i * 8 + c, w[0], w[1], WALL_Z + 0.002 + 0.0005 * (w[2] + 1));
      }
    });
    this.shadow.flush();
  }

  camera(view, aspect) {
    const d2 = this.api.fitDistance(1.5, 1.7, aspect);
    // 3D: from the side, the block and its shadow both in view (closer on
    // a tall screen, where the wide view left them small)
    const tall = aspect < 1;
    return {
      target: [
        lerp(0, tall ? -0.08 : 0, view),
        0.02,
        lerp(WALL_Z + 0.05, tall ? -0.32 : -0.15, view),
      ],
      yaw: lerp(0, tall ? 0.8 : 0.95, view),
      pitch: lerp(0, 0.25, view),
      distance: lerp(d2, tall ? this.api.fitDistance(2.05, 2.3, aspect) : this.api.fitDistance(2.9, 2.3, aspect), view), // prettier-ignore
    };
  }

  stats() {
    return {
      score: this.score,
      puzzle: this.level + 1,
      match: `${Math.round((this.matchNow ?? 0) * 100)}%`,
    };
  }

  status() {
    return {
      over: false,
      banner: this.banner ? { title: this.banner.title, lines: this.banner.lines } : null,
    };
  }
}
