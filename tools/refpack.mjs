#!/usr/bin/env node
// Context-pack schema 1: shared with the Blender builder. Importing has no effects.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readImage, readMask, segment, maskImage, pngBytes, maskBounds } from "./refpack-image.mjs";

export const VIEWS = [
  "front",
  "back",
  "left",
  "right",
  "top",
  "three-quarter",
  "detail",
  "unknown",
];
export const MOTIONS = ["slide", "hinge", "spin", "bounce", "wobble"];
const plain = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
const positive = (x) => Number.isFinite(x) && x > 0;
export function localFile(dir, name) {
  if (
    typeof name !== "string" ||
    !name ||
    name.includes("\\") ||
    path.isAbsolute(name) ||
    name.split("/").some((s) => s === ".." || s === "")
  )
    throw new Error(`Expected a relative file inside the folder: ${String(name)}`);
  const root = fs.realpathSync(dir);
  const file = path.resolve(root, name);
  const real = fs.realpathSync(file);
  if (!real.startsWith(root + path.sep) || !fs.statSync(real).isFile())
    throw new Error(`File escapes the folder: ${name}`);
  return real;
}
export function validatePack(pack, dir) {
  const fail = (message) => {
    throw new Error(`Invalid pack: ${message}`);
  };
  if (!plain(pack) || pack.schema !== 1) fail("schema must be 1");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pack.id || "")) fail("id must be a lowercase slug");
  if (typeof pack.name !== "string" || !pack.name.trim()) fail("name is required");
  if (!Array.isArray(pack.images) || !pack.images.length) fail("images must be a nonempty array");
  if (
    !plain(pack.license) ||
    typeof pack.license.images !== "string" ||
    !pack.license.images.trim()
  )
    fail("license.images is required (use private for unverified images)");
  if (pack.license.source !== undefined && typeof pack.license.source !== "string")
    fail("license.source must be text");
  if (
    !plain(pack.budget) ||
    !["draft", "good", "best"].includes(pack.budget.quality) ||
    !positive(pack.budget.minutes)
  )
    fail("budget needs a positive minutes cap and quality draft, good, or best");
  if (pack.notes !== undefined && typeof pack.notes !== "string") fail("notes must be text");
  if (
    pack.size !== undefined &&
    (!plain(pack.size) ||
      !["width", "depth", "height"].every((k) => positive(pack.size[k])) ||
      !["m", "cm", "mm", "in", "ft"].includes(pack.size.units) ||
      (pack.size.source !== undefined && typeof pack.size.source !== "string"))
  )
    fail("size needs positive width, depth, height, and known units");
  if (
    pack.parts !== undefined &&
    (!Array.isArray(pack.parts) ||
      pack.parts.some(
        (p) =>
          !plain(p) ||
          !/^[a-z][a-z0-9-]*$/.test(p.name || "") ||
          (p.material !== undefined && typeof p.material !== "string"),
      ))
  )
    fail("parts need unique slug names and optional material text");
  const parts = (pack.parts || []).map((p) => p.name);
  if (new Set(parts).size !== parts.length) fail("part names must be unique");
  if (
    pack.moves !== undefined &&
    (!Array.isArray(pack.moves) ||
      pack.moves.length > 15 ||
      pack.moves.some(
        (m) =>
          !plain(m) ||
          !/^[a-z][a-z0-9-]*$/.test(m.part || "") ||
          !MOTIONS.includes(m.how) ||
          !["x", "y", "z"].includes(m.axis) ||
          !Number.isFinite(m.amount) ||
          (parts.length && !parts.includes(m.part)),
      ))
  )
    fail("moves need a named part, known how, axis x/y/z, and finite amount (at most 15)");
  if (new Set((pack.moves || []).map((m) => m.part)).size !== (pack.moves || []).length)
    fail("one motion per part");
  const files = new Set();
  for (const [i, image] of pack.images.entries()) {
    if (!plain(image) || !VIEWS.includes(image.view)) fail(`images[${i}].view is unknown`);
    if (files.has(image.file)) fail("image files must be unique");
    files.add(image.file);
    const p = readImage(localFile(dir, image.file));
    if (p.width * p.height > 40_000_000) fail("image exceeds 40 megapixels");
    if (image.mask !== undefined) {
      const m = readImage(localFile(dir, image.mask));
      if (m.width !== p.width || m.height !== p.height)
        fail(`mask dimensions differ: ${image.file}`);
      const b = maskBounds(readMask(m), m.width, m.height);
      if (b.n === m.width * m.height) fail(`mask has no background: ${image.mask}`);
    }
  }
  return pack;
}
// Deliberately reads only pack.json and its listed images/masks. No truth paths.
export function loadPack(dir) {
  dir = path.resolve(dir);
  return validatePack(JSON.parse(fs.readFileSync(path.join(dir, "pack.json"), "utf8")), dir);
}
export function observations(dir, pack, maxSize = 256) {
  return pack.images.map((entry) => {
    const image = readImage(localFile(dir, entry.file));
    const found = entry.mask
      ? { mask: readMask(readImage(localFile(dir, entry.mask))), method: "provided", review: false }
      : segment(image);
    maskBounds(found.mask, image.width, image.height);
    return { entry, image, ...found, maxSize };
  });
}
export function newPack(files, out) {
  if (!files.length) throw new Error("Provide at least one PNG or JPEG picture.");
  if (fs.existsSync(out)) throw new Error(`Output already exists: ${out}`);
  const decoded = files.map((f) => ({ file: path.resolve(f), image: readImage(f) }));
  fs.mkdirSync(path.join(out, "images"), { recursive: true });
  const id =
    path
      .basename(out)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "reference";
  const images = decoded.map(({ image }, i) => {
    const file = `images/${String(i + 1).padStart(2, "0")}.png`;
    fs.writeFileSync(path.join(out, file), pngBytes(image));
    return { file, view: "unknown" };
  });
  const pack = {
    schema: 1,
    id,
    name: id.replaceAll("-", " "),
    images,
    budget: { minutes: 30, quality: "good" },
    license: { images: "private" },
  };
  fs.writeFileSync(path.join(out, "pack.json"), JSON.stringify(pack, null, 2) + "\n");
  return loadPack(out);
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "check") {
    const p = loadPack(args[0]);
    console.log(`${p.id}: valid schema 1, ${p.images.length} pictures, ${p.license.images}`);
  } else if (command === "new") {
    const out =
      args.find((s) => s.startsWith("--out="))?.slice(6) ||
      `.cache/refpacks/reference-${Date.now()}`;
    newPack(
      args.filter((s) => !s.startsWith("--")),
      out,
    );
    console.log(`${out}/pack.json (private; add views, dimensions, parts, and motion as needed)`);
  } else if (command === "mask") {
    const dir = args[0],
      pack = loadPack(dir);
    for (const [i, obs] of observations(dir, pack).entries()) {
      if (obs.entry.mask) continue;
      const name = `images/mask-${i + 1}.png`;
      fs.mkdirSync(path.join(dir, "images"), { recursive: true });
      fs.writeFileSync(
        path.join(dir, name),
        pngBytes(maskImage(obs.mask, obs.image.width, obs.image.height)),
      );
      pack.images[i].mask = name;
      console.log(`${obs.entry.file}: ${obs.method}${obs.review ? "; REVIEW REQUIRED" : ""}`);
    }
    fs.writeFileSync(path.join(dir, "pack.json"), JSON.stringify(pack, null, 2) + "\n");
  } else
    throw new Error(
      "Usage: node tools/refpack.mjs check <pack> | new <images…> [--out=folder] | mask <pack>",
    );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
