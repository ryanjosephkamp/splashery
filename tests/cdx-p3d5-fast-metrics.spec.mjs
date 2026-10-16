import { test, expect } from "@playwright/test";
import { streakR4 } from "../tools/p3df/artifacts.mjs";
import { streakExact } from "../tools/cdx-p3d5-fast-metrics.mjs";

test("tensor optimization retains every original value and support count", () => {
  for (const [width, height] of [
    [3, 4],
    [17, 19],
    [96, 80],
    [257, 173],
  ])
    for (const pattern of ["flat", "ribbons", "noise", "sparse", "disconnected"])
      for (const radius of [1, 3, 5]) {
        const data = Uint8Array.from({ length: width * height * 4 }, (_, i) =>
          pattern === "flat"
            ? 127
            : pattern === "ribbons"
              ? ((Math.floor(i / 4) % width) * 7) % 256
              : (Math.imul(i + 11, 1664525) >>> 13) & 255,
        );
        const classes = Uint8Array.from({ length: width * height }, (_, i) =>
          pattern === "sparse"
            ? i % 3
            : pattern === "disconnected"
              ? Math.floor(i / width / 8) % 3
              : i % width < width / 2
                ? 1
                : 2,
        );
        const image = { width, height, data };
        expect(
          streakExact(image, classes, radius),
          `${width}x${height} ${pattern} r=${radius}`,
        ).toEqual(streakR4(image, classes, radius));
      }
});
