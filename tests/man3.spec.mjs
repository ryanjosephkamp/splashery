// Manual r3: the October 9 review's text round for manual/index.html. The owner's own sentences
// word for word, the new definitions and "Why this number?" notes, the demo placeholders (web
// only, hidden in print), links that open in a new tab, the References section, the grammar's
// brackets and inverse trig names, and the roomier Figures 2 and 3. Screenshots man3-*.png.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOTS = path.resolve("tests/screenshots");
const html = fs.readFileSync("manual/all.html", "utf8");
// The page's text with tags dropped and white space squeezed, so line breaks in the source don't
// matter when a sentence is looked for.
const text = (h) =>
  h
    .replace(/<(pre|svg|script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
const flat = text(html);

const OWNER = [
  "A splat is a small cloud of color floating in space. Up close, it looks like a soft ellipse, bright in the middle and fading at the edges. On its own, it is nothing much. Put thousands side by side, however, and they melt into surfaces: a torus, a seashell, a cat – practically any object imaginable can be built from splats!", // prettier-ignore
  "A splat is neither a surface of triangles nor a rigid little ball.",
  "In one data dimension, a bell",
  "In three dimensions, the width",
  'A color can be a fixed quantity or vector ("#9c3b2c", or [r, g, b] with each from 0 to 1; there are no color names), or it can be a function that the kit calls for every splat.', // prettier-ignore
  "Here is the core grammar. Note: words in quotes must be typed exactly as written below.",
];

test("the owner's part-1 sentences are there word for word", () => {
  for (const sentence of OWNER) expect(flat, sentence).toContain(sentence);
  // The old wording is gone.
  expect(flat).not.toContain("not a surface of triangles and not a rigid little ball");
  expect(flat).not.toContain("a fixed one (");
  expect(flat).not.toContain("Words in quotes are typed as they are.");
  // The one-dimensional line, and the aliases as a "Flexibility" list with the code's extras.
  expect(flat).toContain("The data here are one-dimensional");
  expect(html).toMatch(/<h4>Flexibility<\/h4>/);
  const flex = html.slice(html.indexOf("<h4>Flexibility</h4>"));
  const list = text(flex.slice(0, flex.indexOf("</ul>")));
  for (const w of ["colour", "splats", "x(u,v,t)", "not case-sensitive", "after a #", "0 .. 2pi", "0 to 2pi", "0, 2pi"]) // prettier-ignore
    expect(list, w).toContain(w);
});

test("the definitions, the notes and the opening-line context are there", () => {
  for (const w of [
    "weight field", "positive widths", "quadratic form", "affine", "smoothstep", "Tilt lock",
    "Splashery's toy-building library", "the coordinates of a flat sheet", "not a substitution",
    "An atom is", "Sharp view", "if you type only a new",
  ]) // prettier-ignore
    expect(flat.toLowerCase(), w).toContain(w.toLowerCase());
  const whys = [...html.matchAll(/<details class="fold why"[^>]*>\s*<summary>([^<]*)</g)].map(
    (m) => m[1],
  );
  for (const w of ["splat budgets", "One color per splat", "Fifteen parts", "Twelve fields", "240-character", "Twelve moments", "Twelve bits", "two clocks"]) // prettier-ignore
    expect(whys.join("|").toLowerCase(), w).toContain(w.toLowerCase());
  // The three new questions are folds too.
  for (const w of ["different parts", "different fields", "each moment a part"]) expect(whys.join("|"), w).toContain(w); // prettier-ignore
  expect(whys.length).toBe(12); // Manual r5 added the one about static files
});

test("the grammar names the brackets and arcsin, arccos, arctan, and the bare-input rule", () => {
  const g = html.slice(html.indexOf("<h4>The grammar</h4>"));
  const block = g.slice(g.indexOf("<pre><code>"), g.indexOf("</code></pre>"));
  for (const w of ["arcsin", "arccos", "arctan", '"[" sum "]"', '"{" sum "}"', "sin 2u", "sin u cos u", "sin u^2"]) // prettier-ignore
    expect(block, w).toContain(w);
  expect(text(html)).toContain("sin u^2 is sin(u²), not (sin u)²");
});

const DEMOS = [
  "gaussian-3d", "splat-numbers", "bell-1d-to-3d", "projection", "sort-blend", "windmill-parts",
  "uv-torus", "program-fields", "grammar-railroad",
]; // prettier-ignore

test("every planned demo is built: none is a placeholder any more, and each is hidden in print for its still", async ({
  page,
}) => {
  await page.goto("/manual/all.html");
  await expect(page.locator("aside.demo-placeholder")).toHaveCount(0);
  for (const d of DEMOS) {
    await expect(page.locator(`section.demo-live[data-demo="${d}"]`), d).toHaveCount(1);
    await expect(page.locator(`section.demo-live[data-demo="${d}"]`)).toBeVisible();
    await expect(page.locator(`figure.demo-still[data-demo-still="${d}"]`), d).toHaveCount(1);
  }
  await page.emulateMedia({ media: "print" });
  for (const d of DEMOS) {
    await expect(page.locator(`section[data-demo="${d}"]`)).toBeHidden();
    await expect(page.locator(`figure[data-demo-still="${d}"]`)).toBeVisible();
  }
});

test("every link in the manual opens in a new tab, and chapters 6 to 10 are placeholders (the level map is gone)", async ({
  page,
}) => {
  await page.goto("/manual/all.html");
  const bad = await page.evaluate(() =>
    [...document.querySelectorAll("a[href]")]
      .filter((a) => !a.getAttribute("href").startsWith("#"))
      .filter((a) => a.target !== "_blank" || !/noopener/.test(a.rel))
      .map((a) => a.getAttribute("href").slice(0, 60)),
  );
  expect(bad).toEqual([]);
  // The cover link and "Back" are among them.
  await expect(page.locator(".cover a[href='../']")).toHaveAttribute("target", "_blank");
  await expect(page.locator("#level-map, .levelmap")).toHaveCount(0);
  for (const id of ["moving", "data", "photo3d", "codes", "make"]) await expect(page.locator(`h2#${id}.coming`)).toHaveCount(1); // prettier-ignore
  await expect(page.locator("p.coming-note")).toHaveCount(5);
  await expect(page.locator("p.coming-note").first()).toContainText("Coming in the next round");
});

test("the References section is numbered, and every citation leads to an entry", async ({
  page,
}) => {
  await page.goto("/manual/all.html");
  const refs = page.locator("ol.refs > li");
  const n = await refs.count();
  expect(n).toBeGreaterThanOrEqual(8);
  for (let i = 1; i <= n; i++) await expect(page.locator(`#ref-${i}`)).toHaveCount(1);
  const cited = await page.evaluate(() => [
    ...new Set([...document.querySelectorAll("main a[href^='#ref-']")].map((a) => a.hash.slice(1))),
  ]);
  expect(cited.length).toBeGreaterThan(5);
  for (const id of cited) await expect(page.locator(`#${id}`)).toHaveCount(1);
  // Each entry links to its source, in a new tab.
  for (const a of await page.locator("ol.refs a").all()) await expect(a).toHaveAttribute("target", "_blank"); // prettier-ignore
  await expect(page.locator("nav.toc a[href='#references']")).toHaveCount(1);
});

test("Figures 2 and 3 are roomier on the web, and the page still fits a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/manual/all.html");
  for (const label of ["Representation", "The twelve"]) {
    const svg = page.locator(`figure svg[aria-label^='${label}']`);
    const w = (await svg.boundingBox()).width;
    expect(w, label).toBeGreaterThan(420); // was 360 units
  }
  await page.screenshot({ path: path.join(SHOTS, "man3-manual-1440x900.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/manual/all.html");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: path.join(SHOTS, "man3-manual-390x844.png") });
});

test("the manual is American English with the serial comma in the lists the review named", () => {
  // The cover says the Splashery Playground, and the date is updated.
  expect(flat).toContain("Updated October 11, 2026");
  expect(flat).toContain("Splashery Playground");
  for (const list of [
    "Pictures, screens, and your own input",
    "red, green, and blue",
    "u, v, and t",
    "Kerbl, Georgios Kopanas, Thomas Leimkühler, and George Drettakis",
  ]) expect(flat, list).toContain(list); // prettier-ignore
});
