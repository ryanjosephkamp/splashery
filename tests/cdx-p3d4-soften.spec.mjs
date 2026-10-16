import { test, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
import { softenDepth } from "../src/photo3d/background.js";
const reference = JSON.parse(
  fs.readFileSync(new URL("./fixtures/photo-soften-hashes.json", import.meta.url)),
);
test("prepared border coordinates retain checkpoint depth bytes at tiny, wide and portrait sizes", () => {
  for (const { w, h, sha256 } of reference.rows) {
    const input = Float32Array.from(
      { length: w * h },
      (_, i) => ((i * 13) % 97) / 97 + (Math.sin(i * 0.013) + 1) / 8,
    );
    const result = softenDepth(input, w, h);
    expect(
      crypto.createHash("sha256").update(new Uint8Array(result.buffer)).digest("hex"),
      `${w}x${h}`,
    ).toBe(sha256);
  }
});
