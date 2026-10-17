// Fixed-mask, local luminance SSIM for the 256×256 held-out truth views.
export function maskedSSIM(a, b, valid) {
  const n = 256,
    scores = [];
  for (let y = 0; y <= n - 8; y += 4)
    for (let x = 0; x <= n - 8; x += 4) {
      const aa = [],
        bb = [];
      for (let j = 0; j < 8; j++)
        for (let k = 0; k < 8; k++) {
          const at = (y + j) * n + x + k;
          if (!valid[at]) continue;
          aa.push(0.2126 * a[at * 3] + 0.7152 * a[at * 3 + 1] + 0.0722 * a[at * 3 + 2]);
          bb.push((0.2126 * b[at * 4] + 0.7152 * b[at * 4 + 1] + 0.0722 * b[at * 4 + 2]) / 255);
        }
      if (aa.length < 48) continue;
      const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
      const ma = mean(aa),
        mb = mean(bb);
      const va = mean(aa.map((v) => (v - ma) ** 2)),
        vb = mean(bb.map((v) => (v - mb) ** 2));
      const cov = mean(aa.map((v, i) => (v - ma) * (bb[i] - mb)));
      scores.push(
        ((2 * ma * mb + 0.0001) * (2 * cov + 0.0009)) /
          ((ma * ma + mb * mb + 0.0001) * (va + vb + 0.0009)),
      );
    }
  return {
    ssim: scores.reduce((s, v) => s + v, 0) / scores.length,
    windows: scores.length,
    maskedPixels: valid.reduce((s, v) => s + v, 0),
  };
}
