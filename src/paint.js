// GPU paint system: wet and dry layers in a ping-pong pair of MRT render
// targets, seam-safe instanced stamps computed in 3D, a per-frame wet
// simulation (gravity advection along the surface, diffusion, drying),
// snapshots for export, and an undo stack of compressed 8-bit snapshots.

import {
  Color,
  CustomBlending,
  DataTexture,
  GLSL3,
  HalfFloatType,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NoBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  Texture,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  Float32BufferAttribute,
  Uint16BufferAttribute,
} from "three";
import { makeSplash, SPLASH_SPEED_THRESHOLD, SPLASH_COOLDOWN_MS } from "./splash.js";
import { mulberry32, DEFAULT_PHYSICS } from "./state.js";
import { NOISE_GLSL } from "./templates.js";

const MAX_STAMPS = 8192;
const UNDO_MAX_STEPS = 60;

const SRGB_GLSL = /* glsl */ `
  vec3 srgbEncode(vec3 c) {
    c = clamp(c, 0.0, 1.0);
    return mix(pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055, c * 12.92, step(c, vec3(0.0031308)));
  }
  vec3 srgbDecode(vec3 c) {
    return mix(pow((c + 0.055) / 1.055, vec3(2.4)), c / 12.92, step(c, vec3(0.04045)));
  }
`;

const FULLSCREEN_VERT = /* glsl */ `
  precision highp float;
  in vec3 position;
  in vec2 uv;
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const STAMP_VERT = /* glsl */ `
  precision highp float;
  in vec3 position;
  in vec4 iRect;
  in vec3 iCenter;
  in vec4 iColor;
  in vec3 iParams;
  out vec2 vUv;
  flat out vec3 vCenter;
  flat out vec4 vColor;
  flat out vec3 vParams;
  void main() {
    vec2 uv = mix(iRect.xy, iRect.zw, position.xy);
    vUv = uv;
    vCenter = iCenter;
    vColor = iColor;
    vParams = iParams;
    gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  }
`;

const STAMP_FRAG = /* glsl */ `
  precision highp float;
  in vec2 vUv;
  flat in vec3 vCenter;
  flat in vec4 vColor;
  flat in vec3 vParams;
  layout(location = 0) out vec4 outWet;
  layout(location = 1) out vec4 outDry;
  __SHAPE__
  void main() {
    vec3 P = shapePosition(vUv);
    float rc = 2.0 * sin(vParams.x * 0.5);
    float d = length(P - vCenter) / max(rc, 1e-6);
    float fall = 1.0 - smoothstep(vParams.z, 1.0, d);
    if (fall <= 0.0005) discard;
    float da = vColor.a * fall;
    float wa = vColor.a * vParams.y * fall;
    outWet = vec4(vColor.rgb * wa, wa);
    outDry = vec4(vColor.rgb * da, da);
  }
`;

const SIM_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uWet;
  uniform sampler2D uDry;
  uniform sampler2D uFlowMap;
  uniform vec2 uTexel;
  uniform vec3 uGravity;
  uniform float uDt;
  uniform float uFlow;
  uniform float uDryRate;
  uniform float uDiffuse;
  uniform float uTrail;
  in vec2 vUv;
  layout(location = 0) out vec4 outWet;
  layout(location = 1) out vec4 outDry;
  __SHAPE__
  __FRAME__
  // Thin films stick; thick paint runs, and runs faster the thicker it is.
  float mobility(float a) {
    return smoothstep(0.04, 0.5, a) * (0.45 + 0.55 * min(1.0, a / 0.7));
  }
  void main() {
    vec3 P = shapePosition(vUv);
    vec3 N = normalize(P);
    vec3 dPdu, dPdv;
    shapeFrame(vUv, dPdu, dPdv);
    vec3 gt = uGravity - N * dot(uGravity, N);
    float lu = max(dot(dPdu, dPdu), 1e-5);
    float lv = max(dot(dPdv, dPdv), 1e-5);
    vec2 dir = vec2(dot(gt, dPdu) / lu, dot(gt, dPdv) / lv);
    // Static per-texel variation so a band of paint breaks into fingers.
    vec2 fm = texture(uFlowMap, vUv).rg;
    float speedMul = 0.3 + 1.2 * fm.x;
    vec2 stepUV = dir * uFlow * speedMul * uDt;
    vec2 maxStep = uTexel * max(3.0, 180.0 * uDt);
    stepUV = clamp(stepUV, -maxStep, maxStep);
    vec4 here = texture(uWet, vUv);
    vec4 up = texture(uWet, vUv - stepUV);
    float m = mobility(max(here.a, up.a * 0.9));
    vec2 src = vUv - stepUV * m;
    vec4 w = texture(uWet, src);
    vec4 nb = texture(uWet, src + vec2(uTexel.x, 0.0)) + texture(uWet, src - vec2(uTexel.x, 0.0)) +
      texture(uWet, src + vec2(0.0, uTexel.y)) + texture(uWet, src - vec2(0.0, uTexel.y));
    w = mix(w, nb * 0.25, uDiffuse);
    vec4 d = texture(uDry, vUv);
    // Paint that moves on leaves a thin coat behind: the drip trail.
    float lost = max(0.0, here.a - w.a);
    if (lost > 1e-5 && here.a > 1e-4) {
      vec4 dep = here * (lost / here.a) * uTrail * (0.7 + 0.6 * fm.y);
      d = dep + d * (1.0 - dep.a);
    }
    if (w.a > 1e-5) {
      float da = min(w.a, uDryRate * uDt);
      vec4 tr = w * (da / w.a);
      d = tr + d * (1.0 - tr.a);
      w -= tr;
    }
    if (w.a < 0.002) w = vec4(0.0);
    outWet = w;
    outDry = clamp(d, 0.0, 1.0);
  }
`;

// Converts one premultiplied linear layer into unpremultiplied sRGB 8-bit.
const ENCODE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uSrc;
  in vec2 vUv;
  out vec4 outColor;
  ${SRGB_GLSL}
  void main() {
    vec4 c = texture(uSrc, vUv);
    vec3 rgb = c.a > 1e-5 ? c.rgb / c.a : vec3(0.0);
    outColor = vec4(srgbEncode(rgb), clamp(c.a, 0.0, 1.0));
  }
`;

// Writes both layers from source textures. uDecode = 1 for 8-bit sRGB
// unpremultiplied sources, 0 for half-float premultiplied sources.
const RESTORE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uWetSrc;
  uniform sampler2D uDrySrc;
  uniform int uDecode;
  uniform float uHasWet;
  in vec2 vUv;
  layout(location = 0) out vec4 outWet;
  layout(location = 1) out vec4 outDry;
  ${SRGB_GLSL}
  vec4 load(sampler2D s) {
    vec4 c = texture(s, vUv);
    if (uDecode == 1) return vec4(srgbDecode(c.rgb) * c.a, c.a);
    return c;
  }
  void main() {
    outDry = load(uDrySrc);
    outWet = uHasWet > 0.5 ? load(uWetSrc) : vec4(0.0);
  }
`;

// Static noise field sampled by the simulation: r = flow speed variation
// (fingering), g = trail deposit variation.
const FLOW_FRAG = /* glsl */ `
  precision highp float;
  precision highp int;
  uniform uint uSeed;
  in vec2 vUv;
  out vec4 outColor;
  __SHAPE__
  __NOISE__
  void main() {
    vec3 P = normalize(shapePosition(vUv));
    float n1 = gnoise(P * 26.0);
    float n2 = gnoise(P * 80.0 + 3.0);
    float n3 = gnoise(P * 9.0 + 11.0);
    float fingers = clamp(0.5 + 0.7 * n1 + 0.35 * n2, 0.0, 1.0);
    fingers = pow(fingers, 1.6);
    float trail = clamp(0.5 + 0.7 * n3, 0.0, 1.0);
    outColor = vec4(fingers, trail, 0.0, 1.0);
  }
`;

function makeQuadGeometry() {
  const geo = new InstancedBufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
  geo.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
  return geo;
}

async function compressBytes(bytes) {
  if (typeof CompressionStream === "undefined") return { data: bytes.buffer, raw: true };
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return { data: await new Response(stream).arrayBuffer(), raw: false };
}

async function decompressBytes(entry) {
  if (entry.raw) return new Uint8Array(entry.data);
  const stream = new Blob([entry.data])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export class PaintSystem {
  constructor(renderer, shape, options = {}) {
    this.renderer = renderer;
    this.shape = shape;
    this.resolution = options.resolution || 2048;
    this.mipmaps = options.mipmaps !== false;
    this.undoBudgetBytes = options.undoBudgetBytes || 256 * 1024 * 1024;
    this.physics = { ...DEFAULT_PHYSICS };
    this.simClock = 0;
    this.wetUntil = -1;
    this.strokeCount = 0;
    this.undoStack = [];
    this.undoBytes = 0;
    this._encodePool = [];
    this._pendingStamps = [];
    this._stampCount = 0;
    this._stroke = null;
    this._scene = new Scene();
    this._camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._fsGeo = new PlaneGeometry(2, 2);
    this._blank = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, RGBAFormat, UnsignedByteType);
    this._blank.needsUpdate = true;
    this._buildMaterials();
    this._createTargets(this.resolution);
    this.clear();
  }

  get width() {
    return this.resolution;
  }

  get height() {
    return this.resolution;
  }

  get texelAngle() {
    return this.shape.circumference / this.resolution;
  }

  get wetTexture() {
    return this._targets[this._current].textures[0];
  }

  get dryTexture() {
    return this._targets[this._current].textures[1];
  }

  get hasWet() {
    return this.simClock < this.wetUntil;
  }

  _buildMaterials() {
    const shapeGlsl = this.shape.glsl.position;
    this._stampGeo = makeQuadGeometry();
    this._stampRect = new InstancedBufferAttribute(new Float32Array(MAX_STAMPS * 4), 4);
    this._stampCenter = new InstancedBufferAttribute(new Float32Array(MAX_STAMPS * 3), 3);
    this._stampColor = new InstancedBufferAttribute(new Float32Array(MAX_STAMPS * 4), 4);
    this._stampParams = new InstancedBufferAttribute(new Float32Array(MAX_STAMPS * 3), 3);
    for (const a of [this._stampRect, this._stampCenter, this._stampColor, this._stampParams]) {
      a.setUsage(35048); // DynamicDrawUsage
    }
    this._stampGeo.setAttribute("iRect", this._stampRect);
    this._stampGeo.setAttribute("iCenter", this._stampCenter);
    this._stampGeo.setAttribute("iColor", this._stampColor);
    this._stampGeo.setAttribute("iParams", this._stampParams);
    this._stampGeo.instanceCount = 0;
    this._stampMaterial = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: STAMP_VERT,
      fragmentShader: STAMP_FRAG.replace("__SHAPE__", shapeGlsl),
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendSrcAlpha: OneFactor,
      blendDstAlpha: OneMinusSrcAlphaFactor,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this._stampMesh = new Mesh(this._stampGeo, this._stampMaterial);
    this._stampMesh.frustumCulled = false;

    this._simMaterial = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: SIM_FRAG.replace("__SHAPE__", shapeGlsl).replace(
        "__FRAME__",
        this.shape.glsl.frame,
      ),
      uniforms: {
        uWet: { value: null },
        uDry: { value: null },
        uTexel: { value: new Vector2() },
        uGravity: { value: new Vector3(0, -1, 0) },
        uDt: { value: 1 / 60 },
        uFlow: { value: 0.15 },
        uDryRate: { value: 0.25 },
        uDiffuse: { value: 0.06 },
        uFlowMap: { value: null },
        uTrail: { value: 0.45 },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    this._simMesh = new Mesh(this._fsGeo, this._simMaterial);
    this._simMesh.frustumCulled = false;

    this._encodeMaterial = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: ENCODE_FRAG,
      uniforms: { uSrc: { value: null } },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    this._encodeMesh = new Mesh(this._fsGeo, this._encodeMaterial);
    this._encodeMesh.frustumCulled = false;

    this._restoreMaterial = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: RESTORE_FRAG,
      uniforms: {
        uWetSrc: { value: null },
        uDrySrc: { value: null },
        uDecode: { value: 1 },
        uHasWet: { value: 0 },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    this._restoreMesh = new Mesh(this._fsGeo, this._restoreMaterial);
    this._restoreMesh.frustumCulled = false;

    this._flowMaterial = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: FLOW_FRAG.replace("__SHAPE__", shapeGlsl).replace("__NOISE__", NOISE_GLSL),
      uniforms: { uSeed: { value: 1337 } },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    this._flowMesh = new Mesh(this._fsGeo, this._flowMaterial);
    this._flowMesh.frustumCulled = false;
  }

  _createFlowMap(res) {
    const size = Math.min(1024, res);
    if (this._flowMap && this._flowMap.width === size) return;
    if (this._flowMap) this._flowMap.dispose();
    this._flowMap = new WebGLRenderTarget(size, size, {
      format: RGBAFormat,
      type: UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: RepeatWrapping,
    });
    this._renderTo(this._flowMap, this._flowMesh);
    this._simMaterial.uniforms.uFlowMap.value = this._flowMap.texture;
  }

  _createTargets(res) {
    const make = () => {
      const rt = new WebGLRenderTarget(res, res, {
        count: 2,
        type: HalfFloatType,
        format: RGBAFormat,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: this.mipmaps,
        minFilter: this.mipmaps ? LinearMipmapLinearFilter : LinearFilter,
        magFilter: LinearFilter,
        wrapS: RepeatWrapping,
      });
      for (const t of rt.textures) {
        t.wrapS = RepeatWrapping;
        t.generateMipmaps = this.mipmaps;
        t.minFilter = this.mipmaps ? LinearMipmapLinearFilter : LinearFilter;
        t.magFilter = LinearFilter;
        t.anisotropy = this.mipmaps
          ? Math.min(4, this.renderer.capabilities.getMaxAnisotropy())
          : 1;
      }
      return rt;
    };
    this._targets = [make(), make()];
    this._current = 0;
    this._simMaterial.uniforms.uTexel.value.set(1 / res, 1 / res);
    this._createFlowMap(res);
  }

  _renderTo(target, mesh, { clear = false } = {}) {
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevAutoClear = r.autoClear;
    r.autoClear = false;
    this._scene.children.length = 0;
    this._scene.add(mesh);
    r.setRenderTarget(target);
    if (clear) {
      r.setClearColor(0x000000, 0);
      r.clear(true, false, false);
    }
    r.render(this._scene, this._camera);
    r.setRenderTarget(prevTarget);
    r.autoClear = prevAutoClear;
  }

  // Removes all paint from both layers.
  clear() {
    for (const t of this._targets) {
      const r = this.renderer;
      const prev = r.getRenderTarget();
      r.setRenderTarget(t);
      r.setClearColor(0x000000, 0);
      r.clear(true, false, false);
      r.setRenderTarget(prev);
    }
    this._pendingStamps.length = 0;
    this.wetUntil = -1;
  }

  // Changes the paint resolution, keeping the current painting (resampled).
  setResolution(res) {
    if (res === this.resolution) return;
    const old = this._targets;
    const oldCurrent = this._current;
    this.resolution = res;
    this._createTargets(res);
    this.clear();
    const src = old[oldCurrent];
    const u = this._restoreMaterial.uniforms;
    u.uDrySrc.value = src.textures[1];
    u.uWetSrc.value = src.textures[0];
    u.uDecode.value = 0;
    u.uHasWet.value = 1;
    this._renderTo(this._targets[this._current], this._restoreMesh);
    u.uDrySrc.value = null;
    u.uWetSrc.value = null;
    for (const t of old) t.dispose();
    for (const t of this._encodePool) t.dispose();
    this._encodePool.length = 0;
  }

  // ---- Stamping -----------------------------------------------------------

  // Queues one stamp. p: object-space unit surface point, radius in radians,
  // color: THREE.Color (linear), alpha: dry coverage, wet: wet fraction 0..1.
  queueStamp(p, radius, color, alpha, wet, hardness = 0.5) {
    if (this._pendingStamps.length >= MAX_STAMPS) this.flushStamps();
    const uv = this.shape.positionToUV(p);
    const b = this.shape.uvBounds(uv.u, uv.v, radius);
    this._pendingStamps.push({
      rect: [b.u0, b.v0, b.u1, b.v1],
      center: [p.x, p.y, p.z],
      color: [color.r, color.g, color.b, alpha],
      params: [radius, wet, hardness],
    });
    if (wet > 0 && alpha > 0) {
      this.wetUntil = Math.max(this.wetUntil, this.simClock + this.physics.dryTime + 1);
    }
  }

  // Draws all queued stamps into the current layers in one instanced draw.
  flushStamps() {
    const n = this._pendingStamps.length;
    if (!n) return;
    const rect = this._stampRect.array;
    const center = this._stampCenter.array;
    const color = this._stampColor.array;
    const params = this._stampParams.array;
    for (let i = 0; i < n; i++) {
      const s = this._pendingStamps[i];
      rect.set(s.rect, i * 4);
      center.set(s.center, i * 3);
      color.set(s.color, i * 4);
      params.set(s.params, i * 3);
    }
    for (const a of [this._stampRect, this._stampCenter, this._stampColor, this._stampParams]) {
      a.needsUpdate = true;
    }
    this._stampGeo.instanceCount = n;
    this._pendingStamps.length = 0;
    this._renderTo(this._targets[this._current], this._stampMesh);
  }

  // ---- Strokes ------------------------------------------------------------

  // Begins a stroke. brush: { size, color (hex), wetness, opacity }.
  // Returns the stroke record that the caller appends to the scene log.
  beginStroke(brush, gravity, strokeIndex = this.strokeCount) {
    const color = new Color(brush.color);
    this._stroke = {
      brush: { ...brush },
      color,
      index: strokeIndex,
      pointIndex: 0,
      last: null,
      lastTime: 0,
      carry: 0,
      lastSplash: -Infinity,
      // Overlapping stamps along the path would saturate; scale per-stamp
      // alpha so a full stroke lands near the requested opacity.
      flowAlpha: 1 - Math.pow(1 - brush.opacity, 1 / 6),
    };
    this.strokeCount = strokeIndex + 1;
    return {
      size: brush.size,
      color: brush.color,
      wetness: brush.wetness,
      opacity: brush.opacity,
      g: gravity
        ? [gravity.x, gravity.y, gravity.z].map((v) => Math.round(v * 1000) / 1000)
        : undefined,
      points: [],
    };
  }

  // Adds a pointer sample to the current stroke. p is the object-space unit
  // surface point, timeSec the event time. Returns { splash } describing
  // whether a splash was spawned (so the caller can record the flag).
  strokeTo(p, timeSec, { forceSplash = false, allowSplash = true } = {}) {
    const st = this._stroke;
    if (!st) return { splash: false };
    const brush = st.brush;
    const shape = this.shape;
    let speed = 0;
    let direction = null;
    if (st.last) {
      const dist = shape.geodesic(st.last, p);
      const dt = Math.max(1e-3, timeSec - st.lastTime);
      speed = dist / dt;
      if (dist > 1e-6) {
        direction = _dir.copy(p).sub(st.last);
        const n = _n.copy(p).normalize();
        direction.addScaledVector(n, -direction.dot(n)).normalize();
      }
      const spacing = Math.max(brush.size * 0.22, this.texelAngle);
      const steps = Math.floor((dist + st.carry) / spacing);
      for (let i = 1; i <= steps; i++) {
        const t = Math.min(1, (i * spacing - st.carry) / dist);
        _slerp(st.last, p, t, _p);
        this.queueStamp(_p, brush.size, st.color, st.flowAlpha, brush.wetness, 0.55);
      }
      st.carry = (dist + st.carry) % spacing;
    } else {
      // First dab of a stroke lands at the full requested opacity.
      this.queueStamp(p, brush.size, st.color, brush.opacity, brush.wetness, 0.55);
    }
    let splash = false;
    const nowMs = timeSec * 1000;
    const wantSplash =
      forceSplash || (speed > SPLASH_SPEED_THRESHOLD && nowMs - st.lastSplash > SPLASH_COOLDOWN_MS);
    if (allowSplash && wantSplash) {
      this.splashAt(p, direction ? direction.clone() : null, speed, brush, st.index, st.pointIndex);
      st.lastSplash = nowMs;
      splash = true;
    }
    st.last = (st.last || new Vector3()).copy(p);
    st.lastTime = timeSec;
    st.pointIndex++;
    return { splash, speed };
  }

  splashAt(p, direction, speed, brush, strokeIndex, pointIndex) {
    const rng = mulberry32((strokeIndex * 7919 + pointIndex * 104729 + 17) >>> 0);
    const droplets = makeSplash({
      shape: this.shape,
      center: p,
      direction,
      speed,
      brush,
      rng,
      texelAngle: this.texelAngle,
    });
    const color = this._stroke ? this._stroke.color : new Color(brush.color);
    for (const d of droplets) {
      this.queueStamp(d.p, d.radius, color, d.alpha, d.wet, d.hardness);
    }
  }

  endStroke() {
    this._stroke = null;
  }

  get inStroke() {
    return this._stroke !== null;
  }

  // ---- Simulation ---------------------------------------------------------

  // Advances the wet layer by dt seconds. gravity: unit vector in object space.
  simulate(dt, gravity) {
    if (this._pendingStamps.length) this.flushStamps();
    if (!this.hasWet) return;
    const u = this._simMaterial.uniforms;
    const src = this._targets[this._current];
    const dst = this._targets[1 - this._current];
    u.uWet.value = src.textures[0];
    u.uDry.value = src.textures[1];
    u.uGravity.value.copy(gravity);
    u.uDt.value = dt;
    const v = this.physics.viscosity;
    u.uFlow.value = 0.02 + 0.3 * Math.pow(1 - v, 1.6);
    u.uDryRate.value = 1 / this.physics.dryTime;
    u.uDiffuse.value = 0.05 + 0.05 * v;
    this._renderTo(dst, this._simMesh);
    u.uWet.value = null;
    u.uDry.value = null;
    this._current = 1 - this._current;
    this.simClock += dt;
  }

  // ---- Snapshots ----------------------------------------------------------

  _acquireEncodeTarget(size = this.resolution) {
    let rt = size === this.resolution ? this._encodePool.pop() : null;
    if (!rt || rt.width !== size) {
      if (rt) rt.dispose();
      rt = new WebGLRenderTarget(size, size, {
        format: RGBAFormat,
        type: UnsignedByteType,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
      });
    }
    return rt;
  }

  _releaseEncodeTarget(rt) {
    if (this._encodePool.length < 4 && rt.width === this.resolution) this._encodePool.push(rt);
    else rt.dispose();
  }

  // Reads one layer ("dry" or "wet") as unpremultiplied sRGB RGBA8 bytes in
  // GL row order (bottom row first).
  async readLayer(which, { sync = false, size = this.resolution } = {}) {
    if (this._pendingStamps.length) this.flushStamps();
    const rt = this._acquireEncodeTarget(size);
    const tex = which === "wet" ? this.wetTexture : this.dryTexture;
    this._encodeMaterial.uniforms.uSrc.value = tex;
    this._renderTo(rt, this._encodeMesh);
    this._encodeMaterial.uniforms.uSrc.value = null;
    const w = rt.width;
    const h = rt.height;
    const buffer = new Uint8Array(w * h * 4);
    const r = this.renderer;
    if (!sync && typeof r.readRenderTargetPixelsAsync === "function") {
      try {
        await r.readRenderTargetPixelsAsync(rt, 0, 0, w, h, buffer);
      } catch {
        r.readRenderTargetPixels(rt, 0, 0, w, h, buffer);
      }
    } else {
      r.readRenderTargetPixels(rt, 0, 0, w, h, buffer);
    }
    this._releaseEncodeTarget(rt);
    return { data: buffer, width: w, height: h };
  }

  // Writes both layers from 8-bit sRGB unpremultiplied textures (or raw
  // half-float textures when decode is false). Null wet clears the wet layer.
  writeLayers(dryTexture, wetTexture, { decode = true } = {}) {
    const u = this._restoreMaterial.uniforms;
    u.uDrySrc.value = dryTexture || this._blank;
    u.uWetSrc.value = wetTexture || this._blank;
    u.uDecode.value = decode ? 1 : 0;
    u.uHasWet.value = wetTexture ? 1 : 0;
    this._renderTo(this._targets[this._current], this._restoreMesh);
    u.uDrySrc.value = null;
    u.uWetSrc.value = null;
    this._pendingStamps.length = 0;
    this.wetUntil = wetTexture ? this.simClock + this.physics.dryTime + 1 : -1;
  }

  // Loads the dry layer from a decoded image (ImageBitmap with flipY applied
  // so that row 0 is the bottom) and clears the wet layer.
  loadDryFromImage(image) {
    const tex = new Texture(image);
    tex.flipY = false;
    tex.premultiplyAlpha = false;
    tex.generateMipmaps = false;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.wrapS = RepeatWrapping;
    tex.needsUpdate = true;
    this.writeLayers(tex, null, { decode: true });
    tex.dispose();
  }

  _dataTexture(bytes, w, h) {
    const tex = new DataTexture(bytes, w, h, RGBAFormat, UnsignedByteType);
    tex.flipY = false;
    tex.premultiplyAlpha = false;
    tex.generateMipmaps = false;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.wrapS = RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  // ---- Undo ---------------------------------------------------------------

  // Captures both layers (wet only when something is still wet) and pushes
  // the compressed result onto the undo stack. Resolves when stored.
  async pushUndo(meta = {}) {
    const hadWet = this.hasWet;
    const entry = {
      width: this.resolution,
      height: this.resolution,
      strokeCount: this.strokeCount,
      wetUntil: this.wetUntil,
      simClock: this.simClock,
      meta,
      dry: null,
      wet: null,
      bytes: 0,
      ready: null,
    };
    this.undoStack.push(entry);
    while (this.undoStack.length > UNDO_MAX_STEPS) this._dropOldestUndo();
    const dryRead = this.readLayer("dry");
    const wetRead = hadWet ? this.readLayer("wet") : Promise.resolve(null);
    entry.ready = (async () => {
      const [dry, wet] = await Promise.all([dryRead, wetRead]);
      entry.dry = await compressBytes(dry.data);
      entry.bytes += entry.dry.data.byteLength;
      if (wet) {
        entry.wet = await compressBytes(wet.data);
        entry.bytes += entry.wet.data.byteLength;
      }
      this.undoBytes += entry.bytes;
      while (this.undoBytes > this.undoBudgetBytes && this.undoStack.length > 1) {
        this._dropOldestUndo();
      }
    })();
    return entry.ready;
  }

  _dropOldestUndo() {
    const e = this.undoStack.shift();
    if (e && e.dry) this.undoBytes -= e.bytes;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  // Restores the most recent snapshot. Returns its meta, or null.
  async undo() {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    await entry.ready;
    this.undoBytes -= entry.bytes;
    const dryBytes = await decompressBytes(entry.dry);
    const dryTex = this._dataTexture(dryBytes, entry.width, entry.height);
    let wetTex = null;
    if (entry.wet) {
      const wetBytes = await decompressBytes(entry.wet);
      wetTex = this._dataTexture(wetBytes, entry.width, entry.height);
    }
    this.endStroke();
    this.writeLayers(dryTex, wetTex, { decode: true });
    dryTex.dispose();
    if (wetTex) wetTex.dispose();
    this.strokeCount = entry.strokeCount;
    return entry.meta;
  }

  clearUndo() {
    this.undoStack.length = 0;
    this.undoBytes = 0;
  }

  dispose() {
    for (const t of this._targets) t.dispose();
    for (const t of this._encodePool) t.dispose();
    if (this._flowMap) this._flowMap.dispose();
    this._flowMaterial.dispose();
    this._stampMaterial.dispose();
    this._simMaterial.dispose();
    this._encodeMaterial.dispose();
    this._restoreMaterial.dispose();
    this._stampGeo.dispose();
    this._fsGeo.dispose();
    this._blank.dispose();
    this.clearUndo();
  }
}

const _dir = new Vector3();
const _n = new Vector3();
const _p = new Vector3();
const _qa = new Vector3();
const _qb = new Vector3();

// Spherical interpolation between two unit vectors.
function _slerp(a, b, t, out) {
  const dot = Math.min(1, Math.max(-1, a.dot(b)));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return out.copy(b);
  const so = Math.sin(omega);
  _qa.copy(a).multiplyScalar(Math.sin((1 - t) * omega) / so);
  _qb.copy(b).multiplyScalar(Math.sin(t * omega) / so);
  return out.copy(_qa).add(_qb).normalize();
}

// Replays a stroke log into the paint system with a fixed simulation step,
// fast-forwarded and chunked across animation frames so the page stays
// responsive. gravityFallback: object-space gravity when a stroke has none.
export async function replayStrokes(paint, strokes, options = {}) {
  const {
    physics = paint.physics,
    gravityFallback = new Vector3(0, -1, 0),
    onProgress = () => {},
    stepsPerFrame = 24,
    dt = 1 / 30,
    shape = paint.shape,
  } = options;
  paint.physics = { ...physics };
  const total = strokes.reduce((n, s) => n + s.points.length, 0) || 1;
  let done = 0;
  let simT = 0;
  let steps = 0;
  const gravity = new Vector3();
  const p = new Vector3();
  const settle = physics.dryTime + 0.6;
  const nextFrame = () =>
    new Promise((resolve) => {
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
      else setTimeout(resolve, 0);
    });
  const advance = async (target) => {
    if (target - simT > settle) {
      // Nothing can still be wet after the drying time; skip idle time.
      if (!paint.hasWet) simT = target;
      else simT = Math.max(simT, target - settle);
    }
    while (simT + dt <= target + 1e-9) {
      if (paint.hasWet) {
        paint.simulate(dt, gravity);
        steps++;
        if (steps % stepsPerFrame === 0) {
          onProgress(done / total);
          await nextFrame();
        }
      } else {
        paint.simClock += dt;
      }
      simT += dt;
    }
  };

  for (let si = 0; si < strokes.length; si++) {
    const s = strokes[si];
    if (Array.isArray(s.g) && s.g.length === 3) gravity.fromArray(s.g).normalize();
    else gravity.copy(gravityFallback);
    const brush = { size: s.size, color: s.color, wetness: s.wetness, opacity: s.opacity };
    paint.beginStroke(brush, gravity, si);
    for (let pi = 0; pi < s.points.length; pi++) {
      const [tMs, u, v, splash] = s.points[pi];
      const tSec = tMs / 1000;
      await advance(tSec);
      shape.uvToPosition(u, v, p);
      paint.strokeTo(p, tSec, { forceSplash: !!splash, allowSplash: !!splash });
      done++;
    }
    paint.endStroke();
    paint.flushStamps();
  }
  await advance(simT + settle);
  paint.flushStamps();
  onProgress(1);
}
