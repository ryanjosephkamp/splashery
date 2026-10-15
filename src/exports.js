// Exports: PNG of the view, GIF (vendored gifenc), MP4/WebM (WebCodecs), a
// live recording (Record, UI r5), JSON downloads, and the embed snippets
// (iframe and custom element).

import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { EXPORT_PRESETS, gifPlan, recordingPlan } from "./export/presets.js";
import { encodeVideo, videoSupport } from "./export/video.js";
import { recordingAudioTap } from "./export/record.js";
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

// ---- GIF ------------------------------------------------------------------

// One uncompressed frame at a time. Only encoded chunks accumulate, under a
// preflight and runtime byte budget. Resetting gifenc releases its output buffer
// after each frame instead of growing a second whole-file typed array.
export async function encodeGIF({
  renderFrame,
  frames = EXPORT_PRESETS.gif.defaults.frames,
  size = EXPORT_PRESETS.gif.defaults.size,
  width = size,
  height = size,
  loopMs = EXPORT_PRESETS.gif.loopSeconds * 1000,
  onProgress,
}) {
  const plan = gifPlan({ width, height, frames });
  if (!plan.ok)
    throw new Error(
      "This GIF needs more memory than this device's export budget. Choose fewer frames or a smaller size.",
    );
  const gif = GIFEncoder({ auto: false });
  const chunks = [];
  let bytes = 0;
  for (let i = 0; i < frames; i++) {
    const canvas = await renderFrame(i, frames);
    const rgba = canvas.getContext("2d").getImageData(0, 0, width, height).data;
    const palette = quantize(rgba, 256, { format: "rgb565" });
    const index = applyPalette(rgba, palette, "rgb565");
    if (i === 0) gif.writeHeader();
    // GIF delays are centiseconds. Distribute rounding so the loop's total
    // duration stays correct even with 72 or 144 frames.
    const delay =
      (Math.round(((i + 1) * loopMs) / frames / 10) - Math.round((i * loopMs) / frames / 10)) * 10;
    gif.writeFrame(index, width, height, { first: i === 0, palette, delay, repeat: 0 });
    if (i === frames - 1) gif.finish();
    const chunk = gif.bytes();
    bytes += chunk.byteLength;
    if (bytes > plan.maxBytes)
      throw new Error(
        "This GIF reached the device's memory budget. Choose fewer frames or a smaller size.",
      );
    chunks.push(chunk);
    gif.reset();
    onProgress?.((i + 1) / frames);
    // Allow the progress display, input cancellation by navigation, and GC.
    await new Promise((r) => setTimeout(r, 0));
  }
  return new Blob(chunks, { type: "image/gif" });
}

// ---- WebM -----------------------------------------------------------------

export function webmSupport() {
  return { ...videoSupport(), mime: "video/webm;codecs=vp9" };
}

// Compatibility for the Data in 3D toy, whose file picker expects WebM.
// The clock is stepped here too; drawFrame still accepts a fraction.
export async function recordWebM({
  canvas,
  seconds = EXPORT_PRESETS.video.defaults.seconds,
  fps = EXPORT_PRESETS.video.defaults.fps,
  drawFrame,
  onProgress,
}) {
  const out = await encodeVideo({
    width: canvas.width,
    height: canvas.height,
    seconds,
    fps,
    webmOnly: true,
    drawFrame: async (t) => (await drawFrame(t / seconds)) || canvas,
    onProgress,
  });
  return out.blob;
}

// ---- Record (UI r5) -------------------------------------------------------------
// A live recording of the stage while someone plays: the canvas as it draws
// (drags, taps, effects, the turning view) and the site's sound, as MP4 where
// the browser records it (Safari, recent Chrome), otherwise WebM.

export const RECORD_LIMIT = EXPORT_PRESETS.record.maxSeconds;

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

export function recordSupport({ audio = false } = {}) {
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
  // A video-only MP4 capability does not establish AAC support. With sound,
  // require the complete codec pair; otherwise use VP9/Opus WebM.
  const hit = RECORD_TYPES.find(
    ([m]) => (!audio || !m.startsWith("video/mp4") || m.includes("mp4a")) && supported(m),
  );
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
  initialFrame = canvas,
  maxSeconds = RECORD_LIMIT,
  onTick,
  fps = EXPORT_PRESETS.record.defaults.fps,
  quality = EXPORT_PRESETS.record.defaults.quality,
  bitrate,
  maxBytes = recordingPlan({ width: canvas.width, height: canvas.height, quality }).maxBytes,
  onWarning,
}) {
  const sup = recordSupport({ audio: !!audio });
  if (!sup.ok) throw new Error(sup.reason);
  // A same-size 2D copy marks each submitted frame dirty. Some browsers
  // emit an audio-only take from an unchanged WebGL canvas, even with
  // requestFrame(). This adds one bounded surface, with no resampling.
  const capture = document.createElement("canvas");
  capture.width = canvas.width;
  capture.height = canvas.height;
  const copy = capture.getContext("2d", { alpha: false, willReadFrequently: true });
  copy.drawImage(initialFrame, 0, 0);
  let cachedFrame = copy.getImageData(0, 0, capture.width, capture.height);
  const video = capture.captureStream(fps);
  const track = video.getVideoTracks()[0];
  const tracks = [track];
  let tap = null;
  try {
    if (audio?.ctx && audio?.node && audio.ctx.createMediaStreamDestination) {
      tap = audio.tap || recordingAudioTap(audio);
      tracks.push(...tap.tracks);
    }
  } catch (error) {
    track.stop();
    throw error;
  }
  const stream = new MediaStream(tracks);
  // Live Record uses its duration-aware policy, independently of stepped video.
  const opts = {
    mimeType: sup.mime,
    videoBitsPerSecond:
      bitrate ?? recordingPlan({ width: canvas.width, height: canvas.height, quality }).bitrate,
    audioBitsPerSecond: EXPORT_PRESETS.record.audioBitrate,
  };
  const cleanup = () => {
    for (const t of stream.getTracks()) t.stop();
    tap?.dispose();
    tap = null;
  };
  let rec;
  try {
    rec = new MediaRecorder(stream, opts);
  } catch (err) {
    cleanup();
    throw err;
  }
  const type = (rec.mimeType || sup.mime).split(";")[0];
  const ext = /mp4/.test(type) ? "mp4" : "webm";
  const chunks = [];
  let bytes = 0;
  let warned = false;
  let reason = "stop";
  let largestChunk = 0;
  let overflow = false;
  let pendingStop = null;
  let stopWait = 0;
  rec.ondataavailable = (e) => {
    if (!e.data?.size || overflow) return;
    if (e.data.size > maxBytes - bytes) {
      // Never keep a truncated container or retain an oversized final flush.
      // The browser allocates incoming chunks; our retained output is bounded.
      overflow = true;
      chunks.length = 0;
      pendingStop = "size";
      finishStop();
      return;
    }
    chunks.push(e.data);
    bytes += e.data.size;
    largestChunk = Math.max(largestChunk, e.data.size);
    if (pendingStop && bytes > 1024) {
      finishStop();
      return;
    }
    if (!warned && bytes >= maxBytes * EXPORT_PRESETS.record.warningFraction) {
      warned = true;
      onWarning?.(
        "Recording has used 80% of its size budget. It will stop soon so you can save the take.",
      );
    }
    // Reserve at least two chunks and two seconds at the target bitrate for
    // the final flush. maxBytes is the encoded budget, not total device RAM.
    const reserve = Math.max(largestChunk * 2, (opts.videoBitsPerSecond / 8) * 2);
    if (bytes >= Math.max(maxBytes * EXPORT_PRESETS.record.warningFraction, maxBytes - reserve))
      stop("size");
  };
  const t0 = performance.now();
  const seconds = () => (performance.now() - t0) / 1000;
  let timer = 0;
  let length = 0;
  const done = new Promise((resolve, reject) => {
    rec.onstop = () => {
      clearInterval(timer);
      clearTimeout(stopWait);
      cleanup();
      if (overflow) {
        reject(
          new Error(
            "The browser returned a recording chunk larger than this device's size budget. The take was released. Choose Standard or a shorter recording.",
          ),
        );
        return;
      }
      // A busy device can hand over the last piece a moment after the stop:
      // wait a little for it before calling the take empty.
      const finish = (tries) => {
        if (bytes > 1024) {
          const blob = new Blob(chunks, { type });
          chunks.length = 0;
          resolve({ blob, type, size: blob.size, ext, seconds: length, reason });
        } else if (tries > 0) setTimeout(() => finish(tries - 1), 250);
        else
          reject(new Error("The recording came out empty. Try a longer take or Standard quality."));
      };
      finish(8);
    };
    rec.onerror = (e) => {
      clearInterval(timer);
      clearTimeout(stopWait);
      cleanup();
      chunks.length = 0;
      reject(e.error || new Error("The recording stopped."));
    };
  });
  let lastFrame = -Infinity;
  const frame = (copySource = true) => {
    const now = performance.now();
    if (rec.state !== "recording" || now - lastFrame < 1000 / fps - 2) return;
    lastFrame = now;
    if (copySource && !pendingStop) {
      copy.drawImage(canvas, 0, 0);
      cachedFrame = copy.getImageData(0, 0, capture.width, capture.height);
    }
    // Submit the whole cached picture. A one-pixel dirty region does not
    // reliably produce video frames in Chromium when the source is idle.
    copy.putImageData(cachedFrame, 0, 0);
    track.requestFrame?.();
  };
  const finishStop = () => {
    if (rec.state === "inactive") return;
    clearTimeout(stopWait);
    reason = pendingStop || reason;
    length = Math.min(maxSeconds, seconds());
    try {
      rec.requestData();
    } catch {
      // Not recording any more.
    }
    rec.stop();
  };
  const stop = (why = "stop") => {
    if (rec.state === "inactive" || pendingStop) return;
    pendingStop = why;
    // A software encoder can still be starting when a short take ends.
    // WebM may have emitted only its one-byte header. Keep submitting the
    // cached last picture until actual output arrives, with a bounded wait.
    // Size overflow must release memory immediately instead of waiting.
    if (!overflow && bytes <= 1024) stopWait = setTimeout(finishStop, 10_000);
    else finishStop();
  };
  // Chunks are kept in RAM, never uploaded or persisted without Save.
  try {
    rec.start(EXPORT_PRESETS.record.sliceMs);
  } catch (err) {
    cleanup();
    throw err;
  }
  frame(false); // Keep the rendered initial snapshot, not a cleared WebGL buffer.
  timer = setInterval(() => {
    const s = seconds();
    if (!pendingStop) onTick?.(Math.min(s, maxSeconds));
    if (s >= maxSeconds) stop("time");
    frame(false); // Repeat the last drawn picture, never read a cleared WebGL buffer.
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

// The app's root, from where this file is (src/), not from the page that runs it: the page may sit
// in a folder of its own (the Playground at playground/), and a share link, an embed or the
// element's script must still name the project's root (the home page sends "#s=" links on).
export function appBaseURL() {
  return new URL("../", import.meta.url).href;
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
