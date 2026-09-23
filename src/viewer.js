// A minimal Splashery viewer for embeds: no editing UI, orbit only, idle
// turntable and an optional gentle autoplay effect. Used by embed/index.html
// and by the <splashery-toy> custom element.

import { Player, NoGPUError, Gestures } from "./player.js";
import { createScene, normalizeScene, normalizeLook } from "./state.js";
import { decodeSceneHash } from "./codec.js";
import { findToy, TOYS, ROOT } from "./toys.js";

export { NoGPUError };

export class Viewer {
  // opts: { scene (hash payload), toy (id), theme, background, autoplay,
  // turntable, onStatus(text), onTheme(theme) }
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.player = new Player(canvas, { idleDelay: 1.2, prefer: opts.renderer });
    this.hash = null;
    this.active = true;
  }

  async start() {
    const player = this.player;
    await player.init();
    player.camera.idleDelay = 1;
    player.on("theme", (t) => this.opts.onTheme?.(t));
    let scene = null;
    if (this.opts.scene) {
      try {
        scene = normalizeScene(await decodeSceneHash(this.opts.scene), player.profile);
        this.hash = this.opts.scene;
      } catch (err) {
        this.opts.onStatus?.(`Could not read this scene (${err.message}).`);
      }
    }
    if (!scene) {
      const id = findToy(this.opts.toy) ? this.opts.toy : TOYS[0].id;
      scene = createScene({ toy: { kind: "builtin", id }, seed: 1 });
      const t = findToy(id);
      if (t?.camera) scene.camera = { ...t.camera };
    }
    if (scene.toy.kind === "file") {
      this.opts.onStatus?.(
        `This toy was ${scene.toy.file.name}, a file on someone's computer; showing a stand-in.`,
      );
      scene.toy = { kind: "builtin", id: TOYS[0].id };
    }
    // Page-level overrides.
    const look = { ...scene.look };
    if (this.opts.theme === "light" || this.opts.theme === "dark")
      player.themeOverride = this.opts.theme;
    if (this.opts.background) look.background = this.opts.background;
    scene.look = normalizeLook(look);
    if (this.opts.autoplay) scene.autoplay.effect = this.opts.autoplay;
    if (this.opts.turntable === false) scene.autoplay.turntable = false;
    player.scene = scene;
    player.applyLook();
    await player.loadToy(scene.toy);
    player.applySettings(scene);
    this.bindGestures();
    return scene;
  }

  bindGestures() {
    const player = this.player;
    const cam = player.camera;
    this.gestures = new Gestures(this.canvas, {
      classify: () => "orbit",
      onInteract: () => player.interact(),
      onOrbitStart: () => cam.begin(),
      onOrbit: (dx, dy, dt) => {
        cam.rotateBy(dx, dy, dt);
        player.stage.requestRender();
      },
      onOrbitEnd: () => cam.end(),
      onPinchStart: () => cam.begin(),
      onPinch: ({ scale, dx, dy, twist, dt }) => {
        cam.rotateBy(dx, dy, dt);
        if (scale > 0) cam.zoomBy(1 / scale);
        cam.rollBy(-twist);
        player.stage.requestRender();
      },
      onPinchEnd: () => cam.end(),
      // In an embed the wheel keeps scrolling the page unless Ctrl/Cmd is held.
      onWheel: (e) => {
        if (!e.ctrlKey && !e.metaKey) return false;
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 120 : 1;
        cam.zoomBy(Math.exp(e.deltaY * unit * 0.01));
        player.stage.requestRender();
        return true;
      },
      onDoubleTap: () => player.resetCamera(),
      // A tap on the toy runs its action (open the lid, stoke the fire) or
      // makes it hop.
      onTap: async (e) => {
        const [x, y] = player.canvasPoint(e);
        player.pickDirty = true;
        if (await player.pickAt(x, y)) player.act();
      },
    });
  }

  setTheme(theme) {
    this.player.hostTheme = theme === "dark" || theme === "light" ? theme : null;
    this.player.applyLook();
  }

  // Link back to the full app with the same scene.
  openURL() {
    const base = new URL("./", ROOT).href;
    return this.hash ? `${base}#s=${this.hash}` : base;
  }

  destroy() {
    this.gestures?.dispose();
    this.player.destroy();
  }
}
