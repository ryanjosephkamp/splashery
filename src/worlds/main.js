// The Worlds page (worlds/index.html): loads a world file, shows its start
// screen and its list of places at once (page text, readable without the
// 3D view), then builds the world and lets the visitor walk in it.
// ?world=<id> picks worlds/<id>/world.json (the Test island by default).

import { loadWorld, RENDER_MODES } from "./world-file.js";
import { WorldView, NoGPUError } from "./render.js";
import { World } from "./world.js";
import { Controls } from "./controls.js";
import { detectTier, WORLD_BUDGETS } from "./tiers.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// The labs switch, as the toy box keeps it (src/toys.js, labsOn).
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

class Page {
  async init() {
    if (!labsOn()) {
      $("start").hidden = true;
      $("labs-off").hidden = false;
      document.body.dataset.ready = "labs-off";
      return;
    }
    const id = (params.get("world") || "test-island").replace(/[^a-z0-9-]/gi, "");
    this.started = false;
    this.cardFrom = null;
    let def;
    try {
      def = await loadWorld(`./${id}/world.json`);
    } catch (err) {
      this.fail(`Could not open this world: ${err.message}`);
      return;
    }
    this.def = def;
    document.title = `${def.title} · Splashery Worlds`;
    $("start-title").textContent = def.title;
    $("start-welcome").textContent = def.welcome;
    $("hud-title").textContent = def.title;
    $("enter").textContent = def.enter;
    this.fillList();
    this.bindMenus();

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      this.view = await WorldView.create($("world"), { prefer: params.get("renderer") || "auto" });
    } catch (err) {
      if (!(err instanceof NoGPUError)) console.error(err);
      this.fail("Your browser can't draw this world in 3D, but every place in it is in the list.");
      document.body.dataset.ready = "no-gpu";
      return;
    }
    this.tier = detectTier();
    // Render settings per tier; ?dpr= and ?kernel= override them.
    const tierBudget = WORLD_BUDGETS[this.tier];
    this.view.setPixelRatio(Number(params.get("dpr")) || tierBudget.ratio);
    this.view.setKernel(params.get("kernel") || tierBudget.kernel);
    // ?render=splats|hybrid overrides the world file's mode; ?shadows=0
    // turns the sun's shadows off.
    const mode = RENDER_MODES.includes(params.get("render")) ? params.get("render") : def.render;
    // ?character=splats|mesh|kenney overrides the world file's character.
    const characterModel = ["splats", "mesh", "kenney", "splat-person"].includes(params.get("character")) ? params.get("character") : def.character.model; // prettier-ignore
    // ?frame=0|1 turns hybrid mode's camera frame (bloom, grade, ambient
    // occlusion) off or on whatever the tier.
    const frame = params.has("frame") ? params.get("frame") === "1" : null;
    const world = new World(this.view, def, this.tier, { reducedMotion, mode, shadows: params.get("shadows") !== "0", characterModel, frame, tuning: params.get("tuning") !== "0" }); // prettier-ignore
    this.world = world;
    // A wide view behind the start screen.
    world.overview = true;
    await world.build((f, label) => this.progress(f, label));
    world.onLandmark = (l) => this.onNear(l);
    this.controls = new Controls($("world"), {
      stick: $("stick"),
      onTap: (x, y) => this.onTap(x, y),
      onLook: (dy, dp) => this.started && world.camera.look(dy, dp),
      onZoom: (f) => this.started && world.camera.zoom(f),
    });
    // ?clock=manual: time moves only when a tool asks (clips and tests).
    this.manual = params.get("clock") === "manual";
    this.pending = 0;
    this.forced = null;
    this.view.onUpdate((dt) => {
      if (this.manual) {
        dt = this.pending;
        this.pending = 0;
      }
      let input = this.started && this.controls.enabled ? this.controls.read() : null;
      if (this.forced) input = this.forced;
      world.update(dt, input);
    });
    $("enter").disabled = false;
    $("enter").focus();
    if (params.get("stats") === "1") this.showStats();
    this.exposeForTests();
    document.body.dataset.ready = "true";
  }

  // ?stats=1: a small readout for testing on a phone (frames per second, the
  // tier, the mode, the character, splats drawn and draw calls), twice a
  // second. Nothing is sent anywhere; a screenshot carries the numbers.
  showStats() {
    const box = document.createElement("div");
    box.id = "stats";
    box.className = "stats";
    box.setAttribute("aria-live", "off");
    document.body.append(box);
    const w = this.world;
    const tick = () => {
      const f = this.view.frameMs.slice(-60).sort((a, b) => a - b);
      const ms = f.length ? f[Math.floor(f.length / 2)] : 0;
      const s = w.stats();
      const who = w.characterModel === "mesh" ? `person (${w.meshCharacter?.wdCharacter?.level || "?"})` : w.characterModel; // prettier-ignore
      box.textContent = [
        `${ms ? (1000 / ms).toFixed(0) : "–"} fps (${ms.toFixed(1)} ms)`,
        `${w.tier} tier · ${w.mode}`,
        `character: ${who}`,
        `${Math.round(s.total / 1000)}k splats · ${this.view.drawCalls ?? 0} draws`,
        `${this.view.canvas.width}×${this.view.canvas.height} px`,
      ].join("\n");
      box.dataset.fps = ms ? (1000 / ms).toFixed(1) : "0";
    };
    tick();
    this.statsTimer = setInterval(tick, 500);
  }

  fail(message) {
    $("progress-label").textContent = message;
    $("progress").hidden = true;
    $("enter").hidden = true;
  }

  progress(f, label) {
    $("progress-bar").style.width = `${Math.round(f * 100)}%`;
    $("progress").setAttribute("aria-valuenow", String(Math.round(f * 100)));
    $("progress-label").textContent = f >= 1 ? "Ready" : label;
  }

  enter() {
    if (this.started || !this.world) return;
    this.started = true;
    $("start").hidden = true;
    $("hud").hidden = false;
    this.world.overview = false;
    this.world.camera.snap(this.world.focus(), this.world.char.facing);
    this.world.catchUp();
    $("world").focus();
    this.showHint(true);
  }

  showHint(on) {
    const h = $("hint");
    clearTimeout(this.hintTimer);
    h.classList.remove("fade");
    h.hidden = !on;
    $("help-open").setAttribute("aria-expanded", String(on));
    if (on) this.hintTimer = setTimeout(() => h.classList.add("fade"), 7000);
  }

  bindMenus() {
    $("enter").addEventListener("click", () => this.enter());
    $("start-list").addEventListener("click", () => this.openList());
    $("places-open").addEventListener("click", () => this.openList());
    $("places-close").addEventListener("click", () => $("places").close());
    $("places").addEventListener("close", () => {
      if (this.controls) this.controls.enabled = true;
      (this.started ? $("world") : $("start-list")).focus();
    });
    $("card-close").addEventListener("click", () => this.closeCard());
    $("help-open").addEventListener("click", () => this.showHint($("hint").hidden || $("hint").classList.contains("fade"))); // prettier-ignore
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("card").hidden) this.closeCard();
      if (e.key === "Enter" && !this.started && document.activeElement === document.body)
        this.enter();
    });
  }

  // The plain list: every landmark as page text, for people in a hurry,
  // screen readers and search engines.
  fillList() {
    const ol = $("places-list");
    ol.textContent = "";
    for (const l of this.def.landmarks) {
      const li = document.createElement("li");
      li.dataset.landmark = l.id;
      const h = document.createElement("h3");
      h.textContent = l.title;
      li.append(h);
      if (l.words) {
        const p = document.createElement("p");
        p.textContent = l.words;
        li.append(p);
      }
      const row = document.createElement("div");
      row.className = "row";
      if (l.link) {
        const a = document.createElement("a");
        a.href = l.link.href;
        a.textContent = l.link.label;
        row.append(a);
      }
      const go = document.createElement("button");
      go.type = "button";
      go.textContent = "Go there";
      go.addEventListener("click", () => {
        $("places").close();
        if (!this.world) return;
        if (!this.started) this.enter();
        this.world.goTo(l);
        this.openCard(l, "list");
      });
      row.append(go);
      li.append(row);
      ol.append(li);
    }
    $("places-note").textContent = `Every place in ${this.def.title}, as a plain list (${this.def.landmarks.length}).`; // prettier-ignore
  }

  openList() {
    if (this.controls) {
      this.controls.enabled = false;
      this.controls.keys.clear();
    }
    $("places").showModal();
  }

  onNear(l) {
    if (l) this.openCard(l, "near");
    else if (this.cardFrom === "near") this.closeCard();
  }

  onTap(x, y) {
    if (!this.started) return;
    const l = this.world.landmarkAt(x, y);
    if (l) this.openCard(l, "tap");
  }

  openCard(l, from) {
    this.cardFrom = from;
    this.card = l;
    $("card-title").textContent = l.title;
    $("card-words").textContent = l.words;
    const img = $("card-picture");
    if (l.picture) {
      img.src = new URL(l.picture.src, location.href).href;
      img.alt = l.picture.alt;
      img.hidden = false;
    } else {
      img.hidden = true;
      img.removeAttribute("src");
    }
    const a = $("card-link");
    if (l.link) {
      a.href = l.link.href;
      a.textContent = l.link.label;
      a.hidden = false;
    } else a.hidden = true;
    $("card").hidden = false;
    $("card").dataset.landmark = l.id;
  }

  closeCard() {
    $("card").hidden = true;
    this.cardFrom = null;
    this.card = null;
  }

  // Hooks for tests and clip tools (tests/wd.spec.mjs, tools/world-clip.mjs).
  exposeForTests() {
    const world = this.world;
    window.__world = {
      page: this,
      world,
      view: this.view,
      tier: this.tier,
      mode: world.mode,
      enter: () => this.enter(),
      stats: () => world.stats(),
      char: () => ({ pos: world.char.pos.slice(), facing: world.char.facing, speed: world.char.gait.speed, blocked: world.char.blocked }), // prettier-ignore
      ground: (x, z) => world.terrain.heightAt(x, z),
      // Steps the world by hand (without drawing), `seconds` long at 30
      // steps a second,
      // with a fixed input ({ x, y, run }), or "keys" for what the keys and
      // the stick say.
      step: (input, seconds = 1) => {
        const n = Math.round(seconds * 30);
        for (let i = 0; i < n; i++) {
          const inp = input === "keys" ? this.controls.read() : { amount: Math.min(1, Math.hypot(input.x || 0, input.y || 0)), x: 0, y: 0, run: false, ...input }; // prettier-ignore
          world.update(1 / 30, inp);
        }
        return window.__world.char();
      },
      place: (x, z, facing = 0) => world.spawn([x, z], facing),
      // Manual clock: the next frame advances by dt with this input.
      tick: async (dt, input = null) => {
        this.pending = dt;
        this.forced = input ? { amount: Math.min(1, Math.hypot(input.x || 0, input.y || 0)), x: 0, y: 0, run: false, ...input } : null; // prettier-ignore
        await this.view.nextFrame();
        this.forced = null;
      },
      // Builds every chunk the level of detail wants now, without drawing.
      catchUp: () => {
        world.catchUp();
        return world.stats();
      },
      card: () => ($("card").hidden ? null : $("card").dataset.landmark),
    };
  }
}

new Page().init().catch((err) => {
  console.error(err);
  document.body.dataset.ready = "error";
});
