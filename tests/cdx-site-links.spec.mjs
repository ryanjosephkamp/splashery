import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { mdToHtml } from "../tools/site-md.mjs";
import { PAGES } from "../tools/site-pages.mjs";

const pencil = "https://commons.wikimedia.org/wiki/File:Kleiner_Bleistift_(40045317711).jpg";
const staircase =
  "https://commons.wikimedia.org/wiki/File:Spiral_Staircase,_Keck_Center_(U.S._National_Academies).jpg";

for (const destination of [pencil, staircase, "https://example.com/a_(b)/c_(d)?x=1&y=2"]) {
  for (const brackets of [false, true]) {
    test(`Markdown preserves ${brackets ? "angle-bracket" : "bare"} destination ${destination}`, async ({
      page,
    }) => {
      const markdown = `[Source](${brackets ? `<${destination}>` : destination})`;
      const { html } = mdToHtml(markdown, {
        github: "https://github.com/ryanjosephkamp/splashery",
      });
      await page.setContent(html);
      await expect(page.getByRole("link", { name: "Source", exact: true })).toHaveAttribute(
        "href",
        destination,
        { timeout: 2000 },
      );
      expect(html).not.toMatch(/&(?:amp;)?lt;/);
    });
  }
}

for (const p of PAGES.filter((p) => p.type === "markdown")) {
  test(`built Markdown page ${p.path} has valid link destinations`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`/site/${p.path}`);
    await expect(page).toHaveTitle(/Splashery/);
    await expect(page.locator("h1")).toHaveCount(1);
    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href, p.path).not.toMatch(/&(?:amp;)?lt;|[<>]|%3[ce]/i);
      const url = new URL(href, page.url());
      if (/^https?:\/\//.test(href)) {
        expect(url.hostname, href).toBeTruthy();
      } else if (!href.startsWith("#")) {
        expect(url.origin, href).toBe(new URL(page.url()).origin);
        const file = path.resolve(`.${decodeURIComponent(url.pathname)}`);
        const target =
          fs.existsSync(file) && fs.statSync(file).isDirectory()
            ? path.join(file, "index.html")
            : file;
        expect(fs.existsSync(target), `${href} on ${p.path}`).toBe(true);
      }
    }
    if (p.path === "about/credits/") {
      await expect(
        page.getByRole("link", { name: "Kleiner Bleistift", exact: true }),
      ).toHaveAttribute("href", pencil);
      await expect(page.locator(`a[href='${staircase}']`)).toHaveText("Commons");
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize(viewport);
        await page.screenshot({
          path: `tests/screenshots/cdx-controls-credits-${viewport.width}x${viewport.height}.png`,
        });
      }
    }
    expect(errors).toEqual([]);
  });
}
