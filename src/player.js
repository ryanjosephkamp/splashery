// The Splashery runtime shared by the app, the embed player and the
// <splashery-toy> element: loads a toy, runs the clock, the camera, the
// effect uniforms, idle behaviour and the pointer tools, and renders only
// when something changes.

import * as pc from "./pc.js";
import { Stage, NoGPUError } from "./stage.js";
import { OrbitCamera, Gestures } from "./camera.js";
import { EffectDriver, hexToRgb } from "./effects.js";
import { Painter } from "./paint.js";
import { generate, normalizeGenerator, applyClay, PROFILES } from "./generators.js";
import {
  fetchBytes,
  loadNative,
  robustBounds,
  extOf,
  parseSplat,
  parseSpz,
  resourceFromArrays,
} from "./loaders.js";
import { findToy, assetURL } from "./toys.js";
import { createScene, THEMES } from "./state.js";
import { mulberry32, mixSeed } from "./noise.js";

export { NoGPUError };

// Device profile: weak devices get fewer splats and a lower pixel ratio.
export function detectProfile() {
  const params = new URLSearchParams(location.search);
  const forced = params.get("profile");
  if (forced === "weak" || forced === "strong") return forced;
  const nav = navigator;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const small = Math.min(screen.width, screen.height) < 820;
  const lowMem = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
  const fewCores = typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4;
  if ((coarse && small) || lowMem || fewCores) return "weak";
  return "strong";
}

export function prefersReducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export class Player {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.profile = opts.profile || detectProfile();
    this.reducedMotion = opts.reducedMotion ?? prefersReducedMotion();
    this.scene = createScene();
    this.time = 0;
    this.timeScale = 1;
    this.frozen = false;
    this.toyInfo = null;
    this.proc = null; // procedural toy: { ctx, container }
    this.themeOverride = null;
    this.hostTheme = null;
    this.idle = { weight: 0, pokeAt: 0, pokes: 0 };
    this.loadToken = 0;
    this.listeners = {};
    this.stroke = null;
    this.pickDirty = true;
    this.lastPoseKey = "";
  }

  on(name, fn) {
    (this.listeners[name] ||= []).push(fn);
  }

  emit(name, ...args) {
    for (const fn of this.listeners[name] || []) fn(...args);
  }

  async init() {
    const params = new URLSearchParams(location.search);
    const prefer = this.opts.prefer || params.get("renderer") || "auto";
    this.stage = await Stage.create(this.canvas, { prefer, weak: this.profile === "weak" });
    this.camera = new OrbitCamera({ reducedMotion: this.reducedMotion });
    this.driver = new EffectDriver();
    this.painter = new Painter(this.stage);
    this.camera.onShake = () => this.shake();
    this.stage.onUpdate((dt) => this.update(dt));
    this.media = matchMedia("(prefers-color-scheme: dark)");
    this.media.addEventListener("change", () => this.applyLook());
    this.applyLook();
    this.watchDeviceShake();
    return this;
  }

  get deviceType() {
    return this.stage.deviceType;
  }

  // ---- Look -----------------------------------------------------------------

  resolvedTheme() {
    const t = this.themeOverride || this.scene.look.theme;
    if (t === "light" || t === "dark") return t;
    if (this.hostTheme) return this.hostTheme;
    return this.media?.matches ? "dark" : "light";
  }

  accentColor() {
    const a = this.scene.look.accent;
    return a === "auto" ? THEMES[this.resolvedTheme()].accent : a;
  }

  // Applies background and theme. Returns the resolved theme.
  applyLook() {
    const look = this.scene.look;
    const theme = this.resolvedTheme();
    const page = THEMES[theme].page;
    if (look.background === "transparent") {
      this.stage.setClearColor([0, 0, 0], 0);
    } else {
      this.stage.setClearColor(hexToRgb(look.background === "page" ? page : look.background), 1);
    }
    this.emit("theme", theme);
    this.stage.requestRender();
    return theme;
  }

  // ---- Toys -------------------------------------------------------------------

  // Loads the toy described by scene.toy. `file` carries bytes for user files.
  async loadToy(toy, { file = null, onProgress } = {}) {
    const token = ++this.loadToken;
    const progress = (f, label) => onProgress?.(f, label);
    this.stroke = null;
    this.painter.detach();
    this.driver.clearPokes();
    let info;
    if (
      toy.kind === "procedural" ||
      (toy.kind === "builtin" && findToy(toy.id)?.kind === "procedural")
    ) {
      const preset = toy.kind === "builtin" ? findToy(toy.id) : null;
      const generator = normalizeGenerator(
        preset
          ? { ...preset.generator, count: PROFILES[this.profile].defaultCount }
          : toy.generator,
        this.profile,
      );
      info = await this.buildProcedural(generator, toy.clay || [], token, progress);
      if (!info) return null;
      // A shelf toy edited with clay keeps its name.
      const shelf = preset || (toy.id ? findToy(toy.id) : null);
      info.id = shelf ? shelf.id : null;
      info.label = preset ? preset.label : shelf ? `${shelf.label}, edited` : "Your toy";
      info.kind = "procedural";
      info.generator = generator;
    } else if (toy.kind === "builtin") {
      const def = findToy(toy.id) || findToy("blob");
      if (def.kind === "procedural")
        return this.loadToy({ kind: "builtin", id: def.id }, { onProgress });
      const url = assetURL(this.profile === "weak" && def.urlWeak ? def.urlWeak : def.url);
      progress(0, `Loading ${def.label}…`);
      const bytes = await fetchBytes(url, (f) => progress(f * 0.9, `Loading ${def.label}…`));
      if (token !== this.loadToken) return null;
      const asset = await loadNative(this.stage, bytes, url.split("/").pop());
      if (token !== this.loadToken) {
        asset.unload();
        return null;
      }
      this.disposeProcedural();
      this.stage.setToy({ resource: asset.resource, asset, transform: def.transform || null });
      info = this.measure(asset.resource, def.transform);
      Object.assign(info, { id: def.id, label: def.label, kind: "captured", credit: def.credit });
    } else if (toy.kind === "file") {
      if (!file)
        throw new Error(
          "This scene uses a splat file from someone's computer. Drop that file here to see it.",
        );
      progress(0.1, `Reading ${file.name}…`);
      const { resource, asset } = await this.decodeFile(file);
      if (token !== this.loadToken) return null;
      const bounds = robustBounds(resource);
      const r = Math.max(...bounds.half);
      const scale = 0.9 / r;
      const flip = !!toy.flip;
      const c = bounds.center;
      // Centre and scale; flipping turns the model 180 degrees about Z.
      const transform = {
        position: flip
          ? [c[0] * scale, c[1] * scale, -c[2] * scale]
          : [-c[0] * scale, -c[1] * scale, -c[2] * scale],
        rotation: flip ? [0, 0, 180] : [0, 0, 0],
        scale,
      };
      this.disposeProcedural();
      this.stage.setToy({ resource, asset, owned: !asset, transform });
      info = this.measure(resource, transform, bounds);
      Object.assign(info, { id: null, label: file.name, kind: "file", bytes: file.size });
    }
    this.toyInfo = info;
    this.camera.fit(info.radius, info.center);
    this.time = 0;
    this.idle.pokeAt = 0;
    this.idle.pokes = 0;
    // The paint processor needs the placement, which exists after a frame.
    this.stage.requestRender();
    await nextFrame();
    await nextFrame();
    if (token !== this.loadToken) return null;
    this.painter.attach();
    this.painter.applyAll(this.scene.paint.stamps);
    this.pickDirty = true;
    progress(1);
    this.emit("toy", info);
    return info;
  }

  async decodeFile(file) {
    const ext = extOf(file.name);
    if (file.resource) return { resource: file.resource, asset: null };
    const bytes = file.bytes || new Uint8Array(await file.arrayBuffer());
    if (ext === "ply" || ext === "sog") {
      const asset = await loadNative(
        this.stage,
        bytes,
        file.name.toLowerCase().endsWith(".sog") ? "toy.sog" : "toy.ply",
      );
      return { resource: asset.resource, asset };
    }
    if (ext === "splat")
      return { resource: resourceFromArrays(this.stage, parseSplat(bytes)), asset: null };
    if (ext === "spz")
      return { resource: resourceFromArrays(this.stage, await parseSpz(bytes)), asset: null };
    throw new Error(
      `Splashery cannot read .${ext || "?"} files. It loads PLY, SOG, SPLAT and SPZ (v1–v3).`,
    );
  }

  // World-space centre, radius and half extents of the toy.
  measure(resource, transform, known) {
    const b = known || robustBounds(resource);
    const s = transform ? transform.scale : 1;
    const half = b.half.map((h) => h * s);
    const center = transform ? [0, 0, 0] : b.center.slice();
    return {
      center,
      half,
      radius: Math.max(...half),
      splats: resource.numSplats,
    };
  }

  async buildProcedural(generator, clay, token, progress) {
    progress(0, "Building the toy…");
    const it = generate(generator, { clay });
    let r = it.next();
    let last = performance.now();
    while (!r.done) {
      if (performance.now() - last > 30) {
        progress(r.value * 0.9, "Building the toy…");
        await nextFrame();
        last = performance.now();
        if (token !== this.loadToken) return null;
      }
      r = it.next();
    }
    const ctx = r.value;
    const container = this.makeContainer(ctx.buf);
    this.disposeProcedural();
    this.stage.setToy({ resource: container, owned: true });
    this.proc = { ctx, container, clay: clay.slice() };
    const b = ctx.buf.bounds();
    const half = [0, 1, 2].map((k) => Math.max(Math.abs(b.min[k]), Math.abs(b.max[k])));
    return { center: [0, 0, 0], half, radius: Math.max(...half), splats: ctx.buf.count };
  }

  makeContainer(buf) {
    const device = this.stage.device;
    if (!this.format) this.format = pc.GSplatFormat.createDefaultFormat(device);
    const container = new pc.GSplatContainer(device, buf.capacity, this.format);
    this.writeContainer(container, buf, 0, buf.count, true);
    return container;
  }

  // Copies splats [start, end) into the container textures.
  writeContainer(container, buf, start, end, all = false) {
    const half = pc.FloatPacking.float2Half;
    const tc = container.getTexture("dataCenter");
    const tcol = container.getTexture("dataColor");
    const ts = container.getTexture("dataScale");
    const tr = container.getTexture("dataRotation");
    const center = tc.lock();
    const color = tcol.lock();
    const scale = ts.lock();
    const rot = tr.lock();
    const centers = container.centers;
    for (let i = start; i < end; i++) {
      const i3 = i * 3;
      const i4 = i * 4;
      center[i4] = centers[i3] = buf.pos[i3];
      center[i4 + 1] = centers[i3 + 1] = buf.pos[i3 + 1];
      center[i4 + 2] = centers[i3 + 2] = buf.pos[i3 + 2];
      center[i4 + 3] = 0;
      color[i4] = half(buf.color[i4]);
      color[i4 + 1] = half(buf.color[i4 + 1]);
      color[i4 + 2] = half(buf.color[i4 + 2]);
      color[i4 + 3] = half(buf.color[i4 + 3]);
      scale[i4] = half(buf.scale[i3]);
      scale[i4 + 1] = half(buf.scale[i3 + 1]);
      scale[i4 + 2] = half(buf.scale[i3 + 2]);
      scale[i4 + 3] = 0;
      // Stored as (w, x, y, z); the reader swizzles to (x, y, z, w).
      rot[i4] = half(buf.rot[i4 + 3]);
      rot[i4 + 1] = half(buf.rot[i4]);
      rot[i4 + 2] = half(buf.rot[i4 + 1]);
      rot[i4 + 3] = half(buf.rot[i4 + 2]);
    }
    tc.unlock();
    tcol.unlock();
    ts.unlock();
    tr.unlock();
    const b = buf.bounds();
    const aabb = new pc.BoundingBox();
    aabb.setMinMax(new pc.Vec3(...b.min), new pc.Vec3(...b.max));
    container.aabb = aabb;
    container.update(buf.count, true);
    if (!all) this.stage.requestRender();
  }

  disposeProcedural() {
    this.proc = null;
  }

  // ---- Scene ----------------------------------------------------------------

  // Applies everything except the toy itself.
  applySettings(scene, { camera = true } = {}) {
    this.scene = scene;
    this.camera.setTurntable(scene.autoplay.turntable);
    if (camera) this.camera.setState(scene.camera, { asHome: true });
    this.applyLook();
    this.syncDrop();
    this.stage.requestRender();
  }

  setEffects(effects) {
    this.scene.effects = effects;
    this.syncDrop();
    this.stage.requestRender();
  }

  // Starts or recalls the drop when its switch changes.
  syncDrop() {
    const on = this.scene.effects.drop.on;
    const d = this.driver.drop;
    if (on && (!d.on || d.recallAt >= 0)) this.startDrop();
    else if (!on && d.on) this.driver.recallDrop(this.time);
  }

  startDrop() {
    if (!this.toyInfo) return;
    const pose = this.camera.pose();
    const g = [-pose.up[0], -pose.up[1], -pose.up[2]];
    const h = this.toyInfo.half;
    const floor =
      Math.abs(g[0]) * h[0] +
      Math.abs(g[1]) * h[1] +
      Math.abs(g[2]) * h[2] +
      0.03 * this.toyInfo.radius;
    this.driver.startDrop(this.time, g, floor);
  }

  shake() {
    if (this.scene.effects.drop.on) {
      this.scene.effects.drop.on = false;
      this.driver.recallDrop(this.time);
      this.emit("effects", this.scene.effects);
      this.emit("message", "Shaken back together.");
    }
  }

  watchDeviceShake() {
    if (typeof DeviceMotionEvent === "undefined") return;
    let last = 0;
    let hits = 0;
    addEventListener("devicemotion", (e) => {
      const a = e.accelerationIncludingGravity || e.acceleration;
      if (!a) return;
      const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
      const now = performance.now();
      if (m > 24) {
        hits = now - last < 700 ? hits + 1 : 1;
        last = now;
        if (hits >= 3) {
          hits = 0;
          this.shake();
        }
      }
    });
  }

  resetCamera() {
    this.camera.reset();
    this.stage.requestRender();
  }

  // ---- Frame ------------------------------------------------------------------

  // Effect settings with the idle behaviour blended in.
  effectiveEffects() {
    const fx = this.scene.effects;
    const w = this.idle.weight;
    const mode = this.scene.autoplay.effect;
    if (w <= 0 || mode === "none" || this.reducedMotion) return fx;
    const out = { ...fx };
    if (mode === "breeze" && !fx.wind.on) out.wind = { ...fx.wind, on: true, strength: 0.28 * w };
    if (mode === "twist" && !fx.twist.on)
      out.twist = { ...fx.twist, on: true, amount: 0.3 * w, wobble: 0.22 };
    if (mode === "dissolve" && !fx.dissolve.on && !fx.drop.on && w > 0.99) {
      out.dissolve = { ...fx.dissolve, on: true, speed: 0.15, spread: 0.45 };
    }
    return out;
  }

  // Paused players (for example an element scrolled out of view) skip
  // their frame work and never ask for a render.
  setPaused(paused) {
    this.paused = !!paused;
    if (!paused) this.stage.requestRender();
  }

  update(dt) {
    if (this.paused) return;
    if (!this.toyInfo) {
      this.stage.requestRender();
      return;
    }
    if (!this.frozen) this.time += dt * this.timeScale;
    const d = this.driver.drop;
    if (d.on && d.recallAt < 0) {
      const k = Math.min(1, (this.time - d.start) / 0.9) * d.floor * 0.5;
      this.camera.follow = [d.gravity[0] * k, d.gravity[1] * k, d.gravity[2] * k];
    } else {
      this.camera.follow = [0, 0, 0];
    }
    const moving = this.frozen ? false : this.camera.update(dt);
    const pose = this.camera.pose();
    this.camera.viewportHeight = this.canvas.clientHeight || 600;
    this.stage.setCameraPose(pose);
    const key =
      pose.position.map((v) => v.toFixed(4)).join(",") +
      pose.rotation.map((v) => v.toFixed(4)).join(",");
    if (key !== this.lastPoseKey) {
      this.lastPoseKey = key;
      this.pickDirty = true;
      this.stage.requestRender();
    }

    // Idle behaviour fades in after a pause and out on interaction.
    const idleMode = this.scene.autoplay.effect;
    if (!this.frozen) {
      const idleNow =
        !this.reducedMotion &&
        idleMode !== "none" &&
        this.camera.idleFor > (this.opts.idleDelay ?? 4);
      this.idle.weight = Math.min(
        1,
        Math.max(0, this.idle.weight + (idleNow ? dt / 1.5 : -dt / 0.4)),
      );
      if (idleNow && idleMode === "pokes" && this.time >= this.idle.pokeAt) this.idlePoke();
    }

    const effects = this.effectiveEffects();
    const info = this.toyInfo;
    const u = this.driver.compute({
      time: this.time,
      dt: this.frozen ? 0 : dt,
      effects,
      look: { ...this.scene.look, accent: this.accentColor() },
      seed: this.scene.seed,
      toy: {
        center: info.center,
        radius: info.radius,
        extentAlong: (n) =>
          Math.abs(n[0]) * info.half[0] +
          Math.abs(n[1]) * info.half[1] +
          Math.abs(n[2]) * info.half[2],
      },
      camera: pose,
    });
    this.stage.setUniforms(u);
    const dripping = this.painter.tick(this.time, (s) => this.scene.paint.stamps.push(s));
    const animating = this.driver.isAnimating(effects, this.time) || this.idle.weight > 0;
    if (moving || animating || dripping || this.stroke) {
      this.pickDirty = this.pickDirty || animating;
      this.stage.requestRender();
    }
    this.emit("frame", dt);
  }

  idlePoke() {
    const info = this.toyInfo;
    const rand = mulberry32(mixSeed(this.scene.seed, `idle-${this.idle.pokes++}`));
    const z = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const p = [
      info.center[0] + r * Math.cos(a) * info.half[0],
      info.center[1] + z * info.half[1],
      info.center[2] + r * Math.sin(a) * info.half[2],
    ];
    this.driver.addPoke(p, this.time);
    this.idle.pokeAt = this.time + 2.2;
  }

  // ---- Tools ------------------------------------------------------------------

  canvasPoint(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  async pickAt(x, y) {
    if (this.pickDirty) {
      this.stage.preparePick();
      this.pickDirty = false;
    }
    return this.stage.pick(x, y);
  }

  interact() {
    this.camera.interact();
    this.idle.weight = Math.min(this.idle.weight, 0.99);
    this.stage.requestRender();
  }

  // Pokes the toy at a canvas point. Resolves true when it hit the toy.
  async pokeAt(x, y) {
    const p = await this.pickAt(x, y);
    if (!p) return false;
    this.driver.addPoke(p, this.time);
    this.stage.requestRender();
    return true;
  }

  // Pokes a pseudo-random spot (keyboard and button access).
  pokeRandom() {
    this.idlePoke();
    this.interact();
  }

  // The magnet sits just in front of the toy under the pointer: the ray
  // meets the toy's bounding sphere (or passes closest to it).
  magnetAt(x, y, held) {
    const ray = this.stage.ray(x, y);
    const info = this.toyInfo;
    const c = info.center;
    const R = info.radius * 0.95;
    const oc = [ray.origin[0] - c[0], ray.origin[1] - c[1], ray.origin[2] - c[2]];
    const b = oc[0] * ray.dir[0] + oc[1] * ray.dir[1] + oc[2] * ray.dir[2];
    const disc = b * b - (oc[0] * oc[0] + oc[1] * oc[1] + oc[2] * oc[2] - R * R);
    const t = disc >= 0 ? -b - Math.sqrt(disc) : -b;
    let hit = [
      ray.origin[0] + ray.dir[0] * t,
      ray.origin[1] + ray.dir[1] * t,
      ray.origin[2] + ray.dir[2] * t,
    ];
    const out = normalize3([hit[0] - c[0], hit[1] - c[1], hit[2] - c[2]]);
    const lift = disc >= 0 ? 0.12 * info.radius : 0;
    if (disc < 0) hit = [c[0] + out[0] * R, c[1] + out[1] * R, c[2] + out[2] * R];
    const point = [hit[0] + out[0] * lift, hit[1] + out[1] * lift, hit[2] + out[2] * lift];
    const m = this.driver.magnet;
    if (!m.held && held) m.point = point.slice();
    m.target = point;
    m.held = held;
    this.stage.requestRender();
  }

  // Paint at a world point: the stamp, droplets and drips (screen-down).
  paintAt(world, first) {
    const fx = this.scene.effects.paint;
    const scale = this.stage.modelScale();
    const radius =
      ((0.03 + 0.2 * fx.size * fx.size + 0.02 * fx.size) * this.toyInfo.radius) / scale;
    const point = this.stage.worldToModel(world);
    let stamps;
    if (first) {
      const pose = this.camera.pose();
      const w0 = this.stage.worldToModel([0, 0, 0]);
      const w1 = this.stage.worldToModel([-pose.up[0], -pose.up[1], -pose.up[2]]);
      const down = normalize3([w1[0] - w0[0], w1[1] - w0[1], w1[2] - w0[2]]);
      stamps = this.painter.splash({
        point,
        radius,
        color: fx.color,
        splash: fx.splash,
        down,
        seed: mixSeed(this.scene.seed, `paint-${this.scene.paint.stamps.length}`),
        time: this.time,
      });
      this.driver.addPoke(world, this.time);
    } else {
      const q = (v) => Math.round(v * 1000) / 1000;
      stamps = [[q(point[0]), q(point[1]), q(point[2]), q(radius), fx.color, 1]];
    }
    for (const s of stamps) {
      this.painter.apply(s);
      this.scene.paint.stamps.push(s);
    }
    this.emit("paint", this.scene.paint.stamps.length);
    return radius * scale;
  }

  clearPaint() {
    this.scene.paint.stamps = [];
    this.painter.pending = [];
    this.painter.clearTexture();
    this.emit("paint", 0);
  }

  // Clay: add or erase a blob at a world point (procedural toys only).
  clayAt(world, mode, size) {
    if (!this.proc) return null;
    const p = this.stage.worldToModel(world);
    const r = (0.04 + 0.22 * size * size + 0.03 * size) * this.toyInfo.radius;
    const q = (v) => Math.round(v * 1000) / 1000;
    const op = [mode === "erase" ? "e" : "a", q(p[0]), q(p[1]), q(p[2]), q(r)];
    const { ctx, container } = this.proc;
    if (op[0] === "a" && ctx.buf.count >= ctx.buf.capacity) {
      this.emit("message", "This toy is full of clay. Regenerate it to start fresh.");
      return null;
    }
    const res = applyClay(ctx, op, this.proc.clay.length);
    this.proc.clay.push(op);
    if (op[0] === "a") this.writeContainer(container, ctx.buf, res.start, res.end);
    else if (res.erased) this.writeContainer(container, ctx.buf, 0, ctx.buf.count);
    this.pickDirty = true;
    this.emit("clay", this.proc.clay);
    return op;
  }

  // After a clay stroke, repaint so new splats match a replay from JSON.
  refreshPaint() {
    if (!this.scene.paint.stamps.length) return;
    this.painter.clearTexture();
    this.painter.applyAll(this.scene.paint.stamps);
  }

  // Deterministic frame at time t (exports): the clock and camera freeze.
  async renderAt(t, pose) {
    this.frozen = true;
    this.time = t;
    if (pose) this.camera.setState(pose, { snap: true });
    return this.stage.captureFrame();
  }

  resume() {
    this.frozen = false;
    this.stage.requestRender();
  }

  destroy() {
    this.loadToken++;
    this.painter?.detach();
    this.stage?.destroy();
  }
}

function normalize3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export { Gestures };
