// The engine addition for lane Sound A (docs/handoff/SoundA.md): the `sample`
// voice (a short recorded file from assets/sounds/, fetched on its first
// play, cached, with a quiet synth fallback) and tools/sound-lint.mjs.

import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { specProblems, samplesIn } from "../src/voices.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

// A short WAV (a decaying 440 Hz tone): Chromium decodes it whatever its name.
function wav(seconds = 0.4, rate = 22050) {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * Math.exp(-i / (rate * 0.1)) * 20000), 44 + i * 2); // prettier-ignore
  return b;
}

test("sample specs are checked: a file name, sample-only keys, synth fallbacks", () => {
  expect(specProblems({ voice: "sample", file: "cat-statue-meow.mp3" })).toEqual([]);
  expect(specProblems({ voice: "sample", file: ["a-1.mp3", "a-2.m4a"], pitch: 0.9, from: 0.1, len: 1, fallback: { voice: "mew" } })).toEqual([]); // prettier-ignore
  expect(specProblems({ voice: "sample" }).join()).toMatch(/needs a file/);
  expect(specProblems({ voice: "sample", file: "Meow.wav" }).join()).toMatch(/bad sample file/);
  expect(specProblems({ voice: "sample", file: "a.mp3", f: 440 }).join()).toMatch(/pitch, not f/);
  expect(specProblems({ voice: "thud", file: "a.mp3" }).join()).toMatch(/only for the sample/);
  expect(specProblems({ voice: "sample", file: "a.mp3", fallback: { voice: "sample", file: "b.mp3" } }).join()).toMatch(/synth/); // prettier-ignore
  expect(samplesIn({ on: [{ voice: "sample", file: ["a.mp3", "b.mp3"] }, { voice: "thud" }], off: { voice: "sample", file: "a.mp3" } })).toEqual(["a.mp3", "b.mp3"]); // prettier-ignore
});

test("a sample is fetched on its first play only, then cached; a missing file falls back quietly", async ({
  page,
}) => {
  const fetched = [];
  const problems = [];
  page.on("console", (m) => ["error", "warning"].includes(m.type()) && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("request", (r) => r.url().includes("/assets/sounds/") && fetched.push(r.url()));
  await page.route("**/assets/sounds/snda-test.mp3", (r) =>
    r.fulfill({ status: 200, contentType: "audio/mpeg", body: wav() }),
  );
  await page.route("**/assets/sounds/snda-missing.mp3", (r) => r.fulfill({ status: 404 }));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  expect(fetched).toEqual([]);

  // The first play fetches the file and plays it (with its other layers).
  const played = await page.evaluate(async () => {
    const { samplesReady } = await import("/src/voices.js");
    const sound = window.__splashery.app.sound;
    sound.setEnabled(true);
    const spec = [
      { voice: "sample", file: "snda-test.mp3" },
      { voice: "thud", vol: 0.3 },
    ];
    sound.play(spec, { key: "t1" });
    const t0 = performance.now();
    while (!samplesReady(spec) && performance.now() - t0 < 5000)
      await new Promise((r) => setTimeout(r, 20));
    sound.play(spec, { key: "t2" });
    sound.play({ voice: "sample", file: "snda-test.mp3", pitch: 1.3, from: 0.1 }, { key: "t3" });
    return samplesReady(spec);
  });
  expect(played).toBe(true);
  expect(fetched.filter((u) => u.endsWith("snda-test.mp3"))).toHaveLength(1);

  // A file that can't load plays its fallback instead, without an error.
  const fell = await page.evaluate(async () => {
    const { samplesReady } = await import("/src/voices.js");
    const sound = window.__splashery.app.sound;
    const spec = { voice: "sample", file: "snda-missing.mp3", fallback: { voice: "mew" } };
    sound.play(spec, { key: "t4" });
    const t0 = performance.now();
    while (!samplesReady(spec) && performance.now() - t0 < 5000)
      await new Promise((r) => setTimeout(r, 20));
    sound.play(spec, { key: "t5" });
    return samplesReady(spec);
  });
  expect(fell).toBe(true);
  await page.waitForTimeout(300);
  expect(problems.filter((p) => !/snda-missing|404/.test(p))).toEqual([]);
});

test("offline renders load the samples first and hear them", async ({ page }) => {
  await page.route("**/assets/sounds/snda-test.mp3", (r) =>
    r.fulfill({ status: 200, contentType: "audio/mpeg", body: wav() }),
  );
  await page.goto("/tools/");
  const peaks = await page.evaluate(async () => {
    const { playSpec, loadSamples, SAMPLES } = await import("/src/voices.js");
    SAMPLES.base = "/assets/sounds/";
    const render = async (spec) => {
      const ctx = new OfflineAudioContext(1, 22050, 22050);
      await loadSamples(ctx, spec);
      playSpec(ctx, ctx.destination, 0.01, spec);
      const d = (await ctx.startRendering()).getChannelData(0);
      return d.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    };
    return {
      full: await render({ voice: "sample", file: "snda-test.mp3" }),
      quiet: await render({ voice: "sample", file: "snda-test.mp3", vol: 0.25 }),
      cut: await render({ voice: "sample", file: "snda-test.mp3", from: 0.3 }),
    };
  });
  expect(peaks.full).toBeGreaterThan(0.3);
  expect(peaks.quiet).toBeLessThan(peaks.full * 0.35);
  expect(peaks.cut).toBeLessThan(peaks.full * 0.2);
});

test("the sound lint fails a rising hum and passes a soft thud", () => {
  const lint = (spec) => {
    try {
      execFileSync("node", ["tools/sound-lint.mjs", "--spec", JSON.stringify(spec)], { encoding: "utf8" }); // prettier-ignore
      return 0;
    } catch (e) {
      return e.status;
    }
  };
  expect(lint({ voice: "hum", f: 110, to: 3, decay: 2.4 })).toBe(1);
  expect(lint({ voice: "whistle", f: 2400, decay: 2 })).toBe(1);
  expect(lint({ voice: "thud" })).toBe(0);
});

test("the About tab credits a toy's recorded samples, and opening the toy fetches none", async ({
  page,
}) => {
  const fetched = [];
  page.on("request", (r) => r.url().includes("/assets/sounds/") && fetched.push(r.url()));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async () => {
    const { TOY_SOUNDS } = await import("/src/toy-sounds.js");
    const { SOUND_CREDITS } = await import("/src/sound-credits.js");
    TOY_SOUNDS.bee = { voice: "sample", file: "snda-test.mp3" };
    SOUND_CREDITS["snda-test.mp3"] = {
      label: "Buzz",
      title: "A test buzz",
      author: "Nobody",
      source: "https://example.org/buzz",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    };
    await window.__splashery.app.chooseToy("bee");
  });
  await expect(page.locator('#credits [data-sample="snda-test.mp3"]')).toContainText(
    "Buzz: “A test buzz” by Nobody, CC0 1.0.",
  );
  await page.waitForTimeout(500);
  expect(fetched).toEqual([]);
});
