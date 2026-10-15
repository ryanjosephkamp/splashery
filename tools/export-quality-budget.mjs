// Reproduce the task 89 full-ceiling byte-budget stress test. No take is retained.
// Serve the repository on port 4175 first; optional argv[2] is the JSON output.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
});
try {
  const page = await browser.newPage();
  await page.goto(`${process.env.SPLASHERY_URL || "http://127.0.0.1:4175"}/LICENSES.md`);
  await page.setContent(
    '<script type="importmap">{"imports":{"gifenc":"/vendor/gifenc/gifenc.esm.js"}}</script>',
  );
  const results = [];
  for (const phone of [true, false]) {
    console.log("START", phone ? "phone" : "desktop");
    const result = await page.evaluate(async (phone) => {
      const { startRecording } = await import("/src/exports.js");
      const { EXPORT_PRESETS: P } = await import("/src/export/presets.js");
      const maxBytes = phone ? P.record.phoneBytes : P.record.desktopBytes;
      const c = document.createElement("canvas");
      c.width = 640;
      c.height = 360;
      const g = c.getContext("2d");
      const data = g.createImageData(640, 360);
      let seed = 123456789;
      let drawn = 0;
      let warningAt = null;
      const t = performance.now();
      const rec = startRecording({
        canvas: c,
        bitrate: 80_000_000,
        maxBytes,
        maxSeconds: 180,
        onWarning: () => (warningAt = (performance.now() - t) / 1000),
      });
      const draw = setInterval(() => {
        const words = new Uint32Array(data.data.buffer);
        for (let i = 0; i < words.length; i++) {
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          words[i] = (seed & 0xffffff) | 0xff000000;
        }
        g.putImageData(data, 0, 0);
        rec.frame();
        drawn++;
      }, 33);
      try {
        const r = await rec.done;
        return {
          phone,
          maxBytes,
          bytes: r.size,
          seconds: r.seconds,
          reason: r.reason,
          warningAt,
          drawn,
          type: r.type,
        };
      } finally {
        clearInterval(draw);
      }
    }, phone);
    results.push(result);
    fs.writeFileSync(
      process.argv[2] || "/tmp/export-quality/budget-measurements.json",
      JSON.stringify(results, null, 2) + "\n",
    );
    console.log(result);
  }
} finally {
  await browser.close();
}
