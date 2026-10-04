// Synthetic solver workload, separate from the real-time rendering matrix.
import fs from "node:fs";
import { chromium } from "../../../node_modules/playwright-core/index.mjs";
const browser = await chromium.launch({
  executablePath:
    process.env.SPLASHERY_CHROMIUM ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage();
await page.goto("http://127.0.0.1:4173/?renderer=none");
const cdp = await page.context().newCDPSession(page);
const file = new URL("solver.json", import.meta.url);
const rows = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
const scenes = [
  ...["glass", "splash"].flatMap((scene) =>
    ["water", "soda", "honey", "lava"].map((liquid) => ({ scene, liquid })),
  ),
  ...["candle", "cup"].map((scene) => ({ scene, liquid: "water" })),
];
const settings = [
  { setting: "mid4", profile: "mid", rate: 4, scale: 1 },
  { setting: "mid6", profile: "mid", rate: 6, scale: 1 },
  { setting: "low6", profile: "low", rate: 6, scale: 1 },
  { setting: "desktop", profile: "high", rate: 1, scale: 1 },
  { setting: "high6phone", profile: "high", rate: 6, scale: 1 },
  { setting: "half", profile: "mid", rate: 6, scale: 0.5 },
  { setting: "quarter", profile: "mid", rate: 6, scale: 0.25 },
  { setting: "eighth", profile: "mid", rate: 6, scale: 0.125 },
];
for (const scene of scenes)
  for (const setting of settings) {
    const key = `${scene.scene}/${scene.liquid}/${setting.setting}`;
    if (rows.some((r) => r.key === key)) continue;
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: setting.rate });
    const result = await page.evaluate(
      async (c) => {
        const { RECIPES } = await import("/src/packs/fluid-lab.js");
        const { Kit } = await import("/src/kit.js");
        const { FluidWorld } = await import("/src/fluids/world.js");
        const { hash32 } = await import("/src/noise.js");
        const seed = hash32("fluid-lab");
        const recipe = RECIPES["fluid-lab"],
          kit = new Kit(seed, { count: 20000 });
        recipe.build(kit, { scene: c.scene, liquid: c.liquid });
        for (const s of kit.fluids)
          if (s.budget) {
            s.budget = Math.round(s.budget * c.scale);
            if (s.spacing) s.spacing *= Math.cbrt(1 / c.scale);
          }
        // Grid gas is excluded: this isolates the CPU liquid worker's actual work.
        const gridGas = ["candle", "cup"].includes(c.scene);
        const world = new FluidWorld(kit.fluids, { profile: c.profile, seed, gridGas });
        const bufs = [0, 1, 2, 3].map(() => new Float32Array(world.slots * 4));
        const times = [],
          simTimes = [],
          counts = [];
        const started = performance.now();
        for (let f = 0; f < 180; f++) {
          const t = f / 30,
            e = f < 30 ? 99 : (f - 30) / 30;
          const out = { parts: {}, cues: [] };
          recipe.drive(t, { go: e < 5 ? 1 - e / 5 : 0 }, out, {
            data: kit.data,
            tap: { n: f < 30 ? 0 : 1 },
          });
          const start = performance.now();
          world.command(out.fluid);
          world.step(1 / 30);
          world.pack(...bufs);
          if (f >= 30) {
            times.push(performance.now() - start);
            simTimes.push(world.stats.simMs);
            counts.push(world.count());
          }
        }
        const systems = world.systems.map((s) => ({
          name: s.name,
          kind: s.kind,
          n: s.n,
          cap: s.cap,
          dcap: s.dcap,
          dn: s.dn,
          grid: s.grid?.dim,
          gridCapacity: s.grid?.start?.length,
        }));
        return {
          times,
          simTimes,
          counts,
          slots: world.slots,
          systems,
          elapsedMs: performance.now() - started,
          frames: 180,
          warmupFrames: 30,
          clockStep: 1 / 30,
          gridGas,
          seed,
        };
      },
      { ...scene, ...setting },
    );
    const sorted = [...result.times].sort((a, b) => a - b);
    rows.push({
      key,
      ...scene,
      ...setting,
      ...result,
      medianMs: (sorted[74] + sorted[75]) / 2,
      p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    });
    fs.writeFileSync(file, JSON.stringify(rows, null, 2) + "\n");
    console.log(
      JSON.stringify({
        key,
        median: rows.at(-1).medianMs,
        p95: rows.at(-1).p95Ms,
        particles: Math.max(...result.counts),
        slots: result.slots,
      }),
    );
  }
await browser.close();
