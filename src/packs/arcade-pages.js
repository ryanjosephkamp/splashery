// Lane Arcade, G7: Page Breaker. Shardball whose bricks are the words and
// pictures of your own page: open a PDF or a photo, and every word on the
// page (found from its ink) and every picture (a PDF's own picture boxes,
// from the picture engine's figure finder in src/media.js) becomes a brick
// made of that piece of the page, splat by splat. A word that breaks falls
// apart into pieces of its letters. Each page of a PDF is a level; a photo
// is cut into tiles.
//
// Files stay on this device: the page is read and drawn in the browser.

import { Shardball } from "./arcade-shardball.js";

// The file someone opened (kept in the module, never in the scene).
export const PAGES = { file: null, name: "" };

const PAPER_Z = -0.012;

export async function createPageBreaker(api) {
  const g = new PageBreaker(api);
  await g.load();
  return g;
}

class PageBreaker extends Shardball {
  constructor(api) {
    super(api);
    this.pagesReady = new Map();
  }

  async load() {
    const { openMedia } = await import("../media.js");
    let src = this.api.options.source === "own" && PAGES.file ? PAGES.file : null;
    if (!src) {
      const sample = this.api.options.sample === "photo" ? "assets/toys/picture-lab/photo.jpg" : "assets/toys/picture-lab/article.pdf"; // prettier-ignore
      const url = new URL(`../../${sample}`, import.meta.url);
      const blob = await (await fetch(url)).blob();
      src = new File([blob], sample.split("/").pop(), { type: blob.type });
    }
    this.media = await openMedia(src, { profile: this.api.profile });
    this.pageCount = Math.min(this.media.count || 1, 20);
    const aspect = this.media.aspect(0) || 0.77;
    // The board: the page fills its width, with room below for the paddle.
    const W = 1.6;
    const ph = Math.min(2.4, W / aspect);
    const H = ph + 0.95;
    this.geo = { W, H, TOP: H / 2, PADDLE_Y: -H / 2 + 0.14 };
    this.pageBox = { w: ph * aspect, h: ph, top: H / 2 - 0.04 };
    await this.preparePage(0);
    // The next pages come in while the first is played.
    (async () => {
      for (let i = 1; i < this.pageCount && !this.dead; i++) await this.preparePage(i);
    })();
  }

  // Draws page i and cuts it into bricks: one per word (its ink, grown a
  // little sideways so its letters join), and a grid of tiles over each
  // picture (or over the whole of a photo).
  async preparePage(i) {
    if (this.pagesReady.has(i)) return this.pagesReady.get(i);
    const job = (async () => {
      const m = this.media;
      const pw = this.api.profile === "low" ? 420 : 640;
      const asp = m.aspect(i) || 0.77;
      const wpx = pw;
      const hpx = Math.round(pw / asp);
      const canvas = await m.draw(i, wpx, hpx);
      const g = canvas.getContext("2d", { willReadFrequently: true });
      const px = g.getImageData(0, 0, wpx, hpx).data;
      let boxes = [];
      let pics = [];
      if (m.kind === "pdf") {
        pics = ((await m.figures?.(i)) || []).map((f) => f.box);
        boxes = findWords(px, wpx, hpx, pics);
      } else pics = [[0, 0, 1, 1]];
      // Tiles over pictures.
      const tiles = [];
      for (const b of pics) {
        const bw = b[2] - b[0];
        const bh = b[3] - b[1];
        const cols = Math.max(1, Math.round((bw * this.pageBox.w) / 0.16));
        const rows = Math.max(1, Math.round((bh * this.pageBox.h) / 0.09));
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) tiles.push([b[0] + (bw * c) / cols, b[1] + (bh * r) / rows, b[0] + (bw * (c + 1)) / cols, b[1] + (bh * (r + 1)) / rows]); // prettier-ignore
      }
      const all = [...boxes.map((b) => ({ box: b, word: true })), ...tiles.map((b) => ({ box: b, word: false }))]; // prettier-ignore
      // Share the layer: what is left after the board's own parts, split
      // by each brick's area.
      const room = Math.max(4000, this.api.sprites.capacity - 9000);
      const area = all.reduce((a, b) => a + (b.box[2] - b.box[0]) * (b.box[3] - b.box[1]), 0) || 1;
      const density = Math.min(1, room / (area * wpx * hpx)); // splats per pixel
      const bricks = all.map((b) => this.brickFrom(px, wpx, hpx, b, density));
      const paper = this.paperModel(px, wpx, hpx);
      return { bricks: bricks.filter(Boolean), paper, words: boxes.length, pictures: pics.length };
    })();
    this.pagesReady.set(i, job);
    job.catch(() => this.pagesReady.delete(i));
    return job;
  }

  // A brick: the page's pixels in its box as splats (a front and a back
  // layer of paper, so it has some body in 3D), centered on its middle.
  brickFrom(px, w, h, { box, word }, density) {
    const { makeModel } = this.api;
    const x0 = Math.floor(box[0] * w);
    const y0 = Math.floor(box[1] * h);
    const x1 = Math.ceil(box[2] * w);
    const y1 = Math.ceil(box[3] * h);
    const bw = x1 - x0;
    const bh = y1 - y0;
    if (bw < 2 || bh < 2) return null;
    const step = Math.max(1, Math.sqrt(1 / Math.max(1e-6, density)) * 0.9);
    const nx = Math.max(2, Math.round(bw / step));
    const ny = Math.max(2, Math.round(bh / step));
    const n = Math.min(900, nx * ny);
    const sx = (this.pageBox.w * bw) / w;
    const sy = (this.pageBox.h * bh) / h;
    const depth = 0.03;
    const m = makeModel(n * 2);
    const sz = Math.max(sx / nx, sy / ny) * 0.62;
    let k = 0;
    for (let j = 0; j < ny && k < n; j++)
      for (let i = 0; i < nx && k < n; i++) {
        const u = (i + 0.5) / nx;
        const v = (j + 0.5) / ny;
        const pxx = Math.min(w - 1, Math.floor(x0 + u * bw));
        const pyy = Math.min(h - 1, Math.floor(y0 + v * bh));
        const o = (pyy * w + pxx) * 4;
        const c = [px[o] / 255, px[o + 1] / 255, px[o + 2] / 255];
        const pos = [(u - 0.5) * sx, (0.5 - v) * sy, depth / 2];
        for (const back of [0, 1]) {
          const q = k * 2 + back;
          m.pos.set(back ? [pos[0], pos[1], -depth / 2] : pos, q * 3);
          const f = back ? 0.82 : 1;
          m.color.set([c[0] * f, c[1] * f, c[2] * f, 1], q * 4);
          m.scale.set([sz, sz, sz * 0.12], q * 3);
          m.rot.set([0, 0, 0, 1], q * 4);
        }
        k++;
      }
    m.n = k * 2;
    const cx = -this.pageBox.w / 2 + (this.pageBox.w * (box[0] + box[2])) / 2;
    const cy = this.pageBox.top - (this.pageBox.h * (box[1] + box[3])) / 2;
    return { model: m, x: cx, y: cy, w: sx, h: sy, d: depth, word };
  }

  // The bare paper behind the bricks (the page's own paper color, a little
  // shaded), so a broken word leaves a blank spot.
  paperModel(px, w, h) {
    const { makeModel } = this.api;
    // The paper color: the page's most common light color.
    const n = this.api.profile === "low" ? 1600 : 3200;
    const asp = this.pageBox.w / this.pageBox.h;
    const ny = Math.round(Math.sqrt(n / asp));
    const nx = Math.round(n / ny);
    const m = makeModel(nx * ny);
    const paper = paperColor(px);
    const sz = (this.pageBox.w / nx) * 0.7;
    let k = 0;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        m.pos.set([(-0.5 + (i + 0.5) / nx) * this.pageBox.w, this.pageBox.top - ((j + 0.5) / ny) * this.pageBox.h, PAPER_Z], k * 3); // prettier-ignore
        const f = 0.8;
        m.color.set([paper[0] * f, paper[1] * f, paper[2] * f, 1], k * 4);
        m.scale.set([sz, sz, sz * 0.1], k * 3);
        m.rot.set([0, 0, 0, 1], k * 4);
        k++;
      }
    return m;
  }

  buildLevel() {
    const { W, TOP } = this.geo;
    const S = this.api.sprites;
    for (const b of this.bricks || []) if (b.sprite) S.remove(b.sprite);
    if (this.paperSprite) S.remove(this.paperSprite);
    this.bricks = [];
    const i = (this.level - 1) % this.pageCount;
    const page = this.readyPage(i);
    if (!page) {
      // The page is still being read: wait for it.
      this.waiting = i;
      return;
    }
    this.waiting = null;
    this.paperSprite = S.add(page.paper);
    this.paperRow = { x: 0, y: 0 };
    let low = TOP;
    for (const b of page.bricks) {
      const br = { kind: "glaze", hits: 1, x: b.x, y: b.y, w: b.w, h: b.h, d: b.d, r: 0, alive: true, word: b.word }; // prettier-ignore
      br.sprite = S.add(b.model);
      if (!br.sprite) break; // the layer is full: the rest of the page stays paper
      low = Math.min(low, b.y);
      this.bricks.push(br);
    }
    this.brickLow = low;
    void W;
  }

  readyPage(i) {
    const job = this.pagesReady.get(i);
    return job?.done || null;
  }

  step(dt, ctl) {
    // A page that was still being read shows up as soon as it is.
    if (this.waiting !== null && this.waiting !== undefined) {
      const job = this.pagesReady.get(this.waiting);
      if (job && !job.watched) {
        job.watched = true;
        job.then((p) => (job.done = p));
      }
      if (job?.done) this.buildLevel();
      return;
    }
    super.step(dt, ctl);
  }

  reset() {
    // The first page is ready by now (load waited for it).
    for (const [, job] of this.pagesReady)
      if (!job.watched) {
        job.watched = true;
        job.then((p) => (job.done = p));
      }
    super.reset();
  }

  render(view, frameDt) {
    super.render(view, frameDt);
    const p = this.paperSprite;
    if (p) {
      if (this.style === "flat") {
        const M = this.boardRot();
        p.pos = this.q.qrot(M, [0, 0, 0]);
        p.quat = M;
        p.fade = 1;
      } else {
        p.pos = [0, 0, 0];
        p.quat = [0, 0, 0, 1];
        p.fade = Math.max(0, 1 - view * 2);
      }
    }
  }

  status() {
    const st = super.status();
    return { ...st, lines: [`Score ${this.score} · page ${((this.level - 1) % this.pageCount) + 1} of ${this.pageCount}`] }; // prettier-ignore
  }

  destroy() {
    this.dead = true;
    this.media?.close?.();
  }
}

// ---- Finding the words ----------------------------------------------------------------

function paperColor(px) {
  const counts = new Map();
  for (let o = 0; o < px.length; o += 4 * 37) {
    const key = ((px[o] >> 4) << 8) | ((px[o + 1] >> 4) << 4) | (px[o + 2] >> 4);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = 0xfff;
  let bn = 0;
  for (const [k, n] of counts) {
    const lum = (k >> 8) + ((k >> 4) & 15) + (k & 15);
    if (n > bn && lum > 30) {
      bn = n;
      best = k;
    }
  }
  return [((best >> 8) * 17) / 255, (((best >> 4) & 15) * 17) / 255, ((best & 15) * 17) / 255];
}

// Boxes (fractions of the page) around each word: ink pixels (far from the
// paper's color), outside the pictures, joined sideways across the gaps
// between letters, then grouped into connected pieces. A run that is too
// long (a whole line joined up) is cut into word-sized pieces.
export function findWords(px, w, h, pics = []) {
  const paper = paperColor(px).map((v) => v * 255);
  const ink = new Uint8Array(w * h);
  const inPic = (x, y) => pics.some((b) => x >= b[0] * w - 2 && x <= b[2] * w + 2 && y >= b[1] * h - 2 && y <= b[3] * h + 2); // prettier-ignore
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const d =
        Math.abs(px[o] - paper[0]) +
        Math.abs(px[o + 1] - paper[1]) +
        Math.abs(px[o + 2] - paper[2]);
      if (d > 120) ink[y * w + x] = 1;
    }
  if (pics.length)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) if (ink[y * w + x] && inPic(x, y)) ink[y * w + x] = 0;
  // Join letters: grow the ink sideways by a gap of about a third of a
  // letter's height (from the page's size: about 0.4% of its width).
  const gap = Math.max(1, Math.round(w * 0.0045));
  const grown = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -1e9;
    for (let x = 0; x < w; x++) {
      if (ink[y * w + x]) {
        if (x - last <= gap * 2 && last >= 0) for (let k = last; k <= x; k++) grown[y * w + k] = 1;
        last = x;
        grown[y * w + x] = 1;
      }
    }
  }
  // Connected pieces (4-connected), with their boxes.
  const seen = new Int32Array(w * h).fill(-1);
  const boxes = [];
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!grown[s] || seen[s] >= 0) continue;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    let n = 0;
    stack.push(s);
    seen[s] = boxes.length;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w;
      const y = (p / w) | 0;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= w * h || !grown[q] || seen[q] >= 0) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === w - 1)) continue;
        seen[q] = boxes.length;
        stack.push(q);
      }
    }
    boxes.push([x0, y0, x1 + 1, y1 + 1, n]);
  }
  const out = [];
  const pad = 1;
  for (const [x0, y0, x1, y1, n] of boxes) {
    const bw = x1 - x0;
    const bh = y1 - y0;
    if (n < 6 || bh < 3 || bw < 3) continue; // specks
    if (bh > h * 0.12) continue; // a rule or a frame
    // Cut long runs into pieces about four letters' heights long.
    const pieces = Math.max(1, Math.round(bw / Math.max(bh * 4.5, 1)));
    for (let k = 0; k < pieces; k++) {
      const a = x0 + (bw * k) / pieces;
      const b = x0 + (bw * (k + 1)) / pieces;
      out.push([(a - pad) / w, (y0 - pad) / h, (b + pad) / w, (y1 + pad) / h].map((v) => Math.max(0, Math.min(1, v)))); // prettier-ignore
    }
  }
  return out;
}
