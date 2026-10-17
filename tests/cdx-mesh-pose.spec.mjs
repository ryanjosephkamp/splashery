import { test, expect } from "@playwright/test";
import { quatAxisAngle, quatRotate } from "../src/kit.js";
import { SplatBuffer } from "../src/generators.js";
import { KINDS, MORPH_RANGE } from "../src/kit-tables.js";

test("built-in whole kiwi closes its halves and omits hidden cut faces", async () => {
  const { loadSource } = await import("../src/mesh-export/sources.js");
  const { table } = await loadSource(
    { kind: "toy", id: "kiwi", options: { style: "whole" } },
    "phone",
  );
  expect(table.count).toBeLessThan(50000);
  expect(table.count).toBeGreaterThan(10000);
});

test("rest pose composes token, part, and body transforms and drops hidden tokens", async () => {
  const { bakeRestPose } = await import("../src/mesh-export/rest-pose.js");
  const buf = new SplatBuffer(2, { anim: true });
  for (const token of [0, 1])
    buf.push(
      [token ? -4 : 4, 0, 0],
      [0.1, 0.2, 0.3],
      [0, 0, 0, 1],
      [1, 0, 0, 1],
      [1, KINDS.token, token, 0],
    );
  const q = quatAxisAngle([0, 0, 1], Math.PI / 2);
  let observed;
  const ctx = {
    buf,
    transform: { center: [10, 0, 0], scale: 2 },
    parts: [{ name: "body" }, { name: "arm", pivot: [1, 0, 0] }],
    kit: { data: { fixture: true } },
    recipe: {
      controls: [{ key: "amount", default: 0.75 }],
      drive(_t, c, out, info) {
        observed = { c, info };
        out.tokens = [{ base: [11, 0, 0], offset: [0, 1, 0], quat: q }, { visible: 0 }];
        out.parts.arm = { quat: q, scale: 2, offset: [1, 0, 0] };
        out.body = { quat: q, offset: [0, 1, 0] };
      },
    },
  };
  const posed = bakeRestPose(ctx);
  expect(posed.count).toBe(1);
  expect(Array.from(posed.pos.subarray(0, 3))).toEqual([-2, -1, 0]);
  expect(Array.from(posed.scale.subarray(0, 3))).toEqual(
    Array.from(Float32Array.of(0.2, 0.4, 0.6)),
  );
  const axis = quatRotate(posed.rot.subarray(0, 4), [1, 0, 0]);
  expect(axis[0]).toBeCloseTo(0, 6);
  expect(axis[1]).toBeCloseTo(-1, 6);
  expect(observed.c.amount).toBe(0.75);
  expect(observed.info.data.fixture).toBe(true);
  expect(observed.info.R).toBe(4);
  expect(observed.info.tap).toBeNull();
  expect(observed.info.taps).toEqual([]);
  expect(observed.info.sound.enabled).toBe(false);
});

test("packed linear morphs honor defaults and explicit relief controls", async () => {
  const { bakeRestPose } = await import("../src/mesh-export/rest-pose.js");
  const fixture = () => {
    const buf = new SplatBuffer(1, { anim: true });
    buf.push(
      [0, 0, 0],
      [0.1, 0.1, 0.1],
      [0, 0, 0, 1],
      [1, 0, 0, 1],
      [0, KINDS.morph, 2150 * 4096 + 2048, 2048],
    );
    return {
      buf,
      recipe: {
        controls: [{ key: "flat", default: 1 }],
        drive(_t, c, out) {
          out.morph = [c.flat, 0, 0, 0];
        },
      },
    };
  };
  expect(bakeRestPose(fixture()).pos[0]).toBeCloseTo((102 * MORPH_RANGE) / 2048, 6);
  expect(bakeRestPose(fixture(), { flat: 0 }).pos[0]).toBe(0);
});

test("unsupported active deformation fails with an actionable source-file message", async () => {
  const { bakeRestPose } = await import("../src/mesh-export/rest-pose.js");
  const buf = new SplatBuffer(1, { anim: true });
  buf.push([0, 0, 0], [1, 1, 1], [0, 0, 0, 1], [1, 0, 0, 1], [0, KINDS.none, 0, 0]);
  expect(() =>
    bakeRestPose({
      buf,
      recipe: {
        drive(_t, _c, out) {
          out.body = { squash: 0.2 };
        },
      },
    }),
  ).toThrow(/save.*splats.*open.*file/i);
});

test("the six benchmark kit toys remain exportable after posing", async () => {
  const { loadSource } = await import("../src/mesh-export/sources.js");
  for (const id of ["torus", "soccer-ball", "rubber-duck", "apple", "diamond", "chess-set"]) {
    const { table } = await loadSource({ kind: "toy", id }, "phone");
    expect(table.count, id).toBeGreaterThan(1000);
    expect(Array.from(table.x).every(Number.isFinite), id).toBe(true);
  }
});
