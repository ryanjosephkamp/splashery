import test from "node:test";
import assert from "node:assert/strict";
const m = await import("../tools/studio-truth/transport.mjs").catch(() => ({}));

test("lossless browser byte transport preserves every quantized prediction across chunk boundaries", () => {
  assert.equal(typeof m.encodeBytes, "function");
  const backing = Uint8Array.from({ length: 100003 }, (_, i) => i % 256);
  const bytes = backing.subarray(7, 100000);
  const encoded = m.encodeBytes(bytes);
  assert.deepEqual(Buffer.from(encoded, "base64"), Buffer.from(bytes));
  const values = m.decodeNear(encoded);
  assert.equal(values.length, bytes.length);
  for (let i = 0; i < bytes.length; i++) assert.equal(values[i], Math.fround(bytes[i] / 255));
});
