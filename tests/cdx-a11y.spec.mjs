// Task 52: dependency-free accessibility checks and real keyboard interactions.
import { test, expect } from "@playwright/test";

test.use({ actionTimeout: 10_000 });
const URL = "/?renderer=webgl2&profile=weak&labs=0";
async function open(page, size = { width: 390, height: 844 }) {
  await page.setViewportSize(size);
  await page.goto(URL);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}
async function pick(page, id) {
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
}
const pose = (page) => page.evaluate(() => ({ ...window.__splashery.player.camera.tgt }));

test("Escape from a field closes the phone sheet and restores focus", async ({ page }) => {
  await open(page);
  await page.locator("#sheet-toggle").click();
  await page.locator("#tab-make").click();
  await page.locator("#gen-seed").focus();
  await page.keyboard.press("Escape");
  await expect(page.locator("#panel-body")).toBeHidden({ timeout: 3000 });
  await expect(page.locator("#sheet-toggle")).toBeFocused();
});

test("help stays visible while its link has focus", async ({ page }) => {
  await open(page);
  await page.locator("#help-toggle").click();
  await page.locator("#help-line-about").focus();
  await page.waitForTimeout(8000); // Cross the actual seven-second dismissal timer.
  await expect(page.locator("#help-line")).toBeVisible({ timeout: 3000 });
  await expect(page.locator("#help-line-about")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#tab-about")).toBeFocused();
});

test("empty search is a live status without moving focus", async ({ page }) => {
  await open(page);
  await page.locator("#shelf-search-toggle").click();
  await page.locator("#shelf-search").fill("zzzz-no-such-toy");
  await expect(page.locator("#shelf-empty")).toHaveAttribute("role", "status", { timeout: 3000 });
  await expect(page.locator("#shelf-empty")).toContainText("No toys match");
  await expect(page.locator("#shelf-search")).toBeFocused();
});

test("landscape reserves a scrollable pane for every tab", async ({ page }) => {
  await open(page, { width: 844, height: 390 });
  for (const tab of ["play", "tools", "look", "make", "share", "about"]) {
    await page.locator(`#tab-${tab}`).click();
    const box = await page.locator("#panes").boundingBox();
    expect(box.height, tab).toBeGreaterThanOrEqual(100);
    await page.locator("#panes").evaluate((e) => {
      e.scrollTop = e.scrollHeight;
    });
    expect(await page.locator("#panes").evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  }
});

test.describe("single-touch zoom", () => {
  test.use({ hasTouch: true, isMobile: true });
  test("phone zoom works with one pointer", async ({ page }) => {
    await open(page);
    const first = await pose(page);
    await page.getByRole("button", { name: "Zoom in", exact: true }).tap();
    expect((await pose(page)).distance).toBeLessThan(first.distance);
    await page.getByRole("button", { name: "Zoom out", exact: true }).tap();
    expect((await pose(page)).distance).toBeCloseTo(first.distance);
  });
});

test("embed supports orbit, zoom, and play with the keyboard", async ({ page }) => {
  await page.goto("/embed/?toy=chest&renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => {
    window.__actions = [];
    window.__splashery.player.on("action", (r) => window.__actions.push(r));
  });
  const first = await pose(page);
  await page.locator("#stage").focus();
  await page.keyboard.press("ArrowRight");
  expect((await pose(page)).yaw).not.toBe(first.yaw);
  await page.keyboard.press("+");
  expect((await pose(page)).distance).toBeLessThan(first.distance);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  expect(await page.evaluate(() => window.__actions.length)).toBe(2);
});

test("Skip to controls reaches settings directly", async ({ page }) => {
  await open(page, { width: 1440, height: 900 });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("#tab-play")).toBeFocused({ timeout: 3000 });
});

test("chess squares expose state and make a legal move by keyboard", async ({ page }) => {
  await open(page);
  await pick(page, "chess-set");
  await page.locator("#sheet-toggle").click();
  const squares = page.locator("#toy-keyboard button");
  await expect(squares).toHaveCount(64, { timeout: 3000 });
  const pawn = squares.filter({ hasText: "e2" });
  await pawn.focus();
  await page.keyboard.press("Enter");
  await expect(pawn).toHaveAttribute("aria-pressed", "true");
  await squares.filter({ hasText: "e4" }).focus();
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.toyInfo.recipe.game.state().n))
    .toBe(1);
  await expect(squares.filter({ hasText: "e4" })).toHaveAccessibleName(/white pawn/i);
});

test("all piano notes and cube layers have keyboard controls", async ({ page }) => {
  await open(page);
  await pick(page, "grand-piano");
  await page.locator("#sheet-toggle").click();
  await expect(page.locator("#toy-keyboard button")).toHaveCount(88, { timeout: 3000 });
  await page.evaluate(() => {
    window.__actions = [];
    window.__splashery.player.on("action", (r) => window.__actions.push(r));
  });
  await page.getByRole("button", { name: "Play C4", exact: true }).focus();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => window.__actions.at(-1))).toMatchObject({
    key: "strike",
    pick: 39,
  });
  await page.keyboard.press("Escape");
  await pick(page, "puzzle-cube");
  await page.locator("#sheet-toggle").click();
  await expect(page.locator("#toy-keyboard button")).toHaveCount(18);
  await page.getByRole("button", { name: "Turn X middle layer positive", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.toyInfo.recipe.cube.turns()))
    .toBe(1);
});

test("keyboard focus can keep help open during its dismissal fade", async ({ page }) => {
  await page.clock.install();
  await open(page);
  await page.locator("#help-toggle").evaluate((button) => button.click());
  await page.clock.fastForward(7100);
  await expect(page.locator("#help-toggle")).toHaveAttribute("aria-expanded", "false");
  await page.locator("#help-line-about").focus();
  await expect(page.locator("#help-toggle")).toHaveAttribute("aria-expanded", "true", {
    timeout: 3000,
  });
  await page.clock.fastForward(1000);
  await expect(page.locator("#help-line")).toBeVisible();
  await expect(page.locator("#help-line-about")).toBeFocused();
});
