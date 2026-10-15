// Build-only fallback encoding: Gaussian readers do not use the three vertex-normal fields.
// Keep every remaining property byte and verify the complete decoded Gaussian is unchanged.
import { readPlyHeader } from "../src/loaders.js";
import { readSplatPly } from "../src/video3d/ply.js";

export function compactGaussianPly(input) {
  const bytes = Buffer.from(input),
    header = readPlyHeader(bytes);
  const normals = new Set(["nx", "ny", "nz"]);
  if (!header?.vertex || header.format !== "binary_little_endian" || header.elements.length !== 1)
    throw new Error("Fallback compaction requires one uncompressed Gaussian vertex element.");
  const props = header.vertex.props;
  if (props.some((p) => p.list || !["float", "float32"].includes(p.type)))
    throw new Error("Fallback compaction requires float Gaussian properties.");
  if (!props.some((p) => normals.has(p.name))) return bytes;
  const stride = props.length * 4;
  if (bytes.length !== header.offset + header.count * stride)
    throw new Error("Unexpected Gaussian payload length.");
  const kept = props.map((p, i) => (normals.has(p.name) ? -1 : i)).filter((i) => i >= 0);
  const text = bytes
    .subarray(0, header.offset)
    .toString("utf8")
    .split(/\r?\n/)
    .filter((line) => !/^property\s+(?:float|float32)\s+n[xyz]$/.test(line.trim()))
    .join("\n");
  const prefix = Buffer.from(text),
    nextStride = kept.length * 4;
  const out = Buffer.alloc(prefix.length + header.count * nextStride);
  prefix.copy(out);
  for (let i = 0; i < header.count; i++)
    for (let j = 0; j < kept.length; j++)
      bytes.copy(
        out,
        prefix.length + i * nextStride + j * 4,
        header.offset + i * stride + kept[j] * 4,
        header.offset + i * stride + kept[j] * 4 + 4,
      );
  const before = readSplatPly(bytes),
    after = readSplatPly(out);
  if (before.count !== after.count) throw new Error("Compaction changed the Gaussian count.");
  for (const key of ["pos", "scales", "quat", "color", "opacity"])
    if (!Buffer.from(before[key].buffer).equals(Buffer.from(after[key].buffer)))
      throw new Error(`Compaction changed Gaussian ${key}.`);
  return out;
}
