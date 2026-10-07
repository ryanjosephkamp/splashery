// Lane Site r2: the owner's walkthrough fixes for the site (October 6, 2026): the maker's name and
// a Contact page in the footer, links that open the app or another site in a new tab, toy names
// that lead to the toy's page, Science with the toys first, the menu closed after Back, the repo's
// guides as pages, and the quick outline on long pages.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PAGES, DOC_PAGES, SITE } from "../tools/site-pages.mjs";

const SHOTS = path.resolve("tests/screenshots");
const read = (f) => fs.readFileSync(path.resolve("site", f), "utf8");
const allPages = () => PAGES.map((p) => p.path);

function problems(page) {
  const out = [];
  page.on("console", (m) => m.type() === "error" && out.push(m.text()));
  page.on("pageerror", (e) => out.push(e.message));
  return out;
}

test.describe("contact and the footer", () => {
  test("every page's footer says who made it and links to Contact, with no AI line", () => {
    for (const p of allPages()) {
      const html = read(`${p}index.html`);
      const footer = html.slice(html.indexOf('<footer class="site-footer">'));
      expect(footer, p).toMatch(/Made by\s*<a[^>]*href="(\.\.\/)*about\/contact\/"[^>]*>\s*Ryan Kamp\s*<\/a>/); // prettier-ignore
      expect(footer.toLowerCase(), p).not.toMatch(/ai assist|made with ai|built with ai/);
    }
  });

  test("the Contact page lists the owner's links, with no email, all in new tabs", async ({
    page,
  }) => {
    const errs = problems(page);
    await page.goto("/site/about/contact/");
    await expect(page.locator("h1")).toHaveText("Contact");
    const hrefs = await page.locator("main ul.link-list a").evaluateAll((as) => as.map((a) => a.href)); // prettier-ignore
    expect(hrefs).toEqual([
      "https://ryanjosephkamp.github.io/",
      "https://github.com/ryanjosephkamp",
      "https://www.linkedin.com/in/rjk1999",
      "https://x.com/ryanjosephkamp",
      "https://www.youtube.com/@RyanJosephKamp",
      "https://huggingface.co/ryanjosephkamp",
      "https://ryanjosephkamp.github.io/blog/",
    ]);
    expect(await page.locator("main a[href^=mailto]").count()).toBe(0);
    for (const a of await page.locator("main ul.link-list a").all()) {
      await expect(a).toHaveAttribute("target", "_blank");
      await expect(a).toHaveAttribute("rel", /noopener/);
    }
    // The footer's quiet line and the menu's About group both reach it.
    await expect(page.locator(".site-footer .fine a").first()).toHaveText("Ryan Kamp");
    expect(errs).toEqual([]);
  });

  test("the Credits page links to Contact, and About links his name to his site", async ({
    page,
  }) => {
    await page.goto("/site/about/credits/");
    await expect(page.locator('main a[href$="about/contact/"]').first()).toBeVisible();
    await page.goto("/site/about/");
    const name = page.locator("#h-who ~ p a", { hasText: SITE.maker }).first();
    await expect(name).toHaveAttribute("href", SITE.makerSite);
    await expect(name).toHaveAttribute("target", "_blank");
  });
});

test.describe("new tabs and toy pages", () => {
  test("every link to the app or to another site opens in a new tab", () => {
    const bad = [];
    for (const p of allPages()) {
      const html = read(`${p}index.html`);
      const up = "../".repeat(p.split("/").filter(Boolean).length);
      for (const m of html.matchAll(/<a\s([^>]*?)>/g)) {
        const href = /\bhref="([^"]*)"/.exec(m[1])?.[1];
        if (!href || /\bdownload\b/.test(m[1])) continue;
        const rest = href.startsWith(up) ? href.slice(up.length) : href;
        const leaves = /^https?:\/\//.test(href) || /^\.\.\/(?:$|[#?]|worlds\/)/.test(rest);
        if (leaves && !(/target="_blank"/.test(m[1]) && /rel="[^"]*noopener/.test(m[1]))) bad.push(`${p}: ${href.slice(0, 60)}`); // prettier-ignore
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  test("the Tools hub's cards go to the toy's page, and Open in Splashery opens the app in a new tab", async ({
    page,
  }) => {
    await page.goto("/site/tools/?labs=1");
    const cards = page.locator(".tool-card.has-app");
    expect(await cards.count()).toBeGreaterThan(15);
    for (const card of await cards.all()) {
      const main = card.locator("a").first();
      await expect(main).toHaveAttribute("href", /^\.\.\/toys\/[a-z0-9-]+\/$/);
      const app = card.locator("a.tool-app");
      await expect(app).toHaveText("Open in Splashery");
      await expect(app).toHaveAttribute("target", "_blank");
      await expect(app).toHaveAttribute("href", /^\.\.\/#s=/);
    }
    // The card that has no toy page of its own (splat files) still opens the gallery, in a new tab.
    const files = page.locator(".tool-card:not(.has-app) a").first();
    await expect(files).toHaveAttribute("target", "_blank");
  });

  test("the Science table's toy names lead to the toy's page", async ({ page }) => {
    await page.goto("/site/science/");
    const links = page.locator("table.datasets tbody th a");
    expect(await links.count()).toBeGreaterThan(8);
    for (const a of await links.all()) await expect(a).toHaveAttribute("href", /^\.\.\/toys\/[a-z0-9-]+\/$/); // prettier-ignore
    // Each toy page it names is real.
    const first = await links.first().getAttribute("href");
    const res = await page.goto(new URL(first, page.url()).href);
    expect(res.status()).toBe(200);
  });

  test("Science shows the toys first, then the data table and Is it right?", async ({ page }) => {
    await page.goto("/site/science/");
    const order = await page.evaluate(() => {
      const top = (s) => document.querySelector(s)?.getBoundingClientRect().top + scrollY;
      return { shelf: top(".shelf"), data: top("#h-data"), evidence: top("#h-evidence") };
    });
    expect(order.shelf).toBeLessThan(order.data);
    expect(order.data).toBeLessThan(order.evidence);
    // The shelf chips also reach the two sections below, and the toys are on the first screen.
    await expect(page.locator('.shelf-index a[href="#h-data"]')).toHaveCount(1);
    await expect(page.locator('.shelf-index a[href="#h-evidence"]')).toHaveCount(1);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.querySelector(".toy-card").getBoundingClientRect().top)).toBeLessThan(1000); // prettier-ignore
  });
});

test.describe("the menu after Back", () => {
  test("the menu is closed when you come back to a page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/site/");
    const button = page.locator(".menu-button");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.locator("#site-menu >> text=Science").click();
    await expect(page).toHaveURL(/\/site\/science\/$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/site\/$/);
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#site-menu")).not.toHaveClass(/open/);
  });

  test("a page restored from the back/forward cache shows the menu closed", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/site/");
    const button = page.locator(".menu-button");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    // What a restored page does: the browser fires pageshow with persisted set.
    await page.evaluate(() => dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))); // prettier-ignore
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button.locator(".menu-label")).toHaveText("Menu");
    // Leaving the page closes it too, so the saved copy is a closed menu.
    await button.click();
    await page.evaluate(() => dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }))); // prettier-ignore
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("guides as pages", () => {
  const GUIDES = {
    "docs/PACKS.md": "learn/recipes/",
    "docs/SCENE-SCHEMA.md": "learn/scene-format/",
    "docs/evidence/README.md": "learn/evidence/",
  };

  test("each guide has a page built from its Markdown, with a link to its GitHub source", async ({
    page,
  }) => {
    const errs = problems(page);
    for (const [file, p] of Object.entries(GUIDES)) {
      expect(DOC_PAGES[file]).toBe(p);
      const res = await page.goto(`/site/${p}`);
      expect(res.status(), p).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      const src = page.locator("a[data-source]");
      await expect(src).toHaveAttribute("href", `${SITE.github}/blob/main/${file}`);
      await expect(src).toHaveAttribute("target", "_blank");
      // The first heading of the Markdown is on the page.
      const md = fs.readFileSync(file, "utf8");
      const h2 = /^## (.+)$/m.exec(md)[1].replace(/[`*]/g, "");
      await expect(page.locator("main h2", { hasText: h2.slice(0, 20) }).first()).toBeAttached();
    }
    expect(errs).toEqual([]);
  });

  test("the Learn page and the other pages link to the site's guides, not to GitHub's copies", async ({
    page,
  }) => {
    await page.goto("/site/learn/");
    await expect(page.locator('a[href="learn/recipes/"]')).toBeVisible();
    await expect(page.locator('a[href="learn/scene-format/"]')).toBeVisible();
    const bad = [];
    for (const p of allPages()) {
      const html = read(`${p}index.html`);
      for (const m of html.matchAll(
        /href="https:\/\/github\.com\/ryanjosephkamp\/splashery\/blob\/main\/([^"#]+)"/g,
      )) {
        // prettier-ignore
        const before = html.slice(Math.max(0, m.index - 80), m.index);
        if (DOC_PAGES[m[1]] && !/data-source/.test(before + html.slice(m.index, m.index + 200))) bad.push(`${p} -> ${m[1]}`); // prettier-ignore
      }
      expect(html, p).not.toContain("splashery#embedding");
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  test("the lab notebook's lane links lead to pages on the site", async ({ page }) => {
    await page.goto("/site/learn/notebook/");
    const hrefs = await page.locator('main a[href*="learn/notebook/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href"))); // prettier-ignore
    expect(hrefs.length).toBeGreaterThan(20);
    const res = await page.goto(new URL(hrefs[0], page.url()).href);
    expect(res.status()).toBe(200);
    await expect(page.locator('a[href$="learn/notebook/"]').first()).toBeAttached();
  });
});

test.describe("the quick outline", () => {
  const LONG = ["learn/recipes/", "learn/made/", "about/credits/", "learn/notebook/"];

  test("long pages get an outline bar; pages without a long text do not", async ({ page }) => {
    for (const p of LONG) {
      await page.goto(`/site/${p}`);
      await expect(page.locator(".outline .outline-toggle"), p).toHaveCount(1);
    }
    for (const p of ["", "toys/", "about/", "about/contact/"]) {
      await page.goto(`/site/${p}`);
      await expect(page.locator(".outline"), p).toHaveCount(0);
    }
  });

  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    test(`it opens, jumps and closes at ${w}px without covering the text or moving the page`, async ({
      page,
    }) => {
      const errs = problems(page);
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/site/learn/recipes/");
      const toggle = page.locator(".outline-toggle");
      const panel = page.locator("#outline-panel");
      await expect(panel).toBeHidden();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      // Scroll to a spot well down the page, then open the list: the page doesn't move.
      await page.evaluate(() => scrollTo(0, 2600));
      await page.waitForTimeout(200);
      const y = await page.evaluate(() => scrollY);
      await toggle.click();
      await expect(panel).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(await page.evaluate(() => scrollY)).toBe(y);
      // The bar stays on screen under the header while scrolling; the list fits the viewport.
      const box = await panel.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(w);
      expect(box.y + box.height).toBeLessThanOrEqual(h);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0); // prettier-ignore
      // Escape closes it and gives focus back to the bar.
      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
      await expect(toggle).toBeFocused();
      // Picking a section jumps to it, clear of the header and the bar.
      await toggle.click();
      const link = panel.locator("a").nth(8);
      const id = (await link.getAttribute("href")).slice(1);
      await link.click();
      await expect(panel).toBeHidden();
      await page.waitForTimeout(300);
      const gap = await page.evaluate((id) => {
        const bar = document.querySelector(".outline").getBoundingClientRect();
        return document.getElementById(id).getBoundingClientRect().top - bar.bottom;
      }, id);
      expect(gap, "the heading lands below the bar").toBeGreaterThanOrEqual(0);
      await expect(toggle.locator("xpath=following-sibling::*")).toBeHidden();
      await expect(page.locator(".outline-now")).toHaveText(await link.evaluate((a) => a.textContent)); // prettier-ignore
      expect(errs).toEqual([]);
    });
  }

  test("a tap outside closes the list, and the outline works from the keyboard", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/site/learn/made/");
    const toggle = page.locator(".outline-toggle");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#outline-panel")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.locator("#outline-panel a").first()).toBeFocused();
    await page.mouse.click(10, 600);
    await expect(page.locator("#outline-panel")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Jump to a section" })).toBeHidden();
  });

  test("the Tinkerer's Manual has the same outline, and one link back at the bottom", async ({
    page,
  }) => {
    const errs = problems(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/manual/");
    await expect(page.locator(".outline-toggle")).toHaveCount(1);
    await page.locator(".outline-toggle").click();
    await page.locator("#outline-panel a", { hasText: "Glossary" }).click();
    await page.waitForTimeout(300);
    const gap = await page.evaluate(() => document.getElementById("glossary").getBoundingClientRect().top - document.querySelector(".outline").getBoundingClientRect().bottom); // prettier-ignore
    expect(gap).toBeGreaterThanOrEqual(0);
    // The two links at the very bottom are one; the open-in-the-toy links open a new tab.
    const foot = page.locator("main > footer");
    await expect(foot.locator("a")).toHaveCount(1);
    await expect(foot.locator("a")).toHaveAttribute(
      "href",
      "https://ryanjosephkamp.github.io/splashery/",
    );
    const toyLinks = page.locator('a[href*="splashery/#s="]');
    expect(await toyLinks.count()).toBeGreaterThan(5);
    for (const a of await toyLinks.all()) await expect(a).toHaveAttribute("target", "_blank");
    expect(errs).toEqual([]);
  });

  test("the outline is left out of print", async ({ page }) => {
    await page.goto("/site/learn/recipes/");
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".outline")).toBeHidden();
  });
});

test.describe("screenshots", () => {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    test(`pages at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      for (const [p, name] of [
        ["about/contact/", "contact"],
        ["science/", "science"],
        ["learn/recipes/", "recipes"],
      ]) {
        // prettier-ignore
        await page.goto(`/site/${p}`);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(SHOTS, `st2-${name}-${w}x${h}.png`) });
      }
      await page.goto("/site/tools/");
      await page.waitForTimeout(400);
      await page.locator(".tool-card").first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(SHOTS, `st2-tools-${w}x${h}.png`) });
    });
  }
});
