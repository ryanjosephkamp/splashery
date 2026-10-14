// Video to 3D (lane Video 3D): the video's frames, grabbed in the browser. A <video> element plays
// the file from the device (an object URL: nothing is uploaded), seeks to each moment planFrames
// chose, and a canvas copies the frame. In each window the sharpest of a few frames is kept.

import { windowTimes, sharpness, fitSide, panoSafeCrop } from "./frames.js";

// Opens the video: resolves { video, url, duration, width, height }. Throws a plain message when
// the browser cannot play the file.
export async function openVideo(file, { signal, timeoutMs = 20000 } = {}) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(t);
        signal?.removeEventListener("abort", abort);
        video.onloadedmetadata = video.onerror = null;
        error ? reject(error) : resolve();
      };
      const abort = () => finish(new DOMException("Stopped", "AbortError"));
      const t = setTimeout(() => finish(new Error("timeout")), timeoutMs);
      signal?.addEventListener("abort", abort, { once: true });
      video.onloadedmetadata = () => {
        finish();
      };
      video.onerror = () => {
        finish(new Error("error"));
      };
      if (signal?.aborted) abort();
    });
  } catch (error) {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
    if (error?.name === "AbortError") throw error;
    const failure = new Error(
      "This browser cannot play that video. Try an MP4 (H.264) or WebM file, or a shorter clip.",
    );
    failure.code = error?.message === "timeout" ? "V3D_VIDEO_TIMEOUT" : "V3D_VIDEO_UNPLAYABLE";
    throw failure;
  }
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (!duration || !video.videoWidth) {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
    const failure = new Error("That video has no picture or no length this browser can read.");
    failure.code = "V3D_VIDEO_UNPLAYABLE";
    throw failure;
  }
  return { video, url, duration, width: video.videoWidth, height: video.videoHeight };
}

export function seek(video, t, { signal, timeoutMs = 4000 } = {}) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeEventListener("seeked", ready);
      video.removeEventListener("loadeddata", ready);
      video.removeEventListener("error", failed);
      signal?.removeEventListener("abort", abort);
      error ? reject(error) : resolve();
    };
    const ready = () => {
      if (!video.seeking && video.readyState >= 2) finish();
    };
    const abort = () => finish(new DOMException("Stopped", "AbortError"));
    const failed = () => {
      const failure = new Error(
        "This browser cannot read a picture from that video. Try an MP4 (H.264) or WebM file.",
      );
      failure.code = "V3D_VIDEO_UNPLAYABLE";
      finish(failure);
    };
    const timer = setTimeout(
      () => finish(new Error("The video took too long to show a frame.")),
      timeoutMs,
    );
    video.addEventListener("seeked", ready);
    video.addEventListener("loadeddata", ready);
    video.addEventListener("error", failed);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      video.currentTime = t;
    } catch (error) {
      finish(error);
      return;
    }
    if (signal?.aborted) abort();
    else if (video.error) failed();
    else ready();
  });
}

// Grabs the planned frames. opened: openVideo's result; plan: planFrames's; side: the long side
// of each photograph; tries: frames looked at per window. onFrame(i, n, blob) reports progress.
// Resolves [{ blob, time, sharpness, width, height }].
export async function grabFrames(opened, plan, { side = 960, tries = 3, onFrame, signal } = {}) {
  const { video } = opened;
  const crop = panoSafeCrop(opened.width, opened.height);
  const [w, h] = fitSide(crop.sw, opened.height, side);
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
      await seek(video, t, { signal });
      gs.drawImage(video, crop.sx, 0, crop.sw, opened.height, 0, 0, sw, sh);
      const px = gs.getImageData(0, 0, sw, sh).data;
      for (let k = 0; k < gray.length; k++)
        gray[k] = 0.299 * px[k * 4] + 0.587 * px[k * 4 + 1] + 0.114 * px[k * 4 + 2];
      const s = sharpness(gray, sw, sh);
      if (!best || s > best.sharpness) {
        g.drawImage(video, crop.sx, 0, crop.sw, opened.height, 0, 0, w, h);
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
