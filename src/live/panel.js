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

import { live, start, stop, canUse, onChange, keepOnly, LABELS, LIVE_NOTE } from "./live.js";

let appRef = null;
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
  for (const entry of entries) {
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
    const sync = () => {
      const on = live.on(entry.kind);
      b.textContent = on ? LABELS[entry.kind].stop : entry.button || LABELS[entry.kind].button;
      b.classList.toggle("primary", !on);
      b.setAttribute("aria-pressed", String(on));
      cap.hidden = !(on && entry.capture);
      const s = on && entry.status ? entry.status() : "";
      status.textContent = s || "";
      status.hidden = !s;
    };
    b.addEventListener("click", async () => {
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
        sync();
      }
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
    wrap.append(row, status);
    rows.push(sync);
    sync();
  }
  if (!rows.length) return wrap;
  const note = document.createElement("p");
  note.className = "note live-note";
  note.textContent = LIVE_NOTE;
  wrap.append(note);
  const off = onChange(() => rows.forEach((f) => f()));
  const timer = setInterval(() => {
    if (!wrap.isConnected) {
      clearInterval(timer);
      off();
      return;
    }
    if (entries.some((e) => e.status && live.on(e.kind))) rows.forEach((f) => f());
  }, 250);
  return wrap;
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
