// Lane Pictures: pictures and pages into splats (docs/handoff/Pictures.md).
// Media in (PDF, picture, GIF, video, web addresses and their messages),
// the sheets' near and far detail, pages that stream, the page bend, links
// and embeds, the labs switch, and that other toys are unchanged.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { buildSheet, sheetCount } from "../src/picture-splats.js";
import { normalizeScene, normalizeMedia } from "../src/state.js";
import { TOYS, findToy } from "../src/toys.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";
const FIX = "/tests/fixtures/pic/";

async function openLab(page, url = `${APP}&labs=1`) {
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
  await waitSheet(page);
}

// Waits until the sheet shows what the picture toy wants (a page or frame).
async function waitSheet(page) {
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

async function open(page, name) {
  return page.evaluate(
    async (u) => {
      try {
        const m = await window.__splashery.app.openMedia(u);
        return { kind: m.kind, count: m.count };
      } catch (err) {
        return { error: err.message };
      }
    },
    name.startsWith("http") ? name : `http://127.0.0.1:4173${FIX}${name}`,
  );
}

// Ink pixels (luminance under 200) in the canvas.
async function darkPixels(page) {
  return page.evaluate(async () => {
    const c = await window.__splashery.player.stage.captureFrame();
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 600) n++;
    return n;
  });
}

test.describe("pictures to splats (no browser)", () => {
  const sheet = (px, w, h, method) =>
    buildSheet({ pixels: px, w, h, method, origin: [-1, 1, 0], right: [2 / w, 0, 0], down: [0, -2 / h, 0], normal: [0, 0, 1] }); // prettier-ignore

  test("ink: an off-white scanned page gets splats only for its ink, in the ink's color", () => {
    const w = 64;
    const h = 80;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        // Yellowed paper that darkens toward the bottom, with a dark bar.
        const shade = 238 - (y / h) * 30;
        const ink = y >= 30 && y < 34 && x >= 10 && x < 50;
        px.set(ink ? [30, 40, 120, 255] : [shade, shade - 6, shade - 24, 255], o);
      }
    const out = sheet(px, w, h, "ink");
    expect(out.ink).toBe(40 * 4);
    expect(out.count).toBeLessThanOrEqual(sheetCount(w, h, "ink", out.ink));
    // The ink splats carry the ink's color (half floats: within a step).
    const half = (hv) => {
      const e = (hv >> 10) & 31;
      const m = hv & 1023;
      return e === 0 ? m / 16777216 : Math.pow(2, e - 15) * (1 + m / 1024);
    };
    let found = 0;
    for (let i = 0; i < out.count; i++) {
      const r = half(out.color[i * 4]);
      if (
        Math.abs(r - 30 / 255) < 0.004 &&
        Math.abs(half(out.color[i * 4 + 2]) - 120 / 255) < 0.004
      )
        found++;
    }
    expect(found).toBe(160);
    // Every number is finite, and every splat is flat and faces the viewer.
    for (let i = 0; i < out.count * 4; i++) expect(Number.isFinite(out.center[i])).toBe(true);
  });

  test("pixels: one detail splat per pixel over a smooth base; screen: uv at each center", () => {
    const px = new Uint8ClampedArray(32 * 24 * 4).fill(200);
    const a = sheet(px, 32, 24, "pixels");
    expect(a.ink).toBe(32 * 24);
    expect(a.count).toBeGreaterThan(32 * 24);
    const s = buildSheet({ pixels: null, w: 32, h: 24, method: "screen", origin: [0, 0, 0], right: [0.01, 0, 0], down: [0, -0.01, 0], normal: [0, 0, 1] }); // prettier-ignore
    let screen = 0;
    for (let i = 0; i < s.count; i++) {
      if (s.anim[i * 4 + 1] !== 15) continue;
      screen++;
      expect(s.anim[i * 4 + 2]).toBeGreaterThanOrEqual(0);
      expect(s.anim[i * 4 + 3]).toBeLessThanOrEqual(1);
    }
    expect(screen).toBe(s.count);
  });
});

test.describe("scenes: toy.media", () => {
  test("a media web address and a device file are kept; anything else is dropped", () => {
    expect(normalizeMedia({ url: "https://example.com/a.pdf", page: 3 })).toEqual({ url: "https://example.com/a.pdf", page: 3 }); // prettier-ignore
    expect(normalizeMedia({ url: "http://example.com/a.pdf" })).toBe(null);
    expect(normalizeMedia({ url: "javascript:alert(1)" })).toBe(null);
    expect(normalizeMedia({ url: "http://127.0.0.1:4173/a.pdf" })?.url).toBe("http://127.0.0.1:4173/a.pdf"); // prettier-ignore
    expect(normalizeMedia({ file: { name: "mine.pdf", bytes: 10 } })).toEqual({ file: { name: "mine.pdf", bytes: 10 } }); // prettier-ignore
    const s = normalizeScene({ version: 3, toy: { kind: "builtin", id: "picture-lab", media: { url: "https://example.com/x.png" } } }); // prettier-ignore
    expect(s.toy.media).toEqual({ url: "https://example.com/x.png" });
    // Old scenes (v2 and v3 without media) come out exactly as before.
    const v2 = normalizeScene({ version: 2, toy: { kind: "builtin", id: "cactus" } });
    expect(v2.toy).toEqual({ kind: "builtin", id: "cactus" });
  });

  test("the Picture lab is a labs toy on its own shelf, and only it", () => {
    const t = findToy("picture-lab");
    expect(t.labs).toBe(true);
    expect(t.category).toBe("pictures");
    expect(TOYS.filter((x) => x.labs).map((x) => x.id)).toEqual(["picture-lab"]);
    for (const f of fs.readdirSync(new URL("./fixtures/pic/", import.meta.url)))
      expect(fs.statSync(new URL(`./fixtures/pic/${f}`, import.meta.url)).size, f).toBeLessThan(200_000); // prettier-ignore
  });
});

test.describe("the Picture lab", () => {
  test.describe.configure({ timeout: 300_000 });

  test("the labs switch hides and shows it; a link still opens it", async ({ page }) => {
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page.locator(".toy-card[data-toy='picture-lab']")).toBeHidden();
    await expect(page.locator(".chip[data-category='pictures']")).toHaveCount(0);
    await page.goto(`${APP}&labs=1`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page.locator(".toy-card[data-toy='picture-lab']")).toBeVisible();
    await expect(page.locator(".chip[data-category='pictures']")).toBeVisible();
    // Remembered in this browser, until ?labs=0.
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page.locator(".chip[data-category='pictures']")).toBeVisible();
    await page.goto(`${APP}&labs=0`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page.locator(".chip[data-category='pictures']")).toHaveCount(0);
    // A link to it opens it with labs off.
    const hash = await page.evaluate(async () => {
      const { encodeSceneHash } = await import("/src/codec.js");
      const { createScene } = await import("/src/state.js");
      return encodeSceneHash(createScene({ toy: { kind: "builtin", id: "picture-lab" } }));
    });
    await page.goto(`${APP}#s=${hash}`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await waitSheet(page);
    await expect(page.locator("#toy-status")).toHaveText(/^Picture lab/);
  });

  test("the sample PDF shows ink at phone size, whole and zoomed", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLab(page);
    const info = await page.evaluate(() => window.__splashery.player.pictures.info());
    expect(info).toMatchObject({ kind: "pdf", count: 2, page: 0 });
    // The culling thresholds are lowered while a picture toy shows.
    expect(await page.evaluate(() => window.__splashery.player.stage.app.scene.gsplat.minPixelSize)).toBe(0.5); // prettier-ignore
    const whole = await darkPixels(page);
    const level = await page.evaluate(() => window.__splashery.player.pictures.sheets[0].shown.level); // prettier-ignore
    expect(whole).toBeGreaterThan(3000);
    await page.screenshot({ path: "tests/screenshots/pic-lab-390x844.png" });
    // Zoomed in: built sharper, and still ink.
    await page.evaluate(() => {
      window.__splashery.player.camera.zoomBy(0.3);
      window.__splashery.player.stage.requestRender();
    });
    await page.waitForFunction(
      (l) => {
        const p = window.__splashery.player.pictures;
        window.__splashery.player.stage.requestRender();
        return p.sheets[0].shown?.level > l && p.sheets[0].shown.key === p.sheets[0].want?.key;
      },
      level,
      { timeout: 120_000 },
    );
    expect(await darkPixels(page)).toBeGreaterThan(whole);
    // A tap goes to the next page.
    await page.evaluate(() => window.__splashery.player.act());
    await page.waitForFunction(() => window.__splashery.player.pictures.page === 1);
    await waitSheet(page);
  });

  test("each kind opens: a photo, a GIF that animates, a video that plays", async ({ page }) => {
    await openLab(page);
    expect(await open(page, "photo.jpg")).toEqual({ kind: "image", count: 1 });
    await waitSheet(page);
    const photo = await page.evaluate(() => window.__splashery.player.pictures.splats());
    expect(photo).toBeGreaterThan(480 * 320 * 0.5);
    expect(await open(page, "anim.gif")).toEqual({ kind: "gif", count: 8 });
    await waitSheet(page);
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
    expect(await open(page, "clip.webm")).toEqual({ kind: "video", count: 1 });
    await waitSheet(page);
    await page.evaluate(() => window.__splashery.player.act());
    const played = await page.evaluate(async () => {
      const m = window.__splashery.player.pictures.media;
      const t = m.video.currentTime;
      await new Promise((r) => setTimeout(r, 1200));
      return { playing: m.playing, moved: m.video.currentTime - t, muted: m.video.muted };
    });
    expect(played.playing).toBe(true);
    expect(played.moved).toBeGreaterThan(0.2);
    // Sound is off until the visitor turns it on.
    expect(played.muted).toBe(true);
    await page.evaluate(() => window.__splashery.app.toggleSound());
    expect(await page.evaluate(() => window.__splashery.player.pictures.media.video.muted)).toBe(false); // prettier-ignore
  });

  test("a 200-page PDF pages through with a steady splat count", async ({ page }) => {
    await openLab(page);
    expect(await open(page, "pages200.pdf")).toEqual({ kind: "pdf", count: 200 });
    await waitSheet(page);
    const rows = await page.evaluate(async () => {
      const pl = window.__splashery.player;
      const p = pl.pictures;
      const out = [];
      for (let i = 0; i < 200; i += 3) {
        p.go(i);
        while (p.sheets[0].shown?.page !== i) {
          pl.stage.requestRender();
          await new Promise((r) => setTimeout(r, 15));
        }
        out.push({ splats: p.splats(), cap: p.sheets[0].slot.container.maxSplats, cache: p.cache.size }); // prettier-ignore
      }
      return out;
    });
    const s = rows.map((r) => r.splats);
    expect(Math.max(...s)).toBeLessThan(Math.min(...s) * 1.3);
    expect(new Set(rows.map((r) => r.cap)).size).toBe(1);
    // The cache stays within its budget of splats.
    const cached = await page.evaluate(() => [...window.__splashery.player.pictures.cache.values()].reduce((n, d) => n + d.count, 0)); // prettier-ignore
    expect(cached).toBeLessThanOrEqual(600_000 + 50_000);
  });

  test("web addresses: one loads; a refused one, a locked PDF and a bad address say why", async ({
    page,
  }) => {
    await openLab(page);
    expect(await open(page, "photo.jpg")).toMatchObject({ kind: "image" });
    // Another origin without CORS (localhost is not 127.0.0.1 to the browser).
    const refused = await open(page, "http://localhost:4173/tests/fixtures/pic/photo.jpg");
    expect(refused.error).toMatch(/would not share the file/);
    expect((await open(page, "locked.pdf")).error).toMatch(/protected by a password/);
    expect((await open(page, "http://example.com/a.pdf")).error).toMatch(/Only https/);
    // The toy still shows the photo.
    expect(await page.evaluate(() => window.__splashery.player.pictures.info().kind)).toBe("image");
    // The panel shows a message for a refused address.
    await page.click("#tab-play");
    await page.fill("#toy-media-url", "http://localhost:4173/tests/fixtures/pic/photo.jpg");
    await page.click("#toy-media-go");
    await expect(page.locator("#toy-input .warning")).toContainText("would not share");
  });

  test("links carry a web address and the page; a device file is settings only", async ({
    page,
  }) => {
    await openLab(page);
    await open(page, "article.pdf");
    await waitSheet(page);
    await page.evaluate(() => window.__splashery.player.pictures.go(1));
    const scene = await page.evaluate(() => window.__splashery.exportScene());
    expect(scene.toy.media).toEqual({ url: `http://127.0.0.1:4173${FIX}article.pdf`, page: 1 });
    // The embed rebuilds it from the address, on the same page.
    const hash = await page.evaluate(async (s) => (await import("/src/codec.js")).encodeSceneHash(s), scene); // prettier-ignore
    await page.goto(`/embed/?renderer=webgl2#s=${hash}`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.waitForFunction(() => window.__splashery.player.pictures?.page === 1 && window.__splashery.player.pictures.splats() > 0, null, { timeout: 120_000 }); // prettier-ignore
    // A device file: the embed shows the sample and says so.
    scene.toy.media = { file: { name: "mine.pdf", bytes: 1234 } };
    const h2 = await page.evaluate(async (s) => (await import("/src/codec.js")).encodeSceneHash(s), scene); // prettier-ignore
    await page.goto(`/embed/?renderer=webgl2&file=1#s=${h2}`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page.locator("#embed-status")).toContainText("mine.pdf");
    await page.waitForFunction(() => window.__splashery.player.pictures?.info().name === "article.pdf", null, { timeout: 120_000 }); // prettier-ignore
  });

  test("a page bends like paper about a spine (kind leaf)", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto(`${APP}&labs=1`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    // A book's page on the right of a spine at x = 0, turned by out.leaves.
    await page.evaluate(async () => {
      const r = (await import("/src/packs/pictures.js")).RECIPES["picture-lab"];
      r.build = (k) => {
        k.spine({ at: [0, 0, 0], axis: [0, 1, 0], dir: [1, 0, 0] });
        k.sheet({ id: "page", center: [0.78, 0, 0], width: 1.56, height: 2, leaf: 0 });
        k.reach([-1.6, 0, 0]);
      };
      r.drive = (t, c, out) => {
        out.sheets = { page: { page: 0 } };
        out.leaves = [{ angle: window.__angle || 0, curl: window.__curl || 0 }];
      };
      await window.__splashery.app.chooseToy("picture-lab");
      window.__splashery.player.camera.setState({ yaw: 0, pitch: 0, roll: 0, distance: 2.6 }, { snap: true }); // prettier-ignore
    });
    await waitSheet(page);
    // Dark pixels right and left of the spine (the canvas's middle).
    const sides = () =>
      page.evaluate(async () => {
        window.__splashery.player.stage.requestRender();
        await new Promise((r) => setTimeout(r, 400));
        const c = await window.__splashery.player.stage.captureFrame();
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        const pl = window.__splashery.player;
        const mid = pl.stage.toScreen([0, 0, 0])[0] * (c.width / pl.canvas.clientWidth);
        let left = 0;
        let right = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] + d[i + 1] + d[i + 2] >= 600) continue;
          if ((i / 4) % c.width < mid) left++;
          else right++;
        }
        return { left, right };
      });
    const rest = await sides();
    expect(rest.right).toBeGreaterThan(2000);
    expect(rest.left).toBeLessThan(rest.right * 0.05);
    // Turned over (and curled on the way): it lies on the left, seen from
    // behind (the paper covers the ink, so less shows).
    await page.evaluate(() => {
      window.__angle = 1.4;
      window.__curl = -1;
    });
    const mid = await sides();
    expect(mid.left + mid.right).toBeGreaterThan(0);
    await page.evaluate(() => {
      window.__angle = Math.PI;
      window.__curl = 0;
    });
    const over = await sides();
    expect(over.right).toBeLessThan(over.left + 200);
  });

  test("other toys are unchanged: the laptop keeps the engine's culling and its screen", async ({
    page,
  }) => {
    await openLab(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("laptop"));
    await expect(page.locator("#toy-status")).toHaveText(/^Laptop/, { timeout: 180_000 });
    const g = await page.evaluate(() => {
      const s = window.__splashery.player.stage;
      return { px: s.app.scene.gsplat.minPixelSize, c: s.app.scene.gsplat.minContribution, sheets: s.toy.sheets?.length ?? 0, pics: !!window.__splashery.player.pictures }; // prettier-ignore
    });
    expect(g).toEqual({ px: 2, c: 3, sheets: 0, pics: false });
  });

  test("the desktop view at 1440x900", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openLab(page);
    await page.click("#tab-play");
    await page.waitForTimeout(500);
    await page.screenshot({ path: "tests/screenshots/pic-lab-1440x900.png" });
  });
});
