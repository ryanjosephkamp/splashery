#!/usr/bin/env node
// Lane Optics: writes docs/evidence/ripple-tank.json and docs/evidence/light-bench.json
// (docs/evidence/README.md). The claims and sources are written here; the
// `where` and `test` lines are looked up from the code each time, so they
// stay right as the files change. Run after changing src/optics/ or
// tests/opt.spec.mjs:
//
//   node tools/opt-evidence.mjs

import fs from "node:fs";

const lineOf = (file, needle) => {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const i = lines.findIndex((l) => l.includes(needle));
  if (i < 0) throw new Error(`Not found in ${file}: ${needle}`);
  return `${file}:${i + 1}`;
};
const T = "tests/opt.spec.mjs";
const RIP = "src/optics/ripple.js";
const RAY = "src/optics/rays.js";
const BEN = "src/optics/bench.js";
const CHECKED = "2026-10-05";

const WIKI = (title, path, says) => ({ title, publisher: "Wikipedia", url: `https://en.wikipedia.org/wiki/${path}`, says }); // prettier-ignore
const SCHOTT = (glass, says) => ({
  title: `${glass} (SCHOTT optical glass data sheets, 2017)`,
  publisher: "RefractiveIndex.INFO",
  url: `https://refractiveindex.info/?shelf=specs&book=SCHOTT-optical&page=${glass}`,
  says,
});

const ripple = {
  toy: "ripple-tank",
  checked: CHECKED,
  summary:
    "The ripple tank solves the two-dimensional wave equation on a grid and draws the water's height. Through two slits its bright fringes land where d·sin θ = m·λ says, and a single slit's beam spreads wider as the slit narrows, both measured from the simulation itself. The water is shown slowed down and with its heights exaggerated, and every wavelength travels at the one speed set.",
  claims: [
    {
      claim: "The water follows the wave equation ∂²u/∂t² = c²∇²u, solved by finite differences.",
      how: "Each step updates every cell from its four neighbors with the standard second-order centered scheme (the five-point Laplacian); a damping term is added only in the beaches at the edges.",
      where: lineOf(RIP, "next[k] = (2 * u[k]"),
      sources: [WIKI("Wave equation", "Wave_equation", "In two dimensions u_tt = c²(u_xx + u_yy); the wave equation describes mechanical waves such as water waves and sound waves, and light.")], // prettier-ignore
      verdict: "correct",
      test: lineOf(T, "a wave travels at the speed set"),
      note: "The test checks that a dipper's crests are λ = c / f apart (within 2%).",
    },
    {
      claim: "The time step is small enough for the scheme to stay stable.",
      how: "Δt is set so the Courant number c·Δt/Δx is 0.5 at the fastest speed the controls allow, so even the sum over both directions (2 × 0.5) stays at the limit of 1.",
      where: lineOf(RIP, "this.dt = (COURANT"),
      sources: [WIKI("Courant–Friedrichs–Lewy condition", "Courant%E2%80%93Friedrichs%E2%80%93Lewy_condition", "In two dimensions C = u_x Δt/Δx + u_y Δt/Δy ≤ C_max; for an explicit (time-marching) solver typically C_max = 1.")], // prettier-ignore
      verdict: "correct",
      test: lineOf(T, "the time step keeps the Courant number"),
      note: "The test runs 6,000 steps with a source and a barrier and checks the water stays bounded.",
    },
    {
      claim: "The edges absorb the waves, like the sloping beaches of a real ripple tank.",
      how: "A border 5 cm wide damps the water, gently at its inner edge and more toward the wall (as the square of the depth into it), so a ring crosses it and dies instead of bouncing back.",
      where: lineOf(RIP, "setBeach(L) {"),
      sources: [WIKI("Ripple tank", "Ripple_tank", "All the basic properties of waves, including reflection, refraction, interference and diffraction, can be demonstrated; the ripples show up as shadows on the screen underneath.")], // prettier-ignore
      verdict: "correct",
      test: lineOf(T, "the beaches soak a pebble"),
      note: "After a pebble's rings reach the edges, under 1% of their energy is left in the tank.",
    },
    {
      claim: "Through two slits d apart, the bright fringes are at angles where d·sin θ = m·λ.",
      how: "The test runs a plane wave through two slits in a large tank and measures the time-averaged strength of the water along an arc 52 cm from the slits, then finds its peaks.",
      where: lineOf(RIP, "export function arcIntensity"),
      sources: [WIKI("Double-slit experiment", "Double-slit_experiment", "The interference fringe maxima occur at angles d sin θ = nλ, n = 0, 1, 2, … (bright bands where the path difference is a whole number of wavelengths).")], // prettier-ignore
      verdict: "close",
      test: lineOf(T, "double slit, d = ${d} cm"),
      note: "For d = 10 and 12 cm and λ = 4 cm the first bright fringes land within 0.6° of the law; the second, at wide angles, within 4°, pulled in by each slit's own spreading.",
    },
    {
      claim:
        "A single slit's beam spreads wider as the slit narrows, with its first dark fringe at sin θ = λ / a.",
      how: "The test measures the beam's half width for slits 12, 8 and 5 cm wide, and the first dark fringe for the 8 cm slit.",
      where: lineOf(RIP, "export function centralHalfWidth"),
      sources: [WIKI("Double-slit experiment", "Double-slit_experiment", "A single slit of width b gives an intensity proportional to sinc²(π b sin θ / λ), which is first zero where b sin θ = λ.")], // prettier-ignore
      verdict: "close",
      test: lineOf(T, "single slit: the beam spreads wider"),
      note: "Each narrower slit's beam is at least 20% wider; the 8 cm slit's first dark fringe is within 1.5° of 30°.",
    },
    {
      claim: "The dotted lines mark where the two paths differ by a whole number of wavelengths.",
      how: "For each cell past the slits (or the two dippers) the toy works out the difference of its distances to the two and dots the cells where it is a multiple of λ; far away these lines run at the angles d·sin θ = m·λ gives.",
      where: lineOf("src/packs/optics.js", "function guideField(tank, L)"),
      sources: [WIKI("Double-slit experiment", "Double-slit_experiment", "Bright bands appear where the path difference is an integral number of wavelengths.")], // prettier-ignore
      verdict: "correct",
      test: "",
      note: "",
    },
  ],
  simplified: [
    "Real ripples on shallow water are dispersive (their speed changes a little with the wavelength, and surface tension matters for short ones); here every wavelength moves at the speed set by the slider.",
    "The motion is shown four times slower than real, and the heights are exaggerated so the crests can be seen.",
    "The light and shade are worked out from the water's slope and curvature for the picture; they are not a ray-traced image of a lamp through water.",
    "The dippers are idealized: each holds a small disc of water to a sine wave.",
  ],
  fixes: [],
};

const bench = {
  toy: "light-bench",
  checked: CHECKED,
  summary:
    "The light bench traces rays through real surfaces: at each one a ray bends by Snell's law or reflects, with the glass's refractive index from its published Sellmeier formula. The lens equation's image distance, the prism's deviation and a light guide's acceptance angle are checked against the traced rays. The bench is flat, white light is nine wavelengths, and the weak reflections at glass surfaces are left out.",
  claims: [
    {
      claim:
        "Rays bend by Snell's law, n₁ sin θ₁ = n₂ sin θ₂, and reflect totally past the critical angle.",
      how: "Refraction uses the vector form of Snell's law; when it has no solution the ray reflects (total internal reflection).",
      where: lineOf(RAY, "export function refract"),
      sources: [WIKI("Snell's law", "Snell%27s_law", "n₁ sin θ₁ = n₂ sin θ₂; in vector form v_refract = rℓ + (rc − √(1 − r²(1 − c²)))n with r = n₁/n₂ and c = −n·ℓ; beyond θ_crit = arcsin(n₂/n₁) light is totally reflected.")], // prettier-ignore
      verdict: "correct",
      test: lineOf(T, "refraction angles into and out of a glass block"),
      note: "Checked at six angles and three wavelengths, to 9 decimal places; the critical angle in its own test.",
    },
    {
      claim: "The glass is Schott N-BK7 and N-SF11, with their published Sellmeier coefficients.",
      how: "n² − 1 = Σ Bᵢλ² / (λ² − Cᵢ), with the data sheets' six coefficients for each glass.",
      where: lineOf(RAY, "export function sellmeier"),
      sources: [
        SCHOTT("N-BK7", "B₁ = 1.03961212, B₂ = 0.231792344, B₃ = 1.01046945, C₁ = 0.00600069867, C₂ = 0.0200179144, C₃ = 103.560653 (λ in μm); nd = 1.5168."), // prettier-ignore
        SCHOTT("N-SF11", "B₁ = 1.73759695, B₂ = 0.313747346, B₃ = 1.89878101, C₁ = 0.013188707, C₂ = 0.0623068142, C₃ = 155.23629; nd = 1.78472."), // prettier-ignore
      ],
      verdict: "correct",
      test: lineOf(T, "the glasses' indices from their Sellmeier"),
      note: "nd, nF and nC of N-BK7 to 4 decimal places, and its Abbe number 64.17.",
    },
    {
      claim:
        "A lens's focal length follows the lensmaker's equation, and its image the lens equation 1/f = 1/d_o + 1/d_i.",
      how: "The bench prints f from the thick-lens lensmaker's equation and d_i from the lens equation (measured from the principal planes), beside where the traced rays from the object's foot, close to the axis, really cross.",
      where: lineOf(RAY, "export function thickLens"),
      sources: [WIKI("Lens", "Lens#Lensmaker's_equation", "1/f = (n − 1)[1/R₁ − 1/R₂ + (n − 1)d/(nR₁R₂)]; and the Gaussian lens formula 1/f = 1/S₁ + 1/S₂ (virtual images have negative S₂).")], // prettier-ignore
      verdict: "correct",
      test: lineOf(T, "a lens's traced image lands where"),
      note: "For the four lenses at three object distances the traced image is within 0.3% of the formula. Rays far from the axis cross a little off it (spherical aberration and the aberrations of off-axis points), as with real lenses.",
    },
    {
      claim:
        "A prism deviates light by δ = i + e − A, more for blue than for red, so white light fans out.",
      how: "The traced ray's change of direction is compared with the formula from Snell's law at each face, for two glasses, three angles and five wavelengths.",
      where: lineOf(RAY, "export function prismDeviation"),
      sources: [WIKI("Minimum deviation", "Minimum_deviation", "δ = i + e − A; at minimum deviation n = sin((A + D_m)/2) / sin(A/2), when the ray inside runs parallel to the base.")], // prettier-ignore
      verdict: "correct",
      test: lineOf(T, "a prism's traced deviation"),
      note: "Agreement to 1e-9 radian; N-BK7's minimum deviation at 587.6 nm for a 60° prism is 38.65°.",
    },
    {
      claim:
        "A concave mirror focuses a parallel beam at f = R / 2; a flat mirror reflects at the angle it was hit.",
      how: "Rays near the axis are traced off a circular mirror and their crossing with the axis is measured.",
      where: lineOf(RAY, "export function mirrorSurfaces"),
      sources: [WIKI("Focal length", "Focal_length", "For a spherically curved mirror, the magnitude of the focal length is equal to the radius of curvature of the mirror divided by two.")], // prettier-ignore
      verdict: "correct",
      test: lineOf(T, "a concave mirror brings rays"),
      note: "",
    },
    {
      claim:
        "The light guide keeps light inside by total internal reflection, accepting rays up to the angle its numerical aperture gives.",
      how: "A core of N-SF11 in a cladding of N-BK7: the critical angle is arcsin(n₂/n₁) and the acceptance half angle arcsin(√(n₁² − n₂²)) in air; rays are traced into a straight guide at angles either side of it.",
      where: lineOf(RAY, "export function fiberNumbers"),
      sources: [WIKI("Numerical aperture", "Numerical_aperture", "For a step-index fiber NA = √(n_core² − n_clad²), and n sin θ_max = NA gives the acceptance angle.")], // prettier-ignore
      verdict: "correct",
      test: lineOf(T, "the light guide keeps rays inside"),
      note: "A tight bend lets light out where it meets the wall under the critical angle; the bend radius is an option.",
    },
  ],
  simplified: [
    "The bench is flat: rays travel in one plane, and lenses and mirrors are their cross sections.",
    "White light is drawn as nine wavelengths from 410 to 665 nm, and the colors on screen are approximations of the spectral colors.",
    "The weak reflections at each glass surface (about 4% for N-BK7 face on) are left out; only refraction, mirror reflection and total internal reflection are drawn.",
    "Air is taken as n = 1.",
    "The light guide is a thick glass rod with a high-index core (N-SF11 in N-BK7), much wider than a telecom fiber, so its rays can be seen; it works by the same total internal reflection.",
  ],
  fixes: [],
};

for (const e of [ripple, bench]) {
  fs.writeFileSync(`docs/evidence/${e.toy}.json`, JSON.stringify(e, null, 2) + "\n");
  console.log(`docs/evidence/${e.toy}.json`);
}
