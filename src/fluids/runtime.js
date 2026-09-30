// Lane Fluids: runs a toy's fluids (docs/FLUIDS.md). The player loads this
// module only when a toy that declared k.fluid(...) opens, so nothing of it
// loads on the shelf or in embeds before then.
//
// Two ways to step:
//   worker  (people's devices) the solver runs in a Web Worker, a frame
//           ahead of the drawing, so it doesn't compete with the page.
//   sync    (the tools and tests, which step the clock by hand, and any
//           browser without module workers) on the page, every frame.
// ?fluids=worker or ?fluids=sync picks one; automated browsers get sync.

import { FluidWorld } from "./world.js";
import { FluidLayer } from "./render.js";

function pickMode() {
  const q = typeof location !== "undefined" ? new URLSearchParams(location.search).get("fluids") : null; // prettier-ignore
  if (q === "sync" || q === "worker") return q;
  if (typeof navigator !== "undefined" && navigator.webdriver) return "sync";
  return typeof Worker !== "undefined" ? "worker" : "sync";
}

export class FluidRuntime {
  constructor(
    stage,
    specs,
    { profile = "high", seed = 1, transform = null, mode = pickMode() } = {},
  ) {
    this.stage = stage;
    this.specs = specs;
    this.opts = { profile, seed, transform };
    this.mode = mode;
    this.lastT = null;
    this.pendingDt = 0;
    this.pendingCmds = null;
    this.busy = false;
    this.frames = 0;
    this.stats = { mode, simMs: 0, particles: 0, slots: 0, steps: 0, uploadMs: 0 };
    this.layer = null;
    if (mode === "worker") {
      try {
        this.startWorker();
        return;
      } catch {
        this.mode = this.stats.mode = "sync";
      }
    }
    this.startSync();
  }

  startSync() {
    this.world = new FluidWorld(this.specs, this.opts);
    this.makeLayer(this.world.slots, this.world.materials());
    const n = this.world.slots * 4;
    this.bufs = { center: new Float32Array(n), anim: new Float32Array(n), shape: new Float32Array(n), size: new Float32Array(n) }; // prettier-ignore
  }

  startWorker() {
    const w = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    this.worker = w;
    this.spare = [];
    w.onmessage = (e) => this.onWorker(e.data);
    w.onerror = () => {
      // A worker that can't start (an old browser): run on the page.
      w.terminate();
      this.worker = null;
      this.mode = this.stats.mode = "sync";
      if (!this.destroyed) this.startSync();
    };
    w.postMessage({ type: "init", specs: this.specs, opts: this.opts });
  }

  onWorker(m) {
    if (this.destroyed) return;
    if (m.type === "ready") {
      this.makeLayer(m.slots, m.materials);
      this.stats.slots = m.slots;
      return;
    }
    if (m.type === "frame") {
      this.busy = false;
      Object.assign(this.stats, m.stats);
      this.show(m.bufs);
      this.spare.push(m.bufs);
    }
  }

  makeLayer(slots, materials) {
    this.layer = new FluidLayer(this.stage, slots);
    this.layer.setMaterials(materials);
    this.stats.slots = slots;
  }

  show(b) {
    if (!this.layer) return;
    const t0 = performance.now();
    // WebGL2 sorts splats on the CPU from their stored places: give it the
    // fluid's new ones every other frame (WebGPU sorts on the GPU).
    const sort = this.stage.deviceType !== "webgpu" && this.frames % 2 === 0;
    this.layer.upload(b, sort);
    this.frames++;
    this.stats.uploadMs = performance.now() - t0;
  }

  // Each frame: `t` the toy's clock (seconds), `cmds` the recipe's
  // out.fluid.
  frame(t, cmds) {
    if (this.destroyed) return;
    const dt = this.lastT === null ? 0 : Math.max(0, Math.min(0.25, t - this.lastT));
    this.lastT = t;
    if (this.mode === "sync") {
      const w = this.world;
      w.command(cmds);
      w.step(dt);
      Object.assign(this.stats, w.stats);
      w.pack(this.bufs.center, this.bufs.anim, this.bufs.shape, this.bufs.size);
      this.show(this.bufs);
      return;
    }
    // Worker: one step in flight at a time; time and commands wait for it.
    this.pendingDt += dt;
    if (cmds) this.pendingCmds = cmds;
    if (this.busy || !this.worker) return;
    const bufs = this.spare?.pop() || null;
    const msg = { type: "step", dt: this.pendingDt, cmds: this.pendingCmds, bufs };
    this.pendingDt = 0;
    this.pendingCmds = null;
    this.busy = true;
    this.worker.postMessage(msg, bufs ? [bufs.center.buffer, bufs.anim.buffer, bufs.shape.buffer, bufs.size.buffer] : []); // prettier-ignore
  }

  destroy() {
    this.destroyed = true;
    this.worker?.terminate();
    this.worker = null;
    this.layer?.destroy();
    this.layer = null;
  }
}
