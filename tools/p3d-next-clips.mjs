// MIT; made by Ryan with Codex (GPT-6). Actual phone frames, no interpolation.
// These are review pairs, not owner votes or timing observations.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { PNG } from "pngjs";
import { inventory } from "./p3df/inputs.mjs";
import { localServer } from "./p3df/browser.mjs";
import { measureNext } from "./p3d-next-browser.mjs";
const root = path.resolve(".cache/photo-3d-next"),
  out = path.join(root, "clips");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const selection = JSON.parse(fs.readFileSync(path.join(root, "atlas-scout/selection.json")));
const all = [...inventory(), ...inventory({ manifest: path.join(root, "extra-manifest.json") })];
const entries = selection.map((r) => all.find((e) => e.id === r.id));
if (entries.length !== 20 || entries.some((e) => !e || e.kind === "private"))
  throw new Error("Need twenty public review inputs");
const frames = 72,
  fps = 12;
const poses = Array.from({ length: frames }, (_, i) => {
  const segment = Math.min(3, Math.floor((i * 4) / frames));
  const angle = Number((30 * Math.sin(Math.PI * ((i * 4) / frames - segment))).toFixed(6));
  return segment < 2 ? [segment === 0 ? -angle : angle, 0] : [0, segment === 2 ? -angle : angle];
});
const sources = [
  "src/photo3d/next/patchmatch.js",
  "src/photo3d/next/clean-color.js",
  "src/photo3d/build-worker.js",
  "src/live/relief-mesh.js",
  "tools/p3df/browser.mjs",
  "tools/p3d-next-browser.mjs",
  "tools/p3d-next-shader.mjs",
  "tools/p3d-next-clips.mjs",
  "playwright.config.mjs",
  "tools/cdx-p3d2-r3-common.mjs",
  "src/depth/engine.js",
  "src/packs/photo-3d-core.js",
  "src/stage.js",
];
const identity = {
  gl: process.env.SPLASHERY_GL || "swiftshader",
  sources: Object.fromEntries(sources.map((f) => [f, hash(fs.readFileSync(f))])),
  selection,
  frames,
  fps,
  poses,
};
fs.mkdirSync(out, { recursive: true });
const guard = path.join(out, "settings.json");
if (
  fs.existsSync(guard) &&
  JSON.stringify(JSON.parse(fs.readFileSync(guard))) !== JSON.stringify(identity)
)
  throw new Error("Review capture settings changed; use a fresh folder");
fs.writeFileSync(guard, JSON.stringify(identity, null, 2));
const result = {
  complete: false,
  scope: "Twenty actual phone pairs: Classic and research Layered A; owner votes unmeasured",
  path: "Four continuous sine arcs: yaw -30,+30, then pitch -30,+30",
  frames,
  fps,
  native: [585, 1266],
  size: [390, 844],
  frameInterpolation: false,
  ownerVotes: null,
  rows: [],
};
const server = await localServer(entries);
try {
  for (const entry of entries) {
    const pair = {
      id: entry.id,
      category: selection.find((r) => r.id === entry.id).category,
      photoSha256: entry.sha256,
      source: { author: entry.author, url: entry.source, license: entry.license },
      methods: [],
    };
    let firstCameras = null;
    for (const candidate of ["classic", "layered-a"]) {
      const folder = path.join(out, entry.id, candidate);
      fs.mkdirSync(folder, { recursive: true });
      const metadata = path.join(folder, "capture.json");
      const observation = fs.existsSync(metadata)
        ? JSON.parse(fs.readFileSync(metadata))
        : await measureNext(entry, "phone", {
            server,
            out: folder,
            poses,
            depth: 0.5,
            diagnostics: false,
            candidate,
            band: 3,
            patch: { passes: 3, radius: 2, coherent: false },
          });
      fs.writeFileSync(metadata, JSON.stringify(observation));
      if (
        observation.errors.length ||
        observation.externalRequests.length ||
        observation.rows.length !== frames ||
        JSON.stringify(observation.native) !== "[585,1266]"
      )
        throw new Error("Invalid phone recording: " + entry.id);
      if (
        firstCameras &&
        JSON.stringify(firstCameras) !== JSON.stringify(observation.targetCameras)
      )
        throw new Error("Camera registration differs within a pair");
      firstCameras = observation.targetCameras;
      if (hash(fs.readFileSync(entry.file)) !== entry.sha256)
        throw new Error("Review photo changed");
      const file = `${entry.id}-${candidate}.mp4`,
        target = path.join(out, file);
      if (!fs.existsSync(target)) {
        const label =
          entry.ai || entry.id.startsWith("dot-") || entry.id.startsWith("cdx-hard-")
            ? "AI-made sample"
            : "Public licensed sample";
        const ff = spawn(
          "ffmpeg",
          [
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-filter_threads",
            "1",
            "-f",
            "rawvideo",
            "-pixel_format",
            "rgba",
            "-video_size",
            "585x1266",
            "-framerate",
            String(fps),
            "-i",
            "pipe:0",
            "-vf",
            `scale=390:844,drawbox=x=0:y=0:w=iw:h=26:color=white:t=fill,drawtext=text='${label}':x=8:y=5:fontsize=14:fontcolor=black`,
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-threads",
            "1",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            target + ".partial.mp4",
          ],
          { stdio: ["pipe", "ignore", "inherit"] },
        );
        const done = once(ff, "close");
        ff.stdin.on("error", () => {});
        try {
          for (const row of observation.rows) {
            const png = PNG.sync.read(fs.readFileSync(path.join(folder, row.image)));
            if (hash(png.data) !== row.rgbaSha256)
              throw new Error("A captured frame changed before encoding");
            if (!ff.stdin.write(png.data)) await once(ff.stdin, "drain");
          }
          ff.stdin.end();
          const [code] = await done;
          if (code !== 0) throw new Error("Video encoding failed");
          fs.renameSync(target + ".partial.mp4", target);
        } catch (error) {
          ff.kill("SIGTERM");
          throw error;
        }
      }
      const probe = JSON.parse(
        (await import("node:child_process")).execFileSync(
          "ffprobe",
          [
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,nb_frames,r_frame_rate",
            "-of",
            "json",
            target,
          ],
          { encoding: "utf8" },
        ),
      ).streams[0];
      if (
        probe.width !== 390 ||
        probe.height !== 844 ||
        Number(probe.nb_frames) !== frames ||
        probe.r_frame_rate !== "12/1"
      )
        throw new Error("Encoded clip geometry or frame count differs");
      pair.methods.push({
        candidate,
        file,
        sha256: hash(fs.readFileSync(target)),
        bytes: fs.statSync(target).size,
        overlayProof: observation.overlayProof,
        renderer: observation.renderer,
        browser: observation.browser,
        frames: observation.rows.map((r) => ({
          yaw: r.yaw,
          pitch: r.pitch,
          rgbaSha256: r.rgbaSha256,
        })),
      });
      console.log(entry.id, candidate, "72 actual phone frames", new Date().toISOString());
    }
    if (
      JSON.stringify(pair.methods[0].frames.map(({ yaw, pitch }) => [yaw, pitch])) !==
      JSON.stringify(pair.methods[1].frames.map(({ yaw, pitch }) => [yaw, pitch]))
    )
      throw new Error("Unpaired camera path");
    result.rows.push(pair);
    fs.writeFileSync(path.join(out, "clips.json"), JSON.stringify(result, null, 2));
  }
  for (const file of sources)
    if (hash(fs.readFileSync(file)) !== identity.sources[file])
      throw new Error("Recording source changed");
  result.complete = result.rows.length === 20;
} finally {
  fs.writeFileSync(path.join(out, "clips.json"), JSON.stringify(result, null, 2));
  await server.close();
}
