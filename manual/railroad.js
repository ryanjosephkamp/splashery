// The grammar of a splat program as data, drawn as a railroad diagram, and walked at random to make
// programs. The same data draws the tracks and makes the traces, and tests/man4.spec.mjs checks it
// against the grammar text in the manual and, for thousands of traces, against the real reader in
// src/packs/splat-equation.js.
//
// A rule is built from: t("text") a word typed as written (a round box), nt("rule") another rule
// (a square box), seq(...) one after another, or(...) one of, opt(x) optional, rep(x) any number of
// times (including none), words([...]) one of a long list, and note("text") a small remark.

let nextId = 0;
const id = () => `rr${nextId++}`;
export const t = (text) => ({ k: "t", text, id: id() });
export const nt = (rule) => ({ k: "nt", rule, id: id() });
export const seq = (...items) => ({ k: "seq", items, id: id() });
export const or = (...items) => ({
  k: "or",
  items: items.map((it) => ({ ...wrap(it) })),
  id: id(),
});
export const opt = (item) => ({ k: "opt", item, id: id(), skip: id(), take: id() });
export const rep = (item, p = 0.45) => ({ k: "rep", item, p, id: id(), skip: id(), loop: id() });
export const words = (list) => ({ k: "words", list, ids: list.map(() => id()), id: id() });
export const note = (text) => ({ k: "note", text, id: id() });
// A branch of an "or" gets its own id, so the walker can light up the rails it took.
const wrap = (it) => (it.branch ? it : { ...it, branch: id() });

// The names a program's expressions may use as functions of one input, and the two that take more.
export const ONE_INPUT = [
  "sin", "cos", "tan", "asin", "acos", "atan", "arcsin", "arccos", "arctan", "sinh", "cosh",
  "tanh", "exp", "log", "ln", "log10", "sqrt", "abs", "floor",
]; // prettier-ignore
export const FIELD_NAMES = [
  "x",
  "y",
  "z",
  "u",
  "v",
  "hue",
  "r",
  "g",
  "b",
  "size",
  "count",
  "spread",
];

// ---- The rules (the manual's grammar, "The grammar") ---------------------------------------------
export const RULES = {
  program: seq(
    nt("field"),
    t("="),
    nt("value"),
    rep(seq(or(t(";"), t("new line")), nt("field"), t("="), nt("value"))),
  ),
  field: words(FIELD_NAMES),
  value: or(
    seq(nt("sum"), note("x, y, z, hue, r, g, b, size")),
    seq(nt("sum"), t(".."), nt("sum"), note("u, v: numbers only")),
    seq(nt("sum"), note("count: a number only")),
    seq(words(["grid", "random"]), note("spread")),
  ),
  sum: seq(nt("product"), rep(seq(or(t("+"), t("-")), nt("product")))),
  product: seq(nt("signed"), rep(or(seq(or(t("*"), t("/")), nt("signed")), nt("power")))),
  signed: seq(rep(or(t("-"), t("+")), 0.1), nt("power")),
  power: seq(nt("atom"), opt(seq(t("^"), nt("signed")))),
  atom: or(
    t("number"),
    words(["u", "v", "t", "pi", "e"]),
    seq(nt("function"), t("("), nt("sum"), t(")")),
    seq(nt("function"), nt("bare")),
    seq(or(t("min"), t("max")), t("("), nt("sum"), t(","), nt("sum"), rep(seq(t(","), nt("sum"))), t(")")), // prettier-ignore
    nt("bracket"),
    seq(t("|"), nt("sum"), t("|"), note("not directly inside another | |")),
  ),
  bracket: or(
    seq(t("("), nt("sum"), t(")")),
    seq(t("["), nt("sum"), t("]")),
    seq(t("{"), nt("sum"), t("}")),
  ),
  bare: seq(nt("simple"), rep(nt("simple"), 0.25)),
  simple: seq(or(t("number"), words(["u", "v", "t", "pi", "e"])), opt(seq(t("^"), nt("signed")))),
  function: words(ONE_INPUT),
};
export const RULE_ORDER = ["program", "field", "value", "sum", "product", "signed", "power", "atom", "bracket", "bare", "simple", "function"]; // prettier-ignore

// ---- Walking the tracks ------------------------------------------------------------------------
// A walk follows the rules from the left, taking any branch, and writes what it passes. `numeric`
// limits the atoms to numbers, pi and e (a range end or a count). `inAbs` stops a | | pair from
// sitting directly inside another (a bracket in between is fine). `depth` keeps a walk short.
const NUMBERS = ["1", "2", "3", "0.5", "1.5", "0.25", "10", "4"];

export function walk(
  rule,
  rng,
  { numeric = false, maxNest = 2, maxTokens = 12, field = null } = {},
) {
  const visited = new Set();
  const out = [];
  const pick = (n) => Math.min(n - 1, Math.floor(rng() * n));
  const isAbs = (n) => n.k === "seq" && n.items[0]?.k === "t" && n.items[0].text === "|";
  // Does a branch open another sum (a bracket, an abs, a function's brackets) or a bracket rule?
  const opensSum = (node) => {
    switch (node.k) {
      case "nt":
        return node.rule === "sum" || node.rule === "bracket";
      case "seq":
        return node.items.some(opensSum);
      case "or":
        return node.items.every(opensSum);
      default:
        return false;
    }
  };
  const isMinMax = (n) => n.k === "seq" && n.items[0]?.k === "or" && n.items[0].items[0]?.text === "min"; // prettier-ignore
  function go(node, ctx) {
    visited.add(node.id);
    switch (node.k) {
      case "t":
        out.push(node.text === "number" ? NUMBERS[pick(NUMBERS.length)] : node.text === "new line" ? "\n" : node.text); // prettier-ignore
        return;
      case "words": {
        // In a numbers-only place the names u, v, and t are not allowed; pi and e are.
        const list = ctx.numeric && node.list.includes("pi") ? ["pi", "e"] : node.list;
        const word = list[pick(list.length)];
        visited.add(node.ids[node.list.indexOf(word)]);
        out.push(word);
        return;
      }
      case "note":
        visited.delete(node.id);
        return;
      case "nt": {
        const r = RULES[node.rule];
        if (node.rule === "field" && field) {
          visited.add(r.id);
          visited.add(r.ids[r.list.indexOf(field)]);
          out.push(field);
          return;
        }
        if (node.rule === "value") return value(r, ctx);
        const next = { ...ctx, rule: node.rule };
        // Each sum opened inside an atom, a bracket, or an abs is one level deeper.
        if (node.rule === "sum" && ctx.rule !== "value") next.level = ctx.level + 1;
        // A bracket starts afresh: a | | pair may sit inside it even inside another | |.
        if (node.rule === "bracket") next.inAbs = false;
        return go(r, next);
      }
      case "seq":
        if (isAbs(node)) {
          visited.add(node.items[0].id);
          out.push("|");
          go(node.items[1], { ...ctx, inAbs: true });
          visited.add(node.items[2].id);
          out.push("|");
          return;
        }
        for (const it of node.items) go(it, ctx);
        return;
      case "or": {
        // Branches the place allows: inside a | | there is no second | | directly, a range end
        // takes no min or max (their comma would split the range), and past the nesting limit a
        // branch must not open another sum.
        let options = node.items.map((it, i) => i);
        options = options.filter((i) => !(ctx.inAbs && isAbs(node.items[i])));
        options = options.filter((i) => !(ctx.range && isMinMax(node.items[i])));
        const calm = options.filter((i) => ctx.level < maxNest || !opensSum(node.items[i]));
        if (calm.length) options = calm;
        const i = options[pick(options.length)];
        visited.add(node.items[i].branch);
        go(node.items[i], ctx);
        return;
      }
      case "opt": {
        const take = out.length < maxTokens && rng() < 0.35;
        visited.add(take ? node.take : node.skip);
        if (take) go(node.item, ctx);
        return;
      }
      case "rep": {
        const more = out.length < maxTokens && rng() < node.p ? 1 + pick(2) : 0; // none, one, or two more
        visited.add(more ? node.loop : node.skip);
        for (let n = 0; n < more; n++) go(node.item, ctx);
        return;
      }
    }
  }
  // A value takes the branch that fits its field (the note beside each branch in the grammar).
  function value(node, ctx) {
    const f = field || out.find((w) => FIELD_NAMES.includes(w)) || "x";
    const idx = f === "u" || f === "v" ? 1 : f === "count" ? 2 : f === "spread" ? 3 : 0;
    visited.add(node.id);
    visited.add(node.items[idx].branch);
    go(node.items[idx], {
      ...ctx,
      rule: "value",
      numeric: idx === 1 || idx === 2,
      range: idx === 1,
    });
  }
  go(RULES[rule], { numeric, inAbs: false, range: false, level: 0, rule });
  return { text: out.join(" ").replace(/ \n /g, "\n"), visited };
}

// The walk writes every word with a space between. This closes up the brackets, the commas and the
// powers the way people type them; it changes no meaning (the test reads both with the real reader).
export const compact = (text) =>
  text
    .replace(/([([{]) /g, "$1")
    .replace(/ ([)\]},])/g, "$1")
    .replace(/ ?\^ ?/g, "^")
    .replace(/(\w) \(/g, "$1(");

// ---- Drawing the tracks ----------------------------------------------------------------------
const CHAR = 7.9;
const BOX_H = 24;
const GAP = 14;
const R = 10;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function measure(node) {
  if (node._m) return node._m;
  let m;
  switch (node.k) {
    case "t":
      m = { w: node.text.length * CHAR + 20, up: BOX_H / 2, down: BOX_H / 2 };
      break;
    case "nt":
      m = { w: node.rule.length * CHAR + 20, up: BOX_H / 2, down: BOX_H / 2 };
      break;
    case "note":
      m = { w: node.text.length * 6.4 + 8, up: 8, down: 8 };
      break;
    case "words": {
      const cols = node.list.length > 8 ? 4 : node.list.length > 5 ? 3 : 2;
      const rows = Math.ceil(node.list.length / cols);
      const cw = Math.max(...node.list.map((x) => x.length)) * CHAR + 14;
      node._cols = cols;
      node._cw = cw;
      const h = rows * 20 + 10;
      m = { w: cols * cw + 10, up: h / 2, down: h / 2 };
      break;
    }
    case "seq": {
      const ms = node.items.map(measure);
      m = {
        w: ms.reduce((s, x) => s + x.w, 0) + GAP * (ms.length - 1),
        up: Math.max(...ms.map((x) => x.up)),
        down: Math.max(...ms.map((x) => x.down)),
      };
      break;
    }
    case "or": {
      const ms = node.items.map(measure);
      const w = Math.max(...ms.map((x) => x.w)) + 2 * (R + 6);
      let down = ms[0].down;
      for (let i = 1; i < ms.length; i++) down += 10 + ms[i].up + ms[i].down;
      m = { w, up: ms[0].up, down };
      break;
    }
    case "opt":
    case "rep": {
      const it = measure(node.item);
      const w = it.w + 2 * (R + 6);
      // The skip rail is on the baseline; the item sits below it (opt) or on it with a return rail (rep).
      m = node.k === "opt"
        ? { w, up: 12, down: 12 + 10 + it.up + it.down }
        : { w, up: Math.max(12, it.up), down: Math.max(it.down, 12) + 10 + 14 }; // prettier-ignore
      node._it = it;
      break;
    }
  }
  node._m = m;
  return m;
}

// Each drawing returns SVG for the element with its left end at x, baseline at y.
const rail = (x1, y1, x2, y2, cls = "", rid = "") =>
  `<path class="rr-rail ${cls}"${rid ? ` data-rr="${rid}"` : ""} d="M${x1} ${y1} L${x2} ${y2}"/>`;

function draw(node, x, y) {
  const m = measure(node);
  switch (node.k) {
    case "t":
      return `<g class="rr-t" data-rr="${node.id}"><rect x="${x}" y="${y - BOX_H / 2}" width="${m.w}" height="${BOX_H}" rx="${BOX_H / 2}"/><text x="${x + m.w / 2}" y="${y + 4.5}" text-anchor="middle">${esc(node.text)}</text></g>`; // prettier-ignore
    case "nt":
      return `<g class="rr-nt" data-rr="${node.id}" data-rule="${node.rule}"><a href="#rr-${node.rule}"><rect x="${x}" y="${y - BOX_H / 2}" width="${m.w}" height="${BOX_H}" rx="3"/><text x="${x + m.w / 2}" y="${y + 4.5}" text-anchor="middle">${esc(node.rule)}</text></a></g>`; // prettier-ignore
    case "note":
      return `<text class="rr-note" x="${x + 2}" y="${y + 4}">${esc(node.text)}</text>`;
    case "words": {
      const rows = Math.ceil(node.list.length / node._cols);
      const h = rows * 20 + 10;
      let s = `<g class="rr-words" data-rr="${node.id}"><rect x="${x}" y="${y - h / 2}" width="${m.w}" height="${h}" rx="10"/>`;
      node.list.forEach((word, i) => {
        const c = i % node._cols;
        const r = Math.floor(i / node._cols);
        s += `<text data-rr="${node.ids[i]}" x="${x + 5 + c * node._cw + node._cw / 2}" y="${y - h / 2 + 20 + r * 20 - 4}" text-anchor="middle">${esc(word)}</text>`; // prettier-ignore
      });
      return `${s}</g>`;
    }
    case "seq": {
      let s = "";
      let cx = x;
      node.items.forEach((it, i) => {
        const im = measure(it);
        if (i) s += rail(cx - GAP, y, cx, y);
        s += draw(it, cx, y);
        cx += im.w + GAP;
      });
      return s;
    }
    case "or": {
      let s = "";
      const inner = m.w - 2 * (R + 6);
      let by = y;
      node.items.forEach((it, i) => {
        const im = measure(it);
        if (i) by += node.items[i - 1] && measure(node.items[i - 1]).down + 10 + im.up;
        const left = x + R + 6;
        const bid = it.branch;
        if (i === 0) {
          s += rail(x, y, left, y, "", bid) + rail(left + im.w, y, x + m.w, y, "", bid);
        } else {
          const dy = by - y;
          s += `<path class="rr-rail" data-rr="${bid}" d="M${x} ${y} q${R} 0 ${R} ${R} v${dy - 2 * R} q0 ${R} ${R} ${R} H${left}"/>`;
          s += `<path class="rr-rail" data-rr="${bid}" d="M${left + im.w} ${by} H${x + m.w - R} q${R} 0 ${R} ${-R} v${-(dy - 2 * R)} q0 ${-R} ${-R} ${-R}"/>`;
        }
        if (it.k !== "seq" || true) s += rail(left + im.w, by, x + m.w - R, by, "", bid);
        s += draw(it, left, by);
        void inner;
      });
      return s;
    }
    case "opt": {
      const it = node._it;
      const left = x + R + 6;
      const by = y + 12 + 10 + it.up;
      const dy = by - y;
      let s = rail(x, y, x + m.w, y, "", node.skip);
      s += `<path class="rr-rail" data-rr="${node.take}" d="M${x} ${y} q${R} 0 ${R} ${R} v${dy - 2 * R} q0 ${R} ${R} ${R} H${left}"/>`;
      s += rail(left + it.w, by, x + m.w - R, by, "", node.take);
      s += `<path class="rr-rail" data-rr="${node.take}" d="M${x + m.w - R} ${by} q${R} 0 ${R} ${-R} v${-(dy - 2 * R)} q0 ${-R} ${-R} ${-R}"/>`;
      return s + draw(node.item, left, by);
    }
    case "rep": {
      const it = node._it;
      const left = x + R + 6;
      const back = y + Math.max(it.down, 12) + 10 + 14;
      const rightEdge = x + m.w;
      let s =
        rail(x, y, left, y, "", node.skip) + rail(left + it.w, y, rightEdge, y, "", node.skip);
      s += rail(left, y, left, y) + draw(node.item, left, y);
      // The way back: from the item's right end, down, left, up, and into its left end.
      s += `<path class="rr-rail" data-rr="${node.loop}" d="M${left + it.w} ${y} q${R} 0 ${R} ${R} V${back - R} q0 ${R} ${-R} ${R} H${left - R} q${-R} 0 ${-R} ${-R} V${y + R} q0 ${-R} ${R} ${-R}"/>`; // prettier-ignore
      return s;
    }
  }
  return "";
}

// One rule as an SVG string: a rail in from the left, the rule, and a rail out to the right.
export function renderRule(name) {
  const node = RULES[name];
  const m = measure(node);
  const pad = 14;
  const w = m.w + 2 * pad + 12;
  const h = m.up + m.down + 16;
  const y = 8 + m.up;
  return `<svg class="rr-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="The rule ${esc(name)} drawn as tracks">
    <circle class="rr-end" cx="6" cy="${y}" r="4"/>${rail(10, y, pad + 6, y)}${draw(node, pad + 6, y)}${rail(pad + 6 + m.w, y, w - 10, y)}<circle class="rr-end" cx="${w - 6}" cy="${y}" r="4"/>
  </svg>`;
}

// ---- Reading the manual's text version of the grammar (for the test) -------------------------------
// The words in quotes and the rule names on the right of each rule, so a test can check the diagram
// draws the same grammar the text writes.
export function ruleFacts(name) {
  const quoted = new Set();
  const refs = new Set();
  const visit = (n) => {
    switch (n.k) {
      case "t":
        quoted.add(n.text);
        break;
      case "words":
        n.list.forEach((x) => quoted.add(x));
        break;
      case "nt":
        refs.add(n.rule);
        break;
      case "seq":
      case "or":
        n.items.forEach(visit);
        break;
      case "opt":
      case "rep":
        visit(n.item);
        break;
    }
  };
  visit(RULES[name]);
  return { quoted, refs };
}
