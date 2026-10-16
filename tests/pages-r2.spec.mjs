// Task 95: real renderer checks for face ownership, motion, and lifetime.
import { test, expect } from "@playwright/test";

async function layeredLab(pics) {
  const { buildRecipe } = await import("../src/kit.js");
  const { RECIPES, BOOKS_R5 } = await import("../src/packs/pictures.js");
  const r = RECIPES["picture-lab"];
  const options = Object.fromEntries(r.options.map((o) => [o.key, o.default]));
  const it = buildRecipe(r, { seed: 5, count: 8000, options }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  const data = { ...b.value.kit.data, pictures: pics };
  let t = 1,
    n = 0,
    out;
  const frame = () => {
    out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, grow: 1, cues: [], fx: {} };
    r.drive(t, { next: 0, pop: 1, box: 0, layers: 1 }, out, {
      time: t,
      R: 1,
      tap: n ? { n, pick: { fig: { page: 0, box: [0, 0, 1, 1] } } } : null,
      data,
      figures: [],
    });
    t += 0.1;
  };
  frame();
  n++;
  frame();
  await new Promise(setImmediate);
  for (let i = 0; i < 80; i++) frame();
  return { BOOKS_R5, out };
}

test("a chart opened as an image gets graphic cutouts instead of photo inference", async () => {
  const sizes = [];
  const pics = {
    page: 0,
    count: 1,
    kind: "image",
    name: "chart.png",
    aspect: () => 1,
    ready: () => true,
    links: async () => [],
    figures: async () => [],
    crop: async (_n, _box, size) => {
      sizes.push(size);
      const data = new Uint8ClampedArray(size * size * 4).fill(255);
      for (let y = Math.floor(size * 0.25); y < size * 0.75; y++)
        for (let x = Math.floor(size * 0.3); x < size * 0.6; x++)
          data.set([20, 80, 170, 255], (y * size + x) * 4);
      return {
        width: size,
        height: size,
        getContext: () => ({ getImageData: () => ({ data, width: size, height: size }) }),
      };
    },
  };
  const { BOOKS_R5, out } = await layeredLab(pics);
  const f = BOOKS_R5.PG.pops[0];
  expect(f.kind).toBe("graphic");
  expect(f.phase).toBe("up");
  expect(f.layered).toBe(true);
  expect(f.relief.w).toBe(518);
  expect(sizes).toEqual([518]);
  expect(out.sheets.pop2.page).toBe(-1);
});

test("a failed layered photo returns a single card instead of waiting forever", async () => {
  const pics = {
    page: 0,
    count: 1,
    kind: "image",
    name: "photo.jpg",
    aspect: () => 1,
    ready: (id) => id === "pop0",
    links: async () => [],
    figures: async () => [],
    crop: async () => {
      throw new Error("Depth input unavailable in this regression check.");
    },
  };
  const { BOOKS_R5, out } = await layeredLab(pics);
  const f = BOOKS_R5.PG.pops[0];
  expect(f.kind).toBe("photo");
  expect(f.phase).toBe("up");
  expect(f.layered).toBe(true);
  expect(out.sheets.pop0.page).toBe(0);
  expect(out.sheets.pop1.page).toBe(-1);
  expect(out.sheets.pop2.page).toBe(-1);
});

const ready = async (page) => {
  await page.waitForFunction(
    () => {
      const pl = window.__splashery.player,
        p = pl.pictures;
      pl.stage.requestRender();
      return (
        p?.media && p.splats() > 0 && p.sheets.every((s) => !s.want || s.shown?.key === s.want.key)
      );
    },
    null,
    { timeout: 180000 },
  );
};

test.describe("sharp pages in the real renderer", () => {
  test.setTimeout(360000);
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  test("the requested WebGPU renderer draws masked cards and reports its backend", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && /shader|compil|validation|syntax/i.test(m.text()))
        errors.push(m.text());
    });
    await page.goto("/?renderer=webgpu&profile=low&adapt=off&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(() => {
      window.__pagesR2GpuErrors = [];
      window.__splashery.player.stage.device.wgpu?.addEventListener("uncapturederror", (e) =>
        window.__pagesR2GpuErrors.push(e.error.message),
      );
    });
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await ready(page);
    const backend = await page.evaluate(() => window.__splashery.player.stage.device.deviceType);
    test.info().annotations.push({ type: "renderer", description: backend });
    await page.evaluate(async () => {
      const { app, player } = window.__splashery;
      window.__pagesR2Books = (await import("/src/packs/pictures.js")).BOOKS_R5;
      app.togglePopOut();
      app.setControl("layers", 1);
      player.motion.state.pop = player.motion.state.layers = 1;
      player.stage.requestRender();
    });
    await page.waitForFunction(
      () => {
        const { BK5, PG } = window.__pagesR2Books;
        window.__splashery.player.stage.requestRender();
        return PG.layers && !!BK5.figs.get(0)?.length;
      },
      null,
      { timeout: 60000 },
    );
    await page.evaluate(async () => {
      const b = (await import("/src/packs/pictures.js")).BOOKS_R5;
      const f = b.BK5.figs.get(0)[0].box;
      const p = window.__splashery.player;
      p.act(p.fromRecipe(b.point(0, [(f[0] + f[2]) / 2, (f[1] + f[3]) / 2])));
    });
    await page.waitForFunction(
      () => {
        window.__splashery.player.stage.requestRender();
        return window.__pagesR2Books.PG.pops[0]?.phase === "up";
      },
      null,
      { timeout: 120000 },
    );
    await ready(page);
    const state = await page.evaluate(async () => {
      const p = window.__splashery.player;
      for (let i = 0; i < 3; i++) await p.stage.captureFrame();
      const { PG } = (await import("/src/packs/pictures.js")).BOOKS_R5;
      return {
        backend: p.stage.device.deviceType,
        gpuErrors: window.__pagesR2GpuErrors,
        count: p.pictures.sheets.filter((s) => s.slot?.surface?.instance.visible).length,
        layers: PG.layers,
        pops: PG.pops.map((f) => ({
          phase: f.phase,
          layered: f.layered,
          kind: f.kind,
          failed: f.failed,
        })),
        sheets: p.pictures.sheets
          .filter((s) => s.slot)
          .map((s) => ({
            id: s.def.id,
            hidden: s.hidden,
            page: s.want?.page,
            enabled: s.slot.entity.enabled,
            visible: s.slot.surface?.instance.visible,
            partVisible: s.slot.surface?.partVisible,
            part: s.def.part,
          })),
      };
    });
    expect(errors).toEqual([]);
    expect(state.gpuErrors).toEqual([]);
    console.log("Masked card renderer:", JSON.stringify(state));
    expect(state.count).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: "tests/screenshots/pages-r2-webgpu-layers-390x844.png" });
    await page.evaluate(async () => {
      const { twoFigurePDF } = await import("/tests/fixtures/pg6/make-pdf.mjs");
      await window.__splashery.app.openMedia(
        new File([twoFigurePDF()], "mono.pdf", { type: "application/pdf" }),
      );
    });
    await ready(page);
    const mono = await page.evaluate(async () => {
      const p = window.__splashery.player;
      let frame;
      for (let i = 0; i < 3; i++) frame = await p.stage.captureFrame();
      const s = p.pictures.sheets.find((s) => s.slot?.surface?.instance.visible);
      const face = s.shown.data.surface;
      const b = (await import("/src/packs/pictures.js")).BOOKS_R5;
      const point = p.stage.toScreen(p.fromRecipe(b.point(0, [0.5, 0.5])));
      const ratio = frame.width / p.canvas.clientWidth;
      return {
        bytes: face.pixels?.byteLength,
        expected: face.w * face.h,
        white: Array.from(
          frame
            .getContext("2d")
            .getImageData(Math.floor(point[0] * ratio), Math.floor(point[1] * ratio), 1, 1).data,
        ),
        errors: window.__pagesR2GpuErrors,
      };
    });
    expect(mono.bytes).toBe(mono.expected);
    expect(mono.white.slice(0, 3).every((x) => x > 240)).toBe(true);
    expect(mono.errors).toEqual([]);
    const ink = await page.evaluate(async () => {
      const p = window.__splashery.player;
      const s = p.pictures.sheets.find((s) => s.slot?.surface?.instance.visible);
      s.slot.surface.material.setParameter("uColorLow", [23 / 255, 32 / 255, 42 / 255, 0]);
      const frame = await p.stage.captureFrame();
      const d = frame.getContext("2d").getImageData(0, 0, frame.width, frame.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4)
        if (d[i] + 5 < d[i + 1] && d[i + 1] + 5 < d[i + 2] && d[i + 2] < 100) n++;
      return n;
    });
    expect(ink).toBeGreaterThan(3);
    await page.screenshot({ path: "tests/screenshots/pages-r2-webgpu-mono-390x844.png" });
    await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const g = canvas.getContext("2d");
      g.fillStyle = "#2378c6";
      g.fillRect(0, 0, 64, 64);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve));
      await window.__splashery.app.openMedia(new File([blob], "color.png", { type: "image/png" }));
    });
    await ready(page);
    const color = await page.evaluate(async () => {
      const p = window.__splashery.player;
      for (let i = 0; i < 3; i++) await p.stage.captureFrame();
      const s = p.pictures.sheets.find((s) => s.slot?.surface?.instance.visible);
      const face = s.shown.data.surface;
      const point = p.stage.toScreen(p.pictures.rect(s, p.pictures.media.aspect(0)).c);
      const frame = await p.stage.captureFrame();
      const ratio = frame.width / p.canvas.clientWidth;
      p.pickDirty = true;
      const picked = await p.pickAt(point[0], point[1]);
      return {
        channels: face.channels,
        bytes: face.pixels.byteLength,
        expected: face.w * face.h * 4,
        picked,
        pixel: Array.from(
          frame
            .getContext("2d")
            .getImageData(Math.floor(point[0] * ratio), Math.floor(point[1] * ratio), 1, 1).data,
        ),
        errors: window.__pagesR2GpuErrors,
      };
    });
    expect(color.channels).toBe(4);
    expect(color.bytes).toBe(color.expected);
    expect(color.picked).not.toBe(null);
    expect(color.picked.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...color.picked)).toBeLessThan(0.25);
    for (let i = 0; i < 3; i++)
      expect(Math.abs(color.pixel[i] - [35, 120, 198][i])).toBeLessThanOrEqual(2);
    expect(color.errors).toEqual([]);
  });

  test("still pages own continuous faces, moving media and the neighboring frame retain their splats", async ({
    page,
  }) => {
    // A real photo's sampled backing grows with this viewer. Fixed paper
    // geometry can reuse its slot, so it does not force this allocation.
    await page.setViewportSize({ width: 80, height: 173 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && /shader|compil|validation|syntax/i.test(m.text()))
        errors.push(m.text());
    });
    await page.goto("/?renderer=webgl2&profile=mid&adapt=off&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await page.evaluate(() =>
      window.__splashery.app.openMedia(
        new URL("/assets/toys/picture-frame/islands.jpg", location.href).href,
      ),
    );
    await ready(page);
    const drawing = await page.evaluate(async () => {
      const media = window.__splashery.player.pictures.media;
      const immediate = media.drawNow(0, 48, 36, [0.1, 0.2, 0.8, 0.7]);
      const pending = media.draw(0, 48, 36, [0.1, 0.2, 0.8, 0.7]);
      const promise = typeof pending.then === "function";
      const ordinary = await pending;
      const pixels = (c) => c.getContext("2d").getImageData(0, 0, 48, 36).data;
      const a = pixels(immediate),
        b = pixels(ordinary);
      return {
        canvas: immediate instanceof HTMLCanvasElement,
        promise,
        same: a.every((v, i) => v === b[i]),
      };
    });
    expect(drawing).toEqual({ canvas: true, promise: true, same: true });
    const old = await page.evaluateHandle(() => {
      const face = window.__splashery.player.pictures.sheets[0].slot.surface;
      // A normal detail upgrade can retire a handle between browser calls.
      // Select and verify the currently owned face in the same turn.
      if (!face || !face.instance.visible || !face.material.depthWrite)
        throw new Error("The current printed face must be visible and write depth.");
      return face;
    });
    const picked = await page.evaluate(async () => {
      const p = window.__splashery.player;
      const sheet = p.pictures.sheets[0];
      const point = p.stage.toScreen(p.pictures.rect(sheet, p.pictures.media.aspect(0)).c);
      p.pickDirty = true;
      return p.pickAt(point[0], point[1]);
    });
    expect(picked).not.toBe(null);
    expect(picked.every(Number.isFinite)).toBe(true);
    expect(
      await page.evaluate(() => {
        const d = window.__splashery.player.pictures.sheets[0].shown.data;
        const f = d.surface;
        return f.pixels
          ? f.pixels.byteLength === d.w * d.h * (f.channels || 1)
          : f.source.width === d.w && f.source.height === d.h;
      }),
    ).toBe(true);
    const before = await page.evaluate(
      () =>
        window.__splashery.player.stage.app.scene.layers.getLayerByName("Picture faces")
          .meshInstances.length,
    );
    await page.evaluate(() => {
      const p = window.__splashery.player.pictures,
        show = p.show;
      window.__pagesR2Replacements = [];
      p.show = function (...args) {
        const previous = args[0].slot;
        const face = previous?.surface;
        const result = show.apply(this, args);
        if (face && face !== args[0].slot?.surface)
          window.__pagesR2Replacements.push({
            containerChanged: previous !== args[0].slot,
            backing: previous !== args[0].slot && previous.entity.enabled,
            face: face.instance.mesh !== null && face.instance.visible,
            oldFace: face,
          });
        return result;
      };
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      window.__splashery.player.camera.zoomBy(0.04);
      window.__splashery.player.stage.requestRender();
    });
    await page.waitForFunction(() => window.__pagesR2Replacements.length > 0, null, {
      timeout: 120000,
    });
    for (const file of ["photo.jpg", "anim.gif", "photo.jpg", "clip.webm"]) {
      await page.evaluate(
        (file) =>
          window.__splashery.app.openMedia(
            new URL(`/tests/fixtures/pic/${file}`, location.href).href,
          ),
        file,
      );
      await ready(page);
      const image = file === "photo.jpg";
      expect(
        await page.evaluate(() => !!window.__splashery.player.pictures.sheets[0].slot.surface),
      ).toBe(image);
    }
    expect(
      await old.evaluate((s) => s.instance.mesh === null && s.instance.material === null),
    ).toBe(true);
    const replacements = await page.evaluate(() =>
      window.__pagesR2Replacements.map(({ oldFace, ...state }) => ({
        ...state,
        disposed: oldFace.instance.mesh === null && oldFace.instance.material === null,
        inLayer: oldFace.layer.meshInstances.includes(oldFace.instance),
      })),
    );
    expect(replacements.length).toBeGreaterThan(0);
    expect(replacements.some((r) => r.containerChanged)).toBe(true);
    expect(replacements.every((r) => !r.backing && !r.face && !r.inLayer && r.disposed)).toBe(true);
    expect(await old.evaluate((s) => s.layer.meshInstances.includes(s.instance))).toBe(false);
    await old.dispose();
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-frame"));
    await ready(page);
    expect(
      await page.evaluate(() =>
        window.__splashery.player.pictures.sheets.some((s) => !!s.slot?.surface),
      ),
    ).toBe(false);
    expect(
      await page.evaluate(
        () =>
          window.__splashery.player.stage.app.scene.layers.getLayerByName("Picture faces")
            .meshInstances.length,
      ),
    ).toBeLessThan(before);
    expect(errors).toEqual([]);
  });

  test("a turning leaf's two faces remain attached and leave no face in the next toy", async ({
    page,
  }) => {
    await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(async () => {
      const a = window.__splashery.app;
      await a.chooseToy("your-book");
      await a.openMedia(new URL("/tests/fixtures/bk/booklet.pdf", location.href).href);
    });
    await ready(page);
    await page.evaluate(() => window.__splashery.player.act());
    await page.waitForFunction(
      () => {
        const pl = window.__splashery.player;
        pl.stage.requestRender();
        return pl.pictures.page > 0;
      },
      null,
      { timeout: 120000 },
    );
    await ready(page);
    const faces = await page.evaluateHandle(() =>
      window.__splashery.player.pictures.sheets.map((s) => s.slot?.surface).filter(Boolean),
    );
    const count = await faces.evaluate((s) => s.length);
    expect(count).toBeGreaterThan(1);
    expect(
      await faces.evaluate((s) =>
        s.every((f) => f.instance.node === f.slot.entity && f.material.depthWrite),
      ),
    ).toBe(true);
    await page.evaluate(() => window.__splashery.app.chooseToy("laptop"));
    await page.waitForFunction(
      () => {
        window.__splashery.player.stage.requestRender();
        return !window.__splashery.player.stage.graveyard.length;
      },
      null,
      { timeout: 60000 },
    );
    expect(
      await faces.evaluate((s) => s.every((f) => !f.layer.meshInstances.includes(f.instance))),
    ).toBe(true);
    await faces.dispose();
  });
});

for (const renderer of ["webgl2", "webgpu"])
  test(`opaque tilted PDF faces cover their own paper backing (${renderer})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?renderer=${renderer}&profile=low&adapt=off&labs=1`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await ready(page);
    await page.evaluate(async () => {
      const p = window.__splashery.player;
      p.frozen = true;
      p.glide = null;
      p.camera.cur.yaw = p.camera.tgt.yaw = 0.45;
      p.camera.cur.pitch = p.camera.tgt.pitch = 0.3;
      p.camera.interact();
      for (let i = 0; i < 4; i++) await p.stage.captureFrame();
    });
    await ready(page);
    const difference = await page.evaluate(async () => {
      const p = window.__splashery.player;
      const sh = p.pictures.sheets.find((s) => !s.hidden && s.slot?.surface);
      const face = sh.slot.surface,
        g = face.geom;
      const frame = await p.stage.captureFrame();
      const a = frame.getContext("2d").getImageData(0, 0, frame.width, frame.height).data;
      const mask = document.createElement("canvas");
      mask.width = frame.width;
      mask.height = frame.height;
      const ctx = mask.getContext("2d");
      const ratio = frame.width / p.canvas.clientWidth;
      ctx.beginPath();
      for (const [i, [u, v]] of [
        [0, [0.2, 0.2]],
        [1, [0.8, 0.2]],
        [2, [0.8, 0.8]],
        [3, [0.2, 0.8]],
      ]) {
        const xyz = g.origin.map(
          (o, k) =>
            o +
            g.right[k] * face.color.width * u +
            g.down[k] * face.color.height * v +
            g.normal[k] * (g.lift || 0),
        );
        const point = p.stage.toScreen(xyz);
        if (!i) ctx.moveTo(point[0] * ratio, point[1] * ratio);
        else ctx.lineTo(point[0] * ratio, point[1] * ratio);
      }
      ctx.closePath();
      ctx.fill();
      const inside = ctx.getImageData(0, 0, mask.width, mask.height).data;
      const components = p.pictures.sheets.filter((s) => s.slot).map((s) => s.slot.entity.gsplat);
      for (const component of components) component.enabled = false;
      let without;
      for (let i = 0; i < 4; i++) without = await p.stage.captureFrame();
      const b = without.getContext("2d").getImageData(0, 0, without.width, without.height).data;
      let total = 0,
        count = 0;
      for (let i = 0; i < a.length; i += 4)
        if (inside[i + 3] === 255) {
          for (let k = 0; k < 3; k++) total += Math.abs(a[i + k] - b[i + k]);
          count++;
        }
      for (const component of components) component.enabled = true;
      return { mean: total / (count * 3), count };
    });
    expect(difference.count).toBeGreaterThan(1000);
    expect(difference.mean).toBeLessThan(0.5);
  });

for (const renderer of ["webgl2", "webgpu"])
  test(`a closed album cover hides its picture faces (${renderer})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?renderer=${renderer}&profile=low&adapt=off&labs=1`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("photo-album"));
    await ready(page);
    const difference = await page.evaluate(async () => {
      const p = window.__splashery.player;
      p.frozen = true;
      p.glide = null;
      p.camera.interact();
      const { WORKBUFFER_UPDATE_ONCE } = await import("/src/pc.js");
      p.stage.toy.entity.gsplat.workBufferUpdate = WORKBUFFER_UPDATE_ONCE;
      for (let i = 0; i < 4; i++) await p.stage.captureFrame();
      const frame = await p.stage.captureFrame();
      const a = frame.getContext("2d").getImageData(0, 0, frame.width, frame.height).data;
      const faces = p.pictures.sheets.map((s) => s.slot?.surface).filter(Boolean);
      // WebGPU's splat sorting can change coincident cover splats slightly
      // between identical frames. Measure that floor before hiding any ink.
      let control;
      for (let i = 0; i < 4; i++) control = await p.stage.captureFrame();
      const c = control.getContext("2d").getImageData(0, 0, control.width, control.height).data;
      for (const f of faces) {
        f.material.redWrite =
          f.material.greenWrite =
          f.material.blueWrite =
          f.material.alphaWrite =
            false;
        f.material.update();
      }
      let without;
      for (let i = 0; i < 4; i++) without = await p.stage.captureFrame();
      const b = without.getContext("2d").getImageData(0, 0, without.width, without.height).data;
      let total = 0,
        noise = 0;
      for (let i = 0; i < a.length; i += 4)
        for (let k = 0; k < 3; k++) {
          total += Math.abs(c[i + k] - b[i + k]);
          noise += Math.abs(a[i + k] - c[i + k]);
        }
      return {
        mean: total / ((a.length / 4) * 3),
        noise: noise / ((a.length / 4) * 3),
        angle: p.motion.out.parts.cover.angle,
        faces: faces.length,
      };
    });
    expect(difference.angle).toBe(0);
    expect(difference.faces).toBeGreaterThan(0);
    expect(difference.mean - difference.noise).toBeLessThan(0.5);
  });

for (const renderer of ["webgl2", "webgpu"])
  test(`a connected page has a printed front and pickable white reverse (${renderer})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?renderer=${renderer}&profile=low&adapt=off&labs=1`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("picture-lab"));
    await ready(page);
    const views = await page.evaluate(async () => {
      const p = window.__splashery.player;
      p.frozen = true;
      p.glide = null;
      p.stage.toy.entity.gsplat.enabled = false;
      const face = p.pictures.sheets.find((s) => !s.hidden && s.slot?.surface).slot.surface;
      face.material.setParameter("uColorFlags", [1, 0, 0, 0]);
      face.material.setParameter("uColorLow", [1, 0, 0, 0]);
      face.material.setParameter("uColorHigh", [1, 0, 0, 0]);
      const g = face.geom;
      const center = g.origin.map(
        (v, k) =>
          v +
          (g.right[k] * face.color.width) / 2 +
          (g.down[k] * face.color.height) / 2 +
          g.normal[k] * (g.lift || 0),
      );
      const views = [];
      for (const yaw of [0, Math.PI]) {
        p.camera.cur.yaw = p.camera.tgt.yaw = yaw;
        p.camera.cur.pitch = p.camera.tgt.pitch = 0;
        p.camera.cur.roll = p.camera.tgt.roll = 0;
        p.camera.interact();
        let frame;
        for (let i = 0; i < 4; i++) frame = await p.stage.captureFrame();
        const point = p.stage.toScreen(center);
        const ratio = frame.width / p.canvas.clientWidth;
        const pixel = Array.from(
          frame
            .getContext("2d")
            .getImageData(Math.round(point[0] * ratio), Math.round(point[1] * ratio), 1, 1).data,
        );
        p.stage.preparePick();
        views.push({ pixel, pick: await p.stage.pick(point[0], point[1]) });
      }
      return views;
    });
    expect(views[0].pixel[0]).toBeGreaterThan(240);
    expect(views[0].pixel[1]).toBeLessThan(10);
    expect(views[0].pixel[2]).toBeLessThan(10);
    expect(views[1].pixel.slice(0, 3).every((v) => v > 240)).toBe(true);
    expect(views.every((v) => v.pick !== null)).toBe(true);
  });
