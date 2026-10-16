// Lane Fix13 (docs/handoff/Fix13.md): Pop out with Pop-up layers on. A
// graphic (a chart, a diagram, text) in layers has two layers, the card and
// its shapes, so it leaves the third pop sheet unasked (page -1). The engine
// never calls a sheet with no page ready (src/pictures.js, `ready`), and the
// figure waited for all three: it stayed in "prep" and never rose. In the
// Picture lab's sample (a chart) and Your book, a tap with Pop-up layers on
// did nothing. In Node the stand-in pictures' `ready` follows the engine's
// rule; in the app, the Picture lab's own sample.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

// ---- In Node ------------------------------------------------------------------------

// Builds a toy in Node and plays it (as tests/pg6.spec.mjs does). The
// pictures' ready(id) is the engine's: a sheet asked for a page (0 or more)
// shows it once built (here, three frames after it was asked); one asked for
// none (page -1) never does.
async function play(id, pics) {
  const { buildRecipe } = await import("../src/kit.js");
  const { RECIPES } = await import("../src/packs/pictures.js");
  const r = RECIPES[id];
  const opts = Object.fromEntries((r.options || []).map((o) => [o.key, o.default]));
  const it = buildRecipe(r, { seed: 5, count: 8000, options: opts }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  let out = null;
  // Each sheet's ask (its page, crop and relief) and for how many frames it
  // has held: a sheet is built a few frames after it is asked for a page.
  const asks = new Map();
  pics.ready = (sid) => {
    const a = asks.get(sid);
    return !a || (a.page >= 0 && a.n >= 3);
  };
  const note = () => {
    for (const [sid, s] of Object.entries(out.sheets || {})) {
      const key = JSON.stringify([s.page, s.crop, s.relief?.key, s.variant]);
      const a = asks.get(sid);
      if (a && a.key === key) a.n++;
      else asks.set(sid, { key, page: s.page, n: 0 });
    }
  };
  const data = { ...(b.value.kit.data || {}), pictures: pics };
  const c = { turn: 0, next: 0, pop: 0, box: 0, layers: 0 };
  let time = 1;
  let n = 0;
  let pick = null;
  const frame = () => {
    out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {}, tokens: null };
    r.drive(time, c, out, { time, R: 1, tap: n ? { n, pick } : null, data, slider: null, figures: [] }); // prettier-ignore
    note();
    return out;
  };
  const tap = (point) => {
    pick = r.action.at?.(point)?.pick ?? null;
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
  const settle = async () => {
    for (let i = 0; i < 4; i++) await new Promise((res) => setTimeout(res, 0));
  };
  return { tap, run, set, settle, get out() { return out; } }; // prettier-ignore
}

// A chart's bar on white: a graphic, so its layers are the card and the bar.
function chartCanvas(w = 40, h = 30) {
  const data = new Uint8ClampedArray(w * h * 4).fill(250);
  for (let y = 8; y < 22; y++) for (let x = 10; x < 30; x++) data.set([30, 60, 150, 255], (y * w + x) * 4); // prettier-ignore
  return { width: w, height: h, getContext: () => ({ getImageData: () => ({ data, width: w, height: h }) }) }; // prettier-ignore
}
const FIG = [0.2, 0.2, 0.7, 0.6];
function chartPics(count) {
  return {
    page: 1,
    count,
    kind: "pdf",
    name: "chart",
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
    aspect: () => 612 / 792,
    links: async () => [],
    figures: async (n) => (n === 1 ? [{ box: FIG }] : []),
    crop: async () => chartCanvas(),
    openLink: () => true,
  };
}
const mid = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];

// Raises the chart with Pop-up layers on (or off) and returns the figure's
// phase after `seconds`, and the frame.
async function raiseChart(id, layers, seconds = 3) {
  const { BOOKS_R5 } = await import("../src/packs/pictures.js");
  const { PG } = BOOKS_R5;
  const pics = chartPics(id === "picture-lab" ? 3 : 9);
  const b = await play(id, pics);
  if (id !== "picture-lab") {
    // Open the book on spread 1 (page 1 on the right).
    pics.page = 0;
    b.tap([0.4, 0, 0.02]);
    b.run(1.6);
  }
  await b.settle();
  b.run(0.1);
  b.set("layers", layers);
  b.set("pop", 1);
  await b.settle();
  b.run(0.5);
  b.tap(BOOKS_R5.point(1, mid(FIG)));
  await b.settle();
  b.run(seconds);
  return { PG, F: PG.pops[0], out: b.out, b };
}

test.describe("Pop out with Pop-up layers on (no browser)", () => {
  for (const id of ["picture-lab", "your-book"]) {
    test(`${id}: a chart in layers rises as with layers off, as the card and its shapes`, async () => {
      const off = await raiseChart(id, 0);
      expect(off.F.phase).toBe("up");
      const on = await raiseChart(id, 1);
      expect(on.F.layered).toBe(true);
      expect(on.F.kind).toBe("graphic");
      expect(on.F.phase).toBe("up");
      // The card and its shapes show; the unused third sheet stays off.
      expect(on.out.sheets.pop0).toMatchObject({ page: 1, crop: FIG, visible: 1 });
      expect(on.out.sheets.pop1).toMatchObject({ page: 1, crop: FIG, visible: 1 });
      expect(on.out.sheets.pop2).toEqual({ page: -1, visible: 0 });
      // It stands in front of the page, like the figure with layers off.
      expect(on.out.parts.bk5pop0.offset[2]).toBeCloseTo(off.out.parts.bk5pop0.offset[2], 3);
      // A tap on it lays it back.
      on.b.tap([on.F.at.cx, on.F.at.cy, 0.3]);
      on.b.run(2);
      expect(on.PG.pops.length).toBe(0);
    });
  }
});

// ---- In the app ---------------------------------------------------------------------

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
}
const pops = (page) =>
  page.evaluate(async () => {
    const { PG } = (await import("/src/packs/pictures.js")).BOOKS_R5;
    return PG.pops.map((F) => ({ phase: F.phase, kind: F.kind, layered: F.layered }));
  });

test.describe("Pop out with Pop-up layers on (in the app)", () => {
  test.setTimeout(300_000);

  test("the Picture lab's chart rises with Pop-up layers on", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}&labs=1`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await waitSheets(page);
    // Pop-up layers in the Toy tab, then Pop out in the top bar.
    await page.evaluate(() => window.__splashery.app.setControl("layers", 1));
    await page.click("#pop-toggle");
    await expect(page.locator("#pop-toggle")).toHaveAttribute("aria-pressed", "true");
    const box = await page.waitForFunction(
      async () => {
        const { BK5 } = (await import("/src/packs/pictures.js")).BOOKS_R5;
        window.__splashery.player.stage.requestRender();
        const n = window.__splashery.player.pictures.page;
        return BK5.figs.get(n)?.[0] ? [n, BK5.figs.get(n)[0].box] : false;
      },
      null,
      { timeout: 60_000 },
    );
    const [n, b] = await box.jsonValue();
    await step(page, 0.5);
    const [x, y] = await page.evaluate(
      async ([n, f]) => {
        const { BOOKS_R5 } = await import("/src/packs/pictures.js");
        const pl = window.__splashery.player;
        const [x, y] = pl.screenPoint(BOOKS_R5.point(n, f));
        const r = pl.stage.canvas.getBoundingClientRect();
        return [r.left + x, r.top + y];
      },
      [n, mid(b)],
    );
    await page.mouse.click(x, y);
    // On the player's clock: it rises (as with layers off) within 6 s.
    let p = [];
    for (let i = 0; i < 30; i++) {
      await step(page, 0.2);
      p = await pops(page);
      if (p[0]?.phase === "up") break;
    }
    expect(p).toEqual([{ phase: "up", kind: "graphic", layered: true }]);
    await waitSheets(page);
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await step(page, 0.4);
      await waitSheets(page);
      await page.screenshot({ path: `tests/screenshots/fx13-lab-layers-${w}x${h}.png` });
    }
  });
});
