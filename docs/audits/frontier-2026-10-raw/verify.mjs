import { chromium } from "/workspace/splashery/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true });
const results = { browser: browser.version(), date: new Date().toISOString(), runs: [] };
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage(),
      errors = [],
      external = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (!r.url().startsWith("http://127.0.0.1:4173/") && !r.url().startsWith("blob:"))
        external.push(r.url());
    });
    for (const name of ["relight", "lod"]) {
      await page.goto("http://127.0.0.1:4173/tools/pages/frontier-" + name + ".html");
      await page.waitForFunction(
        () => document.body.dataset.state === "ready",
        {},
        { timeout: 60000 },
      );
      const stats = await page.evaluate(() => ({ ...window.frontier.stats }));
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        "horizontal overflow",
      );
      if (name === "relight") {
        assert.ok(stats.normalP95Degrees < 1, "normal estimator matches analytic normals");
        assert.ok(stats.validPixels > 200000);
        assert.equal(stats.frames, 21);
        const checksum = () =>
          page.evaluate(() => {
            const d = document
              .querySelector("#lit")
              .getContext("2d")
              .getImageData(0, 0, 640, 400).data;
            return d.reduce((a, v, i) => a + (i % 17 === 0 ? v : 0), 0);
          });
        const before = await checksum();
        await page.locator("#azimuth").fill("100");
        await page.locator("#azimuth").dispatchEvent("input");
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        assert.notEqual(await checksum(), before, "light changes pixels");
        await page.locator("#azimuth").fill("-40");
        await page.locator("#azimuth").dispatchEvent("input");
      } else {
        assert.ok(stats.complete);
        assert.ok(stats.peakResidentPoints <= stats.budget);
        assert.equal(stats.levels.length, 16);
        assert.ok(stats.firstCompleteCoarseMs < stats.totalMs);
        assert.equal(
          await page.evaluate(() => {
            try {
              frontier.decode(new ArrayBuffer(2));
              return false;
            } catch {
              return true;
            }
          }),
          true,
          "reject truncated packets",
        );
        assert.equal(
          await page.evaluate(() => {
            const { state } = frontier;
            const n = frontier.stats.residentPoints;
            for (let j = 1; j < n; j++)
              if (
                state.projected[state.order[j - 1] * 4 + 2] <
                state.projected[state.order[j] * 4 + 2]
              )
                return false;
            return true;
          }),
          true,
          "back-to-front ordering",
        );
      }
      await page.screenshot({
        path: `/tmp/frontier-research/${name}-${viewport.width}.png`,
        fullPage: true,
      });
      results.runs.push({ name, viewport, ...stats });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    if (viewport.width === 1440) {
      for (const budget of [1024, 16384]) {
        await page.locator("#budget").fill(String(budget));
        await page.locator("#budget").dispatchEvent("input");
        await page.locator("#run").click();
        await page.waitForFunction(
          () => document.body.dataset.state === "ready",
          {},
          { timeout: 60000 },
        );
        const s = await page.evaluate(() => ({ ...frontier.stats }));
        assert.equal(s.residentPoints, budget);
        assert.ok(s.peakResidentPoints <= budget);
        assert.ok(s.complete);
        results.runs.push({ name: "lod-budget-" + budget, viewport, ...s });
      }
      await page.locator("#run").click();
      await page.locator("#stop").click();
      assert.equal(await page.getAttribute("body", "data-state"), "canceled");
      await page.locator("#budget").fill("1024");
      await page.locator("#run").click();
      await page.waitForFunction(
        () => document.body.dataset.state === "ready",
        {},
        { timeout: 60000 },
      );
      assert.equal(await page.evaluate(() => frontier.stats.residentPoints), 1024);
      results.cancellation = "stop and restart passed";
    }
    await context.close();
  }
  fs.writeFileSync("/tmp/frontier-research/browser-results.json", JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
