// The same stepped-update approach as tools/effect-clip.mjs, confined to an
// export. No engine changes: normal RAF updates are restored even on failure.
export async function steppedCapture(player, base) {
  const stage = player.stage;
  const motion = player.motion;
  const handlers = stage.updateHandlers.slice();
  const saved = {
    frozen: player.frozen,
    paused: player.paused,
    timeScale: player.timeScale,
    turntable: player.camera.turntable,
    glide: player.glide,
    controls: { ...player.scene.motion.controls },
    state: motion.state,
    targets: motion.targets,
    kitClock: motion.kitClock,
    moveClock: motion.moveClock,
    tap: motion.tap,
    taps: motion.taps.slice(),
    hopStart: motion.hopStart,
    pausedAt: motion.pausedAt,
    pausedKey: motion.pausedKey,
    unseen: motion.unseen,
    sound: motion.sound,
  };
  // Recipe memories are often keyed by the state object's identity. Use
  // export-owned controls and clocks, then restore the original objects.
  motion.state = { ...motion.state };
  motion.targets = { ...motion.targets };
  motion.kitClock = { ...motion.kitClock };
  motion.moveClock = { ...motion.moveClock };
  const lens = stage.cameraEntity?.camera;
  const savedLens = lens ? { fov: lens.fov, horizontalFov: lens.horizontalFov } : null;
  const savedTarget = player.camera.target?.slice();
  const savedMin = player.camera.minDistance;
  // Media toys have their own wall/audio clocks. Pause those and seek the
  // source explicitly; their existing drive hooks then read the exact frame.
  motion.sound = null;
  const elements = [];
  const pauseMedia = (el) => {
    if (!el) return;
    elements.push({ el, time: el.currentTime, playing: !el.paused });
    el.pause();
  };
  let moving = null;
  let movingSaved = null;
  let audioTrack = null;
  let blocked;
  if (player.toyInfo?.id === "moving-photo-3d") {
    moving = (await import("../packs/moving-photo.js")).MOVING;
    movingSaved = { t: moving.t, frame: moving.frame, anchor: moving.anchor };
    audioTrack = moving.clip?.audio?.track;
    blocked = audioTrack?.blocked;
    pauseMedia(audioTrack?.el);
    if (audioTrack) audioTrack.blocked = true;
    pauseMedia(moving.clip?.video);
    motion.state.play = motion.targets.play = 0;
  }
  const flight = player.toyInfo?.data?.flight || motion.ctx?.kit?.data?.flight;
  const flightSaved = flight ? { ...flight.state, off: { ...flight.state.off } } : null;
  pauseMedia(flight?.state?.audio?.el);
  let pending = null;
  let previous = 0;
  let cycle = -1;
  player.frozen = false;
  player.paused = false;
  player.timeScale = 1;
  player.camera.turntable = false;
  player.glide = null;
  stage.updateHandlers.splice(0, stage.updateHandlers.length, () => {
    if (pending === null) return;
    const dt = pending;
    pending = null;
    for (const h of handlers) h(dt);
  });
  const key = motion.recipe?.action?.key;
  const def = motion.controlDef(key);
  const loop = Math.max(
    1,
    moving?.clip?.duration || (flight && flight.path.end - flight.path.start) || def?.ease || 4,
  );
  return {
    loop,
    async frame(t, kind, seconds) {
      const dt = Math.max(0, t - previous);
      previous = t;
      player.time = base.time + t - dt;
      const current = Math.floor((t + 1e-8) / loop);
      if (kind === "effects" && current !== cycle && !moving) {
        cycle = current;
        if (flight)
          Object.assign(flight.state, {
            active: false,
            done: false,
            pausedAt: null,
            leaving: false,
          });
        // Start the toy's real tap again, including toggles, rather than
        // substituting wind. Reset the action to its recipe's initial state.
        if (def) {
          motion.state[key] = def.default ?? 0;
          motion.targets[key] = def.default ?? 0;
        }
        motion.pausedAt = motion.pausedKey = null;
        motion.act(base.time + t, null, key ? { key } : null);
      }
      if (flight && kind === "turntable") {
        // The flight normally holds its opening camera until a drag. A
        // turntable owns the orbit instead, without replay easing it home.
        Object.assign(flight.state, { active: false, leaving: false, pausedAt: flight.path.start });
        motion.state.replay = motion.targets.replay = 0;
      }
      if (moving?.clip) {
        moving.t = t % moving.clip.duration;
        moving.anchor = null;
        const video = moving.clip.video;
        if (video && Math.abs(video.currentTime - moving.t) > 0.001) {
          await new Promise((resolve, reject) => {
            const clear = () => {
              video.removeEventListener("seeked", seeked);
              video.removeEventListener("error", failed);
              clearTimeout(timer);
            };
            const seeked = () => {
              clear();
              resolve();
            };
            const failed = () => {
              clear();
              reject(new Error("The source clip could not seek to this frame."));
            };
            const timer = setTimeout(failed, 15000);
            video.addEventListener("seeked", seeked, { once: true });
            video.addEventListener("error", failed, { once: true });
            video.currentTime = moving.t;
          });
        }
      }
      if (!flight || kind === "turntable")
        player.camera.setState(
          kind === "turntable"
            ? { ...base.cam, yaw: base.cam.yaw + (t / seconds) * Math.PI * 2 }
            : base.cam,
          { snap: true },
        );
      globalThis.window.__clipT = t;
      pending = dt;
      await stage.captureFrame();
      // A second render lets splat sorting catch up; no simulation time elapses.
      return stage.captureFrame();
    },
    restore() {
      stage.updateHandlers.splice(0, stage.updateHandlers.length, ...handlers);
      player.frozen = saved.frozen;
      player.paused = saved.paused;
      player.timeScale = saved.timeScale;
      player.camera.turntable = saved.turntable;
      player.glide = saved.glide;
      player.scene.motion.controls = saved.controls;
      for (const field of [
        "state",
        "targets",
        "kitClock",
        "moveClock",
        "tap",
        "taps",
        "hopStart",
        "pausedAt",
        "pausedKey",
        "unseen",
        "sound",
      ])
        motion[field] = saved[field];
      if (moving) {
        Object.assign(moving, movingSaved);
        if (audioTrack) audioTrack.blocked = blocked;
      }
      if (savedLens) Object.assign(lens, savedLens);
      if (savedTarget) player.camera.target = savedTarget;
      player.camera.minDistance = savedMin;
      if (flight) {
        for (const field of Object.keys(flight.state)) delete flight.state[field];
        Object.assign(flight.state, flightSaved);
      }
      for (const { el, time, playing } of elements) {
        el.currentTime = time;
        if (playing) el.play().catch(() => {});
      }
    },
  };
}
