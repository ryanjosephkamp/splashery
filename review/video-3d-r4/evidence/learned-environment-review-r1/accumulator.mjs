// MIT. Made by Ryan with Codex (GPT-6). OUTSIDE-only math/control prototype; no renderer hookup.
const finite3 = (v) => v?.length === 3 && v.every(Number.isFinite);
const color3 = (v) => finite3(v) && v.every((x) => x >= 0 && x <= 1);
class Sum {
  value = 0;
  correction = 0;
  add(value) {
    const next = this.value + value;
    this.correction += Math.abs(this.value) >= Math.abs(value)
      ? this.value - next + value : value - next + this.value;
    this.value = next;
  }
  total() { return this.value + this.correction; }
}

// Inventory must come from the actual frozen loss split, not a reconstruction's whole cam list.
export function createAccumulator(inventory, oldBackground = [0, 0, 0]) {
  if (!color3(oldBackground)) throw new Error("Invalid existing background");
  const cameras = new Map();
  for (const { id, pixels } of inventory) {
    if (cameras.has(id) || !Number.isSafeInteger(pixels) || pixels < 1)
      throw new Error("Invalid/duplicate camera inventory");
    cameras.set(id, { pixels, next: 0 });
  }
  const denominator = new Sum(), cross = [new Sum(), new Sum(), new Sum()],
    square = [new Sum(), new Sum(), new Sum()];
  let pixels = 0, invalid = 0, failed = false;
  return {
    add({ id, offset, rgba, targets, gain = 1, bias = 0, renderBackground = [0, 0, 0], signal }) {
      if (failed) throw new Error("Accumulator already failed");
      try {
        const camera = cameras.get(id);
        if (!camera) throw new Error("Camera is not in the eligible training inventory");
        if (offset !== camera.next || targets.length < 1 || rgba.length !== targets.length * 4 ||
            camera.next + targets.length > camera.pixels) throw new Error("Invalid/duplicate pixel chunk");
        if (!(targets instanceof Uint32Array) || !Number.isFinite(gain) || gain <= 0 ||
            !Number.isFinite(bias) || !color3(renderBackground)) throw new Error("Invalid target/exposure convention");
        for (let p = 0; p < targets.length; p++) {
          if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
          const packed = targets[p], alphaCode = packed >>> 24;
          if (alphaCode === 0) { invalid++; continue; }
          if (alphaCode !== 255) throw new Error("Soft/empty-alpha targets unsupported");
          const alpha = rgba[p * 4 + 3];
          if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw new Error("Invalid raw opacity");
          const transmittance = 1 - alpha, coefficient = gain * transmittance;
          denominator.add(coefficient * coefficient);
          for (let c = 0; c < 3; c++) {
            const rendered = rgba[p * 4 + c];
            if (!Number.isFinite(rendered)) throw new Error("Nonfinite raw RGB");
            const target = ((packed >>> (c * 8)) & 255) / 255,
              black = rendered - transmittance * renderBackground[c],
              residual = target - gain * black - bias;
            cross[c].add(coefficient * residual);
            square[c].add(residual * residual);
          }
          pixels++;
        }
        camera.next += targets.length;
      } catch (error) { failed = true; throw error; }
    },
    finish() {
      if (failed) throw new Error("Accumulator already failed");
      if ([...cameras.values()].some((camera) => camera.next !== camera.pixels))
        throw new Error("Incomplete eligible training inventory");
      if (!pixels) throw new Error("No valid training pixels");
      const den = denominator.total(), linear = cross.map((sum) => sum.total()),
        constant = square.map((sum) => sum.total()),
        identifiable = cameras.size >= 3 && den / pixels >= 1e-6,
        background = identifiable ? linear.map((value) => Math.max(0, Math.min(1, value / den))) : [...oldBackground];
      if (![den, ...linear, ...constant].every(Number.isFinite)) throw new Error("Nonfinite accumulated objective");
      const sse = (color) => constant.reduce((sum, value, c) =>
        sum + value - 2 * color[c] * linear[c] + color[c] * color[c] * den, 0);
      // Difference of quadratics avoids subtracting two large almost-equal total errors.
      const delta = background.reduce((sum, value, c) => sum +
        (value - oldBackground[c]) * (den * (value + oldBackground[c]) - 2 * linear[c]), 0);
      return { background, identifiable, cameras: cameras.size, pixels, invalid,
        meanCoefficientEnergy: den / pixels, denominator: den, cross: linear, constant,
        oldMSE: sse(oldBackground) / (3 * pixels), newMSE: sse(background) / (3 * pixels),
        deltaMSE: delta / (3 * pixels) };
    },
  };
}
