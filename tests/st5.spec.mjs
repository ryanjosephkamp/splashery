// Lane Site r5: every card on What's new opens its toy. A feature card and a before-and-after card
// are each one link (the heading's, stretched over the card) that opens the toy in the Playground
// in a new tab; the new-toy tiles keep opening the toy's page.

import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TOYS } from "../src/toys.js";
import { startPages } from "./st4-server.mjs";

const REPO = path.resolve(".");
const STAGED = path.join(REPO, ".cache/front-door");
const NEWS = JSON.parse(fs.readFileSync(path.join(REPO, "tools/site-news.json"), "utf8"));
const CARDS = ".news-feature, .news-fix";

// A real tap at the middle of an element: the card's link covers its text, so a locator click
// (which refuses to click through an overlay) would not be what a visitor does.
const tapOn = async (page, loc) => {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
};

const toyOf = (href) => {
  const hash = href.split("#s=")[1];
  const scene = JSON.parse(Buffer.from(hash.slice(2), "base64url").toString());
  return scene.toy.id;
};

test.describe("What's new cards open their toy", () => {
  test("every entry in site-news.json names a toy that exists, with a picture", () => {
    const ids = new Set(TOYS.map((t) => t.id));
    for (const e of [...NEWS.features, ...NEWS.fixes]) {
      expect(ids.has(e.toy), `${e.title}: "${e.toy}"`).toBe(true);
      expect(fs.existsSync(path.join(REPO, `assets/toys/${e.toy}/thumb.webp`)), e.toy).toBe(true);
    }
    for (const e of NEWS.features) expect(e.toy, `${e.title} has no toy`).toBeTruthy();
  });

  test("the build fails when an entry names a toy that doesn't exist", () => {
    const file = path.join(REPO, "tools/site-news.json");
    const original = fs.readFileSync(file, "utf8");
    try {
      const bad = JSON.parse(original);
      bad.features[0].toy = "no-such-toy-xyz";
      fs.writeFileSync(file, JSON.stringify(bad));
      let message = "";
      try {
        execFileSync("node", ["tools/site-build.mjs", "--check"], { cwd: REPO, stdio: "pipe" });
      } catch (e) {
        message = String(e.stderr);
      }
      expect(message).toContain('names the toy "no-such-toy-xyz", which doesn\'t exist');
    } finally {
      fs.writeFileSync(file, original);
    }
  });

  test("the built page: one link per card, to that card's toy, in a new tab, with a clear name", () => {
    const html = fs.readFileSync(path.join(REPO, "site/new/index.html"), "utf8");
    const cards = html
      .split(/<li class="news-(?:feature|fix)\b/)
      .slice(1)
      .map((c) => c.split("</section>")[0].replace(/\s+/g, " "));
    expect(cards.length).toBe(NEWS.features.length + NEWS.fixes.length);
    for (const c of cards) {
      const links = c.match(/<a\b[^>]*>/g) || [];
      expect(links, "one link per card").toHaveLength(1);
      expect(links[0]).toContain('target="_blank"');
      expect(links[0]).toContain('rel="noopener"');
      expect(links[0]).toMatch(/href="\.\.\/\.\.\/#s=j\./);
      expect(c).toMatch(/: opens the [^<]+ in the Playground, in a new tab\s*</);
    }
  });

  test("on the live layout each card is one link; it opens the toy in a new tab; the toy tiles still open the toy's page", async ({
    page,
    context,
  }) => {
    const pages = await startPages(REPO);
    try {
      await page.addInitScript(() => localStorage.setItem("splashery.labs", "1"));
      await page.goto(`${pages.origin}/site/new/`);
      const cards = page.locator(CARDS);
      expect(await cards.count()).toBe(NEWS.features.length + NEWS.fixes.length);
      for (let i = 0; i < (await cards.count()); i++) {
        const card = cards.nth(i);
        await expect(card.locator("a")).toHaveCount(1);
        const link = card.getByRole("link");
        const name = await link.textContent();
        expect(name).toMatch(/opens the .+ in the Playground, in a new tab/);
        expect(await link.getAttribute("target")).toBe("_blank");
        const id = toyOf(await link.getAttribute("href"));
        expect(TOYS.some((t) => t.id === id)).toBe(true);
      }
      // Tapping anywhere on a card (here its text) opens the toy in a new tab.
      const fix = page.locator(".news-fix").first();
      const [popup] = await Promise.all([context.waitForEvent("page"), tapOn(page, fix.locator("p").last())]); // prettier-ignore
      expect(new URL(popup.url()).pathname).toBe("/");
      expect(toyOf(popup.url())).toBe(NEWS.fixes.slice().sort((a, b) => b.date.localeCompare(a.date))[0].toy); // prettier-ignore
      await popup.close();
      expect(page.url()).toContain("/site/new/");
      // The new-toy tiles keep opening the toy's own page, in the same tab.
      const tile = page.locator(".news-toy a").first();
      expect(await tile.getAttribute("href")).toMatch(/^\.\.\/toys\//);
      // A visible focus ring on the keyboard.
      await page.locator(".news-toy a").last().focus();
      await page.keyboard.press("Tab");
      const first = page.locator(".news-feature .news-link").first();
      await expect(first).toBeFocused();
      const ring = await first.evaluate((el) => getComputedStyle(el, "::after").outlineStyle);
      expect(ring).toBe("solid");
    } finally {
      await pages.close();
    }
  });

  test("in the staged front door the cards open the Playground at playground/", async ({
    page,
    context,
  }) => {
    // prettier-ignore
    execFileSync("node", ["tools/site-build.mjs", "--front-door"], { cwd: REPO, stdio: "pipe" });
    const pages = await startPages(STAGED);
    try {
      await page.addInitScript(() => localStorage.setItem("splashery.labs", "1"));
      await page.goto(`${pages.origin}/new/`);
      const links = page.locator(".news-feature a, .news-fix a");
      const n = await links.count();
      expect(n).toBe(NEWS.features.length + NEWS.fixes.length);
      for (let i = 0; i < n; i++) {
        const href = await links.nth(i).getAttribute("href");
        expect(href, href).toMatch(/^\.\.\/playground\/#s=j\./);
        expect(TOYS.some((t) => t.id === toyOf(href))).toBe(true);
      }
      const [popup] = await Promise.all([context.waitForEvent("page"), tapOn(page, page.locator(".news-feature").first().locator("li").first())]); // prettier-ignore
      await popup.waitForLoadState("domcontentloaded");
      expect(new URL(popup.url()).pathname).toBe("/playground/");
      expect(popup.url()).toContain("#s=j.");
      await expect(popup.locator("#canvas, canvas").first()).toBeAttached();
      await popup.close();
    } finally {
      await pages.close();
    }
  });
});
