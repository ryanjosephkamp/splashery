// Frozen task-65 inputs copied unchanged. Expectations come from their historical
// contracts, rather than current normalization or the document just downloaded.
import { test, expect } from "@playwright/test";
import fs from "node:fs";

const fixtures = ["r2-shelf-studio.json", "r2-moving-photo.json", "r2-video-camera.json"].map(
  (name) => {
    const { $comment, $compat, ...scene } = JSON.parse(
      fs.readFileSync(new URL(`./fixtures/cdx-saved-startup/${name}`, import.meta.url)),
    );
    return { name, scene, expected: $compat.expected };
  },
);
const query = "?renderer=webgl2&profile=weak&labs=1";
test.use({ viewport: { width: 400, height: 300 }, reducedMotion: "reduce" });

async function ready(page) {
  await page.waitForFunction(
    () => document.body.dataset.ready === "true" && !!window.__splashery?.player?.stage?.toy,
    null,
    { timeout: 15_000 },
  );
  await page.waitForFunction(() => window.__splashery.player.time > 0);
}
function camera(actual, expected) {
  expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
  for (const key of ["yaw", "pitch", "roll", "distance"])
    expect(actual[key], key).toBeCloseTo(expected[key], 3);
  expect(actual.pan).toEqual(expected.pan);
}
async function save(page, testInfo, label, expected) {
  if (!(await page.locator("#panel-body").isVisible())) await page.locator("#sheet-toggle").click();
  await page.locator("#tab-share").click();
  const pending = page.waitForEvent("download");
  await page.locator("#export-json").click();
  const download = await pending;
  const bytes = fs.readFileSync(await download.path());
  await testInfo.attach(label, { body: bytes, contentType: "application/json" });
  const actual = JSON.parse(bytes);
  delete actual.createdAt;
  const { camera: pose, ...settings } = actual;
  const { camera: wanted, ...wantedSettings } = expected;
  expect(settings).toEqual(wantedSettings);
  camera(pose, wanted);
  return bytes;
}

for (const fixture of fixtures) {
  for (const version of [2, 3]) {
    test(`saved v${version} ${fixture.scene.toy.id}: startup, download, and fresh reload`, async ({
      browser,
    }, testInfo) => {
      test.setTimeout(120_000);
      const scene = { ...fixture.scene, version };
      const hash = `j.${Buffer.from(JSON.stringify(scene)).toString("base64url")}`;
      let bytes;
      for (const surface of ["embed", "app", "reload"]) {
        const context = await browser.newContext({
          viewport: { width: 400, height: 300 },
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        try {
          await page.goto(
            `${surface === "embed" ? "/embed/" : "/"}${query}${surface === "reload" ? "" : `#s=${hash}`}`,
          );
          await ready(page);
          if (surface === "reload") {
            await page.setInputFiles("#import-json", {
              name: "saved.json",
              mimeType: "application/json",
              buffer: bytes,
            });
            await expect(page.locator("#toast")).toHaveText("Loaded saved.json.");
            await ready(page);
          }
          if (fixture.scene.toy.id === "video-3d") {
            const wanted = structuredClone(fixture.expected.camera);
            if (surface === "embed") wanted.distance *= 3.8 / 5;
            // Multiple idle driver frames must leave the restored pose alone.
            await page.waitForTimeout(300);
            camera(await page.evaluate(() => window.__splashery.player.camera.getState()), wanted);
          } else {
            const views = await page.evaluate(
              async () => (await import("/src/packs/photo-sharp.js")).sharpState().views,
            );
            expect(views[fixture.scene.toy.id]).toBe("splats");
          }
          if (surface !== "embed") {
            const saved = await save(page, testInfo, surface, fixture.expected);
            if (surface === "app") bytes = saved;
          }
          expect(errors).toEqual([]);
        } finally {
          await context.close();
        }
      }
    });
  }
}

test("plain applySettings preserves a video's native opening pose", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/embed/${query}&toy=video-3d`);
  await ready(page);
  await page.waitForFunction(() => {
    const p = window.__splashery.player;
    const home = p.motion.ctx.kit.data.flight.state.homePose;
    return home && Math.abs(p.camera.cur.yaw - home.yaw) < 1e-6;
  });
  const native = await page.evaluate(() => window.__splashery.player.camera.getState());
  const fixture = fixtures.find((f) => f.scene.toy.id === "video-3d");
  await page.evaluate((camera) => {
    const p = window.__splashery.player;
    const scene = structuredClone(p.scene);
    scene.camera = camera;
    // Showcase and capture callers do not opt in to saved-camera restoration.
    p.applySettings(scene);
  }, fixture.expected.camera);
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.camera.getState()))
    .toMatchObject({
      yaw: native.yaw,
      pitch: native.pitch,
      roll: native.roll,
      distance: native.distance,
    });
});

test("a newly chosen video opens at its native pose and Replay still changes a restored pose", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto(`/embed/${query}&toy=video-3d`);
  await ready(page);
  const native = await page.evaluate(() => {
    const p = window.__splashery.player;
    return { flight: p.motion.ctx.kit.data.flight.state, pose: p.camera.getState() };
  });
  expect(native.flight.userMoved).toBeFalsy();
  expect(native.flight.homePose).toBeTruthy();
  const fixture = fixtures.find((f) => f.scene.toy.id === "video-3d");
  const hash = `j.${Buffer.from(JSON.stringify(fixture.scene)).toString("base64url")}`;
  await page.goto(`/embed/${query}#s=${hash}`);
  await ready(page);
  await page.evaluate(() =>
    window.__splashery.player.motion.setControl("replay", 1, { snap: true }),
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.__splashery.player.motion.ctx.kit.data.flight.state.active),
    )
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.camera.getState().yaw))
    .not.toBeCloseTo(fixture.expected.camera.yaw, 3);
});
