// Task 84: real route smoke checks; the longer evidence walk runs only on demand.
import { test, expect } from "@playwright/test";
import { openRoute, exportCode, decodePNG, phonePNG, PAYLOAD } from "../tools/adv-route.mjs";

test.use({ viewport: { width: 390, height: 844 } });

for (const id of ["photo-3d", "moving-photo-3d", "qr-code", "qr-picture", "qr-three"]) {
  test(`${id} opens without console or page errors`, async ({ page, baseURL }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await openRoute(page, id, baseURL);
    expect(await page.evaluate(() => window.__splashery.player.scene.toy.id)).toBe(id);
    expect(errors).toEqual([]);
  });
}

for (const id of ["qr-code", "qr-picture", "qr-three", "share-qr"]) {
  test(`${id} exports a PNG that both readers decode exactly`, async ({ page, baseURL }) => {
    await openRoute(page, id === "share-qr" ? "qr-code" : id, baseURL);
    const { png, payload, decodeOptions } = await exportCode(page, id);
    if (id !== "share-qr") expect(payload).toBe(PAYLOAD);
    expect(await decodePNG(page, await phonePNG(page, png), decodeOptions)).toEqual({
      jsqr: payload,
      zxing: payload,
    });
  });
}
