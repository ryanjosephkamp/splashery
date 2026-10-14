// Lane AsciiCapture: one capture job, run by the lab page. It makes one
// same-origin iframe (ascii-capture-host.html) for the job, converts each
// frame the iframe sends as it arrives (dropping its pixels), encodes the GIF
// here, and removes the iframe after success, Cancel, a deadline, a failure,
// the page being hidden or left. Teardown is idempotent and never waits on a
// reply from the iframe. Only one job runs at a time.

import { pixelsToText } from "../export/ascii.js";
import { CAPTURE, PROFILES, newJobId, readHostMessage, startMessage, PRESETS } from "./protocol.js";
import { creditFooter, creditMetadata } from "./credit.js";
import { encodeAsciiGif } from "./gif.js";
import { jobContrast, colorGain, BASE_CONTRAST } from "./levels.js";

export const JOB_MS = 30_000; // the whole job, from Capture to the finished GIF
// A slow test machine (software rendering) may lengthen it with ?deadline=, within these bounds.
export const JOB_MS_RANGE = Object.freeze([30_000, 180_000]);
export const FRAME_MS = 8_000; // each frame once the toy has loaded
export const COLUMNS = Object.freeze([48, 72, 96, 144]);
export const CHARACTER_ASPECT = 0.5; // fixed, so the grid is the same on every device
const HOST = new URL("../../ascii-capture-host.html", import.meta.url);
// Every message the host may send in one job: ready, loaded, the frames, an error.
const MAX_MESSAGES = CAPTURE.frames + 3;
// The iframe may use none of these.
const DENY = ["camera", "microphone", "display-capture", "geolocation", "accelerometer", "gyroscope", "magnetometer", "fullscreen"]; // prettier-ignore

export class CaptureError extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason;
  }
}

export const MESSAGES = Object.freeze({
  busy: "A capture is already running.",
  canceled: "Capture canceled. Nothing was saved.",
  hidden: "The capture stopped because the page was hidden. Nothing was saved.",
  left: "The capture stopped because the page was left. Nothing was saved.",
  timeout: "The capture took longer than its time limit and was stopped. Nothing was saved.",
  "frame-timeout": `A frame took longer than ${FRAME_MS / 1000} seconds to render, so the capture stopped. Nothing was saved.`,
  "no-webgl2": "This browser couldn't start WebGL2, which the capture needs. Nothing was saved.",
  load: "The toy didn't load, so the capture stopped. Nothing was saved.",
  render: "The renderer failed during the capture. Nothing was saved.",
  start: "The capture page refused the job. Nothing was saved.",
  protocol:
    "The capture page sent something unexpected, so the capture stopped. Nothing was saved.",
  encode: "The GIF couldn't be made. Nothing was saved.",
});

let running = null;

export function isRunning() {
  return running !== null;
}

// Starts a job. Returns { cancel(), done }, where done resolves to the
// finished GIF or rejects with a CaptureError. A second start while one runs
// is refused.
export function startCapture({
  preset,
  columns,
  color,
  mount,
  jobMs = JOB_MS,
  profile = null,
  onProgress = () => {},
}) {
  if (running) throw new CaptureError("busy", MESSAGES.busy);
  if (
    !PRESETS[preset] ||
    !COLUMNS.includes(columns) ||
    typeof color !== "boolean" ||
    !mount ||
    !(jobMs >= JOB_MS_RANGE[0] && jobMs <= JOB_MS_RANGE[1]) ||
    (profile !== null && !PROFILES.includes(profile))
  )
    throw new RangeError("Unknown capture settings");
  const job = new Job({ preset, columns, color, mount, jobMs, profile, onProgress });
  running = job;
  const release = () => {
    if (running === job) running = null;
  };
  job.done.then(release, release);
  return { cancel: () => job.fail("canceled"), done: job.done };
}

class Job {
  constructor({ preset, columns, color, mount, jobMs, profile, onProgress }) {
    this.id = newJobId();
    this.preset = preset;
    this.toy = PRESETS[preset].toy;
    this.label = PRESETS[preset].label;
    this.columns = columns;
    this.color = color;
    this.onProgress = onProgress;
    this.frames = [];
    this.messages = 0;
    this.renderer = "";
    this.profile = "";
    this.contrast = BASE_CONTRAST;
    this.started = performance.now();
    this.finished = false;
    this.life = new AbortController(); // listeners, and the encoder's stop
    this.done = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    const signal = this.life.signal;
    addEventListener("message", (e) => this.onMessage(e), { signal });
    document.addEventListener("visibilitychange", () => document.hidden && this.fail("hidden"), {
      signal,
    });
    addEventListener("pagehide", () => this.fail("left"), { signal });
    this.jobTimer = setTimeout(() => this.fail("timeout"), jobMs);
    this.frameTimer = 0;
    if (document.hidden) {
      queueMicrotask(() => this.fail("hidden"));
      return;
    }
    const frame = document.createElement("iframe");
    frame.title = "Capture in progress";
    frame.className = "asc-host";
    frame.tabIndex = -1;
    frame.inert = true;
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("allow", DENY.map((p) => `${p} 'none'`).join("; "));
    frame.width = frame.height = "140";
    frame.src = `${HOST.pathname}${profile ? `?profile=${profile}` : ""}#${this.id}`;
    this.iframe = frame; // kept until teardown, which always removes it
    mount.append(frame);
  }

  armFrameTimer() {
    clearTimeout(this.frameTimer);
    this.frameTimer = setTimeout(() => this.fail("frame-timeout"), FRAME_MS);
  }

  post(message) {
    this.iframe?.contentWindow?.postMessage(message, location.origin);
  }

  onMessage(event) {
    if (this.finished || !this.iframe) return;
    if (event.source !== this.iframe.contentWindow || event.origin !== location.origin) return;
    const type = readHostMessage(event.data, this.id);
    if (!type || ++this.messages > MAX_MESSAGES) return this.fail("protocol");
    if (type === "ready") {
      if (this.messages !== 1) return this.fail("protocol");
      this.post(startMessage(this.id, this.preset));
    } else if (type === "loaded") {
      if (this.messages !== 2) return this.fail("protocol");
      this.renderer = event.data.renderer;
      this.profile = event.data.profile;
      this.armFrameTimer();
    } else if (type === "error") {
      this.fail(event.data.reason);
    } else if (type === "frame") {
      if (event.data.index !== this.frames.length || !this.renderer) return this.fail("protocol");
      // Convert now; the pixels go when this message does. The first frame
      // sets the job's contrast (levels.js).
      const data = new Uint8ClampedArray(event.data.pixels);
      if (this.frames.length === 0) this.contrast = jobContrast(data);
      const ascii = pixelsToText(
        { width: CAPTURE.size, height: CAPTURE.size, data },
        { columns: this.columns, characterAspect: CHARACTER_ASPECT, contrast: this.contrast },
      );
      this.frames.push(ascii);
      this.onProgress({ stage: "capture", done: this.frames.length, total: CAPTURE.frames });
      if (this.frames.length < CAPTURE.frames) {
        this.armFrameTimer();
        this.post({ type: "next", job: this.id, index: event.data.index });
      } else {
        this.removeHost();
        this.encode();
      }
    }
  }

  async encode() {
    try {
      const footer = creditFooter(this.toy, this.label, this.columns);
      const settings = {
        ...CAPTURE,
        columns: this.columns,
        rows: this.frames[0].rowCount,
        color: this.color,
        characterAspect: CHARACTER_ASPECT,
        contrast: this.contrast,
      };
      const out = await encodeAsciiGif(this.frames, {
        fps: CAPTURE.fps,
        color: this.color,
        gain: colorGain(this.contrast),
        footer,
        metadata: creditMetadata(this.toy, this.label, settings),
        signal: this.life.signal,
        onProgress: (f) =>
          !this.finished && this.onProgress({ stage: "encode", done: f, total: 1 }),
      });
      if (this.finished) return;
      const result = {
        ...out,
        preset: this.preset,
        toy: this.toy,
        label: this.label,
        footer,
        settings,
        renderer: this.renderer,
        profile: this.profile,
        ms: Math.round(performance.now() - this.started),
        firstRows: this.frames[0].rows,
        lastRows: this.frames[this.frames.length - 1].rows,
      };
      this.teardown();
      this.resolve(result);
    } catch (err) {
      if (!this.finished) this.fail("encode", err);
    }
  }

  removeHost() {
    clearTimeout(this.frameTimer);
    this.frameTimer = 0;
    const frame = this.iframe;
    this.iframe = null;
    frame?.remove();
  }

  // Idempotent: clears both deadlines, every listener and the iframe.
  teardown() {
    this.finished = true;
    clearTimeout(this.jobTimer);
    this.jobTimer = 0;
    this.removeHost();
    this.life.abort();
    this.frames = [];
  }

  fail(reason, err) {
    if (this.finished) return;
    this.teardown();
    const error = new CaptureError(reason, MESSAGES[reason] || MESSAGES.render);
    if (err) error.cause = err;
    this.reject(error);
  }
}
