// Lane PDF lab, engine part (docs/handoff/PDFLab.md): the Share tab's "Save
// PDF" row. It shows only with labs on, and opening it loads the PDF export
// module (src/pdf-export/) on demand; nothing of it loads before.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function open(page, labs) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const asked = [];
  page.on("request", (r) => asked.push(r.url()));
  await page.goto(`${APP}&labs=${labs ? 1 : 0}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return { errors, asked };
}

test("Save PDF: hidden without labs, and nothing of it loads", async ({ page }) => {
  const { errors, asked } = await open(page, false);
  await page.click("#tab-share");
  await expect(page.locator("#pdf-row")).toBeHidden();
  expect(asked.filter((u) => /pdf-export|pdf-lib/.test(u))).toEqual([]);
  expect(errors).toEqual([]);
});

test("Save PDF: shown with labs; the module loads only when opened", async ({ page }) => {
  const { errors, asked } = await open(page, true);
  await page.click("#tab-share");
  await expect(page.locator("#pdf-row")).toBeVisible();
  expect(asked.filter((u) => /pdf-export|pdf-lib/.test(u))).toEqual([]);
  await page.click("#export-pdf");
  await expect.poll(() => asked.some((u) => /src\/pdf-export\/index\.js/.test(u))).toBe(true);
  expect(errors).toEqual([]);
});
