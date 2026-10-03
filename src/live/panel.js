// Live input (lane Live input): the buttons in a toy's input panel that turn
// on the microphone, the camera or screen capture, and the labs-only "Clap
// to tap" setting. The input panel (src/ui.js renderInputPanel) calls
// renderLive() for a recipe with `input.live`; src/ui.js calls initLive()
// once. Nothing here asks the browser for anything until a button is
// tapped (src/live/live.js start()).
//
// A recipe's entries (docs/PACKS.md, "Live input"):
//
//   input: {
//     live: [
//       { kind: "mic" },                       // "Use my microphone"
//       { kind: "camera", capture: { button: "Take the picture" } },
//       { kind: "screen", media: true },       // "Share a screen" (hidden on phones)
//     ],
//   }
//
// - kind: "mic", "camera" or "screen". `button` changes the label.
// - After a source starts or stops, the toy is rebuilt (its build reads
//   live.on(kind) to switch to its live view); `rebuild: false` leaves it.
// - `media: true` plays the stream on the toy's picture sheets instead
//   (app.openLiveMedia), and Stop puts back what showed before.
// - `capture: { button, name }` adds a button while the camera is on that
//   takes the frame as a JPEG and hands it to input.read like an opened file.
// - `status()` returns a line shown under the buttons, refreshed while the
//   source is on (the room echo meter's reading).
// - `note` replaces the line about privacy under the buttons (r3: the Song
//   landscape keeps its recording in memory, and says so).
// - `big: true` makes the button large (r3: the splat mirror's "Start
//   camera").
// - `stage: true` also shows the button large over the picture while the
//   source is off (r3: the splat mirror).
// - `flip: true` adds a button to switch between the front and back cameras
//   while the camera is on, on a device that has both (r3).
// - `record: true` adds a small recorder of the stage while the source is on:
//   Record, Stop and Save the video (r3: the splat mirror; src/live/record.js).
// - An entry with `render()` instead of a kind is the toy's own block of
//   controls, put in that place (r3: the Song landscape's transport).

import { live, start, stop, canUse, onChange, keepOnly, switchCamera, cameraCount, LABELS, LIVE_NOTE } from "./live.js"; // prettier-ignore
import { StageRecorder, canRecord, MAX_SECONDS } from "./record.js";

let appRef = null;
// r3: the stage recorder's take, kept while the toy's panel is redrawn.
const REC = { take: null, toy: null };
const started = new Set(); // "toy:kind" pairs started from a toy's button

const currentToy = () => appRef?.player?.scene?.toy?.id ?? null;
const currentEntry = (kind) =>
  (appRef?.player?.toyInfo?.recipe?.input?.live || []).find((e) => e.kind === kind) || null;

// Once, from src/ui.js.
export function initLive(app) {
  if (appRef) return;
  appRef = app;
  live.setOptions = (partial) => app.setToyOptions(partial);
  live.tap = () => app.act();
  live.wake = () => app.player?.stage?.requestRender?.(); // r3: draw a frame now
  // A toy that is closed lets go of what it started.
  app.player.on("toy", () => {
    const id = currentToy();
    for (const key of [...started]) if (!key.startsWith(`${id}:`)) started.delete(key);
    keepOnly([id, clap.on ? "clap" : null].filter(Boolean));
  });
  // A source that stops (the indicator's Stop, the browser's own "Stop
  // sharing") takes its toy out of its live view.
  onChange((kind, on) => {
    if (kind === "mic") clap.hook();
    if (on) return;
    const key = `${currentToy()}:${kind}`;
    if (!started.has(key)) return;
    started.delete(key);
    const entry = currentEntry(kind);
    if (!entry) return;
    if (entry.media) app.closeLiveMedia().catch(() => {});
    else if (entry.rebuild !== false) app.setToyOptions({});
  });
  renderClapSetting(app);
}

// The live part of a toy's input panel.
export function renderLive(entries, { error }) {
  const wrap = document.createElement("div");
  wrap.className = "input-live";
  const rows = [];
  const timers = [];
  const cleanups = [];
  for (const entry of entries) {
    if (entry.render) {
      wrap.append(entry.render());
      continue;
    }
    if (!LABELS[entry.kind]) continue;
    if (!canUse(entry.kind)) continue; // no screen capture on phones
    const row = document.createElement("div");
    row.className = "button-row live-row";
    const b = document.createElement("button");
    b.type = "button";
    b.id = `live-${entry.kind}`;
    b.dataset.kind = entry.kind;
    const cap = document.createElement("button");
    cap.type = "button";
    cap.id = `live-${entry.kind}-capture`;
    cap.textContent = entry.capture?.button || "Take the picture";
    cap.hidden = true;
    const status = document.createElement("p");
    status.className = "note live-status";
    status.hidden = true;
    // r3: the camera switch, the recorder and the big button over the picture.
    const extra = document.createElement("div");
    extra.className = "button-row live-row";
    const flip = button(`live-${entry.kind}-flip`, "Use the back camera");
    const rec = button(`live-${entry.kind}-record`, "Record a video");
    const save = button(`live-${entry.kind}-save`, "Save the video");
    extra.append(flip, rec, save);
    let cameras = 0;
    const onStage = entry.stage ? stageButton(entry) : null;
    const sync = () => {
      const on = live.on(entry.kind);
      b.textContent = on ? LABELS[entry.kind].stop : entry.button || LABELS[entry.kind].button;
      b.classList.toggle("primary", !on);
      b.classList.toggle("live-big", !!entry.big && !on);
      b.setAttribute("aria-pressed", String(on));
      cap.hidden = !(on && entry.capture);
      const recording = !!REC.take?.recording;
      const said = recording ? `Recording the picture: ${Math.floor(REC.take.seconds)} s of ${MAX_SECONDS}. It stays on this device.` : REC.take?.blob ? "Your video is in this page's memory; it's saved only if you tap Save the video." : ""; // prettier-ignore
      const s = [on && entry.status ? entry.status() : "", said].filter(Boolean).join(" ");
      status.textContent = s || "";
      status.hidden = !s;
      flip.hidden = !(on && entry.flip && cameras > 1) || recording;
      flip.textContent = live.camera?.facing === "environment" ? "Use the front camera" : "Use the back camera"; // prettier-ignore
      rec.hidden = !(entry.record && (on || recording) && canRecord(appRef?.player?.canvas));
      rec.textContent = recording ? "Stop recording" : "Record a video";
      rec.classList.toggle("primary", recording);
      save.hidden = !(entry.record && REC.take?.blob && !recording);
      extra.hidden = flip.hidden && rec.hidden && save.hidden;
      if (onStage) onStage.show(!on && currentToy() === toyOf);
    };
    const toyOf = currentToy();
    const go = async () => {
      error.hidden = true;
      if (live.on(entry.kind)) {
        stop(entry.kind);
        return;
      }
      const toy = currentToy();
      b.disabled = true;
      try {
        const stream = await start(entry.kind, { owner: toy, ...(entry.options || {}) });
        started.add(`${toy}:${entry.kind}`);
        if (entry.media)
          await appRef.openLiveMedia(stream, entry.name || `Your ${LABELS[entry.kind].name}`); // prettier-ignore
        else if (entry.rebuild !== false) await appRef.setToyOptions({});
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      } finally {
        b.disabled = false;
        if (entry.flip && live.on(entry.kind)) cameras = await cameraCount();
        sync();
      }
    };
    b.addEventListener("click", go);
    onStage?.el.addEventListener("click", go);
    flip.addEventListener("click", async () => {
      error.hidden = true;
      flip.disabled = true;
      try {
        await switchCamera();
        await appRef.setToyOptions({});
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      } finally {
        flip.disabled = false;
        sync();
      }
    });
    rec.addEventListener("click", () => {
      if (REC.take?.recording) REC.take.stop();
      else {
        REC.take = new StageRecorder(appRef.player.canvas, { onStop: () => sync() });
        REC.toy = currentToy();
      }
      sync();
    });
    save.addEventListener("click", () => {
      if (!REC.take?.blob) return;
      const d = new Date();
      const p = (n) => String(n).padStart(2, "0");
      saveBlob(REC.take.blob, `splashery-${currentToy() || "video"}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${REC.take.ext}`); // prettier-ignore
    });
    timers.push(() => {
      if (REC.take?.recording && !live.on(entry.kind)) REC.take.stop();
      if (REC.take?.recording || onStage) sync();
    });
    cleanups.push(() => {
      // Another toy: the take stops and goes.
      if (currentToy() !== REC.toy && REC.take) {
        REC.take.stop();
        REC.take = null;
      }
      onStage?.remove();
    });
    cap.addEventListener("click", async () => {
      const input = appRef?.player?.toyInfo?.recipe?.input;
      const file = await captureFrame(entry.kind, entry.capture?.name || "Camera picture.jpg");
      if (!file || !input?.read) return;
      error.hidden = true;
      cap.disabled = true;
      try {
        stop(entry.kind);
        const options = await input.read("", file.name, file, [file]);
        await appRef.setToyOptions(options || {});
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      } finally {
        cap.disabled = false;
      }
    });
    row.append(b, cap);
    wrap.append(row, extra, status);
    rows.push(sync);
    sync();
  }
  if (!rows.length) return wrap;
  const note = document.createElement("p");
  note.className = "note live-note";
  note.textContent = entries.find((e) => e.note)?.note || LIVE_NOTE;
  wrap.append(note);
  const off = onChange(() => rows.forEach((f) => f()));
  const timer = setInterval(() => {
    if (!wrap.isConnected) {
      clearInterval(timer);
      off();
      cleanups.forEach((f) => f());
      return;
    }
    timers.forEach((f) => f());
    if (entries.some((e) => e.status && live.on(e.kind))) rows.forEach((f) => f());
  }, 250);
  return wrap;
}

function button(id, label) {
  const b = document.createElement("button");
  b.type = "button";
  b.id = id;
  b.textContent = label;
  b.hidden = true;
  return b;
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// r3: a big button over the middle of the picture (the stage canvas), for a
// toy whose live source is the main thing (the splat mirror's "Start
// camera"). It shows only while the source is off and the toy is open.
function stageButton(entry) {
  const el = document.createElement("button");
  el.type = "button";
  el.id = `live-${entry.kind}-stage`;
  el.className = "primary live-stage-button";
  el.textContent = entry.button || LABELS[entry.kind].button;
  el.style.cssText =
    "position:fixed;z-index:5;transform:translate(-50%,-50%);padding:14px 26px;font-size:18px;font-weight:600;border-radius:999px;box-shadow:var(--shadow);"; // prettier-ignore
  el.hidden = true;
  document.body.append(el);
  return {
    el,
    show(on) {
      const stage = document.getElementById("stage");
      const r = stage?.getBoundingClientRect();
      el.hidden = !on || !r;
      if (el.hidden) return;
      el.style.left = `${r.left + r.width / 2}px`;
      el.style.top = `${r.top + r.height * 0.64}px`;
    },
    remove: () => el.remove(),
  };
}

// The camera's (or screen's) frame now, as a JPEG file.
async function captureFrame(kind, name) {
  const v = live[kind]?.video;
  if (!v?.videoWidth) return null;
  const c = document.createElement("canvas");
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  const g = c.getContext("2d");
  // The camera shows as a mirror; the picture is taken the right way round.
  g.drawImage(v, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
  return blob ? new File([blob], name, { type: "image/jpeg" }) : null;
}

// ---- Clap to tap (labs) --------------------------------------------------------------
// A setting in the Play tab: while it is on, the microphone listens for a
// sharp sound (a clap, a snap, a knock on the table) and taps whatever toy
// is open. It starts off on every visit.

const clap = {
  on: false,
  off: null,
  hook() {
    this.off?.();
    this.off = null;
    if (this.on && live.mic) this.off = live.mic.on("clap", () => live.tap?.());
    if (this.on && !live.on("mic")) {
      // The microphone was stopped (the indicator's Stop): the setting goes off too.
      this.on = false;
      const sw = document.getElementById("clap-to-tap");
      if (sw) sw.checked = false;
    }
  },
};

async function labsOn() {
  try {
    return (await import("../toys.js")).labsOn();
  } catch {
    return false;
  }
}

async function renderClapSetting() {
  if (!(await labsOn())) return;
  const pane = document.getElementById("pane-play");
  const after = document.getElementById("toy-group");
  if (!pane || !after || document.getElementById("live-group")) return;
  const sec = document.createElement("section");
  sec.className = "group";
  sec.id = "live-group";
  const h = document.createElement("h2");
  h.textContent = "Live";
  const row = document.createElement("label");
  row.className = "check-row";
  const sw = document.createElement("input");
  sw.type = "checkbox";
  sw.id = "clap-to-tap";
  sw.className = "switch labelled";
  sw.setAttribute("role", "switch");
  const text = document.createElement("span");
  text.textContent = "Clap to tap (labs)";
  row.append(sw, text);
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = `A clap, a snap or a knock taps the toy. It uses the microphone. ${LIVE_NOTE}`;
  const error = document.createElement("div");
  error.className = "warning";
  error.setAttribute("role", "alert");
  error.hidden = true;
  sw.addEventListener("change", async () => {
    error.hidden = true;
    if (sw.checked) {
      try {
        clap.on = true;
        await start("mic", { owner: "clap" });
        clap.hook();
      } catch (err) {
        clap.on = false;
        sw.checked = false;
        error.textContent = err.message;
        error.hidden = false;
      }
    } else {
      clap.on = false;
      clap.hook();
      keepOnly([currentToy()].filter(Boolean));
    }
  });
  sec.append(h, row, note, error);
  after.after(sec);
}

export const clapState = () => ({ on: clap.on, hooked: !!clap.off });

// For tools that swap in their own analyser (tools/live-clip.mjs): listen
// to the new one.
export function rehookClap() {
  clap.hook();
}
