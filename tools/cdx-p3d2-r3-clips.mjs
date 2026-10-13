// Paired phone-size review clips from the two real, immutable browser builds.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import config from "../playwright.config.mjs";
import { inputs, screens, openR3, selectR3, poseR3 } from "./cdx-p3d2-r3-common.mjs";

const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const out = opt("out", ".cache/cdx-p3d2/r3/clips");
const selected = inputs().filter((s) =>
  opt(
    "samples",
    inputs()
      .map((s) => s.id)
      .join(","),
  )
    .split(",")
    .includes(s.id),
);
const fps = Number(opt("fps", 12)),
  frames = fps * Number(opt("seconds", 6));
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(config.use.launchOptions);
const manifestFile = path.join(out, "clips.json");
const rows = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile)).rows : [];
const builds = JSON.parse(fs.readFileSync(".cache/cdx-p3d2/r3/builds.json"));
try {
  const pages = [];
  for (const url of [
    opt("before", "http://127.0.0.1:4174/"),
    opt("after", "http://127.0.0.1:4175/"),
  ]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
    });
    await openR3(page, url, screens.phone);
    pages.push(page);
  }
  for (const entry of selected)
    for (const view of opt("views", "sharp,splats").split(",")) {
      const file = `${entry.id}-${view}-before-after.mp4`;
      if (rows.some((row) => row.file === file) && fs.existsSync(path.join(out, file))) continue;
      for (const page of pages) await selectR3(page, entry, 1, view);
      const label = `${entry.id} | ${entry.id.startsWith("dot-") ? "AI-made" : entry.file?.endsWith(".gif") ? "CC0 GIF, first frame" : "CC0 photo"} | ${view === "sharp" ? "Sharp" : "Fine Splats (hybrid)"} | Depth 1`;
      const filter = `scale=780:844,drawbox=x=0:y=0:w=iw:h=44:color=white@0.9:t=fill,drawtext=text='${label}':x=12:y=5:fontsize=15:fontcolor=black,drawtext=text='Before (PR head)':x=12:y=24:fontsize=14:fontcolor=black,drawtext=text='Round 3':x=402:y=24:fontsize=14:fontcolor=black`;
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
          "-vf",
          filter,
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
          path.join(out, file),
        ],
        { stdio: ["pipe", "ignore", "inherit"] },
      );
      const done = once(ff, "close");
      for (let i = 0; i < frames; i++) {
        const segment = Math.min(3, Math.floor((i * 4) / frames));
        const angle = 30 * Math.sin(Math.PI * ((i * 4) / frames - segment));
        const yaw = segment < 2 ? (segment === 0 ? -angle : angle) : 0;
        const pitch = segment >= 2 ? (segment === 2 ? -angle : angle) : 0;
        const rendered = [];
        for (const page of pages) {
          const shot = await poseR3(page, yaw, pitch, "color", [0.94, 0.95, 0.97]);
          rendered.push(PNG.sync.read(Buffer.from(shot.image.split(",")[1], "base64")));
        }
        const pair = new PNG({ width: rendered[0].width * 2, height: rendered[0].height });
        for (let k = 0; k < 2; k++)
          PNG.bitblt(
            rendered[k],
            pair,
            0,
            0,
            rendered[k].width,
            rendered[k].height,
            k * rendered[k].width,
            0,
          );
        if (!ff.stdin.write(PNG.sync.write(pair))) await once(ff.stdin, "drain");
      }
      ff.stdin.end();
      const [code] = await done;
      if (code !== 0) throw new Error(`Video encoding failed: ${file}`);
      rows.push({
        id: entry.id,
        view,
        file,
        frames,
        fps,
        deviceScaleFactor: 3,
        profile: "low",
        size: [780, 844],
        label,
      });
      fs.writeFileSync(
        manifestFile,
        JSON.stringify(
          {
            browser: browser.version(),
            builds: { before: builds.before, after: builds.after },
            rows,
          },
          null,
          2,
        ),
      );
      console.log(file);
    }
} finally {
  await browser.close();
}
