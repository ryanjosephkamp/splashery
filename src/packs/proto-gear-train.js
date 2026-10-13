import { quatAxisAngle } from "../kit.js";
import {
  dimensions,
  GearTrain,
  inGear,
  outline,
  RUN_SECONDS,
  TAU,
} from "./proto-gear-train/math.js";

let active = null;
const COLORS = [
  [0.9, 0.57, 0.2],
  [0.25, 0.69, 0.76],
  [0.66, 0.5, 0.83],
  [0.5, 0.73, 0.37],
  [0.83, 0.4, 0.43],
];
const round = (x) => (Math.abs(x) < 0.05 ? "0" : Number(x.toFixed(1)).toString());

function legend(s) {
  const reduction = s.teeth.at(-1) / s.teeth[0];
  const speed =
    reduction >= 1
      ? `${round(reduction)}:1 ${reduction === 1 ? "speed" : "reduction"}`
      : `1:${round(1 / reduction)} speedup`;
  return {
    items: [
      { text: s.teeth.length > 3 ? s.teeth.join("→") : `${s.teeth.join(" → ")} teeth` },
      { text: `Speed ${speed}` },
      { text: `Torque ×${round(reduction)} (ideal)` },
      { text: `${round(s.rpm)} → ${round(s.speeds().at(-1))} rpm` },
    ],
  };
}

// Even hexagonal faces and extruded tooth edges: solid pieces, with no
// random color jitter, transparent shells, or decorative particles.
function gearSplats(s, step) {
  const points = [];
  s.gears.forEach((g, i) => {
    const r = dimensions(g.teeth).tip;
    const col = COLORS[i];
    const cos = Math.cos(g.phase),
      sin = Math.sin(g.phase);
    const add = (x, y, z, size, color, normal = [0, 0, 1]) => {
      points.push({
        p: [g.x + x * cos - y * sin, g.y + x * sin + y * cos, z],
        size,
        color,
        part: i + 1,
        normal: [normal[0] * cos - normal[1] * sin, normal[0] * sin + normal[1] * cos, normal[2]],
      });
    };
    for (let y = -r, row = 0; y <= r; y += (step * Math.sqrt(3)) / 2, row++) {
      for (let x = -r + ((row % 2) * step) / 2; x <= r; x += step) {
        if (!inGear(g.teeth, x, y)) continue;
        const radius = Math.hypot(x, y);
        // A broad contrasting hand makes rotation legible even though all
        // teeth are identical. It is painted onto the solid face.
        const mark = x > r * 0.18 && x < r * 0.72 && Math.abs(y) < r * 0.085;
        const hub = radius < 1.25;
        const color = hub ? [0.22, 0.25, 0.29] : mark ? [0.98, 0.94, 0.83] : col;
        add(x, y, 0.8, step * 0.68, color);
        add(
          x,
          y,
          -0.8,
          step * 0.68,
          col.map((v) => v * 0.72),
          [0, 0, -1],
        );
      }
    }
    const poly = outline(g.teeth);
    let carry = step / 2;
    for (let j = 0; j < poly.length; j++) {
      const a = poly[j],
        b = poly[(j + 1) % poly.length];
      const dx = b[0] - a[0],
        dy = b[1] - a[1];
      const length = Math.hypot(dx, dy);
      if (length < 1e-9) continue;
      const n = [dy / length, -dx / length, 0];
      let distance = carry;
      for (; distance < length; distance += step) {
        const t = distance / length;
        for (const z of [-0.5, 0, 0.5])
          add(
            a[0] + dx * t,
            a[1] + dy * t,
            z,
            step * 0.68,
            col.map((v) => v * 0.85),
            n,
          );
      }
      carry = distance - length;
    }
  });
  return points;
}

function build(k, o) {
  const count = Math.max(2, Math.min(5, Number(o.count) || 2));
  const teeth = Array.from({ length: count }, (_, i) =>
    Math.max(12, Math.min(36, Math.round(Number(o[`gear${i + 1}`]) || [12, 36, 24, 18, 30][i]))),
  );
  const s = new GearTrain(teeth);
  active = s;
  k.data = s;
  s.tapBox = {
    min: [
      Math.min(...s.gears.map((g) => g.x - dimensions(g.teeth).tip)),
      Math.min(...s.gears.map((g) => g.y - dimensions(g.teeth).tip)),
      -1,
    ],
    max: [
      Math.max(...s.gears.map((g) => g.x + dimensions(g.teeth).tip)),
      Math.max(...s.gears.map((g) => g.y + dimensions(g.teeth).tip)),
      1,
    ],
  };
  for (const [i, g] of s.gears.entries())
    k.part(`gear${i}`, { pivot: [g.x, g.y, 0], axis: [0, 0, 1] });
  // Explicit points keep every tier below 14,000 splats, including five
  // 36-tooth gears. Modest density also keeps the allocation small.
  const area = teeth.reduce((sum, n) => sum + Math.PI * dimensions(n).tip ** 2, 0);
  let step = Math.max(0.38, Math.sqrt((2 * area) / 6500));
  let pts = gearSplats(s, step);
  while (pts.length > 14000) {
    step *= 1.08;
    pts = gearSplats(s, step);
  }
  k.cloud({ share: pts.length / k.count, pattern: false }, (_, i) => {
    const p = pts[i];
    return {
      p: p.p,
      scales: [p.size, p.size, p.size * 0.18],
      quat: quatFromNormal(p.normal),
      color: p.color,
      opacity: 1,
      part: p.part,
      pattern: false,
    };
  });
  // Reach the whole swept discs so no rotating tooth changes the framing.
  for (const g of s.gears) {
    const r = dimensions(g.teeth).tip;
    k.reach([g.x - r, g.y - r, -0.8]);
    k.reach([g.x + r, g.y + r, 0.8]);
  }
  // Reserve space above the model for the shared four-line phone legend.
  const topSpace = typeof window !== "undefined" && window.innerWidth < 600 ? 0.32 : 0;
  k.reach([0, s.tapBox.max[1] + (s.tapBox.max[1] - s.tapBox.min[1]) * topSpace, 0]);
}

function quatFromNormal(n) {
  if (n[2] === 1) return [0, 0, 0, 1];
  if (n[2] === -1) return [1, 0, 0, 0];
  return quatAxisAngle([-n[1], n[0], 0], Math.PI / 2);
}

function inputAngle(p) {
  const g = active.gears[0];
  return Math.atan2(p[1] - g.y, p[0] - g.x);
}

const drag = {
  plane: [0, 0, 1],
  at(p) {
    if (!active) return false;
    const g = active.gears[0];
    return Math.hypot(p[0] - g.x, p[1] - g.y) <= dimensions(g.teeth).tip + 1;
  },
  start(p, time) {
    active.dragging = true;
    active.remaining = 0;
    active.rpm = 0;
    active.pointer = inputAngle(p);
    active.dragTime = time;
  },
  move(p, time) {
    if (!active?.dragging) return;
    const g = active.gears[0];
    if (Math.hypot(p[0] - g.x, p[1] - g.y) < 1) return;
    const angle = inputAngle(p);
    const delta = Math.atan2(Math.sin(angle - active.pointer), Math.cos(angle - active.pointer));
    active.angle += delta;
    active.rpm = ((delta / Math.max(1 / 240, time - active.dragTime)) * 60) / TAU;
    active.pointer = angle;
    active.dragTime = time;
  },
  end() {
    if (!active) return;
    active.dragging = false;
    active.rpm = 0;
    active.accumulator = 0;
  },
};

export const RECIPES = {
  "gear-train": {
    alive: true,
    kernel: "sharp",
    density: 0.05,
    turntable: false,
    tiltLock: true,
    options: [
      {
        key: "count",
        label: "Gears in the chain",
        type: "select",
        default: "2",
        choices: [2, 3, 4, 5].map((n) => ({ id: String(n), label: `${n} gears` })),
      },
      ...[12, 36, 24, 18, 30].map((n, i) => ({
        key: `gear${i + 1}`,
        label: `Gear ${i + 1}${i === 0 ? " (input)" : ""} teeth`,
        type: "slider",
        min: 12,
        max: 36,
        step: 1,
        default: n,
      })),
    ],
    controls: [
      {
        key: "spin",
        label: "Run at 60 rpm for 4 s",
        type: "pulse",
        ease: RUN_SECONDS,
        pausable: false,
      },
    ],
    action: { key: "spin", label: "Run at 60 rpm", at: () => ({ key: "spin" }) },
    drag,
    drive(t, c, out, info) {
      const s = info.data;
      if (!s) return;
      const dt = s.last === null ? 0 : t - s.last;
      s.last = t;
      if (info.tap?.key === "spin" && info.tap.n !== s.tapN) {
        s.tapN = info.tap.n;
        s.spin();
      } else s.advance(dt);
      if (s.dragging && info.time - s.dragTime > 0.15) s.rpm = 0;
      s.angles().forEach((angle, i) => {
        out.parts[`gear${i}`] = { angle };
      });
      out.legend = legend(s);
    },
    build,
  },
};
