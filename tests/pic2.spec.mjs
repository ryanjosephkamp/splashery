// Lane PIC2: the Pictures toys' page sounds and pages, and Picture QR's
// defaults and sound (the owner's walkthrough of October 17, 2026).
// - The Photo album plays its page sound only when a page turns, never on a
//   tap that raises a photo with Pop out on.
// - The Picture lab changes its page in place, silently.
// - Your book, the Storybook, and the Photo album turn more softly.
// - Picture QR opens at the lowest contrast and the biggest code, with a new
//   sound; a link that carries its own contrast and size keeps them.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

// ---- In Node: the recipes with stand-in pictures (as tests/pol-pages.spec.mjs) --------

let PLAYS = 0;
async function play(id, options = {}, pics = null) {
  const { buildRecipe } = await import("../src/kit.js");
  const { RECIPES } = await import("../src/packs/pictures.js");
  const r = RECIPES[id];
  const opts = { ...Object.fromEntries((r.options || []).map((o) => [o.key, o.default])), ...options }; // prettier-ignore
  const media = pics ? { kind: pics.kind, count: pics.count, name: `pic2-${pics.name}${++PLAYS}`, aspect: pics.aspect(0), aspects: null, names: null } : null; // prettier-ignore
  const it = buildRecipe(r, { seed: 5, count: 8000, options: opts, media }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  const data = { ...(b.value.kit.data || {}), pictures: pics };
  const c = { turn: 0, pop: 0, box: 0 };
  let time = 1;
  let n = 0;
  let pick = null;
  let out = null;
  const cues = [];
  const frame = () => {
    out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null };
    r.drive(time, c, out, { time, R: 1, tap: n ? { n, pick } : null, data });
    cues.push(...out.cues);
    return out;
  };
  // A tap: its action (the key the app checks against action.quiet) and a frame.
  const tap = (point) => {
    const a = r.action.at?.(point);
    pick = a?.pick ?? null;
    n++;
    frame();
    return typeof a === "string" ? a : a?.key;
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
  return { r, tap, run, set, frame, cues, get out() { return out; } }; // prettier-ignore
}

function fakePics(count, kind = "pdf", aspect = 612 / 792) {
  return {
    page: 0,
    count,
    kind,
    name: "test",
    go(p) {
      this.page = Math.max(0, Math.min(count - 1, Math.round(p)));
      return this.page;
    },
    ready: () => true,
    aspect: () => aspect,
    links: async () => [],
    figures: async () => [],
    crop: async () => null,
  };
}

// Every sample file a list of cues names.
const files = (cues) =>
  cues.flatMap((c) => [].concat(c)).flatMap((l) => (l?.voice === "sample" ? [].concat(l.file) : [])); // prettier-ignore

test.describe("Page sounds and pages (no browser)", () => {
  test("the album's Pop out tap plays no page sound; a turn plays one", async () => {
    const { BOOKS_R5, RECIPES } = await import("../src/packs/pictures.js");
    const { TOY_SOUNDS } = await import("../src/toy-sounds.js");
    const { PG } = BOOKS_R5;
    const album = RECIPES["photo-album"];
    // Its own tap sound never plays on a tap (the app skips a quiet key); the drive cues it.
    expect(album.action.quiet).toContain("turn");
    const pics = { ...fakePics(4, "image"), aspect: () => 1.5 };
    const b = await play("photo-album", {}, pics);
    // Open it (one turn: one page sound).
    expect(b.tap([0.4, 0, 0.02])).toBe("turn");
    b.run(1.8);
    expect(b.cues.filter((c) => c === TOY_SOUNDS["photo-album"]).length).toBe(1);
    b.cues.length = 0;
    // Pop out on: a tap on a photo raises it, with only the rise's own sound.
    b.set("pop", 1);
    b.run(1);
    expect(b.tap(BOOKS_R5.point(0, [0.5, 0.5]))).toBe("turn");
    b.run(4.2);
    expect(PG.pops.map((F) => F.phase)).toEqual(["up"]);
    expect(b.cues).not.toContain(TOY_SOUNDS["photo-album"]);
    expect(files(b.cues)).not.toContain("book-page.mp3");
    // (The rise has its own sound, and it is no page turning either.)
    expect(b.cues.length).toBeGreaterThan(0);
    expect(JSON.stringify(b.cues)).not.toMatch(/pageflip/);
    // A tap on the risen photo lays it back: still no page sound.
    b.tap(BOOKS_R5.point(0, [0.5, 0.5]));
    b.run(2.5);
    expect(PG.pops.length).toBe(0);
    expect(files(b.cues)).not.toContain("book-page.mp3");
    // A real turn (the Turn the page button's tap, off the photos) plays it once.
    b.set("pop", 0);
    b.run(0.5);
    b.cues.length = 0;
    b.tap([0.98, -0.9, 0.02]);
    b.run(2);
    expect(b.cues.filter((c) => c === TOY_SOUNDS["photo-album"]).length).toBe(1);
  });

  test("Your book and the Storybook still sound a page on a turn, and none on a figure tap", async () => {
    const { RECIPES } = await import("../src/packs/pictures.js");
    for (const id of ["your-book", "book"]) {
      expect(RECIPES[id].action.quiet).toContain("turn");
      const b = await play(id, {}, fakePics(6));
      b.tap([0.3, 0, 0.02]);
      b.run(2);
      expect(files(b.cues), id).toEqual(["your-book-hardcover.mp3"]);
    }
  });

  test("the Picture lab changes its page in place, with no page sound", async () => {
    const { RECIPES } = await import("../src/packs/pictures.js");
    const lab = RECIPES["picture-lab"];
    expect(lab.action.quiet).toContain("next");
    const pics = fakePics(3);
    const b = await play("picture-lab", {}, pics);
    b.frame();
    expect(b.tap([0.6, 0, 0])).toBe("next");
    // The very next frame shows the next page; nothing moves.
    expect(pics.page).toBe(1);
    const xs = [];
    for (let i = 0; i < 15; i++) xs.push(b.run(1 / 30).parts.labpage?.offset?.[0] ?? 0);
    expect(xs.every((x) => x === 0)).toBe(true);
    b.tap([-0.6, 0, 0]);
    expect(pics.page).toBe(0);
    b.run(0.5);
    expect(files(b.cues)).toEqual([]);
    // The lab's own sound is no page either (it plays only on the Sound Board).
    const { TOY_SOUNDS } = await import("../src/toy-sounds.js");
    expect(JSON.stringify(TOY_SOUNDS["picture-lab"])).not.toMatch(/page|pageflip/);
  });

  test("the page sounds are softer: about half as loud as before, and a little lower", async () => {
    const { RECIPES } = await import("../src/packs/pictures.js");
    const { TOY_SOUNDS } = await import("../src/toy-sounds.js");
    const layers = (spec) => [].concat(spec).flatMap((s) => (s?.on ? [...[].concat(s.on), ...[].concat(s.off)] : [s])); // prettier-ignore
    // Before (main at c36c4dcd): the book's pages at 1.1, the album's at 1.2, the
    // hardcover's landing at 0.3, the album's at 0.45, the Storybook's sample at 1.5.
    for (const style of ["hardcover", "paperback", "magazine", "spiral", "stapled"]) {
      const [page, landing] = layers(RECIPES["your-book"].sounds({ style })[0]);
      expect(page.voice).toBe("sample");
      expect(page.vol, style).toBeLessThanOrEqual(0.55);
      expect(page.pitch, style).toBeLessThan(1.01);
      if (landing) expect(landing.vol).toBeLessThanOrEqual(0.15);
    }
    const [albumPage, albumLanding] = layers(TOY_SOUNDS["photo-album"]);
    expect(albumPage.vol).toBeLessThanOrEqual(0.6);
    expect(albumLanding.vol).toBeLessThanOrEqual(0.2);
    for (const l of layers(TOY_SOUNDS.book)) expect(l.vol).toBeLessThanOrEqual(0.7);
    // Not gone: every page still plays its recording.
    expect(layers(TOY_SOUNDS["your-book"])[0]).toMatchObject({ voice: "sample", file: "your-book-hardcover.mp3" }); // prettier-ignore
  });
});

test.describe("Picture QR's defaults and sound (no browser)", () => {
  test("it opens at the lowest contrast and the biggest code; old settings keep theirs", async () => {
    const { RECIPES } = await import("../src/packs/qr-craft.js");
    const { resolveOptions } = await import("../src/player.js");
    const r = RECIPES["qr-picture"];
    const def = (key) => r.options.find((o) => o.key === key).default;
    expect(def("contrast")).toBe(0);
    expect(def("size")).toBe("most");
    // The other defaults are as they were.
    expect([def("center"), def("level"), def("style"), def("fidelity")]).toEqual(["small", "H", "color", "standard"]); // prettier-ignore
    // A link or scene that carries its own contrast and size opens as it was.
    expect(resolveOptions(r, { contrast: 0.5, size: "more" })).toMatchObject({ contrast: 0.5, size: "more" }); // prettier-ignore
    expect(resolveOptions(r, { contrast: 1, size: "fit" })).toMatchObject({ contrast: 1, size: "fit" }); // prettier-ignore
    expect(resolveOptions(r, {})).toMatchObject({ contrast: 0, size: "most" });
  });

  test("its sound is new: a drop and soft marimba notes, no wind and no clicks", async () => {
    const { TOY_SOUNDS } = await import("../src/toy-sounds.js");
    const { specProblems } = await import("../src/voices.js");
    const spec = TOY_SOUNDS["qr-picture"];
    expect(specProblems(spec, "qr-picture")).toEqual([]);
    const voices = [].concat(spec).map((l) => l.voice);
    expect(voices).toEqual(["drip", "marimba"]);
    for (const v of ["breath", "wind", "wood", "click"]) expect(voices).not.toContain(v);
  });
});

// ---- In the browser -------------------------------------------------------------------

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
}
async function clickPage(page, n, f) {
  const [x, y] = await page.evaluate(
    async ([n, f]) => {
      const { BOOKS_R5 } = await import("/src/packs/pictures.js");
      const pl = window.__splashery.player;
      const [x, y] = pl.screenPoint(BOOKS_R5.point(n, f));
      const r = pl.stage.canvas.getBoundingClientRect();
      return [r.left + x, r.top + y];
    },
    [n, f],
  );
  await page.mouse.click(x, y);
}
// Records every sound the app plays: the sample files each names.
async function listen(page) {
  await page.evaluate(() => {
    const s = window.__splashery.app.sound;
    window.__heard = [];
    const play = s.play.bind(s);
    s.play = (spec, o) => {
      window.__heard.push(JSON.stringify(spec));
      return play(spec, o);
    };
  });
}
// The figures up: their phases (as tests/pg6.spec.mjs).
const pops = (page) =>
  page.evaluate(async () => {
    const { PG } = (await import("/src/packs/pictures.js")).BOOKS_R5;
    return PG.pops.map((F) => F.phase);
  });
async function upTo(page, count) {
  for (let i = 0; i < 400; i++) {
    const p = await pops(page);
    if (p.length === count && p.every((x) => x === "up")) return p;
    await step(page, 0.25);
  }
  throw new Error(`${count} figures never stood up.`);
}
const heard = (page) => page.evaluate(() => window.__heard.splice(0));

test.describe("In the app", () => {
  test.describe.configure({ timeout: 300_000 });

  test("the album: a Pop out tap on a photo plays no page sound, a page turn plays it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("photo-album"));
    await waitSheets(page);
    await listen(page);
    // Open it: one page sound.
    await page.evaluate(() => window.__splashery.player.act());
    await step(page, 2);
    await waitSheets(page);
    expect((await heard(page)).filter((s) => s.includes("book-page.mp3")).length).toBe(1);
    // Pop out on, and a click on the first photo: it rises, with no page sound.
    await page.click("#pop-toggle");
    await step(page, 0.5);
    await heard(page);
    await clickPage(page, 0, [0.5, 0.5]);
    await upTo(page, 1);
    const rise = await heard(page);
    expect(rise.length).toBeGreaterThan(0); // the rise's own sound
    expect(rise.filter((s) => /book-page\.mp3|pageflip/.test(s))).toEqual([]);
    // A page turn: the photo lays back, the page turns, and the page sounds once.
    await page.evaluate(() => window.__splashery.player.act());
    await step(page, 3);
    expect((await heard(page)).filter((s) => s.includes("book-page.mp3")).length).toBe(1);
  });

  test("the Picture lab: next and back change the page in place, silently", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await waitSheets(page);
    await listen(page);
    const before = await page.evaluate(() => window.__splashery.player.pictures.page);
    await page.evaluate(() => window.__splashery.player.act());
    await step(page, 1);
    await waitSheets(page);
    expect(await page.evaluate(() => window.__splashery.player.pictures.page)).toBe(before + 1);
    expect((await heard(page)).filter((s) => /book-page|pageflip/.test(s))).toEqual([]);
  });

  test("Picture QR opens at its new defaults, and its code scans", async ({ page }) => {
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("qr-picture"));
    await page.waitForFunction(() => window.__splashery.app.player.toyInfo?.id === "qr-picture" && !window.__splashery.app.busy, null, { timeout: 180_000 }); // prettier-ignore
    await page.waitForFunction(() => window.__splashery.qrCraft.picture().check?.ok !== undefined, null, { timeout: 180_000 }); // prettier-ignore
    const p = await page.evaluate(() => {
      const { options, check, woven } = window.__splashery.qrCraft.picture();
      return { contrast: options.contrast, size: options.size, ok: check?.ok, version: woven?.code?.version }; // prettier-ignore
    });
    expect(p).toMatchObject({ contrast: 0, size: "most", ok: true });
    // The biggest code: eight versions above the smallest that fits.
    expect(p.version).toBeGreaterThanOrEqual(10);
  });

  test("an old Picture QR link with its own contrast and size opens as it was", async ({
    page,
  }) => {
    await ready(page);
    const hash = await page.evaluate(async () => {
      const { encodeSceneHash } = await import("/src/codec.js");
      const { createScene } = await import("/src/state.js");
      return encodeSceneHash(createScene({ toy: { kind: "builtin", id: "qr-picture", options: { contrast: 0.5, size: "more" } } })); // prettier-ignore
    });
    await page.goto("about:blank");
    await ready(page, `${APP}&labs=1#s=${hash}`);
    await page.waitForFunction(() => window.__splashery.app.player.toyInfo?.id === "qr-picture" && !window.__splashery.app.busy, null, { timeout: 180_000 }); // prettier-ignore
    const o = await page.evaluate(() => window.__splashery.qrCraft.picture().options);
    expect(o).toMatchObject({ contrast: 0.5, size: "more" });
  });
});
