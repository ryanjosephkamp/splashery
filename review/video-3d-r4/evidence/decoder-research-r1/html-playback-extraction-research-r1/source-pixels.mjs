// MIT. Independent source-frame receipts, without changing the photographs used for training.
// This function is serialized into Playwright's page. Keep it self-contained.
export async function sourceFrameReceipts({ base64, sourceTimes, times, trainingFrames, crop }) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "video/mp4" }));
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const width = trainingFrames[0]?.width,
    height = trainingFrames[0]?.height;
  if (!width || !height || trainingFrames.some((f) => f.width !== width || f.height !== height))
    throw new Error("Training photograph geometry is absent or inconsistent.");
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
  const capture = async (index) => {
    if (cache.has(index)) return cache.get(index);
    const time = sourceTimes[index],
      next = sourceTimes[index + 1];
    // Seek inside the selected source frame, rather than on a floating-point frame boundary.
    const target = time + Math.min(0.005, (next == null ? 1 / 120 : next - time) / 4);
    const mediaTime = await new Promise((resolve, reject) => {
      let callback;
      const finish = (error, value) => {
        clearTimeout(timer);
        if (callback !== undefined) video.cancelVideoFrameCallback(callback);
        error ? reject(error) : resolve(value);
      };
      const frame = (_, metadata) => {
        if (Math.abs(metadata.mediaTime - time) < 0.0001) finish(null, metadata.mediaTime);
        else callback = video.requestVideoFrameCallback(frame);
      };
      const timer = setTimeout(
        () => finish(new Error(`No presented source frame at ${time}.`)),
        4000,
      );
      callback = video.requestVideoFrameCallback(frame);
      video.currentTime = target;
    });
    context.drawImage(video, crop.sx, 0, crop.sw, video.videoHeight, 0, 0, width, height);
    const sha256 = await hash(await jpeg()),
      repeatedSha256 = await hash(await jpeg());
    const result = { index, time, mediaTime, width, height, sha256, repeatedSha256 };
    cache.set(index, result);
    return result;
  };
  try {
    if (!video.requestVideoFrameCallback)
      throw new Error("Independent source-frame presentation is unavailable.");
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Source video metadata timed out.")), 10000);
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Source video cannot be decoded."));
      };
      video.src = url;
    });
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
        "Independent presented source frames, identical extraction canvas and JPEG encoder; every training JPEG matched, held-out JPEGs disjoint.",
      matchedTraining,
      views,
      decodedFrames: cache.size,
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
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
