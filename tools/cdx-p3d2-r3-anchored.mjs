// Edge profiles anchored to the source photo, independently of rendered UVs
// and inferred background colors. Only locally stable, high-contrast edges
// with a well-fitting interior depth continuation are evaluated.
export function colorAtR3(photo, x, y) {
  x = Math.max(0, Math.min(photo.width - 1, x));
  y = Math.max(0, Math.min(photo.height - 1, y));
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy;
  const out = [0, 0, 0];
  for (let dy = 0; dy < 2; dy++)
    for (let dx = 0; dx < 2; dx++) {
      const p =
        (Math.min(photo.height - 1, iy + dy) * photo.width + Math.min(photo.width - 1, ix + dx)) *
        4;
      const q = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
      for (let c = 0; c < 3; c++) out[c] += photo.data[p + c] * q;
    }
  return out;
}
const distance = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
export function sourceAnchorsR3(photo, field) {
  const { width: w, height: h, data: d } = field,
    anchors = [];
  let candidates = 0,
    colorRejected = 0,
    depthRejected = 0,
    borderRejected = 0;
  const rgb = (u, v) => colorAtR3(photo, u * photo.width - 0.5, v * photo.height - 0.5);
  const depthAt = (u, v) => {
    const x = Math.max(0, Math.min(w - 1, u * w - 0.5)),
      y = Math.max(0, Math.min(h - 1, v * h - 0.5));
    const ix = Math.floor(x),
      iy = Math.floor(y),
      fx = x - ix,
      fy = y - iy;
    return (
      ((d[iy * w + ix] * (1 - fx) + d[iy * w + Math.min(w - 1, ix + 1)] * fx) * (1 - fy) +
        (d[Math.min(h - 1, iy + 1) * w + ix] * (1 - fx) +
          d[Math.min(h - 1, iy + 1) * w + Math.min(w - 1, ix + 1)] * fx) *
          fy) /
      255
    );
  };
  for (let y = 9; y < h - 9; y++)
    for (let x = 9; x < w - 9; x++)
      for (let axis = 0; axis < 2; axis++) {
        const a = y * w + x,
          b = a + (axis ? w : 1);
        if (Math.abs(d[a] - d[b]) < 255 * 0.03) continue;
        candidates++;
        const sign = d[a] > d[b] ? 1 : -1,
          du = axis ? 0 : sign / w,
          dv = axis ? sign / h : 0;
        let u = (x + (axis ? 0.5 : 1)) / w,
          v = (y + (axis ? 1 : 0.5)) / h;
        if (Math.min(u, v, 1 - u, 1 - v) < 0.04) {
          borderRejected++;
          continue;
        }
        const pixel = axis ? 1 / photo.height : 1 / photo.width;
        let best = 0,
          shift = 0;
        for (let t = -1; t <= 1; t += pixel / (axis ? 1 / h : 1 / w)) {
          const q = distance(
            rgb(u + du * t - du * 0.25, v + dv * t - dv * 0.25),
            rgb(u + du * t + du * 0.25, v + dv * t + dv * 0.25),
          );
          if (q > best) {
            best = q;
            shift = t;
          }
        }
        u += du * shift;
        v += dv * shift;
        const near = rgb(u - du * 4, v - dv * 4),
          far = rgb(u + du * 4, v + dv * 4);
        const contrast = distance(near, far);
        if (
          best < 48 ||
          contrast < 64 ||
          [2, 3, 5, 6, 7, 8].some(
            (t) =>
              distance(rgb(u - du * t, v - dv * t), near) > 24 ||
              distance(rgb(u + du * t, v + dv * t), far) > 24,
          )
        ) {
          colorRejected++;
          continue;
        }
        const samples = [];
        for (let t = 2; t <= 8; t++) {
          samples.push([t, depthAt(u - du * t, v - dv * t)]);
        }
        const mean = samples.reduce((s, p) => s + p[1], 0) / samples.length;
        const slope = samples.reduce((s, [t, z]) => s + (t - 5) * (z - mean), 0) / 28;
        const center = mean - slope * 5;
        const residual = Math.max(...samples.map(([t, z]) => Math.abs(z - center - slope * t)));
        if (residual > 0.0075 || center < 0 || center > 1) {
          depthRejected++;
          continue;
        }
        const profile = [];
        for (let t = -8; t <= 8; t++)
          profile.push({
            u: u + du * t,
            v: v + dv * t,
            depth: center - slope * t,
            rgb: rgb(u + du * t, v + dv * t),
          });
        anchors.push({ u, v, axis, sign, contrast, near, far, residual, profile });
      }
  return {
    candidates,
    colorRejected,
    depthRejected,
    borderRejected,
    evaluated: anchors.length,
    anchors,
  };
}

export function anchoredEdgesR3(actual, projected, anchors, sourcePhoto) {
  if (!sourcePhoto)
    throw new Error("The original source photo is required for dense edge profiles.");
  let sum = 0,
    n = 0,
    excess = 0,
    maximum = 0,
    worst = null,
    evaluated = 0;
  const errors = [],
    displacements = [],
    widths = [];
  for (let i = 0; i < anchors.length; i++) {
    const coarse = projected[i],
      ref = anchors[i];
    if (coarse.some(([x, y]) => x < 1 || y < 1 || x >= actual.width - 1 || y >= actual.height - 1))
      continue;
    const points = [],
      sourceColors = [];
    // <=0.5 drawing-buffer pixels between samples. Read original source
    // texels at each corresponding UV; interpolating sparse RGB samples
    // would invent a wider source transition. Perspective weights retain
    // the source plane's projective mapping between projected endpoints.
    for (let j = 0; j < coarse.length - 1; j++) {
      const a = coarse[j],
        b = coarse[j + 1],
        steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
      for (let k = 0; k < steps; k++) {
        const f = k / steps,
          w0 = a[2] ?? 1,
          w1 = b[2] ?? 1,
          t = (f * w0) / (w1 * (1 - f) + f * w0);
        const p = ref.profile[j],
          q = ref.profile[j + 1],
          u = p.u + (q.u - p.u) * t,
          v = p.v + (q.v - p.v) * t;
        points.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
        sourceColors.push(
          colorAtR3(sourcePhoto, u * sourcePhoto.width - 0.5, v * sourcePhoto.height - 0.5),
        );
      }
    }
    points.push(coarse.at(-1));
    const last = ref.profile.at(-1);
    sourceColors.push(
      colorAtR3(sourcePhoto, last.u * sourcePhoto.width - 0.5, last.v * sourcePhoto.height - 0.5),
    );
    let error = 0,
      localExcess = 0;
    const lo = [0, 1, 2].map((c) => Math.min(...sourceColors.map((p) => p[c])));
    const hi = [0, 1, 2].map((c) => Math.max(...sourceColors.map((p) => p[c])));
    const actualColors = [];
    for (let j = 0; j < points.length; j++) {
      const color = colorAtR3(actual, points[j][0] - 0.5, points[j][1] - 0.5);
      actualColors.push(color);
      for (let c = 0; c < 3; c++) {
        error += Math.abs(color[c] - sourceColors[j][c]) / 3;
        localExcess += Math.max(0, lo[c] - color[c] - 2, color[c] - hi[c] - 2) / 3;
      }
    }
    error /= points.length;
    localExcess /= points.length;
    sum += error;
    n++;
    excess += localExcess;
    evaluated++;
    errors.push(error / 255);
    const direction = ref.far.map((v, c) => v - ref.near[c]);
    const norm = direction.reduce((s, v) => s + v * v, 0);
    const progression = (color) =>
      color.reduce((s, v, c) => s + (v - ref.near[c]) * direction[c], 0) / norm;
    const arc = [0];
    for (let j = 1; j < points.length; j++)
      arc.push(
        arc[j - 1] + Math.hypot(points[j][0] - points[j - 1][0], points[j][1] - points[j - 1][1]),
      );
    const crossing = (colors, level) => {
      const values = colors.map(progression),
        hits = [];
      for (let j = 1; j < values.length; j++)
        if (values[j - 1] <= level && values[j] > level) {
          const t = (level - values[j - 1]) / (values[j] - values[j - 1]);
          hits.push({
            distance: arc[j - 1] + t * (arc[j] - arc[j - 1]),
            offset: Math.abs(arc[j - 1] + t * (arc[j] - arc[j - 1]) - arc.at(-1) / 2),
          });
        }
      return hits.sort((a, b) => a.offset - b.offset)[0]?.distance;
    };
    const a20 = crossing(actualColors, 0.2),
      a50 = crossing(actualColors, 0.5),
      a80 = crossing(actualColors, 0.8);
    const s20 = crossing(sourceColors, 0.2),
      s50 = crossing(sourceColors, 0.5),
      s80 = crossing(sourceColors, 0.8);
    if ([a20, a50, a80, s20, s50, s80].every(Number.isFinite)) {
      displacements.push(Math.abs(a50 - s50));
      widths.push(Math.max(0, a80 - a20 - (s80 - s20)));
    }
    if (error > maximum) {
      maximum = error;
      worst = {
        anchor: i,
        source: [ref.u, ref.v],
        screen: coarse[8],
        error: error / 255,
        excess: localExcess / 255,
      };
    }
  }
  errors.sort((a, b) => a - b);
  displacements.sort((a, b) => a - b);
  widths.sort((a, b) => a - b);
  const mean = (values) =>
    values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
  const p95 = (values) => (values.length ? values[Math.floor((values.length - 1) * 0.95)] : null);
  return {
    anchoredProfiles: evaluated,
    anchoredMAE: n ? sum / (255 * n) : null,
    anchoredP95: n ? errors[Math.floor((n - 1) * 0.95)] : null,
    anchoredMax: n ? maximum / 255 : null,
    anchoredExcess: n ? excess / (255 * n) : null,
    transitionProfiles: widths.length,
    missingTransitionProfiles: evaluated - widths.length,
    distanceUnits: "drawing-buffer pixels",
    edgeDisplacementMean: mean(displacements),
    edgeDisplacementP95: p95(displacements),
    edgeDisplacementMax: displacements.at(-1) ?? null,
    transitionWidthExcessMean: mean(widths),
    transitionWidthExcessP95: p95(widths),
    transitionWidthExcessMax: widths.at(-1) ?? null,
    worstProfile: worst,
  };
}
