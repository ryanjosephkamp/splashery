// Isolated UI presentation timings. Run separately from rendering/inference
// sweeps. --cpu=4 uses CDP page CPU throttling, not a physical phone benchmark.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { GRAPHICS_LAUNCH } from "./cdx-mp2-render.mjs";
import { reconstructedSources } from "./cdx-mp2-measure.mjs";
import { LONG_SAMPLES } from "../src/packs/moving-photo.js";

const option = (key, fallback) =>
  process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
const sources = option("sources", "")
  ? JSON.parse(await fs.readFile(option("sources"), "utf8"))
  : await reconstructedSources(".cache/cdx-mp2/sources");
for (const s of LONG_SAMPLES) sources[s.id] = `assets/toys/moving-photo-3d/${s.file}.webm`;
sources.fast60 = "assets/toys/moving-photo-3d/cdx-mp2-fast-60.webm";
const profile = option("profile", "desktop");
const phone = profile === "phone";
const cpuRate = Number(option("cpu", 1));
const code = await Promise.all(
  [
    "src/packs/moving-photo.js",
    "src/packs/photo-sharp.js",
    "src/packs/song-stream.js",
    "src/live/clip-stabilize.js",
  ].map((file) => fs.readFile(file, "utf8")),
);
const snapshotHash = createHash("sha256").update(code.join("\n")).digest("hex");
const browser = await chromium.launch(GRAPHICS_LAUNCH);
const results = [];
try {
  for (const [id, source] of Object.entries(sources)) {
    if (option("ids", "") && !option("ids").split(",").includes(id)) continue;
    for (const upload of id === "fast60" ? [true] : [false, true]) {
      if (
        option("paths", "") &&
        !option("paths")
          .split(",")
          .includes(upload ? "upload" : "sample")
      )
        continue;
      const page = await browser.newPage({
        viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        deviceScaleFactor: phone ? 3 : 1,
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      if (option("trace-preparation", "") === "true") {
        let code = await fs.readFile("src/packs/moving-photo.js", "utf8");
        const mark = (label) =>
          `window.__startupEvents?.push({type: ${JSON.stringify(label)}, at: performance.now()});`;
        code = code
          .replace(
            "const raw = unpackDepths(dep, unpackDepth);",
            `${mark("sheets-decoded")} const raw = unpackDepths(dep, unpackDepth); ${mark("depth-unpacked")}`,
          )
          .replace(
            "const first = sheetFrames(sheets, w, { ...s, frames: 1 });",
            `const first = sheetFrames(sheets, w, { ...s, frames: 1 }); ${mark("first-picture-extracted")}`,
          )
          .replace("preview.sample = s.id;", `${mark("preview-prepared")} preview.sample = s.id;`);
        await page.route("**/src/packs/moving-photo.js", (route) =>
          route.fulfill({ contentType: "text/javascript", body: code }),
        );
      }
      try {
        await page.goto(
          `${process.env.SPLASHERY_URL || "http://127.0.0.1:4388/"}?renderer=webgl2&adapt=off&profile=${phone ? "low" : "mid"}&labs=1`,
        );
        await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
        await page.evaluate(async () => {
          window.__startupM = await import("/src/packs/moving-photo.js");
          window.__startupEvents = [];
          const NativeWorker = window.Worker;
          window.Worker = class extends NativeWorker {
            constructor(...args) {
              super(...args);
              window.__startupEvents.push({ at: performance.now(), type: "worker" });
              this.addEventListener("message", ({ data }) => {
                if (["depth", "ready", "status"].includes(data.type))
                  window.__startupEvents.push({
                    at: performance.now(),
                    type: data.type,
                    text: data.text,
                    inferenceMs: data.ms,
                  });
              });
            }
            postMessage(...args) {
              window.__startupEvents.push({ at: performance.now(), type: `send-${args[0].type}` });
              return super.postMessage(...args);
            }
          };
        });
        if (option("trace-graphics", "") === "true")
          await page.evaluate(() => {
            const gl = window.__splashery.player.stage.device.gl;
            for (const name of [
              "compileShader",
              "linkProgram",
              "getShaderParameter",
              "getProgramParameter",
              "texImage2D",
              "generateMipmap",
              "bufferData",
            ]) {
              const call = gl[name].bind(gl);
              gl[name] = (...args) => {
                const at = performance.now();
                const value = call(...args);
                const duration = performance.now() - at;
                if (duration > 2) window.__startupEvents.push({ type: name, at, duration });
                return value;
              };
            }
          });
        if (!(id === "sample" && !upload)) {
          await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
          await page.waitForFunction(
            () => window.__psv?.state().on && !window.__splashery.player.loading,
          );
        }
        if (cpuRate > 1) {
          const session = await page.context().newCDPSession(page);
          await session.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
        }
        await page.evaluate(() => (window.__selectedAt = performance.now()));
        if (upload) {
          await page.setInputFiles("#toy-input-file", source);
          await page.waitForFunction(
            () => window.__startupM.MOVING.custom?.firstPresentedAt > window.__selectedAt,
            null,
            { timeout: 600_000 },
          );
        } else if (id === "sample") {
          await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
        } else {
          await page.evaluate((clip) => window.__splashery.app.setToyOptions({ clip }), id);
        }
        const r = await page.evaluate(
          async ({ id, upload }) => {
            const c = upload ? window.__startupM.MOVING.custom : window.__startupM.MOVING.clip;
            if (!c || (!upload && c.sample !== id))
              throw new Error("The requested clip did not open");
            const firstMs =
              c.firstPresentedAt > window.__selectedAt
                ? c.firstPresentedAt - window.__selectedAt
                : null;
            await window.__splashery.player.stage.captureFrame();
            const fallbackMs = performance.now() - window.__selectedAt;
            c.job?.cancel();
            c.refinement?.cancel();
            c.video?.pause();
            c.audio?.track.close();
            return {
              id,
              upload,
              firstResultMs: firstMs ?? fallbackMs,
              timestampedPreview: firstMs !== null,
              completedAtMs: fallbackMs,
              depthAnswersAtCompletion: c.refinement?.measured ?? c.depth?.done ?? c.n,
              preparation: window.__startupEvents
                .filter((e) => e.at >= window.__selectedAt)
                .map(({ at, ...event }) => ({ ...event, ms: at - window.__selectedAt })),
              resources: performance
                .getEntriesByType("resource")
                .filter(
                  (e) =>
                    e.startTime >= window.__selectedAt && /moving-photo|relief-mesh/.test(e.name),
                )
                .map((e) => ({
                  name: new URL(e.name).pathname,
                  startMs: e.startTime - window.__selectedAt,
                  durationMs: e.duration,
                })),
            };
          },
          { id, upload },
        );
        results.push({ profile, cpuRate, ...r, under2s: r.firstResultMs <= 2000, errors });
        console.log(JSON.stringify(results.at(-1)));
      } catch (e) {
        results.push({ profile, id, upload, cpuRate, error: e.message, errors });
        console.log(JSON.stringify(results.at(-1)));
      } finally {
        await page.close();
      }
      await fs.writeFile(
        option("out", ".cache/cdx-mp3/startup.json"),
        JSON.stringify(
          {
            environment:
              "Chromium, software graphics; local HTTP; UI selection to completed Sharp preview frame; cold worker per upload",
            snapshotHash,
            graphicsThreads: process.env.LP_NUM_THREADS || "driver default",
            results,
          },
          null,
          2,
        ) + "\n",
      );
    }
  }
} finally {
  await browser.close();
}
