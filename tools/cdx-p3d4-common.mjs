import fs from "node:fs";
import crypto from "node:crypto";
import { ALL_SAMPLES } from "../src/packs/photo-3d.js";
import { HARD_CASE_SAMPLES } from "../src/packs/hard-case-samples.js";
import { openR3, selectR3, screens } from "./cdx-p3d2-r3-common.mjs";
export { screens };
export async function selectR4(page, ...args) {
  await selectR3(page, ...args);
  await page.waitForFunction(
    () => !window.__splashery.player.proc?.ctx?.kit?.data?.photo?.backgroundPending,
    null,
    { timeout: 180000 },
  );
}
export function inputsR4() {
  const known = new Map(
    [...ALL_SAMPLES, ...HARD_CASE_SAMPLES].map((s) => [s.id, { ...s, builtin: true }]),
  );
  const extra = JSON.parse(fs.readFileSync(".cache/cdx-p3d2/r3/sources/manifest.json"));
  for (const s of extra.filter((s) => !s.file.endsWith(".gif")))
    known.set(s.id, { ...s, builtin: false });
  return [...known.values()];
}
export async function openR4(page, url, screen) {
  const routeRenderer = (route) =>
    screen.renderer === "webgl2"
      ? route.continue()
      : route.fulfill({
          status: 307,
          headers: {
            location: route
              .request()
              .url()
              .replace("renderer=webgl2", `renderer=${screen.renderer}`),
          },
        });
  if (screen.renderer) await page.route("**/?renderer=webgl2&profile=**", routeRenderer);
  const state = await openR3(page, url, screen);
  if (screen.renderer) await page.unroute("**/?renderer=webgl2&profile=**", routeRenderer);
  await page.evaluate(() => {
    const pl = window.__splashery.player;
    // Keep a paused audit pose alive through slow software-GPU frames. Product
    // state is otherwise allowed to expire after three stage update ticks.
    pl.stage.app.on("prerender", () => {
      if (pl.paused && pl.scene.toy.id === "photo-3d")
        pl.toyInfo.recipe.drive(0, { flat: 0, layers: 0 }, { parts: {} });
    });
  });
  return state;
}
export const renderFilesR4 = [
  "src/packs/photo-3d.js",
  "src/packs/photo-3d-core.js",
  "src/packs/photo-sharp.js",
  "src/photo3d/build-worker.js",
  "src/photo3d/prepare.js",
  "src/photo3d/background.js",
  "src/photo3d/depth-edges.js",
  "src/photo3d/surface.js",
  "src/photo-splats.js",
  "src/live/relief-mesh.js",
  "src/live/relief-height.js",
  "src/stage.js",
  "src/photo3d/preview.js",
  "src/photo3d/decode.js",
  "src/photo3d/decode-worker.js",
  "src/photo3d/border.js",
  "src/depth/engine.js",
  "src/packs/photo-3d-depth.js",
];
export async function fingerprintR4(url, files = renderFilesR4) {
  if (files === renderFilesR4) {
    files = [...files];
    for (const file of [
      "src/photo3d/texture-fill.js",
      "src/photo3d/plane-fill.js",
      "src/photo3d/background-regions.js",
      "src/photo3d/fill-guide.js",
      "src/photo3d/backing-grid.js",
      "src/photo3d/inpaint.js",
      "src/photo3d/inpaint-worker.js",
      "src/photo3d/occlusion-field.js",
      ".cache/photo-3d-r4/migan/migan.onnx",
      "src/depth/photo-position.js",
      "vendor/photo-depth-position/model.onnx",
      "vendor/photo-depth-position/positions.bin",
    ])
      if ((await fetch(new URL(file, url))).ok) files.push(file);
  }
  const hashes = {};
  for (const file of files) {
    const response = await fetch(new URL(file, url));
    if (!response.ok) throw new Error(`Missing served source: ${file}`);
    hashes[file] = crypto
      .createHash("sha256")
      .update(Buffer.from(await response.arrayBuffer()))
      .digest("hex");
  }
  return {
    files: hashes,
    hash: crypto.createHash("sha256").update(JSON.stringify(hashes)).digest("hex"),
  };
}
