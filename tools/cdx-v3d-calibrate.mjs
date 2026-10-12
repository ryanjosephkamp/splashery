#!/usr/bin/env node
// MIT. Decode real local clips with the same quick check the toy uses. Nothing is uploaded.
// Usage: node tools/cdx-v3d-calibrate.mjs [manifest.json] [output.json]
// Optional manifest: [{ id, file, start, length, source, license, span, expected }].
// Keep external calibration clips outside the repository; only the manifest and results are text.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const defaults = ["liberty", "edinburgh", "adjara", "lihula", "toolse", "poltsamaa"].map((id) => ({
  id,
  file: path.join(root, "assets/toys/video-3d", `${id}-source.webm`),
  start: 0,
  length: 20,
  expected: "usable or borderline",
}));
const manifest = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], "utf8")) : defaults;
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--disable-gpu"],
});
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${process.env.SPLASHERY_PORT || 4175}/tests/fixtures/v3d/`);
  const results = [];
  for (const sample of manifest) {
    const bytes = fs.readFileSync(sample.file);
    const result = await page.evaluate(
      async ({ base64, sample }) => {
        const { checkVideo } = await import("/src/video3d/suitability.js");
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const type = sample.file.endsWith(".mp4") ? "video/mp4" : "video/webm";
        const before = performance.now();
        const check = await checkVideo(new File([bytes], sample.id, { type }), {
          start: sample.start || 0,
          length: sample.length || 20,
        });
        return { ...check, elapsedMs: performance.now() - before };
      },
      { base64: bytes.toString("base64"), sample },
    );
    const row = {
      ...sample,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      ...result,
    };
    results.push(row);
    console.log(`${sample.id}: ${result.verdict}; ${JSON.stringify(result.metrics)}`);
  }
  const report = { checked: new Date().toISOString(), browser: browser.version(), results };
  const output = process.argv[3] || "/tmp/cdx-v3d-calibration.json";
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(`Wrote ${output}`);
} finally {
  await browser.close();
}
