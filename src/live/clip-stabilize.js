// Temporal depth processing shared by opened clips, samples, and long videos.
// Colors are RGBA on the depth grid. Input depth and color buffers stay
// unchanged; explicitly supplied state holds the temporal history.
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export function colorDistance(a, b, i) {
  if (!a || !b) return 0;
  const o = i * 4;
  return ((a[o] - b[o]) ** 2 + (a[o + 1] - b[o + 1]) ** 2 + (a[o + 2] - b[o + 2]) ** 2) / 3;
}

// Fit reference = scale * current + shift on still pixels. A uniform map
// has no identifiable scale, so two uniform regions use only their mean shift.
// Insufficient overlap or a scene cut leaves the map alone.
export function alignDepth(current, reference, colors, previousColors) {
  const out = Float32Array.from(current);
  if (!reference || reference.length !== current.length) return out;
  let n = 0,
    sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0,
    syy = 0;
  for (let i = 0; i < current.length; i++) {
    if (colorDistance(colors, previousColors, i) > 64) continue;
    const x = current[i],
      y = reference[i];
    n++;
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
    syy += y * y;
  }
  if (n < Math.max(8, current.length * 0.03)) return out;
  const vx = sxx - (sx * sx) / n,
    vy = syy - (sy * sy) / n;
  const cov = sxy - (sx * sy) / n;
  if (vx < 1e-9 || vy < 1e-9) {
    if (vx < 1e-9 && vy < 1e-9) {
      const shift = (sy - sx) / n;
      for (let i = 0; i < out.length; i++) out[i] += shift;
    }
    return out;
  }
  if (cov <= 0 || cov * cov < 0.35 * vx * vy) return out;
  const scale = clamp(cov / vx, 0.25, 4);
  const shift = (sy - scale * sx) / n;
  for (let i = 0; i < out.length; i++) out[i] = current[i] * scale + shift;
  return out;
}

export function depthRange(list) {
  const count = list.reduce(
    (sum, d) => sum + Math.ceil(d.length / Math.max(1, Math.floor(d.length / 2048))),
    0,
  );
  const values = new Float32Array(count);
  let at = 0;
  for (const d of list) {
    const step = Math.max(1, Math.floor(d.length / 2048));
    for (let i = 0; i < d.length; i += step) values[at++] = d[i];
  }
  values.sort();
  return [
    values[Math.floor((values.length - 1) * 0.02)] ?? 0,
    values[Math.floor((values.length - 1) * 0.98)] ?? 1,
  ];
}

// Shared tangents account for unequal answer gaps; equal gaps give Catmull-Rom.
// Limit overshoot so a cut cannot create a new near/far surface.
export function cubicDepth(a, b, c, d, t, before = 1, span = 1, after = 1) {
  const left = ((c - a) * span) / Math.max(1e-6, before + span);
  const right = ((d - b) * span) / Math.max(1e-6, span + after);
  const t2 = t * t,
    t3 = t2 * t;
  const v =
    (2 * t3 - 3 * t2 + 1) * b +
    (t3 - 2 * t2 + t) * left +
    (-2 * t3 + 3 * t2) * c +
    (t3 - t2) * right;
  return clamp(v, Math.min(b, c), Math.max(b, c));
}

// A symmetric seven-frame window has no causal delay. Color differences
// reject moving surfaces; large depth differences reject disocclusions.
const weights = Float32Array.from({ length: 1025 }, (_, i) => Math.exp(-i / 72));
export function filterDepths(list, colors, radius = 3) {
  return list.map((d, f) => {
    const out = new Float32Array(d.length);
    const first = Math.max(0, f - radius),
      last = Math.min(list.length - 1, f + radius);
    for (let i = 0; i < d.length; i++) {
      let sum = 0,
        count = 0;
      for (let j = first; j <= last; j++) {
        const cd = colorDistance(colors?.[f], colors?.[j], i);
        const delta = Math.abs(list[j][i] - d[i]);
        const weight =
          cd > 1024 || delta > 0.2 ? 0 : weights[cd | 0] * (radius + 1 - Math.abs(j - f));
        sum += list[j][i] * weight;
        count += weight;
      }
      out[i] = sum / count;
    }
    return out;
  });
}

// Sliding 5x5 extrema in two passes (ten comparisons rather than 25).
// Keep their pixel indices, so the cut can choose its side by color.
export function stableEdges(d, w, h, colors = null, state = null) {
  const size = d.length;
  const lows = state?.lows?.length === size ? state.lows : new Int32Array(size),
    highs = state?.highs?.length === size ? state.highs : new Int32Array(size);
  if (state) {
    state.lows = lows;
    state.highs = highs;
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      let lo = k,
        hi = k;
      let lowValue = d[k],
        highValue = lowValue;
      for (let xx = Math.max(0, x - 2); xx <= Math.min(w - 1, x + 2); xx++) {
        const q = y * w + xx;
        const value = d[q];
        if (value < lowValue) {
          lo = q;
          lowValue = value;
        }
        if (value > highValue) {
          hi = q;
          highValue = value;
        }
      }
      lows[k] = lo;
      highs[k] = hi;
    }
  const out = new Float32Array(size);
  if (state && state.side?.length !== size) {
    state.side = new Int8Array(size).fill(-1);
    state.pending = new Uint8Array(size);
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      let lo = lows[k],
        hi = highs[k];
      let lowValue = d[lo],
        highValue = d[hi];
      for (let yy = Math.max(0, y - 2); yy <= Math.min(h - 1, y + 2); yy++) {
        const q = yy * w + x;
        const low = lows[q],
          high = highs[q],
          a = d[low],
          b = d[high];
        if (a < lowValue) {
          lo = low;
          lowValue = a;
        }
        if (b > highValue) {
          hi = high;
          highValue = b;
        }
      }
      const span = highValue - lowValue;
      if (span <= 0.15) {
        out[k] = d[k];
        if (state) {
          state.side[k] = -1;
          state.pending[k] = 0;
        }
        continue;
      }
      let side = d[k] - lowValue < highValue - d[k] ? 0 : 1;
      if (colors) {
        const o = k * 4;
        let far = 0,
          near = 0;
        for (let c = 0; c < 3; c++) {
          far += (colors[o + c] - colors[lo * 4 + c]) ** 2;
          near += (colors[o + c] - colors[hi * 4 + c]) ** 2;
        }
        if (Math.abs(far - near) > 3 * 12 ** 2) side = near < far ? 1 : 0;
      }
      if (state) {
        const old = state.side[k];
        if (old >= 0 && old !== side && colorDistance(colors, state.colors, k) <= 64) {
          state.pending[k]++;
          if (state.pending[k] < 3) side = old;
          else state.pending[k] = 0;
        } else state.pending[k] = 0;
        state.side[k] = side;
      }
      out[k] = side ? highValue : lowValue;
    }
  if (state) state.colors = colors;
  return out;
}

// Bounded causal state for long videos. Range and relief scale seed from
// the first answers; afterward the range only widens, slowly, never contracts.
export function streamDepth(state, raw, colors, reliefScale) {
  const aligned = alignDepth(raw, state.aligned, colors, state.colors);
  const [lo, hi] = depthRange([aligned]);
  state.count = (state.count || 0) + 1;
  if (state.lo === undefined) {
    state.lo = lo;
    state.hi = hi;
  } else {
    const ease = state.count <= 4 ? 0.5 : 0.01;
    state.lo += Math.min(0, lo - state.lo) * ease;
    state.hi += Math.max(0, hi - state.hi) * ease;
  }
  if (state.count <= 4) state.scale = reliefScale(state.lo, state.hi);
  const span = Math.max(1e-6, state.hi - state.lo);
  const out = new Float32Array(raw.length);
  for (let i = 0; i < out.length; i++) {
    const v = 0.5 + (clamp((aligned[i] - state.lo) / span) - 0.5) * state.scale;
    const previous = state.smooth?.[i];
    const still = colorDistance(colors, state.colors, i) <= 64;
    out[i] =
      previous !== undefined && still && Math.abs(v - previous) < 0.12
        ? previous + (v - previous) * 0.12
        : v;
  }
  state.aligned = aligned;
  state.colors = colors;
  state.smooth = out;
  return out;
}
