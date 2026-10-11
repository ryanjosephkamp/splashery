// Codex prototype: no assets, libraries, or engine changes.
// Search equations: https://www.redblobgames.com/pathfinding/a-star/introduction.html
// Fixed-step accumulator: https://gafferongames.com/post/fix_your_timestep/
import { shade } from "../kit.js";
import { TOY_SOUNDS } from "../toy-sounds.js";
import {
  ALGORITHMS,
  CELLS,
  SIDE,
  STEP,
  manhattan,
  maze,
  search,
  spring,
} from "./proto-pathfinding/search.js";

const COLORS = ["#288ee5", "#ed8c27", "#c14ee7"];
const position = (i) => [(i % SIDE) - 3, 0, Math.floor(i / SIDE) - 3];
let active = null;

function reset(data) {
  data.walls = maze(data.seed, data.density / 100, data.generation, data.goal);
  data.runs = null;
  data.running = false;
  data.elapsed = 0;
  data.expansion = 0;
  data.progress = [0, 0, 0];
  data.finished = [null, null, null];
  data.pending = [];
  data.lastCue = -1;
}

function run(data) {
  data.runs = ALGORITHMS.map((_, i) => search(data.walls, data.goal, i));
  data.running = true;
  data.elapsed = 0;
  data.expansion = 0;
  data.progress = [0, 0, 0];
  data.finished = [null, null, null];
  data.pending = [];
  data.lastCue = -1;
  // Existing tracks spring down toward dim while the new race starts;
  // replay preserves continuous rigid motion instead of teleporting pieces.
}

function targets(data, algorithm) {
  const list = Array(CELLS).fill(0);
  if (!data.runs || !data.progress[algorithm]) return list;
  const result = data.runs[algorithm];
  const event = result.events[data.progress[algorithm] - 1];
  for (const i of event.visited) list[i] = 0.45;
  for (const i of event.frontier) list[i] = 0.72;
  if (data.finished[algorithm] !== null) {
    const count =
      Math.floor(((data.elapsed - data.finished[algorithm]) / 0.45) * result.path.length) + 1;
    for (const i of result.path.slice(0, Math.max(0, count))) list[i] = 1;
  }
  return list;
}

function tick(data, rate) {
  if (data.running) {
    data.elapsed += STEP;
    data.expansion += rate * STEP;
    if (data.expansion >= 1) {
      data.expansion -= 1;
      data.runs.forEach((result, a) => {
        const index = data.progress[a];
        if (index >= result.events.length) return;
        const cell = result.events[index].cell;
        data.progress[a]++;
        // One soft, constant-pitch blip for every expanded node. Closer
        // nodes have higher pitches, from 260 to 620 Hz (no upward glide).
        data.pending.push({ ...TOY_SOUNDS.pathfinding, f: 620 - 30 * manhattan(cell, data.goal) });
        if (data.progress[a] === result.events.length) data.finished[a] = data.elapsed;
      });
    }
    if (data.finished.every((s) => s !== null && data.elapsed - s >= 0.75)) data.running = false;
  }
  for (let a = 0; a < 3; a++) {
    const target = targets(data, a);
    for (let i = 0; i < CELLS; i++) {
      [data.lifts[a][i], data.velocities[a][i]] = spring(
        data.lifts[a][i],
        data.velocities[a][i],
        target[i],
      );
    }
  }
}

function legend(data, rate) {
  const items = ALGORITHMS.flatMap((_, a) => {
    const done = data.finished[a] !== null;
    const length = done ? data.runs[a].length : undefined;
    return [
      { text: `${["BFS · Blue", "Dijkstra · Orange", "A* · Purple"][a]}`, head: true },
      {
        text: `${data.progress[a]} visited · ${length === undefined ? "path —" : length === null ? "no route" : `${length} steps`}`,
      },
    ];
  });
  items.push({ text: `${rate} nodes/s · ${data.density}% wall chance`, dim: true });
  items.push({ text: "Dim: unvisited · Tall: frontier · Low: visited · Tallest: path", dim: true });
  return {
    title: data.running ? "Searching…" : data.runs ? "Complete · Tap to replay" : "Tap to race",
    items,
  };
}

export const RECIPES = {
  pathfinding: {
    seed: 7,
    alive: true,
    turntable: false,
    density: 0.55,
    kernel: "sharp",
    render: { cull: "off", dpr: "native" },
    controls: [
      { key: "race", label: "Run the race", type: "pulse", ease: 4.6, pausable: false },
      { key: "density", label: "Wall density", type: "slider", default: 0.3 },
      { key: "speed", label: "Search speed (14–28 nodes/s)", type: "slider", default: 0.45 },
    ],
    action: { key: "race", label: "Run the race", quiet: ["race"] },
    input: {
      title: "Maze",
      fileButton: false,
      note: "Drag the gold goal to an open cell. Density is each cell’s wall chance; the start, the original goal, and the moved goal stay open. Each move costs one step; no diagonal moves.",
      live: [
        {
          render() {
            const button = document.createElement("button");
            button.type = "button";
            button.id = "pathfinding-new-maze";
            button.textContent = "New random maze";
            button.addEventListener("click", () => {
              if (!active) return;
              active.generation++;
              reset(active);
            });
            return button;
          },
        },
      ],
      read: async () => ({}),
    },
    drag: {
      plane: [0, 1, 0],
      at(p) {
        if (!active) return false;
        const goal = position(active.goal);
        return Math.hypot(p[0] - goal[0], p[2] - goal[2]) < 0.7;
      },
      start() {
        if (active) active.dragging = true;
      },
      move(p) {
        if (!active?.dragging) return;
        const x = Math.max(0, Math.min(SIDE - 1, Math.round(p[0] + 3)));
        const z = Math.max(0, Math.min(SIDE - 1, Math.round(p[2] + 3)));
        const cell = z * SIDE + x;
        if (active.walls[cell] || cell === active.goal) return;
        active.goal = cell;
        reset(active);
      },
      end() {
        if (active) active.dragging = false;
      },
    },
    drive(t, c, out, info) {
      const data = info.data;
      if (!data) return;
      const density = Math.round(Math.max(0, Math.min(1, c.density ?? 0.3)) * 100);
      if (data.density !== density) {
        data.density = density;
        reset(data);
      }
      const tap = info.tap;
      if (tap && tap.n !== data.tapN) {
        data.tapN = tap.n;
        if (tap.key === "race") run(data);
      }
      const now = info.time ?? t;
      // Bound catch-up work after a background tab. The simulation slows
      // during a stall instead of taking an unstable giant physics step.
      data.accumulator += Math.min(0.1, Math.max(0, now - (data.lastTime ?? now)));
      data.lastTime = now;
      const rate = Math.round(14 + 14 * Math.max(0, Math.min(1, c.speed ?? 0.45)));
      while (data.accumulator >= STEP - 1e-9) {
        tick(data, rate);
        data.accumulator -= STEP;
      }
      // The existing sound system spaces cue batches 60 ms apart. Batch
      // all node blips every 80 ms so none are discarded at fast speeds.
      if (data.pending.length && (data.elapsed - data.lastCue >= 0.08 || !data.running)) {
        (out.cues ||= []).push(data.pending.splice(0));
        data.lastCue = data.elapsed;
      }
      out.levers = data.lifts;
      out.tokens = Array.from({ length: 47 }, (_, i) => ({ visible: data.walls[i + 1] ? 1 : 0 }));
      const goal = position(data.goal);
      const home = position(CELLS - 1);
      out.parts.goal = { offset: [goal[0] - home[0], 0, goal[2] - home[2]] };
      out.legend = legend(data, rate);
      // Marker levers only move upward from above their tiles. Walls use
      // binary token visibility, so absent walls do not draw under the floor.
      // Only the moving goal needs a pose sort.
      out.resortPose = data.dragging;
      if (
        density !== data.lastDensity ||
        data.generation !== data.lastGeneration ||
        data.goal !== data.lastGoal
      ) {
        data.lastDensity = density;
        data.lastGeneration = data.generation;
        data.lastGoal = data.goal;
        out.resortPose = true;
      }
    },
    build(k) {
      const data = {
        seed: k.seed,
        generation: 0,
        goal: CELLS - 1,
        density: 30,
        tapN: 0,
        accumulator: 0,
        lastTime: null,
        dragging: false,
        lifts: Array.from({ length: 3 }, () => Array(CELLS).fill(0)),
        velocities: Array.from({ length: 3 }, () => Array(CELLS).fill(0)),
      };
      reset(data);

      k.data = active = data;
      const surface = (color) => ({
        color: (s) => shade(color, 0.7 + 0.3 * Math.max(0, s.n[1]) + 0.1 * Math.max(0, s.n[0])),
        even: true,
        jitter: 0,
        opacity: 1,
        interior: 0.08,
        core: color,
        pattern: false,
      });
      k.add(k.box(7.7, 0.26, 7.7), { pos: [0, -0.2, 0], ...surface("#273542"), weight: 0.5 });
      const groups = COLORS.map((color, channel) =>
        k.lever({ dir: [0, 1, 0], move: 0.3, channel, glow: color, glowChannel: channel }),
      );
      for (let i = 0; i < CELLS; i++) {
        const [x, , z] = position(i);
        k.add(k.box(0.95, 0.06, 0.95), { pos: [x, 0.01, z], ...surface("#c0cbd0"), weight: 0.7 });
        if (i > 0 && i < CELLS - 1) {
          k.add(k.box(0.88, 0.88, 0.88), {
            pos: [x, 0.48, z],
            ...surface("#586d7c"),
            kind: "token",
            params: [i - 1, 0],
          });
        }
        for (let a = 0; a < 3; a++) {
          k.add(k.box(0.22, 0.1, 0.68), {
            pos: [x + (a - 1) * 0.27, 0.12, z],
            ...surface(shade(COLORS[a], 0.18)),
            weight: 1.5,
            kind: "lever",
            params: [k.leverParam(groups[a], i), 0],
          });
        }
      }
      const goal = k.part("goal", { pivot: [3, 0.6, 3] });
      k.add(k.cylinder(0.3, 0.16, { caps: true }), { pos: [-3, 0.17, -3], ...surface("#2ab879") });
      k.add(k.cylinder(0.075, 1, { caps: true }), {
        pos: [3, 0.54, 3],
        part: goal,
        ...surface("#e9b83c"),
      });
      k.add(k.cylinder(0.3, 0.18, { caps: true }), {
        pos: [3, 1.04, 3],
        part: goal,
        ...surface("#e9b83c"),
      });
      k.add(k.sphere(0.13), { pos: [3, 1.2, 3], part: goal, ...surface("#fff0b3") });
      k.reach([-3.9, -0.8, -3.9]);
      k.reach([3.9, 1.1, 3.9]);
    },
  },
};
