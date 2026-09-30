// Video to 3D (lane Video 3D): the video's frames, grabbed in the browser. A <video> element plays
// the file from the device (an object URL: nothing is uploaded), seeks to each moment planFrames
// chose, and a canvas copies the frame. In each window the sharpest of a few frames is kept.

import { windowTimes, sharpness, fitSide } from "./frames.js";

// Opens the video: resolves { video, url, duration, width, height }. Throws a plain message when
// the browser cannot play the file.
export async function openVideo(file) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout")), 20000);
      video.onloadedmetadata = () => {
        clearTimeout(t);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(t);
        reject(new Error("error"));
      };
    });
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(
      "This browser cannot play that video. Try an MP4 (H.264) or WebM file, or a shorter clip.",
    );
  }
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (!duration || !video.videoWidth) {
    URL.revokeObjectURL(url);
    throw new Error("That video has no picture or no length this browser can read.");
  }
  return { video, url, duration, width: video.videoWidth, height: video.videoHeight };
}

function seek(video, t) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", finish);
      resolve();
    };
    video.addEventListener("seeked", finish);
    // Some browsers skip "seeked" when the time does not change.
    setTimeout(finish, 4000);
    video.currentTime = t;
  });
}

// Grabs the planned frames. opened: openVideo's result; plan: planFrames's; side: the long side
// of each photograph; tries: frames looked at per window. onFrame(i, n, blob) reports progress.
// Resolves [{ blob, time, sharpness, width, height }].
export async function grabFrames(opened, plan, { side = 960, tries = 3, onFrame, signal } = {}) {
  const { video } = opened;
  const [w, h] = fitSide(opened.width, opened.height, side);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  // Sharpness is judged on a small gray copy (fast, and blur shows at any size).
  const [sw, sh] = fitSide(w, h, 256);
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const gs = small.getContext("2d", { willReadFrequently: true });
  const gray = new Float32Array(sw * sh);
  const out = [];
  for (let i = 0; i < plan.windows.length; i++) {
    if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
    let best = null;
    for (const t of windowTimes(plan.windows[i], tries)) {
      await seek(video, t);
      gs.drawImage(video, 0, 0, sw, sh);
      const px = gs.getImageData(0, 0, sw, sh).data;
      for (let k = 0; k < gray.length; k++)
        gray[k] = 0.299 * px[k * 4] + 0.587 * px[k * 4 + 1] + 0.114 * px[k * 4 + 2];
      const s = sharpness(gray, sw, sh);
      if (!best || s > best.sharpness) {
        g.drawImage(video, 0, 0, w, h);
        best = { time: t, sharpness: s };
        best.blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
      }
    }
    best.width = w;
    best.height = h;
    out.push(best);
    onFrame?.(i + 1, plan.windows.length, best);
  }
  return out;
}

export function closeVideo(opened) {
  if (!opened) return;
  opened.video.removeAttribute("src");
  opened.video.load();
  URL.revokeObjectURL(opened.url);
}
