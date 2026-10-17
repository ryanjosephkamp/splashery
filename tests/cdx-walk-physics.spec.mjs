import { test, expect } from "@playwright/test";

// These tests exercise the same sampled splats and controller as the walking view.
// Replacing collision with a room's authored boxes would fail the hole/outlier tests.
async function modules() {
  return Promise.all([
    import("../src/walk/rooms.js"),
    import("../src/walk/geometry.js"),
    import("../src/walk/grid.js"),
    import("../src/walk/body.js"),
  ]);
}

test("a tilted opaque floor wins over faint outliers", async () => {
  const [, { fitFloor }] = await modules();
  const pos = [],
    scale = [],
    color = [];
  for (let z = -3; z <= 3; z += 0.1)
    for (let x = -3; x <= 3; x += 0.1) {
      pos.push(x, 0.2 * x - 0.1 * z + 0.7, z);
      scale.push(0.06, 0.006, 0.06);
      color.push(0.5, 0.5, 0.5, 1);
    }
  for (let i = 0; i < 300; i++) {
    pos.push(i % 7, -6 - i / 100, i % 5);
    scale.push(0.001, 0.001, 0.001);
    color.push(1, 1, 1, 0.03);
  }
  const floor = fitFloor({ count: pos.length / 3, pos, scale, color });
  expect(floor.normal[1]).toBeGreaterThan(0.97);
  expect(Math.abs(floor.normal[0] / floor.normal[1] + 0.2)).toBeLessThan(0.02);
  expect(Math.abs(floor.height - 0.7)).toBeLessThan(0.03);
});

for (const room of ["gallery", "courtyard"]) {
  test(`${room}: ten fixed key walks retain support, stop at walls, and repeat within 10 cm`, async () => {
    const [{ buildRoom }, , { buildGrid, CollisionGrid }, { CapsuleBody }] = await modules();
    const scene = buildRoom(room);
    const grid = new CollisionGrid(buildGrid(scene.buffer));
    let endpoint;
    for (let run = 0; run < 10; run++) {
      const body = new CapsuleBody(grid, scene.spawn);
      let falls = 0,
        overlaps = 0,
        unsupported = 0,
        crossedWall = 0;
      // Into the north wall, then diagonally along it, then back through the room.
      const keys = [
        [0, 1, 420],
        [1, 1, 180],
        [0, -1, 180],
        [-1, 0, 150],
      ];
      for (const [x, z, frames] of keys)
        for (let i = 0; i < frames; i++) {
          body.update(1 / 60, { x, z });
          if (body.pos[1] < -0.02) falls++;
          if (!grid.clear(body.pos, body.radius, body.height)) overlaps++;
          if (!grid.support(body.pos[0], body.pos[2], body.pos[1] + 0.26)) unsupported++;
          if (Math.abs(body.pos[0]) > 4.8 || body.pos[2] > 5.8) crossedWall++;
        }
      expect({ falls, overlaps, unsupported, crossedWall }).toEqual({
        falls: 0,
        overlaps: 0,
        unsupported: 0,
        crossedWall: 0,
      });
      if (endpoint)
        expect(Math.hypot(...body.pos.map((v, i) => v - endpoint[i]))).toBeLessThan(0.1);
      endpoint = body.pos.slice();
      expect(Math.abs(body.pos[0])).toBeLessThan(scene.half[0]);
      expect(Math.abs(body.pos[2])).toBeLessThan(scene.half[1]);
    }
  });
}

test("isolated faint floaters do not block the capsule; unsupported capture edges do", async () => {
  const [{ buildRoom }, , { buildGrid, CollisionGrid }, { CapsuleBody }] = await modules();
  const scene = buildRoom("courtyard");
  const grid = new CollisionGrid(buildGrid(scene.buffer));
  const body = new CapsuleBody(grid, [0, 0, -2]);
  for (let i = 0; i < 500; i++) body.update(1 / 60, { x: 0, z: -1 });
  expect(body.pos[2]).toBeLessThan(-3);
  expect(body.pos[2]).toBeGreaterThan(-scene.half[1]);
  expect(body.pos[1]).toBeCloseTo(0, 1);
  expect(body.blocked).toBe("edge");
  body.reset();
  expect(body.blocked).toBeNull();
  expect(body.pos).toEqual(body.spawn);
});

test("spherical floor splats still support walking, and dense low-opacity walls still block", async () => {
  const [{ buildRoom }, , { buildGrid, CollisionGrid }, { CapsuleBody }] = await modules();
  const scene = buildRoom("gallery");
  const b = scene.buffer;
  // Remove the only reliable normal from each floor splat. Its fitted plane
  // and local occupancy still provide evidence of real floor support.
  for (let i = 0; i < b.count; i++)
    if (Math.abs(b.pos[i * 3 + 1]) < 0.01) {
      b.scale[i * 3] = b.scale[i * 3 + 1] = b.scale[i * 3 + 2] = 0.12;
      b.rot.set([0, 0, 0, 1], i * 4);
    }
  const grid = new CollisionGrid(buildGrid(b));
  const body = new CapsuleBody(grid, scene.spawn);
  expect(body.pos[1]).toBeCloseTo(0, 2);
  // A dense visible wall is not a floater just because its individual
  // Gaussians have low alpha. Repeated samples raise the opacity mass.
  const wall = buildRoom("gallery", { spacing: 0.06 }).buffer;
  for (let i = 0; i < wall.count; i++) if (wall.pos[i * 3 + 1] > 0.3) wall.color[i * 4 + 3] = 0.12;
  const low = new CapsuleBody(new CollisionGrid(buildGrid(wall)), [0, 0, 3.5]);
  for (let i = 0; i < 360; i++) low.update(1 / 60, { z: 1 });
  expect(low.pos[2]).toBeLessThan(4.3);
});

test("the capsule climbs a 20 cm dais and slides along a solid partition", async () => {
  const [{ buildRoom }, , { buildGrid, CollisionGrid }, { CapsuleBody }] = await modules();
  const grid = new CollisionGrid(buildGrid(buildRoom("gallery").buffer));
  const body = new CapsuleBody(grid, [0, 0, -0.5]);
  let climbed = false;
  for (let i = 0; i < 230; i++) {
    body.update(1 / 60, { x: 0, z: 1 });
    climbed ||= body.pos[1] > 0.18;
  }
  expect(climbed).toBe(true);
  expect(body.pos[2]).toBeLessThan(4.15);
  const x0 = body.pos[0];
  for (let i = 0; i < 50; i++) body.update(1 / 60, { x: 1, z: 1 });
  expect(body.pos[0] - x0).toBeGreaterThan(0.3);
  // Tap rays use small capsules too: a point in the partition must not
  // become clear merely because its height is less than a whole person.
  expect(grid.clear([0, 1, 4.3], 0.02, 0.04)).toBe(false);
});

test("dense millimeter-sized splats retain real floor support", async () => {
  const [, { fitFloor }, { buildGrid, CollisionGrid }, { CapsuleBody }] = await modules();
  const { SplatBuffer } = await import("../src/generators.js");
  const b = new SplatBuffer(11000);
  for (let z = -0.5; z <= 0.5; z += 0.01)
    for (let x = -0.5; x <= 0.5; x += 0.01)
      b.push([x, 0, z], [0.006, 0.006, 0.006], [0, 0, 0, 1], [0.5, 0.5, 0.5, 1]);
  expect(fitFloor(b).height).toBeCloseTo(0);
  const body = new CapsuleBody(new CollisionGrid(buildGrid(b)), [0, 0, 0]);
  expect(body.pos[1]).toBeCloseTo(0);
});

test("holes stay unsupported, large steps block, and slopes stop at 35 degrees", async () => {
  const [, , { buildGrid, CollisionGrid }, { CapsuleBody }] = await modules();
  const { SplatBuffer, discRotation } = await import("../src/generators.js");
  const make = (degrees, step = 0, hole = false) => {
    const b = new SplatBuffer(20000);
    const angle = (degrees * Math.PI) / 180;
    for (let z = -3; z <= 3; z += 0.08)
      for (let x = -2; x <= 2; x += 0.08) {
        if (hole && Math.abs(x) < 0.8 && z > 0 && z < 1.5) continue;
        const y = z > 0 ? step + z * Math.tan(angle) : 0;
        b.push(
          [x, y, z],
          [0.06, 0.06, 0.004],
          discRotation(z > 0 ? [0, Math.cos(angle), -Math.sin(angle)] : [0, 1, 0], 0),
          [0.5, 0.5, 0.5, 1],
        );
      }
    return new CollisionGrid(buildGrid(b));
  };
  for (const [degrees, allowed] of [
    [30, true],
    [35, true],
    [35.2, false],
    [40, false],
  ]) {
    const body = new CapsuleBody(make(degrees), [0, 0, -1]);
    for (let i = 0; i < 120; i++) body.update(1 / 60, { z: 1 });
    expect(body.pos[2] > 0.5).toBe(allowed);
  }
  const high = new CapsuleBody(make(0, 0.4), [0, 0, -1]);
  const hole = new CapsuleBody(make(0, 0, true), [0, 0, -1]);
  for (let i = 0; i < 180; i++) {
    high.update(1 / 60, { z: 1 });
    hole.update(1 / 60, { z: 1 });
  }
  expect(high.pos[2]).toBeLessThan(0.3);
  expect(hole.pos[2]).toBeLessThan(0.3);
  expect(hole.pos[1]).toBeCloseTo(0);
});

test("elongated floor splats preserve holes across their thin axis, including rotated floors", async () => {
  const [, , { buildGrid, CollisionGrid }, { CapsuleBody }] = await modules();
  const { SplatBuffer } = await import("../src/generators.js");
  const { transform } = await import("../src/walk/geometry.js");
  const source = new SplatBuffer(6000);
  for (let z = -3; z <= 3; z += 0.05)
    for (let x = -2; x <= 2; x += 0.1) {
      if (z > 0 && z < 0.4) continue;
      source.push([x, 0, z], [0.2, 0.003, 0.025], [0, 0, 0, 1], [0.5, 0.5, 0.5, 1]);
    }
  for (const angle of [0, Math.PI / 4, Math.PI / 2]) {
    const q = [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)];
    const grid = new CollisionGrid(buildGrid(transform(source, q, 1)));
    const direction = [Math.sin(angle), Math.cos(angle)];
    expect(grid.support(direction[0] * 0.2, direction[1] * 0.2, 0.1)).toBeNull();
    const body = new CapsuleBody(grid, [-direction[0], 0, -direction[1]]);
    for (let i = 0; i < 150; i++) body.update(1 / 60, { x: direction[0], z: direction[1] });
    expect(body.pos[0] * direction[0] + body.pos[2] * direction[1]).toBeLessThan(0.1);
    expect(body.pos[1]).toBeCloseTo(0);
  }
});
