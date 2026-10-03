// Media in (lane Pictures): opens a PDF, a picture, an animated GIF or a
// video, from a file on this device or from a web address, and draws any
// page or frame at the size a toy asks for. Everything stays in the
// browser: files are read here and never uploaded. PDF.js and omggif are
// vendored and loaded only when a PDF or a GIF (in a browser without
// ImageDecoder) is opened.
//
// const m = await openMedia(fileOrUrl, { profile });
// m.kind: "pdf" | "image" | "gif" | "video"; m.name; m.count (pages or
// frames; 1 for a picture or a video); m.aspect(i) (width / height);
// await m.draw(i, width, height) -> a canvas (a PDF page or GIF frame i, the
// picture, or the video's current frame); for a GIF, m.delays (ms per
// frame) and m.duration (s); for a video, m.video (the element), m.play(),
// m.pause(), m.seek(s), m.duration, m.playing, m.setMuted(muted) and
// m.onFrame(fn) (called on each new video frame); for a PDF, await m.text(i)
// -> page i's words from its text layer, a line per line of the page ("" for
// a page with none, like a scan); m.close().
//
// Lane Books r5: for a PDF, await m.links(i) -> page i's links, [{ box, url }
// or { box, page }] (box [x0, y0, x1, y1] in fractions of the page from its
// top-left corner; url only http:, https: or mailto:, page 0-based), and
// await m.figures(i) -> the boxes its pictures are painted in, [{ box }].
// m.draw(i, w, h, region) draws only `region` ([x0, y0, x1, y1], the same
// fractions) of a PDF page or a picture into w x h.

import { LIMITS } from "./loaders.js";
import { normalizeMediaURL } from "./state.js";

const ROOT = new URL("../", import.meta.url);
const PDFJS = new URL("vendor/pdfjs/", ROOT).href;

// How big a file each device tier opens (videos stream, so they may be
// bigger), and how many pixels a picture may have once decoded.
export const MEDIA_LIMITS = {
  low: { bytes: LIMITS.low.warnBytes, videoBytes: 300e6, pixels: 16e6, pages: 2000 },
  mid: { bytes: LIMITS.mid.warnBytes, videoBytes: 600e6, pixels: 24e6, pages: 5000 },
  high: { bytes: LIMITS.high.warnBytes, videoBytes: 1.5e9, pixels: 40e6, pages: 10000 },
  max: { bytes: LIMITS.max.warnBytes, videoBytes: 3e9, pixels: 64e6, pages: 20000 },
};

export const MEDIA_ACCEPT = {
  pdf: ".pdf,application/pdf",
  image: "image/*,.png,.jpg,.jpeg,.webp,.avif,.bmp,.svg",
  gif: ".gif,image/gif",
  video: "video/*,.mp4,.webm,.mov,.m4v,.ogv",
};

export class MediaError extends Error {}

const mb = (n) => `${Math.round(n / 1e6)} MB`;

// Web addresses: https only, or the local test server.
export function checkMediaURL(url) {
  try {
    new URL(String(url).trim());
  } catch {
    throw new MediaError("That is not a web address. Paste a full address starting with https://.");
  }
  const ok = normalizeMediaURL(String(url));
  if (!ok) throw new MediaError("Only https:// addresses can be opened here.");
  return ok;
}

// Lane Books r5: the web address a link in a page may open, or null. Only
// http:, https: and mailto: addresses; never javascript:, file: or data:.
export function safeLinkURL(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  let u;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (!["http:", "https:", "mailto:"].includes(u.protocol)) return null;
  if (u.protocol !== "mailto:" && !u.hostname) return null;
  return u.href;
}

// The kind of a file from its type, name or first bytes.
export function mediaKind(name = "", type = "", head = null) {
  const n = name.toLowerCase().split(/[?#]/)[0];
  if (head && head.length >= 4) {
    const s = String.fromCharCode(...head.slice(0, 4));
    if (s === "%PDF") return "pdf";
    if (s === "GIF8") return "gif";
  }
  if (type === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (type === "image/gif" || n.endsWith(".gif")) return "gif";
  if (type.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv|mkv)$/.test(n)) return "video";
  if (type.startsWith("image/") || /\.(png|jpe?g|webp|avif|bmp|svg|ico|tiff?)$/.test(n))
    return "image";
  return "";
}

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// Draws an image source into a new canvas of w x h with smooth scaling.
// `region` ([x0, y0, x1, y1] in fractions, lane Books r5) draws only that
// part of the source.
function drawScaled(src, sw, sh, w, h, region = null) {
  if (region) {
    const [x0, y0, x1, y1] = clampRegion(region);
    const rw = Math.max(1, Math.round((x1 - x0) * sw));
    const rh = Math.max(1, Math.round((y1 - y0) * sh));
    const part = canvas(rw, rh);
    part.getContext("2d").drawImage(src, x0 * sw, y0 * sh, (x1 - x0) * sw, (y1 - y0) * sh, 0, 0, rw, rh); // prettier-ignore
    return drawScaled(part, rw, rh, w, h);
  }
  const c = canvas(w, h);
  const g = c.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  // Big reductions look better in halving steps.
  let s = src;
  let cw = sw;
  let ch = sh;
  while (cw / 2 > w * 1.2 && ch / 2 > h * 1.2) {
    const t = canvas(cw / 2, ch / 2);
    const tg = t.getContext("2d");
    tg.imageSmoothingQuality = "high";
    tg.drawImage(s, 0, 0, t.width, t.height);
    s = t;
    cw = t.width;
    ch = t.height;
  }
  g.drawImage(s, 0, 0, c.width, c.height);
  return c;
}

// A region kept inside the picture, at least a hair wide (lane Books r5).
export function clampRegion(r) {
  const c = (v) => Math.max(0, Math.min(1, Number(v) || 0));
  const x0 = c(Math.min(r[0], r[2]));
  const x1 = Math.max(x0 + 1e-3, c(Math.max(r[0], r[2])));
  const y0 = c(Math.min(r[1], r[3]));
  const y1 = Math.max(y0 + 1e-3, c(Math.max(r[1], r[3])));
  return [x0, y0, Math.min(1, x1), Math.min(1, y1)];
}

// Reads the source: a File or Blob (with a name), or a web address.
async function readSource(source, limits) {
  if (typeof source === "string") {
    const url = checkMediaURL(source);
    const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "picture");
    let res;
    try {
      res = await fetch(url, { mode: "cors", credentials: "omit" });
    } catch {
      throw new MediaError(
        "That site would not share the file with other sites (it does not allow cross-origin requests), or it could not be reached. Download it and open it from your device instead.",
      );
    }
    if (!res.ok) throw new MediaError(`That address answered with an error (${res.status}).`);
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    const size = Number(res.headers.get("content-length")) || 0;
    const kind = mediaKind(name, type);
    if (kind === "video") {
      // Videos stream from the address itself (the site must allow it).
      res.body?.cancel?.();
      return { kind, name, url, size };
    }
    if (size > limits.bytes) throw tooBig(size, limits.bytes);
    const blob = await res.blob();
    if (blob.size > limits.bytes) throw tooBig(blob.size, limits.bytes);
    return { kind: kind || (await sniff(blob)), name, blob, size: blob.size, url };
  }
  const name = source.name || "picture";
  const kind = mediaKind(name, source.type || "") || (await sniff(source));
  const cap = kind === "video" ? limits.videoBytes : limits.bytes;
  if (source.size > cap) throw tooBig(source.size, cap);
  return { kind, name, blob: source, size: source.size, url: null };
}

async function sniff(blob) {
  const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  return mediaKind("", blob.type || "", head);
}

function tooBig(size, cap) {
  return new MediaError(
    `That file is too big for this device (${mb(size)}; up to ${mb(cap)} here). Try a smaller one, or raise Detail in the Look tab on a stronger device.`,
  );
}

export async function openMedia(source, { profile = "mid" } = {}) {
  // A live stream (lane Live input: a shared screen, a camera).
  if (source?.live && source.stream) return (await import("./live/stream.js")).openStream(source);
  const limits = MEDIA_LIMITS[profile] || MEDIA_LIMITS.mid;
  if (Array.isArray(source)) return openImageSet(source, limits); // lane Books
  const src = await readSource(source, limits);
  if (src.kind === "pdf") return openPDF(src, limits);
  if (src.kind === "gif") return openGIF(src, limits);
  if (src.kind === "video") return openVideo(src, limits);
  if (src.kind === "image") return openImage(src, limits);
  throw new MediaError(
    `Splashery can't read ${src.name}. It opens PDFs, pictures (PNG, JPEG, WebP, AVIF), GIFs and videos (MP4, WebM).`,
  );
}

// ---- Pictures -------------------------------------------------------------------

async function openImage(src, limits) {
  let bmp;
  try {
    bmp = await createImageBitmap(src.blob);
  } catch {
    throw new MediaError(`This browser can't read the picture ${src.name}.`);
  }
  if (bmp.width * bmp.height > limits.pixels) {
    const px = bmp.width * bmp.height;
    bmp.close();
    throw new MediaError(
      `That picture is too big for this device (${Math.round(px / 1e6)} megapixels; up to ${Math.round(limits.pixels / 1e6)} here).`,
    );
  }
  return {
    kind: "image",
    name: src.name,
    url: src.url,
    count: 1,
    aspect: () => bmp.width / bmp.height,
    size: () => ({ width: bmp.width, height: bmp.height }),
    async draw(i, w, h, region = null) {
      return drawScaled(bmp, bmp.width, bmp.height, w, h, region);
    },
    close() {
      bmp.close();
    },
  };
}

// ---- A set of pictures (lane Books) ---------------------------------------------
// Several pictures opened as one media (a photo album, a digital frame):
// kind "image", count pictures, m.names (each file's name), m.aspect(i),
// m.size(i) and m.draw(i, w, h). Each picture is read and checked when the
// set opens, and decoded again when drawn (the last two stay decoded), so a
// big set holds only its files, not every photo's pixels. m.reorder(order)
// puts the pictures in a new order (order[j] is the picture, by its place
// now, that goes to place j).
export const MAX_SET = 200;

async function openImageSet(sources, limits) {
  if (sources.length > MAX_SET)
    throw new MediaError(`That is ${sources.length} pictures; a set here takes up to ${MAX_SET}.`);
  let items = [];
  let bytes = 0;
  for (const source of sources) {
    const src = await readSource(source, limits);
    if (src.kind !== "image" && src.kind !== "gif")
      throw new MediaError(`${src.name} is not a picture. A set takes pictures only (PNG, JPEG, WebP, AVIF).`); // prettier-ignore
    bytes += src.size || 0;
    if (bytes > limits.bytes * 4) throw tooBig(bytes, limits.bytes * 4);
    let bmp;
    try {
      bmp = await createImageBitmap(src.blob);
    } catch {
      throw new MediaError(`This browser can't read the picture ${src.name}.`);
    }
    const { width, height } = bmp;
    bmp.close();
    if (width * height > limits.pixels)
      throw new MediaError(`The picture ${src.name} is too big for this device (${Math.round((width * height) / 1e6)} megapixels; up to ${Math.round(limits.pixels / 1e6)} here).`); // prettier-ignore
    items.push({ name: src.name, blob: src.blob, width, height });
  }
  if (!items.length) throw new MediaError("Pick at least one picture.");
  let decoded = new Map();
  const bitmap = async (i) => {
    if (decoded.has(i)) return decoded.get(i);
    const b = await createImageBitmap(items[i].blob);
    decoded.set(i, b);
    for (const [k, v] of decoded)
      if (decoded.size > 2 && k !== i) {
        v.close();
        decoded.delete(k);
      }
    return b;
  };
  const at = (i) => items[Math.max(0, Math.min(items.length - 1, i | 0))];
  return {
    kind: "image",
    name: items.length === 1 ? items[0].name : `${items.length} pictures`,
    get names() {
      return items.map((it) => it.name);
    },
    url: null,
    count: items.length,
    aspect: (i = 0) => at(i).width / at(i).height,
    size: (i = 0) => ({ width: at(i).width, height: at(i).height }),
    async draw(i, w, h, region = null) {
      const k = Math.max(0, Math.min(items.length - 1, i | 0));
      const b = await bitmap(k);
      return drawScaled(b, b.width, b.height, w, h, region);
    },
    reorder(order) {
      const n = items.length;
      if (!Array.isArray(order) || order.length !== n) return false;
      if (new Set(order).size !== n || order.some((i) => !Number.isInteger(i) || i < 0 || i >= n)) return false; // prettier-ignore
      items = order.map((i) => items[i]);
      for (const b of decoded.values()) b.close();
      decoded = new Map();
      return true;
    },
    close() {
      for (const b of decoded.values()) b.close();
      decoded.clear();
    },
  };
}

// ---- PDF --------------------------------------------------------------------------

let pdfjs = null;
async function loadPDFJS() {
  if (!pdfjs) {
    pdfjs = await import(`${PDFJS}pdf.min.mjs`);
    pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.mjs`;
  }
  return pdfjs;
}

async function openPDF(src, limits) {
  const lib = await loadPDFJS();
  const data = new Uint8Array(await src.blob.arrayBuffer());
  let doc;
  let task;
  try {
    task = lib.getDocument({
      data,
      isEvalSupported: false,
      enableXfa: false,
      standardFontDataUrl: `${PDFJS}standard_fonts/`,
      cMapUrl: `${PDFJS}cmaps/`,
      cMapPacked: true,
      wasmUrl: `${PDFJS}wasm/`,
      iccUrl: `${PDFJS}iccs/`,
    });
    doc = await task.promise;
  } catch (err) {
    if (err?.name === "PasswordException")
      throw new MediaError(
        `${src.name} is protected by a password, so it can't be opened here. Save a copy without the password and open that.`,
      );
    throw new MediaError(`${src.name} could not be read as a PDF (${err?.message || err}).`);
  }
  if (doc.numPages > limits.pages)
    throw new MediaError(`That PDF has ${doc.numPages} pages; this device opens up to ${limits.pages}.`); // prettier-ignore
  // Page sizes, read as pages are reached (the first one now).
  const sizes = new Map();
  const pageSize = async (i) => {
    if (!sizes.has(i)) {
      const p = await doc.getPage(i + 1);
      const v = p.getViewport({ scale: 1 });
      sizes.set(i, { width: v.width, height: v.height });
    }
    return sizes.get(i);
  };
  const first = await pageSize(0);
  let rendering = Promise.resolve();
  // Each page's words, read once when first asked for (the Toy tab's words
  // box, lane Pictures): the page's text items in order, a new line where
  // the page's line ends, runs of spaces made one.
  const texts = new Map();
  const text = (i) => {
    if (!texts.has(i)) {
      const job = doc
        .getPage(i + 1)
        .then((page) => page.getTextContent())
        .then(({ items }) => {
          let s = "";
          for (const it of items) {
            if (typeof it.str !== "string") continue;
            s += it.str;
            if (it.hasEOL) s += "\n";
          }
          return s
            .split("\n")
            .map((line) => line.replace(/\s+/g, " ").trim())
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        });
      // A page that fails to read is asked again next time.
      job.catch(() => texts.delete(i));
      texts.set(i, job);
    }
    return texts.get(i);
  };
  // Lane Books r5: each page's links and picture boxes, read once when
  // first asked for (a page that fails to read is asked again next time).
  const once = (map, read) => (i) => {
    if (!map.has(i)) {
      const job = doc.getPage(i + 1).then((page) => read(page, i));
      job.catch(() => map.delete(i));
      map.set(i, job);
    }
    return map.get(i);
  };
  const links = once(new Map(), (page, i) => pdfLinks(doc, page, i));
  const figures = once(new Map(), (page) => pdfFigures(lib.OPS, page));
  return {
    kind: "pdf",
    name: src.name,
    url: src.url,
    count: doc.numPages,
    links,
    figures,
    // Pages not yet reached take the first page's shape.
    aspect: (i) => {
      const s = sizes.get(i) || first;
      return s.width / s.height;
    },
    pageSize,
    text,
    // Renders page i (0-based) to w x h on white paper. Renders one at a
    // time: PDF.js keeps one canvas busy per page.
    // A `region` (lane Books r5) draws only that part of the page.
    draw(i, w, h, region = null) {
      const job = rendering.then(async () => {
        const page = await doc.getPage(i + 1);
        const v1 = page.getViewport({ scale: 1 });
        sizes.set(i, { width: v1.width, height: v1.height });
        const c = canvas(w, h);
        const g = c.getContext("2d", { willReadFrequently: true });
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, c.width, c.height);
        const r = region ? clampRegion(region) : null;
        const scale = r ? c.width / (v1.width * (r[2] - r[0])) : c.width / v1.width;
        const viewport = r
          ? page.getViewport({ scale, offsetX: -r[0] * v1.width * scale, offsetY: -r[1] * v1.height * scale }) // prettier-ignore
          : page.getViewport({ scale });
        await page.render({ canvasContext: g, canvas: c, viewport, background: "#ffffff" }).promise;
        page.cleanup();
        return c;
      });
      rendering = job.catch(() => {});
      return job;
    },
    close() {
      task.destroy();
    },
  };
}

// ---- PDF links and figures (lane Books r5) ---------------------------------------

// A rectangle in PDF space as a box in fractions of the page (from its
// top-left corner, as the page is drawn), or null when it is off the page.
function pageBox(viewport, pts) {
  const xs = [];
  const ys = [];
  for (const [x, y] of pts) {
    const [vx, vy] = viewport.convertToViewportPoint(x, y);
    xs.push(vx / viewport.width);
    ys.push(vy / viewport.height);
  }
  const c = (v) => Math.max(0, Math.min(1, v));
  const box = [c(Math.min(...xs)), c(Math.min(...ys)), c(Math.max(...xs)), c(Math.max(...ys))];
  if (!(box[2] - box[0] > 1e-4 && box[3] - box[1] > 1e-4)) return null;
  return box;
}

// Page i's links: web links (only safe addresses, see safeLinkURL) and links
// to another page of the same document (an explicit destination, a named
// one, or the first, last, next or previous page).
export async function pdfLinks(doc, page, i) {
  const viewport = page.getViewport({ scale: 1 });
  const out = [];
  let annots = [];
  try {
    annots = await page.getAnnotations({ intent: "display" });
  } catch {
    return out;
  }
  for (const a of annots) {
    if (a?.subtype !== "Link" || !Array.isArray(a.rect)) continue;
    const [x0, y0, x1, y1] = a.rect;
    const box = pageBox(viewport, [
      [x0, y0],
      [x1, y0],
      [x0, y1],
      [x1, y1],
    ]);
    if (!box) continue;
    const raw = a.url ?? a.unsafeUrl;
    if (raw !== undefined && raw !== null) {
      const url = safeLinkURL(String(raw));
      if (url) out.push({ box, url });
      continue;
    }
    let target = null;
    try {
      let dest = a.dest;
      if (typeof dest === "string") dest = await doc.getDestination(dest);
      if (Array.isArray(dest) && dest.length) {
        const ref = dest[0];
        if (Number.isInteger(ref)) target = ref;
        else if (ref && typeof ref === "object") target = await doc.getPageIndex(ref);
      } else if (typeof a.action === "string") {
        const n = doc.numPages;
        target = { FirstPage: 0, LastPage: n - 1, NextPage: i + 1, PrevPage: i - 1 }[a.action] ?? null; // prettier-ignore
      }
    } catch {
      target = null;
    }
    if (Number.isInteger(target) && target >= 0 && target < doc.numPages)
      out.push({ box, page: target });
  }
  return out;
}

// The boxes page i's pictures are painted in, from its operator list: each
// image paint fills the unit square of the transform in force. Boxes that
// touch are joined (a picture painted in strips), tiny ones (an icon, a
// bullet) are dropped, and so is one that covers the whole page (a scan).
export async function pdfFigures(OPS, page) {
  const viewport = page.getViewport({ scale: 1 });
  const list = await page.getOperatorList();
  const mulM = (m, n) => [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
  const at = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const unitBox = (m) => pageBox(viewport, [at(m, 0, 0), at(m, 1, 0), at(m, 0, 1), at(m, 1, 1)]);
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const boxes = [];
  const { fnArray, argsArray } = list;
  for (let k = 0; k < fnArray.length; k++) {
    const fn = fnArray[k];
    const args = argsArray[k];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || ctm;
    else if (fn === OPS.transform && args?.length >= 6) ctm = mulM(ctm, args);
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm);
      const m = args?.[0];
      if (Array.isArray(m) || ArrayBuffer.isView(m)) ctm = mulM(ctm, Array.from(m));
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() || ctm;
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const b = unitBox(ctm);
      if (b) boxes.push(b);
    } else if (fn === OPS.paintImageXObjectRepeat && args) {
      // [objId, scaleX, scaleY, positions]: copies of one picture.
      const [, sx, sy, pos] = args;
      for (let p = 0; p + 1 < (pos?.length || 0); p += 2) {
        const b = unitBox(mulM(ctm, [sx, 0, 0, sy, pos[p], pos[p + 1]]));
        if (b) boxes.push(b);
      }
    } else if (fn === OPS.paintInlineImageXObjectGroup && Array.isArray(args?.[1])) {
      for (const it of args[1]) {
        if (!it?.transform) continue;
        const b = unitBox(mulM(ctm, it.transform));
        if (b) boxes.push(b);
      }
    }
  }
  return joinBoxes(boxes)
    .filter((b) => {
      const w = b[2] - b[0];
      const h = b[3] - b[1];
      return w * h >= 0.004 && w >= 0.04 && h >= 0.03 && w * h <= 0.9;
    })
    .map((box) => ({ box }));
}

// Joins boxes that overlap or touch (within a hair), until none do.
export function joinBoxes(boxes, gap = 0.004) {
  const out = boxes.map((b) => b.slice());
  let joined = true;
  while (joined) {
    joined = false;
    for (let a = 0; a < out.length && !joined; a++)
      for (let b = a + 1; b < out.length; b++) {
        const A = out[a];
        const B = out[b];
        if (A[0] - gap > B[2] || B[0] - gap > A[2] || A[1] - gap > B[3] || B[1] - gap > A[3]) continue; // prettier-ignore
        out[a] = [Math.min(A[0], B[0]), Math.min(A[1], B[1]), Math.max(A[2], B[2]), Math.max(A[3], B[3])]; // prettier-ignore
        out.splice(b, 1);
        joined = true;
        break;
      }
  }
  return out;
}

// ---- GIF --------------------------------------------------------------------------

async function openGIF(src, limits) {
  const bytes = new Uint8Array(await src.blob.arrayBuffer());
  if (typeof ImageDecoder !== "undefined") {
    try {
      if (await ImageDecoder.isTypeSupported("image/gif")) return await gifByDecoder(src, bytes, limits); // prettier-ignore
    } catch {
      // Fall back to omggif below.
    }
  }
  return gifByOmggif(src, bytes, limits);
}

async function gifByDecoder(src, bytes, limits) {
  const dec = new ImageDecoder({ data: bytes, type: "image/gif" });
  await dec.tracks.ready;
  await dec.completed;
  const track = dec.tracks.selectedTrack;
  const count = Math.max(1, track.frameCount);
  const firstFrame = (await dec.decode({ frameIndex: 0 })).image;
  const width = firstFrame.displayWidth;
  const height = firstFrame.displayHeight;
  if (width * height > limits.pixels) throw new MediaError("That GIF is too big for this device.");
  const delays = [Math.max(20, (firstFrame.duration || 100000) / 1000)];
  firstFrame.close();
  for (let i = 1; i < count; i++) {
    const f = (await dec.decode({ frameIndex: i })).image;
    delays.push(Math.max(20, (f.duration || 100000) / 1000));
    f.close();
  }
  return gifMedia(src, count, width, height, delays, async (i) => {
    const f = (await dec.decode({ frameIndex: i })).image;
    return { source: f, done: () => f.close() };
  }, () => dec.close()); // prettier-ignore
}

async function gifByOmggif(src, bytes, limits) {
  const { GifReader } = await import(new URL("vendor/omggif/omggif.js", ROOT).href);
  let r;
  try {
    r = new GifReader(bytes);
  } catch (err) {
    throw new MediaError(`${src.name} could not be read as a GIF (${err?.message || err}).`);
  }
  const width = r.width;
  const height = r.height;
  if (width * height > limits.pixels) throw new MediaError("That GIF is too big for this device.");
  const count = r.numFrames();
  const delays = [];
  for (let i = 0; i < count; i++) delays.push(Math.max(20, (r.frameInfo(i).delay || 10) * 10));
  // Frames are drawn onto one picture in order, with each frame's disposal.
  const pixels = new Uint8ClampedArray(width * height * 4);
  let at = -1;
  let saved = null;
  const step = (i) => {
    const prev = at >= 0 ? r.frameInfo(at) : null;
    if (prev?.disposal === 2) {
      for (let y = prev.y; y < prev.y + prev.height; y++)
        pixels.fill(0, (y * width + prev.x) * 4, (y * width + prev.x + prev.width) * 4);
    } else if (prev?.disposal === 3 && saved) pixels.set(saved);
    const info = r.frameInfo(i);
    saved = info.disposal === 3 ? pixels.slice() : null;
    r.decodeAndBlitFrameRGBA(i, pixels);
    at = i;
  };
  const img = new ImageData(pixels, width, height);
  const full = canvas(width, height);
  const fg = full.getContext("2d");
  return gifMedia(
    src,
    count,
    width,
    height,
    delays,
    async (i) => {
      if (i < at || at < 0) {
        pixels.fill(0);
        at = -1;
        saved = null;
      }
      while (at < i) step(at + 1);
      fg.putImageData(img, 0, 0);
      return { source: full, done: () => {} };
    },
    () => {},
  );
}

function gifMedia(src, count, width, height, delays, frame, close) {
  const duration = delays.reduce((a, b) => a + b, 0) / 1000;
  let busy = Promise.resolve();
  let closed = false;
  return {
    kind: "gif",
    name: src.name,
    url: src.url,
    count,
    delays,
    duration,
    aspect: () => width / height,
    size: () => ({ width, height }),
    // The frame showing at time t (s), looping.
    frameAt(t) {
      let ms = (((t % duration) + duration) % duration) * 1000;
      for (let i = 0; i < count; i++) {
        ms -= delays[i];
        if (ms < 0) return i;
      }
      return count - 1;
    },
    draw(i, w, h) {
      const job = busy.then(async () => {
        if (closed) throw new MediaError("This GIF was closed.");
        const f = await frame(Math.min(count - 1, Math.max(0, i)));
        // Transparent parts show as white paper.
        const c = canvas(w, h);
        const g = c.getContext("2d", { willReadFrequently: true });
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, c.width, c.height);
        g.imageSmoothingQuality = "high";
        g.drawImage(f.source, 0, 0, c.width, c.height);
        f.done();
        return c;
      });
      busy = job.catch(() => {});
      return job;
    },
    close() {
      closed = true;
      busy.then(close);
    },
  };
}

// ---- Video ------------------------------------------------------------------------

function openVideo(src) {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.muted = true;
  video.loop = true;
  video.preload = "auto";
  const objectURL = src.blob ? URL.createObjectURL(src.blob) : null;
  video.src = objectURL || src.url;
  const frameFns = new Set();
  let closed = false;
  const watch = () => {
    if (closed) return;
    if (video.requestVideoFrameCallback) {
      video.requestVideoFrameCallback(() => {
        for (const fn of frameFns) fn();
        watch();
      });
    }
  };
  if (!video.requestVideoFrameCallback) video.addEventListener("timeupdate", () => frameFns.forEach((fn) => fn())); // prettier-ignore
  return new Promise((resolve, reject) => {
    const fail = () => {
      if (objectURL) URL.revokeObjectURL(objectURL);
      const code = video.error?.code;
      reject(
        new MediaError(
          code === 4 || !src.blob
            ? `This browser can't play ${src.name}${src.url && !src.blob ? ", or that site does not share it with other sites" : ""}. MP4 (H.264) and WebM play almost everywhere; iPhone .mov videos play in Safari.`
            : `${src.name} could not be read as a video.`,
        ),
      );
    };
    video.addEventListener("error", fail, { once: true });
    video.addEventListener(
      "loadeddata",
      () => {
        video.removeEventListener("error", fail);
        watch();
        resolve({
          kind: "video",
          name: src.name,
          url: src.url,
          count: 1,
          video,
          get duration() {
            return video.duration || 0;
          },
          get playing() {
            return !video.paused;
          },
          aspect: () => video.videoWidth / video.videoHeight,
          size: () => ({ width: video.videoWidth, height: video.videoHeight }),
          play() {
            return video.play().catch(() => {
              // Autoplay with sound can be refused; play silently instead.
              video.muted = true;
              return video.play().catch(() => {});
            });
          },
          pause() {
            video.pause();
          },
          seek(s) {
            video.currentTime = Math.max(0, Math.min(video.duration || 0, s));
          },
          setMuted(m) {
            video.muted = !!m;
          },
          onFrame(fn) {
            frameFns.add(fn);
            return () => frameFns.delete(fn);
          },
          async draw(i, w, h) {
            return drawScaled(video, video.videoWidth, video.videoHeight, w, h);
          },
          close() {
            closed = true;
            video.pause();
            video.removeAttribute("src");
            video.load();
            if (objectURL) URL.revokeObjectURL(objectURL);
          },
        });
      },
      { once: true },
    );
    video.load();
  });
}
