import { test, expect } from "@playwright/test";

// Engine (lane AsciiCapture): a player's color-scheme, reduced-motion, and device-motion
// listeners are owned by it and leave when it is destroyed.

test("a destroyed player's color-scheme and device-motion listeners leave with it", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&adapt=off");
  const result = await page.evaluate(async () => {
    const { Player } = await import("/src/player.js");
    const seen = [];
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      if (type === "change" || type === "devicemotion")
        seen.push({ type, target: this, signal: opts?.signal });
      return add.call(this, type, fn, opts);
    };
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    document.body.append(canvas);
    let player;
    try {
      player = await new Player(canvas, { prefer: "webgl2" }).init();
    } finally {
      EventTarget.prototype.addEventListener = add;
    }
    const counts = { look: 0, shake: 0, motion: 0 };
    player.applyLook = () => counts.look++;
    player.shake = () => counts.shake++;
    player.on("motion-preference", () => counts.motion++);
    const motionMedia = seen.find(
      (s) => s.target.media === "(prefers-reduced-motion: reduce)",
    )?.target;
    const motionChange = (matches) =>
      motionMedia?.dispatchEvent(new MediaQueryListEvent("change", { matches }));
    const shakeHard = () => {
      for (let i = 0; i < 3; i++)
        dispatchEvent(
          new DeviceMotionEvent("devicemotion", {
            accelerationIncludingGravity: { x: 30, y: 0, z: 0 },
          }),
        );
    };
    player.media.dispatchEvent(new Event("change"));
    motionChange(true);
    shakeHard();
    const before = { ...counts };
    const reducedBefore = player.reducedMotion;
    player.destroy();
    player.media.dispatchEvent(new Event("change"));
    motionChange(false);
    shakeHard();
    canvas.remove();
    return {
      types: seen.map((s) => s.type).sort(),
      queries: seen
        .filter((s) => s.type === "change")
        .map((s) => s.target.media)
        .sort(),
      allSignalled: seen.every((s) => s.signal instanceof AbortSignal),
      allAborted: seen.every((s) => s.signal?.aborted),
      mediaOwned: seen.some((s) => s.type === "change" && s.target === player.media),
      before,
      reducedBefore,
      reducedAfter: player.reducedMotion,
      after: { ...counts },
    };
  });
  // Task 52's approved live preference handling owns a second media-query listener.
  expect(result.types).toEqual(["change", "change", "devicemotion"]);
  expect(result.queries).toEqual([
    "(prefers-color-scheme: dark)",
    "(prefers-reduced-motion: reduce)",
  ]);
  expect(result.mediaOwned).toBe(true);
  expect(result.allSignalled).toBe(true);
  expect(result.allAborted).toBe(true);
  // All three worked while the player lived, and none fires after destroy().
  expect(result.before).toEqual({ look: 1, shake: 1, motion: 1 });
  expect(result.after).toEqual(result.before);
  expect(result.reducedBefore).toBe(true);
  expect(result.reducedAfter).toBe(true);
});
