#!/usr/bin/env node
// Fits data-only kit shapes to public observations. Never reads truth/.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadPack, observations } from "./refpack.mjs";
import { scaledObservation, scorePack } from "./refpack-score.mjs";
import { renderer } from "./refpack-render.mjs";
import { maskBounds } from "./refpack-image.mjs";
import { fitCamera, rasterMask, project } from "./refpack-camera.mjs";
import { silhouetteIoU } from "./refpack-metrics.mjs";
import { meshFromModel, plyFromKit, writeGLB } from "./refpack-geometry.mjs";
import { mulberry32 } from "../src/noise.js";
import { visualHullModel } from "./refbuild-kit-hull.mjs";

const TYPES = ["box", "rounded-box", "cylinder", "cone", "sphere", "lathe", "extrusion"];
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export function validateModel(model) {
  if (!model || !Array.isArray(model.shapes) || !model.shapes.length || model.shapes.length > 80)
    throw new Error("Initial model needs 1 to 80 shapes.");
  for (const s of model.shapes) {
    if (
      !TYPES.includes(s.type) ||
      !Array.isArray(s.size) ||
      s.size.length !== 3 ||
      s.size.some((x) => !Number.isFinite(x) || x <= 0)
    )
      throw new Error("Invalid shape type or size.");
    for (const k of ["pos", "rot", "color"])
      if (
        s[k] &&
        (!Array.isArray(s[k]) || s[k].length !== 3 || s[k].some((x) => !Number.isFinite(x)))
      )
        throw new Error(`Invalid shape ${k}.`);
    if (
      s.type === "lathe" &&
      (!Array.isArray(s.profile) ||
        s.profile.length < 2 ||
        s.profile.some((p) => p.length !== 2 || !p.every(Number.isFinite) || p[0] < 0))
    )
      throw new Error("Lathe needs finite [radius, y] profile points.");
    if (
      s.type === "extrusion" &&
      (!Array.isArray(s.outline) ||
        s.outline.length < 2 ||
        s.outline.some((r) => r.length !== 3 || !r.every(Number.isFinite) || r[0] > r[1]))
    )
      throw new Error("Extrusion needs [left, right, y] rows.");
  }
  return model;
}
function dimensions(pack, obs) {
  let d;
  if (pack.size) d = [pack.size.width, pack.size.height, pack.size.depth];
  else {
    const front = obs.find((o) => o.entry.view === "front") || obs[0];
    const side = obs.find((o) => ["left", "right"].includes(o.entry.view));
    const b = maskBounds(front.mask, front.image.width, front.image.height);
    const s = side && maskBounds(side.mask, side.image.width, side.image.height);
    d = [b.width / b.height, 1, s ? s.width / s.height : (b.width / b.height) * 0.7];
  }
  const radius = Math.hypot(...d) / 2;
  return d.map((x) => x / radius);
}
function outlineFromMask(o, rows = 24) {
  const { width: w, height: h } = o.image,
    b = maskBounds(o.mask, w, h);
  const outline = [];
  for (let j = 0; j <= rows; j++) {
    const y = Math.min(b.y1, Math.round(b.y0 + (j / rows) * (b.height - 1)));
    let left = w,
      right = -1;
    for (let x = 0; x < w; x++)
      if (o.mask[y * w + x]) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    if (right >= left)
      outline.push([
        (left - (b.x0 + b.x1) / 2) / b.width,
        (right + 1 - (b.x0 + b.x1) / 2) / b.width,
        0.5 - j / rows,
      ]);
  }
  // Monotone bottom-to-top ordering for both lathe and extrusion.
  return outline.reverse();
}
function initialModels(pack, obs, size, quality) {
  const facing =
    obs.find((o) => o.entry.view === "front") || obs.find((o) => o.entry.view !== "top") || obs[0];
  const outline = outlineFromMask(facing),
    profile = outline.map(([l, r, y]) => [Math.max(0.01, (r - l) / 2), y]);
  const part = pack.moves?.[0]?.part || "body";
  const colors = [];
  for (let i = 0; i < facing.mask.length; i++)
    if (facing.mask[i])
      colors.push(Array.from(facing.image.data.slice(i * 4, i * 4 + 3), (x) => x / 255));
  const color = [0, 1, 2].map((k) => mean(colors.map((c) => c[k])));
  const models = TYPES.map((type) => ({
    schema: 1,
    shapes: [
      {
        type,
        size: size.slice(),
        pos: [0, 0, 0],
        rot: [0, 0, 0],
        color,
        part,
        ...(type === "lathe" ? { profile } : type === "extrusion" ? { outline } : {}),
      },
    ],
  }));
  const hull =
    visualHullModel(obs, size, part, color, { draft: 12, good: 24, best: 32 }[quality]) ||
    visualHullModel(obs, size, part, color, 12);
  if (hull) models.push(hull);
  return models;
}
function fitColors(model, obs, cameras) {
  const mesh = meshFromModel(model, 10);
  // Z-buffer of sampled vertices prevents coloring the hidden side from a
  // foreground pixel that belongs to another part. Unseen parts keep their color.
  const depthMaps = obs.map((o, i) => {
    const map = new Float64Array(o.mask.length).fill(Infinity);
    for (let k = 0; k < mesh.positions.length; k += 3) {
      const [x, y, z] = project(
        mesh.positions.slice(k, k + 3),
        cameras[i],
        o.image.width,
        o.image.height,
      );
      const xx = Math.round(x),
        yy = Math.round(y);
      if (xx >= 0 && yy >= 0 && xx < o.image.width && yy < o.image.height)
        map[yy * o.image.width + xx] = Math.min(map[yy * o.image.width + xx], z);
    }
    return map;
  });
  for (const s of model.shapes) {
    const points = meshFromModel({ shapes: [s] }, 10).positions,
      values = [[], [], []];
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      for (let k = 0; k < points.length; k += 9) {
        const [x, y, z] = project(
          points.slice(k, k + 3),
          cameras[i],
          o.image.width,
          o.image.height,
        );
        const xx = Math.round(x),
          yy = Math.round(y),
          at = yy * o.image.width + xx;
        if (
          xx < 0 ||
          yy < 0 ||
          xx >= o.image.width ||
          yy >= o.image.height ||
          !o.mask[at] ||
          z > depthMaps[i][at] + 0.1
        )
          continue;
        for (let j = 0; j < 3; j++) values[j].push(o.image.data[at * 4 + j] / 255);
      }
    }
    if (values[0].length)
      s.color = values.map((a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)]);
  }
}
export async function writeResult(out, pack, model, metadata, count = 12000) {
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "model.json"), JSON.stringify(model, null, 2) + "\n");
  fs.writeFileSync(path.join(out, "result.ply"), plyFromKit(model, count));
  await writeGLB(path.join(out, "result.glb"), meshFromModel(model));
  const parts = [];
  for (const move of model.moves || []) {
    fs.mkdirSync(path.join(out, "parts"), { recursive: true });
    fs.writeFileSync(
      path.join(out, "parts", `${move.part}.ply`),
      plyFromKit(model, Math.max(1000, Math.floor(count / model.moves.length)), move.part),
    );
    parts.push({
      name: move.part,
      file: `parts/${move.part}.ply`,
      pivot: move.pivot || [0, 0, 0],
      motion: { how: move.how, axis: move.axis, amount: move.amount },
    });
  }
  const helper = path
    .relative(out, path.resolve("src/refbuild/shapes.js"))
    .split(path.sep)
    .join("/");
  fs.writeFileSync(
    path.join(out, "recipe.mjs"),
    `// Made by Ryan with Codex (GPT-6). Code MIT. Reference license: ${JSON.stringify(pack.license.images)}.\n// Keep private inputs and derived outputs private.\nimport { modelRecipe } from ${JSON.stringify(helper.startsWith(".") ? helper : "./" + helper)};\nexport const MODEL = ${JSON.stringify(model, null, 2)};\nexport const RECIPES = { ${JSON.stringify(pack.id)}: modelRecipe(MODEL) };\n`,
  );
  fs.writeFileSync(
    path.join(out, "result.json"),
    JSON.stringify(
      {
        schema: 1,
        pack: pack.id,
        builder: "kit",
        ...metadata,
        parts,
        coordinates:
          "Y up, +Z front; initialized at AABB diagonal 2 and fitted in that shared frame; all parts retain it",
        license: pack.license.images,
        outputHashes: Object.fromEntries(
          ["result.ply", "result.glb", ...parts.map((p) => p.file)].map((file) => [
            file,
            crypto
              .createHash("sha256")
              .update(fs.readFileSync(path.join(out, file)))
              .digest("hex"),
          ]),
        ),
      },
      null,
      2,
    ) + "\n",
  );
}
export async function buildKit(
  packDir,
  { minutes, quality, out, initial, maxEvaluations, renderChecks } = {},
) {
  const started = performance.now(),
    pack = loadPack(packDir);
  quality ||= pack.budget.quality;
  minutes = Math.min(minutes ?? pack.budget.minutes, pack.budget.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0 || !["draft", "good", "best"].includes(quality))
    throw new Error("Use positive minutes and quality draft, good, or best.");
  const deadline = started + minutes * 60000,
    reserve = Math.min(5000, minutes * 6000),
    searchDeadline = deadline - reserve;
  out ||= path.resolve(".cache/refbuild", pack.id, quality);
  if (fs.existsSync(path.join(out, "result.json")))
    throw new Error(`Result already exists; choose another --out: ${out}`);
  const obs = observations(packDir, pack).map((o) =>
    scaledObservation(o, quality === "draft" ? 40 : 56),
  );
  if (!initial && (pack.moves || []).length > 1)
    throw new Error(
      "Multiple moving parts need an --init=model.json with named shapes; name and place them by reading the pictures.",
    );
  let models = initial
    ? [validateModel(JSON.parse(fs.readFileSync(initial, "utf8")))]
    : initialModels(pack, obs, dimensions(pack, obs), quality);
  let best,
    cameras,
    value = -1,
    evaluations = 0;
  const history = [],
    rand = mulberry32(113);
  const evaluate = (model, poses) => {
    const mesh = meshFromModel(model, 12);
    const views =
      poses || obs.map((o) => fitCamera(mesh, o, null, { rounds: 2, deadline: searchDeadline }));
    const scores = obs.map((o, i) =>
      silhouetteIoU(o.mask, rasterMask(mesh, views[i], o.image.width, o.image.height)),
    );
    evaluations++;
    // Penalize the worst view, so one product angle cannot hide a bad back.
    return { value: 0.8 * mean(scores) + 0.2 * Math.min(...scores), cameras: views, scores };
  };
  for (const model of models) {
    if (best && performance.now() >= searchDeadline) break;
    const fit = evaluate(model);
    if (fit.value > value) {
      best = structuredClone(model);
      value = fit.value;
      cameras = fit.cameras;
    }
  }
  const limits = { draft: 60, good: 400, best: 1800 };
  const limit = maxEvaluations ?? limits[quality];
  let lastImprovement = evaluations;
  while (evaluations < limit && performance.now() < searchDeadline) {
    const candidate = structuredClone(best),
      shape = candidate.shapes[Math.floor(rand() * candidate.shapes.length)];
    const progress = evaluations / limit,
      step = 0.18 * (1 - progress) + 0.015;
    const axis = Math.floor(rand() * 3),
      change = (rand() * 2 - 1) * step;
    const kind = rand();
    if (kind < 0.4) shape.size[axis] = Math.max(0.025, shape.size[axis] * (1 + change));
    else if (kind < 0.65) shape.pos[axis] += change;
    else if (kind < 0.8) shape.rot[axis] += change * 55;
    else if (shape.type === "lathe") {
      const j = Math.floor(rand() * shape.profile.length);
      shape.profile[j][0] = Math.max(0.01, shape.profile[j][0] + change * 0.5);
    } else if (shape.type === "extrusion") {
      const j = Math.floor(rand() * shape.outline.length),
        side = Math.floor(rand() * 2);
      shape.outline[j][side] += change * 0.3;
      shape.outline[j][1] = Math.max(shape.outline[j][0] + 0.01, shape.outline[j][1]);
    }
    const fit = evaluate(candidate, cameras);
    if (fit.value > value + 1e-5) {
      best = candidate;
      value = fit.value;
      lastImprovement = evaluations;
      history.push({ evaluation: evaluations, silhouetteObjective: value });
    }
    if (evaluations % 40 === 0 && performance.now() < searchDeadline) {
      const mesh = meshFromModel(best, 12);
      cameras = obs.map((o, i) =>
        fitCamera(mesh, o, cameras[i], { rounds: 2, deadline: searchDeadline }),
      );
      value = evaluate(best, cameras).value;
    }
    if (evaluations - lastImprovement > (quality === "best" ? 400 : 140)) break;
  }
  fitColors(best, obs, cameras);
  best.moves = (pack.moves || []).map((m) => {
    const shapes = best.shapes.filter((s) => s.part === m.part);
    if (!shapes.length)
      throw new Error(`No geometry belongs to moving part ${m.part}; fix the initial model.`);
    return {
      ...m,
      pivot: best.moves?.find((x) => x.part === m.part)?.pivot || shapes[0].pos || [0, 0, 0],
    };
  });
  // A reviewable checkpoint survives a CLI deadline or a renderer failure.
  await writeResult(
    out,
    pack,
    best,
    {
      minutes: (performance.now() - started) / 60000,
      quality,
      budgetMinutes: minutes,
      status: "checkpoint",
      evaluations,
      inputs: ["pack.json", ...pack.images.flatMap((i) => [i.file, ...(i.mask ? [i.mask] : [])])],
    },
    quality === "draft" ? 6500 : 16000,
  );
  // Correct the proxy's splat-size bias with real-renderer coordinate search.
  // Truth is disabled explicitly; only the public images and masks are scored.
  const realFits = [];
  renderChecks ??= { draft: 2, good: 8, best: 20 }[quality];
  if (renderChecks && searchDeadline - performance.now() > 12000) {
    const service = await renderer({ timeoutMs: searchDeadline - performance.now() });
    fs.mkdirSync(".cache", { recursive: true });
    const trial = fs.mkdtempSync(path.join(path.resolve(".cache"), "refpack-trial-"));
    try {
      let realBest = -1;
      for (let i = 0; i < renderChecks && searchDeadline - performance.now() > 7000; i++) {
        const candidate = structuredClone(best);
        if (i) {
          const axis = Math.floor((i - 1) / 2) % 3,
            factor = i % 2 ? 0.96 : 1.04;
          for (const shape of candidate.shapes) {
            shape.size[axis] *= factor;
            shape.pos[axis] *= factor;
          }
        }
        await writeResult(
          trial,
          pack,
          candidate,
          { minutes: (performance.now() - started) / 60000 },
          quality === "draft" ? 6500 : 16000,
        );
        const scored = await scorePack(packDir, trial, {
          size: 96,
          cameraRounds: 0,
          renderService: service,
          includeTruth: false,
        });
        const objective =
          0.8 * scored.overall.silhouetteIoU +
          0.2 * Math.min(...scored.pictures.map((p) => p.silhouetteIoU));
        realFits.push({
          candidate: i,
          silhouetteIoU: scored.overall.silhouetteIoU,
          score: scored.overall.score,
        });
        if (objective > realBest) {
          realBest = objective;
          best = candidate;
        }
      }
    } catch (e) {
      if (performance.now() < searchDeadline - 1000) throw e;
      realFits.push({ stopped: "renderer deadline; kept the best completed fit" });
    } finally {
      await service.close();
      fs.rmSync(trial, { recursive: true, force: true });
    }
  }
  // Writes a normal recipe, actual kit splats, and a triangulated companion
  // for volume tests. The recipe and PLY both use the same selected shapes.
  const count = quality === "draft" ? 6500 : 16000;
  await writeResult(
    out,
    pack,
    best,
    {
      minutes: (performance.now() - started) / 60000,
      quality,
      status: "complete",
      budgetMinutes: minutes,
      evaluations,
      objective: value,
      history,
      estimatedCameras: cameras,
      inputs: ["pack.json", ...pack.images.flatMap((i) => [i.file, ...(i.mask ? [i.mask] : [])])],
      realFits,
      optimization:
        "Deterministic perspective silhouette search with re-estimated cameras, followed by coordinate search against the real GSplat scorer (truth disabled).",
      stopped: performance.now() >= searchDeadline ? "budget" : "search limit or convergence",
    },
    count,
  );
  const elapsed = (performance.now() - started) / 60000;
  const metadataFile = path.join(out, "result.json"),
    metadata = JSON.parse(fs.readFileSync(metadataFile));
  metadata.minutes = elapsed;
  metadata.withinBudget = elapsed <= minutes;
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2) + "\n");
  return { out, model: best, metadata };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (!args[0]) {
    console.error(
      "Usage: node tools/refbuild-kit.mjs <pack> --minutes=N [--quality=draft|good|best] [--out=folder] [--init=model.json]",
    );
    process.exitCode = 1;
  } else {
    let watchdog;
    try {
      const budget = JSON.parse(fs.readFileSync(path.join(args[0], "pack.json"))).budget.minutes;
      const cap = Math.min(opt("minutes") === undefined ? budget : Number(opt("minutes")), budget);
      if (Number.isFinite(cap) && cap > 0) {
        watchdog = setTimeout(() => {
          console.error("Hard time cap reached; use the last completed checkpoint, if present.");
          process.exit(124);
        }, cap * 60000);
        watchdog.unref();
      }
    } catch {
      /* The normal checker below supplies the actionable error. */
    }
    buildKit(args[0], {
      minutes: opt("minutes") === undefined ? undefined : Number(opt("minutes")),
      quality: opt("quality"),
      out: opt("out"),
      initial: opt("init"),
    })
      .then(({ out, metadata }) =>
        console.log(
          `${out}: ${metadata.evaluations} fits in ${metadata.minutes.toFixed(3)} minutes; proxy silhouette ${metadata.objective.toFixed(3)}; run refpack-score.mjs next`,
        ),
      )
      .catch((e) => {
        console.error(e.stack);
        process.exitCode = 1;
      })
      .finally(() => clearTimeout(watchdog));
  }
}
