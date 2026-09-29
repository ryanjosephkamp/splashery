// The Operator's engine addition for lane Studio Models (docs/handoff/StudioModels.md): a
// recipe with input.binary and input.multiple gets every picked file (a glTF model with its
// .bin, an OBJ with its MTL). Other input panels still pick one file.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&adapt=off&profile=mid";

async function openMolecule(page) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("molecule"));
  await page.waitForFunction(() => window.__splashery.player.toyInfo?.recipe?.input, null, { timeout: 120_000 }); // prettier-ignore
  await page.waitForSelector("#toy-input-file", { state: "attached" });
}

test("a recipe with input.multiple gets every picked file", async ({ page }) => {
  await openMolecule(page);
  // The molecule's own panel picks one file.
  expect(await page.locator("#toy-input-file").evaluate((el) => el.multiple)).toBe(false);
  // Its recipe turned into a multi-file binary panel, and the Toy tab built again.
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    const input = player.toyInfo.recipe.input;
    window.__got = null;
    input.binary = true;
    input.multiple = true;
    input.read = async (text, fileName, file, files) => {
      window.__got = { text, fileName, isFile: file instanceof File, names: files.map((f) => f.name) }; // prettier-ignore
      throw new Error("stop");
    };
    app.ui.setToyPanel(player.toyInfo);
  });
  expect(await page.locator("#toy-input-file").evaluate((el) => el.multiple)).toBe(true);
  await page.setInputFiles("#toy-input-file", [
    { name: "box.gltf", mimeType: "model/gltf+json", buffer: Buffer.from('{"asset":{}}') },
    { name: "box.bin", mimeType: "application/octet-stream", buffer: Buffer.from([1, 2, 3]) },
  ]);
  await page.waitForFunction(() => window.__got);
  expect(await page.evaluate(() => window.__got)).toEqual({
    text: "",
    fileName: "box.gltf",
    isFile: true,
    names: ["box.gltf", "box.bin"],
  });
});
