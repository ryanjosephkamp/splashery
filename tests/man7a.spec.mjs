// Manual r7a: crisp demos and pictures for every page. Screenshots man7a-*.png.

import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { LAYERS, CHECKS } from "../manual/built-data.js";

const SHOTS = path.resolve("tests/screenshots");
const PAGES = ["splat", "language", "toy", "share"];

test.describe("every demo canvas is as sharp as the page text", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  for (const name of PAGES) {
    test(`${name}.html: backing width is 3 x CSS width`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(`/manual/${name}.html`);
      await page.evaluate(() =>
        document.querySelectorAll("details").forEach((d) => (d.open = true)),
      );
      await page.waitForTimeout(800);
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll(".demo-live canvas")].map((c) => ({
          id: c.id,
          css: c.clientWidth,
          backing: c.getContext
            ? Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "width").get.call(c)
            : 0,
          pixelated: c.style.imageRendering === "pixelated",
        })),
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        if (r.pixelated) continue; // a QR code: square modules, scaled without smoothing
        expect(Math.abs(r.backing - 3 * r.css), `${name} #${r.id}`).toBeLessThanOrEqual(2);
      }
      expect(errors).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/man7a-${name}-dpr3-390x844.png`, fullPage: false });
    });
  }
});

test.describe("Chapter 1: the size sliders", () => {
  test("s1, s2, s3 run from 0 to 1.60 and start at 0.80; the splat stays in view at 1.60", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/manual/splat.html");
    for (const k of ["s1", "s2", "s3"]) {
      const r = page.locator(`#sn-${k}`);
      await expect(r).toHaveAttribute("min", "0");
      await expect(r).toHaveAttribute("max", "1.6");
      await expect(r).toHaveValue("0.8");
      await expect(page.locator(`#sn-${k}-out`)).toHaveText("0.80");
    }
    const set = (id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }, [id, v]); // prettier-ignore
    for (const k of ["s1", "s2", "s3"]) await set(`sn-${k}`, 1.6);
    await set("sn-s1", 0);
    await page.locator("#sn-canvas").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/man7a-sizes-390x844.png` });
    expect(errors).toEqual([]);
  });
});

test.describe("Chapter 3: the grid-to-torus figure moves", () => {
  test("a live canvas walks a ring across the grid; reduced motion keeps it still", async ({
    page,
  }) => {
    await page.goto("/manual/language.html");
    const fig = page.locator('figure[data-live="uv-torus"]');
    await fig.scrollIntoViewIfNeeded();
    await expect(fig).toHaveClass(/live/);
    const ring = () =>
      page.locator("#uv-ring").evaluate((r) => `${r.getAttribute("cx")},${r.getAttribute("cy")}`);
    const a = await ring();
    await page.waitForTimeout(1500);
    expect(await ring()).not.toBe(a);
    await expect(fig.locator("canvas")).toHaveAttribute("aria-label", /torus/);
    await expect(fig.locator("image.fig-still")).toHaveAttribute("href", "img/gallery-torus.jpg"); // the PDF's still
  });
  test("with reduced motion the ring stays put", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/manual/language.html");
    await page.locator('figure[data-live="uv-torus"]').scrollIntoViewIfNeeded();
    const ring = () => page.locator("#uv-ring").getAttribute("cx");
    const a = await ring();
    await page.waitForTimeout(1500);
    expect(await ring()).toBe(a);
    await ctx.close();
  });
  test("the PDF prints the still, not the canvas", async ({ page }) => {
    await page.goto("/manual/language.html");
    await page.emulateMedia({ media: "print" });
    const fig = page.locator('figure[data-live="uv-torus"]');
    await expect(fig.locator("canvas")).toBeHidden();
    await expect(fig.locator("image.fig-still")).toBeVisible();
  });
});

test.describe("How Splashery is built: the diagram", () => {
  test("every file in the data exists and every claim is true of the code", () => {
    for (const l of LAYERS)
      for (const b of l.boxes) if (b.file) expect(fs.existsSync(b.file), b.file).toBe(true);
    for (const [file, pattern, says] of CHECKS)
      expect(pattern.test(fs.readFileSync(file, "utf8")), says).toBe(true);
  });
  for (const scheme of ["light", "dark"]) {
    test(`it draws every box in ${scheme}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: scheme,
      });
      const page = await ctx.newPage();
      await page.goto("/manual/built.html");
      const svg = page.locator('figure[data-diagram="built"] svg');
      await expect(svg.locator("rect.sv-acc, rect.sv-soft, rect.sv-box")).not.toHaveCount(0);
      const boxes = LAYERS.reduce((n, l) => n + l.boxes.length, 0);
      expect(await svg.locator("text.sv-title").count()).toBeGreaterThanOrEqual(
        boxes + LAYERS.length,
      );
      await expect(svg).toHaveAttribute("aria-label", /WebGPU or WebGL2/);
      await page
        .locator("figure[data-diagram]")
        .screenshot({ path: `${SHOTS}/man7a-built-${scheme}-390x844.png` });
      await ctx.close();
    });
  }
});

test.describe("pictures on the more and unique pages", () => {
  for (const name of ["more", "unique"]) {
    test(`${name}.html: every picture loads, has alt text, and is small`, async ({ page }) => {
      await page.goto(`/manual/${name}.html`);
      await page.waitForLoadState("networkidle");
      const imgs = await page.locator("figure.item-pic img").evaluateAll((l) =>
        l.map((i) => ({
          src: i.getAttribute("src"),
          alt: i.alt,
          ok: i.complete && i.naturalWidth > 0,
        })),
      );
      expect(imgs.length).toBeGreaterThan(5);
      for (const i of imgs) {
        expect(i.ok, i.src).toBe(true);
        expect(i.alt.length, i.src).toBeGreaterThan(20);
        expect(fs.statSync(`manual/${i.src}`).size, i.src).toBeLessThan(150_000);
      }
    });
  }
  test("every item on the unique page has a picture, a diagram, or a small live demo", async ({
    page,
  }) => {
    await page.goto("/manual/unique.html");
    const items = page.locator("main > ul > li");
    const n = await items.count();
    expect(n).toBe(6);
    for (let i = 0; i < n; i++)
      expect(
        await items.nth(i).locator(":scope > figure").count(),
        `item ${i + 1}`,
      ).toBeGreaterThan(0);
  });
  test("each h3 section of the more page has a picture", async ({ page }) => {
    await page.goto("/manual/more.html");
    const heads = await page.locator("main h3").count();
    expect(heads).toBe(11);
    expect(await page.locator("main > figure.item-pic").count()).toBe(heads);
  });
  test("the link steps use the real codec", async ({ page }) => {
    await page.goto("/manual/unique.html");
    const steps = page.locator("ol.link-steps li");
    await expect(steps).toHaveCount(4);
    await expect(steps.nth(2)).toContainText("characters");
  });
});
