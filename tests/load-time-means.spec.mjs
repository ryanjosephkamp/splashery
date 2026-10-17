// Exact smoothing data must preserve every color bit, not only the outline.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";
import { decodeSplats } from "../src/scan-format.js";
import { addScan } from "../src/packs/real-objects.js";
import { buildRecipe } from "../src/kit.js";
import { applyClay } from "../src/generators.js";

test("opening smoothing means preserve double precision and original population", () => {
  const source = fs.readFileSync("assets/toys/celestial-globe/celestial-globe.splats");
  const capacity = 12;
  const bytes = Buffer.concat([
    source.subarray(0, 44),
    Buffer.alloc(12),
    source.subarray(44, 44 + capacity * 14),
    Buffer.alloc(capacity * 24),
  ]);
  bytes.write("ROP2");
  bytes.writeUInt32LE(capacity, 44);
  bytes.writeDoubleLE(0.012, 48);
  const expected = new Float64Array(capacity * 3);
  for (let i = 0; i < expected.length; i++) {
    expected[i] = (i + 1) / (expected.length + 7);
    bytes.writeDoubleLE(expected[i], 56 + capacity * 14 + i * 8);
  }
  const a = decodeSplats(source),
    b = decodeSplats(bytes);
  expect(b.n).toBe(a.n);
  expect(b.capacity).toBe(capacity);
  expect(b.meanCell).toBe(0.012);
  expect(b.meanColor).toEqual(expected);
  expect(b.pos).toEqual(a.pos.subarray(0, capacity * 3));
  expect(() => decodeSplats(bytes.subarray(0, bytes.length - 1))).toThrow();
});

test("an exact mean prefix builds the same shaded buffers as a complete scan", () => {
  const full = decodeSplats(fs.readFileSync("assets/toys/celestial-globe/celestial-globe.splats"));
  const capacity = 4300,
    cell = 0.012,
    sums = new Map();
  const key = (i) =>
    `${Math.floor(full.pos[i * 3] / cell)},${Math.floor(full.pos[i * 3 + 1] / cell)},${Math.floor(full.pos[i * 3 + 2] / cell)},${full.part[i]}`;
  for (let i = 0; i < full.n; i++) {
    const k = key(i);
    let sum = sums.get(k);
    if (!sum) sums.set(k, (sum = [0, 0, 0, 0]));
    for (let c = 0; c < 3; c++) sum[c] += full.rgb[i * 3 + c];
    sum[3]++;
  }
  const partial = { ...full, capacity, meanCell: cell, meanColor: new Float64Array(capacity * 3) };
  for (let i = 0; i < capacity; i++) {
    const sum = sums.get(key(i));
    for (let c = 0; c < 3; c++) partial.meanColor[i * 3 + c] = sum[c] / sum[3];
  }
  for (const k of ["pos", "nrm", "sig", "rgb", "part"])
    partial[k] = full[k].subarray(0, capacity * (["pos", "nrm", "rgb"].includes(k) ? 3 : 1));
  const build = (scan, smooth = 0.35) => {
    const it = buildRecipe(
      {
        build(k) {
          addScan(k, scan, { share: 0.86, smooth, sizeMul: 0.85, exact: true });
        },
      },
      { seed: 424242, count: 5000 },
      applyClay,
    );
    let r;
    do {
      r = it.next();
    } while (!r.done);
    return r.value.buf;
  };
  const a = build(full),
    b = build(partial);
  const hash = (x) => crypto.createHash("sha256").update(new Uint8Array(x.buffer)).digest("hex");
  expect(b.count).toBe(a.count);
  for (const k of Object.keys(a).filter((k) => ArrayBuffer.isView(a[k])))
    expect(hash(b[k]), k).toBe(hash(a[k]));
  const unsmoothed = build(partial, 0),
    reference = build(full, 0);
  for (const k of Object.keys(reference).filter((k) => ArrayBuffer.isView(reference[k])))
    expect(hash(unsmoothed[k]), `unsmoothed ${k}`).toBe(hash(reference[k]));
  expect(() => build({ ...partial, meanCell: 0.024 })).toThrow(/full records/);
});
