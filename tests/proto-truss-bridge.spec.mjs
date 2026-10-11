import { test, expect } from "@playwright/test";
import { analyze, collapseState, makeTruss, STEP, stepCollapse } from "../src/packs/proto-truss-bridge/analysis.js"; // prettier-ignore
import { buildRecipe } from "../src/kit.js";
import { RECIPES } from "../src/packs/proto-truss-bridge.js";
import { TOYS } from "../src/toys.js";

const recipe = RECIPES["truss-bridge"];

test("symmetric Warren center load matches all textbook joint-equilibrium forces within 1%", () => {
  // Equilateral triangles, P = 100 kN. From ΣFx = ΣFy = 0:
  // reactions P/2; diagonal magnitudes P/√3; chord forces follow the
  // successive horizontal joint balances. These values are independent
  // of the displacement solver and the chosen EA.
  const q = 100 / Math.sqrt(3);
  const expected = [q / 2, 1.5 * q, 1.5 * q, q / 2, -q, -2 * q, -q, -q, q, -q, q, q, -q, q, -q]; // prettier-ignore
  const r = analyze(makeTruss("warren"), 100, 6);
  expected.forEach((v, i) => expect(Math.abs((r.forces[i] - v) / v), `M${i + 1}`).toBeLessThan(0.01)); // prettier-ignore
  expect(r.reactions[1] / 1000).toBeCloseTo(50, 8);
  expect(r.reactions[9] / 1000).toBeCloseTo(50, 8);
});

test("all three trusses balance joint forces, support forces, and moments as the load moves", () => {
  for (const style of ["warren", "pratt", "howe"]) {
    const truss = makeTruss(style);
    for (const x of [0, 0.6, 3, 4.8, 6, 9.7, 12]) {
      const r = analyze(truss, 137, x);
      expect(r.reactions[1]).toBeCloseTo(137000 * (1 - x / 12), 5);
      expect(r.reactions[9]).toBeCloseTo((137000 * x) / 12, 5);
      const balance = truss.nodes.map(() => [0, 0]);
      truss.members.forEach(({ a, b }, i) => {
        const delta = truss.nodes[b].map((v, d) => v - truss.nodes[a][d]);
        const L = Math.hypot(...delta);
        for (let d = 0; d < 2; d++) {
          balance[a][d] += (1000 * r.forces[i] * delta[d]) / L;
          balance[b][d] -= (1000 * r.forces[i] * delta[d]) / L;
        }
      });
      balance[0][0] += r.reactions[0];
      balance[0][1] += r.reactions[1];
      balance[4][1] += r.reactions[9];
      const panel = Math.min(3, Math.floor(x / 3));
      const fraction = (x - panel * 3) / 3;
      balance[panel][1] -= 137000 * (1 - fraction);
      balance[panel + 1][1] -= 137000 * fraction;
      for (const b of balance) for (const v of b) expect(Math.abs(v)).toBeLessThan(1e-6);
    }
  }
});

test("collapse keeps the pin, roller, and intact bar lengths constrained at a fixed time step", () => {
  for (const style of ["warren", "pratt", "howe"]) {
    const truss = makeTruss(style);
    const broken = analyze(truss).weakest;
    const s = collapseState(truss, broken);
    for (let i = 0; i < 336; i++) stepCollapse(s);
    expect(s.time).toBeCloseTo(336 * STEP, 8);
    expect(s.nodes[0]).toEqual([0, 0]);
    expect(s.nodes[4][1]).toBe(0);
    expect(s.nodes[2][1]).toBeLessThan(-0.5);
    truss.members.forEach(({ a, b }, i) => {
      if (i === broken) return;
      const length = (nodes) => Math.hypot(...nodes[a].map((v, d) => v - nodes[b][d]));
      expect(Math.abs(length(s.nodes) / length(truss.nodes) - 1), `${style} M${i + 1}`).toBeLessThan(0.01); // prettier-ignore
    });
  }
});

test("labs metadata and every style stay below 15,000 splats", () => {
  expect(TOYS.find((t) => t.id === "truss-bridge")).toMatchObject({ labs: true, category: "science" }); // prettier-ignore
  for (const style of ["warren", "pratt", "howe"]) {
    const it = buildRecipe(recipe, { seed: 5, count: 60000, options: { style, strength: 140 } }, () => {}); // prettier-ignore
    let b = it.next();
    while (!b.done) b = it.next();
    expect(b.value.buf.count).toBeLessThan(15000);
  }
});

test("overload motion is independent of frame rate, and both fragments return continuously", () => {
  const run = (fps) => {
    const it = buildRecipe(recipe, { seed: 5, count: 6000, options: { style: "warren", strength: 100 } }, () => {}); // prettier-ignore
    let b = it.next();
    while (!b.done) b = it.next();
    const data = b.value.kit.data;
    const frame = (elapsed, n) => {
      const out = { parts: {}, cues: [] };
      recipe.drive(elapsed, { load: 4 / 9, test: n ? 1 - elapsed / 4.4 : 0 }, out, { data, tap: n ? { n } : null }); // prettier-ignore
      return out;
    };
    const rest = frame(0, 0);
    frame(0, 1);
    for (let i = 1; i <= fps; i++) frame(i / fps, 1);
    expect(data.broken).toBe(5);
    const mid = frame(1, 1);
    const last = frame(4.399, 1);
    const end = frame(4.4, 1);
    for (let i = 0; i <= 34; i++) {
      expect(end.tokens[i]).toEqual(rest.tokens[i]);
      for (let d = 0; d < 3; d++)
        expect(Math.abs(last.tokens[i].offset[d] - end.tokens[i].offset[d])).toBeLessThan(0.001); // prettier-ignore
    }
    expect(mid.tokens[10].offset).not.toEqual(mid.tokens[11].offset);
    return mid.tokens;
  };
  expect(run(10)).toEqual(run(60));
});

async function open(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto("/?renderer=webgl2&labs=1&profile=weak&adapt=off");
  await page.waitForSelector("body[data-ready='true']");
  await page.evaluate(() => window.__splashery.app.chooseToy("truss-bridge"));
  await expect(page.locator("#toy-status")).toHaveText(/^Truss bridge load lab/);
  await expect(page.locator("#toy-legend")).toContainText("M6: 115.5 kN C");
  // Capture at exact effect times, even when software rendering is slow.
  await page.evaluate(() => {
    const stage = window.__splashery.app.player.stage;
    const handlers = stage.updateHandlers.splice(0);
    let pending = 0;
    stage.updateHandlers.push(() => {
      const dt = pending;
      pending = 0;
      handlers.forEach((h) => h(dt));
    });
    window.__trussStep = async (dt) => {
      pending = dt;
      await stage.captureFrame();
      await stage.captureFrame();
    };
  });
  await page.evaluate(() => window.__trussStep(0));
}

async function advance(page, seconds) {
  await page.evaluate(async (seconds) => {
    for (let t = 0; t < seconds - 1e-8; t += 1 / 30) await window.__trussStep(1 / 30);
  }, seconds);
}

for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  test(`loads with labs, shows known kN values, and center tap moves solid pieces at ${width}x${height}`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, width, height);
    // The allowed files exclude shelf thumbnails. The stock shelf requests
    // its absent thumb during load; watch console errors after loading so
    // this check specifically covers the requested tap runtime.
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.screenshot({ path: `tests/screenshots/proto-truss-bridge-${width}x${height}.png` });
    const before = await page.evaluate(() => window.__splashery.app.player.motion.out.tokens[34].offset[1]); // prettier-ignore
    const canvas = await page.locator("canvas").first().boundingBox();
    await page.touchscreen.tap(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await advance(page, 0.3);
    const after = await page.evaluate(() => window.__splashery.app.player.motion.out.tokens[34].offset[1]); // prettier-ignore
    expect(after - before).toBeGreaterThan(0.5);
    await page.screenshot({
      path: `tests/screenshots/proto-truss-bridge-${width}x${height}-tap.png`,
    });
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test("touch drag moves the load and overload breaks the actual weakest member, then restores the bridge", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  await open(page, 390, 844);
  const client = await ctx.newCDPSession(page);
  // Project the actual weight center to screen, then perform real touch input.
  const at = await page.evaluate(() => {
    const p = window.__splashery.app.player;
    const tf = p.motion.ctx.transform;
    const w = [0, 0.6, 0].map((v, i) => (v - tf.center[i]) * tf.scale);
    const [x, y] = p.stage.toScreen(p.stage.modelToWorld(w));
    return { x, y };
  });
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at] });
  // Picking is asynchronous; a real finger spends time pressed before it
  // moves. Wait for the engine to hand that press to the recipe.
  await page.waitForFunction(async () => (await import("/src/packs/proto-truss-bridge.js")).bridgeState().dragging); // prettier-ignore
  await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: at.x + 55, y: at.y }] }); // prettier-ignore
  await page.evaluate(() => window.__trussStep(1 / 30));
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const position = await page.evaluate(async () => (await import("/src/packs/proto-truss-bridge.js")).bridgeState().position); // prettier-ignore
  expect(position).toBeGreaterThan(7);
  await advance(page, 4.5);
  // Increase load through the existing live control, then use a real tap.
  await page.evaluate(() => {
    const motion = window.__splashery.app.player.motion;
    motion.state.load = 1;
    motion.targets.load = 1;
  });
  await page.evaluate(() => window.__trussStep(1 / 30));
  const canvas = await page.locator("canvas").first().boundingBox();
  await page.touchscreen.tap(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await advance(page, 1);
  const failure = await page.evaluate(async () => {
    const s = (await import("/src/packs/proto-truss-bridge.js")).bridgeState();
    return { broken: s.broken, weakest: s.result.weakest, sag: s.collapse?.nodes[2][1] };
  });
  expect(failure.broken).toBe(failure.weakest);
  expect(failure.broken).toBeGreaterThanOrEqual(0);
  expect(failure.sag).toBeLessThan(-0.1);
  await page.screenshot({ path: "tests/screenshots/proto-truss-bridge-390x844-overload.png" });
  await advance(page, 3.5);
  const restored = await page.evaluate(async () => (await import("/src/packs/proto-truss-bridge.js")).bridgeState().broken); // prettier-ignore
  expect(restored).toBe(-1);
  await ctx.close();
});
