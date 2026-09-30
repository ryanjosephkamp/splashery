// Lane UI r2: focus mode, the phone sheet's five stops, the desktop panel's
// fold and gallery page, the drawing pad's pens and eraser, moving (panning)
// a toy, and the Home Screen manifest. All of it is behind the labs switch
// (?labs=1) until the owner's marks.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { encodeSceneHash } from "../src/codec.js";
import { buildRecipe } from "../src/kit.js";
import { RECIPES } from "../src/packs/computing.js";

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const DESK = { viewport: { width: 1440, height: 900 } };
const SHOTS = new URL("./screenshots/", import.meta.url);

async function open(page, extra = "", hash = "") {
  await page.goto(`/?labs=1&renderer=webgl2&profile=weak${extra}${hash}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

async function pick(page, id) {
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.app.player.scene.toy.id === id, id);
  await page.waitForTimeout(400);
}

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

// Real touches through the DevTools protocol, so the page sees real pointer
// events (one or two fingers). `paths` is one list of [x, y] per finger.
async function touchDrag(page, paths, steps = 12) {
  const cdp = await page.context().newCDPSession(page);
  const at = (k) =>
    paths.map((p, id) => {
      const f = k / steps;
      const i = Math.min(p.length - 2, Math.floor(f * (p.length - 1)));
      const t = f * (p.length - 1) - i;
      return {
        x: p[i][0] + (p[i + 1][0] - p[i][0]) * t,
        y: p[i][1] + (p[i + 1][1] - p[i][1]) * t,
        id,
      };
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(0) });
  for (let k = 1; k <= steps; k++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(k) });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(150);
}

async function centerOf(page, sel) {
  const b = await page.locator(sel).boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
}

const stop = (page) => page.evaluate(() => window.__splashery.app.ui.sheetStop());

// Draws strokes (lists of [x, y] as fractions of the pad) on the pad, with
// `per` pointer moves between each pair of points.
async function drawOnPad(page, strokes, per = 10) {
  await page.locator("#toy-input-pad").evaluate(
    (c, { strokes, per }) => {
      const r = c.getBoundingClientRect();
      const at = (x, y) => ({
        clientX: r.left + r.width * x,
        clientY: r.top + r.height * y,
        pointerId: 1,
        bubbles: true,
      });
      for (const s of strokes) {
        c.dispatchEvent(new PointerEvent("pointerdown", at(...s[0])));
        for (let i = 1; i < s.length; i++)
          for (let k = 1; k <= per; k++) {
            const f = k / per;
            c.dispatchEvent(
              new PointerEvent(
                "pointermove",
                at(
                  s[i - 1][0] + (s[i][0] - s[i - 1][0]) * f,
                  s[i - 1][1] + (s[i][1] - s[i - 1][1]) * f,
                ),
              ),
            );
          }
        c.dispatchEvent(new PointerEvent("pointerup", at(...s[s.length - 1])));
      }
    },
    { strokes, per },
  );
}

// The pad's cells, read through its "Read my digit" button.
async function padCells(page) {
  await page.click("#toy-input-pad-go");
  await page.waitForFunction(() =>
    /^pad:/.test(window.__splashery.app.player.scene.toy.options?.digit || ""),
  );
  const text = await page.evaluate(() => window.__splashery.app.player.scene.toy.options.digit);
  return text.slice(4).split(",").map(Number);
}

function cnnReads(padText) {
  const it = buildRecipe(RECIPES.cnn, { seed: 5, count: 6000, options: { view: "draw", digit: padText } }, () => {}); // prettier-ignore
  let b = it.next();
  while (!b.done) b = it.next();
  return b.value.kit.data.digit;
}

test.describe("phone", () => {
  test.use(PHONE);

  test("focus mode hides the sheet and the top bar; the corner button and a swipe up bring them back", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await expect(page.locator("#focus-toggle")).toBeVisible();
    await page.screenshot({ path: new URL("ui2-row-390x844.png", SHOTS).pathname });
    await page.click("#focus-toggle");
    await expect(page.locator("body")).toHaveClass(/\bfocus\b/);
    for (const sel of ["#panel", ".brand", "#sound-toggle", "#view-reset", "#focus-toggle"])
      await expect(page.locator(sel)).toBeHidden();
    await expect(page.locator("#focus-exit")).toBeVisible();
    await page.waitForTimeout(500);
    const box = await page.locator("#stage").boundingBox();
    expect(box.height).toBeGreaterThan(830);
    await page.screenshot({ path: new URL("ui2-focus-390x844.png", SHOTS).pathname });
    // A swipe up from the bottom edge.
    await touchDrag(page, [
      [
        [195, 838],
        [195, 700],
      ],
    ]);
    await expect(page.locator("body")).not.toHaveClass(/\bfocus\b/);
    await expect(page.locator("#panel")).toBeVisible();
    // The corner button.
    await page.click("#focus-toggle");
    await page.click("#focus-exit");
    await expect(page.locator("#panel")).toBeVisible();
    await expect(page.locator(".brand")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the sheet has five stops: hidden, row, grid, panel and full", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    expect(await stop(page)).toBe("row");
    const [hx, hy] = await centerOf(page, "#sheet-handle");
    // Swipe the handle down: hidden, and only the handle stays.
    await touchDrag(page, [
      [
        [hx, hy],
        [hx, hy + 80],
      ],
    ]);
    expect(await stop(page)).toBe("hidden");
    await expect(page.locator("#shelf")).toBeHidden();
    await expect(page.locator("#sheet-handle")).toBeVisible();
    const hiddenH = (await page.locator("#panel").boundingBox()).height;
    expect(hiddenH).toBeLessThan(60);
    await page.waitForTimeout(300);
    await page.screenshot({ path: new URL("ui2-hidden-390x844.png", SHOTS).pathname });
    // Swipe it up: the row again.
    const [h2x, h2y] = await centerOf(page, "#sheet-handle");
    await touchDrag(page, [
      [
        [h2x, h2y],
        [h2x, h2y - 80],
      ],
    ]);
    expect(await stop(page)).toBe("row");
    await expect(page.locator("#shelf")).toBeVisible();
    // Up again: the grid; the maximize button fills the screen with it.
    const [h3x, h3y] = await centerOf(page, "#sheet-handle");
    await touchDrag(page, [
      [
        [h3x, h3y],
        [h3x, h3y - 80],
      ],
    ]);
    expect(await stop(page)).toBe("grid");
    await page.click("#sheet-max");
    expect(await stop(page)).toBe("full");
    await expect(page.locator("body")).toHaveClass(/shelf-grid/);
    await page.waitForTimeout(300);
    const top = (await page.locator("#panel").boundingBox()).y;
    expect(top).toBeGreaterThan(140); // a strip of the toy still shows
    expect(top).toBeLessThan(200);
    await page.screenshot({ path: new URL("ui2-gallery-full-390x844.png", SHOTS).pathname });
    // More: the settings; the maximize button fills the screen with them.
    await page.click("#sheet-toggle");
    expect(await stop(page)).toBe("panel");
    await page.click("#sheet-max");
    expect(await stop(page)).toBe("full");
    await expect(page.locator("body")).toHaveClass(/sheet-open/);
    await expect(page.locator("#shelf")).toBeHidden();
    await expect(page.locator("#panes")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: new URL("ui2-settings-full-390x844.png", SHOTS).pathname });
    // Escape goes back to the row.
    await page.keyboard.press("Escape");
    expect(await stop(page)).toBe("row");
    expect(errors).toEqual([]);
  });

  test("the CNN opens its settings at the full stop, the pad fits whole, and it reads a drawn 3 and 7", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "cnn");
    await page.click("#sheet-toggle");
    expect(await stop(page)).toBe("full");
    await expect(page.locator("#toy-input-pad-fine")).toHaveAttribute("aria-pressed", "true");
    // The pad and its buttons fit on the screen once scrolled to.
    await page.locator("#toy-input-pad-go").scrollIntoViewIfNeeded();
    const pad = await page.locator("#toy-input-pad").boundingBox();
    const go = await page.locator("#toy-input-pad-go").boundingBox();
    expect(go.y + go.height - pad.y).toBeLessThan(844 - 190);
    expect(pad.y).toBeGreaterThan(150);
    const DIGITS = {
      3: [[[0.22, 0.14], [0.6, 0.12], [0.76, 0.24], [0.66, 0.42], [0.42, 0.48], [0.66, 0.54], [0.78, 0.7], [0.66, 0.86], [0.24, 0.88]]], // prettier-ignore
      7: [
        [
          [0.18, 0.14],
          [0.82, 0.14],
          [0.62, 0.45],
          [0.46, 0.9],
        ],
      ],
    };
    for (const [digit, strokes] of Object.entries(DIGITS)) {
      await page.click("#toy-input-pad-clear");
      await drawOnPad(page, strokes);
      const cells = await padCells(page);
      // The fine pen leaves a thin line, not a blob.
      expect(cells.filter((v) => v > 0).length).toBeLessThan(40);
      expect(cnnReads(`pad:${cells.join(",")}`), `a drawn ${digit}`).toBe(Number(digit));
      if (digit === "3")
        await page.screenshot({ path: new URL("ui2-cnn-pad-390x844.png", SHOTS).pathname });
    }
    // A real downward stroke on the pad draws; it doesn't close the sheet.
    const box = await page.locator("#toy-input-pad").boundingBox();
    await touchDrag(page, [
      [
        [box.x + box.width * 0.5, box.y + box.height * 0.05],
        [box.x + box.width * 0.5, box.y + box.height * 0.95],
      ],
    ]);
    expect(await stop(page)).toBe("full");
    expect(errors).toEqual([]);
  });

  test("two fingers moving together move the toy; a pinch still zooms; Reset centers it", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "donut");
    const before = await page.evaluate(() => window.__splashery.app.player.camera.getState());
    expect(before.pan).toBeUndefined();
    await touchDrag(page, [
      [
        [150, 300],
        [230, 360],
      ],
      [
        [230, 300],
        [310, 360],
      ],
    ]);
    const after = await page.evaluate(() => window.__splashery.app.player.camera.getState());
    expect(after.pan).toBeDefined();
    expect(Math.hypot(...after.pan)).toBeGreaterThan(0.1);
    // Turning is still one finger's: the yaw did not change with the move.
    expect(Math.abs(after.yaw - before.yaw)).toBeLessThan(0.05);
    await page.click("#view-reset");
    await page.waitForTimeout(600);
    const reset = await page.evaluate(() => window.__splashery.app.player.camera.getState());
    expect(reset.pan).toBeUndefined();
    expect(errors).toEqual([]);
  });
});

test.describe("computer", () => {
  test.use(DESK);

  test("focus mode hides the panel and top bar, and Escape restores them", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await page.keyboard.press("f");
    await expect(page.locator("#panel")).toBeHidden();
    await expect(page.locator(".brand")).toBeHidden();
    await expect(page.locator("#focus-exit")).toBeVisible();
    await page.waitForTimeout(400);
    expect((await page.locator("#stage").boundingBox()).width).toBe(1440);
    await page.screenshot({ path: new URL("ui2-focus-1440x900.png", SHOTS).pathname });
    await page.keyboard.press("Escape");
    await expect(page.locator("#panel")).toBeVisible();
    await expect(page.locator(".brand")).toBeVisible();
    await expect(page.locator("#focus-exit")).toBeHidden();
    // The button does the same.
    await page.click("#focus-toggle");
    await expect(page.locator("#panel")).toBeHidden();
    await page.click("#focus-exit");
    await expect(page.locator("#panel")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the panel folds to an edge and comes back, and the gallery opens as a page", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await page.screenshot({ path: new URL("ui2-desktop-1440x900.png", SHOTS).pathname });
    await page.keyboard.press("[");
    await expect(page.locator("#panel")).toBeHidden();
    await page.waitForTimeout(400);
    expect((await page.locator("#stage").boundingBox()).width).toBeGreaterThan(1400);
    await expect(page.locator("#panel-fold")).toBeVisible();
    await page.screenshot({ path: new URL("ui2-folded-1440x900.png", SHOTS).pathname });
    // Remembered after a reload.
    await page.reload();
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page.locator("#panel")).toBeHidden();
    await page.click("#panel-fold");
    await expect(page.locator("#panel")).toBeVisible();
    // The panel's edge still sets its width.
    const grip = page.locator(".grip-panel");
    const g = await grip.boundingBox();
    await page.mouse.move(g.x + 4, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x - 150, g.y + g.height / 2, { steps: 5 });
    await page.mouse.up();
    expect((await page.locator("#panel").boundingBox()).width).toBeGreaterThan(470);
    // The gallery page covers the stage; Escape closes it; a pick closes it.
    await page.click("#gallery-open");
    await expect(page.locator("body")).toHaveClass(/gallery-page/);
    const pb = await page.locator("#panel").boundingBox();
    expect(pb.x).toBeLessThan(20);
    expect(pb.width).toBeGreaterThan(1380);
    await page.waitForTimeout(300);
    await page.screenshot({ path: new URL("ui2-gallery-1440x900.png", SHOTS).pathname });
    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveClass(/gallery-page/);
    await page.click("#gallery-open");
    await page.click(".toy-card[data-toy='donut']");
    await expect(page.locator("body")).not.toHaveClass(/gallery-page/);
    await page.waitForFunction(() => window.__splashery.app.player.scene.toy.id === "donut");
    expect(errors).toEqual([]);
  });

  test("the pad inks by distance, not by events, and the eraser clears", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "cnn");
    await expect(page.locator("#toy-input-pad-medium")).toHaveAttribute("aria-pressed", "true");
    const line = [
      [
        [0.15, 0.45],
        [0.85, 0.55],
      ],
    ];
    const sum = (c) => c.reduce((a, b) => a + b, 0);
    await page.click("#toy-input-pad-clear");
    await drawOnPad(page, line, 60); // slow: many small moves
    const slow = await padCells(page);
    await page.click("#toy-input-pad-clear");
    await drawOnPad(page, line, 4); // fast: a few long moves
    const fast = await padCells(page);
    expect(sum(slow)).toBeGreaterThan(40);
    expect(Math.abs(sum(slow) - sum(fast)) / sum(slow)).toBeLessThan(0.15);
    expect(Math.abs(slow.filter((v) => v > 0).length - fast.filter((v) => v > 0).length)).toBeLessThanOrEqual(2); // prettier-ignore
    // The fine pen draws thinner than the bold one.
    await page.click("#toy-input-pad-clear");
    await page.click("#toy-input-pad-fine");
    await drawOnPad(page, line);
    const fine = await padCells(page);
    await page.click("#toy-input-pad-clear");
    await page.click("#toy-input-pad-bold");
    await drawOnPad(page, line);
    const bold = await padCells(page);
    expect(fine.filter((v) => v > 0).length).toBeLessThan(bold.filter((v) => v > 0).length);
    // The eraser, run over the line, takes the ink away.
    await page.click("#toy-input-pad-erase");
    await expect(page.locator("#toy-input-pad-erase")).toHaveAttribute("aria-pressed", "true");
    await drawOnPad(page, line);
    await drawOnPad(page, line);
    // An empty pad can't be read (the toy asks for a digit), so count the
    // lit cells on the pad itself.
    const raw = await page.evaluate(() => {
      const c = document.querySelector("#toy-input-pad");
      const g = c.getContext("2d");
      const w = c.width / 8;
      let lit = 0;
      for (let j = 0; j < 8; j++)
        for (let i = 0; i < 8; i++) {
          const d = g.getImageData(i * w + w / 2, j * w + w / 2, 1, 1).data;
          if (d[0] > 40) lit++;
        }
      return lit;
    });
    expect(raw).toBe(0);
    expect(errors).toEqual([]);
  });

  test("Shift-drag moves the toy within reach, Reset centers it, and a link keeps the move", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "donut");
    const cam = () => page.evaluate(() => window.__splashery.app.player.camera.getState());
    const [x, y] = await centerOf(page, "#stage");
    const start = await cam();
    await page.keyboard.down("Shift");
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 120, y + 40, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    const moved = await cam();
    expect(moved.pan).toBeDefined();
    expect(Math.abs(moved.yaw - start.yaw)).toBeLessThan(0.02); // it moved, it didn't turn
    await page.waitForTimeout(400);
    await page.screenshot({ path: new URL("ui2-pan-1440x900.png", SHOTS).pathname });
    // A long drag stays within reach of the toy.
    await page.keyboard.down("Alt");
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 3000, y - 3000, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up("Alt");
    const far = await cam();
    expect(Math.max(...far.pan.map(Math.abs))).toBeLessThanOrEqual(1);
    // A link keeps the move.
    const link = await page.evaluate(() => window.__splashery.app.copyLink());
    const scene = await page.evaluate(() => window.__splashery.exportScene());
    expect(scene.camera.pan).toEqual(far.pan);
    const page2 = await page.context().newPage();
    await open(page2, "", new URL(link).hash);
    await page2.waitForFunction(() => window.__splashery.app.player.scene.toy.id === "donut");
    expect((await page2.evaluate(() => window.__splashery.app.player.camera.getState())).pan).toEqual(far.pan); // prettier-ignore
    // R puts it back in the middle.
    await page2.close();
    await page.bringToFront();
    await page.locator("#stage").focus();
    await page.keyboard.press("r");
    expect((await cam()).pan).toBeUndefined();
    // The view eases back to the toy's center.
    await page.waitForFunction(() => {
      const c = window.__splashery.app.player.camera;
      return c.target.every((v, i) => Math.abs(v - c.center[i]) < 1e-3);
    });
    expect(errors).toEqual([]);
  });

  test("an old version 2 link with a camera loads exactly as before, centered", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    const hash = await encodeSceneHash({
      app: "splashery",
      version: 2,
      seed: 12,
      toy: { kind: "builtin", id: "donut" },
      camera: { yaw: 1.2, pitch: 0.4, roll: 0, distance: 4 },
      effects: { twist: { on: true, amount: 0.4, wobble: 0, axis: "y" } },
      autoplay: { turntable: false, effect: "none" },
    });
    await open(page, "", `#s=${hash}`);
    await page.waitForFunction(() => window.__splashery.app.player.scene.toy.id === "donut");
    const s = await page.evaluate(() => window.__splashery.exportScene());
    expect(s.version).toBe(3);
    expect(s.camera).toEqual({ yaw: 1.2, pitch: 0.4, roll: 0, distance: 4 });
    expect(s.effects.twist).toMatchObject({ on: true, amount: 0.4 });
    const off = await page.evaluate(() => {
      const c = window.__splashery.app.player.camera;
      return c.aim.map((v, i) => Math.abs(v - c.center[i]));
    });
    expect(Math.max(...off)).toBe(0);
    expect(errors).toEqual([]);
  });

  test("the laptop still takes F as typing", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page);
    await page.click(".toy-card[data-toy='laptop']");
    await page.waitForFunction(() => window.__splashery.app.player.scene.toy.id === "laptop");
    await page.waitForTimeout(800);
    await page.locator("#stage").focus();
    await page.keyboard.press("f");
    await page.waitForTimeout(300);
    await expect(page.locator("body")).not.toHaveClass(/\bfocus\b/);
    await expect(page.locator("#panel")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test("the Home Screen manifest is valid, with its icons", async ({ page }) => {
  const m = JSON.parse(
    fs.readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8"),
  );
  expect(m.name).toBe("Splashery");
  expect(m.display).toBe("standalone");
  const sizes = m.icons.map((i) => i.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  for (const icon of m.icons) {
    const file = new URL(`../${icon.src}`, import.meta.url);
    const buf = fs.readFileSync(file);
    expect(buf.subarray(1, 4).toString()).toBe("PNG");
    const [w, h] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    expect(`${w}x${h}`).toBe(icon.sizes);
  }
  await page.goto("/");
  await expect(page.locator("link[rel='manifest']")).toHaveAttribute(
    "href",
    "./manifest.webmanifest",
  );
  await expect(page.locator("meta[name='apple-mobile-web-app-capable']")).toHaveAttribute("content", "yes"); // prettier-ignore
  const res = await page.request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
});

test("without the labs switch, the new controls stay out of sight", async ({ page }) => {
  await page.goto("/?labs=0&renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await expect(page.locator("#focus-toggle")).toBeHidden();
  await expect(page.locator("#panel-fold")).toBeHidden();
  await expect(page.locator("#gallery-open")).toBeHidden();
  await page.keyboard.press("f");
  await expect(page.locator("#panel")).toBeVisible();
});
