// Fits 2D Gaussians to a picture by gradient descent (lane Screens, the
// Gaussian splatting toy). Pure code: runs in src/packs/splat-fit-worker.js
// in the browser, or directly in Node.
//
// The Gaussians are drawn the way the site's renderer draws splats: flat,
// front to back (Gaussian 0 is in front), each with the renderer's kernel
// (a Gaussian cut off where it falls to e^-4 and scaled to reach 0 there)
// over a plain background. So the fitted splats, shown as real splats, make
// the same picture.
//
// fitSplats({ pixels, w, h, n, steps, seed, background, keys }, onProgress)
// returns { w, h, n, keys: [{ step, loss, x, y, sx, sy, angle, r, g, b, a }] }
// with one keyframe per step in `keys` (positions and sizes in pixels,
// angle in radians, colors and opacity 0..1), each array a Float32Array.

const E4 = Math.exp(-4);
const NORM = 1 / (1 - E4);
const CUT = 8; // q at the kernel's edge: exp(-q / 2) = e^-4
const TILE = 8;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sigmoid = (x) => 1 / (1 + Math.exp(-x));

// The steps whose state is kept by default: close together at the start,
// where the picture changes most, then further apart.
export const FIT_KEYS = [0, 2, 5, 9, 14, 20, 28, 38, 50, 65, 85, 110, 140];

export function fitSplats(job, onProgress = null) {
  const { w, h } = job;
  const n = job.n ?? 2400;
  const keys = job.keys ?? FIT_KEYS;
  const steps = job.steps ?? keys[keys.length - 1];
  const bg = job.background ?? [1, 1, 1];
  const rand = mulberry(job.seed ?? 7);
  const P = w * h;
  // The target, 0..1.
  const target = new Float32Array(P * 3);
  for (let i = 0; i < P; i++) {
    target[i * 3] = job.pixels[i * 4] / 255;
    target[i * 3 + 1] = job.pixels[i * 4 + 1] / 255;
    target[i * 3 + 2] = job.pixels[i * 4 + 2] / 255;
  }

  // Parameters: position (px), log sizes, angle, color, opacity logit.
  const NP = 9;
  const prm = new Float32Array(n * NP);
  const spacing = Math.sqrt(P / n);
  for (let i = 0; i < n; i++) {
    const o = i * NP;
    prm[o] = rand() * w;
    prm[o + 1] = rand() * h;
    prm[o + 2] = Math.log(spacing * (0.5 + 0.5 * rand()));
    prm[o + 3] = Math.log(spacing * (0.5 + 0.5 * rand()));
    prm[o + 4] = rand() * Math.PI;
    prm[o + 5] = rand();
    prm[o + 6] = rand();
    prm[o + 7] = rand();
    prm[o + 8] = 0.8;
  }
  // Learning rates per parameter (Adam).
  const LR = [0.35, 0.35, 0.03, 0.03, 0.04, 0.035, 0.035, 0.035, 0.06];
  const m1 = new Float32Array(n * NP);
  const m2 = new Float32Array(n * NP);
  const grad = new Float64Array(n * NP);

  // Per Gaussian, this step: inverse covariance (a, b, c), opacity, box.
  const ga = new Float32Array(n);
  const gb = new Float32Array(n);
  const gc = new Float32Array(n);
  const go = new Float32Array(n);
  const box = new Int32Array(n * 4);
  // Per Gaussian: gradients of the loss by a, b, c.
  const gA = new Float64Array(n);
  const gB = new Float64Array(n);
  const gC = new Float64Array(n);

  const tw = Math.ceil(w / TILE);
  const th = Math.ceil(h / TILE);
  const tileCount = new Int32Array(tw * th + 1);
  let tileList = new Int32Array(n * 8);

  const outC = new Float32Array(P * 3);
  const outT = new Float32Array(P);

  const setup = () => {
    tileCount.fill(0);
    for (let i = 0; i < n; i++) {
      const o = i * NP;
      const s1 = Math.exp(prm[o + 2]);
      const s2 = Math.exp(prm[o + 3]);
      const cs = Math.cos(prm[o + 4]);
      const sn = Math.sin(prm[o + 4]);
      const u1 = 1 / (s1 * s1);
      const u2 = 1 / (s2 * s2);
      ga[i] = cs * cs * u1 + sn * sn * u2;
      gb[i] = cs * sn * (u1 - u2);
      gc[i] = sn * sn * u1 + cs * cs * u2;
      go[i] = sigmoid(prm[o + 8]);
      // The box within the kernel's cut: |dx| <= sqrt(CUT * Sigma_xx).
      const sxx = cs * cs * s1 * s1 + sn * sn * s2 * s2;
      const syy = sn * sn * s1 * s1 + cs * cs * s2 * s2;
      const rx = Math.sqrt(CUT * sxx);
      const ry = Math.sqrt(CUT * syy);
      const x0 = Math.max(0, Math.floor((prm[o] - rx) / TILE));
      const x1 = Math.min(tw - 1, Math.floor((prm[o] + rx) / TILE));
      const y0 = Math.max(0, Math.floor((prm[o + 1] - ry) / TILE));
      const y1 = Math.min(th - 1, Math.floor((prm[o + 1] + ry) / TILE));
      box[i * 4] = x0;
      box[i * 4 + 1] = x1;
      box[i * 4 + 2] = y0;
      box[i * 4 + 3] = y1;
      for (let ty = y0; ty <= y1; ty++)
        for (let tx = x0; tx <= x1; tx++) tileCount[ty * tw + tx + 1]++;
    }
    for (let t = 1; t <= tw * th; t++) tileCount[t] += tileCount[t - 1];
    const total = tileCount[tw * th];
    if (tileList.length < total) tileList = new Int32Array(total * 1.5);
    const fill = tileCount.slice(0, tw * th);
    // In index order, so each tile's list runs front to back.
    for (let i = 0; i < n; i++) {
      for (let ty = box[i * 4 + 2]; ty <= box[i * 4 + 3]; ty++)
        for (let tx = box[i * 4]; tx <= box[i * 4 + 1]; tx++) tileList[fill[ty * tw + tx]++] = i;
    }
  };

  // Per Gaussian, this step: position and color (clamped).
  const gx = new Float32Array(n);
  const gy = new Float32Array(n);
  const gr = new Float32Array(n);
  const gg = new Float32Array(n);
  const gbl = new Float32Array(n);
  // Per pixel, the Gaussians that reached it in the forward pass (front to
  // back): which one, its kernel's exp(-q / 2), dx and dy.
  let cI = new Int32Array(P * 16);
  let cE = new Float32Array(P * 16);
  let cX = new Float32Array(P * 16);
  let cY = new Float32Array(P * 16);
  const cStart = new Int32Array(P + 1);

  // Draws the picture (outC, outT); with `learn`, also the gradients.
  const pass = (learn) => {
    setup();
    for (let i = 0; i < n; i++) {
      const o = i * NP;
      gx[i] = prm[o];
      gy[i] = prm[o + 1];
      gr[i] = clamp01(prm[o + 5]);
      gg[i] = clamp01(prm[o + 6]);
      gbl[i] = clamp01(prm[o + 7]);
    }
    let loss = 0;
    if (learn) {
      grad.fill(0);
      gA.fill(0);
      gB.fill(0);
      gC.fill(0);
    }
    const inv = 1 / P;
    let nc = 0;
    for (let ty = 0; ty < th; ty++)
      for (let tx = 0; tx < tw; tx++) {
        const t = ty * tw + tx;
        const l0 = tileCount[t];
        const l1 = tileCount[t + 1];
        const ymax = Math.min(h, (ty + 1) * TILE);
        const xmax = Math.min(w, (tx + 1) * TILE);
        for (let py = ty * TILE; py < ymax; py++)
          for (let px = tx * TILE; px < xmax; px++) {
            const X = px + 0.5;
            const Y = py + 0.5;
            const p = py * w + px;
            if (nc + (l1 - l0) > cI.length) {
              const grow = (a, T) => {
                const b = new T(Math.max(a.length * 2, nc + (l1 - l0)));
                b.set(a);
                return b;
              };
              cI = grow(cI, Int32Array);
              cE = grow(cE, Float32Array);
              cX = grow(cX, Float32Array);
              cY = grow(cY, Float32Array);
            }
            cStart[p] = nc;
            let T = 1;
            let cr = 0;
            let cg = 0;
            let cb = 0;
            for (let l = l0; l < l1 && T > 1e-4; l++) {
              const i = tileList[l];
              const dx = X - gx[i];
              const dy = Y - gy[i];
              const q = ga[i] * dx * dx + 2 * gb[i] * dx * dy + gc[i] * dy * dy;
              if (q >= CUT) continue;
              const ek = Math.exp(-0.5 * q);
              let al = go[i] * (ek - E4) * NORM;
              if (al < 1 / 255) continue;
              if (al > 0.99) al = 0.99;
              const wgt = T * al;
              cr += wgt * gr[i];
              cg += wgt * gg[i];
              cb += wgt * gbl[i];
              T *= 1 - al;
              cI[nc] = i;
              cE[nc] = ek;
              cX[nc] = dx;
              cY[nc] = dy;
              nc++;
            }
            cStart[p + 1] = nc;
            cr += T * bg[0];
            cg += T * bg[1];
            cb += T * bg[2];
            outC[p * 3] = cr;
            outC[p * 3 + 1] = cg;
            outC[p * 3 + 2] = cb;
            outT[p] = T;
            const er = cr - target[p * 3];
            const eg = cg - target[p * 3 + 1];
            const eb = cb - target[p * 3 + 2];
            loss += er * er + eg * eg + eb * eb;
            if (!learn) continue;
            // dL/dC for this pixel (mean squared error).
            const dr = 2 * er * inv;
            const dg = 2 * eg * inv;
            const db = 2 * eb * inv;
            // Front to back again: T before each Gaussian and the color
            // so far, so the color behind it is (C - so far) / (1 - a).
            let T2 = 1;
            let sr = 0;
            let sg = 0;
            let sb = 0;
            for (let c = cStart[p]; c < nc; c++) {
              const i = cI[c];
              const o = i * NP;
              const ek = cE[c];
              const k = (ek - E4) * NORM;
              let al = go[i] * k;
              const clampd = al > 0.99;
              if (clampd) al = 0.99;
              const r = gr[i];
              const g = gg[i];
              const b = gbl[i];
              const wgt = T2 * al;
              sr += wgt * r;
              sg += wgt * g;
              sb += wgt * b;
              grad[o + 5] += dr * wgt;
              grad[o + 6] += dg * wgt;
              grad[o + 7] += db * wgt;
              if (!clampd) {
                const rest = 1 / (1 - al);
                const dA =
                  dr * (T2 * r - (cr - sr) * rest) +
                  dg * (T2 * g - (cg - sg) * rest) +
                  db * (T2 * b - (cb - sb) * rest);
                // Opacity (through its logit) and the kernel's shape.
                grad[o + 8] += dA * k * go[i] * (1 - go[i]);
                const gq = dA * go[i] * -0.5 * ek * NORM;
                const dx = cX[c];
                const dy = cY[c];
                gA[i] += gq * dx * dx;
                gB[i] += gq * 2 * dx * dy;
                gC[i] += gq * dy * dy;
                grad[o] += gq * -2 * (ga[i] * dx + gb[i] * dy);
                grad[o + 1] += gq * -2 * (gb[i] * dx + gc[i] * dy);
              }
              T2 *= 1 - al;
            }
          }
      }
    if (learn) {
      // a, b, c to the log sizes and the angle.
      for (let i = 0; i < n; i++) {
        const o = i * NP;
        const s1 = Math.exp(prm[o + 2]);
        const s2 = Math.exp(prm[o + 3]);
        const cs = Math.cos(prm[o + 4]);
        const sn = Math.sin(prm[o + 4]);
        const u1 = 1 / (s1 * s1);
        const u2 = 1 / (s2 * s2);
        const gu1 = gA[i] * cs * cs + gB[i] * cs * sn + gC[i] * sn * sn;
        const gu2 = gA[i] * sn * sn - gB[i] * cs * sn + gC[i] * cs * cs;
        grad[o + 2] += gu1 * -2 * u1;
        grad[o + 3] += gu2 * -2 * u2;
        const s2t = 2 * sn * cs;
        const c2t = cs * cs - sn * sn;
        grad[o + 4] += (u1 - u2) * (-gA[i] * s2t + gB[i] * c2t + gC[i] * s2t);
      }
    }
    return loss / P;
  };

  const out = { w, h, n, keys: [] };
  const keep = (step, loss) => {
    const k = { step, loss };
    for (const name of ["x", "y", "sx", "sy", "angle", "r", "g", "b", "a"])
      k[name] = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const o = i * NP;
      k.x[i] = prm[o];
      k.y[i] = prm[o + 1];
      k.sx[i] = Math.exp(prm[o + 2]);
      k.sy[i] = Math.exp(prm[o + 3]);
      k.angle[i] = prm[o + 4];
      k.r[i] = clamp01(prm[o + 5]);
      k.g[i] = clamp01(prm[o + 6]);
      k.b[i] = clamp01(prm[o + 7]);
      k.a[i] = sigmoid(prm[o + 8]);
    }
    out.keys.push(k);
  };

  const b1 = 0.9;
  const b2 = 0.999;
  const minS = Math.log(0.35);
  const maxS = Math.log(Math.max(w, h) / 4);
  for (let step = 0; step <= steps; step++) {
    const loss = pass(step < steps);
    if (keys.includes(step)) keep(step, loss);
    if (step === steps) break;
    // Adam, with the position's rate easing down as the picture settles.
    const decay = 0.15 + 0.85 * Math.pow(1 - step / steps, 2);
    const c1 = 1 - Math.pow(b1, step + 1);
    const c2 = 1 - Math.pow(b2, step + 1);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < NP; j++) {
        const o = i * NP + j;
        const gr = grad[o];
        m1[o] = b1 * m1[o] + (1 - b1) * gr;
        m2[o] = b2 * m2[o] + (1 - b2) * gr * gr;
        const lr = LR[j] * (j < 2 ? decay : 1);
        prm[o] -= (lr * (m1[o] / c1)) / (Math.sqrt(m2[o] / c2) + 1e-8);
      }
      const o = i * NP;
      prm[o] = Math.max(0, Math.min(w, prm[o]));
      prm[o + 1] = Math.max(0, Math.min(h, prm[o + 1]));
      prm[o + 2] = Math.max(minS, Math.min(maxS, prm[o + 2]));
      prm[o + 3] = Math.max(minS, Math.min(maxS, prm[o + 3]));
      for (let j = 5; j < 8; j++) prm[o + j] = Math.max(-0.1, Math.min(1.1, prm[o + j]));
      prm[o + 8] = Math.max(-6, Math.min(6, prm[o + 8]));
    }
    if (onProgress && step % 10 === 0) onProgress(step / steps, loss);
  }
  out.render = () => {
    pass(false);
    return { color: outC.slice(), T: outT.slice() };
  };
  return out;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
