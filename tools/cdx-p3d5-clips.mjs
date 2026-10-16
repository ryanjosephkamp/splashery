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
  screens,
  openR4 as openR3,
  selectR4 as selectR3,
  fingerprintR4,
} from "./cdx-p3d4-common.mjs";
import { poseR3 } from "./cdx-p3d2-r3-common.mjs";
import { inventory, hash } from "./p3df/inputs.mjs";
import { verifyRetainedClips } from "./cdx-p3d5-clip-state.mjs";

const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const out = opt("out", ".cache/photo-3d-r5/clips");
const manifest = opt("manifest", null);
if (!manifest) throw new Error("Use --manifest=FILE with immutable image and depth paths.");
const entries = inventory({ manifest }).map((e) => ({
  ...e,
  builtin: e.kind === "builtin",
  ...(e.rawDepthFile ? { rawDepthFile: path.resolve(path.dirname(manifest), e.rawDepthFile) } : {}),
}));
if (entries.some((e) => e.kind === "private"))
  throw new Error("This review tool accepts the public corpus only.");
const depth = Number(opt("depth", 1));
if (!Number.isFinite(depth) || depth < 0 || depth > 1) throw new Error("Depth must be in 0..1.");
const inputs = () => entries;
const originals = new Map(entries.map((e) => [e.id, e]));
for (const entry of entries) {
  if (!entry.builtin && !entry.rawDepthFile && !entry.depthFile)
    throw new Error("Supply the original inference or baked depth: " + entry.id);
  if (entry.rawDepthFile) {
    const raw = JSON.parse(fs.readFileSync(entry.rawDepthFile));
    if (
      raw.inputSha256 !== entry.sha256 ||
      raw.d.length !== raw.w * raw.h ||
      raw.d.some((v) => !Number.isFinite(v))
    )
      throw new Error("Raw model output does not match the input: " + entry.id);
  }
}
async function selectR5(page, entry, depth, view) {
  if (!entry.builtin) {
    await page.evaluate(
      async ({ id, raw }) => {
        if (window.__r3Input === id) return;
        const p = await import("/src/packs/photo-3d.js");
        const photo = await p.decodePhoto(await (await fetch(`/__p3d5/${id}/photo`)).blob());
        const response = await fetch(`/__p3d5/${id}/depth`);
        let d;
        if (raw) {
          const r = await response.json();
          d = { w: r.w, h: r.h, d: Float32Array.from(r.d) };
        } else d = p.unpackDepth(new Uint8Array(await response.arrayBuffer()));
        p.usePhoto(photo, d, `Review input: ${id}`);
        window.__r3Input = id;
      },
      { id: entry.id, raw: !!entry.rawDepthFile },
    );
  }
  await selectR3(page, entry, depth, view);
}
const ids = opt("samples", "all");
const selected = inputs().filter((s) => ids === "all" || ids.split(",").includes(s.id));
if (!selected.length || (ids !== "all" && selected.length !== new Set(ids.split(",")).size))
  throw new Error("A requested review input is missing.");
const fps = Number(opt("fps", 12)),
  frames = fps * Number(opt("seconds", 6));
if (!Number.isInteger(fps) || fps < 1 || fps > 60 || !Number.isInteger(frames) || frames < 1)
  throw new Error("Use a positive whole frame count and 1 to 60 frames per second.");
const sharpRestFrames = Number(opt("sharp-rest-frames", 1));
if (![1, 2].includes(sharpRestFrames)) throw new RangeError("Use one or two warmed Sharp frames.");
const capturePolicy = { first: 2, sharpRest: sharpRestFrames, splats: 2, pairedWindow: true };
const methodSources = [
  "cdx-p3d2-r3-common.mjs",
  "cdx-p3d4-common.mjs",
  "cdx-p3d5-clips.mjs",
  "cdx-p3d5-clip-state.mjs",
  "p3df/inputs.mjs",
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
verifyRetainedClips(rows, out, { frames, fps });
const urls = [opt("before", null), opt("after", null)];
if (urls.some((url) => !url))
  throw new Error("Name both immutable builds explicitly: --before=URL --after=URL.");
const [before, after] = await Promise.all(urls.map((url) => fingerprintR4(url)));
const builds = { before, after };
const inputHashes = entries.map((e) => ({
  id: e.id,
  photoSha256: e.sha256,
  depthSha256: hash(fs.readFileSync(e.rawDepthFile || e.depthFile)),
  depthKind: e.rawDepthFile
    ? "original raw Float32 inference, used equally by both builds"
    : "original baked depth",
}));
if (
  retained &&
  (JSON.stringify(retained.builds) !== JSON.stringify(builds) ||
    JSON.stringify(retained.inputHashes) !== JSON.stringify(inputHashes) ||
    retained.methodHash !== methodHash ||
    JSON.stringify(retained.capturePolicy) !== JSON.stringify(capturePolicy) ||
    retained.depth !== depth ||
    rows.some((r) => r.frames !== frames || r.fps !== fps))
)
  throw new Error("Saved review clips use different builds or timing; use a fresh directory.");
fs.mkdirSync(path.join(out, "method-source"), { recursive: true });
for (const source of methodSources) {
  const file = path.join(out, "method-source", source.name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source.bytes);
}
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
    await page.route("**/__p3d5/**", (route) => {
      const [id, kind] = new URL(route.request().url()).pathname
        .slice("/__p3d5/".length)
        .split("/");
      const entry = originals.get(id);
      if (!entry || !["photo", "depth"].includes(kind)) return route.abort();
      return route.fulfill({
        body: fs.readFileSync(
          kind === "photo" ? entry.file : entry.rawDepthFile || entry.depthFile,
        ),
        contentType:
          kind === "depth"
            ? entry.rawDepthFile
              ? "application/json"
              : "application/octet-stream"
            : entry.file.endsWith(".gif")
              ? "image/gif"
              : entry.file.endsWith(".png")
                ? "image/png"
                : "image/jpeg",
      });
    });
    pages.push(page);
  }
  for (const entry of selected)
    for (const view of opt("views", "sharp").split(",")) {
      const file = `${entry.id}-${view}-before-after.mp4`;
      if (rows.some((row) => row.file === file) && fs.existsSync(path.join(out, file))) continue;
      for (const page of pages) {
        await page.bringToFront();
        await selectR5(page, entry, depth, view);
      }
      const sourceLabel =
        entry.ai || entry.id.startsWith("dot-") || entry.id.startsWith("cdx-hard-")
          ? "AI-made"
          : entry.kind === "truth"
            ? "CC0 reference scene"
            : entry.id === "still-life"
              ? "CC0 painting"
              : entry.file.endsWith(".gif")
                ? "CC0 GIF, first frame"
                : "CC0 photo";
      const label = `${entry.id} | ${sourceLabel} | ${view === "sharp" ? "Sharp" : "Fine Splats (hybrid)"} | Depth ${depth}`;
      const started = performance.now();
      const filter = `scale=780:844,drawbox=x=0:y=0:w=iw:h=44:color=white@0.9:t=fill,drawtext=text='${label}':x=12:y=5:fontsize=15:fontcolor=black,drawtext=text='Checkpoint':x=12:y=24:fontsize=14:fontcolor=black,drawtext=text='Round 5':x=402:y=24:fontsize=14:fontcolor=black`;
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
        sha256: hash(fs.readFileSync(path.join(out, file))),
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
      const currentHashes = entries.map((e) => ({
        id: e.id,
        photo: hash(fs.readFileSync(e.file)),
        depth: hash(fs.readFileSync(e.rawDepthFile || e.depthFile)),
      }));
      if (
        currentHashes.some(
          (e, i) =>
            e.photo !== inputHashes[i].photoSha256 || e.depth !== inputHashes[i].depthSha256,
        )
      )
        throw new Error("Review source bytes changed during capture.");
      fs.writeFileSync(
        manifestFile + ".tmp",
        JSON.stringify(
          {
            browser: browser.version(),
            methodHash,
            methodSource: "method-source/",
            capturePolicy,
            capture:
              "Two visible phone iframes; completed frames captured concurrently, with lossless raw-RGBA handoff to the video encoder. Camera poses and native drawing-buffer resolution remain unchanged.",
            builds,
            inputHashes,
            depth,
            costUse:
              "Review only; supplied model output is identical in both builds. Cold inference and first-view cost are measured separately.",
            urls,
            path: "Four continuous sine arcs: yaw -30,+30 then pitch -30,+30; no frame interpolation.",
            rows,
          },
          null,
          2,
        ),
      );
      fs.renameSync(manifestFile + ".tmp", manifestFile);
      console.log(file);
    }
  const end = await Promise.all(urls.map((url) => fingerprintR4(url)));
  if (JSON.stringify(end) !== JSON.stringify([before, after]))
    throw new Error("Source changed during recording.");
  for (const source of methodSources)
    if (!fs.readFileSync(`tools/${source.name}`).equals(source.bytes))
      throw new Error("Recording method changed during capture: " + source.name);
} finally {
  await browser.close();
}
