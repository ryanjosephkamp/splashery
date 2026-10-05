// Tiny world r2 (lane Tiny world r2, October 2026): DNA to protein, and the
// life of a cell. Labs toys, technically right and drawn like a textbook;
// each toy's sources and simplifications are in docs/evidence/<toy id>.json.

import { mix, shade, smoothstep, quatAxisAngle } from "../kit.js";
import { evenBox, evenEllipsoid } from "./even.js";
import { GENES } from "../tiny/genes.js";
import { AMINO, anticodon, readSequence } from "../tiny/genetic-code.js";
import { buildStory, storyLine, LEAD } from "../tiny/protein-story.js";
import { add, sub, mul, len, unit, lerp, clamp01, ease, band, text } from "../tiny/draw.js";

const TAU = Math.PI * 2;

// Fake light (splats are unlit): a key light from the upper left front.
const LIGHT = unit([-0.45, 0.8, 0.45]);
const lit = (col, n, amb = 0.68, k = 0.4) =>
  shade(col, amb + k * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]));

// ---- DNA to protein -----------------------------------------------------------------------

// Bases (RNA's U has its own color, so the change from T reads at a glance)
// and amino acids by their side chain.
export const BASE_COLORS = { A: "#ff6b6b", T: "#ffd93d", G: "#6bcb77", C: "#4d96ff", U: "#ff9f43" };
export const AMINO_COLORS = { nonpolar: "#e7cf98", polar: "#c58bff", acidic: "#ff5f7e", basic: "#5aa9ff" }; // prettier-ignore
const PLAIN = "#8c93a3"; // a base standing for the codons not drawn
const INK = "#15202e";
const CODING = "#c9d4ea";
const TEMPLATE = "#7f95e0";
const RNA_BACK = "#ff9db8";
const TRNA = "#cdb2ff";
const RF = "#ff8f7a";
const POLY = "#9fe6cf";
const SMALL = "#f3cd86";
const LARGE = "#93bdf5";

// Layout, in recipe units.
const S = 0.42; // one base along a strand
const CODON = 3 * S;
const YD = 6.0; // the middle of the DNA ladder
const YR = YD - 1.48; // the new RNA's backbone, under the template strand
const YM = -3.0; // the mRNA's backbone where it is read
const BEAD = 0.3; // amino acids along the chain
const SCALE = BEAD / 3.8; // recipe units per ångström (an alpha carbon every 3.8 Å)
const T_ALL = 34; // the story's length in seconds

// The ribosome, in its own frame: origin at the middle of the codon in the
// P site, on the mRNA's backbone.
const AA_Y = 2.62; // an amino acid on top of its tRNA
const TUNNEL = [
  [0.63, 2.95, 0],
  [0.63, 3.62, 0],
]; // the exit tunnel, from the peptidyl transferase center up
const EXIT = [0.63, 3.62, 0];

const CHANGE_CHOICES = [
  { id: "none", label: "None" },
  { id: "point", label: "Change one base" },
  { id: "insert", label: "Add a base" },
  { id: "delete", label: "Remove a base" },
];

const DNA_SHOWN = { line: "" };

// The last story time each toy's drive saw (keyed by its control state), so
// a sound cue plays once as the story passes it.
const LAST = new WeakMap();
function cuesBetween(c, t, list, out) {
  const was = LAST.get(c) ?? -1;
  LAST.set(c, t);
  if (t < was) return;
  for (const [at, spec] of list) if (was < at && t >= at) out.cues.push(spec);
}

const DNA_INPUT = {
  title: "Your own DNA",
  placeholder: "ATGGTGCATCTGACTCCTGAGTAA",
  button: "Make the protein",
  fileButton: "Open a FASTA file…",
  accept: ".fa,.fasta,.fna,.txt,.seq",
  note: "Type or paste a DNA (or RNA) sequence, 5′ to 3′, or open a FASTA file. The ribosome starts at the first ATG and reads three bases at a time to a stop codon. A protein that matches one of the four genes folds into its structure; any other is shown unfolded.",
  async read(text) {
    const seq = readSequence(text);
    if (seq.length > 6000)
      throw new Error("That's longer than 6,000 bases: try one gene's coding sequence.");
    if (!seq.includes("ATG")) throw new Error("There's no start codon (ATG) in this sequence, so a ribosome would make no protein from it."); // prettier-ignore
    return { gene: "custom", sequence: seq };
  },
  shown: () => DNA_SHOWN.line,
};

function aminoColor(aa) {
  return AMINO_COLORS[AMINO[aa]?.[2]] || "#cccccc";
}

// The protein's structure, centered and turned so its longest side runs
// across, in recipe units. Residues the structure lacks are placed on from
// their neighbors (a loose end).
function nativeShape(ca, rand) {
  const pts = ca.map((p) => (p ? mul(p, SCALE) : null));
  const have = pts.filter(Boolean);
  const c = mul(have.reduce(add, [0, 0, 0]), 1 / have.length);
  for (let i = 0; i < pts.length; i++) if (pts[i]) pts[i] = sub(pts[i], c);
  // Covariance and its largest axis (power iteration), then the second.
  const cov = [0, 1, 2].map((a) => [0, 1, 2].map((b) => have.reduce((s, p) => s + (p[a] - c[a]) * (p[b] - c[b]), 0))); // prettier-ignore
  const axis = (skip) => {
    let v = skip ? unit([skip[1], -skip[0], 0.3]) : [1, 0.3, 0.2];
    for (let it = 0; it < 40; it++) {
      let w = [0, 1, 2].map((a) => cov[a][0] * v[0] + cov[a][1] * v[1] + cov[a][2] * v[2]);
      if (skip) w = sub(w, mul(skip, w[0] * skip[0] + w[1] * skip[1] + w[2] * skip[2]));
      v = unit(w);
    }
    return v;
  };
  const e1 = axis(null);
  const e2 = axis(e1);
  const e3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; // prettier-ignore
  const to = (p) => [p[0] * e1[0] + p[1] * e1[1] + p[2] * e1[2], p[0] * e2[0] + p[1] * e2[1] + p[2] * e2[2], p[0] * e3[0] + p[1] * e3[1] + p[2] * e3[2]]; // prettier-ignore
  for (let i = 0; i < pts.length; i++) if (pts[i]) pts[i] = to(pts[i]);
  // Fill the gaps: a missing stretch hangs loosely off its neighbor.
  for (const dir of [1, -1]) {
    const order = dir > 0 ? [...pts.keys()] : [...pts.keys()].reverse();
    for (const i of order) {
      const j = i - dir;
      if (pts[i] || j < 0 || j >= pts.length || !pts[j]) continue;
      const out = unit(add(unit(pts[j]), [rand() - 0.5, rand() - 0.5, rand() - 0.5]));
      pts[i] = add(pts[j], mul(out, BEAD));
    }
  }
  return pts;
}

// A compact random walk for the newly made chain (a "molten globule" over
// the ribosome's exit): bead r at p[r], each BEAD from the last, inside a
// ball of radius R round `center`, and never closer than 0.8 BEAD to another.
function globule(first, n, center, R, rand) {
  const p = first.slice();
  while (p.length < n) {
    const last = p[p.length - 1];
    let best = null;
    let bestScore = -Infinity;
    for (let tries = 0; tries < 24; tries++) {
      const d = unit([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
      const q = add(last, mul(d, BEAD));
      const out = len(sub(q, center)) - R;
      let near = Infinity;
      for (let i = Math.max(0, p.length - 400); i < p.length - 1; i++)
        near = Math.min(near, len(sub(q, p[i])));
      const score = -Math.max(0, out) * 4 - (near < 0.8 * BEAD ? 2 : 0) + rand() * 0.2;
      if (score > bestScore) [best, bestScore] = [q, score];
    }
    p.push(best);
  }
  return p;
}

// Everything the build and the drive share, worked out from the story.
function dnaLayout(story, rand) {
  const items = story.items;
  const n = items.length;
  const x = items.map((_, j) => (j - (n - 1) / 2) * S);
  const x0 = x[0];
  const L = story.protein.length;
  const nCodons = story.codons.length;
  const hasStop = !story.nonstop;
  // Where each drawn codon's middle base is.
  const codonX = {};
  items.forEach((it, j) => {
    if (it.codon >= 0 && it.pos === 1) codonX[it.codon] = x[j];
  });
  const shownCodons = Object.keys(codonX)
    .map(Number)
    .sort((a, b) => a - b);
  // The P site's x for a codon number (fractional between drawn codons).
  const knots = shownCodons.map((c) => [c, codonX[c]]);
  const pAt = (q) => {
    if (q <= knots[0][0]) return knots[0][1] + (q - knots[0][0]) * CODON;
    for (let i = 1; i < knots.length; i++) {
      const [c1, x1] = knots[i];
      const [c0, x0] = knots[i - 1];
      if (q <= c1) return x0 + ((q - c0) / (c1 - c0)) * (x1 - x0);
    }
    const [cl, xl] = knots[knots.length - 1];
    return xl + (q - cl) * CODON;
  };
  // The sense codons drawn base by base each get a tRNA (and their amino
  // acid a token); the stop codon gets the release factor.
  const tokenCodons = shownCodons.filter((c) => c < L);
  const tokenOf = new Map(tokenCodons.map((c, i) => [c, i]));
  const midFrom = items.findIndex((it) => it.mid);
  const midTo = midFrom < 0 ? -1 : midFrom + items.filter((it) => it.mid).length - 1;

  // ---- The timeline (seconds) ----
  const tl = {};
  let t = 0.4;
  tl.tx = [t, (t += 7.0)];
  tl.txOut = [t, (t += 0.6)];
  tl.down = [t - 0.2, (t += 1.0)];
  tl.bind = [t, (t += 0.9)];
  tl.scan = [t, (t += 0.8)];
  tl.join = [t, (t += 0.7)];
  // Elongation: codons 1 .. L-1 come into the A site in turn; drawn codons
  // take a cycle each, the codons not drawn go by together.
  const CYCLE = 1.2;
  const FF = 3.6;
  tl.cycles = []; // { k (the codon in the A site), t0, t1 }
  let ff = null;
  for (let k = 1; k < L; k++) {
    if (tokenOf.has(k)) {
      tl.cycles.push({ k, t0: t, t1: (t += CYCLE) });
    } else if (!ff) {
      // The run of codons not drawn: from k to the next drawn codon.
      let k1 = k;
      while (k1 + 1 < L && !tokenOf.has(k1 + 1)) k1++;
      ff = { k0: k, k1, t0: t, t1: (t += FF) };
      k = k1;
    }
  }
  tl.ff = ff;
  tl.stop = [t, (t += 0.6)]; // the release factor comes in
  tl.release = [t, (t += 1.0)]; // the chain leaves the tunnel
  tl.part = [t, (t += 0.9)]; // the subunits come apart
  tl.fold = [t, (t += 3.2)];
  tl.reset = [T_ALL - 2.6, T_ALL - 0.15];
  tl.hold = [t, tl.reset[0]];

  // ---- The chain: hanging from the ribosome, then a globule ----
  // The path from an amino acid on a tRNA (P site 0, A site 1) up the tunnel.
  const chainPath = (from) => [[from * CODON, AA_Y, 0], ...TUNNEL, [EXIT[0], EXIT[1] + 20, 0]];
  const tunnelLen = (() => {
    const P = chainPath(0);
    return len(sub(P[1], P[0])) + len(sub(P[2], P[1]));
  })();
  // The ribosome's P site at release (the last codon), and the globule.
  const qEnd = L - 1;
  const xEnd = pAt(qEnd);
  const ffStartQ = ff ? ff.k0 - 1 : qEnd;
  const R = 0.35 * Math.cbrt(Math.max(L, 8));
  // The first beads hang straight up out of the exit when the quick run
  // starts; the rest of the globule is a walk on from them.
  const laidLen = tunnelLen / BEAD + 2; // beads from the tRNA to their place outside
  const exitEnd = add(EXIT, [xEnd, YM, 0]);
  const center = add(exitEnd, [0.2, R + 0.25, 0]);
  const kHang = tokenCodons.filter((c) => c < (ff ? ff.k0 : L)).length;
  const first = [];
  for (let r = 0; r < kHang; r++) {
    const arc = (kHang - 1 - r) * BEAD - tunnelLen;
    if (arc >= 0) first.push(add(exitEnd, [0, arc + 0.2, 0]));
  }
  if (!first.length) first.push(add(exitEnd, [0, 0.3, 0]));
  const ball = globule(first, L, center, R, rand);

  // The folded shape, set on the globule's middle.
  const fold = story.fold;
  let native = null;
  if (fold) {
    const nat = nativeShape(fold.ca, rand);
    // Center the kept part (what remains after the cuts) on the globule.
    const kept = nat.filter((_, i) => !fold.removed.has(i));
    const kc = mul(kept.reduce(add, [0, 0, 0]), 1 / kept.length);
    native = nat.map((p) => add(sub(p, kc), center));
  }

  // Camera views (rectangles facing the front).
  const span = (a, b, y0, y1) => ({ center: [(a + b) / 2, (y0 + y1) / 2, 0], size: [Math.max(b - a, (y1 - y0) * 0.75), y1 - y0] }); // prettier-ignore
  const xs = (j) => x[Math.max(0, Math.min(n - 1, j))];
  const startTo = midFrom > 0 ? midFrom - 1 : n - 1;
  const views = {
    txA: span(xs(0) - 1.6, Math.min(xs(startTo) + 0.8, xs(0) + 11), YR - 1.0, YD + 1.4),
    txB: midFrom > 0 ? span(xs(midFrom) - 0.8, xs(n - 1) + 1.6, YR - 1.0, YD + 1.4) : null,
    tlA: span(xs(0) - 1.4, Math.min(xs(startTo) + 2.2, xs(0) + 11.5), YM - 1.6, YM + 6.4),
    tlB: span(pAt(ffStartQ) - 2.6, xs(n - 1) + 1.8, YM - 1.6, center[1] + R + 0.8),
    fold: span(center[0] - 3.2, center[0] + 3.2, center[1] - 3.4, center[1] + 3.4),
  };
  return { n, x, x0, L, nCodons, hasStop, codonX, pAt, tokenCodons, tokenOf, midFrom, midTo, tl, chainPath, tunnelLen, laidLen, ball, native, center, R, xEnd, exitEnd, views, ffStartQ }; // prettier-ignore
}

// Where the RNA polymerase is (the drawn-base coordinate u, in bases) at a
// time in the transcription: slower over the drawn bases, quick over the
// plain middle.
function polymeraseU(lay, f) {
  const n = lay.n;
  const w = (j) => (j >= lay.midFrom && j <= lay.midTo && lay.midFrom >= 0 ? 0.3 : 1);
  // u runs from -2.2 (its place at rest) to n + 3.
  const steps = [];
  let total = 0;
  for (let j = -3; j < n + 3; j++) {
    const ww = w(j);
    steps.push([j, ww]);
    total += ww;
  }
  let target = f * total;
  for (const [j, ww] of steps) {
    if (target <= ww) return j + target / ww + 0.8;
    target -= ww;
  }
  return n + 3.8;
}

const dnaToProtein = {
  alive: true,
  turntable: false,
  options: [
    {
      key: "gene",
      label: "Gene",
      type: "select",
      default: "hbb",
      choices: [
        ...["hbb", "ins", "lyz", "gfp"].map((id) => ({ id, label: GENES[id].label })),
        { id: "custom", label: "Your own (below)" },
      ],
    },
    { key: "change", label: "Mutation", type: "select", default: "none", choices: CHANGE_CHOICES },
    { key: "codon", label: "At codon", type: "slider", min: 2, max: 7, step: 1, default: 7 },
    { key: "pos", label: "Base in the codon", type: "slider", min: 1, max: 3, step: 1, default: 2 },
    {
      key: "base",
      label: "New base",
      type: "select",
      default: "T",
      choices: ["A", "C", "G", "T"].map((b) => ({ id: b, label: b })),
    },
    { key: "sequence", label: "Your DNA", type: "text", default: "", hidden: true },
  ],
  input: DNA_INPUT,
  credits: [
    {
      label: "Genes",
      title: "NCBI RefSeq NM_000518.5 (HBB), NM_000207.3 (INS), NM_000239.3 (LYZ) and GenBank M62653.1 (GFP)", // prettier-ignore
      source: "https://www.ncbi.nlm.nih.gov/nuccore/",
      author: "the National Center for Biotechnology Information",
      license: "Public domain",
      licenseUrl: "https://www.ncbi.nlm.nih.gov/home/about/policies/",
    },
    {
      label: "Protein structures",
      title: "RCSB Protein Data Bank entries 4HHB, 1MSO, 1LZ1 and 1GFL (alpha carbons)",
      source: "https://www.rcsb.org/",
      author: "the wwPDB and the structures' authors",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
  ],
  controls: [{ key: "go", label: "Make the protein", type: "pulse", ease: T_ALL }],
  action: { key: "go", label: "Make the protein" },
  // The toy follows its story with the camera (lane Books' page focus): a
  // double-tap still resets the view as on other toys.
  focus: () => false,
  drive(time, c, out, info) {
    const D = info.data;
    if (!D?.lay) return;
    const lay = D.lay;
    const tl = lay.tl;
    const t = c.go > 0 ? (1 - c.go) * T_ALL : 0;
    const playing = c.go > 0 && t < T_ALL - 0.12;
    const ph = (r) => band(t, r[0], r[1]);
    const n = lay.n;
    const parts = out.parts;
    const levers = [new Array(96).fill(0), new Array(96).fill(0), new Array(96).fill(0)];
    out.levers = levers;
    const morph = [0, 0, 0, 0];
    out.morph = morph;
    const tokens = new Array(48).fill(null);
    out.tokens = tokens;

    // ---- Transcription ----
    const ftx = ph(tl.tx);
    const resetAt = ph(tl.reset);
    let u;
    if (t < tl.txOut[1] || !playing) u = polymeraseU(lay, playing ? ftx : 0);
    else u = lay.n + 12;
    if (playing && t >= tl.tx[1]) u = lay.n + 3.8 + 8 * ph(tl.txOut);
    const X = lay.x0 + u * S;
    // The bubble: the coding strand lifts and the template's bases turn
    // down to pair with the new RNA, from 2 bases ahead to 5 behind.
    if (playing && t < tl.txOut[1] + 0.2) {
      for (let j = 0; j < n; j++) {
        const d = (lay.x[j] - X) / S;
        const open = smoothstep(3.6, 2.2, d) * smoothstep(-6.6, -5.0, d);
        levers[0][j] = open;
        levers[1][j] = smoothstep(2.6, 1.0, d) * smoothstep(-6.2, -4.6, d);
      }
    }
    // The RNA appears a base behind the polymerase's middle; at the end it
    // is broken down from its 3′ end.
    const W = (n + 8) * S;
    let rnaFront = (X - S - lay.x0 + 4 * S) / W;
    if (!playing) rnaFront = 0;
    else if (t >= tl.txOut[0]) rnaFront = 1.2;
    if (playing && resetAt > 0) rnaFront = 1.2 * (1 - ease(resetAt / 0.7));
    morph[0] = rnaFront;
    // The polymerase: at rest at the left, through the gene, off to the
    // right, and a new one comes in from the left at the end.
    const homeU = polymeraseU(lay, 0);
    let polyX = X - (lay.x0 + homeU * S);
    let polyVis = 1;
    if (playing && t >= tl.txOut[1]) {
      polyVis = 0;
      if (resetAt > 0) {
        polyVis = 1;
        polyX = -9 * (1 - ease(band(resetAt, 0.2, 1)));
      }
    }
    parts.polymerase = { offset: [polyX, 0, 0], visible: polyVis };

    // ---- The mRNA moves down to be read ----
    const down = playing ? ease(ph(tl.down)) : 0;
    parts.rna = { offset: [0, -(YR - YM) * down, 0] };

    // ---- The ribosome ----
    // q: the codon in the P site (fractional while it moves).
    let q = -LEAD / 3 - 0.5; // at the 5′ end
    const sc = ph(tl.scan);
    q += (LEAD / 3 + 0.5) * ease(sc);
    let aSite = -1; // the codon whose tRNA is coming into the A site
    // made: amino acids in the chain; transferK, transferF: the chain moving
    // from the tRNA in the P site onto the one in the A site.
    let made = playing && t >= tl.scan[1] ? 1 : 0;
    let transferK = -1;
    let transferF = 0;
    for (const cy of tl.cycles) {
      if (!playing || t < cy.t0) break;
      const f = band(t, cy.t0, cy.t1);
      q = cy.k - 1 + ease(band(f, 0.62, 0.95));
      if (f < 1) aSite = cy.k;
      const tr = ease(band(f, 0.42, 0.6));
      made = tr >= 1 ? cy.k + 1 : cy.k;
      if (tr > 0 && tr < 1) [transferK, transferF] = [cy.k, tr];
    }
    const ff = tl.ff;
    if (playing && ff && t >= ff.t0) {
      const f = band(t, ff.t0, ff.t1);
      made = Math.max(made, ff.k0 + f * (ff.k1 - ff.k0 + 1));
      if (f < 1) q = ff.k0 - 1 + f * (ff.k1 - ff.k0 + 1);
    }
    if (playing && t >= tl.stop[0]) [q, made] = [lay.L - 1, lay.L];
    const xP = lay.pAt(q);
    // Subunits: waiting below at rest; the small one comes to the 5′ end
    // with the first tRNA, the large one joins at the start codon, and both
    // drift back after the release.
    const bindF = playing ? ease(ph(tl.bind)) : 0;
    const joinF = playing ? ease(ph(tl.join)) : 0;
    const partF = playing ? ease(ph(tl.part)) : 0;
    const here = [xP - D.xBuild, 0, 0];
    if (partF > 0) {
      parts.small = { offset: add(lerp(here, D.waitSmall, partF), [0, -0.6 * Math.sin(Math.PI * partF), 0]) }; // prettier-ignore
      parts.large = { offset: add(lerp(here, D.waitLarge, partF), [0, 0.8 * Math.sin(Math.PI * partF), 0]) }; // prettier-ignore
    } else {
      parts.small = { offset: lerp(D.waitSmall, here, bindF) };
      parts.large = { offset: lerp(D.waitLarge, here, joinF) };
    }
    const ribo = (p) => add(p, [xP, YM, 0]); // the ribosome's frame to the toy's

    // ---- tRNAs (tokens 0..9) ----
    // Each waits in the pool, comes in from above to the A site (the first
    // rides in on the small subunit), stays on its codon while the ribosome
    // moves on (P site, then E site), and leaves up and to the left.
    let resort = false;
    const tLeave = (k) => {
      const cy = tl.cycles.find((cc) => cc.k === k + 2);
      if (cy) return cy.t0;
      if (ff && k + 2 >= ff.k0 && k + 2 <= ff.k1) return ff.t0;
      return tl.part[0];
    };
    const reset = ph(tl.reset);
    lay.tokenCodons.forEach((k, i) => {
      const pool = D.pool[i];
      let off = pool;
      let vis = 1;
      if (playing) {
        const cy = tl.cycles.find((cc) => cc.k === k);
        if (k === 0) {
          // Rides on the small subunit to the 5′ end, then scans with it.
          const at5 = [lay.pAt(-LEAD / 3 - 0.5) - lay.codonX[0], 0, 0];
          off = lerp(pool, at5, bindF);
          if (sc > 0) off = [xP - lay.codonX[0], 0, 0];
        } else if (cy && t >= cy.t0) {
          const f = band(t, cy.t0, cy.t0 + 0.4 * (cy.t1 - cy.t0));
          const above = [1.4, 3.4, 0.9];
          off = f < 0.5 ? lerp(pool, above, ease(f * 2)) : lerp(above, [0, 0, 0], ease(f * 2 - 1));
          if (f >= 1) off = [0, 0, 0];
          if (f > 0.9 && f < 1) resort = true;
        }
        const tl0 = tLeave(k);
        if (t >= tl0) {
          const f = band(t, tl0, tl0 + 0.7);
          off = lerp([0, 0, 0], [-3.2, 7, 0.6], ease(f));
          if (f >= 1) vis = 0;
        }
        if (reset > 0) {
          // Back to the pool, charged again.
          off = lerp(add(pool, [7, 5, 0]), pool, ease(band(reset, 0.1, 0.9)));
          vis = 1;
        }
      }
      tokens[i] = { offset: off, visible: vis };
    });

    // ---- The chain ----
    // An amino acid's place: hanging from the tRNA that holds the chain,
    // up the exit tunnel, then out into the globule over the exit.
    const released = playing ? ph(tl.release) : 0;
    const extra = released * (lay.laidLen + 2);
    const ballOff = [xP - lay.xEnd, 0, 0];
    const anchor = (h) =>
      lay.codonX[h] !== undefined && lay.tokenOf.has(h) ? [lay.codonX[h], YM + AA_Y, 0] : ribo([0, AA_Y, 0]); // prettier-ignore
    const chainAt = (r, mk, anc) => {
      const arc = (mk - 1 - r + extra) * BEAD;
      if (arc >= lay.tunnelLen) {
        const f = ease((arc - lay.tunnelLen) / (2 * BEAD));
        return lerp(ribo(EXIT), add(lay.ball[r], ballOff), f);
      }
      const P = [anc, ribo(TUNNEL[0]), ribo(TUNNEL[1])];
      let a = arc;
      for (let i = 1; i < P.length; i++) {
        const seg = len(sub(P[i], P[i - 1]));
        if (a <= seg) return lerp(P[i - 1], P[i], a / seg);
        a -= seg;
      }
      return P[2];
    };
    const laid = playing ? Math.max(0, made + extra - 1 - lay.laidLen) : 0;
    const foldF = playing ? ph(tl.fold) : 0;
    const swapped = foldF > 0;
    morph[1] = (laid + 0.0001) / lay.L;
    lay.tokenCodons.forEach((r, i) => {
      // Codon r makes amino acid r.
      const ride = tokens[i];
      let off = ride.offset;
      let vis = ride.visible;
      const joined = playing && t >= tl.scan[1] && (r < made || r === transferK) && !(reset > 0);
      if (joined) {
        let p;
        if (transferK >= 0 && r <= transferK) {
          const before = r === transferK ? anchor(r) : chainAt(r, transferK, anchor(transferK - 1));
          p = lerp(before, chainAt(r, transferK + 1, anchor(transferK)), transferF);
        } else p = chainAt(r, made, anchor(Math.ceil(made) - 1));
        off = sub(p, D.aBuild[i]);
        vis = r < laid - 0.5 || swapped ? 0 : 1;
      }
      tokens[10 + i] = { offset: off, visible: vis };
    });

    // The globule's copy rides with the ribosome and fades in bead by bead;
    // at the fold it gives way to the folding copy.
    parts.ball = { offset: ballOff, visible: playing && laid > 0 && !swapped ? 1 : 0 };
    // While the codons not drawn go by: a plain chain in the tunnel and a
    // tether from the exit to the newest bead in the globule.
    const ffOn = playing && ff && t >= ff.t0 && released < 1 && laid > 0.5;
    parts.tunnel = { offset: ballOff, visible: ffOn ? 1 : 0 };
    const newest = Math.max(0, Math.min(lay.L - 1, Math.floor(laid - 0.5)));
    tokens[20] = { offset: ballOff, visible: ffOn ? 1 : 0 };
    tokens[21] = { offset: sub(add(lay.ball[newest], ballOff), D.tetherTip), visible: ffOn ? 1 : 0 }; // prettier-ignore
    if (resort) out.resort = true;

    // ---- The release factor ----
    {
      const f = ph(tl.stop);
      const bound = [lay.xEnd + CODON - D.rfBuild, 0, 0];
      let off = add(bound, [2.2, 4, 0.8]);
      let vis = 0;
      if (playing && t >= tl.stop[0] && t < tl.part[1]) {
        vis = 1;
        off = lerp(add(bound, [2.2, 4, 0.8]), bound, ease(f));
        const g = ph(tl.part);
        if (g > 0) off = lerp(bound, add(bound, [2.5, 4.5, 0.6]), ease(g));
      }
      parts.rf = { offset: off, visible: vis };
    }

    // ---- The fold ----
    // The copy swaps in where the globule is, then every amino acid moves to
    // its place in the structure; pieces the cell cuts away drift off.
    morph[2] = swapped ? ease(band(foldF, 0.08, 0.9)) : 0;
    const cutAway = ease(band(foldF, 0.0, 0.35));
    const drift = playing && reset > 0 ? ease(band(reset, 0, 0.6)) : 0;
    parts.fold = { offset: add(ballOff, [0, 9 * drift * drift, 0]), visible: swapped && drift < 1 ? 1 : 0 }; // prettier-ignore
    parts.cut = { offset: add(ballOff, mul([-3.5, 1.8, 1.2], cutAway)), visible: swapped && cutAway < 1 ? 1 : 0 }; // prettier-ignore

    // ---- Camera ----
    const V = lay.views;
    let view = { key: "home" };
    if (playing && reset === 0) {
      if (t < tl.down[0])
        view = u > lay.midFrom - 3 && V.txB && lay.midFrom > 0 ? { key: "txB", ...V.txB } : { key: "txA", ...V.txA }; // prettier-ignore
      else if (!ff || t < ff.t0) view = { key: "tlA", ...V.tlA };
      else if (t < tl.fold[0] + 0.3) view = { key: "tlB", ...V.tlB };
      else view = { key: "fold", ...V.fold };
      if (t < 0.05) view = { key: "home" };
    }
    out.view = view;

    // Sound: a soft knock as each tRNA docks on its codon, a bell at the
    // stop codon and a low glass note as the protein settles.
    if (playing && out.cues) {
      const list = tl.cycles.map((cy) => [cy.t0 + 0.4 * (cy.t1 - cy.t0), { voice: "wood", f: 640 + 40 * (cy.k % 5), decay: 0.6, vol: 0.35 }]); // prettier-ignore
      list.push([tl.stop[1], { voice: "ding", f: 988, decay: 1.4, vol: 0.3 }]);
      list.push([tl.fold[0] + 2.6, { voice: "glass", f: 523, decay: 2.2, vol: 0.3, bright: 0.3 }]);
      cuesBetween(c, t, list, out);
    } else LAST.set(c, -1);
  },
  build(k, o) {
    const story = buildStory({
      gene: o.gene,
      sequence: o.gene === "custom" ? o.sequence : "",
      change: o.change,
      codon: o.codon,
      pos: o.pos,
      base: o.base,
    });
    DNA_SHOWN.line = storyLine(story);
    const lay = dnaLayout(story, k.rand);
    const { n, x, L } = lay;
    const items = story.items;
    const jitter = 0.01;

    // ---- DNA: a flat ladder, coding strand on top ----
    const lift = k.lever({ dir: [0, 1, 0], move: 0.3, channel: 0 });
    const flip = k.lever({ pivot: [0, YD - 0.5, 0], axis: [1, 0, 0], angle: Math.PI, channel: 1 });
    const baseBox = evenBox(0.3, 0.4, 0.16);
    const backBox = evenBox(S + 0.01, 0.13, 0.13);
    for (let j = 0; j < n; j++) {
      const it = items[j];
      const b = it.base;
      const comp = b ? { A: "T", T: "A", G: "C", C: "G" }[b] : null;
      for (const [strand, y, lever, base] of [
        ["coding", YD, lift, b],
        ["template", YD, flip, comp],
      ]) {
        const up = strand === "coding" ? 1 : -1;
        const lp = k.leverParam(lever, j);
        const col = base ? BASE_COLORS[base] : PLAIN;
        k.add(baseBox, {
          pos: [x[j], y + up * 0.22, 0],
          even: true,
          weight: 2.2,
          jitter,
          flat: 0.3,
          pattern: false,
          kind: "lever",
          params: [lp, 0],
          color: (c) => lit(col, c.n),
        });
        k.add(backBox, {
          pos: [x[j], y + up * 0.5, 0],
          even: true,
          weight: 1.6,
          jitter,
          flat: 0.3,
          kind: "lever",
          params: [lp, 0],
          color: (c) => lit(strand === "coding" ? CODING : TEMPLATE, c.n),
        });
        if (base) {
          text(k, base, [x[j], y + up * 0.22, 0.085], 0.042, INK, { kind: "lever", params: [lp, 0] }); // prettier-ignore
        }
      }
    }
    // Strand ends.
    const xL = x[0] - 0.55;
    const xR = x[n - 1] + 0.55;
    const lab = (s, at) => text(k, s, at, 0.05, "#e9eef8", { weight: 8 });
    lab("5'", [xL, YD + 0.5, 0]);
    lab("3'", [xR, YD + 0.5, 0]);
    lab("3'", [xL, YD - 0.5, 0]);
    lab("5'", [xR, YD - 0.5, 0]);
    // Strand names, right-aligned before the ends.
    const name = (s, y) => lab(s, [xL - 0.45 - ((s.length * 6 - 1) * 0.05) / 2, y, 0]);
    name("CODING", YD + 0.5);
    name("TEMPLATE", YD - 0.5);
    if (lay.midFrom > 0) {
      const mc = story.middle.to - story.middle.from + 1;
      const xm = (x[lay.midFrom] + x[lay.midTo]) / 2;
      lab(`${mc} MORE CODONS`, [xm, YD + 1.0, 0]);
    }

    // ---- The mRNA, made under the template strand ----
    const rna = k.part("rna");
    const W = (n + 8) * S;
    for (let j = 0; j < n; j++) {
      const it = items[j];
      const b = it.base ? (it.base === "T" ? "U" : it.base) : null;
      const at = (x[j] - x[0] + 4 * S) / W;
      const fade = { kind: "fade", params: [at, -0.004], channel: 0, part: rna };
      const col = b ? BASE_COLORS[b] : PLAIN;
      k.add(baseBox, {
        pos: [x[j], YR + 0.28, 0],
        even: true,
        weight: 2.2,
        jitter,
        flat: 0.3,
        pattern: false,
        ...fade,
        color: (c) => lit(col, c.n),
      });
      k.add(backBox, {
        pos: [x[j], YR, 0],
        even: true,
        weight: 1.6,
        jitter,
        flat: 0.3,
        ...fade,
        color: (c) => lit(RNA_BACK, c.n),
      });
      if (b) text(k, b, [x[j], YR + 0.28, 0.085], 0.042, INK, fade);
      if (it.mut) {
        // A mark under the changed base (and over it on the DNA).
        k.add(k.cone(0.12, 0, 0.22), { pos: [x[j], YR - 0.3, 0], rot: [180, 0, 0], weight: 3, ...fade, color: "#ffffff" }); // prettier-ignore
        k.add(k.cone(0.12, 0, 0.22), { pos: [x[j], YD + 0.85, 0], rot: [180, 0, 0], weight: 3, color: "#ffffff" }); // prettier-ignore
      }
    }
    // The 5′ cap.
    const capAt = { kind: "fade", params: [(4 * S) / W, -0.004], channel: 0, part: rna };
    k.add(k.sphere(0.17), { pos: [x[0] - 0.35, YR, 0], even: true, weight: 3, ...capAt, color: (c) => lit("#f5f0e1", c.n) }); // prettier-ignore
    text(k, "5'", [x[0] - 0.85, YR, 0], 0.05, "#e9eef8", { weight: 8, ...capAt });
    text(k, "3'", [x[n - 1] + 0.55, YR, 0], 0.05, "#e9eef8", { weight: 8, kind: "fade", params: [1, -0.004], channel: 0, part: rna }); // prettier-ignore
    text(k, "MRNA", [x[0] - 2.25, YR, 0], 0.05, "#e9eef8", { weight: 8, ...capAt });

    // ---- RNA polymerase II: a glassy body over the bubble ----
    const homeX = x[0] + polymeraseU(lay, 0) * S;
    const poly = k.part("polymerase", { pivot: [homeX, YD - 0.3, 0] });
    k.add(evenEllipsoid(k, 1.35, 1.25, 0.9), {
      pos: [homeX - 0.25, YD - 0.35, 0],
      even: true,
      weight: 0.7,
      part: poly,
      flat: 0.05,
      opacity: 0.85,
      kind: "rim",
      params: [0.14, 2.6],
      pattern: false,
      jitter: 0,
      color: (c) => mix(POLY, "#ffffff", 0.25 * Math.max(0, c.n[1])),
    });
    text(k, "RNA POLYMERASE", [homeX - 0.25, YD + 1.25, 0], 0.045, POLY, { weight: 8, part: poly });

    // ---- Ribosome: small and large subunits, glassy, built at the start
    // codon; they wait apart below the mRNA at rest ----
    const xBuild = lay.codonX[0];
    const small = k.part("small", { pivot: [xBuild, YM, 0] });
    const large = k.part("large", { pivot: [xBuild, YM + 2.2, 0] });
    const glass = (part, at, r, col) =>
      k.add(evenEllipsoid(k, ...r), {
        pos: at,
        even: true,
        weight: 0.55,
        part,
        flat: 0.05,
        opacity: 0.85,
        kind: "rim",
        params: [0.12, 2.4],
        pattern: false,
        jitter: 0,
        color: (c) => mix(col, "#ffffff", 0.3 * Math.max(0, c.n[1])),
      });
    glass(small, [xBuild + 0.2, YM - 0.15, 0], [2.3, 0.75, 1.15], SMALL);
    glass(large, [xBuild + 0.3, YM + 2.4, 0], [2.45, 1.25, 1.25], LARGE);
    text(k, "SMALL SUBUNIT", [xBuild + 0.2, YM - 1.15, 0], 0.04, SMALL, { weight: 8, part: small });
    text(k, "LARGE SUBUNIT", [xBuild - 1.5, YM + 3.85, 0], 0.04, LARGE, { weight: 8, part: large });

    // ---- tRNAs (tokens 0..9) with their amino acids (tokens 10..19) ----
    const tBuild = [];
    const aBuild = [];
    const pool = [];
    lay.tokenCodons.forEach((cIdx, i) => {
      const codon = story.codons[cIdx];
      const anti = anticodon(codon); // 3′ to 5′ under the codon
      const cx = lay.codonX[cIdx];
      tBuild.push(cx);
      const tok = { kind: "token", params: [i, 0] };
      // Anticodon bases, pointing down to the codon.
      for (let p = 0; p < 3; p++) {
        const bx = cx + (p - 1) * S;
        k.add(baseBox, { pos: [bx, YM + 0.7, 0], even: true, weight: 2.2, jitter, flat: 0.3, pattern: false, ...tok, color: (c) => lit(BASE_COLORS[anti[p]], c.n) }); // prettier-ignore
        text(k, anti[p], [bx, YM + 0.7, 0.085], 0.042, INK, tok);
      }
      k.add(evenBox(CODON - 0.1, 0.12, 0.13), { pos: [cx, YM + 0.96, 0], even: true, weight: 1.6, jitter, ...tok, color: (c) => lit(TRNA, c.n) }); // prettier-ignore
      // The body: an anticodon arm, the folded middle and the acceptor stem.
      k.add(evenBox(0.22, 0.5, 0.16), { pos: [cx, YM + 1.25, 0], even: true, weight: 1.6, jitter, ...tok, color: (c) => lit(TRNA, c.n) }); // prettier-ignore
      k.add(evenEllipsoid(k, 0.52, 0.36, 0.16), { pos: [cx, YM + 1.75, 0], even: true, weight: 1.6, jitter, ...tok, color: (c) => lit(TRNA, c.n) }); // prettier-ignore
      k.add(evenBox(0.16, 0.36, 0.14), { pos: [cx, YM + 2.27, 0], even: true, weight: 1.6, jitter, ...tok, color: (c) => lit(TRNA, c.n) }); // prettier-ignore
      const aa = story.protein[cIdx];
      text(k, (AMINO[aa]?.[0] || "?").toUpperCase(), [cx, YM + 1.75, 0.18], 0.04, INK, tok);
      // The amino acid on top.
      const ap = [cx, YM + AA_Y, 0];
      aBuild.push(ap);
      k.add(k.sphere(0.15), { pos: ap, even: true, weight: 3, jitter, pattern: false, kind: "token", params: [10 + i, 0], color: (c) => lit(aminoColor(aa), c.n) }); // prettier-ignore
      // Its place in the pool (offset from its build place).
      const px = 1.2 + (i % 5) * 1.75 + (i >= 5 ? 0.85 : 0);
      const py = YM - 3.2 - (i >= 5 ? 1.2 : 0);
      pool.push([px - cx, py - YM, -0.3 - 0.2 * (i % 2)]);
    });
    // ---- The release factor (tRNA-shaped) ----
    const rfBuild = lay.codonX[L] ?? lay.xEnd + CODON;
    const rf = k.part("rf");
    k.add(evenBox(CODON - 0.1, 0.3, 0.16), { pos: [rfBuild, YM + 0.75, 0], even: true, weight: 1.6, part: rf, color: (c) => lit(RF, c.n) }); // prettier-ignore
    k.add(evenBox(0.26, 0.7, 0.16), { pos: [rfBuild, YM + 1.25, 0], even: true, weight: 1.6, part: rf, color: (c) => lit(RF, c.n) }); // prettier-ignore
    k.add(evenEllipsoid(k, 0.5, 0.45, 0.16), { pos: [rfBuild, YM + 1.95, 0], even: true, weight: 1.6, part: rf, color: (c) => lit(RF, c.n) }); // prettier-ignore
    text(k, "STOP", [rfBuild, YM + 1.95, 0.18], 0.04, INK, { part: rf });

    // ---- The chain: the globule's copy (fades in bead by bead), the
    // folding copy (morphs into the structure) and the cut pieces ----
    const ball = k.part("ball");
    const foldPart = k.part("fold");
    const cutPart = k.part("cut");
    const tunnel = k.part("tunnel");
    const beadN = 22;
    const P = lay.ball;
    const fold = story.fold;
    const nat = lay.native;
    const changed = new Set(fold?.changed || []);
    const colorOf = (r) => aminoColor(story.protein[r]);
    // A bead's splats: a small sphere.
    const sph = [];
    for (let i = 0; i < beadN; i++) {
      const z = 1 - (2 * (i + 0.5)) / beadN;
      const a = i * 2.399963;
      const rr = Math.sqrt(1 - z * z);
      sph.push([rr * Math.cos(a), z, rr * Math.sin(a)]);
    }
    const bondN = 6;
    // (The kit scales a cloud's count with the device's budget, so each
    // splat finds its bead from its share of the cloud.)
    const slot = (i, m) => {
      const f = ((i + 0.5) * L) / m;
      const r = Math.min(L - 1, Math.floor(f));
      return [r, Math.min(beadN + bondN - 1, Math.floor((f - r) * (beadN + bondN)))];
    };
    k.cloud({ count: L * (beadN + bondN), size: 1.1, pattern: false }, (rand, i, cnt) => {
      const [r, m] = slot(i, cnt);
      const at = (r + 0.5) / L;
      if (m < beadN) {
        const d = sph[m];
        return { p: add(P[r], mul(d, 0.13)), n: d, color: lit(colorOf(r), d), kind: "fade", params: [at, -0.004], channel: 1, part: ball }; // prettier-ignore
      }
      if (r === 0) return { p: P[0], color: "#e8e2d4", kind: "fade", params: [at, -0.004], channel: 1, part: ball, opacity: 0 }; // prettier-ignore
      const s = (m - beadN + 0.5) / bondN;
      return { p: lerp(P[r - 1], P[r], s), color: "#e8e2d4", kind: "fade", params: [at, -0.004], channel: 1, part: ball }; // prettier-ignore
    });
    k.cloud({ count: L * (beadN + bondN), size: 1.1, pattern: false }, (rand, i, cnt) => {
      const [r, m] = slot(i, cnt);
      const cut = fold?.removed.has(r);
      const part = cut ? cutPart : foldPart;
      const tgt = (rr) => (nat && !fold.removed.has(rr) ? nat[rr] : P[rr]);
      if (m < beadN) {
        const d = sph[m];
        const col = changed.has(r) ? "#ffffff" : colorOf(r);
        return { p: add(P[r], mul(d, 0.13)), n: d, color: lit(col, d), part, channel: 2, to: cut ? null : add(tgt(r), mul(d, 0.13)) }; // prettier-ignore
      }
      const s = (m - beadN + 0.5) / bondN;
      const prevCut = r > 0 && fold?.removed.has(r - 1);
      if (r === 0 || prevCut !== !!cut) return { p: P[r], color: "#e8e2d4", part, opacity: 0, channel: 2, to: null }; // prettier-ignore
      return { p: lerp(P[r - 1], P[r], s), color: "#e8e2d4", part, channel: 2, to: cut ? null : lerp(tgt(r - 1), tgt(r), s) }; // prettier-ignore
    });
    // The chain inside the tunnel (a plain line while codons go by quickly)
    // and the tether from the exit to the newest bead.
    const tA = add(TUNNEL[0], [lay.xEnd, YM, 0]);
    const tB = add(TUNNEL[1], [lay.xEnd, YM, 0]);
    k.cloud({ share: 0.003, size: 1.3, pattern: false }, (rand, i, m) => ({ p: lerp(tA, tB, (i + 0.5) / m), color: "#e8e2d4", part: tunnel })); // prettier-ignore
    const tetherTip = P[Math.min(L - 1, Math.ceil(lay.laidLen))];
    k.cloud({ share: 0.004, size: 1.3, pattern: false }, (rand, i, m) => {
      const s = (i + 0.5) / m;
      return { p: lerp(tB, tetherTip, s), color: "#e8e2d4", skin: [20, 21, s] };
    });

    // Draw at rest: the ribosome's waiting places and the tRNAs' pool.
    const waitSmall = [x[0] + 2.2 - xBuild, -3.4, -0.4];
    const waitLarge = [x[0] + 6.6 - xBuild, -3.9, -0.6];
    k.data = { lay, xBuild, waitSmall, waitLarge, tBuild, aBuild, pool, rfBuild, tetherTip };
  },
};

export const RECIPES = {
  "dna-to-protein": dnaToProtein,
};
