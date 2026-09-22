// Exports: PNG snapshot encoding, JSON download, GIF (gifenc), WebM
// (MediaRecorder), and the iframe embed snippet with its size tiers.

import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { encodeSceneHash } from "./codec.js";
import { formatBytes } from "./state.js";

// ---- PNG ------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes, start = 0, end = bytes.length) {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

async function zlibDeflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Encodes RGBA8 pixels (bottom row first, as read from WebGL) into a PNG.
export async function encodePNG(rgba, width, height) {
  if (typeof CompressionStream === "undefined") return encodePNGViaCanvas(rgba, width, height);
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y;
    raw[y * (stride + 1)] = 0;
    raw.set(rgba.subarray(srcRow * stride, srcRow * stride + stride), y * (stride + 1) + 1);
  }
  const idat = await zlibDeflate(raw);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function encodePNGViaCanvas(rgba, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(width, height);
  const stride = width * 4;
  for (let y = 0; y < height; y++) {
    img.data.set(rgba.subarray((height - 1 - y) * stride, (height - y) * stride), y * stride);
  }
  ctx.putImageData(img, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

export function bytesToDataURI(bytes, mime = "image/png") {
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

export { decodePNGDataURI } from "./codec.js";

// ---- Downloads ------------------------------------------------------------

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

export function timestampName(ext) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `splashery-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
    d.getMinutes(),
  )}${p(d.getSeconds())}.${ext}`;
}

// ---- GIF ------------------------------------------------------------------

// renderFrame(i, n) must return RGBA8 pixels (top row first) of size x size.
export async function exportGIF({
  renderFrame,
  frames = 48,
  size = 512,
  loopMs = 4000,
  onProgress,
}) {
  const gif = GIFEncoder();
  const delay = Math.max(20, Math.round(loopMs / frames));
  for (let i = 0; i < frames; i++) {
    const rgba = await renderFrame(i, frames);
    const palette = quantize(rgba, 256, { format: "rgb565" });
    const index = applyPalette(rgba, palette, "rgb565");
    gif.writeFrame(index, size, size, { palette, delay, repeat: 0 });
    onProgress?.((i + 1) / frames);
    await nextFrame();
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}

// ---- WebM -----------------------------------------------------------------

export function webmSupport() {
  if (typeof MediaRecorder === "undefined")
    return { ok: false, reason: "MediaRecorder is not available in this browser." };
  if (typeof HTMLCanvasElement === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    return { ok: false, reason: "canvas.captureStream is not available in this browser." };
  }
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime)
    return { ok: false, reason: "This browser's MediaRecorder cannot produce WebM video." };
  return { ok: true, mime };
}

// Records durationMs of frames from the canvas. renderFrame(t01) draws one
// frame for the rotation progress t01 in [0, 1). Real time, so the recorder
// gets correctly spaced timestamps.
export async function exportWebM({
  canvas,
  durationMs = 3000,
  fps = 30,
  renderFrame,
  onProgress,
  mime,
}) {
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise((resolve) => (rec.onstop = resolve));
  rec.start();
  const start = performance.now();
  const frameMs = 1000 / fps;
  let last = -Infinity;
  await new Promise((resolve) => {
    const tick = () => {
      const now = performance.now();
      const elapsed = now - start;
      if (elapsed >= durationMs) {
        renderFrame(0.999);
        track.requestFrame?.();
        resolve();
        return;
      }
      if (now - last >= frameMs - 1) {
        last = now;
        renderFrame(elapsed / durationMs);
        track.requestFrame?.();
        onProgress?.(elapsed / durationMs);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await new Promise((r) => setTimeout(r, 120));
  rec.stop();
  await stopped;
  track.stop();
  onProgress?.(1);
  return new Blob(chunks, { type: mime.split(";")[0] });
}

// ---- Embed ----------------------------------------------------------------

export const EMBED_HASH_LIMIT = 8 * 1024;

export function embedBaseURL() {
  return new URL("embed/", document.baseURI).href;
}

export function embedSnippet(hash, { width = 480, height = 360 } = {}) {
  const src = `${embedBaseURL()}#s=${hash}`;
  return `<iframe src="${src}" width="${width}" height="${height}" title="Splashery scene" loading="lazy" style="border:0;border-radius:12px;max-width:100%"></iframe>`;
}

// Picks the largest scene payload that fits in the hash budget.
// getSmallSnapshot(size) returns a PNG data URI of the dry layer at that size.
export async function buildEmbedHash(scene, getSmallSnapshot) {
  const settings = {
    version: scene.version,
    template: scene.template,
    camera: scene.camera,
    lighting: scene.lighting,
    physics: scene.physics,
    brushDefaults: scene.brushDefaults,
  };
  const hasStrokes = scene.strokes && scene.strokes.length > 0;
  const tiers = [];
  if (hasStrokes) {
    tiers.push({
      name: "strokes",
      build: async () => ({ ...settings, strokes: scene.strokes }),
      note: "The embed carries the full stroke log and replays it.",
    });
  }
  for (const size of [512, 384, 256]) {
    tiers.push({
      name: `snapshot-${size}`,
      build: async () => ({ ...settings, snapshotPNG: await getSmallSnapshot(size) }),
      note: hasStrokes
        ? `The stroke log is too long for a URL, so the embed carries a ${size} px snapshot of the dry paint instead.`
        : `The embed carries a ${size} px snapshot of the dry paint.`,
    });
  }
  let last = null;
  for (const tier of tiers) {
    const payload = await tier.build();
    const hash = await encodeSceneHash(payload);
    last = { tier: tier.name, bytes: hash.length };
    if (hash.length <= EMBED_HASH_LIMIT) {
      return { ok: true, hash, tier: tier.name, bytes: hash.length, note: tier.note };
    }
  }
  return {
    ok: false,
    hash: null,
    tier: null,
    bytes: last ? last.bytes : 0,
    note: `Even a 256 px snapshot is ${formatBytes(last ? last.bytes : 0)} as a URL, over the ${formatBytes(
      EMBED_HASH_LIMIT,
    )} limit. Share the JSON file instead.`,
  };
}

export function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
