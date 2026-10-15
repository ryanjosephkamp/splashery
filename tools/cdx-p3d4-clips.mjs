// Paired phone-size review clips from the two real, immutable browser builds.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import crypto from "node:crypto";
import config from "../playwright.config.mjs";
import {
  inputsR4 as inputs,
  screens,
  openR4 as openR3,
  selectR4 as selectR3,
  fingerprintR4,
} from "./cdx-p3d4-common.mjs";
import { poseR3 } from "./cdx-p3d2-r3-common.mjs";
import { inputFingerprintsR3 } from "./cdx-p3d2-r3-fingerprint.mjs";

const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const out = opt("out", ".cache/photo-3d-r4/clips");
const ids = opt("samples", "all");
const selected = inputs().filter((s) => ids === "all" || ids.split(",").includes(s.id));
const fps = Number(opt("fps", 12)),
  frames = fps * Number(opt("seconds", 6));
const sharpRestFrames = Number(opt("sharp-rest-frames", 1));
if (![1, 2].includes(sharpRestFrames)) throw new RangeError("Use one or two warmed Sharp frames.");
const capturePolicy = { first: 2, sharpRest: sharpRestFrames, splats: 2, pairedWindow: true };
const methodSources = [
  "cdx-p3d2-r3-common.mjs",
  "cdx-p3d4-common.mjs",
  "cdx-p3d4-clips.mjs",
  "cdx-p3d2-r3-fingerprint.mjs",
].map((name) => ({
  name,
  bytes: fs.readFileSync(`tools/${name}`),
}));
const methodDigest = crypto.createHash("sha256");
for (const source of methodSources) methodDigest.update(source.bytes);
const methodHash = methodDigest.digest("hex");
fs.mkdirSync(out, { recursive: true });
const manifestFile = path.join(out, "clips.json");
const retained = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile)) : null;
const rows = retained?.rows || [];
const urls = [opt("before", "http://127.0.0.1:4174/"), opt("after", "http://127.0.0.1:4175/")];
const [before, after] = await Promise.all(urls.map((url) => fingerprintR4(url)));
const builds = { before, after };
const inputHashes = inputFingerprintsR3(inputs());
if (
  retained &&
  (JSON.stringify(retained.builds) !== JSON.stringify(builds) ||
    JSON.stringify(retained.inputHashes) !== JSON.stringify(inputHashes) ||
    retained.methodHash !== methodHash ||
    JSON.stringify(retained.capturePolicy) !== JSON.stringify(capturePolicy) ||
    rows.some((r) => r.frames !== frames || r.fps !== fps))
)
  throw new Error("Saved review clips use different builds or timing; use a fresh directory.");
fs.mkdirSync(path.join(out, "method-source"), { recursive: true });
for (const source of methodSources)
  fs.writeFileSync(path.join(out, "method-source", source.name), source.bytes);
const browser = await chromium.launch(config.use.launchOptions);
try {
  const pages = [];
  const pairPage = await browser.newPage({
    viewport: { width: 780, height: 844 },
    deviceScaleFactor: 3,
  });
  await pairPage.setContent(
    '<style>body{margin:0;display:flex}iframe{border:0;width:390px;height:844px;flex:none}</style><iframe name="checkpoint"></iframe><iframe name="after"></iframe>',
  );
  const pairFrames = [pairPage.frame({ name: "checkpoint" }), pairPage.frame({ name: "after" })];
  for (let k = 0; k < urls.length; k++) {
    const url = urls[k];
    for (const [file, hash] of Object.entries(k ? builds.after.files : builds.before.files)) {
      const response = await fetch(new URL(file, url));
      if (!response.ok) throw new Error(`Cannot read browser source: ${file}`);
      const actual = crypto
        .createHash("sha256")
        .update(Buffer.from(await response.arrayBuffer()))
        .digest("hex");
      if (actual !== hash) throw new Error(`Review browser source changed: ${file}`);
    }
    const page = pairFrames[k];
    page.route = (...args) => pairPage.route(...args);
    page.unroute = (...args) => pairPage.unroute(...args);
    page.bringToFront = () => pairPage.bringToFront();
    await openR3(page, url, screens.phone);
    pages.push(page);
  }
  for (const entry of selected)
    for (const view of opt("views", "sharp").split(",")) {
      const file = `${entry.id}-${view}-before-after.mp4`;
      if (rows.some((row) => row.file === file) && fs.existsSync(path.join(out, file))) continue;
      for (const page of pages) {
        await page.bringToFront();
        await selectR3(page, entry, 1, view);
      }
      const sourceLabel = entry.ai || entry.id.startsWith("dot-") ? "AI-made" : "CC0 photo";
      const label = `${entry.id} | ${sourceLabel} | ${view === "sharp" ? "Sharp" : "Fine Splats (hybrid)"} | Depth 1`;
      const started = performance.now();
      const filter = `scale=780:844,drawbox=x=0:y=0:w=iw:h=44:color=white@0.9:t=fill,drawtext=text='${label}':x=12:y=5:fontsize=15:fontcolor=black,drawtext=text='Checkpoint':x=12:y=24:fontsize=14:fontcolor=black,drawtext=text='Round 4':x=402:y=24:fontsize=14:fontcolor=black`;
      const ff = spawn(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-filter_threads",
          "1",
          "-y",
          "-f",
          "rawvideo",
          "-pixel_format",
          "rgba",
          "-video_size",
          "1170x1266",
          "-framerate",
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
          "-threads",
          "2",
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
      let nativeBuffer;
      const pixelComparison = [];
      for (let i = 0; i < frames; i++) {
        const segment = Math.min(3, Math.floor((i * 4) / frames));
        const angle = 30 * Math.sin(Math.PI * ((i * 4) / frames - segment));
        const yaw = segment < 2 ? (segment === 0 ? -angle : angle) : 0;
        const pitch = segment >= 2 ? (segment === 2 ? -angle : angle) : 0;
        await pairPage.bringToFront();
        const captures = i === 0 || view !== "sharp" ? 2 : sharpRestFrames;
        const shots = await Promise.all(
          pages.map((page) => poseR3(page, yaw, pitch, "color", [0.94, 0.95, 0.97], captures)),
        );
        const rendered = shots.map((shot) =>
          PNG.sync.read(Buffer.from(shot.image.split(",")[1], "base64")),
        );
        nativeBuffer = [rendered[0].width, rendered[0].height];
        if (
          JSON.stringify(nativeBuffer) !== "[585,1266]" ||
          rendered[1].width !== rendered[0].width ||
          rendered[1].height !== rendered[0].height
        )
          throw new Error("Review clip drawing buffers changed.");
        let changedPixels = 0,
          maximumChannelError = 0,
          absoluteError = 0;
        for (let p = 0; p < rendered[0].data.length; p += 4) {
          let changed = false;
          for (let c = 0; c < 3; c++) {
            const delta = Math.abs(rendered[0].data[p + c] - rendered[1].data[p + c]);
            if (delta) changed = true;
            maximumChannelError = Math.max(maximumChannelError, delta);
            absoluteError += delta;
          }
          if (changed) changedPixels++;
        }
        pixelComparison.push({
          frame: i,
          yaw,
          pitch,
          changedPixels,
          maximumChannelError,
          meanAbsoluteChannelError: absoluteError / (rendered[0].width * rendered[0].height * 3),
          hashes: rendered.map((p) => crypto.createHash("sha256").update(p.data).digest("hex")),
        });
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
        if (!ff.stdin.write(pair.data)) await once(ff.stdin, "drain");
      }
      if (pixelComparison.length !== frames)
        throw new Error("Review clip did not capture every real frame.");
      ff.stdin.end();
      const [code] = await done;
      if (code !== 0) throw new Error(`Video encoding failed: ${file}`);
      rows.push({
        elapsedMs: performance.now() - started,
        id: entry.id,
        view,
        file,
        frames,
        fps,
        deviceScaleFactor: 3,
        profile: "low",
        nativeBuffer,
        pixelComparison,
        size: [780, 844],
        label,
        madeBy: "Ryan with Codex (GPT-6)",
        source: {
          author: entry.author,
          url: entry.source,
          license: entry.license,
          label: sourceLabel,
        },
        recordingLicense: "CC0 1.0, subject to the source image license",
      });
      fs.writeFileSync(
        manifestFile,
        JSON.stringify(
          {
            browser: browser.version(),
            methodHash,
            methodSource: "method-source/",
            capturePolicy,
            capture:
              "Two visible phone iframes; completed frames captured concurrently, with lossless raw-RGBA handoff to the video encoder. Verified byte-identical to separate foreground windows at 0 and both signs of 30 degrees on each axis. Camera poses and native drawing-buffer resolution remain unchanged.",
            builds,
            inputHashes,
            urls,
            path: "Four continuous sine arcs: yaw -30,+30 then pitch -30,+30; no frame interpolation.",
            rows,
          },
          null,
          2,
        ),
      );
      console.log(file);
    }
  const end = await Promise.all(urls.map((url) => fingerprintR4(url)));
  if (JSON.stringify(end) !== JSON.stringify([before, after]))
    throw new Error("Source changed during recording.");
} finally {
  await browser.close();
}
