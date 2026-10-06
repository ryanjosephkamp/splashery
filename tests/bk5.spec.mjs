// Lane Books r5: links in a PDF that work and figures that pop out, in Your
// book and the Photo album (docs/handoff/BooksR5.md). The engine's part is
// tested in tests/bk5-engine.spec.mjs; the test PDF is made by
// tests/fixtures/bk5/make-pdf.mjs.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

// ---- In Node: the recipes with stand-in pictures -------------------------------------

// Builds a toy in Node and plays it (as tests/bk.spec.mjs does): tap(point)
// taps where it lands (recipe units), set(key, v) sets a control, run(s)
// steps the clock.
async function play(id, options = {}, pics = null) {
  const { buildRecipe } = await import("../src/kit.js");
  const { RECIPES } = await import("../src/packs/pictures.js");
  const r = RECIPES[id];
  const opts = { ...Object.fromEntries((r.options || []).map((o) => [o.key, o.default])), ...options }; // prettier-ignore
  const it = buildRecipe(r, { seed: 5, count: 8000, options: opts }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  const data = { ...(b.value.kit.data || {}), pictures: pics };
  const c = { turn: 0, pop: 0, box: 0 };
  let time = 1;
  let n = 0;
  let pick = null;
  let out = null;
  const frame = () => {
    out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null };
    r.drive(time, c, out, { time, R: 1, tap: n ? { n, pick } : null, data });
    return out;
  };
  const tap = (point) => {
    const a = r.action.at?.(point);
    if (typeof a === "string") {
      c[a] = c[a] > 0.5 ? 0 : 1; // a toggle the tap switches
      return frame();
    }
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
  // Lets the stand-in's promises settle (crop, links, figures).
  const settle = async () => {
    for (let i = 0; i < 4; i++) await new Promise((res) => setTimeout(res, 0));
  };
  return { r, tap, run, set, frame, settle, get out() { return out; }, get time() { return time; } }; // prettier-ignore
}

// A canvas stand-in: a plain white picture with a dark block (a chart's
// bar), enough for the pop-out's photo-or-graphic test and its layers.
function fakeCanvas(w = 40, h = 30) {
  const data = new Uint8ClampedArray(w * h * 4).fill(250);
  for (let y = 8; y < 22; y++) for (let x = 10; x < 30; x++) data.set([30, 60, 150, 255], (y * w + x) * 4); // prettier-ignore
  return { width: w, height: h, getContext: () => ({ getImageData: () => ({ data, width: w, height: h }) }) }; // prettier-ignore
}

// A stand-in for info.data.pictures: every page is ready at once; page 1
// has a web link, a link to page 5 and a figure.
const LINKS = [
  { box: [0.1, 0.1, 0.5, 0.15], url: "https://example.org/" },
  { box: [0.1, 0.2, 0.5, 0.25], page: 5 },
];
const FIG = [0.5, 0.4, 0.9, 0.7];
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
    links: async (n) => (n === 1 ? LINKS : []),
    figures: async (n) => (n === 1 ? [{ box: FIG }] : []),
    crop: async () => fakeCanvas(),
    openLink(url) {
      this.opened.push(url);
      return true;
    },
  };
}

test.describe("links and pop-out (no browser)", () => {
  test("a tap on a web link asks to open it; a page link turns there; elsewhere turns the page", async () => {
    const { BOOKS_R5 } = await import("../src/packs/pictures.js");
    const pics = fakePics(9);
    const b = await play("your-book", {}, pics);
    b.tap([0.4, 0, 0.02]); // opens the book: page 1 on the right
    b.run(1.6);
    expect(pics.page).toBe(1);
    await b.settle();
    b.run(0.1);
    const at = (f) => BOOKS_R5.point(1, f);
    // The web link: asked, and the book stays where it is.
    b.tap(at([0.3, 0.125]));
    b.run(1.6);
    expect(pics.opened).toEqual(["https://example.org/"]);
    expect(pics.page).toBe(1);
    // A page link: the book goes to page 5.
    b.tap(at([0.3, 0.225]));
    b.run(2);
    expect(pics.page).toBe(5);
    // Off the links: an ordinary tap.
    pics.go(1);
    b.run(2);
    expect(pics.page).toBe(1);
    await b.settle();
    b.run(0.1);
    b.tap(at([0.3, 0.6]));
    b.run(1.6);
    expect(pics.page).toBe(3);
    expect(pics.opened.length).toBe(1);
  });

  test("seen a page at a time, a page link lands on that page", async () => {
    const { BOOKS_R5 } = await import("../src/packs/pictures.js");
    const pics = fakePics(9);
    const b = await play("your-book", { reading: "one" }, pics);
    b.tap([0.4, 0, 0.02]);
    b.run(1.6);
    expect(b.out.view.key).toBe("R");
    await b.settle();
    b.run(0.1);
    // Page 5 (0-based) is the right page of spread 3; the view lands there, not on page 4.
    b.tap(BOOKS_R5.point(1, [0.3, 0.225]));
    b.run(2);
    expect(pics.page).toBe(5);
    expect(b.out.view.key).toBe("R");
  });

  test("Pop out lifts the page's figure as one piece and lays it back; the page shows its place empty", async () => {
    const { BOOKS_R5 } = await import("../src/packs/pictures.js");
    const pics = fakePics(9);
    const b = await play("your-book", {}, pics);
    b.tap([0.4, 0, 0.02]);
    b.run(1.6);
    await b.settle();
    b.run(0.1);
    b.set("pop", 1);
    await b.settle();
    b.run(0.1);
    // (Lane Pages r6: nothing rises by itself; a tap on the figure raises it.)
    b.tap(BOOKS_R5.point(1, [(FIG[0] + FIG[2]) / 2, (FIG[1] + FIG[3]) / 2]));
    await b.settle();
    // A graphic (a plain background): its layers, the card a little raised.
    const POP = BOOKS_R5.POP;
    expect(POP.kind).toBe("graphic");
    expect(POP.relief.d.some((v) => v > 0.5)).toBe(true);
    expect(POP.relief.d.some((v) => v < 0.1)).toBe(true);
    b.run(0.2);
    expect(["rest", "rise"]).toContain(POP.phase);
    const seen = [];
    for (let i = 0; i < 40; i++) {
      const out = b.run(0.05);
      const p = out.parts.bk5pop0;
      expect(p.visible).toBe(1);
      for (const v of [...p.quat, ...p.offset, p.scale]) expect(Number.isFinite(v)).toBe(true);
      expect(Math.hypot(...p.quat)).toBeCloseTo(1, 5);
      // The page under it is drawn with the figure's place empty.
      const hole = Object.values(out.sheets).find((s) => s.variant);
      expect(hole?.variant).toBe(`hole:${FIG.map((v) => v.toFixed(4)).join(",")}`);
      expect(out.sheets.pop0).toMatchObject({ page: 1, crop: FIG, visible: 1 });
      seen.push(p.offset[2]);
    }
    expect(POP.phase).toBe("up");
    // It came toward the reader (z up about 0.3) and grew.
    expect(Math.max(...seen)).toBeGreaterThan(0.25);
    expect(b.out.parts.bk5pop0.scale).toBeGreaterThan(1);
    // A tap on the risen figure lays it back (lane Pages r6), and it goes.
    const F = BOOKS_R5.POP;
    const out = b.tap([F.at.cx, F.at.cy, 0.3]);
    expect(out.parts.bk5pop0.visible).toBe(1);
    b.run(1.2);
    expect(BOOKS_R5.POP.phase).toBe("idle");
    expect(b.out.parts.bk5pop0.visible).toBe(0);
    expect(Object.values(b.out.sheets).some((s) => s.variant)).toBe(false);
    expect(pics.page).toBe(1); // (the tap did not turn the page)
  });

  test("a box drawn on the page rises; a page turn puts it back at once", async () => {
    const { BOOKS_R5 } = await import("../src/packs/pictures.js");
    const { BK5 } = BOOKS_R5;
    const pics = fakePics(9);
    const b = await play("your-book", {}, pics);
    b.tap([0.4, 0, 0.02]);
    b.run(1.6);
    b.set("box", 1);
    const p0 = BOOKS_R5.point(1, [0.1, 0.1]);
    const p1 = BOOKS_R5.point(1, [0.6, 0.35]);
    const drag = b.r.drag;
    expect(drag.at(p0)).toBe(true);
    drag.start(p0, b.time);
    drag.move(p1, b.time + 0.1);
    const mid = b.frame();
    expect(BK5.drawing).toBeTruthy();
    // The four corners of the box, where it is drawn.
    expect(mid.parts.bk5c0.offset[0]).toBeCloseTo(p0[0], 5);
    expect(mid.parts.bk5c3.offset[1]).toBeCloseTo(p1[1], 5);
    drag.end(b.time + 0.2);
    b.frame();
    expect(BK5.drawing).toBe(null);
    expect(b.out.parts.bk5c0.visible).toBe(0);
    await b.settle();
    b.run(0.1);
    await b.settle();
    b.run(1.5);
    expect(BOOKS_R5.POP.phase).toBe("up");
    BOOKS_R5.POP.target.box.forEach((v, i) => expect(v).toBeCloseTo([0.1, 0.1, 0.6, 0.35][i], 5));
    // Next (the Toy tab) while it is up: the figure lays back quickly, then
    // the book turns (lane Pages r6).
    pics.next();
    b.run(0.7);
    expect(BOOKS_R5.POP.phase).toBe("idle");
    expect(b.out.parts.bk5pop0.visible).toBe(0);
    b.run(1.6);
    expect(pics.page).toBe(3);
  });

  test("the album lifts a photo tapped, and a tap on the other photo lifts that one too", async () => {
    const { BOOKS_R5 } = await import("../src/packs/pictures.js");
    // Two wide photos: they share a page, one above the other.
    const pics = { ...fakePics(4, "image"), aspect: () => 1.5, crop: async () => null };
    const b = await play("photo-album", {}, pics);
    b.tap([0.4, 0, 0.02]);
    b.run(1.8);
    b.set("pop", 1);
    await b.settle();
    // (Lane Pages r6: a tap on the photo raises it.)
    b.tap(BOOKS_R5.point(0, [0.5, 0.5]));
    // (No depth model here: it waits its 2.5 s at rest, then rises flat.)
    b.run(4.2);
    let POP = BOOKS_R5.POP;
    expect(POP.kind).toBe("photo");
    expect(POP.phase).toBe("up");
    expect(POP.target.page).toBe(0);
    expect(b.out.sheets.pop0).toMatchObject({ page: 0, crop: [0, 0, 1, 1], visible: 1 });
    const hole = Object.entries(b.out.sheets).find(([, s]) => s.variant === "hole");
    expect(hole[0]).toMatch(/^a1ft$/);
    // The other photo (below it) is tapped: it rises too (lane Pages r6).
    const other = BOOKS_R5.point(1, [0.5, 0.5]);
    b.tap(other);
    b.run(5.5);
    POP = BOOKS_R5.POP;
    expect(POP.phase).toBe("up");
    expect(POP.target.page).toBe(1);
    expect(BOOKS_R5.PG.pops.length).toBe(2);
    b.set("pop", 0);
    b.run(2.5);
    expect(BOOKS_R5.POP.phase).toBe("idle");
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
// Clicks a place on a page in view (fractions of the page from its top-left).
async function clickPage(page, n, f) {
  const xy = await page.evaluate(
    async ([n, f]) => {
      const { BOOKS_R5 } = await import("/src/packs/pictures.js");
      const pl = window.__splashery.player;
      const [x, y] = pl.screenPoint(BOOKS_R5.point(n, f));
      const r = pl.stage.canvas.getBoundingClientRect();
      return [r.left + x, r.top + y];
    },
    [n, f],
  );
  await page.mouse.click(xy[0], xy[1]);
}
const popState = (page) =>
  page.evaluate(async () => {
    const { POP } = (await import("/src/packs/pictures.js")).BOOKS_R5;
    return { phase: POP.phase, kind: POP.kind, relief: POP.relief?.key || "", page: POP.target?.page ?? -1 }; // prettier-ignore
  });
// Waits (on the player's clock) until the pop-out reaches a phase, and for a
// photo until its depth has come.
async function popTo(page, phase, depth = false) {
  for (let i = 0; i < 400; i++) {
    const s = await popState(page);
    if (s.phase === phase && (!depth || s.relief.startsWith("d"))) return s;
    await step(page, 0.25);
  }
  throw new Error(`The pop-out never reached ${phase}.`);
}
const mid = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
// Lane Pages r6: clicks the biggest figure found on a page (once found).
async function clickFigure(page, n) {
  const box = await page.waitForFunction(
    async (n) => {
      const { BK5 } = (await import("/src/packs/pictures.js")).BOOKS_R5;
      window.__splashery.player.stage.requestRender();
      return BK5.figs.get(n)?.[0]?.box || false;
    },
    n,
    { timeout: 60_000 },
  );
  await clickPage(page, n, mid(await box.jsonValue()));
}
// Screenshots at both sizes, the given one first.
async function shots(page, name, first = "1440x900") {
  const sizes =
    first === "1440x900"
      ? [
          [1440, 900],
          [390, 844],
        ]
      : [
          [390, 844],
          [1440, 900],
        ];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await step(page, 0.3);
    await page.screenshot({ path: `tests/screenshots/bk5-${name}-${w}x${h}.png` });
  }
}

test.describe("links and pop-out (in the app)", () => {
  test.setTimeout(480_000);

  test("Your book: a web link asks first, javascript: is refused, a page link turns there", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ready(page);
    await page.evaluate(async () => {
      await window.__splashery.app.chooseToy("your-book");
      const { linkPDF } = await import("/tests/fixtures/bk5/make-pdf.mjs");
      await window.__splashery.app.openMedia(new File([linkPDF()], "links.pdf", { type: "application/pdf" })); // prettier-ignore
    });
    await waitSheets(page);
    await page.evaluate(() => window.__splashery.app.pictureStep(1));
    await step(page, 2.5);
    const B = await page.evaluate(async () => (await import("/tests/fixtures/bk5/make-pdf.mjs")).BOXES); // prettier-ignore
    // The links of the page in view are known.
    await page.waitForFunction(async () => {
      const { BK5 } = (await import("/src/packs/pictures.js")).BOOKS_R5;
      return BK5.links.get(1)?.length === 2;
    });
    await clickPage(page, 1, mid(B.web));
    const bar = page.locator("#link-confirm");
    await expect(bar).toBeVisible();
    await expect(bar).toContainText("Open example.org?");
    await expect(page.locator("#link-confirm-open")).toHaveAttribute(
      "href",
      "https://example.org/",
    );
    await expect(page.locator("#link-confirm-open")).toHaveAttribute("target", "_blank");
    await expect(page.locator("#link-confirm-open")).toHaveAttribute("rel", "noopener noreferrer"); // prettier-ignore
    await shots(page, "link");
    await page.setViewportSize({ width: 1440, height: 900 });
    await step(page, 0.3);
    await page.click("#link-confirm-cancel");
    await expect(bar).toBeHidden();
    expect(await page.evaluate(() => window.__splashery.player.pictures.page)).toBe(1);
    // The page link: the book turns to page 4 (index 3).
    await clickPage(page, 1, mid(B.page4));
    await step(page, 2.5);
    expect(await page.evaluate(() => window.__splashery.player.pictures.page)).toBe(3);
    await page.evaluate(() => window.__splashery.app.pictureStep(-1));
    await step(page, 2.5);
    expect(await page.evaluate(() => window.__splashery.player.pictures.page)).toBe(1);
    // The javascript: link is no link: no confirm, just an ordinary tap.
    await clickPage(page, 1, mid(B.script));
    await step(page, 2.5);
    await expect(bar).toBeHidden();
    expect(await page.evaluate(() => window.__splashery.player.pictures.page)).toBe(3);
    expect(page.context().pages().length).toBe(1);
  });

  test("Your book: the PDF's picture pops out with its depth and lies back", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ready(page);
    await page.evaluate(async () => {
      await window.__splashery.app.chooseToy("your-book");
      const { linkPDF } = await import("/tests/fixtures/bk5/make-pdf.mjs");
      await window.__splashery.app.openMedia(new File([linkPDF()], "links.pdf", { type: "application/pdf" })); // prettier-ignore
    });
    await waitSheets(page);
    await page.evaluate(() => window.__splashery.app.pictureStep(1));
    await step(page, 2.5);
    // (Lane Pages r6: Pop out is the top bar's switch; a click on the figure raises it.)
    await page.click("#pop-toggle");
    await clickFigure(page, 1);
    const up = await popTo(page, "up", true);
    expect(up).toMatchObject({ kind: "photo", page: 1 });
    // The figure's sheet is a raised part of page 2, and page 2 shows its place empty.
    const s = await page.evaluate(() => {
      const p = window.__splashery.player.pictures;
      const pop = p.sheets.find((x) => x.def.id === "pop0");
      return { pop: pop.shown.key, hole: p.sheets.some((x) => x.shown?.key.includes("|vhole:")) };
    });
    expect(s.pop).toContain("|c0.5000,");
    expect(s.pop).toContain("|rd");
    expect(s.hole).toBe(true);
    await step(page, 1);
    await shots(page, "pop");
    await page.setViewportSize({ width: 1440, height: 900 });
    await step(page, 0.3);
    await clickFigure(page, 1);
    await popTo(page, "idle");
    const after = await page.evaluate(() => window.__splashery.player.pictures.sheets.some((x) => x.shown?.key.includes("|vhole:") && x.slot?.entity.enabled)); // prettier-ignore
    expect(after).toBe(false);
  });

  test("Photo album: a photo pops out with its depth and lies back (phone size)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("photo-album"));
    await waitSheets(page);
    await page.evaluate(() => window.__splashery.app.pictureStep(1));
    await step(page, 2.5);
    await page.evaluate(() => window.__splashery.app.togglePopOut());
    await clickPage(page, 0, [0.5, 0.5]);
    const up = await popTo(page, "up", true);
    expect(up).toMatchObject({ kind: "photo", page: 0 });
    await step(page, 1);
    await shots(page, "album-pop", "390x844");
    await page.evaluate(() => window.__splashery.app.togglePopOut());
    await popTo(page, "idle");
  });

  test("old links and saved scenes of the book and the album still load", async ({ page }) => {
    await ready(page);
    for (const [id, options] of [
      ["your-book", { style: "paperback", color: "#7a2f2f" }],
      ["photo-album", { cover: "linen", captions: false }],
    ]) {
      // prettier-ignore
      // A link made before Books r5 (no Pop out or Draw a box in it).
      const hash = await page.evaluate(
        async ([id, options]) => {
          const { encodeSceneHash } = await import("/src/codec.js");
          const { createScene } = await import("/src/state.js");
          return encodeSceneHash(createScene({ toy: { kind: "builtin", id, options }, motion: { controls: { turn: 0 } } })); // prettier-ignore
        },
        [id, options],
      );
      await page.goto("about:blank");
      await page.goto(`${APP}&labs=1#s=${hash}`);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await waitSheets(page);
      const r = await page.evaluate(async () => {
        const pl = window.__splashery.player;
        const { POP } = (await import("/src/packs/pictures.js")).BOOKS_R5;
        return { id: pl.scene.toy.id, options: pl.scene.toy.options, phase: POP.phase };
      });
      expect(r.id).toBe(id);
      expect(r.options).toMatchObject(options);
      expect(r.phase).toBe("idle");
    }
    // A saved scene (schema v2) of the book loads too.
    const ok = await page.evaluate(async () => {
      const { normalizeScene } = await import("/src/state.js");
      const s = normalizeScene({ version: 2, toy: { kind: "builtin", id: "your-book", options: { style: "magazine" } } }); // prettier-ignore
      await window.__splashery.app.applyScene(s);
      return s.toy;
    });
    expect(ok).toMatchObject({ id: "your-book", options: { style: "magazine" } });
  });
});
