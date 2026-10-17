// Shared, data-only kit recipe vocabulary. Code MIT; original geometry CC0.
import { quatEuler, quatRotate, vec } from "../kit.js";

const TAU = Math.PI * 2;
export function shapeMesh(s, detail = 24) {
  const positions = [],
    indices = [];
  const put = (p) => {
    positions.push(...p);
    return positions.length / 3 - 1;
  };
  const tri = (a, b, c) => indices.push(a, b, c);
  const patch = (fn, nu = detail, nv = detail) => {
    const start = positions.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) put(fn(i / nu, j / nv));
    for (let j = 0; j < nv; j++)
      for (let i = 0; i < nu; i++) {
        const a = start + j * (nu + 1) + i,
          b = a + 1,
          c = a + nu + 1,
          d = c + 1;
        tri(a, b, d);
        tri(a, d, c);
      }
  };
  const [sx, sy, sz] = s.size;
  if (s.type === "box") {
    for (let axis = 0; axis < 3; axis++)
      for (const sign of [-1, 1]) {
        const b = (axis + 1) % 3,
          c = (axis + 2) % 3;
        patch(
          (u, v) => {
            const p = [0, 0, 0];
            p[axis] = (s.size[axis] * sign) / 2;
            p[b] = (u - 0.5) * s.size[b];
            p[c] = (v - 0.5) * s.size[c] * sign;
            return p;
          },
          1,
          1,
        );
      }
  } else if (["sphere", "rounded-box"].includes(s.type)) {
    const power = s.type === "sphere" ? 2 : s.power || 5;
    const sp = (x) => Math.sign(x) * Math.abs(x) ** (2 / power);
    patch((u, v) => {
      const a = u * TAU,
        b = (v - 0.5) * Math.PI;
      return [
        (sx / 2) * sp(Math.cos(b)) * sp(Math.cos(a)),
        (sy / 2) * sp(Math.sin(b)),
        (sz / 2) * sp(Math.cos(b)) * sp(Math.sin(a)),
      ];
    });
  } else if (["cylinder", "cone", "lathe"].includes(s.type)) {
    const profile = s.profile || [
      [s.type === "cone" ? (s.bottom ?? 0.5) : 0.5, -0.5],
      [s.type === "cone" ? (s.top ?? 0) : 0.5, 0.5],
    ];
    for (let j = 0; j < profile.length - 1; j++) {
      patch(
        (u, v) => {
          const r = profile[j][0] * (1 - v) + profile[j + 1][0] * v;
          const y = profile[j][1] * (1 - v) + profile[j + 1][1] * v;
          return [r * sx * Math.cos(u * TAU), y * sy, r * sz * Math.sin(u * TAU)];
        },
        detail,
        1,
      );
    }
    for (const p of [profile[0], profile.at(-1)]) {
      const center = put([0, p[1] * sy, 0]);
      for (let i = 0; i < detail; i++) {
        const a = put([
          p[0] * sx * Math.cos((i / detail) * TAU),
          p[1] * sy,
          p[0] * sz * Math.sin((i / detail) * TAU),
        ]);
        const b = put([
          p[0] * sx * Math.cos(((i + 1) / detail) * TAU),
          p[1] * sy,
          p[0] * sz * Math.sin(((i + 1) / detail) * TAU),
        ]);
        tri(center, a, b);
      }
    }
  } else if (s.type === "extrusion") {
    // Outlines produced by the builder are y-monotone row strips. Each row
    // has [left, right, y]; strips close holes only when explicitly requested.
    const rows = s.outline;
    for (let j = 0; j < rows.length - 1; j++) {
      const a = rows[j],
        b = rows[j + 1];
      for (const sign of [-1, 1]) {
        const ids = [
          [a[0], a[2]],
          [a[1], a[2]],
          [b[1], b[2]],
          [b[0], b[2]],
        ].map(([x, y]) => put([x * sx, y * sy, (sign * sz) / 2]));
        tri(ids[0], ids[1], ids[2]);
        tri(ids[0], ids[2], ids[3]);
      }
      for (const k of [0, 1]) {
        const ids = [
          [a[k] * sx, a[2] * sy, -sz / 2],
          [a[k] * sx, a[2] * sy, sz / 2],
          [b[k] * sx, b[2] * sy, sz / 2],
          [b[k] * sx, b[2] * sy, -sz / 2],
        ].map(put);
        tri(ids[0], ids[1], ids[2]);
        tri(ids[0], ids[2], ids[3]);
      }
    }
    for (const r of [rows[0], rows.at(-1)]) {
      const ids = [
        [r[0] * sx, r[2] * sy, -sz / 2],
        [r[1] * sx, r[2] * sy, -sz / 2],
        [r[1] * sx, r[2] * sy, sz / 2],
        [r[0] * sx, r[2] * sy, sz / 2],
      ].map(put);
      tri(ids[0], ids[1], ids[2]);
      tri(ids[0], ids[2], ids[3]);
    }
  } else throw new Error(`Unknown kit shape: ${s.type}`);
  const q = quatEuler(...(s.rot || [0, 0, 0]));
  for (let i = 0; i < positions.length; i += 3) {
    const p = quatRotate(q, positions.slice(i, i + 3));
    for (let k = 0; k < 3; k++) positions[i + k] = p[k] + (s.pos?.[k] || 0);
  }
  return { positions, indices };
}

// Triangle sampler for the kit's extruded outline shape. The cap and side
// triangles are area-weighted, including nonconvex row-strip outlines.
function extrudedShape(s) {
  const mesh = shapeMesh({ ...s, pos: [0, 0, 0], rot: [0, 0, 0] });
  const triangles = [],
    areas = [];
  let area = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = mesh.indices
      .slice(i, i + 3)
      .map((j) => mesh.positions.slice(j * 3, j * 3 + 3));
    const cross = vec.cross(vec.sub(b, a), vec.sub(c, a)),
      size = vec.len(cross) / 2;
    if (size < 1e-10) continue;
    area += size;
    areas.push(area);
    triangles.push({ a, b, c, n: vec.unit(cross) });
  }
  return {
    area,
    thick: Math.min(...s.size) * 0.05,
    sample(rand) {
      const at = rand() * area;
      let lo = 0,
        hi = areas.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (areas[mid] < at) lo = mid + 1;
        else hi = mid;
      }
      const { a, b, c, n } = triangles[lo],
        u = Math.sqrt(rand()),
        v = rand();
      return { p: a.map((x, k) => x * (1 - u) + b[k] * u * (1 - v) + c[k] * u * v), n };
    },
  };
}
export function buildShapes(k, model) {
  const parts = new Map();
  for (const m of model.moves || []) {
    const axis = [0, 0, 0];
    axis["xyz".indexOf(m.axis)] = 1;
    parts.set(m.part, k.part(m.part, { pivot: m.pivot || [0, 0, 0], axis }));
  }
  for (const s of model.shapes) {
    const [x, y, z] = s.size;
    let shape, scale;
    if (s.type === "box") shape = k.box(x, y, z);
    else if (s.type === "rounded-box") shape = k.roundedBox(x, y, z, s.power || 5);
    else if (s.type === "sphere") shape = k.ellipsoid(x / 2, y / 2, z / 2);
    else if (s.type === "cylinder") {
      shape = k.cylinder(0.5, y);
      scale = [x, 1, z];
    } else if (s.type === "cone") {
      shape = k.cone(s.bottom ?? 0.5, s.top ?? 0, y);
      scale = [x, 1, z];
    } else if (s.type === "lathe") {
      shape = k.lathe(s.profile.map(([r, yy]) => [r, yy * y]));
      scale = [x, 1, z];
    } else if (s.type === "extrusion") shape = extrudedShape(s);
    else throw new Error(`Unknown kit shape: ${s.type}`);
    k.add(shape, {
      pos: s.pos,
      rot: s.rot,
      scale,
      color: s.color || [0.6, 0.6, 0.6],
      part: parts.get(s.part) || 0,
      even: true,
      interior: 0,
      jitter: 0.005,
      opacity: 0.98,
      flat: 0.2,
      size: 1.15,
    });
  }
  k.data ||= {};
  k.data.refbuild = model;
}
export function driveMoves(c, out, model) {
  const pulse = c.play || 0;
  // A full sine envelope starts and ends at rest for every effect, including spin.
  const phase = 1 - pulse,
    envelope = Math.sin(Math.PI * phase) * +(pulse > 0);
  for (const m of model.moves || []) {
    const axis = [0, 0, 0];
    axis["xyz".indexOf(m.axis)] = 1;
    if (["slide", "bounce"].includes(m.how))
      out.parts[m.part] = { offset: axis.map((v) => v * m.amount * envelope) };
    else
      out.parts[m.part] = {
        angle:
          ((m.amount * Math.PI) / 180) *
          (m.how === "spin"
            ? phase * +(pulse > 0)
            : m.how === "wobble"
              ? Math.sin(phase * Math.PI * 4) * envelope
              : envelope),
      };
  }
}
export function modelRecipe(model) {
  if (!model.moves?.length)
    return {
      alive: false,
      build(k) {
        buildShapes(k, model);
      },
    };
  return {
    alive: false,
    controls: [{ key: "play", label: "Move", type: "pulse", ease: 2.4 }],
    action: { key: "play", label: "Move the parts" },
    build(k) {
      buildShapes(k, model);
    },
    drive(t, c, out, info) {
      driveMoves(c, out, info.data.refbuild);
    },
  };
}
