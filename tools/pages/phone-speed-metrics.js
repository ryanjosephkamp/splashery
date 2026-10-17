// Local measurements only. Made by Ryan with Codex (GPT-6), under the MIT license.
export function distribution(samples) {
  const s = samples.filter(Number.isFinite).sort((a, b) => a - b);
  const n = s.length;
  return {
    count: n,
    median: n ? (s[Math.floor((n - 1) / 2)] + s[Math.floor(n / 2)]) / 2 : null,
    p95: n ? s[Math.ceil(n * 0.95) - 1] : null,
  };
}

// Alternate ranks in opening time and draw interval. This includes both kinds
// of bottleneck without pretending that a millisecond of loading equals a frame.
export function rankSlowest(rows, count = 30) {
  const good = rows.filter((r) => !r.error && r.firstViewMs > 0);
  const opening = [...good].sort((a, b) => b.firstViewMs - a.firstViewMs);
  const drawing = [...good].sort(
    (a, b) =>
      Math.max(b.idle?.median || 0, b.tap?.median || 0) -
      Math.max(a.idle?.median || 0, a.tap?.median || 0),
  );
  const chosen = new Map();
  for (let i = 0; chosen.size < count && i < good.length; i++) {
    for (const r of [drawing[i], opening[i]]) {
      if (chosen.size < count && !chosen.has(r.id)) chosen.set(r.id, r);
    }
  }
  return [...chosen.values()];
}

// Self-contained so Playwright can install it before the unmodified app loads.
export function installFirstFrameProbe() {
  const pixel = new Uint8Array(4);
  // Chromium intentionally implements WebGL finish() as Flush(). A synchronous
  // readback is required to wait for submitted rendering, rather than its queue.
  window.__phoneSpeedCompleteDraw = (gl) => {
    if (!gl || gl.isContextLost()) throw new Error("WebGL2 is unavailable.");
    const previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
    try {
      if (previous !== null) gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    } finally {
      if (previous !== null) gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous);
    }
    if (gl.isContextLost()) throw new Error("WebGL2 was lost during draw completion.");
  };
  const observer = new MutationObserver(() => {
    if (document.body?.dataset.firstToyFrame !== "true") return;
    const submittedMs = performance.now();
    const gl = document.getElementById("stage")?.getContext("webgl2");
    try {
      window.__phoneSpeedCompleteDraw(gl);
      window.__phoneSpeedFirstView = {
        submittedMs,
        completedMs: performance.now(),
        gpuReadback: true,
      };
    } catch (error) {
      window.__phoneSpeedFirstViewError = error.message;
    }
    observer.disconnect();
  });
  observer.observe(document, {
    subtree: true,
    attributes: true,
    attributeFilter: ["data-first-toy-frame"],
  });
}

export async function measureFrames(player, durationMs = 2500, signal) {
  const app = player.stage.app;
  const gl = player.stage.device.gl;
  if (!gl) throw new Error("This protocol requires WebGL2.");
  const complete = player.canvas.ownerDocument.defaultView.__phoneSpeedCompleteDraw;
  if (!complete) throw new Error("Install the draw completion probe before measuring.");
  const intervals = [];
  const work = [];
  let previous = null;
  let start = null;
  const began = performance.now();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      app.off("update", force);
      app.off("prerender", before);
      app.off("postrender", after);
      signal?.removeEventListener("abort", abort);
      clearTimeout(timeout);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Stopped", "AbortError"));
    };
    const force = () => player.stage.requestRender();
    const before = () => {
      start = performance.now();
    };
    const after = () => {
      if (!(player.stage.device._drawCallsPerFrame > 0)) return;
      try {
        complete(gl);
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }
      const now = performance.now();
      if (start !== null) work.push(now - start);
      if (previous !== null) intervals.push(now - previous);
      previous = now;
      if (now - began >= durationMs && intervals.length >= 8) {
        cleanup();
        resolve({
          ...distribution(intervals),
          work: distribution(work),
          elapsedMs: now - began,
          intervals,
          workMs: work,
        });
      }
    };
    const timeout = setTimeout(
      () => {
        cleanup();
        reject(new Error("No completed draws within 60 seconds."));
      },
      Math.max(60000, durationMs * 4),
    );
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) return abort();
    app.on("update", force);
    app.on("prerender", before);
    app.on("postrender", after);
    force();
  });
}

export async function measureReadyToy(win, { durationMs = 2500, signal } = {}) {
  const { app, player } = win.__splashery;
  if (!player.toyInfo || player.loading || !win.__splashery.ready)
    throw new Error("Toy is not ready.");
  app.sound.setEnabled(false);
  player.opts.idleDelay = 1e9;
  player.idle.weight = 0;
  app.setAutoplay({ turntable: false });
  await new Promise((resolve) => win.setTimeout(resolve, 1200));
  const idle = await measureFrames(player, durationMs, signal);
  const action = player.toyInfo.recipe?.action?.key || "hop";
  player.act(null);
  const tap = await measureFrames(player, durationMs, signal);
  const resources = win.performance
    .getEntriesByType("resource")
    .filter((e) => !new URL(e.name).pathname.includes("/tools/"));
  const navigation = win.performance.getEntriesByType("navigation")[0];
  const entries = [navigation, ...resources].filter(Boolean);
  return {
    id: player.scene.toy.id,
    completion: "synchronous-readPixels",
    firstViewReadback: win.__phoneSpeedFirstView?.gpuReadback === true,
    firstViewMs: win.__phoneSpeedFirstView?.completedMs ?? null,
    firstSubmitMs: win.__phoneSpeedFirstView?.submittedMs ?? null,
    idle,
    tap,
    action,
    heapBytes: win.performance.memory?.usedJSHeapSize ?? null,
    transferBytes: entries.reduce((n, e) => n + e.transferSize, 0),
    bodyBytes: entries.reduce((n, e) => n + e.encodedBodySize, 0),
    cachedRequests: entries.filter((e) => e.transferSize === 0 && e.decodedBodySize > 0).length,
    requests: entries.length,
    splats: player.toyInfo.splats,
    profile: player.profile,
    canvas: [player.canvas.width, player.canvas.height],
    viewport: [win.innerWidth, win.innerHeight],
    deviceScaleFactor: win.devicePixelRatio,
    renderer: player.deviceType,
  };
}
