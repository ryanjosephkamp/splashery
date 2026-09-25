#!/usr/bin/env node
// Reads each flag's shape (width / height) from its SVG and writes it into
// assets/flags/flags.json as `aspect`, so a toy can build a flag at its real
// proportions before the picture has loaded (the Moon's flag).
//
//   node tools/flag-aspects.mjs
//
// tools/fetch-flags.mjs uses svgAspect() too when it fetches flags.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Width / height from the <svg> element's width and height, else its
// viewBox. Rounded to 3 places; 1.5 when neither is there.
export function svgAspect(text) {
  const head = text.match(/<svg[^>]*>/s)?.[0] || "";
  const num = (name) => {
    const m = head.match(new RegExp(`\\s${name}=["']([0-9.eE+-]+)`));
    return m ? Number(m[1]) : NaN;
  };
  let a = num("width") / num("height");
  if (!Number.isFinite(a) || a <= 0) {
    const vb = head
      .match(/viewBox=["']([^"']+)["']/)?.[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    a = vb ? vb[2] / vb[3] : 1.5;
  }
  return Number.isFinite(a) && a > 0 ? Math.round(a * 1000) / 1000 : 1.5;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const manifest = path.join(root, "assets/flags/flags.json");
  const j = JSON.parse(fs.readFileSync(manifest, "utf8"));
  for (const f of j.flags) {
    f.aspect = svgAspect(fs.readFileSync(path.join(root, "assets/flags", f.file), "utf8"));
  }
  fs.writeFileSync(manifest, JSON.stringify(j, null, 1) + "\n");
  console.log(`${j.flags.length} flags: aspect written to assets/flags/flags.json`);
}
