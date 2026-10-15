import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

const cameraKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-", "=", "_"];
const targets = [
  { name: "3D view", selector: "#stage", arrows: true, zoom: true },
  { name: "button", selector: "#view-reset", arrows: false, zoom: true },
  { name: "text field", selector: "#shelf-search", arrows: false, zoom: false },
  { name: "slider", selector: "#toy-speed", arrows: false, zoom: false },
];

async function open(page, id = "donut") {
  const scene = Buffer.from(JSON.stringify({ version: 3, toy: { kind: "builtin", id } })).toString(
    "base64url",
  );
  await page.goto(`/?renderer=webgl2&profile=weak#s=j.${scene}`);
  await page.locator("body[data-ready='true']").waitFor();
  await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id, id);
  await page.evaluate(() => {
    const camera = window.__splashery.player.camera;
    camera.turntable = false;
    camera.setTiltLock(false);
    camera.reset();
  });
}

const camera = (page) => page.evaluate(() => ({ ...window.__splashery.player.camera.tgt }));

for (const target of targets) {
  test(`camera keys with focus on the ${target.name}`, async ({ page }, testInfo) => {
    await open(page);
    if (target.name === "slider") await page.locator("#tab-play").click();
    const observations = [];
    for (const key of cameraKeys) {
      await test.step(key, async () => {
        await page.locator(target.selector).focus();
        await expect(page.locator(target.selector)).toBeFocused();
        const before = await camera(page);
        await page.keyboard.press(key);
        const after = await camera(page);
        observations.push({ key, before, after });
        const arrow = key.startsWith("Arrow");
        if (arrow && target.arrows) {
          const axis = key === "ArrowLeft" || key === "ArrowRight" ? "yaw" : "pitch";
          const direction = key === "ArrowLeft" || key === "ArrowDown" ? 1 : -1;
          expect((after[axis] - before[axis]) * direction).toBeGreaterThan(0);
          expect(after.distance).toBe(before.distance);
        } else if (!arrow && target.zoom) {
          const factor = key === "+" || key === "=" ? 0.85 : 1 / 0.85;
          expect(after.distance).toBeCloseTo(before.distance * factor, 8);
          expect(after.yaw).toBe(before.yaw);
          expect(after.pitch).toBe(before.pitch);
        } else expect(after).toEqual(before);
      });
    }
    await testInfo.attach("keyboard observations", {
      body: JSON.stringify(observations, null, 2),
      contentType: "application/json",
    });
  });
}

test("F, [, and G toggle focus mode, the desktop panel, and the gallery", async ({ page }) => {
  await open(page);
  for (const [key, className] of [
    ["f", "focus"],
    ["[", "panel-folded"],
    ["g", "gallery-page"],
  ]) {
    await page.locator("#stage").focus();
    await page.keyboard.press(key);
    await expect(page.locator("body")).toHaveClass(new RegExp(`\\b${className}\\b`));
    await page.keyboard.press(key);
    await expect(page.locator("body")).not.toHaveClass(new RegExp(`\\b${className}\\b`));
  }
});

test("text fields and Command, Control, and Option keep the shortcuts out", async ({ page }) => {
  await open(page);
  for (const modifier of [null, "Meta", "Control", "Alt"]) {
    await page.locator(modifier ? "#stage" : "#shelf-search").focus();
    const before = await camera(page);
    for (const key of [...cameraKeys, "f", "[", "g"]) {
      await page.keyboard.press(modifier ? `${modifier}+${key}` : key);
      expect(await camera(page)).toEqual(before);
    }
    await expect(page.locator("body")).not.toHaveClass(/\b(focus|panel-folded|gallery-page)\b/);
  }
});

test("the laptop gets typing keys before the app shortcuts", async ({ page }) => {
  await open(page, "laptop");
  await page.locator("#stage").focus();
  const before = await camera(page);
  // These letters are keys on the toy's keyboard; punctuation it does not
  // recognize still reaches the app, as bindKeys() intends.
  for (const key of ["f", "g"]) await page.keyboard.press(key);
  expect(await camera(page)).toEqual(before);
  await expect(page.locator("body")).not.toHaveClass(/\b(focus|panel-folded|gallery-page)\b/);
});
