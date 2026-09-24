// Weather and elements pack: fire, storms, ice. Loaded on demand.
//
// Weather toys lean on behaviours: rain and snow fall, sparks and steam
// rise, dust orbits; lightning, blobs of wax and swirling snow are parts
// that drive() shows, hides and moves on a clock.

import { mix, shade, smoothstep, clamp, ramp, spline, quatAxisAngle, vec } from "../kit.js";

const TAU = Math.PI * 2;
const { add, mul, dot, unit } = vec;
const lerp3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const keep = (c, size) => ({ c, keep: true, size });

// A fake light from the upper left, in front.
const LIGHT = unit([-0.35, 0.85, 0.45]);
const lit = (col, n, k = 0.3) => shade(col, 1 + k * (dot(n, LIGHT) - 0.25));

function randDir(rand) {
  const z = 2 * rand() - 1;
  const a = rand() * TAU;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(a), z, r * Math.sin(a)];
}

// A repeatable pseudo-random number in 0..1 for an integer (drive() has no
// seeded generator, so schedules hash the time slot).
function hash1(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Straight segments through points, as t in 0..1 -> point (a tube path
// with sharp corners, for lightning).
function polyline(pts) {
  const n = pts.length - 1;
  return (t) => {
    const x = Math.min(n - 1e-6, Math.max(0, t * n));
    const i = Math.floor(x);
    return lerp3(pts[i], pts[i + 1], x - i);
  };
}

// A curve sampled once into a table (quick to evaluate many times).
function baked(curve, n = 256) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(curve(i / n));
  return polyline(pts);
}

// A jagged path from a to b: midpoints pushed sideways, `depth` times.
function jagged(rand, a, b, depth) {
  let pts = [a, b];
  let amp = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 0.18;
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const m = lerp3(pts[i - 1], pts[i], 0.5);
      next.push(
        [
          m[0] + (rand() - 0.5) * 2 * amp,
          m[1] + (rand() - 0.5) * amp * 0.5,
          m[2] + (rand() - 0.5) * amp,
        ],
        pts[i],
      );
    }
    pts = next;
    amp *= 0.55;
  }
  return pts;
}

// Lava lamp blobs: where each sits and how it travels (shared by build and
// drive, so the parts move from where they were built).
const LAVA = [
  { x: 0.02, z: 0.03, r: 0.13, tall: 1.35, lo: 0.2, hi: 1.05, speed: 0.32, phase: 0.6, twin: true },
  { x: -0.05, z: -0.04, r: 0.1, tall: 1.2, lo: 0.15, hi: 1.12, speed: 0.26, phase: 2.4 },
  { x: 0.05, z: -0.02, r: 0.085, tall: 1.5, lo: 0.25, hi: 1.0, speed: 0.4, phase: 4.1 },
  { x: -0.03, z: 0.05, r: 0.075, tall: 1.2, lo: 0.3, hi: 1.15, speed: 0.22, phase: 5.3 },
  { x: 0.04, z: 0.04, r: 0.11, tall: 1.1, lo: 0.12, hi: 0.7, speed: 0.3, phase: 1.3, twin: true },
  { x: -0.05, z: 0.0, r: 0.06, tall: 1.3, lo: 0.4, hi: 1.18, speed: 0.36, phase: 3.3 },
];
const lavaY = (b, t) => b.lo + (b.hi - b.lo) * (0.5 - 0.5 * Math.cos(t * b.speed + b.phase));

export const RECIPES = {
  campfire: {
    alive: true,
    controls: [
      { key: "size", label: "Fire size", type: "slider", default: 0.55 },
      { key: "stoke", label: "Stoke", type: "pulse", ease: 1.6 },
    ],
    action: { key: "stoke", label: "Stoke the fire" },
    drive(t, c, out) {
      out.amount = 0.45 + 0.9 * c.size + 0.7 * c.stoke;
    },
    build(k) {
      const ground = -0.55;
      // A ring of stones.
      const stones = 11;
      for (let i = 0; i < stones; i++) {
        const a = (i / stones) * Math.PI * 2 + k.rand() * 0.2;
        const r = 0.78 + k.rand() * 0.06;
        const s = 0.12 + k.rand() * 0.06;
        const grey = 0.42 + k.rand() * 0.22;
        k.add(k.ellipsoid(s * 1.3, s * 0.8, s), {
          pos: [Math.sin(a) * r, ground + s * 0.5, Math.cos(a) * r],
          rot: [0, (a * 180) / Math.PI + k.rand() * 40, 0],
          flat: 0.3,
          color: (c) => {
            const n = c.fbm(c.p[0] * 9, c.p[1] * 9, c.p[2] * 9);
            return mix([grey, grey * 0.97, grey * 0.92], "#2c2a27", 0.35 + 0.35 * n);
          },
        });
      }
      // Logs leaning together.
      const logs = 5;
      for (let i = 0; i < logs; i++) {
        const a = (i / logs) * Math.PI * 2 + 0.3;
        const lean = 38 + k.rand() * 8;
        const len = 0.95;
        const base = [Math.sin(a) * 0.46, ground + 0.08, Math.cos(a) * 0.46];
        // A cylinder along Y, tipped towards the centre.
        k.add(k.cylinder(0.075, len), {
          pos: [
            base[0] * 0.55,
            base[1] + (Math.cos((lean * Math.PI) / 180) * len) / 2,
            base[2] * 0.55,
          ],
          rot: [lean * Math.cos(a) * -1, 0, lean * Math.sin(a)],
          flat: 0.25,
          color: (c) => {
            const char = Math.max(0, Math.min(1, (c.p[1] - ground - 0.12) / 0.45));
            const bark = mix(
              "#6b4526",
              "#3a2413",
              0.5 + 0.5 * c.fbm(c.p[0] * 14, c.p[1] * 14, c.p[2] * 14),
            );
            return mix(bark, "#1a1512", char * 0.85);
          },
        });
      }
      // A bed of embers that glows and flickers.
      k.add(k.disc(0.42), {
        pos: [0, ground + 0.03, 0],
        flat: 0.4,
        kind: "twinkle",
        params: (c) => [0.35, c.rand() * 6.28],
        pattern: false,
        color: (c) =>
          mix(
            "#ff6a1a",
            "#7a1a08",
            Math.min(1, Math.hypot(c.p[0], c.p[2]) / 0.42 + 0.3 * c.rand()),
          ),
      });
      // Flames: splats born at the base that rise, shrink and redden.
      k.cloud({ share: 0.3, size: 1.25, pattern: false }, (rand) => {
        const a = rand() * Math.PI * 2;
        const r = 0.3 * Math.sqrt(rand());
        const hot = 1 - r / 0.3;
        return {
          p: [Math.sin(a) * r, ground + 0.12 + rand() * 0.1, Math.cos(a) * r],
          color: mix("#ffb347", "#fff4c2", hot * 0.9),
          size: 0.8 + 0.8 * hot,
          opacity: 0.8,
          kind: "flame",
          params: [0.55 + 0.6 * hot * rand(), rand()],
        };
      });
      // Sparks drifting up.
      k.cloud({ share: 0.015, size: 0.45, pattern: false }, (rand) => ({
        p: [(rand() - 0.5) * 0.4, ground + 0.2, (rand() - 0.5) * 0.4],
        color: "#ffc062",
        opacity: 1,
        kind: "rise",
        params: [1.5 + rand(), rand()],
      }));
      // A thin wisp of smoke.
      k.cloud({ share: 0.008, size: 2.2, pattern: false }, (rand) => ({
        p: [(rand() - 0.5) * 0.2, ground + 0.7, (rand() - 0.5) * 0.2],
        color: shade("#8a8580", 0.9 + rand() * 0.2),
        opacity: 0.1,
        kind: "rise",
        params: [1.2, rand()],
      }));
      // Room for the flames at their tallest.
      k.reach([0, ground + 1.35, 0]);
    },
  },

  "storm-cloud": {
    alive: true,
    controls: [
      { key: "rain", label: "Rain", type: "slider", default: 0.7 },
      { key: "thunder", label: "Thunder", type: "pulse", ease: 1.3 },
    ],
    action: { key: "thunder", label: "Thunder" },
    drive(t, c, out) {
      // Lightning on a random-looking schedule: each slot of time may
      // strike one of three bolts, with a quick double flash.
      const slot = Math.floor(t / 1.7);
      const f = t / 1.7 - slot;
      const which = slot === 0 ? 0 : Math.floor(hash1(slot) * 5);
      const on = which < 3 && (f < 0.07 || (f > 0.11 && f < 0.16));
      const big = c.thunder > 0.3 && Math.sin(c.thunder * 36) > -0.4;
      for (let b = 0; b < 3; b++) out.parts[`bolt${b}`] = { visible: on && which === b ? 1 : 0 };
      out.parts.bolt3 = { visible: big ? 1 : 0 };
      out.parts.flash = { visible: on || big ? 1 : 0 };
      out.parts.rain = { visible: 0.15 + 0.85 * c.rain };
      out.amount = 1;
    },
    build(k) {
      const rand = k.rand;
      // The cloud: overlapping soft puffs, lit on top and dark underneath.
      const puffs = [];
      for (let i = 0; i < 26; i++) {
        const a = rand() * TAU;
        const rr = Math.sqrt(rand());
        const x = Math.cos(a) * rr * 0.95;
        const z = Math.sin(a) * rr * 0.55;
        const top = 1 - rr * rr;
        const s = 0.26 + 0.18 * rand() + 0.12 * top;
        puffs.push({ c: [x, 0.1 + top * 0.35 * rand() + s * 0.4, z], s });
      }
      for (let i = 0; i < 9; i++) {
        const x = (i / 8 - 0.5) * 1.8;
        puffs.push({ c: [x, 0.05, (rand() - 0.5) * 0.4], s: 0.28 + 0.06 * rand() });
      }
      const ymin = -0.2;
      const ymax = 1.0;
      for (const pf of puffs) {
        k.add(k.sphere(pf.s), {
          pos: pf.c,
          scale: [1, 0.82, 1],
          size: 2.2,
          flat: 0.9,
          opacity: 0.82,
          jitter: 0.03,
          color: (c) => {
            const h = clamp((c.p[1] - ymin) / (ymax - ymin), 0, 1);
            const l = dot(c.n, LIGHT);
            const v = clamp(
              0.25 + 0.55 * h + 0.25 * l + 0.1 * c.fbm(c.p[0] * 3, c.p[1] * 3, c.p[2] * 3),
              0,
              1,
            );
            return ramp(["#23262e", "#3c414c", "#5e6470", "#8e94a0", "#c4c8d0"], v);
          },
        });
      }
      // Flash: a bright veil over the cloud that lights up with a strike.
      const flash = k.part("flash", { pivot: [0, 0.2, 0] });
      k.cloud({ share: 0.05, size: 2.6, pattern: false }, (r) => {
        const pf = puffs[Math.floor(r() * puffs.length)];
        const d = randDir(r);
        return {
          p: add(pf.c, [d[0] * pf.s * 1.02, d[1] * pf.s * 0.84, d[2] * pf.s * 1.02]),
          color: mix("#dfe8ff", "#ffffff", r()),
          opacity: 0.22,
          part: flash,
        };
      });
      // Rain: streaks through the whole column, each falling a short way.
      const rain = k.part("rain", { pivot: [0, -0.6, 0] });
      k.cloud({ share: 0.08, size: 0.55, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = Math.sqrt(r());
        return {
          p: [Math.cos(a) * rr * 0.9, -1.35 + r() * 1.35, Math.sin(a) * rr * 0.42],
          dir: [0.08, -1, 0],
          stretch: 4.5,
          color: mix("#7a92b0", "#b4c4d8", r()),
          opacity: 0.45,
          kind: "fall",
          params: [0.35, r()],
          part: rain,
        };
      });
      // Lightning: jagged bolts with a blue glow, each its own part.
      const bolts = [
        { x: -0.3, z: 0.56, len: 1.45 },
        { x: 0.45, z: 0.5, len: 1.25 },
        { x: 0.05, z: 0.52, len: 1.35 },
        { x: 0.1, z: 0.6, len: 1.5 },
      ];
      bolts.forEach((b, i) => {
        const part = k.part(`bolt${i}`, { pivot: [b.x, -0.1, b.z] });
        const main = jagged(
          rand,
          [b.x, -0.05, b.z],
          [b.x + (rand() - 0.5) * 0.5, -0.05 - b.len, b.z + (rand() - 0.5) * 0.2],
          5,
        );
        const paths = [main];
        // A fork or two branching off.
        for (let f = 0; f < 2; f++) {
          const at = main[2 + f * 2 + Math.floor(rand() * 2)];
          const dx = (rand() < 0.5 ? -1 : 1) * (0.2 + 0.2 * rand());
          paths.push(jagged(rand, at, add(at, [dx, -0.3 - 0.2 * rand(), (rand() - 0.5) * 0.2]), 3));
        }
        paths.forEach((pts, pi) => {
          const w = (pi === 0 ? 0.026 : 0.014) * (i === 3 ? 1.35 : 1);
          k.add(
            k.tube(polyline(pts), (t) => w * (1 - 0.5 * t), { samples: 64, grid: 8 }),
            {
              part,
              weight: 8,
              flat: 0.6,
              pattern: false,
              color: (c) => mix("#fff2a8", "#ffffff", c.rand() * 0.6),
            },
          );
        });
        k.cloud({ share: 0.0015, size: 3, pattern: false }, (r) => {
          const pts = paths[r() < 0.75 ? 0 : 1 + Math.floor(r() * (paths.length - 1))];
          const p = polyline(pts)(r());
          return {
            p: add(p, [(r() - 0.5) * 0.12, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12]),
            color: "#fff0a0",
            opacity: 0.12,
            part,
          };
        });
      });
    },
  },

  "lava-lamp": {
    alive: true,
    options: [
      { key: "wax", label: "Wax", type: "color", default: "#e8341c" },
      { key: "liquid", label: "Liquid", type: "color", default: "#f2b632" },
      { key: "metal", label: "Base", type: "color", default: "#b8bcc4" },
    ],
    drive(t, c, out) {
      LAVA.forEach((b, i) => {
        const y = lavaY(b, t);
        out.parts[`blob${i}`] = {
          offset: [Math.sin(t * b.speed * 0.8 + b.phase) * 0.02, y - lavaY(b, 0), 0],
        };
      });
    },
    build(k, o) {
      const wax = o.wax;
      // The glass swells in the middle and tapers into the cap, where it
      // meets a collar of the cap's own radius.
      const glassR = (y) =>
        0.2 +
        0.075 * Math.sin(Math.PI * clamp((y + 0.05) / 1.35, 0, 1) * 0.8) -
        0.115 * smoothstep(0.62, 1.3, y);
      // The metal base and cap, with bright reflections.
      const chrome = (c) => {
        const n = c.n;
        const env = smoothstep(-0.3, 0.9, -0.6 * n[0] + 0.4 * n[1] + 0.3 * n[2]);
        const band = 0.5 + 0.5 * Math.sin(n[0] * 6 + n[2] * 3);
        return mix(shade(o.metal, 0.35), mix(o.metal, "#ffffff", 0.5), env * 0.8 + band * 0.2);
      };
      k.add(
        k.lathe([
          [0.36, -0.62],
          [0.37, -0.58],
          [0.33, -0.4],
          [0.26, -0.18],
          [0.215, -0.02],
          [0.2, 0.0],
        ]),
        { flat: 0.2, even: true, jitter: 0.015, color: chrome },
      );
      k.add(
        k.lathe([
          [0.14, 1.27],
          [0.135, 1.35],
          [0.1, 1.5],
          [0.085, 1.56],
          [0.0, 1.57],
        ]),
        { flat: 0.2, even: true, jitter: 0.015, color: chrome },
      );
      // Rolled metal collars where the glass sits in the base and under the
      // cap: a lip slightly proud of the glass, with a dark seam against it.
      const collar = (y0, y1, r) =>
        k.add(
          k.lathe([
            [r - 0.012, y0],
            [r + 0.006, y0 + 0.004],
            [r + 0.012, (y0 + y1) / 2],
            [r + 0.006, y1 - 0.004],
            [r - 0.012, y1],
          ]),
          {
            flat: 0.2,
            weight: 2,
            even: true,
            jitter: 0.015,
            color: (c) => {
              const edge = Math.min(c.lp[1] - y0, y1 - c.lp[1]);
              return edge < 0.005 ? shade(o.metal, 0.3) : chrome(c);
            },
          },
        );
      collar(-0.035, 0.03, glassR(0));
      collar(1.24, 1.3, glassR(1.27));
      // The glass: faint, tinted by the liquid, with a highlight streak.
      k.add(
        k.lathe(
          Array.from({ length: 9 }, (_, i) => {
            const y = -0.02 + (i / 8) * 1.32;
            return [glassR(y), y];
          }),
        ),
        {
          opacity: 0.13,
          flat: 0.3,
          even: true,
          jitter: 0.01,
          pattern: false,
          color: (c) => mix(o.liquid, "#ffffff", 0.2 + 0.3 * Math.max(0, c.n[2])),
        },
      );
      k.cloud({ share: 0.012, size: 1.2, pattern: false }, (r) => {
        const y = 0.05 + r() * 1.15;
        const a = -0.55 + (r() - 0.5) * 0.12;
        const rr = glassR(y) + 0.004;
        return {
          p: [Math.sin(a) * rr, y, Math.cos(a) * rr],
          color: "#ffffff",
          opacity: 0.35,
        };
      });
      // The liquid itself, a faint glow inside.
      k.cloud({ share: 0.03, size: 3, pattern: false }, (r) => {
        const y = r() * 1.28;
        const a = r() * TAU;
        const rr = glassR(y) * 0.85 * Math.sqrt(r());
        return {
          p: [Math.sin(a) * rr, y, Math.cos(a) * rr],
          color: mix(o.liquid, "#ffb070", 0.3 * (1 - y / 1.3)),
          opacity: 0.06,
        };
      });
      // Wax: a pool at the bottom and blobs that rise and sink.
      const waxCol = (c) => {
        const facing = Math.max(0, dot(c.n, unit([0.3, 0.2, 1])));
        return mix(shade(wax, 0.75), mix(wax, "#ffe090", 0.6), facing * facing);
      };
      k.add(k.ellipsoid(0.22, 0.1, 0.22), {
        pos: [0, 0.04, 0],
        weight: 1.5,
        pattern: false,
        color: waxCol,
      });
      k.add(k.ellipsoid(0.1, 0.04, 0.1), {
        pos: [0, 1.25, 0],
        weight: 1.5,
        pattern: false,
        color: waxCol,
      });
      LAVA.forEach((b, i) => {
        const part = k.part(`blob${i}`, { pivot: [b.x, lavaY(b, 0), b.z] });
        k.add(k.ellipsoid(b.r, b.r * b.tall, b.r), {
          pos: [b.x, lavaY(b, 0), b.z],
          part,
          weight: 1.5,
          pattern: false,
          color: waxCol,
        });
        if (b.twin) {
          k.add(k.ellipsoid(b.r * 0.6, b.r * 0.7, b.r * 0.6), {
            pos: [b.x + b.r * 0.5, lavaY(b, 0) - b.r * 1.1, b.z],
            part,
            weight: 1.5,
            pattern: false,
            color: waxCol,
          });
        }
      });
      // The warm bulb glow at the foot of the glass.
      k.add(k.disc(0.16), {
        pos: [0, -0.005, 0],
        pattern: false,
        color: (c) => mix("#fff2c0", "#ffb040", Math.hypot(c.p[0], c.p[2]) / 0.16),
      });
    },
  },

  "snow-globe": {
    alive: true,
    options: [{ key: "base", label: "Base", type: "color", default: "#8a2a1e" }],
    controls: [{ key: "shake", label: "Shake", type: "pulse", ease: 3.5 }],
    action: { key: "shake", label: "Shake the globe" },
    drive(t, c, out) {
      const s = c.shake;
      out.parts.swirl = {
        quat: quatAxisAngle([0, 1, 0], t * 2.4),
        offset: [0, 0.03 * Math.sin(t * 3), 0],
        visible: smoothstep(0, 0.25, s),
      };
      const wob = s * s * Math.sin(t * 22);
      out.body = { quat: quatAxisAngle([0, 0, 1], 0.1 * wob) };
    },
    build(k, o) {
      const rand = k.rand;
      const G = [0, 0.38, 0];
      const RG = 0.6;
      const floor = -0.1;
      // The base, with a gold band.
      k.add(
        k.lathe(
          [
            [0, -0.52],
            [0.6, -0.52],
            [0.64, -0.46],
            [0.6, -0.36],
            [0.52, -0.22],
            [0.47, -0.12],
            [0.45, -0.1],
          ],
          { thick: 0.2 },
        ),
        {
          flat: 0.2,
          interior: 0.06,
          core: shade(o.base, 0.6),
          color: (c) => {
            const y = c.p[1];
            if (y > -0.3 && y < -0.24)
              return lit(mix("#c8a040", "#f0d070", Math.max(0, c.n[2])), c.n, 0.4);
            const hi = Math.pow(Math.max(0, dot(c.n, unit([-0.3, 0.6, 0.75]))), 12);
            return mix(lit(o.base, c.n, 0.45), "#ffffff", 0.3 * hi);
          },
        },
      );
      // The snowy ground inside.
      k.add(
        k.lathe([
          [0.47, floor - 0.02],
          [0.46, floor + 0.02],
          [0.3, floor + 0.06],
          [0, floor + 0.08],
        ]),
        {
          flat: 0.3,
          color: (c) => lit(mix("#e6eef8", "#ffffff", c.rand() * 0.6), c.n, 0.25),
        },
      );
      // A snowy fir tree.
      const tx = -0.2;
      const tz = -0.12;
      k.add(k.cylinder(0.025, 0.1), { pos: [tx, floor + 0.1, tz], color: "#5a3a22" });
      for (let i = 0; i < 4; i++) {
        const y0 = floor + 0.12 + i * 0.1;
        const r0 = 0.17 - i * 0.035;
        k.add(k.cone(r0, 0.01, 0.16, { caps: "bottom" }), {
          pos: [tx, y0 + 0.08, tz],
          color: (c) => {
            if (c.s.cap) return "#1f4a2a";
            const snow = c.noise(c.p[0] * 40, c.p[1] * 40, c.p[2] * 40) > 0.1 - 0.3 * c.v;
            return snow
              ? mix("#eef4fb", "#ffffff", c.rand())
              : lit(mix("#1f5a30", "#2f7a3e", c.rand()), c.n, 0.4);
          },
        });
      }
      k.add(k.sphere(0.02), {
        pos: [tx, floor + 0.55, tz],
        weight: 3,
        pattern: false,
        color: "#ffd84a",
      });
      // A snowman with a hat, scarf and carrot nose.
      const sx = 0.16;
      const sz = 0.12;
      const snow = (c) => lit(mix("#f2f6fb", "#ffffff", c.rand() * 0.5), c.n, 0.3);
      k.add(k.sphere(0.1), { pos: [sx, floor + 0.15, sz], color: snow });
      k.add(k.sphere(0.075), { pos: [sx, floor + 0.3, sz], color: snow });
      k.add(k.sphere(0.055), { pos: [sx, floor + 0.42, sz], color: snow });
      k.add(k.cylinder(0.04, 0.06), { pos: [sx, floor + 0.5, sz], weight: 2, color: "#1a1a1e" });
      k.add(k.cylinder(0.06, 0.008), { pos: [sx, floor + 0.47, sz], weight: 2, color: "#1a1a1e" });
      k.add(k.torus(0.062, 0.016), {
        pos: [sx, floor + 0.36, sz],
        weight: 2,
        pattern: false,
        color: (c) => (Math.sin(c.u * TAU * 8) > 0 ? "#c8202a" : "#f2f2f2"),
      });
      k.add(k.cone(0.012, 0.001, 0.07), {
        pos: [sx + 0.02, floor + 0.43, sz + 0.075],
        rot: [90, 0, 0],
        weight: 3,
        pattern: false,
        color: "#f07a1a",
      });
      for (const [dx, dy] of [
        [-0.02, 0.445],
        [0.025, 0.445],
        [0.0, 0.32],
        [0.0, 0.29],
        [0.0, 0.2],
      ]) {
        k.add(k.sphere(0.009), {
          pos: [sx + dx, floor + dy, sz + (dy > 0.4 ? 0.05 : dy > 0.25 ? 0.074 : 0.098)],
          weight: 4,
          pattern: false,
          color: "#16161a",
        });
      }
      // Falling snow: each flake falls only as far as the ground under it.
      const inside = (r) => {
        for (;;) {
          const p = [(r() - 0.5) * 2 * RG, floor + r() * (RG + G[1] - floor), (r() - 0.5) * 2 * RG];
          if (Math.hypot(p[0] - G[0], p[1] - G[1], p[2] - G[2]) < RG * 0.93 && p[1] > floor + 0.08)
            return p;
        }
      };
      k.cloud({ share: 0.03, size: 0.5, pattern: false }, (r) => {
        const p = inside(r);
        return {
          p,
          color: "#ffffff",
          opacity: 0.95,
          kind: "fall",
          params: [Math.min(0.35, (p[1] - floor - 0.08) * 0.8), r()],
        };
      });
      // Snow swirling about after a shake.
      const swirl = k.part("swirl", { pivot: G });
      k.cloud({ share: 0.035, size: 0.55, pattern: false }, (r) => ({
        p: inside(r),
        color: "#ffffff",
        opacity: 0.95,
        kind: "twinkle",
        params: [0.4, r() * 6],
        part: swirl,
      }));
      // The glass dome, with a bright reflection.
      k.add(k.sphere(RG), {
        pos: G,
        opacity: 0.16,
        flat: 0.3,
        pattern: false,
        color: (c) =>
          c.p[1] < -0.11 ? null : mix("#dff0ff", "#ffffff", Math.max(0, dot(c.n, LIGHT))),
      });
      k.cloud({ share: 0.01, size: 1.2, pattern: false }, (r) => {
        const a = 0.9 + r() * 0.8;
        const b = -0.55 + (r() - 0.5) * 0.25;
        const d = [Math.sin(b) * Math.sin(a), Math.cos(a), Math.cos(b) * Math.sin(a)];
        return { p: add(G, mul(d, RG * 1.005)), color: "#ffffff", opacity: 0.5 };
      });
    },
  },

  volcano: {
    alive: true,
    controls: [{ key: "erupt", label: "Erupt", type: "pulse", ease: 4 }],
    action: { key: "erupt", label: "Erupt" },
    drive(t, c, out) {
      out.amount = 0.55 + 1.6 * c.erupt;
      out.parts.burst = { visible: smoothstep(0, 0.2, c.erupt) };
    },
    build(k) {
      const rand = k.rand;
      const RIM = 0.9;
      const cone = k.lathe(
        [
          [1.02, 0],
          [0.95, 0.05],
          [0.78, 0.18],
          [0.56, 0.4],
          [0.4, 0.62],
          [0.28, RIM - 0.06],
          [0.24, RIM],
          [0.2, RIM - 0.02],
          [0.14, RIM - 0.1],
          [0, RIM - 0.12],
        ],
        { grid: 96, thick: 0.12 },
      );
      k.add(cone, {
        flat: 0.25,
        interior: 0.1,
        core: "#7a2a10",
        color: (c) => {
          const y = c.p[1];
          const a = Math.atan2(c.p[0], c.p[2]);
          const g = c.fbm(c.p[0] * 4, c.p[1] * 4, c.p[2] * 4);
          // Lava rivers running down from the rim.
          const river =
            Math.abs(Math.sin(a * 2.5 + g * 2.2 + 0.4)) < 0.1 * (0.4 + y) &&
            y > 0.08 &&
            y < RIM - 0.05;
          if (river) return keep(mix("#ff4a0a", "#ffc040", c.rand() * 0.6));
          const crater = Math.hypot(c.p[0], c.p[2]) < 0.21 && y > RIM - 0.15;
          if (crater) return keep(mix("#ff6a10", "#ffd060", c.rand()));
          let col = mix("#5a4a42", "#2a2220", smoothstep(0.1, 0.8, y) + 0.3 * g);
          if (y < 0.14)
            col = mix(
              col,
              mix("#4a6a2a", "#6a8a3a", c.rand()),
              smoothstep(0.14, 0.04, y + 0.03 * g),
            );
          const ridge = Math.abs(Math.sin(a * 11 + g * 5));
          col = shade(col, 0.85 + 0.25 * ridge);
          return lit(col, c.n, 0.45);
        },
      });
      // Lava bubbling in the crater, glowing.
      k.add(k.disc(0.15), {
        pos: [0, RIM - 0.105, 0],
        pattern: false,
        kind: "twinkle",
        params: (c) => [0.4, c.rand() * 6],
        color: (c) => mix("#fff0a0", "#ff5a10", Math.hypot(c.p[0], c.p[2]) / 0.15),
      });
      k.cloud({ share: 0.02, size: 3, pattern: false }, (r) => ({
        p: [(r() - 0.5) * 0.3, RIM + 0.05 + r() * 0.15, (r() - 0.5) * 0.3],
        color: "#ff8a30",
        opacity: 0.12,
        kind: "twinkle",
        params: [0.5, r() * 6],
      }));
      // Sparks and lava bombs flying up, and a plume of smoke.
      k.cloud({ share: 0.05, size: 0.6, pattern: false }, (r) => ({
        p: [(r() - 0.5) * 0.18, RIM - 0.05, (r() - 0.5) * 0.18],
        color: mix("#ffd060", "#ff5a10", r()),
        opacity: 1,
        kind: "rise",
        params: [0.6 + 0.6 * r(), r()],
      }));
      k.cloud({ share: 0.1, size: 3.2, pattern: false }, (r) => {
        const y = RIM + 0.15 + r() * 0.3;
        return {
          p: [(r() - 0.5) * 0.2, y, (r() - 0.5) * 0.2],
          color: shade(mix("#6a6460", "#2a2624", r()), 0.9 + 0.2 * r()),
          opacity: 0.28,
          kind: "rise",
          params: [0.9 + 0.5 * r(), r()],
        };
      });
      const burst = k.part("burst", { pivot: [0, RIM, 0] });
      k.cloud({ share: 0.04, size: 1.2, pattern: false }, (r) => ({
        p: [(r() - 0.5) * 0.2, RIM, (r() - 0.5) * 0.2],
        color: mix("#ffe070", "#ff3a08", r()),
        opacity: 1,
        kind: "rise",
        params: [0.8 + 0.8 * r(), r()],
        part: burst,
      }));
      // The sea around the island.
      k.add(k.disc(1.25, 1.0), {
        pos: [0, 0.01, 0],
        pattern: false,
        kind: "wave",
        params: [0.006, 0],
        color: (c) => {
          const r = Math.hypot(c.p[0], c.p[2]);
          if (c.n[1] < 0) return "#12324a";
          return r < 1.04 ? "#e8f4f8" : mix("#2a7fb0", "#1a5a8a", (r - 1) / 0.25);
        },
      });
      k.reach([0, RIM + 1.1, 0]);
    },
  },

  "ice-statue": {
    alive: true,
    controls: [{ key: "temp", label: "Temperature", type: "slider", default: 0 }],
    drive(t, c, out) {
      out.energy = c.temp;
      out.parts.puddle = { visible: smoothstep(0.05, 0.7, c.temp) };
      out.parts.drips = { visible: c.temp > 0.1 && c.temp < 0.95 ? 1 : 0 };
      out.parts.frost = { visible: 1 - smoothstep(0, 0.3, c.temp) };
    },
    build(k) {
      const V = unit([0.15, 0.25, 1]);
      const ice = (a, deep = 0) => ({
        kind: "melt",
        params: [a, 0],
        flat: 0.25,
        opacity: 0.9,
        color: (c) => {
          const rim = 1 - Math.abs(dot(c.n, V));
          const g = c.fbm(c.p[0] * 5, c.p[1] * 5, c.p[2] * 5);
          const l = clamp(0.5 + 0.45 * dot(c.n, LIGHT) + 0.2 * g - deep, 0, 1);
          let col = ramp(["#3f8fc0", "#7cc0e4", "#bfe6f7", "#f2fbff"], l);
          col = mix(col, "#ffffff", 0.55 * Math.pow(rim, 3));
          if (Math.abs(g) < 0.018) col = mix(col, "#ffffff", 0.6);
          return col;
        },
      });
      // The pedestal: a thick slab of ice.
      k.add(k.box(1.0, 0.3, 0.62), {
        pos: [0, 0.15, 0],
        interior: 0.08,
        core: "#a8dcf4",
        ...ice(0.45, 0.1),
      });
      // The swan: a full body with a lifted tail, arched wings and an S neck.
      k.add(k.ellipsoid(0.38, 0.19, 0.21), {
        pos: [-0.02, 0.47, 0],
        interior: 0.08,
        core: "#bfe8fa",
        ...ice(0.75),
      });
      k.add(
        k.tube(
          spline([
            [-0.3, 0.5, 0],
            [-0.42, 0.56, 0],
            [-0.5, 0.66, 0],
          ]),
          (t) => 0.11 * (1 - 0.8 * t),
          { samples: 24, grid: 14, caps: true },
        ),
        ice(0.85),
      );
      const neck = spline([
        [0.26, 0.52, 0],
        [0.36, 0.64, 0],
        [0.4, 0.8, 0],
        [0.33, 0.95, 0],
        [0.3, 1.07, 0],
        [0.36, 1.16, 0],
        [0.45, 1.17, 0],
      ]);
      k.add(
        k.tube(neck, (t) => 0.075 - 0.035 * t, { samples: 96, grid: 24 }),
        ice(1),
      );
      k.add(k.ellipsoid(0.075, 0.058, 0.052), { pos: [0.46, 1.165, 0], ...ice(1) });
      k.add(k.cone(0.032, 0.004, 0.13), { pos: [0.57, 1.14, 0], rot: [0, 0, -105], ...ice(1) });
      for (const side of [-1, 1]) {
        k.add(
          k.param(
            (u, v) => {
              // u runs along the wing (front to back), v from its root up
              // to the feathered edge.
              const x = 0.18 - 0.55 * u;
              const lift = 0.36 * v * Math.sin(Math.PI * (0.25 + 0.75 * u)) + 0.12 * v * u;
              const feather = 0.035 * Math.abs(Math.sin(u * Math.PI * 6)) * v * v;
              return [
                x - 0.1 * v * u,
                0.55 + lift + feather,
                side * (0.17 + 0.1 * v - 0.12 * v * v),
              ];
            },
            { grid: 24 },
          ),
          ice(0.9),
        );
      }
      // Frost glinting while it is cold.
      const frost = k.part("frost", { pivot: [0, 0.5, 0] });
      k.cloud({ share: 0.002, size: 0.6, pattern: false }, (r) => ({
        p: [(r() - 0.5) * 1.1, 0.35 + r() * 0.9, (r() - 0.5) * 0.7],
        color: "#ffffff",
        opacity: 0.85,
        kind: "twinkle",
        params: [0.5, r() * 6],
        part: frost,
      }));
      // Drips and the puddle as it melts.
      const drips = k.part("drips", { pivot: [0, 0.4, 0] });
      k.cloud({ share: 0.004, size: 0.8, pattern: false }, (r) => ({
        p: [(r() - 0.5) * 0.9, 0.1 + r() * 0.5, (r() - 0.5) * 0.55],
        color: "#d8f2ff",
        opacity: 0.8,
        kind: "fall",
        params: [0.3, r()],
        part: drips,
      }));
      const puddle = k.part("puddle", { pivot: [0, 0, 0] });
      k.add(k.disc(0.95), {
        pos: [0, 0.004, 0],
        part: puddle,
        opacity: 0.55,
        pattern: false,
        color: (c) => mix("#bfe6f8", "#7fc0e0", Math.hypot(c.p[0], c.p[2]) / 0.95),
      });
    },
  },

  candle: {
    alive: true,
    options: [{ key: "wax", label: "Wax", type: "color", default: "#f3ead6" }],
    controls: [{ key: "lit", label: "Lit", type: "toggle", default: 1, ease: 0.5 }],
    action: { key: "lit", label: "Blow out or light" },
    drive(t, c, out) {
      out.parts.flame = { visible: c.lit };
      out.parts.smoke = { visible: 1 - c.lit };
      out.amount = 0.6 + 0.4 * c.lit;
    },
    build(k, o) {
      const wax = o.wax;
      const H = 0.95;
      const R = 0.26;
      const waxCol = (c) => {
        const glow = smoothstep(H - 0.35, H, c.p[1]);
        const col = mix(wax, mix(wax, "#ffcf8a", 0.6), glow);
        return lit(col, c.n, 0.35);
      };
      k.add(
        k.lathe(
          [
            [R, 0],
            [R, H - 0.06],
            [R * 0.97, H - 0.01],
            [R * 0.85, H],
            [R * 0.4, H - 0.03],
            [0, H - 0.04],
          ],
          { thick: 0.1 },
        ),
        { flat: 0.25, interior: 0.1, core: shade(wax, 0.92), color: waxCol },
      );
      // Drips of wax down the side.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + k.rand() * 0.5;
        const len = 0.15 + 0.3 * k.rand();
        const d = [Math.sin(a), 0, Math.cos(a)];
        const top = [d[0] * R * 1.0, H - 0.02, d[2] * R * 1.0];
        const bot = [d[0] * R * 1.02, H - len, d[2] * R * 1.02];
        k.add(
          k.tube(spline([top, lerp3(top, bot, 0.5), bot]), (t) => 0.022 + 0.012 * t * t, {
            samples: 16,
            grid: 10,
            caps: true,
          }),
          {
            color: waxCol,
          },
        );
      }
      // The wick.
      k.add(
        k.tube(
          spline([
            [0, H - 0.04, 0],
            [0.005, H + 0.02, 0],
            [0.015, H + 0.06, 0],
          ]),
          0.008,
          { samples: 8, grid: 6 },
        ),
        {
          weight: 3,
          color: "#1a1410",
        },
      );
      // The flame: a steady core, flickering tongues and a warm halo.
      const flame = k.part("flame", { pivot: [0, H + 0.05, 0] });
      k.add(
        k.lathe([
          [0, 0],
          [0.03, 0.03],
          [0.038, 0.07],
          [0.028, 0.13],
          [0.012, 0.19],
          [0, 0.23],
        ]),
        {
          pos: [0, H + 0.03, 0],
          part: flame,
          weight: 3,
          pattern: false,
          kind: "twinkle",
          params: [0.15, 0],
          color: (c) => {
            const y = (c.p[1] - (H + 0.03)) / 0.2;
            return y < 0.2
              ? mix("#3a6aff", "#ffe8a0", y / 0.2)
              : mix("#fff6d0", "#ffb030", smoothstep(0.5, 1, y));
          },
        },
      );
      k.cloud({ share: 0.03, size: 0.7, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = 0.028 * Math.sqrt(r());
        return {
          p: [Math.sin(a) * rr, H + 0.08 + r() * 0.04, Math.cos(a) * rr],
          color: mix("#ffb040", "#fff2c0", 1 - rr / 0.028),
          opacity: 0.8,
          kind: "flame",
          params: [0.12 + 0.08 * r(), r()],
          part: flame,
        };
      });
      k.cloud({ share: 0.008, size: 4, pattern: false }, (r) => {
        const d = randDir(r);
        const rr = 0.1 + 0.14 * r();
        return {
          p: [d[0] * rr, H + 0.15 + d[1] * rr * 1.3, d[2] * rr],
          color: "#ffc070",
          opacity: 0.04,
          kind: "twinkle",
          params: [0.3, r() * 6],
          part: flame,
        };
      });
      // A wisp of smoke when it is blown out.
      const smoke = k.part("smoke", { pivot: [0, H + 0.06, 0] });
      k.cloud({ share: 0.01, size: 1.8, pattern: false }, (r) => ({
        p: [0.015 + (r() - 0.5) * 0.02, H + 0.07, (r() - 0.5) * 0.02],
        color: "#bdb8b2",
        opacity: 0.25,
        kind: "rise",
        params: [0.5, r()],
        part: smoke,
      }));
      // A brass dish with a finger ring.
      const brass = (c) => {
        const env = smoothstep(-0.3, 0.9, -0.5 * c.n[0] + 0.6 * c.n[1] + 0.3 * c.n[2]);
        return mix("#6a4a1a", "#f8dc8a", env);
      };
      k.add(
        k.lathe([
          [0, -0.04],
          [0.42, -0.04],
          [0.47, -0.02],
          [0.48, 0.04],
          [0.45, 0.03],
          [0.3, 0.0],
          [0, 0.0],
        ]),
        { flat: 0.2, color: brass },
      );
      k.add(k.torus(0.08, 0.018), { pos: [0.55, 0.02, 0], rot: [90, 0, 0], color: brass });
      k.reach([0, H + 0.45, 0]);
    },
  },

  tornado: {
    alive: true,
    controls: [{ key: "power", label: "Power", type: "slider", default: 0.6 }],
    drive(t, c, out) {
      out.amount = 0.4 + 1.2 * c.power;
    },
    build(k) {
      const H = 1.9;
      const rad = (y) => 0.05 + 0.5 * Math.pow(y / H, 1.7) + 0.02 * Math.sin(y * 7);
      // The funnel: dust whirling fastest near the ground.
      k.cloud({ share: 0.55, size: 2.3, pattern: false }, (r) => {
        const y = H * Math.pow(r(), 0.8);
        const a = r() * TAU;
        const rr = rad(y) * (0.82 + 0.22 * Math.sqrt(r()));
        const streak = 0.5 + 0.5 * Math.sin(a * 3 + y * 9);
        const v = clamp(0.25 + 0.5 * (y / H) + 0.25 * streak + 0.1 * (r() - 0.5), 0, 1);
        return {
          p: [Math.sin(a) * rr, y, Math.cos(a) * rr],
          dir: [Math.cos(a), 0.15, -Math.sin(a)],
          stretch: 1.8,
          color: ramp(["#4a3e34", "#66584a", "#847a70", "#a09a94", "#c0bcb8"], v),
          opacity: 0.55 + 0.3 * (1 - y / H),
          kind: "orbit",
          params: [2.2, 0.6],
        };
      });
      // Debris caught in the wind.
      k.cloud({ share: 0.0006, size: 1.0, pattern: false }, (r) => {
        const y = 0.1 + r() * (H - 0.3);
        const a = r() * TAU;
        const rr = rad(y) * (1.1 + 0.5 * r());
        return {
          p: [Math.sin(a) * rr, y, Math.cos(a) * rr],
          n: randDir(r),
          color: mix("#2a2018", "#5a4a38", r()),
          kind: "orbit",
          params: [1.3, 0.3],
        };
      });
      // Dust boiling up around the foot.
      k.cloud({ share: 0.025, size: 2.2, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = 0.06 + 0.26 * r();
        return {
          p: [Math.sin(a) * rr, 0.03, Math.cos(a) * rr],
          color: mix("#8a7866", "#b8a894", r()),
          opacity: 0.2,
          kind: "rise",
          params: [0.4 + 0.3 * r(), r()],
        };
      });
      // The storm cloud it hangs from, turning slowly: soft puffs, lit on top.
      const puffs = [];
      for (let i = 0; i < 34; i++) {
        const a = i * 2.39996;
        const rr = 1.05 * Math.sqrt((i + 0.5) / 34);
        const s = 0.2 + 0.12 * ((i * 0.37) % 1) + 0.08 * (1 - rr);
        puffs.push({
          c: [
            Math.sin(a) * rr,
            H + 0.05 + 0.12 * (1 - rr) + 0.05 * Math.cos(i * 1.7),
            Math.cos(a) * rr,
          ],
          s,
        });
      }
      for (const pf of puffs) {
        k.add(k.sphere(pf.s), {
          pos: pf.c,
          scale: [1, 0.7, 1],
          size: 2.4,
          flat: 1,
          opacity: 0.75,
          pattern: false,
          kind: "orbit",
          params: [0.25, 0],
          color: (c) => {
            for (const q of puffs) {
              if (q === pf) continue;
              const d = Math.hypot(c.p[0] - q.c[0], (c.p[1] - q.c[1]) / 0.7, c.p[2] - q.c[2]);
              if (d < q.s * 0.85) return null;
            }
            const v = clamp(
              0.3 +
                0.35 * c.n[1] +
                0.25 * dot(c.n, LIGHT) +
                0.12 * c.fbm(c.p[0] * 3, c.p[1] * 3, c.p[2] * 3),
              0,
              1,
            );
            return ramp(["#1e2026", "#34373f", "#50545e", "#7a7f8a", "#a8acb4"], v);
          },
        });
      }
      // Flat fields below.
      k.add(k.disc(1.05), {
        pos: [0, 0, 0],
        color: (c) => {
          if (c.n[1] < 0) return "#3a2e20";
          const r = Math.hypot(c.p[0], c.p[2]);
          const g = c.fbm(c.p[0] * 5, 0, c.p[2] * 5);
          let col = mix("#5a7a2a", "#8a9a3a", 0.5 + 0.5 * g);
          if (Math.abs(Math.sin(c.p[0] * 14)) < 0.15) col = mix(col, "#6a5a3a", 0.4);
          return mix(col, "#6a5a44", smoothstep(0.45, 0.1, r));
        },
      });
    },
  },

  rainbow: {
    alive: true,
    build(k) {
      const bands = ["#e8302a", "#f58a1f", "#f7d51d", "#4cb748", "#2a8fd8", "#4a4aa8", "#8a3aa0"];
      const R = 0.82;
      const w = 0.2;
      k.add(k.torus(R, w), {
        rot: [90, 0, 0],
        scale: [1, 0.3, 1],
        flat: 0.25,
        color: (c) => {
          if (c.p[1] < -0.02) return null;
          const d = Math.hypot(c.p[0], c.p[1]) - R;
          const f = clamp(0.5 - d / (2 * w), 0, 0.999);
          const col = ramp(bands, f);
          return lit(col, c.n, 0.2);
        },
      });
      // Fluffy clouds at both feet.
      for (const side of [-1, 1]) {
        for (let i = 0; i < 7; i++) {
          const s = 0.13 + 0.07 * k.rand();
          const pos = [
            side * R + (k.rand() - 0.5) * 0.45,
            0.02 + k.rand() * 0.12,
            (k.rand() - 0.5) * 0.25,
          ];
          k.add(k.sphere(s), {
            pos,
            size: 1.8,
            flat: 0.8,
            kind: "breathe",
            params: [0.015, side],
            color: (c) =>
              mix("#c8d4e4", "#ffffff", clamp(0.4 + 0.6 * dot(c.n, LIGHT) + 0.3 * c.n[1], 0, 1)),
          });
        }
      }
      // Sparkles.
      k.cloud({ share: 0.01, size: 0.9, pattern: false }, (r) => {
        const a = r() * Math.PI;
        const rr = R + (r() - 0.5) * 0.7;
        return {
          p: [Math.cos(a) * rr, Math.sin(a) * rr + 0.05, (r() - 0.5) * 0.2],
          color: "#ffffff",
          opacity: 0.9,
          kind: "twinkle",
          params: [0.45, r() * 6],
        };
      });
    },
  },

  iceberg: {
    alive: true,
    build(k) {
      const n = k.noise;
      const shape = k.radial(
        (d) => {
          const up = smoothstep(-0.25, 0.25, d[1]);
          const a = 0.82 - 0.3 * up;
          const b = 1.0 - 0.25 * smoothstep(-0.1, 0.1, d[1]);
          const base = 1 / Math.hypot(Math.hypot(d[0], d[2]) / a, d[1] / b);
          const bump = Math.max(0, n(d[0] * 1.6 + 5, d[1] * 1.6, d[2] * 1.6));
          const peaks = 0.9 * bump * bump * Math.max(0, d[1]);
          return base * (1 + 0.1 * n.fbm(d[0] * 2, d[1] * 2, d[2] * 2, 3) + peaks);
        },
        { grid: 96 },
      );
      k.add(shape, {
        flat: 0.25,
        interior: 0.12,
        core: "#8fd0ee",
        color: (c) => {
          const y = c.p[1];
          const g = c.fbm(c.p[0] * 5, c.p[1] * 5, c.p[2] * 5);
          if (y < 0) {
            const depth = clamp(-y / 1.1, 0, 1);
            return mix(mix("#5fb8d8", "#2a7fae", depth), "#1a4a78", 0.4 * depth + 0.15 * g);
          }
          const crack = Math.abs(g) < 0.04;
          let col = mix("#a8dcf2", "#ffffff", clamp(0.45 + 0.6 * dot(c.n, LIGHT) + 0.2 * g, 0, 1));
          if (crack) col = mix(col, "#6ab8e0", 0.6);
          return col;
        },
      });
      // The sea: see-through and rippling, with foam at the waterline,
      // fading out towards its edge.
      k.cloud({ share: 0.14, size: 1.7, flat: 0.3, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = Math.sqrt(0.2 + r() * (1.9 - 0.2));
        const x = Math.sin(a) * rr;
        const z = Math.cos(a) * rr;
        const g = n.fbm(x * 3, 0, z * 3, 3);
        const foam = rr < 0.64 + 0.06 * g;
        return {
          p: [x, 0, z],
          n: [0, 1, 0],
          color: foam ? "#f2fbff" : mix("#6cc0e0", "#2a86b8", clamp(rr / 1.3 + 0.3 * g, 0, 1)),
          opacity: foam ? 0.85 : 0.5 * (1 - smoothstep(0.75, 1.38, rr)) + 0.04,
          kind: "wave",
          params: [0.006, 0],
        };
      });
      // Two little floes.
      for (const [x, z, s] of [
        [0.95, 0.35, 0.12],
        [-0.85, 0.6, 0.09],
      ]) {
        k.add(k.ellipsoid(s * 1.4, s * 0.45, s), {
          pos: [x, 0.0, z],
          kind: "wave",
          params: [0.006, 0],
          color: (c) => (c.p[1] < 0 ? "#6ab8d8" : lit("#f2fbff", c.n, 0.3)),
        });
      }
    },
  },

  waterfall: {
    alive: true,
    build(k) {
      const rand = k.rand;
      const TOP = 1.25;
      const LIP = 0.28;
      // The cliff: a rock wall with strata and moss on its ledges.
      const rock = (c) => {
        const g = c.fbm(c.p[0] * 4, c.p[1] * 4, c.p[2] * 4);
        const strata = Math.abs(Math.sin(c.p[1] * 22 + g * 3));
        let col = mix("#6a6258", "#3e3832", 0.4 + 0.5 * g);
        col = shade(col, 0.85 + 0.2 * strata);
        if (c.n[1] > 0.6) col = mix(col, mix("#3f6a24", "#6a8a34", c.rand()), 0.85);
        return lit(col, c.n, 0.5);
      };
      k.add(k.box(1.6, TOP, 0.6), {
        pos: [0, TOP / 2, -0.05],
        color: (c) => (c.s.face === 3 ? null : rock(c)),
      });
      for (let i = 0; i < 12; i++) {
        const x = (rand() - 0.5) * 1.7;
        if (Math.abs(x) < 0.35) continue;
        const s = 0.12 + 0.12 * rand();
        k.add(k.ellipsoid(s * 1.2, s, s * 0.8), {
          pos: [x, rand() * TOP, 0.25 + rand() * 0.05],
          color: rock,
        });
      }
      // The river on top, running to the lip.
      k.add(
        k.param((u, v) => [(u - 0.5) * 0.6, TOP + 0.005, -0.34 + v * (LIP + 0.34)], {
          grid: 12,
          flip: true,
        }),
        {
          pattern: false,
          color: (c) => mix("#4aa0c8", "#bfe8f6", 0.5 + 0.5 * Math.sin(c.p[2] * 40 + c.p[0] * 5)),
        },
      );
      // The falling curtain, curving out from the lip.
      const fallAt = (u, v) => {
        const x = (u - 0.5) * 0.6 * (1 + 0.25 * v);
        const y = TOP - v * (TOP - 0.06);
        const z = LIP + 0.2 * Math.sin(Math.min(1, v * 2) * Math.PI * 0.5) - 0.02 * v;
        return [x, y, z];
      };
      k.add(k.param(fallAt, { grid: 24 }), {
        opacity: 0.8,
        flat: 0.25,
        pattern: false,
        color: (c) => {
          const s = 0.5 + 0.5 * Math.sin(c.u * 70 + c.noise(c.u * 8, c.v * 3, 0) * 4);
          return mix("#7ec4e4", "#ffffff", 0.35 + 0.5 * s);
        },
      });
      k.cloud({ share: 0.12, size: 0.8, pattern: false }, (r) => {
        const u = r();
        const v = r() * 0.92;
        const p = fallAt(u, v);
        return {
          p: [p[0], p[1], p[2] + 0.015],
          dir: [0, -1, 0.1],
          stretch: 4,
          color: mix("#dff4ff", "#ffffff", r()),
          opacity: 0.8,
          kind: "fall",
          params: [0.22, r()],
        };
      });
      // The pool, with foam where the water lands and drifting mist.
      k.add(k.disc(0.75), {
        pos: [0, 0.04, 0.55],
        scale: [1.1, 1, 0.75],
        pattern: false,
        kind: "wave",
        params: [0.005, 0],
        color: (c) => {
          const d = Math.hypot(c.p[0], (c.p[2] - 0.5) * 1.6);
          if (d < 0.32 + 0.06 * c.noise(c.p[0] * 12, 0, c.p[2] * 12))
            return mix("#e8f6ff", "#ffffff", c.rand());
          return mix("#2a8ab8", "#15557a", clamp(d / 0.9, 0, 1));
        },
      });
      k.cloud({ share: 0.05, size: 2.8, pattern: false }, (r) => ({
        p: [(r() - 0.5) * 0.7, 0.08 + r() * 0.1, 0.45 + (r() - 0.5) * 0.25],
        color: "#f4fbff",
        opacity: 0.22,
        kind: "rise",
        params: [0.45 + 0.3 * r(), r()],
      }));
      // Mossy boulders around the pool.
      for (let i = 0; i < 9; i++) {
        const a = -0.4 + (i / 8) * (Math.PI + 0.8);
        const s = 0.08 + 0.08 * rand();
        k.add(k.ellipsoid(s * 1.3, s * 0.8, s), {
          pos: [Math.cos(a) * 0.85, 0.05, 0.55 + Math.sin(a) * 0.55],
          rot: [0, rand() * 180, 0],
          color: rock,
        });
      }
      k.add(k.box(2.0, 0.08, 1.7), {
        pos: [0, 0, 0.2],
        color: (c) =>
          c.s.face === 2 ? lit(mix("#4a6a2a", "#6a8a34", c.rand()), c.n, 0.3) : "#4a3a2a",
      });
    },
  },

  "ocean-wave": {
    alive: true,
    build(k) {
      // The wave's profile (x across, y up), from the sea in front up the
      // concave face, over the crest and curling down into a barrel; and
      // its back, sloping away. The wave peels along z: tall and hollow at
      // the front (towards the viewer), fading into the sea behind.
      const face = baked(
        spline([
          [1.05, 0],
          [0.62, 0.015],
          [0.34, 0.1],
          [0.16, 0.32],
          [0.1, 0.58],
          [0.18, 0.82],
          [0.36, 0.97],
          [0.58, 0.96],
          [0.76, 0.84],
          [0.84, 0.64],
          [0.8, 0.48],
          [0.7, 0.42],
        ]),
      );
      const back = baked(
        spline([
          [0.3, 0.96],
          [0.08, 0.9],
          [-0.2, 0.62],
          [-0.48, 0.28],
          [-0.75, 0.07],
          [-0.95, 0.0],
        ]),
      );
      const Z0 = -0.85;
      const Z1 = 0.85;
      const grow = (z) => smoothstep(Z0, Z0 + 0.9, z);
      const at = (curve, s, v) => {
        const z = Z0 + (Z1 - Z0) * v;
        const g = grow(z);
        const p = curve(s);
        // Behind, the lip has not formed yet: pull it back towards the crest.
        const x = p[0] * (0.55 + 0.45 * g) + 0.2 * (1 - g);
        return [x, p[1] * (0.2 + 0.8 * g), z];
      };
      const water = (c, s, isBack) => {
        const hgt = clamp(c.p[1] / 0.95, 0, 1);
        const g = c.fbm(c.p[0] * 4, c.p[1] * 4, c.p[2] * 4);
        let tone = hgt * 0.95 + (isBack ? -0.25 : 0.05) + 0.1 * g;
        let col = ramp(["#062f58", "#0b4f82", "#1582a4", "#35b2c2", "#8ae0dc"], clamp(tone, 0, 1));
        const foamN = c.noise(c.p[0] * 12, c.p[1] * 12, c.p[2] * 5);
        if (!isBack && s > 0.62 && foamN > 0.35 - (s - 0.62) * 3)
          return keep(mix("#e4f6ff", "#ffffff", c.rand()));
        if (isBack && s < 0.14 && foamN > -0.1) return keep("#eef9ff");
        if (foamN > 0.5) col = mix(col, "#dff4ff", 0.55);
        return lit(col, c.n, 0.25);
      };
      k.add(
        k.param((u, v) => at(face, u, v), { grid: 80 }),
        {
          flat: 0.25,
          color: (c) => water(c, c.u, false),
        },
      );
      k.add(
        k.param((u, v) => at(back, u, v), { grid: 48 }),
        {
          flat: 0.25,
          color: (c) => water(c, c.u, true),
        },
      );
      // Spray flying off the lip, foam churning where it lands.
      k.cloud({ share: 0.04, size: 0.8, pattern: false }, (r) => {
        const v = 0.35 + 0.65 * r();
        const p = at(face, 0.6 + 0.32 * r(), v);
        return {
          p: [p[0] + 0.02, p[1] + 0.02, p[2]],
          color: "#ffffff",
          opacity: 0.8,
          kind: "rise",
          params: [0.2 + 0.2 * r(), r()],
        };
      });
      k.cloud({ share: 0.03, size: 1.4, pattern: false }, (r) => {
        const v = r();
        const g = grow(Z0 + (Z1 - Z0) * v);
        return {
          p: [
            0.66 + 0.2 * r() + 0.08 * Math.sin(v * 17),
            0.02 + 0.07 * r() * g,
            Z0 + (Z1 - Z0) * v,
          ],
          color: mix("#dff4ff", "#ffffff", r()),
          opacity: 0.75,
          kind: "twinkle",
          params: [0.3, r() * 6],
        };
      });
      // Calmer sea in front, rippling.
      k.add(
        k.param((u, v) => [1.05 + 0.25 * u, 0, Z0 + (Z1 - Z0) * v], { grid: 12, flip: true }),
        {
          pattern: false,
          kind: "wave",
          params: [0.01, 0],
          color: (c) => lit(mix("#08457a", "#0f5a8e", c.rand()), c.n, 0.2),
        },
      );
    },
  },

  geyser: {
    alive: true,
    controls: [{ key: "erupt", label: "Erupt", type: "pulse", ease: 5 }],
    action: { key: "erupt", label: "Erupt" },
    drive(t, c, out) {
      // It bubbles on its own, with a big eruption on a slow cycle.
      const cycle = Math.max(0, Math.sin(t * 0.45)) ** 6;
      out.amount = 0.6 + 0.5 * cycle + 1.2 * c.erupt;
    },
    build(k) {
      // Terraced sinter mound with coloured mats around a blue pool.
      const mound = k.lathe(
        [
          [1.0, 0],
          [0.95, 0.04],
          [0.8, 0.06],
          [0.74, 0.1],
          [0.55, 0.12],
          [0.5, 0.16],
          [0.34, 0.18],
          [0.3, 0.19],
        ],
        { thick: 0.1 },
      );
      k.add(mound, {
        flat: 0.25,
        interior: 0.08,
        core: "#b8a890",
        color: (c) => {
          const r = Math.hypot(c.p[0], c.p[2]);
          const g = c.fbm(c.p[0] * 6, c.p[1] * 6, c.p[2] * 6);
          let col = ramp(
            ["#e8a030", "#d8702a", "#c8b8a0", "#e8e0d0", "#b8a890"],
            clamp((r - 0.3) / 0.7 + 0.1 * g, 0, 1),
          );
          if (c.n[1] < 0.7) col = shade(col, 0.8);
          return lit(col, c.n, 0.4);
        },
      });
      k.add(k.disc(0.3), {
        pos: [0, 0.185, 0],
        pattern: false,
        kind: "wave",
        params: [0.004, 0],
        color: (c) => {
          const r = Math.hypot(c.p[0], c.p[2]) / 0.3;
          return ramp(["#0a3a7a", "#1a6ab8", "#3ab0d8", "#8ad8d0", "#e8d070"], r);
        },
      });
      // The plume: water shooting up, steam billowing around it.
      k.cloud({ share: 0.18, size: 0.8, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = 0.05 * Math.sqrt(r());
        return {
          p: [Math.sin(a) * rr, 0.2, Math.cos(a) * rr],
          dir: [0, 1, 0],
          stretch: 2.5,
          color: mix("#cfeaf8", "#ffffff", r()),
          opacity: 0.85,
          kind: "rise",
          params: [1.6 + 1.2 * r(), r()],
        };
      });
      k.cloud({ share: 0.14, size: 3.4, pattern: false }, (r) => {
        const a = r() * TAU;
        const rr = 0.12 * Math.sqrt(r());
        return {
          p: [Math.sin(a) * rr, 0.25 + r() * 0.3, Math.cos(a) * rr],
          color: mix("#e8eef2", "#ffffff", r()),
          opacity: 0.2,
          kind: "rise",
          params: [1.2 + 1.0 * r(), r()],
        };
      });
      // Rocks around the rim.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + k.rand() * 0.5;
        const s = 0.05 + 0.05 * k.rand();
        k.add(k.ellipsoid(s * 1.3, s * 0.7, s), {
          pos: [Math.sin(a) * 0.85, 0.05, Math.cos(a) * 0.85],
          color: (c) => lit(mix("#8a8070", "#b8ac98", c.rand()), c.n, 0.4),
        });
      }
      k.reach([0, 1.5, 0]);
    },
  },
};
