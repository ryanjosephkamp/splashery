// Lane Imaging (engine): the `volume` kit kind, with a cutting plane and a
// density window (src/effects.js, KINDS.volume; out.volume in src/motion.js).
// A volume splat shows only while its density is inside the window and its
// rest place is on the near side of the cutting plane.

import { test, expect } from "@playwright/test";

// The kit shader as it was before the volume kind: the same file with its
// two volume blocks (GLSL and WGSL) taken out.
const withoutVolume = (src) => {
  const out = src.replace(/\n {2}if \(kind == 26\) \{\n[\s\S]*?\n {2}\}\n/g, "\n");
  if (out === src || /kind == 26/.test(out)) throw new Error("The volume blocks were not found.");
  return out;
};

// Renders the current toy at its home view with the clock stopped, and
// returns its pixels.
async function still(page, size = [390, 844]) {
  return page.evaluate(async (size) => {
    const { player } = window.__splashery;
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
    const stage = player.stage;
    const handlers = stage.updateHandlers.slice();
    let pending = 0;
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(() => {
      const d = pending;
      pending = 0;
      for (const h of handlers) h(d);
    });
    stage.setFixedSize(size);
    player.camera.cur = { ...player.camera.home };
    player.camera.tgt = { ...player.camera.home };
    await stage.captureFrame();
    const c = await stage.captureFrame();
    const px = Array.from(c.getContext("2d").getImageData(0, 0, c.width, c.height).data);
    stage.setFixedSize(null);
    stage.updateHandlers.length = 0;
    stage.updateHandlers.push(...handlers);
    return { w: c.width, h: c.height, px };
  }, size);
}

async function open(browser, renderer, { before = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (before)
    await page.route("**/src/effects.js", async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, body: withoutVolume(await res.text()) });
    });
  await page.goto(`/?renderer=${renderer}&profile=mid&adapt=off`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const dev = await page.evaluate(() => window.__splashery.player.stage?.deviceType);
  return { ctx, page, errors, dev };
}

async function show(page, id, bg) {
  await page.evaluate(
    async ({ id, bg }) => {
      const { app, player } = window.__splashery;
      player.scene.seed = 12345;
      app.setLook({ background: bg });
      await app.chooseToy(id);
    },
    { id, bg },
  );
  await page.waitForTimeout(1500);
}

// How many pixels are brighter than the background, and how many are red.
function measure({ px }) {
  let [n, red] = [0, 0];
  for (let i = 0; i < px.length; i += 8) {
    if (px[i] + px[i + 1] + px[i + 2] > 120) n++;
    if (px[i] > 150 && px[i + 1] < 90) red++;
  }
  return { n, red };
}

for (const renderer of ["webgl2", "webgpu"]) {
  test(`toys without the volume kind draw as before (${renderer})`, async ({ browser }) => {
    const ids = ["beach-ball", "bouncy-ball", "gift-box"];
    const shots = [];
    for (const before of [true, false, false]) {
      const { ctx, page, errors, dev } = await open(browser, renderer, { before });
      if (renderer === "webgpu" && dev !== "webgpu") {
        await ctx.close();
        test.skip(true, "No WebGPU adapter in this browser.");
      }
      const run = {};
      for (const id of ids) {
        await show(page, id, "#111111");
        run[id] = await still(page);
      }
      shots.push(run);
      expect(errors).toEqual([]);
      await ctx.close();
    }
    const compare = (a, b) => {
      let [sum, big, drawn] = [0, 0, 0];
      for (let i = 0; i < a.px.length; i += 4) {
        const d = Math.max(...[0, 1, 2].map((k) => Math.abs(a.px[i + k] - b.px[i + k])));
        sum += d;
        if (d > 24) big++;
        if (a.px[i] > 40 || a.px[i + 1] > 40 || a.px[i + 2] > 40) drawn++;
      }
      return { mean: sum / (a.px.length / 4), big, drawn };
    };
    for (const id of ids) {
      const change = compare(shots[0][id], shots[1][id]);
      const noise = compare(shots[1][id], shots[2][id]);
      expect(change.drawn, `${id} drew something`).toBeGreaterThan(2000);
      expect(change.mean, `${id}: mean change`).toBeLessThanOrEqual(Math.max(2 * noise.mean, 0.5) + 0.05); // prettier-ignore
      expect(change.big, `${id}: pixels that changed a lot`).toBeLessThanOrEqual(Math.max(2 * noise.big, 200) + 20); // prettier-ignore
    }
  });

  test(`a volume is cut by its plane and shown by its density window (${renderer})`, async ({
    browser,
  }) => {
    const { ctx, page, errors, dev } = await open(browser, renderer);
    if (renderer === "webgpu" && dev !== "webgpu") {
      await ctx.close();
      test.skip(true, "No WebGPU adapter in this browser.");
    }
    // A test toy, added to the shelf and a pack for this page only: a solid
    // cube of volume splats, densities rising from left (0) to right (1),
    // with its cut and window set from window.__imgVolume.
    await page.evaluate(async () => {
      const { TOYS } = await import("/src/toys.js");
      const { RECIPES } = await import("/src/packs/balls.js");
      TOYS.push({ id: "img-cube", label: "img-cube", category: "sports", kind: "kit", pack: "balls", tags: "" }); // prettier-ignore
      window.__imgVolume = null;
      RECIPES["img-cube"] = {
        turntable: false,
        drive(t, c, out) {
          if (window.__imgVolume) out.volume = window.__imgVolume;
        },
        build(k) {
          k.cloud({ share: 1, size: 1.4 }, (rand) => {
            const p = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
            return { p, color: "#e0e0e0", kind: "volume", params: [(p[0] + 1) / 2, 0] };
          });
        },
      };
    });
    const look = async (volume) => {
      await page.evaluate((v) => (window.__imgVolume = v), volume);
      await page.waitForTimeout(400);
      return measure(await still(page));
    };
    await show(page, "img-cube", "#111111");
    const whole = await look(null);
    // Cut away everything right of x = 0 (the normal points to the hidden side).
    const half = await look({ normal: [1, 0, 0], at: 0 });
    // Only densities above 0.75 (the right quarter of the cube).
    const dense = await look({ window: [0.75, 1] });
    // A thin horizontal slab across the middle.
    const slab = await look({ normal: [0, 1, 0], at: 0, slab: 0.2 });
    // The cut face glows red.
    const glow = await look({ normal: [1, 0, 0], at: 0, glow: [1, -0.6, -0.6], glowWidth: 0.1 });
    expect(whole.n).toBeGreaterThan(3000);
    expect(half.n).toBeLessThan(0.8 * whole.n);
    expect(half.n).toBeGreaterThan(0.3 * whole.n);
    expect(dense.n).toBeLessThan(0.6 * whole.n);
    expect(dense.n).toBeGreaterThan(0.05 * whole.n);
    expect(slab.n).toBeLessThan(0.5 * whole.n);
    expect(slab.n).toBeGreaterThan(0.05 * whole.n);
    expect(whole.red).toBeLessThan(20);
    expect(glow.red).toBeGreaterThan(200);
    // Back to whole once out.volume is gone.
    const again = await look(null);
    expect(Math.abs(again.n - whole.n)).toBeLessThan(0.05 * whole.n);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}
