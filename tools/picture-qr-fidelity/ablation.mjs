// Reproducible candidate comparison. These variants never change the toy's default.
import fs from "node:fs";
import { makeWoven, weave } from "../../src/qr-craft/picture.js";
import { makeWoven as mainWoven } from "../../.cache/picture-qr-fidelity/main/src/qr-craft/picture.js";
import { weaveDetail, projectHalftone, finishDetail } from "../../src/qr-craft/detail.js";
import { fitPadding } from "../../src/qr/picture-padding.js";
import { shapeHalf } from "../../src/qr/circle.js";
import { loadBlurKernel } from "../../src/qr-craft/fast-blur.js";
import { continuous, recolor } from "./experiments.mjs";
import { read } from "../qrc-picture.mjs";
import { loadBrowserSource } from "./sources.mjs";
import { readZxingCpp } from "../qrs-study/readers.mjs";
import { SAMPLES } from "../../src/qr-craft/samples.js";
import { LINKS } from "../cdx-circle-study.mjs";
import { fidelity, stickerFidelity } from "./metrics.mjs";
import { circleCrop, rasterSticker, conditionImage, CONDITIONS } from "./captures.mjs";
await loadBlurKernel(fs.readFileSync("src/qr-craft/blur.wasm"));
const ids = [
  "ai-farm",
  "ai-arch",
  "wildflowers",
  "forest",
  "cdx-qr-ai-fern",
  "cdx-qr-ai-cactus",
  "met-436305",
  "met-244130",
];
const corpus = [
  ...SAMPLES,
  ...JSON.parse(fs.readFileSync("tools/picture-qr-fidelity/corpus.json")),
].filter((s) => ids.includes(s.id));
const out = ".cache/picture-qr-fidelity/ablation-640.jsonl";
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
for (const picture of corpus)
  for (const link of [0, 6])
    for (const shape of ["square", "circle"]) {
      const full = loadBrowserSource(picture.id),
        o = {
          text: LINKS[link],
          level: "H",
          size: "more",
          center: "small",
          contrast: 0.5,
          style: "color",
          shape,
        };
      const size = mainWoven(full, o).code.size,
        src = shape === "circle" ? circleCrop(full, size) : full;
      const main = mainWoven(src, o, read),
        padded = fitPadding(main.code, src);
      const edge =
        0.24 +
        Math.min(0.08, Math.max(0, 8 - 720 / (2 * (shapeHalf(main.code, shape) + 1))) * 0.04);
      const methods = {
        main: () => main,
        "continuous-fixed": () => continuous(main.code, src, { ...o, margin: 0.1 }),
        "continuous-adaptive": () =>
          continuous(main.code, src, { ...o, margin: 0.1, adaptive: true }),
        "center-only": () =>
          continuous(main.code, src, { ...o, margin: 0.1, adaptive: true, area: false }),
        "chroma-restoration": () => recolor(main, src),
        "padding-halftone": () => weave(padded, src, { ...o, margin: 0.1 }),
        "padding-halftone-camera": () =>
          projectHalftone(
            finishDetail(weave(padded, src, { ...o, margin: 0.1 }), { finderEdge: edge }),
            { ...o, margin: 0.1, finderEdge: edge },
          ),
        "camera-footprint": () =>
          weaveDetail(main.code, src, { ...o, margin: 0.1, finderEdge: edge }),
        "padding-camera": () => weaveDetail(padded, src, { ...o, margin: 0.1, finderEdge: edge }),
        "one-cell-modules": () =>
          weaveDetail(padded, src, { ...o, margin: 0.1, finderEdge: edge, grid: 1 }),
        "larger-version": () => {
          const p = mainWoven(full, { ...o, size: "most" });
          return mainWoven(
            shape === "circle" ? circleCrop(full, p.code.size) : full,
            { ...o, size: "most" },
            read,
          );
        },
        "most-detail": () => makeWoven(full, { ...o, fidelity: "detail" }, read),
      };
      for (const [variant, build] of Object.entries(methods)) {
        const key = `${picture.id}/${link}/${shape}/${variant}`;
        if (done.has(key)) continue;
        const start = performance.now(),
          w = build(),
          ms = performance.now() - start;
        const reference = shape === "circle" ? circleCrop(full, w.code.size) : full,
          scores = fidelity(reference, w, { shape }),
          scans = [];
        for (const ppm of [8, 4]) {
          const sticker = rasterSticker(w, full, shape, ppm);
          if (shape === "circle" && ppm === 8) scores.sticker = stickerFidelity(full, w, sticker);
          for (const c of CONDITIONS.filter((c) => c.ppm === ppm)) {
            const img = conditionImage(sticker, w, shape, c);
            scans.push({
              condition: c.id,
              jsqr: read(img.data, img.width, img.height) === o.text,
              zxingcpp: (await readZxingCpp(img)) === o.text,
            });
          }
        }
        const row = {
          key,
          picture: picture.id,
          link,
          shape,
          variant,
          ms,
          version: w.code.version,
          rendering: w.rendering,
          encodedSplats: 2 * w.G * w.G - 2 * w.G + 1,
          scores,
          scans,
        };
        fs.appendFileSync(out, JSON.stringify(row) + "\n");
        console.log(key, scans.filter((s) => s.jsqr && s.zxingcpp).length + "/24");
      }
    }
