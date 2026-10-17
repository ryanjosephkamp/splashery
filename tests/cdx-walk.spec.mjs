import { test, expect } from "@playwright/test";

const scene = Buffer.from(
  JSON.stringify({
    app: "splashery",
    version: 3,
    toy: { kind: "builtin", id: "walk-inside" },
    autoplay: { turntable: false },
  }),
).toString("base64url");
async function open(page, profile = "low") {
  await page.goto(`/?labs=1&renderer=webgl2&profile=${profile}&adapt=off#s=j.${scene}`);
  await page.waitForFunction(
    () =>
      globalThis.__splashery?.player?.toyInfo?.id === "walk-inside" &&
      !globalThis.__splashery.player.loading,
  );
  await page.evaluate(() => globalThis.__splashery.app.act());
  await expect(page.locator("#walk-dialog")).toBeVisible();
  await page.waitForFunction(
    () =>
      document.querySelector("#walk-dialog")?.walk?.body &&
      !document.querySelector("#walk-dialog").walk.busy,
  );
}

test("walking code is lazy, and the new Studio entry stays behind labs", async ({ page }) => {
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/?labs=0&renderer=none");
  await page.waitForFunction(() => globalThis.__splashery?.app);
  expect(requests.filter((u) => u.includes("/src/walk/"))).toEqual([]);
  const { TOYS } = await import("../src/toys.js");
  expect(TOYS.find((t) => t.id === "walk-inside")).toMatchObject({
    labs: true,
    category: "studio",
  });
});

test("desktop walking, tap targets, character view, errors, and close/reopen", async ({ page }) => {
  await open(page, "high");
  const pos = () =>
    page.evaluate(() => document.querySelector("#walk-dialog").walk.body.pos.slice());
  const before = await pos();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(700);
  await page.keyboard.up("KeyW");
  expect((await pos())[2] - before[2]).toBeGreaterThan(0.2);
  await page.locator("#walk-lock").click();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement?.id)).toBe("walk-canvas");
  const lockedStart = await pos();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(350);
  await page.keyboard.up("KeyW");
  expect((await pos())[2] - lockedStart[2]).toBeGreaterThan(0.1);
  await page.mouse.move(730, 420);
  expect(
    await page.evaluate(() => Math.abs(document.querySelector("#walk-dialog").walk.yaw)),
  ).toBeGreaterThan(0);
  await page.evaluate(() => document.exitPointerLock());
  await expect.poll(() => page.evaluate(() => document.pointerLockElement)).toBeNull();
  await page.locator("#walk-reset").click();
  await page.locator("#walk-character").click();
  await expect
    .poll(() => page.evaluate(() => document.querySelector("#walk-dialog").walk.thirdPerson))
    .toBe(true);
  await page.locator("#walk-character").click();
  const canvas = page.locator("#walk-canvas");
  await page.waitForFunction(
    () => !document.querySelector("#walk-dialog").walk.view.joints?.root.enabled,
  );
  const r = await canvas.boundingBox();
  const tapStart = await pos();
  await page.mouse.click(r.x + r.width / 2, r.y + r.height * 0.8);
  await expect.poll(async () => (await pos())[2] - tapStart[2]).toBeGreaterThan(0.15);
  await page.locator("#walk-file").setInputFiles({
    name: "broken.ply",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("broken"),
  });
  await expect(page.locator("#walk-status")).toContainText(/PLY|read/i);
  await page.locator("#walk-reset").click();
  await page.locator("#walk-close").click();
  await expect(page.locator("#walk-dialog")).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__splashery.player.stage.renderHolds.size)).toBe(0);
  await page.evaluate(() => globalThis.__splashery.app.act());
  await page.waitForFunction(() => document.querySelector("#walk-dialog")?.walk?.body);
  await page.locator("#walk-close").click();
});

test("changing the host toy releases the walking view", async ({ page }) => {
  await open(page);
  await page.evaluate(() => globalThis.__splashery.app.chooseToy("torus"));
  await expect(page.locator("#walk-dialog")).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__splashery.player.stage.renderHolds.size)).toBe(0);
});

test("preparing Worlds’ character leaves the page responsive", async ({ page }) => {
  await open(page);
  const ticks = await page.evaluate(async () => {
    let ticks = 0;
    const timer = setInterval(() => ticks++, 10);
    try {
      await document.querySelector("#walk-dialog").walk.view.buildCharacter();
    } finally {
      clearInterval(timer);
    }
    return ticks;
  });
  expect(ticks).toBeGreaterThan(5);
});

test("phone stick and drag work together; reduced motion has no head bob", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await open(page);
  const stick = page.locator("#walk-stick");
  await expect(stick).toBeVisible();
  const r = await stick.boundingBox();
  const before = await page.evaluate(() =>
    document.querySelector("#walk-dialog").walk.body.pos.slice(),
  );
  const start = {
    pointerId: 21,
    pointerType: "touch",
    clientX: r.x + r.width / 2,
    clientY: r.y + 8,
    buttons: 1,
  };
  await stick.dispatchEvent("pointerdown", start);
  await page.locator("#walk-canvas").dispatchEvent("pointerdown", {
    pointerId: 22,
    pointerType: "touch",
    clientX: 330,
    clientY: 400,
  });
  await page.locator("#walk-canvas").dispatchEvent("pointermove", {
    pointerId: 22,
    pointerType: "touch",
    clientX: 300,
    clientY: 400,
  });
  await page.waitForTimeout(650);
  await stick.dispatchEvent("pointercancel", start);
  await page
    .locator("#walk-canvas")
    .dispatchEvent("pointercancel", { pointerId: 22, pointerType: "touch" });
  const after = await page.evaluate(() => {
    const w = document.querySelector("#walk-dialog").walk;
    return {
      pos: w.body.pos.slice(),
      yaw: w.yaw,
      input: w.controls.read(),
      reduced: w.reducedMotion,
      eye: w.view.camera.getPosition().y,
    };
  });
  expect(Math.hypot(after.pos[0] - before[0], after.pos[2] - before[2])).toBeGreaterThan(0.15);
  expect(Math.abs(after.yaw)).toBeGreaterThan(0.05);
  expect(after.input).toMatchObject({ x: 0, y: 0 });
  expect(after.reduced).toBe(true);
  expect(after.eye - after.pos[1]).toBeCloseTo(1.58, 2);
  await context.close();
});

for (const room of ["gallery", "courtyard"]) {
  test(`${room}: ten browser key scripts end within 10 cm without crossing walls or losing floor`, async ({
    page,
  }) => {
    await page.goto(`/?labs=1&renderer=webgl2&profile=low&clock=manual#s=j.${scene}`);
    await page.waitForFunction(() => globalThis.__splashery?.player?.toyInfo?.id === "walk-inside");
    await page.evaluate(async () => {
      const { openWalk } = await import("/src/walk/main.js");
      await openWalk("low");
    });
    await page.locator("#walk-place").selectOption(room);
    await page.waitForFunction(
      () =>
        document.querySelector("#walk-dialog")?.walk.body &&
        !document.querySelector("#walk-dialog").walk.busy,
    );
    let endpoint;
    for (let run = 0; run < 10; run++) {
      await page.locator("#walk-reset").click();
      await page.locator("#walk-canvas").focus();
      let failures = 0;
      for (const [keys, frames] of [
        [["KeyW"], 420],
        [["KeyW", "KeyD"], 180],
        [["KeyS"], 180],
        [["KeyA"], 150],
      ]) {
        for (const key of keys) await page.keyboard.down(key);
        failures += await page.evaluate((frames) => {
          const w = document.querySelector("#walk-dialog").walk;
          let failures = 0;
          for (let i = 0; i < frames; i++) {
            w.advance(1 / 60);
            const p = w.body.pos;
            if (
              p[1] < -0.02 ||
              Math.abs(p[0]) > 4.8 ||
              p[2] > 5.8 ||
              !w.grid.clear(p) ||
              !w.grid.support(p[0], p[2], p[1] + 0.26)
            )
              failures++;
          }
          return failures;
        }, frames);
        for (const key of keys) await page.keyboard.up(key);
      }
      const pos = await page.evaluate(() =>
        document.querySelector("#walk-dialog").walk.body.pos.slice(),
      );
      expect(failures).toBe(0);
      if (endpoint) expect(Math.hypot(...pos.map((v, a) => v - endpoint[a]))).toBeLessThan(0.1);
      endpoint = pos;
    }
  });
}
