// Task 75, part B. Code: MIT. Original pictures: CC0, made by Ryan with Codex (GPT-6).
// node tools/depth-lab/gen-b.mjs --manifest writes the recipe manifest.
// SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-b.mjs builds B.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const seed = 7;

// Mulberry32. The seed selects one fixed subpixel registration for all sweeps.
export function registration(value = seed) {
  let state = value >>> 0;
  const next = () => {
    let t = (state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { centerX: 512 + Math.round(next() * 4) / 4, centerY: 512 + Math.round(next() * 4) / 4 };
}

// Contrast = (background Y - foreground Y) / background Y, in linear sRGB.
// Color sweeps hold Y fixed; RGB channel changes implement hue, not contrast.
export function ink(contrast, hueDeg) {
  const backgroundY = ((240 / 255 + 0.055) / 1.055) ** 2.4;
  const targetY = backgroundY * (1 - contrast);
  const wave = [0, 120, 240].map((phase) => Math.cos((((hueDeg ?? 0) + phase) * Math.PI) / 180));
  const mean = wave[0] * 0.2126 + wave[1] * 0.7152 + wave[2] * 0.0722;
  return wave.map((value) => {
    const linear = targetY + (hueDeg === null ? 0 : (value - mean) * 0.06);
    const srgb = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255);
  });
}

export function entry(category, id, variables, varied, expect) {
  const fixed = Object.fromEntries(
    Object.entries(variables).filter(([key]) => !varied.includes(key)),
  );
  return {
    id,
    category,
    file: `${category.toLowerCase()}/${id}.png`,
    width: 1024,
    height: 1024,
    seed,
    variables,
    controls: `Vary ${varied.join(" and ")}; hold fixed ${JSON.stringify(fixed)}. Foreground RGB is derived from contrast and hue; antialiasing is Chromium Canvas 2D; no shadows, texture, or perspective.`,
    expect,
  };
}

export function createManifest() {
  const rows = [];
  const expect =
    "All marks lie on one flat plane; width, color, blur, orientation, and joins do not establish depth.";
  const base = {
    ...registration(),
    backgroundRgb: [240, 240, 240],
    geometry: "segment",
    lineWidthPx: 8,
    contrast: 0.8,
    hueDeg: null,
    angleDeg: 0,
    blurSigmaPx: 0,
    lineCount: 1,
    lengthPx: 480,
    spacingPx: 64,
    lineCap: "butt",
    lineJoin: "miter",
    joinAngleDeg: 90,
    miterLimit: 10,
  };
  const sweeps = {
    lineWidthPx: [1, 2, 4, 8, 16, 32, 64],
    contrast: [0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 0.95],
    hueDeg: [null, 0, 45, 90, 135, 180, 225, 270],
    angleDeg: [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180],
    blurSigmaPx: [0, 0.5, 1, 2, 4, 8, 12],
    lineCount: [1, 2, 3, 4, 5, 6, 7],
    lengthPx: [64, 128, 192, 256, 384, 480, 640],
  };
  for (const geometry of ["segment", "corner"]) {
    for (const [key, levels] of Object.entries(sweeps)) {
      for (const value of levels) {
        rows.push(
          entry(
            "B",
            `b-${geometry}-${key}-${value ?? "gray"}`,
            { ...base, geometry, [key]: value },
            [key],
            expect,
          ),
        );
      }
    }
  }
  // A 3 x 7 grid isolates join style and interior angle at a readable stroke width.
  for (const lineJoin of ["miter", "round", "bevel"]) {
    for (const joinAngleDeg of [30, 45, 60, 90, 120, 135, 150]) {
      rows.push(
        entry(
          "B",
          `b-join-${lineJoin}-${joinAngleDeg}`,
          { ...base, geometry: "corner", lineWidthPx: 32, lineJoin, joinAngleDeg },
          ["lineJoin", "joinAngleDeg"],
          expect,
        ),
      );
    }
  }
  // A second, small grid checks thin-line/low-contrast interactions.
  for (const lineWidthPx of [1, 2, 4, 8, 16]) {
    for (const contrast of [0.05, 0.1, 0.2, 0.4, 0.8]) {
      rows.push(
        entry(
          "B",
          `b-grid-w${lineWidthPx}-c${contrast}`,
          { ...base, lineWidthPx, contrast },
          ["lineWidthPx", "contrast"],
          expect,
        ),
      );
    }
  }
  return rows;
}

// This function is serialized into Chromium; keep it free of Node dependencies.
export function draw(ctx, row) {
  const v = row.variables;
  ctx.lineWidth = v.lineWidthPx;
  ctx.lineCap = v.lineCap;
  ctx.lineJoin = v.lineJoin;
  ctx.miterLimit = v.miterLimit;
  ctx.strokeStyle = `rgb(${row.foregroundRgb.join(",")})`;
  ctx.translate(v.centerX, v.centerY);
  ctx.rotate((v.angleDeg * Math.PI) / 180);
  for (let i = 0; i < v.lineCount; i++) {
    const y = (i - (v.lineCount - 1) / 2) * v.spacingPx;
    ctx.beginPath();
    if (v.geometry === "segment") {
      ctx.moveTo(-v.lengthPx / 2, y);
      ctx.lineTo(v.lengthPx / 2, y);
    } else {
      const halfAngle = (v.joinAngleDeg * Math.PI) / 360;
      const x = (Math.sin(halfAngle) * v.lengthPx) / 2;
      const h = (Math.cos(halfAngle) * v.lengthPx) / 2;
      ctx.moveTo(-x, y - h / 2);
      ctx.lineTo(0, y + h / 2);
      ctx.lineTo(x, y - h / 2);
    }
    ctx.stroke();
  }
}

// Shared only between this part's two generators. No site code or new dependency.
export async function buildCategory(letter, recipe, paint) {
  const manifestPath = resolve(root, `tools/depth-lab/${letter}.json`);
  const rows = JSON.parse(await readFile(manifestPath, "utf8"));
  if (JSON.stringify(rows) !== JSON.stringify(recipe))
    throw new Error(`Stale ${letter}.json: run gen-${letter}.mjs --manifest.`);
  const output = resolve(root, `.cache/depth-lab/${letter}`);
  const sheetPath = resolve(root, `docs/audits/depth-lab/${letter}.jpg`);
  await mkdir(output, { recursive: true });
  await mkdir(dirname(sheetPath), { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.evaluate((source) => {
      window.paint = (0, eval)(`(${source})`);
    }, paint.toString());
    const columns = 8,
      tileWidth = 184,
      tileHeight = 218;
    await page.evaluate(
      ({ columns, tileWidth, tileHeight, count, letter }) => {
        window.sheet = document.createElement("canvas");
        sheet.width = columns * tileWidth;
        sheet.height = Math.ceil(count / columns) * tileHeight + 48;
        const ctx = sheet.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sheet.width, sheet.height);
        ctx.fillStyle = "#111111";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(`Depth lab ${letter.toUpperCase()} | ${count} cases | seed 7 | CC0`, 12, 30);
      },
      { columns, tileWidth, tileHeight, count: rows.length, letter },
    );
    for (const [index, row] of rows.entries()) {
      const png = await page.evaluate(
        async ({ row, foregroundRgb, index, columns, tileWidth, tileHeight }) => {
          const canvas = document.createElement("canvas");
          canvas.width = row.width;
          canvas.height = row.height;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = `rgb(${row.variables.backgroundRgb.join(",")})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const layer = document.createElement("canvas");
          layer.width = canvas.width;
          layer.height = canvas.height;
          window.paint(layer.getContext("2d"), { ...row, foregroundRgb });
          ctx.filter = `blur(${row.variables.blurSigmaPx}px)`;
          ctx.drawImage(layer, 0, 0);
          const url = canvas.toDataURL("image/png");
          // Decode the PNG for the contact sheet: the sheet previews the saved pixels.
          const img = new Image();
          img.src = url;
          await img.decode();
          const s = sheet.getContext("2d");
          const x = (index % columns) * tileWidth,
            y = Math.floor(index / columns) * tileHeight + 48;
          s.drawImage(img, x + 12, y, 160, 160);
          s.fillStyle = "#111111";
          s.font = "10px monospace";
          const label = row.id.match(/.{1,27}/g);
          label.forEach((part, line) => s.fillText(part, x + 6, y + 174 + line * 12));
          s.fillText(String(index + 1).padStart(3, "0"), x + 6, y + 210);
          return url.split(",")[1];
        },
        {
          row,
          foregroundRgb: ink(row.variables.contrast, row.variables.hueDeg),
          index,
          columns,
          tileWidth,
          tileHeight,
        },
      );
      await writeFile(resolve(output, `${row.id}.png`), Buffer.from(png, "base64"));
    }
    const jpg = await page.evaluate(() => sheet.toDataURL("image/jpeg", 0.9).split(",")[1]);
    await writeFile(sheetPath, Buffer.from(jpg, "base64"));
    console.log(
      `${letter.toUpperCase()}: ${rows.length} PNGs in .cache/depth-lab/${letter}/; contact sheet docs/audits/depth-lab/${letter}.jpg`,
    );
  } finally {
    await browser.close();
  }
}

export async function build() {
  return buildCategory("b", createManifest(), draw);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] === "--manifest") {
    await writeFile(
      resolve(root, "tools/depth-lab/b.json"),
      `${JSON.stringify(createManifest(), null, 2)}\n`,
    );
  } else if (process.argv.length === 2) {
    await build();
  } else {
    throw new Error("Usage: node tools/depth-lab/gen-b.mjs [--manifest]");
  }
}
