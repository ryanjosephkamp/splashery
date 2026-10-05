// Lane Arcade, G5: Stone Belt, a rock-blasting game with real asteroids.
// The rocks are the shapes of real ones (Bennu, Itokawa, Eros, Kleopatra,
// Geographos, Toutatis and Golevka, from NASA's public-domain 3D models:
// tools/arc-rocks.mjs). They drift and tumble across a field that wraps
// round at its edges; a hit splits a big rock into two smaller ones, and a
// small one into dust, with real chips flying off each time. Your ship
// turns, thrusts and fires; a rock that hits it costs a ship.
//
// 2D: the field from straight above. 3D: the camera drops in behind your
// ship and follows it (the rules stay on the field's plane), so the rocks
// show their real shapes as they tumble past.

import { evenBox } from "./even.js";

const SIZES = [
  { r: 0.2, pts: 1600, points: 20, splat: 0.022 },
  { r: 0.12, pts: 900, points: 50, splat: 0.017 },
  { r: 0.065, pts: 420, points: 100, splat: 0.012 },
];
const SHOT_SPEED = 2.2;
const SHOT_LIFE = 0.75;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

let ROCKS = null; // the shapes, loaded once

async function loadRocks() {
  if (ROCKS) return ROCKS;
  const url = new URL("../../assets/toys/stone-belt/rocks.json", import.meta.url);
  const j = await (await fetch(url)).json();
  ROCKS = j.rocks.map((r) => {
    const bin = atob(r.data);
    const b = new Int8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = (bin.charCodeAt(i) << 24) >> 24;
    return { id: r.id, name: r.name, n: r.n, data: b };
  });
  return ROCKS;
}

export async function createRocks(api) {
  const shapes = await loadRocks();
  return new StoneBelt(api, shapes);
}

class StoneBelt {
  constructor(api, shapes) {
    this.api = api;
    this.q = api.q;
    this.rand = api.rand;
    const low = api.profile === "low";
    const { kitModel, makeModel } = api;
    // Each rock in three sizes: its points as flat splats facing out, the
    // color of dark regolith lit from one side, a tint of its own.
    const tints = [[0.42, 0.4, 0.38], [0.52, 0.47, 0.4], [0.46, 0.44, 0.42], [0.5, 0.45, 0.43], [0.44, 0.42, 0.41], [0.48, 0.46, 0.4], [0.47, 0.43, 0.38]]; // prettier-ignore
    const L = norm3([-0.5, 0.6, 0.62]);
    this.models = shapes.map((sh, si) =>
      SIZES.map((sz) => {
        const n = Math.min(sh.n, low ? Math.round(sz.pts * 0.55) : sz.pts);
        const m = makeModel(n);
        const step = sh.n / n;
        for (let i = 0; i < n; i++) {
          const o = Math.floor(i * step) * 6;
          const d = sh.data;
          const p = [d[o] / 127, d[o + 1] / 127, d[o + 2] / 127];
          const nn = norm3([d[o + 3] / 127, d[o + 4] / 127, d[o + 5] / 127]);
          m.pos.set(
            p.map((v) => v * sz.r),
            i * 3,
          );
          // Lit from one side; hollows (normals turned from the middle) darker.
          const l = Math.max(0, dot3(nn, L));
          const hollow = clamp(dot3(nn, norm3(p)), 0, 1);
          const g = 0.88 + 0.24 * hash(i * 7.1 + si);
          const f = (0.35 + 0.75 * l) * (0.65 + 0.35 * hollow) * g;
          const t = tints[si % tints.length];
          m.color.set([t[0] * f, t[1] * f, t[2] * f, 1], i * 4);
          const s = sz.splat * Math.sqrt(1600 / Math.max(1, n)) * (sz.r / 0.2) * 0.9;
          m.scale.set([s, s, s * 0.3], i * 3);
          m.rot.set(api.q.qfromto([0, 0, 1], nn), i * 4);
        }
        return m;
      }),
    );
    this.ship = kitModel(
      (k) => {
        // A sleek dart: a pointed hull, two swept fins, a glowing engine.
        k.add(k.cone(0.035, 0.0, 0.16), { rot: [0, 0, -90], even: true, color: (c) => shadeC([0.85, 0.87, 0.9], c.n) }); // prettier-ignore
        for (const s of [-1, 1])
          k.add(evenBox(0.06, 0.012, 0.07), { pos: [-0.03, 0, s * 0.045], rot: [0, s * 25, 0], even: true, color: (c) => shadeC([0.85, 0.35, 0.18], c.n) }); // prettier-ignore
        k.add(k.sphere(0.022), {
          pos: [-0.065, 0, 0],
          even: true,
          color: [1, 0.75, 0.35],
          weight: 3,
        });
      },
      { count: low ? 300 : 600 },
    );
    this.flame = kitModel(
      (k) =>
        k.cloud({ share: 1 }, (rand) => {
          const t = rand();
          return { p: [-0.07 - t * 0.12, (rand() - 0.5) * 0.03 * (1 - t), (rand() - 0.5) * 0.03 * (1 - t)], color: [1, 0.55 + 0.4 * (1 - t), 0.2 * (1 - t)], size: 1.2, opacity: 0.85 * (1 - t) }; // prettier-ignore
        }),
      { count: low ? 60 : 120 },
    );
    this.shot = kitModel((k) => k.add(k.sphere(0.012), { color: [0.7, 1, 0.9] }), { count: 20 });
    this.stars = kitModel(
      (k) =>
        k.cloud({ share: 1 }, (rand) => ({ p: [(rand() - 0.5) * 6, (rand() - 0.5) * 6, -0.6 - rand() * 0.8], color: rand() < 0.5 ? "#e8eeff" : "#fff6e6", opacity: 0.4 + 0.6 * rand(), size: 0.6 + 0.8 * rand() })), // prettier-ignore
      { count: low ? 400 : 900 },
    );
  }

  reset() {
    const S = this.api.sprites;
    S.clear();
    const a = this.api.aspect();
    [this.W, this.H] = a < 1 ? [1.9, 2.7] : [3.0, 2.0];
    this.starSprite = S.add(this.stars);
    this.rocks = [];
    this.shots = [];
    this.dust = [];
    this.score = 0;
    this.lives = 3;
    this.wave = 0;
    this.over = false;
    this.t = 0;
    this.ship$ = { p: [0, 0], v: [0, 0], a: Math.PI / 2, alive: true, safe: 2, sprite: S.add(this.ship), flame: S.add(this.flame, { fade: 0 }) }; // prettier-ignore
    this.nextWave();
  }

  nextWave() {
    this.wave++;
    const n = Math.min(7, 2 + this.wave);
    for (let i = 0; i < n; i++) {
      // Big rocks from the edges, away from the ship.
      const edge = this.rand() < 0.5;
      const p = edge
        ? [(this.rand() - 0.5) * this.W, this.H / 2]
        : [this.W / 2, (this.rand() - 0.5) * this.H];
      this.addRock(p, 0);
    }
    if (this.wave > 1) this.api.sound({ voice: "bell", notes: "C5 G5", step: 0.15, vol: 0.4 });
  }

  addRock(p, size, from = null) {
    const k = (this.rand() * this.models.length) | 0;
    const sp = (0.15 + 0.12 * size + 0.1 * this.rand()) * (1 + 0.06 * this.wave);
    const dir = from
      ? Math.atan2(from[1], from[0]) + (this.rand() - 0.5) * 1.6
      : this.rand() * Math.PI * 2;
    const r = { p: p.slice(), v: [Math.cos(dir) * sp, Math.sin(dir) * sp], size, k, quat: this.q.qnorm([this.rand() - 0.5, this.rand() - 0.5, this.rand() - 0.5, this.rand() + 0.5]), spin: [this.rand() - 0.5, this.rand() - 0.5, this.rand() - 0.5].map((v) => v * (1.6 + size)) }; // prettier-ignore
    r.sprite = this.api.sprites.add(this.models[k][size]);
    if (!r.sprite) return;
    this.rocks.push(r);
  }

  wrap(p) {
    const { W, H } = this;
    if (p[0] > W / 2) p[0] -= W;
    if (p[0] < -W / 2) p[0] += W;
    if (p[1] > H / 2) p[1] -= H;
    if (p[1] < -H / 2) p[1] += H;
  }

  step(dt, ctl) {
    this.t += dt;
    this.view = ctl.view;
    const sh = this.ship$;
    const inp = ctl.input;
    // Rocks drift and tumble.
    for (const r of this.rocks) {
      r.p[0] += r.v[0] * dt;
      r.p[1] += r.v[1] * dt;
      this.wrap(r.p);
      const l = Math.hypot(...r.spin);
      r.quat = this.q.qnorm(this.q.qmul(this.q.qaxis(r.spin, l * dt), r.quat));
    }
    for (const d of this.dust)
      d.busy = this.api.stepPieces(d.sprite, dt, { gravity: 0, fadeOut: 0.6 });
    for (const d of this.dust.filter((x) => !x.busy)) this.api.sprites.remove(d.sprite);
    this.dust = this.dust.filter((x) => x.busy);
    if (this.over) return;
    // The ship: turn, thrust, fire.
    let turn = 0;
    let thrust = false;
    let fire = ctl.pressed.has("fire");
    if (ctl.demo) [turn, thrust, fire] = this.autopilot();
    else {
      turn = -inp.axis[0];
      thrust = inp.axis[1] > 0.3;
      if (inp.isHeld("fire") && this.t - (this.lastShot || 0) > 0.22) fire = true;
      // Touch: point where to go (the ship turns toward the finger and thrusts).
      const ptr = inp.pointer;
      if (ptr?.down && ptr.kind === "touch") {
        const hit = this.fieldAt(ptr);
        if (hit) {
          const want = Math.atan2(hit[1] - sh.p[1], hit[0] - sh.p[0]);
          turn = clamp(wrapA(want - sh.a) * 3, -1, 1);
          thrust =
            Math.abs(wrapA(want - sh.a)) < 0.5 &&
            Math.hypot(hit[0] - sh.p[0], hit[1] - sh.p[1]) > 0.25;
          if (this.t - (this.lastShot || 0) > 0.3) fire = true;
        }
      }
    }
    if (sh.alive) {
      sh.a += turn * 3.4 * dt;
      if (thrust) {
        sh.v[0] += Math.cos(sh.a) * 1.6 * dt;
        sh.v[1] += Math.sin(sh.a) * 1.6 * dt;
        if (this.t - (this.lastHum || 0) > 0.25) {
          this.lastHum = this.t;
          this.api.sound({ voice: "rumble", vol: 0.12, decay: 0.3 });
        }
      }
      sh.thrust = thrust;
      // A little drag, so the ship settles (space would not, but play does).
      sh.v[0] *= Math.exp(-dt * 0.6);
      sh.v[1] *= Math.exp(-dt * 0.6);
      sh.p[0] += sh.v[0] * dt;
      sh.p[1] += sh.v[1] * dt;
      this.wrap(sh.p);
      sh.safe = Math.max(0, sh.safe - dt);
      if (fire && this.t - (this.lastShot || 0) > 0.15) this.fire();
    } else if (this.t > sh.backAt) {
      sh.alive = true;
      sh.p = [0, 0];
      sh.v = [0, 0];
      sh.safe = 2.5;
    }
    // Shots.
    for (const s of this.shots) {
      s.p[0] += s.v[0] * dt;
      s.p[1] += s.v[1] * dt;
      this.wrap(s.p);
      s.life -= dt;
    }
    // Hits.
    for (const s of this.shots) {
      if (s.life <= 0) continue;
      for (const r of this.rocks) {
        if (r.dead) continue;
        const d = Math.hypot(...wrapD(s.p, r.p, this.W, this.H));
        if (d < SIZES[r.size].r * 0.85) {
          s.life = 0;
          this.breakRock(r, s);
          break;
        }
      }
    }
    if (sh.alive && sh.safe <= 0) {
      for (const r of this.rocks) {
        if (r.dead) continue;
        if (Math.hypot(...wrapD(sh.p, r.p, this.W, this.H)) < SIZES[r.size].r * 0.8 + 0.04) {
          this.loseShip();
          break;
        }
      }
    }
    for (const s of this.shots.filter((x) => x.life <= 0)) this.api.sprites.remove(s.sprite);
    this.shots = this.shots.filter((x) => x.life > 0);
    this.rocks = this.rocks.filter((r) => !r.dead);
    if (!this.rocks.length && !this.over) this.nextWave();
  }

  fire() {
    const sh = this.ship$;
    this.lastShot = this.t;
    const dir = [Math.cos(sh.a), Math.sin(sh.a)];
    const s = { p: [sh.p[0] + dir[0] * 0.09, sh.p[1] + dir[1] * 0.09], v: [sh.v[0] + dir[0] * SHOT_SPEED, sh.v[1] + dir[1] * SHOT_SPEED], life: SHOT_LIFE }; // prettier-ignore
    s.sprite = this.api.sprites.add(this.shot);
    if (!s.sprite) return;
    this.shots.push(s);
    this.api.sound({ voice: "zap", f: 1200, vol: 0.18, decay: 0.25 });
  }

  breakRock(r, s) {
    r.dead = true;
    this.score += SIZES[r.size].points;
    // Chips fly off: the rock's own splats, shattered, drifting and fading.
    const S = this.api.sprites;
    S.shatter(r.sprite, r.size === 2 ? 7 : 10, { rand: this.rand, vel: [r.v[0], r.v[1], 0], from: [s.p[0], s.p[1], 0], kick: 0.35, spin: 6, life: r.size === 2 ? 1.2 : 0.7 }); // prettier-ignore
    this.dust.push({ sprite: r.sprite });
    // ...and the bigger rocks split into two smaller ones.
    if (r.size < 2) {
      this.addRock(r.p, r.size + 1, s.v);
      this.addRock(r.p, r.size + 1, [-s.v[1], s.v[0]]);
    }
    this.api.sound(r.size === 0 ? [{ voice: "crack", vol: 0.8 }, { voice: "rumble", at: 0.03, vol: 0.4, decay: 0.6 }] : r.size === 1 ? { voice: "crack", vol: 0.6 } : { voice: "crunch", vol: 0.45 }); // prettier-ignore
  }

  loseShip() {
    const sh = this.ship$;
    sh.alive = false;
    this.lives--;
    this.api.sound([
      { voice: "crack", vol: 0.9 },
      { voice: "rumble", at: 0.04, vol: 0.7, decay: 1 },
    ]);
    if (this.lives <= 0) {
      this.over = true;
      return;
    }
    sh.backAt = this.t + 1.4;
  }

  // The attract mode: turn toward the nearest rock and fire; thrust away
  // from one that comes too close.
  autopilot() {
    const sh = this.ship$;
    let best = null;
    let bd = Infinity;
    for (const r of this.rocks) {
      const d = wrapD(r.p, sh.p, this.W, this.H);
      const l = Math.hypot(...d);
      if (l < bd) {
        bd = l;
        best = d;
      }
    }
    if (!best) return [0, false, false];
    const want = Math.atan2(best[1], best[0]);
    const e = wrapA(want - sh.a);
    return [clamp(e * 3, -1, 1), bd > 0.9 && Math.abs(e) < 0.4, Math.abs(e) < 0.25];
  }

  fieldAt(ptr) {
    const ray = this.api.ray?.(ptr.x, ptr.y);
    if (!ray || Math.abs(ray.dir[2]) < 1e-5) return null;
    const t = -ray.origin[2] / ray.dir[2];
    return t > 0 ? [ray.origin[0] + ray.dir[0] * t, ray.origin[1] + ray.dir[1] * t] : null;
  }

  onView() {}

  render(view) {
    this.view = view;
    const q = this.q;
    for (const r of this.rocks) {
      r.sprite.pos = [r.p[0], r.p[1], 0];
      r.sprite.quat = r.quat;
    }
    const sh = this.ship$;
    // The ship lies in the field's plane, nose along its heading.
    const turn = q.qaxis([0, 0, 1], sh.a);
    const bank = q.qaxis([1, 0, 0], Math.PI / 2); // its fins flat on the plane
    sh.sprite.pos = [sh.p[0], sh.p[1], 0];
    sh.sprite.quat = q.qmul(turn, bank);
    const blink = sh.safe > 0 ? 0.55 + 0.45 * Math.cos(this.t * 18) : 1;
    sh.sprite.fade = sh.alive && !this.over ? blink : 0;
    sh.flame.pos = sh.sprite.pos;
    sh.flame.quat = sh.sprite.quat;
    sh.flame.fade = sh.alive && sh.thrust ? 0.6 + 0.4 * Math.sin(this.t * 40) : 0;
    for (const s of this.shots) s.sprite.pos = [s.p[0], s.p[1], 0];
  }

  camera(view, aspect) {
    const d2 = this.api.fitDistance(this.W + 0.1, this.H + 0.4, aspect);
    const sh = this.ship$;
    // 3D: low behind the ship, looking along its heading (eased), the
    // heading up the screen. The field lies in the x-y plane.
    this.head = this.head === undefined ? sh.a : this.head + wrapA(sh.a - this.head) * 0.06;
    const h = [Math.cos(this.head), Math.sin(this.head), 0];
    const e = 0.42;
    const back = [-h[0] * Math.cos(e), -h[1] * Math.cos(e), Math.sin(e)];
    const pitch = Math.asin(clamp(back[1], -1, 1));
    const yaw = Math.atan2(back[0], back[2]);
    // the roll that turns the screen's up toward the heading
    const q = this.q.qmul(this.q.qaxis([0, 1, 0], yaw), this.q.qaxis([1, 0, 0], -pitch));
    const u0 = this.q.qrot(q, [0, 1, 0]);
    const r0 = this.q.qrot(q, [1, 0, 0]);
    const roll = Math.atan2(-dot3(h, r0), dot3(h, u0));
    const ahead = 0.35 * view;
    return {
      target: [lerp(0, sh.p[0] + h[0] * ahead, view), lerp(0.05, sh.p[1] + h[1] * ahead, view), 0],
      yaw: yaw * view,
      pitch: pitch * view,
      roll: roll * view,
      distance: lerp(d2, 1.5, view),
      ease: 0.12,
    };
  }

  stats() {
    return { score: this.score, lives: this.lives, wave: this.wave };
  }

  status() {
    return {
      over: this.over,
      title: "Out of ships",
      lines: [`Score ${this.score} · wave ${this.wave}`],
    };
  }
}

function hash(x) {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}
function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm3(a) {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function shadeC(c, n) {
  const f = 0.7 + 0.3 * n[1] + 0.12 * n[2];
  return c.map((v) => v * f);
}
function wrapA(a) {
  return ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
}
function wrapD(a, b, W, H) {
  let dx = a[0] - b[0];
  let dy = a[1] - b[1];
  if (dx > W / 2) dx -= W;
  if (dx < -W / 2) dx += W;
  if (dy > H / 2) dy -= H;
  if (dy < -H / 2) dy += H;
  return [dx, dy];
}
