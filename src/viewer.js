// A minimal Splashery viewer for embeds: no editing UI, orbit only, idle
// turntable and an optional gentle autoplay effect. Used by embed/index.html
// and by the <splashery-toy> custom element.

import { Player, NoGPUError, Gestures } from "./player.js";
import { createScene, normalizeScene, normalizeLook } from "./state.js";
import { decodeSceneHash } from "./codec.js";
import { findToy, TOYS, ROOT } from "./toys.js";

export { NoGPUError };

// The app's camera starts 5 toy radii away, where the toy fills about 60% of
// the shorter side. Embeds are small, so they come in to about 80%
// (3.8 radii with the 38 degree field of view); ?zoom= scales that.
const EMBED_FIT = 3.8 / 5;

export function embedZoom(value) {
  const n = Number(value);
  return value !== null && value !== "" && Number.isFinite(n) ? Math.min(2, Math.max(0.5, n)) : 1;
}

export const ZOOM_HINT = "Pinch or Ctrl+scroll to zoom";

export class Viewer {
  // opts: { scene (hash payload), toy (id), theme, background, autoplay,
  // turntable, zoom (0.5-2), onStatus(text), onTheme(theme) }
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.player = new Player(canvas, { idleDelay: 1.2, prefer: opts.renderer });
    this.hash = null;
    this.active = true;
    // After a click or tap on the toy, the plain wheel zooms until the
    // pointer leaves; before that it scrolls the page.
    this.wheelZooms = false;
    this.hinted = false;
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
    const fit = EMBED_FIT / embedZoom(this.opts.zoom ?? null);
    scene.camera = { ...scene.camera, distance: scene.camera.distance * fit };
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
    this.onLeave = () => (this.wheelZooms = false);
    this.canvas.addEventListener("pointerleave", this.onLeave);
    this.gestures = new Gestures(this.canvas, {
      classify: () => "orbit",
      onInteract: () => {
        this.wheelZooms = true;
        player.interact();
      },
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
      // In an embed the wheel keeps scrolling the page unless Ctrl/Cmd is
      // held or the toy was clicked; the first plain scroll shows a hint.
      onWheel: (e) => {
        if (!e.ctrlKey && !e.metaKey && !this.wheelZooms) {
          this.hint();
          return false;
        }
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
        const hit = await player.pickAt(x, y);
        if (hit) player.act(hit);
      },
    });
  }

  hint() {
    if (this.hinted) return;
    this.hinted = true;
    this.opts.onStatus?.(ZOOM_HINT);
  }

  // The + and - buttons.
  zoomBy(steps) {
    this.player.camera.zoomBy(Math.pow(1.25, -steps));
    this.player.interact();
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
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    this.gestures?.dispose();
    this.player.destroy();
  }
}
