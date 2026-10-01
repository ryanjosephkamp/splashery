// Live input (lane Live input): the microphone, the camera and screen
// capture, turned on only when someone taps a button for them.
//
// The owner's rule (September 30, 2026): a toy asks for the microphone, the
// camera or screen capture only when the person taps to start it. Nothing
// is requested or loaded before that, and nothing is recorded, stored or
// sent anywhere. So:
//
// - start(kind) is the only place that calls getUserMedia or
//   getDisplayMedia, and only the input panel's buttons (src/live/panel.js)
//   call it, from the tap itself.
// - While any source is on, a small "Live" pill shows at the top of the
//   page with a Stop button; stop() ends every track.
// - A refused permission or missing hardware throws a LiveError whose
//   message says so in plain words; nothing else changes.
// - The microphone's sound goes to an analyser only (never the speakers);
//   frames and samples stay in memory while they are used and are dropped.
//
// This module is safe to import anywhere (the Node tools too): it touches
// the page only when a source starts. Toys read the state below from their
// drive: live.on(kind), live.mic (the analyser, src/live/mic.js, once the
// microphone is on) and live.camera (a video element and its frames).

export const LIVE_NOTE = "Stays on this device. Nothing is recorded or sent.";

export const KINDS = ["mic", "camera", "screen"];

export const LABELS = {
  mic: { button: "Use my microphone", name: "microphone", stop: "Stop the microphone" },
  camera: { button: "Use my camera", name: "camera", stop: "Stop the camera" },
  screen: { button: "Share a screen", name: "screen", stop: "Stop sharing" },
};

export class LiveError extends Error {}

const media = () => (typeof navigator !== "undefined" ? navigator.mediaDevices : null);

// Whether this browser can offer a source at all. Screen capture needs
// getDisplayMedia, which phones don't have, so its button hides there.
export function canUse(kind) {
  const md = media();
  if (!md) return false;
  if (kind === "screen") return typeof md.getDisplayMedia === "function";
  return typeof md.getUserMedia === "function";
}

// What each source asks for. The camera prefers the one facing the person
// (a mirror) at a modest size; the microphone turns off the browser's echo
// cancelling, noise suppression and gain control, so a clap's decay and a
// sung note arrive as they are.
function constraints(kind, opts) {
  if (kind === "mic")
    return {
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    };
  if (kind === "camera")
    return {
      audio: false,
      video: {
        facingMode: opts.facing || "user",
        width: { ideal: opts.width || 640 },
        height: { ideal: opts.height || 480 },
        frameRate: { ideal: 30, max: 30 },
      },
    };
  return { video: { frameRate: { ideal: 30, max: 30 } }, audio: false };
}

// A browser's refusal, in plain words.
export function explain(kind, err) {
  const what = LABELS[kind]?.name || "device";
  const name = err?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    if (kind === "screen") return "Screen sharing was canceled, so nothing is shared.";
    return `The ${what} wasn't allowed, so it stays off. To use it, allow the ${what} for this site in the browser's settings (often the icon beside the address), then tap again.`;
  }
  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    name === "OverconstrainedError"
  )
    return `No ${what} was found on this device.`;
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError")
    return `The ${what} couldn't be started. Another app may be using it; close that app and tap again.`;
  if (name === "TypeError" || name === "NotSupportedError")
    return `This browser can't use the ${what} here.`;
  return `The ${what} couldn't be started (${err?.message || err || "unknown error"}).`;
}

// ---- State ---------------------------------------------------------------------------

const sources = new Map(); // kind -> { stream, owner, started }
const listeners = new Set();
let micModule = null; // src/live/mic.js, loaded when the microphone starts

export const live = {
  // The microphone's analyser (src/live/mic.js), or null while it is off.
  mic: null,
  // The camera: { video, stream } while it is on, else null.
  camera: null,
  // The shared screen: { video, stream } while it is on, else null.
  screen: null,
  // Set by the page (src/live/panel.js) so a toy can change its own
  // options from its drive (the Chladni plate's mode follows your note).
  setOptions: null,
  // Set by the page so a live sound can tap the toy (clap to tap).
  tap: null,
  on: (kind) => sources.has(kind),
  owners: (kind) => [...(sources.get(kind)?.owners || [])],
  stream: (kind) => sources.get(kind)?.stream ?? null,
};

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function changed(kind) {
  showIndicator();
  for (const fn of [...listeners]) {
    try {
      fn(kind, sources.has(kind));
    } catch (err) {
      console.error(err);
    }
  }
}

// Turns a source on (from a tap). Resolves with its stream; a second start
// of a source that is on gives the same stream (and the new owner). The
// owner is who asked (a toy's id, or "clap"): a source is stopped when its
// owner goes away (stopOwnedBy).
export async function start(kind, { owner = null, ...opts } = {}) {
  if (!KINDS.includes(kind)) throw new LiveError(`Unknown live source "${kind}".`);
  const had = sources.get(kind);
  if (had) {
    if (owner) had.owners.add(owner);
    return had.stream;
  }
  const md = media();
  if (!canUse(kind)) {
    throw new LiveError(
      kind === "screen"
        ? "This browser can't share a screen. Screen sharing works in a browser on a computer."
        : `This browser can't use the ${LABELS[kind].name} here.`,
    );
  }
  let stream;
  try {
    stream =
      kind === "screen"
        ? await md.getDisplayMedia(constraints(kind, opts))
        : await md.getUserMedia(constraints(kind, opts));
  } catch (err) {
    throw new LiveError(explain(kind, err));
  }
  const entry = { stream, owners: new Set(owner ? [owner] : []), started: Date.now() };
  sources.set(kind, entry);
  // A track that ends by itself (the browser's own "Stop sharing", a
  // camera unplugged) stops the source.
  for (const t of stream.getTracks()) t.addEventListener("ended", () => stop(kind), { once: true });
  try {
    if (kind === "mic") {
      micModule ||= await import("./mic.js");
      live.mic = await micModule.startAnalyser(stream);
    } else {
      live[kind] = { stream, video: await videoFor(stream, kind === "camera") };
    }
  } catch (err) {
    stop(kind);
    throw new LiveError(explain(kind, err));
  }
  changed(kind);
  return stream;
}

// A playing, silent, off-page video element for a camera or a screen.
function videoFor(stream, mirror) {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.autoplay = true;
  v.srcObject = stream;
  v.dataset.mirror = mirror ? "1" : "";
  return new Promise((resolve, reject) => {
    const ok = () => resolve(v);
    if (v.readyState >= 2) ok();
    else v.addEventListener("loadeddata", ok, { once: true });
    v.play().catch(reject);
  });
}

// Stops one source (or all, with no kind): every track ends, the analyser
// or the video is dropped.
export function stop(kind = null) {
  if (!kind) {
    for (const k of [...sources.keys()]) stop(k);
    return;
  }
  const entry = sources.get(kind);
  if (!entry) return;
  sources.delete(kind);
  for (const t of entry.stream.getTracks()) t.stop();
  if (kind === "mic") {
    live.mic?.close();
    live.mic = null;
  } else if (live[kind]) {
    const v = live[kind].video;
    if (v) {
      v.pause();
      v.srcObject = null;
    }
    live[kind] = null;
  }
  changed(kind);
}

// Lets go of an owner (a toy that was closed): each source it alone was
// using stops.
export function release(owner) {
  for (const [kind, entry] of [...sources]) {
    if (!entry.owners.has(owner)) continue;
    entry.owners.delete(owner);
    if (!entry.owners.size) stop(kind);
  }
}

// Every source whose owners are all gone from `keep` (a list of owners
// still around) stops.
export function keepOnly(keep) {
  for (const [kind, entry] of [...sources]) {
    for (const o of [...entry.owners]) if (!keep.includes(o)) entry.owners.delete(o);
    if (!entry.owners.size) stop(kind);
  }
}

// For the tests: which sources are on, and their tracks' states.
export function liveState() {
  const out = {};
  for (const [kind, entry] of sources)
    out[kind] = { owners: [...entry.owners], tracks: entry.stream.getTracks().map((t) => t.readyState) }; // prettier-ignore
  return out;
}

// ---- The indicator ---------------------------------------------------------------------
// A small pill at the top of the page while anything is live: a red dot,
// what is on, and Stop (which ends every track).

let pill = null;

function showIndicator() {
  if (typeof document === "undefined") return;
  if (!pill) {
    pill = document.createElement("div");
    pill.id = "live-indicator";
    pill.className = "live-indicator";
    pill.setAttribute("role", "status");
    pill.hidden = true;
    const dot = document.createElement("span");
    dot.className = "live-dot";
    dot.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.className = "live-text";
    const stopButton = document.createElement("button");
    stopButton.type = "button";
    stopButton.id = "live-stop";
    stopButton.textContent = "Stop";
    stopButton.addEventListener("click", () => stop());
    pill.append(dot, text, stopButton);
    document.body.appendChild(pill);
  }
  const on = KINDS.filter((k) => sources.has(k)).map((k) => LABELS[k].name);
  pill.hidden = !on.length;
  pill.querySelector(".live-text").textContent = on.length
    ? `Live: ${on.length > 1 ? `${on.slice(0, -1).join(", ")} and ${on[on.length - 1]}` : on[0]}`
    : "";
  pill.querySelector("#live-stop").setAttribute("aria-label", `Stop the ${on.join(" and ")}`);
}
