// Lane Viewers: the Splat toolkit and Point clouds (docs/handoff/Viewers.md). The readers, writers
// and edits are checked on small files of our own: splat balls from tests/fixtures.mjs (and their
// compressed PLY and SOG, made by splat-transform), and seeded point patches from
// tools/vwr-fixtures.mjs (tests/fixtures/vwr/). The toys are checked in the browser, where the work
// runs in a worker (LAZ and SOG read there).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { makePly, makeSplat, makeSpz } from "./fixtures.mjs";
import * as io from "../src/viewers/splat-io.js";
import * as ops from "../src/viewers/splat-ops.js";
import * as cio from "../src/viewers/cloud-io.js";
import * as cops from "../src/viewers/cloud-ops.js";
import { getWebp, withStrays } from "../src/viewers/engine.js";
import { TOYS } from "../src/toys.js";
import { RECIPES } from "../src/packs/viewers.js";
import { TOY_HELP } from "../src/toy-help.js";
import { toySound } from "../src/toy-sounds.js";

const FIX = "tests/fixtures/vwr";
const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const bytes = (f) => new Uint8Array(fs.readFileSync(path.join(FIX, f)));
const u8 = (b) => new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
const truth = JSON.parse(fs.readFileSync(path.join(FIX, "patch.json"), "utf8"));
const N = 2000;

// The splat nearest each of t's first `m` splats in u (files may reorder splats).
function nearestPairs(t, u, m = 200) {
  const out = [];
  for (let i = 0; i < m; i++) {
    let best = -1;
    let bd = Infinity;
    for (let j = 0; j < u.count; j++) {
      const d = (t.x[i] - u.x[j]) ** 2 + (t.y[i] - u.y[j]) ** 2 + (t.z[i] - u.z[j]) ** 2;
      if (d < bd) {
        bd = d;
        best = j;
      }
    }
    out.push([i, best, Math.sqrt(bd)]);
  }
  return out;
}
const maxDiff = (a, b, pairs, f) => Math.max(...pairs.map(([i, j]) => Math.abs(a[f][i] - b[f][j])));

test.describe("splat files", () => {
  let ball;
  test.beforeAll(async () => {
    ball = await io.readSplatFile(u8(makePly(N)), "ball.ply");
  });

  test("a PLY opens with its splats", async () => {
    expect(ball.count).toBe(N);
    expect(ball.shDegree).toBe(0);
    const b = io.boundsOf(ball);
    for (let k = 0; k < 3; k++) expect(b.max[k]).toBeLessThanOrEqual(0.5001);
    expect(ball.s0[0]).toBeCloseTo(Math.log(0.03), 4);
  });

  test("a .splat opens, matching the PLY", async () => {
    const t = await io.readSplatFile(u8(makeSplat(N)), "ball.splat");
    expect(t.count).toBe(N);
    for (const f of ["x", "y", "z", "s0"]) expect(maxDiff(ball, t, nearestPairs(ball, t), f)).toBeLessThan(1e-5); // prettier-ignore
  });

  test("an SPZ (version 2) opens, turned from its right-up-back axes", async () => {
    const t = await io.readSplatFile(u8(makeSpz(N)), "ball.spz");
    expect(t.count).toBe(N);
    // SPZ keeps y and z the other way round: flip back to compare.
    const back = io.flipYZ(
      io.pick(
        t,
        Uint32Array.from({ length: N }, (_, i) => i),
      ),
    );
    const pairs = nearestPairs(ball, back);
    expect(Math.max(...pairs.map((p) => p[2]))).toBeLessThan(0.001);
  });

  test("a compressed PLY (from splat-transform) opens", async () => {
    const t = await io.readSplatFile(bytes("ball.compressed.ply"), "ball.compressed.ply");
    expect(t.count).toBe(N);
    expect(t.compressed).toBe(true);
    const pairs = nearestPairs(ball, t);
    expect(Math.max(...pairs.map((p) => p[2]))).toBeLessThan(0.002);
    expect(maxDiff(ball, t, pairs, "s0")).toBeLessThan(0.01);
  });

  test("a SOG (from splat-transform) opens", async () => {
    const t = await io.readSplatFile(bytes("ball.sog"), "ball.sog", { getWebp });
    expect(t.count).toBe(N);
    const pairs = nearestPairs(ball, t);
    expect(Math.max(...pairs.map((p) => p[2]))).toBeLessThan(0.001);
    expect(maxDiff(ball, t, pairs, "r")).toBeLessThan(0.05);
  });

  test("SPZ version 4 is refused with a clear message", async () => {
    const v4 = new Uint8Array(32);
    new DataView(v4.buffer).setUint32(0, 0x5053474e, true);
    new DataView(v4.buffer).setUint32(4, 4, true);
    await expect(io.readSplatFile(v4, "x.spz")).rejects.toThrow(/version 4/);
  });

  test("every save format round-trips", async () => {
    for (const fmt of ["ply", "splat", "spz", "sog"]) {
      const b = await io.writeSplatFile(ball, fmt, { getWebp });
      const t = await io.readSplatFile(b, `x.${fmt}`, { getWebp });
      expect(t.count, fmt).toBe(N);
      const pairs = nearestPairs(ball, t);
      expect(Math.max(...pairs.map((p) => p[2])), fmt).toBeLessThan(fmt === "ply" ? 1e-7 : 0.001);
      expect(maxDiff(ball, t, pairs, "r"), fmt).toBeLessThan(fmt === "ply" ? 1e-6 : 0.06);
      expect(maxDiff(ball, t, pairs, "s1"), fmt).toBeLessThan(fmt === "ply" ? 1e-6 : 0.04);
    }
  });

  test("splat-transform reads what the toolkit saves", async () => {
    const dir = fs.mkdtempSync("/tmp/vwr-");
    const st = "node_modules/@playcanvas/splat-transform/bin/cli.mjs";
    for (const fmt of ["ply", "sog"]) {
      fs.writeFileSync(path.join(dir, `a.${fmt}`), await io.writeSplatFile(ball, fmt, { getWebp }));
      execFileSync("node", [st, "-w", "-g", "cpu", path.join(dir, `a.${fmt}`), path.join(dir, `b-${fmt}.ply`)], { stdio: "ignore" }); // prettier-ignore
      const t = await io.readSplatFile(new Uint8Array(fs.readFileSync(path.join(dir, `b-${fmt}.ply`))), "b.ply"); // prettier-ignore
      expect(t.count, fmt).toBe(N);
      expect(Math.max(...nearestPairs(ball, t).map((p) => p[2])), fmt).toBeLessThan(0.001);
    }
    fs.rmSync(dir, { recursive: true });
  });
});

test.describe("splat edits", () => {
  let ball;
  test.beforeAll(async () => {
    ball = await io.readSplatFile(u8(makePly(N)), "ball.ply");
  });

  test("crop keeps exactly the splats inside the box (or outside it)", () => {
    const box = { min: [-0.1, -1, -1], max: [0.2, 0.3, 1] };
    const inside = ops.cropIndex(ball, box);
    const outside = ops.cropIndex(ball, box, { invert: true });
    expect(inside.length + outside.length).toBe(N);
    let expected = 0;
    for (let i = 0; i < N; i++)
      if (ball.x[i] >= -0.1 && ball.x[i] <= 0.2 && ball.y[i] <= 0.3) expected++;
    expect(inside.length).toBe(expected);
    for (const i of inside) expect(ball.x[i] >= -0.1 && ball.x[i] <= 0.2 && ball.y[i] <= 0.3).toBe(true); // prettier-ignore
  });

  test("the floater filter removes stray splats and keeps the surface", () => {
    const t = withStrays(ball, 0.02);
    const strays = t.count - N;
    const idx = Uint32Array.from({ length: t.count }, (_, i) => i);
    const r = ops.floaterFilter(t, idx, { k: 8, strength: 3 });
    const caught = [...r.removed].filter((i) => i >= N).length;
    // A sparse ball of 2,000: a few strays land near its shell and are fair neighbors.
    expect(caught / strays).toBeGreaterThan(0.85);
    const lost = [...r.removed].filter((i) => i < N).length;
    expect(lost / N).toBeLessThan(0.02);
    // Lower strength removes more.
    expect(ops.floaterFilter(t, idx, { k: 8, strength: 1 }).removed.length).toBeGreaterThan(r.removed.length); // prettier-ignore
  });

  test("shrink keeps the asked count, the most visible splats first", () => {
    const t = io.pick(
      ball,
      Uint32Array.from({ length: N }, (_, i) => i),
    );
    for (let i = 0; i < N; i += 2) t.opacity[i] = -6; // every other splat nearly invisible
    const idx = Uint32Array.from({ length: N }, (_, i) => i);
    const keep = ops.decimateIndex(t, idx, 1000);
    expect(keep.length).toBeGreaterThan(950);
    expect(keep.length).toBeLessThanOrEqual(1000);
    const faint = [...keep].filter((i) => i % 2 === 0).length;
    expect(faint / keep.length).toBeLessThan(0.1);
  });

  test("the pipeline crops, filters and shrinks in that order", () => {
    const t = withStrays(ball, 0.02);
    const r = ops.runPipeline(t, {
      crop: { min: [-0.6, -0.6, -0.6], max: [0.6, 0.6, 0.6] },
      floaters: { k: 8, strength: 3 },
      target: 500,
    });
    expect(r.cropped).toBeGreaterThan(0);
    expect(r.removed.length).toBeGreaterThan(0);
    expect(r.keep.length).toBeLessThanOrEqual(500);
  });
});

test.describe("point cloud files", () => {
  const check = (c, exact = true) => {
    expect(c.count).toBe(truth.count);
    for (let i = 0; i < 20; i++) {
      expect(c.x[i] + c.origin[0]).toBeCloseTo(truth.x[i], 2);
      expect(c.y[i] + c.origin[1]).toBeCloseTo(truth.y[i], 2);
      expect(c.z[i] + c.origin[2]).toBeCloseTo(truth.z[i], 2);
      if (exact) {
        expect(c.intensity[i]).toBe(truth.intensity[i]);
        expect(c.cls[i]).toBe(truth.cls[i]);
        expect(c.r[i]).toBe(truth.red8[i]);
      }
    }
  };

  test("LAS 1.2 (point format 3) and LAS 1.4 (format 7) open", () => {
    const a = cio.readLas(bytes("patch12.las"));
    expect(a.info.version).toBe("1.2");
    expect(a.info.pointFormat).toBe(3);
    check(a);
    const b = cio.readLas(bytes("patch14.las"));
    expect(b.info.version).toBe("1.4");
    expect(b.info.pointFormat).toBe(7);
    check(b);
  });

  test("XYZ, PTS and a text PLY open", async () => {
    const rows = JSON.parse(fs.readFileSync(path.join(FIX, "points.json"), "utf8"));
    for (const f of ["points.xyz", "points.pts", "points-ascii.ply"]) {
      const c = await cio.readCloudFile(bytes(f), f);
      expect(c.count, f).toBe(500);
      for (let i = 0; i < rows.length; i++) {
        expect(c.x[i] + c.origin[0], f).toBeCloseTo(rows[i][0], 3);
        expect(c.z[i] + c.origin[2], f).toBeCloseTo(rows[i][2], 3);
        expect(c.r[i], f).toBe(rows[i][3]);
        expect(c.b[i], f).toBe(rows[i][5]);
      }
    }
    // PTS has intensity in -2048..2047.
    const pts = await cio.readCloudFile(bytes("points.pts"), "points.pts");
    expect(pts.intensity[0]).toBe(0);
  });

  test("LAS, PLY and XYZ saves round-trip", async () => {
    const c = cio.readLas(bytes("patch12.las"));
    for (const fmt of ["las", "ply", "xyz"]) {
      const back = await cio.readCloudFile(cio.writeCloudFile(c, fmt), `x.${fmt}`);
      expect(back.count, fmt).toBe(c.count);
      for (let i = 0; i < 20; i++) {
        expect(back.x[i] + back.origin[0], fmt).toBeCloseTo(c.x[i] + c.origin[0], 2);
        expect(back.y[i] + back.origin[1], fmt).toBeCloseTo(c.y[i] + c.origin[1], 2);
        expect(back.r[i], fmt).toBe(c.r[i]);
        if (fmt !== "xyz") expect(back.cls[i], fmt).toBe(c.cls[i]);
        expect(back.intensity[i], fmt).toBe(c.intensity[i]);
      }
    }
  });

  test("crop and thin do what they say", () => {
    const c = cio.readLas(bytes("patch12.las"));
    const box = { min: [-10, -100, -100], max: [10, 100, 100] };
    const kept = cops.cropCloud(c, box);
    for (const i of kept) expect(Math.abs(c.x[i])).toBeLessThanOrEqual(10);
    let inside = 0;
    for (let i = 0; i < c.count; i++) if (c.x[i] >= -10 && c.x[i] <= 10) inside++;
    expect(kept.length).toBe(inside);
    const all = Uint32Array.from({ length: c.count }, (_, i) => i);
    const thin = cops.thinCloud(c, all, 5);
    expect(thin.length).toBeLessThan(c.count / 3);
    // One point per 5-unit cube.
    const cells = new Set();
    const b = cio.cloudBounds(c);
    for (const i of thin) {
      const key = [c.x[i], c.y[i], c.z[i]].map((v, k) => Math.floor((v - b.min[k]) / 5)).join(",");
      expect(cells.has(key)).toBe(false);
      cells.add(key);
    }
  });

  test("colors by class, intensity and height, and a measured distance", () => {
    const c = cio.readLas(bytes("patch12.las"));
    const idx = Uint32Array.from({ length: 10 }, (_, i) => i);
    const byClass = cops.cloudColors(c, idx, "class");
    expect(byClass.mode).toBe("class");
    expect([...byClass.col.slice(0, 3)].map((v) => +v.toFixed(2))).toEqual(cops.CLASS_COLORS[2]); // ground
    expect(cops.cloudColors(c, idx, "intensity").mode).toBe("intensity");
    const m = cops.measure([0, 0, 0], [3, 4, 12]);
    expect(m.straight).toBeCloseTo(13, 6);
    expect(m.flat).toBeCloseTo(5, 6);
    expect(m.rise).toBe(12);
  });
});

test.describe("the toys", () => {
  test("both are labs toys on the Studio shelf, with help, sound and a tap", () => {
    for (const id of ["splat-toolkit", "point-clouds"]) {
      const t = TOYS.find((x) => x.id === id);
      expect(t.category).toBe("studio");
      expect(t.labs).toBe(true);
      expect(RECIPES[id].action).toBeTruthy();
      expect(TOY_HELP[id].howTo.length).toBeGreaterThan(20);
      expect(TOY_HELP[id].about.length).toBeGreaterThan(200);
      expect(toySound(id)).toBeTruthy();
    }
  });

  test("the toolkit opens a SOG, removes floaters, and saves a file that reads back", async ({
    page,
  }) => {
    await page.goto(APP);
    await page.evaluate(() => window.__splashery.app.chooseToy("splat-toolkit"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.toolkit?.main, null, { timeout: 120000 }); // prettier-ignore
    // Open the SOG through the Toy tab's file button (read in the worker with the WebP codec).
    await page.setInputFiles("#toy-input-file", path.join(FIX, "ball.sog"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.toolkit?.stats?.name === "ball.sog", null, { timeout: 120000 }); // prettier-ignore
    const st = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.toolkit);
    expect(st.stats.count).toBe(N);
    expect(st.stats.format).toBe("sog");
    await page.evaluate(() => window.__splashery.app.setToyOptions({ floaters: true, strength: 0.6, show: "removed", keep: 50 })); // prettier-ignore
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.toolkit?.main?.counts?.removed > 0, null, { timeout: 120000 }); // prettier-ignore
    const after = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.toolkit.main.counts); // prettier-ignore
    expect(after.kept).toBeLessThanOrEqual(Math.round(N * 0.5));
    await page.selectOption("#vwr-save-format", "spz");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#vwr-save")]);
    const file = await dl.path();
    const back = await io.readSplatFile(
      new Uint8Array(fs.readFileSync(file)),
      dl.suggestedFilename(),
    );
    expect(back.count).toBe(after.kept);
  });

  test("Point clouds opens a LAZ in its worker, colors it, and measures two taps", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(APP);
    await page.evaluate(() => window.__splashery.app.chooseToy("point-clouds"));
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.cloud?.counts, null, { timeout: 120000 }); // prettier-ignore
    for (const f of ["patch14.laz", "patch12.laz"]) {
      await page.setInputFiles("#toy-input-file", path.join(FIX, f));
      await page.waitForFunction((f) => window.__splashery.player.proc?.ctx?.kit?.data?.cloud?.stats?.name === f, f, { timeout: 120000 }); // prettier-ignore
      const s = await page.evaluate(() => window.__splashery.player.proc.ctx.kit.data.cloud.stats);
      expect(s.count, f).toBe(truth.count);
      expect(s.format, f).toBe("laz");
      expect(s.classes["6"], f).toBe(truth.count / 5);
      expect(s.bounds.size[0], f).toBeCloseTo(truth.max[0] - truth.min[0], 1);
    }
    await page.evaluate(() => window.__splashery.app.setToyOptions({ measure: true, color: "intensity" })); // prettier-ignore
    await page.waitForTimeout(1500);
    const box = await page.locator("canvas").first().boundingBox();
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5);
    await page.waitForFunction(() => !!window.__splashery.player.scene.toy.options.pinA, null, { timeout: 60000 }); // prettier-ignore
    await page.waitForTimeout(1500);
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.55);
    await page.waitForFunction(() => !!window.__splashery.player.scene.toy.options.pinB, null, { timeout: 60000 }); // prettier-ignore
    await page.waitForTimeout(1500);
    const o = await page.evaluate(() => window.__splashery.player.scene.toy.options);
    const a = o.pinA.split(",").map(Number);
    const b = o.pinB.split(",").map(Number);
    const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    expect(d).toBeGreaterThan(0.5);
    await expect(page.locator("#vwr-distance")).toContainText(
      `Distance: ${d >= 10 ? d.toFixed(1) : d.toFixed(2)}`,
    );
  });

  test("screenshots", async ({ page }) => {
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      // prettier-ignore
      await page.setViewportSize({ width: w, height: h });
      await page.goto(APP);
      await page.evaluate(() => window.__splashery.app.chooseToy("splat-toolkit"));
      await page.evaluate(() => window.__splashery.app.setToyOptions({ source: "cactus-stray", floaters: true, show: "removed" })); // prettier-ignore
      await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.toolkit?.main?.counts?.removed > 0, null, { timeout: 120000 }); // prettier-ignore
      await page.waitForTimeout(800);
      await page.screenshot({ path: `tests/screenshots/vwr-splat-toolkit-${w}x${h}.png` });
      await page.evaluate(() => window.__splashery.app.chooseToy("point-clouds"));
      await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.cloud?.counts, null, { timeout: 120000 }); // prettier-ignore
      await page.waitForTimeout(800);
      await page.screenshot({ path: `tests/screenshots/vwr-point-clouds-${w}x${h}.png` });
    }
  });
});
