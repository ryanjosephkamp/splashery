import { EXPORT_PRESETS as P, memoryBudget, videoBitrate } from "./presets.js";

export function videoSupport() {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined"
    ? { ok: true }
    : {
        ok: false,
        reason:
          "this browser cannot encode every video frame. Try a current browser, or use Record.",
      };
}

async function supportedConfig(width, height, fps, bitrate, webmOnly) {
  if (!videoSupport().ok) throw new Error(videoSupport().reason);
  const codecs = webmOnly ? ["vp09.00.41.08"] : ["avc1.640033", "avc1.420033", "vp09.00.41.08"];
  for (const codec of codecs) {
    const config = {
      codec,
      width,
      height,
      framerate: fps,
      bitrate,
      latencyMode: "quality",
      ...(codec.startsWith("avc") && { avc: { format: "avc" } }),
    };
    try {
      if ((await VideoEncoder.isConfigSupported(config)).supported) return config;
    } catch {
      /* Try the next codec. */
    }
  }
  throw new Error(
    "This browser cannot encode this video size and frame rate. Choose a smaller size or use Record.",
  );
}

// webm-muxer 5.1.4 writes the last frame's start as Segment Duration.
// Include its display interval without adding a frame or shifting timestamps.
// Parse only our finalized, non-streaming EBML container, never encoded bytes.
function finishWebMDuration(buffer, seconds) {
  const bytes = new Uint8Array(buffer);
  const integer = (at, id = false) => {
    let mask = 128,
      size = 1;
    while (size <= 8 && !(bytes[at] & mask)) {
      mask >>= 1;
      size++;
    }
    if (size > 8 || at + size > bytes.length)
      throw new Error("Could not finish the WebM duration.");
    let value = id ? bytes[at] : bytes[at] & (mask - 1);
    for (let i = 1; i < size; i++) value = value * 256 + bytes[at + i];
    return { value, next: at + size };
  };
  const find = (start, end, wanted) => {
    for (let at = start; at < end; ) {
      const id = integer(at, true),
        size = integer(id.next);
      const next = size.next + size.value;
      if (next > end || next <= at) break;
      if (id.value === wanted) return { start: size.next, end: next };
      at = next;
    }
    throw new Error("Could not finish the WebM duration.");
  };
  const segment = find(0, bytes.length, 0x18538067);
  const info = find(segment.start, segment.end, 0x1549a966);
  const duration = find(info.start, info.end, 0x4489);
  if (duration.end - duration.start !== 8) throw new Error("Could not finish the WebM duration.");
  // This pinned muxer uses a 1,000,000 ns timecode scale: milliseconds.
  new DataView(buffer).setFloat64(duration.start, seconds * 1000);
}

// Draw and encode every timestamp, irrespective of wall-clock rendering speed.
// Only a few uncompressed frames can be in flight. The bounded muxed file stays
// in memory until it is saved; muxers load only on an actual export.
export async function encodeVideo({
  width,
  height,
  seconds = P.video.defaults.seconds,
  fps = P.video.defaults.fps,
  bitrate = videoBitrate(width, height, fps),
  drawFrame,
  onProgress,
  webmOnly = false,
}) {
  const maxBytes = Math.floor(
    (memoryBudget() - width * height * P.memory.workingBytesPerPixel) / 3,
  );
  if (!(maxBytes > 0) || (seconds * bitrate) / 8 > maxBytes)
    throw new Error(
      "This video needs more memory than this device's export budget. Choose a shorter clip or a smaller size.",
    );
  const config = await supportedConfig(width, height, fps, bitrate, webmOnly);
  const mp4 = config.codec.startsWith("avc");
  const { Muxer, ArrayBufferTarget } = await (mp4
    ? import("../../vendor/mp4-muxer/mp4-muxer.mjs")
    : import("../../vendor/webm-muxer/webm-muxer.mjs"));
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: mp4 ? "avc" : "V_VP9", width, height, frameRate: fps },
    firstTimestampBehavior: "strict",
    ...(mp4 && { fastStart: "in-memory" }),
  });
  let error = null;
  let bytes = 0;
  let encoded = 0;
  const encoder = new VideoEncoder({
    output(chunk, meta) {
      if (error) return;
      bytes += chunk.byteLength;
      if (bytes > maxBytes) {
        error = new Error(
          "The video reached this device's memory budget. Choose a shorter clip or a smaller size.",
        );
        return;
      }
      try {
        muxer.addVideoChunk(chunk, meta);
        encoded++;
      } catch (e) {
        error = e;
      }
    },
    error(e) {
      error = e;
    },
  });
  const frames = Math.round(seconds * fps);
  try {
    encoder.configure(config);
    for (let i = 0; i < frames; i++) {
      if (error) throw error;
      const canvas = await drawFrame(i / fps, i, frames);
      const timestamp = Math.round((i * 1_000_000) / fps);
      // Take an explicit pixel snapshot before the encoder queue consumes
      // it. No later canvas resize or render can change this frame.
      const pixels = canvas.getContext("2d").getImageData(0, 0, width, height);
      const frame = new VideoFrame(pixels.data, {
        format: "RGBA",
        codedWidth: width,
        codedHeight: height,
        timestamp,
        duration: Math.round(((i + 1) * 1_000_000) / fps) - timestamp,
      });
      try {
        encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      } finally {
        frame.close();
      }
      if ((i + 1) % P.video.queueFrames === 0) await encoder.flush();
      onProgress?.((i + 1) / frames);
    }
    await encoder.flush();
    if (error) throw error;
    if (encoded !== frames)
      throw new Error("The video encoder did not return every frame. Try a smaller size.");
    muxer.finalize();
    if (!mp4) finishWebMDuration(target.buffer, seconds);
    const type = mp4 ? "video/mp4" : "video/webm";
    return {
      blob: new Blob([target.buffer], { type }),
      ext: mp4 ? "mp4" : "webm",
      frames,
      seconds,
      fps,
      bitrate,
    };
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
}
