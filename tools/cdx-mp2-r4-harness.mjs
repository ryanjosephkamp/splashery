// Shared, explicit browser conditions for round 4's measurements.
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { SAMPLES, LONG_SAMPLES } from "../src/packs/moving-photo.js";

export const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
};
export const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
export const option = (key, fallback = "") =>
  process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
export async function caseInputHashes(item, selectedPath, code) {
  const files = new Set(item.source ? [item.source] : []),
    sample = SAMPLES.find((sample) => sample.id === item.id),
    long = LONG_SAMPLES.find((sample) => sample.id === item.id);
  if (sample) {
    files.add(`assets/toys/moving-photo-3d/${sample.file}.depth`);
    if (sample.sound) files.add(`assets/toys/moving-photo-3d/${sample.sound}.mp3`);
    for (let sheet = 1; sheet <= sample.sheets; sheet++)
      files.add(`assets/toys/moving-photo-3d/${sample.file}-sheet-${sheet}.jpg`);
  }
  if (long && selectedPath === "sample")
    files.add(`assets/toys/moving-photo-3d/${long.file}.mp2depth`);
  return Promise.all(
    [...files].map(async (file) => {
      const bytes = code.get(file) || (await fs.readFile(file));
      return {
        file,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }),
  );
}
export async function snapshot(baseline = "") {
  const files = [
    "src/packs/moving-photo.js",
    "src/packs/photo-sharp.js",
    "src/packs/song-stream.js",
    "src/live/clip-stabilize.js",
    ...(!baseline
      ? [
          "src/packs/moving-photo-raster.js",
          "src/packs/moving-photo-depth.js",
          "src/packs/moving-photo-geometry.js",
          "src/packs/moving-photo-geometry-worker.js",
          "src/packs/moving-photo-video-worker.js",
          "assets/toys/moving-photo-3d/clip-geometry.wasm",
        ]
      : []),
    ...(baseline
      ? ["bunny", "sintel", "elephants", "tears"].map(
          (name) => `assets/toys/moving-photo-3d/${name}-long.mp2depth`,
        )
      : []),
  ];
  const code = new Map(),
    hash = createHash("sha256");
  for (const file of files) {
    if (baseline) {
      try {
        execFileSync("git", ["cat-file", "-e", `${baseline}:${file}`], { stdio: "ignore" });
      } catch {
        continue;
      }
    }
    const bytes = baseline
      ? execFileSync("git", ["show", `${baseline}:${file}`], { maxBuffer: 128 << 20 })
      : await fs.readFile(file);
    code.set(file, bytes);
    hash.update(file + "\0").update(bytes);
  }
  return { code, sourceHash: hash.digest("hex") };
}
export async function routeCode(context, code) {
  for (const [file, body] of code)
    await context.route(`**/${file}`, (route) =>
      route.fulfill({
        contentType: file.endsWith(".wasm")
          ? "application/wasm"
          : file.endsWith(".mp2depth")
            ? "application/octet-stream"
            : "text/javascript",
        body,
      }),
    );
}
export async function selectCase(page, item, baseline = "") {
  const hasLongSample =
    item.long &&
    (await page.evaluate(
      (id) => window.__r4Moving.LONG_SAMPLES?.some((sample) => sample.id === id) || false,
      item.id,
    ));
  const upload = !!item.upload || !!(baseline && item.long && !hasLongSample);
  if (upload) {
    await page.evaluate(() => (window.__r4PreviousCustom = window.__r4Moving.MOVING.custom));
    await page.setInputFiles("#toy-input-file", item.source);
    await page.waitForFunction(
      () => {
        const c = window.__r4Moving.MOVING;
        return (
          c.custom &&
          c.custom !== window.__r4PreviousCustom &&
          c.clip === c.custom &&
          !window.__splashery.player.loading
        );
      },
      null,
      { timeout: 600000 },
    );
  } else {
    await page.evaluate(async (id) => {
      const { app } = window.__splashery;
      if (id === "sample") await app.setToyOptions({ clip: "horse" });
      await app.setToyOptions({ clip: id });
    }, item.id);
  }
  await page.waitForFunction(() => !window.__splashery.player.loading);
  return upload ? "upload" : "sample";
}
