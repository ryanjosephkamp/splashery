// Lane Optics (Waves and optics): a ripple tank and a light bench, labs toys
// on the Science shelf (docs/handoff/Optics.md).
//
//   ripple-tank  a real 2D wave equation on a grid (src/optics/ripple.js),
//                drawn as a water surface of splats lit so the crests read:
//                one or two dippers, a plane wave, one or two slits; the
//                frequency and the speed are live; a tap drops a pebble.
//   light-bench  rays traced with Snell's law (src/optics/rays.js) through
//                parts dragged on a bench: lenses, mirrors, a BK7 prism, a
//                glass block and a fiber, with the numbers in the Toy tab.
//
// Both draw live data with the kit's relief kind (kind 24): each splat owns a
// texel of the toy's screen canvas, its color on the left half and its lift
// on the right, redrawn by screen.draw() whenever screen.version() changes.
// It runs in the kit's own program, on WebGL2 and WebGPU alike.

import { RippleTank, doubleSlitAngles, singleSlitFirstMin } from "../optics/ripple.js";
import { BENCH, LENSES, LIGHTS, SETUPS as BENCH_SETUPS, benchNumbers, homeParts, partOutline, traceBench } from "../optics/bench.js"; // prettier-ignore
import { rot } from "../optics/rays.js";
import { quatAxisAngle } from "../kit.js";

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const deg = (r) => (r * 180) / Math.PI;
const fmt = (x, n = 1) => (Math.abs(x) < 1e-9 ? "0" : x.toFixed(n));

// ---- Ripple tank -----------------------------------------------------------------------

// The tank is 40 cm × 30 cm; a recipe unit is 10 cm. Sim coordinates are cm,
// x from the left and y from the front (the viewer's side); the waves of a
// plane source and the slits run away from the viewer.
export const TANK = { width: 36, depth: 36, nx: 216, beach: 5, cMax: 30 };
// The water is shown slowed down this many times, so a wave at 8 Hz is easy
// to follow.
export const SLOW = 4;
// Controls (0..1) to physical values.
export const SPEED = [15, 30]; // cm/s
export const FREQ = [4, 10]; // Hz
const lerp = (r, t) => r[0] + (r[1] - r[0]) * t;
export const speedOf = (c) => lerp(SPEED, clamp(c.speed ?? 0.33, 0, 1));
export const freqOf = (c) => lerp(FREQ, clamp(c.freq ?? 0.67, 0, 1));
const SOURCE_Y = 8; // dippers, cm from the front
const LINE_Y = 7; // the plane-wave bar
const BARRIER_Y = 12; // the barrier's middle
const LIFT = 0.12; // recipe units of lift at full height (heights exaggerated)
const H_SCALE = 0.035; // cm of water height that takes most of the lift
const toX = (x) => x / 10 - TANK.width / 20;
const toZ = (y) => TANK.depth / 20 - y / 10;
const fromX = (X) => (X + TANK.width / 20) * 10;
const fromZ = (Z) => (TANK.depth / 20 - Z) * 10;

// The setups (the Setup option).
const SETUPS = [
  { id: "double", label: "Double slit" },
  { id: "single", label: "Single slit" },
  { id: "two", label: "Two dippers" },
  { id: "one", label: "One dipper" },
  { id: "plane", label: "Plane wave" },
  { id: "still", label: "Still water (pebbles only)" },
];

// What a setup puts in the tank, in cm: { sources, line, barrier, pair }
// (pair: the two points whose path difference makes the fringes).
export function tankLayout(o) {
  const mid = TANK.width / 2;
  const a = clamp(Number(o.slit) || 1, 0.5, 8);
  const d = clamp(Number(o.spacing) || 6, 2, 14);
  const L = { sources: [], line: null, barrier: null, pair: null, a, d };
  if (o.setup === "one") L.sources = [{ x: mid, y: SOURCE_Y }];
  else if (o.setup === "two") {
    L.sources = [
      { x: mid - d / 2, y: SOURCE_Y },
      { x: mid + d / 2, y: SOURCE_Y },
    ];
    L.pair = { y: SOURCE_Y, d };
  } else if (o.setup === "plane") L.line = { y: LINE_Y };
  else if (o.setup === "single") {
    L.line = { y: LINE_Y };
    L.barrier = { y: BARRIER_Y, openings: [{ center: mid, width: a }] };
  } else if (o.setup === "double") {
    L.line = { y: LINE_Y };
    L.barrier = {
      y: BARRIER_Y,
      openings: [
        { center: mid - d / 2, width: Math.min(a, d - 0.5) },
        { center: mid + d / 2, width: Math.min(a, d - 0.5) },
      ],
    };
    L.pair = { y: BARRIER_Y, d };
  }
  return L;
}

// The one tank (one toy shows at a time); kept across rebuilds of the same
// size, so changing the slits doesn't still the water.
const RT = { tank: null, key: "", last: null, version: 0, tapN: 0, drop: null, guides: null, layout: null, readoutAt: -1 }; // prettier-ignore

function setUpTank(o) {
  if (!RT.tank) RT.tank = new RippleTank(TANK);
  const tank = RT.tank;
  const L = tankLayout(o);
  const key = JSON.stringify([o.setup, L.a, L.d]);
  if (key !== RT.key) {
    tank.clear();
    tank.time = 0;
    tank.phase = 0;
    RT.key = key;
  }
  tank.sources = L.sources;
  tank.line = L.line;
  tank.setBarrier(L.barrier);
  RT.layout = L;
  RT.guides = guideField(tank, L);
  RT.version++;
  return tank;
}

// For each cell past the slits (or the dippers): the difference of its
// distances to the two (cm), so the dotted guides can mark where it is a
// whole number of wavelengths: the bright fringes, near or far.
function guideField(tank, L) {
  if (!L.pair) return null;
  const { nx, ny, dx } = tank;
  const g = new Float32Array(nx * ny).fill(NaN);
  const mid = TANK.width / 2;
  for (let j = 0; j < ny; j++) {
    const y = (j + 0.5) * dx;
    if (y < L.pair.y + 1.2 || y > TANK.depth - TANK.beach) continue;
    for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * dx;
      if (x < TANK.beach || x > TANK.width - TANK.beach) continue;
      const r1 = Math.hypot(x - (mid - L.pair.d / 2), y - L.pair.y);
      const r2 = Math.hypot(x - (mid + L.pair.d / 2), y - L.pair.y);
      g[j * nx + i] = Math.abs(r1 - r2);
    }
  }
  return g;
}

// The bars along the back wall: the water's time-averaged strength (the
// mean of the height squared) along a line just before the far beach, as a
// bar graph. BAR_K splats stack up each bar.
const BAR_K = 14;
const BAR_H = 0.42; // recipe units at full strength
const barRow = (tank) => Math.round((TANK.depth - TANK.beach - 1) / tank.dx);

// Colors of the water (0..255): deep, mid and the bright crest.
const DEEP = [10, 42, 66];
const MID = [36, 118, 150];
const CREST = [214, 246, 255];
const GUIDE = [255, 214, 120];

function tankScreen() {
  return {
    get width() {
      return TANK.nx * 2;
    },
    get height() {
      return Math.round(TANK.depth / (TANK.width / TANK.nx)) + BAR_K;
    },
    version: () => (RT.tank ? `${RT.version}|${RT.tank.steps}|${RT.guidesOn}` : "none"),
    draw(g) {
      if (RT.tank) drawTank(g, RT.tank);
    },
  };
}

function drawTank(g, tank) {
  const { nx, ny, dx } = tank;
  const W = nx * 2;
  const H = g.canvas.height;
  if (!RT.img || RT.img.width !== W || RT.img.height !== H) RT.img = g.createImageData(W, H);
  const px = RT.img.data;
  const u = tank.u;
  const wall = tank.wall;
  const lambda = tank.wavelength;
  const guides = RT.guidesOn ? RT.guides : null;
  // Light from the back left, high up; the slope is exaggerated as the
  // heights are, and the curvature focuses light under the crests, as a
  // ripple tank's lamp does on the floor under it.
  const E = 2.2 / H_SCALE;
  const lx = -0.35;
  const lz = -0.45;
  const F = 0.25 * H_SCALE * dx * dx;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const o = (j * W + i) * 4;
      const q = o + nx * 4;
      const h = u[k];
      const iL = i > 0 ? k - 1 : k;
      const iR = i < nx - 1 ? k + 1 : k;
      const jD = j > 0 ? k - nx : k;
      const jU = j < ny - 1 ? k + nx : k;
      // Slopes and curvature in units of the display height, softly
      // limited so strong waves near the source don't drown weak ones.
      const sx = Math.tanh(((u[iR] - u[iL]) / (2 * dx)) * E);
      const sy = Math.tanh(((u[jU] - u[jD]) / (2 * dx)) * E);
      const lap = Math.tanh((u[iL] + u[iR] + u[jD] + u[jU] - 4 * h) / F);
      // n = (-sx, 1, +sy) in tank axes where +y runs away (−z): dot with L.
      const nl = (-sx * lx + 1 * 0.8 + sy * lz) / Math.sqrt(1 + sx * sx + sy * sy);
      let b = clamp(0.45 + 0.6 * (nl - 0.8) + 0.32 * Math.tanh(h / H_SCALE) - 0.12 * lap, 0, 1);
      let c;
      if (wall[k]) c = [44, 46, 52];
      else {
        c = b < 0.5 ? mixRGB(DEEP, MID, b * 2) : mixRGB(MID, CREST, (b - 0.5) * 2);
        if (guides) {
          const gd = guides[k];
          if (gd === gd) {
            const m = gd / lambda;
            const near = Math.abs(m - Math.round(m)) * lambda;
            // Dotted: on for 0.5 cm, off for 0.5 cm along y.
            if (near < 0.06 && (j * dx) % 0.8 < 0.3) c = mixRGB(c, GUIDE, 0.6);
          }
        }
      }
      px[o] = c[0];
      px[o + 1] = c[1];
      px[o + 2] = c[2];
      px[o + 3] = 255;
      px[q] = Math.round(255 * (0.5 + 0.5 * Math.tanh(h / H_SCALE)));
      px[q + 1] = 0;
      px[q + 2] = 0;
      px[q + 3] = 255;
    }
  }
  // The bars: the mean strength along the far line, scaled to the strongest
  // (eased so the scale doesn't jump).
  const jb = barRow(tank);
  let top = 0;
  for (let i = 0; i < nx; i++) top = Math.max(top, tank.intensity[jb * nx + i]);
  RT.barTop = Math.max(top, 0.6 * (RT.barTop || 0), 1e-6);
  for (let i = 0; i < nx; i++) {
    const x = (i + 0.5) * dx;
    const open = x > TANK.beach && x < TANK.width - TANK.beach;
    const v = open ? Math.sqrt(tank.intensity[jb * nx + i] / RT.barTop) : 0;
    for (let s = 0; s < BAR_K; s++) {
      const n = i * BAR_K + s;
      const r = ny + Math.floor(n / nx);
      const col = n % nx;
      const o = (r * W + col) * 4;
      const q = o + nx * 4;
      const on = (s + 0.5) / BAR_K < v;
      const c = mixRGB([255, 170, 70], [255, 245, 200], s / BAR_K);
      px[o] = c[0];
      px[o + 1] = c[1];
      px[o + 2] = c[2];
      px[o + 3] = 255;
      px[q] = 128;
      px[q + 1] = 128;
      px[q + 2] = 128;
      px[q + 3] = on ? 255 : 0;
    }
  }
  g.putImageData(RT.img, 0, 0);
}

function mixRGB(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// The numbers, for the Toy tab's panel.
export function tankNumbers(o, c) {
  const v = speedOf(c);
  const f = freqOf(c);
  const lambda = v / f;
  const L = tankLayout(o);
  const lines = [`Wavelength λ = speed ÷ frequency = ${fmt(v, 0)} cm/s ÷ ${fmt(f, 1)} Hz = ${fmt(lambda, 2)} cm.`]; // prettier-ignore
  if (o.setup === "double" || o.setup === "two") {
    const th = doubleSlitAngles(L.d, lambda).map((r) => `${fmt(deg(r), 1)}°`);
    const what = o.setup === "double" ? "Slits" : "Dippers";
    lines.push(`${what} d = ${fmt(L.d, 1)} cm apart: bright lines where d·sin θ = m·λ, at θ = ${th.join(", ")} (m = 0, 1, 2…).`); // prettier-ignore
  } else if (o.setup === "single") {
    const t1 = singleSlitFirstMin(L.a, lambda);
    lines.push(
      L.a > lambda
        ? `Slit a = ${fmt(L.a, 1)} cm wide: the beam spreads to its first dark line at sin θ = λ ÷ a, θ = ${fmt(deg(t1), 1)}°. A narrower slit spreads it wider.` // prettier-ignore
        : `Slit a = ${fmt(L.a, 1)} cm wide, narrower than λ: the wave spreads out on every side, almost like a single dipper.`, // prettier-ignore
    );
  }
  lines.push(`Shown ${SLOW} times slower than real, with the heights exaggerated.`);
  return lines;
}

function readoutPanel(id, lines) {
  const box = document.createElement("div");
  box.className = "opt-readout";
  box.id = id;
  box.style.cssText = "font-variant-numeric: tabular-nums; line-height: 1.45; margin: 6px 0;";
  box.dataset.text = "";
  fillReadout(box, lines());
  RO.lines[id] = lines;
  return box;
}
const RO = { lines: {} };
function fillReadout(box, lines) {
  const text = lines.join("\n");
  if (box.dataset.text === text) return;
  box.dataset.text = text;
  box.replaceChildren(
    ...lines.map((l) => {
      const p = document.createElement("p");
      p.style.margin = "0 0 4px";
      p.textContent = l;
      return p;
    }),
  );
}
// Refreshes a readout in the Toy tab a few times a second while it shows.
function refreshReadout(id, time) {
  if (typeof document === "undefined" || !RO.lines[id]) return;
  if (RO.at?.[id] !== undefined && Math.abs(time - RO.at[id]) < 0.25) return;
  (RO.at ||= {})[id] = time;
  const box = document.getElementById(id);
  if (box) fillReadout(box, RO.lines[id]());
}

const OPT = { tank: { o: null, c: null } };

const RIPPLE = {
  alive: true,
  density: 0.4,
  turntable: false,
  options: [
    { key: "setup", label: "Setup", type: "select", default: "double", choices: SETUPS },
    { key: "slit", label: "Slit width (cm)", type: "slider", min: 0.5, max: 8, step: 0.25, default: 1 }, // prettier-ignore
    { key: "spacing", label: "Slit or dipper spacing (cm)", type: "slider", min: 2, max: 14, step: 0.5, default: 6 }, // prettier-ignore
  ],
  controls: [
    { key: "freq", label: "Frequency (4 to 10 Hz)", type: "slider", default: 0.67 },
    { key: "speed", label: "Wave speed (15 to 30 cm/s)", type: "slider", default: 0.33 },
    { key: "run", label: "Sources on", type: "toggle", default: 1, ease: 0.01 },
    { key: "guides", label: "Show where d·sin θ = m·λ puts the bright lines", type: "toggle", default: 1, ease: 0.01 }, // prettier-ignore
    { key: "pebble", label: "Drop a pebble", type: "pulse", ease: 0.6 },
  ],
  action: {
    key: "pebble",
    label: "Drop a pebble",
    at: () => ({ key: "pebble" }),
  },
  input: {
    title: "The numbers",
    fileButton: false,
    live: [{ render: () => readoutPanel("opt-tank-readout", () => tankNumbers(OPT.tank.o || {}, OPT.tank.c || {})) }], // prettier-ignore
    note: "",
    read: async () => ({}),
    shown: () => "",
  },
  screen: tankScreen(),
  drive(t, c, out, info) {
    const tank = RT.tank;
    if (!tank) return;
    OPT.tank.c = c;
    tank.c = speedOf(c);
    tank.f = freqOf(c);
    tank.running = (c.run ?? 1) > 0.5;
    const guidesOn = (c.guides ?? 1) > 0.5;
    if (guidesOn !== RT.guidesOn) {
      RT.guidesOn = guidesOn;
      RT.version++;
    }
    // t is the toy's own clock (it follows Speed, and stops with motion off).
    const time = t;
    const dt = RT.last === null ? 0 : clamp(time - RT.last, 0, 0.1);
    RT.last = time;
    // A tap: the pebble falls from above the water to where it landed (the
    // Play button: near the middle, past the slits), then the rings start.
    const tap = info?.tap?.key === "pebble" ? info.tap : null;
    if (tap && tap.n !== RT.tapN) {
      RT.tapN = tap.n;
      let at = tap.point ? [fromX(tap.point[0]), fromZ(tap.point[2])] : null;
      if (
        !at ||
        !(
          at[0] > TANK.beach &&
          at[0] < TANK.width - TANK.beach &&
          at[1] > TANK.beach &&
          at[1] < TANK.depth - TANK.beach
        )
      )
        // prettier-ignore
        at = [TANK.width / 2 + 5, 19];
      RT.drop = { at, t: 0, hit: false };
    }
    if (RT.drop) {
      RT.drop.t += dt;
      const fall = 0.32; // seconds from 0.5 recipe units up (shown, not slowed)
      const s = Math.min(1, RT.drop.t / fall);
      out.parts.pebble = {
        offset: [toX(RT.drop.at[0]), 0.5 * (1 - s * s), toZ(RT.drop.at[1])],
        visible: s < 1 ? 1 : 0,
      };
      if (s >= 1 && !RT.drop.hit) {
        RT.drop.hit = true;
        RT.splashes = (RT.splashes || 0) + 1;
        tank.pebble(RT.drop.at[0], RT.drop.at[1]);
      }
      if (RT.drop.t > fall + 0.1) RT.drop = null;
    } else out.parts.pebble = { offset: [0, 0.5, 0], visible: 0 };
    tank.advance(dt / SLOW);
    // The dippers and the bar bob with the source, on the water's clock.
    const bob = tank.running ? 0.035 * Math.sin(tank.phase) * Math.min(1, tank.time * tank.f) : 0;
    out.parts.dippers = { offset: [0, bob, 0] };
    refreshReadout("opt-tank-readout", info?.time ?? t);
  },
  build(k, o) {
    OPT.tank.o = { ...o };
    const tank = setUpTank(o);
    // The sliders' frequency and speed (as last set, else their defaults).
    tank.c = speedOf(OPT.tank.c || {});
    tank.f = freqOf(OPT.tank.c || {});
    // Let the water run a little, so it opens with waves already out.
    if (tank.time < 1.2) tank.advance(1.2 - tank.time, { maxSteps: 1e6, avg: 0.5 });
    RT.last = null;
    const { nx, ny, dx } = tank;
    const W = TANK.width / 10;
    const D = TANK.depth / 10;
    const rows = ny + BAR_K;
    const cell = dx / 10;
    // The water: one relief splat per cell, lifted along y by its height
    // (on a small budget, one per 2 × 2 cells, reading the texture between
    // them).
    const st = (nx * ny + nx * BAR_K) * 1.05 > k.count * 0.85 ? 2 : 1;
    const mx = Math.floor(nx / st);
    const my = Math.floor(ny / st);
    const nWater = mx * my;
    const nBars = mx * BAR_K;
    k.reach([W / 2 + 0.08, 0.6, D / 2 + 0.08]);
    k.reach([-W / 2 - 0.08, -0.12, -D / 2 - 0.08]);
    k.cloud({ share: (nWater + nBars) / k.count, pattern: false }, (rand, n) => {
      if (n < nWater) {
        const i = (n % mx) * st + (st - 1) / 2;
        const j = Math.floor(n / mx) * st + (st - 1) / 2;
        return {
          p: [toX((i + 0.5) * dx), -LIFT / 2, toZ((j + 0.5) * dx)],
          scales: [cell * st * 0.62, cell * 0.08, cell * st * 0.62],
          quat: [0, 0, 0, 1],
          color: "#3a7f9a",
          opacity: 1,
          kind: "relief",
          params: [(i + 0.5) / nx, (j + 0.5) / rows, 1, LIFT],
          pattern: false,
        };
      }
      const m = n - nWater;
      if (m >= nBars) return null;
      // Bar i (every st-th column), splat s up it: its texel is that column's.
      const i = Math.floor(m / BAR_K) * st;
      const s = m % BAR_K;
      const t = i * BAR_K + s;
      const r = ny + Math.floor(t / nx);
      const col = t % nx;
      return {
        p: [toX((i + 0.5) * dx), 0.05 + ((s + 0.5) / BAR_K) * BAR_H, -D / 2 - 0.03],
        scales: [cell * st * 0.6, (BAR_H / BAR_K) * 0.55, 0.004],
        quat: [0, 0, 0, 1],
        color: "#ffcc66",
        opacity: 1,
        kind: "relief",
        params: [(col + 0.5) / nx, (r + 0.5) / rows, 3, 0.01],
        pattern: false,
      };
    });
    // The tank's rim, the floor's edge and the back wall the bars stand on.
    const rim = "#2b2f38";
    const t = 0.06;
    k.add(k.box(W + 2 * t, 0.12, t), { pos: [0, 0, D / 2 + t / 2], color: rim, even: true });
    k.add(k.box(W + 2 * t, 0.12, t), { pos: [0, 0, -D / 2 - t / 2], color: rim, even: true });
    k.add(k.box(t, 0.12, D), { pos: [W / 2 + t / 2, 0, 0], color: rim, even: true });
    k.add(k.box(t, 0.12, D), { pos: [-W / 2 - t / 2, 0, 0], color: rim, even: true });
    k.add(k.box(W + 2 * t, BAR_H + 0.08, 0.02), { pos: [0, 0.04 + BAR_H / 2, -D / 2 - 0.06], color: "#15171c", even: true }); // prettier-ignore
    // The beaches: a pale strip where the water meets the rim.
    const L = RT.layout;
    // The barrier: dark blocks between the openings, standing in the water.
    if (L.barrier) {
      const xs = [0, ...L.barrier.openings.flatMap((g) => [g.center - g.width / 2, g.center + g.width / 2]), TANK.width]; // prettier-ignore
      for (let s = 0; s < xs.length; s += 2) {
        const a = xs[s];
        const b = xs[s + 1];
        if (b - a < 0.05) continue;
        k.add(k.box((b - a) / 10, 0.1, 0.035), { pos: [toX((a + b) / 2), 0.0, toZ(L.barrier.y)], color: "#5a5f6b", even: true }); // prettier-ignore
      }
    }
    // The dippers (small balls on rods) or the plane-wave bar, on one part
    // that bobs with the source.
    const dip = k.part("dippers", { pivot: [0, 0, 0] });
    for (const s of L.sources) {
      k.add(k.sphere(0.045), { pos: [toX(s.x), 0.03, toZ(s.y)], color: "#e8e4da", part: dip, even: true }); // prettier-ignore
      k.add(k.cylinder(0.008, 0.45), { pos: [toX(s.x), 0.28, toZ(s.y)], color: "#9aa0aa", part: dip }); // prettier-ignore
    }
    if (L.line) {
      k.add(k.box(W - 0.1, 0.04, 0.05), { pos: [0, 0.02, toZ(L.line.y)], color: "#e8e4da", part: dip, even: true }); // prettier-ignore
      for (const x of [-W / 2 + 0.3, W / 2 - 0.3])
        k.add(k.cylinder(0.008, 0.45), { pos: [x, 0.26, toZ(L.line.y)], color: "#9aa0aa", part: dip }); // prettier-ignore
    }
    // The pebble, shown while it falls.
    const peb = k.part("pebble", { pivot: [0, 0, 0] });
    k.add(k.ellipsoid(0.05, 0.035, 0.045), { pos: [0, 0, 0], color: "#8a8378", part: peb, even: true }); // prettier-ignore
    k.data = { setup: o.setup };
  },
};

// ---- Light bench -----------------------------------------------------------------------

// The rays are drawn by relief splats on a lattice over the bench: CELL
// recipe units square, K splats a cell, each able to move LIFTR either way
// in x and y (so a sample can also take a free splat in a neighboring
// cell). Each sample of a ray (DS apart) takes a free splat near it, which
// moves exactly there (to about 1/85 of a cell) and takes its color.
const CELL = 0.06;
const K = 14;
const LIFTR = 1.5 * CELL;
const DS = 0.0068; // recipe units between samples along a ray
const RAY_SIGMA = 0.0058; // a ray splat's size (recipe units)
const RAY_Z = 0.075; // in front of the parts' faces
const TW = 256; // texels a row on each half of the screen canvas
const LAT = (() => {
  const cols = Math.ceil(BENCH.W / CELL);
  const rows = Math.ceil(BENCH.H / CELL);
  const n = cols * rows * K;
  return { cols, rows, n, x0: -BENCH.W / 2, y0: -BENCH.H / 2, th: Math.ceil(n / TW) };
})();

// The bench's state: the parts where they stand now, the light, what the
// rays look like (rebuilt when anything moves), and the drag.
const BS = { parts: [], home: [], o: null, light: "white", version: 0, traced: null, numbers: null, used: null, img: null, grab: null, tapN: 0 }; // prettier-ignore

function benchUpdate() {
  const o = { ...(BS.o || {}), light: BS.light };
  BS.traced = traceBench(BS.parts, BS.light);
  BS.numbers = benchNumbers(BS.parts, BS.traced, o);
  BS.version++;
}

function benchScreen() {
  return {
    width: TW * 2,
    height: LAT.th,
    version: () => BS.version,
    draw(g) {
      drawRays(g);
    },
  };
}

// Writes every ray's samples into the canvas: color on the left half, the
// offset from the splat's cell middle on the right (x and y about 128, z at
// 128), alpha 0 for the splats left over.
function drawRays(g) {
  const W = TW * 2;
  if (!BS.img || BS.img.width !== W || BS.img.height !== LAT.th)
    BS.img = g.createImageData(W, LAT.th);
  const px = BS.img.data;
  for (let i = 3; i < px.length; i += 4) px[i] = 0;
  if (!BS.used || BS.used.length !== LAT.cols * LAT.rows)
    BS.used = new Uint8Array(LAT.cols * LAT.rows);
  BS.used.fill(0);
  const put = (x, y, rgb) => {
    const ci = Math.floor((x - LAT.x0) / CELL);
    const cj = Math.floor((y - LAT.y0) / CELL);
    // The own cell first, then its neighbors, nearest first.
    for (const [di, dj] of NEIGHBORS) {
      const a = ci + di;
      const b = cj + dj;
      if (a < 0 || b < 0 || a >= LAT.cols || b >= LAT.rows) continue;
      const c = b * LAT.cols + a;
      if (BS.used[c] >= K) continue;
      const cx = LAT.x0 + (a + 0.5) * CELL;
      const cy = LAT.y0 + (b + 0.5) * CELL;
      const dx = x - cx;
      const dy = y - cy;
      if (Math.abs(dx) > LIFTR || Math.abs(dy) > LIFTR) continue;
      const n = c * K + BS.used[c]++;
      const col = n % TW;
      const row = Math.floor(n / TW);
      const o = (row * W + col) * 4;
      const q = o + TW * 4;
      px[o] = rgb[0] * 255;
      px[o + 1] = rgb[1] * 255;
      px[o + 2] = rgb[2] * 255;
      px[o + 3] = 255;
      px[q] = Math.round(255 * (0.5 + (0.5 * dx) / LIFTR));
      px[q + 1] = Math.round(255 * (0.5 + (0.5 * dy) / LIFTR));
      px[q + 2] = 128;
      px[q + 3] = 255;
      return;
    }
  };
  const line = (a, b, rgb, dash = 0) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(L / DS));
    for (let i = 0; i <= n; i++) {
      const s = (i * DS) % (2 * dash);
      if (dash && s > dash) continue;
      const t = Math.min(1, i / n);
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      if (Math.abs(x) > BENCH.W / 2 || Math.abs(y) > BENCH.H / 2) continue;
      put(x, y, rgb);
    }
  };
  if (BS.traced) {
    // White light's colors, sampled side by side: where neighboring colors
    // still lie within a ray's width of each other they are drawn as one
    // sample of their mixed color (so the fan starts white and opens into
    // its colors, as it does on a real screen), and each on its own after.
    const groups = new Map();
    for (const p of BS.traced.paths) {
      if (!p.group) {
        for (let i = 0; i + 1 < p.pts.length; i++) line(p.pts[i], p.pts[i + 1], p.rgb);
        continue;
      }
      if (!groups.has(p.group)) groups.set(p.group, []);
      groups.get(p.group).push({ rgb: p.rgb, s: sampled(p.pts) });
    }
    for (const g of groups.values()) {
      const n = Math.max(...g.map((x) => x.s.length));
      for (let i = 0; i < n; i++) {
        let acc = null;
        let last = null;
        const flush = () => {
          if (!acc) return;
          // Many colors together read as white light.
          const m = Math.max(acc.c[0], acc.c[1], acc.c[2]) || 1;
          const w = (acc.k - 1) / Math.max(1, g.length - 1);
          put(
            acc.x / acc.k,
            acc.y / acc.k,
            acc.c.map((v) => v / m + (1 - v / m) * w),
          );
          acc = null;
        };
        for (const r of g) {
          const q = r.s[i];
          if (!q) continue;
          if (acc && last && Math.hypot(q[0] - last[0], q[1] - last[1]) > RAY_SIGMA * 1.4) flush();
          if (!acc) acc = { x: 0, y: 0, k: 0, c: [0, 0, 0] };
          acc.x += q[0];
          acc.y += q[1];
          acc.k++;
          acc.c = acc.c.map((v, j) => v + r.rgb[j]);
          last = q;
        }
        flush();
      }
    }
    // The normals where the light first meets a glass face or the flat
    // mirror (dashed), so the angles read.
    for (const id of Object.keys(BS.traced.results)) {
      const t = BS.traced.results[id][0]?.[0]?.t;
      const e = t?.events?.find((x) => x.surface?.part && x.surface.part !== "screen" && !x.surface.edge); // prettier-ignore
      if (!e || !e.normal || BS.o?.setup === "lens" || BS.o?.setup === "fiber") continue;
      if (BS.o?.setup === "mirrors" && e.surface.part !== "plane") continue;
      const n = e.normal;
      line([e.at[0] - n[0] * 0.22, e.at[1] - n[1] * 0.22], [e.at[0] + n[0] * 0.22, e.at[1] + n[1] * 0.22], [0.75, 0.78, 0.85], 0.018); // prettier-ignore
    }
  }
  for (const m of BS.numbers?.marks || []) {
    const at = m.at || [m.x, m.y];
    if (m.type === "focus") {
      const r = 0.03;
      line([at[0] - r, at[1] - r], [at[0] + r, at[1] + r], [1, 0.85, 0.35]);
      line([at[0] - r, at[1] + r], [at[0] + r, at[1] - r], [1, 0.85, 0.35]);
    } else if (m.type === "image") {
      // The image the lens equation predicts: an arrow, dashed if virtual.
      const col = [1, 0.62, 0.25];
      const tip = [at[0], at[1] + m.h];
      const dash = m.virtual ? 0.015 : 0;
      line(at, tip, col, dash);
      const s = Math.sign(m.h) || 1;
      line(tip, [tip[0] - 0.035, tip[1] - s * 0.05], col);
      line(tip, [tip[0] + 0.035, tip[1] - s * 0.05], col);
      if (m.virtual && BS.traced?.results.object) {
        // The rays traced back to where they seem to come from.
        for (const b of BS.traced.results.object) {
          const t = b[Math.floor(b.length / 2)].t;
          const n = t.pts.length;
          if (n < 4) continue;
          const a = t.pts[n - 2];
          const d = [t.pts[n - 1][0] - a[0], t.pts[n - 1][1] - a[1]];
          if (Math.abs(d[0]) < 1e-9) continue;
          const k = (at[0] - a[0]) / d[0];
          line(a, [a[0] + d[0] * k, a[1] + d[1] * k], [0.6, 0.62, 0.7], 0.012);
        }
      }
    }
  }
  g.putImageData(BS.img, 0, 0);
}
// Points DS apart along a polyline, inside the bench.
function sampled(pts) {
  const out = [];
  let carry = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let s = carry;
    for (; s <= L; s += DS) {
      const x = a[0] + ((b[0] - a[0]) * s) / L;
      const y = a[1] + ((b[1] - a[1]) * s) / L;
      if (Math.abs(x) <= BENCH.W / 2 && Math.abs(y) <= BENCH.H / 2) out.push([x, y]);
    }
    carry = s - L;
  }
  return out;
}
const NEIGHBORS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]; // prettier-ignore

// ---- Dragging the parts ----------------------------------------------------------------

// The knob that turns a part: a ring this far from its middle, on its local
// +y side (above it, at home).
function knobOf(p) {
  if (!p.turn) return null;
  const r = { lamp: 0.13, raybox: 0.07 + (p.rays * p.gap) / 2, prism: 0.52, block: p.h / 2 + 0.13, mirror: p.length / 2 + 0.1 }[p.type] ?? 0.3; // prettier-ignore
  return [p.pos[0] - Math.sin(p.angle) * r, p.pos[1] + Math.cos(p.angle) * r];
}
const KNOB_R = 0.045;

function insidePoly(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a[1] > pt[1] !== b[1] > pt[1] && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; // prettier-ignore
  }
  return c;
}

// The part under a point (bench coordinates), or its knob.
function pickPart(pt) {
  for (const p of BS.parts) {
    const k = knobOf(p);
    if (k && Math.hypot(pt[0] - k[0], pt[1] - k[1]) < KNOB_R * 1.8)
      return { part: p, mode: "turn" };
  }
  for (const p of BS.parts) {
    if (!p.move) continue;
    const local = rot([pt[0] - p.pos[0], pt[1] - p.pos[1]], -p.angle);
    const box = bodyBox(p);
    const polys = partOutline(p);
    const hitPoly = polys.some((poly) => insidePoly(local, poly));
    const hitBox = box && local[0] > box[0] - 0.04 && local[0] < box[2] + 0.04 && local[1] > box[1] - 0.04 && local[1] < box[3] + 0.04; // prettier-ignore
    if (hitPoly || hitBox)
      return { part: p, mode: "move", from: [pt[0] - p.pos[0], pt[1] - p.pos[1]] };
  }
  return null;
}

// A part's body as a box in its own frame, where it has no glass outline
// (the lamps, the mirrors, the screen, the arrow): [x0, y0, x1, y1].
function bodyBox(p) {
  if (p.type === "lamp") return [-0.14, -0.06, 0.13, 0.06];
  if (p.type === "raybox") return [-0.12, -(p.rays * p.gap) / 2 - 0.04, 0.12, (p.rays * p.gap) / 2 + 0.04]; // prettier-ignore
  if (p.type === "mirror") return [-0.06, -p.length / 2, 0.05, p.length / 2];
  if (p.type === "screen") return [-0.02, -p.length / 2, 0.06, p.length / 2];
  if (p.type === "object") return [-0.05, -0.02, 0.05, p.height + 0.02];
  if (p.type === "lens") return [-0.12, -p.lens.h, 0.12, p.lens.h];
  return null;
}

const BENCH_DRAG = {
  plane: [0, 0, 1],
  at: (p) => !!pickPart(p),
  start(p) {
    BS.grab = pickPart(p);
  },
  move(p) {
    const g = BS.grab;
    if (!g) return;
    const part = g.part;
    const m = 0.08;
    if (g.mode === "turn") {
      part.angle = Math.atan2(p[1] - part.pos[1], p[0] - part.pos[0]) - Math.PI / 2;
    } else {
      const x = clamp(p[0] - g.from[0], -BENCH.W / 2 + m, BENCH.W / 2 - m);
      const y = clamp(p[1] - g.from[1], -BENCH.H / 2 + m, BENCH.H / 2 - m);
      part.pos = part.move === "x" ? [x, part.pos[1]] : [x, y];
    }
    benchUpdate();
  },
  end() {
    BS.grab = null;
  },
};

// ---- Building the bench ----------------------------------------------------------------

const GLASS = [0.55, 0.78, 0.9];
const GLASS_EDGE = [0.86, 0.97, 1];
const FLINT = [0.78, 0.76, 0.62];

// Points filling a polygon on a grid `step` apart, and along its edges.
function fillPoly(poly, step) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of poly) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const out = [];
  for (let y = y0 + step / 2; y < y1; y += step * 0.866)
    for (
      let x = x0 + step / 2 + (Math.round((y - y0) / (step * 0.866)) % 2) * step * 0.5;
      x < x1;
      x += step // prettier-ignore
    )
      if (insidePoly([x, y], poly)) out.push([x, y]);
  return out;
}
function edgePoly(poly, step, closed = true) {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const m = Math.max(1, Math.ceil(L / step));
    for (let j = 0; j < m; j++) out.push([a[0] + ((b[0] - a[0]) * j) / m, a[1] + ((b[1] - a[1]) * j) / m]); // prettier-ignore
  }
  return out;
}

// Each part's splats in its own frame: [{ p: [x, y, z], rgb, s (size),
// a (opacity) }].
function partSplats(p) {
  const out = [];
  const add = (pts, z, rgb, s, a) => {
    for (const q of pts) out.push({ p: [q[0], q[1], z], rgb, s, a });
  };
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; // prettier-ignore
  const polys = partOutline(p);
  if (p.type === "fiber") {
    add(fillPoly(polys[0], 0.01), 0.01, GLASS, 0.011, 0.16);
    add(edgePoly(polys[0], 0.005), 0.02, GLASS_EDGE, 0.0045, 0.85);
    add(fillPoly(polys[1], 0.01), 0.03, FLINT, 0.011, 0.16);
    add(edgePoly(polys[1], 0.005), 0.04, [0.95, 0.9, 0.72], 0.004, 0.7);
  } else if (polys.length) {
    add(fillPoly(polys[0], 0.01), 0.02, p.glass === "N-SF11" ? FLINT : GLASS, 0.011, 0.11);
    add(edgePoly(polys[0], 0.0045), 0.04, GLASS_EDGE, 0.0045, 0.95);
  }
  if (p.type === "mirror") {
    // The silvered face, and the dark back behind it.
    const curve = [];
    const n = 48;
    for (let i = 0; i <= n; i++) {
      const y = -p.length / 2 + (p.length * i) / n;
      const x = Number.isFinite(p.R) ? -(p.R - Math.sqrt(p.R * p.R - y * y)) : 0;
      curve.push([x, y]);
    }
    for (let k = 0; k < 3; k++) add(edgePoly(curve.map(([x, y]) => [x + k * 0.006, y]), 0.004, false), 0.03, [0.9, 0.92, 0.95], 0.005, 1); // prettier-ignore
    for (let k = 0; k < 4; k++) add(edgePoly(curve.map(([x, y]) => [x + 0.018 + k * 0.008, y]), 0.006, false), 0.02, [0.22, 0.24, 0.28], 0.006, 1); // prettier-ignore
  }
  if (p.type === "screen") add(fillPoly(rect(0, -p.length / 2, 0.035, p.length / 2), 0.008), 0.03, [0.93, 0.92, 0.88], 0.006, 1); // prettier-ignore
  if (p.type === "lamp" || p.type === "raybox") {
    const [x0, y0, x1, y1] = bodyBox(p);
    add(fillPoly(rect(x0, y0, x1 - 0.03, y1), 0.009), 0.03, [0.3, 0.32, 0.37], 0.007, 1);
    add(edgePoly(rect(x0, y0, x1 - 0.03, y1), 0.005), 0.04, [0.55, 0.58, 0.64], 0.004, 1);
    // The nozzle (a lamp) or the slots (a ray box) the light leaves by.
    if (p.type === "lamp")
      add(fillPoly(rect(x1 - 0.03, -0.022, x1, 0.022), 0.006), 0.04, [0.6, 0.62, 0.68], 0.005, 1); // prettier-ignore
    else
      for (let i = 0; i < p.rays; i++) {
        const y = (i - (p.rays - 1) / 2) * p.gap;
        add(fillPoly(rect(x1 - 0.03, y - 0.012, x1, y + 0.012), 0.006), 0.04, [0.6, 0.62, 0.68], 0.005, 1); // prettier-ignore
      }
  }
  if (p.type === "object") {
    // An upright arrow: the object the lens makes an image of.
    const h = p.height;
    const col = [1, 0.55, 0.2];
    add(fillPoly(rect(-0.008, 0, 0.008, h - 0.05), 0.006), 0.04, col, 0.005, 1);
    add(fillPoly([[-0.04, h - 0.055], [0.04, h - 0.055], [0, h]], 0.006), 0.04, col, 0.005, 1); // prettier-ignore
  }
  const k = knobOf({ ...p, pos: [0, 0], angle: 0 });
  if (k) {
    // A ring to turn it by, on a thin stem.
    const ring = [];
    for (let i = 0; i < 40; i++) ring.push([k[0] + KNOB_R * Math.cos((i / 40) * 2 * Math.PI), k[1] + KNOB_R * Math.sin((i / 40) * 2 * Math.PI)]); // prettier-ignore
    add(edgePoly(ring, 0.004), 0.05, [1, 0.8, 0.3], 0.0045, 1);
    add(fillPoly(ring.map(([x, y]) => [k[0] + (x - k[0]) * 0.35, k[1] + (y - k[1]) * 0.35]), 0.006), 0.05, [1, 0.8, 0.3], 0.005, 1); // prettier-ignore
  }
  return out;
}

function benchBuild(k, o) {
  BS.o = { ...o };
  BS.light = LIGHTS.some((l) => l.id === o.light) ? o.light : "white";
  BS.home = homeParts(o);
  BS.parts = homeParts(o);
  BS.grab = null;
  benchUpdate();
  const { W, H } = BENCH;
  // The board: dark, with a faint 1 cm grid and a stronger 5 cm one, and the
  // optical axis for the lens.
  // A 5 cm grid of fine dots, and the optical axis for the lens.
  const dots = [];
  for (let x = -W / 2 + 0.5 * 0; x <= W / 2 + 1e-6; x += 0.1)
    for (let y = -H / 2; y <= H / 2 + 1e-6; y += 0.1) dots.push([x, y]);
  if (o.setup === "lens") for (let x = -W / 2; x <= W / 2; x += 0.03) dots.push([x, 0, 1]);
  k.cloud({ share: dots.length / k.count, pattern: false }, (rand, i) => {
    const d = dots[i];
    if (!d) return null;
    return { p: [d[0], d[1], -0.006], scales: [0.0045, 0.0045, 0.001], quat: [0, 0, 0, 1], color: d[2] ? [0.32, 0.36, 0.44] : [0.2, 0.23, 0.28], opacity: 1, pattern: false }; // prettier-ignore
  });
  // The parts, each a token (moved and turned by drive as it is dragged).
  const list = [];
  BS.parts.forEach((p, i) => {
    for (const s of partSplats(p)) {
      const q = rot([s.p[0], s.p[1]], p.angle);
      list.push({ ...s, p: [q[0] + p.pos[0], q[1] + p.pos[1], s.p[2]], token: i });
    }
  });
  const nRays = LAT.n;
  // The board: flat dark discs on a fine even grid, as many as the budget
  // leaves (a dark rim round it).
  const BW = W + 0.12;
  const BH = H + 0.12;
  const left = Math.max(6000, (k.count - list.length - nRays - dots.length) * 0.92);
  const step = Math.sqrt((BW * BH) / (0.866 * left));
  const board = [];
  for (let y = -BH / 2 + step / 2, r = 0; y < BH / 2; y += step * 0.866, r++)
    for (let x = -BW / 2 + step / 2 + (r % 2) * step * 0.5; x < BW / 2; x += step)
      board.push([x, y]);
  k.cloud({ share: Math.min(board.length, left) / k.count, pattern: false }, (rand, i) => {
    const b = board[i];
    if (!b) return null;
    const rim = Math.abs(b[0]) > W / 2 || Math.abs(b[1]) > H / 2;
    return { p: [b[0], b[1], -0.012], scales: [step * 0.75, step * 0.75, step * 0.1], quat: [0, 0, 0, 1], color: rim ? [0.15, 0.17, 0.2] : [0.075, 0.085, 0.105], opacity: 1, pattern: false }; // prettier-ignore
  });
  k.cloud({ share: (list.length + nRays) / k.count, pattern: false }, (rand, n) => {
    if (n < list.length) {
      const s = list[n];
      return {
        p: s.p,
        scales: [s.s, s.s, s.s * 0.2],
        quat: [0, 0, 0, 1],
        color: s.rgb,
        opacity: s.a,
        kind: "token",
        params: [s.token, 0],
        pattern: false,
      };
    }
    const m = n - list.length;
    if (m >= nRays) return null;
    const c = Math.floor(m / K);
    const ci = c % LAT.cols;
    const cj = Math.floor(c / LAT.cols);
    return {
      p: [LAT.x0 + (ci + 0.5) * CELL, LAT.y0 + (cj + 0.5) * CELL, RAY_Z],
      scales: [RAY_SIGMA, RAY_SIGMA, RAY_SIGMA * 0.3],
      quat: [0, 0, 0, 1],
      color: [1, 1, 1],
      opacity: 1,
      kind: "relief",
      params: [((m % TW) + 0.5) / TW, (Math.floor(m / TW) + 0.5) / LAT.th, 3, LIFTR],
      pattern: false,
    };
  });
  k.reach([W / 2 + 0.08, H / 2 + 0.08, 0.1]);
  k.reach([-W / 2 - 0.08, -H / 2 - 0.08, -0.05]);
  k.data = { setup: o.setup };
}

const LIGHT_BENCH = {
  alive: true,
  turntable: false,
  tiltLock: true,
  density: 0.8,
  options: [
    { key: "setup", label: "Setup", type: "select", default: "prism", choices: BENCH_SETUPS },
    { key: "lens", label: "Lens (Lens and image)", type: "select", default: "thin", choices: LENSES.map((l) => ({ id: l.id, label: l.label })) }, // prettier-ignore
    { key: "light", label: "Light", type: "select", default: "white", choices: LIGHTS.map((l) => ({ id: l.id, label: l.label })) }, // prettier-ignore
    { key: "bend", label: "Bend radius, light guide (cm)", type: "slider", min: 2.5, max: 12, step: 0.5, default: 7 }, // prettier-ignore
  ],
  controls: [{ key: "light", label: "Change the light", type: "pulse", ease: 0.3 }],
  action: { key: "light", label: "Change the light" },
  input: {
    title: "The numbers",
    fileButton: false,
    live: [{ render: () => readoutPanel("opt-bench-readout", () => [...(BS.numbers?.lines || []), "Drag a part to move it; turn it by its yellow knob. Tap the bench to change the light."]) }], // prettier-ignore
    note: "",
    read: async () => ({}),
    shown: () => "",
  },
  screen: benchScreen(),
  drag: BENCH_DRAG,
  drive(t, c, out, info) {
    const tap = info?.tap?.key === "light" ? info.tap : null;
    if (tap && tap.n !== BS.tapN) {
      BS.tapN = tap.n;
      const i = LIGHTS.findIndex((l) => l.id === BS.light);
      BS.light = LIGHTS[(i + 1) % LIGHTS.length].id;
      benchUpdate();
    }
    out.tokens = BS.parts.map((p, i) => {
      const h = BS.home[i];
      return {
        base: [h.pos[0], h.pos[1], 0],
        offset: [p.pos[0] - h.pos[0], p.pos[1] - h.pos[1], 0],
        quat: quatAxisAngle([0, 0, 1], p.angle - h.angle),
      };
    });
    refreshReadout("opt-bench-readout", info?.time ?? t);
  },
  build: benchBuild,
};

// The test hook: window.__splashery.optics (tests/opt.spec.mjs).
if (typeof window !== "undefined" && window.__splashery) window.__splashery.optics = { RT, BS };

export const RECIPES = {
  "ripple-tank": RIPPLE,
  "light-bench": LIGHT_BENCH,
};
