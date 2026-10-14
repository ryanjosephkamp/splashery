// Task 54, second sweep: measured print failures motivate lower chroma and balanced midtones.
import fs from "node:fs";
import {
  generate,
  save,
  load,
  detail,
  properties,
  trials,
  FAMILIES,
  OPTIONS,
  TEXT,
} from "./cdx-pics-qr.mjs";
import { makeWoven } from "../src/qr-craft/picture.js";
const file = "docs/audits/sample-pictures-2026-10/qr-scores.json";
const rows = JSON.parse(fs.readFileSync(file));
for (let f = 0; f < 9; f++)
  for (let v = 0; v < 8; v++) {
    const id = `cdx-qr-print-${f + 1}-${v + 1}`;
    if (rows.some((r) => r.id === id)) continue;
    const path = `.cache/cdx-pics/qr/${id}.jpg`;
    save(generate(f, v, 960, null, true), path);
    const pic = load(path),
      w = makeWoven(pic, OPTIONS);
    const scans = [...trials(pic), ...trials(pic, { ...OPTIONS, size: "fit" }, [TEXT])];
    rows.push({
      id,
      label: `${FAMILIES[f]} soft ${v + 1}`,
      family: FAMILIES[f],
      variant: v,
      series: "balanced, low chroma",
      ...detail(pic, w),
      properties: properties(pic),
      scans,
      eligible: scans.filter((s) => s.text === TEXT).every((s) => s.ok),
      kept: false,
    });
    fs.writeFileSync(file, JSON.stringify(rows, null, 2) + "\n");
    console.log(`${id}: ${rows.at(-1).score.toFixed(2)}, eligible ${rows.at(-1).eligible}`);
  }
console.log(`${rows.length} total candidates.`);
