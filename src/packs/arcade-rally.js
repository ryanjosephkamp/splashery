// Lane Arcade, G4: Volley Table, a two-paddle rally. Your paddle is at the
// near end, the computer's at the far end; the ball bounces off the side
// rails, and a ball that gets past a paddle is a point. Where it meets the
// paddle sets its angle, and a paddle moving as it hits puts a little spin
// on it, so it curves. First to seven.
//
// 2D: the table seen from straight above. 3D: the table tilts toward you,
// the camera low behind your paddle, and the same rally goes on.

const W = 1.5;
const H = 2.1;
const BALL_R = 0.035;
const PAD = { w: 0.3, h: 0.05 };
const NEAR = -H / 2 + 0.12;
const FAR = H / 2 - 0.12;
const WIN = 7;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createRally(api) {
  return new Rally(api);
}

class Rally {
  constructor(api) {
    this.api = api;
    this.q = api.q;
    this.skill = clamp(Number(api.options.skill) || 2, 1, 3);
    const low = api.profile === "low";
    const { kitModel } = api;
    const lit = (c, n, f = 1) => c.map((v) => v * (0.78 + 0.22 * n[1] + 0.1 * n[2]) * f);
    this.models = {
      table: kitModel(
        (k) => {
          // Green felt with a white center line and edge lines, wooden rails.
          k.add(k.box(W, H, 0.02), {
            pos: [0, 0, -0.02],
            even: true,
            flat: 0.2,
            color: (c) => {
              const x = c.lp[0];
              const y = c.lp[1];
              const line = Math.abs(y) < 0.008 || Math.abs(Math.abs(x) - W / 2 + 0.03) < 0.006 || Math.abs(Math.abs(y) - H / 2 + 0.03) < 0.006; // prettier-ignore
              const f = 0.92 + 0.05 * c.noise(x * 90, y * 90, 0);
              return line ? [0.93, 0.93, 0.9] : [0.12 * f, 0.42 * f, 0.26 * f];
            },
          });
          for (const s of [-1, 1])
            k.add(k.box(0.05, H + 0.1, 0.08), { pos: [s * (W / 2 + 0.025), 0, 0.01], even: true, flat: 0.3, color: (c) => lit([0.45, 0.3, 0.19], c.n) }); // prettier-ignore
        },
        { count: low ? 4000 : 9000 },
      ),
      you: kitModel((k) => k.add(k.roundedBox(PAD.w, PAD.h, 0.06, 4), { even: true, color: (c) => lit([0.9, 0.42, 0.18], c.n) }), { count: low ? 300 : 600 }), // prettier-ignore
      them: kitModel((k) => k.add(k.roundedBox(PAD.w, PAD.h, 0.06, 4), { even: true, color: (c) => lit([0.25, 0.48, 0.85], c.n) }), { count: low ? 300 : 600 }), // prettier-ignore
      ball: kitModel(
        (k) =>
          k.add(k.sphere(BALL_R), {
            even: true,
            flat: 0.5,
            color: (c) => {
              const l = Math.max(0, c.n[0] * -0.3 + c.n[1] * 0.6 + c.n[2] * 0.7);
              const f = 0.8 + 0.22 * l + 0.4 * Math.pow(l, 14);
              return [f, f * 0.97, f * 0.9];
            },
          }),
        { count: low ? 120 : 220 },
      ),
    };
  }

  reset() {
    const S = this.api.sprites;
    S.clear();
    this.table = S.add(this.models.table);
    this.you = { x: 0, vx: 0, sprite: S.add(this.models.you) };
    this.them = { x: 0, vx: 0, sprite: S.add(this.models.them) };
    this.ball = { p: [0, 0], v: [0, 0], spin: 0, sprite: S.add(this.models.ball) };
    this.score = 0;
    this.yours = 0;
    this.theirs = 0;
    this.over = false;
    this.t = 0;
    this.serve(1);
  }

  serve(dir) {
    const b = this.ball;
    b.p = [0, 0];
    b.v = [0, 0];
    b.spin = 0;
    this.serveDir = dir;
    this.serveAt = this.t + 0.9;
  }

  speed() {
    return 1.3 + 0.06 * (this.yours + this.theirs);
  }

  step(dt, ctl) {
    this.t += dt;
    this.view = ctl.view;
    if (this.over) return;
    const b = this.ball;
    // Your paddle: keys, the pointer, or (attract mode) the autopilot.
    const you = this.you;
    const x0 = you.x;
    if (ctl.demo) you.x += clamp(this.aim(you, NEAR) - you.x, -1.5 * dt, 1.5 * dt);
    else {
      you.x += ctl.input.axis[0] * 1.9 * dt;
      const ptr = ctl.input.pointer;
      if (ptr && (ptr.down || ptr.kind === "mouse")) {
        const hit = this.tableAt(ptr);
        if (hit) you.x += clamp(hit[0] - you.x, -3 * dt, 3 * dt);
      }
    }
    you.x = clamp(you.x, -W / 2 + PAD.w / 2, W / 2 - PAD.w / 2);
    you.vx = (you.x - x0) / dt;
    // The computer: follows the ball, a little late (skill sets how late).
    const them = this.them;
    const t0 = them.x;
    const top = [0.75, 1.05, 1.4][this.skill - 1];
    const want = b.v[1] > 0 ? this.aim(them, FAR) : 0;
    them.x += clamp(want - them.x, -top * dt, top * dt);
    them.x = clamp(them.x, -W / 2 + PAD.w / 2, W / 2 - PAD.w / 2);
    them.vx = (them.x - t0) / dt;
    if (b.v[0] === 0 && b.v[1] === 0) {
      if (this.t > this.serveAt || (ctl.pressed.has("fire") && this.serveDir < 0)) {
        const a = (this.rand() - 0.5) * 0.7;
        const sp = this.speed();
        b.v = [Math.sin(a) * sp, Math.cos(a) * sp * this.serveDir];
        this.api.sound({ voice: "pock", f: 700, vol: 0.4 });
      }
      return;
    }
    // The ball: spin curves it (a little sideways push that fades).
    b.v[0] += b.spin * dt * 1.6;
    b.spin *= Math.exp(-dt * 1.2);
    b.p[0] += b.v[0] * dt;
    b.p[1] += b.v[1] * dt;
    if (Math.abs(b.p[0]) > W / 2 - BALL_R) {
      b.p[0] = Math.sign(b.p[0]) * (W / 2 - BALL_R);
      b.v[0] = -b.v[0] * 0.95;
      b.spin *= -0.5;
      this.api.sound({ voice: "wood", f: 520, vol: 0.3, decay: 0.4 });
    }
    this.paddleHit(you, NEAR, 1);
    this.paddleHit(them, FAR, -1);
    if (b.p[1] < -H / 2 - 0.1) this.point(false);
    else if (b.p[1] > H / 2 + 0.1) this.point(true);
  }

  rand() {
    return this.api.rand();
  }

  // Where a paddle at `y` should be to meet the ball (with the bounces off
  // the rails, but not the spin's curve: so it is sometimes wrong).
  aim(pad, y) {
    const b = this.ball;
    if ((y - b.p[1]) * b.v[1] <= 0) return b.p[0] * 0.3;
    const t = (y - b.p[1]) / b.v[1];
    let x = b.p[0] + b.v[0] * t;
    const span = W - 2 * BALL_R;
    x += span / 2;
    x = ((x % (2 * span)) + 2 * span) % (2 * span);
    if (x > span) x = 2 * span - x;
    return x - span / 2;
  }

  paddleHit(pad, y, dir) {
    const b = this.ball;
    const face = y + (dir * PAD.h) / 2;
    if (b.v[1] * dir >= 0) return;
    if ((b.p[1] - face) * dir > BALL_R || (b.p[1] - y) * dir < -0.05) return;
    if (Math.abs(b.p[0] - pad.x) > PAD.w / 2 + BALL_R) return;
    const off = clamp((b.p[0] - pad.x) / (PAD.w / 2), -1, 1);
    const sp = this.speed();
    const a = off * 0.9;
    b.v = [Math.sin(a) * sp, Math.cos(a) * sp * dir];
    b.spin = clamp(pad.vx * 0.35, -1.2, 1.2);
    b.p[1] = face + dir * BALL_R;
    this.api.sound({ voice: "pock", f: 420 + 140 * Math.abs(off), vol: 0.7 });
  }

  point(yours) {
    if (yours) this.yours++;
    else this.theirs++;
    this.score = this.yours * 10;
    this.api.sound(yours ? { voice: "bell", notes: "E5 G5", step: 0.12, vol: 0.45 } : { voice: "thud", f: 100, vol: 0.6 }); // prettier-ignore
    if (this.yours >= WIN || this.theirs >= WIN) {
      this.over = true;
      this.won = this.yours >= WIN;
      return;
    }
    this.serve(yours ? 1 : -1);
  }

  // The table point under a pointer (its plane, tilted with the table).
  tableAt(ptr) {
    const ray = this.api.ray?.(ptr.x, ptr.y);
    if (!ray) return null;
    const M = this.tilt();
    const inv = [-M[0], -M[1], -M[2], M[3]];
    const o = this.q.qrot(inv, ray.origin);
    const d = this.q.qrot(inv, ray.dir);
    if (Math.abs(d[2]) < 1e-6) return null;
    const t = -o[2] / d[2];
    return t > 0 ? [o[0] + d[0] * t, o[1] + d[1] * t] : null;
  }

  tilt() {
    return this.q.qaxis([1, 0, 0], -1.2 * (this.view || 0));
  }

  onView() {}

  render(view) {
    this.view = view;
    const M = this.tilt();
    const q = this.q;
    const put = (s, x, y, z = 0) => {
      s.pos = q.qrot(M, [x, y, z]);
      s.quat = M;
    };
    put(this.table, 0, 0);
    put(this.you.sprite, this.you.x, NEAR, 0.03);
    put(this.them.sprite, this.them.x, FAR, 0.03);
    put(this.ball.sprite, this.ball.p[0], this.ball.p[1], BALL_R + 0.005);
    this.ball.sprite.fade = this.over ? 0 : 1;
  }

  camera(view, aspect) {
    const d2 = this.api.fitDistance(W + 0.3, H + 0.6, aspect);
    return {
      target: [0, lerp(0.08, 0.15, view), lerp(0, -0.3, view)],
      yaw: 0,
      pitch: lerp(0, 0.38, view),
      distance: lerp(d2, this.api.fitDistance(W + 0.7, 2.3, aspect), view),
    };
  }

  stats() {
    return { score: this.score, you: this.yours, them: this.theirs };
  }

  status() {
    return { over: this.over, won: this.won, title: this.won ? "You won the rally!" : "The computer won", lines: [`${this.yours} to ${this.theirs}`] }; // prettier-ignore
  }
}
