// Lane Live input's engine PR (docs/handoff/LiveInput.md): src/live/, the
// input panel's live buttons, the live indicator and Stop, live streams on
// picture sheets, and the relief kind. Chromium's fake devices stand in for
// a microphone and a camera.

import { test, expect } from "@playwright/test";
import config from "../playwright.config.mjs";
import { detectPitch, noteOf, OnsetDetector, measureDecay } from "../src/live/analysis.js";
import { Kit } from "../src/kit.js";
import { KINDS } from "../src/effects.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const FAKE = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];
test.use({ launchOptions: { ...config.use.launchOptions, args: [...config.use.launchOptions.args, ...FAKE] } }); // prettier-ignore

// Counts every getUserMedia and getDisplayMedia call from the start.
const SPY = () => {
  window.__liveCalls = [];
  const md = navigator.mediaDevices;
  if (!md) return;
  for (const name of ["getUserMedia", "getDisplayMedia"]) {
    const f = md[name]?.bind(md);
    if (!f) continue;
    md[name] = (...a) => {
      window.__liveCalls.push(name);
      return f(...a);
    };
  }
};

async function ready(page) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

// Gives the molecule toy's input panel live buttons, as a recipe would.
async function withLive(page, entries) {
  await page.evaluate(async (entries) => {
    const { app, player } = window.__splashery;
    await app.chooseToy("molecule");
    const input = player.toyInfo.recipe.input;
    input.live = entries;
    await app.setToyOptions({});
  }, entries);
  await page.waitForSelector("#toy-input .input-live", { state: "attached" });
}

test("nothing is asked for or loaded before a tap", async ({ page }) => {
  const fetched = [];
  page.on("request", (r) => fetched.push(r.url()));
  await page.addInitScript(SPY);
  await ready(page);
  for (const id of ["molecule", "screen", "song-landscape", "chladni-plate", "photo-3d"]) {
    await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
    await page.waitForTimeout(600);
  }
  await withLive(page, [{ kind: "mic" }, { kind: "camera" }, { kind: "screen" }]);
  expect(await page.evaluate(() => window.__liveCalls)).toEqual([]);
  const bad = fetched.filter((u) => /capture-worklet|live\/mic\.js|onnx|depth-anything|live\/stream\.js/.test(u)); // prettier-ignore
  expect(bad).toEqual([]);
  await expect(page.locator("#live-indicator")).toHaveCount(0);
  // The note says it stays on the device.
  await expect(page.locator("#toy-input .live-note")).toHaveText(
    "Stays on this device. Nothing is recorded or sent.",
  );
});

test("a tap turns the microphone and camera on; Stop ends every track", async ({ page }) => {
  await page.addInitScript(SPY);
  await ready(page);
  await withLive(page, [{ kind: "mic" }, { kind: "camera" }]);
  await page.click("#live-mic");
  await expect(page.locator("#live-indicator")).toBeVisible();
  await expect(page.locator("#live-indicator .live-text")).toHaveText("Live: microphone");
  await page.click("#live-camera");
  await expect(page.locator("#live-indicator .live-text")).toHaveText(
    "Live: microphone and camera",
  );
  await expect(page.locator("#live-mic")).toHaveText("Stop the microphone");
  // The analyser runs, about 60 times a second.
  const frames = await page.evaluate(async () => {
    const { live } = await import("/src/live/live.js");
    const a = live.mic.frames;
    await new Promise((r) => setTimeout(r, 1000));
    return live.mic.frames - a;
  });
  expect(frames).toBeGreaterThan(40);
  const before = await page.evaluate(async () => (await import("/src/live/live.js")).liveState());
  expect(before.mic.tracks).toEqual(["live"]);
  expect(before.camera.tracks).toEqual(["live"]);
  const tracks = await page.evaluate(async () => {
    const { live } = await import("/src/live/live.js");
    window.__tracks = [...live.stream("mic").getTracks(), ...live.stream("camera").getTracks()];
    return window.__tracks.length;
  });
  expect(tracks).toBe(2);
  await page.click("#live-stop");
  await expect(page.locator("#live-indicator")).toBeHidden();
  expect(await page.evaluate(() => window.__tracks.map((t) => t.readyState))).toEqual([
    "ended",
    "ended",
  ]);
  expect(await page.evaluate(async () => (await import("/src/live/live.js")).liveState())).toEqual(
    {},
  );
  await expect(page.locator("#live-mic")).toHaveText("Use my microphone");
  expect(await page.evaluate(() => window.__liveCalls)).toEqual(["getUserMedia", "getUserMedia"]);
});

test("closing the toy stops what it started", async ({ page }) => {
  await ready(page);
  await withLive(page, [{ kind: "camera" }]);
  await page.click("#live-camera");
  await expect(page.locator("#live-indicator")).toBeVisible();
  await page.evaluate(() => window.__splashery.app.chooseToy("donut"));
  await expect(page.locator("#live-indicator")).toBeHidden();
});

test("a refused permission shows a plain message", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
  });
  await ready(page);
  await withLive(page, [{ kind: "mic" }]);
  await page.click("#live-mic");
  await expect(page.locator("#toy-input .warning")).toBeVisible();
  await expect(page.locator("#toy-input .warning")).toContainText(
    "The microphone wasn't allowed, so it stays off.",
  );
  await expect(page.locator("#live-indicator")).toHaveCount(0);
});

test("no microphone found shows a plain message", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("none", "NotFoundError"));
  });
  await ready(page);
  await withLive(page, [{ kind: "mic" }]);
  await page.click("#live-mic");
  await expect(page.locator("#toy-input .warning")).toHaveText(
    "No microphone was found on this device.",
  );
});

test("the screen button hides where getDisplayMedia is missing", async ({ page }) => {
  await ready(page);
  await withLive(page, [{ kind: "camera" }, { kind: "screen" }]);
  await expect(page.locator("#live-screen")).toHaveCount(1);
  await page.addInitScript(() => {
    delete MediaDevices.prototype.getDisplayMedia;
  });
  await ready(page);
  await withLive(page, [{ kind: "camera" }, { kind: "screen" }]);
  await expect(page.locator("#live-camera")).toHaveCount(1);
  await expect(page.locator("#live-screen")).toHaveCount(0);
});

test("a live stream plays on a picture toy's sheets and Stop puts the sample back", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => window.__splashery.app.chooseToy("screen"));
  await page.waitForFunction(() => window.__splashery.player.pictures?.api.kind);
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    player.toyInfo.recipe.input.live = [{ kind: "camera", media: true }];
    await app.setToyOptions({});
  });
  await page.click("#live-camera");
  await page.waitForFunction(() => window.__splashery.player.pictures?.media?.live === true);
  expect(await page.evaluate(() => window.__splashery.player.scene.toy.media)).toBeUndefined();
  await page.click("#live-stop");
  await page.waitForFunction(
    () => window.__splashery.player.pictures?.media && !window.__splashery.player.pictures.media.live, // prettier-ignore
  );
  expect(await page.evaluate(() => window.__splashery.player.liveMedia)).toBeNull();
});

// ---- The sums (Node) ---------------------------------------------------------------

const RATE = 48000;
const noise = (n, a, seed = 1) => {
  let s = seed;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    s = (s * 16807) % 2147483647;
    out[i] = a * ((s / 2147483647) * 2 - 1);
  }
  return out;
};

test("the pitch detector names known notes", () => {
  for (const [hz, name] of [
    [110, "A2"],
    [196, "G3"],
    [261.63, "C4"],
    [440, "A4"],
    [880, "A5"],
  ]) {
    const x = new Float32Array(2048);
    const n = noise(2048, 0.01);
    for (let i = 0; i < x.length; i++)
      x[i] = 0.3 * Math.sin((2 * Math.PI * hz * i) / RATE) + 0.08 * Math.sin((4 * Math.PI * hz * i) / RATE) + n[i]; // prettier-ignore
    const p = detectPitch(x, RATE);
    expect(p).not.toBeNull();
    expect(Math.abs(p.hz - hz) / hz).toBeLessThan(0.005);
    expect(noteOf(p.hz).name).toBe(name);
  }
  expect(detectPitch(noise(2048, 0.2), RATE)).toBeNull();
  expect(noteOf(466.16).ascii).toBe("A#4");
});

function onsets(sig) {
  const d = new OnsetDetector();
  const hop = 240;
  const at = [];
  for (let i = 0; i + hop <= sig.length; i += hop) {
    let e = 0;
    for (let j = 0; j < hop; j++) e += sig[i + j] ** 2;
    if (d.push(e / hop)) at.push(i / RATE);
  }
  return at;
}

test("a clap is an onset; steady noise is not", () => {
  const bg = noise(RATE * 3, 0.03, 3);
  expect(onsets(bg)).toEqual([]);
  expect(onsets(noise(RATE * 3, 0.6, 5))).toEqual([]);
  const clap = bg.slice();
  const burst = noise(RATE * 2, 0.9, 7);
  for (let i = RATE; i < clap.length; i++) clap[i] += burst[i - RATE] * Math.exp((-6.91 * (i - RATE)) / RATE / 0.5); // prettier-ignore
  const at = onsets(clap);
  expect(at.length).toBe(1);
  expect(Math.abs(at[0] - 1)).toBeLessThan(0.01);
});

test("the decay of a synthetic clap gives its RT60 within 10%", () => {
  for (const rt of [0.4, 0.8, 1.6]) {
    const hop = 240;
    const len = Math.round(RATE * Math.max(1.5, rt * 1.6));
    const burst = noise(len, 0.9, 11);
    const bg = noise(len, 0.004, 13);
    const e = [];
    for (let i = 0; i + hop <= len; i += hop) {
      let s = 0;
      for (let j = 0; j < hop; j++) {
        const v = burst[i + j] * Math.exp((-6.91 * (i + j)) / RATE / rt) + bg[i + j];
        s += v * v;
      }
      e.push(s / hop);
    }
    const r = measureDecay(Float32Array.from(e), hop / RATE, 0.004 ** 2 / 3);
    expect(r.ok).toBe(true);
    expect(Math.abs(r.rt60 - rt) / rt).toBeLessThan(0.1);
  }
  // Too noisy: the clap stands only 15 dB above the background.
  const e = Array.from({ length: 200 }, (_, i) => 0.03 * Math.exp(-i / 20) + 0.001);
  expect(measureDecay(Float32Array.from(e), 0.005, 0.001)).toMatchObject({ ok: false, why: "noisy" }); // prettier-ignore
});

test("relief splats pack their place, axis and lift", () => {
  const k = new Kit(1, { count: 2000 });
  const items = [
    { p: [-1, 0, 0], kind: "relief", params: [0.25, 0.75, 1, 0.5] },
    { p: [1, 0, 0], kind: "relief", params: [1, 0, 2, 1] },
  ];
  k.add(k.box(1, 1, 1), { share: 0.9 });
  k.cloud({ share: 0.001, pattern: false }, (rand, i) => items[i] || null);
  for (const _ of k.emit());
  const anim = k.buf.anim;
  const got = [];
  for (let i = 0; i < k.buf.count; i++) {
    if (anim[i * 4 + 1] !== KINDS.relief) continue;
    const z = anim[i * 4 + 2];
    const w = anim[i * 4 + 3];
    const axis = Math.floor(z / 2);
    const lq = Math.floor(w / 2);
    got.push({ u: z - 2 * axis, axis, v: w - 2 * lq, lift: lq / 1000 });
  }
  const s = k.transform.scale;
  expect(got.length).toBe(2);
  expect(got[0]).toMatchObject({ u: 0.25, axis: 1, v: 0.75 });
  expect(Math.abs(got[0].lift - 0.5 * s)).toBeLessThan(0.002);
  expect(got[1]).toMatchObject({ u: 1, axis: 2, v: 0 });
  expect(Math.abs(got[1].lift - s)).toBeLessThan(0.002);
});
