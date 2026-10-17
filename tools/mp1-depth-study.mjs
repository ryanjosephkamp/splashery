#!/usr/bin/env node
// Lane MP1: how Moving photo to 3D's depth holds over time. For each short sample (its stored model
// answers, the same ones the toy loads), each way of turning the answers into the relief is scored
// on two things:
//   - contrast: how much of the full depth each frame uses (the 5th to 95th percentile spread of
//     its nearness, averaged over the frames; 1 is the whole Depth slider's range);
//   - jitter: how far the nearness moves from one frame to the next where the picture holds still
//     (pixels whose color barely changed), averaged over the pairs inside one shot; and jitter
//     over contrast, the twitch as a share of the relief.
// A good answer keeps contrast high and jitter low. Writes a table (Markdown) to stdout, and with
// --json=<file> the numbers. Needs the static server on 4173 (node tools/cdx-mp2-server.mjs 4173).
//
//   node tools/mp1-depth-study.mjs [--json=out.json] [sample ids…]
import { chromium } from "@playwright/test";
import fs from "node:fs";

const args = process.argv.slice(2);
const json = args.find((a) => a.startsWith("--json="))?.slice(7);
const ids = args.filter((a) => !a.startsWith("--"));
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
});
let rows;
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(900_000);
  await page.goto(`${base}LICENSES.md`);
  rows = await page.evaluate(
    async ({ ids }) => {
      window.__splashery = { player: { profile: "high" } };
      const mp = await import("/src/packs/moving-photo.js");
      const st = await import("/src/live/clip-stabilize.js");
      const { decodePhoto, unpackDepth } = await import("/src/packs/photo-3d.js");
      const read = async (p) => new Uint8Array(await (await fetch(p)).arrayBuffer());
      const pct = (a, q) => a[Math.floor((a.length - 1) * q)];
      // The ways to normalize. Each takes the model answers (Float32 at the model's size) and the
      // frames' colors at that size, and returns nearness 0..1 per frame.
      const stretch = (d, lo, hi) => {
        const out = new Float32Array(d.length);
        const span = Math.max(1e-6, hi - lo);
        for (let i = 0; i < d.length; i++) out[i] = Math.max(0, Math.min(1, (d[i] - lo) / span));
        return out;
      };
      const align = (raw, colors) => {
        let prev = null;
        return raw.map((d, i) => (prev = st.alignDepth(d, prev, colors[i], colors[i - 1])));
      };
      const ranges = (list) => list.map((d) => st.depthRange([d]));
      const ease = (r, k) =>
        r.map((_, i) => {
          let lo = 0,
            hi = 0,
            n = 0;
          for (let j = Math.max(0, i - k); j <= Math.min(r.length - 1, i + k); j++) {
            lo += r[j][0];
            hi += r[j][1];
            n++;
          }
          return [lo / n, hi / n];
        });
      const METHODS = {
        // Before October 10, 2026: each frame stretched to its own 2nd to 98th percentile, eased
        // over two frames each side, no alignment, no temporal filter.
        "each frame (before Oct 10)": (raw) => {
          const r = ease(ranges(raw), 2);
          return raw.map((d, i) => stretch(d, ...r[i]));
        },
        // Since October 10 (Codex task 32): aligned answers, one range for the whole clip, a
        // seven-frame temporal filter.
        "whole clip (now)": (raw, colors) => {
          const a = align(raw, colors);
          const [lo, hi] = st.depthRange(a);
          return st.filterDepths(
            a.map((d) => stretch(d, lo, hi)),
            colors,
          );
        },
        // Each frame's own range eased over a second each side: the scale follows the scene slowly.
        "rolling range (1 s)": (raw, colors, fps) => {
          const a = align(raw, colors);
          const r = ease(ranges(a), Math.round(fps));
          return st.filterDepths(
            a.map((d, i) => stretch(d, ...r[i])),
            colors,
          );
        },
        // Each frame's own range eased over two seconds each side.
        "rolling range (2 s)": (raw, colors, fps) => {
          const a = align(raw, colors);
          const r = ease(ranges(a), Math.round(2 * fps));
          return st.filterDepths(
            a.map((d, i) => stretch(d, ...r[i])),
            colors,
          );
        },
        // Lane MP1 (shipped): the rolling range, eased only inside each shot, so a cut doesn't
        // carry one shot's scale into the next.
        "rolling range in each shot (1 s)": (raw, colors, fps) => {
          const a = align(raw, colors);
          const r = st.rollingRanges(a, colors, fps);
          return st.filterDepths(
            a.map((d, i) => stretch(d, ...r[i])),
            colors,
          );
        },
        // Lane MP1: aligned answers, one range per shot (a shot ends where most of the picture
        // changes at once), the same temporal filter.
        "per shot": (raw, colors) => {
          const a = align(raw, colors);
          const r = st.shotRanges(a, colors);
          return st.filterDepths(
            a.map((d, i) => stretch(d, ...r[i])),
            colors,
          );
        },
        // Per shot, with a filter twice as wide (more steady, more smear on fast motion).
        "per shot, wide filter": (raw, colors) => {
          const a = align(raw, colors);
          const r = st.shotRanges(a, colors);
          return st.filterDepths(
            a.map((d, i) => stretch(d, ...r[i])),
            colors,
            6,
          );
        },
        // Per shot, with the model's answer on every fourth frame only and the frames between
        // interpolated (keyframes, as a long video works).
        "per shot, keyframes (every 4th)": (raw, colors) => {
          const keyed = raw.map((d, i) => {
            const a = Math.floor(i / 4) * 4;
            const b = Math.min(raw.length - 1, a + 4);
            if (a === i || a === b) return raw[a];
            const t = (i - a) / (b - a);
            return Float32Array.from(raw[a], (v, k) => v * (1 - t) + raw[b][k] * t);
          });
          const a = align(keyed, colors);
          const r = st.shotRanges(a, colors);
          return st.filterDepths(
            a.map((d, i) => stretch(d, ...r[i])),
            colors,
          );
        },
      };
      const out = [];
      for (const s of mp.SAMPLES.filter((x) => !ids.length || ids.includes(x.id))) {
        const dir = "/assets/toys/moving-photo-3d/";
        const sheets = await Promise.all(
          Array.from({ length: s.sheets }, (_, i) =>
            read(`${dir}${s.file}-sheet-${i + 1}.jpg`).then(decodePhoto),
          ),
        );
        const frames = mp.sheetFrames(sheets, s.w, s);
        const raw = mp.unpackDepths(await read(`${dir}${s.file}.depth`), unpackDepth);
        const { w: dw, h: dh } = raw[0];
        const colors = frames.map((f) => mp.shrink(f.data, s.w, s.h, dw, dh));
        const cut = st.shotStarts(colors);
        const row = { id: s.id, label: s.label, frames: raw.length, fps: s.fps, shots: cut.length };
        for (const [name, fn] of Object.entries(METHODS)) {
          const near = fn(
            raw.map((d) => d.d),
            colors,
            s.fps,
          );
          let contrast = 0;
          for (const d of near) {
            const sorted = Float32Array.from(d).sort();
            contrast += (pct(sorted, 0.95) - pct(sorted, 0.05)) / near.length;
          }
          let jitter = 0,
            pairs = 0;
          for (let f = 1; f < near.length; f++) {
            if (cut.includes(f)) continue;
            let sum = 0,
              n = 0;
            for (let i = 0; i < near[f].length; i++) {
              if (st.colorDistance(colors[f], colors[f - 1], i) > 64) continue;
              sum += Math.abs(near[f][i] - near[f - 1][i]);
              n++;
            }
            if (n) {
              jitter += sum / n;
              pairs++;
            }
          }
          jitter /= Math.max(1, pairs);
          row[name] = { contrast, jitter, ratio: jitter / Math.max(1e-6, contrast) };
        }
        out.push(row);
      }
      return out;
    },
    { ids },
  );
} finally {
  await browser.close();
}
const methods = Object.keys(rows[0]).filter((k) => typeof rows[0][k] === "object");
const f3 = (v) => v.toFixed(3);
console.log(
  `| Sample | ${methods.map((m) => `${m}: contrast / jitter / ratio`).join(" | ")} |\n` +
    `| --- | ${methods.map(() => "---").join(" | ")} |\n` +
    rows
      .map(
        (r) =>
          `| ${r.label} (${r.frames} frames, ${r.shots} shot${r.shots > 1 ? "s" : ""}) | ${methods.map((m) => `${f3(r[m].contrast)} / ${f3(r[m].jitter)} / ${f3(r[m].ratio)}`).join(" | ")} |`,
      )
      .join("\n"),
);
if (json) fs.writeFileSync(json, JSON.stringify(rows, null, 2) + "\n");
