#!/usr/bin/env node
// MIT code; original generated images are CC0, made by Ryan with Codex (GPT-6).
// node tools/depth-lab/gen-a.mjs [--manifest | --verify]
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { chromium } from "@playwright/test";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));

// Coordinate hashing keeps each noise sample fixed when amplitude changes.
export function uniform(seed, x, y, channel = 0) {
  let n =
    (seed ^
      Math.imul(x + 1, 0x45d9f3b) ^
      Math.imul(y + 1, 0x27d4eb2d) ^
      Math.imul(channel + 1, 0x165667b1)) >>>
    0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function raster(width, height, sample) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgb = sample((x + 0.5) / width, (y + 0.5) / height, x, y);
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++)
        data[offset + channel] = Math.round(clamp(rgb[channel], 0, 255));
      data[offset + 3] = 255;
    }
  }
  return { width, height, data };
}

export function encode(image, quality = null) {
  return quality === null
    ? PNG.sync.write(image, { filterType: 4, deflateLevel: 9 })
    : jpeg.encode(image, quality).data;
}

export function decode(bytes, isJpeg) {
  return isJpeg
    ? jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 512 })
    : PNG.sync.read(bytes);
}

export function makeEntry(
  category,
  family,
  level,
  variables,
  controls,
  expect,
  size = 1024,
  extension = "png",
) {
  const id = `${category.toLowerCase()}-${family}-${level}`;
  return {
    id,
    category,
    file: `${category.toLowerCase()}/${id}.${extension}`,
    width: size,
    height: size,
    seed: 7,
    variables,
    controls,
    expect,
  };
}

const flatExpectation =
  "No geometric depth cue: a constant plane is the null control; color or noise alone must not create confident relief.";
const gradientExpectation =
  "A smooth field has no unique geometry: do not mistake its brightness ramp for known surface depth.";
const gradientBase = {
  field: "gradient",
  shape: "linear",
  angleDeg: 0,
  span: 192,
  midpoint: 127.5,
  gamma: 1,
  centerX: 0.5,
  centerY: 0.5,
  radius: 0.5,
  noiseAmplitude: 0,
  noiseCellPx: 1,
};
const solidBase = { field: "solid", hueDeg: 0, saturation: 0, value: 128 };
const noiseBase = { field: "noise", midpoint: 128, noiseAmplitude: 32, noiseCellPx: 1 };

export function entries() {
  const result = [];
  const sweep = (family, key, levels, base, expect) => {
    for (const value of levels)
      result.push(
        makeEntry(
          "A",
          family,
          String(value).replaceAll(".", "p"),
          { ...base, [key]: value },
          `Sweep ${family}; only ${key} varies. All other variables in this record, the 1024-pixel square, opaque sRGB encoding, PNG format, and seed 7 stay fixed.`,
          expect,
        ),
      );
  };
  sweep("gray", "value", [0, 32, 64, 96, 128, 160, 192, 224, 255], solidBase, flatExpectation);
  sweep(
    "hue",
    "hueDeg",
    [0, 40, 80, 120, 160, 200, 240, 280, 320],
    { ...solidBase, saturation: 1, value: 192 },
    flatExpectation,
  );
  sweep(
    "saturation",
    "saturation",
    [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
    { ...solidBase, hueDeg: 200, value: 192 },
    flatExpectation,
  );
  sweep(
    "direction",
    "angleDeg",
    [0, 45, 90, 135, 180, 225, 270, 315],
    gradientBase,
    gradientExpectation,
  );
  sweep("span", "span", [0, 24, 48, 72, 96, 120, 144, 168, 192], gradientBase, gradientExpectation);
  sweep(
    "falloff",
    "gamma",
    [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6],
    gradientBase,
    gradientExpectation,
  );
  sweep(
    "shape",
    "shape",
    ["linear", "radial", "diamond", "square", "conic"],
    gradientBase,
    gradientExpectation,
  );
  sweep(
    "radius",
    "radius",
    [0.125, 0.1875, 0.25, 0.3125, 0.375, 0.4375, 0.5, 0.625, 0.75],
    { ...gradientBase, shape: "radial" },
    gradientExpectation,
  );
  sweep(
    "center",
    "centerX",
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
    { ...gradientBase, shape: "radial" },
    gradientExpectation,
  );
  sweep(
    "noise-amplitude",
    "noiseAmplitude",
    [0, 1, 2, 4, 8, 16, 32, 64, 96],
    noiseBase,
    flatExpectation,
  );
  sweep(
    "noise-cell",
    "noiseCellPx",
    [1, 2, 4, 8, 16, 32, 64, 128, 256],
    noiseBase,
    flatExpectation,
  );
  for (const angleDeg of [0, 45, 90, 180, 270]) {
    for (const span of [0, 48, 96, 144, 192])
      result.push(
        makeEntry(
          "A",
          "grid-direction-span",
          `${angleDeg}-${span}`,
          { ...gradientBase, angleDeg, span },
          "5 by 5 grid; angleDeg and span vary independently. Every other recorded variable, PNG encoding, 1024-pixel size, and seed stay fixed.",
          gradientExpectation,
        ),
      );
  }
  for (const noiseAmplitude of [0, 4, 16, 32, 64]) {
    for (const noiseCellPx of [1, 4, 16, 64, 256])
      result.push(
        makeEntry(
          "A",
          "grid-noise",
          `${noiseAmplitude}-${noiseCellPx}`,
          { ...noiseBase, noiseAmplitude, noiseCellPx },
          "5 by 5 grid; noiseAmplitude and noiseCellPx vary independently. Every other recorded variable, PNG encoding, 1024-pixel size, and seed stay fixed.",
          flatExpectation,
        ),
      );
  }
  return result;
}

function hsv(hue, saturation, value) {
  const h = hue / 60;
  const c = value * saturation;
  const secondary = c * (1 - Math.abs((h % 2) - 1));
  const sectors = [
    [c, secondary, 0],
    [secondary, c, 0],
    [0, c, secondary],
    [0, secondary, c],
    [secondary, 0, c],
    [c, 0, secondary],
  ];
  return sectors[Math.floor(h) % 6].map((channel) => channel + value - c);
}

export function render(entry) {
  const v = entry.variables;
  const angle = (v.angleDeg * Math.PI) / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const projectionSpan = Math.abs(dx) + Math.abs(dy);
  const solid = v.field === "solid" ? hsv(v.hueDeg, v.saturation, v.value) : null;
  return raster(entry.width, entry.height, (u, w, x, y) => {
    if (solid) return solid;
    const noise =
      (uniform(entry.seed, Math.floor(x / v.noiseCellPx), Math.floor(y / v.noiseCellPx)) * 2 - 1) *
      v.noiseAmplitude;
    if (v.field === "noise") return [v.midpoint + noise, v.midpoint + noise, v.midpoint + noise];
    const rx = u - v.centerX;
    const ry = w - v.centerY;
    let t;
    switch (v.shape) {
      case "linear":
        t = 0.5 + ((u - 0.5) * dx + (w - 0.5) * dy) / projectionSpan;
        break;
      case "radial":
        t = Math.hypot(rx, ry) / v.radius;
        break;
      case "diamond":
        t = (Math.abs(rx) + Math.abs(ry)) / v.radius;
        break;
      case "square":
        t = Math.max(Math.abs(rx), Math.abs(ry)) / v.radius;
        break;
      case "conic":
        t = (Math.atan2(ry, rx) + Math.PI) / (2 * Math.PI);
        break;
      default:
        throw new Error(`Unknown field shape: ${v.shape}`);
    }
    const value = v.midpoint + (clamp(t) ** v.gamma - 0.5) * v.span + noise;
    return [value, value, value];
  });
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// The manifest is both a reviewable record and the input to the build. Refuse drift.
export async function runCategory(letter, designedEntries, renderer, args = []) {
  assert(
    args.length <= 1 && args.every((arg) => ["--manifest", "--verify"].includes(arg)),
    "Usage: generator [--manifest | --verify]",
  );
  const category = letter.toLowerCase();
  const manifestPath = path.join(root, "tools/depth-lab", `${category}.json`);
  if (args.includes("--manifest")) {
    await fs.writeFile(manifestPath, `${JSON.stringify(designedEntries, null, 2)}\n`);
    console.log(`${letter}: wrote ${designedEntries.length} manifest records`);
    return;
  }
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  assert.deepEqual(
    manifest,
    designedEntries,
    "Manifest differs from generator design; use --manifest to regenerate it.",
  );
  assert(manifest.length >= 100 && manifest.length <= 400);
  assert.equal(new Set(manifest.map((entry) => entry.id)).size, manifest.length);
  const output = path.join(root, ".cache/depth-lab");
  await fs.mkdir(path.join(output, category), { recursive: true });
  const hashes = {};
  const thumbnails = [];
  for (const entry of manifest) {
    assert.equal(entry.category, letter);
    assert.equal(entry.seed, 7);
    assert.equal(
      entry.file,
      `${category}/${entry.id}.${entry.variables.jpegQuality == null ? "png" : "jpg"}`,
    );
    const generated = renderer(entry);
    assert.equal(generated.width, entry.width);
    assert.equal(generated.height, entry.height);
    const bytes = encode(generated, entry.variables.jpegQuality ?? null);
    const target = path.join(output, entry.file);
    if (args.includes("--verify"))
      assert.equal(
        sha256(await fs.readFile(target)),
        sha256(bytes),
        `Rebuild differs: ${entry.id}`,
      );
    else await fs.writeFile(target, bytes);
    const decoded = decode(bytes, entry.file.endsWith(".jpg"));
    assert.equal(decoded.width, entry.width, entry.id);
    assert.equal(decoded.height, entry.height, entry.id);
    for (let i = 3; i < decoded.data.length; i += 4)
      assert.equal(decoded.data[i], 255, `Nonopaque pixel in ${entry.id}`);
    hashes[entry.file] = sha256(bytes);
    const thumbnail = raster(144, 144, (u, v) => {
      const offset =
        (Math.min(entry.height - 1, Math.floor(v * entry.height)) * entry.width +
          Math.min(entry.width - 1, Math.floor(u * entry.width))) *
        4;
      return decoded.data.subarray(offset, offset + 3);
    });
    thumbnails.push({
      id: entry.id,
      width: entry.width,
      format: entry.file.endsWith(".jpg") ? "JPEG" : "PNG",
      data: encode(thumbnail).toString("base64"),
    });
    if (thumbnails.length % 25 === 0)
      console.log(`${letter}: ${thumbnails.length}/${manifest.length}`);
  }
  const hashPath = path.join(output, category, "sha256.json");
  if (args.includes("--verify"))
    assert.deepEqual(JSON.parse(await fs.readFile(hashPath, "utf8")), hashes);
  else {
    await fs.writeFile(hashPath, `${JSON.stringify(hashes, null, 2)}\n`);
    await contactSheet(letter, thumbnails);
  }
  console.log(
    `${letter}: ${manifest.length} images ${args.includes("--verify") ? "verified byte for byte" : "built"}; ${path.join(output, category)}`,
  );
}

async function contactSheet(letter, thumbnails) {
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  });
  try {
    const page = await browser.newPage();
    const base64 = await page.evaluate(
      async ({ letter, thumbnails }) => {
        const cellWidth = 176;
        const cellHeight = 194;
        const header = 64;
        const columns = 9;
        const canvas = document.createElement("canvas");
        canvas.width = columns * cellWidth;
        canvas.height = header + Math.ceil(thumbnails.length / columns) * cellHeight;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#111";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(
          `Depth lab ${letter} — ${thumbnails.length} images — CC0, made by Ryan with Codex (GPT-6)`,
          16,
          26,
        );
        ctx.font = "14px sans-serif";
        ctx.fillText(
          "Decoded files, nearest-neighbor thumbnails. IDs map to the manifest; inspect full-size files for noise and compression.",
          16,
          48,
        );
        for (let index = 0; index < thumbnails.length; index++) {
          const item = thumbnails[index];
          const x = (index % columns) * cellWidth + 16;
          const y = header + Math.floor(index / columns) * cellHeight;
          const image = new Image();
          image.src = `data:image/png;base64,${item.data}`;
          await image.decode();
          ctx.drawImage(image, x, y);
          ctx.strokeStyle = "#aaa";
          ctx.strokeRect(x - 0.5, y - 0.5, 145, 145);
          ctx.font = "11px monospace";
          ctx.fillText(item.id.slice(0, 25), x, y + 158);
          ctx.fillText(item.id.slice(25), x, y + 171);
          ctx.fillText(`${item.width} px / ${item.format}`, x, y + 185);
        }
        return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
      },
      { letter, thumbnails },
    );
    const destination = path.join(root, "docs/audits/depth-lab", `${letter.toLowerCase()}.jpg`);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, Buffer.from(base64, "base64"));
  } finally {
    await browser.close();
  }
}

export async function build(args = []) {
  await runCategory("A", entries(), render, args);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  await build(process.argv.slice(2));
