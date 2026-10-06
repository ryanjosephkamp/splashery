import { test, expect } from "@playwright/test";
import {
  CAPTURE,
  FRAME_BYTES,
  PRESETS,
  isJobId,
  newJobId,
  presetFor,
  readHostMessage,
  readLabMessage,
  startMessage,
} from "../src/ascii-capture/protocol.js";
import { creditFooter, creditMetadata } from "../src/ascii-capture/credit.js";

// Lane AsciiCapture: the message checks, the credit footer and the GIF timeline.

const job = newJobId();

test("the host accepts only a known preset, the fixed settings and its own job", () => {
  expect(isJobId(job)).toBe(true);
  expect(isJobId("x".repeat(32))).toBe(false);
  for (const id of Object.keys(PRESETS))
    expect(readLabMessage(startMessage(job, id), job)).toBe("start");
  expect(startMessage(job, "orange").options).toEqual({ style: "whole" });
  expect(() => startMessage(job, "pizza")).toThrow();
  const start = startMessage(job, "grapes");
  for (const bad of [
    { ...start, job: newJobId() },
    { ...start, toy: "pizza" },
    { ...start, toy: "orange" }, // the orange needs its whole option
    { ...startMessage(job, "orange"), options: { style: "half" } },
    { ...startMessage(job, "orange"), options: { style: "whole", extra: 1 } },
    { ...start, capture: { ...CAPTURE, frames: 400 } },
    { ...start, capture: { ...CAPTURE, size: 4096 } },
    { ...start, scene: {} },
    { ...start, type: "eval" },
    null,
    "start",
    [start],
  ])
    expect(readLabMessage(bad, job)).toBeNull();
  expect(readLabMessage({ type: "next", job, index: 3 }, job)).toBe("next");
  for (const index of [-1, 40, 1.5, "3"])
    expect(readLabMessage({ type: "next", job, index }, job)).toBeNull();
  expect(presetFor("strawberry", null)).toBe(PRESETS.strawberry);
  expect(presetFor("strawberry", { style: "whole" })).toBeNull();
});

test("the lab accepts only bounded frames and known replies from its job", () => {
  const frame = { type: "frame", job, index: 0, width: 420, height: 420, pixels: new ArrayBuffer(FRAME_BYTES) }; // prettier-ignore
  expect(readHostMessage(frame, job)).toBe("frame");
  for (const bad of [
    { ...frame, pixels: new ArrayBuffer(FRAME_BYTES + 4) },
    { ...frame, pixels: new Uint8Array(FRAME_BYTES) },
    { ...frame, width: 512 },
    { ...frame, index: 40 },
    { ...frame, job: newJobId() },
    { ...frame, extra: true },
  ])
    expect(readHostMessage(bad, job)).toBeNull();
  expect(readHostMessage({ type: "ready", job }, job)).toBe("ready");
  expect(readHostMessage({ type: "loaded", job, renderer: "webgl2" }, job)).toBe("loaded");
  expect(readHostMessage({ type: "loaded", job, renderer: "x".repeat(201) }, job)).toBeNull();
  expect(readHostMessage({ type: "error", job, reason: "no-webgl2" }, job)).toBe("error");
  expect(readHostMessage({ type: "error", job, reason: "<b>" }, job)).toBeNull();
  expect(readHostMessage({ type: "done", job }, job)).toBeNull();
});

test("the credit footer carries the strawberry's credit and the kit toys' MIT line", () => {
  const berry = creditFooter("strawberry", "Strawberry", 48);
  expect(berry[0]).toBe("Strawberry - Dany Bittel - CC BY 4.0");
  expect(berry).toContain("https://superspl.at/scene/84df8849");
  expect(berry).toContain("https://creativecommons.org/licenses/by/4.0/");
  expect(berry.join(" ")).toContain("recentered");
  expect(berry.length).toBeLessThanOrEqual(8);
  expect(berry.every((line) => line.length <= 160)).toBe(true);
  expect(creditFooter("grapes", "Grapes", 96)).toEqual([
    "Grapes: Splashery, MIT",
    "Fresh toy animation, converted to ASCII by Splashery.",
  ]);
  expect(creditMetadata("orange", "Whole orange", {}).credit).toEqual({
    author: "Splashery",
    license: "MIT",
  });
});

test("GIF delays add up to the exact timeline and the comment sits before the frames", async ({
  page,
}) => {
  await page.goto("/ascii-lab.html");
  const out = await page.evaluate(async () => {
    const { gifDelays, withComment, validateFrames } = await import("/src/ascii-capture/gif.js");
    const twelve = gifDelays(40, 12);
    const gif = new Uint8Array([71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 0x80, 0, 0, 1, 2, 3, 4, 5, 6, 59]); // prettier-ignore
    const commented = withComment(gif, { app: "Splashery" });
    let bad = false;
    try {
      validateFrames(
        [
          { columns: 8, rowCount: 4 },
          { columns: 9, rowCount: 4 },
        ],
        10,
      );
    } catch {
      bad = true;
    }
    return {
      ten: gifDelays(40, 10),
      twelveSum: twelve.reduce((a, b) => a + b, 0),
      twelveSet: [...new Set(twelve)].sort(),
      at: [...commented.slice(19, 21)],
      tail: commented.at(-1),
      bad,
    };
  });
  expect(out.ten).toEqual(Array(40).fill(100));
  expect(out.twelveSum).toBe(3330);
  expect(out.twelveSet).toEqual([80, 90]);
  expect(out.at).toEqual([0x21, 0xfe]); // after the 6-byte global color table
  expect(out.tail).toBe(59);
  expect(out.bad).toBe(true);
});
