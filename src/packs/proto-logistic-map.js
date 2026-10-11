// Codex prototype. Dimensionless discrete dynamics, not a continuous flow.
// Equations and thresholds: https://mathworld.wolfram.com/LogisticMap.html
import { FONT } from "../font.js";
import { TOY_SOUNDS } from "../toy-sounds.js";

export const orbitNote = (x) => ({
  ...TOY_SOUNDS["logistic-map"],
  // Quantized to semitones over two octaves, 220 to 880 Hz.
  f: 220 * 2 ** (Math.round(24 * x) / 12),
});

export const logistic = (r, x) => r * x * (1 - x);
export const STEP = 1 / 120; // seconds of presentation time; never a map integration step
export const DURATION = 4.2;
const SWEEP_END = 3;
const RETURN_END = 3.3;
const SEED = 0.217;
const BURN = 2048;
const WEB_STEPS = 14;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (v) => v * v * (3 - 2 * v);

function root(f, a, b) {
  for (let i = 0; i < 50; i++) {
    const m = (a + b) / 2;
    if (f(a) * f(m) > 0) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

// Flip bifurcations: the fixed point's multiplier is 2-r; the 2-cycle's
// product of derivatives is -r²+2r+4. Each loses stability at -1.
export const DOUBLINGS = [root((r) => 3 - r, 2.9, 3.1), root((r) => -r * r + 2 * r + 5, 3.4, 3.5)];
export const PERIOD_THREE = [
  1 + Math.sqrt(8),
  root(
    (r) => r ** 6 - 6 * r ** 5 + 4 * r ** 4 + 24 * r ** 3 - 14 * r ** 2 - 36 * r - 81,
    3.84,
    3.85,
  ),
];

export function orbit(r, count = WEB_STEPS + 1, burn = BURN) {
  let x = SEED;
  for (let n = 0; n < burn; n++) x = logistic(r, x);
  const values = [x];
  for (let n = 1; n < count; n++) values.push((x = logistic(r, x)));
  return values;
}

// A numerical repeat check; a finite sample cannot certify chaos.
export function period(r) {
  const xs = orbit(r, 128);
  for (let p = 1; p <= 32; p++) {
    if (xs.slice(64).every((x, n) => Math.abs(x - xs[64 + n - p]) < 1e-7)) return p;
  }
  return null;
}

const LEFT = -1.32;
const BOTTOM = -0.32;
const WIDTH = 1.65;
const HEIGHT = 1.65;
const WEB_X = 0.48;
const WEB_Y = 0.04;
const WEB_SIZE = 0.88;
const chartX = (r) => LEFT + ((r - 2.5) / 1.5) * WIDTH;
const chartPoint = (r, x) => [chartX(r), BOTTOM + HEIGHT * x, 0.03];
const webPoint = (x, y) => [WEB_X + WEB_SIZE * x, WEB_Y + WEB_SIZE * y, 0.08];

function cloud(k, points, extras = {}) {
  // Explicit point counts on every tier. No surfaces compete for the budget.
  k.cloud({ share: points.length / k.count, jitter: 0, opacity: 1, pattern: false }, (_, i) => ({
    color: "#526879",
    scales: [0.007, 0.007, 0.007],
    ...points[i],
    ...extras,
  }));
}

function line(a, b, color = "#526879", spacing = 0.012, extras = {}) {
  const n = Math.max(1, Math.ceil(Math.hypot(...a.map((v, i) => v - b[i])) / spacing));
  return Array.from({ length: n + 1 }, (_, i) => ({
    p: a.map((v, j) => v + ((b[j] - v) * i) / n),
    color,
    ...extras,
  }));
}

function text(k, str, x, y, h = 0.105, color = "#354b60") {
  const px = h / 7;
  const points = [];
  for (const [i, ch] of [...str].entries()) {
    const rows = FONT[ch]?.split(" ") || [];
    rows.forEach((row, j) => {
      [...row].forEach((bit, q) => {
        if (bit === "1")
          points.push({
            p: [x + (i * 6 + q) * px, y + (3 - j) * px, 0.06],
            color,
            scales: [px * 0.57, px * 0.57, px * 0.16],
          });
      });
    });
  }
  cloud(k, points);
}

let diagramCache;
export function diagram() {
  if (diagramCache) return diagramCache;
  const points = [];
  // Include the exact annotations and extra columns inside the narrow 3 window.
  const rs = new Set(Array.from({ length: 361 }, (_, i) => 2.5 + (1.5 * i) / 360));
  for (const r of [...DOUBLINGS, ...PERIOD_THREE]) rs.add(r);
  for (let i = 0; i <= 24; i++)
    rs.add(PERIOD_THREE[0] + ((PERIOD_THREE[1] - PERIOD_THREE[0]) * i) / 24);
  for (const r of [...rs].sort((a, b) => a - b)) {
    const seen = new Set();
    for (const x of orbit(r, 40)) {
      // Retain exact iterates; avoid overdrawing repeats at pixel resolution.
      const bin = Math.round(x * 300);
      if (seen.has(bin)) continue;
      seen.add(bin);
      points.push({ r, x });
    }
  }
  return (diagramCache = points);
}

function webVertices(r) {
  const xs = orbit(r);
  const points = [webPoint(xs[0], xs[0])];
  for (let n = 0; n < WEB_STEPS; n++) {
    points.push(webPoint(xs[n], xs[n + 1]), webPoint(xs[n + 1], xs[n + 1]));
  }
  return { xs, points };
}

export const RECIPES = {
  "logistic-map": {
    alive: true,
    turntable: false,
    tiltLock: true,
    kernel: "sharp",
    density: 0.04,
    controls: [{ key: "sweep", label: "Sweep r", type: "pulse", ease: DURATION, pausable: false }],
    action: { key: "sweep", label: "Sweep r" },
    toySound: () => [], // Every note comes from the live orbit, through cues.
    drive(t, c, out, info) {
      const data = info?.data;
      if (!data) return;
      const st = data.state;
      const input = info.slider;
      if (input && input.n !== st.sliderN && input.id.startsWith("logistic-")) {
        st.sliderN = input.n;
        st.selected = 2.5 + 1.5 * clamp(input.value, 0, 1);
        c.sweep = 0;
      }
      const running = c.sweep > 0;
      // Quantize presentation to a fixed 1/120 s clock. The map itself is
      // iterated exactly, with one discrete generation per recurrence.
      const elapsed = running
        ? Math.floor((DURATION * (1 - c.sweep) + 1e-9) / STEP) * STEP
        : DURATION;
      const u = clamp(elapsed / SWEEP_END, 0, 1);
      const returnU = ease(clamp((elapsed - SWEEP_END) / (RETURN_END - SWEEP_END), 0, 1));
      const r = running ? 2.5 + 1.5 * u + (st.selected - 4) * returnU : st.selected;
      const web = webVertices(r);
      out.morph = [
        running && elapsed < SWEEP_END ? 1.002 - u : 0,
        (data.initialR - r) / (data.initialR - 2.5),
        0,
        0,
      ];
      out.parts.scan = { offset: [chartX(r) - chartX(data.initialR), 0, 0] };
      out.tokens = web.points.map((p, i) => ({ offset: p.map((v, j) => v - data.restWeb[i][j]) }));
      const note = Math.floor(elapsed / 0.18);
      const head =
        running && elapsed < DURATION - 0.1
          ? web.points[1 + 2 * (note % WEB_STEPS)]
          : web.points[1];
      out.parts.head = { offset: head.map((v, j) => v - data.restWeb[1][j]) };
      if (running && elapsed < DURATION - 0.1 && (elapsed < st.lastElapsed || note !== st.note)) {
        out.cues.push(orbitNote(web.xs[1 + (note % WEB_STEPS)]));
      }
      st.note = note;
      st.lastElapsed = elapsed;
      // A changing id lets the existing slider show the current readout.
      const shownR = r.toFixed(3);
      out.slider = { id: `logistic-${shownR}`, label: `r = ${shownR}`, value: (r - 2.5) / 1.5 };
      // All moving marks are in front of the static axes; no backing plate.
      data.readout = {
        r,
        selected: st.selected,
        running,
        elapsed,
        period: period(r),
        doublings: DOUBLINGS,
        periodThree: PERIOD_THREE,
      };
    },
    build(k) {
      const selected = 3.835;
      const restWeb = webVertices(selected).points;
      k.data = {
        initialR: selected,
        restWeb,
        state: { selected, sliderN: -1, note: -1, lastElapsed: DURATION },
        tapBox: { min: [LEFT - 0.08, -0.95, -0.12], max: [1.43, 1.5, 0.16] },
      };
      cloud(
        k,
        diagram().map(({ r, x }) => ({
          p: chartPoint(r, x).map((v, i) =>
            i === 2 && r >= PERIOD_THREE[0] && r <= PERIOD_THREE[1] ? 0.06 : v,
          ),
          color: r >= PERIOD_THREE[0] && r <= PERIOD_THREE[1] ? "#e8a32f" : "#0c96ac",
          scales: [0.006, 0.009, 0.006],
          kind: "fade",
          params: [1.002 - (r - 2.5) / 1.5, 0.008],
          channel: 0,
        })),
      );
      const axes = [
        ...line(chartPoint(2.5, 0), chartPoint(4, 0)),
        ...line(chartPoint(2.5, 0), chartPoint(2.5, 1)),
        ...line(webPoint(0, 0), webPoint(1, 0)),
        ...line(webPoint(0, 0), webPoint(0, 1)),
        ...line(webPoint(0, 0), webPoint(1, 1), "#a9b8c0"),
      ];
      for (const r of DOUBLINGS)
        axes.push(...line(chartPoint(r, 0), chartPoint(r, 1), "#b46b70", 0.022));
      axes.push(
        ...line(
          chartPoint(PERIOD_THREE[0], -0.025),
          chartPoint(PERIOD_THREE[1], -0.025),
          "#e8a32f",
          0.005,
        ),
      );
      cloud(k, axes);
      text(k, "BIFURCATION", LEFT, 1.48, 0.115);
      text(k, "COBWEB", WEB_X, 1.1, 0.11);
      text(k, "2.5", LEFT, -0.43, 0.095);
      text(k, "4", LEFT + WIDTH - 0.04, -0.43, 0.095);
      text(k, "0", WEB_X - 0.02, -0.08, 0.085);
      text(k, "1", WEB_X + WEB_SIZE - 0.04, -0.08, 0.085);
      text(k, "X", LEFT - 0.1, 1.31, 0.085);
      text(k, "R", LEFT + WIDTH * 0.5, -0.43, 0.095);
      text(k, "DOUBLING 3.000 3.449", LEFT, -0.63);
      text(k, "PERIOD 3 3.828-3.841", LEFT, -0.8, 0.105, "#986511");
      text(k, "X AND R HAVE NO UNITS", LEFT, -0.97, 0.105);
      // The parabola changes exactly linearly with r; no approximated
      // interpolation between different orbits or warped backing image.
      cloud(
        k,
        Array.from({ length: 151 }, (_, i) => {
          const x = i / 150;
          return {
            p: webPoint(x, logistic(selected, x)),
            to: webPoint(x, logistic(2.5, x)),
            channel: 1,
            color: "#5364ba",
          };
        }),
      );
      const edges = [];
      for (let i = 0; i < restWeb.length - 1; i++) {
        // Rigid straight steps with independently moving endpoints.
        for (let j = 0; j <= 20; j++) {
          const f = j / 20;
          edges.push({
            p: restWeb[i].map((v, a) => v + (restWeb[i + 1][a] - v) * f),
            skin: [i, i + 1, f],
            color: "#cb7750",
          });
        }
      }
      cloud(k, edges);
      const scan = k.part("scan");
      cloud(
        k,
        line(chartPoint(selected, 0), chartPoint(selected, 1), "#303d64", 0.012).map((p) => ({
          ...p,
          p: [p.p[0], p.p[1], 0],
        })),
        {
          part: scan,
        },
      );
      const head = k.part("head");
      cloud(k, [{ p: restWeb[1], color: "#e67b21", scales: [0.022, 0.022, 0.022] }], {
        part: head,
      });
      k.reach([LEFT - 0.12, -1.08, 0]);
      k.reach([1.44, 1.57, 0]);
    },
  },
};
