// Lane Hands-on H2, the Food shelf (docs/handoff/HandsH2.md): with the ✋
// switch on, each piece measured as it moves: layers lifted and stacked, a
// pancake flipped (and flipped back), scoops spilled off a tipped cone,
// kiwi halves pulled apart and put back (one face down first), kernels
// spilled from a tipped bucket, a candle pulled out (it goes out) and put
// back after lying on its side, a banana broken off with its skin, the
// coffee stirred, and the pretzel stretched. With the switch off nothing
// changes (the splats are the same as before; see the PR).

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

// A finger drag through recipe points; `flick` ends it with a quick move
// up to that point, fed straight to Hands-on (the browser sends a page its
// moves once a frame, and SwiftShader's frames are slow).
async function drag(page, points, { steps = 12, hold = false, flick = null } = {}) {
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
  if (flick) {
    await page.evaluate(
      ([a, b]) => {
        const { player } = window.__splashery;
        for (let i = 1; i <= 6; i++) {
          const p = a.map((v, k) => v + ((b[k] - v) * i) / 6);
          player.handsOn.moveTo(...player.screenPoint(p));
          player.update(1 / 60);
        }
      },
      [points[points.length - 1], flick],
    );
    await page.mouse.move(...(await screen(page, [flick]))[0]);
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

test("burger: the top bun lifts off and goes back on the stack, set level on top", async ({
  page,
}) => {
  await ready(page, "burger");
  await drag(page, [
    [0, 1.0, 0.3],
    [0.9, 1.9, 0.3],
    [0, 1.9, 0.3],
    [0, 1.5, 0.3],
  ]);
  await tick(page, 2);
  const all = await pieces(page);
  const top = all.find((p) => p.name === "top");
  expect(Math.abs(top.pos[1] - top.home[1])).toBeLessThan(0.06); // back on the stack
  expect(Math.hypot(top.pos[0] - top.home[0], top.pos[2] - top.home[2])).toBeLessThan(0.25);
  expect(top.up).toBeGreaterThan(0.95); // level
  for (const p of all.filter((p) => p.name !== "top")) expect(away(p)).toBeLessThan(0.05);
  await reset(page);
});

test("pancakes: the top one flicked up flips over onto the stack, and flipped again lands face up", async ({
  page,
}) => {
  await ready(page, "pancakes");
  const flip = async () => {
    const top = (await pieces(page)).find((p) => p.name === "top");
    // (Pressed on its front, toward the rim.)
    const at = [top.pos[0], top.pos[1] + 0.07, top.pos[2] + 0.5];
    await drag(page, [at, [at[0], at[1] + 0.2, at[2]]], { flick: [at[0], at[1] + 1.2, at[2]] }); // prettier-ignore
    await tick(page, 2.5);
    return (await pieces(page)).find((p) => p.name === "top");
  };
  let top = await flip();

  expect(top.up).toBeLessThan(-0.9); // upside down
  expect(top.pos[1]).toBeGreaterThan(0.5); // back on the stack (the next one's top is 0.58)
  expect(Math.hypot(top.pos[0], top.pos[2])).toBeLessThan(0.35);
  top = await flip(); // the same flick works on its other side
  expect(top.up).toBeGreaterThan(0.9);
  await reset(page);
});

test("ice cream: the top scoop lifts off; the cone tipped spills the scoops", async ({ page }) => {
  await ready(page, "ice-cream");
  const top = (await pieces(page)).find((p) => p.name === "scoop1");
  await drag(page, [
    [top.home[0], top.home[1] + 0.1, top.home[2] + 0.3],
    [0.8, 2.6, 0.3],
    [1.0, 1.0, 0.8],
    [1.0, 0.2, 0.8],
  ]);
  await tick(page, 1.5);
  let js = await joints(page);
  expect(js.find((j) => j.name === "scoop1").broken).toBe(true);
  expect(js.find((j) => j.name === "scoop0").broken).toBe(false);
  await reset(page);
  // The cone, held near its middle and swung over: both scoops spill.
  await drag(
    page,
    [
      [0, 0.7, 0.27],
      [0, 1.1, 0.27],
      [-0.6, 1.2, 0.27],
      [-1.0, 1.2, 0.27],
    ],
    { steps: 8 },
  );
  await tick(page, 2.5);
  js = await joints(page);
  expect(js.every((j) => j.broken)).toBe(true);
  const all = await pieces(page);
  for (const p of all.filter((p) => p.name.startsWith("scoop"))) expect(p.pos[1]).toBeLessThan(0.6); // on the table
  await reset(page);
  js = await joints(page);
  expect(js.every((j) => !j.broken)).toBe(true);
});

test("kiwi: a half pulled out shows its face; put back face down first, it still clicks home", async ({
  page,
}) => {
  await ready(page, "kiwi");
  const half = (await pieces(page))[0];
  const h = half.home;
  await drag(page, [
    [h[0], h[1] + 0.1, h[2]],
    [-0.9, 0.5, 0.1],
    [-1.0, 0.3, 0.6],
    [-1.0, -0.3, 0.6],
  ]);
  await tick(page, 2);
  let p = (await pieces(page))[0];
  expect(away(p)).toBeGreaterThan(0.5);
  const face = await page.evaluate(() => {
    const { player } = window.__splashery;
    const d = player.motion.ctx?.kit?.data || player.proc?.ctx?.kit?.data;
    return d.halves.map((hv) => hv.face);
  });
  expect(face.length).toBe(2);
  // The half left behind shows its face too (the drive reads hands.moved).
  const moved = await page.evaluate(() => window.__splashery.player.handsOn.moved);
  expect(moved).toBe(true);
  // Turned face down, then brought back over its place: it glides home.
  await page.evaluate(() => {
    const b = window.__splashery.player.handsOn.pieces[0].body;
    b.q = [1, 0, 0, 0]; // upside down
    window.__splashery.player.handsOn.world.wake();
  });
  await tick(page, 1);
  p = (await pieces(page))[0];
  await drag(page, [p.pos, [-0.9, 0.5, 0.1], [h[0], h[1] + 0.25, h[2]], [h[0], h[1] + 0.05, h[2]]]);
  await tick(page, 1.5);
  p = (await pieces(page))[0];
  expect(away(p)).toBeLessThan(1e-3);
  expect(p.pinned).toBe(true);
});

test("popcorn: the bucket tipped on its edge spills the loose kernels onto the table", async ({
  page,
}) => {
  await ready(page, "popcorn");
  await drag(
    page,
    [
      [0.5, 1.0, 0.3],
      [0.2, 1.3, 0.3],
      [-0.5, 1.1, 0.3],
      [-0.9, 0.6, 0.3],
    ],
    { steps: 8 },
  );
  await tick(page, 3);
  const js = await joints(page);
  const bucket = js.find((j) => j.type === "hinge");
  expect(bucket.v).toBeGreaterThan(1.3); // on its side
  expect(js.filter((j) => j.type === "break" && j.broken).length).toBeGreaterThan(9);
  const kernels = (await pieces(page)).filter((p) => String(p.name).startsWith("k"));
  const down = kernels.filter((p) => p.pos[1] < 0.3).length;
  expect(down).toBeGreaterThan(5); // fallen to the table
  await reset(page);
  expect((await joints(page)).find((j) => j.type === "hinge").v).toBeCloseTo(0, 5);
});

test("birthday cake: a candle pulled out goes out and lies down; pushed back, it is alight again", async ({
  page,
}) => {
  await ready(page, "birthday-cake");
  const c0 = (await pieces(page))[0];
  const h = c0.home;
  await drag(page, [
    [h[0], h[1] + 0.03, h[2]],
    [0.6, 1.3, 0.7],
    [1.0, 0.5, 0.9],
    [1.0, -0.3, 0.9],
  ]);
  await tick(page, 2);
  let p = (await pieces(page))[0];
  expect(away(p)).toBeGreaterThan(0.5);
  let parts = await page.evaluate(() => window.__splashery.player.motion.handsParts);
  expect(parts.flame0.visible).toBe(0); // out
  const tok = await page.evaluate(() =>
    window.__splashery.player.motion.handsTokens.find((t) => t.index === 0),
  );
  expect(tok.token.offset[1]).toBeLessThan(-0.5); // the candle went with it
  // Lying on its side, then pushed back into its hole: it clicks home.
  await page.evaluate(() => {
    const b = window.__splashery.player.handsOn.pieces[0].body;
    b.q = [0, 0, Math.SQRT1_2, Math.SQRT1_2]; // on its side
    window.__splashery.player.handsOn.world.wake();
  });
  await tick(page, 1);
  p = (await pieces(page))[0];
  await drag(page, [p.pos, [0.6, 1.4, 0.7], [h[0], h[1] + 0.25, h[2]], [h[0], h[1] + 0.05, h[2]]]);
  await tick(page, 1.5);
  p = (await pieces(page))[0];
  expect(away(p)).toBeLessThan(1e-3);
  parts = await page.evaluate(() => window.__splashery.player.motion.handsParts);
  expect(parts?.flame0?.visible ?? 1).not.toBe(0); // alight again
});

test("bananas: one pulled bends at its neck, then breaks off whole with its skin", async ({
  page,
}) => {
  await ready(page, "banana");
  await drag(
    page,
    [
      [0.2, 0.2, 0.3],
      [0.4, 0.6, 0.9],
      [0.9, 0.4, 1.0],
      [0.9, -0.1, 1.0],
    ],
    { steps: 15 },
  );
  await tick(page, 2);
  const js = await joints(page);
  expect(js.filter((j) => j.broken).length).toBe(1);
  const toks = await page.evaluate(() => window.__splashery.player.motion.handsTokens);
  // Its body and its six skin strips move together; its pale insides stay hidden.
  const moved = toks.filter((t) => t.token.visible !== 0);
  const hidden = toks.filter((t) => t.token.visible === 0);
  expect(moved.length).toBe(7);
  expect(hidden.length).toBe(7);
  for (const t of moved) expect(t.token.offset).toEqual(moved[0].token.offset);
  await reset(page);
});

test("coffee: a finger drawn round in the cup turns the coffee after it", async ({ page }) => {
  await ready(page, "coffee");
  const circle = [];
  for (let i = 0; i <= 18; i++) {
    const a = i * 0.35;
    circle.push([0.3 * Math.sin(a), 0.58, 0.3 * Math.cos(a)]);
  }
  await drag(page, circle, { steps: 3 });
  await tick(page, 0.2);
  const turn = await page.evaluate(
    () =>
    Array.from({ length: 12 }, (_, i) => window.__splashery.player.motion.out?.parts?.[`coffee${i}`]?.angle ?? null), // prettier-ignore
  );
  // The rings near the finger (about halfway out) have turned the most.
  expect(Math.abs(turn[6])).toBeGreaterThan(0.5);
  expect(Math.abs(turn[6])).toBeGreaterThan(Math.abs(turn[11]));
});

test("pretzel: pulled by one side it stretches, and springs back", async ({ page }) => {
  await ready(page, "pretzel");
  const pull = () =>
    page.evaluate(() => Math.hypot(...(window.__splashery.player.handsOn.softParts?.stretch?.pull || [0, 0, 0]))); // prettier-ignore
  await drag(
    page,
    [
      [0.85, 0, 0.1],
      [1.25, 0.1, 0.2],
    ],
    { hold: true },
  );
  await tick(page, 0.2);
  expect(await pull()).toBeGreaterThan(0.1);
  await page.mouse.up();
  await tick(page, 2.5);
  expect(await pull()).toBeLessThan(0.02);
});
