// The PlayCanvas side: graphics device, app, camera, the toy entity, the
// effect modifier, paint, picking and frame capture. Everything that touches
// the engine directly lives here or in paint.js / loaders.js.

import * as pc from "./pc.js";
import { MODIFIER } from "./effects.js";

export class NoGPUError extends Error {}

// Picks the device order: "webgpu", "webgl2" or "auto" (WebGPU when the
// browser offers a working adapter, WebGL2 otherwise). Probing first avoids
// a failed WebGPU canvas on browsers that expose the API but cannot use it.
let adapterProbe = null;
async function hasWebGPU() {
  if (!navigator.gpu) return false;
  adapterProbe ||= navigator.gpu.requestAdapter().then(
    (a) => !!a,
    () => false,
  );
  return adapterProbe;
}

async function deviceOrder(prefer) {
  if (prefer === "webgl2") return [pc.DEVICETYPE_WEBGL2];
  if (prefer === "webgpu") return [pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2];
  return (await hasWebGPU())
    ? [pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2]
    : [pc.DEVICETYPE_WEBGL2];
}

export class Stage {
  static async create(canvas, { prefer = "auto", weak = false } = {}) {
    // ?renderer=none shows the no-GPU fallback (used by the tests).
    if (prefer === "none") throw new NoGPUError("Rendering was switched off with ?renderer=none.");
    let device;
    try {
      device = await pc.createGraphicsDevice(canvas, {
        deviceTypes: await deviceOrder(prefer),
        antialias: false,
        alpha: true,
        depth: true,
        powerPreference: "high-performance",
      });
    } catch (err) {
      throw new NoGPUError(err?.message || "No graphics device");
    }
    if (!device || device.deviceType === "null" || device.isNull) {
      device?.destroy?.();
      throw new NoGPUError("Neither WebGPU nor WebGL2 is available.");
    }
    return new Stage(canvas, device, { weak });
  }

  constructor(canvas, device, { weak }) {
    this.canvas = canvas;
    this.device = device;
    this.weak = weak;
    device.maxPixelRatio = Math.min(window.devicePixelRatio || 1, weak ? 1 : 1.5);

    const app = new pc.AppBase(canvas);
    const opts = new pc.AppOptions();
    opts.graphicsDevice = device;
    opts.componentSystems = [pc.CameraComponentSystem, pc.GSplatComponentSystem];
    opts.resourceHandlers = [pc.TextureHandler, pc.GSplatHandler];
    app.init(opts);
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.autoRender = false;
    this.app = app;
    if (weak) app.scene.gsplat.splatBudget = 1500000;

    this.cameraEntity = new pc.Entity("camera");
    this.cameraEntity.addComponent("camera", {
      clearColor: new pc.Color(1, 1, 1, 1),
      fov: 38,
      nearClip: 0.02,
      farClip: 200,
    });
    app.root.addChild(this.cameraEntity);

    this.toy = null; // { entity, resource, asset, container, owned }
    this.picker = null;
    this.captureWaiters = [];
    this.updateHandlers = [];
    this.frames = 0;
    this.lastFrameMs = [];
    this.lastRender = performance.now();

    // Rendering is on demand, but splat sorting finishes on a worker a few
    // frames after a change, so every request keeps frames coming briefly.
    this.aliveUntil = 0;
    app.on("update", (dt) => {
      for (const fn of this.updateHandlers) fn(dt);
      if (performance.now() < this.aliveUntil) app.renderNextFrame = true;
    });
    this.graveyard = [];
    app.on("frameend", () => {
      this.frames++;
      if (this.graveyard.length) {
        this.buryToys();
        this.requestRender();
      }
      const now = performance.now();
      this.lastFrameMs.push(now - this.lastRender);
      if (this.lastFrameMs.length > 60) this.lastFrameMs.shift();
      this.lastRender = now;
      if (this.captureWaiters.length) {
        const waiters = this.captureWaiters;
        this.captureWaiters = [];
        for (const w of waiters) w(this.copyCanvas(w.width, w.height));
      }
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.fixedSize = null;
    app.start();
  }

  get deviceType() {
    return this.device.isWebGPU ? "webgpu" : "webgl2";
  }

  onUpdate(fn) {
    this.updateHandlers.push(fn);
  }

  requestRender(keepAliveMs = 1000) {
    this.app.renderNextFrame = true;
    this.aliveUntil = Math.max(this.aliveUntil, performance.now() + keepAliveMs);
  }

  // The canvas size comes from CSS. app.resizeCanvas() would pin it with
  // inline pixel sizes (and then CSS changes, such as the phone sheet opening
  // or the window resizing, would never reach it), so only the drawing-buffer
  // resolution follows the element here.
  resize() {
    if (this.fixedSize) return;
    this.canvas.style.removeProperty("width");
    this.canvas.style.removeProperty("height");
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.requestRender();
  }

  // Renders at an exact pixel size (exports), or back to the element size.
  setFixedSize(size) {
    const device = this.device;
    if (size) {
      if (!this.fixedSize) this.savedPixelRatio = device.maxPixelRatio;
      device.maxPixelRatio = 1;
      this.fixedSize = size;
      this.app.setCanvasResolution(pc.RESOLUTION_FIXED, size[0], size[1]);
    } else {
      if (this.fixedSize) device.maxPixelRatio = this.savedPixelRatio;
      this.fixedSize = null;
      this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
      this.resize();
    }
    this.requestRender();
  }

  setClearColor(rgb, alpha) {
    const cam = this.cameraEntity.camera;
    cam.clearColor = new pc.Color(rgb[0], rgb[1], rgb[2], alpha);
    this.requestRender();
  }

  setCameraPose(pose) {
    const e = this.cameraEntity;
    // The field of view applies to the narrower side, so tall canvases fit too.
    const portrait = this.canvas.width < this.canvas.height;
    if (e.camera.horizontalFov !== portrait) e.camera.horizontalFov = portrait;
    e.setPosition(pose.position[0], pose.position[1], pose.position[2]);
    e.setRotation(
      new pc.Quat(pose.rotation[0], pose.rotation[1], pose.rotation[2], pose.rotation[3]),
    );
  }

  // ---- Toy ----------------------------------------------------------------

  // Shows a gsplat resource as the toy. transform: { position, rotation
  // (euler degrees), scale } normalises it around the origin.
  setToy({ resource, asset = null, owned = false, transform = null }) {
    this.clearToy();
    const entity = new pc.Entity("toy");
    if (transform) {
      entity.setLocalPosition(...transform.position);
      entity.setLocalEulerAngles(...transform.rotation);
      entity.setLocalScale(transform.scale, transform.scale, transform.scale);
    }
    // Paint lives in a per-instance stream the modifier reads.
    if (!resource.format.getStream("paintColor")) {
      resource.format.addExtraStreams([
        { name: "paintColor", format: pc.PIXELFORMAT_RGBA8, storage: pc.GSPLAT_STREAM_INSTANCE },
      ]);
    }
    entity.addComponent("gsplat", asset ? { asset } : { resource });
    // Create (and clear) the paint texture now, so the very first work-buffer
    // pass already has it bound.
    const paint = entity.gsplat.getInstanceTexture("paintColor");
    if (paint) {
      paint.lock().fill(0);
      paint.unlock();
    }
    entity.gsplat.setWorkBufferModifier(MODIFIER);
    entity.gsplat.workBufferUpdate = pc.WORKBUFFER_UPDATE_ALWAYS;
    this.app.root.addChild(entity);
    this.toy = { entity, resource, asset, owned };
    this.requestRender();
    return this.toy;
  }

  // The old toy is switched off now and freed a few frames later: the
  // engine's work-buffer manager still references it until it reconciles.
  clearToy() {
    const t = this.toy;
    if (!t) return;
    this.toy = null;
    t.entity.enabled = false;
    t.frames = 3;
    this.graveyard.push(t);
    this.requestRender();
  }

  buryToys(all = false) {
    const keep = [];
    for (const t of this.graveyard) {
      if (!all && --t.frames > 0) {
        keep.push(t);
        continue;
      }
      t.entity.destroy();
      if (t.asset) {
        t.asset.unload();
        this.app.assets.remove(t.asset);
      } else if (t.owned) {
        t.resource.destroy?.();
      }
    }
    this.graveyard = keep;
  }

  setUniforms(u) {
    const g = this.toy?.entity.gsplat;
    if (!g) return;
    for (const k in u) g.setParameter(k, u[k]);
  }

  // Model <-> world for the toy entity.
  worldToModel(p) {
    const m = this.toy.entity.getWorldTransform().clone().invert();
    const out = new pc.Vec3();
    m.transformPoint(new pc.Vec3(p[0], p[1], p[2]), out);
    return [out.x, out.y, out.z];
  }

  modelScale() {
    return this.toy ? this.toy.entity.getLocalScale().x : 1;
  }

  // ---- Picking --------------------------------------------------------------

  // Renders the pick buffer at half resolution. Call when the view changed.
  preparePick() {
    if (!this.toy) return;
    if (!this.picker) this.picker = new pc.Picker(this.app, 1, 1, true);
    const w = Math.max(1, Math.floor(this.canvas.width / 2));
    const h = Math.max(1, Math.floor(this.canvas.height / 2));
    this.picker.resize(w, h);
    const layer = this.app.scene.layers.getLayerByName("World");
    this.picker.prepare(this.cameraEntity.camera, this.app.scene, [layer]);
    this.pickScale = [w / this.canvas.clientWidth, h / this.canvas.clientHeight];
  }

  // Client (CSS pixel) coordinates relative to the canvas -> world point.
  async pick(x, y) {
    if (!this.picker || !this.toy) return null;
    const p = await this.picker.getWorldPointAsync(x * this.pickScale[0], y * this.pickScale[1]);
    return p ? [p.x, p.y, p.z] : null;
  }

  // Ray from the camera through a canvas point.
  ray(x, y) {
    const cam = this.cameraEntity.camera;
    const near = new pc.Vec3();
    const far = new pc.Vec3();
    cam.screenToWorld(x, y, cam.nearClip, near);
    cam.screenToWorld(x, y, cam.farClip, far);
    const d = new pc.Vec3().sub2(far, near).normalize();
    return { origin: [near.x, near.y, near.z], dir: [d.x, d.y, d.z] };
  }

  // ---- Capture ------------------------------------------------------------

  // Resolves with a 2D canvas copy of the next rendered frame.
  captureFrame(width, height) {
    return new Promise((resolve) => {
      const w = (c) => resolve(c);
      w.width = width;
      w.height = height;
      this.captureWaiters.push(w);
      this.requestRender();
    });
  }

  copyCanvas(width, height) {
    const src = this.canvas;
    const out = document.createElement("canvas");
    out.width = width || src.width;
    out.height = height || src.height;
    const ctx = out.getContext("2d");
    ctx.drawImage(src, 0, 0, out.width, out.height);
    return out;
  }

  destroy() {
    this.resizeObserver.disconnect();
    this.clearToy();
    this.buryToys(true);
    this.picker?.destroy();
    this.app.destroy();
  }
}
