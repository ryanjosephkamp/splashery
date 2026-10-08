// Lane AsciiCapture: the capture document's script. It lives in a same-origin
// iframe the ASCII lab makes for one job, owns one fresh player (never the
// person's), plays one preset through on a stepped clock at the fixed home
// camera, and hands each frame's pixels to the lab, one at a time. The lab
// removes the iframe when the job ends, whatever this script is doing.
//
// The stepped clock follows captureRecording() in src/pdf-export/capture.js:
// the toy's update handlers run only with the step given here, and the camera
// is held with camera.setState() before every render.

import { Player, NoGPUError, detectProfile } from "../player.js";
import { createScene, normalizeLook } from "../state.js";
import { findToy } from "../toys.js";
import { CAPTURE, isJobId, presetFor, readLabMessage } from "./protocol.js";

const job = location.hash.slice(1);
const parentWindow = window.parent;
let started = false;
let acked = -1;
let waiter = null;

function send(message, transfer = []) {
  parentWindow.postMessage({ ...message, job }, location.origin, transfer);
}

function onMessage(event) {
  if (event.source !== parentWindow || event.origin !== location.origin) return;
  const type = readLabMessage(event.data, job);
  if (type === "start" && !started) {
    started = true;
    run(event.data).catch((err) => {
      const reason = err instanceof NoGPUError ? "no-webgl2" : (err?.reason ?? "render");
      send({ type: "error", reason });
    });
  } else if (type === "next" && started && event.data.index === acked + 1) {
    acked = event.data.index;
    waiter?.();
  }
}

// Resolves once the lab has taken frame `index`.
function taken(index) {
  return new Promise((resolve) => {
    waiter = () => {
      if (acked >= index) {
        waiter = null;
        resolve();
      }
    };
    waiter();
  });
}

// Whether a frame shows anything but the #111111 background.
function lit(rgba) {
  let n = 0;
  for (let i = 0; i < rgba.length; i += 4)
    if (rgba[i] + rgba[i + 1] + rgba[i + 2] > 90 && ++n > 200) return true;
  return false;
}

function failure(reason, err) {
  const e = new Error(err?.message || reason);
  e.reason = reason;
  return e;
}

function rendererName(player) {
  const type = player.stage.device?.deviceType || "unknown";
  let gpu = "";
  try {
    const gl = player.stage.device?.gl;
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    gpu = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || "");
  } catch {
    gpu = "";
  }
  return `${type}${gpu ? ` (${gpu})` : ""}`.slice(0, 200);
}

async function run({ toy, options }) {
  const preset = presetFor(toy, options);
  const info = findToy(toy);
  if (!preset || !info) throw failure("start");
  const canvas = document.getElementById("stage");
  // The profile the app would pick on this device at start (or ?profile= from
  // the lab, for tests), held for the whole job: no adaptive step-down.
  const profile = detectProfile();
  const player = new Player(canvas, {
    prefer: "webgl2",
    profile,
    reducedMotion: false,
    idleDelay: 1e9,
  });
  player.adaptive = false;
  await player.init();
  const scene = createScene({
    toy: { kind: "builtin", id: toy, ...(preset.options ? { options: { ...preset.options } } : {}) }, // prettier-ignore
    seed: 1,
  });
  if (preset.camera || info.camera) scene.camera = { ...(preset.camera || info.camera) };
  scene.look = normalizeLook({ ...scene.look, background: "#111111" });
  scene.autoplay.turntable = false;
  player.scene = scene;
  player.applyLook();
  try {
    await player.loadToy(scene.toy);
  } catch (err) {
    throw failure("load", err);
  }
  player.applySettings(scene);
  send({ type: "loaded", renderer: rendererName(player), profile: player.profile });

  const { size, fps, frames, tapFrame } = CAPTURE;
  const stage = player.stage;
  stage.setFixedSize([size, size]);
  player.idle.weight = 0;
  player.camera.turntable = false;
  player.frozen = false;
  const home = player.camera.getState();
  const hold = () => player.camera.setState(home, { snap: true });
  const handlers = stage.updateHandlers.slice();
  let pending = 0;
  stage.updateHandlers.length = 0;
  stage.updateHandlers.push(() => {
    const d = pending;
    pending = 0;
    for (const h of handlers) h(d);
  });
  const render = async (step) => {
    pending = step;
    hold();
    await stage.captureFrame();
    pending = 0;
    hold();
    return stage.captureFrame(size, size);
  };
  // Let the toy settle once, off the record.
  await render(0.5);
  await render(0);
  for (let i = 0; i < frames; i++) {
    if (i === tapFrame) player.act(null);
    let shot = await render(i === 0 ? 0 : 1 / fps);
    let data = shot.getContext("2d").getImageData(0, 0, size, size).data;
    // Splats sort off the main thread, and some toys showed nothing on their
    // first frame until a sort had landed (lane ASCII r2). Retake it, with no
    // time passing, until something shows (at most four times).
    for (let k = 0; i === 0 && k < 4 && !lit(data); k++) {
      await new Promise((resolve) => setTimeout(resolve, 60));
      shot = await render(0);
      data = shot.getContext("2d").getImageData(0, 0, size, size).data;
    }
    const pixels = data.buffer;
    shot.width = shot.height = 0;
    send({ type: "frame", index: i, width: size, height: size, pixels }, [pixels]);
    await taken(i);
  }
  // The lab removes this document once it has the last frame.
}

if (isJobId(job) && parentWindow !== window) {
  addEventListener("message", onMessage);
  send({ type: "ready" });
}
