import { gifDelays } from "./encoders.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test, expect } from "@playwright/test";
import { GifReader } from "../../../vendor/omggif/omggif.js";
import { pixelsToText } from "./ascii.js";
import os from "node:os";
import { execFileSync } from "node:child_process";
let offlineFile, temporaryDirectory;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ready = async (page) => expect(page.locator("body")).toHaveAttribute("data-ready", "true");

test.beforeAll(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "splashery-ascii-package-"));
  offlineFile = path.join(temporaryDirectory, "index.html");
  execFileSync(process.execPath, [path.join(HERE, "build-handback.mjs"), offlineFile]);
});
test.afterAll(async () => {
  if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

test("pure converter retains brightness endpoints, transparency and input bytes", () => {
  const options = {
    columns: 8,
    rows: 4,
    palette: " @",
    gamma: 1,
    blackPoint: 0,
    contrast: 1,
    background: [0, 0, 0],
  };
  for (const [rgba, expected] of [
    [[0, 0, 0, 255], "        "],
    [[255, 255, 255, 255], "@@@@@@@@"],
    [[255, 255, 255, 0], "        "],
  ]) {
    const data = new Uint8ClampedArray(rgba);
    const image = { width: 1, height: 1, data };
    const first = pixelsToText(image, options);
    expect(first.rows).toEqual(Array(4).fill(expected));
    expect(pixelsToText(image, options)).toEqual(first);
    expect(Array.from(data)).toEqual(rgba);
  }
});

test("GIF cumulative timing stays within half a centisecond at all supported rates", () => {
  for (const fps of [8, 10, 12])
    for (const count of [1, 32, 40, 64]) {
      const delays = gifDelays(count, fps);
      let elapsed = 0;
      for (const [i, delay] of delays.entries()) {
        elapsed += delay;
        expect(delay % 10).toBe(0);
        expect(Math.abs(elapsed - ((i + 1) * 1000) / fps)).toBeLessThanOrEqual(5.000001);
      }
    }
  for (const [count, fps] of [
    [0, 10],
    [65, 10],
    [32, 30],
  ])
    expect(() => gifDelays(count, fps)).toThrow();
});

test("offline HTML exports actual selected GIF settings and retains source attribution", async ({
  page,
}) => {
  const file = pathToFileURL(offlineFile).href;
  const unexpected = [],
    errors = [];
  page.on("request", (request) => {
    if (
      request.url() !== file &&
      !request.url().startsWith("data:") &&
      !request.url().startsWith("blob:")
    )
      unexpected.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.context().setOffline(true);
  await page.goto(file);
  await ready(page);
  await page.selectOption("#toy", "strawberry");
  await ready(page);
  await page.selectOption("#columns", "48");
  await ready(page);
  await page.locator("#color").check();
  await page.locator("#make-gif").click();
  await expect(page.locator("#result")).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.locator("#download").click();
  const download = await pending;
  const bytes = await fs.readFile(await download.path());
  await fs.writeFile(path.join(HERE, "evidence/package-strawberry-48-color.gif"), bytes);
  const gif = new GifReader(bytes);
  expect(gif.numFrames()).toBe(40);
  expect(gif.width).toBeLessThan(593);
  expect(bytes.toString("utf8")).toContain("Dany Bittel");
  expect(bytes.toString("utf8")).toContain('"columns":48');
  expect(bytes.toString("utf8")).toContain('"color":true');
  expect(download.suggestedFilename()).toBe("strawberry-48-color.gif");
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
  const sourcePending = page.waitForEvent("download");
  await page.locator("details").first().locator("summary").click();
  await page.locator("#save-source").click();
  const sourceFile = await (await sourcePending).path();
  const source = JSON.parse(await fs.readFile(sourceFile, "utf8"));
  expect(source.credit.license).toBe("CC BY 4.0");
  await page.locator("#import").setInputFiles(sourceFile);
  await ready(page);
  expect(await page.evaluate(() => window.__asciiLab.sample.frames.length)).toBe(40);
});

test("GIF and video cancellation release work and leave no downloadable result", async ({
  page,
}) => {
  await page.goto("index.html");
  await ready(page);
  await page.locator("#make-gif").click();
  await page.locator("#cancel").click();
  await expect(page.locator("#status")).toContainText("canceled");
  await expect(page.locator("#result")).toBeHidden();
  const result = await page.evaluate(async () => {
    const { encodeVideo } = await import("./encoders.js");
    const lab = window.__asciiLab,
      controller = new AbortController();
    try {
      await encodeVideo(lab.frames, {
        fps: lab.sample.fps,
        signal: controller.signal,
        onProgress: () => controller.abort(),
      });
      return { failed: false };
    } catch (error) {
      return {
        failed: error.name === "AbortError",
        cleanup: window.__asciiVideoCleanup,
      };
    }
  });
  expect(result.failed).toBe(true);
  expect(result.cleanup).toEqual({
    stoppedTracks: true,
    recorderInactive: true,
  });
});

test("browser video is decodable, moves, and stops its capture tracks", async ({ page }) => {
  await page.goto("index.html");
  await ready(page);
  await page.locator("#make-video").click();
  await expect(page.locator("#result")).toBeVisible();
  await page.locator("#video-result").evaluate(async (video) => {
    if (video.readyState < 1)
      await new Promise((resolve) =>
        video.addEventListener("loadedmetadata", resolve, { once: true }),
      );
  });
  const motion = await page.locator("#video-result").evaluate(async (video) => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    const shot = async (time) => {
      await new Promise((resolve) => {
        video.addEventListener("seeked", resolve, { once: true });
        video.currentTime = time;
      });
      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL();
    };
    return {
      duration: video.duration,
      changed: (await shot(0.2)) !== (await shot(2.5)),
      cleanup: window.__asciiVideoCleanup,
    };
  });
  expect(motion.duration).toBeGreaterThan(3.7);
  expect(motion.duration).toBeLessThan(4.5);
  expect(motion.changed).toBe(true);
  expect(motion.cleanup.stoppedTracks).toBe(true);
});

test("owned live page restores capture controls after cancellation and callback failure", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=high&adapt=off");
  await page.waitForSelector("body[data-ready='true']", { timeout: 120_000 });
  const result = await page.evaluate(async () => {
    const { captureToy, captureControls } =
      await import("/docs/audits/ascii-capture-encoding-prototype/capture-adapter.js");
    const { app, player } = window.__splashery;
    await app.chooseToy("grapes");
    player.frozen = true;
    player.timeScale = 0.75;
    player.opts.idleDelay = 8;
    player.idle.weight = 0.3;
    player.stage.setFixedSize([320, 320]);
    const outcomes = [];
    for (const failure of ["cancel", "callback"]) {
      const before = captureControls(player),
        controller = new AbortController();
      try {
        await captureToy(player, {
          seconds: 1,
          signal: controller.signal,
          onFrame: () => {
            if (failure === "cancel") controller.abort();
            else throw new Error("Forced callback failure");
          },
        });
      } catch (error) {
        outcomes.push({
          failure,
          error: error.name,
          equal: JSON.stringify(before) === JSON.stringify(captureControls(player)),
          receipt: player.__asciiLastRestore,
        });
      }
    }
    return outcomes;
  });
  expect(result).toHaveLength(2);
  expect(result[0].error).toBe("AbortError");
  expect(result[1].error).toBe("Error");
  expect(result.every((item) => item.equal && Object.values(item.receipt).every(Boolean))).toBe(
    true,
  );
});

test("import rejects remote frames and oversized PNG dimensions before decoding", async ({
  page,
}) => {
  await page.goto("index.html");
  await ready(page);
  const result = await page.evaluate(async () => {
    const { validateSample } = await import("./demo.js");
    const sample = window.__asciiLab.sample;
    const outcomes = [];
    for (const change of ["remote", "oversized", "count"]) {
      const copy = { ...sample, frames: sample.frames.slice() };
      if (change === "remote") copy.frames[0] = "https://example.org/frame.png";
      if (change === "count") copy.frames = Array(65).fill(copy.frames[0]);
      if (change === "oversized") {
        const bytes = Uint8Array.from(atob(copy.frames[0].slice(22)), (c) => c.charCodeAt(0));
        new DataView(bytes.buffer).setUint32(16, 8192);
        copy.frames[0] = "data:image/png;base64," + btoa(String.fromCharCode(...bytes));
      }
      try {
        validateSample(copy);
        outcomes.push(false);
      } catch {
        outcomes.push(true);
      }
    }
    return outcomes;
  });
  expect(result).toEqual([true, true, true]);
});

test("phone and desktop layouts fit with a color animation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pathToFileURL(offlineFile).href);
  await ready(page);
  await page.locator("#color").check();
  await page.locator("#play").click();
  await expect.poll(() => page.locator("#preview").getAttribute("data-frame")).not.toBe("0");
  await page.locator("#play").click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: path.join(HERE, "evidence/package-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: path.join(HERE, "evidence/package-desktop.png"),
    fullPage: true,
  });
});
