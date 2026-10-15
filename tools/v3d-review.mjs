#!/usr/bin/env node
// MIT. Made by Ryan with Codex (GPT-6). Review media from measured task-88 results, never bakes.
// plan|render|failures <manifest> <main-output> <candidate-output> <review-output>
//   [--profile=phone|desktop] [--ids=a,b] [--seconds=6] [--fps=12] [--size=390x844]
//   [--main-url=http://127.0.0.1:4174/] [--candidate-url=http://127.0.0.1:4173/]
//   [--timeout=600000] [--retry] (preserve an interrupted/mismatched case before retrying)
// plan and failures never launch a browser. render must run separately from timed bakes.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { accountedOutcome, compareRuns, fingerprint, rowKey } from "./v3d-bench-metrics.mjs";
import {
  verifyArtifacts,
  assertReferenceEvidence,
  servedSourceFingerprint,
  withHostDeadline,
  closeBrowserBounded,
} from "./v3d-bench.mjs";

const repo = path.resolve(import.meta.dirname, "..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
// Append a read-only getter to the actual routed production module. Public V3D.info telemetry
// omits these flags, so it cannot establish which cleanup path the loaded scene used.
export const REPLAY_SCENE_OBSERVER = `
export function __v3dReviewScene() {
  const scene = V3D.shown;
  return scene ? {
    uid: scene.uid,
    affine: scene.affine,
    preservePhotometric: scene.preservePhotometric,
  } : null;
}
`;
const read = (file) => JSON.parse(fs.readFileSync(file));
const write = (file, data) => {
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(`${file}.tmp`, file);
};
const safeId = (id) => typeof id === "string" && /^[a-z0-9][a-z0-9-]*$/.test(id);
const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

export function validateReviewRuns(clips, mainRun, candidateRun) {
  if (!clips.length || new Set(clips.map((c) => c.id)).size !== clips.length)
    throw new Error("The review needs a nonempty, distinct source inventory.");
  for (const c of clips) {
    if (
      !safeId(c.id) ||
      !/^[a-f0-9]{64}$/.test(c.sha256) ||
      ["label", "author", "license", "licenseUrl", "source", "transformation"].some(
        (k) => !c[k]?.trim(),
      )
    )
      throw new Error(`Missing source/license metadata: ${c.id}.`);
    for (const key of ["source", "licenseUrl"])
      if (!/^https?:\/\//.test(c[key])) throw new Error(`Invalid credit URL: ${c.id}.`);
  }
  const comparison = compareRuns(mainRun, candidateRun);
  if (
    !comparison.provenanceCompatible ||
    fingerprint(mainRun.cohort.inputs) !==
      fingerprint(clips.map(({ id, sha256 }) => ({ id, sha256 })))
  )
    throw new Error(
      "Review runs have incompatible provenance, reference binding, or source inputs.",
    );
  const validIds = new Map(clips.map((c) => [c.id, c.sha256]));
  for (const run of [mainRun, candidateRun])
    for (const row of run.results)
      if (
        !validIds.has(row.id) ||
        row.sha256 !== validIds.get(row.id) ||
        !run.cohort.profiles.includes(row.profile)
      )
        throw new Error(`Unexpected review result: ${rowKey(row)}.`);
}

export function reviewSelection(
  clips,
  mainRun,
  candidateRun,
  { profile = "phone", ids = [] } = {},
) {
  validateReviewRuns(clips, mainRun, candidateRun);
  if (
    !["phone", "desktop"].includes(profile) ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !clips.some((c) => c.id === id))
  )
    throw new Error("Unknown profile or selected IDs.");
  const before = new Map(
    mainRun.results.filter((r) => r.profile === profile).map((r) => [r.id, r]),
  );
  const after = new Map(
    candidateRun.results.filter((r) => r.profile === profile).map((r) => [r.id, r]),
  );
  const finished = (r) =>
    r?.status === "finished" &&
    accountedOutcome(r) &&
    r.heldoutEvidence?.complete === true &&
    Number.isFinite(r.mean?.ssim) &&
    Number.isFinite(r.mean?.laplacian);
  const inventory = clips.map((clip) => {
    const main = before.get(clip.id),
      candidate = after.get(clip.id);
    const sameReferences =
      main?.frames?.length > 0 &&
      main.frames.length === candidate?.frames?.length &&
      main.frames.every(
        (f, i) =>
          f.time === candidate.frames[i].time &&
          f.referenceSha256 === candidate.frames[i].referenceSha256,
      );
    return {
      id: clip.id,
      mainStatus: main?.status || "pending",
      candidateStatus: candidate?.status || "pending",
      paired: finished(main) && finished(candidate) && sameReferences,
      mainSsim: main?.mean?.ssim ?? null,
      candidateSsim: candidate?.mean?.ssim ?? null,
      mainReason: main?.reason || null,
      candidateReason: candidate?.reason || null,
    };
  });
  const complete = clips.every(
    (c) => accountedOutcome(before.get(c.id)) && accountedOutcome(after.get(c.id)),
  );
  const paired = inventory.filter((r) => r.paired);
  const limitations = [];
  if (!complete)
    limitations.push("The selected-profile corpus is incomplete; best/worst ranks are withheld.");
  if (paired.length < 10)
    limitations.push(
      `Only ${paired.length} verified paired successes are available; ten distinct before/after clips are not available.`,
    );
  let selected = [],
    ranked = false;
  if (ids.length) {
    if (ids.some((id) => !paired.some((r) => r.id === id)))
      throw new Error(
        "Every explicitly selected ID must have two verified successful results with the same references.",
      );
    selected = ids.map((id) => ({ id, group: "unranked", rank: null }));
    limitations.push("Explicitly selected clips are unranked diagnostic captures.");
  } else if (complete && paired.length >= 10) {
    const sorted = paired
      .slice()
      .sort((a, b) => a.candidateSsim - b.candidateSsim || a.id.localeCompare(b.id));
    const worst = sorted.slice(0, 5),
      worstIds = new Set(worst.map((r) => r.id));
    const best = sorted
      .filter((r) => !worstIds.has(r.id))
      .reverse()
      .slice(0, 5);
    selected = [
      ...worst.map((r, i) => ({ id: r.id, group: "worst", rank: i + 1 })),
      ...best.map((r, i) => ({ id: r.id, group: "best", rank: i + 1 })),
    ];
    ranked = true;
  } else if (complete) selected = paired.map((r) => ({ id: r.id, group: "unranked", rank: null }));
  return {
    profile,
    complete,
    ranked,
    rankBasis:
      "Candidate held-out SSIM, among verified paired successes; failures have no image score.",
    pairedSuccesses: paired.length,
    expectedClips: clips.length,
    selected,
    inventory,
    limitations,
  };
}

export function matchedTimeline(mainModel, candidateModel, { seconds = 6, fps = 12 } = {}) {
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isInteger(fps) || fps < 1 || fps > 60)
    throw new Error("Invalid review duration or frame rate.");
  for (const model of [mainModel, candidateModel]) {
    if (
      !model.cams ||
      model.cams.length < 2 ||
      model.cams.some(
        (c, i) =>
          !Number.isFinite(c.time) ||
          (i > 0 && c.time <= model.cams[i - 1].time) ||
          !c.R ||
          c.R.length !== 9 ||
          !c.t ||
          c.t.length !== 3 ||
          [...c.R, ...c.t].some((v) => !Number.isFinite(v)) ||
          !Number.isFinite(c.f) ||
          c.f <= 0 ||
          !Number.isFinite(c.w) ||
          c.w <= 0 ||
          !Number.isFinite(c.h) ||
          c.h <= 0,
      )
    )
      throw new Error("Missing or invalid recorded camera path.");
  }
  const start = Math.max(mainModel.cams[0].time, candidateModel.cams[0].time);
  const end = Math.min(
    mainModel.cams.at(-1).time,
    candidateModel.cams.at(-1).time,
    start + seconds,
  );
  const count = Math.floor((end - start) * fps + 1e-8) + 1;
  if (count < 2) throw new Error("The recorded camera paths have no useful common time range.");
  const times = Array.from({ length: count }, (_, i) => start + i / fps);
  return {
    start,
    end: times.at(-1),
    fps,
    frames: count,
    sourceSpanSeconds: times.at(-1) - start,
    playbackSeconds: count / fps,
    motionReplaySpeed: 1,
    finalFrameHoldSeconds: 1 / fps,
    times,
    protocol:
      "One frame per recorded 1/fps second, from the common path start. Each model uses its own solved coordinate frame and production flight interpolation. No camera fitting, image alignment, mask, or sharpening. The final frame is displayed for one frame interval.",
  };
}

export function assertReplayPixels(bytes, savedBytes, savedSha256) {
  if (hash(savedBytes) !== savedSha256) throw new Error("The saved held-out render changed.");
  const replay = PNG.sync.read(bytes),
    saved = PNG.sync.read(savedBytes);
  if (
    replay.width !== saved.width ||
    replay.height !== saved.height ||
    !replay.data.equals(saved.data)
  )
    throw new Error("Production PLY replay does not reproduce the saved held-out pixels.");
  return {
    savedSha256,
    replaySha256: hash(bytes),
    rgbaSha256: hash(replay.data),
    byteIdentical: bytes.equals(savedBytes),
  };
}

export function assertReplayScene(actual, preservePhotometric) {
  if (
    typeof preservePhotometric !== "boolean" ||
    actual?.uid !== "review-capture" ||
    actual.affine !== true ||
    Boolean(actual.preservePhotometric) !== preservePhotometric
  )
    throw new Error("Production loader did not preserve this version's custom cleanup behavior.");
  return actual;
}

export function pairedRgba(main, candidate, gap = 4) {
  if (main.width !== candidate.width || main.height !== candidate.height)
    throw new Error("Before/after panes must have the same pixel dimensions.");
  const width = main.width * 2 + gap,
    height = main.height;
  const data = Buffer.alloc(width * height * 4, 0);
  for (let y = 0; y < height; y++) {
    main.data.copy(data, y * width * 4, y * main.width * 4, (y + 1) * main.width * 4);
    candidate.data.copy(
      data,
      (y * width + main.width + gap) * 4,
      y * main.width * 4,
      (y + 1) * main.width * 4,
    );
  }
  for (let y = 0; y < height; y++)
    for (let x = main.width; x < main.width + gap; x++) data[(y * width + x) * 4 + 3] = 255;
  return { width, height, data };
}

export function attribution(clip, profile) {
  return (
    `${clip.label}\n${clip.author} — ${clip.license}\nSource: ${clip.source}\nLicense: ${clip.licenseUrl}\n` +
    `Source preparation: ${clip.transformation}\nDerived review media retain the recorded source license: ${clip.license} (${clip.licenseUrl}).\nReview: ${profile}-trained models shown at phone size; synchronized recorded times in independently solved coordinate frames. Production cleanup is retained for each version (main: false; this round: true). No retraining, image alignment, camera fitting, sharpening, or synthetic 3D substitute.\n`
  );
}
const wrap = (text, columns) => {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const token of paragraph.split(/\s+/)) {
      const chunks = token.match(new RegExp(`.{1,${columns}}`, "gu")) || [""];
      for (const word of chunks) {
        if (line.length && line.length + word.length + 1 > columns) {
          lines.push(line);
          line = "";
        }
        line += (line ? " " : "") + word;
      }
    }
    lines.push(line);
  }
  return lines.join("\n");
};

export function startReviewEncoder(
  file,
  {
    paneWidth,
    paneHeight,
    fps,
    clip,
    profile,
    font = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  },
) {
  if (
    !Number.isInteger(paneWidth) ||
    paneWidth < 160 ||
    paneWidth % 2 ||
    !Number.isInteger(paneHeight) ||
    paneHeight < 160 ||
    paneHeight % 2 ||
    !Number.isInteger(fps) ||
    fps < 1
  )
    throw new Error(
      "Use even pane dimensions of at least 160 pixels and a positive integer frame rate.",
    );
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "v3d-review-"));
  fs.copyFileSync(font, path.join(temp, "font.ttf"));
  fs.writeFileSync(
    path.join(temp, "credit.txt"),
    wrap(
      `${clip.label}\n${clip.author} | ${clip.license}\n${clip.source}`,
      Math.floor((paneWidth * 2 - 24) / 6.5),
    ),
  );
  const width = paneWidth * 2 + 4;
  const footer = 120,
    header = 40;
  const filter =
    `pad=iw:ih+${header + footer}:0:${header}:color=0x171717,` +
    `drawtext=fontfile=${temp}/font.ttf:text=Main:fontcolor=white:fontsize=18:x=12:y=10,` +
    `drawtext=fontfile=${temp}/font.ttf:text='This round':fontcolor=white:fontsize=18:x=${paneWidth + 16}:y=10,` +
    `drawtext=fontfile=${temp}/font.ttf:textfile=${temp}/credit.txt:expansion=none:fontcolor=white:fontsize=12:line_spacing=3:x=12:y=h-${footer - 10}`;
  const args = [
    "-nostdin",
    "-v",
    "error",
    "-n",
    "-threads",
    "1",
    "-f",
    "rawvideo",
    "-pixel_format",
    "rgba",
    "-video_size",
    `${width}x${paneHeight}`,
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
    "veryfast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-threads",
    "1",
    "-movflags",
    "+faststart",
    "-metadata",
    `title=${clip.label} — Main / This round`,
    "-metadata",
    `comment=${attribution(clip, profile)}`,
    file,
  ];
  const child = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
  let errorText = "",
    ended = false;
  child.stderr.on("data", (chunk) => {
    errorText = (errorText + chunk).slice(-10000);
  });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      ended = true;
      code === 0 ? resolve() : reject(new Error(`Review encoding failed (${code}): ${errorText}`));
    });
  }).finally(() => fs.rmSync(temp, { recursive: true, force: true }));
  done.catch(() => {});
  child.stdin.on("error", () => {}); // The write callback and done promise carry encoder failures.
  return {
    args,
    width,
    height: paneHeight + header + footer,
    async frame(data) {
      if (ended) {
        await done;
        throw new Error("Review encoder already ended.");
      }
      if (data.length !== width * paneHeight * 4) throw new Error("Wrong review frame byte count.");
      await new Promise((resolve, reject) =>
        child.stdin.write(data, (error) => (error ? reject(error) : resolve())),
      );
    },
    async finish() {
      child.stdin.end();
      await done;
    },
    async abort() {
      child.stdin.destroy();
      child.kill("SIGKILL");
      await done.catch(() => {});
    },
  };
}

function smallPoster(video, file) {
  for (const quality of [3, 6, 10, 16, 24, 31]) {
    execFileSync(
      "ffmpeg",
      [
        "-nostdin",
        "-v",
        "error",
        "-y",
        "-threads",
        "1",
        "-i",
        video,
        "-frames:v",
        "1",
        "-q:v",
        String(quality),
        "-threads",
        "1",
        file,
      ],
      { timeout: 30000 },
    );
    if (fs.statSync(file).size <= 1000000) return;
  }
  throw new Error("Review poster exceeds the 1 MB image limit.");
}

async function captureAt(page, time, width, height) {
  // Two contexts remain open for paired views. Keep the requested page foregrounded so
  // waiting for settled rendered frames does not inherit hidden-page rAF throttling.
  await page.bringToFront();
  const data = await page.evaluate(
    async ({ time, width, height }) => {
      const { player } = window.__splashery;
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      player.stage.setFixedSize([width, height]);
      const kit = player.proc.ctx.kit;
      kit.data.walk.resumeAt(kit.data.flight.path.at(time));
      for (let i = 0; i < 8; i++) await player.stage.captureFrame();
      return (await player.stage.captureFrame()).toDataURL("image/png");
    },
    { time, width, height },
  );
  return Buffer.from(data.split(",")[1], "base64");
}

async function replayPage(browser, version, clip, profile) {
  const phone = profile === "phone";
  const context = await browser.newContext({
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: phone,
    hasTouch: phone,
    ...(phone
      ? {
          userAgent:
            "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
        }
      : {}),
  });
  const page = await context.newPage(),
    errors = [];
  let packUrl;
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/\/src\/packs\/video3d\.js(?:\?.*)?$/, async (route) => {
    packUrl = route.request().url();
    const response = await route.fetch();
    if (!response.ok()) throw new Error("Cannot observe the production Video to 3D loader.");
    await route.fulfill({ response, body: (await response.text()) + REPLAY_SCENE_OBSERVER });
  });
  await page.route("**/src/video3d/samples.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export const SAMPLES = ${JSON.stringify([{ ...clip, id: "review-capture", baked: false }])};`,
    }),
  );
  await page.route("**/assets/toys/video-3d/review-capture.ply", (r) =>
    r.fulfill({
      path: path.join(version.folder, "model.ply"),
      contentType: "application/octet-stream",
    }),
  );
  await page.route("**/assets/toys/video-3d/review-capture.json", (r) =>
    r.fulfill({
      json: {
        ...version.model,
        bake: { clarity: { opaque: version.preservePhotometric } },
      },
    }),
  );
  await page.goto(`${version.url}?labs=1&renderer=webgl2&profile=${phone ? "low" : "high"}`);
  await page.waitForFunction(() => window.__splashery?.ready, null, { timeout: 120000 });
  await page.evaluate(async () => {
    const { app, player } = window.__splashery;
    await app.chooseToy("video-3d");
    await app.setToyOptions({ source: "review-capture", navigation: "walk" });
    player.opts.idleDelay = 1e9;
    player.idle.weight = 0;
  });
  await page.waitForFunction(() => !!window.__splashery.player.proc?.ctx?.kit?.data?.walk, null, {
    timeout: 120000,
  });
  if (!packUrl) throw new Error("The production scene observer was not installed.");
  const actual = await page.evaluate(
    async (url) => (await import(url)).__v3dReviewScene(),
    packUrl,
  );
  assertReplayScene(actual, version.preservePhotometric);
  const verification = [];
  for (const [index, frame] of version.row.frames.entries()) {
    const bytes = await captureAt(
      page,
      frame.time,
      version.evaluation.width,
      version.evaluation.height,
    );
    verification.push({
      index,
      time: frame.time,
      ...assertReplayPixels(
        bytes,
        fs.readFileSync(path.join(version.folder, `render-${index}.png`)),
        frame.renderSha256,
      ),
    });
  }
  if (errors.length) throw new Error(`Replay page errors: ${errors.join("; ")}`);
  return { page, context, errors, verification, scene: actual };
}

const artifactHashes = (folder, names) =>
  names.map((file) => ({ file, sha256: hash(fs.readFileSync(path.join(folder, file))) }));
const verifyReviewFiles = (folder, receipt) => {
  for (const item of receipt.files || [])
    if (
      path.basename(item.file) !== item.file ||
      hash(fs.readFileSync(path.join(folder, item.file))) !== item.sha256
    )
      throw new Error("Existing review artifact changed; keep it and use a fresh output.");
};
function archiveCase(output, name) {
  const target = path.join(
    output,
    "attempts",
    new Date().toISOString().replaceAll(":", "-") + `-${process.pid}`,
  );
  fs.mkdirSync(target, { recursive: true });
  fs.renameSync(path.join(output, name), path.join(target, name));
}

function htmlIndex(output, report) {
  const items = report.cases
    .map((item) => {
      const clip = item.clip,
        folder = `${item.id}-${report.profile}`;
      const media =
        item.status === "captured"
          ? `<video controls loop muted playsinline preload="metadata" poster="${folder}/poster.jpg" src="${folder}/comparison.mp4"></video>`
          : (item.failures || [])
              .map(
                (f) =>
                  `<figure><figcaption>${escapeHtml(f.version)}: ${escapeHtml(f.status)}</figcaption>${f.file ? `<img src="${folder}/${f.file}" alt="Actual saved ${escapeHtml(f.version)} outcome">` : "<p>No saved screenshot is available.</p>"}<pre>${escapeHtml(f.reason || "")}</pre></figure>`,
              )
              .join("");
      return `<article><h2>${escapeHtml(clip.label)}</h2><p>${escapeHtml(item.group || "unranked")} · ${escapeHtml(item.status)}</p>${media}${item.reason ? `<pre>${escapeHtml(item.reason)}</pre>` : ""}<p>${escapeHtml(clip.author)} · <a href="${escapeHtml(clip.licenseUrl)}">${escapeHtml(clip.license)}</a> · <a href="${escapeHtml(clip.source)}">Source</a></p><p>${escapeHtml(clip.transformation)}</p><p><a href="${folder}/attribution.txt">Full attribution</a></p></article>`;
    })
    .join("\n");
  fs.writeFileSync(
    path.join(output, "index.html"),
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Video to 3D comparison</title><style>body{background:#171717;color:#eee;font:16px system-ui;max-width:820px;margin:24px auto;padding:0 16px}video{width:100%;max-width:784px}img{max-width:390px;width:100%}a{color:#9bd0ff}pre{white-space:pre-wrap}article{margin:40px 0}figure{display:inline-block;margin:8px;vertical-align:top;max-width:390px}</style><h1>Video to 3D comparison</h1><p>${escapeHtml(report.protocol)}</p><p>${escapeHtml(report.selection.rankBasis)}</p>${report.selection.limitations.map((s) => `<p>${escapeHtml(s)}</p>`).join("")}<p>${report.capturedClips} captured comparison clips; ${report.selection.pairedSuccesses} paired successes; ${report.selection.expectedClips} source clips expected at ${escapeHtml(report.profile)} profile.</p>${items}\n`,
  );
}

function saveFailures(folder, clip, profile, versions) {
  const failures = [];
  for (const v of versions) {
    if (!v.row || v.row.status === "finished") continue;
    const original = path.join(v.folder, "outcome.png");
    let file = null,
      sourceSha256 = null;
    if (fs.existsSync(original)) {
      const bytes = fs.readFileSync(original);
      PNG.sync.read(bytes); // Retain real saved raster evidence, not a missing/corrupt substitute.
      sourceSha256 = hash(bytes);
      file = `failure-${v.name}.${bytes.length <= 1000000 ? "png" : "jpg"}`;
      if (bytes.length <= 1000000) fs.writeFileSync(path.join(folder, file), bytes);
      else {
        execFileSync(
          "ffmpeg",
          [
            "-nostdin",
            "-v",
            "error",
            "-y",
            "-threads",
            "1",
            "-i",
            original,
            "-vf",
            "scale='min(390,iw)':-2",
            "-frames:v",
            "1",
            "-q:v",
            "5",
            "-threads",
            "1",
            path.join(folder, file),
          ],
          { timeout: 30000 },
        );
        if (fs.statSync(path.join(folder, file)).size > 1000000)
          throw new Error("Failure image exceeds 1 MB.");
      }
    }
    failures.push({
      version: v.name === "main" ? "Main" : "This round",
      status: v.row.status,
      reason: v.row.reason,
      explanation: v.row.explanation,
      file,
      sourceSha256,
      transformation: file?.endsWith(".jpg")
        ? "Full saved screenshot scaled to at most 390 pixels wide and JPEG compressed; no crop or content replacement."
        : "Exact saved screenshot bytes, when available.",
    });
  }
  fs.writeFileSync(path.join(folder, "attribution.txt"), attribution(clip, profile));
  return {
    failures,
    files: artifactHashes(folder, [
      "attribution.txt",
      ...failures.flatMap((f) => (f.file ? [f.file] : [])),
    ]),
  };
}

export async function main(argv = process.argv.slice(2)) {
  const [mode, ...args] = argv,
    positional = args.filter((a) => !a.startsWith("--"));
  if (!["plan", "render", "failures"].includes(mode) || positional.length !== 4)
    throw new Error(
      "Usage: v3d-review.mjs plan|render|failures <manifest> <main-output> <candidate-output> <review-output> [options]",
    );
  const option = (name, fallback) =>
    args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const [manifestFile, mainDir, candidateDir, outputArg] = positional;
  const manifestBytes = fs.readFileSync(manifestFile),
    manifest = JSON.parse(manifestBytes),
    clips = Array.isArray(manifest) ? manifest : manifest.clips;
  const mainRun = read(path.join(mainDir, "run.json")),
    candidateRun = read(path.join(candidateDir, "run.json"));
  if (
    mainRun.manifestSha256 !== hash(manifestBytes) ||
    candidateRun.manifestSha256 !== hash(manifestBytes) ||
    mainRun.provenance?.manifestSha256 !== hash(manifestBytes) ||
    candidateRun.provenance?.manifestSha256 !== hash(manifestBytes)
  )
    throw new Error("Use the exact manifest recorded by both benchmark runs.");
  const profile = option("profile", "phone"),
    ids = option("ids", "").split(",").filter(Boolean);
  if (ids.some((id) => !clips.some((c) => c.id === id))) throw new Error("Unknown selected IDs.");
  const selection = reviewSelection(clips, mainRun, candidateRun, {
    profile,
    ids: mode === "failures" ? [] : ids,
  });
  const [paneWidth, paneHeight] = option("size", "390x844").split("x").map(Number);
  const fps = Number(option("fps", "12")),
    seconds = Number(option("seconds", "6")),
    timeout = Number(option("timeout", "600000"));
  if (
    ![paneWidth, paneHeight, fps].every(Number.isInteger) ||
    paneWidth < 160 ||
    paneHeight < 160 ||
    paneWidth > 390 ||
    paneHeight > 844 ||
    paneWidth % 2 ||
    paneHeight % 2 ||
    fps < 1 ||
    fps > 30 ||
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    seconds > 20 ||
    !Number.isFinite(timeout) ||
    timeout < 1000
  )
    throw new Error("Invalid phone-size review dimensions, frame rate, duration, or timeout.");
  const output = path.resolve(outputArg),
    realRepo = fs.realpathSync(repo);
  if (output === realRepo || output.startsWith(realRepo + path.sep))
    throw new Error("Review media must stay outside the repository.");
  if (
    [mainDir, candidateDir].some(
      (d) => output === path.resolve(d) || output.startsWith(path.resolve(d) + path.sep),
    )
  )
    throw new Error("Keep review media separate from benchmark output directories.");
  fs.mkdirSync(output, { recursive: true });
  if (
    fs.realpathSync(output) === realRepo ||
    fs.realpathSync(output).startsWith(realRepo + path.sep)
  )
    throw new Error("Review media must stay outside the repository.");
  const versions = [
    {
      name: "main",
      directory: path.resolve(mainDir),
      run: mainRun,
      url: option("main-url", mainRun.url),
      preservePhotometric: false,
    },
    {
      name: "this-round",
      directory: path.resolve(candidateDir),
      run: candidateRun,
      url: option("candidate-url", candidateRun.url),
      preservePhotometric: true,
    },
  ];
  const provenance = {
    toolSha256: hash(fs.readFileSync(import.meta.filename)),
    sceneObserverSha256: hash(REPLAY_SCENE_OBSERVER),
    profile,
    paneWidth,
    paneHeight,
    fps,
    seconds,
    manifestSha256: hash(manifestBytes),
    versions: versions.map((v) => ({
      name: v.name,
      provenanceSha256: v.run.provenanceSha256,
      directory: v.directory,
      url: v.url,
      preservePhotometric: v.preservePhotometric,
    })),
  };
  const reportFile = path.join(output, "review.json"),
    previous = fs.existsSync(reportFile) ? read(reportFile) : null;
  if (!previous && fs.readdirSync(output).length)
    throw new Error("Untracked review output exists; use a fresh directory.");
  if (previous && fingerprint(previous.provenance) !== fingerprint(provenance))
    throw new Error("Review provenance changed; preserve this output and use a fresh directory.");
  const report = {
    created: previous?.created || new Date().toISOString(),
    provenance,
    profile,
    selection,
    protocol:
      "Main / This round at matched recorded video times, using each model's own solved coordinate frame. Exact saved held-out render pixels must match before video capture. Production cleanup retained per version; no image alignment or camera fitting. These clips show replay, not measured device speed.",
    cases: previous?.cases || [],
  };
  const save = () => {
    report.capturedClips = report.cases.filter((c) => c.status === "captured").length;
    report.rankedMediaComplete =
      selection.ranked &&
      selection.selected.length === 10 &&
      selection.selected.every((s) =>
        report.cases.some((c) => c.id === s.id && c.status === "captured"),
      );
    write(reportFile, report);
    htmlIndex(output, report);
  };
  for (const item of report.cases) {
    if (!safeId(item.id) || !clips.some((c) => c.id === item.id))
      throw new Error("Unknown prior review case.");
    const before = mainRun.results.find((r) => r.id === item.id && r.profile === profile);
    const after = candidateRun.results.find((r) => r.id === item.id && r.profile === profile);
    if (fingerprint([before || null, after || null]) !== item.resultFingerprint)
      throw new Error("A previously captured result changed or disappeared.");
    verifyReviewFiles(path.join(output, `${item.id}-${profile}`), item);
  }
  save();
  if (mode === "plan") {
    console.log(JSON.stringify(selection, null, 2));
    return report;
  }
  if (mode === "render" && !selection.selected.length)
    throw new Error(
      "No review clips selected. Wait for the full corpus, or use --ids for available unranked paired successes.",
    );
  const selectedIds =
    mode === "render"
      ? selection.selected.map((c) => c.id)
      : clips
          .filter(
            (c) =>
              (!ids.length || ids.includes(c.id)) &&
              versions.some((v) =>
                v.run.results.some(
                  (r) => r.id === c.id && r.profile === profile && r.status !== "finished",
                ),
              ),
          )
          .map((c) => c.id);
  for (const id of selectedIds) {
    const clip = clips.find((c) => c.id === id),
      name = `${id}-${profile}`,
      folder = path.join(output, name);
    const rowVersions = versions.map((v) => ({
      ...v,
      folder: path.join(v.directory, name),
      row: v.run.results.find((r) => r.id === id && r.profile === profile),
    }));
    const resultFingerprint = fingerprint(rowVersions.map((v) => v.row || null));
    const old = report.cases.find((c) => c.id === id);
    if (old?.status === (mode === "render" ? "captured" : "failure-evidence")) continue;
    if (fs.existsSync(folder)) {
      if (!args.includes("--retry"))
        throw new Error(
          `Interrupted or different review evidence exists: ${name}. Use --retry to preserve it before retrying.`,
        );
      archiveCase(output, name);
    }
    fs.mkdirSync(folder);
    const receipt = {
      id,
      clip,
      resultFingerprint,
      group: selection.selected.find((c) => c.id === id)?.group || "unranked",
      status: "pending",
    };
    report.cases = report.cases.filter((c) => c.id !== id);
    report.cases.push(receipt);
    save();
    if (mode === "failures") {
      Object.assign(receipt, saveFailures(folder, clip, profile, rowVersions), {
        status: "failure-evidence",
      });
      write(path.join(folder, "receipt.json"), receipt);
      save();
      continue;
    }
    let browser,
      server,
      encoder,
      expired = false;
    const active = () => {
      if (expired) {
        server?.process()?.kill("SIGKILL");
        throw new Error("Review host deadline expired.");
      }
    };
    try {
      for (const v of rowVersions) {
        verifyArtifacts(v.directory, v.row);
        if (v.name !== "main")
          assertReferenceEvidence(mainDir, mainRun, v.row, mainRun.provenanceSha256);
        v.modelBytes = fs.readFileSync(path.join(v.folder, "model.json"));
        v.model = JSON.parse(v.modelBytes);
        if (fingerprint(v.model.stats) !== fingerprint(v.row.stats))
          throw new Error("Saved model metadata no longer matches the result.");
        v.evaluation = read(path.join(v.folder, "evaluation.json"));
        const source = await servedSourceFingerprint(
          v.url,
          v.run.provenance.servedSource.files.map((r) => r.file),
        );
        if (source.sha256 !== v.run.provenance.servedSource.sha256)
          throw new Error(`Served ${v.name} viewer source changed since the benchmark.`);
      }
      const environment = mainRun.provenance.environment;
      const executablePath = process.env.SPLASHERY_CHROMIUM || environment.executablePath;
      if (hash(fs.readFileSync(executablePath)) !== environment.executableSha256)
        throw new Error("Replay browser executable changed.");
      await withHostDeadline(
        async () => {
          server = await chromium.launchServer({ executablePath, args: environment.launchArgs });
          active();
          browser = await chromium.connect(server.wsEndpoint());
          active();
          if (browser.version() !== environment.browserVersion)
            throw new Error("Replay browser version changed.");
          const pages = [];
          for (const v of rowVersions) {
            pages.push(await replayPage(browser, v, clip, profile));
            active();
          }
          receipt.verification = pages.map((p, i) => ({
            version: rowVersions[i].name,
            scene: p.scene,
            frames: p.verification,
          }));
          write(path.join(folder, "verification.json"), receipt.verification);
          const timeline = matchedTimeline(rowVersions[0].model, rowVersions[1].model, {
            seconds,
            fps,
          });
          receipt.timeline = timeline;
          encoder = startReviewEncoder(path.join(folder, "comparison.mp4"), {
            paneWidth,
            paneHeight,
            fps,
            clip,
            profile,
          });
          receipt.frames = [];
          for (const time of timeline.times) {
            const bytes = [];
            for (const p of pages) bytes.push(await captureAt(p.page, time, paneWidth, paneHeight));
            active();
            const images = bytes.map((b) => PNG.sync.read(b));
            if (images.some((im) => im.width !== paneWidth || im.height !== paneHeight))
              throw new Error("Unexpected phone pane size.");
            await encoder.frame(pairedRgba(images[0], images[1]).data);
            receipt.frames.push({
              time,
              mainRgbaSha256: hash(images[0].data),
              candidateRgbaSha256: hash(images[1].data),
            });
          }
          await encoder.finish();
          active();
          encoder = null;
          if (pages.some((p) => p.errors.length))
            throw new Error("Uncaught errors during review capture.");
        },
        {
          timeoutMs: timeout,
          onTimeout: () => {
            expired = true;
            server?.process()?.kill("SIGKILL");
            encoder?.abort();
          },
          label: `${id} review capture`,
        },
      );
      for (const v of rowVersions) {
        verifyArtifacts(v.directory, v.row);
        if (hash(fs.readFileSync(path.join(v.folder, "model.json"))) !== hash(v.modelBytes))
          throw new Error("Model metadata changed during capture.");
        if (
          fingerprint(
            read(path.join(v.directory, "run.json")).results.find(
              (r) => r.id === id && r.profile === profile,
            ),
          ) !== fingerprint(v.row)
        )
          throw new Error("Benchmark row changed during capture.");
        if (
          (
            await servedSourceFingerprint(
              v.url,
              v.run.provenance.servedSource.files.map((r) => r.file),
            )
          ).sha256 !== v.run.provenance.servedSource.sha256
        )
          throw new Error("Served viewer changed during capture.");
      }
      smallPoster(path.join(folder, "comparison.mp4"), path.join(folder, "poster.jpg"));
      fs.writeFileSync(path.join(folder, "attribution.txt"), attribution(clip, profile));
      receipt.modelMetadataSha256 = rowVersions.map((v) => ({
        version: v.name,
        sha256: hash(v.modelBytes),
      }));
      receipt.files = artifactHashes(folder, [
        "comparison.mp4",
        "poster.jpg",
        "attribution.txt",
        "verification.json",
      ]);
      receipt.status = "captured";
    } catch (error) {
      receipt.status = "review-error";
      receipt.reason = String(error.stack || error);
      process.exitCode = 1;
    } finally {
      await encoder?.abort();
      await closeBrowserBounded(browser, server);
    }
    write(path.join(folder, "receipt.json"), receipt);
    save();
    console.log(`${id}: ${receipt.status}${receipt.reason ? ` — ${receipt.reason}` : ""}`);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main();
