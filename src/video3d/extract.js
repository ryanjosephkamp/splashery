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

// seeked can precede the decoded picture reaching drawImage. Wait for presentation before
// judging sharpness or making a training photograph, and retain the actual source-frame time.
// Older browsers without this API return null: a requested time is not presentation evidence.
const presentedFrames = new WeakMap();
const presentationOwners = new WeakMap();
const recoveryRates = new WeakMap();
export async function seekPresented(video, time, { signal, timeoutMs = 4000 } = {}) {
  if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
  // Keep ownership after completion: play() can settle after its presentation callback,
  // and an older continuation must not pause a later seek on this same local video.
  const owner = {};
  presentationOwners.set(video, owner);
  const ownsVideo = () => presentationOwners.get(video) === owner;
  // A new seek takes over any older recovery without inheriting its temporary speed.
  const priorRate = recoveryRates.get(video);
  if (priorRate) {
    recoveryRates.delete(video);
    video.pause();
    if (video.playbackRate === priorRate.applied) {
      try {
        video.playbackRate = priorRate.before;
      } catch {
        /* The browser owns its rate limits. */
      }
    }
  }
  if (!video.requestVideoFrameCallback) {
    await seek(video, time, { signal, timeoutMs });
    return null;
  }
  const source = video.currentSrc || video.src;
  const previous = presentedFrames.get(video);
  if (
    previous &&
    previous.source === source &&
    previous.requestedTime === time &&
    video.currentTime === previous.position &&
    !video.seeking &&
    video.readyState >= 2
  )
    return previous.mediaTime;
  let cleanup;
  const presented = new Promise((resolve, reject) => {
    let callback;
    let recovery;
    let advanced = false;
    let done = false;
    let seekedAt = null;
    const pauseRecovery = () => {
      video.pause();
      const rate = recoveryRates.get(video);
      if (rate?.owner !== owner) return;
      recoveryRates.delete(video);
      if (video.playbackRate === rate.applied) {
        try {
          video.playbackRate = rate.before;
        } catch {
          /* A host rate change stays authoritative. */
        }
      }
    };
    const finish = (error, mediaTime) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(recovery);
      signal?.removeEventListener("abort", abort);
      video.removeEventListener("seeking", arm);
      video.removeEventListener("seeked", settled);
      if (callback !== undefined) video.cancelVideoFrameCallback(callback);
      if (advanced && ownsVideo()) pauseRecovery();
      error ? reject(error) : resolve(mediaTime);
    };
    const abort = () => finish(new DOMException("Stopped", "AbortError"));
    const timer = setTimeout(
      () =>
        finish(new Error("The decoded video frame took too long. Try a shorter MP4 (H.264) clip.")),
      timeoutMs,
    );
    // Initial/old RVFCs can arrive after seeking starts but before seeked: accepting one and then
    // waiting for seeked pairs its old mediaTime with the new drawImage picture. Require a fresh
    // presentation after seeked; presentationTime also rejects an older queued callback delivered
    // after that event. Frame duration can vary, so mediaTime proximity is never a test.
    const arm = () => {
      callback = video.requestVideoFrameCallback((_, metadata) => {
        callback = undefined;
        if (done) return;
        if (
          seekedAt === null ||
          video.seeking ||
          (Number.isFinite(metadata.presentationTime) && metadata.presentationTime < seekedAt)
        ) {
          arm();
          return;
        }
        finish(null, metadata.mediaTime);
      });
    };
    // A paused seek can remain inside the already-presented frame. Chromium then sends seeked
    // without another presentation callback. Briefly advancing the muted local video requests a
    // real new picture; pause inside its callback and keep that picture's actual mediaTime.
    // Never infer a timestamp from currentTime or from identical image content.
    const recover = () => {
      if (done || !video.paused || typeof video.play !== "function") return;
      clearTimeout(recovery);
      recovery = setTimeout(() => {
        if (done || !ownsVideo()) return;
        advanced = true;
        // At normal speed a busy callback can arrive after drawImage's picture has already
        // advanced beyond its mediaTime. Slow only this recovery, then restore the caller's
        // rate after pausing. The returned time still comes from an actual presentation.
        const before = video.playbackRate;
        if (Number.isFinite(before) && before > 0) {
          try {
            video.playbackRate = Math.min(before, 0.125);
            recoveryRates.set(video, { owner, before, applied: video.playbackRate });
          } catch {
            // Browsers with narrower rate limits retain the existing bounded recovery.
          }
        }
        let playback;
        try {
          playback = video.play();
        } catch {
          return; // Keep the original deadline if this browser refuses playback synchronously.
        }
        Promise.resolve(playback).then(
          () => {
            if (done && ownsVideo()) pauseRecovery();
          },
          () => {
            /* The original presentation deadline still supplies retry advice. */
          },
        );
      }, 100);
    };
    const settled = () => {
      if (video.seeking || video.readyState < 2) return;
      seekedAt = performance.now();
      recover();
    };
    cleanup = finish;
    video.addEventListener("seeking", arm, { once: true });
    video.addEventListener("seeked", settled);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
  try {
    const [, mediaTime] = await Promise.all([seek(video, time, { signal, timeoutMs }), presented]);
    // Browsers can round the seek position (for example, 2.01 becomes 2.009999).
    // Reuse only that exact confirmed position for an identical request and source.
    if (ownsVideo())
      presentedFrames.set(video, {
        source,
        requestedTime: time,
        position: video.currentTime,
        mediaTime,
      });
    return mediaTime;
  } finally {
    cleanup();
  }
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
      const presentedTime = await seekPresented(video, t, { signal });
      gs.drawImage(video, crop.sx, 0, crop.sw, opened.height, 0, 0, sw, sh);
      const px = gs.getImageData(0, 0, sw, sh).data;
      for (let k = 0; k < gray.length; k++)
        gray[k] = 0.299 * px[k * 4] + 0.587 * px[k * 4 + 1] + 0.114 * px[k * 4 + 2];
      const s = sharpness(gray, sw, sh);
      if (!best || s > best.sharpness) {
        g.drawImage(video, crop.sx, 0, crop.sw, opened.height, 0, 0, w, h);
        best = { time: presentedTime ?? t, requestedTime: t, presentedTime, sharpness: s };
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
