#!/usr/bin/env node
// Lane MP1: contrast and jitter (as in tools/mp1-depth-study.mjs) of a 30-second film's baked depth
// (its .mp2depth), read against the frames that tools/cdx-mp2-r4-bake.mjs saved beside its model
// answers (<raw dir>/<i>.rgba), so an old and a new cache are scored on the same still pixels.
//
//   node tools/mp1-long-depth.mjs <raw dir> <a.mp2depth> [<b.mp2depth> …]
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { colorDistance, shotStarts } from "../src/live/clip-stabilize.js";

const [raw, ...caches] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(`${raw}/manifest.json`, "utf8"));
const { w, h, n } = manifest.metadata;
const colors = Array.from({ length: n }, (_, i) => new Uint8ClampedArray(fs.readFileSync(`${raw}/${i}.rgba`))); // prettier-ignore
const cuts = new Set(shotStarts(colors));
for (const file of caches) {
  let bytes = fs.readFileSync(file);
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
  const dw = bytes.readUInt16LE(4),
    dh = bytes.readUInt16LE(6),
    count = bytes.readUInt32LE(8);
  if (dw !== w || dh !== h || count !== n) throw Error(`${file}: ${dw}x${dh}x${count}, not ${w}x${h}x${n}`); // prettier-ignore
  const frame = (f) => bytes.subarray(12 + f * w * h, 12 + (f + 1) * w * h);
  let contrast = 0,
    jitter = 0,
    pairs = 0;
  for (let f = 0; f < n; f++) {
    const s = Uint8Array.from(frame(f)).sort();
    contrast += (s[Math.floor((s.length - 1) * 0.95)] - s[Math.floor((s.length - 1) * 0.05)]) / 255 / n; // prettier-ignore
    if (!f || cuts.has(f)) continue;
    const a = frame(f),
      b = frame(f - 1);
    let sum = 0,
      m = 0;
    for (let i = 0; i < a.length; i++) {
      if (colorDistance(colors[f], colors[f - 1], i) > 64) continue;
      sum += Math.abs(a[i] - b[i]) / 255;
      m++;
    }
    if (m) {
      jitter += sum / m;
      pairs++;
    }
  }
  jitter /= Math.max(1, pairs);
  console.log(JSON.stringify({ file, frames: n, shots: cuts.size, contrast: +contrast.toFixed(3), jitter: +jitter.toFixed(4), ratio: +(jitter / contrast).toFixed(3) })); // prettier-ignore
}
