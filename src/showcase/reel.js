// Lane Showcase: the reel (showcase/index.html). It plays real toys live, one
// after another, on one player: each scene builds its toy on this device,
// runs its best effect and shows a caption saying what is happening and why
// it matters. The scenes and their words are in playlist.json, so they can
// change without code; the numbers the captions quote are measured, either
// by tools/shw-facts.mjs (facts.json) or here, live, on the viewer's device.
//
// ?record=1 hands the clock to tools/shw-video.mjs (window.__reel.frame),
// which steps it by a fixed time per frame. ?autoplay=1 starts without the
// intro card. ?scene=<id> starts at that scene.

import { Player, NoGPUError } from "../player.js";
import { createScene, normalizeLook } from "../state.js";
import { findToy, holdsStill } from "../toys.js";
import { encodeSceneHash } from "../codec.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const RECORD = params.get("record") === "1";
const LEAD = 0.25; // seconds of the built toy at rest before its first step

const [playlist, facts] = await Promise.all(
  ["playlist.json", "facts.json"].map((f) =>
    fetch(new URL(f, import.meta.url)).then((r) => r.json()),
  ),
);

// The scenes in order, each knowing its chapter.
const SCENES = [];
playlist.chapters.forEach((ch, ci) =>
  ch.scenes.forEach((s, si) => SCENES.push({ ...s, chapter: ch, ci, si })),
);

// ---- The words ----------------------------------------------------------------

const fill = (text, scene) =>
  String(text || "").replace(/\{(\w+)\}/g, (m, k) => {
    const v = facts.toys[scene?.toy]?.[k] ?? facts[k] ?? facts.shelf[k];
    return v === undefined ? m : fmt(v);
  });
const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-US") : String(n));
const kb = (bytes) =>
  bytes >= 1e6
    ? `${(bytes / 1048576).toFixed(1)}\u00a0MB`
    : `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("en-US")}\u00a0KB`;

// The line of numbers under a caption: what this device just did (splats,
// time, bytes fetched) and, for a kit toy, the size of its recipe file.
function factLine(scene, live) {
  const f = facts.toys[scene.toy] || {};
  const parts = [];
  if (live) {
    const how = f.kind === "kit" ? "Built here" : "Loaded here";
    parts.push(`${how}: ${fmt(Math.round(live.splats / 1000) * 1000)} splats, ${live.secs.toFixed(1)}\u00a0s`); // prettier-ignore
    if (live.bytes > 0) parts.push(`${kb(live.bytes)} fetched`);
  }
  if (f.kind === "kit") {
    const shared = f.sharedBy > 1 ? ` (${f.sharedBy} toys share it)` : "";
    parts.push(`recipe file ${fmt(Math.round(f.recipeGzipKB))}\u00a0KB compressed${shared}`);
  } else if (f.captureKB) {
    parts.push(`a real capture of ${fmt(Math.round(f.captureKB / 102.4) / 10)}\u00a0MB`);
  }
  return parts.join(" · ").replace(/^./, (c) => c.toUpperCase()) + (parts.length ? "." : "");
}

// ---- The page -------------------------------------------------------------------

const canvas = $("stage");
const ui = {
  chapter: $("shw-chapter"),
  progress: $("shw-progress"),
  kicker: $("shw-kicker"),
  name: $("shw-name"),
  what: $("shw-what"),
  why: $("shw-why"),
  fact: $("shw-fact"),
  play: $("shw-play"),
  open: $("shw-open"),
  loading: $("shw-loading"),
  sound: $("shw-sound"),
  list: $("shw-list"),
  items: $("shw-list-items"),
  intro: $("shw-intro"),
};

document.title = playlist.title;
$("shw-intro-title").textContent = playlist.title;
$("shw-intro-text").textContent = playlist.intro;
const total = SCENES.reduce((s, x) => s + x.secs, 0);
$("shw-intro-small").textContent =
  `${SCENES.length} scenes in ${playlist.chapters.length} chapters, about ${Math.round(total / 60)} minutes, ` +
  `from a shelf of ${fmt(facts.shelf.toys)} toys and tools. Sound is off until you turn it on.`;

// Progress: one bar per scene, a gap between chapters.
const bars = SCENES.map((s) => {
  const li = document.createElement("li");
  if (s.si === 0 && s.ci > 0) li.className = "chapter-start";
  li.title = `${s.chapter.title}: ${findToy(s.toy)?.label || s.toy}`;
  li.append(document.createElement("span"));
  ui.progress.append(li);
  return li;
});

// The chapter list.
playlist.chapters.forEach((ch, ci) => {
  const li = document.createElement("li");
  const head = document.createElement("button");
  head.type = "button";
  head.className = "shw-chapter-title";
  head.textContent = ch.title;
  head.addEventListener("click", () => pick(SCENES.findIndex((s) => s.ci === ci)));
  const ul = document.createElement("ul");
  SCENES.forEach((s, i) => {
    if (s.ci !== ci) return;
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.index = i;
    b.textContent = findToy(s.toy)?.label || s.toy;
    b.addEventListener("click", () => pick(i));
    const item = document.createElement("li");
    item.append(b);
    ul.append(item);
  });
  li.append(head, ul);
  ui.items.append(li);
});
function pick(i) {
  ui.list.close();
  go(i);
  setPlaying(true);
}

// ---- The player -----------------------------------------------------------------

const player = new Player(canvas, { idleDelay: 1e9 });
let state = { index: -1, t: 0, loaded: false, ended: false, token: 0, done: 0, anims: [] };
let playing = false;
let sound = null;

try {
  await player.init();
} catch (err) {
  console.info("Splashery showcase could not start:", err?.message || err);
  if (!(err instanceof NoGPUError)) console.info(err);
  $("shw-fallback").hidden = false;
  document.body.dataset.ready = "true";
  throw err;
}
player.themeOverride = "dark";
player.camera.idleDelay = 0.6;
player.camera.turntableSpeed = 0.12;
player.idle.weight = 0;

// Bytes fetched so far, from the resource timings (the buffer is raised so a
// long visit keeps every entry).
performance.setResourceTimingBufferSize?.(100000);
function bytesSoFar() {
  return performance.getEntriesByType("resource").reduce((s, e) => s + (e.transferSize || 0), 0);
}

// Builds a scene's toy on the player.
async function loadScene(s) {
  const def = findToy(s.toy);
  const toy = { kind: "builtin", id: s.toy };
  if (s.options) toy.options = { ...s.options };
  const scene = createScene({ toy, seed: 1 });
  scene.camera = { ...scene.camera, ...(def.camera || {}), ...(s.camera || {}) };
  scene.autoplay = { turntable: s.turntable ?? !holdsStill(def), effect: "none" };
  scene.look = normalizeLook({ ...scene.look, theme: "dark" });
  if (s.controls) scene.motion = { ...scene.motion, controls: { ...s.controls } };
  player.scene = scene;
  player.applyLook();
  await player.loadToy(scene.toy);
  player.applySettings(scene);
  player.camera.setTiltLock(!!player.toyInfo?.recipe?.tiltLock);
  fitWidth();
  if (s.zoom) {
    const cam = player.camera;
    cam.home.distance = cam.tgt.distance = cam.cur.distance = Math.min(cam.maxDistance, cam.home.distance * s.zoom); // prettier-ignore
  }
  return scene;
}

// A scene's caption; `live` is what this device measured (null while it builds).
function showCaption(s, live) {
  ui.chapter.textContent = `${s.ci + 1}. ${s.chapter.title}`;
  ui.kicker.textContent = `Chapter ${s.ci + 1} of ${playlist.chapters.length} · ${s.chapter.title}`;
  ui.name.textContent = findToy(s.toy)?.label || s.toy;
  ui.what.textContent = fill(s.what, s);
  ui.why.textContent = fill(s.why, s);
  ui.fact.textContent = live ? factLine(s, live) : "Building it on this device…";
}

// On a tall screen the camera's 38 degree field of view is its height, so a
// round toy framed for a wide screen spills off the sides: step back until
// it fits across.
function fitWidth() {
  const cam = player.camera;
  const r = cam.radius;
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  if (!r || aspect >= 1) return;
  const half = Math.atan(Math.tan((19 * Math.PI) / 180) * aspect);
  const need = (r * 1.08) / Math.sin(half);
  const d = Math.min(cam.maxDistance, Math.max(cam.home.distance, need));
  cam.home.distance = cam.tgt.distance = cam.cur.distance = d;
}

async function go(i) {
  if (i < 0 || i >= SCENES.length) return;
  const s = SCENES[i];
  const token = ++state.token;
  sound?.stopHeld("toy");
  state = { ...state, index: i, t: 0, loaded: false, ended: false, done: 0, anims: [] };
  showCaption(s, null);
  ui.open.href = `../?labs=1`;
  bars.forEach((b, k) => {
    b.classList.toggle("done", k < i);
    b.firstChild.style.width = k < i ? "100%" : "0";
  });
  for (const b of ui.items.querySelectorAll("button[data-index]"))
    b.setAttribute("aria-current", String(Number(b.dataset.index) === i));
  canvas.classList.add("hidden");
  const slow = setTimeout(() => (ui.loading.hidden = false), 400);
  const t0 = performance.now();
  const b0 = bytesSoFar();
  let scene;
  try {
    scene = await loadScene(s);
  } catch (err) {
    console.warn(`Showcase: ${s.toy} did not load:`, err);
    if (token === state.token) next();
    return;
  } finally {
    clearTimeout(slow);
  }
  if (token !== state.token) return;
  // Resource entries arrive a moment after their responses; wait one frame.
  await new Promise((r) => requestAnimationFrame(r));
  const live = {
    splats: player.toyInfo?.splats || 0,
    secs: (performance.now() - t0) / 1000,
    bytes: bytesSoFar() - b0,
  };
  ui.loading.hidden = true;
  showCaption(s, live);
  canvas.classList.remove("hidden");
  state.loaded = true;
  state.live = live;
  encodeSceneHash(scene).then((h) => {
    if (token === state.token) ui.open.href = `../?labs=1#s=${h}`;
  });
  // Fetch the next scene's recipe file while this one plays.
  const after = findToy(SCENES[i + 1]?.toy);
  if (after?.kind === "kit") import(`../packs/${after.pack}.js`).catch(() => {});
  window.dispatchEvent(new CustomEvent("shw:scene", { detail: { index: i, id: s.id, live } }));
}

function next() {
  if (state.index + 1 < SCENES.length) go(state.index + 1);
  else finish();
}

function finish() {
  state.ended = true;
  setPlaying(false);
  ui.kicker.textContent = "The end";
  ui.name.textContent = "That was all live";
  ui.what.textContent = playlist.outro;
  ui.why.textContent = `${fmt(facts.shelf.toys)} toys and tools are on the shelf, ${fmt(facts.shelf.kit)} of them built from recipes.`; // prettier-ignore
  ui.fact.textContent = "";
  bars.forEach((b) => b.classList.add("done"));
  window.dispatchEvent(new CustomEvent("shw:end"));
}

// One step of a scene: a tap, a named control, or a slow camera move.
function runStep(step) {
  const cam = player.camera;
  if (step.do === "tap") player.act(null);
  else if (step.do === "fire") {
    const r = player.motion.act(player.time, null, { key: step.key });
    player.stage.requestRender();
    player.emit("action", r);
  } else if (step.do === "zoom" || step.do === "turn") {
    const over = step.over ?? 2;
    const from = step.do === "zoom" ? cam.tgt.distance : cam.tgt.yaw;
    state.anims.push({ kind: step.do, from, by: step.by, over, t: 0 });
  } else if (step.do === "slide") {
    // A slider control moves from where it is to `to` over `over` seconds.
    const from = player.scene.motion.controls?.[step.key] ?? step.from ?? 0;
    state.anims.push({ kind: "slide", key: step.key, from, to: step.to, over: step.over ?? 3, t: 0 }); // prettier-ignore
  }
}

function tick(dt) {
  if (!playing || !state.loaded || state.ended) return;
  const s = SCENES[state.index];
  state.t += dt;
  const steps = s.steps ?? [{ at: 0.6, do: "tap" }];
  while (state.done < steps.length && state.t >= steps[state.done].at + LEAD)
    runStep(steps[state.done++]);
  const cam = player.camera;
  for (const a of state.anims) {
    a.t = Math.min(a.over, a.t + dt);
    const k = a.t / a.over;
    const e = k * k * (3 - 2 * k);
    if (a.kind === "slide") {
      player.setControl(a.key, a.from + (a.to - a.from) * e);
      continue;
    }
    if (a.kind === "zoom") cam.tgt.distance = a.from * Math.pow(a.by, e);
    else cam.tgt.yaw = a.from + a.by * e;
    cam.interact();
  }
  state.anims = state.anims.filter((a) => a.t < a.over);
  bars[state.index].firstChild.style.width = `${Math.min(100, (100 * state.t) / s.secs)}%`;
  if (state.t >= s.secs) next();
}

// ---- Sound (off until the viewer turns it on) -------------------------------------

async function setSound(on) {
  if (on && !sound) {
    const [{ Sound, soundEvents }, { toySound }, { specFor }] = await Promise.all([
      import("../sound.js"),
      import("../toy-sounds.js"),
      import("../voices.js"),
    ]);
    sound = new Sound();
    player.on("action", (r) => {
      if (!sound.enabled || r.echo || r.paused || r.resumed) return;
      const recipe = player.toyInfo?.recipe;
      if (recipe?.action?.quiet?.includes(r.key)) return;
      const id = player.scene.toy?.id;
      const spec = toySound(id) || recipe?.action?.sound || (r.key === "hop" ? "hop" : "pop");
      const chosen = specFor(spec, r.key === "hop" || r.value > 0.5);
      const tune = r.pick === null && soundEvents(chosen).some((e) => e.t > 2);
      if (r.toggle && !(r.value > 0.5)) sound.stopHeld("toy");
      const held = (r.long || (r.toggle && tune)) && r.pick === null;
      sound.play(chosen, { key: "toy", pick: r.pick ?? null, held });
    });
    player.on("cue", (cues) => {
      if (sound.enabled) for (const spec of cues) sound.play(spec, { key: "cue" });
    });
  }
  if (sound) sound.setEnabled(on);
  ui.sound.setAttribute("aria-pressed", String(on));
  ui.sound.setAttribute("aria-label", on ? "Sound on" : "Sound off");
  ui.sound.textContent = on ? "🔊" : "🔇";
}

// ---- Controls ---------------------------------------------------------------------

function setPlaying(on) {
  playing = on;
  player.setPaused(!on);
  sound?.[on ? "resumeToy" : "pauseToy"]?.();
  ui.play.textContent = on ? "⏸" : "▶";
  ui.play.setAttribute("aria-label", on ? "Pause" : "Play");
}

ui.play.addEventListener("click", () => {
  if (state.ended) {
    go(0);
    setPlaying(true);
  } else setPlaying(!playing);
});
$("shw-prev").addEventListener("click", () => {
  go(Math.max(0, state.index - 1));
  setPlaying(true);
});
$("shw-next").addEventListener("click", () => {
  next();
  setPlaying(true);
});
$("shw-chapters").addEventListener("click", () => ui.list.showModal());
ui.sound.addEventListener("click", () => setSound(ui.sound.getAttribute("aria-pressed") !== "true")); // prettier-ignore
addEventListener("keydown", (e) => {
  if (ui.list.open || e.target.closest?.("input, textarea")) return;
  if (e.key === " " || e.key === "k") {
    e.preventDefault();
    ui.play.click();
  } else if (e.key === "ArrowRight") $("shw-next").click();
  else if (e.key === "ArrowLeft") $("shw-prev").click();
});
$("shw-start").addEventListener("click", () => {
  ui.intro.hidden = true;
  setPlaying(true);
});

// ---- Start -------------------------------------------------------------------------

const first = Math.max(
  0,
  SCENES.findIndex((s) => s.id === params.get("scene")),
);
if (params.get("autoplay") === "1" || RECORD) ui.intro.hidden = true;

if (RECORD) {
  // tools/shw-video.mjs steps the clock: each frame(dt) advances the toy and
  // the reel by dt and resolves once that frame is drawn.
  const stage = player.stage;
  const handlers = stage.updateHandlers.slice();
  let pending = 0;
  stage.updateHandlers.length = 0;
  stage.updateHandlers.push(() => {
    const d = pending;
    pending = 0;
    for (const h of handlers) h(d);
  });
  playing = true;
  window.__reel = {
    scenes: SCENES.map((s) => s.id),
    state: () => ({ index: state.index, t: state.t, loaded: state.loaded, ended: state.ended }),
    async frame(dt) {
      pending = dt;
      tick(dt);
      await stage.captureFrame();
      pending = 0;
      await stage.captureFrame();
    },
    go: (i) => go(i),
  };
} else {
  let last = performance.now();
  const loop = (now) => {
    tick(Math.min(0.1, (now - last) / 1000));
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  if (params.get("autoplay") === "1") playing = true;
  setPlaying(playing);
}
// For tests: the caption a scene shows, with its words and a given measurement.
const caption = (i, live) => showCaption(SCENES[i], live);
window.__showcase = { player, playlist, facts, SCENES, go, caption, get state() { return state; } }; // prettier-ignore
await go(first);
document.body.dataset.ready = "true";
