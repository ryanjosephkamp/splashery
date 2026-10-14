// Real animation throughput, separately from the encoded review-clip frame rate.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "@playwright/test";
import config from "../playwright.config.mjs";
import { openR4, selectR4, inputsR4, screens, fingerprintR4 } from "./cdx-p3d4-common.mjs";
const opt = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const urls = [opt("before", "http://127.0.0.1:4174/"), opt("after", "http://127.0.0.1:4175/")],
  builds = await Promise.all(urls.map((url) => fingerprintR4(url))),
  duration = Number(opt("seconds", 6)) * 1000,
  out = opt("out", ".cache/photo-3d-r4/fps"),
  files = ["cdx-p3d4-fps.mjs", "cdx-p3d4-common.mjs", "cdx-p3d2-r3-common.mjs"],
  method = crypto
    .createHash("sha256")
    .update(Buffer.concat(files.map((f) => fs.readFileSync(`tools/${f}`))))
    .digest("hex");
fs.mkdirSync(out, { recursive: true });
const target = path.join(out, "results.json"),
  saved = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target)) : null;
if (
  saved &&
  (saved.method !== method ||
    saved.duration !== duration ||
    JSON.stringify(saved.builds) !== JSON.stringify(builds))
)
  throw Error("Saved throughput study uses different sources or timing.");
const rows = saved?.rows || [],
  browser = await chromium.launch(config.use.launchOptions);
fs.mkdirSync(path.join(out, "method-source"), { recursive: true });
for (const f of files) fs.copyFileSync(`tools/${f}`, path.join(out, "method-source", f));
try {
  for (const screenName of opt("screens", "phone,desktop").split(",")) {
    const screen = screens[screenName],
      pages = [];
    for (const url of urls) {
      const page = await browser.newPage({
        viewport: { width: screen.width, height: screen.height },
        deviceScaleFactor: screen.deviceScaleFactor,
      });
      await openR4(page, url, screen);
      pages.push(page);
    }
    const ids = opt(
      "samples",
      "forest,cdx-hard-bicycle-spokes,cdx-hard-bare-branches,dot-cdx-plant-studio",
    );
    for (const input of inputsR4().filter((s) => ids === "all" || ids.split(",").includes(s.id)))
      for (const view of opt("views", "sharp").split(",")) {
        if (rows.some((r) => r.id === input.id && r.screen === screenName && r.view === view))
          continue;
        const comparison = [];
        for (let b = 0; b < 2; b++) {
          const page = pages[b];
          await page.bringToFront();
          await selectR4(page, input, 1, view);
          const result = await page.evaluate(async (duration) => {
            const pl = window.__splashery.player;
            for (let i = 0; i < 3; i++) await pl.stage.captureFrame();
            return new Promise((resolve) => {
              let start, last;
              const intervals = [];
              let frames = 0;
              const pose = () => {
                const elapsed = start === undefined ? 0 : (performance.now() - start) / duration;
                const turn = Math.min(3, Math.floor(elapsed * 4)),
                  angle = 30 * Math.sin(Math.PI * (elapsed * 4 - turn));
                pl.camera.cur = {
                  ...pl.camera.home,
                  yaw: turn < 2 ? ((turn === 0 ? -angle : angle) * Math.PI) / 180 : 0,
                  pitch: turn >= 2 ? ((turn === 2 ? -angle : angle) * Math.PI) / 180 : 0,
                };
                pl.camera.tgt = { ...pl.camera.cur };
                pl.stage.setCameraPose(pl.camera.pose());
                pl.toyInfo.recipe.drive(0, { flat: 0, layers: 0 }, { parts: {} });
              };
              const rendered = () => {
                const now = performance.now();
                if (start === undefined) {
                  start = now;
                  last = now;
                  return;
                }
                intervals.push(now - last);
                last = now;
                frames++;
                if (now - start < duration) return;
                pl.stage.app.off("prerender", pose);
                pl.stage.app.off("postrender", rendered);
                pl.setPaused(true);
                const sorted = intervals.slice().sort((a, b) => a - b);
                resolve({
                  frames,
                  elapsedMs: now - start,
                  fps: (1000 * frames) / (now - start),
                  medianFrameMs: sorted[Math.floor(sorted.length * 0.5)],
                  p95FrameMs: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
                  intervals,
                  buffer: [pl.stage.canvas.width, pl.stage.canvas.height],
                });
              };
              pl.stage.app.on("prerender", pose);
              pl.stage.app.on("postrender", rendered);
              pl.setPaused(false);
            });
          }, duration);
          comparison.push({ build: b ? "after" : "checkpoint", ...result });
        }
        const row = { id: input.id, screen: screenName, view, comparison };
        rows.push(row);
        fs.writeFileSync(
          target,
          JSON.stringify({ browser: browser.version(), builds, method, duration, rows }, null, 2),
        );
        console.log(
          JSON.stringify({
            id: input.id,
            screen: screenName,
            view,
            fps: comparison.map((r) => r.fps),
          }),
        );
      }
    for (const page of pages) await page.close();
  }
  const end = await Promise.all(urls.map((url) => fingerprintR4(url)));
  if (JSON.stringify(end) !== JSON.stringify(builds))
    throw Error("Source changed during throughput study.");
} finally {
  await browser.close();
}
