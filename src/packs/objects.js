// Things that open: toys with hinged parts you tap to open and close.
// Loaded on demand.

import { mix, shade, smoothstep } from "../kit.js";

const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

export const RECIPES = {
  chest: {
    alive: true,
    options: [{ key: "wood", label: "Wood", type: "color", default: "#8a5a2b" }],
    controls: [{ key: "open", label: "Open", type: "toggle", default: 0, ease: 1.1 }],
    action: { key: "open", label: "Open or close" },
    drive(t, c, out) {
      const o = easeInOut(c.open);
      out.parts.lid = { angle: -1.95 * o };
      out.amount = o;
    },
    build(k, o) {
      const W = 1.2;
      const H = 0.6;
      const D = 0.74;
      const top = H / 2 - 0.2;
      const wood = o.wood;
      const gold = "#d4a63c";
      const planks = (c) => {
        const band = Math.abs((((c.p[1] + 1) * 7.5) % 1) - 0.5) > 0.46;
        const grain = c.fbm(c.p[0] * 3, c.p[1] * 30, c.p[2] * 3);
        return shade(mix(wood, shade(wood, 0.6), 0.5 + 0.5 * grain), band ? 0.55 : 1);
      };
      // The body: an open-topped box (the top face is left out).
      k.add(k.box(W, H, D), {
        pos: [0, -0.2, 0],
        flat: 0.2,
        color: (c) => (c.s.face === 2 ? null : planks(c)),
      });
      // Metal bands and corners.
      for (const x of [-0.36, 0.36]) {
        k.add(k.box(0.08, H + 0.02, D + 0.02), {
          pos: [x, -0.2, 0],
          flat: 0.2,
          weight: 1.5,
          color: (c) =>
            c.s.face === 2
              ? null
              : mix(gold, "#8a6a1f", 0.3 + 0.3 * c.fbm(c.p[0] * 20, c.p[1] * 20, 0)),
        });
      }
      // The lid: a half cylinder along X, hinged at the back edge.
      const lid = k.part("lid", { pivot: [0, top, -D / 2], axis: [1, 0, 0] });
      const R = D / 2;
      const arc = k.param(
        (u, v) => {
          const a = v * Math.PI;
          return [(u - 0.5) * W, top + Math.sin(a) * R * 0.75, Math.cos(a) * R];
        },
        { grid: 48, flip: true },
      );
      k.add(arc, { part: lid, flat: 0.2, color: planks });
      for (const x of [-0.36, 0.36]) {
        const strap = k.param(
          (u, v) => {
            const a = v * Math.PI;
            const rr = R + 0.012;
            return [x + (u - 0.5) * 0.08, top + Math.sin(a) * rr * 0.75, Math.cos(a) * rr];
          },
          { grid: 24, flip: true },
        );
        k.add(strap, { part: lid, flat: 0.2, weight: 1.5, color: gold });
      }
      for (const side of [-1, 1]) {
        const end = k.param(
          (u, v) => {
            const a = u * Math.PI;
            return [(side * W) / 2, top + Math.sin(a) * R * 0.75 * v, Math.cos(a) * R * v];
          },
          { grid: 24 },
        );
        k.add(end, { part: lid, flat: 0.2, color: planks });
      }
      // The lid's flat underside, so the open lid is not hollow.
      k.add(k.box(W, 0.01, D), {
        pos: [0, top + 0.005, 0],
        part: lid,
        flat: 0.2,
        color: shade(wood, 0.7),
      });
      // The lock plate on the front of the lid.
      k.add(k.box(0.16, 0.2, 0.03), {
        pos: [0, top - 0.02, D / 2 + 0.01],
        part: lid,
        flat: 0.2,
        weight: 2,
        color: gold,
      });
      k.add(k.box(0.12, 0.08, 0.03), {
        pos: [0, top - 0.16, D / 2 + 0.01],
        flat: 0.2,
        weight: 2,
        color: shade(gold, 0.85),
      });
      // Treasure heaped inside: coins that glint and gems that sparkle when open.
      k.cloud({ share: 0.1, size: 0.9, flat: 0.15 }, (rand) => {
        const x = (rand() - 0.5) * (W - 0.12);
        const z = (rand() - 0.5) * (D - 0.1);
        const heap = 0.08 * (1 - (x / (W / 2)) ** 2) * (1 - (z / (D / 2)) ** 2);
        const tilt = [(rand() - 0.5) * 0.8, 1, (rand() - 0.5) * 0.8];
        return {
          p: [x, top - 0.05 + heap * (0.3 + 0.7 * rand()), z],
          n: tilt,
          color: mix("#f2c94c", "#b8860b", rand() * 0.5),
          pattern: false,
          kind: "glint",
          params: [0.7, 0],
        };
      });
      const gems = ["#e0115f", "#2ecc71", "#3a7bd5", "#9b59b6", "#f1c40f"];
      for (let i = 0; i < 9; i++) {
        const x = (k.rand() - 0.5) * (W - 0.3);
        const z = (k.rand() - 0.5) * (D - 0.25);
        const s = 0.035 + k.rand() * 0.03;
        k.add(k.ellipsoid(s, s * 0.8, s), {
          pos: [x, top + 0.03, z],
          weight: 3,
          flat: 0.3,
          pattern: false,
          kind: "twinkle",
          params: [0.9, k.rand() * 6],
          color: (c) => mix(gems[i % gems.length], "#ffffff", 0.35 * smoothstep(0.3, 1, c.n[1])),
        });
      }
      // Room for the open lid.
      k.reach([0, top + D * 0.95, -D / 2 - 0.1]);
    },
  },
};
