// Lane QR r4 (docs/handoff/QRr4.md; the owner's note of October 9, 2026): the
// QR code toy and Picture QR scan their code before it is shown. From the
// build until the automatic check is done, a still of the stage stays up with
// "Please wait. Scanning code…" on it; then the new code shows, and it reads.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

for (const [id, change, hook] of [
  ["qr-code", { text: "Scanned first" }, "qr"],
  ["qr-picture", { picture: "ai-wave" }, "qrCraft"],
]) {
  test(`${id}: the code is scanned behind a labeled still, then shown`, async ({ page }) => {
    test.setTimeout(300_000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
    await page.waitForFunction((id) => window.__splashery.app.player.toyInfo?.id === id && !window.__splashery.app.busy, id, { timeout: 120_000 }); // prettier-ignore
    // Let the first build's check finish.
    await page.waitForFunction(() => !document.querySelector(".stage-cover"), null, { timeout: 120_000 }); // prettier-ignore
    // Every frame: is the labeled still up?
    await page.evaluate(() => {
      const log = (window.__scan = { labeled: 0, frames: 0 });
      const tick = () => {
        const el = document.querySelector(".stage-cover");
        log.frames++;
        if (el?.dataset.label === "Please wait. Scanning code…") log.labeled++;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.evaluate((o) => window.__splashery.app.player.switchTo({ options: o }), change);
    await page.waitForFunction(() => !window.__splashery.app.busy, null, { timeout: 120_000 });
    // The still comes down once the check is done.
    await page.waitForFunction(() => !document.querySelector(".stage-cover"), null, { timeout: 120_000 }); // prettier-ignore
    const r = await page.evaluate((hook) => {
      const h = window.__splashery[hook];
      const check = hook === "qr" ? h.info().check : h.picture().check;
      return { log: window.__scan, ok: check?.ok, stage: check?.stage?.map((s) => s.ok) };
    }, hook);
    expect(r.log.labeled).toBeGreaterThan(0);
    expect(r.ok).toBe(true);
    if (r.stage) expect(r.stage).toEqual([true, true]);
    expect(errors).toEqual([]);
  });
}
