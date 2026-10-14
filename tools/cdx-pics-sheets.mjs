// Task 54: QR evidence images, with the production encoder, not an illustration.
import fs from "node:fs";
import { PNG } from "pngjs";
import { makeWoven, rasterize } from "../src/qr-craft/picture.js";
import { load, OPTIONS } from "./cdx-pics-qr.mjs";
const rows = JSON.parse(fs.readFileSync("docs/audits/sample-pictures-2026-10/qr-scores.json"));
fs.mkdirSync(".cache/cdx-pics/woven", { recursive: true });
for (const r of rows.filter((r) => r.kept)) {
  const w = makeWoven(load(r.file), OPTIONS),
    p = rasterize(w, 360 / (w.code.size + 8));
  fs.writeFileSync(
    `.cache/cdx-pics/woven/${r.id}.png`,
    PNG.sync.write({ width: p.width, height: p.height, data: Buffer.from(p.data) }),
  );
}
