// Reconstruct the frozen main result at its recorded margin, without rerunning readers.
// Also prove the optimized Standard renderer produces identical cells for the entire corpus.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { makeWoven } from "../../src/qr-craft/picture.js";
import { makeWoven as mainWoven } from "../../.cache/picture-qr-fidelity/main/src/qr-craft/picture.js";
import { loadPicture } from "../qrc-picture.mjs";
import { SAMPLES } from "../../src/qr-craft/samples.js";
import { circleCrop, rasterSticker } from "./captures.mjs";
import { fidelity, stickerFidelity } from "./metrics.mjs";
const root = ".cache/picture-qr-fidelity";
const corpus = [
  ...SAMPLES,
  ...JSON.parse(fs.readFileSync("tools/picture-qr-fidelity/corpus.json")),
];
const rows = fs
  .readdirSync(root)
  .filter((f) => /^main-area-\d+.jsonl$/.test(f))
  .flatMap((f) =>
    fs.readFileSync(`${root}/${f}`, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse),
  );
const out = `${root}/main-replayed.jsonl`;
fs.writeFileSync(out, "");
let pictureId, full;
for (const row of rows) {
  if (row.picture !== pictureId) {
    pictureId = row.picture;
    full = loadPicture(corpus.find((s) => s.id === pictureId).file);
  }
  const pic = row.shape === "circle" ? circleCrop(full, 17 + 4 * row.version) : full;
  const options = {
    text: row.text,
    size: "more",
    level: "H",
    center: "small",
    contrast: 0.5,
    style: "color",
    margin: row.margin,
  };
  const w = mainWoven(pic, options),
    standard = makeWoven(pic, options),
    scores = fidelity(pic, w, { shape: row.shape });
  if (w.code.version !== row.version || w.code.mask !== row.mask)
    throw Error(`${row.key}: different QR`);
  for (const scale of ["phone", "print"])
    for (const metric of ["ssim", "rmse"])
      if (Math.abs(scores[scale][metric] - row.scores[scale][metric]) > 1e-12)
        throw Error(`${row.key}: baseline fixture or metric changed`);
  const hash = (w) => createHash("sha256").update(Buffer.from(w.cells.buffer)).digest("hex");
  if (hash(w) !== hash(standard)) throw Error(`${row.key}: Standard changed`);
  if (row.shape === "circle")
    scores.sticker = stickerFidelity(full, w, rasterSticker(w, full, row.shape, 8));
  fs.appendFileSync(
    out,
    JSON.stringify({ ...row, scores, cellsSha256: hash(w), standardIdentical: true }) + "\n",
  );
  console.log(row.key);
}
