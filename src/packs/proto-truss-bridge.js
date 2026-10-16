import { quatAxisAngle, quatFromTo } from "../kit.js";
import { analyze, collapseState, makeTruss, SPAN, STEP, stepCollapse } from "./proto-truss-bridge/analysis.js"; // prettier-ignore
import { forceModifier } from "./proto-truss-bridge/render.js";

const DURATION = 4.4;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = (x) => x * x * (3 - 2 * x);
let current = null;
export const bridgeState = () => current;
const point = (p, z = 0) => [p[0] - SPAN / 2, p[1], z];
const midpoint = (a, b) => a.map((v, d) => (v + b[d]) / 2);

function selectMember(p, s) {
  let best = s.result.weakest;
  let distance = Infinity;
  s.truss.members.forEach(({ a, b }, i) => {
    const A = point(s.truss.nodes[a]);
    const B = point(s.truss.nodes[b]);
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const u = clamp(((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / (dx * dx + dy * dy), 0, 1); // prettier-ignore
    const d = Math.hypot(p[0] - A[0] - u * dx, p[1] - A[1] - u * dy);
    if (d < distance) [best, distance] = [i, d];
  });
  return best;
}

function begin(s) {
  s.broken = Math.abs(s.result.forces[s.result.weakest]) > s.strength ? s.result.weakest : -1;
  s.collapse = s.broken >= 0 ? collapseState(s.truss, s.broken) : null;
  s.fragments =
    s.broken >= 0
      ? [
          { offset: [0, 0], velocity: [-0.7, 0.8], angle: 0, spin: -1.4 },
          { offset: [0, 0], velocity: [0.9, 0.4], angle: 0, spin: 1.8 },
        ]
      : [];
  if (s.broken >= 0) {
    const { a, b } = s.truss.members[s.broken];
    const A = s.truss.nodes[a];
    const B = s.truss.nodes[b];
    s.fragments.forEach((f, half) => {
      f.homeY = A[1] * (half ? 0.25 : 0.75) + B[1] * (half ? 0.75 : 0.25);
      f.homeAngle = Math.atan2(B[1] - A[1], B[0] - A[0]);
      f.halfLength = Math.hypot(B[0] - A[0], B[1] - A[1]) / 4;
    });
  }
  s.simulated = 0;
  s.active = true;
}

function step(s) {
  if (s.collapse) stepCollapse(s.collapse);
  for (const f of s.fragments) {
    f.velocity[1] -= 9.81 * STEP;
    for (let d = 0; d < 2; d++) f.offset[d] += f.velocity[d] * STEP;
    f.angle += f.spin * STEP;
    const angle = f.homeAngle + f.angle;
    const extent = Math.abs(Math.sin(angle)) * f.halfLength + Math.abs(Math.cos(angle)) * 0.11; // prettier-ignore
    // Every fragment contacts the same y = -2 m floor with its lowest
    // solid corner, irrespective of its original member's height or tilt.
    const floor = -2 - f.homeY + extent;
    if (f.offset[1] < floor) {
      f.offset[1] = floor;
      f.velocity[1] = Math.abs(f.velocity[1]) * 0.2;
      f.velocity[0] *= 0.92;
      f.spin *= 0.92;
    }
  }
  s.simulated += STEP;
}

// An even grid on every solid box face: fewer, larger splats, with no
// stochastic placement or color jitter. Each splat follows one rigid token.
function box(list, center, dimensions, color, token = -1, member = -1, angle = 0) {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const turn = ([x, y, z]) => [ca * x - sa * y, sa * x + ca * y, z];
  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    const nu = Math.max(2, Math.ceil(dimensions[u] / 0.13));
    const nv = Math.max(2, Math.ceil(dimensions[v] / 0.13));
    const du = dimensions[u] / nu;
    const dv = dimensions[v] / nv;
    for (const side of [-1, 1]) {
      const normal = [0, 0, 0];
      normal[axis] = side;
      // The ellipse's axes must follow this face's grid, including when
      // the long side is vertical. A circular cell closes both directions.
      const radius = Math.max(du, dv) * 0.73;
      for (let i = 0; i < nu; i++)
        for (let j = 0; j < nv; j++) {
          const p = [0, 0, 0];
          p[axis] = (side * dimensions[axis]) / 2;
          p[u] = (i + 0.5) * du - dimensions[u] / 2;
          p[v] = (j + 0.5) * dv - dimensions[v] / 2;
          const t = turn(p);
          const n = turn(normal);
          const light = 0.76 + 0.24 * Math.max(0, -0.3 * n[0] + 0.75 * n[1] + 0.6 * n[2]); // prettier-ignore
          list.push({
            p: t.map((x, d) => x + center[d]),
            scales: [radius, radius, 0.006],
            quat: quatFromTo([0, 0, 1], n),
            color: color.map((x) => x * light),
            opacity: 1,
            kind: token >= 0 ? "token" : "none",
            params: [Math.max(0, token), member + 1],
            pattern: false,
          });
        }
    }
  }
}

const BRIDGE = {
  kernel: "sharp",
  density: 0.18,
  turntable: false,
  alive: (c) => (c.test ?? 0) > 0,
  options: [
    {
      key: "style",
      label: "Truss",
      type: "select",
      default: "warren",
      choices: [
        { id: "warren", label: "Warren" },
        { id: "pratt", label: "Pratt" },
        { id: "howe", label: "Howe" },
      ],
    },
    { key: "strength", label: "Member strength (kN)", type: "slider", min: 50, max: 250, step: 10, default: 140 }, // prettier-ignore
  ],
  controls: [
    { key: "load", label: "Load (20 to 200 kN)", type: "slider", default: 4 / 9 },
    { key: "test", label: "Test load", type: "pulse", ease: DURATION },
  ],
  action: {
    key: "test",
    label: "Test load",
    at(p) {
      return { key: "test", pick: current ? selectMember(p, current) : 0 };
    },
  },
  drag: {
    plane: [0, 0, 1],
    at: (p) => !!current && Math.abs(p[0] - (current.position - 6)) < 1.05 && p[1] > 0 && p[1] < 1.7, // prettier-ignore
    start(p) {
      current.dragging = true;
      current.grabX = p[0] - (current.position - 6);
    },
    move(p) {
      if (!current?.dragging) return;
      if (current.active && current.broken >= 0) return;
      current.position = clamp(p[0] - current.grabX + 6, 0.6, 11.4);
      // Return an ordinary toy tap once per drag, so audio and the load
      // test obey the same gesture gating as the center tap.
      if (!current.dragFired) {
        current.dragFired = true;
        return { key: "test" };
      }
    },
    end() {
      if (current) {
        current.dragging = false;
        current.dragFired = false;
      }
    },
  },
  gpuField: (o, fit) => forceModifier(fit),
  drive(t, c, out, info) {
    const s = info.data;
    if (!s?.truss) return;
    const load = 20 + 180 * (c.load ?? 4 / 9);
    if (!s.active || s.broken < 0) {
      if (s.result.position !== s.position || s.result.loadKN !== load)
        s.result = analyze(s.truss, load, s.position);
    }
    const pulse = clamp(c.test ?? 0, 0, 1);
    const tapped = info.tap && info.tap.n !== s.tapN;
    if (tapped || (pulse > 0 && !s.active)) {
      s.tapN = info.tap?.n ?? s.tapN;
      s.selected = info.tap?.pick ?? s.result.weakest;
      begin(s);
    }
    // Dragging or changing the live load can cross the strength threshold
    // during a safe test. Freeze the last valid intact-truss forces on break.
    if (pulse > 0 && s.broken < 0 && Math.abs(s.result.forces[s.result.weakest]) > s.strength) begin(s); // prettier-ignore
    const elapsed = pulse > 0 ? (1 - pulse) * DURATION : 0;
    while (pulse > 0 && s.simulated + STEP <= Math.min(elapsed, 2.8) + 1e-9) step(s);
    const recovery = elapsed > 2.8 ? 1 - ease(clamp((elapsed - 2.8) / 1.6, 0, 1)) : 1;
    if (pulse === 0) {
      s.active = false;
      s.broken = -1;
      s.result = analyze(s.truss, load, s.position);
    }
    const nodes = s.truss.nodes.map((p, i) =>
      p.map((x, d) => x + (pulse > 0 && s.collapse ? (s.collapse.nodes[i][d] - x) * recovery : 0)),
    );
    out.tokens = [];
    s.truss.members.forEach(({ a, b }, i) => {
      const A = point(s.truss.nodes[a]);
      const B = point(s.truss.nodes[b]);
      const center = midpoint(A, B);
      const target = midpoint(point(nodes[a]), point(nodes[b]));
      const angle = Math.atan2(nodes[b][1] - nodes[a][1], nodes[b][0] - nodes[a][0]) - Math.atan2(B[1] - A[1], B[0] - A[0]); // prettier-ignore
      for (let half = 0; half < 2; half++) {
        const token = i * 2 + half;
        if (pulse > 0 && i === s.broken) {
          const f = s.fragments[half];
          out.tokens[token] = {
            base: midpoint(center, half ? B : A),
            offset: [f.offset[0] * recovery, f.offset[1] * recovery, 0],
            quat: quatAxisAngle([0, 0, 1], f.angle * recovery),
          };
        } else {
          out.tokens[token] = { base: center, offset: target.map((v, d) => v - center[d]), quat: quatAxisAngle([0, 0, 1], angle) }; // prettier-ignore
        }
      }
    });
    for (let i = 0; i < 4; i++) {
      const home = [3 * i - 4.5, -0.19, 0];
      const target = midpoint(point(nodes[i]), point(nodes[i + 1]));
      out.tokens[30 + i] = {
        base: home,
        offset: [target[0] - home[0], target[1], 0],
        quat: quatAxisAngle([0, 0, 1], Math.atan2(nodes[i + 1][1] - nodes[i][1], nodes[i + 1][0] - nodes[i][0])), // prettier-ignore
      };
    }
    const panel = Math.min(3, Math.floor(s.position / 3));
    const fraction = (s.position - panel * 3) / 3;
    const sag = nodes[panel][1] * (1 - fraction) + nodes[panel + 1][1] * fraction;
    // Safe tests lift and release the solid weight: ballistic motion under
    // gravity, ending at the deck. No idle motion, and no picture warping.
    const hop = pulse > 0 && s.broken < 0 && elapsed < 0.8 ? Math.max(0, 3.924 * elapsed - 4.905 * elapsed * elapsed) : 0; // prettier-ignore
    out.tokens[34] = { offset: [s.position - 6, sag + hop, 0] };
    for (let i = 0; i < 5; i++)
      out.tokens[40 + i] = { offset: [0, 1, 2].map((d) => (s.result.forces[3 * i + d] ?? 0) / s.strength) }; // prettier-ignore
    out.resort = pulse > 0 && Math.floor(elapsed * 8) !== s.sortFrame;
    s.sortFrame = Math.floor(elapsed * 8);
    const selected = clamp(s.selected, 0, s.truss.members.length - 1);
    const force = s.result.forces[selected];
    out.legend = {
      items: [
        { text: `P ${s.result.loadKN.toFixed(0)} kN · x ${s.position.toFixed(1)} m` },
        { text: "Blue T · red C" },
        { text: `M${selected + 1}: ${Math.abs(force).toFixed(1)} kN ${Math.abs(force) < 0.05 ? "zero" : force > 0 ? "T" : "C"}` }, // prettier-ignore
        { text: s.broken >= 0 ? `M${s.broken + 1} broke · demo sag` : `Limit ${s.strength} kN · tap` }, // prettier-ignore
      ],
    };
  },
  build(k, o) {
    const truss = makeTruss(o.style ?? "warren");
    const result = analyze(truss);
    const s = { truss, result, position: 6, strength: Number(o.strength ?? 140), selected: result.weakest, tapN: 0, active: false, broken: -1 }; // prettier-ignore
    current = k.data = s;
    const list = [];
    truss.members.forEach(({ a, b }, i) => {
      const A = point(truss.nodes[a]);
      const B = point(truss.nodes[b]);
      const center = midpoint(A, B);
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const angle = Math.atan2(B[1] - A[1], B[0] - A[0]);
      for (let half = 0; half < 2; half++) {
        const mid = midpoint(center, half ? B : A);
        box(list, [mid[0], mid[1], -0.5], [L / 2, 0.22, 0.32], [1, 1, 1], 2 * i + half, i, angle); // prettier-ignore
      }
    });
    for (let i = 0; i < 4; i++)
      box(list, [3 * i - 4.5, -0.19, 0], [2.98, 0.28, 1.5], [0.56, 0.61, 0.66], 30 + i); // prettier-ignore
    for (const x of [-6, 6]) {
      box(list, [x, -0.8, 0], [0.8, 1, 1.9], [0.65, 0.65, 0.6]);
      box(list, [x, -1.4, 0], [1.2, 0.2, 2.2], [0.35, 0.38, 0.4]);
    }
    box(list, [0, 0.475, 0], [1.1, 1.05, 0.85], [0.99, 0.72, 0.18], 34);
    box(list, [0, 1.125, 0], [0.5, 0.2, 0.3], [0.99, 0.72, 0.18], 34);
    // Explicit samples cap every profile, even with the Detail slider up.
    k.cloud({ share: list.length / k.count, pattern: false }, (_, i) => list[i]);
  },
};

export const RECIPES = { "truss-bridge": BRIDGE };
