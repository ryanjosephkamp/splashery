// MIT. Common source grid, held-out calibration pixels, and explicit support.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { sampleTruth } from "./studio-truth/sampling.mjs";
import { referenceError } from "./p3df/scoring.mjs";
import { calibratedDepth } from "./studio-truth/metrics.mjs";
import { trueBoundaries, median } from "./p3d-next-score.mjs";

function resample(data, w, h, tw, th) {
  return Float32Array.from({ length: tw * th }, (_, i) => {
    const u = Math.max(0, Math.min(w - 1, (((i % tw) + 0.5) * w) / tw - 0.5)),
      v = Math.max(0, Math.min(h - 1, ((Math.floor(i / tw) + 0.5) * h) / th - 0.5)),
      x = Math.floor(u),
      y = Math.floor(v),
      fx = u - x,
      fy = v - y;
    const values = [
      data[y * w + x],
      data[y * w + Math.min(w - 1, x + 1)],
      data[Math.min(h - 1, y + 1) * w + x],
      data[Math.min(h - 1, y + 1) * w + Math.min(w - 1, x + 1)],
    ];
    if (values.some((x) => !Number.isFinite(x))) return NaN;
    return (
      (values[0] * (1 - fx) + values[1] * fx) * (1 - fy) +
      (values[2] * (1 - fx) + values[3] * fx) * fy
    );
  });
}
export function depthBoundaryAccuracy(pred, truth, mask, w, h) {
  const a = trueBoundaries(pred, mask, w, h, 0),
    b = trueBoundaries(truth, mask, w, h, 0),
    aa = trueBoundaries(pred, mask, w, h, 2),
    bb = trueBoundaries(truth, mask, w, h, 2);
  let actual = 0,
    expected = 0,
    matchedActual = 0,
    matchedExpected = 0;
  for (let i = 0; i < a.length; i++)
    if (mask[i] === 1) {
      if (a[i]) {
        actual++;
        if (bb[i]) matchedActual++;
      }
      if (b[i]) {
        expected++;
        if (aa[i]) matchedExpected++;
      }
    }
  const precision = actual ? matchedActual / actual : null,
    recall = expected ? matchedExpected / expected : null;
  return {
    actual,
    expected,
    precision,
    recall,
    f1: expected
      ? actual && precision + recall
        ? (2 * precision * recall) / (precision + recall)
        : 0
      : null,
  };
}
// Inverse depth on a perspective plane is affine in image coordinates.
// Fit one eighth of floor pixels and evaluate the rest; normalize by its range.
export function planeResidual(values, w, h, y0 = 0, y1 = h) {
  const a = Array.from({ length: 3 }, () => [0, 0, 0, 0]);
  let count = 0,
    lo = Infinity,
    hi = -Infinity;
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        z = values[i];
      if (!Number.isFinite(z)) continue;
      lo = Math.min(lo, z);
      hi = Math.max(hi, z);
      if (i % 8 !== 0) continue;
      const v = [x / w, y / h, 1];
      count++;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) a[r][c] += v[r] * v[c];
        a[r][3] += v[r] * z;
      }
    }
  if (count < 4) return null;
  for (let c = 0; c < 3; c++) {
    let pivot = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    if (Math.abs(a[c][c]) < 1e-12) return null;
    const scale = a[c][c];
    for (let k = c; k < 4; k++) a[c][k] /= scale;
    for (let r = 0; r < 3; r++)
      if (r !== c) {
        const gain = a[r][c];
        for (let k = c; k < 4; k++) a[r][k] -= gain * a[c][k];
      }
  }
  let error = 0,
    n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        z = values[i];
      if (i % 8 === 0 || !Number.isFinite(z)) continue;
      error += (z - (a[0][3] * x) / w - (a[1][3] * y) / h - a[2][3]) ** 2;
      n++;
    }
  return n ? (hi > lo ? Math.sqrt(error / n) / (hi - lo) : 0) : null;
}

// These are narrow checks of the lab's qualitative expect lines, not metric truth.
export function labExpectation(row, values, rgb = null) {
  const v = row.variables || {},
    result = { expect: row.expect, verdict: null };
  if (row.category === "c")
    return { ...result, check: "flat-plane span; no calibrated pass threshold" };
  if (row.category === "e" && rgb) {
    const cue =
      v.mode === "pair"
        ? v.overlap > 0
        : v.mode === "t"
          ? v.tGapPx <= 0 && v.tOverhangPx > 0
          : false;
    if (!cue || v.frontGray === v.backGray || v.frontGray === 224 || v.backGray === 224)
      return { ...result, check: "no isolated two-shape order cue" };
    const regions = [[], []];
    for (let i = 0; i < values.length; i++)
      if (Number.isFinite(values[i])) {
        const gray = ((rgb[i * 3] + rgb[i * 3 + 1] + rgb[i * 3 + 2]) * 255) / 3;
        for (const [k, expected] of [v.backGray, v.frontGray].entries())
          if (Math.abs(gray - expected) < 1) regions[k].push(values[i]);
      }
    const back = median(regions[0]),
      front = median(regions[1]);
    return {
      ...result,
      check: "visible uniform front has greater inverse depth than back",
      backPixels: regions[0].length,
      frontPixels: regions[1].length,
      verdict: back !== null && front !== null ? front > back : null,
    };
  }
  if (row.category === "f" && row.expect.startsWith("Under a floor")) {
    const rows = [];
    for (let y = Math.ceil((v.horizonY + 0.1) * row.h); y < row.h * 0.95; y++) {
      const line = Array.from(values.subarray(y * row.w, (y + 1) * row.w)).filter(Number.isFinite);
      if (line.length) rows.push(median(line));
    }
    let agreed = 0;
    for (let i = 1; i < rows.length; i++) if (rows[i] > rows[i - 1]) agreed++;
    return {
      ...result,
      check: "inverse depth increases away from horizon",
      rowPairs: Math.max(0, rows.length - 1),
      planeResidual: planeResidual(
        values,
        row.w,
        row.h,
        Math.ceil((v.horizonY + 0.1) * row.h),
        Math.floor(row.h * 0.95),
      ),
      orderFraction: rows.length > 1 ? agreed / (rows.length - 1) : null,
    };
  }
  return {
    ...result,
    check: "qualitative coherence, thin parts, or ambiguous geometry needs visual review",
  };
}

export function depthScores(folder, { truthOnly = false } = {}) {
  const result = JSON.parse(fs.readFileSync(path.join(folder, "depth.json"))),
    rows = [];
  for (const r of result.rows.filter((r) => !truthOnly || r.category === "truth")) {
    const bytes = fs.readFileSync(path.join(folder, r.id + ".f32"));
    const values = new Float32Array(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    if (r.category !== "truth") {
      const valid = values.filter(Number.isFinite).sort(),
        mid = Math.floor(valid.length / 2),
        middle = valid.length
          ? valid.length % 2
            ? valid[mid]
            : (valid[mid - 1] + valid[mid]) / 2
          : null,
        p02 = valid[Math.floor(0.02 * (valid.length - 1))],
        p98 = valid[Math.floor(0.98 * (valid.length - 1))];
      rows.push({
        id: r.id,
        category: r.category,
        expect: r.expect,
        validFraction: valid.length / values.length,
        relativeSpan: middle > 0 ? (p98 - p02) / middle : null,
        expectation: labExpectation(
          r,
          values,
          (() => {
            const file = path.resolve(".cache/photo-3d-next/production-inputs", r.id + ".f32");
            if (r.category !== "e" || !fs.existsSync(file)) return null;
            const raw = fs.readFileSync(file);
            if (raw.length !== values.length * 12) throw new Error("Lab tensor dimensions differ");
            return new Float32Array(
              raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
            );
          })(),
        ),
        ms: r.ms,
      });
      continue;
    }
    const dir = path.dirname(r.truth),
      pose = JSON.parse(fs.readFileSync(r.truth)).frames[0],
      raw = zlib.gunzipSync(fs.readFileSync(path.join(dir, pose.depth))),
      z = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)),
      m = PNG.sync.read(fs.readFileSync(path.join(dir, pose.mask))),
      rgb = jpeg.decode(fs.readFileSync(path.join(dir, pose.rgb)), { useTArray: true });
    const w = 518,
      h = 294,
      truth = sampleTruth(
        { pose, z, mask: Uint8Array.from(z, (_, i) => m.data[i * 4]), rgb: rgb.data },
        w,
        h,
      ),
      pred = resample(values, r.w, r.h, w, h),
      error = referenceError(pred, truth.z, truth.mask);
    const calibrated = error.fit
      ? calibratedDepth(pred, error.fit)
      : new Float32Array(w * h).fill(NaN);
    let total = 0,
      delta1 = 0;
    for (let i = 0; i < calibrated.length; i++)
      if (i % 8 !== 0 && truth.mask[i] === 1 && truth.z[i] > 0) {
        total++;
        if (
          calibrated[i] > 0 &&
          Number.isFinite(calibrated[i]) &&
          Math.max(calibrated[i] / truth.z[i], truth.z[i] / calibrated[i]) < 1.25
        )
          delta1++;
      }
    rows.push({
      id: r.id,
      category: r.category,
      ms: r.ms,
      ...error,
      delta1: total ? delta1 / total : null,
      boundary: depthBoundaryAccuracy(calibrated, truth.z, truth.mask, w, h),
    });
  }
  const truth = rows.filter((x) => x.category === "truth");
  return {
    model: result.model,
    tokens: result.tokens ?? (result.model.startsWith("moge") ? 1200 : null),
    backend: result.backend,
    side: result.side,
    selectionComplete: result.selectionComplete || false,
    modelBytes: result.modelBytes,
    modelSha256: result.modelSha256,
    complete: result.complete,
    inputCount: rows.length,
    lab: ["c", "e", "f", "j"].map((category) => {
      const part = rows.filter((r) => r.category === category),
        supported = part.filter((r) => r.expectation.verdict !== null);
      return {
        category,
        inputs: part.length,
        medianRelativeSpan: median(part.map((r) => r.relativeSpan)),
        orderSupported: supported.length,
        orderCorrect: supported.filter((r) => r.expectation.verdict).length,
        floorRowOrder: median(part.map((r) => r.expectation.orderFraction).filter(Number.isFinite)),
        planeResidual: median(part.map((r) => r.expectation.planeResidual).filter(Number.isFinite)),
        qualitativeReviewComplete: false,
      };
    }),
    truthCount: truth.length,
    absRel: median(truth.map((x) => x.absRel)),
    delta1: median(truth.map((x) => x.delta1)),
    orderError: median(truth.map((x) => x.reversedFraction)),
    boundaryF1: median(truth.map((x) => x.boundary.f1)),
    rows,
  };
}
if (process.argv[1]?.endsWith("p3d-next-depth-score.mjs")) {
  const result = depthScores(process.argv[2], { truthOnly: process.argv.includes("--truth-only") });
  fs.writeFileSync(process.argv[3], JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, rows: undefined }));
}
