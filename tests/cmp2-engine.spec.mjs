// Engine (lane Computing r2): a kit toy's text option that isn't hidden shows
// as a text box in the Toy tab, and what is typed there rebuilds the toy with
// it. Every text option a toy had before is hidden, so no Toy tab changes; the
// only shown one is the Enigma's plugboard (lane Computing r2).

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
      if (!/hidden: true/.test(block) && !/key: "plugs"/.test(block)) shown.push(`${f}: ${block}`);
    }
  }
  expect(shown).toEqual([]);
});

test("a shown text option is a text box that sets the option", async ({ page }) => {
  const problems = [];
  page.on("pageerror", (e) => problems.push(e.message));
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  // The Enigma, with its message option shown for this test.
  await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/computing-history.js");
    const o = RECIPES["enigma-machine"].options.find((x) => x.key === "message");
    o.hidden = false;
    o.placeholder = "HELLO";
    const app = window.__splashery.app;
    await app.loadToy({ kind: "builtin", id: "enigma-machine" });
  });
  const box = page.locator("#toy-options input.option-text");
  await expect(box).toHaveCount(1, { timeout: 120_000 });
  await expect(box).toHaveValue("HELLO");
  await box.fill("WETTER");
  await box.press("Enter");
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.scene.toy.options?.message))
    .toBe("WETTER");
  expect(problems).toEqual([]);
});
