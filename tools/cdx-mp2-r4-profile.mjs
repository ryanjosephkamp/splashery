// Real Chromium cadence and inclusive CPU submission costs. Run versions serially.
// --baseline=<git ref> pins the four clip modules; --instrument adds CPU probes.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { R4_CASES } from "./cdx-mp2-r4-cases.mjs";
import {
  PHONE,
  DESKTOP,
  option,
  snapshot,
  routeCode,
  selectCase,
  caseInputHashes,
} from "./cdx-mp2-r4-harness.mjs";
import { GRAPHICS_LAUNCH } from "./cdx-mp2-render.mjs";

const baseline = option("baseline"),
  instrument = process.argv.includes("--instrument");
const output = option("out", "work/r4-profile.json"),
  url = option("url", "http://127.0.0.1:4173");
const phone = option("profile", "phone") === "phone";
const { code, sourceHash } = await snapshot(baseline);
// A disclosed baseline-only repair prevents an MP3 being treated as a video.
// Geometry, shaders, depth, and rendering frequency remain main's own.
if (baseline) {
  const file = "src/packs/photo-sharp.js";
  code.set(
    file,
    Buffer.from(
      code
        .get(file)
        .toString()
        .replace(
          "else if (clip.audio?.url && typeof document",
          "else if (clip.audio?.url && !/\\.mp3(?:$|[?#])/i.test(clip.audio.url) && typeof document",
        ),
    ),
  );
}
const report = {
  kind: option("kind", "isolated-measurement"),
  baseline: baseline || "working tree",
  instrument,
  phone,
  sourceHash,
  measuredAt: new Date().toISOString(),
  backend: process.env.SPLASHERY_GL || "swiftshader",
  workerThrottled: false,
  warmupMs: 2000,
  protocol: "R3 frameend cadence plus separate postrender and changed-picture observations",
  pictureClockNote:
    "Counts changes of the bound-source clock at postrender: native bitmap timestamps, media-element currentTime, or retained frame indices. This is not a pixel-uniqueness or decoder frame-rate measurement",
  depthPreparation:
    "Local-file inference and refinement finish before the unchanged two-second warmup; shelf samples are already complete",
  note: "Protocol requires one browser at a time and no competing jobs; CDP page slowdown and software rendering do not measure physical Android",
  baselineSourceCorrection: baseline
    ? "MP3 picture uses the pinned version's retained selected frames; long films absent from its shelf use its actual upload path"
    : null,
  cases: [],
};
const browser = await chromium.launch(GRAPHICS_LAUNCH);
async function finishTrace(cdp, file) {
  const complete = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
  await cdp.send("Tracing.end");
  const { stream } = await complete;
  let contents = "";
  for (;;) {
    const chunk = await cdp.send("IO.read", { handle: stream });
    contents += chunk.base64Encoded ? Buffer.from(chunk.data, "base64").toString() : chunk.data;
    if (chunk.eof) break;
  }
  await cdp.send("IO.close", { handle: stream });
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, contents);
  const media = JSON.parse(contents).traceEvents.filter((event) => /media/.test(event.cat || "")),
    counts = {},
    durations = {};
  for (const event of media) {
    counts[event.name] = (counts[event.name] || 0) + 1;
    if (event.ph === "X" && Number.isFinite(event.dur)) {
      const row = (durations[event.name] ||= { count: 0, totalMs: 0, worstMs: 0 });
      row.count++;
      row.totalMs += event.dur / 1000;
      row.worstMs = Math.max(row.worstMs, event.dur / 1000);
    }
  }
  return {
    file,
    includesWarmupMs: 2000,
    note: "Native trace event durations are wall durations and can overlap; they are not additive decoder CPU costs",
    counts,
    durations,
  };
}
try {
  report.browser = browser.version();
  const context = await browser.newContext(phone ? PHONE : DESKTOP);
  const page = await context.newPage();
  page.setDefaultTimeout(600_000);
  report.errors = [];
  page.on("pageerror", (e) => report.errors.push(e.message));
  for (const [file, bytes] of code) {
    if (!instrument || !file.endsWith(".js")) continue;
    let body = bytes.toString();
    if (instrument) {
      const names = file.endsWith("photo-sharp.js")
        ? [
            "fillClip",
            "clipCellDepth",
            "clipPatches",
            "clipCutCells",
            "clipPicture",
            "clipVisibleFaces",
            "clipCapUpload",
            "clipInstanceData",
            "clipSoftUpload",
          ]
        : file.endsWith("moving-photo.js")
          ? ["longFrame", "frameImage", "shownDepth"]
          : [];
      for (const name of names) {
        if (!body.includes(`function ${name}(`)) continue;
        const exported = body.includes(`export function ${name}(`);
        body = body.replace(`function ${name}(`, `function r4_original_${name}(`);
        body += `\nfunction ${name}(...args) { const p = window.__r4Probe; if (!p?.on) return r4_original_${name}(...args); const t = performance.now(); try { return r4_original_${name}(...args); } finally { (p.costs.${name} ||= []).push(performance.now() - t); } }\n`;
        if (exported) body += `export { ${name} };\n`;
      }
    }
    code.set(file, Buffer.from(body));
  }
  await routeCode(context, code);
  const cdp = await context.newCDPSession(page);
  const cpuRate = Number(option("cpu", phone ? "4" : "1"));
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
  report.cpuRate = cpuRate;
  await page.goto(`${url}/?renderer=webgl2&adapt=off&profile=${phone ? "low" : "mid"}&labs=1`);
  await page.waitForSelector("body[data-ready='true']");
  await page.evaluate(
    async ({ instrument }) => {
      window.__r4Moving = await import("/src/packs/moving-photo.js");
      const { ReliefMesh: ObservedRelief } = await import("/src/live/relief-mesh.js");
      const observedColor = ObservedRelief.prototype.setColor;
      ObservedRelief.prototype.setColor = function (...args) {
        window.__r4Mesh = this;
        this.r4PictureClock = args[0]?.currentTime ?? window.__r4Moving.MOVING.frame;
        return observedColor.apply(this, args);
      };
      if (instrument) {
        const wrap = (proto, name, label = name) => {
          const original = proto[name];
          if (!original) return;
          proto[name] = function (...args) {
            const p = window.__r4Probe;
            if (!p?.on) return original.apply(this, args);
            const t = performance.now();
            try {
              const result = original.apply(this, args);
              return result;
            } finally {
              (p.costs[label] ||= []).push(performance.now() - t);
            }
          };
        };
        const { ReliefMesh } = await import("/src/live/relief-mesh.js");
        const { Layer } = await import("/src/pc.js");
        const NativeVideoFrame = window.VideoFrame;
        if (NativeVideoFrame)
          window.VideoFrame = new Proxy(NativeVideoFrame, {
            construct(target, args, newTarget) {
              const start = performance.now();
              try {
                return Reflect.construct(target, args, newTarget);
              } finally {
                const p = window.__r4Probe;
                if (p?.on) (p.costs.freezeVideoFrame ||= []).push(performance.now() - start);
              }
            },
          });
        wrap(Worker.prototype, "postMessage", "workerPost");
        const frameCallback = HTMLVideoElement.prototype.requestVideoFrameCallback;
        if (frameCallback)
          HTMLVideoElement.prototype.requestVideoFrameCallback = function (callback) {
            return frameCallback.call(this, function (...args) {
              const start = performance.now();
              try {
                return callback.apply(this, args);
              } finally {
                const p = window.__r4Probe;
                if (p?.on) (p.costs.videoFrameCallback ||= []).push(performance.now() - start);
              }
            });
          };
        wrap(Layer.prototype, "sortVisible", "sortVisible");
        for (const name of ["setColor", "setDepth"]) wrap(ReliefMesh.prototype, name);
        for (const name of [
          "texImage2D",
          "texSubImage2D",
          "generateMipmap",
          "bufferData",
          "bufferSubData",
          "drawElements",
          "drawElementsInstanced",
        ])
          wrap(WebGL2RenderingContext.prototype, name);
        wrap(CanvasRenderingContext2D.prototype, "drawImage", "canvasDraw");
        wrap(CanvasRenderingContext2D.prototype, "getImageData", "canvasRead");
        const player = window.__splashery.player;
        wrap(player, "update", "playerUpdate");
        wrap(player, "photoFrame", "photoFrame");
        wrap(player.stage, "setScreenCanvas", "screenUpload");
      }
      await window.__splashery.app.chooseToy("moving-photo-3d");
      window.__splashery.app.setControl("play", 0);
    },
    { instrument },
  );
  await page.mouse.click(5, 180);
  for (const item of R4_CASES) {
    const id = item.id;
    if (option("ids") && !option("ids").split(",").includes(id)) continue;
    const selectedPath = await selectCase(page, item, baseline);
    await page.waitForFunction(() => {
      const clip = window.__r4Moving.MOVING.clip;
      return (!clip.job || clip.job.done) && (!clip.refinement || clip.refinement.done);
    });
    await page.evaluate(() => {
      const clip = window.__r4Moving.MOVING.clip;
      if (clip.job?.error || clip.refinement?.error)
        throw Error(clip.job?.error || clip.refinement?.error);
      if (clip.job && (clip.depth.done ?? clip.depth.ready) < clip.depth.n)
        throw Error("The benchmark depth did not finish");
    });
    const seconds = Number(option("seconds", item.long ? "30" : "12"));
    if (process.argv.includes("--trace"))
      await cdp.send("Tracing.start", {
        categories: "media,devtools.timeline,disabled-by-default-media",
        options: "record-as-much-as-possible",
        transferMode: "ReturnAsStream",
      });
    if (process.argv.includes("--cpu-profile")) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
      await cdp.send("Profiler.start");
    }
    const r = await page.evaluate(
      async ({ id, seconds, instrument }) => {
        const { app, player } = window.__splashery;
        const moving = window.__r4Moving.MOVING;
        app.setControl("play", 1);
        await new Promise((r) => setTimeout(r, 2000));
        const depthState = () => ({
          pending: !!(
            (moving.clip.job && !moving.clip.job.done) ||
            (moving.clip.refinement && !moving.clip.refinement.done)
          ),
          completed: moving.clip.depth?.done ?? moving.clip.refinement?.measured ?? null,
          total: moving.clip.depth?.n ?? moving.clip.n,
          rate: moving.clip.depth?.rate ?? null,
        });
        const depthAtStart = depthState();
        const nativeVideo =
            moving.clip.video ||
            (window.__r4Mesh?.colorSrc instanceof HTMLVideoElement
              ? window.__r4Mesh.colorSrc
              : null),
          qualityAtStart = nativeVideo?.getVideoPlaybackQuality?.();
        const probe = (window.__r4Probe = { on: true, costs: {}, rows: [], draws: [] });
        const gl = instrument ? player.stage.device.gl : null,
          timer = gl?.getExtension("EXT_disjoint_timer_query_webgl2"),
          gpuTimes = [],
          pendingQueries = [];
        let activeQuery = null,
          disjointQueries = 0,
          externalQueries = 0;
        const beginGpu = () => {
          if (!timer || activeQuery) return;
          if (gl.getQuery(timer.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) {
            externalQueries++;
            return;
          }
          activeQuery = gl.createQuery();
          if (activeQuery) gl.beginQuery(timer.TIME_ELAPSED_EXT, activeQuery);
        };
        const collectGpu = (final = false) => {
          const disjoint = timer && gl.getParameter(timer.GPU_DISJOINT_EXT);
          while (pendingQueries.length) {
            const query = pendingQueries[0],
              ready = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
            if (!ready && !final && !disjoint) break;
            pendingQueries.shift();
            if (disjoint) disjointQueries++;
            else if (ready) gpuTimes.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
            gl.deleteQuery(query);
          }
        };
        const draw = () => {
          if (activeQuery) {
            gl.endQuery(timer.TIME_ELAPSED_EXT);
            pendingQueries.push(activeQuery);
            activeQuery = null;
          }
          collectGpu();
          probe.draws.push({
            at: performance.now(),
            pictureTime: window.__r4Mesh?.r4PictureClock ?? moving.frame,
            revision: window.__r4Mesh?.clipRevision,
          });
        };
        const frame = () =>
          probe.rows.push({
            at: performance.now(),
            time: moving.t,
            frame: moving.frame,
            sharp: window.__psv.state().on,
            sample: moving.clip.sample,
            clipName: moving.clip.name,
            rasterKey: probe.rows.length < 20 ? window.__r4Mesh?.clipRasterViewKey : undefined,
            update: player.stage.app.stats.frame.updateTime,
            render: player.stage.app.stats.frame.renderTime,
          });
        player.stage.app.on("frameend", frame);
        player.stage.app.on("prerender", beginGpu);
        player.stage.app.on("postrender", draw);
        try {
          await new Promise((r) => setTimeout(r, seconds * 1000));
        } finally {
          player.stage.app.off("frameend", frame);
          player.stage.app.off("prerender", beginGpu);
          player.stage.app.off("postrender", draw);
          if (activeQuery) {
            gl.endQuery(timer.TIME_ELAPSED_EXT);
            pendingQueries.push(activeQuery);
            activeQuery = null;
          }
          collectGpu(true);
          probe.on = false;
          app.setControl("play", 0);
        }
        const stats = (values) => {
          const sorted = [...values].sort((a, b) => a - b);
          return {
            n: values.length,
            total: values.reduce((a, b) => a + b, 0),
            median:
              sorted.length % 2
                ? sorted[(sorted.length - 1) / 2]
                : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2,
            worst: sorted.at(-1),
          };
        };
        const pictures = probe.draws.filter(
          (r, i, a) => !i || r.pictureTime !== a[i - 1].pictureTime,
        );
        let sourceAdvance = 0;
        for (let i = 1; i < probe.rows.length; i++) {
          const delta = probe.rows[i].time - probe.rows[i - 1].time;
          sourceAdvance +=
            delta < -moving.clip.duration / 2 ? delta + moving.clip.duration : Math.max(0, delta);
        }
        const streamStats = window.__r4Mesh?.clipStream?.stats,
          workerMs = streamStats?.workerMs || [],
          phases = streamStats?.phases || [];
        return {
          id,
          depthAtStart,
          depthAtEnd: depthState(),
          nativeMediaCounters: nativeVideo
            ? {
                start: qualityAtStart
                  ? {
                      totalVideoFrames: qualityAtStart.totalVideoFrames,
                      droppedVideoFrames: qualityAtStart.droppedVideoFrames,
                    }
                  : null,
                end: (() => {
                  const q = nativeVideo.getVideoPlaybackQuality?.();
                  return q
                    ? {
                        totalVideoFrames: q.totalVideoFrames,
                        droppedVideoFrames: q.droppedVideoFrames,
                      }
                    : null;
                })(),
                note: "Browser media counters, separate from Sharp picture submissions",
              }
            : null,
          windowMs: seconds * 1000,
          sourceAdvance,
          distinctFrames: new Set(probe.rows.map((row) => row.frame)).size,
          sharpFrames: probe.rows.filter((row) => row.sharp).length,
          title: document.title,
          url: location.href,
          dimensions: [moving.clip.w, moving.clip.h],
          duration: moving.clip.duration,
          renderSize: [player.stage.device.width, player.stage.device.height],
          pictureCadence: stats(pictures.slice(1).map((r, i) => r.at - pictures[i].at)),
          pictureSubmissions: pictures.length,
          pictureSubmissionFps: pictures.length / seconds,
          cadence: stats(probe.rows.slice(1).map((r, i) => r.at - probe.rows[i].at)),
          renderedCadence: stats(probe.draws.slice(1).map((r, i) => r.at - probe.draws[i].at)),
          draws: probe.draws,
          costs: Object.fromEntries(Object.entries(probe.costs).map(([k, v]) => [k, stats(v)])),
          gpuDraw: {
            supported: !!timer,
            elapsedMs: stats(gpuTimes),
            disjointQueries,
            externalQueries,
            note: "Nonblocking GPU timer queries span prerender through postrender. They measure GPU elapsed time, separately from inclusive JavaScript submission costs; unavailable tail queries are omitted",
          },
          stream: window.__r4Mesh?.clipStream
            ? {
                ...window.__r4Mesh.clipStream.stats,
                workerMs: undefined,
                phases: undefined,
                meanWorkerMs: workerMs.length
                  ? workerMs.reduce((a, b) => a + b, 0) / workerMs.length
                  : null,
                recentWorkerFrames: workerMs.length,
                workerSampleScope:
                  "Most recent 120 completed frames, bounded by production; may include warmup when fewer than 120 frames completed",
                meanPhases: Object.fromEntries(
                  Object.keys(phases[0] || {}).map((k) => [
                    k,
                    phases.reduce((n, p) => n + p[k], 0) / phases.length,
                  ]),
                ),
              }
            : undefined,
          geometryCache: window.__r4Mesh?.clipCache?.stats,
          raster: window.__r4Mesh?.clipRasterStats,
          sourceKind: window.__r4Mesh?.colorSrc?.constructor.name,
          faces: window.__r4Mesh?.miB.instancingCount,
          rows: probe.rows,
        };
      },
      { id, seconds, instrument },
    );
    if (process.argv.includes("--trace"))
      r.nativeMediaTrace = await finishTrace(cdp, `${output}.${id}.trace.json`);
    if (process.argv.includes("--cpu-profile")) {
      const { profile } = await cdp.send("Profiler.stop");
      await fs.mkdir(path.dirname(output), { recursive: true });
      await fs.writeFile(`${output}.${id}.cpuprofile`, JSON.stringify(profile));
    }
    const expectedName = item.source
      ?.split("/")
      .at(-1)
      .replace(/\.[^.]+$/, "");
    if (
      r.rows.length < 3 ||
      r.sharpFrames !== r.rows.length ||
      r.distinctFrames < 2 ||
      r.sourceAdvance < r.windowMs / 4000 ||
      r.pictureCadence.n < 2 ||
      r.rows.some((row) =>
        selectedPath === "sample" ? row.sample !== id : row.clipName !== expectedName,
      )
    )
      throw new Error(`Invalid playback window: ${JSON.stringify(r)}`);
    r.path = selectedPath;
    r.inputHashes = await caseInputHashes(item, selectedPath, code);
    report.cases.push(r);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
    const { rows, draws, ...summary } = r;
    console.log(JSON.stringify(summary));
  }
} catch (error) {
  report.fatal = error.message;
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
  throw error;
} finally {
  await browser.close();
}
