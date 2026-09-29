// Lane Fluids: the Fluid lab, a sandbox for the fluid engine (src/fluids/,
// docs/FLUIDS.md), labs only, on the Lab shelf.
//
//   glass   a lab stand's nozzle pours water, soda, honey or lava into a
//           glass. The third tap empties the glass first.
//   splash  a bowl with a shallow pool; a tap drops a ball of the liquid
//           into it, which splashes into drops that fall back and settle.
//   candle  a burning candle with its thin smoke; a tap blows it out (a
//           thick curl of smoke) and it lights again.
//   cup     a hot drink's steam; a tap blows across it.
//
// Units: one recipe unit is about 33 cm (unit: 0.33), so the glass is a
// tall one and a pour reads at a calm pace. Graphics physics: plausible
// motion, not a validated scientific solver.

import { mix, shade } from "../kit.js";

const UNIT = 0.33;
const TAP_SECS = 5;

export const LIQUID_LOOKS = {
  water: { preset: "water", nozzle: { speed: 1.6, radius: 0.08 }, pour: 2.4 },
  soda: { preset: "soda", nozzle: { speed: 1.6, radius: 0.08 }, pour: 2.4 },
  honey: { preset: "honey", nozzle: { speed: 0.75, radius: 0.1 }, pour: 3.2 },
  lava: { preset: "lava", nozzle: { speed: 0.75, radius: 0.1 }, pour: 3.2 },
};

// The glass (recipe units, standing on y = 0).
const GLASS = { type: "glass", at: [0, 0, 0], radius: 0.32, height: 1.0, wall: 0.03, bottom: 0.05 };
const NOZZLE = [-0.06, 1.72, 0];

// Which scene the last build made, for the tap's sound.
const LAB = { scene: "glass", tapN: 0 };

// ---- Shared pieces ------------------------------------------------------------------------

function wood(c) {
  const g = 0.5 + 0.5 * Math.sin(c.p[0] * 40 + c.fbm(c.p[0] * 3, 0, c.p[2] * 12, 3) * 6);
  return mix("#7a4f2c", "#a0703f", g * 0.7 + c.rand() * 0.05);
}

// A glass, drawn by the fluid engine (kind "vessel"): clear where you look
// straight through it and bright toward its edges, as real glass is.
function glass(k, g, budget = 9000) {
  k.fluid({ name: "glass", kind: "vessel", shape: g, budget, color: "#dcedf5" });
  k.reach([g.at[0] + g.radius + g.wall, g.at[1] + g.height, g.at[2] + g.radius + g.wall]);
  k.reach([g.at[0] - g.radius - g.wall, g.at[1], g.at[2] - g.radius - g.wall]);
}

// ---- Scenes -----------------------------------------------------------------------------

function glassScene(k, o) {
  const look = LIQUID_LOOKS[o.liquid] || LIQUID_LOOKS.water;
  // A round wooden board under the glass and the stand.
  k.add(k.cylinder(1.0, 0.06), { pos: [-0.25, -0.03, 0], color: wood, even: true });
  glass(k, GLASS);
  // The lab stand: a foot, a rod, an arm and a nozzle over the glass.
  const steel = (c) => shade("#9aa3ab", 0.85 + 0.3 * Math.max(0, c.n[1]) + 0.1 * c.n[0]);
  k.add(k.cylinder(0.035, 1.95), { pos: [-0.95, 0.975, -0.2], color: steel, even: true });
  k.add(k.box(0.3, 0.05, 0.3), { pos: [-0.95, 0.025, -0.2], color: "#3c4148", even: true });
  k.add(k.cylinder(0.025, 0.92), {
    pos: [(-0.95 + NOZZLE[0]) / 2, 1.9, -0.1],
    rot: [0, (Math.atan2(0.2, NOZZLE[0] + 0.95) * 180) / Math.PI, 90],
    color: steel,
    even: true,
  });
  // The nozzle: a short funnel and its tap handle (a part that turns open).
  k.add(k.cone(0.07, 0.12, 0.2, { caps: false }), {
    pos: [NOZZLE[0], NOZZLE[1] + 0.12, NOZZLE[2]],
    color: steel,
    even: true,
  });
  k.add(k.cylinder(0.05, 0.08), {
    pos: [NOZZLE[0], NOZZLE[1] + 0.25, NOZZLE[2]],
    color: "#6d757d",
    even: true,
  });
  const valve = k.part("valve", { pivot: [NOZZLE[0], NOZZLE[1] + 0.25, NOZZLE[2]], axis: [0, 0, 1] }); // prettier-ignore
  k.add(k.box(0.26, 0.035, 0.035), {
    pos: [NOZZLE[0] + 0.13, NOZZLE[1] + 0.25, NOZZLE[2] + 0.06],
    color: "#c9302c",
    part: valve,
    even: true,
  });
  k.fluid({
    name: "liquid",
    kind: "liquid",
    preset: look.preset,
    unit: UNIT,
    spacing: 0.052,
    budget: 1200,
    colliders: [GLASS, { type: "floor", y: 0 }],
    fill: { cylinder: { at: [0, 0.05, 0], radius: 0.3, height: 0.3 } },
    emitter: { at: NOZZLE, dir: [0, -1, 0], ...look.nozzle },
  });
  k.reach([0.9, 2.1, 0.5]);
  k.reach([-1.25, -0.05, -0.5]);
  k.data = { scene: "glass", pour: look.pour };
}

// A wide, shallow glass basin (seen through, so the pool shows from the side).
const BASIN = { type: "glass", at: [0, 0, 0], radius: 0.78, height: 0.4, wall: 0.03, bottom: 0.04 };

function splashScene(k, o) {
  const look = LIQUID_LOOKS[o.liquid] || LIQUID_LOOKS.water;
  k.add(k.cylinder(1.05, 0.06), { pos: [0, -0.03, 0], color: wood, even: true });
  glass(k, BASIN, 12000);
  k.fluid({
    name: "liquid",
    kind: "liquid",
    preset: look.preset,
    unit: UNIT,
    spacing: 0.06,
    budget: 1300,
    colliders: [BASIN, { type: "floor", y: 0 }],
    fill: { cylinder: { at: [0, 0.04, 0], radius: 0.76, height: 0.13 } },
  });
  k.reach([0, 1.75, 0]);
  k.data = { scene: "splash" };
}

function candleScene(k) {
  k.add(k.cylinder(0.5, 0.05), { pos: [0, 0.025, 0], color: "#c9b27c", even: true });
  k.add(k.cylinder(0.5, 0.03, { caps: false }), {
    pos: [0, 0.05, 0],
    color: "#d8c38c",
    even: true,
  });
  // Wax: warm cream, lighter at the top where the flame lights it.
  k.add(k.cylinder(0.17, 0.85), {
    pos: [0, 0.475, 0],
    color: (c) =>
      c.s.cap
        ? mix("#f3e6c8", "#fff4d8", 0.5)
        : mix("#e8d7b0", "#fbf0d6", Math.min(1, Math.max(0, (c.p[1] - 0.3) / 0.6))),
    even: true,
    weight: 2,
    size: 1.2,
  });
  // The melted pool on top and the wick.
  k.add(k.disc(0.12), { pos: [0, 0.902, 0], color: "#f7e9c9", share: 0.01 });
  k.add(k.cylinder(0.009, 0.08), { pos: [0, 0.94, 0], color: "#2a211b", share: 0.004 });
  k.fluid({
    name: "smoke",
    kind: "gas",
    look: "smoke",
    unit: UNIT,
    color: "#8f8f8f",
    budget: 800,
    size: 0.035,
    life: 3.2,
    rise: 0.75,
    turbulence: 0.55,
    height: 0.7,
    source: { at: [0, 0.99, 0], radius: 0.012, rate: 260, speed: 0.5, on: false },
  });
  k.fluid({
    name: "flame",
    kind: "flame",
    unit: UNIT,
    at: [0, 0.965, 0],
    height: 0.36,
    radius: 0.05,
    life: 0.42,
    budget: 520,
    sparks: 0.25,
    smoke: "smoke",
  });
  k.reach([0, 2.0, 0]);
  k.reach([0.5, 0, 0.5]);
  k.data = { scene: "candle" };
}

function cupScene(k) {
  // A saucer, a mug with a handle, and hot coffee with a light crema ring.
  k.add(k.cylinder(0.6, 0.04), { pos: [0, 0.02, 0], color: "#f2efe9", even: true });
  k.add(k.cylinder(0.6, 0.03, { caps: false }), {
    pos: [0, 0.03, 0],
    color: "#e6e1d8",
    even: true,
  });
  k.add(
    k.lathe(
      [
        [0.24, 0.04],
        [0.33, 0.08],
        [0.35, 0.3],
        [0.36, 0.62],
      ],
      { grid: 64 },
    ),
    { color: (c) => shade("#c8553d", 0.85 + 0.25 * Math.max(0, c.n[0] * 0.5 + c.n[2] * 0.5)), even: true }, // prettier-ignore
  );
  k.add(k.disc(0.38, 0.34), { pos: [0, 0.62, 0], color: "#d86a51", share: 0.02, even: true });
  k.add(k.torus(0.15, 0.035), { pos: [0.47, 0.35, 0], rot: [90, 0, 0], color: "#c8553d", share: 0.03 }); // prettier-ignore
  k.add(k.disc(0.345), {
    pos: [0, 0.56, 0],
    color: (c) => {
      const r = Math.hypot(c.p[0], c.p[2]) / 0.345;
      return mix("#3b2014", "#a8784e", Math.max(0, (r - 0.8) / 0.2) * 0.8);
    },
    even: true,
  });
  k.fluid({
    name: "steam",
    kind: "gas",
    look: "steam",
    unit: UNIT,
    budget: 800,
    size: 0.04,
    life: 2.8,
    rise: 0.45,
    turbulence: 0.9,
    height: 0.5,
    opacity: 0.085,
    source: { at: [0, 0.58, 0], radius: 0.24, rate: 90 },
  });
  k.reach([0, 1.9, 0]);
  k.reach([0.6, 0, 0.6]);
  k.data = { scene: "cup" };
}

// ---- The recipe -----------------------------------------------------------------------------

const POUR_SOUND = [
  { voice: "splash", f: 520, decay: 1.2, vol: 0.55 },
  { voice: "bubbles", at: 0.25, n: 7, rate: 9, decay: 1.4, vol: 0.45 },
];
const SODA_SOUND = [...POUR_SOUND, { voice: "sizzle", at: 0.4, decay: 2.2, vol: 0.3 }];
const THICK_SOUND = [{ voice: "gloop", f: 180, decay: 1.6, vol: 0.7 }];
const SPLASH_SOUND = [{ voice: "splash", f: 700, decay: 1.4, vol: 0.8 }];
const BLOW_SOUND = [
  { voice: "breath", decay: 0.8, vol: 0.8 },
  { voice: "hiss", at: 0.1, decay: 0.8, vol: 0.25 },
];
const STEAM_SOUND = [{ voice: "breath", decay: 1.1, vol: 0.7 }];

export const RECIPES = {
  "fluid-lab": {
    alive: true,
    turntable: false,
    // The props need fewer splats than a toy's whole budget; the rest is left
    // for drawing the fluid.
    density: 0.5,
    // Lab: the sharper splat edge (labs only, like this toy) keeps a liquid's
    // surface crisp instead of cloudy; smoke, steam and flames keep the soft
    // Gaussian. Read after build, so it follows the scene just built.
    get kernel() {
      return LAB.scene === "glass" || LAB.scene === "splash" ? "sharp" : "gaussian";
    },
    options: [
      {
        key: "scene",
        label: "Scene",
        type: "select",
        default: "glass",
        choices: [
          { id: "glass", label: "Glass" },
          { id: "splash", label: "Splash" },
          { id: "candle", label: "Candle" },
          { id: "cup", label: "Hot cup" },
        ],
      },
      {
        key: "liquid",
        label: "Liquid",
        type: "select",
        default: "water",
        choices: [
          { id: "water", label: "Water" },
          { id: "soda", label: "Soda" },
          { id: "honey", label: "Honey" },
          { id: "lava", label: "Lava" },
        ],
      },
    ],
    controls: [{ key: "go", label: "Pour, drop or blow", type: "pulse", ease: TAP_SECS }],
    action: { key: "go", label: "Pour, drop or blow", quiet: ["go"] },
    drive(t, c, out, info) {
      const d = info.data || {};
      const n = info.tap?.n ?? 0;
      // Seconds since the last tap (99: none yet, or long ago).
      const e = c.go > 0 ? (1 - c.go) * TAP_SECS : 99;
      const fresh = n > LAB.tapN;
      if (n < LAB.tapN) LAB.tapN = 0;
      if (fresh) LAB.tapN = n;
      out.fluid = {};
      if (d.scene === "glass") {
        // Every third tap empties the glass before it pours.
        const empty = n > 0 && n % 3 === 0;
        const start = empty ? 1.4 : 0;
        const on = e >= start && e < start + d.pour;
        out.fluid.liquid = { on, drain: empty && e < 1.3 ? 0.55 : 0 };
        // The red handle turns a quarter turn while it pours.
        const open = Math.min(1, Math.max(0, Math.min((e - start) / 0.25, (start + d.pour - e) / 0.25))); // prettier-ignore
        out.parts.valve = { angle: -1.35 * open };
        if (fresh) {
          const liquid = d.liquidId;
          out.cues.push(liquid === "soda" ? SODA_SOUND : liquid === "honey" || liquid === "lava" ? THICK_SOUND : POUR_SOUND); // prettier-ignore
        }
      } else if (d.scene === "splash") {
        out.fluid.liquid = {
          once: { id: n, do: "drop", at: [0.05, 1.45, 0.03], radius: 0.19, vel: [0, -1.5, 0] },
        };
        if (fresh) out.cues.push(d.liquidId === "honey" || d.liquidId === "lava" ? THICK_SOUND : SPLASH_SOUND); // prettier-ignore
      } else if (d.scene === "candle") {
        // Blown out for three seconds, then it lights again.
        const out3 = e < 3;
        out.fluid.flame = { on: !out3, wind: e < 0.35 ? [2.5, 0, 0] : [0, 0, 0] };
        // Put out, the hot wick sends up a thick ribbon of smoke that thins.
        out.fluid.smoke = { on: e < 2.6, flow: e < 2.6 ? (1 - e / 2.6) ** 1.5 : 0 };
        if (fresh) out.cues.push(BLOW_SOUND);
      } else if (d.scene === "cup") {
        const w = e < 2.2 ? Math.sin((Math.PI * e) / 2.2) : 0;
        out.fluid.steam = { wind: [1.4 * w, 0, 0.3 * w] };
        if (fresh) out.cues.push(STEAM_SOUND);
      }
    },
    build(k, o) {
      const scene = ["glass", "splash", "candle", "cup"].includes(o.scene) ? o.scene : "glass";
      LAB.scene = scene;
      if (scene === "glass") glassScene(k, o);
      else if (scene === "splash") splashScene(k, o);
      else if (scene === "candle") candleScene(k, o);
      else cupScene(k, o);
      k.data.liquidId = LIQUID_LOOKS[o.liquid] ? o.liquid : "water";
    },
  },
};
