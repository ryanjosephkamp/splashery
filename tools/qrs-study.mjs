#!/usr/bin/env node
// Lane QR lab r2: a parametric study of QR codes made of splats
// (docs/research/qr-splat-study-2026-10.md). It builds codes with the labs'
// own splat builder (src/qr-lab/splats.js) and damage (src/qr-lab/damage.js),
// renders them with a software Gaussian splat rasterizer
// (tools/qrs-study/raster.mjs), photographs them with the QR scan lab's
// phone-like captures (tools/qr-scan-lab/sim.mjs) and reads every photo with
// three readers (jsQR, zxing-js and zxing-cpp). A read counts only when the
// text is exactly right.
//
//   node tools/qrs-study.mjs [flags]
//
// Flags:
//   --grid=small|full|tiny  how finely and how often (default small; the
//                           report is the full grid)
//   --only=a,b              run only these parts: sweeps (every variable),
//                           damage (the damage sweeps), shapes, micro, rgb,
//                           engine (needs the app served on port 4173 and
//                           SPLASHERY_CHROMIUM), or variable ids and id
//                           prefixes (gap, opacity, dmg-tear, alive, …).
//                           Default: sweeps, damage, shapes, micro, rgb.
//   --trials=N              trials per cell (default: the grid's)
//   --jobs=N                worker threads (default: the CPU count, up to 8)
//   --out=DIR               where to write (default: the report's data folder
//                           for --grid=full, else .cache/qrs-study/<grid>)
//   --summarize             only rebuild the summary, thresholds and charts
//                           from DIR/sweeps.csv.gz
//   --list                  list the variables and exit
//
// Writes, in DIR: sweeps.csv.gz (one row per capture), summary.json,
// cells.csv.gz (scan rate with Wilson 95% intervals per cell), thresholds.csv,
// blocks.csv (how well the block verdict predicts the readers), charts/*.svg,
// and for the other parts shapes.csv, shapes/*.png, micro.csv, micro/*.png,
// rgb.csv, rgb/*.png, engine.csv.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { Worker } from "node:worker_threads";
import { variables, grid } from "./qrs-study/variables.mjs";
import { TEXTS, LEVELS, stepsFor, toCSV } from "./qrs-study/core.mjs";
import { summarize } from "./qrs-study/summary.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
  if (!a) return def;
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : true;
};
const gridName = opt("grid", "small");
const G = grid(gridName);
const VARS = variables();
if (opt("list")) {
  for (const v of VARS) console.log(`${v.id.padEnd(24)} ${v.group.padEnd(7)} ${v.values.length} steps  ${v.label}`); // prettier-ignore
  process.exit(0);
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.resolve(
  opt("out", gridName === "full" ? path.join(root, "docs/research/qr-splat-study-2026-10") : path.join(root, ".cache/qrs-study", gridName)), // prettier-ignore
);
fs.mkdirSync(out, { recursive: true });
const only = String(opt("only", "sweeps,damage,shapes,micro,rgb")).split(",").filter(Boolean);
const wants = (part) => only.includes(part);
const jobsN = Number(opt("jobs", Math.min(8, os.cpus().length)));

function pickVars() {
  return VARS.filter(
    (v) =>
      (wants("sweeps") && v.group !== "damage") ||
      (wants("damage") && v.group === "damage") ||
      only.some((o) => v.id === o || v.id.startsWith(o + "-") || (o.length > 3 && v.id.startsWith(o))), // prettier-ignore
  );
}

async function runPool(jobs, onProgress) {
  const rows = [];
  const chunk = 4;
  let next = 0;
  let done = 0;
  const workers = [];
  await new Promise((resolve, reject) => {
    let live = Math.min(jobsN, Math.ceil(jobs.length / chunk)) || 0;
    if (!live) return resolve();
    for (let i = 0; i < live; i++) {
      const w = new Worker(new URL("./qrs-study/worker.mjs", import.meta.url));
      workers.push(w);
      const feed = () => {
        if (next >= jobs.length) {
          w.terminate();
          if (--live === 0) resolve();
          return;
        }
        const part = jobs.slice(next, next + chunk);
        next += chunk;
        w.postMessage(part);
      };
      w.on("message", (m) => {
        if (m !== "ready") {
          rows.push(...m);
          done += chunk;
          onProgress?.(Math.min(done, jobs.length), jobs.length);
        }
        feed();
      });
      w.on("error", reject);
    }
  });
  return rows;
}

const COLS = ["variable", "value", "x", "level", "text", "version", "trial", "cond", "jsqr", "zxing", "zxingcpp", "blocks", "wrong", "lostMax", "fixable", "finders", "format", "ms"]; // prettier-ignore

function readRows(file) {
  const lines = zlib.gunzipSync(fs.readFileSync(file)).toString().trim().split("\n");
  const head = lines.shift().split(",");
  const num = new Set(["value", "x", "version", "trial", "jsqr", "zxing", "zxingcpp", "blocks", "wrong", "lostMax", "fixable", "finders", "format", "ms"]); // prettier-ignore
  return lines.map((l) => {
    const c = l.split(",");
    const r = {};
    head.forEach((h, i) => (r[h] = num.has(h) && c[i] !== "" ? Number(c[i]) : c[i]));
    return r;
  });
}

const t0 = Date.now();
const meta = {
  date: new Date().toISOString().slice(0, 10),
  grid: gridName,
  node: process.version,
  cpus: os.cpus().length,
  jobs: jobsN,
  texts: Object.fromEntries(Object.entries(TEXTS).map(([k, t]) => [k, { chars: t.length, versions: Object.fromEntries(LEVELS.map((l) => [l, stepsFor(t, l).version])) }])), // prettier-ignore
};

if (opt("summarize")) {
  const rows = readRows(path.join(out, "sweeps.csv.gz"));
  const prev = fs.existsSync(path.join(out, "summary.json")) ? JSON.parse(fs.readFileSync(path.join(out, "summary.json"))).meta : {}; // prettier-ignore
  await summarize(rows, VARS, out, { ...meta, ...prev });
  console.log(`summarized ${rows.length} rows in ${out}`);
  process.exit(0);
}

const vars = pickVars();
if (vars.length) {
  const jobs = [];
  for (const v of vars) {
    const trials = Number(opt("trials", G.trials(v)));
    for (const value of G.values(v))
      for (const level of G.levels)
        for (const text of G.texts(v))
          for (let trial = 0; trial < trials; trial++)
            jobs.push({ variable: v.id, value, x: v.x(value), level, text, trial, conds: G.conds(v) }); // prettier-ignore
  }
  // Interleave the heavy and light jobs across workers.
  jobs.sort((a, b) => a.trial - b.trial || 0);
  console.log(`${vars.length} variables, ${jobs.length} codes, ${jobs.reduce((n, j) => n + j.conds.length, 0)} captures, ${jobsN} workers`); // prettier-ignore
  let last = 0;
  const rows = await runPool(jobs, (d, n) => {
    if (Date.now() - last > 15000) {
      last = Date.now();
      console.log(`  ${d}/${n} codes, ${Math.round((Date.now() - t0) / 1000)} s`);
    }
  });
  const secs = (Date.now() - t0) / 1000;
  // Keep earlier rows of variables this run didn't touch.
  const file = path.join(out, "sweeps.csv.gz");
  const ran = new Set(vars.map((v) => v.id));
  const kept = fs.existsSync(file) ? readRows(file).filter((r) => !ran.has(r.variable)) : [];
  const all = kept.concat(rows);
  all.sort((a, b) => (a.variable < b.variable ? -1 : a.variable > b.variable ? 1 : 0));
  fs.writeFileSync(file, zlib.gzipSync(toCSV(all, COLS)));
  const prev = fs.existsSync(path.join(out, "summary.json")) ? JSON.parse(fs.readFileSync(path.join(out, "summary.json"))).meta : {}; // prettier-ignore
  const runs = { ...(prev.runs || {}) };
  runs[only.join("+")] = { seconds: Math.round(secs), captures: rows.length, codes: jobs.length, at: new Date().toISOString() }; // prettier-ignore
  await summarize(all, VARS, out, { ...meta, runs, captures: all.length });
  console.log(`sweeps: ${rows.length} captures in ${secs.toFixed(0)} s (${((secs * 1000 * jobsN) / rows.length).toFixed(0)} ms per capture per worker)`); // prettier-ignore
}

if (wants("shapes")) {
  const { runShapes } = await import("./qrs-study/shapes.mjs");
  await runShapes(out, { trials: Number(opt("trials", gridName === "full" ? 5 : 2)) });
}
if (wants("micro")) {
  const { runMicro } = await import("./qrs-study/micro.mjs");
  await runMicro(out, { trials: Number(opt("trials", gridName === "full" ? 5 : 2)) });
}
if (wants("rgb")) {
  const { runRGB } = await import("./qrs-study/rgb.mjs");
  await runRGB(out, { grid: gridName, trials: Number(opt("trials", gridName === "full" ? 3 : 1)) }); // prettier-ignore
}
if (wants("engine")) {
  const { runEngine } = await import("./qrs-study/engine.mjs");
  await runEngine(out);
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${path.relative(root, out)}`);
