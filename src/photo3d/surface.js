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
      const a = depth[j * gx + i],
        b = depth[j * gx + i1],
        c = depth[j1 * gx + i],
        d = depth[j1 * gx + i1];
      if (Math.max(a, b, c, d) - Math.min(a, b, c, d) > 2 * (source.cut ?? 0.03) * 255)
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
      const p = k * 12,
        t = k * 6,
        x0 = x / cols,
        x1 = (x + 1) / cols,
        y0 = y / rows,
        y1 = (y + 1) / rows;
      positions[p] = x0;
      positions[p + 1] = y0;
      positions[p + 2] = k + 1;
      positions[p + 3] = x1;
      positions[p + 4] = y0;
      positions[p + 5] = k + 1;
      positions[p + 6] = x0;
      positions[p + 7] = y1;
      positions[p + 8] = k + 1;
      positions[p + 9] = x1;
      positions[p + 10] = y1;
      positions[p + 11] = k + 1;
      indices[t] = a;
      indices[t + 1] = a + 2;
      indices[t + 2] = a + 1;
      indices[t + 3] = a + 1;
      indices[t + 4] = a + 2;
      indices[t + 5] = a + 3;
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
        // Four scalar slots avoid a temporary array for every surface cell.
        let d0, d1, d2, d3;
        for (let vertex = 0; vertex < 4; vertex++) {
          const vu = (x + (vertex & 1)) / cols,
            vv = (y + (vertex >> 1)) / rows;
          let d = depthAt(vu, vv);
          if (Math.abs(Math.abs(d - cd) - cut) <= 1 / 255) uncertain = true;
          if (Math.abs(d - cd) > cut || cb !== bandAt(vu, vv)) {
            d = cd;
            if (isolated) isolated[k] = 1;
          }
          if (vertex === 0) d0 = d;
          else if (vertex === 1) d1 = d;
          else if (vertex === 2) d2 = d;
          else d3 = d;
        }
        for (let vertex = 0; vertex < 4; vertex++) {
          // Bit 8 requests a native GPU check near the cut threshold, rather
          // than conservatively cutting a continuous slope on the CPU.
          const p = (k * 4 + vertex) * 4;
          meta[p] = vertex === 0 ? d0 : vertex === 1 ? d1 : vertex === 2 ? d2 : d3;
          meta[p + 1] = cb;
          meta[p + 2] = mask + (uncertain ? 256 : 0);
          meta[p + 3] = cd;
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
      const cell = y * cols + x;
      let a, b, c, d;
      for (let v = 0; v < 4; v++) {
        const old = cell * 4 + v;
        const node = (y + (v >> 1)) * (cols + 1) + x + (v & 1);
        let vertex = isolated[cell] ? -1 : shared[node];
        if (vertex < 0) {
          vertex = count++;
          for (let q = 0; q < 3; q++) p[vertex * 3 + q] = positions[old * 3 + q];
          for (let q = 0; q < 4; q++) m[vertex * 4 + q] = meta[old * 4 + q];
          if (!isolated[cell]) {
            shared[node] = vertex;
            // These cells have equal, unclamped corner depths and layers.
            // With no cut mask, the shader does not use a cell center.
            p[vertex * 3 + 2] = 0;
            m[vertex * 4 + 3] = m[vertex * 4];
          }
        }
        if (v === 0) a = vertex;
        else if (v === 1) b = vertex;
        else if (v === 2) c = vertex;
        else d = vertex;
      }
      const q = cell * 6;
      indices[q] = a;
      indices[q + 1] = c;
      indices[q + 2] = b;
      indices[q + 3] = b;
      indices[q + 4] = c;
      indices[q + 5] = d;
    }
  return { cols, rows, positions: p.slice(0, count * 3), indices, meta: m.slice(0, count * 4) };
}
