// Build-time image and mask handling. No downloaded segmenter or weights.
import fs from "node:fs";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";

export function decodeImage(bytes) {
  if (bytes[0] === 137 && bytes[1] === 80) {
    const p = PNG.sync.read(Buffer.from(bytes));
    return { width: p.width, height: p.height, data: p.data };
  }
  const p = jpeg.decode(Buffer.from(bytes), { useTArray: true, maxMemoryUsageInMB: 256 });
  return { width: p.width, height: p.height, data: p.data };
}
export const readImage = (file) => decodeImage(fs.readFileSync(file));
export const pngBytes = (p) => PNG.sync.write(p);
export function resize(p, width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const j =
        (Math.min(p.height - 1, Math.floor(((y + 0.5) * p.height) / height)) * p.width +
          Math.min(p.width - 1, Math.floor(((x + 0.5) * p.width) / width))) *
        4;
      data.set(p.data.subarray(j, j + 4), i);
    }
  return { width, height, data };
}
export function maskImage(mask, width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < mask.length; i++) {
    data.fill(mask[i] ? 255 : 0, i * 4, i * 4 + 3);
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}
export function readMask(p) {
  const transparent = p.data.some((v, i) => i % 4 === 3 && v < 128);
  return Uint8Array.from({ length: p.width * p.height }, (_, i) =>
    transparent ? +(p.data[i * 4 + 3] >= 128) : +(p.data[i * 4] >= 128),
  );
}
const median = (a) => a.sort((a, b) => a - b)[Math.floor(a.length / 2)];

// A border-color flood fill preserves enclosed holes when their background color
// agrees with the border. Alpha takes precedence. Busy backgrounds need review.
export function segment(p) {
  const { width: w, height: h, data } = p;
  if (data.some((v, i) => i % 4 === 3 && v < 128))
    return { mask: readMask(p), method: "alpha", review: false };
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
  const bg = [0, 1, 2].map((k) => median(border.map((i) => data[i * 4 + k])));
  const distance = (i) => Math.hypot(...bg.map((v, k) => data[i * 4 + k] - v));
  const spread = median(border.map(distance));
  const threshold = Math.min(65, Math.max(18, spread * 2.5));
  const background = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0,
    tail = 0;
  const add = (i) => {
    if (!background[i] && distance(i) <= threshold) {
      background[i] = 1;
      queue[tail++] = i;
    }
  };
  for (const i of border) add(i);
  while (head < tail) {
    const i = queue[head++],
      x = i % w;
    if (x) add(i - 1);
    if (x < w - 1) add(i + 1);
    if (i >= w) add(i - w);
    if (i < w * (h - 1)) add(i + w);
  }
  // Also remove disconnected, enclosed background (a chair's leg gaps).
  const mask = Uint8Array.from(background, (b, i) => +(b === 0 && distance(i) > threshold));
  // Reject isolated, low-contrast color noise unless a strong local edge
  // supports it. Keep strong edges and enclosed background holes intact.
  const cleaned = mask.slice();
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const neighbors = [i - 1, i + 1, i - w, i + w];
      if (neighbors.reduce((n, j) => n + mask[j], 0) > 1) continue;
      const edge = Math.max(
        ...neighbors.map((j) =>
          Math.hypot(...[0, 1, 2].map((k) => data[i * 4 + k] - data[j * 4 + k])),
        ),
      );
      if (edge < 45) cleaned[i] = 0;
    }
  const coverage = cleaned.reduce((s, v) => s + v, 0) / mask.length;
  return {
    mask: cleaned,
    method: "border-color-and-edges",
    background: bg,
    threshold,
    review: spread > 18 || coverage < 0.01 || coverage > 0.9,
  };
}
export function maskBounds(mask, w, h) {
  let x0 = w,
    x1 = -1,
    y0 = h,
    y1 = -1,
    n = 0,
    sx = 0,
    sy = 0;
  for (let i = 0; i < mask.length; i++)
    if (mask[i]) {
      const x = i % w,
        y = Math.floor(i / w);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      sx += x;
      sy += y;
      n++;
    }
  if (!n) throw new Error("The foreground mask is empty.");
  return { x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1, cx: sx / n, cy: sy / n, n };
}
