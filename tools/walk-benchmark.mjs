// One/two-million-splat preparation costs. The input is a synthetic densification
// of a kit room, not a measured photoreal capture or physical phone.
// SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/walk-benchmark.mjs /tmp/walk-cost.json
import fs from "node:fs/promises";
import os from "node:os";
import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const rows = [];
try {
  for (const phone of [true, false]) {
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: phone ? 3 : 1,
      hasTouch: phone,
      isMobile: phone,
    });
    const page = await context.newPage();
    if (phone)
      await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(`http://127.0.0.1:${process.env.SPLASHERY_PORT || 4173}/?renderer=none`);
    for (const count of [1e6, 2e6]) {
      const result = await page.evaluate(
        async ({ count, phone }) => {
          const { buildRoom } = await import("/src/walk/rooms.js");
          const { WalkWorker } = await import("/src/walk/client.js");
          const source = buildRoom("courtyard").buffer,
            b = { count };
          for (const [key, width] of [
            ["pos", 3],
            ["scale", 3],
            ["rot", 4],
            ["color", 4],
          ]) {
            b[key] = new Float32Array(count * width);
            for (let i = 0; i < count; i++)
              b[key].set(
                source[key].subarray(
                  (i % source.count) * width,
                  (i % source.count) * width + width,
                ),
                i * width,
              );
          }
          const w = new WalkWorker(),
            started = performance.now();
          const r = await w.run({ buffer: b, budget: phone ? 60000 : 200000 });
          const wallMs = performance.now() - started;
          w.destroy();
          return {
            wallMs,
            prepareMs: r.prepareMs,
            gridMs: r.grid.buildMs,
            gridBytes: r.grid.bytes,
            gridDims: r.grid.dims,
            drawn: r.chunks.reduce((n, c) => n + c.buffer.count, 0),
            sourceArrayBytes: count * 56,
          };
        },
        { count, phone },
      );
      const row = { profile: phone ? "phone" : "desktop", count, ...result };
      console.log(JSON.stringify(row));
      rows.push(row);
    }
    await context.close();
  }
  await fs.writeFile(
    process.argv[2] || ".cache/walk-cost.json",
    JSON.stringify(
      {
        kind: "synthetic room densification; real browser worker; not a physical phone",
        chromium: browser.version(),
        cpu: os.cpus()[0].model,
        phone: "390×844, DPR 3, CDP CPU rate 4",
        desktop: "1440×900, DPR 1, no CPU throttle",
        rows,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
