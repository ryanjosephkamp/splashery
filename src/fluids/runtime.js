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
//
// Lane Fluids r4: on a WebGPU device the liquids run on the GPU instead
// (src/fluids/gpu/, loaded only then) and are drawn as a surface; the rest
// (smoke, steam, flames) runs on the page. ?fluids=cpu keeps the CPU path.

import { FluidWorld } from "./world.js";
import { FluidLayer } from "./render.js";

function query() {
  return typeof location !== "undefined" ? new URLSearchParams(location.search).get("fluids") : null; // prettier-ignore
}

function pickMode() {
  const q = query();
  if (q === "sync" || q === "worker") return q;
  if (typeof navigator !== "undefined" && navigator.webdriver) return "sync";
  return typeof Worker !== "undefined" ? "worker" : "sync";
}

export class FluidRuntime {
  constructor(
    stage,
    specs,
    { profile = "high", seed = 1, transform = null, mode = pickMode(), onCue = null } = {},
  ) {
    this.stage = stage;
    // r4: the liquid's own sounds, from what it does (sound(), below).
    this.onCue = onCue;
    this.specs = specs;
    const d = stage.device;
    // Smoke, steam and flames on the gas grid (both WebGPU and WebGL2).
    this.gridGas = query() !== "cpu" && !!d.textureHalfFloatRenderable && specs.some((s) => s.kind === "gas" || s.kind === "flame"); // prettier-ignore
    this.opts = { profile, seed, transform, gridGas: this.gridGas };
    this.mode = mode;
    this.lastT = null;
    this.pendingDt = 0;
    this.pendingCmds = null;
    this.busy = false;
    this.frames = 0;
    this.stats = { mode, simMs: 0, particles: 0, slots: 0, steps: 0, uploadMs: 0 };
    this.layer = null;
    this.fx = null;
    if (
      d.isWebGPU &&
      d.supportsCompute &&
      query() !== "cpu" &&
      specs.some((s) => (s.kind || "liquid") === "liquid")
    ) {
      // prettier-ignore
      this.mode = this.stats.mode = "gpu";
      this.startGpu();
      return;
    }
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

  // The gas grid for the CPU paths (on the page, whichever path the rest takes).
  startGasFx() {
    if (!this.gridGas || this.fx) return;
    import("./gpu/index.js")
      .then((m) => {
        if (this.destroyed || this.fx) return;
        this.fx = new m.GpuFluids(this.stage, null, { ...this.opts, specs: this.specs, glass: false }); // prettier-ignore
      })
      .catch((err) => console.warn("Fluids: the gas grid failed.", err));
  }

  startSync() {
    this.world = new FluidWorld(this.specs, this.opts);
    this.startGasFx();
    if (this.world.slots) this.makeLayer(this.world.slots, this.world.materials());
    const n = this.world.slots * 4;
    this.bufs = { center: new Float32Array(n), anim: new Float32Array(n), shape: new Float32Array(n), size: new Float32Array(n) }; // prettier-ignore
  }

  startGpu() {
    this.ready = import("./gpu/index.js")
      .then((m) => {
        if (this.destroyed) return;
        const gpu = { device: this.stage.device, GpuLiquid: m.GpuLiquid };
        this.world = new FluidWorld(this.specs, { ...this.opts, gpu, surface: true });
        this.fx = new m.GpuFluids(this.stage, this.world, { ...this.opts, specs: this.specs, glass: true }); // prettier-ignore
        if (this.world.slots) this.makeLayer(this.world.slots, this.world.materials());
        const n = Math.max(1, this.world.slots) * 4;
        this.bufs = { center: new Float32Array(n), anim: new Float32Array(n), shape: new Float32Array(n), size: new Float32Array(n) }; // prettier-ignore
      })
      .catch((err) => {
        // No usable GPU path: the CPU one, as before.
        console.warn("Fluids: GPU path failed, using the CPU.", err);
        this.fx?.destroy();
        this.fx = null;
        this.mode = this.stats.mode = "sync";
        this.gridGas = this.opts.gridGas = false;
        if (!this.destroyed) this.startSync();
      });
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
    this.startGasFx();
  }

  onWorker(m) {
    if (this.destroyed) return;
    if (m.type === "ready") {
      if (m.slots) this.makeLayer(m.slots, m.materials);
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
    this.sound(dt);
    if (this.fx) {
      this.fx.command(cmds);
      this.fx.step(dt);
      const g = this.fx.gas?.grid;
      this.stats.gasCells = g ? g.dims[0] * g.dims[1] * g.dims[2] : 0;
      this.stage.requestRender();
    }
    if (this.mode === "gpu") {
      const w = this.world;
      if (!w) return;
      w.command(cmds);
      w.step(dt);
      Object.assign(this.stats, w.stats);
      if (this.layer) {
        w.pack(this.bufs.center, this.bufs.anim, this.bufs.shape, this.bufs.size);
        this.show(this.bufs);
      }
      this.stage.requestRender();
      return;
    }
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

  // ---- Sound (r4) ----------------------------------------------------------------------
  // The owner's note (September 30, 2026): the Fluid lab's sound "isn't in
  // sync with fluid pour animation, and needs to be more realistic". So it
  // comes from the simulation (stats.sound, from acoustic.js), not the tap:
  //   - while liquid lands in the pool: short bursts of bubbles (the sound of
  //     water poured into water is its bubbles ringing) and a soft rush tuned
  //     to the air above the liquid, a quarter-wave pipe that rises in pitch
  //     as the glass fills; honey and lava land in slow gloops;
  //   - a sudden landing (the dropped ball): one splash, sized by its flow;
  //   - spray falling back: drips; a soda's rising bubbles: a quiet fizz.
  // At most one cue a frame and 70 ms apart (the app's sound spaces repeats).
  sound(dt) {
    const s = this.stats.sound;
    if (!this.onCue || !s || !(dt > 0)) return;
    const st = (this.snd ||= { t: 0, next: 0, spray: 0, drips: 0, lastLoud: 0, lastSplash: -9, fizz: 0 }); // prettier-ignore
    st.t += dt;
    const spec = this.specs.find((x) => (x.kind || "liquid") === "liquid") || {};
    const e = spec.emitter;
    const thick = ["honey", "lava", "syrup"].includes(s.preset);
    // The stream's own flow; a dropped blob lands much faster.
    const ref = e ? Math.PI * (e.radius ?? 0.05) ** 2 * (e.speed ?? 1) : 0.05;
    // (smoothed: quick to rise, a quarter second to fall, as the samples of
    // a thin stream at the pool's top come and go)
    const raw = s.flux / ref;
    st.env = raw > (st.env || 0) ? raw : (st.env || 0) * Math.exp(-dt / 0.25);
    const loud = Math.min(1.5, st.env);
    const layers = [];
    const res = this.resonance(s.level);
    const burst = e ? 3.5 : 2; // (a pour never splashes like a dropped ball)
    if (raw > burst && st.lastLoud <= burst && st.t - st.lastSplash > 0.6) {
      // A sudden landing (the ball): one splash.
      st.lastSplash = st.t;
      layers.push(thick ? { voice: "gloop", f: 110, decay: 1.4, vol: 0.7 } : { voice: "splash", f: 900 + 400 * Math.random(), decay: 1.1, vol: Math.min(0.9, 0.35 + 0.1 * raw) }); // prettier-ignore
    } else if (loud > 0.05 && st.t >= st.next) {
      const v = Math.min(1, loud);
      if (thick) {
        st.next = st.t + 0.22 + 0.2 * Math.random();
        layers.push({ voice: "gloop", f: 110 + 70 * Math.random(), decay: 0.7, vol: 0.35 * v });
      } else {
        st.next = st.t + 0.07 + 0.05 * Math.random();
        layers.push({ voice: "bubbles", n: 2 + Math.round(3 * v), f: (res ? res * 1.6 : 900) * (0.8 + 0.4 * Math.random()), decay: 0.35, vol: 0.3 * v }); // prettier-ignore
        if (res) layers.push({ voice: "breath", f: res, to: 1.03, decay: 0.25, vol: 0.14 * v });
      }
    }
    st.lastLoud = raw;
    // Drips: spray that has come back down.
    st.drips += Math.max(0, st.spray - (s.spray || 0)) * 0.25;
    st.spray = s.spray || 0;
    if (!layers.length && st.drips >= 1 && st.t >= st.next) {
      st.drips = Math.min(st.drips - 1, 3);
      st.next = st.t + 0.09;
      layers.push({ voice: "drip", n: 1, f: 800 + 700 * Math.random(), decay: 0.8, vol: 0.3 });
    }
    // A soda's fizz while its bubbles rise.
    st.fizz -= dt;
    if (!layers.length && (s.bubbles || 0) > 20 && st.fizz <= 0 && st.t >= st.next) {
      st.fizz = 0.3;
      st.next = st.t + 0.07;
      layers.push({ voice: "sizzle", decay: 0.4, vol: Math.min(0.22, s.bubbles / 3000) });
    }
    if (layers.length) this.onCue([layers.length === 1 ? layers[0] : layers]);
  }

  // The air above the liquid in the glass rings as a pipe closed at the
  // liquid: f = c / 4(L + 0.6 r), in Hz (the recipe's unit to meters).
  resonance(level) {
    const g = this.specs.flatMap((x) => x.colliders || []).find((c) => c.type === "glass");
    if (!g) return null;
    const unit = this.specs.find((x) => x.unit)?.unit ?? 0.33;
    const top = (g.at?.[1] ?? 0) + (g.height ?? 1);
    const L = Math.max(0.005, top - Math.max(level ?? 0, (g.at?.[1] ?? 0) + (g.bottom ?? 0))) * unit; // prettier-ignore
    return Math.min(3000, Math.max(150, 343 / (4 * (L + 0.6 * (g.radius ?? 0.3) * unit))));
  }

  destroy() {
    this.destroyed = true;
    this.worker?.terminate();
    this.worker = null;
    this.fx?.destroy();
    this.fx = null;
    this.layer?.destroy();
    this.layer = null;
  }
}
