// The PlayCanvas side of a world: the graphics device, the app, the camera,
// splat containers made from SplatBuffers, and (lighting.js, hybrid.js) the
// sun, the haze and the lit models of hybrid mode. The engine's unified
// splat mode (on by default in 2.22) sorts each layer's splats together, so
// props and the character's parts blend correctly.
//
// Layers, drawn in this order: the world's opaque models (the hybrid
// ground, sign boards, the depth-only ground of splats mode), the sky, the
// ground layer's splats (ground, grass, splat water), the shadow catcher,
// then the world layer's splats (props, the character) and see-through
// models (the hybrid water). Splats test against the models' depth, so a
// hill hides the tree behind it in both modes.

import * as pc from "../pc.js";
import { kernelChunks, normalizeKernel } from "../kernels.js";

export class NoGPUError extends Error {}

// WebGPU when the browser offers a working adapter, WebGL2 otherwise (as the
// toy player picks, src/stage.js).
async function hasWebGPU() {
  if (!navigator.gpu) return false;
  try {
    return !!(await navigator.gpu.requestAdapter());
  } catch {
    return false;
  }
}

export class WorldView {
  static async create(canvas, { prefer = "auto" } = {}) {
    if (prefer === "none") throw new NoGPUError("Rendering was switched off with ?renderer=none.");
    const types =
      prefer === "webgl2"
        ? [pc.DEVICETYPE_WEBGL2]
        : prefer === "webgpu"
          ? [pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2]
          : (await hasWebGPU())
            ? [pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2]
            : [pc.DEVICETYPE_WEBGL2];
    let device;
    try {
      device = await pc.createGraphicsDevice(canvas, {
        deviceTypes: types,
        antialias: false,
        alpha: false,
        depth: true,
        powerPreference: "high-performance",
      });
    } catch (err) {
      throw new NoGPUError(err?.message || "No graphics device");
    }
    if (!device || device.isNull) throw new NoGPUError("Neither WebGPU nor WebGL2 is available.");
    return new WorldView(canvas, device);
  }

  constructor(canvas, device) {
    this.canvas = canvas;
    this.device = device;
    device.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.kernel = "gaussian";
    const app = new pc.AppBase(canvas);
    const opts = new pc.AppOptions();
    opts.graphicsDevice = device;
    opts.componentSystems = [pc.CameraComponentSystem, pc.GSplatComponentSystem, pc.RenderComponentSystem, pc.LightComponentSystem, pc.AnimComponentSystem]; // prettier-ignore
    opts.resourceHandlers = [pc.TextureHandler, pc.GSplatHandler, pc.ContainerHandler, pc.AnimClipHandler, pc.AnimStateGraphHandler]; // prettier-ignore
    app.init(opts);
    // Three layers draw after the opaque models and before the world
    // layer's see-through pass (props and the character): the splat sky,
    // the ground's splats, and the surface (the shadow catcher, or the
    // hybrid water).
    const layers = app.scene.layers;
    const world = layers.getLayerByName("World");
    this.skyLayer = new pc.Layer({ name: "WdSky" });
    this.groundLayer = new pc.Layer({ name: "WdGround" });
    this.surfaceLayer = new pc.Layer({ name: "WdSurface" });
    const at = layers.getTransparentIndex(world);
    layers.insertTransparent(this.skyLayer, at);
    layers.insertTransparent(this.groundLayer, at + 1);
    layers.insertTransparent(this.surfaceLayer, at + 2);
    this.worldLayer = world;
    // The splat sky is as far as it looks: no haze on it.
    app.systems.gsplat.on("material:created", (mat, cam, layer) => {
      if (layer === this.skyLayer) {
        mat.setDefine("GSPLAT_NO_FOG", "");
        mat.update();
      }
    });
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app = app;
    this.format = pc.GSplatFormat.createDefaultFormat(device);

    this.camera = new pc.Entity("world-camera");
    this.camera.addComponent("camera", {
      clearColor: new pc.Color(0.86, 0.93, 1, 1),
      fov: 55,
      nearClip: 0.1,
      farClip: 600,
      layers: [world.id, layers.getLayerByName("Depth").id, layers.getLayerByName("Skybox").id, this.skyLayer.id, this.groundLayer.id, this.surfaceLayer.id, layers.getLayerByName("Immediate").id, layers.getLayerByName("UI").id], // prettier-ignore
    });
    app.root.addChild(this.camera);
    this.frameMs = [];
    this.lastFrame = performance.now();
    app.on("frameend", () => {
      const now = performance.now();
      this.frameMs.push(now - this.lastFrame);
      if (this.frameMs.length > 120) this.frameMs.shift();
      // Draw calls this frame (the stats overlay).
      this.drawCalls = app.graphicsDevice._drawCallsPerFrame ?? 0;
      this.lastFrame = now;
      if (this.captureWaiters?.length) {
        const w = this.captureWaiters;
        this.captureWaiters = [];
        for (const fn of w) fn();
      }
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    app.start();
  }

  get deviceType() {
    return this.device.isWebGPU ? "webgpu" : "webgl2";
  }

  // The most device pixels per CSS pixel (lane Sharpness, #107: a 3x phone
  // drawn at 3x has narrower edges and less speckle, at about twice the
  // cost, so the tiers choose; see WORLD_BUDGETS).
  setPixelRatio(cap) {
    this.device.maxPixelRatio = Math.min(window.devicePixelRatio || 1, cap);
    this.resize();
  }

  // The splat falloff (lane Lab's kernels, src/kernels.js): "sharp" has a
  // flatter top and a steeper edge, so near ground reads crisper.
  setKernel(name) {
    const want = normalizeKernel(name);
    if (want === this.kernel) return;
    const mat = this.app.scene.gsplat.material;
    const code = kernelChunks(want);
    mat.shaderChunks.glsl.set("gsplatModifyPS", code.glsl);
    mat.shaderChunks.wgsl.set("gsplatModifyPS", code.wgsl);
    mat.update();
    this.kernel = want;
  }

  resize() {
    this.canvas.style.removeProperty("width");
    this.canvas.style.removeProperty("height");
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
  }

  onUpdate(fn) {
    this.app.on("update", fn);
  }

  setClearColor(c) {
    this.camera.camera.clearColor = new pc.Color(c[0], c[1], c[2], 1);
  }

  // The field of view applies to the narrower side, so phones held upright
  // see as wide as a computer.
  setCameraPose(pos, target) {
    const e = this.camera;
    const portrait = this.canvas.width < this.canvas.height;
    if (e.camera.horizontalFov !== portrait) {
      e.camera.horizontalFov = portrait;
      e.camera.fov = portrait ? 62 : 55;
    }
    e.setPosition(pos[0], pos[1], pos[2]);
    e.lookAt(target[0], target[1], target[2]);
  }

  // A splat container from a SplatBuffer (positions, scales, rotations as
  // [x, y, z, w] and linear colors with opacity).
  container(buf) {
    const half = pc.FloatPacking.float2Half;
    const n = Math.max(1, buf.count);
    const ct = new pc.GSplatContainer(this.device, n, this.format);
    const tc = ct.getTexture("dataCenter");
    const tcol = ct.getTexture("dataColor");
    const ts = ct.getTexture("dataScale");
    const tr = ct.getTexture("dataRotation");
    const center = tc.lock();
    const color = tcol.lock();
    const scale = ts.lock();
    const rot = tr.lock();
    const centers = ct.centers;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < buf.count; i++) {
      const i3 = i * 3;
      const i4 = i * 4;
      for (let a = 0; a < 3; a++) {
        const v = buf.pos[i3 + a];
        center[i4 + a] = centers[i3 + a] = v;
        if (v < min[a]) min[a] = v;
        if (v > max[a]) max[a] = v;
      }
      center[i4 + 3] = 0;
      color[i4] = half(buf.color[i4]);
      color[i4 + 1] = half(buf.color[i4 + 1]);
      color[i4 + 2] = half(buf.color[i4 + 2]);
      color[i4 + 3] = half(buf.color[i4 + 3]);
      scale[i4] = half(buf.scale[i3]);
      scale[i4 + 1] = half(buf.scale[i3 + 1]);
      scale[i4 + 2] = half(buf.scale[i3 + 2]);
      scale[i4 + 3] = 0;
      // Stored as (w, x, y, z).
      rot[i4] = half(buf.rot[i4 + 3]);
      rot[i4 + 1] = half(buf.rot[i4]);
      rot[i4 + 2] = half(buf.rot[i4 + 1]);
      rot[i4 + 3] = half(buf.rot[i4 + 2]);
    }
    tc.unlock();
    tcol.unlock();
    ts.unlock();
    tr.unlock();
    if (!buf.count) {
      min.fill(0);
      max.fill(0);
    }
    const pad = 0.5;
    const aabb = new pc.BoundingBox();
    aabb.setMinMax(new pc.Vec3(min[0] - pad, min[1] - pad, min[2] - pad), new pc.Vec3(max[0] + pad, max[1] + pad, max[2] + pad)); // prettier-ignore
    ct.aabb = aabb;
    ct.update(buf.count, true);
    ct.splatCount = buf.count;
    return ct;
  }

  // A splat entity showing a container. `parent` defaults to the scene root.
  // `layer` is "world" (props, the character), "ground" or "sky";
  // `shadows` makes it cast shadows.
  entity(
    name,
    container,
    { pos = [0, 0, 0], yaw = 0, scale = 1, parent = null, layer = "world", shadows = false } = {},
  ) {
    // prettier-ignore
    const e = new pc.Entity(name);
    const L = { world: this.worldLayer, ground: this.groundLayer, sky: this.skyLayer }[layer];
    e.addComponent("gsplat", { resource: container, castShadows: shadows, layers: [L.id] });
    e.setLocalPosition(pos[0], pos[1], pos[2]);
    if (yaw) e.setLocalEulerAngles(0, yaw, 0);
    if (scale !== 1) e.setLocalScale(scale, scale, scale);
    (parent || this.app.root).addChild(e);
    return e;
  }

  // Gentle waves on a water entity: its splats rise and fall a few
  // centimeters and catch the light on the crests, moving over the whole
  // sea as one (origin: the chunk's corner, so neighbors line up). Its
  // uWdWave uniform carries the time (x); the world sets it every frame.
  waves(entity, origin) {
    const g = entity.gsplat;
    g.setWorkBufferModifier(WAVES);
    g.workBufferUpdate = pc.WORKBUFFER_UPDATE_ALWAYS;
    g.setParameter("uWdOrigin", [origin[0], origin[1], 0, 0]);
    g.setParameter("uWdWave", [0, 1, 0, 0]);
  }

  // An empty entity (a joint of the character, say).
  group(name, parent = null) {
    const e = new pc.Entity(name);
    (parent || this.app.root).addChild(e);
    return e;
  }

  // Where a world point shows on the canvas, in CSS pixels ([x, y, in
  // front]).
  toScreen(p) {
    const out = new pc.Vec3();
    this.camera.camera.worldToScreen(new pc.Vec3(p[0], p[1], p[2]), out);
    return [out.x, out.y, out.z > 0];
  }

  // Resolves after the next rendered frame.
  nextFrame() {
    return new Promise((resolve) => (this.captureWaiters ||= []).push(resolve));
  }

  destroy() {
    this.resizeObserver.disconnect();
    this.app.destroy();
  }
}

const WAVE_GLSL = /* glsl */ `
uniform vec4 uWdWave;   // x time (s)
uniform vec4 uWdOrigin; // xy the chunk's corner (x, z)
float wdWave(vec3 c) {
  vec2 p = c.xz + uWdOrigin.xy;
  float t = uWdWave.x;
  return 0.55 * sin(p.x * 0.55 + p.y * 0.21 + t * 1.25) + 0.45 * sin(p.y * 0.83 - p.x * 0.34 - t * 1.6);
}
void modifySplatCenter(inout vec3 center) {
  center.y += 0.035 * wdWave(center);
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
}
void modifySplatColor(vec3 center, inout vec4 color) {
  float w = wdWave(center);
  color.rgb *= 1.0 + 0.07 * w;
  color.rgb += vec3(0.05) * smoothstep(0.75, 1.0, w);
}
`;

const WAVE_WGSL = /* wgsl */ `
uniform uWdWave: vec4f;
uniform uWdOrigin: vec4f;
fn wdWave(c: vec3f) -> f32 {
  let p = c.xz + uniform.uWdOrigin.xy;
  let t = uniform.uWdWave.x;
  return 0.55 * sin(p.x * 0.55 + p.y * 0.21 + t * 1.25) + 0.45 * sin(p.y * 0.83 - p.x * 0.34 - t * 1.6);
}
fn modifySplatCenter(center: ptr<function, vec3f>) {
  (*center).y = (*center).y + 0.035 * wdWave(*center);
}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  let w = wdWave(center);
  var rgb = (*color).rgb * (1.0 + 0.07 * w);
  rgb = rgb + vec3f(0.05) * smoothstep(0.75, 1.0, w);
  *color = vec4f(rgb, (*color).a);
}
`;

const WAVES = { glsl: WAVE_GLSL, wgsl: WAVE_WGSL };
