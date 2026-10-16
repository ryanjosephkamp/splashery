// Lossless cache replacement. Run with Node 22; original films stay untouched.
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { LONG_SAMPLES, unpackSampleDepth } from "../src/packs/moving-photo.js";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex"),
  assets = JSON.parse(await fs.readFile("tools/assets.json", "utf8")),
  report = { encoding: "gzip (lossless MP2D)", node: process.version, caches: [] };
for (const sample of LONG_SAMPLES) {
  const file = `assets/toys/moving-photo-3d/${sample.file}.mp2depth`,
    before = await fs.readFile(file),
    decoded = await unpackSampleDepth(before),
    packed = gzipSync(decoded, { level: 9 }),
    restored = await unpackSampleDepth(packed);
  if (sha(restored) !== sha(decoded)) throw Error(`Lossless round trip failed: ${file}`);
  const record = {
    file,
    beforeBytes: before.length,
    beforeSha256: sha(before),
    afterBytes: packed.length,
    afterSha256: sha(packed),
    decodedBytes: decoded.length,
    decodedSha256: sha(decoded),
    changedDepthBytes: 0,
  };
  report.caches.push(record);
  const asset = assets.movingSamples.find((asset) => asset.path === file),
    entry = asset?.files?.find((entry) => entry.file === file);
  if (!entry) throw Error(`Missing asset record: ${file}`);
  entry.bytes = packed.length;
  entry.sha256 = record.afterSha256;
  entry.decodedBytes = decoded.length;
  entry.decodedSha256 = record.decodedSha256;
  const note =
    " Losslessly gzip-compressed by tools/cdx-mp2-r4-compress.mjs; unpacking restores every original MP2D byte, with unchanged depth resolution, precision, frame count, and license.";
  if (!asset.note.includes("Losslessly gzip-compressed")) asset.note += note;
  await fs.writeFile(`${file}.tmp`, packed);
  await fs.rename(`${file}.tmp`, file);
}
await fs.writeFile("tools/assets.json", JSON.stringify(assets, null, 2) + "\n");
await fs.mkdir("work", { recursive: true });
await fs.writeFile("work/r4-cache-compression.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
