// Lane Pitch: the one-link page, site/about/splashery/. It loads without console errors, every
// live toy starts (or shows its still with a note where 3D cannot start), every link on it
// resolves to a file in the repo, it fits at phone and desktop size, the toys start only near the
// viewport and unload off it, and the one-splat sliders redraw the splat.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PITCH_DEMOS } from "../tools/site-pitch.mjs";

const ORIGIN = `http://127.0.0.1:${Number(process.env.SPLASHERY_PORT) || 4173}`;
const URL_ = `${ORIGIN}/site/about/splashery/`;
const SHOTS = path.resolve("tests/screenshots");

function watchConsole(page) {
  const problems = [];
  page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

test("the page is built, with its own preview card, and stays off the home page", () => {
  const html = fs.readFileSync("site/about/splashery/index.html", "utf8");
  expect(html).toContain("assets/pitch-og.png");
  expect(html).toMatch(/twitter:card" content="summary_large_image/);
  expect(fs.existsSync("site/assets/pitch-og.png")).toBe(true);
  expect(fs.readFileSync("site/index.html", "utf8")).not.toContain("about/splashery/");
  for (const d of PITCH_DEMOS) expect(html).toContain(`data-pit-demo="${d.id}"`);
  // No hype: no exclamation marks in the words, and American English is checked by the tool.
  const words = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
  expect(words).not.toMatch(/!/);
});

test("every link on the page resolves", async ({ page }) => {
  await page.goto(URL_);
  const hrefs = await page.$$eval("main a[href]", (as) => as.map((a) => a.href));
  for (const href of new Set(hrefs)) {
    const u = new URL(href);
    if (u.origin !== ORIGIN) continue;
    let file = path.resolve(decodeURIComponent(u.pathname.slice(1)));
    if (file.endsWith("/") || fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html"); // prettier-ignore
    expect(fs.existsSync(file), `${href} -> ${file}`).toBe(true);
  }
});

for (const [w, h] of [
  [390, 844],
  [1440, 900],
]) {
  test(`every live toy starts, one or two at a time, at ${w}×${h}`, async ({ page }) => {
    test.setTimeout(600_000);
    const problems = watchConsole(page);
    await page.setViewportSize({ width: w, height: h });
    // WebGL2, as the other WebGL2 tests force it (WebGPU on SwiftShader is far slower here).
    await page.goto(`${URL_}?renderer=webgl2`);
    // Nothing below the first screen starts before it is near.
    await expect(page.locator('[data-pit-demo="grape"]')).toHaveAttribute("data-state", /ready|failed/, { timeout: 120_000 }); // prettier-ignore
    await expect(page.locator('[data-pit-demo="qr-code"]')).not.toHaveAttribute("data-state", /./);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w); // prettier-ignore
    await page.screenshot({ path: path.join(SHOTS, `pit-hero-${w}x${h}.png`) });
    for (const d of PITCH_DEMOS) {
      const stage = page.locator(`[data-pit-demo="${d.id}"]`);
      await stage.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await expect(stage).toHaveAttribute("data-state", /ready|failed/, { timeout: 120_000 });
      const running = await page.locator("[data-pit-demo][data-state]").count();
      expect(running).toBeLessThanOrEqual(3);
    }
    // Scrolled to the end, the hero's toy is unloaded.
    await expect(page.locator('[data-pit-demo="grape"]')).not.toHaveAttribute("data-state", /./); // prettier-ignore
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SHOTS, `pit-end-${w}x${h}.png`) });
    expect(problems).toEqual([]);
  });
}

test("without WebGL2 or WebGPU, each toy keeps its still and says why", async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...a) {
      return type === "webgl2" ? null : get.call(this, type, ...a);
    };
    delete Navigator.prototype.gpu;
  });
  await page.goto(URL_);
  for (const d of PITCH_DEMOS) {
    const stage = page.locator(`[data-pit-demo="${d.id}"]`);
    await expect(stage).toHaveAttribute("data-state", "failed");
    await expect(stage.locator(".pit-still")).toBeVisible();
    await expect(stage.locator(".pit-note")).toContainText("still");
  }
});

test("the one-splat sliders redraw the splat", async ({ page }) => {
  await page.goto(URL_);
  const sample = () =>
    page.$eval("[data-pit-one] canvas", (c) => [...c.getContext("2d").getImageData(330, 240, 1, 1).data].join()); // prettier-ignore
  const before = await sample();
  await page.locator('[data-k="sx"]').fill("0.42");
  await page.waitForTimeout(100);
  expect(await sample()).not.toBe(before);
});
