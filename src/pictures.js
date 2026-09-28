// Pictures and pages (lane Pictures): shows a PDF, a picture, a GIF or a
// video on a kit toy's picture sheets (k.sheet in src/kit.js).
//
// - Pages stream through a few sheets: each sheet is one gsplat entity
//   whose container is rebuilt with the page it shows when that page is
//   reached (PDF.js draws it, src/pictures-worker.js turns the pixels into
//   splats), so a book of any length costs the same as its open pages. A
//   small cache keeps the pages next to the open ones ready.
// - Near and far detail: each sheet is built at about one picture pixel per
//   screen pixel for how big it shows now (on a ladder of widths a square
//   root of two apart), within the device tier's budget, and rebuilt when
//   the view comes much closer or goes much further.
// - GIFs and videos use screen sheets: the splats are built once and take
//   their colors from the sheet's own texture, which each new frame
//   uploads.
//
// A recipe places sheets with k.sheet(...) and picks each one's page in
// drive(): out.sheets[id] = { page, visible }. The pictures API is
// info.data.pictures in drive (page, count, kind, next(), prev(), go(n),
// togglePlay(), playing).

import * as pc from "./pc.js";
import { buildSheet } from "./picture-splats.js";

// Per device tier, for one sheet: the most splats a photo or a frame gets
// ("pixels", and "screen" for video, whose texture uploads every frame),
// the most splats a page's ink gets, and the widest a page is drawn. The
// numbers come from the measurements in docs/handoff/Pictures.md.
export const PICTURE_BUDGETS = {
  low: { pixels: 160e3, screen: 100e3, ink: 220e3, width: 1100 },
  mid: { pixels: 320e3, screen: 180e3, ink: 420e3, width: 1600 },
  high: { pixels: 640e3, screen: 320e3, ink: 750e3, width: 2400 },
  max: { pixels: 1.2e6, screen: 500e3, ink: 1.3e6, width: 3200 },
};

// Widths a sheet is built at, a square root of two apart.
const LADDER = [];
for (let k = 0; k <= 12; k++) LADDER.push(Math.round(128 * Math.pow(2, k / 2)));

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; // prettier-ignore
const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

let worker = null;
let workerFailed = false;
let nextJob = 1;
const waiting = new Map();

// Builds a sheet in the worker (or here, if workers are unavailable).
function buildOffThread(job) {
  if (!worker && !workerFailed) {
    try {
      worker = new Worker(new URL("./pictures-worker.js", import.meta.url), { type: "module" });
      worker.onmessage = (e) => {
        const w = waiting.get(e.data.id);
        if (!w) return;
        waiting.delete(e.data.id);
        if (e.data.error) w.reject(new Error(e.data.error));
        else w.resolve(e.data.out);
      };
      worker.onerror = () => {
        workerFailed = true;
        for (const w of waiting.values()) w.reject(new Error("The pictures worker stopped."));
        waiting.clear();
        worker = null;
      };
    } catch {
      workerFailed = true;
    }
  }
  if (!worker) return Promise.resolve(buildSheet(job));
  const id = nextJob++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    worker.postMessage({ id, job }, job.pixels ? [job.pixels.buffer] : []);
  });
}

export class Pictures {
  // defs: the recipe's sheets (k.sheets), transform: the kit's fit
  // ({ center, scale }), spine: k.spineDef or null.
  constructor(player, { defs, transform, spine, profile }) {
    this.player = player;
    this.stage = player.stage;
    this.profile = profile;
    this.budget = PICTURE_BUDGETS[profile] || PICTURE_BUDGETS.mid;
    const c = transform?.center || [0, 0, 0];
    const s = transform?.scale ?? 1;
    this.fitScale = s;
    const toToy = (p) => mul(sub(p, c), s);
    this.spine = spine
      ? { at: toToy(spine.at), axis: unit(spine.axis), dir: unit(spine.dir) }
      : null;
    this.sheets = defs.map((d, i) => {
      const n = unit(d.normal);
      const x = unit(cross(d.up, n));
      const y = cross(n, x);
      return {
        i,
        def: d,
        center: addv(toToy(d.center), mul(n, (d.lift || 0) * s)),
        x,
        y,
        n,
        w: d.width * s,
        h: d.height * s,
        slot: null, // the stage sheet
        shown: null, // { page, level, key }
        want: null,
        visible: true,
        lastLevel: 0,
        wantLevel: 0,
        levelSince: 0,
      };
    });
    this.media = null;
    this.page = 0;
    this.cache = new Map(); // key -> built sheet data (a few, by splat count)
    this.busy = false;
    this.pending = null;
    this.gifTime = 0;
    this.frameDirty = false;
    this.sound = false;
    this.retiring = []; // sheets swapped for bigger ones, freed a few frames on
    this.stats = { builds: 0, lastMs: 0, lastCount: 0, rendered: [] };
    this.destroyed = false;
    this.api = this.makeAPI();
  }

  // ---- Media ------------------------------------------------------------------------

  // Shows new media (from media.js), or none.
  setMedia(media) {
    this.unwatch?.();
    this.unwatch = null;
    this.media = media;
    this.page = 0;
    this.cache.clear();
    for (const sh of this.sheets) sh.shown = null;
    if (media?.kind === "video") {
      media.setMuted(!this.sound);
      this.unwatch = media.onFrame(() => {
        this.frameDirty = true;
        this.stage.requestRender();
      });
      this.frameDirty = true;
    }
    this.stage.requestRender();
  }

  // Video sound follows the site's speaker button (off in embeds).
  setSound(on) {
    this.sound = !!on;
    if (this.media?.kind === "video") this.media.setMuted(!this.sound);
  }

  methodFor(sheet) {
    const m = sheet.def.method;
    if (m && m !== "auto") return m;
    const k = this.media?.kind;
    return k === "pdf" ? "ink" : k === "gif" || k === "video" ? "screen" : "pixels";
  }

  makeAPI() {
    const self = this;
    return {
      get page() {
        return self.page;
      },
      get count() {
        return self.media?.count ?? 0;
      },
      get kind() {
        return self.media?.kind ?? null;
      },
      get name() {
        return self.media?.name ?? "";
      },
      get playing() {
        return self.media?.kind === "video" ? self.media.playing : self.media?.kind === "gif";
      },
      next: () => this.go(this.page + 1),
      prev: () => this.go(this.page - 1),
      go: (n) => this.go(n),
      togglePlay: () => this.togglePlay(),
    };
  }

  go(n) {
    const count = this.media?.count ?? 1;
    const p = Math.max(0, Math.min(count - 1, Math.round(n)));
    if (p !== this.page) {
      this.page = p;
      this.player.emit("pictures", this.info());
      this.stage.requestRender();
    }
    return p;
  }

  togglePlay() {
    const m = this.media;
    if (m?.kind !== "video") return false;
    if (m.playing) m.pause();
    else m.play();
    this.player.emit("pictures", this.info());
    return !m.playing;
  }

  info() {
    const m = this.media;
    return {
      kind: m?.kind ?? null,
      name: m?.name ?? "",
      count: m?.count ?? 0,
      page: this.page,
      playing: m?.kind === "video" ? m.playing : false,
    };
  }

  // ---- Geometry -----------------------------------------------------------------------

  // The sheet's rectangle for a picture of aspect a (width / height):
  // center, half width and half height along its x and y.
  rect(sheet, aspect) {
    let hw = sheet.w / 2;
    let hh = sheet.h / 2;
    if (sheet.def.fit !== "fill" && aspect > 0) {
      if (aspect > sheet.w / sheet.h) hh = hw / aspect;
      else hw = hh * aspect;
    }
    const al = sheet.def.align || [0, 0];
    const c = addv(
      sheet.center,
      addv(mul(sheet.x, al[0] * (sheet.w / 2 - hw)), mul(sheet.y, al[1] * (sheet.h / 2 - hh))),
    );
    return { c, hw, hh };
  }

  // How many screen pixels (device) the sheet's width covers now.
  screenWidth(sheet, aspect) {
    const { c, hw, hh } = this.rect(sheet, aspect);
    const st = this.stage;
    const ratio = st.canvas.width / Math.max(1, st.canvas.clientWidth);
    const pts = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].map(([a, b]) => st.toScreen(addv(c, addv(mul(sheet.x, a * hw), mul(sheet.y, b * hh)))));
    const d1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    const d2 = Math.hypot(pts[3][0] - pts[2][0], pts[3][1] - pts[2][1]);
    // Seen from the side, the width shrinks; the height side keeps detail.
    const h1 = Math.hypot(pts[2][0] - pts[0][0], pts[2][1] - pts[0][1]) * aspect;
    return Math.max(d1, d2, h1) * ratio;
  }

  // The picture width to build at for a sheet shown `px` pixels wide.
  levelFor(sheet, aspect, px) {
    const method = this.methodFor(sheet);
    const b = this.budget;
    let cap;
    if (method === "ink") cap = b.width;
    else cap = Math.sqrt((method === "screen" ? b.screen : b.pixels) * aspect);
    if (method !== "ink" && this.media?.size) cap = Math.min(cap, this.media.size().width);
    const target = Math.min(cap, Math.max(64, px));
    let level = LADDER.find((w) => w >= target) ?? LADDER[LADDER.length - 1];
    level = Math.min(level, Math.floor(cap));
    return Math.max(32, level);
  }

  // ---- Frame -------------------------------------------------------------------------

  // Each frame: which page each sheet shows, at which detail; builds what
  // is missing (one at a time) and uploads new video and GIF frames.
  update(out, time) {
    if (this.destroyed) return;
    for (const r of this.retiring) if (--r.frames <= 0) this.stage.removeSheet(r.slot);
    this.retiring = this.retiring.filter((r) => r.frames > 0);
    if (this.retiring.length) this.stage.requestRender(200);
    const m = this.media;
    const now = performance.now();
    for (const sh of this.sheets) {
      const o = out?.sheets?.[sh.def.id];
      const page = o?.page ?? this.page;
      const vis = o?.visible ?? 1;
      const count = m?.count ?? 0;
      const has = m && page >= 0 && page < count && vis > 0;
      if (sh.slot) sh.slot.entity.enabled = !!has && !!sh.shown;
      if (!has) {
        sh.want = null;
        continue;
      }
      const aspect = m.aspect(page);
      const px = this.screenWidth(sh, aspect);
      const level = this.levelFor(sh, aspect, px);
      // A new level must hold for a moment (a pinch passes through many).
      if (level !== sh.wantLevel) {
        sh.wantLevel = level;
        sh.levelSince = now;
      }
      const shown = sh.shown;
      const settled = now - sh.levelSince > 250;
      let useLevel = shown && shown.page === page ? shown.level : level;
      if (shown && shown.page === page && settled) {
        const r = level / shown.level;
        // Rebuild when the view is much closer (sharper) or much further
        // (splats would fall under a pixel).
        if (r > 1.3 || r < 0.6) useLevel = level;
      }
      if (!shown || shown.page !== page) useLevel = level;
      const method = this.methodFor(sh);
      // Frames keep coming while a new level waits to settle.
      if (level !== (shown?.level ?? 0) && shown?.page === page) this.stage.requestRender(300);
      sh.want = {
        sheet: sh.i,
        page,
        level: useLevel,
        method,
        key: `${page}|${useLevel}|${method}`,
      };
    }
    this.pump();
    // Live frames for screen sheets.
    if (m?.kind === "gif") {
      const f = m.frameAt(time);
      if (f !== this.gifFrame) {
        this.gifFrame = f;
        this.uploadFrame(f);
      }
      this.stage.requestRender();
    } else if (m?.kind === "video" && this.frameDirty) {
      this.frameDirty = false;
      this.uploadFrame(0);
    }
  }

  // Draws a GIF or video frame into each screen sheet's texture.
  async uploadFrame(frame) {
    if (this.uploading) {
      this.uploadAgain = frame;
      return;
    }
    this.uploading = true;
    try {
      for (const sh of this.sheets) {
        if (!sh.slot || !sh.shown || sh.shown.method !== "screen") continue;
        const media = this.media;
        const c = await media.draw(frame, sh.shown.w, sh.shown.h).catch(() => null);
        if (this.destroyed || !sh.slot || !c || media !== this.media) return;
        this.stage.setSheetScreen(sh.slot, c);
      }
    } finally {
      this.uploading = false;
    }
    if (this.uploadAgain !== undefined) {
      const f = this.uploadAgain;
      this.uploadAgain = undefined;
      this.uploadFrame(f);
    }
  }

  // Starts the next build: a sheet's missing page first, then the next
  // pages (a small cache).
  pump() {
    if (this.busy || !this.media) return;
    for (const sh of this.sheets) {
      const w = sh.want;
      if (!w || sh.shown?.key === w.key || sh.failed === w.key) continue;
      const hit = this.cache.get(this.cacheKey(w));
      if (hit) {
        this.show(sh, w, hit);
        continue;
      }
      this.build(sh, w).then((data) => {
        if (data && sh.want?.key === w.key) this.show(sh, w, data);
      });
      return;
    }
    // Prefetch the page after the first sheet's (PDFs only).
    const first = this.sheets[0];
    if (this.media.kind === "pdf" && first?.want && first.shown?.key === first.want.key) {
      const p = first.want.page + this.sheets.length;
      if (p < this.media.count) {
        const w = { ...first.want, page: p, key: `${p}|${first.want.level}|${first.want.method}` };
        if (!this.cache.has(this.cacheKey(w))) this.build(first, w);
      }
    }
  }

  cacheKey(w) {
    return `${w.sheet}|${w.key}`;
  }

  // Draws the page and builds its splats; caches the result.
  async build(sheet, want) {
    this.busy = true;
    const media = this.media;
    try {
      const aspect = media.aspect(want.page);
      let w = want.level;
      let h = Math.max(8, Math.round(w / aspect));
      const t0 = performance.now();
      let canvas = want.method === "screen" ? null : await media.draw(want.page, w, h);
      if (this.destroyed || media !== this.media) return null;
      // The page may have turned out another shape once reached.
      const a2 = media.aspect(want.page);
      if (Math.abs(a2 - aspect) > 1e-3 && canvas) {
        h = Math.max(8, Math.round(w / a2));
        canvas = await media.draw(want.page, w, h);
      }
      const t1 = performance.now();
      const pixels = canvas
        ? canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data
        : null;
      const geom = this.geometry(sheet, media.aspect(want.page), w, h);
      let data = await buildOffThread({ pixels, w, h, method: want.method, ...geom });
      // A page with more ink than the budget is built again, smaller.
      if (want.method === "ink" && data.count > this.budget.ink && canvas) {
        const f = Math.sqrt(this.budget.ink / data.count) * 0.95;
        const w2 = Math.max(64, Math.floor(w * f));
        const h2 = Math.max(8, Math.round(w2 / media.aspect(want.page)));
        const c2 = await media.draw(want.page, w2, h2);
        if (this.destroyed || media !== this.media) return null;
        const px2 = c2.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w2, h2).data; // prettier-ignore
        data = await buildOffThread({ pixels: px2, w: w2, h: h2, method: want.method, ...this.geometry(sheet, media.aspect(want.page), w2, h2) }); // prettier-ignore
        w = w2;
        h = h2;
      }
      if (this.destroyed || media !== this.media) return null;
      data.w = w;
      data.h = h;
      data.drawMs = t1 - t0;
      data.totalMs = performance.now() - t0;
      this.stats.builds++;
      this.stats.lastMs = data.totalMs;
      this.stats.lastCount = data.count;
      this.remember(this.cacheKey(want), data);
      return data;
    } catch (err) {
      // Said once; the same page is not tried again until something changes.
      // (Media replaced meanwhile is closed under it: nothing to say.)
      if (!this.destroyed && media === this.media) this.player.emit("message", err.message);
      sheet.failed = want.key;
      return null;
    } finally {
      this.busy = false;
      this.stage.requestRender();
    }
  }

  // Keeps built pages up to about 600,000 splats (68 bytes each, about
  // 40 MB), or one sheet's budget if that is more; the oldest go first.
  remember(key, data) {
    this.cache.delete(key);
    this.cache.set(key, data);
    const limit = Math.max(600e3, this.budget.ink);
    let total = 0;
    for (const d of this.cache.values()) total += d.count;
    for (const [k, d] of this.cache) {
      if (total <= limit || this.cache.size <= 1) break;
      if (this.sheets.some((sh) => sh.shown?.data === d)) continue;
      this.cache.delete(k);
      total -= d.count;
    }
  }

  // The sheet's corner, pixel steps and facing for a w x h picture.
  geometry(sheet, aspect, w, h) {
    const { c, hw, hh } = this.rect(sheet, aspect);
    const origin = addv(c, addv(mul(sheet.x, -hw), mul(sheet.y, hh)));
    const right = mul(sheet.x, (2 * hw) / w);
    const down = mul(sheet.y, (-2 * hh) / h);
    const leaf =
      sheet.def.leaf !== null && sheet.def.leaf !== undefined && this.spine
        ? { slot: sheet.def.leaf, spine: this.spine.at, dir: this.spine.dir }
        : null;
    return {
      origin,
      right,
      down,
      normal: sheet.n,
      part: sheet.def.part || 0,
      opacity: sheet.def.opacity,
      leaf,
    };
  }

  // Puts built splats on the sheet: into its container when they fit,
  // else into a new, bigger one.
  show(sheet, want, data) {
    const st = this.stage;
    if (!st.toy) return;
    let slot = sheet.slot;
    if (!slot || slot.container.maxSplats < data.count) {
      // The old sheet stays on show for a few frames: a new container
      // draws nothing until the engine has sorted it.
      if (slot) this.retiring.push({ slot, frames: 6 });
      const cap = Math.ceil(data.count * 1.25);
      slot = st.addSheet(this.player.pictureContainer(cap));
      if (!slot) return;
      sheet.slot = slot;
    }
    const ct = slot.container;
    const put = (name, arr) => {
      const t = ct.getTexture(name);
      const d = t.lock();
      d.set(arr.subarray(0, Math.min(arr.length, data.count * 4, d.length)));
      t.unlock();
    };
    put("dataCenter", data.center);
    put("dataColor", data.color);
    put("dataScale", data.scale);
    put("dataRotation", data.rotation);
    put("splatAnim", data.anim);
    ct.centers.set(data.centers.subarray(0, data.count * 3));
    const aabb = new pc.BoundingBox();
    // Pages that bend or move with a part can leave their rest place: the
    // toy's whole sphere keeps them in view.
    aabb.setMinMax(new pc.Vec3(-1.2, -1.2, -1.2), new pc.Vec3(1.2, 1.2, 1.2));
    ct.aabb = aabb;
    ct.update(data.count, true);
    sheet.shown = { ...want, data, w: data.w, h: data.h };
    slot.entity.enabled = true;
    this.stats.rendered.push({ page: want.page, level: want.level, count: data.count });
    if (this.stats.rendered.length > 50) this.stats.rendered.shift();
    // A new screen sheet needs its first frame now.
    if (want.method === "screen") {
      if (this.media.kind === "gif") this.uploadFrame(this.gifFrame ?? 0);
      else this.frameDirty = true;
    }
    this.player.emit("pictures", this.info());
    st.requestRender();
  }

  // Splats on show now (every sheet), for tests and the status line.
  splats() {
    return this.sheets.reduce(
      (n, sh) => n + (sh.slot && sh.slot.entity.enabled ? sh.slot.container.numSplats : 0),
      0,
    );
  }

  destroy() {
    this.destroyed = true;
    this.unwatch?.();
    this.cache.clear();
    for (const sh of this.sheets) sh.slot = null;
  }
}
