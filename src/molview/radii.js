// Lane Molecule viewer: per-element sizes and colors for the molecule viewer.
//
// van der Waals radii in ångströms: Bondi (J. Phys. Chem. 68, 441–451, 1964),
// with hydrogen at Bondi's 1.20, and Mantina et al. (J. Phys. Chem. A 113,
// 5806–5812, 2009) for the main-group elements Bondi left out. Elements with
// neither (most transition metals) take DEFAULT_VDW, and the viewer says so.
// Colors are the familiar CPK (Jmol) colors from src/chem/elements.js;
// covalent radii (for bonds by distance) come from there too.

import { element, normalSymbol } from "../chem/elements.js";

// prettier-ignore
export const VDW = {
  // Bondi 1964
  H: 1.2, He: 1.4, C: 1.7, N: 1.55, O: 1.52, F: 1.47, Ne: 1.54, Si: 2.1, P: 1.8, S: 1.8,
  Cl: 1.75, Ar: 1.88, As: 1.85, Se: 1.9, Br: 1.85, Kr: 2.02, Te: 2.06, I: 1.98, Xe: 2.16,
  Li: 1.82, Na: 2.27, Mg: 1.73, K: 2.75, Ni: 1.63, Cu: 1.4, Zn: 1.39, Ga: 1.87, Pd: 1.63,
  Ag: 1.72, Cd: 1.58, In: 1.93, Sn: 2.17, Pt: 1.72, Au: 1.66, Hg: 1.55, Tl: 1.96, Pb: 2.02,
  U: 1.86,
  // Mantina et al. 2009
  Be: 1.53, B: 1.92, Al: 1.84, Ca: 2.31, Ge: 2.11, Rb: 3.03, Sr: 2.49, Sb: 2.06, Cs: 3.43,
  Ba: 2.68, Bi: 2.07,
};
export const DEFAULT_VDW = 2.0;

export const vdwRadius = (el) => VDW[el] ?? DEFAULT_VDW;
export const hasVdw = (el) => VDW[el] !== undefined;

// Covalent radius (Cordero et al. 2008) with a middling guess for unknowns.
export const covalent = (el) => element(el)?.radius ?? 1.5;

// The CPK color of an element as [r, g, b] in 0..1, a little softened for
// the dark stage (carbon a mid gray, so it reads against both themes).
const SOFT = { C: "#8d9297", H: "#eef1f4", O: "#e8403a", N: "#3f6ff0", S: "#f2d23c" };
const cache = new Map();
export function cpk(el) {
  let c = cache.get(el);
  if (!c) {
    const hex = SOFT[el] ?? element(el)?.color ?? "#ff66cc";
    c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    cache.set(el, c);
  }
  return c;
}

export { element, normalSymbol };
