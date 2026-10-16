import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const deps =
  process.env.SPLASHERY_DEPENDENCIES ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../node_modules");
const { chromium } = await import(pathToFileURL(path.join(deps, "playwright/index.mjs")));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const output = args.find((arg) => arg.startsWith("--out="))?.slice(6);
if (!output) throw new Error("Choose a new --out=directory; supplied examples are preserved");
const ROOT = path.resolve(output);
await fs.mkdir(ROOT);
await fs.mkdir(path.join(ROOT, "exports"));
await fs.mkdir(path.join(ROOT, "evidence"));
const source = args.find((arg) => arg.startsWith("--sources="))?.slice(10);
const samples = JSON.parse(await fs.readFile(source || path.join(HERE, "sources.json"), "utf8"));
const browser = await chromium.launch({
  executablePath:
    process.env.SPLASHERY_CHROMIUM ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const receipts = [];
try {
  const page = await browser.newPage();
  await page.addInitScript((samples) => {
    window.__asciiSources = samples;
  }, samples);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    `${process.env.SPLASHERY_URL || "http://127.0.0.1:47846/"}docs/audits/ascii-capture-encoding-prototype/index.html`,
  );
  await page.waitForSelector("body[data-ready='true']", { timeout: 30_000 });
  console.log(
    JSON.stringify({
      videoSupport: await page.evaluate(() => window.__asciiLab.support),
    }),
  );
  for (const toy of ["grapes", "orange", "strawberry"]) {
    await page.selectOption("#toy", toy);
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    for (const color of [false, true]) {
      await page.locator("#color").setChecked(color);
      const dir = path.join(ROOT, "exports", toy, `96-${color ? "color" : "mono"}`);
      await fs.mkdir(dir, { recursive: true });
      const start = performance.now();
      const data = await page.evaluate(async () => {
        const { renderTextCanvas } = await import("./ascii.js");
        const { encodeGif, encodeVideo } = await import("./encoders.js");
        const lab = window.__asciiLab;
        const frames = lab.frames,
          footer = lab.footer();
        const metadata = {
          ...lab.sample,
          frames: undefined,
          settings: lab.settings,
          credit: lab.sample.credit ?? null,
        };
        const canvas = document.createElement("canvas");
        const pngs = frames.map((frame) => {
          renderTextCanvas(canvas, frame, {
            color: lab.settings.color,
            footer,
          });
          return canvas.toDataURL();
        });
        const base64 = (blob) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(",")[1]);
            reader.readAsDataURL(blob);
          });
        const options = {
          fps: lab.sample.fps,
          color: lab.settings.color,
          footer,
          metadata,
        };
        const gif = await encodeGif(frames, options);
        const video = await encodeVideo(frames, options);
        return {
          sequence: { ...metadata, frames, footer },
          pngs,
          gif: await base64(gif.blob),
          video: await base64(video.blob),
          gifReceipt: {
            width: gif.width,
            height: gif.height,
            delays: gif.delays,
            durationMs: gif.durationMs,
          },
          videoReceipt: {
            ...video,
            blob: undefined,
            cleanup: window.__asciiVideoCleanup,
          },
        };
      });
      for (const [i, png] of data.pngs.entries())
        await fs.writeFile(
          path.join(dir, `frame-${String(i).padStart(3, "0")}.png`),
          Buffer.from(png.split(",")[1], "base64"),
          { flag: "wx" },
        );
      await fs.writeFile(path.join(dir, "animation.gif"), Buffer.from(data.gif, "base64"), {
        flag: "wx",
      });
      await fs.writeFile(
        path.join(dir, `browser.${data.videoReceipt.ext}`),
        Buffer.from(data.video, "base64"),
        { flag: "wx" },
      );
      await fs.writeFile(path.join(dir, "frames.json"), JSON.stringify(data.sequence) + "\n", {
        flag: "wx",
      });
      await fs.writeFile(
        path.join(dir, "CREDITS.txt"),
        JSON.stringify(
          data.sequence.credit ?? {
            source: `Splashery ${toy}; procedural source`,
            license: "MIT",
          },
          null,
          2,
        ) +
          "\nFresh fixed-view capture; PNG source downsampled for the portable demo; converted to ASCII and encoded from these settings.\n",
        { flag: "wx" },
      );
      const changed = data.sequence.frames
        .slice(1)
        .filter(
          (frame, i) => frame.rows.join("\n") !== data.sequence.frames[i].rows.join("\n"),
        ).length;
      receipts.push({
        toy,
        color,
        fps: data.sequence.fps,
        frameCount: data.sequence.frames.length,
        changedTextTransitions: changed,
        gif: data.gifReceipt,
        video: data.videoReceipt,
        wallMs: Math.round(performance.now() - start),
      });
      console.log(JSON.stringify(receipts.at(-1)));
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  await fs.writeFile(
    path.join(ROOT, "evidence/encoding.json"),
    JSON.stringify({ browser: browser.version(), errors, exports: receipts }, null, 2) + "\n",
    { flag: "wx" },
  );
} finally {
  await browser.close();
}
