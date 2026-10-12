// Compare identical first-six-frame inputs through dense and sparse worker paths.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const b = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const p = await b.newPage();
await p.goto("http://127.0.0.1:4173/tests/");
const rows = await p.evaluate(async () => {
  const { SAMPLES } = await import("/src/packs/moving-photo.js");
  const { decodePhoto } = await import("/src/packs/photo-3d.js");
  const { createDepthClient } = await import("/src/depth/client.js");
  const { normalizeDepth } = await import("/src/packs/photo-3d-core.js");
  const rows = [];
  for (const s of SAMPLES) {
    const sheet = await decodePhoto(
      await (await fetch(`/assets/toys/moving-photo-3d/${s.file}-sheet-1.jpg`)).blob(),
    );
    const frames = [];
    for (let i = 0; i < 6; i++) {
      const data = new Uint8Array(s.w * s.h * 4);
      const ox = (i % s.cols) * s.w,
        oy = Math.floor(i / s.cols) * s.h;
      for (let y = 0; y < s.h; y++) {
        const at = ((oy + y) * sheet.w + ox) * 4;
        data.set(sheet.data.subarray(at, at + s.w * 4), y * s.w * 4);
      }
      frames.push({ data });
    }
    const c = createDepthClient();
    try {
      await c.request("init");
      const results = [];
      for (const keyEvery of [1, 2, 3]) {
        const t = performance.now();
        const out = await c.request("clip", {
          frames,
          w: s.w,
          h: s.h,
          options: { keyEvery, side: 196 },
        });
        const ms = performance.now() - t;
        const norms = out.depths.map((d) => normalizeDepth(d.d));
        const baseline = results[0]?.norms || norms;
        let mae = 0;
        for (let f = 0; f < norms.length; f++)
          for (let i = 0; i < norms[f].length; i++) mae += Math.abs(norms[f][i] - baseline[f][i]);
        mae /= norms.length * norms[0].length;
        results.push({
          keyEvery,
          ms,
          modelRuns: out.modelRuns,
          mae,
          norms,
          output: [out.depths[0].w, out.depths[0].h],
        });
      }
      rows.push({
        id: s.id,
        output: results[0].output,
        dense: results[0].norms.map((d) => Array.from(d)),
        results: results.map(({ norms, ...r }) => r),
      });
    } finally {
      c.dispose();
    }
  }
  return rows;
});
await fs.mkdir(".cache/cdx-depth/dense-clips", { recursive: true });
for (const row of rows) {
  for (let i = 0; i < row.dense.length; i++)
    await fs.writeFile(
      `.cache/cdx-depth/dense-clips/clip-${row.id}-${i}.f32`,
      Buffer.from(new Float32Array(row.dense[i]).buffer),
    );
  delete row.dense;
}
await fs.writeFile(".cache/cdx-depth/clips.json", JSON.stringify(rows, null, 2) + "\n");
console.log(rows);
await b.close();
