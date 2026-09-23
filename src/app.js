// Splashery app: the shelf, the tools, making toys, look, bring-your-own
// files and sharing, on top of the shared Player runtime.

import { Player, NoGPUError, Gestures } from "./player.js";
import { createUI } from "./ui.js";
import {
  createScene,
  normalizeScene,
  normalizeLook,
  THEMES,
  APP_NAME,
  formatBytes,
  formatCount,
  normalizeHex,
  normalizeMotion,
} from "./state.js";
import { defaultEffects, effectDef } from "./effects.js";
import { normalizePattern, flagInfo, loadFlags } from "./patterns.js";
import { Sound } from "./sound.js";
import { normalizeGenerator, PROFILES } from "./generators.js";
import { decodeSceneHash, parseHash } from "./codec.js";
import { TOYS, findToy } from "./toys.js";
import { extOf, readPlyHeader, decimatePly, resourceFromProps, LIMITS } from "./loaders.js";
import {
  downloadBlob,
  timestampName,
  canvasToBlob,
  encodeGIF,
  webmSupport,
  recordWebM,
  buildShareHash,
  shareURL,
  iframeSnippet,
  elementSnippet,
} from "./exports.js";

const canvas = document.getElementById("stage");

function showFallback(reason) {
  const fb = document.getElementById("fallback");
  if (reason) document.getElementById("fallback-reason").textContent += ` (${reason})`;
  fb.hidden = false;
  canvas.hidden = true;
  document.getElementById("panel").hidden = true;
  document.body.dataset.ready = "true";
}

class App {
  constructor() {
    this.player = null;
    this.ui = null;
    this.tool = "orbit";
    this.clayMode = "add";
    this.claySize = 0.4;
    this.busy = false;
    this.file = null; // { name, size, bytes | resource } for a user's own splat
    this.pendingLarge = null;
    this.spaceHeld = false;
    this.genTimer = 0;
    this.generator = null;
    this.toolState = null;
    this.sound = new Sound();
  }

  async start() {
    document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    this.player = new Player(canvas);
    try {
      await this.player.init();
    } catch (err) {
      console.info("Splashery could not start a renderer:", err?.message || err);
      showFallback(err instanceof NoGPUError ? "" : err?.message);
      return;
    }
    const player = this.player;
    this.ui = createUI(this);
    const ui = this.ui;
    player.on("theme", (theme) => {
      document.documentElement.dataset.theme = theme;
      ui.setLook(player.scene.look, theme);
    });
    player.on("message", (m) => ui.toast(m));
    player.on("effects", (fx) => ui.setEffects(fx));
    player.on("paint", (n) => ui.setPaintCount(n));
    player.on("toy", (info) => this.onToy(info));
    player.on("action", (r) => this.onAction(r));
    ui.setSound(this.sound.enabled);
    const wm = webmSupport();
    ui.setWebmUnavailable(wm.ok ? null : wm.reason);
    ui.setTool("orbit");
    ui.setClayMode("add");

    this.bindGestures();
    this.bindKeys();
    this.bindDrop();

    // Scene from the link, or the default.
    let scene = null;
    const { s } = parseHash(location.hash);
    if (s) {
      try {
        scene = normalizeScene(await decodeSceneHash(s), player.profile);
      } catch (err) {
        ui.toast(`Could not read the shared scene: ${err.message}`, 5000);
      }
    }
    if (!scene) scene = createScene({ toy: { kind: "builtin", id: TOYS[0].id } });
    try {
      await this.applyScene(scene);
    } catch (err) {
      ui.toast(err.message, 6000);
      await this.applyScene(createScene({ toy: { kind: "builtin", id: TOYS[0].id } }));
    }
    document.body.dataset.ready = "true";
  }

  // ---- Scenes -------------------------------------------------------------------

  async applyScene(scene, { file = null } = {}) {
    const player = this.player;
    const ui = this.ui;
    player.scene = scene;
    player.applyLook();
    ui.setEffects(scene.effects);
    ui.setAutoplay(scene.autoplay, player.reducedMotion);
    ui.setPaintCount(scene.paint.stamps.length);
    ui.setPattern(scene.pattern);
    if (scene.toy.kind === "file" && !file) {
      const name = scene.toy.file.name;
      ui.toast(
        `This link uses someone's own splat file (${name}). Drop that file here to see it with these settings.`,
        7000,
      );
      this.pendingFileScene = scene;
      scene = { ...scene, toy: { kind: "builtin", id: TOYS[0].id } };
      player.scene = scene;
    }
    await this.loadToy(scene.toy, { file });
    player.applySettings(scene);
    ui.setLook(scene.look, player.resolvedTheme());
    ui.setEffects(scene.effects);
    ui.setPattern(scene.pattern);
    ui.setMotion(scene.motion);
    this.updateStatus();
  }

  async loadToy(toy, { file = null } = {}) {
    const ui = this.ui;
    let shown = false;
    const timer = setTimeout(() => {
      shown = true;
      ui.progress.show("Loading…");
    }, 120);
    try {
      return await this.player.loadToy(toy, {
        file,
        onProgress: (f, label) => {
          if (!shown && f < 1) {
            shown = true;
            clearTimeout(timer);
            ui.progress.show(label);
          }
          ui.progress.update(f, label);
        },
      });
    } finally {
      clearTimeout(timer);
      ui.progress.hide();
    }
  }

  onToy(info) {
    const ui = this.ui;
    const player = this.player;
    const scene = player.scene;
    ui.setShelf(
      scene.toy.kind === "builtin"
        ? scene.toy.id
        : scene.toy.kind === "procedural"
          ? scene.toy.id
          : null,
    );
    this.updateStatus();
    canvas.setAttribute(
      "aria-label",
      `${info.label}, a toy made of ${formatCount(info.splats)} splats. Drag to turn it, scroll or pinch to zoom. With a tool selected, drag on the toy to use it.`,
    );
    if (info.kind === "procedural") {
      this.generator = { ...info.generator };
      ui.setGenerator(this.generator);
      ui.setGeneratorNote("");
    } else {
      this.generator =
        this.generator ||
        normalizeGenerator({ count: PROFILES[player.profile].defaultCount }, player.profile);
      ui.setGenerator(this.generator);
      ui.setGeneratorNote("Pick a shape and press Make it to build your own toy.");
    }
    const clayOK = info.kind === "procedural" || info.kind === "kit";
    ui.setClayAvailable(
      clayOK,
      clayOK ? "" : "Clay works on generated toys. Pick one or make one.",
    );
    ui.setToyPanel(info);
    ui.setFileToy(info.kind === "file", scene.toy.flip);
    this.renderCredits(info);
    ui.setRenderInfo(
      `Rendering with ${player.deviceType === "webgpu" ? "WebGPU" : "WebGL2"} · ${player.profile} device profile · ${formatCount(info.splats)} splats`,
    );
    if (this.ui.currentTab() === "share") this.updateEmbed();
  }

  renderCredits(info) {
    const nodes = [];
    const captured = TOYS.filter((t) => t.kind === "captured");
    if (!captured.length) {
      const p = document.createElement("p");
      p.className = "credit";
      p.textContent = "Every toy on the shelf is generated in your browser.";
      nodes.push(p);
    }
    for (const t of captured) {
      const c = t.credit;
      const p = document.createElement("p");
      p.className = "credit";
      const strong = document.createElement("strong");
      strong.textContent = t.label;
      const a = document.createElement("a");
      a.href = c.source;
      a.textContent = c.title || "source";
      const lic = document.createElement("a");
      lic.href = c.licenseUrl;
      lic.textContent = c.license;
      p.append(strong, `: “`, a, `” by ${c.author}, `, lic, c.changes ? `. ${c.changes}` : ".");
      if (info && info.id === t.id) p.setAttribute("aria-current", "true");
      nodes.push(p);
    }
    const p = document.createElement("p");
    p.className = "credit";
    p.textContent =
      "Every generated toy (the shapes and the toys from packs) is made in your browser from a recipe and a seed.";
    nodes.push(p);
    const f = document.createElement("p");
    f.className = "credit";
    const flags = document.createElement("a");
    flags.href = "https://commons.wikimedia.org/wiki/Category:SVG_flags_of_countries";
    flags.textContent = "Wikimedia Commons";
    f.append(
      document.createTextNode("National flags for patterns: public-domain files from "),
      flags,
      document.createTextNode(" (each source is listed in assets/flags/flags.json)."),
    );
    nodes.push(f);
    if (this.flagCredit) {
      const c = this.flagCredit;
      const q = document.createElement("p");
      q.className = "credit";
      const a = document.createElement("a");
      a.href = c.source;
      a.textContent = `Flag of ${c.name}`;
      q.append(a, document.createTextNode(`: ${c.license}, from Wikimedia Commons.`));
      q.setAttribute("aria-current", "true");
      nodes.push(q);
    }
    this.ui.setCredits(nodes);
  }

  // The status line under the toy: name, splats, credit and colours.
  async updateStatus() {
    const player = this.player;
    const info = player.toyInfo;
    if (!info) return;
    const parts = [info.label, `${formatCount(info.splats)} splats`];
    if (info.credit) parts.push(`by ${info.credit.author} (${info.credit.license})`);
    const pat = player.scene.pattern;
    this.flagCredit = null;
    if (pat.id === "flag" && pat.flag) {
      const f = await flagInfo(pat.flag);
      if (f) {
        parts.push(`in the colours of ${f.the ? "the " : ""}${f.name}`);
        this.flagCredit = f;
      }
    }
    this.ui.setStatus(parts.join(" · "));
    this.renderCredits(info);
  }

  async chooseToy(id) {
    if (this.busy) return;
    const toy = findToy(id);
    if (!toy) return;
    const player = this.player;
    const scene = player.scene;
    scene.toy = { kind: "builtin", id };
    scene.paint.stamps = [];
    scene.motion = { ...scene.motion, controls: {} };
    this.file = null;
    this.ui.setPaintCount(0);
    try {
      await this.loadToy(scene.toy);
      player.camera.setState(toy.camera || createScene().camera, { asHome: true, snap: false });
      player.syncDrop();
      this.ui.collapseSheet();
      this.ui.setMotion(scene.motion);
    } catch (err) {
      this.ui.toast(err.message, 5000);
    }
  }

  // ---- Tools ------------------------------------------------------------------

  setTool(tool) {
    this.tool = tool;
    this.ui.setTool(tool);
    this.ui.setEffects(this.player.scene.effects);
    canvas.classList.toggle("tool", tool !== "orbit");
  }

  setClayMode(mode) {
    this.clayMode = mode;
    this.ui.setClayMode(mode);
  }

  setEffectParam(id, key, value) {
    const fx = this.player.scene.effects;
    fx[id][key] = value;
    this.player.setEffects(fx);
    this.ui.setEffects(fx);
  }

  toggleEffect(id, on) {
    const fx = this.player.scene.effects;
    fx[id].on = on;
    if (on) this.sound.play(id === "drop" ? "drop" : id === "dissolve" ? "whoosh" : "click");
    const ex = effectDef(id).exclusive;
    if (on && ex && fx[ex].on) {
      fx[ex].on = false;
      this.ui.toast(
        `${effectDef(ex).label} switched off: it cannot run together with ${effectDef(id).label}.`,
      );
    }
    this.player.setEffects(fx);
    this.ui.setEffects(fx);
    this.player.interact();
  }

  allEffectsOff() {
    const fx = this.player.scene.effects;
    for (const id in fx) if ("on" in fx[id]) fx[id].on = false;
    this.player.setEffects(fx);
    this.ui.setEffects(fx);
  }

  clearPaint() {
    this.player.clearPaint();
    this.ui.toast("Paint cleared.");
  }

  pokeRandom() {
    this.player.pokeRandom();
  }

  resetCamera() {
    this.player.resetCamera();
  }

  bindGestures() {
    const player = this.player;
    const cam = player.camera;
    this.gestures = new Gestures(canvas, {
      classify: (e) => {
        // While the phone sheet is open, a tap on the toy only closes it.
        if (this.ui.sheetOpen()) return "orbit";
        if (e.button === 1 || e.button === 2 || this.spaceHeld || this.tool === "orbit")
          return "orbit";
        return "tool";
      },
      onTap: (e) => {
        if (this.ui.sheetOpen()) this.ui.collapseSheet();
        else if (this.tool === "orbit" && !this.spaceHeld) this.tapToy(e);
      },
      onInteract: () => {
        player.interact();
        canvas.focus({ preventScroll: true });
      },
      onOrbitStart: () => {
        cam.begin();
        canvas.classList.add("orbiting");
      },
      onOrbit: (dx, dy, dt) => {
        cam.rotateBy(dx, dy, dt);
        player.stage.requestRender();
      },
      onOrbitEnd: () => {
        cam.end();
        canvas.classList.remove("orbiting");
      },
      onPinchStart: () => cam.begin(),
      onPinch: ({ scale, dx, dy, twist, dt }) => {
        cam.rotateBy(dx, dy, dt);
        if (scale > 0) cam.zoomBy(1 / scale);
        cam.rollBy(-twist);
        player.stage.requestRender();
      },
      onPinchEnd: () => cam.end(),
      onWheel: (e) => {
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 120 : 1;
        cam.zoomBy(Math.exp(e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0015)));
        player.stage.requestRender();
      },
      onDoubleTap: () => player.resetCamera(),
      onToolStart: (e) => this.toolStart(e),
      onToolMove: (e) => this.toolMove(e),
      onToolEnd: (e) => this.toolEnd(e),
    });
  }

  // A tap on the toy (with the Orbit tool) runs its action, or makes it hop.
  async tapToy(e) {
    const player = this.player;
    const [x, y] = player.canvasPoint(e);
    player.pickDirty = true;
    const hit = await player.pickAt(x, y);
    if (hit) player.act();
  }

  onAction(r) {
    const player = this.player;
    const recipe = player.toyInfo?.recipe;
    if (r.key === "hop") this.sound.play("hop");
    else {
      const snd = recipe?.action?.sound;
      const name = typeof snd === "string" ? snd : r.value > 0.5 ? snd?.on : snd?.off;
      this.sound.play(name || "pop");
    }
    this.ui.setMotion(player.scene.motion, player.motion.targets);
  }

  act() {
    this.player.act();
  }

  // ---- Motion, controls, options and patterns ---------------------------------

  setMotion(partial) {
    const player = this.player;
    player.setMotion(normalizeMotion({ ...player.scene.motion, ...partial }));
    this.ui.setMotion(player.scene.motion);
    if (partial.move && partial.move !== "still") this.sound.play("click");
  }

  setControl(key, value) {
    this.player.setControl(key, value);
  }

  // Rebuilds a kit toy with a changed option (colour, style).
  async setToyOption(key, value) {
    const player = this.player;
    const toy = player.scene.toy;
    if (toy.kind !== "builtin") return;
    toy.options = { ...(toy.options || {}), [key]: value };
    const cam = player.camera.getState();
    try {
      await this.loadToy(toy);
      player.camera.setState(cam, { snap: true });
      player.syncDrop();
    } catch (err) {
      this.ui.toast(err.message, 5000);
    }
  }

  async setPattern(partial) {
    const player = this.player;
    const prev = player.scene.pattern;
    const next = { ...prev, ...partial };
    if (partial.id === "flag" && prev.id !== "flag") {
      next.projection = "wrap";
      next.repeats = 2;
      next.amount = 1;
      if (!next.flag) next.flag = await this.defaultFlag();
      this.sound.play("chime");
    } else if (partial.id && partial.id !== "flag" && prev.id === "flag") {
      next.repeats = 1;
    }
    player.scene.pattern = normalizePattern(next, normalizeHex);
    this.ui.setPattern(player.scene.pattern);
    await player.applyPattern();
    this.updateStatus();
    if (this.ui.currentTab() === "share") this.updateEmbedSoon();
  }

  // The visitor's own country (from the browser's language), else a random flag.
  async defaultFlag() {
    const flags = await loadFlags();
    const region = (navigator.language || "").split("-")[1]?.toLowerCase();
    const own = flags.find((f) => f.code === region);
    return (own || flags[Math.floor(Math.random() * flags.length)])?.code || "";
  }

  toggleSound() {
    this.sound.setEnabled(!this.sound.enabled);
    this.ui.setSound(this.sound.enabled);
    if (this.sound.enabled) this.sound.play("chime");
  }

  // Tool strokes. A stroke that starts off the toy becomes an orbit instead.
  async toolStart(e) {
    const player = this.player;
    const [x, y] = player.canvasPoint(e);
    const st = (this.toolState = {
      tool: this.tool,
      x,
      y,
      last: 0,
      busy: false,
      lastPoint: null,
      started: false,
    });
    player.stroke = st;
    if (st.tool === "magnet") {
      player.magnetAt(x, y, true);
      st.started = true;
      return;
    }
    st.busy = true;
    player.pickDirty = true;
    const hit = await player.pickAt(x, y);
    st.busy = false;
    if (this.toolState !== st) return;
    if (!hit) {
      this.toOrbit();
      return;
    }
    st.started = true;
    this.applyTool(st, hit, true);
  }

  toOrbit() {
    const g = this.gestures;
    this.toolState = null;
    this.player.stroke = null;
    if (g.gesture === "tool") {
      g.gesture = "orbit";
      this.player.camera.begin();
      canvas.classList.add("orbiting");
    }
  }

  applyTool(st, hit, first) {
    const player = this.player;
    const now = performance.now();
    if (st.tool === "poke") {
      player.driver.addPoke(hit, player.time);
      player.stage.requestRender();
      this.sound.play("poke", { gap: 0.12, pitch: 0.8 + Math.random() * 0.4 });
    } else if (st.tool === "paint") {
      const r = player.paintAt(hit, first);
      st.spacing = r * 0.35;
      if (first) this.sound.play("paint");
    } else if (st.tool === "clay") {
      this.sound.play("clay", { gap: 0.1 });
      if (this.player.scene.toy.kind === "builtin") this.promoteToProcedural();
      const op = player.clayAt(hit, this.clayMode, this.claySize);
      if (op) this.player.scene.toy.clay = player.proc.clay.slice();
    }
    st.lastPoint = hit;
    st.last = now;
  }

  async toolMove(e) {
    const st = this.toolState;
    if (!st || !st.started) return;
    const player = this.player;
    const [x, y] = player.canvasPoint(e);
    if (st.tool === "magnet") {
      player.magnetAt(x, y, true);
      return;
    }
    const now = performance.now();
    const minGap = st.tool === "poke" ? 150 : st.tool === "clay" ? 110 : 0;
    if (st.busy || now - st.last < minGap) return;
    st.busy = true;
    const hit = await player.pickAt(x, y);
    st.busy = false;
    if (this.toolState !== st || !hit) return;
    if (st.tool === "paint" && st.lastPoint) {
      const d = Math.hypot(
        hit[0] - st.lastPoint[0],
        hit[1] - st.lastPoint[1],
        hit[2] - st.lastPoint[2],
      );
      if (d < (st.spacing || 0)) return;
    }
    this.applyTool(st, hit, false);
  }

  toolEnd() {
    const st = this.toolState;
    this.toolState = null;
    this.player.stroke = null;
    if (!st) return;
    if (st.tool === "magnet") this.player.magnetAt(st.x, st.y, false);
    if (st.tool === "clay") this.player.refreshPaint();
  }

  // Editing a built-in generated toy makes it "your toy" with explicit params.
  promoteToProcedural() {
    const player = this.player;
    const info = player.toyInfo;
    if (!info || info.kind !== "procedural") return;
    player.scene.toy = {
      kind: "procedural",
      id: info.id,
      generator: { ...info.generator },
      clay: [],
    };
  }

  bindKeys() {
    const player = this.player;
    const cam = player.camera;
    addEventListener("keydown", (e) => {
      if (
        e.key === " " &&
        !this.ui.isTyping(e.target) &&
        !(e.target instanceof HTMLButtonElement)
      ) {
        this.spaceHeld = true;
        if (e.target === canvas) e.preventDefault();
        return;
      }
      if (this.ui.isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const tools = ["orbit", "poke", "paint", "magnet", "clay"];
      if (/^[1-5]$/.test(e.key)) this.setTool(tools[Number(e.key) - 1]);
      else if (e.key === "p" || e.key === "P") this.pokeRandom();
      else if (e.key === "r" || e.key === "R") this.resetCamera();
      else if (e.key === "Escape") this.ui.collapseSheet();
      else if (e.target === canvas && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = 36;
        cam.begin();
        if (e.key === "ArrowLeft") cam.rotateBy(-step, 0, 0);
        if (e.key === "ArrowRight") cam.rotateBy(step, 0, 0);
        if (e.key === "ArrowUp") cam.rotateBy(0, -step, 0);
        if (e.key === "ArrowDown") cam.rotateBy(0, step, 0);
        cam.end();
        player.stage.requestRender();
      } else if (e.key === "+" || e.key === "=") cam.zoomBy(0.85);
      else if (e.key === "-" || e.key === "_") cam.zoomBy(1 / 0.85);
      else return;
      player.stage.requestRender();
    });
    addEventListener("keyup", (e) => {
      if (e.key === " ") this.spaceHeld = false;
    });
    addEventListener("blur", () => (this.spaceHeld = false));
  }

  bindDrop() {
    let depth = 0;
    addEventListener("dragenter", (e) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      e.preventDefault();
      depth++;
      this.ui.showDrop(true);
    });
    addEventListener("dragover", (e) => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    });
    addEventListener("dragleave", () => {
      depth = Math.max(0, depth - 1);
      if (!depth) this.ui.showDrop(false);
    });
    addEventListener("drop", (e) => {
      e.preventDefault();
      depth = 0;
      this.ui.showDrop(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) this.openFile(f);
    });
  }

  // ---- Making toys ---------------------------------------------------------------

  setGenerator(g, { rebuild = true } = {}) {
    this.generator = normalizeGenerator(g, this.player.profile);
    if (!rebuild) return;
    clearTimeout(this.genTimer);
    this.genTimer = setTimeout(() => this.makeToy(this.generator), 250);
  }

  async makeToy(g) {
    if (this.busy) return;
    const player = this.player;
    const generator = normalizeGenerator(g, player.profile);
    this.generator = generator;
    const scene = player.scene;
    scene.toy = { kind: "procedural", id: null, generator, clay: [] };
    scene.paint.stamps = [];
    this.ui.setPaintCount(scene.paint.stamps.length);
    this.file = null;
    try {
      await this.loadToy(scene.toy);
      player.syncDrop();
    } catch (err) {
      this.ui.toast(err.message, 5000);
    }
  }

  // ---- Look ---------------------------------------------------------------------

  setLook(partial) {
    const player = this.player;
    player.scene.look = normalizeLook({ ...player.scene.look, ...partial });
    const theme = player.applyLook();
    this.ui.setLook(player.scene.look, theme);
    player.stage.requestRender();
    if (this.ui.currentTab() === "share") this.updateEmbedSoon();
  }

  setAutoplay(partial) {
    const player = this.player;
    player.scene.autoplay = { ...player.scene.autoplay, ...partial };
    player.camera.setTurntable(player.scene.autoplay.turntable);
    this.ui.setAutoplay(player.scene.autoplay, player.reducedMotion);
    player.stage.requestRender();
  }

  // ---- Files ----------------------------------------------------------------------

  async openFile(file) {
    const ext = extOf(file.name);
    if (ext === "json" || file.type === "application/json") return this.importJSONFile(file);
    if (ext === "ksplat") {
      this.ui.toast("KSPLAT files are not supported yet. Convert them to PLY or SOG first.", 6000);
      return;
    }
    if (!["ply", "sog", "splat", "spz"].includes(ext)) {
      this.ui.toast(
        `Splashery cannot read .${ext || "?"} files. It loads PLY, SOG, SPLAT, SPZ and JSON scenes.`,
        6000,
      );
      return;
    }
    const limits = LIMITS[this.player.profile];
    let count = 0;
    let header = null;
    if (ext === "ply") {
      header = readPlyHeader(new Uint8Array(await file.slice(0, 65536).arrayBuffer()));
      count = header?.count || 0;
    } else if (ext === "splat") {
      count = Math.floor(file.size / 32);
    }
    const tooBig = file.size > limits.warnBytes || count > limits.warnSplats;
    if (tooBig) {
      const canDownsample =
        ext === "ply" && header && header.format === "binary_little_endian" && !header.compressed;
      const what = count
        ? `${formatBytes(file.size)} with ${formatCount(count)} splats`
        : formatBytes(file.size);
      this.pendingLarge = { file, header, count };
      this.ui.showLargeFile(
        `${file.name} is ${what}, which may be slow or run out of memory on this device.` +
          (canDownsample
            ? ` A lighter copy keeps about ${formatCount(limits.downsampleTo)} splats.`
            : ""),
        canDownsample,
      );
      return;
    }
    return this.loadUserFile(file);
  }

  async resolveLargeFile(choice) {
    const pending = this.pendingLarge;
    this.pendingLarge = null;
    this.ui.showLargeFile(null);
    if (!pending || choice === "cancel") return;
    if (choice === "all") return this.loadUserFile(pending.file);
    this.ui.progress.show("Making a lighter copy…");
    try {
      const bytes = new Uint8Array(await pending.file.arrayBuffer());
      const header = readPlyHeader(bytes);
      const props = decimatePly(bytes, header, LIMITS[this.player.profile].downsampleTo, 7);
      const resource = resourceFromProps(this.player.stage, props);
      await this.loadUserFile(pending.file, { resource });
      this.ui.toast(`Loaded a lighter copy with ${formatCount(props.count)} splats.`);
    } catch (err) {
      this.ui.toast(err.message, 6000);
    } finally {
      this.ui.progress.hide();
    }
  }

  async loadUserFile(file, { resource = null } = {}) {
    const player = this.player;
    const ext = extOf(file.name);
    const bytes = resource ? null : new Uint8Array(await file.arrayBuffer());
    this.file = { name: file.name, size: file.size, bytes, resource };
    const pending =
      this.pendingFileScene && this.pendingFileScene.toy.file.name === file.name
        ? this.pendingFileScene
        : null;
    this.pendingFileScene = null;
    const scene = pending || player.scene;
    scene.toy = {
      kind: "file",
      file: { name: file.name, bytes: file.size },
      flip: pending ? pending.toy.flip : ext === "ply" || ext === "splat",
    };
    if (!pending) scene.paint.stamps = [];
    try {
      if (pending) await this.applyScene(scene, { file: this.file });
      else {
        await this.loadToy(scene.toy, { file: this.file });
        player.camera.setState(createScene().camera, { asHome: true, snap: false });
        player.syncDrop();
      }
      this.ui.toast(`${file.name} loaded. It stays in your browser.`);
    } catch (err) {
      this.ui.toast(err.message, 6000);
    }
  }

  async setFlip(flip) {
    const player = this.player;
    if (player.scene.toy.kind !== "file" || !this.file) return;
    player.scene.toy.flip = flip;
    player.scene.paint.stamps = [];
    await this.loadToy(player.scene.toy, { file: this.file });
  }

  async importJSONFile(file) {
    try {
      const obj = JSON.parse(await file.text());
      const scene = normalizeScene(obj, this.player.profile);
      const fileMatch =
        scene.toy.kind === "file" && this.file && this.file.name === scene.toy.file.name;
      await this.applyScene(scene, { file: fileMatch ? this.file : null });
      this.ui.toast(`Loaded ${file.name}.`);
    } catch (err) {
      this.ui.toast(`Could not load that file: ${err.message}`, 6000);
    }
  }

  // ---- Share ------------------------------------------------------------------------

  exportScene() {
    const player = this.player;
    const s = structuredClone(player.scene);
    s.createdAt = new Date().toISOString();
    s.camera = player.camera.getState();
    if (s.toy.kind === "procedural" && player.proc) s.toy.clay = player.proc.clay.slice();
    if (s.toy.kind === "builtin" && player.proc?.kit && player.proc.clay.length)
      s.toy.clay = player.proc.clay.slice();
    return normalizeScene(s, player.profile);
  }

  exportJSON() {
    const scene = this.exportScene();
    const blob = new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" });
    downloadBlob(blob, timestampName("json"));
    this.ui.toast("Scene saved as JSON.");
  }

  async copyLink() {
    const res = await buildShareHash(this.exportScene());
    if (!res.ok) {
      this.ui.setLinkNote(res.notes.join(" "));
      this.ui.toast("The scene is too big for a link. Save JSON instead.", 5000);
      return;
    }
    const url = shareURL(res.hash);
    history.replaceState(null, "", `#s=${res.hash}`);
    this.ui.setLinkNote(res.notes.join(" "));
    try {
      await navigator.clipboard.writeText(url);
      this.ui.toast("Link copied.");
    } catch {
      this.ui.toast("The link is in the address bar; copy it from there.");
    }
    return url;
  }

  updateEmbedSoon() {
    clearTimeout(this.embedTimer);
    this.embedTimer = setTimeout(() => this.updateEmbed(), 300);
  }

  async updateEmbed() {
    const res = await buildShareHash(this.exportScene());
    const transparent = this.ui.embedTransparent();
    if (!res.ok) {
      this.ui.setEmbed({ iframe: "", element: "", note: res.notes.join(" ") });
      return res;
    }
    const note = [
      ...res.notes,
      "The iframe works anywhere. The element needs one script tag and no iframe; both load the toy from GitHub Pages.",
    ].join(" ");
    this.ui.setEmbed({
      iframe: iframeSnippet(res.hash, { transparent }),
      element: elementSnippet(res.hash, { transparent }),
      note,
    });
    return res;
  }

  async withBusy(label, fn) {
    if (this.busy) return;
    this.busy = true;
    this.ui.setBusy(true);
    this.ui.progress.show(label);
    try {
      return await fn((f, l) => this.ui.progress.update(f, l));
    } catch (err) {
      console.info(err);
      this.ui.toast(err.message || String(err), 5000);
    } finally {
      this.ui.progress.hide();
      this.ui.setBusy(false);
      this.busy = false;
    }
  }

  async exportPNG() {
    return this.withBusy("Taking a picture…", async () => {
      const shot = await this.player.stage.captureFrame();
      const blob = await canvasToBlob(shot);
      downloadBlob(blob, timestampName("png"));
      this.ui.toast("Picture saved.");
      return blob;
    });
  }

  // Runs fn with a fixed-size, frozen player and restores it afterwards.
  async withCapture(size, fn) {
    const player = this.player;
    const base = { cam: player.camera.getState(), time: player.time, idle: player.idle.weight };
    const look = player.scene.look;
    const fx = player.scene.effects;
    const savedWind = { ...fx.wind };
    if (look.background === "transparent") {
      player.stage.setClearColor(hexRgb(THEMES[player.resolvedTheme()].page), 1);
    }
    player.idle.weight = 0;
    player.stage.setFixedSize(size);
    try {
      return await fn(base, savedWind);
    } finally {
      fx.wind = savedWind;
      player.stage.setFixedSize(null);
      player.camera.setState(base.cam, { snap: true });
      player.time = base.time;
      player.idle.weight = base.idle;
      player.applyLook();
      player.resume();
    }
  }

  anyAmbientOn() {
    const fx = this.player.scene.effects;
    return ["wind", "dissolve", "drop", "twist", "slice"].some((id) => fx[id].on);
  }

  async exportGIF({ kind = "turntable", frames = 48, size = 512 } = {}) {
    const player = this.player;
    return this.withBusy("Making a GIF…", (progress) =>
      this.withCapture([size, size], async (base) => {
        if (kind === "effects" && !this.anyAmbientOn()) {
          player.scene.effects.wind = { ...player.scene.effects.wind, on: true, strength: 0.4 };
          this.ui.toast("No effect was on, so the GIF uses a breeze.");
        }
        const loop = 4;
        const blob = await encodeGIF({
          frames,
          size,
          loopMs: loop * 1000,
          onProgress: (f) => progress(f, "Making a GIF…"),
          renderFrame: (i, n) => {
            const pose =
              kind === "turntable"
                ? { ...base.cam, yaw: base.cam.yaw + (i / n) * Math.PI * 2 }
                : base.cam;
            return player.renderAt(base.time + (i / n) * loop, pose);
          },
        });
        downloadBlob(blob, timestampName("gif"));
        this.ui.toast(`GIF saved (${formatBytes(blob.size)}).`);
        return blob;
      }),
    );
  }

  async exportWebM(seconds = 5) {
    const wm = webmSupport();
    if (!wm.ok) return;
    const player = this.player;
    return this.withBusy("Recording a video…", (progress) =>
      this.withCapture([720, 720], async (base) => {
        const blob = await recordWebM({
          canvas,
          seconds,
          mime: wm.mime,
          onProgress: (f) => progress(f, "Recording a video…"),
          drawFrame: (t) => {
            const pose = { ...base.cam, yaw: base.cam.yaw + t * Math.PI * 2 };
            return player.renderAt(base.time + t * seconds, pose);
          },
        });
        downloadBlob(blob, timestampName("webm"));
        this.ui.toast(`Video saved (${formatBytes(blob.size)}).`);
        return blob;
      }),
    );
  }
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const app = new App();
app.start();

// Test and console hooks (the smoke test drives the app through these).
window.__splashery = {
  app,
  get player() {
    return app.player;
  },
  get ready() {
    return document.body.dataset.ready === "true";
  },
  get renderer() {
    return app.player?.stage ? app.player.deviceType : null;
  },
  exportScene: () => app.exportScene(),
  get defaultEffects() {
    return defaultEffects();
  },
  name: APP_NAME,
};
