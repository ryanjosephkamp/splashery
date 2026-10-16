import { test, expect } from "@playwright/test";
import { squareSample } from "../src/qr-craft/picture.js";
import { PNG } from "pngjs";
import { readBoth } from "../tools/cdx-circle-study.mjs";
import { readZxingCpp } from "../tools/qrs-study/readers.mjs";
import { resize } from "../tools/qr-scan-lab/sim.mjs";

const gradient = (w, h) => {
  const data = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) data.set([x / w, y / h, 0.5], (y * w + x) * 3);
  return { w, h, data };
};

test("panning against a crop boundary does not cause a jump when zooming", async ({ page }) => {
  await page.goto("/tests/fixtures/");
  await page.evaluate(async () => {
    const { cropPanel } = await import("/src/qr-craft/crop-panel.js");
    const pic = { w: 120, h: 60, data: new Float32Array(120 * 60 * 3).fill(0.5) };
    const panel = cropPanel({
      picture: () => pic,
      options: () => ({ picture: "own", pictureFit: "circle", shape: "circle" }),
      size: () => 29,
      apply: async (o) => {
        window.__cropResult = o;
      },
    });
    document.body.replaceChildren(panel.element);
    panel.refresh();
  });
  const preview = page.getByLabel("Crop preview");
  await preview.focus();
  await preview.press("ArrowDown");
  const box = await preview.boundingBox();
  await page.mouse.move(box.x + 120, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 160);
  await page.mouse.up();
  await page.getByLabel("Zoom your picture").fill("2");
  await page.getByRole("button", { name: "Use this crop" }).click();
  expect(await page.evaluate(() => window.__cropResult.cropY)).toBe(0.5);
});

test("own-picture crop responds to touch, zoom, and keyboard and survives a share link without pixels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?renderer=webgl2&adapt=off&profile=mid&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    await window.__splashery.app.chooseToy("qr-picture");
    window.__splashery.qrCraft.autoCheck = false;
    await window.__splashery.app.setToyOptions({ size: "fit", shape: "circle" });
  });
  const image = new PNG({ width: 120, height: 60 });
  for (let y = 0; y < 60; y++)
    for (let x = 0; x < 120; x++) image.data.set([x * 2, y * 4, 128, 255], (y * 120 + x) * 4);
  await page
    .locator("#toy-input input[type=file]")
    .setInputFiles({ name: "crop-test.png", mimeType: "image/png", buffer: PNG.sync.write(image) });
  await page.locator("#sheet-toggle").click();
  const preview = page.getByLabel("Crop preview");
  await expect(preview).toBeVisible();
  await page.getByLabel("Zoom your picture").fill("2");
  await preview.focus();
  await preview.press("ArrowRight");
  await preview.dispatchEvent("pointerdown", {
    pointerId: 7,
    pointerType: "touch",
    clientX: 180,
    clientY: 200,
    buttons: 1,
  });
  await preview.dispatchEvent("pointermove", {
    pointerId: 7,
    pointerType: "touch",
    clientX: 120,
    clientY: 200,
    buttons: 1,
  });
  await preview.dispatchEvent("pointerup", { pointerId: 7, pointerType: "touch" });
  const box = await preview.boundingBox();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 3 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Use this crop" }).click();
  await page.waitForFunction(() => !window.__splashery.app.busy);
  const result = await page.evaluate(async () => {
    const { encodeSceneHash, decodeSceneHash } = await import("/src/codec.js");
    const scene = window.__splashery.app.exportScene();
    const hash = await encodeSceneHash(scene);
    return {
      options: scene.toy.options,
      restored: (await decodeSceneHash(hash)).toy.options,
      json: JSON.stringify(scene),
      hash,
    };
  });
  expect(result.options.cropZoom).toBe(2);
  expect(result.options.cropX).toBeGreaterThan(0.5);
  expect(result.options.pictureFit).toBe("circle");
  expect(result.restored).toEqual(result.options);
  expect(result.json).not.toContain("crop-test.png");
  expect(result.json).not.toMatch(/data:image|pixels|Float32Array/);
  await page.goto(`/?renderer=webgl2&adapt=off&profile=mid&labs=1#s=${result.hash}`);
  await page.reload();
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  expect(await page.evaluate(() => window.__splashery.qrCraft.picture().error)).toContain(
    "isn't on this device",
  );
  await page.evaluate(() => {
    window.__splashery.qrCraft.autoCheck = false;
  });
  await page
    .locator("#toy-input input[type=file]")
    .setInputFiles({ name: "crop-test.png", mimeType: "image/png", buffer: PNG.sync.write(image) });
  await page.waitForFunction(
    () => window.__splashery.qrCraft.picture().error === "" && !window.__splashery.app.busy,
  );
  const reopened = await page.evaluate(() => window.__splashery.app.exportScene().toy.options);
  expect(reopened.cropX).toBe(result.options.cropX);
  expect(reopened.cropY).toBe(result.options.cropY);
  expect(reopened.cropZoom).toBe(2);
  expect(reopened.pictureFit).toBe("circle");
  expect(
    await page.evaluate(() =>
      window.__splashery.qrCraft.picture().woven.cells.some((v) => v > 0.2 && v < 0.8),
    ),
  ).toBe(true);
});

test("a crop can keep an off-center subject and clamps to the picture", async () => {
  const fit = await import("../src/qr-craft/fit.js").catch(() => ({}));
  expect(typeof fit.cropWindow).toBe("function");
  const pic = gradient(120, 60);
  expect(fit.cropWindow(pic, {})).toEqual({ x: 30, y: 0, side: 60 });
  expect(fit.cropWindow(pic, { cropX: 1, cropY: 0, cropZoom: 2 })).toEqual({
    x: 90,
    y: 0,
    side: 30,
  });
  const input = fit.codePicture(
    pic,
    { shape: "circle", pictureFit: "circle", cropX: 1, cropY: 0, cropZoom: 2 },
    29,
  );
  expect(squareSample(input, 1)[0]).toBeGreaterThan(0.8);
  expect(squareSample(input, 1)[1]).toBeLessThan(0.3);
});

test("Fit the square code keeps a wide picture's complete subject with light padding", async () => {
  const { codePicture } = await import("../src/qr-craft/fit.js");
  const pic = gradient(120, 60);
  const fit = codePicture(pic, { shape: "square", pictureFit: "code" }, 29);
  const sample = squareSample(fit, 120);
  expect(Array.from(sample.slice(0, 3))).toEqual([1, 1, 1]);
  const left = 60 * 120 * 3;
  const right = (60 * 120 + 119) * 3;
  expect(sample[left]).toBeLessThan(0.02);
  expect(sample[right]).toBeGreaterThan(0.98);
  expect(sample[left + 2]).toBe(0.5);
});

test("a circular Picture QR fits a small budget without dropping encoded modules", async () => {
  const { RECIPES } = await import("../src/packs/qr-craft.js");
  const { resolveOptions } = await import("../src/player.js");
  const recipe = RECIPES["qr-picture"];
  const modules = new Set();
  let count = 0;
  const kit = {
    count: 8000,
    reach() {},
    cloud(_options, get) {
      for (let i = 0; i < this.count; i++) {
        const s = get(() => 0.5, i);
        if (s) {
          count++;
          if (s.params[0] > 0) modules.add(s.params[0] - 1);
        }
      }
    },
  };
  expect(() => recipe.build(kit, resolveOptions(recipe, { shape: "circle" }))).not.toThrow();
  expect(count).toBeGreaterThan(4000);
  expect(count).toBeLessThanOrEqual(8000);
  expect(modules.size).toBe(kit.data.size ** 2);
});

test("the compact Picture QR render still scans with all three readers", async ({ page }) => {
  await page.goto("/?renderer=webgl2&adapt=off&profile=mid&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const data = await page.evaluate(async () => {
    const { app } = window.__splashery;
    await app.chooseToy("qr-picture");
    window.__splashery.qrCraft.autoCheck = false;
    const { RECIPES } = await import("/src/packs/qr-craft.js");
    RECIPES["qr-picture"].density = 8000 / app.player.splatBudget(1);
    await app.setToyOptions({ text: "https://example.org/tiny-qr", shape: "circle", size: "fit" });
    const check = await window.__splashery.qrCraft.checkPicture();
    return {
      count: app.player.proc.ctx.kit.count,
      shot: window.__splashery.qrCraft.lastShot(),
      check,
    };
  });
  expect(data.count).toBe(8000);
  expect(data.check.ok).toBe(true);
  expect(data.check.stage.every((s) => s.ok)).toBe(true);
  const img = resize(PNG.sync.read(Buffer.from(data.shot.split(",")[1], "base64")), 390);
  expect(readBoth(img)).toEqual({
    jsqr: "https://example.org/tiny-qr",
    zxing: "https://example.org/tiny-qr",
  });
  expect(await readZxingCpp(img)).toBe("https://example.org/tiny-qr");
});

test("filling a disc uses the same source coordinates for its code and its ring", async () => {
  const fit = await import("../src/qr-craft/fit.js").catch(() => ({}));
  expect(typeof fit.pictureAt).toBe("function");
  const pic = gradient(120, 60);
  const options = { shape: "circle", pictureFit: "circle", cropX: 0.7, cropY: 0.5, cropZoom: 1.5 };
  const code = fit.codePicture(pic, options, 29);
  const center = squareSample(code, 1);
  const ringCenter = fit.pictureAt(pic, options, 29, 0, 0);
  expect(center[0]).toBeCloseTo(ringCenter[0], 1);
  expect(center[1]).toBeCloseTo(ringCenter[1], 1);
  const left = squareSample(code, 5).slice(0, 3);
  const at = fit.pictureAt(pic, options, 29, -29 * 0.4, 29 * 0.4);
  // Area averaging and an integer pixel lookup differ by at most one source pixel.
  for (let c = 0; c < 3; c++) expect(Math.abs(left[c] - at[c])).toBeLessThan(1 / 60);
});

test("legacy crops remain byte-for-byte unchanged and invalid crop values stay finite", async () => {
  const fit = await import("../src/qr-craft/fit.js").catch(() => ({}));
  expect(typeof fit.codePicture).toBe("function");
  const pic = gradient(100, 60);
  expect(fit.codePicture(pic, { shape: "square" }, 29)).toBe(pic);
  const old = fit.codePicture(pic, { shape: "circle" }, 29);
  const { shapeHalf } = await import("../src/qr/circle.js");
  const n = Math.floor((60 * 29) / (2 * shapeHalf(29, "circle")));
  expect(old.w).toBe(n);
  expect(Array.from(old.data.slice(0, 3))).toEqual(
    Array.from(
      pic.data.slice(
        (Math.floor((60 - n) / 2) * 100 + Math.floor((100 - n) / 2)) * 3,
        (Math.floor((60 - n) / 2) * 100 + Math.floor((100 - n) / 2)) * 3 + 3,
      ),
    ),
  );
  const bad = fit.cropWindow(pic, { cropX: NaN, cropY: Infinity, cropZoom: -3 });
  expect(Object.values(bad).every(Number.isFinite)).toBe(true);
  expect(bad.side).toBe(60);
});

test("alternate eyes keep the dark-light-dark-light-dark center runs and do not alter data", async () => {
  const eyes = await import("../src/qr/eyes.js").catch(() => ({}));
  expect(typeof eyes.finderBit).toBe("function");
  for (const shape of ["square", "rounded", "circle"])
    for (const axis of [
      [1, 0],
      [0, 1],
    ])
      expect(
        Array.from({ length: 9 }, (_, i) =>
          eyes.finderBit((i - 4) * axis[0], (i - 4) * axis[1], shape),
        ),
      ).toEqual([false, true, false, true, true, true, false, true, false]);
  expect(eyes.finderBit(3.1, 3.1, "circle")).toBe(false);
  expect(eyes.finderBit(3.1, 3.1, "square")).toBe(true);
  const { encodeQR } = await import("../src/qr/encode.js");
  const { makeWoven } = await import("../src/qr-craft/picture.js");
  const { buildCode } = await import("../src/qr/build.js");
  const code = encodeQR("https://example.org/eyes", "M");
  const old = Array.from(code.dark);
  const square = buildCode(code, { style: "classic", plate: "none", eyeShape: "square" });
  const round = buildCode(code, { style: "classic", plate: "none", eyeShape: "circle" });
  expect(round.splats).not.toEqual(square.splats);
  expect(Array.from(code.dark)).toEqual(old);
  const w = makeWoven(gradient(60, 60), { text: code.text, level: "M" });
  const changed = eyes.wovenEyes(w, "circle");
  for (let i = 0; i < w.G * w.G; i++) {
    const r = Math.floor(i / w.G / w.k);
    const c = Math.floor((i % w.G) / w.k);
    const piece = w.code.pieces[w.code.piece[r * w.code.size + c]];
    if (piece?.kind !== "finder")
      expect(Array.from(changed.cells.slice(i * 3, i * 3 + 3))).toEqual(
        Array.from(w.cells.slice(i * 3, i * 3 + 3)),
      );
  }
});

test("a thinner circular margin changes its extent without moving encoded modules", async () => {
  const { shapeHalf, circleLayout } = await import("../src/qr/circle.js");
  const { encodeQR } = await import("../src/qr/encode.js");
  const code = encodeQR("https://example.org/crop", "M");
  const original = Array.from(code.dark);
  expect(shapeHalf(code, "circle", 1)).toBeLessThan(shapeHalf(code, "circle", 4));
  expect(shapeHalf(code, "circle", 1)).toBe(circleLayout(code, 1).half);
  expect(Array.from(code.dark)).toEqual(original);
});

test("the study's faster Gaussian blur has exactly the existing simulator's pixels", async () => {
  const study = await import("../tools/cdx-qr-fit-study.mjs");
  expect(typeof study.studyBlur).toBe("function");
  const { blur } = await import("../tools/qr-scan-lab/sim.mjs");
  const img = {
    width: 9,
    height: 7,
    data: Uint8ClampedArray.from({ length: 9 * 7 * 4 }, (_, i) =>
      i % 4 === 3 ? 255 : (i * 47) % 256,
    ),
  };
  for (const sigma of [0.2, 0.48, 1.6, 2.4])
    expect(study.studyBlur(img, sigma)).toEqual(blur(img, sigma));
});

test("the accelerated study keeps production layout pixels and scan thresholds unchanged", async () => {
  const study = await import("../tools/cdx-qr-fit-study.mjs");
  expect(typeof study.fastRasterize).toBe("function");
  const { makeWoven, rasterize } = await import("../src/qr-craft/picture.js");
  const { readJsqr } = await import("../tools/qr-scan-lab/readers.mjs");
  const pic = gradient(60, 32);
  for (const center of ["small", "medium", "big"]) {
    const o = { text: "Fast QR fit", level: "H", center, contrast: 0.5, size: "fit", extra: 0.24 };
    const w = makeWoven(pic, o);
    for (const [ppm, quiet, blur] of [
      [8, 4, 0.2],
      [4, 4, 0.3],
      [390 / (w.code.size + 36), 18, 0],
    ]) {
      const old = rasterize(w, ppm, { quiet, blur });
      const fast = study.fastRasterize(w, ppm, { quiet, blur });
      expect(fast.width).toBe(old.width);
      expect(Buffer.compare(Buffer.from(fast.data), Buffer.from(old.data))).toBe(0);
    }
    const read = (data, width, height) => readJsqr({ data, width, height });
    const old = makeWoven(pic, o, read);
    const fast = study.makeStudyWoven(pic, o);
    expect(fast.margin).toBe(old.margin);
    expect(Buffer.compare(Buffer.from(fast.cells.buffer), Buffer.from(old.cells.buffer))).toBe(0);
  }
});

test("old QR recipe options preserve their original margin and style-dependent eyes", async () => {
  const { RECIPES: qr } = await import("../src/packs/qr.js");
  const { RECIPES: craft } = await import("../src/packs/qr-craft.js");
  const { resolveOptions } = await import("../src/player.js");
  const { pictureEyeChoices, pictureFitOptions } = await import("../src/qr/fit-options.js");
  expect(pictureEyeChoices("square").map((c) => c.id)).toEqual(["style"]);
  expect(pictureEyeChoices("circle").map((c) => c.id)).toEqual(["style", "square", "rounded"]);
  expect(pictureFitOptions({ shape: "square", eyeShape: "rounded", circleBorder: "thin" })).toEqual(
    { shape: "square", eyeShape: "style", circleBorder: "legacy" },
  );
  for (const recipe of [qr["qr-code"], craft["qr-picture"]]) {
    const options = resolveOptions(recipe, { shape: "circle" });
    expect(options.circleBorder).toBe("legacy");
    expect(options.eyeShape).toBe("style");
  }
});

for (const id of ["qr-code", "qr-picture"]) {
  test(`${id}: fitted borders and rounded eyes scan from the actual finished render`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/?renderer=webgl2&adapt=off&profile=mid&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(async (id) => {
      await window.__splashery.app.chooseToy(id);
      if (id === "qr-picture") window.__splashery.qrCraft.autoCheck = false;
      else window.__splashery.qr.autoCheck = false;
    }, id);
    for (const [shape, circleBorder, eyeShape] of [
      ["square", "legacy", id === "qr-picture" ? "style" : "rounded"],
      ["circle", "thin", "rounded"],
      ["circle", "thin", "square"],
    ]) {
      const text = "https://example.org/fit-your-picture";
      const shot = await page.evaluate(
        async ({ id, text, shape, circleBorder, eyeShape }) => {
          const { app, qr, qrCraft } = window.__splashery;
          await app.setToyOptions({
            text,
            shape,
            circleBorder,
            eyeShape,
            ...(id === "qr-picture" ? { size: "fit", level: "H" } : { ecc: "H" }),
            plate: "none",
          });
          if (id === "qr-picture") {
            if (qrCraft.picture().options.eyeShape !== eyeShape)
              throw new Error("The requested eye shape was not rendered.");
            await qrCraft.checkPicture();
            return qrCraft.lastShot();
          }
          if (qr.info().ecc !== "H" || qr.info().options.eyeShape !== eyeShape)
            throw new Error("The requested correction level or eye shape was not rendered.");
          await qr.check();
          return qr.lastShot();
        },
        { id, text, shape, circleBorder, eyeShape },
      );
      const img = PNG.sync.read(Buffer.from(shot.split(",")[1], "base64"));
      const phone = resize(img, 390);
      expect(readBoth(phone), `${id}/${shape}/${circleBorder}/${eyeShape}`).toEqual({
        jsqr: text,
        zxing: text,
      });
      expect(await readZxingCpp(phone)).toBe(text);
    }
    expect(errors).toEqual([]);
  });
}

test("a failed scan keeps QR options covered until a successful retry", async ({ page }) => {
  await page.goto("/?renderer=webgl2&adapt=off&profile=mid&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const result = await page.evaluate(async () => {
    const { app } = window.__splashery;
    await app.chooseToy("qr-code");
    const { qr } = window.__splashery;
    qr.autoCheck = false;
    await app.setToyOptions({ eyeShape: "style" });
    qr.autoCheck = true;
    // Fault injection tests the display guard; qualification tests use real pixels.
    const render = app.player.renderAt;
    app.player.renderAt = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 720;
      return canvas;
    };
    await app.setToyOptions({ text: "https://example.org/failed-scan" });
    const failed = await qr.check();
    const covered = app.player.stage.coverDepth > 0;
    const gif = await qr.gif({ size: 64, fps: 1, hold: 0.1 });
    await qr.fullScreen();
    const blocked = gif === null && !document.getElementById("qr-fullscreen");
    app.player.renderAt = render;
    const passed = await qr.check();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return {
      failed: failed.ok,
      covered,
      blocked,
      passed: passed.ok,
      uncovered: app.player.stage.coverDepth === 0,
    };
  });
  expect(result).toEqual({
    failed: false,
    covered: true,
    blocked: true,
    passed: true,
    uncovered: true,
  });
});

for (const id of ["qr-code", "qr-picture"]) {
  test(`${id}: leaving a failed scan releases only its own cover`, async ({ page }) => {
    await page.goto("/?renderer=webgl2&adapt=off&profile=mid&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    const covered = await page.evaluate(async (id) => {
      const { app } = window.__splashery;
      await app.chooseToy(id);
      const q = id === "qr-code" ? window.__splashery.qr : window.__splashery.qrCraft;
      q.autoCheck = false;
      await app.setToyOptions({ size: "fit" });
      q.autoCheck = true;
      const render = app.player.renderAt;
      app.player.renderAt = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 720;
        return canvas;
      };
      await app.setToyOptions({ text: "https://example.org/leave-failed-scan" });
      // A failed layout avoids the Picture QR stage's automatic nudge rebuilds.
      if (id === "qr-picture") q.picture().woven.cells.fill(1);
      if (id === "qr-code") await q.check();
      else await q.checkPicture();
      const held = app.player.stage.coverDepth > 0;
      app.player.renderAt = render;
      await app.player.stage.cover({ label: "Another operation" });
      await app.chooseToy("cactus");
      const otherCover = app.player.stage.coverDepth === 1;
      await app.player.stage.uncover();
      return { held, otherCover };
    }, id);
    expect(covered).toEqual({ held: true, otherCover: true });
    await page.waitForFunction(() => {
      const p = window.__splashery.app.player;
      return p.toyInfo.id === "cactus" && p.stage.coverDepth === 0 && !p.stage.coverEl;
    });
  });
}

test("Make it scan retries a Picture QR render that failed while its layout was valid", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&adapt=off&profile=mid&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const result = await page.evaluate(async () => {
    const { app } = window.__splashery;
    await app.chooseToy("qr-picture");
    const q = window.__splashery.qrCraft;
    q.autoCheck = false;
    await app.setToyOptions({ size: "fit", shape: "circle", circleBorder: "thin" });
    const render = app.player.renderAt;
    app.player.renderAt = async () => {
      const c = document.createElement("canvas");
      c.width = c.height = 720;
      return c;
    };
    const failed = await q.checkPicture();
    app.player.renderAt = render;
    await q.makeItScan();
    const checked = q.picture().check;
    return {
      initial: failed.stage.every((s) => s.ok),
      recovered: !!checked?.stage?.every((s) => s.ok),
    };
  });
  expect(result).toEqual({ initial: false, recovered: true });
});

test("mask 0 keeps the payload, version, correction level, and all strict layout checks", async () => {
  const { makeStudyWoven, fastRasterize } = await import("../tools/cdx-qr-fit-study.mjs");
  const { fitMaskWoven, codePicture } = await import("../src/qr-craft/fit.js");
  const { rasterize, SIZES } = await import("../src/qr-craft/picture.js");
  const { readJsqr } = await import("../tools/qr-scan-lab/readers.mjs");
  const options = {
    text: "https://example.org/mask-check",
    level: "H",
    size: "more",
    center: "small",
    style: "color",
    contrast: 0.5,
    extra: 0.24,
    shape: "circle",
    pictureFit: "circle",
    quiet: 0,
  };
  const pic = gradient(80, 40);
  const initial = makeStudyWoven(pic, options);
  const source = codePicture(pic, options, initial.code.size);
  const old = makeStudyWoven(source, options);
  const read = (data, width, height) => readJsqr({ data, width, height });
  const actual = fitMaskWoven(old, source, options, read);
  const accelerated = fitMaskWoven(old, source, options, read, fastRasterize);
  expect(actual.code.mask).toBe(0);
  expect([actual.code.text, actual.code.version, actual.code.ecc]).toEqual([
    old.code.text,
    old.code.version,
    old.code.ecc,
  ]);
  expect(actual.margin).toBeGreaterThanOrEqual(old.margin);
  expect(actual.margin).toBeLessThanOrEqual(0.5);
  expect(actual.margin).toBe(accelerated.margin);
  expect(Buffer.from(actual.cells.buffer).equals(Buffer.from(accelerated.cells.buffer))).toBe(true);
  for (const size of [...SIZES, { ppm: 8, blur: 0.3 }, { ppm: 4, blur: 0.3 }]) {
    expect(readJsqr(rasterize(actual, size.ppm, { blur: size.blur }))).toBe(options.text);
  }
});

test("a stale successful QR scan cannot uncover a newer build", async ({ page }) => {
  await page.goto("/?renderer=webgl2&adapt=off&profile=mid&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const result = await page.evaluate(async () => {
    const { app } = window.__splashery;
    await app.chooseToy("qr-code");
    const { qr } = window.__splashery;
    qr.autoCheck = false;
    await app.setToyOptions({ text: "https://example.org/stale-check", style: "classic" });
    await qr.check();
    const image = new Image();
    image.src = qr.lastShot();
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 720;
    canvas.getContext("2d").drawImage(image, 0, 0);
    let enter, release;
    const entered = new Promise((r) => (enter = r));
    const gate = new Promise((r) => (release = r));
    const render = app.player.renderAt;
    let first = true;
    app.player.renderAt = async () => {
      if (first) {
        first = false;
        enter();
        await gate;
      }
      return canvas;
    };
    qr.autoCheck = true;
    await app.setToyOptions({ eyeShape: "square" });
    const pending = qr.check();
    await entered;
    await app.setToyOptions({ eyeShape: "rounded" });
    qr.autoCheck = false;
    release();
    await pending;
    const protectedNewBuild = app.player.stage.coverDepth > 0 && qr.info().check === null;
    app.player.renderAt = render;
    qr.autoCheck = true;
    const passed = await qr.check();
    return { protectedNewBuild, passed: passed.ok, uncovered: app.player.stage.coverDepth === 0 };
  });
  expect(result).toEqual({ protectedNewBuild: true, passed: true, uncovered: true });
});
