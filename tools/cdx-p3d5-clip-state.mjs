// MIT; made by Ryan with Codex (GPT-6). Reject damaged or incomplete saved clips.
import fs from "node:fs";
import path from "node:path";
import { hash } from "./p3df/inputs.mjs";

export function verifyRetainedClips(rows, folder, { frames, fps }) {
  const names = new Set();
  for (const row of rows) {
    if (
      !row.file ||
      path.basename(row.file) !== row.file ||
      names.has(row.file) ||
      row.frames !== frames ||
      row.fps !== fps ||
      JSON.stringify(row.nativeBuffer) !== "[585,1266]" ||
      row.pixelComparison?.length !== frames
    )
      throw new Error("A retained clip has incomplete or inconsistent frame evidence.");
    names.add(row.file);
    for (const [i, frame] of row.pixelComparison.entries()) {
      const segment = Math.min(3, Math.floor((i * 4) / frames)),
        angle = 30 * Math.sin(Math.PI * ((i * 4) / frames - segment)),
        yaw = segment < 2 ? (segment === 0 ? -angle : angle) : 0,
        pitch = segment >= 2 ? (segment === 2 ? -angle : angle) : 0;
      if (
        frame.frame !== i ||
        frame.yaw !== yaw ||
        frame.pitch !== pitch ||
        frame.hashes?.length !== 2 ||
        !frame.hashes.every((h) => /^[a-f0-9]{64}$/.test(h)) ||
        !Number.isInteger(frame.changedPixels) ||
        frame.changedPixels < 0 ||
        frame.changedPixels > 585 * 1266 ||
        !Number.isFinite(frame.maximumChannelError) ||
        !Number.isFinite(frame.meanAbsoluteChannelError)
      )
        throw new Error("A retained clip lost its native frame or camera evidence.");
    }
    const file = path.join(folder, row.file);
    if (!fs.existsSync(file) || hash(fs.readFileSync(file)) !== row.sha256)
      throw new Error("Retained review video changed: " + row.file);
  }
}
