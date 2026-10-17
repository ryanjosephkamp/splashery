// Render the real panorama recipe on the normal WebGL2 stage against held-out truth.
// Cached depth replaces only the sample asset response; no renderer or recipe is mocked.
import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import jpeg from "jpeg-js";
import { packDepth } from "../src/pano3d/samples.js";
import { maskedSSIM } from "./pano-metrics.mjs";
const root = process.cwd(),
  out = path.resolve(process.env.SPLASHERY_PANO_EVIDENCE || ".cache/pano3d/evidence");
const port = Number(process.env.SPLASHERY_PANO_PORT) || 4189;
const base = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["tools/cdx-mp2-server.mjs", String(port)], {
  stdio: "ignore",
});
for (let i = 0; i < 100; i++) {
  try {
    await fetch(base);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 100));
  }
}
const llvmpipe = process.env.SPLASHERY_GL === "llvmpipe";
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  headless: !llvmpipe,
  args: [
    "--no-sandbox",
    ...(llvmpipe
      ? ["--use-gl=angle", "--use-angle=gl", "--hide-scrollbars"]
      : ["--use-angle=swiftshader"]),
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const scores = JSON.parse(await fs.readFile(path.join(out, "scores.json"), "utf8"));
const results = {
  createdUTC: new Date().toISOString(),
  pipelineHash: scores.pipelineHash,
  note: "Actual low-profile product recipe, Kit, and WebGL2 stage at 256×256, DSF 1. Sample responses replaced with the same input panorama and cached per-method globally calibrated depth. The truth-projection control uses exact depth. Fixed source-visible masks are shared with the software diagnostic. All methods clip radial distance to 200 m before the shared 16-bit cache encoding, avoiding out-of-range sky disparities dominating quantization. No hidden surface pixels are removed based on a prediction.",
  graphics: llvmpipe ? "llvmpipe" : "swiftshader",
  source: {},
  scenes: [],
};
for (const f of [
  "src/pano3d/toy.js",
  "src/pano3d/core.js",
  "src/pano3d/pipeline.js",
  "src/pano3d/prior.js",
  "src/stage.js",
  "src/kit.js",
  "tools/pano-gpu-views.mjs",
])
  results.source[f] = crypto
    .createHash("sha256")
    .update(await fs.readFile(f))
    .digest("hex");
try {
  for (const row of scores.scenes) {
    const dir = path.join(process.env.SPLASHERY_PANO_TRUTH || ".cache/pano3d/truth", row.id);
    const photo = await fs.readFile(dir + "/pano.jpg");
    const inference = JSON.parse(
      await fs.readFile(path.join(out, row.id + "-inference.json"), "utf8"),
    );
    if (inference.pipelineHash !== scores.pipelineHash)
      throw new Error("Stale inference: " + row.id);
    const truthBytes = await fs.readFile(dir + "/radial.f32");
    const truth = new Float32Array(
      truthBytes.buffer.slice(truthBytes.byteOffset, truthBytes.byteOffset + truthBytes.byteLength),
    );
    const depths = {
      spherical: {
        ...inference.result.depth,
        d: Float32Array.from(inference.result.depth.d, (v) => v * row.scale),
      },
      naive: {
        ...inference.naive,
        d: Float32Array.from(inference.naive.d, (v) => row.naiveScale / Math.max(1e-6, v)),
      },
      truthProjection: { w: 384, h: 192, d: Float32Array.from(truth, (v) => (v > 0 ? v : 30)) },
    };
    const result = { id: row.id, novel: { 0.3: {}, 0.8: {} } };
    for (const [method, depth] of Object.entries(depths)) {
      const context = await browser.newContext({
        viewport: { width: 256, height: 256 },
        deviceScaleFactor: 1,
      });
      try {
        await context.route("**/assets/toys/step-inside-360/room.jpg", (r) =>
          r.fulfill({ contentType: "image/jpeg", body: photo }),
        );
        await context.route("**/assets/toys/step-inside-360/room.depth", (r) =>
          r.fulfill({
            contentType: "application/octet-stream",
            body: Buffer.from(
              packDepth({
                ...depth,
                d: Float32Array.from(depth.d, (v) => Math.max(0.001, Math.min(200, v))),
              }),
            ),
          }),
        );
        const page = await context.newPage();
        await page.goto(base + "/?labs=1&renderer=webgl2&profile=low&adapt=off");
        await page.waitForSelector("body[data-ready=true]");
        await page.evaluate(() => window.__splashery.app.chooseToy("step-inside-360"));
        await page.waitForFunction(
          () =>
            window.__splashery.player.toyInfo?.recipe?.inside && !window.__splashery.player.loading,
        );
        for (const offset of [0.3, 0.8]) {
          const shot = await page.evaluate(async (offset) => {
            const p = window.__splashery.player,
              camera = p.camera;
            p.stage.setFixedSize([256, 256]);
            camera.cur.distance = camera.tgt.distance = camera.home.distance;
            camera.cur.roll = camera.tgt.roll = 0;
            document.querySelector("#pano-home").click();
            camera.cur.yaw = camera.tgt.yaw = 0;
            camera.cur.pitch = camera.tgt.pitch = 0;
            if (offset === 0.3) {
              document.querySelector("#pano-right").click();
              document.querySelector("#pano-right").click();
            } else {
              for (let i = 0; i < 4; i++) document.querySelector("#pano-right").click();
              camera.cur.yaw = camera.tgt.yaw = -Math.PI / 2;
              document.querySelector("#pano-step").click();
              camera.cur.yaw = camera.tgt.yaw = 0;
            }
            // Deterministically settle the actual recipe's smoothing, independent of GPU load.
            for (let i = 0; i < 160; i++) p.toyInfo.recipe.drive(0, { lean: 0 }, p.motion.out);
            const canvas = await p.stage.captureFrame(256, 256);
            return {
              rgba: Array.from(canvas.getContext("2d").getImageData(0, 0, 256, 256).data),
              offset: p.motion.out.parts.shell.offset,
              buffer: [p.stage.canvas.width, p.stage.canvas.height],
            };
          }, offset);
          if (shot.buffer[0] !== 256 || shot.buffer[1] !== 256)
            throw new Error("Expected an exact 256×256 export buffer: " + shot.buffer);
          const reference = jpeg.decode(await fs.readFile(dir + "/novel-" + offset + ".jpg"), {
            useTArray: true,
          });
          const mask = await fs.readFile(path.join(out, row.id + "-" + offset + "-mask.u8"));
          const rgb = Float32Array.from(
            { length: 256 * 256 * 3 },
            (_, i) => shot.rgba[Math.floor(i / 3) * 4 + (i % 3)] / 255,
          );
          result.novel[offset][method] = {
            ...maskedSSIM(rgb, reference.data, mask),
            offset: shot.offset,
            buffer: shot.buffer,
          };
          await fs.writeFile(
            path.join(out, row.id + "-" + offset + "-gpu-" + method + ".jpg"),
            jpeg.encode({ width: 256, height: 256, data: Buffer.from(shot.rgba) }, 95).data,
          );
        }
      } finally {
        await context.close();
      }
    }
    results.scenes.push(result);
    await fs.writeFile(path.join(out, "gpu-scores.json"), JSON.stringify(results, null, 2) + "\n");
    console.log(JSON.stringify(result));
  }
} finally {
  await browser.close();
  server.kill();
}
