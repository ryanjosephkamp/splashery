import { test, expect } from "@playwright/test";
import { posePass } from "../src/pose.js";
import { buildSheet } from "../src/picture-splats.js";
import { KINDS } from "../src/effects.js";
import { normalizeMedia, normalizeScene } from "../src/state.js";
import { FIX, ORIGIN, ready, waitSheets, open, step, tap, turn, pageNow } from "./bk-helpers.mjs";

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
    // Opened as a file: the test server (python's http.server) doesn't
    // answer range requests, and Chromium then can't always seek a video it
    // streamed from an address (it held at 0 about one run in two).
    await page.evaluate(async (u) => {
      const blob = await (await fetch(u)).blob();
      await window.__splashery.app.openMedia(new File([blob], "clip.webm", { type: "video/webm" }));
    }, `${FIX}clip.webm`);
    await waitSheets(page);
    await expect(page.locator("#toy-media-scrub")).toBeVisible();
    const d = await page.evaluate(() => window.__splashery.player.pictures.api.duration);
    expect(Number.isFinite(d) && d > 0.5, `duration ${d}`).toBe(true);
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

  test("a set of pictures can be put in a new order (pics.reorder, names, thumb)", async ({
    page,
  }) => {
    await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("photo-album"));
    await waitSheets(page);
    const r = await page.evaluate(async () => {
      const api = window.__splashery.player.pictures.api;
      const names = api.names;
      api.go(2);
      const shown = api.nameOf(api.page);
      const bad = [api.reorder([0, 0, 1, 2, 3, 4]), api.reorder([0, 1]), api.reorder(null)];
      const ok = api.reorder(names.map((_, i) => names.length - 1 - i));
      const thumb = await api.thumb(0, 40);
      return { names, bad, ok, now: api.names, shown, still: api.nameOf(api.page), thumb: thumb && [thumb.width, thumb.height] }; // prettier-ignore
    });
    expect(r.names.length).toBe(6);
    expect(r.bad).toEqual([false, false, false]);
    expect(r.ok).toBe(true);
    expect(r.now).toEqual([...r.names].reverse());
    // The picture on show stays on show, and its pages are built again.
    expect(r.still).toBe(r.shown);
    expect(Math.max(...r.thumb)).toBe(40);
    await waitSheets(page);
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

// Builds a toy in Node and plays it: tap() taps (tap(point) where it lands,
// in recipe units), pull(points) presses, moves along the points (a frame
// each) and lets go, run(s) steps the clock.
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
  let pick = null;
  let out = null;
  const frame = () => {
    out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null };
    r.drive(time, { turn: 0, swing: 0 }, out, { time, R: 1, tap: n ? { n, pick } : null, data });
    return out;
  };
  const tap = (point = null) => {
    pick = (point && r.action.at?.(point)?.pick) ?? null;
    n++;
    return frame();
  };
  const pull = (points) => {
    if (!r.drag.at(points[0])) return false;
    r.drag.start(points[0], time);
    for (const p of points.slice(1)) {
      time += 1 / 30;
      r.drag.move(p, time);
      frame();
    }
    r.drag.end(time);
    return true;
  };
  const run = (s) => {
    for (let t = 0; t < s; t += 1 / 30) {
      time += 1 / 30;
      frame();
    }
    return out;
  };
  return { kit: b.value.kit, tap, pull, run, frame, get out() { return out; } }; // prettier-ignore
}

// A stand-in for info.data.pictures: every page is ready at once.
function fakePics(count) {
  return {
    page: 0,
    count,
    kind: "pdf",
    go(p, { exact = false } = {}) {
      this.page = Math.max(0, Math.min(count - 1, Math.round(p)));
      this.exactPage = exact ? this.page : null;
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

  test("an exact search selection keeps either page of a spread without changing its layout or turns", async () => {
    for (const style of ["hardcover", "paperback", "magazine", "spiral"]) {
      const pics = fakePics(40);
      const b = await play("your-book", { style }, pics);
      b.frame();
      pics.go(30);
      b.run(0.2);
      expect(pics.page).toBe(31);
      const layout = structuredClone({
        sheets: b.out.sheets,
        leaves: b.out.leaves,
        view: b.out.view,
      });
      for (const n of [0, 30, 31, 30]) {
        pics.go(n, { exact: true });
        b.run(1.4);
        expect(pics.page, `${style}: selected page ${n}`).toBe(n);
        if (!n) continue;
        expect({ sheets: b.out.sheets, leaves: b.out.leaves, view: b.out.view }, style).toEqual(
          layout,
        );
        expect(
          shownSheets(b.out).some(([, s]) => s.page === n),
          style,
        ).toBe(true);
      }
      // Previous/Next and taps still turn by a whole spread after selecting
      // its left page, with the existing default right-page selection.
      pics.next();
      b.run(1.4);
      expect(pics.page, style).toBe(33);
      pics.prev();
      b.run(1.4);
      expect(pics.page, style).toBe(31);
      b.tap();
      b.run(1.4);
      expect(pics.page, style).toBe(33);
    }
  });

  test("a tap turns by where it lands: the right page forward, the left back; stapled paper's top quarter back", async () => {
    // Points in recipe units: the spine is at x = 0; a page is 1 high.
    const at = (x, y = 0) => [x, y, 0.02];
    for (const id of ["your-book", "photo-album"]) {
      const styles = id === "your-book" ? ["hardcover", "paperback", "magazine", "spiral"] : ["leather"]; // prettier-ignore
      for (const style of styles) {
        const pics = fakePics(12);
        const b = await play(id, id === "your-book" ? { style } : { cover: style }, pics);
        b.frame();
        const seen = [];
        // The closed cover opens wherever it's tapped (here on its left).
        for (const x of [-0.2, 0.3, 0.3, -0.3, 0.001, -0.4]) {
          b.tap(at(x));
          b.run(1.6);
          seen.push(pics.page);
        }
        if (id === "your-book") expect(seen, style).toEqual([1, 3, 5, 3, 5, 3]);
        // (The album's pages are its photos: forward, forward, back, forward, back.)
        else expect([seen[2] > seen[1], seen[1] > seen[0], seen[3], seen[4], seen[5]]).toEqual([true, true, seen[1], seen[2], seen[1]]); // prettier-ignore
      }
    }
    const pics = fakePics(6);
    const s = await play("your-book", { style: "stapled" }, pics);
    s.frame();
    const seen = [];
    for (const y of [-0.3, 0.1, 0.4, 0.3, 0.2]) {
      s.tap(at(0, y));
      s.run(1.6);
      seen.push(pics.page);
    }
    expect(seen).toEqual([1, 2, 1, 0, 1]);
    // The Picture lab: left back, right (or the middle) forward.
    const { RECIPES } = await import("../src/packs/pictures.js");
    const lab = RECIPES["picture-lab"];
    expect(lab.action.at([-0.5, 0, 0]).pick).toBe(1);
    expect(lab.action.at([0, 0, 0]).pick).toBe(0);
  });

  test("a short pull falls back and a long one turns; the album's heavy pages lag the finger", async () => {
    const line = (x0, x1, y = 0, n = 12) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y, 0.02]); // prettier-ignore
    const pics = fakePics(20);
    const b = await play("your-book", {}, pics);
    b.frame();
    b.tap([0.3, 0, 0.02]);
    b.run(1.6);
    expect(pics.page).toBe(1);
    // A tap anywhere off the book is not a pull.
    expect(b.pull(line(0.3, 0.2, 0.9))).toBe(false);
    // Pulled a little way and let go: the page falls back.
    expect(b.pull(line(0.6, 0.4))).toBe(true);
    const mid = b.run(0.1);
    expect(mid.leaves.some((l) => l && l.angle > 0.05)).toBe(true);
    b.run(1.5);
    expect(pics.page).toBe(1);
    expect(b.frame().leaves.every((l) => !l || l.angle < 0.01 || l.angle > Math.PI - 0.01)).toBe(true); // prettier-ignore
    // Pulled past the spine: it turns.
    b.pull(line(0.6, -0.4, 0, 20));
    b.run(1.5);
    expect(pics.page).toBe(3);
    // The left page pulled over to the right goes back.
    b.pull(line(-0.6, 0.4, 0, 20));
    b.run(1.5);
    expect(pics.page).toBe(1);
    // Stapled paper pulls upward.
    const sp = fakePics(6);
    const s = await play("your-book", { style: "stapled" }, sp);
    s.frame();
    expect(s.pull(Array.from({ length: 21 }, (_, i) => [0, -0.3 + (0.9 * i) / 20, 0.02]))).toBe(true); // prettier-ignore
    s.run(2);
    expect(sp.page).toBe(1);
    // The album's page lags the same quick pull more than the book's
    // (its angle as the finger lets go).
    const lag = async (id) => {
      const t = await play(id, {}, fakePics(8));
      t.frame();
      t.tap([0.3, 0, 0.02]);
      t.run(1.6);
      t.pull(line(0.7, 0.1, 0, 5));
      return Math.max(...t.out.leaves.filter(Boolean).map((l) => (l.angle < 3 ? l.angle : 0)));
    };
    const book = await lag("your-book");
    const album = await lag("photo-album");
    expect(book).toBeGreaterThan(0.5);
    expect(album).toBeLessThan(book * 0.8);
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
    expect(b.kit.sheets.length).toBe(43); // (lane Books r5: and the pop-out sheets, three since lane Pages r6)
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

  test("the digital frame steps in order, or at random with Order: Random", async () => {
    const seq = async (order) => {
      const pics = fakePics(6);
      const b = await play("picture-frame", { frame: "digital", order }, pics);
      const pages = [0];
      for (let i = 0; i < 40 * 30; i++) {
        b.run(1 / 30);
        if (pics.page !== pages[pages.length - 1]) pages.push(pics.page);
      }
      return pages;
    };
    const inOrder = await seq("inorder");
    expect(inOrder.length).toBeGreaterThan(5);
    expect(inOrder.every((p, i) => i === 0 || p === (inOrder[i - 1] + 1) % 6)).toBe(true);
    const random = await seq("random");
    expect(random.length).toBeGreaterThan(5);
    expect(random.some((p, i) => i > 0 && p !== (random[i - 1] + 1) % 6)).toBe(true);
    expect(random.every((p, i) => i === 0 || p !== random[i - 1])).toBe(true);
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

  test("page focus: a double-tap focuses a page; forward goes on to the right page, then turns", async () => {
    const { RECIPES } = await import("../src/packs/pictures.js");
    const at = (x, y = 0) => [x, y, 0.02];
    const r = RECIPES["your-book"];
    const pics = fakePics(12);
    const b = await play("your-book", { reading: "both" }, pics);
    const view = () => b.frame().view;
    expect(view().key).toBe("all");
    // A double-tap off the book isn't the book's (the view resets instead).
    expect(r.focus(null)).toBe(false);
    b.tap(at(0.3));
    b.run(1.6);
    expect(pics.page).toBe(1);
    // A double-tap on the right page: the view fills with it.
    expect(r.focus(at(0.3))).toBe(true);
    const v = view();
    expect(v.key).toBe("R");
    expect(v.center[0]).toBeGreaterThan(0.3);
    expect(v.size[1]).toBe(1);
    // Taps go by the page in view: its right half forward, its left half back.
    const seen = [];
    for (const x of [0.55, -0.2, 0.25, -0.55, 0.55]) {
      b.tap(at(x));
      b.run(1.6);
      seen.push(`${pics.page}${b.out.view.key}`);
    }
    // Forward turns onto the next left page, then goes on to its right page;
    // back goes to the left page, then turns back onto the right page.
    expect(seen).toEqual(["3L", "3R", "3L", "1R", "3L"]);
    // A double-tap again shows the whole book.
    expect(r.focus(at(-0.4))).toBe(true);
    expect(view().key).toBe("all");
    b.tap(at(0.4));
    b.run(1.6);
    expect([pics.page, b.out.view.key]).toEqual([5, "all"]);
  });

  test("One page keeps a page in view (a phone held upright opens that way); old scenes still load", async () => {
    const { RECIPES } = await import("../src/packs/pictures.js");
    const { resolveOptions } = await import("../src/player.js").catch(() => ({}));
    const at = (x, y = 0) => [x, y, 0.02];
    const pics = fakePics(12);
    const b = await play("your-book", { reading: "one" }, pics);
    expect(b.frame().view.key).toBe("C");
    const seen = [];
    for (const x of [0.3, 0.55, -0.2, 0.55]) {
      b.tap(at(x));
      b.run(1.6);
      seen.push(`${pics.page}${b.out.view.key}`);
    }
    expect(seen).toEqual(["1R", "3L", "3R", "5L"]);
    // Let go (a double-tap, or a zoom out): the next turn brings a page back.
    RECIPES["your-book"].focus(null);
    expect(b.frame().view.key).toBe("all");
    b.tap(at(0.4));
    b.run(1.6);
    expect(`${pics.page}${b.out.view.key}`).toBe("7L");
    // The album and stapled paper read the same way.
    const a = await play("photo-album", { reading: "one" }, fakePics(12));
    expect(a.frame().view.key).toBe("C");
    a.tap(at(0.5));
    a.run(1.6);
    expect(a.out.view.key).toBe("R");
    const s = await play("your-book", { reading: "one", style: "stapled" }, fakePics(4));
    s.tap(at(0, -0.2));
    s.run(1.6);
    expect(s.out.view.key).toBe("C");
    // The default follows the screen's shape; a scene without the choice
    // (every old link) gets it.
    const opt = RECIPES["your-book"].options.find((o) => o.key === "reading");
    const had = [globalThis.innerWidth, globalThis.innerHeight];
    try {
      Object.assign(globalThis, { innerWidth: 390, innerHeight: 844 });
      expect(opt.default).toBe("one");
      if (resolveOptions) expect(resolveOptions(RECIPES["your-book"], { style: "paperback" }).reading).toBe("one"); // prettier-ignore
      Object.assign(globalThis, { innerWidth: 1440, innerHeight: 900 });
      expect(opt.default).toBe("both");
    } finally {
      Object.assign(globalThis, { innerWidth: had[0], innerHeight: had[1] });
    }
  });

  test("a double-tap fills the view with the frame's photo or the lab's page, and again lets go", async () => {
    const { RECIPES } = await import("../src/packs/pictures.js");
    for (const id of ["picture-frame", "picture-lab"]) {
      const b = await play(id, {}, fakePics(2));
      expect(b.frame().view.key, id).toBe("all");
      expect(RECIPES[id].focus([0, 0, 0])).toBe(true);
      const v = b.frame().view;
      expect(v.center, id).toEqual([0, 0, 0]);
      expect(v.size[0] > 0.5 && v.size[1] > 0.5, id).toBe(true);
      expect(RECIPES[id].focus(null)).toBe(true);
      expect(b.frame().view.key, id).toBe("all");
    }
  });
});

test.describe("your book, the album and the frame (in the app)", () => {
  test.setTimeout(300_000);
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

  test("a frame plays a GIF on a loop and a video by itself, muted", async ({ page }) => {
    await open(page, "picture-frame", `${ORIGIN}${FIX}anim.gif`);
    const frames = await page.evaluate(async () => {
      const p = window.__splashery.player.pictures;
      const seen = new Set();
      const t0 = performance.now();
      while (performance.now() - t0 < 2500) {
        window.__splashery.player.stage.requestRender();
        seen.add(p.gifFrame);
        await new Promise((r) => setTimeout(r, 50));
      }
      return seen.size;
    });
    expect(frames).toBeGreaterThan(4);
    await page.evaluate((u) => window.__splashery.app.openMedia(u), `${ORIGIN}${FIX}clip.webm`);
    await waitSheets(page);
    await step(page, 0.5);
    const v = await page.evaluate(async () => {
      const m = window.__splashery.player.pictures.media;
      const t = m.video.currentTime;
      await new Promise((r) => setTimeout(r, 1200));
      return { playing: m.playing, moved: m.video.currentTime - t, muted: m.video.muted };
    });
    expect(v).toMatchObject({ playing: true, muted: true });
    // (A short clip loops: its time moved, forward or round again.)
    expect(Math.abs(v.moved)).toBeGreaterThan(0.1);
  });

  test("the digital frame lists its photos in the Toy tab and keeps the order you set", async ({
    page,
  }) => {
    await open(page, "picture-frame", null, { frame: "digital" });
    const names = await page.evaluate(() => window.__splashery.player.pictures.api.names);
    expect(names.length).toBe(7);
    // The list, in the Toy tab.
    await page.evaluate(() => window.__splashery.app.ui.showTab("play"));
    await page.waitForFunction(() => document.querySelectorAll("#toy-media-list li").length === 7, null, { timeout: 60_000 }); // prettier-ignore
    // Move the first one down: the first two swap.
    // (The phone's sheet may be folded away: press it from the page.)
    await page.evaluate(() => document.querySelector("#toy-media-list li").querySelectorAll("button")[1].click()); // prettier-ignore
    const after = await page.evaluate(() => window.__splashery.player.pictures.api.names);
    expect(after.slice(0, 2)).toEqual([names[1], names[0]]);
    await page.waitForFunction((n) => document.querySelector("#toy-media-list li span")?.textContent === n, names[1], { timeout: 30_000 }); // prettier-ignore
    // A new order from a recipe's side: reversed; the photo on show stays.
    const r = await page.evaluate(() => {
      const api = window.__splashery.player.pictures.api;
      const shown = api.nameOf(api.page);
      const ok = api.reorder(api.names.map((_, i, a) => a.length - 1 - i));
      return { ok, shown, now: api.nameOf(api.page), names: api.names };
    });
    expect(r.ok).toBe(true);
    expect(r.now).toBe(r.shown);
    expect(r.names).toEqual([...after].reverse());
    // The frame steps on in the new order.
    const p0 = await pageNow(page);
    await page.waitForFunction((p0) => window.__splashery.player.pictures.page === (p0 + 1) % 7, p0, { timeout: 180_000 }); // prettier-ignore
  });
});
