import { test, expect } from "@playwright/test";
import { buildRoom } from "../src/walk/rooms.js";

test("PLY and SPZ stay local, preserve scale, and become the same collision floor", async () => {
  const { readPlace, tableFromBuffer } = await import("../src/walk/io.js");
  const { writeSplatFile } = await import("../src/viewers/splat-io.js");
  const source = buildRoom("gallery").buffer;
  const t = tableFromBuffer(source);
  for (const format of ["ply", "spz", "sog"]) {
    const { getWebp } = await import("../src/viewers/engine.js");
    const bytes = await writeSplatFile(t, format, { getWebp });
    const b = await readPlace(bytes, `room.${format}`, { axes: "y-up" });
    expect(b.count).toBe(source.count);
    expect(Math.abs(b.pos[1] - source.pos[1])).toBeLessThan(0.03);
    expect(Math.abs(b.scale[0] - source.scale[0])).toBeLessThan(0.03);
    if (format === "sog") {
      const { unzip } = await import("../src/viewers/splat-io.js");
      const files = await unzip(bytes);
      const loose = await readPlace(files.get("meta.json"), "meta.json", { axes: "y-up", files });
      expect(loose.count).toBe(source.count);
      expect(Array.from(loose.pos)).toEqual(Array.from(b.pos));
    }
  }
});

test("malformed PLY and SOG counts are rejected before loader column allocations", async () => {
  const { readPlace } = await import("../src/walk/io.js");
  const { zipStored } = await import("../src/viewers/splat-io.js");
  const enc = new TextEncoder();
  const Native64 = globalThis.Float64Array;
  const Native32 = globalThis.Float32Array;
  let allocated = false;
  const guarded = (Native) =>
    new Proxy(Native, {
      construct(Target, args) {
        if (typeof args[0] === "number" && (!Number.isFinite(args[0]) || args[0] > 1e5)) {
          allocated = true;
          throw new Error("Unsafe loader allocation intercepted");
        }
        return new Target(...args);
      },
    });
  globalThis.Float64Array = guarded(Native64);
  globalThis.Float32Array = guarded(Native32);
  try {
    for (const count of [6000000, -1, 0.5, NaN, Infinity]) {
      const ply = enc.encode(
        `ply\nformat ascii 1.0\nelement vertex ${count}\nproperty float x\nproperty float y\nproperty float z\nend_header\n`,
      );
      await expect(readPlace(ply, "bad.ply")).rejects.toThrow(/count|five million/i);
      // JSON cannot encode NaN/Infinity; null must also be rejected as a count.
      const meta = enc.encode(JSON.stringify({ version: 2, count }));
      await expect(readPlace(meta, "meta.json")).rejects.toThrow(/count|five million/i);
      await expect(readPlace(zipStored([["meta.json", meta]]), "bad.sog")).rejects.toThrow(
        /count|five million/i,
      );
    }
    const { gzipSync } = await import("node:zlib");
    const header = new Uint8Array(16);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x5053474e, true);
    view.setUint32(4, 3, true);
    view.setUint32(8, 6000000, true);
    await expect(readPlace(gzipSync(header), "bad.spz")).rejects.toThrow(/count|five million/i);
    expect(allocated).toBe(false);
  } finally {
    globalThis.Float64Array = Native64;
    globalThis.Float32Array = Native32;
  }
});

function ksplat(level) {
  const compressed = level > 0;
  const size = compressed ? 24 : 44;
  const bytes = new Uint8Array(5120 + (compressed ? 12 : 0) + size);
  const d = new DataView(bytes.buffer);
  bytes[1] = 1;
  for (const o of [4, 8, 12, 16, 4096, 4100]) d.setUint32(o, 1, true);
  d.setUint16(20, level, true);
  let base = 5120;
  if (compressed) {
    d.setUint32(4104, 1, true);
    d.setUint32(4108, 1, true);
    d.setFloat32(4112, 5, true);
    d.setUint16(4116, 12, true);
    d.setUint32(4120, 32767, true);
    d.setUint32(4128, 1, true);
    d.setFloat32(base, 1, true);
    d.setFloat32(base + 4, 2, true);
    d.setFloat32(base + 8, 3, true);
    base += 12;
    for (let a = 0; a < 3; a++) d.setUint16(base + a * 2, 32767, true);
    for (let a = 3; a < 6; a++) d.setUint16(base + a * 2, 0x2e66, true); // ~0.1
    d.setUint16(base + 12, 0x3c00, true); // w=1
  } else {
    [1, 2, 3, 0.1, 0.1, 0.01, 1, 0, 0, 0].forEach((v, a) => d.setFloat32(base + a * 4, v, true));
  }
  bytes.set([120, 160, 200, 255], base + (compressed ? 20 : 40));
  return bytes;
}

test("KSPLAT v0.1 reads uncompressed and both bucket compression levels", async () => {
  const { readPlace } = await import("../src/walk/io.js");
  for (const level of [0, 1, 2]) {
    const b = await readPlace(ksplat(level), "room.ksplat", { axes: "y-up" });
    expect(b.count).toBe(1);
    expect(Array.from(b.pos)).toEqual([1, 2, 3]);
    expect(b.color[3]).toBe(1);
    expect(b.rot[3]).toBe(1);
    expect(b.scale[0]).toBeCloseTo(0.1, 3);
  }
  await expect(readPlace(ksplat(0).slice(0, 5000), "bad.ksplat")).rejects.toThrow(
    /short|truncated/i,
  );
  await expect(readPlace(new Uint8Array(30), "bad.ply")).rejects.toThrow(/PLY/i);
});

test("KSPLAT partial buckets retain each point’s bucket center", async () => {
  const { readPlace } = await import("../src/walk/io.js");
  const bytes = new Uint8Array(5120 + 8 + 24 + 3 * 24),
    d = new DataView(bytes.buffer);
  const base = ksplat(1);
  bytes.set(base.subarray(0, 5120));
  for (const offset of [12, 16, 4096, 4100]) d.setUint32(offset, 3, true);
  d.setUint32(4104, 256, true);
  d.setUint32(4108, 2, true);
  d.setUint32(4128, 0, true);
  d.setUint32(4132, 2, true);
  d.setUint32(5120, 1, true);
  d.setUint32(5124, 2, true);
  [1, 2, 3, 4, 5, 6].forEach((v, i) => d.setFloat32(5128 + i * 4, v, true));
  for (let i = 0; i < 3; i++) bytes.set(base.subarray(5132), 5152 + i * 24);
  const b = await readPlace(bytes, "partial.ksplat", { axes: "y-up" });
  expect(Array.from(b.pos)).toEqual([1, 2, 3, 4, 5, 6, 4, 5, 6]);
});

test("million-splat collision work runs in a worker and reports its actual cost", async ({
  page,
}) => {
  await page.goto("/?renderer=none");
  await (
    await page.context().newCDPSession(page)
  ).send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const result = await page.evaluate(async () => {
    const { WalkWorker } = await import("/src/walk/client.js");
    const { buildRoom } = await import("/src/walk/rooms.js");
    const source = buildRoom("courtyard").buffer;
    const count = 1e6;
    const buffer = { count };
    for (const [key, width] of [
      ["pos", 3],
      ["scale", 3],
      ["rot", 4],
      ["color", 4],
    ]) {
      buffer[key] = new Float32Array(count * width);
      for (let i = 0; i < count; i++)
        buffer[key].set(
          source[key].subarray((i % source.count) * width, (i % source.count) * width + width),
          i * width,
        );
    }
    const client = new WalkWorker();
    const result = await client.run({ buffer, budget: 24000 });
    client.destroy();
    return {
      ms: result.grid.buildMs,
      count: result.count,
      cell: result.grid.cell,
      drawn: result.chunks.reduce((n, c) => n + c.buffer.count, 0),
    };
  });
  expect(result.count).toBe(1e6);
  expect(result.cell).toBe(0.1);
  expect(result.drawn).toBeLessThanOrEqual(24000);
  expect(result.ms).toBeLessThan(2000);
});

test("malformed geometry is rejected without an unbounded grid allocation", async () => {
  const { levelBuffer } = await import("../src/walk/geometry.js");
  const { buildGrid } = await import("../src/walk/grid.js");
  const bad = buildRoom("gallery").buffer;
  for (let i = 0; i < bad.count; i++) bad.rot[i * 4 + 3] = NaN;
  expect(() => levelBuffer(bad)).toThrow(/dense|floor|solid/i);
  const huge = buildRoom("gallery").buffer;
  for (let i = 0; i < huge.pos.length; i++) huge.pos[i] *= 100;
  expect(() => buildGrid(huge)).toThrow(/large|crop/i);
});

test("a capture far from the origin spawns on its actual floor", async () => {
  const { preparePlace } = await import("../src/walk/prepare.js");
  const buffer = buildRoom("gallery").buffer;
  for (let i = 0; i < buffer.count; i++) {
    buffer.pos[i * 3] += 150;
    buffer.pos[i * 3 + 2] -= 80;
  }
  const { result } = await preparePlace({ buffer, budget: 1000 });
  expect(result.spawn[0]).toBeGreaterThan(145);
  expect(result.spawn[0]).toBeLessThan(155);
  expect(result.spawn[2]).toBeGreaterThan(-86);
  expect(result.spawn[2]).toBeLessThan(-74);
});

test("closing cancels the worker and LOD cannot change collision support", async ({ page }) => {
  await page.goto("/?renderer=none");
  const result = await page.evaluate(async () => {
    const { WalkWorker } = await import("/src/walk/client.js");
    const w = new WalkWorker();
    const a = await w.run({ room: "gallery", budget: 1000 });
    const b = await w.run({ room: "gallery", budget: 40000 });
    const pending = w.run({ room: "gallery" });
    w.destroy();
    let canceled = false;
    try {
      await pending;
    } catch (e) {
      canceled = e.name === "AbortError";
    }
    return {
      canceled,
      same: a.grid.floor.every((v, i) => Object.is(v, b.grid.floor[i])),
      counts: [a.grid.accepted, b.grid.accepted],
    };
  });
  expect(result.canceled).toBe(true);
  expect(result.same).toBe(true);
  expect(result.counts[0]).toBe(result.counts[1]);
});

test("a capture can be rescaled after its initial collision grid fails", async ({ page }) => {
  await page.goto("/?renderer=none");
  const result = await page.evaluate(async () => {
    const { WalkWorker } = await import("/src/walk/client.js");
    const { buildRoom } = await import("/src/walk/rooms.js");
    const { transform } = await import("/src/walk/geometry.js");
    const buffer = transform(buildRoom("courtyard").buffer, [0, 0, 0, 1], 100);
    const w = new WalkWorker();
    let failed = false;
    try {
      await w.run({ buffer });
    } catch {
      failed = true;
    }
    try {
      const corrected = await w.run({ level: { meters: 0.01 } });
      return { failed, count: corrected.count, spawn: corrected.spawn };
    } finally {
      w.destroy();
    }
  });
  expect(result.failed).toBe(true);
  expect(result.count).toBeGreaterThan(1000);
  expect(Math.abs(result.spawn[1])).toBeLessThan(0.05);
});
