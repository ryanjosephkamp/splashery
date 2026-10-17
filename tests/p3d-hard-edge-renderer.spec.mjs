import { test, expect } from "@playwright/test";

test("Layered H binds Classic fallback colors independently from its filled backing", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']");
  const result = await page.evaluate(async () => {
    const [{ ReliefMesh: Classic }, { ReliefMesh: H }] = await Promise.all([
      import("/src/live/relief-mesh.js"),
      import("/src/photo3d/next/relief.js"),
    ]);
    const pl = window.__splashery.player;
    pl.setPaused(true);
    const layer = pl.stage.app.scene.layers.getLayerByName("World"),
      before = layer.meshInstances.length,
      rgba = (color) => Uint8Array.from({ length: 8 * 8 * 4 }, (_, i) => color[i % 4]),
      old = rgba([0, 0, 255, 255]),
      filled = rgba([255, 128, 0, 255]),
      photo = { w: 8, h: 8, data: rgba([0, 255, 0, 255]) },
      depth = Uint8Array.of(50, 200, 50, 200),
      band = Uint8Array.of(0, 3, 0, 3),
      classic = new Classic(pl.stage, { cols: 8, rows: 8 }),
      h = new H(pl.stage, { cols: 8, rows: 8 }),
      same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    try {
      for (const m of [classic, h]) {
        m.setColor(photo);
        m.setDepth({ w: 2, h: 2, data: depth });
        m.setPieces({ band, depth, gx: 2, gy: 2, base: 0.5 });
      }
      classic.setBackground({ w: 8, h: 8, rgba: old });
      h.setBackground({ w: 8, h: 8, rgba: filled, classicRgba: old });
      const foreground = h.matS.getParameter("uBackground").data,
        backing = h.matB.getParameter("uColor").data;
      const checks = {
        foregroundMatchesClassic: same(
          foreground._levels[0],
          classic.matS.getParameter("uBackground").data._levels[0],
        ),
        backingMatchesFilled: same(backing._levels[0], filled),
        independentTextures: foreground !== backing,
        glslUnchanged:
          h.matS.shaderDesc.fragmentGLSL === classic.matS.shaderDesc.fragmentGLSL &&
          h.matS.shaderDesc.vertexGLSL === classic.matS.shaderDesc.vertexGLSL,
        wgslUnchanged:
          h.matS.shaderDesc.fragmentWGSL === classic.matS.shaderDesc.fragmentWGSL &&
          h.matS.shaderDesc.vertexWGSL === classic.matS.shaderDesc.vertexWGSL,
        extraBytes: h.cost().total - classic.cost().total,
      };
      h.setColor(photo);
      checks.fallbackSurvivesColorUpload = same(
        h.matS.getParameter("uBackground").data._levels[0],
        old,
      );
      return checks;
    } finally {
      h.destroy();
      classic.destroy();
      if (layer.meshInstances.length !== before)
        throw new Error("A renderer left mesh instances behind");
    }
  });
  expect(result).toEqual({
    foregroundMatchesClassic: true,
    backingMatchesFilled: true,
    independentTextures: true,
    glslUnchanged: true,
    wgslUnchanged: true,
    extraBytes: 256,
    fallbackSurvivesColorUpload: true,
  });
});
