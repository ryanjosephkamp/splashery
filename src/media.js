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
// m.onFrame(fn) (called on each new video frame); m.close().

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
function drawScaled(src, sw, sh, w, h) {
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
  const limits = MEDIA_LIMITS[profile] || MEDIA_LIMITS.mid;
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
    async draw(i, w, h) {
      return drawScaled(bmp, bmp.width, bmp.height, w, h);
    },
    close() {
      bmp.close();
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
  return {
    kind: "pdf",
    name: src.name,
    url: src.url,
    count: doc.numPages,
    // Pages not yet reached take the first page's shape.
    aspect: (i) => {
      const s = sizes.get(i) || first;
      return s.width / s.height;
    },
    pageSize,
    // Renders page i (0-based) to w x h on white paper. Renders one at a
    // time: PDF.js keeps one canvas busy per page.
    draw(i, w, h) {
      const job = rendering.then(async () => {
        const page = await doc.getPage(i + 1);
        const v1 = page.getViewport({ scale: 1 });
        sizes.set(i, { width: v1.width, height: v1.height });
        const c = canvas(w, h);
        const g = c.getContext("2d", { willReadFrequently: true });
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, c.width, c.height);
        const viewport = page.getViewport({ scale: c.width / v1.width });
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
