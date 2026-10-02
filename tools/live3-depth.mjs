// Moving photo to 3D (lane Live input r3): makes the sample clip. The frames
// are six seconds of Big Buck Bunny (the Screen toy's clip,
// assets/toys/screen/bunny.mp4, CC BY 3.0 Blender Foundation) at 8 a second,
// 256 by 144, tiled 8 by 6 into assets/toys/moving-photo-3d/bunny-frames.jpg
// with ffmpeg. Then each frame's depth is worked out with the same depth
// model the toy uses in the page (Depth Anything V2 Small, ONNX Runtime Web,
// src/live/depth-worker.js), in the browser, halved (98 by 56), and written
// to assets/toys/moving-photo-3d/bunny.depth (packDepths() in
// src/packs/moving-photo.js). The sample then needs no model in the page.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/live3-depth.mjs
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const dir = "assets/toys/moving-photo-3d";
const ffmpeg = process.env.FFMPEG || "ffmpeg";
execFileSync(ffmpeg, ["-nostdin", "-v", "error", "-y", "-i", "assets/toys/screen/bunny.mp4", "-vf", "fps=8,scale=256:144:flags=area,tile=8x6", "-frames:v", "1", "-q:v", "3", `${dir}/bunny-frames.jpg`]); // prettier-ignore

const b = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--no-sandbox"],
});
const page = await b.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto("http://127.0.0.1:4173/index.html?labs=1");
const r = await page.evaluate(async () => {
  const mp = await import("/src/packs/moving-photo.js");
  const { packDepth, decodePhoto } = await import("/src/packs/photo-3d.js");
  const blob = await (await fetch("/assets/toys/moving-photo-3d/bunny-frames.jpg")).blob();
  const frames = mp.sheetFrames(await decodePhoto(blob));
  const t0 = performance.now();
  const raw = await mp.depthOf(frames, mp.SAMPLE.w, mp.SAMPLE.h);
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
});
fs.writeFileSync(`${dir}/bunny.depth`, Buffer.from(r.bytes));
console.log(
  `bunny: ${r.n} frames, depth ${r.w}x${r.h}, ${Math.round(r.ms)} ms, ${r.bytes.length} bytes`,
);
await b.close();
