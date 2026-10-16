// SI units: meters, newtons, pascals, and square meters. Positive N is tension.
// Roylance, Mechanics of Materials, §5.3 (matrix analysis of trusses):
// https://eng.libretexts.org/Bookshelves/Mechanical_Engineering/Mechanics_of_Materials_(Roylance)/05%3A_General_Stress_Analysis/5.03%3A_Finite_Element_Analysis
export const SPAN = 12;
export const HEIGHT = (3 * Math.sqrt(3)) / 2;
export const EA = 200e9 * 0.002;
export const STEP = 1 / 120;

export function makeTruss(style = "warren") {
  const nodes = Array.from({ length: 5 }, (_, i) => [3 * i, 0]);
  const members = [];
  const add = (a, b) => members.push({ a, b, name: `M${members.length + 1}` });
  for (let i = 0; i < 4; i++) add(i, i + 1);
  if (style === "warren") {
    for (let i = 0; i < 4; i++) nodes.push([1.5 + 3 * i, HEIGHT]);
    for (let i = 0; i < 3; i++) add(5 + i, 6 + i);
    for (let i = 0; i < 4; i++) {
      add(i, 5 + i);
      add(5 + i, i + 1);
    }
  } else {
    for (let i = 1; i < 4; i++) nodes.push([3 * i, HEIGHT]);
    add(5, 6);
    add(6, 7);
    add(0, 5);
    add(7, 4);
    for (let i = 1; i < 4; i++) add(i, i + 4);
    if (style === "pratt") {
      add(5, 2);
      add(2, 7);
    } else {
      add(1, 6);
      add(6, 3);
    }
  }
  return { style, nodes, members };
}

// Gaussian elimination with partial pivoting, on the free DOFs only.
function solve(A, b) {
  const n = b.length;
  const rows = A.map((r, i) => [...r, b[i]]);
  for (let j = 0; j < n; j++) {
    let p = j;
    for (let i = j + 1; i < n; i++) if (Math.abs(rows[i][j]) > Math.abs(rows[p][j])) p = i;
    if (Math.abs(rows[p][j]) < 1e-8) throw new Error("Unstable truss.");
    [rows[j], rows[p]] = [rows[p], rows[j]];
    for (let i = j + 1; i < n; i++) {
      const q = rows[i][j] / rows[j][j];
      for (let k = j; k <= n; k++) rows[i][k] -= q * rows[j][k];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let v = rows[i][n];
    for (let j = i + 1; j < n; j++) v -= rows[i][j] * x[j];
    x[i] = v / rows[i][i];
  }
  return x;
}

export function analyze(truss, loadKN = 100, position = 6) {
  const { nodes, members } = truss;
  const n = nodes.length * 2;
  const K = Array.from({ length: n }, () => Array(n).fill(0));
  const elements = members.map(({ a, b }) => {
    const dx = nodes[b][0] - nodes[a][0];
    const dy = nodes[b][1] - nodes[a][1];
    const L = Math.hypot(dx, dy);
    const B = [-dx / L, -dy / L, dx / L, dy / L];
    const dofs = [2 * a, 2 * a + 1, 2 * b, 2 * b + 1];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) K[dofs[i]][dofs[j]] += (EA / L) * B[i] * B[j];
    return { B, dofs, L };
  });
  // The deck transfers a point load to the adjacent panel joints by simple
  // span reactions, preserving both total load and moment exactly.
  const x = Math.max(0, Math.min(SPAN, position));
  const panel = Math.min(3, Math.floor(x / 3));
  const fraction = (x - panel * 3) / 3;
  const f = Array(n).fill(0);
  f[2 * panel + 1] = -loadKN * 1000 * (1 - fraction);
  f[2 * (panel + 1) + 1] = -loadKN * 1000 * fraction;
  const fixed = new Set([0, 1, 9]); // left pin; right vertical roller
  const free = Array.from({ length: n }, (_, i) => i).filter((i) => !fixed.has(i));
  const u = Array(n).fill(0);
  const uf = solve(
    free.map((i) => free.map((j) => K[i][j])),
    free.map((i) => f[i]),
  );
  free.forEach((j, i) => (u[j] = uf[i]));
  const forces = elements.map(
    ({ B, dofs, L }) => ((EA / L) * B.reduce((sum, v, i) => sum + v * u[dofs[i]], 0)) / 1000,
  );
  const reactions = K.map((row, i) => row.reduce((sum, v, j) => sum + v * u[j], 0) - f[i]);
  const weakest = forces.reduce((best, v, i) => Math.abs(v) > Math.abs(forces[best]) ? i : best, 0); // prettier-ignore
  return { forces, displacements: u, reactions, weakest, position: x, loadKN };
}

// Collapse is an illustrative constrained mechanism, not a post-failure
// structural prediction. Fixed-step symplectic Euler, followed by rigid bar
// length projection. The left pin and the right roller stay constrained.
export function collapseState(truss, broken) {
  return {
    truss,
    broken,
    nodes: truss.nodes.map((p) => p.slice()),
    velocity: truss.nodes.map(() => [0, 0]),
    time: 0,
  };
}

export function stepCollapse(s) {
  const old = s.nodes.map((p) => p.slice());
  s.nodes.forEach((p, i) => {
    s.velocity[i][1] -= 9.81 * STEP;
    for (let d = 0; d < 2; d++) p[d] += s.velocity[i][d] * STEP;
  });
  const weights = (i, d) => (i === 0 || (i === 4 && d === 1) ? 0 : 1);
  for (let pass = 0; pass < 40; pass++) {
    s.truss.members.forEach(({ a, b }, i) => {
      if (i === s.broken) return;
      const dx = s.nodes[b][0] - s.nodes[a][0];
      const dy = s.nodes[b][1] - s.nodes[a][1];
      const L = Math.hypot(dx, dy) || 1;
      const rest = Math.hypot(...s.truss.nodes[b].map((v, d) => v - s.truss.nodes[a][d]));
      const error = L - rest;
      const direction = [dx / L, dy / L];
      const w = direction.reduce((sum, v, d) => sum + v * v * (weights(a, d) + weights(b, d)), 0); // prettier-ignore
      if (w < 1e-10) return;
      for (let d = 0; d < 2; d++) {
        s.nodes[a][d] += (error * direction[d] * weights(a, d)) / w;
        s.nodes[b][d] -= (error * direction[d] * weights(b, d)) / w;
      }
    });
    s.nodes[0] = [0, 0];
    s.nodes[4][1] = 0;
    for (const p of s.nodes) p[1] = Math.max(-2, p[1]);
  }
  s.nodes.forEach((p, i) => {
    for (let d = 0; d < 2; d++) s.velocity[i][d] = ((p[d] - old[i][d]) / STEP) * Math.exp(-2 * STEP); // prettier-ignore
  });
  s.time += STEP;
}
