// Lane Volume viewer: the gar sample, assets/toys/volume-viewer/gar.nii.gz.
//
//   node tools/vol-gar.mjs <VIMS22685_12-8mm.zip>
//
// The source is Brian Metscher's micro-CT of a 12.8 mm gar larva (Lepisosteus osseus), stained
// with phosphotungstic acid: Zenodo record 19021581, CC BY 4.0, file VIMS22685_12-8mm.zip (404 MB;
// download it from https://zenodo.org/records/19021581). Inside it, Lo16-1_12.8mm_VIMS22685.zip
// holds 502 8-bit TIFF slices of 480 × 804 pixels, 4.42 µm voxels (Lo11_16-1_AB_Recon.txt).
//
// The slices are read with the viewer's own reader (src/volume/read.js), averaged 4 × 4 × 4 (to
// 17.7 µm), cropped to the fish with a margin, and written as NIfTI-1 (8-bit, voxel size in mm,
// an sform that stands the fish upright: its back up and its snout to the left). The faint noise of
// the empty background (below a fifth of the background-to-tissue threshold) is set to 0 so the
// file compresses well; nothing else is changed.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { readVolume, unzip } from "../src/volume/read.js";
import { volumeStats } from "../src/volume/view.js";

const src = process.argv[2];
if (!src) {
  console.error("Usage: node tools/vol-gar.mjs <VIMS22685_12-8mm.zip>");
  process.exit(1);
}
const OUT = new URL("../assets/toys/volume-viewer/gar.nii.gz", import.meta.url).pathname;
const VOXEL_MM = 0.00442;
const SHRINK = 4;

const outer = await unzip(new Uint8Array(fs.readFileSync(src)));
const inner = outer.find((f) => /Lo16-1_12\.8mm_VIMS22685\.zip$/.test(f.name));
if (!inner) throw new Error("The inner zip of TIFF slices is missing.");
const slices = (await unzip(inner.bytes)).filter((f) => /\.tif$/i.test(f.name));
console.log(`${slices.length} slices`);
const n0 = [480, 804, slices.length];
const V = await readVolume(slices, { max: Math.ceil(n0[0] / SHRINK) * Math.ceil(n0[1] / SHRINK) * Math.ceil(n0[2] / SHRINK) }); // prettier-ignore
console.log("read", V.nx, V.ny, V.nz, V.shrink, V.min, V.max);
const st = volumeStats(V);
console.log("air", st.air, "dense", st.dense);
// Crop to the fish.
const lo = [V.nx, V.ny, V.nz];
const hi = [0, 0, 0];
for (let z = 0; z < V.nz; z++)
  for (let y = 0; y < V.ny; y++)
    for (let x = 0; x < V.nx; x++)
      if (V.data[(z * V.ny + y) * V.nx + x] > st.air) {
        const p = [x, y, z];
        for (let i = 0; i < 3; i++) {
          lo[i] = Math.min(lo[i], p[i]);
          hi[i] = Math.max(hi[i], p[i]);
        }
      }
const M = 3;
for (let i = 0; i < 3; i++) {
  lo[i] = Math.max(0, lo[i] - M);
  hi[i] = Math.min([V.nx, V.ny, V.nz][i] - 1, hi[i] + M);
}
const [nx, ny, nz] = [0, 1, 2].map((i) => hi[i] - lo[i] + 1);
console.log("crop", lo, hi, [nx, ny, nz]);
const floor = st.air / 5;
const vox = new Uint8Array(nx * ny * nz);
for (let z = 0; z < nz; z++)
  for (let y = 0; y < ny; y++)
    for (let x = 0; x < nx; x++) {
      const v = V.data[((z + lo[2]) * V.ny + y + lo[1]) * V.nx + x + lo[0]];
      vox[(z * ny + y) * nx + x] = v < floor ? 0 : Math.round(Math.min(255, Math.max(0, v)));
    }
const s = VOXEL_MM * SHRINK;
// The sform: which way each index axis runs in RAS (right, anterior, superior). The viewer draws
// RAS's left to the right, superior up and anterior toward the viewer. AXES is set from the
// renders: the slices' rows (y) run along the fish, its columns (x) from back to belly, the
// slices (z) across it.
const AXES = JSON.parse(process.env.GAR_AXES || "[[0,0,-1],[1,0,0],[0,1,0]]");
const h = new DataView(new ArrayBuffer(352));
h.setInt32(0, 348, true);
[3, nx, ny, nz, 1, 1, 1, 1].forEach((v, i) => h.setInt16(40 + 2 * i, v, true));
h.setInt16(70, 2, true); // uint8
h.setInt16(72, 8, true);
[1, s, s, s, 1, 1, 1, 1].forEach((v, i) => h.setFloat32(76 + 4 * i, v, true));
h.setFloat32(108, 352, true);
h.setFloat32(112, 1, true);
h.setUint8(123, 2); // millimeters
h.setInt16(254, 2, true); // sform: aligned to something else (a display frame, not a scanner)
for (let r = 0; r < 3; r++)
  for (let c = 0; c < 3; c++) h.setFloat32(280 + 16 * r + 4 * c, AXES[c][r] * s, true);
const desc = "Gar larva 12.8 mm, Metscher, Zenodo 19021581, CC BY 4.0";
new Uint8Array(h.buffer).set(new TextEncoder().encode(desc), 148);
new Uint8Array(h.buffer).set(new TextEncoder().encode("n+1\0"), 344);
const nii = Buffer.concat([Buffer.from(h.buffer), Buffer.from(vox.buffer)]);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, zlib.gzipSync(nii, { level: 9 }));
console.log(`Wrote ${OUT}: ${nx} × ${ny} × ${nz}, ${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB`);
