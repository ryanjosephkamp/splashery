// Lane QR r4 (docs/handoff/QRr4.md): Other barcodes and Picture QR. In Node:
// Code 128's text sits on its label; Data Matrix and Aztec modules are crisp
// and seamless (the QR code toy's builder, src/qr/crisp.js); the QR code toy
// itself builds the very same splats as before the move; Picture QR's halftone
// keeps every module's center, stays close to the photo's gray, picks the
// mask that fits the picture, reads in both styles (with the nudge stepped up
// by jsQR) and at a bigger size. In the browser: Picture QR's splats read back
// from the stage in both styles.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
import jpeg from "jpeg-js";
import { barcodeSplats, symbolFor } from "../src/packs/qr-craft.js";
import { encodeQR } from "../src/qr/encode.js";
import { buildCode } from "../src/qr/build.js";
import {
  makeWoven,
  checkWoven,
  fitMask,
  squareSample,
  plainModules,
  gray,
  FG,
  BG,
} from "../src/qr-craft/picture.js";
import { SAMPLES } from "../src/qr-craft/samples.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const TEXT = "https://ryanjosephkamp.github.io/splashery/";

const ZXing = (() => {
  const m = { exports: {} };
  new Function("module", "exports", "define", fs.readFileSync("vendor/zxing-js/zxing.min.js", "utf8"))(m, m.exports, undefined); // prettier-ignore
  return m.exports.BarcodeFormat ? m.exports : globalThis.ZXing;
})();
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

// How opaque the splats make the point (x, y) (front on, flat splats): one
// minus the product of each nearby splat's transparency there.
function coverage(splats, keep) {
  const grid = new Map();
  const key = (i, j) => `${i},${j}`;
  for (const s of splats) {
    if (!keep(s)) continue;
    const k = key(Math.floor(s.p[0]), Math.floor(s.p[1]));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(s);
  }
  return (x, y) => {
    let clear = 1;
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const s of grid.get(key(Math.floor(x) + i, Math.floor(y) + j)) || []) {
          // Rotation about z only (the crisp rings lie along their edge).
          const [qx, qy, qz, qw] = s.quat;
          const a = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));
          const dx = x - s.p[0];
          const dy = y - s.p[1];
          const u = (Math.cos(a) * dx + Math.sin(a) * dy) / s.scales[0];
          const v = (-Math.sin(a) * dx + Math.cos(a) * dy) / s.scales[1];
          clear *= 1 - s.opacity * Math.exp(-0.5 * (u * u + v * v));
        }
    return 1 - clear;
  };
}

test.describe("Other barcodes", () => {
  test("every linear symbol's text sits on its label", () => {
    for (const o of [
      { kind: "code128", text: "Splashery 2026" },
      { kind: "code128", text: "https://ryanjosephkamp.github.io/splashery/" },
      { kind: "ean13", text: "400638133393" },
      { kind: "upca", text: "03600029145" },
    ]) {
      const S = symbolFor(o);
      const { splats, width, height } = barcodeSplats(S);
      const PW = width / 2 + 1.5;
      const PH = height / 2 + 1.5;
      // The paper is the big splats far behind; everything dark is ink.
      const ink = splats.filter((s) => s.p[2] === 0 && s.color[0] < 0.2);
      expect(ink.length, o.kind).toBeGreaterThan(100);
      const outX = ink.filter((s) => Math.abs(s.p[0]) + s.scales[0] > PW).length;
      const outY = ink.filter((s) => Math.abs(s.p[1]) + s.scales[1] > PH - 0.5).length;
      expect([outX, outY], o.kind).toEqual([0, 0]);
    }
  });

  test("Data Matrix and Aztec modules are crisp and seamless, and every module reads right", () => {
    for (const kind of ["datamatrix", "aztec"]) {
      const S = symbolFor({ kind, text: TEXT }, ZXing);
      const m = S.mat;
      const { splats } = barcodeSplats(S);
      const cov = coverage(splats, (s) => s.p[2] === 0 && s.color[0] < 0.2);
      const x0 = -m.cols / 2;
      const y1 = m.rows / 2;
      const dark = (r, c) => r >= 0 && c >= 0 && r < m.rows && c < m.cols && m.dark[r * m.cols + c] === 1; // prettier-ignore
      let worstSeam = 1;
      let worstLight = 0;
      let worstDark = 1;
      let worstEdge = 0;
      for (let r = 0; r < m.rows; r++)
        for (let c = 0; c < m.cols; c++) {
          const x = x0 + c + 0.5;
          const y = y1 - r - 0.5;
          if (!dark(r, c)) {
            worstLight = Math.max(worstLight, cov(x, y));
            continue;
          }
          worstDark = Math.min(worstDark, cov(x, y));
          // Where two dark modules meet: no seam (along the whole edge).
          for (const t of [-0.4, -0.2, 0, 0.2, 0.4]) {
            if (dark(r, c + 1)) worstSeam = Math.min(worstSeam, cov(x + 0.5, y + t));
            if (dark(r + 1, c)) worstSeam = Math.min(worstSeam, cov(x + t, y - 0.5));
          }
          // A hard edge: 0.1 of a module out from a dark module into a light
          // one, the ink is nearly gone.
          if (!dark(r, c + 1)) worstEdge = Math.max(worstEdge, cov(x + 0.6, y));
        }
      expect(worstDark, kind).toBeGreaterThan(0.99);
      expect(worstSeam, kind).toBeGreaterThan(0.97);
      expect(worstLight, kind).toBeLessThan(0.02);
      expect(worstEdge, kind).toBeLessThan(0.1);
    }
  });

  test("the QR code toy builds the very same splats from the shared builder", () => {
    // The hash of buildCode's output for these codes before the move
    // (main at 8a53aa5c; src/qr/crisp.js came out of src/qr/build.js).
    const h = crypto.createHash("sha256");
    for (const text of ["https://ryanjosephkamp.github.io/splashery/", "Hi"])
      for (const style of ["classic", "dots", "rounded", "bricks", "gems", "bubbles", "neon"])
        for (const plate of ["paper", "metal"]) {
          const code = encodeQR(text, "M");
          const r = buildCode(code, { style, plate, gradient: "linear", fg: "#112233", fg2: "#3355aa", bg: "#ffffff", eyes: "own", eye: "#aa1144" }, 120000); // prettier-ignore
          h.update(JSON.stringify(r));
        }
    expect(h.digest("hex")).toBe(BUILD_HASH);
  });
});

// Recorded from main before the move (see the test above).
const BUILD_HASH = "b3918a78fddc50518d2fef2cecb12cee1cf3b16b05a450e61a166fb39b482144";

test.describe("Picture QR: the halftone", () => {
  test("every module's center and the plain patterns keep their bits (centers in the photo's hue in color), and the free cells are a halftone", () => {
    for (const style of ["color", "bw"]) {
      const w = makeWoven(PICS["wildflowers"], { text: TEXT, style });
      const { code, k, G, cells } = w;
      const N = code.size;
      const plain = plainModules(code);
      let wrong = 0;
      let free = 0;
      let twoTone = 0;
      for (let y = 0; y < G; y++)
        for (let x = 0; x < G; x++) {
          const m = Math.floor(y / k) * N + Math.floor(x / k);
          const q = (y * G + x) * 3;
          const g = gray([cells[q], cells[q + 1], cells[q + 2]]);
          if (plain[m] || (w.center[y * G + x] && style === "bw")) {
            const want = code.dark[m] ? FG : BG;
            for (let ch = 0; ch < 3; ch++) if (Math.abs(cells[q + ch] - want[ch]) > 1e-5) wrong++;
          } else if (w.center[y * G + x]) {
            // The color style: the picture's hue at the ink's or the
            // paper's darkness.
            if (code.dark[m] ? g > 0.101 : g < 0.899) wrong++;
          } else {
            free++;
            // A halftone: each free cell is dark or light, nothing between.
            if (g <= 0.26 || g >= 0.77) twoTone++;
          }
        }
      expect(wrong, style).toBe(0);
      expect(twoTone / free, style).toBeGreaterThan(0.999);
    }
  });

  test("the picture blurred over each module's 3 × 3 cells stays close to the photo's gray", () => {
    for (const s of SAMPLES)
      for (const style of ["color", "bw"]) {
        const pic = PICS[s.id];
        const errOf = (o) => {
          const w = makeWoven(pic, { text: TEXT, style, ...o });
          const { k, G, cells, code } = w;
          const N = code.size;
          const photo = squareSample(pic, N);
          let err = 0;
          let n = 0;
          for (let i = 0; i < N * N; i++) {
            if (w.plain[i]) continue;
            const r = Math.floor(i / N);
            const c = i % N;
            let g = 0;
            for (let v = 0; v < k; v++)
              for (let u = 0; u < k; u++) {
                const q = ((r * k + v) * G + c * k + u) * 3;
                g += gray([cells[q], cells[q + 1], cells[q + 2]]);
              }
            err += Math.abs(g / (k * k) - gray([photo[i * 3], photo[i * 3 + 1], photo[i * 3 + 2]]));
            n++;
          }
          return err / n;
        };
        // The halftone alone (no nudge): within 0.08 of the photo, module by
        // module; with the default nudge, within 0.16 (the old weave was 0.08
        // to 0.19 at its default).
        expect(errOf({ margin: -1 }), `${s.id} ${style}`).toBeLessThan(0.08);
        expect(errOf({}), `${s.id} ${style}`).toBeLessThan(0.16);
      }
  });

  test("the mask is the one that fits the picture best", () => {
    const pic = PICS["still-life"];
    const cost = (code) => {
      const N = code.size;
      const src = squareSample(pic, N);
      const plain = plainModules(code);
      let c = 0;
      for (let i = 0; i < N * N; i++)
        if (!plain[i]) c += Math.abs(gray([src[i * 3], src[i * 3 + 1], src[i * 3 + 2]]) - (code.dark[i] ? 0 : 1)); // prettier-ignore
      return c;
    };
    const best = fitMask(TEXT, "H", pic);
    for (let mask = 0; mask < 8; mask++)
      expect(cost(best)).toBeLessThanOrEqual(cost(encodeQR(TEXT, "H", { boost: false, mask })) + 1e-9); // prettier-ignore
    expect(makeWoven(pic, { text: TEXT }).code.mask).toBe(best.mask);
  });

  test("every sample reads in both styles with the nudge stepped up, and a bigger code reads too", () => {
    for (const s of SAMPLES)
      for (const style of ["color", "bw"]) {
        const w = makeWoven(PICS[s.id], { text: TEXT, style }, read);
        expect(checkWoven(w, read).sizes.map((x) => x.text), `${s.id} ${style}`).toEqual([TEXT, TEXT]); // prettier-ignore
      }
    const small = makeWoven(PICS["wildflowers"], { text: TEXT, level: "M" }, read);
    const big = makeWoven(PICS["wildflowers"], { text: TEXT, level: "M", size: "more" }, read);
    expect(big.code.version).toBe(small.code.version + 4);
    expect(checkWoven(big, read).ok).toBe(true);
  });
});

test("Picture QR in the browser: the splats read back from the stage in both styles", async ({
  page,
}) => {
  test.setTimeout(400_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("qr-picture"));
  await page.waitForFunction(() => window.__splashery.app.player.toyInfo?.id === "qr-picture" && !window.__splashery.app.busy, null, { timeout: 120_000 }); // prettier-ignore
  await page.evaluate(() => (window.__splashery.qrCraft.autoCheck = false));
  for (const o of [
    { picture: "spiral-stairs", style: "color" },
    { picture: "spiral-stairs", style: "bw" },
    { picture: "wildflowers", style: "bw" },
  ]) {
    await page.evaluate((o) => window.__splashery.app.player.switchTo({ options: o }), o);
    await page.waitForFunction(() => !window.__splashery.app.busy, null, { timeout: 120_000 });
    const ck = await page.evaluate(() => window.__splashery.qrCraft.checkPicture().then((c) => ({ ok: c.ok, stage: c.stage.map((s) => s.text), text: c.text }))); // prettier-ignore
    expect(ck.ok, JSON.stringify(o)).toBe(true);
    expect(ck.stage, JSON.stringify(o)).toEqual([ck.text, ck.text]);
  }
  expect(errors).toEqual([]);
});
