#!/usr/bin/env node
// Original depth-lab drawings: CC0, made by Ryan with Codex (GPT-6).
// Code: Splashery's MIT license. gen-f contains part d's shared build support.
// SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-g.mjs [--check]
import { makeEntries, buildCategory, runCli } from "./gen-f.mjs";

const sizeLevels = [64, 96, 144, 216, 324, 486, 648];
const heightLevels = [0.22, 0.31, 0.4, 0.49, 0.58, 0.67, 0.76];
const defaults = {
  shape: "circle",
  background: "plain",
  diameterPx: 192,
  centerX: 0.58,
  centerY: 0.55,
  horizonY: 0.14,
  referenceCenterX: 0.14,
  referenceCenterY: 0.85,
  referenceDiameterPx: 64,
  objectGray: 56,
  backgroundGray: 240,
  floorGray: 224,
};
const expectSize =
  "A silhouette's image size alone cannot determine its distance; under an equal-world-size assumption, larger may suggest nearer, with no relief inside the flat fill.";
const expectHeight =
  "Image height alone does not determine distance; under a common-ground assumption, a position closer to the horizon may suggest farther, with no relief inside the flat fill.";
const series = [];
for (const background of ["plain", "ground"]) {
  for (const shape of ["circle", "square", "triangle"]) {
    series.push(
      {
        name: `${background}-${shape}-size`,
        fixed: { shape, background },
        axes: { diameterPx: sizeLevels },
        expect: expectSize,
      },
      {
        name: `${background}-${shape}-height`,
        fixed: { shape, background },
        axes: { centerY: heightLevels },
        expect: expectHeight,
      },
    );
  }
}
for (const [background, shape] of [
  ["plain", "circle"],
  ["ground", "square"],
]) {
  series.push({
    name: `${background}-${shape}-size-height-grid`,
    fixed: { shape, background },
    axes: {
      diameterPx: [64, 112, 160, 208, 256, 304, 352],
      centerY: [0.32, 0.39, 0.46, 0.53, 0.6, 0.67, 0.74],
    },
    expect:
      "Size and frame height can suggest relative distance under equal-world-size and common-ground assumptions, but neither establishes metric depth or interior relief.",
  });
}
export const manifest = makeEntries("G", defaults, series);

export function draw(canvas, entry) {
  const ctx = canvas.getContext("2d");
  const v = entry.variables;
  const gray = (x) => `rgb(${x},${x},${x})`;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = gray(v.backgroundGray);
  ctx.fillRect(0, 0, w, h);
  if (v.background === "ground") {
    ctx.fillStyle = gray(v.floorGray);
    ctx.fillRect(0, h * v.horizonY, w, h * (1 - v.horizonY));
  }
  // The reference disk is unchanged in every entry, including the plain-background controls.
  ctx.fillStyle = gray(v.objectGray);
  ctx.beginPath();
  ctx.arc(
    w * v.referenceCenterX,
    h * v.referenceCenterY,
    v.referenceDiameterPx / 2,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  const x = w * v.centerX;
  const y = h * v.centerY;
  const r = v.diameterPx / 2;
  if (v.shape === "circle") {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (v.shape === "square") {
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.lineTo(x - r, y + r);
    ctx.closePath();
    ctx.fill();
  }
}

export const generate = (options = {}) => buildCategory("G", manifest, draw, options);
export default generate;
await runCli(import.meta.url, generate);
