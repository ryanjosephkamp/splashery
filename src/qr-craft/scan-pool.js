// Only Most detail starts these local workers. No picture or payload leaves the device.
import { checkStrict, STRICT, rasterize } from "./picture.js";
import {
  cameraFrames,
  checkPreparedFrames,
  checkPreparedFramesBoth,
  resizeFrame,
} from "./views.js";
import { detailFrame, textureFrame } from "./frame.js";
import { shapeHalf } from "../qr/circle.js";
import { scanEstimate } from "./fidelity.js";
let workers = null,
  next = 0,
  serial = 0,
  previousPredictionFailure = null;
const pending = new Map();
function pool() {
  if (workers) return workers;
  const count = Math.min(4, Math.max(1, navigator.hardwareConcurrency || 2));
  workers = Array.from({ length: count }, () => {
    const worker = new Worker(new URL("./scan-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      if (data.error) job.reject(new Error(data.error));
      else job.resolve(data.result);
    };
    worker.onerror = () => {
      for (const job of pending.values()) job.reject(new Error("The local scan worker stopped."));
      pending.clear();
      for (const w of workers || []) w.terminate();
      workers = null;
    };
    return worker;
  });
  return workers;
}
// Timeouts and replaced requests cancel work instead of restarting it locally.
export function cancelDetailChecks() {
  const error = new DOMException("The detail request was canceled.", "AbortError");
  for (const job of pending.values()) job.reject(error);
  pending.clear();
  for (const worker of workers || []) worker.terminate();
  workers = null;
  next = 0;
}

function request(job, transfer = []) {
  return new Promise((resolve, reject) => {
    const active = pool(),
      id = ++serial;
    pending.set(id, { resolve, reject });
    try {
      active[next++ % active.length].postMessage({ ...job, id }, transfer);
    } catch (error) {
      pending.delete(id);
      reject(error);
    }
  });
}
export function partitionFrames(frames, count = 4) {
  // Both blur levels of an image belong to one worker. Each source buffer
  // transfers once, and the worker keeps its original pixels for both blurs.
  const images = new Map();
  for (const frame of frames) {
    const buffer = frame.image.data.buffer;
    if (!images.has(buffer)) images.set(buffer, []);
    images.get(buffer).push(frame);
  }
  const cost = (frames) => frames[0].image.width * frames[0].image.height * frames.length;
  const groups = Array.from({ length: count }, () => ({ frames: [], cost: 0 }));
  for (const image of [...images.values()].sort((a, b) => cost(b) - cost(a))) {
    const group = groups.reduce((a, b) => (a.cost <= b.cost ? a : b));
    group.frames.push(...image);
    group.cost += cost(image);
  }
  return groups.filter((g) => g.frames.length).map((g) => g.frames);
}
async function localFrames(frames, text, read, dual) {
  if (!dual) return checkPreparedFrames(frames, read, text);
  try {
    const second = await (await import("./second-reader.js")).loadSecondReader();
    return await checkPreparedFramesBoth(frames, read, text, second);
  } catch (error) {
    return { ok: false, reader: "zxingcpp", error: error.message };
  }
}
async function validateFrames(makeFrames, text, read, dual = false) {
  const frames = makeFrames();
  if (typeof Worker !== "undefined") {
    try {
      const start = performance.now();
      const results = await Promise.all(
        partitionFrames(frames).map((group) =>
          request({ text, frames: group, dual }, [
            ...new Set(group.map((f) => f.image.data.buffer)),
          ]),
        ),
      );
      return {
        ...(results.find((r) => !r.ok) || {
          ok: true,
          ...(dual ? { readers: ["jsqr", "zxingcpp"] } : {}),
        }),
        workers: workers?.length || 0,
        ms: performance.now() - start,
        parts: results.map((r) => r.ms),
      };
    } catch (error) {
      if (error.name === "AbortError") throw error;
      // Rebuild identical pixels: transferred buffers may already be detached.
      return localFrames(makeFrames(), text, read, dual);
    }
  }
  return localFrames(frames, text, read, dual);
}
export async function validateDetail(woven, picture, shape, read) {
  // All four original layout checks run before the additional camera matrix.
  if (!(await validateStrict(woven, read))) return { ok: false, layout: true };
  const texture = woven.rendering?.texture === "tiles" ? textureFrame(woven, picture, shape) : null;
  const estimated = texture ? null : scanEstimate(woven);
  const modules = 2 * (shapeHalf(woven.code, shape) + 1);
  const at = texture
    ? (ppm) => resizeFrame(texture, Math.round(modules * ppm))
    : (ppm) => detailFrame(estimated, picture, ppm, shape);
  const cache = new Map();
  const predictedAt =
    woven.rendering?.validation === "capture"
      ? (ppm) => cache.get(ppm) || cache.set(ppm, at(ppm)).get(ppm)
      : at;
  // The small, more blurred front view cheaply rejects fragile halftones.
  // Successful candidates still run all 24 camera conditions below.
  const small = {
    ppm: 4,
    blur: 0.3 + (woven.rendering?.textureGuard || 0),
    view: 0,
    image: predictedAt(4),
  };
  const checkPrediction = async (frame) => {
    if (typeof Worker !== "undefined") {
      try {
        return await request({ frames: [frame], text: woven.code.text });
      } catch (error) {
        if (error.name === "AbortError") throw error;
        /* Run the same prediction locally if a worker cannot run. */
      }
    }
    return checkPreparedFrames([frame], read, woven.code.text);
  };
  let preflight = await checkPrediction(small);
  if (!preflight.ok) return { ...preflight, preflight: true };
  if (woven.rendering?.validation === "capture") {
    // Keep the cheap rejection first. Small yaw and combined lighting can
    // expose finder failures that increasing picture contrast cannot fix.
    // All independent predictions use separate workers.
    const perspectives = await Promise.all(
      [
        // Put the smaller images first so their workers can take the last
        // two phone-size checks while the other phone checks are running.
        ...cameraFrames(predictedAt, { ppm: 4, blur: 0.3, views: [1, 2, 5] }),
        ...cameraFrames(predictedAt, { ppm: 8, views: [1, 2, 5] }).filter(
          (f) => f.blur !== 0.2 || f.view !== 5,
        ),
      ].map(checkPrediction),
    );
    preflight = perspectives.find((result) => !result.ok);
    if (preflight) return { ...preflight, preflight: true };
  }
  // The capture path runs the complete two-reader matrix on actual pixels
  // before uncovering. Its prediction is only an inexpensive rejection gate.
  if (woven.rendering?.validation === "capture")
    return { ok: true, layoutChecked: true, cameraDeferred: true };
  // A failed camera condition is an exact subset of the complete matrix.
  // Try it first on the next model candidate; every accepted candidate still
  // runs the complete matrix below. Keep only coordinates, never picture data.
  if (previousPredictionFailure) {
    const previous = previousPredictionFailure;
    const preferred = cameraFrames((ppm) => (ppm === 4 ? small.image : at(ppm)), {
      ppm: previous.ppm,
      views: [previous.view],
    })
      .map((frame) => ({
        ...frame,
        blur: frame.blur + (woven.rendering?.textureGuard || 0),
      }))
      .find((frame) => frame.blur === previous.blur);
    if (preferred) {
      let early;
      if (typeof Worker !== "undefined") {
        try {
          early = await request({ frames: [preferred], text: woven.code.text, dual: !!texture });
        } catch (error) {
          if (error.name === "AbortError") throw error;
          /* The worker receives a copy, so the same pixels remain for fallback. */
        }
      }
      early ||= await localFrames([preferred], woven.code.text, read, !!texture);
      if (!early.ok) return { ...early, preflight: true, layoutChecked: true };
    }
  }
  const prediction = await validateFrames(
    () =>
      cameraFrames(at).map((frame) => ({
        ...frame,
        blur: frame.blur + (woven.rendering?.textureGuard || 0),
      })),
    woven.code.text,
    read,
    !!texture,
  );
  if (
    !prediction.ok &&
    [4, 8].includes(prediction.ppm) &&
    Number.isFinite(prediction.blur) &&
    Number.isInteger(prediction.view) &&
    prediction.view >= 0 &&
    prediction.view <= 5
  )
    previousPredictionFailure = {
      ppm: prediction.ppm,
      blur: prediction.blur,
      view: prediction.view,
    };
  return { ...prediction, layoutChecked: true };
}

export function strictFrames(woven) {
  const images = new Map();
  return STRICT.map(({ ppm, blur }) => ({
    ppm,
    blur,
    view: 0,
    image: images.get(ppm) || images.set(ppm, rasterize(woven, ppm)).get(ppm),
  }));
}
async function validateStrict(woven, read) {
  if (typeof Worker !== "undefined") {
    try {
      const frames = strictFrames(woven),
        hardest = frames.findIndex((frame) => frame.ppm === 4 && frame.blur === 0.3),
        [first] = frames.splice(hardest, 1);
      if (!(await request({ frames: [first], text: woven.code.text })).ok) return false;
      const results = await Promise.all(
        frames.map((frame) => request({ frames: [frame], text: woven.code.text })),
      );
      return results.every((r) => r.ok);
    } catch (error) {
      if (error.name === "AbortError") throw error;
      /* Keep every original layout check if workers are unavailable. */
    }
  }
  return checkStrict(woven, read);
}
export async function validateCapture(image, modules, text, read, dual = false) {
  return validateFrames(
    () => cameraFrames((ppm) => resizeFrame(image, Math.round(modules * ppm))),
    text,
    read,
    dual,
  );
}
