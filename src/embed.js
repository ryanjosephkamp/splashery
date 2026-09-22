// Embed player: loads a scene from the URL hash, renders it with slow
// auto-rotate and orbit only. No painting UI.

import { Vector3 } from "three";
import { PlanetScene, probeWebGL2, isWeakDevice } from "./scene.js";
import { createShape } from "./shape.js";
import { PaintSystem, replayStrokes } from "./paint.js";
import { TemplateGenerator } from "./templates.js";
import { BallControls, GestureRecognizer } from "./controls.js";
import { normalizeScene } from "./state.js";
import { decodeSceneHash, parseHash, decodePNGDataURI } from "./codec.js";

const status = document.getElementById("embed-status");
const canvas = document.getElementById("stage");
const openLink = document.getElementById("open-link");

function say(text) {
  status.hidden = !text;
  status.textContent = text || "";
}

function showFallback(reason) {
  const fb = document.getElementById("fallback");
  if (reason) document.getElementById("fallback-reason").textContent += ` (${reason})`;
  fb.hidden = false;
  canvas.hidden = true;
  document.body.dataset.ready = "true";
}

class EmbedPlayer {
  constructor() {
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const info = probeWebGL2();
    this.info = info;
    this.webgl2 = !!info.ok;
    if (!this.webgl2) {
      showFallback();
      return;
    }
    this.weak = isWeakDevice(info);
    this.shape = createShape("sphere");
    try {
      this.view = new PlanetScene(canvas, this.shape, { weak: this.weak });
    } catch (err) {
      this.webgl2 = false;
      showFallback(err && err.message);
      return;
    }
    this.paint = new PaintSystem(this.view.renderer, this.shape, {
      resolution: this.weak ? 1024 : 2048,
      mipmaps: !this.weak,
      undoBudgetBytes: 1,
    });
    this.templates = new TemplateGenerator(this.view.renderer, this.shape);
    this.controls = new BallControls({ radius: 1, reducedMotion: this.reducedMotion });
    this.controls.autoRotateSpeed = 0.1;
    this.controls.autoRotateDelay = 1.5;
    this.gravity = new Vector3(0, -1, 0);
    this.scene = null;
    this.busy = false;
    this.lastFrame = performance.now();
    this.needsRender = true;

    this.gestures = new GestureRecognizer(canvas, {
      classify: () => "orbit",
      onInteract: () => this.controls.poke(),
      onOrbitStart: () => this.controls.beginDrag(),
      onOrbit: (dx, dy, dt) => this.controls.rotateBy(dx, dy, dt),
      onOrbitEnd: () => this.controls.endDrag(),
      onPinchStart: () => this.controls.beginDrag(),
      onPinch: ({ scale, dx, dy, twist, dt }) => {
        this.controls.rotateBy(dx, dy, dt);
        if (scale > 0) this.controls.zoomBy(1 / scale);
        this.controls.rollBy(-twist);
      },
      onPinchEnd: () => this.controls.endDrag(),
      onWheel: (e) => {
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 120 : 1;
        this.controls.zoomBy(Math.exp(e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0016)));
      },
      onDoubleTap: () => this.controls.reset(true),
    });
    canvas.addEventListener("keydown", (e) => {
      const c = this.controls;
      if (e.key === "ArrowLeft") c.rotateBy(-40, 0, 0);
      else if (e.key === "ArrowRight") c.rotateBy(40, 0, 0);
      else if (e.key === "ArrowUp") c.rotateBy(0, -40, 0);
      else if (e.key === "ArrowDown") c.rotateBy(0, 40, 0);
      else if (e.key === "+" || e.key === "=") c.zoomBy(0.8);
      else if (e.key === "-") c.zoomBy(1.25);
      else return;
      e.preventDefault();
    });

    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      this.view.setSize(w, h, Math.min(2, window.devicePixelRatio || 1));
      this.controls.setViewport(w, h);
      this.controls.setHomeDistance(this.view.fitDistance(w / Math.max(1, h)));
      this.needsRender = true;
    };
    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame((t) => this.tick(t));
    window.addEventListener("hashchange", () => this.load());
    this.load();
  }

  async load() {
    const { s } = parseHash(location.hash);
    if (s) openLink.href = `../#s=${s}`;
    if (!s) {
      this.applyScene(normalizeScene({ version: 1, template: { name: "rocky", seed: 7 } }));
      say("No scene in this link.");
      document.body.dataset.ready = "true";
      return;
    }
    try {
      say("Loading…");
      const raw = await decodeSceneHash(s);
      await this.applyScene(normalizeScene(raw));
      say("");
    } catch (err) {
      say(`Could not load this scene: ${err.message}`);
    } finally {
      document.body.dataset.ready = "true";
    }
  }

  async applyScene(scene) {
    this.busy = true;
    try {
      this.scene = scene;
      const w = this.weak ? 1024 : 2048;
      this.view.setTemplateTexture(
        this.templates.generate(scene.template.name, scene.template.seed, w, w / 2),
      );
      this.view.setLighting(scene.lighting);
      // Keep the author's orientation but fit the sphere to whatever frame hosts the iframe.
      const w0 = canvas.clientWidth || window.innerWidth;
      const h0 = canvas.clientHeight || window.innerHeight;
      this.controls.setState(
        { rotation: scene.camera.rotation, distance: this.view.fitDistance(w0 / Math.max(1, h0)) },
        true,
      );
      this.view.applyView(this.controls.rotation, this.controls.distance);
      this.paint.clear();
      this.paint.physics = { ...scene.physics };
      if (scene.strokes.length) {
        await replayStrokes(this.paint, scene.strokes, {
          physics: scene.physics,
          gravityFallback: this.view.gravityObject(new Vector3()),
          dt: this.info.software ? 1 / 8 : this.weak ? 1 / 20 : 1 / 30,
          stepsPerFrame: this.weak ? 10 : 30,
          onProgress: (f) => {
            say(`Painting… ${Math.round(f * 100)}%`);
            this.needsRender = true;
          },
        });
      } else if (scene.snapshotPNG) {
        const bitmap = await decodePNGDataURI(scene.snapshotPNG);
        this.paint.loadDryFromImage(bitmap);
        bitmap.close?.();
      }
      this.needsRender = true;
    } finally {
      this.busy = false;
    }
  }

  tick(now) {
    requestAnimationFrame((t) => this.tick(t));
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    const c = this.controls;
    const before = [c.rotation.x, c.rotation.y, c.rotation.z, c.rotation.w, c.distance];
    c.update(dt);
    if (
      before[0] !== c.rotation.x ||
      before[1] !== c.rotation.y ||
      before[2] !== c.rotation.z ||
      before[3] !== c.rotation.w ||
      before[4] !== c.distance
    ) {
      this.needsRender = true;
    }
    this.view.applyView(c.rotation, c.distance);
    if (!this.busy && this.paint.hasWet) {
      this.view.gravityObject(this.gravity);
      this.paint.simulate(dt, this.gravity);
      this.needsRender = true;
    }
    if (this.needsRender) {
      this.view.setPaintTextures(this.paint.wetTexture, this.paint.dryTexture);
      this.view.render();
      this.needsRender = false;
    }
  }
}

const player = new EmbedPlayer();
window.__splashery = {
  embed: player,
  get webgl2() {
    return player.webgl2;
  },
  get ready() {
    return document.body.dataset.ready === "true";
  },
  scene: () => player.scene,
};
