import { EXPORT_PRESETS } from "./presets.js";

// The toy may suspend its audio context while an effect is paused. Bridge
// its output into a recording-owned clock, so silence still advances the
// recorder without resuming held notes. Resumed toy sound follows this stream.
export function recordingAudioTap({ ctx, node }) {
  let limit, source, clockContext, input, destination, clock;
  const dispose = () => {
    if (limit) {
      try {
        node.disconnect(limit);
      } catch {
        /* Context already gone. */
      }
      limit.disconnect();
    }
    input?.disconnect();
    try {
      clock?.stop();
    } catch {
      /* A partially constructed clock. */
    }
    clock?.disconnect();
    for (const stream of [source?.stream, destination?.stream])
      for (const track of stream?.getTracks() || []) track.stop();
    if (clockContext && clockContext.state !== "closed") clockContext.close().catch(() => {});
  };
  try {
    // The site's limiter sits after `node` and is not exposed.
    limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -10;
    limit.knee.value = 6;
    limit.ratio.value = 8;
    limit.attack.value = 0.003;
    limit.release.value = 0.2;
    source = ctx.createMediaStreamDestination();
    node.connect(limit);
    limit.connect(source);
    const AudioClock = window.AudioContext || window.webkitAudioContext;
    clockContext = new AudioClock({ sampleRate: ctx.sampleRate });
    input = clockContext.createMediaStreamSource(source.stream);
    destination = clockContext.createMediaStreamDestination();
    input.connect(destination);
    clock = clockContext.createConstantSource();
    clock.offset.value = 0;
    clock.connect(destination);
    clock.start();
    clockContext.resume().catch(() => {});
    return { tracks: destination.stream.getAudioTracks(), dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

// Input is work inside a rendered frame, never the idle gap before it.
export function recordingPerformanceMonitor(onSlow) {
  const { maxMinFps, maxSlowSeconds } = EXPORT_PRESETS.record;
  let slowSeconds = 0;
  let stopped = false;
  return (milliseconds) => {
    if (stopped) return;
    slowSeconds = milliseconds > 1000 / maxMinFps ? slowSeconds + milliseconds / 1000 : 0;
    if (slowSeconds >= maxSlowSeconds) {
      stopped = true;
      onSlow();
    }
  };
}
