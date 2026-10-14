// One sandboxed Chromium, one page, and one tier per run.
// Start the repository's HTTP server first, then:
// node tools/cdx-t2-capture.mjs <output-dir> <low|mid|high|max> [toy ids ...]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { TOYS_T2, TIERS } from "./cdx-t2-data.mjs";

const [out, tier, ...args] = process.argv.slice(2);
const desktop = args.includes("--desktop");
const ids = args.filter((a) => a !== "--desktop");
const viewport = desktop ? { width: 1440, height: 900 } : { width: 390, height: 844 };
if (!out || !TIERS.includes(tier)) throw new Error("Supply an output directory and valid tier.");
for (const id of ids) if (!TOYS_T2.some((t) => t.id === id)) throw new Error(`Out of scope: ${id}`);
fs.mkdirSync(out, { recursive: true });
const report = {
  source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  tier,
  viewport: [viewport.width, viewport.height],
  device: "desktop Chromium; no physical phone",
  rows: [],
};
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  chromiumSandbox: true,
  args: [],
});
try {
  report.browser = browser.version();
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
  await page.goto(`${base}?labs=1&renderer=webgl2&profile=${tier}&adapt=off`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  report.graphics = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      vendor: gl.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
    };
  });
  for (const def of TOYS_T2.filter((t) => !ids.length || ids.includes(t.id))) {
    const start = errors.length;
    const row = { id: def.id };
    try {
      Object.assign(
        row,
        await page.evaluate(
          async ({ id, tier }) => {
            const { app, player } = window.__splashery;
            await app.chooseToy(id);
            if (player.toyInfo.id !== id) throw new Error(`Toy did not load: ${id}`);
            if (player.profile !== tier || player.splats)
              throw new Error("Forced Auto budget changed.");
            player.opts.idleDelay = 1e9;
            player.idle.weight = 0;
            app.setMotion({ move: "still" });
            player.time = 0;
            player.motion.kitClock = { t: 0, last: 0, rate: 1 };
            player.motion.moveClock = { t: 0, last: 0, rate: 1 };
            const stage = player.stage;
            const handlers = stage.updateHandlers.slice();
            let pending = 0.5;
            stage.updateHandlers.length = 0;
            stage.updateHandlers.push(() => {
              const dt = pending;
              pending = 0;
              for (const h of handlers) h(dt);
            });
            try {
              player.camera.cur = { ...player.camera.home };
              player.camera.tgt = { ...player.camera.home };
              await stage.captureFrame();
              if (player.chunks) {
                const end = performance.now() + 120_000;
                while (player.chunks.busy || player.chunks.queue.length) {
                  if (performance.now() > end) throw new Error("Chunk loading timed out.");
                  await new Promise((r) => setTimeout(r, 100));
                }
                const failed = [...player.chunks.items].filter(
                  ([, item]) => item.state === "failed",
                );
                if (failed.length)
                  throw new Error(`Failed chunks: ${failed.map(([id]) => id).join(", ")}`);
              }
              for (let i = 0; i < 5; i++) await stage.captureFrame();
              stage.setFixedSize([390, 844]);
              const canvas = await stage.captureFrame();
              const portrait = canvas.toDataURL("image/png");
              stage.setFixedSize(null);
              await stage.captureFrame();
              return {
                requested: player.proc.ctx.g.count,
                emitted: player.toyInfo.splats,
                visibleChunkSplats: player.chunks?.splats() || 0,
                chunks: player.chunks
                  ? [...player.chunks.items].map(([id, it]) => ({
                      id,
                      state: it.state,
                      splats: it.splats,
                    }))
                  : [],
                seed: player.proc.ctx.g.seed,
                clock: player.time,
                options: player.scene.toy.options || {},
                portrait,
              };
            } finally {
              stage.setFixedSize(null);
              stage.updateHandlers.length = 0;
              stage.updateHandlers.push(...handlers);
            }
          },
          { id: def.id, tier },
        ),
      );
      const portrait = `${def.id}-${tier}-stage-390x844.png`;
      const bytes = Buffer.from(row.portrait.split(",")[1], "base64");
      fs.writeFileSync(path.join(out, portrait), bytes);
      row.portrait = portrait;
      const { data } = PNG.sync.read(bytes);
      row.inkPixels = 0;
      for (let i = 0; i < data.length; i += 4)
        if (
          Math.abs(data[i] - data[0]) +
            Math.abs(data[i + 1] - data[1]) +
            Math.abs(data[i + 2] - data[2]) >
          24
        )
          row.inkPixels++;
      if (row.inkPixels < 20) throw new Error("The stage capture is blank.");
      row.screenshot = `${def.id}-${tier}-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: path.join(out, row.screenshot) });
    } catch (e) {
      row.error = e.message;
      process.exitCode = 1;
    }
    row.pageErrors = errors.slice(start);
    if (row.pageErrors.length) process.exitCode = 1;
    report.rows.push(row);
    fs.writeFileSync(
      path.join(out, `${tier}${desktop ? "-desktop" : ""}.json`),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(`${def.id} ${tier}: ${row.error || `${row.emitted} splats captured`}`);
  }
} finally {
  await browser.close();
}
