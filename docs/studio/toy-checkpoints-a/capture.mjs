import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Run from the repository root; evidence only, with no product changes.
const out = process.argv[2] || ".cache/toy-checkpoints-a/evidence";
fs.mkdirSync(out, { recursive: true });
const checkpoint = execFileSync("git", ["rev-parse", "origin/claude/checkpoint-toys-2026-10-14"], {
  encoding: "utf8",
}).trim();
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const jsqrModule = { exports: {} };
new Function("module", "exports", fs.readFileSync("vendor/jsqr/jsQR.js", "utf8"))(
  jsqrModule,
  jsqrModule.exports,
);
const jsQR = jsqrModule.exports.default || jsqrModule.exports;
const report = {
  checkpoint,
  capturedAt: new Date().toISOString(),
  browser: browser.version(),
  node: process.version,
  platform: process.platform,
  viewport: [390, 844],
  deviceScaleFactor: 1,
  profile: "low",
  renderer: "webgl2 / SwiftShader",
  url: "/?renderer=webgl2&adapt=off&profile=low&labs=1",
  measurements: [],
};
for (const id of ["qr-code", "qr-damage", "qr-picture"]) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:4173${report.url}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const opened = await page.evaluate(async (id) => {
    const start = performance.now();
    await window.__splashery.app.chooseToy(id);
    return { startMs: start, elapsedMs: performance.now() - start };
  }, id);
  await page.waitForFunction(
    (id) => {
      const s = window.__splashery;
      const check =
        id === "qr-code"
          ? s.qr?.info().check
          : id === "qr-damage"
            ? s.qrLab?.damage().check
            : s.qrCraft?.picture().check;
      return (
        !s.app.busy && !s.player.stage.coverDepth && check && (id !== "qr-picture" || check.stage)
      );
    },
    id,
    { timeout: 180000 },
  );
  const ready = await page.evaluate(() => performance.now());
  // Keep all resource entries before clearing the timeline for the selection below.
  const selected = await page.evaluate((id) => {
    const s = window.__splashery;
    const p = s.player;
    const info =
      id === "qr-code" ? s.qr.info() : id === "qr-damage" ? s.qrLab.damage() : s.qrCraft.picture();
    const code = info.code || info.woven?.code || info.codes?.[0];
    const buffers = new Set(
      Object.values(p.proc.ctx.buf)
        .filter(ArrayBuffer.isView)
        .map((a) => a.buffer),
    );
    const check =
      id === "qr-code"
        ? info.check
        : id === "qr-picture"
          ? {
              ok: info.check.ok,
              sizes: info.check.sizes,
              stage: info.check.stage,
              measure: info.check.measure,
            }
          : {
              codes: info.check.codes.map((c) => ({
                scans: c.scans,
                wrongModules: c.analysis.wrong.length,
                decodes: c.analysis.decodes,
                blocks: c.analysis.blocks.map((b) => ({
                  lost: b.lost,
                  fixable: b.fixable,
                  ok: b.ok,
                })),
              })),
            };
    return {
      profile: p.profile,
      splats: p.proc.ctx.buf.count,
      allocatedSplatArrayBytes: [...buffers].reduce((n, b) => n + b.byteLength, 0),
      canvas: [p.stage.canvas.width, p.stage.canvas.height],
      options: info.options,
      version: code?.version ?? info.version,
      modules: code?.size ?? info.size,
      check,
      margin: info.woven?.margin,
      pictureError: info.error,
      resources: performance
        .getEntriesByType("resource")
        .filter((r) =>
          /\/qr\/|\/qr-lab\/|\/qr-craft\/|\/packs\/qr|qrcodegen|jsQR|\/photo-3d\/ai\/farm/.test(
            r.name,
          ),
        )
        .map((r) => ({
          path: new URL(r.name).pathname,
          bodyBytes: r.decodedBodySize,
          transferBytes: r.transferSize,
          durationMs: r.duration,
        })),
    };
  }, id);
  const timings = await page.evaluate(async (id) => {
    const { player: p, app } = window.__splashery;
    p.opts.idleDelay = 1e9;
    p.idle.weight = 0;
    if (id === "qr-code") app.setControl("alive", 1);
    else if (id === "qr-damage") app.setControl("wave", 0.3);
    else app.setControl("turn", 1);
    await new Promise((r) => setTimeout(r, 250));
    const intervals = [];
    let last = performance.now();
    const start = last;
    const frames = p.stage.frames;
    const fn = () => {
      const now = performance.now();
      intervals.push(now - last);
      last = now;
    };
    p.stage.app.on("frameend", fn);
    await new Promise((r) => setTimeout(r, 2500));
    p.stage.app.off("frameend", fn);
    const elapsed = performance.now() - start;
    const sorted = intervals.slice().sort((a, b) => a - b);
    app.setControl(id === "qr-code" ? "alive" : id === "qr-damage" ? "wave" : "turn", 0);
    return {
      motion: id === "qr-code" ? "Alive wave" : id === "qr-damage" ? "Move in time 0.3" : "ripple",
      elapsedMs: elapsed,
      renderedFrames: p.stage.frames - frames,
      fps: ((p.stage.frames - frames) * 1000) / elapsed,
      medianFrameMs: sorted[Math.floor(sorted.length / 2)],
      p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
    };
  }, id);
  // Focus mode fills the real phone viewport, without changing its pixel ratio.
  await page.evaluate(() => {
    const s = window.__splashery;
    s.app.ui.toggleFocus();
    s.player.resume();
    s.qr && (s.qr.autoCheck = false);
    s.qrLab && (s.qrLab.autoCheck = false);
    s.qrCraft && (s.qrCraft.autoCheck = false);
  });
  await page.waitForTimeout(1000);
  const clips = [];
  for (const shape of ["square", "circle"]) {
    await page.evaluate(async (shape) => {
      const { app, player: p } = window.__splashery;
      await app.setToyOptions({
        shape,
        ...(p.toyInfo.id === "qr-damage"
          ? {
              damage: "",
              show: "damaged",
              tool: "sticker",
              region: "center",
              decorationDamage: false,
            }
          : {}),
      });
      p.resume();
      p.camera.setState(p.camera.home, { snap: true });
    }, shape);
    await page.waitForTimeout(800);
    await page.evaluate(async () => {
      const { player: p } = window.__splashery;
      const handlers = p.stage.updateHandlers.slice();
      const home = { ...p.camera.home };
      const clock = { pending: 0, handlers, home };
      p.stage.updateHandlers.length = 0;
      p.stage.updateHandlers.push(() => {
        const d = clock.pending;
        clock.pending = 0;
        for (const h of handlers) h(d);
      });
      window.__checkpointClock = clock;
      clock.pending = 1;
      await p.stage.captureFrame();
    });
    const name = `${id}-${shape}-390x844`;
    const gif = GIFEncoder();
    const frames = id === "qr-damage" ? 90 : 50;
    const previewFrames = [];
    const viewportReads = [];
    for (let i = 0; i < frames; i++) {
      if (i === 5)
        await page.evaluate(async (id) => {
          const s = window.__splashery;
          if (id === "qr-damage") {
            s.qrLab.setPrev("");
            await s.player.switchTo({
              options: { damage: "sticker:0.24:finder:1", show: "damaged" },
              key: "drop",
              value: 1,
            });
          } else s.player.act();
        }, id);
      if (id === "qr-damage" && i === 30)
        await page.evaluate(() => window.__splashery.qrLab.heal());
      await page.evaluate(async () => {
        const { player: p } = window.__splashery;
        const clock = window.__checkpointClock;
        clock.pending = 0.1;
        p.camera.cur = { ...clock.home };
        p.camera.tgt = { ...clock.home };
        await p.stage.captureFrame();
        await p.stage.captureFrame();
      });
      const png = PNG.sync.read(await page.screenshot());
      const palette = quantize(png.data, 256, { format: "rgb565" });
      gif.writeFrame(applyPalette(png.data, palette, "rgb565"), 390, 844, {
        palette,
        delay: 100,
        repeat: 0,
      });
      if ([0, 14, 29, frames - 1].includes(i)) {
        fs.writeFileSync(path.join(out, `${name}-frame-${i}.png`), PNG.sync.write(png));
        previewFrames.push(i);
        viewportReads.push({ frame: i, text: jsQR(png.data, png.width, png.height)?.data ?? null });
      }
    }
    gif.finish();
    fs.writeFileSync(path.join(out, `${name}.gif`), gif.bytes());
    clips.push({
      name: `${name}.gif`,
      frames,
      fps: 10,
      durationSeconds: frames / 10,
      bytes: gif.bytes().length,
      previewFrames,
      viewportReads,
      method:
        "real browser; clock stepped at 0.1 seconds, two rendered frames before each viewport screenshot; silent GIF",
    });
    await page.evaluate(() => {
      const p = window.__splashery.player;
      p.stage.updateHandlers.length = 0;
      p.stage.updateHandlers.push(...window.__checkpointClock.handlers);
      p.resume();
    });
  }
  report.measurements.push({
    id,
    chooseToyMs: opened.elapsedMs,
    chooseToCheckCompleteMs: ready - opened.startMs,
    ...selected,
    activeRendering: timings,
    clips,
    errors,
  });
  fs.writeFileSync(path.join(out, "measurements.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(
    `${id}: ${selected.splats} splats; ${timings.fps.toFixed(1)} rendered fps; ${clips.map((c) => c.name).join(", ")}`,
  );
  await context.close();
}
await browser.close();
