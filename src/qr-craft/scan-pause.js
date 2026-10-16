// A scan may pause rendering only while its build generation is current.
const pauses = new WeakMap();
// Captures still need the player's camera updates. Suppress only surplus
// render-tail frames, and release promptly if a new build replaces the scan.
export async function withScanTail(player, check) {
  if (!player?.stage?.holdRenderTail) return check();
  const generation = player.loadToken;
  let release = player.stage.holdRenderTail();
  const restore = () => {
    release?.();
    release = null;
  };
  const timer = setInterval(() => {
    if (player.loadToken !== generation) restore();
  }, 32);
  try {
    return await check();
  } finally {
    clearInterval(timer);
    restore();
  }
}

export async function withScanPause(player, check) {
  if (!player?.setPaused) return check();
  const generation = player.loadToken;
  let state = pauses.get(player);
  if (state && state.generation !== generation) state.releaseAll();
  state = pauses.get(player);
  if (!state) {
    const paused = player.paused;
    const releaseTail = player.stage?.holdRenderTail?.();
    const releases = new Set();
    state = {
      generation,
      releases,
      releaseAll() {
        for (const release of [...releases]) release();
      },
      restore() {
        if (releases.size) return;
        pauses.delete(player);
        releaseTail?.();
        player.setPaused(paused);
      },
    };
    pauses.set(player, state);
    player.setPaused(true);
  }
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    clearInterval(timer);
    state.releases.delete(release);
    state.restore();
  };
  state.releases.add(release);
  const timer = setInterval(() => {
    if (player.loadToken !== generation) release();
  }, 32);
  try {
    return await check();
  } finally {
    release();
  }
}
