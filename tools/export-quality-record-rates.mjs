#!/usr/bin/env node
// Real live Record takes, including toy motion and sound. Large review files
// belong only on codex/export-quality-clips. MB/min uses actual packet duration.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const out = path.resolve(process.argv[2] || "/tmp/export-quality/record-rates");
fs.mkdirSync(out, { recursive: true });
const resultsPath = path.join(out, "record-rates.json");
const results = fs.existsSync(resultsPath) ? JSON.parse(fs.readFileSync(resultsPath)) : [];
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
try {
  for (const phone of [true, false]) {
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: phone ? 3 : 1,
      isMobile: phone,
      hasTouch: phone,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(240_000);
    page.on("pageerror", (e) => console.error(e.message));
    await page.goto(
      `${process.env.SPLASHERY_URL || "http://127.0.0.1:4175"}/?renderer=webgl2&profile=weak&adapt=off&labs=1`,
    );
    await page.waitForSelector("body[data-ready=true]");
    for (const toy of ["photo-3d", "donut"])
      for (const quality of ["standard", "high"]) {
        const key = `${phone ? "phone" : "desktop"}-${toy}-${quality}`;
        if (results.some((r) => r.key === key)) continue;
        console.log("START", key);
        await page.evaluate(async (id) => {
          const { app, player } = window.__splashery;
          await app.chooseToy(id);
          player.paused = false;
        }, toy);
        if (phone && !(await page.locator("#tab-share").isVisible()))
          await page.click("#sheet-toggle");
        await page.click("#tab-share");
        await page.selectOption("#record-quality", quality);
        await page.evaluate(() => {
          const { app } = window.__splashery;
          const start = app.startRecord.bind(app);
          window.recordStartComplete = false;
          app.startRecord = async (...args) => {
            try {
              return await start(...args);
            } finally {
              window.recordStartComplete = true;
              app.startRecord = start;
            }
          };
        });
        const started = Date.now();
        await page.click("#record-start", { noWaitAfter: true });
        await page.waitForFunction(() => window.recordStartComplete);
        const take = await page.evaluate(
          async ({ quality }) => {
            const { app, player } = window.__splashery;
            if (!app.recording) throw new Error(document.getElementById("toast").textContent);
            const { recordingPlan } = await import("/src/export/presets.js");
            const rect = document.getElementById("stage").getBoundingClientRect();
            const plan = recordingPlan({
              width: rect.width,
              height: rect.height,
              dpr: devicePixelRatio,
              tierCap: player.stage.pixelCap ?? 3,
              quality,
            });
            const done = app.recording.done;
            const replay = () => player.motion.act(player.time);
            replay();
            const loop = setInterval(replay, 4000);
            await new Promise((r) => setTimeout(r, 15_000));
            clearInterval(loop);
            app.stopRecord();
            const result = await done;
            return {
              plan,
              bytes: result.size,
              type: result.type,
              seconds: result.seconds,
              reason: result.reason,
            };
          },
          { quality },
        );
        const download = page.waitForEvent("download");
        await page.click("#rec-save");
        const dl = await download;
        const file = `${key}${path.extname(dl.suggestedFilename())}`;
        const target = path.join(out, file);
        await dl.saveAs(target);
        const meta = JSON.parse(
          execFileSync(
            "ffprobe",
            [
              "-v",
              "error",
              "-count_frames",
              "-show_format",
              "-show_streams",
              "-of",
              "json",
              target,
            ],
            { encoding: "utf8" },
          ),
        );
        const video = meta.streams.find((s) => s.codec_type === "video");
        // MediaRecorder WebM commonly has no container Duration. Read the real
        // encoded timestamps across both tracks, rather than the UI wall clock.
        const packets = JSON.parse(
          execFileSync(
            "ffprobe",
            [
              "-v",
              "error",
              "-show_entries",
              "packet=pts_time,duration_time",
              "-of",
              "json",
              target,
            ],
            { encoding: "utf8" },
          ),
        ).packets;
        const duration =
          Math.max(...packets.map((p) => Number(p.pts_time) + Number(p.duration_time || 1 / 30))) -
          Math.min(...packets.map((p) => Number(p.pts_time)));
        const row = {
          key,
          file,
          ...take,
          wallSeconds: (Date.now() - started) / 1000,
          duration,
          width: video.width,
          height: video.height,
          decodedFrames: Number(video.nb_read_frames),
          MBPerMinute: ((take.bytes / duration) * 60) / 1_000_000,
        };
        results.push(row);
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2) + "\n");
        await page.click("#rec-close");
        console.log("DONE", key, JSON.stringify(row));
      }
    await context.close();
  }
} finally {
  await browser.close();
}
