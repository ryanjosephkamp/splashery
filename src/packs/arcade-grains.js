// Lane Arcade, G6: Grain Garden, a falling-sand box where every grain is a
// splat. Sand, water, oil, fire, seeds and stone, each with its own simple
// rule, sixty times a second:
//
//   sand   falls; slides off a pile at a slant; sinks through water and oil
//   water  falls, slides, and spreads sideways to find its level; puts out fire
//   oil    like water but lighter (water sinks under it); burns
//   fire   flickers upward and dies down to smoke; lights oil, plants and seeds
//   seed   falls like sand; a seed resting by water sprouts a plant that
//          grows up toward the light, leafing out and sometimes flowering
//   stone  stays where it is put (draw ledges and bowls)
//
// The box has depth (a few grains deep). In 2D you see it face on and paint
// through its whole depth; the switch tips it round so the box shows in 3D,
// grains and all, still running by the same rules. Paint with the mouse or
// a finger; pick what to pour from the row of buttons.

const MATS = {
  empty: 0,
  sand: 1,
  water: 2,
  oil: 3,
  fire: 4,
  seed: 5,
  plant: 6,
  stone: 7,
  smoke: 8,
  flower: 9,
};
const LIQUID = new Uint8Array(16);
LIQUID[MATS.water] = 1;
LIQUID[MATS.oil] = 1;
const BURNS = new Float32Array(16);
BURNS[MATS.oil] = 0.35;
BURNS[MATS.plant] = 0.06;
BURNS[MATS.flower] = 0.06;
BURNS[MATS.seed] = 0.08;

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const COLORS = {
  [MATS.sand]: [hex("#e3c27c"), hex("#cfa65c"), hex("#f0d596")],
  [MATS.water]: [hex("#3d86d8"), hex("#2f74c6"), hex("#5a9de6")],
  [MATS.oil]: [hex("#3a2a14"), hex("#4a3418"), hex("#2c200f")],
  [MATS.seed]: [hex("#8a5a2b"), hex("#a06b35"), hex("#7a4e24")],
  [MATS.plant]: [hex("#3f9a3a"), hex("#2f8a34"), hex("#5cb04a")],
  [MATS.stone]: [hex("#8b8f96"), hex("#7a7e85"), hex("#9da1a8")],
  [MATS.smoke]: [hex("#9a9a9a"), hex("#b0b0b0"), hex("#888888")],
  [MATS.flower]: [hex("#f06aa8"), hex("#f7d23e"), hex("#ffffff")],
};

export function createGrains(api) {
  return new Grains(api);
}

class Grains {
  constructor(api) {
    this.api = api;
    const p = api.profile;
    const dims = p === "low" ? [44, 56, 4] : p === "mid" ? [56, 72, 6] : [64, 82, 8];
    [this.GX, this.GY, this.GZ] = dims;
    this.cap = p === "low" ? 7000 : p === "mid" ? 14000 : 22000;
    this.cell = 2.0 / this.GY;
    this.size = [this.GX * this.cell, this.GY * this.cell, this.GZ * this.cell];
    this.rand = api.rand;
    const { kitModel } = api;
    const [w, h, d] = this.size;
    // The glass box: its twelve edges, thin and bright.
    this.boxModel = kitModel(
      (k) => {
        const e = 0.012;
        const add = (sx, sy, sz, pos) =>
          k.add(k.box(sx, sy, sz), { pos, even: true, flat: 0.4, color: (c) => { const f = 0.78 + 0.2 * c.n[1]; return [0.75 * f, 0.84 * f, 0.9 * f]; } }); // prettier-ignore
        for (const y of [-h / 2, h / 2])
          for (const z of [-d / 2, d / 2]) add(w + e, e, e, [0, y, z]);
        for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) add(e, h, e, [x, 0, z]);
        for (const x of [-w / 2, w / 2]) for (const y of [-h / 2, h / 2]) add(e, e, d, [x, y, 0]);
      },
      { count: p === "low" ? 2000 : 3600 },
    );
  }

  reset() {
    const S = this.api.sprites;
    S.clear();
    const { GX, GY, GZ } = this;
    const n = GX * GY * GZ;
    this.mat = new Uint8Array(n);
    this.slot = new Int32Array(n).fill(-1);
    this.aux = new Uint8Array(n); // fire's and smoke's life, a plant's growth
    this.stamp = new Uint8Array(n);
    this.tick = 0;
    this.box = S.add(this.boxModel);
    this.pts = this.api.points(this.cap, { size: this.cell * 0.42, flat: 1 });
    this.free = [];
    for (let i = this.cap - 1; i >= 0; i--) this.free.push(i);
    this.shade = new Float32Array(this.cap);
    for (let i = 0; i < this.cap; i++) this.shade[i] = this.rand();
    this.jit = new Float32Array(this.cap * 3);
    for (let i = 0; i < this.cap * 3; i++) this.jit[i] = (this.rand() - 0.5) * 0.3;
    this.grains = 0;
    this.plants = 0;
    this.yaw = 0;
    this.scene();
  }

  // A starting garden: two stone ledges, a dune, a pool, an oil slick.
  scene() {
    const { GX, GY, GZ } = this;
    for (let z = 0; z < GZ; z++) {
      for (let x = 0; x < GX; x++) {
        const dune = Math.round(6 + 4 * Math.sin(x * 0.11) + 2 * Math.sin(x * 0.37 + 1));
        for (let y = 0; y < dune; y++)
          this.put(x, y, z, x > GX * 0.62 && y > 2 ? MATS.water : MATS.sand);
      }
      for (let x = Math.round(GX * 0.12); x < GX * 0.38; x++)
        this.put(x, Math.round(GY * 0.55), z, MATS.stone);
      for (let x = Math.round(GX * 0.55); x < GX * 0.86; x++) this.put(x, Math.round(GY * 0.38) + Math.round((x - GX * 0.55) * 0.25), z, MATS.stone); // prettier-ignore
      for (let x = Math.round(GX * 0.15); x < GX * 0.35; x++)
        this.put(x, Math.round(GY * 0.55) + 1, z, MATS.sand);
    }
    for (let x = 4; x < GX * 0.3; x += 5) this.put(x, 12, Math.floor(GZ / 2), MATS.seed);
  }

  idx(x, y, z) {
    return x + this.GX * (y + this.GY * z);
  }

  // Puts a grain of `m` in an empty cell (or empties a cell, m = 0).
  put(x, y, z, m, life = 0) {
    const { GX, GY, GZ } = this;
    if (x < 0 || y < 0 || z < 0 || x >= GX || y >= GY || z >= GZ) return false;
    const i = this.idx(x, y, z);
    if (m === MATS.empty) {
      if (this.mat[i]) this.kill(i);
      return true;
    }
    if (this.mat[i]) return false;
    const s = this.free.pop();
    if (s === undefined) return false;
    this.mat[i] = m;
    this.slot[i] = s;
    this.aux[i] =
      life || (m === MATS.fire ? 40 + ((this.rand() * 30) | 0) : m === MATS.smoke ? 60 : 0);
    this.grains++;
    this.paint(s, m, this.aux[i]);
    this.place(i, s);
    return true;
  }

  kill(i) {
    const s = this.slot[i];
    if (s >= 0) {
      this.pts.hide(s);
      this.free.push(s);
      this.grains--;
    }
    if (this.mat[i] === MATS.plant || this.mat[i] === MATS.flower)
      this.plants = Math.max(0, this.plants - 1);
    this.mat[i] = 0;
    this.slot[i] = -1;
    this.aux[i] = 0;
  }

  // Changes a grain into another kind in place.
  become(i, m, life = 0) {
    this.mat[i] = m;
    this.aux[i] = life;
    this.paint(this.slot[i], m, life);
  }

  paint(s, m, life) {
    const sh = this.shade[s];
    let c;
    if (m === MATS.fire) {
      const f = Math.min(1, life / 60);
      c = [1, 0.35 + 0.5 * f * sh, 0.08 + 0.2 * f * f];
      this.pts.color(s, c[0] * 1.15, c[1] * 1.1, c[2], 1);
      return;
    }
    const pal = COLORS[m];
    if (m === MATS.flower) c = pal[(sh * 3) | 0];
    else c = mixc(pal[0], sh < 0.5 ? pal[1] : pal[2], Math.abs(sh - 0.5) * 2);
    const a = m === MATS.water ? 0.86 : m === MATS.smoke ? 0.45 : 1;
    this.pts.color(s, c[0], c[1], c[2], a);
  }

  place(i, s) {
    const { GX, GY } = this;
    const x = i % GX;
    const y = ((i / GX) | 0) % GY;
    const z = (i / (GX * GY)) | 0;
    const c = this.cell;
    const [w, h, d] = this.size;
    const j = s * 3;
    this.pts.set(s, -w / 2 + (x + 0.5 + this.jit[j]) * c, -h / 2 + (y + 0.5 + this.jit[j + 1] * 0.5) * c, -d / 2 + (z + 0.5 + this.jit[j + 2]) * c); // prettier-ignore
  }

  swap(i, j) {
    const m = this.mat[i];
    const s = this.slot[i];
    const a = this.aux[i];
    this.mat[i] = this.mat[j];
    this.slot[i] = this.slot[j];
    this.aux[i] = this.aux[j];
    this.mat[j] = m;
    this.slot[j] = s;
    this.aux[j] = a;
    if (this.slot[i] >= 0) this.place(i, this.slot[i]);
    if (s >= 0) this.place(j, s);
    this.stamp[i] = this.stamp[j] = this.tickStamp;
  }

  // ---- The rules -----------------------------------------------------------------

  stepCells() {
    const { GX, GY, GZ, mat } = this;
    this.tick++;
    this.tickStamp = (this.tick & 254) + 1;
    const flip = this.tick & 1;
    const plane = GX * GY;
    const R = this.rand;
    for (let y = 0; y < GY; y++) {
      for (let zz = 0; zz < GZ; zz++) {
        const z = flip ? zz : GZ - 1 - zz;
        for (let xx = 0; xx < GX; xx++) {
          const x = flip ? xx : GX - 1 - xx;
          const i = x + GX * y + plane * z;
          const m = mat[i];
          if (!m || m === MATS.stone || this.stamp[i] === this.tickStamp) continue;
          if (m === MATS.sand || m === MATS.seed) {
            if (y > 0) {
              const b = i - GX;
              if (!mat[b] || LIQUID[mat[b]]) {
                this.swap(i, b);
                continue;
              }
              const j = this.diag(x, y, z, i, (mm) => !mm || LIQUID[mm]);
              if (j >= 0) {
                this.swap(i, j);
                continue;
              }
            }
            if (m === MATS.seed && R() < 0.02 && this.near(x, y, z, MATS.water)) {
              this.become(i, MATS.plant, 8 + ((R() * 14) | 0));
              this.plants++;
              this.api.sound({ voice: "pop", f: 900, vol: 0.15 });
            }
          } else if (m === MATS.water || m === MATS.oil) {
            if (y > 0) {
              const b = i - GX;
              const mb = mat[b];
              if (!mb || (m === MATS.water && mb === MATS.oil)) {
                this.swap(i, b);
                continue;
              }
              const j = this.diag(x, y, z, i, (mm) => !mm);
              if (j >= 0) {
                this.swap(i, j);
                continue;
              }
            }
            // Spread sideways to find its level.
            const k = (R() * 4) | 0;
            const dx = k === 0 ? 1 : k === 1 ? -1 : 0;
            const dz = k === 2 ? 1 : k === 3 ? -1 : 0;
            const nx = x + dx;
            const nz = z + dz;
            if (nx >= 0 && nx < GX && nz >= 0 && nz < GZ) {
              const j = nx + GX * y + plane * nz;
              if (!mat[j]) this.swap(i, j);
            }
          } else if (m === MATS.fire) {
            const life = this.aux[i] - 1;
            if (life <= 0) {
              if (R() < 0.35) this.become(i, MATS.smoke, 50 + ((R() * 40) | 0));
              else this.kill(i);
              continue;
            }
            this.aux[i] = life;
            if (R() < 0.3) this.paint(this.slot[i], MATS.fire, life);
            // Light what burns next to it; water puts it out.
            let out = false;
            this.around(x, y, z, (j) => {
              const mj = mat[j];
              if (mj === MATS.water) out = true;
              else if (BURNS[mj] && R() < BURNS[mj]) {
                this.become(j, MATS.fire, mj === MATS.oil ? 70 : 45);
                if (mj === MATS.plant || mj === MATS.flower)
                  this.plants = Math.max(0, this.plants - 1);
              }
            });
            if (out) {
              this.become(i, MATS.smoke, 40);
              if (R() < 0.2) this.api.sound({ voice: "sizzle", vol: 0.12, decay: 0.4 });
              continue;
            }
            // Flicker upward.
            if (y < GY - 1 && R() < 0.5) {
              const u = i + GX;
              const dx = ((R() * 3) | 0) - 1;
              const j = x + dx >= 0 && x + dx < GX ? u + dx : u;
              if (!mat[j]) this.swap(i, j);
            }
          } else if (m === MATS.smoke) {
            const life = this.aux[i] - 1;
            if (life <= 0 || y >= GY - 1) {
              this.kill(i);
              continue;
            }
            this.aux[i] = life;
            if (R() < 0.6) {
              const dx = ((R() * 3) | 0) - 1;
              const j = i + GX + (x + dx >= 0 && x + dx < GX ? dx : 0);
              if (!mat[j]) this.swap(i, j);
            }
          } else if (m === MATS.plant) {
            // A growing tip reaches up (now and then a little to the side)
            // and flowers when it is done.
            const g = this.aux[i];
            if (g > 0 && R() < 0.05 && y < GY - 1) {
              const dx = R() < 0.25 ? (R() < 0.5 ? -1 : 1) : 0;
              const nx = Math.max(0, Math.min(GX - 1, x + dx));
              const j = nx + GX * (y + 1) + plane * z;
              if (!mat[j] || mat[j] === MATS.water) {
                if (mat[j]) this.kill(j);
                this.put(nx, y + 1, z, g === 1 && R() < 0.6 ? MATS.flower : MATS.plant, g - 1);
                this.plants++;
                this.aux[i] = 0;
                this.stamp[j] = this.tickStamp;
              }
            }
          }
        }
      }
    }
  }

  // A free cell one down and one to a side (in x or z), picked at random.
  diag(x, y, z, i, ok) {
    const { GX, GZ, mat } = this;
    const plane = GX * this.GY;
    const k0 = (this.rand() * 4) | 0;
    for (let t = 0; t < 4; t++) {
      const k = (k0 + t) & 3;
      const dx = k === 0 ? 1 : k === 1 ? -1 : 0;
      const dz = k === 2 ? 1 : k === 3 ? -1 : 0;
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nx >= GX || nz < 0 || nz >= GZ) continue;
      const j = nx + GX * (y - 1) + plane * nz;
      if (ok(mat[j])) return j;
    }
    return -1;
  }

  around(x, y, z, fn) {
    const { GX, GY, GZ } = this;
    const plane = GX * GY;
    if (x > 0) fn(x - 1 + GX * y + plane * z);
    if (x < GX - 1) fn(x + 1 + GX * y + plane * z);
    if (y > 0) fn(x + GX * (y - 1) + plane * z);
    if (y < GY - 1) fn(x + GX * (y + 1) + plane * z);
    if (z > 0) fn(x + GX * y + plane * (z - 1));
    if (z < GZ - 1) fn(x + GX * y + plane * (z + 1));
  }

  near(x, y, z, m) {
    let hit = false;
    this.around(x, y, z, (j) => {
      if (this.mat[j] === m) hit = true;
    });
    return hit;
  }

  // ---- Play ------------------------------------------------------------------------

  // Pours `m` in a round brush at (cx, cy), through the box's whole depth.
  pour(cx, cy, m, r = 2) {
    const R = this.rand;
    let n = 0;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + 0.5) continue;
        for (let z = 0; z < this.GZ; z++) {
          if (m !== MATS.empty && m !== MATS.stone && R() > 0.35) continue;
          if (this.put(cx + dx, cy + dy, z, m)) n++;
        }
      }
    return n;
  }

  // The cell under a pointer: where its ray meets the box's middle plane.
  cellAt(ptr) {
    const ray = this.api.ray?.(ptr.x, ptr.y);
    if (!ray || Math.abs(ray.dir[2]) < 1e-5) return null;
    const t = -ray.origin[2] / ray.dir[2];
    if (t < 0) return null;
    const px = ray.origin[0] + ray.dir[0] * t;
    const py = ray.origin[1] + ray.dir[1] * t;
    const [w, h] = this.size;
    return [Math.floor((px + w / 2) / this.cell), Math.floor((py + h / 2) / this.cell)];
  }

  step(dt, ctl) {
    this.view = ctl.view;
    // Q and E (or the pad's shoulder buttons) turn the box in 3D.
    if (ctl.input.isHeld("turnL")) this.yaw -= dt * 1.2;
    if (ctl.input.isHeld("turnR")) this.yaw += dt * 1.2;
    this.half = !this.half;
    if (this.half) return; // the grains move at 60 steps a second
    const m = MATS[ctl.choice] ?? MATS.sand;
    const ptr = ctl.input.pointer;
    if (!ctl.demo && ptr?.down) {
      const c = this.cellAt(ptr);
      if (c) {
        const n = this.pour(c[0], c[1], m, m === MATS.stone || m === MATS.empty ? 2 : 2);
        this.poured = (this.poured || 0) + n;
        if (n && this.tick % 6 === 0) this.api.sound(pourSound(m));
      }
    }
    if (ctl.demo) {
      // The attract mode pours by itself: sand, water and seeds from a
      // moving spout, and now and then a spark.
      const t = this.tick * (1 / 60);
      const x = Math.round(this.GX * (0.5 + 0.38 * Math.sin(t * 0.5)));
      const what = [MATS.sand, MATS.sand, MATS.water, MATS.seed, MATS.oil][Math.floor(t / 4) % 5];
      if (this.grains < this.cap * 0.8) this.pour(x, this.GY - 4, what, 1);
      if (this.tick % 420 === 200)
        this.pour(Math.round(this.GX * 0.7), Math.round(this.GY * 0.45), MATS.fire, 1);
    }
    this.stepCells();
  }

  onView() {}

  render() {
    this.pts.flush();
  }

  camera(view, aspect) {
    const [w, h] = this.size;
    const d2 = this.api.fitDistance(w + 0.25, h + 0.55, aspect);
    return {
      target: [0, view * -0.05 + 0.08 * (1 - view), 0],
      yaw: view * (0.62 + this.yaw),
      pitch: view * 0.42,
      distance: d2 * (1 - 0.08 * view),
    };
  }

  stats() {
    return { grains: this.grains, plants: this.plants };
  }

  status() {
    return { over: false };
  }
}

function pourSound(m) {
  if (m === MATS.water || m === MATS.oil)
    return { voice: "drip", f: m === MATS.oil ? 300 : 600, vol: 0.18 };
  if (m === MATS.fire) return { voice: "crackle", vol: 0.2, decay: 0.4 };
  if (m === MATS.stone) return { voice: "stone", f: 260, vol: 0.2, decay: 0.4 };
  if (m === MATS.empty) return null;
  return { voice: "patter", vol: 0.16, decay: 0.4 };
}

function mixc(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}
