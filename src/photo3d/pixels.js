// Small source-pixel operations shared by geometry and inference. Importing
// these does not load geometry, background synthesis, or a model runtime.
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Depth-model input size: the long side (a multiple of 14 for the ViT), the short side keeps the shape.
export function modelSize(w, h, long = 518) {
  const s = long / Math.max(w, h);
  const m = (v) => Math.max(14, Math.round((v * s) / 14) * 14);
  return { dw: m(w), dh: m(h) };
}

// Shrinks or enlarges a photo's colors to gw x gh by box averaging (exact coverage of each
// target cell, so no aliasing), returning sRGB floats 0..1 (3 per cell).
export function resampleArea(photo, gw, gh) {
  const { w, h, data } = photo;
  const axis = (n, g) => {
    // for each target index: source start, weights
    const out = [];
    const r = n / g;
    for (let i = 0; i < g; i++) {
      const a = i * r;
      const b = (i + 1) * r;
      if (r <= 1) {
        // enlarging: linear between the two nearest source pixels
        const c = clamp((a + b) / 2 - 0.5, 0, n - 1);
        const i0 = Math.floor(c);
        const i1 = Math.min(n - 1, i0 + 1);
        const t = c - i0;
        out.push({ s: i0, w: i1 === i0 ? [1] : [1 - t, t] });
      } else {
        const s = Math.floor(a);
        const e = Math.min(n, Math.ceil(b));
        const ws = [];
        for (let k = s; k < e; k++) ws.push(Math.min(b, k + 1) - Math.max(a, k));
        const tot = ws.reduce((x, y) => x + y, 0);
        out.push({ s, w: ws.map((x) => x / tot) });
      }
    }
    return out;
  };
  const ax = axis(w, gw);
  const ay = axis(h, gh);
  // horizontal pass: gw x h, three channels (alpha is ignored: a photo is opaque)
  const mid = new Float32Array(gw * h * 3);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let i = 0; i < gw; i++) {
      const { s, w: ws } = ax[i];
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < ws.length; k++) {
        const p = (row + s + k) * 4;
        r += data[p] * ws[k];
        g += data[p + 1] * ws[k];
        b += data[p + 2] * ws[k];
      }
      const q = (y * gw + i) * 3;
      mid[q] = r;
      mid[q + 1] = g;
      mid[q + 2] = b;
    }
  }
  const out = new Float32Array(gw * gh * 3);
  for (let j = 0; j < gh; j++) {
    const { s, w: ws } = ay[j];
    for (let i = 0; i < gw; i++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < ws.length; k++) {
        const p = ((s + k) * gw + i) * 3;
        r += mid[p] * ws[k];
        g += mid[p + 1] * ws[k];
        b += mid[p + 2] * ws[k];
      }
      const q = (j * gw + i) * 3;
      out[q] = r / 255;
      out[q + 1] = g / 255;
      out[q + 2] = b / 255;
    }
  }
  return out;
}
