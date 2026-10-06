// Photo to 3D (lane Photo to 3D): makes the depth maps of the sample photos with the same depth
// model and runtime the toy uses in the page (Depth Anything V2 Small, ONNX Runtime Web), in the
// browser, and writes assets/toys/photo-3d/<id>.depth (a small binary: see packDepth() in
// src/packs/photo-3d.js). The samples then need no model when someone opens the toy.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/p3d-depth.mjs [id ...]
import { chromium } from "@playwright/test";
import fs from "node:fs";

const IDS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["forest", "street", "still-life", "spiral-stairs", "palace-stairs", "wildflowers"];
const dir = "assets/toys/photo-3d";
const b = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--no-sandbox"],
});
const page = await b.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto("http://127.0.0.1:4173/index.html?labs=1");
for (const id of IDS) {
  const r = await page.evaluate(async (id) => {
    const dep = await import("/src/packs/photo-3d-depth.js");
    const pack = await import("/src/packs/photo-3d.js");
    const blob = await (await fetch(`/assets/toys/photo-3d/${id}.jpg`)).blob();
    const photo = await pack.decodePhoto(blob);
    const d = await dep.estimateDepth(photo);
    return { ms: d.ms, w: d.w, h: d.h, d: Array.from(pack.packDepth(d)) };
  }, id);
  fs.writeFileSync(`${dir}/${id}.depth`, Buffer.from(r.d));
  console.log(`${id}: ${r.w}x${r.h}, ${Math.round(r.ms)} ms, ${r.d.length} bytes`);
}
await b.close();
