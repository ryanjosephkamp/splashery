// Lane Toy pages (engine): a host page's "splashery:theme" message that
// arrives before the embed player has started is kept and applied once it
// starts, instead of throwing (src/viewer.js, Viewer.setTheme; the embed page
// passes the message straight to it).

import { test, expect } from "@playwright/test";

test("a theme set before the player starts is kept, not thrown", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/embed/?toy=strawberry&renderer=webgl2");
  await page.waitForFunction(() => window.__splashery?.ready, null, { timeout: 120_000 });
  const out = await page.evaluate(async () => {
    const { Viewer } = await import("/src/viewer.js");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    document.body.append(canvas);
    const v = new Viewer(canvas, { toy: "strawberry", renderer: "webgl2" });
    let early = null;
    try {
      v.setTheme("dark");
    } catch (err) {
      early = String(err?.message || err);
    }
    await v.start();
    const before = v.player.resolvedTheme();
    v.setTheme("light");
    const after = v.player.resolvedTheme();
    v.destroy();
    return { early, before, after };
  });
  expect(out).toEqual({ early: null, before: "dark", after: "light" });
});
