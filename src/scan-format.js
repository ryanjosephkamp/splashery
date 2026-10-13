// Exact ROS1 scans, ROP1 prefixes, and ROP2 prefixes with original Float64
// smoothing means. No DOM or engine dependencies.
// Decodes a .splats file (the format is at the top of tools/ro-bake.mjs).
export function decodeSplats(bytes) {
  if (bytes.byteLength < 44) throw new Error("A truncated Real objects splat file.");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (!["ROS1", "ROP1", "ROP2"].includes(magic)) throw new Error("Not a Real objects splat file.");
  const n = dv.getUint32(4, true);
  const parts = dv.getUint32(8, true);
  const opening = magic !== "ROS1";
  const means = magic === "ROP2";
  const offset = means ? 56 : opening ? 48 : 44;
  if (bytes.byteLength < offset) throw new Error("A truncated Real objects splat file.");
  const capacity = opening ? dv.getUint32(44, true) : n;
  if (!capacity || capacity > n || bytes.byteLength !== offset + capacity * (means ? 38 : 14))
    throw new Error("A broken Real objects splat file.");
  const f = (k) => dv.getFloat32(12 + k * 4, true);
  const lo = [f(0), f(1), f(2)];
  const hi = [f(3), f(4), f(5)];
  const sLo = f(6);
  const sHi = f(7);
  const pos = new Float32Array(capacity * 3);
  const nrm = new Float32Array(capacity * 3);
  const sig = new Float32Array(capacity);
  const rgb = new Float32Array(capacity * 3);
  const part = new Uint8Array(capacity);
  let o = offset;
  for (let i = 0; i < capacity; i++) {
    for (let k = 0; k < 3; k++) {
      pos[i * 3 + k] = lo[k] + (dv.getUint16(o + k * 2, true) / 65535) * (hi[k] - lo[k]);
      nrm[i * 3 + k] = dv.getInt8(o + 6 + k) / 127;
      rgb[i * 3 + k] = bytes[o + 10 + k] / 255;
    }
    sig[i] = Math.exp(sLo + (bytes[o + 9] / 255) * (sHi - sLo));
    part[i] = bytes[o + 13];
    o += 14;
  }
  // n remains the full scan's count: addScan's size and sampling math must
  // stay exactly the same when only its used records were transferred.
  const scan = { n, capacity, parts, pos, nrm, sig, rgb, part };
  if (means) {
    scan.meanCell = dv.getFloat64(48, true);
    if (!Number.isFinite(scan.meanCell) || scan.meanCell <= 0)
      throw new Error("A broken Real objects smoothing cell.");
    scan.meanColor = new Float64Array(capacity * 3);
    for (let i = 0; i < scan.meanColor.length; i++) {
      const v = dv.getFloat64(o + i * 8, true);
      if (!Number.isFinite(v) || v < 0 || v > 1)
        throw new Error("A broken Real objects smoothing mean.");
      scan.meanColor[i] = v;
    }
  }
  return scan;
}
