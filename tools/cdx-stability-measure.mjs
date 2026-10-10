#!/usr/bin/env node
// Run with the repository's HTTP server on SPLASHERY_URL (default port 4173).
// --out=<file> saves JSON; --profile=low|mid|high|max selects the unchanged tier.
// --baseline=<commit> serves that commit's moving-photo module without changing files.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

// RGBA RMS <= 8 identifies still pixels. A flip is a >0.15 relief jump
// there: larger than smooth surface noise and the edge snap's threshold.
export function stabilityMetrics(near, colors, scale = 255) {
  let jitter = 0,
    flips = 0,
    still = 0,
    energy = 0,
    explained = 0;
  for (let f = 1; f < near.length; f++) {
    const a = near[f - 1],
      b = near[f];
    let n = 0,
      sx = 0,
      sy = 0,
      sxx = 0,
      sxy = 0,
      e = 0;
    for (let i = 0; i < a.length; i++) {
      const o = i * 4;
      let cd = 0;
      for (let c = 0; c < 3; c++) cd += (colors[f][o + c] - colors[f - 1][o + c]) ** 2;
      const x = a[i] / scale,
        y = b[i] / scale,
        d = y - x;
      if (cd <= 3 * 8 ** 2) {
        jitter += Math.abs(d);
        flips += Math.abs(d) > 0.15 ? 1 : 0;
        still++;
      }
      n++;
      sx += x;
      sy += y;
      sxx += x * x;
      sxy += x * y;
      e += d * d;
    }
    const variance = sxx - (sx * sx) / n;
    const slope = variance > 1e-9 ? (sxy - (sx * sy) / n) / variance : 1;
    const shift = (sy - slope * sx) / n;
    let residual = 0;
    for (let i = 0; i < a.length; i++)
      residual += (b[i] / scale - (slope * a[i]) / scale - shift) ** 2;
    energy += e;
    explained += Math.max(0, e - residual);
  }
  return {
    heightJitter: jitter / Math.max(1, still),
    edgeFlipsPer1000: (1000 * flips) / Math.max(1, still),
    globalShare: explained / Math.max(1e-12, energy),
    stillShare: still / Math.max(1, (near.length - 1) * near[0].length),
  };
}

export async function measureSample(page, id, profile = "mid") {
  return page.evaluate(
    async ({ id, profile, metrics }) => {
      window.__splashery = { player: { profile } };
      const m = await import("/src/packs/moving-photo.js");
      m.MOVING.samples.delete(id);
      const start = performance.now();
      const clip = await m.loadSample(id);
      const openMs = performance.now() - start;
      const measure = (0, eval)(`(${metrics})`);
      const result = {
        id,
        w: clip.w,
        h: clip.h,
        frames: clip.n,
        fps: clip.n / clip.duration,
        openMs,
        ...measure(clip.near, clip.colors),
      };
      clip.audio?.track.pause();
      m.MOVING.samples.delete(id);
      return result;
    },
    { id, profile, metrics: stabilityMetrics.toString() },
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const option = (name, fallback) =>
    process.argv.find((x) => x.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  });
  try {
    const page = await browser.newPage();
    const baseline = option("baseline", "");
    if (baseline) {
      const body = execFileSync("git", ["show", `${baseline}:src/packs/moving-photo.js`], {
        encoding: "utf8",
      });
      await page.route("**/src/packs/moving-photo.js", (route) =>
        route.fulfill({ contentType: "text/javascript", body }),
      );
    }
    await page.goto(`${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}LICENSES.md`);
    const results = [];
    for (const id of ["sample", "horse", "dragon", "bridge", "machine"]) {
      // Three uncached constructions, warm HTTP/decoder caches; median opening time.
      const runs = [];
      for (let i = 0; i < 3; i++)
        runs.push(await measureSample(page, id, option("profile", "mid")));
      const result = { ...runs[0], openMs: runs.map((r) => r.openMs).sort((a, b) => a - b)[1] };
      results.push(result);
      console.log(JSON.stringify(result));
    }
    if (option("out", ""))
      await fs.writeFile(option("out", ""), JSON.stringify(results, null, 2) + "\n");
  } finally {
    await browser.close();
  }
}
