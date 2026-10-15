#!/usr/bin/env node
// Phone-profile conversion memory. PSS is summed across the real Chromium process
// tree; this includes llvmpipe's process memory, not physical-phone GPU memory.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";
import config from "../playwright.config.mjs";

const option = (name, fallback) =>
  process.argv
    .find((v) => v.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=") ?? fallback;
const url = option("url", "http://127.0.0.1:4250/"),
  root = path.resolve(option("root", "."));
const output = path.resolve(option("out", ".cache/photo-3d-r4/operator-review/memory-branch.json"));
const runs = Number(option("runs", "3"));
const files = option("files", "assets/toys/photo-3d/forest.jpg")
  .split(",")
  .map((p) => path.resolve(p));
for (const file of files) if (!fs.existsSync(file)) throw new Error(`Missing upload: ${file}`);
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const probe = `
globalThis.__r4MemoryProbe = () => {
  const prepared = typeof colors === "undefined" ? null : colors?.prepared;
  const weights = prepared?.depthWeights;
  const buffers = new Set(), seen = new Set();
  const visit = value => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (ArrayBuffer.isView(value)) buffers.add(value.buffer);
    else for (const [key, item] of Object.entries(value)) if (key !== "depthWeights") visit(item);
  };
  visit(prepared);
  return { weightBytes: weights ? weights.weights.byteLength + weights.indices.byteLength + weights.totals.byteLength : 0,
    retainedSourceBufferBytes: [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0) };
};
`;
function memory(pid) {
  const parents = new Map();
  for (const entry of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = fs.readFileSync(`/proc/${entry}/stat`, "utf8"),
        fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      parents.set(Number(entry), Number(fields[1]));
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ESRCH") throw error;
    }
  }
  const selected = new Set([pid]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const [child, parent] of parents)
      if (selected.has(parent) && !selected.has(child)) {
        selected.add(child);
        changed = true;
      }
  }
  let pssKiB = 0,
    rssKiB = 0,
    processes = 0;
  const unavailable = [];
  for (const child of selected) {
    try {
      const rollup = fs.readFileSync(`/proc/${child}/smaps_rollup`, "utf8");
      pssKiB += Number(rollup.match(/^Pss:\s+(\d+)/m)?.[1] || 0);
      rssKiB += Number(rollup.match(/^Rss:\s+(\d+)/m)?.[1] || 0);
      processes++;
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ESRCH")
        unavailable.push({ pid: child, code: error.code });
    }
  }
  return { pssKiB, rssKiB, processes, unavailable };
}

const study = {
  createdUTC: new Date().toISOString(),
  url,
  root,
  runs,
  method: {
    samplingMs: 200,
    units: "KiB",
    pss: "Sum of Chromium process-tree proportional resident sets, sampled from /proc/*/smaps_rollup.",
    peakWindow:
      "File-input change through the first completed new Sharp frame and five further completed frames.",
    profile: { width: 390, height: 844, deviceScaleFactor: 3, nativeBuffer: [585, 1266] },
    caveats:
      "Sampled peaks can miss shorter transients. RSS sums count shared pages repeatedly. This is Chromium/llvmpipe, not a physical phone. The read-only worker probe is appended only in this measurement, not production.",
  },
  methodSha256: digest(fs.readFileSync(new URL(import.meta.url))),
  probeSha256: digest(probe),
  source: Object.fromEntries(
    [
      "src/stage.js",
      "src/photo3d/build-worker.js",
      "src/photo3d/prepare.js",
      "src/packs/photo-3d-core.js",
    ].map((file) => [file, digest(fs.readFileSync(path.join(root, file)))]),
  ),
  uploads: files.map((file) => ({ file, sha256: digest(fs.readFileSync(file)) })),
  rows: [],
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output + ".method.mjs", fs.readFileSync(new URL(import.meta.url)));
const save = () => fs.writeFileSync(output, JSON.stringify(study, null, 2));
for (let run = 0; run < runs; run++) {
  const server = await chromium.launchServer(config.use.launchOptions);
  const browser = await chromium.connect(server.wsEndpoint());
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  const page = await context.newPage(),
    cacheStates = [],
    workers = new Set();
  let samples = null,
    start = 0,
    checking = false;
  const sample = () => {
    if (samples) samples.push({ ms: performance.now() - start, ...memory(server.process().pid) });
  };
  const timer = setInterval(sample, 200);
  page.on("worker", (worker) => {
    if (!worker.url().includes("/photo3d/build-worker.js")) return;
    workers.add(worker);
    worker.on("close", () => workers.delete(worker));
  });
  await page.route("**/src/photo3d/build-worker.js", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()) + probe });
  });
  const cacheTimer = setInterval(async () => {
    if (checking || !samples) return;
    checking = true;
    try {
      for (const worker of workers) {
        const state = await worker.evaluate(() => globalThis.__r4MemoryProbe?.());
        if (state && JSON.stringify(state) !== JSON.stringify(cacheStates.at(-1)?.state))
          cacheStates.push({ ms: performance.now() - start, state });
      }
    } catch {
      /* A terminated worker has released its entire cache. */
    } finally {
      checking = false;
    }
  }, 200);
  try {
    await page.goto(`${url}?renderer=webgl2&profile=low&adapt=off&labs=1`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(async () => {
      const { app, player } = window.__splashery;
      await app.chooseToy("photo-3d");
      player.setPaused(true);
      player.idle.weight = 0;
      player.opts.idleDelay = 1e9;
      player.stage.setFixedSize([585, 1266]);
      for (let i = 0; i < 3; i++) await player.stage.captureFrame();
    });
    for (let pick = 0; pick < files.length; pick++) {
      await page.evaluate(() => {
        const player = window.__splashery.player,
          previous = player.proc.ctx.kit.data.photo.uid;
        window.__memoryFirst3d = null;
        document.addEventListener(
          "change",
          function changed(event) {
            if (event.target.id !== "toy-input-file") return;
            document.removeEventListener("change", changed, true);
            const start = performance.now();
            // Match the real-upload timing runner: a paused recipe does not
            // advance its asynchronous photo handoff until playback resumes.
            player.setPaused(false);
            const rendered = () => {
              const photo = player.proc?.ctx?.kit?.data?.photo,
                cover = document
                  .querySelector("[aria-label='Photo preview']")
                  ?.getBoundingClientRect();
              if (
                player.loading ||
                !photo?.custom ||
                photo.uid === previous ||
                !window.__psv.state().on ||
                (cover?.width > 0 && cover?.height > 0)
              )
                return;
              player.stage.app.off("postrender", rendered);
              const gl = player.stage.device.gl,
                fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
              gl.flush();
              const wait = () => {
                const status = gl.clientWaitSync(fence, 0, 0);
                if (status === gl.TIMEOUT_EXPIRED) return setTimeout(wait, 0);
                gl.deleteSync(fence);
                window.__memoryFirst3d = {
                  ms: performance.now() - start,
                  fenceFailed: status === gl.WAIT_FAILED,
                };
                player.setPaused(true);
              };
              wait();
            };
            player.stage.app.on("postrender", rendered);
          },
          true,
        );
      });
      cacheStates.length = 0;
      samples = [];
      start = performance.now();
      sample();
      const before = samples[0];
      await page.locator("#toy-input-file").setInputFiles(files[pick]);
      await page.waitForFunction(() => window.__memoryFirst3d, null, { timeout: 180000 });
      const settled = await page.evaluate(async () => {
        const s = window.__splashery.player.stage;
        for (let i = 0; i < 5; i++) await s.captureFrame();
        return {
          first3d: window.__memoryFirst3d,
          holds: s.renderHolds?.size || 0,
          graveyard: s.graveyard.length,
          nativeBuffer: [s.canvas.width, s.canvas.height],
          vram: { ...s.device._vram },
        };
      });
      const caches = [];
      for (const worker of workers)
        caches.push(await worker.evaluate(() => globalThis.__r4MemoryProbe?.()));
      sample();
      const captured = samples;
      samples = null;
      if (captured.some((s) => s.unavailable.length))
        throw new Error("Some Chromium processes denied memory accounting.");
      if (
        settled.first3d.fenceFailed ||
        settled.holds ||
        settled.graveyard ||
        caches.some((c) => c?.weightBytes)
      )
        throw new Error("The first view or depth-weight cleanup did not settle.");
      study.rows.push({
        run,
        pick,
        temperature: pick ? "warm" : "cold",
        input: study.uploads[pick],
        before,
        peakPssKiB: Math.max(...captured.map((s) => s.pssKiB)),
        peakRssKiB: Math.max(...captured.map((s) => s.rssKiB)),
        settled,
        caches,
        cacheStates: [...cacheStates],
        samples: captured,
      });
      save();
      console.log(
        JSON.stringify({
          run,
          pick,
          file: files[pick],
          peakPssMiB: study.rows.at(-1).peakPssKiB / 1024,
          cacheWeights: caches.map((c) => c?.weightBytes),
        }),
      );
    }
  } finally {
    clearInterval(timer);
    clearInterval(cacheTimer);
    await context.close();
    await browser.close();
    await server.close();
  }
}
study.finishedUTC = new Date().toISOString();
save();
