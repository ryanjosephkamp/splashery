(() => {
  performance.setResourceTimingBufferSize(3000);
  const probe = (window.__compare = {
    startedAt: new Date().toISOString(),
    firstFrameMs: null,
    frameends: [],
    renders: [],
    errors: [],
    done: false,
  });
  addEventListener("error", (e) => probe.errors.push(e.message));
  const locate = () => {
    const own = window.__splashery?.player?.stage?.app;
    let external = window.app;
    try {
      external ||= document.querySelector("iframe")?.contentWindow?.app;
    } catch {}
    const app = own || external;
    if (!app) return requestAnimationFrame(locate);
    probe.hookMs = performance.now();
    probe.alreadyLoadedAtHook = own
      ? document.body.dataset.ready === "true"
      : app.stats.frame.gsplats > 0;
    app.on("frameend", () => probe.frameends.push(performance.now()));
    app.on("postrender", () => {
      const now = performance.now();
      probe.renders.push(now);
      const loaded = own ? document.body.dataset.ready === "true" : app.stats.frame.gsplats > 0;
      if (loaded && probe.firstFrameMs === null) {
        probe.firstFrameMs = now;
        setTimeout(() => {
          probe.windowStartMs = performance.now();
          setTimeout(() => {
            probe.windowEndMs = performance.now();
            probe.renderer = app.graphicsDevice.deviceType;
            probe.drawnSplats = app.stats.frame.gsplats;
            probe.splats =
              window.__splashery?.player?.toyInfo?.splats ??
              app.assets.list().find((a) => a.type === "gsplat")?.resource?.numSplats ??
              null;
            probe.assets = app.assets.list().map((a) => ({
              name: a.name,
              type: a.type,
              url: a.file?.url,
              loaded: a.loaded,
              numSplats: a.resource?.numSplats,
            }));
            probe.profile = window.__splashery?.player?.profile ?? null;
            probe.tier = window.__splashery?.player?.tier ?? null;
            const canvas =
              document.querySelector("canvas") ||
              document.querySelector("iframe")?.contentDocument.querySelector("canvas");
            probe.canvas = canvas ? { width: canvas.width, height: canvas.height } : null;
            probe.viewport = { width: innerWidth, height: innerHeight, dpr: devicePixelRatio };
            probe.resources = performance.getEntriesByType("resource").map((r) => ({
              url: r.name,
              initiatorType: r.initiatorType,
              encodedBodySize: r.encodedBodySize,
              transferSize: r.transferSize,
              startTime: r.startTime,
              responseEnd: r.responseEnd,
            }));
            probe.done = true;
          }, 5000);
        }, 1500);
      }
    });
  };
  requestAnimationFrame(locate);
})();
