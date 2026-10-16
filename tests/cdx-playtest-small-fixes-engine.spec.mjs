import { test, expect } from "@playwright/test";

test("Auto handles sustained slow frames, preserving ordinary and isolated frame timings", async ({
  page,
}) => {
  await page.goto("/manifest.webmanifest");
  const result = await page.evaluate(async () => {
    const { Stage } = await import("/src/stage.js");
    const { Player } = await import("/src/player.js");
    const run = (times, opts = {}) => {
      const player = Object.assign(Object.create(Player.prototype), {
        autoTier: true,
        profile: "high",
        emit() {},
        ...opts,
      });
      const stage = Object.assign(Object.create(Stage.prototype), {
        adaptive: true,
        busy: true,
        reduced: false,
        pixelCap: 2,
        applyPixelRatio() {},
        onSlow: () => player.stepDown(),
        ...opts,
      });
      player.stage = stage;
      stage.setPixelRatio = (n) => {
        stage.pixelCap = n;
      };
      stage.settle();
      for (const ms of times) stage.timeFrame(ms);
      return { profile: player.profile, reduced: stage.reduced };
    };
    const frames = (ms, n = 100) => Array(n).fill(ms);
    return {
      desktop: run(frames(16.7)),
      phone: run(frames(33.3)),
      slow: run(frames(150)),
      verySlow: run(frames(1500)),
      isolated: run(Array.from({ length: 100 }, (_, i) => (i % 10 ? 16.7 : 1500))),
      manual: run(frames(150), { autoTier: false }),
      idle: run(frames(150), { busy: false }),
      capture: run(frames(150), { fixedSize: [420, 420] }),
      off: run(frames(150), { adaptive: false }),
      sharp: run(frames(150), { sharp: { adapt: "off" } }),
    };
  });
  expect(result.desktop.profile).toBe("high");
  expect(result.phone.profile).toBe("high");
  expect(result.slow.profile).toBe("low");
  expect(result.verySlow.profile).toBe("low");
  for (const name of ["isolated", "manual", "idle", "capture", "off", "sharp"])
    expect(result[name].profile, name).toBe("high");
});
