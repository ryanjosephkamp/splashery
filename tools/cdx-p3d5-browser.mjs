// MIT; made by Ryan with Codex (GPT-6). Preserve the atlas's independent source
// probes when the reconstructed depth changes. Original browser/timing code and
// metric definitions remain in their original modules.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { hash } from "./p3df/inputs.mjs";

let baseline, folder, implementation;
const proofs = new Map();

export function configureFrozenProbes(root) {
  folder = path.resolve(root);
  baseline = JSON.parse(fs.readFileSync(path.join(folder, "atlas.json")));
  if (!baseline.complete) throw new Error("The source-probe atlas must be complete.");
  proofs.clear();
}

export function frozenProbes(entry, profile) {
  if (!baseline) throw new Error("Configure frozen baseline probes first.");
  const row = baseline.inputs.find((r) => r.id === entry.id);
  if (
    !row ||
    row.sha256 !== entry.sha256 ||
    row.depthSha256 !== entry.depthSha256 ||
    row.truthSha256 !== entry.truthSha256
  )
    throw new Error("Frozen probes require identical original input hashes: " + entry.id);
  if (!row.profiles[profile]?.rows.length) throw new Error("Missing frozen profile: " + profile);
  const name = `renders/${entry.id}-${profile}-anchors.json.gz`,
    file = path.join(folder, name),
    bytes = fs.readFileSync(file),
    sha256 = hash(bytes);
  const old = proofs.get(name);
  if (old && old.sha256 !== sha256) throw new Error("A frozen source probe changed.");
  proofs.set(name, { name, file, sha256 });
  return {
    ...JSON.parse(zlib.gunzipSync(bytes)),
    proof: { name, sha256, atlasSource: baseline.source.sha256 },
  };
}

export function verifyFrozenProbes() {
  for (const p of proofs.values())
    if (hash(fs.readFileSync(p.file)) !== p.sha256)
      throw new Error("A frozen source probe changed during capture: " + p.name);
  return [...proofs.values()].map(({ file, ...p }) => p);
}

async function adaptedBrowser() {
  if (implementation) return implementation;
  const originalUrl = new URL("./p3df/browser.mjs", import.meta.url);
  let source = fs.readFileSync(originalUrl, "utf8");
  const replace = (before, after) => {
    if (!source.includes(before))
      throw new Error("Original finder changed; refresh and re-prove the adapter.");
    source = source.replace(before, after);
  };
  replace(
    `const thin = thinAnchorsR4(source, field),
      allEdges = sourceAnchorsR3(source, field),
      step = Math.max(1, Math.ceil(allEdges.anchors.length / 200)),
      edges = allEdges.anchors.filter((_, i) => i % step === 0),
      quads = revealQuads(field);`,
    `const frozen = frozenProbes(entry, name),
      thin = frozen.thin,
      allEdges = { candidates: frozen.edgeCandidates, anchors: { length: frozen.edgeSupported } },
      edges = frozen.edges,
      quads = revealQuads(frozen.field);
    if (field.width !== frozen.field.width || field.height !== frozen.field.height || field.data.some((v, i) => v !== frozen.field.data[i]))
      for (const quad of revealQuads(field)) quads.push(quad);`,
  );
  replace(
    `Float32Array.from(field.data, (v) => v / 255),
      field.width,
      field.height,
      Math.ceil(0.471 * field.height),`,
    `Float32Array.from(frozen.field.data, (v) => v / 255),
      frozen.field.width,
      frozen.field.height,
      Math.ceil(0.471 * frozen.field.height),`,
  );
  replace(
    `quads: quads.length,
        field,`,
    `quads: quads.length,
        field: frozen.field,
        actualField: field,
        frozenProbe: frozen.proof,`,
  );
  replace(
    `uv,
          field,
          minimum,`,
    `uv,
          field: frozen.field,
          minimum,`,
  );
  replace(
    `...state,
      timing,`,
    `...state,
      frozenProbe: frozen.proof,
      timing,`,
  );
  source = source.replace(/from "([^"]+)"/g, (whole, specifier) => {
    const url = specifier.startsWith(".")
      ? new URL(specifier, originalUrl).href
      : import.meta.resolve(specifier);
    const actual =
      url === new URL("./p3df/scoring.mjs", import.meta.url).href
        ? new URL("./cdx-p3d5-fast-metrics.mjs", import.meta.url).href
        : url;
    return `from ${JSON.stringify(actual)}`;
  });
  source = `import { frozenProbes } from ${JSON.stringify(import.meta.url)};\n` + source;
  implementation = (
    await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"))
  ).measureProfile;
  return implementation;
}

export async function measureFrozenProfile(entry, name, options) {
  return (await adaptedBrowser())(entry, name, options);
}

export function methodSources() {
  return Object.fromEntries(
    ["cdx-p3d5-browser.mjs", "cdx-p3d5-fast-metrics.mjs", "p3df/browser.mjs"].map((name) => [
      "tools/" + name,
      hash(fs.readFileSync(new URL(name, import.meta.url))),
    ]),
  );
}
