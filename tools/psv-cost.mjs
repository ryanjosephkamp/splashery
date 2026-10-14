#!/usr/bin/env node
// Lane Photo sharp view (October 8, 2026): what the Sharp picture view costs beside the splats, in
// Photo to 3D and Moving photo to 3D: frame time at 390 x 844 (device scale 3) and the GPU memory
// each view holds, on each device profile.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/psv-cost.mjs [--profiles=low,mid,high,max]
//     [--toys=photo-3d,moving-photo-3d] [--frames=90] [--renderer=webgl2]
//
// Frame time: the view turned a little every frame (so every frame really draws) for --frames
// frames, after a warm-up; the median of the stage's own frame times. In the cloud sandbox the GPU
// is SwiftShader (software), so the numbers are only good for comparing the two views with each
// other: a phone's GPU is far faster at both. Memory: the relief's own count (the picture with its
// mipmaps, the depth, the two grids) and, for the splats, the kit format's 64 bytes a splat (the
// splat data, the work buffer and the sort keys, as docs/audits counts them), an estimate.

import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const profiles = opt("profiles", "low,mid,high,max").split(",");
const toys = opt("toys", "photo-3d,moving-photo-3d").split(",");
const frames = Number(opt("frames", 90));
const renderer = opt("renderer", "webgl2");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const SPLAT_BYTES = 64;

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
    "--enable-unsafe-webgpu", "--enable-features=Vulkan,WebGPU", "--use-webgpu-adapter=swiftshader", "--use-vulkan=swiftshader"], // prettier-ignore
});
const rows = [];
for (const profile of profiles)
  for (const toy of toys) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }); // prettier-ignore
    await page.goto(`${base}?renderer=${renderer}&adapt=off&profile=${profile}&labs=1`);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
    await page.evaluate((t) => window.__splashery.app.chooseToy(t), toy);
    await page.waitForFunction(() => !window.__splashery.player.loading && window.__splashery.player.proc?.ctx?.kit?.data, null, { timeout: 120_000 }); // prettier-ignore
    if (toy === "photo-3d") {
      await page.evaluate(() => window.__splashery.app.act());
      await page.waitForFunction(() => window.__splashery.player.motion.state.flat < 0.01, null, { timeout: 60_000 }); // prettier-ignore
    }
    const row = { profile, toy };
    for (const view of ["splats", "sharp"]) {
      await page.evaluate(([t, v]) => window.__psv.set(t, v), [toy, view]);
      await page.waitForTimeout(1500);
      const r = await page.evaluate(async (n) => {
        const pl = window.__splashery.player;
        const st = pl.stage;
        const times = [];
        let last = performance.now();
        await new Promise((done) => {
          let k = 0;
          const step = () => {
            pl.camera.tgt.yaw += 0.002 * (k % 2 ? 1 : -1);
            st.requestRender();
            const now = performance.now();
            if (k > 10) times.push(now - last);
            last = now;
            if (++k < n + 10) requestAnimationFrame(step);
            else done();
          };
          requestAnimationFrame(step);
        });
        times.sort((a, b) => a - b);
        const splats = st.toy.resource?.numSplats ?? pl.proc?.ctx?.buf?.count ?? 0;
        return { ms: times[times.length >> 1], splats, sharp: window.__psv.state() };
      }, frames);
      row[view] =
        view === "splats"
          ? { ms: +r.ms.toFixed(1), splats: r.splats, mb: +((r.splats * SPLAT_BYTES) / 1e6).toFixed(1) } // prettier-ignore
          : { ms: +r.ms.toFixed(1), grid: r.sharp.grid, color: r.sharp.color, depth: r.sharp.depth, triangles: r.sharp.cost?.triangles, mb: +(r.sharp.cost?.total / 1e6).toFixed(1) }; // prettier-ignore
    }
    rows.push(row);
    console.log(JSON.stringify(row));
    await page.close();
  }
await browser.close();
