// The Splashery runtime shared by the app, the embed player and the
// <splashery-toy> element: loads a toy, runs the clock, the camera, the
// effect uniforms, idle behaviour and the pointer tools, and renders only
// when something changes.

import * as pc from "./pc.js";
import { Stage, NoGPUError } from "./stage.js";
import { OrbitCamera, Gestures } from "./camera.js";
import { EffectDriver, hexToRgb, KINDS } from "./effects.js";
import { Painter } from "./paint.js";
import { generate, normalizeGenerator, applyClay, PROFILES } from "./generators.js";
import { buildRecipe, meanLuminance, Kit } from "./kit.js";
import { MotionDriver } from "./motion.js";
import { rigLayout, tagRig } from "./rig.js";
import { posePass } from "./pose.js";
import { poseUniforms, poseUp, poseGravity } from "./effects-pose.js"; // lane Any pose
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
import { findToy, assetURL, lookOption, pickLook, labsOn } from "./toys.js";

// UI r2: focus mode, the sheet's extra stops, the desktop panel's fold and
// gallery page, the finer drawing pad and moving (panning) a toy. They showed
// behind the labs switch until the owner's marks (all eight good); since
// October 1, 2026 they are on for everyone.
export function ui2On() {
  return true;
}
import { pickKernel } from "./kernels.js"; // Lab
import { pickSharpness, sharpOff } from "./sharpness.js"; // Sharpness
import { createScene, THEMES } from "./state.js";
import { mulberry32, mixSeed, hash32 } from "./noise.js";
import { Pictures } from "./pictures.js"; // Pictures
import { HandsOn } from "./physics/hands-on.js"; // lane Physics

export { NoGPUError };

// Device tiers, lowest first. Each has a splat budget (PROFILES in
// generators.js) and a pixel-ratio cap for the canvas. The mid and high tiers
// draw at up to 3 since September 29, 2026 (lane Sharpness, the owner's "sharp
// yes"); ?sharp=0 puts back the caps from before.
export const TIERS = ["low", "mid", "high", "max"];
export const PIXEL_RATIO = { low: 1.5, mid: 3, high: 3, max: 3 };
export const PIXEL_RATIO_BEFORE = { low: 1.5, mid: 2, high: 2, max: 3 };
const pixelCap = (tier) =>
  (sharpOff(new URLSearchParams(location.search)) ? PIXEL_RATIO_BEFORE : PIXEL_RATIO)[tier];
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
    this.handsOn = new HandsOn(this); // lane Physics
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
      pixelRatio: pixelCap(this.profile),
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
    this.stage.setPixelRatio(pixelCap(tier));
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
    // A kit toy that switches its own options (a periodic table tile,
    // Player.switchTo) keeps moving as it was until the new build replaces
    // it, so its hidden parts stay hidden while it stays on screen (lane Fix6).
    const same = this.switching && shelfDef?.kind === "kit" && this.toyInfo?.kind === "kit" && this.toyInfo.id === shelfDef.id; // prettier-ignore
    if (!same) this.motion.setToy(null, null);
    if (shelfDef?.kind === "kit") {
      info = await this.buildKit(shelfDef, toy, token, progress);
      if (!info) return null;
      Object.assign(info, { id: shelfDef.id, label: shelfDef.label, kind: "kit" });
    } else if (
      toy.kind === "procedural" ||
      (toy.kind === "builtin" && findToy(toy.id)?.kind === "procedural")
    ) {
      const preset = toy.kind === "builtin" ? findToy(toy.id) : null;
      // A shelf shape may come in looks (the tiny planet's planets): the
      // look's generator settings go over the shelf's. Only its id is saved.
      const look = preset ? pickLook(preset, toy.options) : null;
      const generator = normalizeGenerator(
        preset
          ? { ...preset.generator, ...look?.generator, count: PROFILES[this.profile].defaultCount }
          : toy.generator,
        this.profile,
      );
      // A shelf shape keeps its rig (its tap effect) while its shape and
      // colours are the shelf's (any of its looks'), even when edited with clay.
      const shelf = preset || (toy.id ? findToy(toy.id) : null);
      const palettes = shelf?.generator ? [shelf.generator.palette, ...(shelf.looks || []).map((l) => l.generator?.palette)] : []; // prettier-ignore
      const same = shelf?.generator && generator.shape === shelf.generator.shape && palettes.includes(generator.palette); // prettier-ignore
      const rig = same ? RIGS[shelf.id] || null : null;
      info = await this.buildProcedural(generator, toy.clay || [], token, progress, rig);
      if (!info) return null;
      if (rig) this.attachRig(shelf.id, rig, info);
      // A shelf toy edited with clay keeps its name.
      info.id = shelf ? shelf.id : null;
      info.label = preset ? preset.label : shelf ? `${shelf.label}, edited` : "Your toy";
      info.kind = "procedural";
      info.generator = generator;
      if (look) {
        info.options = { look: look.id };
        info.optionDefs = [lookOption(preset)];
      }
    } else if (toy.kind === "builtin") {
      const def = findToy(toy.id) || findToy("blob");
      if (def.kind === "procedural")
        return this.loadToy({ kind: "builtin", id: def.id }, { onProgress });
      // A scan may come in several looks (colours, a label): the scene's
      // `look` option picks one, and a missing or unknown look is the first.
      const look = pickLook(def, toy.options);
      const src = look?.url ? look : def;
      const url = assetURL(this.profile === "low" && src.urlWeak ? src.urlWeak : src.url);
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
      if (look) {
        info.options = { look: look.id };
        info.optionDefs = [lookOption(def)];
      }
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
    this.handsOn.attach(info); // lane Physics
    // Lab: a sharper splat kernel, labs only (src/kernels.js).
    const kernelParam = new URLSearchParams(location.search).get("kernel");
    this.stage.setKernel(pickKernel({ labs: labsOn(), param: kernelParam, recipe: info.kernel }));
    // Sharpness: the render levers (src/sharpness.js): adapt "drag" for
    // every toy, the rest labs only.
    this.stage.setSharpness(
      pickSharpness({
        labs: labsOn(),
        params: new URLSearchParams(location.search),
        recipe: info.recipe?.render,
        native: window.devicePixelRatio || 1,
      }),
    );
    // Lab r2: a recipe may lower the alpha a tap needs to find its splats.
    this.stage.setPickAlpha(info.pickAlpha ?? null);
    if (!this.pictures) this.closeMedia(); // Pictures
    this.patternOn = false;
    this.applyPattern();
    this.camera.fit(info.radius, info.center);
    // Pictures: a page viewer comes close enough to read a page's small print.
    if (this.pictures) this.camera.minDistance = info.radius * 0.3;
    // Science r2: a recipe's closeUp ({ minDistance } in toy radii) lets the
    // camera come that close, so a pinch or the wheel zooms all the way in
    // (the near clip follows; see Stage.setCameraPose).
    const close = info.closeUp?.minDistance;
    this.stage.nearFollow = Number.isFinite(close) && close > 0;
    if (this.stage.nearFollow) this.camera.minDistance = info.radius * close;
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
    // A recipe may read a data file first (the protein toy's structure).
    if (recipe.prepare) {
      // The third argument tells it the device's profile (lane Fidelity: a
      // toy made of trained files loads its lite files on "low").
      await recipe.prepare(options, this.prepareHelp(toy, recipe, options), { profile: this.profile }); // prettier-ignore
      if (token !== this.loadToken) return null;
    }
    // Pictures (lane Books): a picture toy's media opens first, so the
    // build can size itself from it (k.media).
    let media = null;
    if (recipe.pictures) {
      media = await this.pictureMediaFor(toy, recipe, options);
      if (token !== this.loadToken) return null;
    }
    const clay = toy.clay || [];
    const it = buildRecipe(
      recipe,
      { seed: recipe.seed ?? hash32(def.id), count, options, clay, media: mediaInfo(media) },
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
    // Lab: a recipe may bring its own GPU program for its splats (a field).
    const modifier = labsOn() ? recipe.gpuField?.(options, ctx.transform) || null : null;
    this.stage.setToy({ resource: container, owned: true, kit: true, modifier });
    this.proc = { ctx, container, clay: clay.slice(), kit: true };
    this.motion.setToy(recipe, ctx, this.scene.motion?.controls || {});
    this.screen = null;
    if (recipe.screen) {
      // A live picture drawn by the recipe (the laptop's display).
      const canvas = document.createElement("canvas");
      canvas.width = recipe.screen.width;
      canvas.height = recipe.screen.height;
      this.screen = { recipe, canvas, g: canvas.getContext("2d"), version: null };
      recipe.screen.reset?.();
    }
    this.startPictures(ctx, toy, recipe, options); // Pictures
    this.startFluids(ctx, token); // Fluids
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
      kernel: recipe.kernel, // Lab
      pickAlpha: recipe.pickAlpha, // Lab r2
      closeUp: recipe.closeUp || null, // Science r2
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

  // Splats are depth-sorted in the pose they were built in, so a token
  // (a game piece) moved far from its built place, say from the back of a
  // toy to its front, draws in the wrong order. This sorts a kit toy's
  // token splats again at the places the current token uniforms put them
  // (the same move as the kit shader's: a turn about the origin, then the
  // offset). The recipe asks for it by setting out.resort on a frame where
  // its pieces have settled; it is a one-off cost, not for every frame.
  resortTokens() {
    const proc = this.proc;
    if (!proc?.kit || !proc.ctx?.buf?.anim) return 0;
    const { buf } = proc.ctx;
    const centers = proc.container.centers;
    const td = this.motion.tokenData;
    let n = 0;
    for (let i = 0; i < buf.count; i++) {
      const i3 = i * 3;
      const i4 = i * 4;
      const kind = Math.round(buf.anim[i4 + 1]);
      // Lane Hands engine C: skin splats (ropes, cloth) at their blend.
      if (kind === KINDS.skin || kind === KINDS.skin4) {
        const sk = skinOffset(td, kind, buf.anim[i4 + 2], buf.anim[i4 + 3]);
        for (let k = 0; k < 3; k++) centers[i3 + k] = buf.pos[i3 + k] + sk[k];
        n++;
        continue;
      }
      if (kind !== KINDS.token) continue;
      const o = Math.min(47, Math.max(0, Math.round(buf.anim[i4 + 2]))) * 8;
      let [x, y, z, w] = [td[o + 4], td[o + 5], td[o + 6], td[o + 7]];
      if (!x && !y && !z && !w) w = 1;
      const px = buf.pos[i3];
      const py = buf.pos[i3 + 1];
      const pz = buf.pos[i3 + 2];
      // v + 2 u x (u x v + w v), with u = (x, y, z).
      const cx = y * pz - z * py + w * px;
      const cy = z * px - x * pz + w * py;
      const cz = x * py - y * px + w * pz;
      centers[i3] = px + 2 * (y * cz - z * cy) + td[o];
      centers[i3 + 1] = py + 2 * (z * cx - x * cz) + td[o + 1];
      centers[i3 + 2] = pz + 2 * (x * cy - y * cx) + td[o + 2];
      n++;
    }
    if (n) {
      proc.container.update(buf.count, true);
      this.stage.requestRender();
    }
    return n;
  }

  // Lane Books: splats sort in the pose they were built in, so a part or a
  // leaf (a book's page) turned past a quarter turn draws its far side over
  // its near side, and a turned cover over the pages it lies under. This
  // sorts the kit toy's splats on parts and leaves, and the picture sheets
  // on them, again where the current uniforms put them (the kit shader's
  // leaf turn, then its part move; tokens keep resortTokens). The recipe
  // asks for it with out.resortPose, a few times while things turn and once
  // when they land; each call costs a pass over those splats.
  resortPose() {
    const proc = this.proc;
    if (!proc?.kit || !proc.ctx?.buf?.anim) return 0;
    const leaf = this.leafUniform();
    const parts = this.motion.partsData;
    let n = 0;
    const { buf } = proc.ctx;
    n += posePass(buf.pos, buf.anim, buf.count, proc.container.centers, leaf, parts);
    if (n) proc.container.update(buf.count, true);
    for (const sh of this.pictures?.sheets || []) {
      const d = sh.shown?.data;
      if (!sh.slot || !d || (sh.def.leaf === null && !sh.def.part)) continue;
      const m = posePass(d.centers, d.anim, d.count, sh.slot.container.centers, leaf, parts);
      if (m) sh.slot.container.update(d.count, true);
      n += m;
    }
    if (n) this.stage.requestRender();
    return n;
  }

  disposeProcedural() {
    this.proc = null;
    // Fluids: the old toy's fluids stop with it.
    this.fluids?.destroy();
    this.fluids = null;
    // Pictures: the old toy's sheets go with it.
    if (this.pictures) this.camera.setTurntable(this.scene.autoplay.turntable);
    this.pictures?.destroy();
    this.pictures = null;
    this.stage.setPictureCulling(false);
  }

  // ---- Fluids (lane Fluids) -------------------------------------------------------------
  // A kit toy whose recipe declared k.fluid(...) gets its fluids simulated
  // and drawn (src/fluids/runtime.js). The module loads only then, so the
  // shelf and embeds never fetch it.
  async startFluids(ctx, token) {
    const specs = ctx.kit?.fluids;
    if (!specs?.length) return;
    const { FluidRuntime, envelopeOn } = await import("./fluids/runtime.js");
    if (token !== this.loadToken || this.proc?.ctx !== ctx) return;
    this.fluids = new FluidRuntime(this.stage, specs, {
      profile: this.profile,
      seed: ctx.g?.seed ?? 1,
      transform: ctx.transform,
      // Fluids r4: the liquid's sounds come from the simulation.
      onCue: (cues) => !this.frozen && this.emit("cue", cues),
      // Fluids r7: the phone envelope, and what to tell the person when frames stay slow.
      phone: envelopeOn(),
      onNotice: (text) => this.emit("message", text),
    });
  }

  // ---- Pictures (lane Pictures) ----------------------------------------------------
  // A kit toy with picture sheets (k.sheet) shows media on them: the scene's
  // media web address (toy.media.url), a file opened on this device
  // (this.mediaFile, never saved), or the recipe's own sample
  // (recipe.pictures.sample(options), a path under the site). The media is
  // opened once and kept while the same source shows.

  startPictures(ctx, toy, recipe, options) {
    const defs = ctx.kit?.sheets;
    this.stage.setPictureCulling(!!defs?.length);
    if (!defs?.length) {
      this.closeMedia();
      return;
    }
    const pics = new Pictures(this, {
      defs,
      transform: ctx.transform,
      spine: ctx.kit.spineDef || null,
      profile: this.profile,
      // Lane Books: the recipe may draw on each page or picture before it
      // becomes splats (a photo album's photo corners and captions).
      decorate: recipe.pictures?.decorate
        ? (canvas, info) => recipe.pictures.decorate(canvas, { ...info, options: options || {} })
        : null,
    });
    pics.setSound(this.mediaSound);
    this.pictures = pics;
    ctx.kit.data ||= {};
    ctx.kit.data.pictures = pics.api;
    const src = this.mediaSource(toy, recipe, options);
    if (!src) {
      this.closeMedia();
      return;
    }
    this.openPictureMedia(src).ready.then((m) => {
      if (this.pictures !== pics || !m) return;
      pics.setMedia(m);
      if (src.page) pics.go(src.page);
    });
  }

  // Opens a picture toy's media once and keeps it while the same source
  // shows: { key, media, ready } (ready resolves to the media, or null when
  // it could not be opened, after saying why).
  // A build tries again after a failure (retry); the toy it builds keeps
  // that answer, so a message is said once.
  openPictureMedia(src, { retry = false } = {}) {
    const had = this.pictureMedia;
    if (had?.key === src.key && !(retry && had.failed)) return had;
    this.closeMedia();
    const entry = { key: src.key, media: null };
    entry.ready = import("./media.js")
      .then(({ openMedia }) => openMedia(src.source, { profile: this.profile }))
      .then(
        (m) => {
          entry.media = m;
          if (this.pictureMedia !== entry) {
            m.close();
            return null;
          }
          this.emit("media", { ok: true, kind: m.kind, name: m.name, count: m.count });
          return m;
        },
        (err) => {
          entry.failed = true;
          this.emit("media", { ok: false, error: err.message, source: src });
          this.emit("message", err.message);
          return null;
        },
      );
    this.pictureMedia = entry;
    return entry;
  }

  // The media a picture toy will show, opened before its build (lane
  // Books), or null.
  async pictureMediaFor(toy, recipe, options) {
    const src = this.mediaSource(toy, recipe, options);
    if (!src) return null;
    const entry = this.openPictureMedia(src, { retry: true });
    return (await entry.ready) || null;
  }

  // Where the toy's media comes from: { key, source, page }.
  mediaSource(toy, recipe, options) {
    // A live stream (lane Live input) on the toy that started it; never saved in the scene.
    const lv = this.liveMedia;
    if (lv && lv.toy === toy.id) return { key: lv.key, source: lv.source, page: 0 };
    const m = toy.media;
    if (m?.file && this.mediaFile && this.mediaFile.name === m.file.name)
      return { key: mediaKey(this.mediaFile), source: this.mediaFile, page: m.page || 0 };
    // A set of pictures from this device (lane Books): the same files, by name.
    const own = this.mediaFile;
    if (
      m?.files &&
      Array.isArray(own) &&
      own.length === m.files.length &&
      own.every((f, i) => f.name === m.files[i].name)
    )
      // prettier-ignore
      return { key: mediaKey(own), source: own, page: m.page || 0 };
    if (m?.url) return { key: mediaKey(m.url), source: m.url, page: m.page || 0 };
    const sample = recipe.pictures?.sample?.(options || {});
    if (Array.isArray(sample) && sample.length) {
      // A sample may be a set of pictures (lane Books).
      const urls = sample.map((p) => assetURL(p));
      return { key: mediaKey(urls), source: urls, page: 0 };
    }
    if (sample) {
      const url = assetURL(sample);
      return { key: `url:${url}`, source: url, page: 0 };
    }
    return null;
  }

  // What a picture toy's prepare(options, help) may use (lane Screens: the
  // Gaussian splatting toy learns the photo it shows): help.media() opens
  // the media this build will show (the scene's address, the file opened on
  // this device, or the recipe's sample) and resolves with it, or with null
  // when it can't be read; the build then shows the same media, opened once.
  prepareHelp(toy, recipe, options) {
    if (!recipe.pictures) return {};
    return {
      media: () => {
        const src = this.mediaSource(toy, recipe, options);
        if (!src) return Promise.resolve(null);
        if (this.pictureMedia?.key !== src.key) {
          this.closeMedia();
          const entry = { key: src.key, media: null };
          entry.ready = import("./media.js")
            .then(({ openMedia }) => openMedia(src.source, { profile: this.profile }))
            .then(
              (m) => {
                entry.media = m;
                if (this.pictureMedia !== entry) {
                  m.close();
                  return null;
                }
                return m;
              },
              () => {
                if (this.pictureMedia === entry) this.pictureMedia = null;
                return null;
              },
            );
          this.pictureMedia = entry;
        }
        return this.pictureMedia.ready;
      },
    };
  }

  // Media the app has opened already (to show its errors before anything
  // changes); the next build uses it.
  adoptMedia(source, media) {
    this.closeMedia();
    this.pictureMedia = { key: mediaKey(source), media, ready: Promise.resolve(media) };
  }

  closeMedia() {
    if (this.pictures?.media) this.pictures.setMedia(null);
    const e = this.pictureMedia;
    this.pictureMedia = null;
    if (e) e.ready?.then(() => e.media?.close());
  }

  // The site's Sound, handed to recipes' drive as info.sound (a toy that
  // plays its own audio, like the song landscape).
  setSound(sound) {
    this.motion.sound = sound || null;
  }

  // Video sound follows the site's speaker button; embeds keep it off.
  setMediaSound(on) {
    this.mediaSound = !!on;
    this.pictures?.setSound(this.mediaSound);
  }

  // The leaves' uniform (kind "leaf"): the spine's point, axis and page
  // direction, then (angle, curl) for up to ten leaves from drive's
  // out.leaves = [{ angle, curl }] (radians; curl per toy unit).
  leafUniform() {
    const d = (this.leafData ||= new Float32Array(32));
    d.fill(0);
    const sp = this.pictures?.spine;
    if (sp) {
      d.set(sp.at, 0);
      d.set(sp.axis, 4);
      d.set(sp.dir, 8);
    }
    const leaves = this.motion.out?.leaves || [];
    for (let i = 0; i < Math.min(10, leaves.length); i++) {
      const l = leaves[i] || {};
      d[12 + i * 2] = Number.isFinite(l.angle) ? l.angle : 0;
      d[13 + i * 2] = Number.isFinite(l.curl) ? l.curl / (this.pictures?.fitScale || 1) : 0;
    }
    return d;
  }

  // Moves the view across a picture toy (a page seen close up): the finger
  // drags the picture. Stays within the toy. UI r2: any toy pans (the camera
  // does the move and the clamp), and a picture toy's pan is the same one.
  panBy(dx, dy) {
    this.camera.panBy(dx, dy);
    this.stage.requestRender();
  }

  // ---- Page focus (lane Books) ----------------------------------------------------
  // A recipe that can look closely at part of itself (a book's page) has
  // `focus(point, time)`: a double-tap at a point (recipe coordinates; null
  // off the toy, or when a zoom out lets go) focuses or lets go, and returns
  // true when the recipe took it. The recipe says what to show in
  // `out.view`: { key, center, size } (a rectangle facing the front, in
  // recipe coordinates) or { key } alone for the whole toy; each new key
  // glides the view there. Zooming out from a focused view lets it go.
  canFocus() {
    return !!this.toyInfo?.recipe?.focus;
  }

  focusAt(world) {
    const f = this.toyInfo?.recipe?.focus;
    if (!f) return false;
    const took = f(world ? this.toRecipe(world) : null, this.time);
    this.stage.requestRender();
    return !!took;
  }

  // Follows the recipe's out.view; true while the view glides.
  followView() {
    const cam = this.camera;
    const recipe = this.toyInfo?.recipe;
    const v = recipe?.focus ? this.motion.out?.view : null;
    if (!v) {
      // (Kept while the same toy rebuilds; another toy starts afresh.)
      if (!recipe?.focus) this.pageView = null;
      return false;
    }
    const was = this.pageView;
    if (!was || was.focus !== recipe.focus || was.key !== v.key) {
      // A toy that opens on its whole self keeps the view it opened with.
      // (A rebuild, for a new option, is the same toy: its recipe object is
      // new, its focus the same.)
      const first = !was || was.focus !== recipe.focus;
      // (Leaving the whole toy, the view it had is kept to come back to.)
      const back = first
        ? null
        : was.center
          ? was.back
          : { target: cam.target.slice(), ...cam.tgt };
      this.pageView = { focus: recipe.focus, key: v.key, dist: 0, center: !!v.center, back };
      if (v.center || !first) this.glideTo(v);
    }
    // A hand on the view stops the glide; a zoom out lets a page go.
    if (cam.dragging) this.glide = null;
    const g = this.glide;
    if (!g) {
      if (this.pageView.dist && cam.tgt.distance > this.pageView.dist * 1.2) {
        this.pageView.dist = 0;
        recipe.focus(null, this.time);
      }
      return false;
    }
    // (On the toy's clock, so it keeps pace with a page's turn.)
    const w = g.dur > 0 ? Math.min(1, Math.max(0, this.time - g.t0) / g.dur) : 1;
    const e = w < 0.5 ? 4 * w * w * w : 1 - Math.pow(-2 * w + 2, 3) / 2;
    const { from: a, to: b } = g;
    const turn = (x) => x - 2 * Math.PI * Math.round(x / (2 * Math.PI));
    for (let i = 0; i < 3; i++) cam.target[i] = a.target[i] + (b.target[i] - a.target[i]) * e;
    for (const k of ["yaw", "pitch", "roll"]) cam.tgt[k] = a[k] + turn(b[k] - a[k]) * e;
    cam.tgt.distance = a.distance + (b.distance - a.distance) * e;
    cam.interact();
    if (w >= 1) this.glide = null;
    return true;
  }

  glideTo(v) {
    const cam = this.camera;
    const from = { target: cam.target.slice(), ...cam.tgt };
    let to;
    if (v.center && v.size) {
      const [x, y, z] = v.center;
      const c = this.fromRecipe(v.center);
      const len = (p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
      const hw = len(this.fromRecipe([x + v.size[0] / 2, y, z]));
      const hh = len(this.fromRecipe([x, y + v.size[1] / 2, z]));
      // (The stage's field of view, 38 degrees, spans the narrower side.)
      const t = Math.tan((19 * Math.PI) / 180);
      const aspect = (this.canvas.clientWidth || 1) / (this.canvas.clientHeight || 1);
      const [th, tv] = aspect < 1 ? [t, t / aspect] : [t * aspect, t];
      const d = Math.max(hh / tv, hw / th) * 1.05;
      cam.minDistance = Math.min(cam.minDistance, d * 0.6);
      to = { target: c, yaw: 0, pitch: 0, roll: 0, distance: d };
      this.pageView.dist = d;
    } else {
      const back = this.pageView.back;
      to = back ? { ...back, target: back.target.slice() } : { target: (this.toyInfo?.center || [0, 0, 0]).slice(), ...cam.home }; // prettier-ignore
    }
    cam.vel.yaw = cam.vel.pitch = 0;
    this.glide = { from, to, t0: this.time, dur: cam.reducedMotion ? 0 : 0.7 };
  }

  // ---- End of page focus ------------------------------------------------------------

  // A one-finger drag pans (instead of turning) on a picture toy seen close up.
  pansHere() {
    // Science r2: so does a toy with a closeUp, close up.
    const close = !!this.pictures || !!this.toyInfo?.closeUp;
    return close && this.camera.cur.distance < (this.toyInfo?.radius || 1) * 1.6;
  }

  // A container in the kit format for a picture sheet.
  pictureContainer(capacity) {
    return new pc.GSplatContainer(this.stage.device, capacity, this.format);
  }

  // ---- End of pictures ---------------------------------------------------------------

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
    // Page focus: no glide, and a page in view lets go to here.
    this.glide = null;
    if (this.pageView) this.pageView.back = null;
    this.camera.reset(); // UI r2: Reset also centers a moved view (pictures too)
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

  // A typed character (a real keyboard, while a toy that takes typing is
  // shown): the recipe's `typeKey(ch)` names the control and key it presses.
  // Returns false when the toy does not take that character.
  typeKey(ch) {
    const f = this.toyInfo?.recipe?.typeKey;
    const hit = f ? f(ch) : null;
    if (!hit) return false;
    const r = this.motion.act(this.time, null, hit);
    this.stage.requestRender();
    this.emit("action", r);
    return true;
  }

  // The toy's tap action (open the lid, blow out the candles), or a hop.
  // `world` is where a tap on the toy landed (null from the Play button).
  act(world = null) {
    // Lane Physics: pieces moved in Hands-on go home before the toy's tap.
    if (this.handsOn.mode === "pieces") this.handsOn.reset();
    const r = this.motion.act(this.time, world ? this.toRecipe(world) : null);
    if (r.options) {
      this.switchTo(r);
      return r;
    }
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

  // A tap that switches the toy: the recipe's action.at returned
  // { options, key, pick } (the periodic table's tiles pick the element).
  // The tap's sound plays at once; the toy is rebuilt with those options
  // (through `this.rebuild`, which the app sets to keep its panels in step),
  // starting at rest, and then `key` fires on the new toy.
  async switchTo(r) {
    const toy = this.scene.toy;
    const recipe = this.toyInfo?.recipe;
    const controls = { ...this.scene.motion.controls };
    for (const c of recipe?.controls || [])
      if (c.type === "pulse" || c.type === "toggle") delete controls[c.key];
    this.scene.motion.controls = controls;
    this.emit("action", r);
    const rebuild =
      this.rebuild ||
      ((options) => {
        toy.options = { ...(toy.options || {}), ...options };
        return this.loadToy(toy);
      });
    this.switching = true;
    try {
      await rebuild(r.options);
    } finally {
      this.switching = false;
    }
    if (this.scene.toy !== toy || !this.motion.controlDef(r.key)) return;
    const next = this.motion.act(this.time, null, { key: r.key, pick: r.pick });
    this.scene.motion.controls = { ...this.scene.motion.controls, [next.key]: this.motion.targets[next.key] }; // prettier-ignore
    this.stage.requestRender();
    this.emit("action", { ...next, echo: true });
  }

  // A world point in the current toy's recipe coordinates: a kit toy's
  // build space (before it was centred and scaled), else the world.
  toRecipe(world) {
    const tf = this.motion.ctx?.transform;
    if (!tf || !this.stage.toy) return world.slice();
    const m = this.stage.worldToModel(world);
    return [0, 1, 2].map((i) => m[i] / tf.scale + tf.center[i]);
  }

  // The inverse: a point in the current toy's recipe coordinates in the world.
  fromRecipe(p) {
    const tf = this.motion.ctx?.transform;
    if (!tf || !this.stage.toy) return p.slice();
    return this.stage.modelToWorld([0, 1, 2].map((i) => (p[i] - tf.center[i]) * tf.scale));
  }

  // Where a recipe point shows on the canvas (CSS pixels), for tests and clips.
  screenPoint(p) {
    return this.stage.toScreen(this.fromRecipe(p));
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
    // A toy whose recipe sets turntable: false keeps still, facing you: a
    // picture toy while its pictures show (as before), any other kit toy
    // always (lane Chemistry: the periodic table).
    const still = this.toyInfo.recipe?.turntable === false;
    if (still && (this.pictures || !this.toyInfo.recipe.pictures)) this.camera.turntable = false;
    const d = this.driver.drop;
    if (d.on && d.recallAt < 0) {
      const k = Math.min(1, (this.time - d.start) / 0.9) * d.floor * 0.5;
      this.camera.follow = [d.gravity[0] * k, d.gravity[1] * k, d.gravity[2] * k];
    } else {
      // Lane Physics: the view drifts after a toy tossed in Hands-on.
      this.camera.follow = this.handsOn.follow() || [0, 0, 0];
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

    // Lane Physics: Hands-on play moves the toy, or its pieces.
    const handsBusy = !this.loading && this.handsOn.step(this.frozen ? 0 : dt);
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
    this.motion.poseUp = poseUp(this.stage); // lane Any pose
    Object.assign(
      u,
      this.motion.compute({
        time: this.time,
        dt: this.frozen ? 0 : dt,
        motion,
        info,
        cameraPos: pose.position,
        cameraDistance: pose.distance, // Science r2
      }),
      patternUniforms(this.scene.pattern, info.half, info.lum ?? 0.5, this.patternOn),
    );
    const sq = this.handsOn.squishUniforms(); // lane Physics
    u.uSpBodyS = sq ? [sq.axis[0], sq.axis[1], sq.axis[2], sq.amount] : [0, 1, 0, 0];
    u.uSpBodyP = sq ? [sq.pivot[0], sq.pivot[1], sq.pivot[2], 0] : [0, 0, 0, 0];
    // Lane Any pose: a toy posed whole (Hands-on) has its effects worked out in its own frame.
    const hs = this.handsOn.mode === "toy" ? this.handsOn.squish : null;
    const grav = poseGravity(info, info.id ? findToy(info.id) : null);
    poseUniforms(u, this.stage.toyPose, hs && { axis: hs.axis, point: hs.point, amount: this.handsOn.squishAmp() }, grav); // prettier-ignore
    if (info.rig) u.uSpRigDbg = [this.rigDebug ? 1 : 0, 0, 0, 0];
    if (info.kind === "kit") u["uSpLeaf[0]"] = this.leafUniform(); // Pictures
    this.stage.setUniforms(u);
    // Redraw a live screen when the recipe says its picture changed.
    const scr = this.screen;
    if (scr && scr.recipe === info.recipe) {
      const v = scr.recipe.screen.version(this.time);
      if (v !== scr.version) {
        scr.version = v;
        scr.recipe.screen.draw(scr.g, this.time);
        this.stage.setScreenCanvas(scr.canvas);
      }
    }
    // A toy that moves on by itself (the periodic table's tour) names new
    // options in out.next ({ options, key }): it is rebuilt as a tile tap
    // rebuilds it, without the tap's sound, and then `key` fires (lane Fix6).
    const next = this.motion.out?.next;
    if (next?.options && !this.movingOn && info.kind === "kit") {
      this.movingOn = true;
      this.switchTo({ ...next, echo: true }).finally(() => (this.movingOn = false));
    }
    this.pictures?.update(this.motion.out, this.time); // Pictures
    const gliding = this.followView(); // Page focus
    // Fluids: step the toy's fluids on its own clock, steered by out.fluid.
    if (this.fluids && info.kind === "kit") this.fluids.frame(u.uSpKit[0], this.motion.out?.fluid);
    if (this.motion.addonU) {
      this.stage.setAddonUniforms({ ...u, ...this.motion.addonU, uSpPat: [0, 0, 0, 0] });
    }
    const dripping = this.painter.tick(this.time, (s) => this.scene.paint.stamps.push(s));
    const animating =
      this.driver.isAnimating(effects, this.time) ||
      this.motion.isAnimating(motion, this.time) ||
      this.idle.weight > 0;
    const busy = moving || animating || dripping || !!this.stroke || gliding || handsBusy;
    if (busy) {
      this.pickDirty = this.pickDirty || animating || handsBusy;
      this.stage.requestRender();
    }
    const drag = !!this.camera.dragging || !!this.stroke; // Sharpness
    this.stage.setBusy(busy && !this.loading, drag && !this.loading);
    // A recipe's pieces moved far from where they were built (a cube's
    // turned layer): sort them again where they stand now.
    if (this.motion.out?.resort) this.resortTokens();
    // Lane Books: also when a page on a leaf or a part was just rebuilt (it
    // arrives sorted in its built pose).
    if (this.motion.out?.resortPose || this.poseStale) {
      this.poseStale = false;
      this.resortPose();
    }
    // Sounds a recipe asks for mid-effect (a chess move's clack).
    const cues = this.motion.out?.cues;
    if (cues?.length && !this.frozen) this.emit("cue", cues.slice());
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
    return !!(this.toyInfo?.recipe?.grab || this.toyInfo?.recipe?.drag);
  }

  // A recipe's own drag (the laptop's trackpad): `drag.at(point)` says
  // whether a drag starting there is the toy's; otherwise it orbits. The
  // pointer follows the horizontal plane the drag started on, or the plane
  // `drag.plane` names: "view" (facing the camera) or a normal in recipe
  // coordinates (or `(point) => normal`, such as the face of a cube).
  // Lane UI r4: `drag.start` and `drag.move` may return taps to fire, as a
  // tap on the toy would ({ key, pick }, or a list of them in order): a
  // glissando, a finger dragged across a keyboard's keys.
  dragStartsHere(world) {
    const d = this.toyInfo?.recipe?.drag;
    return !d || !!d.at(this.toRecipe(world));
  }

  grabStart(world, x, y) {
    const info = this.toyInfo;
    const drag = info.recipe.drag;
    if (drag) {
      this.dragY = world[1];
      const p = this.toRecipe(world);
      const n = typeof drag.plane === "function" ? drag.plane(p) : drag.plane;
      this.dragPlane = n ? { point: p, normal: n === "view" ? this.recipeRay(x, y).dir : n } : null; // prettier-ignore
      this.dragFired = false; // UI r4
      this.fireDrag(drag.start?.(p, this.time));
      this.stage.requestRender();
      return;
    }
    const g = info.recipe.grab;
    const ray = this.stage.ray(x, y);
    this.grabPlane = { point: world.slice(), normal: ray.dir.slice() };
    this.driver.grabStart(world, (g.radius ?? 0.5) * info.radius);
    this.stage.requestRender();
  }

  grabAt(x, y) {
    const drag = this.toyInfo?.recipe?.drag;
    if (drag && this.dragPlane) {
      // Across the recipe's own plane, in recipe coordinates.
      const { point: o, normal: n } = this.dragPlane;
      const ray = this.recipeRay(x, y);
      const den = ray.dir[0] * n[0] + ray.dir[1] * n[1] + ray.dir[2] * n[2];
      if (Math.abs(den) < 1e-4) return;
      const t = ((o[0] - ray.origin[0]) * n[0] + (o[1] - ray.origin[1]) * n[1] + (o[2] - ray.origin[2]) * n[2]) / den; // prettier-ignore
      if (t < 0) return;
      this.fireDrag(
        drag.move(
          [0, 1, 2].map((i) => ray.origin[i] + ray.dir[i] * t),
          this.time,
        ),
      );
      this.stage.requestRender();
      return;
    }
    if (drag) {
      // Across the horizontal plane the drag started on.
      const ray = this.stage.ray(x, y);
      if (Math.abs(ray.dir[1]) < 1e-4) return;
      const t = (this.dragY - ray.origin[1]) / ray.dir[1];
      const w = [0, 1, 2].map((i) => ray.origin[i] + ray.dir[i] * t);
      this.fireDrag(drag.move(this.toRecipe(w), this.time));
      this.stage.requestRender();
      return;
    }
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

  // UI r4: fires the taps a recipe's drag returned, in order, as taps on the
  // toy would (each sounds and moves its key); `dragFired` tells the app the
  // drag played, so letting go is not also a tap. Lane Sharpness B: a drag
  // may also set one of the toy's sliders ({ control, value }, 0..1), as a
  // knob dragged along the toy's own slider; the panel's slider follows
  // ("controls").
  fireDrag(taps) {
    if (!taps) return;
    for (const t of Array.isArray(taps) ? taps : [taps]) {
      if (t?.control && this.motion.controlDef(t.control)?.type === "slider") {
        this.setControl(t.control, Math.min(1, Math.max(0, Number(t.value) || 0)));
        this.dragFired = true;
        this.emit("controls", this.motion.targets);
        continue;
      }
      if (!t?.key || !this.motion.controlDef(t.key)) continue;
      const r = this.motion.act(this.time, null, { key: t.key, pick: t.pick ?? null });
      this.dragFired = true;
      this.emit("action", { ...r, drag: true });
    }
  }

  // The pointer's ray in the current toy's recipe coordinates (the
  // direction is a unit vector).
  recipeRay(x, y) {
    const ray = this.stage.ray(x, y);
    const o = this.toRecipe(ray.origin);
    const b = this.toRecipe(ray.origin.map((v, i) => v + ray.dir[i]));
    const d = [b[0] - o[0], b[1] - o[1], b[2] - o[2]];
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    return { origin: o, dir: [d[0] / l, d[1] / l, d[2] / l] };
  }

  // Lets go. Returns how far it was stretched, in toy radii.
  grabEnd() {
    const drag = this.toyInfo?.recipe?.drag;
    if (drag) {
      this.dragPlane = null;
      drag.end?.(this.time);
      this.stage.requestRender();
      return 0;
    }
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
    this.pictures?.destroy(); // Pictures
    this.closeMedia();
    this.painter?.detach();
    this.stage?.destroy();
  }
}

// Pictures: which media a source is (a file on this device, or an address).
// What a picture toy's build knows of its media (k.media, lane Books):
// its kind, page or picture count, name, the first page's shape (width over
// height) and, for a set of pictures, each one's shape and name.
export function mediaInfo(m) {
  if (!m) return null;
  const n = Math.min(m.count || 0, 500);
  const set = (m.names?.length ?? 0) > 1;
  return {
    kind: m.kind,
    count: m.count || 0,
    name: m.name || "",
    aspect: m.aspect?.(0) || 1,
    aspects: set ? Array.from({ length: n }, (_, i) => m.aspect(i) || 1) : null,
    names: set ? m.names.slice(0, n) : null,
  };
}

export function mediaKey(source) {
  if (Array.isArray(source)) return `set:${source.map(mediaKey).join("|")}`;
  return typeof source === "string"
    ? `url:${source}`
    : `file:${source.name}:${source.size}:${source.lastModified ?? 0}`;
}

// A kit recipe's options with the scene's values checked against their types.
export function resolveOptions(recipe, given = {}) {
  const out = {};
  for (const o of recipe.options || []) {
    const v = given?.[o.key];
    if (o.type === "color") out[o.key] = /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : o.default;
    else if (o.type === "select") out[o.key] = o.choices.some((c) => c.id === v) ? v : o.default;
    else if (o.type === "switch") out[o.key] = typeof v === "boolean" ? v : !!o.default;
    else if (o.type === "flag") out[o.key] = /^[a-z]{2}$/.test(v) ? v : o.default;
    else if (o.type === "text") out[o.key] = typeof v === "string" ? v : o.default;
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

// Lane Hands engine C: a skin splat's offset from its tokens (as the kit
// shader's kinds "skin" and "skin4" work it out).
function skinOffset(td, kind, z, w) {
  const tok = (i) => Math.min(47, Math.max(0, Math.round(i))) * 8;
  const at = (o, k) => td[o + k];
  if (kind === KINDS.skin) {
    const b = Math.floor(z / 64);
    const [oa, ob] = [tok(z - b * 64), tok(b)];
    return [0, 1, 2].map((k) => at(oa, k) + (at(ob, k) - at(oa, k)) * w);
  }
  const d = Math.floor(z / 262144);
  const c = Math.floor((z - d * 262144) / 4096);
  const r = z - d * 262144 - c * 4096;
  const b = Math.floor(r / 64);
  const [o0, o1, o2, o3] = [tok(r - b * 64), tok(b), tok(c), tok(d)];
  const sw = Math.floor(w / 1024);
  const t = (w - sw * 1024) / 1023;
  const s = sw / 1023;
  return [0, 1, 2].map((k) => {
    const top = at(o0, k) + (at(o1, k) - at(o0, k)) * s;
    const bot = at(o2, k) + (at(o3, k) - at(o2, k)) * s;
    return top + (bot - top) * t;
  });
}
