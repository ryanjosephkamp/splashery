import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Match the calibration tool's CPU canvas path. Browser GPU downsampling can shift borderline
// metrics; existing video3d tests exercise the default browser configuration separately.
test.use({
  launchOptions: {
    executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
    args: ["--disable-gpu"],
  },
});

// These are real shipped videos, decoded by Chromium. Borderline captures stay caution:
// a trained result does not establish that every window is suitable for a new solve.
const good = [
  ["liberty", "caution"],
  ["edinburgh", "caution"],
  ["adjara", "promising"],
  ["lihula", "caution"],
  ["toolse", "caution"],
  ["poltsamaa", "promising"],
];

for (const [id, verdict] of good) {
  test(`real ${id} source cut receives calibrated feedback without a GPU`, async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(Navigator.prototype, "gpu", { get: () => undefined }),
    );
    await page.goto("/tests/fixtures/v3d/");
    const requests = [];
    page.on("request", (request) => requests.push(request.url()));
    const result = await page.evaluate(async (id) => {
      const { checkVideo } = await import("/src/video3d/suitability.js");
      const blob = await (await fetch(`/assets/toys/video-3d/${id}-source.webm`)).blob();
      const before = performance.now();
      const result = await checkVideo(new File([blob], `${id}.webm`, { type: "video/webm" }), {
        length: 20,
      });
      return { ...result, elapsedMs: performance.now() - before };
    }, id);
    expect(result.checked, JSON.stringify(result)).toBe(true);
    expect(result.verdict, JSON.stringify(result)).toBe(verdict);
    expect(result.metrics.frames).toBe(12);
    expect(result.elapsedMs).toBeLessThan(5100);
    expect(requests.filter((url) => /vendor\/splatjs|onnx|huggingface/.test(url))).toEqual([]);
    expect(requests.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
    if (id === "toolse") {
      // Local subpixel movement must not erase the clear movement over the longer baseline.
      expect(result.metrics.motion).toBeLessThan(0.6);
      expect(result.metrics.wideMotion).toBeGreaterThan(1);
      expect(result.reasons.join(" ")).not.toMatch(/Very little camera motion/);
    }
  });
}

// Real measurements from privately retained Commons videos, October 12, 2026. Numbers contain
// no image data or likeness. The calibration report records source URLs, hashes, and spans.
// Pan: Airplane_Spotting_at_St._Maarten_part_1.webm, Matt, CC BY 3.0, 94–113 s.
// Crowd: Crowd_of_participants_at_the_ABU_Cultural_Carnival_3.webm, Halima Waziri,
// CC BY-SA 4.0, 0–5.8 s. Zoom: Crash_zoom_on_cigarette.webm, Sarrah Anderson,
// CC BY 3.0, 0–10 s. The clips themselves never enter assets or fixtures.
const measured = [
  {
    id: "shaky pan",
    verdict: "poor",
    reason: /quickly and inconsistently/,
    metrics: {
      sharpness: 1622.604,
      contrast: 62.349,
      exposure: 19.622,
      motion: 6.325,
      wideMotion: 8.544,
      parallax: 3.059,
      unmatched: 0.093,
      outliers: 0.419,
      worstUnmatched: 0.385,
      zoom: 0.045,
      reversals: 1,
      texturePatches: 13,
    },
  },
  {
    id: "moving crowd",
    verdict: "caution",
    reason: /pan|brightness/i,
    metrics: {
      sharpness: 5167.203,
      contrast: 57.675,
      exposure: 32.473,
      motion: 2,
      wideMotion: 7.81,
      parallax: 0.371,
      unmatched: 0.049,
      outliers: 0.038,
      worstUnmatched: 0.15,
      zoom: 0.007,
      reversals: 0,
      texturePatches: 21,
    },
  },
  {
    id: "crash zoom",
    verdict: "poor",
    reason: /expands or shrinks suddenly/,
    metrics: {
      sharpness: 2600.309,
      contrast: 68.023,
      exposure: 52.916,
      motion: 0,
      wideMotion: 1.414,
      parallax: 0.475,
      unmatched: 0.29,
      outliers: 0.138,
      worstUnmatched: 1,
      zoom: 0.127,
      reversals: 0,
      texturePatches: 14,
    },
  },
];

for (const { id, verdict, reason, metrics } of measured) {
  test(`measured real ${id} remains a risk at the calibrated thresholds`, async () => {
    const { assessMetrics } = await import("../src/video3d/suitability.js");
    const result = assessMetrics({ ...metrics, frames: 12, localWindows: true });
    expect(result.verdict).toBe(verdict);
    expect(result.reasons.join(" ")).toMatch(reason);
  });
}

test("bad local input stays unknown, and cancellation stays owned by the caller", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/v3d/");
  const result = await page.evaluate(async () => {
    const { checkVideo } = await import("/src/video3d/suitability.js");
    const file = new File(["invalid video bytes"], "broken.webm", { type: "video/webm" });
    const before = performance.now();
    const unknown = await checkVideo(file);
    const controller = new AbortController();
    controller.abort();
    let abort;
    try {
      await checkVideo(file, { signal: controller.signal });
    } catch (error) {
      abort = error.name;
    }
    return { unknown, abort, elapsedMs: performance.now() - before };
  });
  expect(result.unknown.verdict).toBe("unknown");
  expect(result.unknown.checked).toBe(false);
  expect(result.abort).toBe("AbortError");
  expect(result.elapsedMs).toBeLessThan(5100);
});

test("Mac import keeps original COLMAP pose, unequal focal lengths, and principal point", async () => {
  const { readColmapText, importMetadata, MAC_SETTINGS } =
    await import("../tools/cdx-v3d-mac-bake.mjs");
  const { camCenter } = await import("../src/video3d/scene.js");
  const dir = fs.mkdtempSync(path.join(tmpdir(), "cdx-v3d-colmap-"));
  try {
    fs.writeFileSync(
      path.join(dir, "cameras.txt"),
      "# CAMERA_ID MODEL WIDTH HEIGHT PARAMS\n1 PINHOLE 1280 720 900 910 635 357\n2 SIMPLE_PINHOLE 720 480 600 360 240\n",
    );
    fs.writeFileSync(
      path.join(dir, "images.txt"),
      "# IMAGE_ID QW QX QY QZ TX TY TZ CAMERA_ID NAME\n2 1 0 0 0 0 0 0 2 000002.png\n\n1 0.7071067811865476 0 0.7071067811865476 0 1 2 3 1 000001.png\n10 20 -1\n",
    );
    const cameras = readColmapText(dir, [
      { file: "000001.png", time: 0 },
      { file: "000002.png", time: 0.334 },
    ]);
    const { cams } = cameras;
    expect(cams.map((c) => c.time)).toEqual([0, 0.334]);
    expect([cams[0].f, cams[0].fy, cams[0].cx, cams[0].cy, cams[0].w, cams[0].h]).toEqual([
      900, 910, 635, 357, 1280, 720,
    ]);
    expect(cams[1].f).toBe(600);
    expect(cams[1].fy).toBe(600);
    expect(cams[1].R).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    for (const [i, expected] of [3, -2, -1].entries())
      expect(camCenter(cams[0])[i]).toBeCloseTo(expected, 10);
    const meta = importMetadata(
      {
        frameTimes: Array.from({ length: 60 }, (_, i) => ({ file: `${i + 1}.png`, time: i / 3 })),
        capture: { span: { start: 18, length: 20 } },
      },
      cameras,
      { version: "COLMAP 4.2.1" },
      { iterations: 30000, splats: 320000, settings: MAC_SETTINGS },
      54400123,
    );
    expect(meta.stats).toMatchObject({
      frames: 60,
      registered: 2,
      iters: 30000,
      splats: 320000,
      plyBytes: 54400123,
    });
    expect(meta.bake.settings.trainSide).toBe(1280);
    expect(meta.bake.exportTrainSide).toBe(1280);
    expect(meta.bake.backend).toBe("msplat/Metal");
    expect(meta.bake.exportCam0).toMatchObject({ f: 900, fy: 910, cx: 635, cy: 357 });
    expect(meta.bake.sourceTimeOffset).toBe(18);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// An operator can also rerun the actual real counterexamples without checking the files in:
// CDX_V3D_BAD_MANIFEST=/tmp/cdx-v3d-bad/manifest.json ... playwright test this-file
test("retained real counterexample clips decode to caution or poor", async ({ page }) => {
  const manifest = process.env.CDX_V3D_BAD_MANIFEST;
  test.skip(!manifest, "Counterexample clips are kept privately outside the repository.");
  const samples = JSON.parse(fs.readFileSync(manifest, "utf8"));
  await page.goto("/tests/fixtures/v3d/");
  for (const sample of samples) {
    const result = await page.evaluate(
      async ({ base64, sample }) => {
        const { checkVideo } = await import("/src/video3d/suitability.js");
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const before = performance.now();
        const result = await checkVideo(
          new File([bytes], `${sample.id}.webm`, { type: "video/webm" }),
          {
            start: sample.start,
            length: sample.length,
          },
        );
        return { ...result, elapsedMs: performance.now() - before };
      },
      { base64: fs.readFileSync(sample.file).toString("base64"), sample },
    );
    expect(result.checked, sample.id).toBe(true);
    expect(result.verdict, sample.id).toBe(sample.id === "crowd" ? "caution" : "poor");
    expect(result.elapsedMs, sample.id).toBeLessThan(5100);
  }
});
