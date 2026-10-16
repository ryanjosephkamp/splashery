import { test, expect } from "@playwright/test";

// The portfolio verifier's independent checks: conservation, brute-force
// moments, principal-axis median partitions, coverage, and eigen round trips.
test("every pixel-tree split conserves mass, mean, and covariance", async () => {
  const { buildTree, node, checkSplit, checkTree, eig, covariance, PIXEL } =
    await import("../src/packs/one-splat.js");
  const shapes = {
    bar: (u, v) => [u * 900, v * 40],
    ring: (u, v) => [
      Math.cos(u * Math.PI * 2) * (200 + v * 30),
      Math.sin(u * Math.PI * 2) * (200 + v * 30),
    ],
    diagonal: (u, v) => [u * 500 + v * 30, u * 500 - v * 30],
    dust: (u, v) => [u * 1000, v * 1000],
    islands: (u, v) => [(u < 0.5 ? 0 : 800) + v * 60, ((u * 977) % 1) * 60],
    line: (u) => [Math.floor(u * 300) + 0.5, 0.5],
    grid: (u, v, i) => [(i % 64) + 0.5, Math.floor(i / 64) + 0.5],
    point: () => [3.5, 7.5],
  };
  for (const [shape, at] of Object.entries(shapes)) {
    for (const count of [1, 2, 3, 7, 64, 1000, 4096, 50000]) {
      for (const level of [0, 1, 5, 14]) {
        let seed = count * 31 + level;
        const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
        const xs = new Float32Array(count),
          ys = new Float32Array(count);
        for (let i = 0; i < count; i++) [xs[i], ys[i]] = at(rand(), rand(), i);
        const tree = buildTree(xs, ys, level);
        let worst = 0;
        for (let i = 1; i < tree.size; i++) {
          const ids = Array.from(tree.idx.slice(tree.lo[i], tree.hi[i]));
          const n = ids.length;
          if (n < 1) throw new Error("empty node");
          const mx = ids.reduce((s, j) => s + xs[j], 0) / n;
          const my = ids.reduce((s, j) => s + ys[j], 0) / n;
          const a = ids.reduce((s, j) => s + (xs[j] - mx) ** 2, 0) / n + PIXEL;
          const b = ids.reduce((s, j) => s + (xs[j] - mx) * (ys[j] - my), 0) / n;
          const c = ids.reduce((s, j) => s + (ys[j] - my) ** 2, 0) / n + PIXEL;
          const stored = node(tree, i);
          for (const key of ["n", "mx", "my", "a", "b", "c"]) {
            const value = { n, mx, my, a, b, c }[key];
            if (Math.abs(stored[key] - value) > 1e-9 * (a + c))
              throw new Error(`node ${i}: ${key}`);
          }
          if (i * 2 + 1 >= tree.size) continue;
          const l = node(tree, i * 2),
            r = node(tree, i * 2 + 1);
          const split = checkSplit(stored, l, r);
          worst = Math.max(worst, split.residual);
          if (Math.abs(l.n - r.n) > 1) throw new Error("unbalanced split");
          // Symmetric grids can have repeated eigenvalues. Use the stored
          // covariance's chosen axis, as the reference verifier does.
          const angle = eig(stored.a, stored.b, stored.c).theta;
          const projection = (j) =>
            Math.fround((xs[j] - mx) * Math.cos(angle) + (ys[j] - my) * Math.sin(angle));
          const left = Array.from(tree.idx.slice(tree.lo[i * 2], tree.hi[i * 2]), projection);
          const right = Array.from(
            tree.idx.slice(tree.lo[i * 2 + 1], tree.hi[i * 2 + 1]),
            projection,
          );
          if (Math.max(...left) > Math.min(...right) + 1e-10 * Math.sqrt(a + c))
            throw new Error(
              `not a principal-axis median: ${shape}, n=${count}, level=${level}, node=${i}, left=${Math.max(...left)}, right=${Math.min(...right)}, angle=${angle}`,
            );
        }
        expect(worst).toBeLessThan(1e-9);
        const report = checkTree(tree);
        expect(report.splits).toBe(tree.size / 2 - 1);
        expect(report.worst).toBe(worst);
        if (report.at)
          expect(
            checkSplit(
              node(tree, report.at),
              node(tree, report.at * 2),
              node(tree, report.at * 2 + 1),
            ).residual,
          ).toBe(worst);
        for (let depth = 0; depth <= tree.levels; depth++) {
          const seen = new Uint8Array(count);
          for (let i = 2 ** depth; i < 2 ** (depth + 1); i++)
            for (let j = tree.lo[i]; j < tree.hi[i]; j++) seen[tree.idx[j]]++;
          expect(seen.every((v) => v === 1)).toBe(true);
        }
      }
    }
  }
  for (const s1 of [0.5, 4, 30, 300])
    for (const s2 of [0.25, 0.45])
      for (let deg = -89; deg <= 89; deg += 7) {
        const angle = (deg * Math.PI) / 180;
        const c = covariance(s1, s2, angle),
          e = eig(c.a, c.b, c.c);
        expect(Math.sqrt(e.l1)).toBeCloseTo(s1, 8);
        expect(Math.sqrt(e.l2)).toBeCloseTo(s2, 6);
        expect(e.theta).toBeCloseTo(angle, 8);
      }
});

test("levels and individual refinements partition the original pixels", async () => {
  const { buildTree, frontier } = await import("../src/packs/one-splat.js");
  const xs = Float32Array.from({ length: 20000 }, (_, i) => i % 200);
  const ys = Float32Array.from(xs, (_, i) => Math.floor(i / 200));
  const tree = buildTree(xs, ys, 14);
  for (let level = 0; level <= 14; level++)
    expect(frontier(tree, level, "").length).toBe(2 ** level);
  const ids = frontier(tree, 2, "4,8");
  expect(ids).toEqual([16, 17, 9, 5, 6, 7]);
  expect(ids.reduce((sum, id) => sum + tree.n[id], 0)).toBe(xs.length);
});

async function open(page, size) {
  await page.setViewportSize(size);
  await page.goto(
    "/?labs=1&renderer=webgl2&adapt=off&profile=" + (size.width === 390 ? "low" : "high"),
  );
  await page.waitForSelector("body[data-ready='true']");
  await page.evaluate(() => window.__splashery.app.chooseToy("one-splat"));
  await page.waitForFunction(
    () => window.__splashery.player.toyInfo?.id === "one-splat" && !window.__splashery.app.busy,
  );
}

async function firstSplat(page) {
  return page.evaluate(async () => {
    const { player } = window.__splashery;
    const ctx = player.motion.ctx,
      data = ctx.kit.data;
    const i = data.ids[0],
      tree = data.tree;
    const world = Array.from(ctx.buf.pos.slice(0, 3));
    const pc = await import("/src/pc.js");
    const cam = player.stage.cameraEntity.camera;
    const vp = new pc.Mat4().mul2(cam.projectionMatrix, cam.viewMatrix);
    const q = vp.transformVec4(new pc.Vec4(...world, 1), new pc.Vec4());
    const box = document.querySelector("#stage").getBoundingClientRect();
    return {
      id: i,
      world,
      x: box.x + ((q.x / q.w + 1) * box.width) / 2,
      y: box.y + ((1 - q.y / q.w) * box.height) / 2,
    };
  });
}

for (const size of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`a word opens, splits, and exposes its numbers at ${size.width}×${size.height}`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, size);
    // Lane PT2: the toy opens at level 4 (16 splats), so a tap visibly splits.
    expect(await page.evaluate(() => window.__splashery.player.motion.ctx.buf.count)).toBe(16);
    await page.screenshot({
      path: `tests/screenshots/cdx-pfa-one-splat-${size.width}x${size.height}.png`,
    });
    await page.evaluate(() => window.__splashery.app.setToyOption("level", 0));
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.buf.count))
      .toBe(1);
    const splat = await firstSplat(page);
    await page.mouse.move(splat.x, splat.y);
    await page.mouse.down();
    await expect(page.locator("#one-splat-readout")).toBeVisible();
    await expect(page.locator("#one-splat-readout")).toContainText("Center:");
    await expect(page.locator("#one-splat-readout")).toContainText("Size (σ):");
    await expect(page.locator("#one-splat-readout")).toContainText("Angle:");
    await page.mouse.up();
    await expect(page.locator("#one-splat-readout")).toHaveCount(0);
    expect(await page.evaluate(() => window.__splashery.player.motion.ctx.buf.count)).toBe(1);
    await page.mouse.click(splat.x, splat.y);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.buf.count))
      .toBe(3); // lane PT2: the two children, and their parent fading as they leave it
    expect(await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.ids)).toEqual([
      2, 3,
    ]);
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.state.split))
      .toBeLessThan(0.01);
    await page.evaluate(() => window.__splashery.app.setToyOption("level", 14));
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.buf.count))
      .toBe(16384);
    expect(errors).toEqual([]);
  });
}

test("local pictures carry color, and scene links fall back without uploading them", async ({
  page,
}) => {
  await open(page, { width: 390, height: 844 });
  const result = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    const recipe = player.toyInfo.recipe;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const g = canvas.getContext("2d");
    g.fillStyle = "#ff0000";
    g.fillRect(0, 0, 32, 64);
    g.fillStyle = "#0000ff";
    g.fillRect(32, 0, 32, 64);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve));
    const options = await recipe.input.read(
      "",
      "test.png",
      new File([blob], "test.png", { type: "image/png" }),
    );
    await app.setToyOptions(options);
    const buf = player.motion.ctx.buf;
    const color = Array.from(buf.color.slice(0, 3));
    const { encodeSceneHash, decodeSceneHash } = await import("/src/codec.js");
    const saved = await decodeSceneHash(await encodeSceneHash(player.scene));
    await app.setToyOption("picture", "unavailable.png");
    return {
      color,
      saved: saved.toy.options.picture,
      shown: recipe.input.shown(),
      count: buf.count,
    };
  });
  expect(result.count).toBe(16); // lane PT2: level 4 by default
  expect(result.color[1]).toBe(0);
  expect(result.saved).toBe("test.png");
  expect(result.shown).toContain("Picture unavailable");
});

test("a sparse transparent picture still reaches 16,384 nonempty splats", async ({ page }) => {
  await open(page, { width: 390, height: 844 });
  const result = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const g = canvas.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, 1, 1);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve));
    const opts = await player.toyInfo.recipe.input.read(
      "",
      "sparse.png",
      new File([blob], "sparse.png", { type: "image/png" }),
    );
    await app.setToyOptions({ ...opts, level: 14 });
    return { count: player.motion.ctx.buf.count, n: player.motion.ctx.kit.data.tree.total };
  });
  expect(result.count).toBe(16384);
  expect(result.n).toBeGreaterThanOrEqual(16384);
});

// Conservation is a property of moments, not of the chosen median partition.
test("arbitrary straight cuts and random divisions conserve the pixel moments", async () => {
  const { moments, checkSplit } = await import("../src/packs/one-splat.js");
  let seed = 78;
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  for (const count of [2, 3, 7, 64, 1000, 4096, 50000]) {
    const xs = Float32Array.from({ length: count }, () => Math.cos(rand() * Math.PI * 2) * 200);
    const ys = Float32Array.from(xs, () => rand() * 40);
    const all = Uint32Array.from(xs, (_, i) => i);
    const parent = moments(xs, ys, all, 0, count);
    let worst = 0;
    for (let trial = 0; trial < 200; trial++) {
      const angle = rand() * Math.PI,
        share = rand(),
        vx = Math.cos(angle),
        vy = Math.sin(angle);
      const through = Math.floor(rand() * count),
        threshold = xs[through] * vx + ys[through] * vy;
      const order = new Uint32Array(count);
      let left = 0,
        right = count;
      for (let j = 0; j < count; j++) {
        if (trial % 2 ? rand() < share : xs[j] * vx + ys[j] * vy < threshold) order[left++] = j;
        else order[--right] = j;
      }
      const cut = Math.min(count - 1, Math.max(1, left));
      const split = checkSplit(
        parent,
        moments(xs, ys, order, 0, cut),
        moments(xs, ys, order, cut, count),
      );
      expect(split.sum.n).toBe(count);
      worst = Math.max(worst, split.residual);
    }
    expect(worst).toBeLessThan(1e-9);
  }
});

test("a custom word keeps all 32 Unicode characters through fitting", async () => {
  const { RECIPES } = await import("../src/packs/one-splat.js");
  const { Kit } = await import("../src/kit.js");
  const r = RECIPES["one-splat"];
  const word = "A".repeat(31) + "🧩";
  const options = { ...(await r.input.read(word)), level: 13 };
  r.prepare(options);
  r.build(new Kit(1, { count: 8000 }), options);
  expect(r.input.shown()).toContain(word);
  await expect(r.input.read(word + "B")).rejects.toThrow("32 characters");
});
