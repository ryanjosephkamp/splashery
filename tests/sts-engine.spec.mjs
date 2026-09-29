// The Operator's engine addition for lane Studio Sound (docs/handoff/StudioSound.md):
// a recipe with input.binary gets the opened File itself, and a recipe's drive
// gets the site's Sound as info.sound. Other toys are unchanged.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function openMolecule(page) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("molecule"));
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.recipe?.input, null, { timeout: 120_000 }); // prettier-ignore
  await page.waitForSelector("#toy-input-file", { state: "attached" });
}

// Opens a small file with the Toy tab's file button and returns what read got.
async function openWith(page, binary) {
  await page.evaluate((binary) => {
    const input = window.__splashery.player.toyInfo.recipe.input;
    window.__read = input.read;
    window.__got = null;
    input.binary = binary;
    input.read = async (text, fileName, file) => {
      window.__got = { text, fileName, isFile: file instanceof File, size: file?.size ?? null };
      throw new Error("stop");
    };
  }, binary);
  await page.setInputFiles("#toy-input-file", {
    name: "tone.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]),
  });
  await page.waitForFunction(() => window.__got);
  return page.evaluate(() => {
    const input = window.__splashery.player.toyInfo.recipe.input;
    input.read = window.__read;
    delete input.binary;
    return window.__got;
  });
}

test("a recipe with input.binary gets the File; others still get the text", async ({ page }) => {
  await openMolecule(page);
  expect(await openWith(page, true)).toEqual({
    text: "",
    fileName: "tone.wav",
    isFile: true,
    size: 12,
  });
  const text = await openWith(page, false);
  expect(text).toMatchObject({ text: "RIFF\0\0\0\0WAVE", fileName: "tone.wav", isFile: false });
});

test("a recipe's drive gets the site's Sound as info.sound", async ({ page }) => {
  await openMolecule(page);
  const same = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    const recipe = player.motion.recipe;
    const drive = recipe.drive;
    let seen;
    recipe.drive = (kt, state, out, info) => {
      seen = info.sound;
      drive?.(kt, state, out, info);
    };
    for (let i = 0; i < 100 && seen === undefined; i++)
      await new Promise((r) => requestAnimationFrame(r));
    recipe.drive = drive;
    return seen === app.sound && typeof seen.audio === "function";
  });
  expect(same).toBe(true);
});
