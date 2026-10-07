// Lane Toy pages r2: sound on a toy page (the embedded toy plays its tap sound, with a mute
// button), "Open in Splashery" in a new tab, a "Learn more" link per toy (tools/toy-links.json)
// and the catalog PDF's second round (table of contents, bookmarks, every toy's page). Every
// page's HTML is checked in Node; a few pages and the catalog's picture are checked in the browser.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { TOYS } from "../src/toys.js";
import { TOY_LINKS, readEvidence } from "../tools/site-toy-pages.mjs";

const SITE = path.resolve("site");
const SHOTS = path.resolve("tests/screenshots");
const read = (f) => fs.readFileSync(path.join(SITE, f), "utf8").replace(/\s+/g, " ");
const publicToys = TOYS.filter((t) => t.category && !t.labs);

test.describe("toy pages round 2 (static)", () => {
  test("toy-links.json: public toys only, https, a label, and no brand names", () => {
    const ids = new Set(publicToys.map((t) => t.id));
    expect(Object.keys(TOY_LINKS).length).toBeGreaterThan(250);
    for (const [id, l] of Object.entries(TOY_LINKS)) {
      expect(ids.has(id), `${id} is a public toy`).toBe(true);
      expect(l.url, id).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\/[^\s]+$/);
      expect(l.label.trim().length, id).toBeGreaterThan(3);
      expect(l.label, id).not.toMatch(/frisbee|lego|rubik|slinky/i);
    }
  });

  test("every page shows its Learn more link in a new tab, or none", () => {
    const problems = [];
    for (const t of publicToys) {
      const html = read(`toys/${t.id}/index.html`);
      const m = /<p class="learn-more"> ?Learn more: <a href="([^"]*)" target="_blank" rel="noopener" ?>([^<]*)<\/a ?> ?<\/p>/.exec(html); // prettier-ignore
      // A toy with an evidence file cites its sources on its page, so it has no Learn more.
      const link = readEvidence(t.id) ? null : TOY_LINKS[t.id];
      if (link && !m) problems.push(`${t.id}: link missing`);
      if (!link && html.includes("learn-more")) problems.push(`${t.id}: a link nobody listed`);
      if (link && m && !m[1].includes(link.url.replace("https://en.wikipedia.org/wiki/", ""))) problems.push(`${t.id}: wrong link`); // prettier-ignore
    }
    expect(problems).toEqual([]);
  });

  test("every page plays with sound and opens the app in a new tab", () => {
    const problems = [];
    for (const t of TOYS.filter((x) => x.category)) {
      const html = read(`toys/${t.id}/index.html`);
      if (!new RegExp(`play/\\?toy=${t.id}[^"]*&amp;sound=on|play/\\?toy=${t.id}[^"]*&sound=on`).test(html)) problems.push(`${t.id}: no sound=on`); // prettier-ignore
      if (!/<a class="button primary" href="[^"]*" target="_blank" rel="noopener" ?>Open in the gallery/.test(html)) problems.push(`${t.id}: gallery link stays in the tab`); // prettier-ignore
      // The snippets people copy stay silent, as before.
      const snippet = /id="snip-iframe"[^>]*>([^<]*)</.exec(html)?.[1] || "";
      if (/sound=on/.test(snippet)) problems.push(`${t.id}: the embed snippet is not silent`);
    }
    expect(problems).toEqual([]);
  });

  test("the catalog: contents with links, bookmarks, one page per toy, a sensible size", () => {
    const pdf = fs.readFileSync(path.join(SITE, "splashery-catalog.pdf"));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const text = pdf.toString("latin1");
    const pages = text.match(/\/Type\s*\/Page(?![a-z])/g).length;
    // A cover, the contents (a few pages), then every public toy on its own page.
    expect(pages).toBeGreaterThanOrEqual(publicToys.length + 3);
    expect(pages).toBeLessThanOrEqual(publicToys.length + 6);
    expect(text).toMatch(/\/Outlines/);
    // A bookmark for the cover, the contents, each shelf and every toy.
    expect((text.match(/\/Title\s*[(<]/g) || []).length).toBeGreaterThanOrEqual(publicToys.length + 2); // prettier-ignore
    // The contents' links, and each page's own link (and Learn more).
    expect((text.match(/\/Subtype\s*\/Link/g) || []).length).toBeGreaterThanOrEqual(publicToys.length * 2); // prettier-ignore
    expect(pdf.length).toBeLessThan(20e6);
  });
});

test.describe("toy pages round 2 (browser)", () => {
  test("the toy on its page plays its sound, mutes, and the app link opens a new tab", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light" }); // prettier-ignore
    const page = await ctx.newPage();
    await page.goto("/site/toys/cactus/?labs=0");
    const frame = page.frameLocator(".toy-stage iframe");
    await frame.locator("body[data-ready='true']").waitFor({ timeout: 180_000 });
    await expect(page.locator(".toy-stage .stage")).toHaveClass(/ready/);
    // The player's own "Open in Splashery" link opens in a new tab.
    await expect(frame.locator("#open-link")).toHaveAttribute("target", "_blank");
    await expect(frame.locator("#open-link")).toHaveAttribute("rel", /noopener/);
    // The mute button is there, and a tap on the cactus sounds.
    const mute = frame.locator("#sound-toggle");
    await expect(mute).toBeVisible();
    await page.waitForTimeout(1500);
    const box = await page.locator(".toy-stage iframe").boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const player = page.frames().find((f) => f.url().includes("/play/"));
    await expect.poll(() => player.evaluate(() => window.__splashery.viewer.sound.scheduled), { timeout: 60_000 }).toBeGreaterThan(0); // prettier-ignore
    await mute.click();
    await expect(mute).toHaveAttribute("aria-pressed", "false");
    // The Learn more link and the gallery link each open a new tab.
    const learn = page.locator("a", { hasText: "Cactus on Wikipedia" });
    await expect(learn).toHaveAttribute("target", "_blank");
    const [tab] = await Promise.all([ctx.waitForEvent("page"), page.getByRole("link", { name: "Open in the gallery" }).click()]); // prettier-ignore
    expect(tab.url()).toContain("#s=j.");
    await tab.close();
    await ctx.close();
  });

  test("screenshots: two toy pages at both sizes", async ({ browser }) => {
    for (const id of ["cactus", "grape"]) {
      for (const [w, h] of [
        [390, 844],
        [1440, 900],
      ]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: "light" }); // prettier-ignore
        const page = await ctx.newPage();
        await page.goto(`/site/toys/${id}/?labs=0`);
        await page.frameLocator(".toy-stage iframe").locator("body[data-ready='true']").waitFor({ timeout: 180_000 }); // prettier-ignore
        await expect(page.locator(".toy-stage .stage")).toHaveClass(/ready/);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(SHOTS, `tp2-${id}-${w}x${h}.png`) });
        // The part of the page with the new Learn more link, below the fold on a phone.
        if (w === 390 && id === "cactus") {
          await page.locator("#h-about").scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(SHOTS, "tp2-cactus-about-390x844.png") });
        }
        await ctx.close();
      }
    }
  });
});
