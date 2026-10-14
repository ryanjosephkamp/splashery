// MIT. Fit a camera gauge from paired training camera centers, never held-out RGB.
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const rotate = (p, r) => r.map((row) => dot(row, p));
export const applySimilarity = (p, fit) =>
  rotate(p, fit.rotation).map((v, i) => fit.scale * v + fit.translation[i]);
export const invertSimilarity = (p, fit) => {
  const q = p.map((v, i) => (v - fit.translation[i]) / fit.scale);
  return [0, 1, 2].map((c) => fit.rotation.reduce((s, row, i) => s + row[c] * q[i], 0));
};

function centered(points) {
  if (points.length < 3 || points.some((p) => p.length !== 3 || p.some((v) => !Number.isFinite(v))))
    throw new Error("Insufficient finite camera calibration points");
  const mean = [0, 1, 2].map((c) => points.reduce((s, p) => s + p[c], 0) / points.length);
  const values = points.map((p) => p.map((v, i) => v - mean[i]));
  const variance = values.reduce((s, p) => s + dot(p, p), 0);
  const longest = values.reduce((a, b) => (dot(a, a) > dot(b, b) ? a : b));
  const transverse = values.reduce(
    (s, p) => s + dot(p, p) - dot(p, longest) ** 2 / dot(longest, longest),
    0,
  );
  if (!(variance > 1e-12) || !(transverse > variance * 1e-8))
    throw new Error("Stationary or collinear camera calibration is ambiguous");
  return { mean, values, variance };
}

// Jacobi diagonalization avoids selecting a large negative eigenvalue by magnitude.
function largestEigenvector(matrix) {
  const a = matrix.map((row) => [...row]);
  const v = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => +(i === j)));
  for (let step = 0; step < 100; step++) {
    let p = 0,
      q = 1;
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++) if (Math.abs(a[i][j]) > Math.abs(a[p][q])) [p, q] = [i, j];
    if (Math.abs(a[p][q]) < 1e-14) break;
    const angle = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const pp = a[p][p],
      qq = a[q][q],
      pq = a[p][q];
    a[p][p] = c * c * pp - 2 * s * c * pq + s * s * qq;
    a[q][q] = s * s * pp + 2 * s * c * pq + c * c * qq;
    a[p][q] = a[q][p] = 0;
    for (let k = 0; k < 4; k++) {
      if (k !== p && k !== q) {
        const kp = a[k][p],
          kq = a[k][q];
        a[k][p] = a[p][k] = c * kp - s * kq;
        a[k][q] = a[q][k] = s * kp + c * kq;
      }
      const vp = v[k][p],
        vq = v[k][q];
      v[k][p] = c * vp - s * vq;
      v[k][q] = s * vp + c * vq;
    }
  }
  const column = a.reduce((best, row, i) => (row[i] > a[best][best] ? i : best), 0);
  return v.map((row) => row[column]);
}

export function fitSimilarity(source, target) {
  if (source.length !== target.length) throw new Error("Mismatched camera calibration pairs");
  const x = centered(source),
    y = centered(target);
  const s = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) =>
      x.values.reduce((sum, p, k) => sum + p[i] * y.values[k][j], 0),
    ),
  );
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = s;
  const [w, a, b, c] = largestEigenvector([
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ]);
  const rotation = [
    [1 - 2 * (b * b + c * c), 2 * (a * b - w * c), 2 * (a * c + w * b)],
    [2 * (a * b + w * c), 1 - 2 * (a * a + c * c), 2 * (b * c - w * a)],
    [2 * (a * c - w * b), 2 * (b * c + w * a), 1 - 2 * (a * a + b * b)],
  ];
  const scale =
    x.values.reduce((sum, p, i) => sum + dot(rotate(p, rotation), y.values[i]), 0) / x.variance;
  if (!(scale > 0) || !Number.isFinite(scale)) throw new Error("Invalid camera calibration scale");
  const translation = y.mean.map((v, i) => v - scale * rotate(x.mean, rotation)[i]);
  const fit = { scale, rotation, translation };
  fit.rmsMeters = Math.sqrt(
    source.reduce(
      (sum, p, i) =>
        sum + applySimilarity(p, fit).reduce((s, v, c) => s + (v - target[i][c]) ** 2, 0),
      0,
    ) / source.length,
  );
  return fit;
}
