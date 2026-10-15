// Select correction share from source contrast; acceptance checks remain separate.
const lowContrast = new WeakMap();
export function detailFraction(picture, shape) {
  if (!picture?.data?.length || shape !== "square") return 0.4;
  if (!lowContrast.has(picture)) {
    const sum = [0, 0, 0],
      squared = [0, 0, 0];
    const count = picture.data.length / 3;
    for (let i = 0; i < picture.data.length; i++) {
      const channel = i % 3,
        value = picture.data[i];
      sum[channel] += value;
      squared[channel] += value * value;
    }
    lowContrast.set(
      picture,
      sum.every(
        (value, channel) => Math.max(0, squared[channel] / count - (value / count) ** 2) <= 0.01,
      ),
    );
  }
  return lowContrast.get(picture) ? 0.6 : 0.4;
}
