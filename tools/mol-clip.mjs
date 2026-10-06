#!/usr/bin/env node
// Lane Molecule viewer: renders a clip of the molecule viewer at phone size
// (390 × 844, the whole page, so the measurement's message and the Toy tab
// show too), as an MP4 for the Effect review page.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/mol-clip.mjs <out.mp4>
//       [--opt=key=value ...] [--picks=demo|3] [--secs=2.5] [--gap=1.4] [--fps=12]
//       [--zoom=0.6] [--fetch=1EMA [--mock=file.cif]] [--size=390x844] [--profile=high]
//
// --picks=demo taps the atoms the Play button would (a bond near the middle,
// then its angle): 2 or 3 of them, --gap seconds apart, through the same
// player.act a finger's tap uses. --zoom brings the camera closer, aimed at
// the picked atoms. --fetch types a code in the Toy tab and presses Fetch
// (the real RCSB, as a person would; --mock answers for RCSB with a local
// file where the browser can't reach it). The clock is stepped by hand.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("Usage: node tools/mol-clip.mjs <out.mp4> [options]");
const [W, H] = opt("size", "390x844").split("x").map(Number);
const fps = Number(opt("fps", 12));
const secs = Number(opt("secs", 2.5));
const gap = Number(opt("gap", 1.4));
const zoom = Number(opt("zoom", 1));
const picks = opt("picks", "");
const fetchCode = opt("fetch", "");
const mock = opt("mock", "");
const profile = opt("profile", "high");
const options = Object.fromEntries(
  args.filter((a) => a.startsWith("--opt=")).map((a) => a.slice(6).split("=")),
);

const ffmpeg = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); // prettier-ignore
const dir = fs.mkdtempSync(path.join(path.dirname(path.resolve(out)), ".molclip-"));
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("pageerror", (e) => console.error("page error:", e.message));
if (mock)
  await page.route("https://files.rcsb.org/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "chemical/x-cif",
      body: fs.readFileSync(mock, "utf8"),
    }),
  );
await page.goto(`${base}?renderer=webgl2&profile=${profile}&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate(async (options) => {
  const { app, player } = window.__splashery;
  await app.chooseToy("molecule-viewer");
  while (app.busy) await new Promise((r) => setTimeout(r, 50));
  if (Object.keys(options).length) await app.setToyOptions(options);
  while (app.busy) await new Promise((r) => setTimeout(r, 50));
  player.opts.idleDelay = 1e9;
  player.idle.weight = 0;
  app.ui.collapseSheet?.();
  // The clock goes forward only when a frame is asked for.
  const stage = player.stage;
  const handlers = stage.updateHandlers.slice();
  stage.updateHandlers.length = 0;
  window.__molClip = { pending: 0 };
  stage.updateHandlers.push(() => {
    const d = window.__molClip.pending;
    window.__molClip.pending = 0;
    for (const h of handlers) h(d);
  });
}, options);

let n = 0;
const frame = async () => {
  await page.evaluate(async (step) => {
    const { player } = window.__splashery;
    window.__molClip.pending = step;
    await player.stage.captureFrame();
  }, 1 / fps);
  await page.screenshot({ path: path.join(dir, `f${String(n++).padStart(4, "0")}.png`) });
};
const frames = async (s) => {
  for (let t = 0; t < s - 1e-6; t += 1 / fps) await frame();
};

if (fetchCode) {
  // Open the Toy tab, type the code, press Fetch, and film the panel while it loads.
  await page.evaluate(() => {
    window.__splashery.app.ui.setSheetStop?.("panel");
    window.__splashery.app.ui.showTab("play");
  });
  await frames(0.6);
  await page.fill("#toy-input-text", fetchCode);
  await frames(0.4);
  await page.click("#toy-input-go");
  // A second of the loading message, then wait without filming.
  const done = async () => (await page.locator(".input-shown").textContent()).includes(fetchCode.toUpperCase()); // prettier-ignore
  for (let i = 0; i < fps && !(await done()); i++) await frame();
  for (let i = 0; i < 600 && !(await done()); i++) await page.waitForTimeout(200);
  if (!(await done())) throw new Error(`${fetchCode} did not load`);
  await frames(1.5);
  await page.evaluate(() => window.__splashery.app.ui.collapseSheet?.());
}

// Aim the camera at the atoms to be picked.
const list = await page.evaluate(
  async ({ picks, zoom }) => {
    const { player } = window.__splashery;
    const { viewerState } = await import("/src/packs/molecule-viewer.js");
    const S = viewerState();
    S.picks = [];
    const m = S.shown.model;
    const atoms =
      picks && S.shown.demo ? S.shown.demo.slice(0, picks === "demo" ? 3 : Number(picks)) : [];
    const cam = player.camera;
    if (atoms.length && zoom !== 1) {
      const c = [0, 1, 2].map((k) => atoms.reduce((s, a) => s + [m.x[a], m.y[a], m.z[a]][k], 0) / atoms.length); // prettier-ignore
      const w = player.fromRecipe(c);
      cam.target = w.slice();
      cam.aim = w.slice();
    }
    cam.turntable = false;
    cam.cur = { ...cam.home, distance: cam.home.distance * zoom };
    cam.tgt = { ...cam.cur };
    return atoms.map((a) => [m.x[a], m.y[a], m.z[a]]);
  },
  { picks, zoom },
);
await frames(0.6);
for (let i = 0; i < list.length; i++) {
  await page.evaluate((p) => {
    const { player } = window.__splashery;
    player.act(player.fromRecipe(p));
    // The frames take longer to make than they show, so the tap's message
    // is held until the next tap (it shows for 6 s in the app).
    const t = document.getElementById("toast");
    if (t.textContent) window.__splashery.app.ui.toast(t.textContent, 600000);
  }, list[i]);
  await frames(i < list.length - 1 ? gap : secs);
}
if (!list.length) await frames(secs);
await browser.close();
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(dir, "f%04d.png"), "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "23", out]); // prettier-ignore
// The last frame as a still, for checking without playing it.
const pngs = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".png"))
  .sort();
fs.copyFileSync(path.join(dir, pngs[pngs.length - 1]), out.replace(/\.mp4$/, "-last.png"));
fs.rmSync(dir, { recursive: true });
console.log(`${out}: ${n} frames, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
