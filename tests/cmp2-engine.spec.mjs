// Engine (lane Computing r2): a kit toy's text option that isn't hidden shows
// as a text box in the Toy tab, and what is typed there rebuilds the toy with
// it. Every text option a toy had before is hidden, so no Toy tab changes; the
// shown ones also include the Enigma's plugboard, the volume viewer's voxel
// size, One splat's word, and Shape morph's word and QR text.

import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("every text option shipped before this change stays hidden", async () => {
  const shown = [];
  for (const f of fs.readdirSync("src/packs").filter((n) => n.endsWith(".js"))) {
    const src = fs.readFileSync(`src/packs/${f}`, "utf8");
    // A text option and the lines after it, up to its closing brace.
    for (const m of src.matchAll(/type: "text"[^}]*}/g)) {
      const before = src.slice(Math.max(0, m.index - 200), m.index);
      const block = before.slice(before.lastIndexOf("{")) + m[0];
      // Only a toy's options (a key and a label), not the page's own inputs.
      if (!/key: /.test(block) || !/label: /.test(block)) continue;
      if (/hidden: true/.test(block)) continue;
      if (/key: "plugs"/.test(block) || (f === "volume-viewer.js" && /key: "spacing"/.test(block))) continue; // prettier-ignore
      // Codex task 78a: One splat's word is shown on purpose (type your own word to split).
      if (f === "one-splat.js" && /key: "word"/.test(block)) continue;
      // Codex task 78c: both inputs customize the corresponding morph destination.
      if (f === "shape-morph.js" && /key: "(word|qrText)"/.test(block)) continue;
      shown.push(`${f}: ${block}`);
    }
  }
  expect(shown).toEqual([]);
});

test("a shown text option is a text box that sets the option", async ({ page }) => {
  const problems = [];
  page.on("pageerror", (e) => problems.push(e.message));
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  // The Bombe, with its message option shown for this test.
  await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/computing-history.js");
    const o = RECIPES.bombe.options.find((x) => x.key === "message");
    o.hidden = false;
    o.placeholder = "WEATHERREPORT";
    const app = window.__splashery.app;
    await app.loadToy({ kind: "builtin", id: "bombe" });
  });
  const box = page.locator("#toy-options input.option-text");
  await expect(box).toHaveCount(1, { timeout: 120_000 });
  await expect(box).toHaveValue("WEATHERREPORT");
  await box.fill("WETTER");
  await box.press("Enter");
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.scene.toy.options?.message))
    .toBe("WETTER");
  expect(problems).toEqual([]);
});

for (const { key, form, value } of [
  { key: "word", form: "word", value: "HELLO" },
  { key: "qrText", form: "qr", value: "é".repeat(21) },
]) {
  test(`a shown text option is a text box that sets Shape morph's ${key}`, async ({ page }) => {
    const problems = [];
    page.on("pageerror", (error) => problems.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?labs=1&renderer=webgl2&profile=weak&adapt=off");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(async (form) => {
      const app = window.__splashery.app;
      await app.chooseToy("shape-morph");
      if (form === "qr") await app.setToyOption("form", form);
      app.ui.setSheetStop("panel");
    }, form);
    await expect(page.locator("#toy-options input.option-text")).toHaveCount(2);
    const box = page.locator(`#opt-${key}`);
    await expect(box).toBeVisible();
    await expect(box).toHaveAttribute("maxlength", key === "word" ? "24" : "42");
    await box.fill(value);
    await box.press("Enter");
    await expect
      .poll(() => page.evaluate((key) => window.__splashery.player.scene.toy.options?.[key], key))
      .toBe(value);
    await expect
      .poll(() => page.evaluate((key) => window.__splashery.player.toyInfo.options?.[key], key))
      .toBe(value);
    if (key === "qrText") {
      expect(Buffer.byteLength(value, "utf8")).toBe(42);
      await expect
        .poll(() =>
          page.evaluate(() => window.__splashery.player.motion.ctx?.kit?.data.form.code?.text),
        )
        .toBe(value);
      expect(
        await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.form.code.ecc),
      ).toBe("M");
    }
    expect(problems).toEqual([]);
  });
}
