#!/usr/bin/env node
// Puts two folders of crops from tools/sharpness-crops.mjs side by side:
// before on the left, after on the right, one JPEG (quality 92) per crop.
//
//   node tools/sharpness-pairs.mjs <before-dir> <after-dir> <out-dir>

import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import fs from "node:fs";
import path from "node:path";

const [beforeDir, afterDir, outDir] = process.argv.slice(2);
if (!outDir) throw new Error("Usage: node tools/sharpness-pairs.mjs <before> <after> <out>");
fs.mkdirSync(outDir, { recursive: true });
const gap = 8;

for (const name of fs.readdirSync(beforeDir).filter((f) => f.endsWith(".png"))) {
  const afterFile = path.join(afterDir, name);
  if (!fs.existsSync(afterFile)) continue;
  const a = PNG.sync.read(fs.readFileSync(path.join(beforeDir, name)));
  const b = PNG.sync.read(fs.readFileSync(afterFile));
  const out = new PNG({ width: a.width + gap + b.width, height: Math.max(a.height, b.height) });
  out.data.fill(255);
  PNG.bitblt(a, out, 0, 0, a.width, a.height, 0, 0);
  PNG.bitblt(b, out, 0, 0, b.width, b.height, a.width + gap, 0);
  const file = path.join(outDir, name.replace(/\.png$/, ".jpg"));
  fs.writeFileSync(file, jpeg.encode({ ...out, data: out.data }, 92).data);
  console.log(file);
}
