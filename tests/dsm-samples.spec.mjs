// Lane Dot samples: the AI-made pictures that ship as Photo to 3D samples (docs/handoff/DotSamples.md).
// Each is labeled AI-made, recorded in CREDITS.md and tools/assets.json, has its picture and depth map,
// and loads and builds in the browser.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { DOT_SAMPLES, AI_GROUP } from "../src/packs/dot-samples.js";
import { ALL_SAMPLES, SAMPLES, RECIPES, unpackDepth } from "../src/packs/photo-3d.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const assets = JSON.parse(fs.readFileSync("tools/assets.json", "utf8"));
const credits = fs.readFileSync("CREDITS.md", "utf8");

test.describe("the AI-made samples' records", () => {
  test("there are samples, with unique ids, none of them in the CC0 six's place", () => {
    expect(DOT_SAMPLES.length).toBeGreaterThanOrEqual(20);
    const ids = ALL_SAMPLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SAMPLES.length).toBe(6); // the originals keep their list
    for (const s of DOT_SAMPLES) expect(s.id).toMatch(/^dot-[a-z-]+$/);
  });

  test("each is labeled AI-made in the picker, its label and its credit", () => {
    for (const s of DOT_SAMPLES) {
      expect(s.ai).toBe(true);
      expect(s.label, s.id).toMatch(/\(AI-made\)$/);
      expect(s.group.startsWith(AI_GROUP), s.id).toBe(true);
      expect(s.license).toBe("AI-made by the owner");
      expect(s.title, s.id).toMatch(/AI-made/);
      expect(s.author).toMatch(/AI image tool/);
    }
    const choices = RECIPES["photo-3d"].options.find((o) => o.key === "source").choices;
    for (const s of DOT_SAMPLES) expect(choices.find((c) => c.id === s.id)?.group).toBe(s.group);
    expect(choices.at(-1).id).toBe("custom");
    const credit = RECIPES["photo-3d"].credits;
    for (const s of DOT_SAMPLES) expect(credit.some((c) => c.label === s.label)).toBe(true);
  });

  test("each has a picture and a depth map, a CREDITS.md line and a tools/assets.json entry", () => {
    for (const s of DOT_SAMPLES) {
      const img = `assets/toys/photo-3d/ai/${s.file}.webp`;
      const dep = `assets/toys/photo-3d/ai/${s.file}.depth`;
      expect(fs.existsSync(img), img).toBe(true);
      const head = fs.readFileSync(img).subarray(0, 12);
      expect(head.subarray(0, 4).toString()).toBe("RIFF");
      expect(head.subarray(8, 12).toString()).toBe("WEBP");
      expect(fs.statSync(img).size).toBeLessThan(500_000);
      const d = unpackDepth(new Uint8Array(fs.readFileSync(dep)));
      expect(d.w * d.h).toBeGreaterThan(10_000);
      expect(credits, s.id).toContain(`(${s.prompt}): \`${img}\``);
      const a = assets.photoSamples.find((x) => x.id === s.id);
      expect(a?.license, s.id).toBe("AI-made by the owner");
      expect(a.ai).toBe(true);
      expect(a.file).toBe(img);
    }
  });

  test("only whole files that are samples are in ai/ (a rejected picture is never committed)", () => {
    const known = new Set(DOT_SAMPLES.flatMap((s) => [`${s.file}.webp`, `${s.file}.depth`]));
    for (const f of fs.readdirSync("assets/toys/photo-3d/ai")) expect(known.has(f), f).toBe(true);
  });
});

test.describe("in the browser", () => {
  test("every AI-made sample loads and builds with its picture", async ({ page }) => {
    test.setTimeout(300_000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate(() => window.__splashery.app.chooseToy("photo-3d"));
    for (const { id, label } of DOT_SAMPLES) {
      await page.evaluate((id) => window.__splashery.app.setToyOptions({ source: id }), id);
      await page.waitForFunction(
        (label) => {
          const p = window.__splashery.player.proc?.ctx?.kit?.data?.photo;
          return p && p.splats > 5000 && p.name === label;
        },
        label,
        { timeout: 90_000 },
      );
    }
    expect(errors).toEqual([]);
  });
});
