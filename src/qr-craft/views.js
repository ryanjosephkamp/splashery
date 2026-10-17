// Extra camera checks for Most detail. The legacy four layout checks still run first.
import { rasterize, gaussBlur } from "./picture.js";
import { detailFrame } from "./frame.js";
import { scanEstimate } from "./fidelity.js";

export function projectFrame(img, axis) {
  const W = img.width,
    outW = Math.round(W * 1.2),
    data = new Uint8ClampedArray(outW * outW * 4);
  const c = Math.cos(Math.PI / 18),
    s = Math.sin(Math.PI / 18),
    f = 1000;
  const yaw = axis === "yaw",
    coordinates = new Float64Array(outW),
    scales = new Float64Array(outW),
    projected = new Float64Array(outW);
  for (let i = 0; i < outW; i++) {
    const a = (i - outW / 2 + 0.5) / f,
      t = (c * f) / (yaw ? s * a + c : -s * a + c);
    coordinates[i] = a;
    scales[i] = t;
    projected[i] = (yaw ? c * (t * a) - s * (t - f) : c * (t * a) + s * (t - f)) + W / 2 - 0.5;
  }
  for (let y = 0; y < outW; y++)
    for (let x = 0; x < outW; x++) {
      const q = (y * outW + x) * 4;
      data[q] = 118;
      data[q + 1] = 112;
      data[q + 2] = 104;
      data[q + 3] = 255;
      const u = yaw ? projected[x] : scales[y] * coordinates[x] + W / 2 - 0.5;
      const v = yaw ? scales[x] * coordinates[y] + W / 2 - 0.5 : projected[y];
      if (u < 0 || v < 0 || u > W - 1 || v > W - 1) continue;
      const x0 = Math.floor(u),
        y0 = Math.floor(v),
        x1 = Math.min(W - 1, x0 + 1),
        y1 = Math.min(W - 1, y0 + 1),
        fx = u - x0,
        fy = v - y0;
      for (let ch = 0; ch < 3; ch++)
        data[q + ch] =
          (img.data[(y0 * W + x0) * 4 + ch] * (1 - fx) + img.data[(y0 * W + x1) * 4 + ch] * fx) *
            (1 - fy) +
          (img.data[(y1 * W + x0) * 4 + ch] * (1 - fx) + img.data[(y1 * W + x1) * 4 + ch] * fx) *
            fy;
    }
  return { width: outW, height: outW, data };
}
export function lightFrame(img, bright = false) {
  const data = new Uint8ClampedArray(img.data),
    ca = Math.cos(Math.PI / 9),
    sa = Math.sin(Math.PI / 9);
  if (bright) {
    for (let q = 0; q < data.length; q += 4) for (let ch = 0; ch < 3; ch++) data[q + ch] *= 1.15;
    return { ...img, data };
  }
  const xs = Float64Array.from({ length: img.width }, (_, x) => (x / img.width - 0.5) * ca),
    ys = Float64Array.from({ length: img.height }, (_, y) => (y / img.height - 0.5) * sa);
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const t = (xs[x] + ys[y]) / (ca + sa) + 0.5;
      const m = 1 - 0.3 * Math.min(1, Math.max(0, t)),
        q = (y * img.width + x) * 4;
      for (let ch = 0; ch < 3; ch++) data[q + ch] *= m;
    }
  return { ...img, data };
}

export function cameraFrames(at, only = null) {
  const frames = [];
  for (const ppm of [8, 4].filter((p) => !only || !only.ppm || p === only.ppm)) {
    const front = at(ppm),
      views = only?.views || [0, 1, 2, 3, 4, 5];
    const yaw = views.includes(1) || views.includes(5) ? projectFrame(front, "yaw") : null;
    const images = [
      front,
      yaw,
      views.includes(2) ? projectFrame(front, "pitch") : null,
      views.includes(3) ? lightFrame(front) : null,
      views.includes(4) ? lightFrame(front, true) : null,
      views.includes(5) ? lightFrame(yaw) : null,
    ];
    for (const blur of [0.2, 0.3].filter((b) => !only || !only.blur || b === only.blur))
      for (const view of views) frames.push({ ppm, blur, view, image: images[view] });
  }
  return frames;
}
function* preparedFrames(frames) {
  const maxPixels = Math.max(...frames.map((f) => f.image.width * f.image.height));
  const scratch = new Float32Array(maxPixels * 3),
    work = new Uint8ClampedArray(maxPixels * 4);
  for (const { ppm, blur, view, image } of frames) {
    const data = work.subarray(0, image.data.length);
    data.set(image.data);
    gaussBlur(data, image.width, image.height, blur * ppm, scratch);
    yield { ppm, blur, view, image: { ...image, data } };
  }
}
export function checkPreparedFrames(frames, read, text) {
  for (const { ppm, blur, view, image } of preparedFrames(frames))
    if (read(image.data, image.width, image.height) !== text) return { ok: false, ppm, blur, view };
  return { ok: true };
}
export async function checkPreparedFramesBoth(frames, read, text, second) {
  for (const { ppm, blur, view, image } of preparedFrames(frames)) {
    if (read(image.data, image.width, image.height) !== text)
      return { ok: false, ppm, blur, view, reader: "jsqr" };
    if ((await second(image)) !== text) return { ok: false, ppm, blur, view, reader: "zxingcpp" };
  }
  return { ok: true, readers: ["jsqr", "zxingcpp"] };
}
function checkFrames(at, read, text, only = null) {
  return checkPreparedFrames(cameraFrames(at, only), read, text);
}
export function checkDetailViews(w, read, shape = "square", pic = null, only = null) {
  const estimated = scanEstimate(w);
  return checkFrames((ppm) => detailFrame(estimated, pic, ppm, shape), read, w.code.text, only);
}
// Exact area weights, cached for the repeated camera sizes (bounded to 16 axes).
const axes = new Map();
function axis(input, output) {
  const key = input + "/" + output;
  if (axes.has(key)) return axes.get(key);
  const starts = new Uint32Array(output + 1),
    positions = [],
    weights = [],
    step = input / output;
  for (let p = 0; p < output; p++) {
    const lo = p * step,
      hi = Math.min(input, (p + 1) * step);
    for (let i = Math.floor(lo); i < Math.ceil(hi); i++) {
      positions.push(i);
      weights.push(Math.min(i + 1, hi) - Math.max(i, lo));
    }
    starts[p + 1] = positions.length;
  }
  const value = {
    starts,
    positions: Uint32Array.from(positions),
    weights: Float64Array.from(weights),
  };
  if (axes.size >= 16) axes.delete(axes.keys().next().value);
  axes.set(key, value);
  return value;
}
export function resizeFrame(img, outW) {
  const outH = Math.max(1, Math.round((img.height * outW) / img.width)),
    data = new Uint8ClampedArray(outW * outH * 4),
    xs = axis(img.width, outW),
    ys = axis(img.height, outH);
  for (let y = 0; y < outH; y++)
    for (let x = 0; x < outW; x++) {
      let red = 0,
        green = 0,
        blue = 0,
        sum = 0;
      for (let iy = ys.starts[y]; iy < ys.starts[y + 1]; iy++) {
        const row = ys.positions[iy] * img.width * 4,
          wy = ys.weights[iy];
        for (let ix = xs.starts[x]; ix < xs.starts[x + 1]; ix++) {
          const weight = wy * xs.weights[ix],
            q = row + xs.positions[ix] * 4;
          red += img.data[q] * weight;
          green += img.data[q + 1] * weight;
          blue += img.data[q + 2] * weight;
          sum += weight;
        }
      }
      const q = (y * outW + x) * 4;
      data[q] = red / sum;
      data[q + 1] = green / sum;
      data[q + 2] = blue / sum;
      data[q + 3] = 255;
    }
  return { data, width: outW, height: outH };
}
export function checkCapturedViews(img, modules, read, text, only = null) {
  return checkFrames((ppm) => resizeFrame(img, Math.round(modules * ppm)), read, text, only);
}
