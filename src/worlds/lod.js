// Level of detail: which level each chunk and prop shows, from the camera's
// distance, kept under the tier's splat budget. PlayCanvas 2.22's own LOD
// and splatBudget work on streamed octree files (SOG with LOD); a world is
// built on the device from recipes, so it keeps its own levels: every chunk
// of ground and water, and every prop, has near, middle and far versions.
// Near things are sharp; far ones use fewer, larger splats. If the plan
// comes out over budget, the distances shrink until it fits (and as a last
// step the farthest small props are left out). Pure JavaScript.

// items: [{ id, x, z, radius, counts: [level 0, level 1, ...], kind }]
// where counts[k] is how many splats level k draws (a count of 0 is fine).
// Returns { levels: Map(id -> level or -1 for hidden), total, scale }.
export function planLevels(items, cam, tier, budget) {
  let scale = 1;
  let plan = null;
  for (let tries = 0; tries < 12; tries++) {
    plan = assign(items, cam, tier, scale);
    if (plan.total <= budget) break;
    scale *= 0.84;
  }
  if (plan.total > budget) {
    // Last resort: leave out the farthest props until it fits.
    const props = items
      .filter((it) => it.kind === "prop" && plan.levels.get(it.id) >= 0)
      .sort((a, b) => dist(b, cam) - dist(a, cam));
    for (const it of props) {
      if (plan.total <= budget) break;
      plan.total -= it.counts[plan.levels.get(it.id)] || 0;
      plan.levels.set(it.id, -1);
    }
  }
  plan.scale = scale;
  return plan;
}

function dist(it, cam) {
  return Math.max(0, Math.hypot(it.x - cam[0], it.z - cam[2]) - it.radius);
}

function assign(items, cam, tier, scale) {
  const near = tier.near * scale;
  const mid = tier.mid * scale;
  const levels = new Map();
  let total = 0;
  for (const it of items) {
    const d = dist(it, cam);
    let lv;
    if (it.kind === "prop") {
      // Big props keep their detail farther away.
      const big = Math.max(1, it.size / 4);
      const dd = d / big;
      lv = dd < near * 0.7 ? 0 : dd < mid * 1.1 ? 1 : 2;
      if (dd > mid * 4) lv = -1;
    } else {
      lv = d < near ? 0 : d < mid ? 1 : d < mid * 2.2 ? 2 : 3;
    }
    lv = Math.min(lv, it.counts.length - 1);
    levels.set(it.id, lv);
    if (lv >= 0) total += it.counts[lv];
  }
  return { levels, total };
}
