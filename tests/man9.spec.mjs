// Manual r9: the link rule (same tab inside the manual, new tab outside it), the five new demos, the
// Chapter 9 picture row, the "more" page's new pictures, the clickable PDF contents and bookmarks,
// and the owner's wording.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFHexString,
} from "../vendor/pdf-lib/pdf-lib.esm.min.js";

const read = (f) => fs.readFileSync(`manual/${f}`, "utf8");
const PAGES = fs.readdirSync("manual").filter((f) => f.endsWith(".html"));
const INSIDE = /^(?:#.*|[a-z0-9-]+\.html(?:#.*)?)$/;

test.describe("the link rule", () => {
  test("a link inside the manual has no target; one that leaves it opens a new tab", () => {
    const bad = [];
    for (const f of PAGES)
      for (const m of read(f).matchAll(/<a\s([^>]*?)>/g)) {
        const href = /\bhref="([^"]*)"/.exec(m[1])?.[1];
        if (!href) continue;
        const blank = /target="_blank"/.test(m[1]) && /rel="[^"]*noopener/.test(m[1]);
        if (INSIDE.test(href) ? /target=/.test(m[1]) : !blank)
          bad.push(`${f}: ${href.slice(0, 50)}`);
      }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  test("the chrome and the runtime pieces follow it (pager, contents, glossary pop-up, railroad)", async ({
    page,
  }) => {
    await page.goto("/manual/toy.html");
    await expect(page.locator('nav a[href="language.html"]').first()).not.toHaveAttribute("target", /.+/); // prettier-ignore
    await expect(page.locator('#manual-contents a[href="language.html"]')).not.toHaveAttribute("target", /.+/); // prettier-ignore
    expect(read("fold.js")).not.toMatch(/_blank/);
    expect(read("railroad.js")).not.toMatch(/_blank/);
    // The cover's link out to the Playground opens a new tab.
    await page.goto("/manual/index.html");
    await expect(page.locator(".cover a[href='../']").first()).toHaveAttribute("target", "_blank");
    // A chapter link stays in the tab: same page object, new address, no popup.
    await page.goto("/manual/toy.html");
    let popup = false;
    page.context().on("page", () => (popup = true));
    await page.evaluate(() => document.querySelector('nav a[href="language.html"]').click());
    await page.waitForURL(/language\.html/);
    expect(popup).toBe(false);
  });
});

test.describe("the five demos", () => {
  test("no placeholder is left, and each demo has its print still", async ({ page }) => {
    for (const f of PAGES) expect(read(f), f).not.toContain("demo-placeholder");
    await page.goto("/manual/all.html");
    for (const d of ["moving-joints", "photo-depth", "data-table", "qr-damage", "splat-file"]) {
      await expect(page.locator(`section.demo-live[data-demo="${d}"]`)).toHaveCount(1);
      const still = page.locator(`figure.demo-still[data-demo-still="${d}"] img`);
      await expect(still).toHaveCount(1);
      expect(await still.evaluate((i) => i.complete && i.naturalWidth > 300), d).toBe(true);
      expect((await still.getAttribute("alt")).length).toBeGreaterThan(40);
    }
  });

  test("the hinge, slider, and dial each move by one number (touch and sliders)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/manual/moving.html");
    const cv = page.locator("#mj-canvas");
    await page.locator("#mj-slide").fill("0");
    await cv.scrollIntoViewIfNeeded();
    const box = await cv.boundingBox();
    const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
    // The slider part: drag the blade up.
    await page.mouse.move(...at(0.5, 0.6));
    await page.mouse.down();
    await page.mouse.move(...at(0.5, 0.3), { steps: 6 });
    await page.mouse.up();
    expect(Number(await page.locator("#mj-slide").inputValue())).toBeGreaterThan(0.1);
    await expect(page.locator("#mj-slide-out")).toHaveText(/0\.\d\d/);
    // The hinge: drag the lid up, and see a number beside it.
    await page.mouse.move(...at(0.2, 0.62));
    await page.mouse.down();
    await page.mouse.move(...at(0.1, 0.35), { steps: 6 });
    expect(parseInt(await page.locator("#mj-hinge-out").textContent())).toBeGreaterThan(40);
    await page.mouse.up();
    // It falls by its weight and rests on its stop.
    await expect(page.locator("#mj-hinge-out")).toHaveText("0°", { timeout: 6000 });
    // The dial turns round and round (more than one turn).
    await page.mouse.move(...at(0.85, 0.3));
    await page.mouse.down();
    for (let a = 0; a < 14; a += 1) {
      const t = (a / 14) * Math.PI * 2 * 1.5;
      await page.mouse.move(...at(0.835 + 0.1 * Math.cos(t), 0.49 + 0.19 * Math.sin(t)));
    }
    await page.mouse.up();
    expect(Math.abs(parseFloat(await page.locator("#mj-dial-out").textContent()))).toBeGreaterThan(
      1,
    );
  });

  test("with reduced motion the lid stays where it is let go", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/manual/moving.html");
    await page.locator("#mj-hinge").fill("60");
    await page.waitForTimeout(900);
    await expect(page.locator("#mj-hinge-out")).toHaveText("60°");
    await ctx.close();
  });

  test("the QR demo counts codewords lost against the ones that can be repaired", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/manual/codes.html");
    const cv = page.locator("#qd-canvas");
    await cv.scrollIntoViewIfNeeded();
    await expect(page.locator("#qd-verdict")).toContainText("Untouched");
    await expect(page.locator(".qd-block")).toHaveCount(2); // level M, version 4
    await page.click("#qd-scatter");
    await expect(page.locator("#qd-verdict")).toContainText("still scans");
    const lost = await page.locator(".qd-nums").first().textContent();
    expect(lost).toMatch(/^\d+ lost of 9$/);
    // Scratch across the middle with a finger-sized brush until it fails.
    const box = await cv.boundingBox();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
    await page.mouse.down();
    for (let i = 0; i <= 30; i++)
      await page.mouse.move(
        box.x + box.width * (0.2 + i * 0.02),
        box.y + box.height * (0.45 + (i % 3) * 0.04),
      );
    await page.mouse.up();
    await expect(page.locator("#qd-verdict")).toContainText(/will not scan|cannot|badly/);
    await page.click("#qd-clear");
    await expect(page.locator("#qd-verdict")).toContainText("Untouched");
    await page.selectOption("#qd-level", "H");
    await expect(page.locator(".qd-block")).toHaveCount(4);
    // Repair puts back what error correction can.
    await page.click("#qd-scatter");
    await page.click("#qd-heal");
    await expect(page.locator("#qd-summary")).toContainText("Lost now: 0 of");
  });

  test("the table demo: a number changes its splat, and rows come and go", async ({ page }) => {
    await page.goto("/manual/data.html");
    await expect(page.locator("#dt-rows tr")).toHaveCount(4);
    const before = await page.locator("#dt-canvas").evaluate((c) => c.toDataURL());
    await page.locator('input[aria-label="Row a, x"]').fill("-0.6");
    await expect(page.locator("#dt-read")).toContainText("center (-0.6");
    expect(await page.locator("#dt-canvas").evaluate((c) => c.toDataURL())).not.toBe(before);
    await page.click("#dt-add");
    await expect(page.locator("#dt-rows tr")).toHaveCount(5);
    await page.click("#dt-remove");
    await page.click("#dt-remove");
    await expect(page.locator("#dt-rows tr")).toHaveCount(3);
  });

  test("the splat file demo: the box and the filter change the counts", async ({ page }) => {
    await page.goto("/manual/make.html");
    const counts = page.locator("#sf-counts");
    await expect(counts).toContainText("In the file: 420 splats");
    const num = async (label) =>
      Number(new RegExp(`${label}: (\\d+)`).exec(await counts.textContent())[1]);
    const kept = await num("Kept");
    await page.locator("#sf-size").fill("0.4");
    expect(await num("Inside the box")).toBeLessThan(kept);
    await page.locator("#sf-reset").click();
    expect(await num("Floaters removed")).toBeGreaterThan(0);
    await page.locator("#sf-floaters").uncheck();
    expect(await num("Floaters removed")).toBe(0);
    await expect(counts).toContainText("× 32 bytes");
  });

  test("the depth demo: at zero depth both views are the flat picture; with depth they differ", async ({
    page,
  }) => {
    await page.goto("/manual/photo3d.html");
    const url = (id) => page.locator(id).evaluate((c) => c.toDataURL());
    await page.locator("#pd-depth").fill("0");
    const flat = await url("#pd-layers");
    await page.locator("#pd-turn").fill("-0.5");
    expect(await url("#pd-layers")).toBe(flat); // no depth: turning changes nothing
    await page.locator("#pd-depth").fill("1");
    await page.locator("#pd-turn").fill("0.9");
    expect(await url("#pd-layers")).not.toBe(flat);
    expect(await url("#pd-sharp")).not.toBe(await url("#pd-layers"));
  });

  test("every new canvas is sharp at a pixel ratio of 3 and nothing needs the network", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      deviceScaleFactor: 3,
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    const external = [];
    page.on("request", (r) => !r.url().startsWith("http://127.0.0.1") && !r.url().startsWith("data:") && external.push(r.url())); // prettier-ignore
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const [f, ids] of [
      ["moving", ["mj-canvas"]],
      ["photo3d", ["pd-layers", "pd-sharp"]],
      ["data", ["dt-canvas"]],
      ["codes", ["qd-canvas"]],
      ["make", ["sf-canvas"]],
    ]) {
      await page.goto(`/manual/${f}.html`);
      for (const id of ids) {
        const c = page.locator(`#${id}`);
        await c.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        const [cssW, backing] = await c.evaluate((e) => [e.clientWidth, Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "width").get.call(e)]); // prettier-ignore
        expect(backing, id).toBeGreaterThanOrEqual(Math.round(cssW * 3) - 1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0); // prettier-ignore
      }
    }
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await ctx.close();
  });
});

test.describe("layout", () => {
  for (const [w, h, stacked] of [
    [1440, 900, false],
    [390, 844, true],
  ]) {
    test(`Chapter 9's two QR codes are the same size, aligned (${w}px wide)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/manual/codes.html");
      const imgs = page.locator(".shots.even img");
      await expect(imgs).toHaveCount(2);
      for (const i of await imgs.all()) {
        await i.scrollIntoViewIfNeeded();
        await expect.poll(() => i.evaluate((e) => e.complete)).toBe(true);
      }
      const [a, b] = await Promise.all([imgs.nth(0).boundingBox(), imgs.nth(1).boundingBox()]);
      expect(Math.abs(a.width - b.width)).toBeLessThan(1);
      expect(Math.abs(a.height - b.height)).toBeLessThan(1);
      if (stacked) {
        expect(Math.abs(a.x - b.x)).toBeLessThan(1);
        expect(b.y).toBeGreaterThan(a.y + a.height - 1);
      } else expect(Math.abs(a.y - b.y)).toBeLessThan(1);
    });
  }

  test("the more page has more pictures, each with alt text and under 150 KB", async ({ page }) => {
    await page.goto("/manual/more.html");
    const imgs = await page.locator("figure.item-pic img").evaluateAll((l) => l.map((i) => ({ src: i.getAttribute("src"), alt: i.alt }))); // prettier-ignore
    expect(imgs.length).toBeGreaterThanOrEqual(15);
    for (const n of ["bonsai", "damage", "flames", "body"]) expect(imgs.some((i) => i.src.includes(`pic-more-${n}`))).toBe(true); // prettier-ignore
    for (const i of imgs) {
      expect(i.alt.length, i.src).toBeGreaterThan(30);
      expect(fs.statSync(`manual/${i.src}`).size, i.src).toBeLessThan(150_000);
    }
  });
});

test.describe("the owner's wording", () => {
  test("the opening says 'not entirely', with a colon and the two exceptions as a list", () => {
    for (const f of ["index.html", "all.html"]) {
      const t = read(f).replace(/\s+/g, " ");
      expect(t, f).toContain(
        "primarily splat based, but not entirely. Two honest exceptions:</p> <ul>",
      );
      expect(t, f).not.toContain("but not only");
    }
    const cover = read("index.html");
    expect(
      (/Two honest exceptions:[\s\S]*?<\/ul>/.exec(cover)[0].match(/<li>/g) || []).length,
    ).toBe(2);
    for (const f of ["built.html", "photo3d.html"]) expect(read(f), f).toMatch(/not entirely/);
    expect(read("built.html")).not.toMatch(/splat based<\/b>, not only/);
    expect(read("photo3d.html")).not.toMatch(/not only splat-based/);
  });
  test("Chapter 1 no longer says 'Do not mix them up'", () => {
    for (const f of ["splat.html", "all.html"]) expect(read(f), f).not.toMatch(/Do not mix/);
    expect(read("splat.html")).toContain("Three ways splats come to exist</b> (Figure 1):");
  });
});

test.describe("the PDF", () => {
  const load = async () => PDFDocument.load(fs.readFileSync("manual/tinkerers-manual.pdf"), { updateMetadata: false }); // prettier-ignore

  test("every link to a place carries its own destination, and the contents link to their chapters", async () => {
    const doc = await load();
    let links = 0;
    let named = 0;
    const toPages = new Set();
    const pageIndex = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i]));
    doc.getPages().forEach((p, pi) => {
      const annots = p.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
      if (!annots) return;
      for (let i = 0; i < annots.size(); i++) {
        const a = annots.lookup(i, PDFDict);
        const d = a.get(PDFName.of("Dest"));
        if (!d) continue;
        if (!(d instanceof PDFArray)) named++;
        else {
          links++;
          if (pi >= 1 && pi <= 3) toPages.add(pageIndex.get(d.get(0).toString()));
        }
      }
    });
    expect(named).toBe(0);
    expect(links).toBeGreaterThan(100);
    // The contents (pages 2 to 4) lead to many different pages.
    expect(toPages.size).toBeGreaterThan(40);
    expect(doc.catalog.lookup(PDFName.of("Names"), PDFDict).get(PDFName.of("Dests"))).toBeTruthy();
  });

  test("the bookmarks list the chapters, with clean titles", async () => {
    const doc = await load();
    const outlines = doc.catalog.lookup(PDFName.of("Outlines"), PDFDict);
    const titles = [];
    for (let ref = outlines.get(PDFName.of("First")); ref; ) {
      const it = doc.context.lookup(ref, PDFDict);
      const t = it.lookup(PDFName.of("Title"));
      titles.push(t instanceof PDFHexString ? t.decodeText() : t.decodeText());
      ref = it.get(PDFName.of("Next"));
    }
    expect(titles[0]).toBe("Cover and contents");
    expect(titles).toContain("Chapter 1: What a splat is");
    expect(titles).toContain("Chapter 10: Make your own");
    expect(titles).toContain("Glossary");
    expect(titles.filter((t) => /^Chapter \d+/.test(t))).toHaveLength(10);
    for (const t of titles) {
      const h = t.length >> 1;
      expect(t.length > 6 && t.slice(0, h) === t.slice(h), `doubled: ${t}`).toBe(false);
    }
    expect(doc.catalog.get(PDFName.of("PageMode"))?.toString()).toBe("/UseOutlines");
  });

  test("the PDF is well formed: it loads, and every page can be read", async () => {
    const doc = await load();
    expect(doc.getPageCount()).toBeGreaterThan(140);
    const bytes = fs.readFileSync("manual/tinkerers-manual.pdf");
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.subarray(-1024).toString("latin1")).toContain("%%EOF");
    expect(bytes.length).toBeLessThan(8e6);
  });
});

test.describe("screenshots", () => {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    test(`the new demos at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      for (const [f, sel, name] of [
        ["moving", "#demo-joints", "joints"],
        ["photo3d", "#demo-depth", "depth"],
        ["data", "#demo-table", "table"],
        ["codes", "#demo-qr", "qr"],
        ["make", "#demo-file", "file"],
        ["codes", ".shots.even", "qr-row"],
      ]) {
        await page.goto(`/manual/${f}.html`);
        const el = page.locator(sel);
        await el.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await el.screenshot({ path: `tests/screenshots/man9-${name}-${w}x${h}.png` });
      }
    });
  }
});
