// MIT. Benchmark helpers; never imported by the site. Masks must be frozen before training.
import { imageMetrics } from "./studio-truth/metrics.mjs";

// Canvas swap-chain contents can be discarded after presentation. Read the trainer's actual
// floating-point raster output, queue ordered immediately after renderView, instead of a canvas.
export async function readRenderedPixels(trainer, width, height, signal) {
  const device = trainer.device,
    bytes = width * height * 16;
  const buffer = device.createBuffer({
    size: bytes,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  try {
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(trainer.bufOut, 0, buffer, 0, bytes);
    device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPUMapMode.READ);
    signal?.throwIfAborted();
    const floats = new Float32Array(buffer.getMappedRange());
    if (floats.some((v) => !Number.isFinite(v))) throw new Error("Rendered pixels are nonfinite");
    // Match Splat.js BLIT_SRC: RGB clamped to [0,1], opaque display alpha.
    return Uint8ClampedArray.from(floats, (v, i) =>
      i % 4 === 3 ? 255 : Math.round(255 * Math.max(0, Math.min(1, v))),
    );
  } finally {
    buffer.destroy();
  }
}

export function polygonMask(width, height, annotation) {
  if (!annotation?.polygons?.length) throw new Error("Missing independently annotated object mask");
  const inside = (x, y, polygon) => {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [a, b] = polygon[i],
        [c, d] = polygon[j];
      if (b > y !== d > y && x < ((c - a) * (y - b)) / (d - b) + a) hit = !hit;
    }
    return hit;
  };
  let mask = Uint8Array.from({ length: width * height }, (_, i) => {
    const x = ((i % width) + 0.5) / width,
      y = (Math.floor(i / width) + 0.5) / height;
    return +(
      annotation.polygons.some((p) => inside(x, y, p)) &&
      !(annotation.holes || []).some((p) => inside(x, y, p))
    );
  });
  const radius = annotation.erodePixels ?? 0;
  if (!Number.isInteger(radius) || radius < 0 || radius > 16)
    throw new Error("Invalid erosion radius");
  if (radius) {
    const source = mask;
    mask = Uint8Array.from(source, (v, i) => {
      if (!v) return 0;
      const x = i % width,
        y = Math.floor(i / width);
      if (x < radius || y < radius || x + radius >= width || y + radius >= height) return 0;
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) if (!source[i + dy * width + dx]) return 0;
      return 1;
    });
  }
  if (!mask.some(Boolean)) throw new Error("Object mask is empty");
  return mask;
}

export function scoreHeldOut(frame, rendered, annotation) {
  const reference = new Uint8ClampedArray(frame.tw * frame.th * 4);
  for (let i = 0; i < frame.tw * frame.th; i++) {
    for (let k = 0; k < 3; k++) reference[i * 4 + k] = Math.round(255 * frame.rgb[i * 3 + k]);
    reference[i * 4 + 3] = 255;
  }
  return imageMetrics(
    reference,
    rendered,
    frame.tw,
    frame.th,
    polygonMask(frame.tw, frame.th, annotation),
  );
}

// Serialized by Playwright. Everything runs through the actual photo module and WebGPU trainer.
export async function browserRound2(options) {
  const { solvePhotos, seedPhotos } = await import("/src/photos3d/run.js");
  const { decodeFrames } = await import("/vendor/splatjs/src/io/frames.js");
  const { tierSettings } = await import("/src/video3d/frames.js");
  const { scoreHeldOut, readRenderedPixels } = await import("/tools/photos3d-evaluate.mjs");
  const files = Array.from(document.querySelector("input").files);
  const row = {
    kind: "task 104 round-two photo module",
    inputOrder: files.map((f) => f.name),
    stages: [],
    folds: [],
    physicalPhone: false,
    peakGpuMemory: null,
  };
  row.plannedFolds =
    options.folds === "all"
      ? files.map((f) => f.name).sort()
      : options.folds
        ? options.folds.split(",")
        : options.iterations
          ? [null]
          : [];
  const started = performance.now();
  const controller = new AbortController();
  let activeSession;
  const timer = setTimeout(() => {
    row.timedOut = true;
    controller.abort();
    activeSession?.dispose();
  }, options.timeoutMs);
  const onProgress = (e) => {
    row.stages.push({ ...e, seconds: (performance.now() - started) / 1000 });
    if (["features", "matching", "trial", "matcher-fallback"].includes(e.stage))
      globalThis.probeLog?.(JSON.stringify(e));
  };
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    row.adapter = adapter
      ? Object.fromEntries(
          ["vendor", "architecture", "device", "description"].map((k) => [
            k,
            adapter.info?.[k] || "",
          ]),
        )
      : null;
    const software = /swiftshader|llvmpipe|lavapipe|software/i.test(JSON.stringify(row.adapter));
    let solution;
    if (options.resume) {
      const { settings, recon, lenses, rejected, graph } = options.resume;
      const set = tierSettings(settings.profile);
      const frames = await decodeFrames(
        [...files].sort((a, b) => (a.name < b.name ? -1 : 1)),
        { signal: controller.signal, featMaxDim: settings.featureSide, trainMaxDim: set.trainSide },
      );
      if (
        frames.length !== files.length ||
        frames.some((f, i) => f.name !== options.resume.frameNames[i])
      )
        throw new Error("Resume frame identities differ");
      solution = { settings, frames, recon, lenses, rejected, graph };
      row.resumedGeometry = true;
    } else
      solution = await solvePhotos(files, {
        profile: options.profile,
        featureSide: options.featureSide,
        assumeSingleLens: options.assumeSingleLens,
        focal35: options.focal35,
        cpuMatching: options.cpuMatching,
        workers: options.profile === "phone" ? 2 : 4,
        signal: controller.signal,
        onProgress,
      });
    row.solveSeconds = (performance.now() - started) / 1000;
    row.settings = solution.settings;
    row.graph = solution.graph;
    row.lenses = solution.lenses;
    row.rejected = solution.rejected;
    row.decoded = solution.frames.map(({ name, fw, fh, tw, th, exif }) => ({
      name,
      fw,
      fh,
      tw,
      th,
      exif,
    }));
    if (!solution.recon) {
      row.solveError = solution.error;
      for (const name of row.plannedFolds) {
        const fold = {
          heldOut: name,
          status: "unregistered",
          reason:
            solution.rejected.find((p) => p.name === name)?.reason ||
            solution.graph?.photos.find((p) => p.name === name)?.reason ||
            solution.error,
          seconds: 0,
        };
        row.folds.push(fold);
        await globalThis.probeFold?.(fold);
      }
      return row;
    }
    const { recon, frames } = solution;
    row.cameras = recon.cams.map((c) => ({ ...c, R: Array.from(c.R), t: Array.from(c.t) }));
    row.points = recon.points.length;
    row.rmsBA = recon.rmsBA;
    row.rmsBAUnits = recon.rmsBAUnits;
    // A portable geometry checkpoint contains no input photographs or appearance samples.
    row.checkpoint = {
      settings: solution.settings,
      lenses: solution.lenses,
      rejected: solution.rejected,
      graph: solution.graph,
      frameNames: frames.map((f) => f.name),
      recon: {
        ...recon,
        cams: row.cameras,
        features: recon.features.map((f) => ({ x: Array.from(f.x), y: Array.from(f.y) })),
      },
    };
    await globalThis.probeCheckpoint?.(row.checkpoint);
    if (!options.iterations) return row;
    const masks = options.masks;
    for (const name of row.plannedFolds) {
      controller.signal.throwIfAborted();
      const foldStart = performance.now();
      const fold = { heldOut: name, status: "running" };
      row.folds.push(fold);
      if (name && !row.cameras.some((c) => c.name === name)) {
        fold.status = "unregistered";
        fold.reason =
          solution.rejected.find((p) => p.name === name)?.reason ||
          solution.graph.photos.find((p) => p.name === name)?.reason ||
          "No solved camera";
        fold.seconds = 0;
        await globalThis.probeFold?.(fold);
        continue;
      }
      try {
        if (name && !masks?.photos?.[name])
          throw new Error("No frozen object mask for held-out photo");
        const seeded = await seedPhotos(solution, {
          heldOut: name ? [name] : [],
          software,
          iterations: options.iterations,
          seed: options.seed,
          signal: controller.signal,
        });
        activeSession = seeded.session;
        const s = activeSession;
        fold.trainingNames = seeded.trainingNames;
        fold.surfacePoints = seeded.surfacePoints;
        fold.automaticBlurExclusionsDisabled = seeded.automaticBlurExclusionsDisabled;
        const canvas = document.querySelector("canvas");
        const evalCam = name ? row.cameras.find((c) => c.name === name) : row.cameras[0];
        if (!evalCam) throw new Error("Held-out photo has no solved camera");
        const frame = frames[evalCam.imgIdx];
        canvas.width = frame.tw;
        canvas.height = frame.th;
        const ctx = canvas.getContext("webgpu");
        ctx.configure({
          device: s.trainer.device,
          format: navigator.gpu.getPreferredCanvasFormat(),
          alphaMode: "opaque",
        });
        const scale = frame.tw / frame.fw;
        const camera = {
          ...evalCam,
          f: evalCam.f * scale,
          fy: (evalCam.fy ?? evalCam.f) * scale,
          cx: evalCam.cx * scale,
          cy: evalCam.cy * scale,
          w: frame.tw,
          h: frame.th,
        };
        s.trainer.renderView(camera, ctx);
        await s.trainer.device.queue.onSubmittedWorkDone();
        fold.firstViewSeconds = (performance.now() - started) / 1000;
        row.firstViewSeconds ??= fold.firstViewSeconds;
        s.start();
        while (s.trainer.iter < options.iterations && !s.trainingError) {
          controller.signal.throwIfAborted();
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        s.pause();
        await s.finish();
        if (s.trainingError) throw s.trainingError;
        fold.iterations = s.trainer.iter;
        fold.splats = s.trainer.n;
        s.trainer.renderView(camera, ctx);
        const pixels = await readRenderedPixels(s.trainer, frame.tw, frame.th, controller.signal);
        const copy = document.createElement("canvas");
        copy.width = frame.tw;
        copy.height = frame.th;
        const c2 = copy.getContext("2d", { willReadFrequently: true });
        c2.putImageData(new ImageData(pixels, frame.tw, frame.th), 0, 0);
        if (name)
          fold.metrics = scoreHeldOut(frame, pixels, {
            ...masks.photos[name],
            erodePixels: Math.round(
              ((masks.rasterization?.erodePixels || 0) * frame.tw) /
                (masks.rasterization?.width || frame.tw),
            ),
          });
        fold.renderedRange = pixels.reduce(
          ([lo, hi], v, i) => (i % 4 === 3 ? [lo, hi] : [Math.min(lo, v), Math.max(hi, v)]),
          [255, 0],
        );
        // Preview images belong in the evidence branch; input photos never do.
        await globalThis.probeRender?.(name || "preview", copy.toDataURL("image/png"));
        if (!name) {
          const ply = await s.exportPlyBlob();
          const bytes = new Uint8Array(await ply.arrayBuffer());
          fold.plySha256 = Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            (v) => v.toString(16).padStart(2, "0"),
          ).join("");
          fold.plyBytes = bytes.length;
          await globalThis.probePly?.(Array.from(bytes));
        }
        fold.status = "complete";
      } catch (error) {
        fold.status = "failed";
        fold.error = { name: error.name, message: error.message };
        controller.signal.throwIfAborted();
      } finally {
        activeSession?.dispose();
        activeSession = null;
        fold.seconds = (performance.now() - foldStart) / 1000;
      }
      await globalThis.probeFold?.(fold);
    }
    return row;
  } catch (error) {
    row.error = {
      name: row.timedOut ? "TimeoutError" : error.name,
      message: error.message,
      stack: error.stack,
    };
    return row;
  } finally {
    clearTimeout(timer);
    activeSession?.dispose();
    row.seconds = (performance.now() - started) / 1000;
    row.foldCounts = {
      planned: row.plannedFolds?.length || 0,
      complete: row.folds.filter((f) => f.status === "complete").length,
      failed: row.folds.filter((f) => f.status === "failed").length,
      unregistered: row.folds.filter((f) => f.status === "unregistered").length,
      unfinished:
        (row.plannedFolds?.length || 0) - row.folds.filter((f) => f.status !== "running").length,
    };
  }
}
