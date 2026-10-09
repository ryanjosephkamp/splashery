// Lane Hands-on H2, the Nature shelf (docs/handoff/HandsH2.md): with the ✋
// switch on, each piece measured: a shaken tree fires its fall, a coconut
// snaps off and lands on the sand, the sunflower's head nods and springs
// back, a rose petal and a pinecone scale come off and land, an acorn cap
// goes back on, the lotus bobs back up, and the willow sways back.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

// Phone size, where the owner plays (and the clips are made).
test.use({ viewport: { width: 390, height: 844 } });

async function ready(page, id) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(async (id) => {
    const { app, player } = window.__splashery;
    await app.chooseToy(id);
    player.opts.idleDelay = 1e9;
    if (player.camera) {
      player.camera.turntable = false;
      player.camera.idleDelay = 1e9;
    }
  }, id);
  await page.waitForTimeout(800);
  if (!(await page.evaluate(() => window.__splashery.player.handsOn.on)))
    await page.click("#hands-toggle");
  await page.evaluate(() => window.__splashery.player.handsOn.ensure());
}

const tick = (page, secs) =>
  page.evaluate(
    (n) => {
      const { player } = window.__splashery;
      for (let i = 0; i < n; i++) player.update(1 / 60);
    },
    Math.round(secs * 60),
  );

const screen = (page, pts) =>
  page.evaluate((pts) => {
    const { player } = window.__splashery;
    const r = player.stage.canvas.getBoundingClientRect();
    return pts.map((p) => {
      const s = player.screenPoint(p);
      return [r.left + s[0], r.top + s[1]];
    });
  }, pts);

// A lift and a flick, both fed straight to Hands-on after a real press (the
// browser hands a page its moves once a frame, and SwiftShader's frames are
// slow and uneven under load, so real moves would arrive in bunches): along
// the points, a 30th of a second a step, then a quick move up to `flick`.
async function flickDrag(page, points, flick, steps = 12) {
  const px = await screen(page, points);
  await page.mouse.move(...px[0]);
  await page.mouse.down();
  // (The press's pick is async: wait for Hands-on to have it.)
  await page.waitForFunction(() => !!window.__splashery.player.handsOn.press, null, { timeout: 5000 }); // prettier-ignore
  await page.evaluate(
    ([pts, flick, steps]) => {
      const { player } = window.__splashery;
      const go = (a, b, n, dt) => {
        for (let i = 1; i <= n; i++) {
          const p = a.map((v, k) => v + ((b[k] - v) * i) / n);
          player.handsOn.moveTo(...player.screenPoint(p));
          player.update(dt);
        }
      };
      for (let k = 1; k < pts.length; k++) go(pts[k - 1], pts[k], steps, 1 / 30);
      go(pts[pts.length - 1], flick, 6, 1 / 60);
    },
    [points, flick, steps],
  );
  await page.mouse.move(...(await screen(page, [flick]))[0]);
  await page.mouse.up();
}

// A finger drag through recipe points (`hold`: the finger stays down).
async function drag(page, points, { steps = 12, hold = false } = {}) {
  const px = await screen(page, points);
  await page.mouse.move(...px[0]);
  await page.mouse.down();
  for (let k = 1; k < px.length; k++)
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const [a, b] = [px[k - 1], px[k]];
      await page.mouse.move(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
      await tick(page, 1 / 30);
    }
  if (!hold) await page.mouse.up();
}

// Each piece: where it is, its up (y of its turned up axis), and home.
const pieces = (page) =>
  page.evaluate(() =>
    window.__splashery.player.handsOn.pieces.map((pc) => {
      const b = pc.body;
      const [x, , z] = b.q;
      return {
        name: pc.part ?? pc.token,
        pos: b.pos,
        home: pc.home.pos,
        up: 1 - 2 * (x * x + z * z),
        pinned: !!b.pinned,
        moving: Math.hypot(...b.vel),
      };
    }),
  );
const joints = (page) => page.evaluate(() => window.__splashery.player.handsOn.joints.state());
const away = (p) => Math.hypot(...p.pos.map((v, i) => v - p.home[i]));

async function reset(page) {
  await page.click("#hands-reset");
  await tick(page, 1);
  const all = await pieces(page);
  for (const p of all) expect(away(p)).toBeLessThan(1e-6);
}

// A shake: back and forth across a point, fed straight to Hands-on after a
// real press, a 30th of a second a move.
async function shake(page, at, width = 0.3, strokes = 5) {
  const px = await screen(page, [at]);
  await page.mouse.move(...px[0]);
  await page.mouse.down();
  await page.waitForFunction(() => !!window.__splashery.player.handsOn.press, null, { timeout: 5000 }); // prettier-ignore
  await page.evaluate(
    ([at, w, n]) => {
      const { player } = window.__splashery;
      for (let k = 0; k < n; k++)
        for (const f of [0.33, 0.66, 1, 0.66, 0.33, 0, -0.33, -0.66, -1, -0.66, -0.33, 0]) {
          player.handsOn.moveTo(...player.screenPoint([at[0] + f * w, at[1], at[2]]));
          player.update(1 / 30);
        }
    },
    [at, width, strokes],
  );
  await page.mouse.up();
}

test("oak and maple: a shake on the trunk drops the leaves", async ({ page }) => {
  for (const [id, key] of [
    ["oak", "shake"],
    ["maple", "gust"],
  ]) {
    await ready(page, id);
    expect(await page.evaluate((k) => window.__splashery.player.motion.state[k] ?? 0, key)).toBe(0);
    await shake(page, [0, 0.4, 0.1]);
    expect(await page.evaluate((k) => window.__splashery.player.motion.state[k], key)).toBeGreaterThan(0.5); // prettier-ignore
  }
});

test("palm: a coconut snaps off, drops and comes to rest on the sand", async ({ page }) => {
  await ready(page, "palm");
  const c = (await pieces(page))[0];
  await drag(page, [c.home, [-0.2, 1.6, 0.6], [0.4, 1.2, 0.8]], { steps: 10 });
  await tick(page, 4);
  const js = await joints(page);
  expect(js[0].broken).toBe(true);
  const p = (await pieces(page))[0];
  expect(p.pos[1]).toBeGreaterThan(0.1); // on the sand (0.05 + its radius 0.09)
  expect(p.pos[1]).toBeLessThan(0.2);
  expect(p.moving).toBeLessThan(0.1); // (still rolling a little on the sand at most)
  for (const o of (await pieces(page)).slice(1)) expect(away(o)).toBeLessThan(1e-6);
  await reset(page);
});

test("sunflower: the head pushed over nods on its stem and springs back", async ({ page }) => {
  await ready(page, "sunflower");
  await drag(page, [[0.1, 1.3, 0.1], [0.5, 1.2, 0.4], [0.7, 1.0, 0.5]], { hold: true }); // prettier-ignore
  await tick(page, 0.2);
  let [h] = await joints(page);
  expect(Math.abs(h.v)).toBeGreaterThan(0.3);
  // The petals ride the head.
  const toks = await page.evaluate(() => window.__splashery.player.motion.handsTokens?.length ?? 0);
  expect(toks).toBe(48);
  await page.mouse.up();
  await tick(page, 3);
  [h] = await joints(page);
  expect(Math.abs(h.v)).toBeLessThan(0.02);
});

test("rose and pinecone: a petal and a scale come off and land on the ground", async ({ page }) => {
  await ready(page, "rose");
  await drag(page, [[0.0, 1.08, 0.2], [0.3, 1.3, 0.45], [0.6, 1.2, 0.6]], { steps: 10 }); // prettier-ignore
  await tick(page, 3);
  let off = (await pieces(page)).filter((p) => !p.pinned);
  expect(off.length).toBe(1);
  expect(off[0].pos[1]).toBeLessThan(0.1); // on the ground (0.03)
  await reset(page);
  await ready(page, "pinecone");
  await drag(page, [[0.06, -0.55, 0.2], [0.4, -0.4, 0.5], [0.7, -0.5, 0.6]], { steps: 10 }); // prettier-ignore
  await tick(page, 2);
  off = (await pieces(page)).filter((p) => !p.pinned);
  expect(off.length).toBe(1);
  expect(off[0].pos[1]).toBeLessThan(-0.6);
  await reset(page);
});

test("acorn: a cap pulled off goes back on its acorn", async ({ page }) => {
  await ready(page, "acorn");
  await drag(page, [[-0.339, 0.2, 0.2], [-0.7, 0.5, 0.5], [-0.75, 0.0, 0.7]]); // prettier-ignore
  await tick(page, 1.5);
  let p = (await pieces(page))[0];
  expect(away(p)).toBeGreaterThan(0.4);
  // (Pressed on its side toward the middle: the toy fills the phone's width.)
  await drag(page, [
    [p.pos[0] + 0.25, p.pos[1] + 0.1, p.pos[2]],
    [-0.7, 0.6, 0.6],
    [-0.34, 0.45, 0.2],
    [-0.34, 0.2, 0.2],
  ]);
  await tick(page, 1.5);
  p = (await pieces(page))[0];
  expect(away(p)).toBeLessThan(1e-3);
  expect(p.pinned).toBe(true);
});

test("lotus: lifted alone (the pond stays), dropped in, it splashes, dips under and bobs back", async ({
  page,
}) => {
  await ready(page, "lotus");
  const y = () => page.evaluate(() => window.__splashery.player.handsOn.state().bodies[0].pos[1]);
  const y0 = await y();
  // The flower is a piece of its own: the pond and its pads stay put.
  expect(await page.evaluate(() => window.__splashery.player.handsOn.mode)).toBe("pieces");
  // (Watch the drive's splash part: the most it shows.)
  await page.evaluate(() => {
    const r = window.__splashery.player.motion.recipe;
    const drive = r.drive;
    window.__splash = 0;
    window.__unwatch = () => (r.drive = drive);
    r.drive = function (t, c, out, info) {
      drive.call(this, t, c, out, info);
      window.__splash = Math.max(window.__splash, out.parts.splash?.visible ?? 0);
    };
  });
  await drag(
    page,
    [
      [0, 0.3, 0.1],
      [0, 1.2, 0.1],
    ],
    { hold: true },
  );
  await tick(page, 0.5);
  expect(await y()).toBeGreaterThan(y0 + 0.2);
  await page.mouse.up();
  let low = Infinity;
  for (let i = 0; i < 30; i++) {
    await tick(page, 0.05);
    low = Math.min(low, await y());
  }
  const splash = await page.evaluate(() => (window.__unwatch(), window.__splash));
  expect(low).toBeLessThan(y0 - 0.02); // it dips under
  expect(splash).toBeGreaterThan(0.5); // and the crown of drops splashes up
  await tick(page, 5);
  expect(Math.abs((await y()) - y0)).toBeLessThan(0.05); // and floats where it was
});

test("willow: the hanging branches swing after the finger and sway back", async ({ page }) => {
  await ready(page, "willow");
  const pull = () =>
    page.evaluate(() => Math.hypot(...(window.__splashery.player.handsOn.softParts?.stretch?.pull || [0, 0, 0]))); // prettier-ignore
  await drag(page, [[0.6, 0.6, 0.6], [1.0, 0.7, 0.7]], { hold: true }); // prettier-ignore
  await tick(page, 0.2);
  expect(await pull()).toBeGreaterThan(0.1);
  await page.mouse.up();
  await tick(page, 6);
  expect(await pull()).toBeLessThan(0.03);
});
