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
import { buildRecipe, meanLuminance, Kit } from "./kit.js";
import { MotionDriver } from "./motion.js";
import { rigLayout, tagRig } from "./rig.js";
import { fxTable } from "./rig-fx.js";
import { RIGS } from "./rigs.js";
import { drawPattern, patternUniforms } from "./patterns.js";
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
import { mulberry32, mixSeed, hash32 } from "./noise.js";

export { NoGPUError };

// Device tiers, lowest first. Each has a splat budget (PROFILES in
// generators.js) and a pixel-ratio cap for the canvas.
export const TIERS = ["low", "mid", "high", "max"];
export const PIXEL_RATIO = { low: 1.5, mid: 2, high: 2, max: 3 };
const TIER_ALIASES = { weak: "low", strong: "high" };

// The viewer's Detail preference: "auto", "high" or "max". It lives in this
// browser only, never in scenes or links, so a shared link cannot force a
// heavy load on someone else's phone.
export const DETAILS = ["auto", "high", "max"];
const DETAIL_KEY = "splashery.detail";

export function readDetail() {
  try {
    const v = localStorage.getItem(DETAIL_KEY);
    return DETAILS.includes(v) ? v : "auto";
  } catch {
    return "auto";
  }
}

export function saveDetail(detail) {
  try {
    if (detail === "auto") localStorage.removeItem(DETAIL_KEY);
    else localStorage.setItem(DETAIL_KEY, detail);
  } catch {
    // Storage can be off (private windows, blocked site data); the choice
    // then lasts for this page only.
  }
}

// ?profile= forces a tier (the old weak and strong still work).
export function forcedProfile() {
  const v = new URLSearchParams(location.search).get("profile");
  const tier = TIER_ALIASES[v] || v;
  return TIERS.includes(tier) ? tier : null;
}

// The tier this device starts at. low: 2 GB of memory or less, or two
// cores; mid: phones and small machines; high: the rest. Detail High and
// Max raise it. Slow frames can step an Auto tier down later.
export function detectProfile(detail = readDetail()) {
  const forced = forcedProfile();
  if (forced) return forced;
  if (detail === "max") return "max";
  if (detail === "high") return "high";
  const nav = navigator;
  const mem = typeof nav.deviceMemory === "number" ? nav.deviceMemory : 8;
  const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : 8;
  if (mem <= 2 || cores <= 2) return "low";
  const coarse = matchMedia("(pointer: coarse)").matches;
  const small = Math.min(screen.width, screen.height) < 820;
  if ((coarse && small) || mem <= 4 || cores <= 4) return "mid";
  return "high";
}

export function prefersReducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export class Player {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.detail = readDetail();
    this.profile = opts.profile || detectProfile(this.detail);
    // Only an automatic tier steps down when frames are slow; ?adapt=off
    // keeps both the tier and the resolution fixed (tests and tools).
    this.adaptive = new URLSearchParams(location.search).get("adapt") !== "off";
    // ?rig=show tints each part of a scan rig (for placing its regions).
    this.rigDebug = new URLSearchParams(location.search).get("rig") === "show";
    this.autoTier = !opts.profile && !forcedProfile() && this.detail === "auto";
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
    this.loading = 0;
    this.listeners = {};
    this.stroke = null;
    this.pickDirty = true;
    this.lastPoseKey = "";
    this.motion = new MotionDriver();
    // Under reduced motion, toys only move once someone asks them to.
    this.motionAllowed = !this.reducedMotion;
    this.patternOn = false;
    this.patternToken = 0;
    this.patternCanvas = null;
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
    this.stage = await Stage.create(this.canvas, {
      prefer,
      weak: this.profile === "low",
      pixelRatio: PIXEL_RATIO[this.profile],
      adaptive: this.adaptive,
    });
    this.stage.onSlow = () => this.stepDown();
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

  // ---- Detail -------------------------------------------------------------------

  // Applies a new Detail preference. Returns true when the tier changed, so
  // the caller can rebuild the toy with the new splat count.
  setDetail(detail) {
    this.detail = DETAILS.includes(detail) ? detail : "auto";
    saveDetail(this.detail);
    const forced = !!this.opts.profile || !!forcedProfile();
    this.autoTier = !forced && this.detail === "auto";
    return forced ? false : this.setProfile(detectProfile(this.detail));
  }

  setProfile(tier) {
    if (tier === this.profile) return false;
    this.profile = tier;
    this.stage.setPixelRatio(PIXEL_RATIO[tier]);
    this.emit("profile", tier);
    return true;
  }

  // Frames stayed slow even at the reduced resolution: an automatic tier
  // drops one step. The pixel cap changes now; the splat count changes
  // with the next toy, so the current one does not pop.
  stepDown() {
    if (!this.autoTier) return;
    const i = TIERS.indexOf(this.profile);
    if (i > 0) this.setProfile(TIERS[i - 1]);
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
  // Frame timing ignores the build (it blocks the page in slices) and the
  // first frames of the new toy.
  async loadToy(toy, opts = {}) {
    this.loading++;
    try {
      return await this.loadToyNow(toy, opts);
    } finally {
      this.loading--;
      this.stage.settle();
    }
  }

  async loadToyNow(toy, { file = null, onProgress } = {}) {
    const token = ++this.loadToken;
    const progress = (f, label) => onProgress?.(f, label);
    this.stroke = null;
    this.painter.detach();
    this.driver.clearPokes();
    let info;
    const shelfDef = toy.kind === "builtin" ? findToy(toy.id) : null;
    this.motion.setToy(null, null);
    if (shelfDef?.kind === "kit") {
      info = await this.buildKit(shelfDef, toy, token, progress);
      if (!info) return null;
      Object.assign(info, { id: shelfDef.id, label: shelfDef.label, kind: "kit" });
    } else if (
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
      // A shelf shape keeps its rig (its tap effect) while its shape and
      // colours are the shelf's, even when edited with clay.
      const shelf = preset || (toy.id ? findToy(toy.id) : null);
      const same = shelf?.generator && generator.shape === shelf.generator.shape && generator.palette === shelf.generator.palette; // prettier-ignore
      const rig = same ? RIGS[shelf.id] || null : null;
      info = await this.buildProcedural(generator, toy.clay || [], token, progress, rig);
      if (!info) return null;
      if (rig) this.attachRig(shelf.id, rig, info);
      // A shelf toy edited with clay keeps its name.
      info.id = shelf ? shelf.id : null;
      info.label = preset ? preset.label : shelf ? `${shelf.label}, edited` : "Your toy";
      info.kind = "procedural";
      info.generator = generator;
    } else if (toy.kind === "builtin") {
      const def = findToy(toy.id) || findToy("blob");
      if (def.kind === "procedural")
        return this.loadToy({ kind: "builtin", id: def.id }, { onProgress });
      const url = assetURL(this.profile === "low" && def.urlWeak ? def.urlWeak : def.url);
      progress(0, `Loading ${def.label}…`);
      const bytes = await fetchBytes(url, (f) => progress(f * 0.9, `Loading ${def.label}…`));
      if (token !== this.loadToken) return null;
      const asset = await loadNative(this.stage, bytes, url.split("/").pop());
      if (token !== this.loadToken) {
        asset.unload();
        return null;
      }
      this.disposeProcedural();
      const rig = RIGS[def.id] || null;
      this.stage.setToy({
        resource: asset.resource,
        asset,
        transform: def.transform || null,
        rig: !!rig,
      });
      info = this.measure(asset.resource, def.transform);
      Object.assign(info, { id: def.id, label: def.label, kind: "captured", credit: def.credit });
      if (rig) {
        this.attachRig(def.id, rig, info);
      }
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
    this.patternOn = false;
    this.applyPattern();
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
    if (info.rig) tagRig(this.stage, info.rig);
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

  async buildProcedural(generator, clay, token, progress, rig = null) {
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
    const container = this.makeContainer(ctx.buf, rig ? "rig" : "kit");
    this.disposeProcedural();
    this.stage.setToy({ resource: container, owned: true, kit: !rig, rig: !!rig });
    this.proc = { ctx, container, clay: clay.slice() };
    const b = ctx.buf.bounds();
    const half = [0, 1, 2].map((k) => Math.max(Math.abs(b.min[k]), Math.abs(b.max[k])));
    return {
      center: [0, 0, 0],
      half,
      radius: Math.max(...half),
      splats: ctx.buf.count,
      lum: meanLuminance(ctx.buf),
    };
  }

  // A toy from a pack: loads the pack module, builds the recipe with the
  // scene's options and clay, and shows it with its parts and behaviours.
  async buildKit(def, toy, token, progress) {
    progress(0, `Building ${def.label}…`);
    const mod = await import(`./packs/${def.pack}.js`);
    if (token !== this.loadToken) return null;
    const recipe = mod.RECIPES?.[def.id];
    if (!recipe) throw new Error(`${def.label} is missing from its pack.`);
    const prof = PROFILES[this.profile];
    const count = Math.round(Math.min(prof.maxCount, prof.defaultCount * (recipe.density ?? 1)));
    const options = resolveOptions(recipe, toy.options);
    const clay = toy.clay || [];
    const it = buildRecipe(
      recipe,
      { seed: recipe.seed ?? hash32(def.id), count, options, clay },
      applyClay,
    );
    let r = it.next();
    let last = performance.now();
    while (!r.done) {
      if (performance.now() - last > 30) {
        progress(r.value * 0.9, `Building ${def.label}…`);
        await nextFrame();
        last = performance.now();
        if (token !== this.loadToken) return null;
      }
      r = it.next();
    }
    const ctx = r.value;
    const container = this.makeContainer(ctx.buf);
    this.disposeProcedural();
    this.stage.setToy({ resource: container, owned: true, kit: true });
    this.proc = { ctx, container, clay: clay.slice(), kit: true };
    this.motion.setToy(recipe, ctx, this.scene.motion?.controls || {});
    const b = ctx.buf.bounds();
    for (const r of ctx.reaches || []) {
      for (let k = 0; k < 3; k++) {
        b.min[k] = Math.min(b.min[k], r[k]);
        b.max[k] = Math.max(b.max[k], r[k]);
      }
    }
    const half = [0, 1, 2].map((k) => Math.max(Math.abs(b.min[k]), Math.abs(b.max[k])));
    return {
      center: [0, 0, 0],
      half,
      radius: Math.max(...half),
      splats: ctx.buf.count,
      lum: ctx.lum,
      recipe,
      options,
      credit: def.credit || null,
    };
  }

  // Moving parts, effects and an add-on for a scan or a shelf shape (see
  // src/rigs.js). Rig coordinates are the world's, so the tap point needs
  // no transform.
  attachRig(id, rig, info) {
    const parts = rigLayout(rig).parts;
    const ctx = { parts, transform: null, rig: true, fx: rig.fx ? fxTable(rig, parts) : null };
    this.motion.setToy(rig, ctx, this.scene.motion?.controls || {});
    if (rig.addon) {
      const addon = this.buildAddon(id, rig.addon);
      this.stage.setAddon(this.makeContainer(addon.buf));
      this.motion.setAddon(addon);
    }
    info.recipe = rig;
    info.rig = rig;
  }

  // A scan rig's add-on, built in world coordinates (no fitting).
  buildAddon(id, addon) {
    const k = new Kit(hash32(`${id}-addon`), { count: addon.count ?? 8000, fit: false });
    addon.build(k);
    const it = k.emit();
    while (!it.next().done);
    return { buf: k.buf, parts: k.parts };
  }

  // kind "kit" carries the splatAnim stream; "rig" (a rigged shelf shape)
  // gets the splatPart stream from stage.setToy, so it has its own format.
  makeContainer(buf, kind = "kit") {
    const device = this.stage.device;
    if (!this.format) {
      this.format = pc.GSplatFormat.createDefaultFormat(device);
      this.format.addExtraStreams([
        { name: "splatAnim", format: pc.PIXELFORMAT_RGBA32F, storage: pc.GSPLAT_STREAM_RESOURCE },
      ]);
      this.rigFormat = pc.GSplatFormat.createDefaultFormat(device);
    }
    const format = kind === "rig" ? this.rigFormat : this.format;
    const container = new pc.GSplatContainer(device, buf.capacity, format);
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
    const ta = buf.anim ? container.getTexture("splatAnim") : null;
    const anim = ta ? ta.lock() : null;
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
      if (anim) {
        anim[i4] = buf.anim[i4];
        anim[i4 + 1] = buf.anim[i4 + 1];
        anim[i4 + 2] = buf.anim[i4 + 2];
        anim[i4 + 3] = buf.anim[i4 + 3];
      }
    }
    if (ta) ta.unlock();
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
    this.applyPattern();
    for (const [k, v] of Object.entries(scene.motion?.controls || {}))
      this.motion.setControl(k, v, { snap: true });
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

  // ---- Pattern and motion ------------------------------------------------------

  // Draws the scene's pattern for the current toy and uploads it.
  async applyPattern() {
    const token = ++this.patternToken;
    const p = this.scene.pattern;
    if (!this.stage || !this.toyInfo || !p || p.id === "none") {
      this.patternOn = false;
      this.stage?.setPatternCanvas(null);
      return;
    }
    try {
      this.patternCanvas ||= document.createElement("canvas");
      const canvas = await drawPattern(p, this.toyInfo.half, this.patternCanvas);
      if (token !== this.patternToken) return;
      this.patternOn = !!canvas;
      this.stage.setPatternCanvas(canvas);
    } catch (err) {
      if (token !== this.patternToken) return;
      this.patternOn = false;
      this.stage.setPatternCanvas(null);
      this.emit("message", err.message);
    }
  }

  setPattern(pattern) {
    this.scene.pattern = pattern;
    return this.applyPattern();
  }

  // Motion as it should run now: under reduced motion nothing moves by
  // itself until the visitor turns motion on.
  effectiveMotion() {
    const m = this.scene.motion;
    if (this.motionAllowed) return m;
    return { ...m, alive: false, move: "still" };
  }

  setMotion(partial, { explicit = true } = {}) {
    if (explicit) this.motionAllowed = true;
    this.scene.motion = { ...this.scene.motion, ...partial };
    this.stage.requestRender();
  }

  setControl(key, value) {
    this.motion.setControl(key, value);
    this.scene.motion.controls = { ...this.scene.motion.controls, [key]: value };
    this.stage.requestRender();
  }

  // The toy's tap action (open the lid, blow out the candles), or a hop.
  // `world` is where a tap on the toy landed (null from the Play button).
  act(world = null) {
    const r = this.motion.act(this.time, world ? this.toRecipe(world) : null);
    if (r.key !== "hop") {
      this.scene.motion.controls = {
        ...this.scene.motion.controls,
        [r.key]: this.motion.targets[r.key],
      };
    }
    this.stage.requestRender();
    this.emit("action", r);
    return r;
  }

  // A world point in the current toy's recipe coordinates: a kit toy's
  // build space (before it was centred and scaled), else the world.
  toRecipe(world) {
    const tf = this.motion.ctx?.transform;
    if (!tf || !this.stage.toy) return world.slice();
    const m = this.stage.worldToModel(world);
    return [0, 1, 2].map((i) => m[i] / tf.scale + tf.center[i]);
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
    const motion = this.effectiveMotion();
    Object.assign(
      u,
      this.motion.compute({
        time: this.time,
        dt: this.frozen ? 0 : dt,
        motion,
        info,
        cameraPos: pose.position,
      }),
      patternUniforms(this.scene.pattern, info.half, info.lum ?? 0.5, this.patternOn),
    );
    if (info.rig) u.uSpRigDbg = [this.rigDebug ? 1 : 0, 0, 0, 0];
    this.stage.setUniforms(u);
    if (this.motion.addonU) {
      this.stage.setAddonUniforms({ ...u, ...this.motion.addonU, uSpPat: [0, 0, 0, 0] });
    }
    const dripping = this.painter.tick(this.time, (s) => this.scene.paint.stamps.push(s));
    const animating =
      this.driver.isAnimating(effects, this.time) ||
      this.motion.isAnimating(motion, this.time) ||
      this.idle.weight > 0;
    const busy = moving || animating || dripping || !!this.stroke;
    if (busy) {
      this.pickDirty = this.pickDirty || animating;
      this.stage.requestRender();
    }
    this.stage.setBusy(busy && !this.loading);
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

  // Drag-to-stretch, for toys whose recipe or rig has `grab: { radius }`
  // (in toy radii): the grabbed point follows the pointer across a plane
  // facing the camera, pulling the toy near it along; letting go springs
  // it back. The pull is capped at about one toy radius.
  canGrab() {
    return !!this.toyInfo?.recipe?.grab;
  }

  grabStart(world, x, y) {
    const info = this.toyInfo;
    const g = info.recipe.grab;
    const ray = this.stage.ray(x, y);
    this.grabPlane = { point: world.slice(), normal: ray.dir.slice() };
    this.driver.grabStart(world, (g.radius ?? 0.5) * info.radius);
    this.stage.requestRender();
  }

  grabAt(x, y) {
    const pl = this.grabPlane;
    if (!pl) return;
    const ray = this.stage.ray(x, y);
    const n = pl.normal;
    const den = ray.dir[0] * n[0] + ray.dir[1] * n[1] + ray.dir[2] * n[2];
    if (Math.abs(den) < 1e-4) return;
    const t =
      ((pl.point[0] - ray.origin[0]) * n[0] +
        (pl.point[1] - ray.origin[1]) * n[1] +
        (pl.point[2] - ray.origin[2]) * n[2]) /
      den;
    let pull = [0, 1, 2].map((i) => ray.origin[i] + ray.dir[i] * t - pl.point[i]);
    const max = (this.toyInfo.recipe.grab.max ?? 1) * this.toyInfo.radius;
    const len = Math.hypot(...pull);
    // A soft cap: it stretches less the further it goes.
    if (len > 1e-6) pull = pull.map((v) => (v / len) * max * Math.tanh(len / max));
    this.driver.grabTo(pull);
    this.stage.requestRender();
  }

  // Lets go. Returns how far it was stretched, in toy radii.
  grabEnd() {
    this.grabPlane = null;
    const r = this.driver.grabEnd(this.time);
    this.stage.requestRender();
    return r * (this.driver.grab.radius / this.toyInfo.radius);
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
    if (this.toyInfo?.rig) tagRig(this.stage, this.toyInfo.rig);
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

// A kit recipe's options with the scene's values checked against their types.
export function resolveOptions(recipe, given = {}) {
  const out = {};
  for (const o of recipe.options || []) {
    const v = given?.[o.key];
    if (o.type === "color") out[o.key] = /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : o.default;
    else if (o.type === "select") out[o.key] = o.choices.some((c) => c.id === v) ? v : o.default;
    else if (o.type === "switch") out[o.key] = typeof v === "boolean" ? v : !!o.default;
    else {
      const n = Number(v);
      out[o.key] =
        v !== undefined && Number.isFinite(n)
          ? Math.min(o.max ?? 1, Math.max(o.min ?? 0, n))
          : o.default;
    }
  }
  return out;
}

function normalize3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export { Gestures };
