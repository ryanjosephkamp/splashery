// Lane Fidelity: trained splats on our rigs (docs/handoff/Fidelity.md). The SOG reader is checked
// against splat-transform's own (in Node and in the browser), and the orrery recipe is built from
// small stand-in parts (tests/fixtures/fid/orrery/, made by tools/fidelity/stand-in.mjs from the
// orrery's own geometry): every part is there with its splats, a tap turns each arm at its own
// speed, the moon rides on Earth's arm, and nothing snaps back when it stops.

import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { decodeSog, addTrained, shares, ORR, RECIPES } from "../src/packs/fidelity.js";
import { buildRecipe, quatRotate } from "../src/kit.js";

const ST = path.resolve("node_modules/.bin/splat-transform");
const FIX = "tests/fixtures/fid/orrery";

// A small random 3DGS PLY: positions, colors, opacities, sizes and rotations.
function writePly(file, n) {
  const props = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity"];
  props.push("scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3");
  const head = `ply\nformat binary_little_endian 1.0\nelement vertex ${n}\n${props.map((p) => `property float ${p}\n`).join("")}end_header\n`; // prettier-ignore
  const d = new Float32Array(n * props.length);
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < n; i++) {
    const q = [r(), r(), r(), r()];
    d.set([r() * 0.5, r() * 0.5, r() * 0.5, r() * 2, r() * 2, r() * 2, r() * 4], i * 14);
    d.set([-5 + r(), -5 + r(), -4.5 + r(), ...q], i * 14 + 7);
  }
  fs.writeFileSync(file, Buffer.concat([Buffer.from(head), Buffer.from(d.buffer)]));
  return { props, d };
}

function readPly(file) {
  const buf = fs.readFileSync(file);
  const h = buf.indexOf("end_header\n") + 11;
  const lines = buf.subarray(0, h).toString().split("\n");
  const n = Number(lines.find((l) => l.startsWith("element vertex")).split(" ")[2]);
  const names = lines.filter((l) => l.startsWith("property")).map((l) => l.split(" ")[2]);
  const f = new Float32Array(buf.buffer.slice(buf.byteOffset + h, buf.byteOffset + h + n * names.length * 4)); // prettier-ignore
  return { n, get: (name, i) => f[i * names.length + names.indexOf(name)] };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fid-"));
const sogFile = path.join(tmp, "a.sog");
test.beforeAll(() => {
  writePly(path.join(tmp, "a.ply"), 3000);
  execFileSync(ST, ["-q", "-w", "-g", "cpu", path.join(tmp, "a.ply"), "-H", "0", sogFile]);
  execFileSync(ST, ["-q", "-w", "-g", "cpu", sogFile, path.join(tmp, "back.ply")]);
});

function compare(t, ref) {
  expect(t.n).toBe(ref.n);
  const sig = (x) => 1 / (1 + Math.exp(-x));
  let worst = 0;
  for (let i = 0; i < t.n; i++) {
    for (const [k, c] of ["x", "y", "z"].entries()) worst = Math.max(worst, Math.abs(ref.get(c, i) - t.pos[i * 3 + k])); // prettier-ignore
    for (let k = 0; k < 3; k++) {
      worst = Math.max(worst, Math.abs(Math.exp(ref.get(`scale_${k}`, i)) / t.scale[i * 3 + k] - 1)); // prettier-ignore
      const c = Math.min(1, Math.max(0, 0.5 + 0.28209479177387814 * ref.get(`f_dc_${k}`, i)));
      worst = Math.max(worst, Math.abs(c - t.color[i * 3 + k]));
    }
    worst = Math.max(worst, Math.abs(sig(ref.get("opacity", i)) - t.alpha[i]));
    const q = [ref.get("rot_1", i), ref.get("rot_2", i), ref.get("rot_3", i), ref.get("rot_0", i)];
    const l = Math.hypot(...q);
    const dot = q.reduce((s, v, k) => s + (v / l) * t.quat[i * 4 + k], 0);
    worst = Math.max(worst, 1 - Math.abs(dot));
  }
  return worst;
}

test("the SOG reader matches splat-transform's (Node)", async () => {
  const t = await decodeSog(new Uint8Array(fs.readFileSync(sogFile)));
  expect(compare(t, readPly(path.join(tmp, "back.ply")))).toBeLessThan(1e-5);
});

test("the SOG reader matches splat-transform's (browser)", async ({ page }) => {
  await page.route("**/__fid/a.sog", (r) => r.fulfill({ body: fs.readFileSync(sogFile) }));
  await page.goto("/tools/fidelity/measure.html");
  const t = await page.evaluate(async () => {
    const { decodeSog } = await import("/src/packs/fidelity.js");
    const bytes = new Uint8Array(await (await fetch("/__fid/a.sog")).arrayBuffer());
    const d = await decodeSog(bytes);
    const arr = (a) => Array.from(a);
    return { n: d.n, pos: arr(d.pos), scale: arr(d.scale), quat: arr(d.quat), color: arr(d.color), alpha: arr(d.alpha) }; // prettier-ignore
  });
  // Exact, faint splats too (read back through WebGL, not a 2D canvas, which premultiplies).
  expect(compare(t, readPly(path.join(tmp, "back.ply")))).toBeLessThan(1e-5);
});

test("a part keeps the most visible splats of a trained file within its share", async () => {
  const t = await decodeSog(new Uint8Array(fs.readFileSync(sogFile)));
  expect(shares([t, t]).map((s) => s.toFixed(2))).toEqual(["0.50", "0.50"]);
  const recipe = {
    build(k) {
      const p = k.part("p", { pivot: [0, 0, 0] });
      k.data = { item: addTrained(k, t, { part: p, share: 0.5 }) };
    },
  };
  const it = buildRecipe(recipe, { seed: 1, count: 2000, options: {} }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  const { item } = b.value.kit.data;
  expect(item.end - item.start).toBe(1000);
  const buf = b.value.kit.buf;
  // Trained sizes are kept exactly (no jitter), up to the toy's fit scale.
  const s = b.value.kit.transform.scale;
  const sizes = new Set();
  for (let i = item.start; i < item.end; i++) sizes.add((buf.scale[i * 3] / s).toPrecision(5));
  const kept = new Set();
  for (let i = 0; i < t.n; i++) kept.add(t.scale[i * 3].toPrecision(5));
  for (const v of sizes) expect(kept.has(v)).toBe(true);
  // Every splat is on the part, with no surface pattern.
  for (let i = item.start; i < item.end; i++) expect(buf.anim[i * 4]).toBe(1 + 16);
});

async function buildOrrery() {
  ORR.dir = `../../${FIX}/`;
  ORR.info = null;
  const r = RECIPES.orrery;
  await r.prepare({});
  const it = buildRecipe(r, { seed: 3, count: 20000, options: {} }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return { r, kit: b.value.kit };
}

test("the orrery builds every trained part on its own kit part", async () => {
  const { kit } = await buildOrrery();
  const names = ORR.info.parts.map((p) => p.name);
  expect(names).toEqual(["base", "gear-a", "gear-b", "sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn"]); // prettier-ignore
  expect(kit.parts.length).toBeLessThanOrEqual(16);
  const count = new Map();
  for (let i = 0; i < kit.buf.count; i++) {
    const part = kit.parts[kit.buf.anim[i * 4] % 16].name;
    count.set(part, (count.get(part) || 0) + 1);
  }
  for (const n of names.slice(1)) expect(count.get(n), n).toBeGreaterThan(100);
  expect(count.get("body")).toBeGreaterThan(100); // the base
});

test("a tap turns each arm at its own speed, the moon rides on Earth's arm, and it stays put", async () => {
  const { r, kit } = await buildOrrery();
  const data = kit.data;
  const out = () => ({ parts: {}, fx: {} });
  const T = ORR.T;
  let o;
  // Played frame by frame at 60 fps through one tap.
  for (let f = 0; f <= (T + 0.5) * 60; f++) {
    const t = 1 + f / 60;
    const turn = f / 60 < T ? 1 - f / 60 / T : 0;
    o = out();
    r.drive(t, { turn }, o, { data, time: t });
  }
  const ang = data.orrery.ang;
  // Each arm turned by its own speed times the same run (Saturn, the slowest, less than a turn).
  const arms = ORR.info.parts.filter((p) => p.planet);
  expect(arms.length).toBe(6);
  const run = (ang.saturn * arms.find((p) => p.name === "saturn").period) / (2 * Math.PI);
  expect(run).toBeGreaterThan(3);
  for (const p of arms) {
    const want = ((2 * Math.PI * run) / p.period) % (2 * Math.PI);
    expect(Math.abs(ang[p.name] - want), p.name).toBeLessThan(1e-6);
  }
  // After the tap the parts keep their angles (no snap back): two more frames, the same pose.
  const a = out();
  r.drive(1 + T + 1, { turn: 0 }, a, { data, time: 1 + T + 1 });
  const b = out();
  r.drive(1 + T + 2, { turn: 0 }, b, { data, time: 1 + T + 2 });
  expect(b.parts.mercury.angle).toBeCloseTo(a.parts.mercury.angle, 9);
  expect(a.parts.mercury.angle).toBeCloseTo(ang.mercury, 9);
  // The moon: its pivot (Earth's center) goes where Earth's arm takes Earth's center.
  const earth = ORR.info.parts.find((p) => p.name === "earth");
  const moon = ORR.info.parts.find((p) => p.name === "moon");
  const qe = [0, Math.sin(ang.earth / 2), 0, Math.cos(ang.earth / 2)];
  const want = quatRotate(qe, earth.planet);
  const got = moon.pivot.map((v, k) => v + a.parts.moon.offset[k]);
  for (let k = 0; k < 3; k++) expect(got[k]).toBeCloseTo(want[k], 6);
});
