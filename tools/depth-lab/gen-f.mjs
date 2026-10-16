#!/usr/bin/env node
// Original depth-lab drawings: CC0, made by Ryan with Codex (GPT-6).
// Code: Splashery's MIT license. Uses the existing pinned Playwright and Prettier tools.
// SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-f.mjs
// --check validates the committed manifest without rewriting it or drawing pictures.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { format, resolveConfig } from "prettier";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const seven = [0, 1 / 6, 2 / 6, 0.5, 4 / 6, 5 / 6, 1].map((x) => +x.toFixed(6));

// Series metadata stays constant within a sweep or grid. Every rendering parameter is recorded.
export function makeEntries(category, defaults, series) {
  const letter = category.toLowerCase();
  return series.flatMap(({ name, fixed = {}, axes, expect }) => {
    const varied = Object.keys(axes);
    const controls = { ...defaults, ...fixed };
    for (const key of varied) delete controls[key];
    const combinations = Object.entries(axes).reduce(
      (rows, [key, levels]) =>
        rows.flatMap((row) => levels.map((value) => ({ ...row, [key]: value }))),
      [{}],
    );
    return combinations.map((values, index) => {
      const id = `${letter}-${name}-${String(index + 1).padStart(2, "0")}`;
      return {
        id,
        category,
        file: `${letter}/${id}.png`,
        width: 1024,
        height: 1024,
        seed: 7,
        variables: { series: name, varying: varied.join(","), ...defaults, ...fixed, ...values },
        controls: `Seed 7; 1024 px square; fixed parameters: ${JSON.stringify(controls)}. No text, shadows, or lighting changes.`,
        expect,
      };
    });
  });
}

const defaults = {
  scene: "lines",
  convergence: 0.75,
  vanishingX: 0.5,
  horizonY: 0.22,
  lineCount: 9,
  lineWidthPx: 4,
  lineContrast: 0.8,
  gridDepthExponent: 2,
  gridRows: 16,
  textureCount: 800,
  textureDensityExponent: 1,
  textureSizeExponent: 0,
  textureContrastExponent: 0,
  textureNearDiameterPx: 24,
  horizonContrast: 0,
  backgroundGray: 232,
};
const floor =
  "Under a floor interpretation, depth increases toward the horizon; painted lines and texture should stay on the plane, with no raised ridges.";
const parallel =
  "Parallel lines alone do not establish a unique depth; convergence may suggest a receding plane without making the lines raised objects.";
export const manifest = makeEntries("F", defaults, [
  { name: "lines-convergence", axes: { convergence: seven }, expect: parallel },
  {
    name: "lines-vanishing-x",
    axes: { vanishingX: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8] },
    expect: parallel,
  },
  {
    name: "grid-horizon",
    fixed: { scene: "grid", convergence: 1 },
    axes: { horizonY: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7] },
    expect: floor,
  },
  {
    name: "grid-spacing",
    fixed: { scene: "grid", convergence: 1 },
    axes: { gridDepthExponent: [0.5, 0.75, 1, 1.5, 2, 3, 4] },
    expect: floor,
  },
  {
    name: "texture-density",
    fixed: { scene: "texture" },
    axes: { textureDensityExponent: [0.5, 0.75, 1, 1.5, 2, 3, 4] },
    expect: floor,
  },
  {
    name: "texture-size",
    fixed: { scene: "texture" },
    axes: { textureSizeExponent: [0, 0.25, 0.5, 0.75, 1, 1.5, 2] },
    expect: floor,
  },
  {
    name: "texture-contrast",
    fixed: { scene: "texture" },
    axes: { textureContrastExponent: [0, 0.25, 0.5, 0.75, 1, 1.5, 2] },
    expect: floor,
  },
  {
    name: "grid-horizon-contrast",
    fixed: { scene: "grid", convergence: 1 },
    axes: { horizonContrast: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3] },
    expect: floor,
  },
  {
    name: "lines-convergence-x-grid",
    axes: { convergence: seven, vanishingX: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8] },
    expect: parallel,
  },
  {
    name: "texture-density-size-grid",
    fixed: { scene: "texture" },
    axes: {
      textureDensityExponent: [0.5, 0.75, 1, 1.5, 2, 3, 4],
      textureSizeExponent: [0, 0.25, 0.5, 0.75, 1, 1.5, 2],
    },
    expect: floor,
  },
]);

// This function is serialized into Chromium; it deliberately has no module dependencies.
export function draw(canvas, entry) {
  const ctx = canvas.getContext("2d");
  const v = entry.variables;
  const w = canvas.width;
  const h = canvas.height;
  const horizon = h * v.horizonY;
  const gray = (x) => `rgb(${x},${x},${x})`;
  ctx.fillStyle = gray(v.backgroundGray);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = gray(Math.round(v.backgroundGray * (1 - v.horizonContrast)));
  ctx.fillRect(0, horizon, w, h - horizon);
  if (v.scene === "texture") {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, w, h - horizon);
    ctx.clip();
    let state = entry.seed >>> 0;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let i = 0; i < v.textureCount; i++) {
      const x = random() * w;
      const t = Math.max(0.012, random() ** v.textureDensityExponent);
      const diameter = Math.max(2, v.textureNearDiameterPx * t ** v.textureSizeExponent);
      const contrast = v.lineContrast * t ** v.textureContrastExponent;
      ctx.fillStyle = gray(Math.round(v.backgroundGray * (1 - contrast)));
      ctx.beginPath();
      ctx.arc(x, horizon + (h - horizon) * t, diameter / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  ctx.strokeStyle = gray(Math.round(v.backgroundGray * (1 - v.lineContrast)));
  ctx.lineWidth = v.lineWidthPx;
  ctx.beginPath();
  for (let i = 0; i < v.lineCount; i++) {
    const bottomX = (i * w) / (v.lineCount - 1);
    const topX = bottomX * (1 - v.convergence) + w * v.vanishingX * v.convergence;
    ctx.moveTo(bottomX, h);
    ctx.lineTo(topX, horizon);
  }
  if (v.scene === "grid") {
    for (let i = 1; i < v.gridRows; i++) {
      const y = horizon + (h - horizon) * (i / v.gridRows) ** v.gridDepthExponent;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
  }
  ctx.stroke();
}

export function validate(entries, category) {
  if (entries.length < 100 || entries.length > 400)
    throw new Error(`${category}: expected 100–400 entries`);
  const ids = new Set();
  const series = new Map();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate id: ${entry.id}`);
    ids.add(entry.id);
    if (
      entry.category !== category ||
      entry.file !== `${category.toLowerCase()}/${entry.id}.png` ||
      entry.width !== 1024 ||
      entry.height !== 1024 ||
      entry.seed !== 7 ||
      !entry.controls ||
      !entry.expect
    )
      throw new Error(`Invalid record: ${entry.id}`);
    const group = series.get(entry.variables.series) || [];
    group.push(entry);
    series.set(entry.variables.series, group);
  }
  for (const [name, group] of series) {
    const axes = group[0].variables.varying.split(",");
    const fixed = (entry) =>
      Object.fromEntries(Object.entries(entry.variables).filter(([key]) => !axes.includes(key)));
    if (axes.length < 1 || axes.length > 2) throw new Error(`Invalid axes: ${name}`);
    for (const entry of group) {
      if (JSON.stringify(fixed(entry)) !== JSON.stringify(fixed(group[0])))
        throw new Error(`A control changed in ${name}`);
    }
    const levels = axes.map((key) => new Set(group.map((entry) => entry.variables[key])).size);
    if (
      levels.some((count) => count < 5 || count > 9) ||
      group.length !== levels.reduce((a, b) => a * b, 1)
    )
      throw new Error(`Incomplete levels: ${name}`);
    const tuples = new Set(
      group.map((entry) => JSON.stringify(axes.map((key) => entry.variables[key]))),
    );
    if (tuples.size !== group.length) throw new Error(`Repeated combination: ${name}`);
  }
}

// Shared only by part d's generators. No browser, file writes, or drawing happens on import.
export async function buildCategory(category, entries, render, options = {}) {
  validate(entries, category);
  const letter = category.toLowerCase();
  const manifestPath = path.join(root, "tools/depth-lab", `${letter}.json`);
  if (options.check) {
    const committed = JSON.parse(await readFile(manifestPath, "utf8"));
    if (JSON.stringify(committed) !== JSON.stringify(entries))
      throw new Error(`${letter}.json differs from the generator`);
    console.log(
      `${category}: ${entries.length} manifest entries; controls and level grids verified`,
    );
    return;
  }
  const outDir = path.resolve(options.outDir || path.join(root, ".cache/depth-lab"));
  const imageDir = path.join(outDir, letter);
  const sheetPath = path.resolve(
    options.sheetPath || path.join(root, "docs/audits/depth-lab", `${letter}.jpg`),
  );
  await mkdir(imageDir, { recursive: true });
  await mkdir(path.dirname(sheetPath), { recursive: true });
  await writeFile(
    manifestPath,
    await format(JSON.stringify(entries), {
      ...(await resolveConfig(manifestPath)),
      parser: "json",
    }),
  );
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    args: ["--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.goto("about:blank");
    await page.evaluate(
      ({ code }) => {
        window.depthLabDraw = (0, eval)(`(${code})`);
      },
      { code: render.toString() },
    );
    await page.evaluate(
      ({ category, count }) => {
        window.imageCanvas = document.createElement("canvas");
        window.imageCanvas.width = window.imageCanvas.height = 1024;
        window.sheetCanvas = document.createElement("canvas");
        window.sheetCanvas.width = 7 * 168 + 16;
        window.sheetCanvas.height = Math.ceil(count / 7) * 184 + 76;
        const ctx = window.sheetCanvas.getContext("2d");
        ctx.fillStyle = "#fafafa";
        ctx.fillRect(0, 0, window.sheetCanvas.width, window.sheetCanvas.height);
        ctx.fillStyle = "#222";
        ctx.font = "bold 19px sans-serif";
        ctx.fillText(`Depth lab ${category}: ${count} controlled pictures`, 12, 25);
        ctx.font = "13px sans-serif";
        ctx.fillText(
          "Original, CC0, made by Ryan with Codex (GPT-6). Seed 7. Full images: 1024 px square.",
          12,
          46,
        );
        ctx.fillText(
          "Labels appear only here. Each sweep has seven levels; each grid has seven rows of seven.",
          12,
          64,
        );
      },
      { category, count: entries.length },
    );
    const hashes = [];
    for (const [index, entry] of entries.entries()) {
      const data = await page.evaluate(
        ({ entry, index }) => {
          const canvas = window.imageCanvas;
          const ctx = canvas.getContext("2d");
          ctx.reset();
          window.depthLabDraw(canvas, entry);
          const sheet = window.sheetCanvas.getContext("2d");
          sheet.imageSmoothingEnabled = true;
          sheet.imageSmoothingQuality = "high";
          const x = 8 + (index % 7) * 168;
          const y = 76 + Math.floor(index / 7) * 184;
          sheet.drawImage(canvas, x, y, 160, 160);
          sheet.fillStyle = "#222";
          sheet.font = "9px monospace";
          sheet.fillText(entry.id, x, y + 170, 160);
          const values = entry.variables.varying
            .split(",")
            .map((key) => `${key}=${entry.variables[key]}`)
            .join(" ");
          sheet.fillText(values, x, y + 181, 160);
          return canvas.toDataURL("image/png").split(",")[1];
        },
        { entry, index },
      );
      const bytes = Buffer.from(data, "base64");
      await writeFile(path.join(outDir, entry.file), bytes);
      hashes.push({
        id: entry.id,
        file: entry.file,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
    const sheet = await page.evaluate(
      () => window.sheetCanvas.toDataURL("image/jpeg", 0.9).split(",")[1],
    );
    await writeFile(sheetPath, Buffer.from(sheet, "base64"));
    // Generated evidence stays with the cached images, not in the shared asset lists.
    await writeFile(
      path.join(imageDir, "hashes.json"),
      JSON.stringify({ category, browser: browser.version(), seed: 7, entries: hashes }, null, 2) +
        "\n",
    );
    console.log(
      `${category}: ${entries.length} PNGs -> ${imageDir}; contact sheet -> ${sheetPath}`,
    );
  } finally {
    await browser.close();
  }
}

export const generate = (options = {}) => buildCategory("F", manifest, draw, options);
export default generate;

export async function runCli(moduleUrl, generateCategory) {
  if (!process.argv[1] || pathToFileURL(path.resolve(process.argv[1])).href !== moduleUrl) return;
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--check"))
    throw new Error("Usage: node tools/depth-lab/gen-<letter>.mjs [--check]");
  await generateCategory({ check: args.includes("--check") });
}

await runCli(import.meta.url, generate);
