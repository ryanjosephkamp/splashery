// Lane Books: your book, the photo album and the picture frame
// (docs/handoff/Books.md). The engine parts first: a picture toy's media at
// its build (k.media), a set of pictures as one media, pages built ahead
// while hidden, and sorting leaves and parts where they stand (pose.js).

import { test, expect } from "@playwright/test";
import { posePass } from "../src/pose.js";
import { buildSheet } from "../src/picture-splats.js";
import { KINDS } from "../src/effects.js";
import { normalizeMedia, normalizeScene } from "../src/state.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";
const FIX = "/tests/fixtures/pic/";

async function ready(page, url = `${APP}&labs=1`) {
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

// Waits until every sheet shows (or holds) what the toy asked for.
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

test.describe("engine for books (no browser)", () => {
  test("ink: a block of one flat color (a chart's bar) keeps its color", () => {
    // White paper with a solid blue bar: every splat's color is a number,
    // and the bar gets detail splats in its own blue.
    const w = 96;
    const h = 64;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const bar = x >= 20 && x < 76 && y >= 16 && y < 48;
        px.set(bar ? [31, 95, 168, 255] : [252, 252, 252, 255], (y * w + x) * 4);
      }
    const out = buildSheet({ pixels: px, w, h, method: "ink", origin: [0, 0, 0], right: [1 / w, 0, 0], down: [0, -1 / w, 0], normal: [0, 0, 1] }); // prettier-ignore
    const f16 = (v) => {
      const e = (v >> 10) & 31;
      const m = v & 1023;
      return (v & 0x8000 ? -1 : 1) * (e ? 2 ** (e - 15) * (1 + m / 1024) : 2 ** -14 * (m / 1024));
    };
    let blue = 0;
    for (let i = 0; i < out.count; i++) {
      const c = [0, 1, 2].map((k) => f16(out.color[i * 4 + k]));
      expect(c.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
      if (Math.abs(c[0] - 31 / 255) < 0.01 && Math.abs(c[2] - 168 / 255) < 0.01) blue++;
    }
    expect(blue).toBeGreaterThan(56 * 32 * 0.9);
  });

  test("pose: a leaf turned over and a part turned half a turn land where the shader puts them", () => {
    // Spine along -Y through the origin, pages toward +X: a leaf turns toward +Z.
    const leaf = new Float32Array(32);
    leaf.set([0, 0, 0], 0);
    leaf.set([0, -1, 0], 4);
    leaf.set([1, 0, 0], 8);
    leaf[12 + 3 * 2] = Math.PI; // slot 3 turned over, no curl
    const parts = new Float32Array(16 * 12);
    for (let i = 0; i < 16; i++) parts[i * 12 + 3] = 1;
    // Part 2: half a turn about Y through (0.5, 0, 0), moved up 0.1.
    parts.set([0, 1, 0, 0], 24);
    parts.set([0.5, 0, 0, 0], 28);
    parts.set([0, 0.1, 0, 1], 32);
    const pos = new Float32Array([0.8, 0.2, 0.01, 0.8, 0.2, 0.01, 0.3, 0.3, 0.3, 0.7, 0, 0]);
    const anim = new Float32Array([
      0, KINDS.leaf, 0.8, 3,
      0, 0, 0, 0, // not on a part or a leaf: left alone
      0, KINDS.token, 0, 0, // a token: left to resortTokens
      2, 0, 0, 0,
    ]); // prettier-ignore
    const out = new Float32Array(12).fill(9);
    expect(posePass(pos, anim, 4, out, leaf, parts)).toBe(2);
    const near = (a, b) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 5));
    near(out.slice(0, 3), [-0.8, 0.2, -0.01]);
    near(out.slice(3, 9), [9, 9, 9, 9, 9, 9]);
    near(out.slice(9, 12), [0.3, 0.1, 0]);
    // Curled: the page's far edge stays on its arc (length kept).
    leaf[12 + 3 * 2] = Math.PI / 2;
    leaf[13 + 3 * 2] = -1.5;
    posePass(pos, anim, 1, out, leaf, parts);
    const psi = Math.PI / 2 - 1.5 * 0.8;
    // (The page's thickness, 0.01 up from it, turns with it.)
    near(out.slice(0, 1), [(Math.sin(psi) - 1) / -1.5 - 0.01 * Math.sin(psi)]);
  });

  test("a set of pictures in a scene keeps only names and sizes; old media is unchanged", () => {
    const m = normalizeMedia({ files: [{ name: "a.jpg", bytes: 10, pixels: "x" }, { name: 5 }], page: 1 }); // prettier-ignore
    expect(m).toEqual({ files: [{ name: "a.jpg", bytes: 10 }, { name: "picture", bytes: 0 }], page: 1 }); // prettier-ignore
    expect(normalizeMedia({ file: { name: "a.pdf", bytes: 3 } })).toEqual({ file: { name: "a.pdf", bytes: 3 } }); // prettier-ignore
    expect(normalizeMedia({ files: [] })).toBe(null);
    const s = normalizeScene({ version: 3, toy: { kind: "builtin", id: "picture-lab", media: { files: [{ name: "b.png", bytes: 4 }] } } }); // prettier-ignore
    expect(s.toy.media).toEqual({ files: [{ name: "b.png", bytes: 4 }] });
  });
});

test.describe("engine for books (in the app)", () => {
  test.setTimeout(240_000);

  test("a picture toy's build sees its media (k.media)", async ({ page }) => {
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await waitSheets(page);
    const m = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.media);
    expect(m.kind).toBe("pdf");
    expect(m.count).toBe(2);
    expect(m.aspect).toBeCloseTo(612 / 792, 3);
    expect(m.names).toBe(null);
  });

  test("several pictures open as one set, page through, and stay settings-only in a link", async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await waitSheets(page);
    const r = await page.evaluate(async (fix) => {
      const app = window.__splashery.app;
      const blob = await (await fetch(`${fix}photo.jpg`)).blob();
      const files = ["one.jpg", "two.jpg", "three.jpg"].map((n) => new File([blob], n, { type: "image/jpeg" })); // prettier-ignore
      const m = await app.openMedia(files);
      const pl = window.__splashery.player;
      return { kind: m.kind, count: m.count, names: m.names, media: pl.scene.toy.media, build: pl.proc.ctx.kit.media }; // prettier-ignore
    }, FIX);
    expect(r.kind).toBe("image");
    expect(r.count).toBe(3);
    expect(r.names).toEqual(["one.jpg", "two.jpg", "three.jpg"]);
    expect(r.media.files.map((f) => f.name)).toEqual(["one.jpg", "two.jpg", "three.jpg"]);
    expect(r.build.names).toEqual(["one.jpg", "two.jpg", "three.jpg"]);
    expect(r.build.aspects.length).toBe(3);
    await waitSheets(page);
    // The Toy tab pages through the set.
    await page.click("#tab-play");
    await expect(page.locator("#toy-media-now")).toContainText("3 pictures, picture 1");
    await expect(page.locator("#toy-media-next")).toBeVisible();
    await page.evaluate(() => window.__splashery.app.pictureStep(1));
    await waitSheets(page);
    expect(await page.evaluate(() => window.__splashery.player.pictures.info().page)).toBe(1);
    // A picture that is not one is refused with a message; the set stays.
    const bad = await page.evaluate(async () => {
      try {
        await window.__splashery.app.openMedia([new File(["hello"], "a.txt", { type: "text/plain" }), new File(["x"], "b.txt")]); // prettier-ignore
        return "opened";
      } catch (err) {
        return err.message;
      }
    });
    expect(bad).toContain("not a picture");
    expect(await page.evaluate(() => window.__splashery.player.pictures.info().count)).toBe(3);
  });

  test("a hidden sheet asked for ahead is built, stays hidden, and says it is ready", async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate(async () => {
      const { RECIPES } = await import("/src/packs/pictures.js");
      const r = RECIPES["picture-lab"];
      r.__drive = r.__drive || r.drive;
      r.drive = (t, c, out, info) => {
        r.__drive(t, c, out, info);
        out.sheets = { page: { page: 1, visible: 0, ahead: 1 } };
      };
      await window.__splashery.app.chooseToy("picture-lab");
    });
    await page.waitForFunction(
      () => {
        const p = window.__splashery.player.pictures;
        p && window.__splashery.player.stage.requestRender();
        return p?.api.ready("page");
      },
      null,
      { timeout: 120_000 },
    );
    const s = await page.evaluate(() => {
      const sh = window.__splashery.player.pictures.sheets[0];
      return { page: sh.shown.page, enabled: sh.slot.entity.enabled };
    });
    expect(s).toEqual({ page: 1, enabled: false });
    await page.evaluate(async () => {
      const { RECIPES } = await import("/src/packs/pictures.js");
      RECIPES["picture-lab"].drive = RECIPES["picture-lab"].__drive;
    });
  });

  test("a video's time, length and seek, and the Toy tab's scrub bar (for lane Screens)", async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await waitSheets(page);
    await page.click("#tab-play");
    // Not for a PDF.
    await expect(page.locator("#toy-media-scrub")).toBeHidden();
    await page.evaluate((u) => window.__splashery.app.openMedia(u), `http://127.0.0.1:4173${FIX}clip.webm`); // prettier-ignore
    await waitSheets(page);
    await expect(page.locator("#toy-media-scrub")).toBeVisible();
    const d = await page.evaluate(() => window.__splashery.player.pictures.api.duration);
    expect(d).toBeGreaterThan(0.5);
    await page.evaluate(() => window.__splashery.player.pictures.media.pause());
    // The API seeks...
    await page.evaluate((d) => window.__splashery.player.pictures.api.seek(d / 2), d);
    await page.waitForFunction((d) => Math.abs(window.__splashery.player.pictures.api.time - d / 2) < 0.1, d); // prettier-ignore
    // ...and so does the bar, which follows the time.
    await page.locator("#toy-media-scrub").fill("100");
    await page.waitForFunction((d) => Math.abs(window.__splashery.player.pictures.api.time - d / 10) < 0.1, d); // prettier-ignore
    await expect(page.locator("#toy-media-time")).toContainText("/ 0:");
    // Anything else answers 0 and does not seek.
    await page.evaluate(() => window.__splashery.app.clearMedia());
    await waitSheets(page);
    expect(await page.evaluate(() => { const a = window.__splashery.player.pictures.api; return [a.time, a.duration, a.seek(3)]; })).toEqual([0, 0, false]); // prettier-ignore
  });

  test("a recipe can draw on a picture before it becomes splats (pictures.decorate)", async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate(async () => {
      const { RECIPES } = await import("/src/packs/pictures.js");
      const r = RECIPES["picture-lab"];
      window.__deco = [];
      r.pictures.decorate = (canvas, info) => {
        window.__deco.push({ page: info.page, name: info.name, kind: info.kind, sample: info.options.sample }); // prettier-ignore
        const g = canvas.getContext("2d");
        g.fillStyle = "#ff0000";
        g.fillRect(0, 0, canvas.width, canvas.height);
      };
      await window.__splashery.app.chooseToy("picture-lab");
    });
    await waitSheets(page);
    const r = await page.evaluate(async () => {
      const { RECIPES } = await import("/src/packs/pictures.js");
      delete RECIPES["picture-lab"].pictures.decorate;
      const d = window.__splashery.player.pictures.sheets[0].shown.data;
      return { calls: window.__deco, count: d.count };
    });
    expect(r.calls[0]).toEqual({ page: 0, name: "article.pdf", kind: "pdf", sample: "article" });
    // A page drawn all red has no ink: only its paper and its edge.
    expect(r.count).toBeLessThan(20000);
  });
});

// ---- The toys ----------------------------------------------------------------------

// Builds a toy in Node and plays it: tap(n) taps, run(s) steps the clock.
async function play(id, options = {}, pics = null) {
  const { buildRecipe } = await import("../src/kit.js");
  const { RECIPES } = await import("../src/packs/pictures.js");
  const r = RECIPES[id];
  const opts = { ...Object.fromEntries((r.options || []).map((o) => [o.key, o.default])), ...options }; // prettier-ignore
  const it = buildRecipe(r, { seed: 5, count: 8000, options: opts }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  const data = { ...(b.value.kit.data || {}), pictures: pics };
  let time = 1;
  let n = 0;
  let out = null;
  const frame = () => {
    out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null };
    r.drive(time, { turn: 0, swing: 0 }, out, { time, R: 1, tap: n ? { n } : null, data });
    return out;
  };
  const run = (s) => {
    for (let t = 0; t < s; t += 1 / 30) {
      time += 1 / 30;
      frame();
    }
    return out;
  };
  return { kit: b.value.kit, tap: () => (n++, frame()), run, frame, get out() { return out; } }; // prettier-ignore
}

// A stand-in for info.data.pictures: every page is ready at once.
function fakePics(count) {
  return {
    page: 0,
    count,
    kind: "pdf",
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
  };
}

const shownSheets = (out) => Object.entries(out.sheets || {}).filter(([, s]) => s.visible > 0);

test.describe("your book, the album and the frame (no browser)", () => {
  test("a book turns spread by spread with a tap, and closes at the end", async () => {
    for (const style of ["hardcover", "paperback", "magazine", "spiral"]) {
      const pics = fakePics(9);
      const b = await play("your-book", { style }, pics);
      const pages = [];
      for (let i = 0; i < 6; i++) {
        b.tap();
        b.run(1.3);
        pages.push(pics.page);
        // At rest only the open pages show (and the cover, closed or open).
        expect(shownSheets(b.out).filter(([id]) => id !== "cover").length, style).toBeLessThanOrEqual(2); // prettier-ignore
      }
      expect(pages, style).toEqual([1, 3, 5, 7, 8, 0]);
    }
  });

  test("while a leaf turns, both its sides and the page under it show, and nothing else", async () => {
    const pics = fakePics(20);
    const b = await play("your-book", {}, pics);
    for (let i = 0; i < 3; i++) {
      b.tap();
      b.run(1.3);
    }
    b.tap();
    const mid = b.run(0.5);
    const ids = shownSheets(mid).map(([id, s]) => `${id}:${s.page}`);
    // Spread 3 (pages 4 | 5) turning to spread 4 (pages 6 | 7).
    expect(ids.sort()).toEqual(["b2:4", "b3:6", "cover:0", "f0:7", "f3:5"].sort());
    expect(mid.leaves[3].angle).toBeGreaterThan(0.3);
    expect(mid.leaves[3].angle).toBeLessThan(Math.PI - 0.3);
    expect(mid.resortPose || b.frame().resortPose).toBe(true);
    // Pages the next turns need are built ahead, hidden.
    expect(Object.values(mid.sheets).some((s) => s.ahead && !s.visible)).toBe(true);
  });

  test("the Toy tab's Previous and Next step a spread; a jump opens the spread with that page", async () => {
    const pics = fakePics(40);
    const b = await play("your-book", {}, pics);
    b.frame();
    pics.next(); // 0 -> 1: open the cover
    b.run(1.4);
    expect(pics.page).toBe(1);
    pics.next(); // 1 -> 2: the next spread, whose right page is 3
    b.run(1.2);
    expect(pics.page).toBe(3);
    pics.prev(); // 3 -> 2: back a spread
    b.run(1.2);
    expect(pics.page).toBe(1);
    pics.go(30); // a jump (a link): the spread that shows page 30
    b.run(0.2);
    expect(pics.page).toBe(31);
  });

  test("stapled paper flips one sheet at a time over the top, then starts again", async () => {
    const pics = fakePics(4);
    const b = await play("your-book", { style: "stapled" }, pics);
    const pages = [];
    for (let i = 0; i < 4; i++) {
      b.tap();
      b.run(0.5);
      if (i === 0) expect(b.out.leaves[0].angle).toBeGreaterThan(1);
      b.run(0.8);
      pages.push(pics.page);
    }
    expect(pages).toEqual([1, 2, 3, 0]);
  });

  test("the album puts two wide or two tall photos on a side, and the sample fills four sides", async () => {
    const b = await play("photo-album", {}, null);
    expect(b.kit.sheets.length).toBe(40);
    const { RECIPES } = await import("../src/packs/pictures.js");
    const pics = fakePics(6);
    const a = await play("photo-album", {}, pics);
    a.tap();
    a.run(1.4);
    // Spread 1: the cover's inside, and the sailboat above the tulips.
    const ids = shownSheets(a.out).map(([id, s]) => `${id.slice(2)}:${s.page}`);
    expect(ids.sort()).toEqual(["ft:0", "fu:1"]);
    a.tap();
    a.run(1.3);
    const ids2 = shownSheets(a.out).map(([id, s]) => `${id.slice(2)}:${s.page}`);
    expect(ids2.sort()).toEqual(["bo:2", "ft:3", "fu:4"]);
    expect(pics.page).toBe(3);
    expect(RECIPES["photo-album"].pictures.sample({}).length).toBe(6);
  });

  test("the frame swings about its nail and comes to rest in about three seconds", async () => {
    const b = await play("picture-frame", {}, fakePics(1));
    b.frame();
    expect(b.out.parts.frame.angle).toBe(0);
    b.tap();
    const angles = [];
    for (let i = 0; i < 95; i++) angles.push(b.run(1 / 30).parts.frame.angle);
    expect(Math.max(...angles.map(Math.abs))).toBeGreaterThan(0.08);
    // It swings both ways, less each time.
    expect(angles.some((a) => a > 0.03) && angles.some((a) => a < -0.03)).toBe(true);
    expect(b.run(0.2).parts.frame.angle).toBe(0);
  });

  test("the digital frame fades to black, steps to the next photo and fades back in", async () => {
    const pics = fakePics(3);
    const b = await play("picture-frame", { frame: "digital" }, pics);
    b.run(1);
    expect(b.out.morph[0]).toBe(0);
    let dark = 0;
    for (let i = 0; i < 180 && pics.page === 0; i++) dark = Math.max(dark, b.run(1 / 30).morph[0]);
    expect(dark).toBeGreaterThan(0.9);
    expect(pics.page).toBe(1);
    b.run(1);
    expect(b.out.morph[0]).toBe(0);
  });
});

test.describe("your book, the album and the frame (in the app)", () => {
  test.setTimeout(300_000);
  const BK = "http://127.0.0.1:4173/tests/fixtures/bk/";

  // Opens a toy (and a file), waits for its sheets, and plays it with the
  // clock stepped by hand.
  async function open(page, id, url = null, options = {}) {
    await ready(page);
    await page.evaluate(
      async ([id, url, options]) => {
        const app = window.__splashery.app;
        await app.chooseToy(id);
        for (const [k, v] of Object.entries(options)) await app.setToyOption(k, v);
        if (url) await app.openMedia(url);
      },
      [id, url, options],
    );
    await waitSheets(page);
    await page.evaluate(() => (window.__splashery.player.frozen = true));
  }
  async function step(page, seconds) {
    for (let t = 0; t < seconds; t += 0.1) {
      await page.evaluate(() => {
        const pl = window.__splashery.player;
        pl.time += 0.1;
        pl.stage.requestRender();
      });
      await page.waitForTimeout(40);
    }
    await waitSheets(page);
  }
  const tap = (page) => page.evaluate(() => window.__splashery.player.act());
  // Taps, then steps the clock until the turn has landed (a turn waits for
  // its pages, which are built in real time).
  async function turn(page) {
    const before = await page.evaluate(() => window.__splashery.player.pictures.page);
    await tap(page);
    // Until the page has changed and every leaf lies flat again (no curl,
    // turned 0 or half a turn), twice in a row.
    let still = 0;
    for (let i = 0; i < 120 && still < 2; i++) {
      await step(page, 0.2);
      const done = await page.evaluate((b) => {
        const pl = window.__splashery.player;
        const flat = (pl.motion.out.leaves || []).every((l) => !l || (!l.curl && (Math.abs(l.angle) < 1e-6 || Math.abs(l.angle - Math.PI) < 1e-6 || Math.abs(l.angle - 2 * Math.PI + 0.06) < 1e-6))); // prettier-ignore
        return pl.pictures.page !== b && flat;
      }, before);
      still = done ? still + 1 : 0;
    }
    await step(page, 0.5);
  }

  test("a 300-page PDF is as light as a 3-page one: pages not reached are never built", async ({
    page,
  }) => {
    await open(page, "your-book", `${BK}pages3.pdf`);
    await turn(page);
    const small = await page.evaluate(() => {
      const p = window.__splashery.player.pictures;
      return { splats: p.splats(), slots: p.sheets.filter((s) => s.slot).length };
    });
    await page.evaluate(() => (window.__splashery.player.frozen = false));
    await page.evaluate((u) => window.__splashery.app.openMedia(u), `${BK}pages300.pdf`);
    await waitSheets(page);
    await page.evaluate(() => (window.__splashery.player.frozen = true));
    for (let i = 0; i < 3; i++) await turn(page);
    await page.evaluate(() => window.__splashery.player.pictures.go(249));
    await step(page, 1);
    const big = await page.evaluate(() => {
      const p = window.__splashery.player.pictures;
      return {
        splats: p.splats(),
        slots: p.sheets.filter((s) => s.slot).length,
        built: [...new Set(p.stats.rendered.map((r) => r.page))].sort((a, b) => a - b),
        page: p.page,
        count: p.info().count,
      };
    });
    expect(big.count).toBe(300);
    expect(big.page).toBe(249);
    // The splats on show are about one spread's either way.
    expect(big.splats).toBeLessThan(small.splats * 2);
    expect(big.slots).toBeLessThanOrEqual(9);
    // Built: the first spreads, the pages the next turn needs, and around
    // page 250; nothing else of the 300.
    expect(big.built.filter((p) => p > 12 && p < 240)).toEqual([]);
    expect(big.built.length).toBeLessThan(26);
  });

  test("the page shape follows the PDF: wide slides make a wide book", async ({ page }) => {
    await open(page, "your-book", `${BK}slides.pdf`);
    const r = await page.evaluate(() => {
      const pl = window.__splashery.player;
      const f = pl.pictures.sheets.find((s) => s.def.id === "f0").def;
      return { aspect: pl.proc.ctx.kit.media.aspect, w: f.width, h: f.height };
    });
    expect(r.aspect).toBeCloseTo(16 / 9, 2);
    expect(r.w / r.h).toBeCloseTo(16 / 9, 2);
  });

  test("a turned page and the open cover are sorted where they lie, on the left", async ({
    page,
  }) => {
    await open(page, "your-book", `${BK}booklet.pdf`);
    for (let i = 0; i < 2; i++) await turn(page);
    const r = await page.evaluate(() => {
      const pl = window.__splashery.player;
      const p = pl.pictures;
      // The left page's sheet: its sort centers now lie left of the spine.
      const left = p.sheets.filter((s) => s.slot?.entity.enabled && s.def.normal[2] < 0);
      const xs = left.map((s) => {
        const c = s.slot.container.centers;
        let sum = 0;
        for (let i = 0; i < s.shown.data.count; i++) sum += c[i * 3];
        return sum / s.shown.data.count;
      });
      // The kit's cover too.
      const { buf, parts } = pl.proc.ctx;
      const cover = parts.findIndex((q) => q.name === "cover");
      const cc = pl.proc.container.centers;
      let sx = 0;
      let n = 0;
      for (let i = 0; i < buf.count; i++)
        if ((Math.round(buf.anim[i * 4]) & 15) === cover) {
          sx += cc[i * 3];
          n++;
        }
      return { page: p.page, xs, cover: sx / n };
    });
    expect(r.page).toBe(3);
    expect(r.xs.length).toBe(1);
    expect(r.xs[0]).toBeLessThan(-0.1);
    expect(r.cover).toBeLessThan(-0.1);
  });

  test("the album shows the sample photos mounted with captions, and turns", async ({ page }) => {
    await open(page, "photo-album");
    await turn(page);
    const r = await page.evaluate(() => {
      const p = window.__splashery.player.pictures;
      return { kind: p.info().kind, count: p.info().count, shown: p.sheets.filter((s) => s.slot?.entity.enabled).map((s) => s.shown.page) }; // prettier-ignore
    });
    expect(r.kind).toBe("image");
    expect(r.count).toBe(6);
    expect(r.shown.sort()).toEqual([0, 1]);
  });

  test("the frame swings and settles; the digital frame steps on", async ({ page }) => {
    // In real time (the swing keeps frames coming by itself), measured on
    // the player's own clock: rendering here is slow.
    await open(page, "picture-frame");
    await page.evaluate(() => {
      const pl = window.__splashery.player;
      pl.frozen = false;
    });
    await tap(page);
    const t0 = await page.evaluate(() => window.__splashery.player.time);
    let mid = 0;
    for (let n = 0; n < 200; n++) {
      const [t, a] = await page.evaluate(() => {
        const pl = window.__splashery.player;
        return [pl.time, pl.motion.out.parts.frame.angle];
      });
      mid = Math.max(mid, Math.abs(a));
      if (t - t0 > 1.2) break;
      await page.waitForTimeout(100);
    }
    expect(mid).toBeGreaterThan(0.02);
    await page.waitForFunction((t0) => window.__splashery.player.time > t0 + 3.3, t0, { timeout: 120_000 }); // prettier-ignore
    expect(await page.evaluate(() => window.__splashery.player.motion.out.parts.frame.angle)).toBe(0); // prettier-ignore
    await page.evaluate(async () => {
      window.__splashery.player.frozen = false;
      await window.__splashery.app.setToyOption("frame", "digital");
    });
    await waitSheets(page);
    expect(await page.evaluate(() => window.__splashery.player.pictures.info().count)).toBe(7);
    // On the player's own clock, in real time: the next photo within about
    // six seconds.
    const t1 = await page.evaluate(() => window.__splashery.player.time);
    await page.waitForFunction((t1) => window.__splashery.player.pictures.page === 1 && window.__splashery.player.time < t1 + 7.5, t1, { timeout: 180_000 }); // prettier-ignore
  });

  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ])
    test(`screenshots of the three toys at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      for (const [id, name, taps] of [
        ["your-book", "book", 2],
        ["photo-album", "album", 2],
        ["picture-frame", "frame", 0],
      ]) {
        await open(page, id, id === "your-book" ? `${BK}booklet.pdf` : null);
        for (let i = 0; i < taps; i++) await turn(page);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `tests/screenshots/bk-${name}-${w}x${h}.png` });
      }
    });
});
