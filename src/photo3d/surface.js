// Independent quads let a depth edge end without a stretched connecting triangle.
// Construct the buffers in the photo worker; the page only uploads them.
export function surfaceGrid(cols, rows) {
  const positions = new Float32Array(cols * rows * 12);
  const indices = new Uint32Array(cols * rows * 6);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const k = y * cols + x,
        a = k * 4;
      positions.set(
        [
          x / cols,
          y / rows,
          k + 1,
          (x + 1) / cols,
          y / rows,
          k + 1,
          x / cols,
          (y + 1) / rows,
          k + 1,
          (x + 1) / cols,
          (y + 1) / rows,
          k + 1,
        ],
        k * 12,
      );
      indices.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], k * 6);
    }
  return { cols, rows, positions, indices };
}
