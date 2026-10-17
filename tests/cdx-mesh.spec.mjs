import { test, expect } from "@playwright/test";
import { emptyTable } from "../src/viewers/splat-io.js";
import fs from "node:fs";

const core = () => import("../src/mesh-export/reconstruct.js");
const formats = () => import("../src/mesh-export/formats.js");

test("an isosurface through grid nodes does not collapse vertices at Float32 precision", async () => {
  const { extractSurface, resample } = await import("../src/mesh-export/surface.js");
  const { inspectTopology } = await import("../src/mesh-export/topology.js");
  const n = 12,
    data = new Float32Array(n ** 3);
  for (let z = 0; z < n; z++)
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        data[x + n * (y + n * z)] = Math.hypot(x - 5.5, y - 5.5, z - 5.5) < 3.8 ? 1 : 0;
  const m = extractSurface(
    resample(data, n, 23),
    23,
    [1, 1, 1],
    0.01,
    0.5,
    { color: () => [1, 0, 0] },
    100000,
  );
  const topology = inspectTopology(m);
  expect(topology.degenerate).toBe(0);
  expect(topology.manifold).toBe(true);
});

test("the reference duck does not acquire tiny folded walls during smoothing", async () => {
  const { readSplatFile } = await import("../src/viewers/splat-io.js");
  const { getWebp } = await import("../src/viewers/engine.js");
  const table = await readSplatFile(
    new Uint8Array(fs.readFileSync("assets/toys/rubber-duck-real/rubber-duck-real.sog")),
    "duck.sog",
    { getWebp },
  );
  const { reconstruct } = await core();
  const m = reconstruct(table, { resolution: 160, level: 1, readyToPrint: true });
  expect(m.report.topology.manifold).toBe(true);
  expect(m.report.thicknessCheck.passed).toBe(true);
});

test("print thickness check detects a half-millimeter slab", async () => {
  const { checkThickness } = await import("../src/mesh-export/thickness.js");
  const positions = new Float32Array([
    -5, -5, -0.25, 5, -5, -0.25, 5, 5, -0.25, -5, 5, -0.25, -5, -5, 0.25, 5, -5, 0.25, 5, 5, 0.25,
    -5, 5, 0.25,
  ]);
  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2,
    6, 1, 6, 5,
  ]);
  const result = checkThickness({ positions, indices });
  expect(result.minimumMm).toBeCloseTo(0.5, 3);
  expect(result.passed).toBe(false);
  for (let i = 2; i < positions.length; i += 3) positions[i] *= 4;
  expect(checkThickness({ positions, indices }).passed).toBe(true);
});
function gaussian(scales = [0.3, 0.3, 0.3]) {
  const t = emptyTable(1);
  t.qw[0] = 1;
  t.opacity[0] = 10;
  [t.s0[0], t.s1[0], t.s2[0]] = scales.map(Math.log);
  t.r[0] = 0.5 / 0.28209479177387814;
  t.g[0] = -0.5 / 0.28209479177387814;
  t.b[0] = -0.5 / 0.28209479177387814;
  return t;
}

test("Gaussian isosurface has outward normals, color, and closed manifold topology", async () => {
  const { reconstruct } = await core();
  const steps = [];
  const m = reconstruct(
    gaussian(),
    { resolution: 40, level: Math.exp(-2), smoothIterations: 0 },
    (p) => steps.push(p),
  );
  expect(m.indices.length).toBeGreaterThan(100);
  expect(m.report.topology.watertight).toBe(true);
  expect(m.report.topology.manifold).toBe(true);
  for (let i = 0; i < m.positions.length; i += 3) {
    const radius = Math.hypot(...m.positions.subarray(i, i + 3));
    expect(radius).toBeCloseTo(0.6, 2);
    const dot =
      m.positions[i] * m.normals[i] +
      m.positions[i + 1] * m.normals[i + 1] +
      m.positions[i + 2] * m.normals[i + 2];
    expect(dot).toBeGreaterThan(0);
    expect(m.colors[i]).toBeGreaterThan(0.99);
    expect(m.colors[i + 1]).toBeLessThan(0.01);
  }
  expect(steps.at(-1)).toBe(1);
});

test("anisotropic Gaussians rotate with their quaternion", async () => {
  const { reconstruct } = await core();
  const t = gaussian([0.4, 0.1, 0.1]);
  t.qw[0] = t.qz[0] = Math.SQRT1_2;
  const m = reconstruct(t, { resolution: 48, smoothIterations: 0 });
  const extent = [0, 1, 2].map(
    (k) =>
      Math.max(...m.positions.filter((_, i) => i % 3 === k)) -
      Math.min(...m.positions.filter((_, i) => i % 3 === k)),
  );
  expect(extent[1] / extent[0]).toBeGreaterThan(3.5);
});

test("print mode uses millimeters and reports verified topology and thickness limits", async () => {
  const { reconstruct } = await core();
  const m = reconstruct(gaussian(), { resolution: 40, readyToPrint: true, printSize: 60 });
  expect(m.report.units).toBe("mm");
  expect(m.report.topology.watertight).toBe(true);
  expect(m.report.topology.manifold).toBe(true);
  expect(m.report.printable).toBe(true);
  const size =
    Math.max(...m.positions.filter((_, i) => i % 3 === 0)) -
    Math.min(...m.positions.filter((_, i) => i % 3 === 0));
  expect(size).toBeCloseTo(60, 1);
  expect(() => reconstruct(gaussian(), { readyToPrint: true, printSize: 0.5 })).toThrow(
    /size|millimeter|mm/i,
  );
});

test("invalid input and unsupported resource budgets fail before allocating a volume", async () => {
  const { reconstruct } = await core();
  expect(() => reconstruct(emptyTable(0))).toThrow(/empty|splats/i);
  const t = gaussian();
  t.x[0] = NaN;
  expect(() => reconstruct(t)).toThrow(/finite|invalid/i);
  expect(() => reconstruct(gaussian(), { resolution: 10000 })).toThrow(/resolution|budget/i);
  expect(() => reconstruct(gaussian(), { level: -1 })).toThrow(/level/i);
  expect(() => reconstruct(gaussian(), { profile: "phone", triangleBudget: 500000 })).toThrow(
    /budget|triangles/i,
  );
});

test("triangle budget is met without opening a closed surface", async () => {
  const { reconstruct } = await core();
  const m = reconstruct(gaussian(), { resolution: 48, triangleBudget: 3000 });
  expect(m.indices.length / 3).toBeLessThanOrEqual(3000);
  expect(m.report.topology.watertight).toBe(true);
  expect(m.report.topology.manifold).toBe(true);
  expect(m.report.warnings.join(" ")).toMatch(/coarser|small details|topology/i);
});

test("thickened print surfaces inherit nearby source color instead of gray patches", async () => {
  const { reconstruct } = await core();
  const m = reconstruct(gaussian([0.3, 0.3, 0.005]), {
    resolution: 40,
    readyToPrint: true,
    printSize: 10,
  });
  for (let i = 0; i < m.colors.length; i += 3) {
    expect(m.colors[i]).toBeGreaterThan(0.99);
    expect(m.colors[i + 1]).toBeLessThan(0.01);
  }
});

test("GLB, OBJ with MTL, and binary STL preserve geometry and allowed metadata", async () => {
  const { reconstruct } = await core();
  const { encodeMesh } = await formats();
  const m = reconstruct(gaussian(), { resolution: 24 });
  const meta = {
    name: "red sphere",
    license: "CC BY-SA 4.0",
    author: "Example",
    source: "https://example.org/sphere",
    credits: [
      {
        title: "Inset",
        author: "Detail author",
        license: "CC BY 4.0",
        source: "https://example.org/detail",
      },
    ],
  };
  const [glb] = encodeMesh(m, "glb", meta);
  const view = new DataView(glb.bytes.buffer, glb.bytes.byteOffset, glb.bytes.byteLength);
  expect(view.getUint32(0, true)).toBe(0x46546c67);
  expect(view.getUint32(8, true)).toBe(glb.bytes.byteLength);
  const json = JSON.parse(
    new TextDecoder().decode(glb.bytes.subarray(20, 20 + view.getUint32(12, true))),
  );
  expect(json.asset.extras.license).toBe(meta.license);
  expect(json.asset).toHaveProperty("copyright", expect.any(String));
  expect(json.asset.copyright).toContain(meta.name);
  expect(json.asset.copyright).toContain(meta.author);
  expect(json.asset.copyright).toContain(meta.license);
  expect(json.asset.copyright).toContain(meta.source);
  for (const credit of meta.credits) {
    expect(json.asset.copyright).toContain(credit.title);
    expect(json.asset.copyright).toContain(credit.author);
    expect(json.asset.copyright).toContain(credit.license);
    expect(json.asset.copyright).toContain(credit.source);
  }
  expect(json.meshes[0].primitives[0].attributes.COLOR_0).toBeDefined();
  const obj = encodeMesh(m, "obj", meta);
  expect(obj.map((f) => f.name.split(".").at(-1))).toEqual(["obj", "mtl"]);
  expect(new TextDecoder().decode(obj[0].bytes)).toContain("CC BY-SA 4.0");
  expect(new TextDecoder().decode(obj[0].bytes)).toContain(`mtllib ${obj[1].name}`);
  const [stl] = encodeMesh(m, "stl", meta);
  expect(stl.bytes.length).toBe(84 + (m.indices.length / 3) * 50);
  expect(new DataView(stl.bytes.buffer).getUint32(80, true)).toBe(m.indices.length / 3);
});
