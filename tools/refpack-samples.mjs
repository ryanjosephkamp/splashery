#!/usr/bin/env node
// Reproducible sample preparation from already downloaded CC0 sources.
// Fetches are deliberately separate: inspect the live source/license first.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import { readMesh, normalizeMesh, writeGLB, plyFromMesh } from "./refpack-geometry.mjs";
import { sampleSurface } from "../src/packs/studio-models-core.js";
import { linear } from "./refpack-metrics.mjs";
import { maskImage, pngBytes } from "./refpack-image.mjs";
import { renderer } from "./refpack-render.mjs";

export const SAMPLES = [
  {
    id: "reference-duck",
    source: "rubber-duck-real",
    asset: "rubber_duck_toy",
    name: "Rubber duck",
    notes: "A yellow duck with an orange bill and a rounded body.",
    motion: "bounce",
    axis: "y",
    amount: 0.18,
  },
  {
    id: "reference-croissant",
    source: "croissant-real",
    asset: "croissant",
    name: "Croissant",
    notes: "A curved golden pastry with a broad middle and tapered ends.",
    motion: "wobble",
    axis: "z",
    amount: 18,
  },
  {
    id: "reference-pomegranate",
    source: "pomegranate",
    asset: "food_pomegranate_01",
    name: "Pomegranate",
    notes: "A red fruit with a round body and a small crown.",
    motion: "spin",
    axis: "y",
    amount: 360,
  },
  {
    id: "reference-cake",
    source: "carrot-cake",
    asset: "carrot_cake",
    name: "Carrot cake",
    notes: "A low round cake with pale frosting and small colored decorations.",
    motion: "slide",
    axis: "x",
    amount: 0.3,
  },
  {
    id: "reference-lantern",
    source: "lantern",
    asset: "Lantern_01",
    name: "Lantern",
    notes: "A brass lantern with a wide foot, a narrow center, and a handle at the top.",
    motion: "hinge",
    axis: "z",
    amount: 20,
  },
];
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
export async function makeSamples(
  sourceRoot = ".cache/refpack-sources",
  outRoot = "tools/refpack-samples",
) {
  const catalog = JSON.parse(fs.readFileSync("tools/models.json")).models;
  const service = await renderer();
  try {
    for (const sample of SAMPLES) {
      const source = catalog.find((m) => m.id === sample.source);
      if (source.license !== "CC0 1.0") throw new Error(`Not CC0: ${source.id}`);
      const dir = path.join(sourceRoot, sample.asset),
        file = path.join(dir, `${sample.asset}.gltf`);
      if (!fs.readFileSync(path.join(dir, "license.html"), "utf8").includes("CC0"))
        throw new Error("Read and save the live CC0 license page first.");
      const raw = await readMesh(file, { simplifyTo: 4500 }),
        normalized = normalizeMesh(raw);
      const sampled = sampleSurface(raw.prep, 40000, { seed: 113, light: false });
      const sums = Array.from({ length: raw.prep.nt }, () => [0, 0, 0, 0]);
      for (let i = 0; i < sampled.n; i++) {
        const a = sums[sampled.triangle[i]];
        for (let k = 0; k < 3; k++) a[k] += sampled.rgb[i * 3 + k];
        a[3]++;
      }
      const mesh = { positions: [], indices: [], colors: [] };
      for (let t = 0; t < raw.prep.nt; t++) {
        const color = sums[t][3]
          ? sums[t].slice(0, 3).map((x) => linear(x / sums[t][3]))
          : [0.4, 0.4, 0.4];
        for (let k = 0; k < 3; k++) {
          const index = raw.indices[t * 3 + k];
          mesh.positions.push(...normalized.positions.slice(index * 3, index * 3 + 3));
          mesh.indices.push(mesh.indices.length);
          mesh.colors.push(...color);
        }
      }
      const out = path.join(outRoot, sample.id);
      fs.mkdirSync(path.join(out, "truth"), { recursive: true });
      fs.mkdirSync(path.join(out, "images"), { recursive: true });
      await writeGLB(path.join(out, "truth/model.glb"), mesh);
      const truth = await readMesh(path.join(out, "truth/model.glb"));
      await service.load(plyFromMesh(truth.prep, 24000));
      const views = ["front", "right", "back", "left", "three-quarter", "three-quarter"];
      const cameras = views.map((view, i) => ({
        view,
        yaw: [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI / 4][i],
        pitch: i < 4 ? 0.08 : 0.3,
        fov: 38,
        distance: 3.65,
        target: [0, 0, 0],
      }));
      const images = [];
      for (const [i, camera] of cameras.entries()) {
        const p = await service.render(camera, 256, 256),
          mask = Uint8Array.from({ length: 256 * 256 }, (_, j) => +(p.data[j * 4 + 3] >= 128));
        // The final photo has a deterministic busy background. Its supplied
        // alpha-derived mask prevents segmentation quality from hiding fit errors.
        for (let y = 0; y < 256; y++)
          for (let x = 0; x < 256; x++) {
            const j = (y * 256 + x) * 4,
              a = p.data[j + 3] / 255;
            const busy = i === cameras.length - 1;
            const tile = (Math.floor(x / 21) + Math.floor(y / 17)) % 2;
            const bg = busy ? (tile ? [127, 155, 165] : [202, 176, 123]) : [248, 247, 244];
            for (let k = 0; k < 3; k++)
              p.data[j + k] = Math.round(p.data[j + k] * a + bg[k] * (1 - a));
            p.data[j + 3] = 255;
          }
        const stem = String(i + 1).padStart(2, "0"),
          imageFile = `images/${stem}.jpg`,
          maskFile = `images/${stem}-mask.png`;
        fs.writeFileSync(path.join(out, imageFile), jpeg.encode(p, 88).data);
        fs.writeFileSync(path.join(out, maskFile), pngBytes(maskImage(mask, 256, 256)));
        images.push({ file: imageFile, view: camera.view, mask: maskFile });
      }
      const size = raw.prep.bbox.max.map((x, k) => x - raw.prep.bbox.min[k]);
      const pack = {
        schema: 1,
        id: sample.id,
        name: sample.name,
        images,
        size: {
          width: size[0],
          depth: size[2],
          height: size[1],
          units: "m",
          source: "CC0 source model bounds; synthetic test dimensions",
        },
        notes: sample.notes,
        parts: [
          { name: "object", material: "Read the pictures; flat part colors are an approximation." },
        ],
        moves: [{ part: "object", how: sample.motion, axis: sample.axis, amount: sample.amount }],
        budget: { minutes: 30, quality: "good" },
        license: { images: "CC0-1.0", source: source.page },
      };
      fs.writeFileSync(path.join(out, "pack.json"), JSON.stringify(pack, null, 2) + "\n");
      const hashes = {};
      for (const f of [
        file,
        ...fs
          .readdirSync(dir, { recursive: true })
          .map((f) => path.join(dir, f))
          .filter((f) => /\.(bin|jpg|png)$/.test(f)),
      ])
        hashes[path.relative(dir, f)] = hash(fs.readFileSync(f));
      const manifest = {
        schema: 1,
        model: "model.glb",
        cameras,
        source: source.page,
        download: source.source,
        author: source.author,
        license: "CC0 1.0",
        licensePage: "https://polyhaven.com/license",
        checked: "2026-10-17",
        sourceHashes: hashes,
        modelHash: hash(fs.readFileSync(path.join(out, "truth/model.glb"))),
        imageHashes: Object.fromEntries(
          images
            .flatMap((i) => [i.file, i.mask])
            .map((file) => [file, hash(fs.readFileSync(path.join(out, file)))]),
        ),
        triangles: raw.prep.nt,
        changes:
          "Simplified to about 4,500 triangles when needed; base texture averaged per triangle and materials made opaque; centered and scaled to AABB diagonal 2. Rendered in Splashery; sixth view composited on a procedural busy background. No logos added.",
        credit:
          "CC0 source by " + source.author + "; test preparation made by Ryan with Codex (GPT-6).",
        hiddenFromBuilder: true,
      };
      fs.writeFileSync(
        path.join(out, "truth/truth.json"),
        JSON.stringify(manifest, null, 2) + "\n",
      );
      console.log(`${sample.id}: ${raw.prep.nt} truth triangles, 6 views`);
    }
  } finally {
    await service.close();
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  makeSamples(process.argv[2], process.argv[3]).catch((e) => {
    console.error(e.stack);
    process.exitCode = 1;
  });
