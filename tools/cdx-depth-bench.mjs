// Run against the unmodified checkout first, then the worker engine. Outputs are local evidence,
// never user media. Start the repository's static server on 4173 before running this tool.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const args = Object.fromEntries(process.argv.slice(2).map((s) => s.replace(/^--/, "").split("=")));
const label = args.label || "after";
const dir = args.out || `.cache/cdx-depth/${label}`;
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const result = { label, date: new Date().toISOString(), browser: browser.version(), profiles: [] };
try {
  for (const rate of args.rate ? [Number(args.rate)] : [1, 4]) {
    const page = await browser.newPage({
      viewport: rate === 4 ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    });
    await page.goto(`${process.env.SPLASHERY_URL || "http://127.0.0.1:4173"}/tests/`);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    const rows = await page.evaluate(
      async ({ only, side, repeats, engine, spec }) => {
        let dep;
        if (spec) {
          const worker = new Worker("/tools/cdx-depth-candidate-worker.mjs", { type: "module" });
          const ask = (m) =>
            new Promise((resolve, reject) => {
              worker.onmessage = ({ data: r }) =>
                r.type === "error" ? reject(new Error(r.error)) : resolve(r);
              worker.onerror = () => reject(new Error("Candidate worker failed."));
              worker.postMessage(m);
            });
          let loaded;
          dep = {
            loadDepthModel: () => (loaded ||= ask({ type: "init", spec })),
            estimateDepth: (photo) => ask({ type: "photo", photo }),
          };
        } else dep = await import(engine || "/src/packs/photo-3d-depth.js");
        const p3d = await import("/src/packs/photo-3d.js");
        const mp = await import("/src/packs/moving-photo.js");
        const dot = await import("/src/packs/dot-samples.js");
        const samples = [
          ...p3d.SAMPLES.map((s) => ({ id: s.id, url: `/assets/toys/photo-3d/${s.id}.jpg` })),
          ...dot.DOT_SAMPLES.map((s) => ({
            id: s.id,
            url: `/assets/toys/photo-3d/${s.dir}/${s.file}.${s.ext}`,
          })),
          ...mp.SAMPLES.map((s) => ({
            id: `clip-${s.id}`,
            url: `/assets/toys/moving-photo-3d/${s.file}-sheet-1.jpg`,
            clip: s,
          })),
        ];
        const rows = [];
        const now = () => performance.now();
        for (const s of samples.filter((s) => !only || only.split(",").includes(s.id))) {
          if (!s.url) continue;
          const blob = await (await fetch(s.url)).blob();
          let photo = await p3d.decodePhoto(blob);
          if (s.clip) {
            const { w, h } = s.clip;
            const data = new Uint8ClampedArray(w * h * 4);
            for (let y = 0; y < h; y++)
              data.set(photo.data.subarray(y * photo.w * 4, (y * photo.w + w) * 4), y * w * 4);
            photo = { w, h, data };
          }
          let maxTask = 0;
          const observer = new PerformanceObserver((list) => {
            for (const e of list.getEntries()) maxTask = Math.max(maxTask, e.duration);
          });
          observer.observe({ type: "longtask" });
          let ticks = 0;
          let last = now();
          let maxGap = 0;
          const timer = setInterval(() => {
            ticks++;
            const t = now();
            maxGap = Math.max(maxGap, t - last);
            last = t;
          }, 16);
          const t = now();
          await dep.loadDepthModel();
          const loadMs = now() - t;
          const runs = [];
          let d;
          for (let i = 0; i < repeats; i++) {
            const start = now();
            d = await dep.estimateDepth(photo, undefined, side ? { side } : {});
            runs.push({ inferenceMs: d.ms, totalMs: now() - start });
          }
          await new Promise((r) => setTimeout(r, 50));
          observer.disconnect();
          clearInterval(timer);
          let lo = Infinity,
            hi = -Infinity;
          for (const v of d.d) {
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
          }
          const canvas = document.createElement("canvas");
          canvas.width = d.w;
          canvas.height = d.h;
          const ctx = canvas.getContext("2d");
          const img = ctx.createImageData(d.w, d.h);
          for (let i = 0; i < d.d.length; i++) {
            const v = Math.round((255 * (d.d[i] - lo)) / (hi - lo || 1));
            img.data.set([v, v, v, 255], i * 4);
          }
          ctx.putImageData(img, 0, 0);
          rows.push({
            id: s.id,
            input: [photo.w, photo.h],
            output: [d.w, d.h],
            loadMs,
            runs,
            maxTask,
            maxGap,
            ticks,
            depth: Array.from(d.d),
            png: canvas.toDataURL("image/png").split(",")[1],
          });
        }
        return rows;
      },
      {
        only: args.only,
        side: Number(args.side) || 0,
        repeats: Number(args.repeats) || 2,
        engine: args.engine,
        spec: args.model
          ? {
              model: `/.cache/cdx-depth/models/${args.model}.onnx`,
              side: Number(args.side) || 518,
              ...(args.model === "da3"
                ? {
                    multi: true,
                    inverse: true,
                    external: "/.cache/cdx-depth/models/da3-data.onnx_data",
                  }
                : {}),
            }
          : null,
      },
    );
    for (const row of rows) {
      const stem = `${rate}x-${row.id}`;
      const bytes = Buffer.from(new Float32Array(row.depth).buffer);
      await fs.writeFile(path.join(dir, `${stem}.f32`), bytes);
      await fs.writeFile(path.join(dir, `${stem}.png`), Buffer.from(row.png, "base64"));
      row.sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
      delete row.depth;
      delete row.png;
      console.log(
        `${label} ${rate}x ${row.id}: load ${row.loadMs.toFixed(0)} ms, runs ${row.runs.map((r) => r.inferenceMs.toFixed(0)).join("/")} ms, long task ${row.maxTask.toFixed(0)} ms`,
      );
    }
    result.profiles.push({ rate, rows });
    await fs.writeFile(path.join(dir, "timings.json"), JSON.stringify(result, null, 2) + "\n");
    await page.close();
  }
} catch (err) {
  result.error = String(err.message || err);
  await fs.writeFile(path.join(dir, "timings.json"), JSON.stringify(result, null, 2) + "\n");
  console.error(result.error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
