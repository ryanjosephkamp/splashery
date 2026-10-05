// Lane Science r3 (October 5, 2026): cryo-EM density maps as splats.
//
// readDensity(bytes) reads a map tools/sci3-cryoem.mjs wrote (gzipped: a
// JSON header and an 8-bit volume, x fastest; v = lo + (hi − lo)·b/255, in
// the map's own units) and readBackbone(bytes) its fitted model's backbone.
//
// isoPoints(D, level) finds the isosurface at a density level: every voxel
// at or above the level with a neighbor below it is a surface voxel, and its
// splat moves from the voxel's center along the density's gradient to where
// the trilinear density crosses the level (Newton steps), facing along the
// gradient. So each splat is a small, flat piece of the surface a molecular
// viewer draws at that level (ChimeraX, at EMDB's recommended contour by
// default). Positions are in Å, in the map's (and the model's) frame.

// Gunzip with the platform's DecompressionStream (browsers and Node 18+).
export async function gunzip(bytes) {
  const ds = new DecompressionStream("gzip");
  const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}

function headed(raw, format) {
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const len = dv.getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(raw.subarray(4, 4 + len)));
  if (head.format !== format) throw new Error("This isn't a density map this toy can read.");
  return { head, body: raw.subarray(4 + len) };
}

export async function readDensity(bytes) {
  const { head, body } = headed(await gunzip(bytes), "splashery-density-1");
  const [nx, ny, nz] = head.n;
  if (body.length !== nx * ny * nz) throw new Error("The density map is cut short.");
  const vol = body.slice();
  const scale = (head.hi - head.lo) / 255;
  return {
    head,
    n: head.n,
    vol,
    voxel: head.voxel,
    at0: head.at0,
    // A level in the map's units as a byte value, and back.
    toByte: (v) => (v - head.lo) / scale,
    fromByte: (b) => head.lo + b * scale,
    // The trilinear density (bytes) at a point in voxel coordinates.
    sample(x, y, z) {
      const i = Math.max(0, Math.min(nx - 2, Math.floor(x)));
      const j = Math.max(0, Math.min(ny - 2, Math.floor(y)));
      const k = Math.max(0, Math.min(nz - 2, Math.floor(z)));
      const fx = Math.max(0, Math.min(1, x - i));
      const fy = Math.max(0, Math.min(1, y - j));
      const fz = Math.max(0, Math.min(1, z - k));
      const at = (a, b, c) => vol[a + nx * (b + ny * c)];
      const l = (a, b, t) => a + (b - a) * t;
      return l(
        l(l(at(i, j, k), at(i + 1, j, k), fx), l(at(i, j + 1, k), at(i + 1, j + 1, k), fx), fy),
        l(l(at(i, j, k + 1), at(i + 1, j, k + 1), fx), l(at(i, j + 1, k + 1), at(i + 1, j + 1, k + 1), fx), fy), // prettier-ignore
        fz,
      );
    },
  };
}

export async function readBackbone(bytes) {
  const { head, body } = headed(await gunzip(bytes), "splashery-backbone-1");
  const q = new Int16Array(body.buffer.slice(body.byteOffset, body.byteOffset + body.length));
  let o = 0;
  return head.chains.map((c) => {
    const p = [];
    for (let i = 0; i < c.n; i++, o++)
      p.push([0, 1, 2].map((k) => head.origin[k] + q[o * 3 + k] / 10));
    return { chain: c.chain, kind: c.kind, p };
  });
}

// The isosurface's points at `level` (the map's units), as marching cubes
// places its vertices: one on each voxel edge whose ends lie on either side
// of the level, where the density along the edge (linear, as the trilinear
// density is along an edge) equals it. Each faces along the density's
// gradient there (central differences, interpolated along the edge), out
// of the density. Returns typed arrays, three numbers a point: p (Å), n
// (unit), v (voxel coordinates); and count and levelByte.
export function isoPoints(D, level) {
  const [nx, ny, nz] = D.n;
  const sy = nx;
  const sz = nx * ny;
  const L = D.toByte(level);
  const vol = D.vol;
  let cap = 1 << 16;
  let V = new Float32Array(cap * 3);
  let N = new Float32Array(cap * 3);
  let count = 0;
  const g = new Float64Array(6);
  // The central-difference gradient at voxel i (x, y, z) into g[o..o+2].
  const grad = (i, x, y, z, o) => {
    g[o] = vol[x < nx - 1 ? i + 1 : i] - vol[x > 0 ? i - 1 : i];
    g[o + 1] = vol[y < ny - 1 ? i + sy : i] - vol[y > 0 ? i - sy : i];
    g[o + 2] = vol[z < nz - 1 ? i + sz : i] - vol[z > 0 ? i - sz : i];
  };
  for (let z = 0; z < nz; z++)
    for (let y = 0; y < ny; y++)
      for (let x = 0, i = sy * y + sz * z; x < nx; x++, i++) {
        const a = vol[i];
        const ia = a >= L;
        for (let axis = 0; axis < 3; axis++) {
          let j;
          if (axis === 0) {
            if (x + 1 >= nx) continue;
            j = i + 1;
          } else if (axis === 1) {
            if (y + 1 >= ny) continue;
            j = i + sy;
          } else {
            if (z + 1 >= nz) continue;
            j = i + sz;
          }
          const b = vol[j];
          if (ia === b >= L) continue;
          const t = (a - L) / (a - b);
          if (count === cap) {
            cap *= 2;
            const V2 = new Float32Array(cap * 3);
            V2.set(V);
            V = V2;
            const N2 = new Float32Array(cap * 3);
            N2.set(N);
            N = N2;
          }
          const o = count * 3;
          V[o] = x + (axis === 0 ? t : 0);
          V[o + 1] = y + (axis === 1 ? t : 0);
          V[o + 2] = z + (axis === 2 ? t : 0);
          grad(i, x, y, z, 0);
          grad(j, x + (axis === 0), y + (axis === 1), z + (axis === 2), 3);
          let gx = g[0] + (g[3] - g[0]) * t;
          let gy = g[1] + (g[4] - g[1]) * t;
          let gz = g[2] + (g[5] - g[2]) * t;
          let gl = Math.hypot(gx, gy, gz);
          if (gl < 1e-6) {
            // Flat: the edge itself, from the inside out.
            gx = axis === 0 ? (ia ? 1 : -1) : 0;
            gy = axis === 1 ? (ia ? 1 : -1) : 0;
            gz = axis === 2 ? (ia ? 1 : -1) : 0;
            gl = -1; // (so n = −g/gl = g: toward the outside end)
          }
          N[o] = -gx / gl;
          N[o + 1] = -gy / gl;
          N[o + 2] = -gz / gl;
          count++;
        }
      }
  const v = V.subarray(0, count * 3);
  const n = N.subarray(0, count * 3);
  const p = new Float32Array(count * 3);
  for (let k = 0; k < count * 3; k++) p[k] = D.at0[k % 3] + v[k] * D.voxel[k % 3];
  return { p, n, v, count, levelByte: L };
}
