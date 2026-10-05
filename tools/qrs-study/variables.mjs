// Lane QR lab r2, the study of splat QR codes: the variables and their
// sweeps. Each sweep runs from the easy end toward the hard end, so the
// threshold is where the scan rate first falls (core.mjs, crossing()).
// A variable is
//   { id, group, label, axis (the chart's x label), values [...],
//     x (value) => the number on the chart's axis, spec (value) => what to
//     build (core.mjs, buildSplats), texts, conds, trials }
import { KINDS } from "../../src/qr-lab/damage.js";
import { DEFAULTS, hexRGB, codeSplats } from "../../src/qr-lab/splats.js";
import { ROLE } from "../../src/qr-lab/steps.js";
import { wcag, mix, aliveColor } from "./core.mjs";

const FG = DEFAULTS.fg;
const BG = DEFAULTS.bg;
const range = (a, b, step) => {
  const out = [];
  const n = Math.round((b - a) / step);
  for (let i = 0; i <= n; i++) out.push(Math.round((a + i * step) * 1e6) / 1e6);
  return out;
};
const r2 = (x) => Math.round(x * 100) / 100;

// Solid finder patterns: the gapped (or dotted) build everywhere but the
// three finders, which come from a plain build (as the QR code toy draws its
// "eyes" whole).
const solidEyes = (opts) => (splats, steps) => {
  const plain = codeSplats(steps.modules, steps.size, { ...opts, gap: 0, shape: "square" });
  const eye = (s) => s.mod >= 0 && steps.role[s.mod] === ROLE.finder;
  return splats.filter((s) => !eye(s)).concat(plain.filter(eye));
};
// The sheet set 0.8 modules back (behind anything the motion moves).
const setBack = (splats) => {
  for (const s of splats) if (s.mod === -1) s.p = [s.p[0], s.p[1], s.p[2] - 0.8];
  return splats;
};
// The dark layer lifted off the sheet by `lift` modules (codeSplats puts it
// 0.03 in front).
const lifted = (lift) => (splats) => {
  for (const s of splats) if (s.mod >= 0 && s.dark) s.p = [s.p[0], s.p[1], s.p[2] - 0.01 + lift];
  return splats;
};

const ALIVE = {
  classic: { fg: hexRGB("#14161c"), wave: hexRGB("#1d4f9c") },
  gray: { fg: hexRGB("#6b6b6b"), wave: hexRGB("#1d4f9c") },
};

export function variables() {
  const list = [];
  const add = (v) => list.push({ group: "splat", frontOn: true, ...v });
  add({
    id: "soft",
    label: "Splat softness (wider)",
    axis: "softness (splat spread ÷ spacing)",
    values: [0.55, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4],
    spec: (v) => ({ opts: { soft: v } }),
  });
  add({
    id: "sparse",
    label: "Splat softness (narrower)",
    axis: "softness (splat spread ÷ spacing)",
    values: [0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05],
    spec: (v) => ({ opts: { soft: v } }),
  });
  add({
    id: "per",
    label: "Splats per module edge",
    axis: "splats per module edge",
    values: [8, 7, 6, 5, 4, 3, 2, 1],
    spec: (v) => ({ opts: { per: v } }),
  });
  add({
    id: "gap",
    label: "Gaps between modules",
    axis: "gap (share of the module's edge)",
    values: range(0, 0.9, 0.05),
    spec: (v) => ({ opts: { gap: v } }),
  });
  add({
    id: "opacity",
    label: "Opacity",
    axis: "opacity of the dark splats",
    values: range(0.05, 1, 0.05).reverse(),
    spec: (v) => ({ opts: { opacity: v } }),
  });
  add({
    id: "contrast",
    label: "Color contrast",
    axis: "WCAG contrast ratio (dark : light)",
    values: range(0, 0.95, 0.05),
    x: (t) => r2(wcag(mix(FG, BG, t), BG)),
    spec: (t) => ({ opts: { fg: mix(FG, BG, t) } }),
  });
  add({
    id: "gradient",
    label: "Gradient toward pale",
    axis: "WCAG contrast at the gradient's pale end",
    values: range(0, 0.95, 0.05),
    x: (t) => r2(wcag(mix(FG, BG, t), BG)),
    spec: (t) => ({ opts: { fg2: mix(FG, BG, t) } }),
  });
  add({
    id: "gap-eyes",
    label: "Gaps, finders kept solid",
    axis: "gap (share of the module's edge)",
    values: range(0, 0.9, 0.05),
    spec: (v) => ({ opts: { gap: v }, transform: solidEyes({ gap: v }) }),
  });
  add({
    id: "dots",
    label: "Dot modules, with gaps",
    axis: "gap (share of the module's edge)",
    values: range(0, 0.6, 0.1),
    spec: (v) => ({ opts: { shape: "dot", gap: v } }),
  });
  add({
    id: "rounded",
    label: "Rounded modules, with gaps",
    axis: "gap (share of the module's edge)",
    values: range(0, 0.6, 0.1),
    spec: (v) => ({ opts: { shape: "rounded", gap: v } }),
  });
  // At 3 splats per module edge a dot and a rounded square keep the very
  // same splats (every lattice point lies inside both), so the shapes are
  // also swept at 6 per edge, where they differ.
  for (const shape of ["dot", "rounded"])
    add({
      id: `${shape === "dot" ? "dots" : "rounded"}6`,
      label: `${shape === "dot" ? "Dot" : "Rounded"} modules, 6 splats per edge`,
      axis: "gap (share of the module's edge)",
      values: range(0, 0.6, 0.1),
      spec: (v) => ({ opts: { shape, gap: v, per: 6 } }),
    });
  add({
    id: "dots-eyes",
    label: "Dot modules, finders kept solid",
    axis: "gap (share of the module's edge)",
    values: range(0, 0.6, 0.1),
    spec: (v) => ({ opts: { shape: "dot", gap: v }, transform: solidEyes({ shape: "dot", gap: v }) }), // prettier-ignore
  });
  for (const [name, a] of Object.entries(ALIVE))
    add({
      id: `alive-${name}`,
      group: "motion",
      label: `Alive wave (${name} colors)`,
      axis: "phase of the wave (one loop)",
      values: range(0, 11 / 12, 1 / 12).map(r2),
      spec: (ph) => ({
        opts: { fg: a.fg },
        recolor: (s, steps) => aliveColor(s.color, a.wave, s.mod % steps.size, Math.floor(s.mod / steps.size), steps.size, ph), // prettier-ignore
      }),
    });
  // The motion moves modules out of the plane by up to ±0.6 × amount, so in
  // the trough of the wave they pass behind the sheet (0.03 behind them) and
  // vanish. The "-clear" sweeps push the sheet 0.8 modules back, so they
  // measure the motion itself.
  for (const amt of [0.5, 1])
    add({
      id: `time${amt * 100}-clear`,
      group: "motion",
      label: `Motion frames, sheet set back (moves up to ${(amt * 0.6).toFixed(1)} modules)`,
      axis: "moment in the motion (one loop)",
      frontOn: false,
      values: range(0, 11 / 12, 1 / 12).map(r2),
      spec: (t) => ({ damages: [{ kind: "time", amount: amt, t, region: "all" }], transform: setBack }), // prettier-ignore
    });
  for (const amt of [0.5, 1])
    add({
      id: `time${amt * 100}`,
      group: "motion",
      label: `Motion frames (moves up to ${(amt * 0.6).toFixed(1)} modules)`,
      axis: "moment in the motion (one loop)",
      frontOn: false,
      values: range(0, 11 / 12, 1 / 12).map(r2),
      spec: (t) => ({ damages: [{ kind: "time", amount: amt, t, region: "all" }] }),
    });
  add({
    id: "yaw",
    group: "view",
    label: "Turned sideways (yaw)",
    axis: "yaw in the scene (degrees)",
    frontOn: false,
    values: range(0, 80, 5),
    spec: (v) => ({ view: { yaw: v } }),
  });
  add({
    id: "yaw-lifted",
    group: "view",
    label: "Yaw, dark layer lifted 0.3 modules",
    axis: "yaw in the scene (degrees)",
    frontOn: false,
    values: range(0, 80, 5),
    spec: (v) => ({ view: { yaw: v }, transform: lifted(0.3) }),
  });
  add({
    id: "lift",
    group: "view",
    label: "Layer gap, seen at 20° yaw",
    axis: "dark layer in front of the sheet (modules)",
    frontOn: false,
    values: [0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.4, 0.6].reverse(),
    spec: (v) => ({ view: { yaw: 20 }, transform: lifted(v) }),
  });
  add({
    id: "pitch",
    group: "view",
    label: "Tipped back (pitch)",
    axis: "pitch in the scene (degrees)",
    frontOn: false,
    values: range(0, 80, 5),
    spec: (v) => ({ view: { pitch: v } }),
  });
  add({
    id: "dist",
    group: "view",
    label: "Distance",
    axis: "screen pixels per module (8 ÷ distance)",
    frontOn: false,
    values: range(1, 5, 0.25),
    x: (v) => r2(8 / v),
    spec: (v) => ({ view: { dist: v } }),
  });
  // Damage: every kind of damage.js, by region where the region matters.
  const regionsFor = (k) =>
    ["curve", "tilt", "time"].includes(k)
      ? ["all"]
      : ["tear", "burn"].includes(k)
        ? ["corner", "finder"]
        : ["all", "corner", "center", "finder", "edge"];
  for (const k of KINDS)
    for (const region of regionsFor(k.id))
      list.push({
        id: `dmg-${k.id}-${region}`,
        group: "damage",
        kind: k.id,
        region,
        frontOn: !["curve", "tilt", "time"].includes(k.id),
        label: `${k.label}, ${region}`,
        axis: "amount of damage (0 to 1)",
        values: range(0, 1, 0.1),
        spec: (a) => ({ damages: [{ kind: k.id, amount: a, region, t: 0.3 }] }),
      });
  list.push({
    id: "dmg-time-clear",
    group: "damage",
    kind: "time-clear",
    region: "all",
    frontOn: false,
    label: "Move in time, sheet set back",
    axis: "amount of damage (0 to 1)",
    values: range(0, 1, 0.1),
    spec: (a) => ({ damages: [{ kind: "time", amount: a, region: "all", t: 0.3 }], transform: setBack }), // prettier-ignore
  });
  return list.map((v) => ({ x: (val) => val, ...v }));
}

// The grids. "full" is what the report shows; "small" is for development
// and the test; "tiny" is the test's.
export function grid(name) {
  const every = (arr, n) => arr.filter((_, i) => i % n === 0 || i === arr.length - 1);
  if (name === "full")
    return {
      levels: ["L", "M", "Q", "H"],
      texts: (v) => (v.group === "damage" ? ["url"] : ["short", "url", "long"]),
      conds: (v) => (v.group === "damage" ? ["front", "phone"] : ["front", "phone", "hard"]),
      trials: (v) => (v.group === "damage" ? 2 : 3),
      values: (v) => v.values,
    };
  if (name === "tiny")
    return {
      levels: ["M"],
      texts: () => ["url"],
      conds: () => ["front", "phone"],
      trials: () => 1,
      values: (v) => [v.values[0], v.values[v.values.length - 1]],
    };
  return {
    levels: ["L", "M", "H"],
    texts: () => ["url"],
    conds: () => ["front", "phone"],
    trials: () => 1,
    values: (v) => every(v.values, 3),
  };
}
