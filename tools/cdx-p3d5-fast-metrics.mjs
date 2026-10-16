// MIT; made by Ryan with Codex (GPT-6). Same arithmetic and traversal order as
// task 87's tensor diagnostic, without temporary arrays for every image pixel.
import { cohorts } from "./p3df/cohorts.mjs";
import { anchoredEdgesR3 } from "./cdx-p3d2-r3-anchored.mjs";
import { fringeR4 } from "./p3df/artifacts.mjs";
import { coverage } from "./p3df/scoring.mjs";
export { cueDepth, referenceError, revealQuads, severity, summarize } from "./p3df/scoring.mjs";

export function streakExact(image, classes, radius = 3) {
  const { width: w, height: h, data } = image,
    stride = w + 1,
    size = stride * (h + 1);
  const ix = new Float64Array(size),
    ixy = new Float64Array(size),
    iy = new Float64Array(size),
    counts = new Float64Array(size);
  const results = {};
  for (const type of [1, 2]) {
    ix.fill(0);
    ixy.fill(0);
    iy.fill(0);
    counts.fill(0);
    for (let y = 1; y < h - 1; y++) {
      let rx = 0,
        rxy = 0,
        ry = 0,
        count = 0;
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (
          classes[i] === type &&
          classes[i - 1] === type &&
          classes[i + 1] === type &&
          classes[i - w] === type &&
          classes[i + w] === type
        ) {
          let xx = 0,
            xy = 0,
            yy = 0;
          for (let c = 0; c < 3; c++) {
            const gx = (data[(i + 1) * 4 + c] - data[(i - 1) * 4 + c]) / 2,
              gy = (data[(i + w) * 4 + c] - data[(i - w) * 4 + c]) / 2;
            xx += (gx * gx) / 3;
            xy += (gx * gy) / 3;
            yy += (gy * gy) / 3;
          }
          rx += xx;
          rxy += xy;
          ry += yy;
          count++;
        }
        const p = (y + 1) * stride + x + 1;
        ix[p] = ix[p - stride] + rx;
        ixy[p] = ixy[p - stride] + rxy;
        iy[p] = iy[p - stride] + ry;
        counts[p] = counts[p - stride] + count;
      }
      const p = (y + 1) * stride + w;
      ix[p] = ix[p - stride] + rx;
      ixy[p] = ixy[p - stride] + rxy;
      iy[p] = iy[p - stride] + ry;
      counts[p] = counts[p - stride] + count;
    }
    let energy = 0,
      coherence = 0,
      pixels = 0,
      textured = 0,
      flat = 0;
    for (let y = radius + 1; y < h - radius - 1; y++)
      for (let x = radius + 1; x < w - radius - 1; x++) {
        if (classes[y * w + x] !== type) continue;
        const a = (y + radius + 1) * stride + x + radius + 1,
          b = (y - radius) * stride + x + radius + 1,
          c = (y + radius + 1) * stride + x - radius,
          d = (y - radius) * stride + x - radius,
          count = counts[a] - counts[b] - counts[c] + counts[d];
        if (count < 9) continue;
        const xx = ix[a] - ix[b] - ix[c] + ix[d],
          xy = ixy[a] - ixy[b] - ixy[c] + ixy[d],
          yy = iy[a] - iy[b] - iy[c] + iy[d],
          power = (xx + yy) / count;
        energy += power;
        pixels++;
        if (power < 1) flat++;
        else {
          coherence += Math.hypot(xx - yy, 2 * xy) / (xx + yy);
          textured++;
        }
      }
    results[type === 1 ? "revealed" : "visible"] = {
      pixels,
      texturedPixels: textured,
      coherence: textured ? coherence / textured : null,
      gradientEnergy: pixels ? energy / pixels : null,
      flatFraction: pixels ? flat / pixels : null,
    };
  }
  const a = results.revealed,
    b = results.visible;
  return {
    ...results,
    directionalExcess:
      a.coherence === null || b.coherence === null ? null : Math.max(0, a.coherence - b.coherence),
    textureEnergyRatio:
      a.gradientEnergy === null || !(b.gradientEnergy > 0)
        ? null
        : a.gradientEnergy / b.gradientEnergy,
  };
}

export function poseScores(args) {
  const {
    color,
    mask,
    uv,
    field,
    minimum,
    ratio,
    edges,
    thin,
    projectedEdges,
    projectedThin,
    projectedReveal,
    source,
    corners,
  } = args;
  return {
    streak: streakExact(color, cohorts(mask, uv, field, minimum, ratio)),
    holes: coverage(mask, projectedReveal, corners),
    halo: anchoredEdgesR3(color, projectedEdges, edges, source),
    fringe: fringeR4(color, projectedThin, thin, ratio, { localBackground: true }),
  };
}
