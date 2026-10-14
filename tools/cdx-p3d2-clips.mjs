#!/usr/bin/env node
// Six reproducible 390x844 turning clips, encoded from real renderer frames.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { open, sample, shot } from "./cdx-p3d2-measure.mjs";
const opt = (n, d) => process.argv.find((x) => x.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const out = opt("out", ".cache/cdx-p3d2/clips");
const fps = Number(opt("fps", 12)),
  frames = fps * Number(opt("secs", 6));
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  await open(page);
  for (const id of opt("samples", "forest,spiral-stairs,dot-castle").split(","))
    for (const view of ["sharp", "splats"]) {
      await sample(page, id, 1, view);
      const label = `${id.startsWith("dot-") ? "AI-made Studio sample: " : ""}${id}\n${view === "sharp" ? "Sharp picture" : "Fine Splats (hybrid)"} · Depth 1`;
      const file = path.join(out, `${id}-${view}-390x844.mp4`);
      const ff = spawn(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-f",
          "image2pipe",
          "-vcodec",
          "png",
          "-r",
          String(fps),
          "-i",
          "pipe:0",
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "20",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          "-metadata",
          `title=${label}`,
          file,
        ],
        { stdio: ["pipe", "ignore", "inherit"] },
      );
      const done = once(ff, "close");
      for (let i = 0; i < frames; i++) {
        const segment = Math.min(3, Math.floor((i * 4) / frames));
        const angle = 20 * Math.sin(Math.PI * ((i * 4) / frames - segment));
        const s = await shot(
          page,
          ["left", "right", "up", "down"][segment],
          angle,
          false,
          [0.94, 0.95, 0.97],
          label,
        );
        if (!ff.stdin.write(Buffer.from(s.image.split(",")[1], "base64")))
          await once(ff.stdin, "drain");
      }
      ff.stdin.end();
      const [code] = await done;
      if (code !== 0) throw new Error(`Video encoding failed: ${file}`);
      console.log(file);
    }
} finally {
  await browser.close();
}
