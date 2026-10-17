#!/usr/bin/env node
// Full independent run: builder inputs are physically copied without truth/.
// Raw reports and draft/best results remain in .cache/, outside git.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPack, localFile } from "./refpack.mjs";
import { SAMPLES } from "./refpack-samples.mjs";
import { buildKit } from "./refbuild-kit.mjs";
import { scorePack } from "./refpack-score.mjs";
import { renderer } from "./refpack-render.mjs";

const median = (a) => {
  const b = a.slice().sort((x, y) => x - y);
  return b[Math.floor(b.length / 2)];
};
export function qualityGates(summary) {
  const good = summary.summaries.find((s) => s.quality === "good");
  if (!good) return null;
  return {
    silhouette: {
      required: 0.85,
      actual: good.medianSilhouetteIoU,
      passed: good.medianSilhouetteIoU >= 0.85,
    },
    volumeEach: {
      required: 0.6,
      actualMinimum: good.minimumVolumeIoU,
      passed: good.minimumVolumeIoU >= 0.6,
    },
    passed: good.medianSilhouetteIoU >= 0.85 && good.minimumVolumeIoU >= 0.6,
  };
}
export async function benchmark({ qualities = ["draft", "good", "best"], size = 192 } = {}) {
  const rows = [],
    budgets = { draft: 2, good: 30, best: 120 };
  const service = await renderer({ timeoutMs: 7200000 });
  try {
    for (const quality of qualities)
      for (const sample of SAMPLES) {
        const original = path.resolve("tools/refpack-samples", sample.id),
          pack = loadPack(original);
        const publicDir = path.resolve(".cache/refpack-benchmark/inputs", quality, sample.id);
        fs.mkdirSync(publicDir, { recursive: true });
        for (const image of pack.images)
          for (const file of [image.file, image.mask].filter(Boolean)) {
            const dest = path.join(publicDir, file);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(localFile(original, file), dest);
          }
        fs.writeFileSync(
          path.join(publicDir, "pack.json"),
          JSON.stringify({ ...pack, budget: { minutes: budgets[quality], quality } }, null, 2),
        );
        const out =
          quality === "good"
            ? path.join(original, "build")
            : path.resolve(".cache/refpack-benchmark/results", quality, sample.id);
        if (!fs.existsSync(path.join(out, "result.json")))
          await buildKit(publicDir, { minutes: budgets[quality], quality, out });
        const metadata = JSON.parse(fs.readFileSync(path.join(out, "result.json")));
        const scored = await scorePack(original, out, {
          size,
          cameraRounds: 1,
          renderService: service,
        });
        const row = {
          id: sample.id,
          quality,
          budgetMinutes: budgets[quality],
          minutes: metadata.minutes,
          score: scored.overall.score,
          silhouetteIoU: scored.overall.silhouetteIoU,
          volumeIoU: scored.geometry.volumeIoU,
          chamferNormalized: scored.geometry.chamferNormalized,
          perPictureIoU: scored.pictures.map((p) => p.silhouetteIoU),
          shapes: JSON.parse(fs.readFileSync(path.join(out, "model.json"))).shapes.map(
            (s) => s.type,
          ),
        };
        rows.push(row);
        // Rendered comparison reports are evidence, so move them outside git.
        if (quality === "good") {
          const report = path.resolve(".cache/refpack-benchmark/reports", `${sample.id}.html`);
          fs.mkdirSync(path.dirname(report), { recursive: true });
          fs.renameSync(path.join(out, "report.html"), report);
        }
        console.log(
          `${quality} ${sample.id}: IoU ${row.silhouetteIoU.toFixed(3)}, volume ${row.volumeIoU.toFixed(3)}, score ${row.score.toFixed(2)}, ${row.minutes.toFixed(2)} min`,
        );
        fs.writeFileSync(".cache/refpack-benchmark/progress.json", JSON.stringify(rows, null, 2));
      }
    const summaries = qualities.map((quality) => {
      const selected = rows.filter((r) => r.quality === quality);
      return {
        quality,
        budgetMinutes: budgets[quality],
        medianSilhouetteIoU: median(selected.map((r) => r.silhouetteIoU)),
        medianVolumeIoU: median(selected.map((r) => r.volumeIoU)),
        minimumVolumeIoU: Math.min(...selected.map((r) => r.volumeIoU)),
      };
    });
    const id = SAMPLES[2].id,
      dir = path.resolve("tools/refpack-samples", id),
      result = path.join(dir, "build");
    let stability = null;
    if (fs.existsSync(path.join(result, "score.json"))) {
      const first = JSON.parse(fs.readFileSync(path.join(result, "score.json"))).overall.score;
      const next = await scorePack(dir, result, { size, cameraRounds: 1, renderService: service });
      fs.renameSync(
        path.join(result, "report.html"),
        path.resolve(".cache/refpack-benchmark/reports", `${id}-repeat.html`),
      );
      stability = {
        id,
        first,
        second: next.overall.score,
        difference: Math.abs(first - next.overall.score),
        passed: Math.abs(first - next.overall.score) <= 0.5,
      };
    }
    const summary = {
      schema: 1,
      date: "2026-10-17",
      builder: "kit",
      credit: "Made by Ryan with Codex (GPT-6)",
      methodology:
        "Builder receives only copies of listed public inputs, no truth. Draft 2-minute, good 30-minute, and best 120-minute caps; runs stop on search convergence/limits. Six 192-pixel views, including a busy background with a supplied mask; cameras independently re-estimated. 40-cubed shared-frame volume grid. No claim of real-photo generalization.",
      summaries,
      stability,
      results: rows,
    };
    summary.gates = qualityGates(summary);
    fs.writeFileSync(
      "tools/refpack-samples/benchmark.json",
      JSON.stringify(summary, null, 2) + "\n",
    );
    return summary;
  } finally {
    await service.close();
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  benchmark()
    .then((s) => {
      console.log(JSON.stringify({ summaries: s.summaries, gates: s.gates }, null, 2));
      if (s.gates && !s.gates.passed) process.exitCode = 2;
    })
    .catch((e) => {
      console.error(e.stack);
      process.exitCode = 1;
    });
