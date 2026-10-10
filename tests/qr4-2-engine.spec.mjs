// Lane QR r4 part 2 (docs/handoff/QRr4.md): the Share tab's "QR code" button
// is there only with labs on, and it opens the scene's QR code (src/qr/
// share.js, loaded only then).

import { test, expect } from "@playwright/test";

for (const labs of [false, true]) {
  test(`the Share tab's QR code button with labs ${labs ? "on" : "off"}`, async ({ page }) => {
    await page.goto(`/?renderer=webgl2&adapt=off&profile=mid${labs ? "&labs=1" : ""}`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    const r = await page.evaluate(() => ({
      hidden: document.getElementById("share-qr").hidden,
      handler: typeof window.__splashery.app.openShareQR,
    }));
    expect(r.hidden).toBe(!labs);
    expect(r.handler).toBe("function");
  });
}
