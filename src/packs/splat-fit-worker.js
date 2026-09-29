// The Gaussian splatting toy's fit, off the main thread (lane Screens):
// src/packs/splat-fit.js run on the pixels it is sent. Posts { id,
// progress } now and then, and { id, out } (or { id, error }) at the end.

import { fitSplats } from "./splat-fit.js";

self.onmessage = (e) => {
  const { id, job } = e.data;
  try {
    const r = fitSplats(job, (progress) => self.postMessage({ id, progress }));
    const out = { w: r.w, h: r.h, n: r.n, keys: r.keys };
    const buffers = [];
    for (const k of r.keys) for (const v of Object.values(k)) if (v?.buffer) buffers.push(v.buffer);
    self.postMessage({ id, out }, buffers);
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};
