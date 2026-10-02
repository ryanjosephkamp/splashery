// Video to 3D (lane Video 3D): the whole pipeline, from a video file to a trained splat PLY and the
// camera path, with each stage timed. Browser only. Splat.js (vendor/splatjs/, MIT) is loaded here,
// with a dynamic import(), the first time someone opens a video in this toy, and never before.
//
// Stages: frames (the sharpest frame of each window of the chosen stretch), decode, camera path
// (Splat.js's structure from motion: features, matching, registering each camera, bundle
// adjustment), seed, training (Splat.js's WebGPU trainer), export (a standard PLY).

import { planFrames, tierSettings } from "./frames.js";
import { openVideo, grabFrames, closeVideo } from "./extract.js";

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

// file: the video. opts: { start, length, rate, tier, onProgress(e), signal, preview (canvas) }.
// onProgress gets { stage, done, total, note } with stage one of frames, decode, path, seed,
// train, export.
export async function videoTo3D(file, opts = {}) {
  const tier = opts.tier || "mid";
  // opts.settings overrides the tier's (tools/v3d-sample.mjs trains the samples with it).
  const set = { ...tierSettings(tier), ...(opts.settings || {}) };
  const progress = (e) => opts.onProgress?.(e);
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

  // 1. Frames.
  const opened = await openVideo(file);
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
  // set for runs of tens of thousands of steps: its first refine comes at step 2,500, after growth
  // has stopped in any shorter run, so a few thousand steps kept the seed's splats and stayed
  // soft. Here it scales with the run: a refine every 1/30 of it, growth until 80% of it.
  const refineEvery = Math.max(100, Math.min(2500, Math.round(set.iters / 30)));
  const s = splatjs.createSession({
    maxIters: set.iters,
    refineEvery,
    lowMem: tier === "low" || tier === "mid",
    initTarget: set.seed || Math.min(60000, Math.round(set.splats / 3)),
    evalHoldEvery: 1e9,
    sfm: tier === "low" || tier === "mid" ? { siftFeats: 3000, siftFirstOctave: 0, refineAspect: false } : {}, // prettier-ignore
    trainer: { shDeg: 0, maxSplats: set.splats, growUntil: Math.round(set.iters * 0.8), growFrac: 0.25 }, // prettier-ignore
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
    await s.load(files);
    mark("decode");
    if (opts.signal?.aborted) throw new DOMException("Stopped", "AbortError");
    let recon;
    try {
      recon = await s.solve({ signal: opts.signal });
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      // Splat.js says why in its own words (kept in the log); the card says what to try.
      log.push(`solve failed: ${e?.message || e}`);
      throw new Error(
        /parallax|overlap|initiali|register/i.test(e?.message || "")
          ? "The camera path could not be worked out: the frames show the scene from too nearly the same place, or share too little. Try a stretch where the camera moves more (a walk, an orbit, a low flight), or a longer stretch at fewer frames a second."
          : `The camera path could not be worked out (${e?.message || e}).`,
      );
    }
    mark("path");
    if (!recon?.cams?.length || recon.cams.length < 3)
      throw new Error(
        "The camera path could not be worked out from this stretch: too few frames matched. Try a slower, steadier stretch with more texture (not sky, water or blank walls).",
      );
    await s.seed();
    mark("seed");
    if (opts.preview) {
      try {
        s.view.attach(opts.preview);
        s.view.lookThrough(Math.floor(s.trainer.camMeta.length / 2));
      } catch {
        // No live picture: training goes on without it.
      }
    }

    // 5. Training.
    let last = { iter: 0, splats: s.trainer.n };
    s.on("metrics", (m) => {
      last = m;
      progress({ stage: "train", done: m.iter, total: set.iters, note: `${m.splats} splats` });
    });
    progress({ stage: "train", done: 0, total: set.iters });
    await new Promise((resolve) => {
      s.on("event", (e) => {
        if (e.kind === "train-complete" || e.kind === "device-lost") resolve();
      });
      opts.signal?.addEventListener("abort", () => s.finish().then(resolve, resolve));
      s.start();
    });
    if (s.deviceLost) throw new Error("The graphics card stopped the training (the tab may have gone to the background). Try again with a shorter stretch."); // prettier-ignore
    mark("train");

    // 6. Export.
    progress({ stage: "export", done: 0, total: 1 });
    const blob = await s.exportPlyBlob();
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
    return {
      ply,
      cams,
      timings,
      stats: {
        tier,
        adapter: gpu.adapter,
        frames: picks.length,
        registered: recon.cams.length,
        points: recon.points.length,
        splats: last.splats ?? s.trainer.n,
        iters: s.trainer.iter,
        psnr: last.psnrTrain ? Math.round(last.psnrTrain * 10) / 10 : null,
        plyBytes: ply.length,
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
