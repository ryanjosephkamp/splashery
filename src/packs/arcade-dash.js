// Lane Arcade, G8: Photo Dash, a run across your own photo. Open a photo
// (or play the samples): it becomes the landscape. The line where its sky
// meets its ground, found from the picture itself (the strongest change in
// brightness down each column), is the track: a row of wooden planks along
// it. A ball rolls along the planks by itself, faster each level; tap or
// press Space to jump the gaps, and catch the sparks.
//
// 2D: the photo face on. 3D: the photo rises into a relief (its bright
// parts nearer, its dark parts deeper) and the ball rolls along the same
// track on the relief, by the same rules.
//
// Arcade r3 (the owner's walkthrough of October 9, 2026):
//   - the photo stays still and fills the stage: it is cut to the stage's
//     shape and the whole level is in view, so nothing scrolls under the
//     splats (the scrolling read as blur and flicker), and its splats are
//     sized from the layer's budget for the part that shows (sharper)
//   - the samples: a new one at random after each level (unless the player
//     opened their own photo), from photos the site already ships (CC0, or
//     the owner's AI-made Studio samples, labeled as such), each credited on
//     the stage while it shows
//   - the player picks the ball (glass marble, steel ball, beach ball,
//     tennis ball), each with its own weight, bounce and sound
//   - the track is a row of crisp planks with a bright edge, and its gaps
//     are whole missing planks
//   - a brighter, two-note coin sound for a spark

import { crispModel } from "./arcade-crisp.js";

export const DASH = { file: null, name: "" };

// The samples (assets the site already ships; credits in CREDITS.md and
// the recipe). The first is the default.
export const PHOTOS = [
  { id: "alpine-lake", file: "assets/toys/photo-3d/ai/alpine-lake.jpg", credit: "Alpine lake, an AI-made picture by Splashery's owner" }, // prettier-ignore
  {
    id: "tulips",
    file: "assets/toys/picture-lab/photo.jpg",
    credit: "Tulip field by DennisM2 (CC0)",
  },
  { id: "castle", file: "assets/toys/photo-3d/ai/castle.jpg", credit: "Castle on a lake, an AI-made picture by Splashery's owner" }, // prettier-ignore
  { id: "canyon", file: "assets/toys/photo-3d/ai/canyon.jpg", credit: "Canyon at sunset, an AI-made picture by Splashery's owner" }, // prettier-ignore
  { id: "terraces", file: "assets/toys/photo-3d/ai/terraces.jpg", credit: "Rice terraces, an AI-made picture by Splashery's owner" }, // prettier-ignore
  { id: "paper-valley", file: "assets/toys/photo-3d/ai/paper-valley.jpg", credit: "Paper valley, an AI-made picture by Splashery's owner" }, // prettier-ignore
  { id: "farm", file: "assets/toys/photo-3d/ai/farm.jpg", credit: "Felt farm, an AI-made picture by Splashery's owner" }, // prettier-ignore
  { id: "cove", file: "assets/toys/photo-3d/ai/cove.jpg", credit: "Fishing cove, an AI-made picture by Splashery's owner" }, // prettier-ignore
  { id: "oasis", file: "assets/toys/photo-3d/ai/oasis.jpg", credit: "Desert oasis, an AI-made picture by Splashery's owner" }, // prettier-ignore
  { id: "train", file: "assets/toys/photo-3d/ai/train.jpg", credit: "Train on a viaduct, an AI-made picture by Splashery's owner" }, // prettier-ignore
  { id: "floating-isles", file: "assets/toys/photo-3d/ai/floating-isles.jpg", credit: "Floating islands, an AI-made picture by Splashery's owner" }, // prettier-ignore
];

// The balls: radius, gravity, jump speed, how much of a landing bounces
// back up, and the sound of a landing.
export const BALLS = {
  marble: { label: "Glass marble", color: "#3a73e6", r: 0.055, g: 4.2, jump: 1.75, bounce: 0, land: { voice: "glass", f: 1500, vol: 0.12, decay: 0.25 } }, // prettier-ignore
  steel: { label: "Steel ball", color: "#b9bec6", r: 0.05, g: 4.8, jump: 1.88, bounce: 0.12, land: { voice: "metal", f: 1200, vol: 0.12, decay: 0.2 } }, // prettier-ignore
  beach: { label: "Beach ball", color: "#e8453c", r: 0.075, g: 2.6, jump: 1.4, bounce: 0.38, land: { voice: "hollow", f: 180, vol: 0.35, decay: 0.5 } }, // prettier-ignore
  tennis: { label: "Tennis ball", color: "#cfe23a", r: 0.05, g: 4.2, jump: 1.8, bounce: 0.5, land: { voice: "pock", f: 320, vol: 0.3 } }, // prettier-ignore
};

// A spark caught: two quick bright notes up a fourth, with a glint.
export const COIN = [
  { voice: "ding", f: 987.77, vol: 0.4, decay: 0.22 },
  { voice: "ding", f: 1318.51, at: 0.07, vol: 0.5, decay: 0.55 },
  { voice: "sparkle", at: 0.07, vol: 0.12, decay: 0.45 },
];

const H = 2.0; // the photo's height in world units
const RELIEF = 0.35;
const PLANK_H = 0.032;
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
    this.ballId = BALLS[api.options.ball] ? api.options.ball : "marble";
    this.balls = {};
  }

  async load() {
    this.own = this.api.options.source === "own" && !!DASH.file;
    if (this.own) {
      this.img = await createImageBitmap(DASH.file);
      this.credit = "";
      this.photoId = "own";
    } else await this.usePhoto(0);
    this.sparkModel = crispModel((k) =>
      k.sphere(0.022, {
        step: 0.005,
        color: (q, n) => {
          const l = Math.max(0, n[1] * 0.6 + n[2] * 0.8);
          return [1, 0.82 + 0.18 * l, 0.35 + 0.5 * Math.pow(l, 8)];
        },
      }),
    );
  }

  // Loads a sample (by its place in PHOTOS) as the photo.
  async usePhoto(i) {
    const p = PHOTOS[i];
    const url = new URL(`../../${p.file}`, import.meta.url);
    const img = await createImageBitmap(await (await fetch(url)).blob());
    this.img?.close?.();
    this.img = img;
    this.photoIdx = i;
    this.photoId = p.id;
    this.credit = `Photo: ${p.credit}`;
  }

  // The next sample, at random (never the one showing), loaded ahead.
  preloadNext() {
    if (this.own || this.next) return;
    // (a shuffled bag: every sample once before any comes again)
    if (!this.bag?.length) {
      this.bag = PHOTOS.map((_, k) => k).filter((k) => k !== this.photoIdx);
      for (let k = this.bag.length - 1; k > 0; k--) {
        const j = (this.rand() * (k + 1)) | 0;
        [this.bag[k], this.bag[j]] = [this.bag[j], this.bag[k]];
      }
    }
    const i = this.bag.pop();
    const p = PHOTOS[i];
    this.next = { i, ready: null };
    const url = new URL(`../../${p.file}`, import.meta.url);
    fetch(url)
      .then((r) => r.blob())
      .then((b) => createImageBitmap(b))
      .then((img) => {
        if (this.next?.i === i) this.next.ready = img;
        else img.close?.();
      })
      .catch(() => (this.next = null));
  }

  // ---- The photo, cut to the stage ---------------------------------------------

  // Cuts the photo to the stage's shape (its middle) and reads it: the
  // splats, the relief's depth and the track. One splat per pixel of the
  // cut, as many as the layer's budget allows for it.
  prepare(aspect) {
    const img = this.img;
    const photoAspect = img.width / img.height;
    const a = clamp(aspect, 0.4, photoAspect);
    this.aspectBuilt = aspect;
    const cropW = img.height * a;
    const sx = (img.width - cropW) / 2;
    const prof = this.api.profile;
    const budget = (prof === "low" ? 50000 : prof === "mid" ? 120000 : 160000) * 0.76;
    const cols = Math.round(Math.sqrt(budget * a));
    const rows = Math.round(cols / a);
    // the blurs and the track's smoothing scale with the photo's size
    const sc = rows / 176;
    const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(cols, rows) : Object.assign(document.createElement("canvas"), { width: cols, height: rows }); // prettier-ignore
    const g = c.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(img, sx, 0, cropW, img.height, 0, 0, cols, rows);
    const px = g.getImageData(0, 0, cols, rows).data;
    this.cols = cols;
    this.rows = rows;
    this.W = H * a;
    this.px = px;
    const lum = new Float32Array(cols * rows);
    for (let i = 0; i < cols * rows; i++)
      lum[i] = (0.3 * px[i * 4] + 0.59 * px[i * 4 + 1] + 0.11 * px[i * 4 + 2]) / 255;
    const sm = blur(lum, cols, rows, 1, 1);
    this.lum = sm;
    // The relief's depth: the brightness smoothed much more, so neighboring
    // pixels come forward together and the relief stays one solid surface.
    const dep = blur(sm, cols, rows, Math.max(3, Math.round(3 * sc)), 2);
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
    // between the top fifth and the lower quarter (clear of the screen's
    // buttons), then smoothed along the row.
    const raw = new Float32Array(cols);
    const gg = Math.max(2, Math.round(2 * sc));
    for (let x = 0; x < cols; x++) {
      let best = rows * 0.45;
      let bd = -Infinity;
      for (let y = Math.round(rows * 0.2); y < rows * 0.74; y++) {
        const d = sm[Math.max(0, y - gg) * cols + x] - sm[Math.min(rows - 1, y + gg) * cols + x];
        const score = Math.abs(d) - Math.abs(y / rows - 0.45) * 0.12;
        if (score > bd) {
          bd = score;
          best = y;
        }
      }
      raw[x] = best;
    }
    // Smoothed, and never steeper than a ramp a ball can roll (about 24°):
    // a busy photo's skyline zigzags.
    const smooth = (a, kk) => {
      const o = new Float32Array(cols);
      for (let x = 0; x < cols; x++) {
        let s = 0;
        for (let k = -kk; k <= kk; k++) s += a[clamp(x + k, 0, cols - 1)];
        o[x] = s / (2 * kk + 1);
      }
      return o;
    };
    const track = smooth(raw, Math.max(4, Math.round(cols / 18)));
    const most = 0.45 * (this.W / cols) * (rows / H);
    for (let pass = 0; pass < 2; pass++) {
      for (let x = 1; x < cols; x++) track[x] = clamp(track[x], track[x - 1] - most, track[x - 1] + most); // prettier-ignore
      for (let x = cols - 2; x >= 0; x--) track[x] = clamp(track[x], track[x + 1] - most, track[x + 1] + most); // prettier-ignore
    }
    this.track = smooth(track, Math.max(2, Math.round(cols / 40)));
    this.photoModel = this.buildPhoto();
    // The planks: whole planks about 0.075 long, end to end across the photo.
    this.nPlanks = Math.max(8, Math.round(this.W / 0.075));
    this.plankL = this.W / this.nPlanks;
    this.plankModel = crispModel(
      (k) =>
        k.box(this.plankL * 0.985, PLANK_H, 0.05, {
          faces: "xXyYZ",
          color: (p, n) => {
            // dark wood with a bright cream edge on top, so the track reads
            // on any photo; the ends a little darker, so each plank shows
            if (n[1] > 0.5) return [0.93, 0.86, 0.68];
            if (n[2] > 0.5 && p[1] > PLANK_H / 2 - 0.007) return [0.98, 0.93, 0.78];
            const end = Math.abs(p[0]) > this.plankL * 0.985 * 0.5 - 0.004 ? 0.75 : 1;
            const f = (n[2] > 0.5 ? 1 : 0.7) * end;
            return [0.45 * f, 0.28 * f, 0.15 * f];
          },
        }),
      { fine: 0.004, coarse: 0.012 },
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

  // A ball's model (built once each).
  ballModel(id) {
    if (this.balls[id]) return this.balls[id];
    const b = BALLS[id];
    const low = this.api.profile === "low";
    const step = (low ? 0.009 : 0.0062) * (b.r / 0.055);
    const lit = (n) => Math.max(0, n[0] * -0.3 + n[1] * 0.6 + n[2] * 0.7);
    const color = {
      // a blue glass marble with a white swirl and a highlight
      marble: (q, n) => {
        const swirl = Math.sin(q[0] * 70 + Math.sin(q[1] * 50) * 2) > 0.6;
        const l = lit(n);
        const base = swirl ? [0.95, 0.96, 1] : [0.2, 0.45, 0.9];
        return base.map((v) => Math.min(1, v * (0.65 + 0.4 * l) + Math.pow(l, 18) * 0.8));
      },
      // polished steel: the sky above, the ground below, a sharp highlight
      steel: (q, n) => {
        const l = lit(n);
        const env = n[1] > 0.05 ? [0.78, 0.82, 0.88] : n[1] > -0.12 ? [0.32, 0.33, 0.35] : [0.5, 0.48, 0.45]; // prettier-ignore
        return env.map((v) => Math.min(1, v * (0.7 + 0.35 * l) + Math.pow(l, 30)));
      },
      // six panels round its middle and white caps
      beach: (q, n) => {
        const l = lit(n);
        const panels = [[0.9, 0.22, 0.2], [0.97, 0.97, 0.95], [0.18, 0.42, 0.85], [0.97, 0.8, 0.15], [0.97, 0.97, 0.95], [0.2, 0.68, 0.36]]; // prettier-ignore
        const k = Math.floor(((Math.atan2(n[0], n[2]) / (2 * Math.PI) + 1) * 6) % 6);
        const base = Math.abs(n[1]) > 0.86 ? [0.97, 0.97, 0.95] : panels[k];
        return base.map((v) => Math.min(1, v * (0.68 + 0.38 * l) + Math.pow(l, 22) * 0.5));
      },
      // yellow-green with its curving white seam
      tennis: (q, n) => {
        const l = lit(n);
        const seam = Math.abs(n[1] - 0.55 * Math.sin(2 * Math.atan2(n[0], n[2]))) < 0.07;
        const base = seam ? [0.96, 0.96, 0.92] : [0.82, 0.9, 0.24];
        return base.map((v) => Math.min(1, v * (0.66 + 0.4 * l)));
      },
    }[id];
    this.balls[id] = crispModel((k) => k.sphere(b.r, { step, color }));
    return this.balls[id];
  }

  // ---- The track ----------------------------------------------------------------

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

  plankAt(x) {
    return Math.floor((x + this.W / 2) / this.plankL);
  }

  // Gaps: whole planks missing.
  inGap(x) {
    return this.gone.has(this.plankAt(x));
  }

  speed() {
    return clamp(this.W / 6, 0.26, 0.5) * (1 + 0.08 * Math.min(6, this.lap));
  }

  // Runs across the photo a level takes: a narrow (phone) photo takes three,
  // a wide one one or two, so a level lasts about ten seconds.
  runs() {
    return clamp(Math.round(2.6 / this.W), 1, 3);
  }

  makeLap() {
    // A few gaps (each one to three planks, never at the start, never two
    // close together) and sparks above the track.
    const b = BALLS[this.ballId];
    const reach = ((2 * b.jump) / b.g) * this.speed() * 0.8; // how far a jump carries
    const n = this.nPlanks;
    const want = clamp(Math.round(n / 8), 2, 6) + Math.min(2, this.lap);
    this.gone = new Set();
    let tries = 0;
    while (this.gone.size < want * 2 && tries++ < 200) {
      const len = clamp(1 + Math.floor(this.rand() * (1.5 + Math.min(2, this.lap) * 0.5)), 1, 3);
      if (len * this.plankL > reach) continue;
      const at = 4 + Math.floor(this.rand() * (n - 6 - len));
      let ok = true;
      for (let k = at - 3; k < at + len + 3; k++) if (this.gone.has(k)) ok = false;
      if (!ok) continue;
      for (let k = at; k < at + len; k++) this.gone.add(k);
      if ([...this.gone].length >= want * 3) break;
    }
    const S = this.api.sprites;
    for (const s of this.sparks || []) S.remove(s.sprite);
    this.sparks = [];
    const ns = clamp(Math.round(this.W * 3.5), 4, 9);
    for (let k = 0; k < ns; k++) {
      const x = -this.W / 2 + this.W * (0.14 + 0.8 * ((k + 0.5) / ns + (this.rand() - 0.5) * 0.04));
      const s = { x, y: this.trackY(x) + 0.13 + 0.17 * this.rand(), got: false };
      s.sprite = S.add(this.sparkModel);
      if (s.sprite) this.sparks.push(s);
    }
    this.placePlanks();
  }

  // The planks along the track, each turned to the slope under it.
  placePlanks() {
    const S = this.api.sprites;
    for (const p of this.planks || []) S.remove(p.sprite);
    this.planks = [];
    for (let i = 0; i < this.nPlanks; i++) {
      if (this.gone.has(i)) continue;
      const x0 = -this.W / 2 + i * this.plankL;
      const x1 = x0 + this.plankL;
      const xc = (x0 + x1) / 2;
      const ang = Math.atan2(this.trackY(x1) - this.trackY(x0), this.plankL);
      const sprite = S.add(this.plankModel);
      if (sprite) this.planks.push({ x: xc, y: this.trackY(xc) - PLANK_H / 2, ang, sprite });
    }
  }

  // ---- Game ---------------------------------------------------------------------

  reset() {
    this.score = 0;
    this.lives = 3;
    this.lap = 0;
    this.run = 0;
    this.over = false;
    this.t = 0;
    this.build(this.api.aspect());
  }

  // Everything on the layer, for the photo showing (a new level's photo,
  // or a stage that changed shape, builds again).
  build(aspect) {
    this.prepare(aspect);
    const S = this.api.sprites;
    S.clear();
    this.planks = [];
    this.sparks = [];
    this.photo = S.add(this.photoModel);
    this.relief = null;
    const b = BALLS[this.ballId];
    this.marble = { x: -this.W / 2 + 0.1, y: 0, vy: 0, ground: true, spin: 0, sprite: S.add(this.ballModel(this.ballId)) }; // prettier-ignore
    this.marble.y = this.trackY(this.marble.x) + b.r;
    this.makeLap();
    this.preloadNext();
  }

  setBall(id) {
    if (!BALLS[id] || id === this.ballId) return;
    this.ballId = id;
    const S = this.api.sprites;
    S.remove(this.marble.sprite);
    this.marble.sprite = S.add(this.ballModel(id));
    if (this.marble.ground) this.marble.y = this.trackY(this.marble.x) + BALLS[id].r;
  }

  step(dt, ctl) {
    this.t += dt;
    this.view = ctl.view;
    if (ctl.choice && ctl.choice !== this.ballId) this.setBall(ctl.choice);
    if (this.over) return;
    const m = this.marble;
    const b = BALLS[this.ballId];
    const speed = this.speed();
    let jump = ctl.pressed.has("fire") || ctl.pressed.has("up");
    if (ctl.demo) {
      // the attract mode jumps just before each gap
      const ahead = m.x + speed * 0.12 + b.r;
      jump = m.ground && this.inGap(ahead) && !this.inGap(m.x);
    }
    if (jump && m.ground) {
      m.vy = b.jump;
      m.ground = false;
      this.api.sound({ voice: "boing", f: 420, vol: 0.3, decay: 0.4 });
    }
    m.x += speed * dt;
    m.spin -= (speed * dt) / b.r;
    const ty = this.trackY(m.x) + b.r;
    if (m.ground) {
      if (this.inGap(m.x)) m.ground = false;
      else {
        m.y = ty;
        m.vy = 0;
      }
    }
    if (!m.ground) {
      m.vy -= b.g * dt;
      m.y += m.vy * dt;
      if (m.vy <= 0 && m.y <= ty && !this.inGap(m.x) && m.y > ty - 0.12) {
        m.y = ty;
        // a bouncy ball hops on landing; a marble settles at once
        const up = -m.vy * b.bounce;
        if (up > 0.35) m.vy = up;
        else {
          m.vy = 0;
          m.ground = true;
        }
        this.api.sound({ ...b.land, vol: b.land.vol * clamp(0.4 + -m.vy * 0.3, 0.4, 1.2) });
      }
      if (m.y < -H / 2 - 0.2) this.loseMarble();
    }
    for (const s of this.sparks) {
      if (s.got) continue;
      if (Math.hypot(s.x - m.x, s.y - m.y) < 0.05 + b.r) {
        s.got = true;
        s.sprite.fade = 0;
        this.score += 10;
        this.api.sound(COIN);
      }
    }
    if (m.x > this.W / 2 - 0.05) {
      if (++this.run >= this.runs()) this.nextLevel();
      else this.nextRun();
    }
  }

  // Another run across the same photo, with new gaps and sparks.
  nextRun() {
    this.score += 20;
    this.api.sound({ voice: "bell", notes: "E5 G5", step: 0.1, vol: 0.3 });
    const m = this.marble;
    m.x = -this.W / 2 + 0.1;
    m.y = this.trackY(m.x) + BALLS[this.ballId].r;
    m.vy = 0;
    m.ground = true;
    this.makeLap();
  }

  nextLevel() {
    this.lap++;
    this.run = 0;
    this.score += 50;
    this.api.sound({ voice: "bell", notes: "E5 G5 B5", step: 0.1, vol: 0.4 });
    // A new photo, if the next one has loaded (else this one again).
    if (this.next?.ready) {
      this.img?.close?.();
      this.img = this.next.ready;
      this.photoIdx = this.next.i;
      this.photoId = PHOTOS[this.next.i].id;
      this.credit = `Photo: ${PHOTOS[this.next.i].credit}`;
      this.next = null;
      this.build(this.api.aspect());
      this.banner = { title: `Level ${this.lap + 1}`, until: this.t + 1.4 };
      return;
    }
    const m = this.marble;
    m.x = -this.W / 2 + 0.1;
    m.y = this.trackY(m.x) + BALLS[this.ballId].r;
    m.vy = 0;
    m.ground = true;
    this.makeLap();
    this.banner = { title: `Level ${this.lap + 1}`, until: this.t + 1.4 };
  }

  loseMarble() {
    this.lives--;
    this.api.sound({ voice: "thud", f: 100, vol: 0.6 });
    if (this.lives <= 0) {
      this.over = true;
      return;
    }
    const m = this.marble;
    // back to the last solid plank before the gap
    let x = m.x - 0.15;
    while (this.inGap(x) && x > -this.W / 2) x -= 0.02;
    m.x = Math.max(-this.W / 2 + 0.1, x - 0.1);
    m.y = this.trackY(m.x) + BALLS[this.ballId].r;
    m.vy = 0;
    m.ground = true;
  }

  onView() {}

  render(view) {
    this.view = view;
    // A stage that changed shape (play mode, a turned phone): cut again.
    const a = this.api.aspect();
    if (Math.abs(a - this.aspectBuilt) / a > 0.06 && !this.over) {
      const m = this.marble;
      const fx = (m.x + this.W / 2) / this.W;
      this.build(a);
      this.marble.x = -this.W / 2 + fx * this.W;
      this.marble.y = this.trackY(this.marble.x) + BALLS[this.ballId].r;
    }
    const p = this.photo;
    p.pos = [0, 0, 0];
    p.scale = [1, 1, 1];
    if (this.relief !== view) {
      this.relief = view;
      this.writeRelief(view);
    }
    const m = this.marble;
    const r = BALLS[this.ballId].r;
    const z = this.reliefZ(m.x, m.y - r, view) + 0.03 + r;
    m.sprite.pos = [m.x, m.y, z];
    m.sprite.quat = this.q.qaxis([0, 0, 1], m.spin);
    for (const pl of this.planks) {
      pl.sprite.pos = [pl.x, pl.y, this.reliefZ(pl.x, pl.y, view) + 0.03];
      pl.sprite.quat = this.q.qaxis([0, 0, 1], pl.ang);
    }
    for (const s of this.sparks) {
      if (s.got) continue;
      s.sprite.pos = [s.x, s.y + 0.02 * Math.sin(this.t * 4 + s.x * 9), this.reliefZ(s.x, s.y, view) + 0.05]; // prettier-ignore
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
    // 2D: the whole photo, face on and still (it is cut to the stage). 3D:
    // from a little above and to the side, so the relief shows.
    const d2 = this.api.fitDistance(this.W, H, aspect, 1.0);
    return {
      target: [0, lerp(0, 0.05, view), lerp(0, RELIEF * 0.5, view)],
      yaw: lerp(0, -0.22, view),
      pitch: lerp(0, 0.26, view),
      // (a little closer in 3D, so the turned photo still fills the stage)
      distance: lerp(d2, d2 * 0.88, view),
    };
  }

  // The photo's credit, shown on the stage while it shows.
  caption() {
    return this.credit || "";
  }

  stats() {
    return { score: this.score, lives: this.lives, lap: this.lap + 1 };
  }

  status() {
    return {
      over: this.over,
      title: "Out of balls",
      lines: [`Score ${this.score} · level ${this.lap + 1}`],
      banner: this.banner && this.t < this.banner.until ? { title: this.banner.title, lines: [] } : null, // prettier-ignore
    };
  }
}

// A box blur (radius r, `passes` times) of a cols × rows field.
function blur(src, cols, rows, r, passes) {
  let a = src;
  for (let p = 0; p < passes; p++) {
    // separable: across, then down
    const t = new Float32Array(cols * rows);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        let s = 0;
        for (let k = -r; k <= r; k++) s += a[y * cols + clamp(x + k, 0, cols - 1)];
        t[y * cols + x] = s / (2 * r + 1);
      }
    const o = new Float32Array(cols * rows);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        let s = 0;
        for (let k = -r; k <= r; k++) s += t[clamp(y + k, 0, rows - 1) * cols + x];
        o[y * cols + x] = s / (2 * r + 1);
      }
    a = o;
  }
  return a;
}
