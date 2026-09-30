// Lane Fix4 (engine): the `rim` kit kind, a view-dependent opacity for glass
// (src/effects.js, KINDS.rim). A splat's opacity follows how squarely it
// faces the eye, seen from its part's center: mix(z, 1, (1 - |f|)^w).

import { test, expect } from "@playwright/test";

// The kit shader as it was before the rim kind: the same file with its two
// rim blocks (GLSL and WGSL) taken out.
const withoutRim = (src) => {
  const out = src.replace(/\n {2}if \(kind == 23\) \{\n[\s\S]*?\n {2}\}\n/g, "\n");
  if (out === src || /kind == 23/.test(out)) throw new Error("The rim blocks were not found.");
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
      await route.fulfill({ response: res, body: withoutRim(await res.text()) });
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
      // The same scene seed on every page (the pattern layer follows it).
      player.scene.seed = 12345;
      app.setLook({ background: bg });
      await app.chooseToy(id);
    },
    { id, bg },
  );
  await page.waitForTimeout(1500);
}

for (const renderer of ["webgl2", "webgpu"]) {
  // Two loads of the same build never draw exactly alike (splats of equal
  // depth blend in whatever order the sort returns), so the old shader is
  // held to the same page's own load-to-load difference: a load with the rim
  // blocks taken out, then two loads of the shader as it is now.
  test(`toys without the rim kind draw as before (${renderer})`, async ({ browser }) => {
    const ids = ["marble", "bouncy-ball", "gift-box"];
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
      // One pair of loads can come out nearly alike by chance, so the noise
      // has a floor: a mean of 0.5 levels and 200 pixels that change a lot
      // (0.06% of the frame). A shader that drew these toys differently
      // would change far more.
      expect(change.mean, `${id}: mean change`).toBeLessThanOrEqual(Math.max(2 * noise.mean, 0.5) + 0.05); // prettier-ignore
      expect(change.big, `${id}: pixels that changed a lot`).toBeLessThanOrEqual(Math.max(2 * noise.big, 200) + 20); // prettier-ignore
    }
  });

  test(`a thin rim shell is clear face on and solid at its edge (${renderer})`, async ({
    browser,
  }) => {
    const { ctx, page, errors, dev } = await open(browser, renderer);
    if (renderer === "webgpu" && dev !== "webgpu") {
      await ctx.close();
      test.skip(true, "No WebGPU adapter in this browser.");
    }
    // Two test toys, added to the shelf and a pack for this page only: the
    // same thin white shell, with the rim kind and without it.
    await page.evaluate(async () => {
      const { TOYS } = await import("/src/toys.js");
      const { RECIPES } = await import("/src/packs/balls.js");
      for (const [id, rim] of [
        ["fx4e-rim", true],
        ["fx4e-plain", false],
      ]) {
        TOYS.push({ id, label: id, category: "sports", kind: "kit", pack: "balls", tags: "" });
        RECIPES[id] = {
          build(k) {
            k.add(k.sphere(1), {
              even: true,
              flat: 0.05,
              jitter: 0,
              opacity: 0.9,
              pattern: false,
              color: "#ffffff",
              ...(rim ? { kind: "rim", params: [0.005, 4] } : {}),
            });
          },
        };
      }
    });
    const profile = async (id) => {
      await show(page, id, "#111111");
      const { w, h, px } = await still(page);
      const lum = (x, y) => {
        const i = (Math.round(y) * w + Math.round(x)) * 4;
        return 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      };
      let [x0, x1, y0, y1] = [w, 0, h, 0];
      for (let y = 0; y < h; y += 2)
        for (let x = 0; x < w; x += 2)
          if (lum(x, y) > 30) {
            x0 = Math.min(x0, x);
            x1 = Math.max(x1, x);
            y0 = Math.min(y0, y);
            y1 = Math.max(y1, y);
          }
      const [cx, cy, R] = [(x0 + x1) / 2, (y0 + y1) / 2, Math.min(x1 - x0, y1 - y0) / 2];
      const ring = (f) => {
        let s = 0;
        for (let k = 0; k < 360; k++)
          s += lum(cx + Math.cos(k * 0.01745) * R * f, cy + Math.sin(k * 0.01745) * R * f);
        return s / 360;
      };
      const rims = [];
      for (let f = 0.88; f <= 1.0; f += 0.01) rims.push(ring(f));
      return { R, face: (ring(0.2) + ring(0.4) + ring(0.6)) / 3, rim: Math.max(...rims) };
    };
    const rim = await profile("fx4e-rim");
    const plain = await profile("fx4e-plain");
    expect(rim.R).toBeGreaterThan(60);
    // The plain shell is a solid white disc; the rim shell is dark face on
    // (nearly clear) with a bright ring at its edge.
    expect(plain.face).toBeGreaterThan(150);
    expect(rim.face).toBeLessThan(30);
    expect(rim.rim).toBeGreaterThan(3 * rim.face);
    expect(rim.rim).toBeGreaterThan(100);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}
