#!/usr/bin/env node
// MIT code; original generated images are CC0, made by Ryan with Codex (GPT-6).
// node tools/depth-lab/gen-i.mjs [--manifest | --verify]
import path from "node:path";
import { pathToFileURL } from "node:url";
import { clamp, raster, uniform, makeEntry, runCategory } from "./gen-a.mjs";

const resolutions = [256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096];
const qualities = [10, 20, 30, 40, 50, 65, 80, 90, 100];
const sigmas = [0, 0.5, 1, 2, 4, 8, 16, 32, 64];
const references = ["gray", "ramp", "scene"];
const base = {
  reference: "scene",
  resolutionPx: 1024,
  jpegQuality: null,
  noiseSigma: 0,
  noiseChannels: "luma",
  sourceSizePx: 4096,
  resampling: "area",
  noiseModel: "Gaussian-additive-sRGB",
};
const nullExpectation =
  "Keep the flat control flat; compression or noise must not introduce confident new geometric depth.";
const sceneExpectation =
  "Preserve the clean reference's relative depth ordering as detail permits; corruption adds uncertainty, not new geometry.";

export function entries() {
  const result = [];
  const add = (family, level, variables, controls) =>
    result.push(
      makeEntry(
        "I",
        family,
        level,
        variables,
        controls,
        variables.reference === "scene" ? sceneExpectation : nullExpectation,
        variables.resolutionPx,
        variables.jpegQuality === null ? "png" : "jpg",
      ),
    );
  for (const reference of references) {
    const referenceBase = { ...base, reference };
    for (const resolutionPx of resolutions)
      add(
        `resolution-${reference}`,
        String(resolutionPx),
        { ...referenceBase, resolutionPx },
        "Only resolutionPx and the matching file dimensions vary in this sweep. One fixed 4096-pixel source, area resampling, reference content, PNG format, zero noise, and seed 7 stay fixed.",
      );
    for (const jpegQuality of qualities)
      add(
        `jpeg-${reference}`,
        String(jpegQuality),
        { ...referenceBase, jpegQuality },
        "Only jpegQuality varies in this sweep. Reference content, 1024-pixel size, area resampling, JPEG encoder, zero noise, and seed 7 stay fixed. Compare with the matching resolution-1024 PNG for a lossless control.",
      );
    for (const noiseChannels of ["luma", "rgb"]) {
      for (const noiseSigma of sigmas)
        add(
          `sensor-${noiseChannels}-${reference}`,
          String(noiseSigma).replaceAll(".", "p"),
          { ...referenceBase, noiseChannels, noiseSigma },
          "Only noiseSigma varies in this sweep. One fixed seeded Gaussian noise realization, channel mode, reference content, 1024-pixel size, area resampling, and PNG format stay fixed. Noise is added after resizing and before encoding.",
        );
    }
  }
  for (const resolutionPx of [256, 512, 1024, 2048, 4096]) {
    for (const jpegQuality of [10, 30, 50, 80, 100])
      add(
        "grid-resolution-jpeg",
        `${resolutionPx}-${jpegQuality}`,
        { ...base, resolutionPx, jpegQuality },
        "5 by 5 grid; resolutionPx (and file dimensions) and jpegQuality vary independently. The scene reference, fixed 4096-pixel source, area resampling, zero noise, and seed 7 stay fixed.",
      );
  }
  for (const noiseSigma of [0, 2, 8, 16, 32]) {
    for (const jpegQuality of [10, 30, 50, 80, 100])
      add(
        "grid-noise-jpeg",
        `${noiseSigma}-${jpegQuality}`,
        { ...base, noiseSigma, jpegQuality },
        "5 by 5 grid; noiseSigma and jpegQuality vary independently. The scene reference, 1024-pixel size, luma channel mode, fixed noise realization, area resampling, and seed 7 stay fixed. Noise is added before JPEG encoding.",
      );
  }
  return result;
}

// The synthetic scene is an encoding control, not a new shading experiment.
// Geometry, palette, and fine detail are fixed in a single canonical raster.
function scene(u, v) {
  let rgb = v < 0.44 ? [174, 199, 216] : [175 - 45 * v, 164 - 40 * v, 144 - 30 * v];
  if (v >= 0.44) {
    const depth = (v - 0.44) / 0.56;
    const floorX = (u - 0.5) / (0.08 + depth);
    const grid =
      Math.abs(floorX * 6 - Math.round(floorX * 6)) < 0.025 ||
      Math.abs(depth * 10 - Math.round(depth * 10)) < 0.018;
    if (grid) rgb = [95, 88, 77];
  }
  // Far block, then near block: a fixed, explicit overlap cue.
  if (u > 0.53 && u < 0.75 && v > 0.24 && v < 0.57) rgb = [86, 136, 170];
  if (u > 0.64 && u < 0.79 && v > 0.42 && v < 0.71) rgb = [186, 106, 62];
  const dx = (u - 0.32) / 0.17;
  const dy = (v - 0.57) / 0.17;
  const r2 = dx * dx + dy * dy;
  if (r2 < 1) {
    const z = Math.sqrt(1 - r2);
    const light = clamp(-0.4 * dx - 0.45 * dy + 0.8 * z);
    rgb = [65 + 130 * light, 30 + 70 * light, 25 + 50 * light];
  }
  // Fine texture and thin bars have a fixed size in the canonical source.
  if (u > 0.1 && u < 0.46 && v > 0.8 && v < 0.91) {
    const check = (Math.floor(u * 256) + Math.floor(v * 256)) % 2;
    rgb = check ? [210, 210, 210] : [40, 40, 40];
  }
  if (u > 0.85 && u < 0.93 && v > 0.25 && v < 0.8) {
    const bar = Math.floor(u * 512) % 8 === 0;
    rgb = bar ? [35, 35, 35] : [220, 210, 165];
  }
  return rgb;
}

let canonicalScene;
const resizedScenes = new Map();

// Exact pixel-area averaging, including fractional boundaries for 384/768/1536/3072.
function resizeArea(source, size) {
  const scale = source.width / size;
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const top = y * scale;
    const bottom = (y + 1) * scale;
    for (let x = 0; x < size; x++) {
      const left = x * scale;
      const right = (x + 1) * scale;
      const rgb = [0, 0, 0];
      for (let sy = Math.floor(top); sy < Math.ceil(bottom); sy++) {
        const wy = Math.min(bottom, sy + 1) - Math.max(top, sy);
        for (let sx = Math.floor(left); sx < Math.ceil(right); sx++) {
          const weight = wy * (Math.min(right, sx + 1) - Math.max(left, sx));
          const offset = (sy * source.width + sx) * 4;
          for (let channel = 0; channel < 3; channel++)
            rgb[channel] += source.data[offset + channel] * weight;
        }
      }
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++)
        data[offset + channel] = Math.round(rgb[channel] / (scale * scale));
      data[offset + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

function cleanReference(reference, size) {
  if (reference === "gray") return raster(size, size, () => [128, 128, 128]);
  if (reference === "ramp") {
    // A 4096-pixel, quantized sRGB ramp averaged over each output pixel.
    const row = Array.from({ length: 4096 }, (_, x) => Math.round(32 + (192 * (x + 0.5)) / 4096));
    const values = [];
    const scale = 4096 / size;
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let sx = Math.floor(x * scale); sx < Math.ceil((x + 1) * scale); sx++)
        sum += row[sx] * (Math.min((x + 1) * scale, sx + 1) - Math.max(x * scale, sx));
      values.push(Math.round(sum / scale));
    }
    return raster(size, size, (u, v, x) => [values[x], values[x], values[x]]);
  }
  if (reference !== "scene") throw new Error(`Unknown reference: ${reference}`);
  canonicalScene ??= raster(4096, 4096, scene);
  if (size === 4096) return canonicalScene;
  if (!resizedScenes.has(size)) resizedScenes.set(size, resizeArea(canonicalScene, size));
  return resizedScenes.get(size);
}

function gaussian(seed, x, y, channel) {
  const u = Math.max(1 / 4294967296, uniform(seed, x, y, channel * 2));
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform(seed, x, y, channel * 2 + 1));
}

export function render(entry) {
  const v = entry.variables;
  const clean = cleanReference(v.reference, entry.width);
  if (v.noiseSigma === 0) return clean;
  return raster(entry.width, entry.height, (u, w, x, y) => {
    const offset = (y * entry.width + x) * 4;
    const lumaNoise = gaussian(entry.seed, x, y, 0) * v.noiseSigma;
    return [0, 1, 2].map(
      (channel) =>
        clean.data[offset + channel] +
        (v.noiseChannels === "luma"
          ? lumaNoise
          : gaussian(entry.seed, x, y, channel) * v.noiseSigma),
    );
  });
}

export async function build(args = []) {
  await runCategory("I", entries(), render, args);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  await build(process.argv.slice(2));
