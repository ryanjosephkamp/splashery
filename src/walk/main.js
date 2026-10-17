import { WalkWorker } from "./client.js";
import { WalkView } from "./view.js";
import { WalkControls } from "./controls.js";
import { CollisionGrid } from "./grid.js";
import { CapsuleBody } from "./body.js";
import { ROOMS } from "./rooms.js";
import { PROFILES } from "../generators.js";

let active = null;
const el = (tag, text, id) => {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  if (id) e.id = id;
  return e;
};
const button = (text, id, fn) => {
  const e = el("button", text, id);
  e.type = "button";
  e.addEventListener("click", fn);
  return e;
};

export async function openWalk(profile = "low") {
  if (active) {
    active.dialog.focus();
    return active;
  }
  if (!document.querySelector("link[data-walk-style]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("./walk.css", import.meta.url).href;
    link.dataset.walkStyle = "";
    document.head.append(link);
    await new Promise((resolve, reject) => {
      link.onload = resolve;
      link.onerror = () =>
        reject(new Error("Could not load the walking view. Reload and try again."));
    });
  }
  const walk = new WalkInside(profile);
  active = walk;
  try {
    await walk.start();
  } catch (e) {
    if (!walk.closed) walk.status.textContent = e.message;
  }
  return walk;
}

export class WalkInside {
  constructor(profile) {
    this.profile = profile;
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.manual = new URLSearchParams(location.search).get("clock") === "manual";
    this.yaw = 0;
    this.pitch = 0.05;
    this.facing = 0;
    this.speed = 0;
    this.turn = 0;
    this.sequence = 0;
    this.fileSequence = 0;
    this.thirdPerson = false;
    this.busy = false;
    this.closed = false;
    this.target = null;
    this.previousFocus = document.activeElement;
    this.dialog = el("dialog", "", "walk-dialog");
    this.dialog.setAttribute("aria-labelledby", "walk-title");
    this.dialog.walk = this;
    const header = el("header");
    header.className = "walk-header";
    header.append(
      el("h2", "Walk inside", "walk-title"),
      button("Close", "walk-close", () => this.close()),
    );
    const toolbar = el("div");
    toolbar.className = "walk-toolbar";
    this.place = el("select", "", "walk-place");
    this.place.setAttribute("aria-label", "Place");
    for (const room of ROOMS) {
      const o = el("option", room.label);
      o.value = room.id;
      this.place.append(o);
    }
    this.place.addEventListener("change", () => this.load({ room: this.place.value }));
    this.file = el("input", "", "walk-file");
    this.file.type = "file";
    this.file.hidden = true;
    this.file.multiple = true;
    this.file.accept = ".ply,.sog,.spz,.ksplat,.splat,.json,.webp";
    this.file.setAttribute("aria-label", "Open a splat place");
    this.file.addEventListener("change", () =>
      this.openFiles(Array.from(this.file.files || [])).catch((e) => {
        if (!this.closed) this.status.textContent = e.message;
      }),
    );
    this.characterButton = button("Character", "walk-character", async () => {
      if (!this.view) return;
      this.characterButton.disabled = true;
      try {
        if (!this.thirdPerson) {
          this.status.textContent = "Preparing Worlds’ character…";
          await this.view.buildCharacter();
          if (this.closed) return;
          this.status.textContent = "";
        }
        this.thirdPerson = !this.thirdPerson;
        this.characterButton.setAttribute("aria-pressed", String(this.thirdPerson));
        if (!/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) this.canvas.focus();
      } catch (e) {
        if (!this.closed) this.status.textContent = e.message;
      } finally {
        this.characterButton.disabled = false;
      }
    });
    this.characterButton.setAttribute("aria-pressed", "false");
    this.lockButton = button("Mouse look", "walk-lock", async () => {
      try {
        await this.canvas.requestPointerLock();
        this.canvas.focus();
      } catch {
        this.status.textContent = "Mouse lock is unavailable here. Drag to look instead.";
      }
    });
    this.openFileButton = button("Open file…", "walk-open-file", () => this.file.click());
    toolbar.append(
      this.place,
      this.openFileButton,
      this.characterButton,
      this.lockButton,
      button("Start over", "walk-reset", () => {
        this.body?.reset();
        this.target = null;
        this.yaw = 0;
        this.pitch = 0.05;
        this.status.textContent = "";
        this.canvas.focus();
      }),
    );
    const stage = el("div");
    stage.className = "walk-stage";
    this.canvas = el("canvas", "", "walk-canvas");
    this.canvas.setAttribute(
      "aria-label",
      "Walk through the splat place. Use W, A, S, and D, or the thumb stick, to move. Drag to look. Tap the floor to go there.",
    );
    this.canvas.tabIndex = 0;
    this.vignette = el("div");
    this.vignette.className = "walk-shade";
    this.edgeShade = el("div");
    this.edgeShade.className = "walk-edge-shade";
    this.status = el("p", "Finding the floor and walls…", "walk-status");
    this.status.setAttribute("role", "status");
    this.hint = el(
      "p",
      matchMedia("(pointer: coarse)").matches
        ? "Left stick to walk. Drag here to look. Tap the floor to go."
        : "WASD to walk · Drag to look · Click the floor to go",
    );
    this.hint.className = "walk-hint";
    this.stick = el("div", "", "walk-stick");
    this.stick.setAttribute("role", "group");
    this.stick.setAttribute("aria-label", "Movement thumb stick");
    this.stick.append(el("span"));
    this.settings = this.buildSettings();
    this.place.disabled = true;
    this.openFileButton.disabled = true;
    this.levelButton.disabled = true;
    stage.append(this.canvas, this.vignette, this.edgeShade, this.hint, this.stick, this.settings);
    const footer = el("footer");
    footer.className = "walk-footer";
    footer.append(
      el(
        "p",
        "Files stay on this device. Test places: original kit scenes, CC0. Made by Ryan with Codex (GPT-6).",
      ),
    );
    this.dialog.append(header, toolbar, this.status, stage, footer, this.file);
    this.dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      this.close();
    });
    document.body.append(this.dialog);
    this.dialog.showModal();
    this.releaseRender = globalThis.__splashery?.player?.stage?.holdRendering?.();
    this.controls = new WalkControls(this.canvas, this.stick, {
      onLook: (dy, dp) => {
        this.yaw += dy;
        this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch + dp));
        this.turn += Math.abs(dy);
      },
      onTap: (x, y) => this.tap(x, y),
      onStop: () => {
        this.target = null;
      },
    });
  }
  buildSettings() {
    const d = el("details", "", "walk-settings");
    d.append(el("summary", "Level & floor"));
    d.append(
      el(
        "p",
        "If the place is sideways, set its up direction, then find the floor. Scan units are not always meters.",
      ),
    );
    this.levelInputs = {};
    for (const [key, name, value, min, max] of [
      ["pitch", "Tilt forward (degrees)", 0, -180, 180],
      ["roll", "Tilt sideways (degrees)", 0, -180, 180],
      ["meters", "Meters per file unit", 1, 0.01, 100],
    ]) {
      const label = el("label", name),
        input = el("input", "", `walk-${key}`);
      input.type = "number";
      input.min = min;
      input.max = max;
      input.step = key === "meters" ? 0.01 : 1;
      input.value = value;
      this.levelInputs[key] = input;
      label.append(input);
      d.append(label);
    }
    const flip = el("label", "Flip up"),
      input = el("input", "", "walk-flip");
    input.type = "checkbox";
    this.levelInputs.flip = input;
    flip.append(input);
    d.append(flip);
    const automatic = el("label", "Auto-level the fitted floor"),
      autoInput = el("input", "", "walk-auto-level");
    autoInput.type = "checkbox";
    autoInput.checked = true;
    this.levelInputs.auto = autoInput;
    automatic.append(autoInput);
    d.append(automatic);
    this.levelButton = button("Find the floor again", "walk-level", () => {
      const level = {};
      for (const [key, input] of Object.entries(this.levelInputs)) {
        if (input.type === "checkbox") level[key] = input.checked;
        else {
          if (!input.checkValidity()) {
            input.reportValidity();
            return;
          }
          level[key] = Number(input.value);
        }
      }
      this.load({ level }, true);
    });
    d.append(
      this.levelButton,
      el(
        "p",
        "10 cm collision cells · 25 cm steps · 35° slopes. First person has no head bob. Amber haze marks the capture’s edge.",
      ),
    );
    this.stats = el("output", "", "walk-stats");
    const detailLabel = el("label", "Drawing detail"),
      detail = el("select", "", "walk-detail");
    for (const [value, text] of [
      ["auto", "Auto (aim for 30 fps)"],
      ["full", "Full resolution"],
    ]) {
      const option = el("option", text);
      option.value = value;
      detail.append(option);
    }
    detail.addEventListener("change", () => {
      if (!this.view) return;
      this.view.autoResolution = detail.value === "auto";
      this.view.pixelRatio = 1;
      this.view.resolutionFrames = 0;
      this.view.world.setPixelRatio(1);
      this.view.world.frameMs.length = 0;
    });
    detailLabel.append(detail);
    d.append(detailLabel);
    d.append(this.stats);
    return d;
  }
  async start() {
    const view = await WalkView.create(this.canvas, this.profile);
    if (this.closed) {
      view.destroy();
      return;
    }
    this.view = view;
    view.app.on("update", (dt) => {
      const host = globalThis.__splashery?.player;
      if (host && host.scene?.toy?.id !== "walk-inside") {
        this.close();
        return;
      }
      if (!this.body || this.busy || this.closed) return;
      this.advance(this.manual ? 0 : Math.min(dt, 0.1));
    });
    await this.load({ room: "gallery" });
  }
  async openFiles(files) {
    const fileId = ++this.fileSequence;
    this.file.value = "";
    const file =
      files.find((f) => /\.(ply|sog|spz|ksplat|splat)$/i.test(f.name)) ||
      files.find((f) => /meta\.json$/i.test(f.name));
    if (!file) {
      this.status.textContent =
        "Choose PLY, SOG, SPZ, or KSPLAT. For an unzipped SOG, select meta.json with its WebP pictures.";
      return;
    }
    if (files.reduce((n, f) => n + f.size, 0) > (this.profile === "low" ? 350e6 : 800e6)) {
      this.status.textContent =
        "That file is too large for this device. Open a lighter copy, or shrink it in Splat toolkit.";
      return;
    }
    const name = file.name;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const companions = await Promise.all(
      files
        .filter((f) => f !== file)
        .map(async (f) => [f.name, new Uint8Array(await f.arrayBuffer())]),
    );
    if (!this.closed && fileId === this.fileSequence)
      await this.load({ bytes, name, files: companions });
  }
  async load(args, keepWorker = false) {
    if (args.name) this.sourceName = args.name;
    if (args.room) {
      this.sourceName = null;
      this.fileSequence++;
    }
    const id = ++this.sequence;
    this.busy = true;
    this.place.disabled = true;
    this.openFileButton.disabled = true;
    this.controls.clear();
    this.target = null;
    this.levelButton.disabled = true;
    this.status.textContent = "Finding the floor and walls…";
    if (!keepWorker) {
      this.worker?.destroy();
      this.worker = new WalkWorker();
    }
    try {
      const result = await this.worker.run({
        ...args,
        budget: (PROFILES[this.profile] || PROFILES.low).defaultCount,
      });
      if (this.closed || id !== this.sequence) return;
      const grid = new CollisionGrid(result.grid),
        body = new CapsuleBody(grid, result.spawn);
      this.view.setPlace(result, grid);
      this.grid = grid;
      this.body = body;
      this.result = result;
      this.yaw = 0;
      this.pitch = 0.05;
      const name = args.name || (keepWorker ? this.sourceName : null);
      if (name) {
        let o = this.place.querySelector('option[value="custom"]');
        if (!o) {
          o = el("option");
          o.value = "custom";
          o.disabled = true;
          this.place.append(o);
        }
        o.textContent = name;
        this.place.value = "custom";
      }
      if (args.room) this.place.querySelector('option[value="custom"]')?.remove();
      this.status.textContent = "";
      this.canvas.focus();
      this.advance(0);
    } catch (err) {
      if (!this.closed && id === this.sequence && err.name !== "AbortError")
        this.status.textContent = err.message;
    } finally {
      if (!this.closed && id === this.sequence) {
        this.busy = false;
        this.place.disabled = false;
        this.openFileButton.disabled = false;
        this.levelButton.disabled = false;
      }
    }
  }
  advance(dt, input) {
    if (!this.body) return;
    let { x, y } = input || this.controls.read();
    let dx = -Math.cos(this.yaw) * x + Math.sin(this.yaw) * y;
    let dz = Math.sin(this.yaw) * x + Math.cos(this.yaw) * y;
    if (this.target && !x && !y) {
      dx = this.target[0] - this.body.pos[0];
      dz = this.target[2] - this.body.pos[2];
      const distance = Math.hypot(dx, dz);
      if (distance < 0.12) {
        this.target = null;
        dx = dz = 0;
      } else {
        dx /= distance;
        dz /= distance;
      }
    }
    const before = this.body.distance;
    this.body.update(dt, { x: dx, z: dz });
    this.speed = dt ? (this.body.distance - before) / dt : 0;
    if (this.speed > 0.03) this.facing = Math.atan2(dx, dz);
    if (this.target && this.body.blocked && this.speed < 0.03) {
      this.target = null;
      this.status.textContent = "That path is blocked. Choose a closer spot on the floor.";
    }
    this.view.update(this, dt);
    this.vignette.style.opacity = String(Math.min(0.65, this.turn * 3));
    this.turn *= Math.exp(-Math.max(dt, 1 / 120) * 8);
    this.edgeTimer = (this.edgeTimer || 0) + dt;
    if (this.edgeTimer > 0.15 || !dt) {
      this.edgeTimer = 0;
      this.edgeDistance = this.grid.edgeDistance(this.body.pos);
      this.edgeShade.style.opacity = String(Math.max(0, 0.65 - this.edgeDistance) * 0.6);
      if (this.body.blocked === "edge")
        this.status.textContent = "Capture edge — turn back toward the place.";
      else if (this.status.textContent.startsWith("Capture edge")) this.status.textContent = "";
      const times = this.view.world.frameMs.slice(-60).sort((a, b) => a - b),
        median = times[Math.floor(times.length / 2)] || 0;
      this.stats.textContent = `${this.result.count.toLocaleString("en-US")} splats · ${this.view.shown.toLocaleString("en-US")} visible · ${Math.round(this.result.grid.buildMs)} ms grid · ${this.result.grid.cell * 100} cm cells · ${Math.round(this.result.floor.confidence * 100)}% floor support · ${median ? Math.round(1000 / median) : "—"} fps`;
    }
  }
  tap(x, y) {
    if (!this.body || this.busy) return;
    const { origin, dir } = this.view.ray(x, y);
    if (dir[1] >= -0.02) return;
    for (let t = 0.1; t < 20; t += 0.05) {
      const p = origin.map((v, a) => v + dir[a] * t);
      const support = this.grid.support(p[0], p[2], p[1] + 0.04, 0.09);
      if (support) {
        const s = this.grid.safeSupport(p[0], p[2], support.height + 0.03, this.body.radius, 0.1);
        if (s && s.slope <= 35 && this.grid.clear([p[0], s.height, p[2]])) {
          this.target = [p[0], s.height, p[2]];
          this.status.textContent = "";
        }
        return;
      }
      if (!this.grid.clear([p[0], p[1], p[2]], 0.02, 0.04)) return;
    }
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.sequence++;
    this.controls.destroy();
    this.worker?.destroy();
    this.view?.destroy();
    this.releaseRender?.();
    this.dialog.close();
    this.dialog.remove();
    this.previousFocus?.focus();
    if (active === this) active = null;
  }
}
