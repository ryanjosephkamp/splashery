// Per-element data for the chemistry toys: symbol, name, atomic number,
// covalent radius, typical valences, valence electrons and a display colour.
//
// Covalent radii are single-bond radii in ångströms (Cordero et al. 2008,
// low-spin values for Mn, Fe and Co). Valences list the usual bond counts,
// most common first. Valence electrons (`ve`) are only given for main-group
// elements; the 3D embedder uses them to count lone pairs. Colours are the
// familiar Jmol "CPK" colours.

// prettier-ignore
const TABLE = [
  // symbol, name, Z, radius, valences, valence electrons, colour
  ["H", "hydrogen", 1, 0.31, [1], 1, "#ffffff"],
  ["He", "helium", 2, 0.28, [0], 2, "#d9ffff"],
  ["Li", "lithium", 3, 1.28, [1], 1, "#cc80ff"],
  ["Be", "beryllium", 4, 0.96, [2], 2, "#c2ff00"],
  ["B", "boron", 5, 0.84, [3], 3, "#ffb5b5"],
  ["C", "carbon", 6, 0.76, [4], 4, "#909090"],
  ["N", "nitrogen", 7, 0.71, [3, 5], 5, "#3050f8"],
  ["O", "oxygen", 8, 0.66, [2], 6, "#ff0d0d"],
  ["F", "fluorine", 9, 0.57, [1], 7, "#90e050"],
  ["Ne", "neon", 10, 0.58, [0], 8, "#b3e3f5"],
  ["Na", "sodium", 11, 1.66, [1], 1, "#ab5cf2"],
  ["Mg", "magnesium", 12, 1.41, [2], 2, "#8aff00"],
  ["Al", "aluminium", 13, 1.21, [3], 3, "#bfa6a6"],
  ["Si", "silicon", 14, 1.11, [4], 4, "#f0c8a0"],
  ["P", "phosphorus", 15, 1.07, [3, 5], 5, "#ff8000"],
  ["S", "sulfur", 16, 1.05, [2, 4, 6], 6, "#ffff30"],
  ["Cl", "chlorine", 17, 1.02, [1, 3, 5, 7], 7, "#1ff01f"],
  ["Ar", "argon", 18, 1.06, [0], 8, "#80d1e3"],
  ["K", "potassium", 19, 2.03, [1], 1, "#8f40d4"],
  ["Ca", "calcium", 20, 1.76, [2], 2, "#3dff00"],
  ["Sc", "scandium", 21, 1.7, [3], null, "#e6e6e6"],
  ["Ti", "titanium", 22, 1.6, [4, 3], null, "#bfc2c7"],
  ["V", "vanadium", 23, 1.53, [5, 4, 3], null, "#a6a6ab"],
  ["Cr", "chromium", 24, 1.39, [3, 6, 2], null, "#8a99c7"],
  ["Mn", "manganese", 25, 1.39, [2, 4, 7], null, "#9c7ac7"],
  ["Fe", "iron", 26, 1.32, [2, 3], null, "#e06633"],
  ["Co", "cobalt", 27, 1.26, [2, 3], null, "#f090a0"],
  ["Ni", "nickel", 28, 1.24, [2], null, "#50d050"],
  ["Cu", "copper", 29, 1.32, [2, 1], null, "#c88033"],
  ["Zn", "zinc", 30, 1.22, [2], null, "#7d80b0"],
  ["Ga", "gallium", 31, 1.22, [3], 3, "#c28f8f"],
  ["Ge", "germanium", 32, 1.2, [4], 4, "#668f8f"],
  ["As", "arsenic", 33, 1.19, [3, 5], 5, "#bd80e3"],
  ["Se", "selenium", 34, 1.2, [2, 4, 6], 6, "#ffa100"],
  ["Br", "bromine", 35, 1.2, [1, 3, 5], 7, "#a62929"],
  ["Kr", "krypton", 36, 1.16, [0, 2], 8, "#5cb8d1"],
  ["Rb", "rubidium", 37, 2.2, [1], 1, "#702eb0"],
  ["Sr", "strontium", 38, 1.95, [2], 2, "#00ff00"],
  ["Y", "yttrium", 39, 1.9, [3], null, "#94ffff"],
  ["Zr", "zirconium", 40, 1.75, [4], null, "#94e0e0"],
  ["Nb", "niobium", 41, 1.64, [5], null, "#73c2c9"],
  ["Mo", "molybdenum", 42, 1.54, [6, 4], null, "#54b5b5"],
  ["Ru", "ruthenium", 44, 1.46, [3, 4], null, "#248f8f"],
  ["Rh", "rhodium", 45, 1.42, [3], null, "#0a7d8c"],
  ["Pd", "palladium", 46, 1.39, [2, 4], null, "#006985"],
  ["Ag", "silver", 47, 1.45, [1], null, "#c0c0c0"],
  ["Cd", "cadmium", 48, 1.44, [2], null, "#ffd98f"],
  ["In", "indium", 49, 1.42, [3], 3, "#a67573"],
  ["Sn", "tin", 50, 1.39, [4, 2], 4, "#668080"],
  ["Sb", "antimony", 51, 1.39, [3, 5], 5, "#9e63b5"],
  ["Te", "tellurium", 52, 1.38, [2, 4, 6], 6, "#d47a00"],
  ["I", "iodine", 53, 1.39, [1, 3, 5, 7], 7, "#940094"],
  ["Xe", "xenon", 54, 1.4, [0, 2, 4, 6], 8, "#429eb0"],
  ["Cs", "caesium", 55, 2.44, [1], 1, "#57178f"],
  ["Ba", "barium", 56, 2.15, [2], 2, "#00c900"],
  ["La", "lanthanum", 57, 2.07, [3], null, "#70d4ff"],
  ["Ce", "cerium", 58, 2.04, [3, 4], null, "#ffffc7"],
  ["Gd", "gadolinium", 64, 1.96, [3], null, "#45ffc7"],
  ["W", "tungsten", 74, 1.62, [6, 4], null, "#2194d6"],
  ["Re", "rhenium", 75, 1.51, [7, 4], null, "#267dab"],
  ["Os", "osmium", 76, 1.44, [4, 8], null, "#266696"],
  ["Ir", "iridium", 77, 1.41, [3, 4], null, "#175487"],
  ["Pt", "platinum", 78, 1.36, [2, 4], null, "#d0d0e0"],
  ["Au", "gold", 79, 1.36, [1, 3], null, "#ffd123"],
  ["Hg", "mercury", 80, 1.32, [2, 1], null, "#b8b8d0"],
  ["Tl", "thallium", 81, 1.45, [1, 3], 3, "#a6544d"],
  ["Pb", "lead", 82, 1.46, [2, 4], 4, "#575961"],
  ["Bi", "bismuth", 83, 1.48, [3, 5], 5, "#9e4fb5"],
  ["U", "uranium", 92, 1.96, [6, 4], null, "#008fff"],
];

// Every element keyed by its proper symbol ("Cl", not "CL").
export const ELEMENTS = Object.freeze(
  Object.fromEntries(
    TABLE.map(([symbol, name, z, radius, valences, ve, color]) => [
      symbol,
      Object.freeze({ symbol, name, z, radius, valences: Object.freeze(valences), ve, color }),
    ]),
  ),
);

const BY_NUMBER = new Map(Object.values(ELEMENTS).map((e) => [e.z, e]));

// "cl", "CL" and "Cl" all become "Cl". Returns "" for anything that is not
// shaped like a symbol.
export const normalSymbol = (text) => {
  const s = String(text ?? "").trim();
  if (!/^[A-Za-z]{1,2}$/.test(s)) return "";
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
};

// Looks up an element by symbol in any letter case, or by atomic number.
// Returns undefined for unknown elements.
export const element = (symbolOrNumber) =>
  typeof symbolOrNumber === "number"
    ? BY_NUMBER.get(symbolOrNumber)
    : ELEMENTS[normalSymbol(symbolOrNumber)];

// Covalent radius in ångströms, with a middling guess for unknown elements.
export const covalentRadius = (symbol) => element(symbol)?.radius ?? 1.5;

// Counts atoms by element: { C: 2, H: 6, O: 1 }. Takes atoms ({ el }) or
// plain symbols.
export function elementCounts(atoms) {
  const counts = {};
  for (const a of atoms) {
    const el = typeof a === "string" ? a : a.el;
    counts[el] = (counts[el] ?? 0) + 1;
  }
  return counts;
}

// Hill-order formula text, e.g. "C8H10N4O2": carbon first, then hydrogen,
// then the rest alphabetically (alphabetical throughout when there is no carbon).
export function formulaOf(atoms) {
  const counts = elementCounts(atoms);
  const keys = Object.keys(counts).sort();
  const order = counts.C
    ? ["C", ...(counts.H ? ["H"] : []), ...keys.filter((k) => k !== "C" && k !== "H")]
    : keys;
  return order.map((k) => k + (counts[k] > 1 ? counts[k] : "")).join("");
}

// Reads a formula such as "C6H12O6", "H₂O" or "OH2" into element counts.
// Returns null when the text is not a formula of known elements.
export function parseFormula(text) {
  const s = String(text ?? "")
    .trim()
    .replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));
  if (!/^([A-Z][a-z]?\d*)+$/.test(s)) return null;
  const counts = {};
  for (const [, sym, n] of s.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    if (!ELEMENTS[sym]) return null;
    counts[sym] = (counts[sym] ?? 0) + (n ? Number(n) : 1);
  }
  return counts;
}
