// Original picture timestamps, independent of retained app frames and audio tails.
import { execFileSync } from "node:child_process";

export function sourceTimeline(file, fps, clipDuration = Infinity) {
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_frames",
        "-show_streams",
        "-show_entries",
        "frame=best_effort_timestamp_time,pkt_duration_time,duration_time:stream=duration",
        "-of",
        "json",
        file,
      ],
      { encoding: "utf8" },
    ),
  );
  const frames = probe.frames,
    timestamps = frames.map((frame) => Number(frame.best_effort_timestamp_time)),
    start = timestamps[0],
    duration = Number(probe.streams?.[0]?.duration) || frames.length / fps;
  // Rounded WebM packet durations can be 41 ms while adjacent PTS gaps
  // alternate between 41 and 42 ms. Their difference is the real hold.
  const durations = timestamps.map((time, i) =>
    i + 1 < timestamps.length ? timestamps[i + 1] - time : start + duration - time,
  );
  if (!frames.length || durations.some((value) => !(value > 0)))
    throw Error(`Invalid original source timeline: ${file}`);
  // Keep the existing within-frame sampling point. A packet's quarter
  // duration is safely inside its frame, even with millisecond PTS rounding.
  const captureTimes = frames.map((frame, i) => {
    const packet = Number(frame.duration_time || frame.pkt_duration_time) || durations[i];
    return Math.min(clipDuration, timestamps[i] + packet / 4);
  });
  return { timestamps, durations, captureTimes, duration, start };
}
