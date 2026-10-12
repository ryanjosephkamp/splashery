#!/usr/bin/env node
// Measures what "save the whole shelf offline" would download (lane Site r4): per shelf, the
// toys' own files under assets/toys/<id>/ (their splat files, pictures and thumbnails), split into
// what a full device loads (every file but the light copies) and what a weak device loads (the
// light copies *-lite.sog in place of the full copies they stand for), plus the fixed
// parts (the app's code, the site's shell). Sizes are on-disk bytes as GitHub Pages would send
// them (already compressed formats: .sog, .webp, .jpg, .pdf; code and pages are also shown gzipped).
//
//   node tools/site-offline-sizes.mjs            # a table
//   node tools/site-offline-sizes.mjs --json     # the same as JSON

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { TOYS, CATEGORIES } from "../src/toys.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const JSON_OUT = process.argv.includes("--json");

function walk(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, fn);
    else fn(abs, fs.statSync(abs).size);
  }
}
const total = (dir, filter = () => true) => {
  let n = 0;
  walk(dir, (f, s) => filter(f) && (n += s));
  return n;
};
const gz = (dir, ext) => {
  let n = 0;
  walk(dir, (f) => ext.test(f) && (n += zlib.gzipSync(fs.readFileSync(f)).length));
  return n;
};
const MB = (n) => (n / 1e6).toFixed(1);
const isLite = (f) => /-lite\./.test(f);
// A full copy that has a light copy beside it (strawberry.sog, with strawberry-lite.sog).
const hasLite = (f) => !isLite(f) && fs.existsSync(f.replace(/(\.[a-z0-9]+)$/i, "-lite$1"));

const shelves = [];
for (const c of CATEGORIES) {
  const toys = TOYS.filter((t) => t.category === c.id);
  if (!toys.length) continue;
  let full = 0;
  let light = 0;
  let twins = 0;
  let thumbs = 0;
  let own = 0; // toys with files of their own (the rest are built from recipes)
  for (const t of toys) {
    const dir = path.join(root, "assets/toys", t.id);
    const all = total(dir);
    if (all) own++;
    const lite = total(dir, isLite);
    const twin = total(dir, hasLite);
    const th = total(dir, (f) => /thumb\.webp$/.test(f));
    full += all;
    light += lite;
    twins += twin;
    thumbs += th;
  }
  shelves.push({ id: c.id, label: c.label, toys: toys.length, withFiles: own, fullBytes: full, liteBytes: light, thumbBytes: thumbs, fullDeviceBytes: full - light, weakDeviceBytes: full - twins }); // prettier-ignore
}

const sumToys = fs.existsSync(path.join(root, "assets/toys")) ? total(path.join(root, "assets/toys")) : 0; // prettier-ignore
const fixed = {
  appCode: total(path.join(root, "src")) + total(path.join(root, "vendor/playcanvas")) + fs.statSync(path.join(root, "styles.css")).size, // prettier-ignore
  appCodeGzip:
    gz(path.join(root, "src"), /\.js$/) + gz(path.join(root, "vendor/playcanvas"), /\.mjs$/),
  siteShell: total(path.join(root, "site"), (f) => /\.(html|css|js|json|xml)$/.test(f) && !f.includes("/toys/")), // prettier-ignore
  siteToyPages: total(path.join(root, "site/toys")),
  sounds: total(path.join(root, "assets/sounds")),
  otherAssets: ["flags", "proteins", "gallery", "worlds", "app"].reduce((n, d) => n + total(path.join(root, "assets", d)), 0), // prettier-ignore
  catalogPdf: fs.existsSync(path.join(root, "site/splashery-catalog.pdf")) ? fs.statSync(path.join(root, "site/splashery-catalog.pdf")).size : 0, // prettier-ignore
};

if (JSON_OUT) {
  console.log(JSON.stringify({ shelves, totalToyFiles: sumToys, fixed }, null, 2));
} else {
  const pad = (s, n) => String(s).padEnd(n);
  const num = (s, n) => String(s).padStart(n);
  console.log(`${pad("Shelf", 22)}${num("toys", 6)}${num("own files", 11)}${num("files (MB)", 12)}${num("full device", 13)}${num("weak device", 13)}`); // prettier-ignore
  for (const s of shelves) {
    console.log(`${pad(s.label, 22)}${num(s.toys, 6)}${num(s.withFiles, 11)}${num(MB(s.fullBytes), 12)}${num(MB(s.fullDeviceBytes), 13)}${num(MB(s.weakDeviceBytes), 13)}`); // prettier-ignore
  }
  const sum = (k) => shelves.reduce((n, s) => n + s[k], 0);
  console.log(`\nAll toy files under assets/toys/: ${MB(sumToys)} MB; a full device would save ${MB(sum("fullDeviceBytes"))} MB (every toy), a weak device ${MB(sum("weakDeviceBytes"))} MB; ${MB(sum("liteBytes"))} MB of the files are light copies, ${MB(sum("thumbBytes"))} MB thumbnails`); // prettier-ignore
  console.log(
    "Fixed parts (MB):",
    Object.fromEntries(Object.entries(fixed).map(([k, v]) => [k, +MB(v)])),
  );
}
