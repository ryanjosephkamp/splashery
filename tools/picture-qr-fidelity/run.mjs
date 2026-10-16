import { createHash } from "node:crypto";
import { encodeQR } from "../../src/qr/encode.js";
// Fixed, resumable comparison. Keep the same baseline SHA, corpus, and conditions between runs.
import fs from "node:fs";
import { loadBlurKernel } from "../../src/qr-craft/fast-blur.js";
import { pathToFileURL } from "node:url";
import { loadPicture, read } from "../qrc-picture.mjs";
import { SAMPLES } from "../../src/qr-craft/samples.js";
import { LINKS as STUDY_LINKS } from "../cdx-circle-study.mjs";
import { readZxingCpp } from "../qrs-study/readers.mjs";
import { fidelity, stickerFidelity } from "./metrics.mjs";
import { rasterSticker, conditionImage, CONDITIONS, circleCrop } from "./captures.mjs";
const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const modulePath = arg("module", "src/qr-craft/picture.js"),
  { makeWoven } = await import(pathToFileURL(`${process.cwd()}/${modulePath}`));
const name = arg("name", "main"),
  shard = Number(arg("shard", "0")),
  shards = Number(arg("shards", "1"));
if (arg("fidelity", "standard") === "detail")
  await loadBlurKernel(fs.readFileSync("src/qr-craft/blur.wasm"));
export const LINKS = STUDY_LINKS.slice(0, 10);
const corpus = [
  ...SAMPLES,
  ...JSON.parse(fs.readFileSync("tools/picture-qr-fidelity/corpus.json")),
];
const out = `.cache/picture-qr-fidelity/${name}-${shard}.jsonl`;
const done = new Set(
  fs.existsSync(out)
    ? fs
        .readFileSync(out, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((s) => JSON.parse(s).key)
    : [],
);
let index = 0;
for (const [pictureIndex, picture] of corpus.entries()) {
  if (pictureIndex % shards !== shard) continue;
  const pic = loadPicture(picture.file);
  for (const [link, text] of LINKS.entries())
    for (const shape of ["square", "circle"]) {
      const key = `${picture.id}/${link}/${shape}`;
      if (done.has(key)) continue;
      const o = {
        fidelity: arg("fidelity", "standard"),
        shape,
        text,
        size: "more",
        level: "H",
        center: "small",
        contrast: 0.5,
        style: "color",
      };
      const version = Math.min(40, encodeQR(text, o.level, { boost: false }).version + 4);
      const src = shape === "circle" ? circleCrop(pic, 17 + 4 * version) : pic;
      const start = performance.now(),
        w = makeWoven(o.fidelity === "detail" ? pic : src, o, read),
        ms = performance.now() - start;
      const scores = fidelity(src, w, { shape }),
        scans = [];
      for (const ppm of [8, 4]) {
        const sticker = rasterSticker(w, pic, shape, ppm);
        if (shape === "circle" && ppm === 8) scores.sticker = stickerFidelity(pic, w, sticker);
        for (const c of CONDITIONS.filter((c) => c.ppm === ppm)) {
          const img = conditionImage(sticker, w, shape, c);
          scans.push({
            condition: c.id,
            jsqr: read(img.data, img.width, img.height) === text,
            zxingcpp: (await readZxingCpp(img)) === text,
          });
        }
      }
      const row = {
        key,
        picture: picture.id,
        link,
        text,
        shape,
        version: w.code.version,
        mask: w.code.mask,
        rotation: w.code.rotation || 0,
        rendering: w.rendering,
        detailCheck: w.detailCheck,
        cellsSha256: createHash("sha256").update(Buffer.from(w.cells.buffer)).digest("hex"),
        margin: w.margin,
        ms,
        scores,
        scans,
      };
      fs.appendFileSync(out, JSON.stringify(row) + "\n");
      console.log(
        `${++index} ${key} SSIM=${scores.phone.ssim.toFixed(4)} scans=${scans.filter((s) => s.jsqr && s.zxingcpp).length}/${scans.length} ${Math.round(ms)}ms`,
      );
    }
}
