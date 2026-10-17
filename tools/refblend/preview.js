import * as pc from "/src/pc.js";
import { pose } from "./motion.mjs";
const status = document.querySelector("#status");
try {
  const result = await (await fetch("/result/result.json")).json();
  const tierName = new URLSearchParams(location.search).get("tier") || "phone";
  const tier = result.tiers[tierName];
  if (!tier) throw new Error("Choose tier=phone or tier=desktop");
  document.querySelector("#name").textContent = result.pack.replaceAll("-", " ");
  document.querySelector("#credit").textContent =
    `${result.credit}. Picture-led reconstruction. Pictures: ${result.license.author || "see result.json"}. ${result.license.images}.`;
  const canvas = document.querySelector("canvas");
  const device = await pc.createGraphicsDevice(canvas, {
    deviceTypes: ["webgl2"],
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  const app = new pc.AppBase(canvas),
    opts = new pc.AppOptions();
  opts.graphicsDevice = device;
  opts.componentSystems = [pc.CameraComponentSystem, pc.GSplatComponentSystem];
  opts.resourceHandlers = [pc.TextureHandler, pc.GSplatHandler];
  app.init(opts);
  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  const camera = new pc.Entity("camera");
  camera.addComponent("camera", {
    clearColor: new pc.Color(0.925, 0.914, 0.882),
    fov: 38,
    nearClip: 0.01,
    farClip: 100,
  });
  app.root.addChild(camera);
  let yaw = 0.6,
    pitch = 0.3,
    distance = 3.8;
  function positionCamera() {
    camera.setPosition(
      Math.sin(yaw) * Math.cos(pitch) * distance,
      Math.sin(pitch) * distance,
      Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    camera.lookAt(0, 0, 0);
  }
  positionCamera();
  new ResizeObserver(() =>
    app.resizeCanvas(canvas.parentElement.clientWidth, canvas.parentElement.clientHeight),
  ).observe(canvas.parentElement);
  async function load(file, parent = app.root, pivot = [0, 0, 0]) {
    const asset = new pc.Asset(file, "gsplat", { url: `/result/${file}`, filename: file });
    app.assets.add(asset);
    await new Promise((resolve, reject) => {
      asset.once("load", resolve);
      asset.once("error", reject);
      app.assets.load(asset);
    });
    const entity = new pc.Entity(file);
    entity.addComponent("gsplat", { asset });
    parent.addChild(entity);
    entity.setLocalPosition(...pivot.map((v) => -v));
    return entity;
  }
  const parts = [];
  if (result.parts.length) {
    if (tier.static) await load(tier.static);
    for (const part of result.parts) {
      const parent = new pc.Entity(part.name);
      parent.setLocalPosition(...part.pivot);
      app.root.addChild(parent);
      await load(tier.parts.find((p) => p.name === part.name).file, parent, part.pivot);
      parts.push({ part, entity: parent });
    }
  } else await load(tier.file);
  let start = null;
  function setProgress(t) {
    for (const { part, entity } of parts) {
      const p = pose(part.motion, t, result.normalization.radiusMeters);
      entity.setLocalPosition(...part.pivot.map((v, k) => v + p.translation[k]));
      entity.setLocalEulerAngles(...p.rotation);
    }
  }
  function tap() {
    start = performance.now();
  }
  document.querySelector("#tap").addEventListener("click", tap);
  let drag;
  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, total: 0 };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    drag.total += Math.abs(dx) + Math.abs(dy);
    drag.x = e.clientX;
    drag.y = e.clientY;
    yaw -= dx * 0.008;
    pitch = Math.max(-1.4, Math.min(1.4, pitch + dy * 0.008));
    positionCamera();
  });
  canvas.addEventListener("pointerup", () => {
    if (drag?.total < 5) tap();
    drag = null;
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      distance = Math.max(1.5, Math.min(8, distance * Math.exp(e.deltaY * 0.001)));
      positionCamera();
    },
    { passive: false },
  );
  app.on("update", () => {
    if (start !== null) {
      const t = Math.min(1, (performance.now() - start) / 1400);
      setProgress(t);
      if (t === 1) start = null;
    }
  });
  app.start();
  document.querySelector("#tap").disabled = !parts.length;
  status.textContent = `${tierName} · ${(tier.emittedSplats || tier.splats).toLocaleString("en-US")} splats · drag to orbit`;
  // Deterministic capture API, using the same entity transforms as a tap.
  window.refblend = {
    result,
    parts,
    setProgress,
    app,
    canvas,
    camera,
    tap,
    get active() {
      return start !== null;
    },
    async capture(t) {
      start = null;
      setProgress(t);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return canvas.toDataURL("image/png");
    },
  };
  document.body.dataset.ready = "true";
} catch (e) {
  status.textContent = e.message;
  document.body.dataset.error = "true";
  console.error(e);
}
