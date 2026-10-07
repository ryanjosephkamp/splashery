import { test, expect } from "@playwright/test";

// Engine (lane AsciiCapture): a player's color-scheme and device-motion
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
    const counts = { look: 0, shake: 0 };
    player.applyLook = () => counts.look++;
    player.shake = () => counts.shake++;
    const shakeHard = () => {
      for (let i = 0; i < 3; i++)
        dispatchEvent(
          new DeviceMotionEvent("devicemotion", {
            accelerationIncludingGravity: { x: 30, y: 0, z: 0 },
          }),
        );
    };
    player.media.dispatchEvent(new Event("change"));
    shakeHard();
    const before = { ...counts };
    player.destroy();
    player.media.dispatchEvent(new Event("change"));
    shakeHard();
    canvas.remove();
    return {
      types: seen.map((s) => s.type).sort(),
      allSignalled: seen.every((s) => s.signal instanceof AbortSignal),
      allAborted: seen.every((s) => s.signal?.aborted),
      mediaOwned: seen.some((s) => s.type === "change" && s.target === player.media),
      before,
      after: { ...counts },
    };
  });
  expect(result.types).toEqual(["change", "devicemotion"]);
  expect(result.mediaOwned).toBe(true);
  expect(result.allSignalled).toBe(true);
  expect(result.allAborted).toBe(true);
  // Both listeners worked while the player lived, and neither fires after destroy().
  expect(result.before).toEqual({ look: 1, shake: 1 });
  expect(result.after).toEqual(result.before);
});
