import { mixSeed, mulberry32 } from "../../noise.js";

export const SIDE = 7;
export const CELLS = SIDE * SIDE;
export const STEP = 1 / 120;
export const ALGORITHMS = ["Breadth-first search", "Dijkstra", "A*"];

export function manhattan(a, b) {
  return Math.abs((a % SIDE) - (b % SIDE)) + Math.abs(Math.floor(a / SIDE) - Math.floor(b / SIDE));
}

export function neighbors(cell) {
  const x = cell % SIDE;
  const z = Math.floor(cell / SIDE);
  const list = [];
  if (x < SIDE - 1) list.push(cell + 1);
  if (z < SIDE - 1) list.push(cell + SIDE);
  if (x > 0) list.push(cell - 1);
  if (z > 0) list.push(cell - SIDE);
  return list;
}

export function maze(seed, density, generation = 0, goal = CELLS - 1) {
  const random = mulberry32(mixSeed(seed, `pathfinding-${generation}`));
  return Array.from({ length: CELLS }, (_, i) => {
    const wall = random() < density;
    return i !== 0 && i !== CELLS - 1 && i !== goal && wall;
  });
}

// Four-way, unit-cost graph search. Dijkstra really selects the minimum g;
// A* selects f = g + h, with h = |dx| + |dz|. Equal f favors lower h,
// then insertion order. BFS uses FIFO. Each node is counted on expansion,
// including the goal, and never counted twice. A consistent h permits closing
// nodes permanently. See the opened source linked in the recipe and PR.
export function search(walls, goal, algorithm) {
  const cost = Array(CELLS).fill(Infinity);
  const parent = Array(CELLS).fill(-1);
  const closed = new Set();
  const frontier = [0];
  const events = [];
  cost[0] = 0;
  while (frontier.length) {
    let best = 0;
    if (algorithm !== 0) {
      const priority = (i) => cost[i] + (algorithm === 2 ? manhattan(i, goal) : 0);
      for (let i = 1; i < frontier.length; i++) {
        const a = frontier[i];
        const b = frontier[best];
        if (
          priority(a) < priority(b) ||
          (algorithm === 2 &&
            priority(a) === priority(b) &&
            manhattan(a, goal) < manhattan(b, goal))
        )
          best = i;
      }
    }
    const current = frontier.splice(best, 1)[0];
    closed.add(current);
    if (current !== goal) {
      for (const next of neighbors(current)) {
        if (walls[next] || closed.has(next)) continue;
        const nextCost = cost[current] + 1;
        if (nextCost >= cost[next]) continue;
        cost[next] = nextCost;
        parent[next] = current;
        if (!frontier.includes(next)) frontier.push(next);
      }
    }
    events.push({
      cell: current,
      frontier: current === goal ? [] : frontier.slice(),
      visited: [...closed],
    });
    if (current === goal) break;
  }
  const path = [];
  if (closed.has(goal)) {
    for (let at = goal; at !== -1; at = parent[at]) path.push(at);
    path.reverse();
  }
  return { events, path, length: path.length ? path.length - 1 : null, visited: closed.size };
}

// Exact critically damped spring (https://www.ryanjuckett.com/damped-springs/)
// over a fixed step: e = y - target,
// j = v + omega*e; e' = (e + j*dt) exp(-omega*dt),
// v' = (v - omega*j*dt) exp(-omega*dt). omega is in s^-1;
// y is a fraction of the lever's rigid translation, not a displayed length.
export function spring(y, v, target, dt = STEP, omega = 32) {
  const error = y - target;
  const j = v + omega * error;
  const decay = Math.exp(-omega * dt);
  return [target + (error + j * dt) * decay, (v - omega * j * dt) * decay];
}
