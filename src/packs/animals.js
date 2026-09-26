// Animals pack: stylised, friendly creatures. A jellyfish, a school of fish,
// a butterfly, a pufferfish that puffs up, a nautilus with chambers inside,
// and a ladybug, snail, octopus, starfish, sea urchin, frog, penguin and owl.

import {
  mix,
  shade,
  smoothstep,
  clamp,
  spline,
  quatEuler,
  quatAxisAngle,
  quatFromTo,
  quatRotate,
  quatMul,
  vec,
} from "../kit.js";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const LIGHT = vec.unit([0.3, 0.8, 0.55]);
const VIEW = vec.unit([0.52, 0.27, 0.81]);
const HALF = vec.unit(vec.add(LIGHT, VIEW));
const keep = (c, size) => ({ c, keep: true, size });
const band = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const fract = (x) => x - Math.floor(x);
// Seconds since a pulse fired, as 0..1 (1 at rest).
const progress = (v) => (v > 0 ? 1 - v : 1);
const easeOut = (x) => 1 - (1 - clamp(x, 0, 1)) ** 3;
const easeInOut = (x) => {
  const t = clamp(x, 0, 1);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

// Fake light: brighter towards the light, with an optional wet gloss.
function lit(c, col, k = 0.3, gloss = 0) {
  const d = dot(c.n, LIGHT);
  let out = shade(col, 1 + k * (0.9 * d - 0.15));
  if (gloss) out = mix(out, "#ffffff", gloss * Math.pow(Math.max(0, dot(c.n, HALF)), 24));
  return out;
}

// A shiny cartoon eye looking along `look`: a dark pupil, an optional iris
// and white, and a highlight.
function eye(k, pos, r, look, opts = {}) {
  const L = vec.unit(look);
  const H = vec.unit(vec.add(L, [0.35, 0.55, 0.2]));
  k.add(k.sphere(r), {
    pos,
    part: opts.part,
    weight: opts.weight ?? 4,
    flat: 0.3,
    pattern: false,
    color: (c) => {
      if (dot(c.ln, H) > 0.94) return "#ffffff";
      const d = dot(c.ln, L);
      if (d > (opts.pupil ?? 0.55)) return "#0f0f12";
      if (opts.iris && d > (opts.irisEdge ?? 0.2)) return lit(c, opts.iris, 0.2);
      return lit(c, opts.white || "#0f0f12", 0.2);
    },
  });
}

// A group of shapes moved and turned together.
function group(k, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const q = rot.length === 4 ? rot : quatEuler(...rot);
  return {
    kit: k,
    q,
    pt: (p) => vec.add(pos, quatRotate(q, p)),
    dir: (d) => quatRotate(q, d),
    add(shape, o = {}) {
      const oq = o.quat || (o.rot ? quatEuler(...o.rot) : [0, 0, 0, 1]);
      return k.add(shape, {
        ...o,
        rot: undefined,
        quat: quatMul(q, oq),
        pos: vec.add(pos, quatRotate(q, o.pos || [0, 0, 0])),
      });
    },
  };
}

// A tube from a to b.
const rod = (k, a, b, r, opts) =>
  k.tube((t) => vec.add(a, vec.mul(vec.sub(b, a), t)), r, { grid: 16, samples: 8, ...opts });

// ---- Pufferfish geometry (shared by build and drive) -------------------------------
// The rest pose is the fish puffed up: a ball made of twelve overlapping
// patches. Deflating pulls each patch in towards a slim fish shape.
const PUFF = (() => {
  const P = (1 + Math.sqrt(5)) / 2;
  const raw = [];
  for (const s1 of [-1, 1])
    for (const s2 of [-1, 1]) raw.push([s1 * P, 0, s2], [s2, s1 * P, 0], [0, s2, s1 * P]);
  // Turn the icosahedron so two patches sit where the eyes go.
  const q = quatAxisAngle([0, 0, 1], 20 * DEG);
  const dirs = raw.map((d) => quatRotate(q, vec.unit(d)));
  const R = 0.8;
  const slim = [0.8, 0.5, 0.46];
  const shift = dirs.map((d) => {
    const r = 1 / Math.hypot(d[0] / slim[0], d[1] / slim[1], d[2] / slim[2]);
    return R - r;
  });
  const nearest = (p) => {
    let best = 0;
    let bd = -2;
    const u = vec.unit(p);
    dirs.forEach((d, i) => {
      const v = dot(u, d);
      if (v > bd) {
        bd = v;
        best = i;
      }
    });
    return best;
  };
  const eyes = [vec.unit([0.8, 0.29, 0.526]), vec.unit([0.8, 0.29, -0.526])];
  const fins = [vec.unit([0.15, -0.12, 1]), vec.unit([0.15, -0.12, -1])];
  return {
    dirs,
    R,
    shift,
    nearest,
    eyes,
    fins,
    finPatch: fins.map((d) => nearest(d)),
    mouth: vec.unit([1, -0.12, 0]),
  };
})();

// The nautilus shell: a logarithmic spiral that triples its size each turn.
const NAUT = (() => {
  const b = Math.log(3) / TAU;
  const tMax = (5 * Math.PI) / 4 + 2 * TAU;
  const r = (t) => Math.exp(b * (t - tMax));
  // Cross-section at angle t: centre radius, radial and lateral half-widths.
  const sec = (t) => {
    const ro = r(t);
    const ri = 0.3 * ro;
    return { rc: (ro + ri) / 2, hw: (ro - ri) / 2, ht: 0.29 * ro };
  };
  const at = (t, rho, phi) => {
    const s = sec(t);
    const rad = s.rc + s.hw * rho * Math.cos(phi);
    return [
      rad * Math.cos(t),
      rad * Math.sin(t),
      s.ht * rho * Math.sin(phi) * (1 - 0.12 * Math.cos(phi)),
    ];
  };
  // The way the shell grows at its mouth: the tentacles reach out along it.
  const tan = [-Math.sin(tMax), Math.cos(tMax), 0];
  return { b, tMax, r, sec, at, tan };
})();

// ---- Frog ------------------------------------------------------------------------------
// The jaw hinges at the back of the mouth. The tongue is built at its full
// reach with the jaw open by `open`, so its tip meets the fly at `catch`.
const FROG = (() => {
  const hinge = [0, 0.11, 0.04];
  const open = 0.5;
  // Front left of the frog, so the tongue shoots across the home view.
  const catchAt = [-0.5, 0.24, 0.7];
  const unJaw = (p) =>
    vec.add(hinge, quatRotate(quatAxisAngle([1, 0, 0], -open), vec.sub(p, hinge)));
  const tipRest = [0, 0.105, 0.36];
  return {
    hinge,
    open,
    catch: catchAt,
    from: [-0.75, 0.42, -0.1],
    tipRest,
    tipFull: unJaw(catchAt),
    secs: 3.8,
  };
})();

// ---- School of fish ------------------------------------------------------------------
const FISH_SECS = 5.0;

// ---- Jellyfish palettes --------------------------------------------------------------
const JELLY = {
  moon: { bell: "#f29bd8", rim: "#9d8cff", glow: "#c9f6ff", arms: "#ff6fb8", gonad: "#ff4fa3" },
  nettle: { bell: "#ffb25e", rim: "#ff7a3d", glow: "#fff1b8", arms: "#e2552b", gonad: "#b8321c" },
  blue: { bell: "#7fc4ff", rim: "#5d7dff", glow: "#e0fbff", arms: "#4f66e8", gonad: "#2f45c9" },
};

export const RECIPES = {
  // ---- Jellyfish -------------------------------------------------------------------------
  jellyfish: {
    alive: true,
    options: [
      {
        key: "kind",
        label: "Colour",
        type: "select",
        default: "moon",
        choices: [
          { id: "moon", label: "Moon jelly" },
          { id: "nettle", label: "Sea nettle" },
          { id: "blue", label: "Blue" },
        ],
      },
    ],
    controls: [{ key: "pulse", label: "Swim", type: "pulse", ease: 3.2 }],
    action: { key: "pulse", label: "Swim" },
    drive(t, c, out) {
      // One strong stroke: the bell squeezes tall and narrow and jets the
      // jelly upwards, the tentacles stream behind it, glowing, and it
      // drifts back down.
      const e = (1 - c.pulse) * 3.2;
      const on = c.pulse > 0;
      const env = on ? band(e, 0, 0.1) * (1 - band(e, 1.6, 3.2)) : 0;
      const squeeze = on ? Math.sin(Math.PI * band(e, 0, 0.5)) : 0;
      const relax = on ? Math.sin(Math.PI * band(e, 0.5, 1.2)) : 0;
      const rise = on ? easeInOut(band(e, 0.05, 0.9)) * (1 - easeInOut(band(e, 1.2, 3.2))) : 0;
      const trail = on ? easeInOut(band(e, 0.05, 0.4)) * (1 - easeInOut(band(e, 0.9, 2.6))) : 0;
      out.body = { offset: [0, 0.3 * rise, 0], squash: -0.2 * squeeze + 0.07 * relax };
      out.amount = 1 + 1.6 * env;
      for (let i = 0; i < 6; i++)
        out.parts[`t${i}`] = {
          angle: 0.1 * (1 - trail) * Math.sin(t * 1.3 + i * 1.7) + 0.32 * trail,
          visible: 1 + 0.9 * env,
        };
      out.parts.armsA = { angle: 0.07 * Math.sin(t * 1.1) };
      out.parts.armsB = { angle: 0.07 * Math.sin(t * 1.1 + 2) };
    },
    build(k, o) {
      const pal = JELLY[o.kind];
      const rimY = 0.3;
      const rimR = 0.7;
      const bellProf = [
        [rimR - 0.04, rimY - 0.02],
        [rimR + 0.02, rimY + 0.08],
        [0.68, 0.45],
        [0.58, 0.66],
        [0.4, 0.84],
        [0.2, 0.93],
        [0, 0.96],
      ];
      const pulse = { kind: "breathe", params: [0.05, 0] };
      const gonad = (c) => {
        const x = c.p[0];
        const z = c.p[2];
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + TAU / 8;
          const d = Math.hypot(x - Math.sin(a) * 0.24, z - Math.cos(a) * 0.24);
          if (Math.abs(d - 0.1) < 0.032 && c.p[1] > 0.7) return true;
        }
        return false;
      };
      k.add(k.lathe(bellProf, { grid: 72 }), {
        ...pulse,
        flat: 0.2,
        opacity: 0.6,
        color: (c) => {
          const h = band(c.p[1], rimY, 0.96);
          if (gonad(c)) return keep(mix(pal.gonad, "#ffffff", 0.15));
          const a = Math.atan2(c.p[0], c.p[2]) / TAU;
          const canal = Math.abs(fract(a * 16) - 0.5) > 0.46;
          let col = mix(pal.rim, pal.bell, 0.35 + 0.65 * h);
          if (canal) col = mix(col, "#ffffff", 0.3);
          const f = 1 - Math.abs(dot(c.n, VIEW));
          col = mix(col, "#ffffff", 0.35 * f * f);
          return lit(c, col, 0.25, 0.5);
        },
      });
      // The underside of the bell, a little deeper in colour.
      k.add(
        k.lathe(
          bellProf.map(([r, y]) => [r * 0.9, y - 0.05]),
          { grid: 48 },
        ),
        {
          ...pulse,
          flat: 0.25,
          opacity: 0.5,
          color: (c) => mix(pal.rim, pal.bell, 0.4 * band(c.p[1], rimY, 0.9)),
        },
      );
      // A glowing rim with little sense organs.
      k.add(k.torus(rimR, 0.026), {
        ...pulse,
        pos: [0, rimY + 0.01, 0],
        weight: 2.5,
        pattern: false,
        opacity: 0.95,
        color: (c) => {
          const a = Math.atan2(c.p[0], c.p[2]) / TAU;
          return Math.abs(fract(a * 8) - 0.5) < 0.04 ? "#ffffff" : pal.glow;
        },
      });
      k.cloud({ share: 0.01, size: 0.8, pattern: false }, (rand) => {
        const a = rand() * TAU;
        const r = rimR + (rand() - 0.5) * 0.04;
        return {
          p: [Math.sin(a) * r, rimY + (rand() - 0.5) * 0.04, Math.cos(a) * r],
          color: pal.glow,
          opacity: 1,
          kind: "twinkle",
          params: [0.35, rand() * TAU],
        };
      });
      // Oral arms: four frilly ribbons from the middle.
      const armsA = k.part("armsA", { pivot: [0, rimY + 0.05, 0], axis: [1, 0, 0] });
      const armsB = k.part("armsB", { pivot: [0, rimY + 0.05, 0], axis: [0, 0, 1] });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + TAU / 8;
        const out = [Math.sin(a), 0, Math.cos(a)];
        const side = [Math.cos(a), 0, -Math.sin(a)];
        const len = 1.05;
        const arm = k.param(
          (u, v) => {
            const y = rimY + 0.08 - v * len;
            const wig = 0.07 * Math.sin(v * 5 + i);
            const w = 0.1 * (1 - 0.55 * v) * (u - 0.5) * 2;
            const frill = 0.035 * Math.sin(v * 38 + u * 3) * Math.abs(u - 0.5) * 2;
            const r = 0.06 + 0.1 * v + wig;
            return [out[0] * (r + frill) + side[0] * w, y, out[2] * (r + frill) + side[2] * w];
          },
          { grid: 48 },
        );
        k.add(arm, {
          part: i % 2 ? armsA : armsB,
          kind: "breathe",
          params: [0.03, 0],
          flat: 0.25,
          opacity: 0.8,
          color: (c) => {
            const edge = Math.abs(c.u - 0.5) * 2;
            return lit(c, mix(pal.arms, "#ffffff", 0.35 * edge + 0.2 * c.v), 0.25, 0.3);
          },
        });
      }
      // Trailing tentacles in six groups that sway from the rim.
      for (let g = 0; g < 6; g++) {
        const a0 = (g / 6) * TAU;
        const piv = [Math.sin(a0) * rimR * 0.95, rimY, Math.cos(a0) * rimR * 0.95];
        const part = k.part(`t${g}`, { pivot: piv, axis: [Math.cos(a0), 0, -Math.sin(a0)] });
        for (let j = 0; j < 3; j++) {
          const a = a0 + (j - 1) * 0.3 + 0.05 * k.rand();
          const r0 = rimR * 0.93;
          const len = 1.15 + 0.35 * k.rand();
          const ph = k.rand() * TAU;
          const pts = [];
          for (let s = 0; s <= 6; s++) {
            const f = s / 6;
            const rr = r0 - 0.08 * f + 0.06 * Math.sin(f * 5 + ph);
            const aa = a + 0.12 * Math.sin(f * 4 + ph);
            pts.push([Math.sin(aa) * rr, rimY + 0.02 - f * len, Math.cos(aa) * rr]);
          }
          k.add(
            k.tube(spline(pts), (t) => 0.016 * (1 - 0.6 * t), { grid: 24, samples: 64 }),
            {
              part,
              kind: "twinkle",
              params: [0.12, ph],
              flat: 0.3,
              weight: 2.2,
              opacity: 0.85,
              pattern: false,
              color: (c) => mix(pal.glow, pal.bell, 0.3 + 0.5 * c.t),
            },
          );
        }
      }
    },
  },

  // ---- A school of fish ------------------------------------------------------------------
  "fish-school": {
    alive: true,
    options: [
      {
        key: "kind",
        label: "Fish",
        type: "select",
        default: "silver",
        choices: [
          { id: "silver", label: "Silver" },
          { id: "tropical", label: "Tropical" },
        ],
      },
    ],
    controls: [{ key: "swirl", label: "Swirl", type: "pulse", ease: FISH_SECS }],
    action: { key: "swirl", label: "Bait ball" },
    drive(t, c, out, info) {
      // Each fish is its own piece, orbiting with its shell. A tap: the
      // school tightens into a spinning bait ball, then bursts outwards in
      // every direction as if something struck at it, each fish darting
      // away head first, and swims back into its place.
      const F = info.data?.fish;
      if (!F) return;
      const on = c.swirl > 0;
      const s = progress(c.swirl) * FISH_SECS;
      const spin = on ? TAU * easeInOut(band(s, 0.2, 2.4)) : 0;
      out.tokens = F.map((f, i) => {
        const d = f.jit * 0.25;
        const ball = on ? easeInOut(band(s, 0.1 + d, 1.2 + d)) * (1 - band(s, 2.2 + d, 2.45 + d)) : 0; // prettier-ignore
        const burst = on ? (1 - (1 - band(s, 2.2 + d, 2.6 + d)) ** 3) * (1 - easeInOut(band(s, 3.1 + d, 4.7 + d))) : 0; // prettier-ignore
        const rho = 1 - 0.45 * ball + (0.18 + 0.24 * f.far) * burst;
        const face = -(Math.PI / 2) * (on ? band(s, 2.2 + d, 2.4 + d) * (1 - band(s, 2.9 + d, 3.7 + d)) : 0); // prettier-ignore
        const th = f.rate * t + spin;
        const q = quatAxisAngle([0, 1, 0], th + face);
        const P = quatRotate(quatAxisAngle([0, 1, 0], th), vec.mul(f.pos, rho));
        return { base: [0, 0, 0], quat: q, offset: vec.sub(P, quatRotate(q, f.pos)) };
      });
    },
    build(k, o) {
      // Fish in three shells round the middle; each fish is a token that
      // drive() orbits with its shell (rigidly, so no fish is stretched).
      const fish = [];
      const shells = [
        { r: 0.36, n: 8, rate: 0.95 },
        { r: 0.62, n: 16, rate: 0.75 },
        { r: 0.88, n: 24, rate: 0.6 },
      ];
      const tropical = ["#ffd23a", "#ff8a2a", "#3fb8ff", "#ff5f8a", "#8be04a"];
      for (const sh of shells) {
        for (let i = 0; i < sh.n; i++) {
          const a = (i / sh.n) * TAU + k.rand() * 0.4;
          const cy = (((i * 7) % sh.n) / sh.n - 0.5) * 1.5 + (k.rand() - 0.5) * 0.15;
          const r = sh.r * (0.95 + 0.1 * k.rand());
          const pos = [
            Math.sin(a) * r * Math.sqrt(1 - cy * cy),
            cy * r,
            Math.cos(a) * r * Math.sqrt(1 - cy * cy),
          ];
          const fwd = vec.unit([Math.cos(a), (k.rand() - 0.5) * 0.25, -Math.sin(a)]);
          const side = vec.unit(vec.cross(fwd, [0, 1, 0]));
          const up = vec.cross(side, fwd);
          fish.push({
            pos,
            fwd,
            up,
            side,
            rate: sh.rate,
            size: 0.85 + 0.3 * k.rand(),
            col: tropical[Math.floor(k.rand() * tropical.length)],
            jit: k.rand(),
            far: k.rand(),
          });
        }
      }
      k.data = { fish: fish.map((f) => ({ pos: f.pos, rate: f.rate, jit: f.jit, far: f.far })) };
      const L = 0.25;
      const D = 0.085;
      const W = 0.044;
      const silver = o.kind !== "tropical";
      k.cloud({ share: 0.97, size: 0.55, flat: 0.3 }, (rand, i) => {
        const fi = i % fish.length;
        const f = fish[fi];
        const s = f.size;
        const pick = rand();
        let lp;
        let ln;
        let col;
        let keepIt = false;
        if (pick < 0.8) {
          // The body: a spindle, blunt at the head (+x).
          let t;
          let rho;
          do {
            t = rand();
            rho = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.8);
          } while (rand() > rho + 0.05);
          const ph = rand() * TAU;
          const x = (t - 0.5) * L;
          lp = [x, Math.cos(ph) * rho * D * 0.5, Math.sin(ph) * rho * W * 0.5];
          ln = vec.unit([0, Math.cos(ph) / D, Math.sin(ph) / W]);
          const back = Math.cos(ph);
          if (silver) {
            col =
              back > 0.35 ? mix("#2d5c86", "#3f78a8", rand()) : mix("#dfe8ee", "#f7fbff", rand());
            if (Math.abs(back - 0.2) < 0.08) col = "#8fb8d6";
          } else {
            col = f.col;
            if (Math.abs(fract(t * 3.2) - 0.5) < 0.1 && t > 0.2) col = "#ffffff";
            if (back < -0.4) col = mix(col, "#ffffff", 0.4);
          }
          // An eye on each side near the head.
          const e = Math.hypot(x - 0.3 * L, lp[1] - 0.12 * D);
          if (e < 0.012 && Math.abs(lp[2]) > W * 0.2) {
            col = e < 0.006 ? "#0c0c10" : "#ffffff";
            keepIt = true;
          }
        } else if (pick < 0.94) {
          // A forked tail.
          const u = rand();
          const v = rand() * 2 - 1;
          const x = -L / 2 - u * 0.075;
          const h = (0.012 + u * 0.05) * v;
          if (u > 0.6 && Math.abs(v) < (u - 0.6) * 1.6) return null;
          lp = [x, h, 0];
          ln = [0, 0, 1];
          col = silver ? mix("#3f6d95", "#b9cfe0", Math.abs(v)) : shade(f.col, 0.8);
        } else {
          // A small fin on the back.
          const u = rand();
          const v = rand();
          lp = [(-0.05 + u * 0.1 - v * 0.03) * 1, D * 0.45 + v * 0.035 * (1 - u), 0];
          ln = [0, 0, 1];
          col = silver ? "#355f86" : shade(f.col, 0.75);
        }
        const p = vec.add(
          f.pos,
          vec.add(
            vec.mul(f.fwd, lp[0] * s),
            vec.add(vec.mul(f.up, lp[1] * s), vec.mul(f.side, lp[2] * s)),
          ),
        );
        const n = vec.add(
          vec.mul(f.fwd, ln[0]),
          vec.add(vec.mul(f.up, ln[1]), vec.mul(f.side, ln[2])),
        );
        const lightF = 1 + 0.25 * (0.9 * dot(n, LIGHT) - 0.15);
        return {
          p,
          n,
          color: shade(col, lightF),
          size: 1,
          opacity: 0.95,
          kind: "token",
          params: [fi, 0],
          pattern: keepIt ? false : undefined,
        };
      });
      // Bubbles drifting up.
      k.cloud({ share: 0.003, size: 0.8, pattern: false }, (rand) => ({
        p: [(rand() - 0.5) * 1.2, -0.7 + rand() * 0.3, (rand() - 0.5) * 1.2],
        color: "#dff4ff",
        opacity: 0.55,
        kind: "rise",
        params: [1.2, rand()],
      }));
    },
  },

  // ---- Butterfly ------------------------------------------------------------------------
  butterfly: {
    alive: true,
    options: [
      {
        key: "wings",
        label: "Wings",
        type: "select",
        default: "monarch",
        choices: [
          { id: "monarch", label: "Monarch" },
          { id: "morpho", label: "Blue morpho" },
          { id: "swallowtail", label: "Swallowtail" },
          { id: "rose", label: "Rose" },
        ],
      },
    ],
    controls: [{ key: "flap", label: "Flutter", type: "pulse", ease: 2 }],
    action: { key: "flap", label: "Flutter" },
    drive(t, c, out) {
      const amp = 0.35 + 0.55 * c.flap;
      const a = 0.12 + amp * (0.5 - 0.5 * Math.cos(t * (5 + 5 * c.flap)));
      out.parts.right = { angle: a };
      out.parts.left = { angle: -a };
      out.amount = 0.6;
    },
    build(k, o) {
      const kind = o.wings;
      // Wing outlines in polar form round the root (angles in degrees, 0 = +x).
      const fore = {
        root: [0.02, 0.1],
        a0: -6,
        a1: 84,
        r: (a) =>
          0.55 +
          0.4 * Math.pow(Math.max(0, Math.sin((Math.PI * (a + 6)) / 90)), 0.7) -
          0.1 * band(a, 60, 84),
      };
      const hind = {
        root: [0.02, 0.02],
        a0: -96,
        a1: 10,
        r: (a) => {
          let r = 0.36 + 0.24 * Math.pow(Math.max(0, Math.sin((Math.PI * (a + 96)) / 106)), 0.6);
          if (kind === "swallowtail") r += 0.28 * Math.exp(-(((a + 62) / 5) ** 2));
          return r;
        },
      };
      const patterns = {
        monarch(w, a, v, s) {
          const vein =
            Math.abs(fract(((a - w.a0) / (w.a1 - w.a0)) * (w === fore ? 7 : 6)) - 0.5) > 0.45;
          if (v > 0.84) {
            const dot1 = Math.abs(v - 0.9) < 0.028 && Math.abs(fract(a / 7) - 0.5) < 0.2;
            const dot2 = Math.abs(v - 0.955) < 0.02 && Math.abs(fract(a / 5 + 0.5) - 0.5) < 0.18;
            return dot1 || dot2 ? "#fbf7ea" : "#16110e";
          }
          if (vein || Math.abs(v - 0.5) < 0.018) return "#1b1410";
          if (w === fore && a > 40 && v > 0.66)
            return Math.abs(fract(a / 9) - 0.5) < 0.18 && v < 0.8 ? "#fbf1d8" : "#16110e";
          return mix("#f7a21e", "#e0620f", 0.5 * v + 0.2 * s);
        },
        morpho(w, a, v, s) {
          if (v > 0.8) {
            const d = Math.abs(v - 0.9) < 0.03 && Math.abs(fract(a / 8) - 0.5) < 0.2;
            return d ? "#f5f5f0" : "#101622";
          }
          const sheen = 0.5 + 0.5 * Math.sin(a * 0.05 + v * 3);
          const vein = Math.abs(fract(((a - w.a0) / (w.a1 - w.a0)) * 8) - 0.5) > 0.47;
          const col = mix("#1f7fe8", "#5ee8ff", sheen * (1 - v) + 0.2 * s);
          return vein ? shade(col, 0.7) : col;
        },
        swallowtail(w, a, v) {
          if (v > 0.84) {
            const c = Math.abs(v - 0.91) < 0.03 && Math.abs(fract(a / 9) - 0.5) < 0.25;
            return c ? "#f6de5a" : "#15130f";
          }
          if (w === hind) {
            const eyeA = Math.hypot((a + 20) / 30, (v - 0.72) / 0.1);
            if (eyeA < 1) return eyeA < 0.5 ? "#ff7a1a" : "#2d5fd8";
            if (v > 0.7) return "#15130f";
          }
          const stripe = w === fore && Math.abs(fract(a / 16 + 0.3) - 0.5) < 0.12;
          return stripe || Math.abs(v - 0.55) < 0.02 ? "#15130f" : "#f7e27a";
        },
        rose(w, a, v, s) {
          if (v > 0.85)
            return Math.abs(fract(a / 7) - 0.5) < 0.2 && Math.abs(v - 0.92) < 0.03
              ? "#ffffff"
              : "#5a1f5c";
          const spot = w === fore && Math.hypot((a - 50) / 14, (v - 0.62) / 0.1) < 1;
          if (spot) return "#ffffff";
          return mix("#ff7ac0", "#9a5cff", v * 0.9 + 0.15 * s);
        },
      };
      const paint = patterns[kind];
      const parts = {
        right: k.part("right", { pivot: [0, 0.05, 0], axis: [0, 1, 0] }),
        left: k.part("left", { pivot: [0, 0.05, 0], axis: [0, 1, 0] }),
      };
      for (const side of [1, -1]) {
        const part = side > 0 ? parts.right : parts.left;
        for (const w of [fore, hind]) {
          const shape = k.param(
            (u, v) => {
              const a = (w.a0 + u * (w.a1 - w.a0)) * DEG;
              const r = v * w.r(w.a0 + u * (w.a1 - w.a0));
              return [
                side * (w.root[0] + Math.cos(a) * r),
                w.root[1] + Math.sin(a) * r,
                -0.01 * v - (w === hind ? 0.006 : 0),
              ];
            },
            { grid: 48, normal: () => [0, 0, 1] },
          );
          k.add(shape, {
            part,
            flat: 0.12,
            weight: 1,
            color: (c) => {
              const a = w.a0 + c.u * (w.a1 - w.a0);
              const col = paint(w, a, c.v, c.noise(c.u * 8, c.v * 8, side));
              return shade(col, 1 + 0.08 * (0.5 - c.v));
            },
          });
        }
      }
      // Body: head, fuzzy thorax and a long abdomen.
      const fuzz = (c) =>
        lit(
          c,
          mix("#2a211c", "#4a3a2e", 0.5 + 0.5 * c.noise(c.p[0] * 80, c.p[1] * 80, c.p[2] * 80)),
          0.35,
        );
      k.add(k.ellipsoid(0.055, 0.13, 0.06), {
        pos: [0, 0.08, 0.02],
        weight: 2,
        pattern: false,
        color: fuzz,
      });
      k.add(k.ellipsoid(0.04, 0.24, 0.045), {
        pos: [0, -0.2, 0.02],
        weight: 2,
        pattern: false,
        color: (c) => {
          const ring = fract(c.p[1] * 22) < 0.2;
          return lit(c, ring ? "#6a5746" : "#2e241e", 0.35);
        },
      });
      k.add(k.sphere(0.05), { pos: [0, 0.24, 0.03], weight: 2, pattern: false, color: fuzz });
      for (const s of [-1, 1]) {
        eye(k, [s * 0.03, 0.255, 0.06], 0.022, [s * 0.5, 0.2, 1], { pupil: -1, weight: 3 });
        const ant = spline([
          [s * 0.02, 0.28, 0.04],
          [s * 0.07, 0.42, 0.07],
          [s * 0.14, 0.55, 0.08],
          [s * 0.2, 0.62, 0.07],
        ]);
        k.add(k.tube(ant, 0.006, { grid: 12, samples: 32 }), {
          weight: 3,
          pattern: false,
          kind: "sway",
          params: [0.2, 0.28],
          color: "#1d1712",
        });
        k.add(k.sphere(0.016), {
          pos: [s * 0.2, 0.62, 0.07],
          weight: 3,
          pattern: false,
          kind: "sway",
          params: [0.2, 0.28],
          color: "#1d1712",
        });
      }
    },
  },

  // ---- Pufferfish -------------------------------------------------------------------------
  pufferfish: {
    alive: true,
    controls: [
      { key: "puff", label: "Puff", type: "slider", default: 0.1 },
      { key: "poke", label: "Poke", type: "pulse", ease: 4.5 },
    ],
    action: { key: "poke", label: "Poke" },
    drive(t, c, out) {
      // Poked, it gulps water and swells into a round, spiky ball with a
      // wobble, holds it, then lets it out with a sputter and slims down.
      const p = c.poke;
      const s = (1 - p) * 4.5;
      const up = band(s, 0, 0.45);
      const down = easeInOut(band(s, 2.8, 4.3));
      const scare = p > 0 ? (1 - (1 - up) ** 3) * (1 - down) : 0;
      const e = Math.max(c.puff, scare);
      const offs = PUFF.dirs.map((d, i) => vec.mul(d, -PUFF.shift[i] * (1 - e)));
      offs.forEach((o, i) => (out.parts[`p${i}`] = { offset: o }));
      const flap = (0.45 + 0.4 * (p > 0 ? 1 : 0)) * Math.sin(t * 7);
      out.parts.finL = { offset: offs[PUFF.finPatch[0]], angle: flap };
      out.parts.finR = { offset: offs[PUFF.finPatch[1]], angle: -flap };
      out.parts.tail = { angle: 0.35 * Math.sin(t * 4) };
      out.grow = e;
      if (p > 0) {
        const wobble =
          0.12 * Math.sin((s - 0.3) * 22) * Math.exp(-3 * Math.max(0, s - 0.3)) * band(s, 0.3, 0.4);
        const sputter = Math.sin(Math.PI * band(s, 2.8, 4.3));
        out.body = {
          squash: wobble,
          quat: quatMul(
            quatAxisAngle([0, 1, 0], 0.18 * sputter * Math.sin(s * 31)),
            quatAxisAngle([0, 0, 1], 0.1 * sputter * Math.sin(s * 23 + 1)),
          ),
          offset: [0.05 * sputter * Math.sin(s * 17), 0, 0],
        };
      }
    },
    build(k) {
      const { dirs, R } = PUFF;
      const parts = dirs.map((d, i) => k.part(`p${i}`, { pivot: vec.mul(d, R) }));
      const cap = 41 * DEG;
      const spots = (p) => k.noise(p[0] * 7 + 3, p[1] * 7, p[2] * 7) > 0.3;
      const skin = (c) => {
        const p = c.p;
        const m = Math.acos(clamp(dot(vec.unit(p), PUFF.mouth), -1, 1));
        if (m < 0.1) return keep(m < 0.05 ? "#3a1c18" : lit(c, "#c56a4a", 0.3));
        const belly = smoothstep(-0.05, -0.35, p[1]);
        let col = mix("#d9b24e", "#f6efd8", belly);
        if (belly < 0.5 && spots(p)) col = mix("#6b4526", col, belly * 1.5);
        col = mix(col, "#f5d66a", 0.25 * smoothstep(0.2, 0.7, p[0] / R) * (1 - belly));
        return lit(c, col, 0.35, 0.35);
      };
      dirs.forEach((d, i) => {
        const e1 = vec.unit(vec.cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
        const e2 = vec.cross(d, e1);
        const dirAt = (u, v) => {
          const a = v * cap;
          const b = u * TAU;
          return vec.add(
            vec.mul(d, Math.cos(a)),
            vec.add(vec.mul(e1, Math.sin(a) * Math.cos(b)), vec.mul(e2, Math.sin(a) * Math.sin(b))),
          );
        };
        k.add(
          k.param((u, v) => vec.mul(dirAt(u, v), R), {
            grid: 28,
            normal: (u, v) => dirAt(u, v),
            thick: 0.5,
          }),
          { part: parts[i], flat: 0.2, color: skin },
        );
      });
      // Big eyes, each riding on its own patch.
      for (const e of PUFF.eyes)
        eye(k, vec.mul(e, R - 0.02), 0.14, vec.add(e, [0.4, 0, 0]), {
          part: parts[PUFF.nearest(e)],
          iris: "#f0c030",
          white: "#f7f4ea",
          pupil: 0.72,
          irisEdge: 0.4,
        });
      // Spines stand up as it puffs.
      const n = 130;
      const g = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
        const y = 1 - ((i + 0.5) / n) * 2;
        const rr = Math.sqrt(1 - y * y);
        const d = [Math.cos(g * i) * rr, y, Math.sin(g * i) * rr];
        if (dot(d, PUFF.mouth) > 0.9) continue;
        if (PUFF.eyes.some((e) => dot(d, e) > 0.94)) continue;
        if (d[0] < -0.9) continue;
        k.add(k.cone(0.024, 0.003, 0.14), {
          pos: vec.mul(d, R + 0.05),
          quat: quatFromTo([0, 1, 0], d),
          part: parts[PUFF.nearest(d)],
          weight: 2,
          flat: 0.3,
          kind: "grow",
          params: [0.35 + 0.4 * k.rand(), 0],
          color: (c) => lit(c, mix("#efe2b8", "#8a5a30", band(c.lp[1], 0.0, 0.07)), 0.25),
        });
      }
      // Fins: two pectoral fans and a tail.
      const fan = (root, dir, up, size, part, col) => {
        const side = vec.unit(vec.cross(dir, up));
        const shape = k.param(
          (u, v) => {
            const a = (u - 0.5) * 1.8;
            const r = v * size * (0.8 + 0.2 * Math.cos(u * TAU * 3));
            return vec.add(
              root,
              vec.add(vec.mul(dir, Math.cos(a) * r), vec.mul(side, Math.sin(a) * r)),
            );
          },
          { grid: 20, normal: () => up },
        );
        k.add(shape, {
          part,
          flat: 0.2,
          weight: 1.5,
          opacity: 0.85,
          pattern: false,
          color: (c) =>
            shade(mix(col, "#fff6d8", 0.4 * c.v), 0.9 + 0.2 * Math.abs(Math.sin(c.u * 40))),
        });
      };
      PUFF.fins.forEach((f, i) => {
        const root = vec.mul(f, R - 0.03);
        const part = k.part(i ? "finR" : "finL", { pivot: root, axis: [0, 1, 0] });
        fan(root, vec.unit([-0.5, 0, f[2] * 0.8]), [0, 1, 0], 0.22, part, "#e8c25a");
      });
      const tail = k.part("tail", { pivot: [-R + 0.05, 0, 0], axis: [0, 1, 0] });
      fan([-R + 0.05, 0, 0], [-1, 0, 0], [0, 0, 1], 0.32, tail, "#d9a940");
      const top = PUFF.nearest([-0.35, 1, 0]);
      fan(
        vec.mul(vec.unit([-0.45, 0.9, 0]), R - 0.02),
        vec.unit([-0.8, 0.5, 0]),
        [0, 0, 1],
        0.2,
        parts[top],
        "#d9a940",
      );
    },
  },

  // ---- Nautilus ---------------------------------------------------------------------------
  nautilus: {
    alive: true,
    controls: [{ key: "hide", label: "Hide", type: "pulse", ease: 4.4 }],
    action: { key: "hide", label: "Hide in the shell" },
    drive(t, c, out) {
      // Startled, the nautilus jets back a little and pulls its tentacles
      // in behind its hood (each shortens towards its base). It waits, peeks
      // out halfway, then slowly reaches out again.
      const on = c.hide > 0;
      const s = progress(c.hide) * 4.4;
      const pull = on
        ? easeOut(band(s, 0, 0.55)) *
          (1 - 0.45 * easeInOut(band(s, 2.0, 2.5)) - 0.55 * easeInOut(band(s, 3.0, 4.1)))
        : 0;
      const tan = NAUT.tan;
      out.parts.arms = {
        angle: 0.08 * Math.sin(t * 1.2) * (1 - pull),
        offset: vec.mul(tan, -0.09 * pull),
      };
      out.morph = [pull];
      const jet = on ? Math.sin(Math.PI * band(s, 0, 1.1)) * (1 - band(s, 0, 1.1)) : 0;
      out.body = { offset: vec.mul(tan, -0.12 * jet) };
      out.amount = 0.8;
    },
    build(k) {
      const N = NAUT;
      const t0 = N.tMax - 3.3 * Math.PI;
      const span = N.tMax - t0;
      const outward = (tt, phi) => [
        Math.cos(phi) * Math.cos(tt),
        Math.cos(phi) * Math.sin(tt),
        Math.sin(phi),
      ];
      // The shell.
      k.add(
        k.param((u, v) => N.at(t0 + u * span, 1, v * TAU), {
          grid: 120,
          normal: (u, v) => outward(t0 + u * span, v * TAU),
        }),
        {
          flat: 0.18,
          color: (c) => {
            const tt = t0 + c.u * span;
            const phi = c.v * TAU;
            const turns = tt / TAU;
            const fade = 1 - band(tt, N.tMax - 2.1, N.tMax - 0.9);
            const wav =
              0.22 * Math.sin(phi * 1.5 + turns * 3) + 0.06 * c.noise(c.p[0] * 9, c.p[1] * 9, 0);
            const s = fract(turns * 15 + wav);
            let col = "#f5ecdc";
            const lateral = Math.abs(Math.sin(phi));
            if (s < 0.45 * fade * (0.5 + 0.6 * lateral))
              col = mix("#b85a26", "#7a3416", band(Math.abs(s - 0.2), 0, 0.2));
            if (tt > N.tMax - 0.08)
              col = mix("#f2e4e8", "#e3c9d4", c.noise(c.p[0] * 30, c.p[1] * 30, 0));
            const rad = Math.hypot(c.p[0], c.p[1]);
            if (rad < 0.13 && Math.abs(c.p[2]) > 0.05) col = mix("#4a3326", col, rad / 0.13);
            return lit(c, col, 0.35, 0.45);
          },
        },
      );
      // The dark mouth of the shell.
      k.add(
        k.param((u, v) => N.at(N.tMax - 0.04, u * 0.97, v * TAU), {
          grid: 24,
          normal: () => [-Math.sin(N.tMax), Math.cos(N.tMax), 0],
        }),
        { flat: 0.3, color: (c) => mix("#2a1a12", "#5a3a28", c.u * 0.6) },
      );
      // Chambers inside: pearly walls every step, and the siphuncle
      // threading through them (Slice to see them).
      for (let i = 0; i < 16; i++) {
        const tt = N.tMax - 1.35 - i * 0.37;
        if (tt < t0 + 0.3) break;
        const s = N.sec(tt);
        const back = [Math.sin(tt), -Math.cos(tt), 0];
        k.add(
          k.param(
            (u, v) => vec.add(N.at(tt, u * 0.98, v * TAU), vec.mul(back, 0.3 * s.hw * (1 - u * u))),
            { grid: 20, normal: () => back },
          ),
          {
            flat: 0.3,
            weight: 0.8,
            color: (c) =>
              mix("#f3ebe2", "#e6d2e6", 0.5 + 0.5 * c.noise(c.p[0] * 25, c.p[1] * 25, i)),
          },
        );
      }
      k.add(
        k.tube(
          (t) => {
            const tt = t0 + 0.4 + t * (N.tMax - 1.3 - t0 - 0.4);
            const s = N.sec(tt);
            const rad = s.rc - 0.45 * s.hw;
            return [rad * Math.cos(tt), rad * Math.sin(tt), 0];
          },
          (t) => 0.004 + 0.012 * t,
          { grid: 16, samples: 128 },
        ),
        { flat: 0.3, weight: 2, color: "#b98a78" },
      );
      // The animal: a mottled hood, an eye and a bunch of short tentacles.
      const tm = N.tMax;
      const s = N.sec(tm);
      const dir = [Math.cos(tm), Math.sin(tm), 0];
      const tan = [-Math.sin(tm), Math.cos(tm), 0];
      const at = (rad, fwd, z) => vec.add(vec.add(vec.mul(dir, rad), vec.mul(tan, fwd)), [0, 0, z]);
      k.add(k.ellipsoid(0.22, 0.13, 0.25), {
        pos: at(s.rc - 0.3 * s.hw, 0.02, 0),
        quat: quatFromTo([1, 0, 0], dir),
        flat: 0.25,
        color: (c) => {
          const n = c.noise(c.p[0] * 14, c.p[1] * 14, c.p[2] * 14);
          return lit(c, n > 0.2 ? "#f1e2c8" : mix("#8a4a28", "#a8603a", 0.5 + n), 0.35, 0.2);
        },
      });
      for (const z of [-1, 1])
        eye(k, at(s.rc + 0.05 * s.hw, 0.02, z * s.ht * 0.72), 0.05, [tan[0], tan[1], z * 0.8], {
          weight: 3,
        });
      const arms = k.part("arms", { pivot: at(s.rc, 0, 0), axis: [0, 0, 1] });
      for (let i = 0; i < 26; i++) {
        const f = (i + 0.5) / 26;
        const phi = f * TAU;
        const base = vec.add(
          at(s.rc + 0.55 * s.hw * Math.cos(phi) + 0.1 * s.hw, -0.02, 0.7 * s.ht * Math.sin(phi)),
          [0, 0, 0],
        );
        const len = 0.32 + 0.18 * k.rand();
        const curl = (k.rand() - 0.5) * 0.3;
        const pts = [];
        for (let j = 0; j <= 4; j++) {
          const g = j / 4;
          pts.push(
            vec.add(
              base,
              vec.add(
                vec.mul(tan, g * len),
                vec.add(vec.mul(dir, -g * g * 0.18 + curl * g), [0, 0, Math.sin(phi) * g * 0.08]),
              ),
            ),
          );
        }
        // Each tentacle shortens towards its base on channel 0 (its rings
        // bunch up), keeping its thickness.
        const curve = spline(pts);
        const rad = (t) => 0.02 * (1 - 0.55 * t);
        k.add(k.tube(curve, rad, { grid: 16, samples: 32, caps: true }), {
          part: arms,
          flat: 0.35,
          weight: 1.4,
          kind: "morph",
          channel: 0,
          to: (c) => {
            const tt = clamp(c.t ?? 0, 0, 1);
            const off = vec.sub(c.p, curve(tt));
            return vec.add(curve(tt * 0.12), vec.mul(off, rad(tt * 0.12) / rad(tt)));
          },
          color: (c) => lit(c, fract(c.t * 7) < 0.3 ? "#e8b894" : "#f6dcc2", 0.3),
        });
      }
    },
  },

  // ---- Ladybug ----------------------------------------------------------------------------
  ladybug: {
    alive: true,
    controls: [{ key: "fly", label: "Wings", type: "toggle", default: 0, ease: 0.8 }],
    action: { key: "fly", label: "Open the wings" },
    drive(t, c, out) {
      const o = easeInOut(c.fly);
      out.parts.shellR = { angle: 1.15 * o };
      out.parts.shellL = { angle: -1.15 * o };
      const buzz = band(c.fly, 0.5, 1) * 0.3 * Math.sin(t * 24);
      const vis = band(c.fly, 0.35, 0.8);
      out.parts.wingR = { angle: buzz, visible: vis };
      out.parts.wingL = { angle: -buzz, visible: vis };
    },
    build(k) {
      const A = 0.5;
      const B = 0.42;
      const C = 0.6;
      const cz = -0.08;
      const spots = [
        [0.2, 0.12, 0.1],
        [0.3, -0.22, 0.1],
        [0.14, -0.46, 0.085],
        [0, 0.34, 0.1],
      ];
      const shell = (sgn) =>
        k.param(
          (u, v) => {
            const th = v * 98 * DEG;
            const ps = (sgn > 0 ? u : 1 + u) * Math.PI;
            return [
              A * Math.sin(th) * Math.sin(ps),
              B * Math.cos(th),
              cz + C * Math.sin(th) * Math.cos(ps),
            ];
          },
          { grid: 48 },
        );
      for (const sgn of [1, -1]) {
        const part = k.part(sgn > 0 ? "shellR" : "shellL", {
          pivot: [0, B - 0.02, cz],
          axis: [0, 0, 1],
        });
        k.add(shell(sgn), {
          part,
          flat: 0.18,
          color: (c) => {
            const x = Math.abs(c.p[0]);
            const z = c.p[2];
            if (x < 0.014 && c.p[1] > 0) return keep("#141414");
            for (const [sx, sz, sr] of spots)
              if (Math.hypot(x - sx, z - sz) < sr) return keep(lit(c, "#151515", 0.3, 0.6));
            return lit(c, "#e0261e", 0.35, 0.7);
          },
        });
        // Hind wings, folded away until it flies.
        const wing = k.part(sgn > 0 ? "wingR" : "wingL", {
          pivot: [sgn * 0.1, 0.3, 0.1],
          axis: [0, 0, 1],
        });
        const d = vec.unit([sgn * 0.75, 0.35, -0.55]);
        const side = vec.unit(vec.cross(d, [0, 1, 0]));
        k.add(
          k.param(
            (u, v) => {
              const w = 0.17 * Math.sin(Math.PI * Math.pow(u, 0.8)) * (v - 0.5) * 2;
              return vec.add(
                [sgn * 0.1, 0.3, 0.1],
                vec.add(vec.mul(d, u * 0.85), vec.mul(side, w)),
              );
            },
            { grid: 24 },
          ),
          {
            part: wing,
            flat: 0.15,
            opacity: 0.55,
            pattern: false,
            color: (c) => (Math.abs(fract(c.v * 4) - 0.5) > 0.44 ? "#6b4a2e" : "#d8c9b0"),
          },
        );
      }
      // Underside, pronotum and head.
      k.add(k.ellipsoid(0.45, 0.16, 0.56), {
        pos: [0, -0.08, cz],
        flat: 0.2,
        color: (c) => lit(c, "#1a1a1a", 0.3),
      });
      k.add(k.ellipsoid(0.33, 0.2, 0.2), {
        pos: [0, 0.05, 0.44],
        flat: 0.2,
        color: (c) =>
          Math.abs(c.lp[0]) > 0.17 && c.lp[1] > -0.05
            ? lit(c, "#f4f1e8", 0.3)
            : lit(c, "#161616", 0.3, 0.5),
      });
      k.add(k.sphere(0.17), {
        pos: [0, -0.02, 0.62],
        flat: 0.2,
        color: (c) => {
          const l = c.lp;
          if (l[2] > 0.06 && l[1] > 0.02 && Math.abs(Math.abs(l[0]) - 0.075) < 0.04)
            return keep(lit(c, "#f4f1e8", 0.3));
          return lit(c, "#141414", 0.3, 0.5);
        },
      });
      for (const s of [-1, 1]) {
        eye(k, [s * 0.1, 0.0, 0.75], 0.035, [s * 0.5, 0.2, 1], { pupil: -1, weight: 3 });
        k.add(
          k.tube(
            spline([
              [s * 0.06, 0.08, 0.74],
              [s * 0.12, 0.2, 0.84],
              [s * 0.18, 0.26, 0.88],
            ]),
            0.008,
            { grid: 10, samples: 24 },
          ),
          { weight: 3, pattern: false, kind: "sway", params: [0.25, 0.05], color: "#141414" },
        );
        k.add(k.sphere(0.02), {
          pos: [s * 0.18, 0.26, 0.88],
          weight: 3,
          pattern: false,
          color: "#141414",
        });
        for (const z of [0.25, -0.05, -0.35]) {
          k.add(
            k.tube(
              spline([
                [s * 0.2, -0.12, z],
                [s * 0.42, -0.2, z + 0.06],
                [s * 0.5, -0.38, z + 0.1],
              ]),
              0.02,
              { grid: 10, samples: 24, caps: true },
            ),
            { weight: 2, pattern: false, color: (c) => lit(c, "#1a1a1a", 0.3) },
          );
        }
      }
      k.reach([0, 1.1, cz]);
    },
  },

  // ---- Snail ------------------------------------------------------------------------------
  snail: {
    alive: true,
    controls: [{ key: "hide", label: "Hide", type: "toggle", default: 0, ease: 2.4 }],
    action: { key: "hide", label: "Hide in the shell" },
    drive(t, c, out) {
      // Slowly: the eye stalks pull in, the head glides back under the
      // shell's mouth, the foot draws in and the shell settles onto it with
      // a little rock. The shell stays where it was, in full view.
      const h = c.hide;
      const s = easeInOut(band(h, 0, 0.35));
      const hb = easeInOut(band(h, 0.12, 0.85));
      const b = easeInOut(band(h, 0.35, 1));
      const head = [-0.85 * hb, -0.26 * hb, 0];
      out.parts.stalks = { offset: [head[0], head[1] - 0.25 * s, 0], visible: 1 - s };
      out.parts.head = { offset: head, visible: 1 - easeInOut(band(h, 0.72, 0.95)) };
      // The foot draws together under the shell from both ends.
      const pull = easeInOut(band(h, 0.2, 0.9));
      out.parts.body = { offset: [-0.55 * pull, -0.01 * pull, 0] };
      out.parts.tailEnd = { offset: [0.45 * pull, -0.01 * pull, 0] };
      out.parts.shell = {
        offset: [0, -0.1 * b, 0],
        angle: 0.07 * Math.sin(Math.PI * band(h, 0.55, 1)) * (1 - band(h, 0.9, 1)),
      };
      out.amount = 1;
    },
    build(k) {
      const ground = -0.62;
      const body = k.part("body", { pivot: [0, ground, 0] });
      const head = k.part("head", { pivot: [0.6, ground, 0] });
      const stalks = k.part("stalks", { pivot: [0.95, 0, 0] });
      const shellPart = k.part("shell", { pivot: [-0.12, ground + 0.1, 0], axis: [0, 0, 1] });
      const skinCol = (c) => {
        const n = c.noise(c.p[0] * 30, c.p[1] * 30, c.p[2] * 30);
        const edge = c.p[1] < ground + 0.06 ? 0.3 : 0;
        return lit(c, mix(mix("#b0a07a", "#8a7a58", 0.5 + 0.5 * n), "#d8ccaa", edge), 0.35, 0.6);
      };
      // The foot (in two halves, so it can draw together), neck and head.
      const tailEnd = k.part("tailEnd", { pivot: [-0.5, ground, 0] });
      const cut = Math.acos(-0.07 / 0.85);
      for (const front of [true, false]) {
        const phi = (v) => (front ? v * cut : cut + v * (Math.PI - cut));
        k.add(
          k.param(
            (u, v) => {
              const f = phi(v);
              const w = u * TAU;
              return [
                0.85 * Math.cos(f),
                0.12 * Math.sin(f) * Math.cos(w),
                0.2 * Math.sin(f) * Math.sin(w),
              ];
            },
            {
              grid: 48,
              normal: (u, v) => {
                const f = phi(v);
                const w = u * TAU;
                return vec.unit([
                  Math.cos(f) / 0.85,
                  (Math.sin(f) * Math.cos(w)) / 0.12,
                  (Math.sin(f) * Math.sin(w)) / 0.2,
                ]);
              },
            },
          ),
          {
            pos: [-0.05, ground + 0.1, 0],
            part: front ? body : tailEnd,
            flat: 0.2,
            color: skinCol,
          },
        );
        // Round off the cut end (hidden inside the other half at rest), so a
        // drawn-in foot still looks like a foot.
        const xc = 0.85 * Math.cos(cut);
        const rc = Math.sin(cut);
        const sx = front ? -1 : 1;
        const dome = (u, v) => {
          const q = (v * Math.PI) / 2;
          const w = u * TAU;
          return [Math.cos(q), Math.sin(q) * Math.cos(w), Math.sin(q) * Math.sin(w)];
        };
        k.add(
          k.param(
            (u, v) => {
              const d = dome(u, v);
              return [xc + sx * 0.16 * d[0], 0.12 * rc * d[1], 0.2 * rc * d[2]];
            },
            {
              grid: 24,
              normal: (u, v) => {
                const d = dome(u, v);
                return vec.unit([(sx * d[0]) / 0.16, d[1] / 0.12, d[2] / 0.2]);
              },
            },
          ),
          {
            pos: [-0.05, ground + 0.1, 0],
            part: front ? body : tailEnd,
            flat: 0.2,
            color: skinCol,
          },
        );
      }
      k.add(
        k.tube(
          spline([
            [0.3, ground + 0.12, 0],
            [0.62, ground + 0.18, 0],
            [0.82, ground + 0.36, 0],
            [0.9, ground + 0.5, 0],
          ]),
          (t) => 0.14 - 0.03 * t,
          {
            grid: 32,
            samples: 64,
          },
        ),
        { part: head, flat: 0.2, color: skinCol },
      );
      k.add(k.sphere(0.12), {
        pos: [0.92, ground + 0.52, 0],
        part: head,
        flat: 0.2,
        color: skinCol,
      });
      for (const s of [-1, 1]) {
        k.add(
          k.tube(
            spline([
              [0.98, ground + 0.48, s * 0.06],
              [1.08, ground + 0.44, s * 0.12],
              [1.14, ground + 0.42, s * 0.14],
            ]),
            (t) => 0.025 - 0.01 * t,
            {
              grid: 12,
              samples: 24,
              caps: true,
            },
          ),
          { part: head, flat: 0.2, color: skinCol },
        );
        const top = [1.08, ground + 0.98, s * 0.16];
        k.add(
          k.tube(
            spline([[0.94, ground + 0.6, s * 0.05], [1.0, ground + 0.78, s * 0.1], top]),
            (t) => 0.026 - 0.008 * t,
            {
              grid: 12,
              samples: 32,
            },
          ),
          { part: stalks, flat: 0.2, kind: "sway", params: [0.4, ground + 0.6], color: skinCol },
        );
        eye(k, top, 0.036, [1, 0.2, s * 0.4], { part: stalks, pupil: -1, weight: 3 });
      }
      // A glistening trail.
      k.add(k.roundedBox(0.45, 0.01, 0.18, 4), {
        pos: [-0.95, ground + 0.005, 0],
        flat: 0.2,
        opacity: 0.35,
        pattern: false,
        color: (c) => mix("#dfe9f2", "#ffffff", Math.max(0, c.noise(c.p[0] * 20, 0, c.p[2] * 20))),
      });
      // The shell: a coiled tube, growing 2.4 times each turn.
      const b = Math.log(2.4) / TAU;
      const t1 = -Math.PI / 2 + 3 * TAU;
      const S = 0.44;
      const cen = [-0.12, 0.02, 0];
      const rr = (t) => S * Math.exp(b * (t - t1));
      const shellAt = (t, phi) => {
        const r = rr(t);
        const rho = 0.52 * r;
        const h = 0.32 * (S - r);
        const dir = [Math.cos(t), Math.sin(t), 0];
        return vec.add(
          cen,
          vec.add(vec.mul(dir, r + rho * Math.cos(phi)), [0, 0, h + rho * Math.sin(phi)]),
        );
      };
      const tA = t1 - 3.2 * TAU;
      k.add(
        k.param((u, v) => shellAt(tA + u * (t1 - tA), v * TAU), {
          grid: 110,
          normal: (u, v) => {
            const t = tA + u * (t1 - tA);
            const phi = v * TAU;
            return [Math.cos(phi) * Math.cos(t), Math.cos(phi) * Math.sin(t), Math.sin(phi)];
          },
        }),
        {
          part: shellPart,
          flat: 0.18,
          interior: 0.06,
          core: "#6a4a2a",
          color: (c) => {
            const t = tA + c.u * (t1 - tA);
            const phi = c.v * TAU;
            const bandz = fract((phi / TAU) * 3 + 0.1);
            let col = bandz < 0.35 ? "#8a5528" : bandz < 0.45 ? "#5a3418" : "#d9b77e";
            const growth = Math.abs(fract(t * 6) - 0.5) < 0.05;
            if (growth) col = shade(col, 0.85);
            if (t > t1 - 0.12) col = "#efe1c4";
            return lit(c, col, 0.35, 0.55);
          },
        },
      );
    },
  },

  // ---- Octopus ----------------------------------------------------------------------------
  octopus: {
    alive: true,
    options: [
      {
        key: "color",
        label: "Colour",
        type: "select",
        default: "coral",
        choices: [
          { id: "coral", label: "Coral" },
          { id: "purple", label: "Purple" },
          { id: "orange", label: "Orange" },
          { id: "teal", label: "Teal" },
        ],
      },
    ],
    controls: [{ key: "ink", label: "Ink", type: "pulse", ease: 4.5 }],
    action: { key: "ink", label: "Squirt ink" },
    drive(t, c, out) {
      // A big cloud of ink billows out behind while the octopus jets up and
      // away with its arms streaming, then it drifts back as the ink thins.
      const e = (1 - c.ink) * 4.5;
      const on = c.ink > 0;
      const jet = on
        ? (1 - (1 - band(e, 0.05, 0.55)) ** 3) * (1 - easeInOut(band(e, 1.3, 3.6)))
        : 0;
      const trail = on ? easeInOut(band(e, 0.05, 0.35)) * (1 - easeInOut(band(e, 0.9, 2.6))) : 0;
      const off = [0.12 * jet, 0.3 * jet, 0.06 * jet];
      out.parts.octo = { offset: off };
      for (let i = 0; i < 8; i++)
        out.parts[`a${i}`] = { offset: off, angle: 0.55 * trail * (1 + 0.15 * Math.sin(i * 2.1)) };
      out.grow = on ? 1 - (1 - band(e, 0.05, 1.3)) ** 2 : 0;
      out.parts.ink = {
        offset: [0, 0.18 * easeInOut(band(e, 0.4, 4.5)), 0],
        visible: on ? (1 + 0.35 * band(e, 0.2, 2)) * (1 - easeInOut(band(e, 2.8, 4.5))) : 0,
      };
      out.amount = 1;
    },
    build(k, o) {
      const skin = { coral: "#ec5b4d", purple: "#9a5ad8", orange: "#f28a2e", teal: "#2fb3a6" }[
        o.color
      ];
      const pale = mix(skin, "#fff4e8", 0.55);
      const ground = -0.45;
      const skinCol = (c) => {
        const n = c.noise(c.p[0] * 16, c.p[1] * 16, c.p[2] * 16);
        let col = shade(skin, 0.92 + 0.12 * n);
        if (n > 0.45) col = mix(col, pale, 0.5);
        return lit(c, col, 0.35, 0.4);
      };
      // Mantle and head.
      const octo = k.part("octo", { pivot: [0, 0.2, 0] });
      k.add(k.ellipsoid(0.44, 0.5, 0.44), {
        part: octo,
        pos: [0, 0.4, -0.1],
        rot: [-18, 0, 0],
        flat: 0.2,
        interior: 0.08,
        core: shade(skin, 0.7),
        kind: "breathe",
        params: [0.03, 0],
        color: skinCol,
      });
      k.add(k.ellipsoid(0.36, 0.28, 0.32), {
        part: octo,
        pos: [0, 0.08, 0.08],
        flat: 0.2,
        kind: "breathe",
        params: [0.03, 0],
        color: (c) => {
          const cheek =
            c.lp[2] > 0.15 &&
            Math.abs(Math.abs(c.lp[0]) - 0.22) < 0.07 &&
            Math.abs(c.lp[1] + 0.06) < 0.05;
          return cheek ? keep(mix(skin, "#ff9aa8", 0.6)) : skinCol(c);
        },
      });
      for (const s of [-1, 1]) {
        eye(k, [s * 0.14, 0.14, 0.33], 0.1, [s * 0.15, 0.05, 1], {
          part: octo,
          white: "#fbfbf8",
          pupil: 0.75,
          irisEdge: 0.6,
          iris: "#141418",
        });
      }
      // Eight arms that curl up at the tips and sway.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + TAU / 16;
        const d = [Math.sin(a), 0, Math.cos(a)];
        const P = (r, y) => [d[0] * r, y, d[2] * r];
        const curl = spline([
          P(0.1, 0.0),
          P(0.34, ground + 0.12),
          P(0.62, ground + 0.04),
          P(0.86, ground + 0.08),
          P(1.0, ground + 0.26),
          P(0.94, ground + 0.4),
          P(0.84, ground + 0.34),
        ]);
        const arm = k.part(`a${i}`, { pivot: P(0.1, 0), axis: [d[2], 0, -d[0]] });
        k.add(
          k.tube(curl, (t) => 0.1 * (1 - t) + 0.018, { grid: 32, samples: 96, caps: true }),
          {
            part: arm,
            flat: 0.2,
            kind: "sway",
            params: [0.25, ground + 0.1],
            color: (c) => {
              const under = dot(c.n, [0, -1, 0]) + 0.3 * dot(c.n, [-d[0], 0, -d[2]]);
              if (under > 0.35 && fract(c.t * 20) < 0.55) return keep(lit(c, "#fde7df", 0.25));
              return skinCol(c);
            },
          },
        );
      }
      // A cloud of ink behind, hidden until squirted: lumpy billows that
      // spread out from the siphon as it grows.
      const ink = k.part("ink", { pivot: [0, 0.1, -0.45] });
      const siphon = [0, 0.05, -0.4];
      const lumps = [];
      for (let i = 0; i < 12; i++) {
        const a = -1.7 + (i / 11) * 3.4 + (k.rand() - 0.5) * 0.3;
        const r = 0.3 + 0.35 * k.rand();
        lumps.push({
          c: [Math.sin(a) * r * 1.6, 0.1 + (k.rand() - 0.3) * 0.7, -0.35 - Math.cos(a) * r * 0.8],
          r: 0.22 + 0.16 * k.rand(),
        });
      }
      k.cloud({ share: 0.1, size: 3, pattern: false }, (rand, i) => {
        const L = lumps[i % lumps.length];
        const d = vec.unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
        const p = vec.add(L.c, vec.mul(d, L.r * Math.cbrt(rand())));
        p[2] = Math.max(p[2], -1);
        const far = Math.min(1, vec.len(vec.sub(p, siphon)) / 0.95);
        return {
          p,
          color: mix("#1a1428", "#5a4a70", rand() * (0.3 + 0.7 * far)),
          opacity: 0.7,
          part: ink,
          kind: "grow",
          params: [far * 0.9, 0],
        };
      });
      k.reach([0, 1.2, -0.6]);
    },
  },

  // ---- Starfish ---------------------------------------------------------------------------
  starfish: {
    alive: true,
    options: [
      {
        key: "color",
        label: "Colour",
        type: "select",
        default: "orange",
        choices: [
          { id: "orange", label: "Orange" },
          { id: "red", label: "Red" },
          { id: "purple", label: "Purple" },
          { id: "blue", label: "Blue" },
        ],
      },
    ],
    controls: [{ key: "wave", label: "Wave", type: "pulse", ease: 2.5 }],
    action: { key: "wave", label: "Wave the arms" },
    drive(t, c, out) {
      const u = 1 - c.wave;
      for (let i = 0; i < 5; i++) {
        const w = c.wave > 0 ? Math.sin(Math.PI * band(u * 1.6 - i * 0.12, 0, 0.6)) : 0;
        out.parts[`arm${i}`] = { angle: -0.05 * (1 + Math.sin(t * 0.9 + i * 1.3)) - 0.55 * w };
      }
    },
    build(k, o) {
      const base = { orange: "#f07a2a", red: "#d8392f", purple: "#8c4fcb", blue: "#2f7fd8" }[
        o.color
      ];
      const R0 = 0.24;
      const Rt = 1;
      const outline = (a) => R0 + (Rt - R0) * Math.pow(Math.abs(Math.cos(2.5 * a)), 1.35);
      const height = (rho) => 0.2 * Math.pow(Math.max(0, 1 - Math.pow(rho, 1.7)), 0.55);
      const top = (a, r) => {
        const R = outline(a);
        return height(r / R) * (1 - 0.35 * (r / Rt));
      };
      const surf = (a0, a1, r0, top1) =>
        k.param(
          (u, v) => {
            const a = a0 + u * (a1 - a0);
            const R = outline(a);
            const r = r0 + v * Math.max(0, R - r0);
            const h = top(a, r);
            return [Math.sin(a) * r, top1 ? h : -0.3 * h, Math.cos(a) * r];
          },
          { grid: 40, flip: top1 },
        );
      const tub = (c) => {
        const n = c.noise(c.p[0] * 34, c.p[1] * 34, c.p[2] * 34);
        return n > 0.5;
      };
      const color = (c) => {
        if (c.n[1] < 0) return lit(c, mix(base, "#fff0dc", 0.55), 0.2);
        const r = Math.hypot(c.p[0], c.p[2]);
        let col = mix(shade(base, 0.8), mix(base, "#ffd9a8", 0.15), band(r, 0, 1));
        const mottle = c.noise(c.p[0] * 9 + 2, c.p[1] * 9, c.p[2] * 9);
        col = shade(col, 0.92 + 0.12 * mottle);
        if (tub(c)) col = mix(col, "#ffe8c8", 0.4);
        return lit(c, col, 0.45, 0.25);
      };
      k.add(surf(0, TAU, 0, true), { flat: 0.2, color, scale: [1, 1, 1] });
      k.add(surf(0, TAU, 0, false), { flat: 0.2, color });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        const part = k.part(`arm${i}`, {
          pivot: [Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3],
          axis: [Math.cos(a), 0, -Math.sin(a)],
        });
        const s = TAU / 10;
        k.add(surf(a - s, a + s, 0.3, true), { part, flat: 0.2, color });
        k.add(surf(a - s, a + s, 0.3, false), { part, flat: 0.2, color });
        // Bumps along the arm.
        for (let j = 0; j < 7; j++) {
          const r = 0.34 + j * 0.09;
          for (const off of [-0.05, 0, 0.05]) {
            const aa = a + off / r;
            const h = top(aa, r);
            if (h < 0.02) continue;
            k.add(k.sphere(0.022 - j * 0.0015), {
              pos: [Math.sin(aa) * r, h + 0.005, Math.cos(aa) * r],
              part,
              weight: 3,
              color: (c) => lit(c, mix(base, "#fff0d0", 0.6), 0.3),
            });
          }
        }
      }
      k.add(k.sphere(0.03), {
        pos: [0.06, top(0.3, 0.07) + 0.01, 0.04],
        weight: 3,
        color: (c) => lit(c, mix(base, "#ffe38a", 0.6), 0.3),
      });
    },
  },

  // ---- Sea urchin -------------------------------------------------------------------------
  "sea-urchin": {
    alive: true,
    options: [
      {
        key: "color",
        label: "Colour",
        type: "select",
        default: "purple",
        choices: [
          { id: "purple", label: "Purple" },
          { id: "black", label: "Black" },
          { id: "red", label: "Red" },
          { id: "green", label: "Green" },
        ],
      },
    ],
    controls: [{ key: "walk", label: "Walk", type: "pulse", ease: 4.6 }],
    action: { key: "walk", label: "Wave the spines" },
    drive(t, c, out, info) {
      // The spines sweep round in waves (each tilts on its base, by one of
      // three channels a third of a cycle apart, so the wave runs round the
      // urchin), the pink tube feet reach out, and it creeps a little way
      // to the side and back.
      const on = c.walk > 0;
      const s = progress(c.walk) * 4.6;
      const amp = on ? easeInOut(band(s, 0, 0.5)) * (1 - easeInOut(band(s, 3.6, 4.5))) : 0;
      const ph = s * TAU * 1.1;
      out.morph = [0, 1, 2].map((j) => amp * Math.sin(ph - (j * TAU) / 3));
      out.morph.push(amp);
      out.body = { offset: vec.mul([0.85, 0, -0.52], 0.1 * Math.sin(Math.PI * (on ? band(s, 0.2, 4.4) : 0))) }; // prettier-ignore
    },
    build(k, o) {
      const pal = {
        purple: ["#4a1f6a", "#b46ad8"],
        black: ["#141218", "#5a4a6a"],
        red: ["#8a1c22", "#ff7a5a"],
        green: ["#2f5a2a", "#b8d86a"],
      }[o.color];
      const E = [0.5, 0.36, 0.5];
      const cy = -0.25;
      const onTest = (d) => {
        const r = 1 / Math.hypot(d[0] / E[0], d[1] / E[1], d[2] / E[2]);
        return [d[0] * r, cy + d[1] * r, d[2] * r];
      };
      k.add(k.ellipsoid(...E), {
        pos: [0, cy, 0],
        flat: 0.2,
        interior: 0.14,
        core: (c) => mix("#f0a030", "#d0701a", c.rand()),
        color: (c) => {
          const a = Math.atan2(c.lp[0], c.lp[2]) / TAU;
          const row = Math.abs(fract(a * 5) - 0.5) < 0.07;
          const dotRow = row && fract(c.lp[1] * 30) < 0.5;
          return lit(c, dotRow ? pal[1] : mix(pal[0], pal[1], 0.2), 0.35);
        },
      });
      // Spines: streaks radiating from the shell.
      const spines = [];
      const n = 460;
      const g = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
        const y = 1 - ((i + 0.5) / n) * 2;
        if (y < -0.45) continue;
        const rr = Math.sqrt(1 - y * y);
        const d = [Math.cos(g * i) * rr, y, Math.sin(g * i) * rr];
        const dir = vec.unit(vec.add(d, [(k.rand() - 0.5) * 0.15, 0.1, (k.rand() - 0.5) * 0.15]));
        spines.push({
          base: onTest(d),
          dir,
          len: 0.42 + 0.22 * k.rand() * (1 - 0.4 * Math.abs(y)),
        });
      }
      // Each spine tilts sideways (round the urchin) on its base by one of
      // channels 0 to 2, picked by its sector, so the spine stays straight.
      for (const sp of spines) {
        const a = Math.atan2(sp.base[0], sp.base[2]);
        sp.side = [Math.cos(a), 0, -Math.sin(a)];
        sp.tilt = vec.unit(vec.add(vec.mul(sp.dir, Math.cos(0.42)), vec.mul(sp.side, Math.sin(0.42)))); // prettier-ignore
        sp.ch = Math.floor((a / TAU + 0.5) * 12) % 3;
      }
      k.cloud({ share: 0.55, size: 0.55 }, (rand, i) => {
        const s = spines[i % spines.length];
        const t = rand();
        return {
          p: vec.add(s.base, vec.mul(s.dir, t * s.len)),
          dir: s.dir,
          stretch: 3,
          size: 1.2 - 0.8 * t,
          color: mix(pal[0], pal[1], t * t),
          kind: "morph",
          channel: s.ch,
          to: vec.add(s.base, vec.mul(s.tilt, t * s.len)),
        };
      });
      // Little pink tube feet between the spines: they reach out on
      // channel 3.
      k.cloud({ share: 0.02, size: 0.5 }, (rand) => {
        const d = vec.unit([rand() - 0.5, rand() * 0.9 - 0.3, rand() - 0.5]);
        const p = vec.add(onTest(d), vec.mul(d, 0.02));
        return {
          p,
          color: "#f7a8c8",
          pattern: false,
          kind: "morph",
          channel: 3,
          to: vec.add(p, vec.mul(d, 0.05 + 0.05 * rand())),
        };
      });
    },
  },

  // ---- Frog -------------------------------------------------------------------------------
  frog: {
    alive: true,
    options: [
      {
        key: "color",
        label: "Colour",
        type: "select",
        default: "green",
        choices: [
          { id: "green", label: "Green" },
          { id: "red", label: "Red" },
          { id: "blue", label: "Blue" },
          { id: "yellow", label: "Yellow" },
        ],
      },
    ],
    controls: [{ key: "snap", label: "Catch", type: "pulse", ease: FROG.secs }],
    action: { key: "snap", label: "Catch a fly" },
    drive(t, c, out) {
      // A fly buzzes in and hovers. The frog's jaw drops, its tongue shoots
      // out (channel 0), catches the fly and snaps back into the mouth; the
      // jaw shuts, the eyes sink to push the fly down (frogs swallow with
      // their eyes), and it croaks twice with its throat sac.
      const on = c.snap > 0;
      const s = progress(c.snap) * FROG.secs;
      const jaw = on ? FROG.open * easeOut(band(s, 0.92, 1.02)) * (1 - easeInOut(band(s, 1.44, 1.6))) : 0; // prettier-ignore
      const tongue = on ? easeOut(band(s, 1.0, 1.1)) * (1 - easeInOut(band(s, 1.18, 1.42))) : 0;
      out.parts.jaw = { angle: jaw };
      out.morph = [tongue];
      // The fly: in from the right on a wobbly path, a hover, then carried
      // on the tongue's tip into the mouth.
      let fp;
      if (s < 1.1) {
        const u = easeOut(band(s, 0, 0.95));
        const w = 1 - u;
        fp = vec.add(vec.add(FROG.catch, vec.mul(FROG.from, w)), [
          0.06 * Math.sin(s * 17) * (0.3 + w),
          0.05 * Math.sin(s * 23 + 1) * (0.3 + w),
          0.03 * Math.sin(s * 13),
        ]);
      } else {
        const tip = vec.add(FROG.tipRest, vec.mul(vec.sub(FROG.tipFull, FROG.tipRest), tongue));
        fp = vec.add(FROG.hinge, quatRotate(quatAxisAngle([1, 0, 0], jaw), vec.sub(tip, FROG.hinge))); // prettier-ignore
      }
      out.parts.fly = {
        offset: vec.sub(fp, FROG.catch),
        quat: quatAxisAngle([0, 1, 0], 0.4 * Math.sin(s * 9)),
        visible: on && s < 1.4 ? 1 : 0,
      };
      out.parts.eyes = { offset: [0, -0.065 * (on ? band(s, 1.65, 1.85) * (1 - band(s, 2.05, 2.3)) : 0), 0] }; // prettier-ignore
      const croak = (a) => Math.sin(Math.PI * band(s, a, a + 0.36));
      const sac = on ? Math.max(croak(2.45), croak(2.95)) : 0;
      out.parts.sac = { scale: 0.2 + 0.8 * sac, visible: sac > 0.01 ? 1 : 0 };
    },
    build(k, o) {
      const skin = { green: "#58b83a", red: "#e8452a", blue: "#2f7fe0", yellow: "#f2c52a" }[
        o.color
      ];
      const spot = { green: "#2f7a22", red: "#1a1a1a", blue: "#101830", yellow: "#1a1a1a" }[
        o.color
      ];
      const belly = "#f4ecbc";
      const breathe = { kind: "breathe", params: [0.012, 0] };
      const skinCol = (c, bellyTest) => {
        if (bellyTest && bellyTest(c)) return lit(c, belly, 0.3, 0.3);
        const n = c.noise(c.p[0] * 7 + 5, c.p[1] * 7, c.p[2] * 7);
        return lit(c, n > 0.38 && c.p[1] > -0.3 ? spot : skin, 0.35, 0.45);
      };
      k.add(k.ellipsoid(0.5, 0.42, 0.56), {
        pos: [0, -0.2, -0.1],
        rot: [-22, 0, 0],
        flat: 0.2,
        interior: 0.1,
        core: "#c9e0a0",
        ...breathe,
        color: (c) => skinCol(c, (cc) => cc.lp[2] > 0.25 && cc.lp[1] < 0.05),
      });
      // The head; below its smile the front is the lower jaw (a part hinged
      // at the back of the mouth).
      const jaw = k.part("jaw", { pivot: FROG.hinge, axis: [1, 0, 0] });
      const smileAt = (x) => -0.06 + 0.1 * (x / 0.46) ** 2;
      k.add(k.ellipsoid(0.46, 0.28, 0.4), {
        pos: [0, 0.14, 0.22],
        flat: 0.2,
        ...breathe,
        part: (c) => (c.lp[1] < smileAt(c.lp[0]) - 0.012 && c.lp[2] > -0.12 ? jaw : 0),
        color: (c) => {
          const l = c.lp;
          const smile = smileAt(l[0]);
          if (l[2] > 0.1 && Math.abs(l[1] - smile) < 0.012 && Math.abs(l[0]) < 0.36)
            return keep("#2a1a14");
          if (l[2] > 0.3 && l[1] > 0.02 && l[1] < 0.07 && Math.abs(Math.abs(l[0]) - 0.07) < 0.015)
            return keep("#1d2a14");
          if (l[2] > 0.05 && Math.abs(Math.abs(l[0]) - 0.3) < 0.07 && Math.abs(l[1] + 0.02) < 0.05)
            return keep(mix(skin, "#ff8fa0", 0.55));
          return skinCol(c, (cc) => cc.lp[1] < smile - 0.01 && cc.lp[2] > 0.0);
        },
      });
      // Inside the mouth (hidden while it is shut): the palate, the floor
      // and the tongue, which shoots out to the fly on channel 0 (built at
      // its full reach, with the jaw open).
      k.add(k.disc(1), {
        pos: [0, 0.114, 0.25],
        scale: [0.42, 1, 0.34],
        flat: 0.3,
        pattern: false,
        color: (c) => mix("#6e1c28", "#8e2a36", c.rand()),
      });
      k.add(k.disc(1), {
        part: jaw,
        pos: [0, 0.1, 0.25],
        scale: [0.41, 1, 0.33],
        flat: 0.3,
        pattern: false,
        color: (c) => mix("#b8404f", "#c9566a", c.rand()),
      });
      k.fitMorphs = false;
      const tongueR = (t) => 0.032 + 0.028 * smoothstep(0.82, 1, t);
      const axis = vec.sub(FROG.tipFull, FROG.tipRest);
      const ax = vec.unit(axis);
      const e1 = vec.unit(vec.cross(ax, [0, 1, 0]));
      const e2 = vec.cross(e1, ax);
      k.cloud({ share: 0.012, size: 1.1, pattern: false, part: jaw }, (rand) => {
        const t = Math.sqrt(rand());
        const a = rand() * TAU;
        const rr = [Math.cos(a), Math.sin(a)];
        const n = vec.add(vec.mul(e1, rr[0]), vec.mul(e2, rr[1]));
        const full = vec.add(vec.add(FROG.tipRest, vec.mul(axis, t)), vec.mul(n, tongueR(t)));
        const rest = vec.add(vec.add(FROG.tipRest, vec.mul(ax, 0.07 * t)), vec.mul(n, 0.8 * tongueR(t))); // prettier-ignore
        const light = 0.8 + 0.3 * Math.max(0, dot(n, LIGHT));
        return {
          p: rest,
          n,
          color: shade(mix("#e2677e", "#f28aa0", rand() * 0.5), light),
          kind: "morph",
          channel: 0,
          to: full,
        };
      });
      // The fly, built where the tongue catches it.
      const fly = k.part("fly", { pivot: FROG.catch });
      const F = { part: fly, weight: 12, flat: 0.3, pattern: false, fit: false };
      const at = (p) => vec.add(FROG.catch, p);
      k.add(k.ellipsoid(0.045, 0.034, 0.058), { ...F, pos: FROG.catch, color: (c) => lit(c, "#2c2c34", 0.4, 0.5) }); // prettier-ignore
      k.add(k.sphere(0.03), { ...F, pos: at([0, 0.006, 0.058]), color: "#9a2424" });
      for (const sx of [-1, 1])
        k.add(k.ellipsoid(0.07, 0.006, 0.034), {
          ...F,
          pos: at([sx * 0.06, 0.036, -0.015]),
          rot: [0, sx * 25, sx * 18],
          opacity: 0.65,
          color: "#e2ecf4",
        });
      // The throat sac that blows up for a croak (hidden at rest).
      const sac = k.part("sac", { pivot: [0, -0.02, 0.42] });
      k.add(k.sphere(0.17), {
        part: sac,
        pos: [0, -0.07, 0.47],
        flat: 0.3,
        pattern: false,
        color: (c) => lit(c, "#f6efc8", 0.3, 0.6),
      });
      const eyes = k.part("eyes", { pivot: [0, 0.35, 0.22] });
      for (const s of [-1, 1]) {
        k.add(k.sphere(0.15), {
          part: eyes,
          pos: [s * 0.24, 0.34, 0.2],
          flat: 0.2,
          ...breathe,
          color: (c) => skinCol(c),
        });
        eye(k, [s * 0.25, 0.37, 0.28], 0.12, [s * 0.35, 0.15, 1], {
          part: eyes,
          iris: "#e8b020",
          white: "#e8b020",
          pupil: 0.86,
          irisEdge: -1,
        });
        // Front legs with little toes.
        k.add(rod(k, [s * 0.26, -0.12, 0.26], [s * 0.32, -0.56, 0.4], 0.065, { caps: true }), {
          flat: 0.2,
          color: (c) => skinCol(c),
        });
        for (let j = -1; j <= 1; j++) {
          const a = s * 0.35 + j * 0.45;
          k.add(k.sphere(0.035), {
            pos: [s * 0.32 + Math.sin(a) * 0.1, -0.6, 0.44 + Math.cos(a) * 0.1],
            weight: 2,
            color: (c) => lit(c, skin, 0.3),
          });
        }
        // Folded back legs and webbed feet.
        k.add(k.ellipsoid(0.2, 0.17, 0.32), {
          pos: [s * 0.42, -0.42, -0.12],
          rot: [-10, s * 20, 0],
          flat: 0.2,
          color: (c) => skinCol(c),
        });
        k.add(k.ellipsoid(0.13, 0.03, 0.2), {
          pos: [s * 0.5, -0.6, 0.18],
          rot: [0, s * -25, 0],
          flat: 0.2,
          color: (c) => lit(c, shade(skin, 0.9), 0.3),
        });
        for (let j = -1; j <= 1; j++) {
          const a = s * -0.4 + j * 0.4;
          k.add(k.sphere(0.035), {
            pos: [s * 0.5 + Math.sin(a) * 0.2, -0.6, 0.18 + Math.cos(a) * 0.2],
            weight: 2,
            color: (c) => lit(c, skin, 0.3),
          });
        }
      }
    },
  },

  // ---- Penguin ----------------------------------------------------------------------------
  penguin: {
    alive: true,
    controls: [{ key: "flap", label: "Flap", type: "pulse", ease: 2 }],
    action: { key: "flap", label: "Flap" },
    drive(t, c, out) {
      const u = 1 - c.flap;
      const f = c.flap > 0 ? Math.abs(Math.sin(u * Math.PI * 6)) * (1 - u) : 0;
      const idle = 0.04 * Math.sin(t * 1.4);
      out.parts.flipR = { angle: 0.12 + idle + 0.9 * f };
      out.parts.flipL = { angle: -0.12 - idle - 0.9 * f };
    },
    build(k) {
      const black = "#1e2230";
      const prof = [
        [0, -0.88],
        [0.36, -0.85],
        [0.5, -0.62],
        [0.53, -0.3],
        [0.48, 0.05],
        [0.4, 0.34],
        [0.35, 0.52],
        [0.32, 0.7],
        [0.2, 0.87],
        [0, 0.92],
      ];
      k.add(k.lathe(prof, { grid: 80 }), {
        flat: 0.2,
        interior: 0.08,
        core: "#c8c8c8",
        kind: "breathe",
        params: [0.01, 0],
        color: (c) => {
          const [x, y, z] = c.p;
          const a = Math.atan2(x, z);
          const belly =
            y < 0.5 &&
            Math.abs(a) < (1.05 - 0.4 * band(y, 0.2, 0.5)) * (0.95 + 0.05 * Math.cos(y * 6));
          const face =
            y > 0.5 &&
            z > 0 &&
            (Math.hypot(x - 0.1, y - 0.64) < 0.1 || Math.hypot(x + 0.1, y - 0.64) < 0.1);
          if (belly || face) return lit(c, "#f7f7f4", 0.3, 0.2);
          if (
            Math.hypot(
              (Math.abs(a) - 1.3) / 0.3,
              (y - 0.5) / (0.07 + 0.1 * band(Math.abs(a), 1.0, 1.6)),
            ) < 1
          )
            return lit(c, mix("#ffd23a", "#ff9a2a", band(y, 0.36, 0.56)), 0.3);
          return lit(c, black, 0.3, 0.35);
        },
      });
      for (const s of [-1, 1]) {
        eye(k, [s * 0.1, 0.65, 0.29], 0.04, [s * 0.3, 0.1, 1], { pupil: -1, weight: 3 });
        k.add(k.sphere(0.045), {
          pos: [s * 0.2, 0.55, 0.28],
          scale: [1, 0.6, 0.4],
          weight: 2,
          pattern: false,
          color: "#ffadb8",
        });
        const flip = k.part(s > 0 ? "flipR" : "flipL", {
          pivot: [s * 0.42, 0.28, 0],
          axis: [0, 0, 1],
        });
        k.add(k.ellipsoid(0.06, 0.34, 0.16), {
          pos: [s * 0.5, -0.02, 0],
          rot: [0, 0, s * 12],
          part: flip,
          flat: 0.2,
          color: (c) => lit(c, c.n[0] * s < -0.2 ? "#f4f4f0" : black, 0.3, 0.3),
        });
        k.add(k.ellipsoid(0.14, 0.05, 0.22), {
          pos: [s * 0.18, -0.88, 0.14],
          rot: [0, s * -12, 0],
          flat: 0.2,
          pattern: false,
          color: (c) => lit(c, "#f28c28", 0.3),
        });
      }
      k.add(k.cone(0.075, 0.0, 0.2), {
        pos: [0, 0.56, 0.38],
        rot: [80, 0, 0],
        weight: 2,
        pattern: false,
        color: (c) => lit(c, c.lp[1] < -0.02 ? "#e0701a" : "#f7a030", 0.3, 0.3),
      });
    },
  },

  // ---- Owl --------------------------------------------------------------------------------
  owl: {
    alive: true,
    controls: [{ key: "turn", label: "Turn head", type: "pulse", ease: 3 }],
    action: { key: "turn", label: "Turn the head" },
    drive(t, c, out) {
      const u = 1 - c.turn;
      const turn =
        c.turn > 0 ? 1.7 * easeInOut(band(u, 0, 0.22)) * (1 - easeInOut(band(u, 0.62, 0.95))) : 0;
      const q = quatMul(
        quatAxisAngle([0, 1, 0], turn),
        quatAxisAngle([0, 0, 1], 0.06 * Math.sin(t * 0.7)),
      );
      out.parts.head = { quat: q };
      const ph = fract(t / 4.2);
      out.parts.lids = { quat: q, visible: Math.exp(-(((ph - 0.5) / 0.018) ** 2)) };
    },
    build(k) {
      const brown = "#8a5a34";
      const cream = "#efdcb4";
      const feathers = (c, base) => {
        const a = Math.atan2(c.p[0], c.p[2]);
        const row = Math.floor(c.p[1] * 14);
        const cu = fract((a / TAU) * 26 + (row % 2 ? 0.5 : 0));
        const cy = fract(c.p[1] * 14);
        const e = Math.hypot((cu - 0.5) * 2, cy);
        return shade(base, e > 0.9 ? 0.72 : 0.95 + 0.1 * (1 - e));
      };
      k.add(
        k.lathe(
          [
            [0, -0.72],
            [0.34, -0.68],
            [0.48, -0.45],
            [0.5, -0.1],
            [0.45, 0.14],
            [0.36, 0.3],
            [0, 0.34],
          ],
          { grid: 72 },
        ),
        {
          flat: 0.2,
          interior: 0.08,
          core: "#b88a5a",
          color: (c) => {
            const a = Math.atan2(c.p[0], c.p[2]);
            if (Math.abs(a) < 0.75) {
              const chev = Math.abs(fract(c.p[1] * 7 + Math.abs(c.p[0]) * 2) - 0.5) < 0.07;
              return lit(c, chev ? "#9a6a40" : cream, 0.3);
            }
            return lit(c, feathers(c, brown), 0.35);
          },
        },
      );
      for (const s of [-1, 1]) {
        k.add(k.ellipsoid(0.14, 0.4, 0.3), {
          pos: [s * 0.42, -0.14, -0.06],
          rot: [8, 0, s * -8],
          flat: 0.2,
          color: (c) => lit(c, fract(c.p[1] * 9 + c.p[2] * 3) < 0.25 ? "#5a3a20" : "#7a4e2c", 0.35),
        });
        for (let j = -1; j <= 1; j++)
          k.add(k.cylinder(0.025, 0.12), {
            pos: [s * 0.16 + j * 0.05, -0.74, 0.14],
            rot: [70, 0, 0],
            weight: 2,
            pattern: false,
            color: (c) => lit(c, "#e8a830", 0.3),
          });
      }
      // The branch.
      k.add(rod(k, [-0.95, -0.8, 0.12], [0.95, -0.84, 0.04], 0.075, { caps: true }), {
        flat: 0.2,
        color: (c) =>
          lit(
            c,
            mix("#5a3a22", "#7a5434", 0.5 + 0.5 * c.noise(c.p[0] * 12, c.t * 40, c.p[2] * 12)),
            0.35,
          ),
      });
      for (const [x, z, r] of [
        [-0.82, 0.22, 30],
        [0.86, 0.14, -30],
        [0.7, -0.05, -60],
      ])
        k.add(k.ellipsoid(0.12, 0.012, 0.06), {
          pos: [x, -0.74, z],
          rot: [0, r, 15],
          weight: 2,
          color: (c) => lit(c, "#5aa03a", 0.35),
        });
      // The head: it turns.
      const head = k.part("head", { pivot: [0, 0.3, 0], axis: [0, 1, 0] });
      const lids = k.part("lids", { pivot: [0, 0.3, 0], axis: [0, 1, 0] });
      const eyes = [
        [-0.15, 0.52, 0.34],
        [0.15, 0.52, 0.34],
      ];
      k.add(k.ellipsoid(0.44, 0.38, 0.4), {
        pos: [0, 0.52, 0.02],
        part: head,
        flat: 0.2,
        color: (c) => {
          const [x, y, z] = c.p;
          if (z > 0.1) {
            const d = Math.min(Math.hypot(x - 0.15, y - 0.52), Math.hypot(x + 0.15, y - 0.52));
            if (d < 0.19)
              return lit(c, d > 0.16 ? "#6a4424" : mix("#f6e6c8", cream, d / 0.19), 0.25);
          }
          return lit(c, feathers(c, brown), 0.35);
        },
      });
      for (const e of eyes) {
        eye(k, e, 0.1, [e[0] * 0.8, 0, 1], {
          part: head,
          iris: "#f5a623",
          white: "#f5a623",
          pupil: 0.8,
          irisEdge: -1,
        });
        k.add(k.sphere(0.106), {
          pos: e,
          part: lids,
          weight: 2,
          pattern: false,
          color: (c) => lit(c, "#c8a070", 0.3),
        });
      }
      k.add(k.cone(0.05, 0, 0.12), {
        pos: [0, 0.42, 0.42],
        rot: [150, 0, 0],
        part: head,
        weight: 3,
        pattern: false,
        color: (c) => lit(c, "#4a4038", 0.3, 0.4),
      });
      for (const s of [-1, 1])
        k.add(k.cone(0.09, 0.0, 0.24), {
          pos: [s * 0.24, 0.86, 0],
          rot: [0, 0, s * -25],
          part: head,
          flat: 0.2,
          color: (c) => lit(c, feathers(c, "#7a4e2c"), 0.35),
        });
    },
  },
};
