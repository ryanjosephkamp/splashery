// Lane Arcade, G1: Shardball, a brick-breaking game. A paddle, a ball and
// a wall of bricks; every brick that breaks shatters into real pieces that
// fall, bounce and fade. Two styles (the owner keeps versions side by side):
//
//   flat  the classic board. Its 3D view tips the same board back into a
//         table you look along, the bricks and rails deepen into blocks,
//         and the same game runs on without a pause.
//   dome  the owner's 3D vision: in 3D the paddle slides down to the
//         bottom of an invisible sphere, the bricks spread over a dome
//         around and above it, and the ball bounces in three dimensions
//         (with a gentle pull back down toward the paddle). The switch
//         holds the ball while everything slides into place, then play
//         goes on where it was.
//
// World units: the toy's own (the board is about 1.7 by 2.1).

// The board (inside the rails); a game made from a page sets its own.
import { crispModel } from "./arcade-crisp.js";

const BOARD = { W: 1.6, H: 2.0, TOP: 1.0, PADDLE_Y: -0.86 };
const BALL_R = 0.032;
const BRICK = [0.142, 0.062, 0.09]; // full sizes (depth for 3D)
const COLS = 10;
const ROWS = 7;
const R = 1.0; // the dome's sphere
const DOME_PADDLE_Y = -0.8;
const DOME_G = 0.85;
const SPAN = Math.PI * 0.62; // the dome's bricks reach this far around each side of the back

// A point on the unit sphere: phi around from the back (-Z), th down from the top.
function spherePoint(phi, th) {
  return [Math.sin(th) * Math.sin(phi), Math.cos(th), -Math.sin(th) * Math.cos(phi)];
}

// Brick materials: colors per row, and how many hits each kind takes.
const ROW_COLORS = ["#d8443a", "#e97a2c", "#e9b730", "#6dbb46", "#2fa6a0", "#3a7bd5", "#8a56c8"];
const KINDS = {
  glaze: { hits: 1, points: 10 },
  stone: { hits: 2, points: 30 },
};

// Level layouts: a function (col, row) -> kind or null.
const LEVELS = [
  (c, r) => (r < 6 ? "glaze" : null),
  (c, r) => (r === 0 || r === 6 ? "stone" : "glaze"),
  (c, r) => ((c + r) % 2 === 0 ? "glaze" : r % 3 === 0 ? "stone" : null),
  (c, r) => (Math.abs(c - 4.5) + Math.abs(r - 3) < 5 ? (r === 3 ? "stone" : "glaze") : null),
  (c, r) => (c % 3 === 1 ? "stone" : "glaze"),
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const mix3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createShardball(api) {
  return new Shardball(api);
}

export class Shardball {
  constructor(api) {
    this.api = api;
    this.q = api.q;
    this.style = api.options.style === "dome" ? "dome" : "flat";
    this.geo = { ...BOARD };
    this.startLevel = clamp(Math.round(api.options.level || 1), 1, LEVELS.length);
    this.rand = api.rand;
    this.models = this.makeModels();
    this.view = api.options.view === "3d" ? 1 : 0;
    this.mode3d = this.view > 0.5; // which simulation runs (dome style)
    this.hold = 0; // dome: the ball waits while the view slides
  }

  // ---- Models ----------------------------------------------------------------------

  makeModels() {
    const { kitModel, recolor } = this.api;
    const prof = this.api.profile;
    // Crisp grids (src/packs/arcade-crisp.js): straight brick edges.
    const fine = prof === "low" ? 0.008 : 0.005;
    const opt = { fine, coarse: fine * 5 };
    // A brick of each kind and row; the dome builds its rows' bricks at their
    // size there (mx, my times the board's) and only ever scales them down,
    // so their splats never spread apart.
    const cache = new Map();
    const brick = (kind, r, mx = 1, my = 1) => {
      const key = `${kind}${r}:${mx.toFixed(2)}:${my.toFixed(2)}`;
      if (cache.has(key)) return cache.get(key);
      const [bw, bh, bd] = [BRICK[0] * 0.94 * mx, BRICK[1] * 0.86 * my, BRICK[2]];
      const base = crispModel(
        (c) =>
          c.box(bw, bh, bd, {
            // the flat board's bricks have no left and right sides: in its
            // views they are only ever seen at a slant, as a soft sliver
            faces: this.style === "dome" ? "xXyYZ" : "yYZ",
            color: (p, n) => {
              // Glazed tile: a lit top, darker sides, and a thin darker
              // chamfer round its face, so its edge reads crisp (a bright
              // rim read as a soft glow at phone size).
              // (the sides darker than the face: seen edge-on in 2D they
              // draw the brick's outline, so a lighter side read as a halo)
              let f = n[2] > 0.5 ? 0.97 : 0.68 + 0.1 * n[1];
              const ex = bw / 2 - Math.abs(p[0]);
              const ey = bh / 2 - Math.abs(p[1]);
              if (n[2] > 0.5 && Math.min(ex, ey) < 0.0045) f *= 0.8;
              else if (n[2] > 0.5) f *= 1 + 0.06 * (p[1] / bh); // a little lighter up top
              return [f, f, f];
            },
          }),
        opt,
      );
      const c = hex(ROW_COLORS[r]);
      const st = mix3(c, [0.55, 0.53, 0.5], 0.72);
      const m =
        kind === "stone"
          ? recolor(base, (v, i, p) => {
              // Stone: grainy gray with a hint of the row's color.
              const g =
                0.85 + 0.25 * Math.sin(p[0] * 210 + p[1] * 330) * Math.sin(p[1] * 170 - p[0] * 90);
              return [st[0] * v[0] * g, st[1] * v[1] * g, st[2] * v[2] * g, 1];
            })
          : recolor(base, (v) => [c[0] * v[0], c[1] * v[1], c[2] * v[2], 1]);
      cache.set(key, m);
      return m;
    };
    const paddle = crispModel(
      (c) =>
        c.box(0.3, 0.05, 0.11, {
          color: (p, n) => {
            const f = 0.75 + 0.3 * n[1] + 0.12 * n[2];
            const stripe = Math.abs(p[0]) > 0.11 ? [0.95, 0.45, 0.2] : [0.62, 0.72, 0.85];
            return stripe.map((v) => v * f);
          },
        }),
      opt,
    );
    const dish = crispModel(
      (c) =>
        c.cylinder(0.2, 0.035, {
          axis: [0, 1, 0],
          color: (p, n) => {
            const f = 0.75 + 0.3 * n[1];
            const ring = Math.hypot(p[0], p[2]) > 0.15 ? [0.95, 0.45, 0.2] : [0.62, 0.72, 0.85];
            return ring.map((v) => v * f);
          },
        }),
      opt,
    );
    const ball = crispModel(
      (c) =>
        c.sphere(BALL_R, {
          step: BALL_R / 7,
          color: (p, n) => {
            const l = Math.max(0, n[0] * -0.3 + n[1] * 0.7 + n[2] * 0.6);
            const f = 0.78 + 0.25 * l + 0.4 * Math.pow(l, 12);
            return [f, f * 0.98, f * 0.94];
          },
        }),
      opt,
    );
    // The dome's ball shadow: a soft dark disc, lying flat (facing +y).
    const shadow = crispModel((c) => c.disc(BALL_R * 1.3, { opacity: 0.45, color: [0.05, 0.05, 0.08] }), { fine: BALL_R / 4 }); // prettier-ignore
    for (let i = 0; i < shadow.n; i++) {
      const p = shadow.pos.subarray(i * 3, i * 3 + 3);
      [p[1], p[2]] = [p[2], -p[1]];
      shadow.rot.set(this.q.qmul(this.q.qaxis([1, 0, 0], -Math.PI / 2), Array.from(shadow.rot.subarray(i * 4, i * 4 + 4))), i * 4); // prettier-ignore
    }
    // Rails of dark wood, each built at its own length (a stretched one
    // would smear its splats).
    const rail = (len) =>
      crispModel(
        (c) =>
          c.box(len, 0.04, 0.12, {
            faces: "xXyYZ",
            color: (p, n) => {
              // Smooth dark wood with a faint long grain; its sides darker,
              // so in 2D its edges read as clean lines, not a soft band.
              const grain = 0.96 + 0.04 * Math.sin(p[0] * 9 + Math.sin(p[0] * 3) * 2);
              const f = (n[2] > 0.5 ? 1 : 0.62) * grain;
              return [0.45 * f, 0.3 * f, 0.19 * f];
            },
          }),
        { fine, coarse: 0.04 },
      );
    // The dome's floor: a dotted rim where the sphere meets the dish's
    // level, and fainter rings inside it, so the bowl reads in depth.
    const floor = kitModel(
      (k) => {
        const rim = Math.sqrt(R * R - DOME_PADDLE_Y * DOME_PADDLE_Y);
        k.cloud({ share: 1 }, (rand, i, n) => {
          const ringN = [0.36, 0.72, 1];
          const ring = i % 5 === 0 ? 0 : i % 5 === 1 ? 1 : 2;
          const a = (i / n) * Math.PI * 2 * 7.0;
          const rr = rim * ringN[ring];
          const f = ring === 2 ? 0.55 : 0.75;
          return {
            p: [Math.cos(a) * rr, 0, Math.sin(a) * rr],
            color: [f * 0.55, f * 0.6, f * 0.75],
            size: 0.45,
            opacity: 0.9,
            n: [0, 1, 0],
          };
        });
      },
      { count: 900 },
    );
    // (rails are built when the board's size is known: see reset)
    const rails = new Map();
    const railOf = (len) => {
      const key = len.toFixed(3);
      if (!rails.has(key)) rails.set(key, rail(len));
      return rails.get(key);
    };
    return { brick, paddle, dish, ball, shadow, railOf, floor };
  }

  // ---- Game ----------------------------------------------------------------------

  reset() {
    const { W, H, TOP, PADDLE_Y } = this.geo;
    const s = this.api.sprites;
    s.clear();
    this.score = 0;
    this.lives = 3;
    this.level = this.startLevel;
    this.over = false;
    this.won = false;
    this.rails = [];
    {
      // left, right, top rails (faded out in the dome's 3D view)
      for (const r of [
        { pos: [-W / 2 - 0.02, 0, 0], quat: this.q.qaxis([0, 0, 1], Math.PI / 2), len: H + 0.08 },
        { pos: [W / 2 + 0.02, 0, 0], quat: this.q.qaxis([0, 0, 1], Math.PI / 2), len: H + 0.08 },
        { pos: [0, TOP + 0.02, 0], quat: [0, 0, 0, 1], len: W + 0.08 },
      ]) {
        r.sprite = s.add(this.models.railOf(r.len), { pos: r.pos, quat: r.quat });
        this.rails.push(r);
      }
    }
    this.paddle = { x: 0, z: 0, vx: 0, w: 0.3, sprite: s.add(this.models.paddle) };
    this.dish = { sprite: s.add(this.models.dish, { fade: 0 }) };
    this.ball = { p: [0, 0, 0], v: [0, 0, 0], stuck: true, sprite: s.add(this.models.ball) };
    this.shadow = s.add(this.models.shadow, { fade: 0 });
    this.floor = this.style === "dome" ? s.add(this.models.floor, { pos: [0, DOME_PADDLE_Y, 0], fade: 0 }) : null; // prettier-ignore
    this.shards = [];
    this.buildLevel();
    this.serve();
    this.banner = { title: `Level ${this.level}`, until: 1.4 };
    this.t = 0;
  }

  buildLevel() {
    const { W, H, TOP, PADDLE_Y } = this.geo;
    for (const b of this.bricks || []) if (b.sprite) this.api.sprites.remove(b.sprite);
    this.bricks = [];
    const layout = LEVELS[(this.level - 1) % LEVELS.length];
    const gx = W / COLS;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const kind = layout(c, r);
        if (!kind) continue;
        const x = -W / 2 + gx * (c + 0.5);
        const y = TOP - 0.2 - r * 0.075;
        const b = { c, r, kind, hits: KINDS[kind].hits, x, y, w: BRICK[0], h: BRICK[1], d: BRICK[2], alive: true }; // prettier-ignore
        if (this.style === "dome") {
          const sx = this.domePose(b).scale[0];
          b.mscale = [Math.max(1, sx), 1.25, 1];
        }
        const ms = b.mscale || [1, 1, 1];
        b.sprite = this.api.sprites.add(this.models.brick(kind, r, ms[0], ms[1]));
        this.bricks.push(b);
      }
  }

  serve() {
    const b = this.ball;
    b.stuck = true;
    b.v = [0, 0, 0];
    this.serveAt = this.t + 1.2;
  }

  launch() {
    const b = this.ball;
    if (!b.stuck) return;
    b.stuck = false;
    const a = (this.rand() - 0.5) * 0.6;
    if (this.style === "dome" && this.mode3d) {
      b.v = [Math.sin(a) * 0.4, 2.15, Math.cos(a) * 0.25 - 0.1];
    } else {
      const sp = this.speed();
      b.v = [Math.sin(a) * sp, Math.cos(a) * sp, 0];
    }
    this.api.sound({ voice: "pock", f: 520, vol: 0.6 });
  }

  speed() {
    return 1.25 + 0.08 * (this.level - 1) + Math.min(0.35, this.hitsInRow * 0.01 || 0);
  }

  onView(to) {
    const { W, H, TOP, PADDLE_Y } = this.geo;
    if (this.style !== "dome") return;
    // Hand the ball over to the other view's game: hold it while the view
    // slides, then go on from the matching place.
    const b = this.ball;
    if (to > 0.5 && !this.mode3d) {
      const p = this.toDome2(b.p[0], b.p[1], 0.62);
      const v2 = b.v;
      b.p = p;
      b.v = b.stuck ? [0, 0, 0] : [v2[0] * 0.6, Math.max(0.4, v2[1]) * 1.3, -0.2];
      this.paddle.z = 0;
      this.paddle.x = clamp(this.paddle.x * 0.5, -0.4, 0.4);
      this.mode3d = true;
    } else if (to < 0.5 && this.mode3d) {
      const f = this.fromDome(b.p);
      b.p = [f[0], clamp(f[1], PADDLE_Y + 0.1, TOP - 0.1), 0];
      const sp = this.speed();
      const vy = b.v[1] >= 0 ? 1 : -1;
      b.v = b.stuck ? [0, 0, 0] : [sp * 0.5 * Math.sign(b.v[0] || 1), sp * 0.86 * vy, 0];
      this.paddle.x = clamp(this.paddle.x * 2, -W / 2 + 0.15, W / 2 - 0.15);
      this.mode3d = false;
    }
    this.hold = 1.1;
  }

  step(dt, ctl) {
    const { W, H, TOP, PADDLE_Y } = this.geo;
    this.t += dt;
    this.view = ctl.view;
    if (this.banner && (this.banner.until -= dt) <= 0) this.banner = null;
    this.stepShards(dt);
    if (this.over) return;
    if (this.hold > 0) {
      this.hold -= dt;
      return;
    }
    const dome = this.style === "dome" && this.mode3d;
    this.movePaddle(dt, ctl, dome);
    const b = this.ball;
    if (b.stuck) {
      if (dome) b.p = [this.paddle.x, DOME_PADDLE_Y + 0.03 + BALL_R, this.paddle.z];
      else b.p = [this.paddle.x, PADDLE_Y + 0.025 + BALL_R, 0];
      const go = ctl.pressed.has("fire") || (ctl.demo && this.t > this.serveAt) || (!ctl.demo && this.t > this.serveAt + 4); // prettier-ignore
      if (go) this.launch();
      return;
    }
    if (dome) this.stepBall3(dt);
    else this.stepBall2(dt);
  }

  movePaddle(dt, ctl, dome) {
    const { W, H, TOP, PADDLE_Y } = this.geo;
    const p = this.paddle;
    const inp = ctl.input;
    if (ctl.demo) {
      // The attract mode plays itself: the paddle follows the ball.
      const b = this.ball;
      const tx = b.p[0] + Math.sin(this.t * 1.3) * 0.05;
      p.x += clamp(tx - p.x, -1.6 * dt, 1.6 * dt);
      if (dome) p.z += clamp(b.p[2] - p.z, -1.6 * dt, 1.6 * dt);
    } else {
      const sp = dome ? 1.0 : 1.8;
      let mx = inp.axis[0];
      let mz = -inp.axis[1];
      if (dome) {
        // Keys move the dish in the camera's frame.
        const yaw = this.camYaw || 0;
        const ax = Math.cos(yaw) * mx + Math.sin(yaw) * mz;
        const az = -Math.sin(yaw) * mx + Math.cos(yaw) * mz;
        mx = ax;
        mz = az;
      }
      p.x += mx * sp * dt;
      if (dome) p.z += mz * sp * dt;
      const ptr = inp.pointer;
      if (ptr && (ptr.down || ptr.kind === "mouse") && this.api.ray) {
        const ray = this.api.ray(ptr.x, ptr.y);
        const y0 = dome ? DOME_PADDLE_Y : null;
        if (ray) {
          let hit = null;
          if (dome) {
            const t = (y0 - ray.origin[1]) / (ray.dir[1] || -1e-6);
            if (t > 0) hit = [ray.origin[0] + ray.dir[0] * t, ray.origin[2] + ray.dir[2] * t];
          } else {
            const w = this.boardToWorldRay(ray);
            if (w) hit = [w[0], 0];
          }
          if (hit) {
            p.x += clamp(hit[0] - p.x, -3 * dt, 3 * dt);
            if (dome) p.z += clamp(hit[1] - p.z, -3 * dt, 3 * dt);
          }
        }
      }
    }
    if (dome) {
      const l = Math.hypot(p.x, p.z);
      if (l > 0.42) {
        p.x *= 0.42 / l;
        p.z *= 0.42 / l;
      }
    } else p.x = clamp(p.x, -W / 2 + p.w / 2, W / 2 - p.w / 2);
  }

  // The board point under a pointer ray, in the flat style's tipped view.
  boardToWorldRay(ray) {
    const M = this.boardRot();
    // board plane: z = 0 in board space; world = M * board
    const inv = [-M[0], -M[1], -M[2], M[3]];
    const o = this.q.qrot(inv, ray.origin);
    const d = this.q.qrot(inv, ray.dir);
    if (Math.abs(d[2]) < 1e-6) return null;
    const t = -o[2] / d[2];
    if (t < 0) return null;
    return [o[0] + d[0] * t, o[1] + d[1] * t];
  }

  stepBall2(dt) {
    const { W, H, TOP, PADDLE_Y } = this.geo;
    const b = this.ball;
    const sub = 2;
    for (let s = 0; s < sub; s++) {
      const h = dt / sub;
      b.p[0] += b.v[0] * h;
      b.p[1] += b.v[1] * h;
      // walls
      if (b.p[0] < -W / 2 + BALL_R && b.v[0] < 0) this.bounce(0, -W / 2 + BALL_R, "wall");
      if (b.p[0] > W / 2 - BALL_R && b.v[0] > 0) this.bounce(0, W / 2 - BALL_R, "wall");
      if (b.p[1] > TOP - BALL_R && b.v[1] > 0) this.bounce(1, TOP - BALL_R, "wall");
      // paddle
      const p = this.paddle;
      const py = PADDLE_Y + 0.025;
      if (
        b.v[1] < 0 &&
        b.p[1] - BALL_R < py &&
        b.p[1] > PADDLE_Y - 0.03 &&
        Math.abs(b.p[0] - p.x) < p.w / 2 + BALL_R
      ) {
        // The angle comes from where it hit the paddle.
        const off = clamp((b.p[0] - p.x) / (p.w / 2), -1, 1);
        const a = off * 1.05;
        const sp = this.speed();
        b.v = [Math.sin(a) * sp, Math.cos(a) * sp, 0];
        b.p[1] = py + BALL_R;
        this.api.sound({ voice: "pock", f: 380 + 120 * Math.abs(off), vol: 0.7 });
      }
      // bricks
      for (const br of this.bricks) {
        if (!br.alive) continue;
        const dx = b.p[0] - br.x;
        const dy = b.p[1] - br.y;
        const hx = br.w / 2 + BALL_R;
        const hy = br.h / 2 + BALL_R;
        if (Math.abs(dx) < hx && Math.abs(dy) < hy) {
          const px = hx - Math.abs(dx);
          const py2 = hy - Math.abs(dy);
          if (px < py2) {
            b.v[0] = Math.abs(b.v[0]) * Math.sign(dx || 1);
            b.p[0] = br.x + Math.sign(dx || 1) * hx;
          } else {
            b.v[1] = Math.abs(b.v[1]) * Math.sign(dy || 1);
            b.p[1] = br.y + Math.sign(dy || 1) * hy;
          }
          this.hitBrick(br, [b.p[0], b.p[1], 0]);
          break;
        }
      }
      if (b.p[1] < PADDLE_Y - 0.25) {
        this.loseBall();
        return;
      }
    }
  }

  stepBall3(dt) {
    const b = this.ball;
    const sub = 3;
    for (let s = 0; s < sub; s++) {
      const h = dt / sub;
      b.v[1] -= DOME_G * h;
      for (let k = 0; k < 3; k++) b.p[k] += b.v[k] * h;
      // the sphere's wall
      const l = Math.hypot(...b.p);
      if (l > R - BALL_R) {
        const n = b.p.map((v) => v / l);
        const vn = b.v[0] * n[0] + b.v[1] * n[1] + b.v[2] * n[2];
        if (vn > 0) {
          for (let k = 0; k < 3; k++) b.v[k] -= 2 * vn * n[k];
          this.api.sound({ voice: "pock", f: 300, vol: 0.25 });
        }
        for (let k = 0; k < 3; k++) b.p[k] = n[k] * (R - BALL_R);
      }
      // the dish
      const p = this.paddle;
      const top = DOME_PADDLE_Y + 0.0175;
      if (b.v[1] < 0 && b.p[1] - BALL_R < top && b.p[1] > DOME_PADDLE_Y - 0.04) {
        const dx = b.p[0] - p.x;
        const dz = b.p[2] - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.2 + BALL_R) {
          // Off-center hits send it outward, toward that side of the dome.
          const k = d / 0.2;
          const up = 2.15 + 0.04 * (this.level - 1);
          const out = 0.9 * k;
          const ux = d > 1e-4 ? dx / d : 0;
          const uz = d > 1e-4 ? dz / d : 0;
          b.v = [ux * out + p.vx * 0.2, up, uz * out];
          b.p[1] = top + BALL_R;
          this.api.sound({ voice: "pock", f: 400 + 100 * k, vol: 0.7 });
        }
      }
      // bricks (oriented boxes on the dome)
      for (const br of this.bricks) {
        if (!br.alive || !br.dome) continue;
        const { pos, quat, scale } = br.dome;
        const inv = [-quat[0], -quat[1], -quat[2], quat[3]];
        const lp = this.q.qrot(inv, [b.p[0] - pos[0], b.p[1] - pos[1], b.p[2] - pos[2]]);
        const hx = (br.w * scale[0]) / 2;
        const hy = (br.h * scale[1]) / 2;
        const hz = (br.d * scale[2]) / 2;
        const c = [clamp(lp[0], -hx, hx), clamp(lp[1], -hy, hy), clamp(lp[2], -hz, hz)];
        const d = [lp[0] - c[0], lp[1] - c[1], lp[2] - c[2]];
        const dl = Math.hypot(...d);
        if (dl < BALL_R) {
          let n = dl > 1e-5 ? d.map((v) => v / dl) : [0, 0, 1];
          n = this.q.qrot(quat, n);
          const vn = b.v[0] * n[0] + b.v[1] * n[1] + b.v[2] * n[2];
          if (vn < 0) for (let k = 0; k < 3; k++) b.v[k] -= 2 * vn * n[k];
          this.hitBrick(br, b.p.slice());
          break;
        }
      }
      if (b.p[1] < DOME_PADDLE_Y - 0.12) {
        this.loseBall();
        return;
      }
    }
  }

  bounce(axis, at, what) {
    const b = this.ball;
    b.v[axis] = -b.v[axis];
    b.p[axis] = at;
    if (what === "wall") this.api.sound({ voice: "wood", f: 420, vol: 0.35, decay: 0.5 });
  }

  hitBrick(br, at) {
    br.hits--;
    this.hitsInRow = (this.hitsInRow || 0) + 1;
    if (br.hits > 0) {
      // A stone brick cracks first: it darkens and gives a stony knock.
      this.api.sprites.setTint(br.sprite, [0.12, 0.11, 0.1, 0.35]);
      this.api.sound({ voice: "stone", f: 300, vol: 0.6 });
      this.score += 5;
      return;
    }
    br.alive = false;
    this.score += KINDS[br.kind].points;
    const s = br.sprite;
    const dome = this.style === "dome" && this.view > 0.5;
    const vel = dome ? [0, 0, 0] : [this.ball.v[0] * 0.15, 0.4, 0.6 * this.view];
    // world-space hit point: in the flat style's tipped view the board is turned
    const from = this.toWorld(at);
    this.api.sprites.shatter(s, br.kind === "stone" ? 9 : 7, { rand: this.rand, vel, from, kick: 0.55, spin: 9, life: 2.4 }); // prettier-ignore
    this.shards.push({ sprite: s, dome });
    br.sprite = null;
    this.api.sound(br.kind === "stone" ? [{ voice: "crack", vol: 0.8 }, { voice: "clatter", at: 0.04, vol: 0.5 }] : [{ voice: "glass", f: 900 + 60 * br.r, vol: 0.45, decay: 0.5 }, { voice: "clatter", at: 0.02, vol: 0.6 }]); // prettier-ignore
    if (!this.bricks.some((x) => x.alive)) this.nextLevel();
  }

  nextLevel() {
    this.level++;
    this.score += 100;
    this.buildLevel();
    this.serve();
    this.banner = { title: `Level ${this.level}`, until: 1.6 };
    this.api.sound({ voice: "bell", notes: "C5 E5 G5 C6", step: 0.1, vol: 0.5 });
  }

  loseBall() {
    this.lives--;
    this.hitsInRow = 0;
    this.api.sound({ voice: "thud", f: 90, vol: 0.8 });
    if (this.lives <= 0) {
      this.over = true;
      this.ball.sprite.fade = 0;
      return;
    }
    this.serve();
  }

  stepShards(dt) {
    const { W, H, TOP, PADDLE_Y } = this.geo;
    const floorY = PADDLE_Y - 0.18;
    for (const sh of this.shards) {
      // In the dome they tumble down the inside of the sphere; on the board
      // they fall and bounce on the board's bottom edge.
      const opts = sh.dome
        ? { gravity: 2.5, sphere: { at: [0, 0, 0], r: R }, bounce: 0.35, friction: 0.7 }
        : { gravity: 3.5, floor: this.boardFloor(floorY), sides: [-W / 2 + 0.02, W / 2 - 0.02], bounce: 0.3 }; // prettier-ignore
      sh.busy = this.api.stepPieces(sh.sprite, dt, opts);
    }
    for (const sh of this.shards.filter((x) => !x.busy)) this.api.sprites.remove(sh.sprite);
    this.shards = this.shards.filter((x) => x.busy);
  }

  // The world height pieces bounce on in the flat style (the board's bottom
  // edge, tipped with the board in 3D).
  boardFloor(y) {
    const w = this.toWorld([0, y, 0]);
    return w[1];
  }

  // ---- View ------------------------------------------------------------------------

  // The flat style's board turn: tipped back by up to 62° in 3D.
  boardRot() {
    return this.q.qaxis([1, 0, 0], -1.08 * this.view);
  }

  toWorld(p) {
    if (this.style === "dome") return p.slice();
    return this.q.qrot(this.boardRot(), p);
  }

  // Board (x, y) to the dome: x goes around (the whole width is one turn),
  // y climbs from the bottom of the sphere to near its top.
  domeAngles(x, y) {
    const { W, H, TOP, PADDLE_Y } = this.geo;
    const phi = (x / (W / 2)) * SPAN;
    const th = lerp(Math.PI * 0.9, Math.PI * 0.1, clamp((y - PADDLE_Y) / (TOP - PADDLE_Y), 0, 1));
    return [phi, th];
  }

  toDome2(x, y, r) {
    const [phi, th] = this.domeAngles(x, y);
    return spherePoint(phi, th).map((v) => v * r);
  }

  fromDome(p) {
    const { W, H, TOP, PADDLE_Y } = this.geo;
    const l = Math.hypot(...p) || 1;
    const phi = Math.atan2(p[0], -p[2]);
    const th = Math.acos(clamp(p[1] / l, -1, 1));
    const x = clamp(phi / SPAN, -1, 1) * (W / 2);
    const f = (th - Math.PI * 0.9) / (Math.PI * 0.1 - Math.PI * 0.9);
    return [x, PADDLE_Y + f * (TOP - PADDLE_Y)];
  }

  // Where a brick sits on the dome, turned to face the middle: its column
  // goes around the back, its row climbs from the equator to near the top.
  domePose(br) {
    const { W, H, TOP, PADDLE_Y } = this.geo;
    const phi = (br.x / (W / 2)) * SPAN;
    // rows climb from the equator (the lowest bricks) to near the top
    const lo = this.brickLow ?? TOP - 0.65;
    const th = lerp(Math.PI * 0.1, Math.PI * 0.5, clamp((TOP - 0.2 - br.y) / Math.max(0.05, TOP - 0.2 - lo), 0, 1)); // prettier-ignore
    const n = spherePoint(phi, th);
    const pos = n.map((v) => v * (R - br.d / 2));
    // The brick's own axes: x along the ring (left to right as seen from
    // the front), y up the dome, z (its face) toward the middle.
    const ex = [Math.cos(phi), 0, Math.sin(phi)];
    const ez = n.map((v) => -v);
    const ey = [ez[1] * ex[2] - ez[2] * ex[1], ez[2] * ex[0] - ez[0] * ex[2], ez[0] * ex[1] - ez[1] * ex[0]]; // prettier-ignore
    const quat = quatFromAxes(ex, ey, ez);
    // A brick's width follows its ring's size.
    // x goes round in proportion: a brick keeps its share of its ring.
    const sx = clamp((Math.sin(th) * R * SPAN) / (W / 2), 0.3, 1.6);
    return { pos, quat, scale: [sx, 1.25, 1] };
  }

  render(view, frameDt) {
    const { W, H, TOP, PADDLE_Y } = this.geo;
    this.view = view;
    const q = this.q;
    const flat = this.style === "flat";
    const M = this.boardRot();
    const depth = flat ? lerp(0.25, 1, view) : lerp(0.25, 1, view);
    // bricks
    for (const br of this.bricks) {
      if (!br.alive || !br.sprite) continue;
      const s = br.sprite;
      if (flat) {
        s.pos = q.qrot(M, [br.x, br.y, 0]);
        s.quat = M;
        s.scale = [1, 1, depth];
      } else {
        const d = (br.dome = this.domePose(br));
        s.pos = br.x === undefined ? d.pos : lerp3([br.x, br.y, 0], d.pos, view);
        s.quat = q.qslerp([0, 0, 0, 1], d.quat, view);
        const ms = br.mscale || [1, 1, 1];
        s.scale = lerp3([1, 1, 0.25], d.scale, view).map((v, i) => v / ms[i]);
        s.fade = 1;
      }
    }
    // rails
    for (const r of this.rails) {
      const s = r.sprite;
      if (flat) {
        s.pos = q.qrot(M, r.pos);
        s.quat = q.qmul(M, r.quat);
        s.scale = [1, 1, lerp(0.4, 1.3, view)];
        s.fade = 1;
      } else {
        s.pos = r.pos;
        s.quat = r.quat;
        s.scale = [1, 1, 0.4];
        s.fade = clamp(1 - view * 2, 0, 1);
      }
    }
    // paddle, dish, ball
    const p = this.paddle;
    const b = this.ball;
    if (flat) {
      p.sprite.pos = q.qrot(M, [p.x, PADDLE_Y, 0]);
      p.sprite.quat = M;
      p.sprite.fade = 1;
      b.sprite.pos = q.qrot(M, b.p);
      this.shadow.fade = 0;
    } else {
      const p2 = [this.mode3d ? p.x * 2 : p.x, PADDLE_Y, 0];
      const p3 = [this.mode3d ? p.x : p.x * 0.5, DOME_PADDLE_Y, this.mode3d ? p.z : 0];
      p.sprite.pos = lerp3(p2, p3, view);
      p.sprite.fade = clamp(1 - view * 1.6, 0, 1);
      p.sprite.quat = [0, 0, 0, 1];
      this.dish.sprite.pos = p3;
      this.dish.sprite.fade = clamp(view * 1.6 - 0.6, 0, 1);
      // The ball: its own view's place, slid toward the other while switching.
      if (this.mode3d) {
        const f = this.fromDome(b.p);
        b.sprite.pos = lerp3([f[0], f[1], 0], b.p, view);
      } else {
        b.sprite.pos = lerp3(b.p, this.toDome2(b.p[0], b.p[1], 0.62), view);
      }
      // Its shadow on the dish's level shows where it will come down.
      this.shadow.pos = [b.p[0], DOME_PADDLE_Y + 0.02, b.p[2]];
      this.shadow.quat = [0, 0, 0, 1];
      this.shadow.fade = this.mode3d && !b.stuck ? clamp(view * 2 - 1, 0, 1) : 0;
      if (this.floor) this.floor.fade = clamp(view * 1.5 - 0.5, 0, 1);
    }
    b.sprite.fade = this.over ? 0 : 1;
  }

  camera(view, aspect) {
    const { W, H, TOP, PADDLE_Y } = this.geo;
    if (this.style === "flat") {
      const d2 = this.api.fitDistance(W + 0.3, H + 0.8, aspect);
      return {
        target: [0, lerp(0.14, -0.08, view), lerp(0, 0.05, view)],
        yaw: 0,
        pitch: lerp(0, 0.62, view),
        distance: lerp(d2, this.api.fitDistance(W + 0.5, 2.5, aspect), view),
      };
    }
    const d2 = this.api.fitDistance(W + 0.3, H + 0.8, aspect);
    // Dome: the camera looks into the open half-dome from the front and a
    // little above, turning gently toward the ball.
    const b = this.ball;
    const want = this.mode3d ? clamp(b.p[0] * 0.35, -0.3, 0.3) : 0;
    this.camYaw = this.camYaw ?? 0;
    this.camYaw += (want - this.camYaw) * 0.02;
    return {
      target: [0, lerp(0.14, -0.04, view), lerp(0, -0.2, view)],
      yaw: this.camYaw * view,
      pitch: lerp(0, 0.5, view),
      distance: lerp(d2, this.api.fitDistance(2.75, 2.7, aspect, 1.0, 48), view),
      fov: lerp(38, 48, view),
    };
  }

  stats() {
    return { score: this.score, lives: this.lives, level: this.level };
  }

  status() {
    return {
      over: this.over,
      title: "Game over",
      lines: [`Score ${this.score} · level ${this.level}`],
      banner: this.banner ? { title: this.banner.title, lines: [] } : null,
    };
  }
}

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function wrap(a) {
  return ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

// A quaternion from three orthonormal axes (the turned x, y and z).
function quatFromAxes(a, b, c) {
  const tr = a[0] + b[1] + c[2];
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(b[2] - c[1]) / s, (c[0] - a[2]) / s, (a[1] - b[0]) / s, 0.25 * s];
  } else if (a[0] > b[1] && a[0] > c[2]) {
    const s = Math.sqrt(1 + a[0] - b[1] - c[2]) * 2;
    q = [0.25 * s, (b[0] + a[1]) / s, (c[0] + a[2]) / s, (b[2] - c[1]) / s];
  } else if (b[1] > c[2]) {
    const s = Math.sqrt(1 + b[1] - a[0] - c[2]) * 2;
    q = [(b[0] + a[1]) / s, 0.25 * s, (c[1] + b[2]) / s, (c[0] - a[2]) / s];
  } else {
    const s = Math.sqrt(1 + c[2] - a[0] - b[1]) * 2;
    q = [(c[0] + a[2]) / s, (c[1] + b[2]) / s, 0.25 * s, (a[1] - b[0]) / s];
  }
  const l = Math.hypot(...q);
  return q.map((v) => v / l);
}
