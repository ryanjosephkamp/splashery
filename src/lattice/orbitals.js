// Hydrogen orbitals for any n, l and m (lane Lattices and orbitals).
//
// psi(r, θ, φ) = R_nl(r) · Y_lm(θ, φ), in units of the Bohr radius a₀, with
//   R_nl(r) = N · (2r/n)^l · e^(−r/n) · L_(n−l−1)^(2l+1)(2r/n)
// (L the associated Laguerre polynomial; N makes ∫ r² R² dr = 1), and the
// real spherical harmonics
//   Y_l0 = √((2l+1)/4π) · P_l(cos θ),
//   Y_lm = √2 · √((2l+1)/4π · (l−|m|)!/(l+|m|)!) · P_l^|m|(cos θ) · cos(mφ)  (m > 0)
//                                                                · sin(|m|φ) (m < 0),
// without the Condon–Shortley sign, so each lobe's sign matches its Cartesian
// name (3d (xz) is positive where x·z is). In Cartesian form on the unit
// sphere, P_l^m(cos θ) · cos(mφ) = Q(z) · Re((x + iy)^m) with
// Q = d^m P_l / dz^m, which is how they are computed here.
//
// |psi|² separates, so a sample draws its radius from r² R² (a tabulated
// inverse CDF, as the Electron orbital toy does) and its direction from Y²
// (rejection against Y's largest value).

export const LETTERS = "spdfghi";

// Factorials as floats (fine to 30!).
function fact(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

// L_k^a(x) = Σ_i (−1)^i C(k + a, k − i) x^i / i!
export function laguerre(k, a, x) {
  let sum = 0;
  for (let i = 0; i <= k; i++) {
    let binom = 1;
    for (let j = 1; j <= k - i; j++) binom *= (a + i + j) / j;
    sum += ((i % 2 ? -1 : 1) * binom * x ** i) / fact(i);
  }
  return sum;
}

// The normalized radial function R_nl(r), r in Bohr radii.
export function radial(n, l) {
  // N² = (2/n)³ (n − l − 1)! / (2n (n + l)!)
  const N = Math.sqrt((2 / n) ** 3 * (fact(n - l - 1) / (2 * n * fact(n + l))));
  return (r) => {
    const x = (2 * r) / n;
    return N * x ** l * Math.exp(-x / 2) * laguerre(n - l - 1, 2 * l + 1, x);
  };
}

// Legendre polynomial P_l as coefficients (index = power), and its m-th
// derivative.
function legendreCoeffs(l) {
  // P_l(z) = 2^−l Σ_k (−1)^k C(l, k) C(2l − 2k, l) z^(l − 2k)
  const c = new Array(l + 1).fill(0);
  for (let k = 0; 2 * k <= l; k++)
    c[l - 2 * k] =
      ((k % 2 ? -1 : 1) * (fact(l) / (fact(k) * fact(l - k))) * fact(2 * l - 2 * k)) /
      (fact(l) * fact(l - 2 * k)) /
      2 ** l;
  return c;
}
function derive(c, m) {
  let d = c.slice();
  for (let j = 0; j < m; j++) d = d.slice(1).map((v, i) => v * (i + 1));
  return d;
}
const poly = (c, z) => c.reduceRight((acc, v) => acc * z + v, 0);

// The real spherical harmonic Y_lm as a function of a unit direction
// (x, y, z), normalized over the sphere.
export function harmonic(l, m) {
  const am = Math.abs(m);
  const Q = derive(legendreCoeffs(l), am);
  const N =
    Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * (fact(l - am) / fact(l + am))) *
    (m === 0 ? 1 : Math.SQRT2);
  return (x, y, z) => {
    // (x + iy)^|m|
    let re = 1;
    let im = 0;
    for (let j = 0; j < am; j++) [re, im] = [re * x - im * y, re * y + im * x];
    return N * poly(Q, z) * (m >= 0 ? re : im);
  };
}

// The Cartesian names of the real harmonics, by l and m (the leading term,
// as chemistry books write them).
const NAMES = {
  0: { 0: "" },
  1: { 0: "z", 1: "x", "-1": "y" },
  2: { 0: "z²", 1: "xz", "-1": "yz", 2: "x²−y²", "-2": "xy" },
  3: {
    0: "z³",
    1: "xz²",
    "-1": "yz²",
    2: "z(x²−y²)",
    "-2": "xyz",
    3: "x(x²−3y²)",
    "-3": "y(3x²−y²)",
  },
  4: {
    0: "z⁴",
    1: "xz³",
    "-1": "yz³",
    2: "z²(x²−y²)",
    "-2": "xyz²",
    3: "xz(x²−3y²)",
    "-3": "yz(3x²−y²)",
    4: "x⁴−6x²y²+y⁴",
    "-4": "xy(x²−y²)",
  },
};
// The order m is listed in within a subshell (as the Electron orbital toy
// lists them: z-type first, then x, y, and the in-plane ones last).
const M_ORDER = [0, 1, -1, -2, 2, -3, 3, -4, 4];

// Every orbital the atlas offers: all of n = 1 to 5, and the s, p and d
// orbitals that atoms fill beyond (6s, 6p, 6d, 7s, 7p).
export function orbitalList() {
  const out = [];
  const shells = [
    [1, [0]],
    [2, [0, 1]],
    [3, [0, 1, 2]],
    [4, [0, 1, 2, 3]],
    [5, [0, 1, 2, 3, 4]],
    [6, [0, 1, 2]],
    [7, [0, 1]],
  ];
  for (const [n, ls] of shells)
    for (const l of ls)
      for (const m of M_ORDER.filter((mm) => Math.abs(mm) <= l)) out.push(orbitalId(n, l, m));
  return out;
}

export function orbitalId(n, l, m) {
  return `${n}${LETTERS[l]}${m === 0 ? "" : m}`;
}
export function parseOrbitalId(id) {
  const g = /^([1-9])([spdfghi])(-?\d)?$/.exec(String(id));
  if (!g) return null;
  const n = Number(g[1]);
  const l = LETTERS.indexOf(g[2]);
  const m = g[3] ? Number(g[3]) : 0;
  if (l >= n || Math.abs(m) > l) return null;
  return { n, l, m };
}

// The largest |Y| over the sphere (found on a fine Fibonacci sphere).
function harmonicMax(Y) {
  let ymax = 0;
  const N = 6000;
  for (let i = 0; i < N; i++) {
    const z = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(1 - z * z);
    const a = i * 2.399963229728653;
    ymax = Math.max(ymax, Math.abs(Y(r * Math.cos(a), r * Math.sin(a), z)));
  }
  return ymax;
}

// An orbital: { id, n, l, m, label, R, Y, ymax, rmax, face }. face: the
// orbital lies in the xy plane (|m| = l ≥ 2), so the toy shows it face on.
export function orbital(id) {
  const q = parseOrbitalId(id);
  if (!q) return null;
  const { n, l, m } = q;
  const name = NAMES[l]?.[m] ?? `m = ${m}`;
  const Y = harmonic(l, m);
  return {
    id,
    n,
    l,
    m,
    label: `${n}${LETTERS[l]}${name ? ` (${name})` : ""}`,
    R: radial(n, l),
    Y,
    ymax: harmonicMax(Y) * 1.002,
    rmax: 2.5 * n * n + 12,
    face: Math.abs(m) === l && l >= 2,
    radialNodes: n - l - 1,
    angularNodes: l,
  };
}

// A radius sampler for r² R(r)², cut at the given quantile (98.5%, as the
// Electron orbital toy does) so a few far samples do not shrink the picture.
export function radialSampler(R, rmax, cutQ = 0.985) {
  const N = 4096;
  const cdf = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) {
    const r = ((i - 0.5) / N) * rmax;
    const f = r * R(r);
    cdf[i] = cdf[i - 1] + f * f;
  }
  const total = cdf[N];
  for (let i = 0; i <= N; i++) cdf[i] /= total;
  let hiR = rmax;
  for (let i = 0; i <= N; i++)
    if (cdf[i] >= cutQ) {
      hiR = (i / N) * rmax;
      break;
    }
  return {
    extent: hiR,
    sample(u) {
      const x = u * cutQ;
      let lo = 0;
      let hi = N;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cdf[mid] < x) lo = mid + 1;
        else hi = mid;
      }
      const i = Math.max(1, lo);
      const f = (x - cdf[i - 1]) / Math.max(1e-15, cdf[i] - cdf[i - 1]);
      return ((i - 1 + f) / N) * rmax;
    },
  };
}

// A uniformly random unit vector.
function randDir(rand) {
  const z = rand() * 2 - 1;
  const a = rand() * 2 * Math.PI;
  const s = Math.sqrt(1 - z * z);
  return [s * Math.cos(a), s * Math.sin(a), z];
}

// A direction drawn from Y² (rejection), with Y's value there.
export function sampleDirection(orb, rand) {
  let d;
  let y;
  for (let tries = 0; tries < 400; tries++) {
    d = randDir(rand);
    y = orb.Y(d[0], d[1], d[2]);
    if (rand() * orb.ymax * orb.ymax <= y * y) break;
  }
  return { d, y };
}

// One point drawn from |psi|²: { p: [x, y, z] (Bohr radii), psi }.
export function samplePoint(orb, sampler, rand) {
  const r = sampler.sample(rand());
  const { d, y } = sampleDirection(orb, rand);
  return { p: [d[0] * r, d[1] * r, d[2] * r], r, psi: orb.R(r) * y };
}

// The radii where R_nl changes sign (its radial nodes), found on a fine grid.
export function radialNodes(orb) {
  const out = [];
  const N = 20000;
  let prev = orb.R(1e-6);
  for (let i = 1; i <= N; i++) {
    const r = (i / N) * orb.rmax;
    const v = orb.R(r);
    if (prev !== 0 && v !== 0 && Math.sign(v) !== Math.sign(prev)) {
      // Bisect.
      let a = ((i - 1) / N) * orb.rmax;
      let b = r;
      for (let k = 0; k < 50; k++) {
        const c = (a + b) / 2;
        if (Math.sign(orb.R(c)) === Math.sign(orb.R(a))) a = c;
        else b = c;
      }
      out.push((a + b) / 2);
    }
    prev = v;
  }
  return out;
}
