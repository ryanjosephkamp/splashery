#!/usr/bin/env node
// Bake each explicitly picked 30-second film with actual on-device-model
// answers on every playback frame. No model is needed to watch the result.
// Source downloads are kept in .cache/smd; their live license records and
// checked hashes are recorded in tools/assets.json and the audit.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { LONG_SAMPLES } from "../src/packs/moving-photo.js";

const dir = "assets/toys/moving-photo-3d";
const ids = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(900_000);
  await page.goto(`${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}LICENSES.md`);
  for (const sample of LONG_SAMPLES.filter((s) => !ids.length || ids.includes(s.id))) {
    const file = `${dir}/${sample.file}.webm`;
    const montage = sample.cut.segments;
    const pieces = montage?.flatMap(([start, end], i) => [
      `[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${i}]`,
      `[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${i}]`,
    ]);
    const graph = pieces
      ? [
          ...pieces,
          `${montage.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${montage.length}:v=1:a=1[jv][audio]`,
          `[jv]fps=${sample.fps},scale=min(640\\,iw):-2[video]`,
        ].join(";")
      : null;
    if (graph)
      execFileSync("ffmpeg", [
        "-nostdin",
        "-v",
        "error",
        "-y",
        "-i",
        sample.cut.src,
        "-filter_complex",
        graph,
        "-map",
        "[video]",
        "-map",
        "[audio]",
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
        String(sample.cut.ss),
        "-t",
        String(sample.cut.t),
        "-i",
        sample.cut.src,
        "-vf",
        `fps=${sample.fps},scale=min(640\\,iw):-2`,
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
