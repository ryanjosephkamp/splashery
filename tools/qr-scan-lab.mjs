#!/usr/bin/env node
// QR scan lab: does every splat QR code scan? Renders codes (the QR toy, or reference codes
// drawn from a pinned encoder), makes simulated phone captures of each and decodes them with
// two readers (jsQR and zxing-js). Appends one row per capture to a CSV.
//
//   node tools/qr-scan-lab.mjs [--source=reference|toy] [--styles=a,b] [--ec=L,M,Q,H]
//     [--schemes=preset,pastel] [--texts=short,url,long] [--cond=front,tilt20] [--tag=name]
//     [--out=tools/qr-scan-lab/data] [--poses=yaw10,pitch20] [--cam-styles=...] [--px=1024]
//
// Output: <out>/<source>-<tag>-results.csv. Each row: the render (style, ec, scheme, text), the
// kind of capture (warp = a 2D phone-capture simulation of the flat render; cam = the toy's own
// camera turned in 3D, then shrunk the same way), the condition, and the readers' results:
// 0 = no read, 1 = the right text, 2 = the wrong text. jsqr/zxing are the plain passes; jsqr_inv
// and zxing_inv also try inverted codes (jsQR attemptBoth, zxing on the inverted image).
// The toy source needs the local server (python3 -m http.server 4173 --bind 127.0.0.1, from the
// toy's tree) and SPLASHERY_CHROMIUM.

import fs from "node:fs";
import path from "node:path";
import { applyCondition, conditions, resize } from "./qr-scan-lab/sim.mjs";
import { readers, invertedReaders } from "./qr-scan-lab/readers.mjs";
import {
  REF_STYLES,
  REF_SCHEMES,
  renderReference,
  contrastRatio,
} from "./qr-scan-lab/reference.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const source = opt("source", "reference");
const TEXTS = {
  short: "https://t.co/Ab12Cd",
  url: "https://ryanjosephkamp.github.io/splashery/",
  long: "https://ryanjosephkamp.github.io/splashery/?scene=lighthouse&mode=night&from=qr-lab-test&utm=morning-run",
};
const textIds = opt("texts", "url").split(",");
const outDir = opt("out", "tools/qr-scan-lab/data");
const tag = opt("tag", "all");
const ecs = opt("ec", "auto").split(",");
const defaultSchemes =
  source === "toy"
    ? "preset,pastel,gray,gradient,eyes,inverted"
    : Object.keys(REF_SCHEMES).join(",");
const schemeNames = opt("schemes", defaultSchemes).split(",");
const condFilter = opt("cond", "");
const conds = conditions().filter((c) => !condFilter || condFilter.split(",").includes(c.id));
fs.mkdirSync(outDir, { recursive: true });

async function makeSource() {
  if (source === "reference") {
    return {
      styles: opt("styles", REF_STYLES.join(",")).split(","),
      render: async (job, text) => ({ ...renderReference({ text, ...job }), cams: [] }),
      close: async () => {},
    };
  }
  const { toySource } = await import("./qr-scan-lab/toy-source.mjs");
  return toySource({ opt });
}

const file = path.join(outDir, `${source}-${tag}-results.csv`);
const HEAD =
  "source,style,ec,scheme,text,contrast,version,kind,condition,group,jsqr,zxing,jsqr_inv,zxing_inv";
fs.writeFileSync(file, HEAD + "\n");
const src = await makeSource();
const t0 = Date.now();
let count = 0;
const readAll = (img, expected) => {
  const res = {};
  for (const name of Object.keys(readers)) {
    const code = (got) => (got === expected ? 1 : got ? 2 : 0);
    res[name] = code(readers[name](img));
    res[`${name}_inv`] = res[name] === 1 ? 1 : code(invertedReaders[name](img));
  }
  return res;
};
for (const style of src.styles) {
  for (const ec of ecs) {
    for (const scheme of schemeNames) {
      for (const tid of textIds) {
        const text = TEXTS[tid] ?? tid;
        const job = { style, ec, scheme };
        let r;
        try {
          r = await src.render(job, text);
        } catch (e) {
          console.error(`skip ${style}/${ec}/${scheme}/${tid}: ${e.message}`);
          continue;
        }
        const cr = r.contrast ?? contrastRatio(REF_SCHEMES[scheme].fg, REF_SCHEMES[scheme].bg);
        const lines = [];
        const push = (kind, condition, group, res) =>
          lines.push(
            [
              source,
              style,
              ec,
              scheme,
              tid,
              cr.toFixed(2),
              r.version,
              kind,
              condition,
              group,
              res.jsqr,
              res.zxing,
              res.jsqr_inv,
              res.zxing_inv,
            ].join(","),
          );
        for (const c of conds)
          push("warp", c.id, c.group, readAll(applyCondition(r.img, r.modules, c), text));
        // The toy's own camera, turned in 3D: read as shot, then shrunk to 8 and 4 px per module.
        for (const cam of r.cams) {
          for (const px of [0, 8, 4]) {
            const img = px ? resize(cam.img, px * r.camModules) : cam.img;
            push("cam", `${cam.id}@${px || "full"}`, "3d", readAll(img, text));
          }
        }
        fs.appendFileSync(file, lines.join("\n") + "\n");
        count += lines.length;
      }
    }
    console.error(
      `${style} ${ec} done, ${count} captures, ${((Date.now() - t0) / 1000).toFixed(0)} s`,
    );
  }
}
await src.close();
console.error(`wrote ${count} rows to ${file}`);
