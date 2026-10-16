import { test, expect } from "@playwright/test";

test("bounded surface neighbors match a full stable distance sort, including ties", async () => {
  const { nearestSurfacePoints } = await import("../src/video3d/surface-seed.js");
  expect(typeof nearestSurfacePoints).toBe("function");
  let state = 94;
  const random = () => (state = (1664525 * state + 1013904223) >>> 0) / 4294967296;
  const grid = new Map();
  const cell = 8;
  for (let i = 0; i < 3000; i++) {
    const point = { u: Math.floor(random() * 96) - 16, v: Math.floor(random() * 80) - 16, id: i };
    const key = `${Math.floor(point.u / cell)},${Math.floor(point.v / cell)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(point);
  }
  for (const [u, v] of [
    [0, 0],
    [20, 20],
    [32.5, 24.5],
    [-8, -8],
    [1000, 1000],
  ]) {
    const gx = Math.floor(u / cell),
      gy = Math.floor(v / cell);
    const all = [];
    for (let y = -2; y <= 2; y++)
      for (let x = -2; x <= 2; x++)
        for (const point of grid.get(`${gx + x},${gy + y}`) || [])
          all.push({ ...point, distance: (point.u - u) ** 2 + (point.v - v) ** 2 });
    const expected = all.sort((a, b) => a.distance - b.distance).slice(0, 8);
    const actual = nearestSurfacePoints(grid, u, v, cell);
    expect(actual).toEqual(expected);
    expect(actual.length).toBeLessThanOrEqual(8);
  }
});

test("coincident surface neighbors preserve encounter order and leave inputs unchanged", async () => {
  const { nearestSurfacePoints } = await import("../src/video3d/surface-seed.js");
  expect(typeof nearestSurfacePoints).toBe("function");
  const points = Array.from({ length: 30 }, (_, id) => ({ u: 4, v: 4, id }));
  const before = structuredClone(points);
  const grid = new Map([["0,0", points]]);
  expect(nearestSurfacePoints(grid, 4, 4, 8).map((p) => p.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  expect(points).toEqual(before);
});
