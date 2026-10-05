// Lane Toy pages: a page for every toy (site/toys/<id>/, built by
// tools/site-build.mjs with tools/site-toy-pages.mjs) and the catalog PDF
// (tools/tpg-catalog.mjs). About 390 pages: every page's HTML is checked in Node
// (it exists, its links lead somewhere, its link preview is set, its credits
// and license notices are there); a sample, one toy from every shelf plus labs
// and noncommercial toys, is loaded in the browser.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { TOYS, CATEGORIES } from "../src/toys.js";
import { PAGES } from "../tools/site-pages.mjs";
import { evidenceSection, readEvidence, licenseNotices } from "../tools/site-toy-pages.mjs";

const SHOTS = path.resolve("tests/screenshots");
const SITE = path.resolve("site");
const shelfToys = TOYS.filter((t) => t.category);
// The pages are formatted by Prettier, which wraps tags and text: read them as one line.
const read = (f) => fs.readFileSync(path.join(SITE, f), "utf8").replace(/\s+/g, " ");
const attr = (html, re) => re.exec(html)?.[1];
const unesc = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"');

// Every href and src in a page (outside the snippets people copy).
function links(html) {
  const body = html.replace(/<textarea[\s\S]*?<\/textarea>/g, "");
  return [...body.matchAll(/\s(?:href|src|data-src)="([^"]*)"/g)].map((m) => unesc(m[1]));
}

// Where a link from a page under site/ lands in the repo, or null when it leaves it.
function target(pagePath, href) {
  if (/^(https?:|mailto:|data:|javascript:)/.test(href)) return null;
  const u = new URL(href, `http://x/splashery/site/${pagePath}`);
  if (!u.pathname.startsWith("/splashery/")) return { file: "outside the site", u };
  let file = decodeURIComponent(u.pathname.slice("/splashery/".length));
  if (file === "" || file.endsWith("/")) file += "index.html";
  return { file, u };
}

test.describe("toy pages (static)", () => {
  test("every shelf toy has a page, and only they do", () => {
    const dirs = fs.readdirSync(path.join(SITE, "toys")).filter((d) => fs.statSync(path.join(SITE, "toys", d)).isDirectory()); // prettier-ignore
    expect(dirs.sort()).toEqual(shelfToys.map((t) => t.id).sort());
    expect(PAGES.filter((p) => p.type === "toy")).toHaveLength(shelfToys.length);
  });

  test("every page has its link preview, its words and links that lead somewhere", () => {
    const sitemap = read("sitemap.xml");
    const problems = [];
    const checked = new Set();
    for (const t of shelfToys) {
      const p = `toys/${t.id}/`;
      const html = read(`${p}index.html`);
      const url = `https://ryanjosephkamp.github.io/splashery/site/${p}`;
      const say = (m) => problems.push(`${t.id}: ${m}`);
      if (!attr(html, /<title>([^<]*)<\/title>/)?.includes(t.label.replace(/&/g, "&amp;")))
        say("title");
      if ((attr(html, /<meta name="description" content="([^"]*)"/) || "").length < 40) say("description"); // prettier-ignore
      if (attr(html, /<link rel="canonical" href="([^"]*)"/) !== url) say("canonical");
      if (attr(html, /<meta property="og:url" content="([^"]*)"/) !== url) say("og:url");
      if (!attr(html, /<meta property="og:title" content="([^"]*)"/)) say("og:title");
      const img = attr(html, /<meta property="og:image" content="([^"]*)"/);
      if (img !== `https://ryanjosephkamp.github.io/splashery/assets/toys/${t.id}/thumb.webp`) say(`og:image ${img}`); // prettier-ignore
      if (!fs.existsSync(`assets/toys/${t.id}/thumb.webp`)) say("no thumbnail");
      if (attr(html, /<meta name="twitter:card" content="([^"]*)"/) !== "summary")
        say("twitter:card");
      if (!html.includes('<meta name="robots" content="noindex" />'))
        say("noindex while a preview");
      // The parts of the page.
      for (const id of ["h-credits", "h-share"]) if (!html.includes(`id="${id}"`)) say(`no #${id}`);
      if (!html.includes(`play/?toy=${t.id}`)) say("no live toy");
      if (!html.includes(`embed/?toy=${t.id}`)) say("no iframe snippet");
      if (!html.includes(`toy=&quot;${t.id}&quot;`)) say("no element snippet");
      if (!/Open in the gallery/.test(html)) say("no gallery link");
      // In the sitemap only when public.
      if (sitemap.includes(`<loc>${url}</loc>`) === !!t.labs) say("sitemap");
      // Labs toys: hidden until the labs switch, and the player waits for it.
      if (t.labs) {
        if (!/<article class="toy-page" data-labs>/.test(html)) say("labs page not hidden");
        if (!html.includes("data-labs-off")) say("no labs note");
        if (/<iframe\s+src="[^"]*play\//.test(html)) say("labs player starts with labs off");
      }
      // Every link leads somewhere: files exist, fragments are on the page.
      for (const href of links(html)) {
        if (href.startsWith("#")) {
          if (href.length > 1 && !html.includes(`id="${href.slice(1)}"`)) say(`no anchor ${href}`);
          continue;
        }
        const to = target(p, href);
        if (!to) continue;
        const key = to.file;
        if (checked.has(key)) continue;
        if (!fs.existsSync(path.resolve(key))) say(`broken link ${href}`);
        else checked.add(key);
        // A gallery link carries a scene for this toy (or a related one).
        if (to.file === "index.html" && to.u.hash.startsWith("#s=j.")) {
          const scene = JSON.parse(Buffer.from(to.u.hash.slice(5), "base64url").toString());
          if (scene.toy.id !== t.id) say(`gallery link opens ${scene.toy.id}`);
          checked.delete(key);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  test("credits and license notices are shown as the rules ask", () => {
    const problems = [];
    for (const t of shelfToys) {
      const html = read(`toys/${t.id}/index.html`);
      const c = t.credit;
      if (c) {
        if (!html.includes(`href="${c.source}"`)) problems.push(`${t.id}: no source link`);
        if (!html.includes(c.license)) problems.push(`${t.id}: no license`);
        for (const n of licenseNotices(c.license)) {
          if (!html.includes(n.replace(/'/g, "&#39;")) && !html.includes(n)) problems.push(`${t.id}: no notice "${n}"`); // prettier-ignore
        }
      }
    }
    expect(problems).toEqual([]);
    // The noncommercial scans and the NC-SA one carry their notices.
    const nc = shelfToys.filter((t) => /NC/.test(t.credit?.license || ""));
    expect(nc.length).toBeGreaterThan(0);
    for (const t of nc) expect(read(`toys/${t.id}/index.html`)).toContain("NonCommercial");
    const sa = shelfToys.filter((t) => /SA/.test(t.credit?.license || ""));
    for (const t of sa) expect(read(`toys/${t.id}/index.html`)).toContain("ShareAlike");
  });

  test("cards and search results across the site link to the toy's page", () => {
    const index = JSON.parse(read("search-index.json"));
    const toys = index.filter((e) => e.k === "toy");
    expect(toys).toHaveLength(shelfToys.length);
    for (const e of toys) expect(e.u).toMatch(/^toys\/[a-z0-9-]+\/$/);
    for (const f of ["index.html", "toys/index.html", "science/index.html"]) {
      const cards = [...read(f).matchAll(/class="toy-card"[^>]*>\s*<a href="([^"]*)"/g)].map((m) => m[1]); // prettier-ignore
      if (f !== "index.html") expect(cards.length, f).toBeGreaterThan(10);
      for (const h of cards) expect(h, f).toMatch(/toys\/[a-z0-9-]+\/$/);
    }
    // The home page's "From the shelves" row too.
    const feat = /<ul class="feat-row">([\s\S]*?)<\/ul>/.exec(read("index.html"))[1];
    for (const m of feat.matchAll(/href="([^"]*)"/g)) expect(m[1]).toMatch(/^toys\/[a-z0-9-]+\/$/);
  });

  test("the toy pages follow main and stay out of the service worker's install", () => {
    const build = fs.readFileSync("tools/site-build.mjs", "utf8");
    expect(build).toMatch(/TOY_TYPES = new Set\(\[[^\]]*"toy"/);
    const sw = read("sw.js");
    expect(sw).not.toContain('"toys/grape/"');
    expect(sw).toContain("assets/toy-page.css");
  });

  test("'Is it right?' shows a toy's evidence file, and nothing without one", () => {
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); // prettier-ignore
    const ev = readEvidence("sorting-machine", path.resolve("tests/fixtures/tpg"));
    const html = evidenceSection(ev, esc);
    expect(html).toContain('<h2 id="h-right">Is it right?</h2>');
    expect(html).toContain("Checked October 5, 2026.");
    expect(html).toContain("Bubble sort swaps neighbors");
    expect(html).toContain('class="verdict verdict-correct">Correct<');
    expect(html).toContain('class="verdict verdict-simplified">Simplified<');
    expect(html).toContain('href="https://en.wikipedia.org/wiki/Bubble_sort"');
    expect(html).toContain("Where it simplifies");
    expect(evidenceSection(null, esc)).toBe("");
    // On the site: a page has the section exactly when docs/evidence/<id>.json exists.
    for (const t of shelfToys) {
      const has = fs.existsSync(`docs/evidence/${t.id}.json`);
      expect(read(`toys/${t.id}/index.html`).includes('id="h-right"'), t.id).toBe(has);
    }
  });

  test("the catalog PDF has every public toy, one per page", () => {
    const pdf = fs.readFileSync(path.join(SITE, "splashery-catalog.pdf"));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const text = pdf.toString("latin1");
    const pages = text.match(/\/Type\s*\/Page(?![a-z])/g).length;
    const publicToys = shelfToys.filter((t) => !t.labs).length;
    expect(pages).toBe(publicToys + 1);
    // Small enough to download on a phone.
    expect(pdf.length).toBeLessThan(12e6);
    // The Toys page offers it with the labs switch on.
    expect(read("toys/index.html")).toMatch(/<a class="button" data-labs href="..\/splashery-catalog.pdf" download ?>/); // prettier-ignore
  });
});

// ---- In the browser: a sample -----------------------------------------------------------------

// One public toy from every shelf, a labs toy, the noncommercial scans and a toy that holds still.
const SAMPLE = [
  ...CATEGORIES.map((c) => shelfToys.find((t) => t.category === c.id && !t.labs)).filter(Boolean),
  ...["dog-plush", "cherry-blossom-photo", "sorting-machine"].map((id) => shelfToys.find((t) => t.id === id)), // prettier-ignore
].filter((t, i, a) => t && a.indexOf(t) === i);

function watchConsole(page) {
  const problems = [];
  page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

// The players stay empty, except where a test waits for one: the pages, not the toys, are under test.
async function quietPlayers(page) {
  await page.route(/\/site\/play\/\?/, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>player</title><body data-ready=\"true\">" })); // prettier-ignore
}

test.describe("toy pages (browser)", () => {
  test(`a sample of ${SAMPLE.length} pages loads, fits a phone and links on`, async ({
    browser,
  }) => {
    expect(SAMPLE.length).toBeGreaterThanOrEqual(15);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    const problems = watchConsole(page);
    await quietPlayers(page);
    await page.goto("/site/?labs=0");
    for (const t of SAMPLE) {
      const res = await page.goto(`/site/toys/${t.id}/`);
      expect(res.status(), t.id).toBe(200);
      const h1 = page.locator("h1:visible");
      await expect(h1).toHaveCount(1);
      if (t.labs) {
        await expect(page.locator(".labs-off")).toBeVisible();
        await expect(page.locator("article.toy-page")).toBeHidden();
        expect(await page.locator(".toy-stage iframe").getAttribute("src"), t.id).toBeNull();
        continue;
      }
      await expect(h1).toContainText(t.label);
      await expect(page.locator(".site-header nav a[aria-current='page']")).toHaveText("Toys");
      expect(await page.locator(".toy-stage iframe").getAttribute("src")).toContain(`play/?toy=${t.id}`); // prettier-ignore
      await expect(page.locator("#h-credits")).toBeVisible();
      await expect(page.locator("#snip-iframe")).toHaveValue(new RegExp(`embed/\\?toy=${t.id}`));
      const wide = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(wide, t.id).toBeLessThanOrEqual(390);
      // Related toys open their own pages.
      const rel = page.locator("#h-related ~ .toy-grid a, .toy-section .toy-grid a");
      if (await rel.count()) expect(await rel.first().getAttribute("href")).toMatch(/^\.\.\/\.\.\/toys\/[a-z0-9-]+\/$/); // prettier-ignore
      // Every image has an alt; every button and link a name.
      const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll("img:not([alt]), a[href]:not([aria-label]), button:not([aria-label])")]
          .filter((el) => el.tagName === "IMG" || !el.textContent.trim())
          .map((el) => el.outerHTML.slice(0, 80)),
      ); // prettier-ignore
      expect(unnamed, t.id).toEqual([]);
    }
    expect(problems).toEqual([]);
    await ctx.close();
  });

  test("a labs toy's page shows its toy with the labs switch on", async ({ page }) => {
    await quietPlayers(page);
    await page.goto("/site/toys/dog-plush/?labs=1");
    await expect(page.locator("h1:visible")).toContainText("Dog plush");
    await expect(page.locator(".labs-off")).toBeHidden();
    expect(await page.locator(".toy-stage iframe").getAttribute("src")).toContain("play/?toy=dog-plush"); // prettier-ignore
    await expect(page.locator(".toy-credits")).toContainText("NonCommercial");
    await expect(page.getByRole("link", { name: /Download the catalog/ })).toHaveCount(0);
    await page.goto("/site/toys/");
    await expect(page.getByRole("link", { name: /Download the catalog/ })).toBeVisible();
    await page.goto("/site/toys/?labs=0");
    await expect(page.getByRole("link", { name: /Download the catalog/ })).toBeHidden();
  });

  test("the live toy plays on its page, and the copy buttons copy", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] }); // prettier-ignore
    const page = await ctx.newPage();
    const problems = watchConsole(page);
    await page.goto("/site/toys/grape/");
    const frame = page.frameLocator(".toy-stage iframe");
    await frame.locator("body[data-ready='true']").waitFor({ timeout: 180_000 });
    await expect(page.locator(".toy-stage .stage")).toHaveClass(/ready/);
    // The player opens the toy in the gallery.
    expect(await frame.locator("#open-link").getAttribute("href")).toContain("#s=j.");
    await page.getByRole("button", { name: "Copy" }).nth(1).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('src="https://ryanjosephkamp.github.io/splashery/embed/?toy=grape"');
    // The gallery button opens the grape.
    const open = await page.getByRole("link", { name: "Open in the gallery" }).getAttribute("href");
    await page.goto(new URL(open, page.url()).href.replace("/#", "/?renderer=webgl2#"));
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    expect(await page.evaluate(() => window.__splashery.player.scene.toy.id)).toBe("grape");
    expect(problems.filter((p) => !/WebGPU/.test(p))).toEqual([]);
    await ctx.close();
  });

  test("screenshots: two toy pages at both sizes", async ({ browser }) => {
    for (const [id, name] of [
      ["grape", "grape"],
      ["sorting-machine", "sorting"],
    ]) {
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
        await page.screenshot({ path: path.join(SHOTS, `tpg-${name}-${w}x${h}.png`) });
        await ctx.close();
      }
    }
  });
});
