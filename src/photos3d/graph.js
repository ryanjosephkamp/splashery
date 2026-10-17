// MIT. Made by Ryan with Codex (GPT-6). Exhaustive pairs; no capture-order neighbors.
import { detectSift, matchSiftAsync } from "../../vendor/splatjs/src/sfm/sift.js";
import { gpuMatchAll } from "../../vendor/splatjs/src/sfm/gpumatch.js";
import { runWorkerPool } from "../../vendor/splatjs/src/sfm/worker-pool.js";
import { ransacE, makeRng } from "../../vendor/splatjs/src/sfm/geometry.js";

export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
export function allPairs(count) {
  if (!Number.isInteger(count) || count < 8 || count > 60) throw new RangeError("Use 8–60 photos");
  return Array.from({ length: count }, (_, i) =>
    Array.from({ length: count - i - 1 }, (_, j) => [i, i + j + 1]),
  ).flat();
}

export async function extractFeatures(frames, { signal, onProgress = () => {}, workers = 4 } = {}) {
  signal?.throwIfAborted();
  const features = new Array(frames.length);
  const maxDim = Math.max(...frames.map((f) => Math.max(f.fw, f.fh)));
  const maxFeats = Math.min(8192, Math.max(3900, Math.round(3900 * (maxDim / 960) ** 2)));
  const adopt = (f, i) => {
    features[i] = { ...f, sift: true };
    onProgress({ stage: "features", image: frames[i].name, features: f.n });
  };
  if (typeof Worker !== "undefined" && workers) {
    await runWorkerPool({
      url: new URL("../../vendor/splatjs/src/sfm/featworker.js", import.meta.url),
      size: workers,
      jobs: frames.map((_, i) => i),
      signal,
      message: (id) => ({
        id,
        gray: frames[id].gray,
        w: frames[id].fw,
        h: frames[id].fh,
        maxFeats,
        firstOctave: -1,
        peakScale: 1,
      }),
      onResult: (f) => adopt(f, f.id),
    });
  } else
    for (let i = 0; i < frames.length; i++) {
      signal?.throwIfAborted();
      adopt(detectSift(frames[i].gray, frames[i].fw, frames[i].fh, maxFeats, -1), i);
      await tick();
    }
  return features;
}

export const normalized = (features, calibration, feature) => [
  (features.x[feature] - calibration.cx) / calibration.f,
  (features.y[feature] - calibration.cy) / calibration.f,
];

// Pair seeds depend on canonical identities, not worker completion or picker order.
export function verifyPair(i, j, raw, features, calibration, { iterations = 1200 } = {}) {
  const matches = [];
  for (let k = 0; k < raw.length; k += 2) matches.push([raw[k], raw[k + 1]]);
  const a = matches.map(([k]) => normalized(features[i], calibration[i], k));
  const b = matches.map(([, k]) => normalized(features[j], calibration[j], k));
  const threshold = 2.5 / Math.min(960, calibration[i].f, calibration[j].f);
  const result =
    matches.length >= 25
      ? ransacE(a, b, threshold, makeRng(104 + i * 7919 + j * 104729), iterations)
      : null;
  const inliers = result?.inliers.length || 0;
  const accepted = inliers >= 25 && inliers >= 0.4 * matches.length;
  return {
    i,
    j,
    raw: matches.length,
    inliers,
    accepted,
    reason: accepted
      ? null
      : matches.length < 25
        ? "Fewer than 25 mutual descriptor matches"
        : "Insufficient essential-matrix consensus (25 inliers and 40% required)",
    matches: accepted ? result.inliers.map((k) => matches[k]) : [],
  };
}

export async function matchGraph(
  frames,
  features,
  calibration,
  { signal, gpu, cpuMatching = false, workers = 4, onProgress = () => {} } = {},
) {
  const pairs = allPairs(frames.length);
  let gpuMatches = null;
  const software = /swiftshader|llvmpipe|lavapipe|software/i.test(
    [gpu?.info?.vendor, gpu?.info?.architecture, gpu?.info?.description].join(" "),
  );
  onProgress({
    stage: "matcher-backend",
    backend:
      gpu && !cpuMatching && !software
        ? "WebGPU"
        : typeof Worker !== "undefined" && workers
          ? "CPU workers"
          : "cooperative CPU",
    pairs: pairs.length,
  });
  if (gpu && !cpuMatching && !software) {
    try {
      gpuMatches = await gpuMatchAll(features, pairs, 0.8, () => {}, gpu.device, undefined, {
        signal,
        maxPairsPerChunk: 2,
      });
    } catch (error) {
      signal?.throwIfAborted();
      onProgress({ stage: "matcher-fallback", reason: error.message });
    }
  }
  if (!gpuMatches && typeof Worker !== "undefined" && workers) {
    const results = new Array(pairs.length);
    let done = 0;
    await runWorkerPool({
      url: new URL("./pair-worker.js", import.meta.url),
      size: workers,
      jobs: pairs,
      signal,
      label: "photo pair worker",
      message: ([i, j]) => ({
        i,
        j,
        a: features[i],
        b: features[j],
        ka: calibration[i],
        kb: calibration[j],
      }),
      onResult: (edge, _, index) => {
        results[index] = edge;
        done++;
        if (done % 8 === 0 || done === pairs.length)
          onProgress({ stage: "matching", done, total: pairs.length });
      },
    });
    return results;
  }
  const edges = [];
  for (let p = 0; p < pairs.length; p++) {
    signal?.throwIfAborted();
    const [i, j] = pairs[p];
    const raw =
      gpuMatches?.[p] ??
      (await matchSiftAsync(features[i].desc, features[i].n, features[j].desc, features[j].n, 0.8, {
        signal,
      }));
    edges.push(verifyPair(i, j, raw, features, calibration));
    if (p % 8 === 7 || p === pairs.length - 1) {
      onProgress({ stage: "matching", done: p + 1, total: pairs.length });
      await tick();
    }
  }
  return edges;
}

export function summarizeGraph(frames, features, edges, registered = new Set()) {
  const neighbors = frames.map(() => []);
  for (const e of edges.filter((e) => e.accepted)) {
    neighbors[e.i].push(e.j);
    neighbors[e.j].push(e.i);
  }
  const components = [],
    seen = new Set();
  for (let i = 0; i < frames.length; i++) {
    if (seen.has(i)) continue;
    const queue = [i];
    seen.add(i);
    for (let k = 0; k < queue.length; k++)
      for (const j of neighbors[queue[k]])
        if (!seen.has(j)) {
          seen.add(j);
          queue.push(j);
        }
    components.push(queue.sort((a, b) => a - b).map((j) => frames[j].name));
  }
  return {
    pairs: edges.length,
    acceptedPairs: edges.filter((e) => e.accepted).length,
    components,
    photos: frames.map((f, i) => ({
      name: f.name,
      features: features[i].n,
      support: neighbors[i].length,
      component: components.findIndex((c) => c.includes(f.name)),
      registered: registered.has(i),
      reason: registered.has(i)
        ? null
        : !neighbors[i].length
          ? "No geometrically verified photo pair"
          : "Verified matches did not yield a camera with sufficient triangulated support and PnP consensus",
    })),
    edges: edges.map(({ matches, ...e }) => ({ ...e, a: frames[e.i].name, b: frames[e.j].name })),
  };
}

export function buildTracks(features, edges) {
  const offsets = [0];
  for (const f of features) offsets.push(offsets.at(-1) + f.n);
  const parent = Int32Array.from({ length: offsets.at(-1) }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (const e of edges.filter((e) => e.accepted))
    for (const [a, b] of e.matches) parent[find(offsets[e.i] + a)] = find(offsets[e.j] + b);
  const groups = new Map();
  for (let i = 0; i < features.length; i++)
    for (let k = 0; k < features[i].n; k++) {
      const root = find(offsets[i] + k);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push({ img: i, feat: k });
    }
  return [...groups.values()]
    .filter((obs) => obs.length >= 2 && new Set(obs.map((o) => o.img)).size === obs.length)
    .map((obs) => ({ obs, X: null }));
}
