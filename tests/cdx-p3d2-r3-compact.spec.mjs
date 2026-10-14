import { test, expect } from "@playwright/test";
import { surfaceGrid } from "../src/photo3d/surface.js";

function sameGeometry(before, after) {
  expect(after.indices.length).toBe(before.indices.length);
  for (let i = 0; i < before.indices.length; i++) {
    const a = before.indices[i],
      b = after.indices[i];
    expect(Array.from(after.positions.slice(b * 3, b * 3 + 2))).toEqual(
      Array.from(before.positions.slice(a * 3, a * 3 + 2)),
    );
    expect(Array.from(after.meta.slice(b * 4, b * 4 + 3))).toEqual(
      Array.from(before.meta.slice(a * 4, a * 4 + 3)),
    );
  }
}

test("continuous cells reuse their equal corner positions, depths and layers without changing triangles", () => {
  const cols = 4,
    rows = 3;
  const source = {
    depth: Uint8Array.from(
      { length: cols * rows },
      (_, i) => 64 + 4 * (i % cols) + 3 * Math.floor(i / cols),
    ),
    band: new Uint8Array(cols * rows),
    gx: cols,
    gy: rows,
  };
  const before = surfaceGrid(cols, rows, source),
    after = surfaceGrid(cols, rows, { ...source, compact: true });
  expect(after.positions.length / 3).toBe((cols + 1) * (rows + 1));
  sameGeometry(before, after);
});

test("cells on each side of a cut keep separate vertices and their original depth and layer", () => {
  const cols = 8,
    rows = 6;
  const depth = Uint8Array.from({ length: cols * rows }, (_, i) => (i % cols < 4 ? 0 : 255));
  const source = { depth, band: Uint8Array.from(depth, (d) => (d ? 3 : 0)), gx: cols, gy: rows };
  const before = surfaceGrid(cols, rows, source),
    after = surfaceGrid(cols, rows, { ...source, compact: true });
  expect(after.positions.length).toBeLessThan(before.positions.length);
  const depths = new Set();
  for (let i = 0; i < after.positions.length / 3; i++)
    if (after.positions[i * 3] === 0.5) depths.add(after.meta[i * 4]);
  expect([...depths].sort()).toEqual([0, 1]);
  sameGeometry(before, after);
});

test("a clamped corner keeps its cell's depth even when neighboring centers show no cut", () => {
  const cols = 4,
    rows = 4,
    depth = new Uint8Array(64),
    band = new Uint8Array(64);
  depth[4 * 8 + 4] = 255;
  band[4 * 8 + 4] = 3;
  const source = { depth, band, gx: 8, gy: 8 };
  const before = surfaceGrid(cols, rows, source),
    after = surfaceGrid(cols, rows, { ...source, compact: true });
  sameGeometry(before, after);
});

test("a source handoff can grow the compact grid beyond the 16-bit index limit", async ({
  page,
}) => {
  test.setTimeout(240000);
  await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const result = await page.evaluate(async () => {
    const { ReliefMesh } = await import("/src/live/relief-mesh.js");
    const { surfaceGrid } = await import("/src/photo3d/surface.js");
    const pc = await import("/src/pc.js");
    const pl = window.__splashery.player;
    pl.setPaused(true);
    pl.stage.toy.entity.gsplat.enabled = false;
    const cols = 245,
      rows = 245;
    const m = new ReliefMesh(pl.stage, { cols, rows });
    const rgba = new Uint8Array(16);
    for (let i = 0; i < 4; i++) rgba.set([224, 48, 24, 255], i * 4);
    m.setColor({ w: 2, h: 2, data: rgba });
    m.set({ width: 1, height: 1, lift: 0.2, base: 0.5, morph: [0, 0, 0, 0] });
    try {
      const install = async (cut) => {
        const depth = Uint8Array.from({ length: cols * rows }, (_, i) =>
          cut ? (((i % cols) + Math.floor(i / cols)) % 2) * 255 : 128,
        );
        const band = Uint8Array.from(depth, (v) => (cut && v ? 3 : 0));
        m.setDepth({ w: cols, h: rows, data: depth });
        m.setPieces({ depth, band, gx: cols, gy: rows });
        const grid = surfaceGrid(cols, rows, { depth, band, gx: cols, gy: rows, compact: true });
        m.setBackground({ w: 2, h: 2, rgba, surface: grid });
        m.show(true);
        await pl.stage.captureFrame();
        await pl.stage.captureFrame();
        const indices = [];
        m.surface.mesh.getIndices(indices);
        return {
          vertices: grid.positions.length / 3,
          format: m.surface.mesh.indexBuffer[0].format,
          maximum: indices.reduce((a, b) => Math.max(a, b), 0),
          reportedBytes: m.surface.bytes,
          allocatedBytes:
            m.surface.mesh.vertexBuffer.numBytes + m.surface.mesh.indexBuffer[0].numBytes,
        };
      };
      return {
        before: await install(false),
        after: await install(true),
        shrunk: await install(false),
        uint32: pc.INDEXFORMAT_UINT32,
      };
    } finally {
      m.destroy();
    }
  });
  expect(result.before.vertices).toBeLessThan(65536);
  expect(result.after.vertices).toBeGreaterThan(65535);
  expect(result.after.format).toBe(result.uint32);
  expect(result.after.maximum).toBe(result.after.vertices - 1);
  expect(result.shrunk.reportedBytes).toBe(result.shrunk.allocatedBytes);
  expect(errors).toEqual([]);
});
