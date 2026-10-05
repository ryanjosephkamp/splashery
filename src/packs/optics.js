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
    // Let the water run a little, so it opens with waves already out.
    if (tank.time < 1.2) tank.advance(1.2 - tank.time, { maxSteps: 1e6, avg: 0.5 });
    RT.last = null;
    const { nx, ny, dx } = tank;
    const W = TANK.width / 10;
    const D = TANK.depth / 10;
    const rows = ny + BAR_K;
    const cell = dx / 10;
    // The water: one relief splat per cell, lifted along y by its height.
    const nWater = nx * ny;
    const nBars = nx * BAR_K;
    k.reach([W / 2 + 0.08, 0.6, D / 2 + 0.08]);
    k.reach([-W / 2 - 0.08, -0.12, -D / 2 - 0.08]);
    k.cloud({ share: (nWater + nBars) / k.count, pattern: false }, (rand, n) => {
      if (n < nWater) {
        const i = n % nx;
        const j = Math.floor(n / nx);
        return {
          p: [toX((i + 0.5) * dx), -LIFT / 2, toZ((j + 0.5) * dx)],
          scales: [cell * 0.62, cell * 0.08, cell * 0.62],
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
      const i = Math.floor(m / BAR_K);
      const s = m % BAR_K;
      const r = ny + Math.floor(m / nx);
      const col = m % nx;
      return {
        p: [toX((i + 0.5) * dx), 0.05 + ((s + 0.5) / BAR_K) * BAR_H, -D / 2 - 0.03],
        scales: [cell * 0.6, (BAR_H / BAR_K) * 0.55, 0.004],
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

// The test hook: window.__splashery.optics (tests/opt.spec.mjs).
if (typeof window !== "undefined" && window.__splashery) window.__splashery.optics = { RT };

export const RECIPES = {
  "ripple-tank": RIPPLE,
};
