// Lane Site r3: What's new as a visual gallery, the app's Gallery renamed Playground, a date for
// every toy with a Newest first view, and a description tag on every page of the site.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { TOYS } from "../src/toys.js";

const SITE = path.resolve("site");
const read = (f) => fs.readFileSync(path.join(SITE, f), "utf8");
const pages = () => {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
      else if (e.name.endsWith(".html")) out.push(path.relative(SITE, path.join(dir, e.name)));
    }
  };
  walk(SITE);
  return out;
};
const unescape = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); // prettier-ignore
const meta = (html, attr, key) => {
  const m = new RegExp(`<meta\\s+${attr}="${key}"\\s+content=(?:"([^"]*)"|'([^']*)')`).exec(html);
  return m ? unescape(m[1] ?? m[2]) : null;
};

test.describe("description tags", () => {
  test("every page has a description and a matching og:description, none empty, long or shared", () => {
    const seen = new Map();
    const problems = [];
    for (const f of pages()) {
      const html = read(f);
      const d = meta(html, "name", "description");
      const og = meta(html, "property", "og:description");
      if (!d || d.trim().length < 20) problems.push(`${f}: no usable description (${d})`);
      else {
        if (d.length > 160) problems.push(`${f}: ${d.length} characters`);
        if (og !== d) problems.push(`${f}: og:description differs`);
        if (seen.has(d)) problems.push(`${f}: same description as ${seen.get(d)}`);
        seen.set(d, f);
      }
    }
    expect(problems).toEqual([]);
  });

  test("a toy page's description is its About line", () => {
    const html = read("toys/fireworks/index.html");
    expect(meta(html, "name", "description")).toMatch(/^[A-Z]/);
    expect(meta(html, "name", "description")).not.toMatch(/a Splashery toy made of/);
  });
});

test.describe("toy dates", () => {
  test("every toy has a date in tools/toy-dates.json, and its page shows it", () => {
    const dates = JSON.parse(fs.readFileSync("tools/toy-dates.json", "utf8"));
    const missing = TOYS.filter((t) => !/^\d{4}-\d\d-\d\d$/.test(dates[t.id] || "")).map((t) => t.id); // prettier-ignore
    expect(missing).toEqual([]);
    for (const id of ["fireworks", "strawberry", "five-cell"]) {
      expect(read(`toys/${id}/index.html`)).toMatch(/<dt>\s*Arrived\s*<\/dt>\s*<dd>\s*<time datetime="\d{4}-\d\d-\d\d">/); // prettier-ignore
    }
  });

  test("the toy lists switch to Newest first, newest day on top, and back to By shelf", async ({ page }) => {
    await page.goto("/site/toys/");
    const bar = page.locator(".order-bar");
    await expect(bar).toBeVisible();
    await expect(page.locator(".by-shelf")).toBeVisible();
    await expect(page.locator(".by-date")).toBeHidden();
    await page.getByRole("button", { name: "Newest first" }).click();
    await expect(page.locator(".by-date")).toBeVisible();
    await expect(page.locator(".by-shelf")).toBeHidden();
    const days = await page.locator(".by-date .day:not([data-labs]) time").evaluateAll((els) => els.map((e) => e.getAttribute("datetime"))); // prettier-ignore
    expect(days.length).toBeGreaterThan(3);
    expect(days).toEqual([...days].sort().reverse());
    await page.getByRole("button", { name: "By shelf" }).click();
    await expect(page.locator(".by-shelf")).toBeVisible();
  });
});

test.describe("what's new", () => {
  test("is a gallery of toys, features and before-and-after fixes, with nothing operational", () => {
    const html = read("new/index.html");
    expect(html).toContain('id="h-new-toys"');
    expect(html).toContain('id="h-new-features"');
    expect(html).toContain('id="h-fixed"');
    expect(html).toMatch(/<figcaption>\s*Before\s*<\/figcaption>/);
    expect(html).toMatch(/<figcaption>\s*After\s*<\/figcaption>/);
    const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/\bPR #|pull request|\blane\b|\bOpus\b|\bSonnet\b|\bmerged\b/i);
    // Newest first in each part.
    for (const re of [/<li class="news-toy"[^>]*>[\s\S]*?datetime="([\d-]+)"/g, /<li class="news-feature">[\s\S]*?datetime="([\d-]+)"/g, /<li class="news-fix"[^>]*>[\s\S]*?datetime="([\d-]+)"/g]) { // prettier-ignore
      const dates = [...html.matchAll(re)].map((m) => m[1]);
      expect(dates.length).toBeGreaterThan(1);
      expect(dates).toEqual([...dates].sort().reverse());
    }
    for (const m of html.matchAll(/src="\.\.\/assets\/news\/([^"]+)"/g)) {
      expect(fs.existsSync(path.join(SITE, "assets/news", m[1])), m[1]).toBe(true);
    }
  });

  test("reads well on a phone and a computer, with no sideways scrolling", async ({ page }) => {
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/site/new/");
      await page.evaluate(() => localStorage.setItem("splashery-labs", "1"));
      await page.reload();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); // prettier-ignore
      await page.screenshot({ path: path.resolve(`tests/screenshots/st3-whats-new-${w}x${h}.png`) });
    }
  });
});

test.describe("Playground", () => {
  test("the app's button is the Playground; its id and key are unchanged", () => {
    const html = fs.readFileSync("index.html", "utf8");
    expect(html).toMatch(/id="gallery-open"[\s\S]*?aria-label="Playground"/);
    expect(html).toMatch(/title="Playground: every toy on one page \(G\)"/);
    expect(html).not.toMatch(/aria-label="Gallery"/);
  });

  test("the site says Playground where it used to say gallery", () => {
    for (const f of ["index.html", "toys/index.html", "toys/fireworks/index.html", "tools/index.html"]) {
      const text = read(f).replace(/<[^>]+>/g, " ");
      expect(text, f).not.toMatch(/\bthe gallery\b/i);
    }
    expect(read("toys/fireworks/index.html")).toContain("Open in the Playground");
  });
});
