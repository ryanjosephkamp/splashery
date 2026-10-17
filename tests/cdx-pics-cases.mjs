// Task 54: new samples use the real browser and production scan paths.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";

import { QR_PICTURES } from "../src/qr-craft/codex-pictures.js";

import { load, read, TEXT } from "../tools/cdx-pics-qr.mjs";
import { pictureTrials } from "../tools/cdx-pics-review.mjs";
import { LINKS } from "../tools/cdx-pics-links.mjs";
import { capturePicture } from "../tools/cdx-qr-themes-capture.mjs";
import { renderedTrials } from "../tools/cdx-pics-review-browser.mjs";
const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

// Six disjoint partitions retain every sample and every original assertion.
export function pictureCases(partition) {
  const cases = [];
  const pictures = QR_PICTURES.filter((_, i) => i % 6 === partition);
  for (const s of pictures)
    cases.push([
      `${s.label}: production layout scans all five links at default H`,
      () => {
        const results = pictureTrials(load(s.file));
        expect(results.map((r) => r.text)).toEqual(LINKS);
        expect(results.every((r) => r.eligible)).toBe(true);
      },
    ]);

  for (const s of pictures)
    cases.push([
      `${s.label}: five-link browser scans, credits, and lazy loading`,
      async ({ page }) => {
        test.setTimeout(240000);
        const errors = [],
          requests = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("request", (r) => requests.push(r.url()));
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(APP);
        await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
        await page.evaluate(async () => {
          await import("/src/packs/qr-craft.js");
          window.__splashery.qrCraft.autoCheck = false;
          await window.__splashery.app.chooseToy("qr-picture");
        });
        expect(requests.filter((u) => u.includes("/qr-picture/codex/"))).toEqual([]);
        {
          await page.evaluate(
            (id) =>
              window.__splashery.app.setToyOptions({
                picture: id,
                text: "https://ryanjosephkamp.github.io/splashery/",
              }),
            s.id,
          );
          await page.waitForFunction(
            (id) =>
              !window.__splashery.app.busy &&
              window.__splashery.qrCraft.picture().options?.picture === id,
            s.id,
          );
          const ck = await page.evaluate(() => window.__splashery.qrCraft.checkPicture());
          expect(ck.ok, s.id).toBe(true);
          expect(
            ck.stage.map((r) => r.text),
            s.id,
          ).toEqual([TEXT, TEXT]);
          await expect(page.locator("#credits")).toContainText(s.label);
          await expect(page.locator("#credits")).toContainText(s.author);
          await expect(page.locator("#credits")).toContainText(s.ai ? "AI-made" : "CC0 1.0");
          for (const text of LINKS) {
            await page.evaluate((text) => window.__splashery.app.setToyOptions({ text }), text);
            const shot = await capturePicture(page, 900),
              png = PNG.sync.read(Buffer.from(shot.bytes));
            expect(shot.text).toBe(text);
            expect(shot.options.level).toBe("H");
            const result = renderedTrials(png, shot.codeSize, text, { rawDiagnostic: false });
            expect(
              result.scans.filter((r) => !r.ok),
              s.id + ": " + text,
            ).toEqual([]);
          }
          // Exercise the actual export API as well, with the longest link.
          const exported = await page.evaluate(async () => {
            const q = window.__splashery.qrCraft;
            const b = await q.savePNG(900);
            return {
              bytes: await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(",")[1]);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(b);
              }),
              size: q.picture().woven.code.size,
            };
          });
          const png = PNG.sync.read(Buffer.from(exported.bytes, "base64"));
          expect(png.width).toBe(900);
          expect(
            renderedTrials(png, exported.size, LINKS.at(-1), { rawDiagnostic: false }).eligible,
            s.id,
          ).toBe(true);
          console.log(`${s.label}: five links, production scan, credits, and export passed`);
        }
        expect(requests.some((u) => u.includes("/ai/cdx-"))).toBe(false);
        expect(new Set(requests.filter((u) => u.includes("/qr-picture/codex/"))).size).toBe(1);
        expect(errors).toEqual([]);
      },
    ]);
  return cases;
}
