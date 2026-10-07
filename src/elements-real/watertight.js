// Real elements (lane Elements): checks that a lifted sample's splats close into a solid, with no
// way to see inside it (the owner's "the outer shell isn't solid", October 6, 2026). A small
// software splatter draws the splats from many directions (each a disc lying in the surface,
// seen as an ellipse, nearest on top) and counts the pixels where the nearest splat faces away
// from the viewer: there the eye is looking through a gap at the inside of the far wall. (Pixels
// the splats enclose but don't cover are counted apart, as holes: they are mostly background seen
// between a sample's separate pieces, such as gold's nuggets.) tests/rel.spec.mjs runs it on the
// toy's own lifted samples.
//
// splats: [{ p: [x, y, z], n?: [x, y, z] (outward), size, flat? }]. Returns the worst view's
// share of inside pixels (ratio), its counts and the view.

// How far a splat of a given size covers (the kit's size is about the visible radius).
const REACH = 0.75;

export { view as insideView };

export function insideShows(splats, { yaws = 24, pitches = [-0.7, -0.3, 0, 0.3, 0.7] } = {}) {
  const sizes = splats.map((s) => s.size).sort((a, b) => a - b);
  const pix = sizes[sizes.length >> 1] * 0.5;
  let worst = { ratio: 0, yaw: 0, pitch: 0, inside: 0, holes: 0, covered: 0 };
  for (let yi = 0; yi < yaws; yi++)
    for (const pitch of pitches) {
      const yaw = (yi / yaws) * 2 * Math.PI;
      const r = view(splats, yaw, pitch, pix);
      if (r.ratio > worst.ratio) worst = { ...r, yaw, pitch };
    }
  return worst;
}

function view(splats, yaw, pitch, pix) {
  // The camera looks along fwd; right and up span the picture.
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const fwd = [-sy * cp, -sp, -cy * cp];
  const right = [cy, 0, -sy];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // (up = right x fwd, so the three are square to each other.)
  const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]]; // prettier-ignore
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  const proj = splats.map((s) => {
    const x = dot(s.p, right);
    const y = dot(s.p, up);
    x0 = Math.min(x0, x - s.size);
    x1 = Math.max(x1, x + s.size);
    y0 = Math.min(y0, y - s.size);
    y1 = Math.max(y1, y + s.size);
    return [x, y, dot(s.p, fwd)];
  });
  const w = Math.ceil((x1 - x0) / pix) + 3;
  const h = Math.ceil((y1 - y0) / pix) + 3;
  const depth = new Float32Array(w * h).fill(Infinity);
  const facing = new Float32Array(w * h);
  splats.forEach((s, k) => {
    const [x, y, z] = proj[k];
    const rad = s.size * REACH;
    let face = 1;
    let ux = 1;
    let uy = 0;
    let rmin = rad;
    if (s.n && (s.flat ?? 1) < 1) {
      const nv = [dot(s.n, right), dot(s.n, up), dot(s.n, fwd)];
      face = -nv[2];
      const l = Math.hypot(nv[0], nv[1]);
      if (l > 1e-6) {
        ux = nv[0] / l;
        uy = nv[1] / l;
      }
      rmin = rad * Math.max(Math.abs(nv[2]), s.flat ?? 0.3);
    }
    const cx = (x - x0) / pix + 1;
    const cyy = (y - y0) / pix + 1;
    const rp = rad / pix;
    for (let py = Math.floor(cyy - rp); py <= cyy + rp; py++)
      for (let px = Math.floor(cx - rp); px <= cx + rp; px++) {
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const dx = (px + 0.5 - cx) * pix;
        const dy = (py + 0.5 - cyy) * pix;
        const a = dx * ux + dy * uy;
        const b = -dx * uy + dy * ux;
        if ((a / rmin) ** 2 + (b / rad) ** 2 > 1) continue;
        const i = py * w + px;
        if (z < depth[i]) {
          depth[i] = z;
          facing[i] = face;
        }
      }
  });
  // Enclosed but uncovered pixels: not reachable from the picture's border through uncovered ones.
  const outside = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (outside[i] || depth[i] !== Infinity) continue;
    outside[i] = 1;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  const within = (i, r) => {
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h || depth[yy * w + xx] === Infinity) return false;
      }
    return true;
  };
  let covered = 0;
  let inside = 0;
  let holes = 0;
  for (let i = 0; i < w * h; i++) {
    if (depth[i] === Infinity) {
      if (!outside[i]) holes++;
      continue;
    }
    covered++;
    // (Only well inside the outline: at the silhouette the grazing splats' far halves show.)
    if (facing[i] < -0.35 && within(i, 3)) inside++;
  }
  return { ratio: inside / (covered || 1), inside, holes, covered, w, h, depth, facing, outside };
}
