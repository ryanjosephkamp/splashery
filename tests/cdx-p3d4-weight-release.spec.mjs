import { test, expect } from "@playwright/test";

for (const outcome of ["matching build", "stale token", "failed build"]) {
  test(`depth weights are released after a ${outcome}`, async ({ page }) => {
    // Observe the actual module's lexical cache without adding a production diagnostic API.
    await page.route("**/src/photo3d/build-worker.js", async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body:
          (await response.text()) +
          `
globalThis.__weightBytes = () => {
  const weights = colors?.prepared?.depthWeights;
  return weights ? weights.weights.byteLength + weights.indices.byteLength + weights.totals.byteLength : 0;
};
`,
      });
    });
    await page.route("**/__r4-worker-fixture", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Worker fixture</title>",
      }),
    );
    await page.goto("/__r4-worker-fixture");
    const [worker] = await Promise.all([
      page.waitForEvent("worker"),
      page.evaluate(() => {
        const worker = new Worker("/src/photo3d/build-worker.js", { type: "module" }),
          pending = new Map();
        let next = 0;
        worker.onmessage = ({ data }) => {
          const resolve = pending.get(data.id);
          if (resolve) {
            pending.delete(data.id);
            resolve(data);
          }
        };
        window.__weightSend = (data) =>
          new Promise((resolve) => {
            const id = ++next;
            pending.set(id, resolve);
            worker.postMessage({ ...data, id });
          });
        window.__weightFixture = {
          photo: {
            w: 48,
            h: 40,
            data: Uint8Array.from({ length: 48 * 40 * 4 }, (_, i) =>
              i % 4 === 3 ? 255 : (i * 37) & 255,
            ),
          },
          depth: { w: 8, h: 8, d: Float32Array.from({ length: 64 }, (_, i) => 1 + Math.sin(i)) },
          options: { count: 500, depth: 1, keepFlat: true, bitmap: false },
          cells: 300,
        };
      }),
    ]);
    const warm = await page.evaluate(() =>
      window.__weightSend({
        type: "colors",
        photo: window.__weightFixture.photo,
        options: { ...window.__weightFixture.options, depthWidth: 8, depthHeight: 8 },
      }),
    );
    expect(warm.precomputed).toBe(true);
    expect(await worker.evaluate(() => globalThis.__weightBytes())).toBeGreaterThan(0);
    const result = await page.evaluate(
      ({ outcome, id }) => {
        const fixture = window.__weightFixture;
        return window.__weightSend({
          ...fixture,
          depth: outcome === "failed build" ? null : fixture.depth,
          options: { ...fixture.options, colorKey: outcome === "stale token" ? id + 99 : id },
        });
      },
      { outcome, id: warm.id },
    );
    if (outcome === "failed build") expect(result.error).toBeTruthy();
    else expect(result.result?.gx).toBeGreaterThan(0);
    expect(await worker.evaluate(() => globalThis.__weightBytes())).toBe(0);
  });
}
