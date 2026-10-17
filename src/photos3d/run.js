// MIT. Made by Ryan with Codex (GPT-6). Local-only labs module, imported only by callers.
import { decodeFrames } from "../../vendor/splatjs/src/io/frames.js";
import { createGpu } from "../../vendor/splatjs/src/gpu/context.js";
import { createSession } from "../../vendor/splatjs/src/session.js";
import { tierSettings } from "../video3d/frames.js";
import { refinementSchedule } from "../video3d/run.js";
import { surfaceSeed } from "../video3d/surface-seed.js";
import { photoSettings, groupLenses } from "./lenses.js";
import { extractFeatures, matchGraph, summarizeGraph } from "./graph.js";
import { solvePhotoGraph } from "./solve.js";
import { appearanceFold } from "./appearance.js";

export const PHOTOS_3D = Object.freeze({ id: "photos-to-3d", labs: true });

/** File[] or {source,name,exif}[] -> solved geometry and complete per-photo diagnostics.
 * RGB/masks never participate in geometry. Files stay in this tab. Caller owns frames afterward.
 * Missing EXIF requires focal35 or assumeSingleLens:true; that assumption is returned explicitly.
 */
export async function solvePhotos(files, options = {}) {
  if (files.length < 8 || files.length > 60) throw new RangeError("Pick 8–60 photos");
  if (new Set(files.map((f) => f.name)).size !== files.length || files.some((f) => !f.name))
    throw new Error("Photos need unique, nonempty names");
  const { signal, onProgress = () => {} } = options;
  const settings = photoSettings(options.profile, options.featureSide);
  const tier = tierSettings(settings.profile);
  const ordered = [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const frames = await decodeFrames(ordered, {
    signal,
    featMaxDim: settings.featureSide,
    trainMaxDim: tier.trainSide,
    log: (message) => onProgress({ stage: "decode", message }),
  });
  signal?.throwIfAborted();
  const lenses = groupLenses(frames, options);
  const retained = frames.filter((_, i) => lenses[i].accepted);
  const rejected = ordered
    .filter((f) => !frames.some((im) => im.name === f.name))
    .map((f) => ({ name: f.name, reason: "Browser could not decode this photo" }))
    .concat(lenses.filter((l) => !l.accepted).map(({ name, reason }) => ({ name, reason })));
  const solution = { settings, frames: retained, lenses, rejected, recon: null, graph: null };
  if (retained.length < 8)
    return { ...solution, error: "Fewer than eight photos in the supported lens group" };
  const calibration = lenses
    .filter((l) => l.accepted)
    .map((lens, i) => ({
      f: lens.focalPx || 1.2 * Math.max(retained[i].fw, retained[i].fh),
      cx: retained[i].fw / 2,
      cy: retained[i].fh / 2,
    }));
  const features = await extractFeatures(retained, options);
  let gpu;
  try {
    if (options.cpuMatching !== true && globalThis.navigator?.gpu) gpu = await createGpu();
    const edges = await matchGraph(retained, features, calibration, { ...options, gpu });
    solution.graph = summarizeGraph(retained, features, edges);
    try {
      solution.recon = await solvePhotoGraph(retained, features, edges, calibration, {
        signal,
        onProgress,
        unknownFocal: calibration.some((_, i) => !lenses.filter((l) => l.accepted)[i].focalPx),
      });
      solution.graph = summarizeGraph(
        retained,
        features,
        edges,
        new Set(solution.recon.cams.map((c) => c.imgIdx)),
      );
      solution.recon.features = solution.recon.features.map(({ x, y }) => ({ x, y }));
      for (const frame of retained) frame.gray = null;
    } catch (error) {
      signal?.throwIfAborted();
      solution.error = error.message;
    }
  } finally {
    if (gpu?.owned) gpu.dispose();
  }
  return solution;
}

/** Start a new independent appearance fold using Video to 3D's unchanged trainer/surface seed.
 * The returned Session supports start(), pause(), finish(), exportPlyBlob(), and dispose().
 * Evaluation frames are not uploaded. Render a held-out camera separately with trainer.renderView.
 */
export async function seedPhotos(
  solution,
  { heldOut = [], software = false, signal, onProgress = () => {}, ...limits } = {},
) {
  if (!solution.recon) throw new Error(solution.error || "Solve cameras first");
  const fold = appearanceFold(solution, heldOut);
  const set = tierSettings(solution.settings.profile);
  const iterations = limits.iterations ?? set.iters;
  const refine = refinementSchedule(iterations);
  const target = Math.min(set.splats, limits.seed ?? set.seed ?? 60000);
  if (!Number.isInteger(iterations) || iterations < 1 || !Number.isInteger(target) || target < 8)
    throw new RangeError("Iterations and seed count must be positive integers");
  const session = createSession({
    maxIters: iterations,
    ...refine,
    lowMem: true,
    robustSeedBounds: true,
    itersPerFrame: 2,
    fenceRing: software ? 1 : 2,
    maxViewW: set.trainSide,
    maxViewH: set.trainSide,
    holdout: -1,
    evalSplit: 0,
    evalHoldEvery: 1e9,
    trainer: {
      seed: 104,
      shDeg: 0,
      fitBackground: false,
      camOpt: false,
      maxSplats: set.splats,
      growUntil: refine.growUntil,
      ...(software
        ? {
            serialSort: true,
            tileGrad: false,
            tileSize: 8,
            maxRasterTiles: Math.ceil(set.trainSide / 8) ** 2,
          }
        : {}),
    },
  });
  const cancel = () => session.dispose();
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    signal?.throwIfAborted();
    session.on("stage", onProgress);
    session.useFrames(fold.frames);
    session.useReconstruction(fold.recon);
    const surface = surfaceSeed(fold.recon, fold.frames, {
      maxPoints: Math.min(30000, Math.floor(target * 0.92)),
    });
    await session.seed({
      initTarget: Math.max(1, target - surface.n),
      seedLimit: target,
      appendGaussians: {
        ...surface,
        protectIters: refine.refineStart + refine.refineEvery,
        note: "training photos only",
      },
    });
    // Session's video blur policy is separate from the caller's explicit photo split. Train
    // every remaining registered photo; never silently create a second evaluation split.
    const automaticBlurExclusionsDisabled = [...session.trainer.excluded].map(
      (i) => session.frames[session.trainer.camMeta[i].imgIdx].name,
    );
    session.trainer.excluded.clear();
    signal?.throwIfAborted();
    return {
      session,
      trainingNames: fold.trainingNames,
      heldOut: fold.heldOut,
      surfacePoints: surface.n,
      automaticBlurExclusionsDisabled,
    };
  } catch (error) {
    session.dispose();
    throw error;
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}
