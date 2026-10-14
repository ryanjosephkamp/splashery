#!/usr/bin/env node
// Task 75 part C. Code: MIT. Original pictures: CC0, made by Ryan with Codex (GPT-6).
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
const root = fileURLToPath(new URL("../../", import.meta.url));

export const category = "D";
const baseline = {
  lightAzimuthDeg: 225,
  lightElevationDeg: 45,
  falloffExponent: 1,
  ambient: 0.18,
  diffuse: 0.72,
  reversal: 0,
  shadingWeight: 1,
  castOpacity: 0,
  castBlurPx: 20,
  castOffsetPx: 140,
  castAngleDeg: 0,
  contactOpacity: 0,
  contactBlurPx: 8,
  contactWidthPx: 140,
  contactGapPx: 0,
};
const entries = [];
function add(series, config, varying, level) {
  const variables = { series, ...baseline, ...config };
  const id = `d-${series}-${level}`;
  const fixed = Object.fromEntries(
    Object.entries(variables).filter(([key]) => !varying.includes(key)),
  );
  entries.push({
    id,
    category,
    file: `d/${id}.png`,
    width: 1024,
    height: 1024,
    seed: 7,
    variables,
    controls: `Fixed: background gray 224; disc center (512,460), radius 200 px; seeded sub-byte dither; ${JSON.stringify(fixed)}. Vary only ${varying.join(" and ")}.`,
    expect: variables.shadingWeight
      ? "Under the intended convex-sphere interpretation, keep the silhouette and convex relief as illumination changes; shading alone does not determine unique depth."
      : "Keep the disc geometry fixed; interpret a shadow as a cue to support or separation, not a hole or raised patch on the ground; absolute depth is ambiguous.",
  });
}
function sweep(series, key, levels, config = {}) {
  levels.forEach((value, i) =>
    add(series, { ...config, [key]: value }, [key], `s${String(i + 1).padStart(2, "0")}`),
  );
}
sweep("sphere-azimuth", "lightAzimuthDeg", [0, 40, 80, 120, 160, 200, 240, 280, 320]);
sweep("sphere-elevation", "lightElevationDeg", [10, 20, 30, 45, 60, 75, 90]);
sweep("sphere-falloff", "falloffExponent", [0.25, 0.5, 0.75, 1, 1.5, 2, 3]);
sweep("sphere-ambient", "ambient", [0, 0.06, 0.12, 0.18, 0.22, 0.25, 0.28]);
sweep("sphere-diffuse", "diffuse", [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72]);
sweep("sphere-reversal", "reversal", [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1]);
const cast = { shadingWeight: 0, castOpacity: 0.45 };
sweep("cast-opacity", "castOpacity", [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6], cast);
sweep("cast-blur", "castBlurPx", [0, 4, 8, 16, 24, 40, 64], cast);
sweep("cast-offset", "castOffsetPx", [0, 40, 80, 120, 160, 200, 240], cast);
sweep("cast-direction", "castAngleDeg", [0, 40, 80, 120, 160, 200, 240, 280, 320], cast);
const contact = { shadingWeight: 0, contactOpacity: 0.55 };
sweep("contact-opacity", "contactOpacity", [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6], contact);
sweep("contact-blur", "contactBlurPx", [0, 2, 4, 8, 12, 20, 32], contact);
sweep("contact-width", "contactWidthPx", [60, 90, 120, 150, 180, 210, 240], contact);
sweep("contact-gap", "contactGapPx", [0, 8, 16, 24, 40, 64, 96], contact);
[0, 45, 90, 135, 180, 225, 270].forEach((azimuth, a) => {
  [10, 20, 30, 45, 60, 75, 90].forEach((elevation, e) => {
    add(
      "grid-light",
      { lightAzimuthDeg: azimuth, lightElevationDeg: elevation },
      ["lightAzimuthDeg", "lightElevationDeg"],
      `a${a + 1}e${e + 1}`,
    );
  });
});
[0, 0.15, 0.3, 0.45, 0.6].forEach((opacity, o) => {
  [0, 8, 16, 32, 64].forEach((blur, b) => {
    add(
      "grid-cast",
      { ...cast, castOpacity: opacity, castBlurPx: blur },
      ["castOpacity", "castBlurPx"],
      `o${o + 1}b${b + 1}`,
    );
  });
});
export const manifest = entries;

// Self-contained so build() can serialize this function into a fresh browser.
export function draw(ctx, entry) {
  const v = entry.variables;
  const radians = (deg) => (deg * Math.PI) / 180;
  ctx.reset();
  ctx.fillStyle = "rgb(224,224,224)";
  ctx.fillRect(0, 0, 1024, 1024);
  function shadow(x, y, rx, ry, opacity, blur) {
    if (!opacity) return;
    ctx.save();
    ctx.filter = `blur(${blur}px)`;
    ctx.fillStyle = `rgba(0,0,0,${opacity})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const angle = radians(v.castAngleDeg);
  shadow(
    512 + v.castOffsetPx * Math.cos(angle),
    660 + v.castOffsetPx * Math.sin(angle),
    190,
    48,
    v.castOpacity,
    v.castBlurPx,
  );
  shadow(512, 660 + v.contactGapPx, v.contactWidthPx / 2, 14, v.contactOpacity, v.contactBlurPx);
  const az = radians(v.lightAzimuthDeg),
    el = radians(v.lightElevationDeg);
  const light = [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)];
  const image = ctx.createImageData(402, 402);
  for (let y = 0; y < 402; y++)
    for (let x = 0; x < 402; x++) {
      const nx = (x - 200.5) / 200,
        ny = (y - 200.5) / 200;
      const radius = Math.hypot(nx, ny);
      const index = (y * 402 + x) * 4;
      if (radius >= 1.0025) continue;
      const nz = Math.sqrt(Math.max(0, 1 - radius * radius));
      const lambert = Math.pow(
        Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]),
        v.falloffExponent,
      );
      const intensity =
        v.ambient + v.diffuse * ((1 - v.reversal) * lambert + v.reversal * (1 - lambert));
      // Pixel-coordinate hash makes dither reproducible with seed 7, independent of order.
      const hash =
        Math.imul((x + 312) ^ Math.imul(y + 260, 374761393) ^ entry.seed, 668265263) >>> 0;
      const dither = (hash / 4294967296 - 0.5) * 0.7;
      const gray = Math.round(
        150 * (1 - v.shadingWeight) + 255 * intensity * v.shadingWeight + dither,
      );
      image.data[index] = image.data[index + 1] = image.data[index + 2] = gray;
      image.data[index + 3] = Math.round(255 * Math.max(0, Math.min(1, (1.0025 - radius) * 200)));
    }
  const disc = document.createElement("canvas");
  disc.width = disc.height = 402;
  disc.getContext("2d").putImageData(image, 0, 0);
  ctx.drawImage(disc, 311, 259);
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
