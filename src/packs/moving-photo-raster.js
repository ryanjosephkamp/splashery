// Conservative clip-only raster bounds. Keep a face unless its projected
// rectangle, including Float32 shader roundoff, contains a pixel center.
// This removes no source/depth samples and introduces no screen-space blur.
const U = 2 ** -24;
const gamma = (n) => (n * U) / (1 - n * U);
const mul = (a, b) => {
  const c = new Float64Array(16);
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < 4; i++)
      for (let k = 0; k < 4; k++) c[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
  return c;
};
const absDot = (m, v, rows = 4) =>
  Array.from({ length: rows }, (_, i) =>
    v.reduce((sum, x, j) => sum + Math.abs(m[j * rows + i]) * x, 0),
  );
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function clipRasterView(vp, model, uniforms, width, height, w, h, quantum = 1 / 16) {
  const u = Object.fromEntries(
    Object.entries(uniforms).map(([key, values]) => [key, values.map(Math.fround)]),
  );
  let q = u.uBodyQ;
  if (q.reduce((sum, x) => sum + x * x, 0) < 1e-8) q = [0, 0, 0, 1];
  const [x, y, z, t] = q,
    cross = [0, z, -y, -z, 0, x, y, -x, 0];
  const rotation = new Float64Array(9),
    magnitude = new Float64Array(9);
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 3; i++) {
      let r = i === j ? 1 : 0,
        bound = r;
      for (let k = 0; k < 3; k++) {
        r += 2 * cross[k * 3 + i] * (cross[j * 3 + k] + (j === k ? t : 0));
        bound +=
          2 *
          Math.abs(cross[k * 3 + i]) *
          (Math.abs(cross[j * 3 + k]) + (j === k ? Math.abs(t) : 0));
      }
      rotation[j * 3 + i] = r;
      magnitude[j * 3 + i] = bound;
    }
  const fit = u.uTf,
    toy = u.uToy,
    move = u.uBodyT,
    scale = fit[3];
  const body = Float64Array.from(IDENTITY);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) body[j * 4 + i] = rotation[j * 3 + i] * scale;
    body[12 + i] = toy[i] + move[i];
    for (let j = 0; j < 3; j++) body[12 + i] -= rotation[j * 3 + i] * (fit[j] * scale + toy[j]);
  }
  const [gw, gh] = u.uGrid,
    [lift, base] = u.uLift;
  const native = Float64Array.from(IDENTITY);
  native[0] = gw / w;
  native[5] = -gh / h;
  native[10] = lift;
  native[12] = -gw / 2;
  native[13] = gh / 2;
  native[14] = -lift * base;
  const matrix = mul(vp, mul(model, mul(body, native)));
  // Positive absolute-value paths bound every rounding operation in psvPlace,
  // including cancellation in its two quaternion cross products. This bound
  // is shared by all vertices; perspective division is bounded per vertex.
  const p = [Math.abs(gw) / 2, Math.abs(gh) / 2, Math.abs(lift) * (1.00001 + Math.abs(base))];
  let error = [
    2 * U * Math.abs(gw),
    2 * U * Math.abs(gh),
    U * Math.abs(lift) * (8 + 4 * Math.abs(base)),
  ];
  const fitted = p.map((v, i) => (v + Math.abs(fit[i])) * Math.abs(scale));
  error = error.map((e, i) => (e + gamma(2) * (p[i] + Math.abs(fit[i]))) * Math.abs(scale));
  const centered = fitted.map((v, i) => v + Math.abs(toy[i]));
  error = error.map((e, i) => e + U * centered[i]);
  const rotated = absDot(magnitude, centered, 3);
  error = absDot(magnitude, error, 3).map((e, i) => e + gamma(32) * rotated[i]);
  const placed = rotated.map((v, i) => v + Math.abs(toy[i]) + Math.abs(move[i]));
  error = error.map((e, i) => e + gamma(2) * placed[i]);
  const world = absDot(model, [...placed, 1]);
  error = absDot(model, [...error, 0]).map((e, i) => e + gamma(8) * world[i]);
  const projected = absDot(vp, world);
  error = absDot(vp, error).map((e, i) => e + gamma(8) * projected[i] + 1e-12);
  return { matrix, error, width, height, quantum };
}
const CORNERS = [
  [0, 0, 1, 0, 0, 1, 1, 1],
  [0, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 1],
  [0, 0, 1, 0, 0, 0, 1, 0],
  [0, 1, 1, 1, 0, 1, 1, 1],
  [0, 0, 1, 0, 0, 1, 1, 1],
];
export function clipRasterFace(planes, at, cx, cy, face, view) {
  const m = view.matrix,
    e = view.error,
    corners = CORNERS[face];
  let xmin = Infinity,
    xmax = -Infinity,
    ymin = Infinity,
    ymax = -Infinity;
  for (let k = 0; k < 4; k++) {
    const dx = corners[k * 2],
      dy = corners[k * 2 + 1],
      x = cx + dx,
      y = cy + dy;
    const d =
      face === 5 || (face > 0 && k >= 2)
        ? planes[at + 4 + dy * 2 + dx]
        : planes[at] + planes[at + 1] * (dx - 0.5) + planes[at + 2] * (dy - 0.5);
    const cw = m[3] * x + m[7] * y + m[11] * d + m[15];
    if (cw <= 2 * e[3] + 1e-3) return true;
    const px = (m[0] * x + m[4] * y + m[8] * d + m[12]) / cw;
    const py = (m[1] * x + m[5] * y + m[9] * d + m[13]) / cw;
    const ex = (e[0] + Math.abs(px) * e[3]) / (cw - e[3]);
    const ey = (e[1] + Math.abs(py) * e[3]) / (cw - e[3]);
    xmin = Math.min(xmin, ((px - ex + 1) * view.width) / 2);
    xmax = Math.max(xmax, ((px + ex + 1) * view.width) / 2);
    ymin = Math.min(ymin, ((py - ey + 1) * view.height) / 2);
    ymax = Math.max(ymax, ((py + ey + 1) * view.height) / 2);
  }
  return (
    Math.ceil(xmin - view.quantum - 0.5) <= Math.floor(xmax + view.quantum - 0.5) &&
    Math.ceil(ymin - view.quantum - 0.5) <= Math.floor(ymax + view.quantum - 0.5)
  );
}

// Preserve original instance order and all outer cells. The same helper runs
// on the page for a changed camera and ahead of playback on the worker.
export function clipRasterPlanes(planes, w, h, view, native = null) {
  if (native) return native.pack(planes, w, h, view);
  if (!view) return planes;
  const xBits = Math.ceil(Math.log2(w)),
    mask = 2 ** xBits - 1;
  const codes = new Uint32Array(planes.buffer, planes.byteOffset, planes.length);
  const values = new Float32Array(planes.length);
  let count = 0;
  for (let at = 0; at < planes.length; at += 8) {
    const code = codes[at + 3],
      face = (code >>> 24) & 7,
      cx = code & mask,
      cy = (code & 16777215) >>> xBits;
    if (
      cx > 0 &&
      cx < w - 1 &&
      cy > 0 &&
      cy < h - 1 &&
      !clipRasterFace(planes, at, cx, cy, face, view)
    )
      continue;
    for (let i = 0; i < 8; i++) values[count++] = planes[at + i];
  }
  return values.slice(0, count);
}
