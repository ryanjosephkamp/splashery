// Lane Molecule viewer's engine addition (October 5, 2026), small and additive:
//
// - a tap's `action.at` may return { key, say: "…" }; the player shows the
//   words as a message (the viewer's measured distance or angle);
// - a recipe whose panel sets `input.drop` takes a file dropped on the page
//   when its extension is one `input.accept` lists (other toys never see
//   drops: a dropped file loads as before);
// - the panel's "what is showing" line follows each tap.

import { test, expect } from "@playwright/test";
import { MotionDriver } from "../src/motion.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

test("a tap's say is kept for the player, and only that tap's", () => {
  const recipe = {
    controls: [{ key: "go", type: "pulse", ease: 0.5 }],
    action: { key: "go", at: (p) => (p[0] > 0 ? { key: "go", say: "1.53 Å" } : { key: "go" }) },
  };
  const m = new MotionDriver();
  m.setToy(recipe, { parts: [], transform: { center: [0, 0, 0], scale: 1 } });
  expect(m.act(0, [1, 0, 0])).toMatchObject({ key: "go", value: 1 });
  expect(m.said).toBe("1.53 Å");
  m.act(1, [-1, 0, 0]);
  expect(m.said).toBe(null);
  m.act(2, null); // the Play button: no place, nothing said
  expect(m.said).toBe(null);
});

test("the say shows as a message; drops go to a toy only when it asks", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const out = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("protein");
    while (app.busy) await new Promise((r) => setTimeout(r, 50));
    // The protein toy's panel takes files but not drops: nothing changes for it.
    const file = new File(["ATOM\n"], "x.pdb");
    const took = app.ui.dropOnToy(file);
    // A tap whose action says something.
    const recipe = player.toyInfo.recipe;
    const at = recipe.action.at;
    recipe.action.at = () => ({ key: recipe.action.key, say: "Distance: 1.53 Å" });
    player.act(player.fromRecipe([0, 0, 0]));
    recipe.action.at = at;
    const toast = document.getElementById("toast");
    return { took, text: toast.textContent, shown: toast.classList.contains("show") };
  });
  expect(out.took).toBe(false);
  expect(out.text).toBe("Distance: 1.53 Å");
  expect(out.shown).toBe(true);
  expect(errors).toEqual([]);
});
