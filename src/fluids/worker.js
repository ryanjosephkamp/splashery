// Lane Fluids: the fluid solver in a Web Worker (src/fluids/runtime.js).
// init builds the world; each step advances it and sends the packed frame
// back in the buffers the page returned (or new ones).

import { FluidWorld } from "./world.js";

let world = null;

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") {
    world = new FluidWorld(m.specs, m.opts);
    self.postMessage({ type: "ready", slots: world.slots, materials: world.materials() });
    return;
  }
  if (m.type === "step" && world) {
    world.command(m.cmds);
    world.step(m.dt);
    const n = world.slots * 4;
    const b = m.bufs?.center?.length === n ? m.bufs : { center: new Float32Array(n), anim: new Float32Array(n), shape: new Float32Array(n), size: new Float32Array(n) }; // prettier-ignore
    world.pack(b.center, b.anim, b.shape, b.size);
    self.postMessage({ type: "frame", bufs: b, stats: { ...world.stats } }, [
      b.center.buffer,
      b.anim.buffer,
      b.shape.buffer,
      b.size.buffer,
    ]);
  }
};
