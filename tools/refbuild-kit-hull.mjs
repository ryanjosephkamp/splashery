// A second, image-only initialization for objects a single solid cannot express.
// Intersect silhouette cones, then express the volume as kit extruded outlines.
import { HINTS, project, rasterMask, cameraBasis } from "./refpack-camera.mjs";
import { maskBounds } from "./refpack-image.mjs";
import { meshFromModel } from "./refpack-geometry.mjs";

export function visualHullModel(obs, size, part, color, resolution = 20) {
  // Axis hints calibrate a box of the supplied/estimated dimensions. Use its
  // projected bounds, rather than foreground centroids (a handle shifts those).
  const box = meshFromModel({ shapes: [{ type: "box", size, pos: [0, 0, 0] }] });
  const usable = obs.filter((o) =>
    ["front", "back", "left", "right", "top"].includes(o.entry.view),
  );
  if (usable.length < 2) return null;
  const cameras = usable.map((o) => {
    const c = {
      yaw: HINTS[o.entry.view],
      pitch: o.entry.view === "top" ? 1.45 : 0.08,
      fov: 38,
      distance: 4,
      target: [0, 0, 0],
    };
    const { width: w, height: h } = o.image,
      b = maskBounds(o.mask, w, h);
    for (let i = 0; i < 4; i++) {
      const rb = maskBounds(rasterMask(box, c, w, h), w, h);
      c.distance *= Math.max(rb.width / b.width, rb.height / b.height);
      const { right, up } = cameraBasis(c),
        f = (2 * c.distance * Math.tan((c.fov * Math.PI) / 360)) / Math.min(w, h);
      const dx = (rb.x0 + rb.x1 - b.x0 - b.x1) / 2,
        dy = (rb.y0 + rb.y1 - b.y0 - b.y1) / 2;
      c.target = c.target.map((v, k) => v + dx * f * right[k] - dy * f * up[k]);
    }
    return c;
  });
  const N = resolution,
    occupied = new Uint8Array(N ** 3),
    step = size.map((s) => s / N);
  for (let z = 0; z < N; z++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const point = [x, y, z].map((n, k) => (n + 0.5) * step[k] - size[k] / 2);
        let keep = true;
        for (let i = 0; i < usable.length && keep; i++) {
          const o = usable[i],
            [px, py] = project(point, cameras[i], o.image.width, o.image.height);
          const xx = Math.floor(px),
            yy = Math.floor(py);
          keep =
            xx >= 0 &&
            yy >= 0 &&
            xx < o.image.width &&
            yy < o.image.height &&
            !!o.mask[yy * o.image.width + xx];
        }
        occupied[(z * N + y) * N + x] = +keep;
      }
  const shapes = [];
  // Each depth slab has its own row-run tracks, preserving front-facing holes.
  for (let z = 0; z < N; z++) {
    const tracks = [];
    for (let y = 0; y < N; y++) {
      let x = 0;
      while (x < N) {
        if (!occupied[(z * N + y) * N + x]) {
          x++;
          continue;
        }
        const lo = x;
        while (x < N && occupied[(z * N + y) * N + x]) x++;
        const hi = x,
          left = lo / N - 0.5,
          right = hi / N - 0.5;
        let track = tracks.find((t) => t.end === y - 1 && t.hi > lo && t.lo < hi);
        if (!track) {
          track = { rows: [], end: -1 };
          tracks.push(track);
        }
        if (!track.rows.length) track.rows.push([left, right, y / N - 0.5]);
        track.rows.push([left, right, (y + 1) / N - 0.5]);
        track.lo = lo;
        track.hi = hi;
        track.end = y;
      }
    }
    for (const t of tracks)
      if (t.rows.length >= 2)
        shapes.push({
          type: "extrusion",
          size: [size[0], size[1], step[2]],
          pos: [0, 0, (z + 0.5) * step[2] - size[2] / 2],
          rot: [0, 0, 0],
          outline: t.rows,
          color,
          part,
        });
  }
  if (!shapes.length || shapes.length > 80) return null;
  return {
    schema: 1,
    shapes,
    initialization:
      "Public-mask visual hull, expressed as extruded kit row strips; no truth geometry or cameras.",
  };
}
