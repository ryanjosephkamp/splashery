// Real elements (lane Elements): where each element sits in the standard 18-column table, the same
// layout as the Periodic table toy (src/packs/chemistry.js), with the lanthanoids and actinoids in
// two rows below.

// [column 1..18, row, f-block]. Rows 1 to 7 are the periods; the f-block rows sit at 8.45 and
// 9.45 (the gap above them as usual). For an f-block element the period is given separately.
export function cellOf(z) {
  const starts = [1, 3, 11, 19, 37, 55, 87, 119];
  let period = 0;
  while (z >= starts[period + 1]) period++;
  const i = z - starts[period];
  const P = period + 1;
  if (P === 1) return [z === 1 ? 1 : 18, 1, false];
  if (P <= 3) return [i < 2 ? i + 1 : i + 11, P, false];
  if (P <= 5) return [i + 1, P, false];
  if (i < 2) return [i + 1, P, false];
  if (i < 17) return [i - 2 + 3, P, true];
  return [i - 17 + 4, P, false];
}

// The tile's place in the drawing: [column, row], the f-block rows below the main table.
export function placeOf(z) {
  const [col, period, f] = cellOf(z);
  return f ? [col, period + 2.45] : [col, period];
}

// The block (s, p, d or f) by the place in the table (helium is s-block).
export function blockOf(z) {
  const [col, , f] = cellOf(z);
  if (f) return "f";
  if (z === 2 || col <= 2) return "s";
  if (col >= 13) return "p";
  return "d";
}
