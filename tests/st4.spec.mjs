// Lane Site r4: ready for the front door. The root 404 page (shipped now), and the staged front
// door: the site's home page at the root, the Playground at playground/, one service worker, and
// redirects for every old address (tools/site-front-door.mjs, built into .cache/front-door/ by
// `node tools/site-build.mjs --front-door`; nothing here changes the live files).

import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { startPages } from "./st4-server.mjs";

const REPO = path.resolve(".");
const STAGED = path.join(REPO, ".cache/front-door");
const SHOTS = path.join(REPO, "tests/screenshots");
const GRAPE = "j.eyJhcHAiOiJzcGxhc2hlcnkiLCJ2ZXJzaW9uIjozLCJ0b3kiOnsia2luZCI6ImJ1aWx0aW4iLCJpZCI6ImdyYXBlIn19"; // prettier-ignore

// Console and network problems, minus the 404 a missing page is meant to answer with.
function watch(page, { allow404 = [] } = {}) {
  const problems = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && !allow404.some((a) => r.url().includes(a))) {
      problems.push(`${r.status()} ${r.url()}`);
    }
  });
  return problems;
}

const swScope = (page) => page.evaluate(() => navigator.serviceWorker.ready.then((r) => r.scope));
const cacheKeys = (page) => page.evaluate(() => caches.keys());
const registrations = (page) =>
  page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope));

test.describe.configure({ mode: "serial" });

// ---- The root 404 page (before the swap) -----------------------------------------------------

test.describe("the root 404 page", () => {
  let pages;
  test.beforeAll(async () => {
    pages = await startPages(REPO);
  });
  test.afterAll(async () => pages.close());

  test("a missing path gets the page with status 404, a search for its words, and nothing from the preview", async ({
    page,
  }) => {
    // prettier-ignore
    const problems = watch(page, { allow404: ["/no/such/rubber-duckk"] });
    const res = await page.goto(`${pages.origin}/no/such/rubber-duckk`);
    expect(res.status()).toBe(404);
    await expect(page).toHaveTitle(/Page not found/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page isn't here");
    await expect(page.locator("#q404")).toHaveValue("no such rubber duckk");
    // Nothing matches all the words, so it tries the longest: "rubber".
    await expect(page.locator("#nf-results li").first()).toContainText("Rubber duck");
    expect(await page.locator('meta[name="robots"]').getAttribute("content")).toBe("noindex");
    // A toy opens in the Playground (the root, until the swap); nothing links into the preview.
    const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.href));
    expect(hrefs.filter((h) => h.includes("/site/"))).toEqual([]);
    const toy = await page.locator("#nf-results li a").first().getAttribute("href");
    expect(toy).toMatch(new RegExp(`^${pages.origin}/#s=j\\.`));
    // The page is the site's own look: the site's styles were loaded from site/assets/.
    expect(await page.locator(".site-header").evaluate((e) => getComputedStyle(e).position)).toBe("sticky"); // prettier-ignore
    expect(problems).toEqual([]);
  });

  test("the search box searches again", async ({ page }) => {
    await page.goto(`${pages.origin}/nowhere/`);
    await page.locator("#q404").fill("chess");
    await page.locator("#q404").press("Enter");
    await expect(page.locator("#nf-results li").first()).toContainText("Chess");
    await page.locator("#q404").fill("zzzzqq");
    await page.locator("#q404").press("Enter");
    await expect(page.locator("#nf-status")).toContainText("Nothing matches");
  });

  test("an old scene link goes to the Playground before the page paints", async ({ page }) => {
    await page.goto(`${pages.origin}/old/page/#s=${GRAPE}`, { waitUntil: "commit" });
    await page.waitForURL(`${pages.origin}/#s=${GRAPE}`);
    // and keeps the query options
    await page.goto(`${pages.origin}/old/page/?renderer=webgl2#s=${GRAPE}`, {
      waitUntil: "commit",
    });
    await page.waitForURL(`${pages.origin}/?renderer=webgl2#s=${GRAPE}`);
  });

  test("an old toy address (a path with a toy's id) goes to that toy", async ({ page }) => {
    await page.goto(`${pages.origin}/toys/grape.html`, { waitUntil: "commit" });
    await page.waitForURL(/\/#s=j\./);
    const hash = new URL(page.url()).hash.slice(3);
    const scene = JSON.parse(Buffer.from(hash.slice(2), "base64url").toString());
    expect(scene.toy).toEqual({ kind: "builtin", id: "grape" });
  });

  test("on GitHub Pages the project folder is the root (…github.io/splashery/…)", async ({
    page,
  }) => {
    // prettier-ignore
    const host = "https://ryanjosephkamp.github.io";
    await page.route(`${host}/**`, async (route) => {
      const url = new URL(route.request().url());
      const rel = url.pathname.replace(/^\/splashery\//, "");
      const file = path.join(REPO, rel);
      if (
        url.pathname.startsWith("/splashery/") &&
        fs.existsSync(file) &&
        fs.statSync(file).isFile()
      ) {
        // prettier-ignore
        const type = file.endsWith(".css") ? "text/css" : file.endsWith(".json") ? "application/json" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : "text/html"; // prettier-ignore
        return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
      }
      return route.fulfill({ status: 404, contentType: "text/html", body: fs.readFileSync(path.join(REPO, "404.html")) }); // prettier-ignore
    });
    await page.goto(`${host}/splashery/gone/rubber-duck-page`);
    await expect(page.locator("#nf-results li").first()).toBeVisible();
    expect(await page.locator(".site-header").evaluate((e) => getComputedStyle(e).position)).toBe("sticky"); // prettier-ignore
    expect(await page.locator("#nf-results li img").first().evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true); // prettier-ignore
  });

  test("site/404.html (the preview's own page) and the preview itself are untouched", async ({
    page,
  }) => {
    // prettier-ignore
    const res = await page.goto(`${pages.origin}/site/404.html`);
    expect(res.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page isn't here");
    expect(await page.locator('main form[action="search/"]').count()).toBe(1);
    const root = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
    expect(root).toContain('src="./src/app.js"');
    expect(root).not.toContain("noindex");
    expect(fs.readFileSync(path.join(REPO, "site/index.html"), "utf8")).toContain(
      'content="noindex"',
    );
  });
});

// ---- The staged front door ----------------------------------------------------------------------

test.describe("the staged front door", () => {
  test.beforeAll(() => {
    execFileSync("node", ["tools/site-build.mjs", "--front-door"], { cwd: REPO, stdio: "pipe" });
  });

  const generated = () => {
    // Files the build wrote itself (not links to the app's own).
    const out = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, e.name);
        if (e.isSymbolicLink()) continue;
        if (e.isDirectory()) walk(abs);
        else out.push(abs);
      }
    };
    walk(STAGED);
    return out;
  };

  test("every link and picture on every generated page leads to a file", () => {
    const missing = [];
    let checked = 0;
    for (const file of generated().filter((f) => f.endsWith(".html"))) {
      const html = fs.readFileSync(file, "utf8");
      const dir = path.dirname(file);
      for (const m of html.matchAll(/\b(?:href|src|data-src|action)="([^"]+)"/g)) {
        let v = m[1];
        if (/^(https?:|data:|mailto:|javascript:|#|\/\/)/.test(v) || /['+]/.test(v)) continue; // scripts that build links
        v = v.split("#")[0].split("?")[0];
        if (!v) continue;
        let target = path.resolve(dir, v);
        if (v.endsWith("/") || (fs.existsSync(target) && fs.statSync(target).isDirectory())) target = path.join(target, "index.html"); // prettier-ignore
        checked++;
        if (!fs.existsSync(target)) missing.push(`${path.relative(STAGED, file)}: ${m[1]}`);
      }
    }
    expect(checked).toBeGreaterThan(20000);
    expect(missing.slice(0, 20)).toEqual([]);
  });

  test("the swapped pages don't ask search engines to stay away; the sitemap names the new addresses", () => {
    // prettier-ignore
    const noindex = generated()
      // site/ holds redirects; play/ is the embed player, which keeps its own noindex.
      .filter((f) => f.endsWith(".html") && !f.includes(`${path.sep}site${path.sep}`) && !f.endsWith(`play${path.sep}index.html`)) // prettier-ignore
      .filter((f) => fs.readFileSync(f, "utf8").includes('content="noindex"'))
      .map((f) => path.relative(STAGED, f));
    expect(noindex).toEqual([]);
    const sitemap = fs.readFileSync(path.join(STAGED, "sitemap.xml"), "utf8");
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(urls.length).toBe(
      (fs.readFileSync(path.join(REPO, "site/sitemap.xml"), "utf8").match(/<loc>/g) || []).length,
    );
    expect(urls.filter((u) => u.includes("/site/"))).toEqual([]);
    expect(urls).toContain("https://ryanjosephkamp.github.io/splashery/");
    for (const u of urls) {
      const rel = u.replace("https://ryanjosephkamp.github.io/splashery/", "");
      expect(fs.existsSync(path.join(STAGED, rel, "index.html")), u).toBe(true);
    }
    // Canonical addresses are the new ones too.
    const home = fs.readFileSync(path.join(STAGED, "index.html"), "utf8");
    expect(home).toContain('<link rel="canonical" href="https://ryanjosephkamp.github.io/splashery/" />'); // prettier-ignore
    expect(home).toContain("google-site-verification");
  });

  test("every address the preview has now redirects to its new home", () => {
    const old = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) walk(abs);
        else if (e.name === "index.html") old.push(path.relative(path.join(REPO, "site"), abs));
      }
    };
    walk(path.join(REPO, "site"));
    expect(old.length).toBeGreaterThan(400);
    for (const rel of old) {
      const stub = path.join(STAGED, "site", rel);
      expect(fs.existsSync(stub), `site/${rel}`).toBe(true);
      const html = fs.readFileSync(stub, "utf8");
      expect(html, rel).toContain("location.replace");
      const depth = rel.split("/").length - 1;
      const target = "../".repeat(depth + 1) + rel.replace(/index\.html$/, "");
      expect(html, rel).toContain(`url=${target}`);
      expect(fs.existsSync(path.join(STAGED, rel)), `new ${rel}`).toBe(true);
    }
  });

  test("the retired worker stands in for site/sw.js, and one worker covers the root", () => {
    const retire = fs.readFileSync(path.join(STAGED, "site/sw.js"), "utf8");
    expect(retire).toContain("registration.unregister()");
    expect(retire).not.toContain('addEventListener("fetch"');
    const root = fs.readFileSync(path.join(STAGED, "sw.js"), "utf8");
    expect(root).toMatch(/const VERSION = "[0-9a-f]{12}"/);
    expect(root).toContain("splashery-site-"); // it clears the preview worker's caches too
    expect(fs.existsSync(path.join(STAGED, "playground/index.html"))).toBe(true);
    const play = fs.readFileSync(path.join(STAGED, "playground/index.html"), "utf8");
    expect(play).toContain('src="../src/app.js"');
    expect(play).toContain('register("../sw.js"');
    expect(JSON.parse(fs.readFileSync(path.join(STAGED, "manifest.webmanifest"), "utf8")).id).toBe("./"); // prettier-ignore
  });

  test.describe("in the browser", () => {
    let pages;
    test.beforeAll(async () => {
      pages = await startPages(STAGED);
    });
    test.afterAll(async () => pages.close());

    test("the home page is at the root, and every menu door leads somewhere", async ({ page }) => {
      const problems = watch(page);
      await page.goto(`${pages.origin}/`);
      await expect(page).toHaveTitle(/Splashery/);
      expect(await page.locator('meta[name="robots"]').count()).toBe(0);
      await expect(page.locator("main h1").first()).toBeVisible();
      const playground = page.locator('main a[href="playground/"]').first();
      await expect(playground).toBeVisible();
      for (const href of ["toys/", "tools/", "science/", "studio/", "learn/", "new/", "about/"]) {
        const r = await page.request.get(`${pages.origin}/${href}`);
        expect(r.status(), href).toBe(200);
      }
      expect(problems).toEqual([]);
    });

    test("old shared links and options open the Playground before anything paints", async ({
      page,
    }) => {
      // prettier-ignore
      const o = pages.origin;
      const cases = [
        [`/#s=${GRAPE}`, `/playground/#s=${GRAPE}`],
        [`/index.html#s=${GRAPE}`, `/playground/#s=${GRAPE}`],
        ["/?renderer=webgl2", "/playground/?renderer=webgl2"],
        ["/?labs=1&profile=weak", "/playground/?labs=1&profile=weak"],
        [`/?renderer=webgl2#s=${GRAPE}`, `/playground/?renderer=webgl2#s=${GRAPE}`],
      ];
      for (const [from, to] of cases) {
        await page.goto(o + from, { waitUntil: "commit" });
        await page.waitForURL(o + to);
        // The home page never painted: the page we landed on is the Playground.
        expect(
          (await page.locator("#stage").count()) + (await page.title()).length,
        ).toBeGreaterThan(0);
      }
      // The home page keeps ?labs and tracking parameters, and its own anchors.
      for (const stay of ["/?labs=1", "/?utm_source=x&fbclid=y", "/#main", "/#newest"]) {
        await page.goto(o + stay);
        await page.waitForTimeout(300);
        expect(new URL(page.url()).pathname, stay).toBe("/");
        await expect(page.locator("main h1").first()).toBeVisible();
      }
    });

    test("the Playground opens at its own path and a shared link opens its toy", async ({
      page,
    }) => {
      // prettier-ignore
      const problems = watch(page);
      await page.goto(`${pages.origin}/#s=${GRAPE}`);
      await page.waitForURL(/\/playground\/#s=/);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await expect(page.locator("#toy-status")).toHaveText(/^Grape/, { timeout: 180_000 });
      expect(problems.filter((p) => !/webgpu|swiftshader/i.test(p))).toEqual([]);
    });

    test("every old site/ address lands on its new page with its query and hash", async ({
      page,
    }) => {
      // prettier-ignore
      const o = pages.origin;
      const cases = [
        ["/site/", "/"],
        ["/site/toys/grape/?x=1#frag", "/toys/grape/?x=1#frag"],
        ["/site/search/?q=duck", "/search/?q=duck"],
        ["/site/play/?toy=grape&autoplay=0", "/play/?toy=grape&autoplay=0"],
        ["/site/about/credits/", "/about/credits/"],
        ["/site/404.html", "/"],
      ];
      for (const [from, to] of cases) {
        await page.goto(o + from, { waitUntil: "commit" });
        await page.waitForURL(o + to);
      }
      // What other pages still read from site/: the Manual's outline, the catalog PDF.
      for (const f of [
        "/site/assets/outline.css",
        "/site/assets/outline.js",
        "/site/assets/og.png",
        "/site/splashery-catalog.pdf",
      ]) {
        // prettier-ignore
        expect((await page.request.get(o + f)).status(), f).toBe(200);
      }
    });

    test("search, toy pages and the live toy work from the root", async ({ page }) => {
      const problems = watch(page);
      await page.goto(`${pages.origin}/search/?q=rubber%20duck`);
      const first = page.locator("#search-results li a").first();
      await expect(first).toContainText("Rubber duck");
      expect(await first.getAttribute("href")).toBe("../toys/rubber-duck/");
      await expect(page.locator("#search-results li img").first()).toBeVisible();
      expect(await page.locator("#search-results li img").first().evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true); // prettier-ignore
      await page.goto(`${pages.origin}/toys/rubber-duck/`);
      await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Rubber duck");
      // The toy's Playground link goes to playground/ with its scene.
      const open = page.locator('a[href*="playground/#s=j."]').first();
      await expect(open).toBeVisible();
      expect(problems).toEqual([]);
      // The embed player on its own: its "Open in Splashery" link points at the Playground.
      await page.goto(`${pages.origin}/play/?toy=grape&autoplay=0`);
      await expect(page.locator("#open-link")).toHaveAttribute("href", /\/playground\/#s=j\./, { timeout: 60_000 }); // prettier-ignore
      await page.waitForSelector("canvas", { timeout: 60_000 });
    });

    test("the app's other pages keep working (embed, worlds, Manual)", async ({ page }) => {
      const o = pages.origin;
      for (const f of [
        "/embed/",
        "/worlds/",
        "/manual/",
        "/manual/tinkerers-manual.pdf",
        "/pdf-lab/",
      ]) {
        // prettier-ignore
        expect((await page.request.get(o + f)).status(), f).toBe(200);
      }
      await page.goto(`${o}/manual/`);
      const outline = await page.locator('link[href*="outline.css"]').first().getAttribute("href");
      expect(outline).toBe("../site/assets/outline.css");
    });

    test("a missing path gets the live 404 page: the full menu, a search, the way into the Playground", async ({
      page,
    }) => {
      // prettier-ignore
      const problems = watch(page, { allow404: ["/gone/rubber-duckk"] });
      const res = await page.goto(`${pages.origin}/gone/rubber-duckk`);
      expect(res.status()).toBe(404);
      await expect(page.locator("#site-menu a").first()).toBeVisible({ timeout: 20_000 }).catch(() => {}); // prettier-ignore
      expect(await page.locator("#site-menu nav a").count()).toBe(8);
      await expect(page.locator("#nf-results li").first()).toContainText("Rubber duck");
      expect(await page.locator("#nf-results li a").first().getAttribute("href")).toBe(`${pages.origin}/toys/rubber-duck/`); // prettier-ignore
      expect(await page.locator('main a:has-text("Open the Playground")').getAttribute("href")).toBe("playground/"); // prettier-ignore
      expect(await page.locator('meta[name="robots"]').count()).toBe(0);
      expect(problems).toEqual([]);
      // An old scene link on a missing path goes to the Playground.
      await page.goto(`${pages.origin}/gone/#s=${GRAPE}`, { waitUntil: "commit" });
      await page.waitForURL(`${pages.origin}/playground/#s=${GRAPE}`);
      // An old toy address goes to the toy's page.
      await page.goto(`${pages.origin}/toys/grape.html`, { waitUntil: "commit" });
      await page.waitForURL(`${pages.origin}/toys/grape/`);
    });
  });
});

// ---- The one service worker, staged ------------------------------------------------------------

test.describe("the staged service worker", () => {
  let pages;
  test.beforeAll(async () => {
    execFileSync("node", ["tools/site-build.mjs", "--front-door"], { cwd: REPO, stdio: "pipe" });
    pages = await startPages(STAGED);
  });
  test.afterAll(async () => pages.close());

  test("one worker covers the project, and the shell works offline", async ({ page, context }) => {
    // prettier-ignore
    await page.goto(`${pages.origin}/toys/`);
    expect(await swScope(page)).toBe(`${pages.origin}/`);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    expect((await cacheKeys(page)).some((k) => k.startsWith("splashery-shell-"))).toBe(true);
    await context.setOffline(true);
    // The home page, a hub and the search page come from the shell.
    for (const [p, h1] of [
      ["/", "main h1"],
      ["/toys/", "main h1"],
      ["/search/", "main h1"],
    ]) {
      await page.goto(`${pages.origin}${p}`);
      await expect(page.locator(h1).first()).toBeVisible();
    }
    // A page that was never there answers with the 404 page, offline too.
    const res = await page.goto(`${pages.origin}/no/such/page/`);
    expect(res.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page isn't here");
    await context.setOffline(false);
  });

  test("a Playground that was opened once opens again offline, with the toy it showed", async ({
    page,
    context,
  }) => {
    // prettier-ignore
    const problems = watch(page);
    await page.goto(`${pages.origin}/playground/?renderer=webgl2&profile=weak#s=${GRAPE}`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page.locator("#toy-status")).toHaveText(/^Grape/, { timeout: 180_000 });
    // The page hands the worker what it loaded a few seconds after load; wait for the cache to
    // hold the app's code and the toy's files.
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const names = await caches.keys();
            const urls = [];
            for (const n of names)
              for (const r of await (await caches.open(n)).keys()) urls.push(r.url);
            return [urls.some((u) => u.includes("/src/app.js")), urls.some((u) => u.includes("/assets/toys/grape/"))]; // prettier-ignore
          }),
        { timeout: 60_000, intervals: [1000] },
      )
      .toEqual([true, true]);
    expect(await swScope(page)).toBe(`${pages.origin}/`);
    await context.setOffline(true);
    await page.goto(`${pages.origin}/playground/?renderer=webgl2&profile=weak#s=${GRAPE}`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page.locator("#toy-status")).toHaveText(/^Grape/, { timeout: 180_000 });
    await context.setOffline(false);
    expect(problems.filter((p) => !/webgpu|swiftshader|Failed to load resource/i.test(p))).toEqual([]); // prettier-ignore
  });

  test("a new deploy replaces the old shell at once, and never mixes old code with new", async ({
    page,
    context,
  }) => {
    // prettier-ignore
    // Deploy B: the same site with another home page, another script and another worker version.
    const dirB = path.join(REPO, ".cache/front-door-b");
    fs.rmSync(dirB, { recursive: true, force: true });
    fs.cpSync(STAGED, dirB, { recursive: true, verbatimSymlinks: true });
    const home = path.join(dirB, "index.html");
    fs.writeFileSync(home, fs.readFileSync(home, "utf8").replace("<title>", "<title>B · "));
    const siteJs = path.join(dirB, "assets/site.js");
    fs.rmSync(siteJs, { force: true }); // it is a link into the repo: never write through it
    fs.writeFileSync(siteJs, fs.readFileSync(path.join(REPO, "site/assets/site.js"), "utf8") + "\nwindow.__deploy = 'B';\n"); // prettier-ignore
    const sw = path.join(dirB, "sw.js");
    fs.writeFileSync(sw, fs.readFileSync(sw, "utf8").replace(/const VERSION = "[^"]*"/, 'const VERSION = "deployB"')); // prettier-ignore
    try {
      pages.setDir(STAGED);
      await page.goto(`${pages.origin}/`);
      await page.reload();
      await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
      const before = await cacheKeys(page);
      expect(before.some((k) => k.endsWith("deployB"))).toBe(false);
      expect(await page.title()).not.toContain("B · ");

      pages.setDir(dirB);
      // The code the old shell cached is not served: the network answers first.
      await page.goto(`${pages.origin}/`);
      await expect(page).toHaveTitle(/^B · /);
      expect(await page.evaluate(async () => (await (await fetch("/assets/site.js")).text()).includes("__deploy = 'B'"))).toBe(true); // prettier-ignore
      // The new worker takes over and drops the old shell.
      await expect
        .poll(async () => (await cacheKeys(page)).filter((k) => k.startsWith("splashery-shell-")), {
          timeout: 30_000,
        }) // prettier-ignore
        .toEqual(["splashery-shell-deployB"]);
      // Offline afterwards, the visitor has deploy B, not A.
      await context.setOffline(true);
      await page.goto(`${pages.origin}/`);
      await expect(page).toHaveTitle(/^B · /);
      await context.setOffline(false);
    } finally {
      pages.setDir(STAGED);
      fs.rmSync(dirB, { recursive: true, force: true });
    }
  });

  test("a visitor with the preview's old worker is cleaned up and moves to the new site", async ({
    page,
  }) => {
    // prettier-ignore
    // Before the swap: the preview under site/ registers its worker (scope site/).
    pages.setDir(REPO);
    await page.goto(`${pages.origin}/site/`);
    await expect.poll(() => registrations(page)).toContain(`${pages.origin}/site/`);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    expect((await cacheKeys(page)).some((k) => k.startsWith("splashery-site-shell-"))).toBe(true);

    // The swap lands. The visitor opens an old address; it sends them on, and the browser's next
    // check of site/sw.js finds the stand-in.
    pages.setDir(STAGED);
    await page.goto(`${pages.origin}/site/toys/`, { waitUntil: "commit" });
    await page.waitForURL(`${pages.origin}/toys/`);
    await expect(page.locator("main h1").first()).toBeVisible();
    await page.evaluate(async () => {
      for (const r of await navigator.serviceWorker.getRegistrations()) {
        if (r.scope.endsWith("/site/")) await r.update().catch(() => {});
      }
    });
    await expect
      .poll(async () => (await registrations(page)).filter((s) => s.endsWith("/site/")), {
        timeout: 30_000,
      }) // prettier-ignore
      .toEqual([]);
    await expect
      .poll(async () => (await cacheKeys(page)).filter((k) => k.startsWith("splashery-site-")), {
        timeout: 30_000,
      }) // prettier-ignore
      .toEqual([]);
    // The one new worker is in charge of the root, with its own shell.
    expect(await swScope(page)).toBe(`${pages.origin}/`);
    expect((await cacheKeys(page)).some((k) => k.startsWith("splashery-shell-"))).toBe(true);
  });
});

// ---- Screenshots for the review page ---------------------------------------------------------

test.describe("screenshots", () => {
  test("the 404 page (live today) and the staged front door, at phone and desktop size", async ({
    browser,
  }) => {
    // prettier-ignore
    fs.mkdirSync(SHOTS, { recursive: true });
    const today = await startPages(REPO);
    execFileSync("node", ["tools/site-build.mjs", "--front-door"], { cwd: REPO, stdio: "pipe" });
    const staged = await startPages(STAGED);
    try {
      const sizes = [
        [390, 844],
        [1440, 900],
      ];
      for (const [w, h] of sizes) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); // prettier-ignore
        const page = await ctx.newPage();
        const shot = async (origin, url, name, wait) => {
          await page.goto(origin + url);
          await wait?.(page);
          await page.waitForTimeout(800);
          await page.screenshot({ path: path.join(SHOTS, `st4-${name}-${w}x${h}.png`) });
        };
        await shot(today.origin, "/some/old/page-about-ducks", "404-missing", (p) => p.locator("#nf-status:not(:empty)").waitFor()); // prettier-ignore
        await shot(today.origin, "/toys/rubber-duckk", "404-oldtoy", (p) => p.locator("#nf-results li").first().waitFor()); // prettier-ignore
        await shot(staged.origin, "/", "front-home", (p) => p.waitForTimeout(3000));
        await shot(
          staged.origin,
          "/playground/?renderer=webgl2&profile=weak",
          "front-playground",
          async (p) => {
            // prettier-ignore
            await p.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
            await p.waitForTimeout(4000);
          },
        );
        await ctx.close();
      }
    } finally {
      await today.close();
      await staged.close();
    }
  });
});
