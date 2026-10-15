#!/usr/bin/env node
// Task 75e only. Made by Ryan with Codex (GPT-6). Code: MIT.
// These are AI-made Studio inputs, not measured geometry or scientific reference data.
// Rebuild from the ten committed source JPEGs:
//   SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/depth-lab/gen-j.mjs
// First import (native PNGs named glass.png, mirror.png, etc.):
//   node tools/depth-lab/gen-j.mjs --import /path/to/native-pngs
// --out /tmp/depth-lab-j writes a separate verification tree.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { format } from "prettier";

const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
function option(name) {
  const i = args.indexOf(name);
  if (i < 0) return null;
  if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Missing value: ${name}`);
  return path.resolve(args[i + 1]);
}
const importDir = option("--import");
const out = option("--out") || root;
if (args.some((a, i) => i % 2 === 0 && !["--import", "--out"].includes(a)))
  throw new Error("Usage: gen-j.mjs [--import native-png-dir] [--out output-root]");
export const PROMPT_PREFIX =
  "Create ONE square 1:1 image at 1536x1536 or the highest available square resolution. This is an AI-made fictional Studio Photo-to-3D challenge input. The picture itself must contain absolutely NO people, faces, human bodies, readable or unreadable text, numbers, typography, logos, watermarks, brands, signatures, insignia, or real named places. No collage, no border, no captions. Show only the requested scene. ";
export const SCENES = [
  {
    key: "glass",
    title: "Glass",
    prompt:
      "A photoreal fictional tabletop still life: one clear drinking glass half filled with water in the foreground, two matte terracotta spheres behind it on pale oak, a small blue ceramic cube farther back; visible refraction through the glass and water, delicate highlights, oblique view, soft side window light. Clear spatial separation, crisp geometry.",
    expect:
      "Keep the glass rim and wall coherent; avoid turning refracted background detail into foreground bumps.",
  },
  {
    key: "mirror",
    title: "Mirror",
    prompt:
      "A photoreal fictional tabletop still life: a small upright rectangular frameless mirror at the rear of a pale oak tabletop, a matte terracotta teapot in front of it and a small blue ceramic cube beside it, reflected teapot visibly behind the mirror plane. Mirror edge visible, no camera reflected, no room posters, oblique view, soft side light.",
    expect:
      "Keep the mirror boundary coherent; reflected objects have virtual, ambiguous depth rather than an extra solid teapot.",
  },
  {
    key: "hair",
    title: "Hair",
    prompt:
      "A photoreal fictional still life of one detached thick lock of chestnut hair tied at its middle with a plain blue ribbon, lying across a smooth pale wooden cylinder on an oak table. Clearly a hair sample with NO head, body, face, mannequin, or person anywhere; many fine loose hair strands across the cylinder silhouette; side light, neutral studio wall.",
    expect:
      "Keep the lock above the cylinder and table, with fine silhouette strands rather than a solid curtain.",
  },
  {
    key: "fur",
    title: "Fur",
    prompt:
      "A photoreal fictional still life of a square long-pile gray faux fur textile draped over one small wooden cube on a pale oak tabletop, a blue ceramic ball behind. Individual fine fur fibers along the silhouette, soft folds and volume; no animals, no people; soft side lighting, oblique view, neutral wall.",
    expect:
      "Preserve the textile volume above the cube, fine silhouette fibers, and the background ball.",
  },
  {
    key: "thin",
    title: "Thin parts",
    prompt:
      "A photoreal fictional still life of one empty delicate miniature bent-wire birdcage, unpainted brass, round domed top, many thin spaced vertical wires, no bird, no animal, on a pale oak table; blue ceramic cube behind the cage visible through its open wires, a terracotta sphere beside it. Crisp wires and holes, soft side window light, oblique view.",
    expect: "Preserve separate cage wires and open gaps through to the cube and table behind.",
  },
  {
    key: "night",
    title: "Night scene",
    prompt:
      "A photoreal fictional night still life in an empty garden: one plain warm glowing frosted-glass lantern with no markings in the foreground on rough stone, a terracotta pot and a blue ceramic ball behind it, dark layered foliage farther away. Very low illumination, deep shadow, small practical light, restrained glare; object silhouettes still legible, no moon text, no people.",
    expect:
      "Keep lantern, pot, ball, and foliage ordered where visible; do not infer geometry from the glow alone.",
  },
  {
    key: "painting",
    title: "Painting",
    prompt:
      "A traditional oil painting on canvas of a fictional still life: terracotta teapot foreground left, blue ceramic cube middle right, cream vase farther behind, all on an oak table against gray wall. Strong clearly readable perspective, coherent shadows, overlapping solid forms, visible expressive paint strokes and canvas texture. Entire image is the painted composition, no frame, no signature.",
    expect:
      "If reconstructing the depicted scene, keep its object ordering; the physical painted medium would instead be flat.",
  },
  {
    key: "line-art",
    title: "Line art",
    prompt:
      "An intricate original black ink pen line drawing of a fictional still life: terracotta-shaped teapot foreground left, cube middle right, tall vase farther behind, resting on a table receding in perspective. White paper background, fine crosshatching on solid surfaces, deliberate clean occlusion edges, coherent perspective, no color wash, no frame, no signature.",
    expect:
      "If reconstructing the depicted scene, keep occlusion ordering without treating crosshatching as ridges; the paper would be flat.",
  },
  {
    key: "graphic",
    title: "Flat graphic design",
    prompt:
      "An original flat graphic illustration of a fictional still life: large coral teapot foreground left, smaller blue cube middle right, tall cream vase behind, against a pale mint rectangle representing a table. Vector-like clean solid fills, minimal outline, overlapping silhouettes, intentionally flat appearance without shading, no gradients, no frames.",
    expect:
      "Keep the graphic physically flat; any inferred object depth is an interpretation rather than a measured surface.",
  },
  {
    key: "clutter",
    title: "Clutter",
    prompt:
      "A photoreal fictional cluttered potting bench: many overlapping unmarked terracotta pots, a plain watering can, tangled twine, smooth stones, a small wooden crate, blank wooden plant stakes, and delicate fern fronds. Strong foreground-middle-background separation, repeated similar objects occluding each other, every object whole and plausible, crisp natural side light, no packaging or labels.",
    expect:
      "Preserve distinct overlapping pots, tools, twine, and fern edges rather than merging their depth.",
  },
];
const size = 1280;
const quality = 0.78;
const levels = [
  ...[-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map((exposureStops) => ({ exposureStops, blurSigmaPx: 0 })),
  ...[1, 2, 3, 4].map((blurSigmaPx) => ({ exposureStops: 0, blurSigmaPx })),
  ...[-1, 1].flatMap((exposureStops) =>
    [1, 4].map((blurSigmaPx) => ({ exposureStops, blurSigmaPx })),
  ),
];
const idFor = (key, ev, blur) =>
  `j-${key}-ev-${ev < 0 ? "m" : "p"}${String(Math.round(Math.abs(ev) * 10)).padStart(2, "0")}-b${String(Math.round(blur * 10)).padStart(2, "0")}`;
const baselineFor = (key) => `assets/depth-lab/j/j-${key}-source.jpg`;
const dataUrl = async (file, type = "image/jpeg") =>
  `data:${type};base64,${(await fs.readFile(file)).toString("base64")}`;
const writeJpeg = async (file, url) => fs.writeFile(file, Buffer.from(url.split(",")[1], "base64"));
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: ["--no-sandbox"],
});
const manifest = [];
try {
  const page = await browser.newPage();
  await page.evaluate(() => {
    window.load = async (url) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    };
    window.canvas = (width, height = width) => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      return c;
    };
  });
  await fs.mkdir(path.join(out, "assets/depth-lab/j"), { recursive: true });
  for (const scene of SCENES) {
    const baseline = path.join(out, baselineFor(scene.key));
    if (importDir) {
      const original = await dataUrl(path.join(importDir, `${scene.key}.png`), "image/png");
      const normalized = await page.evaluate(
        async ({ original, size, quality }) => {
          const img = await window.load(original);
          if (img.width !== img.height) throw new Error("Native source must be square");
          const c = window.canvas(size);
          const ctx = c.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, size, size);
          return c.toDataURL("image/jpeg", quality);
        },
        { original, size, quality },
      );
      await writeJpeg(baseline, normalized);
    } else if (out !== root) {
      await fs.copyFile(path.join(root, baselineFor(scene.key)), baseline);
    }
    await page.evaluate(
      async ({ url, size }) => {
        window.source = await window.load(url);
        if (window.source.width !== size || window.source.height !== size)
          throw new Error("Baseline must be 1280 x 1280");
      },
      { url: await dataUrl(baseline), size },
    );
    manifest.push({
      id: `j-${scene.key}-source`,
      category: "J",
      file: `j/j-${scene.key}-source.jpg`,
      width: size,
      height: size,
      seed: null,
      variables: { scene: scene.key, role: "source", exposureStops: 0, blurSigmaPx: 0 },
      controls:
        "Fixed AI-made source, normalized to 1280 px JPEG quality 0.78; not a sweep control. Compare the neutral variant with other variants to hold JPEG generation count fixed.",
      expect: scene.expect,
    });
    for (const level of levels) {
      const id = idFor(scene.key, level.exposureStops, level.blurSigmaPx);
      const file = path.join(out, "assets/depth-lab/j", `${id}.jpg`);
      // Every variant, including the neutral control, has the same JPEG generation count.
      {
        const url = await page.evaluate(
          ({ size, quality, exposureStops, blurSigmaPx }) => {
            const c = window.canvas(size);
            const ctx = c.getContext("2d");
            ctx.drawImage(window.source, 0, 0);
            if (exposureStops !== 0) {
              const pixels = ctx.getImageData(0, 0, size, size);
              const gain = 2 ** exposureStops;
              const lut = Array.from({ length: 256 }, (_, v) => {
                const s = v / 255;
                const linear = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
                const e = Math.min(1, linear * gain);
                return Math.round(
                  255 * (e <= 0.0031308 ? 12.92 * e : 1.055 * e ** (1 / 2.4) - 0.055),
                );
              });
              for (let i = 0; i < pixels.data.length; i += 4)
                for (let k = 0; k < 3; k++) pixels.data[i + k] = lut[pixels.data[i + k]];
              ctx.putImageData(pixels, 0, 0);
            }
            if (blurSigmaPx > 0) {
              // Pad with replicated edge pixels, preventing transparent/dark filter borders.
              const pad = Math.ceil(blurSigmaPx * 4);
              const extended = window.canvas(size + 2 * pad);
              const ectx = extended.getContext("2d");
              ectx.drawImage(c, pad, pad);
              ectx.drawImage(c, 0, 0, size, 1, pad, 0, size, pad);
              ectx.drawImage(c, 0, size - 1, size, 1, pad, size + pad, size, pad);
              ectx.drawImage(c, 0, 0, 1, size, 0, pad, pad, size);
              ectx.drawImage(c, size - 1, 0, 1, size, size + pad, pad, pad, size);
              for (const x of [0, 1])
                for (const y of [0, 1])
                  ectx.drawImage(
                    c,
                    x * (size - 1),
                    y * (size - 1),
                    1,
                    1,
                    x * (size + pad),
                    y * (size + pad),
                    pad,
                    pad,
                  );
              ctx.filter = `blur(${blurSigmaPx}px)`;
              ctx.drawImage(extended, -pad, -pad);
            }
            return c.toDataURL("image/jpeg", quality);
          },
          { size, quality, ...level },
        );
        await writeJpeg(file, url);
      }
      manifest.push({
        id,
        category: "J",
        file: `j/${id}.jpg`,
        width: size,
        height: size,
        seed: null,
        variables: { scene: scene.key, role: "variant", ...level },
        controls: `Same decoded AI-made ${scene.key} source, composition, geometry, crop, 1280 px size, JPEG quality 0.78, and JPEG generation count; exposure is fixed at 0 for the blur sweep, and blur is fixed at 0 for the exposure sweep. Grid varies both. Exposure precedes blur. See README for encoding limits.`,
        expect: scene.expect,
      });
    }
    console.log(`${scene.key}: 1 source and 15 variants`);
  }
  const total = (
    await Promise.all(
      manifest.map(async (e) => (await fs.stat(path.join(out, "assets/depth-lab", e.file))).size),
    )
  ).reduce((a, b) => a + b, 0);
  if (total > 30_000_000) throw new Error(`J assets exceed 30 MB: ${total}`);
  await fs.mkdir(path.join(out, "tools/depth-lab"), { recursive: true });
  await fs.writeFile(
    path.join(out, "tools/depth-lab/j.json"),
    await format(JSON.stringify(manifest), { parser: "json" }),
  );
  const tiles = await Promise.all(
    manifest.map(async (e) => ({
      scene: e.variables.scene,
      ...e.variables,
      url: await dataUrl(path.join(out, "assets/depth-lab", e.file)),
    })),
  );
  const sheet = await page.evaluate(
    async ({ tiles }) => {
      const tile = 128,
        row = 178,
        header = 100;
      const c = window.canvas(16 * tile, 10 * row + header);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#f3f1eb";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#172c31";
      ctx.font = "bold 25px sans-serif";
      ctx.fillText("J. Hard cases | AI-made by the owner | Studio test inputs only", 12, 32);
      ctx.font = "16px sans-serif";
      ctx.fillText(
        "Col 1: source | 2-8: exposure -1.5 to +1.5 stops | 5, 9-12: blur 0, 1, 2, 3, 4 px | 13-16: 2 x 2 grid",
        12,
        62,
      );
      ctx.fillText(
        "Each row uses one fixed scene. EV / blur shown below each image. Not captures or measured depth references.",
        12,
        86,
      );
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i],
          x = (i % 16) * tile,
          y = header + Math.floor(i / 16) * row;
        ctx.drawImage(await window.load(t.url), x + 2, y, tile - 4, tile - 4);
        ctx.fillStyle = "#172c31";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText(t.scene, x + 4, y + 140);
        ctx.font = "13px sans-serif";
        ctx.fillText(
          t.role === "source"
            ? "Source (AI-made)"
            : `EV ${t.exposureStops > 0 ? "+" : ""}${t.exposureStops} / b ${t.blurSigmaPx}`,
          x + 4,
          y + 158,
        );
      }
      return c.toDataURL("image/jpeg", 0.9);
    },
    { tiles },
  );
  await fs.mkdir(path.join(out, "docs/audits/depth-lab"), { recursive: true });
  await writeJpeg(path.join(out, "docs/audits/depth-lab/j.jpg"), sheet);
  console.log(`J: ${manifest.length} JPEGs, ${total} bytes (${(total / 1e6).toFixed(2)} MB)`);
  const digest = createHash("sha256");
  for (const e of manifest)
    digest.update(await fs.readFile(path.join(out, "assets/depth-lab", e.file)));
  console.log(`Ordered image SHA-256: ${digest.digest("hex")}`);
} finally {
  await browser.close();
}
