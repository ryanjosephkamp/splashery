// Real wall-clock presentation recordings, separate from clean speed tests.
// CDP's JPEG screencast adds capture overhead; it never advances the toy clock.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { GRAPHICS_LAUNCH } from "./cdx-mp2-render.mjs";
import {
  PHONE,
  option,
  snapshot,
  routeCode,
  selectCase,
  caseInputHashes,
  graphicsInfo,
} from "./cdx-mp2-r4-harness.mjs";
import { R4_CASES } from "./cdx-mp2-r4-cases.mjs";
import { SAMPLES, LONG_SAMPLES } from "../src/packs/moving-photo.js";

const baseline = option("baseline"),
  out = option("out", "work/r4-live"),
  label = option("label", baseline ? "Round 3" : "Round 4"),
  headless = option("headless") === "true",
  seconds = Number(option("seconds", "12")),
  { code, sourceHash } = await snapshot(baseline);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = {
  kind: option("kind", "isolated-live-recording"),
  label,
  baseline: baseline || null,
  sourceHash,
  revision: execFileSync("git", ["rev-parse", baseline || "HEAD"], { encoding: "utf8" }).trim(),
  recordedAt: new Date().toISOString(),
  phone: PHONE,
  cpuRate: 4,
  headless,
  workerThrottled: false,
  seconds,
  protocol:
    "Actual CDP screencast presentations at their original wall timestamps; fixed camera; no source-clock stepping or interpolated pictures",
  limitation:
    "Silent recording with JPEG capture overhead, hidden UI overlays, and a fixed camera. Clean cadence is measured separately with the natural camera and normal UI. Cropping removes only space outside the stage",
  contribution:
    "Made by Ryan with Codex (GPT-6); capture/export code is MIT; source film licenses remain attached",
  cases: [],
};
await fs.mkdir(out, { recursive: true });
const save = () =>
  fs.writeFile(path.join(out, "manifest.json"), JSON.stringify(report, null, 2) + "\n");
const browser = await chromium.launch({
  ...GRAPHICS_LAUNCH,
  ...(headless ? { headless: true } : {}),
});
try {
  report.browser = browser.version();
  for (const item of R4_CASES) {
    if (!option("ids", "sample,machine-long").split(",").includes(item.id)) continue;
    const context = await browser.newContext(PHONE),
      page = await context.newPage(),
      errors = [];
    page.setDefaultTimeout(600000);
    page.on("pageerror", (error) => errors.push(error.message));
    await routeCode(context, code);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    try {
      await page.goto(
        `${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}?renderer=webgl2&adapt=off&profile=low&labs=1`,
      );
      await page.waitForSelector("body[data-ready='true']");
      report.graphics ||= await graphicsInfo(page);
      await page.evaluate(async () => {
        window.__r4Moving = await import("/src/packs/moving-photo.js");
        const { ReliefMesh } = await import("/src/live/relief-mesh.js"),
          setColor = ReliefMesh.prototype.setColor;
        ReliefMesh.prototype.setColor = function (...args) {
          window.__r4LiveMesh = this;
          return setColor.apply(this, args);
        };
        await window.__splashery.app.chooseToy("moving-photo-3d");
        window.__splashery.app.setControl("play", 0);
      });
      await page.mouse.click(5, 180);
      const selectedPath = await selectCase(page, item, baseline);
      await page.waitForFunction(() => {
        const clip = window.__r4Moving.MOVING.clip;
        return (!clip.job || clip.job.done) && (!clip.refinement || clip.refinement.done);
      });
      await page.evaluate(async () => {
        const { player, app } = window.__splashery,
          moving = window.__r4Moving.MOVING,
          clip = moving.clip;
        if (clip.job?.error || clip.refinement?.error) throw Error("Depth preparation failed");
        app.setControl("play", 0);
        clip.audio?.track.pause();
        if (clip.audio?.track.el) clip.audio.track.el.currentTime = 0;
        clip.video?.pause();
        moving.t = moving.frame = 0;
        moving.anchor = null;
        if (clip.video) await window.__r4Moving.seekClipFrame(clip.video, 0);
        player.idle.weight = 0;
        player.opts.idleDelay = 1e9;
        player.camera.setState(
          { ...player.camera.getState(), yaw: 0.18, pitch: 0.08 },
          { snap: true },
        );
        player.camera.update(0);
        player.stage.setCameraPose(player.camera.pose());
        player.stage.requestRender(2);
        window.__r4LiveDraws = [];
        window.__r4LiveObserve = () =>
          window.__r4LiveDraws.push({
            at: performance.now(),
            time: moving.t,
            frame: moving.frame,
            sample: moving.clip.sample,
            pictureTime: window.__r4LiveMesh?.colorSrc?.currentTime ?? moving.frame,
            pictureKind: window.__r4LiveMesh?.colorSrc?.constructor.name,
            revision: window.__r4LiveMesh?.clipRevision,
          });
      });
      const stage = await page.locator("#stage").boundingBox();
      await page.addStyleTag({
        content:
          "body * { visibility: hidden !important; } #stage { visibility: visible !important; }",
      });
      await page.bringToFront();
      const folder = path.join(out, item.id);
      await fs.mkdir(folder, { recursive: true });
      const frames = [],
        writes = [];
      let firstResolve;
      const first = new Promise((resolve) => (firstResolve = resolve));
      const capture = (event) => {
        void cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId });
        const at = event.metadata.timestamp;
        if (!Number.isFinite(at)) throw Error("No native screencast timestamp");
        if (frames.length && at <= frames.at(-1).at) return;
        const file = `${String(frames.length).padStart(5, "0")}.jpg`,
          bytes = Buffer.from(event.data, "base64");
        frames.push({ at, file, sha256: sha(bytes) });
        writes.push(fs.writeFile(path.join(folder, file), bytes));
        firstResolve();
      };
      cdp.on("Page.screencastFrame", capture);
      await cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: 90,
        maxWidth: 390,
        maxHeight: 844,
        everyNthFrame: 1,
      });
      await page.evaluate(() => window.__splashery.player.stage.requestRender(2));
      let firstTimeout;
      try {
        await Promise.race([
          first,
          new Promise((_, reject) => {
            firstTimeout = setTimeout(() => reject(Error("Screencast did not start")), 30000);
          }),
        ]);
      } finally {
        clearTimeout(firstTimeout);
      }
      await page.evaluate(() => {
        const { player, app } = window.__splashery;
        player.stage.app.on("postrender", window.__r4LiveObserve);
        app.setControl("play", 1);
      });
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      await cdp.send("Page.stopScreencast");
      cdp.off("Page.screencastFrame", capture);
      const observed = await page.evaluate(() => {
        const { player, app } = window.__splashery;
        player.stage.app.off("postrender", window.__r4LiveObserve);
        app.setControl("play", 0);
        const moving = window.__r4Moving.MOVING;
        return {
          draws: window.__r4LiveDraws,
          visibility: document.visibilityState,
          paused: player.paused,
          time: moving.t,
          mediaTime: moving.clip.video?.currentTime,
          waiting: window.__r4LiveMesh?.clipWaitingDepth,
          cache: window.__r4LiveMesh?.clipCache?.stats,
          computedFrame: moving.clip.near?.indexOf(window.__r4LiveMesh?.clipComputedSource),
        };
      });
      const { draws } = observed;
      await Promise.all(writes);
      const accepted = frames.filter((frame) => frame.at < frames[0].at + seconds);
      await fs.writeFile(
        path.join(folder, "capture.json"),
        JSON.stringify({ ...observed, stage, frames: accepted, errors }, null, 2) + "\n",
      );
      if (
        accepted.length < 3 ||
        new Set(accepted.map((row) => row.sha256)).size < 2 ||
        new Set(draws.map((row) => row.pictureTime)).size < 2 ||
        errors.length
      )
        throw Error(`Invalid live recording: ${accepted.length} captures; ${errors.join("; ")}`);
      if (accepted.at(-1).at - accepted[0].at < seconds - Math.max(0.5, seconds * 0.1))
        throw Error(
          "Screencast stopped before the live window ended; record with no competing pages",
        );
      const credit = [...SAMPLES, ...LONG_SAMPLES].find((sample) => sample.id === item.id);
      const author = credit.author
        .match(/.{1,50}(?:\s|$)|.{1,50}/g)
        .map((line) => line.trim())
        .join("\n");
      const text = `${label.toUpperCase()} · ${credit.label}\nSilent live recording · fixed camera\nCapture overhead; clean timings are separate.\n${author}\n${credit.license}\n`;
      await fs.writeFile(path.join(folder, "credit.txt"), text);
      let concat = "ffconcat version 1.0\n";
      for (let i = 0; i < accepted.length; i++) {
        const dt = (accepted[i + 1]?.at ?? accepted[0].at + seconds) - accepted[i].at;
        concat += `file '${path.resolve(folder, accepted[i].file)}'\noption framerate 90000\nduration ${dt.toFixed(9)}\n`;
      }
      concat += `file '${path.resolve(folder, accepted.at(-1).file)}'\noption framerate 90000\n`;
      const list = path.join(folder, "frames.ffconcat"),
        file = path.join(out, `${item.id}-live.mp4`);
      await fs.writeFile(list, concat);
      const filter = `crop=${Math.round(stage.width)}:${Math.round(stage.height)}:${Math.round(stage.x)}:${Math.round(stage.y)},scale=390:600:force_original_aspect_ratio=decrease:flags=lanczos,pad=390:600:(ow-iw)/2:(oh-ih)/2:color=0xf0f3f8,pad=390:844:0:64:color=0xf0f3f8,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=${path.resolve(folder, "credit.txt")}:fontcolor=0x111827:fontsize=11:line_spacing=6:x=10:y=674`;
      execFileSync("ffmpeg", [
        "-nostdin",
        "-v",
        "error",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        list,
        "-vf",
        filter,
        "-an",
        "-c:v",
        "libx264",
        "-bf",
        "0",
        "-preset",
        "fast",
        "-crf",
        "20",
        "-threads",
        "1",
        "-pix_fmt",
        "yuv420p",
        "-fps_mode",
        "vfr",
        "-enc_time_base",
        "1/90000",
        "-video_track_timescale",
        "90000",
        "-x264-params",
        "fps=60:force-cfr=0",
        "-movflags",
        "+faststart",
        "-metadata",
        `artist=${credit.author}`,
        "-metadata",
        `copyright=${credit.license}; ${credit.licenseUrl}`,
        "-metadata",
        `comment=Source: ${credit.source}; silent live 3D presentation with capture overhead; made by Ryan with Codex (GPT-6)`,
        file,
      ]);
      const info = JSON.parse(
        execFileSync(
          "ffprobe",
          [
            "-v",
            "error",
            "-show_entries",
            "format=duration:stream=width,height:frame=best_effort_timestamp_time",
            "-show_frames",
            "-of",
            "json",
            file,
          ],
          { encoding: "utf8" },
        ),
      );
      if (Math.abs(Number(info.format.duration) - seconds) > 0.001)
        throw Error("Live recording duration changed");
      const expected = accepted.map((frame) => frame.at - accepted[0].at),
        encoded = info.frames.map((frame) => Number(frame.best_effort_timestamp_time));
      if (
        encoded.length !== expected.length + 1 ||
        expected.some((time, i) => Math.abs(time - encoded[i]) > 0.001)
      )
        throw Error("Live presentation timestamps changed during encoding");
      const bytes = await fs.readFile(file);
      report.cases.push({
        id: item.id,
        title: credit.label,
        path: selectedPath,
        inputHashes: await caseInputHashes(item, selectedPath, code),
        author: credit.author,
        license: credit.license,
        licenseUrl: credit.licenseUrl,
        sourcePage: credit.source,
        checked: "October 16, 2026",
        stage,
        captures: accepted.map((frame) => ({ ...frame, time: frame.at - accepted[0].at })),
        draws,
        errors,
        output: {
          file: path.basename(file),
          bytes: bytes.length,
          sha256: sha(bytes),
          duration: Number(info.format.duration),
        },
      });
      await save();
      console.log(
        JSON.stringify({
          id: item.id,
          captures: accepted.length,
          draws: draws.length,
          output: report.cases.at(-1).output,
        }),
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await save();
}
