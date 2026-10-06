// Experimental adapter for a TASK-OWNED Splashery page, never the user's live tab.
// Simulation state advances during capture; close the owned page afterward.
// Render controls are restored on success, cancellation, or a callback failure.
export function captureControls(player) {
  return {
    fixedSize: player.stage.fixedSize && [...player.stage.fixedSize],
    cur: { ...player.camera.cur },
    tgt: { ...player.camera.tgt },
    frozen: player.frozen,
    timeScale: player.timeScale,
    motionAllowed: player.motionAllowed,
    idle: { ...player.idle },
    idleDelay: player.opts.idleDelay,
    handlerCount: player.stage.updateHandlers.length,
  };
}

export async function captureToy(
  player,
  { size = 420, fps = 10, seconds = 4, tapSeconds = 0.4, signal, onFrame = () => {} } = {},
) {
  const frameCount = Math.round(fps * seconds);
  if (
    !Number.isInteger(size) ||
    size < 256 ||
    size > 512 ||
    ![8, 10, 12].includes(fps) ||
    !Number.isFinite(seconds) ||
    seconds < 1 ||
    seconds > 6 ||
    frameCount > 64 ||
    !Number.isFinite(tapSeconds) ||
    tapSeconds < 0 ||
    tapSeconds >= seconds
  )
    throw new RangeError("Capture exceeds prototype bounds");
  const stage = player.stage;
  if (stage.__asciiCaptureLocked || stage.captureWaiters.length)
    throw new Error("This stage already has a capture pending");
  const before = captureControls(player);
  const handlers = stage.updateHandlers.slice();
  const handlerArray = stage.updateHandlers;
  const frames = [];
  const tapFrame = Math.round(tapSeconds * fps);
  let pending = 0;
  let restored;
  const check = () => {
    if (signal?.aborted) throw new DOMException("Capture canceled", "AbortError");
  };
  const frame = async () => {
    check();
    player.camera.cur = { ...player.camera.home };
    player.camera.tgt = { ...player.camera.home };
    let timer;
    try {
      return await Promise.race([
        stage.captureFrame(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("Render timed out")), 10_000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  stage.__asciiCaptureLocked = true;
  try {
    player.frozen = false;
    player.timeScale = 1;
    player.motionAllowed = true;
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    handlerArray.splice(0, handlerArray.length, () => {
      const dt = pending;
      pending = 0;
      for (const handler of handlers) handler(dt);
    });
    stage.setFixedSize([size, size]);
    // Let the source settle once. Later frames use exactly one simulation step,
    // followed by two zero-step renders so the splat sorter can catch up.
    pending = 0.5;
    await frame();
    await frame();
    await frame();
    for (let i = 0; i < frameCount; i++) {
      check();
      if (i === tapFrame) player.act(null);
      pending = i === 0 ? 0 : 1 / fps;
      await frame();
      await frame();
      const canvas = await frame();
      check();
      frames.push(canvas.toDataURL("image/png"));
      await onFrame({ index: i, canvas, seconds: i / fps });
      check();
    }
  } finally {
    pending = 0;
    handlerArray.splice(0, handlerArray.length, ...handlers);
    player.camera.cur = { ...before.cur };
    player.camera.tgt = { ...before.tgt };
    player.frozen = before.frozen;
    player.timeScale = before.timeScale;
    player.motionAllowed = before.motionAllowed;
    Object.assign(player.idle, before.idle);
    player.opts.idleDelay = before.idleDelay;
    // There were no pending capture waiters when this adapter acquired the lock.
    stage.captureWaiters.length = 0;
    stage.setFixedSize(before.fixedSize);
    delete stage.__asciiCaptureLocked;
    restored = {
      controlsEqual: JSON.stringify(captureControls(player)) === JSON.stringify(before),
      handlersEqual:
        stage.updateHandlers === handlerArray &&
        handlers.every((handler, i) => handler === stage.updateHandlers[i]),
      lockReleased: !stage.__asciiCaptureLocked,
    };
    player.__asciiLastRestore = restored;
  }
  return {
    frames,
    fps,
    seconds: frameCount / fps,
    frameCount,
    size,
    tapFrame,
    camera: { ...player.camera.home },
    restored,
  };
}
