// Lane Books: the kit shader's leaf turn and part move, on the CPU, for
// sorting splats where they stand now (Player.resortPose). Splats sort in the
// pose they were built in, so a book's page or cover turned over draws in
// the wrong order until it is sorted again.

import { KINDS } from "./effects.js";

// Lane Books: where the kit shader puts each splat on a part or a leaf now
// (toy coordinates), written into `out` (a container's sort centers); other
// splats and tokens are left as they are. Returns how many it moved.
//
// Lane Live r7: `relief` ({ data, width, height }: the toy's screen canvas's
// pixels), when given, also places each relief splat with a 3D offset (axis
// 3) where its screen texel moves it, on a part or not, so splats a recipe
// moves through its canvas (the Chladni plate's live sand) sort where they
// show instead of where they rest.
export function posePass(pos, anim, count, out, leaf, parts, relief = null) {
  const L = KINDS.leaf;
  const TOK = KINDS.token;
  const RLF = KINDS.relief;
  const [spx, spy, spz] = [leaf[0], leaf[1], leaf[2]];
  const [ax, ay, az] = [leaf[4], leaf[5], leaf[6]];
  const [dx, dy, dz] = [leaf[8], leaf[9], leaf[10]];
  const nx = ay * dz - az * dy;
  const ny = az * dx - ax * dz;
  const nz = ax * dy - ay * dx;
  let moved = 0;
  for (let i = 0; i < count; i++) {
    const i4 = i * 4;
    const kind = Math.round(anim[i4 + 1]);
    const part = Math.round(anim[i4]) & 15;
    const moves = relief && kind === RLF && anim[i4 + 2] >= 6;
    if (kind === TOK || (kind !== L && part === 0 && !moves)) continue;
    let x = pos[i * 3];
    let y = pos[i * 3 + 1];
    let z = pos[i * 3 + 2];
    if (moves) {
      // As the kit shader reads it: z = u + 2 axis, w = v + 2 lift (lift in
      // thousandths of a toy unit); red, green and blue a signed offset.
      const u = anim[i4 + 2] - 6;
      const lq = Math.floor(anim[i4 + 3] * 0.5);
      const v = anim[i4 + 3] - 2 * lq;
      const tx = Math.min(relief.width - 1, Math.floor((0.5 + 0.5 * u) * relief.width));
      const ty = Math.min(relief.height - 1, Math.floor(v * relief.height));
      const o = (ty * relief.width + tx) * 4;
      const k = (2 * lq * 0.001) / 255;
      x += (relief.data[o] - 127.5) * k;
      y += (relief.data[o + 1] - 127.5) * k;
      z += (relief.data[o + 2] - 127.5) * k;
    }
    if (kind === L) {
      const slot = Math.max(0, Math.min(9, Math.round(anim[i4 + 3])));
      const ang = leaf[12 + slot * 2];
      const curl = leaf[13 + slot * 2];
      const s = anim[i4 + 2];
      const rx = x - spx;
      const ry = y - spy;
      const rz = z - spz;
      const along = rx * ax + ry * ay + rz * az;
      const up = rx * nx + ry * ny + rz * nz;
      const psi = ang + curl * s;
      const small = Math.abs(curl) < 1e-4;
      const lx = small ? s * Math.cos(ang) : (Math.sin(psi) - Math.sin(ang)) / curl;
      const ly = small ? s * Math.sin(ang) : (Math.cos(ang) - Math.cos(psi)) / curl;
      const c = Math.cos(psi);
      const sn = Math.sin(psi);
      x = spx + ax * along + dx * lx + nx * ly + (nx * c - dx * sn) * up;
      y = spy + ay * along + dy * lx + ny * ly + (ny * c - dy * sn) * up;
      z = spz + az * along + dz * lx + nz * ly + (nz * c - dz * sn) * up;
    }
    if (part > 0) {
      const o = part * 12;
      const [qx, qy, qz, qw] = [parts[o], parts[o + 1], parts[o + 2], parts[o + 3]];
      const g = 1 + parts[o + 7];
      const px = (x - parts[o + 4]) * g;
      const py = (y - parts[o + 5]) * g;
      const pz = (z - parts[o + 6]) * g;
      // v + 2 u x (u x v + w v), with u = (qx, qy, qz).
      const cx = qy * pz - qz * py + qw * px;
      const cy = qz * px - qx * pz + qw * py;
      const cz = qx * py - qy * px + qw * pz;
      x = parts[o + 4] + px + 2 * (qy * cz - qz * cy) + parts[o + 8];
      y = parts[o + 5] + py + 2 * (qz * cx - qx * cz) + parts[o + 9];
      z = parts[o + 6] + pz + 2 * (qx * cy - qy * cx) + parts[o + 10];
    }
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
    moved++;
  }
  return moved;
}
