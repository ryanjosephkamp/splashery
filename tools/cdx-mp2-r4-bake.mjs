// Rebuild depth only; original film bytes are never re-encoded or overwritten.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";
import * as moving from "../src/packs/moving-photo.js";
import { sourceTimeline } from "./cdx-mp2-r4-clock.mjs";
import { option } from "./cdx-mp2-r4-harness.mjs";

const out = option("out", "work/r4-baked-depth"),
  ids = option("ids").split(",").filter(Boolean),
  reuse = option("reuse"),
  sourceRoot = "assets/toys/moving-photo-3d";
await fs.mkdir(out, { recursive: true });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const sample of moving.LONG_SAMPLES.filter(
  (sample) => !ids.length || ids.includes(sample.id),
)) {
  const source = `${sourceRoot}/${sample.file}.webm`,
    sourceSha256 = sha(await fs.readFile(source)),
    timeline = sourceTimeline(source, sample.fps);
  if (timeline.timestamps.length !== sample.frames) throw Error(`Source frame count: ${sample.id}`);
  let rawRoot = path.join(out, `${sample.id}-raw`),
    metadata;
  if (reuse) {
    const saved = JSON.parse(await fs.readFile(path.join(reuse, "manifest.json"), "utf8"));
    if (
      saved.source === source &&
      saved.sourceSha256 === sourceSha256 &&
      saved.metadata.n === sample.frames &&
      saved.times.every(
        (time, i) =>
          time >= timeline.timestamps[i] && time < timeline.timestamps[i] + timeline.durations[i],
      )
    ) {
      rawRoot = reuse;
      metadata = saved.metadata;
      console.log(JSON.stringify({ id: sample.id, phase: "reuse verified model answers" }));
    }
  }
  if (!metadata) {
    await fs.mkdir(rawRoot, { recursive: true });
    const browser = await chromium.launch({
      executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(1800000);
      await page.exposeFunction("r4BakeProgress", (value) =>
        console.log(JSON.stringify({ id: sample.id, ...value })),
      );
      await page.exposeFunction("r4BakeSave", async (i, raw, rgba) => {
        await fs.writeFile(path.join(rawRoot, `${i}.f32`), Buffer.from(raw, "base64"));
        await fs.writeFile(path.join(rawRoot, `${i}.rgba`), Buffer.from(rgba, "base64"));
      });
      await page.goto(`${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}LICENSES.md`);
      metadata = await page.evaluate(
        async ({ source, times, fps }) => {
          const mp = await import("/src/packs/moving-photo.js"),
            video = document.createElement("video");
          video.muted = true;
          video.preload = "auto";
          video.src = `/${source}`;
          await new Promise((resolve, reject) => {
            video.onloadeddata = resolve;
            video.onerror = () => reject(Error("Source decode failed"));
          });
          const w = 196,
            h = Math.max(14, Math.round(((video.videoHeight / video.videoWidth) * w) / 14) * 14),
            canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const g = canvas.getContext("2d", { willReadFrequently: true });
          g.imageSmoothingQuality = "high";
          const frames = [];
          for (let i = 0; i < times.length; i++) {
            await mp.seekClipFrame(video, times[i]);
            g.drawImage(video, 0, 0, w, h);
            frames.push({ data: g.getImageData(0, 0, w, h).data, delay: 1000 / fps });
            if (i % 120 === 0) await window.r4BakeProgress({ phase: "decode", frame: i });
          }
          if (frames.every((frame) => frame.data.every((v, i) => v === frames[0].data[i])))
            throw Error("Every extracted source picture is identical");
          const raw = await mp.depthOf(
            frames,
            w,
            h,
            (text) => window.r4BakeProgress({ phase: "model", text }),
            196,
            { cap: frames.length, motion: false },
          );
          const encode = (bytes) => {
            const parts = [];
            for (let i = 0; i < bytes.length; i += 8192)
              parts.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
            return btoa(parts.join(""));
          };
          for (let i = 0; i < raw.length; i++) {
            const d = raw[i].d;
            if (raw[i].w !== raw[0].w || raw[i].h !== raw[0].h)
              throw Error("The model grid changed during the bake");
            await window.r4BakeSave(
              i,
              encode(new Uint8Array(d.buffer, d.byteOffset, d.byteLength)),
              encode(frames[i].data),
            );
          }
          video.removeAttribute("src");
          video.load();
          return {
            w,
            h,
            n: times.length,
            rawWidth: raw[0].w,
            rawHeight: raw[0].h,
            aligned: !!raw.aligned,
          };
        },
        { source, times: timeline.captureTimes, fps: sample.fps },
      );
      metadata.browser = browser.version();
      await fs.writeFile(
        path.join(rawRoot, "manifest.json"),
        JSON.stringify({ source, sourceSha256, times: timeline.captureTimes, metadata }, null, 2) +
          "\n",
      );
    } finally {
      await browser.close();
    }
  }
  const raw = [],
    frames = [];
  for (let i = 0; i < metadata.n; i++) {
    const bytes = await fs.readFile(path.join(rawRoot, `${i}.f32`)),
      rgba = await fs.readFile(path.join(rawRoot, `${i}.rgba`));
    if (
      bytes.length !== metadata.rawWidth * metadata.rawHeight * 4 ||
      rgba.length !== metadata.w * metadata.h * 4
    )
      throw Error(`Incomplete model answer ${sample.id}/${i}`);
    const d = new Float32Array(bytes.length / 4);
    new Uint8Array(d.buffer).set(bytes);
    raw.push({ w: metadata.rawWidth, h: metadata.rawHeight, d });
    frames.push({ data: new Uint8ClampedArray(rgba), delay: 1000 / sample.fps });
  }
  raw.aligned = metadata.aligned;
  const radius = Math.max(3, Math.round(sample.fps / 2));
  console.log(JSON.stringify({ id: sample.id, phase: "normalize", radius }));
  const near = moving.normalizeDepths(raw, metadata.w, metadata.h, false, frames, false, null, {
      radius,
      rejectDepth: false,
    }),
    clip = moving.makeClip(sample.title, metadata.w, metadata.h, frames, near),
    bytes = new Uint8Array(12 + metadata.n * metadata.w * metadata.h),
    view = new DataView(bytes.buffer);
  bytes.set([77, 80, 50, 68]);
  view.setUint16(4, metadata.w, true);
  view.setUint16(6, metadata.h, true);
  view.setUint32(8, metadata.n, true);
  for (let i = 0; i < clip.n; i++) bytes.set(clip.near[i], 12 + i * metadata.w * metadata.h);
  const output = path.join(out, `${sample.file}.mp2depth`),
    packed = gzipSync(bytes, { level: 9 }),
    record = {
      source,
      sourceSha256,
      output,
      bytes: packed.length,
      sha256: sha(packed),
      decodedBytes: bytes.length,
      decodedSha256: sha(bytes),
      encoding: "gzip (lossless MP2D)",
      modelAnswers: metadata.n,
      modelGrid: [metadata.rawWidth, metadata.rawHeight],
      fps: sample.fps,
      radius,
      rejectDepth: false,
      frameOffset: 0,
      // (lane MP1: the toy's default STEADY mode, a rolling range in each shot, since October 17)
      normalization:
        moving.STEADY.mode === "shot"
          ? "A rolling one-second range in each shot and a symmetric color-gated window"
          : "One clip-wide range and a symmetric color-gated window, matching upload refinement",
      node: process.version,
      browser: metadata.browser || "See reused raw model-answer run",
      date: new Date().toISOString(),
    };
  // The quality runner may be waiting for this cache. Publish complete gzip
  // bytes together, so its decoder never sees a partially written stream.
  await fs.writeFile(`${output}.tmp`, packed);
  await fs.rename(`${output}.tmp`, output);
  await fs.writeFile(path.join(out, `${sample.file}.json`), JSON.stringify(record, null, 2) + "\n");
  console.log(JSON.stringify({ id: sample.id, done: true, ...record }));
}
