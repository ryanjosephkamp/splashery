// A model's soft boundary can put the object's edge pixels on intermediate
// depths, stretching them into a rim. Extend stable depths to the photo's color
// boundary from each side separately. Interior slopes and color pixels stay intact.
export function photoEdgeGuide(photo, w, h) {
  const rgb = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(photo.w - 1, Math.floor(((x + 0.5) * photo.w) / w));
      const sy = Math.min(photo.h - 1, Math.floor(((y + 0.5) * photo.h) / h));
      const p = (sy * photo.w + sx) * 4;
      for (let k = 0; k < 3; k++) rgb[(y * w + x) * 3 + k] = photo.data[p + k] / 255;
    }
  return rgb;
}

export function prepareDepthEdges(rgb, w, h, radius) {
  radius = Math.max(2, Math.min(24, Math.ceil(radius)));
  const n = w * h;
  const links = new Uint8Array(n);
  const distance = new Uint8Array(n).fill(255);
  const queue = new Int32Array(n);
  let tail = 0;
  const colorDistance = (i, j) => {
    let d = 0;
    for (let k = 0; k < 3; k++) d += (rgb[i * 3 + k] - rgb[j * 3 + k]) ** 2;
    return d;
  };
  const edge = (i) => {
    if (distance[i] === 255) {
      distance[i] = 0;
      queue[tail++] = i;
    }
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x + 1 < w) {
        if (colorDistance(i, i + 1) < 0.14 ** 2) links[i] |= 1;
        else {
          edge(i);
          edge(i + 1);
        }
      }
      if (y + 1 < h) {
        if (colorDistance(i, i + w) < 0.14 ** 2) links[i] |= 2;
        else {
          edge(i);
          edge(i + w);
        }
      }
    }
  // Distance from a visible color boundary. The radius follows model texels,
  // rather than changing with the display budget or the photo's pixel count.
  for (let head = 0; head < tail; head++) {
    const i = queue[head],
      d = distance[i] + 1;
    if (d >= radius) continue;
    const push = (j) => {
      if (distance[j] > d) {
        distance[j] = d;
        queue[tail++] = j;
      }
    };
    if (i % w) push(i - 1);
    if ((i % w) + 1 < w) push(i + 1);
    if (i >= w) push(i - w);
    if (i + w < n) push(i + w);
  }
  const donor = new Int32Array(n).fill(-1);
  tail = 0;
  for (let i = 0; i < n; i++)
    if (distance[i] >= radius - 1) {
      donor[i] = i;
      queue[tail++] = i;
    }
  for (let head = 0; head < tail; head++) {
    const i = queue[head];
    const push = (j) => {
      if (donor[j] < 0 && colorDistance(j, donor[i]) < 0.18 ** 2) {
        donor[j] = donor[i];
        queue[tail++] = j;
      }
    };
    if (i % w && links[i - 1] & 1) push(i - 1);
    if (links[i] & 1) push(i + 1);
    if (i >= w && links[i - w] & 2) push(i - w);
    if (links[i] & 2) push(i + w);
  }
  return { rgb, w, h, radius, links, donor };
}

export function refineDepthEdges(depth, rgb, w, h, radius, prepared = null) {
  radius = Math.max(2, Math.min(24, Math.ceil(radius)));
  const n = w * h;
  const base =
    prepared?.rgb === rgb && prepared.w === w && prepared.h === h && prepared.radius === radius
      ? prepared
      : prepareDepthEdges(rgb, w, h, radius);
  const { links, donor } = base;
  const queue = new Int32Array(n);
  let tail = 0;
  const target = depth.slice();
  const slope = new Float32Array(n * 2);
  const gradient = (j, step, before, after) => {
    const bit = step === 1 ? 1 : 2;
    const a = before && links[j - step] & bit;
    const b = after && links[j] & bit;
    if (a && b) return (depth[j + step] - depth[j - step]) * 0.5;
    if (a) return depth[j] - depth[j - step];
    if (b) return depth[j + step] - depth[j];
    return 0;
  };
  for (let i = 0; i < n; i++) {
    const j = donor[i];
    // Small depth changes remain smooth. A textured region without an eligible
    // interior donor keeps the model's result instead of borrowing across an edge.
    if (j >= 0 && Math.abs(depth[i] - depth[j]) > 0.03) {
      const x = j % w,
        y = Math.floor(j / w);
      const dx = gradient(j, 1, x > 0, x + 1 < w);
      const dy = gradient(j, w, y > 0, y + 1 < h);
      slope[i * 2] = Math.abs(dx);
      slope[i * 2 + 1] = Math.abs(dy);
      // Extrapolate the interior's tangent, so a painted stripe on a sloping
      // plane cannot turn into a geometric step merely because its color changes.
      target[i] = Math.max(
        0,
        Math.min(1, depth[j] + dx * ((i % w) - x) + dy * (Math.floor(i / w) - y)),
      );
    }
  }
  // A color boundary alone is not evidence of a geometric boundary. Only
  // refine where the two interior continuations disagree across that edge.
  const reach = new Uint8Array(n).fill(255);
  tail = 0;
  const mark = (i) => {
    if (reach[i] === 255) {
      reach[i] = 0;
      queue[tail++] = i;
    }
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      for (let side = 0; side < 2; side++) {
        const j = side === 0 ? (x + 1 < w ? i + 1 : i) : y + 1 < h ? i + w : i;
        if (donor[i] < 0 || donor[j] < 0 || j === i || links[i] & (1 << side)) continue;
        // Tangents from distant donors can diverge on a smooth inflection.
        // Require a real cut or a boundary gradient substantially steeper
        // than both stable interiors, rather than the extrapolation alone.
        const jump = Math.abs(depth[i] - depth[j]);
        const axis = j === i + 1 ? 0 : 1;
        const steep =
          jump > Math.max(0.003, 4 * Math.max(slope[i * 2 + axis], slope[j * 2 + axis]));
        if ((jump > 0.03 || steep) && Math.abs(target[i] - target[j]) > 0.06) {
          mark(i);
          mark(j);
        }
      }
    }
  for (let head = 0; head < tail; head++) {
    const i = queue[head],
      next = reach[i] + 1;
    if (next >= radius) continue;
    const push = (j) => {
      if (reach[j] > next) {
        reach[j] = next;
        queue[tail++] = j;
      }
    };
    if (i % w && links[i - 1] & 1) push(i - 1);
    if (links[i] & 1) push(i + 1);
    if (i >= w && links[i - w] & 2) push(i - w);
    if (links[i] & 2) push(i + w);
  }
  const out = depth.slice();
  for (let i = 0; i < n; i++) if (reach[i] < radius) out[i] = target[i];
  return out;
}
