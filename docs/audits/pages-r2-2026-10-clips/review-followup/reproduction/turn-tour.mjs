// Review supplement: actual renderer, stepped 8 fps; preparation waits omitted.
// Code MIT; recording contributions CC0, made by Ryan with Codex (GPT-6).
import { chromium } from "playwright";
import config from "../../playwright.config.mjs";
import { twoFigurePDF } from "../../tests/fixtures/pg6/make-pdf.mjs";
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const root = "work/pages-r2/turn-tours";
fs.mkdirSync(root, { recursive: true });
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const runtimeFiles = [
  "src/packs/pictures.js",
  "src/pictures.js",
  "src/media.js",
  "src/picture-splats.js",
  "src/picture-surface.js",
  "src/player.js",
  "src/stage.js",
];
const runtimeSha256 = crypto
  .createHash("sha256")
  .update(Buffer.concat(runtimeFiles.map((p) => fs.readFileSync(p))))
  .digest("hex");
const browser = await chromium.launch(config.use.launchOptions);
try {
  for (const toy of ["your-book", "photo-album"]) {
    const dir = `${root}/${toy}`;
    fs.mkdirSync(dir, { recursive: true });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4173/?renderer=webgl2&profile=low&adapt=off&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(
      async ({ toy, pdf }) => {
        const a = window.__splashery.app;
        await a.chooseToy(toy);
        if (toy === "your-book")
          await a.openMedia(
            new File([new Uint8Array(pdf)], "two-figures.pdf", { type: "application/pdf" }),
          );
      },
      { toy, pdf: Array.from(twoFigurePDF()) },
    );
    const ready = () =>
      page.waitForFunction(
        () => {
          const p = window.__splashery.player;
          p.stage.requestRender();
          return (
            p.pictures?.media &&
            p.pictures.splats() > 0 &&
            p.pictures.sheets.every((s) => !s.want || s.shown?.key === s.want.key)
          );
        },
        null,
        { timeout: 180000 },
      );
    await ready();
    const destinations = await page.evaluate((toy) => {
      const p = window.__splashery.player;
      p.frozen = true;
      p.camera.cur.yaw = p.camera.tgt.yaw = 0.22;
      p.camera.cur.pitch = p.camera.tgt.pitch = 0.08;
      p.camera.interact();
      return toy === "your-book" ? [1, 2, 1, 0] : [1, 2, p.pictures.media.count - 1, 2, 0, "close"];
    }, toy);
    const observations = [];
    let n = 0;
    const shot = async (destination) => {
      await ready();
      const state = await page.evaluate(
        async ({ toy, destination }) => {
          const p = window.__splashery.player;
          const f = await p.stage.captureFrame();
          const c = document.createElement("canvas");
          c.width = 390;
          c.height = 844;
          const g = c.getContext("2d");
          g.fillStyle = "white";
          g.fillRect(0, 0, 390, 844);
          g.drawImage(f, 0, 44, 390, (f.height * 390) / f.width);
          g.fillStyle = "#17202a";
          g.font = "14px sans-serif";
          g.fillText(`${toy.replaceAll("-", " ")} · Covers and interior turns`, 8, 23);
          g.font = "11px sans-serif";
          g.fillText("Corrected source · actual canvas · stepped 8 fps", 8, 828);
          return {
            png: c.toDataURL(),
            page: p.pictures.page,
            destination,
            cover: p.motion.out.parts.cover?.angle,
          };
        },
        { toy, destination },
      );
      fs.writeFileSync(
        `${dir}/${String(n).padStart(5, "0")}.png`,
        Buffer.from(state.png.split(",")[1], "base64"),
      );
      delete state.png;
      observations.push({ frame: n++, ...state });
    };
    await shot(0);
    for (const destination of destinations) {
      await page.evaluate((n) => {
        const p = window.__splashery.player;
        if (n === "close") p.act(p.fromRecipe([-0.3, 0, 0.02]));
        else p.pictures.go(n);
      }, destination);
      for (let i = 0; i < 20; i++) {
        await page.evaluate(async () => {
          const p = window.__splashery.player;
          p.time += 0.125;
          p.camera.update(0.125);
          for (let j = 0; j < 2; j++) await p.stage.captureFrame();
        });
        await shot(destination);
      }
      console.log(toy, "destination", destination, "frames", n);
    }
    fs.writeFileSync(
      `${root}/${toy}.json`,
      JSON.stringify(
        {
          sourceCommit,
          runtimeSha256,
          stepFPS: 8,
          captureDrawsPerStep: 3,
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          profile: "low",
          backend: await page.evaluate(() => window.__splashery.player.stage.device.deviceType),
          destinations,
          observations,
          errors,
        },
        null,
        2,
      ) + "\n",
    );
    if (observations.at(-1).cover !== 0) throw Error("Cover did not shut");
    if (errors.length) throw Error(errors.join("\n"));
    await page.close();
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-framerate",
      "8",
      "-i",
      `${dir}/%05d.png`,
      "-r",
      "24",
      "-c:v",
      "libx264",
      "-crf",
      "16",
      "-preset",
      "medium",
      "-threads",
      "2",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      `${root}/${toy}.mp4`,
    ]);
  }
} finally {
  await browser.close();
}
