#!/usr/bin/env node
// Lane Photo sharp view (October 8, 2026): a clip of Photo to 3D or Moving photo to 3D in one view
// (the splats or the Sharp picture), at phone size, for the Effect review page.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/psv-clip.mjs <out.mp4>
//     --toy=photo-3d|moving-photo-3d [--open=<file>] --view=splats|sharp
//     [--secs=6] [--fps=15] [--from=6] [--zoom=home|max] [--sway=0.2] [--dpr=3]
//     [--label="Sharp picture · Opus 5.5"] [--profile=mid]
//
// The page is 390 x 844 at device scale --dpr, in focus mode (only the toy). Photo to 3D: the photo
// is opened, its depth raised, and the view sways --sway radians each way over the clip. Moving
// photo to 3D: the file is opened and its depth worked out in full, then the clip is drawn frame by
// frame from --from seconds, each frame scrubbed to (paused) and drawn once its video picture and
// depth are in, with a smaller sway, so the clip shows the video at its real speed however slowly
// the renderer here draws. Frames go to ffmpeg (H.264).

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [out] = args.filter((a) => !a.startsWith("--"));
const toy = opt("toy", "photo-3d");
const file = opt("open", "");
const view = opt("view", "sharp");
const secs = Number(opt("secs", 6));
const fps = Number(opt("fps", 15));
const from = Number(opt("from", 6));
const zoom = opt("zoom", "home");
const sway = Number(opt("sway", toy === "photo-3d" ? 0.2 : 0.1));
const dpr = Number(opt("dpr", 3));
const label = opt("label", "");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
if (!out) throw new Error("Usage: node tools/psv-clip.mjs <out.mp4> --toy=… [--open=<file>] …");

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr }); // prettier-ignore
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&adapt=off&profile=${opt("profile", "mid")}&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(async (t) => {
  const { app, player } = window.__splashery;
  await app.chooseToy(t);
  player.opts.idleDelay = 1e9;
  player.idle.weight = 0;
}, toy);
await page.waitForFunction(() => !window.__splashery.player.loading && window.__splashery.player.proc?.ctx?.kit?.data, null, { timeout: 120_000 }); // prettier-ignore
if (file) await page.locator("#toy-input-file").setInputFiles(file);
const name = file ? path.basename(file).replace(/\.[^.]+$/, "") : null;
if (toy === "photo-3d") {
  await page.waitForFunction((c) => window.__splashery.player.proc?.ctx?.kit?.data?.photo?.custom === c, !!file, { timeout: 600_000 }); // prettier-ignore
  await page.evaluate(() => window.__splashery.app.act());
  await page.waitForFunction(() => window.__splashery.player.motion.state.flat < 0.002, null, { timeout: 60_000 }); // prettier-ignore
} else {
  await page.evaluate(async () => (window.__mv = (await import("/src/packs/moving-photo.js")).MOVING)); // prettier-ignore
  await page.waitForFunction((n) => {
    const c = window.__mv.clip;
    return (!n || c?.name === n) && !window.__splashery.player.loading && (!c.long || c.depth.ready >= c.depth.n); // prettier-ignore
  }, name, { timeout: 1_800_000, polling: 2000 }); // prettier-ignore
  await page.evaluate(() => window.__splashery.app.setControl("play", 0));
}
await page.keyboard.press("f");
await page.evaluate(() => window.__splashery.player.camera.reset());
if (zoom === "max") await page.evaluate(() => window.__splashery.player.camera.zoomBy(0.001));
await page.evaluate(([t, v]) => window.__psv.set(t, v), [toy, view]);
if (label)
  await page.evaluate((text) => {
    const d = document.createElement("div");
    d.textContent = text;
    d.style.cssText = "position:fixed;left:12px;top:12px;z-index:99;padding:5px 10px;border-radius:14px;background:rgba(20,22,26,.78);color:#fff;font:600 13px/1.2 system-ui,sans-serif"; // prettier-ignore
    document.body.append(d);
  }, label);
await page.waitForTimeout(2500);

const ff = spawn(
  "ffmpeg",
  ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-movflags", "+faststart", out], // prettier-ignore
  { stdio: ["pipe", "inherit", "inherit"] },
);
const done = new Promise((res, rej) => ff.on("close", (c) => (c ? rej(new Error(`ffmpeg ${c}`)) : res()))); // prettier-ignore
const n = Math.round(secs * fps);
for (let k = 0; k < n; k++) {
  const yaw = sway * Math.sin((2 * Math.PI * k) / n);
  await page.evaluate(
    async ([yaw, t, moving]) => {
      const pl = window.__splashery.player;
      pl.camera.tgt.yaw = pl.camera.cur.yaw = yaw;
      if (moving) {
        const m = await import("/src/packs/moving-photo.js");
        m.movingTransport.seek(t);
        const v = window.__mv.clip.video || (window.__psv.state().video ? { get currentTime() { return window.__psv.state().videoTime; }, seeking: false, readyState: 4 } : null); // prettier-ignore
        const until = performance.now() + 4000;
        // the clip's own copy goes to t on the next drive; wait for its picture there
        for (;;) {
          await new Promise((r) => requestAnimationFrame(r));
          if (!v || (Math.abs(v.currentTime - t) < 0.06 && !v.seeking && v.readyState >= 2)) break;
          if (performance.now() > until) break;
          if (Math.abs(v.currentTime - t) >= 0.06 && !v.seeking && v instanceof HTMLMediaElement) v.currentTime = t; // prettier-ignore
        }
      }
      pl.stage.requestRender();
      for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r));
    },
    [yaw, from + k / fps, toy !== "photo-3d"],
  );
  const png = await page.screenshot({ type: "png" });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
  if (k % 15 === 0) process.stdout.write(`frame ${k} of ${n}\r`);
}
ff.stdin.end();
await done;
await browser.close();
console.log(`\nWrote ${out}`);
