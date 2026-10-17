import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("compressed PLY auxiliary columns are bounded before allocation", async () => {
  const { loadSource } = await import("../src/mesh-export/sources.js");
  const header = `ply\nformat ascii 1.0\nelement chunk 6000000\nproperty float min_x\nelement vertex 1\nproperty uint packed_position\nproperty uint packed_rotation\nproperty uint packed_scale\nproperty uint packed_color\nend_header\n`;
  await expect(
    loadSource({ kind: "file", file: new File([header], "large.ply") }, "phone"),
  ).rejects.toThrow(/budget|memory|count|too many/i);
});

test("SOG picture limits reject a second image header before native decoding", async () => {
  const { boundedWebp } = await import("../src/mesh-export/input-budget.js");
  const original = fs.readFileSync("assets/toys/cactus/thumb.webp");
  const bytes = new Uint8Array(original.length + 14);
  bytes.set(original);
  bytes.set([86, 80, 56, 76, 5, 0, 0, 0, 47, 0, 0, 0, 0, 0], original.length);
  new DataView(bytes.buffer).setUint32(4, bytes.length - 8, true);
  let decoded = false;
  const codec = {
    decodeRGBA() {
      decoded = true;
      return {};
    },
  };
  expect(() => boundedWebp(codec, 100).decodeRGBA(bytes)).toThrow(/picture|WebP|budget/i);
  expect(decoded).toBe(false);
});

test("the ZIP guard and shared decoder select the same final directory signature", async () => {
  const { zipStored } = await import("../src/viewers/splat-io.js");
  const { checkZipBudget } = await import("../src/mesh-export/input-budget.js");
  const original = zipStored([["data", new Uint8Array(8)]]);
  const bytes = new Uint8Array(original.length + 22);
  bytes.set(original);
  const view = new DataView(bytes.buffer);
  view.setUint16(original.length - 2, 22, true);
  view.setUint32(original.length, 0x06054b50, true);
  view.setUint16(original.length + 20, 1, true);
  await expect(checkZipBudget(bytes, 1024)).rejects.toThrow(/directory|incomplete|invalid/i);
});
