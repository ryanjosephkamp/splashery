// QR scan lab (docs/handoff/QRLab.md): a fast regression check that the QR toy's codes still scan.
// Every style at its default colors is rendered through the toy's test hook, then made into
// simulated phone captures (front-on and at 20°, small and large modules) and read by two
// independent readers, jsQR and zxing-js. Both must return the exact text. The full sweep that
// sets the defaults lives in tools/qr-scan-lab.mjs; its scorecard is docs/audits/qr-scan-lab-2026-10.md.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { PNG } from "pngjs";
import { applyCondition, conditions } from "../tools/qr-scan-lab/sim.mjs";
import { readers, invertedReaders } from "../tools/qr-scan-lab/readers.mjs";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const TEXT = "https://ryanjosephkamp.github.io/splashery/";
const STYLES = ["classic", "dots", "rounded", "bricks", "gems", "bubbles", "neon"];
// Front-on and at 20°, small modules and large (px per module in the capture).
const CHECKS = [
  { id: "front-small", yaw: 0, modulePx: 4 },
  { id: "front-large", yaw: 0, modulePx: 12 },
  { id: "tilt20-small", yaw: 20, modulePx: 5 },
  { id: "tilt20-large", yaw: 20, modulePx: 9 },
];

// The toy lives on lane QR's branch until it merges; this file rides along with the lab.
const HAS_TOY = fs.existsSync(new URL("../src/packs/qr.js", import.meta.url));
test.skip(!HAS_TOY, "the QR toy (src/packs/qr.js) is not on this branch yet");

test("every QR style at its defaults scans after simulated phone captures", async ({ page }) => {
  test.setTimeout(480_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("qr-code"));
  await page.waitForFunction(() => window.__splashery.qr && window.__splashery.qr.info().size, null, { timeout: 60_000 }); // prettier-ignore
  const failures = [];
  for (const style of STYLES) {
    const info = await page.evaluate(async ({ style, text }) => {
      await window.__splashery.qr.set({ style, text });
      const i = window.__splashery.qr.info();
      return { size: i.size };
    }, { style, text: TEXT }); // prettier-ignore
    const b64 = await page.evaluate(async () => {
      const buf = new Uint8Array(await (await window.__splashery.qr.png(1024)).arrayBuffer());
      let s = "";
      for (let i = 0; i < buf.length; i += 0x8000)
        s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    });
    const png = PNG.sync.read(Buffer.from(b64, "base64"));
    const flat = { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
    const modules = info.size + 10; // the quiet zone and a one-module margin
    const base = conditions().find((c) => c.id === "front");
    for (const ck of CHECKS) {
      const cap = applyCondition(flat, modules, { ...base, yaw: ck.yaw, modulePx: ck.modulePx });
      // Neon is light on dark by design: it is read by readers that also try inverted codes.
      for (const [name, read] of Object.entries(style === "neon" ? invertedReaders : readers)) {
        if (read(cap) !== TEXT) failures.push(`${style} ${ck.id} (${name})`);
      }
    }
  }
  expect(failures, `these captures did not decode: ${failures.join("; ")}`).toEqual([]);
  expect(errors).toEqual([]);
});
