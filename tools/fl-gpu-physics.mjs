#!/usr/bin/env node
// Lane Fluids r4: the GPU liquid (src/fluids/gpu/, MLS-MPM on WebGPU) measured
// against the same physics as the CPU one in tools/fl-physics.mjs: the dam
// break against Martin and Moyce 1952, in the same channel and units. Runs in
// Chromium (WebGPU); needs the local server:
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/fl-gpu-physics.mjs [--profile=mid] [--out=file.json]
//
// In this sandbox WebGPU runs on SwiftShader (a CPU), so it is slow but
// computes the same numbers as a real GPU.

import { chromium } from "@playwright/test";
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const PROFILE = opt("profile", "mid");
const UNIT = 0.33;

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--disable-gpu-driver-bug-workarounds",
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan,WebGPU",
    "--use-webgpu-adapter=swiftshader",
    "--use-vulkan=swiftshader",
  ],
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page:", e.message));
await page.goto(`http://127.0.0.1:4173/?renderer=webgpu&adapt=off&labs=1&profile=${PROFILE}`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
if ((await page.evaluate(() => window.__splashery.player.stage.deviceType)) !== "webgpu") {
  console.error("No WebGPU in this browser.");
  process.exit(1);
}

const dam = await page.evaluate(
  async ({ PROFILE, UNIT }) => {
    const { FluidWorld } = await import("/src/fluids/world.js");
    const { GpuLiquid } = await import("/src/fluids/gpu/liquid.js");
    const device = window.__splashery.player.stage.device;
    const G = 9.8 / UNIT;
    const a = 0.3; // as tools/fl-physics.mjs
    const walls = [
      { type: "floor", y: 0 },
      { type: "box", at: [-0.1, 0.5, 0], size: [0.2, 2, 1] },
      { type: "box", at: [2, 0.5, -0.35], size: [4.4, 2, 0.1] },
      { type: "box", at: [2, 0.5, 0.35], size: [4.4, 2, 0.1] },
    ];
    const world = new FluidWorld(
      [{ name: "l", kind: "liquid", preset: "water", unit: UNIT, gpuCap: 200000, colliders: walls, fill: { box: [[0, 0, -0.3], [a, 2 * a, 0.3]] } }], // prettier-ignore
      { profile: PROFILE, seed: 5, gpu: { device, GpuLiquid }, surface: true },
    );
    const sys = world.systems[0];
    const rows = [];
    let t = 0;
    const t0 = performance.now();
    while (t < 1.2) {
      sys.step(1 / 60);
      t += sys.stats.substeps * sys.stats.dt;
      const d = await sys.sim.readPositions();
      const xs = [];
      for (let i = 0; i < sys.n; i++) {
        const y = sys.origin[1] + d[i * 6 + 1] * sys.h;
        if (y < 0.1) xs.push(sys.origin[0] + d[i * 6] * sys.h);
      }
      xs.sort((p, q) => p - q);
      const front = (xs[Math.floor(xs.length * 0.99)] ?? 0) + sys.rad;
      rows.push([+(t * Math.sqrt((2 * G) / a)).toFixed(3), +(front / a).toFixed(3)]);
    }
    const out = { n: sys.n, h: sys.h, dims: sys.dims, ms: performance.now() - t0, rows };
    sys.destroy();
    return out;
  },
  { PROFILE, UNIT },
);
await browser.close();

// Martin and Moyce 1952, Table 2 (as tools/fl-physics.mjs).
const mm = [[1.19, 1.44], [1.58, 1.89], [1.91, 2.33], [2.23, 2.78], [2.58, 3.22], [2.91, 3.67], [3.26, 4.11], [3.6, 4.56], [3.92, 5.0], [4.26, 5.44], [4.61, 5.89], [4.95, 6.33], [5.32, 6.76]]; // prettier-ignore
const rows = dam.rows;
const at = (T) => {
  const j = rows.findIndex(([t]) => t >= T);
  if (j < 1) return NaN;
  const [t0, z0] = rows[j - 1];
  const [t1, z1] = rows[j];
  return z0 + ((z1 - z0) * (T - t0)) / (t1 - t0);
};
const vs = mm.map(([T, Z]) => [T, Z, +at(T).toFixed(2)]).filter(([, , z]) => Number.isFinite(z));
const result = {
  damBreak: {
    profile: PROFILE,
    particles: dam.n,
    cell: dam.h,
    grid: dam.dims,
    vsMartinMoyce: vs,
    rms: +Math.sqrt(vs.reduce((s, [, Z, z]) => s + (Z - z) ** 2, 0) / vs.length).toFixed(2),
    rows,
    source:
      "Martin and Moyce 1952, Phil. Trans. R. Soc. A 244, 312 (Table 2, the front Z = x/a at time T = t√(2g/a)); the same channel as tools/fl-physics.mjs.",
  },
};
console.log(`dam break (GPU, ${PROFILE}): ${dam.n} particles, rms ${result.damBreak.rms}, ${(dam.ms / 1000).toFixed(0)} s`); // prettier-ignore
for (const [T, Z, z] of vs) console.log(`  T ${T}: measured ${Z}, ours ${z}`);
const out = opt("out", null);
if (out) fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
