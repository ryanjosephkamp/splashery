import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { RECIPES } from "../src/packs/qr-craft.js";
import { encodeQR } from "../src/qr/encode.js";
import { gray } from "../src/qr-craft/picture.js";
import { resolveOptions } from "../src/player.js";
import { readBoth } from "../tools/cdx-circle-study.mjs";
import { resize } from "../tools/qr-scan-lab/sim.mjs";

const TEXT = "https://ryanjosephkamp.github.io/splashery/";

test("a circular code without a picture preserves every module within 8,000 splats", async () => {
  const recipe = RECIPES["qr-picture"];
  // Lane PIC2: Picture QR now opens at the biggest size; this budget check keeps the size it was
  // recorded at (the biggest code's unread weave, with no scan step in Node, leaves some module
  // centers to error correction, on main as here).
  const options = resolveOptions(recipe, { shape: "circle", picture: "own", text: TEXT, size: "more" }); // prettier-ignore
  await recipe.prepare?.(options);
  const splats = [];
  const kit = {
    count: 8000,
    reach() {},
    cloud(_options, get) {
      for (let i = 0; i < this.count; i++) {
        const splat = get(() => 0.5, i);
        if (splat) splats.push(splat);
      }
    },
  };
  recipe.build(kit, options);
  expect(splats.length).toBeLessThanOrEqual(8000);
  const modules = new Set(splats.filter((s) => s.params[0] > 0).map((s) => s.params[0] - 1));
  expect(modules.size).toBe(kit.data.size ** 2);
  const code = encodeQR(TEXT, options.level, { boost: false, mask: 0, min: kit.data.version });
  expect(code.size).toBe(kit.data.size);
  const wrongBits = splats.filter((s) => {
    if (!(s.params[0] > 0)) return false;
    const dark = code.dark[s.params[0] - 1];
    return s.params[1] !== (dark ? 2 : 1) || gray(s.color) < 0.5 !== Boolean(dark);
  });
  expect(wrongBits).toHaveLength(0);
  expect(splats.every((s) => s.p.every(Number.isFinite))).toBe(true);
  expect(() => recipe.build({ ...kit, count: 1 }, options)).toThrow(/too much detail/);
});

test("the small no-picture code decodes through both readers at phone and print size", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?renderer=webgl2&adapt=off&profile=mid&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async (text) => {
    const { RECIPES } = await import("/src/packs/qr-craft.js");
    const recipe = RECIPES["qr-picture"],
      build = recipe.build;
    recipe.build = (kit, options) => {
      if (options.shape === "circle" && options.picture === "own")
        kit.count = Math.min(kit.count, 8000);
      return build(kit, options);
    };
    const a = window.__splashery.app;
    await a.chooseToy("qr-picture");
    window.__splashery.qrCraft.autoCheck = false;
    await a.setToyOptions({ shape: "circle", picture: "own", text, size: "more" });
  }, TEXT);
  await page.waitForFunction(() => !window.__splashery.app.busy);
  const capture = await page.evaluate(async () => {
    const q = window.__splashery.qrCraft;
    await q.checkPicture();
    return { shot: q.lastShot(), count: window.__splashery.player.proc.ctx.kit.buf.count };
  });
  expect(capture.count).toBeLessThanOrEqual(8000);
  const img = PNG.sync.read(Buffer.from(capture.shot.split(",")[1], "base64"));
  expect(readBoth(img)).toEqual({ jsqr: TEXT, zxing: TEXT });
  expect(readBoth(resize(img, 390))).toEqual({ jsqr: TEXT, zxing: TEXT });
});
