// KSPLAT v0.1 layout, independently decoded from the upstream format definition:
// https://github.com/mkkellogg/GaussianSplats3D/blob/main/src/loaders/SplatBuffer.js
// No upstream runtime/library is shipped. SH records are skipped; the view uses base colors.
import { SplatBuffer } from "../generators.js";

function half(h) {
  const s = h & 0x8000 ? -1 : 1,
    e = (h >>> 10) & 31,
    f = h & 1023;
  return (
    s * (e === 0 ? f * 2 ** -24 : e === 31 ? (f ? NaN : Infinity) : (1 + f / 1024) * 2 ** (e - 15))
  );
}

export function readKsplat(bytes) {
  if (bytes.byteLength < 4096) throw new Error("This KSPLAT header is truncated.");
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (o) => d.getUint32(o, true),
    u16 = (o) => d.getUint16(o, true),
    f32 = (o) => d.getFloat32(o, true);
  const sections = u32(4),
    loaded = u32(8),
    total = u32(12),
    level = u16(20);
  if (bytes[0] !== 0 || bytes[1] !== 1 || level > 2)
    throw new Error(
      "Walk inside reads KSPLAT version 0.1, compression levels 0, 1, and 2. Save other versions as PLY or SOG.",
    );
  if (
    !sections ||
    sections > 4096 ||
    loaded !== sections ||
    !total ||
    total > 5e6 ||
    u32(16) !== total
  )
    throw new Error(
      "This KSPLAT is incomplete or exceeds five million splats. Open a complete, lighter copy.",
    );
  const headerEnd = 4096 + sections * 1024;
  if (headerEnd > bytes.length) throw new Error("This KSPLAT section header is truncated.");
  // Validate every section before allocating the output.
  const records = [];
  let base = headerEnd,
    sum = 0;
  for (let s = 0; s < sections; s++) {
    const h = 4096 + s * 1024,
      count = u32(h + 4),
      degree = u16(h + 40);
    if (degree > 2 || u32(h) !== count)
      throw new Error("This KSPLAT section is incomplete or has an unsupported SH degree.");
    const stride = [
      [44, 80, 140],
      [24, 42, 72],
      [24, 33, 48],
    ][level][degree];
    const bucketCount = u32(h + 12),
      bucketBytes = u16(h + 20),
      full = u32(h + 32),
      partial = u32(h + 36),
      bucketSize = u32(h + 8);
    const metadata = partial * 4,
      bucketBase = base + metadata;
    const data = bucketBase + bucketCount * bucketBytes;
    const end = data + count * stride;
    if (end > bytes.length || end < base || sum + count > total)
      throw new Error("This KSPLAT data is truncated.");
    if (
      level &&
      (!bucketSize ||
        bucketBytes !== 12 ||
        bucketCount !== full + partial ||
        !Number.isFinite(f32(h + 16)) ||
        f32(h + 16) <= 0)
    )
      throw new Error("This KSPLAT has invalid compression buckets.");
    const lengths = [];
    let bucketSplats = full * bucketSize;
    for (let i = 0; i < partial; i++) {
      const n = u32(base + i * 4);
      lengths.push(n);
      bucketSplats += n;
    }
    if (level && bucketSplats !== count)
      throw new Error("This KSPLAT has inconsistent bucket counts.");
    records.push({
      count,
      stride,
      data,
      bucketBase,
      lengths,
      full,
      bucketSize,
      range: u32(h + 24) || 32767,
      block: f32(h + 16),
    });
    base = end;
    sum += count;
  }
  if (sum !== total) throw new Error("This KSPLAT has inconsistent splat counts.");
  const out = new SplatBuffer(total);
  for (const r of records) {
    let bucket = 0,
      nextBucket = r.full ? r.bucketSize : r.lengths[0];
    for (let i = 0; i < r.count; i++) {
      const o = r.data + i * r.stride;
      while (level && i >= nextBucket && bucket < r.full + r.lengths.length - 1) {
        bucket++;
        nextBucket += bucket < r.full ? r.bucketSize : r.lengths[bucket - r.full];
      }
      const p = [],
        scale = [],
        q = [];
      for (let a = 0; a < 3; a++) {
        p[a] = level
          ? ((u16(o + a * 2) - r.range) * r.block) / (2 * r.range) +
            f32(r.bucketBase + bucket * 12 + a * 4)
          : f32(o + a * 4);
        scale[a] = level ? half(u16(o + 6 + a * 2)) : f32(o + 12 + a * 4);
      }
      for (let a = 0; a < 4; a++)
        q[a] = level ? half(u16(o + 12 + ((a + 1) % 4) * 2)) : f32(o + 24 + ((a + 1) % 4) * 4);
      const c = o + (level ? 20 : 40);
      out.push(
        p,
        scale,
        q,
        Array.from(bytes.subarray(c, c + 4), (v) => v / 255),
      );
    }
  }
  return out;
}
