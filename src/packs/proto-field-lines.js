import { mix, shade, quatFromTo } from "../kit.js";
import { evenBox } from "./even.js";
import {
  SOURCE_Q,
  DT,
  RADIUS,
  LIMIT,
  add,
  sub,
  mul,
  norm,
  unit,
  lerp,
  fieldAt,
  fieldLines,
  dipole,
  trajectory,
} from "./proto-field-lines/physics.js";

const RELEASE_SECS = 3.6;
const FLIGHT_SECS = 2;
const HOME = [0, 0.5, 0.18];
let current = null; // The open build, for the engine's recipe drag callbacks.
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const inBox = (p) => p.map((x) => clamp(x, -1.12, 1.12));
const keyFor = (charges) => JSON.stringify(charges);

function nearest(p) {
  if (!current) return null;
  let best = null;
  let distance = 0.24;
  const candidates = current.charges.map((c, i) => ({ kind: "charge", i, p: c.p }));
  candidates.push({ kind: "probe", p: current.probe }, { kind: "test", p: current.start });
  for (const c of candidates) {
    // Generous touch targets in the front plane; sources remain fully 3D.
    const d = Math.hypot(p[0] - c.p[0], p[1] - c.p[1]);
    if (d < distance) {
      best = c;
      distance = d;
    }
  }
  return best;
}

function edited(d) {
  d.flight = null;
  d.changed = true;
  d.poseDirty = true;
}

function addSource(d, sign, point) {
  if (d.charges.length >= 4) return;
  const p = inBox([point[0], point[1], 0]);
  if (d.charges.some((c) => norm(sub(p, c.p)) < RADIUS * 2 + 0.03)) return;
  if ([d.probe, d.start].some((point) => norm(sub(p, point)) < RADIUS + 0.07)) return;
  d.charges.push({ p, q: sign * SOURCE_Q });
  edited(d);
}

// Continuous opaque field strokes and arrowheads, evenly spaced in arc
// length. Each chunk is at most 3,500 splats; only one chunk is shown.
function drawLines(k, charges, part = null, share = 1) {
  const segments = [];
  let total = 0;
  const segment = (a, b, arrow = false) => {
    const length = norm(sub(b, a));
    if (length < 1e-8) return;
    total += length;
    segments.push({ a, b, end: total, length, arrow });
  };
  for (const line of fieldLines(charges)) {
    const p = line.points;
    for (let i = 1; i < p.length; i++) segment(p[i - 1], p[i]);
    if (p.length < 10) continue;
    const i = Math.floor(p.length * 0.52);
    const tip = p[i];
    const along = unit(sub(p[i + 1], p[i - 1]));
    const side = unit([-along[1], along[0], 0]);
    for (const s of [-1, 1])
      segment(add(sub(tip, mul(along, 0.09)), mul(side, s * 0.035)), tip, true);
  }
  if (!segments.length) return;
  k.cloud({ share, part, pattern: false }, (_rand, i, n) => {
    const s = ((i + 0.5) / n) * total;
    // Binary search makes build cost proportional to splat count.
    let lo = 0,
      hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (segments[mid].end < s) lo = mid + 1;
      else hi = mid;
    }
    const a = segments[lo];
    return {
      p: lerp(a.a, a.b, 1 - (a.end - s) / a.length),
      scales: [a.arrow ? 0.009 : 0.0075, Math.max(0.012, (total / n) * 0.9), 0.0075],
      quat: quatFromTo([0, 1, 0], unit(sub(a.b, a.a))),
      color: a.arrow ? "#fff1b8" : "#d4ae54",
      opacity: 1,
    };
  });
}

function sphere(k, r, at, part, color, share) {
  k.add(k.sphere(r), {
    pos: at,
    part,
    share,
    even: true,
    opacity: 1,
    flat: 0.2,
    size: r > 0.1 ? 2.5 : 1.1,
    jitter: 0,
    pattern: false,
    color: (c) =>
      mix(
        shade(color, 0.7 + 0.25 * Math.max(0, c.n[1]) + 0.18 * Math.max(0, c.n[2])),
        "#ffffff",
        0.18 * Math.max(0, c.n[2]) ** 8,
      ),
  });
}

export const RECIPES = {
  "field-lines": {
    alive: true,
    turntable: false,
    kernel: "sharp",
    frameReaches: true,
    density: 0.12,
    options: [
      {
        key: "tool",
        label: "Tap tool",
        type: "select",
        default: "release",
        choices: [
          { id: "release", label: "Release test charge" },
          { id: "positive", label: "Drop +1 nC (four max)" },
          { id: "negative", label: "Drop −1 nC (four max)" },
        ],
      },
      {
        key: "preset",
        label: "Reset with",
        type: "select",
        default: "dipole",
        choices: [
          { id: "dipole", label: "Dipole" },
          { id: "single", label: "One charge: 1 m check" },
        ],
      },
    ],
    controls: [
      {
        key: "release",
        label: "Release test charge",
        type: "pulse",
        ease: RELEASE_SECS,
        pausable: false,
      },
      { key: "flip", label: "Flip charge", type: "pulse", ease: 0.2 },
      { key: "drop", label: "Drop charge", type: "pulse", ease: 0.2 },
    ],
    action: {
      key: "release",
      label: "Release test charge",
      at(p) {
        const hit = nearest(p);
        if (hit?.kind === "charge") return { key: "flip", pick: hit.i };
        if (current?.tool !== "release") return { key: "drop", pick: p.slice() };
        return "release";
      },
    },
    // A flip is a separate action, so it never accidentally releases a bead.
    // Its hidden pulse still goes through the existing tap/sound system.
    drag: {
      plane: [0, 0, 1],
      at: (p) => !!nearest(p),
      start(p) {
        if (current) current.grab = { hit: nearest(p), from: p, moved: false };
      },
      move(p) {
        const d = current,
          g = d?.grab;
        if (!g?.hit || norm(sub(p, g.from)) < 0.025) return;
        const h = g.hit;
        const place = inBox([p[0], p[1], h.p[2]]);
        if (h.kind === "charge") {
          // Keep spheres separate and avoid coincident point singularities.
          if (d.charges.some((c, i) => i !== h.i && norm(sub(place, c.p)) < RADIUS * 2 + 0.03))
            return;
          if ([d.probe, d.start].some((point) => norm(sub(place, point)) < RADIUS + 0.07)) return;
          d.charges[h.i].p = place;
        } else if (h.kind === "probe") {
          if (d.charges.some((c) => norm(sub(place, c.p)) < RADIUS + 0.07)) return;
          d.probe = place;
        } else {
          if (d.charges.some((c) => norm(sub(place, c.p)) < RADIUS + 0.07)) return;
          d.start = place;
        }
        g.moved = true;
        d.poseDirty = true;
        if (h.kind === "charge") edited(d);
        else if (h.kind === "test") d.flight = null;
      },
      end() {
        if (current) current.grab = null;
      },
    },
    chunks: {
      build(k, id) {
        k.count = 3500;
        drawLines(k, JSON.parse(id));
      },
    },
    drive(t, c, out, info) {
      const d = info.data;
      if (!d) return;
      const tap = info.tap;
      if (tap && tap.n !== d.tap) {
        d.tap = tap.n;
        if (tap.key === "flip" && d.charges[tap.pick]) {
          d.charges[tap.pick].q *= -1;
          edited(d);
        } else if (tap.key === "drop" && Array.isArray(tap.pick)) {
          addSource(d, d.tool === "positive" ? 1 : -1, tap.pick);
        } else if (tap.key === "release") {
          d.flight = trajectory(d.start, d.charges, FLIGHT_SECS);
        }
      }
      const fraction = c.release > 0 ? 1 - c.release : 1;
      const elapsed = fraction * RELEASE_SECS;
      let position = d.start;
      let phase =
        d.tool === "release"
          ? "Tap to release"
          : d.charges.length >= 4
            ? "Four charges: limit"
            : `Tap to drop ${d.tool === "positive" ? "+" : "−"}`;
      if (d.flight && c.release > 0) {
        const i = Math.min(d.flight.length - 1, elapsed / DT);
        position = lerp(
          d.flight[Math.floor(i)],
          d.flight[Math.min(d.flight.length - 1, Math.floor(i) + 1)],
          i % 1,
        );
        phase = "Released";
        if (elapsed > FLIGHT_SECS) {
          const f = clamp((elapsed - FLIGHT_SECS - 0.15) / 1.25, 0, 1);
          position = lerp(d.flight.at(-1), d.start, f * f * (3 - 2 * f));
          phase = "Reloading"; // UI reset, explicitly separate from force motion.
        }
      }
      out.parts.test = { offset: position };
      out.parts.probe = { offset: d.probe };
      for (let i = 0; i < 4; i++) {
        const charge = d.charges[i];
        for (const sign of ["plus", "minus"])
          out.parts[`${sign}${i}`] = {
            offset: charge?.p || [0, 0, 0],
            visible: charge && charge.q > 0 === (sign === "plus") ? 1 : 0,
          };
      }
      // Fixed original strokes provide the first frame. Changed fields use
      // the engine's existing chunks, coalesced to at most five builds/s.
      out.parts.initial = { visible: d.changed ? 0 : 1 };
      if (d.changed && info.chunks) {
        const key = keyFor(d.charges);
        if (key !== d.requested && (info.time ?? t) - d.requestTime > 0.2) {
          if (d.requested && d.requested !== d.shown) info.chunks.drop(d.requested);
          d.requested = key;
          d.requestTime = info.time ?? t;
          info.chunks.want(key);
        }
        if (d.requested && info.chunks.state(d.requested) === "ready" && d.shown !== d.requested) {
          if (d.shown) info.chunks.drop(d.shown);
          d.shown = d.requested;
        }
        out.chunks = d.shown ? { [d.shown]: { scale: 1 } } : {};
      }
      const strength = norm(fieldAt(d.probe, d.charges));
      out.legend = {
        title: `Probe: ${strength.toFixed(3)} N/C`,
        items: [{ text: "Red + / blue −: 1 nC" }, { text: "Test: +1 nC, 10 µg" }, { text: phase }],
      };
      // Sort only a few times per second while solid parts travel.
      const sort = Math.floor(t * 6);
      const moving = !!d.grab?.moved || !!(d.flight && c.release > 0);
      if (d.wasMoving && !moving) d.poseDirty = true;
      out.resortPose = sort !== d.sort && (moving || d.poseDirty);
      if (out.resortPose) d.poseDirty = false;
      d.wasMoving = moving;
      d.sort = sort;
    },
    build(k, o) {
      k.count = Math.min(k.count, 7500);
      const previous = current;
      const preserve = previous && previous.preset === o.preset && previous.tool !== o.tool;
      const single = o.preset === "single";
      const d = {
        charges: preserve
          ? previous.charges.map((c) => ({ p: c.p.slice(), q: c.q }))
          : single
            ? [{ p: [0, 0, 0], q: SOURCE_Q }]
            : dipole(),
        probe: preserve ? previous.probe.slice() : single ? [0, 1, 0] : [0, 0.82, 0.18],
        start: preserve ? previous.start.slice() : HOME.slice(),
        tool: o.tool || "release",
        preset: o.preset || "dipole",
        poseDirty: true,
        changed: false,
        tap: 0,
        requestTime: -Infinity,
        flight: null,
        tapBox: { min: [-LIMIT, -LIMIT, -0.25], max: [LIMIT, LIMIT, 0.25] },
      };
      current = d;
      k.data = d;
      drawLines(k, d.charges, k.part("initial"), 0.48);
      for (let i = 0; i < 4; i++) {
        for (const sign of ["plus", "minus"]) {
          const part = k.part(`${sign}${i}`, { pivot: [0, 0, 0] });
          sphere(k, RADIUS, [0, 0, 0], part, sign === "plus" ? "#ec593d" : "#448fff", 0.055);
          const bar = (sx, sy) =>
            k.add(evenBox(sx, sy, 0.013), {
              pos: [0, 0, RADIUS + 0.06],
              part,
              share: 0.006,
              even: true,
              color: "#ffffff",
              opacity: 1,
              size: 1.3,
              jitter: 0,
              pattern: false,
            });
          bar(0.13, 0.026);
          if (sign === "plus") bar(0.026, 0.13);
        }
      }
      sphere(k, 0.055, [0, 0, 0], k.part("test"), "#8ce984", 0.027);
      sphere(k, 0.063, [0, 0, 0], k.part("probe"), "#f8f4dc", 0.017);
      // Stable framing includes every possible field stroke and flight.
      k.reach([-LIMIT, -1.5, -0.7]);
      k.reach([LIMIT, 2.3, 0.7]);
    },
  },
};
