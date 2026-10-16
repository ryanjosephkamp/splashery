// Picture coordinates only: no pixels belong in a scene or a share link.
import { shapeHalf } from "../qr/circle.js";
import { gray, FG, BG, weave, SIZES, rasterize } from "./picture.js";
import { encodeQR } from "../qr/encode.js";

// Explicit geometry options use mask 0 after perspective trials failed in
// zxing-js with the previous mask selection. Keep the same version,
// payload, correction level, strict scan grid, and nudge ceiling.
export function fitMaskWoven(w, pic, o, read = null, raster = rasterize) {
  const code = encodeQR(w.code.text, w.code.ecc, {
    boost: false,
    min: w.code.version,
    mask: 0,
  });
  let margin = w.margin;
  let next = weave(code, pic, { ...o, margin });
  if (!read || !pic) return next;
  const strict = [...SIZES, { ppm: 8, blur: 0.3 }, { ppm: 4, blur: 0.3 }];
  const reads = (value) =>
    strict.every((s) => {
      const img = raster(value, s.ppm, { blur: s.blur });
      return read(img.data, img.width, img.height) === code.text;
    });
  for (let step = 0; step < 16 && !reads(next) && margin < 0.5; step++) {
    margin = margin < 0 ? 0.02 : Math.min(0.5, margin + 0.02);
    next = weave(code, pic, { ...o, margin });
  }
  return next;
}

const clamp = (v, lo, hi, fallback) =>
  Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : fallback;
export function cropSettings(o = {}) {
  return {
    cropX: clamp(o.cropX ?? 0.5, 0, 1, 0.5),
    cropY: clamp(o.cropY ?? 0.5, 0, 1, 0.5),
    cropZoom: clamp(o.cropZoom ?? 1, 1, 4, 1),
    pictureFit: ["code", "circle"].includes(o.pictureFit) ? o.pictureFit : "legacy",
  };
}
export function cropWindow(pic, o = {}) {
  const c = cropSettings(o);
  const side =
    (c.pictureFit === "code" ? Math.max(pic.w, pic.h) : Math.min(pic.w, pic.h)) / c.cropZoom;
  return { x: (pic.w - side) * c.cropX, y: (pic.h - side) * c.cropY, side };
}
function pixel(pic, x, y) {
  const px = Math.min(pic.w - 1, Math.max(0, Math.floor(x)));
  const py = Math.min(pic.h - 1, Math.max(0, Math.floor(y)));
  const q = (py * pic.w + px) * 3;
  return [pic.data[q], pic.data[q + 1], pic.data[q + 2]];
}
export function pictureAt(pic, o, size, x, y) {
  const crop = cropWindow(pic, o);
  const c = cropSettings(o);
  const disc = o.shape === "circle" && c.pictureFit !== "code";
  const half = disc ? shapeHalf(size, "circle", o.quiet) : size / 2;
  const px = crop.x + (0.5 + x / (2 * half)) * crop.side;
  const py = crop.y + (0.5 - y / (2 * half)) * crop.side;
  if (c.pictureFit === "code" && (px < 0 || py < 0 || px >= pic.w || py >= pic.h)) return BG;
  return pixel(pic, px, py);
}
export function codePicture(pic, o, size) {
  if (!pic) return null;
  const c = cropSettings(o);
  if (c.pictureFit === "legacy") {
    if (o.shape !== "circle") return pic;
    // Keep the original integer crop for old scenes, including its rounding.
    const n = Math.max(
      1,
      Math.floor((Math.min(pic.w, pic.h) * size) / (2 * shapeHalf(size, "circle", o.quiet))),
    );
    const x = Math.floor((pic.w - n) / 2);
    const y = Math.floor((pic.h - n) / 2);
    const data = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++)
        data.set(
          pic.data.subarray(((y + j) * pic.w + x + i) * 3, ((y + j) * pic.w + x + i) * 3 + 3),
          (j * n + i) * 3,
        );
    return { w: n, h: n, data };
  }
  const crop = cropWindow(pic, c);
  const fraction =
    o.shape === "circle" && c.pictureFit === "circle"
      ? size / (2 * shapeHalf(size, "circle", o.quiet))
      : 1;
  const n = Math.max(1, Math.round(crop.side * fraction));
  const data = new Float32Array(n * n * 3);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      data.set(
        pictureAt(pic, o, size, ((x + 0.5) / n - 0.5) * size, (0.5 - (y + 0.5) / n) * size),
        (y * n + x) * 3,
      );
  return { w: n, h: n, data };
}
export function decorationColor(pic, o, size, x, y, dark, style) {
  if (!pic || style === "bw") return dark ? FG : BG;
  const col = pictureAt(pic, o, size, x, y);
  const g = gray(col);
  return dark
    ? col.map((c) => c * Math.min(1, 0.25 / Math.max(g, 0.001)))
    : col.map((c) => 1 - (1 - c) * Math.min(1, 0.2 / Math.max(1 - g, 0.001)));
}
