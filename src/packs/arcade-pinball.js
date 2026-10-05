// Lane Arcade, G13: Night Owl Pinball. A steel ball on a sloped table,
// moved by Splashery's own rigid-body engine (src/physics/world.js, lane
// Physics): it rolls under gravity down the slope, bounces off the rails
// and posts with real restitution, and the flippers are solid paddles that
// swing and strike it (the engine pushes the ball where the swinging
// flipper goes, so a moving flipper hits harder than a still one).
// Pop bumpers kick the ball away and light up; the plunger launches it.
//
// 2D: the table seen from straight above. 3D: from the player's end of the
// table, looking up the slope, as you stand at a real machine.

import { evenCylinder } from "./even.js";
import { World, Body, quat } from "../physics/world.js";

const W = 1.0; // table width (x from -W/2 to W/2)
const L = 1.9; // table length (z from -L/2, the top, to L/2, the player's end)
const BALL_R = 0.028;
const SLOPE = 2.4; // the pull down the table (units per second squared)
const INTO = 7; // the pull into the table
const LANE_X = W / 2 - 0.1; // the plunger lane's inner wall
const LANE_BALL = W / 2 - 0.05; // the ball's place in the lane
const FLIP = { len: 0.16, w: 0.028, z: 0.7, x: 0.2, down: 0.52, up: -0.42, speed: 28 };

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createPinball(api) {
  return new Pinball(api);
}

class Pinball {
  constructor(api) {
    this.api = api;
    this.q = api.q;
    this.rand = api.rand;
    const low = api.profile === "low";
    const { kitModel } = api;
    const lit = (c, n, f = 1) => c.map((v) => v * (0.72 + 0.28 * n[1] + 0.08 * n[2]) * f);
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    this.models = {
      // The playfield: deep blue paint with a pale owl's-eye ring, star
      // dots and the drain's arrow lines.
      table: kitModel(
        (k) => {
          k.add(k.box(W, 0.02, L), {
            pos: [0, -0.01, 0],
            even: true,
            flat: 0.2,
            color: (c) => {
              const x = c.lp[0];
              const z = c.lp[2];
              let col = hex("#16245a");
              const r1 = Math.hypot(x + 0.12, z + 0.25);
              const r2 = Math.hypot(x - 0.12, z + 0.25);
              if (Math.abs(r1 - 0.11) < 0.012 || Math.abs(r2 - 0.11) < 0.012) col = hex("#f0c040");
              else if (r1 < 0.05 || r2 < 0.05) col = hex("#f6efd0");
              if (Math.abs(z - 0.45) < 0.006 && Math.abs(x) < 0.25) col = hex("#e05a8a");
              const star = Math.sin(x * 91) * Math.sin(z * 73) > 0.985;
              if (star) col = hex("#ffffff");
              return lit(col, c.n);
            },
          });
        },
        { count: low ? 5000 : 11000 },
      ),
      rail: kitModel((k) => k.add(k.box(1, 0.06, 0.03), { even: true, flat: 0.3, color: (c) => lit(hex("#c9ccd2"), c.n) }), { count: low ? 220 : 420 }), // prettier-ignore
      flipper: kitModel((k) => k.add(k.roundedBox(FLIP.len, 0.04, FLIP.w, 4), { pos: [FLIP.len / 2, 0, 0], even: true, color: (c) => lit(hex("#f4f4f0"), c.n) }), { count: low ? 200 : 380 }), // prettier-ignore
      bumper: kitModel(
        (k) => {
          k.add(evenCylinder(0.055, 0.055, 0.05, "top"), { pos: [0, 0.025, 0], even: true, color: (c) => (c.n[1] > 0.5 ? hex("#ffe27a") : lit(hex("#d6382f"), c.n)) }); // prettier-ignore
          k.add(evenCylinder(0.062, 0.062, 0.012, true), { pos: [0, 0.006, 0], even: true, color: (c) => lit(hex("#f4f4f0"), c.n) }); // prettier-ignore
        },
        { count: low ? 220 : 420 },
      ),
      ball: kitModel(
        (k) =>
          k.add(k.sphere(BALL_R), {
            even: true,
            flat: 0.5,
            color: (c) => {
              // Chrome: the sky above bright, the table below dark blue.
              const up = c.n[1];
              const f = up > 0 ? 0.75 + 0.25 * up : 0.35 + 0.2 * (1 + up);
              const spec = Math.pow(Math.max(0, c.n[1] * 0.6 + c.n[2] * 0.6), 20);
              return [Math.min(1, f + spec), Math.min(1, f + spec), Math.min(1, f * 1.05 + spec)];
            },
          }),
        { count: low ? 140 : 240 },
      ),
      plunger: kitModel((k) => k.add(evenCylinder(0.018, 0.018, 0.12, true), { rot: [90, 0, 0], even: true, color: (c) => lit(hex("#b9bcc4"), c.n) }), { count: 120 }), // prettier-ignore
    };
  }

  // ---- The table ---------------------------------------------------------------------

  buildWorld() {
    const w = new World({ gravity: [0, -INTO, SLOPE], substeps: 6, sleepSpeed: 0, sleepAfter: Infinity, minHit: 0.05 }); // prettier-ignore
    this.world = w;
    w.plane([0, 1, 0], 0, { friction: 0.15, restitution: 0.1 });
    w.plane([0, -1, 0], -0.07, { friction: 0, restitution: 0.1 }); // the glass
    this.rails = [];
    const rail = (x0, z0, x1, z1, opts = {}) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ang = Math.atan2(-(z1 - z0), x1 - x0);
      const q = quat.axisAngle([0, 1, 0], ang);
      const b = new Body({ pos: [(x0 + x1) / 2, 0.03, (z0 + z1) / 2], quat: q, mass: 0, solid: { type: "box", half: [len / 2, 0.03, 0.015] }, restitution: opts.bounce ?? 0.55, friction: 0.1 }); // prettier-ignore
      w.add(b);
      this.rails.push({ body: b, len, q, pos: b.pos.slice() });
      return b;
    };
    const top = -L / 2;
    const bot = L / 2;
    rail(-W / 2, top + 0.15, -W / 2, bot); // left wall
    rail(W / 2, top + 0.15, W / 2, bot); // right wall
    rail(-W / 2 + 0.15, top, W / 2 - 0.15, top); // top
    rail(-W / 2, top + 0.15, -W / 2 + 0.15, top); // the top corners, cut
    rail(W / 2 - 0.15, top, W / 2, top + 0.15);
    rail(LANE_X, -0.35, LANE_X, bot); // the plunger lane
    rail(LANE_X, 0.9, W / 2, 0.9, { bounce: 0.1 }); // the plunger's tip, under the ball
    // The inlane guides that feed the flippers, and the outlane walls.
    rail(-W / 2, 0.42, -FLIP.x - 0.01, FLIP.z - 0.02, { bounce: 0.3 });
    rail(LANE_X, 0.42, FLIP.x + 0.01, FLIP.z - 0.02, { bounce: 0.3 });
    // Pop bumpers.
    this.bumpers = [
      [-0.16, -0.45],
      [0.14, -0.5],
      [-0.02, -0.25],
    ].map(([x, z]) => {
      const b = new Body({ pos: [x, 0.025, z], mass: 0, solid: { type: "cylinder", r: 0.055, h: 0.05 }, restitution: 0.6 }); // prettier-ignore
      w.add(b);
      return { body: b, x, z, glow: 0 };
    });
    // Flippers: solid paddles turned about their outer ends.
    this.flippers = [-1, 1].map((side) => {
      const pivot = [side * FLIP.x, 0.02, FLIP.z];
      const b = new Body({ pos: pivot.slice(), mass: 0, solid: { type: "box", half: [FLIP.len / 2, 0.02, FLIP.w / 2] }, restitution: 0.35, friction: 0.4 }); // prettier-ignore
      w.add(b);
      return { side, pivot, body: b, ang: FLIP.down, held: false };
    });
    this.ballBody = w.add(new Body({ pos: [LANE_BALL, BALL_R, 0.86], mass: 1, solid: { type: "sphere", r: BALL_R }, restitution: 0.45, friction: 0.12, damping: 0.05, angDamping: 0.3 })); // prettier-ignore
  }

  // A flipper's pose: its paddle runs from the pivot toward the middle.
  placeFlipper(f, dt) {
    const want = f.held ? FLIP.up : FLIP.down;
    const was = f.ang;
    const d = want - f.ang;
    f.ang += clamp(d, -FLIP.speed * dt, FLIP.speed * dt);
    const omega = (f.ang - was) / Math.max(dt, 1e-6);
    // the paddle points inward: right flipper toward -x, left toward +x
    const yaw = f.side < 0 ? -f.ang : Math.PI + f.ang;
    const q = quat.axisAngle([0, 1, 0], yaw);
    const half = quat.rotate(q, [FLIP.len / 2, 0, 0]);
    const b = f.body;
    b.prevPos = b.pos.slice();
    b.prevQ = b.q.slice();
    b.pos = [f.pivot[0] + half[0], f.pivot[1], f.pivot[2] + half[2]];
    b.q = q;
    const wy = (f.side < 0 ? -1 : 1) * omega;
    b.omega = [0, wy, 0];
    // the paddle's middle moves with the turn
    b.vel = [wy * half[2], 0, -wy * half[0]];
    f.yaw = yaw;
  }

  reset() {
    const S = this.api.sprites;
    S.clear();
    this.buildWorld();
    this.table = S.add(this.models.table);
    // Each rail is built at its own length (a stretched one would thin out).
    const low = this.api.profile === "low";
    this.railModels ||= this.rails.map(
      (r) =>
      this.api.kitModel((k) => k.add(k.box(r.len, 0.06, 0.03), { even: true, flat: 0.3, color: (c) => [0.79, 0.8, 0.82].map((v) => v * (0.72 + 0.28 * c.n[1] + 0.08 * c.n[2])) }), { count: Math.round((low ? 400 : 800) * (r.len + 0.1)) }), // prettier-ignore
    );
    this.railSprites = this.rails.map((r, i) =>
      S.add(this.railModels[i], { pos: r.pos, quat: r.q }),
    );
    this.bumperSprites = this.bumpers.map((b) => S.add(this.models.bumper, { pos: [b.x, 0, b.z] }));
    this.flipperSprites = this.flippers.map(() => S.add(this.models.flipper));
    this.ballSprite = S.add(this.models.ball);
    this.plungerSprite = S.add(this.models.plunger);
    this.score = 0;
    this.balls = 3;
    this.over = false;
    this.pull = 0;
    this.t = 0;
    this.serve();
  }

  serve() {
    const b = this.ballBody;
    b.pos = [LANE_BALL, BALL_R, 0.86];
    b.prevPos = b.pos.slice();
    b.vel = [0, 0, 0];
    b.omega = [0, 0, 0];
    this.inLane = true;
    this.stillFor = 0;
  }

  step(dt, ctl) {
    this.t += dt;
    this.view = ctl.view;
    if (this.over) return;
    const inp = ctl.input;
    let left = inp.isHeld("left") || inp.isHeld("turnL");
    let right = inp.isHeld("right") || inp.isHeld("turnR");
    let plunge = inp.isHeld("fire") || inp.isHeld("down");
    // Touch: the left or right half of the table holds that flipper.
    const ptr = inp.pointer;
    if (ptr?.down && ptr.kind !== "mouse") {
      if (ptr.x < 0.5) left = true;
      else right = true;
      if (this.inLane) plunge = true;
    }
    if (ctl.demo) [left, right, plunge] = this.autopilot();
    for (const f of this.flippers) {
      const held = f.side < 0 ? left : right;
      if (held && !f.held) this.api.sound({ voice: "clack", f: 900, vol: 0.4 });
      f.held = held;
      this.placeFlipper(f, dt);
    }
    // The plunger: hold to pull back, let go to launch.
    if (this.inLane) {
      if (plunge) this.pull = Math.min(1, this.pull + dt * 1.5);
      else if (this.pull > 0.05) {
        const b = this.ballBody;
        if (b.pos[2] > 0.8) {
          b.vel = [0, 0, -(2.6 + 2.2 * this.pull)];
          this.api.sound({ voice: "thud", f: 220, vol: 0.5 });
        }
        this.pull = 0;
      } else this.pull = 0;
    }
    this.world.step(dt);
    const b = this.ballBody;
    if (b.pos[0] < LANE_X - 0.01) this.inLane = false;
    else if (b.pos[0] > LANE_X && b.pos[2] > -0.3) this.inLane = true; // back down the lane: launch again
    // Bumpers: a hit kicks the ball away and lights the cap.
    for (const h of this.world.takeHits()) {
      const bump = this.bumpers.find((u) => u.body === h.body || u.body === h.other);
      if (bump && (h.body === b || h.other === b)) {
        const d = [b.pos[0] - bump.x, 0, b.pos[2] - bump.z];
        const l = Math.hypot(d[0], d[2]) || 1;
        b.vel[0] += (d[0] / l) * 1.5;
        b.vel[2] += (d[2] / l) * 1.5;
        bump.glow = 1;
        this.score += 100;
        this.api.sound({ voice: "ding", f: 1100 + 120 * this.bumpers.indexOf(bump), vol: 0.45 });
      } else if (h.speed > 0.5 && this.rails.some((r) => r.body === h.body || r.body === h.other)) {
        this.api.sound({ voice: "click", f: 2200, vol: Math.min(0.3, h.speed * 0.08) });
      }
    }
    for (const u of this.bumpers) u.glow = Math.max(0, u.glow - dt * 3);
    // The drain: a ball past the flippers is lost.
    if (b.pos[2] > L / 2 + 0.05 || Math.abs(b.pos[0]) > W) this.drain();
    // A ball stuck still somewhere gets a nudge.
    const sp = Math.hypot(...b.vel);
    this.stillFor = sp < 0.03 && !this.inLane ? this.stillFor + dt : 0;
    if (this.stillFor > 2) {
      b.vel = [(this.rand() - 0.5) * 0.6, 0, 0.4];
      this.stillFor = 0;
    }
  }

  drain() {
    this.balls--;
    this.api.sound({ voice: "thud", f: 90, vol: 0.7 });
    if (this.balls <= 0) {
      this.over = true;
      return;
    }
    this.serve();
  }

  // The attract mode: flip when the ball comes near a flipper; launch.
  autopilot() {
    const b = this.ballBody.pos;
    const v = this.ballBody.vel;
    // (a ball resting on a raised flipper is let go, so it rolls down and
    // gets hit, as a player would)
    const near = (side) => b[2] > FLIP.z - 0.12 && b[2] < FLIP.z + 0.05 && v[2] > 0.12 && Math.sign(b[0] || side) === side && Math.abs(b[0]) < FLIP.x + 0.04; // prettier-ignore
    const plunge = this.inLane && this.t % 2 < 1.4;
    return [near(-1), near(1), plunge];
  }

  onView() {}

  render(view) {
    this.view = view;
    const b = this.ballBody;
    this.ballSprite.pos = b.pos.slice();
    this.ballSprite.quat = b.q.slice();
    this.flippers.forEach((f, i) => {
      const s = this.flipperSprites[i];
      s.pos = f.pivot.slice();
      s.quat = quat.axisAngle([0, 1, 0], f.yaw ?? 0);
    });
    this.bumpers.forEach((u, i) => {
      const s = this.bumperSprites[i];
      if ((u.glow > 0.02) !== !!s.tint || u.glow > 0.02) this.api.sprites.setTint(s, u.glow > 0.02 ? [1, 0.95, 0.6, u.glow * 0.7] : null); // prettier-ignore
    });
    this.plungerSprite.pos = [LANE_BALL, 0.03, 0.95 + this.pull * 0.06];
  }

  camera(view, aspect) {
    // 2D: from straight above (the top of the table up the screen).
    // 3D: from the player's end, looking up the slope.
    const d2 = this.api.fitDistance(W + 0.15, L + 0.35, aspect);
    return {
      target: [0, 0, lerp(0.02, 0.08, view)],
      yaw: 0,
      pitch: lerp(Math.PI / 2 - 0.001, 0.62, view),
      distance: lerp(d2, this.api.fitDistance(W + 0.3, L * 1.15, aspect), view),
    };
  }

  stats() {
    return { score: this.score, balls: this.balls };
  }

  status() {
    return { over: this.over, title: "Game over", lines: [`Score ${this.score}`] };
  }
}
