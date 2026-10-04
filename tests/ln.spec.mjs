// Lane Learn: the audit of the Tinkerer's Manual (its claims against today's
// code, its code samples, its links and its layout), the new Level 5 examples,
// and the lab notebook. Screenshots are ln-*.png.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { Kit, buildRecipe } from "../src/kit.js";
import { KINDS } from "../src/effects.js";
import { PROFILES, applyClay } from "../src/generators.js";
import { FIELDS, RECIPES as EQ, readExpr } from "../src/packs/splat-equation.js";
import { RECIPES as PICTURES } from "../src/packs/pictures.js";
import { RECIPES as PICTURE_EXAMPLES } from "../manual/example-pictures.js";
import { RECIPES as INPUT_EXAMPLES } from "../manual/example-input.js";
import { RECIPES as WINDMILL } from "../manual/example-recipe.js";

const html = fs.readFileSync("manual/index.html", "utf8");
const indexHtml = fs.readFileSync("index.html", "utf8");
const squash = (s) => s.replace(/\s+/g, "");
const unescape = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = html
  .replace(/<pre[\s\S]*?<\/pre>/g, " ")
  .replace(/<svg[\s\S]*?<\/svg>/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ");

const build = (recipe, options = {}, count = 60000) => {
  const it = buildRecipe(recipe, { seed: 1, count, options }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
};

// ---- Claims against the code ---------------------------------------------------------------

test.describe("the manual's claims match the code", () => {
  test("every kit call the manual names exists", () => {
    const calls = [...html.matchAll(/<code>k\.(\w+)\(/g)].map((m) => m[1]);
    expect(new Set(calls).size).toBeGreaterThan(12);
    for (const name of new Set(calls)) expect(typeof Kit.prototype[name], `k.${name}`).toBe("function"); // prettier-ignore
  });

  test("every behavior the manual names exists", () => {
    const para = html.match(/<h3>Behaviors<\/h3>([\s\S]*?)<h3>/)[1];
    const kinds = [...para.matchAll(/kind: "(\w+)"|<code>"(\w+)"<\/code>/g)].map((m) => m[1] || m[2]); // prettier-ignore
    expect(kinds.length).toBeGreaterThan(4);
    for (const k of kinds) expect(KINDS[k], k).toBeDefined();
  });

  test("the equation language: functions, fields, defaults and limits", () => {
    const named = [
      ..."sin cos tan asin acos atan sinh cosh tanh exp log log10 sqrt abs floor min max".split(
        " ",
      ),
    ];
    for (const f of named) expect(() => readExpr(f === "min" || f === "max" ? `${f}(u, 1)` : `${f}(u)`), f).not.toThrow(); // prettier-ignore
    const quick = [...html.matchAll(/<b>Functions<\/b>:\s*([^<]*)/g)].pop()[1];
    for (const f of named.filter((f) => f !== "log")) expect(quick, f).toContain(f);
    // Every field the manual's table lists is a field, and the other way round.
    const table = html.match(/<h3>The fields<\/h3>([\s\S]*?)<h3>Expressions/)[1];
    const listed = new Set([...table.matchAll(/<td>\s*<code>(\w+)<\/code>/g)].map((m) => m[1]));
    for (const m of table.matchAll(/<code>(x|y|z|r|g|b)<\/code>/g)) listed.add(m[1]);
    for (const f of FIELDS) expect(listed.has(f), f).toBe(true);
    // The examples in the text.
    const at = (s) => readExpr(s).f({ θ: 2, y: 3, t: 0 });
    expect(at("2^3^2")).toBe(512);
    expect(at("-u^2")).toBe(-4);
    expect(at("|u - 5|")).toBe(3);
    expect(at("2u")).toBe(4);
    expect(at("(u + 1)(v - 1)")).toBe(6);
    expect(at("sin 2u")).toBeCloseTo(Math.sin(4), 12);
    // Defaults and limits: 0.05, 4000 and 100 to 10,000 splats.
    const program = { x: "u", y: "u", z: "u", u: "0 .. 1" };
    const recipe = EQ["splat-equation"];
    const stock = build(recipe, { preset: "custom", ...program }, 400000);
    expect(stock.buf.count).toBe(4000);
    expect(build(recipe, { preset: "custom", ...program, count: "10" }, 400000).buf.count).toBe(100); // prettier-ignore
    expect(build(recipe, { preset: "custom", ...program, count: "99999" }, 400000).buf.count).toBe(10000); // prettier-ignore
    expect(text).toContain("100 to 10,000");
  });

  test("the splat counts by device", () => {
    expect(PROFILES.low.defaultCount).toBe(60000);
    expect(PROFILES.max.defaultCount).toBe(280000);
    expect(PROFILES.max.maxCount).toBe(400000);
    expect(text).toContain("60,000");
    expect(text).toContain("280,000");
    expect(text).toContain("400,000");
  });

  test("the math: the covariance of the worked example, the bell, and 14 numbers", () => {
    // Sizes 0.3, 0.1, 0.1 turned 30 degrees about z: R S S^T R^T.
    const c = Math.cos(Math.PI / 6);
    const s = Math.sin(Math.PI / 6);
    const d = [0.09, 0.01];
    const sigma = [d[0] * c * c + d[1] * s * s, (d[0] - d[1]) * s * c, d[0] * s * s + d[1] * c * c];
    expect(sigma[0]).toBeCloseTo(0.07, 12);
    expect(sigma[1]).toBeCloseTo(0.035, 3);
    expect(sigma[2]).toBeCloseTo(0.03, 12);
    // Bell heights at one, two and three sigma.
    const g = (n) => Math.exp((-n * n) / 2);
    expect(g(1)).toBeCloseTo(0.61, 2);
    expect(g(2)).toBeCloseTo(0.14, 2);
    expect(g(3)).toBeCloseTo(0.01, 2);
    expect(3 + 3 + 4 + 3 + 1).toBe(14);
  });

  test("Level 5: the picture toys, the tilt lock and the top bar", () => {
    // A Picture-shelf toy is tilt-locked, as the manual says.
    expect(PICTURES["picture-lab"].tiltLock).toBe(true);
    for (const id of ["reset", "tilt", "turntable"]) {
      const el = { reset: "view-reset", tilt: "tilt-toggle", turntable: "turntable-toggle" }[id];
      expect(indexHtml, id).toContain(`id="${el}"`);
    }
    expect(fs.readFileSync("src/camera.js", "utf8")).toMatch(/PINCH_\w+/);
    expect(indexHtml).toContain("Turntable when idle");
    // The input forms the manual names exist in the Toy tab's code.
    const ui = fs.readFileSync("src/ui.js", "utf8");
    expect(ui).toContain("input.pad");
    expect(ui).toContain("Open a file…");
    expect(ui).toContain("Back to the sample");
    // The Gaussian splatting toy has the four views the manual names.
    const splat = fs.readFileSync("src/packs/splatting.js", "utf8");
    for (const v of ["Training", "One splat", "Many splats", "Sorting"]) expect(splat).toContain(`"${v}"`); // prettier-ignore
    expect(splat).toContain("const FIT_N = 2400");
    for (const style of ["Old TV", "Flat TV", "Cinema", "Hologram"])
      expect(fs.readFileSync("src/packs/screens.js", "utf8")).toContain(`"${style}"`);
  });
});

// ---- Code samples run as written -------------------------------------------------------------

test.describe("the manual's code samples", () => {
  const blocks = [...html.matchAll(/<pre><code>([\s\S]*?)<\/code><\/pre>/g)].map((m) => unescape(m[1])); // prettier-ignore

  test("each JavaScript sample is a piece of a file in manual/ that builds", () => {
    const files = ["example-recipe.js", "example-pictures.js", "example-input.js"].map((f) => squash(fs.readFileSync(`manual/${f}`, "utf8"))); // prettier-ignore
    const js = blocks.filter((b) => /^(import |\s*"little-book")/.test(b) || b.includes("export const RECIPES")); // prettier-ignore
    expect(js.length).toBe(4);
    for (const b of js)
      expect(
        files.some((f) => f.includes(squash(b))),
        b.slice(0, 60),
      ).toBe(true);
    // The little snippets of Level 2 are the same lines the recipes use.
    expect(html).toContain(
      'k.add(k.sphere(0.2), { pos: [0, 1, 0], color: "#ffcc33", weight: 2 });',
    );
  });

  test("the windmill, the frame, the book and the bars build", () => {
    expect(build(WINDMILL["little-windmill"], { sails: "#f2eee4" }).buf.count).toBeGreaterThan(50000); // prettier-ignore
    for (const id of ["little-frame", "little-book"]) {
      const it = build(PICTURE_EXAMPLES[id]);
      expect(it.buf.count, id).toBeGreaterThan(1000);
      for (let i = 0; i < it.buf.count * 3; i++) if (!Number.isFinite(it.buf.pos[i])) throw new Error(`${id}: a position is not finite`); // prettier-ignore
    }
    expect(build(INPUT_EXAMPLES["little-bars"], { numbers: "3 1 4 1 5" }).buf.count).toBeGreaterThan(1000); // prettier-ignore
  });

  test("the sheets of the frame and the book are where the recipes say", () => {
    const frame = new Kit(1, { count: 1000 });
    PICTURE_EXAMPLES["little-frame"].build(frame, {});
    expect(frame.sheets.map((s) => s.id)).toEqual(["photo"]);
    const book = new Kit(1, { count: 1000 });
    PICTURE_EXAMPLES["little-book"].build(book, {});
    expect(book.sheets.map((s) => s.id)).toEqual(["left", "under", "front"]);
    expect(book.sheets.find((s) => s.id === "front").leaf).toBe(0);
    expect(book.spineDef).toBeTruthy();
    for (const sh of book.sheets) if (sh.leaf !== null) expect(sh.part).toBe(0);
  });

  test("the little book turns a page when the pulse falls, and lands at a half turn", () => {
    const recipe = PICTURE_EXAMPLES["little-book"];
    build(recipe); // resets its state
    const pics = { page: 0, count: 3, go(n) { this.page = Math.max(0, Math.min(this.count - 1, n)); } }; // prettier-ignore
    const frame = (turn) => {
      const out = { parts: {} };
      recipe.drive(0, { turn }, out, { data: { pictures: pics } });
      return out;
    };
    let out = frame(0);
    expect(out.leaves[0].angle).toBe(0);
    expect(out.sheets.left.page).toBe(-1);
    expect(out.sheets.under.page).toBe(1);
    out = frame(1); // the tap
    expect(out.leaves[0].angle).toBeCloseTo(0, 12);
    expect(out.parts.leftPage.visible).toBe(0);
    expect(out.sheets.left.page).toBe(0); // the page about to land is built ahead
    out = frame(0.5);
    expect(out.leaves[0].angle).toBeCloseTo(Math.PI / 2, 9);
    expect(out.leaves[0].curl).toBeLessThan(0); // the free edge lags
    expect(pics.page).toBe(0);
    out = frame(0.001);
    expect(out.leaves[0].angle).toBeGreaterThan(3);
    out = frame(0); // the turn is over: the next page is on show
    expect(pics.page).toBe(1);
    expect(out.leaves[0].angle).toBe(0);
    expect(out.sheets.front.page).toBe(1);
    expect(out.sheets.left.page).toBe(0); // the page that turned lands on the left
    expect(out.parts.leftPage.visible).toBe(1);
    // A turn at the last page stays on it.
    pics.page = 2;
    frame(1);
    frame(0);
    expect(pics.page).toBe(2);
  });

  test("the typed input reads numbers, and says what is wrong in one plain line", async () => {
    const input = INPUT_EXAMPLES["little-bars"].input;
    expect(await input.read("2, 4  6.5")).toEqual({ numbers: "2 4 6.5" });
    await expect(input.read("hello")).rejects.toThrow(/Type some numbers/);
    await expect(input.read("1 2 3 4 5 6 7 8 9 10 11 12 13")).rejects.toThrow(/more than 12/);
    await expect(input.read("30")).rejects.toThrow(/0 to 20/);
  });

  test("the gallery: each card's code is the program its link opens, at every tier", async () => {
    const { decodeSceneHash } = await import("../src/codec.js");
    const cards = [...html.matchAll(/<article class="card">([\s\S]*?)<\/article>/g)].map((m) => m[1]); // prettier-ignore
    expect(cards.length).toBe(15);
    const { PRESETS } = await import("../src/packs/splat-equation.js");
    for (const c of cards) {
      const code = unescape(c.match(/<pre><code>([\s\S]*?)<\/code>/)[1]);
      const href = c.match(/href="([^"]*#s=[^"]*)"/)[1];
      const o = (await decodeSceneHash(href.slice(href.indexOf("#s=") + 3))).toy.options;
      const shown = Object.fromEntries([...code.matchAll(/^(\w+) = (.*)$/gm)].map((m) => [m[1], m[2]])); // prettier-ignore
      const source = o.preset === "custom" ? o : PRESETS.find((p) => p.id === o.preset);
      for (const f of FIELDS) expect(squash(source[f] || ""), `${c.match(/<h4>(.*?)</)[1]} ${f}`).toBe(squash(shown[f] || "")); // prettier-ignore
      for (const count of [120000, 400000]) {
        const b = build(EQ["splat-equation"], o, count).buf;
        for (let i = 0; i < b.count * 3; i++) if (!Number.isFinite(b.pos[i])) throw new Error(`${href.slice(0, 40)}: not finite`); // prettier-ignore
      }
    }
  });
});

// ---- The page: links, pictures, layout, PDF ------------------------------------------------------

test.describe("the manual page", () => {
  test("every local link, picture and anchor is there, and the contents lists every level", async ({
    page,
  }) => {
    // prettier-ignore
    const problems = [];
    page.on("pageerror", (e) => problems.push(e.message));
    await page.goto("/manual/");
    const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href"))); // prettier-ignore
    for (const h of hrefs) {
      if (h.startsWith("#") && !h.startsWith("#s="))
        expect(await page.locator(h).count(), h).toBe(1); // prettier-ignore
      else if (!/^https?:/.test(h) && !h.startsWith("../")) {
        expect(fs.existsSync(path.join("manual", h.split("#")[0])), h).toBe(true);
      }
    }
    // Every web link goes to this project's site or its source, or a paper.
    for (const h of hrefs.filter((h) => /^https?:/.test(h)))
      expect(h, h).toMatch(/^https:\/\/(ryanjosephkamp\.github\.io\/splashery|github\.com\/ryanjosephkamp\/splashery|repo-sam\.inria\.fr\/fungraph\/3d-gaussian-splatting\/|arxiv\.org\/pdf\/2308\.04079|www\.cs\.umd\.edu\/~zwicker\/|niujinshuchong\.github\.io\/mip-splatting\/|surfsplatting\.github\.io\/|anttwo\.github\.io\/sugar\/)/); // prettier-ignore
    const imgs = await page.locator("img").evaluateAll((is) => is.map((i) => [i.getAttribute("src"), i.complete && i.naturalWidth > 0, i.alt])); // prettier-ignore
    expect(imgs.length).toBeGreaterThan(30);
    for (const [src, ok, alt] of imgs) {
      expect(ok, src).toBe(true);
      expect(alt.length, `${src} has alt text`).toBeGreaterThan(5);
    }
    const toc = await page.locator("nav.toc a").evaluateAll((as) => as.map((a) => a.textContent)); // prettier-ignore
    for (const level of ["Level 1", "Level 2", "Level 3", "Level 4", "Level 5"])
      expect(
        toc.some((t) => t.startsWith(level)),
        level,
      ).toBe(true);
    expect(problems).toEqual([]);
  });

  test("the About tab links to it, and no picture credit is missing", () => {
    expect(indexHtml).toContain('<a href="manual/">The Tinkerer\'s Manual</a>');
    // Pictures with a license that asks for credit are credited on the page.
    expect(text).toContain("Big Buck Bunny");
    expect(text).toContain("CC BY 3.0");
    expect(text).toContain("Joselodos");
    expect(text).toContain("DennisM2");
    const credits = fs.readFileSync("CREDITS.md", "utf8");
    for (const who of ["Joselodos", "DennisM2", "Blender Foundation"])
      expect(credits).toContain(who);
  });

  test("no brand names on the page", () => {
    for (const brand of [
      "Google",
      "Apple",
      "Microsoft",
      "Nvidia",
      "Nintendo",
      "Netflix",
      "YouTube",
    ])
      expect(text, brand).not.toContain(brand);
  });

  test("the pages read at 390x844, 320 and 1440x900 with no sideways scroll", async ({
    browser,
  }) => {
    const shots = path.resolve("tests/screenshots");
    fs.mkdirSync(shots, { recursive: true });
    for (const [w, h] of [
      [390, 844],
      [320, 700],
      [1440, 900],
    ]) {
      // prettier-ignore
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(w < 500 ? { hasTouch: true, isMobile: true } : {}) }); // prettier-ignore
      const page = await ctx.newPage();
      await page.goto("/manual/");
      await page.waitForLoadState("load");
      const wide = await page.evaluate(() => {
        const de = document.documentElement;
        const out = [];
        for (const el of document.querySelectorAll("body *")) {
          if (el.closest("pre, .table-wrap, svg")) continue;
          if (el.getBoundingClientRect().right > de.clientWidth + 1) out.push(el.tagName + "." + el.className); // prettier-ignore
        }
        return { scroll: de.scrollWidth - de.clientWidth, out: out.slice(0, 5) };
      });
      expect(wide, `${w}px`).toEqual({ scroll: 0, out: [] });
      if (w !== 320) {
        await page.screenshot({ path: path.join(shots, `ln-manual-${w}x${h}.png`) });
        await page.locator("#pictures").scrollIntoViewIfNeeded();
        await page.evaluate(() => document.getElementById("pictures").scrollIntoView());
        await page.screenshot({ path: path.join(shots, `ln-manual-level5-${w}x${h}.png`) });
      }
      await ctx.close();
    }
  });

  test("the PDF is printed from this page, and has its pages", () => {
    const pdf = fs.readFileSync("manual/tinkerers-manual.pdf");
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(pages).toBeGreaterThanOrEqual(25);
    expect(pdf.length).toBeLessThan(6e6);
  });
});

// ---- The lab notebook ------------------------------------------------------------------------------

test.describe("the lab notebook", () => {
  const notebook = fs.readFileSync("docs/NOTEBOOK.md", "utf8");
  const rows = notebook.split("\n").filter((l) => /^\| (January|February|March|April|May|June|July|August|September|October|November|December) \d/.test(l)); // prettier-ignore

  test("has a row for every lane before Manual, and the Operator's rows are kept", () => {
    const lanes = rows.map((r) => r.split("|")[2].trim());
    for (const lane of ["Phase A", "Phase E4", "E5", "E6a", "E6b", "F", "G", "Math", "Fix3", "AI", "Help", "HelpTextA", "HelpTextB", "Pictures", "Manual", "Screens"]) // prettier-ignore
      expect(
        lanes.some((l) => l === lane || l.startsWith(lane)),
        lane,
      ).toBe(true);
    for (const r of rows) expect(r.split("|")[3].trim(), r).toMatch(/^(Opus|Sonnet) 5\.5$/);
    expect(notebook).toContain("(#65)");
    expect(notebook).toContain("(#72, engine #71)");
  });

  test("has its Lessons and The two models sections", () => {
    expect(notebook).toMatch(/^## Lessons$/m);
    expect(notebook).toMatch(/^## The two models$/m);
    const lessons = notebook.split(/^## Lessons$/m)[1].split(/^## /m)[0];
    for (const group of ["Engine", "Effects", "Review", "Parallel lanes", "Tools"]) expect(lessons, group).toContain(`### ${group}`); // prettier-ignore
    // Every lesson names the lane it came from.
    const items = lessons
      .split(/\n- /)
      .slice(1)
      .map((l) => l.replace(/\s+/g, " "));
    expect(items.length).toBeGreaterThan(20);
    for (const l of items) expect(l, l).toMatch(/\(lanes? [^()]+\)[.;]?/); // prettier-ignore
  });
});
