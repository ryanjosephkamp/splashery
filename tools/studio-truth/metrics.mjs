// MIT. Metrics never infer metric depth from a toy's arbitrary relief units.
const valid = (z, mask, i) => mask[i] === 1 && Number.isFinite(z[i]) && z[i] > 0;
const compatible = (...arrays) => {
  if (!arrays.length || arrays.some((a) => a.length !== arrays[0].length))
    throw new Error("Metric dimensions differ");
};
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

export function fitInverseDepth(prediction, truth, mask) {
  compatible(prediction, truth, mask);
  let n = 0,
    sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  // Fixed 1-in-8 calibration pixels; the other seven are evaluation pixels.
  for (let i = 0; i < truth.length; i += 8) {
    if (!valid(truth, mask, i) || !Number.isFinite(prediction[i])) continue;
    const x = prediction[i],
      y = 1 / truth[i];
    n++;
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  const denominator = n * sxx - sx * sx;
  if (n < 3 || denominator <= 1e-14) throw new Error("Insufficient calibration variation");
  const scale = (n * sxy - sx * sy) / denominator;
  if (!(scale > 0)) throw new Error("Depth ordering is reversed");
  return { scale, shift: (sy - scale * sx) / n, calibrationPixels: n, split: "index % 8 == 0" };
}

export function depthError(prediction, truth, mask, fit) {
  compatible(prediction, truth, mask);
  let pixels = 0,
    holePixels = 0,
    absRel = 0,
    squared = 0;
  const errors = [];
  for (let i = 0; i < truth.length; i++) {
    if (i % 8 === 0 || !valid(truth, mask, i)) continue;
    pixels++;
    const inverse = fit.scale * prediction[i] + fit.shift;
    if (!Number.isFinite(inverse) || inverse <= 0) {
      holePixels++;
      continue;
    }
    const error = Math.abs(1 / inverse - truth[i]);
    errors.push(error);
    absRel += error / truth[i];
    squared += error * error;
  }
  errors.sort((a, b) => a - b);
  return {
    pixels,
    scoredPixels: errors.length,
    holePixels,
    holeFraction: pixels ? holePixels / pixels : null,
    absRel: errors.length ? absRel / errors.length : null,
    rmseMeters: errors.length ? Math.sqrt(squared / errors.length) : null,
    p95Meters: errors.length ? errors[Math.floor(0.95 * (errors.length - 1))] : null,
  };
}

export function calibratedDepth(prediction, fit) {
  return Float32Array.from(prediction, (v) => {
    const inverse = fit.scale * v + fit.shift;
    return Number.isFinite(inverse) && inverse > 0 ? 1 / inverse : NaN;
  });
}

export function imageMetrics(reference, rendered, width, height, mask, edges = null) {
  compatible(reference, rendered);
  if (reference.length !== width * height * 4 || mask.length !== width * height)
    throw new Error("Image dimensions differ");
  const luma = (a, i) => 0.2126 * a[i * 4] + 0.7152 * a[i * 4 + 1] + 0.0722 * a[i * 4 + 2];
  let pixels = 0,
    holePixels = 0,
    absolute = 0,
    squared = 0,
    halo = 0,
    edgePixels = 0;
  const ssims = [],
    refL = [],
    renderL = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (mask[i] !== 1) continue;
      pixels++;
      if (rendered[i * 4 + 3] < 128) holePixels++;
      let error = 0;
      for (let c = 0; c < 3; c++) {
        const d = reference[i * 4 + c] - rendered[i * 4 + c];
        absolute += Math.abs(d);
        squared += d * d;
        error += Math.abs(d) / 3;
      }
      if (edges?.[i]) {
        halo += error;
        edgePixels++;
      }
      if (
        x > 0 &&
        x < width - 1 &&
        y > 0 &&
        y < height - 1 &&
        [i - 1, i + 1, i - width, i + width].every((j) => mask[j] === 1)
      ) {
        const lap = (a) =>
          luma(a, i - 1) +
          luma(a, i + 1) +
          luma(a, i - width) +
          luma(a, i + width) -
          4 * luma(a, i);
        refL.push(lap(reference));
        renderL.push(lap(rendered));
      }
      // Local 7x7 unweighted SSIM, fully valid windows only. No global-SSIM claim.
      if (x % 7 === 3 && y % 7 === 3 && x >= 3 && y >= 3 && x + 3 < width && y + 3 < height) {
        const a = [],
          b = [];
        for (let dy = -3; dy <= 3; dy++)
          for (let dx = -3; dx <= 3; dx++) {
            const j = i + dy * width + dx;
            if (mask[j] !== 1) continue;
            a.push(luma(reference, j));
            b.push(luma(rendered, j));
          }
        if (a.length !== 49) continue;
        const ma = mean(a),
          mb = mean(b);
        let va = 0,
          vb = 0,
          cov = 0;
        for (let j = 0; j < 49; j++) {
          va += (a[j] - ma) ** 2;
          vb += (b[j] - mb) ** 2;
          cov += (a[j] - ma) * (b[j] - mb);
        }
        va /= 49;
        vb /= 49;
        cov /= 49;
        ssims.push(
          ((2 * ma * mb + 6.5025) * (2 * cov + 58.5225)) /
            ((ma * ma + mb * mb + 6.5025) * (va + vb + 58.5225)),
        );
      }
    }
  const variance = (a) => {
    const avg = mean(a);
    return a.length ? mean(a.map((v) => (v - avg) ** 2)) : null;
  };
  const refVar = variance(refL),
    renderVar = variance(renderL);
  const mse = pixels ? squared / (3 * pixels) : null;
  return {
    pixels,
    holePixels,
    holeFraction: pixels ? holePixels / pixels : null,
    mae: pixels ? absolute / (3 * pixels) : null,
    psnr: mse > 0 ? 10 * Math.log10((255 * 255) / mse) : null,
    exactMatch: mse === 0,
    ssim: mean(ssims),
    ssimWindows: ssims.length,
    sharpnessRatio: refVar > 0 ? renderVar / refVar : null,
    edgeHaloMae: edgePixels ? halo / edgePixels : null,
    edgePixels,
  };
}

const transform = (m, p) =>
  m.slice(0, 3).map((row) => row[0] * p[0] + row[1] * p[1] + row[2] * p[2] + row[3]);

export function temporalJitter(
  predA,
  predB,
  truthA,
  truthB,
  maskA,
  maskB,
  poseA,
  poseB,
  width,
  height,
) {
  compatible(predA, predB, truthA, truthB, maskA, maskB);
  const kA = poseA.K,
    kB = poseB.K,
    errors = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!valid(truthA, maskA, i) || !Number.isFinite(predA[i])) continue;
      const ray = [(x + 0.5 - kA[0][2]) / kA[0][0], (y + 0.5 - kA[1][2]) / kA[1][1], 1];
      const truthP = transform(
        poseB.world_to_camera,
        transform(
          poseA.camera_to_world,
          ray.map((v) => v * truthA[i]),
        ),
      );
      if (truthP[2] <= 0) continue;
      const u = Math.floor((kB[0][0] * truthP[0]) / truthP[2] + kB[0][2]);
      const v = Math.floor((kB[1][1] * truthP[1]) / truthP[2] + kB[1][2]);
      if (u < 0 || v < 0 || u >= width || v >= height) continue;
      const j = v * width + u;
      // Reject disocclusion, sky, and non-Lambertian correspondence.
      if (
        !valid(truthB, maskB, j) ||
        Math.abs(truthB[j] - truthP[2]) > Math.max(0.02, 0.01 * truthP[2]) ||
        !Number.isFinite(predB[j])
      )
        continue;
      const predP = transform(
        poseB.world_to_camera,
        transform(
          poseA.camera_to_world,
          ray.map((q) => q * predA[i]),
        ),
      );
      // Change in signed depth residual at the same world point, not screen-pixel drift.
      errors.push(Math.abs(predP[2] - truthP[2] - (predB[j] - truthB[j])));
    }
  return {
    pixels: errors.length,
    meanMeters: mean(errors),
    maxMeters: errors.length ? Math.max(...errors) : null,
  };
}
