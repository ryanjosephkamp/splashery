// MIT; made by Ryan with Codex (GPT-6). Bounded experiments using the unchanged
// task 87 browser, poses, and calibrated scoring. Override files never ship.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { inventory, hash, ROOT } from "./p3df/inputs.mjs";
import { localServer, PROFILES } from "./p3df/browser.mjs";
import {
  configureFrozenProbes,
  frozenProbes,
  measureFrozenProfile as measureProfile,
  verifyFrozenProbes,
  methodSources,
} from "./cdx-p3d5-browser.mjs";
import { fingerprint } from "./p3d-failures.mjs";
import { POSES, THRESHOLDS } from "./p3df/scoring.mjs";
import { qualityValues } from "./cdx-p3d5-compare.mjs";
import { assertResume, completeStudy } from "./cdx-p3d5-study-state.mjs";

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (
    ![
      "--manifest",
      "--out",
      "--samples",
      "--profiles",
      "--override",
      "--probe-root",
      "--reject-against",
      "--resume",
    ].includes(key) ||
    !process.argv[i + 1]
  )
    throw new Error(
      "Use --manifest FILE --probe-root ATLAS --out DIR [--samples ID,ID] [--profiles phone,desktop] [--override JSON] [--reject-against ATLAS] [--resume true]",
    );
  args[key.slice(2)] = process.argv[i + 1];
}
const out = path.resolve(args.out),
  all = inventory({ manifest: args.manifest }),
  wanted = args.samples?.split(","),
  entries = wanted ? all.filter((r) => wanted.includes(r.id)) : all,
  profiles = args.profiles?.split(",") || Object.keys(PROFILES);
configureFrozenProbes(args["probe-root"]);
const rejectAgainst = args["reject-against"]
  ? JSON.parse(fs.readFileSync(args["reject-against"]))
  : null;
if (rejectAgainst && !rejectAgainst.complete)
  throw new Error("The early-rejection baseline must be complete.");
if (wanted && entries.length !== wanted.length) throw new Error("Missing requested input.");
if (
  !profiles.length ||
  new Set(profiles).size !== profiles.length ||
  profiles.some((p) => !PROFILES[p])
)
  throw new Error("Profiles must be unique phone or desktop names.");
if (args.resume && args.resume !== "true") throw new Error("Use --resume true.");
// Public-corpus research only, kept outside the checkout. The original private
// input tool retains its stricter output and resume protections unchanged.
if (out === ROOT || out.startsWith(ROOT + path.sep))
  throw new Error("Keep study output outside the checkout.");
if (fs.existsSync(out) && fs.readdirSync(out).length && !args.resume)
  throw new Error("Choose an empty output folder.");
if (args.resume && !fs.existsSync(path.join(out, "atlas.json")))
  throw new Error("Resume requires an existing capture record.");
const overrides = Object.fromEntries(
  Object.entries(args.override ? JSON.parse(fs.readFileSync(args.override)) : {}).map(
    ([name, file]) => {
      if (!/^src\/[a-zA-Z0-9/._-]+\.js$/.test(name) || name.split("/").includes(".."))
        throw new Error("An override must name a source module.");
      return [name, fs.readFileSync(file)];
    },
  ),
);
const source = fingerprint(),
  method = hash(fs.readFileSync(fileURLToPath(import.meta.url))),
  methods = methodSources();
for (const [name, bytes] of Object.entries(overrides)) source.files[name] = hash(bytes);
source.sha256 = hash(JSON.stringify(source.files));
const originalSource = fingerprint().sha256;
const settings = {
  depth: 0.5,
  profiles,
  poses: POSES,
  diagnostics: true,
  view: "sharp",
  detail: "photo",
  background: "white; no ground",
  inputHashes: entries.map((e) => ({
    id: e.id,
    sha256: e.sha256,
    depth: e.depthSha256 || null,
    truth: e.truthSha256 || null,
  })),
};
const stateFile = fileURLToPath(new URL("./cdx-p3d5-study-state.mjs", import.meta.url)),
  stateMethod = hash(fs.readFileSync(stateFile)),
  previous = args.resume ? JSON.parse(fs.readFileSync(path.join(out, "atlas.json"))) : null;
if (previous) {
  assertResume(previous, {
    source,
    settings,
    methods,
    method,
    stateMethod,
    // The sole pre-resume controller used the identical measurement helpers.
    // Its archived source and every retained artifact are checked below.
    compatibleControllers: ["847d1dbc79ab1dc308077d71dc6eac8489955a256e1cd2896588b1cdfac6b4f5"],
  });
  const priorController = fs.readFileSync(path.join(out, "source/cdx-p3d5-frozen-study.mjs"));
  if (hash(priorController) !== previous.method) throw new Error("Archived controller changed.");
  fs.mkdirSync(path.join(out, "source/controllers"), { recursive: true });
  fs.writeFileSync(path.join(out, "source/controllers", previous.method + ".mjs"), priorController);
  const oldRecord = fs.readFileSync(path.join(out, "atlas.json"));
  fs.writeFileSync(
    path.join(out, "source/controllers", hash(oldRecord) + "-atlas.json"),
    oldRecord,
  );
  for (const [name, digest] of Object.entries(previous.methods))
    if (hash(fs.readFileSync(path.join(out, "source", name))) !== digest)
      throw new Error("Archived measurement helper changed: " + name);
  for (const name of Object.keys(overrides))
    if (hash(fs.readFileSync(path.join(out, "source", name))) !== source.files[name])
      throw new Error("Archived source override changed: " + name);
  for (const row of previous.inputs) {
    const entry = entries.find((e) => e.id === row.id);
    if (!entry) throw new Error("Unexpected retained input.");
    for (const [profile, p] of Object.entries(row.profiles)) {
      if (
        !profiles.includes(profile) ||
        p.rows.length !== POSES.length ||
        p.errors.length ||
        p.externalRequests.length ||
        !p.sharp.on
      )
        throw new Error("A retained profile is incomplete or failed.");
      const proof = frozenProbes(entry, profile).proof;
      if (proof.sha256 !== p.frozenProbe.sha256 || proof.name !== p.frozenProbe.name)
        throw new Error("A retained source probe changed.");
      for (const pose of p.rows)
        for (const [name, digest] of Object.entries(pose.artifacts || {}))
          if (hash(fs.readFileSync(path.join(out, name))) !== digest)
            throw new Error("Retained native evidence changed: " + name);
    }
  }
  previous.controllerHistory ||= [{ sha256: previous.method, beganUTC: previous.createdUTC }];
  previous.controllerHistory.push({
    sha256: method,
    resumedUTC: new Date().toISOString(),
    priorAtlasSha256: hash(oldRecord),
  });
  for (const attempt of previous.attempts) attempt.controllerSha256 ||= previous.method;
}
const data = previous || {
  schema: 1,
  createdUTC: new Date().toISOString(),
  source,
  method,
  methods,
  stateMethod,
  probePolicy:
    "Frozen source UV, RGB, and probe membership; current foreground projection depths, rendered masks, and colors; current cue-depth and raw-model reference metrics. Lost fit or thin-depth confidence is reported. Revealed-area holes also cover newly introduced cuts.",
  settings,
  thresholds: { ...THRESHOLDS, speed: 5000, memory: 1024 ** 3 },
  private: false,
  requestedInputs: all.length,
  complete: false,
  costUse:
    "Exploratory; isolate and repeat original real-input measurements before accepting cost claims.",
  inputs: [],
  attempts: [],
};
data.method = method;
data.stateMethod = stateMethod;
data.complete = false;
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(path.join(out, "source"), { recursive: true });
fs.copyFileSync(stateFile, path.join(out, "source/cdx-p3d5-study-state.mjs"));
for (const [name, bytes] of Object.entries(overrides)) {
  const file = path.join(out, "source", name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}
fs.copyFileSync(
  fileURLToPath(import.meta.url),
  path.join(out, "source", "cdx-p3d5-frozen-study.mjs"),
);
for (const name of Object.keys(methods)) {
  const file = path.join(out, "source", name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.copyFileSync(path.join(ROOT, name), file);
}
const save = () => {
  const file = path.join(out, "atlas.json");
  fs.writeFileSync(file + ".tmp", JSON.stringify(data));
  fs.renameSync(file + ".tmp", file);
};
save();
const upstream = await localServer(entries);
const proxy = http.createServer(async (req, res) => {
  try {
    const name = new URL(req.url, "http://localhost").pathname.slice(1),
      bytes = overrides[name];
    if (bytes) {
      res.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" });
      res.end(bytes);
    } else {
      const response = await fetch(new URL(req.url, upstream.url));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    }
  } catch (error) {
    res.writeHead(500);
    res.end(error.message);
  }
});
await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
const server = { url: `http://127.0.0.1:${proxy.address().port}/`, inputUrl: upstream.inputUrl };
try {
  capture: for (const entry of entries) {
    const { file, depthFile, truth, ...safe } = entry;
    let row = data.inputs.find((r) => r.id === entry.id);
    if (!row) {
      row = { ...safe, profiles: {} };
      data.inputs.push(row);
    }
    for (const profile of profiles) {
      if (row.profiles[profile]) continue;
      const began = new Date().toISOString();
      try {
        row.profiles[profile] = await measureProfile(entry, profile, {
          server,
          out,
          poses: POSES,
          depth: 0.5,
        });
        data.attempts.push({
          id: entry.id,
          profile,
          began,
          passed: true,
          controllerSha256: method,
        });
      } catch (error) {
        data.attempts.push({
          id: entry.id,
          profile,
          began,
          passed: false,
          error: error.message,
          controllerSha256: method,
        });
      }
      save();
      console.log(
        JSON.stringify({
          id: entry.id,
          profile,
          result: data.attempts.at(-1),
          values: row.profiles[profile]?.values,
        }),
      );
      if (rejectAgainst) {
        const before = rejectAgainst.inputs.find((r) => r.id === entry.id)?.profiles[profile],
          after = row.profiles[profile],
          failures = [];
        if (!before || !after) failures.push({ reason: "Missing profile or failed capture" });
        else {
          const a = qualityValues(before),
            b = qualityValues(after);
          for (const [metric, value] of Object.entries(a))
            if (Number.isFinite(value) && (!Number.isFinite(b[metric]) || b[metric] > value))
              failures.push({ metric, before: value, after: b[metric] });
          for (let i = 0; i < before.rows.length; i++)
            for (const [kind, key] of [
              ["halo", "anchoredProfiles"],
              ["fringe", "evaluated"],
            ])
              if ((after.rows[i]?.[kind]?.[key] || 0) < (before.rows[i]?.[kind]?.[key] || 0))
                failures.push({ reason: "Lost probe support", pose: i, kind });
        }
        if (failures.length) {
          // Conservative research screen only. A capture's completeness and
          // the full acceptance comparison remain separate from this stop.
          data.stoppedEarly = { id: entry.id, profile, tolerance: 0, failures };
          save();
          console.log(JSON.stringify({ stoppedEarly: data.stoppedEarly }));
          break capture;
        }
      }
    }
  }
} finally {
  await new Promise((resolve) => proxy.close(resolve));
  await upstream.close();
}
if (
  fingerprint().sha256 !== originalSource ||
  hash(fs.readFileSync(fileURLToPath(import.meta.url))) !== method ||
  hash(fs.readFileSync(stateFile)) !== stateMethod ||
  JSON.stringify(methodSources()) !== JSON.stringify(methods)
)
  throw new Error("Study source changed during capture.");
data.finishedUTC = new Date().toISOString();
data.frozenProbeProofs = verifyFrozenProbes();
data.complete = completeStudy(
  data,
  all.map((e) => e.id),
  profiles,
);
save();
if (data.attempts.some((r) => !r.passed) || data.stoppedEarly) process.exitCode = 1;
