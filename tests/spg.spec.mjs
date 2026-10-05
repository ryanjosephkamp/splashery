// Lane Site pages: the hubs, About, credits, privacy, What's new and the embed
// guide under site/. Each page loads, its menu item lights, the credits page lists
// every entry in CREDITS.md, the tools and science hubs link to real toys, and the
// embed guide's live example builds its snippets.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PAGES, MENU } from "../tools/site-pages.mjs";
import { mdPlain } from "../tools/site-md.mjs";

const SHOTS = path.resolve("tests/screenshots");
const SPG = PAGES.filter((p) =>
  [
    "tools/", "share/", "science/", "learn/", "learn/splats/", "learn/made/", "learn/notebook/",
    "new/", "about/", "about/credits/", "about/terms/", "about/privacy/",
  ].includes(p.path),
); // prettier-ignore

function problems(page) {
  const out = [];
  page.on("console", (m) => m.type() === "error" && out.push(m.text()));
  page.on("pageerror", (e) => out.push(e.message));
  return out;
}

test.describe("site pages", () => {
  test("each page loads, lights its menu item and has no horizontal scroll", async ({ page }) => {
    const errs = problems(page);
    for (const p of SPG) {
      const res = await page.goto(`/site/${p.path}`);
      expect(res.status(), p.path).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator('.site-header nav a[aria-current="page"]')).toHaveText(
        MENU.find((m) => m.id === p.nav).label,
      );
      for (const w of [390, 1440]) {
        await page.setViewportSize({ width: w, height: 900 });
        const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(over, `${p.path} at ${w}`).toBeLessThanOrEqual(0);
      }
    }
    expect(errs).toEqual([]);
  });

  test("the credits page lists every entry in CREDITS.md and every library in LICENSES.md", async ({
    page,
  }) => {
    await page.goto("/site/about/credits/");
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    const rows = [];
    for (const f of ["CREDITS.md", "LICENSES.md"]) {
      for (const line of fs.readFileSync(f, "utf8").split("\n")) {
        if (/^\|\s*[-:]/.test(line) || !/^\|/.test(line)) continue;
        const first = line.split("|")[1]?.trim();
        if (first && !/^(Toy|Entry|Used as|Sound|Name)$/i.test(first)) rows.push(mdPlain(first));
      }
      for (const m of fs.readFileSync(f, "utf8").matchAll(/^#{2,3}\s+(.+)$/gm))
        rows.push(mdPlain(m[1]));
    }
    expect(rows.length).toBeGreaterThan(100);
    const missing = rows.filter((r) => !text.includes(r.replace(/\s+/g, " ")));
    expect(missing).toEqual([]);
  });

  test("the tools hub groups its tools and every link opens a toy", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("splashery.labs", "1"));
    await page.goto("/site/tools/");
    for (const id of ["make", "files", "scan", "qr", "sound"]) {
      await expect(page.locator(`#h-${id}`)).toBeVisible();
    }
    const cards = page.locator(".tool-card a");
    expect(await cards.count()).toBeGreaterThan(25);
    const hrefs = await cards.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    for (const h of hrefs) expect(h).toMatch(/^\.\.\/(#s=j\.[\w-]+)?$/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${SHOTS}/spg-tools-390x844.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: `${SHOTS}/spg-tools-1440x900.png` });
  });

  test("the science hub lists each dataset with its source and license", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("splashery.labs", "1"));
    await page.goto("/site/science/");
    const rows = page.locator("table.datasets tbody tr");
    expect(await rows.count()).toBeGreaterThanOrEqual(8);
    for (const r of await rows.all()) {
      expect((await r.locator("td").nth(2).innerText()).length).toBeGreaterThan(3); // source
      expect((await r.locator("td").nth(3).innerText()).length).toBeGreaterThan(3); // license
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${SHOTS}/spg-science-390x844.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: `${SHOTS}/spg-science-1440x900.png` });
  });

  test("the learn hub, the explainer and the notebook", async ({ page }) => {
    await page.goto("/site/learn/");
    await expect(page.getByRole("link", { name: /Tinkerer's Manual/ }).first()).toBeVisible();
    for (const href of ["learn/splats/", "learn/notebook/", "learn/made/"]) {
      await expect(page.locator(`.learn-cards a[href$="${href}"]`)).toHaveCount(1);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${SHOTS}/spg-learn-390x844.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: `${SHOTS}/spg-learn-1440x900.png` });
    await page.goto("/site/learn/splats/");
    expect(await page.locator("figure.figure svg").count()).toBe(3);
    await page.goto("/site/learn/notebook/");
    expect(await page.locator("table tbody tr").count()).toBeGreaterThan(20);
  });

  test("About, terms and privacy say what they must", async ({ page }) => {
    await page.goto("/site/about/privacy/");
    const priv = await page.locator("main").innerText();
    expect(priv).toMatch(/Nothing you open leaves your device/);
    expect(priv).toMatch(/no tracking/i);
    expect(priv).toMatch(/earthquake/i);
    expect(priv).toMatch(/Protein Data Bank/);
    await page.goto("/site/about/terms/");
    const gallery = fs.readFileSync("index.html", "utf8");
    expect(gallery).toContain("You are responsible for what you open");
    await expect(page.locator("main")).toContainText("You are responsible for what you open");
    await page.goto("/site/about/");
    await expect(
      page.locator('main a[href$="about/credits/"], main a[href$="credits/"]').first(),
    ).toBeVisible();
  });

  test("What's new has a plain summary per day above the list of changes", async ({ page }) => {
    const news = JSON.parse(fs.readFileSync("tools/site-news.json", "utf8")).days;
    await page.goto("/site/new/");
    expect(await page.locator(".news-day .news-title").count()).toBeGreaterThanOrEqual(news.length);
    await expect(page.locator(".pr-list").first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/Phase [A-Z]/);
  });

  test("the embed guide builds the snippets and shows a live toy", async ({ page }) => {
    await page.goto("/site/share/");
    await expect(page.locator("#snip-iframe")).toContainText("embed/?toy=strawberry");
    await page.selectOption("#embed-form [name=theme]", "dark");
    await page.selectOption("#embed-form [name=autoplay]", "breeze");
    await expect(page.locator("#snip-iframe")).toContainText("theme=dark&autoplay=breeze");
    await expect(page.locator("#snip-element")).toContainText('theme="dark" autoplay="breeze"');
    await expect(page.locator("#embed-frame iframe")).toHaveAttribute(
      "src",
      /play\/\?toy=strawberry&theme=dark/,
    );
    await expect(page.locator("#snip-link")).toContainText("splashery/#s=");
    expect(await page.locator("#lk-toy option").count()).toBeGreaterThan(100);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${SHOTS}/spg-share-390x844.png` });
  });
});
