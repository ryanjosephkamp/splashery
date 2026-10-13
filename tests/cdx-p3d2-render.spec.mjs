import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { open, sample, shot, pixels, splatTears } from "../tools/cdx-p3d2-measure.mjs";

test.use({ viewport: { width: 390, height: 844 } });
test("source bitmaps are reused for depth changes and retired after a source handoff", async ({
  page,
}) => {
  test.setTimeout(240000);
  await open(page);
  const result = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    for (let k = 0; k < 3; k++) await player.stage.captureFrame();
    const first = player.stage.photoTex.getSource();
    await app.setToyOptions({ depth: 1 });
    for (let k = 0; k < 3; k++) await player.stage.captureFrame();
    const reused = player.stage.photoTex.getSource() === first;
    await app.setToyOptions({ source: "street" });
    for (let k = 0; k < 6; k++) await player.stage.captureFrame();
    return {
      reused,
      closed: first.width === 0,
      replacement: player.stage.photoTex.getSource().width,
    };
  });
  expect(result.reused).toBe(true);
  expect(result.closed).toBe(true);
  expect(result.replacement).toBeGreaterThan(0);
});

test("an unavailable worker bitmap keeps valid geometry for the canvas fallback", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const result = await page.evaluate(async () => {
    const script = `OffscreenCanvas.prototype.transferToImageBitmap = () => { throw new Error("Unavailable bitmap"); }; await import(${JSON.stringify(location.origin + "/src/photo3d/build-worker.js")}); self.postMessage({ ready: true });`;
    const url = URL.createObjectURL(new Blob([script], { type: "text/javascript" }));
    const worker = new Worker(url, { type: "module" });
    try {
      return await new Promise((resolve, reject) => {
        worker.onerror = (e) => reject(new Error(e.message));
        worker.onmessage = ({ data }) => {
          if (data.ready)
            worker.postMessage({
              id: 1,
              photo: { w: 32, h: 32, data: new Uint8Array(4096).fill(255) },
              depth: { w: 8, h: 8, d: new Float32Array(64).fill(1) },
              options: { count: 1000 },
              cells: 1000,
            });
          else if (data.error) reject(new Error(data.error));
          else
            resolve({
              bitmap: !!data.result.bitmap,
              count: data.result.n,
              field: data.result.background.field.length,
            });
        };
      });
    } finally {
      worker.terminate();
      URL.revokeObjectURL(url);
    }
  });
  expect(result.bitmap).toBe(false);
  expect(result.count).toBeGreaterThan(0);
  expect(result.field).toBeGreaterThan(0);
});

test("a late source decode cannot replace a newer prepared photo", async ({ page }) => {
  test.setTimeout(240000);
  await open(page);
  const name = await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/photo-3d.js");
    const { buildRecipe } = await import("/src/kit.js");
    const recipe = RECIPES["photo-3d"];
    const fetch0 = window.fetch;
    let release;
    const delayed = new Promise((r) => {
      release = r;
    });
    window.fetch = async (...args) => {
      if (String(args[0]).includes("wildflowers.")) await delayed;
      return fetch0(...args);
    };
    try {
      const older = recipe.prepare({ source: "wildflowers", depth: 1 }, null, { profile: "low" });
      await recipe.prepare({ source: "spiral-stairs", depth: 1 }, null, { profile: "low" });
      release();
      await older;
      const it = buildRecipe(recipe, { seed: 1, count: 2000, options: { depth: 1 } });
      let r = it.next();
      while (!r.done) r = it.next();
      return r.value.kit.data.photo.name;
    } finally {
      release();
      window.fetch = fetch0;
    }
  });
  expect(name).toMatch(/spiral/i);
});

test("added clay retains its color and extends beyond the photo boundary", async ({ page }) => {
  test.setTimeout(240000);
  await open(page);
  await sample(page, "forest", 1, "splats");
  const result = await page.evaluate(async () => {
    const { app, player: pl } = window.__splashery;
    app.tool = "clay";
    pl.setPaused(false);
    const b = pl.proc.ctx.buf;
    const start = b.count;
    pl.proc.ctx.coloring.surface = () => [1, 0, 1];
    const x = pl.toyInfo.recipe.photo.rect()[2] + 0.05;
    const op = pl.clayAt(pl.fromRecipe([x, 0, 0.3]), "add", 0.4);
    for (let k = 0; k < 4; k++) await pl.stage.captureFrame();
    const frame = await pl.stage.captureFrame();
    const image = frame.getContext("2d").getImageData(0, 0, frame.width, frame.height).data;
    let magenta = 0;
    for (let i = 0; i < image.length; i += 4)
      if (image[i] > 180 && image[i + 1] < 60 && image[i + 2] > 180) magenta++;
    return {
      added: b.count - start,
      op: !!op,
      magenta,
      flags: Array.from(b.anim.slice(start * 4, start * 4 + 4)),
    };
  });
  expect(result.op).toBe(true);
  expect(result.added).toBeGreaterThan(0);
  expect(result.flags).toEqual([0, 0, 0, 0]);
  expect(result.magenta).toBeGreaterThan(10);
});

test("photo orientation and white alpha compositing decode in a worker", async ({ page }) => {
  await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const p = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 2;
    const g = c.getContext("2d");
    g.fillStyle = "#f00";
    g.fillRect(0, 0, 2, 2);
    const blob = await new Promise((r) => c.toBlob(r));
    // A fallback to the window would fail this test. The worker must return
    // oriented RGBA bytes and composite transparency on white itself.
    window.createImageBitmap = () => {
      throw new Error("Main-thread decode was used.");
    };
    const photo = await (await import("/src/packs/photo-3d.js")).decodePhoto(blob);
    c.width = 32;
    c.height = 16;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, 32, 16);
    g.fillStyle = "#f00";
    g.fillRect(0, 0, 16, 16);
    const jpeg = new Uint8Array(
      await (await new Promise((r) => c.toBlob(r, "image/jpeg", 1))).arrayBuffer(),
    );
    // EXIF orientation 6 rotates the 32x16 source clockwise to 16x32.
    const exif = new Uint8Array([
      255, 225, 0, 34, 69, 120, 105, 102, 0, 0, 77, 77, 0, 42, 0, 0, 0, 8, 0, 1, 1, 18, 0, 3, 0, 0,
      0, 1, 0, 6, 0, 0, 0, 0, 0, 0,
    ]);
    const turned = await (
      await import("/src/packs/photo-3d.js")
    ).decodePhoto(new Blob([jpeg.slice(0, 2), exif, jpeg.slice(2)], { type: "image/jpeg" }));
    const at = (x, y) =>
      Array.from(turned.data.slice((y * turned.w + x) * 4, (y * turned.w + x) * 4 + 3));
    return {
      w: photo.w,
      h: photo.h,
      red: Array.from(photo.data.slice(0, 4)),
      white: Array.from(photo.data.slice(12, 16)),
      turned: { w: turned.w, h: turned.h, red: at(8, 8), white: at(8, 24) },
    };
  });
  expect(p).toMatchObject({
    w: 4,
    h: 2,
    red: [255, 0, 0, 255],
    white: [255, 255, 255, 255],
  });
  expect([p.turned.w, p.turned.h]).toEqual([16, 32]);
  expect(p.turned.red[0]).toBeGreaterThan(230);
  expect(p.turned.red[1]).toBeLessThan(20);
  expect(p.turned.red[2]).toBeLessThan(20);
  expect(Math.min(...p.turned.white)).toBeGreaterThan(230);
});

test("normalized slider values reuse worker fields within both profile budgets", async ({
  page,
}) => {
  test.setTimeout(240000);
  await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const result = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    const { ReliefMesh } = await import("/src/live/relief-mesh.js");
    const fields = [];
    const original = ReliefMesh.prototype.setPieces;
    ReliefMesh.prototype.setPieces = function (p) {
      if (p)
        fields.push({
          present: !!p.field,
          length: p.field?.length,
          expected: (this.backCols + 1) * (this.backRows + 1) * 4,
        });
      return original.call(this, p);
    };
    await app.chooseToy("photo-3d");
    const counts = [];
    for (const profile of ["low", "max"]) {
      player.setProfile(profile);
      await app.setToyOptions({ source: "spiral-stairs", depth: 0.95, view: "sharp" });
      for (let k = 0; k < 3; k++) await player.stage.captureFrame();
      counts.push({ count: player.proc.ctx.buf.count, budget: player.splatBudget(1.5) });
    }
    return { fields, counts };
  });
  expect(result.fields.length).toBeGreaterThan(1);
  for (const f of result.fields) {
    expect(f.present).toBe(true);
    expect(f.length).toBe(f.expected);
  }
  for (const c of result.counts) expect(c.count).toBeLessThanOrEqual(c.budget);
});
// Sums of twelve registered main renders: depths .2/.5/1, four directions,
// twenty degrees, 390x844, low profile. Filled backing is content; clear color
// is a hole. The report also records the original unfilled backing exposure.
const baseline = {
  forest: { sharp: [33521, 60986], splats: [5547, 0] },
  "spiral-stairs": { sharp: [17253, 89591], splats: [3100, 0] },
  "dot-castle": { sharp: [9406, 50745], splats: [198, 0] },
};
for (const [id, views] of Object.entries(baseline))
  for (const [view, [holesBefore, tearsBefore]] of Object.entries(views))
    test(`${id} ${view}: at least 80% fewer holes and tears at twenty degrees`, async ({
      page,
    }) => {
      test.setTimeout(360000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error" || /GL_INVALID|Invalid command|shader compilation/i.test(m.text()))
          errors.push(m.text());
      });
      await open(page);
      let holes = 0,
        tears = 0;
      for (const depth of [0.2, 0.5, 1]) {
        await sample(page, id, depth, view);
        for (const direction of ["left", "right", "up", "down"]) {
          const s = await shot(page, direction, 20);
          holes += pixels(
            PNG.sync.read(Buffer.from(s.image.split(",")[1], "base64")),
            s.corners,
          ).holes;
          if (view === "sharp") {
            const t = await shot(page, direction, 20, "tears");
            tears += pixels(
              PNG.sync.read(Buffer.from(t.image.split(",")[1], "base64")),
              s.corners,
            ).backing;
          } else tears += (await splatTears(page)).tears;
        }
      }
      expect(errors).toEqual([]);
      expect(holes).toBeLessThanOrEqual(Math.floor(holesBefore * 0.2));
      expect(tears).toBeLessThanOrEqual(Math.floor(tearsBefore * 0.2));
      console.log({ id, view, holes, tears, holesBefore, tearsBefore });
    });
test("the forest's raised Splats surface closes its steep slopes at 20 degrees", async ({
  page,
}) => {
  test.setTimeout(180000);
  await open(page);
  await sample(page, "forest", 1, "splats");
  const s = await shot(page, "up", 20);
  const p = PNG.sync.read(Buffer.from(s.image.split(",")[1], "base64"));
  // Immutable main, same pose/profile/mask: 1,940 clear-color holes.
  expect(pixels(p, s.corners).holes).toBeLessThanOrEqual(388);
});

test("a newer geometry request supersedes stale work without transferring the caller's pixels", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const { prepareSurface, cancelPendingSurface } = await import("/src/photo3d/prepare.js");
    const w = 96,
      h = 72;
    const photo = { w, h, data: new Uint8Array(w * h * 4).fill(255) };
    const depth = { w, h, d: Float32Array.from({ length: w * h }, (_, i) => (i % w) / w) };
    const jobs = [0.2, 0.5, 1].map((d) =>
      prepareSurface(photo, depth, { count: 10000, depth: d }, 60000),
    );
    const result = await Promise.all(jobs);
    const pending = prepareSurface(photo, depth, { count: 10000, depth: 0.5 }, 60000);
    cancelPendingSurface();
    return {
      kept: result.map((x) => !!x),
      relief: result[2].stats.relief,
      pixels: photo.data.length,
      depth: depth.d.length,
      canceled: (await pending) === null,
    };
  });
  expect(r.kept).toEqual([false, false, true]);
  expect(r.relief).toBeCloseTo(0.78);
  expect(r.pixels).toBe(96 * 72 * 4);
  expect(r.depth).toBe(96 * 72);
  expect(r.canceled).toBe(true);
});

for (const renderer of ["webgl2", "webgpu"])
  test(`${renderer}: filled Sharp and Splats draw, and their atlas clears for Moving photo`, async ({
    page,
  }) => {
    test.setTimeout(240000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" || /GL_INVALID|Invalid command|shader compilation/i.test(m.text()))
        errors.push(m.text());
    });
    await page.goto(`/?renderer=${renderer}&profile=low&adapt=off&labs=1`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    const device = await page.evaluate(() => window.__splashery.player.stage.deviceType);
    test.skip(device !== renderer, `No ${renderer} adapter in this browser.`);
    const result = await page.evaluate(async () => {
      const { app, player } = window.__splashery;
      await app.chooseToy("photo-3d");
      await app.setToyOptions({ source: "forest", depth: 1, view: "sharp" });
      const sharp = await import("/src/packs/photo-sharp.js");
      player.motion.setControl("flat", 0, { snap: true });
      for (let k = 0; k < 3; k++) await player.stage.captureFrame();
      const mesh = sharp.sharpState();
      sharp.setSharpView("photo-3d", "splats");
      for (let k = 0; k < 3; k++) await player.stage.captureFrame();
      const active = player.stage.device.scope.resolve("uSpPhotoFill").getValue();
      const frame = await player.stage.captureFrame();
      const rgba = frame.getContext("2d").getImageData(0, 0, frame.width, frame.height).data;
      let colored = 0;
      for (let i = 0; i < rgba.length; i += 4)
        if (
          Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) -
            Math.min(rgba[i], rgba[i + 1], rgba[i + 2]) >
          15
        )
          colored++;
      const p3d = await import("/src/packs/photo-3d.js");
      const data = new Uint8Array(128 * 128 * 4);
      for (let i = 0; i < 128 * 128; i++)
        data.set(i < 128 * 64 ? [255, 0, 0, 255] : [0, 0, 255, 255], i * 4);
      p3d.usePhoto(
        { w: 128, h: 128, data },
        { w: 16, h: 16, d: new Float32Array(256).fill(1) },
        "Orientation probe",
      );
      await app.setToyOptions({ source: "custom", view: "splats" });
      player.motion.setControl("flat", 1, { snap: true });
      for (let k = 0; k < 4; k++) await player.stage.captureFrame();
      const sourceBitmap = player.stage.photoTex.getSource() instanceof ImageBitmap;
      const probe = await player.stage.captureFrame();
      const g = probe.getContext("2d");
      const at = (y) => {
        const [x, v] = player.stage.toScreen(player.fromRecipe([0, y, 0]));
        return Array.from(g.getImageData(Math.round(x), Math.round(v), 1, 1).data);
      };
      const orientation = { top: at(0.25), bottom: at(-0.25) };
      await app.chooseToy("moving-photo-3d");
      sharp.setSharpView("moving-photo-3d", "splats");
      for (let k = 0; k < 3; k++) await player.stage.captureFrame();
      const cleared = player.stage.device.scope.resolve("uSpPhotoFill").getValue();
      return {
        on: mesh.on,
        background: mesh.cost.background,
        active,
        cleared,
        colored,
        sourceBitmap,
        orientation,
      };
    });
    expect(result.on).toBe(true);
    expect(result.background).toBeGreaterThan(1000);
    expect(result.active).toBe(1);
    expect(result.cleared).toBe(0);
    expect(result.colored).toBeGreaterThan(1000);
    expect(result.sourceBitmap).toBe(true);
    expect(result.orientation.top[0]).toBeGreaterThan(200);
    expect(result.orientation.top[2]).toBeLessThan(30);
    expect(result.orientation.bottom[2]).toBeGreaterThan(200);
    expect(result.orientation.bottom[0]).toBeLessThan(30);
    expect(errors).toEqual([]);
  });
