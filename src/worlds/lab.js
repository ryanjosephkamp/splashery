// The character lab (worlds/lab/; docs/WORLDS.md, "The character lab"): the
// realistic person alone on a treadmill, standing, walking or running, with
// side, front and three-quarter views, slow motion and a speed control. A
// chart draws the character's joint angles over one stride, measured live
// from its bones, over the measured human gait (tools/wd-gait-refs.py), so
// a clip shows how closely they match.
//
// The angles are measured as the build tool measures them
// (tools/wd-character.py, `measure`): each limb's angle from straight down
// in the side view, positive forward; hip = thigh angle + the pelvis tilt the
// reference is measured against; knee = thigh - shank; ankle = foot - shank
// - the foot's rest angle; shoulder = upper arm - trunk lean; elbow =
// forearm - upper arm.
//
// ?gait=stand|walk|run  ?speed=<m/s>  ?slow=1|0.5|0.25|0.1
// ?view=side|front|three  ?profile=low|mid|high|max  ?clock=manual

import * as pc from "../pc.js";
import { loadHuman, stepMeshCharacter } from "./mesh-character.js";
import { useHDRI } from "./hybrid.js";
import { detectTier } from "./tiers.js";

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const ASSETS = new URL("../../assets/worlds/", import.meta.url);
const DEG = 180 / Math.PI;
const BINS = 51;

function labsOn() {
  const v = params.get("labs");
  try {
    if (v === "1") localStorage.setItem("splashery.labs", "1");
    else if (v === "0") localStorage.removeItem("splashery.labs");
    return v === "1" || (v !== "0" && localStorage.getItem("splashery.labs") === "1");
  } catch {
    return v === "1";
  }
}

// The treadmill belt: stripes on a canvas texture, scrolled with the speed.
function beltTexture(device) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#2b2f35";
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = "#3a4048";
  for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 64, 14);
  const t = new pc.Texture(device, { width: 64, height: 256, mipmaps: true, name: "lab-belt" });
  t.setSource(c);
  t.addressU = t.addressV = pc.ADDRESS_REPEAT;
  return t;
}

function gridTexture(device) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#d9dee4";
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#c4cad2";
  g.lineWidth = 2;
  g.strokeRect(0, 0, 128, 128);
  const t = new pc.Texture(device, { width: 128, height: 128, mipmaps: true, name: "lab-grid" });
  t.setSource(c);
  t.addressU = t.addressV = pc.ADDRESS_REPEAT;
  return t;
}

class Lab {
  async init() {
    if (!labsOn()) {
      $("loading").hidden = true;
      $("labs-off").hidden = false;
      document.body.dataset.ready = "labs-off";
      return;
    }
    const canvas = $("world");
    const device = await pc.createGraphicsDevice(canvas, { deviceTypes: [params.get("renderer") === "webgl2" ? pc.DEVICETYPE_WEBGL2 : pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2], antialias: true }); // prettier-ignore
    const opts = new pc.AppOptions();
    opts.graphicsDevice = device;
    opts.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem, pc.AnimComponentSystem]; // prettier-ignore
    opts.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.AnimClipHandler, pc.AnimStateGraphHandler]; // prettier-ignore
    const app = new pc.AppBase(canvas);
    app.init(opts);
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    device.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    window.addEventListener("resize", () => {
      app.resizeCanvas();
      if (this.camera) this.frame();
    });
    this.app = app;
    this.manual = params.get("clock") === "manual";
    this.pending = 0;
    this.tier = detectTier();

    // Light: one sun with soft shadows, the island's sky as image light.
    const sun = new pc.Entity("sun");
    sun.addComponent("light", { type: "directional", color: new pc.Color(1, 0.96, 0.9), intensity: 1.1, castShadows: true, shadowResolution: 2048, shadowDistance: 8, shadowType: pc.SHADOW_PCF3_32F, normalOffsetBias: 0.05, shadowBias: 0.2 }); // prettier-ignore
    sun.setEulerAngles(50, 35, 0);
    app.root.addChild(sun);
    const sky = await fetch(new URL("sky/sky.json", ASSETS)).then((r) => r.json());
    const hdr = await new Promise((res, rej) => app.assets.loadFromUrl(new URL(`sky/${sky.hdr}`, ASSETS).href, "texture", (e, a) => (e ? rej(new Error(e)) : res(a.resource)))); // prettier-ignore
    useHDRI(app, hdr, 0, sky.exposure || 1);
    // The sky lights the person; the background is the camera's plain gray.
    app.scene.layers.getLayerByName("Skybox").enabled = false;
    app.scene.exposure = 1;

    // The floor and the treadmill.
    const floorMat = new pc.StandardMaterial();
    floorMat.diffuseMap = gridTexture(device);
    floorMat.diffuseMapTiling = new pc.Vec2(12, 12);
    floorMat.diffuse = new pc.Color(0.86, 0.83, 0.79);
    floorMat.gloss = 0.2;
    floorMat.update();
    const floor = new pc.Entity("floor");
    floor.addComponent("render", { type: "plane", material: floorMat, castShadows: false, receiveShadows: true }); // prettier-ignore
    floor.setLocalScale(12, 1, 12);
    floor.setLocalPosition(0, -0.002, 0);
    app.root.addChild(floor);
    this.beltMat = new pc.StandardMaterial();
    this.beltMat.diffuseMap = beltTexture(device);
    this.beltMat.diffuseMapTiling = new pc.Vec2(1, 3);
    this.beltMat.gloss = 0.35;
    this.beltMat.update();
    const belt = new pc.Entity("belt");
    belt.addComponent("render", { type: "plane", material: this.beltMat, castShadows: false, receiveShadows: true }); // prettier-ignore
    belt.setLocalScale(0.9, 1, 3);
    app.root.addChild(belt);
    this.beltOffset = 0;

    // The person (the tier's level).
    const { model, meta } = await loadHuman(app, { tier: params.get("level") || this.tier, look: { shirt: "#e0533d" } }); // prettier-ignore
    const root = new pc.Entity("character");
    root.addChild(model);
    app.root.addChild(root);
    model.anim.update(0.001);
    this.model = model;
    this.meta = meta;
    this.ref = await fetch(new URL("lab/gait-reference.json", ASSETS)).then((r) => r.json());
    this.gaitMeta = meta.gait || { tilt: { walk: 10, run: 15 }, foot0: 0 };
    this.bones = {};
    for (const n of ["pelvis", "spine_03", "neck_01", "thigh_l", "calf_l", "foot_l", "ball_l", "upperarm_l", "lowerarm_l", "hand_l"]) // prettier-ignore
      this.bones[n] = model.findByName(n);

    // The camera.
    const cam = new pc.Entity("camera");
    cam.addComponent("camera", { clearColor: new pc.Color(0.91, 0.93, 0.95), fov: 40, nearClip: 0.05, farClip: 60, toneMapping: pc.TONEMAP_NEUTRAL, gammaCorrection: pc.GAMMA_SRGB }); // prettier-ignore
    app.root.addChild(cam);
    this.camera = cam;

    this.state = {
      gait: ["stand", "walk", "run"].includes(params.get("gait")) ? params.get("gait") : "walk",
      speed: null,
      slow: Number(params.get("slow")) || 1,
      view: ["side", "front", "three"].includes(params.get("view")) ? params.get("view") : "side",
    };
    this.setGait(this.state.gait, Number(params.get("speed")) || null);
    this.setView(this.state.view);
    this.resetCurves();
    this.bindUi();

    app.on("update", (dt) => {
      if (this.manual) {
        dt = this.pending;
        this.pending = 0;
      }
      this.step(dt);
    });
    app.on("frameend", () => this.drawChart());
    app.start();
    $("loading").hidden = true;
    $("bar").hidden = false;
    $("chart-box").hidden = params.get("chart") === "0";
    $("credits").hidden = false;
    this.frame();
    this.expose();
    document.body.dataset.ready = "true";
  }

  bindUi() {
    for (const b of document.querySelectorAll("[data-gait]")) b.addEventListener("click", () => this.setGait(b.dataset.gait)); // prettier-ignore
    for (const b of document.querySelectorAll("[data-view]")) b.addEventListener("click", () => this.setView(b.dataset.view)); // prettier-ignore
    for (const b of document.querySelectorAll("[data-slow]")) b.addEventListener("click", () => this.setSlow(Number(b.dataset.slow))); // prettier-ignore
    $("speed").addEventListener("input", () => this.setSpeed(Number($("speed").value)));
  }

  pressed(attr, value) {
    for (const b of document.querySelectorAll(`[data-${attr}]`)) b.setAttribute("aria-pressed", String(b.dataset[attr] === String(value))); // prettier-ignore
  }

  setGait(gait, speed = null) {
    this.state.gait = gait;
    const m = this.meta;
    this.setSpeed(speed ?? (gait === "stand" ? 0 : gait === "walk" ? m.walkSpeed : m.runSpeed));
    this.pressed("gait", gait);
  }

  setSpeed(v) {
    this.state.speed = Math.max(0, v);
    $("speed").value = String(this.state.speed);
    $("speed-out").textContent = `${this.state.speed.toFixed(2)} m/s`;
    const m = this.meta;
    const g = this.state.speed < 0.1 ? "stand" : this.state.speed < (m.walkSpeed + m.runSpeed) / 2 ? "walk" : "run"; // prettier-ignore
    if (g !== this.curveGait) this.resetCurves(g);
    this.pressed("gait", g);
    this.state.gait = g;
  }

  setSlow(k) {
    this.state.slow = k;
    this.pressed("slow", k);
  }

  setView(v) {
    this.state.view = v;
    this.pressed("view", v);
    // The person faces +z; the side view looks at its left side.
    this.frame();
  }

  // The camera at the view's angle, fitted to the room the bar (top) and
  // the chart (lower right, or along the bottom on a phone) leave: the
  // person, about 1.8 m tall and a stride long, fills that space.
  frame() {
    const narrow = matchMedia("(max-width: 600px)").matches;
    const c = $("chart");
    const ch = narrow ? 300 : 560;
    if (c.height !== ch) c.height = ch;
    const W = innerWidth;
    const H = innerHeight;
    const bar = $("bar").hidden ? 0 : $("bar").getBoundingClientRect().bottom;
    const box = $("chart-box");
    const chart = box.hidden ? null : box.getBoundingClientRect();
    const room = { left: 0, top: bar + 8, right: W, bottom: H };
    if (chart && narrow) room.bottom = chart.top - 4;
    else if (chart) room.right = chart.left - 4;
    const ppm = Math.max(
      40,
      Math.min((room.bottom - room.top) / 2.05, (room.right - room.left) / 1.5),
    );
    const tan = Math.tan(this.camera.camera.fov / 2 / DEG);
    const d = H / ppm / (2 * tan);
    const xc = (room.left + room.right) / 2;
    const yc = (room.top + room.bottom) / 2;
    const y = 0.9 + (yc - H / 2) / ppm;
    const off = (W / 2 - xc) / ppm;
    const a = { side: 90, front: 0, three: 40 }[this.state.view] / DEG;
    // The camera's right, seen from where it stands.
    const rx = Math.cos(a) * off;
    const rz = -Math.sin(a) * off;
    // A little above, looking down a few degrees, so the belt shows.
    this.camera.setPosition(Math.sin(a) * d + rx, y + d * 0.07, Math.cos(a) * d + rz);
    this.camera.lookAt(rx, y, rz);
  }

  resetCurves(gait = this.state?.gait) {
    this.curveGait = gait;
    this.curves = { hip: [], knee: [], ankle: [], shoulder: [], elbow: [], bob: [], sway: [] };
    for (const k in this.curves) this.curves[k] = new Array(BINS).fill(null);
    this.phase = 0;
  }

  step(dt) {
    const k = dt * this.state.slow;
    stepMeshCharacter(this.model, this.state.speed, k);
    this.beltOffset = (this.beltOffset + (this.state.speed * k) / 3) % 1;
    this.beltMat.diffuseMapOffset = new pc.Vec2(0, -this.beltOffset * 3);
    this.beltMat.update();
    this.measure();
  }

  // The character's angles now, by the build tool's definitions.
  angles() {
    const B = this.bones;
    const m = this.model;
    const F = m.forward.clone().mulScalar(-1);
    const U = m.up.clone();
    const R = new pc.Vec3().cross(F, U);
    const P = (n) => B[n].getPosition();
    const dir = (a, b) => P(b).clone().sub(P(a)).normalize();
    const sag = (d) => Math.atan2(d.dot(F), -d.dot(U)) * DEG;
    // The trunk: the upper spine bone's own axis, as the build tool takes it.
    const up = B.spine_03.getWorldTransform().getY(new pc.Vec3()).normalize();
    const trunk = Math.atan2(up.dot(F), up.dot(U)) * DEG;
    const g = this.gaitMeta;
    const tilt = g.tilt?.[this.curveGait] ?? 10;
    const thigh = sag(dir("thigh_l", "calf_l"));
    const shank = sag(dir("calf_l", "foot_l"));
    const foot = sag(dir("foot_l", "ball_l"));
    const upper = sag(dir("upperarm_l", "lowerarm_l"));
    const fore = sag(dir("lowerarm_l", "hand_l"));
    const pel = P("pelvis").clone().sub(m.getPosition());
    return {
      hip: thigh + tilt,
      knee: thigh - shank,
      ankle: foot - shank - (g.foot0 || 0),
      shoulder: upper - trunk,
      elbow: fore - upper,
      bob: pel.dot(U) * 100,
      sway: pel.dot(R) * 100,
    };
  }

  measure() {
    const L = this.model.anim.baseLayer;
    // The phase of the walk or run playing most (its own clock: the state's
    // starts a little after the clips when it is entered by a transition).
    const clips = L._controller?._animEvaluator?.clips?.filter((c) => /^(walk|run)/.test(c.name)) || []; // prettier-ignore
    const top = clips.reduce((a, c) => (!a || c.blendWeight > a.blendWeight ? c : a), null);
    const t = top?.blendWeight > 0 ? top.time / (top.track.duration || 1) : L.activeState === "Move" ? L.activeStateCurrentTime / (L.activeStateDuration || 1) : this.app.frame / 60; // prettier-ignore
    this.phase = ((t % 1) + 1) % 1;
    const a = this.angles();
    this.now = a;
    const bin = Math.round(this.phase * (BINS - 1));
    for (const k in this.curves) this.curves[k][bin] = a[k];
  }

  range(k) {
    const v = this.curves[k].filter((x) => x !== null);
    return v.length ? [Math.min(...v), Math.max(...v)] : [0, 0];
  }

  // The chart: per joint, the reference mean with one standard deviation
  // as a band, and the character's curve over it.
  drawChart() {
    const c = $("chart");
    if (!c || $("chart-box").hidden) return;
    const g = c.getContext("2d");
    const W = c.width;
    const H = c.height;
    g.clearRect(0, 0, W, H);
    const gait = this.curveGait;
    const ref = gait === "walk" || gait === "run" ? this.ref[gait] : null;
    const rows = [
      ["hip", "Hip", [-20, 50]],
      ["knee", "Knee", [-5, 110]],
      ["ankle", "Ankle", [-30, 30]],
      ["shoulder", "Shoulder", [-60, 50]],
      ["elbow", "Elbow", [-5, 120]],
    ];
    const ph = H / rows.length;
    const ink = matchMedia("(prefers-color-scheme: dark)").matches ? "#f2f2f2" : "#111";
    rows.forEach(([key, label, [lo, hi]], i) => {
      const y0 = i * ph + 16;
      const h = ph - 26;
      const X = (j) => 34 + (j / (BINS - 1)) * (W - 42);
      const Y = (v) => y0 + h - ((v - lo) / (hi - lo)) * h;
      g.strokeStyle = "rgba(127,127,127,0.35)";
      g.lineWidth = 1;
      g.strokeRect(34, y0, W - 42, h);
      g.fillStyle = ink;
      g.font = "600 13px system-ui, sans-serif";
      g.fillText(label, 34, y0 - 4);
      g.font = "11px system-ui, sans-serif";
      g.fillText(`${hi}°`, 2, y0 + 9);
      g.fillText(`${lo}°`, 2, y0 + h);
      const r = ref?.joints?.[key];
      if (r) {
        g.fillStyle = "rgba(30,120,220,0.18)";
        g.beginPath();
        r.mean.forEach((m, j) => (j ? g.lineTo(X(j), Y(m + r.sd[j])) : g.moveTo(X(j), Y(m + r.sd[j])))); // prettier-ignore
        for (let j = r.mean.length - 1; j >= 0; j--) g.lineTo(X(j), Y(r.mean[j] - r.sd[j]));
        g.fill();
        g.strokeStyle = "rgba(30,120,220,0.9)";
        g.lineWidth = 2;
        g.setLineDash([5, 4]);
        g.beginPath();
        r.mean.forEach((m, j) => (j ? g.lineTo(X(j), Y(m)) : g.moveTo(X(j), Y(m))));
        g.stroke();
        g.setLineDash([]);
      }
      g.strokeStyle = "#e0533d";
      g.lineWidth = 2.5;
      g.beginPath();
      let on = false;
      this.curves[key].forEach((v, j) => {
        if (v === null) return (on = false);
        if (on) g.lineTo(X(j), Y(v));
        else g.moveTo(X(j), Y(v));
        on = true;
      });
      g.stroke();
      const x = X(this.phase * (BINS - 1));
      g.strokeStyle = "rgba(127,127,127,0.8)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x, y0 + h);
      g.stroke();
    });
    this.writeNote(ref);
  }

  writeNote(ref) {
    const r = (k) => this.range(k);
    const span = (k) => (r(k)[1] - r(k)[0]).toFixed(0);
    const lines = [];
    if (ref) {
      lines.push(`Blue: measured people (${ref.subjects} at ${ref.speed} m/s), dashed mean, band ±1 SD. Red: the character.`); // prettier-ignore
      if (ref.arms?.shoulderRange) lines.push(`Shoulder range ${span("shoulder")}° (published ${ref.arms.shoulderRange[0]} ± ${ref.arms.shoulderRange[1]}°)`); // prettier-ignore
      lines.push(`Elbow range ${span("elbow")}° (published ${ref.arms.elbowRange[0]} ± ${ref.arms.elbowRange[1]}°)`); // prettier-ignore
      const pb = ref.pelvis.bobCm;
      lines.push(`Pelvis bob ${span("bob")} cm (published ${Array.isArray(pb) ? pb.join("–") : pb}), sway ${span("sway")} cm (${Array.isArray(ref.pelvis.swayCm) ? ref.pelvis.swayCm.join("–") : ref.pelvis.swayCm})`); // prettier-ignore
    } else if (this.now) {
      lines.push(`Standing. Shoulder ${this.now.shoulder.toFixed(0)}° (arm by the side), elbow ${this.now.elbow.toFixed(0)}°.`); // prettier-ignore
    }
    const text = lines.join("\n");
    if ($("lab-note").textContent !== text) {
      const lines = $("lab-note").textContent.split("\n").length;
      $("lab-note").textContent = text;
      // The chart's height follows its notes; the camera fits the room left.
      if (lines !== text.split("\n").length) this.frame();
    }
  }

  expose() {
    window.__lab = {
      lab: this,
      set: ({ gait, speed, slow, view } = {}) => {
        if (gait) this.setGait(gait, speed ?? null);
        else if (speed !== undefined) this.setSpeed(speed);
        if (slow) this.setSlow(slow);
        if (view) this.setView(view);
      },
      tick: async (dt) => {
        this.pending = dt;
        await new Promise((r) => this.app.once("frameend", r));
      },
      angles: () => this.angles(),
      curves: () => JSON.parse(JSON.stringify(this.curves)),
      ref: () => this.ref,
      state: () => ({
        ...this.state,
        phase: this.phase,
        anim: this.model.anim.baseLayer.activeState,
      }),
    };
  }
}

new Lab().init().catch((err) => {
  console.error(err);
  $("loading").textContent = "The lab couldn't start in this browser.";
  document.body.dataset.ready = "error";
});
