#!/usr/bin/env node
// Measure actual UI work, the first flat preview, and retained Sharp buffers.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const opt = (n, d) => process.argv.find((x) => x.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(
    `${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}?renderer=webgl2&profile=low&adapt=off&labs=1`,
  );
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const cpu = opt("cpu-profile", "false") === "true";
  const trace = opt("trace", "false") === "true";
  const session = cpu || trace ? await page.context().newCDPSession(page) : null;
  const events = [];
  if (trace) {
    session.on("Tracing.dataCollected", (data) => events.push(...data.value));
    await session.send("Tracing.start", {
      categories: "devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline",
      transferMode: "ReportEvents",
    });
  }
  if (cpu) {
    await session.send("Profiler.enable");
    await session.send("Profiler.start");
  }
  const results = await page.evaluate(async (profiles) => {
    const { app, player } = window.__splashery;
    const times = [],
      tasks = [],
      previews = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) tasks.push({ start: e.startTime, ms: e.duration });
    }).observe({ type: "longtask", buffered: false });
    new MutationObserver(() => {
      const p = document.querySelector("[aria-label='Photo preview']");
      if (!p || p.__observed) return;
      p.__observed = true;
      if (p.complete && p.naturalWidth) previews.push(performance.now());
      else p.addEventListener("load", () => previews.push(performance.now()), { once: true });
    }).observe(document.getElementById("stage"), { childList: true });
    const { Kit } = await import("/src/kit.js");
    const { ReliefMesh } = await import("/src/live/relief-mesh.js");
    const wrap = (object, name, label) => {
      const original = object[name];
      object[name] = function (...args) {
        const t = performance.now();
        try {
          return original.apply(this, args);
        } finally {
          times.push({
            label,
            start: t,
            ms: performance.now() - t,
            field: name === "setPieces" ? !!args[0]?.field : undefined,
          });
        }
      };
    };
    for (const name of ["emitCloud", "fit", "encodeMorphs", "encodeReliefs"])
      wrap(Kit.prototype, name, `Kit.${name}`);
    for (const name of ["setColor", "setDepth", "setPieces", "setBackground"])
      wrap(ReliefMesh.prototype, name, `Sharp.${name}`);
    wrap(HTMLCanvasElement.prototype, "getContext", "Canvas.getContext");
    wrap(CanvasRenderingContext2D.prototype, "putImageData", "Canvas.putImageData");
    wrap(player.stage, "setToy", "Stage.setToy");
    wrap(player, "makeContainer", "Player.makeContainer");
    const results = [];
    // Readbacks introduce their own Canvas2D paint. Observe actual app frames.
    const frames = async () => {
      for (let k = 0; k < 3; k++) {
        player.stage.requestRender();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
      if (!window.__psv.state().on) throw new Error("The Sharp view did not render.");
    };
    const coldStart = performance.now();
    performance.mark("cdx-p3d2-cold-start");
    await app.chooseToy("photo-3d");
    await frames();
    player.setPaused(true);
    await new Promise((r) => setTimeout(r, 100));
    const coldWork = times.filter((e) => e.start >= coldStart);
    results.push({
      profile: "cold-low",
      start: coldStart,
      totalMs: performance.now() - coldStart,
      previewMs: previews.find((t) => t >= coldStart) - coldStart,
      maxStepMs: Math.max(...coldWork.map((e) => e.ms)),
      steps: coldWork,
      longTasks: tasks.filter((e) => e.start >= coldStart),
      sharp: window.__psv.state().cost,
      splats: player.proc.ctx.buf.count,
    });
    for (const profile of profiles) {
      player.setProfile(profile);
      player.setPaused(false);
      const start = performance.now();
      await app.setToyOptions({
        source: "spiral-stairs",
        depth: profile === "low" ? 0.95 : 1,
        view: "sharp",
      });
      await frames();
      player.setPaused(true);
      await new Promise((r) => setTimeout(r, 100));
      const work = times.filter((e) => e.start >= start);
      const maxima = {};
      for (const e of work) maxima[e.label] = Math.max(maxima[e.label] || 0, e.ms);
      results.push({
        profile,
        totalMs: performance.now() - start,
        previewMs: previews.find((t) => t >= start) - start,
        maxStepMs: Math.max(...work.map((e) => e.ms)),
        maxima,
        steps: work.filter((e) => e.ms > 200 || e.label === "Sharp.setPieces"),
        longTasks: tasks.filter((e) => e.start >= start),
        sharp: window.__psv.state().cost,
        splats: player.proc.ctx.buf.count,
        heapBytes: performance.memory?.usedJSHeapSize,
      });
    }
    return results;
  }, opt("profiles", "low,max").split(","));
  const out = opt("out", ".cache/cdx-p3d2/performance.json");
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  if (cpu) {
    const { profile } = await session.send("Profiler.stop");
    fs.writeFileSync(`${out}.cpuprofile`, JSON.stringify(profile));
  }
  if (trace) {
    const done = new Promise((r) => session.once("Tracing.tracingComplete", r));
    await session.send("Tracing.end");
    await done;
    fs.writeFileSync(`${out}.trace.json`, JSON.stringify({ traceEvents: events }));
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
