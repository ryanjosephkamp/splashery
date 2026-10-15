#!/usr/bin/env node
// Original depth-lab drawings: CC0, made by Ryan with Codex (GPT-6).
// Code: Splashery's MIT license. gen-f contains part d's shared build support.
// SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-h.mjs [--check]
import { makeEntries, buildCategory, runCli, seven } from "./gen-f.mjs";

const blurLevels = [0, 1, 2, 4, 8, 12, 20];
const exponentLevels = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];
const widthLevels = [0.14, 0.18, 0.23, 0.3, 0.4, 0.55, 0.75];
const defaults = {
  effect: "distance",
  blurMaxPx: 0,
  hazeStrength: 0,
  blurExponent: 1,
  hazeExponent: 1,
  uniformBlurPx: 0,
  uniformHaze: 0,
  focusDepth: 0.5,
  focusWidth: 0.25,
  focusBlurMaxPx: 12,
  horizonY: 0.18,
  skyGray: 224,
  floorGray: 204,
  hazeGray: 224,
  nearDepth: 0,
  middleDepth: 0.5,
  farDepth: 1,
  nearCenterX: 0.28,
  nearCenterY: 0.79,
  nearSizePx: 224,
  middleCenterX: 0.69,
  middleCenterY: 0.57,
  middleSizePx: 168,
  farCenterX: 0.46,
  farCenterY: 0.34,
  farSizePx: 112,
};
const distance =
  "The fixed near, middle, and far cards should retain their order as distant texture loses contrast or focus; degradation should not create holes or relief in the painted pattern.";
const uniform =
  "Scene-wide blur or haze provides no new relative-distance cue; an ideal model should not rearrange the fixed cards solely because the whole image degrades.";
const focus =
  "The fixed card order should remain unchanged when the focus plane moves; sharper does not always mean nearer, and the pattern should not become geometry.";
export const manifest = makeEntries("H", defaults, [
  { name: "distance-blur", axes: { blurMaxPx: blurLevels }, expect: distance },
  {
    name: "distance-haze",
    axes: { hazeStrength: [0, 0.1, 0.2, 0.35, 0.5, 0.7, 0.9] },
    expect: distance,
  },
  {
    name: "distance-blur-falloff",
    fixed: { blurMaxPx: 12 },
    axes: { blurExponent: exponentLevels },
    expect: distance,
  },
  {
    name: "distance-haze-falloff",
    fixed: { hazeStrength: 0.8 },
    axes: { hazeExponent: exponentLevels },
    expect: distance,
  },
  {
    name: "uniform-blur",
    fixed: { effect: "uniform" },
    axes: { uniformBlurPx: blurLevels },
    expect: uniform,
  },
  {
    name: "uniform-haze",
    fixed: { effect: "uniform" },
    axes: { uniformHaze: [0, 0.1, 0.2, 0.35, 0.5, 0.7, 0.9] },
    expect: uniform,
  },
  { name: "focus-plane", fixed: { effect: "focus" }, axes: { focusDepth: seven }, expect: focus },
  {
    name: "focus-width",
    fixed: { effect: "focus" },
    axes: { focusWidth: widthLevels },
    expect: focus,
  },
  {
    name: "distance-blur-haze-grid",
    axes: { blurMaxPx: blurLevels, hazeStrength: [0, 0.1, 0.2, 0.35, 0.5, 0.7, 0.9] },
    expect: distance,
  },
  {
    name: "focus-plane-width-grid",
    fixed: { effect: "focus" },
    axes: { focusDepth: seven, focusWidth: widthLevels },
    expect: focus,
  },
]);

export function draw(canvas, entry) {
  const ctx = canvas.getContext("2d");
  const v = entry.variables;
  const w = canvas.width;
  const h = canvas.height;
  const gray = (x) => `rgb(${x},${x},${x})`;
  ctx.fillStyle = gray(v.skyGray);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = gray(v.floorGray);
  ctx.fillRect(0, h * v.horizonY, w, h * (1 - v.horizonY));
  // Floor geometry is fixed; distance effects below act only on the cards.
  ctx.strokeStyle = "#aeaeae";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    ctx.moveTo((i * w) / 8, h);
    ctx.lineTo(w / 2, h * v.horizonY);
  }
  for (let i = 1; i < 12; i++) {
    const y = h * (v.horizonY + (1 - v.horizonY) * (i / 12) ** 2);
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  // Identical seed and local coordinates give each card the same printed texture.
  const card = document.createElement("canvas");
  card.width = card.height = 256;
  const cc = card.getContext("2d");
  const cardBytes = () => {
    cc.reset();
    cc.fillStyle = "#eeeeee";
    cc.fillRect(0, 0, 256, 256);
    cc.fillStyle = "#383838";
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++)
        if ((x + y) % 2 === 0) cc.fillRect(x * 32 + 5, y * 32 + 5, 22, 22);
    }
    let state = entry.seed >>> 0;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    cc.strokeStyle = "#777777";
    cc.lineWidth = 3;
    for (let i = 0; i < 16; i++) {
      cc.beginPath();
      cc.moveTo(random() * 256, random() * 256);
      cc.lineTo(random() * 256, random() * 256);
      cc.stroke();
    }
    cc.strokeStyle = "#383838";
    cc.lineWidth = 8;
    cc.strokeRect(4, 4, 248, 248);
  };
  for (const name of ["far", "middle", "near"]) {
    cardBytes();
    const depth = v[`${name}Depth`];
    const haze = v.effect === "distance" ? v.hazeStrength * depth ** v.hazeExponent : 0;
    cc.fillStyle = gray(v.hazeGray);
    cc.globalAlpha = haze;
    cc.fillRect(0, 0, 256, 256);
    cc.globalAlpha = 1;
    let blur = v.effect === "distance" ? v.blurMaxPx * depth ** v.blurExponent : 0;
    if (v.effect === "focus") {
      const offset = (depth - v.focusDepth) / v.focusWidth;
      blur = v.focusBlurMaxPx * (1 - Math.exp(-0.5 * offset * offset));
    }
    const size = v[`${name}SizePx`];
    ctx.save();
    ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(
      card,
      w * v[`${name}CenterX`] - size / 2,
      h * v[`${name}CenterY`] - size / 2,
      size,
      size,
    );
    ctx.restore();
  }
  if (v.effect === "uniform") {
    ctx.fillStyle = gray(v.hazeGray);
    ctx.globalAlpha = v.uniformHaze;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    if (v.uniformBlurPx > 0) {
      // Extend the edges before filtering, so a global blur does not create transparent borders.
      const copy = document.createElement("canvas");
      const pad = Math.ceil(v.uniformBlurPx * 4);
      copy.width = w + 2 * pad;
      copy.height = h + 2 * pad;
      const dest = copy.getContext("2d");
      dest.drawImage(canvas, pad, pad);
      dest.drawImage(canvas, 0, 0, w, 1, pad, 0, w, pad);
      dest.drawImage(canvas, 0, h - 1, w, 1, pad, h + pad, w, pad);
      dest.drawImage(copy, pad, 0, 1, copy.height, 0, 0, pad, copy.height);
      dest.drawImage(copy, pad + w - 1, 0, 1, copy.height, pad + w, 0, pad, copy.height);
      ctx.filter = `blur(${v.uniformBlurPx}px)`;
      ctx.drawImage(copy, -pad, -pad);
      ctx.filter = "none";
    }
  }
}

export const generate = (options = {}) => buildCategory("H", manifest, draw, options);
export default generate;
await runCli(import.meta.url, generate);
