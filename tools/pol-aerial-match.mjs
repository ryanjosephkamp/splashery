#!/usr/bin/env node
// Lane Polish: evens out the color of the 3 km aerial picture of Powers of
// ten (USGS NAIP, public domain) with its neighbors in the zoom. It came out
// about a quarter brighter and grayer than both the 10 km picture around it
// (Sentinel-2) and the 1 km picture inside it (the District's orthophoto), so
// zooming in showed it as a washed-out gray square. Each channel gets one
// gain, the geometric mean of the gain that matches its whole picture to the
// middle of the 10 km one and the gain that matches its middle to the whole
// 1 km one, so both seams shrink to a few percent. The picture is then
// re-encoded at quality 90. (As shipped, October 15, 2026: gains 0.777, 0.768
// and 0.718 for red, green and blue.)
//
//   node tools/pol-aerial-match.mjs [--dry]
//
// Reads tools/pot-maps.mjs's pictures from assets/toys/powers-of-ten/ and
// rewrites aerial-3_5.jpg. tools/pot-maps.mjs runs it after fetching the
// 10 km, 3 km or 1 km picture, so a fresh fetch comes out matched too. On a
// picture already matched (every gain above 0.97) it does nothing; with --dry
// it prints the gains and writes nothing.

import fs from "node:fs";
import jpeg from "jpeg-js";
import { pathToFileURL } from "node:url";

const DIR = new URL("../assets/toys/powers-of-ten/", import.meta.url);
const read = (name) => jpeg.decode(fs.readFileSync(new URL(name, DIR)), { useTArray: true });
// The mean of each channel over the middle `f` of a picture (f = 1: all of it).
function mean(img, f = 1) {
  const s = Math.round(img.width * f);
  const o = Math.floor((img.width - s) / 2);
  const m = [0, 0, 0];
  for (let y = o; y < o + s; y++)
    for (let x = o; x < o + s; x++) for (let c = 0; c < 3; c++) m[c] += img.data[(y * img.width + x) * 4 + c]; // prettier-ignore
  return m.map((v) => v / (s * s));
}

export function matchAerial({ dry = false } = {}) {
  const step = 10 ** -0.5; // each picture is this much of the one before it
  const outer = read("aerial-4_0.jpg");
  const mid = read("aerial-3_5.jpg");
  const inner = read("aerial-3_0.jpg");
  const want = mean(outer, step);
  const whole = mean(mid);
  const middle = mean(mid, step);
  const below = mean(inner);
  const gain = [0, 1, 2].map((c) => Math.sqrt((want[c] / whole[c]) * (below[c] / middle[c])));
  console.log("aerial-3_5.jpg gains (red, green, blue):", gain.map((g) => g.toFixed(3)).join(", ")); // prettier-ignore
  if (Math.min(...gain) > 0.97) {
    console.log("Already matched; nothing to do.");
    return gain;
  }
  if (dry) return gain;
  const out = Buffer.alloc(mid.width * mid.height * 4);
  for (let i = 0; i < mid.width * mid.height; i++) {
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.max(0, Math.min(255, Math.round(mid.data[i * 4 + c] * gain[c]))); // prettier-ignore
    out[i * 4 + 3] = 255;
  }
  const enc = jpeg.encode({ data: out, width: mid.width, height: mid.height }, 90);
  fs.writeFileSync(new URL("aerial-3_5.jpg", DIR), enc.data);
  console.log(`aerial-3_5.jpg: ${(enc.data.length / 1024).toFixed(0)} KB (color-matched)`);
  return gain;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  matchAerial({ dry: process.argv.includes("--dry") });
