// Lane Manual: the splat equation toy's reader (no browser), the toy in the
// app (typing, links, bad input), the Tinkerer's Manual page, and the
// lane's screenshots (man-*.png).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  PRESETS,
  FIELDS,
  RECIPES,
  readExpr,
  readRange,
  readStatements,
  compileProgram,
  programText,
} from "../src/packs/splat-equation.js";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { normalizeOptions } from "../src/state.js";

const fails = (fn, match) => {
  let err = null;
  try {
    fn();
  } catch (e) {
    err = e;
  }
  expect(err, "expected an error").not.toBeNull();
  if (match) expect(err.message).toMatch(match);
  return err;
};
const at = (e, u, v, t = 0) => e.f({ θ: u, y: v, t });

test.describe("the splat equation reader", () => {
  test("u, v and t read as themselves", () => {
    expect(at(readExpr("u + 10v + 100t"), 1, 2, 3)).toBe(321);
    expect(at(readExpr("cos u sin v"), 0, Math.PI / 2)).toBeCloseTo(1, 12);
    expect(at(readExpr("2uv"), 3, 4)).toBe(24);
    expect(at(readExpr("exp(u) + max(u, v)"), 0, 5)).toBe(6);
    const used = readExpr("sin(u) + t").used;
    expect(used).toEqual({ u: true, v: false, t: true });
  });

  test("ranges", () => {
    expect(readRange("0 .. 2pi")).toEqual([0, 2 * Math.PI]);
    expect(readRange("0 ... 2pi")).toEqual([0, 2 * Math.PI]);
    expect(readRange("-1 to 1")).toEqual([-1, 1]);
    expect(readRange("0, pi")).toEqual([0, Math.PI]);
    fails(() => readRange("0"), /two numbers/);
    fails(() => readRange("1 .. 1"), /the same/);
    fails(() => readRange("0 .. u"), /“u” can't be used here/);
  });

  test("messages talk about u, v and t, not the reader's own letters", () => {
    fails(
      () => readExpr("x + u"),
      /^That can't be drawn: “x” can't be used here\. Use u, v and t\.$/,
    );
    fails(() => readExpr("y"), /“y” can't be used here/);
    fails(() => readExpr("θ + 1"), /“θ” can't be used here/);
    fails(() => readExpr("a*u"), /“a” can't be used here\. Use u, v and t\./);
    fails(() => readExpr("q"), /I don't know “q”\. Try something like cos\(u\)·sin\(v\)\./);
    fails(() => readExpr("sin(u"), /check the brackets/);
    fails(() => readExpr("u".repeat(121)), /over 120 characters/);
  });

  test("statements: one or many, each field its own message", () => {
    expect(readStatements("x = cos u; y(u,v,t) = sin(u)\nz = t # a comment")).toEqual({
      x: "cos u",
      y: "sin(u)",
      z: "t",
    });
    expect(readStatements("color = u/(2π)")).toEqual({ hue: "u/(2pi)" });
    const err = fails(() => readStatements("x = cos u; w = 2; hello"));
    expect(err.message).toMatch(/“w” is not a field/);
    expect(err.message).toMatch(/“hello”: start it with a name/);
    const prog = fails(() => compileProgram({ x: "cos(u", y: "q", z: "t", u: "0..1" }));
    expect(prog.message).toMatch(/^x: That can't be drawn: check the brackets.* y: That can't be drawn: I don't know “q”/); // prettier-ignore
  });

  test("hostile input stays harmless", () => {
    for (const bad of [
      "constructor",
      "__proto__",
      "alert(1)",
      "u.constructor",
      "this",
      "globalThis",
      "import('x')",
      "`u`",
      "u; x = 1",
      "1e400",
      "((((((((((((((((((((((((((((((((((u))))))))))))))))))))))))))))))))))",
    ]) {
      let v;
      try {
        v = at(readExpr(bad), 1, 1);
      } catch (e) {
        expect(e.message).toMatch(/^That can't be drawn: /);
        continue;
      }
      expect(typeof v).toBe("number");
    }
    // Random strings throw only the reader's own message.
    let seed = 7;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const alphabet = "uvt0123456789.+-*/^()|,= sincoexpqrtlgabdfmwhz πθ²";
    for (let i = 0; i < 3000; i++) {
      const n = 1 + Math.floor(rnd() * 24);
      let s = "";
      for (let j = 0; j < n; j++) s += alphabet[Math.floor(rnd() * alphabet.length)];
      try {
        const e = readExpr(s);
        expect(typeof at(e, 0.5, 0.25, 1)).toBe("number");
      } catch (e) {
        expect(e.message).toMatch(/^That can't be drawn: /);
      }
    }
  });

  test("every preset compiles, fits in 120 characters a field, and survives a link", () => {
    expect(PRESETS.map((p) => p.id)).toEqual(["sphere", "torus", "mobius", "seashell", "trefoil", "wave", "galaxy", "klein"]); // prettier-ignore
    for (const p of PRESETS) {
      const prog = compileProgram(p);
      expect(prog.usesT, p.id).toBe(true);
      for (const name of FIELDS) if (p[name]) expect(p[name].length, `${p.id}.${name}`).toBeLessThanOrEqual(120); // prettier-ignore
      // As your own program, the fields come back unchanged from a link.
      const opts = { preset: "custom" };
      for (const name of FIELDS) opts[name] = p[name] || "";
      const kept = normalizeOptions(opts);
      for (const name of FIELDS) if (p[name]) expect(kept[name], `${p.id}.${name}`).toBe(p[name]);
      expect(compileProgram(Object.fromEntries(FIELDS.map((n) => [n, kept[n]]))).fields).toEqual(prog.fields); // prettier-ignore
      expect(programText(prog.fields)).toMatch(/^x = /);
    }
  });

  test("every preset builds finite splats, at the low and the max tier", () => {
    const recipe = RECIPES["splat-equation"];
    for (const count of [120000, 400000])
      for (const p of PRESETS) {
        const it = buildRecipe(recipe, { seed: 1, count, options: { preset: p.id, shade: true } }, applyClay); // prettier-ignore
        let r = it.next();
        while (!r.done) r = it.next();
        const buf = r.value.buf;
        expect(buf.count, p.id).toBeGreaterThan(1000);
        expect(buf.count, p.id).toBeLessThanOrEqual(count);
        for (let i = 0; i < buf.count * 3; i++) if (!Number.isFinite(buf.pos[i])) throw new Error(`${p.id}: a position is not finite`); // prettier-ignore
      }
  });

  test("a program without t draws its splats in order, and bad fields fall back", () => {
    const recipe = RECIPES["splat-equation"];
    const build = (options) => {
      const it = buildRecipe(recipe, { seed: 1, count: 120000, options }, applyClay);
      let r = it.next();
      while (!r.done) r = it.next();
      return r.value;
    };
    const still = build({ preset: "custom", x: "cos(u)", y: "sin(u)", z: "0", u: "0 .. 2pi", count: "500" }); // prettier-ignore
    expect(still.buf.count).toBe(500);
    // The toy's data says one copy, so drive() plays the drawing.
    const out = { parts: {}, morph: [0, 0, 0, 0] };
    recipe.drive(0, { play: 0.5, t: 0 }, out, { data: { equation: { copies: 1 } } });
    expect(out.morph[0]).toBeGreaterThan(0);
    expect(out.morph[0]).toBeLessThan(1);
    // Unreadable fields: the first preset instead.
    const bad = build({ preset: "custom", x: "cos(", y: "1", z: "1", u: "0..1" });
    expect(bad.buf.count).toBeGreaterThan(1000);
  });
});

// ---- In the app --------------------------------------------------------------------------

test("typing a program, a link that carries it, and bad input that keeps the shape", async ({
  page,
}) => {
  const { encodeSceneHash } = await import("../src/codec.js");
  const { createScene } = await import("../src/state.js");
  const problems = [];
  page.on("pageerror", (e) => problems.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?renderer=webgl2&profile=weak");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("splat-equation"));
  await expect(page.locator("#toy-status")).toHaveText(/^Splat equation/, { timeout: 180_000 });
  await expect(page.locator("#toy-input .input-shown")).toHaveText(/^Torus: x = /, { timeout: 60_000 }); // prettier-ignore
  const options = () => page.evaluate(() => window.__splashery.player.scene.toy.options);
  await page.locator("#toy-input-text").fill("y = sin(v + t) + 0.5·sin(3u − t)");
  await page.locator("#toy-input-go").click();
  await expect.poll(options).toMatchObject({ preset: "custom", y: "sin(v + t) + 0.5*sin(3u - t)", x: "(2 + cos(v + t))cos(u)" }); // prettier-ignore
  await expect(page.locator("#toy-input .input-shown")).toHaveText(/^Your program: x = .*y = sin\(v \+ t\) \+ 0\.5\*sin\(3u - t\)/, { timeout: 60_000 }); // prettier-ignore
  // Bad input: a message per field, and the program stays.
  await page.locator("#toy-input-text").fill("z = sin(q); x = cos(u");
  await page.locator("#toy-input-go").click();
  await expect(page.locator("#toy-input .warning")).toHaveText(/^x: That can't be drawn: check the brackets.* z: That can't be drawn: I don't know “q”/); // prettier-ignore
  expect(await options()).toMatchObject({ preset: "custom", y: "sin(v + t) + 0.5*sin(3u - t)" });
  // The tap plays t and comes back to rest.
  await page.evaluate(() => window.__splashery.player.act(null));
  await page.waitForTimeout(1500);
  // A link carries a program.
  const scene = createScene();
  scene.toy = { kind: "builtin", id: "splat-equation", options: { preset: "custom", x: "cos(u)sin(v)", y: "cos(v)", z: "sin(u)sin(v)", u: "0 .. 2pi", v: "0 .. pi", hue: "v/pi", size: "0.04", count: "3000" } }; // prettier-ignore
  await page.goto("about:blank");
  await page.goto(`/?renderer=webgl2&profile=weak#s=${await encodeSceneHash(scene)}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await expect(page.locator("#toy-status")).toHaveText(/^Splat equation/, { timeout: 180_000 });
  await expect(page.locator("#toy-input .input-shown")).toHaveText(/^Your program: x = cos\(u\)sin\(v\); y = cos\(v\)/, { timeout: 60_000 }); // prettier-ignore
  expect(problems).toEqual([]);
});

test("the manual page opens, and every example link opens the toy with its program", async ({
  page,
}) => {
  const problems = [];
  page.on("pageerror", (e) => problems.push(e.message));
  await page.goto("/manual/");
  await expect(page.locator("h1")).toHaveText(/Tinkerer's Manual/);
  const links = await page.locator("a[href*='#s=']").evaluateAll((as) => as.map((a) => a.getAttribute("href"))); // prettier-ignore
  expect(links.length).toBeGreaterThanOrEqual(8);
  const { decodeSceneHash } = await import("../src/codec.js");
  for (const href of links) {
    const scene = await decodeSceneHash(href.slice(href.indexOf("#s=") + 3));
    expect(scene.toy.id).toBe("splat-equation");
    const o = scene.toy.options;
    if (o.preset === "custom") {
      const fields = Object.fromEntries(FIELDS.map((n) => [n, o[n] || ""]));
      expect(() => compileProgram(fields), href).not.toThrow();
    } else expect(PRESETS.map((p) => p.id)).toContain(o.preset);
  }
  // Every picture on the page is there.
  const imgs = await page.locator("img").evaluateAll((is) => is.map((i) => [i.getAttribute("src"), i.complete && i.naturalWidth > 0])); // prettier-ignore
  for (const [src, ok] of imgs) expect(ok, src).toBe(true);
  expect(fs.existsSync("manual/tinkerers-manual.pdf")).toBe(true);
  expect(problems).toEqual([]);
});

// ---- Screenshots ---------------------------------------------------------------------------

const SHOTS = path.resolve("tests/screenshots");
test("splat equation mid-tap screenshots at 390x844 and 1440x900", async ({ browser }) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [w, h, mobile] of [
    [390, 844, true],
    [1440, 900, false],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      ...(mobile ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await ctx.newPage();
    const problems = [];
    page.on("pageerror", (e) => problems.push(e.message));
    await page.goto("/?renderer=webgl2&profile=weak&labs=1");
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("splat-equation"));
    await expect(page.locator("#toy-status")).toHaveText(/^Splat equation/, { timeout: 180_000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__splashery.player.act(null));
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(SHOTS, `man-splat-equation-${w}x${h}.png`) });
    await page.goto("/manual/");
    await page.waitForLoadState("load");
    await page.screenshot({ path: path.join(SHOTS, `man-manual-${w}x${h}.png`) });
    expect(problems).toEqual([]);
    await ctx.close();
  }
});

test("the manual's example recipe builds, and its gust ends where the sails would be", async () => {
  const { RECIPES: EXAMPLE } = await import("../manual/example-recipe.js");
  const recipe = EXAMPLE["little-windmill"];
  const it = buildRecipe(recipe, { seed: 1, count: 60000, options: { sails: "#f2eee4" } }, applyClay); // prettier-ignore
  let r = it.next();
  while (!r.done) r = it.next();
  expect(r.value.buf.count).toBeGreaterThan(50000);
  const angle = (gust) => {
    const out = { parts: {} };
    recipe.drive(2, { wind: 0.4, gust }, out);
    return out.parts.sails.angle;
  };
  expect(angle(1e-9) - angle(0)).toBeCloseTo(2 * Math.PI, 5);
  expect(angle(1)).toBeCloseTo(angle(0), 9);
  // The page shows the same code.
  const html = fs.readFileSync("manual/index.html", "utf8");
  expect(html).toContain("const extra = 2 * Math.PI * g * g * (3 - 2 * g);");
});
