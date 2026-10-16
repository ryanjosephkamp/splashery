// Lane SE1 (engine): the kit tables (src/kit-tables.js) and the splat file
// parsers (src/splat-parsers.js) load in plain Node with no engine and no
// DOM, so another project (the Shop's bench) can import them; the old
// modules re-export the same objects; a shipped PLY parses in Node; and a
// kit toy's ctx.kit.items (the provenance API in docs/PACKS.md) cover its
// splats in order.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULES = ["src/kit-tables.js", "src/splat-parsers.js"];

// Every module a file reaches through static imports, re-exports and
// dynamic imports with a literal path.
function moduleGraph(entry) {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = fs.readFileSync(file, "utf8");
    const re = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;
    for (const m of src.matchAll(re)) {
      const spec = m[1];
      if (!spec.startsWith(".")) throw new Error(`${file} imports a bare module: ${spec}`);
      walk(path.resolve(path.dirname(file), spec));
    }
  };
  walk(path.join(ROOT, entry));
  return [...seen].map((f) => path.relative(ROOT, f));
}

test("the kit tables and the parsers reach neither the engine, vendor/, nor the DOM", () => {
  for (const entry of MODULES) {
    const graph = moduleGraph(entry);
    expect(graph[0]).toBe(entry);
    for (const f of graph) {
      expect(f, `${entry} reaches ${f}`).not.toBe("src/pc.js");
      expect(f.startsWith("vendor/"), `${entry} reaches ${f}`).toBe(false);
      const src = fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\/\/.*$/gm, "");
      expect(src, `${f} names a DOM global`).not.toMatch(
        /\b(window|document|navigator|HTMLElement|HTMLCanvasElement|OffscreenCanvas|localStorage)\b/,
      );
    }
  }
});

test("the kit tables and the parsers import in plain Node with any DOM global read throwing", () => {
  // A fresh Node process, so nothing an earlier import cached hides a read.
  const script = `
    for (const name of ["window", "document", "navigator", "self", "HTMLElement", "pc"]) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get() { throw new Error("read " + name); },
      });
    }
    const t = await import(${JSON.stringify(path.join(ROOT, MODULES[0]))});
    const p = await import(${JSON.stringify(path.join(ROOT, MODULES[1]))});
    console.log(JSON.stringify({ t: Object.keys(t).sort(), p: Object.keys(p).sort() }));
  `;
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
  });
  const keys = JSON.parse(out.trim());
  expect(keys.t).toEqual(["KINDS", "MAX_LEVERS", "MAX_LEVER_GROUPS", "MORPH_RANGE"]);
  for (const k of ["UNSUPPORTED", "LIMITS", "extOf", "parseSplat", "parseSpz"])
    expect(keys.p).toContain(k);
  for (const k of ["readPlyHeader", "decimatePly", "fileOpenError", "robustBounds"])
    expect(keys.p).toContain(k);
});

test("effects.js and loaders.js re-export the very same objects", async () => {
  const tables = await import("../src/kit-tables.js");
  const effects = await import("../src/effects.js");
  for (const k of ["KINDS", "MORPH_RANGE", "MAX_LEVERS", "MAX_LEVER_GROUPS"])
    expect(effects[k], k).toBe(tables[k]);
  const parsers = await import("../src/splat-parsers.js");
  const loaders = await import("../src/loaders.js");
  const names = Object.keys(parsers);
  expect(names.length).toBeGreaterThanOrEqual(9);
  for (const k of names) expect(loaders[k], k).toBe(parsers[k]);
});

test("a shipped PLY and a .splat parse in plain Node", async () => {
  const { readPlyHeader, decimatePly, parseSplat, extOf } = await import("../src/splat-parsers.js");
  const file = path.join(ROOT, "assets/toys/video-3d/adjara.ply");
  const bytes = new Uint8Array(fs.readFileSync(file));
  expect(extOf(file)).toBe("ply");
  const h = readPlyHeader(bytes);
  expect(h.format).toBe("binary_little_endian");
  expect(h.compressed).toBe(false);
  // The vertex count the header states matches the bytes after it.
  const stride = h.vertex.props.length * 4;
  expect(h.vertex.props.every((p) => p.type === "float")).toBe(true);
  expect(h.count).toBeGreaterThan(1000);
  expect(bytes.length - h.offset).toBe(h.count * stride);
  const all = decimatePly(bytes, h, h.count);
  expect(all.count).toBe(h.count);
  const x = all.props.find((p) => p.name === "x").storage;
  expect(x.every(Number.isFinite)).toBe(true);
  const half = decimatePly(bytes, h, h.count / 2, 7);
  expect(Math.abs(half.count / h.count - 0.5)).toBeLessThan(0.05);

  // A .splat of three splats, written here (no .splat ships with the site).
  const buf = new ArrayBuffer(3 * 32);
  const dv = new DataView(buf);
  for (let i = 0; i < 3; i++) {
    const o = i * 32;
    [i, -i, 0.5].forEach((v, k) => dv.setFloat32(o + k * 4, v, true));
    [0.1, 0.2, 0.3].forEach((v, k) => dv.setFloat32(o + 12 + k * 4, v, true));
    [255, 128, 0, 255, 255, 128, 128, 128].forEach((v, k) => dv.setUint8(o + 24 + k, v));
  }
  const s = parseSplat(new Uint8Array(buf));
  expect(s.count).toBe(3);
  expect([s.x[2], s.y[2], s.z[2]]).toEqual([2, -2, 0.5]);
  expect(s.s1[0]).toBeCloseTo(Math.log(0.2), 5);
  expect(s.qw[1]).toBeCloseTo(1, 5);
});

test("a kit toy's ctx.kit.items cover its splats in order, each with a kind", async ({ page }) => {
  await page.goto("/?renderer=webgl2&adapt=off&watch=off");
  await page.waitForSelector("body[data-ready='true']", { timeout: 120_000 });
  await page.evaluate(() => window.__splashery.app.chooseToy("clock"));
  await page.waitForFunction(
    () => window.__splashery.player.scene.toy.id === "clock" && window.__splashery.player.proc?.ctx?.kit, // prettier-ignore
    null,
    { timeout: 120_000 },
  );
  const r = await page.evaluate(() => {
    const ctx = window.__splashery.player.proc.ctx;
    return {
      count: ctx.buf.count,
      clay: window.__splashery.player.scene.clay?.length || 0,
      items: ctx.kit.items.map((it) => ({ start: it.start, end: it.end, kind: it.kind, part: it.opts.part })), // prettier-ignore
    };
  });
  expect(r.clay).toBe(0);
  expect(r.items.length).toBeGreaterThan(3);
  let at = 0;
  for (const it of r.items) {
    expect(it.start).toBe(at);
    expect(it.end).toBeGreaterThanOrEqual(it.start);
    expect(["surface", "cloud"]).toContain(it.kind);
    at = it.end;
  }
  expect(at).toBe(r.count);
});
