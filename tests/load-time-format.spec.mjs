// Task 51: exact scan prefix format, with its original population count.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { decodeSplats } from "../src/scan-format.js";

test("a scan prefix preserves its original sampling count and every loaded value", () => {
  const full = fs.readFileSync("assets/toys/fountain-pen/fountain-pen.splats");
  const capacity = 100;
  const prefix = Buffer.concat([
    full.subarray(0, 44),
    Buffer.alloc(4),
    full.subarray(44, 44 + capacity * 14),
  ]);
  prefix.write("ROP1");
  prefix.writeUInt32LE(capacity, 44);
  const a = decodeSplats(full);
  const b = decodeSplats(prefix);
  expect(b.n).toBe(a.n);
  expect(b.capacity).toBe(capacity);
  for (const key of ["pos", "nrm", "sig", "rgb", "part"])
    expect(b[key]).toEqual(
      a[key].subarray(0, capacity * (key === "pos" || key === "nrm" || key === "rgb" ? 3 : 1)),
    );
  expect(() => decodeSplats(prefix.subarray(0, prefix.length - 1))).toThrow();
});
