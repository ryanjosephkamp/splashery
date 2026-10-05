// Moving photo to 3D (lane Live input r3; lane Studio media made it work for every sample in SAMPLES in
// src/packs/moving-photo.js): makes a sample clip. The frames
// are six seconds of Big Buck Bunny (the Screen toy's clip,
// assets/toys/screen/bunny.mp4, CC BY 3.0 Blender Foundation) at 8 a second,
// 640 by 360 (r5; was 256 by 144), tiled 3 by 5 into four sheets,
// assets/toys/moving-photo-3d/bunny-sheet-1.jpg to -4.jpg, with ffmpeg (a
// decoded picture is at most 2048 pixels on a side). Then each frame's depth is worked out with the same depth
// model the toy uses in the page (Depth Anything V2 Small, ONNX Runtime Web,
// src/live/depth-worker.js), in the browser, halved (98 by 56), and written
// to assets/toys/moving-photo-3d/bunny.depth (packDepths() in
// src/packs/moving-photo.js). The sample then needs no model in the page.
//
// Each sample's `cut` says where its frames come from (a file in the repo, or a download kept in
// .cache/smd/, which is never committed), where it starts, how long it runs and how to crop it. A
// sample with a sound gets a mono MP3 of the same span.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/live3-depth.mjs [id ...]
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { SAMPLES } from "../src/packs/moving-photo.js";

const dir = "assets/toys/moving-photo-3d";
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const ids = process.argv.slice(2);
const todo = SAMPLES.filter((s) => !ids.length || ids.includes(s.id));
const run = (...a) => execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-y", ...a]);

const b = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--no-sandbox"],
});
const page = await b.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto(`${process.env.SPLASHERY_URL || "http://127.0.0.1:4173"}/index.html?labs=1`);
for (const s of todo) {
  const { src, ss = 0, t, crop } = s.cut;
  if (!fs.existsSync(src)) {
    console.log(`${s.id}: ${src} is missing, skipped`);
    continue;
  }
  const cutArgs = [...(ss ? ["-ss", String(ss)] : []), ...(t ? ["-t", String(t)] : []), "-i", src];
  const vf = [crop && `crop=${crop}`, `fps=${s.fps}`, `scale=${s.w}:${s.h}:flags=lanczos`, `tile=${s.cols}x${s.rows}`].filter(Boolean).join(","); // prettier-ignore
  run(...cutArgs, "-vf", vf, "-frames:v", String(s.sheets), "-q:v", "3", `${dir}/${s.file}-sheet-%d.jpg`); // prettier-ignore
  if (s.sound) run(...cutArgs, "-vn", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "56k", `${dir}/${s.sound}`); // prettier-ignore
  const r = await page.evaluate(async (id) => {
    const mp = await import("/src/packs/moving-photo.js");
    const { packDepth, decodePhoto } = await import("/src/packs/photo-3d.js");
    const s = mp.SAMPLES.find((x) => x.id === id);
    const sheets = [];
    for (let i = 1; i <= s.sheets; i++)
      sheets.push(await decodePhoto(await (await fetch(`/assets/toys/moving-photo-3d/${s.file}-sheet-${i}.jpg`)).blob())); // prettier-ignore
    const frames = mp.sheetFrames(sheets, s.w, s);
    const t0 = performance.now();
    const raw = await mp.depthOf(frames, s.w, s.h);
    // Halved: the depth of each 2 by 2 block.
    const half = raw.map(({ w, h, d }) => {
      const w2 = w >> 1;
      const h2 = h >> 1;
      const o = new Float32Array(w2 * h2);
      for (let y = 0; y < h2; y++)
        for (let x = 0; x < w2; x++)
          o[y * w2 + x] = (d[2 * y * w + 2 * x] + d[2 * y * w + 2 * x + 1] + d[(2 * y + 1) * w + 2 * x] + d[(2 * y + 1) * w + 2 * x + 1]) / 4; // prettier-ignore
      return { w: w2, h: h2, d: o };
    });
    return { n: half.length, w: half[0].w, h: half[0].h, ms: performance.now() - t0, bytes: Array.from(mp.packDepths(half, packDepth)) }; // prettier-ignore
  }, s.id);
  fs.writeFileSync(`${dir}/${s.file}.depth`, Buffer.from(r.bytes));
  console.log(`${s.id}: ${r.n} frames, depth ${r.w}x${r.h}, ${Math.round(r.ms)} ms, ${r.bytes.length} bytes`); // prettier-ignore
}
await b.close();
