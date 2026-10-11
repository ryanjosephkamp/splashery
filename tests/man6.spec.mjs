// Manual r6: the second audit's fixes (docs/audits/manual-audit-2026-10-r2/REPORT.md), each checked
// against the code, not against the text. Screenshots man6-*.png.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { covFacts } from "../manual/demo-math.js";
import { readRows } from "../manual/build-budget.mjs";
import { shareCode } from "../src/qr/share-code.js";
import { PROFILES } from "../src/generators.js";
import { RECIPES } from "../src/packs/splat-equation.js";
import { normalizeOptions } from "../src/state.js";

const SHOTS = path.resolve("tests/screenshots");
const read = (f) => fs.readFileSync(`manual/${f}`, "utf8");
const plain = (h) => h.replace(/<(pre|svg|script|style)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim(); // prettier-ignore
const PUBLIC = "https://ryanjosephkamp.github.io/splashery/#s=";
const link = (n) => PUBLIC + "x".repeat(n - PUBLIC.length);

test.describe("R2-F01: the equation toy has 16 option definitions, and the text says so everywhere", () => {
  test("the count is the code's, and both paragraphs agree", () => {
    const keys = RECIPES["splat-equation"].options.map((o) => o.key);
    expect(keys.length).toBe(16);
    // A saved link keeps the first 16 keys, so a toy with all 16 loses none and has none to spare.
    const all = Object.fromEntries(keys.map((k) => [k, 1]));
    expect(Object.keys(normalizeOptions(all)).length).toBe(16);
    expect(Object.keys(normalizeOptions({ ...all, extra: 1 })).length).toBe(16);
    const t = plain(read("language.html"));
    expect(t).toContain("a link keeps at most 16 option keys");
    expect(t).toContain("already uses all 16");
    expect(t).not.toContain("uses 15 today");
    expect(t).not.toContain("without labs it has one");
    expect(t).toContain("labs switch only hides the toy from the shelf");
  });
});

test.describe("R2-F02: the covariance demo's verdicts", () => {
  test("trace-zero and indefinite, flat, thin, and negative definite matrices", () => {
    // Zero trace is not zero determinant: [[0.1, 0], [0, -0.1]] is invertible and indefinite.
    const ind = covFacts({ a: 0.1, b: 0, c: -0.1 });
    expect(ind.det).toBeCloseTo(-0.01, 12);
    expect([ind.valid, ind.flat]).toEqual([false, false]);
    expect(ind.l1).toBeCloseTo(0.1, 12);
    expect(ind.l2).toBeCloseTo(-0.1, 12);
    // Exactly singular, and the zero matrix, are flat.
    expect(covFacts({ a: 0.25, b: 0.5, c: 1 }).flat).toBe(true);
    expect(covFacts({ a: 0, b: 0, c: 0 }).flat).toBe(true);
    // A positive matrix, however thin, is valid (a warning, never a failure).
    const thin = covFacts({ a: 1e-10, b: 0, c: 1 });
    expect([thin.valid, thin.flat, thin.thin]).toEqual([true, false, true]);
    // Negative definite is not valid and not flat.
    expect(covFacts({ a: -1, b: 0, c: -1 })).toMatchObject({ valid: false, flat: false });
  });

  test("the page shows the right sentence for each (and never 'determinant is 0' for an invertible one)", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto("/manual/all.html");
    await page.locator("#cov-mode-matrix").scrollIntoViewIfNeeded();
    await page.click("#cov-mode-matrix");
    const set = async (a, b, c) => {
      await page.fill("#cov-a", String(a));
      await page.fill("#cov-b", String(b));
      await page.fill("#cov-c", String(c));
    };
    await set(0.1, 0, -0.1);
    const v = page.locator("#cov-verdict");
    await expect(v).toContainText("one eigenvalue is positive and one negative");
    await expect(v).not.toContainText("determinant is 0");
    await expect(v).toHaveClass(/bad/);
    await page.locator("#cov-canvas").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, "man6-covariance-390x844.png") });
    await set(0.2, 0.2, 0.2);
    await expect(v).toContainText("determinant is 0");
    await set(0.3, 0, 0.2);
    await expect(v).toContainText("Valid");
    await ctx.close();
  });
});

test.describe("R2-F03: the renderer's blur is always on, and the demo says what it draws", () => {
  test("the vendored shader adds 0.3 outside the anti-aliasing gate, and the text says so", () => {
    const src = fs.readFileSync("vendor/playcanvas/playcanvas.min.mjs", "utf8");
    const i = src.indexOf("float detOrig = cov[0][0]");
    expect(i).toBeGreaterThan(0);
    const after = src.slice(i, i + 900);
    // The opacity compensation sits inside #if GSPLAT_AA ... #endif; the blur and the 0.1 floor follow it.
    const endif = after.indexOf("#endif");
    expect(endif).toBeGreaterThan(0);
    expect(after.indexOf("float diagonal1 = cov[0][0] + 0.3")).toBeGreaterThan(endif);
    expect(after.indexOf("max(mid - radius, 0.1)")).toBeGreaterThan(endif);
    const t = plain(read("splat.html"));
    expect(t).toContain("that blur is always on");
    expect(t).toContain("smaller eigenvalue at least 0.1");
    expect(t).toContain("optional setting, the engine's anti-aliasing");
    expect(t).not.toContain("its anti-aliasing option");
    expect(t).toContain("unfiltered geometry");
    const demo = fs.readFileSync("manual/demos2.js", "utf8");
    expect(demo).toContain("(before the renderer's extra blur)");
    expect(demo).not.toContain("(the renderer's)");
  });
});

test.describe("R2-F04: the What Splashery can do page agrees with the manual", () => {
  test("no stale claim, and the qualifications are there", () => {
    const html = fs.readFileSync("site/learn/can-do/index.html", "utf8");
    const t = plain(html);
    for (const old of ["Every toy plays this way", "one per particle", "nothing is recorded or sent", 'so "everything is splats" holds', "so there is no multi-megabyte file to download"]) // prettier-ignore
      expect(t, old).not.toContain(old);
    for (const now of ["Most toys play this way", "each liquid particle is four small splats", "nothing is recorded unless you ask", "saves it only to a file you choose", "Sharp view is a textured relief", "never a multi-megabyte file to download", "base budget is 60,000 to 400,000 splats"]) // prettier-ignore
      expect(t, now).toContain(now);
    // The facts behind them are in the code.
    expect(fs.readFileSync("src/physics/hands-on.js", "utf8")).toContain("handsOn === false");
    expect(fs.readFileSync("src/packs/photo-sharp.js", "utf8")).toMatch(/relief/i);
    // It is the same page the generator makes.
    const out = execFileSync("node", ["tools/site-build.mjs", "--check"], { encoding: "utf8" });
    expect(out).toMatch(/site\/ is current/);
  });

  test("it fits a phone", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto("/site/learn/can-do/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0); // prettier-ignore
    await page.locator("#h-play").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, "man6-can-do-390x844.png") });
    await ctx.close();
  });
});

test.describe("R2-F05 and R2-F08: the budget table says what its counts are, and its generator works", () => {
  test("the base budget is not the count drawn: the density-2 toys were asked for more", () => {
    // 140k and 200k, times density 2, capped at the tier's most: what splatBudget asks for.
    const ask = (tier, density) => Math.min(PROFILES[tier].maxCount, PROFILES[tier].defaultCount * density); // prettier-ignore
    expect(ask("mid", 2)).toBe(240000);
    expect(ask("high", 2)).toBe(300000);
    for (const f of ["american-football", "hockey-puck", "marble"]) {
      const rows = readRows().filter((r) => r.name.startsWith(`${f} `));
      expect(rows.length, f).toBe(1);
      expect(rows[0].drawn, f).toMatch(/^(120,000|120,001) → (600,000|600,001)$/);
    }
    const t = plain(read("toy.html"));
    expect(t).toContain("These counts are base budgets");
    expect(t).toContain("240,000 and 300,000 splats, not 140,000 and 200,000");
    expect(t).toContain("at a base budget of 140,000 splats → 200,000");
    // Each row carries the document's own actual counts.
    const html = read("toy.html");
    for (const r of readRows()) expect(html, r.name).toContain(`${r.drawn} splats drawn`);
    const unique = plain(read("unique.html"));
    expect(unique).toContain("base budget is 60,000 to 400,000 splats");
    expect(unique).not.toContain("becomes 60,000 to");
  });

  test("node manual/build-budget.mjs runs, and writes what is in toy.html", () => {
    const before = read("toy.html");
    try {
      const out = execFileSync("node", ["manual/build-budget.mjs"], { encoding: "utf8" });
      expect(out).toContain("Budget tables written");
      execFileSync("npx", ["prettier", "--write", "manual/toy.html"], { stdio: "pipe" });
      expect(read("toy.html")).toBe(before);
    } finally {
      fs.writeFileSync("manual/toy.html", before);
    }
    expect(fs.readFileSync("manual/build-budget.mjs", "utf8")).not.toContain("index.html");
  });
});

test.describe("R2-F06, F11, F12: the QR capacity range, the error correction, and the readback", () => {
  test("711 characters is the last that fits version 21 at level M", () => {
    const v = (n) => {
      const r = shareCode(link(n));
      return r.ok ? `${r.code.version}${r.level}` : "no";
    };
    expect(PUBLIC.length).toBe(46);
    expect(v(667)).toBe("21M");
    expect(v(711)).toBe("21M");
    expect(v(712)).toBe("22M");
    expect(v(779)).toBe("22M");
    expect(v(780)).toBe("23M");
    expect(v(2953)).toBe("40L");
    expect(v(2954)).toBe("no");
    const t = plain(read("share.html"));
    expect(t).toContain("up to 711 characters fits version 21 at level M");
    expect(t).toContain("one of 712 to 779 needs version 22");
    expect(t).not.toContain("692 to 714 characters");
  });

  test("the percentages are about codewords, and the dialog shows the code before it checks", () => {
    const t = plain(read("share.html"));
    expect(t).toContain("a rate for codewords, not a promise about any 15 percent of the squares");
    expect(t).toContain("three big squares that locate the code");
    expect(t).toContain('says "Checking that it scans…"');
    expect(t).not.toContain("reads the code back before it shows it");
    const src = fs.readFileSync("src/qr/share.js", "utf8");
    // The check starts after the dialog's contents exist and is not awaited before it opens.
    expect(src.indexOf("Checking that it scans…")).toBeGreaterThan(0);
    expect(src.indexOf('import("./scan.js")')).toBeLessThan(src.indexOf("dialog.showModal()"));
    expect(src).not.toMatch(/await\s+import\("\.\/scan\.js"\)/);
  });
});

test.describe("R2-F07, F13, F14: the built chapter", () => {
  test("the vendor claims name the adaptations and every QR consumer", () => {
    const html = read("built.html");
    const t = plain(html);
    expect(t).not.toContain("copied in unchanged");
    expect(t).toContain("copied in as they were published");
    expect(t).toContain("the Share tab's scene code, or Save PDF");
    expect(t).toContain("so does the check that Save PDF runs on its code");
    // Each of those is in the code.
    expect(fs.readFileSync("src/pdf-export/index.js", "utf8")).toContain("native: false");
    expect(fs.readFileSync("src/pdf-export/pdf.js", "utf8")).toContain('from "../qr/encode.js"');
    expect(fs.readFileSync("src/packs/qr-craft.js", "utf8")).toContain("loadJsQR");
    // The adaptations the text names are the ones LICENSES.md records.
    const lic = fs.readFileSync("LICENSES.md", "utf8");
    for (const w of ["source-map\ncomment was removed", "export { GifWriter, GifReader }", "compiled to JavaScript", "export default createLazPerf"]) // prettier-ignore
      expect(lic.replace(/\s+/g, " "), w).toContain(w.replace(/\s+/g, " "));
  });

  test("static hosting is not called unable to fail, and external data is runtime-only", () => {
    const t = plain(read("built.html"));
    expect(t).not.toContain("cannot go down because a server did");
    expect(t).toContain("has no application server of its own that could fail");
    expect(t).toContain("GitHub Pages today");
    expect(t).toContain("The white stork migration is not one of them");
    expect(t).toContain("The outside download of that data happens earlier");
    // Migration reads the shipped file; the outside download is a build tool.
    expect(fs.readFileSync("src/packs/geo.js", "utf8")).toContain(
      '"assets/toys/stork-migration/migration.bin"',
    );
    expect(fs.readFileSync("tools/geo-migration.mjs", "utf8")).toMatch(/https:\/\//);
  });
});

test.describe("R2-F09 and R2-F10: two demos' states", () => {
  test("the windmill's readout says which selected lines turn", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto("/manual/all.html");
    await page.locator("#wm-canvas").scrollIntoViewIfNeeded();
    await page.fill("#wm-angle", "90");
    const out = page.locator("#wm-readout");
    for (const lit of ["blades", "hub", "sails"]) {
      await page.click(`#demo-windmill .code-line[data-lit="${lit}"]`);
      await expect(out, lit).toContainText(/turn(s)? (with it )?|turns as one/);
      await expect(out, lit).not.toContainText("stay where they are");
    }
    await page.screenshot({ path: path.join(SHOTS, "man6-windmill-390x844.png") });
    for (const lit of ["tower", "cap"]) {
      await page.click(`#demo-windmill .code-line[data-lit="${lit}"]`);
      await expect(out, lit).toContainText("not in the sails part, so they stay where they are");
    }
    await ctx.close();
  });

  test("invalid JSON in the share demo hides the old QR code and says there is none", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto("/manual/all.html");
    await page.locator("#sh-json").scrollIntoViewIfNeeded();
    await expect(page.locator("#sh-qr")).toBeVisible();
    const good = await page.inputValue("#sh-json");
    await page.fill("#sh-json", "{");
    await expect(page.locator("#sh-qr")).toBeHidden();
    await expect(page.locator("#sh-qr-note")).toContainText("No QR code");
    expect(await page.inputValue("#sh-hash")).toBe("");
    // With no link, "Change one character" has nothing to change.
    await page.click("#sh-break");
    expect(await page.inputValue("#sh-hash")).toBe("");
    await page.screenshot({ path: path.join(SHOTS, "man6-share-invalid-390x844.png") });
    await page.fill("#sh-json", good);
    await expect(page.locator("#sh-qr")).toBeVisible();
    await expect(page.locator("#sh-qr-note")).toContainText("As a QR code: version");
    await ctx.close();
  });
});

test.describe("the projection demo on a phone", () => {
  test("its legend says what the dashed line is", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto("/manual/all.html");
    await page.locator("#demo-projection").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, "man6-projection-390x844.png") });
    await ctx.close();
  });
  test("the budget table on a phone", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto("/manual/toy.html");
    await page.locator(".budget-wrap").first().scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector(".table-note").scrollIntoView());
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0); // prettier-ignore
    await page.screenshot({ path: path.join(SHOTS, "man6-budget-390x844.png") });
    await ctx.close();
  });
});

test.describe("F22: the PDF's fonts are named, and a rebuild checks them", () => {
  test("the shipped PDF embeds exactly the families the builder lists", () => {
    const src = fs.readFileSync("tools/manual-pdf.mjs", "utf8");
    const listed = JSON.parse(/const PINNED_FONTS = (\[[^\]]*\])/.exec(src)[1]);
    const pdf = fs.readFileSync("manual/tinkerers-manual.pdf").toString("latin1");
    const got = [...new Set([...pdf.matchAll(/\/FontName\s*\/[A-Z]{6}\+([A-Za-z0-9]+)/g)].map((m) => m[1].replace(/(Regular|Bold|SemiBold|Italic|Oblique|Book)+$/, "")))].sort(); // prettier-ignore
    expect(got).toEqual(listed);
    expect(src).toContain("--allow-other-fonts");
    expect(src).toContain("--allow-other-browser");
  });

  test("its text holds every chapter, the new sentences, and the arrow", async ({ page }) => {
    await page.goto("/manual/");
    const res = await page.evaluate(async () => {
      const pdfjs = await import("/vendor/pdfjs/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
      const data = new Uint8Array(await (await fetch("/manual/tinkerers-manual.pdf")).arrayBuffer()); // prettier-ignore
      const doc = await pdfjs.getDocument({ data }).promise;
      let text = "";
      for (let i = 1; i <= doc.numPages; i++)
        text += (await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(" ") + "\n"; // prettier-ignore
      return { pages: doc.numPages, text: text.replace(/\s+/g, "") };
    });
    expect(res.pages).toBeGreaterThan(90);
    for (const s of [
      "that blur is always on",
      "These counts are base budgets",
      "one of 712 to 779 needs version 22",
      "p ↦ Ap + b",
      "has no application server of its own that could fail",
      "The white stork migration is not one of them",
    ])
      expect(res.text, s).toContain(s.replace(/\s+/g, ""));
  });
});
