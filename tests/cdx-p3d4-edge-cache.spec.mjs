import { test, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
import { prepareDepthEdges, refineDepthEdges } from "../src/photo3d/depth-edges.js";
const reference = JSON.parse(
  fs.readFileSync(new URL("./fixtures/photo-edge-hashes.json", import.meta.url)),
);
test("source-only edge preparation retains the checkpoint's geometric decisions and can be reused", () => {
  for (const { w, h, pattern, radius, sha256 } of reference.rows) {
    const rgb = Float32Array.from({ length: w * h * 3 }, (_, i) =>
      pattern === "noise" ? ((i * 29) % 255) / 255 : Math.floor(i / 3) % w < w / 2 ? 0.2 : 0.8,
    );
    const depth = Float32Array.from({ length: w * h }, (_, i) =>
      pattern === "slope"
        ? (i % w) / w
        : pattern === "step"
          ? i % w < w / 2
            ? 0.2
            : 0.8
          : ((i * 37) % 255) / 255,
    );
    const prepared = prepareDepthEdges(rgb, w, h, radius);
    for (const cache of [null, prepared, prepared, { ...prepared, rgb: new Float32Array(rgb) }]) {
      const result = refineDepthEdges(depth, rgb, w, h, radius, cache);
      expect(
        crypto.createHash("sha256").update(new Uint8Array(result.buffer)).digest("hex"),
        `${w}x${h} ${pattern} radius=${radius}`,
      ).toBe(sha256);
    }
  }
});
