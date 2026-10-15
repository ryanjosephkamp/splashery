#!/usr/bin/env node
// Task 75 part C. Code: MIT. Original pictures: CC0, made by Ryan with Codex (GPT-6).
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
const root = fileURLToPath(new URL("../../", import.meta.url));

export const category = "E";
const baseline = {
  mode: "pair",
  backShape: "circle",
  frontShape: "circle",
  overlap: 0.5,
  backGray: 100,
  frontGray: 170,
  edgeBlurPx: 0,
  frontRotationDeg: 0,
  frontScale: 1,
  frontShiftYPx: 0,
  tGapPx: 0,
  tBarThicknessPx: 80,
  tOverhangPx: 80,
  tRotationDeg: 0,
  stackOrder: "012",
};
const entries = [];
function add(series, config, varying, level) {
  const variables = { series, ...baseline, ...config };
  const id = `e-${series}-${level}`;
  const fixed = Object.fromEntries(
    Object.entries(variables).filter(([key]) => !varying.includes(key)),
  );
  entries.push({
    id,
    category,
    file: `e/${id}.png`,
    width: 1024,
    height: 1024,
    seed: 7,
    variables,
    controls: `Fixed: background gray 224; pair bounding half-size 200 px, midpoint (512,512); no texture or shadows; ${JSON.stringify(fixed)}. Vary only ${varying.join(" and ")}.`,
    expect:
      variables.mode === "stack"
        ? "Recover the visible local front-to-back order from occlusion boundaries; keep each flat shape coherent; hidden geometry and depth spacing remain unknown."
        : variables.mode === "t"
          ? "Where the stem meets a continuous bar edge, place the bar in front; a gap or absent overhang weakens that cue; absolute depth is unknown."
          : "Where silhouettes overlap and form T-junctions, place the drawn front shape before the back shape; absent overlap provides no occlusion order or metric depth.",
  });
}
function sweep(series, key, levels, config = {}) {
  levels.forEach((value, i) =>
    add(series, { ...config, [key]: value }, [key], `s${String(i + 1).padStart(2, "0")}`),
  );
}
const levels = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1];
sweep("pair-circles", "overlap", levels);
sweep("pair-circle-square", "overlap", levels, { frontShape: "square" });
sweep("pair-squares", "overlap", levels, { backShape: "square", frontShape: "square" });
sweep("pair-triangle-circle", "overlap", levels, { backShape: "triangle" });
sweep("pair-front-gray", "frontGray", [40, 70, 100, 130, 160, 190, 220]);
sweep("pair-back-gray", "backGray", [40, 70, 100, 130, 160, 190, 220]);
sweep("pair-edge-blur", "edgeBlurPx", [0, 1, 2, 4, 8, 16, 32]);
sweep("pair-rotation", "frontRotationDeg", [0, 15, 30, 45, 60, 75, 90], { frontShape: "square" });
sweep("pair-front-scale", "frontScale", [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
sweep("pair-height", "frontShiftYPx", [-180, -120, -60, 0, 60, 120, 180]);
const t = { mode: "t", backGray: 100, frontGray: 170 };
sweep("t-gap", "tGapPx", [0, 4, 8, 16, 32, 64, 96], t);
sweep("t-thickness", "tBarThicknessPx", [24, 48, 72, 96, 120, 144, 168], t);
sweep("t-overhang", "tOverhangPx", [0, 20, 40, 60, 80, 100, 120], t);
sweep("t-orientation", "tRotationDeg", [0, 30, 60, 90, 120, 150, 180], t);
sweep("t-contrast", "frontGray", [100, 115, 130, 145, 160, 175, 190], t);
sweep("stack-order", "stackOrder", ["012", "021", "102", "120", "201", "210"], { mode: "stack" });
levels.forEach((overlap, o) => {
  [100, 115, 130, 145, 160, 175, 190].forEach((gray, g) => {
    add(
      "grid-overlap-contrast",
      { overlap, frontGray: gray },
      ["overlap", "frontGray"],
      `o${o + 1}c${g + 1}`,
    );
  });
});
[0, 30, 60, 90, 120].forEach((overhang, o) => {
  [24, 60, 96, 132, 168].forEach((thickness, tIndex) => {
    add(
      "grid-t",
      { ...t, tOverhangPx: overhang, tBarThicknessPx: thickness },
      ["tOverhangPx", "tBarThicknessPx"],
      `o${o + 1}t${tIndex + 1}`,
    );
  });
});
export const manifest = entries;

export function draw(ctx, entry) {
  const v = entry.variables;
  ctx.reset();
  ctx.fillStyle = "rgb(224,224,224)";
  ctx.fillRect(0, 0, 1024, 1024);
  function shape(kind, x, y, r, gray, rotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.filter = `blur(${v.edgeBlurPx}px)`;
    ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
    ctx.beginPath();
    if (kind === "circle") ctx.arc(0, 0, r, 0, Math.PI * 2);
    else if (kind === "square") ctx.rect(-r, -r, 2 * r, 2 * r);
    else {
      ctx.moveTo(0, -r);
      ctx.lineTo(r, r);
      ctx.lineTo(-r, r);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }
  if (v.mode === "pair") {
    // Fraction of the base bounding width overlapped horizontally; not area overlap.
    const distance = 400 * (1 - v.overlap);
    shape(v.backShape, 512 - distance / 2, 512, 200, v.backGray);
    shape(
      v.frontShape,
      512 + distance / 2,
      512 + v.frontShiftYPx,
      200 * v.frontScale,
      v.frontGray,
      v.frontRotationDeg,
    );
  } else if (v.mode === "t") {
    ctx.save();
    ctx.translate(512, 512);
    ctx.rotate((v.tRotationDeg * Math.PI) / 180);
    const height = v.tBarThicknessPx,
      stemWidth = 80;
    ctx.fillStyle = `rgb(${v.backGray},${v.backGray},${v.backGray})`;
    // Keep the stem endpoint at y=280. Only its meeting with the bar changes.
    const top = height / 2 + v.tGapPx;
    ctx.fillRect(-stemWidth / 2, top, stemWidth, 280 - top);
    ctx.fillStyle = `rgb(${v.frontGray},${v.frontGray},${v.frontGray})`;
    // Overhang controls both bar ends; zero collapses the T into a straight strip.
    ctx.fillRect(
      -(stemWidth + 2 * v.tOverhangPx) / 2,
      -height / 2,
      stemWidth + 2 * v.tOverhangPx,
      height,
    );
    ctx.restore();
  } else {
    const shapes = [
      ["circle", 420, 430, 190, 80],
      ["square", 600, 450, 180, 140],
      ["triangle", 512, 650, 190, 195],
    ];
    for (const index of v.stackOrder) shape(...shapes[Number(index)]);
  }
}

// The same small runner lives in each part C module to avoid owning shared files.
// A future tools/depth-lab/build.mjs can call the default export or build().
export async function build({
  outputDir = path.join(root, ".cache/depth-lab", category.toLowerCase()),
  contactSheet = path.join(root, "docs/audits/depth-lab", `${category.toLowerCase()}.jpg`),
  writeManifest = false,
} = {}) {
  const manifestFile = path.join(root, "tools/depth-lab", `${category.toLowerCase()}.json`);
  if (writeManifest) {
    await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  } else {
    const recorded = JSON.parse(await fs.readFile(manifestFile, "utf8"));
    if (JSON.stringify(recorded) !== JSON.stringify(manifest)) {
      throw new Error("Manifest differs from the generator; review --manifest changes first.");
    }
  }
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.dirname(contactSheet), { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  });
  try {
    const page = await browser.newPage();
    await page.setContent('<canvas id="picture" width="1024" height="1024"></canvas>');
    await page.evaluate(`window.drawDepthLab = (${draw.toString()})`);
    const columns = 8,
      tile = 184,
      cellHeight = 220,
      header = 54;
    await page.evaluate(
      ({ columns, tile, cellHeight, header, count, category }) => {
        const sheet = document.createElement("canvas");
        sheet.id = "sheet";
        sheet.width = columns * tile;
        sheet.height = header + Math.ceil(count / columns) * cellHeight;
        document.body.append(sheet);
        const ctx = sheet.getContext("2d");
        ctx.fillStyle = "#eeeeee";
        ctx.fillRect(0, 0, sheet.width, sheet.height);
        ctx.fillStyle = "#111111";
        ctx.font = "18px sans-serif";
        ctx.fillText(`Depth lab ${category} | ${count} pictures | seed 7 | original CC0`, 8, 24);
        ctx.font = "13px sans-serif";
        ctx.fillText(
          "Made by Ryan with Codex (GPT-6). Labels are outside the test pictures.",
          8,
          44,
        );
      },
      { columns, tile, cellHeight, header, count: manifest.length, category },
    );
    for (const [index, entry] of manifest.entries()) {
      const encoded = await page.evaluate(
        ({ entry, index, columns, tile, cellHeight, header }) => {
          const canvas = document.querySelector("#picture");
          window.drawDepthLab(canvas.getContext("2d"), entry);
          const ctx = document.querySelector("#sheet").getContext("2d");
          const x = (index % columns) * tile;
          const y = header + Math.floor(index / columns) * cellHeight;
          ctx.drawImage(canvas, x + 4, y, tile - 8, tile - 8);
          ctx.fillStyle = "#111111";
          ctx.font = "10px monospace";
          const short = entry.id.split("-");
          ctx.fillText(short.slice(0, -1).join("-"), x + 4, y + tile + 1);
          ctx.fillText(short.at(-1), x + 4, y + tile + 16);
          return canvas.toDataURL("image/png").split(",")[1];
        },
        { entry, index, columns, tile, cellHeight, header },
      );
      await fs.writeFile(
        path.join(outputDir, path.basename(entry.file)),
        Buffer.from(encoded, "base64"),
      );
    }
    const sheet = await page.evaluate(
      () => document.querySelector("#sheet").toDataURL("image/jpeg", 0.9).split(",")[1],
    );
    await fs.writeFile(contactSheet, Buffer.from(sheet, "base64"));
    console.log(
      `${category}: ${manifest.length} PNGs -> ${outputDir}; contact sheet -> ${contactSheet}`,
    );
    return manifest;
  } finally {
    await browser.close();
  }
}

export default build;
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--manifest")) {
    throw new Error(`Usage: node tools/depth-lab/gen-${category.toLowerCase()}.mjs [--manifest]`);
  }
  await build({ writeManifest: args.includes("--manifest") });
}
