const APP = "/?renderer=webgl2&adapt=off&profile=mid";

const FIX = "/tests/fixtures/pic/";

const ORIGIN = `http://127.0.0.1:${Number(process.env.SPLASHERY_PORT) || 4173}`;

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

const BK = `${ORIGIN}/tests/fixtures/bk/`;

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
  await waitSheets(page);
}

const tap = (page) => page.evaluate(() => window.__splashery.player.act());

async function turn(page) {
  const before = await page.evaluate(() => window.__splashery.player.pictures.page);
  await tap(page);
  const landed = () =>
    page.waitForFunction(
      (b) => {
        const pl = window.__splashery.player;
        pl.stage.requestRender();
        const cover = pl.motion.out.parts?.cover?.angle ?? 0;
        if (cover > 1e-6 && cover < Math.PI - 1e-6) return false;
        const flat = (pl.motion.out.leaves || []).every((l) => !l || (!l.curl && (Math.abs(l.angle) < 1e-6 || Math.abs(l.angle - Math.PI) < 1e-6 || Math.abs(l.angle - 2 * Math.PI + 0.06) < 1e-6))); // prettier-ignore
        return flat;
      },
      before,
      { timeout: 180_000, polling: 100 },
    );
  // First the turn starts (a leaf curls, or the page changes)...
  await page.waitForFunction(
    (b) => {
      const pl = window.__splashery.player;
      pl.stage.requestRender();
      const out = pl.motion.out;
      const cover = out.parts?.cover?.angle ?? 0;
      return pl.pictures.page !== b || (out.leaves || []).some((l) => l && l.curl) || (cover > 1e-3 && cover < Math.PI - 1e-3); // prettier-ignore
    },
    before,
    { timeout: 180_000, polling: 50 },
  );
  // ...then it lands.
  await landed();
  await step(page, 0.25);
  await landed();
  await step(page, 0.3);
}

async function pointAt(page, p) {
  return page.evaluate((p) => {
    const pl = window.__splashery.player;
    const [x, y] = pl.screenPoint(p);
    const r = pl.stage.canvas.getBoundingClientRect();
    return [r.left + x, r.top + y];
  }, p);
}

async function pullBy(page, from, to, steps) {
  const [x0, y0] = await pointAt(page, from);
  const [x1, y1] = await pointAt(page, to);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
}

const pageNow = (page) => page.evaluate(() => window.__splashery.player.pictures.page);

async function landed(page) {
  await page.waitForFunction(
    () => {
      const pl = window.__splashery.player;
      pl.stage.requestRender();
      const L = pl.motion.out?.leaves || [];
      return L.every((l) => !l || l.curl === 0);
    },
    null,
    { timeout: 120_000, polling: 200 },
  );
  await step(page, 0.5);
}

async function glided(page, key) {
  await page.waitForFunction(
    (key) => {
      const pl = window.__splashery.player;
      pl.stage.requestRender();
      return pl.pageView?.key === key && !pl.glide;
    },
    key,
    { timeout: 120_000, polling: 100 },
  );
  await step(page, 0.3);
}

const pageBox = (page, x0, x1) =>
  page.evaluate(
    ([x0, x1]) => {
      const pl = window.__splashery.player;
      const r = pl.stage.canvas.getBoundingClientRect();
      const a = pl.screenPoint([x0, -0.5, 0.02]);
      const b = pl.screenPoint([x1, 0.5, 0.02]);
      return { w: Math.abs(b[0] - a[0]) / r.width, h: Math.abs(b[1] - a[1]) / r.height, cx: (a[0] + b[0]) / 2 / r.width, cy: (a[1] + b[1]) / 2 / r.height }; // prettier-ignore
    },
    [x0, x1],
  );

export {
  APP,
  FIX,
  ORIGIN,
  ready,
  waitSheets,
  BK,
  open,
  step,
  tap,
  turn,
  pointAt,
  pullBy,
  pageNow,
  landed,
  glided,
  pageBox,
};
