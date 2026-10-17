// Validate untrusted declarations before the existing readers allocate columns.
// These limits belong to the walking tool; other viewers keep their own policy.
import { readPlyHeader } from "../viewers/splat-io.js";

const MAX_COUNT = 5e6;
const MAX_EXPANDED = 512 * 1024 * 1024;
export function checkCount(count, allowZero = false) {
  if (!Number.isSafeInteger(count) || count < (allowZero ? 0 : 1) || count > MAX_COUNT)
    throw new Error("Invalid splat count. Open a place with at most five million splats.");
}

export function checkPly(bytes) {
  const header = readPlyHeader(bytes);
  if (!header) throw new Error("This is not a complete PLY header.");
  let total = 0;
  for (const element of header.elements) {
    checkCount(element.count, element.name !== "vertex");
    total += element.count;
    if (total > MAX_COUNT * 2 || element.props.length > 128)
      throw new Error("This PLY has too many elements or properties for walking.");
    if (
      header.format === "ascii" &&
      element.count * element.props.length > bytes.length - header.offset
    )
      throw new Error("This PLY file is cut short.");
  }
}

export function checkSog(files) {
  const meta =
    files.get("meta.json") || [...files].find(([name]) => name.endsWith("meta.json"))?.[1];
  if (!meta || meta.length > 1024 * 1024) throw new Error("This SOG needs a small meta.json file.");
  checkCount(JSON.parse(new TextDecoder().decode(meta)).count);
}

async function inflateLimited(bytes, format, limit, { collect = true, inspect } = {}) {
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream(format))
    .getReader();
  const parts = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit)
        throw new Error("This compressed place expands beyond the walking memory limit.");
      inspect?.(value);
      if (collect) parts.push(value);
    }
  } finally {
    await reader.cancel();
  }
  if (!collect) return;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export async function checkSpz(bytes) {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return; // Existing reader explains unsupported versions.
  const header = new Uint8Array(16);
  let filled = 0,
    checked = false;
  await inflateLimited(bytes, "gzip", MAX_EXPANDED, {
    collect: false,
    inspect(chunk) {
      if (checked) return;
      const size = Math.min(16 - filled, chunk.length);
      header.set(chunk.subarray(0, size), filled);
      filled += size;
      if (filled === 16) {
        const view = new DataView(header.buffer);
        if (view.getUint32(0, true) === 0x5053474e) checkCount(view.getUint32(8, true));
        checked = true;
      }
    },
  });
}

// The existing SOG reader accepts an unpacked Map. Bound both declared and
// actual expansion here, then reuse its WebP decoding and table conversion.
export async function unpackSog(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--)
    if (view.getUint32(p, true) === 0x06054b50) {
      end = p;
      break;
    }
  if (end < 0) throw new Error("This SOG file is not a zip archive.");
  let offset = view.getUint32(end + 16, true),
    expanded = 0;
  const files = new Map();
  for (let entry = 0; entry < view.getUint16(end + 10, true); entry++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error("This SOG file’s zip index is damaged.");
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const declared = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const local = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    offset +=
      46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    const limit = Math.min(
      MAX_EXPANDED - expanded,
      name.endsWith("meta.json") ? 1024 * 1024 : MAX_EXPANDED,
    );
    if (declared > limit || local + 30 > bytes.length)
      throw new Error("This SOG exceeds the walking memory limit.");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + compressed > bytes.length) throw new Error("This SOG file is cut short.");
    const data = bytes.subarray(start, start + compressed);
    const unpacked =
      method === 0 ? data : method === 8 ? await inflateLimited(data, "deflate-raw", limit) : null;
    if (!unpacked) throw new Error("This SOG uses unsupported zip compression.");
    if (unpacked.length > limit) throw new Error("This SOG exceeds the walking memory limit.");
    expanded += unpacked.length;
    files.set(name, unpacked);
  }
  return files;
}
