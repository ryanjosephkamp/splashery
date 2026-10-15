#!/usr/bin/env node
// Render an existing Video to 3D PLY through Splat.js at a recorded camera, without solving or
// training. The canvas keeps the source aspect; its default size matches the compact training.
// SPLASHERY_URL=http://127.0.0.1:4175 SPLASHERY_CHROMIUM=/usr/bin/chromium \
// node tools/cdx-v3d-native-preview.mjs <scene.ply> <scene.json> <output.png> [--camera=0] [--side=600]
// --baked renders the exported opacity directly, with native Mip compensation disabled.
// Older metadata without bake.settings.trainSide needs --input-train=<original training side>,
// or --baked. The original opacity-compensation resolution is not inferred from the PLY.
// By default the export's compensation is reversed at its recorded training resolution, then
// native Mip compensation is applied by the view renderer. No optimization steps run by default.
// Genuine continuation, reusing the recorded cameras without another solve:
// --continue-output=/tmp/new-scene --source=selected-cut.webm [--iters=1280] [--seconds=1200]
// [--train=256] [--splats=40000]. New PLY/JSON/log files are written; existing files are refused.
// --source-origin=<json> records a verified native cut, capture SHA-256, and ffmpeg command.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const [plyFile, jsonFile, output] = args.filter((arg) => !arg.startsWith("--"));
if (!plyFile || !jsonFile || !output)
  throw new Error("Usage: cdx-v3d-native-preview.mjs <scene.ply> <scene.json> <output.png> [--camera=0] [--side=600]"); // prettier-ignore
const number = (name, fallback) =>
  Number(args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
const metadata = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
const cameraIndex = number("camera", 0);
const camera = metadata.cams?.[cameraIndex];
if (!camera || !Number.isInteger(cameraIndex) || !(camera.w > 0 && camera.h > 0 && camera.f > 0))
  throw new Error("Choose a recorded camera with valid dimensions and focal length.");
const recordedTrainSide =
  metadata.continuation?.trainSide ||
  metadata.bake?.exportTrainSide ||
  metadata.stats?.trainSide ||
  metadata.bake?.settings?.trainSide;
const inputTrainSide = number("input-train", recordedTrainSide || 256);
const recordedExportCam =
  metadata.bake?.exportCam0 || metadata.continuation?.exportCam0 || metadata.exportCam0;
const inputFocal = number("input-focal", recordedExportCam?.f || 0);
const trainSide = number("train", inputTrainSide);
const side = number("side", trainSide);
if (!(side > 0 && side <= 2560)) throw new Error("The preview side must be between 1 and 2,560.");
const scale = side / Math.max(camera.w, camera.h);
const width = Math.max(1, Math.round(camera.w * scale));
const height = Math.max(1, Math.round(camera.h * scale));
const base = (process.env.SPLASHERY_URL || "http://127.0.0.1:4175").replace(/\/$/, "");
const baked = args.includes("--baked");
const value = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!baked && !recordedTrainSide && !value("input-train"))
  throw new Error("The original training resolution is missing: pass --input-train=<side> or --baked."); // prettier-ignore
if (!(inputTrainSide > 0 && trainSide > 0))
  throw new Error("Training dimensions must be positive.");
if (!baked && inputTrainSide > Math.max(metadata.cams[0].w, metadata.cams[0].h) && !(inputFocal > 0))
  throw new Error("An upscaled export needs recorded exportCam0 intrinsics or --input-focal=<actual export focal>."); // prettier-ignore
const continueOutput = value("continue-output");
const sourceFile = value("source");
const sourceOriginFile = value("source-origin");
const sourceOrigin = sourceOriginFile
  ? JSON.parse(fs.readFileSync(sourceOriginFile, "utf8"))
  : null;
const continuation = continueOutput
  ? {
      maxIters: number("iters", 1280),
      maxSeconds: number("seconds", 1200),
      maxSplats: number("splats", 40000),
      initialIter: Number(metadata.stats?.iters || 0),
      sceneRadius: number("radius", 10),
      started: new Date().toISOString(),
      warmStartSha256: createHash("sha256").update(fs.readFileSync(plyFile)).digest("hex"),
      metadataSha256: createHash("sha256").update(fs.readFileSync(jsonFile)).digest("hex"),
      sourceSha256: sourceFile
        ? createHash("sha256").update(fs.readFileSync(sourceFile)).digest("hex")
        : null,
      sourceOrigin,
      inputExportCam0: recordedExportCam || null,
      inputExportCameras: metadata.bake?.exportCameras || metadata.exportCameras || null,
    }
  : null;
if (continuation) {
  if (!sourceFile || baked)
    throw new Error("Continuation needs --source and native Mip compensation.");
  if (sourceOrigin && sourceOrigin.cutSha256 !== continuation.sourceSha256)
    throw new Error("The source origin does not match the selected cut's SHA-256.");
  if (!(continuation.maxIters > continuation.initialIter && continuation.maxSeconds > 0))
    throw new Error("The total iteration target must exceed the saved iteration, with a positive time budget."); // prettier-ignore
  for (const suffix of [".ply", ".json", "-log.txt"])
    if (fs.existsSync(`${continueOutput}${suffix}`))
      throw new Error(`Refusing to overwrite ${continueOutput}${suffix}`);
  fs.mkdirSync(path.dirname(path.resolve(continueOutput)), { recursive: true });
}
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan,WebGPU",
    "--use-webgpu-adapter=swiftshader",
    "--use-vulkan=swiftshader",
  ],
});
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  process.on("SIGUSR2", () => page.evaluate(() => window.__nativePreviewStop?.()).catch(() => {}));
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
    else if (message.text().startsWith("[native-preview]")) console.log(message.text());
  });
  await page.route(`${base}/__v3d-native-preview.html`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><title>Native splat preview</title><style>html,body{margin:0;background:#000}canvas{display:block}</style><canvas id="preview"></canvas>',
    }),
  );
  for (const [routeName, file, contentType] of [
    ["ply", plyFile, "application/octet-stream"],
    ["json", jsonFile, "application/json"],
  ])
    await page.route(`${base}/__v3d-native-${routeName}`, (route) =>
      route.fulfill({ contentType, path: path.resolve(file) }),
    );
  if (sourceFile)
    await page.route(`${base}/__v3d-native-source`, (route) =>
      route.fulfill({
        contentType: sourceFile.endsWith(".webm") ? "video/webm" : "video/mp4",
        path: path.resolve(sourceFile),
      }),
    );
  await page.goto(`${base}/__v3d-native-preview.html`);
  const result = await page.evaluate(
    async ({
      width,
      height,
      cameraIndex,
      inputTrainSide,
      inputFocal,
      trainSide,
      baked,
      continuation,
    }) => {
      const continuationStarted = performance.now();
      const [
        { createSession, camPosition },
        { readPlyHeader, decimatePly },
        { unbakeOpacityCompensation },
      ] = await Promise.all([
        import("/vendor/splatjs/src/session.js"),
        import("/src/loaders.js"),
        import("/vendor/splatjs/src/io/ply.js"),
      ]);
      const [bytes, meta] = await Promise.all([
        fetch("/__v3d-native-ply").then(async (response) => {
          if (!response.ok) throw new Error("Could not load the PLY.");
          return new Uint8Array(await response.arrayBuffer());
        }),
        fetch("/__v3d-native-json").then((response) => response.json()),
      ]);
      const header = readPlyHeader(bytes);
      if (!header?.vertex || !header.count) throw new Error("The input is not a populated PLY.");
      const table = decimatePly(bytes, header, header.count, 7);
      const col = Object.fromEntries(
        table.props.map((property) => [property.name, property.storage]),
      );
      const required = ["x", "y", "z", "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3", "f_dc_0", "f_dc_1", "f_dc_2", "opacity"]; // prettier-ignore
      if (required.some((name) => !col[name]))
        throw new Error("The PLY is missing Gaussian fields.");
      const data = new Float32Array(table.count * 16);
      for (let i = 0; i < table.count; i++) {
        data.set(
          [col.x[i], col.y[i], col.z[i], col.scale_0[i], col.scale_1[i], col.scale_2[i], col.rot_0[i], col.rot_1[i], col.rot_2[i], col.rot_3[i], col.f_dc_0[i], col.f_dc_1[i], col.f_dc_2[i], col.opacity[i], 0, 0], // prettier-ignore
          i * 16,
        );
      }
      // PLY colors are SH-DC, scales and opacity remain logarithmic, and rotation is w/x/y/z.
      const rest = Object.keys(col)
        .filter((name) => /^f_rest_\d+$/.test(name))
        .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)));
      const shK = rest.length / 3;
      if (![0, 3, 8, 15].includes(shK)) throw new Error("Unsupported spherical harmonic degree.");
      const sh = rest.length ? new Float32Array(table.count * rest.length) : null;
      if (sh)
        for (let i = 0; i < table.count; i++)
          for (let j = 0; j < rest.length; j++) sh[i * rest.length + j] = col[rest[j]][i];
      const cams = meta.cams.map((cam, imgIdx) => ({ ...cam, imgIdx }));
      const sourceTrainWidth = Math.round(cams[0].w * Math.min(1, inputTrainSide / Math.max(cams[0].w, cams[0].h))); // prettier-ignore
      const sourceFocal = inputFocal || (cams[0].f * sourceTrainWidth) / cams[0].w;
      const dilate = meta.bake?.settings?.dilate ?? 0.1;
      const restored = baked ? data : unbakeOpacityCompensation(data, table.count, sourceFocal, Float32Array.from(cams.flatMap(camPosition)), dilate); // prettier-ignore
      const frameTimes = [];
      const extractedSizes = [];
      let sourceSize;
      let files;
      if (continuation) {
        const { openVideo, closeVideo, seek } = await import("/src/video3d/extract.js");
        const { panoSafeCrop } = await import("/src/video3d/frames.js");
        const sourceBlob = await (await fetch("/__v3d-native-source")).blob();
        const opened = await openVideo(new File([sourceBlob], "selected-cut.webm", { type: sourceBlob.type })); // prettier-ignore
        sourceSize = { width: opened.width, height: opened.height };
        files = [];
        try {
          const crop = panoSafeCrop(opened.width, opened.height);
          const cv = document.createElement("canvas");
          const g = cv.getContext("2d");
          for (const [i, cam] of cams.entries()) {
            if (!(cam.time >= 0 && cam.time < opened.duration))
              throw new Error(`Camera ${i} is outside the selected source cut.`);
            await seek(opened.video, cam.time);
            // The decoder caps trainMaxDim at the JPEG's own dimensions. Supply the requested
            // training size explicitly while keeping feature dimensions at the recorded camera
            // size below. A source smaller than this is transparently recorded as upscaled.
            const targetScale = Math.max(1, trainSide / Math.max(cam.w, cam.h));
            cv.width = Math.round(cam.w * targetScale);
            cv.height = Math.round(cam.h * targetScale);
            extractedSizes.push({ width: cv.width, height: cv.height });
            g.drawImage(
              opened.video,
              crop.sx,
              0,
              crop.sw,
              opened.height,
              0,
              0,
              cv.width,
              cv.height,
            );
            const blob = await new Promise((resolve) => cv.toBlob(resolve, "image/jpeg", 0.92));
            if (!blob) throw new Error(`Could not copy source frame ${i}.`);
            files.push(new File([blob], `frame_${String(i).padStart(3, "0")}.jpg`, { type: "image/jpeg" })); // prettier-ignore
            frameTimes.push({ requested: cam.time, decoded: opened.video.currentTime });
          }
        } finally {
          closeVideo(opened);
        }
      }
      // A fixed-count finishing pass optimizes existing Gaussians only. Avoid a final relocation
      // at its 100-step boundary, where relocated parameters would have no subsequent updates.
      const refineEvery = continuation?.maxSplats <= table.count ? 1e9 : 100;
      const session = createSession({
        maxViewW: width,
        maxViewH: height,
        ...(continuation
          ? { maxIters: continuation.maxIters, refineEvery, refineStart: 100, itersPerFrame: 6, fenceRing: 2, gpuChunkMs: 120, evalHoldEvery: 1e9, holdout: -1, frames: { trainMaxDim: trainSide, featMaxDim: Math.max(...cams.map((cam) => Math.max(cam.w, cam.h))) } } // prettier-ignore
          : {}),
        trainer: {
          maxSplats: continuation?.maxSplats || table.count,
          capMult: continuation ? 2 : 1,
          mipComp: !baked,
          dilate,
          ...(continuation ? { growUntil: 1100, growFrac: 0.25 } : {}),
        },
      });
      const log = [];
      session.on("log", (message) => { log.push(message); console.log(`[native-preview] ${message}`); }); // prettier-ignore
      console.log(baked ? "[native-preview] exported opacity; no unbake" : `[native-preview] restored opacity at original training focal ${sourceFocal.toFixed(1)}`); // prettier-ignore
      if (continuation) await session.load(files);
      const trainingSizes = continuation ? session.frames.map((frame) => ({ width: frame.tw, height: frame.th, featureWidth: frame.fw, featureHeight: frame.fh })) : []; // prettier-ignore
      const actualTrainSide = continuation ? Math.max(...trainingSizes.map((size) => Math.max(size.width, size.height))) : trainSide; // prettier-ignore
      if (continuation && actualTrainSide !== trainSide)
        throw new Error(`The requested ${trainSide}px training size became ${actualTrainSide}px.`);
      // Session.seedFrom scales every intrinsic by tw/fw. Account for the actual decoded
      // feature dimensions, including rounded aspect ratios, before giving it the old solve.
      // Metadata retains the original cameras; only these internal copies are rescaled.
      const setupCams = continuation ? cams.map((cam, i) => {
        const frame = session.frames[i];
        const s = frame.tw / frame.fw;
        return { ...cam, f: cam.f * frame.fw / cam.w,
          fy: (cam.fy ?? cam.f) * frame.th / cam.h / s,
          cx: (cam.cx ?? cam.w / 2) * frame.fw / cam.w,
          cy: (cam.cy ?? cam.h / 2) * frame.th / cam.h / s,
          w: frame.fw, h: frame.fh };
      }) : cams; // prettier-ignore
      session.useReconstruction({ cams: setupCams, points: [] });
      await session.seedFrom(
        { data: restored, n: table.count, sh, shK, dc: "sh" },
        {
          viewOnly: !continuation,
          iter: continuation?.initialIter || 0,
          sceneRadius: continuation?.sceneRadius,
        },
      );
      const trainingFrameSizes = continuation ? session.trainer.camMeta.map((cam) => ({
        f: cam.f, fy: cam.fy ?? cam.f, cx: cam.cx, cy: cam.cy, w: cam.w, h: cam.h,
      })) : []; // prettier-ignore
      const projectionError = continuation ? Math.max(...trainingFrameSizes.flatMap((actual, i) => {
        const original = cams[i];
        return [Math.abs(actual.f / actual.w - original.f / original.w),
          Math.abs(actual.fy / actual.h - (original.fy ?? original.f) / original.h),
          Math.abs(actual.cx / actual.w - (original.cx ?? original.w / 2) / original.w),
          Math.abs(actual.cy / actual.h - (original.cy ?? original.h / 2) / original.h)];
      })) : 0; // prettier-ignore
      if (projectionError > 1e-6)
        throw new Error(
          `The training intrinsics changed normalized projection by ${projectionError}.`,
        );
      if (continuation)
        console.log(`[native-preview] verified ${actualTrainSide}px training; normalized projection error ${projectionError}; export focal ${trainingFrameSizes[0].f}`); // prettier-ignore
      const canvas = document.getElementById("preview");
      canvas.width = width;
      canvas.height = height;
      const c = cams[cameraIndex];
      const sx = width / c.w;
      const sy = height / c.h;
      // A view-only session has no training-frame metadata. Its public free-camera API receives
      // exactly the recorded pose and intrinsics instead of invoking lookThrough() without frames.
      session.view.setCamera({
        R: c.R,
        t: c.t,
        f: c.f * sx,
        fy: (c.fy ?? c.f) * sy,
        cx: c.cx != null ? c.cx * sx : width / 2,
        cy: c.cy != null ? c.cy * sy : height / 2,
        w: width,
        h: height,
      });
      session.view.attach(canvas);
      let saved;
      if (continuation) {
        if (width === session.trainer.camMeta[cameraIndex].w && height === session.trainer.camMeta[cameraIndex].h) session.view.lookThrough(cameraIndex); // prettier-ignore
        let lastPsnr = Number.isFinite(meta.stats?.psnr) ? meta.stats.psnr : null;
        let lastPsnrIteration = Number.isFinite(lastPsnr)
          ? (meta.stats.psnrIteration ?? meta.stats.psnrAtIter ?? meta.continuation?.lastFinitePsnrIteration ?? continuation.initialIter)
          : null; // prettier-ignore
        let lastPsnrTrainSide = Number.isFinite(lastPsnr)
          ? (meta.stats.psnrTrainSide ?? meta.continuation?.lastFinitePsnrTrainSide ?? inputTrainSide)
          : null; // prettier-ignore
        session.on("metrics", (metric) => {
          if (Number.isFinite(metric.psnrTrain)) {
            lastPsnr = metric.psnrTrain;
            lastPsnrIteration = metric.iter;
            lastPsnrTrainSide = actualTrainSide;
          }
          console.log(`[native-preview] iteration ${metric.iter}/${continuation.maxIters}; ${metric.splats} splats; PSNR ${metric.psnrTrain ?? "pending"}`); // prettier-ignore
        });
        const started = performance.now();
        let timedOut = false;
        await new Promise((resolve, reject) => {
          let timer;
          let ended = false;
          const end = () => {
            if (ended) return;
            ended = true;
            clearTimeout(timer);
            resolve();
          };
          session.on("event", (event) => {
            if (event.kind === "train-complete" || event.kind === "device-lost") end();
          });
          window.__nativePreviewStop = () => session.finish().then(end, reject);
          timer = setTimeout(() => { timedOut = true; window.__nativePreviewStop(); }, continuation.maxSeconds * 1000); // prettier-ignore
          session.start();
        });
        if (session.deviceLost)
          throw new Error("The graphics device was lost during continuation.");
        const plyBlob = await session.exportPlyBlob();
        const exported = new Uint8Array(await plyBlob.arrayBuffer());
        let binary = "";
        for (let i = 0; i < exported.length; i += 0x8000)
          binary += String.fromCharCode(...exported.subarray(i, i + 0x8000));
        const continuationSeconds = (performance.now() - continuationStarted) / 1000;
        const history = Array.isArray(meta.continuationHistory) ? meta.continuationHistory.slice() : []; // prettier-ignore
        if (meta.continuation && !history.some((run) => run.started === meta.continuation.started && run.actualIteration === meta.continuation.actualIteration)) history.push(meta.continuation); // prettier-ignore
        const previousSeconds = Number(meta.timings?.continuation) || history.reduce((sum, run) => sum + (Number(run.seconds) || 0), 0); // prettier-ignore
        // Early tool exports retained the original timings without adding their continuation.
        // Account for that recorded history when such a model becomes the next warm input.
        const previousTotal = (Number(meta.timings?.total) || 0) + (meta.timings?.continuation ? 0 : previousSeconds); // prettier-ignore
        const exportTrainingFrameSizes = session.trainer.camMeta.map((cam) => ({
          f: cam.f, fy: cam.fy ?? cam.f, cx: cam.cx, cy: cam.cy, w: cam.w, h: cam.h,
          R: Array.from(cam.R), t: Array.from(cam.t),
        })); // prettier-ignore
        const exportCam0 = exportTrainingFrameSizes[0];
        const continuationRecord = { ...continuation, completedIterations: session.trainer.iter - continuation.initialIter, actualIteration: session.trainer.iter, frames: files.length, frameTimes, inputTrainSide, requestedTrainSide: trainSide, trainSide: actualTrainSide, sourceSize, extractedSizes, trainingSizes, trainingFrameSizes, exportTrainingFrameSizes, exportCam0, projectionError, sourceUpscaled: actualTrainSide > Math.max(sourceSize.width, sourceSize.height), refineEvery, refinementDisabled: refineEvery === 1e9, refineStart: 100, growUntil: 1100, seconds: continuationSeconds, trainingAndExportSeconds: (performance.now() - started) / 1000, opacityRestoreFocal: sourceFocal, dilate, lastFinitePsnr: lastPsnr, lastFinitePsnrIteration: lastPsnrIteration, lastFinitePsnrTrainSide: lastPsnrTrainSide, cameraSolve: "reused recorded cameras; no SfM", optimizer: "new Adam state from exported PLY; opacity compensation reversed", completed: new Date().toISOString() }; // prettier-ignore
        saved = {
          ply: btoa(binary),
          metadata: {
            ...meta,
            exportCam0,
            exportCameras: exportTrainingFrameSizes,
            timings: {
              ...meta.timings,
              continuation: previousSeconds + continuationSeconds,
              lastContinuation: continuationSeconds,
              total: previousTotal + continuationSeconds,
            },
            bake: { ...meta.bake, exportTrainSide: actualTrainSide, exportCam0, exportCameras: exportTrainingFrameSizes }, // prettier-ignore
            stats: { ...meta.stats, frames: files.length, registered: cams.length, trainSide: actualTrainSide, splats: session.trainer.n, exportedSplats: readPlyHeader(exported).count, iters: session.trainer.iter, psnr: lastPsnr, psnrIteration: lastPsnrIteration, psnrAtIter: lastPsnrIteration, psnrTrainSide: lastPsnrTrainSide, plyBytes: exported.length, stoppedEarly: session.trainer.iter < continuation.maxIters, timedOut }, // prettier-ignore
            continuation: continuationRecord,
            continuationHistory: [...history, continuationRecord],
          },
          log,
        };
      }
      session.view.renderNow();
      await session.trainer.device.queue.onSubmittedWorkDone();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      window.__nativePreviewSession = session;
      return {
        splats: session.trainer.n,
        loadedSplats: table.count,
        width,
        height,
        camera: cameraIndex,
        time: c.time,
        optimizationSteps: continuation ? session.trainer.iter - continuation.initialIter : 0,
        totalIterations: session.trainer.iter,
        continuedIterations: continuation ? session.trainer.iter - continuation.initialIter : 0,
        opacity: baked
          ? "exported opacity; Mip compensation disabled"
          : "export opacity unbaked at training resolution; native Mip compensation",
        saved,
      };
    },
    { width, height, cameraIndex, inputTrainSide, inputFocal, trainSide, baked, continuation },
  );
  if (errors.length) throw new Error(errors.join("\n"));
  const { saved, ...summary } = result;
  if (saved) {
    fs.writeFileSync(`${continueOutput}.ply`, Buffer.from(saved.ply, "base64"));
    fs.writeFileSync(`${continueOutput}.json`, JSON.stringify(saved.metadata, null, 2) + "\n");
    fs.writeFileSync(`${continueOutput}-log.txt`, saved.log.join("\n") + "\n");
  }
  await page.locator("#preview").screenshot({ path: output, timeout: 60000 });
  console.log(JSON.stringify({ ...summary, output: path.resolve(output), continueOutput }));
  await page.evaluate(() => window.__nativePreviewSession.dispose());
} finally {
  await browser.close();
}
