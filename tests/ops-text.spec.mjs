// The Operator's engine change for the owner's question of September 29,
// 2026 (how a text layer works for documents shown as splats): a PDF toy's
// Toy tab keeps the real words of the page on show, to read, select, copy
// and find (src/ui.js, "Words on the page"), from pics.text(n)
// (src/pictures.js) and a PDF's m.text(i) (src/media.js).

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

async function ready(page) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

// Waits until every sheet shows (or holds) the page the toy asked for.
async function waitSheets(page) {
  await page.waitForFunction(
    () => {
      const p = window.__splashery.player.pictures;
      if (!p?.media) return false;
      window.__splashery.player.stage.requestRender();
      return p.sheets.every((s) => !s.want || s.shown?.key === s.want.key) && p.splats() > 0;
    },
    null,
    { timeout: 120_000 },
  );
}

// The toy's media, once it shows (kind), or null.
const kindNow = (page) =>
  page.evaluate(() => {
    const p = window.__splashery.player.pictures;
    return p?.media && p.info().kind ? p.media.kind : null;
  });

test.describe("a PDF's words in the Toy tab", () => {
  test.setTimeout(300_000);
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("your book: the words of the page on show, following the pages, copied and found", async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("your-book"));
    await page.click("#tab-play");
    const box = page.locator("#toy-media-text-box");
    await expect(box).toBeVisible({ timeout: 120_000 });
    await expect(box.locator("summary")).toHaveText("Words on this page");
    // The words are read only once the box is open.
    const words = page.locator("#toy-media-text");
    await expect(words).toHaveText("Reading the page…");
    await box.locator("summary").click();
    await expect(words).toHaveAttribute("aria-label", "Words on page 1");
    await expect(words).toHaveAttribute("tabindex", "0");
    await expect(words).toContainText("The Tinkerer's Manual");
    await expect(words).toContainText("Every toy in Splashery is made of Gaussian splats");
    // Lines join into paragraphs, and the contents list keeps its items.
    await expect(words.locator("p", { hasText: /^Contents$/ })).toHaveCount(1);
    await expect(words.locator("p", { hasText: /^1\. Level 1: What a splat is$/ })).toHaveCount(1);
    // Selectable, like any text on a page.
    expect(await words.evaluate((el) => getComputedStyle(el).userSelect)).toBe("text");

    // Next: the box follows the page.
    await page.click("#toy-media-next");
    await expect(words).toHaveAttribute("aria-label", "Words on page 2");
    await expect(words).toContainText("What a splat is");
    await expect(words).not.toContainText("Every toy in Splashery is made of Gaussian splats");
    expect(await page.evaluate(() => window.__splashery.player.pictures.page)).toBe(1);

    // Copy puts the page's words on the clipboard.
    const copy = page.locator("#toy-media-copy");
    await expect(copy).toBeVisible();
    await copy.click();
    await expect(copy).toHaveText("Copied");
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain("A splat is a small cloud of color floating in space.");
    expect(clip).toContain("\n\n"); // paragraphs apart
    await expect(copy).toHaveText("Copy", { timeout: 5000 });

    // The same words from the pictures API a recipe sees.
    const api = await page.evaluate(async () => {
      const pics = window.__splashery.player.pictures.api;
      return { one: await pics.text(0), out: await pics.text(999) };
    });
    expect(api.one).toContain("The Tinkerer's Manual");
    expect(api.out).toBe("");

    // Find: a word on a later page, whatever its case. The results name
    // their pages; one goes there, with the word marked.
    const expected = await page.evaluate(async () => {
      const pics = window.__splashery.player.pictures.api;
      const on = [];
      for (let n = 0; n < pics.count; n++) if (/trefoil/i.test(await pics.text(n))) on.push(n);
      return on;
    });
    expect(expected.length).toBeGreaterThan(0);
    const target = expected[0];
    expect(target).toBeGreaterThan(1);
    await page.fill("#toy-media-find", "TREFOIL");
    await page.click("#toy-media-find-go");
    const note = page.locator("#toy-media-find-note");
    await expect(note).toHaveText(/^Found \d+ match(es)? on \d+ pages?\.$/);
    const hits = page.locator("#toy-media-found li button");
    await expect(hits.first()).toContainText(`Page ${target + 1}:`);
    await expect(hits.first().locator("mark")).toHaveText(/^trefoil$/i);
    await hits.first().click();
    await expect(words).toHaveAttribute("aria-label", `Words on page ${target + 1}`);
    await expect(words.locator("mark").first()).toHaveText(/^trefoil$/i);
    await expect(page.locator("#toy-media-now")).toContainText(`page ${target + 1} of`);
    expect(await page.evaluate(() => window.__splashery.player.pictures.page)).toBe(target);

    // Words that aren't there.
    await page.fill("#toy-media-find", "zebra crossing");
    await page.click("#toy-media-find-go");
    await expect(note).toHaveText("No matches.");
    await expect(page.locator("#toy-media-found")).toBeHidden();
  });

  test("a page with no text layer (like a scan) says so", async ({ page }) => {
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("your-book"));
    await page.click("#tab-play");
    await expect(page.locator("#toy-media-text-box")).toBeVisible({ timeout: 120_000 });
    // A one-page PDF with nothing written on it.
    await page.evaluate(async () => {
      const pdf = [
        "%PDF-1.4",
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
        "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] >> endobj",
        "trailer << /Root 1 0 R >>",
        "%%EOF",
      ].join("\n");
      const file = new File([pdf], "blank.pdf", { type: "application/pdf" });
      await window.__splashery.app.openMedia(file);
    });
    const box = page.locator("#toy-media-text-box");
    await expect(box).toBeVisible({ timeout: 120_000 });
    if (!(await box.evaluate((el) => el.open))) await box.locator("summary").click();
    await expect(page.locator("#toy-media-text")).toHaveText(
      "This page has no text layer (it may be a scan), so there are no words to show.",
    );
    await expect(page.locator("#toy-media-copy")).toBeDisabled();
  });

  test("picture lab: the box shows for its article, not for its photo", async ({ page }) => {
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await page.click("#tab-play");
    const box = page.locator("#toy-media-text-box");
    await expect(box).toBeVisible({ timeout: 120_000 });
    await page.evaluate(() => window.__splashery.app.setToyOption("sample", "photo"));
    await expect.poll(() => kindNow(page), { timeout: 120_000 }).toBe("image");
    await expect(page.locator("#toy-media-now")).toContainText("a picture");
    await expect(box).toHaveCount(1);
    await expect(box).toBeHidden();
  });

  test("screenshots of your book with its words open, at 390x844 and 1440x900", async ({
    browser,
  }) => {
    for (const [w, h, mobile] of [
      [390, 844, true],
      [1440, 900, false],
    ]) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        ...(mobile ? { hasTouch: true, isMobile: true } : {}),
      });
      const page = await ctx.newPage();
      const problems = [];
      page.on("pageerror", (e) => problems.push(e.message));
      await ready(page);
      await page.evaluate(() => window.__splashery.app.chooseToy("your-book"));
      await expect.poll(() => kindNow(page), { timeout: 120_000 }).toBe("pdf");
      if (w < 760) await page.click("#sheet-toggle");
      await page.click("#tab-play");
      const box = page.locator("#toy-media-text-box");
      await expect(box).toBeVisible({ timeout: 120_000 });
      await box.locator("summary").click();
      await page.click("#toy-media-next");
      const words = page.locator("#toy-media-text");
      await expect(words).toHaveAttribute("aria-label", "Words on page 2");
      await expect(words).toContainText("What a splat is");
      await page.fill("#toy-media-find", "splat");
      await page.click("#toy-media-find-go");
      await expect(page.locator("#toy-media-find-note")).toHaveText(/^Found/);
      await box.evaluate((el) => el.scrollIntoView({ block: "start" }));
      // The book opens at its first spread (built, then turned).
      await waitSheets(page);
      await page.waitForTimeout(3000);
      await waitSheets(page);
      await page.screenshot({ path: `tests/screenshots/ops-text-${w}x${h}.png` });
      expect(problems).toEqual([]);
      await ctx.close();
    }
  });
});
