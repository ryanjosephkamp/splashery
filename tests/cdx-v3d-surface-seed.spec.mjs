import { test, expect } from "@playwright/test";

// A textured world plane seen by two translated, rotated cameras. Its third view is never
// supplied to the initializer; world-space positions and radiance can be checked analytically.
function plane() {
  const width = 48,
    height = 36,
    focal = 32;
  const cameras = [0, 1].map((i) => {
    const angle = i * 0.08,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const R = [c, 0, s, 0, 1, 0, -s, 0, c];
    const center = [i * 0.25, 0, i * 0.05];
    const t = [0, 1, 2].map(
      (k) => -R.slice(k * 3, k * 3 + 3).reduce((n, v, j) => n + v * center[j], 0),
    );
    return { imgIdx: i, R, t, f: focal, center };
  });
  const color = ([x, y]) => [0.35 + 0.05 * x, 0.45 + 0.05 * y, 0.25];
  const frames = cameras.map((cam) => ({
    tw: width,
    th: height,
    fw: width,
    fh: height,
    rgb: Float32Array.from({ length: width * height * 3 }, (_, index) => {
      const pixel = Math.floor(index / 3),
        u = (pixel % width) + 0.5,
        v = Math.floor(pixel / width) + 0.5;
      const ray = [(u - width / 2) / focal, (v - height / 2) / focal, 1];
      const worldRay = [0, 1, 2].map(
        (k) => cam.R[k] * ray[0] + cam.R[k + 3] * ray[1] + cam.R[k + 6] * ray[2],
      );
      const distance = (2 - cam.center[2]) / worldRay[2];
      return color(cam.center.map((p, k) => p + distance * worldRay[k]))[index % 3];
    }),
  }));
  const points = [];
  for (let y = -0.8; y <= 0.81; y += 0.4)
    for (let x = -1; x <= 1.01; x += 0.5) points.push({ X: [x, y, 2], rgb: color([x, y]) });
  return { recon: { cams: cameras, points }, frames, color };
}

test("surface seeding fills only supported 3D surfaces within the seed budget", async () => {
  const { surfaceSeed } = await import("../src/video3d/surface-seed.js");
  const { recon, frames, color } = plane();
  const seed = surfaceSeed(recon, frames, { maxPoints: 80, stride: 2 });
  expect(seed.n).toBeGreaterThan(recon.points.length);
  expect(seed.n).toBeLessThanOrEqual(80);
  expect(seed.data.length).toBe(seed.n * 16);
  for (let i = 0; i < seed.n; i++) {
    const row = Array.from(seed.data.subarray(i * 16, i * 16 + 16));
    expect(row.every(Number.isFinite)).toBe(true);
    expect(row[2]).toBeCloseTo(2, 5);
    expect(Math.hypot(...row.slice(6, 10))).toBeCloseTo(1, 5);
    color(row).forEach((v, k) => expect(1 / (1 + Math.exp(-row[10 + k]))).toBeCloseTo(v, 2));
  }
  expect(surfaceSeed(recon, frames, { maxPoints: 80, stride: 2 }).data).toEqual(seed.data);
});

test("inconsistent views and unsupported geometry never invent a dense surface", async () => {
  const { surfaceSeed } = await import("../src/video3d/surface-seed.js");
  const { recon, frames } = plane();
  frames[1].rgb.fill(1);
  expect(surfaceSeed(recon, frames, { maxPoints: 80, stride: 2 }).n).toBe(0);
  expect(
    surfaceSeed({ ...recon, points: recon.points.slice(0, 2) }, frames, { maxPoints: 80 }).n,
  ).toBe(0);
});
