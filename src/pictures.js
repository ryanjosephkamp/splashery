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
// - A PDF's words: pics.text(n) in the API reads a page's text layer, for
//   the Toy tab's words box (to read, select, copy and find them).
//
// A recipe places sheets with k.sheet(...) and picks each one's page in
// drive(): out.sheets[id] = { page, visible }. The pictures API is
// info.data.pictures in drive (page, count, kind, next(), prev(), go(n),
// togglePlay(), playing, and hold(on) and held for a GIF held on its frame).
//
// Lane Books r5: pics.links(n) and pics.figures(n) give a PDF page's links
// and picture boxes, pics.crop(n, box, size) draws part of a page or a
// picture, and pics.openLink(url) asks the visitor before a web link opens.
// A sheet may show part of its page (out.sheets[id].crop, placed where that
// part lies on the page), raised off the sheet by a relief map
// (out.sheets[id].relief), and a page may be drawn another way by the
// recipe's decorate (out.sheets[id].variant).

import * as pc from "./pc.js";
import { buildSheet } from "./picture-splats.js";
import { safeLinkURL, clampRegion } from "./media.js";

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
  constructor(player, { defs, transform, spine, profile, decorate = null }) {
    this.player = player;
    this.decorate = decorate;
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
    this.order = 0; // a set's order: bumped when it changes, so its pages rebuild (lane Books)
    this.cache = new Map(); // key -> built sheet data (a few, by splat count)
    this.busy = false;
    this.pending = null;
    this.gifTime = 0;
    // A GIF held on its frame (lane Screens r2: the Screen holds it while
    // switched off): its clock stops while held and goes on from there.
    this.gifHeldAt = null; // the player's time when it was held, or null
    this.gifLost = 0; // seconds of the player's time spent held
    this.lastTime = 0;
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
    this.gifHeldAt = null;
    this.gifLost = 0;
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
        const k = self.media?.kind;
        return k === "video" ? self.media.playing : k === "gif" && self.gifHeldAt === null;
      },
      next: () => this.go(this.page + 1),
      prev: () => this.go(this.page - 1),
      go: (n) => this.go(n),
      togglePlay: () => this.togglePlay(),
      // Holds a GIF on the frame it shows (true), or lets it play on from
      // there (false); lane Screens r2. Nothing for other media.
      hold: (on) => this.hold(on),
      get held() {
        return self.gifHeldAt !== null;
      },
      // Lane Books: whether sheet `id` shows (or holds, hidden) the page it
      // was last asked for, and a picture's shape (width over height).
      ready: (id) => {
        const sh = this.sheets.find((x) => x.def.id === id);
        return !!sh && !!sh.want && sh.shown?.key === sh.want.key;
      },
      aspect: (n = this.page) => self.media?.aspect?.(n) ?? 0,
      // A PDF page's words, from its text layer (the Toy tab's words box):
      // a promise of a string, "" for a page without one or other media.
      text: (n = this.page) => self.text(n),
      // A video's time and length (seconds), and a seek (lane Books, for
      // lane Screens); 0 for anything else.
      get time() {
        return self.media?.kind === "video" ? self.media.video?.currentTime || 0 : 0;
      },
      get duration() {
        return self.videoDuration();
      },
      seek: (s) => self.seek(s),
      nameOf: (n) => self.media?.names?.[n] ?? self.media?.name ?? "",
      // Lane Books: a set's names in their order, a new order (order[j] is
      // the picture, by its place now, that goes to place j; the picture
      // on show stays on show), and a small picture of item n (a canvas
      // `size` pixels on its longer side).
      get names() {
        return self.media?.names ?? [];
      },
      reorder: (order) => self.reorder(order),
      thumb: (n, size = 48) => self.thumb(n, size),
      // Lane Books r5: page n's links ([{ box, url } or { box, page }]) and
      // picture boxes ([{ box }]), boxes in fractions of the page from its
      // top-left corner; [] for media without them. crop(n, box, size) is a
      // promise of a canvas of that part of page n, `size` pixels on its
      // longer side (null for a GIF or a video). openLink(url) shows the
      // visitor the address and opens it only if they say so: true when the
      // address may open at all (http:, https: or mailto:).
      links: (n = this.page) => self.pageList("links", n),
      figures: (n = this.page) => self.pageList("figures", n),
      crop: (n, box, size = 512) => self.crop(n, box, size),
      openLink: (url) => self.openLink(url),
    };
  }

  // A PDF page's links or picture boxes (lane Books r5).
  pageList(what, n) {
    const m = this.media;
    const i = Math.round(n);
    if (!m?.[what] || !(i >= 0 && i < m.count)) return Promise.resolve([]);
    return m[what](i).catch(() => []);
  }

  async crop(n, box, size) {
    const m = this.media;
    const i = Math.round(n);
    if (!m?.draw || (m.kind !== "pdf" && m.kind !== "image") || !(i >= 0 && i < m.count)) return null; // prettier-ignore
    const r = clampRegion(box);
    const a = (m.aspect(i) * (r[2] - r[0])) / (r[3] - r[1]);
    const s = Math.max(8, Math.min(4096, Math.round(size)));
    const w = Math.max(1, Math.round(a >= 1 ? s : s * a));
    const h = Math.max(1, Math.round(a >= 1 ? s / a : s));
    return m.draw(i, w, h, r);
  }

  // Asks the app to confirm a web link (src/ui.js shows the address and an
  // Open button that is a real link, opened in a new tab without access to
  // this page). Unsafe addresses never get that far.
  openLink(url) {
    const safe = safeLinkURL(url);
    if (!safe) return false;
    this.player.emit("link", { url: safe });
    return true;
  }

  // Puts a set's pictures in a new order (lane Books): the pages built for
  // the old order are dropped, and the picture on show keeps showing.
  reorder(order) {
    const m = this.media;
    if (!m?.reorder || !m.reorder(order)) return false;
    this.order++;
    this.cache.clear();
    this.page = Math.max(0, order.indexOf(this.page));
    this.player.emit("pictures", this.info());
    this.stage.requestRender();
    return true;
  }

  async thumb(n, size) {
    const m = this.media;
    if (!m?.draw || m.kind !== "image") return null;
    const a = m.aspect?.(n) || 1;
    const w = Math.max(1, Math.round(a >= 1 ? size : size * a));
    const h = Math.max(1, Math.round(a >= 1 ? size / a : size));
    return m.draw(n, w, h);
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

  // A video's length in seconds: a WebM recorded in a browser can say
  // Infinity until it has played through, so the end of what it can seek
  // to stands in (lane Books).
  videoDuration() {
    const m = this.media;
    if (m?.kind !== "video") return 0;
    const d = m.duration;
    if (Number.isFinite(d) && d > 0) return d;
    const r = m.video?.seekable;
    return r?.length ? r.end(r.length - 1) || 0 : 0;
  }

  // Moves a video to `s` seconds (clamped); the new frame is uploaded once
  // the video has it, playing or paused.
  seek(s) {
    const m = this.media;
    if (m?.kind !== "video" || !Number.isFinite(s)) return false;
    m.video?.addEventListener?.(
      "seeked",
      () => {
        if (this.media !== m) return;
        this.frameDirty = true;
        this.stage.requestRender();
      },
      { once: true },
    );
    m.seek(Math.max(0, Math.min(this.videoDuration() || s, s)));
    this.player.emit("pictures", this.info());
    return true;
  }

  togglePlay() {
    const m = this.media;
    if (m?.kind !== "video") return false;
    if (m.playing) m.pause();
    else m.play();
    this.player.emit("pictures", this.info());
    return !m.playing;
  }

  hold(on) {
    const held = this.gifHeldAt !== null;
    if (!!on === held) return;
    if (on) this.gifHeldAt = this.lastTime;
    else {
      this.gifLost += Math.max(0, this.lastTime - this.gifHeldAt);
      this.gifHeldAt = null;
    }
    this.stage.requestRender();
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

  // Page n's words (from 0), or "" when the media has no text layer (a
  // picture, a video, a scanned page) or the page can't be read.
  text(n = this.page) {
    const m = this.media;
    const i = Math.round(n);
    if (!m?.text || !(i >= 0 && i < m.count)) return Promise.resolve("");
    return m.text(i).catch(() => "");
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
  // (`share`: the share of the picture's width a cropped sheet shows.)
  levelFor(sheet, aspect, px, page = 0, share = 1, method = this.methodFor(sheet)) {
    const b = this.budget;
    let cap;
    if (method === "ink") cap = b.width;
    else cap = Math.sqrt((method === "screen" ? b.screen : b.pixels) * aspect);
    if (method !== "ink" && this.media?.size) cap = Math.min(cap, this.media.size(page).width * share); // prettier-ignore
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
    this.lastTime = time;
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
      // A hidden sheet asked for `ahead` is built all the same (after the
      // ones on show) and stays hidden, ready for when it shows (lane Books).
      sh.hidden = !(vis > 0);
      const has = m && page >= 0 && page < count && (vis > 0 || !!o?.ahead);
      if (sh.slot) sh.slot.entity.enabled = !!has && !!sh.shown && !sh.hidden;
      if (!has) {
        sh.want = null;
        continue;
      }
      // Lane Books r5: part of the page (crop), raised (relief), or drawn
      // another way by decorate (variant). Only pictures and PDFs crop.
      const crop = o?.crop && (m.kind === "pdf" || m.kind === "image") ? clampRegion(o.crop) : null; // prettier-ignore
      const relief = crop && o?.relief?.d ? o.relief : null;
      const variant = o?.variant ? String(o.variant) : "";
      const pageAspect = m.aspect(page);
      const cw = crop ? crop[2] - crop[0] : 1;
      const ch = crop ? crop[3] - crop[1] : 1;
      const aspect = (pageAspect * cw) / ch;
      const px = this.screenWidth(sh, pageAspect) * cw;
      // (A cropped part is built as pixels: a figure as a card, unless the
      // sheet asks for ink.)
      const method = crop && sh.def.method !== "ink" ? "pixels" : this.methodFor(sh);
      const level = this.levelFor(sh, aspect, px, page, cw, method);
      // A new level must hold for a moment (a pinch passes through many).
      if (level !== sh.wantLevel) {
        sh.wantLevel = level;
        sh.levelSince = now;
      }
      const shown = sh.shown;
      const settled = now - sh.levelSince > 250;
      // (The same page, or the same part of it.)
      const same = !!shown && shown.page === page && String(shown.crop) === String(crop);
      let useLevel = same ? shown.level : level;
      if (same && settled) {
        const r = level / shown.level;
        // Rebuild when the view is much closer (sharper) or much further
        // (splats would fall under a pixel).
        if (r > 1.3 || r < 0.6) useLevel = level;
      }
      if (!same) useLevel = level;
      // Frames keep coming while a new level waits to settle.
      if (level !== (shown?.level ?? 0) && same) this.stage.requestRender(300);
      // (The key is unchanged for a plain sheet.)
      const extra = (crop ? `|c${crop.map((v) => v.toFixed(4)).join(",")}` : "") + (relief ? `|r${relief.key ?? ""}` : "") + (variant ? `|v${variant}` : ""); // prettier-ignore
      sh.want = {
        sheet: sh.i,
        page,
        level: useLevel,
        method,
        crop,
        relief,
        variant,
        key: `${page}|${useLevel}|${method}|${this.order}${extra}`,
      };
    }
    this.pump();
    // Live frames for screen sheets.
    if (m?.kind === "gif") {
      const f = m.frameAt((this.gifHeldAt ?? time) - this.gifLost);
      if (f !== this.gifFrame) {
        this.gifFrame = f;
        this.uploadFrame(f);
      }
      if (this.gifHeldAt === null) this.stage.requestRender();
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
    // Sheets on show first, then the ones built ahead.
    const order = this.sheets.filter((sh) => !sh.hidden).concat(this.sheets.filter((sh) => sh.hidden)); // prettier-ignore
    for (const sh of order) {
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
    if (
      this.media.kind === "pdf" &&
      first?.want &&
      !first.want.crop &&
      !first.want.variant &&
      first.shown?.key === first.want.key
    ) {
      // prettier-ignore
      const p = first.want.page + this.sheets.length;
      if (p < this.media.count) {
        const w = { ...first.want, page: p, key: `${p}|${first.want.level}|${first.want.method}|${this.order}` }; // prettier-ignore
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
      if (want.crop) return await this.buildCrop(sheet, want, media);
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
      const links = this.decorate && media.links ? await media.links(want.page).catch(() => []) : null; // prettier-ignore
      if (this.destroyed || media !== this.media) return null;
      this.decorateCanvas(canvas, sheet, want.page, media, want.variant, links);
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
        this.decorateCanvas(c2, sheet, want.page, media, want.variant, links);
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

  // Lane Books: the recipe's pictures.decorate(canvas, { page, name, sheet,
  // kind, options }) draws on a page or picture (a copy the media made for
  // this build) before it becomes splats; errors in it are ignored. Lane
  // Books r5 adds `variant` (the sheet's, "" for none) and, for a PDF,
  // `links` (the page's, as pics.links gives them).
  decorateCanvas(canvas, sheet, page, media, variant = "", links = null) {
    if (!this.decorate || !canvas) return;
    try {
      this.decorate(canvas, { page, sheet: sheet.def.id, kind: media.kind, name: media.names?.[page] ?? media.name ?? "", variant, links: links || [] }); // prettier-ignore
    } catch (err) {
      console.warn("pictures.decorate:", err);
    }
  }

  // Lane Books r5: a sheet that shows part of its page: that part drawn at
  // the sheet's level, built as pixels where it lies on the page, raised by
  // the relief map. Never decorated (a figure lifted off a page is clean).
  async buildCrop(sheet, want, media) {
    const r = want.crop;
    const pageAspect = media.aspect(want.page);
    const a = (pageAspect * (r[2] - r[0])) / (r[3] - r[1]);
    const w = Math.max(8, want.level);
    const h = Math.max(8, Math.round(w / a));
    const t0 = performance.now();
    const canvas = await media.draw(want.page, w, h, r);
    if (this.destroyed || media !== this.media) return null;
    const t1 = performance.now();
    const pixels = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data; // prettier-ignore
    const geom = this.geometry(sheet, media.aspect(want.page), w, h, r);
    const rel = want.relief;
    const relief = rel ? { w: rel.w, h: rel.h, d: Float32Array.from(rel.d), amount: (rel.depth || 0) * this.fitScale } : null; // prettier-ignore
    const data = await buildOffThread({ pixels, w, h, method: want.method, relief, ...geom }); // prettier-ignore
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

  // The sheet's corner, pixel steps and facing for a w x h picture (lane
  // Books r5: for `crop`, the part of the page's rectangle it shows).
  geometry(sheet, aspect, w, h, crop = null) {
    const { c, hw, hh } = this.rect(sheet, aspect);
    const [x0, y0, x1, y1] = crop || [0, 0, 1, 1];
    const origin = addv(c, addv(mul(sheet.x, hw * (2 * x0 - 1)), mul(sheet.y, hh * (1 - 2 * y0))));
    const right = mul(sheet.x, (2 * hw * (x1 - x0)) / w);
    const down = mul(sheet.y, (-2 * hh * (y1 - y0)) / h);
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
      // Room for pages with more ink than this one (text pages vary by
      // about a quarter), so paging through a book keeps one container.
      const cap = Math.ceil(data.count * 1.5);
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
    slot.entity.enabled = !sheet.hidden;
    // A page on a leaf or a part arrives sorted in its built pose: sort it
    // where it stands (Player.resortPose, lane Books).
    if (sheet.def.leaf !== null || sheet.def.part) this.player.poseStale = true;
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
