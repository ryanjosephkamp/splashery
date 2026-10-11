// Writes Level 2's "How many splats?" tables into manual/index.html from docs/lab/BUDGETS.md (the
// Kit lab's sweep of October 10, 2026), so every number in them is the document's. Run it again if
// that document changes:
//
//   node manual/build-budget.mjs && npx prettier --write manual/index.html
//
// It replaces everything between the two BUDGET markers in index.html.

import fs from "node:fs";

const doc = fs.readFileSync(new URL("../docs/lab/BUDGETS.md", import.meta.url), "utf8");
const indexUrl = new URL("./index.html", import.meta.url);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---- The per-toy table: each row "name (view) | splats | edge | speckle | shimmer | area" ----------
export function readRows() {
  const rows = [];
  for (const line of doc.split("\n")) {
    const c = line.split("|").map((s) => s.trim());
    if (c.length < 8 || !/^[a-z-]+ \((home|[0-9.]+)\)$/.test(c[1])) continue;
    const five = (s) => s.split("·").map((x) => Number(x.trim()));
    const sil = c[6].includes("·") ? c[6].split("·").map((x) => Number(x.trim())) : null;
    rows.push({
      name: c[1],
      edge: five(c[3]),
      speckle: five(c[4]),
      shimmer: five(c[5]),
      area: sil,
    });
  }
  return rows;
}

// The across-all-views table: Budget | Edge | Speckle | Shimmer | Silhouette area.
export function readSummary() {
  const out = [];
  for (const line of doc.split("\n")) {
    const c = line.split("|").map((s) => s.trim());
    if (c.length === 7 && /^\d+k$/.test(c[1])) out.push(c.slice(1, 6));
  }
  return out;
}

const nice = (name) => {
  const m = /^([a-z-]+) \((.+)\)$/.exec(name);
  const t = m[1].replace(/-/g, " ");
  return `${t[0].toUpperCase()}${t.slice(1)}${m[2] === "home" ? "" : ` (close up, ${m[2]})`}`;
};
const f2 = (n) => n.toFixed(2);
const cell = (a, b) => {
  const cls = b > a ? "worse" : b < a ? "better" : "same";
  return `<td class="pair ${cls}">${f2(a)} → ${f2(b)}</td>`;
};

export function build() {
  const rows = readRows();
  const sum = readSummary();
  if (rows.length !== 24) throw new Error(`Expected 24 views in BUDGETS.md, found ${rows.length}`);
  if (sum.length !== 5) throw new Error(`Expected 5 budgets in the summary, found ${sum.length}`);
  // Index 1 is 140k, index 2 is 200k.
  const count = (k, cmp) => rows.filter((r) => cmp(r[k][2], r[k][1])).length;
  const counts = {
    edgeBetter: count("edge", (b, a) => b < a),
    edgeSame: count("edge", (b, a) => b === a),
    edgeWorse: count("edge", (b, a) => b > a),
    speckleWorse: count("speckle", (b, a) => b > a),
    speckleBetter: count("speckle", (b, a) => b < a),
    shimmerWorse: count("shimmer", (b, a) => b > a),
    shimmerBetter: count("shimmer", (b, a) => b < a),
  };
  let out =
    "      <!-- BUDGET:START (written by manual/build-budget.mjs; do not edit by hand) -->\n";
  out += `      <p class="table-note">
        <b>Same toy, same view, same phone: 140,000 splats → 200,000 splats.</b> Lower is better in
        every column. <span class="swatch worse">Worse</span>
        <span class="swatch better">Better</span> <span class="swatch same">The same</span> On a
        screen, the table scrolls sideways inside its box.
      </p>
      <div class="table-wrap budget-wrap" tabindex="0" role="region" aria-label="Table: the same 24 views at 140,000 and 200,000 splats. Scrolls sideways.">
        <table class="budget">
          <caption class="sr-only">The same 24 views at 140,000 and 200,000 splats</caption>
          <thead>
            <tr>
              <th scope="col">Toy (view)</th>
              <th scope="col">Edge (screen pixels)</th>
              <th scope="col">Speckle</th>
              <th scope="col">Shimmer</th>
              <th scope="col">Area, 60k → 140k</th>
            </tr>
          </thead>
          <tbody>
${rows
  .map(
    (r) => `            <tr>
              <th scope="row">${esc(nice(r.name))}</th>
              ${cell(r.edge[1], r.edge[2])}
              ${cell(r.speckle[1], r.speckle[2])}
              ${cell(r.shimmer[1], r.shimmer[2])}
              <td class="pair">${r.area ? `${r.area[0]}% → ${r.area[1]}%` : "–"}</td>
            </tr>`,
  )
  .join("\n")}
          </tbody>
        </table>
      </div>
      <p class="table-note">
        <b>All five budgets across all the views:</b> the middle value of each toy's change against
        its own result at 140,000 splats.
      </p>
      <div class="table-wrap budget-wrap" tabindex="0" role="region" aria-label="Table: how each budget compares with 140,000 splats, across all the views. Scrolls sideways.">
        <table class="budget summary">
          <caption class="sr-only">How each budget compares with 140,000 splats</caption>
          <thead>
            <tr>
              <th scope="col">Budget</th>
              <th scope="col">Edge</th>
              <th scope="col">Speckle</th>
              <th scope="col">Shimmer</th>
              <th scope="col">Thin parts' area</th>
            </tr>
          </thead>
          <tbody>
${sum
  .map(
    (r) => `            <tr>
              <th scope="row">${esc(r[0])}</th>
              ${r
                .slice(1)
                .map((x) => `<td>${esc(x)}</td>`)
                .join("\n              ")}
            </tr>`,
  )
  .join("\n")}
          </tbody>
        </table>
      </div>
      <!-- COUNTS ${JSON.stringify(counts)} -->
`;
  out += "      <!-- BUDGET:END -->\n";
  return { out, counts };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { out, counts } = build();
  const html = fs.readFileSync(indexUrl, "utf8");
  const a = html.indexOf("      <!-- BUDGET:START");
  const endMark = "      <!-- BUDGET:END -->\n";
  const b = html.indexOf(endMark);
  if (a < 0 || b < 0) throw new Error("The BUDGET markers are not in index.html yet.");
  fs.writeFileSync(indexUrl, html.slice(0, a) + out + html.slice(b + endMark.length));
  console.log("Budget tables written.", counts);
}
