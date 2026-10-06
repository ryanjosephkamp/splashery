import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { GifReader } from "../vendor/omggif/omggif.js";
import { findToy } from "../src/toys.js";

// Lane AsciiCapture: the ASCII GIF lab (ascii-lab.html) and its capture
// document. The container renders on SwiftShader (CPU), where one job takes
// 35 to 110 seconds, so the lab runs with ?deadline=180 (its 30-second limit
// is for real devices); the frame deadline (8 seconds) is unchanged.

const LAB = "/ascii-lab.html?deadline=180";
const JOB = 200_000;

// Every frame (the lab and the capture document) reports anything that would
// break privacy: storage writes, permission requests, and device-motion,
// media or location calls. The lab page also counts its timers, listeners
// with no abort signal, object URLs and WebGL contexts.
function instrument() {
  const top = window.top;
  const log = (kind, what) => {
    try {
      (top.__ascLog ||= []).push({ kind, what, frame: location.pathname });
    } catch {
      // cross-origin top: not the case here
    }
  };
  for (const [proto, names] of [
    [Storage.prototype, ["setItem", "removeItem", "clear"]],
    [IDBFactory.prototype, ["open", "deleteDatabase"]],
  ])
    for (const name of names) {
      const fn = proto[name];
      proto[name] = function (...args) {
        log("storage", `${name} ${String(args[0] ?? "")}`);
        return fn.apply(this, args);
      };
    }
  const md = navigator.mediaDevices;
  if (md) {
    for (const name of ["getUserMedia", "getDisplayMedia"]) {
      const fn = md[name]?.bind(md);
      if (fn)
        md[name] = (...args) => {
          log("permission", name);
          return fn(...args);
        };
    }
  }
  if (navigator.geolocation) {
    const fn = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (...args) => {
      log("permission", "geolocation");
      return fn(...args);
    };
  }
  if (globalThis.DeviceMotionEvent?.requestPermission) {
    const fn = DeviceMotionEvent.requestPermission;
    DeviceMotionEvent.requestPermission = (...args) => {
      log("permission", "devicemotion");
      return fn(...args);
    };
  }
  if (window !== window.top) return;
  // The lab page's own handles.
  const timers = new Set();
  const setT = window.setTimeout;
  const clearT = window.clearTimeout;
  window.setTimeout = (fn, ms, ...rest) => {
    const id = setT(
      (...a) => {
        timers.delete(id);
        if (typeof fn === "function") fn(...a);
      },
      ms,
      ...rest,
    );
    timers.add(id);
    return id;
  };
  window.clearTimeout = (id) => {
    timers.delete(id);
    return clearT(id);
  };
  const listeners = [];
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (this === window || this === document)
      listeners.push({ type, signal: typeof opts === "object" ? opts?.signal : undefined });
    return add.call(this, type, fn, opts);
  };
  const urls = new Set();
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  URL.createObjectURL = (b) => {
    const u = create(b);
    urls.add(u);
    return u;
  };
  URL.revokeObjectURL = (u) => {
    urls.delete(u);
    return revoke(u);
  };
  const getContext = HTMLCanvasElement.prototype.getContext;
  let gl = 0;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (/webgl|webgpu/.test(type)) gl++;
    return getContext.call(this, type, ...rest);
  };
  window.__ascHandles = () => ({
    iframes: document.querySelectorAll("iframe").length,
    timers: timers.size,
    // Listeners the job owns are added with an abort signal; live ones count.
    liveJobListeners: listeners.filter(
      (l) => ["message", "visibilitychange", "pagehide"].includes(l.type) && l.signal && !l.signal.aborted, // prettier-ignore
    ).length,
    unsignalledJobListeners: listeners.filter(
      (l) => ["message", "visibilitychange", "pagehide"].includes(l.type) && !l.signal,
    ).length,
    urls: urls.size,
    gl,
  });
}

// For a failing renderer: the capture document's frames stop after a few.
function stallHostFrames() {
  if (!location.pathname.endsWith("/ascii-capture-host.html")) return;
  const raf = window.requestAnimationFrame.bind(window);
  let n = 0;
  window.requestAnimationFrame = (fn) => (++n > 60 ? 0 : raf(fn));
}

// Without WebGL2 (or WebGPU) in the capture document.
function noWebGL() {
  if (!location.pathname.endsWith("/ascii-capture-host.html")) return;
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    return /webgl|webgpu/.test(type) ? null : getContext.call(this, type, ...rest);
  };
  Object.defineProperty(Navigator.prototype, "gpu", { get: () => undefined });
}

async function open(page, baseURL) {
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(instrument);
  await page.goto(LAB);
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  return {
    errors,
    external: () => requests.filter((u) => !u.startsWith(baseURL) && !u.startsWith("blob:") && !u.startsWith("data:")), // prettier-ignore
  };
}

async function settings(page, { preset = "grapes", columns = "48", color = false } = {}) {
  await page.selectOption("#preset", preset);
  await page.selectOption("#columns", columns);
  await page.locator("#color").setChecked(color);
}

async function captureAndWait(page) {
  await page.click("#capture");
  await expect(page.locator("body")).toHaveAttribute("data-state", /done|failed/, { timeout: JOB });
  return page.locator("body").getAttribute("data-state");
}

async function storage(page) {
  return page.evaluate(async () => ({
    local: JSON.stringify(Object.entries(localStorage).sort()),
    session: JSON.stringify(Object.entries(sessionStorage).sort()),
    idb: JSON.stringify(((await indexedDB.databases?.()) ?? []).map((d) => d.name).sort()),
  }));
}

async function permissions(page) {
  return page.evaluate(async () => {
    const out = {};
    for (const name of ["camera", "microphone", "geolocation", "accelerometer"]) {
      try {
        out[name] = (await navigator.permissions.query({ name })).state;
      } catch {
        out[name] = "unsupported";
      }
    }
    return out;
  });
}

function decode(bytes) {
  const reader = new GifReader(new Uint8Array(bytes));
  const frames = [];
  for (let i = 0; i < reader.numFrames(); i++) {
    const rgba = new Uint8Array(reader.width * reader.height * 4);
    reader.decodeAndBlitFrameRGBA(i, rgba);
    frames.push({ rgba, delay: reader.frameInfo(i).delay });
  }
  const text = Buffer.from(bytes).toString("latin1");
  const at = text.indexOf("\x21\xfe");
  let comment = "";
  if (at >= 0) {
    let i = at + 2;
    while (bytes[i]) {
      comment += Buffer.from(bytes.subarray(i + 1, i + 1 + bytes[i])).toString("utf8");
      i += bytes[i] + 1;
    }
  }
  return { width: reader.width, height: reader.height, frames, comment };
}

// The footer band (the bottom `lines` text lines of each frame): the same
// text in every frame (as a mask of bright pixels, since each frame has its
// own palette), and with text in it.
function footerBand({ width, height, frames }, lines) {
  const top = height - lines * 14;
  const mask = ({ rgba }) => {
    const band = rgba.subarray(top * width * 4);
    const bits = new Uint8Array(band.length / 4);
    for (let i = 0; i < bits.length; i++)
      bits[i] = band[i * 4] + band[i * 4 + 1] + band[i * 4 + 2] > 384 ? 1 : 0;
    return bits;
  };
  const masks = frames.map(mask);
  return {
    same: masks.every((m) => Buffer.compare(Buffer.from(m), Buffer.from(masks[0])) === 0),
    text: masks[0].reduce((a, b) => a + b, 0),
  };
}

function differs(a, b) {
  return Buffer.compare(Buffer.from(a.rgba), Buffer.from(b.rgba)) !== 0;
}

async function download(page) {
  const pending = page.waitForEvent("download");
  await page.click("#download");
  const file = await pending;
  return { name: file.suggestedFilename(), bytes: await fs.readFile(await file.path()) };
}

test("the three presets capture, move and keep their credit; settings change the GIF", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(4 * JOB);
  const { errors, external } = await open(page, baseURL);
  const before = { storage: await storage(page), permissions: await permissions(page) };
  const results = {};
  for (const preset of ["grapes", "orange", "strawberry"]) {
    await settings(page, { preset });
    expect(await captureAndWait(page)).toBe("done");
    await expect(page.locator("body")).toHaveAttribute("data-decode", "pass");
    const { name, bytes } = await download(page);
    expect(name).toBe(`splashery-${preset}-ascii-48.gif`);
    const gif = decode(bytes);
    // 40 frames at 10 fps, the size the lab reports.
    expect(gif.frames).toHaveLength(40);
    expect(gif.frames.every((f) => f.delay === 10)).toBe(true);
    const [w, h] = (await page.locator("#dev-output").textContent()).match(/\d+/g).map(Number);
    expect([gif.width, gif.height]).toEqual([w, h]);
    // It moves: the tap at frame 4 changes the picture.
    expect(differs(gif.frames[0], gif.frames[39])).toBe(true);
    expect(differs(gif.frames[3], gif.frames[12])).toBe(true);
    // The credit: on the page, in every frame's footer, and in the comment block.
    const credit = (await page.locator("#credit").textContent()).split("\n");
    const toy = findToy(preset);
    if (toy.credit) {
      expect(credit[0]).toBe(`${toy.credit.title} - ${toy.credit.author} - ${toy.credit.license}`);
      expect(credit).toContain(toy.credit.source);
      expect(credit).toContain(toy.credit.licenseUrl);
      expect(credit.join(" ")).toContain("Changes:");
      expect(JSON.parse(gif.comment).credit).toMatchObject({
        author: toy.credit.author,
        license: toy.credit.license,
        source: toy.credit.source,
      });
    } else {
      expect(credit[0]).toMatch(/: Splashery, MIT$/);
      expect(JSON.parse(gif.comment).credit).toEqual({ author: "Splashery", license: "MIT" });
    }
    expect(credit.at(-1)).toMatch(/^Fresh toy animation/);
    expect(JSON.parse(gif.comment)).toMatchObject({ kind: "Fresh toy animation", toy: preset });
    const band = footerBand(gif, credit.length);
    expect(band.same).toBe(true);
    expect(band.text).toBeGreaterThan(200);
    results[preset] = gif;
    // Success leaves no iframe, timers or live listeners; one object URL (the GIF).
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__ascHandles())).toMatchObject({
      iframes: 0,
      timers: 0,
      liveJobListeners: 0,
      unsignalledJobListeners: 0,
      urls: 1,
      gl: 0,
    });
  }
  // Changing the ASCII settings changes the output.
  await settings(page, { preset: "grapes", columns: "72", color: true });
  expect(await captureAndWait(page)).toBe("done");
  const { name, bytes } = await download(page);
  expect(name).toBe("splashery-grapes-ascii-72-color.gif");
  const color = decode(bytes);
  expect(color.width).toBeGreaterThan(results.grapes.width);
  expect(JSON.parse(color.comment).settings).toMatchObject({ columns: 72, color: true, rows: 36 });
  // The replaced GIF's object URL was revoked.
  expect(await page.evaluate(() => window.__ascHandles().urls)).toBe(1);
  // Privacy: nothing left this origin, nothing was asked for, nothing stored.
  expect(external()).toEqual([]);
  expect(await page.evaluate(() => window.__ascLog || [])).toEqual([]);
  expect(await storage(page)).toEqual(before.storage);
  expect(await permissions(page)).toEqual(before.permissions);
  expect(errors).toEqual([]);
  // Screenshots of the finished lab.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "tests/screenshots/asc-lab-390x844.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "tests/screenshots/asc-lab-1440x900.png", fullPage: true });
});

test("Cancel and a failing renderer leave nothing behind and offer no file", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(2 * JOB);
  await page.addInitScript(stallHostFrames);
  const { errors } = await open(page, baseURL);
  const clean = async () => {
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__ascHandles())).toMatchObject({
      iframes: 0,
      timers: 0,
      liveJobListeners: 0,
      urls: 0,
    });
    await expect(page.locator("#result")).toBeHidden();
    expect(await page.locator("#download").getAttribute("href")).toBeNull();
  };
  // A failing renderer: the capture document stops drawing after a few frames.
  await settings(page);
  expect(await captureAndWait(page)).toBe("failed");
  await expect(page.locator("#status")).toContainText("took longer than 8 seconds to render");
  await expect(page.locator("#status")).not.toContainText("Done");
  await clean();
  // A second Capture while one runs is refused, not queued.
  const refused = await page.evaluate(async () => {
    const { startCapture } = await import("/src/ascii-capture/job.js");
    const mount = document.createElement("div");
    const first = startCapture({ preset: "grapes", columns: 48, color: false, mount });
    first.done.catch(() => {});
    let second;
    try {
      startCapture({ preset: "orange", columns: 48, color: false, mount });
      second = "started";
    } catch (err) {
      second = err.reason;
    }
    const frames = mount.querySelectorAll("iframe").length;
    first.cancel();
    first.cancel(); // idempotent
    return { second, frames, after: mount.querySelectorAll("iframe").length };
  });
  expect(refused).toEqual({ second: "busy", frames: 1, after: 0 });
  await clean();
  expect(errors).toEqual([]);
});

test("Cancel mid-capture stops the job and offers no file", async ({ page, baseURL }) => {
  test.setTimeout(2 * JOB);
  const { errors } = await open(page, baseURL);
  await settings(page, { preset: "orange" });
  await page.click("#capture");
  await expect(page.locator("#status")).toContainText("Capturing frame 3 of 40", { timeout: JOB });
  await page.click("#cancel");
  await expect(page.locator("body")).toHaveAttribute("data-state", "failed");
  await expect(page.locator("#status")).toHaveText("Capture canceled. Nothing was saved.");
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__ascHandles())).toMatchObject({
    iframes: 0,
    timers: 0,
    liveJobListeners: 0,
    urls: 0,
  });
  await expect(page.locator("#result")).toBeHidden();
  expect(errors).toEqual([]);
});

test("hiding or leaving the page aborts the job, and a late message restarts nothing", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(2 * JOB);
  const { errors } = await open(page, baseURL);
  await settings(page);
  await page.click("#capture");
  await expect(page.locator("#status")).toContainText("Capturing frame 2 of 40", { timeout: JOB });
  const job = await page.evaluate(() => new URL(document.querySelector("iframe").src).hash);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("body")).toHaveAttribute("data-state", "failed");
  await expect(page.locator("#status")).toContainText("the page was hidden");
  expect(await page.evaluate(() => window.__ascHandles().iframes)).toBe(0);
  // A late "ready" from a document with the old job's id is ignored: no start, no restart.
  await page.evaluate((hash) => {
    delete document.hidden;
    const late = document.createElement("iframe");
    late.id = "late";
    late.src = `/ascii-capture-host.html${hash}`;
    document.body.append(late);
  }, job);
  await page.waitForTimeout(4000);
  const status = await page.locator("#status").textContent();
  expect(status).toContain("the page was hidden");
  await expect(page.locator("body")).toHaveAttribute("data-state", "failed");
  // The stray document got no start, so it never made a player.
  expect(
    await page.evaluate(() => document.getElementById("late").contentDocument.querySelector("canvas").width), // prettier-ignore
  ).toBe(300);
  await page.evaluate(() => document.getElementById("late").remove());
  // Leaving the page (pagehide) aborts a running job too.
  await page.click("#capture");
  await expect(page.locator("#status")).toContainText("Capturing frame 2 of 40", { timeout: JOB });
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent("pagehide")));
  await expect(page.locator("#status")).toContainText("the page was left");
  expect(await page.evaluate(() => window.__ascHandles())).toMatchObject({
    iframes: 0,
    timers: 0,
    liveJobListeners: 0,
  });
  expect(errors).toEqual([]);
});

test("without WebGL2 the lab says so and claims no success", async ({ page, baseURL }) => {
  await page.addInitScript(noWebGL);
  const { errors } = await open(page, baseURL);
  await settings(page);
  expect(await captureAndWait(page)).toBe("failed");
  await expect(page.locator("#status")).toHaveText(
    "This browser couldn't start WebGL2, which the capture needs. Nothing was saved.",
  );
  await expect(page.locator("#result")).toBeHidden();
  expect(await page.evaluate(() => window.__ascHandles())).toMatchObject({ iframes: 0, urls: 0 });
  expect(errors).toEqual([]);
});
