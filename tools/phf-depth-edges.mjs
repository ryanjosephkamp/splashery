#!/usr/bin/env node
// Lane Photo fidelity r2 (prefix phf): how well a short clip's depth keeps its edges. For a few
// frames of each Moving photo to 3D sample, the depth model is run at the clip's own depth size (196
// pixels on the long side: a phone) and at 518 (Photo to 3D's), in the page, as the toy runs it.
// The 518 depth, enlarged plainly to the frame, is the reference. The 196 depth is enlarged to the
// frame the r1 way (bilinear, then sharpenEdges) and the r2 way (guidedDepth, then sharpenEdges),
// and each is compared with the reference:
//
//   mae     the mean difference in nearness (0..1) over the whole frame
//   edge    the same over the depth edges only: the pixels whose 5 by 5 neighborhood in the
//           reference spans more than 0.15 (where the near and the far meet)
//   wrong   the share of those edge pixels more than 0.25 off: on the wrong side of the edge
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/phf-depth-edges.mjs
//     [--samples=sample,horse,dragon,bridge,machine] [--frames=3] [--side=196] [--out=.cache/phf2]
// Writes <out>/edges-<sample>.png (per frame: the frame, the reference, r1, r2) and prints a JSON
// line per sample.
//
// --plans=196x32,294x16,392x8 compares whole clips instead: the depth model runs on that many
// frames (evenly spread, as the toy does) at that size, the frames between blend their neighbors'
// depth, and the frames measured (--frames of them, between) are compared with their own 518 depth.
// Also printed: the model's time for the plan (the wait), in seconds on this machine.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const SAMPLES = opt("samples", "sample,horse,dragon,bridge,machine").split(",");
const FRAMES = Number(opt("frames", 3));
const SIDE = Number(opt("side", 196));
const OUT = opt("out", ".cache/phf2");
const PLANS = opt("plans", "")
  .split(",")
  .filter(Boolean)
  .map((p) => p.split("x").map(Number));
fs.mkdirSync(OUT, { recursive: true });
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(`${base}?renderer=webgl2&profile=mid&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });

const all = [];
for (const id of PLANS.length ? SAMPLES : []) {
  const r = await page.evaluate(
    async ({ id, frames, plans }) => {
      const m = await import("/src/packs/moving-photo.js");
      const clip = await m.loadSample(id);
      const { w, h, n } = clip;
      const at = (i) => ({ data: clip.colors[i], delay: 100 });
      const tests = Array.from({ length: frames }, (_, k) => Math.round(((k + 0.5) * (n - 1)) / frames)); // prettier-ignore
      const refs = [];
      for (const t of tests) refs.push(m.normalizeDepths(await m.depthOf([at(t)], w, h, null, 518), w, h)[0]); // prettier-ignore
      const out = { id, size: [w, h], n, tests, plans: [] };
      for (const [side, count] of plans) {
        const k = Math.min(n, count);
        const keys = Array.from({ length: k }, (_, i) => Math.round((i * (n - 1)) / Math.max(1, k - 1)));
        const t0 = performance.now();
        const raw = await m.depthOf(keys.map(at), w, h, null, side);
        const secs = (performance.now() - t0) / 1000;
        const sum = { r1: { edge: 0, wrong: 0 }, r2: { edge: 0, wrong: 0 } };
        tests.forEach((t, q) => {
          let a = 0;
          while (a + 1 < k && keys[a + 1] <= t) a++;
          const b = Math.min(k - 1, a + 1);
          const f = b === a ? 0 : (t - keys[a]) / (keys[b] - keys[a]);
          const d = new Float32Array(raw[a].d.length);
          for (let i = 0; i < d.length; i++) d[i] = raw[a].d[i] * (1 - f) + raw[b].d[i] * f;
          const blend = [{ w: raw[a].w, h: raw[a].h, d }];
          const ref = refs[q];
          const r1 = m.sharpenEdges(m.normalizeDepths(blend, w, h)[0], w, h);
          const r2 = m.sharpenEdges(m.normalizeDepths(blend, w, h, false, [at(t)])[0], w, h);
          for (const [name, dd] of [["r1", r1], ["r2", r2]]) {
            let e = 0;
            let wrong = 0;
            let edges = 0;
            for (let y = 0; y < h; y++)
              for (let x = 0; x < w; x++) {
                let lo = Infinity;
                let hi = -Infinity;
                for (let j = Math.max(0, y - 2); j <= Math.min(h - 1, y + 2); j++)
                  for (let i = Math.max(0, x - 2); i <= Math.min(w - 1, x + 2); i++) {
                    lo = Math.min(lo, ref[j * w + i]);
                    hi = Math.max(hi, ref[j * w + i]);
                  }
                if (hi - lo <= 0.15) continue;
                const diff = Math.abs(dd[y * w + x] - ref[y * w + x]);
                edges++;
                e += diff;
                if (diff > 0.25) wrong++;
              }
            sum[name].edge += e / Math.max(1, edges) / tests.length;
            sum[name].wrong += wrong / Math.max(1, edges) / tests.length;
          }
        });
        const r3 = (x) => Math.round(x * 1000) / 1000;
        out.plans.push({ side, frames: k, modelSecs: Math.round(secs * 10) / 10, r1: { edge: r3(sum.r1.edge), wrong: r3(sum.r1.wrong) }, r2: { edge: r3(sum.r2.edge), wrong: r3(sum.r2.wrong) } }); // prettier-ignore
      }
      return out;
    },
    { id, frames: FRAMES, plans: PLANS },
  );
  console.log(JSON.stringify(r));
}
for (const id of PLANS.length ? [] : SAMPLES) {
  const r = await page.evaluate(
    async ({ id, frames, side }) => {
      const m = await import("/src/packs/moving-photo.js");
      const clip = await m.loadSample(id);
      const { w, h } = clip;
      const pick = Array.from({ length: frames }, (_, k) => Math.round(((k + 0.5) * clip.n) / frames)); // prettier-ignore
      const sum = { r1: { mae: 0, edge: 0, wrong: 0 }, r2: { mae: 0, edge: 0, wrong: 0 }, edges: 0 };
      const strip = document.createElement("canvas");
      strip.width = w * 4;
      strip.height = h * frames;
      const sg = strip.getContext("2d");
      const show = (d, x, y) => {
        const im = new ImageData(w, h);
        for (let i = 0; i < w * h; i++) {
          const v = Math.round(255 * d[i]);
          im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
          im.data[i * 4 + 3] = 255;
        }
        sg.putImageData(im, x, y);
      };
      let ms = 0;
      for (let k = 0; k < frames; k++) {
        const f = { data: clip.colors[pick[k]], delay: 100 };
        const [lo] = await m.depthOf([f], w, h, null, side);
        const [hi] = await m.depthOf([f], w, h, null, 518);
        const ref = m.normalizeDepths([hi], w, h)[0];
        const r1 = m.sharpenEdges(m.normalizeDepths([lo], w, h)[0], w, h);
        const t = performance.now();
        const r2 = m.sharpenEdges(m.normalizeDepths([lo], w, h, false, [f])[0], w, h);
        ms += performance.now() - t;
        let edges = 0;
        const add = (d, s) => {
          let all = 0;
          let e = 0;
          let wrong = 0;
          edges = 0;
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              const i = y * w + x;
              const diff = Math.abs(d[i] - ref[i]);
              all += diff;
              let a = Infinity;
              let b = -Infinity;
              for (let j = Math.max(0, y - 2); j <= Math.min(h - 1, y + 2); j++)
                for (let q = Math.max(0, x - 2); q <= Math.min(w - 1, x + 2); q++) {
                  a = Math.min(a, ref[j * w + q]);
                  b = Math.max(b, ref[j * w + q]);
                }
              if (b - a > 0.15) {
                edges++;
                e += diff;
                if (diff > 0.25) wrong++;
              }
            }
          s.mae += all / (w * h) / frames;
          s.edge += e / Math.max(1, edges) / frames;
          s.wrong += wrong / Math.max(1, edges) / frames;
        };
        add(r1, sum.r1);
        add(r2, sum.r2);
        sum.edges += edges / (w * h) / frames;
        sg.putImageData(new ImageData(new Uint8ClampedArray(f.data), w, h), 0, k * h);
        show(ref, w, k * h);
        show(r1, 2 * w, k * h);
        show(r2, 3 * w, k * h);
      }
      const r3 = (x) => Math.round(x * 1000) / 1000;
      return {
        id,
        size: [w, h],
        frames: pick,
        edgeShare: r3(sum.edges),
        r1: Object.fromEntries(Object.entries(sum.r1).map(([k, v]) => [k, r3(v)])),
        r2: Object.fromEntries(Object.entries(sum.r2).map(([k, v]) => [k, r3(v)])),
        guidedMsPerFrame: Math.round(ms / frames),
        png: strip.toDataURL("image/png"),
      };
    },
    { id, frames: FRAMES, side: SIDE },
  );
  fs.writeFileSync(path.join(OUT, `edges-${id}.png`), Buffer.from(r.png.split(",")[1], "base64"));
  delete r.png;
  console.log(JSON.stringify(r));
  all.push(r);
}
await browser.close();
