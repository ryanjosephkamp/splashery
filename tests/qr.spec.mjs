// Lane QR (docs/handoff/QR.md): the QR code toy on the Studio shelf (labs
// only). A code that doesn't scan is a failure, so these read every style
// back from real screenshots with jsQR (the vendored copy), at phone and
// desktop size, and check the encoder against codes from another encoder.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { PNG } from "pngjs";
import { encodeQR, asText, alignmentPositions } from "../src/qr/encode.js";
import { GifReader } from "../vendor/omggif/omggif.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const URL0 = "https://ryanjosephkamp.github.io/splashery/";
const STYLES = ["classic", "dots", "rounded", "bricks", "gems", "bubbles", "neon", "neon-light"];

// jsQR, from the same file the toy loads.
const jsQR = (() => {
  const m = { exports: {} };
  new Function("module", "exports", fs.readFileSync("vendor/jsqr/jsQR.js", "utf8"))(m, m.exports);
  return m.exports.default || m.exports;
})();
const read = (rgba, w, h) => jsQR(new Uint8ClampedArray(rgba), w, h)?.data ?? null;
const readPNG = (buf) => {
  const png = PNG.sync.read(buf);
  return read(png.data, png.width, png.height);
};

async function open(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("qr-code"));
  await page.waitForFunction(() => window.__splashery.qr && window.__splashery.qr.info().size, null, { timeout: 60_000 }); // prettier-ignore
  return errors;
}

// ---- The encoder --------------------------------------------------------------------------

// tests/fixtures/qr-vectors.json: codes made by segno 1.6.1 (a separate
// encoder, in Python) at the same version, level and mask: the ISO
// standard's "01234567" (1-M) and the classic "HELLO WORLD" (1-Q).

test("the encoder matches another encoder, and its codes read back", async () => {
  const vectors = JSON.parse(fs.readFileSync("tests/fixtures/qr-vectors.json", "utf8"));
  expect(vectors.length).toBe(2);
  for (const v of vectors) {
    const code = encodeQR(v.text, v.ecc, { boost: false, mask: v.mask });
    expect(code.version, v.text).toBe(v.version);
    expect(asText(code), v.text).toBe(v.rows.join("\n"));
  }
  // Codes of every size read back with jsQR (drawn as plain pixels).
  for (const [text, ecc] of [
    [URL0, "M"],
    ["x".repeat(300), "Q"],
    ["Ünïcödé ✓ 日本", "H"],
    ["", "L"],
  ]) {
    // prettier-ignore
    const code = encodeQR(text, ecc);
    const s = 6;
    const W = (code.size + 8) * s;
    const px = new Uint8ClampedArray(W * W * 4).fill(255);
    for (let y = 0; y < code.size; y++)
      for (let x = 0; x < code.size; x++)
        if (code.dark[y * code.size + x])
          for (let j = 0; j < s; j++)
            for (let i = 0; i < s; i++) {
              const k = (((y + 4) * s + j) * W + (x + 4) * s + i) * 4;
              px[k] = px[k + 1] = px[k + 2] = 0;
            }
    expect(read(px, W, W), `${text.slice(0, 20)} at ${ecc}`).toBe(text);
  }
  // The finder and alignment patterns are found as their own pieces.
  const v7 = encodeQR("x".repeat(120), "M", { boost: false });
  expect(v7.version).toBe(7);
  const pos = alignmentPositions(7);
  expect(pos).toEqual([6, 22, 38]);
  expect(v7.pieces.filter((p) => p.kind === "finder")).toHaveLength(3);
  expect(v7.pieces.filter((p) => p.kind === "alignment")).toHaveLength(6);
  // Too long for a code: a clear message.
  expect(() => encodeQR("x".repeat(3000), "M")).toThrow(/too long/);
});

// ---- Loading ------------------------------------------------------------------------------

test("nothing QR-related loads until the toy opens", async ({ page }) => {
  const urls = [];
  page.on("request", (r) => urls.push(r.url()));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.waitForTimeout(500);
  const qr = (u) => /\/qr\/|packs\/qr\.js|qrcodegen|jsqr/i.test(u);
  expect(urls.filter(qr)).toEqual([]);
  await page.evaluate(() => window.__splashery.app.chooseToy("qr-code"));
  await page.waitForFunction(() => window.__splashery.qr?.info().size, null, { timeout: 60_000 });
  expect(urls.some((u) => u.includes("qrcodegen"))).toBe(true);
  expect(urls.some((u) => u.includes("packs/qr.js"))).toBe(true);
});

// ---- Every style scans --------------------------------------------------------------------

for (const [w, h] of [
  [390, 844],
  [1440, 900],
]) {
  // prettier-ignore
  test(`every style at its default settings scans at ${w}x${h}`, async ({ page }) => {
    test.setTimeout(400_000);
    await page.setViewportSize({ width: w, height: h });
    const errors = await open(page);
    const failed = [];
    for (const style of STYLES) {
      const info = await page.evaluate(async (style) => {
        const qr = window.__splashery.qr;
        await qr.set({ style });
        qr.scanView();
        const check = await qr.check();
        qr.scanView();
        return { check, info: qr.info() };
      }, style);
      expect(info.info.text).toBe(URL0);
      if (!info.check?.ok) failed.push(`${style}: the toy's own check`);
      await page.waitForTimeout(300);
      // The screenshot, framed on the code as a phone would frame it (the
      // page's title and labels beside it are not part of the code).
      const r = await page.evaluate(() => window.__splashery.qr.screenRect());
      // Plus 1.5 modules of the plate around the quiet zone, as a phone sees
      // it (an inverted code's dark quiet zone alone, cut off at the picture's
      // edge, reads as white in jsQR's thresholds).
      // The page's title sits over the stage's top-left corner; the frame
      // stops short of it (a phone's reader copes with it, jsQR doesn't).
      const brand = await page.evaluate(() => document.querySelector("header.brand")?.getBoundingClientRect().toJSON()); // prettier-ignore
      let pad = (r.width / (info.info.size + 8)) * 1.5;
      if (brand && brand.right > r.x - pad) pad = Math.max(0, Math.min(pad, r.y - brand.bottom - 1));
      const x = Math.max(0, r.x - pad);
      const y = Math.max(0, r.y - pad);
      const clip = { x, y, width: Math.min(w - x, r.width + 2 * pad), height: Math.min(h - y, r.height + 2 * pad) }; // prettier-ignore
      const shot = await page.screenshot({ clip });
      if (readPNG(shot) !== URL0) {
        failed.push(`${style}: the ${w}x${h} screenshot`);
        fs.writeFileSync(test.info().outputPath(`${style}-${w}x${h}.png`), shot);
      }
      if (style === "classic" || style === "neon")
        await page.screenshot({ path: `tests/screenshots/qr-${style}-${w}x${h}.png` });
    }
    expect(failed).toEqual([]);
    expect(errors).toEqual([]);
  });
}

// ---- The GIF and the PNG ------------------------------------------------------------------

test("the GIF ends on the code held still, and its last frame scans", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  const { gif, png } = await page.evaluate(async () => {
    const qr = window.__splashery.qr;
    await qr.set({ style: "gems" });
    const b64 = async (blob) => {
      const a = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode(...a.subarray(i, i + 8192));
      return btoa(s);
    };
    return { gif: await b64(await qr.gif({ motion: "burst", size: 360 })), png: await b64(await qr.png(1024)) }; // prettier-ignore
  });
  const bytes = Buffer.from(gif, "base64");
  const reader = new GifReader(bytes);
  const n = reader.numFrames();
  expect(n).toBeGreaterThan(40);
  const frame = (i) => {
    const px = new Uint8Array(reader.width * reader.height * 4);
    reader.decodeAndBlitFrameRGBA(i, px);
    return px;
  };
  // The last frame reads back, and so does the frame 1.2 s before it (the
  // code holds still that long).
  expect(read(frame(n - 1), reader.width, reader.height)).toBe(URL0);
  expect(read(frame(n - 16), reader.width, reader.height)).toBe(URL0);
  // In the middle of the burst the code is in pieces: it doesn't read.
  expect(read(frame(Math.round(n * 0.3)), reader.width, reader.height)).toBe(null);
  // The PNG: printable size, and it scans.
  const p = PNG.sync.read(Buffer.from(png, "base64"));
  expect(p.width).toBe(1024);
  expect(read(p.data, p.width, p.height)).toBe(URL0);
});

// ---- Alive ------------------------------------------------------------------------------

test("Alive: every frame of each style's looping GIF scans", async ({ page }) => {
  test.setTimeout(900_000);
  await open(page);
  const failed = [];
  for (const style of STYLES) {
    const gif = await page.evaluate(async (style) => {
      const qr = window.__splashery.qr;
      await qr.set({ style });
      const a = new Uint8Array(await (await qr.gif({ motion: "alive", size: 360 })).arrayBuffer());
      let s = "";
      for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode(...a.subarray(i, i + 8192));
      return btoa(s);
    }, style);
    const reader = new GifReader(Buffer.from(gif, "base64"));
    const n = reader.numFrames();
    expect(n, style).toBe(44);
    const px = new Uint8Array(reader.width * reader.height * 4);
    for (let i = 0; i < n; i++) {
      reader.decodeAndBlitFrameRGBA(i, px);
      if (read(px, reader.width, reader.height) !== URL0) failed.push(`${style}: frame ${i}`);
    }
    // The wave moves: the first frame and the middle one differ.
    const a = new Uint8Array(px.length);
    reader.decodeAndBlitFrameRGBA(0, a);
    reader.decodeAndBlitFrameRGBA(22, px);
    let diff = 0;
    for (let i = 0; i < a.length; i += 4)
      diff += Math.abs(a[i] - px[i]) + Math.abs(a[i + 2] - px[i + 2]);
    expect(diff / (a.length / 4), `${style}: the wave shows`).toBeGreaterThan(0.5);
  }
  expect(failed).toEqual([]);
});

// ---- Links --------------------------------------------------------------------------------

test("a link carries the text and the style", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  const text = "Splashery says hello ✓ (a link made of splats)";
  const hash = await page.evaluate(async (text) => {
    const qr = window.__splashery.qr;
    await qr.set({ style: "bubbles", text, ecc: "H", eyes: "own", eye: "#2a6f2b" });
    const { encodeSceneHash } = await import("/src/codec.js");
    return encodeSceneHash(window.__splashery.exportScene());
  }, text);
  await page.goto(`${APP}#s=${hash}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.waitForFunction(() => window.__splashery.qr?.info().size, null, { timeout: 60_000 });
  const back = await page.evaluate(async () => {
    const qr = window.__splashery.qr;
    qr.scanView();
    return { info: qr.info(), check: await qr.check() };
  });
  expect(back.info.text).toBe(text);
  expect(back.info.style).toBe("bubbles");
  expect(back.info.ecc).toBe("H");
  expect(back.info.options.eye).toBe("#2a6f2b");
  expect(back.check.ok).toBe(true);
  expect(back.check.read).toBe(text);
});

// ---- Warnings -----------------------------------------------------------------------------

test("low contrast and inverted codes are warned about", async ({ page }) => {
  await open(page);
  const w = await page.evaluate(async () => {
    const qr = window.__splashery.qr;
    const a = (await qr.set({ style: "classic", fg: "#9a9a9a", bg: "#c8c8c8" })).warnings;
    const b = (await qr.set({ style: "classic", fg: "#ffffff", bg: "#101010" })).warnings;
    const c = (await qr.set({ style: "classic" })).warnings;
    return { a, b, c };
  });
  expect(w.a.join(" ")).toMatch(/Low contrast/);
  expect(w.b.join(" ")).toMatch(/inverted/);
  expect(w.c).toEqual([]);
});
