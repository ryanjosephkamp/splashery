// MIT. Made by Ryan with Codex (GPT-6). Actual optimizer-state parity; no performance claim.
import { test, expect } from "@playwright/test";
import { tileGpuFixture } from "./helpers/v3d-tile-fixture.mjs";
test("bounded tile8 preserves complete GPU optimizer state, dense entries, SSAA, and fallback", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/tile-parity-empty.html", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html>" }),
  );
  await page.goto("/tile-parity-empty.html");
  const result = await page.evaluate(tileGpuFixture, "/vendor/splatjs");
  expect(errors).toEqual([]);
  expect(result.errors).toEqual([]);
  expect(result.cases).toHaveLength(6);
  for (const c of result.cases) {
    expect(Object.keys(c.exact).sort()).toEqual([
      "adamM",
      "adamV",
      "gradF",
      "gradP",
      "out",
      "params",
      "stats",
    ]);
    for (const [key, exact] of Object.entries(c.exact))
      expect(exact, JSON.stringify({ w: c.w, h: c.h, n: c.n, key })).toBe(true);
    for (const v of c.variants) {
      expect(v.iters).toBe(4);
      expect(v.finite).toBe(true);
      expect(v.changed).toBe(true);
      expect(v.maxTiles).toBe(v.expectedTiles);
      expect(v.entryOverflow).toBe(0);
      expect(v.tileSize).toBe(c.forceFallback ? 16 : v.requestedTileSize);
      expect(v.entriesCap).toBeGreaterThanOrEqual(v.tileEntryBound);
    }
  }
  const dense = result.cases.find((c) => c.n === 2049);
  expect(dense.variants[1].entriesCap).toBeGreaterThan(16384);
});
