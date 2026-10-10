// Manual r3, part 2: the answers page in the manual, the live demos, and the lighter layout
// (folds, glossary pop-ups). The demos' math is checked against the real reader and against hand
// calculations; the layout is checked with a mouse, a keyboard, and a phone-sized screen.
// Screenshots man3-2-*.png.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { readExpr } from "../src/packs/splat-equation.js";
import {
  covFromSizes,
  covFacts,
  covWeight,
  smoothstep,
  momentPos,
  morphPos,
  worstDip,
  pointsPerCopy,
  parseExpr,
  evalTree,
  grouped,
} from "../manual/demo-math.js";

const SHOTS = path.resolve("tests/screenshots");
const html = fs.readFileSync("manual/index.html", "utf8");
const near = (a, b, d = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(d);

test.describe("the demos' math", () => {
  test("the reader agrees with the real one on 60 expressions, values and refusals", () => {
    const good = [
      "2^3^2", "-u^2", "2u + 1", "sin 2u", "sin u cos u", "sin u^2", "1 + 2 * 3^2", "|cos(u)|^0.5",
      "sqrt(1 - u^2)", "sin(3u - t)", "u + 10v + 100t", "cos u sin v", "2uv", "exp(u) + max(u, v)",
      "(u + 1)(v - 1)", "3sin(u)", "sin(u)^2", "-u^-2", "2^-1", "u/v/2", "u - v - t", "log10(100u)",
      "abs(u - 3)", "floor(3.7u)", "arcsin(0.5u)", "arccos(v)", "arctan(2u)", "asin(v) + acos(v)",
      "tanh(u) cosh(v)", "sinh 2 u", "sin [u + 1]", "cos {2v}", "sin(u) cos(v) ln(2)", "min(u, v, t)",
      "pi u", "π u", "2 e u", "u * v", "u × v", "u · v", "u ÷ 2", "u**2", "u²", "−u", "sqrt 4u",
      "ln e", "sin pi", "cos(pi/3)", "1/0", "sqrt(-1)", "log(0)", ".5u", "5.", "|u - v|", "u|v|",
      "(((u)))", "sin u^2 + cos v^2", "sin 2u cos 3v", "2sin(u)cos(u)",
    ]; // prettier-ignore
    let checked = 0;
    for (const src of good) {
      let real;
      try {
        real = readExpr(src);
      } catch {
        real = null;
      }
      let mine;
      try {
        mine = parseExpr(src);
      } catch {
        mine = null;
      }
      expect(!!mine, `${src}: both accept or both refuse`).toBe(!!real);
      if (!real) continue;
      for (const [u, v, t] of [
        [1, 0.5, 0],
        [0.3, 0.8, 2.1],
        [2.2, 0.1, 5],
      ]) {
        const a = evalTree(mine, { u, v, t });
        const b = real.f({ θ: u, y: v, t });
        if (Number.isNaN(a) && Number.isNaN(b)) continue;
        if (a === b) continue;
        near(a, b, 1e-9 * Math.max(1, Math.abs(b)));
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
    // Both refuse the same bad input.
    for (const bad of [
      "sin",
      "sin cos u",
      "sin -u",
      "min u",
      "2 +",
      "(u",
      "u)",
      "q",
      "u^",
      "1.2.3u",
      "|u",
      "x = u",
    ]) {
      expect(() => readExpr(bad), bad).toThrow();
      expect(() => parseExpr(bad), bad).toThrow();
    }
  });

  test("the grouping the demo prints is the order of operations, at hand-checked points", () => {
    const env = { u: 1, v: 0.5, t: 0 };
    const at = (s) => evalTree(parseExpr(s), env);
    expect(at("2^3^2")).toBe(512); // 2^(3^2)
    expect(at("-u^2")).toBe(-1); // -(u^2)
    near(at("-u^2 + sin 2u"), -1 + Math.sin(2), 1e-12); // -0.0907026
    near(at("sin u^2"), Math.sin(1), 1e-12); // sin(u^2), not (sin u)^2
    near(at("sin u cos u"), Math.sin(1) * Math.cos(1), 1e-12);
    expect(at("1 + 2 * 3^2")).toBe(19);
    expect(grouped(parseExpr("1 + 2 * 3^2"))).toBe("1 + (2 × (3 ^ 2))");
    expect(grouped(parseExpr("2^3^2"))).toBe("2 ^ (3 ^ 2)");
    expect(grouped(parseExpr("sin 2u"))).toBe("sin(2 × u)");
    expect(grouped(parseExpr("-u^2"))).toBe("−(u ^ 2)");
  });

  test("the covariance: 0.3, 0.1 and 30 degrees match the manual's worked example", () => {
    // The manual's worked example is in three dimensions with sizes 0.3, 0.1, 0.1: the top-left
    // 2 x 2 block is the same calculation as 2D sizes 0.3 and 0.1.
    const m = covFromSizes(0.3, 0.1, (30 * Math.PI) / 180);
    near(m.a, 0.09 * 0.75 + 0.01 * 0.25); // 0.07
    near(m.b, 0.08 * 0.5 * (Math.sqrt(3) / 2)); // 0.0346...
    near(m.c, 0.09 * 0.25 + 0.01 * 0.75); // 0.03
    // The demo's default: sizes 0.6 and 0.25, turned 30 degrees.
    const d = covFromSizes(0.6, 0.25, (30 * Math.PI) / 180);
    near(d.a, 0.36 * 0.75 + 0.0625 * 0.25); // 0.285625
    near(d.b, (0.36 - 0.0625) * 0.5 * (Math.sqrt(3) / 2)); // 0.12882...
    near(d.c, 0.36 * 0.25 + 0.0625 * 0.75); // 0.136875
    const f = covFacts(d);
    near(f.l1, 0.36, 1e-12); // the squared sizes come back
    near(f.l2, 0.0625, 1e-12);
    expect(f.valid).toBe(true);
    // The weight is 1 at the center and exp(-1/2) one size out along the first axis.
    near(covWeight(d, 0, 0), 1);
    near(covWeight(d, 0.6 * Math.cos(f.angle), 0.6 * Math.sin(f.angle)), Math.exp(-0.5), 1e-9);
    near(
      covWeight(d, 2 * 0.25 * -Math.sin(f.angle), 2 * 0.25 * Math.cos(f.angle)),
      Math.exp(-2),
      1e-9,
    );
    // Not valid: a negative determinant (it grows in some direction), and a flat one.
    expect(covFacts({ a: 0.1, b: 0.5, c: 0.1 }).valid).toBe(false);
    expect(covFacts({ a: 0.25, b: 0.5, c: 1 }).flat).toBe(true);
  });

  test("smoothstep at three points, and the moments' dip and budget", () => {
    near(smoothstep(0), 0);
    near(smoothstep(0.25), 0.15625); // 3 x 0.0625 - 2 x 0.015625
    near(smoothstep(0.5), 0.5);
    near(smoothstep(0.75), 0.84375);
    near(smoothstep(1), 1);
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(2)).toBe(1);
    // The dip: 1 - cos(pi / K), and the real number a ring dips at half way between two moments.
    near(worstDip(12), 0.0341, 1e-4);
    near(worstDip(15), 0.0219, 1e-4);
    near(worstDip(24), 0.0086, 1e-4);
    for (const K of [12, 15, 24]) {
      const p = morphPos("turn", 0, 0.5 / K, K); // half way through the first interval
      near(1 - Math.hypot(p[0], p[1]), worstDip(K), 1e-12);
      // At every stored moment the shape is exact.
      const e = momentPos("turn", 0.7, (2 * Math.PI * 3) / K);
      const q = morphPos("turn", 0.7, 3 / K, K);
      near(e[0], q[0], 1e-12);
      near(e[1], q[1], 1e-12);
    }
    expect(pointsPerCopy(120000, 12)).toBe(9800);
    expect(pointsPerCopy(120000, 15)).toBe(7840);
    expect(pointsPerCopy(120000, 24)).toBe(4900);
  });
});

test.describe("the live demos", () => {
  test("each shows its numbers, matching a hand calculation, with no errors", async ({ page }) => {
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errs.push(m.text())); // prettier-ignore
    page.on("response", (r) => r.status() >= 400 && !/favicon/.test(r.url()) && errs.push(`${r.status()} ${r.url()}`)); // prettier-ignore
    await page.goto("/manual/");
    // Covariance, at its defaults.
    const cov = page.locator("#cov-readout");
    await expect(cov).toContainText("0.286");
    await expect(cov).toContainText("0.129");
    await expect(cov).toContainText("0.137");
    await expect(cov).toContainText("0.360 and 0.063");
    await expect(page.locator("#cov-verdict")).toContainText("Valid");
    await page.locator("#cov-mode-matrix").click();
    await page.locator("#cov-b").fill("0.5");
    await page.locator("#cov-a").fill("0.1");
    await page.locator("#cov-c").fill("0.1");
    await expect(page.locator("#cov-verdict")).toContainText("Not valid");
    await page.locator("#cov-mode-sizes").click();
    // The reader.
    await expect(page.locator("#parse-readout")).toContainText("= -0.0907026");
    await expect(page.locator("#parse-readout")).toContainText("Grouped: (−(u ^ 2)) + sin(2 × u)");
    await page.locator("#parse-presets button", { hasText: "sin u^2" }).click();
    await expect(page.locator("#parse-readout")).toContainText("= 0.841471");
    await page.locator("#parse-input").fill("sin");
    await expect(page.locator("#parse-tree")).toContainText("can't be drawn");
    // The moments.
    await page.locator("#t-knots").fill("12");
    await expect(page.locator("#t-readout")).toContainText("worst case for a turn: 3.4%");
    await expect(page.locator("#t-readout")).toContainText("9,800");
    await page.locator("#t-knots").fill("24");
    await expect(page.locator("#t-readout")).toContainText("worst case for a turn: 0.9%");
    await expect(page.locator("#t-readout")).toContainText("4,900");
    // Smoothstep.
    await expect(page.locator("#ss-readout")).toContainText("0.1563"); // x = 0.25
    await page.locator("#ss-x").fill("0.75");
    await expect(page.locator("#ss-readout")).toContainText("0.8438");
    await expect(page.locator("#ss-readout")).toContainText(
      "270.0° (straight) and 303.8° (smoothstep)",
    );
    expect(errs).toEqual([]);
  });

  test("they work with the keyboard: the smoothstep curve takes arrow keys, buttons take Enter", async ({
    page,
  }) => {
    await page.goto("/manual/");
    const curve = page.locator("#ss-canvas");
    await curve.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#ss-x-out")).toHaveValue("0.29");
    await page.locator("#cov-mode-matrix").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#cov-matrix")).toBeVisible();
    await expect(page.locator("#cov-sizes")).toBeHidden();
  });

  test("they fit a 390 px phone, and the PDF shows each one as a still with its link", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/manual/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    for (const d of ["covariance-validity", "order-of-operations", "t-clock", "smoothstep"]) {
      const box = page.locator(`section.demo-live[data-demo="${d}"]`);
      await expect(box).toBeVisible();
      const r = await box.boundingBox();
      expect(r.width, d).toBeLessThanOrEqual(390);
      await expect(page.locator(`figure.demo-still[data-demo-still="${d}"]`)).toBeHidden();
    }
    await page.locator("#demo-smoothstep").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, "man3-2-demo-smoothstep-390x844.png") });
    await page.locator("#demo-covariance").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, "man3-2-demo-covariance-390x844.png") });
    await page.emulateMedia({ media: "print" });
    for (const d of ["covariance-validity", "order-of-operations", "t-clock", "smoothstep"]) {
      await expect(page.locator(`section.demo-live[data-demo="${d}"]`)).toBeHidden();
      const still = page.locator(`figure.demo-still[data-demo-still="${d}"]`);
      await expect(still).toBeVisible();
      await expect(still.locator("img")).toHaveJSProperty("complete", true);
      expect(await still.locator("img").evaluate((i) => i.naturalWidth)).toBeGreaterThan(300);
      await expect(still.locator("a")).toHaveAttribute("target", "_blank");
    }
  });
});

test.describe("the lighter layout", () => {
  test("folds start closed, a link opens one, print opens them all", async ({ page }) => {
    await page.goto("/manual/");
    const total = await page.locator("details.fold").count();
    expect(total).toBeGreaterThan(18);
    expect(await page.locator("details.fold[open]").count()).toBe(0);
    // A closed fold shows only its label.
    const why = page.locator("#why-bits");
    await expect(why.locator("summary")).toBeVisible();
    await expect(why.locator("pre")).toBeHidden();
    // Clicking opens it, with a visible marker (the summary's ::before) on every summary.
    await why.locator("summary").click();
    await expect(why.locator("pre")).toBeVisible();
    const mark = await why
      .locator("summary")
      .evaluate((s) => getComputedStyle(s, "::before").content);
    expect(mark).not.toBe("none");
    // A link to something inside a closed fold opens it.
    await page.goto("/manual/#two-splats");
    await expect(page.locator("#two-splats")).toHaveJSProperty("open", true);
    await page.goto("/manual/#why-moment-parts");
    await expect(page.locator("#why-moment-parts")).toHaveJSProperty("open", true);
    // Print opens every fold, and closes the same ones after.
    const openBefore = await page.locator("details.fold[open]").count();
    expect(openBefore).toBeGreaterThan(0);
    expect(openBefore).toBeLessThan(total);
    await page.evaluate(() => dispatchEvent(new Event("beforeprint")));
    expect(await page.locator("details.fold:not([open])").count()).toBe(0);
    await page.evaluate(() => dispatchEvent(new Event("afterprint")));
    expect(await page.locator("details.fold[open]").count()).toBe(openBefore);
    // The buttons on the cover.
    await page.locator("[data-fold-all=open]").click();
    expect(await page.locator("details.fold:not([open])").count()).toBe(0);
    await page.locator("[data-fold-all=close]").click();
    expect(await page.locator("details.fold[open]").count()).toBe(0);
  });

  test("the long tables fold behind Show the table", async ({ page }) => {
    await page.goto("/manual/");
    const folds = page.locator("details.tablefold > summary");
    expect(await folds.count()).toBeGreaterThanOrEqual(4);
    for (const s of await folds.all()) expect(await s.textContent()).toMatch(/^Show the table/);
    await expect(page.locator("#fields-table, details.tablefold table").first()).toBeHidden();
  });

  test("a glossary word shows its entry: hover, tap, Escape, and a tap outside", async ({
    page,
  }) => {
    await page.goto("/manual/");
    const term = page.locator('.term[data-g="g-field"]').first();
    await term.scrollIntoViewIfNeeded();
    const pop = page.locator("#term-pop");
    await term.hover();
    await expect(pop).toBeVisible();
    await expect(pop).toContainText("A weight field is a number at every point in space");
    await expect(pop.locator("a")).toHaveAttribute("href", "#g-field");
    await page.mouse.move(5, 5);
    await expect(pop).toBeHidden();
    // Click pins it; Escape closes it.
    await term.click();
    await expect(pop).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(pop).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(pop).toBeHidden();
    // Keyboard: focus shows it, Enter pins it, a click outside closes it.
    await page.evaluate(() => document.activeElement.blur());
    await term.focus();
    await expect(pop).toBeVisible();
    await page.keyboard.press("Enter");
    await page.mouse.click(5, 300);
    await expect(pop).toBeHidden();
    // Every marked word has an entry in the glossary.
    const missing = await page.evaluate(() =>
      [...document.querySelectorAll(".term[data-g]")]
        .filter((t) => document.getElementById(t.dataset.g)?.nextElementSibling?.tagName !== "DD")
        .map((t) => t.dataset.g),
    );
    expect(missing).toEqual([]);
    expect(await page.locator(".term[data-g]").count()).toBeGreaterThanOrEqual(12);
  });

  test("on a phone a tap opens the pop-up and a tap elsewhere closes it, and nothing scrolls sideways", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto("/manual/");
    const term = page.locator('.term[data-g="g-covariance"]').first();
    await term.scrollIntoViewIfNeeded();
    await term.tap();
    const pop = page.locator("#term-pop");
    await expect(pop).toBeVisible();
    const r = await pop.boundingBox();
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: path.join(SHOTS, "man3-2-glossary-popup-390x844.png") });
    await page.touchscreen.tap(10, 10);
    await expect(pop).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    // An opened fold fits too.
    await page.goto("/manual/#why-budgets");
    await page.locator("#why-budgets .tablefold summary").click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await page.locator("#why-budgets").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, "man3-2-fold-390x844.png") });
    await ctx.close();
  });

  test("the pages keep their anchors and the new chapters are in the contents", async ({
    page,
  }) => {
    await page.goto("/manual/");
    for (const id of ["unique", "experiments", "why-budgets", "why-other-parts", "why-other-fields", "why-moment-parts"]) // prettier-ignore
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    const hrefs = await page.locator("nav.toc a").evaluateAll((as) => as.map((a) => a.getAttribute("href"))); // prettier-ignore
    expect(hrefs).toContain("#unique");
    expect(hrefs).toContain("#experiments");
    for (const h of hrefs) await expect(page.locator(h)).toHaveCount(1);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/manual/#why-budgets");
    await page.screenshot({ path: path.join(SHOTS, "man3-2-fold-1440x900.png") });
  });

  test("the new text says what the review asked, and no owner's notes are quoted", () => {
    const flat = html.replace(/<(pre|svg|script|style)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " "); // prettier-ignore
    for (const s of [
      "200,000 splats instead of 140,000 made no toy sharper",
      "the penguin's shimmer went from 2.72 to 3.90",
      "One pair of budgets (140,000 and 200,000), one phone size, one renderer",
      "A larger sweep is planned in the Kit lab",
      "Store the moments in a keyframe texture",
      "Compile the formulas to a shader",
      "Recompute on the processor every frame",
      "deflate and then written in base64url",
      "A link carries settings, not your files",
      "No server is involved",
      "Open: no plan yet",
      "Planned in the Kit lab",
    ])
      expect(flat, s).toContain(s);
    for (const chip of ["Our choice", "Format limit", "Not tested yet", "Each recipe's choice"]) expect(flat, chip).toContain(chip); // prettier-ignore
    // The owner's private notes stay private.
    expect(flat.toLowerCase()).not.toMatch(/the owner|ryan said|you asked|your question/);
  });
});

test.describe("Level 4's sixty more programs", () => {
  const entries = JSON.parse(fs.readFileSync("src/equation-gallery.json", "utf8"));

  test("sixty cards in six folded groups, each with its picture, a program, a source, and a Run it link in a new tab", async ({
    page,
  }) => {
    await page.goto("/manual/");
    expect(entries).toHaveLength(60);
    await expect(page.locator("details.gallery-group")).toHaveCount(6);
    await expect(page.locator("details.gallery-group[open]")).toHaveCount(0);
    await expect(page.locator("details.gallery-group article.card")).toHaveCount(60);
    for (const e of entries) {
      const card = page.locator(`#g-${e.id}`);
      await expect(card.locator("h5")).toHaveText(e.title);
      await expect(card.locator("pre code")).toHaveText(e.program);
      const run = card.locator("a.button");
      await expect(run).toHaveText("Run it");
      await expect(run).toHaveAttribute("target", "_blank");
      await expect(run).toHaveAttribute(
        "href",
        /^https:\/\/ryanjosephkamp\.github\.io\/splashery\/#s=d\./,
      );
    }
    // Every picture is real.
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll("details.gallery-group img")]
        .filter((i) => !(i.complete && i.naturalWidth > 0))
        .map((i) => i.getAttribute("src")),
    );
    expect(bad).toEqual([]);
    // A link to one card opens its group.
    await page.goto("/manual/#g-torus");
    await expect(page.locator("details.gallery-group").first()).toHaveJSProperty("open", true);
    // In the PDF, the groups print open as a compact grid with no code.
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => dispatchEvent(new Event("beforeprint")));
    await expect(page.locator("#g-torus h5")).toBeVisible();
    await expect(page.locator("#g-torus details.program")).toBeHidden();
  });

  test("three Run it links open the equation toy with that program", async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto("/manual/");
    const picks = [entries[0], entries[23], entries[59]];
    const hrefs = [];
    for (const e of picks) hrefs.push(await page.locator(`#g-${e.id} a.button`).getAttribute("href")); // prettier-ignore
    for (const href of hrefs) {
      await page.goto(`/?renderer=webgl2&profile=weak&labs=1${href.slice(href.indexOf("#s="))}`);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await expect(page.locator("#toy-status")).toHaveText(/^Splat equation/, { timeout: 180_000 });
      // The Program picker shows "Your own": the link carried a typed program, not a preset.
      await expect(page.locator("select", { hasText: "Your own (below)" }).first()).toHaveValue("custom"); // prettier-ignore
    }
  });
});
