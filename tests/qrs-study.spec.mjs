// Lane QR lab r2 (docs/handoff/QRLabR2.md): the study of splat QR codes
// (tools/qrs-study.mjs) runs on a tiny grid and gives sane rows: a clean code
// reads with all three readers, a code whose finder is torn off reads with
// none. Node only, no browser.

import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { wilson, crossing } from "../tools/qrs-study/core.mjs";
import { render } from "../tools/qrs-study/raster.mjs";

test.setTimeout(120_000);

test("the study's statistics", () => {
  const [lo, hi] = wilson(9, 10);
  expect(lo).toBeGreaterThan(0.59);
  expect(lo).toBeLessThan(0.61);
  expect(hi).toBeGreaterThan(0.98);
  expect(wilson(0, 0)).toEqual([0, 0]);
  const pts = [
    { x: 0, rate: 1 },
    { x: 1, rate: 1 },
    { x: 2, rate: 0.5 },
    { x: 3, rate: 0 },
  ];
  expect(crossing(pts, 0.9).x).toBeCloseTo(1.2, 6);
  expect(crossing(pts, 0.5).kind).toBe("crossed");
  expect(crossing(pts, 0.5).x).toBeCloseTo(2, 6);
  expect(crossing([{ x: 0, rate: 1 }], 0.9).kind).toBe("never");
});

test("the rasterizer draws one splat as a Gaussian", () => {
  const img = render(
    [{ p: [0, 0, 0], scales: [1, 1, 0.01], quat: [0, 0, 0, 1], color: [1, 1, 1], opacity: 0.8 }],
    { width: 21, height: 21, ortho: true, ppm: 2 },
    { backdrop: [0, 0, 0], lowpass: 0 },
  );
  const at = (x, y) => img.data[(y * 21 + x) * 4];
  // σ = 2 px, centered on pixel 10: alpha 0.8 there, 0.8 · exp(-½) two
  // pixels away.
  expect(Math.abs(at(10, 10) - 255 * 0.8)).toBeLessThan(1);
  expect(Math.abs(at(12, 10) - 255 * 0.8 * Math.exp(-0.5))).toBeLessThan(1);
  // Symmetric, falling off, and cut off past 3σ.
  expect(at(12, 10)).toBe(at(10, 12));
  expect(at(14, 10)).toBeLessThan(at(12, 10));
  expect(at(0, 10)).toBe(0);
});

test("the study runs on a tiny grid", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "qrs-study-"));
  execFileSync(
    process.execPath,
    ["tools/qrs-study.mjs", "--grid=tiny", "--only=gap,dmg-tear-finder", `--out=${out}`, "--jobs=2"], // prettier-ignore
    { stdio: "pipe" },
  );
  const lines = zlib.gunzipSync(fs.readFileSync(path.join(out, "sweeps.csv.gz"))).toString().trim().split("\n"); // prettier-ignore
  const head = lines.shift().split(",");
  const rows = lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [head[i], v])));
  // gap and gap-eyes, and the torn finder: 2 values × 2 captures each.
  expect(rows.length).toBe(12);
  for (const r of rows) {
    expect(["front", "phone"]).toContain(r.cond);
    for (const k of ["jsqr", "zxing", "zxingcpp"]) expect(["0", "1"]).toContain(r[k]);
    expect(Number(r.version)).toBe(4);
  }
  const pick = (variable, value) => rows.filter((r) => r.variable === variable && Number(r.value) === value); // prettier-ignore
  // A clean code reads with all three readers, front on and phone-like.
  for (const r of pick("gap", 0)) {
    expect([r.jsqr, r.zxing, r.zxingcpp]).toEqual(["1", "1", "1"]);
    expect(r.blocks).toBe("1");
    expect(r.wrong).toBe("0");
  }
  // A finder torn off: no reader reads it.
  for (const r of pick("dmg-tear-finder", 1)) expect([r.jsqr, r.zxing, r.zxingcpp]).toEqual(["0", "0", "0"]); // prettier-ignore
  // The summary files.
  for (const f of ["cells.csv", "thresholds.csv", "blocks.csv", "summary.json", "charts/gap.svg"])
    expect(fs.existsSync(path.join(out, f))).toBe(true);
  const svg = fs.readFileSync(path.join(out, "charts/gap.svg"), "utf8");
  expect(svg).toContain("Level M");
  fs.rmSync(out, { recursive: true, force: true });
});
