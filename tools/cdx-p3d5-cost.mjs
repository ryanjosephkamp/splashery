// MIT; made by Ryan with Codex (GPT-6). Fresh-browser phone cost using the
// original task 87 timer, completion fence, cover check, and PSS sample window.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inventory, hash, ROOT } from "./p3df/inputs.mjs";

const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const name = process.argv[i];
  if (
    ![
      "--manifest",
      "--baseline-root",
      "--override",
      "--out",
      "--samples",
      "--repetitions",
      "--isolated",
    ].includes(name) ||
    !process.argv[i + 1]
  )
    throw new Error(
      "Use --manifest FILE --baseline-root CHECKOUT --override JSON --out DIR [--samples ID,ID] [--repetitions 5] [--isolated true]",
    );
  options[name.slice(2)] = process.argv[i + 1];
}
if (!options.manifest || !options["baseline-root"] || !options.override || !options.out)
  throw new Error("Manifest, baseline checkout, source overrides, and output folder are required.");
if (options.isolated && !["true", "false"].includes(options.isolated))
  throw new Error("Use --isolated true or false.");
const baseRoot = fs.realpathSync(options["baseline-root"]),
  out = path.resolve(options.out),
  repetitions = Number(options.repetitions || 5),
  all = inventory({ manifest: options.manifest }),
  wanted = options.samples?.split(","),
  entries = wanted ? all.filter((e) => wanted.includes(e.id)) : all;
if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error("Invalid repetition count.");
if (!entries.length || (wanted && new Set(wanted).size !== entries.length))
  throw new Error("Missing requested input.");
if (entries.some((e) => e.kind === "private"))
  throw new Error("This public-corpus research tool does not accept private inputs.");
let existingParent = out;
while (!fs.existsSync(existingParent)) existingParent = path.dirname(existingParent);
const actualOut = path.resolve(fs.realpathSync(existingParent), path.relative(existingParent, out));
if ([ROOT, baseRoot].some((r) => actualOut === r || actualOut.startsWith(r + path.sep)))
  throw new Error("Keep measurements outside both source checkouts.");
fs.mkdirSync(out, { recursive: true });
const baseTool = pathToFileURL(path.join(baseRoot, "tools/p3d-failures.mjs")),
  { fingerprint } = await import(baseTool.href),
  baseline = fingerprint(),
  self = fileURLToPath(import.meta.url),
  browserUrl = pathToFileURL(path.join(baseRoot, "tools/p3df/browser.mjs")),
  originalBrowser = fs.readFileSync(browserUrl, "utf8"),
  files = JSON.parse(fs.readFileSync(options.override)),
  mainModules = {},
  candidateModules = {};
for (const [name, file] of Object.entries(files)) {
  if (!/^src\/[a-zA-Z0-9/._-]+\.js$/.test(name) || name.split("/").includes(".."))
    throw new Error("An override must name an existing source module.");
  mainModules[name] = fs.readFileSync(path.join(baseRoot, name));
  candidateModules[name] = fs.readFileSync(file);
}
for (const e of entries)
  if (e.kind === "builtin")
    for (const [key, expected] of [
      ["file", e.sha256],
      ["depthFile", e.depthSha256],
    ]) {
      const relative = path.relative(ROOT, e[key]);
      if (
        !relative.startsWith("assets" + path.sep) ||
        hash(fs.readFileSync(path.join(baseRoot, relative))) !== expected
      )
        throw new Error("Original built-in bytes differ between checkouts: " + e.id);
    }
const candidate = structuredClone(baseline);
candidate.baseHead = baseline.head;
candidate.head = null;
for (const [name, bytes] of Object.entries(candidateModules)) candidate.files[name] = hash(bytes);
candidate.sha256 = hash(JSON.stringify(candidate.files));
const researchFolder = fs.realpathSync(path.dirname(path.resolve(options.manifest)));

function competingProcesses() {
  const found = [];
  for (const pid of fs.readdirSync("/proc").filter((p) => /^\d+$/.test(p))) {
    if (Number(pid) === process.pid) continue;
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8"),
        tail = stat.slice(stat.lastIndexOf(")") + 2).split(" "),
        command = stat.slice(stat.indexOf("(") + 1, stat.lastIndexOf(")")),
        args = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
      if (tail[0] === "Z") continue;
      const script = args.find((a) => /\.(mjs|py|js)$/.test(a));
      if (command === "chromium" || command === "chrome")
        found.push({ pid: Number(pid), kind: "browser", state: tail[0] });
      else if (
        ["node", "nodejs", "python", "python3"].includes(path.basename(args[0])) &&
        script &&
        !script.endsWith("serve-overrides.mjs") &&
        (args.some((a) => /playwright/.test(a)) ||
          args.some((a) => {
            const value = a.startsWith("--") && a.includes("=") ? a.slice(a.indexOf("=") + 1) : a;
            return value === researchFolder || value.startsWith(researchFolder + path.sep);
          }) ||
          /(?:screen|verify|study|queue|suite|cost|pilot|capture|clips|p3d-failures)/.test(
            path.basename(script),
          ))
      )
        found.push({ pid: Number(pid), kind: "audit or test", script: path.basename(script) });
    } catch {
      // A process may exit between the directory listing and the read.
    }
  }
  return found;
}
function assertIsolated() {
  const other = competingProcesses();
  if (options.isolated === "true" && other.length)
    throw new Error("Other audit, test, or browser processes are active: " + JSON.stringify(other));
  return other;
}
const isolationWitness = assertIsolated();

let adapted = originalBrowser;
function replace(before, after) {
  if (!adapted.includes(before)) throw new Error("Original finder changed; re-prove the adapter.");
  adapted = adapted.replace(before, after);
}
replace(
  "export async function localServer(entries) {",
  "export async function localServer(entries, modules = {}) {",
);
replace(
  "      let file = files.get(pathname);",
  `      const bytes = modules[pathname.slice(1)];
      if (bytes) {
        res.writeHead(200, {"Content-Type":"text/javascript","Cache-Control":"no-store"});
        res.end(bytes);
        return;
      }
      let file = files.get(pathname);`,
);
replace(
  "    state.browser = browser.version();",
  `    state.browser = browser.version();
    if (!state.sharp.on || timing.backgroundPending || errors.length || externalRequests.length)
      throw new Error("Incomplete or failed first Sharp view.");
    if (JSON.stringify(state.native) !== "[585,1266]")
      throw new Error("The phone drawing buffer changed.");
    if (!samples.length || samples.some(s => !Number.isFinite(s.pssBytes) || s.unavailable.length))
      throw new Error("PSS sampling was incomplete.");
    return {...state,timing,memory:{samplingMs:200,
      window:"Immediately before input/selection through first new Sharp frame and five subsequent frames; shorter transients may be missed",
      peakPssBytes:Math.max(...samples.map(s=>s.pssBytes)),
      peakRssBytes:Math.max(...samples.map(s=>s.rssBytes)),samples},errors,externalRequests};`,
);
adapted = adapted.replace(
  /from "([^"]+)"/g,
  (_, name) =>
    `from ${JSON.stringify(name.startsWith(".") ? new URL(name, browserUrl).href : import.meta.resolve(name))}`,
);
const methods = {
  tool: hash(fs.readFileSync(self)),
  originalBrowser: hash(originalBrowser),
  adaptedBrowser: hash(adapted),
  memory: hash(fs.readFileSync(path.join(baseRoot, "tools/p3df/memory.mjs"))),
  config: hash(fs.readFileSync(path.join(baseRoot, "playwright.config.mjs"))),
};
const { localServer, measureProfile } = await import(
  "data:text/javascript;base64," + Buffer.from(adapted).toString("base64")
);
const settings = {
  depth: 0.5,
  profile: "phone",
  repetitions,
  isolated: options.isolated === "true",
  order:
    "Input order per repetition; main/candidate order alternates by input index plus repetition.",
  serving:
    "Both builds use the same direct-file server, unchanged base files, and byte snapshots for the same override paths.",
  inputs: entries.map((e) => ({
    id: e.id,
    sha256: e.sha256,
    depth: e.depthSha256 || null,
    truth: e.truthSha256 || null,
  })),
};
const manifestFile = path.join(out, "manifest.json"),
  rowsFolder = path.join(out, "rows"),
  archive = path.join(out, "source");
fs.mkdirSync(rowsFolder, { recursive: true });
if (fs.existsSync(manifestFile)) {
  const prior = JSON.parse(fs.readFileSync(manifestFile));
  if (
    prior.baseline.sha256 !== baseline.sha256 ||
    prior.candidate.sha256 !== candidate.sha256 ||
    JSON.stringify(prior.methods) !== JSON.stringify(methods) ||
    JSON.stringify(prior.settings) !== JSON.stringify(settings)
  )
    throw new Error("Saved measurements have different source, inputs, settings, or methods.");
} else {
  fs.mkdirSync(archive, { recursive: true });
  fs.writeFileSync(path.join(archive, "original-browser.mjs"), originalBrowser);
  fs.writeFileSync(path.join(archive, "adapted-browser.mjs"), adapted);
  fs.copyFileSync(self, path.join(archive, "cdx-p3d5-cost.mjs"));
  for (const [build, modules] of [
    ["main", mainModules],
    ["candidate", candidateModules],
  ])
    for (const [name, bytes] of Object.entries(modules)) {
      const file = path.join(archive, build, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
    }
  fs.writeFileSync(
    manifestFile,
    JSON.stringify(
      {
        schema: 1,
        createdUTC: new Date().toISOString(),
        baseline,
        candidate,
        methods,
        settings,
        isolationWitness,
      },
      null,
      2,
    ),
  );
}
const servers = {
  main: await localServer(entries, mainModules),
  candidate: await localServer(entries, candidateModules),
};
const observations = [];
try {
  for (let repetition = 0; repetition < repetitions; repetition++)
    for (const [index, entry] of entries.entries())
      for (const build of (index + repetition) % 2
        ? ["candidate", "main"]
        : ["main", "candidate"]) {
        assertIsolated();
        const file = path.join(rowsFolder, `${entry.id}-${repetition}-${build}.json`),
          sourceSha256 = build === "main" ? baseline.sha256 : candidate.sha256;
        let row;
        if (fs.existsSync(file)) {
          row = JSON.parse(fs.readFileSync(file));
          if (
            row.id !== entry.id ||
            row.build !== build ||
            row.repetition !== repetition ||
            row.sourceSha256 !== sourceSha256 ||
            row.inputSha256 !== entry.sha256 ||
            row.method !== methods.tool
          )
            throw new Error("A saved observation does not match its manifest.");
        } else {
          const began = new Date().toISOString();
          try {
            const result = await measureProfile(entry, "phone", {
              server: servers[build],
              out,
              poses: [],
              depth: 0.5,
            });
            row = {
              id: entry.id,
              build,
              repetition,
              sourceSha256,
              inputSha256: entry.sha256,
              method: methods.tool,
              began,
              finishedUTC: new Date().toISOString(),
              result,
            };
          } catch (error) {
            row = {
              id: entry.id,
              build,
              repetition,
              sourceSha256,
              inputSha256: entry.sha256,
              method: methods.tool,
              began,
              error: error.message,
            };
          }
          fs.writeFileSync(file + ".tmp", JSON.stringify(row));
          fs.renameSync(file + ".tmp", file);
          assertIsolated();
        }
        observations.push(row);
        console.log(
          JSON.stringify({
            completed: observations.length,
            expected: entries.length * repetitions * 2,
            id: entry.id,
            build,
            repetition,
            first3dMs: row.result?.timing.first3dMs,
            pss: row.result?.memory.peakPssBytes,
            error: row.error,
          }),
        );
      }
} finally {
  await servers.main.close();
  await servers.candidate.close();
}
if (fingerprint().sha256 !== baseline.sha256 || hash(fs.readFileSync(self)) !== methods.tool)
  throw new Error("Source or measurement method changed during the run.");
for (const [name, file] of Object.entries(files))
  if (hash(fs.readFileSync(file)) !== hash(candidateModules[name]))
    throw new Error("An override changed during the run.");
for (const entry of entries)
  if (
    hash(fs.readFileSync(entry.file)) !== entry.sha256 ||
    (entry.depthFile && hash(fs.readFileSync(entry.depthFile)) !== entry.depthSha256)
  )
    throw new Error("An input changed during the run.");
const median = (a) => {
  const sorted = [...a].sort((a, b) => a - b),
    n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
};
const statistics = {};
for (const build of ["main", "candidate"]) {
  const rows = observations.filter((r) => r.build === build && r.result);
  statistics[build] = Object.fromEntries(
    [
      ["first3dMs", rows.map((r) => r.result.timing.first3dMs)],
      ["peakPssBytes", rows.map((r) => r.result.memory.peakPssBytes)],
    ].map(([key, values]) => [
      key,
      values.length
        ? { count: values.length, median: median(values), worst: Math.max(...values) }
        : null,
    ]),
  );
}
const perInput = entries.map((entry) => {
  const builds = {};
  for (const build of ["main", "candidate"]) {
    const rows = observations.filter((r) => r.id === entry.id && r.build === build && r.result);
    builds[build] = Object.fromEntries(
      [
        ["first3dMs", rows.map((r) => r.result.timing.first3dMs)],
        ["peakPssBytes", rows.map((r) => r.result.memory.peakPssBytes)],
      ].map(([key, values]) => [
        key,
        values.length
          ? { count: values.length, median: median(values), worst: Math.max(...values) }
          : null,
      ]),
    );
  }
  return { id: entry.id, ...builds };
});
const noWorse = (main, candidate) =>
  Object.keys(main).every(
    (key) =>
      main[key] &&
      candidate[key] &&
      candidate[key].count === main[key].count &&
      candidate[key].median <= main[key].median &&
      candidate[key].worst <= main[key].worst,
  );
const aggregateCostPassed = noWorse(statistics.main, statistics.candidate),
  perInputCostPassed = perInput.every((row) => noWorse(row.main, row.candidate));
const complete =
    observations.length === entries.length * repetitions * 2 && observations.every((r) => r.result),
  fullCorpus = complete && entries.length === 118 && all.length === 118 && repetitions >= 5,
  costPassed = fullCorpus && settings.isolated && aggregateCostPassed && perInputCostPassed;
fs.writeFileSync(
  path.join(out, "summary.json"),
  JSON.stringify(
    {
      complete,
      fullCorpus,
      costPassed,
      aggregateCostPassed,
      perInputCostPassed,
      costPolicy:
        "Median and worst first-view time and PSS must not increase in aggregate or for any individual input. No unmeasured cost tolerance is granted.",
      statistics,
      perInput,
      inputCount: entries.length,
      repetitions,
      hardwareScope: "Chromium software phone profile; this is not a physical-phone measurement.",
      methods,
      manifest: "manifest.json",
      observations: "rows/",
    },
    null,
    2,
  ),
);
if (!complete) process.exitCode = 1;
