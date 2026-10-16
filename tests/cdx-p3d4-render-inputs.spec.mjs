import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { openR4, selectR4, screens } from "../tools/cdx-p3d4-common.mjs";
import { poseR3, texturesR3 } from "../tools/cdx-p3d2-r3-common.mjs";
import { renderInputsR4 } from "../tools/cdx-p3d4-render-inputs.mjs";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
test("diagnostic identity detects a hidden background texture change and rejects other toys", async ({
  page,
  baseURL,
}) => {
  await openR4(page, baseURL + "/", screens.phone);
  await selectR4(page, { id: "forest", builtin: true }, 1, "sharp");
  await poseR3(page, 0, 0, "color", [0, 1, 0], 1);
  const source = await texturesR3(page);
  const decode = (value) => PNG.sync.read(Buffer.from(value.split(",")[1], "base64"));
  const textures = { surface: decode(source.surface), background: decode(source.background) };
  const before = await renderInputsR4(page, textures);
  expect(before.supported, before.reason).toBe(true);
  await poseR3(page, 0, 0, "color", [0, 1, 0], 1);
  const repeat = await renderInputsR4(page, textures);
  expect(repeat.sha256).toBe(before.sha256);
  await page.evaluate(() => {
    const pl = window.__splashery.player;
    const mi = pl.stage.app.scene.layers
      .getLayerByName("World")
      .meshInstances.find(
        (m) => m.material.getParameter("uDepth") && m.material.getParameter("uLayer").data[2] === 1,
      );
    const texture = mi.material.getParameter("uColor").data;
    const bytes = texture.lock(),
      index = (Math.floor(texture.height / 2) * texture.width + Math.floor(texture.width / 2)) * 4;
    window.__proofTexture = { texture, index, original: bytes[index] };
    bytes[index] ^= 1;
    texture.unlock();
  });
  // Deliberately keep the old source/background PNGs. The uploaded texture
  // bytes themselves must prevent sharing even when visible color could match.
  await poseR3(page, 0, 0, "color", [0, 1, 0], 1);
  const changed = await renderInputsR4(page, textures);
  expect(changed.supported, changed.reason).toBe(true);
  expect(changed.sha256).not.toBe(before.sha256);
  await page.evaluate(() => {
    const { texture, index, original } = window.__proofTexture;
    texture.lock()[index] = original;
    texture.unlock();
    window.__proofTexture.flipY = texture.flipY;
    texture.flipY = !texture.flipY;
  });
  await poseR3(page, 0, 0, "color", [0, 1, 0], 1);
  const changedUpload = await renderInputsR4(page, textures);
  expect(changedUpload.supported, changedUpload.reason).toBe(true);
  expect(changedUpload.sha256).not.toBe(before.sha256);
  await page.evaluate(() => {
    const { texture, flipY } = window.__proofTexture;
    texture.flipY = flipY;
    delete window.__proofTexture;
  });
  await page.evaluate(() => window.__splashery.app.chooseToy("donut"));
  await page.waitForFunction(() => {
    const pl = window.__splashery.player;
    return pl.scene.toy.id === "donut" && !pl.loading;
  });
  const unsupported = await renderInputsR4(page, textures);
  expect(unsupported.supported).toBe(false);
});
