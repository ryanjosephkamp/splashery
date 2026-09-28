// Lane Help's own checks (docs/OPERATING.md): the how-to-play line that shows
// when a toy opens (from the shelf, a link or a refresh) and fades, the "?"
// button that shows it again, "About this toy" in the About tab, and the
// shared list src/toy-help.js (every toy gets a line; it loads lazily).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { TOYS } from "../src/toys.js";
import { RIGS } from "../src/rigs.js";
import { encodeSceneHash } from "../src/codec.js";
import { TOY_HELP, toyHelp } from "../src/toy-help.js";

const SHOTS = "tests/screenshots";
// The line shows by itself in an automated browser only with ?help=show.
const WEBGL = "/?renderer=webgl2&profile=weak&help=show";

async function loadApp(page, url = WEBGL) {
  await page.goto(url);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

async function waitForToy(page, label) {
  await expect(page.locator("#toy-status")).toHaveText(new RegExp(`^${label}`), {
    timeout: 180_000,
  });
}

async function pick(page, id, label) {
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await waitForToy(page, label);
}

function watchConsole(page) {
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

const line = (page) => page.locator("#help-line");
const lineText = (page) => page.locator("#help-line-text");

// What the app knows about a shelf toy, as the help list sees it.
async function infoFor(t) {
  if (t.kind === "kit") {
    const { RECIPES } = await import(`../src/packs/${t.pack}.js`);
    return { id: t.id, label: t.label, kind: "kit", recipe: RECIPES[t.id] };
  }
  const rig = RIGS[t.id] || null;
  const optionDefs = t.looks ? [{ key: "look", label: "Look", type: "select" }] : undefined;
  return { id: t.id, label: t.label, kind: t.kind, recipe: rig, rig, optionDefs };
}

test.describe("toy help: the list", () => {
  test("every toy gets a non-empty how-to line and a short one", async () => {
    for (const t of TOYS) {
      const h = toyHelp(await infoFor(t));
      expect(h.howTo, t.id).toMatch(/\S/);
      expect(h.howTo.length, `${t.id}: ${h.howTo}`).toBeLessThanOrEqual(110);
      expect(h.abilities.length, t.id).toBeGreaterThan(0);
    }
    // A file of your own and a toy you made get sensible text too.
    const file = toyHelp({ id: null, label: "mine.ply", kind: "file" });
    expect(file.howTo).toBe("Tap it to make it hop.");
    expect(file.about[0]).toMatch(/your device/);
    const made = toyHelp({ id: null, label: "Your toy", kind: "procedural" });
    expect(made.howTo).toMatch(/Make tab/);
  });

  test("every entry names a shelf toy and has plain, checked text", () => {
    const ids = new Set(TOYS.map((t) => t.id));
    for (const [id, e] of Object.entries(TOY_HELP)) {
      expect(ids.has(id), `${id} is not a shelf toy`).toBe(true);
      expect(
        Object.keys(e).every((k) => k === "howTo" || k === "about"),
        id,
      ).toBe(true);
      if (e.howTo) expect(e.howTo, id).toMatch(/^[A-Z].*[.!?]$/);
      if (e.about) {
        const words = e.about.split(/\s+/).length;
        expect(words, `${id}: ${words} words`).toBeGreaterThanOrEqual(40);
        expect(words, `${id}: ${words} words`).toBeLessThanOrEqual(180);
      }
    }
  });

  test("toy-help.js is never a static import of the page", () => {
    const html = fs.readFileSync("index.html", "utf8");
    expect(html).not.toMatch(/<(script|link)[^>]*toy-help/);
    for (const f of fs.readdirSync("src").filter((f) => f.endsWith(".js"))) {
      const src = fs.readFileSync(path.join("src", f), "utf8");
      expect(src, f).not.toMatch(/^\s*import[^(]*["']\.\/toy-help\.js["']/m);
    }
  });
});

test.describe("toy help: the line", () => {
  test("shows on a pick, fades, and '?' brings it back", async ({ page }) => {
    const problems = watchConsole(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loadApp(page);
    await pick(page, "puzzle-cube", "Puzzle cube");
    await expect(line(page)).toBeVisible();
    await expect(lineText(page)).toHaveText(TOY_HELP["puzzle-cube"].howTo);
    await expect(page.locator("#help-toggle")).toHaveAttribute("aria-expanded", "true");
    // It fades after a few seconds.
    await expect(line(page)).toBeHidden({ timeout: 15_000 });
    await expect(page.locator("#help-toggle")).toHaveAttribute("aria-expanded", "false");
    // "?" shows it again, and a second press hides it.
    await page.click("#help-toggle");
    await expect(line(page)).toBeVisible();
    await expect(lineText(page)).toHaveText(TOY_HELP["puzzle-cube"].howTo);
    await page.click("#help-toggle");
    await expect(line(page)).toBeHidden({ timeout: 5_000 });
    // A new toy shows its own line; an option on the same toy does not.
    await pick(page, "xylophone", "Xylophone");
    await expect(lineText(page)).toHaveText(TOY_HELP.xylophone.howTo);
    await expect(line(page)).toBeVisible();
    await pick(page, "dice", "Dice");
    await expect(line(page)).toBeVisible();
    await expect(line(page)).toBeHidden({ timeout: 15_000 });
    await page.evaluate(() => window.__splashery.app.setToyOption("kind", "d20"));
    await page.waitForTimeout(2500);
    await expect(line(page)).toBeHidden();
    // Nothing of it goes into the scene.
    const scene = await page.evaluate(() => JSON.stringify(window.__splashery.exportScene()));
    expect(scene).not.toMatch(/help|howTo/i);
    expect(problems).toEqual([]);
  });

  test("shows after a refresh and from a link, old links included", async ({ page }) => {
    const problems = watchConsole(page);
    const hash = await encodeSceneHash({
      app: "splashery",
      version: 2,
      seed: 12,
      toy: { kind: "builtin", id: "donut" },
      effects: { twist: { on: true, amount: 0.4, wobble: 0, axis: "y" } },
      autoplay: { turntable: false, effect: "none" },
    });
    await loadApp(page, `${WEBGL}#s=${hash}`);
    await waitForToy(page, "Donut");
    await expect(line(page)).toBeVisible();
    await expect(lineText(page)).toHaveText("Tap it: Break apart.");
    const s = await page.evaluate(() => window.__splashery.exportScene());
    expect(s.effects.twist).toMatchObject({ on: true, amount: 0.4 });
    // A new link (version 3) to the snail, then a refresh.
    await pick(page, "snail", "Snail");
    const link = await page.evaluate(() => window.__splashery.app.copyLink());
    await loadApp(page, `${WEBGL}${new URL(link).hash}`);
    await waitForToy(page, "Snail");
    await expect(lineText(page)).toHaveText(TOY_HELP.snail.howTo);
    await expect(line(page)).toBeVisible();
    await expect(line(page)).toBeHidden({ timeout: 15_000 });
    await page.reload();
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await waitForToy(page, "Snail");
    await expect(line(page)).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("a saved scene (JSON) still loads and shows its toy's line", async ({ page }) => {
    const problems = watchConsole(page);
    await loadApp(page);
    await pick(page, "chess-set", "Chess set");
    const scene = await page.evaluate(() => window.__splashery.exportScene());
    await pick(page, "dice", "Dice");
    await page.setInputFiles("#import-json", {
      name: "chess.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(scene)),
    });
    await waitForToy(page, "Chess set");
    await expect(lineText(page)).toHaveText(TOY_HELP["chess-set"].howTo);
    await expect(line(page)).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("an automated browser without ?help=show gets only the '?' button", async ({ page }) => {
    await loadApp(page, "/?renderer=webgl2&profile=weak");
    await expect(page.locator("#help-toggle")).toBeVisible();
    await expect(line(page)).toBeHidden();
    await page.click("#help-toggle");
    await expect(line(page)).toBeVisible();
    await expect(lineText(page)).not.toBeEmpty();
  });

  test("loads its text after the first paint", async ({ page }) => {
    await loadApp(page);
    await expect(line(page)).toBeVisible();
    const t = await page.evaluate(() => {
      const paint = performance.getEntriesByType("paint")[0];
      const res = performance
        .getEntriesByType("resource")
        .find((e) => e.name.includes("/src/toy-help.js"));
      return { paint: paint?.startTime ?? null, help: res?.startTime ?? null };
    });
    expect(t.paint).not.toBeNull();
    expect(t.help).not.toBeNull();
    expect(t.help).toBeGreaterThan(t.paint);
  });

  test("respects reduced motion: no fade, still shown and hidden", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await loadApp(page);
    await expect(line(page)).toBeVisible();
    const d = await line(page).evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(d.split(",").every((x) => parseFloat(x) === 0)).toBe(true);
    await expect(line(page)).toBeHidden({ timeout: 15_000 });
    await ctx.close();
  });

  test("the embed shows no line", async ({ page }) => {
    const hash = await encodeSceneHash({
      app: "splashery",
      version: 3,
      toy: { kind: "builtin", id: "puzzle-cube" },
    });
    const asked = [];
    page.on("request", (r) => asked.push(r.url()));
    await page.goto(`/embed/?renderer=webgl2#s=${hash}`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.waitForTimeout(1500);
    expect(await page.locator("#help-line, #help-toggle").count()).toBe(0);
    expect(asked.some((u) => u.includes("toy-help"))).toBe(false);
  });
});

// The line never covers the toy: with everything else on top of the stage
// hidden, the stage under the line's box is plain background.
async function inkUnderLine(page) {
  const box = await line(page).boundingBox();
  await page.addStyleTag({
    content:
      ".brand, #toy-status, #help-line, #help-toggle, #sound-toggle, #game-bar, #panel { visibility: hidden !important; }",
  });
  const buf = await page.screenshot({
    clip: { x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8 },
  });
  await page.evaluate(() => document.querySelector("style:last-of-type").remove());
  const png = PNG.sync.read(buf);
  const bg = [png.data[0], png.data[1], png.data[2]];
  let ink = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const d = Math.max(...[0, 1, 2].map((k) => Math.abs(png.data[i + k] - bg[k])));
    if (d > 24) ink++;
  }
  return { ink, bg, box };
}

for (const [w, h] of [
  [390, 844],
  [1440, 900],
]) {
  test(`the line stays clear of the toy at ${w}x${h}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: "light" }); // prettier-ignore
    const page = await ctx.newPage();
    const problems = watchConsole(page);
    await loadApp(page);
    const toys = [
      ["cactus", "Cactus"],
      ["eiffel-tower", "Eiffel Tower"],
      ["puzzle-cube", "Puzzle cube"],
      ["chess-set", "Chess set"],
      ["xylophone", "Xylophone"],
      ["molecule", "Molecule"],
      ["fourier-circles", "Fourier circles"],
    ];
    for (const [id, label] of toys) {
      await pick(page, id, label);
      await page.waitForTimeout(1200);
      await expect(line(page)).toBeVisible();
      // Clear of the toy's name line too (a scan's credit wraps it on a phone).
      const status = await page.locator("#toy-status").boundingBox();
      const own = await line(page).boundingBox();
      if (w < 760) expect(own.y, id).toBeGreaterThanOrEqual(status.y + status.height);
      const { ink, bg, box } = await inkUnderLine(page);
      // The page's own background (light theme), and not a pixel of toy.
      expect(bg, id).toEqual([255, 255, 255]);
      expect(ink, `${id}: ${ink} toy pixels under the line at ${JSON.stringify(box)}`).toBe(0);
    }
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.click("#help-toggle");
    await pick(page, "puzzle-cube", "Puzzle cube");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SHOTS, `help-line-${w}x${h}.png`) });
    expect(problems).toEqual([]);
    await ctx.close();
  });
}

test.describe("toy help: About this toy", () => {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    test(`shows the toy's text, or the default, at ${w}x${h}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await loadApp(page);
      await pick(page, "puzzle-cube", "Puzzle cube");
      // The line's link opens the About tab (and the sheet on a phone).
      await page.click("#help-line-about");
      await expect(page.locator("#pane-about")).toBeVisible();
      await expect(page.locator("#toy-about-name")).toHaveText("Puzzle cube");
      const first = TOY_HELP["puzzle-cube"].about.split("\n\n")[0];
      await expect(page.locator("#toy-about-text p").first()).toHaveText(first);
      await expect(page.locator("#toy-about-howto")).toHaveText(TOY_HELP["puzzle-cube"].howTo);
      await expect(page.locator("#toy-about-can")).toContainText("Scramble or solve.");
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, `help-about-${w}x${h}.png`) });
      // A toy with no entry: the default line and a note.
      if (w < 760) await page.click("#sheet-toggle");
      await pick(page, "basketball", "Basketball");
      if (w < 760) await page.click("#sheet-toggle");
      await page.click("#tab-about");
      await expect(page.locator("#toy-about-name")).toHaveText("Basketball");
      await expect(page.locator("#toy-about-text")).toContainText("on its way");
      await expect(page.locator("#toy-about-howto")).toHaveText(
        "Tap it: Dribble and spin. More in the Toy tab.",
      );
      await ctx.close();
    });
  }
});
