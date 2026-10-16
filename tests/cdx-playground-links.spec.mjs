import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TOYS } from "../src/toys.js";
import { SITE_TOY_IDS } from "../src/site-toy-pages.js";
import { siteToyPageIds } from "../tools/site-playground-links.mjs";

const APP = "/?renderer=webgl2&profile=weak";
const aboutLink = (page) => page.getByRole("link", { name: "More about this toy", exact: true });
const hash = (scene) => "#s=j." + Buffer.from(JSON.stringify(scene)).toString("base64url");

async function open(page, url = APP) {
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

async function about(page) {
  if (await page.locator("#sheet-toggle").isVisible()) await page.locator("#sheet-toggle").click();
  await page.locator("#tab-about").click();
}

test("the generated toy list contains exactly the pages present at build time", () => {
  expect(SITE_TOY_IDS).toEqual(siteToyPageIds());
  for (const id of SITE_TOY_IDS) expect(fs.existsSync(`site/toys/${id}/index.html`), id).toBe(true);
});

test("a labs toy without a built page shows no link, and switching toys clears the old link", async ({
  page,
}) => {
  // Every current toy has a page. Simulate the next site build, before a new
  // labs page is written, with real files and the production page scanner.
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "splashery-site-pages-"));
  const lab = TOYS.find((toy) => toy.id === "heart-donut");
  expect(lab.labs).toBe(true);
  try {
    fs.mkdirSync(path.join(fixture, "toys/donut"), { recursive: true });
    fs.writeFileSync(
      path.join(fixture, "toys/donut/index.html"),
      "<!doctype html><title>Donut</title>",
    );
    const ids = siteToyPageIds({ siteDir: fixture, toys: TOYS });
    expect(ids).toEqual(["donut"]);
    await page.route("**/src/site-toy-pages.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `export const SITE_TOY_IDS = ${JSON.stringify(ids)};`,
      }),
    );
    await open(page, APP + "&labs=1" + hash({ version: 3, toy: { kind: "builtin", id: "donut" } }));
    await about(page);
    await expect(aboutLink(page)).toHaveAttribute("href", "./site/toys/donut/");
    await page.evaluate((id) => window.__splashery.app.chooseToy(id), lab.id);
    await expect(page.locator("#toy-about-name")).toHaveText(lab.label);
    await expect(aboutLink(page)).toBeHidden();
    await expect(page.locator("#toy-site-link")).not.toHaveAttribute("href");
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("an old version 2 share link and a version 3 saved scene use the toy's page", async ({
  page,
}) => {
  await open(
    page,
    APP + hash({ app: "splashery", version: 2, toy: { kind: "builtin", id: "donut" } }),
  );
  await about(page);
  await expect(aboutLink(page)).toHaveAttribute("href", "./site/toys/donut/");
  await page.locator("#tab-share").click();
  await page.locator("#import-json").setInputFiles({
    name: "saved-scene-v3.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ app: "splashery", version: 3, toy: { kind: "builtin", id: "basketball" } }),
    ),
  });
  await page.locator("#tab-about").click();
  await expect(page.locator("#toy-about-name")).toHaveText("Basketball");
  await expect(aboutLink(page)).toHaveAttribute("href", "./site/toys/basketball/");
  expect((await page.request.get("/site/toys/basketball/")).ok()).toBe(true);
});

test("a toy made in the Playground has no site link", async ({ page }) => {
  await open(page);
  await page.locator("#tab-make").click();
  await page.locator("#gen-make").click();
  await expect(page.locator("#toy-status")).toContainText("Your toy");
  await about(page);
  await expect(aboutLink(page)).toBeHidden();
});

test("an edited shelf toy keeps its page link after loading saved JSON", async ({ page }) => {
  await open(page, APP + hash({ version: 2, toy: { kind: "builtin", id: "blob" } }));
  const scene = await page.evaluate(() => {
    window.__splashery.app.promoteToProcedural();
    return window.__splashery.exportScene();
  });
  expect(scene.toy.kind).toBe("procedural");
  expect(scene.toy.id).toBe("blob");
  await page.locator("#tab-share").click();
  await page.locator("#import-json").setInputFiles({
    name: "edited-blob.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(scene)),
  });
  await about(page);
  await expect(page.locator("#toy-about-name")).toHaveText(
    `${TOYS.find((toy) => toy.id === "blob").label}, edited`,
  );
  await expect(aboutLink(page)).toHaveAttribute("href", "./site/toys/blob/", { timeout: 3000 });
});

test("About links the current toy to its real page in the same tab", async ({ page }) => {
  await open(page);
  await about(page);
  const id = await page.evaluate(() => window.__splashery.player.scene.toy.id);
  const link = page.getByRole("link", { name: "More about this toy", exact: true });
  await expect(link).toBeVisible({ timeout: 3000 });
  await expect(link).toHaveAttribute("href", `./site/toys/${id}/`);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/site/toys/${id}/$`));
  await expect(page.locator("main h1")).toBeVisible();
});

test("the Playground header links to the site's real home page", async ({ page }) => {
  await open(page);
  const link = page.getByRole("link", { name: "Splashery home", exact: true });
  await expect(link).toBeVisible({ timeout: 3000 });
  await link.click();
  await expect(page).toHaveURL(/\/site\/$/);
  await expect(page.locator("main")).toBeVisible();
});

test("a wide landscape embed keeps its full stage", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(
    "/embed/?renderer=webgl2&profile=weak" +
      hash({ version: 3, toy: { kind: "builtin", id: "donut" } }),
  );
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const stage = await page.locator("#stage").boundingBox();
  expect(stage.width).toBe(844);
  expect(stage.height).toBe(390);
});

for (const viewport of [
  { width: 844, height: 390 },
  { width: 932, height: 430 },
]) {
  test.describe(`${viewport.width}×${viewport.height} landscape`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test("settings have room beside the gallery and can be used", async ({ page }) => {
      await open(page, APP + "&labs=0");
      const panes = await page.locator("#panes").boundingBox();
      expect(panes.height).toBeGreaterThan(100);
      const search = page.locator("#shelf-search");
      await expect(search).toBeHidden();
      await page.locator("#shelf-search-toggle").click();
      await expect(search).toBeFocused();
      await search.fill("cactus");
      expect(
        await page
          .locator("#shelf .toy-card")
          .evaluateAll((cards) => cards.map((c) => c.dataset.toy)),
      ).toEqual(["cactus", "saguaro", "succulent"]);
      expect((await page.locator("#panes").boundingBox()).height).toBeGreaterThan(100);
      await page.locator("#shelf-search-toggle").click();
      await expect(search).toBeHidden();
      await expect(search).toHaveValue("");
      await page.locator("#auto-turntable").uncheck();
      await expect(page.locator("#auto-turntable")).not.toBeChecked();
      await page.locator("#tab-look").click();
      await page.locator("#look-theme [data-theme='dark']").click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

      // Check every currently enabled control, including those near the end
      // of long panes. Trial clicks prove that scrolling exposes a hit target
      // without starting recording, downloads, or other unrelated actions.
      for (const tab of ["play", "tools", "look", "make", "share", "about"]) {
        await page.locator(`#tab-${tab}`).click();
        const controls = page.locator(
          `#pane-${tab} :is(button, input:not([type='file']), select, textarea, a[href]):visible:not(:disabled)`,
        );
        expect(await controls.count(), tab).toBeGreaterThan(0);
        for (const control of await controls.all()) {
          await control.scrollIntoViewIfNeeded();
          await control.click({ trial: true });
          await expect(control).toBeInViewport();
        }
      }

      await page.locator("#tab-tools").click();
      await page.locator("#fx-twist").check();
      await expect(page.locator("#fx-twist")).toBeChecked();
      await page.locator("#fx-twist-amount").focus();
      await page.locator("#fx-twist-amount").press("ArrowRight");
      expect(await page.evaluate(() => window.__splashery.player.scene.effects.twist.on)).toBe(
        true,
      );
      await page.locator("#tab-make").click();
      await page.locator("#gen-seed").fill("70");
      await expect(page.locator("#gen-seed")).toHaveValue("70");
      await page.locator("#tab-share").click();
      // The Share tab shows Video or GIF, one at a time (Share lane, October 15, 2026).
      await page.locator("#clip-kind [data-clip='gif']").click();
      await page.locator("#gif-size").selectOption("256");
      await expect(page.locator("#gif-size")).toHaveValue("256");

      // Rotate both ways without rebuilding the app or losing settings.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator("#sheet-toggle").click();
      await expect(page.locator("#tab-share")).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("#gif-size")).toHaveValue("256");
      await page.setViewportSize(viewport);
      await expect(page.locator("#gif-size")).toHaveValue("256");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await page.locator("#tab-play").click();
      await expect(page.locator("#auto-turntable")).not.toBeChecked();
      const stage = await page.locator("#stage").boundingBox();
      const panel = await page.locator("#panel").boundingBox();
      // The release layout frames the stage below the view buttons and above the caption.
      expect(stage.y).toBe(116);
      expect(stage.height).toBe(viewport.height - 180);
      expect(stage.x + stage.width).toBeLessThanOrEqual(panel.x);
    });

    test("safe areas leave controls reachable with the notch on either side", async ({ page }) => {
      await open(page);
      for (const side of ["left", "right"]) {
        await page.evaluate((side) => {
          const style = document.documentElement.style;
          style.setProperty("--playground-safe-left", side === "left" ? "44px" : "0px");
          style.setProperty("--playground-safe-right", side === "right" ? "44px" : "0px");
          style.setProperty("--playground-safe-bottom", "21px");
          style.setProperty("--playground-safe-top", "24px");
        }, side);
        const panel = await page.locator("#panel").boundingBox();
        const stage = await page.locator("#stage").boundingBox();
        const home = await page.getByRole("link", { name: "Splashery home" }).boundingBox();
        expect(panel.x + panel.width).toBeLessThanOrEqual(
          viewport.width - (side === "right" ? 44 : 12),
        );
        expect(panel.y + panel.height).toBeLessThanOrEqual(viewport.height - 21);
        expect(home.x).toBeGreaterThanOrEqual(side === "left" ? 44 : 0);
        expect(stage.x + stage.width).toBeLessThanOrEqual(panel.x);
        await page.getByRole("link", { name: "Splashery home" }).click({ trial: true });
        await page.locator("#tab-look").click();
        await page.locator("#look-theme [data-theme='dark']").click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        for (const selector of ["#focus-toggle", "#sound-toggle", "#help-toggle"]) {
          expect((await page.locator(selector).boundingBox()).y).toBeGreaterThanOrEqual(24);
        }
        const safeRight = viewport.width - (side === "right" ? 44 : 0);
        await page.locator("#panel-fold").click();
        const reopen = await page.locator("#panel-fold").boundingBox();
        expect(reopen.x + reopen.width).toBeLessThanOrEqual(safeRight);
        await page.locator("#panel-fold").click();
        await page.locator("#gallery-open").click();
        const close = await page.locator("#gallery-close").boundingBox();
        expect(close.x + close.width).toBeLessThanOrEqual(safeRight);
        expect(close.y).toBeGreaterThanOrEqual(24);
        await page.locator("#gallery-close").click();
        await page.locator("#focus-toggle").click();
        const exit = await page.locator("#focus-exit").boundingBox();
        expect(exit.x + exit.width).toBeLessThanOrEqual(safeRight);
        expect(exit.y).toBeGreaterThanOrEqual(24);
        await page.locator("#focus-exit").click();
      }
    });
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test.describe(`proof at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });
    test("capture the site links and settings", async ({ page }) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await open(page, APP + hash({ version: 3, toy: { kind: "builtin", id: "donut" } }));
      await about(page);
      await expect(aboutLink(page)).toBeVisible();
      await aboutLink(page).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `tests/screenshots/cdx-playground-links-${viewport.width}x${viewport.height}.png`,
      });
      expect(errors).toEqual([]);
    });
  });
}
