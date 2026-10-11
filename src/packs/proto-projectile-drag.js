// Codex first draft. Two stacked plots share one SI scale and one flight clock.
// Examples consulted: ripple-tank and light-bench in optics.js (Science, labs).
import {
  BALLS,
  G,
  RHO,
  trajectory,
  positionAt,
  bestAngle,
} from "./proto-projectile-drag/physics.js";
import { shade } from "../kit.js";

const ORANGE = "#d96619";
const BLUE = "#196ba6";
const DURATION = 4.4;
const FLIGHT_DURATION = 3.6;
const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["111", "010", "010", "010", "010", "010", "111"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
};
let current = null;

export function makeExperiment(options = {}) {
  const settings = {
    ball: BALLS[options.ball] ? options.ball : "baseball",
    speed: Math.max(10, Math.min(60, Number(options.speed) || 40)),
    angle: Math.max(10, Math.min(75, Number(options.angle) || 45)),
    drag: options.drag !== false,
  };
  const air = trajectory(settings);
  const ideal = trajectory({ ...settings, drag: false });
  return {
    settings,
    air,
    ideal,
    best: bestAngle(settings),
    playback: ideal.time / FLIGHT_DURATION,
  };
}

function numbersPanel() {
  const box = document.createElement("div");
  box.id = "projectile-numbers";
  const d = current;
  if (!d) return box;
  const b = BALLS[d.settings.ball];
  const table = document.createElement("table");
  table.style.cssText = "width:100%;font-variant-numeric:tabular-nums;text-align:left";
  for (const row of [
    ["Path", "Range (m)", "Peak (m)", "Flight (s)"],
    [
      d.settings.drag ? "Air (orange)" : "Drag off",
      d.air.range.toFixed(2),
      d.air.peak.toFixed(2),
      d.air.time.toFixed(2),
    ],
    ["Ideal (blue)", d.ideal.range.toFixed(2), d.ideal.peak.toFixed(2), d.ideal.time.toFixed(2)],
  ]) {
    const tr = document.createElement("tr");
    for (const value of row) {
      const cell = document.createElement(table.children.length ? "td" : "th");
      cell.textContent = value;
      tr.append(cell);
    }
    table.append(tr);
  }
  const note = document.createElement("p");
  note.textContent = `${b.label}: ${(b.mass * 1000).toFixed(2)} g, ${(b.diameter * 1000).toFixed(2)} mm, and Cd ${b.cd}. Best range angle: ${d.best.toFixed(1)}° (0.1° search). Air: ${RHO} kg/m³; gravity: ${G} m/s². Both plots use the same scale. Balls are enlarged. Playback: ${d.playback.toFixed(2)}× real time.`;
  box.append(table, note);
  return box;
}

// Even, overlapping, opaque discs keep the axes and paths crisp at phone size.
function stroke(list, a, b, color, radius = 0.012, z = 0) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (radius * 0.9)));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    list.push({
      p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, z],
      color,
      scales: [radius, radius, 0.003],
    });
  }
}
function letters(list, word, x, y, color) {
  const pixel = 0.027;
  for (const letter of word) {
    const rows = FONT[letter];
    rows.forEach((row, j) => {
      [...row].forEach((ink, i) => {
        if (ink === "1")
          list.push({
            p: [x + i * pixel, y - j * pixel, 0.015],
            color,
            scales: [pixel * 0.63, pixel * 0.63, 0.003],
          });
      });
    });
    x += (rows[0].length + 1) * pixel;
  }
}

function build(k, options) {
  const d = makeExperiment(options);
  current = d;
  // Preserve geometry proportions: horizontal and vertical meters have the same scale.
  const scale = Math.min(3.2 / d.ideal.range, 1.25 / d.ideal.peak);
  const width = d.ideal.range * scale;
  const height = Math.max(0.7, d.ideal.peak * scale);
  const gap = 0.55;
  const left = -width / 2;
  const origins = [gap / 2, -height - gap / 2];
  const list = [];
  for (const [i, flight] of [d.air, d.ideal].entries()) {
    const y = origins[i];
    const color = i ? BLUE : ORANGE;
    // Sparse grid, the same divisions on both plots. No transparent board behind the ball.
    for (let j = 1; j <= 4; j++) {
      const x = left + (width * j) / 4;
      stroke(list, [x, y], [x, y + height], "#cad3d9", 0.009, -0.04);
    }
    for (let j = 1; j <= 2; j++)
      stroke(
        list,
        [left, y + (height * j) / 2],
        [left + width, y + (height * j) / 2],
        "#cad3d9",
        0.009,
        -0.04,
      );
    stroke(list, [left, y], [left + width, y], "#536575", 0.016, -0.01);
    stroke(list, [left, y], [left, y + height], "#536575", 0.016, -0.01);
    // Resample by arc length through short time segments, independent of RK4 step size.
    let a = [left, y];
    for (let j = 1; j <= 100; j++) {
      const p = positionAt(flight, (flight.time * j) / 100);
      const b = [left + p.x * scale, y + p.y * scale];
      stroke(list, a, b, color, 0.019, 0.035);
      a = b;
    }
    letters(list, i ? "IDEAL" : "AIR", left + 0.06, y + height + 0.22, color);
    // Each ball is one rigid part. Its center traces the physical point-mass trajectory.
    const part = k.part(i ? "idealBall" : "airBall", { pivot: [left, y, 0.22] });
    k.add(k.sphere(0.125), {
      pos: [left, y, 0.22],
      part,
      share: 360 / k.count,
      size: 1.5,
      flat: 0.6,
      even: true,
      opacity: 1,
      interior: 0,
      jitter: 0,
      pattern: false,
      color(c) {
        const seam =
          d.settings.ball === "baseball" &&
          Math.abs(c.ln[0] - 0.35 * Math.cos(c.v * Math.PI * 3)) < 0.1;
        const base = seam ? "#ab3627" : d.settings.ball === "ping" ? "#f1a43d" : "#f2eee1";
        return shade(base, 0.7 + 0.3 * Math.max(0, c.ln[2] * 0.65 + c.ln[1] * 0.75));
      },
    });
  }
  k.cloud({ share: list.length / k.count, pattern: false }, (rand, i) => ({
    ...list[i],
    quat: [0, 0, 0, 1],
    opacity: 1,
  }));
  // The central gap is deliberately tappable, including when no splat lies under the finger.
  d.scale = scale;
  d.tapBox = {
    min: [left - 0.15, origins[1] - 0.16, -0.1],
    max: [left + width + 0.15, origins[0] + height + 0.26, 0.4],
  };
  k.data = d;
  k.reach(d.tapBox.min);
  k.reach(d.tapBox.max);
}

export const RECIPES = {
  "projectile-drag": {
    alive: false,
    kernel: "sharp",
    turntable: false,
    tiltLock: true,
    density: 0.12,
    options: [
      {
        key: "ball",
        label: "Ball",
        type: "select",
        default: "baseball",
        choices: Object.entries(BALLS).map(([id, b]) => ({ id, label: b.label })),
      },
      {
        key: "speed",
        label: "Launch speed (m/s)",
        type: "slider",
        min: 10,
        max: 60,
        step: 1,
        default: 40,
      },
      {
        key: "angle",
        label: "Launch angle (degrees)",
        type: "slider",
        min: 10,
        max: 75,
        step: 1,
        default: 45,
      },
      { key: "drag", label: "Air drag", type: "switch", default: true },
    ],
    controls: [{ key: "launch", label: "Launch", type: "pulse", ease: DURATION, pausable: false }],
    action: { key: "launch", label: "Launch", at: () => ({ key: "launch" }) },
    input: {
      title: "Flight results",
      fileButton: false,
      live: [{ render: numbersPanel }],
      note: "Constant drag coefficients; no spin, lift, or wind. Launch and landing heights are equal.",
      read: () => ({}),
      shown: () => "",
    },
    note: "Tap either plot or the space between them to launch both balls. Orange shows air drag; blue shows the ideal parabola. Change the ball, speed, and angle above.",
    drive(t, c, out, info) {
      out.body = { offset: [0, -0.22, 0] };
      const d = info.data;
      if (!d) return;
      const progress = 1 - Math.max(0, Math.min(1, c.launch ?? 0));
      const elapsed = progress * DURATION;
      // Land, hold briefly, then hide to reset. Never animate a fake reverse flight.
      const rest = !c.launch || elapsed >= 4.15;
      const hidden = !rest && elapsed >= 3.9;
      const physicalTime = rest ? 0 : Math.min(d.ideal.time, elapsed * d.playback);
      for (const [name, flight] of [
        ["airBall", d.air],
        ["idealBall", d.ideal],
      ]) {
        const p = positionAt(flight, physicalTime);
        out.parts[name] = { offset: [p.x * d.scale, p.y * d.scale, 0], visible: hidden ? 0 : 1 };
      }
      out.legend = {
        items: [
          { text: "Range m / peak m / s" },
          {
            text: `${d.settings.drag ? "Air" : "Off"}: ${d.air.range.toFixed(0)} / ${d.air.peak.toFixed(0)} / ${d.air.time.toFixed(1)}`,
          },
          {
            text: `Ideal: ${d.ideal.range.toFixed(0)} / ${d.ideal.peak.toFixed(0)} / ${d.ideal.time.toFixed(1)}`,
          },
          {
            text: `${d.settings.angle}° · ${d.settings.speed} m/s · time ×${d.playback.toFixed(1)}`,
          },
        ],
      };
    },
    build,
  },
};
