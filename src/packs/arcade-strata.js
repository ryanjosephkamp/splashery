// Lane Arcade, G3: Strata, falling stones in a deep well. Stone shapes of
// our own (most of them only work in 3D: a tripod, two screws, a plus)
// fall down a square shaft; move and turn each one as it falls, and fill a
// whole layer of the shaft to clear it. A cleared layer doesn't vanish: its
// stones crumble into rubble that falls and fades, and everything above
// drops into its place.
//
// The views: 3D looks down into the well from above its rim; 2D is the side
// view, looking straight in from the front (the rules don't change, the
// stones keep falling). The Well option sets its size: a deep 4 by 4 shaft,
// a wide 5 by 5 one, or a flat slot one stone deep, which plays like a
// classic flat game in either view.

import { evenRoundBox } from "./even.js";

const SHAPES = [
  // Each a list of cubes [x, y, z] around a center cube.
  { name: "tripod", cubes: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]], color: "#c8553d" }, // prettier-ignore
  { name: "left screw", cubes: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]], color: "#3f88c5" }, // prettier-ignore
  { name: "right screw", cubes: [[0, 0, 0], [-1, 0, 0], [-1, 1, 0], [-1, 1, 1]], color: "#44af69" }, // prettier-ignore
  { name: "bar", cubes: [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], color: "#e8c547" }, // prettier-ignore
  { name: "bend", cubes: [[0, 0, 0], [1, 0, 0], [0, 0, 1]], color: "#9b5de5" }, // prettier-ignore
  { name: "plus", cubes: [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]], color: "#f28f3b" }, // prettier-ignore
  { name: "pebble", cubes: [[0, 0, 0]], color: "#8d99ae" },
  { name: "slab", cubes: [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]], color: "#2ec4b6" }, // prettier-ignore
];
// Flat versions for the one-deep slot (all in the x-y plane).
const FLAT_SHAPES = [
  { name: "hook", cubes: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], color: "#c8553d" }, // prettier-ignore
  { name: "bar", cubes: [[-1, 0, 0], [0, 0, 0], [1, 0, 0]], color: "#e8c547" }, // prettier-ignore
  { name: "long bar", cubes: [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [2, 0, 0]], color: "#3f88c5" }, // prettier-ignore
  { name: "pebble", cubes: [[0, 0, 0]], color: "#8d99ae" },
  { name: "plus", cubes: [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]], color: "#f28f3b" }, // prettier-ignore
  { name: "cup", cubes: [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [-1, 1, 0], [1, 1, 0]], color: "#9b5de5" }, // prettier-ignore
  { name: "step", cubes: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0]], color: "#44af69" }, // prettier-ignore
];

const WELLS = {
  deep: { w: 4, d: 4, h: 12 },
  wide: { w: 5, d: 5, h: 11 },
  slot: { w: 8, d: 1, h: 14 },
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Turns: a quarter turn of a cube [x, y, z] about the y, x or z axis.
const TURN = {
  y: ([x, y, z]) => [z, y, -x],
  x: ([x, y, z]) => [x, -z, y],
  z: ([x, y, z]) => [-y, x, z],
};

export function createStrata(api) {
  return new Strata(api);
}

class Strata {
  constructor(api) {
    this.api = api;
    this.q = api.q;
    this.wellKind = WELLS[api.options.well] ? api.options.well : "deep";
    const W = WELLS[this.wellKind];
    this.W = W.w;
    this.D = W.d;
    this.H = W.h;
    this.shapes = this.D === 1 ? FLAT_SHAPES : SHAPES;
    this.cube = Math.min(1.7 / this.W, 1.9 / this.H, 1.7 / Math.max(1, this.D));
    this.cube = Math.min(this.cube, 2.0 / this.H);
    this.rand = api.rand;
    const low = api.profile === "low";
    const { kitModel, recolor } = api;
    const c = this.cube;
    // A carved stone: a rounded block with a lit top and darker sides.
    const stone = kitModel(
      (k) => {
        k.add(
          evenRoundBox(c * 0.94, c * 0.94, c * 0.94, Math.min(c * 0.94, c * 0.94, c * 0.94) * 0.3),
          {
            even: true,
            flat: 0.25,
            color: (cc) => {
              const f = 0.72 + 0.22 * cc.n[1] + 0.08 * cc.n[2] + 0.04 * cc.n[0];
              const grain = 1 + 0.07 * cc.noise(cc.p[0] * 60, cc.p[1] * 60, cc.p[2] * 60);
              return [f * grain, f * grain, f * grain];
            },
          },
        );
      },
      { count: low ? 90 : 150 },
    );
    this.models = this.shapes.map((s) => {
      const col = hex(s.color);
      return recolor(stone, (v) => [v[0] * col[0], v[1] * col[1], v[2] * col[2], 1]);
    });
    // The well: stone walls drawn as a frame of posts and a floor grid.
    const [Wx, Hy, Dz] = [this.W * c, this.H * c, this.D * c];
    this.wellModel = kitModel(
      (k) => {
        const e = c * 0.06;
        const wall = (sx, sy, sz, pos) =>
          k.add(k.box(sx, sy, sz), { pos, even: true, flat: 0.3, color: (cc) => { const f = 0.62 + 0.15 * cc.n[1]; return [0.42 * f, 0.4 * f, 0.38 * f]; } }); // prettier-ignore
        // the four corner posts and the rim
        for (const x of [-Wx / 2, Wx / 2])
          for (const z of [-Dz / 2, Dz / 2]) wall(e, Hy, e, [x, 0, z]);
        for (const z of [-Dz / 2, Dz / 2]) wall(Wx + e, e, e, [0, Hy / 2, z]);
        for (const x of [-Wx / 2, Wx / 2]) wall(e, e, Dz + e, [x, Hy / 2, 0]);
        // the floor, a grid of slabs
        k.add(k.box(Wx, e, Dz), {
          pos: [0, -Hy / 2 - e / 2, 0],
          even: true,
          flat: 0.3,
          color: (cc) => {
            const gx = Math.abs((((cc.p[0] + Wx / 2) / c) % 1) - 0.5);
            const gz = Math.abs((((cc.p[2] + Dz / 2) / c) % 1) - 0.5);
            const line = gx > 0.45 || gz > 0.45 ? 0.75 : 1;
            return [0.5 * line, 0.47 * line, 0.43 * line];
          },
        });
      },
      { count: low ? 2200 : 4000 },
    );
  }

  reset() {
    const S = this.api.sprites;
    S.clear();
    this.well = S.add(this.wellModel);
    this.grid = new Array(this.W * this.D * this.H).fill(null); // sprite per cell
    this.shards = [];
    this.score = 0;
    this.layers = 0;
    this.level = 1;
    this.over = false;
    this.next = this.pick();
    this.spawn();
    this.dropT = 0;
    this.fallEase = new Map();
  }

  pick() {
    return (this.rand() * this.shapes.length) | 0;
  }

  idx(x, y, z) {
    return x + this.W * (z + this.D * y);
  }

  spawn() {
    const k = this.next;
    this.next = this.pick();
    const cubes = this.shapes[k].cubes.map((c) => c.slice());
    this.piece = { k, cubes, x: Math.floor((this.W - 1) / 2), y: this.H - 1, z: Math.floor((this.D - 1) / 2) }; // prettier-ignore
    // Start low enough that the whole piece is inside the well.
    const top = Math.max(...cubes.map((c) => c[1]));
    this.piece.y = this.H - 1 - top;
    this.piece.sprites = cubes.map(() => this.api.sprites.add(this.models[k]));
    this.piece.shown = null;
    if (!this.fits(this.piece.cubes, this.piece.x, this.piece.y, this.piece.z)) {
      this.over = true;
      this.api.sound([{ voice: "rumble", vol: 0.6, decay: 0.8 }, { voice: "stone", f: 120, vol: 0.7 }]); // prettier-ignore
    }
  }

  fits(cubes, x, y, z) {
    for (const c of cubes) {
      const cx = x + c[0];
      const cy = y + c[1];
      const cz = z + c[2];
      if (cx < 0 || cx >= this.W || cz < 0 || cz >= this.D || cy < 0) return false;
      if (cy < this.H && this.grid[this.idx(cx, cy, cz)]) return false;
    }
    return true;
  }

  // Tries a move (or a turn: new cubes); a turn that hits a wall may slide
  // one stone over to fit (a kick).
  tryMove(cubes, dx, dy, dz) {
    const p = this.piece;
    const kicks = cubes !== p.cubes ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] : [[0, 0]]; // prettier-ignore
    for (const [kx, kz] of kicks) {
      if (!this.fits(cubes, p.x + dx + kx, p.y + dy, p.z + dz + kz)) continue;
      p.cubes = cubes;
      p.x += dx + kx;
      p.y += dy;
      p.z += dz + kz;
      return true;
    }
    return false;
  }

  turn(axis) {
    if (this.D === 1 && axis !== "z") axis = "z";
    const cubes = this.piece.cubes.map(TURN[axis]);
    if (this.tryMove(cubes, 0, 0, 0))
      this.api.sound({ voice: "wood", f: 640, vol: 0.3, decay: 0.4 });
  }

  // Screen directions to well directions (x and z), from the camera's turn.
  screenStep(name) {
    if (this.D === 1) return name === "left" ? [-1, 0] : name === "right" ? [1, 0] : null;
    const yaw = this.camYaw || 0;
    const v = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[name];
    if (!v) return null;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const x = v[0] * c + v[1] * s;
    const z = -v[0] * s + v[1] * c;
    return Math.abs(x) > Math.abs(z) ? [Math.sign(x), 0] : [0, Math.sign(z)];
  }

  step(dt, ctl) {
    this.view = ctl.view;
    this.stepShards(dt);
    if (this.over) return;
    const p = this.piece;
    for (const a of ctl.pressed) {
      if (a === "fire") this.hardDrop();
      else if (a === "alt") this.turn("y");
      else if (a === "turnL") this.turn(this.D === 1 ? "z" : "x");
      else if (a === "turnR") this.turn("z");
      else if (a === "down" && this.D === 1) this.dropT = 1e9;
      else if (a === "up" && this.D === 1) this.turn("z");
      else {
        const st = this.screenStep(a);
        if (st && this.tryMove(p.cubes, st[0], 0, st[1])) this.api.sound({ voice: "click", f: 1500, vol: 0.1 }); // prettier-ignore
      }
    }
    const sw = ctl.input.takeSwipe?.();
    if (sw) {
      if (sw === "down" && this.D === 1) this.hardDrop();
      else if (sw === "up") this.turn("y");
      else {
        const st = this.screenStep(sw);
        if (st) this.tryMove(p.cubes, st[0], 0, st[1]);
      }
    }
    if (ctl.demo) this.autopilot(dt);
    if (this.piece !== p) return;
    // Falling: faster each level; holding down (in the slot) speeds it.
    const every = Math.max(0.12, 0.7 - (this.level - 1) * 0.06);
    this.dropT += dt * (ctl.input.isHeld("down") && this.D === 1 ? 8 : 1);
    if (this.dropT >= every) {
      this.dropT = 0;
      if (!this.tryMove(p.cubes, 0, -1, 0)) this.land();
    }
  }

  hardDrop() {
    const p = this.piece;
    let n = 0;
    while (this.tryMove(p.cubes, 0, -1, 0)) n++;
    this.score += n * 2;
    this.land();
  }

  land() {
    const p = this.piece;
    p.cubes.forEach((c, i) => {
      const cx = p.x + c[0];
      const cy = p.y + c[1];
      const cz = p.z + c[2];
      if (cy >= this.H) {
        this.over = true;
        return;
      }
      this.grid[this.idx(cx, cy, cz)] = p.sprites[i];
      p.sprites[i].cell = [cx, cy, cz];
    });
    this.api.sound({ voice: "stone", f: 200, vol: 0.55, decay: 0.6 });
    this.clearLayers();
    if (!this.over) this.spawn();
  }

  clearLayers() {
    let cleared = 0;
    for (let y = 0; y < this.H; y++) {
      let full = true;
      for (let z = 0; z < this.D && full; z++) for (let x = 0; x < this.W && full; x++) if (!this.grid[this.idx(x, y, z)]) full = false; // prettier-ignore
      if (!full) continue;
      // The layer crumbles: each stone breaks into rubble that falls and fades.
      for (let z = 0; z < this.D; z++)
        for (let x = 0; x < this.W; x++) {
          const s = this.grid[this.idx(x, y, z)];
          this.api.sprites.shatter(s, 6, {
            rand: this.rand,
            kick: 0.45,
            spin: 8,
            life: 1.4,
            vel: [0, 0.3, 0],
          });
          this.shards.push({ sprite: s, floor: this.worldY(y) - this.cube * 0.5 });
          this.grid[this.idx(x, y, z)] = null;
        }
      // Everything above drops one layer (it slides down; see render).
      for (let yy = y + 1; yy < this.H; yy++)
        for (let z = 0; z < this.D; z++)
          for (let x = 0; x < this.W; x++) {
            const s = this.grid[this.idx(x, yy, z)];
            this.grid[this.idx(x, yy - 1, z)] = s;
            this.grid[this.idx(x, yy, z)] = null;
            if (s) {
              s.cell = [x, yy - 1, z];
              s.slide = (s.slide || 0) + 1;
            }
          }
      y--;
      cleared++;
    }
    if (!cleared) return;
    this.layers += cleared;
    this.score += [0, 100, 300, 600, 1000][Math.min(4, cleared)] * this.level;
    this.level = 1 + Math.floor(this.layers / 4);
    this.api.sound([{ voice: "crunch", vol: 0.7 }, { voice: "rumble", at: 0.05, vol: 0.4, decay: 0.7 }, { voice: "patter", at: 0.2, vol: 0.4 }]); // prettier-ignore
  }

  stepShards(dt) {
    for (const sh of this.shards) sh.busy = this.api.stepPieces(sh.sprite, dt, { gravity: 3.2, floor: sh.floor, bounce: 0.25, fadeOut: 0.45 }); // prettier-ignore
    for (const sh of this.shards.filter((x) => !x.busy)) this.api.sprites.remove(sh.sprite);
    this.shards = this.shards.filter((x) => x.busy);
  }

  // The attract mode: drop each piece where it leaves the fewest gaps.
  autopilot(dt) {
    const p = this.piece;
    if (!p.plan) {
      let best = null;
      for (let r = 0; r < 4; r++) {
        let cubes = p.cubes.map((c) => c.slice());
        for (let k = 0; k < r; k++) cubes = cubes.map(this.D === 1 ? TURN.z : TURN.y);
        for (let x = -2; x < this.W + 2; x++)
          for (let z = -2; z < this.D + 2; z++) {
            if (!this.fits(cubes, x, p.y, z)) continue;
            let y = p.y;
            while (this.fits(cubes, x, y - 1, z)) y--;
            const score = -y * 3 + this.rand() * 0.5 - cubes.reduce((a, c) => a + (y + c[1]), 0) * 0.5; // prettier-ignore
            if (!best || score > best.score) best = { cubes, x, z, score };
          }
      }
      p.plan = best || { cubes: p.cubes, x: p.x, z: p.z };
      p.planT = 0;
    }
    p.planT += dt;
    if (p.planT < 0.18) return;
    p.planT = 0;
    if (p.cubes !== p.plan.cubes && this.fits(p.plan.cubes, p.x, p.y, p.z)) p.cubes = p.plan.cubes;
    if (p.x !== p.plan.x) this.tryMove(p.cubes, Math.sign(p.plan.x - p.x), 0, 0);
    else if (p.z !== p.plan.z) this.tryMove(p.cubes, 0, 0, Math.sign(p.plan.z - p.z));
    else this.hardDrop();
  }

  // ---- View ------------------------------------------------------------------------

  worldX(x) {
    return (-this.W / 2 + x + 0.5) * this.cube;
  }
  worldY(y) {
    return (-this.H / 2 + y + 0.5) * this.cube;
  }
  worldZ(z) {
    return (-this.D / 2 + z + 0.5) * this.cube;
  }

  render(view, frameDt) {
    this.view = view;
    const dt = Math.min(0.1, frameDt || 0);
    // Landed stones; those that dropped after a clear slide down.
    for (const s of this.grid) {
      if (!s) continue;
      if (s.slide) s.slide = Math.max(0, s.slide - dt * 6);
      const [x, y, z] = s.cell;
      s.pos = [this.worldX(x), this.worldY(y + (s.slide || 0)), this.worldZ(z)];
      s.quat = [0, 0, 0, 1];
    }
    // The falling piece glides between its cells.
    const p = this.piece;
    if (p && !this.over) {
      const want = [this.worldX(p.x), this.worldY(p.y), this.worldZ(p.z)];
      p.shown = p.shown ? p.shown.map((v, i) => v + (want[i] - v) * Math.min(1, dt * 18)) : want;
      p.cubes.forEach((c, i) => {
        const s = p.sprites[i];
        s.pos = [
          p.shown[0] + c[0] * this.cube,
          p.shown[1] + c[1] * this.cube,
          p.shown[2] + c[2] * this.cube,
        ];
        s.quat = [0, 0, 0, 1];
      });
    }
  }

  camera(view, aspect) {
    const c = this.cube;
    const [Wx, Hy, Dz] = [this.W * c, this.H * c, this.D * c];
    // 2D: the side view, straight in from the front.
    const d2 = this.api.fitDistance(Wx + 0.5, Hy + 0.8, aspect);
    // 3D: down into the well from above its rim, turned a little (Q and E
    // turn the stones, so the view keeps still).
    this.camYaw = lerp(0, 0.6, view);
    const d3 = this.api.fitDistance(Math.max(Wx, Dz) * 2.4, Hy * 1.6, aspect);
    return {
      target: [0, lerp(0.08, -Hy * 0.12, view), 0],
      yaw: this.camYaw,
      pitch: lerp(0, this.D === 1 ? 0.35 : 0.92, view),
      distance: lerp(d2, d3, view),
    };
  }

  stats() {
    return {
      score: this.score,
      layers: this.layers,
      level: this.level,
      next: this.shapes[this.next].name,
    };
  }

  status() {
    return {
      over: this.over,
      title: "The well is full",
      lines: [`Score ${this.score} · ${this.layers} layers`],
    };
  }
}

void clamp;
