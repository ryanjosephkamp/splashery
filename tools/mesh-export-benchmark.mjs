#!/usr/bin/env node
// Task 106's independent, deterministic benchmark. Build-time only; never imported by the site.
// Source assets, reconstructed files, license evidence, and scores stay in .cache/mesh-export/.
//   node tools/mesh-export-benchmark.mjs --fetch
//   node tools/mesh-export-benchmark.mjs --run [toy-id ...] [--phone] [--resolution=128]
//   node tools/mesh-export-benchmark.mjs --runtime [--phone] [--count=450000]
//   node tools/mesh-export-benchmark.mjs --samples
//   node tools/mesh-export-benchmark.mjs --stills [--port=4174]
//   node tools/mesh-export-benchmark.mjs --browser-runtime [--phone] [--port=4174]
//   node tools/mesh-export-benchmark.mjs --validate [toy-id ...]
// Validation uses an optional GLTF_VALIDATOR_MODULE path; install gltf-validator outside git.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { readSplatFile, pick } from "../src/viewers/splat-io.js";
import { getWebp } from "../src/viewers/engine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = path.join(root, ".cache/mesh-export");
const models = JSON.parse(fs.readFileSync(path.join(root, "tools/models.json"))).models.slice(
  0,
  14,
);
const args = process.argv.slice(2);
const selected = args.filter((a) => !a.startsWith("--"));
const option = (key, fallback) =>
  args.find((a) => a.startsWith(`--${key}=`))?.split("=")[1] ?? fallback;
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const writeJSON = (name, data) => {
  fs.mkdirSync(path.dirname(name), { recursive: true });
  fs.writeFileSync(name, `${JSON.stringify(data, null, 2)}\n`);
};

function command(executable, argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, argv, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let error = "";
    child.stdout.on("data", (b) => (output += b));
    child.stderr.on("data", (b) => (error += b));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve(output) : reject(new Error(`${executable}: ${error}`)),
    );
  });
}

async function download(url, filename, refresh = false) {
  if (!refresh && fs.existsSync(filename) && fs.statSync(filename).size > 0) return;
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.partial`;
  await command("curl", [
    "--location",
    "--fail",
    "--retry",
    "2",
    "--connect-timeout",
    "20",
    "--max-time",
    "180",
    "--silent",
    "--show-error",
    "--output",
    temporary,
    url,
  ]);
  fs.renameSync(temporary, filename);
}

async function fetchSources() {
  const results = [];
  for (const model of models.filter((m) => !selected.length || selected.includes(m.id))) {
    const directory = path.join(cache, "sources", model.id);
    const api = path.join(directory, "files.json");
    await download(`https://api.polyhaven.com/files/${model.source.slice(10)}`, api);
    const manifest = JSON.parse(fs.readFileSync(api));
    const entry = (manifest.gltf["1k"] || manifest.gltf["2k"]).gltf;
    const filename = path.join(directory, `${model.id}.gltf`);
    await download(entry.url, filename);
    await Promise.all(
      Object.entries(entry.include).map(([name, info]) =>
        download(info.url, path.join(directory, name)),
      ),
    );
    const sourcePage = path.join(directory, "source-page.html");
    const licensePage = path.join(directory, "license-page.html");
    await download(model.page, sourcePage, true);
    await download("https://polyhaven.com/license", licensePage, true);
    const licenseText = fs.readFileSync(licensePage, "utf8");
    const sourceText = fs.readFileSync(sourcePage, "utf8");
    if (!/CC0|public domain/i.test(licenseText) || !/CC0|public domain/i.test(sourceText)) {
      throw new Error(
        `${model.id}: fetched source/license pages do not establish CC0; inspect them before proceeding.`,
      );
    }
    const record = {
      id: model.id,
      source: model.page,
      author: model.author,
      license: model.license,
      licensePage: "https://polyhaven.com/license",
      checked: new Date().toISOString(),
      main: path.relative(cache, filename),
      sourcePageSha256: hash(sourceText),
      licensePageSha256: hash(licenseText),
      files: [
        { name: path.basename(filename), url: entry.url },
        ...Object.entries(entry.include).map(([name, info]) => ({ name, url: info.url })),
      ].map((file) => ({
        ...file,
        sha256: hash(fs.readFileSync(path.join(directory, file.name))),
      })),
    };
    writeJSON(path.join(directory, "provenance.json"), record);
    results.push(record);
    console.log(
      `Fetched ${model.id}: ${record.files.length} source files; live source and CC0 license pages checked.`,
    );
  }
  return results;
}

export function random(seed = 106) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], positions[i]);
    max[i % 3] = Math.max(max[i % 3], positions[i]);
  }
  const size = max.map((v, k) => v - min[k]);
  return {
    min,
    max,
    size,
    center: max.map((v, k) => (v + min[k]) / 2),
    diagonal: Math.hypot(...size),
  };
}

function triangleData(mesh) {
  const { positions: p, indices: ix } = mesh;
  const count = ix.length / 3;
  const cumulative = new Float64Array(count);
  const normals = new Float32Array(count * 3);
  let area = 0;
  for (let f = 0; f < count; f++) {
    const a = ix[f * 3] * 3,
      b = ix[f * 3 + 1] * 3,
      c = ix[f * 3 + 2] * 3;
    const ux = p[b] - p[a],
      uy = p[b + 1] - p[a + 1],
      uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a],
      vy = p[c + 1] - p[a + 1],
      vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    area += length / 2;
    cumulative[f] = area;
    normals.set([nx / (length || 1), ny / (length || 1), nz / (length || 1)], f * 3);
  }
  return { area, cumulative, normals };
}

export function sampleSurface(mesh, count = 100000, seed = 106) {
  const { area, cumulative, normals: faceNormals } = triangleData(mesh);
  if (!(area > 0)) throw new Error("Mesh has no nondegenerate surface.");
  const points = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const rnd = random(seed);
  for (let i = 0; i < count; i++) {
    const target = rnd() * area;
    let low = 0,
      high = cumulative.length - 1;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (cumulative[middle] < target) low = middle + 1;
      else high = middle;
    }
    const offset = low * 3;
    const a = mesh.indices[offset] * 3,
      b = mesh.indices[offset + 1] * 3,
      c = mesh.indices[offset + 2] * 3;
    const u = Math.sqrt(rnd()),
      v = rnd();
    for (let k = 0; k < 3; k++) {
      points[i * 3 + k] =
        mesh.positions[a + k] * (1 - u) +
        mesh.positions[b + k] * u * (1 - v) +
        mesh.positions[c + k] * u * v;
      normals[i * 3 + k] = faceNormals[offset + k];
    }
  }
  return { points, normals, count, area };
}

function kdTree(points) {
  const build = (list, depth) => {
    if (!list.length) return null;
    const axis = depth % 3;
    list.sort((a, b) => points[a * 3 + axis] - points[b * 3 + axis]);
    const middle = list.length >>> 1;
    return {
      index: list[middle],
      axis,
      left: build(list.slice(0, middle), depth + 1),
      right: build(list.slice(middle + 1), depth + 1),
    };
  };
  const tree = build(
    Array.from({ length: points.length / 3 }, (_, i) => i),
    0,
  );
  return (x, y, z) => {
    let distance = Infinity,
      index = -1;
    const query = [x, y, z];
    const visit = (node) => {
      if (!node) return;
      const p = node.index * 3;
      const d = (x - points[p]) ** 2 + (y - points[p + 1]) ** 2 + (z - points[p + 2]) ** 2;
      if (d < distance) {
        distance = d;
        index = node.index;
      }
      const delta = query[node.axis] - points[p + node.axis];
      visit(delta < 0 ? node.left : node.right);
      if (delta * delta < distance) visit(delta < 0 ? node.right : node.left);
    };
    visit(tree);
    return { distance: Math.sqrt(distance), index };
  };
}

export function compareSurfaces(reference, reconstructed, diagonal, samples = 100000) {
  const a = sampleSurface(reference, samples, 106);
  const b = sampleSurface(reconstructed, samples, 107);
  const directed = (from, to) => {
    const nearest = kdTree(to.points);
    let distance = 0,
      normal = 0,
      signedNormal = 0;
    for (let i = 0; i < from.count; i++) {
      const at = i * 3;
      const hit = nearest(from.points[at], from.points[at + 1], from.points[at + 2]);
      distance += hit.distance;
      const j = hit.index * 3;
      const dot =
        from.normals[at] * to.normals[j] +
        from.normals[at + 1] * to.normals[j + 1] +
        from.normals[at + 2] * to.normals[j + 2];
      normal += Math.abs(dot);
      signedNormal += dot;
    }
    return {
      distance: distance / from.count,
      normal: normal / from.count,
      signedNormal: signedNormal / from.count,
    };
  };
  const ab = directed(a, b),
    ba = directed(b, a);
  return {
    samplesPerSurface: samples,
    chamfer: (ab.distance + ba.distance) / (2 * diagonal),
    chamferPercent: ((ab.distance + ba.distance) * 50) / diagonal,
    normalConsistency: (ab.normal + ba.normal) / 2,
    signedNormalConsistency: (ab.signedNormal + ba.signedNormal) / 2,
    sourceToMeshPercent: (ab.distance * 100) / diagonal,
    meshToSourcePercent: (ba.distance * 100) / diagonal,
  };
}

// Independent combinatorial check: closed edge incidence plus a single cycle in every vertex link.
// This deliberately does not trust the reconstruction module's topology report.
export function inspectTopology({ positions: p, indices: ix }) {
  const vertexCount = p.length / 3;
  const edges = new Map();
  const links = Array.from({ length: vertexCount }, () => new Map());
  let invalidFaces = 0,
    degenerateFaces = 0,
    signedVolume = 0;
  for (let f = 0; f < ix.length; f += 3) {
    const a = ix[f],
      b = ix[f + 1],
      c = ix[f + 2];
    if (![a, b, c].every((v) => Number.isInteger(v) && v >= 0 && v < vertexCount)) {
      invalidFaces++;
      continue;
    }
    if (a === b || a === c || b === c) degenerateFaces++;
    const ai = a * 3,
      bi = b * 3,
      ci = c * 3;
    const ux = p[bi] - p[ai],
      uy = p[bi + 1] - p[ai + 1],
      uz = p[bi + 2] - p[ai + 2];
    const vx = p[ci] - p[ai],
      vy = p[ci + 1] - p[ai + 1],
      vz = p[ci + 2] - p[ai + 2];
    if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-14)
      degenerateFaces++;
    signedVolume +=
      (p[ai] * (p[bi + 1] * p[ci + 2] - p[bi + 2] * p[ci + 1]) +
        p[ai + 1] * (p[bi + 2] * p[ci] - p[bi] * p[ci + 2]) +
        p[ai + 2] * (p[bi] * p[ci + 1] - p[bi + 1] * p[ci])) /
      6;
    for (const [x, y, opposite] of [
      [a, b, c],
      [b, c, a],
      [c, a, b],
    ]) {
      const key = `${Math.min(x, y)},${Math.max(x, y)}`;
      const edge = edges.get(key) || { count: 0, direction: 0 };
      edge.count++;
      edge.direction += x < y ? 1 : -1;
      edges.set(key, edge);
      const link = links[x];
      if (!link.has(y)) link.set(y, []);
      if (!link.has(opposite)) link.set(opposite, []);
      link.get(y).push(opposite);
      link.get(opposite).push(y);
    }
  }
  let boundaryEdges = 0,
    nonmanifoldEdges = 0,
    inconsistentEdges = 0,
    nonmanifoldVertices = 0;
  for (const edge of edges.values()) {
    if (edge.count === 1) boundaryEdges++;
    if (edge.count > 2) nonmanifoldEdges++;
    if (edge.count === 2 && edge.direction !== 0) inconsistentEdges++;
  }
  for (const link of links) {
    if (!link.size) continue;
    if ([...link.values()].some((neighbors) => neighbors.length !== 2)) {
      nonmanifoldVertices++;
      continue;
    }
    const seen = new Set();
    const stack = [link.keys().next().value];
    while (stack.length) {
      const v = stack.pop();
      if (seen.has(v)) continue;
      seen.add(v);
      stack.push(...link.get(v));
    }
    if (seen.size !== link.size) nonmanifoldVertices++;
  }
  const manifold =
    vertexCount > 0 &&
    ix.length > 0 &&
    !invalidFaces &&
    !degenerateFaces &&
    !nonmanifoldEdges &&
    !nonmanifoldVertices;
  return {
    vertices: vertexCount,
    triangles: ix.length / 3,
    boundaryEdges,
    nonmanifoldEdges,
    nonmanifoldVertices,
    inconsistentEdges,
    invalidFaces,
    degenerateFaces,
    signedVolume,
    watertight: manifold && !boundaryEdges && !inconsistentEdges,
    manifold,
  };
}

async function sourceMesh(model) {
  const filename = path.join(cache, "sources", model.id, `${model.id}.gltf`);
  const doc = await new NodeIO().read(filename);
  const positions = [],
    indices = [];
  for (const scene of doc.getRoot().listScenes())
    scene.traverse((node) => {
      const mesh = node.getMesh();
      if (!mesh) return;
      const m = node.getWorldMatrix();
      for (const primitive of mesh.listPrimitives()) {
        if (primitive.getMode() !== 4) continue;
        const p = primitive.getAttribute("POSITION");
        const ix = primitive.getIndices();
        const offset = positions.length / 3;
        for (let i = 0; i < p.getCount(); i++) {
          const [x, y, z] = p.getElement(i, []);
          positions.push(
            m[0] * x + m[4] * y + m[8] * z + m[12],
            m[1] * x + m[5] * y + m[9] * z + m[13],
            m[2] * x + m[6] * y + m[10] * z + m[14],
          );
        }
        for (let i = 0; i < (ix?.getCount() || p.getCount()); i++)
          indices.push(offset + (ix ? ix.getScalar(i) : i));
      }
    });
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

async function splatInput(id, lite = false) {
  const filename = path.join(root, "assets/toys", id, `${id}${lite ? "-lite" : ""}.sog`);
  const bytes = new Uint8Array(fs.readFileSync(filename));
  return {
    filename,
    sha256: hash(bytes),
    bytes: bytes.byteLength,
    table: await readSplatFile(bytes, filename, { getWebp }),
  };
}

// Undo only the export's documented print-size transform, then map source coordinates using the
// same 1.5% trimmed, area-weighted bounds as prepare-assets. No ICP, geometry fitting, or per-toy
// tuning: the source is never fed to reconstruction. Compare complete source meshes, including
// glass omitted by the old splat bake; that omission is a real limitation of the available input.
function align(reference, input, mesh, readyToPrint) {
  const samples = sampleSurface(reference, 200000, 1).points;
  const sourceCenter = [],
    sourceHalf = [],
    inputCenter = [],
    inputHalf = [];
  for (let k = 0; k < 3; k++) {
    const source = Array.from({ length: samples.length / 3 }, (_, i) => samples[i * 3 + k]).sort(
      (a, b) => a - b,
    );
    const points = Array.from(input[["x", "y", "z"][k]]).sort((a, b) => a - b);
    const lo = source[Math.floor(source.length * 0.015)],
      hi = source[Math.floor(source.length * 0.985)];
    sourceCenter.push((lo + hi) / 2);
    sourceHalf.push((hi - lo) / 2);
    const low = points[Math.floor(points.length * 0.015)],
      high = points[Math.floor(points.length * 0.985)];
    inputCenter.push((low + high) / 2);
    inputHalf.push((high - low) / 2);
  }
  const sourceScale = Math.max(...inputHalf) / Math.max(...sourceHalf);
  const referencePositions = Float32Array.from(
    reference.positions,
    (v, i) => (v - sourceCenter[i % 3]) * sourceScale + inputCenter[i % 3],
  );
  const output = mesh.positions.slice();
  let printScale = 1;
  if (readyToPrint) {
    const transform = mesh.report?.printTransform;
    if (!transform || !(transform.scale > 0) || transform.center?.length !== 3)
      throw new Error(
        "Print-mode scoring requires the exact documented output coordinate transform.",
      );
    printScale = 1 / transform.scale;
    for (let i = 0; i < output.length; i++)
      output[i] = output[i] * printScale + transform.center[i % 3];
  }
  return {
    reference: { ...reference, positions: referencePositions },
    mesh: { ...mesh, positions: output },
    transform: { sourceCenter, sourceScale, inputCenter, printScale },
  };
}

function median(numbers) {
  const sorted = numbers.toSorted((a, b) => a - b);
  const middle = sorted.length >>> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function benchmark() {
  const { reconstruct } = await import("../src/mesh-export/reconstruct.js");
  const { encodeMesh } = await import("../src/mesh-export/formats.js");
  const phone = args.includes("--phone");
  const readyToPrint = !args.includes("--surface");
  const profile = phone ? "phone" : "desktop";
  const resolution = Number(option("resolution", phone ? 72 : 112));
  const tag = String(
    option("tag", `${profile}-${readyToPrint ? "print" : "surface"}-${resolution}`),
  ).replace(/[^a-z0-9_-]/gi, "-");
  const samples = Number(option("samples", 100000));
  const results = [];
  for (const model of models.filter((m) => !selected.length || selected.includes(m.id))) {
    const source = await sourceMesh(model);
    const input = await splatInput(model.id, phone);
    const options = {
      resolution,
      level: Number(option("level", 0.15)),
      triangleBudget: Number(option("triangles", phone ? 40000 : 100000)),
      readyToPrint,
      printSize: Number(option("print-size", 100)),
      profile,
      smoothIterations: Number(option("smooth", 3)),
      minComponent: Number(option("min-component", 0.002)),
    };
    const started = performance.now();
    const mesh = reconstruct(input.table, options);
    const encoded = encodeMesh(mesh, "glb", {
      name: model.id,
      license: model.license,
      author: model.author,
      source: model.page,
    });
    const elapsedSeconds = (performance.now() - started) / 1000;
    const directory = path.join(cache, "exports", tag, model.id);
    fs.mkdirSync(directory, { recursive: true });
    for (const file of encoded) fs.writeFileSync(path.join(directory, file.name), file.bytes);
    // A compact binary preserves the exact indexed mesh for independent tools and later scoring.
    fs.writeFileSync(
      path.join(directory, "positions.f32"),
      Buffer.from(mesh.positions.buffer, mesh.positions.byteOffset, mesh.positions.byteLength),
    );
    fs.writeFileSync(
      path.join(directory, "indices.u32"),
      Buffer.from(mesh.indices.buffer, mesh.indices.byteOffset, mesh.indices.byteLength),
    );
    const aligned = align(source, input.table, mesh, readyToPrint);
    const scoring = compareSurfaces(
      aligned.reference,
      aligned.mesh,
      bounds(aligned.reference.positions).diagonal,
      samples,
    );
    const topology = inspectTopology(mesh);
    const result = {
      id: model.id,
      input: path.relative(root, input.filename),
      inputSha256: input.sha256,
      inputSplats: input.table.count,
      source: model.page,
      sourceProvenanceSha256: hash(
        fs.readFileSync(path.join(cache, "sources", model.id, "provenance.json")),
      ),
      options,
      elapsedSeconds,
      processRssMiB: process.memoryUsage().rss / 1048576,
      output: path.relative(root, directory),
      scoring,
      topology,
      transform: aligned.transform,
      reconstructionReport: mesh.report,
    };
    results.push(result);
    writeJSON(path.join(directory, "score.json"), result);
    console.log(
      `${model.id}: ${elapsedSeconds.toFixed(2)} s; Chamfer ${scoring.chamferPercent.toFixed(3)}%; normals ${scoring.normalConsistency.toFixed(4)}; closed/manifold ${topology.watertight}/${topology.manifold}; ${topology.triangles} triangles`,
    );
  }
  const report = {
    measured: new Date().toISOString(),
    environment: {
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      cpu: os.cpus()[0]?.model,
      physicalPhone: false,
    },
    methodology:
      "Deterministic area-weighted 100,000-point samples per surface (override --samples), arithmetic mean of the two directed nearest-sample Euclidean distances, divided by complete source bounding diagonal; normal consistency averages absolute face-normal dot products at those nearest samples. Source and output are aligned by the bake's trimmed bounds and print units; no ICP. Topology is checked independently with edge incidence, directed edges, and connected vertex links.",
    results,
    summary: {
      toys: results.length,
      medianChamferPercent: median(results.map((r) => r.scoring.chamferPercent)),
      medianNormalConsistency: median(results.map((r) => r.scoring.normalConsistency)),
      watertightManifold: results.filter((r) => r.topology.watertight && r.topology.manifold)
        .length,
      sampledThicknessPassed: results.filter((r) => r.reconstructionReport?.thicknessCheck?.passed)
        .length,
      notReadyToPrint: results
        .filter((r) => r.options.readyToPrint && !r.reconstructionReport?.printable)
        .map((r) => r.id),
      failures: results
        .filter((r) => !r.topology.watertight || !r.topology.manifold)
        .map((r) => r.id),
    },
  };
  const filename = path.join(cache, `benchmark-${tag}.json`);
  writeJSON(filename, report);
  console.log(JSON.stringify(report.summary));
  console.log(path.relative(root, filename));
}

async function runtime() {
  const { reconstruct } = await import("../src/mesh-export/reconstruct.js");
  const { encodeMesh } = await import("../src/mesh-export/formats.js");
  const phone = args.includes("--phone");
  const count = Number(option("count", 450000));
  const sourceId = option("toy", "cactus");
  const source = await splatInput(sourceId, false);
  const { TOYS } = await import("../src/toys.js");
  const sourceCredit = TOYS.find((toy) => toy.id === sourceId)?.credit;
  if (!sourceCredit?.license)
    throw new Error("The runtime source needs its source license metadata.");
  if (count > source.table.count)
    throw new Error(
      "Runtime input count exceeds the real scan; choose a larger source, without duplicating splats.",
    );
  const table =
    count === source.table.count
      ? source.table
      : pick(
          source.table,
          Array.from({ length: count }, (_, i) => Math.floor((i * source.table.count) / count)),
        );
  const profile = phone ? "phone" : "desktop";
  const options = {
    profile,
    resolution: Number(option("resolution", phone ? 72 : 112)),
    readyToPrint: true,
    printSize: Number(option("print-size", 100)),
    triangleBudget: phone ? 40000 : 100000,
    level: Number(option("level", 0.15)),
  };
  const rssBeforeMiB = process.memoryUsage().rss / 1048576;
  const start = performance.now();
  const mesh = reconstruct(table, options);
  const reconstructionSeconds = (performance.now() - start) / 1000;
  const files = encodeMesh(mesh, "glb", {
    ...sourceCredit,
    name: "runtime-capture",
  });
  const exportDirectory = path.join(cache, "exports", `runtime-${profile}`, sourceId);
  fs.mkdirSync(exportDirectory, { recursive: true });
  for (const file of files) fs.writeFileSync(path.join(exportDirectory, file.name), file.bytes);
  const result = {
    measured: new Date().toISOString(),
    profile,
    physicalPhone: false,
    description:
      "Node benchmark on the host CPU; actual shipped cactus scan, without duplicated splats. Phone means the lower algorithm budget, not physical phone hardware or CPU throttling.",
    cpu: os.cpus()[0]?.model,
    node: process.version,
    inputSplats: count,
    uniqueSourceSplats: source.table.count,
    sourceSha256: source.sha256,
    options,
    reconstructionSeconds,
    totalSeconds: (performance.now() - start) / 1000,
    rssBeforeMiB,
    rssAfterMiB: process.memoryUsage().rss / 1048576,
    processPeakRssMiB: process.resourceUsage().maxRSS / 1024,
    outputBytes: files.reduce((sum, f) => sum + f.bytes.byteLength, 0),
    topology: inspectTopology(mesh),
    reconstructionReport: mesh.report,
  };
  writeJSON(path.join(cache, `runtime-${profile}-${count}.json`), result);
  console.log(JSON.stringify(result, null, 2));
}

async function validate() {
  const modulePath = process.env.GLTF_VALIDATOR_MODULE;
  if (!modulePath)
    throw new Error(
      "Set GLTF_VALIDATOR_MODULE to an outside-repository gltf-validator module path.",
    );
  const validator = await import(pathToFileURL(modulePath).href);
  const tags = option("tag", "").split(",").filter(Boolean);
  const directories = fs
    .readdirSync(path.join(cache, "exports"))
    .filter((name) => !tags.length || tags.includes(name));
  const results = [];
  for (const directory of directories)
    for (const id of fs.readdirSync(path.join(cache, "exports", directory))) {
      if (selected.length && !selected.includes(id)) continue;
      const location = path.join(cache, "exports", directory, id);
      for (const name of fs.readdirSync(location).filter((n) => n.endsWith(".glb"))) {
        const report = await validator.validateBytes(
          new Uint8Array(fs.readFileSync(path.join(location, name))),
          { uri: name },
        );
        writeJSON(path.join(location, `${name}.validation.json`), report);
        results.push({
          file: path.relative(root, path.join(location, name)),
          errors: report.issues.numErrors,
          warnings: report.issues.numWarnings,
        });
      }
    }
  writeJSON(path.join(cache, "validation-summary.json"), {
    validator: "Khronos glTF Validator",
    license: "Apache-2.0",
    results,
  });
  console.log(JSON.stringify(results, null, 2));
  if (results.some((r) => r.errors)) process.exitCode = 1;
}

async function examples() {
  const { loadSource } = await import("../src/mesh-export/sources.js");
  const { reconstruct } = await import("../src/mesh-export/reconstruct.js");
  const { encodeMesh } = await import("../src/mesh-export/formats.js");
  const entries = [
    ...["torus", "soccer-ball", "rubber-duck", "apple", "diamond", "chess-set"].map((id) => ({
      id,
      source: { kind: "toy", id },
    })),
    ...["still-life", "forest", "spiral-stairs"].map((id) => ({
      id: `photo-${id}`,
      source: { kind: "toy", id: "photo-3d", options: { source: id }, controls: { flat: 0 } },
    })),
  ];
  const options = {
    profile: "desktop",
    resolution: 160,
    level: 1,
    triangleBudget: 100000,
    readyToPrint: true,
    printSize: 100,
    smoothIterations: 3,
    minComponent: 0.002,
  };
  const results = [];
  for (const entry of entries.filter((e) => !selected.length || selected.includes(e.id))) {
    const started = performance.now();
    const { table, metadata } = await loadSource(entry.source, "desktop");
    if (entry.id.startsWith("photo-")) {
      const { SAMPLES } = await import("../src/packs/photo-3d.js");
      Object.assign(
        metadata,
        SAMPLES.find((s) => s.id === entry.source.options.source),
      );
    }
    metadata.name = entry.id;
    const mesh = reconstruct(table, options);
    const directory = path.join(cache, "exports", "examples", entry.id);
    fs.mkdirSync(directory, { recursive: true });
    const files = ["glb", "obj", "stl"].flatMap((format) => encodeMesh(mesh, format, metadata));
    for (const file of files) fs.writeFileSync(path.join(directory, file.name), file.bytes);
    const result = {
      id: entry.id,
      source: entry.source,
      inputSplats: table.count,
      options,
      metadata,
      elapsedSeconds: (performance.now() - started) / 1000,
      files: files.map((f) => ({ name: f.name, bytes: f.bytes.byteLength })),
      topology: inspectTopology(mesh),
      reconstructionReport: mesh.report,
    };
    writeJSON(path.join(directory, "score.json"), result);
    results.push(result);
    console.log(
      `${entry.id}: ${result.elapsedSeconds.toFixed(2)} s; ${table.count} splats; ${result.topology.triangles} triangles; closed/manifold ${result.topology.watertight}/${result.topology.manifold}`,
    );
  }
  writeJSON(path.join(cache, "examples.json"), { measured: new Date().toISOString(), results });
}

async function browserEvidence(runtimeOnly = false) {
  const { chromium } = await import("@playwright/test");
  const phone = args.includes("--phone");
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: phone ? { width: 390, height: 844 } : { width: 1100, height: 900 },
    deviceScaleFactor: 1,
    isMobile: phone,
    hasTouch: phone,
  });
  const port = Number(option("port", 4174));
  let memoryTimer = null;
  try {
    await page.goto(`http://127.0.0.1:${port}/favicon.svg`);
    if (!runtimeOnly) {
      const results = JSON.parse(fs.readFileSync(path.join(cache, "examples.json"))).results;
      const directory = path.join(cache, "evidence");
      fs.mkdirSync(directory, { recursive: true });
      for (const entry of results) {
        const relative = `.cache/mesh-export/exports/examples/${entry.id}/${entry.id}.glb`;
        await page.evaluate(
          async ({ relative, id }) => {
            document.body.innerHTML = `<canvas width="960" height="960" style="width:720px;height:720px"></canvas><p></p>`;
            document.body.style.cssText =
              "margin:0;background:#131b22;color:#dce8ee;font:20px system-ui";
            document.querySelector("p").textContent = `${id} — reconstructed mesh, 100 mm, CC0 1.0`;
            document.querySelector("p").style.cssText =
              "box-sizing:border-box;width:720px;margin:0;padding:12px 16px;font-size:16px;line-height:1.4";
            const buffer = await (await fetch(`/${relative}`)).arrayBuffer();
            const dv = new DataView(buffer),
              jsonLength = dv.getUint32(12, true);
            const json = JSON.parse(
              new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)),
            );
            const binaryStart = 20 + jsonLength + 8;
            const attribute = (index) => {
              const accessor = json.accessors[index],
                view = json.bufferViews[accessor.bufferView];
              const length = accessor.count * (accessor.type === "SCALAR" ? 1 : 3);
              const offset = binaryStart + (view.byteOffset || 0) + (accessor.byteOffset || 0);
              return accessor.componentType === 5125
                ? new Uint32Array(buffer, offset, length)
                : new Float32Array(buffer, offset, length);
            };
            const primitive = json.meshes[0].primitives[0];
            const colors = Float32Array.from(attribute(primitive.attributes.COLOR_0), (v) =>
              v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055,
            );
            const mesh = {
              positions: attribute(primitive.attributes.POSITION),
              normals: attribute(primitive.attributes.NORMAL),
              indices: attribute(primitive.indices),
              colors,
            };
            const { meshPreview } = await import("/src/mesh-export/preview.js");
            meshPreview(document.querySelector("canvas"), mesh);
          },
          { relative, id: entry.id },
        );
        await page.screenshot({
          path: path.join(directory, `${entry.id}.png`),
          clip: { x: 0, y: 0, width: 720, height: 780 },
        });
        console.log(`Rendered actual exported GLB: ${entry.id}.png`);
      }
      return;
    }
    const cdp = await page.context().newCDPSession(page);
    if (phone) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const browserCDP = await browser.newBrowserCDPSession();
    const memorySamples = [];
    const workerHeapSamples = [];
    const workerSessions = new Set();
    let requestId = 0;
    await browserCDP.send("Target.setDiscoverTargets", { discover: true });
    browserCDP.on("Target.targetCreated", async ({ targetInfo }) => {
      // Chromium reports an empty URL at targetCreated; this isolated page starts one worker.
      if (targetInfo.type !== "worker") return;
      try {
        const { sessionId } = await browserCDP.send("Target.attachToTarget", {
          targetId: targetInfo.targetId,
          flatten: false,
        });
        workerSessions.add(sessionId);
      } catch {
        /* A conversion can finish before its target is attached. */
      }
    });
    browserCDP.on("Target.receivedMessageFromTarget", ({ sessionId, message }) => {
      if (!workerSessions.has(sessionId)) return;
      const response = JSON.parse(message);
      if (response.result?.usedSize !== undefined)
        workerHeapSamples.push({ at: performance.now(), ...response.result });
    });
    let memoryBusy = false;
    const sampleMemory = async () => {
      if (memoryBusy) return;
      memoryBusy = true;
      try {
        const { processInfo } = await browserCDP.send("SystemInfo.getProcessInfo");
        let rssKiB = 0;
        for (const process of processInfo) {
          try {
            const status = fs.readFileSync(`/proc/${process.id}/status`, "utf8");
            rssKiB += Number(/VmRSS:\s+(\d+)/.exec(status)?.[1] || 0);
          } catch {
            /* A short-lived browser subprocess may already have exited. */
          }
        }
        memorySamples.push({ at: performance.now(), rssMiB: rssKiB / 1024 });
        for (const sessionId of workerSessions) {
          await browserCDP
            .send("Target.sendMessageToTarget", {
              sessionId,
              message: JSON.stringify({ id: ++requestId, method: "Runtime.getHeapUsage" }),
            })
            .catch(() => {});
        }
      } finally {
        memoryBusy = false;
      }
    };
    await sampleMemory();
    memoryTimer = setInterval(() => sampleMemory().catch(() => {}), 125);
    const result = await page.evaluate(
      async ({ phone }) => {
        const options = {
          profile: phone ? "phone" : "desktop",
          resolution: phone ? 72 : 160,
          level: phone ? 0.5 : 1,
          triangleBudget: phone ? 40000 : 100000,
          readyToPrint: true,
          printSize: 100,
        };
        // Read the same full 450k real scan in either profile; pass its File into the worker so the
        // phone path measures internal 120k sampling, rather than silently opening the lite file.
        const bytes = await (await fetch("/assets/toys/cactus/cactus.sog")).arrayBuffer();
        const source = {
          kind: "file",
          file: new File([bytes], "cactus.sog"),
          license: "CC0 1.0",
          author: "steam studio / 3D SCAN STUDIO iris",
          source: "https://note.com/steam_studio/n/ne9736d94f162",
        };
        const worker = new Worker("/src/mesh-export/worker.js", { type: "module" });
        const progress = [];
        const start = performance.now();
        let convertedAt;
        try {
          return await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              worker.terminate();
              reject(new Error("Worker did not export within 90 seconds."));
            }, 90000);
            worker.onerror = (e) => {
              clearTimeout(timeout);
              reject(new Error(e.message));
            };
            let conversion;
            worker.onmessage = ({ data }) => {
              if (data.error) {
                clearTimeout(timeout);
                reject(new Error(data.error));
                return;
              }
              if (data.progress !== undefined) {
                progress.push({
                  fraction: data.progress,
                  elapsedMs: performance.now() - start,
                  text: data.text,
                });
                return;
              }
              if (data.id === 1) {
                conversion = data.result;
                convertedAt = performance.now();
                worker.postMessage({ id: 2, command: "save", format: "glb" });
              } else if (data.id === 2) {
                clearTimeout(timeout);
                resolve({
                  options,
                  inputSplats: 450000,
                  conversionSeconds: (convertedAt - start) / 1000,
                  totalSeconds: (performance.now() - start) / 1000,
                  report: conversion.report,
                  fileBytes: data.result.files.reduce((sum, f) => sum + f.bytes.length, 0),
                  progress,
                });
              }
            };
            worker.postMessage({ id: 1, command: "convert", source, options });
          });
        } finally {
          worker.terminate();
        }
      },
      { phone },
    );
    clearInterval(memoryTimer);
    await sampleMemory();
    const report = {
      measured: new Date().toISOString(),
      browser: await browser.version(),
      hostCpu: os.cpus()[0]?.model,
      physicalPhone: false,
      cpuThrottlingRate: phone ? 4 : 1,
      workerCpuThrottling: phone
        ? "Unverified. CDP Emulation.setCPUThrottlingRate is set on the page; sending it directly to the worker returns 'Operation is only supported for pages, not workers'. Do not interpret this as measured 4x worker CPU emulation."
        : "None",
      workerHeap: {
        measurement:
          "CDP Runtime.getHeapUsage snapshots from the module worker; fields reported individually. Requests may be serviced between JavaScript tasks, so observed snapshots do not prove the transient peak.",
        samples: workerHeapSamples.length,
        observedMaximaBytes: Object.fromEntries(
          ["usedSize", "totalSize", "embedderHeapUsedSize", "backingStorageSize"].map((key) => [
            key,
            workerHeapSamples.length
              ? Math.max(...workerHeapSamples.map((sample) => sample[key] || 0))
              : null,
          ]),
        ),
      },
      memory: {
        measurement:
          "125 ms samples of summed Linux VmRSS for CDP-listed Chromium processes; shared resident pages may be counted in more than one process. This is browser process RSS, not a physical phone measurement.",
        baselineMiB: memorySamples[0]?.rssMiB,
        observedPeakMiB: Math.max(...memorySamples.map((s) => s.rssMiB)),
        samples: memorySamples.length,
      },
      description: phone
        ? "Chromium mobile viewport/touch emulation with page CDP throttling set to 4x; worker CPU throttling is unverified. Actual 450k source decoded and converted in a module worker. This is not a physical phone measurement."
        : "Desktop Chromium module worker, actual 450k source. Timed from posting File to worker through finished GLB, including input decoding and bounded preview transfer.",
      ...result,
    };
    writeJSON(path.join(cache, `browser-runtime-${phone ? "phone" : "desktop"}.json`), report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    clearInterval(memoryTimer);
    await browser.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (args.includes("--fetch")) await fetchSources();
  else if (args.includes("--run")) await benchmark();
  else if (args.includes("--runtime")) await runtime();
  else if (args.includes("--validate")) await validate();
  else if (args.includes("--samples")) await examples();
  else if (args.includes("--stills")) await browserEvidence();
  else if (args.includes("--browser-runtime")) await browserEvidence(true);
  else
    console.log(
      "Use --fetch, --run, --runtime, --samples, --stills, --browser-runtime, or --validate. Inputs, sources, and results stay outside git in .cache/mesh-export/.",
    );
}
