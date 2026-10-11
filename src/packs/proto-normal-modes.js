import { evenBox, evenTube } from "./even.js";
import { TOY_SOUNDS } from "../toy-sounds.js";
import { Chain, modes, MASS, SPRING, RUN, RESET, DURATION } from "./proto-normal-modes/physics.js";

const AXIS = [0.5, Math.sqrt(3) / 2, 0];
const GAP = 1.2; // One recipe unit represents 1 m along the track.
const HALF = 0.27;
const AMPLITUDE = 0.32; // m; bounds on the displacement vector prevent collisions.
const MAX_DISPLACEMENT = 0.38; // m, Euclidean norm of all start displacements.
const COLORS = ["#ed8554", "#62cbd0", "#d4b4ef", "#edce68", "#7dcda0"];
const point = (s, z = 0.13) => [AXIS[0] * s, AXIS[1] * s, z];
const dot = (p) => p[0] * AXIS[0] + p[1] * AXIS[1];
const smooth = (s) => s * s * s * (s * (s * 6 - 15) + 10);
let active = null;

function boxColor(color, sx, sy, sz) {
  return (c) => {
    const face = c.s.face;
    const w = face < 2 ? sy : sx;
    const h = face < 4 ? sz : sy;
    const edge = Math.min(c.u * w, (1 - c.u) * w, c.v * h, (1 - c.v) * h);
    // Reduce only the boundary splats, so a solid face has a crisp edge.
    return { c: color, size: 0.8 + 0.2 * Math.min(1, edge / 0.008) };
  };
}

function startFor(n, preset) {
  if (preset === "mix") return Array.from({ length: n }, (_, i) => (i === 0 ? AMPLITUDE : 0));
  const mode = modes(n)[Math.min(n - 1, Math.max(0, Number(preset) - 1))];
  return mode.vector.map((v) => v * AMPLITUDE);
}

function readoutLines(d) {
  if (!d) return [];
  const values = modes(d.n).map((m, i) => `${i + 1}: ${m.hz.toFixed(3)}`);
  return [
    `m = ${MASS.toFixed(1)} kg · k = ${SPRING} N/m`,
    `Mode Hz · ${values.slice(0, 3).join(" · ")}`,
    values.length > 3
      ? `Mode Hz · ${values.slice(3).join(" · ")}`
      : `ω (rad/s) · ${modes(d.n)
          .map((m) => m.omega.toFixed(3))
          .join(" · ")}`,
    d.phase === "release"
      ? `Released · t = ${d.elapsed.toFixed(2)} s`
      : d.phase === "reset"
        ? "Resetting to your start positions"
        : "Drag a mass, then tap to release",
  ];
}

function refreshReadout() {
  if (typeof document === "undefined") return;
  const box = document.getElementById("normal-modes-readout");
  if (!box) return;
  const text = readoutLines(active).join("\n");
  if (box.textContent !== text) box.textContent = text;
}

function pick(p) {
  if (!active) return -1;
  const cross = -AXIS[1] * p[0] + AXIS[0] * p[1];
  if (Math.abs(cross) > 0.48) return -1;
  const s = dot(p);
  return active.home.findIndex((h, i) => Math.abs(s - h - active.x[i]) < 0.38);
}

const recipe = {
  alive: true,
  kernel: "sharp",
  render: { cull: "low" },
  turntable: false,
  tiltLock: true,
  density: 0.12,
  options: [
    {
      key: "masses",
      label: "Masses",
      type: "select",
      default: "3",
      choices: [
        { id: "3", label: "3 masses" },
        { id: "4", label: "4 masses" },
        { id: "5", label: "5 masses" },
        { id: "2", label: "2 masses (math check)" },
      ],
    },
    {
      key: "preset",
      label: "Start positions",
      type: "select",
      default: "mix",
      choices: [
        { id: "mix", label: "Pull the first mass" },
        ...Array.from({ length: 5 }, (_, i) => ({
          id: String(i + 1),
          label: `Pure mode ${i + 1} (up to mass count)`,
        })),
      ],
    },
  ],
  controls: [
    {
      key: "release",
      label: "Release, then reset",
      type: "pulse",
      ease: DURATION,
      pausable: false,
    },
  ],
  action: { key: "release", label: "Release, then reset" },
  toySound: (o) => TOY_SOUNDS["normal-modes"].slice(0, Number(o.masses) || 3),
  input: {
    title: "Mode frequencies",
    fileButton: false,
    live: [
      {
        render() {
          const box = document.createElement("div");
          box.id = "normal-modes-readout";
          box.style.cssText =
            "white-space: pre-line; font-size: 12px; line-height: 1.7; font-variant-numeric: tabular-nums;";
          box.textContent = readoutLines(active).join("\n");
          return box;
        },
      },
    ],
    note: "Ideal, frictionless track. Motion runs for 3.6 s; the final 0.6 s resets the setup. Hums are illustrative pitches.",
    read: async () => ({}),
    shown: () => "",
  },
  drag: {
    plane: [0, 0, 1],
    at: (p) => pick(p) >= 0,
    start(p) {
      const d = active;
      const i = pick(p);
      if (i < 0) return;
      d.start = d.x.slice();
      d.phase = "ready";
      d.chain = null;
      d.grab = { i, from: dot(p), x: d.start[i] };
    },
    move(p) {
      const d = active;
      if (!d?.grab) return;
      const { i, from, x } = d.grab;
      // Keep ||x|| <= 0.38 m. Exact, undamped motion preserves this bound.
      const rest = d.start.reduce((s, v, j) => s + (i === j ? 0 : v * v), 0);
      const limit = Math.sqrt(Math.max(0, MAX_DISPLACEMENT ** 2 - rest));
      d.start[i] = Math.max(-limit, Math.min(limit, x + dot(p) - from));
      d.x = d.start.slice();
      refreshReadout();
    },
    end() {
      if (active) active.grab = null;
    },
  },
  drive(t, c, out, info) {
    const d = info.data;
    if (!d) return;
    const tap = info.tap;
    if (tap?.key === "release" && tap.n !== d.tapN) {
      d.tapN = tap.n;
      d.chain = new Chain(d.n, d.start);
      d.phase = "release";
      d.grab = null;
    }
    if (d.chain && !d.grab) {
      const elapsed = Math.max(0, Math.min(DURATION, (1 - c.release) * DURATION));
      d.elapsed = Math.min(RUN, elapsed);
      const solved = d.chain.advance(d.elapsed);
      if (elapsed < RUN) {
        d.x = solved;
        d.phase = "release";
      } else {
        const blend = smooth(Math.min(1, (elapsed - RUN) / RESET));
        d.x = solved.map((x, i) => x + (d.start[i] - x) * blend);
        d.phase = elapsed < DURATION ? "reset" : "ready";
        if (!c.release) d.chain = null;
      }
    }
    out.tokens = d.home.map((h, i) => ({ base: point(h), offset: point(d.x[i], 0) }));
    refreshReadout();
  },
  build(k, o) {
    // Cap even the Detail slider at a phone-friendly budget.
    k.count = Math.max(10000, Math.min(12000, k.count));
    const n = Math.max(2, Math.min(5, Number(o.masses) || 3));
    const home = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * GAP);
    const start = startFor(n, o.preset || "mix");
    const L = (n + 1) * GAP;
    const solid = { even: true, opacity: 1, jitter: 0, size: 0.85, pattern: false };
    k.add(evenBox(L + 0.2, 0.78, 0.12), {
      ...solid,
      rot: [0, 0, 60],
      pos: [0, 0, -0.2],
      color: boxColor("#293846", L + 0.2, 0.78, 0.12),
      weight: 0.45,
    });
    for (const side of [-1, 1]) {
      k.add(evenBox(L, 0.065, 0.09), {
        ...solid,
        rot: [0, 0, 60],
        pos: [-AXIS[1] * side * 0.34, AXIS[0] * side * 0.34, -0.08],
        color: boxColor("#8c9dab", L, 0.065, 0.09),
      });
      k.add(evenBox(0.16, 0.88, 0.36), {
        ...solid,
        rot: [0, 0, 60],
        pos: point((side * L) / 2, 0),
        color: boxColor("#c5d1db", 0.16, 0.88, 0.36),
      });
    }
    home.forEach((h, i) => {
      k.add(evenBox(HALF * 2, 0.62, 0.32), {
        ...solid,
        rot: [0, 0, 60],
        pos: point(h),
        color: boxColor(COLORS[i], HALF * 2, 0.62, 0.32),
        kind: "token",
        params: [i, 0],
        weight: 2,
      });
      // A regular grid on the front closes the flat face without random
      // sizes or sparse edge samples. It travels with the same rigid token.
      const cols = 22;
      const rows = 25;
      const dx = (HALF * 2) / cols;
      const dy = 0.62 / rows;
      k.cloud({ share: (cols * rows) / k.count, pattern: false }, (_, j) => {
        const x = ((j % cols) + 0.5) * dx - HALF;
        const y = (Math.floor(j / cols) + 0.5) * dy - 0.31;
        return {
          p: [AXIS[0] * (h + x) - AXIS[1] * y, AXIS[1] * (h + x) + AXIS[0] * y, 0.3],
          scales: [dx * 0.82, dy * 0.82, 0.002],
          quat: [0, 0, 0.5, Math.sqrt(3) / 2],
          color: COLORS[i],
          opacity: 1,
          kind: "token",
          params: [i, 0],
          pattern: false,
        };
      });
    });
    const ends = [-L / 2, ...home, L / 2];
    for (let j = 0; j <= n; j++) {
      const a = ends[j] + (j === 0 ? 0.08 : HALF);
      const b = ends[j + 1] - (j === n ? 0.08 : HALF);
      const curve = (s) => {
        const p = point(a + (b - a) * s);
        const phase = s * Math.PI * 12;
        const radius = 0.12 * Math.sin((Math.PI * Math.min(1, Math.min(s, 1 - s) * 12)) / 2);
        return [
          p[0] - AXIS[1] * radius * Math.cos(phase),
          p[1] + AXIS[0] * radius * Math.cos(phase),
          p[2] + radius * Math.sin(phase),
        ];
      };
      // Elastic helix follows its two endpoints; the masses remain rigid.
      k.add(evenTube(k, curve, 0.026, { caps: true }), {
        ...solid,
        color: "#d8e0e6",
        weight: 2.5,
        kind: "skin",
        skin: (c) => [j === 0 ? n : j - 1, j === n ? n + 1 : j, c.t],
      });
    }
    active = k.data = {
      n,
      home,
      start,
      x: start.slice(),
      phase: "ready",
      tapN: 0,
      chain: null,
      grab: null,
      elapsed: 0,
      tapBox: { min: [-L / 2, -L / 2, -0.25], max: [L / 2, L / 2, 0.4] },
    };
  },
};

export const RECIPES = { "normal-modes": recipe };
