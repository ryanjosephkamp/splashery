#!/usr/bin/env node
// Lane MP1: brings tools/assets.json up to date with Moving photo to 3D's 30-second films (cut again
// from their masters and baked again, plus two new films) and the short bunny's own MP3: each file's
// byte count and SHA-256 (and a depth cache's decoded ones), its distinct depth frames, and a note.
//   node tools/mp1-records.mjs
import fs from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { LONG_SAMPLES } from "../src/packs/moving-photo.js";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const dir = "assets/toys/moving-photo-3d";
const assets = JSON.parse(fs.readFileSync("tools/assets.json", "utf8"));
const list = assets.movingSamples;
const at = (id) => list.findIndex((a) => a.id === id && a.toy === "moving-photo-3d");
const DATE = "October 17, 2026";
const NEW = {
  "forest-long": { author: "Blender Foundation / Blender Institute (Gooseberry)", page: "https://archive.org/details/CosmosLaundromatFirstCycle", master: "Cosmos Laundromat - First Cycle (1080p).mp4, 1920 by 804" }, // prettier-ignore
  "camp-long": { author: "Blender Studio", page: "https://archive.org/details/sprite-fright", master: "Sprite Fright - Open Movie by Blender Studio-804p.mp4, 1920 by 804" }, // prettier-ignore
};
for (const s of LONG_SAMPLES) {
  const webm = `${dir}/${s.file}.webm`,
    cache = `${dir}/${s.file}.mp2depth`;
  const v = fs.readFileSync(webm),
    c = fs.readFileSync(cache),
    d = gunzipSync(c);
  const w = d.readUInt16LE(4),
    h = d.readUInt16LE(6),
    n = d.readUInt32LE(8);
  const frames = new Set();
  for (let i = 0; i < n; i++) frames.add(sha(d.subarray(12 + i * w * h, 12 + (i + 1) * w * h)));
  const files = [
    { file: webm, bytes: v.length, sha256: sha(v) },
    { file: cache, bytes: c.length, sha256: sha(c), decodedBytes: d.length, decodedSha256: sha(d) },
  ];
  const how = `Lane MP1 (${DATE}): cut from the master at ${s.cut.url} by tools/cdx-mp2-samples.mjs --video-only (only the parts used are read over the network, re-encoded near-losslessly, then encoded as VP9 960 pixels wide with Opus sound at ${s.fps} frames a second, ${n} frames); depth baked again by tools/cdx-mp2-r4-bake.mjs from every frame (Depth Anything V2 Small at a 196-pixel model side, ${w} by ${h}), with a rolling one-second depth range in each shot and the color-gated half-second filter, gzip-compressed. The film and its derived depth keep the film's CC BY license.`; // prettier-ignore
  const i = at(s.id);
  if (i >= 0) {
    const r = list[i];
    r.checked = DATE;
    r.files = files;
    r.depthFrames = n;
    r.distinctDepthFrames = frames.size;
    r.note = `${how} Until then it was cut from the archive's 240-pixel copy. Earlier: ${r.note}`;
  } else {
    const x = NEW[s.id];
    const r = {
      id: s.id,
      file: webm,
      path: cache,
      toy: "moving-photo-3d",
      name: s.title,
      author: x.author,
      page: x.page,
      license: s.license,
      checked: DATE,
      files,
      note: `${how} Master: ${x.master}. License: Blender Studio's terms (https://studio.blender.org/terms-and-conditions/) put its films under CC BY 4.0, and the archive record says CC BY 4.0. Explicitly picked; nothing loads until it is.`, // prettier-ignore
      depthFrames: n,
      distinctDepthFrames: frames.size,
    };
    const last = Math.max(...LONG_SAMPLES.map((l) => at(l.id)));
    list.splice(last + 1, 0, r);
  }
}
// The short bunny's sound.
const mp3 = fs.readFileSync(`${dir}/bunny.mp3`);
const b = list[at("bunny")];
b.sound = { file: `${dir}/bunny.mp3`, bytes: mp3.length, sha256: sha(mp3) };
if (!/bunny\.mp3/.test(b.note))
  b.note += ` Lane MP1 (${DATE}): its sound is now its own 56 kbps mono MP3 (bunny.mp3, the same six seconds of assets/toys/screen/bunny.mp4), as the other samples have, so its Sharp view no longer reads a playing video.`; // prettier-ignore
fs.writeFileSync("tools/assets.json", JSON.stringify(assets, null, 2) + "\n");
console.log("tools/assets.json updated");
