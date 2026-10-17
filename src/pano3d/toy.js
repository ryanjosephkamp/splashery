import { buildShell, movement, sample, coordinates } from "./core.js";
import { openPanorama } from "./input.js";
import { createPanoramaClient } from "./client.js";
import { SAMPLES, loadSample } from "./samples.js";
import { quatFromTo } from "../kit.js";

const ID = "step-inside-360";
const app = () => globalThis.window?.__splashery;
const active = () => app()?.player?.scene?.toy?.id === ID;
let source,
  custom,
  generation = 0,
  readVersion = 0,
  requested = [0, 0, 0],
  position = [0, 0, 0];
let status = "",
  watcher,
  tilted = false,
  tiltAnchor = null,
  headingPending = false;
const client = createPanoramaClient();
function stop() {
  generation++;
  readVersion++;
  client.dispose();
  clearInterval(watcher);
  watcher = null;
  globalThis.window?.removeEventListener("deviceorientation", orient);
  tilted = false;
  tiltAnchor = null;
}
function watch() {
  if (typeof window === "undefined" || watcher) return;
  watcher = setInterval(() => {
    if (!active()) {
      stop();
      custom = null;
      source = null;
    }
  }, 200);
}
function refine(item) {
  if (typeof Worker === "undefined" || item.depth || item.started) return;
  const token = generation;
  item.started = token;
  client
    .run(item.photo, (text) => {
      if (generation === token) status = text;
    })
    .then(async ({ depth, alignment }) => {
      if (generation !== token || source !== item || !active()) return;
      item.depth = depth;
      item.alignment = alignment;
      status = "Depth ready. Distances use an estimated room scale.";
      await app().app.setToyOptions({});
    })
    .catch((e) => {
      if (generation === token) status = `Look-around preview. ${e.message}`;
    })
    .finally(() => {
      if (item.started === token) item.started = false;
    });
}
function orient(e) {
  if (!active() || !tilted || !Number.isFinite(e.alpha) || !Number.isFinite(e.beta)) return;
  const camera = app().player.camera;
  if (!tiltAnchor)
    tiltAnchor = { alpha: e.alpha, beta: e.beta, yaw: camera.tgt.yaw, pitch: camera.tgt.pitch };
  const delta = ((e.alpha - tiltAnchor.alpha + 540) % 360) - 180;
  camera.tgt.yaw = tiltAnchor.yaw - (delta * Math.PI) / 180;
  camera.tgt.pitch = camera.clampPitch(
    tiltAnchor.pitch + ((e.beta - tiltAnchor.beta) * Math.PI) / 180,
  );
  camera.interact();
}
function panel() {
  const box = document.createElement("div"),
    row = document.createElement("div");
  row.className = "button-row";
  const button = (id, label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = `pano-${id}`;
    b.textContent = label;
    b.addEventListener("click", fn);
    row.append(b);
    return b;
  };
  const lean = (amount) => {
    const yaw = app()?.player.camera.cur.yaw || 0;
    requested[0] -= Math.cos(yaw) * amount;
    requested[2] += Math.sin(yaw) * amount;
    requested = movement(requested).position;
  };
  button("left", "Lean left", () => lean(-0.15));
  button("right", "Lean right", () => lean(0.15));
  button("step", "Step forward", () => {
    const yaw = app()?.player.camera.cur.yaw || 0;
    requested[0] += Math.sin(yaw) * 0.2;
    requested[2] += Math.cos(yaw) * 0.2;
    requested = movement(requested).position;
  });
  button("home", "Return to center", () => {
    requested = [0, 0, 0];
    position = [0, 0, 0];
  });
  button("retry", "Retry depth", () => {
    if (source) refine(source);
  });
  const tilt = button("tilt", "Use phone tilt", async () => {
    if (tilted) {
      tilted = false;
      window.removeEventListener("deviceorientation", orient);
      tilt.textContent = "Use phone tilt";
      return;
    }
    try {
      const token = generation;
      if (typeof DeviceOrientationEvent === "undefined")
        throw new Error("Phone tilt isn't available here. Drag to look around.");
      if (
        typeof DeviceOrientationEvent.requestPermission === "function" &&
        (await DeviceOrientationEvent.requestPermission()) !== "granted"
      )
        throw new Error("Tilt permission wasn't granted. Drag to look around.");
      if (!active() || token !== generation || !box.isConnected) return;
      tiltAnchor = null;
      tilted = true;
      window.addEventListener("deviceorientation", orient);
      tilt.textContent = "Stop phone tilt";
    } catch (e) {
      status = e.message;
    }
  });
  const note = document.createElement("p");
  note.className = "note";
  note.textContent =
    "Drag to look around. Lean or step up to about 1 m at an estimated scale. A single photo cannot reveal hidden surfaces. Your file stays on this device.";
  box.append(row, note);
  return box;
}

export const RECIPES = {
  [ID]: {
    label: "Step inside a 360° photo",
    density: 1.5,
    turntable: false,
    tiltLock: false,
    inside: { fov: 72 },
    pitchRange: [-1.45, 1.45],
    kernel: "sharp",
    render: { cull: "off" },
    frameReaches: true,
    options: [
      {
        key: "source",
        label: "Panorama",
        type: "select",
        default: "room",
        choices: [
          ...SAMPLES.map((s) => ({ id: s.id, label: s.label })),
          { id: "custom", label: "Your panorama" },
        ],
      },
    ],
    controls: [{ key: "lean", label: "Lean and return", type: "pulse", ease: 1.5 }],
    action: { key: "lean", label: "Lean and return" },
    input: {
      title: "A complete 360° panorama",
      binary: true,
      accept: "image/jpeg,image/png,image/webp",
      fileButton: "Open a panorama…",
      note: "A 2:1 equirectangular photo, with the ceiling and floor. Files stay on this device.",
      live: [{ render: panel }],
      async read(_text, _name, file) {
        const token = ++readVersion;
        const result = await openPanorama(file);
        if (token !== readVersion || !active()) throw new Error("Panorama canceled.");
        generation++;
        client.dispose();
        custom = {
          ...result,
          name: file.name || "Your panorama",
          heading: (-result.metadata.heading * Math.PI) / 180,
        };
        requested = [0, 0, 0];
        position = [0, 0, 0];
        headingPending = true;
        return { source: "custom" };
      },
      shown: () =>
        source
          ? `${source.name}. ${source.depth ? "Spherical depth" : "Look-around preview; depth is being estimated"}.`
          : "",
    },
    credits: [
      ...SAMPLES,
      {
        label: "Tool",
        title: "Panorama reconstruction",
        author: "Made by Ryan with Codex (GPT-6)",
        license: "MIT code; CC0 original assets",
        source: "https://github.com/ryanjosephkamp/splashery",
      },
    ],
    async prepare(o) {
      const id =
        o.source === "custom" && custom
          ? "custom"
          : SAMPLES.some((s) => s.id === o.source)
            ? o.source
            : "room";
      if (source?.id !== id || (id === "custom" && source !== custom)) {
        readVersion++;
        const token = ++generation;
        client.dispose();
        if (source) source.started = false;
        const next = id === "custom" ? custom : await loadSample(id);
        if (token !== generation) return;
        source = next;
        source.id = id;
        requested = [0, 0, 0];
        position = [0, 0, 0];
        headingPending = true;
      }
      status = source.depth
        ? "Depth ready. Distances use an estimated room scale."
        : "Look-around preview. Estimating spherical depth…";
      watch();
      if (o.source === "custom" && !custom)
        status = "Open your panorama again; links don't store it. Showing a sample.";
      refine(source);
    },
    build(k) {
      if (!source) throw new Error("Open a panorama first.");
      k.fitOn = false;
      k.reach([-1, -1, -1]);
      k.reach([1, 1, 1]);
      const shell = buildShell(
        source.photo,
        source.depth,
        Math.min(400000, k.count),
        source.heading,
      );
      const part = k.part("shell");
      k.cloud({ share: shell.n / k.count, fit: false, pattern: false, part }, (_r, i) => {
        const p = Array.from(shell.pos.subarray(i * 3, i * 3 + 3)),
          r = Math.hypot(...p);
        return {
          p,
          n: p.map((v) => -v / r),
          quat: quatFromTo(
            [0, 0, 1],
            p.map((v) => -v / r),
          ),
          scales: [shell.sigma[i], shell.sigma[i], shell.sigma[i] * 0.08],
          color: Array.from(shell.rgb.subarray(i * 3, i * 3 + 3)),
          opacity: 1,
          pattern: false,
        };
      });
      k.data = { splats: shell.n };
    },
    drive(_t, c, out) {
      if (headingPending && active()) {
        const camera = app().player.camera;
        camera.cur.yaw = camera.tgt.yaw = source.heading || 0;
        camera.cur.pitch = camera.tgt.pitch = 0;
        headingPending = false;
      }
      const yaw = app()?.player.camera.cur.yaw || 0;
      const move = movement(requested);
      requested = move.position;
      position = position.map((v, i) => v + (move.position[i] - v) * 0.12);
      const pulse = Math.sin(Math.PI * (c.lean || 0)) * 0.15;
      const displaced = movement([
        position[0] - Math.cos(yaw) * pulse,
        position[1],
        position[2] + Math.sin(yaw) * pulse,
      ]).position;
      const len = Math.hypot(...displaced);
      const [u, v] = len > 0 ? coordinates(displaced.map((n) => n / len)) : [0.5, 0.5];
      const near = source?.depth ? sample(source.depth.d, source.depth.w, source.depth.h, u, v) : 3;
      const warning = movement(displaced, near).warning;
      out.parts.shell = { offset: displaced.map((n) => -n) };
      out.legend = {
        title: source?.name || "Panorama",
        items: [
          { text: status },
          { text: `${Math.hypot(...position).toFixed(2)} m from center (estimated scale)` },
          {
            text: warning
              ? "Stretch warning: return toward the center; hidden surfaces may show gaps."
              : "Drag to look around; lean and step in Toy.",
          },
        ],
      };
    },
  },
};
