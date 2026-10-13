// Independent quads let a depth edge end without a stretched connecting triangle.
// Construct the buffers in the photo worker; the page only uploads them.
export function surfaceGrid(cols, rows, source = null) {
  const positions = new Float32Array(cols * rows * 12);
  const indices = new Uint32Array(cols * rows * 6);
  const meta = source ? new Float32Array(cols * rows * 16) : null;
  const isolated = source?.compact ? new Uint8Array(cols * rows) : null;
  const depthAt = (u, v, center = false) => {
    const { depth, gx, gy } = source;
    const x = Math.max(0, Math.min(gx - 1, u * gx - 0.5)),
      y = Math.max(0, Math.min(gy - 1, v * gy - 0.5));
    const i = Math.floor(x),
      j = Math.floor(y),
      fx = x - i,
      fy = y - j;
    const i1 = Math.min(gx - 1, i + 1),
      j1 = Math.min(gy - 1, j + 1);
    if (center) {
      const taps = [depth[j * gx + i], depth[j * gx + i1], depth[j1 * gx + i], depth[j1 * gx + i1]];
      if (Math.max(...taps) - Math.min(...taps) > 2 * (source.cut ?? 0.03) * 255)
        return (
          depth[Math.min(gy - 1, Math.floor(v * gy)) * gx + Math.min(gx - 1, Math.floor(u * gx))] /
          255
        );
    }
    return (
      ((depth[j * gx + i] * (1 - fx) + depth[j * gx + i1] * fx) * (1 - fy) +
        (depth[j1 * gx + i] * (1 - fx) + depth[j1 * gx + i1] * fx) * fy) /
      255
    );
  };
  const bandAt = (u, v) =>
    source.band[
      Math.max(0, Math.min(source.gy - 1, Math.floor(v * source.gy))) * source.gx +
        Math.max(0, Math.min(source.gx - 1, Math.floor(u * source.gx)))
    ];
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
      if (meta) {
        const u = (x + 0.5) / cols,
          v = (y + 0.5) / rows,
          cd = depthAt(u, v, true),
          cb = bandAt(u, v),
          cut = source.cut ?? 0.03;
        let mask = 0;
        let uncertain = false;
        for (let axis = 0; axis < 2; axis++)
          for (let side = -1; side <= 1; side += 2) {
            const nu = Math.max(0, Math.min(1, u + (axis === 0 ? side / cols : 0)));
            const nv = Math.max(0, Math.min(1, v + (axis === 1 ? side / rows : 0)));
            const nd = depthAt(nu, nv, true),
              nb = bandAt(nu, nv),
              bit = axis * 2 + (side > 0 ? 1 : 0);
            if (cd - nd > cut || cb > nb) mask |= 1 << bit;
            if (nd - cd > cut || nb > cb) mask |= 1 << (bit + 4);
            if (Math.abs(Math.abs(cd - nd) - cut) <= 1 / 255) uncertain = true;
          }
        const depths = [];
        for (let vertex = 0; vertex < 4; vertex++) {
          const vu = (x + (vertex & 1)) / cols,
            vv = (y + (vertex >> 1)) / rows;
          let d = depthAt(vu, vv);
          if (Math.abs(Math.abs(d - cd) - cut) <= 1 / 255) uncertain = true;
          if (Math.abs(d - cd) > cut || cb !== bandAt(vu, vv)) {
            d = cd;
            if (isolated) isolated[k] = 1;
          }
          depths.push(d);
        }
        for (let vertex = 0; vertex < 4; vertex++) {
          // Bit 8 requests a native GPU check near the cut threshold, rather
          // than conservatively cutting a continuous slope on the CPU.
          meta.set([depths[vertex], cb, mask + (uncertain ? 256 : 0), cd], (k * 4 + vertex) * 4);
        }
        if (isolated && (mask || uncertain)) isolated[k] = 1;
      }
    }
  const grid = { cols, rows, positions, indices, ...(meta ? { meta } : {}) };
  return isolated ? compactSurface(grid, isolated) : grid;
}

function compactSurface(grid, isolated) {
  const { cols, rows, positions, indices, meta } = grid;
  const independent = isolated.reduce((n, v) => n + v, 0);
  const capacity = (cols + 1) * (rows + 1) + independent * 4;
  const p = new Float32Array(capacity * 3),
    m = new Float32Array(capacity * 4);
  const shared = new Int32Array((cols + 1) * (rows + 1)).fill(-1);
  let count = 0;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const cell = y * cols + x,
        corners = [];
      for (let v = 0; v < 4; v++) {
        const old = cell * 4 + v;
        const node = (y + (v >> 1)) * (cols + 1) + x + (v & 1);
        let vertex = isolated[cell] ? -1 : shared[node];
        if (vertex < 0) {
          vertex = count++;
          p.set(positions.subarray(old * 3, old * 3 + 3), vertex * 3);
          m.set(meta.subarray(old * 4, old * 4 + 4), vertex * 4);
          if (!isolated[cell]) {
            shared[node] = vertex;
            // These cells have equal, unclamped corner depths and layers.
            // With no cut mask, the shader does not use a cell center.
            p[vertex * 3 + 2] = 0;
            m[vertex * 4 + 3] = m[vertex * 4];
          }
        }
        corners.push(vertex);
      }
      const [a, b, c, d] = corners;
      indices.set([a, c, b, b, c, d], cell * 6);
    }
  return { cols, rows, positions: p.slice(0, count * 3), indices, meta: m.slice(0, count * 4) };
}
