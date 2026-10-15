// Finder geometry is shared by the rendered toys and the qualification study.
export const EYE_SHAPES = ["square", "rounded", "circle"];
const BOXES = Object.fromEntries(
  EYE_SHAPES.map((shape) => {
    const radii =
      shape === "circle" ? [3.5, 2.5, 1.5] : shape === "rounded" ? [1, 0.65, 0.5] : [0, 0, 0];
    return [shape, [3.5, 2.5, 1.5].map((half, i) => ({ half, radius: radii[i] }))];
  }),
);
export function eyeBoxes(shape) {
  return BOXES[shape] || BOXES.square;
}
function inBox(x, y, { half, radius }) {
  if (Math.abs(x) > half || Math.abs(y) > half) return false;
  if (!radius) return true;
  return (
    Math.hypot(
      Math.max(0, Math.abs(x) - half + radius),
      Math.max(0, Math.abs(y) - half + radius),
    ) <= radius
  );
}
export function finderBit(x, y, shape) {
  const [outer, hole, core] = eyeBoxes(shape);
  return (inBox(x, y, outer) && !inBox(x, y, hole)) || inBox(x, y, core);
}
export function finderAt(code, x, y, shape) {
  if (!EYE_SHAPES.includes(shape)) return null;
  for (const p of code.pieces) {
    if (p.kind !== "finder") continue;
    const dx = x - (p.col + 3.5 - code.size / 2);
    const dy = y - (code.size / 2 - p.row - 3.5);
    if (Math.abs(dx) < 3.5 && Math.abs(dy) < 3.5) return finderBit(dx, dy, shape);
  }
  return null;
}
export function wovenEyes(w, shape) {
  if (!EYE_SHAPES.includes(shape) || shape === "square") return w;
  const cells = w.cells.slice();
  for (const p of w.code.pieces) {
    if (p.kind !== "finder") continue;
    for (let y = 0; y < 7 * w.k; y++)
      for (let x = 0; x < 7 * w.k; x++) {
        const bit = finderBit((x + 0.5) / w.k - 3.5, (y + 0.5) / w.k - 3.5, shape);
        const at = ((p.row * w.k + y) * w.G + p.col * w.k + x) * 3;
        cells.set(bit ? [0.07, 0.08, 0.1] : [1, 1, 1], at);
      }
  }
  return { ...w, cells, eyeShape: shape };
}

export function paintEyes(code, shape, crisp, colorAt, paramsFor, z = 0.14) {
  for (const p of code.pieces) {
    if (p.kind !== "finder") continue;
    const x = p.col + 3.5 - code.size / 2;
    const y = code.size / 2 - p.row - 3.5;
    const boxes = eyeBoxes(shape).map(({ half: h, radius: r }) => ({
      x0: x - h,
      y0: y - h,
      x1: x + h,
      y1: y + h,
      rad: [r, r, r, r],
    }));
    const params = paramsFor(p);
    crisp({ ...boxes[0], hole: boxes[1], z, color: (px, py) => colorAt(px, py, true), params });
    crisp({ ...boxes[2], z, color: (px, py) => colorAt(px, py, true), params });
  }
}
