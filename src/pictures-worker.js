// The pictures worker (lane Pictures): builds picture sheets off the main
// thread with buildSheet (src/picture-splats.js) and sends the packed
// arrays back without copying them.

import { buildSheet } from "./picture-splats.js";

self.onmessage = (e) => {
  const { id, job } = e.data;
  try {
    const t0 = performance.now();
    const out = buildSheet(job);
    out.ms = performance.now() - t0;
    const transfer = [out.center, out.centers, out.color, out.scale, out.rotation, out.anim].map(
      (a) => a.buffer,
    );
    self.postMessage({ id, out }, transfer);
  } catch (err) {
    self.postMessage({ id, error: err?.message || String(err) });
  }
};
