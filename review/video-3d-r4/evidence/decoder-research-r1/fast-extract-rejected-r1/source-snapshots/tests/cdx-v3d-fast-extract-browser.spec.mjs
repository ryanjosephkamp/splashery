// MIT. Real local H.264 decoding against independent presented source JPEGs. Fixtures are CC0.
import { test, expect, chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { sourceFrameReceipts } from "../tools/v3d-bench-pixels.mjs";

test("the fast path preserves every selected JPEG on B-frame, nonsquare, cropped, and VFR sources", async ({}, testInfo) => {
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    headless: true,
    args: ["--disable-gpu", "--disable-software-rasterizer"],
  });
  const page = await browser.newPage({ baseURL: testInfo.project.use.baseURL });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "v3d-fast-source-"));
  try {
    await page.route("**/v3d-decoder-control.html", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Local decoder control</title>",
      }),
    );
    await page.goto("/v3d-decoder-control.html");
    for (const variant of ["b-sar", "vfr-signed"]) {
      const file = path.join(directory, variant + ".mp4");
      const filters =
        variant === "b-sar"
          ? "setsar=4/3"
          : "select='not(mod(n,3))+not(mod(n,5))',setpts=PTS-STARTPTS,setsar=1";
      execFileSync("ffmpeg", [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=192x128:rate=15:duration=2",
        "-vf",
        filters,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-bf",
        "2",
        "-g",
        "30",
        "-fps_mode",
        "vfr",
        "-movflags",
        variant === "b-sar" ? "+faststart" : "+faststart+negative_cts_offsets",
        "-y",
        file,
      ]);
      const base64 = fs.readFileSync(file).toString("base64");
      const sourceTimes = JSON.parse(
        execFileSync("ffprobe", [
          "-v",
          "error",
          "-select_streams",
          "v:0",
          "-show_entries",
          "frame=best_effort_timestamp_time",
          "-of",
          "json",
          file,
        ]),
      ).frames.map((frame) => Number(frame.best_effort_timestamp_time));
      const result = await page.evaluate(
        async ({ base64, variant }) => {
          const { openVideo, grabFrames, closeVideo } = await import("/src/video3d/extract.js");
          const { planFrames, panoSafeCrop } = await import("/src/video3d/frames.js");
          const bytes = Uint8Array.from(atob(base64), (value) => value.charCodeAt(0));
          const opened = await openVideo(
            new File([bytes], variant + ".mp4", { type: "video/mp4" }),
          );
          try {
            const progress = [],
              start = performance.now();
            const photos = await grabFrames(
              opened,
              planFrames({ duration: opened.duration, length: 1.5, rate: 3, maxFrames: 4 }),
              { side: 160, onFrame: (done, total) => progress.push([done, total]) },
            );
            const frames = await Promise.all(
              photos.map(async (photo) => ({
                ...photo,
                blob: undefined,
                sha256: Array.from(
                  new Uint8Array(
                    await crypto.subtle.digest("SHA-256", await photo.blob.arrayBuffer()),
                  ),
                  (b) => b.toString(16).padStart(2, "0"),
                ).join(""),
              })),
            );
            return {
              extraction: opened.extraction,
              fastDecodeFailure: opened.fastDecodeFailure,
              frames,
              progress,
              crop: panoSafeCrop(opened.width, opened.height),
              width: opened.width,
              height: opened.height,
              elapsedMs: performance.now() - start,
            };
          } finally {
            closeVideo(opened);
          }
        },
        { base64, variant },
      );
      expect(result.extraction?.method, result.fastDecodeFailure || variant).toBe("webcodecs-avc");
      expect(result.extraction.independentlyPresentedColorChecks).toBe(2);
      expect(result.frames).toHaveLength(4);
      expect(result.progress).toEqual([
        [1, 4],
        [2, 4],
        [3, 4],
        [4, 4],
      ]);
      expect(
        result.frames.every(
          (frame) => frame.presentedTime === null && frame.time === frame.decodedTime,
        ),
      ).toBe(true);
      const receipts = await page.evaluate(sourceFrameReceipts, {
        base64,
        sourceTimes,
        times: [],
        trainingFrames: result.frames,
        crop: result.crop,
      });
      expect(receipts.matchedTraining).toHaveLength(result.frames.length);
      for (let i = 0; i < result.frames.length; i++) {
        expect(receipts.matchedTraining[i].sha256).toBe(result.frames[i].sha256);
        expect(receipts.matchedTraining[i].repeatedSha256).toBe(result.frames[i].sha256);
        expect(
          Math.abs(receipts.matchedTraining[i].sourceTime - result.frames[i].time),
        ).toBeLessThan(0.000001);
      }
      await test.info().attach(variant + "-receipt.json", {
        body: Buffer.from(JSON.stringify({ variant, sourceTimes, result, receipts }, null, 2)),
        contentType: "application/json",
      });
    }
  } finally {
    await browser.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
