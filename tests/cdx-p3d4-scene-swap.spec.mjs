import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

test("ordinary non-photo swaps draw without a capture and free each retired scene after three draws", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/GL_INVALID|sampler type|destroyed texture/i.test(message.text()))
      errors.push(message.text());
  });
  await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const result = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    const stage = player.stage,
      pc = await import("/src/pc.js");
    player.setPaused(true);
    player.idle.weight = 0;
    player.opts.idleDelay = 1e9;
    stage.setFixedSize([585, 1266]);
    const until = async (predicate) => {
      const deadline = performance.now() + 20000;
      while (!predicate()) {
        if (performance.now() > deadline)
          throw new Error("An ordinary swap did not finish drawing and retiring its scene.");
        await new Promise(requestAnimationFrame);
      }
    };
    await app.chooseToy("donut");
    await until(() => !player.loading && stage.toy && !stage.graveyard.length);
    for (let i = 0; i < 5; i++) await stage.captureFrame();
    let draws = 0;
    const onDraw = () => draws++;
    stage.app.on("postrender", onDraw);
    const rows = [];
    try {
      for (const id of ["molecule", "donut", "molecule", "donut", "molecule", "donut"]) {
        const old = stage.toy,
          ownedTextures = new Set(),
          seen = new Set();
        const findTextures = (value, depth = 0) => {
          if (!value || typeof value !== "object" || seen.has(value) || ArrayBuffer.isView(value))
            return;
          seen.add(value);
          if (value instanceof pc.Texture) {
            ownedTextures.add(value);
            return;
          }
          if (depth > 4) return;
          if (value instanceof Map || value instanceof Set) {
            for (const item of value.values()) findTextures(item, depth + 1);
          } else {
            for (const [key, item] of Object.entries(value))
              if (!["device", "impl", "_format", "format"].includes(key))
                findTextures(item, depth + 1);
          }
        };
        findTextures(old.resource.streams);
        for (const name of ["paintColor", "splatPart"])
          findTextures(old.entity.gsplat.getInstanceTexture(name));
        const textureDestroys = new Map();
        for (const texture of ownedTextures) {
          const destroy = texture.destroy;
          textureDestroys.set(texture, 0);
          texture.destroy = function (...args) {
            textureDestroys.set(texture, textureDestroys.get(texture) + 1);
            return destroy.apply(this, args);
          };
        }
        let retiredAt = null,
          destroyedAt = null,
          entityDestroys = 0,
          resourceDestroys = 0;
        const clear = stage.clearToy,
          destroyEntity = old.entity.destroy,
          destroyResource = old.resource.destroy;
        stage.clearToy = function (...args) {
          if (this.toy === old) retiredAt = draws;
          return clear.apply(this, args);
        };
        old.entity.destroy = function (...args) {
          entityDestroys++;
          destroyedAt = draws;
          return destroyEntity.apply(this, args);
        };
        old.resource.destroy = function (...args) {
          resourceDestroys++;
          return destroyResource.apply(this, args);
        };
        const beforeDraws = draws;
        try {
          await app.chooseToy(id);
          // No explicit capture may wake a stuck hold or hide a blank normal handoff.
          await until(
            () =>
              !player.loading &&
              player.scene.toy.id === id &&
              draws > beforeDraws &&
              !stage.graveyard.length,
          );
        } finally {
          stage.clearToy = clear;
        }
        for (let i = 0; i < 5; i++) await stage.captureFrame();
        const canvas = await stage.captureFrame(),
          g = canvas.getContext("2d"),
          pixels = g.getImageData(0, 0, canvas.width, canvas.height).data;
        let foreground = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i + 3] && Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 235)
            foreground++;
        const digest = await crypto.subtle.digest("SHA-256", pixels);
        rows.push({
          id,
          owned: old.owned,
          retired: retiredAt !== null,
          retireDraws: destroyedAt - retiredAt,
          entityDestroys,
          resourceDestroys,
          ownedTextures: ownedTextures.size,
          textureDestroys: [...textureDestroys.values()],
          oldTexturesRemaining: [...ownedTextures].filter((t) => stage.device.textures.has(t))
            .length,
          graveyard: stage.graveyard.length,
          holds: stage.renderHolds?.size || 0,
          foreground,
          rgbaSha256: [...new Uint8Array(digest)]
            .map((v) => v.toString(16).padStart(2, "0"))
            .join(""),
          textureCount: stage.device.textures.size,
          textureBytes: stage.device._vram.tex,
        });
      }
    } finally {
      stage.app.off("postrender", onDraw);
    }
    return rows;
  });
  await info.attach("ordinary-scene-swaps.json", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  expect(result).toHaveLength(6);
  for (const row of result) {
    expect(row.owned, row.id).toBe(true);
    expect(row.retired, row.id).toBe(true);
    expect(row.retireDraws, row.id).toBe(3);
    expect(row.entityDestroys, row.id).toBe(1);
    expect(row.resourceDestroys, row.id).toBe(1);
    expect(row.ownedTextures, row.id).toBeGreaterThanOrEqual(4);
    expect(
      row.textureDestroys.every((n) => n === 1),
      row.id,
    ).toBe(true);
    expect(row.oldTexturesRemaining, row.id).toBe(0);
    expect(row.graveyard, row.id).toBe(0);
    expect(row.holds, row.id).toBe(0);
    expect(row.foreground, row.id).toBeGreaterThan(500);
  }
  const repeat = result.filter((row) => row.id === "donut");
  expect(new Set(repeat.map((row) => row.textureCount)).size).toBe(1);
  expect(new Set(repeat.map((row) => row.textureBytes)).size).toBe(1);
  expect(errors).toEqual([]);
});
