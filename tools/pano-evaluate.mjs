// Actual shipped-model inference; evaluation images and scores stay on the clips branch.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import jpeg from "jpeg-js";
import { maskedSSIM as ssim } from "./pano-metrics.mjs";
import { direction, sample, median, TILES, project } from "../src/pano3d/core.js";
const root = process.cwd(),
  folder = path.resolve(process.env.SPLASHERY_PANO_TRUTH || ".cache/pano3d/truth");
const evidence = path.resolve(process.env.SPLASHERY_PANO_EVIDENCE || ".cache/pano3d/evidence");
const truthURL =
  "/" + path.relative(root, folder).split(path.sep).map(encodeURIComponent).join("/") + "/";
await fs.mkdir(evidence, { recursive: true });
const port = Number(process.env.SPLASHERY_PANO_PORT) || 4187,
  base = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["tools/cdx-mp2-server.mjs", String(port)], {
  stdio: "ignore",
});
for (let i = 0; i < 100; i++) {
  try {
    await fetch(base);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 100));
  }
}
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const manifest = JSON.parse(await fs.readFile(path.join(folder, "manifest.json"), "utf8"));
const digest = crypto.createHash("sha256");
for (const f of ["core.js", "pipeline.js", "prior.js"])
  digest.update(await fs.readFile("src/pano3d/" + f));
const pipelineHash = digest.digest("hex");
const results = [];
try {
  const page = await browser.newPage();
  await page.goto(base + "/docs/codex/107-step-inside-360.md");
  for (const scene of manifest.scenes) {
    const dir = path.join(folder, scene.id),
      cache = path.join(evidence, scene.id + "-inference.json");
    let inference;
    try {
      inference = JSON.parse(await fs.readFile(cache, "utf8"));
    } catch {}
    if (inference?.pipelineHash !== pipelineHash || !inference.tiles || !inference.naive392) {
      console.log("Inferring " + scene.id);
      inference = await page.evaluate(
        async ({ id, truthURL }) => {
          const { decodePhoto } = await import("/src/packs/photo-3d.js");
          const photo = await decodePhoto(await (await fetch(truthURL + id + "/pano.jpg")).blob());
          const code = [
            "import { createDepthEngine } from " +
              JSON.stringify(location.origin + "/src/depth/engine.js") +
              ";",
            "import { reconstruct } from " +
              JSON.stringify(location.origin + "/src/pano3d/pipeline.js") +
              ";",
            "onmessage = async ({data:photo}) => { try {",
            "const e=createDepthEngine(); const start=performance.now(); const tiles=[];",
            "const result=await reconstruct(photo,async(p,o)=>{const d=await e.estimate(p,o); tiles.push(d); return d;});",
            "const naive=await e.estimate(photo,{side:294});",
            "const naive392=await e.estimate(photo,{side:392});",
            "postMessage({result,naive,naive392,tiles,ms:performance.now()-start});",
            "} catch(e) {postMessage({error:e.message});}};",
          ].join("\n");
          const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
          const w = new Worker(url, { type: "module" });
          try {
            const r = await new Promise((resolve, reject) => {
              w.onmessage = ({ data }) =>
                data.error ? reject(new Error(data.error)) : resolve(data);
              w.onerror = (e) => reject(new Error(e.message));
              w.postMessage(photo);
            });
            return {
              ...r,
              result: {
                ...r.result,
                depth: { ...r.result.depth, d: Array.from(r.result.depth.d) },
              },
              naive: { ...r.naive, d: Array.from(r.naive.d) },
              naive392: { ...r.naive392, d: Array.from(r.naive392.d) },
              tiles: r.tiles.map((t) => ({ ...t, d: Array.from(t.d) })),
            };
          } finally {
            w.terminate();
            URL.revokeObjectURL(url);
          }
        },
        { id: scene.id, truthURL },
      );
      inference.pipelineHash = pipelineHash;
      await fs.writeFile(cache, JSON.stringify(inference));
    }
    const bytes = await fs.readFile(path.join(dir, "radial.f32"));
    const truth = new Float32Array(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const mask = await fs.readFile(path.join(dir, "mask.u8"));
    const photo = jpeg.decode(await fs.readFile(path.join(dir, "pano.jpg")), { useTArray: true });
    const predicted = inference.result.depth,
      naive = inference.naive;
    const resize = (input, inverse = false) =>
      Float32Array.from(truth, (_, i) => {
        const v = sample(
          input.d,
          input.w,
          input.h,
          ((i % scene.width) + 0.5) / scene.width,
          (Math.floor(i / scene.width) + 0.5) / scene.height,
        );
        return inverse ? 1 / Math.max(1e-6, v) : v;
      });
    const calibrate = (d) => {
      const ratios = Array.from(d, (v, i) => (mask[i] === 1 && truth[i] > 0 ? truth[i] / v : NaN));
      const scale = median(ratios);
      return { scale, d: Float32Array.from(d, (v) => v * scale) };
    };
    const aligned = calibrate(resize(predicted)),
      baseline = calibrate(resize(naive, true)),
      baseline392 = calibrate(resize(inference.naive392, true));
    const metrics = (d) => {
      let abs = 0,
        delta = 0,
        weight = 0,
        pixels = 0;
      for (let i = 0; i < truth.length; i++)
        if (mask[i] === 1 && truth[i] > 0) {
          const w = Math.sin((Math.PI * (Math.floor(i / scene.width) + 0.5)) / scene.height);
          abs += (Math.abs(d[i] - truth[i]) / truth[i]) * w;
          delta += (Math.max(d[i] / truth[i], truth[i] / d[i]) < 1.25 ? 1 : 0) * w;
          weight += w;
          pixels++;
        }
      return { absRel: abs / weight, delta1: delta / weight, pixels };
    };
    const seamJumps = (d) => {
      const ownership = (x, y) => {
        const ray = direction((x + 0.5) / scene.width, (y + 0.5) / scene.height);
        const ws = TILES.map((t) => project(ray, t)?.weight || 0);
        return ws.indexOf(Math.max(...ws));
      };
      const jumps = [];
      for (let y = 0; y < scene.height; y++)
        for (let x = 0; x < scene.width; x++) {
          const i = y * scene.width + x;
          for (const [xx, yy] of [
            [(x + 1) % scene.width, y],
            [x, y + 1],
          ]) {
            if (yy >= scene.height) continue;
            const j = yy * scene.width + xx;
            if (mask[i] !== 1 || mask[j] !== 1) continue;
            if (ownership(x, y) !== ownership(xx, yy) || (x === scene.width - 1 && xx === 0))
              jumps.push(Math.abs(d[i] - d[j]) / ((d[i] + d[j]) / 2));
          }
        }
      return { median: jumps.length ? median(jumps) : null, pairs: jumps.length };
    };
    // A declared software point-splat diagnostic, independent of the product GPU.
    // Mask is fixed from ground-truth source visibility; missing predicted pixels
    // are black and stay in the score, so holes cannot improve it.
    const render = (d, offset) => {
      const n = 256,
        f = n / (2 * Math.tan((72 * Math.PI) / 360));
      const rgb = new Float32Array(n * n * 3),
        weights = new Float32Array(n * n),
        z = new Float32Array(n * n).fill(Infinity),
        valid = new Uint8Array(n * n);
      const indices = Array.from({ length: d.length }, (_, i) => i).sort((a, b) => d[b] - d[a]);
      for (const i of indices) {
        if (mask[i] !== 1 || truth[i] <= 0) continue;
        const u = ((i % scene.width) + 0.5) / scene.width,
          v = (Math.floor(i / scene.width) + 0.5) / scene.height;
        const r = direction(u, v),
          zz = r[2] * d[i];
        if (zz <= 0.05) continue;
        const xx = ((-r[0] * d[i] - offset) / zz) * f + n / 2,
          yy = ((-r[1] * d[i]) / zz) * f + n / 2;
        if (xx < -3 || yy < -3 || xx > n + 3 || yy > n + 3) continue;
        const color = [0, 1, 2].map(
          (c) => sample(photo.data, photo.width, photo.height, u, v, 4, c) / 255,
        );
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const x = Math.floor(xx) + dx,
              y = Math.floor(yy) + dy;
            if (x < 0 || y < 0 || x >= n || y >= n) continue;
            const at = y * n + x,
              dist = (x + 0.5 - xx) ** 2 + (y + 0.5 - yy) ** 2;
            if (dist > 5 || zz > z[at] + 0.12) continue;
            const alpha = Math.exp(-dist / 1.4);
            if (zz < z[at] - 0.12) {
              weights[at] = 0;
              rgb.fill(0, at * 3, at * 3 + 3);
            }
            for (let c = 0; c < 3; c++) rgb[3 * at + c] += color[c] * alpha;
            weights[at] += alpha;
            z[at] = zz;
            valid[at] = 1;
          }
      }
      for (let i = 0; i < n * n; i++)
        if (weights[i]) for (let c = 0; c < 3; c++) rgb[3 * i + c] /= weights[i];
      return { rgb, valid };
    };
    const novel = {};
    for (const offset of [0.3, 0.8]) {
      const ref = jpeg.decode(await fs.readFile(path.join(dir, "novel-" + offset + ".jpg")), {
        useTArray: true,
      });
      const exact = render(truth, offset),
        rebuilt = render(aligned.d, offset),
        one = render(baseline.d, offset);
      await fs.writeFile(path.join(evidence, scene.id + "-" + offset + "-mask.u8"), exact.valid);
      for (const [name, output] of [
        ["truth", exact],
        ["spherical", rebuilt],
        ["naive", one],
      ]) {
        const data = Buffer.alloc(256 * 256 * 4, 255);
        for (let i = 0; i < 256 * 256; i++)
          for (let c = 0; c < 3; c++) data[4 * i + c] = output.rgb[3 * i + c] * 255;
        await fs.writeFile(
          path.join(evidence, scene.id + "-" + offset + "-" + name + ".jpg"),
          jpeg.encode({ data, width: 256, height: 256 }, 95).data,
        );
      }
      novel[offset] = {
        spherical: ssim(rebuilt.rgb, ref.data, exact.valid),
        naive: ssim(one.rgb, ref.data, exact.valid),
        truthProjection: ssim(exact.rgb, ref.data, exact.valid),
      };
    }
    const row = {
      id: scene.id,
      spherical: metrics(aligned.d),
      naive: metrics(baseline.d),
      naive392: metrics(baseline392.d),
      seam: seamJumps(aligned.d),
      overlapDisagreement: inference.result.alignment.seamMedian,
      scale: aligned.scale,
      naiveScale: baseline.scale,
      naive392Scale: baseline392.scale,
      novel,
      inferenceMs: inference.ms,
    };
    results.push(row);
    console.log(JSON.stringify(row));
    await fs.writeFile(
      path.join(evidence, "scores.json"),
      JSON.stringify(
        {
          pipelineHash,
          note: "Actual WASM model: six 294-pixel perspective tiles plus four 294-pixel equirectangular yaw views, compared with independent one-tile 294 and 392 baselines; area-weighted depth metrics, per-method median scale calibration. Novel views use a software point-splat diagnostic and fixed source-visible masks, not the product GPU. Not physical-phone evidence.",
          scenes: results,
        },
        null,
        2,
      ) + "\n",
    );
  }
} finally {
  await browser.close();
  server.kill();
}
