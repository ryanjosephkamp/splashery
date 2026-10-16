import { shapeHalf, circleLayout } from "../../src/qr/circle.js";
import { rasterize, gray, FG, BG, gaussBlur } from "../../src/qr-craft/picture.js";
import { capture, lightGradient } from "../qr-scan-lab/sim.mjs";
export function circleCrop(pic, size) {
  const fraction = size / (2 * shapeHalf(size, "circle")),
    side = Math.min(pic.w, pic.h),
    n = Math.max(1, Math.floor(side * fraction));
  const x0 = Math.floor((pic.w - n) / 2),
    y0 = Math.floor((pic.h - n) / 2),
    data = new Float32Array(n * n * 3);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = ((y + y0) * pic.w + x + x0) * 3;
      data.set(pic.data.subarray(i, i + 3), (y * n + x) * 3);
    }
  return { w: n, h: n, data };
}
const layouts = new WeakMap();
export function rasterSticker(w, pic, shape, ppm = 8) {
  if (shape !== "circle") return rasterize(w, ppm);
  const N = w.code.size,
    H = shapeHalf(N, "circle"),
    total = 2 * (H + 1),
    width = Math.round(total * ppm);
  let layout = layouts.get(w.code);
  if (!layout) {
    layout = circleLayout(w.code);
    layouts.set(w.code, layout);
  }
  const data = rasterize(w, ppm, { quiet: (total - N) / 2 }).data,
    side = Math.min(pic.w, pic.h);
  for (let py = 0; py < width; py++)
    for (let px = 0; px < width; px++) {
      const x = ((px + 0.5) / width - 0.5) * total,
        y = (0.5 - (py + 0.5) / width) * total,
        rr = Math.hypot(x, y),
        out = (py * width + px) * 4;
      let col = BG;
      if (Math.abs(x) < N / 2 && Math.abs(y) < N / 2) {
        // Use the same 4 x 4 area samples as Square and the runtime scan check.
        continue;
      } else if (rr <= H && rr >= H - 0.65) col = w.decoration === "picture" ? BG : FG;
      else if (rr < H - 0.65 && Math.max(Math.abs(x), Math.abs(y)) >= N / 2 + 4) {
        const r = Math.round((N - 1) / 2 - y),
          c = Math.round(x + (N - 1) / 2),
          dx = x - (c - (N - 1) / 2),
          dy = y - ((N - 1) / 2 - r);
        const dark = w.decoration !== "picture" && layout.dark(r, c) && Math.hypot(dx, dy) <= 0.44;
        const sx = Math.max(
          0,
          Math.min(pic.w - 1, Math.floor((pic.w - side) / 2 + (0.5 + x / (2 * H)) * side)),
        );
        const sy = Math.max(
          0,
          Math.min(pic.h - 1, Math.floor((pic.h - side) / 2 + (0.5 - y / (2 * H)) * side)),
        );
        const p = (sy * pic.w + sx) * 3,
          g = gray(pic.data.subarray(p, p + 3));
        const f = dark
          ? Math.min(1, 0.25 / Math.max(g, 0.001))
          : Math.min(1, 0.2 / Math.max(1 - g, 0.001));
        col = [0, 1, 2].map((ch) =>
          w.decoration === "picture"
            ? pic.data[p + ch]
            : dark
              ? pic.data[p + ch] * f
              : 1 - (1 - pic.data[p + ch]) * f,
        );
      }
      for (let ch = 0; ch < 3; ch++) data[out + ch] = 255 * col[ch];
      data[out + 3] = 255;
    }
  return { data, width, height: width };
}
export const CONDITIONS = [];
for (const ppm of [8, 4])
  for (const blur of [0.2, 0.3])
    for (const view of ["front", "yaw10", "pitch10", "dim", "bright", "combined"]) {
      CONDITIONS.push({
        id: `${ppm}px-blur${blur}-${view}`,
        ppm,
        blur,
        yaw: view === "yaw10" || view === "combined" ? 10 : 0,
        pitch: view === "pitch10" ? 10 : 0,
        light: view === "dim" || view === "combined" ? 0.3 : 0,
        bright: view === "bright" ? 1.15 : 1,
      });
    }
export function conditionImage(sticker, w, shape, c) {
  const modules = shape === "circle" ? 2 * (shapeHalf(w.code, "circle") + 1) : w.code.size + 8;
  let img =
    c.yaw || c.pitch
      ? capture(sticker, { modules, modulePx: c.ppm, yaw: c.yaw, pitch: c.pitch, margin: 0.1 })
      : { ...sticker, data: new Uint8ClampedArray(sticker.data) };
  if (c.light) img = lightGradient(img, c.light);
  if (c.bright !== 1)
    for (let i = 0; i < img.data.length; i++) if (i % 4 !== 3) img.data[i] *= c.bright;
  gaussBlur(img.data, img.width, img.height, c.blur * c.ppm);
  return img;
}
