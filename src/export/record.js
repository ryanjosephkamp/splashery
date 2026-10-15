import { EXPORT_PRESETS } from "./presets.js";

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
