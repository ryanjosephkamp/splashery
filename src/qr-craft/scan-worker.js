// Same reader and pixels as the main thread, split across camera conditions.
import "../../vendor/jsqr/jsQR.js";
import { loadBlurKernel } from "./fast-blur.js";
import { checkPreparedFrames, checkPreparedFramesBoth } from "./views.js";
const read = (data, width, height) =>
  self.jsQR(data, width, height, { inversionAttempts: "dontInvert" })?.data ?? null;
const ready = loadBlurKernel();
// These workers exist only for Most detail. Prepare its independent reader
// alongside layout checks, so fetching/compilation overlaps the stage build.
const secondReady = import("./second-reader.js").then((module) => module.loadSecondReader());
secondReady.catch(() => {}); // A dual job reports the failure through the normal fallback.
self.onmessage = async ({ data: job }) => {
  try {
    await ready;
    const start = performance.now();
    const result = job.dual
      ? await checkPreparedFramesBoth(job.frames, read, job.text, await secondReady)
      : checkPreparedFrames(job.frames, read, job.text);
    self.postMessage({ id: job.id, result: { ...result, ms: performance.now() - start } });
  } catch (error) {
    self.postMessage({ id: job.id, error: error.message });
  }
};
