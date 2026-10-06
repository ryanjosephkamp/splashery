import { GIFEncoder, quantize, applyPalette } from "../../../vendor/gifenc/gifenc.esm.js";
import { renderTextCanvas } from "./ascii.js";

export function validateFrames(frames, fps) {
  const first = frames?.[0];
  if (
    !Array.isArray(frames) ||
    frames.length < 1 ||
    frames.length > 64 ||
    ![8, 10, 12].includes(fps) ||
    !first ||
    frames.some((frame) => frame.columns !== first.columns || frame.rowCount !== first.rowCount)
  )
    throw new RangeError("Expected 1–64 matching ASCII frames at 8, 10, or 12 fps");
}

export function gifDelays(count, fps) {
  if (!Number.isInteger(count) || count < 1 || count > 64 || ![8, 10, 12].includes(fps))
    throw new RangeError("Invalid GIF timeline");
  return Array.from(
    { length: count },
    (_, i) => (Math.round(((i + 1) * 100) / fps) - Math.round((i * 100) / fps)) * 10,
  );
}

const check = (signal) => {
  if (signal?.aborted) throw new DOMException("Export canceled", "AbortError");
};
const yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0));

function withComment(gifBytes, metadata) {
  const bytes = new TextEncoder().encode(JSON.stringify(metadata));
  if (bytes.length > 16_384) throw new RangeError("Attribution metadata is too large");
  const blocks = [0x21, 0xfe];
  for (let i = 0; i < bytes.length; i += 255) {
    const part = bytes.subarray(i, i + 255);
    blocks.push(part.length, ...part);
  }
  blocks.push(0);
  // Put attribution before image blocks so first-frame readers also expose it.
  const offset = 13 + (gifBytes[10] & 0x80 ? 3 * 2 ** ((gifBytes[10] & 7) + 1) : 0);
  const result = new Uint8Array(gifBytes.length + blocks.length);
  result.set(gifBytes.subarray(0, offset));
  result.set(blocks, offset);
  result.set(gifBytes.subarray(offset), offset + blocks.length);
  return result;
}

export async function encodeGif(
  frames,
  { fps = 10, color = false, footer = [], metadata = {}, signal, onProgress = () => {} } = {},
) {
  validateFrames(frames, fps);
  const gif = GIFEncoder();
  const canvas = document.createElement("canvas");
  const delays = gifDelays(frames.length, fps);
  let width, height;
  for (let i = 0; i < frames.length; i++) {
    check(signal);
    renderTextCanvas(canvas, frames[i], { color, footer });
    if (canvas.width * canvas.height > 1_500_000)
      throw new RangeError("GIF canvas exceeds prototype bounds");
    width = canvas.width;
    height = canvas.height;
    const rgba = canvas.getContext("2d").getImageData(0, 0, width, height).data;
    const palette = quantize(rgba, 256, { format: "rgb565" });
    gif.writeFrame(applyPalette(rgba, palette, "rgb565"), width, height, {
      palette,
      delay: delays[i],
      repeat: 0,
    });
    onProgress((i + 1) / frames.length);
    await yieldTask();
  }
  check(signal);
  gif.finish();
  return {
    blob: new Blob([withComment(gif.bytes(), metadata)], { type: "image/gif" }),
    width,
    height,
    delays,
    durationMs: delays.reduce((a, b) => a + b, 0),
  };
}

export function videoSupport() {
  if (!globalThis.MediaRecorder || !HTMLCanvasElement.prototype.captureStream)
    return {
      ok: false,
      reason: "This browser cannot record a canvas. GIF is available.",
    };
  const candidates = [
    ["video/mp4;codecs=avc1.42E01E", "mp4"],
    ["video/mp4;codecs=avc1", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm;codecs=vp8", "webm"],
    ["video/webm", "webm"],
  ];
  const hit = candidates.find(([mime]) => {
    try {
      return MediaRecorder.isTypeSupported(mime);
    } catch {
      return false;
    }
  });
  return hit
    ? { ok: true, mime: hit[0], ext: hit[1] }
    : {
        ok: false,
        reason: "No supported video encoder was found. GIF is available.",
      };
}

// The video route uses real-time timestamps. GIF remains the exact-frame route.
export async function encodeVideo(
  frames,
  { fps = 10, color = false, footer = [], signal, onProgress = () => {} } = {},
) {
  validateFrames(frames, fps);
  check(signal);
  const support = videoSupport();
  if (!support.ok) throw new Error(support.reason);
  if (document.hidden) throw new Error("Keep this page visible while recording video");
  const scratch = document.createElement("canvas");
  renderTextCanvas(scratch, frames[0], { color, footer });
  if (scratch.width * scratch.height > 1_500_000)
    throw new RangeError("Video canvas exceeds prototype bounds");
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(scratch.width / 2) * 2;
  canvas.height = Math.ceil(scratch.height / 2) * 2;
  const ctx = canvas.getContext("2d");
  const paint = (frame) => {
    renderTextCanvas(scratch, frame, { color, footer });
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(scratch, 0, 0);
  };
  paint(frames[0]);
  let stream = canvas.captureStream(0);
  let track = stream.getVideoTracks()[0];
  if (typeof track.requestFrame !== "function") {
    stream.getTracks().forEach((item) => item.stop());
    stream = canvas.captureStream(fps);
    track = stream.getVideoTracks()[0];
  }
  let recorder;
  let timeout;
  const chunks = [];
  let recorderError;
  let resolveStop;
  const stopped = new Promise((resolve) => {
    resolveStop = resolve;
  });
  const hidden = () => {
    if (document.hidden) recorderError = new Error("Video canceled because the page became hidden");
  };
  document.addEventListener("visibilitychange", hidden);
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: support.mime,
      videoBitsPerSecond: 5_000_000,
    });
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = (event) => {
      recorderError = event.error || new Error("Video encoder failed");
      resolveStop();
    };
    recorder.onstop = resolveStop;
    await new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("Video encoder did not start")), 5000);
      recorder.onstart = () => {
        clearTimeout(timeout);
        resolve();
      };
      recorder.start(500);
    });
    const start = performance.now();
    const interval = 1000 / fps;
    for (let i = 0; i < frames.length; i++) {
      check(signal);
      if (recorderError) throw recorderError;
      const due = start + i * interval;
      const remaining = due - performance.now();
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      check(signal);
      if (recorderError) throw recorderError;
      if (performance.now() - due > interval * 0.9)
        throw new Error("This device could not keep video pace. Try fewer columns or use GIF.");
      paint(frames[i]);
      track.requestFrame?.();
      onProgress((i + 1) / frames.length);
    }
    const remaining = start + frames.length * interval - performance.now();
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    check(signal);
    if (recorderError) throw recorderError;
    recorder.stop();
    await Promise.race([
      stopped,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Video encoder did not finish")), 5000);
      }),
    ]);
    if (recorderError) throw recorderError;
    if (!chunks.length) throw new Error("The video came out empty");
    const type = recorder.mimeType.split(";")[0];
    return {
      blob: new Blob(chunks, { type }),
      mime: recorder.mimeType,
      ext: type.includes("mp4") ? "mp4" : "webm",
      width: canvas.width,
      height: canvas.height,
      requestedSeconds: frames.length / fps,
      framesSubmitted: frames.length,
      wallMs: performance.now() - start,
    };
  } finally {
    clearTimeout(timeout);
    document.removeEventListener("visibilitychange", hidden);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stream.getTracks().forEach((item) => item.stop());
    globalThis.__asciiVideoCleanup = {
      stoppedTracks: stream.getTracks().every((item) => item.readyState === "ended"),
      recorderInactive: !recorder || recorder.state === "inactive",
    };
  }
}
