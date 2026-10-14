#!/usr/bin/env node
// Capture the real grapes effect. The fixed simulation clock follows effect-clip.mjs.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import qr from "qrcode-generator";

const out = path.resolve("docs/audits/pdf-motion-2026-10");
fs.mkdirSync(path.join(out, "frames"), { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM,
  args: ["--use-angle=metal", "--enable-webgl"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `${process.env.SPLASHERY_URL || "http://127.0.0.1:4189/"}?renderer=webgl2&profile=high&adapt=off`,
  );
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const capture = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("grapes");
    app.setLook({ background: "#111111" });
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    const stage = player.stage;
    const handlers = stage.updateHandlers.slice();
    let pending = 0;
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const dt = pending;
      pending = 0;
      for (const handler of handlers) handler(dt);
    });
    stage.setFixedSize([420, 420]);
    const { buf } = player.proc.ctx;
    const stride = Math.ceil(buf.count / 2400);
    const points = [];
    for (let i = 0; i < buf.count; i += stride) {
      if (buf.color[i * 4 + 3] > 0.05)
        points.push({
          index: i,
          p: Array.from(buf.pos.slice(i * 3, i * 3 + 3)),
          rgb: Array.from(buf.color.slice(i * 4, i * 4 + 3)),
        });
    }
    const frames = [];
    for (let n = 0; n < 40; n++) {
      if (n === 4) player.act(null);
      pending = n === 0 ? 0.5 : 1 / 8;
      player.camera.cur = { ...player.camera.home };
      player.camera.tgt = { ...player.camera.home };
      await stage.captureFrame();
      pending = 0;
      const canvas = await stage.captureFrame();
      frames.push(canvas.toDataURL("image/jpeg", 0.88).split(",")[1]);
    }
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(...handlers);
    stage.setFixedSize(null);
    return { frames, points, count: buf.count, stride, camera: player.camera.home };
  });
  capture.frames.forEach((bytes, i) =>
    fs.writeFileSync(
      path.join(out, "frames", `frame-${String(i).padStart(3, "0")}.jpg`),
      Buffer.from(bytes, "base64"),
    ),
  );
  fs.writeFileSync(path.join(out, "points.json"), JSON.stringify(capture.points, null, 2) + "\n");
  const live = "https://ryanjosephkamp.github.io/splashery/embed/?toy=grapes";
  const code = qr(0, "M");
  code.addData(live);
  code.make();
  fs.writeFileSync(
    path.join(out, "qr.svg"),
    code.createSvgTag({ cellSize: 6, margin: 24, scalable: true }),
  );
  fs.writeFileSync(
    path.join(out, "qr.json"),
    JSON.stringify(
      {
        url: live,
        modules: Array.from({ length: code.getModuleCount() }, (_, r) =>
          Array.from({ length: code.getModuleCount() }, (_, c) => code.isDark(r, c)),
        ),
      },
      null,
      2,
    ) + "\n",
  );
  fs.writeFileSync(
    path.join(out, "capture.json"),
    JSON.stringify(
      {
        baseline: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        toy: "grapes",
        source: "src/packs/food.js",
        browser: browser.version(),
        renderer: "WebGL2 / ANGLE Metal",
        fps: 8,
        frames: 40,
        size: [420, 420],
        tapFrame: 4,
        simulationStepSeconds: 0.125,
        splats: capture.count,
        sampledPoints: capture.points.length,
        stride: capture.stride,
        camera: capture.camera,
        pageErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Captured 40 frames and ${capture.points.length} of ${capture.count} splat centers.`);
} finally {
  await browser.close();
}
