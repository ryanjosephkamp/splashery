// Lane Data and climate: a CSV and TSV reader for Data in 3D. It takes the
// text of a file the person opened (nothing is uploaded) and gives back a
// table of typed columns:
//
//   { name, columns: [{ name, type, values, ... }], rows, skipped, delimiter }
//
// type is "number", "date" (values in milliseconds since 1970, UTC), or
// "category" (values are indexes into `labels`). Missing cells are NaN. It
// handles a byte-order mark, comment lines at the top (NOAA's "#" notes),
// quoted fields with commas, doubled quotes and line breaks inside, CRLF,
// commas, tabs or semicolons, a missing header row, thousands separators,
// percents and the usual words for "missing".

export const MAX_COLUMNS = 64;
const MISSING = new Set(["", "na", "n/a", "nan", "null", "none", "-", "--", "?", "***", ".", "#n/a", "missing"]); // prettier-ignore

// Splits text into rows of fields. delimiter is "," "\t" or ";".
export function splitRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let wasQuoted = false;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const ch = text.charCodeAt(i);
    if (quoted) {
      if (ch === 34) {
        if (text.charCodeAt(i + 1) === 34) {
          field += '"';
          i++;
        } else quoted = false;
      } else field += text[i];
      continue;
    }
    if (ch === 34 && field.length === 0 && !wasQuoted) {
      quoted = true;
      wasQuoted = true;
    } else if (text[i] === delimiter) {
      row.push(wasQuoted ? field : field.trim());
      field = "";
      wasQuoted = false;
    } else if (ch === 10 || ch === 13) {
      if (ch === 13 && text.charCodeAt(i + 1) === 10) i++;
      row.push(wasQuoted ? field : field.trim());
      rows.push(row);
      row = [];
      field = "";
      wasQuoted = false;
    } else field += text[i];
  }
  if (field.length || row.length || wasQuoted) {
    row.push(wasQuoted ? field : field.trim());
    rows.push(row);
  }
  return rows;
}

// The delimiter most lines agree on: tab, semicolon or comma.
export function guessDelimiter(lines, fileName = "") {
  if (/\.tsv$|\.tab$/i.test(fileName)) return "\t";
  const count = (s, d) => {
    let c = 0;
    let q = false;
    for (const ch of s) {
      if (ch === '"') q = !q;
      else if (!q && ch === d) c++;
    }
    return c;
  };
  let best = ",";
  let bestScore = -1;
  for (const d of ["\t", ";", ","]) {
    const counts = lines.map((l) => count(l, d));
    const first = counts[0];
    if (!first) continue;
    const agree = counts.filter((c) => c === first).length;
    const score = agree * 100 + first;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

export const isMissing = (s) => MISSING.has(String(s).trim().toLowerCase());

// A number as people write it in a spreadsheet: "1,234.5", "12%", "$3.50",
// "−4" (a real minus sign), "1e-3". Returns NaN for anything else.
export function parseNumber(s) {
  let t = String(s).trim();
  if (!t) return NaN;
  t = t
    .replace(/−/g, "-")
    .replace(/^[$€£¥]/, "")
    .replace(/^\+/, "");
  if (t.endsWith("%")) t = t.slice(0, -1); // 12% charts as 12
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, "");
  if (!/^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return NaN;
  return Number(t);
}

// A date: ISO (2026-10-05, 2026-10-05T06:14:15Z, 2026-10), slashes (2026/10/05,
// 10/5/2026, read month first unless the first number is over 12) or a month
// name (Oct 2026, 5 Oct 2026, October 5, 2026). Returns ms since 1970 (UTC) or NaN.
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]; // prettier-ignore
export function parseDate(s) {
  const t = String(s).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/); // prettier-ignore
  if (m) {
    const [, y, mo, d = "1", h = "0", mi = "0", se = "0", frac = "", tz] = m;
    let ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se, Math.round(Number(frac || 0) * 1000));
    if (tz && tz !== "Z") {
      const sign = tz[0] === "-" ? -1 : 1;
      const hh = +tz.slice(1, 3);
      const mm = +tz.slice(-2);
      ms -= sign * (hh * 60 + mm) * 60000;
    }
    return +mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31 ? ms : NaN;
  }
  m = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (m) {
    let [a, b] = [+m[1], +m[2]];
    if (a > 12) [a, b] = [b, a];
    if (a > 12 || b > 31) return NaN;
    return Date.UTC(+m[3], a - 1, b);
  }
  m = t.match(/^(?:(\d{1,2})\s+)?([A-Za-z]{3,9})\.?\s+(?:(\d{1,2}),?\s+)?(\d{4})$/);
  if (m) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mo < 0) return NaN;
    return Date.UTC(+m[4], mo, +(m[1] || m[3] || 1));
  }
  return NaN;
}

// Reads a table. Throws an Error with a plain message when it can't.
export function readTable(text, fileName = "your file") {
  if (typeof text !== "string") throw new Error("That file isn't text.");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (/\u0000/.test(text.slice(0, 2000)))
    throw new Error(
      "That looks like a binary file. Open a CSV or TSV (saved from a spreadsheet as text).",
    );
  // Comment lines at the top ("# ..."), and blank lines, go.
  let start = 0;
  for (;;) {
    const end = text.indexOf("\n", start);
    const line = text.slice(start, end < 0 ? text.length : end);
    if (line.trim() === "" || /^\s*#/.test(line)) {
      if (end < 0) {
        start = text.length;
        break;
      }
      start = end + 1;
    } else break;
  }
  const body = text.slice(start);
  const head = body.split(/\r?\n/, 12).filter((l) => l.trim());
  if (!head.length) throw new Error("That file has no rows.");
  const delimiter = guessDelimiter(head, fileName);
  let rows = splitRows(body, delimiter).filter((r) => r.some((x) => x !== ""));
  // Lines starting with "#" further down are notes too.
  rows = rows.filter((r) => !(r.length === 1 && /^#/.test(r[0])));
  if (!rows.length) throw new Error("That file has no rows.");
  const width = Math.min(MAX_COLUMNS, Math.max(...rows.slice(0, 50).map((r) => r.length)));
  if (width < 2 && rows.length < 2) throw new Error("That file has only one cell.");
  // A title line above the table (GISTEMP's "Land-Ocean: Global Means") is
  // a row much narrower than the rest.
  let title = "";
  while (rows.length > 2 && width > 2 && rows[0].length <= width / 3) {
    title ||= rows[0].filter(Boolean).join(" ");
    rows = rows.slice(1);
  }
  // A header row has a cell that isn't a number or a date where the rows
  // below have numbers, or simply no numbers at all.
  const first = rows[0];
  const second = rows[1] || [];
  const numericish = (s) => !isMissing(s) && (!Number.isNaN(parseNumber(s)) || !Number.isNaN(parseDate(s))); // prettier-ignore
  const firstNum = first.filter(numericish).length;
  const secondNum = second.filter(numericish).length;
  const header = rows.length > 1 && (firstNum === 0 || firstNum < secondNum);
  const names = [];
  for (let c = 0; c < width; c++) {
    let nm = header ? String(first[c] ?? "").trim() : "";
    if (!nm) nm = `Column ${c + 1}`;
    let k = 2;
    const base = nm;
    while (names.includes(nm)) nm = `${base} (${k++})`;
    names.push(nm);
  }
  const data = header ? rows.slice(1) : rows;
  if (!data.length) throw new Error("That file has a header but no rows under it.");
  const columns = names.map((name, c) => typeColumn(name, data, c));
  const usable = columns.filter((c) => c.type !== "text");
  if (!usable.length)
    throw new Error("No column of numbers, dates or categories was found in that file.");
  return {
    name: fileName,
    title,
    columns,
    rows: data.length,
    delimiter,
    header,
    ragged: data.filter((r) => r.length !== width).length,
  };
}

// Decides a column's type from its cells and fills its values.
function typeColumn(name, data, c) {
  const n = data.length;
  let present = 0;
  let nums = 0;
  let dates = 0;
  const step = Math.max(1, Math.floor(n / 4000));
  for (let i = 0; i < n; i += step) {
    const s = data[i][c];
    if (s === undefined || isMissing(s)) continue;
    present++;
    if (!Number.isNaN(parseNumber(s))) nums++;
    else if (!Number.isNaN(parseDate(s))) dates++;
  }
  const values = new Float64Array(n);
  let missing = 0;
  if (present && nums >= 0.9 * present) {
    // A column of four-digit years stays a number (a year axis reads the same).
    for (let i = 0; i < n; i++) {
      const s = data[i][c];
      const v = s === undefined || isMissing(s) ? NaN : parseNumber(s);
      if (Number.isNaN(v)) missing++;
      values[i] = v;
    }
    return finish({ name, type: "number", values, missing });
  }
  if (present && dates + nums >= 0.9 * present && dates > 0) {
    for (let i = 0; i < n; i++) {
      const s = data[i][c];
      const v = s === undefined || isMissing(s) ? NaN : parseDate(s);
      if (Number.isNaN(v)) missing++;
      values[i] = v;
    }
    return finish({ name, type: "date", values, missing });
  }
  // Categories: in order of first appearance; too many distinct words is text.
  const index = new Map();
  const labels = [];
  for (let i = 0; i < n; i++) {
    const s = data[i][c];
    if (s === undefined || isMissing(s)) {
      values[i] = NaN;
      missing++;
      continue;
    }
    let k = index.get(s);
    if (k === undefined) {
      k = labels.length;
      index.set(s, k);
      labels.push(s);
    }
    values[i] = k;
  }
  const type = present && labels.length <= Math.max(2, Math.min(60, present * 0.5)) ? "category" : "text"; // prettier-ignore
  return finish({ name, type, values, missing, labels });
}

function finish(col) {
  let min = Infinity;
  let max = -Infinity;
  const v = col.values;
  for (let i = 0; i < v.length; i++) {
    const x = v[i];
    if (x < min) min = x;
    if (x > max) max = x;
  }
  col.min = min;
  col.max = max;
  if (col.type === "number") {
    // Whole numbers with few distinct values (years, months, ratings) can be
    // bars of their own.
    const set = new Set();
    let whole = true;
    for (let i = 0; i < v.length && set.size <= 120; i++) {
      if (Number.isNaN(v[i])) continue;
      if (!Number.isInteger(v[i])) whole = false;
      set.add(v[i]);
    }
    col.distinct = set.size <= 120 ? set.size : Infinity;
    col.whole = whole;
  }
  return col;
}

// Plain words for what a column holds, for the panel.
export function describeColumn(col) {
  const miss = col.missing ? `, ${col.missing.toLocaleString("en-US")} missing` : "";
  if (col.type === "number") return `numbers${miss}`;
  if (col.type === "date") return `dates${miss}`;
  if (col.type === "category") return `${col.labels.length} categories${miss}`;
  return "text (not charted)";
}
