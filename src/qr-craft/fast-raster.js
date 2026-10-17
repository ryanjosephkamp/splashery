// MIT, Ryan with Codex (GPT-6). The WAT files are the complete kernel sources.
// Float64 sums and ties-to-even output preserve every byte of the JavaScript raster.
let kernel = null,
  loading = null;
const littleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
export async function loadRasterKernel(bytes = null) {
  if (kernel) return true;
  if (!loading)
    loading = (async () => {
      if (!littleEndian) return false;
      for (const name of bytes ? [null] : ["raster-simd.wasm", "raster.wasm"])
        try {
          const binary =
            bytes || (await (await fetch(new URL(name, import.meta.url))).arrayBuffer());
          kernel = (await WebAssembly.instantiate(binary)).instance.exports;
          return true;
        } catch {
          // Older browsers can use the scalar kernel or the original JavaScript.
        }
      return false;
    })();
  return loading;
}
const align = (n) => Math.ceil(n / 16) * 16;
export function fastRaster(w, indices, active, data, W, samples) {
  if (
    !kernel ||
    !(w.cells instanceof Float32Array) ||
    !Number.isInteger(w.G) ||
    w.G < 1 ||
    !Number.isInteger(w.k) ||
    w.G !== w.code.size * w.k ||
    w.cells.length !== w.G * w.G * 3 ||
    !Number.isInteger(samples) ||
    samples < 1 ||
    samples > 16
  )
    return false;
  const cells = 0,
    axis = align(w.cells.byteLength),
    flags = align(axis + indices.byteLength),
    output = align(flags + active.byteLength),
    needed = output + data.byteLength;
  if (needed > 64 * 1024 * 1024) return false;
  try {
    const memory = kernel.memory;
    if (memory.buffer.byteLength < needed)
      memory.grow(Math.ceil((needed - memory.buffer.byteLength) / 65536));
    const bytes = new Uint8Array(memory.buffer);
    bytes.set(new Uint8Array(w.cells.buffer, w.cells.byteOffset, w.cells.byteLength), cells);
    bytes.set(new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength), axis);
    bytes.set(active, flags);
    bytes.fill(255, output, needed);
    kernel.raster(cells, axis, flags, output, W, w.G, samples);
    data.set(bytes.subarray(output, needed));
    return true;
  } catch {
    return false;
  }
}
