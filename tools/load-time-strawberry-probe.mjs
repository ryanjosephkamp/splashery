// Reproduce the smoke check without changing its clocks, controls, or render state.
// Full captures and the diagnostic record stay outside the repository.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";
const option = (key, fallback) =>
  process.argv.find((s) => s.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const base = option("base", "http://127.0.0.1:4173");
const label = option("label", "candidate");
const out = path.resolve(option("out", "../load-time-runs/round3-strawberry"));
fs.mkdirSync(out, { recursive: true });
const headed = process.env.SPLASHERY_GL === "llvmpipe";
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  headless: !headed,
  args: [
    ...(headed
      ? ["--use-gl=angle", "--use-angle=gl", "--hide-scrollbars"]
      : ["--use-angle=swiftshader"]),
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
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const rows = [];
function difference(a, b) {
  a = PNG.sync.read(a);
  b = PNG.sync.read(b);
  if (a.width !== b.width || a.height !== b.height)
    return { resized: true, width: b.width, height: b.height };
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if ([0, 1, 2].some((c) => Math.abs(a.data[i + c] - b.data[i + c]) > 24)) changed++;
  return { changed, pixels: a.width * a.height };
}
async function capture(name) {
  const image = await page.locator("#stage").screenshot({ timeout: 180000 });
  fs.writeFileSync(path.join(out, `${label}-${name}.png`), image);
  const state = await page.evaluate(() => {
    const p = window.__splashery.player;
    return {
      wall: performance.now(),
      time: p.time,
      frames: p.__probe.frames,
      dt: p.__probe.dt,
      profile: p.profile,
      count: p.toyInfo.splats,
      sinceTapSeconds: p.time - (p.motion.tap?.time ?? p.time),
      recentFrames: p.__probe.recentFrames,
      seed: p.scene.seed,
      controls: {
        targets: { ...p.motion.targets },
        state: { ...p.motion.state },
        pausedAt: p.motion.pausedAt,
      },
      camera: {
        cur: { ...p.camera.cur },
        tgt: { ...p.camera.tgt },
        target: [...p.camera.target],
        aim: [...p.camera.aim],
        turntable: p.camera.turntable,
      },
      canvas: { width: p.canvas.width, height: p.canvas.height },
      motion: p.scene.motion,
      look: p.scene.look,
    };
  });
  return { image, state };
}
try {
  await page.goto(`${base}/?renderer=webgl2&profile=weak`, { timeout: 180000 });
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(() => {
    const p = window.__splashery.player;
    p.camera.setTurntable(false);
    p.__probe = { frames: 0, dt: [], recentFrames: [] };
    const update = p.update;
    p.update = function (dt) {
      this.__probe.frames++;
      this.__probe.recentFrames.push({ dt, wallMs: performance.now(), time: this.time });
      if (this.__probe.recentFrames.length > 60) this.__probe.recentFrames.shift();
      this.__probe.dt.push(dt);
      if (this.__probe.dt.length > 30) this.__probe.dt.shift();
      return update.call(this, dt);
    };
  });
  await page.click(".toy-card[data-toy='strawberry']");
  await page.waitForFunction(() =>
    document.querySelector("#toy-status").textContent.startsWith("Strawberry"),
  );
  await page.waitForTimeout(1500);
  const rest = await capture("rest");
  rows.push({ pose: "rest", ...rest.state });
  await page.click("#toy-action");
  await page.waitForTimeout(600);
  const popped = await capture("popped");
  const moved = difference(rest.image, popped.image);
  rows.push({ pose: "popped", ...popped.state, difference: moved });
  for (let n = 0; n < 20; n++) {
    await page.waitForTimeout(1000);
    const sample = await capture(`settled-${n}`);
    rows.push({
      pose: `settled-${n}`,
      ...sample.state,
      difference: difference(rest.image, sample.image),
    });
    fs.writeFileSync(
      path.join(out, `${label}.json`),
      JSON.stringify({ base, errors, rows }, null, 2) + "\n",
    );
    if (rows.at(-1).difference.changed < moved.changed / 4) break;
  }
  console.log(JSON.stringify({ label, errors, rest: rows[0], popped: rows[1], last: rows.at(-1) }));
} finally {
  await browser.close();
}
