// Lane Sharpness (docs/handoff/Sharpness.md, docs/lab/SHARPNESS.md): the
// render levers against grain (src/sharpness.js). Since September 29, 2026
// two are the default for everyone (the pixel-ratio cap of 3 on the mid and
// high tiers, and adapt "drag"); ?sharp=0 leaves the renderer exactly as
// before; the labs switches change what they should.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&profile=mid";

async function open(page, query = "", toy = "penguin") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${APP}${query}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), toy);
  return errors;
}

// What the levers touch: the cull, the anti-aliasing define, the ratio.
const state = (page) =>
  page.evaluate(() => {
    const s = window.__splashery.player.stage;
    const g = s.app.scene.gsplat;
    return {
      sharp: s.sharp ?? null,
      minPixelSize: g.minPixelSize,
      minContribution: g.minContribution,
      antiAlias: g.antiAlias,
      ratio: s.device.maxPixelRatio,
      canvas: [s.canvas.width, s.canvas.height],
    };
  });

// The toy's pixels, drawn from the home view.
async function pixels(page) {
  return page.evaluate(async () => {
    const { player } = window.__splashery;
    const cam = player.camera;
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    cam.setTurntable(false);
    cam.cur = { ...cam.home };
    cam.tgt = { ...cam.home };
    for (let i = 0; i < 8; i++) await player.stage.captureFrame();
    const c = await player.stage.captureFrame();
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    return Array.from(d.filter((_, i) => i % 16 === 0));
  });
}

const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;

const DEFAULTS = {
  sharp: null,
  minPixelSize: 2,
  minContribution: 3,
  antiAlias: false,
};

const DEFAULT = { cull: null, dpr: null, adapt: "drag", aa: false };

test("picking the levers: the default, then labs switches (the URL first, then the recipe)", async ({
  page,
}) => {
  await page.goto(APP);
  const r = await page.evaluate(async () => {
    const { pickSharpness } = await import("/src/sharpness.js");
    const P = (q) => new URLSearchParams(q);
    return {
      off: pickSharpness({ labs: false, params: P("sharp=1&cull=off&dpr=3"), recipe: { dpr: 3 } }),
      none: pickSharpness({ labs: true, params: P("") }),
      unknown: pickSharpness({ labs: true, params: P("cull=blur&dpr=x&adapt=off&aa=0") }),
      cullLow: pickSharpness({ labs: true, params: P("cull=low") }),
      cullOff: pickSharpness({ labs: true, params: P("cull=off") }),
      cullPx: pickSharpness({ labs: true, params: P("cull=0.5") }),
      dpr: pickSharpness({ labs: true, params: P("dpr=5") }),
      native: pickSharpness({ labs: true, params: P("dpr=native"), native: 3 }),
      adapt: pickSharpness({ labs: true, params: P("adapt=drag") }),
      aa: pickSharpness({ labs: true, params: P("aa=1") }),
      preset: pickSharpness({ labs: true, params: P("sharp=1"), native: 2.625 }),
      presetOverride: pickSharpness({ labs: true, params: P("sharp=1&cull=off&dpr=2") }),
      recipe: pickSharpness({ labs: true, params: P(""), recipe: { cull: "low", aa: true } }),
      urlWins: pickSharpness({ labs: true, params: P("cull=off"), recipe: { cull: "low" } }),
      adaptOff: pickSharpness({ labs: true, params: P("adapt=off&cull=low") }),
      sharpOff: pickSharpness({ labs: true, params: P("sharp=0&cull=off&aa=1") }),
      sharpOffPublic: pickSharpness({ labs: false, params: P("sharp=0") }),
    };
  });
  expect(r).toEqual({
    off: DEFAULT,
    none: DEFAULT,
    unknown: null,
    cullLow: { cull: { minPixelSize: 1, minContribution: 1.5 }, dpr: null, adapt: "drag", aa: false }, // prettier-ignore
    cullOff: { cull: { minPixelSize: 0, minContribution: 0 }, dpr: null, adapt: "drag", aa: false },
    cullPx: {
      cull: { minPixelSize: 0.5, minContribution: 0.75 },
      dpr: null,
      adapt: "drag",
      aa: false,
    },
    dpr: { cull: null, dpr: 3, adapt: "drag", aa: false },
    native: { cull: null, dpr: 3, adapt: "drag", aa: false },
    adapt: { cull: null, dpr: null, adapt: "drag", aa: false },
    aa: { cull: null, dpr: null, adapt: "drag", aa: true },
    preset: {
      cull: { minPixelSize: 1, minContribution: 1.5 },
      dpr: 2.625,
      adapt: "drag",
      aa: false,
    },
    presetOverride: {
      cull: { minPixelSize: 0, minContribution: 0 },
      dpr: 2,
      adapt: "drag",
      aa: false,
    },
    recipe: { cull: { minPixelSize: 1, minContribution: 1.5 }, dpr: null, adapt: "drag", aa: true }, // prettier-ignore
    urlWins: { cull: { minPixelSize: 0, minContribution: 0 }, dpr: null, adapt: "drag", aa: false },
    adaptOff: {
      cull: { minPixelSize: 1, minContribution: 1.5 },
      dpr: null,
      adapt: null,
      aa: false,
    },
    sharpOff: null,
    sharpOffPublic: null,
  });
});

test("with ?sharp=0 the renderer is exactly as before, labs on or off", async ({ browser }) => {
  const shots = {};
  for (const q of ["&labs=0&sharp=0", "&labs=1&sharp=0"]) {
    const page = await browser.newPage({ deviceScaleFactor: 3 });
    const errors = await open(page, q);
    // The old cap: 2 on the mid tier.
    expect(await state(page)).toMatchObject({ ...DEFAULTS, ratio: 2 });
    // The lever code never ran (it saves the engine's anti-aliasing first).
    expect(await page.evaluate(() => window.__splashery.player.stage.aaDefault)).toBeUndefined();
    shots[q] = await pixels(page);
    expect(errors).toEqual([]);
    await page.close();
  }
  // Two page loads never draw bit for bit alike (the sort settles on its own
  // timing), so the same small tolerance as lane Lab's kernel test.
  expect(diff(shots["&labs=0&sharp=0"], shots["&labs=1&sharp=0"])).toBeLessThan(0.5);
});

test("without labs only the default applies: the cap of 3 and adapt drag", async ({ browser }) => {
  const page = await browser.newPage({ deviceScaleFactor: 3 });
  const errors = await open(page, "&labs=0&sharp=1&cull=off&dpr=2&aa=1");
  expect(await state(page)).toMatchObject({
    ...DEFAULTS,
    sharp: { cull: null, dpr: null, adapt: "drag", aa: false },
    ratio: 3,
  });
  expect(errors).toEqual([]);
});

test("?cull= lowers the cull, and a toy without it puts the defaults back", async ({ page }) => {
  const errors = await open(page, "&labs=1&adapt=off&cull=off", "sailboat");
  expect(await state(page)).toMatchObject({ minPixelSize: 0, minContribution: 0 });
  // A picture toy's own lower cull: the lower of the two wins.
  const both = await page.evaluate(() => {
    const s = window.__splashery.player.stage;
    s.setPictureCulling(true);
    const g = s.app.scene.gsplat;
    const v = [g.minPixelSize, g.minContribution];
    s.setPictureCulling(false);
    return v;
  });
  expect(both).toEqual([0, 0]);
  await page.evaluate(async () => {
    const url = new URL(location.href);
    url.searchParams.delete("cull");
    history.replaceState(null, "", url);
    await window.__splashery.app.chooseToy("sailboat");
  });
  expect(await state(page)).toMatchObject(DEFAULTS);
  expect(errors).toEqual([]);
});

test("?cull=low draws the far, small splats the default cull drops", async ({ page }) => {
  // Seen from far away, most of a toy's splats are under 2 pixels.
  const far = async (q) => {
    await page.evaluate(async (q) => {
      const url = new URL(location.href);
      url.search = q;
      history.replaceState(null, "", url);
      await window.__splashery.app.chooseToy("sailboat");
      const cam = window.__splashery.player.camera;
      cam.home = { ...cam.home, distance: cam.home.distance * 6 };
    }, q);
    return pixels(page);
  };
  const errors = await open(page, "&labs=1&adapt=off", "sailboat");
  const plain = await far("?renderer=webgl2&profile=mid&labs=1&adapt=off");
  const low = await far("?renderer=webgl2&profile=mid&labs=1&adapt=off&cull=off");
  const ink = (px) => px.filter((v, i) => i % 4 !== 3 && v < 250).length;
  expect(ink(low)).toBeGreaterThan(ink(plain));
  expect(errors).toEqual([]);
});

test("?dpr= sets the pixel-ratio cap, and the tier's cap comes back without it", async ({
  browser,
}) => {
  const page = await browser.newPage({ deviceScaleFactor: 3 });
  const errors = await open(page, "&labs=1&adapt=off&dpr=2");
  const before = await state(page);
  expect(before.ratio).toBe(2);
  await page.evaluate(async () => {
    const url = new URL(location.href);
    url.searchParams.set("dpr", "native");
    history.replaceState(null, "", url);
    await window.__splashery.app.chooseToy("penguin");
  });
  const after = await state(page);
  expect(after.ratio).toBe(3);
  expect(after.canvas[0]).toBeGreaterThan(before.canvas[0]);
  // Back to the mid tier's cap without it: 3 since the default.
  await page.evaluate(async () => {
    const url = new URL(location.href);
    url.searchParams.delete("dpr");
    history.replaceState(null, "", url);
    await window.__splashery.app.chooseToy("penguin");
  });
  expect((await state(page)).ratio).toBe(3);
  expect(errors).toEqual([]);
});

test("adapt drag (the default) drops the resolution only during a drag", async ({ browser }) => {
  test.setTimeout(480_000); // three page loads
  // Slow frames while the toy plays on its own: adapt drag keeps the ratio,
  // the old behavior (adapt off, or ?sharp=0) drops it; during a drag both
  // drop it.
  const run = async (q) => {
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    const errors = await open(page, q);
    const r = await page.evaluate(() => {
      const s = window.__splashery.player.stage;
      s.adaptive = true;
      const slow = (drag) => {
        s.reduced = false;
        s.settle();
        s.skipFrames = 0;
        for (let i = 0; i < 20; i++) {
          s.setBusy(true, drag);
          s.timeFrame(40);
        }
        const out = s.reduced;
        s.reduced = false;
        s.setBusy(false, false);
        return out;
      };
      return { playing: slow(false), dragging: slow(true) };
    });
    expect(errors).toEqual([]);
    await page.close();
    return r;
  };
  // The default (three page loads, like before, to stay inside the test's time).
  expect(await run("&labs=0")).toEqual({ playing: false, dragging: true });
  // Off: the old drop whenever anything moves.
  expect(await run("&labs=1&adapt=off")).toEqual({ playing: true, dragging: true });
  expect(await run("&labs=0&sharp=0")).toEqual({ playing: true, dragging: true });
});

test("?aa=1 turns on the engine's anti-aliased splats, and back", async ({ page }) => {
  const errors = await open(page, "&labs=1&adapt=off");
  const plain = await pixels(page);
  await page.evaluate(async () => {
    const url = new URL(location.href);
    url.searchParams.set("aa", "1");
    history.replaceState(null, "", url);
    await window.__splashery.app.chooseToy("penguin");
  });
  expect((await state(page)).antiAlias).toBe(true);
  const aa = await pixels(page);
  expect(diff(plain, aa)).toBeGreaterThan(0.05);
  await page.evaluate(async () => {
    const url = new URL(location.href);
    url.searchParams.delete("aa");
    history.replaceState(null, "", url);
    await window.__splashery.app.chooseToy("penguin");
  });
  expect(await state(page)).toMatchObject(DEFAULTS);
  expect(errors).toEqual([]);
});
