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
