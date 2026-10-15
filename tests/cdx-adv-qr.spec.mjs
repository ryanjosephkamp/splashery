import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import fs from "node:fs/promises";
import { decodePNG, phonePNG } from "../tools/adv-route.mjs";

// Captured from an actual share export at createdAt 2026-10-15T14:31:42.482Z.
// Its valid version-22 matrix contains data that ZXing mistakes for a finder.
// Raster diagnostics preserve these exact bytes. Dialog tests reuse the scene
// and check the URL produced by the current page's origin and compressor.
const PAYLOAD =
  "http://127.0.0.1:4173/#s=d.fVPLltowDP0XzTbDG8pk129oV-2ZheII4sHYrq0MUA7_XskQOoc5bTaxHF3pXunmDBgj1JCjw9xROkEF75SyDR7qeQUmETK1X1lyZpPZ6nk6eZ4uv08X9XxaL2ajxXr2QyCZqIV6WgGHE9Rn2FkvMTS9dWy9JFgNf6VnE1qSMESWDllTmY5avGOOuR6P0wn9W8gUux3u42hrueubkQ3jO8Ox4G_1nfU7iTaWXCvFQJnwyZEcjWRna-ByqcCFsNNWDZrdNoW-YCNulQl3tNd87DlIiMaQ57-xduVvBrWmyKNjDLlPGkhd2mzIcFERw470rWPboMukTBL5LXdQT0arCg6habTKZLQU6KEI-Gf-cllBa5NUL4uYXDTMObj3T12ibKgdMDmWRVx7tCnEh-xGxJtCYqHZBpkpDfl73Hri_7D6UkHC1vb5WkAgfLD5EYF7acKl6EfVYiY8Wt3SCQSZnTWPWmS29iZYEg5EsQCXd-RRkRGt_8TS_qZbx6tPboEJLog-eKLVvJlRccMdn1kcJmV_vsqtwT0l1OsTHgqBaNl05ZSCc-UgO2AsA5yN1vP1i-DUJ9KxuJ775BmLXk49DQaR_j54unLXgXtNLn9EuRcDO9xe7RtTeBu2DoeEUe4SRfkJczFgEaSc4WlTHvk-iJPTpFlsXgy8lt26YSTDRgTfEqN1xZK68XDtdAZ09v1Oex_0LPOxovujqbS_ZxmHev5yufwB";
const GEOMETRY = { qrModules: 105 };

test("the saved finder counterexample exports a PNG both readers find without geometry hints", async ({
  page,
}) => {
  await page.goto("/");
  const shared = await page.evaluate(async (payload) => {
    const { decodeSceneHash } = await import("/src/codec.js");
    const { openShareQR } = await import("/src/qr/share.js");
    const scene = await decodeSceneHash(payload.split("#s=")[1]);
    return openShareQR({ exportScene: () => scene });
  }, PAYLOAD);
  expect(new URL(shared.url).origin).toBe(new URL(page.url()).origin);
  const downloaded = page.waitForEvent("download");
  await page.locator("#sqr-save").click();
  const native = await fs.readFile(await (await downloaded).path());
  const phone = await phonePNG(page, native);
  expect(PNG.sync.read(native).width).toBe(1130);
  expect(PNG.sync.read(phone).width).toBe(390);
  for (const png of [phone, native])
    expect(await decodePNG(page, png)).toEqual({ jsqr: shared.url, zxing: shared.url });
});

test("a reader load failure offers JSON and permits an export retry", async ({ page }) => {
  await page.route("**/vendor/zxing-js/zxing.min.js", (route) => route.abort());
  await page.goto("/");
  const shared = await page.evaluate(async (payload) => {
    const { decodeSceneHash } = await import("/src/codec.js");
    const { openShareQR } = await import("/src/qr/share.js");
    const scene = await decodeSceneHash(payload.split("#s=")[1]);
    return openShareQR({ exportScene: () => scene });
  }, PAYLOAD);
  const downloads = [];
  page.on("download", (d) => downloads.push(d));
  await page.locator("#sqr-save").click();
  await expect(page.locator("#sqr-check")).toContainText("Try again, or save JSON");
  await expect(page.locator("#sqr-json")).toBeVisible();
  await expect(page.locator("#sqr-save")).toBeEnabled();
  expect(downloads).toHaveLength(0);
  await page.unroute("**/vendor/zxing-js/zxing.min.js");
  const downloaded = page.waitForEvent("download");
  await page.locator("#sqr-save").click();
  const png = await fs.readFile(await (await downloaded).path());
  expect(await decodePNG(page, await phonePNG(page, png))).toEqual({
    jsqr: shared.url,
    zxing: shared.url,
  });
  expect(downloads).toHaveLength(1);
});

async function shareRaster(page) {
  await page.goto("/");
  const bytes = await page.evaluate(async (payload) => {
    const { shareCode } = await import("/src/qr/share-code.js");
    const { drawCode } = await import("/src/qr/share.js");
    const { canvasToBlob } = await import("/src/exports.js");
    const { code } = shareCode(payload);
    return Array.from(new Uint8Array(await (await canvasToBlob(drawCode(code, 10))).arrayBuffer()));
  }, PAYLOAD);
  return Buffer.from(bytes);
}

test("diagnostic: original share pixels decode with geometry while the phone finder fails", async ({
  page,
}, testInfo) => {
  const native = await shareRaster(page);
  const phone = await phonePNG(page, native);
  expect(PNG.sync.read(native).width).toBe(1130);
  expect(PNG.sync.read(phone).width).toBe(390);
  await testInfo.attach("counterexample-native", { body: native, contentType: "image/png" });
  await testInfo.attach("counterexample-phone", { body: phone, contentType: "image/png" });
  // The general finder remains a separate diagnostic; it fails on these same pixels.
  expect(await decodePNG(page, phone)).toEqual({ jsqr: PAYLOAD, zxing: null });
  for (const png of [native, phone])
    expect(await decodePNG(page, png, GEOMETRY)).toEqual({ jsqr: PAYLOAD, zxing: PAYLOAD });
});

test("declared export geometry rejects wrong dimensions, blank pixels, and corrupted data", async ({
  page,
}) => {
  const native = await shareRaster(page);
  expect((await decodePNG(page, native, { qrModules: 101 })).zxing).toBeNull();
  const wide = new PNG({ width: 1131, height: 1130 });
  PNG.bitblt(PNG.sync.read(native), wide, 0, 0, 1130, 1130, 0, 0);
  expect((await decodePNG(page, PNG.sync.write(wide), GEOMETRY)).zxing).toBeNull();
  const dirty = PNG.sync.read(native);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const i = (y * dirty.width + x) * 4;
      dirty.data[i] = dirty.data[i + 1] = dirty.data[i + 2] = 0;
    }
  expect((await decodePNG(page, PNG.sync.write(dirty), GEOMETRY)).zxing).toBeNull();
  const image = PNG.sync.read(native);
  image.data.fill(255);
  expect(await decodePNG(page, PNG.sync.write(image), GEOMETRY)).toEqual({
    jsqr: null,
    zxing: null,
  });
  const corrupt = PNG.sync.read(native);
  for (let y = 120; y < 1010; y++)
    for (let x = 120; x < 1010; x++) {
      const i = (y * corrupt.width + x) * 4;
      corrupt.data[i] = corrupt.data[i + 1] = corrupt.data[i + 2] = 255;
    }
  expect(await decodePNG(page, PNG.sync.write(corrupt), GEOMETRY)).toEqual({
    jsqr: null,
    zxing: null,
  });
});
