import { chromium } from "@playwright/test";
import fs from "node:fs";

const out = ".cache/toy-checkpoints-c";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const results = [];
for (const id of ["chladni-cell", "chladni-plate", "song-landscape"]) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const begin = performance.now();
  await page.goto("http://127.0.0.1:4173/?labs=1&renderer=webgl2&profile=low&adapt=off");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const readyMs = performance.now() - begin;
  const load = await page.evaluate(async (id) => {
    const start = performance.now();
    await window.__splashery.app.chooseToy(id);
    return { start, elapsedMs: performance.now() - start };
  }, id);
  await page
    .waitForFunction(
      (id) =>
        window.__splashery.player.scene.toy.id === id &&
        document.getElementById("progress").hidden &&
        window.__splashery.player.motion.recipe,
      id,
      { timeout: 180000 },
    )
    .catch(async (e) => {
      throw e;
    });
  // The waiting predicate uses the selected id explicitly.
  const snapshot = () =>
    page.evaluate(async (id) => {
      const { player: p } = window.__splashery;
      const m = await import("/src/packs/studio.js");
      const b = await import("/src/packs/chladni-3d.js");
      return {
        profile: p.profile,
        splats: p.toyInfo.splats,
        frames: p.stage.frames,
        clock: p.time,
        particles:
          id === "chladni-cell" ? b.cellState() : id === "chladni-plate" ? m.chladniSand() : null,
        song:
          id === "song-landscape"
            ? {
                play: m.playState(),
                analysis: m.songAnalysisState(),
                nt: m.r2Land()?.nt,
                nf: m.r2Land()?.nf,
              }
            : null,
        canvas: [p.stage.canvas?.width, p.stage.canvas?.height],
      };
    }, id);
  await page.screenshot({ path: `${out}/${id}-before.png` });
  await page.evaluate(() => {
    window.__splashery.player.opts.idleDelay = 1e9;
    window.__splashery.player.idle.weight = 0;
    window.__splashery.app.act();
  });
  const a = await snapshot();
  const t0 = performance.now();
  await page.waitForTimeout(3000);
  const b = await snapshot();
  const elapsed = performance.now() - t0;
  await page.screenshot({ path: `${out}/${id}-after.png` });
  const resources = await page.evaluate(
    (start) =>
      performance
        .getEntriesByType("resource")
        .filter((x) => x.startTime >= start)
        .map((x) => ({
          url: new URL(x.name).pathname,
          encodedBodySize: x.encodedBodySize,
          transferSize: x.transferSize,
          duration: x.duration,
        })),
    load.start,
  );
  const item = {
    id,
    readyMs,
    selectionMs: load.elapsedMs,
    activeWindowMs: elapsed,
    drawnFrames: b.frames - a.frames,
    drawFps: (b.frames - a.frames) / (elapsed / 1000),
    before: a,
    after: b,
    resources,
    errors,
  };
  results.push(item);
  fs.writeFileSync(
    `${out}/measurements.json`,
    JSON.stringify(
      {
        checkpoint: "41b21e74e04ccca178b95ac02b4e5dc0e51b4b45",
        browser: browser.version(),
        viewport: [390, 844],
        dpr: 1,
        renderer: "WebGL2 / ANGLE SwiftShader",
        cpuThrottle: 1,
        adaptation: false,
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      id,
      readyMs,
      selectionMs: load.elapsedMs,
      drawFps: item.drawFps,
      splats: b.splats,
      errors,
    }),
  );
  await context.close();
}
await browser.close();
