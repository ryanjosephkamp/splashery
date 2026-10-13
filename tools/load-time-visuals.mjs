// Task 51: before/after canvas stills and exact RGBA diffs. Run without
// another rendering page open. Clocks and the camera are fixed for each pose.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import { TOYS } from "../src/toys.js";
import { createScene } from "../src/state.js";

const out = "docs/audits/load-time-2026-10/images";
fs.mkdirSync(out, { recursive: true });
const pilot = process.argv.includes("--pilot");
const allIds = [
  "cactus",
  "pyrite-cubes",
  "celestial-globe",
  "water-bottle",
  "sunglasses",
  "baseball-cap",
  "fountain-pen",
  "soda-can",
];
const ids = pilot ? ["cactus", "fountain-pen"] : allIds;
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  headless: false,
  args: [
    "--use-gl=angle",
    "--use-angle=gl",
    "--hide-scrollbars",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
  ],
});
const recordsFile = "docs/audits/load-time-2026-10/image-diffs.json";
const records = fs.existsSync(recordsFile) ? JSON.parse(fs.readFileSync(recordsFile)) : [];
async function shot(id, device, phase, pose, halfBudget = false) {
  const def = TOYS.find((t) => t.id === id);
  const phone = device.startsWith("phone");
  const viewport = phone ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: phone ? 3 : 1,
    isMobile: phone,
    hasTouch: phone,
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const scene = createScene({ seed: 424242, toy: { kind: "builtin", id } });
  if (def.camera) scene.camera = { ...scene.camera, ...def.camera };
  scene.autoplay.turntable = false;
  scene.motion.alive = false;
  const base = phase === "before" ? "http://127.0.0.1:4174" : "http://127.0.0.1:4173";
  await page.goto(
    `${base}/?renderer=webgl2&profile=${device === "phone" ? "weak" : device === "phone-mid" ? "mid" : "high"}&adapt=off&labs=1#s=j.${Buffer.from(JSON.stringify(scene)).toString("base64url")}`,
  );
  await page.waitForFunction(
    (id) => document.body.dataset.ready === "true" && window.__splashery.player.toyInfo?.id === id,
    id,
    { timeout: 180000 },
  );
  if (halfBudget)
    await page.evaluate(async (id) => {
      window.__splashery.player.splats = 30000;
      await window.__splashery.app.chooseToy(id);
    }, id);
  await page.waitForTimeout(1500);
  await page.evaluate(
    ({ camera, pose }) => {
      const p = window.__splashery.player;
      p.camera.setTurntable(false);
      p.camera.setState(camera, { snap: true });
      p.frozen = true;
      p.paused = false;
      p.time = 0;
      p.motion.kitClock = { t: 0, last: 0, rate: 1 };
      p.motion.moveClock = { t: 0, last: 0, rate: 1 };
      p.update(0);
      if (pose === "tap") {
        p.motion.act(0);
        // Frozen Player.update passes dt=0 to MotionDriver. Advance the
        // pulse explicitly to the one-second pose, preserving its exact
        // production decay formula, then draw with the clocks fixed.
        const key = p.motion.tap?.key;
        const control = p.toyInfo.recipe.controls.find((c) => c.key === key);
        if (control?.type !== "pulse" || !(control.ease > 1))
          throw new Error("No one-second tap pose");
        p.motion.state[key] = Math.max(0, 1 - 1 / control.ease);
        p.motion.kitClock.t = 1;
        p.time = 1;
        p.update(0);
      }
      // Native sorting has already seen live frames before the clock reset.
      // Rebuild its centers from the same final pose on both revisions,
      // regardless of whether this pose hit the recipe's sort interval.
      if (p.proc) {
        p.proc.container.centers.set(p.proc.ctx.buf.pos);
        p.resortTokens();
        p.resortPose();
      }
      p.setPaused(true);
      window.__visualStartFrame = p.stage.frames;
      p.stage.aliveUntil = performance.now() + 30000;
      p.stage.requestRender();
    },
    { camera: scene.camera, pose },
  );
  await page.waitForFunction(
    () => window.__splashery.player.stage.frames >= window.__visualStartFrame + 12,
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(1500);
  const file = `${id}-${device}-${halfBudget ? "lossy-half-budget" : phase}-${pose}.png`;
  await page.locator("#stage").screenshot({ path: path.join(out, file), scale: "css" });
  const info = await page.evaluate(() => ({
    id: window.__splashery.player.toyInfo.id,
    splats: window.__splashery.player.toyInfo.splats,
    title: document.title,
    controls: { ...window.__splashery.player.motion.state },
    settledFrames: window.__splashery.player.stage.frames - window.__visualStartFrame,
    canvas: {
      width: window.__splashery.player.canvas.width,
      height: window.__splashery.player.canvas.height,
    },
  }));
  await context.close();
  if (errors.length) throw new Error(`${file}: ${errors.join("; ")}`);
  return { file, ...info };
}
function diff(a, b, file) {
  const x = PNG.sync.read(fs.readFileSync(path.join(out, a)));
  const y = PNG.sync.read(fs.readFileSync(path.join(out, b)));
  if (x.width !== y.width || x.height !== y.height) throw new Error("Image dimensions differ");
  const d = new PNG({ width: x.width, height: x.height });
  let differentPixels = 0,
    sum = 0,
    max = 0;
  for (let i = 0; i < x.data.length; i += 4) {
    let changed = false;
    for (let k = 0; k < 3; k++) {
      const delta = Math.abs(x.data[i + k] - y.data[i + k]);
      d.data[i + k] = Math.min(255, delta * 8);
      changed ||= delta !== 0;
      sum += delta * delta;
      max = Math.max(max, delta);
    }
    changed ||= x.data[i + 3] !== y.data[i + 3];
    if (changed) differentPixels++;
    d.data[i + 3] = 255;
  }
  fs.writeFileSync(path.join(out, file), PNG.sync.write(d));
  return {
    differentPixels,
    pixels: x.width * x.height,
    rmsRGB: Math.sqrt(sum / (x.width * x.height * 3)),
    maxChannelDifference: max,
    diff: file,
  };
}
try {
  for (const device of pilot ? ["phone"] : ["phone", "desktop", "phone-mid"])
    for (const id of ids)
      for (const pose of ["rest", "tap"]) {
        if (id === "cactus" && pose === "tap") continue;
        if (device === "phone-mid" && ["cactus", "pyrite-cubes", "celestial-globe"].includes(id))
          continue;
        if (records.some((r) => r.id === id && r.device === device && r.pose === pose)) continue;
        const before = await shot(id, device, "before", pose);
        const after = await shot(id, device, "after", pose);
        const delta = diff(before.file, after.file, `${id}-${device}-diff-${pose}.png`);
        if (pose === "tap") {
          const rest = records.find((r) => r.id === id && r.device === device && r.pose === "rest");
          const moved = diff(rest.before.file, before.file, `${id}-${device}-tap-from-rest.png`);
          if (!moved.differentPixels) throw new Error(`${id} ${device}: tap pose did not move`);
          delta.tapChangedPixels = moved.differentPixels;
        }
        records.push({ captureVersion: 2, id, device, pose, before, after, ...delta });
        console.log(`${id} ${device} ${pose}: ${delta.differentPixels} changed pixels`);
        fs.writeFileSync(
          "docs/audits/load-time-2026-10/image-diffs.json",
          JSON.stringify(records, null, 2) + "\n",
        );
      }
  const lossy = [];
  if (pilot) process.exitCode = 0;
  else {
    for (const id of ["fountain-pen", "sunglasses"]) {
      const before = await shot(id, "phone", "after", "rest");
      const after = await shot(id, "phone", "after", "rest", true);
      lossy.push({
        id,
        shipped: false,
        option:
          "Half the phone recipe's splat budget (45000 instead of 90000); fewer rendered splats, no asset changes",
        before,
        after,
        ...diff(before.file, after.file, `${id}-phone-lossy-diff.png`),
      });
    }
    fs.writeFileSync(
      "docs/audits/load-time-2026-10/lossy-options.json",
      JSON.stringify(lossy, null, 2) + "\n",
    );
  }
} finally {
  await browser.close();
}
