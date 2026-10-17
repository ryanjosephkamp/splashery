import { expect } from "@playwright/test";

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
  const pad = await page.locator("#toy-input-pad").elementHandle();
  await page.click("#toy-input-pad-go");
  // The option changes before the asynchronous rebuild. On the second read
  // it already starts with "pad:", so that alone can return the previous input
  // and let the next stroke land on a pad the rebuild is about to replace.
  await page.waitForFunction((old) => !old.isConnected && !window.__splashery.player.loading, pad);
  await pad.dispose();
  const text = await page.evaluate(() => window.__splashery.app.player.scene.toy.options.digit);
  expect(text).toMatch(/^pad:/);
  return text.slice(4).split(",").map(Number);
}

function cnnReads(padText) {
  const it = buildRecipe(RECIPES.cnn, { seed: 5, count: 6000, options: { view: "draw", digit: padText } }, () => {}); // prettier-ignore
  let b = it.next();
  while (!b.done) b = it.next();
  return b.value.kit.data.digit;
}

export {
  PHONE,
  DESK,
  SHOTS,
  open,
  pick,
  watchErrors,
  touchDrag,
  centerOf,
  stop,
  drawOnPad,
  padCells,
  cnnReads,
};
