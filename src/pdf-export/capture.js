// Lane PDF lab: pictures of the toy on the stage for its PDF. The still is
// one sharp frame at the camera and settings as they are now. The recording
// is one tap played through on a stepped clock (as tools/effect-clip.mjs
// does), so it shows the effect at its real speed however slow the device is:
// a short lead-in, the tap (a toggle is switched on, held and switched off
// again), and frames until the effect has settled or the longest length is
// reached.

export function jpegOf(canvas, quality = 0.9) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      async (b) => (b ? resolve(new Uint8Array(await b.arrayBuffer())) : reject(new Error("Could not encode the picture."))), // prettier-ignore
      "image/jpeg",
      quality,
    ),
  );
}

// One frame at `size` pixels square, as the stage shows it now.
export async function captureStill(app, { size = 1080, quality = 0.9 } = {}) {
  const player = app.player;
  return app.withCapture([size, size], async () => {
    const c = await player.stage.captureFrame();
    return { bytes: await jpegOf(c, quality), type: "jpeg", width: size, height: size };
  });
}

// The toy's tap: its kind ("pulse", "toggle" or "hop") and how long it eases.
export function tapKind(player) {
  const key = player.toyInfo?.recipe?.action?.key;
  const def = key ? player.motion.controlDef?.(key) : null;
  if (def?.type === "pulse" || def?.type === "toggle")
    return { kind: def.type, key, ease: def.ease ?? 0.8 };
  return { kind: "hop", key: null, ease: 0.62 };
}

// Records one tap. Options: size (pixels), fps, maxSeconds, quality.
// Returns { frames: [JPEG bytes], size, fps, seconds, tapFrame, settled }.
export async function captureRecording(app, opts = {}) {
  const { size = 420, fps = 8, maxSeconds = 6, quality = 0.82, lead = 0.25, tail = 0.35, onProgress } = opts; // prettier-ignore
  const player = app.player;
  const stage = player.stage;
  const tap = tapKind(player);
  return app.withCapture([size, size], async (base) => {
    // The clock moves only by the steps given here.
    const handlers = stage.updateHandlers.slice();
    let pending = 0;
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = pending;
      pending = 0;
      for (const h of handlers) h(d);
    });
    const turntable = player.camera.turntable;
    player.camera.turntable = false;
    player.frozen = false;
    const step = 1 / fps;
    const frames = [];
    const hold = () => player.camera.setState(base.cam, { snap: true });
    const frame = async () => {
      pending = step;
      hold();
      await stage.captureFrame();
      pending = 0;
      hold();
      const c = await stage.captureFrame();
      frames.push(await jpegOf(c, quality));
      onProgress?.(Math.min(0.99, frames.length / Math.ceil(maxSeconds * fps)));
    };
    // Settled: the tap's control has reached its goal and the hop is over
    // (a toy that moves by itself never settles; it stops at maxSeconds).
    const busy = () => player.motion.isAnimating({ move: "still", alive: false }, player.time);
    const max = Math.max(2, Math.round(maxSeconds * fps));
    let settled = false;
    try {
      // Settle any earlier tap first, off the record.
      for (let i = 0; i < 4 * fps && busy(); i++) {
        pending = 0.25;
        await stage.captureFrame();
      }
      for (let t = 0; t < lead - 1e-6; t += step) await frame();
      const tapFrame = frames.length;
      player.act(null);
      let off = tap.kind === "toggle";
      let quiet = 0;
      let onFor = 0;
      while (frames.length < max) {
        await frame();
        if (off) {
          // A toggle: switch it off again once it has been on a moment.
          if (!busy()) onFor += step;
          if (onFor >= 0.6) {
            player.act(null);
            off = false;
          }
          continue;
        }
        quiet = busy() ? 0 : quiet + step;
        if (quiet >= tail) {
          settled = true;
          break;
        }
      }
      return { frames, size, fps, seconds: frames.length / fps, tapFrame, settled };
    } finally {
      // The clock carries on from here (back in time, the tap would replay).
      base.time = player.time;
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(...handlers);
      player.camera.turntable = turntable;
    }
  });
}
