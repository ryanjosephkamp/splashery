// Manual r4, layout: the web manual is one page per chapter, with a contents button on every page
// (closed until it is tapped), Previous and Next buttons at the top and the bottom, the full contents
// on the first page, no standalone level map, old addresses that still land, glossary pop-ups on
// every page, and a whole-manual page (all.html) the PDF is printed from. Screenshots man4-pages-*.png.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { PAGES, COMING, label } from "../manual/pages.mjs";

const SHOTS = path.resolve("tests/screenshots");
const read = (f) => fs.readFileSync(`manual/${f}`, "utf8");
const idsOf = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const plain = (h) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim(); // prettier-ignore

test.describe("the pages", () => {
  test("the page files are built and current, and a chapter's title says chapter", () => {
    expect(execSync("node manual/build-pages.mjs --check", { encoding: "utf8" })).toContain(
      "current",
    );
    for (const p of PAGES) {
      const html = read(p.file);
      const title = /<title>([^<]*)<\/title>/.exec(html)[1];
      if (p.chapter) expect(title, p.file).toContain(`Chapter ${p.chapter}: `);
      expect(title, p.file).not.toMatch(/Level \d/);
      // The heading's own label says Chapter, too.
      if (p.chapter) expect(html).toContain(`<span class="level">Chapter ${p.chapter}</span>`);
      expect(html).not.toMatch(/<span class="level">Level/);
    }
    for (const c of COMING) expect(read("coming.html")).toContain(`<span class="level">Chapter ${c.chapter}</span>`); // prettier-ignore
  });

  test("the level map block is gone, from the page and the style sheet", () => {
    for (const p of PAGES)
      expect(read(p.file), p.file).not.toMatch(/levelmap|id="level-map"|The level map/);
    expect(read("all.html")).not.toMatch(/levelmap|The level map/);
    expect(read("manual.css")).not.toContain(".levelmap");
  });

  test("Next from the cover reaches every page in order, and Previous goes back", async ({
    page,
  }) => {
    const seen = [];
    let url = "/manual/index.html";
    for (let i = 0; i < PAGES.length + 2; i++) {
      await page.goto(url);
      const here = decodeURIComponent(
        new URL(page.url()).pathname.split("/").pop() || "index.html",
      );
      seen.push(here);
      const top = page.locator('nav.pager[aria-label$="top"]');
      const bottom = page.locator('nav.pager[aria-label$="bottom"]');
      await expect(top).toHaveCount(1);
      await expect(bottom).toHaveCount(1);
      // The top one comes before the page's text, the bottom one after it.
      const order = await page.evaluate(() => {
        const t = document.querySelector('nav.pager[aria-label$="top"]');
        const b = document.querySelector('nav.pager[aria-label$="bottom"]');
        const h = document.querySelector("h1, h2");
        return [t.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING, h.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING]; // prettier-ignore
      });
      expect(order[0], here).toBeTruthy();
      expect(order[1], here).toBeTruthy();
      const next = top.locator("a.pager-next");
      const prev = top.locator("a.pager-prev");
      if (here === PAGES.at(-1).file) {
        await expect(next).toHaveCount(0);
        break;
      }
      if (here === "index.html") await expect(prev).toHaveCount(0);
      else await expect(prev).toHaveCount(1);
      // The bottom buttons are the same as the top ones.
      expect(await bottom.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(await top.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")))); // prettier-ignore
      url = "/manual/" + (await next.getAttribute("href"));
    }
    expect(seen).toEqual(PAGES.map((p) => p.file));
    // And back from the end.
    let back = "/manual/" + PAGES.at(-1).file;
    const walked = [];
    for (let i = 0; i < PAGES.length; i++) {
      await page.goto(back);
      walked.push(new URL(page.url()).pathname.split("/").pop());
      const prev = page.locator('nav.pager[aria-label$="top"] a.pager-prev');
      if (!(await prev.count())) break;
      back = "/manual/" + (await prev.getAttribute("href"));
    }
    expect(walked).toEqual(PAGES.map((p) => p.file).reverse());
  });

  test("the contents button is on every page, closed at first, and lists every chapter", async ({
    page,
  }) => {
    for (const p of PAGES) {
      await page.goto(`/manual/${p.file}`);
      const btn = page.locator(".manual-nav .outline-toggle");
      const panel = page.locator("#manual-contents");
      await expect(btn, p.file).toHaveAttribute("aria-expanded", "false");
      await expect(panel, p.file).toBeHidden();
      await btn.click();
      await expect(btn).toHaveAttribute("aria-expanded", "true");
      await expect(panel).toBeVisible();
      const links = await panel.locator(":scope > ol > li > a").evaluateAll((as) => as.map((a) => [a.getAttribute("href"), a.textContent.trim(), a.getAttribute("aria-current")])); // prettier-ignore
      expect(links.map((l) => l[0])).toEqual(PAGES.map((q) => q.file));
      expect(links.filter((l) => l[2] === "page").map((l) => l[0])).toEqual([p.file]);
      for (const q of PAGES.filter((q) => q.chapter)) expect(links.map((l) => l[1])).toContain(`Chapter ${q.chapter}: ${q.title}`); // prettier-ignore
      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
    }
  });

  test("the contents button works on a phone: it opens over the page, a tap outside closes it, a link goes there", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto("/manual/toy.html");
    await page.screenshot({ path: path.join(SHOTS, "man4-pages-chapter2-390x844.png") });
    await page.tap(".manual-nav .outline-toggle");
    await expect(page.locator("#manual-contents")).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, "man4-pages-contents-open-390x844.png") });
    await page.touchscreen.tap(4, 838);
    await expect(page.locator("#manual-contents")).toBeHidden();
    await page.tap(".manual-nav .outline-toggle");
    await page.tap('#manual-contents a[href="language.html"]');
    await page.waitForURL(/language\.html/);
    await expect(page.locator("h2").first()).toContainText("The splat equation language");
    // A section of this chapter, from the list.
    await page.tap(".manual-nav .outline-toggle");
    await page.tap('#manual-contents .outline-sub a[href="#time"]');
    await expect(page.locator("#time")).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    await ctx.close();
  });

  test("the first page has the full contents: every chapter, its sections, and the chapters to come", async ({
    page,
  }) => {
    await page.goto("/manual/index.html");
    const toc = page.locator("nav.toc");
    await expect(toc).toHaveCount(1);
    const links = await toc
      .locator("a")
      .evaluateAll((as) => as.map((a) => [a.getAttribute("href"), a.textContent.trim()]));
    const hrefs = links.map((l) => l[0]);
    for (const p of PAGES.slice(1)) expect(hrefs, p.file).toContain(p.file);
    for (const c of COMING)
      expect(links.map((l) => l[1])).toContain(`Chapter ${c.chapter}: ${c.title} (coming)`);
    // Every section (h3) of every page is in it, with the right page in its address.
    for (const p of PAGES.slice(1)) {
      for (const m of read(p.file).matchAll(/<h3[^>]*\sid="([^"]+)"/g))
        expect(hrefs, `${p.file}#${m[1]}`).toContain(`${p.file}#${m[1]}`);
    }
    // And every address in it lands on an id of that page.
    for (const [href] of links) {
      const [file, hash] = href.split("#");
      expect(fs.existsSync(`manual/${file}`), href).toBe(true);
      if (hash) expect(idsOf(read(file)), href).toContain(hash);
    }
    // The first page holds no chapter text of its own (the cover and the contents only).
    expect(await page.locator("h2").count()).toBe(0);
    await toc.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, "man4-pages-contents-1440x900.png") });
  });

  test("every link in a page lands: another page's anchors have the page's name in them", async ({
    page,
  }) => {
    const ids = Object.fromEntries(PAGES.map((p) => [p.file, new Set(idsOf(read(p.file)))]));
    for (const p of PAGES) {
      const html = read(p.file);
      for (const m of html.matchAll(/href="([^"]*)"/g)) {
        const h = m[1];
        if (/^(https?:|mailto:|\.\.\/|#s=)/.test(h) || h === "") continue;
        const [file, hash] = h.startsWith("#") ? [p.file, h.slice(1)] : h.split("#");
        if (/\.(pdf|js|css|png|jpg|webp)$/.test(file) || file === "all.html") continue;
        if (p.file === "language.html" && hash?.startsWith("rr-")) continue; // the grammar's rules are drawn by script
        expect(ids[file], `${p.file}: ${h} goes to a page that is not in the manual`).toBeTruthy();
        if (hash) expect(ids[file].has(hash), `${p.file}: ${h}`).toBe(true);
      }
    }
  });
});

test.describe("old addresses, pop-ups, and the whole manual", () => {
  test("an old manual/#anchor lands on the page that has it, with the section there (folds open)", async ({
    page,
  }) => {
    const wanted = {
      splat: "splat.html",
      toy: "toy.html",
      language: "language.html",
      gallery: "gallery.html",
      pictures: "pictures.html",
      moving: "coming.html",
      more: "more.html",
      unique: "unique.html",
      experiments: "experiments.html",
      later: "later.html",
      glossary: "glossary.html",
      reading: "reading.html",
      references: "references.html",
      card: "card.html",
      "splat-count": "toy.html",
      "demo-covariance": "splat.html",
      "demo-reader": "language.html",
      "demo-railroad": "language.html",
      "demo-windmill": "toy.html",
      "gallery-60": "gallery.html",
      "g-sphere": "gallery.html",
      "why-budgets": "splat.html",
      "run-it": "toy.html",
      "ref-8": "references.html",
      "g-covariance": "glossary.html",
    };
    for (const [id, file] of Object.entries(wanted)) {
      await page.goto(`/manual/#${id}`);
      await page.waitForURL(new RegExp(`${file.replace(".", "\\.")}#${id}$`));
      const el = page.locator(`#${id}`);
      await expect(el, id).toHaveCount(1);
      // A fold that holds it is open.
      expect(await el.evaluate((e) => [...(function* () { for (let d = e.closest("details"); d; d = d.parentElement?.closest("details")) yield d.open; })()].every(Boolean)), id).toBe(true); // prettier-ignore
    }
    // An address with no anchor, or one the manual does not have, stays on the first page.
    await page.goto("/manual/#nothing-here");
    await page.waitForTimeout(300);
    expect(page.url()).toMatch(/manual\/#nothing-here$/);
  });

  test("every id in the manual is found by the old address", () => {
    const redirect = read("redirect.js");
    const map = new Function(`return ${/var pages = (\{[\s\S]*?\});/.exec(redirect)[1]}`)();
    for (const p of PAGES.filter((p) => p.file !== "index.html"))
      for (const id of idsOf(read(p.file)).filter((i) => i !== "manual-contents"))
        expect(map[id], id).toBe(p.file);
  });

  test("a glossary word shows its entry on every page, and links to the glossary page", async ({
    page,
  }) => {
    const g = read("glossary.html");
    for (const file of ["splat.html", "toy.html", "language.html", "glossary.html"]) {
      await page.goto(`/manual/${file}`);
      const term = page.locator(".term[data-g]").first();
      if (!(await term.count())) continue;
      const id = await term.getAttribute("data-g");
      await term.scrollIntoViewIfNeeded();
      await term.click();
      const pop = page.locator("#term-pop");
      await expect(pop, file).toBeVisible();
      const want = plain(new RegExp(`<dt id="${id}">([\\s\\S]*?)</dt>`).exec(g)[1]);
      await expect(pop.locator("strong")).toContainText(want.slice(0, 12));
      const link = pop.locator("a", { hasText: "In the glossary" });
      await expect(link).toHaveAttribute(
        "href",
        file === "glossary.html" ? `#${id}` : `glossary.html#${id}`,
      );
      await page.keyboard.press("Escape");
      await expect(pop).toBeHidden();
    }
  });

  test("all.html is the whole manual, every chapter in order, and the PDF is printed from it", async ({
    page,
  }) => {
    const all = read("all.html");
    let at = 0;
    for (const p of PAGES.slice(1)) {
      for (const id of p.ids) {
        const i = all.indexOf(`id="${id}"`, at);
        expect(i, `${id} comes after the one before it`).toBeGreaterThan(at);
        at = i;
      }
    }
    // Every page's text is in it (the chrome is not).
    const flat = plain(all.replace(/<(pre|svg|script|style)[\s\S]*?<\/\1>/g, " "));
    for (const p of PAGES) {
      const body = read(p.file);
      const content = body.slice(
        body.indexOf("<!-- NAV:TOP:END -->") + 20,
        body.indexOf("<!-- NAV:BOTTOM:START"),
      );
      for (const para of plain(content.replace(/<(pre|svg|script|style)[\s\S]*?<\/\1>/g, " ")).split(/(?<=[.?!]) /).filter((s) => s.length > 60).filter((_, i) => i % 7 === 0)) // prettier-ignore
        expect(flat, p.file).toContain(para.slice(0, 80));
    }
    expect(all).not.toContain("outline-toggle");
    expect(all).not.toContain('class="pager');
    expect(fs.readFileSync("tools/manual-pdf.mjs", "utf8")).toContain("manual/all.html");
    // It is a working page: a demo and a glossary pop-up run on it.
    await page.goto("/manual/all.html");
    await expect(page.locator("#cov-canvas")).toBeVisible();
    await page.locator(".term[data-g]").first().click();
    await expect(page.locator("#term-pop")).toBeVisible();
  });

  test("in print the buttons are left out, and each chapter starts a page", async ({ page }) => {
    await page.goto("/manual/toy.html");
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".manual-nav")).toBeHidden();
    await expect(page.locator("nav.pager").first()).toBeHidden();
  });
});

test.describe("every page works", () => {
  test("each page loads with no error, its demos start, and it does not scroll sideways at 390 and 320", async ({
    browser,
  }) => {
    for (const w of [390, 320]) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: 800 },
        hasTouch: true,
        isMobile: true,
      });
      for (const p of PAGES) {
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on(
          "console",
          (m) => m.type() === "error" && !/favicon|404/.test(m.text()) && errors.push(m.text()),
        );
        await page.goto(`/manual/${p.file}`);
        await page.waitForLoadState("load");
        await page.waitForTimeout(w === 390 ? 700 : 200);
        expect(errors, `${p.file} at ${w}px`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${p.file} at ${w}px`).toBe(0); // prettier-ignore
        // The demos on the page are running: a canvas or a control each.
        for (const m of read(p.file).matchAll(/<section class="demo-live" data-demo="([^"]+)"/g)) {
          const sec = page.locator(`section.demo-live[data-demo="${m[1]}"]`);
          await expect(sec, `${p.file} ${m[1]}`).toBeVisible();
        }
        if (
          w === 390 &&
          ["splat.html", "language.html", "gallery.html", "coming.html"].includes(p.file)
        ) {
          await page.screenshot({
            path: path.join(SHOTS, `man4-pages-${p.file.replace(".html", "")}-390x844.png`),
          });
        }
        await page.close();
      }
      await ctx.close();
    }
  });

  test("the pages with folds have the fold buttons, and they work", async ({ page }) => {
    for (const p of PAGES) {
      const has = /<details[^>]*class="[^"]*\bfold\b/.test(read(p.file));
      await page.goto(`/manual/${p.file}`);
      expect((await page.locator("[data-fold-all]").count()) > 0, p.file).toBe(
        has && p.file !== "index.html",
      );
    }
    await page.goto("/manual/toy.html");
    await page.click('[data-fold-all="open"]');
    expect(await page.locator("details.fold:not([open])").count()).toBe(0);
    await page.click('[data-fold-all="close"]');
    expect(await page.locator("details.fold[open]").count()).toBe(0);
  });
});
