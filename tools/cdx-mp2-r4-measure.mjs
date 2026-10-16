// Round 4 real-browser source-clock sweep. The baseline source correction is
// disclosed: main's geometry/shaders receive the exact selected native picture.
// Long films absent from main are opened through its actual upload path.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { GRAPHICS_LAUNCH, openRender, renderFrame } from "./cdx-mp2-render.mjs";
import { SAMPLES, LONG_SAMPLES } from "../src/packs/moving-photo.js";

import { R4_CASES } from "./cdx-mp2-r4-cases.mjs";
import { sourceTimeline } from "./cdx-mp2-r4-clock.mjs";

const option = (key, fallback = "") =>
  process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
const baseline = option("baseline"),
  out = option("out", "work/r4-quality.json"),
  cacheDir = option("cache-dir");
if (baseline && cacheDir) throw Error("A baseline must use its pinned depth assets");
const codeFiles = [
  "src/packs/moving-photo.js",
  "src/packs/photo-sharp.js",
  "src/packs/song-stream.js",
  "src/live/clip-stabilize.js",
  "src/packs/moving-photo-raster.js",
  "src/packs/moving-photo-depth.js",
  "src/packs/moving-photo-geometry.js",
  "src/packs/moving-photo-geometry-worker.js",
  "src/packs/moving-photo-video-worker.js",
  "assets/toys/moving-photo-3d/clip-geometry.wasm",
  ...(baseline
    ? ["bunny", "sintel", "elephants", "tears"].map(
        (name) => `assets/toys/moving-photo-3d/${name}-long.mp2depth`,
      )
    : []),
];
const code = new Map();
for (const file of codeFiles) {
  try {
    code.set(
      file,
      baseline
        ? execFileSync("git", ["show", `${baseline}:${file}`], {
            stdio: ["ignore", "pipe", "ignore"],
            maxBuffer: 128 << 20,
          })
        : await fs.readFile(file),
    );
  } catch (error) {
    if (!baseline) throw error;
  }
}
const hash = createHash("sha256");
for (const [file, bytes] of code) hash.update(file + "\0").update(bytes);
const sourceHash = hash.digest("hex"),
  sampled = Number(option("sampled", "0"));
const report = {
  protocol: "native-role-v5",
  baseline: baseline || null,
  revision: execFileSync("git", ["rev-parse", baseline || "HEAD"], { encoding: "utf8" }).trim(),
  codeRevision: execFileSync(
    "git",
    baseline ? ["rev-parse", baseline] : ["log", "-1", "--format=%H", "--", ...codeFiles],
    { encoding: "utf8" },
  ).trim(),
  sourceHash,
  baselineSourceCorrection: baseline
    ? "Exact selected native picture bound to the pinned baseline's unchanged geometry and shaders; long films use its upload path only when absent from its shelf"
    : null,
  temporalDepth: "displayed R8; R4 input correspondence enforced on every frame",
  depthCacheOverride: cacheDir
    ? "Builder output used for candidate validation; actual cache hashes are recorded per case"
    : null,
  sampled: sampled || null,
  timeline:
    "Original source timestamps and durations for file inputs, including every original GIF frame; retained JPEG sample times otherwise",
  profiles: option("profiles", "phone,desktop"),
  startedAt: new Date().toISOString(),
  results: [],
  errors: [],
};
await fs.mkdir(path.dirname(out), { recursive: true });
if (option("resume") === "true") {
  const prior = JSON.parse(await fs.readFile(out, "utf8"));
  for (const key of ["protocol", "baseline", "sourceHash", "sampled", "depthCacheOverride"])
    if ((prior[key] ?? null) !== (report[key] ?? null)) throw Error(`Resume ${key} differs`);
  const accepted = [];
  for (const row of prior.results) {
    if (row.errors.length || !row.complete) continue;
    let unchanged = true;
    for (const input of row.inputHashes || []) {
      const file =
        cacheDir && input.file.endsWith(".mp2depth")
          ? path.join(cacheDir, path.basename(input.file))
          : input.file;
      const bytes = await fs.readFile(file).catch(() => null);
      if (!bytes || createHash("sha256").update(bytes).digest("hex") !== input.sha256) {
        unchanged = false;
        break;
      }
    }
    if (unchanged) accepted.push(row);
    else console.log(JSON.stringify({ invalidatedChangedInput: row.id, profile: row.profile }));
  }
  if (!prior.temporalDepth && accepted.some((r) => r.frames.some((f) => !f.depthPixelsVerified)))
    throw Error("Prior temporal inputs were not verified as the displayed R8");
  report.results.push(...accepted);
  if (!prior.temporalDepth) report.resumedVerifiedDepthRows = accepted.length;
}
const save = () => fs.writeFile(out, JSON.stringify(report, null, 2) + "\n");
const deadline = Date.parse(option("deadline")) || Infinity;
const browser = await chromium.launch(GRAPHICS_LAUNCH);
try {
  report.browser = browser.version();
  for (const profile of report.profiles.split(","))
    for (const item of R4_CASES) {
      if (option("ids") && !option("ids").split(",").includes(item.id)) continue;
      if (report.results.some((r) => r.id === item.id && r.profile === profile)) continue;
      if (Date.now() >= deadline) break;
      const phone = profile === "phone",
        started = Date.now();
      const context = await browser.newContext(
        phone
          ? {
              viewport: { width: 390, height: 844 },
              deviceScaleFactor: 3,
              isMobile: true,
              hasTouch: true,
              userAgent:
                "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
            }
          : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
      );
      for (const [file, body] of code)
        await context.route(`**/${file}`, (route) =>
          route.fulfill({
            contentType: file.endsWith(".wasm")
              ? "application/wasm"
              : file.endsWith(".mp2depth")
                ? "application/octet-stream"
                : "text/javascript",
            body,
          }),
        );
      const page = await context.newPage(),
        errors = [];
      page.setDefaultTimeout(600000);
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (
          m.type() === "error" ||
          (m.type() === "warning" && /shader|invalid|parsing|validation/i.test(m.text()))
        )
          errors.push(m.text());
      });
      try {
        const hasLongShelf = /export const LONG_SAMPLES\b/.test(
          code.get("src/packs/moving-photo.js").toString(),
        );
        const upload = !!item.upload || !!(baseline && item.long && !hasLongShelf);
        const caseInputs = new Map();
        if (cacheDir && item.long && !upload) {
          const sample = LONG_SAMPLES.find((sample) => sample.id === item.id),
            file = `assets/toys/moving-photo-3d/${sample.file}.mp2depth`,
            candidate = path.join(cacheDir, `${sample.file}.mp2depth`);
          const cacheDeadline = Math.min(deadline, Date.now() + 600000);
          let bytes;
          while (Date.now() < cacheDeadline) {
            try {
              const data = await fs.readFile(candidate),
                view = new DataView(data.buffer, data.byteOffset, data.byteLength);
              if (
                data.length >= 12 &&
                data.subarray(0, 4).toString() === "MP2D" &&
                view.getUint32(8, true) === sample.frames &&
                data.length ===
                  12 + view.getUint16(4, true) * view.getUint16(6, true) * sample.frames
              ) {
                bytes = data;
                break;
              }
            } catch (error) {
              if (error.code !== "ENOENT") throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
          if (!bytes) throw Error(`Candidate cache did not finish: ${candidate}`);
          caseInputs.set(file, bytes);
          await context.route(`**/${file}`, (route) =>
            route.fulfill({ contentType: "application/octet-stream", body: bytes }),
          );
        }
        await openRender(page, {
          id: item.id,
          source: item.source,
          upload,
          tier: phone ? "low" : "mid",
          stepped: true,
          bindNativePicture: !!baseline,
        });
        const info = await page.evaluate(() => {
          const c = window.__mp3.MOVING.clip;
          return {
            w: c.w,
            h: c.h,
            n: c.n,
            duration: c.duration,
            delays: c.video ? null : c.delays,
            hasVideo: !!c.video,
            depthPlan: c.depth
              ? { w: c.depth.ms.w, h: c.depth.ms.h, n: c.depth.n, rate: c.depth.rate }
              : null,
          };
        });
        let times, sourceFrames;
        let sourceDelays = null;
        if (item.source) {
          const timeline = sourceTimeline(item.source, item.fps, info.duration);
          sourceFrames = timeline.timestamps.length;
          sourceDelays = timeline.durations;
          times = timeline.captureTimes;
        } else if (info.delays) {
          let clock = 0;
          sourceDelays = info.delays.map((d) => d / 1000);
          times = info.delays.map((d) => {
            const t = clock + d / 4000;
            clock += d / 1000;
            return t;
          });
        } else times = Array.from({ length: info.n }, (_, i) => (i + 0.25) / item.fps);
        const fullTimes = times;
        if (sampled)
          times = Array.from(
            new Set(
              Array.from(
                { length: Math.min(sampled, times.length) },
                (_, i) => times[Math.round((i * (times.length - 1)) / Math.max(1, sampled - 1))],
              ),
            ),
          );
        const h = createHash("sha256");
        const inputFiles = item.source ? [item.source] : [];
        if (item.source) h.update(await fs.readFile(item.source));
        else {
          const s = SAMPLES.find((s) => s.id === item.id);
          for (let i = 1; i <= s.sheets; i++) {
            const file = `assets/toys/moving-photo-3d/${s.file}-sheet-${i}.jpg`;
            inputFiles.push(file);
            h.update(await fs.readFile(file));
          }
        }
        const sample = SAMPLES.find((s) => s.id === item.id),
          long = LONG_SAMPLES.find((s) => s.id === item.id);
        if (!upload && sample) {
          inputFiles.push(`assets/toys/moving-photo-3d/${sample.file}.depth`);
          for (let i = 1; i <= sample.sheets; i++) {
            const file = `assets/toys/moving-photo-3d/${sample.file}-sheet-${i}.jpg`;
            if (!inputFiles.includes(file)) inputFiles.push(file);
          }
        }
        if (!upload && long) inputFiles.push(`assets/toys/moving-photo-3d/${long.file}.mp2depth`);
        const inputHashes = [];
        for (const file of inputFiles) {
          const bytes = caseInputs.get(file) || code.get(file) || (await fs.readFile(file));
          inputHashes.push({
            file,
            bytes: bytes.length,
            sha256: createHash("sha256").update(bytes).digest("hex"),
          });
        }
        const frames = [],
          review = option("review") && phone ? path.join(option("review"), item.id) : null;
        if (review) await fs.mkdir(review, { recursive: true });
        for (let i = 0; i < times.length; i++) {
          if (Date.now() >= deadline) break;
          let r;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              r = await renderFrame(page, times[i], {
                sourceWitness: true,
                verifyDepth: !baseline,
                displayedDepth: true,
                pictureOnly: !!review,
              });
              break;
            } catch (e) {
              if (attempt === 2 || !/Native source changed|native picture is stale/.test(e.message))
                throw e;
            }
          }
          if (review)
            await fs.writeFile(
              path.join(review, `${String(i).padStart(5, "0")}.png`),
              Buffer.from(r.picture.split(",")[1], "base64"),
            );
          const { picture, ...metrics } = r;
          frames.push(metrics);
          if (i % 120 === 0)
            console.log(
              JSON.stringify({
                progress: true,
                profile,
                id: item.id,
                frame: i,
                total: times.length,
                holes: r.holes,
                specks: r.edgeSpecks,
              }),
            );
        }
        const sum = (k) => frames.reduce((n, f) => n + f[k], 0),
          worst = frames.reduce((a, b) => (a.holeShare >= b.holeShare ? a : b));
        const result = {
          id: item.id,
          profile,
          path: item.upload ? "upload" : "sample",
          baselinePath: upload ? "upload" : "sample",
          ...info,
          sourceFrames: sourceFrames || fullTimes.length,
          sourceDelays,
          framesMeasured: frames.length,
          framesTotal: fullTimes.length,
          everyFrame: frames.length === fullTimes.length,
          depthInputMismatches: frames.filter((f) => !f.depthPixelsVerified).length,
          complete: frames.length === times.length,
          sourceSha256: h.digest("hex"),
          inputRevision: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          inputHashes,
          heightJitter: sum("jitter") / Math.max(1, sum("still")),
          edgeFlipsPer1000: (1000 * sum("flips")) / Math.max(1, sum("still")),
          worstHoleShare: worst.holeShare,
          worstHoleTime: worst.time,
          maxEdgeSpecks: Math.max(...frames.map((f) => f.edgeSpecks)),
          elapsedMs: Date.now() - started,
          errors,
          frames,
        };
        report.results.push(result);
        console.log(JSON.stringify({ ...result, frames: undefined, delays: undefined }));
      } catch (error) {
        report.errors.push({ id: item.id, profile, message: error.message });
        console.log(JSON.stringify(report.errors.at(-1)));
      } finally {
        await context.close();
        await save();
      }
    }
} finally {
  await browser.close();
  await save();
}
if (report.errors.length || report.results.some((r) => r.errors.length)) process.exitCode = 1;
