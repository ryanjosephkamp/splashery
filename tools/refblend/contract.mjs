import fs from "node:fs/promises";
import path from "node:path";
export const NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const views = new Set([
  "front",
  "back",
  "left",
  "right",
  "top",
  "three-quarter",
  "detail",
  "unknown",
]);
const motions = new Set(["slide", "hinge", "spin", "bounce", "wobble"]);
const qualities = new Set(["draft", "good", "best"]);
export function positive(value, label) {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${label} must be positive and finite`);
  return value;
}
export function relativeFile(file) {
  if (
    typeof file !== "string" ||
    !file ||
    file.includes("\\") ||
    file.includes("\0") ||
    path.isAbsolute(file) ||
    file.split("/").some((s) => s === ".." || s === "." || !s)
  )
    throw new Error(`Unsafe relative file: ${file}`);
  return file;
}
export async function packFile(dir, file) {
  relativeFile(file);
  const base = await fs.realpath(dir);
  const actual = await fs.realpath(path.join(base, file));
  if (!actual.startsWith(base + path.sep))
    throw new Error(`Pack file is outside the pack (symlink): ${file}`);
  if (!(await fs.stat(actual)).isFile()) throw new Error(`Not a file: ${file}`);
  return actual;
}
export function checkMotion(m) {
  if (
    !m ||
    typeof m.part !== "string" ||
    !NAME.test(m.part) ||
    !motions.has(m.how) ||
    (m.axis !== undefined && !["x", "y", "z"].includes(m.axis)) ||
    (m.amount !== undefined && !Number.isFinite(m.amount))
  )
    throw new Error("Invalid moving part or motion");
  return {
    part: m.part,
    how: m.how,
    ...(m.axis ? { axis: m.axis } : {}),
    ...(m.amount !== undefined ? { amount: m.amount } : {}),
  };
}
export async function readPack(dir) {
  const raw = JSON.parse(await fs.readFile(path.join(dir, "pack.json"), "utf8"));
  if (
    raw.schema !== 1 ||
    typeof raw.id !== "string" ||
    !NAME.test(raw.id) ||
    typeof raw.name !== "string" ||
    !Array.isArray(raw.images) ||
    !raw.images.length
  )
    throw new Error("Expected task 113 schema 1 pack, id, name, and images");
  if (!raw.license || typeof raw.license.images !== "string")
    throw new Error("Pack needs license.images");
  const images = [];
  for (const img of raw.images) {
    if (!views.has(img.view)) throw new Error(`Unknown view: ${img.view}`);
    await packFile(dir, img.file);
    if (img.mask) await packFile(dir, img.mask);
    const camera = img.camera;
    if (camera) {
      for (const key of ["yaw", "pitch", "fov", "distance", "orthoScale"])
        if (camera[key] !== undefined && !Number.isFinite(camera[key]))
          throw new Error(`Invalid camera ${key}`);
      if (camera.distance !== undefined) positive(camera.distance, "Camera distance");
      if (camera.orthoScale !== undefined) positive(camera.orthoScale, "Camera scale");
      if (camera.fov !== undefined && !(camera.fov > 0 && camera.fov < 179))
        throw new Error("Camera fov must be between 0 and 179 degrees");
      if (
        camera.target &&
        (!Array.isArray(camera.target) ||
          camera.target.length !== 3 ||
          !camera.target.every(Number.isFinite))
      )
        throw new Error("Invalid camera target");
    }
    images.push({
      file: img.file,
      view: img.view,
      ...(img.mask ? { mask: img.mask } : {}),
      ...(camera ? { camera } : {}),
    });
  }
  const budget = raw.budget || { minutes: 30, quality: "good" };
  positive(budget.minutes, "Budget minutes");
  if (!qualities.has(budget.quality)) throw new Error("Invalid budget quality");
  const moves = (raw.moves || []).map(checkMotion);
  if (new Set(moves.map((m) => m.part)).size !== moves.length)
    throw new Error("Duplicate moving parts");
  if (raw.size) {
    if (raw.size.units !== "m") throw new Error("Size units must be m");
    for (const k of ["width", "depth", "height"]) positive(raw.size[k], `Size ${k}`);
  }
  // Deliberate allowlist: truth paths/geometry never go to the model runner.
  return {
    schema: 1,
    id: raw.id,
    name: raw.name,
    images,
    budget,
    license: raw.license,
    moves,
    ...(raw.size ? { size: raw.size } : {}),
    ...(raw.notes ? { notes: raw.notes } : {}),
    ...(raw.parts ? { parts: raw.parts } : {}),
  };
}
export function validateResult(r, pack) {
  if (
    r.schema !== 1 ||
    r.builder !== "blender" ||
    r.pack !== pack.id ||
    r.status !== "complete" ||
    !Number.isFinite(r.minutes) ||
    r.minutes < 0
  )
    throw new Error("Invalid schema 1 Blender result");
  if (r.coordinates !== "normalized-y-up")
    throw new Error("Result needs normalized-y-up coordinates");
  relativeFile(r.mesh);
  relativeFile(r.splat);
  for (const tier of ["phone", "desktop"]) {
    positive(r.tiers?.[tier]?.splats, `${tier} splats`);
    relativeFile(r.tiers[tier].file);
  }
  for (const move of pack.moves || []) {
    const p = r.parts?.find((p) => p.name === move.part);
    if (!p) throw new Error(`Missing moving part: ${move.part}`);
    relativeFile(p.file);
    if (!Array.isArray(p.pivot) || p.pivot.length !== 3 || !p.pivot.every(Number.isFinite))
      throw new Error(`Invalid pivot: ${p.name}`);
    if (JSON.stringify(checkMotion(p.motion)) !== JSON.stringify(checkMotion(move)))
      throw new Error(`Wrong motion for ${p.name}`);
  }
  return r;
}
