#!/usr/bin/env node
// MIT. Build-only, fixed-camera comparison and preparation for task 55.
// prepare <scratch> <source-directory>; render <scratch> <main|candidate> [id ...];
// score <scratch> <main|candidate>. A local static server is required for render.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { SAMPLES } from "../src/video3d/samples.js";
import { evaluationCameras, imageMetrics } from "./cdx-v3d-clarity-metrics.mjs";

const [mode, scratchArg, variant, ...args] = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith("--"));
const option = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
if (!scratchArg || !["prepare", "render", "score"].includes(mode))
  throw new Error(
    "Usage: cdx-v3d-clarity.mjs <prepare|render|score> <scratch> <source-directory|main|candidate> [id ...]",
  );
const scratch = path.resolve(scratchArg);
if (scratch.startsWith(path.resolve(".") + path.sep))
  throw new Error("Keep build and review files outside the repository.");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const read = (file) => JSON.parse(fs.readFileSync(file));
const ledgerFile = path.join(scratch, "ledger.json");
const selected = SAMPLES.filter((s) => !ids.length || ids.includes(s.id));
if (mode === "prepare") {
  const pending = fs.existsSync(ledgerFile) ? read(ledgerFile) : null;
  if (pending?.complete) throw new Error("The frozen evaluation ledger already exists.");
  fs.mkdirSync(scratch, { recursive: true });
  // Task 55 starts from these immutable revisions. A later push must never silently move the
  // four approved PR baselines. Explicit flags permit a separate future comparison.
  const main = execFileSync(
    "git",
    [
      "rev-parse",
      "--verify",
      "--end-of-options",
      option("main", "a21899586de4ca506f4d9bc4033261db3ee6bcad"),
    ],
    { encoding: "utf8" },
  ).trim();
  const branchBaseline = execFileSync(
    "git",
    [
      "rev-parse",
      "--verify",
      "--end-of-options",
      option("branch-baseline", "cde9cfa50187637ef1e92d8b36b042354f609dd0"),
    ],
    {
      encoding: "utf8",
    },
  ).trim();
  const ledger = pending || {
    main,
    created: new Date().toISOString(),
    side: 960,
    protocol:
      "Every fourth midpoint between legacy cameras, about one frame in eight of the augmented input. Midpoint poses are interpolated, not independently solved. Neither image alignment nor image masks are used. Statue and Street baselines are main. The four samples absent from main use PR #562's starting bakes; they are not main comparisons. Baselines predate these midpoint frames.",
    samples: [],
  };
  if (ledger.main !== main)
    throw new Error("Main moved during preparation; preserve the previous ledger.");
  ledger.protocol =
    "Every fourth midpoint between legacy cameras, about one frame in eight. Interpolated poses, no image alignment or masks. Baselines are main for Statue and Street, and PR #562's starting bakes for the four samples absent from main.";
  for (const s of selected) {
    if (ledger.samples.some((r) => r.id === s.id)) continue;
    const baselineRef = ["liberty", "edinburgh"].includes(s.id) ? main : branchBaseline;
    const folder = path.join(scratch, s.id);
    fs.mkdirSync(path.join(folder, "frames"), { recursive: true });
    const metaBytes = execFileSync(
      "git",
      ["show", `${baselineRef}:assets/toys/video-3d/${s.id}.json`],
      {
        maxBuffer: 4e6,
      },
    );
    const plyBytes = execFileSync(
      "git",
      ["show", `${baselineRef}:assets/toys/video-3d/${s.id}.ply`],
      {
        maxBuffer: 20e6,
      },
    );
    fs.writeFileSync(path.join(folder, "main.ply"), plyBytes);
    const meta = JSON.parse(metaBytes);
    const cams = evaluationCameras(meta.cams);
    const source = ["liberty", "edinburgh"].includes(s.id)
      ? path.join(variant, `${s.id}-1080.mp4`)
      : path.join(variant, s.id, "capture.webm");
    const offset = ["liberty", "edinburgh"].includes(s.id) ? 0 : s.span.start;
    const probe = JSON.parse(
      execFileSync("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "json",
        source,
      ]),
    );
    const sourceSize = probe.streams[0];
    if (Math.max(sourceSize.width, sourceSize.height) < 960)
      throw new Error(`Source below 960 pixels: ${s.id}`);
    for (const [i, cam] of cams.entries()) {
      const scale = ledger.side / Math.max(cam.w, cam.h);
      const w = Math.round(cam.w * scale),
        h = Math.round(cam.h * scale);
      const file = `${String(i).padStart(3, "0")}.png`;
      execFileSync("ffmpeg", [
        "-nostdin",
        "-v",
        "error",
        "-y",
        "-threads",
        "2",
        "-ss",
        String(cam.time + offset),
        "-i",
        source,
        "-frames:v",
        "1",
        "-vf",
        `scale=${w}:${h}:flags=lanczos`,
        "-threads",
        "1",
        path.join(folder, "frames", file),
      ]);
      cam.frame = file;
      cam.frameSha256 = hash(fs.readFileSync(path.join(folder, "frames", file)));
    }
    write(path.join(folder, "main.json"), { ...meta, cams });
    const entry = {
      id: s.id,
      baselineRef,
      baselineKind: baselineRef === main ? "main" : "PR #562 starting bake; absent from main",
      license: s.license,
      source: s.source,
      sourceFile: path.resolve(source),
      sourceSha256: hash(fs.readFileSync(source)),
      sourceSize,
      sourceTimeOffset: offset,
      mainPlySha256: hash(plyBytes),
      mainMetadataSha256: hash(metaBytes),
      originalCameras: meta.cams.length,
      frames: cams.length,
      heldOut: cams.flatMap((c, i) => (c.heldOut ? [i] : [])),
      cameraLedgerSha256: hash(fs.readFileSync(path.join(folder, "main.json"))),
    };
    ledger.samples.push(entry);
    write(ledgerFile, ledger);
    console.log(
      `${s.id}: ${cams.length} frames, ${entry.heldOut.length} held out; ${sourceSize.width}×${sourceSize.height} source`,
    );
  }
  ledger.complete = ledger.samples.length === SAMPLES.length;
  write(ledgerFile, ledger);
} else if (mode === "render") {
  if (!/^[a-z][a-z0-9-]*$/.test(variant)) throw new Error("Choose a safe bake name.");
  const ledger = read(ledgerFile);
  const base = (process.env.SPLASHERY_URL || "http://127.0.0.1:4175").replace(/\/$/, "");
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
    for (const record of ledger.samples.filter((s) => !ids.length || ids.includes(s.id))) {
      const folder = path.join(scratch, record.id);
      const fixed = read(path.join(folder, "main.json"));
      const poseFile = path.join(folder, `${variant}.json`);
      const poseMeta = variant !== "main" && fs.existsSync(poseFile) ? read(poseFile) : fixed;
      if (
        poseMeta.cams.length !== fixed.cams.length ||
        poseMeta.cams.some(
          (c, i) => c.time !== fixed.cams[i].time || c.frameSha256 !== fixed.cams[i].frameSha256,
        )
      )
        throw new Error("Model cameras must name the same frozen physical source frames.");
      const model = path.join(folder, `${variant}.ply`);
      if (variant === "main" && hash(fs.readFileSync(model)) !== record.mainPlySha256)
        throw new Error("Changed main baseline.");
      const cam = fixed.cams[0],
        scale = ledger.side / Math.max(cam.w, cam.h);
      const width = Math.round(cam.w * scale),
        height = Math.round(cam.h * scale);
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      page.on("pageerror", (e) => console.error(e));
      await page.route(`${base}/__clarity.html`, (r) =>
        r.fulfill({
          contentType: "text/html",
          body: '<style>body{margin:0;background:black}canvas{display:block}</style><canvas id="view"></canvas>',
        }),
      );
      await page.route(`${base}/__clarity.ply`, (r) =>
        r.fulfill({ path: model, contentType: "application/octet-stream" }),
      );
      await page.goto(`${base}/__clarity.html`);
      await page.evaluate(
        async ({ width, height }) => {
          const [{ createSession }, { readPlyHeader, decimatePly }] = await Promise.all([
            import("/vendor/splatjs/src/session.js"),
            import("/src/loaders.js"),
          ]);
          const bytes = new Uint8Array(await (await fetch("/__clarity.ply")).arrayBuffer());
          const header = readPlyHeader(bytes),
            table = decimatePly(bytes, header, header.count, 7);
          const col = Object.fromEntries(table.props.map((p) => [p.name, p.storage]));
          const data = new Float32Array(table.count * 16);
          for (let i = 0; i < table.count; i++)
            data.set(
              [
                col.x[i],
                col.y[i],
                col.z[i],
                col.scale_0[i],
                col.scale_1[i],
                col.scale_2[i],
                col.rot_0[i],
                col.rot_1[i],
                col.rot_2[i],
                col.rot_3[i],
                col.f_dc_0[i],
                col.f_dc_1[i],
                col.f_dc_2[i],
                col.opacity[i],
                0,
                0,
              ],
              i * 16,
            );
          const session = createSession({
            maxViewW: width,
            maxViewH: height,
            trainer: { maxSplats: table.count, capMult: 1, shDeg: 0, mipComp: false, dilate: 0.1 },
          });
          await session.seedFrom({ data, n: table.count, shK: 0, dc: "sh" }, { viewOnly: true });
          const canvas = document.getElementById("view");
          canvas.width = width;
          canvas.height = height;
          window.__clarity = session;
        },
        { width, height },
      );
      for (const index of record.heldOut) {
        const c = poseMeta.cams[index];
        await page.evaluate(
          async ({ c, width, height }) => {
            const session = window.__clarity,
              sx = width / c.w,
              sy = height / c.h;
            session.view.setCamera({
              R: c.R,
              t: c.t,
              f: c.f * sx,
              fy: (c.fy ?? c.f) * sy,
              cx: (c.cx ?? c.w / 2) * sx,
              cy: (c.cy ?? c.h / 2) * sy,
              w: width,
              h: height,
            });
            if (!window.__attached) {
              session.view.attach(document.getElementById("view"));
              window.__attached = true;
            }
            session.view.renderNow();
            await session.trainer.device.queue.onSubmittedWorkDone();
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          },
          { c, width, height },
        );
        await page
          .locator("#view")
          .screenshot({ path: path.join(folder, `${variant}-${index}.png`), timeout: 120000 });
        console.log(`${record.id} ${variant} ${index}`);
      }
      await page.evaluate(() => window.__clarity.dispose());
      write(path.join(folder, `${variant}-render-receipt.json`), {
        id: record.id,
        variant,
        plySha256: hash(fs.readFileSync(model)),
        poseSha256: hash(JSON.stringify(poseMeta.cams)),
        cameraSolve: poseMeta.cameraSolve || null,
        frames: record.heldOut.map((index) => ({
          index,
          time: fixed.cams[index].time,
          sha256: hash(fs.readFileSync(path.join(folder, `${variant}-${index}.png`))),
        })),
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
} else {
  const ledger = read(ledgerFile),
    results = [];
  const scoresFile = path.join(scratch, `${variant}-scores.json`);
  const ledgerSha256 = hash(fs.readFileSync(ledgerFile));
  for (const record of ledger.samples.filter((s) => !ids.length || ids.includes(s.id))) {
    const folder = path.join(scratch, record.id),
      fixed = read(path.join(folder, "main.json"));
    const receipt = read(path.join(folder, `${variant}-render-receipt.json`));
    const plySha256 = hash(fs.readFileSync(path.join(folder, `${variant}.ply`)));
    if (receipt.plySha256 !== plySha256)
      throw new Error("Renders belong to another model; render the final export again.");
    const poseFile = path.join(folder, `${variant}.json`);
    const poseMeta = variant !== "main" && fs.existsSync(poseFile) ? read(poseFile) : fixed;
    const poseSha256 = hash(JSON.stringify(poseMeta.cams));
    if (receipt.poseSha256 !== poseSha256)
      throw new Error("Renders belong to another camera ledger; render the final export again.");
    if (hash(fs.readFileSync(path.join(folder, "main.json"))) !== record.cameraLedgerSha256)
      throw new Error("Changed frozen camera ledger.");
    const frames = record.heldOut.map((index) => {
      const realBytes = fs.readFileSync(path.join(folder, "frames", fixed.cams[index].frame));
      if (hash(realBytes) !== fixed.cams[index].frameSha256)
        throw new Error("Changed reference image.");
      const renderBytes = fs.readFileSync(path.join(folder, `${variant}-${index}.png`));
      const recorded = receipt.frames.find((f) => f.index === index);
      if (
        !recorded ||
        recorded.time !== fixed.cams[index].time ||
        recorded.sha256 !== hash(renderBytes)
      )
        throw new Error("Changed rendered image or evaluation timestamp.");
      return {
        index,
        time: fixed.cams[index].time,
        ...imageMetrics(PNG.sync.read(renderBytes), PNG.sync.read(realBytes)),
      };
    });
    const mean = (key) => frames.reduce((sum, f) => sum + f[key], 0) / frames.length;
    results.push({
      id: record.id,
      plySha256,
      poseSha256,
      frames,
      mean: Object.fromEntries(
        ["psnr", "ssim", "laplacian", "sourceLaplacian", "sharpnessRatio"].map((k) => [k, mean(k)]),
      ),
    });
    console.log(JSON.stringify({ id: record.id, mean: results.at(-1).mean }));
  }
  const prior = fs.existsSync(scoresFile) ? read(scoresFile) : null;
  if (prior && prior.ledgerSha256 !== ledgerSha256)
    throw new Error("Existing measurements use another frozen evaluation ledger.");
  write(scoresFile, {
    main: ledger.main,
    ledgerSha256,
    renderer:
      "Splat.js sorted Gaussian; raw classic 3DGS opacity, 0.1 pixel-squared dilation; 960 pixels; full exported count",
    results: [
      ...(prior?.results || []).filter((s) => !results.some((r) => r.id === s.id)),
      ...results,
    ],
  });
}
