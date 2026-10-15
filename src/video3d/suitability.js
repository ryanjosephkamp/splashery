// A fast local estimate, not a camera solve or a guarantee. No model, trainer, or network.
import { openVideo, closeVideo, seekPresented } from "./extract.js";
import { fitSide, sharpness } from "./frames.js";

const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] || 0;
const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);

function frameStats({ gray, width, height }) {
  const brightness = mean(gray);
  const contrast = Math.sqrt(mean(Array.from(gray, (v) => (v - brightness) ** 2)));
  return { brightness, contrast, sharp: sharpness(gray, width, height) };
}

// Small patches matched after subtracting their average brightness. A common displacement is
// consistent with panning. Radial expansion can be forward movement or zoom; residual motion can
// be depth, independently moving objects, or matching error. None of these proves a camera solve.
function motion(a, b) {
  const w = a.width;
  const h = a.height;
  const flows = [];
  for (let y = 14; y < h - 14; y += 16) {
    for (let x = 14; x < w - 14; x += 16) {
      const patch = [];
      for (let yy = -4; yy <= 4; yy += 2)
        for (let xx = -4; xx <= 4; xx += 2) patch.push(a.gray[(y + yy) * w + x + xx]);
      const m = mean(patch);
      const variance = mean(patch.map((v) => (v - m) ** 2));
      if (variance < 80) continue;
      let best = Infinity;
      let dx = 0;
      let dy = 0;
      for (let iy = -6; iy <= 6; iy++) {
        for (let ix = -8; ix <= 8; ix++) {
          let sum = 0;
          let squares = 0;
          let k = 0;
          for (let yy = -4; yy <= 4; yy += 2) {
            for (let xx = -4; xx <= 4; xx += 2) {
              const d = patch[k++] - b.gray[(y + yy + iy) * w + x + xx + ix];
              sum += d;
              squares += d * d;
            }
          }
          const error = (squares / k - (sum / k) ** 2) / variance;
          if (error < best) {
            best = error;
            dx = ix;
            dy = iy;
          }
        }
      }
      flows.push({ x: x - w / 2, y: y - h / 2, dx, dy, error: best });
    }
  }
  const good = flows.filter((v) => v.error < 0.65);
  const mx = median(good.map((v) => v.dx));
  const my = median(good.map((v) => v.dy));
  const radius2 = good.reduce((s, v) => s + v.x * v.x + v.y * v.y, 0) || 1;
  const zoom = good.reduce((s, v) => s + v.x * (v.dx - mx) + v.y * (v.dy - my), 0) / radius2;
  const residuals = good.map((v) => Math.hypot(v.dx - mx - zoom * v.x, v.dy - my - zoom * v.y));
  return {
    dx: mx,
    dy: my,
    zoom,
    outliers: mean(residuals.map((v) => Number(v > 2))),
    residual: median(residuals),
    displacement: median(good.map((v) => Math.hypot(v.dx, v.dy))),
    spread: mean(good.map((v) => Math.hypot(v.dx - mx, v.dy - my))),
    unmatched: 1 - good.length / Math.max(1, flows.length),
    patches: flows.length,
  };
}

export function assessFrames(frames) {
  if (
    frames.length < 3 ||
    frames.some(
      (f) =>
        !f.gray ||
        f.gray.length !== f.width * f.height ||
        f.width !== frames[0].width ||
        f.height !== frames[0].height,
    )
  )
    return {
      checked: false,
      verdict: "unknown",
      message: "Could not check enough frames. Try a playable, shorter stretch.",
      reasons: [],
      metrics: { frames: frames.length },
    };
  const stats = frames.map(frameStats);
  const motions = frames
    .slice(1)
    .flatMap((b, i) => (b.group === frames[i].group ? [motion(frames[i], b)] : []));
  // Short triplets measure local speed and direction changes. Distant centers only establish
  // that the camera moved at all: their mismatches cannot diagnose instability within a shot.
  const grouped = frames[0].group !== undefined;
  const centers = frames.filter((_, i) => i % 3 === 1);
  const wide = grouped ? centers.slice(1).map((b, i) => motion(centers[i], b)) : motions;
  const metrics = {
    frames: frames.length,
    brightness: median(stats.map((s) => s.brightness)),
    sharpness: median(stats.map((s) => s.sharp)),
    contrast: median(stats.map((s) => s.contrast)),
    exposure:
      Math.max(...stats.map((s) => s.brightness)) - Math.min(...stats.map((s) => s.brightness)),
    motion: median(motions.map((m) => m.displacement)),
    parallax: median(motions.map((m) => m.spread)),
    unmatched: mean(motions.map((m) => m.unmatched)),
    wideMotion: median(wide.map((m) => m.displacement)),
    outliers: mean(motions.map((m) => m.outliers)),
    residual: median(motions.map((m) => m.residual)),
    zoom: Math.max(0, ...motions.map((m) => Math.abs(m.zoom))),
    texturePatches: median(motions.map((m) => m.patches)),
    worstUnmatched: Math.max(0, ...motions.map((m) => m.unmatched)),
    localWindows: grouped,
    reversals: grouped
      ? motions.filter(
          (m, i) => i % 2 === 1 && m.dx * motions[i - 1].dx + m.dy * motions[i - 1].dy < -1,
        ).length
      : 0,
  };
  return assessMetrics(metrics);
}

// Kept pure so the measured calibration cases can guard the thresholds without redistributing
// the privately retained counterexample videos (which include people and signs).
export function assessMetrics(metrics) {
  const reasons = [];
  let poor = false;
  if (Number.isFinite(metrics.brightness) && metrics.brightness < 22) {
    reasons.push(
      "This stretch is too dark to recover reliable detail. Try brighter, even light, or choose a better-lit stretch.",
    );
    poor = true;
  }
  if (metrics.contrast < 12 || metrics.texturePatches < 4) {
    reasons.push(
      "Too few textured details to match. Include brick, bark, stone, or other detailed surfaces.",
    );
    poor = true;
  }
  if (metrics.sharpness < 35) {
    reasons.push(
      "The picture is soft or blurred. Move slowly, hold steady, and use brighter, even light.",
    );
    poor = true;
  }
  if (metrics.exposure > 24)
    reasons.push("Brightness changes a lot. Keep the same exposure and even light.");
  if (Math.max(metrics.motion, metrics.wideMotion) < 0.6) {
    reasons.push(
      "Very little camera motion. Walk slowly sideways or around something rather than filming from one spot.",
    );
    poor = true;
  } else if (metrics.parallax < 0.6)
    reasons.push(
      "Little difference in how near and far details move. This may be a pan; move through the place, rather than only turning.",
    );
  if (metrics.unmatched > 0.2 || metrics.outliers > 0.22 || metrics.worstUnmatched > 0.7)
    reasons.push(
      "Many patches do not line up. Fast motion, a cut, moving objects, or reflections may cause this. Try a steady stretch without moving people or cars.",
    );
  // Calibrated on six shipped real cuts and three privately retained real counterexamples.
  // At 128 px, >5 px per 0.25 s with many inconsistent patches marks a rapid, unstable pan.
  // A >10% radial change in one pair marks a sudden zoom/approach, not reliable depth evidence.
  if (
    metrics.localWindows &&
    metrics.motion > 5 &&
    (metrics.outliers > 0.25 || metrics.reversals > 0)
  ) {
    reasons.push("The camera moves quickly and inconsistently. Choose a slower, steadier stretch.");
    poor = true;
  }
  if (metrics.localWindows && metrics.zoom > 0.1) {
    reasons.push(
      "The picture expands or shrinks suddenly. Avoid fast zooms, and move slowly through the place.",
    );
    poor = true;
  }
  const verdict = poor ? "poor" : reasons.length ? "caution" : "promising";
  const message =
    verdict === "promising"
      ? "Looks promising: sharp details and motion that suggests depth. Training still has to solve the camera path."
      : verdict === "poor"
        ? "This stretch is unlikely to make a clean 3D scene."
        : "This stretch may work, with some risks.";
  return { checked: true, verdict, message, reasons, metrics };
}

export async function checkVideo(file, { start = 0, length = 10, signal } = {}) {
  const ctrl = new AbortController();
  const cancel = () => ctrl.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, 4500);
  let opened;
  try {
    opened = await openVideo(file, { signal: ctrl.signal, timeoutMs: 4000 });
    const [width, height] = fitSide(opened.width, opened.height, 128);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    const from = Math.min(Math.max(0, Number(start) || 0), Math.max(0, opened.duration - 0.1));
    const span = Math.min(Math.max(0.1, Number(length) || 10), opened.duration - from);
    const frames = [];
    // Four short triplets retain coverage of the shot while observing motion within each
    // window. Four frames several seconds apart missed shaking and outran the patch search.
    const fractions = [0.05, 0.35, 0.65, 0.95];
    const delta = Math.min(0.25, span * 0.025);
    for (const [group, fraction] of fractions.entries()) {
      for (const offset of [-delta, 0, delta]) {
        await seekPresented(opened.video, from + span * fraction + offset, {
          signal: ctrl.signal,
          timeoutMs: 1000,
        });
        g.drawImage(opened.video, 0, 0, width, height);
        const rgba = g.getImageData(0, 0, width, height).data;
        const gray = Float32Array.from(
          { length: width * height },
          (_, i) => 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2],
        );
        frames.push({ width, height, gray, group });
      }
    }
    return { ...assessFrames(frames), duration: opened.duration, start: from, end: from + span };
  } catch (e) {
    if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
    return {
      checked: false,
      verdict: "unknown",
      message:
        "Could not check this video quickly. Try an MP4 or WebM, or a shorter stretch. Training may still work.",
      reasons: [],
      metrics: { frames: 0 },
      diagnostic: String(e?.message || e),
      unplayable: e?.code === "V3D_VIDEO_UNPLAYABLE",
      duration: opened?.duration || 0,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    closeVideo(opened);
  }
}
