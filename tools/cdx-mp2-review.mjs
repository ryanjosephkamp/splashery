#!/usr/bin/env node
// The live-clip capture pipeline with explicit, verified media seeks. The
// camera and presentation clock are controlled; video decoding, model depth,
// the app, and its renderer are real. Live timing and sound have separate tests.
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import gifenc from "gifenc";
import fs from "node:fs/promises";
const { GIFEncoder, quantize, applyPalette } = gifenc;
const dir = process.argv[2] || ".cache/cdx-mp2/review";
const ids = process.argv.slice(3);
const cases = [
  ["bunny", "sample"],
  ["horse", "horse"],
  ["sintel", "dragon"],
  ["bridge", "bridge"],
  ["machine", "machine"],
  ["bunny-long", "sample-long"],
  ["sintel-long", "dragon-long"],
  ["machine-long", "machine-long"],
  ["bridge-long", "bridge-long"],
  ["upload", "custom"],
  ["machine-upload", "custom", ".cache/cdx-mp2/sources/machine.webm"],
];
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
try {
  for (const [name, id, source] of cases.filter(([n]) => !ids.length || ids.includes(n))) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on("pageerror", (e) => {
      throw e;
    });
    await page.goto(
      `${process.env.SPLASHERY_URL || "http://127.0.0.1:4388/"}?renderer=webgl2&adapt=off&profile=low&labs=1`,
    );
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
    if (id === "custom") {
      await page.evaluate(
        async () => (window.__reviewM = await import("/src/packs/moving-photo.js")),
      );
      const input = source || "assets/toys/screen/bunny.webm";
      await page.setInputFiles("#toy-input-file", input);
      await page.waitForFunction(
        (name) => {
          const clip = window.__reviewM.MOVING.clip;
          return clip?.name === name && !!clip.refinement && !window.__splashery.player.loading;
        },
        input
          .split("/")
          .pop()
          .replace(/\.[^.]+$/, ""),
        { timeout: 600_000 },
      );
      await page.evaluate(async () => {
        const m = await import("/src/packs/moving-photo.js");
        await m.MOVING.clip.refinement?.finished;
      });
    } else await page.evaluate((clip) => window.__splashery.app.setToyOptions({ clip }), id);
    await page.evaluate(async () => {
      const m = await import("/src/packs/moving-photo.js");
      const { player, app } = window.__splashery;
      app.setControl("play", 0);
      player.motion.recipe.drive = () => {};
      player.idle.weight = 0;
      player.opts.idleDelay = 1e9;
      player.camera.setState(
        { ...player.camera.getState(), yaw: 0.18, pitch: 0.08 },
        { snap: true },
      );
      m.MOVING.clip.audio?.track.pause();
      if (m.MOVING.clip.video) m.MOVING.clip.video.pause();
      else if (m.MOVING.clip.audio) m.MOVING.clip.audio.url = "";
      window.__psv.set("moving-photo-3d", "splats");
      window.__psv.set("moving-photo-3d", "sharp");
    });
    const frames = [],
      clocks = [];
    for (let i = 0; i < 48; i++) {
      clocks.push(
        await page.evaluate(async (seconds) => {
          const m = await import("/src/packs/moving-photo.js");
          const c = m.MOVING.clip,
            t = seconds % c.duration;
          m.MOVING.t = t;
          m.MOVING.frame = m.frameAt(c, t);
          if (c.video && Math.abs(c.video.currentTime - t) > 0.001) {
            await new Promise((resolve, reject) => {
              const timer = setTimeout(() => {
                c.video.removeEventListener("seeked", done);
                reject(new Error("Video seek timed out"));
              }, 10000);
              const done = () => {
                if (c.video.seeking || Math.abs(c.video.currentTime - t) > 0.042) return;
                clearTimeout(timer);
                c.video.removeEventListener("seeked", done);
                resolve();
              };
              c.video.addEventListener("seeked", done);
              c.video.currentTime = t;
            });
          }
          const canvas = (window.__reviewCanvas ||= document.createElement("canvas"));
          canvas.width = m.MOVING.grid.cols * 2;
          canvas.height = m.MOVING.grid.rows;
          m.MOVING_PHOTO.screen.draw(canvas.getContext("2d"));
          (await import("/src/packs/photo-sharp.js")).sharpDrive({});
          await window.__splashery.player.stage.captureFrame();
          return {
            t: m.MOVING.t,
            frame: m.MOVING.frame,
            video: c.video?.currentTime,
            name: c.name,
            sample: c.sample || null,
            refined: c.refinement ? c.refinement.done && !c.refinement.error : null,
          };
        }, i / 8),
      );
      frames.push(PNG.sync.read(await page.screenshot()));
    }
    const gif = GIFEncoder();
    for (const f of frames) {
      const rgba = new Uint8Array(f.data.buffer, f.data.byteOffset, f.data.length);
      const palette = quantize(rgba, 256, { format: "rgb565" });
      gif.writeFrame(applyPalette(rgba, palette, "rgb565"), 390, 844, {
        palette,
        delay: 125,
        repeat: 0,
      });
    }
    gif.finish();
    await fs.writeFile(`${dir}/${name}.gif`, gif.bytes());
    await fs.writeFile(`${dir}/${name}-clocks.json`, JSON.stringify(clocks, null, 2) + "\n");
    const strip = new PNG({ width: 390 * 5, height: 844 });
    for (let j = 0; j < 5; j++) {
      const f = frames[Math.round((j / 4) * (frames.length - 1))];
      for (let y = 0; y < 844; y++)
        f.data.copy(strip.data, (y * strip.width + j * 390) * 4, y * 390 * 4, (y + 1) * 390 * 4);
    }
    await fs.writeFile(`${dir}/${name}-strip.png`, PNG.sync.write(strip));
    console.log(name, JSON.stringify(clocks.at(-1)));
    await page.close();
  }
} finally {
  await browser.close();
}
