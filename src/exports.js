// Exports: PNG of the view, GIF (vendored gifenc), WebM (MediaRecorder),
// JSON downloads, and the embed snippets (iframe and custom element).

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

export function iframeSnippet(hash, { transparent = false, width = 400, height = 300 } = {}) {
  const q = transparent ? "?bg=transparent" : "";
  const src = `${appBaseURL()}embed/${q}#s=${hash}`;
  const style = `border:0;border-radius:12px;max-width:100%${transparent ? ";color-scheme:normal" : ""}`;
  return `<iframe src="${src}" width="${width}" height="${height}" title="Splashery toy" loading="lazy" style="${style}"></iframe>`;
}

export function elementSnippet(hash, { transparent = false } = {}) {
  const src = `${appBaseURL()}src/element.js`;
  const bg = transparent ? ' background="transparent"' : "";
  return `<script type="module" src="${src}"></script>\n<splashery-toy scene="${hash}"${bg} style="display:block;width:100%;max-width:400px;aspect-ratio:4/3"></splashery-toy>`;
}
