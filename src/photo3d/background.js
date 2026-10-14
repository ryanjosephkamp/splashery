// Task 39: a second depth/color image behind the photographed surface. Background
// pixels are copied, never averaged with foreground pixels. The nearest eligible
// far-side donor preserves edges; the unknown scene is still an inference.

// Rectangular minimum in O(w*h), independent of the fill radius.
export function minimumField(input, w, h, rx, ry = rx) {
  const mid = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const q = new Int32Array(Math.max(w, h));
  const pass = (src, dst, lines, length, radius, stride, lineStride) => {
    for (let l = 0; l < lines; l++) {
      const base = l * lineStride;
      let head = 0,
        tail = 0,
        next = 0;
      for (let i = 0; i < length; i++) {
        const end = Math.min(length - 1, i + radius);
        while (next <= end) {
          const v = src[base + next * stride];
          while (tail > head && src[base + q[tail - 1] * stride] >= v) tail--;
          q[tail++] = next++;
        }
        while (head < tail && q[head] < i - radius) head++;
        dst[base + i * stride] = src[base + q[head] * stride];
      }
    }
  };
  pass(input, mid, h, w, rx, 1, w);
  pass(mid, out, w, h, ry, w, 1);
  return out;
}

export function planarDepth(d, w, h) {
  // Least-squares plane: a screen or a sheet can tilt, but cannot tear into bands.
  let mean = 0,
    sx = 0,
    sy = 0,
    xx = 0,
    yy = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w - 0.5,
        v = (y + 0.5) / h - 0.5;
      const z = d[y * w + x];
      mean += z;
      sx += u * z;
      sy += v * z;
      xx += u * u;
      yy += v * v;
    }
  mean /= d.length;
  const out = new Float32Array(d.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      out[y * w + x] =
        mean +
        (xx ? sx / xx : 0) * ((x + 0.5) / w - 0.5) +
        (yy ? sy / yy : 0) * ((y + 0.5) / h - 0.5);
  return out;
}

// Match the textured relief's quiet outer border. This changes positions only,
// not the photo, the depth model, or the connected pieces in the interior.
export function softenDepth(d, w, h, aspect = w / h) {
  const mid = new Float32Array(d.length),
    out = new Float32Array(d.length);
  const pass = (src, dst, length, lines, stride, lineStride, step) => {
    const first = new Int32Array(length * 5),
      next = new Int32Array(length * 5),
      fraction = new Float64Array(length * 5);
    for (let i = 0; i < length; i++)
      for (let j = -2; j <= 2; j++) {
        const p = Math.max(0, Math.min(length - 1, i + j * step)),
          a = Math.floor(p),
          k = i * 5 + j + 2;
        first[k] = a * stride;
        next[k] = Math.min(length - 1, a + 1) * stride;
        fraction[k] = p - a;
      }
    for (let l = 0; l < lines; l++) {
      const base = l * lineStride;
      for (let i = 0; i < length; i++) {
        let sum = 0;
        for (let j = 0; j < 5; j++) {
          const k = i * 5 + j,
            f = fraction[k];
          sum += src[base + first[k]] * (1 - f) + src[base + next[k]] * f;
        }
        dst[base + i * stride] = sum / 5;
      }
    }
  };
  pass(d, mid, w, h, 1, w, (0.02 * w) / aspect);
  pass(mid, out, h, w, w, 1, 0.02 * h);
  return out;
}

export function rimDepth(d, w, h, cells, softened = null) {
  const f = Math.min(1, Math.sqrt(cells / (w * h)));
  const cols = Math.max(8, Math.round(w * f)),
    rows = Math.max(8, Math.round(h * f));
  const out = d.slice();
  const sample = (u, v) => {
    const x = Math.min(w - 1, Math.max(0, u * w - 0.5)),
      y = Math.min(h - 1, Math.max(0, v * h - 0.5));
    const i = Math.floor(x),
      j = Math.floor(y),
      a = x - i,
      b = y - j;
    const i1 = Math.min(w - 1, i + 1),
      j1 = Math.min(h - 1, j + 1);
    return (
      (d[j * w + i] * (1 - a) + d[j * w + i1] * a) * (1 - b) +
      (d[j1 * w + i] * (1 - a) + d[j1 * w + i1] * a) * b
    );
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w,
        v = (y + 0.5) / h;
      const rd = Math.min(u * cols, (1 - u) * cols, v * rows, (1 - v) * rows);
      if (rd >= 6) continue;
      let soft = softened?.[y * w + x];
      if (soft === undefined) {
        soft = 0;
        for (let j = -2; j <= 2; j++)
          for (let i = -2; i <= 2; i++) soft += sample(u + (i * 0.02 * h) / w, v + j * 0.02);
        soft /= 25;
      }
      const t = Math.max(0, Math.min(1, (rd - 2) / 4));
      const keep = t * t * (3 - 2 * t);
      out[y * w + x] = soft * (1 - keep) + d[y * w + x] * keep;
    }
  return out;
}

export function backgroundImage(photo, d, gx, gy, relief, pieces) {
  const f = Math.min(1, 320 / Math.max(photo.w, photo.h));
  const w = Math.max(2, Math.round(photo.w * f)),
    h = Math.max(2, Math.round(photo.h * f));
  const n = w * h;
  const original = new Float32Array(n);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c =
        Math.min(gy - 1, Math.floor(((y + 0.5) * gy) / h)) * gx +
        Math.min(gx - 1, Math.floor(((x + 0.5) * gx) / w));
      original[y * w + x] = d[c];
    }
  // Reach covers the disparity exposed at 30 degrees, plus two source cells.
  const reach = Math.min(0.5, 0.02 + relief * Math.tan(Math.PI / 6));
  const radius = Math.max(2, Math.ceil(reach * h));
  const depth = minimumField(original, w, h, radius);
  // A far-side boundary pixel can contain the source photo's own edge
  // antialiasing. Repeating it across a disocclusion turns that one pixel
  // into a colored ribbon. Prefer donors whose surrounding two cells are
  // also far, preserving the original boundary wherever it is visible.
  const farInterior = minimumField(
    Float32Array.from(original, (v) => -v),
    w,
    h,
    2,
  );
  const donor = new Int32Array(n);
  const nearest = new Int32Array(n);
  const queue = new Int32Array(n);
  const bins = 32;
  for (let b = 0; b < bins; b++) {
    nearest.fill(-1);
    let tail = 0;
    const limit = (b + 1) / bins;
    for (let i = 0; i < n; i++)
      if (original[i] <= limit) {
        nearest[i] = i;
        queue[tail++] = i;
      }
    for (let head = 0; head < tail; head++) {
      const i = queue[head];
      const push = (k) => {
        if (nearest[k] < 0) {
          nearest[k] = nearest[i];
          queue[tail++] = k;
        }
      };
      if (i % w) push(i - 1);
      if ((i % w) + 1 < w) push(i + 1);
      if (i >= w) push(i - w);
      if (i + w < n) push(i + w);
    }
    for (let i = 0; i < n; i++)
      if (Math.min(bins - 1, Math.floor(depth[i] * bins)) === b) {
        let k = original[i] - depth[i] < 0.03 || nearest[i] < 0 ? i : nearest[i];
        if (k !== i && -farInterior[k] > limit) {
          const x = k % w,
            y = Math.floor(k / w),
            targetX = i % w,
            targetY = Math.floor(i / w);
          let distance = Infinity,
            interior = -1;
          // Stay within two cells of the closest eligible donor. An
          // accepted interior's whole two-cell neighborhood is eligible,
          // so it is connected to that donor; distant far components can
          // never replace a narrow nearby patch with a different color.
          for (let dy = -2; dy <= 2; dy++)
            for (let dx = -2; dx <= 2; dx++) {
              const sx = x + dx,
                sy = y + dy;
              if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
              const q = sy * w + sx;
              if (-farInterior[q] > limit) continue;
              const delta = Math.abs(sx - targetX) + Math.abs(sy - targetY);
              if (delta < distance) {
                distance = delta;
                interior = q;
              }
            }
          if (interior >= 0) k = interior;
        }
        donor[i] = k;
      }
  }
  const rgba = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const edge = Math.min(
      ((i % w) + 0.5) / h,
      (w - (i % w) - 0.5) / h,
      (Math.floor(i / w) + 0.5) / h,
      (h - Math.floor(i / w) - 0.5) / h,
    );
    if (edge < 0.035) donor[i] = i; // the closing rim keeps the picture's own border
    const k = donor[i];
    const x = Math.min(photo.w - 1, Math.floor((((k % w) + 0.5) * photo.w) / w));
    const y = Math.min(photo.h - 1, Math.floor(((Math.floor(k / w) + 0.5) * photo.h) / h));
    const p = (y * photo.w + x) * 4;
    rgba.set(photo.data.subarray(p, p + 4), i * 4);
    rgba[i * 4 + 3] = 255;
  }
  return { w, h, depth, rgba, donor, reach };
}
