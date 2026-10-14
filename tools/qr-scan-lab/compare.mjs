#!/usr/bin/env node
// Round 2 against round 1 of the toy: node tools/qr-scan-lab/compare.mjs
// Round 1 (toy at f86e0880, levels L M Q H) is in data/r1; round 2 (Auto = M) is in data/.
// Compared on what both rounds measured: preset colors, level M, the three texts and the 12
// conditions round 1 ran. Neon (light on dark) is read by the inverted-aware readers in both.
import fs from "node:fs";
import path from "node:path";

const load = (dir, prefix) => {
  const rows = [];
  for (const f of fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith("-results.csv"))) {
    const [head, ...lines] = fs.readFileSync(path.join(dir, f), "utf8").trim().split("\n");
    const keys = head.split(",");
    for (const l of lines) {
      const v = l.split(",");
      const r = Object.fromEntries(keys.map((k, i) => [k, v[i]]));
      for (const k of ["jsqr", "zxing", "jsqr_inv", "zxing_inv"]) r[k] = Number(r[k]);
      rows.push(r);
    }
  }
  return rows;
};
const r1 = load("tools/qr-scan-lab/data/r1", "toy-").filter(
  (r) => r.ec === "M" && r.scheme === "preset",
);
const r2 = load("tools/qr-scan-lab/data", "toy-r2-").filter(
  (r) => (r.ec === "auto" || r.ec === "M") && r.scheme === "preset",
);
const shared = new Set(r1.filter((r) => r.kind === "warp").map((r) => r.condition));
const REAL = ["front", "tilt20", "mod4", "mod6", "blur20", "jpeg30", "light30", "persp", "phone"];
const ok = (r, inv) =>
  inv ? r.jsqr_inv === 1 && r.zxing_inv === 1 : r.jsqr === 1 && r.zxing === 1;
const rate = (list, inv) =>
  list.length ? list.filter((r) => ok(r, inv)).length / list.length : NaN;
const pct = (v) => (Number.isNaN(v) ? "n/a" : `${Math.round(v * 100)}%`);
const delta = (a, b) => (Number.isNaN(a) ? "new" : `${pct(a)} → ${pct(b)}`);
const styles = ["classic", "dots", "rounded", "bricks", "gems", "bubbles", "neon", "neon-light"];
const inv = (s) => s === "neon";
const sel = (rows, s, f) => rows.filter((r) => r.style === s && f(r));
const table = (title, head, body, note) => [`### ${title}`, "", note, "", `| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...body.map((r) => `| ${r.join(" | ")} |`), ""].join("\n"); // prettier-ignore

const out = [];
out.push(
  table(
    "Round 1 → round 2, 2D phone captures, preset colors, level M",
    ["Style", "All shared conditions", "Phone-like conditions", "Harder: tilt35, mod3, hard"],
    styles.map((s) => {
      const f = (rows, c) =>
        rate(
          sel(rows, s, (r) => r.kind === "warp" && c(r)),
          inv(s),
        );
      return [
        s,
        delta(
          f(r1, (r) => shared.has(r.condition)),
          f(r2, (r) => shared.has(r.condition)),
        ),
        delta(
          f(r1, (r) => REAL.includes(r.condition)),
          f(r2, (r) => REAL.includes(r.condition)),
        ),
        delta(
          f(r1, (r) => ["tilt35", "mod3", "hard"].includes(r.condition)),
          f(r2, (r) => ["tilt35", "mod3", "hard"].includes(r.condition)),
        ),
      ];
    }),
    "Round 1 is the toy at `f86e0880`; round 2 is `7839a25b` at Auto error correction (M). Neon is read by the inverted-aware readers; `neon-light` (Neon on a pale wall, dark on light) by the plain ones.",
  ),
);
const camIds = [...new Set(r2.filter((r) => r.kind === "cam").map((r) => r.condition))].filter(
  (c) => c.endsWith("@full"),
);
out.push(
  table(
    "Round 1 → round 2, the toy's own camera turned in 3D (full size), preset colors, level M",
    ["View", ...styles.filter((s) => s !== "neon-light").map((s) => s), "neon-light (round 2)"],
    camIds.map((c) => [
      c.replace("@full", ""),
      ...styles
        .filter((s) => s !== "neon-light")
        .map((s) =>
          delta(
            rate(
              sel(r1, s, (r) => r.condition === c),
              inv(s),
            ),
            rate(
              sel(r2, s, (r) => r.condition === c),
              inv(s),
            ),
          ),
        ),
      pct(
        rate(
          sel(r2, "neon-light", (r) => r.condition === c),
          false,
        ),
      ),
    ]),
    "Each cell is 3 captures (one per text), so single cells swing by 33 points; read the pattern, not the cell.",
  ),
);
console.log(out.join("\n"));
