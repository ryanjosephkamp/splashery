// Lane Optics: the light bench's scene, without the splats. The parts on
// the bench, their surfaces where they stand now, the light traced through
// them (as colored polylines) and the numbers. Pure JavaScript, so the tests
// run it in Node (tests/opt.spec.mjs).
//
// Units: recipe units, 1 = 10 cm. The bench is W × H, its middle at the
// origin, light mostly going left to right.

import {
  LINES,
  blockSurfaces,
  crossing,
  fiberNumbers,
  fiberSurfaces,
  imageDistance,
  indexOf,
  lensSurfaces,
  mirrorSurfaces,
  place,
  prismCorners,
  prismSurfaces,
  rot,
  segment,
  thickLens,
  trace,
  wavelengthRGB,
} from "./rays.js";

export const BENCH = { W: 3.2, H: 2.0 };
const deg = (r) => (r * 180) / Math.PI;
const f1 = (x, n = 1) => (Math.abs(x) < 0.05 && n === 1 ? "0" : x.toFixed(n));
const cm = (x, n = 1) => `${(x * 10).toFixed(n)} cm`;

// The light: white (a bundle of wavelengths) or one laser line.
export const LIGHTS = [
  { id: "white", label: "White light" },
  { id: "red", label: "Red laser (650 nm)", nm: 650 },
  { id: "green", label: "Green laser (532 nm)", nm: 532 },
  { id: "blue", label: "Blue laser (450 nm)", nm: 450 },
];
// White light as nine wavelengths across the visible spectrum.
export const WHITE = [410, 445, 475, 505, 540, 587.6, 610, 635, 665];

export const SETUPS = [
  { id: "prism", label: "Prism (white light into colors)" },
  { id: "lens", label: "Lens and image" },
  { id: "mirrors", label: "Mirrors" },
  { id: "block", label: "Glass block (refraction)" },
  { id: "fiber", label: "Light guide (total internal reflection)" },
];

// Real lenses: each face's sag at the rim leaves glass at the edge (a
// lens's center thickness must exceed the two sags together).
export const LENSES = [
  { id: "thin", label: "Thin biconvex", R1: 0.75, R2: -0.75, t: 0.045, h: 0.17 },
  { id: "thick", label: "Thick biconvex", R1: 0.5, R2: -0.5, t: 0.3, h: 0.2 },
  { id: "plano", label: "Plano-convex", R1: 0.38, R2: Infinity, t: 0.08, h: 0.18 },
  { id: "concave", label: "Biconcave", R1: -0.75, R2: 0.75, t: 0.03, h: 0.17 },
];

// The parts of a setup, at home. Each: { id, type, pos, angle, … }, with
// `move` ("free", "x": along the axis only, or false) and `turn` (a knob
// turns it). Sources: { type: "lamp" } one beam, { type: "raybox" } a
// parallel beam, { type: "object" } an arrow whose tip sends a fan.
export function homeParts(o) {
  const lens = LENSES.find((l) => l.id === o.lens) || LENSES[0];
  switch (o.setup) {
    case "lens":
      return [
        { id: "object", type: "object", pos: [-1.45, 0], angle: 0, height: 0.15, move: "x", turn: false }, // prettier-ignore
        { id: "lens", type: "lens", pos: [0, 0], angle: 0, lens, move: "x", turn: false },
      ];
    case "mirrors":
      return [
        { id: "box", type: "raybox", pos: [-1.38, 0.3], angle: 0, rays: 5, gap: 0.08, move: "free", turn: true }, // prettier-ignore
        { id: "concave", type: "mirror", pos: [1.3, 0.3], angle: 0, length: 0.8, R: 1.4, move: "free", turn: true }, // prettier-ignore
        { id: "lamp", type: "lamp", pos: [-1.35, -0.25], angle: (-28 * Math.PI) / 180, move: "free", turn: true }, // prettier-ignore
        { id: "plane", type: "mirror", pos: [-0.3, -0.78], angle: -Math.PI / 2, length: 0.7, R: Infinity, move: "free", turn: true }, // prettier-ignore
      ];
    case "block":
      return [
        { id: "lamp", type: "lamp", pos: [-1.05, 0.78], angle: (-35 * Math.PI) / 180, move: "free", turn: true }, // prettier-ignore
        { id: "block", type: "block", pos: [0, 0], angle: 0, w: 1.1, h: 0.5, move: "free", turn: true }, // prettier-ignore
      ];
    case "fiber":
      return [
        { id: "lamp", type: "lamp", pos: [-1.38, -0.62], angle: (9 * Math.PI) / 180, move: "free", turn: true }, // prettier-ignore
        { id: "fiber", type: "fiber", pos: [-1.0, -0.6], angle: 0, R: (Number(o.bend) || 7) / 10, move: false, turn: false }, // prettier-ignore
      ];
    case "prism":
    default: {
      // The lamp aimed at the prism's first face so the yellow light goes
      // through at its least deviation (symmetrically): the incidence i with
      // sin i = n sin(A/2).
      const prism = { id: "prism", type: "prism", pos: [-0.2, 0.22], angle: 0, A: Math.PI / 3, side: 0.85, glass: "N-SF11", move: "free", turn: true }; // prettier-ignore
      const c = prismCorners(prism);
      const mid = [prism.pos[0] + (c[0][0] + c[1][0]) / 2, prism.pos[1] + (c[0][1] + c[1][1]) / 2];
      const i = Math.asin(indexOf(prism.glass, LINES.d) * Math.sin(prism.A / 2));
      const a = i - prism.A / 2; // the face's inward normal points at −A/2
      const lamp = { id: "lamp", type: "lamp", pos: [mid[0] - Math.cos(a) * 1.15, mid[1] - Math.sin(a) * 1.15], angle: a, move: "free", turn: true }; // prettier-ignore
      return [lamp, prism, { id: "screen", type: "screen", pos: [1.3, -0.5], angle: 0, length: 0.9, move: "free", turn: false }]; // prettier-ignore
    }
  }
}

const FIBER = { a: 0.07, b: 0.035, len1: 0.95, bend: (70 * Math.PI) / 180, len2: 0.5, core: "N-SF11", clad: "N-BK7" }; // prettier-ignore

// A part's surfaces in its own frame.
export function partSurfaces(p) {
  switch (p.type) {
    case "lens":
      return lensSurfaces(p.lens);
    case "prism":
      return prismSurfaces({ A: p.A, side: p.side, glass: p.glass });
    case "block":
      return blockSurfaces({ w: p.w, h: p.h });
    case "mirror":
      return mirrorSurfaces({ length: p.length, R: p.R });
    case "fiber":
      return fiberSurfaces({ ...FIBER, R: p.R }).surfaces;
    case "screen":
      return [segment([0, -p.length / 2], [0, p.length / 2], { stop: true })];
    default:
      return [];
  }
}

// The surfaces of every part where it stands, plus the bench's edges (which
// stop the light).
export function sceneSurfaces(parts) {
  const out = [];
  for (const p of parts) for (const s of partSurfaces(p)) out.push({ ...place(s, p.pos, p.angle), part: p.id }); // prettier-ignore
  const { W, H } = BENCH;
  const c = [
    [-W / 2, -H / 2],
    [W / 2, -H / 2],
    [W / 2, H / 2],
    [-W / 2, H / 2],
  ];
  for (let i = 0; i < 4; i++) out.push({ ...segment(c[(i + 1) % 4], c[i], { stop: true }), edge: true }); // prettier-ignore
  return out;
}

// The rays each source sends: [{ o, d }] in bench coordinates.
export function sourceRays(p, parts) {
  const dir = rot([1, 0], p.angle);
  if (p.type === "lamp")
    return [{ o: [p.pos[0] + dir[0] * 0.13, p.pos[1] + dir[1] * 0.13], d: dir }];
  if (p.type === "raybox") {
    const n = rot([0, 1], p.angle);
    const out = [];
    for (let i = 0; i < p.rays; i++) {
      const s = (i - (p.rays - 1) / 2) * p.gap;
      out.push({ o: [p.pos[0] + dir[0] * 0.12 + n[0] * s, p.pos[1] + dir[1] * 0.12 + n[1] * s], d: dir }); // prettier-ignore
    }
    return out;
  }
  if (p.type === "object") {
    // A fan from the arrow's tip across the lens's opening.
    const lens = parts.find((q) => q.type === "lens");
    const tip = [p.pos[0], p.pos[1] + p.height];
    const out = [];
    if (!lens) return out;
    const h = lens.lens.h * 0.85;
    for (let i = 0; i < 7; i++) {
      const y = lens.pos[1] - h + (2 * h * i) / 6;
      const d = [lens.pos[0] - tip[0], y - tip[1]];
      out.push({ o: tip, d });
    }
    return out;
  }
  return [];
}

// Traces everything. Returns { paths: [{ pts, rgb, nm, white, dashed }],
// events (per source, for the numbers), marks } where marks are small
// things to draw (the foci, the image arrow).
export function traceBench(parts, light = "white") {
  const surfaces = sceneSurfaces(parts);
  const L = LIGHTS.find((x) => x.id === light) || LIGHTS[0];
  const nms = L.nm ? [L.nm] : WHITE;
  const paths = [];
  const results = {};
  for (const p of parts) {
    const rays = sourceRays(p, parts);
    if (!rays.length) continue;
    results[p.id] = [];
    for (const r of rays) {
      const bundle = nms.map((nm) => ({ nm, t: traceStop(surfaces, r.o, r.d, nm) }));
      results[p.id].push(bundle);
      if (bundle.length === 1) {
        paths.push({ pts: bundle[0].t.pts, rgb: wavelengthRGB(bundle[0].nm), nm: bundle[0].nm });
        continue;
      }
      // White light: drawn white while every color still follows the same
      // path (within a hair), then each color on its own.
      const ref = bundle[Math.floor(bundle.length / 2)].t.pts;
      let k = 1;
      while (k < ref.length && bundle.every((b) => b.t.pts.length > k && dist(b.t.pts[k], ref[k]) < 0.004)) k++; // prettier-ignore
      paths.push({ pts: ref.slice(0, k), rgb: [1, 1, 1], white: true });
      const group = paths.length;
      for (const b of bundle) {
        const pts = b.t.pts.slice(k - 1);
        if (pts.length > 1) paths.push({ pts, rgb: wavelengthRGB(b.nm), nm: b.nm, group });
      }
    }
  }
  return { paths, results, surfaces, nms };
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// trace() on the bench: the edges and the screens stop the light.
function traceStop(surfaces, o, d, nm) {
  return trace(surfaces, o, d, nm, { far: 6 });
}

// ---- The numbers -----------------------------------------------------------------------

// Lines of plain text for the Toy tab, and marks for the bench.
export function benchNumbers(parts, traced, o) {
  const lines = [];
  const marks = [];
  const light = LIGHTS.find((x) => x.id === o.light) || LIGHTS[0];
  const nmd = light.nm || LINES.d;
  const get = (id) => parts.find((p) => p.id === id);
  const first = (id) => traced.results[id]?.[0]?.find((b) => b.nm === nmd)?.t || traced.results[id]?.[0]?.[Math.floor((traced.results[id]?.[0]?.length || 1) / 2)]?.t; // prettier-ignore
  if (o.setup === "lens") {
    const lens = get("lens");
    const obj = get("object");
    const tl = thickLens(lens.lens, nmd);
    const H = lens.pos[0] + tl.H;
    const H2 = lens.pos[0] + tl.H2;
    const dObj = H - obj.pos[0];
    const di = imageDistance(tl.f, dObj);
    const m = -di / dObj;
    const name = lens.lens.label.toLowerCase();
    lines.push(`A ${name} lens of N-BK7 glass (n = ${tl.n.toFixed(4)} at ${f1(nmd, 1)} nm): R₁ = ${fmtR(lens.lens.R1)}, R₂ = ${fmtR(lens.lens.R2)}, ${cm(lens.lens.t, 1)} thick.`); // prettier-ignore
    lines.push(`Focal length from the lensmaker's equation: f = ${cm(tl.f)}.`);
    if (Number.isFinite(di)) {
      lines.push(`Object distance d_o = ${cm(dObj)}. The lens equation 1/f = 1/d_o + 1/d_i gives d_i = ${cm(di)}${di < 0 ? " (a virtual image, on the object's side)" : ""}, and a magnification of ${f1(m, 2)}.`); // prettier-ignore
      marks.push({ type: "image", x: H2 + di, y: lens.pos[1], h: m * obj.height, virtual: di < 0 });
    } else lines.push(`The object is at the focal point: the rays leave parallel and the image is at infinity.`); // prettier-ignore
    // Where real rays from the arrow's foot, close to the axis, cross it
    // after the lens (traced through the glass, at the same wavelength).
    if (Number.isFinite(di)) {
      const x = axisImage(parts, lens, obj, nmd);
      if (x !== null) lines.push(`Traced: rays from the arrow's foot, close to the axis, cross it again ${cm(x - H2)} past the lens${di < 0 ? " (traced back)" : ""}. Rays through the lens's edge, and from the arrow's tip, cross a little off that (aberrations of real spherical lenses).`); // prettier-ignore
    }
    marks.push({ type: "focus", x: H2 + tl.f, y: lens.pos[1] }, { type: "focus", x: H - tl.f, y: lens.pos[1] }); // prettier-ignore
    if (o.light === "white")
      lines.push(
        "In white light, blue focuses a little nearer the lens than red: chromatic aberration.",
      );
  } else if (o.setup === "prism") {
    const prism = get("prism");
    const lamp = get("lamp");
    const t = traced.results.lamp?.[0];
    const ev = t?.[0]?.t.events?.[0];
    if (ev && ev.surface?.part === "prism") {
      lines.push(`The light meets the prism (${prism.glass} glass, apex ${f1(deg(prism.A), 0)}°) at ${f1(deg(ev.i1))}° to the normal.`); // prettier-ignore
      const rows = [];
      for (const b of t) {
        const out = b.t.events.filter((e) => e.surface?.part === "prism");
        if (out.length < 2 || out[out.length - 1].type !== "refract") continue;
        const dIn = rot([1, 0], lamp.angle);
        const last = lastSeg(b.t);
        const dev = Math.acos(Math.max(-1, Math.min(1, dIn[0] * last.d[0] + dIn[1] * last.d[1])));
        rows.push({ nm: b.nm, n: indexOf(prism.glass, b.nm), dev });
      }
      if (rows.length) {
        const show = rows.length > 3 ? [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]] : rows; // prettier-ignore
        lines.push(`Bent by ${show.map((r) => `${f1(deg(r.dev))}° at ${r.nm} nm (n = ${r.n.toFixed(4)})`).join(", ")}.`); // prettier-ignore
        if (rows.length > 1) lines.push(`Glass bends blue light more than red (its index is higher for shorter waves), so white light fans out into its colors.`); // prettier-ignore
      } else
        lines.push(
          "The light doesn't get out through the far face (it reflects inside). Turn the prism or the lamp.",
        );
    } else lines.push("Aim the lamp at the prism: drag the lamp, or turn it by its knob.");
  } else if (o.setup === "block") {
    const t = first("lamp");
    const evs = (t?.events || []).filter((e) => e.surface?.part === "block");
    if (evs.length) {
      const e = evs[0];
      lines.push(`Into the glass (N-BK7, n = ${e.n2.toFixed(4)} at ${f1(nmd, 1)} nm): ${f1(deg(e.i1))}° to the normal outside, ${f1(deg(e.i2))}° inside.`); // prettier-ignore
      lines.push(`Snell's law: n₁ sin θ₁ = n₂ sin θ₂, so sin θ₂ = sin ${f1(deg(e.i1))}° ÷ ${e.n2.toFixed(4)} = ${(Math.sin(e.i1) / e.n2).toFixed(4)}, θ₂ = ${f1(deg(Math.asin(Math.sin(e.i1) / e.n2)))}°.`); // prettier-ignore
      const e2 = evs.find((x, i) => i > 0 && x.type === "refract");
      if (e2) lines.push(`Out the other side it bends back to ${f1(deg(e2.i2))}°, parallel to where it came in, shifted sideways.`); // prettier-ignore
      const tir = evs.find((x) => x.type === "tir");
      if (tir) lines.push(`Inside, it meets a face at ${f1(deg(tir.i1))}°, past the critical angle of ${f1(deg(Math.asin(1 / tir.n1)))}°, and reflects totally.`); // prettier-ignore
    } else lines.push("Aim the laser at the block: drag the lamp, or turn it by its knob.");
  } else if (o.setup === "fiber") {
    const fn = fiberNumbers(FIBER.core, FIBER.clad, nmd);
    lines.push(`A light guide: a core of N-SF11 glass (n = ${fn.n1.toFixed(4)}) in a cladding of N-BK7 (n = ${fn.n2.toFixed(4)}), at ${f1(nmd, 1)} nm.`); // prettier-ignore
    lines.push(`Light meeting the wall at more than the critical angle, sin θc = n₂ ÷ n₁, θc = ${f1(deg(fn.critical))}°, reflects totally. From the air it accepts rays up to ${f1(deg(fn.accept))}° off its axis (numerical aperture ${fn.NA.toFixed(3)}).`); // prettier-ignore
    const t = first("lamp");
    const evs = t?.events || [];
    const n = evs.filter((e) => e.type === "tir").length;
    const leak = evs.some((e) => e.type === "refract" && e.surface?.part === "fiber" && e.n2 < e.n1 && e.n2 > 1.01); // prettier-ignore
    const entered = evs[0]?.surface?.part === "fiber";
    if (!entered) lines.push("Aim the laser into the end of the guide.");
    else lines.push(`This ray goes in at ${f1(deg(evs[0].i1))}° and reflects ${n} times${leak ? "; at the bend it meets the wall under the critical angle and leaks out" : " and comes out the far end"}.`); // prettier-ignore
  } else if (o.setup === "mirrors") {
    const conc = get("concave");
    lines.push(`The curved mirror's radius is ${cm(conc.R)}, so it brings a parallel beam to a focus at f = R ÷ 2 = ${cm(conc.R / 2)} in front of it.`); // prettier-ignore
    marks.push({ type: "focus", at: addv(conc.pos, rot([-conc.R / 2, 0], conc.angle)) });
    const t = first("lamp");
    const ev = (t?.events || []).find((e) => e.type === "reflect" && e.surface?.part === "plane");
    if (ev)
      lines.push(`The laser meets the flat mirror at ${f1(deg(ev.i1))}° to the normal and leaves at ${f1(deg(ev.i2))}°: the angle of reflection equals the angle of incidence.`); // prettier-ignore
    else lines.push("Drag the flat mirror into the laser's path (or turn the laser by its knob).");
  }
  return { lines, marks };
}

const addv = (a, b) => [a[0] + b[0], a[1] + b[1]];

// Traces a ray from the object's foot (on the axis) through the lens at a
// small height and returns where it crosses the axis after the lens (its
// line extended backward for a virtual image), in bench x.
export function axisImage(parts, lens, obj, nm, height = 0.004) {
  const surfaces = partSurfaces(lens).map((s) => place(s, lens.pos, lens.angle));
  const o = [obj.pos[0], lens.pos[1]];
  const t = trace(surfaces, o, [lens.pos[0] - o[0], height], nm, { far: 1 });
  if (t.events.length < 2) return null;
  const s = lastSeg(t);
  if (Math.abs(s.d[1]) < 1e-12) return null;
  return s.p[0] - ((s.p[1] - lens.pos[1]) * s.d[0]) / s.d[1];
}
const fmtR = (R) => (Number.isFinite(R) ? cm(R) : "flat");
function lastSeg(t) {
  const n = t.pts.length;
  const a = t.pts[n - 2];
  const b = t.pts[n - 1];
  const d = [b[0] - a[0], b[1] - a[1]];
  const l = Math.hypot(d[0], d[1]) || 1;
  return { p: a, d: [d[0] / l, d[1] / l] };
}

// A part's outline in its own frame, as closed polygons (for drawing its
// glass and finding taps on it).
export function partOutline(p) {
  const arcPts = (s, n = 24) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = s.a0 + (s.sweep * i) / n;
      out.push([s.c[0] + s.r * Math.cos(a), s.c[1] + s.r * Math.sin(a)]);
    }
    return out;
  };
  if (p.type === "prism") return [prismCorners({ A: p.A, side: p.side })];
  if (p.type === "block") return [[[-p.w / 2, -p.h / 2], [p.w / 2, -p.h / 2], [p.w / 2, p.h / 2], [-p.w / 2, p.h / 2]]]; // prettier-ignore
  if (p.type === "lens") {
    const s = lensSurfaces(p.lens);
    const f = s[0].kind === "arc" ? arcPts(s[0]) : [s[0].a, s[0].b];
    const g = s[1].kind === "arc" ? arcPts(s[1]) : [s[1].a, s[1].b];
    // Walk the first face top to bottom, then the second bottom to top.
    const top = (pts) => (pts[0][1] > pts[pts.length - 1][1] ? pts : pts.slice().reverse());
    const A = top(f);
    const B = top(g).slice().reverse();
    return [[...A, ...B]];
  }
  if (p.type === "fiber") return [guidePoly(p.R, FIBER.a + FIBER.b), guidePoly(p.R, FIBER.a)];
  return [];
}

// The outline of a guide of half width w: along one wall, round the bend,
// across the far end and back along the other wall.
function guidePoly(R, w) {
  const c = [FIBER.len1, R];
  const outer = [[0, -w], [FIBER.len1, -w]]; // prettier-ignore
  const inner = [[0, w], [FIBER.len1, w]]; // prettier-ignore
  const n = 24;
  for (let i = 1; i <= n; i++) {
    const a = -Math.PI / 2 + (FIBER.bend * i) / n;
    outer.push([c[0] + (R + w) * Math.cos(a), c[1] + (R + w) * Math.sin(a)]);
    inner.push([c[0] + (R - w) * Math.cos(a), c[1] + (R - w) * Math.sin(a)]);
  }
  const ang = -Math.PI / 2 + FIBER.bend;
  const dir = [-Math.sin(ang), Math.cos(ang)];
  const lo = outer[outer.length - 1];
  const li = inner[inner.length - 1];
  outer.push([lo[0] + dir[0] * FIBER.len2, lo[1] + dir[1] * FIBER.len2]);
  inner.push([li[0] + dir[0] * FIBER.len2, li[1] + dir[1] * FIBER.len2]);
  return [...outer, ...inner.reverse()];
}

export { FIBER };
