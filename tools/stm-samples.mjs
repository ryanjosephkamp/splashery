#!/usr/bin/env node
// Makes the sample models of the "Model to splats" toy (lane Studio Models): each one a
// single GLB, with its texture inside, small enough to load quickly.
//
//   node tools/stm-samples.mjs
//
// Sources (both CC0, checked on their live pages on September 29, 2026):
//   burger.glb  Kenney's Food Kit, "burger" (https://kenney.nl/assets/food-kit, CC0)
//   vase.glb    Poly Haven's "Antique Ceramic Vase 01" by James Ray Cock, 1k glTF
//               (https://polyhaven.com/a/antique_ceramic_vase_01, CC0); only the color
//               texture is kept, at 1024 pixels.
// Build-time only: @gltf-transform/core (MIT) is a devDependency.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { NodeIO } from "@gltf-transform/core";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const cache = path.join(root, ".cache/stm-samples");
const out = path.join(root, "assets/toys/model-splats");
const UA = "SplasheryBuild/1.0 (https://github.com/ryanjosephkamp/splashery; build tool)";
fs.mkdirSync(cache, { recursive: true });
fs.mkdirSync(out, { recursive: true });

async function get(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!r.ok) throw new Error(`Download failed (${r.status}): ${url}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

const io = new NodeIO();

// Kenney's Food Kit: one zip; the GLB points at Textures/colormap.png, which the GLB export embeds.
{
  const page = await (
    await fetch("https://kenney.nl/assets/food-kit", { headers: { "User-Agent": UA } })
  ).text();
  const url = page.match(/https:\/\/kenney\.nl\/media\/[^"']*kenney_food-kit\.zip/)?.[0];
  if (!url) throw new Error("Could not find the Food Kit's zip on its page.");
  const zip = path.join(cache, "food-kit.zip");
  await get(url, zip);
  const dir = path.join(cache, "food-kit");
  if (!fs.existsSync(dir)) execFileSync("unzip", ["-q", "-o", zip, "-d", dir]);
  const doc = await io.read(path.join(dir, "Models/GLB format/burger.glb"));
  fs.writeFileSync(path.join(out, "burger.glb"), await io.writeBinary(doc));
}

// Poly Haven's vase: the 1k glTF, only its color texture.
{
  const api = await (
    await fetch("https://api.polyhaven.com/files/antique_ceramic_vase_01", {
      headers: { "User-Agent": UA },
    })
  ).json();
  const g = api.gltf["1k"].gltf;
  const dir = path.join(cache, "vase");
  const main = path.join(dir, "vase.gltf");
  await get(g.url, main);
  for (const [rel, f] of Object.entries(g.include)) await get(f.url, path.join(dir, rel));
  const doc = await io.read(main);
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setNormalTexture(null);
    mat.setMetallicRoughnessTexture(null);
    mat.setOcclusionTexture(null);
  }
  for (const t of doc.getRoot().listTextures()) if (t.listParents().every((p) => p.propertyType === "Root")) t.dispose(); // prettier-ignore
  fs.writeFileSync(path.join(out, "vase.glb"), await io.writeBinary(doc));
}
for (const f of fs.readdirSync(out)) if (f.endsWith(".glb")) console.log(f, fs.statSync(path.join(out, f)).size, "bytes"); // prettier-ignore
