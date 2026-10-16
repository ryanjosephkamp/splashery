#!/usr/bin/env node
// Live license pages were opened on October 12, 2026. These are new captures, not variations
// of the original Liberty and Edinburgh samples. Recheck each live license before a new bake.
// Import CAPTURES for provenance, or run this tool to reproduce the silent source clips:
// node tools/cdx-v3d-sample-sources.mjs <scratch-directory> [id ...]
// Then bake a downloaded full capture with cdx-v3d-sample-bake.mjs and its span below.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const CAPTURES = [
  {
    id: "adjara",
    label: "Forest path, walked",
    title: "Adjara2025walking-summer-forest",
    author: "Vitaly Zdanevich",
    source: "https://commons.wikimedia.org/wiki/File:Adjara2025walking-summer-forest.webm",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    licenseText: "Attribution 4.0 International",
    captureUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e8/Adjara2025walking-summer-forest.webm/Adjara2025walking-summer-forest.webm.480p.vp9.webm", // prettier-ignore
    captureSha256: "1b9c0dd6c01d06e686e12490d30c8a08844e5033254c4507d49cd16d1de9fb88",
    length: 118.919,
    span: { start: 0, length: 20 },
  },
  {
    id: "lihula",
    label: "Ruined courtyard, flown over",
    title: "Drone video of ruins of Lihula stronghold, the manor and town (august 2021)",
    author: "Sillerkiil",
    source: "https://commons.wikimedia.org/wiki/File:Drone_video_of_ruins_of_Lihula_stronghold,_the_manor_and_town_(august_2021).webm", // prettier-ignore
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    licenseText: "CC0 1.0 Universal Public Domain Dedication",
    captureUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c9/Drone_video_of_ruins_of_Lihula_stronghold%2C_the_manor_and_town_%28august_2021%29.webm/Drone_video_of_ruins_of_Lihula_stronghold%2C_the_manor_and_town_%28august_2021%29.webm.720p.vp9.webm", // prettier-ignore
    captureSha256: "26493a12ae7a0d8f5597cda4cdc3d82b2cd42a031d1a76fbec70634373a41430",
    length: 52.152,
    span: { start: 18, length: 20 },
  },
  {
    id: "toolse",
    label: "Coastal ruins, drone pass",
    title: "Toolse castle in Estonia (Fall 2021)",
    author: "Sillerkiil",
    source: "https://commons.wikimedia.org/wiki/File:Toolse_castle_in_Estonia_(Fall_2021).webm",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    licenseText: "Attribution-Share Alike 4.0 International",
    captureUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f5/Toolse_castle_in_Estonia_%28Fall_2021%29.webm/Toolse_castle_in_Estonia_%28Fall_2021%29.webm.720p.vp9.webm", // prettier-ignore
    captureSha256: "7af5c3242045fc56d7d2c6b954b7ea0721f2ee4c31ef4dabcf1f3217d9c884f3",
    length: 114.284,
    span: { start: 14, length: 20 },
  },
  {
    id: "poltsamaa",
    label: "Castle courtyard, orbited",
    title: "Drone video of Põltsamaa river and castle in Estonia",
    author: "Sillerkiil",
    source:
      "https://commons.wikimedia.org/wiki/File:Drone_video_of_P%C3%B5ltsamaa_river_and_castle_in_Estonia.webm",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    licenseText: "Attribution-Share Alike 4.0 International",
    captureUrl:
      "https://upload.wikimedia.org/wikipedia/commons/transcoded/6/62/Drone_video_of_P%C3%B5ltsamaa_river_and_castle_in_Estonia.webm/Drone_video_of_P%C3%B5ltsamaa_river_and_castle_in_Estonia.webm.1080p.vp9.webm",
    captureSha256: "5b2e98a8b875175840f15b335a9c324ffc9a5f2e44b226cb10cf48850bc1d06b",
    length: 50.44,
    span: { start: 24, length: 20 },
  },
].map((s) => ({ ...s, checked: "October 12, 2026" }));

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [scratch, ...ids] = process.argv.slice(2);
  if (!scratch) throw new Error("Usage: cdx-v3d-sample-sources.mjs <scratch-directory> [id ...]");
  fs.mkdirSync(scratch, { recursive: true });
  const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
  for (const s of CAPTURES.filter((s) => !ids.length || ids.includes(s.id))) {
    const page = execFileSync("curl", ["-fsSL", "-A", "Mozilla/5.0", s.source], { maxBuffer: 4e6 }).toString(); // prettier-ignore
    if (!page.includes(s.licenseText)) throw new Error(`Recheck the changed license page: ${s.source}`); // prettier-ignore
    const capture = path.join(scratch, `${s.id}-capture.webm`);
    if (!fs.existsSync(capture)) execFileSync("curl", ["-fsSL", "--retry", "3", "-A", "Mozilla/5.0", "-o", capture, s.captureUrl]); // prettier-ignore
    if (sha256(fs.readFileSync(capture)) !== s.captureSha256)
      throw new Error(`Capture bytes changed: review ${s.source} before baking.`);
    const out = `assets/toys/video-3d/${s.id}-source`;
    execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-ss", String(s.span.start), "-i", capture, "-t", String(s.span.length), "-an", "-vf", "scale=-2:480,fps=24", "-c:v", "libvpx-vp9", "-crf", "35", "-b:v", "0", "-row-mt", "1", `${out}.webm`]); // prettier-ignore
    execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", `${out}.webm`, "-an", "-c:v", "libx264", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${out}.mp4`]); // prettier-ignore
    console.log(`${s.id}: ${s.span.length} seconds from ${s.span.start}; ${s.license}; capture hash verified`); // prettier-ignore
  }
}
