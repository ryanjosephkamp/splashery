// Task 54, third sweep: an explicit default-payload luminance carrier under original color shapes.
// This is a purpose-built procedural pattern, not a payload-neutral photograph.
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
import {
  makeWoven,
  fitMask,
  plainModules,
  gray,
  toDark,
  toLight,
} from "../src/qr-craft/picture.js";
import { encodeQR } from "../src/qr/encode.js";
const file = "docs/audits/sample-pictures-2026-10/qr-scores.json";
const rows = JSON.parse(fs.readFileSync(file));
for (let f = 0; f < 9; f++)
  for (let v = 0; v < 8; v++) {
    const id = `cdx-qr-grid-${f + 1}-${v + 1}`;
    if (rows.some((r) => r.id === id)) continue;
    const path = `.cache/cdx-pics/qr/${id}.jpg`,
      pic = generate(f, v, 960);
    const min = encodeQR(TEXT, "H", { boost: false }).version + 4;
    const code = fitMask(TEXT, "H", pic, { min }),
      plain = plainModules(code);
    const strength = 0.19 + v * 0.022;
    for (let y = 0; y < pic.h; y++)
      for (let x = 0; x < pic.w; x++) {
        const i = (y * pic.w + x) * 3,
          c = Array.from(pic.data.subarray(i, i + 3));
        const m =
          Math.min(code.size - 1, Math.floor((y / pic.h) * code.size)) * code.size +
          Math.min(code.size - 1, Math.floor((x / pic.w) * code.size));
        if (plain[m]) continue; // keep the source free of finder eyes or a readable source QR
        const g = gray(c),
          target = 0.5 + (code.dark[m] ? -strength : strength) + 0.08 * (g - 0.5);
        const next = g > target ? toDark(c, target) : toLight(c, target);
        pic.data.set(next, i);
      }
    save(pic, path);
    const actual = load(path),
      w = makeWoven(actual, OPTIONS);
    const scans = [...trials(actual), ...trials(actual, { ...OPTIONS, size: "fit" }, [TEXT])];
    rows.push({
      id,
      label: `${FAMILIES[f]} grid ${v + 1}`,
      family: FAMILIES[f],
      variant: v,
      series: "default-URL luminance carrier",
      carrier: {
        text: TEXT,
        level: "H",
        size: "more",
        mask: code.mask,
        strength,
        excludePlainPatterns: true,
      },
      storedImageDetail: detail(actual, w),
      baseReference: `cdx-qr-${f + 1}-${v + 1}`,
      ...detail(load(`.cache/cdx-pics/qr/cdx-qr-${f + 1}-${v + 1}.jpg`), w),
      properties: properties(actual),
      scans,
      eligible: scans.filter((s) => s.text === TEXT).every((s) => s.ok),
      kept: false,
    });
    fs.writeFileSync(file, JSON.stringify(rows, null, 2) + "\n");
    console.log(`${id}: ${rows.at(-1).score.toFixed(2)}, eligible ${rows.at(-1).eligible}`);
  }
console.log(`${rows.length} total candidates.`);
