#!/usr/bin/env node
// Bake each explicitly picked 30-second film with actual on-device-model
// answers on every playback frame. No model is needed to watch the result.
// Source downloads are kept in .cache/smd; their live license records and
// checked hashes are recorded in tools/assets.json and the audit.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { LONG_SAMPLES } from "../src/packs/moving-photo.js";

const dir = "assets/toys/moving-photo-3d";
// Lane MP1: the films are encoded up to WIDE pixels wide (640 until October 17, 2026, from
// archive.org's 240-pixel derivatives; now from its masters, so the picture is sharp on a phone).
const WIDE = 960;
const ff = (...a) => execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", ...a]);
// Lane MP1: a sample whose cut names a `url` (the master on archive.org) and whose local source is
// missing is cut from the master over the network: only the parts it uses are fetched (ffmpeg
// reads byte ranges), each re-encoded near-losslessly, and a montage's parts are joined in order,
// so its segments become back-to-back times in that local file.
function localCut(sample) {
  const cut = sample.cut;
  if (existsSync(cut.src) || !cut.url) return cut;
  mkdirSync(".cache/smd", { recursive: true });
  const src = `.cache/smd/${sample.file}-master.mkv`;
  // (a second either side of a single cut, so its first and last frames are whole)
  const pad = cut.segments ? 0 : Math.min(1, cut.ss || 0);
  const parts = cut.segments || [[(cut.ss || 0) - pad, (cut.ss || 0) + cut.t + 1]];
  const files = existsSync(src)
    ? []
    : parts.map(([a, b], i) => {
        const out = `.cache/smd/${sample.file}-part${i}.mkv`;
        // (archive.org now and then answers a 5xx: reconnect, and try the part again)
        const get = () => ff("-reconnect", "1", "-reconnect_on_http_error", "5xx", "-reconnect_delay_max", "16", "-ss", String(a), "-t", String(b - a), "-i", cut.url, "-map", "0:v:0", "-map", "0:a:0", "-c:v", "libx264", "-crf", "12", "-preset", "veryfast", "-c:a", "aac", "-b:a", "256k", out); // prettier-ignore
        for (let tries = 0; ; tries++)
          try {
            get();
            break;
          } catch (e) {
            if (tries >= 3) throw e;
          }
        return out;
      });
  if (files.length) {
    const list = `.cache/smd/${sample.file}-parts.txt`;
    writeFileSync(list, files.map((f) => `file '${f.split("/").pop()}'\n`).join(""));
    ff("-f", "concat", "-safe", "0", "-i", list, "-c", "copy", src);
  }
  if (!cut.segments) return { ...cut, src, ss: pad };
  let at = 0;
  const segments = parts.map(([a, b]) => [at, (at += b - a)]);
  return { ...cut, src, segments };
}
// (Lane MP1: --video-only encodes the films and stops; tools/cdx-mp2-r4-bake.mjs then bakes their
// depth from every source frame.)
const videoOnly = process.argv.includes("--video-only");
const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(900_000);
  await page.goto(`${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}LICENSES.md`);
  for (const sample of LONG_SAMPLES.filter((s) => !ids.length || ids.includes(s.id))) {
    const file = `${dir}/${sample.file}.webm`;
    const cut = localCut(sample);
    const montage = cut.segments;
    const pieces = montage?.flatMap(([start, end], i) => [
      `[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${i}]`,
      `[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${i}]`,
    ]);
    const graph = pieces
      ? [
          ...pieces,
          `${montage.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${montage.length}:v=1:a=1[jv][audio]`,
          `[jv]fps=${sample.fps},scale=min(${WIDE}\\,iw):-2[video]`,
        ].join(";")
      : null;
    if (graph)
      execFileSync("ffmpeg", [
        "-nostdin",
        "-v",
        "error",
        "-y",
        "-i",
        cut.src,
        "-filter_complex",
        graph,
        "-map",
        "[video]",
        "-map",
        "[audio]",
        "-frames:v",
        String(sample.frames), // (lane MP1: exactly the sample's frames)
        "-c:v",
        "libvpx-vp9",
        "-crf",
        "30",
        "-b:v",
        "0",
        "-c:a",
        "libopus",
        "-b:a",
        "64k",
        file,
      ]);
    else
      execFileSync("ffmpeg", [
        "-nostdin",
        "-v",
        "error",
        "-y",
        "-ss",
        String(cut.ss),
        "-t",
        String(cut.t),
        "-i",
        cut.src,
        "-vf",
        `fps=${sample.fps},scale=min(${WIDE}\\,iw):-2`,
        "-frames:v",
        String(sample.frames), // (lane MP1: exactly the sample's frames)
        "-c:v",
        "libvpx-vp9",
        "-crf",
        "30",
        "-b:v",
        "0",
        "-c:a",
        "libopus",
        "-b:a",
        "64k",
        file,
      ]);
    console.log(`${sample.id}: video ready`);
    if (videoOnly) continue;
    const bytes = await page.evaluate(
      async ({ file, sample }) => {
        const mp = await import("/src/packs/moving-photo.js");
        const v = document.createElement("video");
        v.muted = true;
        v.src = `/${file}`;
        v.preload = "auto";
        await new Promise((resolve, reject) => {
          v.onloadeddata = resolve;
          v.onerror = () => reject(new Error("Video decode failed"));
        });
        await new Promise((r) => setTimeout(r, 50));
        if (!v.seekable.length || v.seekable.end(v.seekable.length - 1) < sample.cut.t - 0.1)
          throw new Error(
            "The preview server does not support video seeking. Run tools/cdx-mp2-server.mjs and set SPLASHERY_URL to its URL.",
          );
        const w = 196,
          h = Math.max(14, Math.round(((v.videoHeight / v.videoWidth) * w) / 14) * 14);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const g = canvas.getContext("2d", { willReadFrequently: true });
        const frames = [];
        for (let i = 0; i < sample.frames; i++) {
          const at = i / sample.fps;
          if (i > 0)
            await new Promise((resolve) => {
              v.onseeked = resolve;
              v.currentTime = at;
            });
          if (Math.abs(v.currentTime - at) > 1 / sample.fps)
            throw new Error(`Video seek failed at frame ${i}: ${v.currentTime} instead of ${at}`);
          g.drawImage(v, 0, 0, w, h);
          frames.push({ data: g.getImageData(0, 0, w, h).data, delay: 1000 / sample.fps });
        }
        const raw = await mp.depthOf(
          frames,
          w,
          h,
          (s) => {
            if (/of/.test(s)) console.log(s);
          },
          196,
          { cap: frames.length, motion: false },
        );
        // A seekable source must produce actual changing pictures and depth.
        if (frames.every((f) => f.data.every((v, i) => v === frames[0].data[i])))
          throw new Error("Every extracted picture is identical; refusing to bake a static movie.");
        const clip = mp.makeClip(
          sample.title,
          w,
          h,
          frames,
          mp.normalizeDepths(raw, w, h, false, frames, false),
        );
        const out = new Uint8Array(12 + sample.frames * w * h);
        out.set([77, 80, 50, 68]);
        const header = new DataView(out.buffer);
        header.setUint16(4, w, true);
        header.setUint16(6, h, true);
        header.setUint32(8, sample.frames, true);
        for (let i = 0; i < clip.n; i++) out.set(clip.near[i], 12 + i * w * h);
        v.removeAttribute("src");
        v.load();
        return Array.from(out);
      },
      { file, sample },
    );
    await fs.writeFile(`${dir}/${sample.file}.mp2depth`, Buffer.from(bytes));
    console.log(
      `${sample.id}: ${bytes.length} depth bytes, ${(await fs.stat(file)).size} video bytes`,
    );
  }
} finally {
  await browser.close();
}
