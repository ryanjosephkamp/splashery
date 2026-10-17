#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPack, observations, localFile } from "./refpack.mjs";
import { resize, readMask, maskImage, pngBytes } from "./refpack-image.mjs";
import { exposureMatch, scorePicture, silhouetteIoU } from "./refpack-metrics.mjs";
import { readMesh, readPlyPoints, plyFromMesh } from "./refpack-geometry.mjs";
import { fitCamera } from "./refpack-camera.mjs";
import { compare3d } from "./refpack-3d.mjs";
import { renderer } from "./refpack-render.mjs";

const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const dataURL = (p) => `data:image/png;base64,${pngBytes(p).toString("base64")}`;
const average = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export function scaledObservation(obs, size) {
  const factor = size / Math.max(obs.image.width, obs.image.height);
  const width = Math.max(8, Math.round(obs.image.width * factor)),
    height = Math.max(8, Math.round(obs.image.height * factor));
  return {
    ...obs,
    image: resize(obs.image, width, height),
    mask: readMask(resize(maskImage(obs.mask, obs.image.width, obs.image.height), width, height)),
  };
}
export async function loadResult(dir, pack) {
  const metadata = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8"));
  if (
    metadata.schema !== 1 ||
    metadata.pack !== pack.id ||
    typeof metadata.builder !== "string" ||
    !Number.isFinite(metadata.minutes) ||
    metadata.minutes < 0
  )
    throw new Error("Invalid result.json schema, pack, builder, or minutes.");
  const ply = fs.existsSync(path.join(dir, "result.ply")) ? localFile(dir, "result.ply") : null;
  const glb = fs.existsSync(path.join(dir, "result.glb")) ? localFile(dir, "result.glb") : null;
  if (!ply && !glb) throw new Error("Result needs result.ply or result.glb.");
  const mesh = glb ? await readMesh(glb) : readPlyPoints(fs.readFileSync(ply));
  return {
    metadata,
    mesh,
    bytes: ply
      ? fs.readFileSync(ply)
      : plyFromMesh(mesh.prep, 18000, { preserveCoordinates: true }),
  };
}
export async function scorePack(
  packDir,
  resultDir,
  { size = 192, cameraRounds = 1, renderService = null, includeTruth = true } = {},
) {
  if (
    !Number.isInteger(size) ||
    size < 32 ||
    size > 1024 ||
    !Number.isInteger(cameraRounds) ||
    cameraRounds < 0 ||
    cameraRounds > 5
  )
    throw new Error("Score size must be 32–1024 and camera rounds 0–5.");
  const pack = loadPack(packDir),
    result = await loadResult(resultDir, pack);
  const obs = observations(packDir, pack).map((o) => scaledObservation(o, size));
  const service = renderService || (await renderer());
  try {
    await service.load(result.bytes);
    const pairs = [];
    for (const o of obs) {
      const low = scaledObservation(o, 64);
      let camera = fitCamera(result.mesh, low);
      let render = await service.render(camera, o.image.width, o.image.height);
      let renderedMask = Uint8Array.from(
        { length: o.mask.length },
        (_, i) => +(render.data[i * 4 + 3] >= 128),
      );
      let best = silhouetteIoU(o.mask, renderedMask);
      for (let round = 0; round < cameraRounds; round++) {
        for (const [key, step] of [
          ["yaw", 0.06],
          ["pitch", 0.04],
          ["fov", 2],
          ["distance", camera.distance * 0.025],
        ])
          for (const sign of [-1, 1]) {
            const c = { ...camera, [key]: camera[key] + (sign * step) / (round + 1) };
            const r = await service.render(c, o.image.width, o.image.height);
            const m = Uint8Array.from(
              { length: o.mask.length },
              (_, i) => +(r.data[i * 4 + 3] >= 128),
            );
            const value = silhouetteIoU(o.mask, m);
            if (value > best) {
              camera = c;
              render = r;
              renderedMask = m;
              best = value;
            }
          }
      }
      // Composite on white for color/edge measurement; alpha defines silhouette.
      for (let i = 0; i < o.mask.length; i++) {
        const a = render.data[i * 4 + 3] / 255;
        for (let k = 0; k < 3; k++)
          render.data[i * 4 + k] = Math.round(render.data[i * 4 + k] * a + 255 * (1 - a));
        render.data[i * 4 + 3] = 255;
      }
      pairs.push({ photo: o.image, render, mask: o.mask, renderedMask, camera, observation: o });
    }
    const exposure = exposureMatch(pairs),
      reports = [];
    const pictures = pairs.map((pair) => {
      const { difference, ...scores } = scorePicture(pair, exposure);
      reports.push({ pair, difference, scores });
      return {
        file: pair.observation.entry.file,
        view: pair.observation.entry.view,
        camera: pair.camera,
        mask: { method: pair.observation.method, reviewRequired: pair.observation.review },
        ...scores,
      };
    });
    const overall = Object.fromEntries(
      ["score", "silhouetteIoU", "boundaryF1", "colorDeltaE2000", "colorScore", "edgeRecall"].map(
        (k) => [k, average(pictures.map((p) => p[k]))],
      ),
    );
    const score = {
      schema: 1,
      pack: pack.id,
      builder: result.metadata.builder,
      renderer: "Splashery Stage / vendored PlayCanvas 2.22.3 / WebGL2 / SwiftShader",
      size,
      exposure,
      weights: { silhouetteIoU: 0.5, boundaryF1: 0.2, color: 0.2, edgeRecall: 0.1 },
      pictures,
      overall,
    };
    // Truth is opened only here, after all 2D cameras and scores are fixed.
    const truthPath = path.join(packDir, "truth", "truth.json");
    if (includeTruth && fs.existsSync(truthPath)) {
      const truth = JSON.parse(fs.readFileSync(truthPath, "utf8"));
      const mesh = await readMesh(localFile(path.dirname(truthPath), truth.model));
      score.geometry = compare3d(result.mesh, mesh);
      score.geometry.truthModel = truth.model;
    }
    const warnings = pictures
      .filter((p) => p.mask.reviewRequired)
      .map((p) => `Review the automatically estimated mask for ${p.file}.`);
    score.warnings = warnings;
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(pack.name)} — reference report</title>
<style>body{font:16px system-ui;max-width:1100px;margin:32px auto;padding:0 16px;color:#202a32;background:#f5f3ed}h1{font-size:28px}.pictures{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0}img{width:100%;background:white;border-radius:8px}figcaption{font-size:13px}section{background:white;padding:20px;margin:20px 0;border-radius:12px}pre{white-space:pre-wrap}@media(max-width:600px){.pictures{grid-template-columns:1fr 1fr}}</style>
<h1>${esc(pack.name)}</h1><p>Kit or mesh reconstruction score: <strong>${overall.score.toFixed(2)}/100</strong>. Silhouette IoU ${(overall.silhouetteIoU * 100).toFixed(1)}%. Exposure ${exposure.toFixed(3)} (one scalar for all pictures).</p>
${warnings.map((w) => `<p role="alert">${esc(w)}</p>`).join("")}
<p>Mask: white is foreground. Difference: pink is missing geometry, blue is extra geometry, and red is overlap color error. Camera angles are radians; field of view is degrees.</p>
${reports
  .map(
    ({ pair, difference, scores }) =>
      `<section><h2>${esc(pair.observation.entry.file)} · ${scores.score.toFixed(1)}/100</h2><p>IoU ${scores.silhouetteIoU.toFixed(3)} · boundary F1 ${scores.boundaryF1.toFixed(3)} · ΔE00 ${scores.colorDeltaE2000.toFixed(2)} · edge recall ${scores.edgeRecall.toFixed(3)}</p><div class="pictures">${[
        [pair.photo, "Reference"],
        [maskImage(pair.mask, pair.photo.width, pair.photo.height), "Foreground mask"],
        [pair.render, "Render at the estimated camera"],
        [difference, "Difference"],
      ]
        .map(
          ([p, label]) =>
            `<figure><img src="${dataURL(p)}" alt="${label}"><figcaption>${label}</figcaption></figure>`,
        )
        .join(
          "",
        )}</div><details><summary>Estimated camera</summary><pre>${esc(JSON.stringify(pair.camera, null, 2))}</pre></details></section>`,
  )
  .join("")}
${score.geometry ? `<section><h2>Truth geometry</h2><pre>${esc(JSON.stringify(score.geometry, null, 2))}</pre></section>` : ""}
<p>Private reference reports inherit the pack's privacy. Keep this self-contained report outside git when pictures are private.</p></html>`;
    fs.mkdirSync(resultDir, { recursive: true });
    fs.writeFileSync(path.join(resultDir, "score.json"), JSON.stringify(score, null, 2) + "\n");
    fs.writeFileSync(path.join(resultDir, "report.html"), html);
    return score;
  } finally {
    if (!renderService) await service.close();
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [packDir, resultDir, ...args] = process.argv.slice(2);
  if (!packDir || !resultDir) {
    console.error(
      "Usage: node tools/refpack-score.mjs <pack> <result> [--size=192] [--camera-rounds=1]",
    );
    process.exitCode = 1;
  } else
    scorePack(packDir, resultDir, {
      size: Number(args.find((a) => a.startsWith("--size="))?.slice(7) || 192),
      cameraRounds: Number(args.find((a) => a.startsWith("--camera-rounds="))?.slice(16) ?? 1),
    })
      .then((s) =>
        console.log(
          `${s.pack}: ${s.overall.score.toFixed(2)}/100; silhouette IoU ${s.overall.silhouetteIoU.toFixed(3)}${s.geometry ? `; volume IoU ${s.geometry.volumeIoU?.toFixed(3) ?? "unavailable"}` : ""}`,
        ),
      )
      .catch((e) => {
        console.error(e.stack);
        process.exitCode = 1;
      });
}
