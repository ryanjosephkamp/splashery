// Video to 3D (lane Video 3D): Replay flight. The stage's own orbit camera flies the video's camera
// path (the solved cameras, in the toy's frame, at the times they were filmed), with the video's
// sound when the speaker is on. While it flies, a drag turns the view and a pinch or the wheel
// zooms it, on top of the path (r7). Switching Replay off mid-flight pauses it: the view holds that
// moment, a drag roams from there, and switching it on again goes on from there. When the path
// ends the camera stays where the video ended; switching Replay off then brings it home.
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

// Puts the orbit camera at a path camera: it looks at the point of its line of sight nearest the
// scene's middle (so a turn goes around the scene), or just ahead when that is behind it or too
// close.
// off: the visitor's turn and zoom on top of the path ({ yaw, pitch, zoom }), turning around the
// point the video's camera looks at.
function place(cam, p, off = null) {
  const f = forwardOf(p.yaw, p.pitch);
  const along = -(p.pos[0] * f[0] + p.pos[1] * f[1] + p.pos[2] * f[2]);
  // The far shell makes the toy's bounds large; let the camera come as close as the video's did.
  if (along > 0.05 && along < cam.minDistance) cam.minDistance = along * 0.8;
  const d = Math.max(cam.minDistance * 1.02, Math.min(cam.maxDistance * 0.98, along));
  cam.target = [p.pos[0] + f[0] * d, p.pos[1] + f[1] * d, p.pos[2] + f[2] * d];
  const lim = Math.PI / 2 - 0.05;
  const pose = {
    yaw: p.yaw + (off?.yaw || 0),
    pitch: Math.max(-lim, Math.min(lim, p.pitch + (off?.pitch || 0))),
    roll: p.roll,
    distance: Math.max(cam.minDistance, Math.min(cam.maxDistance, d * (off?.zoom || 1))),
  };
  cam.cur = { ...pose };
  cam.tgt = { ...pose };
  cam.vel.yaw = cam.vel.pitch = 0;
  return pose;
}

// What the visitor did to the camera since the flight last placed it (a drag turns cam.tgt, a pinch
// or the wheel zooms it), added to the offset.
function takeInput(cam, placed, off) {
  if (!placed) return;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  off.yaw += wrap(cam.tgt.yaw - placed.yaw);
  off.pitch += cam.tgt.pitch - placed.pitch;
  if (placed.distance > 0 && cam.tgt.distance > 0) off.zoom *= cam.tgt.distance / placed.distance;
  off.zoom = Math.max(0.05, Math.min(20, off.zoom));
}

// The stage camera's lens matched to the video's (from the solved focal length), so the video's
// picture covers the screen: its height fits a tall phone screen (the sides are cut), its width a
// wide one. Returns the lens to put back.
function setLens(c0) {
  const stage = globalThis.window?.__splashery?.player?.stage;
  const lens = stage?.cameraEntity?.camera;
  if (!lens || !c0?.f || !c0?.w || !c0?.h) return null;
  const was = { fov: lens.fov, horizontalFov: lens.horizontalFov };
  const canvas = stage.app?.graphicsDevice?.canvas;
  const aspect = canvas ? canvas.width / Math.max(1, canvas.height) : 1;
  const wide = aspect > c0.w / c0.h; // the video covers the screen (its sides cut on a phone)
  lens.horizontalFov = wide;
  lens.fov = (2 * Math.atan((wide ? c0.w : c0.h) / 2 / c0.f) * 180) / Math.PI;
  return was;
}

function putLens(was) {
  const lens = globalThis.window?.__splashery?.player?.stage?.cameraEntity?.camera;
  if (!lens || !was) return;
  lens.fov = was.fov;
  lens.horizontalFov = was.horizontalFov;
}

const samePose = (cam, p) =>
  !!p &&
  Math.abs(cam.cur.yaw - p.yaw) < 1e-6 &&
  Math.abs(cam.cur.distance - p.distance) < 1e-6 &&
  cam.target.every((v, i) => Math.abs(v - p.target[i]) < 1e-6);

// The flight for one built scene. media: { file, start } for a video somebody opened (its sound
// plays), or null (a sample: no sound). Returns drive's hook: fly(v, info), v the Replay toggle.
export function makeFlight(cams, media) {
  const path = flightPath(cams);
  const st = { active: false, clock: 0, home: null, endTarget: null, audio: null, done: false };
  // The visitor's turn and zoom during the flight, and the pose the flight last set.
  st.off = { yaw: 0, pitch: 0, zoom: 1 };
  st.placed = null;
  // Paused mid-flight: the path's time it stopped at (null when not paused).
  st.pausedAt = null;
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
    // The toy opens where the video starts: the first camera's place and view. The app sets up
    // its own camera when a toy loads (and puts the old one back when options change), so this
    // keeps the video's view until the visitor first turns or zooms (which resets idleFor).
    if (!st.active && !st.leaving && !st.userMoved && st.pausedAt == null) {
      if (cam.dragging || (st.lastIdle != null && cam.idleFor < st.lastIdle)) st.userMoved = true;
      else if (!samePose(cam, st.homePose)) {
        place(cam, path.at(path.start));
        cam.home = { ...cam.cur };
        st.homePose = { ...cam.cur, target: cam.target.slice() };
      }
      st.lastIdle = cam.idleFor;
    }
    const prev = st.prev ?? 0;
    st.prev = v;
    if (v > prev && v > 0.001 && !st.active && st.pausedAt != null) {
      // Replay switched on again after a pause: on from the moment it stopped at, the view back on
      // the path.
      st.active = true;
      st.clock = (info?.time ?? 0) - (st.pausedAt - path.start);
      st.off = { yaw: 0, pitch: 0, zoom: 1 };
      st.placed = null;
      if (st.audio && info?.sound?.enabled) st.audio.el.play().catch(() => {});
      st.pausedAt = null;
    } else if (v > prev && v > 0.001 && !st.active) {
      // Replay switched on (also while it was still easing home).
      st.active = true;
      st.leaving = false;
      st.done = false;
      st.clock = info?.time ?? 0;
      st.home = { state: cam.getState(), target: cam.target.slice() };
      st.lens = setLens(cams[0]);
      st.off = { yaw: 0, pitch: 0, zoom: 1 };
      st.placed = null;
      startAudio(info);
    }
    if (st.active && v >= prev) {
      const el = st.audio?.el;
      const time = el && !el.paused ? el.currentTime : path.start + ((info?.time ?? 0) - st.clock);
      if (time >= path.end) {
        if (!st.done) {
          st.done = true;
          stopAudio();
        }
        return; // the camera stays at the path's end: a drag roams from there
      }
      takeInput(cam, st.placed, st.off);
      st.placed = place(cam, path.at(time), st.off);
      st.time = time;
      cam.turntable = false;
      cam.idleFor = 0;
      st.endTarget = cam.target.slice();
      return;
    }
    if (st.active && v < prev && !st.done) {
      // Replay switched off mid-flight: a pause. The view holds where it is (a drag roams from
      // there), the sound stops, and switching Replay on again goes on from this moment.
      st.active = false;
      st.pausedAt = st.time ?? path.start;
      if (st.audio) st.audio.el.pause();
      return;
    }
    if (st.pausedAt != null) return;
    if (st.active && v < prev) {
      // Replay switched off after the path's end: ease back home as the toggle falls.
      stopAudio();
      putLens(st.lens);
      st.lens = null;
      st.active = false;
      st.leaving = true;
      cam.setState(st.home.state, { snap: false });
      st.from = cam.target.slice();
    }
    if (st.leaving) {
      const k = Math.max(0, Math.min(1, 1 - v));
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
    putLens(st.lens);
    if (st.audio) URL.revokeObjectURL(st.audio.url);
    st.audio = null;
  };
  fly.path = path;
  fly.state = st;
  return fly;
}
