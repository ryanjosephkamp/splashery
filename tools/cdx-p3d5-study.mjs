// MIT; made by Ryan with Codex (GPT-6). Bounded experiments using the unchanged
// task 87 browser, poses, and calibrated scoring. Override files never ship.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { inventory, hash, ROOT } from "./p3df/inputs.mjs";
import { localServer, measureProfile, PROFILES } from "./p3df/browser.mjs";
import { fingerprint } from "./p3d-failures.mjs";
import { POSES, THRESHOLDS } from "./p3df/scoring.mjs";

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (
    !["--manifest", "--out", "--samples", "--profiles", "--override"].includes(key) ||
    !process.argv[i + 1]
  )
    throw new Error(
      "Use --manifest FILE --out DIR [--samples ID,ID] [--profiles phone,desktop] [--override JSON]",
    );
  args[key.slice(2)] = process.argv[i + 1];
}
const out = path.resolve(args.out),
  all = inventory({ manifest: args.manifest }),
  wanted = args.samples?.split(","),
  entries = wanted ? all.filter((r) => wanted.includes(r.id)) : all,
  profiles = args.profiles?.split(",") || Object.keys(PROFILES);
if (wanted && entries.length !== wanted.length) throw new Error("Missing requested input.");
if (profiles.some((p) => !PROFILES[p])) throw new Error("Unknown profile.");
// Public-corpus research only, kept outside the checkout. The original private
// input tool retains its stricter output and resume protections unchanged.
if (out === ROOT || out.startsWith(ROOT + path.sep))
  throw new Error("Keep study output outside the checkout.");
if (fs.existsSync(out) && fs.readdirSync(out).length)
  throw new Error("Choose an empty output folder.");
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
  method = hash(fs.readFileSync(fileURLToPath(import.meta.url)));
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
const data = {
  schema: 1,
  createdUTC: new Date().toISOString(),
  source,
  method,
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
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(path.join(out, "source"));
for (const [name, bytes] of Object.entries(overrides)) {
  const file = path.join(out, "source", name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}
fs.copyFileSync(fileURLToPath(import.meta.url), path.join(out, "source", "cdx-p3d5-study.mjs"));
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
  for (const entry of entries) {
    const { file, depthFile, truth, ...safe } = entry,
      row = { ...safe, profiles: {} };
    data.inputs.push(row);
    for (const profile of profiles) {
      const began = new Date().toISOString();
      try {
        row.profiles[profile] = await measureProfile(entry, profile, {
          server,
          out,
          poses: POSES,
          depth: 0.5,
        });
        data.attempts.push({ id: entry.id, profile, began, passed: true });
      } catch (error) {
        data.attempts.push({ id: entry.id, profile, began, passed: false, error: error.message });
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
    }
  }
} finally {
  await new Promise((resolve) => proxy.close(resolve));
  await upstream.close();
}
if (
  fingerprint().sha256 !== originalSource ||
  hash(fs.readFileSync(fileURLToPath(import.meta.url))) !== method
)
  throw new Error("Study source changed during capture.");
data.finishedUTC = new Date().toISOString();
data.complete =
  entries.length === all.length && profiles.length === 2 && data.attempts.every((r) => r.passed);
save();
if (data.attempts.some((r) => !r.passed)) process.exitCode = 1;
