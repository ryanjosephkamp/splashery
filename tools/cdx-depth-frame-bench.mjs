// The production clip/mirror protocol, measured against the original worker on identical RGBA.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import crypto from "node:crypto";
const dir = ".cache/cdx-depth/baseline";
await fs.mkdir(dir, { recursive: true });
const original = execFileSync("git", ["show", "1ecc57dc:src/live/depth-worker.js"], {
  encoding: "utf8",
});
await fs.writeFile(
  `${dir}/worker.js`,
  original.replace('new URL("../../", import.meta.url)', 'new URL("../../../", import.meta.url)'),
);
const b = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const results = [];
try {
  for (const rate of [1, 4])
    for (const side of [196, 294])
      for (const version of ["before", "after"]) {
        const p = await b.newPage({
          viewport: rate === 4 ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        });
        await p.goto("http://127.0.0.1:4173/tests/");
        const cdp = await p.context().newCDPSession(p);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate });
        const rows = await p.evaluate(
          async ({ side, version }) => {
            const { SAMPLES, shrink } = await import("/src/packs/moving-photo.js");
            const { decodePhoto } = await import("/src/packs/photo-3d.js");
            const { modelSize } = await import("/src/packs/photo-3d-core.js");
            const worker = new Worker(
              version === "before"
                ? "/.cache/cdx-depth/baseline/worker.js"
                : "/src/live/depth-worker.js",
              { type: "module" },
            );
            const rows = [];
            try {
              for (const s of SAMPLES) {
                const sheet = await decodePhoto(
                  await (await fetch(`/assets/toys/moving-photo-3d/${s.file}-sheet-1.jpg`)).blob(),
                );
                const frame = new Uint8Array(s.w * s.h * 4);
                for (let y = 0; y < s.h; y++)
                  frame.set(
                    sheet.data.subarray(y * sheet.w * 4, (y * sheet.w + s.w) * 4),
                    y * s.w * 4,
                  );
                const { dw: w, dh: h } = modelSize(s.w, s.h, side);
                const rgba = shrink(frame, s.w, s.h, w, h);
                const runs = [];
                let d;
                for (let i = 0; i < 2; i++) {
                  const t = performance.now();
                  d = await new Promise((resolve, reject) => {
                    worker.onmessage = ({ data: m }) => {
                      if (m.type === "depth") resolve(m);
                      if (m.type === "error") reject(new Error(m.text));
                    };
                    worker.onerror = () => reject(new Error("Worker failed."));
                    const data = rgba.slice();
                    worker.postMessage({ type: "frame", id: i, w, h, data }, [data.buffer]);
                  });
                  runs.push({ totalMs: performance.now() - t, inferenceMs: d.ms });
                }
                rows.push({
                  id: s.id,
                  input: [w, h],
                  output: [d.w, d.h],
                  runs,
                  depth: Array.from(d.d),
                });
              }
            } finally {
              worker.terminate();
            }
            return rows;
          },
          { side, version },
        );
        for (const row of rows) {
          row.sha256 = crypto
            .createHash("sha256")
            .update(Buffer.from(new Float32Array(row.depth).buffer))
            .digest("hex");
          delete row.depth;
        }
        results.push({ rate, side, version, rows });
        await fs.writeFile(".cache/cdx-depth/frames.json", JSON.stringify(results, null, 2) + "\n");
        console.log(
          `${version}, ${rate}x page, ${side}: ${rows.map((r) => r.runs[1].inferenceMs.toFixed(0)).join("/")} ms`,
        );
        await p.close();
      }
} finally {
  await b.close();
}
