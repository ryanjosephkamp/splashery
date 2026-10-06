// Lane Site: the preview site under site/ (built by tools/site-build.mjs).
// Every page loads with the one menu, the menu works on a phone, search finds a
// toy by its tag, the service worker stays inside site/ and the pages and the
// home page's toy work offline after one visit, the gallery is untouched, and
// the pages are light, labeled and readable.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { TOYS } from "../src/toys.js";
import { PAGES, MENU, HOME_TOY } from "../tools/site-pages.mjs";

// The toy pages (one per toy, about 390) are checked in tests/tpg.spec.mjs:
// statically in Node, and a sample in the browser.
const SHELL_PAGES = PAGES.filter((p) => p.type !== "toy");

const ORIGIN = `http://127.0.0.1:${Number(process.env.SPLASHERY_PORT) || 4173}`;
const SHOTS = path.resolve("tests/screenshots");

function watchConsole(page) {
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

// A public toy and one of its tags that no other entry in the search index has
// (and that isn't in the toy's name).
function uniqueTag() {
  const index = JSON.parse(fs.readFileSync("site/search-index.json", "utf8"));
  const hay = index.map((e) => `${e.w} ${e.d || ""}`.toLowerCase());
  for (const toy of TOYS.filter((t) => !t.labs && t.tags)) {
    for (const tag of toy.tags.toLowerCase().split(/\s+/)) {
      if (tag.length < 5 || !/^[a-z]+$/.test(tag) || toy.label.toLowerCase().includes(tag))
        continue;
      if (hay.filter((h) => h.includes(tag)).length === 1) return { toy, tag };
    }
  }
  throw new Error("no toy with a tag of its own");
}

const homeToyReady = (page) =>
  page.frameLocator(".hero-toy iframe").locator("body[data-ready='true']").waitFor({ timeout: 180_000 }); // prettier-ignore

test.describe("site", () => {
  test("the build is current, apart from the files that follow main", () => {
    // The pages built from the toy list and the git history (Home, Toys, Tools,
    // Science, Studio, About, What's new, the search index and the service
    // worker) change whenever a lane adds a toy or main gains a merge; the
    // Operator's upkeep rebuilds them. Every other file must match a fresh build.
    let out = "";
    let code = 0;
    try {
      out = execFileSync("node", ["tools/site-build.mjs", "--check"], { encoding: "utf8" });
    } catch (err) {
      out = String(err.stdout || "");
      code = err.status;
    }
    const stale = out.split("\n").filter((l) => l.startsWith("out of date:"));
    expect(stale, out).toEqual([]);
    expect(code, out).toBe(0);
    // The upkeep rebuilds the site after each merge.
    expect(fs.readFileSync("tools/upkeep.mjs", "utf8")).toContain('"tools/site-build.mjs"');
  });

  test("every page loads with the one menu, a title and a link preview", async ({ page }) => {
    const problems = watchConsole(page);
    const sitemap = fs.readFileSync("site/sitemap.xml", "utf8");
    for (const p of SHELL_PAGES) {
      expect(sitemap.includes(`/splashery/site/${p.path}<`), `sitemap has ${p.path || "home"}`).toBe(true); // prettier-ignore
      const res = await page.goto(`/site/${p.path}`);
      expect(res.status(), p.path).toBe(200);
      await expect(page.locator(".site-header nav a")).toHaveCount(MENU.length);
      await expect(page.locator("h1")).toHaveCount(1);
      if (p.nav) {
        await expect(page.locator('.site-header nav a[aria-current="page"]')).toHaveText(
          MENU.find((m) => m.id === p.nav).label,
        );
      }
      const meta = await page.evaluate(() => ({
        title: document.title,
        desc: document.querySelector('meta[name="description"]')?.content,
        ogImage: document.querySelector('meta[property="og:image"]')?.content,
        ogTitle: document.querySelector('meta[property="og:title"]')?.content,
        canonical: document.querySelector('link[rel="canonical"]')?.href,
        manifest: document.querySelector('link[rel="manifest"]')?.href,
      }));
      expect(meta.title, p.path).toMatch(/Splashery/);
      expect(meta.desc?.length, p.path).toBeGreaterThan(30);
      expect(meta.ogImage).toMatch(/\/site\/assets\/og\.png$/);
      expect(meta.ogTitle).toBeTruthy();
      expect(meta.canonical).toMatch(/^https:\/\/ryanjosephkamp\.github\.io\/splashery\/site\//);
      expect(meta.manifest).toBe(`${ORIGIN}/site/manifest.webmanifest`);
    }
    // The 404 page, and the files the pages lean on.
    expect((await page.goto("/site/404.html")).status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("This page isn't here");
    for (const f of ["assets/og.png", "manifest.webmanifest", "search-index.json", "sw.js"]) {
      expect((await page.request.get(`/site/${f}`)).status(), f).toBe(200);
    }
    const manifest = await (await page.request.get("/site/manifest.webmanifest")).json();
    expect(manifest.scope).toBe("./");
    expect(manifest.start_url).toBe("./");
    expect(problems).toEqual([]);
  });

  test("the links on every page lead somewhere", async ({ page }) => {
    const seen = new Set();
    for (const p of [...SHELL_PAGES.map((x) => x.path), "404.html"]) {
      await page.goto(`/site/${p}`);
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.href));
      for (const h of hrefs) {
        const u = new URL(h);
        if (u.origin !== ORIGIN) continue;
        const key = u.pathname;
        if (seen.has(key)) continue;
        seen.add(key);
        const res = await page.request.get(u.pathname);
        expect(res.status(), `${h} on /site/${p}`).toBe(200);
      }
    }
  });

  test("the menu works on a phone, by touch and by keyboard", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); // prettier-ignore
    const page = await ctx.newPage();
    await page.goto("/site/");
    const button = page.locator(".menu-button");
    const toysLink = page.locator(".site-header nav a", { hasText: "Toys" });
    await expect(button).toBeVisible();
    await expect(toysLink).toBeHidden();
    await button.tap();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(toysLink).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
    await expect(toysLink).toBeHidden();
    await page.keyboard.press("Enter");
    await expect(toysLink).toBeVisible();
    await toysLink.tap();
    await expect(page).toHaveURL(/\/site\/toys\/$/);
    await expect(page.locator("h1")).toHaveText("Toys");
    // No sideways scrolling on a phone, on any page.
    for (const p of SHELL_PAGES) {
      await page.goto(`/site/${p.path}`);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(wide, p.path || "home").toBeLessThanOrEqual(390);
    }
    await ctx.close();
  });

  test("search finds a toy by its tag and opens its page, then the gallery", async ({ page }) => {
    // A tag that isn't in the toy's name and belongs to no other entry.
    const { toy, tag } = uniqueTag();
    await page.goto("/site/");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.fill("#site-search", tag);
    await page.press("#site-search", "Enter");
    await expect(page).toHaveURL(new RegExp(`/site/search/\\?q=${tag}$`));
    const first = page.locator(".search-results .result").first();
    await expect(first.locator(".result-name")).toHaveText(toy.label);
    await expect(page.locator(".search-results .result")).toHaveCount(1);
    // Typing searches as you go; a labs toy stays out unless labs is on.
    await page.fill("#q", "piano");
    await expect(page.locator("#search-status")).toContainText("for “piano”");
    await expect(page).toHaveURL(/q=piano/);
    const labsToy = TOYS.find((t) => t.labs);
    await page.fill("#q", labsToy.label);
    await page.waitForTimeout(400);
    const names = await page.locator(".result-name").allTextContents();
    expect(names).not.toContain(labsToy.label);
    // The result opens the toy's page, whose button opens it in the gallery.
    await page.fill("#q", tag);
    await expect(first.locator(".result-name")).toHaveText(toy.label);
    const href = await first.locator("a").getAttribute("href");
    expect(new URL(href, page.url()).pathname).toBe(`/site/toys/${toy.id}/`);
    await page.goto(`/site/toys/${toy.id}/`);
    const open = await page.getByRole("link", { name: "Open in the gallery" }).getAttribute("href");
    const url = new URL(open, page.url());
    expect(url.pathname).toBe("/");
    await page.goto(`/?renderer=webgl2${url.hash}`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    expect(await page.evaluate(() => window.__splashery.player.scene.toy.id)).toBe(toy.id);
  });

  test("search shows labs toys with the labs switch on", async ({ page }) => {
    const labsToy = TOYS.find((t) => t.labs);
    await page.goto(`/site/search/?labs=1&q=${encodeURIComponent(labsToy.label)}`);
    await expect(page.locator(".result-name").first()).toBeVisible();
    expect(await page.locator(".result-name").allTextContents()).toContain(labsToy.label);
    await page.goto("/site/?labs=0");
  });

  test("the service worker stays in site/ and the site works offline after one visit", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const problems = watchConsole(page);
    await page.goto("/site/?renderer=webgl2");
    await homeToyReady(page);
    const scope = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return reg.scope;
    });
    expect(scope).toBe(`${ORIGIN}/site/`);
    // The home page's toy reaches the cache from this first visit.
    const sog = `${ORIGIN}/assets/toys/${HOME_TOY.id}/`;
    await expect
      .poll(
        () =>
          page.evaluate(async (prefix) => {
            const names = await caches.keys();
            for (const n of names) {
              const keys = await (await caches.open(n)).keys();
              if (keys.some((r) => r.url.startsWith(prefix) && r.url.endsWith(".sog"))) return true;
            }
            return false;
          }, sog),
        { timeout: 60_000 },
      )
      .toBe(true);
    // Let the worker finish keeping the rest.
    await page.waitForTimeout(4000);

    await ctx.setOffline(true);
    await page.reload();
    await expect(page.locator("h1")).toHaveText(PAGES[0].headline);
    await homeToyReady(page);
    const toy = await page
      .frameLocator(".hero-toy iframe")
      .locator("body")
      .evaluate(() => ({
        id: window.__splashery?.player?.toyInfo?.id,
        fallback: !document.getElementById("fallback").hidden,
      }));
    expect(toy).toEqual({ id: HOME_TOY.id, fallback: false });
    // The other pages too, and search.
    await page.goto("/site/toys/");
    await expect(page.locator("h1")).toHaveText("Toys");
    const { toy: found, tag } = uniqueTag();
    await page.goto(`/site/search/?q=${tag}`);
    await expect(page.locator(".result-name").first()).toHaveText(found.label);
    // A page under site/ that isn't there gets the site's 404 page, online too.
    await page.goto("/site/no-such-page/");
    await expect(page.locator("h1")).toHaveText("This page isn't here");
    await ctx.setOffline(false);
    const res = await page.goto("/site/no-such-page/");
    expect(res.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText("This page isn't here");
    await expect(page.locator(".site-header nav a").first()).toHaveAttribute(
      "href",
      /^(\.\/)?$|\/site\/$/,
    );

    // The gallery and the embed player are not the worker's: nothing above site/.
    await page.goto("/?renderer=webgl2");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    const gallery = await page.evaluate(async () => ({
      controlled: !!navigator.serviceWorker.controller,
      scopes: (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope),
    }));
    expect(gallery.controlled).toBe(false);
    expect(gallery.scopes).toEqual([`${ORIGIN}/site/`]);
    await page.goto("/embed/?toy=cactus&renderer=webgl2");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(false);
    expect(problems.filter((p) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(p))).toEqual([]); // prettier-ignore
    await ctx.close();
  });

  test("the home page loads light and fast", async ({ page }) => {
    const sizes = new Map();
    page.on("response", async (res) => {
      if (!/^https?:/.test(res.url())) return;
      try {
        sizes.set(res.url(), (await res.body()).length);
      } catch {
        // redirects have no body
      }
    });
    await page.goto("/site/?renderer=webgl2");
    const timing = await page.evaluate(
      () =>
        new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const fcp = list.getEntriesByName("first-contentful-paint")[0];
            if (fcp) resolve({ fcp: Math.round(fcp.startTime) });
          }).observe({ type: "paint", buffered: true });
        }),
    );
    await homeToyReady(page);
    // The toy's picture gives way to the toy once it is drawn.
    await expect(page.locator(".stage.ready")).toHaveCount(1);
    await expect(page.locator(".stage .poster")).toHaveCSS("opacity", "0");
    await page.waitForTimeout(1500);
    const all = [...sizes].reduce((a, [, b]) => a + b, 0);
    const shell = [...sizes]
      .filter(([u]) => new URL(u).pathname.startsWith("/site/") && !u.includes("/site/play/"))
      .reduce((a, [, b]) => a + b, 0);
    console.log(
      `site home: shell ${(shell / 1024).toFixed(1)} KB, with the live toy ${(all / 1048576).toFixed(1)} MB, first paint ${timing.fcp} ms`, // prettier-ignore
    );
    expect(shell).toBeLessThan(80 * 1024);
    expect(all).toBeLessThan(30 * 1024 * 1024);
  });

  test("pages are labeled, keyboard friendly and readable in both themes", async ({ page }) => {
    for (const p of [...SHELL_PAGES.map((x) => x.path), "404.html"]) {
      await page.goto(`/site/${p}`);
      const issues = await page.evaluate(() => {
        const out = [];
        for (const img of document.querySelectorAll("img")) if (!img.hasAttribute("alt")) out.push(`img ${img.src}`); // prettier-ignore
        for (const b of document.querySelectorAll("button, a[href]")) {
          const name = (b.getAttribute("aria-label") || b.textContent || "").trim();
          if (!name) out.push(`unnamed ${b.outerHTML.slice(0, 80)}`);
        }
        for (const i of document.querySelectorAll("input:not([type=hidden])")) {
          if (!i.labels?.length && !i.getAttribute("aria-label")) out.push(`unlabeled ${i.id}`);
        }
        for (const f of document.querySelectorAll("iframe")) if (!f.title) out.push("untitled iframe"); // prettier-ignore
        return out;
      });
      expect(issues, p).toEqual([]);
    }
    // The first Tab reaches the skip link, which moves to the page.
    await page.goto("/site/about/");
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();

    // Text contrast, light and dark (WCAG AA: 4.5:1 for body text).
    const lum = (hex) => {
      const c = hex.match(/\w\w/g).map((h) => parseInt(h, 16) / 255);
      const l = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    for (const theme of ["light", "dark"]) {
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      const tokens = await page.evaluate(() => {
        const s = getComputedStyle(document.documentElement);
        const v = (n) => s.getPropertyValue(n).trim();
        return { page: v("--page"), card: v("--card"), ink: v("--ink"), muted: v("--muted"), accent: v("--accent"), accentInk: v("--accent-ink"), soft: v("--accent-soft") }; // prettier-ignore
      });
      for (const [fg, bg] of [
        ["ink", "page"],
        ["muted", "page"],
        ["accent", "page"],
        ["muted", "card"],
        ["accent", "card"],
        ["accentInk", "accent"],
        ["accent", "soft"],
        ["ink", "soft"],
      ]) {
        // prettier-ignore
        expect(ratio(tokens[fg], tokens[bg]), `${theme}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5); // prettier-ignore
      }
    }
  });

  test("the theme button cycles and the home toy follows it; reduced motion holds it still", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } }); // prettier-ignore
    const page = await ctx.newPage();
    await page.goto("/site/?renderer=webgl2");
    await homeToyReady(page);
    const frame = page.frameLocator(".hero-toy iframe").locator("html");
    expect(await frame.evaluate(() => window.__splashery.player.reducedMotion)).toBe(true);
    const button = page.locator(".theme-button");
    await button.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await button.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(frame).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await button.click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /./);
    await ctx.close();
  });

  test("screenshots: the home page and a search at both sizes", async ({ browser }) => {
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      // prettier-ignore
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: "light" }); // prettier-ignore
      const page = await ctx.newPage();
      await page.goto("/site/?renderer=webgl2");
      await homeToyReady(page);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(SHOTS, `site-home-${w}x${h}.png`) });
      await page.goto("/site/search/?q=planet");
      await expect(page.locator(".result-name").first()).toBeVisible();
      await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))); // prettier-ignore
      await page.screenshot({ path: path.join(SHOTS, `site-search-${w}x${h}.png`) });
      await ctx.close();
    }
  });
});
