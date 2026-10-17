import fs from "node:fs/promises";
import { geometry, alignPly } from "./splats.mjs";
const [model, output, count, seed, whole] = process.argv.slice(2);
const from = await geometry(model);
const to = whole ? JSON.parse(whole) : from;
process.argv = [
  process.execPath,
  new URL("../model-to-splats.mjs", import.meta.url).pathname,
  model,
  "--out",
  output,
  "--splats",
  count,
  "--seed",
  seed,
  "--up",
  "y",
];
await import("../model-to-splats.mjs");
await fs.writeFile(output, alignPly(await fs.readFile(output), from, to));
