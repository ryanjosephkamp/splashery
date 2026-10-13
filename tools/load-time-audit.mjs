// Task 51: cold opening measurements, using task 06's settings and cutoff.
// Run against a frozen main server, then the candidate, one rendering page at a time.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { TOYS, holdsStill } from "../src/toys.js";
import { createScene } from "../src/state.js";
import { openingNetwork } from "./load-time-metrics.mjs";
import { createAuditStore } from "./load-time-store.mjs";

const option = (key, fallback) =>
  process.argv.find((s) => s.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const phase = option("phase", "before");
const base = option("base", "http://127.0.0.1:4174");
const out = path.resolve(option("out", "docs/audits/load-time-2026-10"));
const only = option("only", "").split(",").filter(Boolean);
const device = option("device", "");
const samples = Number(option("samples", "1"));
const navigationTimeout = Number(option("navigation-timeout", "60000"));
const readinessTimeout = Number(option("readiness-timeout", "120000"));
const cellTimeout = Number(option("cell-timeout", "600000"));
if (![navigationTimeout, readinessTimeout, cellTimeout].every((n) => Number.isFinite(n) && n > 0))
  throw new Error("Collection timeouts must be positive milliseconds.");
const definitions = [
  {
    name: "phone",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    profile: "weak",
  },
  {
    name: "desktop",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    profile: "high",
  },
];
const llvmpipe = process.env.SPLASHERY_GL === "llvmpipe";
const args = [
  ...(llvmpipe
    ? ["--use-gl=angle", "--use-angle=gl", "--hide-scrollbars"]
    : ["--use-angle=swiftshader"]),
  "--enable-unsafe-swiftshader",
  "--enable-webgl",
  "--ignore-gpu-blocklist",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
];
fs.mkdirSync(out, { recursive: true });
const filename = path.join(out, `${phase}.json`);
const store = createAuditStore(filename);
const rows = store.rows;
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  headless: !llvmpipe,
  args,
});
fs.writeFileSync(
  path.join(out, `${phase}-method.json`),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      browser: browser.version(),
      args,
      base,
      definitions,
      frozenMain: execFileSync("git", ["rev-parse", option("frozen-main", "origin/main")], {
        encoding: "utf8",
      }).trim(),
      candidateSource: execFileSync("git", ["rev-parse", option("candidate-source", "HEAD")], {
        encoding: "utf8",
      }).trim(),
      host: {
        platform: os.platform(),
        architecture: os.arch(),
        availableCPUs: os.availableParallelism(),
        mesaThreads: process.env.LP_NUM_THREADS || null,
        processPriority: os.getPriority(),
        display: process.env.DISPLAY || null,
      },
      sound: "off",
      seed: 424242,
      renderer: "webgl2",
      adaptation: "off",
      cache: "fresh context per toy; CDP cache disabled; service workers blocked",
      firstFrame: "navigation to first postrender after requested toy is ready",
      timeouts: {
        navigationMs: navigationTimeout,
        readinessMs: readinessTimeout,
        cellMs: cellTimeout,
      },
      payload:
        "completed HTTP body bytes after 1500 ms settling; Content-Length with Resource Timing fallback, including worker imports; headers excluded",
      deviationFromTask06: `Linux ${llvmpipe ? "llvmpipe" : "SwiftShader"} instead of Mac Metal; opening metrics only, without the idle/tap frame-cadence windows`,
    },
    null,
    2,
  ) + "\n",
);
try {
  for (const def of definitions.filter((d) => !device || device === d.name)) {
    for (const toy of TOYS.filter((t) => !only.length || only.includes(t.id))) {
      for (let sample = 0; sample < samples; sample++) {
        if (
          rows.some(
            (r) =>
              r.id === toy.id &&
              r.device === def.name &&
              r.sample === sample &&
              r.status === "ok" &&
              r.collectorVersion === 2,
          )
        )
          continue;
        const watchdog = setTimeout(() => {
          console.error(
            `Collector stalled at ${phase}:${def.name}:${toy.id}:${sample}; saved rows can resume.`,
          );
          store.finish();
          const processes = execFileSync("ps", ["-eo", "pid=,ppid="], { encoding: "utf8" })
            .trim()
            .split("\n")
            .map((line) => line.trim().split(/\s+/).map(Number));
          const owned = new Set([process.pid]);
          for (;;) {
            const children = processes
              .filter(([, parent]) => owned.has(parent))
              .map(([pid]) => pid);
            if (children.every((pid) => owned.has(pid))) break;
            for (const pid of children) owned.add(pid);
          }
          for (const pid of [...owned].reverse()) {
            if (pid === process.pid) continue;
            try {
              process.kill(pid, "SIGKILL");
            } catch (error) {
              if (error.code !== "ESRCH") throw error;
            }
          }
          process.exit(2);
        }, cellTimeout);
        watchdog.unref();
        const context = await browser.newContext({
          ...def,
          reducedMotion: "no-preference",
          colorScheme: "light",
          serviceWorkers: "block",
        });
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Performance.enable");
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
        const requests = new Map();
        cdp.on("Network.requestWillBeSent", (e) => {
          if (/^https?:/.test(e.request.url))
            requests.set(e.requestId, {
              url: e.request.url,
              type: e.type,
              startTimestamp: e.timestamp,
            });
        });
        cdp.on("Network.responseReceived", (e) => {
          const r = requests.get(e.requestId);
          if (r) Object.assign(r, { status: e.response.status, headers: e.response.headers });
        });
        cdp.on("Network.loadingFinished", (e) => {
          const r = requests.get(e.requestId);
          if (r)
            Object.assign(r, { finishTimestamp: e.timestamp, encodedBytes: e.encodedDataLength });
        });
        cdp.on("Network.loadingFailed", (e) => {
          const r = requests.get(e.requestId);
          if (r) r.error = e.errorText;
        });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (e) => {
          if (e.type() === "error") errors.push(e.text());
        });
        await page.addInitScript(
          ({ id }) => {
            performance.setResourceTimingBufferSize(4000);
            window.__loadTime = { firstFrame: null };
            const attach = () => {
              const p = window.__splashery?.player;
              if (!p?.stage) return requestAnimationFrame(attach);
              p.stage.app.on("postrender", () => {
                if (
                  document.body.dataset.ready === "true" &&
                  p.toyInfo?.id === id &&
                  window.__loadTime.firstFrame === null
                )
                  window.__loadTime.firstFrame = performance.now();
              });
            };
            requestAnimationFrame(attach);
          },
          { id: toy.id },
        );
        const scene = createScene({ seed: 424242, toy: { kind: "builtin", id: toy.id } });
        if (toy.camera) scene.camera = { ...scene.camera, ...toy.camera };
        if (holdsStill(toy)) scene.autoplay.turntable = false;
        const hash = Buffer.from(JSON.stringify(scene)).toString("base64url");
        const row = {
          id: toy.id,
          label: toy.label,
          labs: !!toy.labs,
          pack: toy.pack || null,
          device: def.name,
          sample,
          status: "ok",
          collectorVersion: 2,
        };
        try {
          await page.goto(
            `${base}/?renderer=webgl2&profile=${def.profile}&adapt=off&labs=${toy.labs ? 1 : 0}#s=j.${hash}`,
            { waitUntil: "domcontentloaded", timeout: navigationTimeout },
          );
          await page.waitForFunction(() => window.__loadTime.firstFrame !== null, null, {
            timeout: readinessTimeout,
          });
          await page.waitForTimeout(1500);
          Object.assign(
            row,
            await page.evaluate(() => {
              const p = window.__splashery.player;
              const gl = p.stage.device.gl;
              const ext = gl?.getExtension("WEBGL_debug_renderer_info");
              return {
                firstFrameMs: window.__loadTime.firstFrame,
                cutoffMs: performance.now(),
                timeOrigin: performance.timeOrigin,
                profile: p.profile,
                splats: p.toyInfo.splats + (p.pictures?.splats() || 0),
                gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
                canvas: { width: p.canvas.width, height: p.canvas.height },
                resources: performance
                  .getEntriesByType("resource")
                  .filter((r) => /^https?:/.test(r.name))
                  .map((r) => ({
                    url: r.name,
                    start: r.startTime,
                    end: r.startTime + r.duration,
                    body: r.encodedBodySize,
                    transfer: r.transferSize,
                  })),
              };
            }),
          );
          const metrics = await cdp.send("Performance.getMetrics");
          row.navigationStart = metrics.metrics.find((m) => m.name === "NavigationStart")?.value;
          if (!Number.isFinite(row.navigationStart))
            throw new Error("CDP navigation clock is unavailable");
          row.workerResources = [];
          for (const worker of page.workers()) {
            try {
              row.workerResources.push({
                url: worker.url(),
                ...(await worker.evaluate(() => ({
                  origin: performance.timeOrigin,
                  resources: performance
                    .getEntriesByType("resource")
                    .filter((r) => /^https?:/.test(r.name))
                    .map((r) => ({
                      url: r.name,
                      start: r.startTime,
                      end: r.startTime + r.duration,
                      body: r.encodedBodySize,
                      transfer: r.transferSize,
                    })),
                }))),
              });
            } catch (e) {
              errors.push(`worker timing: ${e.message}`);
            }
          }
          const network = openingNetwork(
            [...requests.values()],
            row.resources,
            row.workerResources,
            {
              navigationStart: row.navigationStart,
              timeOrigin: row.timeOrigin,
              cutoffMs: row.cutoffMs,
            },
          );
          row.bytes = network.reduce((s, r) => s + r.body, 0);
          row.requestCount = network.filter(
            (r) => r.startMs == null || r.startMs <= row.cutoffMs,
          ).length;
          row.network = network;
          delete row.resources;
          delete row.workerResources;
        } catch (e) {
          row.status = "error";
          row.error = e.message;
        }
        row.errors = errors;
        if (row.status === "error")
          fs.appendFileSync(
            path.join(out, `${phase}-errors.jsonl`),
            JSON.stringify({ at: new Date().toISOString(), row }) + "\n",
          );
        store.put(row);
        await context.close();
        clearTimeout(watchdog);
        console.log(
          `${phase} ${def.name} ${rows.length} ${toy.id}: ${row.status} ${row.bytes ?? "?"} B ${Math.round(row.firstFrameMs || 0)} ms`,
        );
      }
    }
  }
} finally {
  store.finish();
  await browser.close();
}
