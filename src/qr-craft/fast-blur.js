// MIT, Ryan with Codex (GPT-6). The accompanying WAT is the complete kernel source.
// Float64 sums, Float32 intermediate, and ties-to-even byte rounding match gaussBlur.
let kernel = null,
  loading = null;
export async function loadBlurKernel(bytes = null) {
  if (kernel) return true;
  if (!loading)
    loading = (async () => {
      try {
        const binary =
          bytes || (await (await fetch(new URL("./blur.wasm", import.meta.url))).arrayBuffer());
        kernel = (await WebAssembly.instantiate(binary)).instance.exports;
        return true;
      } catch {
        return false;
      }
    })();
  return loading;
}
export function fastBlur(data, W, H, weights) {
  if (!kernel || !(data instanceof Uint8ClampedArray) || data.length !== W * H * 4) return false;
  const D = weights.length,
    r = (D - 1) / 2;
  const tmp = data.length,
    k = Math.ceil((tmp + W * H * 12) / 8) * 8;
  const x = k + D * 8,
    y = x + W * D * 4,
    end = y + H * D * 4;
  const memory = kernel.memory;
  if (memory.buffer.byteLength < end)
    memory.grow(Math.ceil((end - memory.buffer.byteLength) / 65536));
  const pixels = new Uint8Array(memory.buffer, 0, data.length);
  pixels.set(data);
  new Float64Array(memory.buffer, k, D).set(weights);
  const xs = new Int32Array(memory.buffer, x, W * D),
    ys = new Int32Array(memory.buffer, y, H * D);
  for (let px = 0; px < W; px++)
    for (let i = -r; i <= r; i++) xs[px * D + i + r] = Math.min(W - 1, Math.max(0, px + i)) * 4;
  for (let py = 0; py < H; py++)
    for (let i = -r; i <= r; i++)
      ys[py * D + i + r] = Math.min(H - 1, Math.max(0, py + i)) * W * 12;
  kernel.blur(0, tmp, k, x, y, W, H, D);
  data.set(pixels);
  return true;
}
