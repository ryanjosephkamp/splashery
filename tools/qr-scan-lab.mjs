#!/usr/bin/env node
// QR scan lab: does every splat QR code scan? Renders codes (the QR toy, or reference codes
// drawn from a pinned encoder), makes simulated phone captures of each and decodes them with
// two readers (jsQR and zxing-js). Writes one row per capture.
//
//   node tools/qr-scan-lab.mjs [--source=reference|toy] [--styles=a,b] [--ec=L,M,Q,H]
//     [--schemes=bw,navy] [--text=...] [--out=tools/qr-scan-lab/data] [--cond=front,tilt20]
//     [--grid] [--seeds=1]
//
// Output: <out>/<source>-results.csv and <source>-summary.json (decode rate per style, ec,
// scheme and condition). --grid also writes one contact PNG per style. The toy source needs
// the local server (python3 -m http.server 4173 --bind 127.0.0.1) and SPLASHERY_CHROMIUM.

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { applyCondition, conditions } from "./qr-scan-lab/sim.mjs";
import { readers } from "./qr-scan-lab/readers.mjs";
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
const flag = (name) => args.includes(`--${name}`);
const source = opt("source", "reference");
const text = opt("text", "https://ryanjosephkamp.github.io/splashery/");
const outDir = opt("out", "tools/qr-scan-lab/data");
const ecs = opt("ec", "L,M,Q,H").split(",");
const schemeNames = opt("schemes", Object.keys(REF_SCHEMES).join(",")).split(",");
const condFilter = opt("cond", "");
const conds = conditions().filter((c) => !condFilter || condFilter.split(",").includes(c.id));
fs.mkdirSync(outDir, { recursive: true });

// Each renderer yields { img, modules, version } for a (style, ec, scheme) job.
async function makeSource() {
  if (source === "reference") {
    return {
      styles: opt("styles", REF_STYLES.join(",")).split(","),
      render: async (job) => renderReference({ text, ...job }),
      close: async () => {},
    };
  }
  const { toySource } = await import("./qr-scan-lab/toy-source.mjs");
  return toySource({ text, opt });
}

const src = await makeSource();
const rows = [];
const t0 = Date.now();
const gridShots = {};
for (const style of src.styles) {
  for (const ec of ecs) {
    for (const scheme of schemeNames) {
      const job = { style, ec, scheme };
      let r;
      try {
        r = await src.render(job);
      } catch (e) {
        console.error(`skip ${style}/${ec}/${scheme}: ${e.message}`);
        continue;
      }
      const cr = r.contrast ?? contrastRatio(REF_SCHEMES[scheme].fg, REF_SCHEMES[scheme].bg);
      for (const c of conds) {
        const img = applyCondition(r.img, r.modules, c);
        const res = {};
        for (const [name, read] of Object.entries(readers)) {
          const t = Date.now();
          const got = read(img);
          res[name] = got === text ? 1 : got ? 2 : 0; // 2 = decoded the wrong text
          res[`${name}_ms`] = Date.now() - t;
        }
        rows.push({
          source,
          style,
          ec,
          scheme,
          contrast: cr.toFixed(2),
          version: r.version,
          condition: c.id,
          group: c.group,
          ...res,
        });
        if (flag("grid") && ec === ecs[0] && (scheme === schemeNames[0] || !gridShots[style]))
          (gridShots[style] ??= []).push({ c, scheme, img, ok: res.jsqr === 1 && res.zxing === 1 });
      }
    }
  }
  console.error(
    `${style} done, ${rows.length} captures, ${((Date.now() - t0) / 1000).toFixed(0)} s`,
  );
}
await src.close();

const csv = ["source,style,ec,scheme,contrast,version,condition,group,jsqr,zxing,jsqr_ms,zxing_ms"];
for (const r of rows)
  csv.push(
    [
      r.source,
      r.style,
      r.ec,
      r.scheme,
      r.contrast,
      r.version,
      r.condition,
      r.group,
      r.jsqr,
      r.zxing,
      r.jsqr_ms,
      r.zxing_ms,
    ].join(","),
  );
fs.writeFileSync(path.join(outDir, `${source}-results.csv`), csv.join("\n") + "\n");

// Summary: decode rate (both readers must decode the right text) by style x condition, and others.
const rate = (list) =>
  list.length ? list.filter((r) => r.jsqr === 1 && r.zxing === 1).length / list.length : null;
// Inverted codes are reported on their own (byStyleScheme): most readers don't take them.
const notInverted = (r) => r.scheme !== "inverted";
const by = (key, keep = () => true) => {
  const m = {};
  for (const r of rows.filter(keep)) (m[key(r)] ??= []).push(r);
  return Object.fromEntries(
    Object.entries(m).map(([k, v]) => [
      k,
      {
        n: v.length,
        both: rate(v),
        jsqr: v.filter((r) => r.jsqr === 1).length / v.length,
        zxing: v.filter((r) => r.zxing === 1).length / v.length,
      },
    ]),
  );
};
const summary = {
  text,
  source,
  conditions: conds,
  byStyle: by((r) => r.style, notInverted),
  byStyleCondition: by((r) => `${r.style}|${r.condition}`, notInverted),
  byStyleScheme: by((r) => `${r.style}|${r.scheme}`),
  byStyleEc: by((r) => `${r.style}|${r.ec}`, notInverted),
  byStyleSchemeCondition: by((r) => `${r.style}|${r.scheme}|${r.condition}`),
};
fs.writeFileSync(path.join(outDir, `${source}-summary.json`), JSON.stringify(summary, null, 1));

if (flag("grid")) {
  for (const [style, shots] of Object.entries(gridShots)) {
    const cell = 160;
    const cols = 6;
    const rowsN = Math.ceil(shots.length / cols);
    const png = new PNG({ width: cols * cell, height: rowsN * cell });
    shots.forEach((s, i) => {
      const ox = (i % cols) * cell;
      const oy = Math.floor(i / cols) * cell;
      const k = Math.max(s.img.width, s.img.height) / (cell - 6);
      for (let y = 0; y < cell; y++)
        for (let x = 0; x < cell; x++) {
          const sx = Math.floor((x - 3) * k);
          const sy = Math.floor((y - 3) * k);
          const o = ((oy + y) * png.width + ox + x) * 4;
          const inb = sx >= 0 && sy >= 0 && sx < s.img.width && sy < s.img.height;
          const p = (sy * s.img.width + sx) * 4;
          for (let ch = 0; ch < 3; ch++) png.data[o + ch] = inb ? s.img.data[p + ch] : 60;
          png.data[o + 3] = 255;
          if (x < 3 || y < 3 || x >= cell - 3 || y >= cell - 3)
            png.data.set(s.ok ? [40, 170, 70, 255] : [210, 50, 50, 255], o);
        }
    });
    fs.writeFileSync(path.join(outDir, `${source}-${style}-grid.png`), PNG.sync.write(png));
  }
}
console.error(`wrote ${rows.length} rows to ${outDir}`);
