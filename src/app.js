// Splashery: entry point for the main app. Wires the scene, paint system,
// controls, UI and exports together and runs the frame loop.

import { Color, Quaternion, Vector3 } from "three";
import { PlanetScene, probeWebGL2, isWeakDevice } from "./scene.js";
import { createShape } from "./shape.js";
import { PaintSystem, replayStrokes } from "./paint.js";
import { TemplateGenerator } from "./templates.js";
import { BallControls, GestureRecognizer } from "./controls.js";
import { createUI } from "./ui.js";
import {
  createDefaultScene,
  normalizeScene,
  normalizeBrush,
  normalizePhysics,
  normalizeLighting,
  randomSeed,
  round,
  formatBytes,
  RESOLUTIONS,
  TEMPLATE_NAMES,
  DEFAULT_CAMERA,
  BRUSH_SIZE_MIN,
  BRUSH_SIZE_MAX,
  SCENE_VERSION,
} from "./state.js";
import {
  encodePNG,
  bytesToDataURI,
  decodePNGDataURI,
  downloadBlob,
  timestampName,
  exportGIF,
  exportWebM,
  webmSupport,
  buildEmbedHash,
  embedSnippet,
} from "./export.js";
import { decodeSceneHash, parseHash } from "./codec.js";

const Y_AXIS = new Vector3(0, 1, 0);

class App {
  constructor() {
    this.canvas = document.getElementById("stage");
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.info = probeWebGL2();
    this.webgl2 = !!this.info.ok;
    if (!this.webgl2) {
      this.showFallback();
      return;
    }
    this.weak = isWeakDevice(this.info);
    this.shape = createShape("sphere");
    try {
      this.view = new PlanetScene(this.canvas, this.shape, { weak: this.weak });
    } catch (err) {
      this.webgl2 = false;
      this.showFallback(err && err.message);
      return;
    }
    const renderer = this.view.renderer;
    this.resolution = this.weak ? 1024 : 2048;
    this.paint = new PaintSystem(renderer, this.shape, {
      resolution: this.resolution,
      mipmaps: !this.weak,
      undoBudgetBytes: (this.weak ? 96 : 256) * 1024 * 1024,
    });
    this.templates = new TemplateGenerator(renderer, this.shape);
    this.controls = new BallControls({
      radius: this.shape.radius,
      reducedMotion: this.reducedMotion,
    });
    this.controls.setState(DEFAULT_CAMERA, true);

    this.scene = createDefaultScene();
    this.brush = { ...this.scene.brushDefaults };
    this.paint.physics = { ...this.scene.physics };
    this.mode = "paint";
    this.spaceHeld = false;
    this.busy = false;
    this.capturing = false;
    this.hovering = null;
    this.strokeRecord = null;
    this.strokeGap = false;
    this.clock0 = performance.now();
    this.lastFrame = performance.now();
    this.needsRender = true;
    this.gravity = new Vector3(0, -1, 0);

    this.ui = createUI(this);
    this.ui.setMode(this.mode);
    this.ui.setBrush(this.brush);
    this.ui.setPhysics(this.paint.physics);
    this.ui.setLighting(this.scene.lighting);
    this.ui.setResolution(
      this.resolution,
      this.weak ? "Light mode: this device gets a 1024 paint texture." : "",
    );
    const webm = webmSupport();
    this.webm = webm;
    this.ui.setWebmUnavailable(webm.ok ? "" : webm.reason);
    this.ui.setPerfNote(this.weak ? "light device profile" : "");

    this.applyTemplate();
    this.view.setLighting(this.scene.lighting);
    this.canvas.classList.toggle("paint-mode", this.mode === "paint");

    this.brushCursor = document.getElementById("brush-cursor");
    this.gestures = new GestureRecognizer(this.canvas, this.gestureHandlers());
    this.bindKeyboard();
    this.bindDrop();
    this.bindResize();

    this.raf = requestAnimationFrame((t) => this.tick(t));
    this.loadFromHash();
  }

  // ---- Setup --------------------------------------------------------------

  showFallback(reason) {
    const fb = document.getElementById("fallback");
    if (reason) {
      const p = document.getElementById("fallback-reason");
      p.textContent = `${p.textContent} (${reason})`;
    }
    fb.hidden = false;
    document.getElementById("panel").hidden = true;
    this.canvas.hidden = true;
    document.body.dataset.ready = "true";
  }

  bindResize() {
    const resize = () => {
      const w = this.canvas.clientWidth || window.innerWidth;
      const h = this.canvas.clientHeight || window.innerHeight;
      if (this.capturing) return;
      this.view.setSize(w, h, Math.min(2, window.devicePixelRatio || 1));
      this.controls.setViewport(w, h);
      this.controls.setHomeDistance(this.view.fitDistance(w / Math.max(1, h)));
      this.needsRender = true;
    };
    window.addEventListener("resize", resize);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
    resize();
  }

  bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      if (this.ui.isTyping(e.target)) return;
      const k = e.key;
      if (k === " ") {
        this.spaceHeld = true;
        if (e.target === document.body || e.target === this.canvas) e.preventDefault();
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        if (k.toLowerCase() === "z" && !e.shiftKey) {
          e.preventDefault();
          this.undo();
        }
        return;
      }
      switch (k) {
        case "p":
        case "P":
          this.setMode("paint");
          break;
        case "o":
        case "O":
          this.setMode("orbit");
          break;
        case "z":
        case "Z":
          this.undo();
          break;
        case "r":
        case "R":
          this.resetCamera();
          break;
        case "[":
          this.setBrush({ size: Math.max(BRUSH_SIZE_MIN, this.brush.size / 1.25) });
          break;
        case "]":
          this.setBrush({ size: Math.min(BRUSH_SIZE_MAX, this.brush.size * 1.25) });
          break;
        case "ArrowLeft":
          this.controls.rotateBy(-40, 0, 0);
          e.preventDefault();
          break;
        case "ArrowRight":
          this.controls.rotateBy(40, 0, 0);
          e.preventDefault();
          break;
        case "ArrowUp":
          this.controls.rotateBy(0, -40, 0);
          e.preventDefault();
          break;
        case "ArrowDown":
          this.controls.rotateBy(0, 40, 0);
          e.preventDefault();
          break;
        case "+":
        case "=":
          this.controls.zoomBy(0.8);
          break;
        case "-":
        case "_":
          this.controls.zoomBy(1.25);
          break;
        case "Escape":
          this.ui.collapseSheet();
          break;
        default:
          return;
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === " ") this.spaceHeld = false;
    });
    window.addEventListener("blur", () => {
      this.spaceHeld = false;
    });
  }

  bindDrop() {
    let depth = 0;
    window.addEventListener("dragenter", (e) => {
      e.preventDefault();
      depth++;
      this.ui.showDrop(true);
    });
    window.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    });
    window.addEventListener("dragleave", () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) this.ui.showDrop(false);
    });
    window.addEventListener("drop", (e) => {
      e.preventDefault();
      depth = 0;
      this.ui.showDrop(false);
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) this.importFile(file);
    });
  }

  async loadFromHash() {
    const { s } = parseHash(location.hash);
    document.body.dataset.ready = "true";
    if (!s) return;
    try {
      const obj = await decodeSceneHash(s);
      history.replaceState(null, "", location.pathname + location.search);
      await this.importScene(obj);
      this.ui.toast("Scene loaded from the link.");
    } catch (err) {
      this.ui.toast(`Could not load the scene in this link: ${err.message}`);
    }
  }

  // ---- Frame loop ---------------------------------------------------------

  tick(now) {
    this.raf = requestAnimationFrame((t) => this.tick(t));
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    if (this.capturing) return;
    const c = this.controls;
    c.autoRotate = !this.reducedMotion && !(this.mode === "paint" && this.hovering);
    const q0x = c.rotation.x,
      q0y = c.rotation.y,
      q0z = c.rotation.z,
      q0w = c.rotation.w;
    const d0 = c.distance;
    c.update(dt);
    if (
      q0x !== c.rotation.x ||
      q0y !== c.rotation.y ||
      q0z !== c.rotation.z ||
      q0w !== c.rotation.w ||
      d0 !== c.distance
    ) {
      this.needsRender = true;
    }
    this.view.applyView(c.rotation, c.distance);
    if (this.paint._pendingStamps.length) {
      this.paint.flushStamps();
      this.needsRender = true;
    }
    if (!this.busy && this.paint.hasWet) {
      this.view.gravityObject(this.gravity);
      const steps = dt > 1 / 40 ? 2 : 1;
      for (let i = 0; i < steps; i++) this.paint.simulate(dt / steps, this.gravity);
      this.needsRender = true;
    }
    if (this.needsRender) {
      this.view.setPaintTextures(this.paint.wetTexture, this.paint.dryTexture);
      this.view.render();
      this.needsRender = false;
    }
    this.updateBrushCursor();
  }

  // ---- Gestures -----------------------------------------------------------

  gestureHandlers() {
    const hit = { point: new Vector3(), uv: { u: 0, v: 0 } };
    const toNDC = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return [
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -(((e.clientY - r.top) / r.height) * 2 - 1),
      ];
    };
    const raycast = (e) => {
      const [x, y] = toNDC(e);
      return this.view.raycast(x, y, hit);
    };
    return {
      classify: (e) => {
        if (this.busy) return "orbit";
        if (this.mode !== "paint" || this.spaceHeld) return "orbit";
        if (e.pointerType === "mouse" && e.button !== 0) return "orbit";
        return raycast(e) ? "paint" : "orbit";
      },
      onInteract: () => this.controls.poke(),
      onPaintStart: (e) => {
        const h = raycast(e);
        if (!h) return;
        this.cursorAt(e);
        this.beginStroke(h, e.timeStamp, true);
      },
      onPaintMove: (e, events) => {
        for (const ev of events) {
          const h = raycast(ev);
          if (!h) {
            this.strokeGap = true;
            continue;
          }
          if (this.strokeGap || !this.paint.inStroke) {
            this.strokeGap = false;
            this.finishStroke();
            this.beginStroke(h, ev.timeStamp, false);
            continue;
          }
          const t = (ev.timeStamp - this.clock0) / 1000;
          const res = this.paint.strokeTo(h.point, t);
          this.recordPoint(h.uv, t, res.splash);
        }
        this.hovering = raycast(e) ? true : null;
        this.cursorAt(e);
      },
      onPaintEnd: () => {
        this.finishStroke();
      },
      onOrbitStart: () => {
        this.controls.beginDrag();
        this.canvas.classList.add("orbiting");
      },
      onOrbit: (dx, dy, dt) => this.controls.rotateBy(dx, dy, dt),
      onOrbitEnd: () => {
        this.controls.endDrag();
        this.canvas.classList.remove("orbiting");
      },
      onPinchStart: () => this.controls.beginDrag(),
      onPinch: ({ scale, dx, dy, twist, dt }) => {
        this.controls.rotateBy(dx, dy, dt);
        if (scale > 0) this.controls.zoomBy(1 / scale);
        this.controls.rollBy(-twist);
      },
      onPinchEnd: () => this.controls.endDrag(),
      onWheel: (e) => {
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 120 : 1;
        const k = e.ctrlKey ? 0.01 : 0.0016;
        const factor = Math.exp(e.deltaY * unit * k);
        this.controls.zoomBy(factor);
      },
      onDoubleTap: () => this.resetCamera(),
      onHover: (e) => {
        this.hovering = this.mode === "paint" && raycast(e) ? true : null;
        this.cursorAt(e);
      },
    };
  }

  cursorAt(e) {
    this._cursorX = e.clientX;
    this._cursorY = e.clientY;
    this._cursorTouch = e.pointerType === "touch";
  }

  updateBrushCursor() {
    const el = this.brushCursor;
    const show =
      this.mode === "paint" &&
      this.hovering &&
      !this._cursorTouch &&
      !this.busy &&
      Number.isFinite(this._cursorX);
    if (!show) {
      if (!el.hidden) el.hidden = true;
      return;
    }
    const px = this.view.projectedBrushPixels(
      this.brush.size,
      this.controls.distance,
      this.canvas.clientHeight || 1,
    );
    const d = Math.max(6, Math.min(600, px * 2));
    el.hidden = false;
    el.style.width = `${d}px`;
    el.style.height = `${d}px`;
    el.style.transform = `translate(${this._cursorX - d / 2}px, ${this._cursorY - d / 2}px)`;
  }

  // ---- Strokes ------------------------------------------------------------

  beginStroke(h, timeStamp, withSplash) {
    if (this.busy) return;
    const gravity = this.view.gravityObject(new Vector3());
    if (!this.paint.inStroke) {
      this.paint.pushUndo({ kind: "stroke", strokes: this.scene.strokes.slice() }).catch(() => {});
      this.ui.setUndoEnabled(true);
    }
    const record = this.paint.beginStroke(this.brush, gravity, this.scene.strokes.length);
    this.strokeRecord = record;
    this.scene.strokes.push(record);
    const t = (timeStamp - this.clock0) / 1000;
    const res = this.paint.strokeTo(h.point, t, { forceSplash: withSplash });
    this.recordPoint(h.uv, t, res.splash);
    this.hovering = true;
  }

  recordPoint(uv, tSec, splash) {
    if (!this.strokeRecord) return;
    this.strokeRecord.points.push([
      Math.round(tSec * 1000),
      round(uv.u, 4),
      round(uv.v, 4),
      splash ? 1 : 0,
    ]);
  }

  finishStroke() {
    if (!this.paint.inStroke) return;
    this.paint.endStroke();
    this.paint.flushStamps();
    const r = this.strokeRecord;
    if (r && r.points.length === 0) {
      const i = this.scene.strokes.indexOf(r);
      if (i >= 0) this.scene.strokes.splice(i, 1);
    }
    this.strokeRecord = null;
    this.strokeGap = false;
    this.needsRender = true;
  }

  // ---- Commands -----------------------------------------------------------

  setMode(mode) {
    if (mode !== "paint" && mode !== "orbit") return;
    if (this.paint.inStroke) this.finishStroke();
    this.mode = mode;
    this.ui.setMode(mode);
    this.canvas.classList.toggle("paint-mode", mode === "paint");
    if (mode !== "paint") this.hovering = null;
  }

  setBrush(partial) {
    this.brush = normalizeBrush({ ...this.brush, ...partial });
    this.scene.brushDefaults = { ...this.brush };
    this.ui.setBrush(this.brush);
  }

  setPhysics(partial) {
    this.paint.physics = normalizePhysics({ ...this.paint.physics, ...partial });
    this.scene.physics = { ...this.paint.physics };
    this.ui.setPhysics(this.paint.physics);
  }

  setLighting(partial) {
    this.scene.lighting = normalizeLighting({ ...this.scene.lighting, ...partial });
    this.view.setLighting(this.scene.lighting);
    this.ui.setLighting(this.scene.lighting);
    this.needsRender = true;
  }

  applyTemplate() {
    const { name, seed } = this.scene.template;
    const w = this.weak ? 1024 : 2048;
    const tex = this.templates.generate(name, seed, w, w / 2);
    this.view.setTemplateTexture(tex);
    this.ui.setTemplate(name, seed);
    this.needsRender = true;
  }

  setTemplate(name) {
    if (!TEMPLATE_NAMES.includes(name)) return;
    this.scene.template = { name, seed: this.scene.template.seed };
    this.applyTemplate();
  }

  randomize() {
    this.scene.template = { name: this.scene.template.name, seed: randomSeed() };
    this.applyTemplate();
  }

  setResolution(res) {
    if (!RESOLUTIONS.includes(res) || res === this.resolution) return;
    if (this.paint.inStroke) this.finishStroke();
    const maxTex = this.info.maxTexture || 4096;
    if (res > maxTex) {
      this.ui.toast(`This GPU cannot allocate a ${res} texture (max ${maxTex}).`);
      this.ui.setResolution(this.resolution);
      return;
    }
    this.paint.setResolution(res);
    this.resolution = res;
    const note =
      res === 4096
        ? "4096 uses about half a gigabyte of video memory; expect lower frame rates."
        : res === 1024 && !this.weak
          ? "1024 is light on the GPU; drips get a little softer."
          : "";
    this.ui.setResolution(res, note);
    this.needsRender = true;
  }

  async undo() {
    if (this.busy || this.paint.inStroke || !this.paint.canUndo) return;
    this.busy = true;
    try {
      const meta = await this.paint.undo();
      if (meta && Array.isArray(meta.strokes)) this.scene.strokes = meta.strokes.slice();
      this.needsRender = true;
    } catch (err) {
      this.ui.toast(`Undo failed: ${err.message}`);
    } finally {
      this.busy = false;
      this.ui.setUndoEnabled(this.paint.canUndo);
    }
  }

  async clearPaint() {
    if (this.busy) return;
    if (this.paint.inStroke) this.finishStroke();
    this.paint.pushUndo({ kind: "clear", strokes: this.scene.strokes.slice() }).catch(() => {});
    this.paint.clear();
    this.scene.strokes = [];
    this.ui.setUndoEnabled(true);
    this.needsRender = true;
  }

  resetCamera() {
    this.controls.reset(true);
  }

  // ---- Scene I/O ----------------------------------------------------------

  async snapshotDataURI(size) {
    const { data, width, height } = await this.paint.readLayer("dry", size ? { size } : {});
    const png = await encodePNG(data, width, height);
    return bytesToDataURI(png, "image/png");
  }

  sceneSettings() {
    return {
      version: SCENE_VERSION,
      createdAt: new Date().toISOString(),
      template: { ...this.scene.template },
      camera: this.controls.getState(),
      lighting: { ...this.scene.lighting },
      brushDefaults: { ...this.brush },
      physics: { ...this.paint.physics },
    };
  }

  async exportScene() {
    if (this.paint.inStroke) this.finishStroke();
    const snapshotPNG = await this.snapshotDataURI();
    return { ...this.sceneSettings(), strokes: this.scene.strokes, snapshotPNG };
  }

  async exportJSON() {
    if (this.busy) return;
    this.setBusy(true, "Saving scene…");
    try {
      const scene = await this.exportScene();
      const json = JSON.stringify(scene);
      downloadBlob(new Blob([json], { type: "application/json" }), timestampName("json"));
      this.ui.toast(`Saved scene (${formatBytes(json.length)}).`);
    } catch (err) {
      this.ui.toast(`Export failed: ${err.message}`);
    } finally {
      this.setBusy(false);
    }
  }

  async importFile(file) {
    if (this.busy) return;
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      await this.importScene(obj);
      this.ui.toast(`Loaded ${file.name}.`);
    } catch (err) {
      this.ui.toast(`Could not load that file: ${err.message}`);
    }
  }

  async importScene(obj) {
    const scene = normalizeScene(obj);
    if (this.paint.inStroke) this.finishStroke();
    this.setBusy(true, "Loading scene…");
    try {
      this.paint.pushUndo({ kind: "import", strokes: this.scene.strokes.slice() }).catch(() => {});
      this.ui.setUndoEnabled(true);
      this.scene.template = { ...scene.template };
      this.applyTemplate();
      this.scene.lighting = scene.lighting;
      this.view.setLighting(scene.lighting);
      this.ui.setLighting(scene.lighting);
      this.setPhysics(scene.physics);
      this.setBrush(scene.brushDefaults);
      this.controls.setState(scene.camera);
      this.view.applyView(this.controls.rotation, this.controls.distance);
      this.paint.clear();
      this.scene.strokes = [];
      let lastT = 0;
      if (scene.strokes.length) {
        await replayStrokes(this.paint, scene.strokes, {
          physics: scene.physics,
          gravityFallback: this.view.gravityObject(new Vector3()),
          dt: this.info.software ? 1 / 8 : this.weak ? 1 / 20 : 1 / 30,
          stepsPerFrame: this.weak ? 8 : 24,
          onProgress: (f) => {
            this.ui.progress.update(f, "Replaying strokes…");
            this.needsRender = true;
          },
        });
        this.scene.strokes = scene.strokes;
        for (const s of scene.strokes) {
          for (const p of s.points) lastT = Math.max(lastT, p[0]);
        }
      } else if (scene.snapshotPNG) {
        const bitmap = await decodePNGDataURI(scene.snapshotPNG);
        this.paint.loadDryFromImage(bitmap);
        bitmap.close?.();
      }
      this.clock0 = performance.now() - lastT - 500;
      this.needsRender = true;
    } finally {
      this.setBusy(false);
    }
  }

  setBusy(on, label) {
    this.busy = on;
    this.ui.setBusy(on);
    if (on) this.ui.progress.show(label || "Working…");
    else this.ui.progress.hide();
  }

  // ---- Turntable captures -------------------------------------------------

  pageBackground() {
    const css = getComputedStyle(document.body).backgroundColor;
    const c = new Color();
    try {
      c.setStyle(css);
    } catch {
      c.set(0xffffff);
    }
    return c;
  }

  beginCapture(size) {
    if (this.paint.inStroke) this.finishStroke();
    this.paint.flushStamps();
    this.capturing = true;
    const r = this.view.renderer;
    const cam = this.view.camera;
    this._capturePrev = {
      pixelRatio: r.getPixelRatio(),
      width: this.canvas.clientWidth,
      height: this.canvas.clientHeight,
      aspect: cam.aspect,
      clearAlpha: r.getClearAlpha(),
      clearColor: r.getClearColor(new Color()),
      rotation: this.controls.rotation.clone(),
    };
    r.setPixelRatio(1);
    r.setSize(size, size, false);
    cam.aspect = 1;
    cam.updateProjectionMatrix();
    r.setClearColor(this.pageBackground(), 1);
    this.view.setPaintTextures(this.paint.wetTexture, this.paint.dryTexture);
    const q0 = this._capturePrev.rotation;
    const q = new Quaternion();
    return (t01) => {
      q.setFromAxisAngle(Y_AXIS, Math.PI * 2 * t01).multiply(q0);
      this.view.applyView(q, this.controls.distance);
      this.view.render();
    };
  }

  endCapture() {
    const p = this._capturePrev;
    const r = this.view.renderer;
    const cam = this.view.camera;
    r.setClearColor(p.clearColor, p.clearAlpha);
    r.setPixelRatio(p.pixelRatio);
    r.setSize(p.width, p.height, false);
    cam.aspect = p.aspect;
    cam.updateProjectionMatrix();
    this.view.applyView(this.controls.rotation, this.controls.distance);
    this.capturing = false;
    this.needsRender = true;
  }

  async exportGif(frames = 48, size = 512) {
    if (this.busy) return;
    this.setBusy(true, "Rendering GIF…");
    let started = false;
    try {
      const renderFrame = this.beginCapture(size);
      started = true;
      const gl = this.view.renderer.getContext();
      const buf = new Uint8Array(size * size * 4);
      const flipped = new Uint8Array(size * size * 4);
      const stride = size * 4;
      const blob = await exportGIF({
        frames,
        size,
        renderFrame: async (i, n) => {
          renderFrame(i / n);
          gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          for (let y = 0; y < size; y++) {
            flipped.set(buf.subarray((size - 1 - y) * stride, (size - y) * stride), y * stride);
          }
          return flipped;
        },
        onProgress: (f) => this.ui.progress.update(f, `Rendering GIF… ${Math.round(f * 100)}%`),
      });
      downloadBlob(blob, timestampName("gif"));
      this.ui.toast(`Saved GIF (${formatBytes(blob.size)}).`);
    } catch (err) {
      this.ui.toast(`GIF export failed: ${err.message}`);
    } finally {
      if (started) this.endCapture();
      this.setBusy(false);
    }
  }

  async exportWebm(seconds = 3) {
    if (this.busy) return;
    if (!this.webm.ok) {
      this.ui.toast(this.webm.reason);
      return;
    }
    this.setBusy(true, "Recording WebM…");
    let started = false;
    try {
      const size = 512;
      const renderFrame = this.beginCapture(size);
      started = true;
      const blob = await exportWebM({
        canvas: this.canvas,
        durationMs: seconds * 1000,
        fps: 30,
        mime: this.webm.mime,
        renderFrame,
        onProgress: (f) => this.ui.progress.update(f, `Recording WebM… ${Math.round(f * 100)}%`),
      });
      downloadBlob(blob, timestampName("webm"));
      this.ui.toast(`Saved WebM (${formatBytes(blob.size)}).`);
    } catch (err) {
      this.ui.toast(`WebM export failed: ${err.message}`);
    } finally {
      if (started) this.endCapture();
      this.setBusy(false);
    }
  }

  // ---- Embed --------------------------------------------------------------

  async makeEmbed() {
    if (this.busy) return null;
    if (this.paint.inStroke) this.finishStroke();
    this.setBusy(true, "Building embed…");
    try {
      const scene = { ...this.sceneSettings(), strokes: this.scene.strokes };
      const result = await buildEmbedHash(scene, (size) => this.snapshotDataURI(size));
      if (result.ok) {
        const snippet = embedSnippet(result.hash);
        this.ui.setEmbed({
          snippet,
          ok: true,
          note: `${result.note} URL payload: ${formatBytes(result.bytes)}.`,
        });
      } else {
        this.ui.setEmbed({ snippet: "", ok: false, note: result.note });
      }
      this.ui.openExport();
      return result;
    } catch (err) {
      this.ui.setEmbed({ snippet: "", ok: false, note: `Embed failed: ${err.message}` });
      return null;
    } finally {
      this.setBusy(false);
    }
  }
}

const app = new App();

// Test and debugging hook.
window.__splashery = {
  app,
  get webgl2() {
    return app.webgl2;
  },
  get ready() {
    return document.body.dataset.ready === "true";
  },
  exportScene: () => app.exportScene(),
  importScene: (obj) => app.importScene(obj),
  makeEmbed: () => app.makeEmbed(),
  strokeCount: () => app.scene.strokes.length,
  setMode: (m) => app.setMode(m),
  weak: () => app.weak,
  resolution: () => app.resolution,
};
