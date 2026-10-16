// Locked byte reference for scan-prediction compatibility; do not optimize.
// Original frame.js Git blob: baf6dbf57c3b04df347cd2fcec7dbacbf21bbfb5
// The encoded crop and the complete sticker share the picture's coordinates.
import { shapeHalf } from "../../../src/qr/circle.js";
import { rasterize } from "../../../src/qr-craft/picture.js";
import { soften } from "../../../src/qr-craft/fidelity.js";
const tileCache = new WeakMap();
export function tileColors(w) {
  if (!tileCache.has(w)) {
    const colors =
      w.rendering?.textureBlur > 0 ? soften(w.cells, w.G, w.rendering.textureBlur * w.k) : w.cells;
    tileCache.set(
      w,
      Uint8ClampedArray.from(colors, (value) => value * 255),
    );
  }
  return tileCache.get(w);
}
export function cropCirclePicture(pic, size) {
  const fraction = size / (2 * shapeHalf(size, "circle")),
    side = Math.min(pic.w, pic.h),
    n = Math.max(1, Math.floor(side * fraction));
  const x0 = Math.floor((pic.w - n) / 2),
    y0 = Math.floor((pic.h - n) / 2),
    data = new Float32Array(n * n * 3);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const p = ((y + y0) * pic.w + x + x0) * 3;
      data.set(pic.data.subarray(p, p + 3), (y * n + x) * 3);
    }
  return { w: n, h: n, data };
}
export function detailFrame(w, pic, ppm, shape = "square") {
  if (shape !== "circle") return rasterize(w, ppm);
  const N = w.code.size,
    H = shapeHalf(N, "circle"),
    total = 2 * (H + 1),
    img = rasterize(w, ppm, { quiet: (total - N) / 2 });
  if (!pic) return img;
  const side = Math.min(pic.w, pic.h);
  for (let py = 0; py < img.height; py++)
    for (let px = 0; px < img.width; px++) {
      const x = ((px + 0.5) / img.width - 0.5) * total,
        y = (0.5 - (py + 0.5) / img.height) * total;
      if (Math.max(Math.abs(x), Math.abs(y)) < N / 2 + 4 || Math.hypot(x, y) >= H - 0.65) continue;
      const sx = Math.max(
        0,
        Math.min(pic.w - 1, Math.floor((pic.w - side) / 2 + (0.5 + x / (2 * H)) * side)),
      );
      const sy = Math.max(
        0,
        Math.min(pic.h - 1, Math.floor((pic.h - side) / 2 + (0.5 - y / (2 * H)) * side)),
      );
      const p = (sy * pic.w + sx) * 3,
        q = (py * img.width + px) * 4;
      for (let ch = 0; ch < 3; ch++) img.data[q + ch] = 255 * pic.data[p + ch];
    }
  return img;
}

// The flat tile texture at the same 720px footprint as the stage capture.
// Texture filtering is bilinear at this scale; each tile's packed UV adds
// the same tiny offset as the photo renderer's 16-bit coordinates.
export function textureFrame(w, pic, shape = "square", width = 720) {
  const n = w.code.size,
    half = shapeHalf(n, shape),
    total = 2 * (half + 1),
    // The kit's declared z extent is [-0.8, 1], so its fitted center is
    // 0.1 in front of the tile plane. Match that slight perspective shrink.
    extent = total + 0.2 * Math.tan((19 * Math.PI) / 180),
    data = new Uint8ClampedArray(width * width * 4).fill(255),
    colors = tileColors(w),
    offsets = Float64Array.from({ length: n }, (_, m) => {
      const center = (m + 0.5) / n;
      return (Math.floor(center * 65533 + 1.5) - 1) / 65533 - center;
    });
  const side = pic ? Math.min(pic.w, pic.h) : 0;
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) {
      const px = ((x + 0.5) / width - 0.5) * extent,
        py = ((y + 0.5) / width - 0.5) * extent,
        q = (y * width + x) * 4;
      if (Math.abs(px) < n / 2 && Math.abs(py) < n / 2) {
        const col = Math.floor(px + n / 2),
          row = Math.floor(py + n / 2),
          tx = Math.min(w.G - 1, Math.max(0, (px / n + 0.5 + offsets[col]) * w.G - 0.5)),
          ty = Math.min(w.G - 1, Math.max(0, (py / n + 0.5 + offsets[row]) * w.G - 0.5)),
          x0 = Math.floor(tx),
          y0 = Math.floor(ty),
          fx = tx - x0,
          fy = ty - y0;
        for (let ch = 0; ch < 3; ch++) {
          let value = 0;
          for (let v = 0; v < 2; v++)
            for (let u = 0; u < 2; u++) {
              const at = (Math.min(w.G - 1, y0 + v) * w.G + Math.min(w.G - 1, x0 + u)) * 3 + ch;
              // The canvas upload stores eight-bit colors before filtering.
              const byte = colors[at];
              value += byte * (u ? fx : 1 - fx) * (v ? fy : 1 - fy);
            }
          data[q + ch] = value;
        }
      } else if (
        shape === "circle" &&
        pic &&
        Math.max(Math.abs(px), Math.abs(py)) >= n / 2 + 4 &&
        Math.hypot(px, py) < half - 0.65
      ) {
        const sx = Math.max(
            0,
            Math.min(pic.w - 1, Math.floor((pic.w - side) / 2 + (0.5 + px / (2 * half)) * side)),
          ),
          sy = Math.max(
            0,
            Math.min(pic.h - 1, Math.floor((pic.h - side) / 2 + (0.5 + py / (2 * half)) * side)),
          ),
          at = (sy * pic.w + sx) * 3;
        for (let ch = 0; ch < 3; ch++) data[q + ch] = 255 * pic.data[at + ch];
      }
    }
  return { width, height: width, data };
}
