#!/usr/bin/env node
// Task 95: three adjacent main/candidate pairs per input and profile.
// Serve both checkouts with identical cached fixtures. The second pair reverses order.
// DISPLAY=:91 SPLASHERY_GL=llvmpipe SPLASHERY_CHROMIUM=/path/to/chromium \
//   node tools/pages-bench-matrix.mjs --main-ref=<served-main-commit>
// --main-url=http://127.0.0.1:4180/ --candidate-url=http://127.0.0.1:4173/
// --out=work/pages-r2; --report validates completed cached cases without launching browsers.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const reportOnly = process.argv.includes("--report");
const mainURL = arg("main-url", "http://127.0.0.1:4180/");
const candidateURL = arg("candidate-url", "http://127.0.0.1:4173/");
const motionSeconds = Number(arg("seconds", 10));
process.chdir(root);
const work = arg("out", "work/pages-r2");
fs.mkdirSync(work, { recursive: true });
const digest = (b) => crypto.createHash("sha256").update(b).digest("hex");
const runtimeFiles = [
  "src/packs/pictures.js",
  "src/pictures.js",
  "src/media.js",
  "src/picture-splats.js",
  "src/picture-surface.js",
  "src/player.js",
  "src/stage.js",
];
const runtimeHash = () => digest(Buffer.concat(runtimeFiles.map((f) => fs.readFileSync(f))));
const frozen = runtimeHash();
const toolHash = digest(fs.readFileSync("tools/pages-bench.mjs"));
const previousFile = `${work}/paired-main.json`;
const previous = fs.existsSync(previousFile) ? JSON.parse(fs.readFileSync(previousFile)) : null;
if (previous && (previous.candidateRuntimeSha256 !== frozen || previous.toolSha256 !== toolHash))
  throw Error("Cached measurements used different source. Choose a fresh output directory.");
const mainRef = arg("main-ref", previous?.baselineCommit);
if (!mainRef) throw Error("Provide --main-ref with the commit served by the baseline URL.");
if (previous && previous.motionWindowSeconds !== motionSeconds)
  throw Error("Cached motion window differs.");
if (previous && mainRef !== previous.baselineCommit) throw Error("Cached baseline commit differs.");
const revision =
  previous?.candidateCommit ||
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const groups = [
  ["phone", "picture-lab", "photo"],
  ["phone", "picture-lab", "chart"],
  ["phone", "picture-lab", "text"],
];
for (const profile of ["phone", "desktop"])
  for (const toy of ["picture-lab", "your-book", "photo-album"])
    for (const input of ["sample", "text", "photo", "chart"])
      if (!groups.some((g) => g[0] === profile && g[1] === toy && g[2] === input))
        groups.push([profile, toy, input]);
let child = null;
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => (child ? child.kill("SIGTERM") : process.exit(130)));
const records = { main: [], round2: [] };
let reference = null;
function save() {
  for (const label of ["main", "round2"])
    fs.writeFileSync(
      `${work}/paired-${label}.json`,
      JSON.stringify(
        {
          ...reference,
          toolSha256: toolHash,
          base: label === "main" ? mainURL : candidateURL,
          pairing: "Adjacent main/candidate runs per input and repeat; repeat 2 reverses order",
          groupOrder: groups,
          candidateCommit: revision,
          candidateRuntimeSha256: frozen,
          baselineCommit: mainRef,
          expectedRecords: 72,
          records: records[label],
        },
        null,
        2,
      ) + "\n",
    );
}
function read(file, group, label, repeat) {
  const d = JSON.parse(fs.readFileSync(file));
  if (d.records.length !== 1) throw Error(`Expected one case: ${file}`);
  const r = d.records[0];
  if (r.profile !== group[0] || r.toy !== group[1] || r.input !== group[2])
    throw Error("Wrong cached case");
  if (d.toolSha256 !== toolHash) throw Error("Tool changed");
  const fields = [
    "browser",
    "renderer",
    "protocolSha256",
    "fixtures",
    "profiles",
    "isolation",
    "memoryPoint",
    "inputPreparation",
    "motionWindowSeconds",
  ];
  if (
    reference &&
    JSON.stringify(fields.map((k) => d[k])) !== JSON.stringify(fields.map((k) => reference[k]))
  )
    throw Error("Measurement versions differ");
  reference ??= d;
  records[label].push({ ...r, comparisonRepeat: repeat, artifactDirectory: path.dirname(file) });
  save();
}
for (const group of groups) {
  for (let repeat = 1; repeat <= 3; repeat++) {
    for (const label of repeat === 2 ? ["round2", "main"] : ["main", "round2"]) {
      if (runtimeHash() !== frozen || digest(fs.readFileSync("tools/pages-bench.mjs")) !== toolHash)
        throw Error("Frozen source changed");
      const [profile, toy, input] = group;
      const initial = profile === "phone" && toy === "picture-lab" && input === "text";
      const dir = initial
        ? `${work}/paired-text/${repeat}-${label}`
        : `${work}/paired-final/${profile}/${toy}/${input}/${repeat}-${label}`;
      const file = `${dir}/results.json`;
      if (!fs.existsSync(file)) {
        if (reportOnly) throw Error(`Missing cached case: ${file}`);
        fs.mkdirSync(dir, { recursive: true });
        const fd = fs.openSync(`${dir}/run.log`, "w");
        const url = label === "main" ? mainURL : candidateURL;
        console.log(`Measuring ${profile}/${toy}/${input} ${repeat}/3 ${label}`);
        const code = await new Promise((resolve, reject) => {
          child = spawn(
            process.execPath,
            [
              "tools/pages-bench.mjs",
              `--url=${url}`,
              `--profiles=${profile}`,
              `--toys=${toy}`,
              `--cases=${input}`,
              "--repeats=1",
              `--seconds=${motionSeconds}`,
              `--out=${dir}`,
            ],
            { cwd: root, env: process.env, stdio: ["ignore", fd, fd] },
          );
          child.once("error", reject);
          child.once("close", resolve);
        });
        child = null;
        fs.closeSync(fd);
        if (code !== 0) throw Error(`Benchmark failed (${code}): ${dir}/run.log`);
      }
      read(file, group, label, repeat);
    }
  }
  console.log(`Completed group ${group.join("/")}: ${records.main.length}/72 per revision.`);
}
for (const label of ["main", "round2"])
  if (records[label].length !== 72) throw Error("Incomplete matrix");
const report = spawn(
  process.execPath,
  [
    "tools/pages-bench-report.mjs",
    `${work}/paired-main.json`,
    `${work}/paired-round2.json`,
    `${work}/paired-comparison.md`,
  ],
  { stdio: "inherit" },
);
process.exitCode = await new Promise((resolve) => report.once("close", resolve));
