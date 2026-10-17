// Lane REC1 (October 17, 2026): the recorder's three fixes from the owner's phone.
// 1. A countdown before a take (5 seconds by default; Off, 3, 5, or 10 in the Share tab,
//    remembered on the device), with Cancel a tap away and nothing recorded before it ends.
// 2. Going full screen during a take keeps the toy where it was: the video keeps its size,
//    and the toy its place and size in it.
// 3. A take is as long as the time recorded, whether the stage draws or holds still (an idle
//    Photo to 3D scene drew no frames, and a phone's recorder ended the file at its last frame).
import { test, expect } from "@playwright/test";

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const SHOTS = new URL("./screenshots/", import.meta.url);
const shot = (name) => new URL(name, SHOTS).pathname;

async function open(page, { labs = false } = {}) {
  await page.goto(`/?renderer=webgl2&profile=weak&labs=${labs ? 1 : 0}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

async function pick(page, id) {
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id, id, { timeout: 120_000 }); // prettier-ignore
}

async function showShare(page) {
  if (await page.locator("#sheet-toggle").isVisible()) {
    if (!(await page.locator("body").evaluate((b) => b.classList.contains("sheet-open"))))
      await page.click("#sheet-toggle");
  }
  await page.click("#tab-share");
  await expect(page.locator("#pane-share")).toBeVisible();
}

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

// Waits for the take to be saved (the preview opens), then studies the video in the page:
// its length, and its frames' times, sizes and the toy's place in them (the center and area of
// the pixels that differ from the corner's background). `from` is where playback starts, in
// seconds from the end (null plays it all).
async function study(page, { from = null } = {}) {
  await page.waitForFunction(() => window.__splashery.app.recorded?.blob, null, { timeout: 30_000 }); // prettier-ignore
  return page.evaluate(async (from) => {
    const r = window.__splashery.app.recorded;
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.src = URL.createObjectURL(r.blob);
    await new Promise((ok, no) => ((v.onloadedmetadata = ok), (v.onerror = no)));
    // A recorder's WebM has no length in its header: seeking to the end finds it.
    if (!Number.isFinite(v.duration)) {
      v.currentTime = 1e9;
      const t0 = performance.now();
      while (!Number.isFinite(v.duration) && performance.now() - t0 < 15_000)
        await new Promise((ok) => setTimeout(ok, 50));
    }
    const duration = v.duration;
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = Math.round((96 * v.videoHeight) / v.videoWidth);
    const g = c.getContext("2d", { willReadFrequently: true });
    const frames = [];
    const start = from == null ? 0 : Math.max(0, duration - from);
    v.currentTime = start;
    await new Promise((ok) => (v.onseeked = ok));
    await new Promise((done) => {
      const on = (now, meta) => {
        g.drawImage(v, 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        let sx = 0;
        let sy = 0;
        for (let y = 0; y < c.height; y++)
          for (let x = 0; x < c.width; x++) {
            const i = (y * c.width + x) * 4;
            if (
              Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) >
              60
            ) {
              n++;
              sx += x;
              sy += y;
            }
          }
        frames.push({
          t: meta.mediaTime,
          w: meta.width,
          h: meta.height,
          cx: n ? sx / n / c.width : null,
          cy: n ? sy / n / c.height : null,
          area: n / (c.width * c.height),
        });
        if (!v.ended) v.requestVideoFrameCallback(on);
      };
      v.requestVideoFrameCallback(on);
      v.onended = done;
      setTimeout(done, (duration - start) * 1000 + 8000);
      v.play();
    });
    URL.revokeObjectURL(v.src);
    return { duration, seconds: r.seconds, pushed: r.frames, type: r.blob.type, frames, size: [v.videoWidth, v.videoHeight] }; // prettier-ignore
  }, from);
}

test.describe("REC1: the countdown", () => {
  test.use(PHONE);

  test("5 seconds by default; the choice (Off, 3, 5, or 10) is remembered on the device", async ({
    page,
  }) => {
    // A person's browser (the specs' browser starts at Off, so other specs' takes start at once).
    await page.addInitScript(() =>
      Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }),
    );
    await open(page);
    await showShare(page);
    const select = page.locator("#record-countdown");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue("5");
    expect(await select.locator("option").evaluateAll((o) => o.map((x) => x.value))).toEqual(["0", "3", "5", "10"]); // prettier-ignore
    await select.selectOption("10");
    await page.reload();
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await expect(page.locator("#record-countdown")).toHaveValue("10");
    await page.screenshot({ path: shot("rec1-settings-390x844.png") });
  });

  test("Record counts down over the stage with Cancel; the take starts when it ends, and nothing before is in it", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "donut");
    await showShare(page);
    await page.locator("#record-countdown").selectOption("3");
    // When the take starts (the pill shows its time) and when Stop is pressed, seen in the page.
    await page.evaluate(() => {
      const t = (window.__rec1 = {});
      new MutationObserver(() => {
        if (!t.start && /\/ 1:00$/.test(document.getElementById("rec-time").textContent))
          t.start = performance.now();
      }).observe(document.getElementById("rec-time"), { childList: true, characterData: true, subtree: true }); // prettier-ignore
      document.getElementById("rec-stop").addEventListener("click", () => (t.stop ??= performance.now()), true); // prettier-ignore
    });
    await page.click("#record-start");
    // The number on the stage, the pill says it, and its button cancels.
    await expect(page.locator("#rec-count")).toBeVisible();
    await expect(page.locator("#rec-count span")).toHaveText("3");
    await expect(page.locator("#rec-time")).toHaveText("Recording in 3");
    await expect(page.locator("#rec-stop")).toHaveText("Cancel");
    await expect(page.locator("body")).not.toHaveClass(/sheet-open/);
    const box = await page.evaluate(() => {
      const a = document.getElementById("stage").getBoundingClientRect();
      const b = document.querySelector("#rec-count span").getBoundingClientRect();
      return { dx: a.x + a.width / 2 - (b.x + b.width / 2), dy: a.y + a.height / 2 - (b.y + b.height / 2), w: b.width }; // prettier-ignore
    });
    expect(Math.abs(box.dx)).toBeLessThan(2); // centered on the stage
    expect(Math.abs(box.dy)).toBeLessThan(2);
    expect(box.w).toBeGreaterThan(100); // big
    expect(await page.evaluate(() => !!window.__splashery.app.recording)).toBe(false);
    await page.screenshot({ path: shot("rec1-countdown-390x844.png") });
    await expect(page.locator("#rec-count span")).toHaveText("2");
    await expect(page.locator("#rec-count span")).toHaveText("1");
    expect(await page.evaluate(() => !!window.__splashery.app.recording)).toBe(false);
    // Then the take: the time, Stop, no number.
    await expect(page.locator("#rec-time")).toHaveText(/ \/ 1:00$/, { timeout: 5_000 });
    await expect(page.locator("#rec-count")).toBeHidden();
    await expect(page.locator("#rec-stop")).toHaveText("Stop");
    await page.waitForTimeout(2500);
    await page.click("#rec-stop");
    const s = await study(page, { from: 1 });
    const t = await page.evaluate(() => window.__rec1);
    const took = (t.stop - t.start) / 1000;
    // The take is the time after the countdown (about 2.5 s here), not the countdown too.
    expect(took).toBeLessThan(5);
    expect(Math.abs(s.seconds - took)).toBeLessThan(0.5);
    expect(Math.abs(s.duration - s.seconds)).toBeLessThan(0.5);
    expect(errors).toEqual([]);
  });

  test("Cancel (or Record again) during the countdown stops it, and nothing records", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "donut");
    await showShare(page);
    await page.locator("#record-countdown").selectOption("5");
    await page.click("#record-start");
    await expect(page.locator("#rec-count span")).toHaveText("4");
    await page.click("#rec-stop");
    await expect(page.locator("#rec-count")).toBeHidden();
    await expect(page.locator("#rec-pill")).toBeHidden();
    await page.waitForTimeout(5500);
    expect(await page.evaluate(() => [!!window.__splashery.app.recording, !!window.__splashery.app.recorded])).toEqual([false, false]); // prettier-ignore
    await expect(page.locator("#rec-pill")).toBeHidden();
    // Record from the Share tab is the other way to cancel.
    await page.evaluate(() => void window.__splashery.app.startRecord());
    await expect(page.locator("#rec-count span")).toHaveText("5");
    await page.evaluate(() => document.getElementById("record-start").click());
    await expect(page.locator("#rec-count")).toBeHidden();
    await expect(page.locator("#record-start .record-label")).toHaveText("Record");
    await page.waitForTimeout(5500);
    expect(await page.evaluate(() => !!window.__splashery.app.recording)).toBe(false);
    // Off starts the take at once.
    await showShare(page);
    await page.locator("#record-countdown").selectOption("0");
    await page.click("#record-start");
    await expect(page.locator("#rec-time")).toHaveText(/\/ 1:00$/);
    await expect(page.locator("#rec-count")).toBeHidden();
    await page.click("#rec-stop");
    await expect(page.locator("#rec-preview")).toBeVisible({ timeout: 30_000 });
    expect(errors).toEqual([]);
  });
});

test.describe("REC1: full screen during a take", () => {
  test.use(PHONE);

  test("going full screen in the middle keeps the video's size and the toy's place and size in it", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "donut");
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    await showShare(page);
    await page.click("#record-start");
    await expect(page.locator("#rec-time")).toHaveText(/\/ 1:00$/);
    const before = await page.evaluate(() => [window.__splashery.player.stage.canvas.width, window.__splashery.player.stage.canvas.height]); // prettier-ignore
    await page.waitForTimeout(2500);
    // The top bar's full screen (focus mode): the stage takes the whole screen.
    await page.click("#focus-toggle");
    await expect(page.locator("body")).toHaveClass(/focus/);
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => [window.__splashery.player.stage.canvas.width, window.__splashery.player.stage.canvas.height]); // prettier-ignore
    expect(after[1]).toBeGreaterThan(before[1] + 100); // the stage did grow
    await page.screenshot({ path: shot("rec1-fullscreen-390x844.png") });
    await page.click("#rec-stop");
    const s = await study(page);
    const seen = s.frames.filter((f) => f.area > 0.002);
    expect(seen.length).toBeGreaterThan(20);
    // One size for the whole take.
    expect(new Set(s.frames.map((f) => `${f.w}x${f.h}`)).size).toBe(1);
    const early = seen.filter((f) => f.t > 0.3 && f.t < 2);
    const late = seen.filter((f) => f.t > s.duration - 1.5);
    expect(early.length).toBeGreaterThan(3);
    expect(late.length).toBeGreaterThan(3);
    const mean = (a, k) => a.reduce((x, f) => x + f[k], 0) / a.length;
    // The toy stays put (within 3% of the frame) and keeps its size (within 15%).
    expect(Math.abs(mean(early, "cx") - mean(late, "cx"))).toBeLessThan(0.03);
    expect(Math.abs(mean(early, "cy") - mean(late, "cy"))).toBeLessThan(0.03);
    expect(mean(late, "area") / mean(early, "area")).toBeGreaterThan(0.85);
    expect(mean(late, "area") / mean(early, "area")).toBeLessThan(1.15);
    expect(errors).toEqual([]);
  });
});

test.describe("REC1: full-length takes", () => {
  test.use(PHONE);

  test("a moving kit toy: the saved length matches the time recorded, at a steady frame rate", async ({
    page,
  }) => {
    await open(page);
    await pick(page, "donut");
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(true));
    // The stage's real draws during the take.
    await page.evaluate(() => {
      window.__draws = 0;
      window.__splashery.player.stage.app.on("postrender", () => window.__splashery.app.recording && window.__draws++); // prettier-ignore
    });
    await page.evaluate(() => window.__splashery.app.startRecord());
    await expect(page.locator("#rec-time")).toHaveText(/\/ 1:00$/);
    await page.waitForTimeout(10_000);
    await page.click("#rec-stop");
    const s = await study(page);
    expect(s.seconds).toBeGreaterThan(9.5);
    expect(Math.abs(s.duration - s.seconds)).toBeLessThan(0.5);
    const last = s.frames.at(-1).t;
    // The last video frame: within a second of the end here. This sandbox renders the turning toy
    // and encodes it on the same 4 CPUs, and a recorder drops what its encoder still holds when it
    // stops (the 400 ms drain wins most of it back; the idle takes below keep the 0.5 s bar).
    expect(last).toBeGreaterThan(s.seconds - 1);
    // Every drawn frame goes in (up to 30 a second; the test browser draws on the CPU, more
    // slowly), and never fewer than the still picture's 10 a second.
    const draws = await page.evaluate(() => window.__draws);
    expect(s.pushed).toBeGreaterThan(0.9 * Math.min(draws, 30 * s.seconds));
    expect(s.pushed / s.seconds).toBeGreaterThan(9);
  });

  test("an idle Photo to 3D scene: frames for the whole take, to the 60-second limit", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await open(page, { labs: true });
    await pick(page, "photo-3d");
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    // Wait until the stage holds still (it draws nothing on its own).
    await page.waitForTimeout(6000);
    const drawn = await page.evaluate(async () => {
      const st = window.__splashery.player.stage;
      const f0 = st.frames;
      await new Promise((ok) => setTimeout(ok, 2000));
      return st.frames - f0;
    });
    test.info().annotations.push({ type: "stage frames in 2 s before the take", description: String(drawn) }); // prettier-ignore
    await page.evaluate(() => window.__splashery.app.startRecord());
    await expect(page.locator("#rec-time")).toHaveText(/\/ 1:00$/);
    // It stops by itself at the limit.
    await expect(page.locator("#rec-preview")).toBeVisible({ timeout: 90_000 });
    const s = await study(page, { from: 2 });
    expect(s.seconds).toBeCloseTo(60, 0);
    expect(Math.abs(s.duration - s.seconds)).toBeLessThan(0.5);
    // The video's own frames reach the end (not only the sound): the last one is within half
    // a second of the end, and the last two seconds have frames.
    const last = s.frames.at(-1).t;
    expect(last).toBeGreaterThan(s.seconds - 0.5);
    expect(s.frames.length).toBeGreaterThan(4);
    // And steady all through: the still picture again, 10 frames a second (the old recorder
    // handed over frames only while the stage drew).
    expect(s.pushed / s.seconds).toBeGreaterThan(9);
  });

  test("an idle Photo to 3D scene: a 20-second take saves 20 seconds", async ({ page }) => {
    await open(page, { labs: true });
    await pick(page, "photo-3d");
    await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
    await page.waitForTimeout(6000);
    await page.evaluate(() => window.__splashery.app.startRecord());
    await expect(page.locator("#rec-time")).toHaveText(/\/ 1:00$/);
    await page.waitForTimeout(20_000);
    await page.click("#rec-stop");
    const s = await study(page, { from: 2 });
    expect(s.seconds).toBeGreaterThan(19.5);
    expect(Math.abs(s.duration - s.seconds)).toBeLessThan(0.5);
    expect(s.frames.at(-1).t).toBeGreaterThan(s.seconds - 0.5);
    await expect(page.locator("#rec-preview")).toBeVisible();
    await page.screenshot({ path: shot("rec1-photo-take-390x844.png") });
  });
});

test.describe("REC1: on a computer", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the countdown choice sits beside Record, and the number is centered on the stage", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);
    await pick(page, "donut");
    await showShare(page);
    await page.locator("#record-countdown").selectOption("3");
    const row = await page.evaluate(() => {
      const a = document.getElementById("record-start").getBoundingClientRect();
      const b = document.getElementById("record-countdown").getBoundingClientRect();
      return { same: Math.abs(a.y + a.height / 2 - (b.y + b.height / 2)) < 20, after: b.x > a.x + a.width - 1 }; // prettier-ignore
    });
    expect(row).toEqual({ same: true, after: true });
    await page.screenshot({ path: shot("rec1-settings-1440x900.png") });
    await page.click("#record-start");
    await expect(page.locator("#rec-count span")).toHaveText("3");
    const box = await page.evaluate(() => {
      const a = document.getElementById("stage").getBoundingClientRect();
      const b = document.querySelector("#rec-count span").getBoundingClientRect();
      return { dx: a.x + a.width / 2 - (b.x + b.width / 2), dy: a.y + a.height / 2 - (b.y + b.height / 2) }; // prettier-ignore
    });
    expect(Math.abs(box.dx)).toBeLessThan(2);
    expect(Math.abs(box.dy)).toBeLessThan(2);
    await page.screenshot({ path: shot("rec1-countdown-1440x900.png") });
    await page.click("#rec-stop"); // Cancel
    await expect(page.locator("#rec-count")).toBeHidden();
    expect(errors).toEqual([]);
  });
});
