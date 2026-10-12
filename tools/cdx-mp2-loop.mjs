#!/usr/bin/env node
// Reproduce the real psv3 sound loop while recording page-thread stalls.
// --baseline=<commit> replays that commit's four task-owned source modules.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
const option = (key, fallback) =>
  process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  if (option("baseline", ""))
    for (const file of [
      "src/packs/moving-photo.js",
      "src/packs/photo-sharp.js",
      "src/packs/song-stream.js",
      "src/live/clip-stabilize.js",
    ])
      await page.route(`**/${file}`, (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body: execFileSync("git", ["show", `${option("baseline")}:${file}`], {
            encoding: "utf8",
          }),
        }),
      );
  await page.goto(
    `${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}?renderer=webgl2&adapt=off&profile=mid&labs=1`,
  );
  await page.waitForSelector("body[data-ready='true']");
  await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
  await page.waitForFunction(() => window.__psv?.state().on && !window.__splashery.player.loading);
  await page.evaluate(() => {
    window.__tasks = [];
    window.__openAt = performance.now();
    new PerformanceObserver((list) =>
      window.__tasks.push(...list.getEntries().map((e) => ({ at: e.startTime, ms: e.duration }))),
    ).observe({ type: "longtask" });
  });
  await page.evaluate(async () => (window.__loopM = await import("/src/packs/moving-photo.js")));
  await page.setInputFiles("#toy-input-file", "tests/fixtures/psv3/sound.webm");
  await page.waitForFunction(
    (preview) => {
      const clip = window.__loopM.MOVING.clip;
      return (
        clip?.name === "sound" &&
        (!preview || clip.firstPresentedAt) &&
        !window.__splashery.player.loading
      );
    },
    !option("baseline", ""),
    { timeout: 120_000 },
  );
  const result = await page.evaluate(async () => {
    const { MOVING: M } = await import("/src/packs/moving-photo.js");
    const c = M.clip;
    const firstMs = performance.now() - window.__openAt;
    const firstPictureMs = c.firstPresentedAt ? c.firstPresentedAt - window.__openAt : firstMs;
    const { app } = window.__splashery;
    app.setMotion({ speed: 0.5 });
    app.setControl("play", 1);
    const rows = [];
    const started = performance.now();
    const minimum = started + 2.7 * c.duration * 1000;
    while (
      performance.now() < minimum ||
      (!c.refinement?.done && performance.now() - started < 120_000)
    ) {
      await new Promise((r) => requestAnimationFrame(r));
      rows.push({
        t: M.t,
        at: performance.now(),
        audio: c.audio.track.el.currentTime,
        refining: !c.refinement?.done,
      });
    }
    const wraps = rows.flatMap((r, i) =>
      i && r.t < rows[i - 1].t - c.duration / 2 ? [{ ...r, gapMs: r.at - rows[i - 1].at }] : [],
    );
    return {
      firstMs,
      duration: c.duration,
      firstPictureMs,
      wraps,
      tasks: window.__tasks,
      rows,
      refinementError: c.refinement?.error || null,
    };
  });
  result.largestMainTaskMs = Math.max(0, ...result.tasks.map((t) => t.ms));
  result.largestRenderedGapMs = Math.max(
    0,
    ...result.rows.slice(1).map((r, i) => r.at - result.rows[i].at),
  );
  result.largestWrapTime = Math.max(0, ...result.wraps.map((r) => r.t));
  await fs.writeFile(
    option("out", ".cache/cdx-mp2/loop.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      firstMs: result.firstMs,
      firstPictureMs: result.firstPictureMs,
      largestMainTaskMs: result.largestMainTaskMs,
      largestRenderedGapMs: result.largestRenderedGapMs,
      largestWrapTime: result.largestWrapTime,
      wraps: result.wraps.length,
      error: result.refinementError,
    }),
  );
} finally {
  await browser.close();
}
