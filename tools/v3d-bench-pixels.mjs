// MIT. Independent source-frame receipts, without changing the photographs used for training.
// This function is serialized into Playwright's page. Keep it self-contained.
export async function sourceFrameReceipts({ base64, sourceTimes, times, trainingFrames, crop }) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const width = trainingFrames[0]?.width,
    height = trainingFrames[0]?.height;
  if (!width || !height || trainingFrames.some((f) => f.width !== width || f.height !== height))
    throw new Error("Training photograph geometry is absent or inconsistent.");
  const url = URL.createObjectURL(new Blob([bytes], { type: "video/mp4" }));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const hash = async (blob) =>
    Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
  const jpeg = () => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  const cache = new Map();
  let releaseRendering;
  const capture = async (index) => {
    if (cache.has(index)) return cache.get(index);
    const time = sourceTimes[index];
    // A fresh independent decoder first checks the paused source picture's own timestamp.
    // Unsupported or stale decoded-picture access falls back to actual playback from an
    // earlier source frame, within the same original presentation deadline.
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    if (!video.requestVideoFrameCallback)
      throw new Error("Independent source-frame presentation is unavailable.");
    try {
      const mediaTime = await new Promise((resolve, reject) => {
        let callback;
        let ready = false;
        let seekedAt = null;
        let done = false;
        let directSeek = false;
        const finish = (error, value) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          if (callback !== undefined) video.cancelVideoFrameCallback(callback);
          video.removeEventListener("loadedmetadata", loaded);
          video.removeEventListener("seeked", settled);
          video.removeEventListener("error", failed);
          video.pause();
          error ? reject(error) : resolve(value);
        };
        const frame = (_, metadata) => {
          callback = undefined;
          if (done) return;
          const current =
            index === 0 ||
            (ready &&
              !video.seeking &&
              (!Number.isFinite(metadata.presentationTime) ||
                metadata.presentationTime >= seekedAt));
          if (current && video.readyState >= 2 && Math.abs(metadata.mediaTime - time) < 0.0001)
            finish(null, metadata.mediaTime);
          else callback = video.requestVideoFrameCallback(frame);
        };
        const play = () => {
          try {
            const playback = video.play();
            Promise.resolve(playback).catch(() => {});
          } catch {
            /* The original presentation deadline still requires an actual callback. */
          }
        };
        const preroll = () => {
          let from = Math.max(0, index - 4);
          while (from < index - 1 && time - sourceTimes[from] > 0.2) from++;
          video.playbackRate = Math.max(0.125, Math.min(1, (time - sourceTimes[from]) / 1.5));
          if (index === 0) {
            ready = true;
            seekedAt = performance.now();
            play();
          } else {
            const gap = sourceTimes[from + 1] - sourceTimes[from];
            video.currentTime = sourceTimes[from] + Math.min(0.005, gap / 4);
          }
        };
        const settled = () => {
          if (done || video.seeking || video.readyState < 2) return;
          if (directSeek) {
            directSeek = false;
            let frame;
            try {
              video.pause();
              frame = new VideoFrame(video);
              const actual = frame.timestamp / 1e6;
              if (Number.isFinite(actual) && Math.abs(actual - time) <= 0.000001) {
                finish(null, actual);
                return;
              }
            } catch {
              // Unsupported decoded-picture access retains actual callback verification.
            } finally {
              frame?.close();
            }
            preroll();
            return;
          }
          ready = true;
          seekedAt = performance.now();
          play();
        };
        const loaded = () => {
          if (done) return;
          clearTimeout(timer);
          timer = setTimeout(
            () => finish(new Error(`No presented source frame at ${time}.`)),
            4000,
          );
          if (typeof VideoFrame === "function") {
            directSeek = true;
            const gap = sourceTimes[index + 1] - time || time - sourceTimes[index - 1] || 0.01;
            video.currentTime = time + Math.min(0.001, gap / 8);
          } else preroll();
        };
        const failed = () => finish(new Error("Source video cannot be decoded."));
        let timer = setTimeout(() => finish(new Error("Source video metadata timed out.")), 10000);
        video.addEventListener("loadedmetadata", loaded, { once: true });
        video.addEventListener("seeked", settled);
        video.addEventListener("error", failed, { once: true });
        callback = video.requestVideoFrameCallback(frame);
        video.src = url;
      });
      context.drawImage(video, crop.sx, 0, crop.sw, video.videoHeight, 0, 0, width, height);
      const sha256 = await hash(await jpeg()),
        repeatedSha256 = await hash(await jpeg());
      const result = { index, time, mediaTime, width, height, sha256, repeatedSha256 };
      cache.set(index, result);
      return result;
    } finally {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
  };
  try {
    // The native bake has already finished. Its viewer must not compete with the independent
    // video decoder; release the hold before any model-view evaluation or review capture.
    releaseRendering = globalThis.__splashery?.player?.stage?.holdRendering?.();
    const views = [];
    for (const time of times) {
      const index = sourceTimes.findIndex((t) => Math.abs(t - time) < 0.000001);
      if (index < 0) throw new Error("The held-out time does not identify an exact source frame.");
      views.push(await capture(index));
    }
    // Match EVERY selected JPEG back to the independent decoder. This checks that a recreated
    // JPEG has the same bytes as training, even on main's seek-only extraction path. Search near
    // its requested/presented time first; a stale picture can require an earlier source frame.
    const matchedTraining = [];
    for (const training of trainingFrames) {
      let match = [...cache.values()].find((f) => f.sha256 === training.sha256);
      if (!match) {
        const target = training.presentedTime ?? training.requestedTime;
        const order = sourceTimes
          .map((time, index) => ({ index, distance: Math.abs(time - target) }))
          .sort((a, b) => a.distance - b.distance || a.index - b.index);
        for (const { index } of order) {
          const frame = await capture(index);
          if (frame.sha256 === training.sha256) {
            match = frame;
            break;
          }
        }
      }
      if (!match)
        throw new Error(
          "A training JPEG could not be matched to an independently presented source frame.",
        );
      matchedTraining.push({
        sha256: training.sha256,
        repeatedSha256: match.repeatedSha256,
        sourceIndex: match.index,
        sourceTime: match.mediaTime,
      });
    }
    return {
      method:
        "Fresh independent source decoders, exact actual decoded-frame timestamps or actual presentation callbacks; identical extraction canvas and JPEG encoder, every training JPEG matched, and held-out JPEGs disjoint.",
      matchedTraining,
      views,
      decodedFrames: cache.size,
    };
  } finally {
    URL.revokeObjectURL(url);
    releaseRendering?.();
  }
}

export function assertPixelDisjointness(trainingFrames, receipts, times) {
  const validHash = (s) => /^[a-f0-9]{64}$/.test(s || "");
  if (
    !trainingFrames?.length ||
    !times?.length ||
    receipts?.views?.length !== times.length ||
    receipts?.matchedTraining?.length !== trainingFrames.length
  )
    throw new Error("Missing independent source-frame receipts.");
  const selected = new Set(trainingFrames.map((f) => f.sha256));
  if (trainingFrames.some((f) => !validHash(f.sha256)))
    throw new Error("Missing training JPEG hash.");
  receipts.matchedTraining.forEach((f, i) => {
    if (
      f.sha256 !== trainingFrames[i].sha256 ||
      f.sha256 !== f.repeatedSha256 ||
      !Number.isFinite(f.sourceTime) ||
      !Number.isInteger(f.sourceIndex)
    )
      throw new Error("A training JPEG has no independent source-frame match.");
  });
  receipts.views.forEach((f, i) => {
    if (
      f.time !== times[i] ||
      !Number.isFinite(f.mediaTime) ||
      Math.abs(f.mediaTime - f.time) >= 0.0001 ||
      !validHash(f.sha256) ||
      f.sha256 !== f.repeatedSha256
    )
      throw new Error("The held-out source frame or deterministic JPEG encoding was not verified.");
    if (selected.has(f.sha256))
      throw new Error("A held-out source picture was also used for training.");
  });
  return true;
}
