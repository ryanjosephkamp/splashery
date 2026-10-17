import { chromium } from "/workspace/splashery/node_modules/playwright-core/index.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
});
const results = {
  date: new Date().toISOString(),
  browser: browser.version(),
  runs: [],
};
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage(),
      errors = [],
      external = [],
      models = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (!r.url().startsWith("http://127.0.0.1:4173/")) external.push(r.url());
      if (r.url().endsWith(".onnx")) models.push(r.url());
      assert.ok(!r.url().endsWith(".depth"), "no prebaked depth");
    });
    await page.goto("http://127.0.0.1:4173/tools/pages/frontier-relight.html");
    await page.waitForFunction(() => document.body.dataset.state === "ready");
    assert.equal(models.length, 0, "no model before explicit photo request");
    const analytic = await page.evaluate(() => ({ ...frontier.stats }));
    assert.ok(analytic.normalP95Degrees < 1);
    assert.ok(analytic.curvedNormalP95Degrees < 1);
    assert.ok(analytic.validPixels > 200000);
    assert.equal(analytic.modelFileBytes, 0);
    assert.equal(analytic.depthInferenceMs, 0);
    const invariants = await page.evaluate(() => {
      const { deriveNormals, convertInverseDepth } = frontier,
        w = 12,
        h = 8,
        f = 8;
      const depth = Float32Array.from({ length: w * h }, (_, i) => (i % w < 6 ? 4 : 8));
      const a = deriveNormals({ w, h, f, depth }),
        b = deriveNormals({
          w,
          h,
          f,
          depth: depth.map((z) => z * 100),
          ids: new Uint8Array(w * h).fill(8),
        });
      const sameMask = a.valid.every((v, i) => v === b.valid[i]);
      const stepRejected = Array.from({ length: h - 2 }, (_, i) => i + 1).every(
        (y) => !a.valid[y * w + 5] && !a.valid[y * w + 6],
      );
      const flatAccepted =
        a.valid[3 * w + 2] &&
        a.valid[3 * w + 9] &&
        Math.abs(a.normals[(3 * w + 2) * 3 + 2] + 1) < 1e-6;
      const raw = Float32Array.from({ length: 101 }, (_, i) => i),
        c = convertInverseDepth(raw),
        d = convertInverseDepth(raw.map((v) => 3 * v + 40));
      const inverseInvariant = c.depth.every((v, i) => Math.abs(v - d.depth[i]) < 1e-6);
      const inverseMonotone = c.depth.every((v, i) => i === 0 || v <= c.depth[i - 1]);
      let invalidRangeRejected = false;
      try {
        convertInverseDepth(new Float32Array(20).fill(1));
      } catch {
        invalidRangeRejected = true;
      }
      const bad = depth.slice();
      bad[3 * w + 2] = NaN;
      const invalidRejected = !deriveNormals({ w, h, f, depth: bad }).valid[3 * w + 2];
      return {
        sameMask,
        stepRejected,
        flatAccepted: !!flatAccepted,
        inverseInvariant,
        inverseMonotone,
        near: c.depth.at(-1),
        far: c.depth[0],
        invalidRangeRejected,
        invalidRejected,
      };
    });
    for (const [k, v] of Object.entries(invariants))
      assert.equal(v, k === "near" ? 2 : k === "far" ? 8 : true, k);
    await page.screenshot({
      path: `/tmp/frontier-r2/analytic-${viewport.width}.png`,
      fullPage: true,
    });
    results.runs.push({ name: "analytic", viewport, ...analytic });
    results.invariants = invariants;
    const snapshots = [];
    for (let pass = 0; pass < 2; pass++) {
      await page.locator("#photo").click();
      await page.waitForFunction(
        () => document.body.dataset.state === "ready" && document.body.dataset.mode === "photo",
        null,
        { timeout: 90000 },
      );
      const photo = await page.evaluate(async () => {
        const hash = await crypto.subtle.digest("SHA-256", frontier.sample.rawInverse);
        return {
          ...frontier.stats,
          rawInverseSha256: Array.from(new Uint8Array(hash), (v) =>
            v.toString(16).padStart(2, "0"),
          ).join(""),
        };
      });
      assert.equal(photo.mode, "photo");
      assert.equal(photo.modelFileBytes, 27258801);
      assert.ok(photo.depthInferenceMs > 0);
      assert.ok(photo.depthCallMs >= photo.depthInferenceMs);
      assert.equal(photo.depthCold, pass === 0);
      assert.equal(photo.normalP95Degrees, null, "no photo ground-truth claim");
      assert.equal(photo.width, 518);
      assert.equal(photo.height, 490);
      assert.ok(photo.validPixels > photo.width * photo.height * 0.3);
      assert.ok(photo.rejectedPixels > 0);
      assert.equal(photo.knownBytesPlusModelFile, photo.knownBytes + 27258801);
      snapshots.push(photo);
      results.runs.push({
        name: pass ? "photo-warm" : "photo-cold",
        viewport,
        ...photo,
      });
      if (pass === 0)
        await page.screenshot({
          path: `/tmp/frontier-r2/photo-${viewport.width}.png`,
          fullPage: true,
        });
    }
    assert.equal(models.length, 1, "existing model fetched once from same origin");
    assert.equal(
      snapshots[0].rawInverseSha256,
      snapshots[1].rawInverseSha256,
      "repeat depth matches",
    );
    const pixelHash = () =>
      page.evaluate(() => {
        const c = document.querySelector("#lit");
        return c
          .getContext("2d")
          .getImageData(0, 0, c.width, c.height)
          .data.reduce((a, v, i) => a + (i % 17 === 0 ? v : 0), 0);
      });
    const before = await pixelHash();
    await page.locator("#azimuth").fill("100");
    await page.locator("#azimuth").dispatchEvent("input");
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    assert.notEqual(await pixelHash(), before, "photo light changes pixels");
    const accepted = snapshots[1].validPixels;
    await page.locator("#cutoff").fill("0.5");
    await page.locator("#cutoff").dispatchEvent("input");
    assert.ok(
      (await page.evaluate(() => frontier.stats.validPixels)) < accepted,
      "depth cutoff changes mask without inference",
    );
    assert.equal(models.length, 1);
    await page.locator("#cutoff").fill("3");
    await page.locator("#cutoff").dispatchEvent("input");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      "no horizontal overflow",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    results.network = {
      modelRequests: models,
      external,
      preloadedModel: false,
    };
    await context.close();
  }
  const context = await browser.newContext(),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/model_quantized.onnx", (route) => route.abort());
  await page.goto("http://127.0.0.1:4173/tools/pages/frontier-relight.html");
  await page.waitForFunction(() => document.body.dataset.state === "ready");
  await page.locator("#photo").click();
  await page.waitForFunction(() => document.body.dataset.state === "error", null, {
    timeout: 30000,
  });
  assert.equal(await page.locator("#analytic").isEnabled(), true);
  await page.locator("#analytic").click();
  await page.waitForFunction(() => document.body.dataset.state === "ready");
  assert.equal(await page.getAttribute("body", "data-mode"), "analytic");
  assert.deepEqual(errors, []);
  results.failureRecovery = "blocked local model fetch surfaces an error; analytic check recovers";
  await context.close();
  fs.writeFileSync("/tmp/frontier-r2/browser-results.json", JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
