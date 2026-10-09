// Manual r3: the October 9 review's text round for manual/index.html. The owner's own sentences
// word for word, the new definitions and "Why this number?" notes, the demo placeholders (web
// only, hidden in print), links that open in a new tab, the References section, the grammar's
// brackets and inverse trig names, and the roomier Figures 2 and 3. Screenshots man3-*.png.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOTS = path.resolve("tests/screenshots");
const html = fs.readFileSync("manual/index.html", "utf8");
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
    "An atom is", "the Sharp view", "if you type only a new",
  ]) // prettier-ignore
    expect(flat.toLowerCase(), w).toContain(w.toLowerCase());
  const whys = [...html.matchAll(/<div class="why">\s*<p><b>(Why [^<]*)</g)].map((m) => m[1]);
  for (const w of ["splat budgets", "One color per splat", "Fifteen parts", "Twelve fields", "120-character", "Twelve moments", "Twelve bits", "two clocks"]) // prettier-ignore
    expect(whys.join("|").toLowerCase(), w).toContain(w.toLowerCase());
  expect(whys.length).toBe(8);
});

test("the grammar names the brackets and arcsin, arccos, arctan, and the bare-input rule", () => {
  const g = html.slice(html.indexOf("<h4>The grammar</h4>"));
  const block = g.slice(g.indexOf("<pre><code>"), g.indexOf("</code></pre>"));
  for (const w of ["arcsin", "arccos", "arctan", '"[" sum "]"', '"{" sum "}"', "sin 2u", "sin u cos u", "sin u^2"]) // prettier-ignore
    expect(block, w).toContain(w);
  expect(text(html)).toContain("sin u^2 is sin(u²), not (sin u)²");
});

const DEMOS = [
  "gaussian-3d", "splat-numbers", "bell-1d-to-3d", "covariance-validity", "covariance-build",
  "projection", "sort-blend", "windmill-parts", "uv-torus", "program-fields",
  "order-of-operations", "grammar-railroad", "t-clock",
]; // prettier-ignore

test("every demo placeholder exists, names what it will show, and is hidden in print", async ({
  page,
}) => {
  await page.goto("/manual/");
  for (const d of DEMOS) {
    const box = page.locator(`aside.demo-placeholder[data-demo="${d}"]`);
    await expect(box, d).toHaveCount(1);
    await expect(box).toBeVisible();
    await expect(box.locator(".demo-tag")).toContainText("Demo coming");
    expect((await box.innerText()).length).toBeGreaterThan(60);
  }
  await expect(page.locator("aside.demo-placeholder")).toHaveCount(DEMOS.length);
  await page.emulateMedia({ media: "print" });
  for (const d of DEMOS) await expect(page.locator(`aside[data-demo="${d}"]`)).toBeHidden();
});

test("every link in the manual opens in a new tab, and the level map stops at Level 5", async ({
  page,
}) => {
  await page.goto("/manual/");
  const bad = await page.evaluate(() =>
    [...document.querySelectorAll("a[href]")]
      .filter((a) => !a.getAttribute("href").startsWith("#"))
      .filter((a) => a.target !== "_blank" || !/noopener/.test(a.rel))
      .map((a) => a.getAttribute("href").slice(0, 60)),
  );
  expect(bad).toEqual([]);
  // The cover link and "Back" are among them.
  await expect(page.locator(".cover a[href='../']")).toHaveAttribute("target", "_blank");
  const levels = page.locator("#level-map ol > li");
  await expect(levels).toHaveCount(5);
  await expect(page.locator("#level-map")).toContainText("More levels are coming.");
  await expect(page.locator("#level-map")).not.toContainText("Level 6");
});

test("the References section is numbered, and every citation leads to an entry", async ({
  page,
}) => {
  await page.goto("/manual/");
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
  await page.goto("/manual/");
  for (const label of ["Representation", "The twelve"]) {
    const svg = page.locator(`figure svg[aria-label^='${label}']`);
    const w = (await svg.boundingBox()).width;
    expect(w, label).toBeGreaterThan(420); // was 360 units
  }
  await page.screenshot({ path: path.join(SHOTS, "man3-manual-1440x900.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/manual/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: path.join(SHOTS, "man3-manual-390x844.png") });
});

test("the manual is American English with the serial comma in the lists the review named", () => {
  // The cover says the Splashery Playground, and the date is updated.
  expect(flat).toContain("Updated October 9, 2026");
  expect(flat).toContain("Splashery Playground");
  for (const list of [
    "Pictures, screens, and your own input",
    "red, green, and blue",
    "u, v, and t",
    "Kerbl, Georgios Kopanas, Thomas Leimkühler, and George Drettakis",
  ]) expect(flat, list).toContain(list); // prettier-ignore
});
