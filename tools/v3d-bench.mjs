#!/usr/bin/env node
// MIT. Run the actual file-input flow, without tier overrides, fake GPU results, or cached bakes.
// run <manifest.json> <corpus-directory> <output-directory> [--url=http://127.0.0.1:4173/]
//   [--profiles=phone,desktop] [--ids=a,b] [--reference=<main-output>] [--timeout=1800000]
//   [--retry=all|harness-error|incomplete] (archives prior evidence before rerunning)
//   [--gpu=native|swiftshader] (native by default; software emulation must be explicit)
// compare <main-output> <candidate-output> <comparison.json>
// The static page must be served separately. Clips, models, and screenshots stay outside main.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { imageMetrics, interpolateCamera } from "./cdx-v3d-clarity-metrics.mjs";
import {
  compareRuns,
  benchmarkCohort,
  fingerprint,
  rowKey,
  resumeDecision,
  RETRY_MODES,
  accountedOutcome,
  selectHeldoutTimes,
} from "./v3d-bench-metrics.mjs";
import { checkSamples } from "./v3d-bench-samples.mjs";
import { sourceFrameReceipts, assertPixelDisjointness } from "./v3d-bench-pixels.mjs";

const repo = path.resolve(import.meta.dirname, "..");
const SESSION_NEEDLE = "return new Session(opts);";
const SESSION_REPLACEMENT =
  "const s = new Session(opts); globalThis.__v3dBenchObserve(s); return s;";
const FRAME_NEEDLE = "  return out;";
export const FRAME_REPLACEMENT = `  globalThis.__v3dBench.trainingFrames = await Promise.all(out.map(async (p) => ({
    time: p.time,
    width: p.width,
    height: p.height,
    requestedTime: Number.isFinite(p.requestedTime) ? p.requestedTime : p.time,
    presentedTime: Number.isFinite(p.presentedTime) ? p.presentedTime : null,
    timestampEvidence: Number.isFinite(p.presentedTime) ? "presented-media-time" : "requested-time-only",
    sha256: Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await p.blob.arrayBuffer())), (b) => b.toString(16).padStart(2, "0")).join(""),
  })));
  globalThis.__v3dBench.trainingTimes = out.map((p) => p.time);
  globalThis.__v3dBench.attemptedTimes = plan.windows.flatMap((w) => windowTimes(w, tries));
  globalThis.__v3dBench.timestampEvidence = out.length && out.every((p) => Number.isFinite(p.presentedTime)) ? "presented-media-time" : "requested-time-only";
  return out;`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export const BENCHMARK_PROTOCOL_FILES = [
  "v3d-bench.mjs",
  "v3d-bench-metrics.mjs",
  "v3d-bench-samples.mjs",
  "v3d-bench-pixels.mjs",
  "v3d-affinity.py",
  "cdx-v3d-clarity-metrics.mjs",
];

export function benchmarkProtocolFingerprint() {
  return fingerprint({
    version: 6,
    files: BENCHMARK_PROTOCOL_FILES.map((file) => ({
      file,
      sha256: sha256(fs.readFileSync(path.join(import.meta.dirname, file))),
    })),
    wrappers: {
      observer: sessionObserver.toString(),
      SESSION_NEEDLE,
      SESSION_REPLACEMENT,
      FRAME_NEEDLE,
      FRAME_REPLACEMENT,
    },
  });
}

export function benchmarkLaunchArgs(gpu = "native") {
  const common = ["--ignore-gpu-blocklist", "--enable-webgl", "--enable-unsafe-webgpu"];
  if (gpu === "native") return common;
  if (gpu !== "swiftshader") throw new Error("Use --gpu=native or --gpu=swiftshader.");
  return [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    ...common,
    "--enable-features=Vulkan,WebGPU",
    "--use-webgpu-adapter=swiftshader",
    "--use-vulkan=swiftshader",
  ];
}

function sourceFiles() {
  const files = ["index.html", "vendor/playcanvas/playcanvas.min.mjs"];
  const visit = (directory) => {
    for (const e of fs.readdirSync(path.join(repo, directory), { withFileTypes: true })) {
      const rel = `${directory}/${e.name}`;
      if (e.isDirectory()) visit(rel);
      else if (/\.(?:m?js|css|glsl|wgsl|wasm)$/.test(rel)) files.push(rel);
    }
  };
  visit("src");
  visit("vendor/splatjs/src");
  files.push(...fs.readdirSync(repo).filter((f) => f.endsWith(".css")));
  return [...new Set(files)].sort();
}

// Hash actual served bytes, not this checkout's files. New candidate modules can legitimately
// be absent from frozen main; retain an explicit 404 receipt in that source snapshot.
export async function servedSourceFingerprint(base, files = sourceFiles()) {
  const entries = new Array(files.length);
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const i = next++,
        file = files[i];
      const response = await fetch(new URL(file, base), {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      if (response.status === 404) entries[i] = { file, status: 404, sha256: null };
      else {
        if (!response.ok)
          throw new Error(`Cannot fingerprint served source ${file}: HTTP ${response.status}.`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (/\.m?js$/.test(file) && /^\s*<(?:!doctype|html)/i.test(bytes.toString("utf8", 0, 100)))
          throw new Error(`HTML fallback instead of served source: ${file}.`);
        entries[i] = { file, status: response.status, sha256: sha256(bytes) };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, files.length) }, worker));
  return { sha256: fingerprint(entries), files: entries };
}

function archiveEvidence(output, names) {
  if (!names.length) return;
  const folder = path.join(
    output,
    "attempts",
    new Date().toISOString().replaceAll(":", "-") + `-${process.pid}`,
  );
  fs.mkdirSync(folder, { recursive: true });
  for (const name of names)
    if (fs.existsSync(path.join(output, name)))
      fs.renameSync(path.join(output, name), path.join(folder, name));
  console.log(`Preserved prior evidence in ${folder}`);
}

export function verifyArtifacts(output, row) {
  if (row.status !== "finished") return;
  const folder = path.join(output, `${row.id}-${row.profile}`);
  if (
    !row.modelSha256 ||
    sha256(fs.readFileSync(path.join(folder, "model.ply"))) !== row.modelSha256 ||
    !row.frames?.length
  )
    throw new Error(`Missing or changed finished artifact: ${rowKey(row)}.`);
  const evaluationBytes = fs.readFileSync(path.join(folder, "evaluation.json"));
  const evaluation = JSON.parse(evaluationBytes);
  if (
    !row.evaluationSha256 ||
    sha256(evaluationBytes) !== row.evaluationSha256 ||
    evaluation.sha256 !== row.sha256 ||
    fingerprint(evaluation.times) !== fingerprint(row.frames.map((f) => f.time))
  )
    throw new Error(`Changed evaluation inventory: ${rowKey(row)}.`);
  for (const [i, f] of row.frames.entries())
    for (const kind of ["render", "reference"])
      if (sha256(fs.readFileSync(path.join(folder, `${kind}-${i}.png`))) !== f[`${kind}Sha256`])
        throw new Error(`Changed ${kind} artifact: ${rowKey(row)}.`);
  return { evaluationSha256: sha256(evaluationBytes) };
}

// Bind each candidate attempt to one immutable baseline result and its actual evidence. A new
// baseline row may be appended without changing the identity of an already measured case.
export function referenceEvidence(directory, run, id, profile, expectedProvenance) {
  if (
    !run?.provenance ||
    fingerprint(run.provenance) !== run.provenanceSha256 ||
    (expectedProvenance && run.provenanceSha256 !== expectedProvenance)
  )
    throw new Error("Reference provenance changed or is absent.");
  const seen = new Set();
  for (const r of run.results || []) {
    const key = rowKey(r);
    if (seen.has(key)) throw new Error(`Duplicate reference result: ${key}.`);
    seen.add(key);
    if (r.provenanceSha256 !== run.provenanceSha256)
      throw new Error(`Changed reference row provenance: ${key}.`);
  }
  const row = run.results?.find((r) => r.id === id && r.profile === profile);
  if (!row || !accountedOutcome(row))
    throw new Error(`Missing or incomplete reference result: ${id}/${profile}.`);
  return {
    provenanceSha256: run.provenanceSha256,
    resultFingerprint: fingerprint(row),
    ...(verifyArtifacts(directory, row) || {}),
  };
}

export function assertReferenceEvidence(directory, run, row, expectedProvenance) {
  const actual = referenceEvidence(directory, run, row.id, row.profile, expectedProvenance);
  if (!row.referenceEvidence || fingerprint(actual) !== fingerprint(row.referenceEvidence))
    throw new Error(`Changed or removed reference evidence: ${rowKey(row)}.`);
  return actual;
}

// This host timer also bounds protocol calls that never return from a busy renderer.
export async function withHostDeadline(
  work,
  { timeoutMs, onTimeout = () => {}, label = "Attempt" },
) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(`${label} exceeded its host deadline of ${timeoutMs} ms.`);
          error.code = "V3D_HOST_TIMEOUT";
          reject(error);
          try {
            Promise.resolve(onTimeout()).catch(() => {});
          } catch {
            // The deadline still rejects if emergency teardown itself fails.
          }
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function closeBrowserBounded(browser, server, timeoutMs = 1000) {
  const bounded = (work) => withHostDeadline(work, { timeoutMs }).catch(() => {});
  await bounded(() => browser?.close());
  await bounded(() => server?.close());
  const child = server?.process();
  if (child && child.exitCode == null && child.signalCode == null) child.kill("SIGKILL");
}

export function sessionObserver() {
  window.__v3dBench = { firstViewAt: null, session: null };
  window.__v3dBenchObserve = (s) => {
    window.__v3dBench.session = s;
    const render = s.view.renderNow.bind(s.view);
    s.view.renderNow = () => {
      const result = render();
      if (s.view.ctx && s.view.camera && window.__v3dBench.firstViewAt == null)
        s.trainer.device.queue.onSubmittedWorkDone().then(() => {
          window.__v3dBench.firstViewAt ??= performance.now();
        });
      return result;
    };
    const dispose = s.dispose.bind(s);
    s.dispose = () => {
      window.__v3dBench.metadata = {
        holdout: s.holdout,
        options: { maxIters: s.opts.maxIters, refineStart: s.opts.refineStart ?? 1500 },
        cameras: s.trainer?.camMeta?.map((c) => ({ ...c, R: Array.from(c.R), t: Array.from(c.t) })),
      };
      return dispose();
    };
  };
}

export async function main(cli = process.argv.slice(2)) {
  const [mode, ...argv] = cli;
  const args = argv.filter((a) => a.startsWith("--"));
  const [manifestArg, corpusArg, outputArg] = argv.filter((a) => !a.startsWith("--"));
  const option = (name, fallback) =>
    args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const read = (file) => JSON.parse(fs.readFileSync(file));
  const write = (file, data) => {
    fs.writeFileSync(file + ".tmp", JSON.stringify(data, null, 2) + "\n");
    fs.renameSync(file + ".tmp", file);
  };
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  if (mode === "samples") {
    await checkSamples(manifestArg, {
      url: option("url", "http://127.0.0.1:4173/"),
      reference: option("reference", null),
    });
    return;
  }
  if (mode === "compare") {
    const mainRun = read(path.join(manifestArg, "run.json"));
    const candidateRun = read(path.join(corpusArg, "run.json"));
    for (const row of mainRun.results) verifyArtifacts(manifestArg, row);
    for (const row of candidateRun.results) {
      verifyArtifacts(corpusArg, row);
      assertReferenceEvidence(manifestArg, mainRun, row, mainRun.provenanceSha256);
    }
    write(outputArg, compareRuns(mainRun, candidateRun));
    return;
  }
  if (mode !== "run" || !outputArg)
    throw new Error("Usage: v3d-bench.mjs run <manifest> <corpus> <output> [options]");
  const manifestBytes = fs.readFileSync(manifestArg);
  const manifest = JSON.parse(manifestBytes);
  const clips = Array.isArray(manifest) ? manifest : manifest.clips;
  const ids = option("ids", "").split(",").filter(Boolean);
  const selected = clips.filter((c) => !ids.length || ids.includes(c.id));
  const output = path.resolve(outputArg);
  if (output === repo || output.startsWith(repo + path.sep))
    throw new Error("Keep benchmark media outside the product branch.");
  fs.mkdirSync(output, { recursive: true });
  const previous = fs.existsSync(path.join(output, "run.json"))
    ? read(path.join(output, "run.json"))
    : null;
  const profiles = option("profiles", "phone,desktop").split(",");
  if (profiles.some((p) => !["phone", "desktop"].includes(p))) throw new Error("Unknown profile.");
  const url = option("url", "http://127.0.0.1:4173/");
  const reference = option("reference", null);
  const timeout = Number(option("timeout", "1800000"));
  const retry = option("retry", "none");
  if (!RETRY_MODES.includes(retry))
    throw new Error("Use --retry=all, --retry=harness-error, or --retry=incomplete.");
  const gpuMode = option("gpu", "native");
  const launchArgs = benchmarkLaunchArgs(gpuMode);

  if (
    !Number.isFinite(timeout) ||
    timeout <= 0 ||
    !selected.length ||
    ids.some((id) => !clips.some((c) => c.id === id))
  )
    throw new Error("Invalid timeout or selected input IDs.");
  benchmarkCohort(selected, profiles);
  const cohort = benchmarkCohort(clips); // Always declare the full corpus and BOTH required profiles.
  const inputs = new Map();
  for (const clip of clips) {
    const file = path.resolve(corpusArg, clip.file),
      actual = hash(fs.readFileSync(file));
    if (clip.sha256 !== actual) throw new Error(`Input checksum mismatch: ${clip.id}`);
    inputs.set(clip.id, { file, sha256: actual });
  }
  const executablePath = process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium";
  const version = execFileSync(executablePath, ["--version"], {
    encoding: "utf8",
    timeout: 30000,
  }).trim();
  const browserVersion = version.match(/\d+\.\d+\.\d+\.\d+/)?.[0];
  if (!browserVersion)
    throw new Error("Cannot establish the Chromium version without launching a GPU workload.");
  const priorFiles =
    retry !== "all" ? previous?.provenance?.servedSource?.files?.map((f) => f.file) : undefined;
  const served = await servedSourceFingerprint(url, priorFiles);
  const servedFiles = served.files.map((f) => f.file);
  const protocolSha256 = benchmarkProtocolFingerprint();
  const referenceRun = reference ? read(path.join(reference, "run.json")) : null;
  if (
    referenceRun &&
    (!referenceRun.provenance ||
      fingerprint(referenceRun.provenance) !== referenceRun.provenanceSha256 ||
      fingerprint(referenceRun.cohort) !== fingerprint(cohort) ||
      referenceRun.provenance.protocolSha256 !== protocolSha256)
  )
    throw new Error(
      "Reference has no matching valid provenance. Keep legacy probes, and create an authoritative main run.",
    );
  const referenceIdentity = referenceRun
    ? {
        path: path.resolve(reference),
        provenanceSha256: referenceRun.provenanceSha256,
      }
    : null;
  const provenance = {
    protocolSha256,
    reference: referenceIdentity,
    servedSource: served,
    url,
    environment: {
      platform: process.platform,
      architecture: process.arch,
      cpuModel: os.cpus()[0]?.model || "unknown",
      cpuQuota: fs.existsSync("/sys/fs/cgroup/cpu.max")
        ? fs.readFileSync("/sys/fs/cgroup/cpu.max", "utf8").trim()
        : null,
      browserVersion,
      executablePath: fs.realpathSync(executablePath),
      executableSha256: hash(fs.readFileSync(executablePath)),
      launchArgs,
      node: process.version,
      ffmpeg: execFileSync("ffmpeg", ["-version"], { encoding: "utf8", timeout: 30000 }).split(
        "\n",
      )[0],
      ffprobe: execFileSync("ffprobe", ["-version"], { encoding: "utf8", timeout: 30000 }).split(
        "\n",
      )[0],
    },
    options: {
      gpuMode,
      timeout,
      rate: "3",
      setting: "auto",
      span: "Smallest native 5/10/20-second setting that covers the full clip",
      scoringSide: 640,
      profiles: {
        phone: { width: 390, height: 844, deviceScaleFactor: 1, profile: "low", mobile: true },
        desktop: { width: 1440, height: 900, deviceScaleFactor: 1, profile: "high", mobile: false },
      },
    },
    manifestSha256: hash(manifestBytes),
    inputs: clips.map(({ id, sha256, duration, file }) => ({ id, sha256, duration, file })),
  };
  const provenanceSha256 = fingerprint(provenance);
  const decision = resumeDecision(previous, provenance, cohort, retry);
  const leftovers = fs.readdirSync(output).filter((f) => f !== "attempts");
  if (decision.archiveAll || (!previous && leftovers.length && retry === "all"))
    archiveEvidence(output, leftovers);
  else if (!previous && leftovers.length)
    throw new Error(
      "Output contains untracked evidence. Use --retry=all to archive it, or use a fresh output.",
    );
  else if (decision.retryKeys.length)
    archiveEvidence(output, [
      "run.json",
      ...decision.retryKeys.map((key) => key.replace("/", "-")),
    ]);
  const results = decision.results;
  for (const row of results) {
    verifyArtifacts(output, row);
    if (reference)
      assertReferenceEvidence(reference, referenceRun, row, referenceIdentity.provenanceSha256);
  }
  const save = () =>
    write(path.join(output, "run.json"), {
      created: (!decision.archiveAll && previous?.created) || new Date().toISOString(),
      url,
      manifestSha256: hash(manifestBytes),
      cohort,
      provenance,
      provenanceSha256,
      reference: referenceIdentity,
      selection: { ids: selected.map((c) => c.id), profiles },
      renderer: `Production toy, PlayCanvas WebGL2, ${gpuMode} WebGPU launch; emulated phone and desktop; native tier settings. Memory is aggregate sampled browser RSS, not GPU RAM. Timing is emulator timing, not physical-phone performance.`,
      results,
    });
  save();
  console.log(
    `Source fingerprint ${served.sha256}; protocol ${protocolSha256}; ${cohort.inputs.length} clips × both profiles declared.`,
  );

  // Aggregate resident memory of the browser process tree sampled once a second. Shared pages may
  // be counted more than once. This is an RSS estimate, not a physical GPU-memory measurement.
  function rssTree(pid) {
    const processes = [];
    for (const id of fs.readdirSync("/proc").filter((p) => /^\d+$/.test(p))) {
      try {
        const status = fs.readFileSync(`/proc/${id}/status`, "utf8");
        processes.push({
          id: Number(id),
          parent: Number(status.match(/^PPid:\s+(\d+)/m)?.[1]),
          rss: Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] || 0) * 1024,
        });
      } catch {
        /* A process can exit between samples. */
      }
    }
    const descendants = new Set([pid]);
    let count;
    do {
      count = descendants.size;
      for (const p of processes) if (descendants.has(p.parent)) descendants.add(p.id);
    } while (count !== descendants.size);
    return processes.filter((p) => descendants.has(p.id)).reduce((sum, p) => sum + p.rss, 0);
  }

  for (const profile of profiles)
    for (const clip of selected) {
      if (results.some((r) => r.id === clip.id && r.profile === profile)) continue;
      const { file, sha256 } = inputs.get(clip.id);
      if (hash(fs.readFileSync(file)) !== sha256)
        throw new Error(`Input bytes changed before opening ${clip.id}.`);
      if ((await servedSourceFingerprint(url, servedFiles)).sha256 !== served.sha256)
        throw new Error(
          "Served source changed during the run. Use a fresh output; existing evidence was preserved.",
        );
      const currentReference = reference ? read(path.join(reference, "run.json")) : null;
      const binding = reference
        ? referenceEvidence(
            reference,
            currentReference,
            clip.id,
            profile,
            referenceIdentity.provenanceSha256,
          )
        : null;
      if (currentReference && fingerprint(currentReference.cohort) !== fingerprint(cohort))
        throw new Error("Reference cohort changed.");
      const referenceRow = currentReference?.results.find(
        (r) => r.id === clip.id && r.profile === profile,
      );
      const folder = path.join(output, `${clip.id}-${profile}`);
      if (fs.existsSync(folder) && fs.readdirSync(folder).length) {
        if (retry === "none")
          throw new Error(
            `An interrupted attempt exists for ${clip.id}/${profile}; use --retry=incomplete to preserve and retry it.`,
          );
        archiveEvidence(output, [path.basename(folder)]);
      }
      fs.mkdirSync(folder, { recursive: true });
      const row = {
        id: clip.id,
        profile,
        sha256,
        started: new Date().toISOString(),
        status: "failed",
        provenanceSha256,
        ...(binding ? { referenceEvidence: binding } : {}),
        firstViewMs: null,
        bakeMs: null,
        mean: null,
        peakRssBytes: 0,
        hostLoadAtStart: os.loadavg(),
        consoleErrors: [],
      };
      let server,
        browser,
        memory,
        expired = false;
      row.phase = "setup";
      const ensureActive = () => {
        if (expired) {
          const child = server?.process();
          if (child && child.exitCode == null && child.signalCode == null) child.kill("SIGKILL");
          const error = new Error("Attempt host deadline expired.");
          error.code = "V3D_HOST_TIMEOUT";
          throw error;
        }
      };
      try {
        await withHostDeadline(
          async () => {
            server = await chromium.launchServer({
              executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
              args: launchArgs,
            });
            ensureActive();
            browser = await chromium.connect(server.wsEndpoint());
            ensureActive();
            row.browser = browser.version();
            if (row.browser !== browserVersion)
              throw new Error("Browser version changed after provenance was captured.");
            memory = setInterval(() => {
              row.peakRssBytes = Math.max(row.peakRssBytes, rssTree(server.process().pid));
            }, 1000);
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
            const page = await context.newPage();
            page.on("pageerror", (e) => row.consoleErrors.push(e.message));
            // Observe the real session. No optimizer setting, input, camera, or random number changes.
            // The wrapper records first submitted 3D preview and cameras before dispose releases them.
            await page.addInitScript(sessionObserver);
            await page.route("**/vendor/splatjs/src/session.js", async (route) => {
              const response = await route.fetch();
              const body = await response.text();
              if (!body.includes(SESSION_NEEDLE))
                throw new Error("Session observer needs review after upstream changed.");
              await route.fulfill({
                response,
                body: body.replace(SESSION_NEEDLE, SESSION_REPLACEMENT),
              });
            });
            await page.route("**/src/video3d/extract.js", async (route) => {
              const response = await route.fetch();
              const body = await response.text();
              if (!body.includes(FRAME_NEEDLE))
                throw new Error("Frame observer needs review after source changed.");
              await route.fulfill({
                response,
                body: body.replace(FRAME_NEEDLE, FRAME_REPLACEMENT),
              });
            });
            await page.goto(`${url}?labs=1&renderer=webgl2&profile=${phone ? "low" : "high"}`);
            await page.waitForFunction(() => window.__splashery?.ready, null, { timeout: 180000 });
            await page.evaluate(() => window.__splashery.app.chooseToy("video-3d"));
            await page.waitForFunction(
              () => window.__splashery.player.proc?.ctx?.kit?.data?.video,
              null,
              { timeout: 180000 },
            );
            await page.evaluate(
              (length) =>
                window.__splashery.app.setToyOptions({
                  start: 0,
                  length: String(length),
                  rate: "3",
                  setting: "auto",
                }),
              [5, 10, 20].find((n) => n + 1e-6 >= clip.duration) || 20,
            );
            // setInputFiles dispatches the real input change even when the Toy drawer is collapsed.
            await page.evaluate(() => {
              window.__v3dBench.openedAt = performance.now();
            });
            const started = performance.now();
            row.phase = "bake";
            await page.setInputFiles("#toy-input-file", file);
            let lastProgress = "";
            let outcome;
            while (performance.now() - started < timeout) {
              outcome = await page.evaluate(async () => {
                const m = await import("/src/packs/video3d.js");
                const start = document.getElementById("v3d-start");
                if (start && !start.disabled && !start.closest("[hidden]")) start.click();
                const r = m.video3dResult();
                const state = m.video3dState();
                const diagnostic = document.querySelector("#v3d-card .v3d-err"),
                  guide = document.querySelector("#v3d-card .v3d-guide");
                const visible = (e) => !!e && !e.closest("[hidden]") && !!e.getClientRects().length;
                const text =
                  diagnostic?.textContent ||
                  state.error ||
                  document.querySelector("#toy-input .warning:not([hidden])")?.textContent ||
                  "";
                const advice = visible(guide)
                  ? guide.textContent
                  : /\btry|\bpick|\bchoose|\bopen|\buse\b/i.test(text)
                    ? text
                    : "";
                return {
                  finished: !!r,
                  error: state.error || text,
                  assessment: state.suitability,
                  explanation: {
                    diagnostic: text,
                    advice,
                    visible:
                      visible(diagnostic) ||
                      visible(document.querySelector("#toy-input .warning:not([hidden])")),
                  },
                  progress: [
                    document.querySelector("#v3d-card li.on")?.textContent,
                    document.querySelector("#v3d-card .v3d-note")?.textContent,
                  ]
                    .filter(Boolean)
                    .join("; "),
                  firstViewMs:
                    window.__v3dBench.firstViewAt == null
                      ? null
                      : window.__v3dBench.firstViewAt - window.__v3dBench.openedAt,
                };
              });
              ensureActive();
              row.firstViewMs = outcome?.firstViewMs ?? row.firstViewMs;
              row.bakeMs = performance.now() - started;
              if (outcome.progress !== lastProgress) {
                lastProgress = outcome.progress;
                console.log(
                  `${clip.id} ${profile} ${Math.round((performance.now() - started) / 1000)}s ${lastProgress}`,
                );
              }
              if (outcome.finished || outcome.error) break;
              await page.waitForTimeout(1000);
            }
            row.bakeMs = performance.now() - started;
            row.firstViewMs = outcome?.firstViewMs ?? null;
            row.assessment = outcome?.assessment;
            row.explanation = outcome?.explanation;
            clearInterval(memory); // Scoring changes the viewport; it is outside the measured bake.
            row.peakRssBytes = Math.max(row.peakRssBytes, rssTree(server.process().pid));
            if (!outcome?.finished) {
              row.reason =
                outcome?.error ||
                `Benchmark exceeded ${timeout / 60000} minutes; the toy had not finished or explained a failure.`;
              row.status =
                outcome?.error &&
                row.explanation?.visible &&
                row.explanation.advice &&
                !/^(Stopped\.|Not started\.)$/.test(outcome.error)
                  ? "explained"
                  : outcome?.error
                    ? "unexplained"
                    : "timeout";
              await page
                .screenshot({ path: path.join(folder, "outcome.png"), timeout: 30000 })
                .catch(() => {});
            } else {
              row.status = "finished";
              row.phase = "evaluation";
              const model = await page.evaluate(async () => {
                const { video3dResult } = await import("/src/packs/video3d.js");
                const r = video3dResult();
                let bin = "";
                for (let i = 0; i < r.ply.length; i += 0x8000)
                  bin += String.fromCharCode(...r.ply.subarray(i, i + 0x8000));
                return {
                  ply: btoa(bin),
                  cams: r.cams,
                  stats: r.stats,
                  timings: r.timings,
                  log: r.log,
                  observed: {
                    ...window.__v3dBench.metadata,
                    trainingTimes: window.__v3dBench.trainingTimes,
                    attemptedTimes: window.__v3dBench.attemptedTimes,
                    trainingFrames: window.__v3dBench.trainingFrames,
                    timestampEvidence: window.__v3dBench.timestampEvidence,
                  },
                };
              });
              ensureActive();
              const ply = Buffer.from(model.ply, "base64");
              fs.writeFileSync(path.join(folder, "model.ply"), ply);
              delete model.ply;
              write(path.join(folder, "model.json"), model);
              row.modelSha256 = hash(ply);
              row.stats = model.stats;
              row.timings = model.timings;
              row.actualTier = model.stats?.tier;
              if (row.actualTier !== (phone ? "phone" : "high"))
                throw new Error(`Unexpected actual training tier: ${row.actualTier}.`);
              // Freeze one source frame per four-interval group, preserving the original count.
              // Exclude all planned seeks and actual photos, then independently verify the JPEGs.
              let times;
              const sourceMetadata = JSON.parse(
                execFileSync(
                  "ffprobe",
                  [
                    "-v",
                    "error",
                    "-select_streams",
                    "v:0",
                    "-show_entries",
                    "stream=width,height,r_frame_rate:frame=best_effort_timestamp_time",
                    "-of",
                    "json",
                    file,
                  ],
                  { timeout: 30000 },
                ),
              );
              const sourceProbe = sourceMetadata.streams[0];
              const sourceTimes = sourceMetadata.frames.map((f) =>
                Number(f.best_effort_timestamp_time),
              );
              if (!sourceTimes.length || sourceTimes.some((t) => !Number.isFinite(t)))
                throw new Error("Missing decoded source-frame timestamps.");
              const [fpsN, fpsD] = sourceProbe.r_frame_rate.split("/").map(Number),
                fps = fpsN / fpsD;
              const fixedFile =
                reference && path.join(reference, `${clip.id}-${profile}`, "evaluation.json");
              if (referenceRow?.status === "finished") {
                const fixed = read(fixedFile);
                if (fixed.sha256 !== sha256) throw new Error("The held-out source changed.");
                times = fixed.times;
                if (!fixed.width || !fixed.height || !fixed.crop)
                  throw new Error("Reference evaluation has no frozen image geometry.");
              } else {
                times = selectHeldoutTimes({
                  cameras: model.cams,
                  sourceTimes,
                  attemptedTimes: model.observed.attemptedTimes,
                  trainingTimes: model.observed.trainingTimes,
                  fps,
                });
              }
              const size = model.cams[0],
                fixed = referenceRow?.status === "finished" ? read(fixedFile) : null;
              const width = fixed?.width || Math.round((size.w * 640) / Math.max(size.w, size.h));
              const height = fixed?.height || Math.round((size.h * 640) / Math.max(size.w, size.h));
              const crop =
                fixed?.crop ||
                (await page.evaluate(
                  async ({ width, height }) =>
                    (await import("/src/video3d/frames.js")).panoSafeCrop(width, height),
                  sourceProbe,
                ));
              const pixelReceipts = await page.evaluate(sourceFrameReceipts, {
                base64: fs.readFileSync(file).toString("base64"),
                sourceTimes,
                times,
                trainingFrames: model.observed.trainingFrames,
                crop,
              });
              ensureActive();
              assertPixelDisjointness(model.observed.trainingFrames, pixelReceipts, times);
              row.heldoutEvidence = {
                trainingPresentationVerified:
                  model.observed.timestampEvidence === "presented-media-time",
                trainingJpegsIndependentlyMatched: true,
                referencePresentationVerified: true,
                pixelDisjointnessVerified: true,
                complete: true,
              };
              write(path.join(folder, "evaluation.json"), {
                sha256,
                times,
                side: 640,
                width,
                height,
                crop,
                trainingTimes: model.observed.trainingTimes,
                trainingFrames: model.observed.trainingFrames,
                timestampEvidence: model.observed.timestampEvidence,
                heldoutEvidence: row.heldoutEvidence,
                pixelReceipts,
                sourceFrameIndices: pixelReceipts.views.map((f) => f.index),
                fps,
                protocol:
                  "Exact source frames near frozen main midpoints, one per four-interval group with the original count retained. If a preferred interval is exhausted, use the nearest eligible time in its own group. All planned training seeks, actual training times, and camera timestamps are excluded. Selection uses timestamps only. Every training JPEG is independently matched with the identical extraction canvas and encoder; test JPEGs must be disjoint. FFmpeg selects those exact indices. Interpolated production flight poses; no image alignment, sharpening, or mask.",
              });
              row.evaluationSha256 = hash(fs.readFileSync(path.join(folder, "evaluation.json")));
              await page.evaluate(() =>
                window.__splashery.app.setToyOptions({ navigation: "walk" }),
              );
              await page.waitForFunction(
                () => !!window.__splashery.player.proc?.ctx?.kit?.data?.walk,
                null,
                { timeout: 120000 },
              );
              const frames = [];
              for (const [index, time] of times.entries()) {
                const a = model.cams.findLast((c) => c.time <= time);
                const b = model.cams.find((c) => c.time >= time);
                if (!a || !b || a === b)
                  throw new Error(`No candidate camera interval at held-out time ${time}.`);
                interpolateCamera(a, b, time); // Validate the interval before the production flight uses it.
                const data = await page.evaluate(
                  async ({ time, width, height }) => {
                    const { player } = window.__splashery;
                    player.opts.idleDelay = 1e9;
                    player.idle.weight = 0;
                    player.stage.setFixedSize([width, height]);
                    const k = player.proc.ctx.kit;
                    k.data.walk.resumeAt(k.data.flight.path.at(time));
                    for (let i = 0; i < 8; i++) await player.stage.captureFrame();
                    return (await player.stage.captureFrame()).toDataURL("image/png");
                  },
                  { time, width, height },
                );
                ensureActive();
                const render = Buffer.from(data.split(",")[1], "base64");
                const renderFile = path.join(folder, `render-${index}.png`);
                const refFile = path.join(folder, `reference-${index}.png`);
                fs.writeFileSync(renderFile, render);
                const source = sourceProbe;
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
                    file,
                    "-frames:v",
                    "1",
                    "-vf",
                    `select=eq(n\\,${pixelReceipts.views[index].index}),crop=${crop.sw}:${source.height}:${crop.sx}:0,scale=${width}:${height}:flags=bicubic`,
                    "-fps_mode",
                    "vfr",
                    "-threads",
                    "1",
                    refFile,
                  ],
                  { timeout: 30000 },
                );
                const refBytes = fs.readFileSync(refFile);
                if (
                  fixed &&
                  hash(refBytes) !==
                    hash(
                      fs.readFileSync(
                        path.join(reference, `${clip.id}-${profile}`, `reference-${index}.png`),
                      ),
                    )
                )
                  throw new Error("Held-out reference pixels changed.");
                frames.push({
                  time,
                  renderSha256: hash(render),
                  referenceSha256: hash(refBytes),
                  ...imageMetrics(PNG.sync.read(render), PNG.sync.read(refBytes)),
                });
              }
              ensureActive();
              row.frames = frames;
              row.mean = Object.fromEntries(
                ["psnr", "ssim", "laplacian", "sourceLaplacian"].map((key) => [
                  key,
                  frames.reduce((sum, f) => sum + f[key], 0) / frames.length,
                ]),
              );
              await page.screenshot({ path: path.join(folder, "outcome.png"), timeout: 30000 });
            }
            ensureActive();
          },
          {
            timeoutMs: timeout,
            onTimeout: () => {
              expired = true;
              const child = server?.process();
              if (child && child.exitCode == null && child.signalCode == null)
                child.kill("SIGKILL");
            },
            label: `${clip.id}/${profile} (${row.phase})`,
          },
        );
      } catch (error) {
        row.reason = String(error.stack || error);
        row.status =
          error.code === "V3D_HOST_TIMEOUT" && row.phase === "bake" ? "timeout" : "harness-error";
        if (error.code === "V3D_HOST_TIMEOUT") row.timingCensored = true;
      } finally {
        clearInterval(memory);
        await closeBrowserBounded(browser, server);
      }
      if (reference) {
        try {
          assertReferenceEvidence(
            reference,
            read(path.join(reference, "run.json")),
            row,
            referenceIdentity.provenanceSha256,
          );
        } catch (error) {
          row.status = "harness-error";
          row.reason = String(error.stack || error);
        }
      }
      if ((await servedSourceFingerprint(url, servedFiles)).sha256 !== served.sha256) {
        row.status = "harness-error";
        row.reason =
          "Served source changed during the measurement; this attempt is not comparable.";
      }
      if (row.consoleErrors.length) {
        row.status = "harness-error";
        row.reason = `Uncaught page errors: ${row.consoleErrors.join("; ")}`;
      }
      if (hash(fs.readFileSync(file)) !== sha256) {
        row.status = "harness-error";
        row.reason = "Input bytes changed during the measurement.";
      }
      results.push(row);
      write(path.join(folder, "result.json"), row);
      save();
      console.log(
        JSON.stringify({
          id: row.id,
          profile,
          status: row.status,
          seconds: row.bakeMs / 1000,
          mean: row.mean,
          reason: row.reason,
        }),
      );
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main();
