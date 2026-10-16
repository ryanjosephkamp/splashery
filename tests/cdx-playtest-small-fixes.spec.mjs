import { test, expect as baseExpect } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 2000 });

test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
test.beforeEach(() => {
  test.setTimeout(60000);
});
test.describe.configure({ timeout: 60000 });

const scene = Buffer.from(
  JSON.stringify({ version: 3, toy: { kind: "builtin", id: "donut" } }),
).toString("base64url");
async function open(page) {
  await page.goto(`/?renderer=webgl2&profile=low&adapt=off&labs=1#s=j.${scene}`);
  await page.locator("body[data-ready=true]").waitFor();
}

test("failed local files name the file and explain the problem", async ({ page }) => {
  await open(page);
  for (const ext of ["ply", "sog", "splat", "spz", "json"]) {
    await page.evaluate(async (ext) => {
      const file = new File([ext === "splat" ? "" : "broken file"], `broken <toy>.${ext}`);
      await window.__splashery.app.openFile(file);
    }, ext);
    await expect(page.locator("#toast")).toContainText(`Could not open “broken <toy>.${ext}”.`);
    await expect(page.locator("#toast")).toContainText(
      ext === "json" ? "valid JSON" : new RegExp(`${ext.toUpperCase()}|empty`, "i"),
    );
    await expect(page.locator("#toast")).not.toContainText("Invalid ply header");
    expect(await page.locator("#toast").locator("*").count()).toBe(0);
  }
});

test("a file that cannot be read reports its name too", async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const file = new File(["data"], "unreadable.splat");
    file.arrayBuffer = async () => {
      throw new DOMException("Read failed", "NotReadableError");
    };
    await window.__splashery.app.openFile(file);
  });
  await expect(page.locator("#toast")).toContainText("Could not open “unreadable.splat”.");
  await expect(page.locator("#toast")).toContainText("could not be read");
});

test("a hidden toast clears its live text, and an old timer cannot clear a new toast", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => window.__splashery.app.ui.toast("Old message", 60));
  await page.evaluate(() => window.__splashery.app.ui.toast("New message", 600));
  await expect(page.locator("#toast")).toHaveText("New message");
  await expect(page.locator("#toast")).not.toHaveClass(/show/, { timeout: 3000 });
  await expect(page.locator("#toast")).toHaveText("");
});

test("Seed clamps, rounds, and displays the generator's actual seed", async ({ page }) => {
  await open(page);
  await page.locator("#tab-make").click();
  for (const [input, used] of [
    ["-1", "0"],
    ["4294967296", "4294967295"],
    ["3.7", "4"],
    ["", "0"],
  ]) {
    await page.locator("#gen-seed").fill(input);
    await page.locator("#gen-seed").press("Tab");
    await expect(page.locator("#gen-seed")).toHaveValue(used);
    expect(await page.evaluate(() => window.__splashery.app.generator.seed)).toBe(Number(used));
    await expect
      .poll(
        () =>
          page.evaluate(() => ({
            seed: window.__splashery.player.scene.toy.generator?.seed,
            loading: !!window.__splashery.player.loading,
          })),
        { timeout: 10000 },
      )
      .toEqual({ seed: Number(used), loading: false });
  }
});

for (const outcome of ["AbortError", "SecurityError"]) {
  test(`PDF picker reports waiting and ${outcome}`, async ({ page }) => {
    await open(page);
    // Native pickers cannot be driven headlessly. Keep its promise pending, then reject it.
    await page.evaluate(async () => {
      window.showSaveFilePicker = () =>
        new Promise((resolve, reject) => {
          window.rejectPicker = reject;
        });
      const { openPdfDialog } = await import("/src/pdf-export/index.js");
      openPdfDialog(window.__splashery.app);
    });
    await page.locator("#pdfx-save").click();
    await expect(page.locator("#pdfx")).toContainText("Waiting for the save dialog");
    await expect(page.locator("#pdfx-save")).toBeDisabled();
    const download = outcome === "SecurityError" ? page.waitForEvent("download") : null;
    await page.evaluate(
      (name) => window.rejectPicker(new DOMException("Picker rejected", name)),
      outcome,
    );
    if (download) {
      expect((await download).suggestedFilename()).toBe("splashery-donut.pdf");
      await expect(page.locator("#toast")).toContainText("The save dialog could not open");
      await expect(page.locator("#toast")).toContainText("downloaded instead");
    } else {
      await expect(page.locator("#pdfx-save")).toBeEnabled();
      await expect(page.locator("#pdfx")).toContainText("Save canceled. No PDF was saved.");
      await expect(page.locator("#pdfx")).toBeVisible();
    }
  });
}

for (const width of [390, 1440]) {
  test(`shelf keyboard groups, filtering, and skip links at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const chips = page.locator("#shelf-chips [data-category]");
    const rowButtons = page.locator("#shelf-chips button:visible");
    const cards = page.locator("#shelf .toy-card:not([hidden])");
    const stops = (items) => items.evaluateAll((xs) => xs.filter((x) => x.tabIndex === 0).length);
    expect(await stops(rowButtons)).toBe(1);
    expect(await stops(cards)).toBe(1);
    await chips.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(chips.nth(1)).toBeFocused();
    await expect(chips.first()).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("End");
    await expect(chips.last()).toBeFocused();
    await page.keyboard.press("Home");
    await expect(rowButtons.first()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("#shelf .toy-card[tabindex='0']")).toBeFocused();
    const before = await page.evaluate(() => document.activeElement.dataset.toy);
    await page.keyboard.press("ArrowRight");
    const focused = await page.evaluate(() => document.activeElement.dataset.toy);
    expect(focused).not.toBe(before);
    await expect(page.locator(`#shelf [data-toy='${focused}']`)).toBeFocused();
    expect(await stops(cards)).toBe(1);
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement.closest("#shelf"))).toBe(false);
    if (!(await page.locator("#shelf-search").isVisible()))
      await page.locator("#shelf-search-toggle").click();
    await page.locator("#shelf-search").fill("grapes");
    expect(await stops(cards)).toBe(1);
    await page.locator("#shelf-search").fill("no toy has this name 9999");
    expect(await stops(cards)).toBe(0);
    await page.locator("#shelf-search").fill("");
    expect(await stops(cards)).toBe(1);
    const skip = page.getByRole("link", { name: "Skip to toy shelf" });
    await skip.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#shelf .toy-card[tabindex='0']")).toBeFocused();
    await page.keyboard.press("End");
    await expect(cards.last()).toBeFocused();
    await page.keyboard.press("Home");
    await expect(cards.first()).toBeFocused();
    if (width === 1440) {
      await page.keyboard.press("ArrowDown");
      const down = await page.evaluate(() => document.activeElement.getBoundingClientRect().top);
      expect(down).toBeGreaterThan((await cards.first().boundingBox()).y);
      await page.keyboard.press("ArrowUp");
      await expect(cards.first()).toBeFocused();
    }
  });
}

test("a dense shared QR explains the low budget and gives steps that recover", async ({ page }) => {
  test.setTimeout(120000);
  await open(page);
  await page.evaluate(async () => {
    const { app } = window.__splashery;
    await app.setSplats(60000);
    let seed = 17;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    app.player.scene.paint.stamps = Array.from({ length: 60 }, () => [
      random(),
      random(),
      random(),
      0.03,
      "#5178ab",
      1,
    ]);
    const { openShareQR } = await import("/src/qr/share.js");
    window.sharedCode = await openShareQR(app);
  });
  await page.locator("#sqr-splats").click();
  await page.waitForFunction(() => window.__splashery.qr?.info().text === window.sharedCode.url);
  const low = await page.evaluate(async () => {
    const { qr, player } = window.__splashery;
    await qr.check();
    return { ...qr.info(), count: player.proc.ctx.kit.count, splats: player.splats };
  });
  await test
    .info()
    .attach("low-budget QR", { body: JSON.stringify(low), contentType: "application/json" });
  await expect(page.locator(".stage-cover")).toHaveAttribute(
    "data-label",
    /budget is too low.*Splats.*[0-9]+k/,
    { timeout: 30000 },
  );
  const label = await page.locator(".stage-cover").getAttribute("data-label");
  const count = Number(/Splats to ([0-9]+)k/.exec(label)[1]) * 1000;
  await page.evaluate((count) => window.__splashery.app.setSplats(count), count);
  const raised = await page.evaluate(() => window.__splashery.qr.check());
  if (!raised.ok) {
    await expect(page.locator(".stage-cover")).toHaveAttribute("data-label", /shorter text/);
    await page.evaluate(() => window.__splashery.qr.set({ text: "https://example.com/" }));
    await page.evaluate(() => window.__splashery.qr.check());
  }
  await expect(page.locator(".stage-cover")).toHaveCount(0, { timeout: 30000 });
  expect(await page.evaluate(() => window.__splashery.qr.info().check?.ok)).toBe(true);
});
