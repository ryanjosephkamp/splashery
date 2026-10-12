// Walking stays in a narrow tube around the filmed cameras, with a limited view of the scene.
import { setLens, putLens } from "./flight.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function closestPathPoint(path, p) {
  let best = {
    pos: path[0]?.pos?.slice() || [0, 0, 0],
    yaw: path[0]?.yaw || 0,
    pitch: path[0]?.pitch || 0,
    roll: path[0]?.roll || 0,
    distance: Infinity,
  };
  for (let i = 0; i < Math.max(1, path.length - 1); i++) {
    const a = path[i];
    const b = path[i + 1] || a;
    if (!a) continue;
    const v = b.pos.map((n, k) => n - a.pos[k]);
    const length2 = v.reduce((s, n) => s + n * n, 0);
    const t = length2
      ? clamp(v.reduce((s, n, k) => s + n * (p[k] - a.pos[k]), 0) / length2, 0, 1)
      : 0;
    const pos = v.map((n, k) => a.pos[k] + n * t);
    const distance = Math.hypot(...pos.map((n, k) => n - p[k]));
    if (distance < best.distance)
      best = {
        pos,
        distance,
        yaw: a.yaw + wrap(b.yaw - a.yaw) * t,
        pitch: a.pitch + (b.pitch - a.pitch) * t,
        roll: (a.roll || 0) + wrap((b.roll || 0) - (a.roll || 0)) * t,
        time: (a.time || 0) + ((b.time || 0) - (a.time || 0)) * t,
      };
  }
  return best;
}

export function createWalk(path) {
  const lengths = path
    .slice(1)
    .map((p, i) => Math.hypot(...p.pos.map((v, k) => v - path[i].pos[k])))
    .sort((a, b) => a - b);
  const spacing = lengths[Math.floor(lengths.length / 2)] || 0.05;
  const radius = clamp(spacing * 0.35, 0.012, 0.055);
  const speed = clamp(spacing * 0.8, 0.025, 0.16);
  const lookLimit = 0.35;
  const state = { pos: [], yaw: 0, pitch: 0, velocity: [0, 0, 0], boundary: false };
  let desiredYaw = 0;
  let desiredPitch = 0;
  const reset = (p = path[0]) => {
    state.pos = p?.pos?.slice() || [0, 0, 0];
    state.yaw = desiredYaw = p?.yaw || 0;
    state.pitch = desiredPitch = p?.pitch || 0;
    state.roll = p?.roll || 0;
    state.time = p?.time || 0;
    state.velocity = [0, 0, 0];
    state.boundary = false;
  };
  reset();
  return {
    state,
    radius,
    speed,
    lookLimit,
    reset,
    step(dt, input = {}) {
      dt = clamp(Number(dt) || 0, 0, 0.05);
      const ease = 1 - Math.exp(-dt * 9);
      const forward = clamp(input.forward || 0, -1, 1);
      const right = clamp(input.right || 0, -1, 1);
      const scale = speed / Math.max(1, Math.hypot(forward, right));
      const desired = [
        (-Math.sin(state.yaw) * forward + Math.cos(state.yaw) * right) * scale,
        0,
        (-Math.cos(state.yaw) * forward - Math.sin(state.yaw) * right) * scale,
      ];
      state.velocity = state.velocity.map((v, k) => v + (desired[k] - v) * ease);
      const next = state.pos.map((v, k) => v + state.velocity[k] * dt);
      const hit = closestPathPoint(path, next);
      state.boundary = hit.distance > radius;
      state.time = hit.time;
      state.roll = hit.roll;
      state.pos = state.boundary
        ? next.map((v, k) => hit.pos[k] + ((v - hit.pos[k]) * radius) / hit.distance)
        : next;
      desiredYaw += (input.lookX || 0) * 0.004;
      desiredPitch += (input.lookY || 0) * 0.004;
      desiredYaw = hit.yaw + clamp(wrap(desiredYaw - hit.yaw), -lookLimit, lookLimit);
      desiredPitch = hit.pitch + clamp(desiredPitch - hit.pitch, -0.5, 0.5);
      state.yaw =
        hit.yaw +
        clamp(
          wrap(state.yaw + wrap(desiredYaw - state.yaw) * ease - hit.yaw),
          -lookLimit,
          lookLimit,
        );
      state.pitch =
        hit.pitch + clamp(state.pitch + (desiredPitch - state.pitch) * ease - hit.pitch, -0.5, 0.5);
      return state;
    },
  };
}

export function mountWalk(path, { flight, isCurrent = () => true } = {}) {
  let player = globalThis.window?.__splashery?.player;
  let token = player?.loadToken;
  let cam = player?.camera;
  const walk = createWalk(path);
  let wasLens = cam ? setLens(path[0]) : null;
  const root = document.createElement("section");
  root.id = "v3d-walk";
  root.dataset.playground = document.getElementById("shelf") ? "true" : "false";
  root.setAttribute("aria-label", "Walk through the filmed scene");
  root.style.cssText =
    "position:fixed;inset:0;width:calc(100% - var(--panel-w,0px) - 24px);z-index:24;pointer-events:none;font:12px/1.4 var(--font-body,sans-serif);color:var(--ink,#111)";
  const style = document.createElement("style");
  style.textContent =
    "#v3d-walk[data-playground=false]{width:100%!important}#v3d-walk[data-playground=false] p{top:8px!important}#v3d-walk[data-playground=false] [data-pad],#v3d-walk[data-playground=false] button{bottom:16px!important}@media(max-height:300px){#v3d-walk[data-playground=false] p{display:none}}@media(max-width:760px){#v3d-walk{width:100%!important}#v3d-walk[data-playground=true] [data-pad],#v3d-walk[data-playground=true] button{bottom:calc(var(--dock-h,200px) + 58px)!important}}";
  root.append(style);
  const hint = document.createElement("p");
  hint.textContent = "Walk: W A S D or arrow keys. Drag to look. Stay near the filmed path.";
  hint.style.cssText =
    "position:absolute;top:76px;left:50%;transform:translateX(-50%);width:min(290px,75vw);padding:8px 12px;margin:0;background:var(--paper,#fff);border:1px solid var(--line,#ddd);border-radius:12px;text-align:center";
  root.append(hint);
  const keys = new Set();
  const input = { forward: 0, right: 0, lookX: 0, lookY: 0 };
  let moved = false;
  let looking = false;
  let lastTime = null;
  let disposed = false;
  const ctrl = new AbortController();
  const ownsLoad = () =>
    isCurrent() &&
    player === globalThis.window?.__splashery?.player &&
    player?.loadToken === token &&
    player?.scene?.toy?.id === "video-3d";
  const active = () => ownsLoad() && player?.proc?.ctx?.kit?.data?.walk === api;
  const listen = (target, name, fn, options = {}) =>
    target?.addEventListener(name, fn, { ...options, signal: ctrl.signal });
  const editable = (e) => e.target?.closest?.("input,select,textarea,[contenteditable=true]");
  const key = (e, down) => {
    if (!active() || root.hidden || (down && editable(e)) || e.altKey || e.ctrlKey || e.metaKey)
      return;
    const k = e.key.toLowerCase();
    if (!["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].includes(k))
      return;
    if (!down && !keys.has(k)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    down ? keys.add(k) : keys.delete(k);
    player?.stage?.requestRender?.();
  };
  listen(window, "keydown", (e) => key(e, true), { capture: true });
  listen(window, "keyup", (e) => key(e, false), { capture: true });
  const clear = () => {
    keys.clear();
    input.forward = input.right = input.lookX = input.lookY = 0;
    looking = false;
  };
  listen(window, "blur", clear);
  listen(document, "visibilitychange", () => {
    if (document.hidden) clear();
  });
  const pad = (name, side) => {
    const p = document.createElement("div");
    p.setAttribute("role", "group");
    p.setAttribute("aria-label", `${name} thumb control`);
    p.dataset.pad = name.toLowerCase();
    p.textContent = name;
    p.style.cssText = `position:absolute;bottom:110px;${side}:18px;width:82px;height:82px;display:grid;place-items:center;border-radius:50%;border:2px solid var(--line-strong,#888);background:var(--paper,#fff);opacity:.9;pointer-events:auto;touch-action:none;user-select:none`;
    let start = null;
    let pointer = null;
    listen(p, "pointerdown", (e) => {
      pointer = e.pointerId;
      start = [e.clientX, e.clientY];
      p.setPointerCapture(pointer);
      e.preventDefault();
    });
    listen(p, "pointermove", (e) => {
      if (e.pointerId !== pointer || !start) return;
      const x = clamp((e.clientX - start[0]) / 35, -1, 1);
      const y = clamp((e.clientY - start[1]) / 35, -1, 1);
      if (name === "Move") {
        input.right = x;
        input.forward = -y;
      } else {
        input.lookX = x * 2;
        input.lookY = y * 2;
      }
      player?.stage?.requestRender?.();
    });
    const stop = (e) => {
      if (e.pointerId !== pointer) return;
      if (name === "Move") input.forward = input.right = 0;
      else input.lookX = input.lookY = 0;
      start = pointer = null;
    };
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      listen(p, event, stop);
    root.append(p);
  };
  pad("Move", "left");
  pad("Look", "right");
  let boundCanvas = null;
  const bindCanvas = () => {
    const canvas = player?.stage?.app?.graphicsDevice?.canvas;
    if (!canvas || boundCanvas === canvas) return;
    boundCanvas = canvas;
    listen(
      canvas,
      "pointerdown",
      (e) => {
        if (
          root.hidden ||
          !active() ||
          (window.__splashery?.app && window.__splashery.app.tool !== "orbit")
        )
          return;
        looking = true;
        canvas.setPointerCapture?.(e.pointerId);
        e.stopImmediatePropagation();
      },
      { capture: true },
    );
    listen(
      canvas,
      "pointermove",
      (e) => {
        if (!looking || root.hidden) return;
        walk.step(0, { lookX: e.movementX, lookY: e.movementY });
        player.stage?.requestRender?.();
        e.stopImmediatePropagation();
      },
      { capture: true },
    );
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      listen(
        canvas,
        event,
        () => {
          looking = false;
        },
        { capture: true },
      );
  };
  bindCanvas();
  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Back to start";
  reset.style.cssText =
    "position:absolute;bottom:110px;left:50%;transform:translateX(-50%);padding:9px;border:1px solid var(--line,#888);border-radius:9px;background:var(--paper,#fff);color:inherit;pointer-events:auto";
  listen(reset, "click", () => {
    walk.reset();
    clear();
  });
  root.append(reset);
  document.body.append(root);
  let was;
  const initialize = () => {
    if (!player) {
      player = globalThis.window?.__splashery?.player;
      token = player?.loadToken;
    }
    cam ||= player?.camera;
    if (!cam) return false;
    if (!was) {
      was = {
        minDistance: cam.minDistance,
        target: cam.target.slice(),
        cur: { ...cam.cur },
        tgt: { ...cam.tgt },
        offset: cam.offset?.slice() || [0, 0, 0],
      };
      wasLens ||= setLens(path[0]);
      bindCanvas();
    }
    return true;
  };
  initialize();
  const api = {
    state: walk.state,
    radius: walk.radius,
    root,
    resumeAt(p) {
      walk.reset(p);
      clear();
      lastTime = null;
    },
    drive(info) {
      if (disposed || !initialize() || !ownsLoad()) return;
      // Match the filmed field of view, including after the stage changes size.
      if (wasLens) wasLens = setLens(path[0], wasLens);
      const time = info?.time || 0;
      const dt = lastTime == null ? 0 : Math.max(0, time - lastTime);
      lastTime = time;
      const state = walk.step(dt, {
        ...input,
        lookX: input.lookX * Math.min(0.05, dt) * 60,
        lookY: input.lookY * Math.min(0.05, dt) * 60,
        forward:
          input.forward +
          Number(keys.has("w") || keys.has("arrowup")) -
          Number(keys.has("s") || keys.has("arrowdown")),
        right:
          input.right +
          Number(keys.has("d") || keys.has("arrowright")) -
          Number(keys.has("a") || keys.has("arrowleft")),
      });
      const f = [
        -Math.cos(state.pitch) * Math.sin(state.yaw),
        -Math.sin(state.pitch),
        -Math.cos(state.pitch) * Math.cos(state.yaw),
      ];
      const d = 0.025;
      cam.minDistance = Math.min(cam.minDistance, d * 0.8);
      cam.target = state.pos.map((v, k) => v + f[k] * d);
      // A drift left by another toy must not move the real camera outside this corridor.
      cam.offset = [0, 0, 0];
      cam.aim = cam.target.slice();
      cam.easeAim = false;
      cam.cur = cam.tgt = { yaw: state.yaw, pitch: state.pitch, roll: state.roll, distance: d };
      cam.vel.yaw = cam.vel.pitch = 0;
      cam.turntable = false;
      cam.idleFor = 0;
      hint.textContent = state.boundary
        ? "Edge of the filmed area. Turn gently, or move back along the path."
        : "Walk: keys or left thumb. Look: drag or right thumb.";
      moved = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearInterval(timer);
      ctrl.abort();
      root.remove();
      flight?.dispose?.();
      putLens(wasLens);
      if (moved && active() && was) {
        cam.minDistance = was.minDistance;
        cam.target = was.target;
        cam.cur = was.cur;
        cam.tgt = was.tgt;
        cam.offset = was.offset;
      }
    },
  };
  let installed = false;
  const timer = setInterval(() => {
    if (!initialize()) {
      if (player && !ownsLoad()) api.dispose();
      return;
    }
    if (active()) installed = true;
    else if (installed || !ownsLoad()) api.dispose();
  }, 250);
  return api;
}
