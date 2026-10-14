// node tools/cdx-t2-measure.mjs <output.json>
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { TOYS_T2, EXCLUDED, TIERS, buildToy, measure } from "./cdx-t2-data.mjs";

const out = process.argv[2];
if (!out) throw new Error("Supply an output JSON path.");
const report = {
  source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  seed: "recipe.seed or hash32(toy id), matching the player",
  options: "recipe defaults; Auto detail; density and profile cap applied",
  excluded: EXCLUDED,
  rows: [],
};
let failures = 0;
for (const def of TOYS_T2) {
  for (const tier of TIERS) {
    const start = performance.now();
    const row = { id: def.id, pack: def.pack, shelf: def.category, tier };
    try {
      Object.assign(row, measure(await buildToy(def, tier)));
      row.prepareAndBuildMs = Math.round(performance.now() - start);
      if (row.nonFinite) failures++;
    } catch (err) {
      row.error = err.message;
      failures++;
    }
    report.rows.push(row);
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
    console.log(`${def.id} ${tier}: ${row.error || `${row.emitted} splats`}`);
  }
}
if (failures) process.exitCode = 1;
