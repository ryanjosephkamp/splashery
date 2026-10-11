import { quatEuler, quatRotate } from "../kit.js";
import { live, stop } from "../live/live.js";
import {
  colorPoint,
  rgbToLab,
  rgbToHsv,
  springStep,
  STEP,
  SWATCHES,
  testPattern,
} from "./proto-color-space-camera/math.js";

const ID = "color-space-camera";
const PATTERN = testPattern();
const SPACES = [
  { id: "rgb", label: "RGB cube" },
  { id: "hsv", label: "HSV cone" },
  { id: "lab", label: "CIELAB (D65)" },
];
let photo = null; // Only sampled pixels, in page memory; never in scene options.
let hud = null;
let hooked = false;
let current = null;

const app = () => globalThis.window?.__splashery?.app;

function sampleImage(image, name) {
  const width = image.videoWidth || image.width;
  const height = image.videoHeight || image.height;
  if (!width || !height) throw new Error("The picture is not ready. Try again.");
  const ratio = Math.min(1, 48 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const ctx = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" });
  // Transparent input is composited onto white, in sRGB.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const pixels = [];
  for (let i = 0; i < data.length; i += 4)
    pixels.push([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255]);
  return { width: canvas.width, height: canvas.height, pixels, name };
}

function positionHud() {
  if (!hud) return;
  const r = document.getElementById("stage")?.getBoundingClientRect();
  if (!r) return;
  hud.style.left = `${r.left + 18}px`;
  const phone = innerWidth < 760;
  const shelfTop = document.getElementById("panel")?.getBoundingClientRect().top ?? innerHeight;
  hud.hidden = phone && shelfTop < 200;
  hud.style.top = phone ? `${shelfTop - 98}px` : "auto";
  hud.style.bottom = phone ? "auto" : "48px";
  hud.style.maxWidth = `${r.width - 36}px`;
}

function showHud(state) {
  if (typeof document === "undefined" || !app()) return;
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "color-space-camera-readout";
    hud.style.cssText =
      "position:fixed;z-index:4;pointer-events:none;white-space:pre-line;font:12px/1.5 system-ui;color:var(--ink);background:var(--paper);padding:6px 9px;border-radius:8px;";
    document.body.append(hud);
  }
  if (!hooked) {
    hooked = true;
    window.addEventListener("resize", positionHud);
    new ResizeObserver(positionHud).observe(document.getElementById("panel"));
    app().player.on("toy", (info) => {
      if (info.id === ID) return;
      hud?.remove();
      hud = null;
      photo = null;
      current = null;
    });
  }
  const space = state.space;
  const swatch = SWATCHES[state.probe];
  const hsv = rgbToHsv(swatch.rgb);
  const values =
    space === "lab"
      ? rgbToLab(swatch.rgb).map((v) => v.toFixed(2))
      : space === "hsv"
        ? hsv.map((v, i) => (i ? v.toFixed(2) : hsv[1] ? `${v.toFixed(0)}°` : "—"))
        : swatch.rgb.map((v) => v * 255);
  const coordinates =
    space === "lab" ? `L* ${values[0]}, a* ${values[1]}, and b* ${values[2]}` : values.join(", ");
  const axes = {
    rgb: "X: R, Y: G, and Z: B (0–255)",
    hsv: "Y: V · radius: S × V · angle: H",
    lab: "X: a*, Y: L*, and Z: b* · D65",
  }[space];
  const pose = state.target ? "palette" : "picture";
  const text = `${SPACES.find((s) => s.id === space).label} · ${pose}\n${axes}\n${swatch.name}: ${coordinates}\n${state.source.pixels.length.toLocaleString("en-US")} pixels · tap to ${state.target ? "return" : "spread"}`;
  if (hud.textContent !== text) hud.textContent = text;
  positionHud();
}

function panel() {
  const wrap = document.createElement("div");
  const probe = document.createElement("select");
  probe.id = "color-space-camera-probe";
  probe.setAttribute("aria-label", "Reference color");
  SWATCHES.forEach((s, i) => probe.add(new Option(s.name, i)));
  probe.value = String(current?.probe ?? 0);
  probe.addEventListener("change", () => {
    if (current) {
      current.probe = Number(probe.value);
      showHud(current);
    }
  });
  const label = document.createElement("label");
  label.className = "row";
  label.append("Reference color", probe);
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.textContent = "Refresh camera view";
  refresh.hidden = !live.owners("camera").includes(ID);
  refresh.addEventListener("click", () => app()?.setToyOptions({}));
  wrap.append(label, refresh);
  return wrap;
}

function guides(space) {
  const points = [];
  const line = (a, b, color = "#80919c") => {
    const n = Math.ceil(Math.hypot(...a.map((v, i) => b[i] - v)) / 0.035);
    for (let i = 0; i <= n; i++)
      points.push({ p: a.map((v, j) => v + ((b[j] - v) * i) / n), color });
  };
  if (space === "rgb") {
    for (let axis = 0; axis < 3; axis++) {
      for (const a of [-0.8, 0.8])
        for (const b of [-0.8, 0.8]) {
          const p = [-0.8, -0.8, -0.8];
          p[(axis + 1) % 3] = a;
          p[(axis + 2) % 3] = b;
          const q = [...p];
          q[axis] = 0.8;
          line(
            p,
            q,
            a === -0.8 && b === -0.8 ? ["#eb5548", "#34a861", "#497bea"][axis] : "#9ba6ad",
          );
        }
    }
  } else if (space === "hsv") {
    for (let i = 0; i < 96; i++) {
      const a = (i * Math.PI) / 48;
      const b = ((i + 1) * Math.PI) / 48;
      line(
        [0.85 * Math.cos(a), 0.8, 0.85 * Math.sin(a)],
        [0.85 * Math.cos(b), 0.8, 0.85 * Math.sin(b)],
      );
      if (i % 12 === 0) line([0, -0.8, 0], [0.85 * Math.cos(a), 0.8, 0.85 * Math.sin(a)]);
    }
    line([0, -0.8, 0], [0, 0.8, 0]);
  } else {
    line([-0.9, -0.45, 0], [0.9, -0.45, 0], "#db6063");
    line([0, -0.45, 0], [0, 0.45, 0], "#89929d");
    line([0, -0.45, -0.99], [0, -0.45, 0.99], "#597fc1");
  }
  return points;
}

export const RECIPES = {
  [ID]: {
    kernel: "sharp",
    density: 0.03,
    turntable: false,
    alive: () =>
      !!current &&
      (Math.abs(current.x - current.target) > 1e-6 || Math.abs(current.velocity) > 1e-6),
    options: [
      { key: "space", label: "Color space", type: "select", default: "rgb", choices: SPACES },
      {
        key: "source",
        label: "Picture",
        type: "select",
        default: "pattern",
        choices: [
          { id: "pattern", label: "Generated test pattern" },
          { id: "photo", label: "Your photo (this visit)" },
        ],
      },
    ],
    controls: [{ key: "palette", label: "Show palette", type: "toggle", default: 0, ease: 2.4 }],
    action: { key: "palette", label: "Picture or color space" },
    input: {
      title: "Your picture",
      binary: true,
      accept: "image/*,.jpg,.jpeg,.png,.webp",
      fileButton: "Open a photo…",
      note: "Every pixel of a preview up to 48 × 48 becomes one point. Use camera samples a frame; Refresh camera view samples again. Nothing is recorded, saved, or uploaded. Switch spaces to compare the same palette.",
      live: [
        { kind: "camera", button: "Use camera", options: { facing: "environment" }, flip: true },
        { render: panel },
      ],
      async read(_text, _name, file) {
        if (!file) throw new Error("Choose a photo first.");
        let image;
        try {
          image = await createImageBitmap(file, {
            colorSpaceConversion: "default",
            imageOrientation: "from-image",
          });
          const sampled = sampleImage(image, "Your photo");
          stop("camera");
          photo = sampled;
          return { source: "photo" };
        } catch {
          throw new Error(
            "This browser could not open that photo. Try a JPEG, PNG, or WebP image.",
          );
        } finally {
          image?.close();
        }
      },
      shown: () => current?.source.name || "Generated test pattern",
    },
    drive(t, c, out, info) {
      const s = info.data;
      if (!s) return;
      const time = info.time ?? t;
      const n = info.tap?.n ?? 0;
      // A tap sets the endpoint immediately; control direction also handles
      // the Toy tab's switch and saved control values.
      if (s.lastTime === null) {
        s.x = s.target = (c.palette ?? 0) > 0.5 ? 1 : 0;
        s.lastTime = time;
      }
      if (n !== s.tapN) {
        const taps = info.taps?.filter((tp) => tp.n > s.tapN).length || Math.max(1, n - s.tapN);
        if (taps % 2) s.target = 1 - s.target;
        s.tapN = n;
      } else if ((c.palette ?? 0) > s.lastControl + 1e-8) s.target = 1;
      else if ((c.palette ?? 0) < s.lastControl - 1e-8) s.target = 0;
      s.lastControl = c.palette ?? 0;
      // A suspended tab needs at most four seconds of fixed steps to settle.
      s.accumulator += Math.min(4, Math.max(0, time - s.lastTime));
      s.lastTime = time;
      while (s.accumulator + 1e-12 >= STEP) {
        [s.x, s.velocity] = springStep(s.x, s.velocity, s.target);
        s.accumulator -= STEP;
      }
      if (Math.abs(s.x - s.target) < 1e-6 && Math.abs(s.velocity) < 1e-6) {
        s.x = s.target;
        s.velocity = 0;
      }
      out.morph = [s.x, 0, 0, 0];
      out.parts.guide = { visible: s.x > 0.8 ? 1 : 0 };
      const quat = quatEuler(-8 * s.x, -32 * s.x, 0);
      out.body = { quat };
      // Sort the independently translated pixels where they are, without
      // rebuilding or changing their shape, size, opacity, or color.
      // The engine's pose sorter handles rigid parts and leaves, not morph
      // points. Update only its sort centers, just as resortTokens does.
      const proc = app()?.player?.proc;
      if (
        proc?.ctx?.kit?.data === s &&
        s.x !== s.sorted &&
        (time - s.sortTime >= 0.12 || s.x === s.target)
      ) {
        const { kit, buf } = proc.ctx;
        for (let i = 0; i < buf.count; i++) {
          const p = [0, 1, 2].map(
            (axis) =>
              buf.pos[i * 3 + axis] + (kit.morph?.[i * 3 + axis] || 0) * kit.transform.scale * s.x,
          );
          proc.container.centers.set(quatRotate(quat, p), i * 3);
        }
        proc.container.update(buf.count, true);
        s.sorted = s.x;
        s.sortTime = time;
      }
      showHud(s);
    },
    build(k, o) {
      const space = SPACES.some((s) => s.id === o.space) ? o.space : "rgb";
      const source =
        live.owners("camera").includes(ID) && live.camera?.video
          ? sampleImage(live.camera.video, "Camera frame (not recorded)")
          : o.source === "photo" && photo
            ? photo
            : PATTERN;
      const state = {
        space,
        source,
        probe: current?.probe ?? 0,
        x: 0,
        velocity: 0,
        target: 0,
        accumulator: 0,
        lastTime: null,
        lastControl: 0,
        tapN: 0,
        sorted: 0,
        sortTime: -1,
      };
      current = k.data = state;
      const guide = k.part("guide");
      const g = guides(space);
      const cell = 1.9 / Math.max(source.width, source.height);
      const points = source.pixels.map((rgb, i) => ({
        p: [
          ((i % source.width) + 0.5 - source.width / 2) * cell,
          (source.height / 2 - Math.floor(i / source.width) - 0.5) * cell,
          0.025,
        ],
        to: colorPoint(rgb, space),
        color: rgb,
        scales: [cell * 0.57, cell * 0.57, cell * 0.57],
        opacity: 1,
        pattern: false,
      }));
      k.cloud({ share: points.length / k.count, jitter: 0 }, (_rand, i) => points[i]);
      k.cloud({ share: g.length / k.count, jitter: 0, pattern: false }, (_rand, i) => ({
        ...g[i],
        scales: [0.011, 0.011, 0.011],
        opacity: 1,
        part: guide,
      }));
      showHud(state);
    },
  },
};
