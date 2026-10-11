// Manual r7b: Chapters 6 to 10 and the back matter. Each number the new chapters state is read from
// the code here, so a change to the code that makes the text wrong fails this test. Screenshots
// man7b-<page>-390x844.png (the opening of each new chapter and of each back-matter page).

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PAGES } from "../manual/pages.mjs";
import { toyHref, HOME_URL, PLAYGROUND_URL } from "../manual/links.mjs";
import { TOYS } from "../src/toys.js";
import { MATERIALS } from "../src/physics/materials.js";
import { SOFT } from "../src/physics/hands-on.js";
import { MAX_ATOMS } from "../src/molview/parse.js";
import { MAX_VOXELS } from "../src/volume/read.js";
import { PHOTO_BUDGETS } from "../src/packs/photo-3d-core.js";
import { TIERS } from "../src/video3d/frames.js";
import { MAX_SECONDS, CLIP_FPS, DEPTH_FRAMES } from "../src/packs/moving-photo.js";
import { ECC_RECOVERY, QUIET } from "../src/qr/encode.js";
import { LIMITS } from "../src/loaders.js";

const SHOTS = path.resolve("tests/screenshots");
const read = (f) => fs.readFileSync(`manual/${f}`, "utf8");
const plain = (h) =>
  h
    .replace(/<(pre|svg|script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
const NEW = { moving: 6, data: 7, photo3d: 8, codes: 9, make: 10 };
const NEW_FILES = Object.keys(NEW).map((id) => `${id}.html`);
const BACK = ["glossary", "reading", "references", "card", "later"];

test.describe("the five new chapters", () => {
  test("are in the page list in order, after Chapter 5, with the right headings", () => {
    const files = PAGES.map((p) => p.file);
    const at = files.indexOf("pictures.html");
    expect(files.slice(at + 1, at + 6)).toEqual(NEW_FILES);
    for (const [id, n] of Object.entries(NEW)) {
      const p = PAGES.find((q) => q.file === `${id}.html`);
      expect(p.chapter).toBe(n);
      expect(p.ids).toEqual([id]);
      expect(read(p.file)).toContain(`<h2 id="${id}"><span class="level">Chapter ${n}</span>`);
    }
    // Everything is built from the list, and the combined page has all five.
    const all = read("all.html");
    for (const id of Object.keys(NEW)) expect(all).toContain(`<h2 id="${id}">`);
    expect(files).not.toContain("coming.html");
  });

  test("old addresses still land: manual/#moving and coming.html#data", () => {
    const redirect = read("redirect.js");
    for (const [id] of Object.entries(NEW)) expect(redirect).toMatch(new RegExp(`\\b${id}: "${id}\\.html"`));
    const stub = read("coming.html");
    expect(stub).toContain('<script src="redirect.js"></script>');
    for (const f of NEW_FILES) expect(stub).toContain(`href="${f}"`);
  });

  test("every link that opens a toy names a real toy and opens in a new tab", () => {
    let n = 0;
    for (const f of NEW_FILES) {
      const html = read(f);
      expect(html, f).not.toContain('href="toy:');
      for (const m of html.matchAll(/<a\s+href="([^"]*#s=j\.[^"]+)"([^>]*)>/g)) {
        n++;
        expect(m[2]).toContain('target="_blank"');
        expect(m[2]).toContain("noopener");
        const scene = JSON.parse(Buffer.from(m[1].split("#s=j.")[1], "base64url").toString());
        expect(scene.toy.kind).toBe("builtin");
        expect(
          TOYS.some((t) => t.id === scene.toy.id),
          scene.toy.id,
        ).toBe(true);
        expect(m[1]).toBe(toyHref(scene.toy.id));
      }
    }
    expect(n).toBeGreaterThan(40);
  });

  test("a link names the toy's labs status in words where the toy is behind the labs switch", () => {
    // The chapters say which toys are behind the labs switch; a labs toy is never described as open
    // to everyone, and a toy open to everyone is never marked (labs).
    for (const f of NEW_FILES) {
      for (const m of read(f).matchAll(
        /<a\s+href="[^"]*#s=j\.([^"]+)"[^>]*>([^<]*)<\/a\s*>\s*\(labs\)/g,
      )) {
        const id = JSON.parse(Buffer.from(m[1], "base64url").toString()).toy.id;
        expect(TOYS.find((t) => t.id === id).labs, `${f}: ${id} is marked (labs)`).toBe(true);
      }
    }
  });
});

test.describe("the numbers in the text are the code's", () => {
  test("Chapter 6: materials, soft toys, and hands-on constants", () => {
    const t = plain(read("moving.html"));
    expect(Object.keys(MATERIALS).length).toBe(27);
    expect(t).toContain("There are 27 presets");
    expect(Object.keys(SOFT).length).toBe(61);
    expect(t).toContain("61 toys have one");
    const src = fs.readFileSync("src/physics/hands-on.js", "utf8");
    const num = (name) =>
      Number(new RegExp(`const ${name} = ([0-9./ ]+);`).exec(src)[1].replace("1 / 60", "0.016666"));
    expect(num("PRESS_MOVE")).toBe(7);
    expect(num("NUDGE")).toBe(24);
    expect(num("GRAVITY")).toBe(26);
    expect(num("THROW_MAX")).toBe(4);
    expect(num("THROW_WINDOW")).toBe(0.1);
    expect(num("HOME_SECS")).toBe(0.45);
    expect(src).toContain("sample = Math.min(count, 6000)");
    expect(src).toContain("substeps: 8");
    expect(src).toContain("hands.substeps ?? 10");
    expect(t).toContain("up to 6,000");
    expect(t).toContain("64 directions");
  });

  test("Chapter 7: molecules, volumes, stars, quakes", () => {
    const t = plain(read("data.html"));
    expect(MAX_ATOMS).toBe(250000);
    expect(t).toContain("250,000 atoms");
    expect(MAX_VOXELS).toBe(8e6);
    expect(t).toContain("8 million voxels");
    const sky = JSON.parse(fs.readFileSync("assets/toys/night-sky/sky.json", "utf8"));
    expect(sky.count).toBe(5071);
    expect(t).toContain("5,071 stars");
    const geo = fs.readFileSync("src/packs/geo.js", "utf8");
    expect(geo).toContain("0.009 + 0.006 * Math.max(0, m - 2) ** 1.4");
    expect(geo).toContain("setTimeout(() => ctl?.abort(), 9000)");
    expect(t).toContain("9 seconds");
    expect(fs.readFileSync("src/molview/load.js", "utf8")).toContain("MAX_FETCH_BYTES = 60e6");
    expect(t).toContain("over 60 MB");
  });

  test("Chapter 8: the photo budgets, the clip limits, the training tiers, the file limits", () => {
    const t = plain(read("photo3d.html"));
    expect(PHOTO_BUDGETS).toEqual({ low: 90000, mid: 210000, high: 300000, max: 400000 });
    expect(t).toContain("90,000 splats on a low device, 210,000 on a mid one, 300,000 on a high one, and 400,000 on the highest"); // prettier-ignore
    expect(MAX_SECONDS).toBe(8);
    expect([CLIP_FPS.low, CLIP_FPS.mid, CLIP_FPS.high]).toEqual([12, 15, 24]);
    expect([DEPTH_FRAMES.low, DEPTH_FRAMES.mid, DEPTH_FRAMES.high]).toEqual([24, 32, 48]);
    expect(t).toContain("up to 12, 15, or 24 frames a second");
    expect(TIERS.mid).toMatchObject({ maxFrames: 32, frameSide: 640, iters: 3000, splats: 120000 });
    expect(TIERS.high).toMatchObject({ maxFrames: 60, iters: 7000, splats: 250000 });
    expect(TIERS.phone).toMatchObject({ maxFrames: 16, iters: 1200, splats: 30000, maxMinutes: 8 });
    expect(t).toContain("trains 3,000 steps, and keeps up to 120,000 splats");
    expect(LIMITS.low).toMatchObject({ warnSplats: 400000, downsampleTo: 300000 });
    expect(LIMITS.max).toMatchObject({ warnSplats: 2000000, downsampleTo: 1500000 });
    // The Photoreal shelf, counted.
    const scans = TOYS.filter((x) => x.category === "scans");
    expect(scans.length).toBe(72);
    expect(scans.filter((x) => !x.labs).length).toBe(32);
    expect(scans.filter((x) => x.kind === "captured").length).toBe(64);
    const lic = {};
    for (const x of scans)
      if (x.credit?.license) lic[x.credit.license] = (lic[x.credit.license] || 0) + 1;
    expect(lic).toEqual({ "CC0 1.0": 16, "CC BY 4.0": 44, "CC BY-NC 4.0": 2, "CC BY-NC-SA 4.0": 1, "CC BY 2.0": 1 }); // prettier-ignore
    expect(t).toContain("16 are CC0, 44 CC BY 4.0, one CC BY 2.0, and three are NonCommercial");
  });

  test("Chapter 9: QR levels, the quiet zone, the link limit", () => {
    const t = plain(read("codes.html"));
    expect(ECC_RECOVERY).toEqual({ L: "7%", M: "15%", Q: "25%", H: "30%" });
    expect(t).toContain("about 7, 15, 25, and 30 percent");
    expect(QUIET).toBe(4);
    expect(fs.readFileSync("src/exports.js", "utf8")).toContain("LINK_LIMIT = 12 * 1024");
    expect(t).toContain("12,288 characters");
    expect(fs.readFileSync("src/qr/build.js", "utf8")).toContain('{ id: "neon", label: "Neon" }');
  });
});

test.describe("naming and the footer", () => {
  test("no page says Level 1 to 10 any more, and the old placeholder wording is gone", () => {
    for (const f of [...PAGES.map((p) => p.file), "all.html"]) {
      const t = plain(read(f));
      expect(t, f).not.toMatch(/\bLevels? \d/);
      expect(t, f).not.toContain("coming next");
    }
    expect(read("later.html")).not.toMatch(/Level 2/);
    expect(plain(read("later.html"))).toContain("full recipe (Chapter 2)");
  });

  test("the footer's Splashery opens the site's home page in a new tab, on every page", () => {
    expect(HOME_URL).toMatch(/\/splashery\/(site\/)?$/);
    for (const f of [...PAGES.map((p) => p.file), "all.html"]) {
      const html = read(f);
      const m = /<a href="([^"]+)" target="_blank" rel="noopener"\s*>\s*Splashery\s*<\/a\s*>\s*, a toy box/.exec(html); // prettier-ignore
      expect(m, f).not.toBeNull();
      expect(m[1], f).toBe(HOME_URL);
    }
    // "Back to the Splashery Playground" opens the Playground in a new tab.
    const back = /<a href="([^"]+)" target="_blank" rel="noopener">Back to the Splashery Playground<\/a>/.exec(read("index.html")); // prettier-ignore
    expect(back[1]).toBe(PLAYGROUND_URL.startsWith("https") ? back[1] : back[1]);
    expect(["../", "../playground/"]).toContain(back[1]);
  });
});

test.describe("the back matter", () => {
  test("every reference is cited, every citation has a reference, one numbered list", () => {
    const refs = read("references.html");
    const ids = [...refs.matchAll(/<li id="ref-(\d+)">/g)].map((m) => Number(m[1]));
    expect(ids).toEqual(ids.map((_, i) => i + 1));
    expect(ids.length).toBeGreaterThanOrEqual(22);
    const cited = new Set();
    for (const f of PAGES.map((p) => p.file).filter((f) => f !== "references.html"))
      for (const m of read(f).matchAll(/references\.html#ref-(\d+)/g)) cited.add(Number(m[1]));
    for (const id of ids) expect(cited.has(id), `reference ${id} is cited somewhere`).toBe(true);
    for (const c of cited) expect(ids).toContain(c);
  });

  test("the further reading opens every link in a new tab and names robotics work", () => {
    const html = read("reading.html");
    const t = plain(html);
    for (const w of ["SplaTAM", "Splat-Nav", "GaussianGrasper", "Gaussian Splatting SLAM"]) expect(t).toContain(w); // prettier-ignore
    for (const m of html.matchAll(/<a\s+href="http[^"]*"([^>]*)>/g)) {
      expect(m[1]).toContain('target="_blank"');
    }
    expect((html.match(/<li>/g) || []).length).toBeGreaterThanOrEqual(25);
  });

  test("the glossary has the new terms, each with a title and a definition", () => {
    const g = read("glossary.html");
    const entries = [...g.matchAll(/<dt id="(g-[^"]+)">([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)];
    expect(entries.length).toBeGreaterThanOrEqual(50);
    for (const id of ["g-part", "g-handson", "g-xpbd", "g-voxel", "g-depth", "g-ecc", "g-fragment", "g-training"]) // prettier-ignore
      expect(entries.map((e) => e[1])).toContain(id);
    const ids = entries.map((e) => e[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("the quick reference holds the grammar, the controls, and the key numbers", () => {
    const t = plain(read("card.html"));
    for (const w of ["The controls", "Key numbers", "A recipe", "One splat", "A splat program"]) expect(t).toContain(w); // prettier-ignore
  });
});

test.describe("on a phone", () => {
  for (const f of [...NEW_FILES, ...BACK.map((b) => `${b}.html`)]) {
    test(`${f}: no sideways scroll, and a screenshot of its opening`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); // prettier-ignore
      const page = await ctx.newPage();
      await page.goto(`/manual/${f}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0); // prettier-ignore
      await page.screenshot({
        path: path.join(SHOTS, `man7b-${f.replace(".html", "")}-390x844.png`),
      });
      await ctx.close();
    });
  }
});
