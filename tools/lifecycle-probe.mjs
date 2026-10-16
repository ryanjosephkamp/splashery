#!/usr/bin/env node
// Serve the repository first (npm run serve). This probe never changes production modules.
// SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/lifecycle-probe.mjs --out=.cache/lifecycle/full.json
// --runs=3 (default), --only=clay,video,timers,sliders, --url=http://127.0.0.1:4173/
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { makeSplat } from "../tests/fixtures.mjs";

export const launchArgs = [
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
  "--enable-webgl",
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
];

// Keep only pending handles, never callbacks or detached elements. Counts therefore do not
// themselves retain the objects whose lifetime is being measured.
export function installCounters() {
  const intervals = new Map();
  const timeouts = new Map();
  const pending = new Set();
  const totals = {};
  const nativeInterval = window.setInterval.bind(window);
  const nativeClear = window.clearInterval.bind(window);
  const nativeTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  let scrubCalls = 0;
  let observer;
  const observe = () => {
    if (!observer && document.documentElement) {
      observer = new MutationObserver(() => {});
      observer.observe(document.documentElement, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      });
    }
  };
  window.setInterval = (fn, ms, ...args) => {
    if (Number(ms) !== 250 || typeof fn !== "function") return nativeInterval(fn, ms, ...args);
    const site =
      new Error().stack
        .split("\n")
        .find((s) => /\/src\//.test(s))
        ?.trim() || "unknown";
    totals[site] ||= { calls: 0, hiddenCalls: 0, mutations: 0, hiddenMutations: 0, created: 0 };
    totals[site].created++;
    const id = nativeInterval(() => {
      observe();
      observer?.takeRecords();
      const hidden = document.hidden;
      totals[site].calls++;
      if (hidden) totals[site].hiddenCalls++;
      fn(...args);
      const n = observer?.takeRecords().length || 0;
      totals[site].mutations += n;
      if (hidden) totals[site].hiddenMutations += n;
    }, ms);
    intervals.set(id, site);
    return id;
  };
  window.clearInterval = (id) => {
    intervals.delete(id);
    nativeClear(id);
  };
  window.setTimeout = (fn, ms, ...args) => {
    if (Number(ms) !== 250 || typeof fn !== "function") return nativeTimeout(fn, ms, ...args);
    const site =
      new Error().stack
        .split("\n")
        .find((s) => /\/src\//.test(s))
        ?.trim() || "probe";
    totals[site] ||= { calls: 0, hiddenCalls: 0, mutations: 0, hiddenMutations: 0, created: 0 };
    totals[site].created++;
    const id = nativeTimeout(() => {
      timeouts.delete(id);
      totals[site].calls++;
      if (document.hidden) totals[site].hiddenCalls++;
      fn(...args);
    }, ms);
    timeouts.set(id, site);
    return id;
  };
  window.clearTimeout = (id) => {
    timeouts.delete(id);
    nativeClearTimeout(id);
  };
  window.requestAnimationFrame = (fn) => {
    if (!/scrub\.isConnected/.test(Function.prototype.toString.call(fn))) return nativeRAF(fn);
    const id = nativeRAF((t) => {
      pending.delete(id);
      scrubCalls++;
      fn(t);
    });
    pending.add(id);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    pending.delete(id);
    nativeCancel(id);
  };
  window.__life = {
    snapshot: () => ({
      intervals: [...intervals.values()].reduce((o, s) => ({ ...o, [s]: (o[s] || 0) + 1 }), {}),
      timeouts: [...timeouts.values()].reduce((o, s) => ({ ...o, [s]: (o[s] || 0) + 1 }), {}),
      totals: structuredClone(totals),
      scrubPending: pending.size,
      scrubCalls,
    }),
  };
}

export async function openProbePage(browser, base, { throttle = false, beforeLoad = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(installCounters);
  if (beforeLoad) await context.addInitScript(beforeLoad);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  if (throttle) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 200_000,
      uploadThroughput: 90_000,
    });
  }
  await page.goto(`${base}?renderer=webgl2&profile=low&labs=1&adapt=off`);
  await page.waitForFunction(() => window.__splashery?.ready, null, { timeout: 180_000 });
  return { context, page, cdp };
}

export const snapshot = (page) => page.evaluate(() => window.__life.snapshot());
export async function heap(cdp) {
  await cdp.send("HeapProfiler.collectGarbage");
  const h = await cdp.send("Runtime.getHeapUsage");
  return { used: h.usedSize, backing: h.backingStorageSize, embedder: h.embedderHeapUsedSize };
}
export async function choose(page, id) {
  await page.evaluate(async (id) => {
    await window.__splashery.app.chooseToy(id);
  }, id);
  await page.waitForFunction(
    (id) => !window.__splashery.app.busy && window.__splashery.player.scene.toy.id === id,
    id,
  );
}
export const settle = (page) => page.waitForTimeout(550); // Two complete cleanup periods.

async function prepareClay(page) {
  await page.evaluate(async () => {
    const { app } = window.__splashery;
    app.sound.setEnabled(false);
    await app.makeToy({ ...app.generator, count: 10000 });
    app.clayMode = "erase";
    app.claySize = 0.01;
    window.__life.work = async (target) => {
      const { app, player } = window.__splashery;
      const stats = (a) => {
        a.sort((a, b) => a - b);
        return {
          median: a[Math.floor(a.length / 2)],
          p95: a[Math.min(a.length - 1, Math.floor(a.length * 0.95))],
        };
      };
      const drive = async (count, goal, batch, edit) => {
        const frames = [],
          costs = [];
        let previous = performance.now();
        while (count() < goal) {
          await new Promise(requestAnimationFrame);
          const now = performance.now();
          frames.push(now - previous);
          previous = now;
          const start = performance.now();
          for (let j = 0; j < batch && count() < goal; j++) edit();
          costs.push(performance.now() - start);
        }
        return {
          frames: frames.length ? stats(frames) : null,
          batchMs: costs.length ? stats(costs) : null,
        };
      };
      // One continuous clay stroke, then a continuous paint stroke. Do not repeatedly replay
      // the whole paint history between individual edits: a person releases a stroke once.
      const clayTiming = await drive(
        () => player.proc.clay.length,
        target,
        25,
        () => {
          const i = player.proc.clay.length;
          app.applyTool(
            { tool: "clay" },
            [((i % 101) - 50) / 100, ((Math.floor(i / 101) % 101) - 50) / 100, 0],
            false,
          );
        },
      );
      const start = performance.now();
      player.refreshPaint();
      const repaintMs = performance.now() - start;
      const paintTiming = await drive(
        () => player.scene.paint.stamps.length,
        target * 2,
        50,
        () => {
          const i = player.scene.paint.stamps.length;
          player.paintAt([Math.sin(i * 0.017) * 0.5, Math.cos(i * 0.017) * 0.5, 0], false);
        },
      );
      return {
        clay: player.proc.clay.length,
        paint: player.scene.paint.stamps.length,
        clayTiming,
        paintTiming,
        repaintMs,
      };
    };
  });
}

async function clay(page, cdp) {
  await prepareClay(page);
  const samples = [];
  for (const n of [0, 1900, 2000, 2400, 4000, 8000]) {
    const work = await page.evaluate((n) => window.__life.work(n), n);
    samples.push({ ...work, heap: await heap(cdp) });
    process.stderr.write(`  ${work.clay} clay, ${work.paint} paint\n`);
  }
  // Keep a serialized copy in Node, outside the measured browser heap. Release the real histories
  // made by editing before using that copy for the independent save/reopen measurements.
  const full = await page.evaluate(() => ({
    clay: window.__splashery.player.proc.clay,
    paint: window.__splashery.player.scene.paint.stamps,
  }));
  const releases = [];
  for (const action of ["reset", "toy", "source"]) {
    if (action !== "reset") {
      await page.evaluate(async () => {
        const { app } = window.__splashery;
        await app.makeToy({ ...app.generator, count: 10000 });
      });
      await page.evaluate(() => window.__life.work(8000));
    }
    await page.evaluate(() => {
      const { player } = window.__splashery;
      const arrays = [player.proc.clay, player.scene.toy.clay, player.scene.paint.stamps];
      window.__life.oldEdits = [...arrays, ...arrays.flatMap((a) => [a[0], a.at(-1)])].map(
        (a) => new WeakRef(a),
      );
    });
    const before = await heap(cdp);
    await page.evaluate(async (action) => {
      const { app } = window.__splashery;
      if (action === "reset") await app.resetAll();
      else if (action === "toy") await app.chooseToy("basketball");
      else await app.makeToy({ ...app.generator, shape: "torus", count: 10000 });
    }, action);
    await settle(page);
    releases.push({
      action,
      before,
      after: await heap(cdp),
      retainedArraysAndEdits: await page.evaluate(() =>
        window.__life.oldEdits.map((r) => !!r.deref()),
      ),
      remaining: await page.evaluate(() => [
        window.__splashery.player.proc?.clay.length || 0,
        window.__splashery.player.scene.paint.stamps.length,
      ]),
    });
  }
  await page.evaluate(async () => {
    const { app } = window.__splashery;
    await app.makeToy({ ...app.generator, count: 10000 });
  });
  const saved = [];
  // Exercise the actual JSON download, parse its bytes, and import through the application.
  for (const n of [1900, 2000, 2400, 8000]) {
    await page.evaluate(
      ({ n, full }) => {
        const { player } = window.__splashery;
        player.proc.clay = full.clay.slice(0, n);
        player.scene.toy.clay = player.proc.clay.slice();
        player.scene.paint.stamps = full.paint.slice(0, n * 2);
      },
      { n, full },
    );
    const download = page.waitForEvent("download");
    await page.evaluate(() => window.__splashery.app.exportJSON());
    const file = await download;
    const json = JSON.parse(await fs.readFile(await file.path(), "utf8"));
    const notice = await page.locator("#toast").textContent();
    const prefix = await page.evaluate(
      (json) => ({
        clay:
          JSON.stringify(json.toy.clay) ===
          JSON.stringify(window.__splashery.player.proc.clay.slice(0, 2000)),
        paint:
          JSON.stringify(json.paint.stamps) ===
          JSON.stringify(window.__splashery.player.scene.paint.stamps.slice(0, 4000)),
      }),
      json,
    );
    await page.evaluate(async (json) => {
      await window.__splashery.app.importJSONFile(
        new File([JSON.stringify(json)], "lifecycle.json", { type: "application/json" }),
      );
    }, json);
    saved.push({
      input: [n, n * 2],
      saved: [json.toy.clay.length, json.paint.stamps.length],
      reopened: await page.evaluate(() => [
        window.__splashery.player.proc.clay.length,
        window.__splashery.player.scene.paint.stamps.length,
      ]),
      prefix,
      reopenedMatches: await page.evaluate(
        (json) =>
          JSON.stringify(window.__splashery.player.proc.clay) === JSON.stringify(json.toy.clay) &&
          JSON.stringify(window.__splashery.player.scene.paint.stamps) ===
            JSON.stringify(json.paint.stamps),
        json,
      ),
      notice,
    });
  }
  const sourceFile = await fileSource(page, cdp);
  return { samples, saved, releases: [...releases, sourceFile] };
}

async function fileSource(page, cdp) {
  await prepareClay(page);
  await page.evaluate(() => window.__life.work(8000));
  await page.evaluate(() => {
    const { player } = window.__splashery;
    const arrays = [player.proc.clay, player.scene.toy.clay, player.scene.paint.stamps];
    window.__life.oldEdits = [...arrays, ...arrays.flatMap((a) => [a[0], a.at(-1)])].map(
      (a) => new WeakRef(a),
    );
  });
  const before = await heap(cdp);
  await page.evaluate(
    async (bytes) => {
      await window.__splashery.app.openFile(new File([new Uint8Array(bytes)], "lifecycle.splat"));
    },
    Array.from(makeSplat(256)),
  );
  await settle(page);
  return {
    action: "local file source",
    before,
    after: await heap(cdp),
    retainedArraysAndEdits: await page.evaluate(() =>
      window.__life.oldEdits.map((r) => !!r.deref()),
    ),
    remaining: await page.evaluate(() => [
      window.__splashery.player.proc?.clay.length || 0,
      window.__splashery.player.scene.paint.stamps.length,
    ]),
    toyKind: await page.evaluate(() => window.__splashery.player.scene.toy.kind),
  };
}

async function openVideo(page) {
  await page.evaluate(async () => {
    const blob = await (await fetch("/assets/toys/screen/bunny.webm")).blob();
    await window.__splashery.app.openMedia(new File([blob], "bunny.webm", { type: "video/webm" }));
  });
}

async function video(page, cdp) {
  // Warm the same two toys once so lazy modules are included in both heap measurements.
  await choose(page, "screen");
  await openVideo(page);
  await settle(page);
  const open = await snapshot(page);
  await choose(page, "basketball");
  await settle(page);
  const before = await heap(cdp);
  const checkpoints = [];
  for (let i = 1; i <= 20; i++) {
    await choose(page, "screen");
    await openVideo(page);
    await page.evaluate(() => {
      window.__life.scrubs ||= [];
      window.__life.scrubs.push(new WeakRef(document.getElementById("toy-media-scrub")));
    });
    await choose(page, "basketball");
    await settle(page);
    if (i === 1 || i === 10 || i === 20)
      checkpoints.push({
        cycles: i,
        ...(await snapshot(page)),
        heap: await heap(cdp),
        retainedScrubs: await page.evaluate(
          () => window.__life.scrubs.filter((r) => r.deref()).length,
        ),
      });
  }
  return { open, before, checkpoints };
}

// Chromium headless keeps background targets visible. Simulate only the visibility properties
// and event, leaving timers runnable, so an application's hidden-page guard can be measured.
// This deliberately does not measure Chromium's native background timer throttling.
export async function hiddenSample(page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const before = await snapshot(page);
  await page.waitForTimeout(1100);
  const after = await snapshot(page);
  await page.evaluate(() => {
    delete document.hidden;
    delete document.visibilityState;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  return { before, after };
}

async function timers(page, cdp, save = async () => {}) {
  // Timer ownership does not depend on raster resolution. Keep the phone layout, but reduce
  // the stage's offscreen render target so 240 real toy builds do not benchmark SwiftShader.
  await page.evaluate(() => window.__splashery.player.stage.setFixedSize([96, 96]));
  const toys = [];
  for (const id of ["sound-lab", "song-landscape", "chess-set", "toy-piano"]) {
    await choose(page, id);
    await settle(page);
    const before = await heap(cdp);
    for (let i = 0; i < 20; i++) {
      await page.evaluate(async () => {
        const { app, player } = window.__splashery;
        await app.loadToy(player.scene.toy);
      });
      await settle(page);
    }
    const rebuilt = await snapshot(page);
    const hidden = await hiddenSample(page);
    for (let i = 0; i < 20; i++) {
      await choose(page, "basketball");
      await choose(page, id);
      await settle(page);
    }
    const switched = await snapshot(page);
    await choose(page, "basketball");
    await settle(page);
    toys.push({
      id,
      before,
      rebuilt,
      hidden,
      switched,
      closed: await snapshot(page),
      after: await heap(cdp),
    });
    await save({ toys });
    process.stderr.write(`  ${id}: 20 rebuilds and 20 switches\n`);
  }
  // Exercise the real Video to 3D lifecycle helpers against the live player without training a
  // video or fetching a large capture. This isolates ownership and disposal from reconstruction.
  const helpers = await page.evaluate(async () => {
    const { makeFlight } = await import("/src/video3d/flight.js");
    const { mountWalk } = await import("/src/video3d/walk.js");
    const { mountSceneCredit } = await import("/src/video3d/credit.js");
    const { progressCard } = await import("/src/video3d/panel.js");
    const { player } = window.__splashery;
    const path = [
      { time: 0, pos: [0, 0, 1], yaw: 0, pitch: 0, roll: 0 },
      { time: 1, pos: [0, 0, 2], yaw: 0, pitch: 0, roll: 0 },
    ];
    const original = player.scene.toy;
    const counts = [];
    for (let i = 0; i < 20; i++) {
      player.scene.toy = { kind: "builtin", id: "video-3d" };
      let current = true;
      const f = makeFlight(path, null, { isCurrent: () => current });
      const w = mountWalk(path, { flight: f, isCurrent: () => current });
      const c = mountSceneCredit({
        id: "probe",
        source: "#",
        author: "Lifecycle probe",
        title: "Local fixture",
        licenseUrl: "#",
        license: "CC0",
      });
      const p = progressCard();
      await new Promise((r) => setTimeout(r, 300));
      if (i === 19) {
        counts.push({ open: window.__life.snapshot() });
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
        const before = window.__life.snapshot();
        await new Promise((r) => setTimeout(r, 1100));
        counts.push({ hidden: { before, after: window.__life.snapshot() } });
        delete document.hidden;
        delete document.visibilityState;
        document.dispatchEvent(new Event("visibilitychange"));
      }
      current = false;
      player.scene.toy = original;
      await new Promise((r) => setTimeout(r, 300));
      counts.push({
        cycle: i + 1,
        closed: window.__life.snapshot(),
        cards: document.querySelectorAll("#v3d-card").length,
      });
      // The card remains connected by design; callers explicitly remove it on replacement.
      f.dispose();
      w.dispose();
      c.dispose();
      if (i === 19) window.__life.card = p;
    }
    return counts;
  });
  const helperHidden = helpers.find((s) => s.hidden).hidden;
  await page.evaluate(() => {
    window.__life.card.root.remove();
    delete window.__life.card;
  });
  await settle(page);
  const helperClosed = await snapshot(page);
  await save({ toys, helpers, helperHidden, helperClosed });
  // Recording timers are take-scoped, rather than toy-scoped. Use real MediaRecorder and a tiny
  // canvas; the test pattern contains no external media, audio, or permissions.
  const recording = await page.evaluate(async () => {
    const { startRecording } = await import("/src/exports.js");
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    canvas.getContext("2d").fillRect(0, 0, 64, 64);
    const counts = [];
    for (let i = 0; i < 20; i++) {
      const rec = startRecording({ canvas, maxSeconds: 2 });
      canvas.getContext("2d").fillStyle = i % 2 ? "red" : "blue";
      canvas.getContext("2d").fillRect(0, 0, 64, 64);
      await new Promise(requestAnimationFrame);
      rec.frame();
      if (i === 19) {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden",
        });
      }
      await new Promise((r) => setTimeout(r, 300));
      if (i === 19) counts.push({ open: window.__life.snapshot() });
      rec.stop();
      try {
        const done = await rec.done;
        counts.push({ cycle: i + 1, bytes: done.blob.size, closed: window.__life.snapshot() });
      } catch (error) {
        counts.push({ cycle: i + 1, error: error.message, closed: window.__life.snapshot() });
      }
      delete document.hidden;
      delete document.visibilityState;
    }
    return counts;
  });
  await save({ toys, helpers, helperHidden, helperClosed, recording });
  const retries = await qrRetries(page, cdp, async (retries) =>
    save({ toys, helpers, helperHidden, helperClosed, recording, retries }),
  );
  const activeLive = await livePanel(page, cdp);
  const stageRecording = await stageRecorders(page, cdp);
  const emptyRecording = await emptyRecordings(page, cdp);
  return {
    toys,
    helpers,
    helperHidden,
    helperClosed,
    recording,
    retries,
    activeLive,
    stageRecording,
    emptyRecording,
  };
}

async function qrRetries(page, cdp, save = async () => {}) {
  await page.evaluate(() => window.__splashery.player.stage.setFixedSize([96, 96]));
  const results = [];
  const hold = async (id) => {
    await page.evaluate(async (id) => {
      const { app } = window.__splashery;
      const pending = app.chooseToy(id);
      app.busy = true; // The real readiness gate, held before the toy event schedules its check.
      await pending;
    }, id);
    await page.waitForTimeout(850);
  };
  const release = async () => {
    await page.evaluate(() => {
      window.__splashery.app.busy = false;
    });
    await choose(page, "basketball");
    await settle(page);
  };
  try {
    for (const id of ["qr-code", "qr-damage"]) {
      const site = id === "qr-code" ? "packs/qr.js" : "packs/qr-lab.js";
      const checkpoints = [];
      let hidden;
      for (let i = 0; i < 20; i++) {
        await hold(id);
        const open = await snapshot(page);
        if (!Object.keys(open.timeouts).some((k) => k.includes(site)))
          throw new Error(`${id}: readiness retry was not observed`);
        if (i === 19) hidden = await hiddenSample(page);
        await release();
        if (i === 0 || i === 19)
          checkpoints.push({ cycle: i + 1, open, closed: await snapshot(page) });
      }
      await hold(id);
      const pending = await snapshot(page);
      await page.waitForTimeout(id === "qr-code" ? 10500 : 15500);
      const expired = await snapshot(page);
      await release();
      results.push({
        id,
        checkpoints,
        hidden,
        pending,
        expired,
        fixture: "Readiness held by app.busy; ordinary toy-switch listeners remain active",
      });
      await save(results);
      process.stderr.write(`  ${id}: active retry observed, 20 switches, bounded expiration\n`);
    }
  } finally {
    await page.evaluate(() => {
      window.__splashery.app.busy = false;
    });
  }
  return results;
}

async function emptyRecordings(page, cdp) {
  await page.evaluate(() => {
    window.__splashery.app.setAutoplay({ turntable: false });
    window.__splashery.player.stage.setFixedSize([96, 96]);
  });
  const before = await heap(cdp);
  const takes = await page.evaluate(async () => {
    const { startRecording } = await import("/src/exports.js");
    const takes = [];
    for (let i = 0; i < 20; i++) {
      // An undrawn canvas has no frame to encode: exercise the real bounded empty-take retry.
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      if (i === 19)
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      const first = window.__life.snapshot();
      const take = startRecording({ canvas });
      await new Promise((r) => setTimeout(r, 300));
      take.stop();
      try {
        const result = await take.done;
        takes.push({
          cycle: i + 1,
          bytes: result.blob.size,
          before: first,
          closed: window.__life.snapshot(),
        });
      } catch (error) {
        takes.push({
          cycle: i + 1,
          error: error.message,
          before: first,
          closed: window.__life.snapshot(),
        });
      }
      delete document.hidden;
    }
    return takes;
  });
  return { before, takes, after: await heap(cdp) };
}

async function stageRecorders(page, cdp) {
  const before = await heap(cdp);
  const takes = await page.evaluate(async () => {
    const { StageRecorder } = await import("/src/live/record.js");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const pixels = ctx.createImageData(64, 64);
    let seed = 1;
    const draw = () => {
      for (let i = 0; i < pixels.data.length; i += 4) {
        seed = (seed * 16807) % 2147483647;
        const v = seed % 256;
        pixels.data.set([v, 255 - v, v ^ 85, 255], i);
      }
      ctx.putImageData(pixels, 0, 0);
    };
    const takes = [];
    for (let i = 0; i < 20; i++) {
      let rec;
      const done = new Promise((resolve) => {
        rec = new StageRecorder(canvas, { onStop: resolve });
      });
      const paint = setInterval(draw, 33);
      draw();
      if (i === 19)
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      await new Promise((r) => setTimeout(r, 650));
      if (i === 19) takes.push({ open: window.__life.snapshot() });
      rec.stop();
      await done;
      clearInterval(paint);
      delete document.hidden;
      takes.push({
        cycle: i + 1,
        bytes: rec.blob?.size || 0,
        empty: rec.empty,
        closed: window.__life.snapshot(),
      });
    }
    return takes;
  });
  return { before, takes, after: await heap(cdp) };
}

async function livePanel(page, cdp) {
  await choose(page, "sound-lab");
  await page.locator("#live-mic").dispatchEvent("click");
  await page.waitForFunction(
    () => document.getElementById("live-mic")?.getAttribute("aria-pressed") === "true",
  );
  await settle(page);
  const before = await heap(cdp);
  const hidden = await hiddenSample(page);
  await page.locator("#live-mic").dispatchEvent("click");
  await page.waitForFunction(
    () => document.getElementById("live-mic")?.getAttribute("aria-pressed") === "false",
  );
  await choose(page, "basketball");
  await settle(page);
  return {
    source: "Chromium fake microphone; no real device",
    before,
    hidden,
    closed: await snapshot(page),
    after: await heap(cdp),
  };
}

async function sliders(browser, base) {
  const beforeLoad = () => {
    window.__sliderFrames = [];
    const sample = () => {
      const inputs = ["gen-count", "gen-jitter", "gen-rough", "gen-noise"].map((id) =>
        document.getElementById(id),
      );
      if (inputs.every(Boolean)) {
        const visible = inputs.map((e) => {
          const r = e.getBoundingClientRect();
          return e.checkVisibility() && r.width > 0 && r.bottom > 0 && r.top < innerHeight;
        });
        const values = inputs.map((e) => e.value);
        const key = JSON.stringify({ visible, values });
        if (window.__sliderFrames.at(-1)?.key !== key)
          window.__sliderFrames.push({ t: performance.now(), visible, values, key });
      }
      // Try the normal More and Make actions at the first frame their handlers are wired, while
      // the initial toy can still be loading. Waiting for data-ready would hide a startup flash.
      if (!document.body?.classList.contains("sheet-open"))
        document.getElementById("sheet-toggle")?.click();
      if (document.getElementById("pane-make")?.hidden)
        document.getElementById("tab-make")?.click();
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  };
  const { context, page, cdp } = await openProbePage(browser, base, { throttle: true, beforeLoad });
  await page.waitForTimeout(500);
  const result = await page.evaluate(() => ({
    frames: window.__sliderFrames,
    generator: window.__splashery.app.generator,
    values: ["gen-count", "gen-jitter", "gen-rough", "gen-noise"].map((id) => ({
      id,
      value: document.getElementById(id).value,
      visible: document.getElementById(id).checkVisibility(),
    })),
  }));
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await context.close();
  return result;
}

export async function runProbe({
  base = "http://127.0.0.1:4173/",
  runs = 3,
  only = ["clay", "video", "timers", "sliders"],
  out = null,
} = {}) {
  if (out) await fs.mkdir(dirname(out), { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    args: launchArgs,
  });
  const result = {
    commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    date: new Date().toISOString(),
    browser: browser.version(),
    viewport: [390, 844],
    visibility: "simulated document.hidden; native background throttling not measured",
    runs: [],
  };
  try {
    for (let i = 0; i < runs; i++) {
      const row = { run: i + 1 };
      result.runs.push(row);
      for (const name of only) {
        process.stderr.write(`Run ${i + 1}/${runs}: ${name}\n`);
        if (name === "sliders") row[name] = await sliders(browser, base);
        else {
          const { context, page, cdp } = await openProbePage(browser, base);
          try {
            row[name] = await {
              clay,
              video,
              timers,
              live: livePanel,
              stageRecording: stageRecorders,
              emptyRecording: emptyRecordings,
              fileSource,
              retries: qrRetries,
            }[name](page, cdp, async (partial) => {
              row[name] = partial;
              if (out) await fs.writeFile(out, JSON.stringify(result, null, 2) + "\n");
            });
          } finally {
            await context.close();
          }
        }
        if (out) await fs.writeFile(out, JSON.stringify(result, null, 2) + "\n");
      }
    }
  } finally {
    await browser.close();
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opt = (key, fallback) =>
    process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
  const result = await runProbe({
    base: opt("url", "http://127.0.0.1:4173/"),
    runs: Number(opt("runs", "3")),
    only: opt("only", "clay,video,timers,sliders").split(","),
    out: opt("out", ".cache/lifecycle/full.json"),
  });
  const json = JSON.stringify(result, null, 2) + "\n";
  await fs.writeFile(opt("out", ".cache/lifecycle/full.json"), json);
}
