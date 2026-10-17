import { SplatBuffer } from "../generators.js";
import { levelBuffer, eligible } from "./geometry.js";
import { buildGrid, CollisionGrid } from "./grid.js";
import { buildRoom } from "./rooms.js";
import { readPlace } from "./io.js";

export async function preparePlace(args, source = null) {
  source = await readSource(args, source);
  return prepareBuffer(args, source);
}

export async function readSource(args, source = null) {
  if (args.room) source = buildRoom(args.room).buffer;
  else if (args.buffer) source = args.buffer;
  else if (args.bytes)
    source = await readPlace(args.bytes, args.name, { files: args.files, axes: args.axes });
  if (!source) throw new Error("Open a splat file or choose a test place first.");
  return source;
}

export function prepareBuffer(args, source) {
  const started = performance.now();
  const leveled = levelBuffer(source, args.level);
  const grid = buildGrid(leveled.buffer);
  const collision = new CollisionGrid(grid);
  const preferred = args.room
    ? buildRoomSpawn(args.room)
    : [
        grid.min[0] + (grid.dims[0] * grid.cell) / 2,
        0,
        grid.min[2] + (grid.dims[2] * grid.cell) / 2,
      ];
  const spawn = collision.spawn(preferred);
  const chunks = chunkPlace(leveled.buffer, args.budget || 24000);
  return {
    source,
    result: {
      grid,
      chunks,
      spawn,
      floor: leveled.floor,
      count: source.count,
      prepareMs: performance.now() - started,
    },
  };
}
const buildRoomSpawn = () => [0, 0, -3.5];

export function chunkPlace(b, budget) {
  const bins = new Map();
  const stride = Math.max(1, b.count / budget);
  const grow = Math.min(2, Math.sqrt(stride));
  for (let j = 0; j < Math.min(b.count, budget); j++) {
    const i = Math.min(b.count - 1, Math.floor(j * stride));
    if (!eligible(b, i)) continue;
    const x = Math.floor(b.pos[i * 3] / 2.5),
      z = Math.floor(b.pos[i * 3 + 2] / 2.5);
    const key = `${x},${z}`;
    if (!bins.has(key)) bins.set(key, { center: [(x + 0.5) * 2.5, 1.5, (z + 0.5) * 2.5], idx: [] });
    bins.get(key).idx.push(i);
  }
  const chunks = [];
  for (const { center, idx } of bins.values()) {
    const out = new SplatBuffer(idx.length);
    out.count = idx.length;
    idx.forEach((i, j) => {
      out.pos.set(b.pos.subarray(i * 3, i * 3 + 3), j * 3);
      out.scale.set(b.scale.subarray(i * 3, i * 3 + 3), j * 3);
      for (let a = 0; a < 3; a++) out.scale[j * 3 + a] *= grow;
      out.rot.set(b.rot.subarray(i * 4, i * 4 + 4), j * 4);
      out.color.set(b.color.subarray(i * 4, i * 4 + 4), j * 4);
    });
    chunks.push({ center, buffer: out });
  }
  return chunks;
}
