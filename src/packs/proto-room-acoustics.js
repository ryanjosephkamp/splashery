import { mix, shade } from "../kit.js";
import { playClap, stopClap } from "./proto-room-acoustics/audio.js";
import {
  MATERIALS,
  SURFACES,
  DURATION,
  CLAP_AT,
  RAY_SLOW,
  roomMath,
  pressure,
  alongPath,
  newSimulation,
  advance,
} from "./proto-room-acoustics/math.js";

// Codex first draft: a closed acoustic room shown as an open cutaway.
// All geometry is kit-built, with exact, evenly placed, opaque splats.
let active = null;
let sound = null;
const COLORS = ["#fff2bf", "#258caf", "#258caf", "#ba526f", "#ba526f", "#df9b36", "#df9b36"];
const plus = (a, b) => a.map((v, i) => v + b[i]);
const minus = (a, b) => a.map((v, i) => v - b[i]);

function surface(list, a, u, v, n, color, extra = {}, spacing = 0.22) {
  const nu = Math.max(2, Math.ceil(Math.hypot(...u) / spacing));
  const nv = Math.max(2, Math.ceil(Math.hypot(...v) / spacing));
  const size = Math.max(Math.hypot(...u) / nu, Math.hypot(...v) / nv) * 0.83;
  // Two staggered lattices close the opaque face without random speckle.
  for (let layer = 0; layer < 2; layer++)
    for (let i = 0; i < nu - layer; i++)
      for (let j = 0; j < nv - layer; j++) {
        const x = (i + 0.5 + layer * 0.5) / nu;
        const y = (j + 0.5 + layer * 0.5) / nv;
        const p = a.map((q, axis) => q + u[axis] * x + v[axis] * y);
        list.push({
          p,
          n,
          flat: 0.025,
          size: size / 0.01,
          color: typeof color === "function" ? color(p) : color,
          opacity: 1,
          ...extra,
        });
      }
}

function box(list, center, dims, color, extra = {}) {
  for (let axis = 0; axis < 3; axis++)
    for (const sign of [-1, 1]) {
      const uAxis = (axis + 1) % 3;
      const vAxis = (axis + 2) % 3;
      const a = center.map((q, i) => q + (i === axis ? (dims[i] * sign) / 2 : -dims[i] / 2));
      const u = [0, 0, 0];
      const v = [0, 0, 0];
      const n = [0, 0, 0];
      u[uAxis] = dims[uAxis];
      v[vAxis] = dims[vAxis];
      n[axis] = sign;
      surface(list, a, u, v, n, shade(color, sign > 0 ? 1 : 0.85), extra, 0.14);
    }
}

function line(list, a, b, color, width = 0.055) {
  const d = minus(b, a);
  const length = Math.hypot(...d);
  const n = Math.max(2, Math.ceil(length / (width * 2)));
  for (let i = 0; i <= n; i++)
    list.push({
      p: plus(
        a,
        d.map((v) => (v * i) / n),
      ),
      dir: d,
      stretch: 2.2,
      size: width / 0.01,
      color,
      opacity: 1,
    });
}

function ball(list, at, radius, color, extra = {}) {
  const n = 64;
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const a = i * 2.399963229728653;
    const r = Math.sqrt(1 - y * y);
    const normal = [r * Math.cos(a), y, r * Math.sin(a)];
    list.push({
      p: plus(
        at,
        normal.map((v) => radius * v),
      ),
      n: normal,
      size: (radius * 0.38) / 0.01,
      flat: 0.25,
      color: shade(color, 0.82 + 0.18 * Math.max(0, y)),
      opacity: 1,
      ...extra,
    });
  }
}

const choices = Object.entries(MATERIALS).map(([id, m]) => ({
  id,
  label: `${m.label} · α ${m.alpha.toFixed(2)}`,
}));
export const RECIPES = {
  "room-acoustics": {
    turntable: false,
    kernel: "sharp",
    density: 0.08,
    controls: [{ key: "clap", label: "Clap", type: "pulse", ease: DURATION, pausable: false }],
    action: {
      key: "clap",
      label: "Clap and trace the echoes",
      quiet: ["clap"],
      onAct() {
        if (active) playClap(sound, active.room);
      },
    },
    options: [
      {
        key: "length",
        label: "Length (m)",
        type: "slider",
        min: 4,
        max: 12,
        step: 0.5,
        default: 10,
      },
      { key: "width", label: "Width (m)", type: "slider", min: 3, max: 10, step: 0.5, default: 8 },
      {
        key: "height",
        label: "Height (m)",
        type: "slider",
        min: 2,
        max: 5,
        step: 0.25,
        default: 3,
      },
      ...SURFACES.map((key) => ({
        key,
        label: `${key[0].toUpperCase()}${key.slice(1)} material (500 Hz)`,
        type: "select",
        default: "concrete",
        choices,
      })),
      {
        key: "view",
        label: "Show",
        type: "select",
        default: "rays",
        choices: [
          { id: "rays", label: "First reflections (80× slower)" },
          { id: "mode1", label: "Lowest mode: pressure probes" },
          { id: "mode2", label: "Second mode: pressure probes" },
          { id: "mode3", label: "Third mode: pressure probes" },
        ],
      },
    ],
    input: {
      title: "A closed room, shown cut away",
      fileButton: false,
      note: "All six surfaces count. Cyan rays hit the side walls, gold rays hit the front and back, and pink rays hit the floor and ceiling. The teal ball is the listener. Mode probes show signed pressure, exaggerated and 80× slower; they are indicators, not air particles. Sound plays at real speed. Sabine assumes a diffuse field; modes assume rigid walls.",
      shown: () =>
        active
          ? `V ${active.room.volume.toFixed(1)} m³ · A ${active.room.absorption.toFixed(2)} m² · air at 20 °C. Absorption is a 500 Hz estimate.`
          : "",
    },
    build(k, o) {
      stopClap();
      const room = roomMath(o);
      const { length: L, width: W, height: H } = room;
      // The standard option sliders have no numeric output. Keep their own
      // labels explicit; the engine renders them after this build finishes.
      for (const key of ["length", "width", "height"]) {
        const option = RECIPES["room-acoustics"].options.find((x) => x.key === key);
        option.label = `${key[0].toUpperCase()}${key.slice(1)}: ${room[key]} m`;
      }
      const mode = o.view?.startsWith("mode") ? room.modes[Number(o.view.slice(-1)) - 1] : null;
      const list = [];
      // Scale the sampling interval with the room; total count stays modest
      // even with Detail at its maximum or on the largest room preset.
      const spacing = Math.max(L, W, H * 2) / 45;
      const floorColor = mode
        ? (p) => {
            const signed = pressure(mode, room, p);
            return mix("#e6e9e6", signed > 0 ? "#d49270" : "#5c9bad", Math.abs(signed) * 0.65);
          }
        : room.materials[2].color;
      surface(list, [0, 0, 0], [L, 0, 0], [0, 0, W], [0, 1, 0], floorColor, {}, spacing);
      surface(
        list,
        [0, 0, -0.08],
        [L, 0, 0],
        [0, H, 0],
        [0, 0, 1],
        shade(room.materials[4].color, 0.91),
        {},
        spacing,
      );
      surface(
        list,
        [-0.08, 0, 0],
        [0, 0, W],
        [0, H, 0],
        [1, 0, 0],
        shade(room.materials[0].color, 0.83),
        {},
        spacing,
      );
      // Omitted front, right, and ceiling are outlined, never transparent.
      for (const y of [0, H]) {
        line(list, [0, y, 0], [L, y, 0], room.materials[4].color, 0.09);
        line(list, [0, y, 0], [0, y, W], room.materials[0].color, 0.09);
        line(list, [0, y, W], [L, y, W], room.materials[y ? 3 : 5].color, 0.065);
        line(list, [L, y, 0], [L, y, W], room.materials[1].color, 0.065);
      }
      for (const x of [0, L])
        for (const z of [0, W]) line(list, [x, 0, z], [x, H, z], "#667884", 0.065);
      // Each palm and its fingers form one rigid part. Both meet at the
      // source, then independently return; nothing bends or warps.
      for (const sign of [-1, 1]) {
        const part = k.part(sign < 0 ? "handLeft" : "handRight");
        const p = plus(room.source, [sign * 0.5, -0.05, 0]);
        box(list, p, [0.26, 0.56, 0.46], "#ebbb8d", { part });
        for (let f = 0; f < 4; f++)
          box(
            list,
            plus(p, [0, 0.38 + 0.015 * (f % 2), (f - 1.5) * 0.115]),
            [0.22, 0.3, 0.1],
            "#f0c49d",
            { part },
          );
        box(list, plus(p, [sign * 0.06, -0.07, 0.32]), [0.21, 0.28, 0.16], "#ddb089", { part });
      }
      ball(list, room.listener, 0.24, "#126e72");
      // Reflection paths include the cut-away walls and ceiling.
      room.paths.forEach((path, i) => {
        if (!mode)
          for (let j = 1; j < path.points.length; j++)
            line(list, path.points[j - 1], path.points[j], COLORS[i]);
        const part = k.part(`ray${i}`, { pivot: room.source });
        ball(list, room.source, i ? 0.18 : 0.22, COLORS[i], { part });
      });
      const probes = [];
      if (mode)
        for (let x = 0; x < 3; x++)
          for (let y = 0; y < 3; y++)
            for (let z = 0; z < 3; z++) {
              const p = [((x + 0.5) * L) / 3, ((y + 1) * H) / 4, ((z + 0.5) * W) / 3];
              const value = pressure(mode, room, p);
              const token = probes.length;
              probes.push({ p, value });
              ball(list, p, 0.16, value > 0 ? "#cc754d" : "#2a8aab", {
                kind: "token",
                params: [token, 0],
              });
            }
      k.cloud(
        { share: list.length / k.count, jitter: 0, pattern: false },
        (_rand, i) => list[i] || null,
      );
      active = k.data = { room, mode, probes, sim: newSimulation(), pulse: 0, taps: 0, sorted: -1 };
    },
    drive(_t, c, out, info) {
      const data = info.data;
      if (!data) return;
      active = data;
      if (info.sound) sound = info.sound;
      const { room, mode, probes } = data;
      const pulse = c.clap || 0;
      const taps = info.tap?.n ?? 0;
      if (taps !== data.taps || pulse > data.pulse + 0.1) {
        data.sim = newSimulation();
        data.sorted = -1;
      }
      data.taps = taps;
      data.pulse = pulse;
      const sim = advance(data.sim, pulse > 0 ? (1 - pulse) * DURATION : DURATION, room.rt60);
      const time = sim.time;
      const inMotion = pulse > 0 && time < DURATION - 0.1;
      const contact = time <= CLAP_AT ? time / CLAP_AT : Math.max(0, 1 - (time - CLAP_AT) / 0.3);
      const hand = inMotion ? 0.37 * Math.sin((Math.min(1, contact) * Math.PI) / 2) : 0;
      out.parts.handLeft = { offset: [hand, 0, 0] };
      out.parts.handRight = { offset: [-hand, 0, 0] };
      room.paths.forEach((path, i) => {
        const visible = !mode && inMotion && time >= CLAP_AT && sim.distance < path.length;
        out.parts[`ray${i}`] = {
          offset: minus(alongPath(path, sim.distance), room.source),
          visible: visible ? 1 : 0,
        };
      });
      if (mode) {
        const tau = Math.max(0, time - CLAP_AT) / RAY_SLOW;
        // Exact standing-wave solution: the mode's fixed spatial cosine
        // product times cos(2πft). Probes move whole, showing pressure.
        const phase = Math.cos(2 * Math.PI * mode.hz * tau);
        const end = Math.min(1, Math.max(0, (DURATION - 0.1 - time) / 0.45));
        out.tokens = probes.map((probe) => ({
          offset: [
            0,
            inMotion && time >= CLAP_AT
              ? probe.value * phase * sim.envelope * end * room.height * 0.18
              : 0,
            0,
          ],
        }));
      }
      const sort = Math.floor(time * 8);
      if (inMotion && sort !== data.sorted) {
        out.resortPose = true;
        out.resort = true;
        data.sorted = sort;
      }
      if (!inMotion && data.wasMoving) {
        out.resortPose = true;
        out.resort = true;
      }
      data.wasMoving = inMotion;
      out.legend = {
        items: [
          { text: `RT60 ${room.rt60.toFixed(2)} s · 500 Hz` },
          ...room.modes.map((m) => ({
            text: `${m.orders.join(",")}: ${m.hz.toFixed(1)} Hz`,
            on: m === mode,
          })),
        ],
      };
    },
  },
};
