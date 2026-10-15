// MIT. Made by Ryan with Codex (GPT-6). Bounded local AVC decoding, with exact source-color checks.
import { parseAvcMp4 } from "./mp4.js";
import { fitSide, panoSafeCrop, sharpness, windowTimes } from "./frames.js";

// Container color metadata wins. Chromium's ordinary H.264 demuxer guesses Rec.601 below
// 720 natural pixels high and Rec.709 otherwise; explicit bitstream metadata can override this.
// Two independently presented source pictures must also match exactly before any result is used.
export function decoderColor(metadata, height) {
  const ids = { 1: "bt709", 5: "bt470bg", 6: "smpte170m" };
  const fallback = height < 720 ? "smpte170m" : "bt709";
  const field = (value, transfer = false) => {
    if (value == null || value === 2) return fallback;
    if (transfer && value === 13) return "iec61966-2-1";
    if (!ids[value]) throw new Error("Unsupported source color space");
    return ids[value];
  };
  return {
    primaries: field(metadata?.primaries),
    transfer: field(metadata?.transfer, true),
    matrix: field(metadata?.matrix),
    fullRange: metadata?.fullRange ?? false,
  };
}

// A source frame owns the interval up to the next presentation timestamp. Never replace a
// decoded timestamp with the requested seek position, including on B-frame or VFR sources.
export function selectedSamples(samples, timescale, plan, tries) {
  const ordered = samples
    .map((sample) => ({ ...sample, micros: Math.round((sample.pts * 1e6) / timescale) }))
    .sort((a, b) => a.micros - b.micros);
  if (!ordered.length || ordered.some((s, i) => i && s.micros <= ordered[i - 1].micros))
    throw new Error("Ambiguous source presentation timestamps");
  const wanted = new Map();
  for (let window = 0; window < plan.windows.length; window++) {
    for (const requestedTime of windowTimes(plan.windows[window], tries)) {
      const micros = Math.round(requestedTime * 1e6);
      let lo = 0,
        hi = ordered.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (ordered[mid].micros <= micros) lo = mid + 1;
        else hi = mid;
      }
      const sample = ordered[Math.max(0, lo - 1)];
      if (!wanted.has(sample.micros)) wanted.set(sample.micros, []);
      wanted.get(sample.micros).push({ window, requestedTime });
    }
  }
  return { ordered, wanted };
}

const stopped = () => new DOMException("Stopped", "AbortError");

// Returns null for an unsupported or unverified fast path. The caller then uses its existing
// decoder. No partial photographs or progress events escape a rejected attempt.
export async function grabFastFrames(opened, plan, { side, tries, signal, present }) {
  if (signal?.aborted) throw stopped();
  if (
    !opened.file ||
    opened.file.size > 64 * 1024 * 1024 ||
    opened.duration > 30 ||
    !plan.windows.length ||
    typeof globalThis.VideoDecoder !== "function" ||
    typeof globalThis.EncodedVideoChunk !== "function" ||
    !opened.video.requestVideoFrameCallback
  )
    return null;
  const control = new AbortController();
  const abort = () => control.abort(stopped());
  signal?.addEventListener("abort", abort, { once: true });
  const deadline = setTimeout(() => control.abort(new Error("Local decoder deadline")), 60000);
  let decoder,
    active = true;
  const checked = (promise) =>
    new Promise((resolve, reject) => {
      const fail = () => {
        cleanup();
        reject(control.signal.reason);
      };
      const cleanup = () => control.signal.removeEventListener("abort", fail);
      control.signal.addEventListener("abort", fail, { once: true });
      Promise.resolve(promise).then(
        (value) => {
          cleanup();
          control.signal.aborted ? reject(control.signal.reason) : resolve(value);
        },
        (error) => {
          cleanup();
          reject(error);
        },
      );
      if (control.signal.aborted) fail();
    });
  try {
    const bytes = new Uint8Array(await checked(opened.file.arrayBuffer()));
    const mp4 = parseAvcMp4(bytes);
    if (!mp4.codec.startsWith("avc1.") || mp4.samples.length > 3600) return null;
    const { ordered, wanted } = selectedSamples(mp4.samples, mp4.timescale, plan, tries);
    const config = {
      ...mp4.config,
      colorSpace: decoderColor(mp4.colorMetadata, opened.height),
      hardwareAcceleration: "no-preference",
    };
    const supported = await checked(VideoDecoder.isConfigSupported(config));
    if (!supported.supported) return null;
    const crop = panoSafeCrop(opened.width, opened.height);
    const [width, height] = fitSide(crop.sw, opened.height, side);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    const [sw, sh] = fitSide(width, height, 256);
    const small = document.createElement("canvas");
    small.width = sw;
    small.height = sh;
    const gs = small.getContext("2d", { willReadFrequently: true });
    const gray = new Float32Array(sw * sh);
    const verification = new Map();
    for (const fraction of [0.2, 0.6]) {
      const position = Math.min(opened.duration - 0.1, Math.max(0.01, opened.duration * fraction));
      const time = await checked(present(opened.video, position, { signal: control.signal }));
      const micros = Math.round(time * 1e6);
      if (!Number.isFinite(time) || !ordered.some((s) => s.micros === micros)) return null;
      g.drawImage(opened.video, crop.sx, 0, crop.sw, opened.height, 0, 0, width, height);
      verification.set(micros, g.getImageData(0, 0, width, height).data.slice());
    }
    if (verification.size !== 2) return null;
    const verified = new Set(),
      best = new Array(plan.windows.length),
      pending = new Set();
    let failure = null,
      color = null,
      geometry = null;
    const draw = (context, frame, w, h) =>
      context.drawImage(
        frame,
        (crop.sx * frame.displayWidth) / opened.width,
        0,
        (crop.sw * frame.displayWidth) / opened.width,
        frame.displayHeight,
        0,
        0,
        w,
        h,
      );
    decoder = new VideoDecoder({
      error: (error) => {
        failure = error;
        control.abort(error);
      },
      output: (frame) => {
        try {
          if (!active || control.signal.aborted) return;
          if (
            !frame.displayWidth ||
            !frame.displayHeight ||
            frame.codedWidth > 8192 ||
            frame.codedHeight > 8192
          )
            throw new Error("Decoded frame geometry changed");
          const currentGeometry = [
            frame.codedWidth,
            frame.codedHeight,
            frame.displayWidth,
            frame.displayHeight,
            frame.visibleRect?.x,
            frame.visibleRect?.y,
            frame.visibleRect?.width,
            frame.visibleRect?.height,
          ].join(":");
          if (geometry !== null && currentGeometry !== geometry)
            throw new Error("Decoded frame geometry changed");
          geometry = currentGeometry;
          if (
            Math.abs(frame.displayWidth * opened.height - frame.displayHeight * opened.width) >
            Math.max(opened.width, opened.height)
          )
            throw new Error("Source display aspect differs");
          const currentColor = JSON.stringify(frame.colorSpace.toJSON());
          if (color !== null && currentColor !== color)
            throw new Error("Source colors changed during decode");
          color = currentColor;
          const targets = wanted.get(frame.timestamp),
            expected = verification.get(frame.timestamp);
          if (!targets && !expected) return;
          if (expected) {
            draw(g, frame, width, height);
            const actual = g.getImageData(0, 0, width, height).data;
            if (actual.some((value, i) => value !== expected[i]))
              throw new Error("Source decoder colors differ");
            verified.add(frame.timestamp);
          }
          if (!targets) return;
          draw(gs, frame, sw, sh);
          const pixels = gs.getImageData(0, 0, sw, sh).data;
          for (let i = 0; i < gray.length; i++)
            gray[i] = 0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2];
          const score = sharpness(gray, sw, sh);
          const seen = new Set();
          const improved = targets.filter((t) => {
            if (seen.has(t.window)) return false;
            seen.add(t.window);
            return !best[t.window] || score > best[t.window].sharpness;
          });
          if (!improved.length) return;
          draw(g, frame, width, height);
          const blob = new Promise((resolve, reject) =>
            canvas.toBlob(
              (value) => (value ? resolve(value) : reject(new Error("Local JPEG encoding failed"))),
              "image/jpeg",
              0.92,
            ),
          );
          pending.add(blob);
          blob.then(
            () => pending.delete(blob),
            (error) => {
              pending.delete(blob);
              failure = error;
              control.abort(error);
            },
          );
          for (const target of improved)
            best[target.window] = {
              blob,
              time: frame.timestamp / 1e6,
              decodedTime: frame.timestamp / 1e6,
              requestedTime: target.requestedTime,
              presentedTime: null,
              timestampSource: "decoded-presentation-time",
              sharpness: score,
              width,
              height,
            };
        } catch (error) {
          failure = error;
          control.abort(error);
        } finally {
          frame.close();
        }
      },
    });
    decoder.configure(supported.config);
    for (const sample of mp4.samples) {
      if (control.signal.aborted) throw control.signal.reason;
      while (decoder.decodeQueueSize >= 8 || pending.size >= 4)
        await checked(new Promise((resolve) => setTimeout(resolve, 0)));
      decoder.decode(
        new EncodedVideoChunk({
          type: sample.key ? "key" : "delta",
          timestamp: Math.round((sample.pts * 1e6) / mp4.timescale),
          duration: Math.round((sample.duration * 1e6) / mp4.timescale),
          data: bytes.subarray(sample.offset, sample.offset + sample.size),
        }),
      );
    }
    await checked(decoder.flush());
    await checked(Promise.all(pending));
    if (failure) throw failure;
    if (
      verified.size !== 2 ||
      best.some((value) => !value) ||
      best.filter(Boolean).length !== plan.windows.length
    )
      return null;
    const results = await checked(
      Promise.all(best.map(async (value) => ({ ...value, blob: await value.blob }))),
    );
    if (control.signal.aborted) throw control.signal.reason;
    opened.extraction = {
      method: "webcodecs-avc",
      timestampSource: "decoded-presentation-time",
      independentlyPresentedColorChecks: verification.size,
      sampleCount: mp4.samples.length,
      timescale: mp4.timescale,
      editOffset: mp4.editOffset,
    };
    return results;
  } catch (error) {
    if (signal?.aborted) throw stopped();
    opened.fastDecodeFailure = error?.message || "Local decoder unavailable";
    return null;
  } finally {
    active = false;
    clearTimeout(deadline);
    signal?.removeEventListener("abort", abort);
    control.abort(new Error("Decoder finished"));
    if (decoder && decoder.state !== "closed") decoder.close();
  }
}
