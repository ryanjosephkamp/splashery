import { quatFromTo } from "../kit.js";
import { TOY_SOUNDS } from "../toy-sounds.js";
import {
  DAY,
  TAU,
  PLANETS,
  planTransfer,
  nextWindow,
  signedAngle,
  transferState,
} from "./proto-orbit-transfer/math.js";

// 120 fixed playback ticks/s. The wait and flight have different, stated time
// compression, but each segment advances physical time by a constant step.
export const TICK_HZ = 120;
export const WAIT_TICKS = 54; // 0.45 s to advance to the next simulated window
export const FLIGHT_TICKS = 384; // 3.2 s for the half-ellipse
const ARRIVAL_TICK = WAIT_TICKS + FLIGHT_TICKS;
const RESET_TICK = ARRIVAL_TICK + 30;
export const EFFECT_SECONDS = 4.4;
const MEMORY = new WeakMap();
const choices = PLANETS.map((p) => ({ id: p.id, label: p.name }));
const circle = (radius, angle) => [radius * Math.cos(angle), radius * Math.sin(angle), 0];
const degrees = (a) => ((a * 180) / Math.PI).toFixed(1);
const burnText = (n, dv) =>
  `Burn ${n}: ${Math.abs(dv).toFixed(2)} km/s ${dv > 0 ? "prograde" : "retrograde"}`;

export function makePlan(from, to) {
  const p1 = PLANETS.find((p) => p.id === from) || PLANETS[2];
  const p2 = PLANETS.find((p) => p.id === to) || PLANETS[3];
  if (p1 === p2) return { p1, p2, plan: null, scale: 1 / p1.radius };
  const plan = planTransfer(p1.radius, p2.radius);
  // An illustrative epoch, not today's sky. Start 60° away from the window.
  const initialPhase = plan.phase + Math.PI / 3;
  const wait = nextWindow(plan, initialPhase);
  const launchAngle = plan.n1 * wait;
  return {
    p1,
    p2,
    plan,
    initialPhase,
    wait,
    launchAngle,
    scale: 1 / Math.max(p1.radius, p2.radius),
  };
}

// Advance only whole ticks; propagation is an exact Kepler drift integrator.
// Integer tick multiplication avoids cumulative time drift, including long trips.
export function simulationAt(d, tick) {
  const waiting = tick < WAIT_TICKS;
  const flightTick = Math.min(FLIGHT_TICKS, Math.max(0, tick - WAIT_TICKS));
  const coast = (flightTick * d.plan.seconds) / FLIGHT_TICKS;
  const seconds = waiting ? (tick * d.wait) / WAIT_TICKS : d.wait + coast;
  const departure = circle(d.plan.r1 * d.scale, d.plan.n1 * seconds);
  const target = circle(d.plan.r2 * d.scale, d.initialPhase + d.plan.n2 * seconds);
  const craft = waiting
    ? {
        position: departure.slice(0, 2).map((x) => x / d.scale),
        velocity: [(-departure[1] * d.plan.n1) / d.scale, (departure[0] * d.plan.n1) / d.scale],
      }
    : transferState(d.plan, coast, d.launchAngle);
  return { seconds, coast, departure, target, craft };
}

const recipe = {
  kernel: "sharp",
  density: 0.15,
  alive: false,
  turntable: false,
  tiltLock: true,
  options: [
    { key: "from", label: "Departure", type: "select", default: "earth", choices },
    { key: "to", label: "Destination", type: "select", default: "mars", choices },
  ],
  controls: [
    { key: "launch", label: "Launch at next window", type: "pulse", ease: EFFECT_SECONDS },
  ],
  // Cue-driven tones follow the actual burn ticks, including pause and resume.
  action: { key: "launch", label: "Launch at next window", quiet: ["launch"] },
  sounds: () => TOY_SOUNDS["orbit-transfer"],
  note: "Circular, coplanar orbits at NASA's mean orbital radii. Simulated launch windows, not calendar dates. Distances are proportional; bodies and the craft are enlarged. Heliocentric delta-v excludes planetary escape and capture. A tap advances to the window in 0.45 seconds and plays the transfer in 3.2 seconds, then resets the diagram.",
  credits: [
    {
      label: "Orbital radii",
      title: "Planetary Fact Sheet",
      source: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/",
      author: "NASA Goddard Space Flight Center",
      license: "Public domain (NASA data)",
    },
    {
      label: "Constants",
      title: "Astrodynamic Parameters",
      source: "https://ssd.jpl.nasa.gov/astro_par.html",
      author: "JPL Solar System Dynamics",
      license: "Public domain (NASA/JPL data)",
    },
    {
      label: "Equations",
      title: "Hohmann Transfer",
      source: "https://orbital-mechanics.space/orbital-maneuvers/hohmann-transfer.html",
      author: "Bryan Weber",
      license: "Reference only; no assets copied",
    },
    {
      label: "Launch windows",
      title: "Interplanetary Transfer Phasing",
      source:
        "https://orbital-mechanics.space/interplanetary-maneuvers/interplanetary-transfer-phasing.html",
      author: "Bryan Weber",
      license: "Reference only; no assets copied",
    },
  ],
  drive(_t, c, out, info) {
    const d = info?.data;
    if (!d) return;
    if (!d.plan) {
      out.tokens = [{ offset: circle(1, 0) }, { visible: 0 }, { visible: 0 }, { visible: 0 }];
      out.legend = {
        title: "Choose two different planets",
        items: [{ text: "Use Departure and Destination in This toy." }],
      };
      return;
    }
    let m = MEMORY.get(c);
    if (!m || m.data !== d) {
      m = { data: d, tick: -1, tap: null };
      MEMORY.set(c, m);
    }
    const n = info.tap?.n ?? 0;
    if (n !== m.tap) {
      m.tap = n;
      m.tick = -1;
    }
    const active = c.launch > 0;
    const tick = active ? Math.floor((1 - c.launch) * EFFECT_SECONDS * TICK_HZ + 1e-7) : -1;
    // Each physical segment uses a constant dt. An exact drift permits jumping
    // across skipped render frames with the same state as stepping every tick.
    if (active && tick > m.tick) {
      for (const [i, event] of [WAIT_TICKS, ARRIVAL_TICK].entries())
        if (n > 0 && m.tick < event && tick >= event)
          (out.cues ||= []).push(TOY_SOUNDS["orbit-transfer"][i]);
      m.tick = tick;
    }
    const playing = active && tick < RESET_TICK;
    const state = simulationAt(d, playing ? tick : 0);
    const { plan: p } = d;
    const craftPos = [...state.craft.position.map((x) => x * d.scale), 0.075];
    const tangent = [...state.craft.velocity, 0];
    const isBurn1 = playing && tick >= WAIT_TICKS && tick < WAIT_TICKS + 24;
    const isBurn2 = playing && tick >= ARRIVAL_TICK;
    const sign = Math.sign(isBurn2 ? p.burn2 : p.burn1);
    const len = Math.hypot(...tangent);
    const exhaust = tangent.map((x) => (-sign * x) / len);
    out.tokens = [
      { offset: state.departure },
      { offset: state.target },
      { offset: craftPos, quat: quatFromTo([0, 1, 0], tangent) },
      {
        offset: craftPos.map((x, i) => x + exhaust[i] * 0.065),
        quat: quatFromTo([0, 1, 0], exhaust),
        visible: isBurn1 || isBurn2 ? 1 : 0,
      },
    ];
    // Moving solid objects need a few sorts along the route, then one at reset.
    if (m.sorted !== Math.floor(tick / 24)) {
      m.sorted = Math.floor(tick / 24);
      out.resort = true;
    }
    const phase = signedAngle(d.initialPhase + (p.n2 - p.n1) * state.seconds);
    const required = `${degrees(Math.abs(p.phase))}° ${p.phase >= 0 ? "ahead" : "behind"}`;
    let status = "Tap to launch at next window";
    if (playing) {
      if (tick < WAIT_TICKS)
        status = `Window in ${Math.max(0, (d.wait - state.seconds) / DAY).toFixed(1)} days`;
      else if (isBurn1) status = "Burn 1 · depart";
      else if (isBurn2) status = "Burn 2 · arrived";
      else status = `Coast · day ${(state.coast / DAY).toFixed(0)}`;
    } else if (active) status = "Arrived · diagram reset";
    out.legend = {
      title: `${d.p1.name} → ${d.p2.name}`,
      items: [
        { text: status, on: playing },
        { text: `Travel: ${(p.seconds / DAY).toFixed(1)} days` },
        { text: `Total Δv: ${p.total.toFixed(2)} km/s` },
        { text: burnText(1, p.burn1), on: isBurn1 },
        { text: burnText(2, p.burn2), on: isBurn2 },
        { text: `Launch phase: ${required}` },
        { text: `Current phase: ${degrees(phase)}°` },
        { text: `Next window: ${(nextWindow(p, phase) / DAY).toFixed(1)} days`, dim: true },
        { text: `Blue: ${d.p1.name} · ${(p.r1 / 1e6).toFixed(1)} million km` },
        { text: `Coral: ${d.p2.name} · ${(p.r2 / 1e6).toFixed(1)} million km` },
        { text: "Gold: transfer ellipse" },
        { text: "Circular orbits; enlarged bodies. Simulated epoch.", dim: true },
        { text: "0.45 s wait preview; 3.2 s flight. Reset after arrival.", dim: true },
      ],
    };
  },
  build(k, o) {
    const d = makePlan(o.from, o.to);
    k.data = d;
    // Clouds carry explicit, deterministic counts and scales. About 4,400
    // opaque splats, independent of the tier; no maps or external assets.
    const cloud = (count, fn, extra = {}) =>
      k.cloud(
        { count: (count * 160000) / k.count, jitter: 0, pattern: false, ...extra },
        (_r, i, n) => fn(i, n),
      );
    const line = (points, color, width = 0.0035) => {
      cloud(points.length, (i) => {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const dir = b.map((x, j) => x - a[j]);
        return {
          p: a.map((x, j) => (x + b[j]) / 2),
          scales: [Math.hypot(...dir) * 0.7, width, width],
          quat: quatFromTo([1, 0, 0], dir),
          color,
          opacity: 1,
        };
      });
    };
    const ball = (radius, color, count, token = null) => {
      cloud(count, (i, n) => {
        const z = 1 - (2 * (i + 0.5)) / n;
        const rr = Math.sqrt(1 - z * z);
        const angle = i * Math.PI * (3 - Math.sqrt(5));
        const p = [rr * Math.cos(angle), rr * Math.sin(angle), z].map((x) => x * radius);
        return {
          p,
          scales: [radius * 0.15, radius * 0.15, radius * 0.15],
          color,
          opacity: 1,
          ...(token === null ? {} : { kind: "token", params: [token, 0] }),
        };
      });
    };
    const r1 = d.p1.radius * d.scale;
    const r2 = d.p2.radius * d.scale;
    const points = (r) => Array.from({ length: 360 }, (_, i) => circle(r, (i * TAU) / 360));
    line(points(r1), "#56acdc", Math.min(0.0035, r1 * 0.08));
    if (d.plan) line(points(r2), "#ea856b", Math.min(0.0035, r2 * 0.08));
    ball(Math.min(0.032, Math.min(r1, r2) * 0.35), "#ffd56a", 500);
    ball(Math.min(0.045, r1 * 0.4), d.p1.color, 700, 0);
    ball(Math.min(0.045, r2 * 0.4), d.p2.color, 700, 1);
    // A compact solid probe, including its two rigid solar panels, token 2.
    const solid = {
      even: true,
      opacity: 1,
      jitter: 0.01,
      pattern: false,
      kind: "token",
      params: [2, 0],
    };
    k.add(k.ellipsoid(0.014, 0.028, 0.014), {
      ...solid,
      count: (350 * 160000) / k.count,
      color: "#f0eee5",
      size: 0.8,
    });
    for (const x of [-0.029, 0.029])
      k.add(k.ellipsoid(0.023, 0.012, 0.004), {
        ...solid,
        count: (160 * 160000) / k.count,
        pos: [x, 0, 0],
        color: "#4667a6",
        size: 0.7,
      });
    k.add(k.ellipsoid(0.012, 0.035, 0.012), {
      ...solid,
      count: (180 * 160000) / k.count,
      color: "#ffc75a",
      params: [3, 0],
    });
    if (d.plan) {
      // The entire transfer ellipse preserves the real ratio of orbital radii.
      const ellipse = Array.from({ length: 480 }, (_, i) => {
        const E = (i * TAU) / 480;
        const p = d.plan;
        const angle = d.launchAngle + (p.outward ? 0 : Math.PI);
        const x = p.a * (Math.cos(E) - p.e) * d.scale;
        const y = p.a * Math.sqrt(1 - p.e ** 2) * Math.sin(E) * d.scale;
        return [
          x * Math.cos(angle) - y * Math.sin(angle),
          x * Math.sin(angle) + y * Math.cos(angle),
          0.01,
        ];
      });
      line(ellipse, "#deb74f", 0.0028);
      // Phase wedge at the planned departure window, plus radius guides.
      const radius = Math.max(0.08, Math.min(r1, r2) * 0.5);
      const arc = Array.from({ length: 65 }, (_, i) =>
        circle(radius, d.launchAngle + (d.plan.phase * i) / 64),
      );
      // The arc stays open; the two radius guides below delimit the wedge.
      cloud(64, (i) => {
        const a = arc[i];
        const b = arc[i + 1];
        const dir = b.map((x, j) => x - a[j]);
        return {
          p: a,
          scales: [Math.hypot(...dir) * 0.8, 0.002, 0.002],
          quat: quatFromTo([1, 0, 0], dir),
          color: "#bca7e3",
          opacity: 1,
        };
      });
      for (const angle of [d.launchAngle, d.launchAngle + d.plan.phase])
        line([circle(0, 0), circle(radius, angle)], "#bca7e3", 0.002);
      for (const p of [circle(r1, d.launchAngle), circle(r2, d.launchAngle + Math.PI)]) {
        k.add(k.torus(0.025, 0.004), {
          pos: [p[0], p[1], 0.015],
          rot: [90, 0, 0],
          count: (100 * 160000) / k.count,
          color: "#ffd878",
          opacity: 1,
          jitter: 0,
          pattern: false,
        });
      }
    }
    // Symmetric reaches keep the Sun at the diagram's center as pairs change.
    for (const p of [
      [-1.1, -1.1, 0],
      [1.1, 1.1, 0],
      [-1.1, 1.1, 0],
      [1.1, -1.1, 0],
    ])
      k.reach(p);
  },
};

export const RECIPES = { "orbit-transfer": recipe };
