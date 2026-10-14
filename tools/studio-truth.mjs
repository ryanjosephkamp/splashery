// MIT. Source-backed truth scoring, sandboxed Chromium, one browser page.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { serve } from "./studio-truth/server.mjs";
import { sampleTruth } from "./studio-truth/sampling.mjs";
import {
  openPhoto,
  showPhoto,
  openMoving,
  movingDepth,
  captureFront,
  trainVideo,
  prepareNovel,
  captureNovel,
} from "./studio-truth/browser.mjs";
import {
  fitInverseDepth,
  depthError,
  calibratedDepth,
  imageMetrics,
  temporalJitter,
} from "./studio-truth/metrics.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith("--")) throw new Error("Use --option value");
  const [key, value] = a.slice(2).split("=");
  args[key] = value ?? (process.argv[i + 1]?.startsWith("--") ? true : (process.argv[++i] ?? true));
}
if (args.help) {
  console.log(
    "node tools/studio-truth.mjs --fixtures .cache/studio-truth/full-v1 --out .cache/studio-truth/main.json [--baseline <commit>] [--scenes still-life,room] [--toys photo,moving,video] [--timeout 600] [--novel | --depth-only]\nRuns unmodified product modules; one sandboxed page, no GPU policy overrides. --novel adds held-out Photo camera diagnostics with source median-plane calibration. Unregistered Moving color and unavailable GPU measurements remain null.",
  );
  process.exit(0);
}
if (process.platform !== "linux") throw new Error("This run is scoped to Linux cloud execution");
const fixtureRoot = path.resolve(root, args.fixtures || "tests/fixtures/truth");
const out = path.resolve(root, args.out || ".cache/studio-truth/main.json");
const evidence = out.replace(/\.json$/, "") + "-images";
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.mkdir(evidence, { recursive: true });
const baseline = execFileSync(
  "git",
  ["rev-parse", "--verify", "--end-of-options", `${args.baseline || "origin/main"}^{commit}`],
  {
    cwd: root,
    encoding: "utf8",
  },
).trim();
const productDiff = execFileSync("git", ["diff", baseline, "--", "src/", "vendor/"], {
  cwd: root,
  encoding: "utf8",
});
if (productDiff)
  throw new Error(
    "Baseline scorer requires src/ and vendor/ identical to the requested baseline commit",
  );
const manifest = JSON.parse(await fs.readFile(path.join(fixtureRoot, "manifest.json"), "utf8"));
const requested = args.scenes?.split(",");
const scenes = manifest.scenes.filter((s) => !requested || requested.includes(s.id));
if (requested && scenes.length !== requested.length)
  throw new Error("Unknown scene or incomplete manifest");
const toys = String(args.toys || "photo,moving,video").split(",");
if (toys.some((t) => !["photo", "moving", "video"].includes(t))) throw new Error("Unknown toy");
const timeoutMs = 1000 * Number(args.timeout || 600);
const depthOnly = !!args["depth-only"];
const novel = !!args.novel;
if (novel && depthOnly) throw new Error("Novel-view scoring requires the real app");
if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 1800000)
  throw new Error("Timeout must be 1–1800 seconds");
const report = {
  schema: 1,
  baselineSha: baseline,
  date: new Date().toISOString(),
  platform: process.platform,
  fixtureManifestSha256: createHash("sha256")
    .update(await fs.readFile(path.join(fixtureRoot, "manifest.json")))
    .digest("hex"),
  browser: null,
  launch: { chromiumSandbox: true, customGraphicsFlags: [] },
  profile: "desktop, mid tier; viewport 1440x900, DPR 1",
  coverage: {
    sceneIds: scenes.map((s) => s.id),
    toys,
    renderView: depthOnly
      ? "inference only; no render evidence"
      : novel
        ? "Photo flat front view and held-out walk cameras; Moving color unregistered"
        : "Photo flat front view; Moving color unregistered",
    movingRenderSampling:
      "depth/jitter only for decoded frames registered by requestVideoFrameCallback; color metrics withheld",
    limitations: [
      "No phone hardware measurements",
      novel
        ? "Held-out Photo views use source median-plane calibration, not a metric reconstruction"
        : "No novel-view disocclusion coverage",
      "Inverse-depth calibration uses 1-in-8 pixels, not metric-depth inference",
      "Novel-view relief calibration assumes the source median plane; the toys remain stylized, nonmetric geometry",
      "Video held-out training/rendering requires WebGPU",
    ],
  },
  rows: [],
};
report.scorerInputs = {};
for (const name of [
  "tools/studio-truth.mjs",
  "tools/studio-truth/browser.mjs",
  "tools/studio-truth/metrics.mjs",
  "tools/studio-truth/sampling.mjs",
  "tools/studio-truth/novel.mjs",
  "tools/studio-truth/alignment.mjs",
  "tools/studio-truth/transport.mjs",
  "vendor/depth-anything-v2-small/model_quantized.onnx",
]) {
  report.scorerInputs[name] = createHash("sha256")
    .update(await fs.readFile(path.join(root, name)))
    .digest("hex");
}
report.fixtureManifest = manifest;
const save = () => fs.writeFile(out, JSON.stringify(report, null, 2) + "\n");
const server = await serve(root, fixtureRoot);
let browser;

async function truth(scene, kind, index = 0) {
  const folder = path.join(fixtureRoot, scene, kind);
  const sequence = JSON.parse(await fs.readFile(path.join(folder, "poses.json"), "utf8"));
  const pose = sequence.frames[index];
  if (!pose) throw new Error("Missing truth pose");
  const bytes = await fs.readFile(path.join(folder, pose.depth));
  const raw = gunzipSync(bytes);
  if (raw.length !== pose.width * pose.height * 4)
    throw new Error("Depth payload dimension mismatch");
  const z = new Float32Array(raw.length / 4);
  for (let i = 0; i < z.length; i++) z[i] = raw.readFloatLE(i * 4);
  const maskBytes = await fs.readFile(path.join(folder, pose.mask));
  const mask = PNG.sync.read(maskBytes);
  const rgbBytes = await fs.readFile(path.join(folder, pose.rgb));
  const rgb = jpeg.decode(rgbBytes, { useTArray: true });
  if ([mask, rgb].some((p) => p.width !== pose.width || p.height !== pose.height))
    throw new Error("Truth dimensions differ");
  return {
    pose,
    z,
    mask: Uint8Array.from({ length: z.length }, (_, i) => mask.data[i * 4]),
    rgb: rgb.data,
    hashes: {
      rgb: createHash("sha256").update(rgbBytes).digest("hex"),
      depth: createHash("sha256").update(bytes).digest("hex"),
      mask: createHash("sha256").update(maskBytes).digest("hex"),
    },
  };
}

async function front(page, toy, scene, t, frame = 0) {
  const capture = await captureFront(page, toy, frame);
  const ref = sampleTruth(t, capture.w, capture.h);
  const file = path.join(evidence, `${scene}-${toy}-${String(frame).padStart(3, "0")}.png`);
  const png = Buffer.from(capture.png, "base64");
  await fs.writeFile(file, png);
  return {
    frame,
    ...imageMetrics(ref.rgba, PNG.sync.read(png).data, capture.w, capture.h, ref.mask, ref.edges),
    registration: capture.registration,
    convention: capture.convention,
    image: path.relative(root, file),
  };
}

async function heldOut(page, toy, scene, base) {
  const sequence = JSON.parse(
    await fs.readFile(path.join(fixtureRoot, scene, "walk", "poses.json"), "utf8"),
  );
  const selected = sequence.frames.filter((frame) => frame.held_out);
  if (selected.length !== 37) throw new Error("Generate the 37 held-out walk truth frames first");
  const values = Array.from(base.z)
    .filter((z, i) => base.mask[i] === 1 && Number.isFinite(z) && z > 0)
    .sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)];
  await prepareNovel(page, toy);
  const rows = [];
  for (const pose of selected) {
    const t = await truth(scene, "walk", pose.frame);
    const capture = await captureNovel(page, toy, base.pose, t.pose, median);
    const ref = sampleTruth(t, capture.w, capture.h);
    const file = path.join(
      evidence,
      `${scene}-${toy}-held-out-${String(pose.frame).padStart(3, "0")}.png`,
    );
    const png = Buffer.from(capture.png, "base64");
    await fs.writeFile(file, png);
    rows.push({
      frame: pose.frame,
      time: pose.time,
      ...imageMetrics(ref.rgba, PNG.sync.read(png).data, 640, 360, ref.mask, ref.edges),
      camera: capture.camera,
      sourceMedianMeters: median,
      inputHashes: t.hashes,
      image: path.relative(root, file),
    });
  }
  return rows;
}

const bounded = async (fn, ms) => {
  let timer;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

try {
  browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
    chromiumSandbox: true,
    timeout: 20000,
  });
  report.browser = browser.version();
  await save();
  for (const scene of scenes)
    for (const toy of toys) {
      const row = {
        scene: scene.id,
        toy,
        status: "pending",
        depth: null,
        frontView: null,
        jitter: null,
        heldOutSharpness: null,
        errors: [],
      };
      report.rows.push(row);
      await save();
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      });
      // Assets and model inference stay on this loopback origin.
      await page.route("**/*", (route) =>
        new URL(route.request().url()).origin === server.url ? route.continue() : route.abort(),
      );
      page.on("pageerror", (error) => row.errors.push(error.message));
      page.on("response", (response) => {
        if (response.status() >= 400)
          row.errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
      });
      await page.exposeFunction("__truthStatus", async (text) => {
        row.progress = text;
        await save();
      });
      try {
        await bounded(async () => {
          row.phase = "app startup";
          await save();
          await page.goto(
            depthOnly
              ? `${server.url}/tests/studio-truth.html`
              : `${server.url}/?renderer=webgl2&adapt=off&profile=mid&labs=1`,
            {
              timeout: 60000,
            },
          );
          if (!depthOnly)
            await page.waitForSelector("body[data-ready='true']", { timeout: 120000 });
          if (toy === "photo") {
            const t = await truth(scene.id, "still");
            row.inputHashes = t.hashes;
            row.phase = "photo inference";
            await save();
            if (!depthOnly) {
              await page.evaluate(() => window.__splashery.player.setPaused(true));
              row.renderDuringInference = "unrelated stage animation paused through the player API";
            }
            const result = await openPhoto(page, `/__truth/${scene.id}/still/${t.pose.rgb}`);
            const sampled = sampleTruth(t, result.w, result.h);
            const prediction = Float32Array.from(result.d);
            const fit = fitInverseDepth(prediction, sampled.z, sampled.mask);
            row.depth = {
              ...depthError(prediction, sampled.z, sampled.mask, fit),
              calibration: fit,
              inferenceMs: result.ms,
              grid: [result.w, result.h],
            };
            if (!depthOnly) {
              row.phase = "photo viewer";
              await save();
              await showPhoto(page);
              await page.evaluate(() => window.__splashery.player.setPaused(false));
              row.phase = "photo capture";
              await save();
              row.frontView = [await front(page, toy, scene.id, t)];
            }
            if (novel) {
              row.phase = "held-out photo cameras";
              await save();
              row.heldOutSharpness = await heldOut(page, toy, scene.id, t);
            }
            row.status = "measured";
          } else if (toy === "moving") {
            await fs.access(path.join(fixtureRoot, scene.id, "handheld.mp4"));
            row.phase = "moving clip inference";
            await save();
            if (!depthOnly) {
              await page.evaluate(() => window.__splashery.player.setPaused(true));
              row.renderDuringInference = "unrelated stage animation paused through the player API";
            }
            // Color is unregistered, so do not spend time preparing an unscored renderer.
            const clip = await openMoving(page, `/__truth/${scene.id}/handheld.mp4`, false);
            row.frameTimestampSources = [...new Set(clip.captures.map((frame) => frame.source))];
            row.captureFrames = clip.captures;
            row.unregisteredFrames = clip.captures.flatMap((frame, i) =>
              frame.source === "requestVideoFrameCallback" ? [] : [i],
            );
            row.sourceClipSha256 = createHash("sha256")
              .update(await fs.readFile(path.join(fixtureRoot, scene.id, "handheld.mp4")))
              .digest("hex");
            row.depth = [];
            row.jitter = [];
            row.frontView = null;
            row.colorStatus = "unregistered";
            row.colorReason =
              "The Sharp renderer asynchronously seeks a separate video copy; its uploaded decoded color timestamp is not exposed. Color, hole, and edge-band render metrics remain null.";
            row.phase = "registered depth scoring";
            await save();
            let fit, previous;
            for (let i = 0; i < clip.times.length; i++) {
              if (clip.captures[i].source !== "requestVideoFrameCallback") {
                row.depth.push({ frame: i, status: "unregistered", metrics: null });
                previous = null;
                continue;
              }
              const frame = Math.max(0, Math.min(119, Math.round(clip.captures[i].time * 30)));
              const t = await truth(scene.id, "handheld", frame),
                sampled = sampleTruth(t, clip.w, clip.h);
              const prediction = Float32Array.from(await movingDepth(page, i));
              if (!fit) {
                fit = fitInverseDepth(prediction, sampled.z, sampled.mask);
                row.calibrationFrame = i;
              }
              const metric = depthError(prediction, sampled.z, sampled.mask, fit),
                calibrated = calibratedDepth(prediction, fit);
              row.depth.push({
                frame: i,
                truthFrame: frame,
                time: clip.times[i],
                decodedTime: clip.captures[i].time,
                ...metric,
                inputHashes: t.hashes,
              });
              if (previous)
                row.jitter.push({
                  frame: i,
                  ...temporalJitter(
                    previous.calibrated,
                    calibrated,
                    previous.sampled.z,
                    sampled.z,
                    previous.sampled.mask,
                    sampled.mask,
                    previous.sampled.pose,
                    sampled.pose,
                    clip.w,
                    clip.h,
                  ),
                });
              previous = { calibrated, sampled };
              if (i % 8 === 0) await save();
            }
            row.calibration = fit;
            row.extractedFrames = clip.times.length;
            if (novel) {
              row.heldOutStatus = "unregistered";
              row.heldOutReason =
                "The displayed color source pose and inferred depth source pose cannot both be registered; no held-out Moving score is claimed.";
            }
            row.status = row.unregisteredFrames.length || !depthOnly ? "partial" : "measured";
            if (row.unregisteredFrames.length)
              row.reason =
                "Unregistered decoded frames have null metrics; no all-frame pass is claimed.";
            else if (!depthOnly)
              row.reason =
                "Registered depth was measured; color/render metrics remain unregistered.";
          } else {
            // Probe before accessing a full dataset; an absent GPU is an actual limitation.
            Object.assign(row, await trainVideo(page, `/__truth/${scene.id}/walk.mp4`, timeoutMs));
          }
        }, timeoutMs);
      } catch (error) {
        row.status =
          row.depth && (!Array.isArray(row.depth) || row.depth.length) ? "partial" : "failed";
        row.reason = String(error);
      } finally {
        await page.close();
        await save();
      }
      console.log(`${scene.id} ${toy}: ${row.status}${row.reason ? " — " + row.reason : ""}`);
    }
} catch (error) {
  report.fatal = String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
  await save();
}
if (report.rows.some((row) => ["failed", "pending", "partial"].includes(row.status)))
  process.exitCode = 1;
console.log(`Evidence: ${path.relative(root, out)}`);
