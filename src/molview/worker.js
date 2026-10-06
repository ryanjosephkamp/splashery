// Lane Molecule viewer: reads a structure file off the main thread, so a big
// entry (tens of megabytes of mmCIF) never stalls the page. The model's typed
// arrays move back to the page without a copy.

import { readStructure } from "./parse.js";
import { orient } from "./geom.js";

self.onmessage = (e) => {
  const { id, text, fileName } = e.data;
  try {
    const m = orient(readStructure(text, fileName));
    const moved = [m.x, m.y, m.z, m.b, m.het, m.res, m.bonds, m.order].map((a) => a.buffer);
    self.postMessage({ id, model: m }, moved);
  } catch (err) {
    self.postMessage({ id, error: err?.message || String(err) });
  }
};
