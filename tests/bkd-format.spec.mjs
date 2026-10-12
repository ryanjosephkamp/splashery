// Lane Baked engine (docs/handoff/BakedEngine.md): the baked splat format (src/baked.js), its
// tiers and thinning, the kit path, the converter (tools/port-convert.mjs) and the package
// checker (tools/port-check.mjs). No browser.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { readSplatPly } from "../src/viewers/splat-io.js";
import {
  BYTES_PER_SPLAT,
  SH_C0,
  packQuat,
  unpackQuat,
  tableRange,
  encodeChunk,
  decodeChunk,
  joinChunks,
  splatAt,
  chooseTier,
  loadBaked,
  addBaked,
} from "../src/baked.js";
import { buildRecipe, Kit } from "../src/kit.js";
import { applyClay } from "../src/generators.js";
import { RECIPES } from "../src/packs/baked-demo.js";
import { CHEST, HINGE, bakeChest } from "../tools/bkd-bake-chest.mjs";
import { convert, readGaussianPly, Refused } from "../tools/port-convert.mjs";
import { checkPackage, licenseOf } from "../tools/port-check.mjs";

const MANIFEST = pathToFileURL(path.resolve("assets/toys/baked-chest/manifest.json"));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "bkd-"));

function build(recipe, count) {
  const it = buildRecipe(recipe, { seed: 7, count, options: {} }, applyClay);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

test.describe("the format", () => {
  test("rotations come back within 0.25 degrees", () => {
    let seed = 5;
    const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296 - 0.5;
    let worst = 0;
    for (let i = 0; i < 20000; i++) {
      const q = [rnd(), rnd(), rnd(), rnd()];
      const l = Math.hypot(...q);
      const d = unpackQuat(packQuat(q));
      if (Math.abs(Math.hypot(...d) - 1) > 1e-6) throw new Error(`not unit: ${d}`);
      const dot = Math.abs(q.reduce((s, v, k) => s + (v / l) * d[k], 0));
      worst = Math.max(worst, (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI);
    }
    expect(worst).toBeLessThan(0.25);
  });

  test("the repository's trained PLYs round-trip within the stated errors, at 18 bytes a splat", () => {
    for (const file of ["assets/toys/video-3d/liberty.ply", "assets/toys/video-3d/edinburgh.ply"]) {
      const t = readSplatPly(new Uint8Array(fs.readFileSync(file)));
      const range = tableRange(t);
      const bytes = encodeChunk(t, 0, t.count, range);
      // The header is a few hundred bytes; the rest is 18 bytes a splat (plus at most 3 of padding).
      expect(bytes.length - BYTES_PER_SPLAT * t.count).toBeLessThan(400);
      const a = joinChunks([decodeChunk(bytes)], t.count);
      const ext = [0, 1, 2].map((k) => range.hi[k] - range.lo[k]);
      const sr = range.scaleHi - range.scaleLo;
      const worst = { pos: 0, rot: 0, scale: 0, color: 0, opacity: 0 };
      const s = { p: [0, 0, 0], scales: [0, 0, 0], quat: [0, 0, 0, 1], color: [0, 0, 0] };
      for (let i = 0; i < t.count; i++) {
        splatAt(a, i, s);
        const p = [t.x[i], t.y[i], t.z[i]];
        for (let k = 0; k < 3; k++) worst.pos = Math.max(worst.pos, Math.abs(s.p[k] - p[k]) / ext[k]); // prettier-ignore
        const dot = Math.abs(s.quat[0] * t.qx[i] + s.quat[1] * t.qy[i] + s.quat[2] * t.qz[i] + s.quat[3] * t.qw[i]); // prettier-ignore
        worst.rot = Math.max(worst.rot, (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI);
        const ls = [t.s0[i], t.s1[i], t.s2[i]];
        for (let k = 0; k < 3; k++) if (ls[k] >= range.scaleLo) worst.scale = Math.max(worst.scale, Math.abs(Math.log(s.scales[k]) - ls[k]) / sr); // prettier-ignore
        const dc = [t.r[i], t.g[i], t.b[i]];
        for (let k = 0; k < 3; k++) worst.color = Math.max(worst.color, Math.abs(s.color[k] - Math.min(1, Math.max(0, 0.5 + SH_C0 * dc[k])))); // prettier-ignore
        worst.opacity = Math.max(
          worst.opacity,
          Math.abs(s.opacity - 1 / (1 + Math.exp(-t.opacity[i]))),
        );
      }
      // Half a step of each quantizer (plus float32 rounding).
      expect(worst.pos, file).toBeLessThan(0.5 / 65535 + 1e-6);
      expect(worst.rot, file).toBeLessThan(0.25);
      expect(worst.scale, file).toBeLessThan(0.5 / 255 + 1e-5);
      expect(worst.color, file).toBeLessThan(0.5 / 255 + 1e-6);
      expect(worst.opacity, file).toBeLessThan(0.5 / 255 + 1e-6);
    }
  });

  test("a chunk refuses the wrong magic and a cut-short file", () => {
    const t = readSplatPly(new Uint8Array(fs.readFileSync("assets/toys/video-3d/liberty.ply")));
    const bytes = encodeChunk(t, 0, 1000, tableRange(t, 1000));
    expect(() => decodeChunk(bytes.slice(0, bytes.length - 10))).toThrow(/cut short/);
    const bad = bytes.slice();
    bad[0] = 0x50;
    expect(() => decodeChunk(bad)).toThrow(/not a baked splat file/);
    // Bytes that don't start on a 4-byte boundary decode the same (Node's pooled buffers).
    const shifted = new Uint8Array(bytes.length + 1).subarray(1);
    shifted.set(bytes);
    const a = joinChunks([decodeChunk(bytes)], 1000);
    const b = joinChunks([decodeChunk(shifted)], 1000);
    expect(Array.from(b.rot)).toEqual(Array.from(a.rot));
  });
});

test.describe("tiers and thinning", () => {
  const m = { tiers: [{ splats: 30000 }, { splats: 100001 }], defaultTier: 30000 };

  test("the budget picks the largest tier that fits; below the smallest it thins", () => {
    expect(chooseTier(m, 400000)).toEqual({ tier: m.tiers[1], n: 100001 });
    expect(chooseTier(m, 140000)).toEqual({ tier: m.tiers[1], n: 100001 });
    expect(chooseTier(m, 100001)).toEqual({ tier: m.tiers[1], n: 100001 });
    expect(chooseTier(m, 60000)).toEqual({ tier: m.tiers[0], n: 30000 });
    expect(chooseTier(m, 20000)).toEqual({ tier: m.tiers[0], n: 20000 });
    expect(chooseTier(m, 10)).toEqual({ tier: m.tiers[0], n: 1000 });
    expect(chooseTier(m, 0)).toEqual({ tier: m.tiers[0], n: 30000 });
  });

  test("thinning is the same splats every time, the tier's first ones, grown to close the surface", async () => {
    const a = await loadBaked(MANIFEST, { budget: 20000 });
    const full = await loadBaked(MANIFEST, { budget: 60000 });
    expect(a.n).toBe(20000);
    expect(a.tier.splats).toBe(30000);
    expect(a.grow).toBeCloseTo(Math.sqrt(30000 / 20000), 9);
    expect(full.grow).toBe(1);
    // The same as the whole tier's first 20,000, and the same again on a fresh read.
    expect(Array.from(a.pos)).toEqual(Array.from(full.pos.subarray(0, 60000)));
    expect(Array.from(a.rot)).toEqual(Array.from(full.rot.subarray(0, 20000)));
    const raw = fs.readFileSync("assets/toys/baked-chest/assets/baked-chest-30000-0.bkd.gz");
    const again = joinChunks([decodeChunk(new Uint8Array(zlib.gunzipSync(raw)))], 20000);
    expect(Array.from(again.pos)).toEqual(Array.from(a.pos));
    // An even sample: the thinned splats cover the chest like the whole tier (the lid's share).
    const lidShare = (x) => x.part.reduce((s, p) => s + (p === 1), 0) / x.n;
    expect(Math.abs(lidShare(a) - lidShare(full))).toBeLessThan(0.02);
  });

  test("the large tier loads only for a large budget, from its two files", async () => {
    const big = await loadBaked(MANIFEST, { budget: 140000 });
    expect(big.n).toBe(100001);
    expect(big.tier.files.length).toBe(2);
  });
});

test.describe("the kit path", () => {
  const recipe = RECIPES["baked-chest"];

  test("the example builds at two tiers, with the lid as its own part", async () => {
    for (const [count, splats] of [
      [60000, 30000],
      [140000, 100001],
    ]) {
      await recipe.prepare({}, {}, { count });
      const ctx = build(recipe, count);
      expect(ctx.kit.data.tier).toEqual({ splats, used: splats });
      expect(ctx.buf.count).toBe(splats);
      expect(ctx.parts.map((p) => p.name)).toEqual(["body", "lid"]);
    }
  });

  test("the lid's splats and the body's are cut cleanly at the hinge, so each moves as a solid piece", async () => {
    await recipe.prepare({}, {}, { count: 140000 });
    const ctx = build(recipe, 140000);
    const { center, scale } = ctx.transform;
    const lid = ctx.parts.findIndex((p) => p.name === "lid");
    // The lid's pivot is the hinge, moved by the fit like the splats.
    for (let k = 0; k < 3; k++) expect(ctx.parts[lid].pivot[k]).toBeCloseTo((HINGE.pivot[k] - center[k]) * scale, 4); // prettier-ignore
    let lidN = 0;
    const wrong = [];
    for (let i = 0; i < ctx.buf.count; i++) {
      const y = ctx.buf.pos[i * 3 + 1] / scale + center[1];
      const part = ctx.buf.anim[i * 4] % 16;
      if (part === lid) lidN++;
      if (part === lid ? y < CHEST.h - 0.002 : y > CHEST.h + 0.012) wrong.push([i, part, y]);
    }
    expect(wrong.slice(0, 5)).toEqual([]);
    expect(lidN).toBeGreaterThan(20000);
    // drive() turns only the lid, about its hinge, all the way open and back.
    const out = { parts: {} };
    recipe.drive(0, { open: 1 }, out);
    expect(Object.keys(out.parts)).toEqual(["lid"]);
    expect(out.parts.lid.angle).toBeCloseTo(-1.85, 6);
    recipe.drive(0, { open: 0 }, out);
    expect(out.parts.lid.angle).toBeCloseTo(0, 6);
  });

  test("addBaked keeps the kit's other pieces and the 15-part limit", async () => {
    const asset = await loadBaked(MANIFEST, { budget: 20000 });
    const k = new Kit(1, { count: 40000 });
    k.add(k.sphere(0.2), { pos: [0, 2, 0], share: 0.25 });
    const item = addBaked(k, asset, { pos: [0, 0, 0] });
    const it = k.emit();
    while (!it.next().done);
    expect(item.end - item.start).toBe(20000);
    expect(k.buf.count).toBe(30000);
    const k2 = new Kit(1, { count: 40000 });
    for (let i = 0; i < 15; i++) k2.part(`p${i}`);
    expect(() => addBaked(k2, asset)).toThrow(/at most 15 parts/);
  });
});

test.describe("the converter", () => {
  test("turns a 3DGS PLY and its parts sidecar into tiers, with a manifest", () => {
    const dir = tmp();
    const { ply, parts, n } = bakeChest({ count: 12000 });
    fs.writeFileSync(path.join(dir, "chest.ply"), ply);
    fs.writeFileSync(path.join(dir, "chest.parts.json"), JSON.stringify(parts));
    const out = path.join(dir, "out");
    const m = convert([path.join(dir, "chest.ply")], {
      out,
      id: "chest",
      tiers: [4000],
      chunk: 2048,
    });
    expect(m.format).toBe("splashery-baked-manifest");
    expect(m.source.sha256).toBe(parts.sha256);
    expect(m.parts).toEqual([{ id: 0, name: "body" }, { id: 1, name: "lid", pivot: HINGE.pivot, axis: HINGE.axis }]); // prettier-ignore
    expect(m.tiers.map((t) => t.splats)).toEqual([4000, n]);
    expect(m.tiers[1].files.length).toBe(Math.ceil(n / 2048));
    for (const t of m.tiers)
      for (const f of t.files) expect(fs.statSync(path.join(out, f.path)).size).toBe(f.bytes);
    expect(Object.keys(m.credit)).toEqual(["title", "author", "source", "license", "licenseUrl", "checked", "changes"]); // prettier-ignore
    // The thinned tier is the full tier's first 4,000 splats (an even sample), each grown by
    // sqrt(n / 4000) to close the surface.
    const read = (t) => joinChunks(t.files.map((f) => decodeChunk(new Uint8Array(fs.readFileSync(path.join(out, f.path))))), t.splats); // prettier-ignore
    const small = read(m.tiers[0]);
    const full = read(m.tiers[1]);
    const a = { p: [0, 0, 0], scales: [0, 0, 0], quat: [0, 0, 0, 1], color: [0, 0, 0] };
    const b = { p: [0, 0, 0], scales: [0, 0, 0], quat: [0, 0, 0, 1], color: [0, 0, 0] };
    for (let i = 0; i < 4000; i += 37) {
      splatAt(small, i, a);
      splatAt(full, i, b);
      for (let k = 0; k < 3; k++) {
        expect(Math.abs(a.p[k] - b.p[k])).toBeLessThan(1e-3);
        expect(
          Math.abs(Math.log(a.scales[k] / b.scales[k]) - 0.5 * Math.log(n / 4000)),
        ).toBeLessThan(0.08);
      }
      expect(a.part).toBe(b.part);
    }
  });

  test("refuses files that aren't valid 3DGS PLYs, and a sidecar for another PLY", () => {
    const dir = tmp();
    const { ply, parts } = bakeChest({ count: 3000 });
    const head = new TextDecoder().decode(ply.subarray(0, 600));
    const offset = head.indexOf("end_header\n") + 11;
    const cases = {
      "text.ply": new TextEncoder().encode("ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n"), // prettier-ignore
      "short.ply": ply.subarray(0, ply.length - 7),
      "points.ply": new TextEncoder().encode(head.slice(0, offset).replace(/property float f_dc_0\n/, "")), // prettier-ignore
      "nan.ply": (() => {
        const b = ply.slice();
        new DataView(b.buffer).setFloat32(offset + 4, NaN, true);
        return b;
      })(),
      "not.ply": new TextEncoder().encode("hello"),
    };
    for (const [name, bytes] of Object.entries(cases)) {
      fs.writeFileSync(path.join(dir, name), bytes);
      expect(() => convert([path.join(dir, name)], { out: path.join(dir, "o") }), name).toThrow(Refused); // prettier-ignore
    }
    expect(() => readGaussianPly(cases["short.ply"])).toThrow(/bytes/);
    fs.writeFileSync(path.join(dir, "a.ply"), ply);
    fs.writeFileSync(path.join(dir, "a.parts.json"), JSON.stringify({ ...parts, sha256: "0".repeat(64) })); // prettier-ignore
    expect(() => convert([path.join(dir, "a.ply")], { out: path.join(dir, "o") })).toThrow(/another PLY/); // prettier-ignore
  });
});

test.describe("the package checker", () => {
  // A good package: the example's recipe, its baked asset and a record.
  function goodPackage() {
    const dir = tmp();
    fs.cpSync("assets/toys/baked-chest", dir, { recursive: true });
    fs.copyFileSync("src/packs/baked-demo.js", path.join(dir, "recipe.mjs"));
    fs.writeFileSync(path.join(dir, "record.md"), "# Baked chest\n\nMade by Ryan with Claude Code (Opus 5.5). Rule check: none.\n"); // prettier-ignore
    return dir;
  }
  const edit = (dir, file, fn) => {
    const f = path.join(dir, file);
    fs.writeFileSync(f, fn(fs.readFileSync(f, "utf8")));
  };

  test("passes a good package", () => {
    const r = checkPackage(goodPackage());
    expect(r.blocks).toEqual([]);
    expect(r.warns).toEqual([]);
  });

  test("blocks a bad package for each rule, and only warns on size and code strings", () => {
    const blocked = (fn) => {
      const dir = goodPackage();
      fn(dir);
      return checkPackage(dir).blocks.join("\n");
    };
    expect(blocked((d) => edit(d, "recipe.mjs", (s) => `import "https://cdn.jsdelivr.net/npm/x@1/x.js";\n${s}`))).toMatch(/CDN/); // prettier-ignore
    expect(blocked((d) => edit(d, "recipe.mjs", (s) => `import * as pc from "../../vendor/playcanvas.mjs";\n${s}`))).toMatch(/src\/pc\.js/); // prettier-ignore
    expect(blocked((d) => edit(d, "recipe.mjs", (s) => `import * as THREE from "three";\n${s}`))).toMatch(/bare module/); // prettier-ignore
    expect(blocked((d) => edit(d, "recipe.mjs", (s) => `${s}\nfetch("https://example.org/data.json");\n`))).toMatch(/outside address/); // prettier-ignore
    expect(blocked((d) => edit(d, "record.md", (s) => `${s}\nToken: hf_${"a1B2".repeat(9)}\n`))).toMatch(/Hugging Face/); // prettier-ignore
    expect(blocked((d) => edit(d, "manifest.json", (s) => s.replace('"CC0 1.0"', '"CC BY-ND 4.0"')))).toMatch(/isn't allowed/); // prettier-ignore
    expect(blocked((d) => edit(d, "manifest.json", (s) => s.replace('"CC0 1.0"', '""')))).toMatch(/no license/); // prettier-ignore
    expect(blocked((d) => edit(d, "manifest.json", (s) => s.replace('"CC0 1.0"', '"CC BY-NC 4.0"')))).toMatch(/"nc": true/); // prettier-ignore
    expect(blocked((d) => edit(d, "manifest.json", (s) => s.replace('"source": "tools/bkd-bake-chest.mjs"', '"source": ""')))).toMatch(/no source/); // prettier-ignore
    expect(blocked((d) => fs.writeFileSync(path.join(d, "assets/extra.png"), "x"))).toMatch(/not listed/); // prettier-ignore
    expect(blocked((d) => fs.appendFileSync(path.join(d, "assets/baked-chest-30000-0.bkd.gz"), "x"))).toMatch(/hash/); // prettier-ignore
    expect(blocked((d) => edit(d, "record.md", (s) => `${s}\nThe colour of the centre.\n`))).toMatch(/color/); // prettier-ignore
    expect(blocked((d) => fs.rmSync(path.join(d, "record.md")))).toMatch(/no record\.md/);
    // Warnings only: a British spelling inside a code string, and a big default tier.
    const dir = goodPackage();
    edit(dir, "recipe.mjs", (s) => s.replace('label: "Open"', 'label: "Open the colour"'));
    const big = path.join(dir, "assets/baked-chest-30000-0.bkd.gz");
    fs.writeFileSync(big, Buffer.alloc(16 * 1024 * 1024));
    const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    m.tiers[0].files[0].sha256 = crypto.createHash("sha256").update(fs.readFileSync(big)).digest("hex"); // prettier-ignore
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(m));
    const r = checkPackage(dir);
    expect(r.warns.join("\n")).toMatch(/colour/);
    expect(r.warns.join("\n")).toMatch(/15 MB/);
    expect(r.blocks.join("\n")).not.toMatch(/MB/);
  });

  test("knows the allowed licenses", () => {
    for (const ok of ["CC0 1.0", "CC BY 4.0", "CC BY-SA 4.0", "CC BY-NC 4.0", "CC BY-NC-SA 4.0", "Public domain", "NASA media guidelines"]) // prettier-ignore
      expect(licenseOf(ok), ok).not.toBeNull();
    for (const no of ["CC BY-ND 4.0", "CC BY-NC-ND 4.0", "MIT", "All rights reserved", "personal use", ""]) // prettier-ignore
      expect(licenseOf(no), no).toBeNull();
  });
});
