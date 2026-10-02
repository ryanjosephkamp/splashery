// Lane Live input (docs/handoff/LiveInput.md): the live toys, end to end,
// with Chromium's fake devices. The microphone plays WAV files made here
// (a sine note, a clap with a known decay, steady noise); the camera is
// Chromium's own test pattern. The sums themselves are tested in
// tests/live-engine.spec.mjs.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import config from "../playwright.config.mjs";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const RATE = 48000;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "splashery-live-"));

// ---- Test signals ------------------------------------------------------------------
function wav(name, samples) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2)); // prettier-ignore
  const file = path.join(DIR, name);
  fs.writeFileSync(file, b);
  return file;
}
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
// A4 (440 Hz) with two harmonics, 4 s.
const A4 = wav(
  "a4.wav",
  Array.from({ length: RATE * 4 }, (_, i) => {
    const t = i / RATE;
    return 0.25 * Math.sin(2 * Math.PI * 440 * t) + 0.1 * Math.sin(4 * Math.PI * 440 * t) + 0.04 * Math.sin(6 * Math.PI * 440 * t); // prettier-ignore
  }),
);
// G3 (196 Hz, near the sung plate's 195 Hz mode), 6 s.
const G3 = wav(
  "g3.wav",
  Array.from({ length: RATE * 6 }, (_, i) => {
    const t = i / RATE;
    return 0.25 * Math.sin(2 * Math.PI * 196 * t) + 0.1 * Math.sin(4 * Math.PI * 196 * t);
  }),
);
// Quiet background, then a clap whose energy falls 60 dB in 0.6 s, 9 s long.
const CLAP_RT = 0.6;
const CLAP = wav(
  "clap.wav",
  Array.from({ length: RATE * 9 }, (_, i) => {
    const t = i / RATE - 1.5;
    return 0.003 * rnd() + (t >= 0 ? 0.8 * rnd() * Math.exp((-6.91 * t) / CLAP_RT) : 0);
  }),
);
// Steady noise, loud, 6 s.
const NOISE = wav(
  "noise.wav",
  Array.from({ length: RATE * 6 }, () => 0.3 * rnd()),
);

const withMic = (file) => ({
  launchOptions: {
    ...config.use.launchOptions,
    args: [
      ...config.use.launchOptions.args,
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      ...(file ? [`--use-file-for-fake-audio-capture=${file}`] : []),
    ],
  },
});

// Counts getUserMedia / getDisplayMedia calls from the start.
const SPY = () => {
  window.__liveCalls = [];
  const md = navigator.mediaDevices;
  for (const name of ["getUserMedia", "getDisplayMedia"]) {
    const f = md?.[name]?.bind(md);
    if (f)
      md[name] = (...a) => {
        window.__liveCalls.push(name);
        return f(...a);
      };
  }
};

async function open(page, toy) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((t) => window.__splashery.app.chooseToy(t), toy);
  await page.waitForFunction((t) => window.__splashery.player.scene.toy.id === t && window.__splashery.player.motion.recipe, toy, { timeout: 120_000 }); // prettier-ignore
}

// Waits until an async check in the page is true (waitForFunction would
// take the promise itself as true).
async function until(page, check, arg = null, timeout = 120_000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await page.evaluate(check, arg)) return;
    if (Date.now() > end) throw new Error(`Timed out waiting for ${check}`);
    await page.waitForTimeout(250);
  }
}

// A script click: on a phone the Toy tab may be folded away.
const tap = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);

const idle = (page) =>
  page.waitForFunction(() => document.getElementById("progress").hidden && window.__splashery.player.motion.recipe, null, { timeout: 180_000 }); // prettier-ignore

test.use(withMic(null));

// A browser whose microphone plays `file` (a launch option, so each gets its own).
async function micPage(playwright, baseURL, file, viewport = { width: 1440, height: 900 }) {
  const browser = await playwright.chromium.launch(withMic(file).launchOptions);
  const page = await browser.newPage({ baseURL, viewport });
  return { page, close: () => browser.close() };
}

test.describe("before a tap", () => {
  test("no toy asks for a device or loads the depth model until its button is tapped", async ({
    page,
  }) => {
    const fetched = [];
    page.on("request", (r) => fetched.push(r.url()));
    await page.addInitScript(SPY);
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    for (const id of [
      "room-echo",
      "splat-mirror",
      "song-landscape",
      "chladni-plate",
      "photo-3d",
      "screen",
      "grand-piano",
      "electronic-keyboard",
    ]) {
      // prettier-ignore
      await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
      await page.waitForFunction((id) => window.__splashery.player.scene.toy.id === id, id, { timeout: 120_000 }); // prettier-ignore
      await idle(page);
      // Each has its live button (the Screen toy's only on a computer).
      await expect(page.locator("#toy-input .input-live button").first()).toBeAttached();
    }
    expect(await page.evaluate(() => window.__liveCalls)).toEqual([]);
    const bad = fetched.filter((u) => /depth-worker|onnx|depth-anything|capture-worklet|live\/mic\.js|live\/stream\.js/.test(u)); // prettier-ignore
    expect(bad).toEqual([]);
    await expect(page.locator("#live-indicator")).toHaveCount(0);
  });

  test("the Screen toy's share button hides where getDisplayMedia is missing", async ({ page }) => {
    await open(page, "screen");
    await idle(page);
    await expect(page.locator("#live-screen")).toHaveText("Share a screen");
    await page.addInitScript(() => delete MediaDevices.prototype.getDisplayMedia);
    await open(page, "screen");
    await idle(page);
    await expect(page.locator("#toy-input")).toBeAttached();
    await expect(page.locator("#live-screen")).toHaveCount(0);
  });

  test("a refused camera on the mirror shows the message; the mirror keeps its picture", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
    await open(page, "splat-mirror");
    await idle(page);
    await tap(page, "#live-camera");
    await expect(page.locator("#toy-input .warning")).toContainText(
      "The camera wasn't allowed, so it stays off.",
    );
    expect(await page.evaluate(() => window.__splashery.player.toyInfo.kit?.data?.mirror ?? window.__splashery.player.motion.ctx?.kit?.data?.mirror)).toMatchObject({ live: false }); // prettier-ignore
  });
});

test.describe("the camera", () => {
  test("the mirror shows the camera in depth; Stop ends every track and puts the still back", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "splat-mirror");
    await idle(page);
    await tap(page, "#live-camera");
    await expect(page.locator("#live-indicator .live-text")).toHaveText("Live: camera");
    await idle(page);
    // The depth model answers from its worker.
    await until(
      page,
      async () => (await import("/src/live/relief.js")).MIRROR.cam?.have === true,
      null,
      180_000,
    );
    const cam = await page.evaluate(async () => {
      const { MIRROR } = await import("/src/live/relief.js");
      const { live } = await import("/src/live/live.js");
      window.__tracks = live.stream("camera").getTracks();
      return { answers: MIRROR.cam.answers, cols: MIRROR.cols, rows: MIRROR.rows, have: MIRROR.cam.have }; // prettier-ignore
    });
    expect(cam.have).toBe(true);
    expect(cam.cols).toBeGreaterThan(60);
    await page.screenshot({ path: "tests/screenshots/live-mirror-390x844.png" });
    await page.click("#live-stop");
    await expect(page.locator("#live-indicator")).toBeHidden();
    expect(await page.evaluate(() => window.__tracks.map((t) => t.readyState))).toEqual(["ended"]);
    // The toy goes back to its still picture, and the worker is gone.
    await until(page, async () => !(await import("/src/live/relief.js")).MIRROR.cam, null, 120_000);
  });

  test("Photo to 3D's live view takes the picture as a photo in 3D", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "photo-3d");
    await idle(page);
    await tap(page, "#live-camera");
    await idle(page);
    await expect(page.locator("#live-camera-capture")).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/live-photo3d-1440x900.png" });
    await tap(page, "#live-camera-capture");
    await until(
      page,
      async () => (await import("/src/packs/photo-3d.js")).photoState().custom === true,
      null,
      180_000,
    );
    await expect(page.locator("#live-indicator")).toBeHidden();
  });

  test("a shared screen plays on the Screen toy, which switches itself on", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "screen");
    await idle(page);
    await tap(page, "#live-screen");
    await page.waitForFunction(() => window.__splashery.player.pictures?.media?.live === true, null, { timeout: 120_000 }); // prettier-ignore
    await expect(page.locator("#live-indicator .live-text")).toHaveText("Live: screen");
    expect(await page.evaluate(() => window.__splashery.player.scene.toy.media)).toBeUndefined();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "tests/screenshots/live-screen-1440x900.png" });
    await page.click("#live-stop");
    await page.waitForFunction(() => window.__splashery.player.pictures?.media && !window.__splashery.player.pictures.media.live, null, { timeout: 120_000 }); // prettier-ignore
  });
});

test.describe("a sung A4", () => {
  test("the tuner names the note and holds its key down", async ({ playwright, baseURL }) => {
    const { page, close } = await micPage(playwright, baseURL, A4);
    try {
      await open(page, "electronic-keyboard");
      await idle(page);
      await tap(page, "#live-mic");
      await idle(page);
      await until(
        page,
        async () => (await import("/src/packs/pianos.js")).tunerState().midi === 69,
        null,
        60_000,
      );
      await expect(page.locator("#toy-input .live-status")).toContainText("A4 (440");
      const down = await page.evaluate(() => {
        const levers = window.__splashery.player.motion.out.levers;
        return levers?.[0]?.[69 - 36];
      });
      expect(down).toBeGreaterThan(0.9);
    } finally {
      await close();
    }
  });
});

test.describe("a sung G3", () => {
  test("the Chladni plate hears G3, rings its 195 Hz mode and the sand settles", async ({
    playwright,
    baseURL,
  }) => {
    const { page, close } = await micPage(playwright, baseURL, G3);
    try {
      await open(page, "chladni-plate");
      await idle(page);
      await tap(page, "#live-mic");
      await until(
        page,
        async () => (await import("/src/packs/studio.js")).singState().p > 0.3,
        null,
        60_000,
      );
      const s = await page.evaluate(async () => (await import("/src/packs/studio.js")).singState());
      expect(s.note.name).toBe("G3");
      expect(s.mode).toMatch(/^2-3/);
      await expect(page.locator("#toy-input .live-status")).toContainText("G3");
    } finally {
      await close();
    }
  });

  test("the song landscape turns live, and its rows fill in", async ({ playwright, baseURL }) => {
    const { page, close } = await micPage(playwright, baseURL, G3);
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page, "song-landscape");
      await idle(page);
      await tap(page, "#live-mic");
      await until(
        page,
        () => window.__splashery.player.motion.ctx?.kit?.data?.song?.liveMic === true,
      );
      await idle(page);
      const d = await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.song);
      expect(d).toMatchObject({ liveMic: true, nf: 128 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: "tests/screenshots/live-landscape-390x844.png" });
      // The front row holds the note: its brightest band is near 196 Hz.
      const band = await page.evaluate(() => {
        const c = window.__splashery.player.screen.canvas;
        const g = c.getContext("2d");
        const nf = c.width / 2;
        const row = g.getImageData(nf, 0, nf, 1).data;
        let best = 0;
        for (let f = 1; f < nf; f++) if (row[f * 4] > row[best * 4]) best = f;
        return { best, h: row[best * 4], nf };
      });
      const hz = 40 * (16000 / 40) ** ((band.best + 0.5) / band.nf);
      expect(band.h).toBeGreaterThan(150);
      expect(Math.abs(Math.log2(hz / 196))).toBeLessThan(0.25);
    } finally {
      await close();
    }
  });
});

test.describe("a clap", () => {
  test("the echo meter measures the clap's RT60 within 10%", async ({ playwright, baseURL }) => {
    const { page, close } = await micPage(playwright, baseURL, CLAP);
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page, "room-echo");
      await idle(page);
      await tap(page, "#live-mic");
      await until(
        page,
        async () => {
          const s = (await import("/src/packs/live.js")).echoState();
          return s.result && !s.sample;
        },
        null,
        60_000,
      );
      const s = await page.evaluate(async () => (await import("/src/packs/live.js")).echoState());
      expect(Math.abs(s.result.rt60 - CLAP_RT) / CLAP_RT).toBeLessThan(0.1);
      await expect(page.locator("#toy-input .live-status")).toContainText("RT60 0.");
      await page.screenshot({ path: "tests/screenshots/live-echo-390x844.png" });
    } finally {
      await close();
    }
  });

  test("clap to tap taps the open toy on the clap", async ({ playwright, baseURL }) => {
    const { page, close } = await micPage(playwright, baseURL, CLAP);
    try {
      await open(page, "jack-o-lantern");
      await idle(page);
      await page.evaluate(() => {
        window.__acts = 0;
        window.__splashery.player.on("action", () => window.__acts++);
      });
      await tap(page, "#clap-to-tap");
      await expect(page.locator("#live-indicator .live-text")).toHaveText("Live: microphone");
      await page.waitForFunction(() => window.__acts >= 1, null, { timeout: 30_000 });
      await page.screenshot({ path: "tests/screenshots/live-clap-1440x900.png" });
    } finally {
      await close();
    }
  });
});

test.describe("steady noise", () => {
  test("clap to tap stays still through steady noise; switching it off stops the microphone", async ({
    playwright,
    baseURL,
  }) => {
    const { page, close } = await micPage(playwright, baseURL, NOISE);
    try {
      await open(page, "jack-o-lantern");
      await idle(page);
      await page.evaluate(() => {
        window.__acts = 0;
        window.__splashery.player.on("action", () => window.__acts++);
      });
      await tap(page, "#clap-to-tap");
      await expect(page.locator("#live-indicator .live-text")).toHaveText("Live: microphone");
      await page.waitForTimeout(8000);
      expect(await page.evaluate(() => window.__acts)).toBe(0);
      await tap(page, "#clap-to-tap");
      await expect(page.locator("#live-indicator")).toBeHidden();
    } finally {
      await close();
    }
  });
});

test("the new toys' screenshots on a computer", async ({ page }) => {
  // The phone-size ones come from the tests above (live-echo, live-mirror).
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [id, name] of [
    ["room-echo", "echo"],
    ["splat-mirror", "mirror"],
  ]) {
    await open(page, id);
    await idle(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `tests/screenshots/live-${name}-1440x900.png` });
  }
});
