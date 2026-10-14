// Lane Photo depth: a synthetic portrait for the tests and clips (no photo of a real person goes
// into the repo). A head with glasses, a nose and a collar in front of a far wall, and a depth map
// shaped as a depth model would give it (disparity: higher is nearer), its edges a little soft.

export function portrait(w = 600, h = 800, dw = 294, dh = 392) {
  const data = new Uint8Array(w * h * 4);
  const put = (i, r, g, b) => {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  };
  // shapes in picture units (x across 0..1, y down 0..1)
  const head = (x, y) => ((x - 0.5) / 0.22) ** 2 + ((y - 0.4) / 0.27) ** 2;
  const lens = (x, y, cx) => Math.hypot((x - cx) / 0.075, (y - 0.38) / 0.055);
  const nose = (x, y) => ((x - 0.5) / 0.04) ** 2 + ((y - 0.46) / 0.08) ** 2;
  const body = (x, y) => y > 0.7 && Math.abs(x - 0.5) < 0.2 + (y - 0.7) * 1.4;
  const collar = (x, y) => y > 0.66 && y < 0.78 && Math.abs(x - 0.5) < 0.12 - (y - 0.66) * 0.5;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = i / w;
      const y = j / h;
      const k = (j * w + i) * 4;
      // the wall: stripes and a grid, so a smear of it shows
      let c = [70 + 40 * (Math.floor(x * 14) % 2), 90 + 30 * (Math.floor(y * 10) % 2), 120];
      if (body(x, y)) c = [40, 70, 140];
      if (collar(x, y)) c = [235, 235, 225];
      if (head(x, y) < 1) {
        c = [222, 180, 150];
        if (nose(x, y) < 1) c = [205, 150, 120];
        if (y > 0.53 && y < 0.55 && Math.abs(x - 0.5) < 0.06) c = [150, 60, 60];
        for (const cx of [0.415, 0.585]) {
          const l = lens(x, y, cx);
          if (l > 0.82 && l < 1) c = [20, 20, 25];
          else if (l < 0.82) c = [c[0] * 0.85, c[1] * 0.9, c[2]];
        }
        if (Math.abs(y - 0.38) < 0.006 && Math.abs(x - 0.5) < 0.015) c = [20, 20, 25];
      }
      put(k, c[0], c[1], c[2]);
    }
  const d = new Float32Array(dw * dh);
  for (let j = 0; j < dh; j++)
    for (let i = 0; i < dw; i++) {
      const x = (i + 0.5) / dw;
      const y = (j + 0.5) / dh;
      let v = 2 + 0.3 * y; // the far wall
      if (body(x, y)) v = 9 + 2 * (1 - Math.abs(x - 0.5));
      if (collar(x, y)) v = 11;
      const hd = head(x, y);
      if (hd < 1) {
        v = 12 + 3 * Math.sqrt(1 - hd);
        const n = nose(x, y);
        if (n < 1) v += 2.5 * (1 - n);
        for (const cx of [0.415, 0.585]) if (lens(x, y, cx) < 1) v += 1.2;
      }
      d[j * dw + i] = v;
    }
  // soft edges (the model's output is a little blurred)
  const out = new Float32Array(d.length);
  for (let j = 0; j < dh; j++)
    for (let i = 0; i < dw; i++) {
      let s = 0;
      let n = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const x = Math.min(dw - 1, Math.max(0, i + di));
          const y = Math.min(dh - 1, Math.max(0, j + dj));
          s += d[y * dw + x];
          n++;
        }
      out[j * dw + i] = s / n;
    }
  return { photo: { w, h, data }, depth: { w: dw, h: dh, d: out } };
}
