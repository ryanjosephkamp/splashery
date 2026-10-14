// Run from any directory inside the checkpoint checkout, with its node_modules installed.
// SPLASHERY_CHROMIUM=/usr/bin/chromium SPLASHERY_URL=http://127.0.0.1:4174/ node <this-file> <output.json>
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4174/";
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const record = {
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  browser: browser.version(),
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  query: "?renderer=webgl2&adapt=off&profile=low&labs=1",
  method:
    "One fresh browser context per toy. Local unthrottled HTTP. Timings are single runs, without CPU throttling. Forced stage rendering counts frameend events over approximately five seconds; taps at zero and 2.5 seconds. No inference is requested.",
  rows: [],
};
try {
  for (const id of ["picture-lab", "your-book", "photo-album"]) {
    const page = await browser.newPage({ viewport: record.viewport, deviceScaleFactor: 2 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const t0 = performance.now();
    await page.goto(`${base}${record.query}`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    const shellReadyMs = performance.now() - t0;
    const started = performance.now();
    await page.evaluate(async (id) => {
      const { app } = window.__splashery;
      await app.chooseToy(id);
    }, id);
    await page.waitForFunction(
      () => {
        const pl = window.__splashery.player;
        pl.stage.requestRender();
        const p = pl.pictures;
        return (
          p?.media &&
          p.splats() > 0 &&
          p.sheets.every((s) => !s.want || s.shown?.key === s.want.key)
        );
      },
      null,
      { timeout: 180_000, polling: 100 },
    );
    const sampleReadyMs = performance.now() - started;
    const settled = await page.evaluate(() => {
      const pl = window.__splashery.player;
      const p = pl.pictures;
      return {
        profile: pl.profile,
        options: pl.scene.toy.options,
        media: p.info(),
        canvas: { width: pl.stage.canvas.width, height: pl.stage.canvas.height },
        kitSplats: pl.toyInfo.splats,
        visibleSheetSplats: p.splats(),
        cacheSplats: [...p.cache.values()].reduce((n, d) => n + d.count, 0),
        sheetDefinitions: p.sheets.length,
        visibleSheets: p.sheets.filter((s) => s.slot?.entity.enabled).length,
        builds: p.stats.builds,
        lastSheetBuildMs: p.stats.lastMs,
      };
    });
    const active = await page.evaluate(async () => {
      const pl = window.__splashery.player;
      pl.opts.idleDelay = 1e9;
      pl.idle.weight = 0;
      const start = performance.now();
      const firstFrame = pl.stage.frames;
      const firstPage = pl.pictures.page;
      pl.act();
      const render = setInterval(() => pl.stage.requestRender(), 20);
      const secondTap = setTimeout(() => pl.act(), 2500);
      await new Promise((r) => setTimeout(r, 5000));
      clearInterval(render);
      clearTimeout(secondTap);
      const elapsedMs = performance.now() - start;
      const frames = pl.stage.frames - firstFrame;
      return {
        elapsedMs,
        frames,
        framesPerSecond: (frames * 1000) / elapsedMs,
        firstPage,
        lastPage: pl.pictures.page,
        kitSplats: pl.toyInfo.splats,
        visibleSheetSplats: pl.pictures.splats(),
      };
    });
    const resources = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((r) => ({ path: new URL(r.name).pathname, decodedBodySize: r.decodedBodySize }))
        .filter(
          (r) =>
            r.path.startsWith("/manual/") ||
            r.path.startsWith("/assets/toys/picture-lab/") ||
            r.path.startsWith("/assets/toys/photo-album/"),
        ),
    );
    record.rows.push({ id, shellReadyMs, sampleReadyMs, settled, active, resources, errors });
    fs.writeFileSync(process.argv[2], `${JSON.stringify(record, null, 2)}\n`);
    console.log(
      JSON.stringify({
        id,
        sampleReadyMs,
        fps: active.framesPerSecond,
        page: active.lastPage,
        errors,
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
