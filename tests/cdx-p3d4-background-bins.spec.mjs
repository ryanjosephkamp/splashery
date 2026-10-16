import { test, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
import { backgroundImage } from "../src/photo3d/background.js";

const reference = JSON.parse(
  fs.readFileSync(new URL("./fixtures/photo-background-hashes.json", import.meta.url)),
);
test("skipping unused background bins preserves checkpoint donors, colors, and depth", () => {
  for (const { w, h, gx, gy, kind, relief, hashes } of reference.rows) {
    const photo = {
      w,
      h,
      data: Uint8Array.from(
        { length: w * h * 4 },
        (_, i) => (Math.imul(i + 19, 1664525) >>> 17) & 255,
      ),
    };
    const d = Float32Array.from({ length: gx * gy }, (_, i) =>
      kind === "flat"
        ? 0.5
        : kind === "step"
          ? i % gx < gx / 2
            ? 0.2
            : 0.8
          : kind === "narrow"
            ? i % gx === Math.floor(gx / 2)
              ? 0.2
              : 0.8
            : kind === "ramp"
              ? (i % gx) / gx
              : ((i * 37) % 256) / 255,
    );
    const result = backgroundImage(photo, d, gx, gy, relief);
    for (const [key, expected] of Object.entries(hashes)) {
      const a = result[key];
      expect(
        crypto
          .createHash("sha256")
          .update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength))
          .digest("hex"),
        `${kind} ${key}`,
      ).toBe(expected);
    }
  }
});
