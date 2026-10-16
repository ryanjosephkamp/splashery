// The one place that imports the vendored PlayCanvas engine. Everything else
// imports it from here by relative URL, so the same modules work in the app,
// the embed player and the <splashery-toy> element on a page that has no
// import map of its own.
export * from "../vendor/playcanvas/playcanvas.min.mjs";
import { createGraphicsDevice as createDevice } from "../vendor/playcanvas/playcanvas.min.mjs";
import { observeGraphicsDevice } from "./renderer-diagnostics.js";

// Keep the vendored device order, options, returned device, and thrown error.
export function createGraphicsDevice(canvas, options) {
  return observeGraphicsDevice(createDevice, canvas, options);
}
