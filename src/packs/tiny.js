// Tiny world pack: viruses, bacteria, cells and other microscopic life.
// Stylised and friendly, but scientifically inspired. Loaded on demand.

import {
  mix,
  shade,
  smoothstep,
  spline,
  clamp,
  fibonacciSphere,
  quatFromTo,
  quatAxisAngle,
  quatEuler,
  quatMul,
  quatRotate,
} from "../kit.js";

const TAU = Math.PI * 2;
const PHI = (1 + Math.sqrt(5)) / 2;

// ---- Small vector helpers -------------------------------------------------------

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const keep = (c, size) => ({ c, keep: true, size });
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => x * x * (3 - 2 * x);
const easeOut = (x) => 1 - (1 - x) * (1 - x) * (1 - x);
// 0 before a, rising to 1 at b.
const band = (x, a, b) => clamp01((x - a) / (b - a));
// A pulse control's progress: 0 at the tap, 1 when done (and at rest).
const progress = (v) => (v > 0 ? 1 - v : 1);
// Per-toy memory for drive(), keyed by the control state object (new each
// time a toy loads).
const MEM = new WeakMap();
function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}
// True on the frame a pulse control fires.
function fired(m, key, v) {
  const was = m["p_" + key] ?? 0;
  m["p_" + key] = v;
  return v > was + 0.02;
}

// Fake lighting (splats are unlit): a soft key light from the upper left
// front and a highlight towards the default camera.
const LIGHT = unit([-0.45, 0.8, 0.45]);
const VIEW = unit([0.5, 0.3, 0.82]);
const HALF = unit(add(LIGHT, VIEW));
const lit = (col, n, amb = 0.66, k = 0.42) => shade(col, amb + k * Math.max(0, dot(n, LIGHT)));
const gloss = (col, n, amt = 0.4, pow = 14) =>
  mix(col, "#ffffff", amt * Math.pow(Math.max(0, dot(n, HALF)), pow));
const litGloss = (col, n, amt = 0.35) => gloss(lit(col, n), n, amt);

// A random unit vector from a random source.
function randDir(rand) {
  const z = rand() * 2 - 1;
  const a = rand() * TAU;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), z, r * Math.sin(a)];
}

// A random point inside a ball.
function randBall(rand, r) {
  return mul(randDir(rand), r * Math.cbrt(rand()));
}

// Two unit vectors perpendicular to d.
function basis(d) {
  const a = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = unit(cross(d, a));
  return [e1, cross(d, e1)];
}

// A flat-faceted surface from triangles, sampled evenly by area. Samples
// carry the triangle index as `face`.
function facets(tris, thick = 0.3) {
  const cum = [];
  const normals = [];
  let total = 0;
  const center = [0, 0, 0];
  for (const t of tris) for (const p of t) for (let i = 0; i < 3; i++) center[i] += p[i];
  for (let i = 0; i < 3; i++) center[i] /= tris.length * 3;
  const list = tris.map(([a, b, c]) => {
    let n = cross(sub(b, a), sub(c, a));
    const mid = mul(add(add(a, b), c), 1 / 3);
    if (dot(n, sub(mid, center)) < 0) {
      n = mul(n, -1);
      return [a, c, b];
    }
    return [a, b, c];
  });
  for (const [a, b, c] of list) {
    const n = cross(sub(b, a), sub(c, a));
    total += len(n) / 2;
    cum.push(total);
    normals.push(unit(n));
  }
  return {
    area: total,
    thick,
    sample(rand) {
      const x = rand() * total;
      let lo = 0;
      let hi = cum.length - 1;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (cum[m] < x) lo = m + 1;
        else hi = m;
      }
      let r1 = rand();
      let r2 = rand();
      if (r1 + r2 > 1) {
        r1 = 1 - r1;
        r2 = 1 - r2;
      }
      const [a, b, c] = list[lo];
      const p = add(a, add(mul(sub(b, a), r1), mul(sub(c, a), r2)));
      return { p, n: normals[lo], u: r1, v: r2, face: lo };
    },
  };
}

// The regular icosahedron: 12 unit vertices, 20 faces and 30 edges.
function icosahedron() {
  const v = [];
  for (const a of [-1, 1])
    for (const b of [-1, 1])
      v.push(unit([0, a, b * PHI]), unit([a, b * PHI, 0]), unit([b * PHI, 0, a]));
  const faces = [];
  const edges = [];
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++) {
      if (dot(v[i], v[j]) < 0.4) continue;
      edges.push([i, j]);
      for (let l = j + 1; l < 12; l++)
        if (dot(v[i], v[l]) > 0.4 && dot(v[j], v[l]) > 0.4) faces.push([i, j, l]);
    }
  return { v, faces, edges };
}

// Points of a geodesic sphere (icosahedron subdivided f times per edge).
function geodesic(f) {
  const ico = icosahedron();
  const seen = new Map();
  for (const [a, b, c] of ico.faces)
    for (let i = 0; i <= f; i++)
      for (let j = 0; j <= f - i; j++) {
        const l = f - i - j;
        const p = unit(add(add(mul(ico.v[a], i), mul(ico.v[b], j)), mul(ico.v[c], l)));
        const key = p.map((x) => Math.round(x * 1e4)).join(",");
        if (!seen.has(key)) seen.set(key, p);
      }
  return [...seen.values()];
}

// The two nearest of a list of unit directions to d (largest dot products).
function nearest2(points, d) {
  let b1 = -2;
  let b2 = -2;
  let i1 = 0;
  for (let i = 0; i < points.length; i++) {
    const x = dot(points[i], d);
    if (x > b1) {
      b2 = b1;
      b1 = x;
      i1 = i;
    } else if (x > b2) b2 = x;
  }
  return { i: i1, d1: b1, d2: b2 };
}

// A capsule along Y (a rod with round ends) as a lathe profile.
function capsuleProfile(halfLen, r, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    pts.push([r * Math.sin(a), -halfLen - r * Math.cos(a)]);
  }
  for (let i = 1; i < 4; i++) pts.push([r, -halfLen + (2 * halfLen * i) / 4]);
  for (let i = n; i >= 0; i--) {
    const a = (i / n) * (Math.PI / 2);
    pts.push([r * Math.sin(a), halfLen + r * Math.cos(a)]);
  }
  return pts;
}

// The rotation taking local Y to the direction `along` and local X as near
// as it can to `up`.
function frameQuat(along, up) {
  const A = unit(along);
  const q1 = quatFromTo([0, 1, 0], A);
  const x1 = quatRotate(q1, [1, 0, 0]);
  const U = unit(sub(up, mul(A, dot(up, A))));
  const ang = Math.atan2(dot(cross(x1, U), A), dot(x1, U));
  return quatMul(quatAxisAngle(A, ang), q1);
}

// A capsule along Y as a parametric surface, optionally cut open where its
// local x is above cutX: the angle range shrinks there, so no splats are
// wasted on the missing piece. Samples carry `edge`: 0 at the cut.
function capsuleSurface(k, half, R, cutX = Infinity) {
  const capLen = (Math.PI / 2) * R;
  const total = 2 * capLen + 2 * half;
  const at = (v) => {
    const s = (0.002 + v * 0.996) * total;
    if (s < capLen) return [R * Math.sin(s / R), -half - R * Math.cos(s / R)];
    if (s < capLen + 2 * half) return [R, -half + (s - capLen)];
    const a = (total - s) / R;
    return [R * Math.sin(a), half + R * Math.cos(a)];
  };
  const shape = k.param(
    (u, v) => {
      const [rho, y] = at(v);
      const t0 = rho > cutX ? Math.acos(cutX / rho) : 0;
      const th = t0 + u * (TAU - 2 * t0);
      return [rho * Math.cos(th), y, rho * Math.sin(th)];
    },
    {
      grid: 64,
      thick: R,
      normal: (u, v, p) => {
        if (p[1] < -half) return [p[0], p[1] + half, p[2]];
        if (p[1] > half) return [p[0], p[1] - half, p[2]];
        return [p[0], 0, p[2]];
      },
    },
  );
  const inner = shape.sample;
  shape.sample = (rand) => {
    const s = inner(rand);
    s.edge = Math.min(s.u, 1 - s.u);
    return s;
  };
  return shape;
}

// A random tangle of a strand inside a ball (DNA, RNA), as a smooth curve.
function tangle(rand, n, r, center = [0, 0, 0]) {
  const pts = [];
  let p = randBall(rand, r * 0.5);
  for (let i = 0; i < n; i++) {
    p = add(p, mul(randDir(rand), r * 0.55));
    if (len(p) > r) p = mul(unit(p), r * (0.6 + 0.3 * rand()));
    pts.push(add(center, p));
  }
  return spline(pts);
}

export const RECIPES = {
  // ---- Virus ------------------------------------------------------------------------
  virus: {
    alive: true,
    options: [
      { key: "color", label: "Capsid", type: "color", default: "#4fb3a9" },
      { key: "spikes", label: "Spikes", type: "color", default: "#f0605d" },
    ],
    controls: [{ key: "copy", label: "Copy", type: "pulse", ease: 4.6 }],
    action: { key: "copy", label: "Make copies" },
    // Its spikes sway at rest. A tap sends a wave rippling through them from
    // the front, and two copies bud off, drift apart and fade (channel 1).
    drive(t, c, out, info) {
      const p = progress(c.copy);
      const s = p * 4.6;
      const on = c.copy > 0;
      const body = quatAxisAngle([0.25, 1, 0.1], t * 0.22);
      out.body = { quat: body };
      const spikes = info.data?.spikes || [];
      const amp = 0.06 + (on ? 0.36 * band(s, 0, 0.3) * (1 - ease(band(s, 2.6, 4.2))) : 0);
      const wave = on ? s * 7 : t * 1.6;
      out.tokens = spikes.map((sp, i) => ({
        base: sp.root,
        quat: quatAxisAngle(sp.tilt, amp * Math.sin(wave - 3.2 * sp.from + (on ? 0 : i * 1.7))),
      }));
      // The copies (built small, just behind): out from behind it along the
      // view's diagonal and up level with it (undoing the body's turn, so
      // they leave in the same place on screen), then drifting on.
      const out1 = ease(band(s, 0.45, 1.9));
      const drift = band(s, 1.6, 4.4);
      const back = [-body[0], -body[1], -body[2], body[3]];
      for (let i = 0; i < 2; i++) {
        const dir = mul(VIRUS.diag, i ? -1 : 1);
        const go = add(mul(dir, 1.55 * out1 + 0.32 * drift), mul(VIEW, -VIRUS.behind * out1));
        out.parts[`copy${i}`] = {
          offset: quatRotate(back, go),
          quat: quatAxisAngle([0, 1, 0], (i ? -1 : 1) * 1.2 * drift),
          visible: on && s > 0.4 ? 1 : 0,
        };
      }
      out.morph = [0, ease(band(s, 2.3, 4.2))];
    },
    build(k, o) {
      const ico = icosahedron();
      const faceN = ico.faces.map(([a, b, c]) => unit(add(add(ico.v[a], ico.v[b]), ico.v[c])));
      const cells = geodesic(3);
      const penton = cells.map((p) => ico.v.some((v) => dot(v, p) > 0.999));
      // A rounded icosahedron: halfway between the solid and a sphere.
      const radius = (d) => {
        let poly = Infinity;
        for (const n of faceN) {
          const c = dot(d, n);
          if (c > 0.3) poly = Math.min(poly, 1 / c);
        }
        return 0.62 * poly + 0.4;
      };
      const capsid = o.color;
      const skin = (c) => {
        const d = unit(c.lp);
        const nb = nearest2(cells, d);
        const edge = smoothstep(0.0, 0.012, nb.d1 - nb.d2);
        const knob = smoothstep(0.97, 1, nb.d1);
        let col = penton[nb.i] ? mix(capsid, "#fff1b8", 0.55) : capsid;
        col = mix(shade(col, 0.55), mix(col, "#ffffff", 0.18 * knob), edge);
        return litGloss(col, d, 0.3);
      };
      k.add(k.radial(radius, { grid: 64 }), { flat: 0.2, color: skin });
      // Protein spikes: a stalk and a knob on every vertex and face, each a
      // token that tilts about its root.
      const spikes = [...ico.v, ...faceN];
      const W = VIEW;
      k.data = {
        spikes: spikes.map((d) => {
          const tilt = cross(d, W);
          return {
            root: mul(d, radius(d) - 0.03),
            tilt: len(tilt) > 1e-3 ? unit(tilt) : basis(d)[0],
            from: Math.acos(clamp(dot(d, W), -1, 1)),
          };
        }),
      };
      spikes.forEach((d, i) => {
        const r0 = radius(d) - 0.03;
        const q = quatFromTo([0, 1, 0], d);
        const stalk = 0.3;
        const token = { kind: "token", params: [i, 0] };
        k.add(k.cylinder(0.032, stalk, { caps: false }), {
          ...token,
          quat: q,
          pos: mul(d, r0 + stalk / 2),
          weight: 2,
          flat: 0.3,
          color: (c) => lit(mix(o.spikes, "#ffffff", 0.45), c.n),
        });
        k.add(k.ellipsoid(0.1, 0.075, 0.1), {
          ...token,
          quat: q,
          pos: mul(d, r0 + stalk + 0.04),
          weight: 2.2,
          flat: 0.3,
          color: (c) => litGloss(o.spikes, c.n, 0.45),
        });
      });
      // The genome, coiled inside (Slice shows it).
      k.add(k.tube(tangle(k.rand, 40, 0.62), 0.028, { samples: 512 }), {
        share: 0.05,
        flat: 0.4,
        pattern: false,
        color: (c) => mix("#ffd166", "#ff9f1c", 0.5 + 0.5 * Math.sin(c.t * 60)),
      });
      // Two copies, built small just behind the virus (so they draw behind
      // it as they come out; hidden until they bud off), with fewer splats.
      // They fade out as channel 1 rises.
      const at = VIRUS.home;
      const sc = VIRUS.scale;
      for (let i = 0; i < 2; i++) {
        const part = k.part(`copy${i}`, { pivot: at });
        const fade = { part, kind: "fade", channel: 1, params: [0.2, 0.75] };
        k.add(k.radial(radius, { grid: 48 }), {
          ...fade,
          pos: at,
          scale: sc,
          share: 0.09,
          flat: 0.25,
          color: skin,
        });
        for (const d of spikes) {
          const r0 = radius(d) - 0.03;
          const q = quatFromTo([0, 1, 0], d);
          k.add(k.cylinder(0.032, 0.3, { caps: false }), {
            ...fade,
            quat: q,
            pos: add(at, mul(d, (r0 + 0.15) * sc)),
            scale: sc,
            share: 0.0009,
            color: (c) => lit(mix(o.spikes, "#ffffff", 0.45), c.n),
          });
          k.add(k.ellipsoid(0.1, 0.075, 0.1), {
            ...fade,
            quat: q,
            pos: add(at, mul(d, (r0 + 0.34) * sc)),
            scale: sc,
            share: 0.0014,
            color: (c) => litGloss(o.spikes, c.n, 0.45),
          });
        }
      }
    },
  },

  // ---- Bacteriophage ---------------------------------------------------------------
  bacteriophage: {
    alive: true,
    options: [{ key: "color", label: "Head", type: "color", default: "#8f7fd1" }],
    controls: [{ key: "inject", label: "Inject", type: "pulse", ease: 4.5 }],
    action: { key: "inject", label: "Inject DNA" },
    // A tap plays the injection: the legs splay, the sheath snaps short and
    // pulls the head down, the tail tube punches through the base plate and
    // a glowing DNA strand coils out of it, then everything relaxes.
    drive(t, c, out) {
      const p = c.inject > 0 ? 1 - c.inject : 1;
      const relax = 1 - smoothstep(0.72, 0.95, p);
      const legs = smoothstep(0, 0.08, p) * relax;
      const s = smoothstep(0.03, 0.14, p) * relax;
      for (let i = 1; i < PHAGE_BANDS; i++)
        out.parts[`band${i}`] = { offset: [0, -i * PHAGE_SLIDE * s, 0] };
      out.parts.head = { offset: [0, -(PHAGE_BANDS - 1) * PHAGE_SLIDE * s, 0] };
      out.parts.tube = { offset: [0, -PHAGE_POKE * s, 0] };
      for (let i = 0; i < 6; i++) out.parts[`leg${i}`] = { angle: PHAGE_SPLAY * legs };
      // The strand grows out along its length, then fades as the tail relaxes.
      out.grow = smoothstep(0.08, 0.4, p);
      out.parts.dna = {
        offset: [0, -PHAGE_POKE * s, 0],
        visible: c.inject > 0 ? 1 - smoothstep(0.62, 0.78, p) : 0,
      };
      out.glow = [0.55, 1, 0.7, 0.25 + 1.6 * Math.min(1, 3 * c.inject)];
    },
    build(k, o) {
      const head = k.part("head");
      // Head: an icosahedron stretched along its five-fold axis.
      const ringY = 0.36;
      const tip = 0.62;
      const rr = 0.5;
      const cy = 1.02 + tip;
      const T = [0, cy + tip, 0];
      const B = [0, cy - tip, 0];
      const U = [];
      const L = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        U.push([rr * Math.cos(a), cy + ringY, rr * Math.sin(a)]);
        L.push([rr * Math.cos(a + TAU / 10), cy - ringY, rr * Math.sin(a + TAU / 10)]);
      }
      const tris = [];
      for (let i = 0; i < 5; i++) {
        const j = (i + 1) % 5;
        tris.push([T, U[i], U[j]], [U[i], L[i], U[j]], [L[i], L[j], U[j]], [B, L[j], L[i]]);
      }
      k.add(facets(tris, 0.4), {
        part: head,
        flat: 0.15,
        color: (c) => {
          const n = c.n;
          const shadeF = 0.62 + 0.5 * Math.max(0, dot(n, LIGHT)) + 0.08 * ((c.s.face % 4) - 1.5);
          let col = shade(o.color, shadeF);
          // Pale edges between the facets.
          const e = Math.min(c.s.u, c.s.v, 1 - c.s.u - c.s.v);
          if (e < 0.02) col = mix(col, "#ffffff", 0.5);
          return gloss(col, n, 0.35, 10);
        },
      });
      // The DNA packed in the head.
      k.add(
        k.tube(
          (t) => {
            const a = t * TAU * 9;
            const y = cy + (t - 0.5) * 0.9;
            const r = 0.28 * Math.sqrt(Math.max(0.05, 1 - ((y - cy) / 0.55) ** 2));
            return [r * Math.cos(a), y, r * Math.sin(a)];
          },
          0.03,
          { samples: 512 },
        ),
        {
          part: head,
          share: 0.03,
          pattern: false,
          kind: "pulse",
          params: (c) => [0.02 + 0.08 * c.t, 0],
          color: "#f7c948",
        },
      );
      // Collar.
      k.add(k.cylinder(0.1, 0.12, { caps: false }), {
        part: head,
        pos: [0, cy - tip - 0.03, 0],
        color: (c) => lit("#b9b3c9", c.n),
      });
      k.add(k.torus(0.15, 0.04), {
        part: head,
        pos: [0, cy - tip - 0.1, 0],
        weight: 1.5,
        color: (c) => litGloss("#c8c2d8", c.n),
      });
      // The tail tube (inside the sheath; shows when the sheath contracts).
      const tailTop = cy - tip - 0.12;
      const tailBot = -0.6;
      const tube = k.part("tube");
      k.add(k.cylinder(0.055, tailTop - tailBot, { caps: false }), {
        part: tube,
        pos: [0, (tailTop + tailBot) / 2, 0],
        pattern: false,
        kind: "pulse",
        params: (c) => [0.12 + 0.8 * clamp((tailTop - c.p[1]) / (tailTop - tailBot), 0, 1), 0],
        color: (c) => lit("#e8dfb0", c.n),
      });
      // The striped sheath, in bands that telescope down when it contracts.
      const bandH = (tailTop - 0.03 - (tailBot + 0.06)) / PHAGE_BANDS;
      for (let i = 0; i < PHAGE_BANDS; i++) {
        const part = i === 0 ? 0 : k.part(`band${i}`);
        const y0 = tailBot + 0.06 + i * bandH;
        k.add(k.cylinder(0.13, bandH * 0.96, { caps: true }), {
          part,
          pos: [0, y0 + bandH / 2, 0],
          flat: 0.2,
          color: (c) => {
            const f = ((c.p[1] - y0) / bandH) * 3;
            const stripe = Math.abs((f % 1) - 0.5) < 0.18;
            const base = i % 2 ? "#4fb0a0" : "#58c0af";
            return litGloss(stripe ? shade(base, 0.7) : base, c.n, 0.25);
          },
        });
      }
      // Base plate: a hexagonal plate with short pins.
      const plate = [];
      const hexR = 0.27;
      const py = tailBot;
      for (let i = 0; i < 6; i++) {
        const a0 = (i / 6) * TAU;
        const a1 = ((i + 1) / 6) * TAU;
        const p0 = [hexR * Math.cos(a0), 0, hexR * Math.sin(a0)];
        const p1 = [hexR * Math.cos(a1), 0, hexR * Math.sin(a1)];
        const up = (p, h) => [p[0], py + h, p[2]];
        plate.push(
          [up([0, 0, 0], 0.04), up(p0, 0.04), up(p1, 0.04)],
          [up([0, 0, 0], -0.04), up(p1, -0.04), up(p0, -0.04)],
          [up(p0, 0.04), up(p0, -0.04), up(p1, -0.04)],
          [up(p0, 0.04), up(p1, -0.04), up(p1, 0.04)],
        );
      }
      k.add(facets(plate, 0.04), {
        weight: 2,
        flat: 0.2,
        color: (c) => lit(c.n[1] > 0.5 ? "#f2c14e" : "#d9a534", c.n, 0.7, 0.35),
      });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6 + 1 / 12) * TAU;
        k.add(k.cone(0.03, 0.006, 0.16, { caps: false }), {
          pos: [0.14 * Math.cos(a), py - 0.1, 0.14 * Math.sin(a)],
          rot: [180, 0, 0],
          weight: 2,
          color: "#c98f2a",
        });
      }
      // Six bent tail fibres, like the legs of a lander.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + TAU / 12;
        const dir = [Math.cos(a), 0, Math.sin(a)];
        const at = (r, y) => [dir[0] * r, y, dir[2] * r];
        // Each fibre swings up and out about its root when the phage fires.
        const leg = k.part(`leg${i}`, {
          pivot: at(hexR - 0.02, py),
          axis: [-Math.sin(a), 0, Math.cos(a)],
        });
        const curve = spline([
          at(hexR - 0.02, py),
          at(0.5, py + 0.2),
          at(0.78, py + 0.32),
          at(1.02, py - 0.1),
          at(1.2, py - 0.62),
        ]);
        k.add(
          k.tube(curve, (t) => 0.03 - 0.012 * t, { grid: 32, samples: 96 }),
          {
            part: leg,
            weight: 1.6,
            flat: 0.3,
            color: (c) => lit(mix("#6f7fa8", "#a7b4d6", c.t), c.n),
          },
        );
        k.add(k.sphere(0.035), {
          part: leg,
          pos: at(0.78, py + 0.32),
          weight: 2,
          color: "#8b98c4",
        });
      }
      // The injected DNA: a glowing strand that coils out of the tail tube's
      // end below the plate (hidden until a tap grows it out).
      const dna = k.part("dna");
      const y0 = tailBot - 0.02;
      k.add(
        k.tube(
          (t) => {
            const a = t * TAU * 2.6;
            const r = 0.04 + 0.5 * Math.pow(t, 0.8);
            return [r * Math.cos(a), y0 - 0.1 * Math.sqrt(t) - 0.2 * t, r * Math.sin(a)];
          },
          0.028,
          { samples: 256 },
        ),
        {
          part: dna,
          share: 0.025,
          flat: 0.4,
          pattern: false,
          kind: "grow",
          params: (c) => [0.02 + 0.9 * c.t, 0],
          color: (c) => keep(mix("#fff6a8", "#b8ff9a", 0.5 + 0.5 * Math.sin(c.t * 50))),
        },
      );
    },
  },

  // ---- Bacterium ----------------------------------------------------------------------
  bacterium: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#62b845" }],
    controls: [
      { key: "swim", label: "Swim", type: "slider", default: 0.5 },
      { key: "divide", label: "Divide", type: "pulse", ease: 5 },
    ],
    action: { key: "divide", label: "Divide in two" },
    // A tap plays binary fission: the cell pinches in at the middle as a
    // new wall closes across it, its DNA splits between the halves, and
    // the two daughter cells come apart with a little hinge. Then they
    // slide back together and merge.
    drive(t, c, out) {
      const p = progress(c.divide);
      const pinch = ease(band(p, 0.02, 0.3)) * (1 - ease(band(p, 0.74, 0.95)));
      const apart = ease(band(p, 0.28, 0.44)) * (1 - ease(band(p, 0.6, 0.78)));
      out.morph = [pinch];
      const axis = BAC.axis;
      for (const [name, sgn] of [
        ["top", 1],
        ["bottom", -1],
      ]) {
        out.parts[name] = {
          offset: mul(axis, sgn * BAC.apart * apart),
          angle: -0.14 * apart,
        };
      }
      out.amount = 0.3 + 1.5 * c.swim;
      out.body = { offset: [0.03 * Math.sin(t * 0.7), 0.02 * Math.sin(t * 1.1), 0] };
    },
    build(k, o) {
      const { half, R, tilt } = BAC;
      const toWorld = (p) => quatRotate(tilt, p);
      const toLocal = (p) => quatRotate(BAC.untilt, p);
      // Each half turns a little about the new wall as they come apart (a
      // hinge in the view plane).
      const hinge = unit(cross(BAC.axis, VIEW));
      const top = k.part("top", { pivot: [0, 0, 0], axis: hinge });
      const bottom = k.part("bottom", { pivot: [0, 0, 0], axis: mul(hinge, -1) });
      const side = (x) => (x >= 0 ? top : bottom);
      // The rod: a capsule along X.
      const rod = quatMul(tilt, quatEuler(0, 0, -90));
      const body = o.color;
      k.add(k.lathe(capsuleProfile(half, R), { grid: 64 }), {
        quat: rod,
        flat: 0.35,
        part: (c) => side(c.lp[1]),
        // Lathe y runs along the rod (rod-local x); lathe x is rod-local -y.
        to: (c) => toWorld(fission([c.lp[1], -c.lp[0], c.lp[2]])),
        color: (c) => {
          const spot = c.fbm(c.p[0] * 5, c.p[1] * 5, c.p[2] * 5);
          const col = mix(body, shade(body, 0.8), smoothstep(-0.2, 0.5, spot));
          return litGloss(col, c.n, 0.35);
        },
      });
      // Inside: ribosome speckles and a tangled nucleoid (Slice shows them);
      // each daughter gets its share, and half of the DNA.
      k.cloud({ share: 0.03, size: 0.6, pattern: false }, (rand) => {
        const x = (rand() * 2 - 1) * (half + R * 0.5);
        const rr = R * 0.85 * Math.sqrt(rand());
        const a = rand() * TAU;
        const at = [x, rr * Math.cos(a), rr * Math.sin(a)];
        return {
          p: toWorld(at),
          to: toWorld(inside(at)),
          part: side(x),
          color: rand() < 0.5 ? "#2f6b3a" : "#b8e6a0",
          opacity: 0.9,
        };
      });
      const nuc = tangle(k.rand, 30, 0.22);
      const strand = (t) => nuc(t).map((v, i) => (i === 0 ? v * 2.2 : v));
      k.add(
        k.tube((t) => toWorld(strand(t)), 0.018, { samples: 512 }),
        {
          share: 0.03,
          pattern: false,
          part: (c) => side(toLocal(c.p)[0]),
          to: (c) => toWorld(inside(toLocal(c.p))),
          color: "#7a5cc7",
        },
      );
      // Flagella: long whips trailing behind, rippling as the cell swims.
      // They grow from the rear half, so they go with that daughter.
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + 0.4;
        const x0 = -half * (0.2 + 0.8 * ((i * 0.37) % 1));
        const ring = [0, Math.cos(a), Math.sin(a)];
        const base = [x0 - (i % 2 ? 0 : 0.25), R * 0.95 * ring[1], R * 0.95 * ring[2]];
        const Lf = 1.15 + 0.35 * k.rand();
        const ph = k.rand() * TAU;
        const spread = 0.28 + 0.12 * k.rand();
        const curve = (t) => {
          const s = t * Lf;
          const amp = 0.09 * smoothstep(0, 0.25, t);
          const w = (s / 0.6) * TAU + ph;
          const fan = spread * s * (0.6 + 0.4 * t);
          return toWorld([
            base[0] - s,
            base[1] + ring[1] * fan + amp * Math.cos(w),
            base[2] + ring[2] * fan + amp * Math.sin(w),
          ]);
        };
        // The root follows the rear pole as the cell pinches.
        const shift = sub(fission(base), base);
        k.add(
          k.tube(curve, (t) => 0.03 - 0.012 * t, { grid: 32, samples: 160 }),
          {
            weight: 1.5,
            flat: 0.35,
            part: bottom,
            to: (c) => add(c.p, toWorld(shift)),
            color: (c) => lit(mix("#b7cf7a", "#7f9c45", c.t), c.n, 0.7, 0.35),
          },
        );
      }
      // Pili: a fine fuzz of short hairs all over.
      k.cloud({ share: 0.05, size: 0.45, pattern: false }, (rand) => {
        const x = (rand() * 2 - 1) * (half + R);
        const a = rand() * TAU;
        let nrm = [0, Math.cos(a), Math.sin(a)];
        let p = [x, R * nrm[1], R * nrm[2]];
        if (Math.abs(x) > half) {
          const d = unit([Math.sign(x) * (Math.abs(x) - half), nrm[1] * R, nrm[2] * R]);
          nrm = d;
          p = add([Math.sign(x) * half, 0, 0], mul(d, R));
        }
        const l = 0.02 + 0.05 * rand();
        const nw = toWorld(nrm);
        const tip = add(toWorld(p), mul(nw, l));
        return {
          p: tip,
          to: add(toWorld(fission(p)), mul(nw, l)),
          part: side(x),
          dir: nw,
          stretch: 3,
          color: mix(body, "#f4ffe0", 0.55),
          opacity: 0.8,
        };
      });
    },
  },

  // ---- Red blood cell ----------------------------------------------------------------
  "red-blood-cell": {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#d8323f" }],
    controls: [{ key: "sickle", label: "Sickle", type: "pulse", ease: 4 }],
    action: { key: "sickle", label: "Sickle and relax" },
    // A tap plays sickling at low oxygen: the soft disc stretches, curls
    // into a stiff crescent with pointed ends, holds, then relaxes back.
    drive(t, c, out) {
      const p = progress(c.sickle);
      const w = ease(band(p, 0.02, 0.3)) * (1 - ease(band(p, 0.62, 0.95)));
      // A small give as it stiffens, and a wobble as it springs back.
      const give = 0.05 * Math.sin(band(p, 0.3, 0.45) * Math.PI);
      const back = 0.07 * Math.sin(band(p, 0.95, 1) * Math.PI * 2) * (1 - band(p, 0.95, 1));
      out.morph = [w - give - back];
      out.body = {
        quat: quatMul(
          quatAxisAngle([0, 1, 0], 0.25 * Math.sin(t * 0.4)),
          quatAxisAngle([1, 0, 0.3], 0.1 * Math.sin(t * 0.7)),
        ),
      };
    },
    build(k, o) {
      // The biconcave profile of a red cell (Evans and Fung).
      const h = (r) =>
        0.5 * Math.sqrt(Math.max(0, 1 - r * r)) * (0.207 + 2.003 * r * r - 1.123 * r ** 4);
      const prof = [];
      const N = 22;
      for (let i = 0; i <= N; i++) {
        const r = Math.sin((i / N) * (Math.PI / 2));
        prof.push([r, -h(r)]);
      }
      for (let i = N - 1; i >= 0; i--) {
        const r = Math.sin((i / N) * (Math.PI / 2));
        prof.push([r, h(r)]);
      }
      const q = quatFromTo([0, 1, 0], unit([0.25, 0.8, 0.55]));
      // The sickle: the disc's x runs along a crescent (an arc of radius
      // RC through +-SPAN), its z across it, tapering to points at the ends;
      // the dimples fill out into an even, stiff thickness.
      const RC = 1.1;
      const SPAN = 1.36;
      const sickle = (lp) => {
        const [x, y, z] = lp;
        const r = Math.hypot(x, z);
        const a = clamp(x, -1, 1);
        const chord = Math.sqrt(Math.max(1e-4, 1 - a * a));
        const b = clamp(z / chord, -1.2, 1.2);
        const phi = a * SPAN;
        const taper = Math.pow(chord, 1.1);
        const across = 0.38 * b * taper;
        const cx = (RC + across) * Math.sin(phi);
        const cz = (RC + across) * Math.cos(phi) - RC * 0.78;
        const thick = 0.24 * Math.sqrt(Math.max(0, 1 - Math.min(1, b * b))) * taper + 0.01;
        const hy = Math.max(0.02, h(Math.min(r, 0.999)));
        return quatRotate(q, [cx, clamp(y / hy, -1.2, 1.2) * thick, cz]);
      };
      const base = o.color;
      k.add(k.lathe(prof, { grid: 96, thick: 0.1 }), {
        quat: q,
        flat: 0.3,
        interior: 0.1,
        core: shade(base, 0.75),
        to: (c) => sickle(c.lp),
        color: (c) => {
          const r = Math.hypot(c.lp[0], c.lp[2]);
          const thin = smoothstep(0.62, 0.05, r);
          let col = mix(base, mix(base, "#ff9a8f", 0.55), thin);
          col = mix(col, shade(base, 0.72), smoothstep(0.86, 1, r) * 0.6);
          col = shade(col, 1 + 0.05 * c.fbm(c.p[0] * 4, c.p[1] * 4, c.p[2] * 4));
          return litGloss(col, c.n, 0.4);
        },
      });
    },
  },

  // ---- Neuron ------------------------------------------------------------------------
  neuron: {
    alive: true,
    options: [{ key: "color", label: "Cell", type: "color", default: "#b565d8" }],
    controls: [
      { key: "signal", label: "Signal", type: "slider", default: 0.6 },
      { key: "fire", label: "Fire", type: "pulse", ease: 3 },
    ],
    action: { key: "fire", label: "Fire a signal" },
    // A tap fires an action potential: a bright spark gathers in the cell
    // body, races down the axon with a short tail and bursts at the terminals.
    drive(t, c, out) {
      const p = c.fire > 0 ? 1 - c.fire : 1;
      out.glow = [1, 0.86, 0.35, 0.25 + 1.1 * c.signal + 1.6 * c.fire];
      out.amount = 1;
      const axon = neuronAxon();
      const start = axon(0);
      const on = c.fire > 0 ? 1 : 0;
      NEURON_SPARKS.forEach((lag, i) => {
        const s = smoothstep(0.06 + lag, 0.56 + lag, p);
        const shown = smoothstep(0, 0.05, p) * (1 - smoothstep(0.56 + lag, 0.66 + lag, p));
        out.parts[`spark${i}`] = {
          offset: sub(axon(s), start),
          visible: on * shown * (1 + 0.5 * (1 - smoothstep(0, 0.14, p))),
        };
      });
      const burst = smoothstep(0.54, 0.62, p) * (1 - smoothstep(0.72, 0.97, p));
      out.parts.burst = { visible: on * burst * 1.8 };
    },
    build(k, o) {
      const cell = o.color;
      const soma = [-0.6, 0.42, 0];
      const pulse = (a) => ({ kind: "pulse", params: [a, 0] });
      // Cell body with a nucleus inside (Slice shows it).
      k.add(k.ellipsoid(0.32, 0.27, 0.26), {
        pos: soma,
        rot: [0, 0, -30],
        flat: 0.2,
        interior: 0.1,
        core: mix(cell, "#ffffff", 0.35),
        ...pulse(0.11),
        color: (c) =>
          litGloss(mix(cell, "#e9a6ff", 0.2 * c.fbm(c.p[0] * 6, c.p[1] * 6, c.p[2] * 6)), c.n),
      });
      k.add(k.sphere(0.12), {
        pos: add(soma, [0.02, 0.02, 0.04]),
        weight: 1.5,
        pattern: false,
        color: (c) => lit("#5d2e8a", c.n),
      });
      // Dendrites: branching tubes spreading from the body.
      const dendrites = [];
      const grow = (start, dir, length, r0, depth, dist) => {
        const r1 = Math.max(0.01, r0 * 0.62);
        const pts = [start];
        let p = start;
        let d = dir;
        for (let i = 1; i <= 3; i++) {
          d = unit(add(d, mul(randDir(k.rand), 0.35)));
          p = add(p, mul(d, length / 3));
          pts.push(p);
        }
        dendrites.push({ pts, r0, r1, dist, length });
        if (depth <= 0) return;
        const n = depth >= 2 ? 2 : 2 + (k.rand() < 0.4 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const [e1, e2] = basis(d);
          const a = k.rand() * TAU;
          const side = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a)));
          const nd = unit(add(d, mul(side, 0.55 + 0.3 * k.rand())));
          grow(p, nd, length * (0.62 + 0.15 * k.rand()), r1, depth - 1, dist + length);
        }
      };
      const dirs = [
        [-1, 0.2, 0.1],
        [-0.6, 0.9, -0.2],
        [0.1, 1, 0.2],
        [0.6, 0.7, -0.3],
        [-0.8, -0.6, 0.3],
        [-0.2, -0.9, -0.3],
        [-0.4, 0.2, 0.9],
      ];
      for (const d of dirs) {
        const dd = unit(d);
        grow(add(soma, mul(dd, 0.24)), dd, 0.46 + 0.1 * k.rand(), 0.068, 2, 0);
      }
      const maxDist = Math.max(...dendrites.map((b) => b.dist + b.length));
      for (const b of dendrites) {
        k.add(
          k.tube(spline(b.pts), (t) => b.r0 + (b.r1 - b.r0) * t, { grid: 12, samples: 32 }),
          {
            weight: 1.3,
            flat: 0.3,
            kind: "pulse",
            params: (c) => [0.1 * (1 - (b.dist + c.t * b.length) / maxDist), 0],
            color: (c) => lit(mix(cell, "#e3b3f5", (b.dist + c.t * b.length) / maxDist), c.n),
          },
        );
      }
      // The axon: a long S-curve down to the right, sheathed in myelin.
      const axon = neuronAxon();
      k.add(k.tube(axon, 0.036, { grid: 24, samples: 256 }), {
        flat: 0.3,
        kind: "pulse",
        params: (c) => [0.13 + 0.75 * c.t, 0],
        color: (c) => lit(mix(cell, "#8f45b5", 0.3), c.n),
      });
      // Axon hillock.
      k.add(k.cone(0.09, 0.03, 0.14, { caps: false }), {
        pos: add(soma, [0.25, -0.16, 0]),
        quat: quatFromTo([0, 1, 0], [0.8, -0.5, 0]),
        ...pulse(0.12),
        color: (c) => lit(cell, c.n),
      });
      // Myelin sheath segments with bare nodes between them.
      const segs = 5;
      for (let i = 0; i < segs; i++) {
        const t0 = 0.07 + (i / segs) * 0.86 + 0.012;
        const t1 = 0.07 + ((i + 1) / segs) * 0.86 - 0.012;
        const seg = (s) => axon(t0 + (t1 - t0) * s);
        k.add(
          k.tube(seg, (s) => 0.1 * Math.pow(Math.max(0.02, Math.sin(Math.PI * s)), 0.3), {
            grid: 32,
            samples: 64,
          }),
          {
            flat: 0.25,
            kind: "pulse",
            params: (c) => [0.13 + 0.75 * (t0 + (t1 - t0) * c.t), 0],
            color: (c) => litGloss("#f6d98c", c.n, 0.45),
          },
        );
      }
      // Axon terminals: a fan of short branches ending in bulbs.
      const end = axon(1);
      const tipDir = unit(sub(axon(1), axon(0.97)));
      for (let i = 0; i < 5; i++) {
        const a = (i - 2) * 0.42;
        const d = unit(quatRotate(quatAxisAngle([0, 0.2, 1], a), tipDir));
        const d2 = unit(add(d, mul(randDir(k.rand), 0.3)));
        const pts = [end, add(end, mul(d, 0.16)), add(add(end, mul(d, 0.26)), mul(d2, 0.13))];
        k.add(
          k.tube(spline(pts), (t) => 0.03 - 0.01 * t, { grid: 16, samples: 32 }),
          {
            weight: 1.4,
            kind: "pulse",
            params: (c) => [0.88 + 0.08 * c.t, 0],
            color: (c) => lit(cell, c.n),
          },
        );
        k.add(k.sphere(0.058), {
          pos: pts[2],
          weight: 1.8,
          kind: "pulse",
          params: [0.97, 0],
          color: (c) => litGloss("#ff8fc8", c.n, 0.5),
        });
      }
      // The signal (hidden until a tap): a spark and its fading tail that
      // run down the axon, and a spray of light round the terminals.
      const start = axon(0);
      NEURON_SPARKS.forEach((lag, i) => {
        const part = k.part(`spark${i}`);
        const f = 1 - i / NEURON_SPARKS.length;
        k.cloud({ share: 0.012 * f, size: 1.5 * f, pattern: false }, (rand, j, n) => {
          const halo = j < n * 0.35;
          return {
            p: add(start, randBall(rand, halo ? 0.2 * f : 0.075 * f)),
            color: halo ? "#fff08a" : "#ffffff",
            opacity: halo ? 0.45 : 1,
            size: halo ? 2.2 : 1,
            part,
          };
        });
      });
      const burst = k.part("burst");
      k.cloud({ share: 0.01, size: 1.1, pattern: false }, (rand, j, n) => {
        const d = unit(add(tipDir, mul(randDir(rand), 0.9)));
        const r = 0.05 + 0.32 * Math.pow(rand(), 0.7);
        return {
          p: add(end, mul(d, r)),
          color: mix("#fff4c2", "#ff9fd2", rand()),
          opacity: 0.55 + 0.4 * (1 - r / 0.37),
          kind: "twinkle",
          params: [0.6, rand() * TAU],
          part: burst,
        };
      });
    },
  },

  // ---- Astrocyte ---------------------------------------------------------------------
  astrocyte: {
    alive: true,
    options: [{ key: "color", label: "Cell", type: "color", default: "#35c79a" }],
    controls: [{ key: "wave", label: "Calcium wave", type: "pulse", ease: 4.4 }],
    action: { key: "wave", label: "Send a calcium wave" },
    // A tap sends a calcium wave: a bright front of light spreads from the
    // cell body out along every arm to the tips and the end-feet (channel
    // 0), and the blood vessel they hold widens for a moment (channel 1).
    // At rest, faint waves pass now and then.
    drive(t, c, out) {
      const p = progress(c.wave);
      const s = p * 4.4;
      const on = c.wave > 0;
      // Idle waves start again from the body a while after a tap.
      const m = mem(c);
      if (on || m.since === undefined) m.since = t;
      const idle = (((t - m.since) * 0.11) % 1.9) - 0.5;
      out.morph = [
        on ? -0.12 + 1.45 * band(s, 0, 2.7) : idle,
        on ? ease(band(s, 1.8, 2.6)) * (1 - ease(band(s, 3, 4.2))) : 0,
      ];
      const strength = on ? 0.95 * (1 - band(s, 2.7, 3.4) * 0.6) : 0.3;
      out.glow = [0.5, 0.95, 0.45, strength];
    },
    build(k, o) {
      const cell = o.color;
      const glow = mix(cell, "#e8fff4", 0.55);
      // The wave's place along the cell (0 at the body, 1 at the far tips).
      const wave = (at, width = 0.1) => ({ kind: "band", channel: 0, params: [at, width] });
      k.add(
        k.radial((d) => 0.24 + 0.03 * k.noise(d[0] * 3, d[1] * 3, d[2] * 3), { grid: 32 }),
        {
          flat: 0.2,
          interior: 0.15,
          core: shade(cell, 0.6),
          ...wave(0, 0.14),
          color: (c) => litGloss(glow, c.n, 0.4),
        },
      );
      // A blood vessel beneath, which some processes hold with their end-feet.
      const vy = -0.78;
      const vz = -0.15;
      const vessel = spline([
        [-1.1, vy - 0.05, vz - 0.1],
        [-0.4, vy + 0.03, vz],
        [0.4, vy - 0.02, vz + 0.05],
        [1.1, vy + 0.06, vz - 0.05],
      ]);
      // It widens as the wave reaches the end-feet.
      k.add(k.tube(vessel, 0.15, { grid: 48, samples: 64 }), {
        pattern: false,
        flat: 0.3,
        channel: 1,
        to: (c) => add(c.p, mul(sub(c.p, vessel(c.t)), 0.35)),
        color: (c) => litGloss(mix("#d8465a", "#f07b8a", 0.3 + 0.2 * c.noise(c.t * 9, 0, 0)), c.n),
      });
      const branches = [];
      const grow = (start, dir, length, r0, depth, dist) => {
        const r1 = Math.max(0.007, r0 * 0.4);
        const pts = [start];
        let p = start;
        let d = dir;
        for (let i = 1; i <= 3; i++) {
          d = unit(add(d, mul(randDir(k.rand), 0.3)));
          p = add(p, mul(d, length / 3));
          pts.push(p);
        }
        branches.push({ pts, r0, r1, dist, length });
        if (depth <= 0) return;
        const curve = spline(pts);
        const n = 2 + (k.rand() < 0.5 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const at = 0.35 + 0.55 * k.rand();
          const nd = unit(add(d, mul(randDir(k.rand), 0.9)));
          const r = r0 + (r1 - r0) * at;
          grow(curve(at), nd, length * 0.45, r * 0.8, depth - 1, dist + length * at);
        }
      };
      const dirs = fibonacciSphere(18).filter((d) => d[1] > -0.5);
      for (const d0 of dirs) {
        const d = unit(add(d0, mul(randDir(k.rand), 0.2)));
        grow(mul(d, 0.18), d, 0.6 + 0.25 * k.rand(), 0.065, 2, 0);
      }
      // Three stout processes reach down to the vessel and spread into end-feet.
      for (const x of [-0.5, 0.05, 0.55]) {
        const foot = vessel((x + 1.1) / 2.2);
        const top = add(foot, [0, 0.15, 0]);
        const pts = [[x * 0.15, -0.12, 0.02], [x * 0.5, -0.4, vz * 0.3], top];
        branches.push({ pts, r0: 0.05, r1: 0.035, dist: 0, length: 0.7, feet: true });
      }
      const far = Math.max(...branches.map((b) => b.dist + b.length));
      for (const x of [-0.5, 0.05, 0.55]) {
        const foot = vessel((x + 1.1) / 2.2);
        k.add(k.ellipsoid(0.12, 0.05, 0.13), {
          pos: add(foot, [0, 0.14, 0]),
          weight: 1.2,
          flat: 0.2,
          ...wave(0.7 / far + 0.04),
          color: (c) => litGloss(glow, c.n, 0.3),
        });
      }
      for (const b of branches) {
        k.add(
          k.tube(spline(b.pts), (t) => b.r0 + (b.r1 - b.r0) * t, { grid: 10, samples: 24 }),
          {
            weight: 1.2,
            flat: 0.3,
            kind: "band",
            channel: 0,
            params: (c) => [(b.dist + c.t * b.length) / far, 0.1],
            color: (c) => lit(mix(glow, cell, clamp((b.dist + c.t * b.length) / 1.1, 0, 1)), c.n),
          },
        );
      }
      // A soft glow of tiny sparks around the tips.
      k.cloud({ share: 0.004, size: 0.8, pattern: false }, (rand) => {
        const b = branches[Math.floor(rand() * branches.length)];
        const p = spline(b.pts)(0.85 + 0.15 * rand());
        return {
          p: add(p, mul(randDir(rand), 0.03)),
          color: "#eafff6",
          opacity: 0.9,
          kind: "twinkle",
          params: [0.9, rand() * TAU],
        };
      });
    },
  },

  // ---- Animal cell ---------------------------------------------------------------------
  "animal-cell": {
    alive: true,
    options: [
      { key: "color", label: "Membrane", type: "color", default: "#f29ab8" },
      { key: "cutaway", label: "Cutaway", type: "switch", default: true },
    ],
    controls: [{ key: "divide", label: "Divide", type: "pulse", ease: 5.2 }],
    action: { key: "divide", label: "Divide in two" },
    // A tap plays cell division: the nucleus splits into two (channel 0),
    // then the cell pinches in two across the middle and shares out its
    // parts (channel 1); after a moment the two cells flow back into one.
    drive(t, c, out) {
      const p = progress(c.divide);
      const nuc = ease(band(p, 0.02, 0.26)) * (1 - ease(band(p, 0.78, 0.96)));
      const pinch = ease(band(p, 0.14, 0.42)) * (1 - ease(band(p, 0.6, 0.82)));
      out.morph = [nuc, pinch];
      // The living cell swells a little, slowly, at rest.
      out.body = { squash: 0.012 * Math.sin(t * 1.3) };
    },
    build(k, o) {
      const mem = o.color;
      const cut = o.cutaway;
      // The open wedge faces the viewer (upper right front).
      const inWedge = (p) => cut && p[0] > 0 && p[1] > 0 && p[2] > 0;
      // Division: the membrane splits into two cells across the view. The
      // daughters (drawn a little small) reach just past the resting cell,
      // still inside the view, so they are left out of the fit.
      k.fitMorphs = false;
      const pinch = { channel: 1, to: (c) => cellSkin(c.p) };
      const inner = { channel: 1, to: (c) => cellInside(c.p) };
      const shift = (at) => {
        const d = sub(cellPart(at), at);
        return { channel: 1, to: (c) => add(c.p, d) };
      };
      const radius = (d) => 1 + 0.035 * k.noise(d[0] * 2.2 + 3, d[1] * 2.2, d[2] * 2.2);
      // A translucent membrane; with the cutaway, a wedge is taken out.
      k.add(k.radial(radius, { grid: 64 }), {
        ...pinch,
        flat: 0.3,
        opacity: 0.62,
        share: 0.36,
        color: (c) => {
          if (inWedge(c.p)) return null;
          const rim = 1 - Math.abs(dot(c.n, VIEW));
          const edge = cut ? Math.min(...c.p.map((x) => (x > 0 ? x : 9))) : 9;
          if (edge < 0.035) return keep(shade(mem, 0.7));
          return mix(lit(mem, c.n, 0.8, 0.25), "#ffffff", 0.3 * rim * rim);
        },
      });
      // Cytoplasm: a faint milky fill.
      k.cloud({ share: 0.05, size: 2.4, pattern: false }, (rand) => {
        const p = randBall(rand, 0.95);
        if (inWedge(p)) return null;
        return {
          p,
          color: mix("#fff0f4", "#f9d3e1", rand()),
          opacity: 0.06,
          channel: 1,
          to: cellInside(p),
        };
      });
      // The nucleus, cut open by the wedge to show chromatin and the nucleolus.
      const { nc, NR } = CELL;
      const split = { channel: 0, to: (c) => nucleusSplit(c.p) };
      k.add(k.sphere(NR), {
        ...split,
        pos: nc,
        weight: 1.5,
        flat: 0.2,
        interior: 0.4,
        pattern: false,
        core: (c) =>
          inWedge(c.p)
            ? null
            : mix("#7a4db3", "#c3a1ea", 0.5 + 0.6 * c.fbm(c.p[0] * 12, c.p[1] * 12, c.p[2] * 12)),
        color: (c) => {
          if (inWedge(c.p)) return null;
          const pore = c.noise(c.lp[0] * 26, c.lp[1] * 26, c.lp[2] * 26) > 0.4;
          return litGloss(pore ? "#dcc6f7" : "#8a57c6", c.n, 0.4);
        },
      });
      // The nucleolus: each new nucleus gets one.
      const nco = add(nc, [0.1, 0.1, 0.1]);
      k.add(k.sphere(0.15), {
        channel: 0,
        to: (c) => nucleolusSplit(c.p, nco, 0.15),
        pos: nco,
        weight: 1.5,
        interior: 0.5,
        pattern: false,
        core: (c) => (inWedge(c.p) ? null : "#3b1b63"),
        color: (c) => (inWedge(c.p) ? null : lit("#4a2475", c.n)),
      });
      // Rough ER: folded sheets wrapped round the nucleus, dotted with ribosomes.
      for (let i = 0; i < 3; i++) {
        const R0 = NR + 0.08 + i * 0.07;
        k.add(
          k.param(
            (u, v) => {
              const th = 0.3 * Math.PI + v * 0.62 * Math.PI;
              const ph = 0.15 * Math.PI + u * 1.3 * Math.PI;
              const r = R0 + 0.022 * Math.sin(ph * 9 + i) + 0.015 * Math.sin(th * 13);
              return add(nc, [
                r * Math.sin(th) * Math.cos(ph),
                r * Math.cos(th),
                r * Math.sin(th) * Math.sin(ph),
              ]);
            },
            { grid: 40, thick: 0.02 },
          ),
          {
            channel: 0,
            to: (c) => erSplit(c.p),
            flat: 0.2,
            pattern: false,
            color: (c) => {
              if (inWedge(c.p) || len(c.p) > 0.93) return null;
              return c.rand() < 0.16 ? keep("#1f3f7a", 0.8) : lit("#6fa5e8", c.n, 0.8, 0.3);
            },
          },
        );
      }
      // Smooth ER: a few winding tubes.
      for (let i = 0; i < 4; i++) {
        const start = add(nc, mul(unit([-0.7 + 0.2 * i, -0.6, 0.4 - 0.3 * i]), NR + 0.25));
        const pts = [start];
        let p = start;
        for (let j = 0; j < 5; j++) {
          p = add(p, mul(randDir(k.rand), 0.12));
          if (len(p) > 0.85) p = mul(unit(p), 0.8);
          pts.push(p);
        }
        k.add(k.tube(spline(pts), 0.022, { grid: 16, samples: 64 }), {
          ...shift(pts[2]),
          weight: 1.4,
          pattern: false,
          color: (c) => (inWedge(c.p) ? null : lit("#8fd27b", c.n)),
        });
      }
      // Golgi apparatus: a stack of curved cisternae with vesicles budding off.
      const gc = [0.46, -0.34, 0.3];
      const gq = quatFromTo([0, 0, 1], unit(sub(nc, gc)));
      const golgi = shift(gc);
      for (let i = 0; i < 5; i++) {
        const Rg = 0.3 + i * 0.045;
        const w = 0.85 - i * 0.08;
        k.add(
          k.param(
            (u, v) => {
              const a = (u - 0.5) * w;
              const b = (v - 0.5) * 0.34;
              const p = [
                Rg * Math.sin(a),
                Rg * Math.sin(b),
                Rg * Math.cos(a) * Math.cos(b) - 0.3 - i * 0.045,
              ];
              return add(gc, quatRotate(gq, p));
            },
            { grid: 24, thick: 0.02 },
          ),
          {
            ...golgi,
            flat: 0.2,
            weight: 1.5,
            pattern: false,
            color: (c) => (inWedge(c.p) ? null : lit(i % 2 ? "#f0a630" : "#f7c250", c.n, 0.8, 0.3)),
          },
        );
      }
      // Mitochondria, lysosomes and vesicles scattered through the cytoplasm.
      const spots = [{ p: gc, r: 0.22 }];
      const place = (rMin, rMax, clear) => {
        for (let tries = 0; tries < 300; tries++) {
          const p = randBall(k.rand, rMax);
          if (len(p) < rMin || inWedge(add(p, [clear, clear, clear]))) continue;
          if (len(sub(p, nc)) < NR + 0.24 + clear) continue;
          if (spots.some((s) => len(sub(s.p, p)) < s.r + clear + 0.03)) continue;
          spots.push({ p, r: clear });
          return p;
        }
        return null;
      };
      for (let i = 0; i < 10; i++) {
        const p = place(0.35, 0.8, 0.15);
        if (!p) continue;
        const q = quatFromTo([0, 1, 0], randDir(k.rand));
        k.add(k.lathe(capsuleProfile(0.085, 0.065, 6), { grid: 24 }), {
          ...shift(p),
          pos: p,
          quat: q,
          weight: 1.5,
          flat: 0.25,
          pattern: false,
          color: (c) => {
            const stripe = Math.abs(Math.sin(c.lp[1] * 80)) > 0.78;
            return litGloss(stripe ? "#b8402a" : "#ef7a45", c.n, 0.3);
          },
        });
      }
      for (let i = 0; i < 18; i++) {
        const lyso = i < 7;
        const r = lyso ? 0.055 : 0.035;
        const p = place(0.2, 0.86, r);
        if (!p) continue;
        k.add(k.sphere(r), {
          ...shift(p),
          pos: p,
          weight: 1.6,
          pattern: false,
          color: (c) => litGloss(lyso ? "#5fc97c" : "#ffe08a", c.n, 0.5),
        });
      }
      // A pair of centrioles near the nucleus.
      const centrioles = shift([-0.31, 0.56, 0.25]);
      for (const [rot, off] of [
        [
          [0, 0, 0],
          [0, 0, 0],
        ],
        [
          [90, 0, 0],
          [0.08, 0.02, 0],
        ],
      ]) {
        k.add(k.cylinder(0.03, 0.12), {
          pos: add([-0.35, 0.55, 0.25], off),
          rot,
          weight: 2,
          pattern: false,
          ...centrioles,
          color: (c) => lit("#4aa3d8", c.n),
        });
      }
    },
  },

  // ---- DNA -----------------------------------------------------------------------------
  dna: {
    alive: true,
    options: [
      { key: "strandA", label: "Strand", type: "color", default: "#5b8def" },
      { key: "strandB", label: "Partner", type: "color", default: "#f06b9a" },
    ],
    controls: [{ key: "unzip", label: "Unzip", type: "pulse", ease: 5.5 }],
    action: { key: "unzip", label: "Unzip and zip" },
    // A tap unzips the helix almost to its foot, the bases light up in pairs
    // as the fork passes them, and then it zips back up.
    drive(t, c, out) {
      const p = c.unzip > 0 ? 1 - c.unzip : 1;
      const open = 1 - Math.pow(1 - clamp(p / 0.3, 0, 1), 3);
      const u = open * (1 - smoothstep(0.6, 0.95, p));
      Object.assign(out.parts, dnaParts(t * 0.35, u));
      out.grow = u * 1.05;
    },
    build(k, o) {
      const H = DNA.height;
      const lower = k.part("lower", { pivot: [0, 0, 0], axis: DNA.axis });
      const segPart = {};
      for (const s of ["a", "b"])
        for (let j = 0; j < DNA.segs; j++)
          segPart[s + j] = k.part(s + j, { pivot: dnaPivot(s, j) });
      const partAt = (s, y) => {
        if (y < DNA.forkY) return lower;
        const j = Math.min(
          DNA.segs - 1,
          Math.floor(((y - DNA.forkY) / (H / 2 - DNA.forkY)) * DNA.segs),
        );
        return segPart[s + j];
      };
      const W = (p) => quatRotate(DNA.tilt, p);
      // Backbones: each strand in pieces, so the top can swing open.
      const bounds = [-H / 2, DNA.forkY];
      for (let j = 1; j <= DNA.segs; j++)
        bounds.push(DNA.forkY + ((H / 2 - DNA.forkY) * j) / DNA.segs);
      for (const s of ["a", "b"]) {
        const col = s === "a" ? o.strandA : o.strandB;
        for (let i = 0; i < bounds.length - 1; i++) {
          const y0 = bounds[i];
          const y1 = bounds[i + 1];
          const part = partAt(s, (y0 + y1) / 2);
          const curve = (t) => W(dnaStrand(s, y0 + (y1 - y0) * t));
          const caps = i === bounds.length - 2 || i === 0;
          k.add(k.tube(curve, 0.075, { grid: 48, samples: 128, caps }), {
            part,
            flat: 0.25,
            color: (c) => {
              const y = y0 + (y1 - y0) * c.t;
              const bead = Math.cos(((y - DNA.y0) / DNA.step) * TAU);
              return litGloss(bead > 0.75 ? shade(col, 0.82) : col, c.n, 0.35);
            },
          });
        }
      }
      // Base pairs: each rung is two halves, one base on each strand.
      const BASES = { A: "#ff6b6b", T: "#ffd93d", G: "#6bcb77", C: "#4d96ff" };
      const PAIRS = ["AT", "TA", "GC", "CG"];
      for (let y = DNA.y0; y < H / 2 - 0.05; y += DNA.step) {
        const pair = PAIRS[Math.floor(k.rand() * 4)];
        const pa = dnaStrand("a", y);
        const pb = dnaStrand("b", y);
        const mid = lerp(pa, pb, 0.5);
        for (const [s, from, base] of [
          ["a", pa, pair[0]],
          ["b", pb, pair[1]],
        ]) {
          const d = sub(mid, from);
          const L = len(d) - 0.02;
          k.add(k.cylinder(0.045, L, { caps: true }), {
            part: partAt(s, y),
            pos: W(lerp(from, mid, 0.5)),
            quat: quatMul(DNA.tilt, quatFromTo([0, 1, 0], d)),
            weight: 1.5,
            flat: 0.3,
            pattern: false,
            color: (c) => litGloss(BASES[base], c.n, 0.3),
          });
          // A glow round the base that lights as the fork passes its pair.
          k.add(k.cylinder(0.075, L + 0.03, { caps: true }), {
            part: partAt(s, y),
            pos: W(lerp(from, mid, 0.5)),
            quat: quatMul(DNA.tilt, quatFromTo([0, 1, 0], d)),
            weight: 0.8,
            size: 1.4,
            opacity: 0.45,
            pattern: false,
            kind: "grow",
            params: [y < DNA.forkY ? 2 : 0.05 + (0.9 * (y - DNA.forkY)) / (H / 2 - DNA.forkY), 0],
            color: mix(BASES[base], "#ffffff", 0.55),
          });
        }
      }
      // Room for the open strands as they twist.
      for (const s of ["a", "b"]) {
        const tip = dnaTip(s);
        const rho = 0.8 * Math.hypot(tip[0], tip[2]);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + 0.4;
          k.reach(W([rho * Math.cos(a), tip[1], rho * Math.sin(a)]));
        }
      }
    },
  },
  // ---- White blood cell --------------------------------------------------------------
  "white-blood-cell": {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#cdb4f0" }],
    controls: [{ key: "eat", label: "Engulf", type: "pulse", ease: 5.6 }],
    action: { key: "eat", label: "Catch a bacterium" },
    // A tap plays phagocytosis: a bacterium swims in from the side, the
    // cell reaches out a cup of membrane round it (channel 0), pulls it in
    // and closes over it; granules gather on it (channel 1) and it is
    // digested (glows, channel 2, and shrinks away).
    drive(t, c, out) {
      const p = progress(c.eat);
      const s = p * 5.6; // seconds since the tap
      const on = c.eat > 0;
      const { E, F, side } = WBC;
      // The bacterium's path: in from beyond the edge, wriggling, into the
      // cup, then drawn inside.
      const swim = ease(band(s, 0, 1.7));
      const pull = ease(band(s, 1.7, 2.7));
      // From beyond the edge to the cup's mouth (1.1 E), then in to F.
      const mouth = sub(mul(E, 1.1), F);
      const at = add(mul(mouth, 1 - pull), mul(E, 1.5 * (1 - swim)));
      const wig = Math.sin(s * 11) * 0.05 * (1 - pull);
      const cup = ease(band(s, 0.5, 1.7)) * (1 - ease(band(s, 2.1, 3.1)));
      const gather = ease(band(s, 2.9, 3.8)) * (1 - ease(band(s, 4.6, 5.5)));
      const digest = ease(band(s, 3.6, 4.7));
      out.morph = [cup, gather, band(s, 3.2, 4.4)];
      out.parts.bug = {
        offset: add(at, mul(side, wig)),
        angle: Math.sin(s * 11 + 1) * 0.25 * (1 - pull),
        scale: 1 - 0.8 * digest,
        visible: on && digest < 0.98 ? 1 : 0,
      };
      out.glow = [1, 0.5, 0.8, 2.2];
      // The cell leans towards its catch, and breathes gently at rest.
      out.body = {
        quat: quatAxisAngle([0.2, 1, 0.1], 0.3 * Math.sin(t * 0.3) * (1 - 0.8 * c.eat)),
        offset: mul(E, 0.05 * cup),
        squash: 0.02 * Math.sin(t * 1.3),
      };
    },
    build(k, o) {
      const base = o.color;
      const { E, F } = WBC;
      k.fitMorphs = false; // the cup reaches just past the resting cell
      // A soft, lumpy surface with little ruffles, translucent enough to show
      // the nucleus inside.
      const lump = (d) =>
        0.09 * k.noise.fbm(d[0] * 1.6 + 5, d[1] * 1.6, d[2] * 1.6, 2) +
        0.025 * (1 - Math.abs(k.noise(d[0] * 6, d[1] * 6 + 3, d[2] * 6)) * 2);
      k.add(
        k.radial((d) => 1 + lump(d), { grid: 72 }),
        {
          flat: 0.3,
          opacity: 0.5,
          share: 0.55,
          channel: 0,
          to: (c) => wbcCup(c.p),
          color: (c) => {
            const d = unit(c.lp);
            const h = lump(d);
            let col = mix(shade(base, 0.8), mix(base, "#ffffff", 0.4), smoothstep(-0.06, 0.08, h));
            const face = Math.abs(dot(c.n, VIEW));
            col = shade(col, 0.72 + 0.35 * face);
            // Bigger splats where the cup stretches the membrane.
            const cupSide = smoothstep(0.2, 0.75, dot(d, WBC.E));
            return { c: litGloss(col, c.n, 0.35), size: 1 + 0.15 * cupSide };
          },
        },
      );
      // Inside: a nucleus of three lobes and a scatter of granules.
      const lobes = [
        [-0.36, 0.16, 0.05],
        [0.0, -0.14, 0.14],
        [0.36, 0.12, 0.02],
      ];
      for (const p of lobes)
        k.add(k.sphere(0.28), {
          pos: p,
          weight: 1.2,
          pattern: false,
          interior: 0.3,
          core: "#4a2a80",
          color: (c) => litGloss("#6b3fb3", c.n, 0.35),
        });
      for (let i = 0; i < 2; i++)
        k.add(k.tube(spline([lobes[i], lerp(lobes[i], lobes[i + 1], 0.5), lobes[i + 1]]), 0.11), {
          weight: 1.2,
          pattern: false,
          color: (c) => lit("#6b3fb3", c.n),
        });
      // Granules; the nearest gather round the swallowed bacterium.
      k.cloud({ share: 0.05, size: 1.1, pattern: false }, (rand) => {
        const p = randBall(rand, 0.9);
        const near = len(sub(p, F)) < 0.62 && rand() < 0.75;
        return {
          p,
          color: rand() < 0.6 ? "#f08fc8" : "#c46ad6",
          size: near ? 1.3 : 1,
          opacity: 0.95,
          channel: 1,
          to: near ? add(F, mul(randDir(rand), 0.1 + 0.05 * rand())) : p,
        };
      });
      // The bacterium: built where it ends up (inside the cell), hidden
      // until a tap brings it in from outside.
      const bug = k.part("bug", { pivot: F, axis: cross(E, VIEW) });
      const rodQ = quatFromTo([0, 1, 0], E);
      k.add(k.lathe(capsuleProfile(0.13, 0.08, 8), { grid: 32 }), {
        pos: F,
        quat: rodQ,
        part: bug,
        weight: 3,
        flat: 0.35,
        pattern: false,
        kind: "band",
        channel: 2,
        params: [0.5, 0.3],
        color: (c) => litGloss(mix("#7cc947", "#4e9a2c", 0.5 + 0.5 * c.lp[1] * 4), c.n, 0.4),
      });
      // Its tail whips out behind (away from the cell).
      k.add(
        k.tube(
          (t) => {
            const q = add(F, mul(E, 0.2 + 0.17 * t));
            return add(q, mul(cross(E, VIEW), 0.04 * Math.sin(t * 14) * t));
          },
          0.017,
          { samples: 64 },
        ),
        { part: bug, weight: 3, pattern: false, color: "#a9d46e" },
      );
    },
  },

  // ---- Microglia ----------------------------------------------------------------------
  microglia: {
    alive: true,
    options: [{ key: "color", label: "Cell", type: "color", default: "#f08a4b" }],
    controls: [{ key: "sense", label: "Sense", type: "pulse", ease: 4.4 }],
    action: { key: "sense", label: "Reach and sweep" },
    // Its six arms (parts) feel about gently at rest. A tap makes it reach:
    // every arm stretches out along its length (channel 0), sweeps to and
    // fro twice, then draws back in.
    drive(t, c, out, info) {
      const p = progress(c.sense);
      const s = p * 4.4;
      const reach = ease(band(s, 0, 0.8)) * (1 - ease(band(s, 3, 4.2)));
      const sweep = Math.sin(((s - 0.6) / 1.2) * TAU) * band(s, 0.5, 0.9) * (1 - band(s, 2.9, 3.4));
      out.morph = [reach + 0.12 * Math.sin(band(s, 0.8, 1.3) * Math.PI)];
      (info.data?.arms || []).forEach((arm, i) => {
        const idle = 0.07 * Math.sin(t * 0.9 + i * 1.9);
        out.parts[`arm${i}`] = { angle: idle + 0.42 * sweep * (i % 2 ? -1 : 1) };
      });
    },
    build(k, o) {
      const cell = o.color;
      k.add(k.ellipsoid(0.2, 0.14, 0.15), {
        rot: [0, 0, 20],
        flat: 0.2,
        interior: 0.15,
        core: shade(cell, 0.7),
        color: (c) => litGloss(mix(cell, "#ffd1b3", 0.25), c.n, 0.4),
      });
      k.add(k.sphere(0.09), {
        pos: [0.02, 0, 0.05],
        weight: 1.4,
        pattern: false,
        color: "#8a3b1c",
      });
      // Long, fine, much-branched processes that sway as they sense around.
      const branches = [];
      const grow = (start, dir, length, r0, depth, dist, arm) => {
        const r1 = Math.max(0.006, r0 * 0.6);
        const pts = [start];
        let p = start;
        let d = dir;
        for (let i = 1; i <= 4; i++) {
          d = unit(add(d, mul(randDir(k.rand), 0.45)));
          p = add(p, mul(d, length / 4));
          pts.push(p);
        }
        branches.push({ pts, r0, r1, dist, length, arm });
        if (depth <= 0) return;
        const n = 2 + (k.rand() < 0.35 ? 1 : 0);
        const curve = spline(pts);
        for (let i = 0; i < n; i++) {
          const at = 0.45 + 0.5 * k.rand();
          const nd = unit(add(d, mul(randDir(k.rand), 0.9)));
          grow(curve(at), nd, length * 0.55, r1, depth - 1, dist + length * at, arm);
        }
      };
      const dirs = [
        [1, 0.35, 0.1],
        [-1, 0.2, -0.1],
        [0.2, 1, -0.2],
        [-0.4, -0.9, 0.2],
        [0.6, -0.7, -0.3],
        [-0.5, 0.6, 0.6],
      ];
      // Each arm is a part that sweeps about the body, across its length.
      const arms = dirs.map((d0, i) => {
        const d = unit(d0);
        const axis = unit(cross(d, i % 2 ? VIEW : [0, 1, 0.3]));
        return { d, part: k.part(`arm${i}`, { pivot: [0, 0, 0], axis }) };
      });
      k.data = { arms: arms.map((a) => a.d) };
      arms.forEach((a, i) => grow(mul(a.d, 0.15), a.d, 0.75 + 0.2 * k.rand(), 0.045, 3, 0, i));
      const far = Math.max(...branches.map((b) => b.dist + b.length));
      for (const b of branches) {
        const { d, part } = arms[b.arm];
        const curve = spline(b.pts);
        k.add(
          k.tube(curve, (t) => b.r0 + (b.r1 - b.r0) * t, { grid: 10, samples: 24 }),
          {
            weight: 1.5,
            flat: 0.35,
            part,
            // Reaching: each point moves out along its arm, the more the
            // further it is from the body, so the arm lengthens.
            to: (c) => add(c.p, mul(d, (0.38 * (b.dist + c.t * b.length)) / far)),
            color: (c) =>
              lit(mix(cell, "#ffc49e", clamp((b.dist + c.t * b.length) / 1.3, 0, 1)), c.n),
          },
        );
      }
    },
  },

  // ---- Diatom --------------------------------------------------------------------------
  diatom: {
    alive: true,
    options: [{ key: "color", label: "Glass", type: "color", default: "#7fd6d0" }],
    controls: [{ key: "open", label: "Open", type: "pulse", ease: 4.4 }],
    action: { key: "open", label: "Glint and open" },
    // A tap sends a glint of light across the glass (channel 0), then the
    // shell parts into its two halves, opening like a clam from its far
    // edge to show the golden cell inside; then it closes again.
    drive(t, c, out) {
      const p = progress(c.open);
      const s = p * 4.4;
      const open = ease(band(s, 0.7, 1.6)) * (1 - ease(band(s, 3, 4.1)));
      out.morph = [c.open > 0 ? -0.2 + 1.5 * band(s, 0, 1.3) : -1];
      out.glow = [0.85, 1, 1, 1.1];
      const axis = DIATOM_AXIS;
      out.parts.lid = { offset: mul(axis, 0.12 * open), angle: -0.5 * open };
      out.parts.base = { offset: mul(axis, -0.1 * open), angle: 0.14 * open };
    },
    build(k, o) {
      const glass = o.color;
      const R = 1;
      const H = 0.16;
      const q = quatFromTo([0, 1, 0], DIATOM_AXIS);
      const W = (p) => quatRotate(q, p);
      // The two halves open like a clam about the far edge of the rim.
      const tip = unit(cross(DIATOM_AXIS, VIEW));
      const away = unit(cross(tip, DIATOM_AXIS));
      const hinge = mul(away, R);
      const lid = k.part("lid", { pivot: hinge, axis: tip });
      const base = k.part("base", { pivot: hinge, axis: tip });
      // The glint's place: across the shell from upper left to lower right.
      const across = unit(add(tip, mul(cross(VIEW, tip), -0.5)));
      const ribs = 24;
      // The glass pattern on a valve face: radial ribs, rings of pores and a
      // clear centre. Returns null for a pore (a hole in the glass).
      const valve = (r, a, top) => {
        const f = ((a / TAU) * ribs + 10) % 1;
        const ringW = 0.085;
        if (r < 0.16) {
          const star = Math.abs(Math.sin(a * 6)) * 0.05;
          return { v: r < 0.07 + star ? 1 : 0.6, rib: false };
        }
        const rib = Math.abs(f - 0.5) > 0.4;
        if (rib) return { v: 1, rib: true };
        const ring = (r - 0.16) / ringW;
        const g = ring % 1;
        const sub = Math.floor(ring) % 2 ? (f * 2 + 0.5) % 1 : (f * 2) % 1;
        const pore = (g - 0.5) ** 2 + ((sub - 0.5) * 0.9) ** 2 < 0.09 && r < R * 0.93;
        if (pore && top) return null;
        return { v: pore ? 0.25 : 0.55, rib: false };
      };
      for (const side of [1, -1]) {
        const face = k.param(
          (u, v) => {
            const r = Math.sqrt(v) * R;
            const a = u * TAU;
            const y = side * (H + 0.08 * (1 - (r / R) ** 2));
            return W([r * Math.cos(a), y, r * Math.sin(a)]);
          },
          { grid: 96, flip: side < 0, thick: 0.1 },
        );
        k.add(face, {
          flat: 0.15,
          weight: 1.6,
          part: side > 0 ? lid : base,
          kind: "band",
          channel: 0,
          params: (c) => [0.5 + 0.5 * dot(c.p, across) + 0.04 * c.rand(), 0.07],
          color: (c) => {
            const r = Math.sqrt(c.v) * R;
            const a = c.u * TAU;
            const g = valve(r, a, side > 0);
            if (!g) return null;
            let col = mix(shade(glass, 0.55), mix(glass, "#ffffff", 0.55), g.v);
            if (g.rib) col = mix(col, "#ffffff", 0.25);
            return gloss(lit(col, c.n, 0.75, 0.35), c.n, 0.3);
          },
        });
      }
      // The girdle band round the edge: the lid's half overlaps the base's.
      k.add(k.cylinder(R, 2 * H, { caps: false }), {
        quat: q,
        flat: 0.15,
        part: (c) => (c.lp[1] > 0 ? lid : base),
        color: (c) => {
          const band = Math.abs(Math.sin(c.lp[1] * 60)) > 0.7;
          return lit(band ? shade(glass, 0.7) : mix(glass, "#ffffff", 0.3), c.n, 0.75, 0.3);
        },
      });
      // Golden chloroplasts inside, seen through the pores.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + k.rand() * 0.3;
        const r = 0.35 + 0.45 * k.rand();
        k.add(k.ellipsoid(0.16, 0.06, 0.1), {
          pos: W([r * Math.cos(a), 0, r * Math.sin(a)]),
          quat: quatMul(q, quatEuler(0, (-a * 180) / Math.PI, 0)),
          weight: 1.2,
          pattern: false,
          color: (c) => lit(mix("#c98b1d", "#8a5a12", c.rand() * 0.5), c.n),
        });
      }
    },
  },

  // ---- Tardigrade ---------------------------------------------------------------------
  tardigrade: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#e7c39b" }],
    controls: [{ key: "wiggle", label: "Wiggle", type: "pulse", ease: 2.5 }],
    action: { key: "wiggle", label: "Wiggle" },
    drive(t, c, out) {
      const amp = 0.22 + 0.35 * c.wiggle;
      const speed = 2.2 + 5 * c.wiggle;
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? -1 : 1;
        const ph = Math.floor(i / 2) * 1.4 + (side > 0 ? 0 : Math.PI);
        out.parts[`leg${i}`] = { angle: amp * Math.sin(t * speed + ph) };
      }
      out.amount = 1 + c.wiggle;
    },
    build(k, o) {
      const skin = o.color;
      // The plump body: a lathe along X with soft segment bulges.
      const FLAT = 0.86;
      const profR = (x) => {
        const s = clamp((x + 0.95) / 1.9, 0, 1);
        const env = Math.pow(Math.sin(Math.PI * (0.02 + s * 0.96)), 0.42);
        return 0.42 * env * (1 + 0.06 * Math.cos(s * 4 * TAU));
      };
      const prof = [];
      const N = 30;
      for (let i = 0; i <= N; i++) {
        const x = -0.95 + (1.9 * i) / N;
        prof.push([profR(x), x]);
      }
      prof[0] = [0, -0.97];
      prof[N] = [0, 0.97];
      const bodyQ = quatEuler(0, 0, -90);
      k.add(k.lathe(prof, { grid: 72, thick: 0.2 }), {
        quat: bodyQ,
        scale: [FLAT, 1, 1],
        flat: 0.2,
        interior: 0.1,
        core: mix(skin, "#ffffff", 0.2),
        kind: "breathe",
        params: [0.02, 0],
        color: (c) => {
          const x = c.p[0];
          const seg = Math.cos((x + 0.95) * 2 * TAU * 1.05);
          let col = mix(skin, shade(skin, 0.78), smoothstep(0.6, 1, seg));
          const wr = c.fbm(c.p[0] * 14, c.p[1] * 5, c.p[2] * 5);
          col = shade(col, 1 + 0.08 * wr);
          if (c.p[1] < -0.15) col = mix(col, "#fff3e0", 0.25);
          return litGloss(col, c.n, 0.3);
        },
      });
      // The face: a round snout with a mouth, and two little eyes.
      k.add(k.torus(0.07, 0.03), {
        pos: [0.96, 0.0, 0],
        rot: [0, 0, 90],
        weight: 2,
        pattern: false,
        color: (c) => lit("#d98d80", c.n),
      });
      k.add(k.disc(0.055), {
        pos: [0.975, 0.0, 0],
        rot: [0, 0, 90],
        weight: 2,
        pattern: false,
        color: "#6b2f2a",
      });
      const ex = 0.72;
      const er = profR(ex);
      for (const z of [-1, 1]) {
        k.add(k.sphere(0.042), {
          pos: [ex, er * FLAT * 0.62, z * er * 0.75],
          weight: 4,
          pattern: false,
          color: (c) => keep(gloss("#1d1512", c.n, 0.8, 30)),
        });
      }
      // Eight stubby legs (four pairs), each with a tuft of claws.
      const legX = [0.55, 0.12, -0.32, -0.8];
      for (let i = 0; i < 8; i++) {
        const pair = Math.floor(i / 2);
        const side = i % 2 ? -1 : 1;
        const x = legX[pair];
        const back = pair === 3;
        const hr = profR(x);
        const hip = [x, -hr * FLAT * 0.55, side * hr * 0.72];
        const dir = back ? unit([-0.8, -0.5, side * 0.35]) : unit([0.05, -0.8, side * 0.55]);
        const part = k.part(`leg${i}`, { pivot: hip, axis: back ? [0, 0, 1] : [0, 0, 1] });
        const len0 = 0.26;
        const q = quatFromTo([0, 1, 0], dir);
        k.add(k.cone(0.13, 0.095, len0, { caps: "top" }), {
          part,
          quat: q,
          pos: add(hip, mul(dir, len0 / 2)),
          flat: 0.2,
          color: (c) => {
            const ring = Math.abs(Math.sin(c.lp[1] * 40)) > 0.85;
            return lit(ring ? shade(skin, 0.82) : skin, c.n);
          },
        });
        const foot = add(hip, mul(dir, len0));
        const [e1, e2] = basis(dir);
        for (let j = 0; j < 4; j++) {
          const a = (j / 4) * TAU + 0.4;
          const spread = add(mul(e1, Math.cos(a)), mul(e2, Math.sin(a)));
          const p0 = add(foot, mul(spread, 0.05));
          const p1 = add(p0, add(mul(dir, 0.07), mul(spread, 0.04)));
          const p2 = add(p1, add(mul(dir, 0.02), mul(spread, 0.05)));
          k.add(
            k.tube(spline([p0, p1, p2]), (t) => 0.016 * (1 - 0.8 * t), { grid: 12, samples: 16 }),
            {
              part,
              weight: 2.5,
              pattern: false,
              color: "#5b4636",
            },
          );
        }
      }
    },
  },

  // ---- Pollen -------------------------------------------------------------------------
  pollen: {
    alive: true,
    options: [
      {
        key: "kind",
        label: "Plant",
        type: "select",
        default: "sunflower",
        choices: [
          { id: "sunflower", label: "Sunflower" },
          { id: "pine", label: "Pine" },
          { id: "lily", label: "Lily" },
        ],
      },
      { key: "color", label: "Colour", type: "color", default: "#f5c131" },
    ],
    controls: [{ key: "burst", label: "Burst", type: "pulse", ease: 3.8 }],
    action: { key: "burst", label: "Burst" },
    // A tap bursts the grain, as pollen does when it soaks up rain: it
    // swells, then a puff of tiny starch granules jets out of its pores
    // (channel 0), drifts down and fades away. The puff stays where it was
    // let go while the grain turns on.
    drive(t, c, out) {
      const p = progress(c.burst);
      const s = p * 3.8;
      const on = c.burst > 0;
      const m = mem(c);
      if (!on) m.at = t;
      const body = quatAxisAngle([0.2, 1, 0.1], t * 0.2);
      const atTap = quatAxisAngle([0.2, 1, 0.1], (m.at ?? t) * 0.2);
      const swell = Math.sin(band(s, 0, 0.3) * Math.PI);
      out.body = { quat: body, squash: -0.05 * swell + 0.04 * Math.sin(band(s, 0.25, 0.6) * TAU) };
      out.morph = [on ? 1.06 * easeOut(band(s, 0.2, 1.3)) : 0];
      const fall = band(s, 0.5, 3.8);
      out.parts.puff = {
        // Undo the grain's turn since the tap: the puff stays put.
        quat: quatMul([-body[0], -body[1], -body[2], body[3]], atTap),
        offset: [0.06 * fall, -0.6 * fall * fall, 0],
        visible: on && s > 0.18 ? 1 - ease(band(s, 2.6, 3.7)) : 0,
      };
    },
    build(k, o) {
      const col = o.color;
      const tw = { kind: "breathe", params: [0.02, 0] };
      k.fitMorphs = false; // the puff may spread past the frame
      // The puff: granules packed inside, each sent out through a pore.
      const puff = k.part("puff");
      const granules = (pores, spread, far) =>
        k.cloud({ share: 0.06, size: 0.65, pattern: false, part: puff }, (rand) => {
          const pore = pores[Math.floor(rand() * pores.length)];
          const d = unit(add(pore, mul(randDir(rand), spread)));
          const r = far * (0.35 + 0.65 * Math.sqrt(rand()));
          return {
            p: mul(d, 0.3 * rand()),
            to: add(mul(d, r), mul(randDir(rand), 0.12 * r)),
            color: rand() < 0.7 ? mix("#fff6d8", col, 0.25 * rand()) : shade(col, 0.8),
            opacity: 0.95,
          };
        });
      // A net of ridges (reticulate pollen) from cells around random points.
      const netPts = fibonacciSphere(70).map((d) => unit(add(d, mul(randDir(k.rand), 0.12))));
      const net = (d) => {
        const nb = nearest2(netPts, d);
        return smoothstep(0.012, 0.0, nb.d1 - nb.d2);
      };
      if (o.kind === "pine") {
        // A body with two air sacs, like mouse ears.
        k.add(k.ellipsoid(0.62, 0.5, 0.5), {
          ...tw,
          flat: 0.2,
          interior: 0.1,
          core: shade(col, 0.7),
          color: (c) => {
            const d = unit(c.lp);
            const bump = c.noise(d[0] * 9, d[1] * 9, d[2] * 9) > 0.3;
            return litGloss(bump ? mix(col, "#ffffff", 0.3) : shade(col, 0.9), c.n, 0.3);
          },
        });
        for (const side of [-1, 1]) {
          k.add(k.sphere(0.5), {
            ...tw,
            pos: [side * 0.55, 0.32, 0],
            flat: 0.2,
            color: (c) => {
              const r = net(unit(c.lp));
              const sac = mix(mix(col, "#fff4c8", 0.45), shade(col, 0.75), r);
              return litGloss(sac, c.n, 0.3);
            },
          });
        }
        // Out of the furrow on its underside.
        granules([[0, -1, 0.15]], 0.55, 1.25);
        return;
      }
      if (o.kind === "lily") {
        // An oval grain with a bold net and one long furrow.
        k.add(k.ellipsoid(1, 0.62, 0.62), {
          ...tw,
          flat: 0.2,
          interior: 0.1,
          core: shade(col, 0.7),
          color: (c) => {
            const d = unit([c.lp[0], c.lp[1] / 0.62, c.lp[2] / 0.62]);
            if (d[1] > 0.1 && Math.abs(d[2]) < 0.12 && Math.abs(d[0]) < 0.85)
              return lit(shade(col, 0.55), c.n);
            const r = net(d);
            return litGloss(mix(shade(col, 0.62), mix(col, "#ffffff", 0.3), r), c.n, 0.35);
          },
        });
        // Out of the long furrow on top.
        granules(
          [
            [-0.5, 1, 0.1],
            [0, 1, 0.1],
            [0.5, 1, 0.1],
          ],
          0.35,
          1.3,
        );
        return;
      }
      // Sunflower: a spiky ball with three pores.
      const pores = [0, 1, 2].map((i) => [Math.cos((i / 3) * TAU), 0, Math.sin((i / 3) * TAU)]);
      k.add(k.sphere(1), {
        ...tw,
        flat: 0.2,
        interior: 0.1,
        core: shade(col, 0.7),
        color: (c) => {
          const d = c.ln;
          if (pores.some((p) => dot(p, d) > 0.985)) return lit("#8a5a12", c.n);
          const pit = c.noise(d[0] * 22, d[1] * 22, d[2] * 22) > 0.35;
          return litGloss(pit ? shade(col, 0.78) : col, c.n, 0.3);
        },
      });
      for (const d of fibonacciSphere(90)) {
        if (pores.some((p) => dot(p, d) > 0.95)) continue;
        const L = 0.3;
        k.add(k.cone(0.085, 0.004, L, { caps: false }), {
          ...tw,
          quat: quatFromTo([0, 1, 0], d),
          pos: mul(d, 0.98 + L / 2),
          weight: 1.4,
          flat: 0.3,
          color: (c) =>
            litGloss(mix(col, "#fff7d6", clamp((c.lp[1] + L / 2) / L, 0, 1) * 0.7), c.n, 0.4),
        });
      }
      // Out of the three pores.
      granules(pores, 0.4, 1.45);
    },
  },

  // ---- Snowflake ------------------------------------------------------------------------
  snowflake: {
    alive: true,
    options: [
      {
        key: "style",
        label: "Crystal",
        type: "select",
        default: "stellar",
        choices: [
          { id: "stellar", label: "Stellar dendrite" },
          { id: "fern", label: "Fern" },
          { id: "plate", label: "Sectored plate" },
          { id: "star", label: "Simple star" },
        ],
      },
      { key: "variant", label: "Variant", type: "slider", min: 1, max: 9, step: 1, default: 3 },
    ],
    controls: [{ key: "regrow", label: "Regrow", type: "pulse", ease: 3.6 }],
    action: { key: "regrow", label: "Grow a new flake" },
    // A tap melts the arms back from their tips to the middle, then a new
    // flake grows out from the centre, branch by branch: three patterns
    // (parts), one after another, each tap.
    drive(t, c, out) {
      const p = progress(c.regrow);
      const s = p * 3.6;
      const on = c.regrow > 0;
      const m = mem(c);
      if (fired(m, "regrow", c.regrow)) m.n = (m.n ?? 0) + 1;
      const n = m.n ?? 0;
      const shown = on && s < 1.1 ? (n + 2) % 3 : n % 3;
      out.grow = on ? (s < 1.1 ? 1 - ease(band(s, 0, 1.1)) : ease(band(s, 1.15, 3.4))) : 1;
      for (let i = 0; i < 3; i++) out.parts[`flake${i}`] = { visible: i === shown ? 1 : 0 };
      out.body = { quat: quatAxisAngle([0, 1, 0], 0.35 * Math.sin(t * 0.4)) };
    },
    build(k, o) {
      // Three flakes of the chosen kind: the chosen variant and two more.
      for (let f = 0; f < 3; f++) {
        const variant = ((o.variant - 1 + 3 * f) % 9) + 1;
        snowflake(k, o.style, variant, k.part(`flake${f}`));
      }
      k.add(k.sphere(0.05), { weight: 2, color: "#ffffff", kind: "glint", params: [1, 0] });
    },
  },

  // ---- Chromosome ---------------------------------------------------------------------
  chromosome: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#8f6fe0" }],
    controls: [{ key: "split", label: "Split", type: "pulse", ease: 4.6 }],
    action: { key: "split", label: "Pull apart" },
    // A tap plays anaphase: spindle fibres reach in from two poles to the
    // kinetochores and pull the sister chromatids apart (channel 0), each
    // led by its centromere with its arms trailing; then they come back
    // together and the fibres let go.
    drive(t, c, out) {
      const p = progress(c.split);
      const s = p * 4.6;
      const on = c.split > 0;
      out.morph = [ease(band(s, 0.45, 1.9)) * (1 - ease(band(s, 2.7, 4))) + 0.02 * Math.sin(t)];
      out.parts.spindle = {
        visible: on ? ease(band(s, 0, 0.45)) * (1 - ease(band(s, 3.8, 4.5))) : 0,
      };
    },
    build(k, o) {
      const col = o.color;
      // Each chromatid moves out to its side, most at its centromere (so its
      // arms trail behind in a V).
      const PULL = 0.62;
      const cenY = 0.25;
      const pull = (p, side, t) => {
        const lag = Math.min(1, Math.abs(t - 0.38) / 0.62);
        return add(p, [side * PULL * (1 - 0.55 * lag), 0.06 * lag * (p[1] > cenY ? -1 : 1), 0]);
      };
      const dark = shade(mix(col, "#2b1a5c", 0.5), 0.8);
      // Banding: the same pattern on both sister chromatids.
      const bands = [];
      let y = 0;
      while (y < 1) {
        const w = 0.02 + 0.06 * k.rand();
        bands.push({ y0: y, y1: y + w, dark: bands.length % 2 === 1 });
        y += w + 0.015 + 0.05 * k.rand();
      }
      const bandAt = (t) => bands.some((b) => b.dark && t >= b.y0 && t <= b.y1);
      const cen = 0.38;
      for (const side of [-1, 1]) {
        // A chromatid: from the top of the short arm through the centromere to
        // the bottom of the long arm, bowing out at both ends.
        const pts = [
          [side * 0.52, 0.95, 0.02],
          [side * 0.34, 0.6, 0],
          [side * 0.13, 0.25, 0],
          [side * 0.34, -0.2, 0],
          [side * 0.52, -0.7, 0.02],
          [side * 0.6, -1.15, 0.03],
        ];
        const curve = spline(pts);
        const radius = (t) => {
          const pinch = 1 - 0.45 * Math.exp(-(((t - cen) / 0.07) ** 2));
          const end = Math.pow(Math.min(1, Math.min(t, 1 - t) / 0.05 + 0.25), 0.4);
          return 0.23 * pinch * Math.min(1, end);
        };
        const tube = k.tube(curve, radius, { grid: 64, samples: 256, caps: true });
        const inner = tube.sample;
        tube.sample = (rand) => {
          const s = inner(rand);
          s.thick = radius(s.t ?? 0) * 0.9;
          return s;
        };
        k.add(tube, {
          flat: 0.3,
          interior: 0.1,
          core: mix(col, "#ffffff", 0.3),
          to: (c) => pull(c.p, side, c.t ?? 0),
          color: (c) => {
            const t = c.t ?? 0;
            const coil = Math.sin(c.u * TAU * 2 + t * 90) * 0.5 + 0.5;
            let base = bandAt(t) ? dark : col;
            if (t < 0.03 || t > 0.97) base = mix(col, "#ffffff", 0.4);
            base = shade(base, 0.92 + 0.12 * coil);
            return litGloss(base, c.n, 0.3);
          },
        });
      }
      // The kinetochores at the centromere, one per chromatid.
      const kin = [0, cenY, 0.12];
      k.add(k.ellipsoid(0.1, 0.08, 0.1), {
        pos: kin,
        weight: 2,
        pattern: false,
        to: (c) => pull(c.p, c.p[0] >= 0 ? 1 : -1, 0.38),
        color: (c) => litGloss("#ff6b8b", c.n, 0.4),
      });
      // The spindle: a bright centrosome at each pole and fibres from it to
      // the kinetochores, which shorten as they pull (hidden at rest).
      const spindle = k.part("spindle");
      for (const side of [-1, 1]) {
        const pole = [side * 1.08, cenY, 0.05];
        k.add(k.sphere(0.07), {
          pos: pole,
          part: spindle,
          weight: 3,
          pattern: false,
          color: (c) => litGloss("#ffe27a", c.n, 0.5),
        });
        for (let i = 0; i < 7; i++) {
          const end = add(kin, [side * 0.05, (i - 3) * 0.022, (i % 3) * 0.02 - 0.02]);
          const bow = [0, (i - 3) * 0.07, ((i % 3) - 1) * 0.05];
          const fibre = (u) => add(lerp(pole, end, u), mul(bow, Math.sin(u * Math.PI)));
          k.add(k.tube(fibre, 0.009, { samples: 48, grid: 6 }), {
            part: spindle,
            weight: 2.5,
            flat: 0.5,
            pattern: false,
            to: (c) => add(c.p, mul([side * PULL, 0, 0], c.t ?? 0)),
            color: "#bfe8ff",
          });
        }
      }
    },
  },

  // ---- Mitochondrion ------------------------------------------------------------------
  mitochondrion: {
    alive: true,
    options: [
      { key: "color", label: "Colour", type: "color", default: "#f08a4b" },
      { key: "cutaway", label: "Cutaway", type: "switch", default: true },
    ],
    controls: [{ key: "power", label: "Power up", type: "pulse", ease: 4 }],
    action: { key: "power", label: "Make energy" },
    // A tap powers it up: light runs along the cristae from end to end
    // (channel 0, the electron transport chain at work), the whole thing
    // gives a hum of a swell, and sparks of ATP pop out of the open side in
    // three waves (channels 1 to 3) and drift off. At rest faint waves run along now and then.
    drive(t, c, out) {
      const p = progress(c.power);
      const s = p * 4;
      const on = c.power > 0;
      const m = mem(c);
      if (on || m.since === undefined) m.since = t;
      const idle = (((t - m.since) * 0.13) % 1.8) - 0.3;
      const pop = (at) => (on ? easeOut(band(s, at, at + 1.3)) : 0);
      out.morph = [on ? -0.15 + 1.4 * band(s, 0, 1.2) : idle, pop(0.9), pop(1.25), pop(1.6)];
      out.glow = [1, 0.8, 0.35, on ? 1.3 : 0.35];
      out.body = { squash: -0.04 * Math.sin(band(s, 0.7, 1.3) * Math.PI) };
      out.parts.atp = {
        offset: [0, 0.25 * band(s, 1.2, 4), 0],
        visible: on && s > 0.85 ? 1 - ease(band(s, 3, 3.95)) : 0,
      };
    },
    build(k, o) {
      const col = o.color;
      const cut = o.cutaway;
      k.fitMorphs = false; // the sparks fly out past the frame
      const half = 0.75;
      const R = 0.45;
      // Lying across the view with the open side turned up towards the viewer.
      const q = frameQuat([0.92, 0.12, -0.38], [0.2, 0.85, 0.5]);
      const qi = [-q[0], -q[1], -q[2], q[3]];
      // Local frame: X along the length, Y up. The cut takes off the top.
      const local = (p) => quatRotate(qi, p);
      const W = (p) => quatRotate(q, p);
      const cutY = 0.06;
      const open = (p) => cut && local(p)[0] > cutY;
      k.add(capsuleSurface(k, half, R, cut ? cutY : Infinity), {
        quat: q,
        flat: 0.2,
        interior: cut ? 0 : 0.08,
        core: mix(col, "#ffd9b8", 0.4),
        color: (c) => {
          if (cut && c.s.edge < 0.012) return keep(shade(col, 0.72));
          return litGloss(col, c.n, 0.35);
        },
      });
      // Inner membrane just inside, and the matrix floor seen from above.
      k.add(capsuleSurface(k, half - 0.04, R - 0.05, cut ? cutY : Infinity), {
        quat: q,
        flat: 0.2,
        color: (c) =>
          cut && c.s.edge < 0.012
            ? keep(mix(col, "#ffe6d0", 0.6))
            : lit(mix(col, "#ffd9b8", 0.35), c.n, 0.85, 0.2),
      });
      // Cristae: folded shelves across the inside, from alternate sides.
      const n = 9;
      for (let i = 0; i < n; i++) {
        const x = -half - 0.1 + ((i + 0.5) / n) * (2 * half + 0.2);
        const from = i % 2 ? 1 : -1;
        const shelf = k.param(
          (u, v) => {
            // u across (z), v up (y); a wavy sheet.
            const z = from * (R - 0.06) - from * u * (R * 1.3);
            const yy = -R + 0.08 + v * (2 * R - 0.16);
            const wob = 0.04 * Math.sin(v * 9 + i) + 0.03 * Math.sin(u * 7);
            return [yy, x + wob, z];
          },
          { grid: 24, thick: 0.02 },
        );
        k.add(shelf, {
          quat: q,
          weight: 1.3,
          flat: 0.2,
          pattern: false,
          // Light runs along the cristae, end to end.
          kind: "band",
          channel: 0,
          params: (c) => [(c.lp[1] + half + 0.1) / (2 * half + 0.2), 0.09],
          color: (c) => {
            const lp = c.lp;
            // Stay inside the inner membrane.
            const ax = Math.max(0, Math.abs(lp[1]) - (half - 0.04));
            if (Math.hypot(lp[0], lp[2], ax) > R - 0.06) return null;
            if (open(c.p) && lp[0] > cutY + 0.02) return null;
            const edge = lp[0] > cutY - 0.02 && cut;
            return edge ? keep("#ffd2b0") : lit(mix(col, "#c2452d", 0.45), c.n, 0.8, 0.3);
          },
        });
      }
      // The matrix: small ribosomes and DNA rings between the cristae.
      k.cloud({ share: 0.02, size: 0.7, pattern: false }, (rand) => {
        const x = (rand() * 2 - 1) * half;
        const a = rand() * TAU;
        const r = (R - 0.1) * Math.sqrt(rand());
        const lp = [r * Math.cos(a), x, r * Math.sin(a)];
        if (cut && lp[0] > cutY) return null;
        return { p: W(lp), color: rand() < 0.7 ? "#7a2e1c" : "#fff0c0", opacity: 0.95 };
      });
      // ATP: bright sparks packed among the cristae (hidden until a tap),
      // which pop out through the open side in three waves (channels 1-3)
      // and spread. Each is a bright core in a soft halo.
      const atp = k.part("atp");
      const sparks = [];
      for (let i = 0; i < 90; i++) {
        const x = (k.rand() * 2 - 1) * half * 0.9;
        const a = k.rand() * TAU;
        const r = (R - 0.15) * Math.sqrt(k.rand());
        const lp = [Math.min(r * Math.cos(a), cutY - 0.02), x, r * Math.sin(a)];
        // Out mostly through the cut (local +x, towards the viewer).
        const d = unit([0.9 + 0.6 * k.rand(), (k.rand() * 2 - 1) * 0.9, (k.rand() * 2 - 1) * 1.1]);
        const go = add(lp, mul(d, 0.5 + 0.7 * k.rand()));
        sparks.push({ p: W(lp), to: W(go), channel: 1 + (i % 3), hot: k.rand() < 0.6 });
      }
      k.cloud({ count: 180, size: 2.2, pattern: false, part: atp }, (rand, i) => {
        const sp = sparks[i % sparks.length];
        const halo = Math.floor(i / sparks.length) % 2 === 1;
        return {
          p: sp.p,
          to: sp.to,
          channel: sp.channel,
          size: halo ? 2.6 : 1,
          color: halo ? "#ffb52e" : sp.hot ? "#fffbe0" : "#ffe27a",
          opacity: halo ? 0.28 : 1,
        };
      });
    },
  },

  // ---- Paramecium ---------------------------------------------------------------------
  paramecium: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#7fcb98" }],
    controls: [
      { key: "swim", label: "Swim", type: "slider", default: 0.5 },
      { key: "loop", label: "Loop", type: "pulse", ease: 4.2 },
    ],
    action: { key: "loop", label: "Swim a loop" },
    // A tap sets its cilia beating hard in waves and it swims a full loop
    // in the plane of the view (turning about the view keeps it drawn in
    // the right order), coming back to where it was.
    drive(t, c, out) {
      const p = progress(c.loop);
      const s = p * 4.2;
      const beat = band(s, 0, 0.4) * (1 - ease(band(s, 3.4, 4.2)));
      out.amount = (0.3 + 1.6 * c.swim) * (1 + 3.5 * beat);
      const th = TAU * ease(band(s, 0.3, 3.6));
      const { F, N } = PARAMECIUM;
      const rho = 0.28;
      const rock = quatAxisAngle([1, 0.1, 0], 0.25 * Math.sin(t * 0.5) * (1 - beat));
      out.body = {
        quat: quatMul(quatAxisAngle(VIEW, th), rock),
        offset: add(mul(F, rho * Math.sin(th)), mul(N, rho * (1 - Math.cos(th)))),
      };
    },
    build(k, o) {
      const col = o.color;
      // Lying across the view, tipped up to the right.
      const q = quatEuler(0, 31, 24);
      const W = (p) => quatRotate(q, p);
      // A slipper: a long ellipsoid, blunt in front, with an oral groove.
      const shape = (d) => {
        const ex = d[0] >= 0 ? 1.0 : 1.1;
        const e = 1 / Math.hypot(d[0] / ex, d[1] / 0.38, d[2] / 0.42);
        const groove =
          Math.exp(-(((d[0] - 0.1) / 0.3) ** 2)) *
          smoothstep(0.1, 0.8, d[2]) *
          smoothstep(0.2, -0.3, d[1]);
        return e * (1 - 0.18 * groove);
      };
      const radius = (d) => shape(d);
      const viewL = quatRotate([-q[0], -q[1], -q[2], q[3]], VIEW);
      k.add(k.radial(radius, { grid: 72 }), {
        quat: q,
        flat: 0.2,
        opacity: 0.6,
        share: 0.3,
        color: (c) => {
          const d = unit(c.lp);
          const groove =
            Math.exp(-(((d[0] - 0.1) / 0.28) ** 2)) *
            smoothstep(0.3, 0.8, d[2]) *
            smoothstep(0.1, -0.3, d[1]);
          const stripe = Math.abs(Math.sin(Math.atan2(d[2], d[1]) * 16 + d[0] * 5)) > 0.8;
          let col2 = stripe ? shade(col, 0.85) : col;
          col2 = mix(col2, shade(col, 0.55), groove);
          // Darker towards the outline, like a cell under the microscope.
          const face = Math.abs(dot(c.ln, viewL));
          return litGloss(shade(col2, 0.62 + 0.45 * face), c.n, 0.3);
        },
      });
      // Inside: the macronucleus, food vacuoles and two star-shaped contractile vacuoles.
      k.add(k.ellipsoid(0.3, 0.17, 0.18), {
        pos: W([0.08, 0.02, -0.06]),
        quat: q,
        weight: 1.3,
        pattern: false,
        color: (c) => litGloss("#7c4fc4", c.n, 0.3),
      });
      k.add(k.sphere(0.07), {
        pos: W([0.25, 0.1, 0.02]),
        weight: 1.5,
        pattern: false,
        color: (c) => lit("#b48be6", c.n),
      });
      for (let i = 0; i < 9; i++) {
        const p = [-0.75 + (1.35 * i) / 8, (k.rand() * 2 - 1) * 0.14, (k.rand() * 2 - 1) * 0.16];
        k.add(k.sphere(0.055 + 0.03 * k.rand()), {
          pos: W(p),
          weight: 1.3,
          pattern: false,
          color: (c) => litGloss(["#f29d4b", "#e5566f", "#c9a227"][i % 3], c.n, 0.4),
        });
      }
      for (const x of [-0.62, 0.6]) {
        const cvp = W([x, 0.18, 0]);
        k.add(k.sphere(0.07), { pos: cvp, weight: 2, pattern: false, color: "#dff3ff" });
        for (let j = 0; j < 7; j++) {
          const a = (j / 7) * TAU;
          const d = unit(W([Math.cos(a) * 0.9, 0.15, Math.sin(a)]));
          k.add(
            k.tube(spline([cvp, add(cvp, mul(d, 0.12)), add(cvp, mul(d, 0.2))]), 0.014, {
              grid: 8,
              samples: 16,
            }),
            { weight: 2, pattern: false, color: "#a8dcff" },
          );
        }
      }
      // Cilia all over, beating in waves.
      k.cloud({ share: 0.1, size: 0.55, pattern: false }, (rand) => {
        const d = randDir(rand);
        const r = radius(d);
        const p = mul(d, r);
        const n = unit([d[0], d[1] / 0.14, d[2] / 0.18]);
        const l = 0.025 + 0.025 * rand();
        return {
          p: W(add(p, mul(n, l))),
          dir: W(n),
          stretch: 3.2,
          color: shade(col, 0.75),
          opacity: 0.9,
          kind: "wave",
          params: [0.012, 0],
        };
      });
      // A tuft of longer cilia at the back.
      k.cloud({ share: 0.004, size: 0.5, pattern: false }, (rand) => {
        const a = rand() * TAU;
        const s = rand();
        const d = unit([-1, 0.5 * Math.cos(a), 0.5 * Math.sin(a)]);
        const p = add([-1.08, 0, 0], mul(d, 0.2 * s));
        return {
          p: W(p),
          dir: W(d),
          stretch: 3,
          color: shade(col, 0.7),
          opacity: 0.9,
          kind: "wave",
          params: [0.03, 0],
        };
      });
    },
  },

  // ---- Amoeba -------------------------------------------------------------------------
  amoeba: {
    alive: true,
    options: [{ key: "color", label: "Colour", type: "color", default: "#9fb6ea" }],
    controls: [{ key: "crawl", label: "Crawl", type: "pulse", ease: 5.2 }],
    action: { key: "crawl", label: "Crawl" },
    // A tap makes it crawl: a pseudopod pushes out to the right (channel 0)
    // and the cell oozes over into it, then one pushes out to the left
    // (channel 1) and it oozes back. At rest its pods stretch a little.
    drive(t, c, out) {
      const p = progress(c.crawl);
      const s = p * 5.2;
      const on = c.crawl > 0 ? 1 : 0;
      const right = ease(band(s, 0.05, 1.1)) * (1 - ease(band(s, 1.2, 2.4)));
      const left = ease(band(s, 2.5, 3.5)) * (1 - ease(band(s, 3.6, 4.9)));
      const over = ease(band(s, 1.1, 2.5)) * (1 - ease(band(s, 3.5, 5)));
      const idle = 0.07 * (1 - on);
      out.morph = [right + idle * Math.sin(t * 0.7), left + idle * Math.sin(t * 0.7 + 2.5)];
      out.body = { offset: mul(AMOEBA_DIR, 0.36 * over) };
      out.amount = 1;
    },
    build(k, o) {
      const col = o.color;
      k.fitMorphs = false; // a new pod stays inside the view
      // Pseudopods reaching out across a flattened blob.
      const pods = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + k.rand() * 0.6;
        pods.push({
          d: unit([Math.cos(a), (k.rand() - 0.5) * 0.3, Math.sin(a)]),
          l: 0.35 + 0.35 * k.rand(),
          w: 0.3 + 0.1 * k.rand(),
        });
      }
      const radius = (d) => {
        let r = 0.72 + 0.06 * k.noise(d[0] * 2.5, d[1] * 2.5, d[2] * 2.5);
        for (const p of pods) {
          const c = dot(d, p.d);
          r += p.l * Math.pow(Math.max(0, (c - (1 - p.w)) / p.w), 1.6);
        }
        return r;
      };
      const breathe = { kind: "breathe", params: [0.035, 0] };
      // Each side of the cell can push out a new pseudopod.
      const pod = (p, sgn) => {
        const D = mul(AMOEBA_DIR, sgn);
        const r = Math.hypot(p[0], p[2]);
        const d = [p[0] / (r || 1), 0, p[2] / (r || 1)];
        const cg = dot(d, D);
        // A broad lobe with a round tip: the skin bulges out most along
        // the pod's line, less to the sides, and draws in a little.
        const f = Math.exp(-((Math.acos(clamp(cg, -1, 1)) / 0.55) ** 2));
        const reach = r + 0.6 * f;
        const along = add(mul(D, cg * reach), mul(sub(d, mul(D, cg)), r * (1 - 0.3 * f)));
        return [along[0], p[1] * (1 - 0.12 * f), along[2]];
      };
      const side = (p) => (dot(p, AMOEBA_DIR) >= 0 ? 0 : 1);
      k.add(k.radial(radius, { grid: 96 }), {
        channel: (c) => side(c.p),
        to: (c) => pod(c.p, side(c.p) ? -1 : 1),
        scale: [1, 0.42, 1],
        flat: 0.3,
        opacity: 0.55,
        share: 0.4,
        color: (c) => {
          const d = unit(c.lp);
          const rim = smoothstep(0.75, 1.3, radius(d));
          const face = Math.abs(c.n[1]);
          const base = mix(col, "#eef3ff", 0.4 * rim);
          return litGloss(shade(base, 0.7 + 0.35 * face), c.n, 0.35);
        },
      });
      // Granular cytoplasm in the middle, clear at the edges.
      k.cloud({ share: 0.04, size: 0.7, pattern: false }, (rand) => {
        const d = unit([rand() * 2 - 1, (rand() * 2 - 1) * 0.2, rand() * 2 - 1]);
        const r = radius(d) * 0.75 * Math.sqrt(rand());
        const p = [d[0] * r, (rand() * 2 - 1) * 0.12, d[2] * r];
        // Granules stream into a new pod.
        const ch = side(p);
        const D = mul(AMOEBA_DIR, ch ? -1 : 1);
        const flow = 0.45 * smoothstep(-0.2, 0.7, dot(p, D)) * (0.6 + 0.4 * rand());
        return {
          p,
          color: mix(shade(col, 0.55), "#5a6fa8", rand()),
          opacity: 0.9,
          channel: ch,
          to: add(p, mul(D, flow)),
        };
      });
      // Inside: nucleus, a pulsing contractile vacuole and food vacuoles.
      k.add(k.ellipsoid(0.24, 0.13, 0.24), {
        ...breathe,
        pos: [-0.1, 0.02, 0.05],
        weight: 1.3,
        pattern: false,
        color: (c) => litGloss("#5b3fa8", c.n, 0.3),
      });
      k.add(k.sphere(0.13), {
        pos: [0.3, 0.05, -0.22],
        weight: 1.3,
        pattern: false,
        kind: "breathe",
        params: [0.12, 1.5],
        color: (c) => litGloss("#e6f4ff", c.n, 0.6),
      });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + k.rand() * 0.5;
        const r = 0.3 + 0.3 * k.rand();
        k.add(k.sphere(0.06 + 0.03 * k.rand()), {
          ...breathe,
          pos: [r * Math.cos(a), 0.02, r * Math.sin(a)],
          weight: 1.3,
          pattern: false,
          color: (c) => litGloss(["#6cc25a", "#e39a3b", "#d0607a"][i % 3], c.n, 0.4),
        });
      }
    },
  },
};

// ---- DNA geometry (shared by build and drive) ------------------------------------------
// The helix stands along Y in its own frame and is tilted as a whole. The top
// of each strand is cut into segments (parts) that swing open like a zip.

const DNA = (() => {
  const height = 3.6;
  const pitch = 1.8;
  const radius = 0.52;
  const offset = (150 / 180) * Math.PI;
  const forkY = -1.3;
  // Phase so that the strands part left and right (along X) at the fork.
  const phase = Math.PI / 2 - offset / 2 - (forkY / pitch) * TAU;
  const tilt = quatAxisAngle([0.15, 0, 1], -0.5);
  return {
    height,
    pitch,
    radius,
    offset,
    forkY,
    phase,
    tilt,
    segs: 6,
    step: pitch / 10,
    y0: -height / 2 + 0.12,
    axis: quatRotate(tilt, [0, 1, 0]),
    open: 0.13,
  };
})();

function dnaStrand(s, y) {
  const a = (y / DNA.pitch) * TAU + DNA.phase + (s === "b" ? DNA.offset : 0);
  return [DNA.radius * Math.cos(a), y, DNA.radius * Math.sin(a)];
}

function dnaBound(j) {
  return DNA.forkY + ((DNA.height / 2 - DNA.forkY) * j) / DNA.segs;
}

// The direction a strand swings to as it opens (in the helix frame).
function dnaSide(s) {
  const d = sub(dnaStrand(s, DNA.forkY), dnaStrand(s === "a" ? "b" : "a", DNA.forkY));
  return unit([d[0], 0, d[2]]);
}

// Rigid transforms of the segments of one strand, unzipped by u, in the helix
// frame: [{ pivot, quat, offset }].
function dnaChain(s, u) {
  const axis = cross([0, 1, 0], dnaSide(s));
  const out = [];
  let prevQ = [0, 0, 0, 1];
  let prevPivot = dnaStrand(s, dnaBound(0));
  let prevMoved = prevPivot;
  for (let j = 0; j < DNA.segs; j++) {
    const pivot = dnaStrand(s, dnaBound(j));
    // Where this joint has been carried by the segments below it.
    const moved = j === 0 ? pivot : add(prevMoved, quatRotate(prevQ, sub(pivot, prevPivot)));
    const q = quatAxisAngle(axis, u * DNA.open * (j + 1));
    out.push({ pivot, quat: q, offset: sub(moved, pivot) });
    prevQ = q;
    prevPivot = pivot;
    prevMoved = moved;
  }
  return out;
}

function dnaPivot(s, j) {
  return quatRotate(DNA.tilt, dnaStrand(s, dnaBound(j)));
}

// The top end of a strand when fully open (for framing).
function dnaTip(s) {
  const chain = dnaChain(s, 1);
  const last = chain[DNA.segs - 1];
  const top = dnaStrand(s, DNA.height / 2);
  return add(add(last.pivot, quatRotate(last.quat, sub(top, last.pivot))), last.offset);
}

// Part transforms for a twist angle and an unzip amount, in recipe coordinates.
function dnaParts(twist, u) {
  const T = DNA.tilt;
  const Ti = [-T[0], -T[1], -T[2], T[3]];
  const R = quatMul(T, quatMul(quatAxisAngle([0, 1, 0], twist), Ti));
  const parts = { lower: { quat: R } };
  for (const s of ["a", "b"]) {
    dnaChain(s, u).forEach((seg, j) => {
      const pw = quatRotate(T, seg.pivot);
      const qw = quatMul(T, quatMul(seg.quat, Ti));
      const ow = quatRotate(T, seg.offset);
      parts[s + j] = {
        quat: quatMul(R, qw),
        offset: sub(quatRotate(R, add(pw, ow)), pw),
      };
    });
  }
  return parts;
}

// The neuron's axon (shared by its build and the signal's drive), and the
// lags of the signal spark and its tail along it.
let neuronAxonCurve = null;
function neuronAxon() {
  if (!neuronAxonCurve) {
    const soma = [-0.6, 0.42, 0];
    neuronAxonCurve = spline([
      add(soma, [0.26, -0.18, 0]),
      [-0.05, 0.08, 0.08],
      [0.32, -0.02, -0.05],
      [0.62, -0.28, 0.05],
      [0.72, -0.62, 0],
      [0.78, -0.92, -0.05],
    ]);
  }
  return neuronAxonCurve;
}
const NEURON_SPARKS = [0, 0.025, 0.05, 0.075];

// The bacteriophage sheath: how many bands, and how far each slides.
const PHAGE_BANDS = 6;
const PHAGE_SLIDE = 0.15;
// How far the tail tube pokes out below the plate, and the legs' splay (radians).
const PHAGE_POKE = 0.3;
const PHAGE_SPLAY = 0.45;

// ---- Bacterium fission --------------------------------------------------------------

// The rod (half length and radius, lying along its local x, tilted up to
// the right across the view) and its two daughters: shorter capsules,
// DAUGHTER_HALF long, whose inner ends meet at the middle.
const BAC = (() => {
  const tilt = quatFromTo([1, 0, 0], unit([0.82, 0.34, -0.46]));
  const half = 0.75;
  const R = 0.42;
  const hd = 0.2;
  const Rd = 0.4;
  return {
    half,
    R,
    hd,
    Rd,
    tilt,
    untilt: [-tilt[0], -tilt[1], -tilt[2], tilt[3]],
    axis: quatRotate(tilt, [1, 0, 0]),
    D: hd + Rd + 0.025, // a daughter's centre from the middle
    apart: 0.13, // how far each daughter slides out
  };
})();

// Where a point of the rod's skin goes when the cell has pinched in two
// (rod-local coordinates): its half's skin, from the outer pole to the
// middle, is spread over a whole daughter capsule, so the middle closes
// into the daughter's new round end.
function fission(P) {
  const { half, R, hd, Rd, D } = BAC;
  const sgn = P[0] >= 0 ? 1 : -1;
  const ax = Math.abs(P[0]);
  const r = Math.hypot(P[1], P[2]);
  const dir = r > 1e-6 ? [P[1] / r, P[2] / r] : [1, 0];
  const cap = (Math.PI / 2) * R;
  const s = ax > half ? R * Math.atan2(r, ax - half) : cap + (half - ax);
  const capD = (Math.PI / 2) * Rd;
  const total = 2 * capD + 2 * hd;
  const sd = (s / (cap + half)) * total;
  let x;
  let rr;
  if (sd < capD) {
    x = hd + Rd * Math.cos(sd / Rd);
    rr = Rd * Math.sin(sd / Rd);
  } else if (sd < capD + 2 * hd) {
    x = hd - (sd - capD);
    rr = Rd;
  } else {
    const a = (total - sd) / Rd;
    x = -hd - Rd * Math.cos(a);
    rr = Rd * Math.sin(a);
  }
  return [sgn * (D + x), dir[0] * rr, dir[1] * rr];
}

// Where a point inside the rod goes: into its own half's daughter, which
// is about half as long.
function inside(P) {
  const { half, R, hd, D } = BAC;
  const sgn = P[0] >= 0 ? 1 : -1;
  const e = half + R * 0.5;
  const ed = hd + R * 0.45;
  return [sgn * (D - ed + (Math.abs(P[0]) / e) * 2 * ed), P[1] * 0.95, P[2] * 0.95];
}

// ---- Animal cell division -----------------------------------------------------------

// The cell (radius about 1) divides along AXIS, across the view. Each half
// becomes a daughter cell of radius Rd centred D from the middle; the
// nucleus (centre nc, radius NR) splits into two of radius NRd at the
// daughters' centres.
const CELL = (() => {
  const Rd = 0.62;
  return {
    axis: unit([0.82, 0, -0.5]),
    Rd,
    D: Rd + 0.012,
    nc: [-0.08, 0.02, -0.08],
    NR: 0.4,
    NRd: 0.3,
  };
})();

// A point of a sphere about `center` whose halves (across the division
// axis) each become a whole sphere of `r0` times the point's distance,
// centred `to` from the middle: the angle from the axis doubles, so the
// rim between the halves closes into each new sphere's inner end.
function halveSphere(P, center, scale, to) {
  const A = CELL.axis;
  const v = sub(P, center);
  const a = dot(v, A);
  const sgn = a >= 0 ? 1 : -1;
  const r = len(v);
  const perp = sub(v, mul(A, a));
  const pl = len(perp);
  const dir = pl > 1e-6 ? mul(perp, 1 / pl) : basis(A)[0];
  const alpha = 2 * Math.acos(clamp(Math.abs(a) / (r || 1), 0, 1));
  const out = add(mul(A, sgn * Math.cos(alpha)), mul(dir, Math.sin(alpha)));
  return add(mul(A, sgn * to), mul(out, r * scale));
}

// The membrane: each half wraps a daughter cell.
function cellSkin(P) {
  return halveSphere(P, [0, 0, 0], CELL.Rd, CELL.D);
}

// Where a piece inside the cell goes: into its own half's daughter, kept
// clear of the new nucleus and inside the membrane.
function cellPart(P) {
  const A = CELL.axis;
  const a = dot(P, A);
  const sgn = a >= 0 ? 1 : -1;
  const perp = sub(P, mul(A, a));
  let off = add(mul(A, sgn * (Math.abs(a) - 0.4) * 0.9), mul(perp, 0.6));
  const l = len(off) || 1e-6;
  off = mul(off, clamp(l, CELL.NRd + 0.08, CELL.Rd - 0.1) / l);
  return add(mul(A, sgn * CELL.D), off);
}

// The cytoplasm's fill: into its daughter, inside the membrane.
function cellInside(P) {
  const A = CELL.axis;
  const a = dot(P, A);
  const sgn = a >= 0 ? 1 : -1;
  const perp = sub(P, mul(A, a));
  let off = add(mul(A, sgn * (Math.abs(a) - 0.45) * 1.05), mul(perp, 0.62));
  const l = len(off) || 1e-6;
  off = mul(off, Math.min(l, CELL.Rd - 0.06) / l);
  return add(mul(A, sgn * CELL.D), off);
}

// The nucleus splits into two smaller ones at the daughters' centres.
function nucleusSplit(P) {
  return halveSphere(P, CELL.nc, CELL.NRd / CELL.NR, CELL.D);
}

// The nucleolus splits too: one small one in each new nucleus.
function nucleolusSplit(P, at, r) {
  const A = CELL.axis;
  const sgn = dot(sub(P, at), A) >= 0 ? 1 : -1;
  const home = add(mul(A, sgn * CELL.D), mul(sub(at, CELL.nc), CELL.NRd / CELL.NR));
  return add(halveSphere(P, at, 0.72, 0), home);
}

// The ER round the nucleus goes with each new nucleus, drawn in a little.
function erSplit(P) {
  const A = CELL.axis;
  const v = sub(P, CELL.nc);
  const sgn = dot(v, A) >= 0 ? 1 : -1;
  return add(mul(A, sgn * CELL.D), mul(v, 0.7));
}

// ---- White blood cell's catch -------------------------------------------------------

// E: the direction the bacterium comes from (the right of the view, a
// little up); F: where it ends up inside the cell (the path bends in
// through the cup to it); side: across its path.
const WBC = (() => {
  const E = unit([0.8, 0.42, -0.42]);
  // Just under the front of the membrane, so it shows as it is digested.
  const F = add(mul(E, 0.5), mul(VIEW, 0.4));
  return { E, F, side: unit(cross(E, VIEW)) };
})();

// The phagocytic cup: round the side facing E the membrane rises into a
// rim that reaches out and curls round the bacterium, and the middle of
// the cup dips in where the bacterium presses.
function wbcCup(P) {
  const { E } = WBC;
  const r = len(P);
  const d = mul(P, 1 / (r || 1));
  const g = Math.acos(clamp(dot(d, E), -1, 1));
  const rim = Math.exp(-(((g - 0.6) / 0.3) ** 2));
  const dip = Math.exp(-((g / 0.32) ** 2));
  const toAxis = sub(mul(E, dot(d, E)), d); // towards the cup's middle
  return add(P, add(mul(E, 0.44 * rim - 0.14 * dip), mul(toAxis, 0.38 * rim)));
}

// The amoeba crawls to the right of the view and back.
const AMOEBA_DIR = unit([0.82, 0, -0.5]);

// The virus's copies leave along the view's diagonal (up-left and
// down-right on screen). They are built at `home`, `scale` times the size.
const VIRUS = (() => {
  const right = unit(cross([0, 1, 0], VIEW));
  const up = cross(VIEW, right);
  const behind = 0.6;
  return {
    diag: unit(add(mul(right, -0.75), mul(up, 0.66))),
    behind,
    home: mul(VIEW, -behind), // where the copies are built
    scale: 0.55,
  };
})();

// The diatom's shell faces up and a little towards the view.
const DIATOM_AXIS = unit([0.15, 0.85, 0.5]);

// The paramecium's loop: F is its front as seen on screen, N the side it
// turns towards (turning about VIEW by a positive angle).
const PARAMECIUM = (() => {
  const front = quatRotate(quatEuler(0, 31, 24), [1, 0, 0]);
  const F = unit(sub(front, mul(VIEW, dot(front, VIEW))));
  return { F, N: cross(VIEW, F) };
})();

// ---- Snowflake ----------------------------------------------------------------------

// One six-armed flake of a style and variant, as a part. Each splat grows
// in (kind "grow") by its distance from the centre, so the arms grow out
// from the middle and melt back from their tips.
function snowflake(k, style, variant, part) {
  const grow = {
    kind: "grow",
    params: (c) => [clamp(Math.hypot(c.p[0], c.p[1]) / 1.12, 0, 0.92), 0],
  };
  // Its own random numbers, so each variant is a different flake.
  let seed = (variant * 7919 + style.length * 104729) >>> 0;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ice = (c) => {
    const r = Math.hypot(c.p[0], c.p[1]);
    let col = mix("#e8f6ff", "#6fb8ee", smoothstep(0.1, 1.05, r));
    if (c.n[2] < 0) col = shade(col, 0.9);
    return col;
  };
  const segs = [];
  // A flat bar from a to b (in the XY plane) of width w.
  const bar = (a, b, w) => segs.push({ a, b, w });
  const plates = [];
  // One arm along +Y; the others are copies turned by 60 degrees.
  const arm = [];
  const L = 1;
  if (style === "star") {
    arm.push({ a: [0, 0], b: [0, L], w: 0.11 });
    arm.push({ a: [0, 0.55], b: [0.16, 0.72], w: 0.05 });
    arm.push({ a: [0, 0.55], b: [-0.16, 0.72], w: 0.05 });
  } else if (style === "plate") {
    plates.push({ r: 0.62, w: 0.05 });
    arm.push({ a: [0, 0], b: [0, 0.62], w: 0.06 });
    for (let i = 1; i <= 3; i++) {
      const y = 0.15 * i;
      const l = 0.12 + 0.05 * i * rnd();
      arm.push({ a: [0, y], b: [l * 0.87, y + l * 0.5], w: 0.025 });
      arm.push({ a: [0, y], b: [-l * 0.87, y + l * 0.5], w: 0.025 });
    }
    arm.push({ a: [0, 0.62], b: [0, L], w: 0.08 });
    arm.push({ a: [0, 0.85], b: [0.13, 0.95], w: 0.04 });
    arm.push({ a: [0, 0.85], b: [-0.13, 0.95], w: 0.04 });
  } else {
    const fern = style === "fern";
    arm.push({ a: [0, 0], b: [0, L], w: 0.07 });
    const n = fern ? 9 : 4 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const y = 0.18 + (0.72 * (i + 0.5 * rnd())) / n;
      const env = Math.sin(((y - 0.1) / 0.95) * Math.PI);
      const l = (fern ? 0.28 : 0.3 + 0.15 * rnd()) * (0.35 + 0.65 * env);
      for (const s of [1, -1]) {
        const b = [s * l * 0.87, y + l * 0.5];
        arm.push({ a: [0, y], b, w: fern ? 0.03 : 0.045 });
        if (!fern && l > 0.2) {
          // Side branches of the side branches.
          for (let j = 1; j <= 2; j++) {
            const f = j / 3;
            const p = [s * l * 0.87 * f, y + l * 0.5 * f];
            const l2 = l * (0.35 - 0.1 * j);
            arm.push({ a: p, b: [p[0], p[1] + l2], w: 0.025 });
            arm.push({ a: p, b: [p[0] + s * l2 * 0.87, p[1] - l2 * 0.5], w: 0.025 });
          }
        }
      }
    }
    if (!fern) plates.push({ r: 0.17, w: 0.04 });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const rot = (p) => [p[0] * ca - p[1] * sa, p[0] * sa + p[1] * ca, 0];
    for (const s of arm) bar(rot(s.a), rot(s.b), s.w);
  }
  for (const s of segs) {
    const d = sub(s.b, s.a);
    const l = len(d);
    k.add(k.box(s.w, l + s.w * 0.8, 0.035), {
      pos: lerp(s.a, s.b, 0.5),
      rot: [0, 0, (Math.atan2(-d[0], d[1]) * 180) / Math.PI],
      flat: 0.2,
      part,
      ...grow,
      color: (c) => (c.s.face === 4 && Math.abs(c.lp[0]) < s.w * 0.2 ? "#ffffff" : ice(c)),
    });
  }
  // Hexagonal plates with a ridge inside the rim.
  const hex = (r, h) => {
    const tris = [];
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * TAU + TAU / 12;
      const a1 = ((i + 1) / 6) * TAU + TAU / 12;
      const p0 = [r * Math.cos(a0), r * Math.sin(a0)];
      const p1 = [r * Math.cos(a1), r * Math.sin(a1)];
      for (const z of [h, -h])
        tris.push([
          [0, 0, z],
          [p0[0], p0[1], z],
          [p1[0], p1[1], z],
        ]);
      tris.push([
        [p0[0], p0[1], h],
        [p0[0], p0[1], -h],
        [p1[0], p1[1], -h],
      ]);
      tris.push([
        [p0[0], p0[1], h],
        [p1[0], p1[1], -h],
        [p1[0], p1[1], h],
      ]);
    }
    return facets(tris, h);
  };
  for (const pl of plates) {
    k.add(hex(pl.r, 0.014), {
      flat: 0.2,
      part,
      ...grow,
      color: (c) => {
        const r = Math.hypot(c.p[0], c.p[1]);
        const a = Math.atan2(c.p[1], c.p[0]);
        // Distance to the hexagon's edge, for the inner ridge line.
        const sec = (((a - TAU / 12) % (TAU / 6)) + TAU / 6) % (TAU / 6);
        const apo = r * Math.cos(sec - TAU / 12);
        const inner = Math.abs(apo - pl.r * 0.7) < 0.015 || Math.abs(apo - pl.r * 0.4) < 0.012;
        return inner ? "#ffffff" : mix(ice(c), "#d7efff", 0.4);
      },
    });
  }
}
