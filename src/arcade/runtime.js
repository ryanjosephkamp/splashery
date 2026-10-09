// Lane Arcade: the game kit's runtime. A kit toy whose recipe has an
// `arcade` block is a game: the player starts this runtime when the toy is
// built (the module loads only then) and calls it every frame. It owns
//
//   - the game's splats (layer.js: sprites that move, turn, fade and shatter)
//   - a steady fixed-step clock (120 steps a second), pause, restart and the
//     tab-hidden pause
//   - the controls (input.js: keys, mouse, touch, an on-screen pad and game
//     controllers) and the screen furniture (hud.js)
//   - play mode: the game on the whole page (the Fullscreen API where the
//     browser allows it, else filling the window), Esc or back to leave
//   - the 2D/3D switch: a button that slides the game smoothly between its
//     flat view and its 3D one (a continuous blend, 0 to 1, that the game's
//     render and camera read; the game keeps running with the same rules)
//   - the camera (the game says where to look for each blend)
//   - the best score, kept on this device
//
// The recipe's arcade block (docs/handoff/Arcade.md has the full list):
//
//   arcade: {
//     title, goal,                       // for the controls card
//     stats: [{ key, label, icon }],     // the HUD's chips, in order
//     best: "score",                     // the stat kept as a best score
//     views: true,                       // has a 2D/3D switch
//     pad: ["left", "right", "fire"],    // the on-screen pad (touch)
//     controls: { keys, mouse, touch, pad, short },
//     slots: { high, mid, low },         // splats the layer holds
//     look: { yaw, pitch, zoom, keys },  // Arcade r3: in 3D, two fingers (or the
//                                        // right mouse button) turn the view up
//                                        // to yaw and pitch radians each way, a
//                                        // pinch or the wheel zooms within zoom
//                                        // ([nearest, farthest] distance factors);
//                                        // keys: Q and E turn it too
//     tapFire: false,                    // a tap in play is not a fire press
//     create(api) -> game,               // may be async (load more code)
//   }
//
//   game.reset()                         a new game (options from api.options)
//   game.step(dt, ctl)                   one fixed step; ctl = { input, pressed,
//                                        view, viewTo, demo, time }
//   game.render(view, frameDt)           place the sprites for this frame
//   game.camera(view, aspect)            { target, yaw, pitch, distance, roll }
//   game.stats()                         { score, lives, level, ... }
//   game.status()                        { over, won, title, lines }
//   game.onView?(to)                     the switch was pressed (to: 0 or 1)
//
// api.lookBy(dx, dy) turns the look (in stage widths, as a drag) for a game
// that reads a one-finger drag as looking; api.look() is the look now
// ({ yaw, pitch, zoom }, already scaled by the view's blend).

import { ArcadeLayer, Sprites, Points, kitModel, makeModel, recolor, stepPieces } from "./layer.js";
import * as Q from "./layer.js";
import { Input } from "./input.js";
import { Hud } from "./hud.js";
import { rotate } from "../camera.js";

export const STEP = 1 / 120;
const MAX_STEPS = 10;
const SWITCH_SECONDS = 1.1;
const SLOTS = { high: 60000, max: 80000, mid: 40000, low: 28000 };

const hooked = new WeakSet();

export class ArcadeRuntime {
  constructor(player, recipe, options, ctx) {
    this.player = player;
    this.recipe = recipe;
    // (Arcade r3: a game's pad, its labels and its controls card may depend
    // on its options: a function of them)
    const def = { ...recipe.arcade };
    for (const k of ["pad", "padLabels", "controls"]) if (typeof def[k] === "function") def[k] = def[k](options || {}); // prettier-ignore
    this.def = def;
    this.options = options || {};
    this.ctx = ctx;
    const stage = player.stage;
    this.stage = stage;
    const prof = player.profile;
    const slots = this.def.slots?.[prof] ?? this.def.slots?.high ?? SLOTS[prof] ?? SLOTS.high;
    this.layer = new ArcadeLayer(stage, slots, { reach: this.def.reach ?? 3 });
    this.sprites = new Sprites(this.layer);
    this.mode = "attract"; // attract | play | paused | over
    this.view = this.options.view === "3d" ? 1 : 0;
    this.viewTo = this.view;
    this.viewT = this.view;
    this.time = 0;
    this.acc = 0;
    this.frames = 0;
    this.playMode = false;
    this.autopilot = false; // clips and tests: the game plays itself in play
    this.cam = null;
    this.stats = { frame: 0, steps: 0, gameMs: 0, splats: 0 };
    this.bestKey = `splashery.arcade.${player.toyInfo?.id || recipe.arcade.title}.${this.options.style || ""}.${this.options.level ?? ""}`; // prettier-ignore
    this.best = readBest(this.bestKey);
    this.hud = new Hud(player.canvas, this.def, {
      play: () => this.enterPlay(),
      exit: () => this.exitPlay(),
      view: () => this.toggleView(),
      pause: () => this.togglePause(),
      restart: () => this.restart(),
      choose: (id) => this.choose(id),
      file: recipe.input?.read ? () => this.openFile() : null,
      pad: (a, down) => {
        this.input.pad(a, down);
        if (down) this.wake();
      },
    });
    this.hud.setView(this.viewTo > 0.5);
    this.hud.setPaused(true);
    // (Arcade r3: def.choiceKey names the option that holds the choice, so
    // it starts as saved: Photo Dash's ball)
    const saved = this.def.choiceKey ? this.options[this.def.choiceKey] : null;
    this.choice = this.def.choices?.some((c) => c.id === saved) ? saved : (this.def.choices?.[0]?.id ?? null); // prettier-ignore
    this.hud.setChoice(this.choice);
    this.input = new Input(this.hud.surface);
    this.look = { yaw: 0, pitch: 0, zoom: 0 };
    this.input.wheelZoom = !!this.def.look;
    this.input.onPress = (a) => {
      if (a === "fire" && this.mode !== "play") this.wake();
    };
    this.input.onCommand = (a) => {
      if (a === "pause") this.togglePause();
      else if (a === "view") this.toggleView();
      else if (a === "restart") this.restart();
      else if (a === "exit") this.exitPlay();
    };
    this.hud.surface.addEventListener("pointerdown", () => {
      // A press that starts or resumes the game isn't also an aimed tap.
      if (this.mode !== "play") this.input.skipTap = true;
      this.wake();
    });
    player.canvas.classList.add("arc-canvas");
    // Leaving the page or the tab pauses the game.
    this.onVis = () => {
      if (document.hidden && this.mode === "play") this.pause(true);
    };
    document.addEventListener("visibilitychange", this.onVis);
    // A press anywhere else on the page (the app's panels) hands the keys back.
    this.onDocDown = (e) => {
      if (this.playMode || !this.input.active) return;
      const path = e.composedPath?.() || [];
      if (path.includes(this.hud.el)) return;
      // The app's own play buttons play and pause the game themselves.
      if (path.some((n) => n.id === "hands-play" || n.id === "toy-action")) return;
      this.input.active = false;
      if (this.mode === "play") this.pause(true);
    };
    document.addEventListener("pointerdown", this.onDocDown, true);
    this.onFs = () => {
      if (this.playMode && !fullscreenElement() && this.usedFs) this.exitPlay();
    };
    document.addEventListener("fullscreenchange", this.onFs);
    document.addEventListener("webkitfullscreenchange", this.onFs);
    this.onPop = () => {
      if (this.playMode) {
        this.pushed = false;
        this.exitPlay();
      }
    };
    addEventListener("popstate", this.onPop);
    // The Toy tab's Play button (the recipe's action) starts or pauses.
    if (!hooked.has(player)) {
      hooked.add(player);
      player.on("action", (r) => {
        if (!r?.echo && r?.key === player.arcade?.recipe.action?.key) player.arcade?.wake(true);
      });
    }
    // The toy's own splats are only the game's still picture (for the
    // shelf's tools and a first look): the game draws itself on its layer.
    this.toyEntity = stage.toy?.entity || null;
    if (this.toyEntity) this.toyEntity.enabled = false;
    this.ready = this.start();
  }

  async start() {
    const api = {
      sprites: this.sprites,
      points: (n, opts) => new Points(this.sprites, n, opts),
      kitModel,
      makeModel,
      recolor,
      stepPieces,
      q: Q,
      options: this.options,
      profile: this.player.profile,
      data: this.ctx?.kit?.data || {},
      rand: mulberry32(hashString(this.bestKey)),
      sound: (spec) => this.sound(spec),
      aspect: () => this.aspect(),
      ray: (x, y) => this.ray(x, y),
      pose: () => (this.cam ? orbitPose(this.cam) : null),
      fitDistance,
      best: () => this.best,
      lookBy: (dx, dy) => this.lookBy(dx, dy),
      look: () => ({ yaw: this.look.yaw * this.view, pitch: this.look.pitch * this.view, zoom: Math.exp(this.look.zoom * this.view) }), // prettier-ignore
    };
    this.game = await this.def.create(api);
    if (this.dead) return;
    this.game.reset();
    // A game may bring its own backdrop (space is dark); put back on leaving.
    if (this.def.background) {
      const h = this.def.background;
      this.stage.setClearColor(
        [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255),
        1,
      );
    }
    this.game.render(this.view, 0);
    this.sprites.write();
    this.layer.upload(true);
    this.stage.requestRender(300);
  }

  // ---- State -----------------------------------------------------------------

  // A tap, a click or a key: start the game, or go on.
  wake(fromAction = false) {
    this.input.active = true;
    if (this.mode === "attract" || this.mode === "over") this.begin();
    else if (this.mode === "paused") this.pause(false);
    else if (fromAction) this.pause(true);
    if (!this.playMode) this.hud.surface.focus?.({ preventScroll: true });
  }

  begin() {
    if (!this.game) return;
    if (this.mode === "over" || this.mode === "attract") this.game.reset();
    this.mode = "play";
    if (this.def.look && this.viewTo > 0.5 && !this.lookHinted) {
      this.lookHinted = true;
      this.lookHintUntil = this.time + 3;
    }
    this.input.clear();
    this.acc = 0;
  }

  restart() {
    if (!this.game) return;
    this.game.reset();
    this.mode = "play";
    this.input.active = true;
    this.input.clear();
  }

  pause(on) {
    if (on && this.mode === "play") this.mode = "paused";
    else if (!on && this.mode === "paused") this.mode = "play";
    this.input.clear();
  }

  // A game's own choice (def.choices), passed to its steps as ctl.choice.
  choose(id) {
    this.choice = id;
    this.hud.setChoice(id);
    this.input.active = true;
  }

  // For the app's own play button: "running" while the game plays (it
  // shows pause), "paused" while it waits, the same states a long tap has.
  effectState() {
    return this.mode === "play" ? "running" : this.mode === "paused" ? "paused" : null;
  }

  togglePause() {
    if (this.mode === "play") this.pause(true);
    else this.wake();
  }

  toggleView() {
    if (!this.def.views) return;
    this.viewTo = this.viewTo > 0.5 ? 0 : 1;
    this.game?.onView?.(this.viewTo);
    this.hud.setView(this.viewTo > 0.5);
    this.sound({ voice: "switch", f: this.viewTo ? 3000 : 2400, vol: 0.6 });
    // Arcade r3: the first slide into 3D says how to look around.
    if (this.def.look && this.viewTo > 0.5 && !this.lookHinted) {
      this.lookHinted = true;
      this.lookHintUntil = this.time + 3;
    }
  }

  // A file of the person's own (def.file: Note Rider's song), read by the
  // recipe's input.read on this device, and the game rebuilt with the
  // options it returns. The file never leaves the device.
  openFile() {
    const input = this.recipe.input;
    if (this.mode === "play") this.pause(true);
    const pick = document.createElement("input");
    pick.type = "file";
    if (input.accept) pick.accept = input.accept;
    pick.addEventListener("change", async () => {
      const file = pick.files?.[0];
      if (!file) return;
      try {
        const progress = (text) => (this.fileMsg = { title: file.name, lines: [text] });
        progress("Opening…");
        const options = await input.read(input.binary ? "" : await file.text(), file.name, file, [file], progress); // prettier-ignore
        this.fileMsg = null;
        if (this.dead) return;
        if (this.playMode) this.exitPlay();
        await this.player.rebuild?.(options);
      } catch (e) {
        if (this.dead) return;
        this.fileMsg = { title: "Couldn't read that file", lines: [String(e?.message || e)] };
        setTimeout(() => (this.fileMsg = null), 4000);
      }
    });
    pick.click();
  }

  // ---- Play mode ---------------------------------------------------------------

  enterPlay() {
    if (this.playMode) return;
    this.playMode = true;
    this.input.active = true;
    const root = this.player.canvas.getRootNode();
    const host = root instanceof ShadowRoot ? root.host : document.documentElement;
    this.fsHost = host;
    if (host === document.documentElement) host.classList.add("arc-play");
    else {
      this.hostStyle = host.getAttribute("style");
      host.style.cssText += ";position:fixed;inset:0;width:100%;height:100%;z-index:2147482000;aspect-ratio:auto;"; // prettier-ignore
    }
    this.usedFs = false;
    const req = host.requestFullscreen || host.webkitRequestFullscreen;
    if (req) {
      try {
        const p = req.call(host, { navigationUI: "hide" });
        this.usedFs = true;
        p?.catch?.(() => (this.usedFs = false));
      } catch {
        this.usedFs = false;
      }
    }
    try {
      history.pushState({ ...(history.state || {}), arcade: true }, "");
      this.pushed = true;
    } catch {
      this.pushed = false;
    }
    this.hud.setPlayMode(true);
    this.wake();
  }

  exitPlay() {
    if (!this.playMode) return;
    this.playMode = false;
    const host = this.fsHost;
    if (host === document.documentElement) host.classList.remove("arc-play");
    else if (host) {
      if (this.hostStyle == null) host.removeAttribute("style");
      else host.setAttribute("style", this.hostStyle);
    }
    if (fullscreenElement()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {}); // prettier-ignore
    if (this.pushed) {
      this.pushed = false;
      try {
        history.back();
      } catch {
        /* nothing to undo */
      }
    }
    this.hud.setPlayMode(false);
    if (this.mode === "play") this.pause(true);
  }

  // ---- Frame -------------------------------------------------------------------

  aspect() {
    const c = this.player.canvas;
    return (c.clientWidth || 4) / (c.clientHeight || 3);
  }

  // The ray under a point of the stage (0..1 across and down), in world
  // units, from this frame's camera.
  ray(x, y) {
    if (!this.cam) return null;
    const p = orbitPose(this.cam);
    const [tx, ty] = viewTangents(this.aspect(), this.cam.fov);
    const sx = (2 * x - 1) * tx;
    const sy = (1 - 2 * y) * ty;
    const d = [0, 1, 2].map((i) => p.forward[i] + p.right[i] * sx + p.up[i] * sy);
    const l = Math.hypot(...d);
    return { origin: p.position, dir: d.map((v) => v / l) };
  }

  // Arcade r3: turns the 3D view a little (a drag of dx, dy stage widths).
  lookBy(dx, dy) {
    const L = this.def.look;
    if (!L || this.viewTo < 0.5) return;
    const l = this.look;
    l.yaw = clampV(l.yaw - dx * 2.6, -(L.yaw ?? 0.6), L.yaw ?? 0.6);
    l.pitch = clampV(l.pitch + dy * 2.2, -(L.pitch ?? 0.3), L.pitch ?? 0.3);
  }

  // The look's gestures and keys, once a frame; back to straight in 2D.
  stepLook(dt) {
    const L = this.def.look;
    const g = this.input.takeLook();
    if (!L) return;
    const l = this.look;
    if (this.viewTo < 0.5) {
      const k = Math.min(1, dt * 4);
      l.yaw -= l.yaw * k;
      l.pitch -= l.pitch * k;
      l.zoom -= l.zoom * k;
      return;
    }
    this.lookBy(g.turn[0], g.turn[1]);
    if (L.keys && this.mode === "play") {
      const k = (this.input.isHeld("turnR") ? 1 : 0) - (this.input.isHeld("turnL") ? 1 : 0);
      if (k) this.lookBy((k * dt) / 2.6, 0);
    }
    const [zn, zf] = L.zoom || [0.75, 1.3];
    l.zoom = clampV(l.zoom + g.zoom, Math.log(zn), Math.log(zf));
  }

  sound(spec) {
    if (this.player.frozen || !spec) return;
    this.player.emit("cue", [spec]);
  }

  frame(dt) {
    if (this.dead) return;
    // Frames are drawn on demand: a game keeps them coming, even while it
    // is still loading.
    this.stage.requestRender(300);
    if (!this.game) return;
    const t0 = performance.now();
    this.input.pollGamepads();
    this.hud.setTouch(this.input.lastDevice === "touch" || (this.input.lastDevice !== "keys" && this.hud.el.dataset.touch === "true")); // prettier-ignore
    const edges = this.input.takeEdges();
    const pressed = new Set();
    for (const a of edges) {
      pressed.add(a);
      if (a === "fire" && this.mode !== "play") this.wake();
    }
    // A tap starts the game; in play it is a fire press (a launch), unless
    // the game reads its taps itself (def.tapFire false: Strata turns the
    // stone under a tap).
    if (this.input.takeTaps()) {
      if (this.mode !== "play") this.wake();
      else if (this.def.tapFire !== false) pressed.add("fire");
    }
    this.stepLook(Math.min(dt, 0.1));
    // The switch: a smooth blend that the game reads.
    const sdt = Math.min(dt, 0.1);
    if (this.viewT !== this.viewTo) {
      const d = sdt / SWITCH_SECONDS;
      this.viewT = this.viewTo > this.viewT ? Math.min(this.viewTo, this.viewT + d) : Math.max(this.viewTo, this.viewT - d); // prettier-ignore
    }
    this.view = smooth(this.viewT);
    const running = this.mode === "play" || this.mode === "attract";
    let steps = 0;
    if (running && dt > 0) {
      this.acc = Math.min(this.acc + dt, STEP * MAX_STEPS);
      const input = this.input.frame();
      while (this.acc >= STEP) {
        this.acc -= STEP;
        this.time += STEP;
        this.game.step(STEP, { input, pressed, view: this.view, viewTo: this.viewTo, demo: this.mode === "attract" || this.autopilot, time: this.time, choice: this.choice }); // prettier-ignore
        pressed.clear();
        steps++;
      }
    }
    // A running game's frame with no step (no time passed yet) keeps its
    // presses for the next one, so a press is never lost. (Paused, they go.)
    if (running && !steps) for (const a of pressed) this.input.edges.push(a);
    if (this.mode === "play") {
      const st = this.game.status();
      if (st.over) {
        this.mode = "over";
        const s = this.game.stats();
        const key = this.def.best || "score";
        if (Number.isFinite(s[key]) && s[key] > this.best) {
          this.best = s[key];
          writeBest(this.bestKey, this.best);
          this.newBest = true;
        } else this.newBest = false;
      }
    }
    this.game.render(this.view, dt);
    this.sprites.write();
    this.frames++;
    // Sorting: every frame while the view moves or the game is 3D; less
    // often in the still 2D view, where splats barely change order.
    const sortEvery = this.view > 0.001 ? 1 : 6;
    this.layer.upload(this.frames % sortEvery === 0 || this.viewT !== this.viewTo);
    this.updateHud();
    const ms = performance.now() - t0;
    this.stats.gameMs = this.stats.gameMs * 0.9 + ms * 0.1;
    this.stats.steps = steps;
    this.stats.splats = this.sprites.used;
    this.stage.requestRender(300);
  }

  updateHud() {
    const s = this.game.stats();
    const list = (this.def.stats || []).map((d) => ({ ...d, value: s[d.key] ?? 0 }));
    const bk = this.def.best || "score";
    if (this.def.best !== false) list.push({ key: "best", label: "Best", value: Math.max(this.best, this.mode === "play" ? s[bk] || 0 : 0) }); // prettier-ignore
    this.hud.setStats(list);
    this.hud.setCaption(this.game.caption?.() || "");
    this.hud.setPaused(this.mode !== "play");
    const tap = this.input.lastDevice === "touch" ? "Tap" : "Click or press Space";
    if (this.fileMsg) this.hud.setMessage(this.fileMsg);
    else if (this.mode === "attract")
      this.hud.setMessage({ title: this.def.title, lines: [...(this.game.attract?.() || [this.def.goal || ""]), `${tap} to play`].filter(Boolean) }); // prettier-ignore
    else if (this.mode === "paused")
      this.hud.setMessage({ title: "Paused", lines: [`${tap} to go on`] });
    else if (this.mode === "over") {
      const st = this.game.status();
      this.hud.setMessage({ title: st.title || (st.won ? "You won!" : "Game over"), lines: [...(st.lines || []), this.newBest ? "A new best on this device!" : "", `${tap} to play again`].filter(Boolean) }); // prettier-ignore
    } else {
      const st = this.game.status();
      const touch = this.input.lastDevice === "touch";
      const hint = this.time < (this.lookHintUntil ?? 0) && this.viewTo > 0.5 ? { title: "Look around", lines: [this.def.controls?.lookHint || (touch ? "Two fingers turn the view; pinch to zoom" : "Drag with the right mouse button to turn the view; scroll to zoom")] } : null; // prettier-ignore
      this.hud.setMessage(st.banner || hint);
    }
  }

  // The camera for this frame (the player's own orbit is set aside while a
  // game shows). Eases toward where the game wants it.
  pose(dt) {
    if (!this.game) return null;
    const w = this.game.camera(this.view, this.aspect());
    const want = {
      yaw: 0,
      pitch: 0,
      roll: 0,
      distance: 3,
      fov: 38,
      ...w,
      target: w.target || [0, 0, 0],
    };
    // Arcade r3: the player's look-around, on top of the game's own camera.
    if (this.def.look) {
      want.yaw += this.look.yaw * this.view;
      want.pitch += this.look.pitch * this.view;
      want.distance *= Math.exp(this.look.zoom * this.view);
    }
    const c = this.cam;
    if (!c || dt <= 0) this.cam = { ...want, target: want.target.slice() };
    else {
      const k = 1 - Math.exp(-Math.min(dt, 0.1) / (want.ease ?? 0.08));
      for (const key of ["yaw", "pitch", "distance", "roll", "fov"])
        c[key] += ((want[key] ?? 0) - (c[key] ?? 0)) * k;
      for (let i = 0; i < 3; i++) c.target[i] += (want.target[i] - c.target[i]) * k;
    }
    // A game may widen the view (inside a dome); put back on leaving.
    const cam = this.stage.cameraEntity.camera;
    if (Math.abs(cam.fov - this.cam.fov) > 1e-3) cam.fov = this.cam.fov;
    const p = orbitPose(this.cam);
    this.layer.eye = p.position; // for the layer's edge fade
    return p;
  }

  destroy() {
    this.dead = true;
    this.exitPlay();
    this.stage.cameraEntity.camera.fov = 38;
    if (this.def.background) this.player.applyLook();
    if (this.toyEntity && this.stage.toy?.entity === this.toyEntity) this.toyEntity.enabled = true;
    this.player.canvas.classList.remove("arc-canvas");
    document.removeEventListener("visibilitychange", this.onVis);
    document.removeEventListener("pointerdown", this.onDocDown, true);
    document.removeEventListener("fullscreenchange", this.onFs);
    document.removeEventListener("webkitfullscreenchange", this.onFs);
    removeEventListener("popstate", this.onPop);
    this.input.destroy();
    this.hud.destroy();
    this.game?.destroy?.();
    this.layer.destroy();
  }
}

// ---- Helpers -------------------------------------------------------------------------

// The same pose OrbitCamera.pose() gives, from yaw, pitch, roll and distance
// about a target.
export function orbitPose({ target, yaw = 0, pitch = 0, roll = 0, distance = 3 }) {
  const q = Q.qmul(Q.qmul(Q.qaxis([0, 1, 0], yaw), Q.qaxis([1, 0, 0], -pitch)), Q.qaxis([0, 0, 1], roll)); // prettier-ignore
  const back = rotate(q, [0, 0, 1]);
  return {
    distance,
    position: [target[0] + back[0] * distance, target[1] + back[1] * distance, target[2] + back[2] * distance], // prettier-ignore
    rotation: q,
    right: rotate(q, [1, 0, 0]),
    up: rotate(q, [0, 1, 0]),
    forward: [-back[0], -back[1], -back[2]],
  };
}

// The stage's view: 38° (or a game's own) across its narrower side.
// Returns the tangents of half the view across and up.
export function viewTangents(aspect, fov = 38) {
  const t = Math.tan((fov * Math.PI) / 360);
  return aspect < 1 ? [t, t / aspect] : [t * aspect, t];
}

// The distance at which a w x h rectangle (world units) fills the view,
// with a margin.
export function fitDistance(w, h, aspect, margin = 1.04, fov = 38) {
  const [tx, ty] = viewTangents(aspect, fov);
  return Math.max(h / 2 / ty, w / 2 / tx) * margin;
}

function clampV(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function smooth(t) {
  return t * t * (3 - 2 * t);
}

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function readBest(key) {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function writeBest(key, v) {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* private window: the best lasts this visit */
  }
}

export function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
