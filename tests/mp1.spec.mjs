// Lane MP1: Moving photo to 3D fixed and sharper. A fresh toy opens on Sintel's 30-second film and a
// link that names a clip still opens it; the short bunny plays its own frames in the Sharp view (it
// fed a playing video's picture there, which held a phone to a few frames a second); the seek slider
// moves the picture in both views; and the depth keeps its relief over time (a rolling range in each
// shot) while holding as steady as the one-range-for-the-clip way of October 10.

import { test, expect } from "@playwright/test";

const APP = (profile = "high") => `/?renderer=webgl2&adapt=off&profile=${profile}&labs=1`;
const mp = "/src/packs/moving-photo.js";

async function ready(page, profile, hash = "") {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP(profile) + hash);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}
const built = (page, clip) =>
  page.waitForFunction(
    async ([m, c]) =>
      window.__splashery.player.scene.toy.id === "moving-photo-3d" &&
      (await import(m)).MOVING.clip?.sample === c &&
      document.getElementById("progress").hidden,
    [mp, clip],
    { timeout: 180_000 },
  );
async function open(page, clip, profile) {
  const errors = await ready(page, profile);
  await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
  await built(page, "dragon-long");
  if (clip !== "dragon-long") {
    await page.evaluate((c) => window.__splashery.app.setToyOptions({ clip: c }), clip);
    await built(page, clip);
  }
  return errors;
}

test.describe("the default clip", () => {
  test.setTimeout(400_000);
  test("a fresh toy opens on Sintel's 30-second film", async ({ page }) => {
    const errors = await ready(page);
    await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
    await built(page, "dragon-long");
    const r = await page.evaluate(async (m) => {
      const { MOVING } = await import(m);
      return { long: !!MOVING.clip.long, duration: MOVING.clip.duration, name: MOVING.clip.name };
    }, mp);
    expect(r).toMatchObject({ long: true, duration: 30 });
    expect(r.name).toMatch(/Sintel/);
    await expect(page.locator("#toy-options select").first()).toHaveValue("dragon-long");
    expect(errors).toEqual([]);
  });

  test("a link that names a clip still opens that clip", async ({ page, browser }) => {
    await ready(page);
    for (const clip of ["sample", "horse"]) {
      const hash = await page.evaluate(async (c) => {
        const { encodeSceneHash } = await import("/src/codec.js");
        const scene = window.__splashery.app.exportScene();
        scene.toy = { kind: "builtin", id: "moving-photo-3d", options: { clip: c } };
        return encodeSceneHash(scene);
      }, clip);
      const other = await browser.newPage();
      const errors = await ready(other, "high", hash.startsWith("#") ? hash : `#s=${hash}`);
      await built(other, clip);
      expect(errors).toEqual([]);
      await other.close();
    }
  });
});

test.describe("the short bunny in the Sharp view", () => {
  test.setTimeout(400_000);
  test("plays its own frames and sound, with no video to read", async ({ page }) => {
    const errors = await open(page, "sample");
    await page.waitForFunction(() => window.__psv.state().on, null, { timeout: 60_000 });
    const r = await page.evaluate(async (m) => {
      const { MOVING } = await import(m);
      return {
        video: !!MOVING.clip.video,
        sound: MOVING.clip.audio?.url || "",
        fromVideo: window.__psv.state().video,
      };
    }, mp);
    expect(r.video).toBe(false);
    expect(r.sound).toMatch(/moving-photo-3d\/bunny\.mp3$/);
    expect(r.fromVideo).toBe(false);
    expect(errors).toEqual([]);
  });

  // The lag itself: on a low tier the bunny's Sharp view drew under 3 frames a second where
  // Sintel's short clip drew about 8 (it read a playing video's picture into the texture each
  // frame). Now the two draw about alike.
  test("draws about as often as the other short clips", async ({ page }) => {
    await open(page, "sample", "low");
    const rate = async (clip) => {
      if (clip !== "sample") {
        await page.evaluate((c) => window.__splashery.app.setToyOptions({ clip: c }), clip);
        await built(page, clip);
      }
      await page.waitForFunction(() => window.__psv.state().on, null, { timeout: 60_000 });
      await page.evaluate(() => window.__splashery.app.setControl("play", 1));
      await page.waitForTimeout(2500);
      return page.evaluate(async () => {
        const stage = window.__splashery.player.stage;
        let frames = 0;
        const on = () => frames++;
        stage.app.on("frameend", on);
        await new Promise((r) => setTimeout(r, 5000));
        stage.app.off("frameend", on);
        return frames / 5;
      });
    };
    const bunny = await rate("sample");
    const dragon = await rate("dragon");
    console.log(`Sharp view, low tier: bunny ${bunny.toFixed(1)}, Sintel ${dragon.toFixed(1)} frames a second`); // prettier-ignore
    expect(bunny).toBeGreaterThan(dragon * 0.6);
  });
});

test.describe("the seek slider", () => {
  test.setTimeout(400_000);
  test.use({ viewport: { width: 1440, height: 900 } });
  for (const clip of ["sample", "dragon-long"])
    test(`moves the Sharp picture of ${clip}, paused and playing`, async ({ page }) => {
      const errors = await open(page, clip);
      await page.waitForFunction(() => window.__psv.state().on, null, { timeout: 60_000 });
      const at = () =>
        page.evaluate(async (m) => {
          const { MOVING } = await import(m);
          const s = window.__psv.state();
          return { t: MOVING.t, frame: MOVING.frame, shown: s.videoTime, duration: MOVING.clip.duration }; // prettier-ignore
        }, mp);
      await page.click("#moving-play"); // pause
      await page.waitForTimeout(500);
      await page.locator("#moving-seek").scrollIntoViewIfNeeded();
      const box = await page.locator("#moving-seek").boundingBox();
      for (const share of [0.25, 0.75]) {
        await page.mouse.click(box.x + box.width * share, box.y + box.height / 2);
        await page.waitForTimeout(1500);
        const r = await at();
        expect(Math.abs(r.t / r.duration - share)).toBeLessThan(0.05);
        // the picture on show is from there too (a long film's video, a short clip's frame)
        if (r.shown !== null) expect(Math.abs(r.shown - r.t)).toBeLessThan(0.3);
      }
      await page.click("#moving-play"); // play
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
      await page.waitForTimeout(300);
      const r = await at();
      expect(r.t / r.duration).toBeGreaterThan(0.45);
      expect(r.t / r.duration).toBeLessThan(0.7);
      expect(errors).toEqual([]);
    });
});

test.describe("depth over time", () => {
  test.setTimeout(400_000);
  // Contrast: how much of the Depth slider's range a frame uses; jitter: how far still parts move
  // from one frame to the next, as a share of that.
  test("keeps the relief and holds it steady (Sintel's short clip)", async ({ page }) => {
    await page.goto("/LICENSES.md");
    const r = await page.evaluate(async (m) => {
      window.__splashery = { player: { profile: "high" } };
      const mod = await import(m);
      const { colorDistance } = await import("/src/live/clip-stabilize.js");
      const out = {};
      for (const mode of ["clip", "shot"]) {
        mod.STEADY.mode = mode;
        mod.MOVING.samples.delete("dragon");
        const c = await mod.loadSample("dragon");
        let contrast = 0,
          jitter = 0,
          pairs = 0;
        for (let f = 0; f < c.n; f++) {
          const s = Uint8Array.from(c.near[f]).sort();
          contrast += (s[Math.floor(s.length * 0.95)] - s[Math.floor(s.length * 0.05)]) / 255 / c.n;
          if (!f) continue;
          let sum = 0,
            n = 0;
          for (let i = 0; i < c.near[f].length; i += 7) {
            if (colorDistance(c.colors[f], c.colors[f - 1], i) > 64) continue;
            sum += Math.abs(c.near[f][i] - c.near[f - 1][i]) / 255;
            n++;
          }
          if (n > 100 && sum / n < 0.3) {
            jitter += sum / n;
            pairs++;
          }
        }
        out[mode] = { contrast, ratio: jitter / pairs / contrast };
      }
      return out;
    }, mp);
    console.log(JSON.stringify(r));
    expect(r.clip.contrast).toBeLessThan(0.4); // (October 10's flat relief, kept as a choice)
    expect(r.shot.contrast).toBeGreaterThan(0.6);
    expect(r.shot.ratio).toBeLessThan(r.clip.ratio * 1.5);
  });
});
