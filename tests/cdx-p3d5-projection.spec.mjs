import { test, expect } from "@playwright/test";
import { followSourceProbes } from "../tools/cdx-p3d5-projection.mjs";

const field = (value = 128) => ({
  width: 64,
  height: 32,
  data: new Uint8Array(64 * 32).fill(value),
});
function edgeReference() {
  return {
    field: field(),
    thin: { anchors: [] },
    edges: [
      {
        u: 0.5,
        v: 0.5,
        axis: 0,
        sign: 1,
        profile: Array.from({ length: 17 }, (_, i) => ({
          u: 0.5 + (i - 8) / 64,
          v: 0.5,
          depth: 128 / 255,
          rgb: i < 8 ? [0, 0, 0] : [255, 255, 255],
        })),
      },
    ],
  };
}
test("source membership and colors remain fixed while an affine foreground plane moves", () => {
  const ref = edgeReference(),
    candidate = field();
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) candidate.data[y * 64 + x] = 80 + x;
  const result = followSourceProbes(ref, candidate);
  expect(result.projection.invalidEdgeFits).toBe(0);
  expect(result.edges[0].profile.map(({ depth, ...p }) => p)).toEqual(
    ref.edges[0].profile.map(({ depth, ...p }) => p),
  );
  for (let i = 0; i < 17; i++)
    expect(result.edges[0].profile[i].depth).toBeCloseTo((111.5 + i - 8) / 255, 12);
  expect(followSourceProbes(ref, ref.field).edges).toBe(ref.edges);
  expect(() => followSourceProbes(ref, { ...candidate, data: [] })).toThrow(/Incomplete candidate/);
});

test("an invalid continuation remains visible as lost confidence instead of dropping its probe", () => {
  const ref = edgeReference(),
    candidate = field();
  candidate.data[15 * 64 + 27] = 240;
  candidate.data[16 * 64 + 27] = 240;
  const result = followSourceProbes(ref, candidate);
  expect(result.edges).toHaveLength(1);
  expect(result.edges[0].profile).toHaveLength(17);
  expect(result.projection.invalidEdgeFits).toBe(1);
});

test("thin probes follow their original source line and report lost depth support", () => {
  const original = field(80);
  for (let y = 0; y < 32; y++) original.data[y * 64 + 32] = 200;
  const ref = {
    field: original,
    edges: [],
    thin: {
      anchors: [
        {
          width: 1,
          profile: Array.from({ length: 29 }, (_, i) => ({
            u: (32 + (i - 14) * 0.5 + 0.5) / 64,
            v: 16.5 / 32,
            depth: 200 / 255,
            rgb: [16, 32, 48],
          })),
        },
      ],
    },
  };
  const candidate = field(80);
  for (let y = 0; y < 32; y++) candidate.data[y * 64 + 32] = 220;
  const result = followSourceProbes(ref, candidate);
  expect(result.thin.anchors[0].profile.every((p) => p.depth === 220 / 255)).toBe(true);
  expect(result.projection.lostThinSupport).toBe(0);
  expect(followSourceProbes(ref, field(80)).projection.lostThinSupport).toBe(1);
  expect(ref.thin.anchors[0].profile[0].depth).toBe(200 / 255);
});
