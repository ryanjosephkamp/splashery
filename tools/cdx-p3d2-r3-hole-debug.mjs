// Diagnose clear pixels without excluding borders or changing the renderer.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "@playwright/test";
import config from "../playwright.config.mjs";
import { inputs, screens, openR3, selectR3, poseR3 } from "./cdx-p3d2-r3-common.mjs";
import { decode, holesR3 } from "./cdx-p3d2-r3-measure.mjs";

const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const out = opt("out", ".cache/cdx-p3d2/r3/hole-debug-lighthouse");
const url = opt("url", "http://127.0.0.1:4177/");
const build = JSON.parse(fs.readFileSync(".cache/cdx-p3d2/r3/builds.json")).after;
for (const [file, hash] of Object.entries(build.files)) {
  const response = await fetch(new URL(file, url));
  const actual = crypto
    .createHash("sha256")
    .update(Buffer.from(await response.arrayBuffer()))
    .digest("hex");
  if (!response.ok || actual !== hash) throw new Error(`Browser source changed: ${file}`);
}
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(config.use.launchOptions);
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await openR3(page, url, screens.phone);
  const entry = inputs().find((s) => s.id === opt("sample", "lighthouse"));
  await selectR3(page, entry, 1, "sharp");
  const shot = await poseR3(page, Number(opt("yaw", 30)), Number(opt("pitch", 0)));
  const png = decode(shot.image);
  fs.writeFileSync(path.join(out, "frame.png"), Buffer.from(shot.image.split(",")[1], "base64"));
  const actualMeshBorder = await page.evaluate(async () => {
    const pl = window.__splashery.player;
    const { Vec3 } = await import("/src/pc.js");
    const mi = pl.stage.app.scene.layers
      .getLayerByName("World")
      .meshInstances.find(
        (m) => m.material.getParameter("uDepth") && m.material.getParameter("uLayer").data[2] === 0,
      );
    const grid = mi.material.getParameter("uGrid").data;
    const lift = mi.material.getParameter("uLift").data;
    const texture = mi.material.getParameter("uSoftDepth").data;
    const data = texture._levels[0],
      w = texture.width,
      h = texture.height;
    const sample = (u, v) => {
      const x = Math.max(0, Math.min(w - 1, u * w - 0.5));
      const y = Math.max(0, Math.min(h - 1, v * h - 0.5));
      const i = Math.floor(x),
        j = Math.floor(y),
        fx = x - i,
        fy = y - j;
      const i1 = Math.min(w - 1, i + 1),
        j1 = Math.min(h - 1, j + 1);
      return (
        ((data[j * w + i] * (1 - fx) + data[j * w + i1] * fx) * (1 - fy) +
          (data[j1 * w + i] * (1 - fx) + data[j1 * w + i1] * fx) * fy) /
        255
      );
    };
    const projectBorder = (counts, native) => {
      const points = [];
      for (let side = 0; side < 4; side++) {
        const count = counts[side % 2];
        for (let i = 0; i < count; i++) {
          const t = i / count;
          const [u, v] =
            side === 0 ? [t, 0] : side === 1 ? [1, t] : side === 2 ? [1 - t, 1] : [0, 1 - t];
          const U = native ? Math.fround(u) : u,
            V = native ? Math.fround(v) : v;
          const world = new Vec3(
            ...pl.fromRecipe([(U - 0.5) * grid[0], 0.5 - V, lift[0] * (sample(U, V) - lift[1])]),
          );
          const p = pl.stage.cameraEntity.camera.camera.worldToScreen(
            world,
            pl.stage.canvas.width,
            pl.stage.canvas.height,
          );
          points.push([p.x, p.y]);
        }
      }
      return points;
    };
    return {
      grid: Array.from(grid),
      points: projectBorder([grid[2], grid[3]], true),
      coarse: projectBorder([32, 32], false),
    };
  });
  const originalBorder = actualMeshBorder.coarse;
  const clearPixels = [];
  for (let y = 0; y < png.height; y++) {
    const hits = [];
    for (let i = 0; i < originalBorder.length; i++) {
      const a = originalBorder[i],
        b = originalBorder[(i + 1) % originalBorder.length];
      if (a[1] > y + 0.5 !== b[1] > y + 0.5)
        hits.push(a[0] + ((y + 0.5 - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2)
      for (
        let x = Math.max(0, Math.ceil(hits[i] - 0.5));
        x < png.width && x + 0.5 < hits[i + 1];
        x++
      ) {
        const p = (y * png.width + x) * 4;
        if (png.data[p] >= 5 || png.data[p + 1] <= 250 || png.data[p + 2] >= 5) continue;
        let distance = Infinity;
        for (let j = 0; j < originalBorder.length; j++) {
          const a = originalBorder[j],
            b = originalBorder[(j + 1) % originalBorder.length];
          const dx = b[0] - a[0],
            dy = b[1] - a[1];
          const t = Math.max(
            0,
            Math.min(1, ((x + 0.5 - a[0]) * dx + (y + 0.5 - a[1]) * dy) / (dx * dx + dy * dy || 1)),
          );
          distance = Math.min(
            distance,
            Math.hypot(x + 0.5 - a[0] - t * dx, y + 0.5 - a[1] - t * dy),
          );
        }
        clearPixels.push({ x, y, distance });
      }
  }
  const result = {
    build,
    sample: entry.id,
    yaw: Number(opt("yaw", 30)),
    pitch: Number(opt("pitch", 0)),
    buffer: [png.width, png.height],
    original: holesR3(png, originalBorder),
    meshResolutionFootprint: holesR3(png, actualMeshBorder.points),
    originalBorder,
    actualMeshBorder,
    clearPixels,
    borderDistanceBins: [0.5, 1, 2, 5].map((limit) => ({
      within: limit,
      pixels: clearPixels.filter((p) => p.distance <= limit).length,
    })),
    errors,
  };
  fs.writeFileSync(path.join(out, "result.json"), JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      {
        ...result,
        originalBorder: undefined,
        actualMeshBorder: { grid: actualMeshBorder.grid, points: actualMeshBorder.points.length },
        clearPixels: undefined,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
