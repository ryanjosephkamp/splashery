// Anatomy pack: stylised, friendly organs. Loaded when one of its toys is
// picked (see the "kit" entries in src/toys.js).

import {
  mix,
  shade,
  smoothstep,
  implicitRadius,
  spline,
  clamp,
  quatAxisAngle,
  quatMul,
} from "../kit.js";

const TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const keep = (c) => ({ c, keep: true });

// Fake lighting for the organs below (splats are unlit).
const LIGHT = unit([-0.45, 0.8, 0.45]);
const VIEW = unit([0.5, 0.3, 0.82]);
const HALF = unit(add(LIGHT, VIEW));
const lit = (col, n, amb = 0.62, k = 0.45) => shade(col, amb + k * Math.max(0, dot(n, LIGHT)));
const gloss = (col, n, amt = 0.4, pow = 16) =>
  mix(col, "#ffffff", amt * Math.pow(Math.max(0, dot(n, HALF)), pow));

function randDir(rand) {
  const z = rand() * 2 - 1;
  const a = rand() * TAU;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), z, r * Math.sin(a)];
}

// A tapering tube whose inside (for Slice) stays within its own radius.
function snugTube(k, curve, radius, opts) {
  const shape = k.tube(curve, radius, opts);
  const inner = shape.sample;
  shape.sample = (rand) => {
    const s = inner(rand);
    s.thick = radius(s.t ?? 0) * 0.9;
    return s;
  };
  return shape;
}

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

  // ---- Brain ----------------------------------------------------------------------------
  brain: {
    alive: true,
    options: [
      {
        key: "colors",
        label: "Colours",
        type: "select",
        default: "lobes",
        choices: [
          { id: "lobes", label: "Lobes" },
          { id: "plain", label: "Plain pink" },
        ],
      },
    ],
    controls: [{ key: "sparks", label: "Sparks", type: "slider", default: 0.6 }],
    drive(t, c, out) {
      out.amount = 0.2 + 1.3 * c.sparks;
    },
    build(k, o) {
      const lobes = o.colors !== "plain";
      const PAL = lobes
        ? {
            frontal: "#6fa4e0",
            parietal: "#f4cf5d",
            temporal: "#84d08d",
            occipital: "#f29bb0",
            cerebellum: "#b497e0",
            stem: "#f0ae78",
          }
        : {
            frontal: "#f0a3ad",
            parietal: "#f0a3ad",
            temporal: "#eb9aa6",
            occipital: "#f0a3ad",
            cerebellum: "#e48e9c",
            stem: "#e7a58f",
          };
      // Folds: a meandering pattern of grooves from the zero lines of noise.
      const fold = (p) => {
        const w = k.noise(p[0] * 1.3 + 9, p[1] * 1.3, p[2] * 1.3) * 0.7;
        return k.noise(p[0] * 3.6 + w, p[1] * 3.6 - w, p[2] * 3.6 + 2 * w);
      };
      // One hemisphere (side = +1 right, -1 left), in the brain's frame: x from
      // the front (-) to the back (+), y up, z to the side.
      const hemi = (side) => {
        const cz = side * 0.47;
        const region = (p) => {
          const x = p[0];
          const y = p[1];
          const syl = y - (-0.14 + 0.28 * (x + 0.55));
          if (syl < 0 && x < 0.5 && y < 0.1) return "temporal";
          if (x > 0.58 - 0.12 * y) return "occipital";
          const central = x - (0.02 - 0.34 * (0.72 - y));
          return central < 0 ? "frontal" : "parietal";
        };
        const groove = (p) => {
          const x = p[0];
          const y = p[1];
          const syl = Math.abs(y - (-0.14 + 0.28 * (x + 0.55)));
          const sylG = x > -0.75 && x < 0.45 && y < 0.2 ? smoothstep(0.045, 0.0, syl) : 0;
          const central = Math.abs(x - (0.02 - 0.34 * (0.72 - y)));
          const cenG = y > -0.05 ? smoothstep(0.03, 0.0, central) : 0;
          const f = Math.abs(fold(p));
          const foldG = smoothstep(0.1, 0.01, f);
          return { deep: Math.max(sylG, cenG), fold: foldG };
        };
        const shape = (d) => {
          const ax = d[0] < 0 ? 0.95 : 1.02;
          const ay = d[1] > 0 ? 0.74 : 0.5;
          const az = d[2] * side > 0 ? 0.5 : 0.2;
          let r = 1 / Math.hypot(d[0] / ax, d[1] / ay, d[2] / az);
          // The temporal lobe bulges down and forward.
          const T = [-0.22, -0.78, 0.58 * side];
          const tl = Math.max(0, dot(d, unit(T)));
          r += 0.2 * Math.pow(tl, 6);
          return r;
        };
        const radius = (d) => {
          const r0 = shape(d);
          const p = add(mul(d, r0), [0, 0, cz]);
          const g = groove(p);
          return r0 * (1 - 0.05 * g.deep - 0.03 * g.fold);
        };
        surfaces.push({ radius, cz });
        k.add(k.radial(radius, { grid: 96, thick: 0.3 }), {
          pos: [0, 0, cz],
          flat: 0.2,
          interior: 0.1,
          core: (c) => {
            // Grey matter near the surface, white matter within.
            const q = sub(c.p, [0, 0, cz]);
            const d = unit(q);
            return len(q) > shape(d) * 0.86 ? "#c98e96" : "#f4e4d4";
          },
          color: (c) => {
            const p = c.p;
            const g = groove(p);
            let col = PAL[region(p)];
            col = mix(col, shade(col, 0.45), g.fold * 0.85);
            col = mix(col, shade(col, 0.35), g.deep);
            return gloss(lit(col, c.n, 0.62, 0.45), c.n, 0.25, 12);
          },
        });
      };
      const surfaces = [];
      hemi(1);
      hemi(-1);
      // Cerebellum: tucked under the back, finely striped with folia.
      const cereb = (d) => 1 / Math.hypot(d[0] / 0.42, d[1] / 0.3, d[2] / 0.78);
      k.add(k.radial(cereb, { grid: 72, thick: 0.22 }), {
        pos: [0.58, -0.5, 0],
        flat: 0.2,
        interior: 0.1,
        core: "#f4e4d4",
        color: (c) => {
          const lp = c.lp;
          const f = Math.sin(
            (lp[1] + 0.25 * lp[0] * lp[0]) * 70 + k.noise(lp[0] * 4, lp[1] * 4, lp[2] * 4) * 2,
          );
          let col = PAL.cerebellum;
          if (f > 0.55) col = shade(col, 0.72);
          if (Math.abs(lp[2]) < 0.04) col = shade(col, 0.6);
          return lit(col, c.n, 0.62, 0.45);
        },
      });
      // Brainstem: the pons and the medulla reaching down.
      k.add(
        k.tube(
          spline([
            [0.18, -0.2, 0],
            [0.2, -0.55, 0],
            [0.24, -0.85, 0],
            [0.3, -1.1, 0],
          ]),
          (t) => 0.17 - 0.06 * t,
          { grid: 40, samples: 64, caps: true },
        ),
        {
          flat: 0.2,
          color: (c) => {
            const stripe = Math.abs(Math.sin(c.u * TAU * 5)) > 0.9;
            return lit(stripe ? shade(PAL.stem, 0.85) : PAL.stem, c.n, 0.62, 0.45);
          },
        },
      );
      k.add(k.ellipsoid(0.18, 0.16, 0.22), {
        pos: [0.12, -0.52, 0],
        flat: 0.2,
        color: (c) => lit(mix(PAL.stem, "#ffffff", 0.1), c.n, 0.62, 0.45),
      });
      // Little sparks of neurons firing, twinkling over the surface.
      k.cloud({ share: 0.0015, size: 1.2, pattern: false }, (rand) => {
        const s = surfaces[rand() < 0.5 ? 0 : 1];
        const d = randDir(rand);
        const p = add(mul(d, s.radius(d) + 0.012), [0, 0, s.cz]);
        return {
          p,
          color: rand() < 0.6 ? "#fff6b8" : "#d2f7ff",
          opacity: 1,
          kind: "twinkle",
          params: [0.55, rand() * TAU],
        };
      });
    },
  },

  // ---- Eye ------------------------------------------------------------------------------
  eye: {
    alive: true,
    options: [{ key: "iris", label: "Iris", type: "color", default: "#2f7fc1" }],
    controls: [
      { key: "pupil", label: "Pupil", type: "slider", default: 0.35 },
      { key: "light", label: "Light", type: "pulse", ease: 2.2 },
    ],
    action: { key: "light", label: "Shine a light", sound: "click" },
    drive(t, c, out) {
      out.grow = clamp(c.pupil * (1 - 0.85 * c.light), 0, 1);
      // Slowly looking around.
      const yaw = 0.38 * Math.sin(t * 0.37) + 0.12 * Math.sin(t * 1.1);
      const pitch = 0.2 * Math.sin(t * 0.53 + 1);
      out.parts.ball = {
        quat: quatMul(quatAxisAngle([0, 1, 0], yaw), quatAxisAngle([1, 0, 0], -pitch)),
      };
    },
    build(k, o) {
      const ball = k.part("ball", { pivot: [0, 0, 0] });
      const iris = o.iris;
      // The white of the eye, with fine vessels towards the back.
      k.add(k.sphere(1), {
        part: ball,
        flat: 0.15,
        color: (c) => {
          const n = c.ln;
          // Open at the front, where the iris sits.
          if (n[2] > 0.868) return null;
          let col = mix("#f7f4ee", "#e9e1d6", smoothstep(0.3, -0.8, n[2]));
          const vein = Math.abs(c.fbm(n[0] * 3 + 4, n[1] * 3, n[2] * 3, 3));
          if (vein < 0.03 && n[2] < 0.55)
            col = mix(col, "#d9535f", 0.6 * smoothstep(0.55, -0.2, n[2]));
          return lit(col, c.n, 0.66, 0.4);
        },
      });
      // Iris: a shallow cone of radial fibres, a dark rim and a pale ring.
      const irisR = 0.5;
      const iz = Math.sqrt(1 - irisR * irisR) + 0.01;
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const r = 0.12 + v * (irisR - 0.12);
            return [r * Math.cos(a), r * Math.sin(a), iz + 0.03 * (1 - v) * (1 - v)];
          },
          { grid: 64, thick: 0.02 },
        ),
        {
          part: ball,
          weight: 2.2,
          flat: 0.1,
          pattern: false,
          color: (c) => {
            const a = c.u * TAU;
            const r = c.v;
            const fibre =
              0.5 + 0.5 * Math.sin(a * 60 + 3 * c.noise(Math.cos(a) * 3, Math.sin(a) * 3, r * 4));
            let col = mix(shade(iris, 0.75), mix(iris, "#ffffff", 0.35), fibre * 0.6);
            col = mix(col, "#e6b35a", 0.45 * smoothstep(0.3, 0.0, r));
            col = mix(col, shade(iris, 0.3), smoothstep(0.82, 1, r));
            return col;
          },
        },
      );
      // The pupil, and a ring of black that grows as the pupil opens.
      k.add(k.disc(0.14), {
        part: ball,
        pos: [0, 0, iz + 0.06],
        rot: [90, 0, 0],
        weight: 3,
        pattern: false,
        color: "#070707",
      });
      k.add(k.disc(0.4, 0.13), {
        part: ball,
        pos: [0, 0, iz + 0.062],
        rot: [90, 0, 0],
        weight: 3,
        pattern: false,
        kind: "grow",
        params: (c) => {
          const r = Math.hypot(c.lp[0], c.lp[2]);
          return [clamp((r - 0.14) / 0.26, 0, 1) * 0.92, 0];
        },
        color: "#070707",
      });
      // The cornea: a clear dome over the iris.
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const th = v * 0.62;
            const R = 0.62;
            const cz = iz - R * Math.cos(0.62) + 0.06;
            return [
              R * Math.sin(th) * Math.cos(a),
              R * Math.sin(th) * Math.sin(a),
              cz + R * Math.cos(th),
            ];
          },
          { grid: 40, thick: 0.02 },
        ),
        {
          part: ball,
          flat: 0.1,
          opacity: 0.1,
          pattern: false,
          color: "#eaf6ff",
        },
      );
      // Inside (Slice): the lens behind the iris and the orange retina.
      k.add(k.ellipsoid(0.3, 0.3, 0.13), {
        part: ball,
        pos: [0, 0, iz - 0.2],
        weight: 1.2,
        pattern: false,
        opacity: 0.8,
        color: (c) => lit("#f4e3a1", c.n, 0.8, 0.3),
      });
      k.add(
        k.param(
          (u, v) => {
            const a = u * TAU;
            const th = Math.PI * 0.35 + v * Math.PI * 0.65;
            const R = 0.97;
            return [
              R * Math.sin(th) * Math.cos(a),
              R * Math.sin(th) * Math.sin(a),
              R * Math.cos(th),
            ];
          },
          { grid: 48, thick: 0.02 },
        ),
        {
          part: ball,
          pattern: false,
          color: (c) =>
            Math.abs(c.fbm(c.p[0] * 4, c.p[1] * 4, 2, 2)) < 0.04 ? "#b3262f" : "#e8744f",
        },
      );
      // The optic nerve at the back.
      k.add(
        k.tube(
          spline([
            [0.08, -0.05, -0.9],
            [0.12, -0.08, -1.2],
            [0.2, -0.15, -1.45],
          ]),
          0.16,
          { grid: 32, samples: 32, caps: true },
        ),
        {
          part: ball,
          flat: 0.2,
          color: (c) => lit(mix("#f2d59a", "#e9c27a", 0.5 + 0.5 * Math.sin(c.u * TAU * 8)), c.n),
        },
      );
      // A window highlight on the cornea (it stays put as the eye moves).
      k.add(k.sphere(0.07), {
        pos: [-0.2, 0.26, iz + 0.14],
        scale: [1.2, 0.8, 0.3],
        weight: 3,
        opacity: 0.95,
        pattern: false,
        color: (c) => keep("#ffffff"),
      });
      k.add(k.sphere(0.03), {
        pos: [0.18, -0.2, iz + 0.12],
        weight: 3,
        opacity: 0.8,
        pattern: false,
        color: (c) => keep("#ffffff"),
      });
      k.reach([0.4, 0.3, 1.1]);
      k.reach([-0.4, -0.3, 1.1]);
    },
  },

  // ---- Lungs ----------------------------------------------------------------------------
  lungs: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#f095a3" }],
    controls: [{ key: "breath", label: "Breath", type: "slider", default: 0.5 }],
    drive(t, c, out) {
      out.amount = 0.3 + 1.5 * c.breath;
    },
    build(k, o) {
      const pink = o.color;
      // Each lung: tall and rounded, pointed at the top, hollowed beneath,
      // flatter on the side facing the heart.
      const lung = (side) => {
        const cx = side * 0.52;
        const shape = (d) => {
          const medial = d[0] * side < 0;
          const ax = medial ? 0.3 : 0.5;
          const ay = d[1] > 0 ? 1.0 : 0.72;
          let r = 1 / Math.hypot(d[0] / ax, d[1] / ay, d[2] / 0.44);
          r *= 1 - 0.3 * smoothstep(0.3, 1, d[1]);
          // A hollow underneath where the diaphragm rises.
          r *= 1 - 0.18 * smoothstep(-0.6, -1, d[1]);
          // The heart's notch in the left lung.
          if (side > 0) {
            const nd = unit([-0.8, -0.35, 0.5]);
            r *= 1 - 0.28 * Math.pow(Math.max(0, dot(d, nd)), 4);
          }
          return r;
        };
        // Fissures between the lobes, on the surface.
        const fissure = (p) => {
          const x = (p[0] - cx) * side;
          const y = p[1];
          const oblique = Math.abs(y - (0.35 - 0.8 * (p[2] + 0.2) - 0.25 * x));
          let g = smoothstep(0.03, 0.0, oblique);
          if (side < 0 && p[2] > -0.05 && y > -0.1 + 0.8 * 0) {
            const horiz = Math.abs(y - 0.05 - 0.05 * x);
            if (y - (0.35 - 0.8 * (p[2] + 0.2) - 0.25 * x) > 0)
              g = Math.max(g, smoothstep(0.03, 0.0, horiz));
          }
          return g;
        };
        k.add(k.radial(shape, { grid: 96, thick: 0.3 }), {
          pos: [cx, 0, 0],
          flat: 0.2,
          interior: 0.1,
          core: mix(pink, "#ffffff", 0.3),
          kind: "breathe",
          params: [0.05, 0],
          color: (c) => {
            const g = fissure(c.p);
            const mott = c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30);
            let col = shade(pink, 1 + 0.08 * mott);
            col = mix(col, shade(pink, 0.55), g);
            return gloss(lit(col, c.n, 0.62, 0.42), c.n, 0.3, 14);
          },
        });
      };
      lung(-1);
      lung(1);
      // The windpipe with its rings of cartilage, and the bronchi.
      const ringCol = (c, y) =>
        lit(Math.abs(Math.sin(y * 42)) > 0.55 ? "#f3e2da" : "#dcb8b0", c.n, 0.65, 0.4);
      k.add(k.cylinder(0.13, 0.9, { caps: false }), {
        pos: [0, 0.95, -0.05],
        flat: 0.2,
        kind: "breathe",
        params: [0.015, 0],
        color: (c) => ringCol(c, c.p[1]),
      });
      const tree = [];
      const branch = (a, b, r, depth) => {
        const mid = add(lerp(a, b, 0.5), [0, 0.03, 0.02]);
        tree.push({ pts: [a, mid, b], r });
        if (depth <= 0) return;
        const d = unit(sub(b, a));
        for (const s of [-1, 1]) {
          const nd = unit(
            add(d, [
              s * 0.5 + (k.rand() - 0.5) * 0.3,
              -0.25 + (k.rand() - 0.5) * 0.3,
              (k.rand() - 0.5) * 0.4,
            ]),
          );
          branch(b, add(b, mul(nd, len(sub(b, a)) * 0.7)), r * 0.7, depth - 1);
        }
      };
      for (const side of [-1, 1]) branch([0, 0.52, -0.05], [side * 0.34, 0.25, -0.02], 0.08, 3);
      tree.forEach((b, i) => {
        k.add(
          k.tube(spline(b.pts), (t) => b.r * (1 - 0.25 * t), {
            grid: 24,
            samples: 24,
            caps: i < 2,
          }),
          {
            weight: i < 2 ? 1 : 1.3,
            flat: 0.2,
            kind: "breathe",
            params: [0.03, 0],
            pattern: false,
            color: (c) => ringCol(c, c.t * 3),
          },
        );
      });
    },
  },

  // ---- Tooth ----------------------------------------------------------------------------
  tooth: {
    alive: true,
    options: [{ key: "color", label: "Enamel", type: "color", default: "#f5f1e6" }],
    drive(t, c, out) {
      out.amount = 1;
    },
    build(k, o) {
      const enamel = o.color;
      // The crown: a rounded block with four cusps and grooves between them.
      const cusps = [
        [0.3, 0.3],
        [-0.3, 0.3],
        [0.3, -0.28],
        [-0.3, -0.28],
      ];
      const cy = 0.3;
      const crown = (d) => {
        const p = 3.2;
        const ax = 0.62;
        const az = 0.56;
        const ay = d[1] > 0 ? 0.42 : 0.5;
        let r =
          1 /
          Math.pow(
            Math.abs(d[0] / ax) ** p + Math.abs(d[1] / ay) ** p + Math.abs(d[2] / az) ** p,
            1 / p,
          );
        if (d[1] > 0) {
          const x = d[0] * r;
          const z = d[2] * r;
          let bump = 0;
          for (const [cx, cz] of cusps) bump += Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / 0.05);
          r += d[1] * (0.14 * bump - 0.05);
        }
        // Narrowing to the neck below.
        if (d[1] < 0) r *= 1 - 0.18 * smoothstep(-0.2, -0.8, d[1]);
        return r;
      };
      const pulp = (p) => {
        const q = sub(p, [0, cy - 0.05, 0]);
        return Math.hypot(q[0] / 0.26, q[1] / 0.22, q[2] / 0.22) < 1;
      };
      k.add(k.radial(crown, { grid: 96, thick: 0.4 }), {
        pos: [0, cy, 0],
        flat: 0.2,
        interior: 0.18,
        core: (c) => {
          if (pulp(c.p)) return "#e56f7c";
          const d = unit(sub(c.p, [0, cy, 0]));
          return len(sub(c.p, [0, cy, 0])) > crown(d) * 0.84 ? "#fbf7ec" : "#f1d58e";
        },
        color: (c) => {
          const lp = c.lp;
          // The groove between the cusps on the biting surface.
          const top = c.n[1] > 0.3 && lp[1] > 0.25;
          const fis = top && (Math.abs(lp[0]) < 0.035 || Math.abs(lp[2] + 0.01) < 0.03);
          let col = fis ? shade(enamel, 0.72) : enamel;
          col = mix(col, "#eadfca", smoothstep(0.0, -0.35, lp[1]));
          col = lit(col, c.n, 0.55, 0.5);
          return gloss(col, c.n, 0.55, 22);
        },
      });
      // Two roots, curving slightly, with canals down the middle (Slice).
      for (const s of [-1, 1]) {
        const curve = spline([
          [s * 0.3, cy - 0.2, 0],
          [s * 0.34, cy - 0.6, 0],
          [s * 0.3, cy - 1.0, 0.02],
          [s * 0.2, cy - 1.3, 0.04],
        ]);
        k.add(
          snugTube(k, curve, (t) => 0.21 * (1 - 0.75 * Math.pow(t, 1.4)) + 0.015, {
            grid: 48,
            samples: 64,
            caps: true,
          }),
          {
            scale: [1, 1, 1.35],
            flat: 0.2,
            interior: 0.15,
            core: (c) => {
              const a = curve(c.t ?? 0);
              const q = [c.p[0] - a[0], c.p[1] - a[1], c.p[2] / 1.35 - a[2]];
              return len(q) < 0.05 + 0.03 * (1 - (c.t ?? 0)) ? "#e56f7c" : "#f1d58e";
            },
            color: (c) => {
              const col = mix("#efe2c4", "#e2cfa4", c.t ?? 0);
              return gloss(lit(col, c.n, 0.55, 0.5), c.n, 0.25, 14);
            },
          },
        );
      }
    },
  },

  // ---- Kidney ---------------------------------------------------------------------------
  kidney: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#c2504a" }],
    build(k, o) {
      const col = o.color;
      // A bean: an ellipsoid with a dent (the hilum) on its inner side.
      const bean = (d) => {
        let r = 1 / Math.hypot(d[0] / 0.58, d[1] / 1.0, d[2] / 0.4);
        const hil = Math.max(0, dot(d, [-1, 0, 0]));
        r *= 1 - 0.42 * Math.pow(hil, 3);
        return r;
      };
      const pelvis = [-0.28, 0, 0];
      k.add(k.radial(bean, { grid: 96, thick: 0.32 }), {
        flat: 0.2,
        interior: 0.15,
        kind: "breathe",
        params: [0.012, 0],
        core: (c) => {
          const q = sub(c.p, pelvis);
          const r = Math.hypot(q[0], q[1], q[2] * 1.3);
          if (r < 0.2) return "#f3e3b5";
          const a = Math.atan2(q[1], q[0]);
          const d = unit(c.p);
          const outer = len(c.p) > bean(d) * 0.8;
          if (outer) return mix(col, "#e7907f", 0.4);
          const sector = Math.abs(Math.sin(a * 4.5));
          if (sector > 0.35 && r < 0.62) return Math.sin(r * 80) > 0 ? "#8e2f35" : "#a8434a";
          return mix(col, "#e7907f", 0.3);
        },
        color: (c) => {
          const n = c.noise(c.p[0] * 12, c.p[1] * 12, c.p[2] * 12);
          const base = shade(col, 1 + 0.06 * n);
          return gloss(lit(base, c.n, 0.6, 0.45), c.n, 0.45, 18);
        },
      });
      // Vessels at the hilum: artery (red), vein (blue) and the ureter below.
      const vessel = (pts, r, color, opts = {}) =>
        k.add(k.tube(spline(pts), r, { grid: 32, samples: 64, caps: true }), {
          flat: 0.2,
          pattern: false,
          ...opts,
          color: (c) => gloss(lit(color, c.n, 0.62, 0.45), c.n, 0.35, 14),
        });
      vessel(
        [
          [-0.25, 0.12, 0.02],
          [-0.55, 0.2, 0.05],
          [-0.85, 0.26, 0.02],
        ],
        0.075,
        "#e0463e",
      );
      vessel(
        [
          [-0.25, 0.0, 0.1],
          [-0.55, 0.02, 0.15],
          [-0.88, 0.06, 0.12],
        ],
        0.085,
        "#4d6fd0",
      );
      vessel(
        [
          [-0.25, -0.12, 0],
          [-0.42, -0.35, 0.02],
          [-0.45, -0.75, 0.0],
          [-0.4, -1.15, -0.02],
        ],
        0.055,
        "#f1d38a",
      );
      // The adrenal gland perched on top.
      k.add(k.ellipsoid(0.32, 0.14, 0.24), {
        pos: [0.06, 0.98, 0],
        rot: [0, 0, -12],
        flat: 0.2,
        pattern: false,
        color: (c) =>
          lit(
            mix("#f2c14e", "#e5a93a", 0.5 + 0.5 * c.noise(c.p[0] * 10, c.p[1] * 10, c.p[2] * 10)),
            c.n,
          ),
      });
    },
  },
};
