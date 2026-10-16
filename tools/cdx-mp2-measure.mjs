#!/usr/bin/env node
// Local browser measurements. Sources made from the shipped sheets are labeled
// reconstructions; --sources=<JSON> supplies original video/GIF cuts instead.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { SAMPLES } from "../src/packs/moving-photo.js";
import { stabilityMetrics } from "./cdx-stability-measure.mjs";

export function surfaceMetrics(near, w, h, cut = 0.05) {
  let removed = 0;
  let total = 0;
  for (const d of near)
    for (let y = 0; y + 1 < h; y++)
      for (let x = 0; x + 1 < w; x++) {
        const i = y * w + x;
        const a = d[i],
          b = d[i + 1],
          c = d[i + w],
          e = d[i + w + 1];
        removed += Math.max(a, b, c) - Math.min(a, b, c) > 255 * cut;
        removed += Math.max(b, c, e) - Math.min(b, c, e) > 255 * cut;
        total += 2;
      }
  // Surface triangles removed by Sharp's cut: where the backing must fill.
  // This is a geometry coverage proxy, not a screenshot background-pixel count.
  return { surfaceCutShare: removed / Math.max(1, total) };
}

export async function measure(page, { id, path, profile = "low", refine = true }) {
  return page.evaluate(
    async ({ id, path, profile, refine, jitter, surface }) => {
      window.__splashery = { player: { profile } };
      const m = await import("/src/packs/moving-photo.js");
      const start = performance.now();
      let clip;
      if (path) {
        const blob = await (await fetch(`/${path}`)).blob();
        clip = await m.openClip(new File([blob], path.split("/").pop(), { type: blob.type }), id);
      } else {
        m.MOVING.samples.delete(id);
        clip = await m.loadSample(id);
      }
      const openMs = performance.now() - start;
      const metrics = () => ({
        ...(0, eval)(`(${jitter})`)(clip.near, clip.colors),
        ...(0, eval)(`(${surface})`)(clip.near, clip.w, clip.h),
      });
      const first = metrics();
      if (refine && clip.refinement) await clip.refinement.finished;
      const result = {
        id,
        path: path || null,
        profile,
        w: clip.w,
        h: clip.h,
        frames: clip.n,
        fps: clip.n / clip.duration,
        openMs,
        finishedMs: performance.now() - start,
        first,
        ...metrics(),
        refinement: clip.refinement
          ? {
              done: clip.refinement.done,
              error: clip.refinement.error,
              measured: clip.refinement.measured,
              side: clip.refinement.side,
              normalization: clip.refinement.normalization,
              scores: clip.refinement.scores,
            }
          : null,
      };
      clip.audio?.track.close();
      clip.video?.pause();
      clip.refinement?.cancel();
      if (clip.url) URL.revokeObjectURL(clip.url);
      return result;
    },
    {
      id,
      path,
      profile,
      refine,
      jitter: stabilityMetrics.toString(),
      surface: surfaceMetrics.toString(),
    },
  );
}

export async function reconstructedSources(dir, ids = null) {
  await fs.mkdir(dir, { recursive: true });
  const sources = {};
  for (const s of SAMPLES) {
    if (s.long) continue;
    if (ids && !ids.includes(s.id)) continue;
    if (s.id === "sample") sources[s.id] = "assets/toys/screen/bunny.webm";
    else if (s.gif) sources[s.id] = "assets/toys/screen/horse.gif";
    else {
      const path = `${dir}/${s.id}.webm`;
      execFileSync("ffmpeg", [
        "-nostdin",
        "-v",
        "error",
        "-y",
        "-framerate",
        String(s.fps / (s.cols * s.rows)),
        "-i",
        `assets/toys/moving-photo-3d/${s.file}-sheet-%d.jpg`,
        "-vf",
        // Keep the reconstructed pictures' clock and color range independent
        // of the encoder version's defaults for untiled JPEG frames.
        `format=rgb24,untile=${s.cols}x${s.rows},setpts=N/(${s.fps}*TB),pad=ceil(iw/2)*2:ceil(ih/2)*2,scale=in_range=pc:out_range=tv:out_color_matrix=bt601,format=yuv420p`,
        "-r",
        String(s.fps),
        "-fps_mode",
        "cfr",
        "-frames:v",
        String(s.frames),
        "-c:v",
        "libvpx-vp9",
        "-lossless",
        "1",
        "-pix_fmt",
        "yuv420p",
        "-color_range",
        "tv",
        "-colorspace",
        "bt470bg",
        path,
      ]);
      sources[s.id] = path;
    }
  }
  if (ids && !ids.includes("fast60")) return sources;
  const fast = `${dir}/fast-60.webm`;
  execFileSync("ffmpeg", [
    "-nostdin",
    "-v",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=320x180:rate=60:duration=2",
    "-c:v",
    "libvpx-vp9",
    "-lossless",
    "1",
    fast,
  ]);
  sources.fast60 = fast;
  return sources;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const option = (key, fallback) =>
    process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback;
  if (process.argv.includes("--goal")) {
    await (await import("./cdx-mp2-render.mjs")).renderGoal(option, reconstructedSources);
  } else {
    const sources = option("sources", "")
      ? JSON.parse(await fs.readFile(option("sources"), "utf8"))
      : await reconstructedSources(".cache/cdx-mp2/sources");
    const browser = await chromium.launch({
      executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
      channel: process.env.SPLASHERY_CHROMIUM ? undefined : "chrome",
      // Match the browser regression suite. Native video/canvas conversion
      // and upload metrics can differ with plain headless Chromium's GPU setup.
      args: [
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
        "--enable-webgl",
        "--disable-gpu-driver-bug-workarounds",
        "--enable-unsafe-webgpu",
        "--enable-features=Vulkan,WebGPU",
        "--use-webgpu-adapter=swiftshader",
        "--use-vulkan=swiftshader",
      ],
    });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(600_000);
      if (option("baseline", ""))
        for (const file of [
          "src/packs/moving-photo.js",
          "src/packs/photo-sharp.js",
          "src/packs/song-stream.js",
          "src/live/clip-stabilize.js",
        ])
          await page.route(`**/${file}`, (route) =>
            route.fulfill({
              contentType: "text/javascript",
              body: execFileSync("git", ["show", `${option("baseline")}:${file}`], {
                encoding: "utf8",
              }),
            }),
          );
      await page.goto(`${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}LICENSES.md`);
      const results = [];
      for (const [id, path] of Object.entries(sources)) {
        if (option("ids", "") && !option("ids").split(",").includes(id)) continue;
        if (SAMPLES.some((s) => s.id === id && !s.long)) {
          const r = await measure(page, { id, profile: option("profile", "low") });
          results.push(r);
          console.log(JSON.stringify(r));
        }
        const r = await measure(page, { id, path, profile: option("profile", "low") });
        results.push(r);
        console.log(JSON.stringify(r));
        await fs.writeFile(
          option("out", ".cache/cdx-mp2/measure.json"),
          JSON.stringify(
            {
              sourceKind: option("sources", "")
                ? "specified originals"
                : "original bunny and horse; other short videos reconstructed from sheets; synthetic 60 fps",
              results,
            },
            null,
            2,
          ) + "\n",
        );
      }
    } finally {
      await browser.close();
    }
  }
}
