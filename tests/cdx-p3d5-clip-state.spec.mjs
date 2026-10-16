import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hash } from "../tools/p3df/inputs.mjs";
import { verifyRetainedClips } from "../tools/cdx-p3d5-clip-state.mjs";

test("clip resume rejects a damaged video even when its name and metadata survive", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "p3d5-clip-"));
  try {
    const bytes = Buffer.from("fixture video bytes"),
      file = path.join(folder, "fixture.mp4");
    fs.writeFileSync(file, bytes);
    const row = {
      file: "fixture.mp4",
      sha256: hash(bytes),
      frames: 1,
      fps: 1,
      nativeBuffer: [585, 1266],
      pixelComparison: [
        {
          frame: 0,
          yaw: 0,
          pitch: 0,
          hashes: [hash("before"), hash("after")],
          changedPixels: 1,
          maximumChannelError: 1,
          meanAbsoluteChannelError: 0.0001,
        },
      ],
    };
    const options = { frames: 1, fps: 1 };
    expect(() => verifyRetainedClips([row], folder, options)).not.toThrow();
    fs.appendFileSync(file, "corruption");
    expect(() => verifyRetainedClips([row], folder, options)).toThrow(/video changed/);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test("clip resume rejects incomplete native-frame evidence before skipping an encoded file", () => {
  expect(() =>
    verifyRetainedClips(
      [
        {
          file: "fixture.mp4",
          frames: 72,
          fps: 12,
          nativeBuffer: [585, 1266],
          pixelComparison: [],
        },
      ],
      "/unused",
      { frames: 72, fps: 12 },
    ),
  ).toThrow(/incomplete/);
});
