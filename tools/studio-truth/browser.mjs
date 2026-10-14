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
    const scene = structuredClone(player.scene);
    scene.toy = {
      kind: "builtin",
      id: "photo-3d",
      options: { source: "custom", view: "sharp", detail: "photo" },
    };
    scene.motion.controls = {};
    await app.applyScene(scene);
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
      const captures = [];
      const clocks = new WeakMap();
      const inCallback = new WeakSet();
      const videoPrototype = HTMLVideoElement.prototype;
      const canvasPrototype = CanvasRenderingContext2D.prototype;
      const originalCallback = videoPrototype.requestVideoFrameCallback;
      const originalDraw = canvasPrototype.drawImage;
      if (originalCallback)
        videoPrototype.requestVideoFrameCallback = function (callback) {
          return originalCallback.call(this, (now, metadata) => {
            clocks.set(this, metadata.mediaTime);
            inCallback.add(this);
            try {
              callback(now, metadata);
            } finally {
              inCallback.delete(this);
            }
          });
        };
      canvasPrototype.drawImage = function (image, ...args) {
        if (image instanceof HTMLVideoElement) {
          const exact = inCallback.has(image) && clocks.has(image);
          captures.push({
            time: exact ? clocks.get(image) : image.currentTime,
            source: exact ? "requestVideoFrameCallback" : "seek target; decoded pose unverified",
            ...(exact
              ? {}
              : {
                  lastCallbackTime: clocks.get(image),
                  ended: image.ended,
                  paused: image.paused,
                  seeking: image.seeking,
                }),
          });
        }
        return originalDraw.call(this, image, ...args);
      };
      let options;
      const progress = setInterval(() => globalThis.__truthStatus?.(m.MOVING.status), 2000);
      try {
        options = await m.MOVING_PHOTO.input.read(null, "truth.mp4", file);
      } finally {
        clearInterval(progress);
        if (originalCallback) videoPrototype.requestVideoFrameCallback = originalCallback;
        canvasPrototype.drawImage = originalDraw;
      }
      if (render) {
        await globalThis.__truthStatus?.("Preparing the custom Moving photo renderer");
        const { app, player } = window.__splashery;
        const scene = structuredClone(player.scene);
        scene.toy = {
          kind: "builtin",
          id: "moving-photo-3d",
          options: { ...options, depth: 0, view: "sharp", detail: "photo" },
        };
        scene.motion.controls = {};
        await app.applyScene(scene);
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
      if (captures.length !== times.length)
        throw new Error("Decoded frame timestamp observation is incomplete");
      return { w: clip.w, h: clip.h, times, captures };
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

export async function prepareNovel(page, toy) {
  await page.evaluate(async (toy) => {
    const { app, player } = window.__splashery;
    if (toy === "photo") player.motion.setControl("flat", 0, { snap: true });
    else {
      await app.setToyOptions({ depth: 0.6 });
      player.motion.setControl("play", 0, { snap: true });
      await (await import("/src/packs/moving-photo.js")).movingTransport.seek(0);
    }
    player.idle.weight = 0;
    player.camera.setTurntable(false);
  }, toy);
}

export async function captureNovel(page, toy, base, target, median) {
  return page.evaluate(
    async ({ toy, base, target, median }) => {
      const { calibratedCamera } = await import("/tools/studio-truth/novel.mjs");
      const pc = await import("/src/pc.js");
      const { player } = window.__splashery;
      const recipe =
        toy === "photo"
          ? (await import("/src/packs/photo-3d.js")).RECIPES["photo-3d"]
          : (await import("/src/packs/moving-photo.js")).MOVING_PHOTO;
      const rect = recipe.photo.rect();
      const pose = calibratedCamera(base, target, median, rect[3] - rect[1]);
      const position = player.fromRecipe(pose.position);
      const origin = player.fromRecipe([0, 0, 0]);
      const basis = [0, 1, 2].map((axis) => {
        const unit = [0, 0, 0];
        unit[axis] = 1;
        const p = player.fromRecipe(unit).map((v, i) => v - origin[i]);
        const length = Math.hypot(...p);
        return p.map((v) => v / length);
      });
      const axis = (column) =>
        [0, 1, 2].map((r) =>
          [0, 1, 2].reduce((sum, c) => sum + basis[c][r] * pose.rotation[c][column], 0),
        );
      const up = axis(1),
        back = axis(2);
      const matrix = new pc.Mat4().setLookAt(
        new pc.Vec3(...position),
        new pc.Vec3(...position.map((v, i) => v - back[i])),
        new pc.Vec3(...up),
      );
      const q = new pc.Quat().setFromMat4(matrix);
      const oldPose = player.camera.pose;
      player.camera.pose = () => ({
        position,
        rotation: [q.x, q.y, q.z, q.w],
        fov: pose.fov,
        distance: Math.hypot(...position),
      });
      const st = player.stage;
      st.setFixedSize([640, 360]);
      st.setClearColor([0, 0, 0], 0);
      try {
        for (let i = 0; i < 3; i++) await st.captureFrame();
        const canvas = await st.captureFrame();
        const data = Array.from(canvas.getContext("2d").getImageData(0, 0, 640, 360).data);
        return {
          w: 640,
          h: 360,
          data,
          png: canvas.toDataURL("image/png").split(",")[1],
          camera: pose,
        };
      } finally {
        player.camera.pose = oldPose;
        st.setFixedSize(null);
      }
    },
    { toy, base, target, median },
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
