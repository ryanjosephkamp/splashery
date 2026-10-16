// MIT; made by Ryan with Codex (GPT-6). Keep source locations, colors, and
// membership fixed while projecting them onto the candidate's foreground.
export function followSourceProbes(frozen, field, photo = field) {
  const projection = { invalidEdgeFits: 0, lostThinSupport: 0 };
  const w = field.width,
    h = field.height,
    d = field.data;
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w < 1 ||
    h < 1 ||
    d.length !== w * h ||
    d.some((v) => !Number.isFinite(v) || v < 0 || v > 255)
  )
    throw new Error("Incomplete candidate R8 depth field.");
  if (
    w === frozen.field.width &&
    h === frozen.field.height &&
    d.every((v, i) => v === frozen.field.data[i])
  )
    return { ...frozen, projection };
  const nearest = (u, v) => {
    // Recover the original integer source-pixel centers before scaling, keeping
    // the finder's multiply-then-divide order at exact depth-texel boundaries.
    const x = Math.round(u * photo.width - 0.5) + 0.5,
      y = Math.round(v * photo.height - 0.5) + 0.5;
    return (
      d[
        Math.max(0, Math.min(h - 1, Math.floor((y * h) / photo.height))) * w +
          Math.max(0, Math.min(w - 1, Math.floor((x * w) / photo.width)))
      ] / 255
    );
  };
  const bilinear = (u, v) => {
    const x = Math.max(0, Math.min(w - 1, u * w - 0.5)),
      y = Math.max(0, Math.min(h - 1, v * h - 0.5)),
      ix = Math.floor(x),
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
  const edges = frozen.edges.map((ref) => {
    const du = ref.axis ? 0 : ref.sign / frozen.field.width,
      dv = ref.axis ? ref.sign / frozen.field.height : 0;
    const samples = [];
    for (let t = 2; t <= 8; t++) samples.push([t, bilinear(ref.u - du * t, ref.v - dv * t)]);
    const mean = samples.reduce((sum, p) => sum + p[1], 0) / samples.length,
      slope = samples.reduce((sum, [t, z]) => sum + (t - 5) * (z - mean), 0) / 28,
      center = mean - slope * 5,
      residual = Math.max(...samples.map(([t, z]) => Math.abs(z - center - slope * t)));
    // Same continuation-confidence limit as the original source-anchor finder.
    // Keep the probe and expose lost confidence instead of silently dropping it.
    if (residual > 0.0075 || center < 0 || center > 1) projection.invalidEdgeFits++;
    return {
      ...ref,
      residual,
      profile: ref.profile.map((p, i) => ({ ...p, depth: center - slope * (i - 8) })),
    };
  });
  const thin = frozen.thin.anchors.map((ref) => {
    let depth = 0;
    // Original profiles contain seven source pixels of background at either end,
    // in half-pixel steps; the middle samples are the unchanged source line.
    for (let i = 14; i <= ref.profile.length - 15; i += 2)
      depth = Math.max(depth, nearest(ref.profile[i].u, ref.profile[i].v));
    const left = ref.profile[0],
      right = ref.profile.at(-1);
    if (depth - Math.max(nearest(left.u, left.v), nearest(right.u, right.v)) < 0.02)
      projection.lostThinSupport++;
    return { ...ref, profile: ref.profile.map((p) => ({ ...p, depth })) };
  });
  return { ...frozen, edges, thin: { ...frozen.thin, anchors: thin }, projection };
}
