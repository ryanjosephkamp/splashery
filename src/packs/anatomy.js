// Anatomy pack: stylised, friendly organs. Loaded when one of its toys is
// picked (see the "kit" entries in src/toys.js).

import { mix, shade, smoothstep, implicitRadius, spline } from "../kit.js";

const RED = "#c42f3c";
const DEEP = "#8e1a28";
const BLUE = "#4d6fd0";
const VESSEL = "#d2474f";

export const RECIPES = {
  heart: {
    alive: true,
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "anatomy",
        choices: [
          { id: "anatomy", label: "Anatomy" },
          { id: "love", label: "Love heart" },
        ],
      },
      { key: "color", label: "Colour", type: "color", default: RED },
    ],
    controls: [{ key: "strength", label: "Beat", type: "slider", default: 0.6 }],
    drive(t, c, out) {
      out.amount = 0.3 + 1.4 * c.strength;
    },
    build(k, o) {
      const base = o.color;
      if (o.style === "love") {
        // The classic heart surface, (x² + 9/4 z² + y² - 1)³ - x² y³ - 9/80 z² y³ = 0,
        // with y up and z towards the viewer.
        const f = ([x, y, z]) => {
          const a = x * x + 2.25 * z * z + y * y - 1;
          return a * a * a - x * x * y * y * y - 0.1125 * z * z * y * y * y;
        };
        k.add(k.radial(implicitRadius(f, 1.6)), {
          scale: [1, 1, 0.9],
          flat: 0.2,
          interior: 0.12,
          core: shade(base, 0.7),
          kind: "beat",
          params: [0.06, 0],
          color: (c) =>
            mix(
              base,
              "#ffffff",
              0.18 * smoothstep(0.2, 1.1, c.n[1] + c.n[2] * 0.6) +
                0.04 * c.fbm(c.p[0] * 3, c.p[1] * 3, c.p[2] * 3),
            ),
        });
        return;
      }
      // Ventricles: a rounded teardrop leaning its point down and to one side.
      const body = k.lathe(
        [
          [0, -0.95],
          [0.18, -0.85],
          [0.38, -0.6],
          [0.52, -0.28],
          [0.58, 0.02],
          [0.54, 0.26],
          [0.38, 0.42],
          [0, 0.48],
        ],
        { grid: 72 },
      );
      const vein = (c) => {
        const n = Math.abs(c.fbm(c.p[0] * 2.4 + 3, c.p[1] * 2.4, c.p[2] * 2.4 - 1));
        return n < 0.035;
      };
      k.add(body, {
        rot: [0, 0, 24],
        scale: [1, 1, 0.82],
        flat: 0.2,
        interior: 0.12,
        core: DEEP,
        kind: "beat",
        params: [0.05, 0],
        color: (c) => {
          if (vein(c)) return c.fbm(c.p[0] * 5, 0, c.p[2] * 5) > 0 ? "#6b1622" : "#3d4f9c";
          const groove =
            Math.abs(c.p[0] * 0.9 + c.p[1] * 0.35 - 0.02) < 0.035 && c.p[2] > 0 ? 1 : 0;
          const g = smoothstep(-0.9, 0.4, c.p[1]);
          let col = mix(shade(base, 0.72), base, g);
          if (groove) col = mix(col, "#e9c46a", 0.55);
          return mix(col, "#ffffff", 0.1 * Math.max(0, c.n[2]) * Math.max(0, c.n[1] + 0.3));
        },
      });
      // Atria.
      const atrium = { flat: 0.22, kind: "beat", params: [0.07, 0.16], core: DEEP };
      k.add(k.ellipsoid(0.3, 0.26, 0.28), {
        ...atrium,
        pos: [-0.38, 0.4, 0.02],
        color: (c) =>
          mix(shade(base, 0.85), "#7d4a8c", 0.25 + 0.1 * c.fbm(c.p[0] * 4, c.p[1] * 4, c.p[2] * 4)),
      });
      k.add(k.ellipsoid(0.26, 0.22, 0.26), {
        ...atrium,
        pos: [0.32, 0.44, -0.12],
        color: (c) => mix(base, "#a02838", 0.4 + 0.1 * c.fbm(c.p[0] * 4, c.p[1] * 4, c.p[2] * 4)),
      });
      // Great vessels: the aorta arches over, the pulmonary trunk rises in
      // front, the vena cava joins the right atrium.
      const vessel = { flat: 0.25, kind: "beat", params: [0.025, 0.08] };
      k.add(
        k.tube(
          spline([
            [0.02, 0.3, 0.02],
            [0.04, 0.72, 0.04],
            [0.2, 0.98, -0.04],
            [0.44, 0.86, -0.22],
            [0.5, 0.5, -0.32],
          ]),
          (t) => 0.14 - 0.02 * t,
        ),
        { ...vessel, color: (c) => mix(VESSEL, "#f07a7a", 0.2 * Math.max(0, c.n[1])) },
      );
      // Branches off the top of the arch.
      for (const [x, z] of [
        [0.08, 0.02],
        [0.2, -0.06],
        [0.3, -0.12],
      ]) {
        k.add(k.cylinder(0.045, 0.3, { caps: false }), {
          ...vessel,
          pos: [x, 1.08, z],
          color: VESSEL,
        });
      }
      k.add(
        k.tube(
          spline([
            [-0.08, 0.2, 0.3],
            [-0.12, 0.55, 0.3],
            [-0.02, 0.78, 0.16],
            [0.22, 0.8, 0.12],
          ]),
          0.115,
        ),
        { ...vessel, color: (c) => mix(BLUE, "#8aa2f0", 0.25 * Math.max(0, c.n[1])) },
      );
      k.add(k.cylinder(0.1, 0.5, { caps: false }), {
        ...vessel,
        pos: [-0.44, 0.78, -0.02],
        color: (c) => mix(BLUE, "#6c86dd", 0.3 * Math.max(0, c.n[2])),
      });
      k.add(k.cylinder(0.09, 0.3, { caps: false }), {
        ...vessel,
        pos: [-0.42, 0.02, -0.08],
        color: BLUE,
      });
    },
  },
};
