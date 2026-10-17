import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { read } from "../tools/qrc-picture.mjs";
import { readZxingCpp } from "../tools/qrs-study/readers.mjs";

test("Most detail exports wait for both real readers and keep the checked payload", async ({
  page,
}) => {
  const text = "https://example.org/a/1";
  await page.goto("/?renderer=webgl2&adapt=off&profile=low&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async (text) => {
    const { app } = window.__splashery;
    await app.chooseToy("qr-picture");
    const OriginalWorker = window.Worker;
    window.__blockExportReplies = true;
    window.__exportReplies = [];
    window.Worker = class extends OriginalWorker {
      constructor(...args) {
        super(...args);
        this.pictureScan = String(args[0]).includes("/qr-craft/scan-worker.js");
        this.dual = new Set();
      }
      postMessage(job, transfer) {
        if (this.pictureScan && job.dual) this.dual.add(job.id);
        super.postMessage(job, transfer);
      }
      set onmessage(handler) {
        super.onmessage = (event) => {
          const deliver = () => handler(event);
          if (this.pictureScan && this.dual.has(event.data.id) && window.__blockExportReplies)
            window.__exportReplies.push(deliver);
          else deliver();
        };
      }
    };
    await app.setToyOptions({
      text,
      fidelity: "detail",
      picture: "ai-farm",
      shape: "square",
      size: "more",
      level: "H",
      center: "small",
      contrast: 0.5,
      style: "color",
    });
  }, text);
  await page.waitForFunction(() => window.__exportReplies.length > 0);
  await expect(page.locator("#qrc-png")).toBeDisabled({ timeout: 1000 });
  expect(await page.evaluate(() => window.__splashery.qrCraft.savePNG(512))).toBeNull();
  await page.evaluate(() => {
    window.__blockExportReplies = false;
    for (const deliver of window.__exportReplies.splice(0)) deliver();
  });
  await page.waitForFunction(() => {
    const { app, qrCraft } = window.__splashery,
      p = qrCraft.picture();
    return !app.busy && !p.checking && p.check?.stress?.ok && !app.player.stage.coverDepth;
  });
  await expect(page.locator("#qrc-png")).toBeEnabled();
  const bytes = await page.evaluate(async () =>
    Array.from(new Uint8Array(await (await window.__splashery.qrCraft.savePNG(512)).arrayBuffer())),
  );
  const image = PNG.sync.read(Buffer.from(bytes));
  expect(read(image.data, image.width, image.height)).toBe(text);
  expect(await readZxingCpp(image)).toBe(text);
});
