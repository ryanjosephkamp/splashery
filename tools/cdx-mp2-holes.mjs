#!/usr/bin/env node
// Controlled phone renders through the actual ReliefMesh shader. The inner
// 70% of the projected picture is sampled at three source times; alpha counts
// background holes, and paired magenta tint counts exposed backing. Media
// input/model estimation are real; the camera and presentation clock are fixed.
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
  const results = [],
    errors = [];
  const paths = {
    sample: "assets/toys/screen/bunny.webm",
    horse: "assets/toys/screen/horse.gif",
    dragon: ".cache/cdx-mp2/sources/dragon.webm",
    bridge: ".cache/cdx-mp2/sources/bridge.webm",
    machine: ".cache/cdx-mp2/sources/machine.webm",
    fast60: "assets/toys/moving-photo-3d/cdx-mp2-fast-60.webm",
  };
  for (const [id, path] of Object.entries(paths))
    for (const upload of id === "fast60" ? [true] : [false, true]) {
      if (option("ids", "") && !option("ids").split(",").includes(id)) continue;
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      page.on("pageerror", (e) => errors.push(e.message));
      if (option("baseline", ""))
        for (const file of [
          "src/packs/moving-photo.js",
          "src/packs/photo-sharp.js",
          "src/packs/song-stream.js",
          "src/live/clip-stabilize.js",
        ])
          await page.route(`**/${file}`, (r) =>
            r.fulfill({
              contentType: "text/javascript",
              body: execFileSync("git", ["show", `${option("baseline")}:${file}`], {
                encoding: "utf8",
              }),
            }),
          );
      await page.goto(
        `${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}?renderer=webgl2&adapt=off&profile=low&labs=1`,
      );
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
      const result = await page.evaluate(
        async ({ id, path, upload }) => {
          const m = await import("/src/packs/moving-photo.js");
          const { ReliefMesh } = await import("/src/live/relief-mesh.js");
          const { app, player } = window.__splashery;
          app.setControl("play", 0);
          window.__psv.set("moving-photo-3d", "splats");
          player.stage.toy.entity.enabled = false;
          player.stage.setClearColor([0, 0, 0], 0);
          player.idle.weight = 0;
          player.opts.idleDelay = 1e9;
          player.camera.setState(
            { yaw: 0.18, pitch: 0.08, roll: 0, distance: 4.5 },
            { snap: true },
          );
          let clip;
          if (upload) {
            const blob = await (await fetch(`/${path}`)).blob();
            clip = await m.openClip(
              new File([blob], path.split("/").pop(), { type: blob.type }),
              id,
            );
            await clip.refinement?.finished;
          } else clip = await m.loadSample(id);
          const height = (2 * clip.h) / clip.w;
          const mesh = new ReliefMesh(player.stage, { cols: clip.w, rows: clip.h });
          player.stage.app.root.addChild(mesh.node);
          mesh.set({
            width: 2,
            height,
            lift: 0.54,
            base: 0,
            backOffset: -0.02,
            backFlat: -0.02,
            layers: 0,
            cut: 0.05,
            reach: 0.11,
            fit: { center: [0, 0, 0], scale: 1 },
            toy: [0, 0, 0],
            bodyQ: [0, 0, 0, 1],
            bodyT: [0, 0, 0],
            frame: { across: 0.025, down: 0.05 / height, z: 0.002 },
          });
          mesh.show(true);
          mesh.setColor({ w: clip.w, h: clip.h, data: clip.colors[0] });
          mesh.setDepth({ w: clip.w, h: clip.h, data: clip.near[0] });
          mesh.show(true);
          await player.stage.captureFrame();
          await player.stage.captureFrame();
          let pixels = 0,
            holes = 0,
            backing = 0;
          const points = [
            [-0.7, -0.35 * height],
            [0.7, -0.35 * height],
            [0.7, 0.35 * height],
            [-0.7, 0.35 * height],
          ].map(([x, y]) => player.stage.toScreen([x, y, 0]));
          const inside = (x, y) => {
            let pos = false,
              neg = false;
            for (let i = 0; i < 4; i++) {
              const a = points[i],
                b = points[(i + 1) % 4];
              const sign = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
              if (sign > 0) pos = true;
              if (sign < 0) neg = true;
            }
            return !(pos && neg);
          };
          const pink = (px, i) => px[i] > 245 && px[i + 1] < 10 && px[i + 2] > 245;
          for (const fraction of [0.05, 0.5, 0.9]) {
            const f = m.frameAt(clip, fraction * clip.duration);
            mesh.setColor({ w: clip.w, h: clip.h, data: clip.colors[f] });
            mesh.setDepth({ w: clip.w, h: clip.h, data: clip.near[f] });
            mesh.show(true);
            mesh.set({ tint: false });
            const plain = await player.stage.captureFrame();
            const px = plain.getContext("2d").getImageData(0, 0, plain.width, plain.height).data;
            mesh.set({ tint: true });
            const markedFrame = await player.stage.captureFrame();
            const marked = markedFrame
              .getContext("2d")
              .getImageData(0, 0, plain.width, plain.height).data;
            for (let y = 0; y < plain.height; y++)
              for (let x = 0; x < plain.width; x++) {
                if (!inside(x + 0.5, y + 0.5)) continue;
                const i = (y * plain.width + x) * 4;
                pixels++;
                holes += px[i + 3] < 128;
                backing += pink(marked, i) && !pink(px, i);
              }
          }
          mesh.destroy();
          clip.audio?.track.close();
          clip.video?.pause();
          clip.refinement?.cancel();
          if (clip.url) URL.revokeObjectURL(clip.url);
          return {
            pixels,
            w: clip.w,
            h: clip.h,
            frames: clip.n,
            holeShare: holes / Math.max(1, pixels),
            backingShare: backing / Math.max(1, pixels),
            normalization: clip.refinement?.normalization || null,
            scores: clip.refinement?.scores || null,
          };
        },
        { id, path, upload },
      );
      await page.close();
      const row = { id, upload, ...result };
      results.push(row);
      console.log(JSON.stringify(row));
      await fs.writeFile(
        option("out", ".cache/cdx-mp2/holes-after.json"),
        JSON.stringify({ results, errors }, null, 2) + "\n",
      );
    }
} finally {
  await browser.close();
}
