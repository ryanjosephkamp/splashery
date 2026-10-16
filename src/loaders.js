// Loading splat files: built-in toys (SOG, fetched with progress) and files
// people bring themselves. PLY and SOG go through the engine's own parsers;
// .splat and .spz (versions 1 to 3) are decoded in src/splat-parsers.js.
// Everything stays in the browser: files are read locally and never uploaded.

import * as pc from "./pc.js";
export {
  UNSUPPORTED,
  LIMITS,
  extOf,
  fileOpenError,
  parseSplat,
  parseSpz,
  readPlyHeader,
  decimatePly,
  robustBounds,
} from "./splat-parsers.js"; // the parts that need no engine (lane SE1)

// Fetches a URL, reporting progress (0..1) as it streams.
export async function fetchBytes(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status}).`);
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !total) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onProgress?.(1);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    // A compressed response's content-length is smaller than what streams (lane Fix6).
    onProgress?.(Math.min(0.99, got / total));
  }
  onProgress?.(1);
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

// Loads PLY / SOG bytes through the engine's parsers. Resolves with the asset.
export function loadNative(stage, bytes, filename) {
  const app = stage.app;
  const url = URL.createObjectURL(new Blob([bytes]));
  const asset = new pc.Asset(filename, "gsplat", { url, filename });
  app.assets.add(asset);
  return new Promise((resolve, reject) => {
    const done = () => URL.revokeObjectURL(url);
    asset.once("load", () => {
      done();
      resolve(asset);
    });
    asset.once("error", (err) => {
      done();
      app.assets.remove(asset);
      reject(new Error(typeof err === "string" ? err : err?.message || "Could not read the file."));
    });
    app.assets.load(asset);
  });
}

// Builds an engine resource from plain arrays in PLY conventions.
export function resourceFromArrays(stage, a) {
  const props = [];
  const add = (name, storage) => props.push({ name, type: "float", byteSize: 4, storage });
  add("x", a.x);
  add("y", a.y);
  add("z", a.z);
  add("f_dc_0", a.r);
  add("f_dc_1", a.g);
  add("f_dc_2", a.b);
  add("opacity", a.opacity);
  add("scale_0", a.s0);
  add("scale_1", a.s1);
  add("scale_2", a.s2);
  add("rot_0", a.qw);
  add("rot_1", a.qx);
  add("rot_2", a.qy);
  add("rot_3", a.qz);
  if (a.rest) a.rest.forEach((arr, i) => add(`f_rest_${i}`, arr));
  const data = new pc.GSplatData([{ name: "vertex", count: a.count, properties: props }]);
  return new pc.GSplatResource(stage.device, data, { prepareCenters: true });
}

export function resourceFromProps(stage, { count, props }) {
  const data = new pc.GSplatData([{ name: "vertex", count, properties: props }]);
  return new pc.GSplatResource(stage.device, data, { prepareCenters: true });
}
