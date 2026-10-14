import { chromium } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan,WebGPU",
    "--use-webgpu-adapter=swiftshader",
    "--use-vulkan=swiftshader",
  ],
});
const results = [];
for (const [width, height, dpr, profile, forms] of [
  [390, 844, 2, "low", ["word", "lorenz", "klein", "gyroid", "loop", "qr"]],
  [1440, 900, 1, "high", ["word", "gyroid"]],
]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
  await page.goto(`http://127.0.0.1:4173/?labs=1&renderer=webgpu&profile=${profile}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("shape-morph");
    player.idle.weight = 0;
    player.opts.idleDelay = 1e9;
  });
  for (const form of forms) {
    await page.evaluate((form) => window.__splashery.app.setToyOption("form", form), form);
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      window.__splashery.player.stage.lastFrameMs.length = 0;
    });
    await page.waitForTimeout(3000);
    const r = await page.evaluate(() => {
      const { renderer, player } = window.__splashery;
      const ms = player.stage.lastFrameMs.slice().sort((a, b) => a - b);
      return {
        renderer,
        splats: player.toyInfo.splats,
        samples: ms.length,
        medianMs: ms[Math.floor(ms.length / 2)],
        p95Ms: ms[Math.floor(ms.length * 0.95)],
        drawingBuffer: [player.canvas.width, player.canvas.height],
      };
    });
    results.push({ width, height, dpr, profile, form, ...r });
    console.log(JSON.stringify(results.at(-1)));
  }
  await page.close();
}
fs.writeFileSync(".cache/cdx-pfc/perf.json", JSON.stringify(results, null, 2));
await browser.close();
