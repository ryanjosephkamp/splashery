// Video to 3D (lane Video 3D): the whole pipeline, from a video file to a trained splat PLY and the
// camera path, with each stage timed. Browser only. Splat.js (vendor/splatjs/, MIT) is loaded here,
// with a dynamic import(), the first time someone opens a video in this toy, and never before.
//
// Stages: frames (the sharpest frame of each window of the chosen stretch), decode, camera path
// (Splat.js's structure from motion: features, matching, registering each camera, bundle
// adjustment), seed, training (Splat.js's WebGPU trainer), export (a standard PLY).

import { planFrames, tierSettings } from "./frames.js";
import { openVideo, grabFrames, closeVideo } from "./extract.js";
import { runWithDeadline } from "./deadline.js";
import { surfaceSeed } from "./surface-seed.js";

const SPLATJS = "../../vendor/splatjs/src/session.js";

let splatjs = null;
export const splatjsLoaded = () => !!splatjs;

// Whether this browser has WebGPU and an adapter: { ok, adapter, reason }.
export async function webgpuStatus() {
  if (typeof navigator === "undefined" || !navigator.gpu)
    return { ok: false, adapter: "", reason: "This browser has no WebGPU." };
  try {
    const a = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!a) return { ok: false, adapter: "", reason: "WebGPU is here but found no graphics adapter." }; // prettier-ignore
    return { ok: true, adapter: adapterName(a.info), reason: "" };
  } catch (e) {
    return { ok: false, adapter: "", reason: `WebGPU failed to start (${e?.message || e}).` };
  }
}

function adapterName(info = {}) {
  const parts = [info.vendor, info.architecture, info.device, info.description].filter(Boolean);
  return [...new Set(parts)].join(" ") || "unnamed adapter";
}

// Whether this looks like a phone or a tablet (r7): the toy then picks the phone-safe setting and
// trains gently. globalThis.__v3dPhone (the tests) overrides it.
export function isPhone() {
  if (globalThis.__v3dPhone != null) return !!globalThis.__v3dPhone;
  const nav = globalThis.navigator;
  if (!nav) return false;
  if (nav.userAgentData?.mobile) return true;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || "")) return true;
  // An iPad says it is a Mac: a touch screen on "Macintosh" is one.
  return /Macintosh/.test(nav.userAgent || "") && (nav.maxTouchPoints || 0) > 1;
}

// A rough time for a setting, in minutes [low, high], before anything is measured (r7): the camera
// path takes a few seconds a frame, and a training step a fraction of a second on a graphics card
// (more on a phone). The card shows the measured time left once training starts.
const STEP_SECS = { phone: [0.12, 0.4], low: [0.03, 0.12], mid: [0.04, 0.15], high: [0.06, 0.2], max: [0.1, 0.3] }; // prettier-ignore
export function estimateMinutes(tier, set = tierSettings(tier)) {
  const step = STEP_SECS[tier] || STEP_SECS.mid;
  const frames = set.maxFrames;
  const lo = (frames * 1.5 + set.iters * step[0]) / 60;
  const hi = (frames * (tier === "phone" ? 8 : 4) + set.iters * step[1]) / 60;
  return [Math.max(1, Math.round(lo)), Math.max(2, Math.round(hi))];
}

// Splat.js's reasons a camera path fails, in plain words, with what to try (r7).
export function solveMessage(raw) {
  const m = String(raw || "");
  if (/no image pair with enough matches/i.test(m))
    return "No two frames shared enough of the same details to line them up, even with looser matching. That happens when the camera turns on the spot instead of moving, when the frames are mostly sky, water or blank walls, or when they are blurred. Try a stretch where the camera walks or flies sideways past something with plenty of texture, held steady.";
  if (/parallax|overlap|initiali|register/i.test(m))
    return "The camera path could not be worked out: the frames show the scene from too nearly the same place, or share too little. Try a stretch where the camera moves more (a walk, an orbit, a low flight), or a longer stretch at fewer frames a second.";
  return `The camera path could not be worked out (${m}). Try a slower, steadier stretch of a scene with more texture.`;
}

// Looser matching for the one retry when the first solve fails (r7): more features, found at a
// finer scale and at lower contrast, and a lower bar for a pair of frames to count as matched.
export const RELAXED_SFM = {
  siftFeats: 8192,
  siftFirstOctave: -1,
  siftPeak: 0.5,
  pairMinInliers: 40,
};

// Groups Splat.js's many solve stages into the three the page shows.
const STAGE_OF = {
  decode: "decode",
  features: "path",
  matching: "path",
  pass: "path",
  register: "path",
  ba: "path",
  focal: "path",
  solved: "path",
  seed: "seed",
  train: "train",
};

// Both the first refinement and its cadence must fit the run. A phone used to finish at
// 1,200 steps before the trainer's default first refinement at 1,500, so it never grew detail.
export function refinementSchedule(iters) {
  return {
    refineStart: Math.min(1500, Math.max(1, Math.round(iters * 0.1))),
    refineEvery: Math.max(100, Math.min(2500, Math.round(iters / 30))),
    growUntil: Math.round(iters * 0.8),
  };
}

// file: the video. opts: { start, length, rate, tier, onProgress(e), signal, preview (canvas) }.
// onProgress gets { stage, done, total, note } with stage one of frames, decode, path, seed,
// train, export.
export async function videoTo3D(file, opts = {}) {
  const tier = opts.tier || "mid";
  const gentle = tier === "phone";
  // opts.settings overrides the tier's (tools/v3d-sample.mjs trains the samples with it).
  const set = { ...tierSettings(tier), ...(opts.settings || {}) };
  const timeLimitMinutes = set.maxMinutes ?? 15;
  const progress = (e) => opts.onProgress?.(e.stage === "train" ? { ...e, timeLimitMinutes } : e);
  const timings = {};
  const t0 = performance.now();
  let lap = t0;
  const mark = (k) => {
    const now = performance.now();
    timings[k] = Math.round((now - lap) / 100) / 10;
    lap = now;
  };
  const gpu = await webgpuStatus();
  if (!gpu.ok) throw new Error(`${gpu.reason} Video to 3D trains on the graphics card through WebGPU: try a current Chrome, Edge, Safari or Firefox.`); // prettier-ignore
  const software = /swiftshader|llvmpipe|lavapipe|software/i.test(gpu.adapter);

  // 1. Frames.
  const opened = await openVideo(file, { signal: opts.signal });
  let picks;
  let plan;
  try {
    plan = planFrames({
      duration: opened.duration,
      start: opts.start ?? 0,
      length: opts.length ?? 10,
      rate: opts.rate ?? 3,
      maxFrames: set.maxFrames,
    });
    progress({ stage: "frames", done: 0, total: plan.windows.length });
    picks = await grabFrames(opened, plan, {
      side: set.frameSide,
      tries: 3,
      signal: opts.signal,
      onFrame: (d, n) => progress({ stage: "frames", done: d, total: n }),
    });
  } finally {
    closeVideo(opened);
  }
  mark("frames");

  // 2 to 4. Splat.js: decode, the camera path, seed.
  progress({ stage: "load", done: 0, total: 1, note: "Loading the splat trainer…" });
  if (!splatjs) splatjs = await import(SPLATJS);
  // Splat.js's refine schedule (grow splats where the picture is wrong, move the dead ones) is
  // set for runs of tens of thousands of steps: its first refine starts after step 1,500.
  // Here the first threshold and cadence scale with the run, with growth until 80% of it.
  // A very slow device may reach the wall-time limit before reaching the first threshold.
  const { refineStart, refineEvery, growUntil } = refinementSchedule(set.iters);
  const seedTarget = set.seed || Math.min(60000, Math.round(set.splats / 3));
  const s = splatjs.createSession({
    maxIters: set.iters,
    refineStart,
    refineEvery,
    // The only live view is the small progress preview. Reserving a 2,560 × 1,440 render
    // target on every phone wastes memory; the session also fits every training camera.
    maxViewW: Math.max(set.trainSide, opts.preview?.width || 0),
    maxViewH: Math.max(set.trainSide, opts.preview?.height || 0),
    lowMem: gentle || tier === "low" || tier === "mid",
    // Software adapters also need bounded submissions: a desktop-sized adaptive batch can
    // queue minutes of work before the main thread gets a chance to explain a deadline.
    // Keep the native image sizes, iteration budgets, and optimizer unchanged.
    ...(gentle || software ? { itersPerFrame: 2, fenceRing: software ? 1 : 2 } : {}),
    initTarget: seedTarget,
    // Distant low-parallax triangulations can move the arithmetic mean far outside
    // the scene. Keep every point, with robust bounds for initial scales and learning rates.
    robustSeedBounds: true,
    evalHoldEvery: 1e9,
    sfm: { uiYield: true, ...(software ? { maxPairsPerChunk: 4 } : {}), ...(gentle || tier === "low" || tier === "mid" ? { siftFeats: 3000, siftFirstOctave: 0, refineAspect: false } : {}) }, // prettier-ignore
    // Both sorts use the same unsigned depth/id order. A software adapter avoids emulating
    // the parallel bitonic network's barriers; hardware keeps the established parallel path.
    trainer: { shDeg: 0, fitBackground: true, maxSplats: set.splats, growUntil, ...(software ? { serialSort: true, tileGrad: false } : {}) }, // prettier-ignore
    frames: { trainMaxDim: set.trainSide, featMaxDim: set.featSide },
  });
  const stop = () => {
    s.training = false;
  };
  opts.signal?.addEventListener("abort", stop);
  const log = [];
  s.on("log", (m) => log.push(m));
  s.on("stage", (e) => {
    const stage = STAGE_OF[e.stage];
    if (stage && stage !== "train") progress({ stage, done: e.done, total: e.total, note: e.stage }); // prettier-ignore
  });
  const files = picks.map((p, i) => new File([p.blob], `frame_${String(i).padStart(3, "0")}.jpg`, { type: "image/jpeg" })); // prettier-ignore
  const timeOf = new Map(files.map((f, i) => [f.name, picks[i].time]));
  try {
    await runWithDeadline(() => s.load(files), {
      signal: opts.signal,
      timeoutMs: 60000,
      message:
        "This device could not decode the training pictures in time. Try a shorter MP4 (H.264) clip.",
    });
    mark("decode");
    if (opts.signal?.aborted) throw new DOMException("Stopped", "AbortError");
    // The camera path, and once more with looser matching if that fails (r7).
    const solveOnce = async (extra, signal) => {
      try {
        if (signal.aborted) throw new DOMException("Stopped", "AbortError");
        const r = await s.solve({ signal, ...extra });
        if (r?.cams?.length >= 3) return { recon: r };
        return { error: `only ${r?.cams?.length ?? 0} cameras placed (too few frames matched)` };
      } catch (e) {
        if (e?.name === "AbortError") throw e;
        return { error: e?.message || String(e) };
      }
    };
    const { solved, retried } = await runWithDeadline(
      async (signal) => {
        let solved = await solveOnce({}, signal);
        let retried = false;
        if (solved.error) {
          // Splat.js says why in its own words (kept in the log); the card says what to try.
          log.push(`solve failed: ${solved.error}; trying again with looser matching`);
          progress({ stage: "path", done: 0, total: 1, note: "retry" });
          retried = true;
          const relaxed = gentle ? { ...RELAXED_SFM, siftFirstOctave: 0 } : RELAXED_SFM;
          solved = await solveOnce(relaxed, signal);
        }
        if (solved.error) {
          log.push(`solve failed again: ${solved.error}`);
          throw new Error(solveMessage(solved.error));
        }
        return { solved, retried };
      },
      {
        signal: opts.signal,
        timeoutMs: (gentle ? 3 : 6) * 60000,
        message:
          "This device could not solve the camera path in time. Try a shorter, steadier stretch, or the Phone-safe setting.",
      },
    );
    const recon = solved.recon;
    mark("path");
    // Replace some jittered copies of sparse features with small, oriented surface samples.
    // Every new point lies inside a local sparse triangle and has color support in another
    // recorded camera. Keep the same total seed budget; unsupported regions retain sparse seeds.
    const surface = surfaceSeed(recon, s.frames, {
      maxPoints: Math.min(30000, Math.floor(seedTarget * 0.92)),
    });
    const seeded = await runWithDeadline(
      () =>
        s.seed({
          initTarget: seedTarget - surface.n,
          seedLimit: seedTarget,
          appendGaussians: {
            ...surface,
            protectIters: refineStart + refineEvery,
            note: "multiview surface detail",
          },
        }),
      {
        signal: opts.signal,
        timeoutMs: 90000,
        message:
          "The graphics card could not prepare training in time. Try the Phone-safe setting, or a shorter stretch.",
      },
    );
    mark("seed");
    if (opts.signal?.aborted) throw new DOMException("Stopped", "AbortError");
    if (opts.preview) {
      try {
        s.view.attach(opts.preview);
        s.view.lookThrough(Math.floor(s.trainer.camMeta.length / 2));
        // Show the initialized geometry before the first optimizer batch queues behind it.
        s.view.renderNow();
      } catch {
        // No live picture: training goes on without it.
      }
    }

    // 5. Training.
    let lastPsnr = null;
    s.on("metrics", (m) => {
      if (Number.isFinite(m.psnrTrain)) lastPsnr = { value: m.psnrTrain, iter: m.iter };
      progress({ stage: "train", done: m.iter, total: set.iters, note: `${m.splats} splats` });
    });
    progress({ stage: "train", done: 0, total: set.iters });
    let timedOut = false;
    let trainingError = null;
    await new Promise((resolve) => {
      let over = false;
      let halt = false; // stopping: the bursts and the tab's visibility no longer restart training
      const end = () => {
        if (over) return;
        over = true;
        clearInterval(duty);
        clearTimeout(limit);
        opts.signal?.removeEventListener("abort", abortTraining);
        globalThis.document?.removeEventListener?.("visibilitychange", onVisible);
        resolve();
      };
      s.on("event", (e) => {
        if (e.kind === "train-error") {
          trainingError = new Error(
            "The graphics card could not continue training. Try the Phone-safe setting, or a shorter stretch.",
          );
          end();
        }
        if (e.kind === "train-complete" || e.kind === "device-lost") end();
      });
      // Stop keeps what has been trained so far: training finishes early and the splats export.
      const abortTraining = () => {
        if (halt || over) return;
        halt = true;
        progress({ stage: "train", done: s.trainer?.iter ?? 0, total: set.iters, finishing: true });
        runWithDeadline(() => s.finish(), {
          timeoutMs: 60000,
          message:
            "The graphics card stopped answering while finishing. Try a shorter stretch, or the Phone-safe setting.",
        }).then(end, (error) => {
          trainingError = error;
          end();
        });
      };
      opts.signal?.addEventListener("abort", abortTraining, { once: true });
      // A phone trains in bursts with rests (about 3 s on, 2 s off) so it stays cool and
      // responsive, pauses while the tab is hidden (a phone takes the graphics card back from a
      // background tab), and finishes with what it has after a time limit.
      let duty = null;
      let limit = null;
      const hidden = () => globalThis.document?.visibilityState === "hidden";
      const onVisible = () => {
        if (over || halt) return;
        if (hidden()) s.pause();
        else s.start();
      };
      if (gentle) {
        let on = true;
        let ticks = 0;
        duty = setInterval(() => {
          if (over || halt || hidden()) return;
          ticks++;
          if (on && ticks >= 3) {
            on = false;
            ticks = 0;
            s.pause();
          } else if (!on && ticks >= 2) {
            on = true;
            ticks = 0;
            s.start();
          }
        }, 1000);
      }
      limit = setTimeout(() => {
        if (halt || over) return;
        timedOut = true;
        abortTraining();
      }, timeLimitMinutes * 60000);
      globalThis.document?.addEventListener?.("visibilitychange", onVisible);
      s.start();
    });
    if (trainingError) throw trainingError;
    if (s.deviceLost) throw new Error("The graphics card stopped the training (the tab may have gone to the background). Try again with a shorter stretch."); // prettier-ignore
    mark("train");

    // 6. Export.
    progress({ stage: "export", done: 0, total: 1 });
    // Fit only three display-environment parameters to the completed model's actual training
    // targets. The engine excludes every evaluation camera and requires >=1% training MSE gain
    // with no MSE increase on any existing internal validation camera. Otherwise keep black.
    let backgroundFit;
    try {
      backgroundFit = await runWithDeadline((signal) => s.fitBackground({ signal }), {
        timeoutMs: 60000,
        message:
          "The graphics card could not finish this scene in time. Try the Phone-safe setting, or a shorter stretch.",
      });
    } catch (error) {
      // This optional display fit never changes the trained model. A slow readback should
      // keep that model on its original black background, rather than discard a completed bake.
      // The engine serializes export behind the canceled fit's readback cleanup.
      backgroundFit = { accepted: false, reason: "fit-unavailable", error: error?.message || String(error) }; // prettier-ignore
      log.push(`Background fitting unavailable; keeping the trained model: ${backgroundFit.error}`);
    }
    mark("background");
    if (s.deviceLost || s.trainingError)
      throw new Error(
        "The graphics card could not finish this scene. Try the Phone-safe setting, or a shorter stretch.",
      );
    const blob = await runWithDeadline(() => s.exportPlyBlob(), {
      timeoutMs: 60000,
      message:
        "The graphics card stopped answering while saving the scene. Try the Phone-safe setting, or a shorter stretch.",
    });
    const ply = new Uint8Array(await blob.arrayBuffer());
    mark("export");
    progress({ stage: "export", done: 1, total: 1 });
    const cams = recon.cams
      .map((c) => {
        const f = s.frames[c.imgIdx];
        return { time: timeOf.get(f?.name) ?? 0, R: Array.from(c.R), t: Array.from(c.t), f: c.f, w: f?.fw, h: f?.fh }; // prettier-ignore
      })
      .sort((a, b) => a.time - b.time);
    timings.total = Math.round((performance.now() - t0) / 100) / 10;
    const exportCameras = s.trainer.camMeta.map((c) => ({
      f: c.f,
      fy: c.fy ?? c.f,
      w: c.w,
      h: c.h,
      R: Array.from(c.R),
      t: Array.from(c.t),
    }));
    // These wall-time counters already exist in the session. Retain their summary with a
    // custom bake so a slow run can be diagnosed without adding profiling GPU dispatches.
    const batches = s.perf?.frames || [],
      sumBatch = (index) => Math.round(batches.reduce((sum, row) => sum + row[index], 0)),
      trainingLoop = {
        batches: batches.length,
        submittedSteps: sumBatch(2),
        encodeMs: sumBatch(4),
        viewSubmitMs: sumBatch(5),
        fenceWaitMs: sumBatch(6),
        metricsWaitMs: sumBatch(7),
        batchWallMs: sumBatch(8),
      };
    return {
      ply,
      cams,
      exportCam0: exportCameras[0],
      exportCameras,
      timings,
      stats: {
        tier,
        adapter: gpu.adapter,
        frames: picks.length,
        registered: recon.cams.length,
        points: recon.points.length,
        surfacePoints: seeded.appendedSeedCount ?? 0,
        generatedSurfacePoints: surface.n,
        seedSplats: seeded.n,
        seedBounds: "coordinate-median",
        seedSceneRadius: seeded.radius,
        trainingBackground: [0, 0, 0],
        ...(backgroundFit.accepted ? { renderBackground: backgroundFit.rgb } : {}),
        backgroundFit: { method: "constant-training-environment", ...backgroundFit },
        splats: s.trainer.n,
        iters: s.trainer.iter,
        psnr: lastPsnr ? Math.round(lastPsnr.value * 10) / 10 : null,
        psnrAtIter: lastPsnr?.iter ?? null,
        trainSide: Math.max(...exportCameras.map((c) => Math.max(c.w, c.h))),
        plyBytes: ply.length,
        retried,
        timedOut,
        timeLimitMinutes,
        softwareSort: !!s.trainer.serialSort,
        softwareDirectGradient: software && !s.trainer.tileGrad,
        trainingLoop,
        stoppedEarly: !!opts.signal?.aborted || timedOut,
        start: plan.start,
        end: plan.end,
        rate: plan.rate,
      },
      log: log.slice(-40),
    };
  } finally {
    opts.signal?.removeEventListener("abort", stop);
    s.dispose();
  }
}
