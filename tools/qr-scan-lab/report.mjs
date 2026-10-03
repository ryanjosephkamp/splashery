#!/usr/bin/env node
// Builds the scorecard tables from the lab's CSVs: node tools/qr-scan-lab/report.mjs [toy|reference]
// Prints Markdown tables to stdout; the written findings live in the scorecard itself.
// A capture "decodes" when BOTH readers return the exact text. "plain" passes try upright codes
// only; "inverted-aware" passes also try light-on-dark codes (jsQR attemptBoth, zxing inverted).
import fs from "node:fs";
import path from "node:path";

const source = process.argv[2] || "toy";
const dir = process.argv[3] || "tools/qr-scan-lab/data";
export const rows = [];
for (const f of fs
  .readdirSync(dir)
  .filter((f) => f.startsWith(`${source}-`) && f.endsWith("-results.csv"))) {
  const lines = fs.readFileSync(path.join(dir, f), "utf8").trim().split("\n");
  const head = lines.shift().split(",");
  for (const l of lines) {
    const v = l.split(",");
    const r = Object.fromEntries(head.map((h, i) => [h, v[i]]));
    for (const k of ["jsqr", "zxing", "jsqr_inv", "zxing_inv"]) r[k] = Number(r[k]);
    r.contrast = Number(r.contrast);
    rows.push(r);
  }
}
const ok = (r, inv) =>
  inv ? r.jsqr_inv === 1 && r.zxing_inv === 1 : r.jsqr === 1 && r.zxing === 1;
const rate = (list, inv = false) =>
  list.length ? list.filter((r) => ok(r, inv)).length / list.length : NaN;
const pct = (v) => (Number.isNaN(v) ? "n/a" : `${Math.round(v * 100)}%`);
const uniq = (key, list = rows) => [...new Set(list.map(key))];
const group = (list, key) => {
  const m = new Map();
  for (const r of list) (m.get(key(r)) ?? m.set(key(r), []).get(key(r))).push(r);
  return m;
};
const table = (title, head, body, note = "") =>
  [
    `### ${title}`,
    "",
    ...(note ? [note, ""] : []),
    `| ${head.join(" | ")} |`,
    `|${head.map(() => "---").join("|")}|`,
    ...body.map((r) => `| ${r.join(" | ")} |`),
    "",
  ].join("\n");

const STYLE_ORDER = ["classic", "dots", "rounded", "bricks", "gems", "bubbles", "neon", "neon-light"]; // prettier-ignore
const styles = uniq((r) => r.style).sort((a, b) => STYLE_ORDER.indexOf(a) - STYLE_ORDER.indexOf(b));
const warp = rows.filter((r) => r.kind === "warp");
const cam = rows.filter((r) => r.kind === "cam");
// Dark-on-light schemes only, for the pooled tables (inverted and neon's light-on-dark go apart).
const darkOnLight = (r) => r.scheme !== "inverted" && r.style !== "neon";
const sub = (list, style, f = () => true) => list.filter((r) => r.style === style && f(r));
const out = [];
out.push(
  `_${rows.length} captures (${warp.length} 2D-warped, ${cam.length} from the toy's own camera); texts: ${uniq((r) => r.text).join(", ")}._\n`,
);

out.push(
  table(
    "Decode rate per style, plain readers",
    ["Style", "Both readers", "jsQR", "zxing", "Captures"],
    styles.map((s) => {
      const l = sub(warp, s, (r) => r.scheme !== "inverted");
      return [
        s,
        pct(rate(l)),
        pct(l.filter((r) => r.jsqr === 1).length / l.length),
        pct(l.filter((r) => r.zxing === 1).length / l.length),
        l.length,
      ];
    }),
    "Every error correction level, color scheme (not inverted), text and 2D capture condition pooled.",
  ),
);
out.push(
  table(
    "Light on dark: plain readers against inverted-aware readers",
    [
      "Style / scheme",
      "Plain, both",
      "Plain, jsQR",
      "Plain, zxing",
      "Inverted-aware, both",
      "Inverted-aware, jsQR",
      "Inverted-aware, zxing",
    ],
    [
      ...group(
        warp.filter((r) => r.style === "neon" || r.scheme === "inverted"),
        (r) => `${r.style}/${r.scheme}`,
      ),
    ].map(([k, l]) => [
      k,
      pct(rate(l)),
      pct(l.filter((r) => r.jsqr === 1).length / l.length),
      pct(l.filter((r) => r.zxing === 1).length / l.length),
      pct(rate(l, true)),
      pct(l.filter((r) => r.jsqr_inv === 1).length / l.length),
      pct(l.filter((r) => r.zxing_inv === 1).length / l.length),
    ]),
    "Neon is light on dark by design. An inverted-aware reader tries the code inverted when the plain pass fails.",
  ),
);
const conds = uniq((r) => r.condition, warp);
const byCond = conds.map((c) => [
  c,
  ...styles.map((s) =>
    rate(
      sub(
        warp,
        s,
        (r) =>
          (r.condition === c && darkOnLight(r)) ||
          (s === "neon" && r.condition === c && r.scheme !== "inverted"),
      ),
    ),
  ),
]);
out.push(
  table(
    "Decode rate per 2D capture condition, worst first",
    ["Condition", ...styles],
    byCond
      .sort(
        (a, b) =>
          a.slice(1).reduce((x, y) => x + (y || 0), 0) -
          b.slice(1).reduce((x, y) => x + (y || 0), 0),
      )
      .map((r) => [r[0], ...r.slice(1).map(pct)]),
    "Plain readers, every level, scheme (not inverted) and text pooled. Neon is read plain here.",
  ),
);
const schemes = uniq((r) => r.scheme, warp);
out.push(
  table(
    "Decode rate per color scheme (contrast of dark against light in brackets)",
    ["Scheme", ...styles],
    schemes.map((sc) => [
      sc,
      ...styles.map((s) => {
        const l = sub(warp, s, (r) => r.scheme === sc);
        return l.length ? `${pct(rate(l))} (${l[0].contrast.toFixed(1)})` : "n/a";
      }),
    ]),
    "Plain readers. Contrast is the WCAG ratio of the style's dark and light colors.",
  ),
);
const ecs = ["L", "M", "Q", "H", "auto"].filter((e) => rows.some((r) => r.ec === e));
out.push(
  table(
    "Decode rate per error correction level",
    ["Level", ...styles],
    ecs.map((e) => [
      e,
      ...styles.map((s) => pct(rate(sub(warp, s, (r) => r.ec === e && r.scheme !== "inverted")))),
    ]),
    "Plain readers, every scheme except inverted, text and condition pooled.",
  ),
);
const texts = uniq((r) => r.text);
out.push(
  table(
    "Decode rate per text",
    ["Text", "Version at M", ...styles],
    texts.map((t) => [
      t,
      uniq(
        (r) => r.version,
        rows.filter((r) => r.text === t && (r.ec === "M" || r.ec === "auto")),
      ).join("/"),
      ...styles.map((s) => pct(rate(sub(warp, s, (r) => r.text === t && r.scheme !== "inverted")))),
    ]),
    "Plain readers. Short, 43-character and about-100-character texts give different code versions.",
  ),
);

const REALISTIC = [
  "front",
  "tilt20",
  "mod4",
  "mod6",
  "blur20",
  "jpeg30",
  "light30",
  "persp",
  "phone",
];
const real = warp.filter((r) => r.scheme === "preset" && REALISTIC.includes(r.condition));
const realCell = (list, inv) => {
  const perText = uniq((r) => r.text, list).map((t) =>
    rate(
      list.filter((r) => r.text === t),
      inv,
    ),
  );
  return `${pct(rate(list, inv))} (worst text ${pct(Math.min(...perText))})`;
};
out.push(
  table(
    "Phone-like captures, preset colors: error correction level against style",
    ["Level", ...styles],
    ecs.map((e) => [
      e,
      ...styles.map((s) =>
        realCell(
          sub(real, s, (r) => r.ec === e),
          s === "neon",
        ),
      ),
    ]),
    `Plain readers for every style but neon (inverted-aware here). Conditions: ${REALISTIC.join(", ")}; the three texts pooled, with the worst text in brackets.`,
  ),
);
const realOk = (r) => ok(r, r.style === "neon");
out.push(
  table(
    "Module size, preset colors (px per module in the capture, front-on)",
    ["Condition", ...styles],
    ["mod3", "mod4", "mod6", "front"].map((c) => [
      c === "front" ? "8 px (front)" : `${c.slice(3)} px`,
      ...styles.map((s) => {
        const l = sub(warp, s, (r) => r.scheme === "preset" && r.condition === c);
        return pct(l.filter(realOk).length / l.length);
      }),
    ]),
    "Neon is read by the inverted-aware readers here.",
  ),
);
if (cam.length) {
  const camConds = uniq((r) => r.condition, cam);
  const camStyles = uniq((r) => r.style, cam).sort(
    (a, b) => STYLE_ORDER.indexOf(a) - STYLE_ORDER.indexOf(b),
  );
  out.push(
    table(
      "The toy's own camera turned in 3D (real depth), preset colors",
      ["View (full size, or shrunk to 8 or 4 px per module)", ...camStyles],
      camConds.map((c) => [
        c,
        ...camStyles.map((s) => pct(rate(sub(cam, s, (r) => r.condition === c)))),
      ]),
      "Plain readers; the camera's yaw or pitch turned 10°, 20° or 35° from Scan view. Compare with the 2D-warped tilt rows above.",
    ),
  );
}
console.log(out.join("\n"));
