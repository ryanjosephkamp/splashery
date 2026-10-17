// MIT. Truth is the gate. Source-cue warnings remain separate diagnostics.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { footprint } from "./p3df/scoring.mjs";
import { resampleArea } from "../src/photo3d/pixels.js";
// Same fully valid, unweighted 7x7 luma SSIM as the existing truth scorer.
// Omit its unrelated Laplacian arrays so native phone rasters stay affordable.
export function maskedMetrics(reference, rendered, w, h, mask, edges) {
  if (
    reference.length !== w * h * 4 ||
    rendered.length !== reference.length ||
    mask.length !== w * h ||
    edges.length !== mask.length
  )
    throw new Error("Image dimensions differ");
  const luma = (a, i) => 0.2126 * a[i * 4] + 0.7152 * a[i * 4 + 1] + 0.0722 * a[i * 4 + 2];
  let pixels = 0,
    edgePixels = 0,
    edgeError = 0,
    windows = 0,
    ssim = 0;
  for (let i = 0; i < mask.length; i++)
    if (mask[i] === 1) {
      pixels++;
      if (edges[i]) {
        edgePixels++;
        for (let c = 0; c < 3; c++)
          edgeError += Math.abs(reference[i * 4 + c] - rendered[i * 4 + c]) / 3;
      }
    }
  for (let y = 3; y + 3 < h; y += 7)
    for (let x = 3; x + 3 < w; x += 7) {
      let count = 0,
        a = 0,
        b = 0,
        aa = 0,
        bb = 0,
        ab = 0;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const i = (y + dy) * w + x + dx;
          if (mask[i] !== 1) continue;
          const p = luma(reference, i),
            q = luma(rendered, i);
          count++;
          a += p;
          b += q;
          aa += p * p;
          bb += q * q;
          ab += p * q;
        }
      if (count !== 49) continue;
      a /= 49;
      b /= 49;
      const va = Math.max(0, aa / 49 - a * a),
        vb = Math.max(0, bb / 49 - b * b),
        cov = ab / 49 - a * b;
      ssim +=
        ((2 * a * b + 6.5025) * (2 * cov + 58.5225)) /
        ((a * a + b * b + 6.5025) * (va + vb + 58.5225));
      windows++;
    }
  return {
    pixels,
    ssim: windows ? ssim / windows : null,
    ssimWindows: windows,
    edgePixels,
    edgeHaloMae: edgePixels ? edgeError / edgePixels : null,
  };
}
export function boundaryAccuracy(reference, rendered, w, h, mask, band) {
  const expected = new Uint8Array(w * h),
    actual = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (mask[i] !== 1 || !band[i]) continue;
      for (const j of [i + 1, i + w])
        if (mask[j] === 1) {
          let a = 0,
            b = 0;
          for (let c = 0; c < 3; c++) {
            a += Math.abs(reference[i * 4 + c] - reference[j * 4 + c]);
            b += Math.abs(rendered[i * 4 + c] - rendered[j * 4 + c]);
          }
          if (a > 48) expected[i] = 1;
          if (b > 48) actual[i] = 1;
        }
    }
  const near = (a, i) => {
    const x = i % w,
      y = Math.floor(i / w);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if (x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h && a[(y + dy) * w + x + dx])
          return true;
    return false;
  };
  let count = 0,
    predicted = 0,
    recovered = 0,
    correct = 0;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i]) {
      count++;
      if (near(actual, i)) recovered++;
    }
    if (actual[i]) {
      predicted++;
      if (near(expected, i)) correct++;
    }
  }
  const precision = predicted ? correct / predicted : null,
    recall = count ? recovered / count : null;
  return {
    expected: count,
    predicted,
    precision,
    recall,
    f1: count
      ? predicted && precision + recall
        ? (2 * precision * recall) / (precision + recall)
        : 0
      : null,
  };
}
export function trueBoundaries(z, mask, w, h, band = 2) {
  if (z.length !== w * h || mask.length !== z.length) throw new Error("Bad truth dimensions");
  const edges = new Uint8Array(z.length);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (mask[i] !== 1 || !Number.isFinite(z[i])) continue;
      if (
        ![i - 1, i + 1, i - w, i + w].some(
          (j) =>
            mask[j] & 1 &&
            Number.isFinite(z[j]) &&
            Math.abs(z[j] - z[i]) > 0.05 * Math.min(z[j], z[i]),
        )
      )
        continue;
      for (let dy = -band; dy <= band; dy++)
        for (let dx = -band; dx <= band; dx++) {
          if (y + dy >= 0 && y + dy < h && x + dx >= 0 && x + dx < w) edges[i + dy * w + dx] = 1;
        }
    }
  return edges;
}
export const median = (values) => {
  if (!values.length || values.some((x) => !Number.isFinite(x))) return null;
  const a = [...values].sort((x, y) => x - y),
    m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
export function scoreViews(captureRoot, truthRoot, { partial = false } = {}) {
  const capture = JSON.parse(fs.readFileSync(path.join(captureRoot, "capture.json"))),
    truth = JSON.parse(fs.readFileSync(path.join(truthRoot, "targets.json")));
  if (!partial && (!capture.complete || !truth.complete))
    throw new Error("Incomplete capture or target set");
  const rows = [];
  for (const target of truth.records) {
    const scene = capture.rows.find(
      (r) => r.id === "truth-" + target.scene && r.profile === target.profile,
    );
    if (!scene) {
      if (partial) continue;
      throw new Error("Missing scene/profile");
    }
    if (target.sourcePhotoHash !== scene.photoHash)
      throw new Error("Source photo differs from frozen target");
    const camera = scene.targetCameras.find(
      (c) => c.yaw === target.camera.yaw && c.pitch === target.camera.pitch,
    );
    if (JSON.stringify(camera) !== JSON.stringify(target.camera))
      throw new Error("Candidate camera differs from frozen truth camera");
    const row = scene.rows.find((r) => r.yaw === camera.yaw && r.pitch === camera.pitch);
    const folder = path.join(truthRoot, target.folder),
      pose = target.pose,
      { width: w, height: h } = pose;
    const ref = jpeg.decode(fs.readFileSync(path.join(folder, pose.rgb)), { useTArray: true });
    let rendered = PNG.sync.read(fs.readFileSync(path.join(captureRoot, row.image)));
    if (rendered.width !== w || rendered.height !== h) {
      if (Math.abs(rendered.width / rendered.height - w / h) > 1e-10)
        throw new Error("Candidate raster aspect differs");
      const rgb = resampleArea(
          { w: rendered.width, h: rendered.height, data: rendered.data },
          w,
          h,
        ),
        data = new Uint8Array(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.round(rgb[i * 3 + c] * 255);
        data[i * 4 + 3] = 255;
      }
      rendered = { width: w, height: h, data };
    }
    const maskImage = PNG.sync.read(fs.readFileSync(path.join(folder, pose.mask)));
    if ([ref, rendered, maskImage].some((x) => x.width !== w || x.height !== h))
      throw new Error("Raster mismatch");
    const raw = zlib.gunzipSync(fs.readFileSync(path.join(folder, pose.depth)));
    if (raw.length !== w * h * 4) throw new Error("Depth length mismatch");
    const z = new Float32Array(w * h);
    for (let i = 0; i < z.length; i++) z[i] = raw.readFloatLE(i * 4);
    const support = footprint(target.supportCorners, w, h);
    const mask = Uint8Array.from(z, (_, i) => (support[i] ? maskImage.data[i * 4] : 0));
    const edges = trueBoundaries(z, mask, w, h);
    const metrics = maskedMetrics(ref.data, rendered.data, w, h, mask, edges);
    rows.push({
      scene: target.scene,
      profile: target.profile,
      yaw: camera.yaw,
      pitch: camera.pitch,
      error: metrics.ssim === null ? null : 1 - metrics.ssim,
      ...metrics,
      edgeAccuracy: boundaryAccuracy(ref.data, rendered.data, w, h, mask, edges),
    });
  }
  const novel = rows.filter((r) => r.yaw || r.pitch);
  const knownBoundary = rows.filter((r) => Number.isFinite(r.edgeHaloMae));
  return {
    candidate: capture.candidate,
    complete: capture.complete && truth.complete && rows.length === 216,
    partial,
    views: rows.length,
    novelViews: novel.length,
    medianError: median(rows.map((r) => r.error)),
    rotatedOnlyMedianError: median(novel.map((r) => r.error)),
    boundaryViews: knownBoundary.length,
    boundaryPixels: knownBoundary.reduce((s, r) => s + r.edgePixels, 0),
    medianBoundaryError: median(knownBoundary.map((r) => r.edgeHaloMae)),
    medianEdgeF1: median(rows.map((r) => r.edgeAccuracy.f1).filter(Number.isFinite)),
    scenes: [...new Set(rows.map((r) => r.scene))].map((scene) => ({
      scene,
      error: median(rows.filter((r) => r.scene === scene).map((r) => r.error)),
      boundary: median(knownBoundary.filter((r) => r.scene === scene).map((r) => r.edgeHaloMae)),
    })),
    rows,
  };
}
if (process.argv[1]?.endsWith("p3d-next-score.mjs")) {
  const [capture, truth, out] = process.argv.slice(2);
  const result = scoreViews(capture, truth, { partial: process.argv.includes("--partial") });
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, rows: undefined }));
}
