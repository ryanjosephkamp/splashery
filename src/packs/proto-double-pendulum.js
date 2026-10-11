import { shade } from "../kit.js";
import { toySound } from "../toy-sounds.js";
import {
  DEFAULTS,
  Experiment,
  GRAVITY,
  TRAIL_COUNT,
  period,
  positions,
} from "./proto-double-pendulum/physics.js";

const PIVOTS = [-1.08, 1.08];
const COLORS = ["#60c5f0", "#ffb35b"];
const TEX_WIDTH = 256;
const TEX_HEIGHT = (2 * TRAIL_COUNT) / TEX_WIDTH;
const TRAIL_LIFT = 1.05;
let active = null;

function numbers(sim) {
  if (!sim) return [];
  const p = sim.p;
  const sep = (sim.separation * 180) / Math.PI;
  const lines = [
    `Elapsed: ${sim.time.toFixed(2)} s. ${sim.running ? "Running" : "Ready to release"}.`,
    `Angle separation: ${sep.toFixed(2)}°. ${sim.divergedAt === null ? "Waiting for more than 10°" : `First exceeded 10° at ${sim.divergedAt.toFixed(2)} s`}.`,
    `A is blue; B is orange. Starting difference: ${p.difference.toFixed(4)} rad.`,
    `Gravity: ${p.g.toFixed(2)} m/s². Arms: ${p.l1.toFixed(2)} m and ${p.l2.toFixed(2)} m. Bobs: ${p.m1.toFixed(2)} kg and ${p.m2.toFixed(2)} kg.`,
  ];
  if (p.mode === "single")
    lines.push(
      `One arm, 0.01 rad start: T = 2π√(L/g) = ${period(p.l1, p.g).toFixed(5)} s. Measured A: ${sim.period === null ? "waiting for two crossings" : `${sim.period.toFixed(5)} s`}.`,
    );
  return lines;
}

function readout() {
  const wrap = document.createElement("div");
  const reset = document.createElement("button");
  reset.type = "button";
  reset.id = "double-pendulum-reset";
  reset.textContent = "Reset";
  reset.style.minHeight = "44px";
  reset.addEventListener("click", () => {
    active?.reset();
    fill();
  });
  const box = document.createElement("div");
  box.id = "double-pendulum-readout";
  box.style.cssText = "font-variant-numeric:tabular-nums;line-height:1.45";
  const fill = () => {
    const text = numbers(active).join("\n");
    if (box.dataset.text === text) return;
    box.dataset.text = text;
    box.replaceChildren(
      ...numbers(active).map((line) => {
        const p = document.createElement("p");
        p.style.margin = "4px 0";
        p.textContent = line;
        return p;
      }),
    );
  };
  box.refresh = fill;
  fill();
  wrap.append(reset, box);
  return wrap;
}

// Each trail sample is a kit splat, repositioned through the existing relief
// texture. There is no image asset or engine hook. The pool is bounded at
// 1,024 samples per bob; even the smallest tier keeps the same trail capacity.
const SCREEN = {
  width: TEX_WIDTH * 2,
  height: TEX_HEIGHT,
  version: () => active?.version ?? 0,
  draw(g) {
    const img = g.createImageData(TEX_WIDTH * 2, TEX_HEIGHT);
    if (active)
      active.trails.forEach((trail, side) => {
        trail.forEach((p, j) => {
          const i = side * TRAIL_COUNT + j;
          const col = i % TEX_WIDTH;
          const row = Math.floor(i / TEX_WIDTH);
          const at = (row * TEX_WIDTH * 2 + col) * 4;
          const q = at + TEX_WIDTH * 4;
          const rgb = side ? [255, 164, 70] : [70, 171, 219];
          img.data.set([...rgb, 255], at);
          img.data.set(
            [
              Math.round(255 * (0.5 + p[0] / (2 * TRAIL_LIFT))),
              Math.round(255 * (0.5 + p[1] / (2 * TRAIL_LIFT))),
              128,
              255,
            ],
            q,
          );
        });
      });
    g.putImageData(img, 0, 0);
  },
};

const slider = (key, label, min, max, step) => ({
  key,
  label,
  type: "slider",
  min,
  max,
  step,
  default: DEFAULTS[key],
});

export const RECIPES = {
  "double-pendulum": {
    alive: true,
    turntable: false,
    tiltLock: true,
    kernel: "sharp",
    density: 0.12, // 7,200 splats on the phone tier, 16,800 on mid.
    options: [
      slider("difference", "Starting difference (rad)", 0.0001, 0.1, 0.0001),
      slider("l1", "Upper arm length (m)", 0.25, 1.5, 0.05),
      slider("l2", "Lower arm length (m)", 0.25, 1.5, 0.05),
      slider("m1", "Upper bob mass (kg)", 0.25, 2, 0.05),
      slider("m2", "Lower bob mass (kg)", 0.25, 2, 0.05),
      {
        key: "gravity",
        label: "Gravity",
        type: "select",
        default: "earth",
        choices: Object.entries(GRAVITY).map(([id, g]) => ({
          id,
          label: `${id[0].toUpperCase()}${id.slice(1)} (${g.toFixed(2)} m/s²)`,
        })),
      },
      slider("start1", "Upper start angle (° from down)", -175, 175, 1),
      slider("start2", "Lower start angle (° from down)", -175, 175, 1),
      {
        key: "mode",
        label: "Experiment",
        type: "select",
        default: "double",
        choices: [
          { id: "double", label: "Double pendulum chaos" },
          { id: "single", label: "One arm (small-angle period)" },
        ],
      },
    ],
    controls: [
      { key: "release", label: "Release", type: "pulse", ease: 0.4, pausable: false },
      { key: "reset", label: "Reset", type: "pulse", ease: 0.3, pausable: false },
    ],
    // The release gesture is short; the independent experiment runs until
    // Reset or another release. Both actions are silent, except bottom cues.
    action: { key: "release", label: "Release from start", quiet: ["release", "reset"] },
    input: {
      title: "The experiment",
      fileButton: false,
      live: [{ render: readout }],
      note: "Changing a setting resets the experiment. Tap to release both bobs. Trails show the recent path of each lower bob. Separation is the larger of the two wrapped arm-angle differences. One arm uses a 0.01 rad start for A.",
      read: async () => ({}),
      shown: () => "",
    },
    screen: SCREEN,
    drive(t, c, out, info) {
      const sim = info?.data?.experiment;
      if (!sim) return;
      const events = info.taps?.length ? info.taps : info.tap ? [info.tap] : [];
      for (const tap of events) {
        if (tap.n === sim.tapN || !["release", "reset"].includes(tap.key)) continue;
        sim.tapN = tap.n;
        sim.reset(tap.key === "release");
      }
      const dt = sim.lastClock === null ? 0 : Math.max(0, t - sim.lastClock);
      sim.lastClock = t;
      sim.advance(dt, (side) => {
        // Separate keys let simultaneous A and B ticks both sound. Sound.play
        // honors the site's mute, uses Web Audio, and creates no audio on load.
        info.sound?.play(toySound("double-pendulum"), { key: `double-pendulum:${side}`, gap: 0 });
      });
      sim.states.forEach((s, side) => {
        const pos = positions(s, sim.p);
        const upper = [...pos.upper.map((x) => x * sim.scale), 0];
        const lower = [...pos.lower.map((x) => x * sim.scale), 0];
        out.parts[`arm${side}Upper`] = { angle: s[0] };
        out.parts[`bob${side}Upper`] = { offset: upper };
        out.parts[`arm${side}Lower`] = {
          angle: s[1],
          offset: upper,
          visible: sim.p.mode === "single" ? 0 : 1,
        };
        out.parts[`bob${side}Lower`] = { offset: lower, visible: sim.p.mode === "single" ? 0 : 1 };
      });
      // Native stage text stays readable at phone size, without splat lettering.
      out.legend = {
        title: "Double pendulum chaos",
        items: [
          { text: `A: blue · B: orange · ${sim.time.toFixed(1)} s` },
          { text: `Separation ${((sim.separation * 180) / Math.PI).toFixed(1)}°` },
          {
            text:
              sim.divergedAt === null
                ? "Waiting for > 10°"
                : `> 10° at ${sim.divergedAt.toFixed(2)} s`,
            on: sim.divergedAt !== null,
          },
          {
            text: sim.running ? "Tap to restart; Reset in Toy tab" : "Tap or press Play to release",
          },
        ],
      };
      if (typeof document !== "undefined") {
        const box = document.getElementById("double-pendulum-readout");
        if (box && (sim.readoutAt === undefined || Math.abs(t - sim.readoutAt) > 0.2)) {
          sim.readoutAt = t;
          box.refresh?.();
        }
      }
    },
    build(k, o) {
      const sim = new Experiment(o);
      active = sim;
      k.data = { experiment: sim };
      const material = (color) => ({
        even: true,
        color: (c) => shade(color, 0.8 + 0.2 * Math.max(0, c.n[2])),
        jitter: 0,
        opacity: 1,
        flat: 0.4,
        pattern: false,
      });
      PIVOTS.forEach((x, side) => {
        const arm1 = k.part(`arm${side}Upper`, { pivot: [x, 0, 0], axis: [0, 0, 1] });
        const arm2 = k.part(`arm${side}Lower`, { pivot: [x, 0, 0], axis: [0, 0, 1] });
        const bob1 = k.part(`bob${side}Upper`, { pivot: [x, 0, 0] });
        const bob2 = k.part(`bob${side}Lower`, { pivot: [x, 0, 0] });
        const a = sim.p.l1 * sim.scale;
        const b = sim.p.l2 * sim.scale;
        k.add(k.cylinder(0.018, a), { ...material("#c9d0d8"), pos: [x, -a / 2, 0], part: arm1 });
        if (sim.p.mode !== "single")
          k.add(k.cylinder(0.018, b), { ...material("#c9d0d8"), pos: [x, -b / 2, 0], part: arm2 });
        k.add(k.sphere(0.065 * Math.cbrt(sim.p.m1)), {
          ...material(COLORS[side]),
          pos: [x, 0, 0.035],
          part: bob1,
          weight: 2,
        });
        if (sim.p.mode !== "single")
          k.add(k.sphere(0.065 * Math.cbrt(sim.p.m2)), {
            ...material(COLORS[side]),
            pos: [x, 0, 0.035],
            part: bob2,
            weight: 2,
          });
        k.add(k.box(0.2, 0.12, 0.12), { ...material("#65758a"), pos: [x, 0.075, -0.06] });
        k.add(k.sphere(0.034), { ...material("#e3e6ec"), pos: [x, 0, 0.07] });
        k.reach([x - 1.06, -1.06, -0.12]);
        k.reach([x + 1.06, 1.06, 0.12]);
      });
      k.cloud({ share: (2 * TRAIL_COUNT) / k.count, pattern: false }, (rand, i) => {
        if (i >= 2 * TRAIL_COUNT) return null;
        const side = Math.floor(i / TRAIL_COUNT);
        return {
          p: [PIVOTS[side], 0, -0.09],
          scales: [0.006, 0.006, 0.002],
          quat: [0, 0, 0, 1],
          color: COLORS[side],
          opacity: 1,
          kind: "relief",
          params: [
            ((i % TEX_WIDTH) + 0.5) / TEX_WIDTH,
            (Math.floor(i / TEX_WIDTH) + 0.5) / TEX_HEIGHT,
            3,
            TRAIL_LIFT,
          ],
          pattern: false,
        };
      });
    },
  },
};
