import { test, expect } from "@playwright/test";
import { noteFreq } from "../src/voices.js";

// Lane TF1 (October 17, 2026): One splat's picked splat and its sound at the top level, the
// periodic table's facts in full screen (and a switch to hide them), and a faster Volume viewer
// whose taps and drags land on the specimen at once.

const APP = (size) =>
  "/?labs=1&renderer=webgl2&adapt=off&profile=" + (size.width === 390 ? "low" : "high");

async function openToy(page, size, id) {
  await page.setViewportSize(size);
  await page.goto(APP(size));
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction(
    (id) =>
      window.__splashery.player.toyInfo?.id === id &&
      !window.__splashery.app.busy &&
      window.__splashery.player.motion?.ctx?.kit?.data,
    id,
    { timeout: 180_000 },
  );
}

// The camera glides to its front view for a few seconds after a toy opens.
const settledCamera = (page) =>
  page.waitForFunction(() => {
    const p = window.__splashery.player.stage.cameraEntity.getPosition();
    return Math.hypot(p.x, p.y) < 1e-3;
  });

// ---- One splat, many splats ------------------------------------------------------------------

test("One splat: every level's note is in a comfortable range", async () => {
  const { levelSound, LEVEL_NOTES } = await import("../src/packs/one-splat.js");
  for (let level = 0; level <= 14; level++) {
    const f = noteFreq(levelSound(level).f);
    expect(f, `level ${level}`).toBeGreaterThan(150);
    expect(f, `level ${level}`).toBeLessThan(1400);
  }
  // Finer is higher.
  const fs = LEVEL_NOTES.map(noteFreq);
  for (let i = 1; i < fs.length; i++) expect(fs[i]).toBeGreaterThan(fs[i - 1]);
});

for (const size of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`One splat: a tap marks its splat and sounds, at the top level and a low one, at ${size.width}×${size.height}`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openToy(page, size, "one-splat");
    await page.evaluate(() => {
      window.__cues = [];
      window.__splashery.player.on("cue", (cues) => window.__cues.push(...cues));
    });
    await settledCamera(page);
    // The splat nearest the middle, and where it shows.
    const middle = () =>
      page.evaluate(async () => {
        const { player } = window.__splashery;
        const { ids, tree, width, height } = player.motion.ctx.kit.data;
        const off = (i) => Math.abs(tree.mx[i] - width / 2) + Math.abs(tree.my[i] + height / 2);
        const id = ids.reduce((a, b) => (off(b) < off(a) ? b : a));
        const at = player.screenPoint([tree.mx[id] - width / 2, tree.my[id] + height / 2, 0]);
        const box = player.canvas.getBoundingClientRect();
        return { id, x: box.left + at[0], y: box.top + at[1] };
      });
    // A low level (the default, 64 splats): the tap splits the splat and marks it.
    let at = await middle();
    await page.mouse.click(at.x, at.y);
    const mark = page.locator("#one-splat-pick");
    await expect(mark).toHaveCount(1);
    await expect(mark).toHaveAttribute("data-splat", String(at.id));
    await expect.poll(() => page.evaluate(() => window.__cues.length)).toBe(1);
    await page.screenshot({ path: `tests/screenshots/tf1-one-splat-${size.width}x${size.height}.png` }); // prettier-ignore
    // The top level (16,384 splats): every splat is a leaf, so a tap splits nothing, but it still
    // marks the splat under the finger and sounds a note in range.
    await page.evaluate(() => window.__splashery.app.setToyOption("level", 14));
    await expect
      .poll(() => page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.ids.length))
      .toBe(16384);
    await settledCamera(page);
    await page.evaluate(() => (window.__cues = []));
    at = await middle();
    await page.mouse.click(at.x, at.y);
    await expect(mark).toHaveCount(1);
    await expect(page.locator("#one-splat-readout")).toContainText("Level 14");
    const picked = Number(await mark.getAttribute("data-splat"));
    expect(picked).toBeGreaterThanOrEqual(2 ** 14);
    // The ring sits on the finger (it never shrinks below a fingertip's mark).
    const [cx, cy] = (await mark.getAttribute("data-center")).split(",").map(Number);
    expect(Math.hypot(cx - at.x, cy - at.y)).toBeLessThan(12);
    const ring = await page.locator("#one-splat-pick ellipse.ring").evaluate((e) => ({
      rx: Number(e.getAttribute("rx")),
      ry: Number(e.getAttribute("ry")),
    }));
    expect(Math.min(ring.rx, ring.ry)).toBeGreaterThanOrEqual(10);
    await expect.poll(() => page.evaluate(() => window.__cues.length)).toBe(1);
    const f = noteFreq(await page.evaluate(() => window.__cues[0].f));
    expect(f).toBeGreaterThan(150);
    expect(f).toBeLessThan(1400);
    await page.screenshot({ path: `tests/screenshots/tf1-one-splat-top-${size.width}x${size.height}.png` }); // prettier-ignore
    // The mark clears with its readout.
    await expect(mark).toHaveCount(0, { timeout: 9000 });
    expect(errors).toEqual([]);
  });
}

// ---- Real elements -------------------------------------------------------------------------

async function liftSample(page) {
  await page.evaluate(() => window.__splashery.player.act(null));
  await page.waitForFunction(
    () => /29 Cu · Copper/.test(document.getElementById("toy-legend")?.innerText || ""),
    null,
    { timeout: 60_000 },
  );
}

for (const size of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`Real elements: the facts show in full screen, at ${size.width}×${size.height}`, async ({
    page,
  }) => {
    await openToy(page, size, "real-elements");
    await liftSample(page);
    const legend = page.locator("#toy-legend");
    await expect(legend).toBeVisible();
    await page.locator("#focus-toggle").click();
    await expect(page.locator("body")).toHaveClass(/focus/);
    await expect(legend).toBeVisible();
    // Inside the stage, clear of the corner's button that leaves full screen.
    const box = await legend.boundingBox();
    const exit = await page.locator("#focus-exit").boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width <= exit.x || box.y >= exit.y + exit.height).toBe(true);
    await page.screenshot({ path: `tests/screenshots/tf1-elements-focus-${size.width}x${size.height}.png` }); // prettier-ignore
    // Other toys' labels still leave full screen to the toy.
    const kept = await page.evaluate(() =>
      document.getElementById("toy-legend").classList.contains("in-focus"),
    );
    expect(kept).toBe(true);
  });
}

test("Real elements: Show info turns the facts off, and the choice is kept", async ({ page }) => {
  const size = { width: 1440, height: 900 };
  await openToy(page, size, "real-elements");
  const { RECIPES } = await import("../src/packs/real-elements.js");
  const opt = RECIPES["real-elements"].options.find((o) => o.key === "info");
  expect(opt).toMatchObject({ label: "Show info", type: "switch", default: true });
  await liftSample(page);
  await page.evaluate(() => window.__splashery.app.setToyOption("info", false));
  await page.waitForFunction(() => window.__splashery.player.scene.toy.options?.info === false);
  await page.waitForFunction(() => !window.__splashery.app.busy);
  await page.waitForTimeout(800);
  await expect(page.locator("#toy-legend")).toBeHidden();
  // Saved with the scene, like the toy's other options.
  const scene = await page.evaluate(() => {
    const s = window.__splashery.exportScene();
    return typeof s === "string" ? s : JSON.stringify(s);
  });
  expect(scene).toMatch(/"info":\s*false/);
  await page.evaluate(() => window.__splashery.app.setToyOption("info", true));
  await page.waitForFunction(() => !window.__splashery.app.busy);
  await page.evaluate(() => {
    const { player } = window.__splashery;
    if ((player.motion.targets.up ?? 0) < 0.5) player.act(null);
  });
  await expect(page.locator("#toy-legend")).toBeVisible({ timeout: 60_000 });
});

// ---- Volume viewer -------------------------------------------------------------------------

test("Volume viewer: the inside hides until a cut shows it; every point is sampled the same", async () => {
  const { RECIPES, VOLUME_STATE } = await import("../src/packs/volume-viewer.js");
  const { buildRecipe } = await import("../src/kit.js");
  const { resolveOptions } = await import("../src/player.js");
  const { sampleVolume, windowFor, sampleAt } = await import("../src/volume/view.js");
  const R = RECIPES["volume-viewer"];
  const o = resolveOptions(R, { source: "walnut" });
  await R.prepare(o, null, { count: 60000 });
  // prepare sampled the lattice ahead, and build used it.
  expect(VOLUME_STATE.sampled?.lattice?.n).toBeGreaterThan(30000);
  const it = buildRecipe(R, { seed: 3, count: 60000, options: o }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  const { kit } = b.value;
  const D = kit.data.depth;
  expect(D.n).toBe(12);
  expect(kit.data.tapBox.max).toEqual(kit.data.half);
  // The same lattice, sampled at once.
  const V = VOLUME_STATE.current;
  const [lo] = windowFor(V, o);
  const S = sampleVolume(V, { lo, budget: 60000, sheets: { axis: 2, k: 3, flat: false } });
  expect(S.n).toBe(VOLUME_STATE.sampled.lattice.n);
  // The trilinear sample agrees with a plain one.
  const plain = (x, y, z) => {
    const x0 = Math.floor(x),
      y0 = Math.floor(y),
      z0 = Math.floor(z);
    let s = 0;
    for (const [i, j, k] of [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]]) // prettier-ignore
      s += V.data[((z0 + k) * V.ny + y0 + j) * V.nx + x0 + i] * (i ? x - x0 : 1 - x + x0) * (j ? y - y0 : 1 - y + y0) * (k ? z - z0 : 1 - z + z0); // prettier-ignore
    return s;
  };
  for (const [x, y, z] of [[10.3, 20.7, 30.1], [56.5, 57.25, 70.9], [1.01, 100.4, 5.5]]) // prettier-ignore
    expect(sampleAt(V, x, y, z)).toBeCloseTo(plain(x, y, z), 6);
  const drive = () => {
    const out = { parts: {}, cues: [] };
    R.drive(1, { sweep: 0, step: 0 }, out, { time: 1, data: kit.data });
    return Object.values(out.parts).filter((p) => p.visible).length;
  };
  // Nothing cut away: no inside drawn. A cut at the middle: only the parts at its face.
  VOLUME_STATE.cut.key = kit.data.key;
  VOLUME_STATE.cut.at = 1;
  expect(drive()).toBe(0);
  VOLUME_STATE.cut.at = 0.5;
  const shown = drive();
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThanOrEqual(5);
  // The Layers view shows the inside through, so all of it draws.
  const layers = { ...kit.data, layers: true };
  const out = { parts: {}, cues: [] };
  R.drive(1, { sweep: 0, step: 0 }, out, { time: 1, data: layers });
  expect(Object.values(out.parts).every((p) => p.visible === 1)).toBe(true);
  // Leave the module as a fresh page finds it (the specs share one worker).
  VOLUME_STATE.cut.at = 1;
  VOLUME_STATE.cut.key = "";
});

for (const source of ["walnut", "gar"]) {
  test(`Volume viewer (${source}): a tap and a drag on the specimen answer at once`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const size = { width: 390, height: 844 };
    await openToy(page, size, "volume-viewer");
    if (source !== "walnut") {
      await page.evaluate((s) => window.__splashery.app.setToyOption("source", s), source);
      await page.waitForFunction(
        (s) =>
          window.__splashery.player.scene.toy.options?.source === s &&
          !window.__splashery.app.busy &&
          !window.__splashery.player.switching &&
          window.__splashery.player.motion.ctx.kit.data.key.startsWith(s),
        source,
        { timeout: 180_000 },
      );
    }
    await page.waitForTimeout(3000);
    // Points on the specimen: its middle, and two thirds of the way to its edges.
    const pts = await page.evaluate(() => {
      const { player } = window.__splashery;
      const h = player.motion.ctx.kit.data.half;
      const box = player.canvas.getBoundingClientRect();
      return [
        [0, 0, h[2]],
        [h[0] * 0.6, h[1] * 0.3, h[2]],
        [-h[0] * 0.5, -h[1] * 0.5, h[2]],
      ].map((p) => {
        const s = player.screenPoint(p);
        return { x: box.left + s[0], y: box.top + s[1] };
      });
    });
    // The press is taken by the volume's box, with no pick-buffer render.
    for (const p of pts) {
      const hit = await page.evaluate(({ x, y }) => {
        const { player } = window.__splashery;
        const box = player.canvas.getBoundingClientRect();
        return player.boxPick(x - box.left, y - box.top);
      }, p);
      expect(hit).not.toBeNull();
    }
    // A drag moves the cut, and the first move lands quickly.
    const cutAt = () =>
      page.evaluate(async () => (await import("/src/packs/volume-viewer.js")).VOLUME_STATE.cut.at);
    expect(await cutAt()).toBe(1);
    const start = pts[0];
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y + 10);
    await page.mouse.move(start.x, start.y + 20);
    await expect.poll(cutAt, { timeout: 2000 }).toBeLessThan(1);
    for (let i = 3; i <= 12; i++) await page.mouse.move(start.x, start.y + i * 10);
    await page.mouse.up();
    expect(await cutAt()).toBeLessThan(0.9);
    // A tap on the specimen steps the preset at once (the sound and the change, not the sound
    // alone), and the next preset is drawn soon after.
    const preset = () =>
      page.evaluate(() => window.__splashery.player.scene.toy.options?.preset ?? "full");
    const before = await preset();
    await page.mouse.click(pts[1].x, pts[1].y);
    await expect.poll(preset, { timeout: 1000 }).not.toBe(before);
    await page.waitForFunction(
      () => !window.__splashery.player.switching && !window.__splashery.app.busy,
      null,
      { timeout: 60_000 },
    );
    expect(await page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.depth?.n)).toBe(12); // prettier-ignore
    await page.screenshot({ path: `tests/screenshots/tf1-volume-${source}-390x844.png` });
    expect(errors).toEqual([]);
  });
}

test("Volume viewer at 1440×900: the cut face draws whole", async ({ page }) => {
  await openToy(page, { width: 1440, height: 900 }, "volume-viewer");
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    (await import("/src/packs/volume-viewer.js")).VOLUME_STATE.cut.at = 0.5;
    window.__splashery.player.stage.requestRender();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "tests/screenshots/tf1-volume-walnut-1440x900.png" });
});
