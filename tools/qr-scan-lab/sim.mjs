// Simulated phone captures of a rendered QR code. Pure Node, no browser.
// An image is { width, height, data } with data an RGBA Uint8ClampedArray.
import jpeg from "jpeg-js";

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

export function newImage(width, height, fill = [255, 255, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set([fill[0], fill[1], fill[2], 255], i);
  return { width, height, data };
}

// Box-filter resize to a new width (height keeps the aspect ratio).
export function resize(img, outW) {
  const outH = Math.max(1, Math.round((img.height * outW) / img.width));
  const out = newImage(outW, outH);
  const sx = img.width / outW;
  const sy = img.height / outH;
  for (let y = 0; y < outH; y++) {
    const y0 = y * sy;
    const y1 = Math.min(img.height, (y + 1) * sy);
    for (let x = 0; x < outW; x++) {
      const x0 = x * sx;
      const x1 = Math.min(img.width, (x + 1) * sx);
      let r = 0;
      let g = 0;
      let b = 0;
      let wsum = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(yy + 1, y1) - Math.max(yy, y0);
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const w = wy * (Math.min(xx + 1, x1) - Math.max(xx, x0));
          const i = (yy * img.width + xx) * 4;
          r += img.data[i] * w;
          g += img.data[i + 1] * w;
          b += img.data[i + 2] * w;
          wsum += w;
        }
      }
      const o = (y * outW + x) * 4;
      out.data[o] = r / wsum;
      out.data[o + 1] = g / wsum;
      out.data[o + 2] = b / wsum;
    }
  }
  return out;
}

// Place the code (a square image) on a plane seen by a pinhole camera.
// modulePx is the size of one module in output pixels when facing the code;
// yaw/pitch/roll in degrees; the canvas is the code plus `margin` of backdrop.
export function capture(
  code,
  { modules, modulePx, yaw = 0, pitch = 0, roll = 0, margin = 0.25, backdrop = [118, 112, 104] },
) {
  const codePx = Math.round(modules * modulePx);
  const src = resize(code, Math.max(8, codePx));
  const W = Math.round(codePx * (1 + margin * 2));
  const out = newImage(W, W, backdrop);
  const f = 1000;
  const k = codePx / src.width;
  const d = f / k;
  const [cy, sy_] = [Math.cos((yaw * Math.PI) / 180), Math.sin((yaw * Math.PI) / 180)];
  const [cp, sp] = [Math.cos((pitch * Math.PI) / 180), Math.sin((pitch * Math.PI) / 180)];
  const [cr, sr] = [Math.cos((roll * Math.PI) / 180), Math.sin((roll * Math.PI) / 180)];
  // R = Ry(yaw) * Rx(pitch) * Rz(roll); columns are the plane axes in camera space.
  const mul = (A, B) =>
    A.map((row, i) => B[0].map((_, j) => row.reduce((s, _v, t) => s + A[i][t] * B[t][j], 0)));
  const Ry = [
    [cy, 0, sy_],
    [0, 1, 0],
    [-sy_, 0, cy],
  ];
  const Rx = [
    [1, 0, 0],
    [0, cp, -sp],
    [0, sp, cp],
  ];
  const Rz = [
    [cr, -sr, 0],
    [sr, cr, 0],
    [0, 0, 1],
  ];
  const R = mul(mul(Ry, Rx), Rz);
  const n = [R[0][2], R[1][2], R[2][2]];
  const nc = n[2] * d;
  const hw = src.width / 2;
  const hh = src.height / 2;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const a = (x - W / 2 + 0.5) / f;
      const b = (y - W / 2 + 0.5) / f;
      const den = n[0] * a + n[1] * b + n[2];
      if (Math.abs(den) < 1e-9) continue;
      const t = nc / den;
      if (t <= 0) continue;
      const P = [t * a, t * b, t - d];
      const u = R[0][0] * P[0] + R[1][0] * P[1] + R[2][0] * P[2] + hw - 0.5;
      const v = R[0][1] * P[0] + R[1][1] * P[1] + R[2][1] * P[2] + hh - 0.5;
      if (u < 0 || v < 0 || u > src.width - 1 || v > src.height - 1) continue;
      const x0 = Math.floor(u);
      const y0 = Math.floor(v);
      const fx = u - x0;
      const fy = v - y0;
      const x1 = Math.min(x0 + 1, src.width - 1);
      const y1 = Math.min(y0 + 1, src.height - 1);
      const o = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        const p00 = src.data[(y0 * src.width + x0) * 4 + c];
        const p10 = src.data[(y0 * src.width + x1) * 4 + c];
        const p01 = src.data[(y1 * src.width + x0) * 4 + c];
        const p11 = src.data[(y1 * src.width + x1) * 4 + c];
        out.data[o + c] = (p00 * (1 - fx) + p10 * fx) * (1 - fy) + (p01 * (1 - fx) + p11 * fx) * fy;
      }
    }
  }
  return out;
}

export function blur(img, sigma) {
  if (sigma < 0.3) return img;
  const r = Math.ceil(sigma * 3);
  const kern = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += kern[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < kern.length; i++) kern[i] /= sum;
  const pass = (inp, horizontal) => {
    const out = { ...inp, data: new Uint8ClampedArray(inp.data.length) };
    for (let y = 0; y < inp.height; y++) {
      for (let x = 0; x < inp.width; x++) {
        let acc = [0, 0, 0];
        for (let i = -r; i <= r; i++) {
          const xx = horizontal ? Math.min(inp.width - 1, Math.max(0, x + i)) : x;
          const yy = horizontal ? y : Math.min(inp.height - 1, Math.max(0, y + i));
          const p = (yy * inp.width + xx) * 4;
          const w = kern[i + r];
          acc[0] += inp.data[p] * w;
          acc[1] += inp.data[p + 1] * w;
          acc[2] += inp.data[p + 2] * w;
        }
        const o = (y * inp.width + x) * 4;
        out.data.set([acc[0], acc[1], acc[2], 255], o);
      }
    }
    return out;
  };
  return pass(pass(img, true), false);
}

// Uneven light: brightness falls from 1 to 1 - strength across the image, along `angle` degrees.
export function lightGradient(img, strength, angle = 20) {
  const out = { ...img, data: new Uint8ClampedArray(img.data) };
  const ca = Math.cos((angle * Math.PI) / 180);
  const sa = Math.sin((angle * Math.PI) / 180);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const t = ((x / img.width - 0.5) * ca + (y / img.height - 0.5) * sa) / (ca + sa) + 0.5;
      const m = 1 - strength * Math.min(1, Math.max(0, t));
      const o = (y * img.width + x) * 4;
      for (let c = 0; c < 3; c++) out.data[o + c] = img.data[o + c] * m;
    }
  }
  return out;
}

export function noise(img, sigma, seed = 1) {
  const r = rng(seed);
  const out = { ...img, data: new Uint8ClampedArray(img.data) };
  for (let i = 0; i < out.data.length; i += 4) {
    const g = gauss(r) * sigma;
    for (let c = 0; c < 3; c++) out.data[i + c] += g + gauss(r) * sigma * 0.3;
  }
  return out;
}

export function jpegRoundTrip(img, quality) {
  const enc = jpeg.encode(
    { width: img.width, height: img.height, data: Buffer.from(img.data) },
    quality,
  );
  const dec = jpeg.decode(enc.data, { useTArray: true, formatAsRGBA: true });
  return { width: dec.width, height: dec.height, data: new Uint8ClampedArray(dec.data) };
}

// The named capture conditions; each is a recipe over a rendered code.
export function conditions() {
  const mk = (id, group, o) => ({
    id,
    group,
    modulePx: 8,
    yaw: 0,
    pitch: 0,
    roll: 0,
    blurFrac: 0,
    jpeg: 0,
    noise: 0,
    light: 0,
    ...o,
  });
  const list = [mk("front", "baseline", {})];
  for (const t of [10, 20, 28, 35]) list.push(mk(`tilt${t}`, "tilt", { yaw: t }));
  for (const m of [2, 3, 4, 5, 6, 12]) list.push(mk(`mod${m}`, "size", { modulePx: m }));
  for (const [id, f] of [
    ["blur10", 0.1],
    ["blur20", 0.2],
    ["blur35", 0.35],
  ])
    list.push(mk(id, "blur", { blurFrac: f }));
  for (const [id, q] of [
    ["jpeg60", 60],
    ["jpeg30", 30],
    ["jpeg15", 15],
  ])
    list.push(mk(id, "jpeg", { jpeg: q, noise: 5 }));
  for (const [id, s] of [
    ["light30", 0.3],
    ["light60", 0.6],
  ])
    list.push(mk(id, "light", { light: s }));
  list.push(mk("persp", "perspective", { yaw: 8, pitch: 12, roll: 5 }));
  list.push(
    mk("phone", "combined", {
      modulePx: 5,
      yaw: 20,
      pitch: 6,
      roll: 3,
      blurFrac: 0.15,
      jpeg: 50,
      noise: 4,
      light: 0.3,
    }),
  );
  list.push(
    mk("hard", "combined", {
      modulePx: 4,
      yaw: 30,
      pitch: 10,
      roll: 6,
      blurFrac: 0.25,
      jpeg: 35,
      noise: 6,
      light: 0.45,
    }),
  );
  return list;
}

export function applyCondition(code, modules, c, seed = 7) {
  let img = capture(code, {
    modules,
    modulePx: c.modulePx,
    yaw: c.yaw,
    pitch: c.pitch,
    roll: c.roll,
  });
  if (c.light) img = lightGradient(img, c.light);
  if (c.blurFrac) img = blur(img, c.blurFrac * c.modulePx);
  if (c.noise) img = noise(img, c.noise, seed);
  if (c.jpeg) img = jpegRoundTrip(img, c.jpeg);
  return img;
}
