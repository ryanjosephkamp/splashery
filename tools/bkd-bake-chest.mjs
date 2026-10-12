#!/usr/bin/env node
// Lane Baked engine: bakes the example asset of the baked path (the "Baked chest" labs toy,
// src/packs/baked-demo.js). It builds a wooden chest with the kit in Node (no fit, so the
// coordinates stay the recipe's), writes it as a standard 3DGS binary PLY with a *.parts.json
// sidecar (the lid is part 1, with its hinge), the way an outside agent's bake arrives, and
// converts that with tools/port-convert.mjs into assets/toys/baked-chest/ at two tiers.
//
//   node tools/bkd-bake-chest.mjs [--ply-dir <folder>]   (the PLY and sidecar go there; default
//                                                        a temporary folder, not the repo)
//
// Made by Splashery itself (MIT, like the code), so it needs no third-party credit.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { Kit, mix, shade, smoothstep } from "../src/kit.js";
import { convert } from "./port-convert.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const CHEST = { w: 1.6, h: 0.86, d: 1.0, lidR: 0.5, lidH: 0.34, wall: 0.06 };
export const HINGE = { pivot: [0, CHEST.h, -CHEST.d / 2], axis: [1, 0, 0] };

const WOOD = ["#6b3f1f", "#7d4a24", "#5c3418"];
const IRON = "#3a3b3f";

// Planks run along x; grooves between them are darker.
function plank(c, across) {
  const k = Math.floor(across * 5);
  const f = across * 5 - k;
  const base = WOOD[k % 3];
  const grain = 0.9 + 0.12 * c.noise.fbm(c.p[0] * 3, c.p[1] * 40, c.p[2] * 40, 2);
  const groove = f < 0.05 || f > 0.95 ? 0.55 : 1;
  return shade(base, grain * groove);
}

export function buildChest(k) {
  const { w, h, d, lidR, lidH, wall } = CHEST;
  const lid = k.part("lid", HINGE);
  // The box: four walls and a floor, open at the top (the inside shows when the lid opens).
  const wallOpts = (across) => ({ color: (c) => plank(c, across(c)), flat: 0.15, even: true, jitter: 0.01 }); // prettier-ignore
  k.add(k.box(w, h, wall), { pos: [0, h / 2, d / 2 - wall / 2], ...wallOpts((c) => c.p[1] / h) });
  k.add(k.box(w, h, wall), { pos: [0, h / 2, -d / 2 + wall / 2], ...wallOpts((c) => c.p[1] / h) });
  k.add(k.box(wall, h, d - 2 * wall), { pos: [w / 2 - wall / 2, h / 2, 0], ...wallOpts((c) => c.p[1] / h) }); // prettier-ignore
  k.add(k.box(wall, h, d - 2 * wall), { pos: [-w / 2 + wall / 2, h / 2, 0], ...wallOpts((c) => c.p[1] / h) }); // prettier-ignore
  k.add(k.box(w - 2 * wall, wall, d - 2 * wall), { pos: [0, wall / 2, 0], ...wallOpts((c) => (c.p[2] + d / 2) / d) }); // prettier-ignore
  // Gold inside: a heap of coins under the rim, bright where it faces up.
  k.add(k.param((u, v) => {
    const x = (u - 0.5) * (w - 2 * wall - 0.04);
    const z = (v - 0.5) * (d - 2 * wall - 0.04);
    const r = Math.hypot(x / (w / 2), z / (d / 2));
    return [x, h * 0.62 + 0.16 * Math.max(0, 1 - r * r), z];
  }, { grid: 48 }), {
    weight: 1.4,
    flat: 0.3,
    color: (c) => mix("#9a6b12", "#ffd75a", smoothstep(-0.3, 0.6, c.noise.fbm(c.p[0] * 14, 0, c.p[2] * 14, 2))), // prettier-ignore
  });
  // Iron bands round the box, and a lock plate on the front.
  for (const x of [-w * 0.32, w * 0.32]) {
    k.add(k.box(0.09, h + 0.01, 0.012), { pos: [x, h / 2, d / 2 + 0.006], color: IRON, flat: 0.1 }); // prettier-ignore
    k.add(k.box(0.09, h + 0.01, 0.012), { pos: [x, h / 2, -d / 2 - 0.006], color: IRON, flat: 0.1 }); // prettier-ignore
  }
  k.add(k.box(0.22, 0.24, 0.016), { pos: [0, h - 0.16, d / 2 + 0.01], weight: 3, color: (c) => (Math.hypot(c.p[0], c.p[1] - (h - 0.18)) < 0.025 ? "#0c0c0e" : "#b08a2e"), flat: 0.1 }); // prettier-ignore
  // The lid: a curved top (half a squashed cylinder along x) with its two ends and bands, all
  // part "lid", hinged at the back top edge.
  const arch = (a) => [Math.cos(a) * lidR, h + Math.sin(a) * lidH];
  k.add(k.param((u, v) => {
    const [z, y] = arch(v * Math.PI);
    return [(u - 0.5) * w, y, z];
  }, { grid: 64 }), { part: lid, ...wallOpts((c) => Math.acos(Math.max(-1, Math.min(1, c.p[2] / lidR))) / Math.PI) }); // prettier-ignore
  for (const s of [-1, 1]) {
    k.add(k.param((u, v) => {
      const [z, y] = arch(v * Math.PI);
      return [(s * w) / 2, h + (y - h) * u, z * u];
    }, { grid: 32, flip: s < 0 }), { part: lid, color: (c) => plank(c, c.p[1] - h), flat: 0.15 }); // prettier-ignore
    k.add(k.param((u, v) => {
      const [z, y] = arch(v * Math.PI);
      return [s * w * 0.32 + (u - 0.5) * 0.09, y + 0.006 * Math.sin(v * Math.PI), z * 1.012];
    }, { grid: 24 }), { part: lid, color: IRON, flat: 0.1, weight: 2 }); // prettier-ignore
  }
  // The lid's underside (a flat board), seen when it opens.
  k.add(k.box(w - 0.02, 0.02, d - 0.02), { pos: [0, h + 0.01, 0], part: lid, color: (c) => shade(plank(c, (c.p[2] + d / 2) / d), 0.7), flat: 0.15 }); // prettier-ignore
  return lid;
}

const C0 = 0.28209479177387814;
const logit = (p) => Math.log(Math.min(0.999, Math.max(0.001, p)) / (1 - Math.min(0.999, Math.max(0.001, p)))); // prettier-ignore

// A kit buffer as a standard 3DGS PLY (68 bytes a splat with normals).
export function plyOf(buf) {
  const n = buf.count;
  const props = ["x", "y", "z", "nx", "ny", "nz", "f_dc_0", "f_dc_1", "f_dc_2", "opacity", "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]; // prettier-ignore
  const head = `ply\nformat binary_little_endian 1.0\nelement vertex ${n}\n${props.map((p) => `property float ${p}\n`).join("")}end_header\n`; // prettier-ignore
  const hb = new TextEncoder().encode(head);
  const out = new Uint8Array(hb.length + n * props.length * 4);
  out.set(hb);
  const f = new Float32Array(out.buffer, hb.length, n * props.length);
  for (let i = 0; i < n; i++) {
    const o = i * props.length;
    f[o] = buf.pos[i * 3];
    f[o + 1] = buf.pos[i * 3 + 1];
    f[o + 2] = buf.pos[i * 3 + 2];
    for (let c = 0; c < 3; c++) f[o + 6 + c] = (buf.color[i * 4 + c] - 0.5) / C0;
    f[o + 9] = logit(buf.color[i * 4 + 3]);
    for (let c = 0; c < 3; c++) f[o + 10 + c] = Math.log(Math.max(1e-7, buf.scale[i * 3 + c]));
    f[o + 13] = buf.rot[i * 4 + 3];
    f[o + 14] = buf.rot[i * 4];
    f[o + 15] = buf.rot[i * 4 + 1];
    f[o + 16] = buf.rot[i * 4 + 2];
  }
  return out;
}

export function bakeChest({ count = 100000, seed = 2026 } = {}) {
  const k = new Kit(seed, { count, fit: false });
  buildChest(k);
  const it = k.emit();
  while (!it.next().done);
  const buf = k.buf;
  const ply = plyOf(buf);
  const ids = new Uint8Array(buf.count);
  for (let i = 0; i < buf.count; i++) ids[i] = buf.anim[i * 4] % 16;
  const sha = crypto.createHash("sha256").update(ply).digest("hex");
  const parts = {
    sha256: sha,
    parts: [{ id: 1, name: "lid", pivot: HINGE.pivot, axis: HINGE.axis }],
    ids_b64: Buffer.from(ids).toString("base64"),
  };
  return { ply, parts, n: buf.count };
}

if (import.meta.url === new URL(`file://${path.resolve(process.argv[1] || "")}`).href) {
  const at = process.argv.indexOf("--ply-dir");
  const dir = at > 0 ? process.argv[at + 1] : fs.mkdtempSync(path.join(os.tmpdir(), "bkd-chest-"));
  fs.mkdirSync(dir, { recursive: true });
  const { ply, parts, n } = bakeChest();
  fs.writeFileSync(path.join(dir, "baked-chest.ply"), ply);
  fs.writeFileSync(path.join(dir, "baked-chest.parts.json"), JSON.stringify(parts));
  console.log(`Baked ${n} splats into ${dir}/baked-chest.ply (${(ply.length / 1048576).toFixed(1)} MB).`); // prettier-ignore
  const out = path.join(root, "assets/toys/baked-chest");
  fs.rmSync(path.join(out, "assets"), { recursive: true, force: true });
  const m = convert([path.join(dir, "baked-chest.ply")], { out, id: "baked-chest", tiers: [30000], gzip: true, default: 30000 }); // prettier-ignore
  for (const t of m.tiers) console.log(`${t.splats} splats: ${(t.bytes / 1048576).toFixed(2)} MB`);
}
