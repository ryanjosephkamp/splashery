// Actual product entry points, in a sandboxed real browser. No substitute inference.
export async function openPhoto(page, url) {
  return page.evaluate(async (url) => {
    const m = await import("/src/packs/photo-3d.js");
    const response = await fetch(url);
    if (!response.ok) throw new Error("Missing truth still");
    const blob = await response.blob();
    const dep = await import("/src/packs/photo-3d-depth.js");
    const listener = (event) => globalThis.__truthStatus?.(event.detail.text);
    dep.depthProgress.addEventListener("progress", listener);
    let result;
    try {
      result = await m.openPhoto(blob, "Studio truth");
    } finally {
      dep.depthProgress.removeEventListener("progress", listener);
    }
    return { w: result.depth.w, h: result.depth.h, d: Array.from(result.depth.d), ms: result.ms };
  }, url);
}

export async function showPhoto(page) {
  return page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("photo-3d");
    await app.setToyOptions({ source: "custom", view: "sharp", detail: "photo" });
    player.camera.setTurntable(false);
    player.idle.weight = 0;
  });
}

export async function openMoving(page, url, render = true) {
  return page.evaluate(
    async ({ url, render }) => {
      const m = await import("/src/packs/moving-photo.js");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Missing handheld clip");
      const file = new File([await response.blob()], "truth.mp4", { type: "video/mp4" });
      // The toy's own input.read both invokes openClip and installs its custom clip.
      const options = await m.MOVING_PHOTO.input.read(null, "truth.mp4", file);
      if (render) {
        const { app, player } = window.__splashery;
        await app.chooseToy("moving-photo-3d");
        await app.setToyOptions({ ...options, depth: 0, view: "sharp", detail: "photo" });
        player.camera.setTurntable(false);
        player.idle.weight = 0;
        player.motion.setControl("play", 0, { snap: true });
      }
      const clip = m.MOVING.custom;
      let t = 0;
      const times = clip.delays.map((delay) => {
        const at = t;
        t += delay / 1000;
        return at;
      });
      return { w: clip.w, h: clip.h, times };
    },
    { url, render },
  );
}

export async function movingDepth(page, index) {
  return page.evaluate(
    async (index) =>
      Array.from(
        (await import("/src/packs/moving-photo.js")).MOVING.custom.near[index],
        (v) => v / 255,
      ),
    index,
  );
}

// Canonical flat front-view diagnostics, not novel-view/held-out evidence.
// Registration follows the toy's actual projection, not image-content fitting.
export async function captureFront(page, toy, frame = 0) {
  return page.evaluate(
    async ({ toy, frame }) => {
      const { player } = window.__splashery;
      const st = player.stage;
      if (toy === "photo") player.motion.setControl("flat", 1, { snap: true });
      else {
        const m = await import("/src/packs/moving-photo.js");
        let t = 0;
        for (let i = 0; i < frame; i++) t += m.MOVING.clip.delays[i] / 1000;
        await m.movingTransport.seek(t);
      }
      st.setFixedSize([960, 600]);
      st.setClearColor([0, 0, 0], 0);
      player.camera.cur = {
        ...player.camera.cur,
        yaw: 0,
        pitch: 0,
        roll: 0,
        distance: player.camera.radius * 3,
      };
      player.camera.tgt = { ...player.camera.cur };
      player.camera.vel = { yaw: 0, pitch: 0 };
      for (let i = 0; i < 3; i++) await st.captureFrame();
      const recipe =
        toy === "photo"
          ? (await import("/src/packs/photo-3d.js")).RECIPES["photo-3d"]
          : (await import("/src/packs/moving-photo.js")).MOVING_PHOTO;
      const [x0, y0, x1, y1] = recipe.photo.rect();
      const top = player.screenPoint([x0, y1, 0]),
        bottom = player.screenPoint([x1, y0, 0]);
      const bounds = st.canvas.getBoundingClientRect();
      const frameCanvas = await st.captureFrame();
      const sx = (top[0] * frameCanvas.width) / bounds.width,
        sy = (top[1] * frameCanvas.height) / bounds.height;
      const sw = ((bottom[0] - top[0]) * frameCanvas.width) / bounds.width,
        sh = ((bottom[1] - top[1]) * frameCanvas.height) / bounds.height;
      if (
        sx < 0 ||
        sy < 0 ||
        sw < 10 ||
        sh < 10 ||
        sx + sw > frameCanvas.width ||
        sy + sh > frameCanvas.height
      )
        throw new Error("Projected source frame is outside capture");
      const out = document.createElement("canvas");
      out.width = 320;
      out.height = 180;
      const g = out.getContext("2d");
      g.drawImage(frameCanvas, sx, sy, sw, sh, 0, 0, 320, 180);
      const data = Array.from(g.getImageData(0, 0, 320, 180).data);
      const png = out.toDataURL("image/png").split(",")[1];
      st.setFixedSize(null);
      return {
        w: 320,
        h: 180,
        data,
        png,
        registration: { sx, sy, sw, sh, capture: [frameCanvas.width, frameCanvas.height] },
        convention: "flat front view, actual toy projection; no held-out or disocclusion claim",
      };
    },
    { toy, frame },
  );
}

export async function trainVideo(page, url, timeoutMs) {
  const result = await page.evaluate(
    async ({ url, timeoutMs }) => {
      const { webgpuStatus, videoTo3D } = await import("/src/video3d/run.js");
      const gpu = await webgpuStatus();
      if (!gpu.ok) return { status: "blocked", reason: gpu.reason };
      const response = await fetch(url);
      if (!response.ok) return { status: "blocked", reason: "Missing walk clip" };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const file = new File([await response.blob()], "truth-walk.mp4", { type: "video/mp4" });
        const r = await videoTo3D(file, {
          start: 0,
          length: 10,
          rate: 3,
          tier: "mid",
          signal: controller.signal,
        });
        return {
          status: "trained-unscored",
          stats: r.stats,
          reason:
            "Solved camera alignment and truly held-out training inputs require a separate adapter; no held-out score is claimed.",
        };
      } catch (e) {
        return { status: "failed", reason: String(e) };
      } finally {
        clearTimeout(timer);
      }
    },
    { url, timeoutMs },
  );
  return {
    ...result,
    depth: null,
    holes: null,
    edgeHalo: null,
    jitter: null,
    heldOutSharpness: null,
  };
}
