#!/usr/bin/env node
// Lane Showcase: measures the numbers the reel's captions quote, so every
// figure on the page is true of this checkout. Writes src/showcase/facts.json:
//
//   node tools/shw-facts.mjs           (writes the file)
//   node tools/shw-facts.mjs --check   (exits 1 if the file is out of date)
//
// For each scene's toy: the size of the recipe file it is built from (raw and
// gzip, as a static host serves it) and how many shelf toys share that file;
// for a captured toy, the size of its capture file. Plus the shelf's size and
// the size of the on-device depth model (loaded only when someone opens their
// own photo or video). The reel adds what it measures live on the viewer's
// device (splats built, time taken, bytes fetched).

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "src/showcase/facts.json");
const { TOYS } = await import(path.join(root, "src/toys.js"));
const playlist = JSON.parse(fs.readFileSync(path.join(root, "src/showcase/playlist.json"), "utf8"));

const kb = (n) => Math.round(n / 102.4) / 10;
const sizeOf = (rel) => fs.statSync(path.join(root, rel)).size;
const gzipOf = (rel) => zlib.gzipSync(fs.readFileSync(path.join(root, rel)), { level: 9 }).length;
const dirSize = (rel) =>
  fs
    .readdirSync(path.join(root, rel), { withFileTypes: true })
    .reduce((s, d) => s + (d.isDirectory() ? dirSize(`${rel}/${d.name}`) : sizeOf(`${rel}/${d.name}`)), 0); // prettier-ignore

const toys = {};
for (const scene of playlist.chapters.flatMap((c) => c.scenes)) {
  const t = TOYS.find((x) => x.id === scene.toy);
  if (!t) throw new Error(`The playlist names a toy that is not on the shelf: ${scene.toy}`);
  if (t.kind === "kit") {
    const file = `src/packs/${t.pack}.js`;
    toys[t.id] = {
      kind: "kit",
      recipeFile: file,
      recipeKB: kb(sizeOf(file)),
      recipeGzipKB: kb(gzipOf(file)),
      sharedBy: TOYS.filter((x) => x.kind === "kit" && x.pack === t.pack).length,
    };
  } else if (t.url) {
    toys[t.id] = { kind: t.kind, captureFile: t.url, captureKB: kb(sizeOf(t.url)) };
  } else toys[t.id] = { kind: t.kind };
}

const facts = {
  note: "Measured by tools/shw-facts.mjs; regenerate after a toy or its pack changes.",
  shelf: {
    toys: TOYS.length,
    public: TOYS.filter((t) => !t.labs).length,
    kit: TOYS.filter((t) => t.kind === "kit").length,
  },
  depthModelMB: Math.round(dirSize("vendor/depth-anything-v2-small") / 1e5) / 10,
  toys,
};
const text = JSON.stringify(facts, null, 2) + "\n";
if (process.argv.includes("--check")) {
  const old = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
  if (old !== text) {
    console.error("src/showcase/facts.json is out of date: run node tools/shw-facts.mjs");
    process.exit(1);
  }
  console.log("facts.json is current");
} else {
  fs.writeFileSync(out, text);
  console.log(`wrote ${path.relative(root, out)} (${Object.keys(toys).length} toys)`);
}
