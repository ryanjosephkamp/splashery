// MIT. Diagnostic runner for task 104; never imported by the site.
// No acceptance scores are inferred from registration, reprojection RMS, or training PSNR.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { makeControl, scoreCameras } from "./photos3d-controls.mjs";
import { runSfM } from "../vendor/splatjs/src/sfm/sfm.js";
import { browserRound2 } from "./photos3d-evaluate.mjs";
import { allPairs, verifyPair } from "../src/photos3d/graph.js";
import { solvePhotoGraph } from "../src/photos3d/solve.js";
import { matchSift } from "../vendor/splatjs/src/sfm/sift.js";

export function orderedFiles(files, seed = 0) {
  const out = [...files].sort();
  if (seed) {
    let state = seed >>> 0;
    for (let i = out.length - 1; i > 0; i--) {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      const j = state % (i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
// Hash the exact bytes parsed for a run, before any browser work. A later filesystem edit must
// neither change the recorded identity nor silently replace the frozen evaluation annotations.
export async function jsonSnapshot(filename, expectedSha256) {
  if (!filename) return { value: null, sha256: null };
  const bytes = await fs.readFile(filename);
  const sha256 = sha(bytes);
  if (expectedSha256 && sha256 !== expectedSha256)
    throw new Error("Evaluation annotation file differs from its frozen hash");
  return { value: JSON.parse(bytes.toString("utf8")), sha256 };
}
export async function withWatchdog(work, timeoutMs, terminate) {
  let timer;
  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(`Browser probe exceeded its ${timeoutMs} ms host deadline`);
          error.name = "TimeoutError";
          reject(error);
          Promise.resolve()
            .then(terminate)
            .catch(() => {});
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function fingerprint(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(async (e) => {
          const p = path.join(dir, e.name);
          return e.isDirectory() ? fingerprint(p) : [[p, sha(await fs.readFile(p))]];
        }),
    )
  ).flat();
}

async function controlProbe(options) {
  const control = makeControl({
    count: Number(options.count || 24),
    mixedFocal: options.control === "mixed",
    noise: Number(options.noise || 0),
  });
  const row = { kind: "exact-correspondence control, not rendered photos", log: [] };
  const started = performance.now();
  const settings = {
    workers: false,
    cpuMatching: true,
    uiYield: true,
    ...(options.calibration === "free" ? {} : { focalPx: control.focalPx, lockIntrinsics: true }),
  };
  row.settings = options.round2
    ? {
        solver: "Photos to 3D photo graph",
        calibration: "per-photo exact focal lengths",
        analyticCorrespondences: true,
      }
    : settings;
  row.inputCount = control.images.length;
  row.sentinel = options.sentinel || null;
  row.colorReads = Array(control.images.length).fill(0);
  try {
    const recon = options.round2
      ? await solvePhotoGraph(
          control.images,
          control.feats,
          allPairs(control.images.length).map(([i, j]) =>
            verifyPair(
              i,
              j,
              matchSift(
                control.feats[i].desc,
                control.feats[i].n,
                control.feats[j].desc,
                control.feats[j].n,
              ),
              control.feats,
              control.truth.map((c) => ({ f: c.f, cx: 240, cy: 180 })),
            ),
          ),
          control.truth.map((c) => ({ f: c.f, cx: 240, cy: 180 })),
        )
      : await runSfM(
          control.images,
          (s) => row.log.push(s),
          (image) => {
            row.colorReads[image]++;
            return image === 0 && options.sentinel
              ? options.sentinel === "red"
                ? [1, 0, 0]
                : [0, 0, 1]
              : [0.5, 0.5, 0.5];
          },
          { ...settings, _feats: control.feats },
        );
    row.cameras = recon.cams.map((c) => ({
      ...c,
      R: Array.from(c.R),
      t: Array.from(c.t),
      name: control.images[c.imgIdx].name,
    }));
    row.score = scoreCameras(row.cameras, control.truth, control.sceneSize);
    row.points = recon.points.length;
    row.meanSeedRGB = [0, 1, 2].map(
      (k) => recon.points.reduce((s, p) => s + p.rgb[k], 0) / recon.points.length,
    );
    row.rmsBA = recon.rmsBA;
  } catch (e) {
    row.error = e.stack;
  }
  row.seconds = (performance.now() - started) / 1000;
  return row;
}

// The browser function is serialized by Playwright and imports the actual existing pipeline.
export async function browserProbe({ profile, timeoutMs, trainSteps, match }) {
  const { createSession } = await import("/vendor/splatjs/src/session.js");
  const { tierSettings } = await import("/src/video3d/frames.js");
  const { refinementSchedule } = await import("/src/video3d/run.js");
  const { surfaceSeed } = await import("/src/video3d/surface-seed.js");
  const files = Array.from(document.querySelector("input").files);
  const row = {
    kind: "real browser photo diagnostic",
    log: [],
    stages: [],
    accepted: [],
    missing: [],
    acceptance: {
      maskedHeldOutSSIM: null,
      maskedHeldOutPSNR: null,
      physicalPhone: false,
      peakGpuMemory: null,
    },
  };
  const started = performance.now();
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
  const set = tierSettings(profile);
  row.settings = set;
  row.inputCount = files.length;
  row.exceedsVideoPhoneFrameCount = files.length > set.maxFrames;
  const refine = refinementSchedule(set.iters);
  const session = createSession({
    maxIters: set.iters,
    ...refine,
    lowMem: true,
    robustSeedBounds: true,
    itersPerFrame: 2,
    fenceRing: software ? 1 : 2,
    initTarget: set.seed || 15000,
    maxViewW: set.trainSide,
    maxViewH: set.trainSide,
    evalHoldEvery: 1e9,
    frames: { trainMaxDim: set.trainSide, featMaxDim: set.featSide },
    sfm: {
      uiYield: true,
      ...(software && match !== "gpu" ? { cpuMatching: true } : {}),
      maxPairsPerChunk: 4,
      ...(profile === "phone" ? { siftFeats: 3000, siftFirstOctave: 0, refineAspect: false } : {}),
    },
    trainer: {
      shDeg: 0,
      fitBackground: true,
      backgroundFitShrink: true,
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
  const controller = new AbortController();
  const timer = setTimeout(() => {
    row.timedOut = true;
    controller.abort();
    session.dispose();
  }, timeoutMs);
  session.on("log", (s) => {
    row.log.push(s);
    globalThis.probeLog?.(s);
  });
  session.on("stage", (e) => {
    const event = {
      stage: e.stage,
      done: e.done,
      total: e.total,
      seconds: (performance.now() - started) / 1000,
    };
    row.stages.push(event);
  });
  try {
    await session.load(files);
    row.decoded = session.frames.map((f) => ({
      name: f.name,
      fw: f.fw,
      fh: f.fh,
      tw: f.tw,
      th: f.th,
      exif: f.exif,
    }));
    if (session.frames.length !== files.length)
      throw new Error("Some photos did not decode; see skipped-file diagnostics");
    const recon = await session.solve({ signal: controller.signal, minCameras: 3 });
    row.solveSeconds = (performance.now() - started) / 1000;
    row.cameras = recon.cams.map((c) => ({
      ...c,
      R: Array.from(c.R),
      t: Array.from(c.t),
      name: session.frames[c.imgIdx].name,
    }));
    row.accepted = row.cameras.map((c) => c.name);
    row.missing = files
      .filter((f) => !row.accepted.includes(f.name))
      .map((f) => ({
        name: f.name,
        reason: "No camera returned by SfM; no pose guessed. See the match and registration log.",
      }));
    row.points = recon.points.length;
    row.rmsBA = recon.rmsBA;
    if (trainSteps > 0) {
      controller.signal.throwIfAborted();
      const target = set.seed || Math.min(60000, Math.round(set.splats / 3));
      const surface = surfaceSeed(recon, session.frames, {
        maxPoints: Math.min(30000, Math.floor(target * 0.92)),
      });
      await session.seed({
        initTarget: target - surface.n,
        seedLimit: target,
        appendGaussians: {
          ...surface,
          protectIters: refine.refineStart + refine.refineEvery,
          note: "multiview surface detail",
        },
      });
      controller.signal.throwIfAborted();
      const canvas = document.querySelector("canvas");
      canvas.width = set.trainSide;
      canvas.height = Math.round(set.trainSide * 0.75);
      session.view.attach(canvas);
      session.view.lookThrough(0);
      session.view.renderNow();
      await session.trainer.device.queue.onSubmittedWorkDone();
      controller.signal.throwIfAborted();
      row.firstViewSeconds = (performance.now() - started) / 1000;
      // This is a fixed-step smoke probe. It does not claim the full phone run completes.
      session.start();
      while (session.trainer.iter < trainSteps && !session.trainingError) {
        controller.signal.throwIfAborted();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      session.pause();
      await session.finish();
      controller.signal.throwIfAborted();
      const ply = new Uint8Array(await (await session.exportPlyBlob()).arrayBuffer());
      controller.signal.throwIfAborted();
      row.trainIterations = session.trainer.iter;
      row.splats = session.trainer.n;
      row.plyBytes = ply.length;
      row.plySha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", ply)), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join("");
      await globalThis.probePly?.(Array.from(ply));
    }
  } catch (e) {
    row.error = {
      name: row.timedOut ? "TimeoutError" : e.name,
      message: row.timedOut ? `Browser work exceeded its ${timeoutMs} ms deadline` : e.message,
      stack: e.stack,
    };
  } finally {
    clearTimeout(timer);
    row.seconds = (performance.now() - started) / 1000;
    row.missing = files
      .filter((f) => !row.accepted.includes(f.name))
      .map((f) => ({
        name: f.name,
        reason: row.error
          ? "The pipeline did not complete; no camera claimed."
          : "No camera returned by SfM; no pose guessed. See the match and registration log.",
      }));
    session.dispose();
  }
  return row;
}

async function photoProbe(options, out, provenance) {
  const input = path.resolve(options.input);
  const assets = options.dataset
    ? JSON.parse(await fs.readFile("tools/assets.json", "utf8"))
    : null;
  const dataset = assets?.photos3dBenchmarks.find((r) => r.id === options.dataset);
  if (options.dataset && !dataset) throw new Error("Unknown frozen dataset");
  const names = orderedFiles(
    dataset
      ? dataset.files.map((f) => f.name)
      : (await fs.readdir(input)).filter((n) => /\.(png|jpe?g|heic)$/i.test(n)),
    Number(options.shuffle || 0),
  );
  if (names.length < 8 || names.length > 60) throw new Error("Use 8–60 photos");
  const files = names.map((n) => path.join(input, n));
  const sources = await Promise.all(
    files.map(async (f) => ({ name: path.basename(f), sha256: sha(await fs.readFile(f)) })),
  );
  if (
    dataset &&
    sources.some((s) => s.sha256 !== dataset.files.find((f) => f.name === s.name)?.sha256)
  )
    throw new Error("Input photos differ from frozen dataset");
  const [maskFile, resumeFile, truthFile] = await Promise.all([
    jsonSnapshot(options.masks, dataset?.evaluationMasks?.sha256),
    jsonSnapshot(options.resume),
    jsonSnapshot(options.truth),
  ]);
  const masks = maskFile.value,
    resume = resumeFile.value;
  const loadedIdentities = {
    sources,
    maskSha256: maskFile.sha256,
    resumeSha256: resumeFile.sha256,
    truthSha256: truthFile.sha256,
  };
  await fs.writeFile(
    out,
    JSON.stringify({ provenance, status: "running", ...loadedIdentities }, null, 2) + "\n",
  );
  if (resume && !resume.geometryProvenance?.commit)
    throw new Error("Geometry checkpoint lacks solver-origin provenance");
  if (resume) {
    const origin = resume.geometryProvenance;
    if (!/^[a-f0-9]{40}$/.test(origin.commit) || !Array.isArray(origin.sourceHashes))
      throw new Error("Invalid geometry source provenance");
    for (const [file, hash] of origin.sourceHashes) {
      const bytes = execFileSync("git", ["show", `${origin.commit}:${file}`], {
        maxBuffer: 16 * 1024 * 1024,
      });
      if (sha(bytes) !== hash)
        throw new Error(`Geometry source hash differs from its originating commit: ${file}`);
    }
  }
  if (masks && sources.some((s) => masks.photos?.[s.name]?.sourceSha256 !== s.sha256))
    throw new Error("Evaluation mask identities differ from the input photographs");
  if (
    resume &&
    JSON.stringify(resume.sources?.slice().sort((a, b) => a.name.localeCompare(b.name))) !==
      JSON.stringify(sources.slice().sort((a, b) => a.name.localeCompare(b.name)))
  )
    throw new Error("Geometry checkpoint input hashes differ");
  const port = Number(options.port || 4184);
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["tools/cdx-mp2-server.mjs", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser, browserServer;
  try {
    // Accept only our listener's ready message; another lane may own the requested port.
    await new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(startupTimer);
        server.removeListener("error", finish);
        server.removeListener("exit", failed);
        server.stdout.removeListener("data", ready);
        error ? reject(error) : resolve();
      };
      const failed = () => finish(new Error("Probe server could not start; choose an unused port"));
      const ready = (bytes) =>
        finish(
          String(bytes).includes(`Static byte-range server: ${base}/`)
            ? null
            : new Error("Unexpected probe server response"),
        );
      const startupTimer = setTimeout(
        () => finish(new Error("Probe server did not become ready")),
        10000,
      );
      server.once("error", finish);
      server.once("exit", failed);
      server.stdout.once("data", ready);
    });
    browserServer = await chromium.launchServer({
      executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
      args: [
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
        "--enable-unsafe-webgpu",
        "--enable-features=Vulkan,WebGPU",
        "--use-webgpu-adapter=swiftshader",
        "--use-vulkan=swiftshader",
      ],
    });
    browser = await chromium.connect(browserServer.wsEndpoint());
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route(`${base}/photos3d-probe.html`, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<input type="file" multiple><canvas></canvas>',
      }),
    );
    await page.goto(`${base}/photos3d-probe.html`);
    await page.setInputFiles("input", files);
    await page.exposeFunction("probeLog", (s) => {
      if (
        options.round2 ||
        /features:|matching .*pairs|usable pairs|SfM done|training finished/.test(s)
      )
        console.log(s);
    });
    await page.exposeFunction("probePly", (data) =>
      fs.writeFile(out.replace(/\.json$/, "") + ".ply", Buffer.from(data)),
    );
    await page.exposeFunction("probeCheckpoint", (data) =>
      fs.writeFile(
        out.replace(/\.json$/, "") + ".geometry.json",
        JSON.stringify({
          ...data,
          sources,
          geometryProvenance: resume?.geometryProvenance || provenance,
        }) + "\n",
      ),
    );
    await page.exposeFunction("probeFold", (data) =>
      fs.appendFile(out.replace(/\.json$/, "") + ".folds.jsonl", JSON.stringify(data) + "\n"),
    );
    await page.exposeFunction("probeRender", (name, data) => {
      if (path.basename(name) !== name) throw new Error("Invalid render identity");
      return fs.writeFile(
        out.replace(/\.json$/, "") + `.${name}.render.png`,
        Buffer.from(data.split(",")[1], "base64"),
      );
    });
    const timeoutMs = Number(options.timeout || 600000);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid timeout");
    const row = await withWatchdog(
      page.evaluate(options.round2 ? browserRound2 : browserProbe, {
        profile: options.profile || "phone",
        timeoutMs,
        trainSteps: Number(options.steps || 0),
        match: options.match,
        featureSide: options.featureSide ? Number(options.featureSide) : undefined,
        assumeSingleLens: options.assumeSingleLens === "true",
        focal35: options.focal35 ? Number(options.focal35) : undefined,
        cpuMatching: options.match === "cpu",
        iterations: Number(options.iterations || 0),
        seed: options.seed ? Number(options.seed) : undefined,
        folds: options.folds,
        masks,
        resume,
      }),
      timeoutMs + 5000,
      () => browserServer.kill(),
    );
    const truth = truthFile.value;
    return {
      ...row,
      ...(truth
        ? {
            cameraScore: scoreCameras(row.cameras || [], truth.cameras, truth.sceneSize),
          }
        : {}),
      ...loadedIdentities,
      browser: browser.version(),
      shuffleSeed: Number(options.shuffle || 0),
      geometryProvenance: resume?.geometryProvenance || provenance,
    };
  } catch (e) {
    return {
      kind: "interrupted browser photo diagnostic",
      ...loadedIdentities,
      accepted: [],
      missing: names.map((name) => ({
        name,
        reason: "Probe interrupted; no completed camera result claimed.",
      })),
      error: { name: e.name, message: e.message, stack: e.stack },
    };
  } finally {
    await browser?.close();
    await browserServer?.close();
    server.kill();
  }
}

async function main() {
  const options = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const parts = a.replace(/^--/, "").split("=");
      return [parts.shift(), parts.length ? parts.join("=") : true];
    }),
  );
  options.round2 = options.round2 === true || options.round2 === "true";
  if (options.help || (!options.input && !options.control)) {
    console.log(
      "node tools/photos3d-probe.mjs --input=<photo-directory> [--profile=phone|high] [--shuffle=104] [--steps=2] [--timeout=600000] --out=<raw.json>\nRound two: add --round2 [--dataset=<frozen-id>] [--featureSide=1280|1600] [--assumeSingleLens=true|--focal35=<mm>] [--match=cpu] [--iterations=200] [--folds=all|photo-name] [--masks=<annotation.json>] [--resume=<geometry.json>] [--truth=<exact-cameras.json>]. Use a separate --port per simultaneous probe.\nOr --control=uniform|mixed [--count=24] [--calibration=free] [--sentinel=red|blue] [--round2]. Exact-correspondence controls are not image-set benchmarks.",
    );
    return;
  }
  const out = path.resolve(options.out || ".cache/photos3d/result.json");
  await fs.mkdir(path.dirname(out), { recursive: true });
  const provenance = {
    date: new Date().toISOString(),
    options,
    commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    sourceHashes: [
      ...(await fingerprint("vendor/splatjs")),
      ...(await fingerprint("src/video3d")),
      ...(await fingerprint("src/photos3d")),
      ["tools/photos3d-evaluate.mjs", sha(await fs.readFile("tools/photos3d-evaluate.mjs"))],
      ["tools/studio-truth/metrics.mjs", sha(await fs.readFile("tools/studio-truth/metrics.mjs"))],
      ["tools/photos3d-probe.mjs", sha(await fs.readFile("tools/photos3d-probe.mjs"))],
      ["tools/photos3d-controls.mjs", sha(await fs.readFile("tools/photos3d-controls.mjs"))],
      [
        "tools/studio-truth/alignment.mjs",
        sha(await fs.readFile("tools/studio-truth/alignment.mjs")),
      ],
    ],
  };
  await fs.writeFile(out, JSON.stringify({ provenance, status: "running" }, null, 2) + "\n");
  if (options.round2 && options.input)
    await fs.writeFile(out.replace(/\.json$/, "") + ".folds.jsonl", "");
  let result;
  try {
    result = options.control
      ? await controlProbe(options)
      : await photoProbe(options, out, provenance);
  } catch (e) {
    result = { error: { name: e.name, message: e.message, stack: e.stack } };
  }
  await fs.writeFile(out, JSON.stringify({ provenance, ...result }, null, 2) + "\n");
  console.log(
    JSON.stringify({
      out,
      seconds: result.seconds,
      registered: result.cameras?.length,
      points: result.points,
      score: result.score,
      firstViewSeconds: result.firstViewSeconds,
      error: result.error,
    }),
  );
  if (result.error) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main();
