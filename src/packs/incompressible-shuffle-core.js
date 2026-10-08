// Exact local material paths, not a numerical fluid solver.
// Source: Finite Instructions and Solenoidal Shear Flows, §3, Lemma 3.1.
export const PRESETS = [0.5, 1, 2];
export const STAGES = [
  "Lift",
  "Shear Y −λ",
  "Shear X (1/λ − 1)",
  "Shear Y +1",
  "Shear X (λ − 1)",
  "Translate",
  "Lower",
];
export function pulse(u) {
  if (!Number.isFinite(u)) throw new RangeError("Time must be finite.");
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return 1 / (1 + Math.exp(1 / u - 1 / (1 - u)));
}
export function path(label, branch, lambda, time) {
  if (!PRESETS.includes(lambda) || !Number.isFinite(time))
    throw new RangeError("Invalid stretch or time.");
  if (![0, 1].includes(branch) || label.length !== 2 || !label.every(Number.isFinite))
    throw new RangeError("Invalid material label.");
  const t = Math.max(0, Math.min(1, time));
  const theta = Array.from({ length: 7 }, (_, j) => pulse(t * 16 - (2 * j + 1)));
  let [x, y] = label;
  y -= theta[1] * lambda * x;
  x += theta[2] * (1 / lambda - 1) * y;
  y += theta[3] * x;
  x += theta[4] * (lambda - 1) * y;
  const p = branch ? 1.25 : -1.25,
    h = branch ? 2.5 : 1.25;
  return [p * (1 - 2 * theta[5]) + x, y, h * (theta[0] - theta[6])];
}
export function unmap(point, branch, lambda, time) {
  const o = path([0, 0], branch, lambda, time),
    a = path([1, 0], branch, lambda, time),
    b = path([0, 1], branch, lambda, time);
  const x = point[0] - o[0],
    y = point[1] - o[1];
  const ax = a[0] - o[0],
    ay = a[1] - o[1],
    bx = b[0] - o[0],
    by = b[1] - o[1];
  const det = ax * by - ay * bx;
  return [(by * x - bx * y) / det, (-ay * x + ax * y) / det];
}
