// MIT. Made by Ryan with Codex (GPT-6). Geometry may see evaluation grayscale; appearance may not.

// Build a fold BEFORE any sparse color, surface seed, hull, background fit, or GPU target upload.
// The returned frame array physically contains only training cameras. No held-out mask is read.
export function appearanceFold(solution, heldOut = []) {
  const { frames, recon } = solution;
  const excluded = new Set(heldOut);
  const names = new Set(frames.map((f) => f.name));
  if ([...excluded].some((name) => !names.has(name))) throw new Error("Unknown held-out photo");
  const cameras = recon.cams.filter((c) => !excluded.has(frames[c.imgIdx].name));
  if (cameras.length < 2) throw new Error("At least two training cameras are required");
  const map = new Map(cameras.map((c, i) => [c.imgIdx, i]));
  const trainFrames = cameras.map((c) => ({ ...frames[c.imgIdx] }));
  const sample = (o) => {
    const frame = frames[o.img];
    const f = recon.features[o.img];
    const x = Math.min(frame.tw - 1, Math.max(0, Math.round((f.x[o.feat] * frame.tw) / frame.fw)));
    const y = Math.min(frame.th - 1, Math.max(0, Math.round((f.y[o.feat] * frame.th) / frame.fh)));
    const pixel = y * frame.tw + x;
    if (frame.alpha && frame.alpha[pixel] < 192) return null;
    const rgb = Array.from(frame.rgb.subarray(pixel * 3, pixel * 3 + 3));
    return rgb.length === 3 && rgb.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
      ? rgb
      : null;
  };
  const points = recon.tracks.flatMap((track) => {
    // A single training observation cannot supply a multiview appearance seed.
    const obs = track.obs.filter((o) => map.has(o.img));
    if (obs.length < 2) return [];
    const colors = obs.map(sample).filter(Boolean);
    if (colors.length < 2) return [];
    return [
      {
        X: [...track.X],
        nObs: colors.length,
        rgb: [0, 1, 2].map((k) => colors.reduce((s, c) => s + c[k], 0) / colors.length),
      },
    ];
  });
  if (points.length < 8)
    throw new Error("Fewer than eight points have two independent training-color observations");
  return {
    frames: trainFrames,
    recon: {
      cams: cameras.map((c, i) => ({ ...c, R: [...c.R], t: [...c.t], imgIdx: i })),
      points,
      k1: 0,
      k2: 0,
      fFeat: cameras[0].f,
    },
    heldOut: [...excluded],
    trainingNames: trainFrames.map((f) => f.name),
  };
}
