// MIT. Download the pinned, CC BY 4.0 diagnostic capture outside tracked assets.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const args = Object.fromEntries(process.argv.slice(2).map((v) => v.replace(/^--/, "").split("=")));
if (args.help) {
  console.log(
    "node tools/photos3d-fetch.mjs [--out=.cache/photos3d/buddha]\nDownloads 24 original PNGs (about 105 MB); verifies every SHA-256 against tools/assets.json. Photos stay out of git.",
  );
} else {
  const assets = JSON.parse(await fs.readFile("tools/assets.json", "utf8"));
  const record = assets.photos3dBenchmarks.find((r) => r.id === "alicevision-buddha-24");
  if (!record || record.license !== "CC-BY-4.0" || record.files.length !== 24)
    throw new Error("Missing frozen dataset record");
  const out = path.resolve(args.out || ".cache/photos3d/buddha");
  await fs.mkdir(out, { recursive: true });
  const pending = [...record.files];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (pending.length) {
        const file = pending.shift();
        if (path.basename(file.name) !== file.name || !/^[a-f0-9]{64}$/.test(file.sha256))
          throw new Error("Invalid file record");
        const target = path.join(out, file.name);
        let bytes;
        try {
          bytes = await fs.readFile(target);
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
        const hash = (b) => createHash("sha256").update(b).digest("hex");
        if (!bytes || hash(bytes) !== file.sha256) {
          const response = await fetch(file.source, { signal: AbortSignal.timeout(120000) });
          if (!response.ok) throw new Error(`Download ${file.name}: HTTP ${response.status}`);
          bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length !== file.bytes || hash(bytes) !== file.sha256)
            throw new Error(`Checksum mismatch: ${file.name}`);
          await fs.writeFile(target, bytes);
        }
      }
    }),
  );
  await fs.writeFile(path.join(out, "manifest.json"), JSON.stringify(record, null, 2) + "\n");
  console.log(
    `Verified ${record.files.length} original photos in ${out}; ${record.author}; ${record.license}.`,
  );
}
