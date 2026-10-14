// Lane Volume viewer: the review clips, recorded at phone size (390 × 844, device scale 3) with the
// clock stepped by hand, so each clip runs at real speed however slow the renderer is.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/vol-clip.mjs <out-dir> [name ...]
//
// Writes <out-dir>/<name>.mp4 (and <name>-strip.png, 6 frames side by side). Each clip is a script
// below: options, then events at times (a cut place as a drag sets it, a tap, a control).

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const CLIPS = {
  // A drag cuts down through the walnut from the front, and back part of the way.
  "vol-walnut-cut": {
    opts: { source: "walnut", preset: "full", colors: "bone", cut: "front" },
    secs: 6,
    cut: (t) =>
      t < 0.5 ? 1 : t < 3.5 ? 1 - ((t - 0.5) / 3) * 0.55 : 0.45 + ((t - 3.5) / 2.5) * 0.15,
    yaw: 0.05,
  },
  // Taps step the window: full range, bone (the densest parts), soft tissue, full range.
  "vol-walnut-presets": {
    opts: { source: "walnut", preset: "full", colors: "gray", cut: "front" },
    secs: 8,
    cut: () => 0.5,
    taps: [1, 3.5, 6],
  },
  // The gar's head: the sweep runs the cut down through it and back.
  "vol-gar-sweep": {
    opts: { source: "gar", preset: "full", colors: "bone", cut: "front" },
    secs: 6.5,
    sweep: 0.5,
    yaw: 0.04,
  },
  // A thin slice moves through the gar from front to back.
  "vol-gar-slice": {
    opts: { source: "gar", preset: "full", colors: "gray", cut: "front", slice: true },
    secs: 6,
    cut: (t) => 0.8 - (t / 6) * 0.6,
  },
  // The maximum-intensity picture, then a tap to the next preset.
  "vol-gar-mip": {
    opts: { source: "gar", preset: "full", colors: "gray", view: "mip", cut: "front" },
    secs: 5,
    taps: [2],
  },
};

const [outDir, ...names] = process.argv.slice(2);
if (!outDir) throw new Error("Usage: node tools/vol-clip.mjs <out-dir> [name ...]");
fs.mkdirSync(outDir, { recursive: true });
const fps = Number(process.env.FPS || 15);
const ffmpeg = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); // prettier-ignore

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/opt/pw-browsers/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}?renderer=webgl2&profile=high&adapt=off&labs=1`); // prettier-ignore
await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });

for (const name of names.length ? names : Object.keys(CLIPS)) {
  const c = CLIPS[name];
  const tmp = fs.mkdtempSync(path.join(outDir, `.${name}-`));
  await page.evaluate(
    async ({ opts }) => {
      const { app, player } = window.__splashery;
      if (player.scene.toy?.id !== "volume-viewer") await app.chooseToy("volume-viewer");
      const { RECIPES, VOLUME_STATE } = await import("/src/packs/volume-viewer.js");
      const defaults = Object.fromEntries(RECIPES["volume-viewer"].options.filter((x) => !x.hidden).map((x) => [x.key, x.default])); // prettier-ignore
      await app.setToyOptions({ ...defaults, ...opts });
      VOLUME_STATE.cut.at = 1;
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      await new Promise((r) => setTimeout(r, 1500));
      const stage = player.stage;
      window.__volClip = { handlers: stage.updateHandlers.slice(), pending: 0 };
      stage.updateHandlers.length = 0;
      stage.updateHandlers.push(() => {
        const d = window.__volClip.pending;
        window.__volClip.pending = 0;
        for (const h of window.__volClip.handlers) h(d);
      });
      window.__volClip.home = { ...player.camera.home };
    },
    { opts: c.opts },
  );
  const total = Math.round(c.secs * fps);
  const taps = new Set((c.taps || []).map((t) => Math.round(t * fps)));
  for (let i = 0; i < total; i++) {
    const t = i / fps;
    await page.evaluate(
      async ({ t, cut, tap, sweep, yaw, step }) => {
        const { app, player } = window.__splashery;
        const { VOLUME_STATE } = await import("/src/packs/volume-viewer.js");
        if (cut != null) VOLUME_STATE.cut.at = cut;
        if (sweep) player.act(null); // the Play button: the sweep
        if (tap) {
          // A tap on the volume: its action picks the next preset and the toy rebuilds with it.
          const before = player.proc?.ctx;
          const tf = player.motion.ctx?.transform;
          player.act(tf ? [0, 0, 0].map((v, k) => (v - tf.center[k]) * tf.scale) : null);
          for (let k = 0; k < 400 && player.proc?.ctx === before; k++) await new Promise((r) => setTimeout(r, 50)); // prettier-ignore
          if (cut != null) VOLUME_STATE.cut.at = cut;
        }
        const h = window.__volClip.home;
        const cam = { ...h, yaw: h.yaw + (yaw || 0) * t };
        player.camera.cur = { ...cam };
        player.camera.tgt = { ...cam };
        window.__volClip.pending = step;
        await player.stage.captureFrame();
      },
      {
        t,
        cut: c.cut ? c.cut(t) : null,
        tap: taps.has(i),
        sweep: c.sweep != null && i === Math.round(c.sweep * fps),
        yaw: c.yaw,
        step: 1 / fps,
      },
    );
    await page.screenshot({ path: path.join(tmp, `f${String(i).padStart(4, "0")}.png`) });
  }
  await page.evaluate(() => {
    const { player } = window.__splashery;
    player.stage.updateHandlers.length = 0;
    player.stage.updateHandlers.push(...window.__volClip.handlers);
  });
  const mp4 = path.join(outDir, `${name}.mp4`);
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(tmp, "f%04d.png"), "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "23", mp4]); // prettier-ignore
  // A strip of six frames, for checking without playing.
  const picks = [0, 1, 2, 3, 4, 5].map((k) =>
    Math.min(total - 1, Math.round((k / 5) * (total - 1))),
  );
  execFileSync("python3", ["-I", "-c", `
import sys
from PIL import Image
fs=sys.argv[2:]
ims=[Image.open(f).resize((390,844)) for f in fs]
W=Image.new('RGB',(390*len(ims),844))
for i,im in enumerate(ims): W.paste(im,(390*i,0))
W.save(sys.argv[1])`, path.join(outDir, `${name}-strip.png`), ...picks.map((k) => path.join(tmp, `f${String(k).padStart(4, "0")}.png`))]); // prettier-ignore
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${name}: ${mp4} (${(fs.statSync(mp4).size / 1024).toFixed(0)} KB)`);
}
await browser.close();
