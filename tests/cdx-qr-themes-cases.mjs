// Task 58: the original assets, real picker, production layout, and browser exports.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { SAMPLES } from "../src/qr-craft/samples.js";
import { THEMES, candidates, artwork } from "../tools/cdx-qr-themes-art.mjs";
import { LINKS } from "../tools/cdx-qr-themes-links.mjs";
import {
  passedMatrix,
  reusableMatrix,
  requirePassedMatrix,
} from "../tools/cdx-qr-themes-evidence.mjs";
import { layoutTrials, EVIDENCE } from "../tools/cdx-qr-themes.mjs";
import { load } from "../tools/cdx-pics-qr.mjs";
import { capturePicture } from "../tools/cdx-qr-themes-capture.mjs";
import { renderedTrials } from "../tools/cdx-pics-review-browser.mjs";
const PICTURES = SAMPLES.filter((s) => s.id.startsWith("cdx-theme-"));
const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

export function themeCases(theme) {
  const group = THEMES.find(([id]) => id === theme)[1];
  for (const s of PICTURES.filter((s) => s.theme === theme))
    test(`${s.id}: all ten links scan through the production layout`, () => {
      const links = layoutTrials(load(s.file));
      expect(links.map((r) => r.text)).toEqual(LINKS);
      expect(links.flatMap((r) => r.scans.filter((t) => !t.ok))).toEqual([]);
    });

  test(`${group}: selected backgrounds scan in the browser and load only on selection`, async ({
    page,
  }) => {
    test.setTimeout(600000);
    const requests = [],
      errors = [];
    page.on("request", (r) => requests.push(r.url()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    expect(requests.filter((s) => s.includes("/qr-picture/themes/"))).toEqual([]);
    await page.evaluate(async () => {
      await import("/src/packs/qr-craft.js");
      window.__splashery.qrCraft.autoCheck = false;
      await window.__splashery.app.chooseToy("qr-picture");
    });
    expect(requests.filter((s) => s.includes("/qr-picture/themes/"))).toEqual([]);
    if (await page.locator("#sheet-toggle").isVisible()) {
      if ((await page.locator("#sheet-toggle").getAttribute("aria-expanded")) === "false")
        await page.locator("#sheet-toggle").click();
    }
    await page.locator("#tab-play").click();
    const select = page
      .locator("select")
      .filter({ has: page.locator(`optgroup[label="${group}"]`) });
    await expect(select).toHaveCount(1);
    await expect(select.locator("optgroup")).toHaveCount(6);
    await expect(select.locator(`optgroup[label="${group}"] option`)).toHaveCount(8);
    for (const s of PICTURES.filter((s) => s.theme === theme)) {
      const before = requests.filter((u) => u.includes("/qr-picture/themes/")).length;
      await select.selectOption(s.id);
      await page.waitForFunction(
        (id) =>
          !window.__splashery.app.busy &&
          window.__splashery.qrCraft.picture().options?.picture === id,
        s.id,
      );
      const added = requests.filter((u) => u.includes("/qr-picture/themes/")).slice(before);
      expect(added).toHaveLength(1);
      expect(added[0]).toContain(s.file);
      await expect(select.locator("option:checked")).toContainText("code-made");
      await expect(page.locator("#credits")).toContainText(s.author);
      await expect(page.locator("#credits")).toContainText("CC0 1.0");
      const ck = await page.evaluate(() => window.__splashery.qrCraft.checkPicture());
      expect(ck.ok).toBe(true);
      expect(ck.stage.every((r) => r.ok)).toBe(true);
      // Schemes, short/long payloads, and queries; the complete ten-link matrix is above.
      for (const text of [LINKS[0], LINKS[3], LINKS.at(-1)]) {
        await page.evaluate((text) => window.__splashery.app.setToyOptions({ text }), text);
        const shot = await capturePicture(page, 900);
        expect(shot.text).toBe(text);
        expect(shot.options.level).toBe("H");
        expect(shot.options.contrast).toBe(0.5);
        expect(shot.options.center).toBe("small");
        expect(shot.options.style).toBe("color");
        expect(shot.options.size).toBe("more");
        const png = PNG.sync.read(Buffer.from(shot.bytes));
        expect(
          renderedTrials(png, shot.codeSize, text, { rawDiagnostic: false }).scans.filter(
            (r) => !r.ok,
          ),
          `${s.id}: ${text}`,
        ).toEqual([]);
      }
    }
    const exported = await page.evaluate(async () => {
      const q = window.__splashery.qrCraft;
      return {
        bytes: await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.onerror = () => reject(reader.error);
          q.savePNG(900).then((blob) => reader.readAsDataURL(blob), reject);
        }),
        size: q.picture().woven.code.size,
      };
    });
    const png = PNG.sync.read(Buffer.from(exported.bytes, "base64"));
    expect(png.width).toBe(900);
    const sameCamera = await capturePicture(page, 900);
    const samePixels = PNG.sync.read(Buffer.from(sameCamera.bytes));
    expect(
      Buffer.compare(png.data, samePixels.data),
      "screening pixels match the production PNG export",
    ).toBe(0);
    expect(
      renderedTrials(png, exported.size, LINKS.at(-1), { rawDiagnostic: false }).eligible,
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      391,
    );
    expect(errors).toEqual([]);
  });
}
