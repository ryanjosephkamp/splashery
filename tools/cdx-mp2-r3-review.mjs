// Encode actual phone PNGs from the two every-frame goal sweeps.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const credits = {
  sample: {
    author: "Blender Foundation / www.bigbuckbunny.org",
    page: "https://peach.blender.org/about/",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  },
  horse: {
    author: "Eadweard Muybridge, 1887",
    page: "https://commons.wikimedia.org/wiki/File:Muybridge_race_horse_animated.gif",
    license: "Public domain",
  },
  dragon: {
    author: "Blender Foundation",
    page: "https://durian.blender.org/about/",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  },
  bridge: {
    author: "Blender Foundation",
    page: "https://mango.blender.org/about/",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  },
  machine: {
    author: "Blender Foundation / Netherlands Media Art Institute / www.elephantsdream.org (2006)",
    page: "https://orange.blender.org/blog/creative-commons-license-2/",
    license: "CC BY 2.5",
    licenseUrl: "https://creativecommons.org/licenses/by/2.5/",
  },
};
const option = (key, fallback) =>
  process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
const before = JSON.parse(
  await fs.readFile(option("before", ".cache/cdx-mp3/baseline-native.json"), "utf8"),
);
const after = JSON.parse(
  await fs.readFile(option("after", ".cache/cdx-mp3/final-goal.json"), "utf8"),
);
const input = [
  option("before-frames", ".cache/cdx-mp3/review-before"),
  option("after-frames", ".cache/cdx-mp3/review-after"),
];
const dir = option("out", ".cache/cdx-mp3/review");
if (
  !before.sourceWitness ||
  !after.sourceWitness ||
  !after.snapshotHash ||
  before.oracleVersion !== "native-role-v4" ||
  before.oracleVersion !== after.oracleVersion
)
  throw new Error("Review requires both native-witness sweeps and a pinned candidate");
await fs.mkdir(dir, { recursive: true });
const baseline = execFileSync("git", ["rev-parse", before.baseline], { encoding: "utf8" }).trim();
const manifest = {
  baseline,
  snapshotHash: after.snapshotHash,
  oracleVersion: after.oracleVersion,
  viewport: [390, 844],
  deviceScaleFactor: 3,
  camera: { yaw: 0.18, pitch: 0.08 },
  presentation:
    "Actual phone-stage pixels, every source frame, native clocks; white background; before/after side by side",
  cases: [],
};
const cases = after.results.filter(
  (r) =>
    r.profile === "phone" &&
    r.id !== "fast60" &&
    (!r.upload || ["bridge", "machine"].includes(r.id)),
);
if (cases.length !== 11)
  throw new Error(`Expected nine samples and two uploads; found ${cases.length}`);
for (const a of cases) {
  const b = before.results.find(
    (r) => r.profile === "phone" && r.id === a.id && r.upload === a.upload,
  );
  const tag = `${a.id}-${a.upload ? "upload" : "sample"}`;
  if (!b || !a.everyFrame || !b.everyFrame || a.errors.length || b.errors.length)
    throw new Error(`Incomplete review pair: ${tag}`);
  if (
    a.framesMeasured !== b.framesMeasured ||
    a.frames.length !== a.framesMeasured ||
    b.frames.length !== b.framesMeasured ||
    a.measuredFps !== b.measuredFps ||
    after.sourceHashes[a.id] !== before.sourceHashes[a.id]
  )
    throw new Error(`Different source frames in ${tag}`);
  for (const row of [a, b])
    if (
      row.frames.some((frame) => !frame.sourcePixelsVerified || !Number.isFinite(frame.sourceTime))
    )
      throw new Error(`Unverified displayed source frame in ${tag}`);
  for (let i = 0; i < a.frames.length; i++)
    if (Math.abs(a.frames[i].sourceTime - b.frames[i].sourceTime) > 0.0001)
      throw new Error(`Source clock differs at ${tag} frame ${i}`);
  const frames = a.framesMeasured,
    fps = a.measuredFps;
  const [width, height] = a.frames[0].canvas;
  for (const row of [a, b])
    if (
      row.frames.some(
        (frame) => frame.canvas.join() !== [width, height].join() || frame.dpr !== a.frames[0].dpr,
      )
    )
      throw new Error(`Different phone canvases in ${tag}`);
  const protocol = {
    oracleVersion: after.oracleVersion,
    sourcePixelsVerified: true,
    sourceSha256: after.sourceHashes[a.id],
    sourceClockHashes: [b, a].map((row) =>
      createHash("sha256")
        .update(JSON.stringify(row.frames.map((frame) => [frame.time, frame.sourceTime])))
        .digest("hex"),
    ),
    frames,
    fps,
    actualStageCanvas: a.frames[0].canvas,
    actualStageDpr: a.frames[0].dpr,
    encoding: { codec: "VP9", crf: 24, cpuUsed: 4, pixelFormat: "yuv420p", audio: false },
  };
  const movie = path.join(dir, `${tag}.webm`),
    saved = path.join(dir, `${tag}.json`);
  const verifyMovie = () => {
    const stream = JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-select_streams",
          "v:0",
          "-count_frames",
          "-show_entries",
          "stream=width,height,nb_read_frames,avg_frame_rate",
          "-of",
          "json",
          movie,
        ],
        { encoding: "utf8", timeout: 120000 },
      ),
    ).streams[0];
    const [n, d] = stream.avg_frame_rate.split("/").map(Number);
    if (
      stream.width !== 780 ||
      stream.height !== 844 ||
      Number(stream.nb_read_frames) !== frames ||
      !Number.isFinite(n / d) ||
      Math.abs(n / d - fps) > 1e-6
    )
      throw new Error(`Encoded frame count, dimensions, or rate changed in ${tag}`);
    return { decodedFrames: Number(stream.nb_read_frames), dimensions: [780, 844], fps: n / d };
  };
  if (option("resume", "") === "true") {
    try {
      const old = JSON.parse(await fs.readFile(saved, "utf8"));
      if (old.baseline !== baseline || old.snapshotHash !== after.snapshotHash)
        throw new Error("Review movie belongs to a different code version");
      if (
        Object.entries(protocol).some(
          ([key, value]) => JSON.stringify(old[key]) !== JSON.stringify(value),
        )
      )
        throw new Error("Review movie belongs to a different source verification protocol");
      const bytes = await fs.readFile(movie);
      if (createHash("sha256").update(bytes).digest("hex") !== old.sha256)
        throw new Error("Review movie checksum changed");
      verifyMovie();
      manifest.cases.push(old);
      continue;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  for (const root of input) {
    const names = new Set(
      (await fs.readdir(path.join(root, tag))).filter((file) => file.endsWith(".png")),
    );
    if (
      names.size !== frames ||
      Array.from({ length: frames }, (_, i) => `${String(i).padStart(5, "0")}.png`).some(
        (file) => !names.has(file),
      )
    )
      throw new Error(`Missing actual frames for ${tag}: ${root}`);
  }
  const background = (id) =>
    `color=c=white:s=${width}x${height}:r=${fps}:d=${frames / fps},format=rgba[bg${id}];[bg${id}][${id}:v]overlay=shortest=1:format=auto,scale=390:-2,pad=390:844:0:(oh-ih)/2:white[p${id}]`;
  const filter = `${background(0)};${background(1)};[p0][p1]hstack,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='Before #560':x=14:y=14:fontsize=18:fontcolor=black,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='After Round 3':x=404:y=14:fontsize=18:fontcolor=black`;
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-framerate",
      String(fps),
      "-i",
      path.join(input[0], tag, "%05d.png"),
      "-framerate",
      String(fps),
      "-i",
      path.join(input[1], tag, "%05d.png"),
      "-filter_complex",
      filter,
      "-frames:v",
      String(frames),
      "-c:v",
      "libvpx-vp9",
      "-cpu-used",
      "4",
      "-crf",
      "24",
      "-b:v",
      "0",
      "-row-mt",
      "1",
      "-threads",
      "2",
      "-pix_fmt",
      "yuv420p",
      "-an",
      movie,
    ],
    { timeout: 300000 },
  );
  const bytes = await fs.readFile(movie);
  if (bytes.length >= 20e6) throw new Error("Review movie exceeds the 20 MB asset limit");
  const record = {
    id: a.id,
    upload: a.upload,
    baseline,
    snapshotHash: after.snapshotHash,
    source: a.source,
    ...credits[a.id.replace(/-long$/, "")],
    ...(a.id === "sample-long"
      ? { license: "CC BY 3.0 US", licenseUrl: "https://creativecommons.org/licenses/by/3.0/us/" }
      : {}),
    checked: "October 13, 2026",
    modifications:
      "Existing source cut rendered as a 3D relief, every source frame, before/after side by side, white transparency background, phone-size comparison labels, VP9, no audio",
    madeBy: "Ryan with Codex (GPT-6)",
    ...protocol,
    encodedVerification: verifyMovie(),
    duration: frames / fps,
    file: path.basename(movie),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  manifest.cases.push(record);
  await fs.writeFile(saved, JSON.stringify(record, null, 2) + "\n");
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({ tag, frames, fps, bytes: bytes.length }));
}
await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
