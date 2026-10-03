// Lane Books r5, the engine part (docs/handoff/BooksR5.md): a PDF page's
// links and picture boxes, a sheet that shows part of its page raised by a
// relief map, a page drawn another way (variant), and a link that asks
// before it opens. The test PDF is made by tests/fixtures/bk5/make-pdf.mjs.

import { test, expect } from "@playwright/test";
import { buildSheet } from "../src/picture-splats.js";
import { joinBoxes, safeLinkURL, clampRegion } from "../src/media.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function ready(page, url = `${APP}&labs=1`) {
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

// (With `mark`, until the first sheet shows a key with it in.)
async function waitSheets(page, mark = "") {
  await page.waitForFunction(
    (mark) => {
      const p = window.__splashery.player.pictures;
      if (!p?.media) return false;
      window.__splashery.player.stage.requestRender();
      if (mark && !p.sheets[0].shown?.key.includes(mark)) return false;
      return p.sheets.every((s) => !s.want || s.shown?.key === s.want.key) && p.splats() > 0;
    },
    mark,
    { timeout: 120_000 },
  );
}

// Opens the test PDF in the toy on show.
async function openLinkPDF(page) {
  await page.evaluate(async () => {
    const { linkPDF } = await import("/tests/fixtures/bk5/make-pdf.mjs");
    const file = new File([linkPDF()], "links.pdf", { type: "application/pdf" });
    await window.__splashery.app.openMedia(file);
  });
}

test.describe("links and figure boxes (no browser)", () => {
  test("only http, https and mailto addresses may open", () => {
    expect(safeLinkURL("https://example.org/a?b=1")).toBe("https://example.org/a?b=1");
    expect(safeLinkURL("http://example.org")).toBe("http://example.org/");
    expect(safeLinkURL("mailto:someone@example.org")).toBe("mailto:someone@example.org");
    for (const bad of ["javascript:alert(1)", "JavaScript:alert(1)", " javascript:void(0)", "file:///etc/passwd", "data:text/html,hi", "vbscript:x", "blob:https://example.org/1", "about:blank", "", "example.org", null]) // prettier-ignore
      expect(safeLinkURL(bad), String(bad)).toBe(null);
  });

  test("boxes that touch are joined; a region stays on the page", () => {
    const j = joinBoxes([[0.1, 0.1, 0.3, 0.2], [0.1, 0.2, 0.3, 0.3], [0.6, 0.6, 0.7, 0.7]]); // prettier-ignore
    expect(j).toEqual([[0.1, 0.1, 0.3, 0.3], [0.6, 0.6, 0.7, 0.7]]); // prettier-ignore
    expect(clampRegion([0.8, -1, 0.2, 2])).toEqual([0.2, 0, 0.8, 1]);
  });

  test("relief raises each splat toward the sheet's facing; the base stays behind the detail", () => {
    const w = 32;
    const h = 32;
    const px = new Uint8ClampedArray(w * h * 4).fill(200);
    // The right half raised all the way.
    const d = new Float32Array(16 * 16);
    for (let y = 0; y < 16; y++) for (let x = 8; x < 16; x++) d[y * 16 + x] = 1;
    const job = { pixels: px, w, h, method: "pixels", origin: [0, 0, 0], right: [1 / w, 0, 0], down: [0, -1 / w, 0], normal: [0, 0, 1] }; // prettier-ignore
    const flat = buildSheet({ ...job, pixels: px.slice() });
    const up = buildSheet({ ...job, pixels: px.slice(), relief: { w: 16, h: 16, d, amount: 0.2 } });
    expect(up.count).toBe(flat.count);
    let raised = 0;
    let left = 0;
    for (let i = 0; i < up.count; i++) {
      const x = up.centers[i * 3];
      const z = up.centers[i * 3 + 2];
      const z0 = flat.centers[i * 3 + 2];
      expect(Number.isFinite(z)).toBe(true);
      expect(up.centers[i * 3]).toBeCloseTo(flat.centers[i * 3], 6);
      if (x > 0.75 && z > z0 + 0.19) raised++;
      if (x < 0.25) {
        expect(z).toBeCloseTo(z0, 6);
        left++;
      }
    }
    expect(raised).toBeGreaterThan(8 * 32 * 0.8);
    expect(left).toBeGreaterThan(0);
    // No splat of the base (behind the detail) stands in front of the
    // detail next to it: the base takes the lowest relief round it.
    const maxBase = Math.max(...Array.from({ length: up.count - w * h }, (_, i) => up.centers[i * 3 + 2])); // prettier-ignore
    expect(maxBase).toBeLessThanOrEqual(0.2 + 1e-6);
  });
});

test.describe("links and figure boxes (in the app)", () => {
  test.setTimeout(240_000);

  test("a PDF page's links and picture boxes; unsafe links are left out", async ({ page }) => {
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await waitSheets(page);
    await openLinkPDF(page);
    await waitSheets(page);
    const r = await page.evaluate(async () => {
      const { BOXES } = await import("/tests/fixtures/bk5/make-pdf.mjs");
      const api = window.__splashery.player.pictures.api;
      return { links: await api.links(0), figures: await api.figures(0), none: await api.links(1), out: await api.links(9), BOXES }; // prettier-ignore
    });
    expect(r.links.length).toBe(2);
    const web = r.links.find((l) => l.url);
    const inner = r.links.find((l) => l.page !== undefined);
    expect(web.url).toBe("https://example.org/");
    web.box.forEach((v, i) => expect(v).toBeCloseTo(r.BOXES.web[i], 3));
    expect(inner.page).toBe(2);
    inner.box.forEach((v, i) => expect(v).toBeCloseTo(r.BOXES.page3[i], 3));
    expect(r.links.some((l) => String(l.url).startsWith("javascript"))).toBe(false);
    expect(r.figures.length).toBe(1);
    r.figures[0].box.forEach((v, i) => expect(v).toBeCloseTo(r.BOXES.figure[i], 3));
    expect(r.none).toEqual([]);
    expect(r.out).toEqual([]);
  });

  test("a crop draws that part of the page; a cropped, raised sheet lies where the part is", async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await waitSheets(page);
    await openLinkPDF(page);
    await waitSheets(page);
    // pics.crop: the figure's own pixels (the sky at the top, orange).
    const px = await page.evaluate(async () => {
      const { BOXES } = await import("/tests/fixtures/bk5/make-pdf.mjs");
      const c = await window.__splashery.player.pictures.api.crop(0, BOXES.figure, 200);
      return { w: c.width, h: c.height, top: [...c.getContext("2d").getImageData(10, 4, 1, 1).data] }; // prettier-ignore
    });
    expect(px.w).toBe(200);
    expect(px.h).toBe(150);
    expect(px.top[0]).toBeGreaterThan(200);
    expect(px.top[2]).toBeLessThan(120);
    // A sheet asked for the figure's part of page 0, raised: built as
    // pixels, every splat inside the figure's place on the page, the raised
    // ones in front of it.
    const r = await page.evaluate(async () => {
      const { BOXES } = await import("/tests/fixtures/bk5/make-pdf.mjs");
      const { RECIPES } = await import("/src/packs/pictures.js");
      const rec = RECIPES["picture-lab"];
      rec.__drive = rec.__drive || rec.drive;
      const d = new Float32Array(8 * 6).fill(1);
      rec.drive = (t, c, out, info) => {
        rec.__drive(t, c, out, info);
        out.sheets = { page: { page: 0, crop: BOXES.figure, relief: { key: "all", w: 8, h: 6, d, depth: 0.05 } } }; // prettier-ignore
      };
      window.__splashery.player.stage.requestRender();
      return BOXES.figure;
    });
    await waitSheets(page, "|rall");
    const s = await page.evaluate(() => {
      const p = window.__splashery.player.pictures;
      const sh = p.sheets[0];
      const data = sh.shown.data;
      const { c, hw, hh } = p.rect(sh, p.media.aspect(0));
      let lo = [Infinity, Infinity, Infinity];
      let hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < data.count; i++)
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], data.centers[i * 3 + k]);
          hi[k] = Math.max(hi[k], data.centers[i * 3 + k]);
        }
      // Back to fractions of the page from its top-left corner.
      const fx = (x) => (x - (c[0] - hw)) / (2 * hw);
      const fy = (y) => (c[1] + hh - y) / (2 * hh);
      return { key: sh.shown.key, method: sh.shown.method, box: [fx(lo[0]), fy(hi[1]), fx(hi[0]), fy(lo[1])], z: [lo[2] - c[2], hi[2] - c[2]], scale: p.fitScale }; // prettier-ignore
    });
    expect(s.method).toBe("pixels");
    expect(s.key).toContain("|c0.5000,");
    expect(s.key).toContain("|rall");
    s.box.forEach((v, i) => expect(v).toBeCloseTo(r[i], 2));
    expect(s.z[0]).toBeGreaterThan(0.05 * s.scale * 0.9);
    await page.evaluate(async () => {
      const { RECIPES } = await import("/src/packs/pictures.js");
      RECIPES["picture-lab"].drive = RECIPES["picture-lab"].__drive;
    });
  });

  test("a variant redraws the page through decorate, with the page's links", async ({ page }) => {
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await waitSheets(page);
    await openLinkPDF(page);
    await waitSheets(page);
    const plainKey = await page.evaluate(() => window.__splashery.player.pictures.sheets[0].shown.key); // prettier-ignore
    expect(plainKey).not.toContain("|v");
    await page.evaluate(async () => {
      const { RECIPES } = await import("/src/packs/pictures.js");
      const rec = RECIPES["picture-lab"];
      rec.__drive = rec.__drive || rec.drive;
      rec.drive = (t, c, out, info) => {
        rec.__drive(t, c, out, info);
        out.sheets = { page: { page: 0, variant: "marked" } };
      };
      const p = window.__splashery.player.pictures;
      window.__bk5Seen = [];
      p.decorate = (canvas, info) => window.__bk5Seen.push({ variant: info.variant, links: info.links.length, page: info.page }); // prettier-ignore
      window.__splashery.player.stage.requestRender();
    });
    await waitSheets(page, "|vmarked");
    const seen = await page.evaluate(() => window.__bk5Seen);
    expect(seen).toContainEqual({ variant: "marked", links: 2, page: 0 });
    const key = await page.evaluate(() => window.__splashery.player.pictures.sheets[0].shown.key);
    expect(key.endsWith("|vmarked")).toBe(true);
    await page.evaluate(async () => {
      const { RECIPES } = await import("/src/packs/pictures.js");
      RECIPES["picture-lab"].drive = RECIPES["picture-lab"].__drive;
    });
  });

  test("a web link asks first, opens in a new tab without access back; javascript: never asks", async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await waitSheets(page);
    const refused = await page.evaluate(() => window.__splashery.player.pictures.api.openLink("javascript:alert(1)")); // prettier-ignore
    expect(refused).toBe(false);
    await expect(page.locator("#link-confirm")).toHaveCount(0);
    const ok = await page.evaluate(() =>
      window.__splashery.player.pictures.api.openLink("https://www.example.org/page"),
    );
    expect(ok).toBe(true);
    const bar = page.locator("#link-confirm");
    await expect(bar).toBeVisible();
    await expect(bar).toContainText("Open example.org?");
    await expect(bar).toContainText("https://www.example.org/page");
    const open = page.locator("#link-confirm-open");
    await expect(open).toHaveAttribute("href", "https://www.example.org/page");
    await expect(open).toHaveAttribute("target", "_blank");
    await expect(open).toHaveAttribute("rel", "noopener noreferrer");
    await page.click("#link-confirm-cancel");
    await expect(bar).toBeHidden();
    // Nothing opened.
    expect(page.context().pages().length).toBe(1);
  });
});
