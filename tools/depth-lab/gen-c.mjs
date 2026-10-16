// Task 75, part B. Code: MIT. Original pictures: CC0, made by Ryan with Codex (GPT-6).
// node tools/depth-lab/gen-c.mjs --manifest writes the recipe manifest.
// SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-c.mjs builds C.
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { root, registration, entry, buildCategory } from "./gen-b.mjs";

export function createManifest() {
  const rows = [];
  const expect =
    "The graphic lies on one flat plane; silhouette, fill, size, position, and edge softness alone do not determine 3D shape.";
  const base = {
    ...registration(),
    backgroundRgb: [240, 240, 240],
    shape: "circle",
    fill: "filled",
    sizePx: 384,
    outlineWidthPx: 8,
    contrast: 0.8,
    hueDeg: null,
    blurSigmaPx: 0,
    angleDeg: 0,
    lineJoin: "miter",
    miterLimit: 10,
  };
  const sweeps = {
    sizePx: [64, 128, 192, 256, 384, 512, 640],
    centerX: [224, 288, 384, base.centerX, 640, 736, 800],
    centerY: [224, 288, 384, base.centerY, 640, 736, 800],
    blurSigmaPx: [0, 0.5, 1, 2, 4, 8, 12],
    contrast: [0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 0.95],
  };
  for (const shape of ["circle", "square", "triangle"]) {
    for (const fill of ["filled", "outlined"]) {
      for (const [key, levels] of Object.entries(sweeps)) {
        for (const value of levels) {
          rows.push(
            entry(
              "C",
              `c-${shape}-${fill}-${key}-${value}`,
              { ...base, shape, fill, [key]: value },
              [key],
              expect,
            ),
          );
        }
      }
      if (fill === "outlined") {
        for (const outlineWidthPx of [1, 2, 4, 8, 16, 32, 64]) {
          rows.push(
            entry(
              "C",
              `c-${shape}-outlineWidthPx-${outlineWidthPx}`,
              { ...base, shape, fill, outlineWidthPx },
              ["outlineWidthPx"],
              expect,
            ),
          );
        }
      }
    }
    // Three independent 5 x 5 grids: size versus edge softness, one per silhouette.
    for (const sizePx of [64, 128, 256, 384, 640]) {
      for (const blurSigmaPx of [0, 1, 2, 4, 8]) {
        rows.push(
          entry(
            "C",
            `c-${shape}-grid-s${sizePx}-blur${blurSigmaPx}`,
            { ...base, shape, sizePx, blurSigmaPx },
            ["sizePx", "blurSigmaPx"],
            expect,
          ),
        );
      }
    }
  }
  return rows;
}

export function draw(ctx, row) {
  const v = row.variables;
  ctx.translate(v.centerX, v.centerY);
  ctx.rotate((v.angleDeg * Math.PI) / 180);
  ctx.fillStyle = ctx.strokeStyle = `rgb(${row.foregroundRgb.join(",")})`;
  ctx.lineWidth = v.outlineWidthPx;
  ctx.lineJoin = v.lineJoin;
  ctx.miterLimit = v.miterLimit;
  ctx.beginPath();
  const radius = v.sizePx / 2;
  if (v.shape === "circle") {
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
  } else if (v.shape === "square") {
    ctx.rect(-radius, -radius, v.sizePx, v.sizePx);
  } else {
    // Equilateral triangle, bounding-box center at the registration point.
    const halfHeight = (Math.sqrt(3) * v.sizePx) / 4;
    ctx.moveTo(0, -halfHeight);
    ctx.lineTo(radius, halfHeight);
    ctx.lineTo(-radius, halfHeight);
    ctx.closePath();
  }
  if (v.fill === "filled") ctx.fill();
  else ctx.stroke();
}

export async function build() {
  return buildCategory("c", createManifest(), draw);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] === "--manifest") {
    await writeFile(
      resolve(root, "tools/depth-lab/c.json"),
      `${JSON.stringify(createManifest(), null, 2)}\n`,
    );
  } else if (process.argv.length === 2) {
    await build();
  } else {
    throw new Error("Usage: node tools/depth-lab/gen-c.mjs [--manifest]");
  }
}
