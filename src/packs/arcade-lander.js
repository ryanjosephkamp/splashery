// Lane Arcade, G11: Soft Landing, a lander on real ground. The ground is
// real elevation from NASA's public-domain maps (tools/arc-terrain.mjs):
// the Moon's from LRO's laser altimeter (with LRO's own color), Mars's from
// Mars Global Surveyor's (colored by height). Fly down onto a flat spot:
// slow, upright and on level ground, or the lander breaks apart.
//
// 2D: a slice straight through the real ground (its true profile, the
// height drawn taller than life so the shape reads). 3D: the camera rises
// and the ground around the slice shows, the whole patch of real terrain;
// the lander keeps flying in the slice, by the same rules.

import { evenBox } from "./even.js";

const GROUND_W = 2.4; // the patch's width in game units
const RELIEF = 0.5; // the tallest relief, in game units, after stretching
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

let TERRAIN = null;
async function loadTerrain() {
  if (TERRAIN) return TERRAIN;
  const url = new URL("../../assets/toys/soft-landing/terrain.json", import.meta.url);
  const j = await (await fetch(url)).json();
  const dec = (b64, Arr) => {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Arr(u8.buffer);
  };
  TERRAIN = j.sites.map((s) => ({ ...s, h: dec(s.heights, Uint16Array), c: dec(s.colors, Uint8Array) })); // prettier-ignore
  return TERRAIN;
}

export async function createLander(api) {
  const sites = await loadTerrain();
  return new Lander(api, sites);
}

class Lander {
  constructor(api, sites) {
    this.api = api;
    this.q = api.q;
    this.rand = api.rand;
    const world = api.options.world === "mars" ? "Mars" : "Moon";
    this.sites = sites.filter((s) => s.world === world);
    this.world = world;
    this.g = world === "Mars" ? 0.32 : 0.16;
    const low = api.profile === "low";
    this.per = low ? 1 : 2; // splats a ground cell
    const { kitModel } = api;
    const lit = (c, n, f = 1) => c.map((v) => v * (0.72 + 0.26 * n[1] + 0.12 * n[2]) * f);
    this.landerModel = kitModel(
      (k) => {
        // A squat lander: a gold-foil body, a gray top stage, four legs
        // with round feet, and an engine bell under it.
        k.add(evenBox(0.09, 0.05, 0.09), { pos: [0, 0.035, 0], even: true, color: (c) => lit([0.86, 0.66, 0.24], c.n, 0.95 + 0.1 * Math.sin(c.p[0] * 300) * Math.sin(c.p[2] * 260)) }); // prettier-ignore
        k.add(evenBox(0.07, 0.04, 0.07), { pos: [0, 0.08, 0], even: true, color: (c) => lit([0.72, 0.72, 0.74], c.n) }); // prettier-ignore
        k.add(k.cone(0.025, 0.012, 0.03), { pos: [0, -0.002, 0], even: true, color: (c) => lit([0.35, 0.33, 0.32], c.n) }); // prettier-ignore
        for (const [sx, sz] of [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]) {
          k.add(k.tube((t) => [sx * (0.04 + 0.035 * t), 0.03 - 0.05 * t, sz * (0.04 + 0.035 * t)], 0.004), { even: true, color: [0.7, 0.7, 0.72] }); // prettier-ignore
          k.add(k.disc(0.012), {
            pos: [sx * 0.075, -0.02, sz * 0.075],
            even: true,
            color: [0.65, 0.65, 0.66],
          });
        }
      },
      { count: low ? 500 : 900 },
    );
    this.flameModel = kitModel(
      (k) =>
        k.cloud({ share: 1 }, (rand) => {
          const t = rand();
          return { p: [(rand() - 0.5) * 0.02 * (1 - t), -0.015 - t * 0.09, (rand() - 0.5) * 0.02 * (1 - t)], color: [1, 0.7 + 0.3 * (1 - t), 0.35 * (1 - t)], size: 1.2, opacity: 0.8 * (1 - t) }; // prettier-ignore
        }),
      { count: low ? 60 : 110 },
    );
    this.padModel = kitModel((k) => k.add(k.sphere(0.008), { color: [0.4, 1, 0.55] }), {
      count: 12,
    });
    this.starModel = kitModel(
      (k) => k.cloud({ share: 1 }, (rand) => ({ p: [(rand() - 0.5) * 8, 0.6 + rand() * 3, -1.5 - rand() * 2], color: "#eef2ff", opacity: 0.3 + 0.6 * rand(), size: 0.7 })), // prettier-ignore
      { count: low ? 200 : 500 },
    );
  }

  // ---- The ground --------------------------------------------------------------------

  // The site's ground as two models (the cells behind the slice, and in
  // front of it), and its profile along the slice.
  buildGround(site) {
    const { makeModel } = this.api;
    const { cols, rows } = site;
    const W = GROUND_W;
    const D = (W * site.depthM) / site.widthM;
    const stretch = (RELIEF / (site.highM - site.lowM || 1)) * (site.widthM / W); // real height times this
    this.stretch = stretch;
    this.D = D;
    const relief = site.highM - site.lowM;
    const hAt = (i, j) =>
      (site.h[clamp(j, 0, rows - 1) * cols + clamp(i, 0, cols - 1)] / 65535) * relief; // meters above lowest
    const yOf = (m) => (m / relief) * RELIEF - 0.55;
    const slice = Math.floor(rows / 2);
    this.slice = slice;
    const sun = norm3([0.75, 0.45, 0.3]); // low from the east: craters cast their shading
    const make = (j0, j1) => {
      const n = (j1 - j0) * cols * this.per;
      const m = makeModel(n);
      let k = 0;
      for (let j = j0; j < j1; j++)
        for (let i = 0; i < cols; i++) {
          const dx = (((hAt(i + 1, j) - hAt(i - 1, j)) / relief) * RELIEF) / ((2 * W) / cols);
          const dz = (((hAt(i, j + 1) - hAt(i, j - 1)) / relief) * RELIEF) / ((2 * D) / rows);
          const nn = norm3([-dx, 1, -dz]);
          const l = clamp(dot3(nn, sun), 0, 1);
          const o = (j * cols + i) * 3;
          const base = [site.c[o] / 255, site.c[o + 1] / 255, site.c[o + 2] / 255].map(
            (v) => v * 0.62,
          );
          const f = 0.55 + 0.6 * l;
          for (let s = 0; s < this.per; s++) {
            const ox = this.per > 1 ? (s - 0.5) * 0.5 : 0;
            const x = -W / 2 + ((i + 0.5 + ox) / cols) * W;
            const z = -D / 2 + ((j + 0.5) / rows) * D;
            m.pos.set([x, yOf(hAt(i, j)), z], k * 3);
            m.color.set([base[0] * f, base[1] * f, base[2] * f, 1], k * 4);
            const sz = ((W / cols) * (this.per > 1 ? 0.72 : 1.0)) / Math.max(0.35, nn[1]); // steep ground: a longer cell
            m.scale.set([sz, sz, sz * 0.7], k * 3);
            m.rot.set(this.q.qfromto([0, 0, 1], nn), k * 4);
            k++;
          }
        }
      return m;
    };
    // The slice: its heights (in game units) at many points across.
    const prof = new Float32Array(cols);
    for (let i = 0; i < cols; i++) prof[i] = yOf(hAt(i, slice));
    this.profile = prof;
    this.sliceZ = -D / 2 + ((slice + 0.5) / rows) * D;
    return { back: make(0, slice + 1), front: make(slice + 1, rows) };
  }

  groundY(x) {
    const cols = this.profile.length;
    const u = ((x + GROUND_W / 2) / GROUND_W) * cols - 0.5;
    const i = clamp(Math.floor(u), 0, cols - 2);
    const f = clamp(u - i, 0, 1);
    return this.profile[i] * (1 - f) + this.profile[i + 1] * f;
  }

  // Flat stretches of the slice wide enough to land on.
  findPads() {
    const cols = this.profile.length;
    const pads = [];
    const need = Math.max(3, Math.round((0.12 / GROUND_W) * cols));
    let i = 2;
    while (i < cols - need - 2) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = 0; k < need; k++) {
        lo = Math.min(lo, this.profile[i + k]);
        hi = Math.max(hi, this.profile[i + k]);
      }
      if (hi - lo < 0.012) {
        pads.push({ x0: -GROUND_W / 2 + (i / cols) * GROUND_W, x1: -GROUND_W / 2 + ((i + need) / cols) * GROUND_W, y: (lo + hi) / 2 }); // prettier-ignore
        i += need + 4;
      } else i++;
    }
    return pads;
  }

  // ---- The game ----------------------------------------------------------------------

  reset() {
    this.score = 0;
    this.lives = 3;
    this.siteIndex = Math.max(
      0,
      this.sites.findIndex((s) => s.id === this.api.options.site),
    );
    this.over = false;
    this.startSite();
  }

  startSite() {
    const S = this.api.sprites;
    S.clear();
    const site = this.sites[this.siteIndex % this.sites.length];
    this.site = site;
    const g = this.buildGround(site);
    this.stars = S.add(this.starModel);
    this.back = S.add(g.back);
    this.front = S.add(g.front, { fade: 0 });
    this.pads = this.findPads();
    this.padSprites = [];
    for (const p of this.pads)
      for (let k = 0; k < 2; k++) {
        const s = S.add(this.padModel, { pos: [k ? p.x1 : p.x0, p.y + 0.012, this.sliceZ] });
        if (s) this.padSprites.push(s);
      }
    this.ship = { p: [-GROUND_W * 0.3, 0.75], v: [0.12, 0], a: 0, fuel: 100, state: "fly", sprite: S.add(this.landerModel), flame: S.add(this.flameModel, { fade: 0 }) }; // prettier-ignore
    this.t = 0;
    this.banner = { title: site.name, lines: [`${site.world} · heights shown ${Math.round(this.stretch)}× taller than life`], until: 2.4 }; // prettier-ignore
  }

  step(dt, ctl) {
    this.t += dt;
    this.view = ctl.view;
    if (this.banner && (this.banner.until -= dt) <= 0) this.banner = null;
    const sh = this.ship;
    if (sh.state === "crashed" || sh.state === "landed") {
      if (sh.pieces) this.api.stepPieces(sh.sprite, dt, { gravity: this.g * 3, floor: this.groundY(sh.p[0]), bounce: 0.3, fadeOut: 0.6 }); // prettier-ignore
      if (this.t > sh.nextAt && !this.over) {
        if (sh.state === "landed") this.siteIndex++;
        this.startSite();
      }
      return;
    }
    // Controls: turn and thrust (or the autopilot in the attract mode).
    let turn = -ctl.input.axis[0];
    let thrust = ctl.input.axis[1] > 0.3 || ctl.input.isHeld("fire");
    if (ctl.demo) [turn, thrust] = this.autopilot();
    sh.a = clamp(sh.a + turn * 1.6 * dt, -1.3, 1.3);
    sh.thrust = thrust && sh.fuel > 0;
    if (sh.thrust) {
      const T = this.g * 2.4;
      sh.v[0] += -Math.sin(sh.a) * T * dt;
      sh.v[1] += Math.cos(sh.a) * T * dt;
      sh.fuel = Math.max(0, sh.fuel - 9 * dt);
      if (this.t - (this.lastHum || 0) > 0.22) {
        this.lastHum = this.t;
        this.api.sound({ voice: "rumble", vol: 0.14, decay: 0.3 });
      }
    }
    sh.v[1] -= this.g * dt;
    sh.p[0] += sh.v[0] * dt;
    sh.p[1] += sh.v[1] * dt;
    // The sides of the patch: the lander stays over the real ground.
    if (Math.abs(sh.p[0]) > GROUND_W / 2 - 0.06) {
      sh.p[0] = Math.sign(sh.p[0]) * (GROUND_W / 2 - 0.06);
      sh.v[0] = 0;
    }
    // Touchdown: the feet meet the ground.
    const foot = 0.022;
    const gy = this.groundY(sh.p[0]);
    if (sh.p[1] - foot <= gy) {
      const slope = Math.abs(this.groundY(sh.p[0] + 0.07) - this.groundY(sh.p[0] - 0.07)) / 0.14;
      const ok = Math.abs(sh.v[1]) < 0.11 && Math.abs(sh.v[0]) < 0.08 && Math.abs(sh.a) < 0.22 && slope < 0.18; // prettier-ignore
      sh.p[1] = gy + foot;
      if (ok) {
        sh.state = "landed";
        const pad = this.pads.some((p) => sh.p[0] > p.x0 - 0.02 && sh.p[0] < p.x1 + 0.02);
        const pts = Math.round(50 + sh.fuel * 2 + (pad ? 100 : 0));
        this.score += pts;
        this.banner = {
          title: "Touchdown!",
          lines: [`${pts} points${pad ? " (a flat spot)" : ""}`],
          until: 2.2,
        };
        this.api.sound([{ voice: "thud", f: 140, vol: 0.5 }, { voice: "bell", at: 0.2, notes: "C5 E5 G5", step: 0.12, vol: 0.4 }]); // prettier-ignore
      } else {
        sh.state = "crashed";
        this.lives--;
        // The lander breaks apart into real pieces.
        this.api.sprites.shatter(sh.sprite, 9, { rand: this.rand, vel: [sh.v[0] * 0.5, Math.abs(sh.v[1]) * 0.6, 0], from: [sh.p[0], gy, this.sliceZ], kick: 0.35, spin: 9, life: 2.4 }); // prettier-ignore
        sh.pieces = true;
        this.banner = { title: "Crashed", lines: [Math.abs(sh.v[1]) >= 0.11 ? "Too fast coming down" : slope >= 0.18 ? "The ground was too steep" : Math.abs(sh.a) >= 0.22 ? "It wasn't upright" : "Too fast sideways"], until: 2.2 }; // prettier-ignore
        this.api.sound([{ voice: "crack", vol: 0.9 }, { voice: "clatter", at: 0.05, vol: 0.7 }, { voice: "rumble", at: 0.05, vol: 0.5, decay: 0.8 }]); // prettier-ignore
        if (this.lives <= 0) this.over = true;
      }
      sh.thrust = false;
      sh.nextAt = this.t + 2.6;
    }
  }

  // The attract mode: drift over the nearest pad and come down slowly.
  autopilot() {
    const sh = this.ship;
    const pad = this.pads.reduce((b, p) => (!b || Math.abs((p.x0 + p.x1) / 2 - sh.p[0]) < Math.abs((b.x0 + b.x1) / 2 - sh.p[0]) ? p : b), null); // prettier-ignore
    const tx = pad ? (pad.x0 + pad.x1) / 2 : sh.p[0];
    const dx = tx - sh.p[0];
    const wantVx = clamp(dx * 0.8, -0.15, 0.15);
    const wantA = clamp(-(wantVx - sh.v[0]) * 3, -0.35, 0.35) * (Math.abs(dx) > 0.03 ? 1 : 0.2);
    const turn = clamp((wantA - sh.a) * 4, -1, 1);
    const h = sh.p[1] - this.groundY(sh.p[0]);
    const wantVy = Math.abs(dx) > 0.05 ? clamp(-h * 0.4, -0.2, 0.05) : -0.06 - h * 0.15;
    return [turn, sh.v[1] < wantVy];
  }

  onView() {}

  render(view) {
    this.view = view;
    const sh = this.ship;
    const z = this.sliceZ;
    if (!sh.pieces) {
      sh.sprite.pos = [sh.p[0], sh.p[1], z];
      sh.sprite.quat = this.q.qaxis([0, 0, 1], sh.a);
    }
    sh.flame.pos = [sh.p[0], sh.p[1], z];
    sh.flame.quat = this.q.qaxis([0, 0, 1], sh.a);
    sh.flame.fade = sh.thrust ? 0.6 + 0.4 * Math.sin(this.t * 45) : 0;
    // 2D shows only the slice and the ground behind it; 3D the whole patch.
    if (this.front) this.front.fade = clamp(view * 1.4, 0, 1);
  }

  camera(view, aspect) {
    const d2 = this.api.fitDistance(GROUND_W + 0.2, 1.75, aspect);
    return {
      target: [0, lerp(0.05, -0.25, view), lerp(this.sliceZ, 0, view)],
      yaw: lerp(0, 0.5, view),
      pitch: lerp(0, 0.5, view),
      distance: lerp(d2, this.api.fitDistance(GROUND_W * 1.25, 1.6, aspect), view),
    };
  }

  stats() {
    const sh = this.ship;
    return {
      score: this.score,
      lives: this.lives,
      fuel: Math.round(sh.fuel),
      down: Math.round(-sh.v[1] * 100),
    };
  }

  status() {
    return {
      over: this.over && this.ship.state === "crashed" && this.t > this.ship.nextAt - 0.5,
      title: "Out of landers",
      lines: [`Score ${this.score}`],
      banner: this.banner ? { title: this.banner.title, lines: this.banner.lines } : null,
    };
  }
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm3(a) {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
