// Manual r2: the newcomer material in manual/index.html (the "What is a 3D
// Gaussian?" box, three figures, the glossary, further reading, the runnable
// recipe and the "What else Splashery does now" chapter).
import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("the newcomer material is there and every contents link has a target", async ({ page }) => {
  const problems = [];
  page.on("pageerror", (e) => problems.push(e.message));
  await page.goto("/manual/");
  await expect(page.locator("#what-is-a-gaussian")).toContainText("probability density");
  for (const label of ["Three ways", "Representation", "The twelve"]) {
    await expect(page.locator(`figure svg[aria-label^='${label}']`)).toHaveCount(1);
  }
  await expect(page.locator("dl.glossary dt")).toHaveCount(14);
  await expect(page.locator("ul.reading a[href^='https://']")).toHaveCount(6);
  const hrefs = await page.locator("nav.toc a").evaluateAll((as) => as.map((a) => a.getAttribute("href"))); // prettier-ignore
  for (const h of hrefs) await expect(page.locator(h)).toHaveCount(1);
  for (const id of ["glossary", "reading", "more", "run-it"]) await expect(page.locator(`#${id}`)).toHaveCount(1); // prettier-ignore
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(problems).toEqual([]);
});

test("the runnable recipe: the module, the catalog entry and the URL agree", async () => {
  const html = fs.readFileSync("manual/index.html", "utf8");
  const mod = fs.readFileSync("manual/example-recipe.js", "utf8");
  expect(mod.split("\n")[0]).toBe('import { mix } from "../src/kit.js";');
  expect(mod).toContain('"little-windmill": {');
  expect(html).toContain('pack: "little-windmill"');
  expect(html).toContain("embed/index.html?toy=little-windmill");
  expect(html).toContain('import { mix } from "../kit.js";');
});
