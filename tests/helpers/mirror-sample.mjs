// Keep each sample's native waits, cell reads, and rendered-frame capture in one
// browser task. Protocol round trips otherwise add uncontrolled live evolution.
export async function waitNativeAnswer() {
  const { MIRROR } = await import("/src/live/relief.js");
  const cam = MIRROR.cam;
  if (!cam || cam.closed) throw Error("Camera depth is unavailable before the fresh answer");
  const draw = cam.draw;
  let total = 0,
    frames = 0,
    invalidDt = null;
  cam.draw = function (g, options = {}) {
    const result = draw.call(this, g, options);
    if (result === true && this === cam && cam === MIRROR.cam) {
      const dt = options.dt === undefined ? 1 / 60 : options.dt;
      if (!Number.isFinite(dt) || dt < 0) invalidDt = String(dt);
      else {
        total += dt;
        frames++;
      }
    }
    return result;
  };
  const check = () => {
    if (cam !== MIRROR.cam || cam.closed) throw Error("Camera depth changed during observation");
    if (invalidDt !== null) throw Error("Invalid native camera draw dt: " + invalidDt);
  };
  try {
    const n0 = cam.answers;
    const t0 = performance.now();
    while (cam.answers === n0 && performance.now() - t0 < 30000) {
      check();
      cam.ask();
      await new Promise((r) => setTimeout(r, 30));
    }
    check();
    if (cam.answers === n0)
      throw Error(
        "No fresh native depth answer within 30000 ms: " +
          JSON.stringify({ answers: cam.answers, busy: cam.busy, discarded: cam.discarded }),
      );
    const before = { total, frames, wall: performance.now() };
    while (total - before.total < 0.4) {
      check();
      if (performance.now() - before.wall >= 30000)
        throw Error(
          "Native camera draws did not consume 0.4 seconds within 30000 ms: " +
            JSON.stringify({
              nativeSeconds: total - before.total,
              frames: frames - before.frames,
              answers: cam.answers,
            }),
        );
      await new Promise((r) => setTimeout(r, 30));
    }
    check();
  } finally {
    cam.draw = draw;
  }
}

let turned = null;
let savedCarets = null;
function restoreCamera() {
  if (!turned) return;
  const { camera, delta } = turned;
  const state = camera.getState();
  camera.setState({ ...state, yaw: state.yaw - delta }, { snap: true });
  turned = null;
}
export async function prepareMeasurement() {
  if (savedCarets) throw Error("Previous mirror measurement was not released");
  const roots = [document];
  savedCarets = [];
  for (let i = 0; i < roots.length; i++)
    for (const element of roots[i].querySelectorAll("*"))
      if (element.shadowRoot) roots.push(element.shadowRoot);
  for (const root of roots)
    for (const element of root.querySelectorAll("input,textarea,[contenteditable]")) {
      savedCarets.push([
        element,
        element.style.getPropertyValue("caret-color"),
        element.style.getPropertyPriority("caret-color"),
      ]);
      element.style.setProperty("caret-color", "transparent", "important");
    }
  await document.fonts.ready;
}
async function captureNativePNG(clip) {
  const { captureSortedFrame } = await import("/tests/helpers/native-sort.mjs");
  const stage = window.__splashery.player.stage;
  // This is the actual immutable 2D copy returned by the native rendered-frame
  // capture, after both original readiness steps. No model or pixels are replaced.
  const source = await captureSortedFrame(stage);
  const release = stage.holdRendering();
  try {
    const box = stage.canvas.getBoundingClientRect();
    const sx = source.width / box.width,
      sy = source.height / box.height;
    if (sx !== devicePixelRatio || sy !== devicePixelRatio)
      throw Error(
        "Mirror capture has an unexpected native scale: " +
          JSON.stringify({ sx, sy, devicePixelRatio }),
      );
    const x = Math.round((clip.x - box.left) * sx),
      y = Math.round((clip.y - box.top) * sy);
    const width = Math.floor(clip.width + 1e-3) * sx,
      height = Math.floor(clip.height + 1e-3) * sy;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
      throw Error("Mirror capture has a noninteger or empty native clip");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d");
    g.fillStyle = getComputedStyle(document.body).backgroundColor;
    g.fillRect(0, 0, width, height);
    g.drawImage(source, x, y, width, height, 0, 0, width, height);
    return canvas.toDataURL("image/png").split(",")[1];
  } finally {
    release();
  }
}
export async function collectSamples(F, clip, answers, delta) {
  if (turned) throw Error("Previous mirror camera turn was not restored");
  const result = [];
  try {
    for (let sample = 0; sample < answers; sample++) {
      await waitNativeAnswer();
      const { MIRROR } = await import("/src/live/relief.js");
      const cam = MIRROR.cam,
        { cols, rows } = cam,
        h = [],
        c = [];
      for (let j = Math.floor(F.y0 * rows); j < F.y1 * rows; j++)
        for (let i = Math.floor(F.x0 * cols); i < F.x1 * cols; i++) {
          const k = j * cols + i;
          h.push(cam.heights[k]);
          c.push(cam.lastColors[k * 4], cam.lastColors[k * 4 + 1], cam.lastColors[k * 4 + 2]);
        }
      const face = await captureNativePNG(clip);
      const camera = window.__splashery.player.camera,
        state = camera.getState();
      camera.setState({ ...state, yaw: state.yaw + delta }, { snap: true });
      turned = { camera, delta };
      const away = await captureNativePNG(clip);
      restoreCamera();
      result.push({ h, c, face, turned: away });
    }
    return result;
  } finally {
    restoreCamera();
  }
}
export function finishMeasurement() {
  restoreCamera();
  if (savedCarets)
    for (const [element, value, priority] of savedCarets)
      element.style.setProperty("caret-color", value, priority);
  savedCarets = null;
}
