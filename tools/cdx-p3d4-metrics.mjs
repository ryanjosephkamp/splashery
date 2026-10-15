// Independent color diagnostics. These measure artifacts, not the authenticity
// of hidden content. Counts accompany every score; absent support stays null.
import { colorAtR3 } from "./cdx-p3d2-r3-anchored.mjs";
const distance = (a, b) => Math.hypot(...a.map((v, c) => v - b[c]));
const average = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

export function streakR4(image, classes, radius = 3) {
  const { width: w, height: h, data } = image,
    stride = w + 1;
  const integral = Array.from({ length: 4 }, () => new Float64Array((w + 1) * (h + 1)));
  const results = {};
  for (const type of [1, 2]) {
    for (const a of integral) a.fill(0);
    for (let y = 1; y < h - 1; y++) {
      const row = [0, 0, 0, 0];
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (classes[i] === type && [i - 1, i + 1, i - w, i + w].every((j) => classes[j] === type)) {
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
          row[0] += xx;
          row[1] += xy;
          row[2] += yy;
          row[3]++;
        }
        const p = (y + 1) * stride + x + 1;
        for (let k = 0; k < 4; k++) integral[k][p] = integral[k][p - stride] + row[k];
      }
      const p = (y + 1) * stride + w;
      for (let k = 0; k < 4; k++) integral[k][p] = integral[k][p - stride] + row[k];
    }
    const coherence = [],
      energy = [];
    let flat = 0;
    for (let y = radius + 1; y < h - radius - 1; y++)
      for (let x = radius + 1; x < w - radius - 1; x++) {
        if (classes[y * w + x] !== type) continue;
        const box = integral.map((a) => a[(y + radius + 1) * stride + x + radius + 1] - a[(y - radius) * stride + x + radius + 1] - a[(y + radius + 1) * stride + x - radius] + a[(y - radius) * stride + x - radius]); // prettier-ignore
        const [xx, xy, yy, count] = box;
        if (count < 9) continue;
        const power = (xx + yy) / count;
        energy.push(power);
        if (power < 1) flat++;
        else coherence.push(Math.hypot(xx - yy, 2 * xy) / (xx + yy));
      }
    results[type === 1 ? "revealed" : "visible"] = {
      pixels: energy.length,
      texturedPixels: coherence.length,
      coherence: average(coherence),
      gradientEnergy: average(energy),
      flatFraction: energy.length ? flat / energy.length : null,
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

export function thinAnchorsR4(photo, field, maxAnchors = 240) {
  const { width: w, height: h } = photo,
    anchors = [];
  let candidates = 0,
    depthRejected = 0;
  const rgb = (x, y) => colorAtR3(photo, x, y);
  const z = (x, y) => field.data[Math.min(field.height - 1, Math.max(0, Math.floor((y + 0.5) * field.height / h))) * field.width + Math.min(field.width - 1, Math.max(0, Math.floor((x + 0.5) * field.width / w)))] / 255; // prettier-ignore
  for (let y = 16; y < h - 16; y += 3)
    for (let x = 16; x < w - 16; x += 3)
      for (let axis = 0; axis < 2; axis++) {
        const dx = axis ? 0 : 1,
          dy = axis ? 1 : 0,
          near = rgb(x, y);
        if (distance(near, rgb(x + dy * 4, y + dx * 4)) > 28 || distance(near, rgb(x - dy * 4, y - dx * 4)) > 28) continue; // prettier-ignore
        let lo = 0,
          hi = 0;
        while (lo > -12 && distance(near, rgb(x + dx * (lo - 1), y + dy * (lo - 1))) < 40) lo--;
        while (hi < 12 && distance(near, rgb(x + dx * (hi + 1), y + dy * (hi + 1))) < 40) hi++;
        if (lo === -12 || hi === 12 || hi - lo + 1 > 12) continue;
        const left = rgb(x + dx * (lo - 3), y + dy * (lo - 3)),
          right = rgb(x + dx * (hi + 3), y + dy * (hi + 3));
        if (distance(left, right) > 24 || distance(near, left) < 80 || distance(near, right) < 80)
          continue;
        if (distance(left, rgb(x + dx * (lo - 5), y + dy * (lo - 5))) > 24 || distance(right, rgb(x + dx * (hi + 5), y + dy * (hi + 5))) > 24) continue; // prettier-ignore
        candidates++;
        let depth = 0;
        for (let t = lo; t <= hi; t++) depth = Math.max(depth, z(x + dx * t, y + dy * t));
        if (depth - Math.max(z(x + dx * (lo - 7), y + dy * (lo - 7)), z(x + dx * (hi + 7), y + dy * (hi + 7))) < 0.02) { depthRejected++; continue; } // prettier-ignore
        const profile = [];
        for (let t = lo - 7; t <= hi + 7; t += 0.5) {
          const sx = x + dx * t,
            sy = y + dy * t;
          profile.push({ u: (sx + 0.5) / w, v: (sy + 0.5) / h, depth, rgb: rgb(sx, sy) });
        }
        anchors.push({
          x,
          y,
          axis,
          width: hi - lo + 1,
          near,
          far: left.map((v, c) => (v + right[c]) / 2),
          profile,
        });
      }
  // Deterministic, evenly spaced thinning, independent of either rendered result.
  const step = Math.max(1, Math.ceil(anchors.length / maxAnchors));
  return {
    candidates,
    depthRejected,
    supported: anchors.length,
    anchors: anchors.filter((_, i) => i % step === 0),
  };
}

export function fringeR4(actual, projected, anchors, ratio = 1, { localBackground = false } = {}) {
  const values = [],
    widths = [];
  let evaluated = 0,
    missing = 0,
    correctedBackgrounds = 0;
  for (let i = 0; i < anchors.length; i++) {
    const points = projected[i],
      a = anchors[i];
    if (points.some(([x, y]) => x < 1 || y < 1 || x >= actual.width - 1 || y >= actual.height - 1))
      continue;
    const direction = a.near.map((v, c) => v - a.far[c]),
      norm = direction.reduce((s, v) => s + v * v, 0),
      alpha = (color) =>
        Math.max(
          0,
          Math.min(1, color.reduce((s, v, c) => s + (v - a.far[c]) * direction[c], 0) / norm),
        );
    const probe = (p) => colorAtR3(actual, p[0] - 0.5, p[1] - 0.5);
    const left = points.slice(0, 3).map(probe),
      right = points.slice(-3).map(probe);
    const mean = (colors) => [0, 1, 2].map((c) => average(colors.map((v) => v[c])));
    const l = mean(left),
      r = mean(right);
    const stable =
      localBackground &&
      left.every((v) => distance(v, l) < 24) &&
      right.every((v) => distance(v, r) < 24) &&
      distance(l, r) < 48 &&
      distance(l, a.near) > 40 &&
      distance(r, a.near) > 40;
    if (stable) correctedBackgrounds++;
    let excess = 0,
      expectedWidth = 0,
      actualWidth = 0,
      peak = 0;
    for (let j = 0; j < points.length - 1; j++) {
      const p = points[j],
        q = points[j + 1],
        length = Math.hypot(p[0] - q[0], p[1] - q[1]),
        steps = Math.max(1, Math.ceil(length * 2));
      for (let k = 0; k < steps; k++) {
        const f = (k + 0.5) / steps,
          color = colorAtR3(actual, p[0] + (q[0] - p[0]) * f - 0.5, p[1] + (q[1] - p[1]) * f - 0.5),
          background = stable
            ? l.map((v, c) => v + ((r[c] - v) * (j + f)) / (points.length - 1))
            : a.far,
          contrast = a.near.map((v, c) => v - background[c]),
          observed = stable
            ? Math.max(
                0,
                Math.min(
                  1,
                  color.reduce((sum, v, c) => sum + (v - background[c]) * contrast[c], 0) /
                    contrast.reduce((sum, v) => sum + v * v, 0),
                ),
              )
            : alpha(color),
          expected = alpha(a.profile[j].rgb.map((v, c) => v + (a.profile[j + 1].rgb[c] - v) * f)),
          ds = length / (steps * ratio);
        peak = Math.max(peak, observed);
        excess += Math.max(0, 4 * observed * (1 - observed) - 4 * expected * (1 - expected)) * ds;
        expectedWidth += expected * ds;
        actualWidth += observed * ds;
      }
    }
    evaluated++;
    if (peak < 0.5) missing++;
    values.push(excess / 2);
    widths.push(Math.abs(actualWidth - expectedWidth));
  }
  values.sort((a, b) => a - b);
  return {
    evaluated,
    missing,
    fringeMean: average(values),
    fringeP95: values.length ? values[Math.floor(0.95 * (values.length - 1))] : null,
    fringeMax: values.at(-1) ?? null,
    widthErrorMean: average(widths),
    units: "CSS pixels per thin edge",
    ...(localBackground
      ? { correctedBackgrounds, backgroundUncertain: evaluated - correctedBackgrounds }
      : {}),
  };
}
