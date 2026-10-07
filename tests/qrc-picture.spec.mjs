// Lane QR craft (docs/handoff/QRcraft.md): Picture QR. In Node: the woven
// layout keeps every module's center and the plain patterns; each sample
// scans at the toy's defaults (jsQR at phone size and smaller, a little out of
// focus); more contrast never lowers the measured contrast; and "Make it
// scan" finds a version that reads from one that doesn't. In the browser: the
// toy's splats on the stage read back, the PNG export reads back, and a tap
// ends on a code that reads.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import {
  makeWoven,
  checkWoven,
  measure,
  closestScanning,
  plainModules,
  FG,
  BG,
} from "../src/qr-craft/picture.js";
import { SAMPLES } from "../src/qr-craft/samples.js";
import { resize } from "../tools/qr-scan-lab/sim.mjs";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const TEXT = "https://ryanjosephkamp.github.io/splashery/";

const jsQR = (() => {
  const m = { exports: {} };
  new Function("module", "exports", fs.readFileSync("vendor/jsqr/jsQR.js", "utf8"))(m, m.exports);
  return m.exports.default || m.exports;
})();
const read = (rgba, w, h) =>
  jsQR(new Uint8ClampedArray(rgba), w, h, { inversionAttempts: "dontInvert" })?.data ?? null;

function loadPicture(file) {
  const j = jpeg.decode(fs.readFileSync(file), { useTArray: true, maxMemoryUsageInMB: 1024 });
  const data = new Float32Array(j.width * j.height * 3);
  for (let i = 0; i < j.width * j.height; i++)
    for (let c = 0; c < 3; c++) data[i * 3 + c] = j.data[i * 4 + c] / 255;
  return { w: j.width, h: j.height, data };
}
const PICS = Object.fromEntries(SAMPLES.map((s) => [s.id, loadPicture(s.file)]));

test.describe("Picture QR: the layout", () => {
  test("every module's center keeps its bit, and the patterns stay plain", () => {
    for (const center of ["small", "medium", "big"]) {
      const w = makeWoven(PICS["wildflowers"], { text: TEXT, level: "H", contrast: 0.2, center });
      const { code, k, c, G, cells } = w;
      const N = code.size;
      const plain = plainModules(code);
      const lo = (k - c) / 2;
      let wrong = 0;
      for (let r = 0; r < N; r++)
        for (let col = 0; col < N; col++) {
          const want = code.dark[r * N + col] ? FG : BG;
          for (let v = 0; v < k; v++)
            for (let u = 0; u < k; u++) {
              const mid = u >= lo && u < lo + c && v >= lo && v < lo + c;
              if (!mid && !plain[r * N + col]) continue;
              const q = ((r * k + v) * G + col * k + u) * 3;
              for (let ch = 0; ch < 3; ch++) if (Math.abs(cells[q + ch] - want[ch]) > 1e-5) wrong++;
            }
        }
      expect(wrong, center).toBe(0);
      // And the picture is really there: most picture cells are neither
      // plain color.
      let pictured = 0;
      for (let i = 0; i < G * G; i++) if (Math.abs(cells[i * 3] - FG[0]) > 1e-4 && Math.abs(cells[i * 3] - BG[0]) > 1e-4) pictured++; // prettier-ignore
      expect(pictured / (G * G)).toBeGreaterThan(0.3);
    }
  });

  test("each sample scans at the toy's defaults, at phone size and smaller", () => {
    for (const s of SAMPLES) {
      const w = makeWoven(PICS[s.id], { text: TEXT, level: "H", contrast: 0.5, center: "small" });
      const ck = checkWoven(w, read);
      expect(
        ck.sizes.map((x) => x.text),
        s.id,
      ).toEqual([TEXT, TEXT]);
      expect(measure(w).module, s.id).toBeGreaterThan(3);
    }
  });

  test("more contrast never lowers the measured contrast", () => {
    const pic = PICS["spiral-stairs"];
    let last = 0;
    for (let a = 0; a <= 1.0001; a += 0.1) {
      const m = measure(makeWoven(pic, { text: TEXT, level: "M", contrast: a })).module;
      expect(m).toBeGreaterThanOrEqual(last - 1e-9);
      last = m;
    }
    // At full contrast the picture is only a tint (dark cells at most 15% gray).
    expect(last).toBeGreaterThan(10);
  });

  test("Make it scan finds the closest version that reads", () => {
    const pic = PICS["wildflowers"];
    const ask = { text: TEXT, level: "L", contrast: 0, center: "small", style: "bw" };
    expect(checkWoven(makeWoven(pic, ask), read).ok).toBe(false);
    const found = closestScanning(pic, ask, read);
    expect(found).not.toBeNull();
    expect(found.check.ok).toBe(true);
    expect(found.changed.length).toBeGreaterThan(0);
    expect(checkWoven(makeWoven(pic, found.options), read).sizes.map((s) => s.text)).toEqual([TEXT, TEXT]); // prettier-ignore
  });
});

test("Picture QR in the browser: the splats read back, the PNG reads back, and a tap ends on a code that reads", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("qr-picture"));
  await page.waitForFunction(() => window.__splashery.app.player.toyInfo?.id === "qr-picture" && !window.__splashery.app.busy, null, { timeout: 120_000 }); // prettier-ignore
  await page.evaluate(() => (window.__splashery.qrCraft.autoCheck = false));
  const own = "Splashery picture QR";
  await page.evaluate((t) => window.__splashery.app.player.switchTo({ options: { text: t, picture: "wildflowers" } }), own); // prettier-ignore
  await page.waitForFunction(() => !window.__splashery.app.busy, null, { timeout: 120_000 });
  const ck = await page.evaluate(() => window.__splashery.qrCraft.checkPicture().then((c) => ({ ok: c.ok, stage: c.stage, text: c.text }))); // prettier-ignore
  expect(ck.text).toBe(own);
  expect(ck.ok).toBe(true);
  expect(ck.stage.map((s) => s.text)).toEqual([own, own]);
  // The PNG export reads back with jsQR (in Node).
  const b64 = await page.evaluate(async () => {
    const blob = await window.__splashery.qrCraft.savePNG(900);
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000)
      s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const png = PNG.sync.read(Buffer.from(b64, "base64"));
  expect(png.width).toBe(900);
  // Read at phone size (jsQR on a big, busy picture can take minutes).
  const small = resize({ width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) }, 330); // prettier-ignore
  expect(read(small.data, small.width, small.height)).toBe(own);
  // A tap turns the tiles over and ends on the code at rest, which reads.
  await page.evaluate(() => {
    const p = window.__splashery.app.player;
    p.motion.act(p.time, null, { key: "turn" });
  });
  await page.waitForTimeout(4500);
  const after = await page.evaluate(() => window.__splashery.qrCraft.checkPicture().then((c) => c.stage.map((s) => s.text))); // prettier-ignore
  expect(after).toEqual([own, own]);
  expect(errors).toEqual([]);
});
