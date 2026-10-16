// MIT; made by Ryan with Codex (GPT-6). Capture completeness and resume guards.
import { POSES } from "./p3df/scoring.mjs";

export function completeStudy(data, ids, profiles) {
  return (
    !data.stoppedEarly &&
    profiles.length === 2 &&
    new Set(profiles).size === 2 &&
    profiles.includes("phone") &&
    profiles.includes("desktop") &&
    data.inputs.length === ids.length &&
    new Set(data.inputs.map((r) => r.id)).size === ids.length &&
    data.attempts.length === ids.length * 2 &&
    data.attempts.every((r) => r.passed) &&
    ids.every((id) => {
      const row = data.inputs.find((r) => r.id === id);
      return (
        row &&
        profiles.every((profile) => {
          const p = row.profiles[profile];
          return (
            p?.sharp?.on &&
            !p.errors.length &&
            !p.externalRequests.length &&
            p.rows.length === POSES.length &&
            POSES.every(([yaw, pitch]) => p.rows.some((r) => r.yaw === yaw && r.pitch === pitch))
          );
        })
      );
    })
  );
}

export function assertResume(previous, expected) {
  if (previous.stoppedEarly) throw new Error("A rejected experiment cannot be resumed.");
  for (const key of ["source", "settings", "methods"]) {
    const a = key === "source" ? previous.source.sha256 : JSON.stringify(previous[key]);
    const b = key === "source" ? expected.source.sha256 : JSON.stringify(expected[key]);
    if (a !== b) throw new Error("Resume " + key + " changed.");
  }
  if (![expected.method, ...expected.compatibleControllers].includes(previous.method))
    throw new Error("Resume controller is not a verified compatible version.");
  if (previous.stateMethod && previous.stateMethod !== expected.stateMethod)
    throw new Error("Resume state validation changed.");
}
