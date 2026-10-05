// Lane Arcade, G8: Photo Dash, a run across your own photo. Open a photo
// (or play the sample): it becomes the landscape. The line where its sky
// meets its ground, found from the picture itself (the strongest change in
// brightness down each column), is the track. A glass marble rolls along
// it by itself, faster each lap; tap or press Space to jump the gaps, and
// catch the sparks.
//
// 2D: the photo face on, the track along its skyline. 3D: the photo rises
// into a relief (its bright parts nearer, its dark parts deeper) and the
// marble rolls along the same track on the relief, by the same rules.

import { crispModel } from "./arcade-crisp.js";

export const DASH = { file: null, name: "" };

const H = 2.0; // the photo's height in world units
const RELIEF = 0.35;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export async function createDash(api) {
  const g = new Dash(api);
  await g.load();
  return g;
}

class Dash {
  constructor(api) {
    this.api = api;
    this.q = api.q;
    this.rand = api.rand;
  }

  async load() {
    let src = this.api.options.source === "own" && DASH.file ? DASH.file : null;
    if (!src) {
      const url = new URL("../../assets/toys/picture-lab/photo.jpg", import.meta.url);
      src = await (await fetch(url)).blob();
    }
    const bmp = await createImageBitmap(src);
    const low = this.api.profile === "low";
    // (a finer photo since the owner's "please make sharper"; the blurs and
    // the track's smoothing below scale with it, so they stay the same size)
    const cols = low ? 160 : this.api.profile === "mid" ? 260 : 320;
    const sc = cols / 176;
    const rows = Math.max(40, Math.round((cols * bmp.height) / bmp.width));
    const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(cols, rows) : Object.assign(document.createElement("canvas"), { width: cols, height: rows }); // prettier-ignore
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(bmp, 0, 0, cols, rows);
    bmp.close?.();
    const px = g.getImageData(0, 0, cols, rows).data;
    this.cols = cols;
    this.rows = rows;
    this.W = (H * cols) / rows;
    this.px = px;
    const lum = new Float32Array(cols * rows);
    for (let i = 0; i < cols * rows; i++)
      lum[i] = (0.3 * px[i * 4] + 0.59 * px[i * 4 + 1] + 0.11 * px[i * 4 + 2]) / 255;
    // Smooth the brightness a little for the relief.
    const sm = new Float32Array(cols * rows);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        let a = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = clamp(x + dx, 0, cols - 1);
            const yy = clamp(y + dy, 0, rows - 1);
            a += lum[yy * cols + xx];
            n++;
          }
        sm[y * cols + x] = a / n;
      }
    this.lum = sm;
    // The relief's depth: the brightness smoothed much more (two passes of a
    // box blur 7 pixels wide), so neighboring pixels come forward together
    // and the relief stays one solid surface instead of splitting apart.
    let dep = sm;
    const br = Math.max(3, Math.round(3 * sc));
    for (let pass = 0; pass < 2; pass++) {
      const out = new Float32Array(cols * rows);
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          let a = 0;
          let n = 0;
          for (let dy = -br; dy <= br; dy++)
            for (let dx = -br; dx <= br; dx++) {
              a += dep[clamp(y + dy, 0, rows - 1) * cols + clamp(x + dx, 0, cols - 1)];
              n++;
            }
          out[y * cols + x] = a / n;
        }
      dep = out;
    }
    this.depth = dep;
    // How far each pixel's depth differs from its neighbors' (relief units),
    // for the splats' thickness: each one reaches back to meet them.
    const step = new Float32Array(cols * rows);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const d0 = dep[y * cols + x];
        let m = 0;
        if (x > 0) m = Math.max(m, Math.abs(d0 - dep[y * cols + x - 1]));
        if (x < cols - 1) m = Math.max(m, Math.abs(d0 - dep[y * cols + x + 1]));
        if (y > 0) m = Math.max(m, Math.abs(d0 - dep[(y - 1) * cols + x]));
        if (y < rows - 1) m = Math.max(m, Math.abs(d0 - dep[(y + 1) * cols + x]));
        step[y * cols + x] = m;
      }
    this.reach = step;
    // The track: down each column, the strongest change from light to dark
    // in the picture's upper three quarters, then smoothed along the row.
    const raw = new Float32Array(cols);
    for (let x = 0; x < cols; x++) {
      let best = rows * 0.4;
      let bd = -Infinity;
      const g = Math.max(2, Math.round(2 * sc));
      for (let y = g; y < rows * 0.78; y++) {
        const d = sm[(y - g) * cols + x] - sm[Math.min(rows - 1, y + g) * cols + x];
        const score = Math.abs(d) - Math.abs(y / rows - 0.42) * 0.12;
        if (score > bd) {
          bd = score;
          best = y;
        }
      }
      raw[x] = best;
    }
    const track = new Float32Array(cols);
    for (let x = 0; x < cols; x++) {
      let a = 0;
      let n = 0;
      const kk = Math.max(4, Math.round(4 * sc));
      for (let k = -kk; k <= kk; k++) {
        a += raw[clamp(x + k, 0, cols - 1)];
        n++;
      }
      track[x] = a / n;
    }
    this.track = track;
    this.photoModel = this.buildPhoto();
    // The marble and the sparks, crisp (src/packs/arcade-crisp.js).
    this.marbleModel = crispModel((k) =>
      k.sphere(0.055, {
        step: low ? 0.009 : 0.0065,
        color: (q, n) => {
          // a blue glass marble with a white swirl and a highlight
          const swirl = Math.sin(q[0] * 70 + Math.sin(q[1] * 50) * 2) > 0.6;
          const l = Math.max(0, n[0] * -0.3 + n[1] * 0.6 + n[2] * 0.7);
          const base = swirl ? [0.95, 0.96, 1] : [0.2, 0.45, 0.9];
          return base.map((v) => Math.min(1, v * (0.65 + 0.4 * l) + Math.pow(l, 18) * 0.8));
        },
      }),
    );
    this.sparkModel = crispModel((k) =>
      k.sphere(0.022, {
        step: 0.005,
        color: (q, n) => {
          const l = Math.max(0, n[1] * 0.6 + n[2] * 0.8);
          return [1, 0.82 + 0.18 * l, 0.35 + 0.5 * Math.pow(l, 8)];
        },
      }),
    );
    const { kitModel } = this.api;
    this.lineModel = kitModel(
      (k) =>
        k.cloud({ share: 1 }, () => ({ p: [0, 0, 0], color: [1, 1, 1], size: 1, opacity: 0.9 })),
      { count: 1 },
    );
  }

  // The photo as splats: one per pixel, its own color, flat and facing out.
  buildPhoto() {
    const { makeModel } = this.api;
    const { cols, rows, px } = this;
    const m = makeModel(cols * rows);
    const cell = H / rows;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        m.pos.set([(x + 0.5) * cell - this.W / 2, H / 2 - (y + 0.5) * cell, 0], i * 3);
        m.color.set([px[i * 4] / 255, px[i * 4 + 1] / 255, px[i * 4 + 2] / 255, 1], i * 4);
        m.scale.set([cell * 0.62, cell * 0.62, cell * 0.2], i * 3);
        m.rot.set([0, 0, 0, 1], i * 4);
      }
    return m;
  }

  // Track height (world y) and the relief's depth at world x.
  trackY(x) {
    const u = ((x + this.W / 2) / this.W) * this.cols - 0.5;
    const i = clamp(Math.floor(u), 0, this.cols - 2);
    const f = clamp(u - i, 0, 1);
    const row = this.track[i] * (1 - f) + this.track[i + 1] * f;
    return H / 2 - ((row + 0.5) / this.rows) * H;
  }
  reliefZ(x, y, view) {
    const u = clamp(Math.floor(((x + this.W / 2) / this.W) * this.cols), 0, this.cols - 1);
    const v = clamp(Math.floor(((H / 2 - y) / H) * this.rows), 0, this.rows - 1);
    return this.depth[v * this.cols + u] * RELIEF * view;
  }

  // Gaps: stretches of the track that are missing (and get wider each lap).
  inGap(x) {
    for (const g of this.gaps) if (x > g[0] && x < g[1]) return true;
    return false;
  }

  makeLap() {
    // A few gaps and sparks along the track, never at the start.
    this.gaps = [];
    const n = 3 + Math.min(4, this.lap);
    for (let k = 0; k < n; k++) {
      const x = -this.W / 2 + this.W * (0.18 + (0.78 * (k + this.rand() * 0.6)) / n);
      const w = 0.12 + 0.03 * Math.min(4, this.lap) + 0.05 * this.rand();
      this.gaps.push([x, x + w]);
    }
    for (const s of this.sparks || []) this.api.sprites.remove(s.sprite);
    this.sparks = [];
    for (let k = 0; k < 8; k++) {
      const x = -this.W / 2 + this.W * (0.12 + 0.82 * (k / 8 + this.rand() * 0.05));
      const s = { x, y: this.trackY(x) + 0.12 + 0.18 * this.rand(), got: false };
      s.sprite = this.api.sprites.add(this.sparkModel);
      if (s.sprite) this.sparks.push(s);
    }
  }

  reset() {
    const S = this.api.sprites;
    S.clear();
    this.photo = S.add(this.photoModel);
    this.marble = {
      x: -this.W / 2 + 0.1,
      y: 0,
      vy: 0,
      ground: true,
      spin: 0,
      sprite: S.add(this.marbleModel),
    };
    this.marble.y = this.trackY(this.marble.x) + 0.055;
    // The track drawn along the skyline: small bright dots.
    this.dots = this.api.points(this.cols, { size: 0.012, flat: 1 });
    for (let i = 0; i < this.cols; i++) this.dots.color(i, 1, 1, 0.9, 0.9);
    this.score = 0;
    this.lives = 3;
    this.lap = 0;
    this.over = false;
    this.t = 0;
    this.makeLap();
  }

  step(dt, ctl) {
    this.t += dt;
    this.view = ctl.view;
    if (this.over) return;
    const m = this.marble;
    const speed = 0.45 + 0.08 * this.lap;
    let jump = ctl.pressed.has("fire") || ctl.pressed.has("up");
    if (ctl.demo) {
      // the attract mode jumps just before each gap
      const ahead = m.x + speed * 0.28;
      jump = m.ground && this.inGap(ahead) && !this.inGap(m.x);
    }
    if (jump && m.ground) {
      m.vy = 1.75;
      m.ground = false;
      this.api.sound({ voice: "boing", f: 420, vol: 0.3, decay: 0.4 });
    }
    m.x += speed * dt;
    m.spin -= (speed * dt) / 0.055;
    const ty = this.trackY(m.x) + 0.055;
    if (m.ground) {
      if (this.inGap(m.x)) m.ground = false;
      else {
        // rolling along: follow the track, a little bounce off steep rises
        m.y = ty;
        m.vy = 0;
      }
    }
    if (!m.ground) {
      m.vy -= 4.2 * dt;
      m.y += m.vy * dt;
      if (m.vy <= 0 && m.y <= ty && !this.inGap(m.x) && m.y > ty - 0.12) {
        m.y = ty;
        m.ground = true;
        this.api.sound({ voice: "glass", f: 1500, vol: 0.12, decay: 0.25 });
      }
      if (m.y < -H / 2 - 0.2) this.loseMarble();
    }
    for (const s of this.sparks) {
      if (s.got) continue;
      if (Math.hypot(s.x - m.x, s.y - m.y) < 0.09) {
        s.got = true;
        s.sprite.fade = 0;
        this.score += 10;
        this.api.sound({ voice: "sparkle", vol: 0.3 });
      }
    }
    if (m.x > this.W / 2 - 0.05) {
      this.lap++;
      this.score += 50;
      m.x = -this.W / 2 + 0.1;
      m.y = this.trackY(m.x) + 0.055;
      m.ground = true;
      this.makeLap();
      this.api.sound({ voice: "bell", notes: "E5 G5 B5", step: 0.1, vol: 0.4 });
    }
  }

  loseMarble() {
    this.lives--;
    this.api.sound({ voice: "thud", f: 100, vol: 0.6 });
    if (this.lives <= 0) {
      this.over = true;
      return;
    }
    const m = this.marble;
    // back to the last solid track before the gap
    let x = m.x - 0.15;
    while (this.inGap(x) && x > -this.W / 2) x -= 0.02;
    m.x = Math.max(-this.W / 2 + 0.1, x - 0.1);
    m.y = this.trackY(m.x) + 0.055;
    m.vy = 0;
    m.ground = true;
  }

  onView() {}

  render(view) {
    this.view = view;
    // The relief: each pixel comes forward by its brightness in 3D.
    const p = this.photo;
    p.pos = [0, 0, 0];
    p.scale = [1, 1, 1];
    if (this.relief !== view) {
      this.relief = view;
      this.writeRelief(view);
    }
    const m = this.marble;
    const z = this.reliefZ(m.x, m.y - 0.055, view) + 0.06;
    m.sprite.pos = [m.x, m.y, z];
    m.sprite.quat = this.q.qaxis([0, 0, 1], m.spin);
    for (let i = 0; i < this.cols; i++) {
      const x = -this.W / 2 + ((i + 0.5) / this.cols) * this.W;
      const y = this.trackY(x);
      if (this.inGap(x)) this.dots.hide(i);
      else this.dots.set(i, x, y, this.reliefZ(x, y, view) + 0.012);
    }
    this.dots.flush();
    for (const s of this.sparks) {
      if (s.got) continue;
      s.sprite.pos = [
        s.x,
        s.y + 0.02 * Math.sin(this.t * 4 + s.x * 9),
        this.reliefZ(s.x, s.y, view) + 0.05,
      ];
      s.sprite.quat = this.q.qaxis([0, 1, 0], this.t * 3);
    }
  }

  // The relief moves the photo's own splats in depth (its model's places;
  // the layer writes them each frame).
  writeRelief(view) {
    const m = this.photo.model;
    const thin = (H / this.rows) * 0.2;
    for (let i = 0; i < this.cols * this.rows; i++) {
      m.pos[i * 3 + 2] = this.depth[i] * RELIEF * view;
      m.scale[i * 3 + 2] = Math.max(thin, this.reach[i] * RELIEF * view * 0.6);
    }
    this.api.sprites.layer.writeLook(this.photo.start, m);
    this.photo.dirty = true; // its places changed: write its centers again
  }

  camera(view, aspect) {
    const m = this.marble;
    // 2D: follow the marble across the photo, face on. 3D: from above and to
    // the side, so the relief shows.
    const d2 = this.api.fitDistance(Math.min(this.W, 1.6 * aspect * 1.2) + 0.1, H + 0.4, aspect);
    const half = Math.max(0, this.W / 2 - 0.8 * aspect);
    return {
      target: [clamp(m.x, -half, half), lerp(0, -0.1, view), lerp(0, RELIEF * 0.5, view)],
      yaw: lerp(0, -0.45, view),
      pitch: lerp(0, 0.45, view),
      distance: lerp(d2, d2 * 0.95, view),
    };
  }

  stats() {
    return { score: this.score, lives: this.lives, lap: this.lap + 1 };
  }

  status() {
    return {
      over: this.over,
      title: "Out of marbles",
      lines: [`Score ${this.score} · lap ${this.lap + 1}`],
    };
  }
}
