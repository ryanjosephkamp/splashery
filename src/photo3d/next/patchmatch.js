// MIT; made by Ryan with Codex (GPT-6). Research candidate, not a shipping default.
// PatchMatch-style propagation and shrinking random search. Every output color is
// copied from this photo; foreground pixels never enter a target's patch context.
import { minimumField } from "../background.js";

export function patchMatchBackground(
  photo,
  build,
  { passes = 3, radius = 2, seed = 99, coherent = false } = {},
) {
  const b = build.background,
    { w, h } = b,
    n = w * h;
  const original = new Float32Array(n),
    rgb = new Uint8Array(n * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      original[i] =
        build.depth[
          Math.min(build.gy - 1, Math.floor(((y + 0.5) * build.gy) / h)) * build.gx +
            Math.min(build.gx - 1, Math.floor(((x + 0.5) * build.gx) / w))
        ];
      const p =
        (Math.min(photo.h - 1, Math.floor(((y + 0.5) * photo.h) / h)) * photo.w +
          Math.min(photo.w - 1, Math.floor(((x + 0.5) * photo.w) / w))) *
        4;
      rgb.set(photo.data.subarray(p, p + 4), i * 4);
    }
  const maxDepth = minimumField(
    Float32Array.from(original, (x) => -x),
    w,
    h,
    radius,
  );
  const donor = Int32Array.from(b.donor),
    filled = new Uint8Array(n),
    scores = new Float64Array(n).fill(Infinity);
  let state = seed >>> 0;
  const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
  const eligible = (q, limit) =>
    q >= 0 &&
    q < n &&
    q % w >= radius &&
    q % w < w - radius &&
    Math.floor(q / w) >= radius &&
    Math.floor(q / w) < h - radius &&
    -maxDepth[q] <= limit;
  const score = (i, q) => {
    const limit = b.depth[i] + 0.03;
    if (!eligible(q, limit)) return Infinity;
    const ix = i % w,
      iy = Math.floor(i / w),
      qx = q % w,
      qy = Math.floor(q / w);
    let error = 0,
      support = 0;
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        const x = ix + dx,
          y = iy + dy;
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const a = y * w + x,
          c = (qy + dy) * w + qx + dx;
        let context = a;
        if (original[a] > limit) {
          if (!coherent || !filled[a] || !Number.isFinite(scores[a]) || !eligible(donor[a], limit))
            continue;
          context = donor[a];
        }
        for (let channel = 0; channel < 3; channel++)
          error += (rgb[context * 4 + channel] - rgb[c * 4 + channel]) ** 2;
        support++;
      }
    // A bounded locality prior resolves unsupported interiors. It cannot use
    // the occluding foreground's color as evidence for hidden background.
    return (
      (support ? error / (support * 3 * 255 ** 2) : 0) +
      (0.003 * ((qx - ix) ** 2 + (qy - iy) ** 2)) / (w * w + h * h)
    );
  };
  const offer = (i, q) => {
    const s = score(i, q);
    if (s < scores[i]) {
      scores[i] = s;
      donor[i] = q;
    }
  };
  for (let i = 0; i < n; i++) {
    filled[i] = Number(b.donor[i] !== i);
    if (!filled[i]) continue;
    offer(i, donor[i]);
    for (let k = 0; k < 24; k++) offer(i, Math.floor(random() * n));
  }
  for (let pass = 0; pass < passes; pass++) {
    const step = pass % 2 ? -1 : 1;
    for (let t = 0; t < n; t++) {
      const i = step > 0 ? t : n - 1 - t;
      if (!filled[i]) continue;
      if (coherent) scores[i] = score(i, donor[i]);
      for (const delta of [-step, -step * w]) {
        const k = i + delta;
        if (k < 0 || k >= n || (Math.abs(delta) === 1 && Math.floor(k / w) !== Math.floor(i / w)))
          continue;
        const q = donor[k] - delta;
        if (Math.abs(delta) === 1 && Math.floor(q / w) !== Math.floor(donor[k] / w)) continue;
        offer(i, q);
      }
      let q = donor[i];
      for (let reach = Math.max(w, h); reach >= 1; reach = Math.floor(reach / 2)) {
        const x = (q % w) + Math.round((random() * 2 - 1) * reach),
          y = Math.floor(q / w) + Math.round((random() * 2 - 1) * reach);
        if (x >= 0 && x < w && y >= 0 && y < h) offer(i, y * w + x);
        q = donor[i];
      }
    }
  }
  const rgba = Uint8Array.from(b.rgba);
  let supported = 0,
    fallback = 0;
  for (let i = 0; i < n; i++)
    if (filled[i]) {
      if (Number.isFinite(scores[i])) {
        rgba.set(rgb.subarray(donor[i] * 4, donor[i] * 4 + 4), i * 4);
        supported++;
      } else fallback++;
      rgba[i * 4 + 3] = 255;
    }
  return {
    ...b,
    rgba,
    donor,
    filled,
    patchmatch: { passes, radius, seed, coherent, supported, fallback },
  };
}

export function showFilledAreas(background) {
  const rgba = Uint8Array.from(background.rgba);
  for (let i = 0; i < background.filled.length; i++)
    if (background.filled[i]) {
      rgba[i * 4] = 255;
      rgba[i * 4 + 1] = Math.round(rgba[i * 4 + 1] * 0.25);
      rgba[i * 4 + 2] = 255;
    }
  return { ...background, rgba };
}
