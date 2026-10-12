// A fast local estimate, not a camera solve or a guarantee. No model, trainer, or network.
import { openVideo, closeVideo, seek } from "./extract.js";
import { fitSide, sharpness } from "./frames.js";

const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] || 0;
const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);

function frameStats({ gray, width, height }) {
  const brightness = mean(gray);
  const contrast = Math.sqrt(mean(Array.from(gray, (v) => (v - brightness) ** 2)));
  return { brightness, contrast, sharp: sharpness(gray, width, height) };
}

// Small patches matched after subtracting their average brightness. A common displacement is
// consistent with panning; differing displacements give a hint of depth. This cannot identify
// people/cars, distinguish every rotation from translation, or measure geometric visibility.
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
      flows.push({ dx, dy, error: best });
    }
  }
  const good = flows.filter((v) => v.error < 0.65);
  const mx = median(good.map((v) => v.dx));
  const my = median(good.map((v) => v.dy));
  return {
    displacement: median(good.map((v) => Math.hypot(v.dx, v.dy))),
    spread: mean(good.map((v) => Math.hypot(v.dx - mx, v.dy - my))),
    unmatched: 1 - good.length / Math.max(1, flows.length),
    patches: flows.length,
  };
}

export function assessFrames(frames) {
  if (frames.length < 3 || frames.some((f) => !f.gray || f.gray.length !== f.width * f.height))
    return {
      checked: false,
      verdict: "unknown",
      message: "Could not check enough frames. Try a playable, shorter stretch.",
      reasons: [],
      metrics: { frames: frames.length },
    };
  const stats = frames.map(frameStats);
  const motions = frames.slice(1).map((b, i) => motion(frames[i], b));
  const metrics = {
    frames: frames.length,
    sharpness: median(stats.map((s) => s.sharp)),
    contrast: median(stats.map((s) => s.contrast)),
    exposure:
      Math.max(...stats.map((s) => s.brightness)) - Math.min(...stats.map((s) => s.brightness)),
    motion: median(motions.map((m) => m.displacement)),
    parallax: median(motions.map((m) => m.spread)),
    unmatched: mean(motions.map((m) => m.unmatched)),
  };
  const reasons = [];
  let poor = false;
  if (metrics.contrast < 12 || median(motions.map((m) => m.patches)) < 4) {
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
  if (metrics.motion < 0.6) {
    reasons.push(
      "Very little camera motion. Walk slowly sideways or around something rather than filming from one spot.",
    );
    poor = true;
  } else if (metrics.parallax < 0.6)
    reasons.push(
      "Little difference in how near and far details move. This may be a pan; move through the place, rather than only turning.",
    );
  if (metrics.unmatched > 0.4 && metrics.contrast >= 12)
    reasons.push(
      "Many patches do not line up. Fast motion, a cut, moving objects, or reflections may cause this. Try a steady stretch without moving people or cars.",
    );
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
    for (const fraction of [0.05, 0.35, 0.65, 0.95]) {
      await seek(opened.video, from + span * fraction, { signal: ctrl.signal, timeoutMs: 4000 });
      g.drawImage(opened.video, 0, 0, width, height);
      const rgba = g.getImageData(0, 0, width, height).data;
      const gray = Float32Array.from(
        { length: width * height },
        (_, i) => 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2],
      );
      frames.push({ width, height, gray });
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
