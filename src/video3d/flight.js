// Video to 3D (lane Video 3D): Replay flight. The stage's own orbit camera flies the video's camera
// path (the solved cameras, in the toy's frame, at the times they were filmed), with the video's
// sound when the speaker is on. When the path ends the camera stays where the video ended, and a
// drag turns it from there (roaming off the path); switching Replay off brings it home.
//
// The orbit camera always looks at a target from a distance, so each video camera becomes a
// target just in front of it, seen from the camera's own place and angle.

// cams: [{ time, pos, forward, yaw, pitch, roll }] sorted by time (scene.js toyCamera, plus time).
// Returns { at(time) } giving the camera at a time (blended between the two nearest), and the
// path's start and end.
export function flightPath(cams) {
  const start = cams.length ? cams[0].time : 0;
  const end = cams.length ? cams[cams.length - 1].time : 0;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  return {
    start,
    end,
    at(time) {
      if (!cams.length) return null;
      if (time <= start) return cams[0];
      if (time >= end) return cams[cams.length - 1];
      let i = 1;
      while (i < cams.length - 1 && cams[i].time < time) i++;
      const a = cams[i - 1];
      const b = cams[i];
      const f = (time - a.time) / Math.max(1e-6, b.time - a.time);
      const s = f;
      const lerp = (x, y) => x + (y - x) * s;
      return {
        time,
        pos: [0, 1, 2].map((k) => lerp(a.pos[k], b.pos[k])),
        yaw: a.yaw + wrap(b.yaw - a.yaw) * s,
        pitch: lerp(a.pitch, b.pitch),
        roll: a.roll + wrap(b.roll - a.roll) * s,
      };
    },
  };
}

const forwardOf = (yaw, pitch) => [
  -Math.cos(pitch) * Math.sin(yaw),
  -Math.sin(pitch),
  -Math.cos(pitch) * Math.cos(yaw),
];

// The flight for one built scene. media: { file, start } for a video somebody opened (its sound
// plays), or null (a sample: no sound). Returns drive's hook: fly(v, info), v the Replay toggle.
export function makeFlight(cams, media) {
  const path = flightPath(cams);
  const st = { active: false, clock: 0, home: null, endTarget: null, audio: null, done: false };
  const cameraOf = () => globalThis.window?.__splashery?.player?.camera || null;

  const stopAudio = () => {
    if (st.audio) {
      st.audio.el.pause();
    }
  };
  const startAudio = (info) => {
    if (!media?.file || !info?.sound?.enabled) return;
    try {
      if (!st.audio) {
        const url = URL.createObjectURL(media.file);
        const el = new Audio(url);
        const ctx = info.sound.audio();
        const src = ctx.createMediaElementSource(el);
        src.connect(info.sound.master);
        st.audio = { el, url };
      }
      st.audio.el.currentTime = path.start;
      st.audio.el.play().catch(() => {});
    } catch {
      st.audio = null;
    }
  };

  const fly = (v, info) => {
    const cam = cameraOf();
    if (!cam || !cams.length) return;
    if (v > 0.001 && !st.active && !st.leaving) {
      st.active = true;
      st.done = false;
      st.clock = info?.time ?? 0;
      st.home = { state: cam.getState(), target: cam.target.slice() };
      startAudio(info);
    }
    if (st.active && v >= 0.5) {
      const el = st.audio?.el;
      const time =
        el && !el.paused ? el.currentTime : path.start + ((info?.time ?? 0) - st.clock);
      if (time >= path.end) {
        if (!st.done) {
          st.done = true;
          stopAudio();
        }
        return; // the camera stays at the path's end: a drag roams from there
      }
      const p = path.at(time);
      const d = cam.minDistance * 1.02;
      const f = forwardOf(p.yaw, p.pitch);
      cam.target = [p.pos[0] + f[0] * d, p.pos[1] + f[1] * d, p.pos[2] + f[2] * d];
      const pose = { yaw: p.yaw, pitch: p.pitch, roll: p.roll, distance: d };
      cam.cur = { ...pose };
      cam.tgt = { ...pose };
      cam.vel.yaw = cam.vel.pitch = 0;
      cam.turntable = false;
      cam.idleFor = 0;
      st.endTarget = cam.target.slice();
      return;
    }
    if (st.active && v < 0.5) {
      // Replay switched off: ease back home as the toggle falls.
      stopAudio();
      st.active = false;
      st.leaving = true;
      cam.setState(st.home.state, { snap: false });
      st.from = cam.target.slice();
    }
    if (st.leaving) {
      const k = Math.max(0, Math.min(1, 1 - v * 2));
      const to = st.home.target;
      cam.target = [0, 1, 2].map((i) => st.from[i] + (to[i] - st.from[i]) * k);
      if (v <= 0.001) {
        cam.target = to.slice();
        st.leaving = false;
      }
    }
  };
  fly.dispose = () => {
    stopAudio();
    if (st.audio) URL.revokeObjectURL(st.audio.url);
    st.audio = null;
  };
  fly.path = path;
  return fly;
}
