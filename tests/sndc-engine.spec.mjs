// The engine addition for lane Sound C (docs/handoff/SoundC.md): a toy's sound
// pauses and resumes with its effect (the AudioContext is suspended while the
// effect is paused), and a toy's recorded samples load when it opens, so its
// first tap sounds on time.

import { test, expect } from "@playwright/test";

const APP = "/?renderer=webgl2&profile=weak";

async function open(page) {
  await page.addInitScript(() => localStorage.setItem("splashery.sound", "on"));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

async function pick(page, id) {
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id, id, { timeout: 120_000 }); // prettier-ignore
}

const audio = (page) =>
  page.evaluate(() => {
    const s = window.__splashery.app.sound;
    return { state: s.ctx?.state, t: s.ctx?.currentTime ?? 0, sched: s.scheduled, paused: s.toyPaused }; // prettier-ignore
  });

// Observe the real audio clock at the click and at the native state change.
// A driver round trip (or a delayed statechange task) is not audio latency:
// the context can already be silent while the runner waits for its reply.
async function observeAudio(page) {
  await page.evaluate(() => {
    const ctx = window.__splashery.app.sound.ctx;
    window.__sndcTransitions = [];
    document.querySelector("#toy-action").addEventListener("click", () => {
      window.__sndcClick = ctx.currentTime;
      window.__sndcClickWall = performance.now();
    }, { capture: true }); // prettier-ignore
    ctx.addEventListener("statechange", () => {
      window.__sndcTransitions.push({ state: ctx.state, t: ctx.currentTime, from: window.__sndcClick, wall: performance.now(), fromWall: window.__sndcClickWall }); // prettier-ignore
    });
  });
}

async function audioTransition(page, state) {
  await page.waitForFunction((state) => window.__sndcTransitions.some((a) => a.state === state), state); // prettier-ignore
  return page.evaluate((state) => window.__sndcTransitions.find((a) => a.state === state), state);
}

function expectPromptResume(resumed) {
  // Subtract the audio that has already played when the event task arrives.
  // This preserves the 500 ms native resume deadline without counting a delayed
  // event-loop/protocol reply as time the AudioContext was still suspended.
  const delay = (resumed.wall - resumed.fromWall) / 1000 - (resumed.t - resumed.from);
  expect(delay).toBeLessThan(0.5);
}

test("a paused effect's sound stops at once (ringing notes too) and resumes from the same moment", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await pick(page, "toy-piano");
  const start = await audio(page);
  await page.click("#toy-action");
  await page.waitForFunction((sched) => {
    const { player, app } = window.__splashery;
    const s = app.sound;
    const h = s.held.toy;
    // Scheduling looks ahead; let the first note actually ring before pausing.
    return player.motion.effectState() === "running" && player.motion.unseen === null && s.ctx?.state === "running" && s.scheduled > sched && s.ctx.currentTime > h.start + h.events[0].t + 0.1; // prettier-ignore
  }, start.sched);
  const playing = await audio(page);
  expect(playing.state).toBe("running");
  await observeAudio(page);
  // Pause: the whole context stops within a frame or two, so notes already
  // sounding stop with it, and its clock (every sound's schedule) holds.
  await page.click("#toy-action");
  const stopped = await audioTransition(page, "suspended");
  expect(stopped.t - stopped.from).toBeLessThan(0.1);
  const paused = await audio(page);
  expect(paused.paused).toBe(true);
  await page.waitForTimeout(800);
  const still = await audio(page);
  expect(still.t).toBe(paused.t);
  expect(still.sched).toBe(paused.sched);
  // Resume: the clock runs again from where it stopped and the tune goes on.
  await page.click("#toy-action");
  const resumed = await audioTransition(page, "running");
  expectPromptResume(resumed);
  expect(resumed.from).toBe(still.t);
  await page.waitForFunction(({ t, sched }) => {
    const s = window.__splashery.app.sound;
    return s.ctx.currentTime > t + 0.3 && s.scheduled > sched;
  }, still);
  const later = await audio(page);
  expect(later.paused).toBe(false);
  expect(later.t).toBeGreaterThan(still.t + 0.3);
  expect(later.sched).toBeGreaterThan(still.sched);
  expect(errors).toEqual([]);
});

test("a paused toy's sound comes back when another toy opens", async ({ page }) => {
  await open(page);
  await pick(page, "toy-piano");
  await page.click("#toy-action");
  await page.waitForFunction(() => window.__splashery.player.motion.effectState() === "running");
  await page.waitForTimeout(500);
  await page.click("#toy-action");
  await expect.poll(() => audio(page).then((a) => a.state), { timeout: 500 }).toBe("suspended");
  await pick(page, "dice");
  await expect.poll(() => audio(page).then((a) => a.state), { timeout: 2000 }).toBe("running");
  expect((await audio(page)).paused).toBe(false);
});

test("a toy's samples load when it opens, and its first tap's sample starts with the motion", async ({
  page,
}) => {
  const fetched = [];
  page.on("request", (r) => r.url().includes("/assets/sounds/") && fetched.push(r.url().split("/").pop())); // prettier-ignore
  // A slow network for the samples: the tap must not wait for them.
  await page.route("**/assets/sounds/**", async (r) => {
    await new Promise((ok) => setTimeout(ok, 400));
    await r.continue();
  });
  // Every sample start is logged: when it was asked for and when it sounds.
  await page.addInitScript(() => {
    window.__starts = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when = 0, ...rest) {
      if (this.buffer && this.buffer.duration > 0.05)
        window.__starts.push({ at: performance.now(), when, now: this.context.currentTime });
      return start.call(this, when, ...rest);
    };
  });
  await open(page);
  await pick(page, "dice");
  // Opening the toy fetches and decodes its sample (before any tap).
  await expect.poll(() => fetched, { timeout: 10_000 }).toContain("dice-throw.mp3");
  await page.waitForFunction(async () => {
    const { samplesReady } = await import("/src/voices.js");
    const { toySound } = await import("/src/toy-sounds.js");
    return samplesReady(toySound("dice"));
  });
  // A real click (its press wakes the audio), timed from the moment the
  // motion takes the tap.
  await page.evaluate(() => {
    window.__starts = [];
    const m = window.__splashery.player.motion;
    const act = m.act.bind(m);
    m.act = (...a) => ((window.__tapAt = performance.now()), act(...a));
  });
  await page.click("#toy-action");
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const first = window.__starts[0];
    return first && { delay: first.at - window.__tapAt + Math.max(0, first.when - first.now) * 1000 }; // prettier-ignore
  });
  expect(r).toBeTruthy();
  console.log(`first sample: ${r.delay.toFixed(1)} ms after the tap`);
  expect(r.delay).toBeLessThan(30);
  expect(fetched.filter((f) => f === "dice-throw.mp3")).toHaveLength(1);
});

test("a recipe's `sounds` (its cues' samples, by option) load with the toy; nothing loads with the speaker off", async ({
  page,
}) => {
  const fetched = [];
  page.on("request", (r) => r.url().includes("/assets/sounds/") && fetched.push(r.url().split("/").pop())); // prettier-ignore
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await pick(page, "dice");
  expect(fetched).toEqual([]); // the speaker is off: nothing loads
  await page.evaluate(() => {
    const { app, player } = window.__splashery;
    player.toyInfo.recipe.sounds = (o) => [{ voice: "sample", file: o.sndc ? "chess-set-move.mp3" : "tennis-ball-bounce.mp3" }]; // prettier-ignore
    app.sound.setEnabled(true);
    app.preloadSounds();
  });
  await expect.poll(() => fetched, { timeout: 10_000 }).toContain("tennis-ball-bounce.mp3");
  expect(fetched).toContain("dice-throw.mp3");
  expect(fetched).not.toContain("chess-set-move.mp3");
});

test("a quiet tap (its sound from cues) pauses and resumes its sound too", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await pick(page, "gaussian-splatting");
  const start = await audio(page);
  await page.click("#toy-action");
  await page.waitForFunction((sched) => {
    const { player, app } = window.__splashery;
    return player.motion.effectState() === "running" && player.motion.unseen === null && app.sound.ctx?.state === "running" && app.sound.scheduled > sched; // prettier-ignore
  }, start.sched);
  await observeAudio(page);
  await page.click("#toy-action");
  const stopped = await audioTransition(page, "suspended");
  expect(stopped.t - stopped.from).toBeLessThan(0.1);
  expect((await audio(page)).paused).toBe(true);
  await page.click("#toy-action");
  const resumed = await audioTransition(page, "running");
  expectPromptResume(resumed);
  expect(resumed.from).toBe(stopped.t);
  await page.waitForFunction((t) => window.__splashery.app.sound.ctx.currentTime > t, stopped.t);
  expect((await audio(page)).paused).toBe(false);
  expect(errors).toEqual([]);
});

test("a recipe's `sounds` are credited in the About tab, and its drive sees the camera's turn", async ({
  page,
}) => {
  await open(page);
  await pick(page, "dice");
  const view = await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    const r = player.toyInfo.recipe;
    r.sounds = [{ voice: "sample", file: "chess-set-move.mp3" }];
    app.renderCredits(player.toyInfo);
    const seen = [];
    const drive = r.drive;
    r.drive = (t, c, out, info) => (seen.push(info.view), drive?.call(r, t, c, out, info));
    // Frames can be slow here: ask for frames until the drive has run.
    for (let i = 0; i < 100 && !seen.length; i++) {
      player.stage.requestRender();
      await new Promise((ok) => setTimeout(ok, 100));
    }
    return seen;
  });
  await expect(page.locator('#credits [data-sample="chess-set-move.mp3"]')).toHaveCount(1);
  expect(view.length).toBeGreaterThan(0);
  expect(typeof view[0]).toBe("number");
});
