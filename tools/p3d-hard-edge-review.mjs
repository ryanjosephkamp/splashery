// MIT; made by Ryan with Codex (GPT-6). New balanced, anonymous identities.
// The old identity key is never read. No synthetic choice is an owner vote.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { randomInt, createHash } from "node:crypto";
import { inventory } from "./p3df/inputs.mjs";

const root = path.resolve(process.argv[2] || ".cache/photo-3d-fill"),
  out = path.resolve(process.argv[3] || path.join(root, "review/photo-3d-hard-edge")),
  clips = JSON.parse(fs.readFileSync(path.join(root, "clips/clips.json"))),
  selection = JSON.parse(
    zlib.gunzipSync(fs.readFileSync(path.join(root, "review-selection.json.gz"))),
  ),
  inputs = [...inventory(), ...inventory({ manifest: path.join(root, "extra-manifest.json") })],
  hash = (b) => createHash("sha256").update(b).digest("hex");
if (
  !clips.complete ||
  clips.rows.length !== 20 ||
  clips.frames !== 72 ||
  clips.fps !== 12 ||
  JSON.stringify(clips.size) !== "[390,844]" ||
  clips.ownerVotes !== null
)
  throw new Error("Need twenty complete, actual phone pairs without owner votes");
const shuffle = (items) => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};
fs.mkdirSync(path.join(out, "raw"), { recursive: true });
const keyFile = path.join(out, "raw/operator-key.json.gz"),
  sides = shuffle(Array.from({ length: 20 }, (_, i) => (i < 10 ? "fill" : "classic"))),
  clipHash = hash(fs.readFileSync(path.join(root, "clips/clips.json")));
const key = fs.existsSync(keyFile)
  ? JSON.parse(zlib.gunzipSync(fs.readFileSync(keyFile)))
  : {
      generatedUTC: new Date().toISOString(),
      clipMetadataSha256: clipHash,
      rows: selection.map((r, i) => ({
        number: i + 1,
        id: r.id,
        a: sides[i],
        b: sides[i] === "fill" ? "classic" : "fill",
      })),
    };
if (
  key.clipMetadataSha256 !== clipHash ||
  key.rows.length !== 20 ||
  key.rows.filter((r) => r.a === "fill").length !== 10
)
  throw new Error("Existing review identities differ; use a fresh output folder");
const pairs = selection.map((s, i) => {
  const row = clips.rows.find((r) => r.id === s.id),
    input = inputs.find((r) => r.id === s.id),
    identity = key.rows[i];
  if (
    !row ||
    !input ||
    identity.id !== s.id ||
    row.photoSha256 !== input.sha256 ||
    row.methods.length !== 2 ||
    !["classic", "fill"].every((m) => row.methods.some((r) => r.candidate === m))
  )
    throw new Error("Review input or methods differ from the original selection");
  const pair = {
    number: i + 1,
    id: s.id,
    category: s.category,
    source: {
      label: input.label,
      author: input.author,
      source: input.source,
      license: input.license,
      ai: !!input.ai || s.id.startsWith("dot-") || s.id.startsWith("cdx-hard-"),
    },
  };
  for (const side of ["a", "b"]) {
    const method = row.methods.find((r) => r.candidate === identity[side]),
      from = path.join(root, "clips", method.file),
      file = `${String(i + 1).padStart(2, "0")}-${side}.mp4`;
    if (hash(fs.readFileSync(from)) !== method.sha256) throw new Error("A recorded clip changed");
    fs.copyFileSync(from, path.join(out, file));
    pair[side] = file;
  }
  return pair;
});
let html = fs.readFileSync(path.join(root, "review-template.html"), "utf8");
const begin = html.indexOf("    const pairs = ["),
  end = html.indexOf("    const answers = new Map();");
if (begin < 0 || end < begin) throw new Error("Task 99's review template changed");
html =
  html.slice(0, begin) + `    const pairs = ${JSON.stringify(pairs, null, 2)};\n` + html.slice(end);
html = html.replace("photo-3d-next-votes.json", "photo-3d-hard-edge-votes.json");
fs.writeFileSync(path.join(out, "index.html"), html);
fs.writeFileSync(
  path.join(out, "review.json"),
  JSON.stringify({ complete: true, ownerVotes: null, pairs }, null, 2),
);
fs.writeFileSync(keyFile, zlib.gzipSync(JSON.stringify(key)));
fs.writeFileSync(path.join(out, "raw/clips.json.gz"), zlib.gzipSync(JSON.stringify(clips)));
console.log("Prepared 20 anonymous pairs; positions balanced 10/10; owner votes unmeasured.");
