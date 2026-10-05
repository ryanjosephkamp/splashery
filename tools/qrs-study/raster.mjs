// Lane QR lab r2, the study of splat QR codes: a software Gaussian splat
// rasterizer (Node, deterministic). It draws a list of splats (the shape
// src/qr-lab/splats.js makes: { p, scales, quat, color, opacity }) the way a
// 3D Gaussian splatting renderer does (Kerbl et al. 2023, "3D Gaussian
// Splatting for Real-Time Radiance Field Rendering", after Zwicker et al.'s
// EWA splatting):
//   1. each splat's 3D covariance is R S Sᵀ Rᵀ (R from its quaternion, S its
//      scales);
//   2. it is carried into the camera and projected to a 2D covariance with
//      the Jacobian of the pinhole projection (J W Σ Wᵀ Jᵀ), plus 0.3 px² on
//      the diagonal (3DGS's low-pass filter, so no splat is thinner than a
//      pixel);
//   3. splats are sorted by depth and alpha-composited front to back, each
//      pixel's alpha = opacity · exp(-½ dᵀ Σ⁻¹ d), capped at 0.99, skipped
//      below 1/255 and cut off past 3σ; a pixel stops once it is opaque.
// Colors are used as stored (0..1, display values), as Splashery's engine
// does; the backdrop shows through whatever the splats leave.
//
// The camera looks at the code from +Z. The code is turned by `yaw` (about
// the vertical axis) then `pitch` (about the horizontal axis), both in
// degrees, and seen from `dist` module units away with a focal length of
// `focal` pixels. Or, with `ortho: true`, straight on at `ppm` pixels per
// module. `cx`, `cy` place the code's center in the image (pixels).

const DEG = Math.PI / 180;

function rotMat(q) {
  const [x, y, z, w] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ]; // prettier-ignore
}
const mul3 = (A, B) => {
  const o = new Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
  return o;
};
const T3 = (A) => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];

// The code's turn as a 3×3 matrix: pitch (about x) after yaw (about y).
export function viewTurn(yaw = 0, pitch = 0) {
  const a = yaw * DEG;
  const b = pitch * DEG;
  const Ry = [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const Rx = [1, 0, 0, 0, Math.cos(b), -Math.sin(b), 0, Math.sin(b), Math.cos(b)];
  return mul3(Rx, Ry);
}

// Where a point of the code (module units, after any turn) lands in the
// image: [u, v, depth].
export function projector(cam) {
  const { width, height } = cam;
  const cx = cam.cx ?? width / 2;
  const cy = cam.cy ?? height / 2;
  const M = viewTurn(cam.yaw || 0, cam.pitch || 0);
  if (cam.ortho) {
    const s = cam.ppm;
    return (p) => {
      const x = M[0] * p[0] + M[1] * p[1] + M[2] * p[2];
      const y = M[3] * p[0] + M[4] * p[1] + M[5] * p[2];
      const z = M[6] * p[0] + M[7] * p[1] + M[8] * p[2];
      return [cx + s * x, cy - s * y, 1000 - z];
    };
  }
  const f = cam.focal;
  const D = cam.dist;
  return (p) => {
    const x = M[0] * p[0] + M[1] * p[1] + M[2] * p[2];
    const y = M[3] * p[0] + M[4] * p[1] + M[5] * p[2];
    const z = M[6] * p[0] + M[7] * p[1] + M[8] * p[2];
    const d = D - z;
    return [cx + (f * x) / d, cy - (f * y) / d, d];
  };
}

// Renders `splats` to an RGBA image { width, height, data }.
//   cam: { width, height, ortho, ppm } or { width, height, focal, dist },
//        plus yaw, pitch (degrees), cx, cy
//   backdrop: [r, g, b] 0..255
export function render(splats, cam, { backdrop, lowpass = 0.3 } = {}) {
  backdrop = backdrop || [30, 32, 38];
  const { width: W, height: H } = cam;
  const cx = cam.cx ?? W / 2;
  const cy = cam.cy ?? H / 2;
  const M = viewTurn(cam.yaw || 0, cam.pitch || 0);
  // Camera axes: x right, y down, z forward (into the scene).
  const Wc = mul3([1, 0, 0, 0, -1, 0, 0, 0, -1], M);
  const WcT = T3(Wc);
  const n = splats.length;
  const prj = new Float64Array(n * 7); // u, v, depth, a, b, c (Σ⁻¹), radius
  const order = [];
  for (let k = 0; k < n; k++) {
    const s = splats[k];
    if (!(s.opacity > 0)) continue;
    const R = rotMat(s.quat);
    const S = s.scales;
    // Σ = R S² Rᵀ, then into the camera: Wc Σ Wcᵀ.
    const RS = [
      R[0] * S[0], R[1] * S[1], R[2] * S[2],
      R[3] * S[0], R[4] * S[1], R[5] * S[2],
      R[6] * S[0], R[7] * S[1], R[8] * S[2],
    ]; // prettier-ignore
    const Sig = mul3(RS, T3(RS));
    const Sc = mul3(mul3(Wc, Sig), WcT);
    const [px, py, pz] = s.p;
    const xc = Wc[0] * px + Wc[1] * py + Wc[2] * pz;
    const yc = Wc[3] * px + Wc[4] * py + Wc[5] * pz;
    const zc = Wc[6] * px + Wc[7] * py + Wc[8] * pz;
    let u;
    let v;
    let depth;
    let J;
    if (cam.ortho) {
      const sc = cam.ppm;
      u = cx + sc * xc;
      v = cy + sc * yc;
      depth = 1000 + zc;
      J = [sc, 0, 0, 0, sc, 0];
    } else {
      const f = cam.focal;
      depth = cam.dist + zc;
      if (depth < 0.05) continue;
      u = cx + (f * xc) / depth;
      v = cy + (f * yc) / depth;
      J = [f / depth, 0, (-f * xc) / (depth * depth), 0, f / depth, (-f * yc) / (depth * depth)];
    }
    // Σ2 = J Sc Jᵀ (2×2).
    const JS0 = J[0] * Sc[0] + J[1] * Sc[3] + J[2] * Sc[6];
    const JS1 = J[0] * Sc[1] + J[1] * Sc[4] + J[2] * Sc[7];
    const JS2 = J[0] * Sc[2] + J[1] * Sc[5] + J[2] * Sc[8];
    const JT0 = J[3] * Sc[0] + J[4] * Sc[3] + J[5] * Sc[6];
    const JT1 = J[3] * Sc[1] + J[4] * Sc[4] + J[5] * Sc[7];
    const JT2 = J[3] * Sc[2] + J[4] * Sc[5] + J[5] * Sc[8];
    const sxx = JS0 * J[0] + JS1 * J[1] + JS2 * J[2] + lowpass;
    const sxy = JS0 * J[3] + JS1 * J[4] + JS2 * J[5];
    const syy = JT0 * J[3] + JT1 * J[4] + JT2 * J[5] + lowpass;
    const det = sxx * syy - sxy * sxy;
    if (!(det > 1e-12)) continue;
    const mid = 0.5 * (sxx + syy);
    const lmax = mid + Math.sqrt(Math.max(0.1, mid * mid - det));
    const rad = Math.ceil(3 * Math.sqrt(lmax));
    if (u + rad < 0 || v + rad < 0 || u - rad > W || v - rad > H) continue;
    const o = k * 7;
    prj[o] = u;
    prj[o + 1] = v;
    prj[o + 2] = depth;
    prj[o + 3] = syy / det;
    prj[o + 4] = -sxy / det;
    prj[o + 5] = sxx / det;
    prj[o + 6] = rad;
    order.push(k);
  }
  order.sort((a, b) => prj[a * 7 + 2] - prj[b * 7 + 2]);
  const acc = new Float32Array(W * H * 3);
  const T = new Float32Array(W * H).fill(1);
  for (const k of order) {
    const o = k * 7;
    const u = prj[o];
    const v = prj[o + 1];
    const A = prj[o + 3];
    const B = prj[o + 4];
    const C = prj[o + 5];
    const rad = prj[o + 6];
    const s = splats[k];
    const op = s.opacity;
    const [r, g, b] = s.color;
    const x0 = Math.max(0, Math.floor(u - rad));
    const x1 = Math.min(W - 1, Math.ceil(u + rad));
    const y0 = Math.max(0, Math.floor(v - rad));
    const y1 = Math.min(H - 1, Math.ceil(v + rad));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - v;
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        const t = T[i];
        if (t < 1e-4) continue;
        const dx = x + 0.5 - u;
        const q = A * dx * dx + 2 * B * dx * dy + C * dy * dy;
        if (q > 9) continue; // past 3σ
        let al = op * Math.exp(-0.5 * q);
        if (al < 1 / 255) continue;
        if (al > 0.99) al = 0.99;
        const w = al * t;
        acc[i * 3] += w * r;
        acc[i * 3 + 1] += w * g;
        acc[i * 3 + 2] += w * b;
        T[i] = t * (1 - al);
      }
    }
  }
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const t = T[i];
    data[i * 4] = Math.round(acc[i * 3] * 255 + t * backdrop[0]);
    data[i * 4 + 1] = Math.round(acc[i * 3 + 1] * 255 + t * backdrop[1]);
    data[i * 4 + 2] = Math.round(acc[i * 3 + 2] * 255 + t * backdrop[2]);
    data[i * 4 + 3] = 255;
  }
  return { width: W, height: H, data };
}

// The screen camera the study uses: the code and its quiet zone fill a
// square image `ppm` pixels per module wide when seen straight on from
// `dist` widths away (dist 1 = the code fills the frame), turned by yaw and
// pitch. `offset` shifts the code by a fraction of a pixel (each trial's
// pixel phase). Returns the camera for render() and projector().
// `aspect` makes the frame that many times wider than tall.
export function screenCamera(
  modulesWide,
  { ppm = 8, yaw = 0, pitch = 0, dist = 1, offset = [0, 0], depth = 3, aspect = 1 } = {},
) {
  const H = Math.round(modulesWide * ppm);
  const W = Math.round(modulesWide * aspect * ppm);
  const D = depth * modulesWide; // the camera sits 3 code widths away
  return {
    width: W,
    height: H,
    focal: (ppm * D) / dist,
    dist: D,
    yaw,
    pitch,
    cx: W / 2 + offset[0],
    cy: H / 2 + offset[1],
  };
}

// PNG helpers.
import { PNG } from "pngjs";
export function toPNG(img) {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data);
  return PNG.sync.write(png);
}
export function fromPNG(buf) {
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
}
