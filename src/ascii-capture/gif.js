// Lane AsciiCapture: an animated GIF of converted ASCII frames, over the
// vendored gifenc (imported as src/exports.js imports it). gifDelays,
// validateFrames and withComment are ported from the Codex prototype's
// docs/audits/ascii-capture-encoding-prototype/encoders.js (draft PR #352):
// exact centisecond delays, and the credit as a GIF comment block.

import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { renderTextCanvas } from "../export/ascii.js";
import { brighten } from "./levels.js";

export const MAX_PIXELS = 1_500_000;

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
    throw new RangeError("Expected 1 to 64 matching ASCII frames at 8, 10 or 12 fps");
}

// Delays in milliseconds that add up to whole centiseconds on the exact timeline.
export function gifDelays(count, fps) {
  if (!Number.isInteger(count) || count < 1 || count > 64 || ![8, 10, 12].includes(fps))
    throw new RangeError("Invalid GIF timeline");
  return Array.from(
    { length: count },
    (_, i) => (Math.round(((i + 1) * 100) / fps) - Math.round((i * 100) / fps)) * 10,
  );
}

// Puts a comment extension with `metadata` (JSON) before the first image block.
export function withComment(gifBytes, metadata) {
  const bytes = new TextEncoder().encode(JSON.stringify(metadata));
  if (bytes.length > 16_384) throw new RangeError("Attribution metadata is too large");
  const blocks = [0x21, 0xfe];
  for (let i = 0; i < bytes.length; i += 255) {
    const part = bytes.subarray(i, i + 255);
    blocks.push(part.length, ...part);
  }
  blocks.push(0);
  const offset = 13 + (gifBytes[10] & 0x80 ? 3 * 2 ** ((gifBytes[10] & 7) + 1) : 0);
  const result = new Uint8Array(gifBytes.length + blocks.length);
  result.set(gifBytes.subarray(0, offset));
  result.set(blocks, offset);
  result.set(gifBytes.subarray(offset), offset + blocks.length);
  return result;
}

const yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function encodeAsciiGif(
  frames,
  { fps, color = false, gain = 1, footer = [], metadata = {}, signal, onProgress = () => {} } = {},
) {
  validateFrames(frames, fps);
  const gif = GIFEncoder();
  const canvas = document.createElement("canvas");
  const delays = gifDelays(frames.length, fps);
  let width = 0;
  let height = 0;
  try {
    for (let i = 0; i < frames.length; i++) {
      signal?.throwIfAborted();
      renderTextCanvas(canvas, color ? brighten(frames[i], gain) : frames[i], { color, footer });
      if (canvas.width * canvas.height > MAX_PIXELS)
        throw new RangeError("The GIF would be too large");
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
    signal?.throwIfAborted();
    gif.finish();
    return {
      blob: new Blob([withComment(gif.bytes(), metadata)], { type: "image/gif" }),
      width,
      height,
      delays,
    };
  } finally {
    canvas.width = canvas.height = 0;
  }
}
