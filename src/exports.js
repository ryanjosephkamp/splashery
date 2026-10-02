// Exports: PNG of the view, GIF (vendored gifenc), WebM (MediaRecorder), a
// live recording (Record, UI r5), JSON downloads, and the embed snippets
// (iframe and custom element).

import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { encodeSceneHash } from "./codec.js";
import { formatBytes } from "./state.js";

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function timestampName(ext, prefix = "splashery") {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${prefix}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes(),
  )}${p(d.getSeconds())}.${ext}`;
}

export function canvasToBlob(canvas, type = "image/png") {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the image."))), type),
  );
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// ---- GIF ------------------------------------------------------------------

// renderFrame(i, n) resolves with a 2D canvas of size x size.
export async function encodeGIF({
  renderFrame,
  frames = 48,
  size = 512,
  loopMs = 4000,
  onProgress,
}) {
  const gif = GIFEncoder();
  const delay = Math.max(20, Math.round(loopMs / frames));
  for (let i = 0; i < frames; i++) {
    const canvas = await renderFrame(i, frames);
    const rgba = canvas.getContext("2d").getImageData(0, 0, size, size).data;
    const palette = quantize(rgba, 256, { format: "rgb565" });
    const index = applyPalette(rgba, palette, "rgb565");
    gif.writeFrame(index, size, size, { palette, delay, repeat: 0 });
    onProgress?.((i + 1) / frames);
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}

// ---- WebM -----------------------------------------------------------------

export function webmSupport() {
  if (typeof MediaRecorder === "undefined") {
    return { ok: false, reason: "this browser has no MediaRecorder." };
  }
  if (typeof HTMLCanvasElement === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    return { ok: false, reason: "this browser cannot record a canvas." };
  }
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) return { ok: false, reason: "this browser's MediaRecorder cannot produce WebM." };
  return { ok: true, mime };
}

// Records `seconds` of video. drawFrame(t01) renders one frame (resolves
// once it is on the canvas). Frames are paced in real time so the recorder
// gets correctly spaced timestamps.
export async function recordWebM({ canvas, seconds = 5, fps = 30, drawFrame, onProgress, mime }) {
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise((resolve) => (rec.onstop = resolve));
  rec.start();
  const start = performance.now();
  const total = seconds * 1000;
  let last = -Infinity;
  for (;;) {
    const elapsed = performance.now() - start;
    if (elapsed >= total) break;
    if (elapsed - last >= 1000 / fps - 2) {
      last = elapsed;
      await drawFrame(elapsed / total);
      track.requestFrame?.();
      onProgress?.(elapsed / total);
    } else {
      await nextFrame();
    }
  }
  await drawFrame(0.9999);
  track.requestFrame?.();
  await new Promise((r) => setTimeout(r, 150));
  rec.stop();
  await stopped;
  track.stop();
  onProgress?.(1);
  return new Blob(chunks, { type: mime.split(";")[0] });
}

// ---- Record (UI r5) -------------------------------------------------------------
// A live recording of the stage while someone plays: the canvas as it draws
// (drags, taps, effects, the turning view) and the site's sound, as MP4 where
// the browser records it (Safari, recent Chrome), otherwise WebM.

export const RECORD_LIMIT = 60; // seconds

// MP4 only with H.264 (what phones' photo libraries take); a browser that
// only says "video/mp4" without H.264 (open-source Chromium) gets WebM first.
const RECORD_TYPES = [
  ["video/mp4;codecs=avc1.42E01F,mp4a.40.2", "mp4"],
  ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "mp4"],
  ["video/mp4;codecs=avc1,mp4a", "mp4"],
  ["video/mp4;codecs=avc1", "mp4"],
  ["video/webm;codecs=vp9,opus", "webm"],
  ["video/webm;codecs=vp8,opus", "webm"],
  ["video/webm", "webm"],
  ["video/mp4", "mp4"],
];

export function recordSupport() {
  if (typeof MediaRecorder === "undefined") {
    return { ok: false, reason: "this browser cannot record video." };
  }
  if (typeof HTMLCanvasElement === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    return { ok: false, reason: "this browser cannot record the stage." };
  }
  const supported = (m) => {
    try {
      return MediaRecorder.isTypeSupported(m);
    } catch {
      return false;
    }
  };
  const hit = RECORD_TYPES.find(([m]) => supported(m));
  if (!hit) return { ok: false, reason: "this browser cannot record MP4 or WebM." };
  return { ok: true, mime: hit[0], ext: hit[1] };
}

// Starts recording `canvas` (and the sound from `audio`, { ctx, node }, a
// node every sound passes through, when there is one). Returns { stop(),
// frame(), done }: frame() hands the canvas to the video after each render
// (at most `fps` a second), and done resolves to { blob, ext, seconds } after
// a stop or the time limit. onTick(seconds) reports the time every quarter
// second.
export function startRecording({
  canvas,
  audio = null,
  maxSeconds = RECORD_LIMIT,
  onTick,
  fps = 30,
}) {
  const sup = recordSupport();
  if (!sup.ok) throw new Error(sup.reason);
  // Frames are handed over by frame() (the stage draws on demand, and not
  // every browser captures a WebGL canvas by itself).
  const video = canvas.captureStream(0);
  const track = video.getVideoTracks()[0];
  const tracks = [track];
  let tap = null;
  if (audio?.ctx && audio?.node && audio.ctx.createMediaStreamDestination) {
    // The site's limiter sits after `node` and is not exposed, so the
    // recording gets its own copy of it.
    const ctx = audio.ctx;
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -10;
    limit.knee.value = 6;
    limit.ratio.value = 8;
    limit.attack.value = 0.003;
    limit.release.value = 0.2;
    const dest = ctx.createMediaStreamDestination();
    audio.node.connect(limit);
    limit.connect(dest);
    tap = { node: audio.node, limit, dest };
    tracks.push(...dest.stream.getAudioTracks());
  }
  const stream = new MediaStream(tracks);
  // About 8 Mb/s for the picture: sharp at a phone's full resolution.
  const opts = { mimeType: sup.mime, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 128_000 };
  let rec;
  try {
    rec = new MediaRecorder(stream, opts);
  } catch {
    rec = new MediaRecorder(stream); // the browser's own choice of type
  }
  const type = (rec.mimeType || sup.mime).split(";")[0];
  const ext = /mp4/.test(type) ? "mp4" : "webm";
  const chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const t0 = performance.now();
  const seconds = () => (performance.now() - t0) / 1000;
  let timer = 0;
  let length = 0;
  const done = new Promise((resolve, reject) => {
    rec.onstop = () => {
      clearInterval(timer);
      for (const t of video.getTracks()) t.stop();
      if (tap) {
        try {
          tap.node.disconnect(tap.limit);
        } catch {
          // Already gone with its context.
        }
        tap.limit.disconnect();
      }
      if (!chunks.length) reject(new Error("The recording came out empty."));
      else resolve({ blob: new Blob(chunks, { type }), ext, seconds: length });
    };
    rec.onerror = (e) => reject(e.error || new Error("The recording stopped."));
  });
  let lastFrame = -Infinity;
  const frame = () => {
    const now = performance.now();
    if (rec.state !== "recording" || now - lastFrame < 1000 / fps - 2) return;
    lastFrame = now;
    track.requestFrame?.();
  };
  const stop = () => {
    if (rec.state === "inactive") return;
    length = Math.min(maxSeconds, seconds());
    rec.stop();
  };
  // A timeslice keeps memory in small pieces on long takes.
  rec.start(1000);
  frame();
  timer = setInterval(() => {
    const s = seconds();
    onTick?.(Math.min(s, maxSeconds));
    if (s >= maxSeconds) stop();
    else frame(); // a still stage still gives the video a few frames a second
  }, 250);
  return { stop, frame, done, ext };
}

// Hands a saved video to the phone's share sheet (Save Video on an iPhone)
// when the browser can share files; false when it cannot.
export function canShareFile(blob, filename) {
  try {
    const file = new File([blob], filename, { type: blob.type });
    return !!navigator.canShare?.({ files: [file] }) && file;
  } catch {
    return false;
  }
}

// ---- Links and embeds ----------------------------------------------------------

export const LINK_LIMIT = 12 * 1024;

export function appBaseURL() {
  return new URL("./", document.baseURI).href;
}

// Builds a share payload, dropping detail until it fits in a link.
export async function buildShareHash(scene) {
  const notes = [];
  if (scene.toy.kind === "file") {
    notes.push(
      `This toy is your own file (${scene.toy.file.name}); the link carries the settings only, so whoever opens it drops the same file in to see it.`,
    );
  }
  let payload = scene;
  let hash = await encodeSceneHash(payload);
  if (hash.length > LINK_LIMIT && scene.paint.stamps.length) {
    payload = { ...payload, paint: { stamps: [] } };
    hash = await encodeSceneHash(payload);
    notes.push(
      "The paint is too detailed for a link, so the link leaves it out. Save JSON to keep it.",
    );
  }
  if (hash.length > LINK_LIMIT && payload.toy.clay?.length) {
    payload = { ...payload, toy: { ...payload.toy, clay: [] } };
    if (payload.toy.kind === "builtin") delete payload.toy.clay;
    hash = await encodeSceneHash(payload);
    notes.push("The clay edits are too long for a link as well; save JSON to keep them.");
  }
  if (hash.length > LINK_LIMIT) {
    return {
      ok: false,
      hash: null,
      notes: [`The scene is ${formatBytes(hash.length)} as a link. Save JSON instead.`],
    };
  }
  return { ok: true, hash, notes, bytes: hash.length };
}

export function shareURL(hash) {
  return `${appBaseURL()}#s=${hash}`;
}

// Embed sizes for the Share pane: the widest the embed grows to. Embeds
// fill their column up to that width and keep a 4:3 shape.
export const EMBED_SIZES = [
  { id: "small", label: "Small", maxWidth: 360 },
  { id: "medium", label: "Medium", maxWidth: 600 },
  { id: "large", label: "Large", maxWidth: 900 },
  { id: "full", label: "Full width", maxWidth: 0 },
];

function sizeStyle(size) {
  const s = EMBED_SIZES.find((x) => x.id === size) || EMBED_SIZES[1];
  return `width:100%;${s.maxWidth ? `max-width:${s.maxWidth}px;` : ""}aspect-ratio:4/3`;
}

export function iframeSnippet(hash, { transparent = false, size = "medium" } = {}) {
  const q = transparent ? "?bg=transparent" : "";
  const src = `${appBaseURL()}embed/${q}#s=${hash}`;
  const style = `${sizeStyle(size)};border:0;border-radius:12px${transparent ? ";color-scheme:light" : ""}`;
  return `<iframe src="${src}" title="Splashery toy" loading="lazy" style="${style}"></iframe>`;
}

export function elementSnippet(hash, { transparent = false, size = "medium" } = {}) {
  const src = `${appBaseURL()}src/element.js`;
  const bg = transparent ? ' background="transparent"' : "";
  return `<script type="module" src="${src}"></script>\n<splashery-toy scene="${hash}"${bg} style="display:block;${sizeStyle(size)}"></splashery-toy>`;
}
