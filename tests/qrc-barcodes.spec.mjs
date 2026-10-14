// Lane QR craft (docs/handoff/QRcraft.md): the barcodes. In Node: the check
// digits match published reference values (docs/evidence/
// barcodes.json); every Code 128 pattern is 11 modules (the stop 13); our bars
// match BWIPP's (bwip-js) wherever the encoding has one obvious form; and
// every symbol, ours and the vendored zxing-js's Data Matrix and Aztec, reads
// back in zxing-cpp (an independent reader). In the browser: each kind reads
// back from the stage.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import bwipjs from "bwip-js";
import { readBarcodes } from "zxing-wasm/full";
import { initZxingCpp } from "../tools/qrs-study/readers.mjs";
import {
  C128,
  code128,
  code128Values,
  code128Check,
  ean13,
  upcA,
  gs1Check,
  rasterLinear,
  raster2D,
} from "../src/qr-craft/barcodes.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

// The vendored zxing-js, as the toy loads it (it sets ZXing on the global).
const ZXing = (() => {
  const m = { exports: {} };
  new Function("module", "exports", "define", fs.readFileSync("vendor/zxing-js/zxing.min.js", "utf8"))(m, m.exports, undefined); // prettier-ignore
  return m.exports.BarcodeFormat ? m.exports : globalThis.ZXing;
})();

async function zxingCpp(img, format) {
  await initZxingCpp();
  const res = await readBarcodes({ data: img.data, width: img.width, height: img.height, colorSpace: "srgb" }, { formats: [format] }); // prettier-ignore
  return res.filter((r) => r.isValid).map((r) => r.text)[0] ?? null;
}

test.describe("barcodes: the math", () => {
  test("check digits match published reference values", () => {
    // EAN-13 and UPC-A examples from GS1's check digit method as printed on
    // Wikipedia's "International Article Number" and "Universal Product
    // Code" articles, and an ISBN-13 (Wikipedia, "ISBN").
    expect(gs1Check("400638133393")).toBe(1);
    expect(ean13("400638133393").text).toBe("4006381333931");
    expect(ean13("978030640615").text).toBe("9780306406157");
    expect(upcA("03600029145").text).toBe("036000291452");
    expect(gs1Check("03600029145")).toBe(2);
    // A wrong check digit is caught, a right one accepted.
    expect(() => ean13("4006381333932")).toThrow(/check digit/);
    expect(ean13("4006381333931").check).toBe(1);
    expect(() => upcA("036000291453")).toThrow(/check digit/);
    // Code 128 in code set B: "PJJ123C" is start B (104), then P 48, J 42,
    // J 42, 1 17, 2 18, 3 19, C 35; the check symbol is 104 + 48·1 + 42·2 +
    // 42·3 + 17·4 + 18·5 + 19·6 + 35·7 = 879, and 879 mod 103 = 55.
    expect(code128Values("PJJ123C").values).toEqual([104, 48, 42, 42, 17, 18, 19, 35, 55]);
    // Wikipedia's worked example ("Code 128") is the same text in code set A
    // (start A, 103): its check symbol is 54, a "V".
    expect(code128Check([103, 48, 42, 42, 17, 18, 19, 35])).toBe(54);
    const v = code128Values("PJJ123C").values;
    let sum = v[0];
    for (let i = 1; i < v.length - 1; i++) sum += v[i] * i;
    expect(v.at(-1)).toBe(sum % 103);
    // Code set C packs digit pairs: "1234567890" is start C, 12 34 56 78 90
    // and the check symbol (105 + 12 + 68 + 168 + 312 + 450 = 1115; 1115
    // mod 103 = 85).
    expect(code128Values("1234567890").values).toEqual([105, 12, 34, 56, 78, 90, 85]);
  });

  test("every Code 128 pattern has the right width, and the symbols the standard's quiet zones", () => {
    expect(C128.length).toBe(107);
    for (let i = 0; i < 106; i++) {
      const w = Array.from(C128[i], Number);
      expect(w.length).toBe(6);
      expect(
        w.reduce((a, b) => a + b, 0),
        `value ${i}`,
      ).toBe(11);
    }
    expect(Array.from(C128[106], Number).reduce((a, b) => a + b, 0)).toBe(13);
    // All 107 patterns differ.
    expect(new Set(C128).size).toBe(107);
    const s = code128("Splashery");
    expect(s.modules).toBe(11 * s.values.length + 13);
    expect(s.quiet).toEqual([10, 10]);
    expect(ean13("400638133393").modules).toBe(95);
    expect(ean13("400638133393").quiet).toEqual([11, 7]);
    expect(upcA("03600029145").quiet).toEqual([9, 9]);
  });

  test("our bars match BWIPP's where the encoding has one obvious form", () => {
    for (const t of ["HELLO", "Splashery 2026", "abc123456def", "1234567890", "x99"])
      expect(code128(t).widths.join(""), t).toBe(bwipjs.raw("code128", t)[0].sbs.join(""));
    for (const d of ["4006381333931", "9780306406157", "2001234567893"])
      expect(ean13(d).widths.join(""), d).toBe(bwipjs.raw("ean13", d)[0].sbs.join(""));
    for (const d of ["036000291452", "401234567893"])
      expect(upcA(d).widths.join(""), d).toBe(bwipjs.raw("upca", d)[0].sbs.join(""));
  });

  test("every symbol reads back in zxing-cpp", async () => {
    const texts = ["Splashery 2026", "12345", "Wi-Fi\tok", "https://ryanjosephkamp.github.io/splashery/", "a"]; // prettier-ignore
    for (const t of texts) expect(await zxingCpp(rasterLinear(code128(t)), "Code128"), JSON.stringify(t)).toBe(t); // prettier-ignore
    for (const d of ["400638133393", "200123456789", "978030640615"])
      expect(await zxingCpp(rasterLinear(ean13(d)), "EAN13")).toBe(ean13(d).text);
    for (const d of ["03600029145", "40123456789"])
      // A UPC-A symbol is, bar for bar, an EAN-13 symbol starting with 0, and
      // zxing-cpp may give it in that 13-digit form.
      expect((await zxingCpp(rasterLinear(upcA(d)), "UPCA"))?.replace(/^0(?=\d{12}$)/, "")).toBe(upcA(d).text); // prettier-ignore
    // Data Matrix and Aztec from the vendored zxing-js.
    for (const t of [
      "Splashery",
      "https://ryanjosephkamp.github.io/splashery/",
      "Hello, world! 123",
    ]) {
      for (const [fmt, writer, name] of [
        [ZXing.BarcodeFormat.DATA_MATRIX, new ZXing.DataMatrixWriter(), "DataMatrix"],
        [ZXing.BarcodeFormat.AZTEC, new ZXing.AztecCodeWriter(), "Aztec"],
      ]) {
        const bm = writer.encode(t, fmt, 0, 0, new Map());
        const rows = bm.getHeight();
        const cols = bm.getWidth();
        const dark = new Uint8Array(rows * cols);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) dark[r * cols + c] = bm.get(c, r) ? 1 : 0; // prettier-ignore
        expect(await zxingCpp(raster2D({ rows, cols, dark }), name), `${name} ${t}`).toBe(t);
      }
    }
  });
});

test("Other barcodes in the browser: every kind reads back from the stage", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("barcodes"));
  await page.waitForFunction(() => window.__splashery.app.player.toyInfo?.id === "barcodes" && !window.__splashery.app.busy, null, { timeout: 120_000 }); // prettier-ignore
  await page.evaluate(() => (window.__splashery.qrCraft.autoCheck = false));
  const cases = [
    { kind: "code128", text: "Splashery 2026", want: "Splashery 2026" },
    { kind: "ean13", text: "200123456789", want: "2001234567893" },
    { kind: "upca", text: "40123456789", want: "401234567893" },
    { kind: "datamatrix", text: "Splashery barcodes", want: "Splashery barcodes" },
    { kind: "aztec", text: "Splashery barcodes", want: "Splashery barcodes" },
  ];
  for (const c of cases) {
    await page.evaluate((o) => window.__splashery.app.player.switchTo({ options: o }), { kind: c.kind, text: c.text }); // prettier-ignore
    await page.waitForFunction(() => !window.__splashery.app.busy, null, { timeout: 120_000 });
    const ck = await page.evaluate(() => window.__splashery.qrCraft.checkBarcode().then((r) => r.sizes.map((s) => s.text))); // prettier-ignore
    expect(ck, c.kind).toEqual([c.want, c.want]);
  }
  // A tap's scan ends with every bar back in place, still reading.
  await page.evaluate(() => {
    const p = window.__splashery.app.player;
    p.motion.act(p.time, null, { key: "scan" });
  });
  // The toy's clock runs slower than the wall clock in the software
  // renderer: wait for the scan itself to end.
  await page.waitForFunction(() => !(window.__splashery.app.player.motion.state.scan > 0), null, { timeout: 60_000 }); // prettier-ignore
  await page.waitForTimeout(500);
  const after = await page.evaluate(() =>
    window.__splashery.qrCraft.checkBarcode().then((r) => r.ok),
  );
  expect(after).toBe(true);
  expect(errors).toEqual([]);
});
