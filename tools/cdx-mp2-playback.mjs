// Serial phone-profile playback timing. Run each code version separately;
// frameend intervals measure the app's rendered cadence, not decoder drops.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { GRAPHICS_LAUNCH } from "./cdx-mp2-render.mjs";

const option = (key, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
const url = option("url", "http://127.0.0.1:4388");
const output = option("out", ".cache/cdx-mp3-review/playback.json");
const android =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
const browser = await chromium.launch(GRAPHICS_LAUNCH);
const report = {
  url,
  measuredAt: new Date().toISOString(),
  browser: browser.version(),
  backend: process.env.SPLASHERY_GL || "swiftshader",
  viewport: [390, 844],
  deviceScaleFactor: 3,
  userAgent: android,
  pageCpuRate: 4,
  workerThrottled: false,
  warmupMs: 2000,
  metric: "performance.now intervals between actual PlayCanvas frameend events",
  note: "One browser, no concurrent browser tests; software rendering, not physical Android.",
  cases: [],
};
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: android,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(180_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(`${url}/?renderer=webgl2&adapt=off&profile=low&labs=1`);
  await page.waitForSelector("body[data-ready='true']");
  const ids = await page.evaluate(async () => {
    window.__playbackMoving = await import("/src/packs/moving-photo.js");
    await window.__splashery.app.chooseToy("moving-photo-3d");
    window.__splashery.app.setControl("play", 0);
    return window.__playbackMoving.MOVING_PHOTO.options
      .find((option) => option.key === "clip")
      .choices.filter((choice) => choice.id !== "custom")
      .map((choice) => choice.id);
  });
  // A real gesture grants media playback; the production control starts it.
  await page.mouse.click(5, 180);
  for (const id of ids) {
    await page.evaluate(async (id) => {
      const app = window.__splashery.app;
      app.setControl("play", 0);
      if (id === "sample") await app.setToyOptions({ clip: "horse" });
      await app.setToyOptions({ clip: id });
    }, id);
    await page.waitForFunction(() => !window.__splashery.player.loading);
    const result = await page.evaluate(async (id) => {
      const { app, player } = window.__splashery;
      const moving = window.__playbackMoving.MOVING;
      app.setControl("play", 1);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const duration = moving.clip.duration;
      const windowMs = id.endsWith("-long") ? 30_000 : 12_000;
      const rows = [];
      const frame = () => {
        rows.push({
          wall: performance.now(),
          time: moving.t,
          frame: moving.frame,
          sample: moving.clip.sample,
          sharp: window.__psv.state().on,
        });
      };
      player.stage.app.on("frameend", frame);
      const started = performance.now();
      try {
        await new Promise((resolve) => setTimeout(resolve, windowMs));
      } finally {
        player.stage.app.off("frameend", frame);
        app.setControl("play", 0);
      }
      const elapsedMs = performance.now() - started;
      const intervals = rows.slice(1).map((row, i) => row.wall - rows[i].wall);
      const sorted = [...intervals].sort((a, b) => a - b);
      const median =
        sorted.length % 2
          ? sorted[(sorted.length - 1) / 2]
          : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
      let sourceAdvance = 0;
      for (let i = 1; i < rows.length; i++) {
        const delta = rows[i].time - rows[i - 1].time;
        sourceAdvance += delta < -duration / 2 ? delta + duration : Math.max(0, delta);
      }
      return {
        id,
        duration,
        windowMs,
        elapsedMs,
        frames: rows.length,
        intervals: intervals.length,
        medianMs: median,
        worstMs: sorted.at(-1),
        sourceAdvance,
        distinctFrames: new Set(rows.map((row) => row.frame)).size,
        sharpFrames: rows.filter((row) => row.sharp).length,
        rows,
      };
    }, id);
    if (
      result.frames < 3 ||
      result.distinctFrames < 2 ||
      result.sourceAdvance < result.windowMs / 4000 ||
      result.rows.some((row) => row.sample !== id)
    )
      throw new Error(`No valid moving playback window for ${id}: ${JSON.stringify(result)}`);
    report.cases.push(result);
    report.pageErrors = [...errors];
    await fs.mkdir(new URL(".", new URL(output, `file://${process.cwd()}/`)), { recursive: true });
    await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
    const { rows, ...summary } = result;
    console.log(JSON.stringify(summary));
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.join("; ")}`);
} finally {
  await browser.close();
}
