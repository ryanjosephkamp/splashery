// Lane Pages r6: Pop out for every page toy, and figures you choose
// (docs/handoff/PagesR6.md). In Node with stand-in pictures: nothing rises
// by itself; a tap raises a figure, another tap raises another, a tap on a
// risen one lays it back; a page turn lays them all back first; the depth
// slider and saved depths; a drag turn's page sound; the Picture lab. In the
// app: the switch across a page turn and a toy switch, the Picture lab on a
// PDF, a saved depth, old links and scenes. The engine's part is tested in
// tests/pg6-engine.spec.mjs.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

// ---- In Node: the recipes with stand-in pictures -------------------------------------

// Builds a toy in Node and plays it (as tests/bk5.spec.mjs does): tap(point)
// taps where it lands (recipe units), set(key, v) sets a control, run(s)
// steps the clock, slide(id, v) moves the stage slider.
async function play(id, options = {}, pics = null, extra = {}) {
  const { buildRecipe } = await import("../src/kit.js");
  const { RECIPES } = await import("../src/packs/pictures.js");
  const r = RECIPES[id];
  const opts = { ...Object.fromEntries((r.options || []).map((o) => [o.key, o.default])), ...options }; // prettier-ignore
  const it = buildRecipe(r, { seed: 5, count: 8000, options: opts }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  const data = { ...(b.value.kit.data || {}), pictures: pics };
  const c = { turn: 0, next: 0, pop: 0, box: 0 };
  let time = 1;
  let n = 0;
  let pick = null;
  let out = null;
  let slider = null;
  let figures = extra.figures || [];
  const cues = [];
  const frame = () => {
    out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null };
    r.drive(time, c, out, { time, R: 1, tap: n ? { n, pick } : null, data, slider, figures });
    if (Array.isArray(out.figures)) figures = out.figures;
    cues.push(...out.cues);
    return out;
  };
  const tap = (point) => {
    const a = r.action.at?.(point);
    pick = a?.pick ?? null;
    n++;
    return frame();
  };
  const run = (s) => {
    for (let t = 0; t < s; t += 1 / 30) {
      time += 1 / 30;
      frame();
    }
    return out;
  };
  const set = (key, v) => {
    c[key] = v;
    return frame();
  };
  const slide = (id, value) => {
    slider = { id, value, n: (slider?.n || 0) + 1 };
    return frame();
  };
  const settle = async () => {
    for (let i = 0; i < 4; i++) await new Promise((res) => setTimeout(res, 0));
  };
  return { r, tap, run, set, slide, frame, settle, cues, get out() { return out; }, get time() { return time; }, get figures() { return figures; } }; // prettier-ignore
}

// A canvas stand-in: a plain white picture with a dark block (a chart's bar).
function fakeCanvas(w = 40, h = 30) {
  const data = new Uint8ClampedArray(w * h * 4).fill(250);
  for (let y = 8; y < 22; y++) for (let x = 10; x < 30; x++) data.set([30, 60, 150, 255], (y * w + x) * 4); // prettier-ignore
  return { width: w, height: h, getContext: () => ({ getImageData: () => ({ data, width: w, height: h }) }) }; // prettier-ignore
}

// Page 1 has two figures, page 2 one.
const FIG_A = [0.1, 0.1, 0.45, 0.35];
const FIG_B = [0.5, 0.5, 0.9, 0.8];
const FIG_C = [0.2, 0.2, 0.7, 0.6];
function fakePics(count, kind = "pdf") {
  return {
    page: 0,
    count,
    kind,
    name: "test",
    opened: [],
    go(p) {
      this.page = Math.max(0, Math.min(count - 1, Math.round(p)));
      return this.page;
    },
    next() {
      return this.go(this.page + 1);
    },
    prev() {
      return this.go(this.page - 1);
    },
    ready: () => true,
    aspect: () => 612 / 792,
    links: async () => [],
    figures: async (n) => (n === 1 ? [{ box: FIG_A }, { box: FIG_B }] : n === 2 ? [{ box: FIG_C }] : []), // prettier-ignore
    crop: async () => fakeCanvas(),
    openLink() {
      return true;
    },
  };
}
const mid = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];

// Opens the book on spread 1 (page 1 on the right) with Pop out on.
async function openBook(opts = {}, extra = {}) {
  const { BOOKS_R5 } = await import("../src/packs/pictures.js");
  const pics = fakePics(9);
  const b = await play("your-book", opts, pics, extra);
  b.tap([0.4, 0, 0.02]);
  b.run(1.6);
  await b.settle();
  b.run(0.1);
  b.set("pop", 1);
  await b.settle();
  b.run(0.1);
  return { b, pics, BOOKS_R5, at: (f) => BOOKS_R5.point(1, f) };
}
const live = (PG) => PG.pops.map((F) => [F.target.page, F.target.box.join(","), F.phase]);

test.describe("Pop out in Your book (no browser)", () => {
  test("with Pop out on nothing rises by itself; taps raise two figures; a tap on one lays it back", async () => {
    const { b, pics, BOOKS_R5, at } = await openBook();
    const { PG } = BOOKS_R5;
    b.run(1.5);
    expect(PG.pops.length).toBe(0);
    expect(pics.page).toBe(1);
    // A tap on the first figure raises it.
    b.tap(at(mid(FIG_A)));
    await b.settle();
    b.run(1.5);
    expect(live(PG)).toEqual([[1, FIG_A.join(","), "up"]]);
    expect(b.out.parts.bk5pop0.visible).toBe(1);
    expect(b.out.tiltFree).toBe(true);
    // A tap on the second raises it too; the first stays up.
    b.tap(at(mid(FIG_B)));
    await b.settle();
    b.run(1.5);
    expect(live(PG).map((x) => x[2])).toEqual(["up", "up"]);
    expect(b.out.parts.bk5pop1.visible).toBe(1);
    // Both places are empty on the page (one sheet, two holes).
    const hole = Object.values(b.out.sheets).find((s) => s.variant?.startsWith("hole:"));
    expect(hole.variant.split(";").length).toBe(2);
    // The page did not turn.
    expect(pics.page).toBe(1);
    // A tap on the first (where it stands now) lays it back; the second stays.
    const F0 = PG.pops[0];
    b.tap([F0.at.cx, F0.at.cy, 0.3]);
    b.run(1.5);
    expect(live(PG)).toEqual([[1, FIG_B.join(","), "up"]]);
    expect(b.out.parts.bk5pop0.visible).toBe(0);
    expect(pics.page).toBe(1);
  });

  test("a tap off the figures turns the page, and every risen figure lays back first", async () => {
    const { b, pics, BOOKS_R5, at } = await openBook();
    const { PG } = BOOKS_R5;
    b.tap(at(mid(FIG_A)));
    b.tap(at(mid(FIG_B)));
    await b.settle();
    b.run(1.5);
    expect(PG.pops.length).toBe(2);
    // Off the figures, on the right page: a turn forward. It waits.
    b.tap(at([0.3, 0.92]));
    b.run(0.1);
    expect(PG.pops.every((F) => F.phase === "fall" || F.phase === "unhole")).toBe(true);
    expect(pics.page).toBe(1);
    b.run(1);
    expect(PG.pops.length).toBe(0);
    expect(pics.page).toBe(3);
    // The Toy tab's Next works the same way.
    b.run(1.5);
    await b.settle();
    b.run(0.1);
    b.tap(BOOKS_R5.point(3, [0.5, 0.5]));
    expect(PG.pops.length).toBe(0); // (page 3 has no figures: a turn)
  });

  test("a drag turn lays the figures back before the page follows, and plays the page sound once", async () => {
    const { b, pics, BOOKS_R5, at } = await openBook();
    const { PG } = BOOKS_R5;
    b.tap(at(mid(FIG_A)));
    await b.settle();
    b.run(1.5);
    expect(PG.pops.length).toBe(1);
    const drag = b.r.drag;
    const p0 = at([0.85, 0.9]);
    expect(drag.at(p0)).toBe(true);
    drag.start(p0, b.time);
    drag.move([p0[0] - 0.2, p0[1], p0[2]], b.time);
    b.frame();
    expect(PG.pops[0].phase).toBe("fall");
    b.run(0.8);
    expect(PG.pops.length).toBe(0);
    const before = b.cues.length;
    for (let i = 1; i <= 20; i++) {
      drag.move([p0[0] - 0.2 - 0.07 * i, p0[1], p0[2]], b.time);
      b.run(0.05);
    }
    drag.end(b.time);
    b.run(1.5);
    expect(pics.page).toBe(3);
    const page = b.cues
      .slice(before)
      .filter((c) => (Array.isArray(c) ? c[0] : c).voice === "sample");
    expect(page.length).toBe(1);
  });

  test("a drag that falls back makes no page sound, only a soft settle", async () => {
    const { b, pics, at } = await openBook();
    const drag = b.r.drag;
    const p0 = at([0.85, 0.9]);
    drag.start(p0, b.time);
    for (let i = 1; i <= 5; i++) {
      drag.move([p0[0] - 0.06 * i, p0[1], p0[2]], b.time);
      b.run(0.1);
    }
    const before = b.cues.length;
    drag.end(b.time);
    b.run(1.5);
    expect(pics.page).toBe(1);
    const cues = b.cues.slice(before).map((c) => (Array.isArray(c) ? c[0] : c));
    expect(cues.some((c) => c.voice === "sample")).toBe(false);
    expect(cues.filter((c) => c.voice === "thud").length).toBeLessThanOrEqual(1);
  });

  test("three figures at most: a fourth lays the oldest back", async () => {
    const { b, BOOKS_R5, at } = await openBook({ reading: "both" });
    const { PG } = BOOKS_R5;
    b.tap(at(mid(FIG_A)));
    b.tap(at(mid(FIG_B)));
    await b.settle();
    b.run(1.5);
    // Draw a box for the third and the fourth.
    b.set("box", 1);
    const drag = b.r.drag;
    for (const box of [
      [0.05, 0.6, 0.35, 0.95],
      [0.6, 0.05, 0.95, 0.3],
    ]) {
      const p0 = at([box[0], box[1]]);
      const p1 = at([box[2], box[3]]);
      expect(drag.at(p0)).toBe(true);
      drag.start(p0, b.time);
      drag.move(p1, b.time);
      drag.end(b.time);
      await b.settle();
      b.run(2);
    }
    // (The fourth starts once the oldest is down.)
    await b.settle();
    b.run(1.5);
    const up = PG.pops.filter((F) => F.phase === "up");
    expect(up.length).toBe(3);
    expect(up.some((F) => F.target.box.join() === FIG_A.join())).toBe(false);
  });

  test("Pop out off lays the tapped figures back; a drawn box stays", async () => {
    const { b, BOOKS_R5, at } = await openBook();
    const { PG } = BOOKS_R5;
    b.tap(at(mid(FIG_A)));
    await b.settle();
    b.run(1.5);
    b.set("box", 1);
    const drag = b.r.drag;
    drag.start(at([0.05, 0.6]), b.time);
    drag.move(at([0.35, 0.95]), b.time);
    drag.end(b.time);
    await b.settle();
    b.run(2);
    expect(PG.pops.length).toBe(2);
    b.set("pop", 0);
    b.run(1.5);
    expect(PG.pops.length).toBe(1);
    expect(PG.pops[0].manual).toBe(true);
  });

  test("the depth slider deepens the figure raised last and keeps it in the scene; it comes back", async () => {
    const { b, BOOKS_R5, at } = await openBook();
    const { PG } = BOOKS_R5;
    b.tap(at(mid(FIG_A)));
    await b.settle();
    b.run(1.5);
    const F = PG.pops[0];
    expect(b.out.slider).toMatchObject({ id: `pg${F.id}`, label: "Depth", value: 0 });
    const flat = b.out.sheets.pop0.relief;
    b.slide(`pg${F.id}`, 0.5);
    expect(F.depth).toBe(3);
    expect(b.figures).toEqual([{ page: 1, box: FIG_A, depth: 3 }]);
    const deep = b.out.sheets.pop0.relief;
    expect(deep.depth).toBeCloseTo(flat.depth * 3, 6);
    expect(deep.key).not.toBe(flat.key);
    // A figure raised again (or a page opened from the scene) takes its depth.
    const saved = b.figures;
    const { b: b2, BOOKS_R5: R2, at: at2 } = await openBook({}, { figures: saved });
    b2.tap(at2(mid(FIG_A)));
    await b2.settle();
    b2.run(1.5);
    expect(R2.PG.pops[0].depth).toBe(3);
    expect(b2.out.slider.value).toBeCloseTo(0.5, 5);
    // Back to its own depth: dropped from the scene.
    b2.slide(`pg${R2.PG.pops[0].id}`, 0);
    expect(b2.figures).toEqual([]);
  });
});

test.describe("Pop out in the Photo album and the Picture lab (no browser)", () => {
  test("the album raises two photos in turn; a tap on one lays it back", async () => {
    const { BOOKS_R5 } = await import("../src/packs/pictures.js");
    const { PG } = BOOKS_R5;
    const pics = { ...fakePics(4, "image"), aspect: () => 1.5, crop: async () => null };
    const b = await play("photo-album", {}, pics);
    b.tap([0.4, 0, 0.02]);
    b.run(1.8);
    b.set("pop", 1);
    b.run(1);
    expect(PG.pops.length).toBe(0);
    b.tap(BOOKS_R5.point(0, [0.5, 0.5]));
    b.run(4.2);
    b.tap(BOOKS_R5.point(1, [0.5, 0.5]));
    b.run(4.2);
    expect(PG.pops.map((F) => [F.target.page, F.phase])).toEqual([
      [0, "up"],
      [1, "up"],
    ]);
    expect(Object.values(b.out.sheets).filter((s) => s.variant === "hole").length).toBe(2);
    b.tap(BOOKS_R5.point(0, [0.5, 0.5]));
    b.run(2.5);
    expect(PG.pops.map((F) => F.target.page)).toEqual([1]);
  });

  test("the Picture lab raises a PDF figure and a drawn box, and a page step waits for them", async () => {
    const { BOOKS_R5 } = await import("../src/packs/pictures.js");
    const { PG } = BOOKS_R5;
    const pics = fakePics(3);
    pics.page = 1;
    const b = await play("picture-lab", {}, pics);
    b.set("pop", 1);
    await b.settle();
    b.run(0.2);
    const at = (f) => BOOKS_R5.point(1, f);
    b.tap(at(mid(FIG_B)));
    await b.settle();
    b.run(1.5);
    expect(PG.pops.map((F) => F.phase)).toEqual(["up"]);
    expect(b.out.sheets.page.variant).toBe(`hole:${FIG_B.map((v) => v.toFixed(4)).join(",")}`);
    expect(b.out.tiltFree).toBe(true);
    // A box drawn round something else rises too.
    b.set("box", 1);
    const drag = b.r.drag;
    expect(drag.at(at([0.05, 0.05]))).toBe(true);
    drag.start(at([0.05, 0.05]), b.time);
    drag.move(at([0.4, 0.3]), b.time);
    drag.end(b.time);
    await b.settle();
    b.run(2);
    expect(PG.pops.map((F) => F.phase)).toEqual(["up", "up"]);
    // A tap off them: they lie back, then the page goes on.
    b.tap(at([0.8, 0.95]));
    b.run(0.1);
    expect(pics.page).toBe(1);
    b.run(1);
    expect(PG.pops.length).toBe(0);
    expect(pics.page).toBe(2);
  });

  test("a picture in the lab is one figure, the whole of it", async () => {
    const { BOOKS_R5 } = await import("../src/packs/pictures.js");
    const { PG } = BOOKS_R5;
    const pics = { ...fakePics(1, "image"), aspect: () => 1.5, crop: async () => null };
    const b = await play("picture-lab", {}, pics);
    b.set("pop", 1);
    b.tap(BOOKS_R5.point(0, [0.5, 0.5]));
    b.run(4.2);
    expect(PG.pops.map((F) => [F.target.box.join(), F.phase])).toEqual([["0,0,1,1", "up"]]);
  });
});

// ---- In the app ----------------------------------------------------------------------

async function ready(page, url = `${APP}&labs=1`) {
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}
async function waitSheets(page) {
  await page.waitForFunction(
    () => {
      const p = window.__splashery.player.pictures;
      if (!p?.media) return false;
      window.__splashery.player.stage.requestRender();
      return p.sheets.every((s) => !s.want || s.shown?.key === s.want.key) && p.splats() > 0;
    },
    null,
    { timeout: 120_000 },
  );
}
// Waits until the player's clock has moved `seconds` on.
async function step(page, seconds) {
  const t0 = await page.evaluate(() => window.__splashery.player.time);
  await page.waitForFunction(
    (t) => {
      const pl = window.__splashery.player;
      pl.stage.requestRender();
      return pl.time >= t;
    },
    t0 + seconds,
    { timeout: 120_000, polling: 100 },
  );
  await waitSheets(page);
}
// Opens the two-figure test PDF in the toy on show.
async function openTwo(page) {
  await page.evaluate(async () => {
    const { twoFigurePDF } = await import("/tests/fixtures/pg6/make-pdf.mjs");
    await window.__splashery.app.openMedia(new File([twoFigurePDF()], "two.pdf", { type: "application/pdf" })); // prettier-ignore
  });
  await waitSheets(page);
}
// Where a place on a page in view shows on the page (CSS pixels).
async function pagePoint(page, n, f) {
  return page.evaluate(
    async ([n, f]) => {
      const { BOOKS_R5 } = await import("/src/packs/pictures.js");
      const pl = window.__splashery.player;
      const [x, y] = pl.screenPoint(BOOKS_R5.point(n, f));
      const r = pl.stage.canvas.getBoundingClientRect();
      return [r.left + x, r.top + y];
    },
    [n, f],
  );
}
async function clickPage(page, n, f) {
  const [x, y] = await pagePoint(page, n, f);
  await page.mouse.click(x, y);
}
// The figures up: [page, box, phase, depth, relief key].
const pops = (page) =>
  page.evaluate(async () => {
    const { PG } = (await import("/src/packs/pictures.js")).BOOKS_R5;
    return PG.pops.map((F) => [F.target.page, F.target.box.map((v) => +v.toFixed(3)), F.phase, F.depth, F.relief?.key || ""]); // prettier-ignore
  });
// Waits (on the player's clock) until `count` figures are up, with their depth.
async function upTo(page, count) {
  for (let i = 0; i < 400; i++) {
    const p = await pops(page);
    if (p.length === count && p.every((x) => x[2] === "up" && x[4])) return p;
    await step(page, 0.25);
  }
  throw new Error(`${count} figures never stood up.`);
}
async function downTo(page, count) {
  for (let i = 0; i < 200; i++) {
    if ((await pops(page)).length === count) return;
    await step(page, 0.2);
  }
  throw new Error(`The figures never came down to ${count}.`);
}
async function figBoxes(page, n) {
  const h = await page.waitForFunction(
    async (n) => {
      const { BK5 } = (await import("/src/packs/pictures.js")).BOOKS_R5;
      window.__splashery.player.stage.requestRender();
      const f = BK5.figs.get(n);
      return f?.length ? f.map((x) => x.box) : false;
    },
    n,
    { timeout: 60_000 },
  );
  return h.jsonValue();
}
async function shots(page, name) {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await step(page, 0.4);
    await page.screenshot({ path: `tests/screenshots/pg6-${name}-${w}x${h}.png` });
  }
}

test.describe("Pop out (in the app)", () => {
  test.setTimeout(300_000);

  test("Your book: two figures up at once, one laid back; the switch holds across a page turn and a toy switch", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("your-book"));
    await openTwo(page);
    await page.evaluate(() => window.__splashery.app.pictureStep(1));
    await step(page, 2.5);
    const btn = page.locator("#pop-toggle");
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    // Nothing rises by itself.
    await step(page, 1.5);
    expect(await pops(page)).toEqual([]);
    const boxes = await figBoxes(page, 1);
    expect(boxes.length).toBe(2);
    for (const b of boxes) await clickPage(page, 1, [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]);
    await upTo(page, 2);
    await shots(page, "two-up");
    // The book can be tilted while they stand.
    expect(await page.evaluate(() => window.__splashery.player.camera.tiltLock)).toBe(false);
    // A click on the first lays it back; the second stays.
    await page.setViewportSize({ width: 1440, height: 900 });
    await step(page, 0.3);
    await clickPage(page, 1, [(boxes[0][0] + boxes[0][2]) / 2, (boxes[0][1] + boxes[0][3]) / 2]);
    await downTo(page, 1);
    // The next page (Toy tab): it lays back first, then the page turns; the switch stays on.
    await page.evaluate(() => window.__splashery.app.pictureStep(1));
    await downTo(page, 0);
    await step(page, 2);
    expect(await page.evaluate(() => window.__splashery.player.pictures.page)).toBe(3);
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => window.__splashery.player.camera.tiltLock)).toBe(true);
    // Another page toy: still on. A toy that has none: the button goes.
    await page.evaluate(() => window.__splashery.app.chooseToy("photo-album"));
    await waitSheets(page);
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => window.__splashery.player.scene.motion.controls.pop)).toBe(1);
    await page.evaluate(() => window.__splashery.app.chooseToy("cactus"));
    await expect(btn).toBeHidden();
    // And after a reload.
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await waitSheets(page);
    await expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  test("the Picture lab pops a PDF figure and a drawn box", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await openTwo(page);
    await page.evaluate(() => window.__splashery.app.pictureStep(1));
    await step(page, 1);
    await page.click("#pop-toggle");
    const boxes = await figBoxes(page, 1);
    await clickPage(page, 1, [(boxes[1][0] + boxes[1][2]) / 2, (boxes[1][1] + boxes[1][3]) / 2]);
    await upTo(page, 1);
    // Draw a box round the words at the bottom.
    await page.evaluate(() => window.__splashery.app.setControl("box", 1));
    const p0 = await pagePoint(page, 1, [0.08, 0.7]);
    const p1 = await pagePoint(page, 1, [0.6, 0.8]);
    await page.mouse.move(p0[0], p0[1]);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(p0[0] + ((p1[0] - p0[0]) * i) / 8, p0[1] + ((p1[1] - p0[1]) * i) / 8); // prettier-ignore
    await page.mouse.up();
    const up = await upTo(page, 2);
    expect(up[1][1][0]).toBeCloseTo(0.08, 1);
    await shots(page, "lab-pdf");
    // The page under them shows both places empty.
    const hole = await page.evaluate(() => window.__splashery.player.pictures.sheets.find((s) => s.def.id === "page").shown.key); // prettier-ignore
    expect(hole).toContain("|vhole:");
    expect(hole.split(";").length).toBe(2);
  });

  test("a depth saved in a scene comes back when the figure is raised", async ({ page }) => {
    await ready(page);
    const { BOXES } = await import("./fixtures/pg6/make-pdf.mjs");
    const hash = await page.evaluate(async (box) => {
      const { encodeSceneHash } = await import("/src/codec.js");
      const { createScene } = await import("/src/state.js");
      return encodeSceneHash(createScene({ toy: { kind: "builtin", id: "your-book", figures: [{ page: 1, box, depth: 3 }] }, motion: { controls: { pop: 1 } } })); // prettier-ignore
    }, BOXES.a);
    await ready(page, `${APP}&labs=1#s=${hash}`);
    await waitSheets(page);
    // A link with Pop out on turns it on.
    await expect(page.locator("#pop-toggle")).toHaveAttribute("aria-pressed", "true");
    await openTwo(page);
    await page.evaluate(() => window.__splashery.app.pictureStep(1));
    await step(page, 2.5);
    const boxes = await figBoxes(page, 1);
    const a = boxes.find((b) => Math.abs(b[0] - BOXES.a[0]) < 0.01);
    expect(a).toBeTruthy();
    await clickPage(page, 1, [(a[0] + a[2]) / 2, (a[1] + a[3]) / 2]);
    const [F] = await upTo(page, 1);
    expect(F[3]).toBe(3);
    const key = await page.evaluate(() => window.__splashery.player.pictures.sheets.find((s) => s.def.id === "pop0").shown.key); // prettier-ignore
    expect(key).toMatch(/\|r[dl]\d+x3/);
    // The slider shows its depth, and moving it changes the scene.
    await expect(page.locator("#toy-slider")).toBeVisible();
    expect(Number(await page.locator("#toy-slider-input").inputValue())).toBe(500);
    await page.locator("#toy-slider-input").fill("1000");
    await step(page, 0.5);
    const saved = await page.evaluate(() => window.__splashery.player.scene.toy.figures);
    expect(saved.length).toBe(1);
    expect(saved[0].depth).toBe(5);
    await shots(page, "deep");
  });

  test("old links and saved scenes (v2 and v3) still load; one with Pop out on turns it on", async ({
    page,
  }) => {
    await ready(page);
    for (const [id, version, controls, on] of [
      ["your-book", 2, { turn: 0 }, false],
      ["photo-album", 3, { pop: 1 }, true],
      ["picture-lab", 3, {}, false],
    ]) {
      const hash = await page.evaluate(
        async ([id, version, controls]) => {
          const { encodeSceneHash } = await import("/src/codec.js");
          const { createScene } = await import("/src/state.js");
          const s = createScene({ toy: { kind: "builtin", id }, motion: { controls } });
          s.version = version;
          if (version === 2) delete s.pattern;
          return encodeSceneHash(s);
        },
        [id, version, controls],
      );
      await page.goto("about:blank");
      await ready(page, `${APP}&labs=1#s=${hash}`);
      await waitSheets(page);
      expect(await page.evaluate(() => window.__splashery.player.scene.toy.id)).toBe(id);
      await expect(page.locator("#pop-toggle")).toHaveAttribute("aria-pressed", String(on));
      expect(await pops(page)).toEqual([]);
    }
  });
});
