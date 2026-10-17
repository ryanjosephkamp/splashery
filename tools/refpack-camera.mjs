// Silhouette camera search. The proxy is perspective triangle rasterization;
// final scores always come from Chromium's real GSplat renderer.
import { silhouetteIoU } from "./refpack-metrics.mjs";
import { maskBounds } from "./refpack-image.mjs";
export const HINTS = {
  front: 0,
  right: Math.PI / 2,
  back: Math.PI,
  left: -Math.PI / 2,
  "three-quarter": Math.PI / 4,
  top: 0,
  detail: 0,
  unknown: 0,
};
export function cameraBasis(c) {
  const cy = Math.cos(c.yaw),
    sy = Math.sin(c.yaw),
    cp = Math.cos(c.pitch),
    sp = Math.sin(c.pitch);
  return { right: [cy, 0, -sy], up: [-sy * sp, cp, -cy * sp], back: [sy * cp, sp, cy * cp] };
}
export function project(p, c, width, height) {
  const { right, up, back } = cameraBasis(c),
    target = c.target || [0, 0, 0];
  const v = p.map((x, k) => x - target[k]),
    dot = (a) => a.reduce((s, x, k) => s + x * v[k], 0);
  const z = c.distance - dot(back),
    f = Math.min(width, height) / (2 * Math.tan(((c.fov || 38) * Math.PI) / 360));
  return [width / 2 + (f * dot(right)) / z, height / 2 - (f * dot(up)) / z, z];
}
export function rasterMask(mesh, camera, w, h) {
  const mask = new Uint8Array(w * h),
    points = [];
  const { right, up, back } = cameraBasis(camera),
    target = camera.target || [0, 0, 0];
  const f = Math.min(w, h) / (2 * Math.tan(((camera.fov || 38) * Math.PI) / 360));
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i] - target[0],
      y = mesh.positions[i + 1] - target[1],
      z = mesh.positions[i + 2] - target[2];
    const depth = camera.distance - (back[0] * x + back[1] * y + back[2] * z);
    points.push([
      w / 2 + (f * (right[0] * x + right[1] * y + right[2] * z)) / depth,
      h / 2 - (f * (up[0] * x + up[1] * y + up[2] * z)) / depth,
      depth,
    ]);
  }
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = points[mesh.indices[i]],
      b = points[mesh.indices[i + 1]],
      c = points[mesh.indices[i + 2]];
    if (Math.min(a[2], b[2], c[2]) <= 0.02) continue;
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))),
      x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))),
      y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const cross = (p, q, x, y) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const ab = cross(a, b, x + 0.5, y + 0.5),
          bc = cross(b, c, x + 0.5, y + 0.5),
          ca = cross(c, a, x + 0.5, y + 0.5);
        if ((ab >= 0 && bc >= 0 && ca >= 0) || (ab <= 0 && bc <= 0 && ca <= 0)) mask[y * w + x] = 1;
      }
  }
  if (!mesh.indices.length)
    for (const [x, y, z] of points)
      if (z > 0.02) {
        for (let yy = Math.floor(y) - 1; yy <= Math.floor(y) + 1; yy++)
          for (let xx = Math.floor(x) - 1; xx <= Math.floor(x) + 1; xx++)
            if (xx >= 0 && yy >= 0 && xx < w && yy < h) mask[yy * w + xx] = 1;
      }
  return mask;
}
export function fitCamera(mesh, obs, previous, { rounds = 3, deadline = Infinity } = {}) {
  const { width: w, height: h } = obs.image;
  const b = maskBounds(obs.mask, w, h);
  let best = previous
    ? structuredClone(previous)
    : {
        yaw: HINTS[obs.entry.view],
        pitch: obs.entry.view === "top" ? 1.45 : 0.12,
        fov: 38,
        distance: 4.2,
        target: [0, 0, 0],
      };
  const evaluate = (c) => silhouetteIoU(obs.mask, rasterMask(mesh, c, w, h));
  if (!previous) {
    // Match the observed scale and center before searching angles.
    for (let i = 0; i < 3; i++) {
      const rendered = rasterMask(mesh, best, w, h);
      let rb;
      try {
        rb = maskBounds(rendered, w, h);
      } catch {
        break;
      }
      best.distance *= Math.max(rb.width / b.width, rb.height / b.height);
      const { right, up } = cameraBasis(best),
        pixel = (2 * best.distance * Math.tan((best.fov * Math.PI) / 360)) / Math.min(w, h);
      best.target = best.target.map(
        (v, k) => v + (rb.cx - b.cx) * pixel * right[k] - (rb.cy - b.cy) * pixel * up[k],
      );
    }
  }
  let score = evaluate(best),
    evaluations = 1;
  if (!previous && ["unknown", "detail", "three-quarter"].includes(obs.entry.view)) {
    const yaws =
      obs.entry.view === "three-quarter"
        ? [Math.PI / 4, -Math.PI / 4, (Math.PI * 3) / 4, (-Math.PI * 3) / 4]
        : Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6);
    for (const yaw of yaws) {
      if (performance.now() >= deadline) break;
      const c = { ...best, yaw },
        s = evaluate(c);
      evaluations++;
      if (s > score) {
        best = c;
        score = s;
      }
    }
  }
  for (let round = 0; round < rounds && performance.now() < deadline; round++) {
    const factor = 2 ** -round;
    for (const [key, step] of [
      ["yaw", 0.22],
      ["pitch", 0.16],
      ["fov", 5],
      ["distance", best.distance * 0.12],
      ["tx", 0.09],
      ["ty", 0.09],
    ]) {
      for (const sign of [-1, 1]) {
        if (performance.now() >= deadline) break;
        const c = structuredClone(best);
        if (key === "tx" || key === "ty") c.target[key === "tx" ? 0 : 1] += sign * step * factor;
        else c[key] += sign * step * factor;
        c.pitch = Math.max(-1.5, Math.min(1.5, c.pitch));
        c.fov = Math.max(15, Math.min(85, c.fov));
        c.distance = Math.max(1.15, c.distance);
        const s = evaluate(c);
        evaluations++;
        if (s > score) {
          best = c;
          score = s;
        }
      }
    }
  }
  return { ...best, proxyIoU: score, evaluations };
}
