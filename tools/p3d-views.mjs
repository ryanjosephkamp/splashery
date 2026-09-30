#!/usr/bin/env node
// Photo to 3D (lane Photo to 3D): shots of the toy from several sides, for judging the relief,
// the cuts and the parallax. Writes one PNG strip per sample, the views side by side.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/p3d-views.mjs <out-dir>
//     [--samples=forest,street,still-life] [--yaws=-0.6,0,0.6] [--pitch=0] [--size=390x520]
//     [--depth=0.5] [--rise=1] [--layers=0] [--dist=2.6] [--suffix=""] [--bg=#111111]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outDir] = args.filter((a) => !a.startsWith("--"));
if (!outDir) throw new Error("Usage: node tools/p3d-views.mjs <out-dir>");
const samples = opt("samples", "forest,street,still-life").split(",");
const yaws = opt("yaws", "-0.6,0,0.6").split(",").map(Number);
const [W, H] = opt("size", "390x520").split("x").map(Number);
const pitch = Number(opt("pitch", 0));
const depth = Number(opt("depth", 0.5));
const rise = Number(opt("rise", 1));
const layers = Number(opt("layers", 0));
const dist = opt("dist", "");
const suffix = opt("suffix", "");
const bg = opt("bg", "#111111");
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const page = await browser.newPage({
  viewport: { width: 1000, height: 700 },
  reducedMotion: "reduce",
});
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=${opt("profile", "mid")}&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
for (const id of samples) {
  const shots = await page.evaluate(
    async ({ id, W, H, yaws, pitch, depth, rise, layers, dist, bg }) => {
      const { app, player } = window.__splashery;
      await app.chooseToy("photo-3d");
      app.setLook({ background: bg });
      await app.setToyOptions({ source: id, depth });
      player.idle.weight = 0;
      await new Promise((r) => setTimeout(r, 2500));
      player.motion.setControl("flat", 1 - rise, { snap: true });
      player.motion.setControl("layers", layers, { snap: true });
      player.stage.setFixedSize([W, H]);
      const out = [];
      for (const yaw of yaws) {
        player.camera.cur = { ...player.camera.home, yaw, pitch };
        if (dist) player.camera.cur.distance = Number(dist);
        player.camera.tgt = { ...player.camera.cur };
        for (let i = 0; i < 5; i++) await player.stage.captureFrame();
        out.push((await player.stage.captureFrame()).toDataURL("image/png"));
      }
      player.stage.setFixedSize(null);
      return out;
    },
    { id, W, H, yaws, pitch, depth, rise, layers, dist, bg },
  );
  const pngs = shots.map((u) => PNG.sync.read(Buffer.from(u.split(",")[1], "base64")));
  const strip = new PNG({ width: pngs.reduce((s, p) => s + p.width, 0), height: pngs[0].height });
  let x = 0;
  for (const p of pngs) {
    PNG.bitblt(p, strip, 0, 0, p.width, p.height, x, 0);
    x += p.width;
  }
  const out = path.join(outDir, `${id}${suffix}.png`);
  fs.writeFileSync(out, PNG.sync.write(strip));
  console.log(out, `${strip.width}x${strip.height}`);
}
await browser.close();
