// Offline model comparison only. No alternative weights are shipped or requested
// by the product. See the audit for the pinned source, license, and size.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";
import { median, sample } from "../src/pano3d/core.js";
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4191";
const ids = process.argv.slice(2);
const scenes = ids.length ? ids : ["room", "desk", "stairs", "arches", "steps", "lattice"];
const model = ".cache/pano3d/models/metric.onnx";
const hash = crypto
  .createHash("sha256")
  .update(await fs.readFile(model))
  .digest("hex");
const out = ".cache/pano3d/evidence";
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const results = [];
try {
  const page = await browser.newPage();
  await page.goto(base + "/docs/codex/107-step-inside-360.md");
  for (const id of scenes) {
    console.log("Metric depth " + id);
    const result = await page.evaluate(async (id) => {
      const { decodePhoto } = await import("/src/packs/photo-3d.js");
      const photo = await decodePhoto(
        await (await fetch("/.cache/pano3d/truth/" + id + "/pano.jpg")).blob(),
      );
      const origin = location.origin;
      const code = [
        "import {createDepthEngine} from " + JSON.stringify(origin + "/src/depth/engine.js") + ";",
        "import {TILES,perspective,alignTiles,fuseDepth} from " +
          JSON.stringify(origin + "/src/pano3d/core.js") +
          ";",
        "import {resampleArea} from " + JSON.stringify(origin + "/src/photo3d/pixels.js") + ";",
        "onmessage=async({data:photo})=>{try{",
        "const engine=createDepthEngine(); const tiles=[];const start=performance.now();",
        "const estimate=p=>engine.estimate(p,{side:518,modelUrl:" +
          JSON.stringify(origin + "/.cache/pano3d/models/metric.onnx") +
          "});",
        "for(const tile of TILES){const d=await estimate(perspective(photo,tile,518)); tiles.push({...tile,...d,d:Float32Array.from(d.d,v=>1/Math.max(.001,v))});}",
        "const raw=fuseDepth(tiles,{transforms:TILES.map(()=>({a:1,b:0}))});const aligned=fuseDepth(tiles,alignTiles(tiles));",
        "const colors=resampleArea(photo,518,518),data=new Uint8ClampedArray(518*518*4);for(let i=0;i<518*518;i++){for(let c=0;c<3;c++)data[4*i+c]=colors[3*i+c]*255;data[4*i+3]=255;}",
        "const naive=await estimate({w:518,h:518,data});postMessage({raw,aligned,naive,ms:performance.now()-start});",
        "}catch(e){postMessage({error:e.message})}};",
      ].join("\n");
      const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" })),
        worker = new Worker(url, { type: "module" });
      try {
        const r = await new Promise((resolve, reject) => {
          worker.onmessage = ({ data }) =>
            data.error ? reject(new Error(data.error)) : resolve(data);
          worker.onerror = (e) => reject(new Error(e.message));
          worker.postMessage(photo);
        });
        return Object.fromEntries(
          Object.entries(r).map(([key, value]) => [
            key,
            value?.d ? { ...value, d: Array.from(value.d) } : value,
          ]),
        );
      } finally {
        worker.terminate();
        URL.revokeObjectURL(url);
      }
    }, id);
    await fs.writeFile(
      path.join(out, id + "-metric-inference.json"),
      JSON.stringify({ modelHash: hash, ...result }),
    );
    const b = await fs.readFile(".cache/pano3d/truth/" + id + "/radial.f32");
    const truth = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const mask = await fs.readFile(".cache/pano3d/truth/" + id + "/mask.u8");
    const metrics = (input) => {
      const predicted = Array.from(truth, (_, i) =>
        sample(
          input.d,
          input.w,
          input.h,
          ((i % 384) + 0.5) / 384,
          (Math.floor(i / 384) + 0.5) / 192,
        ),
      );
      const scale = median(predicted.map((v, i) => (mask[i] === 1 ? truth[i] / v : NaN)));
      let error = 0,
        delta = 0,
        total = 0;
      predicted.forEach((v, i) => {
        if (mask[i] !== 1) return;
        const w = Math.sin((Math.PI * (Math.floor(i / 384) + 0.5)) / 192);
        const p = v * scale;
        error += (Math.abs(p - truth[i]) / truth[i]) * w;
        delta += (Math.max(p / truth[i], truth[i] / p) < 1.25 ? 1 : 0) * w;
        total += w;
      });
      return { absRel: error / total, delta1: delta / total, scale };
    };
    const row = {
      id,
      raw: metrics(result.raw),
      aligned: metrics(result.aligned),
      naive: metrics(result.naive),
      ms: result.ms,
    };
    results.push(row);
    console.log(JSON.stringify(row));
    await fs.writeFile(
      path.join(out, "metric-model-comparison.json"),
      JSON.stringify(
        {
          modelHash: hash,
          note: "Offline static-518 indoor metric ONNX model; naive panorama is resized to the model's fixed square input. Each method has independent scale-only calibration. Not shipping, and no phone claim.",
          scenes: results,
        },
        null,
        2,
      ) + "\n",
    );
  }
} finally {
  await browser.close();
}
