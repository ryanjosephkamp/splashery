#!/usr/bin/env node
// Build-time only. A model script is trusted executable Python; never run an unreviewed script.
import fs from "node:fs/promises";
import os from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readPack, positive, validateResult } from "./refblend/contract.mjs";
import { runCommand } from "./refblend/process.mjs";
import { geometry } from "./refblend/splats.mjs";
import { MODEL_BUDGETS } from "../src/packs/studio-models-core.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const exists = async (p) => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};
export function parseArgs(args) {
  const values = {},
    positional = [];
  const known = new Set([
    "minutes",
    "quality",
    "out",
    "size",
    "samples",
    "seed",
    "blender",
    "engine",
    "phone",
    "desktop",
    "bake-size",
  ]);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const [key, ...rest] = a.slice(2).split("=");
    if (!known.has(key)) throw new Error(`Unknown option: --${key}`);
    values[key] = rest.length ? rest.join("=") : args[++i];
    if (!values[key] || values[key].startsWith("--")) throw new Error(`Missing --${key} value`);
  }
  if (positional.length !== 2) throw new Error("Expected <pack> <model.py>; use --help");
  for (const key of ["minutes", "size", "samples", "phone", "desktop", "bake-size"])
    if (values[key] !== undefined) positive(Number(values[key]), key);
  for (const key of ["size", "samples", "phone", "desktop", "bake-size", "seed"])
    if (values[key] !== undefined && !Number.isSafeInteger(Number(values[key])))
      throw new Error(`${key} must be an integer`);
  if (values.seed !== undefined && (Number(values.seed) < 0 || Number(values.seed) > 4294967295))
    throw new Error("seed must be between 0 and 4294967295");
  if (values.quality && !["draft", "good", "best"].includes(values.quality))
    throw new Error("quality must be draft, good, or best");
  if (values.engine && !["CYCLES", "BLENDER_EEVEE_NEXT"].includes(values.engine))
    throw new Error("engine must be CYCLES or BLENDER_EEVEE_NEXT");
  return { ...values, packDir: path.resolve(positional[0]), model: path.resolve(positional[1]) };
}
export async function build(options) {
  const start = Date.now();
  const pack = await readPack(options.packDir);
  await fs.access(options.model);
  const minutes = Number(options.minutes ?? pack.budget.minutes);
  const deadline = start + minutes * 60000;
  const quality = options.quality || pack.budget.quality;
  const defaults = { draft: [256, 4, 64], good: [256, 16, 256], best: [256, 64, 512] }[quality];
  const out = path.resolve(
    options.out || path.join(os.tmpdir(), `refblend-${pack.id}-${Date.now()}`),
  );
  // Avoid overwriting private pictures, input scripts, or an earlier successful run.
  if (await exists(out)) throw new Error(`Output already exists; choose a fresh --out: ${out}`);
  await fs.mkdir(path.dirname(out), { recursive: true });
  const realParent = await fs.realpath(path.dirname(out));
  if (
    pack.license.images === "private" &&
    (realParent === root || realParent.startsWith(root + path.sep))
  )
    throw new Error("Private picture results must stay outside the repository");
  const blender = options.blender || process.env.BLENDER_BIN || "blender";
  const stage = await fs.mkdtemp(path.join(path.dirname(out), ".refblend-incomplete-"));
  if (process.env.REFBLEND_SUPERVISED) console.log(`Incomplete evidence: ${stage}`);
  const log = path.join(stage, "build.log");
  const seed = Number(options.seed ?? 1);
  const phone = Number(options.phone ?? MODEL_BUDGETS.low),
    desktop = Number(options.desktop ?? MODEL_BUDGETS.high);
  const exec = (cmd, argv) =>
    runCommand(cmd, argv, {
      deadline,
      log,
      cwd: stage,
      detached: !process.env.REFBLEND_SUPERVISED,
    });
  try {
    await fs.mkdir(path.join(stage, "parts"));
    const input = path.join(stage, "input");
    await fs.mkdir(input);
    // Copy only public inputs; no truth file or private scorer metadata reaches PACK_DIR.
    for (const img of pack.images)
      for (const file of [img.file, img.mask].filter(Boolean)) {
        const dest = path.join(input, file);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(path.join(options.packDir, file), dest);
      }
    await fs.writeFile(path.join(input, "pack.json"), JSON.stringify(pack, null, 2) + "\n");
    await fs.copyFile(options.model, path.join(stage, "model.py"));
    const job = {
      pack,
      packDir: input,
      model: path.join(stage, "model.py"),
      output: stage,
      quality,
      seed,
      size: Number(options.size ?? defaults[0]),
      samples: Number(options.samples ?? defaults[1]),
      bakeSize: Number(options["bake-size"] ?? defaults[2]),
      engine: options.engine || "CYCLES",
    };
    await fs.writeFile(path.join(stage, "job.json"), JSON.stringify(job));
    await exec(blender, [
      "--background",
      "--factory-startup",
      "--python-exit-code",
      "1",
      "--python",
      path.join(here, "refblend/run.py"),
      "--",
      path.join(stage, "job.json"),
    ]);
    const model = JSON.parse(await fs.readFile(path.join(stage, "model.json")));
    const whole = await geometry(path.join(stage, "result.glb"));
    const convert = async (mesh, file, count) => {
      const dest = path.join(stage, file);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await exec(process.execPath, [
        path.join(here, "refblend/convert.mjs"),
        path.join(stage, mesh),
        dest,
        String(count),
        String(seed),
        JSON.stringify(whole),
      ]);
      const bytes = await fs.readFile(dest);
      return Number(
        bytes
          .subarray(0, bytes.indexOf("end_header\n"))
          .toString()
          .match(/element vertex (\d+)/)[1],
      );
    };
    const components = [
      ...(model.static ? [{ name: "static", mesh: "static.glb", file: "static.ply" }] : []),
      ...model.parts.map((p) => ({ ...p, file: `parts/${p.name}.ply` })),
    ];
    const measures = await Promise.all(components.map((c) => geometry(path.join(stage, c.mesh))));
    const area = measures.reduce((s, m) => s + m.area, 0);
    const result = {
      schema: 1,
      pack: pack.id,
      builder: "blender",
      minutes: 0,
      status: "complete",
      credit: "Codex (GPT-6)",
      quality,
      seed,
      coordinates: "normalized-y-up",
      mesh: "result.glb",
      splat: "result.ply",
      normalization: { centerMeters: whole.center, radiusMeters: whole.radius },
      ...(model.static ? { static: "static.ply" } : {}),
      tiers: {},
      parts: model.parts.map((p) => ({
        ...p,
        file: `parts/${p.name}.ply`,
        pivot: p.pivotMeters.map((v, k) => (v - whole.center[k]) / whole.radius),
      })),
      license: pack.license,
      materials:
        "Procedural base colors baked to textures; GLB keeps roughness and metallic factors. Splats are opaque, unlit surfaces.",
    };
    for (const [tier, count, prefix] of [
      ["desktop", desktop, ""],
      ["phone", phone, "phone/"],
    ]) {
      if (count < components.length) throw new Error("Splat budget must cover every component");
      const emittedSplats = await convert("result.glb", `${prefix}result.ply`, count);
      const componentCounts = [];
      let remaining = count;
      for (const [i, c] of components.entries()) {
        const n =
          i === components.length - 1
            ? remaining
            : Math.max(
                1,
                Math.min(
                  remaining - (components.length - i - 1),
                  Math.round((count * measures[i].area) / area),
                ),
              );
        remaining -= n;
        componentCounts.push({
          file: `${prefix}${c.file}`,
          splats: await convert(c.mesh, `${prefix}${c.file}`, n),
        });
      }
      result.tiers[tier] = {
        splats: count,
        emittedSplats,
        components: componentCounts,
        file: `${prefix}result.ply`,
        ...(model.static ? { static: `${prefix}static.ply` } : {}),
        parts: model.parts.map((p) => ({ name: p.name, file: `${prefix}parts/${p.name}.ply` })),
      };
    }
    const hash = async (file) =>
      createHash("sha256")
        .update(await fs.readFile(file))
        .digest("hex");
    result.provenance = {
      blender: model.blenderVersion,
      modelSha256: await hash(path.join(stage, "model.py")),
      inputs: await Promise.all(
        ["pack.json", ...new Set(pack.images.flatMap((p) => [p.file, p.mask].filter(Boolean)))].map(
          async (file) => ({ file, sha256: await hash(path.join(input, file)) }),
        ),
      ),
      meshSha256: await hash(path.join(stage, "result.glb")),
      splatSha256: await hash(path.join(stage, "result.ply")),
    };
    result.minutes = (Date.now() - start) / 60000;
    validateResult(result, pack);
    await fs.writeFile(path.join(stage, "result.json"), JSON.stringify(result, null, 2) + "\n");
    const sharedScorer = path.join(here, "refpack-score.mjs");
    if (await exists(sharedScorer)) {
      await exec(process.execPath, [sharedScorer, options.packDir, stage]);
      result.scorer = "refpack-score";
    } else {
      await exec(process.execPath, [path.join(here, "refblend/score-worker.mjs"), input, stage]);
      result.scorer = "refblend-score-lite";
    }
    result.minutes = (Date.now() - start) / 60000;
    if (Date.now() > deadline) throw new Error("Build budget deadline reached");
    await fs.writeFile(path.join(stage, "result.json"), JSON.stringify(result, null, 2) + "\n");
    await fs.unlink(path.join(stage, "job.json"));
    await fs.rename(stage, out);
    return { out, result };
  } catch (e) {
    await fs.writeFile(
      path.join(stage, "failure.json"),
      JSON.stringify(
        {
          status: /budget|deadline/.test(e.message) ? "timed-out" : "failed",
          error: e.message,
          minutes: (Date.now() - start) / 60000,
        },
        null,
        2,
      ),
    );
    throw new Error(`${e.message}\nIncomplete evidence: ${stage}`);
  }
}
async function main() {
  if (process.argv.includes("--help")) {
    console.log(
      "Usage: node tools/refbuild-blender.mjs <pack> <model.py> --minutes=N [--quality=draft|good|best] [--out=/outside/repo/result] [--blender=/path/blender] [--size=256] [--samples=16] [--bake-size=256] [--seed=1] [--phone=90000] [--desktop=300000] [--engine=CYCLES]",
    );
    return;
  }
  const options = parseArgs(process.argv.slice(2));
  const start = Date.now();
  const pack = await readPack(options.packDir);
  const logDir = await fs.mkdtemp(path.join(os.tmpdir(), "refblend-supervisor-"));
  const log = path.join(logDir, "build.log");
  // A separate supervisor also caps synchronous geometry parsing and report work.
  try {
    await runCommand(
      process.execPath,
      [
        path.join(here, "refblend/build-worker.mjs"),
        JSON.stringify(options),
        path.join(logDir, "completed.json"),
      ],
      { deadline: start + Number(options.minutes ?? pack.budget.minutes) * 60000, log },
    );
  } catch (e) {
    throw new Error(`${e.message}\n${(await fs.readFile(log, "utf8")).slice(-4000)}`);
  }
  const { out, result } = JSON.parse(
    await fs.readFile(path.join(logDir, "completed.json"), "utf8"),
  );
  console.log(
    `${out}\n${result.minutes.toFixed(3)} minutes; ${result.scorer}; open report.html and edit model.py for the next run.`,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
