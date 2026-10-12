// Optional sparse clip depth. Small local color patches move each anchor's depth toward the
// intervening picture before blending. This is a bounded correspondence guess, not 3D recovery.
import { resampleArea } from "../packs/photo-3d-core.js";

export function colorGuide(photo, w, h) {
  return resampleArea(photo, w, h);
}
export function guideBetween(a, b, ga, gb, target, t, radius = 3) {
  if (a.w !== b.w || a.h !== b.h)
    throw new Error("Clip depth anchors must have the same dimensions.");
  const { w, h } = a;
  const d = new Float32Array(w * h);
  const clamp = (v, max) => Math.max(0, Math.min(max - 1, v));
  const points = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  function match(guide, x, y) {
    let best = Infinity,
      at = y * w + x;
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        const xx = clamp(x + dx, w),
          yy = clamp(y + dy, h);
        let cost = 0.0003 * (dx * dx + dy * dy);
        for (const [px, py] of points) {
          const i = (clamp(y + py, h) * w + clamp(x + px, w)) * 3;
          const j = (clamp(yy + py, h) * w + clamp(xx + px, w)) * 3;
          for (let c = 0; c < 3; c++) cost += (target[i + c] - guide[j + c]) ** 2;
        }
        if (cost < best) {
          best = cost;
          at = yy * w + xx;
        }
      }
    return { at, confidence: 1 / (0.01 + best) };
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const aa = match(ga, x, y),
        bb = match(gb, x, y);
      const wa = (1 - t) * aa.confidence,
        wb = t * bb.confidence;
      d[y * w + x] = (wa * a.d[aa.at] + wb * b.d[bb.at]) / (wa + wb);
    }
  return { w, h, d, ms: 0, guided: true };
}

export async function sparseClipDepth(engine, frames, w, h, options = {}, onStatus = () => {}) {
  const every = options.keyEvery ?? 2;
  if (!Number.isInteger(every) || every < 1 || every > 8 || !frames.length)
    throw new Error("Choose one depth anchor every 1 to 8 frames of a nonempty clip.");
  const photo = (i) => ({ w, h, data: frames[i].data });
  const out = new Array(frames.length);
  let prev = 0;
  let modelRuns = 0;
  const estimate = async (i) => {
    onStatus(`Working out the clip's depth: frame ${i + 1} of ${frames.length}…`);
    out[i] = await engine.estimate(photo(i), { ...options, side: options.side ?? 196 });
    modelRuns++;
  };
  await estimate(0);
  for (
    let end = Math.min(every, frames.length - 1);
    prev < frames.length - 1;
    end = Math.min(end + every, frames.length - 1)
  ) {
    await estimate(end);
    const a = out[prev],
      b = out[end];
    const ga = colorGuide(photo(prev), a.w, a.h),
      gb = colorGuide(photo(end), a.w, a.h);
    let anchorChange = 0;
    for (let j = 0; j < ga.length; j++) anchorChange += Math.abs(ga[j] - gb[j]);
    const cut = anchorChange / ga.length > (options.cutThreshold ?? 0.12);
    for (let i = prev + 1; i < end; i++) {
      const g = colorGuide(photo(i), a.w, a.h);
      let diff = 0;
      for (let j = 0; j < g.length; j++)
        diff += Math.min(Math.abs(g[j] - ga[j]), Math.abs(g[j] - gb[j]));
      // A new shot or large appearance change needs its own model result. Never guide across it.
      if (cut || diff / g.length > (options.cutThreshold ?? 0.12)) await estimate(i);
      else out[i] = guideBetween(a, b, ga, gb, g, (i - prev) / (end - prev));
    }
    prev = end;
  }
  return { depths: out, modelRuns };
}
