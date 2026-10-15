import { test, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
import { surfaceGrid } from "../src/photo3d/surface.js";

const reference = JSON.parse(
  fs.readFileSync(new URL("./fixtures/photo-surface-hashes.json", import.meta.url)),
);

test("surface buffer construction preserves frozen checkpoint bytes across cuts, slopes, and compaction", () => {
  for (const { cols, rows, gx, gy, pattern, compact, hashes } of reference.rows) {
    const source = {
      gx,
      gy,
      compact,
      cut: 0.03,
      depth: Uint8Array.from({ length: gx * gy }, (_, i) =>
        pattern === "flat"
          ? 127
          : pattern === "ramp"
            ? Math.round(((i % gx) / (gx - 1)) * 255)
            : pattern === "step"
              ? i % gx < gx / 2
                ? 64
                : 204
              : (Math.imul(i + 11, 1664525) >>> 15) & 255,
      ),
      band: Uint8Array.from({ length: gx * gy }, (_, i) =>
        pattern === "flat" ? 0 : Math.floor(i / gx) % 3,
      ),
    };
    const result = surfaceGrid(cols, rows, source);
    for (const [key, expected] of Object.entries(hashes)) {
      const array = result[key];
      expect(
        crypto
          .createHash("sha256")
          .update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength))
          .digest("hex"),
        `${cols}x${rows} ${pattern} compact=${compact} ${key}`,
      ).toBe(expected);
    }
  }
});
