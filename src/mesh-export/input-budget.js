// Guard compressed-input allocations before calling the shared format readers.
export async function checkZipBudget(bytes, limit) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (dv.getUint32(i, true) === 0x06054b50) {
      // Match the shared reader's last-signature selection, including a
      // signature inside a comment. Never validate a different directory.
      if (i + 22 + dv.getUint16(i + 20, true) !== bytes.length)
        throw new Error("The SOG ZIP directory is incomplete or invalid.");
      end = i;
      break;
    }
  if (end < 0) throw new Error("The SOG ZIP directory is missing or incomplete.");
  const count = dv.getUint16(end + 10, true),
    size = dv.getUint32(end + 12, true);
  let offset = dv.getUint32(end + 16, true),
    total = 0;
  if (
    dv.getUint16(end + 4, true) !== 0 ||
    dv.getUint16(end + 6, true) !== 0 ||
    dv.getUint16(end + 8, true) !== count ||
    count > 256 ||
    offset + size > end
  )
    throw new Error("The SOG ZIP directory exceeds the device budget.");
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || dv.getUint32(offset, true) !== 0x02014b50)
      throw new Error("The SOG ZIP directory is invalid.");
    total += dv.getUint32(offset + 24, true);
    if (total > limit) throw new Error("This SOG ZIP expands beyond the device memory budget.");
    const method = dv.getUint16(offset + 10, true),
      compressed = dv.getUint32(offset + 20, true),
      expanded = dv.getUint32(offset + 24, true),
      local = dv.getUint32(offset + 42, true);
    if (local + 30 > bytes.length || dv.getUint32(local, true) !== 0x04034b50)
      throw new Error("The SOG ZIP local header is invalid.");
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    if (start + compressed > bytes.length) throw new Error("The SOG ZIP entry is incomplete.");
    if (method === 0 && compressed !== expanded)
      throw new Error("The SOG ZIP entry has inconsistent sizes.");
    if (method === 8) {
      // Do not trust the declared size: count actual expansion in a bounded
      // stream before the shared reader materializes any entry buffers.
      const reader = new Blob([bytes.subarray(start, start + compressed)])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"))
        .getReader();
      let actual = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          actual += value.length;
          if (actual > expanded || total - expanded + actual > limit)
            throw new Error(
              "This SOG ZIP expands beyond its declared size or device memory budget.",
            );
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      if (actual !== expanded) throw new Error("The SOG ZIP expanded size is inconsistent.");
    } else if (method !== 0) throw new Error("This SOG ZIP compression method is not supported.");
    offset +=
      46 +
      dv.getUint16(offset + 28, true) +
      dv.getUint16(offset + 30, true) +
      dv.getUint16(offset + 32, true);
  }
}

export function boundedWebp(codec, maxPixels) {
  return {
    decodeRGBA(bytes) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      // SOG v2 encodes its numeric tables in lossless WebP. Inspect the RIFF
      // chunks before the native decoder allocates its pixel buffer.
      const tagAt = (offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
      if (
        bytes.length < 12 ||
        tagAt(0) !== "RIFF" ||
        tagAt(8) !== "WEBP" ||
        dv.getUint32(4, true) + 8 !== bytes.length
      )
        throw new Error("The SOG picture has an invalid WebP container.");
      let image = null,
        canvas = null,
        offset = 12;
      while (offset + 8 <= bytes.length) {
        const tag = String.fromCharCode(...bytes.subarray(offset, offset + 4));
        const length = dv.getUint32(offset + 4, true);
        if (offset + 8 + length + (length & 1) > bytes.length)
          throw new Error("A SOG picture is incomplete.");
        if (tag === "VP8L") {
          if (image || length < 5 || bytes[offset + 8] !== 0x2f)
            throw new Error("A SOG picture has an invalid or duplicate image header.");
          const bits = dv.getUint32(offset + 9, true),
            width = (bits & 16383) + 1,
            height = ((bits >>> 14) & 16383) + 1;
          if (width * height > maxPixels)
            throw new Error("A SOG picture exceeds the device memory budget.");
          image = [width, height];
        } else if (tag === "VP8X") {
          if (canvas || length !== 10 || bytes[offset + 8] & 2)
            throw new Error("A SOG picture has an unsupported extended WebP header.");
          const u24 = (p) => bytes[p] + bytes[p + 1] * 256 + bytes[p + 2] * 65536;
          canvas = [u24(offset + 12) + 1, u24(offset + 15) + 1];
          if (canvas[0] * canvas[1] > maxPixels)
            throw new Error("A SOG picture exceeds the device memory budget.");
        } else if (!["ICCP", "EXIF", "XMP "].includes(tag))
          throw new Error("This SOG picture is not a supported lossless WebP.");
        offset += 8 + length + (length & 1);
      }
      if (
        !image ||
        offset !== bytes.length ||
        (canvas && (canvas[0] !== image[0] || canvas[1] !== image[1]))
      )
        throw new Error("A SOG picture has inconsistent WebP dimensions or chunks.");
      return codec.decodeRGBA(bytes);
    },
  };
}
