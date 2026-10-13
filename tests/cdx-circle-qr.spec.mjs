import { test, expect } from "@playwright/test";
import { encodeQR } from "../src/qr/encode.js";
import { buildCode } from "../src/qr/build.js";
import { RECIPES as QR } from "../src/packs/qr.js";
import { RECIPES as CRAFT } from "../src/packs/qr-craft.js";
import fs from "node:fs";
import { PNG } from "pngjs";
import { GifReader } from "../vendor/omggif/omggif.js";
import { readBoth, rasterCircle } from "../tools/cdx-circle-study.mjs";
import { resize } from "../tools/qr-scan-lab/sim.mjs";
import { circleLayout, shapeHalf, CIRCLE_QUIET } from "../src/qr/circle.js";
import { buildPieces } from "../src/qr-craft/pieces.js";

const TEXT = "https://example.org/circular-qr";
const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const png = (url) => PNG.sync.read(Buffer.from(url.split(",")[1], "base64"));
const expectReads = (img) => expect(readBoth(img)).toEqual({ jsqr: TEXT, zxing: TEXT });

async function open(page, id, options = {}) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(
    async ({ id, options }) => {
      const a = window.__splashery.app;
      await a.chooseToy(id);
      if (window.__splashery.qrCraft) window.__splashery.qrCraft.autoCheck = false;
      if (window.__splashery.qrLab) window.__splashery.qrLab.autoCheck = false;
      await a.setToyOptions({
        shape: "circle",
        text: "https://example.org/circular-qr",
        ...options,
      });
    },
    { id, options },
  );
  await page.waitForFunction(() => !window.__splashery.app.busy);
}

test("circle decoration stays outside the quiet zone and matches the code's balance", async () => {
  const circle = await import("../src/qr/circle.js").catch(() => ({}));
  expect(typeof circle.circleLayout).toBe("function");
  for (let i = 0; i < 20; i++) {
    const code = encodeQR(`https://example.org/circle/${i}?text=${"q".repeat(i * 5)}`, "M");
    const layout = circle.circleLayout(code);
    expect(layout.quiet).toBeGreaterThanOrEqual(2);
    const unsafe = layout.dots.filter(
      (d) =>
        Math.max(Math.abs(d.x), Math.abs(d.y)) - 0.5 < code.size / 2 + layout.quiet ||
        Math.hypot(d.x, d.y) + Math.SQRT1_2 >= layout.half - 0.6 ||
        !layout.dark(d.row, d.col),
    );
    expect(unsafe).toEqual([]);
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
    ]) {
      const finders = layout.dots.filter(
        (d) =>
          [-3, -1, 0, 1, 3].every((i) => layout.dark(d.row + i * dr, d.col + i * dc)) &&
          [-4, -2, 2, 4].every((i) => !layout.dark(d.row + i * dr, d.col + i * dc)),
      );
      expect(finders).toEqual([]);
    }
    const balance = code.dark.reduce((a, b) => a + b, 0) / code.dark.length;
    expect(Math.abs(layout.dots.length / layout.candidates - balance)).toBeLessThan(0.025);
  }
});

test("the margin study covers every trial and keeps the standard margin when no candidate passes", () => {
  const study = JSON.parse(fs.readFileSync("docs/audits/circular-qr-2026-10-study.json"));
  expect(study.links).toHaveLength(20);
  expect(study.rows.map((r) => r.quiet)).toEqual([1, 2, 3, 4]);
  expect(study.rows.every((r) => r.trials === 640)).toBe(true);
  if (study.selected === null) {
    expect(study.rows.every((r) => r.both < r.trials)).toBe(true);
    expect(CIRCLE_QUIET).toBe(4);
  } else {
    expect(study.selected).toBe(CIRCLE_QUIET);
    const selected = study.rows.find((r) => r.quiet === study.selected);
    expect(selected?.both).toBe(640);
  }
});

test("changing or removing decoration preserves all encoded modules and text", () => {
  for (const ecc of ["L", "M", "Q", "H"]) {
    const code = encodeQR(TEXT, ecc, { boost: false });
    const original = Array.from(code.dark);
    for (const decoration of [true, false])
      expectReads(rasterCircle(code, CIRCLE_QUIET, 390, decoration));
    circleLayout(code);
    expect(Array.from(code.dark)).toEqual(original);
  }
});

test("large circular Picture QR builds without overflowing an argument list", async () => {
  const { resolveOptions } = await import("../src/player.js");
  const recipe = CRAFT["qr-picture"];
  const options = resolveOptions(recipe, { shape: "circle", text: "a".repeat(300), level: "H" });
  let count = 0;
  const modules = new Set();
  const kit = {
    count: 240000,
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
  expect(() => recipe.build(kit, options)).not.toThrow();
  expect(count).toBeGreaterThan(0);
  expect(kit.data.size).toBeGreaterThan(65);
  expect(modules.size).toBe(kit.data.size ** 2);
});

test("circular marbles retain complete decoration within the phone budget", () => {
  const code = encodeQR(
    "ybutmzixqxsrgrmfmdoxqhsjsrkbwtuperipmlqzotarivmlqxqpgvcxcrqtsfunyxmpepqlalwjixwbijcbupsnspexwnijmtgp",
    "H",
  );
  expect(code.size).toBe(57);
  const made = buildPieces(code, "marbles", 120000, { shape: "circle" });
  expect(made.splats.length).toBeLessThanOrEqual(120000);
  const dots = circleLayout(code).dots;
  expect(made.layout.filter((m) => m.decoration)).toHaveLength(dots.length);
  expect(made.splats.every((s) => s.p.every(Number.isFinite))).toBe(true);
});

test("Circle Picture QR handles overlong saved text with its existing fallback", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page, "qr-picture", { text: "a".repeat(1400), level: "H", size: "fit" });
  const info = await page.evaluate(() => {
    const p = window.__splashery.qrCraft.picture();
    return { text: p.woven.code.text, shape: p.options.shape, error: p.error };
  });
  expect(info.shape).toBe("circle");
  expect(info.error).toContain("too long");
  expect(info.text).toBe("https://ryanjosephkamp.github.io/splashery/");
  expect(errors).toEqual([]);
});

test("Circle QR keeps its shape and text in PNG, GIF, and scene recipe exports", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "qr-code", { style: "classic", ecc: "M", plate: "none" });
  const result = await page.evaluate(async () => {
    const q = window.__splashery.qr;
    const png = await q.png(390);
    const gif = await q.gif({ size: 390, fps: 2, hold: 0.5 });
    const data = async (b) => Array.from(new Uint8Array(await b.arrayBuffer()));
    return { png: await data(png), gif: await data(gif), options: q.info().options };
  });
  expect(result.options.shape).toBe("circle");
  const img = PNG.sync.read(Buffer.from(result.png));
  expectReads(img);
  const reader = new GifReader(Buffer.from(result.gif));
  const rgba = new Uint8ClampedArray(reader.width * reader.height * 4);
  reader.decodeAndBlitFrameRGBA(reader.numFrames() - 1, rgba);
  expectReads({ width: reader.width, height: reader.height, data: rgba });
  await page.screenshot({ path: "tests/screenshots/cdx-circle-qr-code-390x844.png" });
  const recipe = await page.evaluate(async () => {
    const a = window.__splashery.app;
    const s = a.exportScene();
    return JSON.parse(JSON.stringify(s));
  });
  expect(JSON.stringify(recipe)).toContain('"shape":"circle"');
});

for (const id of ["qr-picture", "qr-build"]) {
  test(`${id}: its complete circular splat render scans at phone and print size`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, id, {
      material: "tiles",
      level: "M",
      contrast: 0.8,
      size: "fit",
      center: "big",
    });
    const shot = await page.evaluate(async (id) => {
      const q = window.__splashery.qrCraft;
      if (id === "qr-picture") {
        await q.checkPicture();
        return q.lastShot();
      }
      await q.checkBuild();
      return q.lastBuildShot();
    }, id);
    const img = png(shot);
    expectReads(resize(img, 390));
    expectReads(img);
    await page.screenshot({ path: `tests/screenshots/cdx-circle-${id}-390x844.png` });
  });
}

test("Circle marbles also scan from their complete finished splat render", async ({ page }) => {
  await open(page, "qr-build", { material: "marbles", level: "M" });
  const shot = await page.evaluate(async () => {
    const q = window.__splashery.qrCraft;
    await q.checkBuild();
    return q.lastBuildShot();
  });
  expectReads(resize(png(shot), 390));
});

for (const id of ["qr-anatomy", "qr-damage"]) {
  test(`${id}: the circle and its decoration preserve the decoded text`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, id, { view: "encode", step: "done", level: "M", damage: "", compare: false });
    for (const decorationDamage of id === "qr-damage" ? [false, true] : [false]) {
      if (decorationDamage)
        await page.evaluate(() => window.__splashery.app.setToyOptions({ decorationDamage: true }));
      const shot = await page.evaluate(async (id) => {
        const { app, qrLab } = window.__splashery;
        const half = id === "qr-anatomy" ? qrLab.anatomy().circle.half : qrLab.damage().layout.half;
        return app.withCapture([390, 390], async () => {
          const pose = qrLab.frontPose(half, 1.5);
          await app.player.renderAt(app.player.time, pose);
          const image = await app.player.renderAt(app.player.time, pose);
          return image.toDataURL("image/png");
        });
      }, id);
      expectReads(png(shot));
    }
    await page.screenshot({ path: `tests/screenshots/cdx-circle-${id}-390x844.png` });
  });
}

test("QR and craft recipes offer Square and Circle and build the circular extent", async () => {
  for (const id of ["qr-code", "qr-picture", "qr-build"]) {
    const shape = (QR[id] || CRAFT[id]).options.find((o) => o.key === "shape");
    expect(
      shape?.choices.map((c) => c.id),
      id,
    ).toEqual(["square", "circle"]);
    expect(shape.default).toBe("square");
  }
  const code = encodeQR("https://example.org/circle/", "M");
  const square = buildCode(code, { style: "classic", shape: "square", plate: "none" });
  const round = buildCode(code, { style: "classic", shape: "circle", plate: "none" });
  expect(round.half).toBeGreaterThan(square.half * 1.3);
  expect(round.splats.some((s) => Math.abs(s.p[0]) > square.half + 1 && s.color[0] < 0.2)).toBe(
    true,
  );
});
