// Lane Science r3's engine addition (October 5, 2026): a select option's
// choices may carry a `group`; consecutive choices of one group are listed
// under that heading (an <optgroup>), and choices without one stay plain
// options. Picking a grouped choice sets the option as before.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

async function open(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}

const idle = async (page) =>
  page.evaluate(async () => {
    const { app } = window.__splashery;
    while (app.busy) await new Promise((r) => setTimeout(r, 50));
  });

test("a select without groups is unchanged", async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => window.__splashery.app.chooseToy("thermal-ellipsoids"));
  await idle(page);
  const r = await page.evaluate(() => {
    const sel = document.querySelector("#toy-options select");
    return { groups: sel.querySelectorAll("optgroup").length, options: sel.options.length };
  });
  expect(r.groups).toBe(0);
  expect(r.options).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test("choices with a group are listed under its heading, and picking one works", async ({
  page,
}) => {
  const errors = await open(page);
  await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/science.js");
    const opt = RECIPES["thermal-ellipsoids"].options.find((o) => o.key === "structure");
    opt.choices = opt.choices.map((c, i) => (i < 1 ? { ...c, group: "Small" } : i < 2 ? { ...c, group: "Big" } : c)); // prettier-ignore
  });
  await page.evaluate(() => window.__splashery.app.chooseToy("thermal-ellipsoids"));
  await idle(page);
  const r = await page.evaluate(() => {
    const sel = document.querySelector("#toy-options select");
    return {
      groups: [...sel.querySelectorAll("optgroup")].map((g) => [g.label, g.children.length]),
      top: [...sel.children].filter((c) => c.tagName === "OPTION").length,
      options: sel.options.length,
      value: sel.value,
    };
  });
  expect(r.groups).toEqual([
    ["Small", 1],
    ["Big", 1],
  ]);
  expect(r.top).toBe(r.options - 2);
  expect(r.value).toBe("aspirin");
  // Pick the grouped second choice.
  const second = await page.evaluate(() => document.querySelector("#toy-options select").options[1].value); // prettier-ignore
  await page.selectOption("#toy-options select", second);
  await idle(page);
  const picked = await page.evaluate(() => document.querySelector("#toy-options select").value);
  expect(picked).toBe(second);
  const shown = await page.evaluate(async () => (await import("/src/packs/science.js")).ellipsoidState()?.name); // prettier-ignore
  expect(shown).toMatch(/Crambin/);
  expect(errors).toEqual([]);
});
