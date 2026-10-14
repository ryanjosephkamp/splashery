// Lane AsciiCapture: the messages between the ASCII lab page and its capture
// document (ascii-capture-host.html, in a same-origin iframe made for one job).
// Each message carries an opaque job id; nothing else crosses but a preset's
// toy id, the whole-orange option, the fixed capture settings and frame pixels.
//
// lab -> host: start { toy, options, capture }, next { index } (one frame at a time)
// host -> lab: ready, loaded { renderer, profile }, frame { index, width, height, pixels }, error { reason }

import LIST from "./toys.json" with { type: "json" };

// The three original presets, each a fresh toy animation, exactly as they were.
export const ORIGINAL = Object.freeze({
  grapes: Object.freeze({ toy: "grapes", options: null, label: "Grapes" }),
  orange: Object.freeze({ toy: "orange", options: Object.freeze({ style: "whole" }), label: "Whole orange" }), // prettier-ignore
  strawberry: Object.freeze({ toy: "strawberry", options: null, label: "Strawberry" }),
});

// Lane ASCII r2: every toy in toys.json is a candidate preset (the lab lists
// only those that passed tools/asc2-check.mjs; the capture page accepts any
// candidate, so the check can run them all). Its optional `camera` replaces
// the toy's home camera; the shelf and `columns` are for the lab's picker.
export const LISTED = Object.freeze(
  Object.fromEntries(
    LIST.toys.map((t) => [
      t.id,
      Object.freeze({
        toy: t.id,
        options: null,
        label: t.label,
        shelf: t.shelf,
        columns: t.columns,
        ...(t.camera ? { camera: Object.freeze({ ...t.camera }) } : {}),
        check: t.check ?? null,
      }),
    ]),
  ),
);
export const SHELVES = Object.freeze(LIST.shelves.map((s) => ({ ...s })));

export const PRESETS = Object.freeze({ ...ORIGINAL, ...LISTED });

// Fixed capture settings: 420 pixels square, 40 frames at 10 fps (four
// seconds), one tap at frame 4, the home camera.
export const CAPTURE = Object.freeze({ size: 420, fps: 10, frames: 40, tapFrame: 4 });

// The detail profiles a player can run at (src/player.js TIERS). The host uses
// the one the app would pick on this device, held for the whole job; tests and
// diagnosis may force one with ?profile= on the lab URL, passed to the host.
export const PROFILES = Object.freeze(["low", "mid", "high", "max"]);

export function profileParam(search) {
  const v = new URLSearchParams(search).get("profile");
  const tier = { weak: "low", strong: "high" }[v] || v;
  return PROFILES.includes(tier) ? tier : null;
}

export const FRAME_BYTES = CAPTURE.size * CAPTURE.size * 4;
export const ERROR_REASONS = Object.freeze(["no-webgl2", "load", "render", "start"]);

const JOB = /^[0-9a-f]{32}$/;

export function newJobId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isJobId(value) {
  return typeof value === "string" && JOB.test(value);
}

function plain(value) {
  return !!value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

function sameCapture(value) {
  return (
    plain(value) &&
    Object.keys(value).length === Object.keys(CAPTURE).length &&
    Object.entries(CAPTURE).every(([key, v]) => value[key] === v)
  );
}

// The preset a start message names, or null.
export function presetFor(toy, options) {
  const preset = Object.values(PRESETS).find((p) => p.toy === toy);
  if (!preset) return null;
  if (preset.options === null) return options === null ? preset : null;
  return plain(options) &&
    Object.keys(options).length === Object.keys(preset.options).length &&
    Object.entries(preset.options).every(([key, v]) => options[key] === v)
    ? preset
    : null;
}

export function startMessage(job, presetId) {
  const preset = PRESETS[presetId];
  if (!preset || !isJobId(job)) throw new RangeError("Unknown preset or job");
  return {
    type: "start",
    job,
    toy: preset.toy,
    options: preset.options ? { ...preset.options } : null,
    capture: { ...CAPTURE },
  };
}

// The host's check of a message from the lab: the expected job, then one of
// two shapes. Returns the message's type, or null to ignore it.
export function readLabMessage(data, job) {
  if (!plain(data) || data.job !== job || !isJobId(job)) return null;
  if (data.type === "start") {
    const keys = Object.keys(data).sort().join();
    if (keys !== "capture,job,options,toy,type") return null;
    if (!presetFor(data.toy, data.options) || !sameCapture(data.capture)) return null;
    return "start";
  }
  if (data.type === "next") {
    if (Object.keys(data).length !== 3) return null;
    return Number.isInteger(data.index) && data.index >= 0 && data.index < CAPTURE.frames
      ? "next"
      : null;
  }
  return null;
}

// The lab's check of a message from the host. Returns its type, or null.
export function readHostMessage(data, job) {
  if (!plain(data) || data.job !== job || !isJobId(job)) return null;
  switch (data.type) {
    case "ready":
      return Object.keys(data).length === 2 ? "ready" : null;
    case "loaded":
      return Object.keys(data).length === 4 &&
        typeof data.renderer === "string" &&
        data.renderer.length <= 200 &&
        PROFILES.includes(data.profile)
        ? "loaded"
        : null;
    case "frame":
      return Object.keys(data).length === 6 &&
        Number.isInteger(data.index) &&
        data.index >= 0 &&
        data.index < CAPTURE.frames &&
        data.width === CAPTURE.size &&
        data.height === CAPTURE.size &&
        data.pixels instanceof ArrayBuffer &&
        data.pixels.byteLength === FRAME_BYTES
        ? "frame"
        : null;
    case "error":
      return Object.keys(data).length === 3 && ERROR_REASONS.includes(data.reason) ? "error" : null;
    default:
      return null;
  }
}
