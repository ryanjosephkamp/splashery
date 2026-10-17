// Deterministic, independently testable scoring. Distances use D65 sRGB.
export const linear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const srgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
export function lab(rgb) {
  const [r, g, b] = rgb.map(linear);
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
// CIEDE2000, kL=kC=kH=1 (Sharma, Wu, and Dalal, 2005).
export function deltaE2000([l1, a1, b1], [l2, a2, b2]) {
  const rad = Math.PI / 180;
  const c1 = Math.hypot(a1, b1),
    c2 = Math.hypot(a2, b2),
    c = (c1 + c2) / 2;
  const g = (1 - Math.sqrt(c ** 7 / (c ** 7 + 25 ** 7))) / 2;
  const ap1 = (1 + g) * a1,
    ap2 = (1 + g) * a2;
  const cp1 = Math.hypot(ap1, b1),
    cp2 = Math.hypot(ap2, b2);
  const hue = (a, b) => (Math.atan2(b, a) / rad + 360) % 360;
  const h1 = cp1 ? hue(ap1, b1) : 0,
    h2 = cp2 ? hue(ap2, b2) : 0;
  let dh = h2 - h1;
  if (!cp1 || !cp2) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dl = l2 - l1,
    dc = cp2 - cp1;
  const dH = 2 * Math.sqrt(cp1 * cp2) * Math.sin((dh * rad) / 2);
  const lm = (l1 + l2) / 2,
    cm = (cp1 + cp2) / 2;
  const hm =
    !cp1 || !cp2
      ? h1 + h2
      : Math.abs(h1 - h2) <= 180
        ? (h1 + h2) / 2
        : (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2;
  const t =
    1 -
    0.17 * Math.cos((hm - 30) * rad) +
    0.24 * Math.cos(2 * hm * rad) +
    0.32 * Math.cos((3 * hm + 6) * rad) -
    0.2 * Math.cos((4 * hm - 63) * rad);
  const sl = 1 + (0.015 * (lm - 50) ** 2) / Math.sqrt(20 + (lm - 50) ** 2);
  const sc = 1 + 0.045 * cm,
    sh = 1 + 0.015 * cm * t;
  const rt =
    -2 *
    Math.sqrt(cm ** 7 / (cm ** 7 + 25 ** 7)) *
    Math.sin(60 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dl / sl) ** 2 + (dc / sc) ** 2 + (dH / sh) ** 2 + rt * (dc / sc) * (dH / sh));
}
export function silhouetteIoU(a, b) {
  let both = 0,
    either = 0;
  for (let i = 0; i < a.length; i++) {
    both += !!a[i] && !!b[i];
    either += !!a[i] || !!b[i];
  }
  return either ? both / either : 1;
}
export function boundary(mask, w, h) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (
        mask[i] &&
        (!x ||
          !y ||
          x === w - 1 ||
          y === h - 1 ||
          !mask[i - 1] ||
          !mask[i + 1] ||
          !mask[i - w] ||
          !mask[i + w])
      )
        out[i] = 1;
    }
  return out;
}
export function nearFraction(a, b, w, h, radius = 2) {
  let n = 0,
    hits = 0;
  for (let i = 0; i < a.length; i++)
    if (a[i]) {
      n++;
      const x = i % w,
        y = Math.floor(i / w);
      let found = false;
      for (let yy = Math.max(0, y - radius); yy <= Math.min(h - 1, y + radius) && !found; yy++)
        for (let xx = Math.max(0, x - radius); xx <= Math.min(w - 1, x + radius); xx++)
          if ((xx - x) ** 2 + (yy - y) ** 2 <= radius ** 2 && b[yy * w + xx]) {
            found = true;
            break;
          }
      hits += found;
    }
  return n ? hits / n : 1;
}
export function boundaryF1(a, b, w, h, radius = 2) {
  const aa = boundary(a, w, h),
    bb = boundary(b, w, h);
  const p = nearFraction(aa, bb, w, h, radius),
    r = nearFraction(bb, aa, w, h, radius);
  return p + r ? (2 * p * r) / (p + r) : 0;
}
export function strongEdges(image, mask) {
  const { width: w, height: h, data } = image,
    out = new Uint8Array(w * h);
  const gray = (i) => (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const gx =
        gray(i - w + 1) +
        2 * gray(i + 1) +
        gray(i + w + 1) -
        gray(i - w - 1) -
        2 * gray(i - 1) -
        gray(i + w - 1);
      const gy =
        gray(i + w - 1) +
        2 * gray(i + w) +
        gray(i + w + 1) -
        gray(i - w - 1) -
        2 * gray(i - w) -
        gray(i - w + 1);
      out[i] = +(Math.hypot(gx, gy) >= 100);
    }
  return out;
}
// One scalar for the ENTIRE pack, fitted in linear light over the overlap.
export function exposureMatch(pairs) {
  let xy = 0,
    xx = 0;
  for (const { photo, render, mask, renderedMask } of pairs)
    for (let i = 0; i < mask.length; i++)
      if (mask[i] && renderedMask[i])
        for (let k = 0; k < 3; k++) {
          const x = linear(render.data[i * 4 + k] / 255),
            y = linear(photo.data[i * 4 + k] / 255);
          xy += x * y;
          xx += x * x;
        }
  return xx ? Math.max(0.25, Math.min(4, xy / xx)) : 1;
}
export function scorePicture(pair, exposure) {
  const { photo, render, mask, renderedMask } = pair,
    w = photo.width,
    h = photo.height;
  const iou = silhouetteIoU(mask, renderedMask),
    f1 = boundaryF1(mask, renderedMask, w, h);
  const adjusted = { ...render, data: Uint8Array.from(render.data) };
  let color = 0,
    overlap = 0;
  const diff = new Uint8Array(w * h * 4);
  for (let i = 0; i < mask.length; i++) {
    const rgb = [0, 1, 2].map((k) =>
      Math.max(0, Math.min(1, srgb(linear(render.data[i * 4 + k] / 255) * exposure))),
    );
    rgb.forEach((v, k) => {
      adjusted.data[i * 4 + k] = Math.round(v * 255);
    });
    if (mask[i] && renderedMask[i]) {
      const d = deltaE2000(lab([0, 1, 2].map((k) => photo.data[i * 4 + k] / 255)), lab(rgb));
      color += d;
      overlap++;
      diff.set([Math.min(255, d * 6), 20, 20, 255], i * 4);
    } else
      diff.set(
        mask[i]
          ? [240, 30, 100, 255]
          : renderedMask[i]
            ? [20, 110, 240, 255]
            : [245, 245, 245, 255],
        i * 4,
      );
  }
  const meanDeltaE = overlap ? color / overlap : 100;
  const edgeRecall = nearFraction(
    strongEdges(photo, mask),
    strongEdges(adjusted, renderedMask),
    w,
    h,
  );
  const colorScore = Math.exp(-meanDeltaE / 20);
  // Color and edge credit require geometric overlap; a tiny matching patch cannot win.
  const score = 100 * (0.5 * iou + 0.2 * f1 + 0.2 * colorScore * iou + 0.1 * edgeRecall * iou);
  return {
    silhouetteIoU: iou,
    boundaryF1: f1,
    colorDeltaE2000: meanDeltaE,
    colorScore: 100 * colorScore,
    edgeRecall,
    score,
    difference: { width: w, height: h, data: diff },
  };
}
